export interface Explanation {
  /** What is wrong, in plain English. */
  title: string;
  /** Why it matters, in one short sentence. */
  why: string;
}

/** Longest title, explanation or cleaned description shown in the comment. */
export const MAX_TEXT_LENGTH = 90;

const WIKI_BASE = "https://github.com/crytic/slither/wiki/Detector-Documentation";

/** Plain-English explanations for common Slither checks, keyed by check id. */
export const EXPLANATIONS: Readonly<Record<string, Explanation>> = {
  "arbitrary-send-eth": {
    title: "Anyone can send the contract's ETH",
    why: "A public function forwards ETH to a caller-controlled address.",
  },
  "unprotected-upgrade": {
    title: "Anyone can initialize or destroy the contract",
    why: "The initializer is unprotected, so an attacker can take ownership and selfdestruct it.",
  },
  suicidal: {
    title: "Anyone can destroy the contract",
    why: "selfdestruct is reachable without access control, wiping code and funds.",
  },
  "reentrancy-eth": {
    title: "Reentrancy can drain ETH",
    why: "State is updated after an external call, so a callback can withdraw again.",
  },
  "reentrancy-no-eth": {
    title: "Reentrancy can corrupt state",
    why: "State is updated after an external call, so a callback sees stale values.",
  },
  "reentrancy-benign": {
    title: "State written after an external call",
    why: "Likely harmless today, but breaks checks-effects-interactions.",
  },
  "unchecked-transfer": {
    title: "Token transfer result ignored",
    why: "A transfer that returns false goes unnoticed; use SafeERC20.",
  },
  "unchecked-lowlevel": {
    title: "Low-level call result ignored",
    why: "A failed call does not revert, so execution continues silently.",
  },
  "unchecked-send": {
    title: "send() result ignored",
    why: "send returns false instead of reverting, so a failed payment goes unnoticed.",
  },
  "tx-origin": {
    title: "Authorization uses tx.origin",
    why: "A malicious contract the owner calls can act as the owner; use msg.sender.",
  },
  "missing-zero-check": {
    title: "Address not checked for zero",
    why: "Passing address(0) can burn funds or lock out the owner.",
  },
  "controlled-delegatecall": {
    title: "Caller controls a delegatecall",
    why: "Arbitrary code runs with this contract's storage and balance.",
  },
  "delegatecall-loop": {
    title: "delegatecall inside a payable loop",
    why: "msg.value is reused on every iteration, so callers spend ETH they never sent.",
  },
  "uninitialized-state": {
    title: "State variable never initialized",
    why: "It is read while still zero, which is likely not the intended value.",
  },
  "uninitialized-storage": {
    title: "Uninitialized storage pointer",
    why: "It points at slot 0, so writes through it overwrite unrelated state.",
  },
  "weak-prng": {
    title: "Predictable randomness",
    why: "Block values can be predicted or influenced by validators and callers.",
  },
  "divide-before-multiply": {
    title: "Division before multiplication",
    why: "Integer division truncates first, so the result loses precision.",
  },
  "incorrect-equality": {
    title: "Strict equality on a balance or amount",
    why: "Anyone can force-send ETH or tokens so that == never holds.",
  },
  "locked-ether": {
    title: "ETH can get locked",
    why: "The contract accepts ETH but has no way to send it out.",
  },
  "shadowing-state": {
    title: "State variable shadowed",
    why: "A child contract redeclares a parent variable, so each side uses its own copy.",
  },
  timestamp: {
    title: "Logic depends on block.timestamp",
    why: "Validators can nudge the timestamp; avoid it for critical comparisons.",
  },
};

export function explain(check: string): Explanation | undefined {
  return Object.hasOwn(EXPLANATIONS, check) ? EXPLANATIONS[check] : undefined;
}

/**
 * Link to a detector's section of the Slither wiki, using the anchor of the
 * `wiki_url` Slither reports for it. Returns undefined when there is no anchor.
 */
export function slitherWikiUrl(wikiUrl: string | undefined): string | undefined {
  const anchor = wikiUrl?.split("#")[1]?.trim().toLowerCase();
  return anchor ? `${WIKI_BASE}#${anchor}` : undefined;
}

/**
 * First "Contract.function" referenced in a Slither description, without its
 * parameter list. Returns undefined when the description names no function.
 */
export function extractFunction(description: string): string | undefined {
  const firstLine = description.split(/\r?\n/)[0] ?? "";
  const match = /\b([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)\(/.exec(firstLine);
  return match ? `${match[1]}.${match[2]}` : undefined;
}

export function truncate(text: string, max = MAX_TEXT_LENGTH): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Turn a raw Slither description into one short readable line: first line
 * only, without "(path#lines)" groups or dangling ":" / "on" / "by" endings.
 */
export function cleanDescription(description: string): string {
  const firstLine = description.trim().split(/\r?\n/)[0] ?? "";
  const cleaned = firstLine
    .replace(/\s*\([^()]*#\d+(?:-\d+)?\)/g, "")
    .replace(/\s+/g, " ")
    .replace(/(?:\s*:|(?:^|\s+)(?:on|by))+\s*$/i, "")
    .trim();
  return truncate(cleaned);
}
