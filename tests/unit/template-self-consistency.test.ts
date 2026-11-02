import { TemplateGenerator } from '../../src/engine/template-generator';
import { createMemoryProjectFs } from '../../src/engine/project-fs';
import { Validator } from '../../src/engine/validator';
import { Workflow } from '../../src/types/workflow';

/**
 * A generated starter project should follow the practices it teaches. Critical and important findings
 * fail the test, except the entries below, each with the reason it is expected.
 */
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

/** Finding ids allowed in a generated template, per workflow, with the reason. */
const EXPECTED: Record<string, Record<string, string>> = {
  renv: {
    'renv-init': 'The template cannot run renv::init(); the README gives that step.',
  },
  analysis: {
    'analysis-versioning': 'A template cannot ship a .git directory; `git init` is the first step.',
  },
};

async function generated(workflow: Workflow) {
  const template = await new TemplateGenerator().generate(workflow, {
    projectName: 'demo',
    authorName: 'Jane Doe',
    authorEmail: 'jane@example.org',
  });
  const files = Object.fromEntries(template.files.map((f) => [`/project/${f.path}`, f.content]));
  return { template, fsys: createMemoryProjectFs(files) };
}

describe('generated templates follow their own practices', () => {
  for (const workflow of WORKFLOWS) {
    it(`${workflow}: no unexpected critical or important findings`, async () => {
      const { fsys } = await generated(workflow);
      const result = await new Validator(fsys).validateProject('/project', workflow);
      const unexpected = result.findings
        .filter((f) => f.severity === 'critical' || f.severity === 'important')
        .filter((f) => !EXPECTED[workflow]?.[f.id])
        .map((f) => `${f.id}: ${f.message}`);
      expect(unexpected).toEqual([]);
    });
  }

  it('every startup file sources only files the template ships', async () => {
    for (const workflow of WORKFLOWS) {
      const { template } = await generated(workflow);
      const shipped = new Set(template.files.map((f) => f.path));
      for (const file of template.files.filter(
        (f) => f.path === '.Rprofile' || f.path.endsWith('/.Rprofile')
      )) {
        for (const line of file.content.split('\n')) {
          if (/file\.exists/.test(line)) continue; // guarded lines may refer to files that appear later
          for (const match of line.matchAll(/source\("([^"]+)"\)/g)) {
            expect({ workflow, sourced: match[1], present: shipped.has(match[1]) }).toEqual({
              workflow,
              sourced: match[1],
              present: true,
            });
          }
        }
      }
    }
  });
});
