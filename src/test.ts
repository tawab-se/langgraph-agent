import { delegatingAgent } from './agents/delegating.agent.js';
import { closeWeaviateClient } from './database/weaviate.client.js';
import {
  printTestHeader,
  printTestResult,
  printCompletionTime,
  colors,
  printSeparator,
} from './utils/terminal.ui.js';

/**
 * Test file to validate all scenarios
 */
async function runTests() {
  console.log();
  console.log(colors.bold.cyan('╔════════════════════════════════════════════════════════════╗'));
  console.log(colors.bold.cyan('║            LangGraph Agent System - Test Suite           ║'));
  console.log(colors.bold.cyan('╚════════════════════════════════════════════════════════════╝'));
  console.log();

  const testQueries = [
    {
      name: 'RAG Query',
      query: 'What is the capital of France?',
      expectedTools: ['rag'],
    },
    {
      name: 'Chart Query',
      query: 'Show me a bar chart of monthly sales',
      expectedTools: ['chart'],
    },
    {
      name: 'Combined Query',
      query: 'Explain quantum computing and show me a visualization',
      expectedTools: ['both'],
    },
    {
      name: 'Direct Answer',
      query: 'What is 2 plus 2?',
      expectedTools: ['direct'],
    },
  ];

  for (let i = 0; i < testQueries.length; i++) {
    const test = testQueries[i];
    const startTime = Date.now();
    
    printTestHeader(i + 1, testQueries.length, test.name);
    console.log(colors.info(`Query: "${test.query}"`));
    console.log(colors.dim(`Expected: ${test.expectedTools.join(', ')}`));
    printSeparator('═', 70);

    try {
      const result = await delegatingAgent.processQuerySync(test.query);
      
      console.log();
      console.log(colors.success('✅ Result:'));
      console.log(colors.info(`Answer: ${result.answer.substring(0, 200)}${result.answer.length > 200 ? '...' : ''}`));
      console.log(colors.dim(`\nData items: ${result.data.length}`));
      
      for (const item of result.data) {
        if (item.type === 'rag') {
          console.log(colors.rag(`  • RAG Reference: File ${item.fileId}, Pages: ${item.pages.join(', ')}`));
        } else if (item.type === 'chart') {
          console.log(colors.chart(`  • Chart: ${item.config.type} chart with ${item.config.data.labels.length} labels`));
        }
      }

      // Validate
      const hasRAG = result.data.some(d => d.type === 'rag');
      const hasChart = result.data.some(d => d.type === 'chart');
      
      let passed = false;
      if (test.expectedTools.includes('rag') && hasRAG) passed = true;
      if (test.expectedTools.includes('chart') && hasChart) passed = true;
      if (test.expectedTools.includes('both') && hasRAG && hasChart) passed = true;
      if (test.expectedTools.includes('direct') && result.answer) passed = true;

      printTestResult(passed, passed ? 'Test passed' : 'Check results manually');
      printCompletionTime(startTime);

    } catch (error) {
      console.log();
      printTestResult(false, `Error: ${error}`);
    }

    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log();
  printSeparator('═', 70);
  console.log(colors.bold.green('🎉 Test suite completed!'));
  printSeparator('═', 70);
  console.log();
}

// Run tests
runTests()
  .then(async () => {
    await closeWeaviateClient();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Test suite failed:', error);
    await closeWeaviateClient();
    process.exit(1);
  });
