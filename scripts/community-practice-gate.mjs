#!/usr/bin/env node
/**
 * Decides whether an open community practice PR can merge.
 *
 * Runs from the base branch (main) with a read/write token. It never checks out or executes code
 * from a pull request: file contents are read through the GitHub API and checked as data.
 *
 * A PR merges only when all of these hold:
 *  - it carries the `community-practice` label and no `objection` label, and is not a draft;
 *  - every changed file is src/data/practices/<name>.ts and the contribution passes the checker
 *    (no code, guidance-only new practices, no removals, no prompt-like flags);
 *  - every check run on its head is finished and the lint/build/test job passed;
 *  - it is at least MIN_AGE_DAYS old;
 *  - at least MIN_APPROVALS distinct eligible reviewers' latest review is APPROVED, and no
 *    reviewer's latest review requests changes.
 * A reviewer is eligible with write access to the repository, or with at least MIN_MERGED_PRS
 * merged pull requests in it. The author cannot approve their own PR.
 *
 * Merging only happens when PRACTICE_AUTOMERGE=enabled. Otherwise the decision is logged.
 */
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const MIN_APPROVALS = 3;
const MIN_AGE_DAYS = 7;
const MIN_MERGED_PRS = 2;
const LABEL = 'community-practice';
const OBJECTION = 'objection';
const PRACTICE_FILE = /^src\/data\/practices\/(?!index\.ts$)[a-z-]+\.ts$/;
const LINT_CHECK = 'Lint, Build & Test';

const token = process.env.GITHUB_TOKEN;
const [owner, repo] = (process.env.GITHUB_REPOSITORY ?? '').split('/');
const apiBase = `https://api.github.com/repos/${owner}/${repo}`;
const automerge = process.env.PRACTICE_AUTOMERGE === 'enabled';
const onlyPr = process.env.PR_NUMBER ? Number(process.env.PR_NUMBER) : undefined;

async function api(path, { method = 'GET', body, allow404 = false } = {}) {
  const url = path.startsWith('http')
    ? path
    : path.startsWith('/search/')
      ? `https://api.github.com${path}`
      : `${apiBase}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (allow404 && res.status === 404) return null;
  if (!res.ok)
    throw new Error(`${method} ${url} -> ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.status === 204 ? null : res.json();
}

async function paginate(path) {
  const out = [];
  for (let page = 1; ; page++) {
    const sep = path.includes('?') ? '&' : '?';
    const items = await api(`${path}${sep}per_page=100&page=${page}`);
    out.push(...items);
    if (items.length < 100) return out;
  }
}

const eligibleCache = new Map();
async function isEligibleReviewer(login) {
  if (eligibleCache.has(login)) return eligibleCache.get(login);
  const perm = await api(`/collaborators/${login}/permission`, { allow404: true });
  let eligible = !!perm && ['admin', 'maintain', 'write'].includes(perm.permission);
  if (!eligible) {
    const search = await api(
      `/search/issues?q=${encodeURIComponent(`repo:${owner}/${repo} is:pr is:merged author:${login}`)}`
    );
    eligible = search.total_count >= MIN_MERGED_PRS;
  }
  eligibleCache.set(login, eligible);
  return eligible;
}

async function readFile(path, ref) {
  const file = await api(`/contents/${path}?ref=${encodeURIComponent(ref)}`, { allow404: true });
  if (!file) return null;
  return Buffer.from(file.content, 'base64').toString('utf8');
}

async function baseIdsAcrossPractices(checkPracticeSource) {
  const listing = (await api('/contents/src/data/practices?ref=main', { allow404: true })) ?? [];
  const ids = new Set();
  for (const entry of listing) {
    if (!PRACTICE_FILE.test(entry.path)) continue;
    const text = await readFile(entry.path, 'main');
    for (const p of checkPracticeSource(text).practices) ids.add(p.id);
  }
  return ids;
}

