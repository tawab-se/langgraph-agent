import { ChartJsConfig } from '../agents/types.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const chartConfigs = require('./config.json').chartConfigs;

/**
 * Chart.js Tool - Returns preconfigured chart configurations
 */
export class ChartTool {
  static generate(type: string = 'bar'): ChartJsConfig {
    return chartConfigs[type] || chartConfigs.bar;
  }

  static async execute(input?: string): Promise<ChartJsConfig> {
    // Detect chart type from input
    const inputLower = input?.toLowerCase() || '';
    
    if (inputLower.includes('pie')) return this.generate('pie');
    if (inputLower.includes('line')) return this.generate('line');
    return this.generate('bar');
  }
}

export const chartTool = ChartTool;
