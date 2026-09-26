import { WorkflowDetector } from '../../engine/detector.js';
import { logger } from '../../utils/logger.js';

interface DetectOptions {
  json?: boolean;
}

export async function detectCommand(path: string, options: DetectOptions): Promise<void> {
  const detector = new WorkflowDetector();

  logger.info(`Detecting workflow for: ${path}`);
  const result = await detector.detect(path);

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('\n📦 Workflow Detection Results');
    console.log('═════════════════════════════');
    console.log(`Path:       ${path}`);
    console.log(`Workflow:   ${result.workflow}`);
    console.log(`Confidence: ${result.confidence}%`);
    console.log(`\nIndicators detected:`);
    result.indicators.forEach((indicator) => {
      console.log(`  ✓ ${indicator}`);
    });
    console.log('');
  }
}
