import { Validator } from '../../engine/validator.js';
import { FileUtils } from '../../utils/file.js';
import { CLIFormatter, CLIOptions, getProjectPath } from '../utils.js';
import { Finding } from '../../types/finding.js';
import { Workflow } from '../../types/workflow.js';

export async function validateCommand(args: string[], options: CLIOptions): Promise<void> {
  const projectPath = getProjectPath(args[0]);
  const workflow = args[1];

  if (!options.quiet) {
    CLIFormatter.info(`Validating project: ${projectPath}`);
  }

  const exists = await FileUtils.isDirectory(projectPath);
  if (!exists) {
    CLIFormatter.error(`Directory not found: ${projectPath}`);
    process.exit(1);
  }

  try {
    const validator = new Validator();
    const result = await validator.validateProject(projectPath, workflow as Workflow, {
      minSeverity: options.severity as Finding['severity'],
      categories: options.category ? [options.category as string] : undefined,
      maxFindings: options.limit ? (typeof options.limit === 'string' ? parseInt(options.limit) : options.limit) : undefined,
    });

    if (options.format === 'json') {
      console.log(JSON.stringify(result, null, 2));
    } else {
      displayValidationResult(result);
    }

    if (result.findings.length > 0 && !options.quiet) {
      process.exit(1);
    }
  } catch (error) {
    CLIFormatter.error(`Validation failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

function displayValidationResult(result: any): void {
  CLIFormatter.header('Project Validation Result');

  const findings = result.findings as Finding[];
  const warnings = (result.warnings ?? []) as string[];
  warnings.forEach((warning) => CLIFormatter.warn(warning));
  const bySeverity: Record<string, Finding[]> = {
    critical: [],
    important: [],
    recommended: [],
    info: [],
  };

  findings.forEach((finding) => {
    bySeverity[finding.severity] = bySeverity[finding.severity] || [];
    bySeverity[finding.severity].push(finding);
  });

  const severityOrder = ['critical', 'important', 'recommended', 'info'];

  severityOrder.forEach((severity) => {
    const findingsForSeverity = bySeverity[severity];
    if (findingsForSeverity.length === 0) return;

    CLIFormatter.section(`${severity.toUpperCase()} (${findingsForSeverity.length})`);

    findingsForSeverity.slice(0, 10).forEach((finding) => {
      const icon = getSeverityIcon(finding.severity);
      console.log(`${icon} ${finding.message}`);
      if (finding.suggestions && finding.suggestions.length > 0) {
        finding.suggestions.forEach((suggestion) => {
          console.log(`   → ${suggestion}`);
        });
      }
    });


    if (findingsForSeverity.length > 10) {
      CLIFormatter.info(`... and ${findingsForSeverity.length - 10} more`);
    }
  });

  console.log('');
  CLIFormatter.header('Summary');
  console.log(`Total Findings: ${findings.length}${warnings.length > 0 ? ' (no checks ran)' : ''}`);
  console.log(`Duration:      ${result.duration}ms`);
}

function getSeverityIcon(severity: string): string {
  const icons: Record<string, string> = {
    critical: CLIFormatter.colorize('✗', 'red'),
    important: CLIFormatter.colorize('⚠', 'yellow'),
    recommended: CLIFormatter.colorize('ℹ', 'blue'),
    info: CLIFormatter.colorize('◇', 'cyan'),
  };
  return icons[severity] || '•';
}