async function evaluate(pr, checker, baseIds) {
  const reasons = [];
  const labels = pr.labels.map((l) => l.name);
  if (!labels.includes(LABEL)) reasons.push(`missing label ${LABEL}`);
  if (labels.includes(OBJECTION)) reasons.push(`has ${OBJECTION} label`);
  if (pr.draft) reasons.push('is a draft');
  if (pr.base.ref !== 'main') reasons.push(`targets ${pr.base.ref}, not main`);

  const ageDays = (Date.now() - Date.parse(pr.created_at)) / 86_400_000;
  if (ageDays < MIN_AGE_DAYS)
    reasons.push(`open ${ageDays.toFixed(1)} days, needs ${MIN_AGE_DAYS}`);

  const files = await paginate(`/pulls/${pr.number}/files`);
  if (files.length === 0) reasons.push('has no changed files');
  for (const f of files) {
    if (!PRACTICE_FILE.test(f.filename))
      reasons.push(`changes ${f.filename}, which is not a practice file`);
    if (f.status === 'removed') reasons.push(`removes ${f.filename}`);
  }
  if (reasons.length === 0) {
    const newIds = new Set();
    for (const f of files) {
      const base = await readFile(f.filename, 'main');
      const head = await readFile(f.filename, pr.head.sha);
      const result = checker.checkContribution(base, head);
      reasons.push(...result.errors, ...result.flags.map((flag) => `flag: ${flag}`));
      for (const id of result.added) newIds.add(id);
    }
    for (const id of newIds) if (baseIds.has(id)) reasons.push(`${id} already exists on main`);
  }

  const runs = (await api(`/commits/${pr.head.sha}/check-runs?per_page=100`)).check_runs;
  const unfinished = runs.filter((r) => r.status !== 'completed');
  if (unfinished.length) reasons.push(`${unfinished.length} check(s) still running`);
  const failed = runs.filter(
    (r) => r.status === 'completed' && !['success', 'skipped', 'neutral'].includes(r.conclusion)
  );
  if (failed.length) reasons.push(`failing checks: ${failed.map((r) => r.name).join(', ')}`);
  const lint = runs.find((r) => r.name.includes(LINT_CHECK));
  if (!lint || lint.conclusion !== 'success') reasons.push(`${LINT_CHECK} has not passed`);

  const reviews = await paginate(`/pulls/${pr.number}/reviews`);
  const latest = new Map();
  for (const r of reviews) {
    if (r.state === 'COMMENTED' || r.state === 'PENDING') continue;
    latest.set(r.user.login, r); // reviews come oldest first, so the last one wins
  }
  const approvers = [];
  for (const [login, r] of latest) {
    if (r.state === 'CHANGES_REQUESTED') reasons.push(`changes requested by ${login}`);
    if (r.state === 'APPROVED' && login !== pr.user.login && (await isEligibleReviewer(login)))
      approvers.push(login);
  }
  if (approvers.length < MIN_APPROVALS)
    reasons.push(`${approvers.length} of ${MIN_APPROVALS} eligible approvals`);

  return { pr: pr.number, title: pr.title, approvers, reasons, mergeable: reasons.length === 0 };
}

async function main() {
  if (!token || !owner || !repo) throw new Error('GITHUB_TOKEN and GITHUB_REPOSITORY are required');

  // The checker comes from the base branch, which is built before this script runs.
  const checker = await import(
    pathToFileURL(join(process.cwd(), 'dist/utils/practice-contribution.js')).href
  );

  const baseIds = await baseIdsAcrossPractices(checker.checkPracticeSource);
  const candidates = onlyPr
    ? [await api(`/pulls/${onlyPr}`)]
    : (await paginate('/pulls?state=open&base=main')).filter((p) =>
        p.labels.some((l) => l.name === LABEL)
      );

  const results = [];
  for (const pr of candidates) {
    const result = await evaluate(pr, checker, baseIds);
    results.push(result);
    if (result.mergeable && automerge) {
      await api(`/pulls/${pr.number}/merge`, {
        method: 'PUT',
        body: { merge_method: 'squash', commit_title: `${pr.title} (#${pr.number})` },
      });
      result.merged = true;
    }
  }

  const lines = ['| PR | Approvals | Decision |', '| --- | --- | --- |'];
  for (const r of results) {
    const decision = r.merged
      ? 'merged'
      : r.mergeable
        ? automerge
          ? 'merge failed'
          : 'eligible (auto-merge off)'
        : `blocked: ${r.reasons.join('; ')}`;
    lines.push(
      `| #${r.pr} ${r.title.replace(/\|/g, '/')} | ${r.approvers.join(', ') || '-'} | ${decision} |`
    );
  }
  const summary = lines.join('\n');
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
