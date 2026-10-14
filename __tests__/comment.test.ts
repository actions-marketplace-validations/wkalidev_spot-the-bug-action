import { describe, expect, it } from "vitest";
import { COMMENT_MARKER, MAX_ROWS, blobUrl, renderComment } from "../src/comment.js";
import { summarizeFindings, type Finding, type FindingsSummary } from "../src/findings.js";
import { ALL_FILES, PATH_CONTEXT, changedFiles, loadFixture } from "./helpers.js";

const LINK = {
  serverUrl: "https://github.com",
  owner: "acme",
  repo: "demo",
  sha: "abc123",
};

describe("renderComment", () => {
  it("renders findings from the fixture", () => {
    const summary = summarizeFindings(loadFixture(), ALL_FILES, PATH_CONTEXT);
    const body = renderComment(summary, LINK);

    expect(body.startsWith(COMMENT_MARKER)).toBe(true);
    expect(body).toContain("## 🔍 Spot the Bug — 3 findings in changed files");
    expect(body).toContain("🔴 High: **1** · 🟠 Medium: **1** · 🟡 Low: **1**");
    expect(body).toContain("Not shown: 1 informational, 0 optimization.");
    expect(body).toContain("| Severity | Check | Location | Description |");
    expect(body).toContain(
      "| 🔴 High | `reentrancy-eth` | [`src/Vault.sol:20`](https://github.com/acme/demo/blob/abc123/src/Vault.sol#L20) |",
    );
    expect(body).not.toContain("solc-version");
    expect(body).toContain(
      "<sub>Scanned by [Spot the Bug](https://github.com/wkalidev/spot-the-bug-action) · Need a full audit? hello@wkalidev.com</sub>",
    );
    expect(body).toMatchSnapshot();
  });

  it("renders the clean state", () => {
    const summary = summarizeFindings(loadFixture(), changedFiles("src/Other.sol"), PATH_CONTEXT);
    const body = renderComment(summary, LINK);
    expect(body).toContain("## ✅ Spot the Bug — no issues found in changed files");
    expect(body).not.toContain("| Severity |");
    expect(body).not.toContain("Not shown");
  });

  it("uses the singular for one finding", () => {
    const summary = summarizeFindings(loadFixture(), changedFiles("src/Token.sol"), PATH_CONTEXT);
    expect(renderComment(summary, LINK)).toContain("— 1 finding in changed files");
  });

  it("caps the table and reports the remainder", () => {
    const finding: Finding = {
      id: "missing-zero-check",
      severity: "Low",
      confidence: "Medium",
      file: "src/A.sol",
      line: 1,
      description: "desc",
    };
    const reported = Array.from({ length: MAX_ROWS + 5 }, (_, i) => ({ ...finding, line: i + 1 }));
    const summary: FindingsSummary = {
      reported,
      counts: { High: 0, Medium: 0, Low: reported.length },
      informationalCount: 0,
      optimizationCount: 0,
    };
    const body = renderComment(summary, LINK);
    const rows = body.split("\n").filter((l) => l.startsWith("| 🟡 Low"));
    expect(rows).toHaveLength(MAX_ROWS);
    expect(body).toContain("…and 5 more");
  });

  it("escapes pipes and newlines in descriptions", () => {
    const summary: FindingsSummary = {
      reported: [
        {
          id: "x",
          severity: "High",
          confidence: "High",
          file: "",
          line: 0,
          description: "a | b",
        },
      ],
      counts: { High: 1, Medium: 0, Low: 0 },
      informationalCount: 0,
      optimizationCount: 0,
    };
    expect(renderComment(summary, LINK)).toContain("| 🔴 High | `x` | — | a \\| b |");
  });
});

describe("blobUrl", () => {
  it("encodes path segments and omits the anchor without a line", () => {
    expect(blobUrl("src/My Contract.sol", 0, LINK)).toBe(
      "https://github.com/acme/demo/blob/abc123/src/My%20Contract.sol",
    );
  });
});
