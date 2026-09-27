# d0ma1n

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Find lookalike domains targeting your brand, before someone else registers them. Inspired by [dnstwist](https://github.com/elceef/dnstwist), built on measured visual similarity instead of static tables. The measurements come from [confusable-vision](https://github.com/paultendo/confusable-vision), which [addons.mozilla.org](https://addons.mozilla.org/) also uses to check add-on names ([Mozilla's source](https://github.com/mozilla/addons-server/blob/master/src/olympia/amo/confusables.py#L4-L6)).

Try it online at [d0ma1n.app](https://d0ma1n.app), or install the CLI below.

## How it works

d0ma1n takes a domain name, generates its visually confusable variants, and checks which ones are already registered. Each substitution is weighted by confusable-vision's measurements (release 2026.09.26, through namespace-guard 0.23): the share of text fonts in which the two characters look alike at the same size and on the same baseline, within one font or across fonts.

By default, d0ma1n uses IDN-aware "realistic" mode: substitutions within a script, and labels written wholly in one other script. Each variant is checked against what the TLD's registry actually accepts (see [Registry rules](#registry-rules)), and a label IDNA would refuse or change is never reported. Mixed-script labels, which most registries refuse and browsers show as punycode, are only reported when they turn out to be registered already.

It also applies a policy layer to each candidate variant, so the output is not just "what looks similar" but "what should be blocked, reviewed, warned on, or ignored first". Those policy decisions are resolved from a small set of registry families rather than pretending every TLD needs its own bespoke rule set.

```
$ d0ma1n scan paypal.com --resolve --top 6

d0ma1n scan: paypal.com
72 lookalike labels generated, showing 7 domains

  Domain           Danger  Policy  Display   Edits  Script(s)  Punycode                  Status
  раураӏ.com       40%     block   punycode  6      Cyrillic   xn--80aa0cbo65f.com       ACTIVE
  pаypal.com       88%     block   punycode  1      Cyrillic   xn--pypal-4ve.com         parked
  ραγραι.com       5%      block   unicode   6      Greek      xn--mxaafz0bc.com         parked
  раураӏ.xn--p1ai  40%     block   punycode  6      Cyrillic   xn--80aa0cbo65f.xn--p1ai  ---
  paypaꟾ.com       50%     review  punycode  1      Latin      xn--paypa-x93s.com        ---
  paỵpal.com       45%     review  unicode   1      Latin      xn--papal-yg2b.com        ---
  paỵpaı.com       16%     review  unicode   2      Latin      xn--papa-oza1386b.com     ---
```

Danger is the share of text fonts where the weakest substitution in the label looks alike. The mixed-script pаypal.com is shown because it is already registered, although registries refuse such labels today.

Domains with MX records are flagged as active threats, since a mail server means someone can receive email at that domain.

This works in every direction. Scan a Cyrillic domain and d0ma1n finds Latin and Greek confusables. Scan a Greek domain and it finds Cyrillic and Latin variants.

## Key features

- **Measured confusable pairs** from confusable-vision (2,300 in namespace-guard 0.23), checked at real size, within one font and across fonts, in 322 fonts
- **ASCII lookalikes** (1 for l, 0 for o, rn for m) with the fonts where each is alike, from confusable-vision's in-place check
- **IDN-aware filtering** only generates variants browsers display as Unicode (realistic mode, on by default)
- **Registry-aware:** each variant is checked against the rules of its TLD's registry, for every delegated TLD
- **Policy-aware triage** via `confusable-policy`, so realistic domain threats rise above operational noise
- **DNS resolution** with A, AAAA, MX, and NS records
- **MX threat flagging** for domains that can receive email
- **Reverse lookup** to find what a suspicious domain is impersonating
- **IDNA PVALID filtering** so results only include characters that can actually be registered
- **Export** to JSON and CSV for reporting and integration

## Installation

```bash
git clone https://github.com/paultendo/d0ma1n.git
cd d0ma1n
npm install
npm run build
```

Then run via:

```bash
node dist/cli.js scan yourcompany.com
```

Or link it globally:

```bash
npm link
d0ma1n scan yourcompany.com
```

## Quick start

Usually the most useful thing is to scan with DNS resolution, so you can see which lookalike domains are actually registered:

```bash
d0ma1n scan yourcompany.com --resolve
```

If you want font-specific scoring (visual similarity varies by font), pass the font name:

```bash
d0ma1n scan yourcompany.com --resolve --font Arial
```

To check what a suspicious domain is impersonating:

```bash
d0ma1n reverse xn--pypal-4ve.com
```

To scan multiple domains from a file:

```bash
d0ma1n batch domains.txt --resolve
```

Export results for your security team:

```bash
d0ma1n scan yourcompany.com --resolve --json > report.json
d0ma1n scan yourcompany.com --resolve --csv > report.csv
```

(Replace `d0ma1n` with `node dist/cli.js` if you haven't run `npm link`.)

### Options

| Flag | Description | Default |
|---|---|---|
| `--resolve` | Perform DNS lookups (A, AAAA, MX, NS) | `false` |
| `--json` | Output as JSON | `false` |
| `--csv` | Output as CSV | `false` |
| `--top <n>` | Number of results to show | `20` |
| `--threshold <n>` | Minimum similarity score (0 to 1) | `0` |
| `--max-edits <n>` | Maximum simultaneous substitutions | `2` |
| `--font <name>` | Use font-specific weights | |
| `--use-max-danger` | Score with max danger instead of p95 | `false` |
| `--script-mode <mode>` | `realistic` (IDN-aware) or `all` (no filtering) | `realistic` |
| `--no-policy` | Disable policy triage enrichment | `false` |
| `--policy-profile <id>` | Override policy profile | auto by TLD |
| `--include-non-pvalid` | Include non-IDNA characters | `false` |
| `--tlds <list>` | TLDs to check (comma-separated) | `com,net,org,io` |

## API

```typescript
import { scan, reverseScan, buildPrototypeBuckets } from "d0ma1n";

const result = await scan("paypal.com", {
  resolve: true,
  top: 20,
  font: "Arial",
});

// result.variants[0]:
// {
//   domain: "раураӏ.com",
//   dangerScore: 0.4,
//   policy: { decision: "block", profile: "verisign-com", displayMode: "punycode", ... },
//   substitutions: [{ position: 0, original: "p", replacement: "р", script: "Cyrillic" }, ...],
//   bestFont: "Arial",
//   bestFontScore: 1,
//   punycode: "xn--80aa0cbo65f.com",
//   dns: { registered: true, hasMx: true, threatLevel: "active" }
// }
```

## Web app

d0ma1n runs as a Cloudflare Worker at [d0ma1n.app](https://d0ma1n.app). The worker imports the core library directly (with Cloudflare's Node compatibility for IDNA handling) and uses DNS-over-HTTPS for resolution.

Scan results are cached in KV (1 hour TTL) and shareable via URL: `d0ma1n.app/scan/paypal.com`

To run locally:

```bash
cd worker
npx wrangler dev
```

## Use it from an AI agent

A skill teaches Claude Code, Codex and other agents to check a domain for lookalikes through the web app's API, and to explain what they find:

```bash
claude plugin marketplace add paultendo/skills
claude plugin install d0ma1n@paultendo
```

For Codex or another agent, copy [`plugins/d0ma1n/skills/lookalike-domains`](plugins/d0ma1n/skills/lookalike-domains) into its skills folder.

## Where the data comes from

Four open-source projects work together:

1. **[confusable-vision](https://github.com/paultendo/confusable-vision)** casts rays through font outlines (322 fonts: every font on macOS, plus Roboto, Noto and DejaVu) and measures how alike Unicode characters look at the same size and on the same baseline, within one font and across fonts. This produces the measured confusable pairs.

2. **[namespace-guard](https://github.com/paultendo/namespace-guard)** ships the maps as runtime data and provides `skeleton()`, `areConfusable()`, and cross-script detection.

3. **[confusable-policy](https://github.com/paultendo/confusable-policy)** turns raw confusable findings into environment-aware decisions such as `block`, `review`, `warn`, or `allow`.

4. **d0ma1n** inverts the maps into bidirectional lookup buckets, generates domain variants through k-edit enumeration, scores them, enriches them with policy verdicts, and resolves DNS.

The similarity data comes from confusable-vision release 2026.09.26, which compares every letter and digit each of 322 fonts draws, at the size and baseline position they have in running text, within one font and across fonts. Its lookalikes of ASCII letters are also checked in place: set between other letters in common fonts at text size. d0ma1n uses the pairs that involve an ASCII letter or two scripts to find lookalikes of domains.

The same data is used beyond d0ma1n: by Mozilla's [addons-server](https://github.com/mozilla/addons-server), the code behind [addons.mozilla.org](https://addons.mozilla.org/), in its add-on name checks; by [disarm](https://disarm.dev/) and [SilverSpeak](https://acmcmc.github.io/silverspeak/); and, through namespace-guard, by [agent-sanitizer](https://github.com/AlexanderMattTurner/agent-sanitizer) ([deps.dev](https://deps.dev/npm/namespace-guard/0.20.0/dependents)). See [confusable-vision's Used by](https://github.com/paultendo/confusable-vision#used-by).

## Project structure

```
src/
  reverse-map.ts     Bidirectional confusable lookup (the core data structure)
  generate.ts        k-edit variant enumeration
  score.ts           Scoring with font-specific best-font lookup
  tld.ts             TLD scanning and IDN TLD variants
  resolve.ts         DNS resolution (node:dns)
  reverse-scan.ts    Reverse direction: what does this domain impersonate?
  scan.ts            Composition layer
  format.ts          Output formatters (table, JSON, CSV)
  cli.ts             CLI entry point
  types.ts           Shared types

worker/
  index.ts           Cloudflare Worker fetch handler
  resolve-doh.ts     DNS-over-HTTPS via Cloudflare
  page.ts            Landing page (inline HTML/CSS/JS)
  wrangler.toml      Worker config

tests/               Vitest tests
```

## Responsible use

This tool is for defending your own domains and brands, security research, and gathering evidence for takedown requests. Please don't use it to find domains to register for phishing or impersonation.

The hosted service at [d0ma1n.app](https://d0ma1n.app) is subject to [terms of use](https://d0ma1n.app/terms).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Issues and PRs are welcome. If you've found registered lookalike domains targeting real brands, or have ideas for improving detection, please open an issue.

## License

MIT. See [LICENSE](./LICENSE).

## Contact

Built by [Paul Wood FRSA](https://paultendo.github.io) ([@paultendo](https://github.com/paultendo)). Feedback, bug reports, and ideas are welcome via [GitHub issues](https://github.com/paultendo/d0ma1n/issues).

## Registry rules

Whether a lookalike can be registered depends on the TLD. The rules come from [confusable-vision](https://github.com/paultendo/confusable-vision), which builds them for every delegated TLD (its `scripts/build-tld-rules.py`) so its releases and this scanner judge registrability the same way. In order:

1. Hand-checked corrections with sources (for example, .eu takes only Latin; Cyrillic and Greek names go under .ею and .ευ).
2. The [IANA Repository of IDN Practices](https://www.iana.org/domains/idn-tables): the latest version of every table a registry has lodged. A label must fit one table, because registries take one language or script tag per name.
3. Country-code registries that have not lodged tables, researched from each registry's own policy, with the source and a confidence level for each. Findings resting only on registrar pages are not used.
4. A generic TLD with no lodged tables is ASCII-only, since the ICANN registry agreement lets a registry offer IDNs only once its tables are at IANA.
5. A Latin-named country code whose rules are still unknown is assumed ASCII-only, and results say so. One whose registry says it takes IDNs but publishes no list, and the IDN country codes, are left to the script-level check.

`node scripts/import-tld-rules.mjs` refreshes `src/policy/repertoire-data.ts` from confusable-vision's `data/input/tld-rules.json`.
