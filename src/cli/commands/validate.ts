import { Validator } from '../../engine/validator';
import { FileUtils } from '../../utils/file';
import { CLIFormatter, CLIOptions, getProjectPath } from '../utils';
import { Finding } from '../../types/finding';

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
    const result = await validator.validateProject(projectPath, workflow, {
      severity: options.severity,
      category: options.category,
      limit: options.limit ? parseInt(options.limit as string) : undefined,
    });

    if (options.format === 'json') {
      console.log(JSON.stringify(result, null, 2));
    } else {
      displayValidationResult(result);
    }

    if (result.data.findings.length > 0 && !options.quiet) {
      process.exit(1);
    }
  } catch (error) {
    CLIFormatter.error(`Validation failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

function displayValidationResult(result: any): void {
  CLIFormatter.header('Project Validation Result');

  const findings = result.data.findings as Finding[];
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
  let totalDisplayed = 0;

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

    totalDisplayed += findingsForSeverity.length;

    if (findingsForSeverity.length > 10) {
      CLIFormatter.info(`... and ${findingsForSeverity.length - 10} more`);
    }
  });

  console.log('');
  CLIFormatter.header('Summary');
  console.log(`Total Findings: ${findings.length}`);
  console.log(`Duration:      ${result.data.duration}ms`);
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
