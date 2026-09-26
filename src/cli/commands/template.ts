import { TemplateGenerator } from '../../engine/template-generator.js';
import { FileUtils } from '../../utils/file.js';
import { logger } from '../../utils/logger.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { Workflow } from '../../types/workflow.js';

interface TemplateOptions {
  name?: string;
  author?: string;
  email?: string;
  output?: string;
}

export async function templateCommand(workflow: string, options: TemplateOptions): Promise<void> {
  const generator = new TemplateGenerator();
  const projectName = options.name || 'my-project';
  const outputDir = options.output || projectName;

  logger.info(`Generating template for ${workflow}: ${projectName}`);

  try {
    const template = await generator.generate(workflow as Workflow, {
      projectName,
      authorName: options.author,
      authorEmail: options.email,
    });

    // Create output directory
    const fullOutputPath = path.resolve(outputDir);
    await FileUtils.createDirectory(fullOutputPath);

    // Create directory structure
    for (const dir of template.directories) {
      const dirPath = path.join(fullOutputPath, dir);
      await FileUtils.createDirectory(dirPath);
    }

    // Write files
    let fileCount = 0;
    for (const file of template.files) {
      const filePath = path.join(fullOutputPath, file.path);
      const fileDir = path.dirname(filePath);

      // Ensure parent directory exists
      await FileUtils.createDirectory(fileDir);

      // Write file
      await fs.writeFile(filePath, file.content, 'utf-8');
      fileCount++;
    }

    console.log('\n🎯 Template Generated Successfully');
    console.log('═════════════════════════════════════');
    console.log(`Workflow:    ${template.workflow}`);
    console.log(`Output:      ${fullOutputPath}`);
    console.log(`Files:       ${fileCount}`);
    console.log(`Directories: ${template.directories.length}`);
    console.log('\n📂 Project structure created. Next steps:');
    console.log(`  cd ${projectName}`);
    if (template.workflow === 'package') {
      console.log('  devtools::load_all()  # Load package');
      console.log('  devtools::test()      # Run tests');
    } else if (template.workflow === 'shiny') {
      console.log('  shiny::runApp()       # Run Shiny app');
    } else if (template.workflow === 'quarto') {
      console.log('  quarto render [file]  # Render document');
    }
    console.log('');
  } catch (error) {
    logger.error(`Error generating template: ${error}`);
    process.exit(1);
  }
}
