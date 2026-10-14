import * as core from "@actions/core";
import * as exec from "@actions/exec";
import { existsSync, readFileSync, rmSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export interface SlitherSourceMapping {
  filename_relative?: string;
  filename_absolute?: string;
  filename_short?: string;
  is_dependency?: boolean;
  lines?: number[];
}

export interface SlitherElement {
  type?: string;
  name?: string;
  source_mapping?: SlitherSourceMapping;
}

export interface SlitherDetectorResult {
  check: string;
  impact: string;
  confidence: string;
  description: string;
  elements: SlitherElement[];
  first_markdown_element?: string;
  id?: string;
}

/** Documentation entry from Slither's "list-detectors" JSON output. */
export interface SlitherDetectorDoc {
  check: string;
  title?: string;
  wiki_url?: string;
}

export interface SlitherReport {
  success: boolean;
  error: string | null;
  results?: { detectors?: SlitherDetectorResult[]; "list-detectors"?: SlitherDetectorDoc[] };
}

export interface SlitherOutput {
  detectors: SlitherDetectorResult[];
  /** Wiki URL reported by Slither for each check id, when available. */
  wikiUrls: Map<string, string>;
}

/**
 * Split a shell-like argument string, honouring single and double quotes.
 */
export function splitArgs(input: string): string[] {
  const args: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let current = "";
  let lastEnd = -1;
  for (const match of input.matchAll(re)) {
    const value = match[1] ?? match[2] ?? match[3] ?? "";
    // Adjacent tokens without whitespace in between belong to the same argument.
    if (match.index === lastEnd) {
      current += value;
    } else {
      if (lastEnd !== -1) args.push(current);
      current = value;
    }
    lastEnd = match.index + match[0].length;
  }
  if (lastEnd !== -1) args.push(current);
  return args;
}

function collectWikiUrls(docs: unknown): Map<string, string> {
  const wikiUrls = new Map<string, string>();
  if (!Array.isArray(docs)) return wikiUrls;
  for (const doc of docs as Partial<SlitherDetectorDoc>[]) {
    if (typeof doc?.check === "string" && typeof doc.wiki_url === "string") {
      wikiUrls.set(doc.check, doc.wiki_url);
    }
  }
  return wikiUrls;
}

/**
 * Parse and validate the content of a slither JSON report.
 */
export function parseSlitherReport(raw: string): SlitherOutput {
  let report: SlitherReport;
  try {
    report = JSON.parse(raw) as SlitherReport;
  } catch (error) {
    throw new Error(`Slither JSON report is not valid JSON: ${(error as Error).message}`, {
      cause: error,
    });
  }
  if (typeof report !== "object" || report === null) {
    throw new Error("Slither JSON report has an unexpected shape.");
  }
  if (report.success === false) {
    throw new Error(`Slither failed: ${report.error ?? "unknown error"}`);
  }
  const detectors = report.results?.detectors ?? [];
  if (!Array.isArray(detectors)) {
    throw new Error("Slither JSON report has an invalid results.detectors field.");
  }
  return { detectors, wikiUrls: collectWikiUrls(report.results?.["list-detectors"]) };
}

/**
 * Run slither in `workingDirectory` and return its detector results, along with
 * the detector documentation used to link each check to the Slither wiki.
 * Slither exits non-zero when it finds issues, so the exit code is ignored;
 * only a missing or invalid JSON report is treated as a failure.
 */
export async function runSlither(
  workingDirectory: string,
  extraArgs: string,
): Promise<SlitherOutput> {
  const tempDir = process.env.RUNNER_TEMP || os.tmpdir();
  const jsonPath = path.join(tempDir, "spot-the-bug-slither.json");
  // Slither refuses to overwrite an existing report.
  rmSync(jsonPath, { force: true });

  const args = [
    ".",
    "--json",
    jsonPath,
    "--json-types",
    "detectors,list-detectors",
    ...splitArgs(extraArgs),
  ];
  core.info(`Running: slither ${args.join(" ")} (cwd: ${workingDirectory})`);
  const exitCode = await exec.exec("slither", args, {
    cwd: workingDirectory,
    ignoreReturnCode: true,
  });
  core.info(`Slither exited with code ${exitCode}.`);

  if (!existsSync(jsonPath)) {
    throw new Error(
      `Slither did not produce a JSON report (exit code ${exitCode}). Check the logs above for compilation errors.`,
    );
  }
  return parseSlitherReport(readFileSync(jsonPath, "utf8"));
}
