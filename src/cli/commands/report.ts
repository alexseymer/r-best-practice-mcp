import { Validator } from '../../engine/validator.js';
import { WorkflowDetector } from '../../engine/detector.js';
import { logger } from '../../utils/logger.js';
import { FileUtils } from '../../utils/file.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { Workflow } from '../../types/workflow.js';
import type { Severity } from '../../types/finding.js';

interface ReportOptions {
  workflow?: string;
  output?: string;
}

function generateHTML(
  projectPath: string,
  workflow: Workflow,
  findings: any[],
  duration: number
): string {
  const severityColors: Record<Severity, string> = {
    critical: '#dc2626',
    important: '#ea580c',
    recommended: '#eab308',
    info: '#2563eb',
  };

  const severityBackgrounds: Record<Severity, string> = {
    critical: '#fee2e2',
    important: '#ffedd5',
    recommended: '#fef3c7',
    info: '#dbeafe',
  };

  const countBySeverity = findings.reduce(
    (acc, f) => {
      acc[f.severity] = (acc[f.severity] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const findingsHTML = findings
    .map(
      (finding) => `
    <div style="margin-bottom: 20px; padding: 15px; background-color: ${severityBackgrounds[finding.severity as Severity]}; border-left: 4px solid ${severityColors[finding.severity as Severity]}; border-radius: 4px;">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
        <span style="font-weight: 600; color: ${severityColors[finding.severity as Severity]};">${finding.severity.toUpperCase()}</span>
        <span style="background-color: #e5e7eb; padding: 2px 8px; border-radius: 3px; font-size: 12px;">${finding.category}</span>
      </div>
      <p style="margin: 0; font-size: 14px; font-weight: 500; color: #1f2937;">${finding.message}</p>
      ${finding.suggestions && finding.suggestions.length > 0 ? `<p style="margin: 8px 0 0 0; font-size: 13px; color: #4b5563;">💡 ${finding.suggestions[0]}</p>` : ''}
      ${finding.file ? `<p style="margin: 8px 0 0 0; font-size: 12px; color: #6b7280;">📄 ${finding.file}</p>` : ''}
    </div>
  `
    )
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>R Best Practices - Validation Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f9fafb; }
    .container { max-width: 900px; margin: 0 auto; padding: 40px 20px; }
    header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; border-radius: 8px; margin-bottom: 30px; }
    header h1 { font-size: 32px; margin-bottom: 10px; }
    header p { opacity: 0.9; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
    .summary-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .summary-card h3 { font-size: 14px; color: #6b7280; margin-bottom: 10px; text-transform: uppercase; }
    .summary-card .value { font-size: 28px; font-weight: 700; }
    .summary-card.critical .value { color: #dc2626; }
    .summary-card.important .value { color: #ea580c; }
    .summary-card.recommended .value { color: #eab308; }
    .summary-card.info .value { color: #2563eb; }
    .findings-section { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .findings-section h2 { font-size: 20px; margin-bottom: 20px; }
    .empty-state { text-align: center; padding: 40px; color: #6b7280; }
    .empty-state h3 { font-size: 18px; margin-bottom: 10px; }
    .metadata { font-size: 12px; color: #9ca3af; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>R Best Practices Validation Report</h1>
      <p>Comprehensive analysis of your R project</p>
    </header>

    <div class="summary">
      <div class="summary-card">
        <h3>Total Findings</h3>
        <div class="value">${findings.length}</div>
      </div>
      ${
        countBySeverity['critical']
          ? `<div class="summary-card critical"><h3>Critical</h3><div class="value">${countBySeverity['critical']}</div></div>`
          : ''
      }
      ${
        countBySeverity['important']
          ? `<div class="summary-card important"><h3>Important</h3><div class="value">${countBySeverity['important']}</div></div>`
          : ''
      }
      ${
        countBySeverity['recommended']
          ? `<div class="summary-card recommended"><h3>Recommended</h3><div class="value">${countBySeverity['recommended']}</div></div>`
          : ''
      }
      ${
        countBySeverity['info']
          ? `<div class="summary-card info"><h3>Info</h3><div class="value">${countBySeverity['info']}</div></div>`
          : ''
      }
    </div>

    <div class="findings-section">
      <h2>Findings</h2>
      ${
        findings.length === 0
          ? '<div class="empty-state"><h3>✅ All Clear!</h3><p>No issues found in this project</p></div>'
          : findingsHTML
      }
    </div>

    <div class="metadata">
      <strong>Report Details</strong><br>
      Project: ${projectPath}<br>
      Workflow: ${workflow}<br>
      Validation Time: ${duration}ms<br>
      Generated: ${new Date().toLocaleString()}
    </div>
  </div>
</body>
</html>
  `;
}

export async function reportCommand(path: string, options: ReportOptions): Promise<void> {
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

  logger.info(`Generating report for: ${path} (workflow: ${workflow})`);

  // Validate project
  const validator = new Validator();
  const result = await validator.validateProject(path, workflow);

  // Generate HTML
  const html = generateHTML(path, workflow, result.findings, result.duration);

  // Determine output file path
  const outputFile = options.output || `r-practices-report-${Date.now()}.html`;

  // Write HTML file
  await fs.writeFile(outputFile, html, 'utf-8');

  console.log('\n📊 Report Generated Successfully');
  console.log('═════════════════════════════════');
  console.log(`Output:   ${outputFile}`);
  console.log(`Findings: ${result.findings.length}`);
  console.log(`Duration: ${result.duration}ms`);
  console.log('\n✅ Open the HTML file in a browser to view the report\n');
}
