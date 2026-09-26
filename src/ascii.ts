import { ASCII_LOOKALIKES } from "./ascii-data.js";
import type { RawVariant } from "./generate.js";
import type { Substitution } from "./types.js";

/**
 * ASCII lookalikes: ordinary letters and digits that pass for others, one for one (1 for l, 0 for o) or two for one
 * (rn for m). They are registrable under every TLD and shown as written everywhere, browsers included, which is why
 * most real lookalike domains use them.
 *
 * The pairs and their scores come from confusable-vision's in-place check (release 2026.09.26 on): the ASCII pairs
 * Unicode lists, each set between other letters in five common fonts at text size, at 1x and 2x. A pair's score is the
 * share of those ten renderings where it is alike; 1 for l holds only in Times New Roman, 0 for o only in Georgia, rn
 * for m only in Arial at 1x. d for cl and w for vv do not hold at 16 px.
 */

type Edit = { start: number; len: number; replacement: string; sub: Substitution; font: string };

const cp = (s: string) => [...s].map((c) => "U+" + c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")).join(" ");

/** Every way to swap one stretch of the label for a measured lookalike, both directions (m to rn, and rn to m). */
function edits(label: string): Edit[] {
  const out: Edit[] = [];
  for (const p of ASCII_LOOKALIKES) {
    for (const [from, to] of [[p.a, p.b], [p.b, p.a]] as const) {
      for (let i = label.indexOf(from); i !== -1; i = label.indexOf(from, i + 1)) {
        out.push({
          start: i, len: from.length, replacement: to, font: p.font,
          sub: {
            position: i, original: from, replacement: to, codepoint: cp(to),
            script: /^[0-9]+$/.test(to) ? "Common" : "Latin", block: "Basic Latin",
            danger: p.share, stableDanger: p.share, idnaPvalid: true, measured: true,
          },
        });
      }
    }
  }
  return out.sort((x, y) => y.sub.stableDanger - x.sub.stableDanger);
}

function apply(label: string, chosen: Edit[]): string {
  let s = label;
  for (const e of [...chosen].sort((x, y) => y.start - x.start)) s = s.slice(0, e.start) + e.replacement + s.slice(e.start + e.len);
  return s;
}

/**
 * One-swap and two-swap ASCII variants of a label (g00gle takes two). Two-swap variants pair the most alike swaps
 * only, and never let two swaps overlap. Each variant carries the closest font of its weakest swap.
 */
export function generateAsciiVariants(label: string, options?: { maxEdits?: number; pairFrom?: number }): RawVariant[] {
  const lower = label.toLowerCase();
  if (!/^[a-z0-9-]+$/.test(lower)) return [];
  const all = edits(lower);
  const seen = new Set<string>([lower]);
  const out: RawVariant[] = [];
  const add = (chosen: Edit[]) => {
    const v = apply(lower, chosen);
    if (seen.has(v) || v.startsWith("-") || v.endsWith("-") || v.length > 63) return;
    seen.add(v);
    const weakest = chosen.reduce((w, e) => (e.sub.stableDanger < w.sub.stableDanger ? e : w));
    out.push({ label: v, substitutions: chosen.map((e) => e.sub), ascii: true, bestFont: weakest.font });
  };
  for (const e of all) add([e]);
  if ((options?.maxEdits ?? 2) >= 2) {
    const top = all.slice(0, options?.pairFrom ?? 12);
    for (let i = 0; i < top.length; i++) {
      for (let j = i + 1; j < top.length; j++) {
        const [x, y] = [top[i]!, top[j]!];
        if (x.start < y.start + y.len && y.start < x.start + x.len) continue; // overlapping
        add([x, y]);
      }
    }
  }
  return out;
}
