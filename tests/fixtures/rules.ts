import { Validator } from '../../src/engine/validator';
import { Workflow } from '../../src/types/workflow';
import { Finding } from '../../src/types/finding';

/** Runs the real project validator and returns all findings. */
export async function findingsFor(dir: string, workflow: Workflow): Promise<Finding[]> {
  const result = await new Validator().validateProject(dir, workflow);
  return result.findings;
}

export async function idsFor(dir: string, workflow: Workflow): Promise<string[]> {
  return (await findingsFor(dir, workflow)).map((f) => f.id);
}
