import type { FindingsSummary, ReportedSeverity } from "./findings.js";

export const FAIL_ON_VALUES = ["high", "medium", "low", "none"] as const;
export type FailOn = (typeof FAIL_ON_VALUES)[number];

/** Severities that trigger a failure for each `fail-on` level. */
const FAILING_SEVERITIES: Record<FailOn, ReportedSeverity[]> = {
  high: ["High"],
  medium: ["High", "Medium"],
  low: ["High", "Medium", "Low"],
  none: [],
};

export function parseFailOn(input: string): FailOn {
  const value = (input || "high").trim().toLowerCase();
  if ((FAIL_ON_VALUES as readonly string[]).includes(value)) {
    return value as FailOn;
  }
  throw new Error(`Invalid fail-on value "${input}". Expected one of: ${FAIL_ON_VALUES.join(", ")}.`);
}

/** Number of findings at or above the `fail-on` threshold. */
export function countAtOrAbove(counts: FindingsSummary["counts"], failOn: FailOn): number {
  return FAILING_SEVERITIES[failOn].reduce((sum, severity) => sum + counts[severity], 0);
}

export function shouldFail(counts: FindingsSummary["counts"], failOn: FailOn): boolean {
  return countAtOrAbove(counts, failOn) > 0;
}
