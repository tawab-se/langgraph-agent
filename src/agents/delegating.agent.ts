import { StateGraph, END, START } from '@langchain/langgraph';
import { AgentState, ToolDecision, StreamingResponse, ResponseData } from './types.js';
import { ragAgent } from './rag.agent.js';
import { chartTool } from '../tools/chart.tool.js';
import { imageTool } from '../tools/image.tool.js';
import { geminiClient } from '../llm/gemini.client.js';
import { colors, printRouting } from '../utils/terminal.ui.js';

export interface SSEEvent {
  type: 'thinking' | 'route' | 'token' | 'references' | 'chart' | 'image' | 'sources' | 'done' | 'error';
  data: any;
}
export class DelegatingAgent {
  private workflow: any;

  constructor() {
    this.workflow = this.buildWorkflow();
  }

  private buildWorkflow() {
    // Define the state graph with proper type annotation
    const workflow = new StateGraph<AgentState>({
      channels: {
        query: { 
          value: (left?: string, right?: string) => right || left || '',
          default: () => '',
        },
        decision: { 
          value: (left?: any, right?: any) => right || left,
        },
        ragResults: { 
          value: (left?: any, right?: any) => right || left,
        },
        chartConfig: { 
          value: (left?: any, right?: any) => right || left,
        },
        finalAnswer: { 
          value: (left?: string, right?: string) => right || left || '',
          default: () => '',
        },
        data: { 
          value: (left?: any[], right?: any[]) => right?.length ? right : (left || []),
          default: () => [],
        },
      },
    });

    // Add nodes
    workflow.addNode('router', this.routerNode.bind(this));
    workflow.addNode('rag', this.ragNode.bind(this));
    workflow.addNode('chart', this.chartNode.bind(this));
    workflow.addNode('direct', this.directNode.bind(this));
    workflow.addNode('image', this.imageNode.bind(this));
    workflow.addNode('aggregator', this.aggregatorNode.bind(this));

    // Add edges
    workflow.addEdge(START as any, 'router' as any);
    
    // Conditional routing from router
    workflow.addConditionalEdges(
      'router' as any,
      this.routeDecision.bind(this),
      {
        rag: 'rag' as any,
        chart: 'chart' as any,
        direct: 'direct' as any,
        image: 'image' as any,
        both: 'rag' as any, // For 'both', we go to rag first, then chart
      }
    );

    workflow.addEdge('rag' as any, 'aggregator' as any);
    workflow.addEdge('chart' as any, 'aggregator' as any);
    workflow.addEdge('direct' as any, 'aggregator' as any);
    workflow.addEdge('image' as any, 'aggregator' as any);
    workflow.addEdge('aggregator' as any, END as any);

    return workflow.compile();
  }

  /**
   * Router node - decides which tools to use
   */
  private async routerNode(state: AgentState): Promise<Partial<AgentState>> {
    console.log(colors.delegating('\n🤖 Delegating Agent: ') + colors.info('Analyzing query...'));
    
    const prompt = `
You are a routing agent that decides WHERE the answer should come from.

AVAILABLE ROUTES:
- rag: Use when the user is asking about specific documents, uploaded files,
  company data, stored knowledge, or domain-specific facts that would be in a
  knowledge base. Examples: "what does our policy say about...", "find info about
  product X from the docs", "what are the sales numbers".
- chart: Use when the user asks to create, modify, or explain a chart or chart.js
  configuration, visualization setup, or mock chart data.
- both: Use when the user needs information from the knowledge base AND a chart
  or visualization built from that information.
- image: Use when the user asks to generate, create, draw, or design an image,
  picture, photo, illustration, or artwork. Also use when the user wants to edit,
  modify, or transform an existing image. Examples: "generate an image of a sunset",
  "create a portrait", "draw a futuristic city", "make this image look like a painting".
- direct: Use when the question is about general knowledge, concepts, how things
  work, coding help, math, creative writing, or anything that does NOT require
  looking up specific stored documents. Examples: "how does AI work",
  "explain kubernetes", "what is machine learning", "write a function that...".

CRITICAL RULES:
- General knowledge questions should ALWAYS go to 'direct'.
- Only use 'rag' when the user clearly wants information from their stored documents/knowledge base.
- If the question is about a general topic (technology, science, programming concepts), use 'direct'.
- If the user asks to generate, create, or edit an image/picture/photo, ALWAYS use 'image'.
- If unsure, prefer 'direct' over 'rag' — the LLM can answer most questions well.

Query:
"${state.query}"

Respond with JSON only: {"tools": ["rag"|"chart"|"both"|"direct"|"image"], "reasoning": "..."}`;

    const response = await geminiClient.generate(prompt);
    
    let decision: ToolDecision;
    try {
      const parsed = JSON.parse(response);
      // Normalize tools to always be an array
      const tools = Array.isArray(parsed.tools) ? parsed.tools : [parsed.tools || 'rag'];
      decision = { tools, reasoning: parsed.reasoning || 'Routed by LLM' };
    } catch {
      // Fallback: keyword-based routing
      if (response.toLowerCase().includes('image')) {
        decision = { tools: ['image'], reasoning: 'Query mentions image generation' };
      } else if (response.toLowerCase().includes('chart')) {
        decision = { tools: ['chart'], reasoning: 'Query mentions visualization' };
      } else if (response.toLowerCase().includes('direct') ||
                 /\d+\s*[\+\-\*\/]\s*\d+/.test(state.query)) {
        decision = { tools: ['direct'], reasoning: 'Math/code task' };
      } else {
        decision = { tools: ['rag'], reasoning: 'Informational query - checking knowledge base' };
      }
    }

    printRouting('Router', decision.tools.join(', '), decision.reasoning);
    
    return { decision };
  }

