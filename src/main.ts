import * as core from "@actions/core";
import * as github from "@actions/github";
import * as path from "node:path";
import { getChangedFiles } from "./changed-files.js";
import { summarizeFindings } from "./findings.js";
import { runSlither } from "./slither.js";

function setZeroOutputs(): void {
  core.setOutput("findings-count", 0);
  core.setOutput("high-count", 0);
}

export async function run(): Promise<void> {
  const token = core.getInput("github-token", { required: true });
  const workingDirectoryInput = core.getInput("working-directory") || ".";
  const slitherArgs = core.getInput("slither-args");

  const repoRoot = process.env.GITHUB_WORKSPACE || process.cwd();
  const workingDirectory = path.resolve(repoRoot, workingDirectoryInput);

  const octokit = github.getOctokit(token);
  const context = github.context;

  const changed = await getChangedFiles(octokit, context);
  if (!changed.all && changed.files.size === 0) {
    core.info("No Solidity files changed in this pull request. Nothing to scan.");
    setZeroOutputs();
    return;
  }

  const detectors = await runSlither(workingDirectory, slitherArgs);
  core.info(`Slither reported ${detectors.length} detector results.`);

  const summary = summarizeFindings(detectors, changed, {
    repoRoot,
    workingDirectory: path.relative(repoRoot, workingDirectory) || ".",
  });
  core.info(
    `Findings in scope: ${summary.counts.High} high, ${summary.counts.Medium} medium, ` +
      `${summary.counts.Low} low, ${summary.informationalCount} informational, ` +
      `${summary.optimizationCount} optimization.`,
  );
}

run().catch((error: unknown) => {
  core.setFailed(error instanceof Error ? error.message : String(error));
});
