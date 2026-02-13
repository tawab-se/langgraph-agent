# LangGraph Hierarchical Agent System

A Node.js-based hierarchical AI agent system using LangGraph, Weaviate, and Google Gemini.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    USER QUERY                       │
└───────────────────────┬─────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────┐
│              DELEGATING AGENT (LangGraph)           │
│  ┌───────────────────────────────────────────────┐  │
│  │ Router: Analyzes query, decides routing       │  │
│  │ • Info questions → RAG Agent                  │  │
│  │ • Chart requests → Chart Tool                 │  │
│  │ • Math/code → Direct LLM                      │  │
│  └───────────────────────────────────────────────┘  │
└────────┬─────────────────┬─────────────────┬────────┘
         │                 │                 │
    ┌────▼────┐      ┌─────▼─────┐     ┌────▼────┐
    │   RAG   │      │  Chart.js │     │ Direct  │
    │  Agent  │      │   Tool    │     │   LLM   │
    │         │      │           │     │         │
    │Weaviate │      │  Mock     │     │ Gemini  │
    │ Search  │      │  Config   │     │         │
    └────┬────┘      └─────┬─────┘     └────┬────┘
         │                 │                 │
         └─────────────────┼─────────────────┘
                           ▼
┌─────────────────────────────────────────────────────┐
│                 STREAMING RESPONSE                  │
│  { answer: string, data: ResponseData[] }           │
└─────────────────────────────────────────────────────┘
```

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Agent Framework:** LangGraph
- **LLM:** Google Gemini (gemini-2.5-flash-lite)
- **Embeddings:** Gemini text-embedding-004
- **Vector DB:** Weaviate (Docker)
- **CLI UI:** chalk, ora, cli-table3, boxen

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
echo "GEMINI_API_KEY=your_key_here" > .env

# 3. Start Weaviate
docker compose up -d

# 4. Seed the database
npm run seed

# 5. Run the agent
npm run dev
```

## Features

### RAG Agent
- Semantic search using Gemini embeddings
- Returns answers with source references
- Format: "1- Page 5, 6" (grouped by fileId)
- Falls back to LLM if not found in DB

### Chart Tool
- Returns Chart.js configurations
- Supports: bar, line, pie charts
- Mocked for demonstration

### Delegating Agent
- Intelligent query routing
- Parallel tool execution
- Streaming responses

## Demo Queries

| Query | Route | Result |
|-------|-------|--------|
| "What is the remote work policy?" | RAG | Answer + sources |
| "What is blockchain?" | RAG → LLM | LLM answer (not in DB) |
| "Calculate 25 + 17" | Direct | "42" |
| "Show me a bar chart" | Chart | Chart.js config |
| "Explain sales and show chart" | Both | Answer + chart |

## Project Structure

```
src/
├── agents/
│   ├── delegating.agent.ts  # Main orchestrator
│   ├── rag.agent.ts         # RAG implementation
│   └── types.ts             # Type definitions
├── database/
│   ├── schema.ts            # Weaviate schema
│   ├── seed.ts              # Sample data
│   └── weaviate.client.ts   # DB connection
├── llm/
│   └── gemini.client.ts     # Gemini wrapper
├── tools/
│   ├── chart.tool.ts        # Chart.js tool
│   └── config.json          # Chart templates
├── utils/
│   ├── terminal.ui.ts       # CLI styling
│   └── reference.formatter.ts
└── index.ts                 # Entry point
```

## Response Format

```typescript
interface StreamingResponse {
  answer: string;      // The streamed answer text
  data: ResponseData[]; // RAG references or Chart configs
}

interface RAGReference {
  type: 'rag';
  fileId: string;
  displayId: string;   // "1", "2", "3"...
  pages: string[];
}

interface ChartReference {
  type: 'chart';
  config: ChartJsConfig;
}
```

## Scripts

```bash
npm run dev      # Run with tsx (development)
npm run build    # Compile TypeScript
npm run seed     # Seed the database
npm run test     # Run test suite
```