  private routeDecision(state: AgentState): string {
    const tools = state.decision?.tools || ['direct'];
    const mainTool = tools[0];
    
    if (mainTool === 'both') {
      return 'both';
    }
    
    return mainTool;
  }

  private async ragNode(state: AgentState): Promise<Partial<AgentState>> {
    console.log(colors.rag('\n📚 Executing RAG Agent...'));

    // Check if we also need chart (for 'both' case)
    const needsChart = state.decision?.tools.includes('both');

    if (needsChart) {
      console.log(colors.chart('\n📊 Also executing Chart Tool...'));
      const wantsSequential = /\b(then|after|first|next)\b/i.test(state.query);

      if (wantsSequential) {
        const ragResults = await ragAgent.query(state.query);
        const chartConfig = await chartTool.execute(state.query);
        return { ragResults, chartConfig };
      }

      const [ragResults, chartConfig] = await Promise.all([
        ragAgent.query(state.query),
        chartTool.execute(state.query),
      ]);
      return { ragResults, chartConfig };
    }

    const ragResults = await ragAgent.query(state.query);
    return { ragResults };
  }

  private async chartNode(state: AgentState): Promise<Partial<AgentState>> {
    console.log(colors.chart('\n📊 Executing Chart Tool...'));
    
    const chartConfig = await chartTool.execute(state.query);
    
    return { chartConfig };
  }

  private async directNode(state: AgentState): Promise<Partial<AgentState>> {
    console.log(colors.system('\n💬 Providing direct answer...'));
    
    const answer = await geminiClient.generate(
      `Answer the following question directly and concisely: ${state.query}`
    );
    
    return { finalAnswer: answer };
  }

  private async imageNode(state: AgentState): Promise<Partial<AgentState>> {
    console.log(colors.info('\n🎨 Executing Image Tool...'));

    const result = await imageTool.execute(state.query, state.imageUrl);

    return {
      finalAnswer: `Here is the generated image for: "${state.query}"`,
      data: [{ type: 'image' as const, url: result.url, prompt: result.prompt, model: result.model }],
    };
  }

  private async aggregatorNode(state: AgentState): Promise<Partial<AgentState>> {
    console.log(colors.dim('\n🔄 Aggregating results...'));
    
    const data = [];
    let answer = '';

    // Add RAG results
    if (state.ragResults) {
      answer = state.ragResults.answer;
      data.push(...state.ragResults.references);
    }

    // Add chart config
    if (state.chartConfig) {
      data.push({
        type: 'chart' as const,
        config: state.chartConfig,
      });
      
      if (answer) {
        answer += '\n\n[Chart configuration included in data]';
      } else {
        answer = 'Here is the requested chart configuration.';
      }
    }

    // Use direct answer if no tools were used
    if (!answer && state.finalAnswer) {
      answer = state.finalAnswer;
    }

    return { finalAnswer: answer, data };
  }

