import type { Workflow } from './types/workflow.js';
import { GeneratedTemplate } from './types/template.js';
import { PROJECT_TYPES } from './tools/schemas.js';
import { TemplateGenerator } from './engine/template-generator.js';

export type ProjectType = (typeof PROJECT_TYPES)[number];

export interface ProjectAnswers {
  projectName?: string;
  authorName?: string;
  authorEmail?: string;
}

/** Questions the client should ask the user, in order, for a project that has no name yet. */
export const PROJECT_QUESTIONS = [
  { key: 'projectName', question: 'What is the name of the project?' },
  { key: 'authorName', question: 'Who is the author?' },
  { key: 'authorEmail', question: 'What is the author e-mail address? (optional)' },
] as const;

const PACKAGE_NAME = /^[A-Za-z][A-Za-z0-9.]*[A-Za-z0-9]$/;
const PROJECT_NAME = /^[A-Za-z][A-Za-z0-9._-]{0,63}$/;

export function isValidProjectName(type: ProjectType, name: string): boolean {
  return type === 'package' ? PACKAGE_NAME.test(name) : PROJECT_NAME.test(name);
}

export type CreateProjectResult =
  | { ok: true; template: GeneratedTemplate }
  | { ok: false; code: 'NEEDS_INPUT' | 'INVALID_PARAMETER'; message: string; questions?: typeof PROJECT_QUESTIONS };

/**
 * Build the file list for one project type. Missing answers are reported, not guessed, so the
 * client can ask the user first.
 */
export async function createProject(
  type: ProjectType,
  answers: ProjectAnswers,
  generator: TemplateGenerator
): Promise<CreateProjectResult> {
  if (!answers.projectName) {
    return {
      ok: false,
      code: 'NEEDS_INPUT',
      message: 'projectName is required. Ask the user the questions below, then call create_project again.',
      questions: PROJECT_QUESTIONS,
    };
  }

  if (!isValidProjectName(type, answers.projectName)) {
    return {
      ok: false,
      code: 'INVALID_PARAMETER',
      message:
        type === 'package'
          ? `"${answers.projectName}" is not a valid package name: use letters, digits and dots, start with a letter, and do not end with a dot.`
          : `"${answers.projectName}" is not a valid project name: use letters, digits, dots, dashes and underscores, and start with a letter.`,
    };
  }

  const template = await generator.generate(type as Workflow, {
    projectName: answers.projectName,
    authorName: answers.authorName,
    authorEmail: answers.authorEmail,
  });
  return { ok: true, template };
}
