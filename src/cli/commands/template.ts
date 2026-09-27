import * as fs from 'fs';
import * as path from 'path';
import { TemplateGenerator } from '../../engine/template-generator';
import { CLIFormatter, CLIOptions, getProjectPath } from '../utils';

export async function templateCommand(args: string[], options: CLIOptions): Promise<void> {
  const workflow = args[0];
  const projectName = args[1] || options.name || 'my-project';
  const outputPath = options.output ? getProjectPath(options.output as string) : process.cwd();

  if (!workflow) {
    CLIFormatter.error('Workflow type is required');
    console.log('Usage: r-best-practices template <workflow> [projectName]');
    console.log('Workflows: r-script, quarto, shiny, package, rmarkdown, renv, targets, plumber, analysis');
    process.exit(1);
  }

  if (!options.quiet) {
    CLIFormatter.info(`Generating ${workflow} template: ${projectName}`);
  }

  try {
    const generator = new TemplateGenerator();
    const template = await generator.generate(workflow, {
      projectName,
      authorName: options.author as string,
      authorEmail: options.email as string,
    });

    const projectDir = path.join(outputPath, projectName);

    if (fs.existsSync(projectDir) && !options.force) {
      CLIFormatter.error(`Directory already exists: ${projectDir}`);
      CLIFormatter.warn('Use --force to overwrite');
      process.exit(1);
    }

    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }

    template.directories.forEach((dir) => {
      const dirPath = path.join(projectDir, dir);
      fs.mkdirSync(dirPath, { recursive: true });
    });

    template.files.forEach((file) => {
      const filePath = path.join(projectDir, file.path);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, file.content);
    });

    if (options.format === 'json') {
      console.log(JSON.stringify({ projectDir, filesCount: template.files.length }, null, 2));
    } else {
      displayTemplateResult(projectDir, template);
    }
  } catch (error) {
    CLIFormatter.error(`Template generation failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

function displayTemplateResult(
  projectDir: string,
  template: {
    files: Array<{ path: string; content: string }>;
    directories: string[];
  },
): void {
  CLIFormatter.header('Template Generated Successfully');

  console.log(`Location:  ${CLIFormatter.colorize(projectDir, 'cyan')}`);
  console.log(`Files:     ${template.files.length}`);
  console.log(`Directories: ${template.directories.length}`);

  CLIFormatter.section('Next Steps');
  console.log(`  cd ${path.basename(projectDir)}`);
  console.log(`  # Edit files as needed`);
  console.log(`  git init`);
  console.log(`  git add .`);
  console.log(`  git commit -m "Initial commit"`);
}
