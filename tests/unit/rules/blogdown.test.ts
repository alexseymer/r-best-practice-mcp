import { createTempDir, cleanupTempDir, createFile, createDir } from '../../fixtures/setup';
import { findingsFor, idsFor } from '../../fixtures/rules';

const POST = '---\ntitle: Hello\ndate: 2024-01-01\n---\n\nBody\n';

describe('blogdown rules', () => {
  let dir: string;
  beforeEach(() => {
    dir = createTempDir();
  });
  afterEach(() => cleanupTempDir(dir));

  describe('blogdown-metadata', () => {
    it('reports posts without front matter', async () => {
      createFile(dir, 'content/post/a.md', '# No front matter\n');
      createFile(dir, 'content/post/b.md', POST);
      const finding = (await findingsFor(dir, 'blogdown')).find(
        (f) => f.id === 'blogdown-metadata'
      );
      expect(finding).toBeDefined();
      expect(finding!.severity).toBe('important');
      expect(finding!.category).toBe('documentation');
      expect(finding!.message.length).toBeGreaterThan(0);
      expect(finding!.suggestions!.length).toBeGreaterThan(0);
      expect(finding!.details).toContain('a.md');
      expect(finding!.details).not.toContain('b.md');
    });

    it.each(['post/x.Rmd', 'post/x.Rmarkdown', '_index.md'])('checks %s too', async (name) => {
      createFile(dir, `content/${name}`, 'Just text\n');
      expect(await idsFor(dir, 'blogdown')).toContain('blogdown-metadata');
    });

    it.each([
      ['yaml', '---\ntitle: A\n---\nbody'],
      ['toml', '+++\ntitle = "A"\n+++\nbody'],
      ['json', '{\n"title": "A"\n}\nbody'],
      ['crlf', '---\r\ntitle: A\r\n---\r\nbody'],
      ['bom', '﻿---\ntitle: A\n---\nbody'],
    ])('accepts %s front matter', async (_label, content) => {
      createFile(dir, 'content/post/a.md', content);
      expect(await idsFor(dir, 'blogdown')).not.toContain('blogdown-metadata');
    });

    it('is silent for empty files and non-post files', async () => {
      createFile(dir, 'content/post/empty.md', '');
      createFile(dir, 'content/data.csv', 'a,b\n');
      expect(await idsFor(dir, 'blogdown')).not.toContain('blogdown-metadata');
    });

    it('is silent without a content directory', async () => {
      expect(await idsFor(dir, 'blogdown')).not.toContain('blogdown-metadata');
    });

    it('lists at most 5 files', async () => {
      for (let i = 0; i < 8; i++) createFile(dir, `content/post/p${i}.md`, 'x\n');
      const finding = (await findingsFor(dir, 'blogdown')).find(
        (f) => f.id === 'blogdown-metadata'
      );
      expect(finding!.details!.match(/\.md/g)).toHaveLength(5);
    });
  });

  describe('blogdown-deployment', () => {
    it('reports a site without deployment configuration', async () => {
      createFile(dir, 'config.toml', 'baseURL = "/"\n');
      const finding = (await findingsFor(dir, 'blogdown')).find(
        (f) => f.id === 'blogdown-deployment'
      );
      expect(finding).toBeDefined();
      expect(finding!.severity).toBe('recommended');
      expect(finding!.category).toBe('structure');
      expect(finding!.message.length).toBeGreaterThan(0);
      expect(finding!.suggestions!.length).toBeGreaterThan(0);
    });

    it.each([
      'netlify.toml',
      'vercel.json',
      'render.yaml',
      '.gitlab-ci.yml',
      '.netlify/state.json',
      '.github/workflows/deploy.yml',
    ])('is satisfied by %s', async (name) => {
      createFile(dir, name, 'x\n');
      expect(await idsFor(dir, 'blogdown')).not.toContain('blogdown-deployment');
    });

    it('is not satisfied by an empty .github/workflows directory', async () => {
      createDir(dir, '.github/workflows');
      expect(await idsFor(dir, 'blogdown')).toContain('blogdown-deployment');
    });
  });
});
