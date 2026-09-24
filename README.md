# d0ma1n

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Find lookalike domains targeting your brand, before someone else registers them. Inspired by [dnstwist](https://github.com/elceef/dnstwist), built on measured visual similarity instead of static tables.

Try it online at [d0ma1n.app](https://d0ma1n.app) (still going live, use [d0ma1n.paultendo.workers.dev](https://d0ma1n.paultendo.workers.dev) in the meantime), or install the CLI below.

## How it works

d0ma1n takes a domain name, generates its visually confusable variants, and checks which ones are already registered. Each substitution is weighted by confusable-vision's measurements (release 2026.09.24): the share of text fonts in which the two characters look alike at the same size and on the same baseline, within one font or across fonts.

By default, d0ma1n uses IDN-aware "realistic" mode: substitutions within a script, and labels written wholly in one other script. Each variant is checked against what the registry actually accepts, from the IANA tables for ten TLDs, and a label IDNA would refuse or change is never reported. Mixed-script labels, which most registries refuse and browsers show as punycode, are only reported when they turn out to be registered already.

It also applies a policy layer to each candidate variant, so the output is not just "what looks similar" but "what should be blocked, reviewed, warned on, or ignored first". Those policy decisions are resolved from a small set of registry families rather than pretending every TLD needs its own bespoke rule set.

```
$ d0ma1n scan paypal.com --resolve --top 6

d0ma1n scan: paypal.com
17 lookalike labels generated, showing 6 domains

  Domain          Danger  Policy  Display   Edits  Script(s)  Punycode              Status
  раураӏ.com      35%     block   punycode  6      Cyrillic   xn--80aa0cbo65f.com   ACTIVE
  pаypal.com      81%     block   punycode  1      Cyrillic   xn--pypal-4ve.com     parked
  paypaǀ.com      13%     review  unicode   1      Latin      xn--paypa-9tb.com     parked
  paypaı.com      12%     review  unicode   1      Latin      xn--paypa-r4a.com     parked
  paỵpal.com      39%     review  unicode   1      Latin      xn--papal-yg2b.com    ---
  ꓑꓮꓬꓑꓮꓲ.com      33%     review  unicode   6      Lisu       xn--4l8aa4fhcy.com    ---
```

Danger is the share of text fonts where the weakest substitution in the label looks alike. The mixed-script pаypal.com is shown because it is already registered, although registries refuse such labels today.

Domains with MX records are flagged as active threats, since a mail server means someone can receive email at that domain.

This works in every direction. Scan a Cyrillic domain and d0ma1n finds Latin and Greek confusables. Scan a Greek domain and it finds Cyrillic and Latin variants.

## Key features

- **Measured confusable pairs** from confusable-vision (372 in namespace-guard 0.21), checked at real size and across fonts
- **IDN-aware filtering** only generates variants browsers display as Unicode (realistic mode, on by default)
- **Registry-aware:** each variant is checked against the IANA registry tables for .com, .net, .org, .info, .co, .biz, .xyz, .app, .dev and .jp
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
//   dangerScore: 0.35,
//   policy: { decision: "block", profile: "verisign-com", displayMode: "punycode", ... },
//   substitutions: [{ position: 0, original: "p", replacement: "р", script: "Cyrillic" }, ...],
//   bestFont: "Arial",
//   bestFontScore: 0.9007,
//   punycode: "xn--pypal-4ve.com",
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

## Where the data comes from

Four open-source projects work together:

1. **[confusable-vision](https://github.com/paultendo/confusable-vision)** casts rays through font outlines (every macOS system font, plus Roboto) and measures how alike Unicode characters look at the same size and on the same baseline, within one font and across fonts. This produces the measured confusable pairs.

2. **[namespace-guard](https://github.com/paultendo/namespace-guard)** ships the maps as runtime data and provides `skeleton()`, `areConfusable()`, and cross-script detection.

3. **[confusable-policy](https://github.com/paultendo/confusable-policy)** turns raw confusable findings into environment-aware decisions such as `block`, `review`, `warn`, or `allow`.

4. **d0ma1n** inverts the maps into bidirectional lookup buckets, generates domain variants through k-edit enumeration, scores them, enriches them with policy verdicts, and resolves DNS.

The similarity data covers 12 ICANN-approved IDN scripts: Latin, Cyrillic, Greek, Arabic, Han, Hangul, Katakana, Hiragana, Devanagari, Thai, Georgian, and Armenian. This includes 494 cross-script pairs between non-Latin scripts that traditional homoglyph tables miss entirely.

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
