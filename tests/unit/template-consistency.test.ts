import { mkdirSync } from 'fs';
import { join } from 'path';
import { TemplateGenerator } from '../../src/engine/template-generator';
import { WorkflowDetector } from '../../src/engine/detector';
import { Validator } from '../../src/engine/validator';
import { nodeProjectFs } from '../../src/engine/project-fs-node';
import { createTempDir, cleanupTempDir, createFile } from '../fixtures/setup';
import { Workflow } from '../../src/types/workflow';

const WORKFLOWS: Workflow[] = [
  'r-script',
  'quarto',
  'shiny',
  'package',
  'rmarkdown',
  'renv',
  'targets',
  'plumber',
  'analysis',
  'bookdown',
  'blogdown',
  'shinytest',
];

// Findings a template cannot avoid: renv::init() needs R, and a .git directory needs `git init`.
const UNAVOIDABLE: Partial<Record<Workflow, string[]>> = {
  renv: ['renv-init'],
  analysis: ['analysis-versioning'],
};

const R_FILE = /\.(R|r|Rmd|rmd|qmd)$/;

describe('templates follow the project own rules', () => {
  let dir: string;
  beforeEach(() => {
    dir = createTempDir();
  });
  afterEach(() => cleanupTempDir(dir));

  describe.each(WORKFLOWS)('%s', (workflow) => {
    const generate = async () => {
      const template = await new TemplateGenerator().generate(workflow, { projectName: 'demo' });
      for (const d of template.directories) mkdirSync(join(dir, d), { recursive: true });
      for (const file of template.files) createFile(dir, file.path, file.content);
      return template;
    };

    it('contains no escaped dollar signs (invalid R)', async () => {
      const template = await generate();
      const bad = template.files
        .filter((f) => R_FILE.test(f.path) && /\\\$/.test(f.content))
        .map((f) => f.path);
      expect(bad).toEqual([]);
    });

    it('is detected as its own workflow', async () => {
      await generate();
      const result = await new WorkflowDetector(nodeProjectFs).detect(dir);
      expect(result.workflow).toBe(workflow);
    });

    it('passes validation apart from findings no template can avoid', async () => {
      await generate();
      const result = await new Validator(nodeProjectFs).validateProject(dir, workflow, {});
      const unexpected = result.findings
        .map((f) => f.id)
        .filter((id) => !(UNAVOIDABLE[workflow] ?? []).includes(id));
      expect(unexpected).toEqual([]);
    });
  });
});
