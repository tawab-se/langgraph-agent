import chalk from 'chalk';
import ora, { Ora } from 'ora';
import Table from 'cli-table3';
import boxen from 'boxen';
import { RAGReference, ChartJsConfig } from '../agents/types.js';

// Color scheme
export const colors = {
  delegating: chalk.cyan,
  rag: chalk.blue,
  chart: chalk.magenta,
  system: chalk.gray,
  success: chalk.green,
  processing: chalk.yellow,
  error: chalk.red,
  info: chalk.white,
  bold: chalk.bold,
  dim: chalk.dim,
};

export function printHeader(): void {
  const header = boxen(
    chalk.bold.cyan('🤖 LangGraph Agent System\n') +
    chalk.dim('   Weaviate RAG • Chart.js • Gemini'),
    {
      padding: 1,
      margin: 1,
      borderStyle: 'double',
      borderColor: 'cyan',
    }
  );
  console.log(header);
}

export function printInstructions(): void {
  console.log(colors.dim('Type your query and press Enter. Type "exit" to quit.\n'));
}

export function createSpinner(text: string): Ora {
  return ora({ text, color: 'cyan', spinner: 'dots' });
}

export function printRouting(from: string, to: string, reasoning?: string): void {
  console.log(colors.success('✓ ') + colors.delegating(from) + ' → ' + colors.rag(to));
  if (reasoning) {
    console.log(colors.dim(`  ${reasoning}`));
  }
}

export function printRAGResults(references: RAGReference[]): void {
  if (references.length === 0) return;

  const table = new Table({
    head: [colors.bold('ID'), colors.bold('File'), colors.bold('Pages')],
    style: { head: [], border: ['gray'] },
  });

  references.forEach(ref => {
    table.push([
      colors.success(ref.displayId),
      colors.info(ref.fileId),
      colors.dim(ref.pages.join(', ')),
    ]);
  });

  console.log(colors.bold('\n📚 Sources:'));
  console.log(table.toString());
}

export function printChartConfig(config: ChartJsConfig): void {
  console.log(colors.bold('\n📊 Chart:'));
  console.log(colors.chart(`  Type: ${config.type}`));
  console.log(colors.dim(`  Labels: ${config.data.labels.join(', ')}`));
}

export function printSuccess(message: string): void {
  console.log(colors.success('✓ ' + message));
}

export function printError(message: string, error?: Error): void {
  const text = error ? `${message}\n${colors.dim(error.message)}` : message;
  console.log(boxen(text, {
    padding: 1,
    borderStyle: 'round',
    borderColor: 'red',
    title: '❌ Error',
  }));
}

export function printSeparator(char: string = '─', length: number = 60): void {
  console.log(colors.dim(char.repeat(length)));
}

export function printTestHeader(testNumber: number, total: number, name: string): void {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(colors.bold.cyan(`Test ${testNumber}/${total}: ${name}`));
  console.log('═'.repeat(60));
}

export function printTestResult(passed: boolean, message: string): void {
  if (passed) {
    console.log(colors.success(`✅ ${message}`));
  } else {
    console.log(colors.error(`❌ ${message}`));
  }
}

export function formatTime(ms: number): string {
  return ms < 1000 ? `${ms.toFixed(0)}ms` : `${(ms / 1000).toFixed(1)}s`;
}

export function printCompletionTime(startTime: number): void {
  console.log(colors.dim(`⏱️  ${formatTime(Date.now() - startTime)}`));
}
