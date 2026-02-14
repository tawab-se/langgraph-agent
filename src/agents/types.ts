// Type definitions for the agent system

export interface ChartJsConfig {
  type: 'bar' | 'line' | 'pie' | 'doughnut';
  data: {
    labels: string[];
    datasets: {
      label: string;
      data: number[];
      backgroundColor?: string | string[];
      borderColor?: string | string[];
      borderWidth?: number;
    }[];
  };
  options?: {
    scales?: {
      y?: {
        beginAtZero: boolean;
      };
    };
    plugins?: any;
  };
}

export interface ChartReference {
  type: 'chart';
  config: ChartJsConfig;
}

export interface RAGReference {
  type: 'rag';
  fileId: string;
  displayId: string; // "1", "2", "3"...
  pages: string[];
  content?: string;
}

export interface ImageReference {
  type: 'image';
  url: string;
  prompt: string;
  model: string;
}

export type ResponseData = ChartReference | RAGReference | ImageReference;

export interface StreamingResponse {
  answer: string; // Streaming text chunks
  data: ResponseData[]; // All reference objects
}

export interface RAGResult {
  answer: string;
  references: RAGReference[];
}

export interface ToolDecision {
  tools: ('rag' | 'chart' | 'direct' | 'both' | 'image')[];
  reasoning: string;
}

export interface AgentState {
  query: string;
  imageUrl?: string;
  decision?: ToolDecision;
  ragResults?: RAGResult;
  chartConfig?: ChartJsConfig;
  finalAnswer: string;
  data: ResponseData[];
}

export interface WeaviateDocument {
  fileId: string;
  question: string;
  answer: string;
  pageNumber: string[];
}