import { describe, expect, it } from "vitest";
import {
  dedupeFindings,
  normalizeFinding,
  summarizeFindings,
  toRepoRelative,
} from "../src/findings.js";
import { parseSlitherReport } from "../src/slither.js";
import { ALL_FILES, PATH_CONTEXT, changedFiles, loadFixture } from "./helpers.js";

describe("parseSlitherReport", () => {
  it("returns the detector results", () => {
    expect(loadFixture()).toHaveLength(10);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseSlitherReport("not json")).toThrow(/not valid JSON/);
  });

  it("throws when slither reports a failure", () => {
    const raw = JSON.stringify({ success: false, error: "Compilation failed", results: {} });
    expect(() => parseSlitherReport(raw)).toThrow(/Compilation failed/);
  });

  it("treats a report without detectors as empty", () => {
    const output = parseSlitherReport(JSON.stringify({ success: true, error: null, results: {} }));
    expect(output.detectors).toEqual([]);
    expect(output.wikiUrls.size).toBe(0);
  });

  it("collects wiki URLs from list-detectors and skips malformed entries", () => {
    const raw = JSON.stringify({
      success: true,
      error: null,
      results: {
        detectors: [],
        "list-detectors": [
          { check: "tx-origin", wiki_url: "https://example.com/wiki#dangerous-usage-of-txorigin" },
          { check: "no-url" },
          null,
        ],
      },
    });
    expect([...parseSlitherReport(raw).wikiUrls]).toEqual([
      ["tx-origin", "https://example.com/wiki#dangerous-usage-of-txorigin"],
    ]);
  });
});

describe("toRepoRelative", () => {
  it("strips the repository root from absolute paths", () => {
    expect(
      toRepoRelative({ filename_absolute: "/home/runner/work/demo/demo/src/A.sol" }, PATH_CONTEXT),
    ).toBe("src/A.sol");
  });

  it("joins relative paths with the working directory", () => {
    expect(
      toRepoRelative(
        { filename_relative: "src/A.sol" },
        { repoRoot: "/repo", workingDirectory: "contracts" },
      ),
    ).toBe("contracts/src/A.sol");
  });

  it("normalizes Windows separators", () => {
    expect(
      toRepoRelative(
        { filename_absolute: "C:\\repo\\src\\A.sol" },
        { repoRoot: "C:\\repo", workingDirectory: "." },
      ),
    ).toBe("src/A.sol");
  });

  it("falls back to the relative path when the absolute one is outside the repo", () => {
    expect(
      toRepoRelative(
        { filename_absolute: "/elsewhere/src/A.sol", filename_relative: "./src/A.sol" },
        PATH_CONTEXT,
      ),
    ).toBe("src/A.sol");
  });
});

describe("normalizeFinding", () => {
  it("maps a slither result to a finding", () => {
    const reentrancy = loadFixture().find((d) => d.check === "reentrancy-eth");
    expect(normalizeFinding(reentrancy!, PATH_CONTEXT)).toEqual({
      id: "reentrancy-eth",
      severity: "High",
      confidence: "Medium",
      file: "src/vulns/ReentrantBank.sol",
      line: 16,
      description: expect.stringMatching(
        /^Reentrancy in ReentrantBank\.withdraw\(\) \(src\/vulns\/ReentrantBank\.sol#16-26\):\n\tExternal calls:/,
      ),
    });
  });

  it("handles results without source mapping", () => {
    const finding = normalizeFinding(
      {
        check: "x",
        impact: "Low",
        confidence: "High",
        description: " Thing\nmore \n",
        elements: [],
      },
      PATH_CONTEXT,
    );
    expect(finding).toMatchObject({ file: "", line: 0, description: "Thing\nmore" });
  });
});

describe("dedupeFindings", () => {
  it("removes identical findings", () => {
    const [high] = loadFixture();
    const finding = normalizeFinding(high!, PATH_CONTEXT);
    expect(dedupeFindings([finding, { ...finding }])).toHaveLength(1);
  });
});

describe("summarizeFindings", () => {
  it("counts reported severities and hidden ones separately", () => {
    const summary = summarizeFindings(loadFixture(), ALL_FILES, PATH_CONTEXT);
    expect(summary.counts).toEqual({ High: 4, Medium: 1, Low: 3 });
    expect(summary.informationalCount).toBe(1);
    expect(summary.optimizationCount).toBe(1);
    expect(summary.reported.map((f) => `${f.severity} ${f.id}`)).toEqual([
      "High arbitrary-send-eth",
      "High unprotected-upgrade",
      "High reentrancy-eth",
      "High unchecked-transfer",
      "Medium tx-origin",
      "Low missing-zero-check",
      "Low missing-zero-check",
      "Low reentrancy-benign",
    ]);
  });

  it("keeps only findings in changed files", () => {
    const summary = summarizeFindings(
      loadFixture(),
      changedFiles("src/vulns/ReentrantBank.sol"),
      PATH_CONTEXT,
    );
    expect(summary.reported.map((f) => f.id)).toEqual(["reentrancy-eth"]);
    expect(summary.counts).toEqual({ High: 1, Medium: 0, Low: 0 });
    expect(summary.informationalCount).toBe(1);
  });

  it("returns nothing when no finding is in a changed file", () => {
    const summary = summarizeFindings(loadFixture(), changedFiles("src/Other.sol"), PATH_CONTEXT);
    expect(summary.reported).toEqual([]);
    expect(summary.informationalCount).toBe(0);
  });

  it("deduplicates repeated detector results", () => {
    const detectors = loadFixture();
    const summary = summarizeFindings([...detectors, ...detectors], ALL_FILES, PATH_CONTEXT);
    expect(summary.reported).toHaveLength(8);
  });
});
