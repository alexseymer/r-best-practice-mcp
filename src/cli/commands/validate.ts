import { Validator } from '../../engine/validator.js';
import { WorkflowDetector } from '../../engine/detector.js';
import { logger } from '../../utils/logger.js';
import { FileUtils } from '../../utils/file.js';
import type { Workflow } from '../../types/workflow.js';
import type { Severity, Category } from '../../types/finding.js';

interface ValidateOptions {
  workflow?: string;
  severity?: string;
  category?: string;
  limit?: string;
  json?: boolean;
  watch?: boolean;
}

async function validateAndReport(
  path: string,
  workflow: Workflow,
  options: ValidateOptions
): Promise<void> {
  const validator = new Validator();

  logger.info(`Validating project: ${path} (workflow: ${workflow})`);
  const result = await validator.validateProject(path, workflow);

  // Filter by severity if specified
  let findings = result.findings;
  if (options.severity) {
    const severities = options.severity.split(',').map((s) => s.trim());
    findings = findings.filter((f) => severities.includes(f.severity));
  }

  // Filter by category if specified
  if (options.category) {
    const categories = options.category.split(',').map((c) => c.trim());
    findings = findings.filter((f) => categories.includes(f.category));
  }

  // Apply limit if specified
  const limit = parseInt(options.limit || '0', 10);
  if (limit > 0) {
    findings = findings.slice(0, limit);
  }

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          workflow: result.workflow,
          findings,
          total: result.findings.length,
          filtered: findings.length,
          duration: result.duration,
        },
        null,
        2
      )
    );
  } else {
    const severityIcons: Record<Severity, string> = {
      critical: '🔴',
      important: '🟠',
      recommended: '🟡',
      info: '🔵',
    };

    console.log('\n✓ Validation Results');
    console.log('═════════════════════════════');
    console.log(`Path:     ${path}`);
    console.log(`Workflow: ${result.workflow}`);
    console.log(`Duration: ${result.duration}ms`);
    console.log(`\nFindings: ${findings.length} of ${result.findings.length}\n`);

    if (findings.length === 0) {
      console.log('✅ No issues found!');
    } else {
      findings.forEach((finding) => {
        const icon = severityIcons[finding.severity as Severity];
        console.log(`${icon} [${finding.category}] ${finding.message}`);
        if (finding.suggestions && finding.suggestions.length > 0) {
          console.log(`   → ${finding.suggestions[0]}`);
        }
      });
    }
    console.log('');
  }
}

export async function validateCommand(path: string, options: ValidateOptions): Promise<void> {
  const exists = await FileUtils.isDirectory(path);
  if (!exists) {
    logger.error(`Directory not found: ${path}`);
    process.exit(1);
  }

  // Auto-detect workflow if not specified
  let workflow = options.workflow as Workflow;
  if (!workflow) {
    const detector = new WorkflowDetector();
    const detection = await detector.detect(path);
    workflow = detection.workflow;
  }

  if (options.watch) {
    console.log(`👁️  Watching ${path} for changes...`);
    console.log('Press Ctrl+C to stop\n');

    // Simple file watching - check every 1 second
    let lastRun = Date.now();
    const checkInterval = setInterval(async () => {
      try {
        const now = Date.now();
        const stats = await FileUtils.getStats(path);
        if (stats && stats.mtimeMs > lastRun) {
          console.log(`\n📝 Changes detected at ${new Date().toLocaleTimeString()}`);
          await validateAndReport(path, workflow, options);
          lastRun = now;
        }
      } catch (error) {
        logger.error('Watch error', error);
      }
    }, 1000);

    // Handle process termination
    process.on('SIGINT', () => {
      clearInterval(checkInterval);
      console.log('\n\n👋 Watch mode stopped');
      process.exit(0);
    });

    // Initial validation
    await validateAndReport(path, workflow, options);
  } else {
    await validateAndReport(path, workflow, options);
  }
}
