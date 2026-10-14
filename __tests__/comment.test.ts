import { describe, expect, it } from "vitest";
import {
  COMMENT_MARKER,
  MAX_RAW_LENGTH,
  MAX_ROWS,
  blobUrl,
  renderComment,
  renderIssue,
  renderRawOutput,
} from "../src/comment.js";
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
    expect(body).toContain("| Severity | Issue | Location |");
    expect(body).toContain(
      "| 🔴 High | **Reentrancy can drain ETH** — `Vault.withdraw` | [`Vault.sol:20`](https://github.com/acme/demo/blob/abc123/src/Vault.sol#L20) |",
    );
    expect(body).not.toContain("solc-version");
    expect(body).toContain(
      "<sub>Scanned by [Spot the Bug](https://github.com/wkalidev/spot-the-bug-action) · Need a full audit? hello@wkalidev.com</sub>",
    );
    expect(body).toMatchSnapshot();
  });

  it("shows the file name only in the location", () => {
    const summary = summarizeFindings(loadFixture(), ALL_FILES, PATH_CONTEXT);
    expect(renderComment(summary, LINK)).not.toContain("[`src/");
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

  it("collapses low-severity findings below high and medium ones", () => {
    const summary = summarizeFindings(loadFixture(), ALL_FILES, PATH_CONTEXT);
    const body = renderComment(summary, LINK);
    const details = body.indexOf("<details>\n<summary>🟡 1 low-severity finding</summary>\n\n|");
    expect(details).toBeGreaterThan(body.indexOf("| 🟠 Medium"));
    expect(body.indexOf("| 🟡 Low")).toBeGreaterThan(details);
    expect(body.indexOf("</details>")).toBeGreaterThan(body.indexOf("| 🟡 Low"));
  });

  it("renders only the collapsed table when all findings are low", () => {
    const summary = summarizeFindings(loadFixture(), changedFiles("src/Vault.sol"), PATH_CONTEXT);
    const lowOnly = { ...summary, reported: summary.reported.filter((f) => f.severity === "Low") };
    const body = renderComment(lowOnly, LINK);
    expect(body.split("| Severity | Issue | Location |")).toHaveLength(2);
    expect(body.indexOf("<details>")).toBeLessThan(body.indexOf("| Severity |"));
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
    expect(renderComment(summary, LINK)).toContain("| 🔴 High | a \\| b | — |");
  });

  it("keeps every row on a single line", () => {
    const summary = summarizeFindings(loadFixture(), ALL_FILES, PATH_CONTEXT);
    const rows = renderComment(summary, LINK)
      .split("\n")
      .filter((l) => /^\| (🔴|🟠|🟡)/u.test(l));
    expect(rows).toHaveLength(3);
    for (const row of rows) expect(row.split(/(?<!\\)\|/)).toHaveLength(5);
  });
});

const FINDING: Finding = {
  id: "arbitrary-send-eth",
  severity: "High",
  confidence: "Medium",
  file: "src/vulns/ArbitrarySend.sol",
  line: 22,
  description:
    "ArbitrarySend.sweepFees(address) (src/vulns/ArbitrarySend.sol#22-26) sends eth to arbitrary user",
};

describe("renderRawOutput", () => {
  it("keeps the full descriptions in a collapsed code block", () => {
    const summary = summarizeFindings(loadFixture(), ALL_FILES, PATH_CONTEXT);
    const body = renderComment(summary, LINK);
    const raw = body.slice(body.indexOf("<summary>Raw Slither output</summary>"));
    expect(raw).toContain("```text\n[High] reentrancy-eth src/Vault.sol:20\nReentrancy in");
    expect(raw).toContain("\tState variables written after the call(s):");
    expect(raw.indexOf("</details>")).toBeGreaterThan(raw.indexOf("\n```\n"));
  });

  it("is omitted in the clean state", () => {
    const summary = summarizeFindings(loadFixture(), changedFiles("src/Other.sol"), PATH_CONTEXT);
    expect(renderComment(summary, LINK)).not.toContain("Raw Slither output");
  });

  it("uses a fence longer than any backtick run in the descriptions", () => {
    const lines = renderRawOutput([{ ...FINDING, description: "uses ```` inside" }]);
    expect(lines).toContain("`````text");
    expect(lines).toContain("`````");
  });

  it("truncates very long output", () => {
    const lines = renderRawOutput([{ ...FINDING, description: "x".repeat(MAX_RAW_LENGTH * 2) }]);
    const raw = lines.join("\n");
    expect(raw.length).toBeLessThan(MAX_RAW_LENGTH + 200);
    expect(raw).toContain("…(truncated)");
  });
});

describe("renderIssue", () => {
  it("uses the plain-English title and the function without parameters", () => {
    expect(renderIssue(FINDING)).toBe(
      "**Anyone can send the contract's ETH** — `ArbitrarySend.sweepFees`",
    );
  });

  it("links the title to the Slither wiki with the explanation as tooltip", () => {
    const wikiUrls = new Map([
      [
        "arbitrary-send-eth",
        "https://github.com/crytic/slither/wiki/Detector-Documentation#functions-that-send-ether-to-arbitrary-destinations",
      ],
    ]);
    expect(renderIssue(FINDING, { wikiUrls })).toBe(
      "**[Anyone can send the contract's ETH](https://github.com/crytic/slither/wiki/Detector-Documentation#functions-that-send-ether-to-arbitrary-destinations " +
        '"A public function forwards ETH to a caller-controlled address.")** — `ArbitrarySend.sweepFees`',
    );
  });

  it("omits the function when the description names none", () => {
    expect(renderIssue({ ...FINDING, description: "Something odd" })).toBe(
      "**Anyone can send the contract's ETH**",
    );
  });

  it("falls back to the cleaned Slither text for unknown checks", () => {
    const finding = {
      ...FINDING,
      id: "some-new-check",
      description: "Foo.bar(uint256) (src/Foo.sol#1-5) does something wrong on :\n\t- detail",
    };
    expect(renderIssue(finding)).toBe("Foo.bar(uint256) does something wrong");
  });

  it("escapes brackets when linking fallback text", () => {
    const finding = {
      ...FINDING,
      id: "some-new-check",
      description: "Writes balances[msg.sender] (src/Foo.sol#3)",
    };
    expect(renderIssue(finding, { wikiUrls: new Map([["some-new-check", "https://x/#a"]]) })).toBe(
      "[Writes balances\\[msg.sender\\]](https://github.com/crytic/slither/wiki/Detector-Documentation#a)",
    );
  });
});

describe("blobUrl", () => {
  it("encodes path segments and omits the anchor without a line", () => {
    expect(blobUrl("src/My Contract.sol", 0, LINK)).toBe(
      "https://github.com/acme/demo/blob/abc123/src/My%20Contract.sol",
    );
  });
});
