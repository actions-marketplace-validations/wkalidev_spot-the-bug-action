import * as core from "@actions/core";
import * as github from "@actions/github";
import { getChangedFiles } from "./changed-files.js";

function setZeroOutputs(): void {
  core.setOutput("findings-count", 0);
  core.setOutput("high-count", 0);
}

export async function run(): Promise<void> {
  const token = core.getInput("github-token", { required: true });
  const octokit = github.getOctokit(token);
  const context = github.context;

  const changed = await getChangedFiles(octokit, context);
  if (!changed.all && changed.files.size === 0) {
    core.info("No Solidity files changed in this pull request. Nothing to scan.");
    setZeroOutputs();
    return;
  }
}

run().catch((error: unknown) => {
  core.setFailed(error instanceof Error ? error.message : String(error));
});
