/**
 * Best practices as MCP resources: one resource per practice (practice://<id>) and an index of all
 * of them (practices://all). Clients can read them without calling a tool.
 */
import type { Resource } from '@modelcontextprotocol/sdk/types.js';
import { kb } from './data/knowledge-base.js';
import type { Practice } from './types/practice.js';

const INDEX_URI = 'practices://all';
const PRACTICE_PREFIX = 'practice://';

export function listResources(): Resource[] {
  const index: Resource = {
    uri: INDEX_URI,
    name: 'All best practices',
    description: 'Index of every practice, grouped by project type',
    mimeType: 'text/markdown',
  };

  const practices = kb.listPractices({}).practices.map((p): Resource => ({
    uri: `${PRACTICE_PREFIX}${p.id}`,
    name: p.title,
    description: `${p.workflow} · ${p.severity} · ${p.enforcement}`,
    mimeType: 'text/markdown',
  }));

  return [index, ...practices];
}

export function readResource(uri: string): string | undefined {
  if (uri === INDEX_URI) return indexMarkdown();
  if (uri.startsWith(PRACTICE_PREFIX)) {
    const practice = kb.getPractice(uri.slice(PRACTICE_PREFIX.length));
    return practice ? practiceMarkdown(practice) : undefined;
  }
  return undefined;
}

function indexMarkdown(): string {
  const practices = kb.listPractices({}).practices;
  const byWorkflow = new Map<string, Practice[]>();
  for (const p of practices) {
    byWorkflow.set(p.workflow, [...(byWorkflow.get(p.workflow) ?? []), p]);
  }

  const sections = [...byWorkflow.entries()].map(([workflow, list]) =>
    [`## ${workflow}`, ...list.map((p) => `- \`${p.id}\` (${p.severity}): ${p.title}`)].join('\n')
  );
  return ['# R best practices', '', ...sections].join('\n\n') + '\n';
}

export function practiceMarkdown(p: Practice): string {
  const lines = [
    `# ${p.title}`,
    '',
    `- id: \`${p.id}\``,
    `- project type: ${p.workflow}`,
    `- category: ${p.category}`,
    `- severity: ${p.severity}`,
    `- enforcement: ${p.enforcement === 'automated' ? 'checked automatically' : 'guidance only'}`,
    '',
    p.description,
  ];
  if (p.details) lines.push('', '## Why and what is checked', '', p.details);
  if (p.goodExample) lines.push('', '## Good example', '', '```', p.goodExample, '```');
  if (p.badExample) lines.push('', '## Bad example', '', '```', p.badExample, '```');
  if (p.references?.length) {
    lines.push('', '## References', '', ...p.references.map((r) => `- ${r}`));
  }
  return lines.join('\n') + '\n';
}
