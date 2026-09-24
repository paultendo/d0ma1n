const SCRIPT_DETECTORS: Array<[string, RegExp]> = [
  ["Latin", /\p{Script=Latin}/u],
  ["Cyrillic", /\p{Script=Cyrillic}/u],
  ["Greek", /\p{Script=Greek}/u],
  ["Armenian", /\p{Script=Armenian}/u],
  ["Hebrew", /\p{Script=Hebrew}/u],
  ["Arabic", /\p{Script=Arabic}/u],
  ["Devanagari", /\p{Script=Devanagari}/u],
  ["Han", /\p{Script=Han}/u],
  ["Hiragana", /\p{Script=Hiragana}/u],
  ["Katakana", /\p{Script=Katakana}/u],
  ["Hangul", /\p{Script=Hangul}/u],
  ["Georgian", /\p{Script=Georgian}/u],
  ["Thai", /\p{Script=Thai}/u],
];

export function getScript(ch: string): string {
  for (const [name, re] of SCRIPT_DETECTORS) {
    if (re.test(ch)) return name;
  }
  return "Common";
}

export function collectScripts(input: string): string[] {
  const scripts = new Set<string>();

  for (const ch of input) {
    const script = getScript(ch);
    if (script === "Common") continue;
    scripts.add(script);
  }

  return [...scripts].sort((a, b) => a.localeCompare(b));
}
