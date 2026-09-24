import { REPERTOIRES } from "./repertoire-data.js";

const cache = new Map<string, Array<[number, number]>>();

function ranges(tld: string): Array<[number, number]> | undefined {
  const raw = REPERTOIRES[tld];
  if (raw === undefined) return undefined;
  let parsed = cache.get(tld);
  if (!parsed) {
    parsed = raw.split(" ").filter(Boolean).map((r) => {
      const [a, b] = r.split("..");
      return [parseInt(a!, 16), parseInt(b ?? a!, 16)] as [number, number];
    });
    cache.set(tld, parsed);
  }
  return parsed;
}

const cjk = (cp: number) => (cp >= 0x3400 && cp <= 0x9fff) || (cp >= 0xac00 && cp <= 0xd7af) || cp >= 0x20000;

/**
 * Characters of the label that the TLD's registry tables do not list, or undefined when there is no table for the
 * TLD (the script-level profile decides then). ASCII letters, digits and hyphen are always allowed; CJK ideographs
 * and Hangul syllables are left to the profile.
 */
export function outsideRepertoire(label: string, tld: string): string[] | undefined {
  const table = ranges(tld.replace(/^\./, "").toLowerCase());
  if (!table) return undefined;
  const missing: string[] = [];
  for (const ch of label) {
    const cp = ch.codePointAt(0)!;
    if ((cp >= 0x61 && cp <= 0x7a) || (cp >= 0x30 && cp <= 0x39) || cp === 0x2d || cjk(cp)) continue;
    if (!table.some(([a, b]) => cp >= a && cp <= b)) missing.push(ch);
  }
  return missing;
}
