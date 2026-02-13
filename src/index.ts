import { delegatingAgent } from './agents/delegating.agent.js';
import { closeWeaviateClient } from './database/weaviate.client.js';
import readline from 'readline';
import {
  printHeader,
  printInstructions,
  printSeparator,
  printRAGResults,
  printChartConfig,
  printError,
  printCompletionTime,
  colors,
} from './utils/terminal.ui.js';

/**
 * Process a single query
 */
async function processQuery(query: string): Promise<void> {
  const startTime = Date.now();

  try {
    let lastResponse;

    for await (const chunk of delegatingAgent.processQuery(query)) {
      if (chunk.answer) {
        process.stdout.write(colors.info(chunk.answer));
      }
      lastResponse = chunk;
    }

    console.log(); // New line after streaming
    printSeparator('─');

    // Display data references
    if (lastResponse?.data && lastResponse.data.length > 0) {
      const ragRefs = lastResponse.data.filter(d => d.type === 'rag');
      const chartRefs = lastResponse.data.filter(d => d.type === 'chart');

      if (ragRefs.length > 0) {
        printRAGResults(ragRefs);
      }

      if (chartRefs.length > 0) {
        chartRefs.forEach(item => printChartConfig(item.config));
      }
    }

    printCompletionTime(startTime);

  } catch (error) {
    printError('Query processing failed', error instanceof Error ? error : undefined);
  }
}

/**
 * Show prompt
 */
function showPrompt(rl: readline.Interface): void {
  rl.setPrompt(colors.bold('\n🎤 Your query: '));
  rl.prompt();
}

/**
 * Main entry point for the LangGraph Agent System
 */
async function main() {
  printHeader();
  printInstructions();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Handle each line of input
  rl.on('line', async (query: string) => {
    if (!query.trim()) {
      showPrompt(rl);
      return;
    }

    if (query.toLowerCase() === 'exit') {
      console.log(colors.success('\n👋 Goodbye!\n'));
      rl.close();
      await closeWeaviateClient();
      process.exit(0);
    }

    // Pause readline while processing
    rl.pause();
    
    await processQuery(query);
    
    // Resume and show prompt for next query
    rl.resume();
    showPrompt(rl);
  });

  // Handle readline close (Ctrl+D)
  rl.on('close', async () => {
    console.log(colors.success('\n\n👋 Goodbye!\n'));
    await closeWeaviateClient();
    process.exit(0);
  });

  // Show initial prompt
  showPrompt(rl);
}

// Handle graceful shutdown (Ctrl+C)
process.on('SIGINT', async () => {
  console.log(colors.success('\n\n👋 Shutting down...'));
  await closeWeaviateClient();
  process.exit(0);
});

// Run main
main().catch(async (error) => {
  printError('Fatal error', error instanceof Error ? error : undefined);
  await closeWeaviateClient();
  process.exit(1);
});
