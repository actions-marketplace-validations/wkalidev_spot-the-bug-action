import { describe, expect, it } from "vitest";
import {
  EXPLANATIONS,
  MAX_TEXT_LENGTH,
  cleanDescription,
  explain,
  extractFunction,
  slitherWikiUrl,
  truncate,
} from "../src/explanations.js";

const REQUIRED_CHECKS = [
  "arbitrary-send-eth",
  "unprotected-upgrade",
  "suicidal",
  "reentrancy-eth",
  "reentrancy-no-eth",
  "reentrancy-benign",
  "unchecked-transfer",
  "unchecked-lowlevel",
  "unchecked-send",
  "tx-origin",
  "missing-zero-check",
  "controlled-delegatecall",
  "delegatecall-loop",
  "uninitialized-state",
  "uninitialized-storage",
  "weak-prng",
  "divide-before-multiply",
  "incorrect-equality",
  "locked-ether",
  "shadowing-state",
  "timestamp",
];

describe("explain", () => {
  it.each(REQUIRED_CHECKS)("explains %s", (check) => {
    expect(explain(check)).toBeDefined();
  });

  it("maps a check to its plain-English title and reason", () => {
    expect(explain("arbitrary-send-eth")).toEqual({
      title: "Anyone can send the contract's ETH",
      why: "A public function forwards ETH to a caller-controlled address.",
    });
  });

  it("keeps every title and reason short and on one line", () => {
    for (const { title, why } of Object.values(EXPLANATIONS)) {
      for (const text of [title, why]) {
        expect(text.length).toBeLessThanOrEqual(MAX_TEXT_LENGTH);
        expect(text).not.toMatch(/[\n|]/);
      }
    }
  });

  it("returns undefined for unknown checks and inherited keys", () => {
    expect(explain("naming-convention")).toBeUndefined();
    expect(explain("toString")).toBeUndefined();
  });
});

describe("slitherWikiUrl", () => {
  it("keeps the anchor Slither reports, including numbered duplicates", () => {
    expect(
      slitherWikiUrl(
        "https://github.com/crytic/slither/wiki/Detector-Documentation#reentrancy-vulnerabilities-2",
      ),
    ).toBe(
      "https://github.com/crytic/slither/wiki/Detector-Documentation#reentrancy-vulnerabilities-2",
    );
  });

  it("normalizes the anchor case and stray slashes", () => {
    expect(
      slitherWikiUrl("https://github.com/crytic/slither/wiki/Detector-Documentation/#weak-PRNG"),
    ).toBe("https://github.com/crytic/slither/wiki/Detector-Documentation#weak-prng");
  });

  it("skips the link without an anchor", () => {
    expect(slitherWikiUrl(undefined)).toBeUndefined();
    expect(slitherWikiUrl("https://example.com/docs")).toBeUndefined();
    expect(slitherWikiUrl("https://example.com/docs#")).toBeUndefined();
  });
});

describe("extractFunction", () => {
  it.each([
    [
      "TxOriginWallet.transferTo(address,uint256) (src/vulns/TxOriginWallet.sol#18-23) sends eth to arbitrary user\n\tDangerous calls:",
      "TxOriginWallet.transferTo",
    ],
    [
      "Reentrancy in ReentrantBank.withdraw() (src/vulns/ReentrantBank.sol#16-26):\n\tExternal calls:",
      "ReentrantBank.withdraw",
    ],
    [
      "ArbitrarySend.constructor(address)._treasury (src/vulns/ArbitrarySend.sol#14) lacks a zero-check on :",
      "ArbitrarySend.constructor",
    ],
    [
      "ParityStyleLibrary (src/vulns/ParityStyleLibrary.sol#21-46) is an upgradeable contract that does not protect its initialize functions: ParityStyleLibrary.initWallet(address) (src/vulns/ParityStyleLibrary.sol#28-31).",
      "ParityStyleLibrary.initWallet",
    ],
  ])("finds the first function in %j", (description, expected) => {
    expect(extractFunction(description)).toBe(expected);
  });

  it("ignores calls on later lines", () => {
    expect(extractFunction("Something odd\n\t- token.transfer(a,b) (src/A.sol#3)")).toBeUndefined();
  });

  it("returns undefined when no function is named", () => {
    expect(
      extractFunction("Pragma version^0.8.0 (src/Token.sol#2) allows old versions"),
    ).toBeUndefined();
  });
});

describe("cleanDescription", () => {
  it("strips source paths and the dangling 'on :' ending", () => {
    expect(
      cleanDescription(
        "ArbitrarySend.sweepFees(address).to (src/vulns/ArbitrarySend.sol#22) lacks a zero-check on :\n\t\t- to.transfer(amount) (src/vulns/ArbitrarySend.sol#25)\n",
      ),
    ).toBe("ArbitrarySend.sweepFees(address).to lacks a zero-check");
  });

  it("keeps only the first line and drops the trailing colon", () => {
    expect(
      cleanDescription(
        "Reentrancy in ReentrantBank.withdraw() (src/vulns/ReentrantBank.sol#16-26):\n\tExternal calls:\n",
      ),
    ).toBe("Reentrancy in ReentrantBank.withdraw()");
  });

  it("strips every path group and a dangling 'by'", () => {
    expect(cleanDescription("A.f() (src/A.sol#1-4) is called by (src/B.sol#9)")).toBe(
      "A.f() is called",
    );
  });

  it("does not cut words that merely end in 'on' or 'by'", () => {
    expect(cleanDescription("Missing validation")).toBe("Missing validation");
    expect(cleanDescription("Use of a hobby")).toBe("Use of a hobby");
  });

  it("collapses whitespace", () => {
    expect(cleanDescription("  a \t  b   c  ")).toBe("a b c");
  });

  it("truncates long text with an ellipsis", () => {
    const cleaned = cleanDescription("word ".repeat(40));
    expect(cleaned).toHaveLength(MAX_TEXT_LENGTH);
    expect(cleaned.endsWith("…")).toBe(true);
  });
});

describe("truncate", () => {
  it("leaves short text alone", () => {
    expect(truncate("short", 10)).toBe("short");
  });

  it("never exceeds the limit", () => {
    expect(truncate("abcdefghij", 5)).toBe("abcd…");
  });
});
