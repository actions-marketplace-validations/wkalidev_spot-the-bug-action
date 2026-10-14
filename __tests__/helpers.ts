import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ChangedFiles } from "../src/changed-files.js";
import type { PathContext } from "../src/findings.js";
import {
  parseSlitherReport,
  type SlitherDetectorResult,
  type SlitherOutput,
} from "../src/slither.js";

export const PATH_CONTEXT: PathContext = {
  repoRoot: "/home/runner/work/demo/demo",
  workingDirectory: ".",
};

export const ALL_FILES: ChangedFiles = { all: true };

export function changedFiles(...files: string[]): ChangedFiles {
  return { all: false, files: new Set(files) };
}

export function loadReport(): SlitherOutput {
  const url = new URL("./fixtures/slither.json", import.meta.url);
  return parseSlitherReport(readFileSync(fileURLToPath(url), "utf8"));
}

export function loadFixture(): SlitherDetectorResult[] {
  return loadReport().detectors;
}
