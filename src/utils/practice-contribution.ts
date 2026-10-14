import ts from 'typescript';
import { CATEGORIES, SEVERITIES } from '../types/finding.js';
import { ENFORCEMENTS } from '../types/practice.js';

/**
 * Checks a practice data file contributed by the community. A practice file must be pure data: one
 * `export const x: Practice[] = [ {...}, ... ]` whose values are string literals or arrays of them.
 * Anything that could run code (calls, imports of values, spreads, computed keys, template
 * substitutions) is rejected, so merging a practice can never execute code on the server.
 */

/** The workflows a practice can target (Workflow minus 'unknown'). */
export const PRACTICE_WORKFLOWS = [
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
] as const;

const ALLOWED_STRING_KEYS = [
  'id',
  'title',
  'workflow',
  'category',
  'severity',
  'enforcement',
  'description',
  'details',
  'badExample',
  'goodExample',
] as const;
const ALLOWED_ARRAY_KEYS = ['tags', 'references'] as const;
const MAX_TEXT = 4000;
const MAX_REFERENCES = 5;
const MAX_TAGS = 10;
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** The only module a practice file may import from: the Practice type definitions. */
const TYPES_IMPORT = /^(?:\.\.\/)+types\/practice(?:\.js)?$/;

/**
 * Text that looks like an instruction to an AI client. Matches do not fail the check, but they
 * block auto-merge so a maintainer reads the text.
 */
const PROMPT_LIKE: RegExp[] = [
  /ignore\s+(all\s+|any\s+|the\s+)?(previous|prior|above)\s+(instructions|prompts?|rules)/i,
  /\bsystem\s+prompt\b/i,
  /\byou\s+(must|should|need to)\s+(now\s+)?(call|run|execute|send|fetch|open|delete|upload)\b/i,
  /<\/?(system|assistant|user|tool|script|iframe|img)\b/i,
];
/** Links belong in `references`. Code examples may contain URLs, so only prose is checked. */
const URL_PATTERN = /\bhttps?:\/\//i;
const PROSE_KEYS = ['title', 'description', 'details'] as const;

export interface PracticeSummary {
  id: string;
  workflow: string;
  enforcement: string;
  /** The practice's source text, used to tell whether a contribution changed it. */
  fingerprint: string;
}

export interface SourceCheck {
  /** Hard failures: the file is not safe or not valid practice data. */
  errors: string[];
  /** Reasons to read the text before merging. Not failures, but they block auto-merge. */
  flags: string[];
  practices: PracticeSummary[];
}

export interface ContributionCheck extends SourceCheck {
  /** Practices present in the head but not in the base. */
  added: string[];
  /** Practices whose enforcement changed, or that are automated (need rule code). */
  changedEnforcement: string[];
}

function stringValue(node: ts.Expression): string | undefined {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return undefined;
}

