/**
 * The upload validation the server runs for POST /api/validate-upload, for the browser. The files
 * are held in memory under a virtual project root, so nothing leaves the visitor's computer. It
 * must give the same result as the server route for the same files (see the parity test). It
 * imports no Node modules: the browser loads it directly from the compiled output.
 */
import { WorkflowDetector } from './detector.js';
import { createMemoryProjectFs, type ProjectFs } from './project-fs.js';
import { sanitizeUpload, stripDirPrefix, UPLOAD_LABEL, UploadError } from './upload-sanitize.js';
import { Validator } from './validator.js';
import { parseFindingFilters } from '../utils/query-params.js';
import { VALID_WORKFLOWS } from '../types/workflow.js';
import type { Workflow } from '../types/workflow.js';
import { logger } from '../utils/logger.js';

// The engine logs every analysis at info level; the browser console should show only problems.
logger.setLevel('warn');

/** Virtual root the uploaded files are placed under. Findings are reported relative to it. */
export const BROWSER_UPLOAD_ROOT = '/project';

/** A prepared project: where its files are, and how to read them. */
export interface PreparedProject {
  fsys: ProjectFs;
  root: string;
  /** Called once the analysis is finished, also when it failed. */
  cleanup?: () => Promise<void>;
}

/**
 * Runs the upload analysis on a posted body. `prepare` places the sanitised files somewhere the
 * validator can read them: memory in the browser, a temp folder in the tests and on the server.
 * Throws UploadError for an invalid upload.
 */
export async function analyseUpload(
  body: Record<string, unknown>,
  prepare: (files: readonly { path: string; content: string }[]) => Promise<PreparedProject>
): Promise<Record<string, unknown>> {
  const upload = sanitizeUpload(body);

  const workflow = body.workflow;
  if (workflow !== undefined && workflow !== null && workflow !== '') {
    if (
      typeof workflow !== 'string' ||
      !(VALID_WORKFLOWS as readonly string[]).includes(workflow)
    ) {
      throw new UploadError('INVALID_WORKFLOW', 'Invalid workflow type');
    }
  }
  const filters = parseFindingFilters(body);
  if (!filters.ok) throw new UploadError('INVALID_PARAMETER', filters.message);
  const detectOnly = body.detectOnly === true;

  const project = await prepare(upload.files);
  try {
    const { fsys, root } = project;
    const scrub = <T>(value: T): T => stripDirPrefix(value, [root]);

    const detection = await new WorkflowDetector(fsys).detect(root);
    const detected = scrub({
      workflow: detection.workflow,
      confidence: detection.confidence,
      indicators: detection.indicators,
    });
    const uploadInfo = { files: upload.files.length, bytes: upload.bytes, skipped: upload.skipped };
    if (detectOnly) return { detected, upload: uploadInfo };

    const chosen = (
      typeof workflow === 'string' && workflow ? workflow : detection.workflow
    ) as Workflow;
    const result = await new Validator(fsys).validateProject(root, chosen, filters.value);
    return { ...scrub(result), filePath: UPLOAD_LABEL, detected, upload: uploadInfo };
  } finally {
    await project.cleanup?.();
  }
}

/** Browser: the files are held in memory under BROWSER_UPLOAD_ROOT. */
export function validateUploadBody(
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  return analyseUpload(body, async (files) => {
    const memory: Record<string, string> = {};
    for (const file of files) memory[`${BROWSER_UPLOAD_ROOT}/${file.path}`] = file.content;
    return { fsys: createMemoryProjectFs(memory), root: BROWSER_UPLOAD_ROOT };
  });
}
