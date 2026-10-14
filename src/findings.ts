import * as path from "node:path";
import { normalizePath, type ChangedFiles } from "./changed-files.js";
import type { SlitherDetectorResult } from "./slither.js";

export const SEVERITIES = ["High", "Medium", "Low", "Informational", "Optimization"] as const;
export type Severity = (typeof SEVERITIES)[number];

/** Severities shown in the PR comment and counted in outputs. */
export const REPORTED_SEVERITIES = ["High", "Medium", "Low"] as const;
export type ReportedSeverity = (typeof REPORTED_SEVERITIES)[number];

export interface Finding {
  id: string;
  severity: Severity;
  confidence: string;
  /** Repo-relative path with forward slashes, or "" when unknown. */
  file: string;
  /** First line of the finding, or 0 when unknown. */
  line: number;
  /** Full Slither description; the comment shows a short form and keeps this as raw output. */
  description: string;
}

export interface FindingsSummary {
  /** High, Medium and Low findings in scope, sorted by severity, file and line. */
  reported: Finding[];
  counts: Record<ReportedSeverity, number>;
  informationalCount: number;
  optimizationCount: number;
}

export interface PathContext {
  /** Absolute path of the repository root (GITHUB_WORKSPACE). */
  repoRoot: string;
  /** Slither working directory, relative to the repository root. */
  workingDirectory: string;
}

function toSeverity(impact: string): Severity {
  const match = SEVERITIES.find((s) => s.toLowerCase() === impact.trim().toLowerCase());
  return match ?? "Informational";
}

function stripTrailingSlash(p: string): string {
  return p.length > 1 ? p.replace(/\/+$/, "") : p;
}

/**
 * Resolve a slither source path to a repo-relative path with forward slashes.
 * Works on plain strings so it behaves the same on every platform.
 */
export function toRepoRelative(
  mapping: { filename_absolute?: string; filename_relative?: string },
  ctx: PathContext,
): string {
  const root = stripTrailingSlash(normalizePath(ctx.repoRoot));
  const absolute = mapping.filename_absolute ? normalizePath(mapping.filename_absolute) : "";
  if (absolute && absolute.startsWith(`${root}/`)) {
    return absolute.slice(root.length + 1);
  }
  if (mapping.filename_relative) {
    const joined = path.posix.join(
      normalizePath(ctx.workingDirectory || "."),
      normalizePath(mapping.filename_relative),
    );
    return normalizePath(path.posix.normalize(joined));
  }
  return "";
}

export function normalizeFinding(result: SlitherDetectorResult, ctx: PathContext): Finding {
  const element = (result.elements ?? []).find((e) => e.source_mapping);
  const mapping = element?.source_mapping;
  const description = (result.description ?? "").trim();
  return {
    id: result.check,
    severity: toSeverity(result.impact ?? ""),
    confidence: result.confidence ?? "",
    file: mapping ? toRepoRelative(mapping, ctx) : "",
    line: mapping?.lines?.[0] ?? 0,
    description,
  };
}

export function isInScope(finding: Finding, changed: ChangedFiles): boolean {
  return changed.all || changed.files.has(finding.file);
}

export function dedupeFindings(findings: Finding[]): Finding[] {
  const seen = new Set<string>();
  return findings.filter((f) => {
    const key = [f.id, f.severity, f.file, f.line, f.description].join("\u0000");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function compareFindings(a: Finding, b: Finding): number {
  return (
    SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity) ||
    a.file.localeCompare(b.file) ||
    a.line - b.line ||
    a.id.localeCompare(b.id)
  );
}

export function summarizeFindings(
  detectors: SlitherDetectorResult[],
  changed: ChangedFiles,
  ctx: PathContext,
): FindingsSummary {
  const inScope = dedupeFindings(
    detectors.map((d) => normalizeFinding(d, ctx)).filter((f) => isInScope(f, changed)),
  );

  const counts: Record<ReportedSeverity, number> = { High: 0, Medium: 0, Low: 0 };
  let informationalCount = 0;
  let optimizationCount = 0;
  const reported: Finding[] = [];

  for (const finding of inScope) {
    if (finding.severity === "Informational") informationalCount++;
    else if (finding.severity === "Optimization") optimizationCount++;
    else {
      counts[finding.severity]++;
      reported.push(finding);
    }
  }

  reported.sort(compareFindings);
  return { reported, counts, informationalCount, optimizationCount };
}