function checkDataFile(source: string, errors: string[]): ts.ObjectLiteralExpression[] {
  const syntax =
    ts.transpileModule(source, {
      reportDiagnostics: true,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    }).diagnostics ?? [];
  if (syntax.length > 0) {
    errors.push('file does not parse as TypeScript');
    return [];
  }
  const file = ts.createSourceFile(
    'practice.ts',
    source,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TS
  );

  let arrays = 0;
  const objects: ts.ObjectLiteralExpression[] = [];
  for (const stmt of file.statements) {
    if (ts.isImportDeclaration(stmt)) {
      const clause = stmt.importClause;
      const from = ts.isStringLiteral(stmt.moduleSpecifier) ? stmt.moduleSpecifier.text : '';
      const named = clause?.namedBindings && ts.isNamedImports(clause.namedBindings);
      if (!TYPES_IMPORT.test(from) || clause?.name || !named) {
        errors.push('the only import allowed is the Practice type from types/practice');
      }
      continue;
    }
    if (
      !ts.isVariableStatement(stmt) ||
      !(stmt.modifiers ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      errors.push(`top-level statement not allowed: ${ts.SyntaxKind[stmt.kind]}`);
      continue;
    }
    for (const decl of stmt.declarationList.declarations) {
      const init = decl.initializer;
      if (!init || !ts.isArrayLiteralExpression(init)) {
        errors.push('exported value must be an array literal of practices');
        continue;
      }
      arrays++;
      for (const el of init.elements) {
        if (ts.isObjectLiteralExpression(el)) objects.push(el);
        else errors.push('every practice must be an object literal');
      }
    }
  }
  if (arrays !== 1) errors.push('the file must export exactly one practice array');
  return objects;
}

function checkPractice(
  obj: ts.ObjectLiteralExpression,
  errors: string[],
  flags: string[]
): PracticeSummary | undefined {
  const values = new Map<string, ts.Expression>();
  for (const prop of obj.properties) {
    if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name)) {
      errors.push('practice properties must be plain `name: value` pairs');
      continue;
    }
    const key = prop.name.text;
    const allowed =
      (ALLOWED_STRING_KEYS as readonly string[]).includes(key) ||
      (ALLOWED_ARRAY_KEYS as readonly string[]).includes(key);
    if (!allowed) {
      errors.push(`property not allowed: ${key}`);
      continue;
    }
    values.set(key, prop.initializer);
  }

  const text = (key: string): string | undefined => {
    const node = values.get(key);
    if (!node) return undefined;
    const value = stringValue(node);
    if (value === undefined) errors.push(`${key} must be a plain string`);
    return value;
  };
  const list = (key: string): string[] | undefined => {
    const node = values.get(key);
    if (!node) return undefined;
    if (!ts.isArrayLiteralExpression(node)) {
      errors.push(`${key} must be an array of strings`);
      return undefined;
    }
    const out: string[] = [];
    for (const el of node.elements) {
      const value = stringValue(el);
      if (value === undefined) errors.push(`${key} must contain only plain strings`);
      else out.push(value);
    }
    return out;
  };

  for (const key of ALLOWED_STRING_KEYS) {
    const value = text(key);
    if (value !== undefined && value.length > MAX_TEXT)
      errors.push(`${key} is longer than ${MAX_TEXT} characters`);
  }

  const id = text('id');
  const workflow = text('workflow');
  const category = text('category');
  const severity = text('severity');
  const enforcement = text('enforcement');
  const description = text('description');

  if (!id || !ID_PATTERN.test(id)) errors.push(`invalid id: ${id ?? '(missing)'}`);
  if (!workflow || !(PRACTICE_WORKFLOWS as readonly string[]).includes(workflow))
    errors.push(`unknown workflow: ${workflow ?? '(missing)'}`);
  if (!category || !(CATEGORIES as readonly string[]).includes(category))
    errors.push(`unknown category: ${category ?? '(missing)'}`);
  if (!severity || !(SEVERITIES as readonly string[]).includes(severity))
    errors.push(`unknown severity: ${severity ?? '(missing)'}`);
  if (!enforcement || !(ENFORCEMENTS as readonly string[]).includes(enforcement))
    errors.push(`unknown enforcement: ${enforcement ?? '(missing)'}`);
  if (!values.has('title') || !text('title')) errors.push(`${id ?? 'practice'}: title is required`);
  if (!description) errors.push(`${id ?? 'practice'}: description is required`);

  const refs = list('references') ?? [];
  if (refs.length > MAX_REFERENCES) errors.push(`${id}: at most ${MAX_REFERENCES} references`);
  for (const ref of refs) {
    if (!/^https:\/\/[^\s]+$/.test(ref))
      errors.push(`${id}: reference must be an https URL: ${ref}`);
  }
  const tags = list('tags') ?? [];
  if (tags.length > MAX_TAGS) errors.push(`${id}: at most ${MAX_TAGS} tags`);

  for (const key of ALLOWED_STRING_KEYS) {
    const value = text(key);
    if (!value) continue;
    if (PROMPT_LIKE.some((re) => re.test(value)))
      flags.push(`${id}: ${key} contains text that reads like an instruction`);
    if ((PROSE_KEYS as readonly string[]).includes(key) && URL_PATTERN.test(value)) {
      flags.push(`${id}: ${key} contains a link; put links in references`);
    }
  }

  if (!id || !workflow || !enforcement) return undefined;
  return { id, workflow, enforcement, fingerprint: obj.getText() };
}

/** Checks one practice file. Returns hard errors, review flags and the practices it defines. */
export function checkPracticeSource(source: string): SourceCheck {
  const errors: string[] = [];
  const flags: string[] = [];
  const practices: PracticeSummary[] = [];
  const seen = new Set<string>();

  for (const obj of checkDataFile(source, errors)) {
    const summary = checkPractice(obj, errors, flags);
    if (!summary) continue;
    if (seen.has(summary.id)) errors.push(`duplicate id in file: ${summary.id}`);
    seen.add(summary.id);
    practices.push(summary);
  }
  return { errors, flags, practices };
}

/**
 * Compares a contribution with the base branch. New practices must be `guidance` (an `automated`
 * practice needs rule code, which only a maintainer merges). Existing practices may change text
 * but not their enforcement or workflow.
 */
export function checkContribution(
  baseSource: string | null,
  headSource: string
): ContributionCheck {
  const head = checkPracticeSource(headSource);
  const base =
    baseSource === null
      ? { errors: [], flags: [], practices: [] }
      : checkPracticeSource(baseSource);
  const basePractices = new Map(base.practices.map((p) => [p.id, p]));
  const added: string[] = [];
  const changedEnforcement: string[] = [];
  const errors = [...head.errors];
  const flags = [...head.flags];

  const reviewed = new Set<string>();
  for (const p of head.practices) {
    const before = basePractices.get(p.id);
    if (!before || before.fingerprint !== p.fingerprint) reviewed.add(p.id);
    if (!before) {
      added.push(p.id);
      if (p.enforcement !== 'guidance') {
        changedEnforcement.push(p.id);
        errors.push(
          `${p.id}: new practices must use enforcement 'guidance' (automated practices need rule code)`
        );
      }
    } else if (before.enforcement !== p.enforcement || before.workflow !== p.workflow) {
      changedEnforcement.push(p.id);
      errors.push(
        `${p.id}: enforcement and workflow of existing practices cannot change in a community PR`
      );
    }
  }

  const headIds = new Set(head.practices.map((p) => p.id));
  for (const id of basePractices.keys()) {
    if (!headIds.has(id)) errors.push(`${id}: practices cannot be removed in a community PR`);
  }

  // Flags only concern the text this contribution adds or changes, not existing practices.
  const flagged = flags.filter((flag) => reviewed.has(flag.slice(0, flag.indexOf(':'))));
  return { errors, flags: flagged, practices: head.practices, added, changedEnforcement };
}
