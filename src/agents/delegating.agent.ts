import { StateGraph, END, START } from '@langchain/langgraph';
import { AgentState, ToolDecision, StreamingResponse } from './types.js';
import { ragAgent } from './rag.agent.js';
import { chartTool } from '../tools/chart.tool.js';
import { geminiClient } from '../llm/gemini.client.js';
import { colors, printRouting } from '../utils/terminal.ui.js';

/**
 * Delegating Agent - Main orchestrator that routes queries to appropriate tools
 */
export class DelegatingAgent {
  private workflow: any;

  constructor() {
    this.workflow = this.buildWorkflow();
  }

  /**
   * Build the LangGraph workflow
   */
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
        both: 'rag' as any, // For 'both', we go to rag first, then chart
      }
    );

    workflow.addEdge('rag' as any, 'aggregator' as any);
    workflow.addEdge('chart' as any, 'aggregator' as any);
    workflow.addEdge('direct' as any, 'aggregator' as any);
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
- direct: Use when the question is about general knowledge, concepts, how things
  work, coding help, math, creative writing, or anything that does NOT require
  looking up specific stored documents. Examples: "how does AI work",
  "explain kubernetes", "what is machine learning", "write a function that...".

CRITICAL RULES:
- General knowledge questions should ALWAYS go to 'direct'.
- Only use 'rag' when the user clearly wants information from their stored documents/knowledge base.
- If the question is about a general topic (technology, science, programming concepts), use 'direct'.
- If unsure, prefer 'direct' over 'rag' — the LLM can answer most questions well.

Query:
"${state.query}"

Respond with JSON only: {"tools": ["rag"|"chart"|"both"|"direct"], "reasoning": "..."}`;

    const response = await geminiClient.generate(prompt);
    
    let decision: ToolDecision;
    try {
      const parsed = JSON.parse(response);
      // Normalize tools to always be an array
      const tools = Array.isArray(parsed.tools) ? parsed.tools : [parsed.tools || 'rag'];
      decision = { tools, reasoning: parsed.reasoning || 'Routed by LLM' };
    } catch {
      // Fallback: RAG-first for informational queries
      if (response.toLowerCase().includes('chart')) {
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

  /**
   * Route based on decision
   */
  private routeDecision(state: AgentState): string {
    const tools = state.decision?.tools || ['direct'];
    const mainTool = tools[0];
    
    if (mainTool === 'both') {
      return 'both';
    }
    
    return mainTool;
  }

  /**
   * RAG node - queries the vector database
   */
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

  /**
   * Chart node - generates chart configuration
   */
  private async chartNode(state: AgentState): Promise<Partial<AgentState>> {
    console.log(colors.chart('\n📊 Executing Chart Tool...'));
    
    const chartConfig = await chartTool.execute(state.query);
    
    return { chartConfig };
  }

  /**
   * Direct answer node - answers without tools
   */
  private async directNode(state: AgentState): Promise<Partial<AgentState>> {
    console.log(colors.system('\n💬 Providing direct answer...'));
    
    const answer = await geminiClient.generate(
      `Answer the following question directly and concisely: ${state.query}`
    );
    
    return { finalAnswer: answer };
  }

  /**
   * Aggregator node - combines all results
   */
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

  /**
   * Process a query and return streaming response
   */
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

  /**
   * Process a query and return final result (non-streaming)
   */
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
}

export const delegatingAgent = new DelegatingAgent();