  async *processQuery(query: string): AsyncGenerator<StreamingResponse, void, unknown> {
    console.log(colors.bold(`\n${'═'.repeat(60)}`));
    console.log(colors.bold.cyan(`🚀 Processing Query: `) + colors.info(`"${query}"`));
    console.log(colors.bold(`${'═'.repeat(60)}`));

    // Initialize state
    const initialState: AgentState = {
      query,
      finalAnswer: '',
      data: [],
    };

    try {
      // Run the workflow
      const result = await this.workflow.invoke(initialState);

      // Clear answer header before streaming
      console.log(colors.bold('\n💬 Answer:'));
      console.log(colors.dim('─'.repeat(40)));

      // Stream the answer as incremental chunks
      const answer = result.finalAnswer || 'No answer generated';
      const words = answer.split(' ');

      for (let i = 0; i < words.length; i++) {
        const chunkText = (i > 0 ? ' ' : '') + words[i];

        // Yield chunk without data (data comes at the end)
        yield {
          answer: chunkText,
          data: [],
        };

        // Small delay to simulate streaming
        await new Promise(resolve => setTimeout(resolve, 30));
      }

      // Final yield with complete data (no extra answer text)
      yield {
        answer: '',
        data: result.data || [],
      };

      console.log(colors.success('\n✅ Query processing completed'));
      
    } catch (error) {
      console.error(colors.error('❌ Error processing query:'), error);
      yield {
        answer: `Error processing query: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: [],
      };
    }
  }

  async processQuerySync(query: string): Promise<StreamingResponse> {
    let finalResponse: StreamingResponse = { answer: '', data: [] };

    for await (const chunk of this.processQuery(query)) {
      if (chunk.answer) {
        finalResponse.answer += chunk.answer;
      }
      if (chunk.data && chunk.data.length > 0) {
        finalResponse.data = chunk.data;
      }
    }

    return finalResponse;
  }

  async *processQueryStream(query: string, imageUrl?: string): AsyncGenerator<SSEEvent, void, unknown> {
    console.log(colors.bold(`\n${'═'.repeat(60)}`));
    console.log(colors.bold.cyan(`🚀 Streaming Query: `) + colors.info(`"${query}"`));
    if (imageUrl) console.log(colors.info(`🖼️  With image: ${imageUrl}`));
    console.log(colors.bold(`${'═'.repeat(60)}`));

    try {
      // 0. Yield immediately so the client gets data before the router LLM call
      yield { type: 'thinking', data: imageUrl ? 'Processing image...' : 'Routing query...' };

      let decision: ToolDecision;

      // If an image is attached, skip the router LLM call — always route to image
      if (imageUrl) {
        decision = { tools: ['image'], reasoning: 'Image attached by user' };
      } else {
        // 1. Route the query via LLM
        const state: AgentState = { query, finalAnswer: '', data: [] };
        const routerResult = await this.routerNode(state);
        decision = routerResult.decision!;
      }

      yield { type: 'route', data: decision };

      const tools = decision.tools || ['direct'];
      const mainTool = tools[0] === 'both' ? 'rag' : tools[0];
      const data: ResponseData[] = [];

      if (mainTool === 'rag') {
        // 2a. Weaviate search (fast, no LLM)
        console.log(colors.rag('\n📚 Executing RAG Agent...'));
        const searchResult = await ragAgent.search(query);

        if (searchResult.references.length > 0) {
          data.push(...searchResult.references);
          yield { type: 'references', data: searchResult.references };
        }

        // 3. Stream LLM answer
        for await (const token of geminiClient.generateStream(searchResult.prompt)) {
          yield { type: 'token', data: token };
        }

        // 4. Append sources text
        if (searchResult.references.length > 0) {
          const refText = searchResult.references.map(ref =>
            ref.pages.length === 1
              ? `${ref.displayId}- Page ${ref.pages[0]}`
              : `${ref.displayId}- Pages ${ref.pages.join(', ')}`
          ).join(' ');
          yield { type: 'sources', data: refText };
        }

        // 4b. If 'both', also get chart
        if (tools[0] === 'both') {
          console.log(colors.chart('\n📊 Also executing Chart Tool...'));
          const chartConfig = await chartTool.execute(query);
          data.push({ type: 'chart' as const, config: chartConfig });
          yield { type: 'chart', data: chartConfig };
        }
      } else if (mainTool === 'chart') {
        // 2b. Chart only
        console.log(colors.chart('\n📊 Executing Chart Tool...'));
        const chartConfig = await chartTool.execute(query);
        data.push({ type: 'chart' as const, config: chartConfig });
        yield { type: 'chart', data: chartConfig };
        yield { type: 'token', data: 'Here is the requested chart configuration.' };
      } else if (mainTool === 'image') {
        // 2c. Image generation/editing
        console.log(colors.info('\n🎨 Executing Image Tool...'));
        const result = await imageTool.execute(query, imageUrl);
        data.push({ type: 'image' as const, url: result.url, prompt: result.prompt, model: result.model });
        yield { type: 'image', data: result };
        yield { type: 'token', data: `Here is the generated image for: "${query}"` };
      } else {
        // 2c. Direct Gemini answer
        console.log(colors.system('\n💬 Providing direct answer...'));
        const prompt = `Answer the following question directly and concisely: ${query}`;
        for await (const token of geminiClient.generateStream(prompt)) {
          yield { type: 'token', data: token };
        }
      }

      yield { type: 'done', data: data };
      console.log(colors.success('\n✅ Query streaming completed'));
    } catch (error) {
      console.error(colors.error('❌ Error processing query:'), error);
      yield { type: 'error', data: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

export const delegatingAgent = new DelegatingAgent();