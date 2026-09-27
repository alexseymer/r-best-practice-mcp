import { WorkflowDetector } from '../../engine/detector';
import { FileUtils } from '../../utils/file';
import { CLIFormatter, CLIOptions, getProjectPath } from '../utils';

export async function detectCommand(args: string[], options: CLIOptions): Promise<void> {
  const projectPath = getProjectPath(args[0]);

  if (!options.quiet) {
    CLIFormatter.info(`Detecting workflow for: ${projectPath}`);
  }

  const exists = await FileUtils.isDirectory(projectPath);
  if (!exists) {
    CLIFormatter.error(`Directory not found: ${projectPath}`);
    process.exit(1);
  }

  try {
    const detector = new WorkflowDetector();
    const result = await detector.detect(projectPath);

    if (options.format === 'json') {
      console.log(JSON.stringify(result, null, 2));
    } else {
      displayDetectionResult(result);
    }
  } catch (error) {
    CLIFormatter.error(`Detection failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

function displayDetectionResult(result: {
  workflow: string;
  confidence: number;
  indicators: string[];
}): void {
  CLIFormatter.header('Workflow Detection Result');

  console.log(`Workflow:   ${CLIFormatter.colorize(result.workflow, 'cyan')}`);
  console.log(`Confidence: ${getConfidenceBar(result.confidence)} ${result.confidence}%`);

  if (result.indicators.length > 0) {
    CLIFormatter.section('Detected Indicators');
    result.indicators.forEach((indicator) => {
      console.log(`  • ${indicator}`);
    });
  }
}

function getConfidenceBar(confidence: number): string {
  const filled = Math.round(confidence / 10);
  const empty = 10 - filled;
  const bar = CLIFormatter.colorize('█'.repeat(filled), 'green') + '░'.repeat(empty);
  return `[${bar}]`;
}
