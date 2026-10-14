import * as core from "@actions/core";
import * as github from "@actions/github";
import type { Finding, FindingsSummary, Severity } from "./findings.js";

type Octokit = ReturnType<typeof github.getOctokit>;

export const COMMENT_MARKER = "<!-- spot-the-bug -->";
export const MAX_ROWS = 30;

const SEVERITY_ICONS: Record<Severity, string> = {
  High: "🔴",
  Medium: "🟠",
  Low: "🟡",
  Informational: "ℹ️",
  Optimization: "⚡",
};

const FOOTER =
  "<sub>Scanned by [Spot the Bug](https://github.com/wkalidev/spot-the-bug-action) · " +
  "Need a full audit? hello@wkalidev.com</sub>";

export interface LinkContext {
  serverUrl: string;
  owner: string;
  repo: string;
  sha: string;
}

function escapeCell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
}

export function blobUrl(file: string, line: number, link: LinkContext): string {
  const encodedPath = file.split("/").map(encodeURIComponent).join("/");
  const anchor = line > 0 ? `#L${line}` : "";
  return `${link.serverUrl}/${link.owner}/${link.repo}/blob/${link.sha}/${encodedPath}${anchor}`;
}

function renderLocation(finding: Finding, link: LinkContext): string {
  if (!finding.file) return "—";
  const label = finding.line > 0 ? `${finding.file}:${finding.line}` : finding.file;
  return `[\`${label}\`](${blobUrl(finding.file, finding.line, link)})`;
}

function renderRow(finding: Finding, link: LinkContext): string {
  const severity = `${SEVERITY_ICONS[finding.severity]} ${finding.severity}`;
  return `| ${severity} | \`${finding.id}\` | ${renderLocation(finding, link)} | ${escapeCell(finding.description)} |`;
}

export function renderComment(summary: FindingsSummary, link: LinkContext): string {
  const total = summary.reported.length;
  const lines: string[] = [COMMENT_MARKER];

  if (total === 0) {
    lines.push("## ✅ Spot the Bug — no issues found in changed files");
  } else {
    const noun = total === 1 ? "finding" : "findings";
    lines.push(`## 🔍 Spot the Bug — ${total} ${noun} in changed files`);
  }
  lines.push("");
  lines.push(
    `🔴 High: **${summary.counts.High}** · 🟠 Medium: **${summary.counts.Medium}** · ` +
      `🟡 Low: **${summary.counts.Low}**`,
  );

  const hidden = summary.informationalCount + summary.optimizationCount;
  if (hidden > 0) {
    lines.push("");
    lines.push(
      `<sub>Not shown: ${summary.informationalCount} informational, ` +
        `${summary.optimizationCount} optimization.</sub>`,
    );
  }

  if (total > 0) {
    lines.push("");
    lines.push("| Severity | Check | Location | Description |");
    lines.push("| --- | --- | --- | --- |");
    for (const finding of summary.reported.slice(0, MAX_ROWS)) {
      lines.push(renderRow(finding, link));
    }
    if (total > MAX_ROWS) {
      lines.push("");
      lines.push(`…and ${total - MAX_ROWS} more`);
    }
  }

  lines.push("");
  lines.push(FOOTER);
  return lines.join("\n") + "\n";
}

/**
 * Create the summary comment on the pull request, or update the existing one
 * that carries the hidden marker.
 */
export async function upsertComment(
  octokit: Octokit,
  repo: { owner: string; repo: string },
  issueNumber: number,
  body: string,
): Promise<void> {
  const comments = await octokit.paginate(octokit.rest.issues.listComments, {
    ...repo,
    issue_number: issueNumber,
    per_page: 100,
  });
  const existing = comments.find((c) => c.body?.includes(COMMENT_MARKER));

  if (existing) {
    await octokit.rest.issues.updateComment({ ...repo, comment_id: existing.id, body });
    core.info(`Updated summary comment ${existing.html_url}`);
  } else {
    const { data } = await octokit.rest.issues.createComment({
      ...repo,
      issue_number: issueNumber,
      body,
    });
    core.info(`Created summary comment ${data.html_url}`);
  }
}
