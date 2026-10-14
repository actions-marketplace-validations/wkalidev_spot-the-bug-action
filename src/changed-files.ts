import * as core from "@actions/core";
import * as github from "@actions/github";

type Octokit = ReturnType<typeof github.getOctokit>;
type Context = typeof github.context;

/**
 * Files to report on. `all` means every file is in scope (non-PR events).
 * Otherwise `files` holds repo-relative paths with forward slashes.
 */
export type ChangedFiles = { all: true } | { all: false; files: Set<string> };

const PR_EVENTS = new Set(["pull_request", "pull_request_target"]);
const KEPT_STATUSES = new Set(["added", "modified", "renamed"]);

export function isPullRequestEvent(context: Context): boolean {
  return PR_EVENTS.has(context.eventName) && context.payload.pull_request !== undefined;
}

export function normalizePath(p: string): string {
  return p
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/\/{2,}/g, "/");
}

export function isSolidityFile(filename: string): boolean {
  return filename.toLowerCase().endsWith(".sol");
}

export async function getChangedFiles(octokit: Octokit, context: Context): Promise<ChangedFiles> {
  if (!isPullRequestEvent(context)) {
    core.info(`Event "${context.eventName}" is not a pull request: scanning all files.`);
    return { all: true };
  }

  const pullNumber = context.payload.pull_request!.number;
  const prFiles = await octokit.paginate(octokit.rest.pulls.listFiles, {
    ...context.repo,
    pull_number: pullNumber,
    per_page: 100,
  });

  const files = new Set(
    prFiles
      .filter((f) => KEPT_STATUSES.has(f.status) && isSolidityFile(f.filename))
      .map((f) => normalizePath(f.filename)),
  );
  core.info(`Changed Solidity files in PR #${pullNumber}: ${files.size}`);
  for (const f of files) core.info(`  - ${f}`);
  return { all: false, files };
}
