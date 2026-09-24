import { domainToASCII } from "node:url";
import { TLD_ASSUMED_ASCII, TLD_RULES, TLD_RULE_SOURCES, TLD_TABLES } from "./repertoire-data.js";

type Table = { cjk: boolean; ranges: Array<[number, number]> };

const tables = new Map<number, Table>();

function table(id: number): Table {
  let parsed = tables.get(id);
  if (!parsed) {
    const parts = TLD_TABLES[id]!.split(" ").filter(Boolean);
    parsed = {
      cjk: parts[0] === "CJK",
      ranges: parts.filter((p) => p !== "CJK").map((r) => {
        const [a, b] = r.split("..");
        return [parseInt(a!, 16), parseInt(b ?? a!, 16)] as [number, number];
      }),
    };
    tables.set(id, parsed);
  }
  return parsed;
}

const cjk = (cp: number) =>
  (cp >= 0x3400 && cp <= 0x9fff) || (cp >= 0xac00 && cp <= 0xd7af) || (cp >= 0xf900 && cp <= 0xfaff) || cp >= 0x20000;
const ldh = (cp: number) => (cp >= 0x61 && cp <= 0x7a) || (cp >= 0x30 && cp <= 0x39) || cp === 0x2d;

function key(tld: string): string {
  const bare = tld.replace(/^\./, "").toLowerCase();
  // A multi-part suffix (co.uk) takes its registry's rules
  const last = bare.split(".").pop()!;
  return /^[\x00-\x7f]*$/.test(last) ? last : domainToASCII(last) || last;
}

/** What is known about the TLD's second-level rules: its own tables, ASCII only (checked or assumed), or nothing. */
export type RegistryRule =
  | { kind: "tables"; source?: string }
  | { kind: "ascii"; source?: string; assumed?: boolean }
  | { kind: "unknown" };

export function registryRule(tld: string): RegistryRule {
  const k = key(tld);
  const rule = TLD_RULES[k];
  if (rule === undefined) return { kind: "unknown" };
  if (rule === "ascii" && TLD_ASSUMED_ASCII.includes(k)) return { kind: "ascii", assumed: true };
  return { kind: rule === "ascii" ? "ascii" : "tables", source: TLD_RULE_SOURCES[k] };
}

/**
 * Characters of the label that the TLD's registry would not accept, or undefined when its rules are unknown (the
 * script-level profile decides then). Registries take one language or script table per name, so the label must fit
 * one table; when none fits, the characters missing from the closest table are returned. ASCII letters, digits and
 * hyphen are always allowed.
 */
export function outsideRepertoire(label: string, tld: string): string[] | undefined {
  const rule = TLD_RULES[key(tld)];
  if (rule === undefined) return undefined;
  const chars = [...label].filter((ch) => !ldh(ch.codePointAt(0)!));
  if (chars.length === 0) return [];
  if (rule === "ascii") return chars;
  let best: string[] | undefined;
  for (const id of rule) {
    const t = table(id);
    const missing = chars.filter((ch) => {
      const cp = ch.codePointAt(0)!;
      return cjk(cp) ? !t.cjk : !t.ranges.some(([a, b]) => cp >= a && cp <= b);
    });
    if (missing.length === 0) return [];
    if (!best || missing.length < best.length) best = missing;
  }
  return best ?? chars;
}
