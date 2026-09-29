import * as fs from 'fs';
import * as path from 'path';
import { Validator } from '../../engine/validator.js';
import { WorkflowDetector } from '../../engine/detector.js';
import { FileUtils } from '../../utils/file.js';
import { CLIFormatter, CLIOptions, getProjectPath } from '../utils.js';

export async function reportCommand(args: string[], options: CLIOptions): Promise<void> {
  const projectPath = getProjectPath(args[0]);
  const outputPath = options.output ? getProjectPath(options.output as string) : projectPath;

  if (!options.quiet) {
    CLIFormatter.info(`Generating report for: ${projectPath}`);
  }

  const exists = await FileUtils.isDirectory(projectPath);
  if (!exists) {
    CLIFormatter.error(`Directory not found: ${projectPath}`);
    process.exit(1);
  }

  try {
    const detector = new WorkflowDetector();
    const validation = new Validator();

    const detectionResult = await detector.detect(projectPath);
    const validationResult = await validation.validateProject(projectPath, detectionResult.workflow);

    const html = generateHTMLReport(
      projectPath,
      detectionResult,
      validationResult,
    );

    const reportPath = path.join(outputPath, 'validation-report.html');
    fs.writeFileSync(reportPath, html);

    if (options.format === 'json') {
      console.log(JSON.stringify({ reportPath, findings: validationResult.findings.length }, null, 2));
    } else {
      CLIFormatter.success(`Report generated: ${reportPath}`);
      if (!options.quiet) {
        CLIFormatter.info('Open in browser to view interactive report');
      }
    }
  } catch (error) {
    CLIFormatter.error(`Report generation failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

function generateHTMLReport(
  projectPath: string,
  detection: any,
  validation: any,
): string {
  const findings = validation.data.findings;
  const bySeverity: Record<string, any[]> = {
    critical: [],
    important: [],
    recommended: [],
    info: [],
  };

  findings.forEach((finding: any) => {
    bySeverity[finding.severity] = bySeverity[finding.severity] || [];
    bySeverity[finding.severity].push(finding);
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>R Best Practices Validation Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
    }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px 20px;
      margin: -20px -20px 40px -20px;
      text-align: center;
    }
    header h1 { font-size: 2em; margin-bottom: 10px; }
    .metadata {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }
    .card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .card h3 { font-size: 0.9em; color: #666; text-transform: uppercase; margin-bottom: 10px; }
    .card p { font-size: 1.4em; font-weight: bold; color: #667eea; }
    .findings-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
      margin-top: 20px;
    }
    .finding-count {
      padding: 15px;
      border-radius: 8px;
      text-align: center;
      color: white;
      font-weight: bold;
    }
    .critical { background: #ef5350; }
    .important { background: #ffa726; }
    .recommended { background: #42a5f5; }
    .info { background: #66bb6a; }
    .findings-section {
      margin-top: 40px;
    }
    .findings-section h2 {
      padding-bottom: 10px;
      border-bottom: 2px solid #667eea;
      margin-bottom: 20px;
    }
    .finding {
      background: white;
      padding: 20px;
      margin-bottom: 15px;
      border-radius: 8px;
      border-left: 4px solid #667eea;
    }
    .finding.critical { border-left-color: #ef5350; }
    .finding.important { border-left-color: #ffa726; }
    .finding.recommended { border-left-color: #42a5f5; }
    .finding.info { border-left-color: #66bb6a; }
    .finding-title {
      font-weight: bold;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 0.8em;
      font-weight: bold;
      color: white;
    }
    .badge.critical { background: #ef5350; }
    .badge.important { background: #ffa726; }
    .badge.recommended { background: #42a5f5; }
    .badge.info { background: #66bb6a; }
    .suggestions {
      margin-top: 10px;
      padding-left: 20px;
    }
    .suggestions li {
      list-style: none;
      margin-bottom: 8px;
      padding-left: 20px;
      position: relative;
    }
    .suggestions li:before {
      content: "→";
      position: absolute;
      left: 0;
      color: #667eea;
    }
    footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
      text-align: center;
      color: #666;
      font-size: 0.9em;
    }
  </style>
</head>
<body>
  <header>
    <h1>R Best Practices Validation Report</h1>
    <p>${projectPath}</p>
  </header>
  
  <div class="container">
    <div class="metadata">
      <div class="card">
        <h3>Workflow Type</h3>
        <p>${detection.workflow}</p>
      </div>
      <div class="card">
        <h3>Confidence</h3>
        <p>${detection.confidence}%</p>
      </div>
      <div class="card">
        <h3>Total Findings</h3>
        <p>${findings.length}</p>
      </div>
      <div class="card">
        <h3>Analysis Duration</h3>
        <p>${validation.data.duration}ms</p>
      </div>
    </div>
    
    <div class="findings-grid">
      <div class="finding-count critical">Critical: ${bySeverity.critical.length}</div>
      <div class="finding-count important">Important: ${bySeverity.important.length}</div>
      <div class="finding-count recommended">Recommended: ${bySeverity.recommended.length}</div>
      <div class="finding-count info">Info: ${bySeverity.info.length}</div>
    </div>
    
    ${['critical', 'important', 'recommended', 'info']
      .filter((severity) => bySeverity[severity].length > 0)
      .map(
        (severity) => `
    <div class="findings-section">
      <h2>${severity.toUpperCase()} (${bySeverity[severity].length})</h2>
      ${bySeverity[severity]
        .map(
          (finding) => `
      <div class="finding ${severity}">
        <div class="finding-title">
          <span>${finding.message}</span>
          <span class="badge ${severity}">${finding.category}</span>
        </div>
        ${
          finding.suggestions && finding.suggestions.length > 0
            ? `<ul class="suggestions">${finding.suggestions
                .map((s: string) => `<li>${s}</li>`)
                .join('')}</ul>`
            : ''
        }
      </div>
      `,
        )
        .join('')}
    </div>
    `,
      )
      .join('')}
    
    <footer>
      <p>Generated by R Best Practices MCP Server</p>
      <p>${new Date().toISOString()}</p>
    </footer>
  </div>
</body>
</html>`;
}
