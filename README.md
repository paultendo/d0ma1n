# d0ma1n

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Find lookalike domains targeting your brand, before someone else registers them. Inspired by [dnstwist](https://github.com/elceef/dnstwist), built on measured visual similarity instead of static tables.

Try it online at [d0ma1n.app](https://d0ma1n.app) (still going live, use [d0ma1n.paultendo.workers.dev](https://d0ma1n.paultendo.workers.dev) in the meantime), or install the CLI below.

## How it works

d0ma1n takes a domain name, generates every visually confusable variant across 12 Unicode scripts, and checks which ones are already registered. Each substitution is scored by structural similarity (SSIM), so you can focus on the variants that actually look convincing.

```
$ d0ma1n scan paypal.com --resolve

 Threat report for paypal.com
 847 variants analysed, 1 registered, 1 with mail servers

 Registered domains requiring attention:
 Domain             Similarity  Script      Status         Punycode
 pаypal.com         90%         Cyrillic    Active threat  xn--pypal-4ve.com

 Unregistered variants (19):
 Domain             Similarity  Script      Status
 paypaI.com         87%         Latin       Not registered
 pаypаl.com         81%         Cyrillic    Not registered
 ...
```

Domains with MX records are flagged as active threats, since a mail server means someone can receive email at that domain.

This works in every direction. Scan a Cyrillic domain and d0ma1n finds Latin and Greek confusables. Scan a Greek domain and it finds Cyrillic and Latin variants.

## Key features

- **1,397 SSIM-scored confusable pairs** across 12 ICANN-approved IDN scripts, not a static homoglyph list
- **Font-aware scoring** finds the worst-case font for each substitution (74 fonts with high-risk pairs)
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
| `--use-max-danger` | Score with max SSIM instead of p95 | `false` |
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
//   domain: "pаypal.com",
//   dangerScore: 0.90,
//   substitutions: [{ position: 1, original: "a", replacement: "а", script: "Cyrillic" }],
//   bestFont: "Arial",
//   bestFontSsim: 0.9007,
//   punycode: "xn--pypal-4ve.com",
//   dns: { registered: true, hasMx: true, threatLevel: "active" }
// }
```

## Web app

d0ma1n runs as a Cloudflare Worker at [d0ma1n.app](https://d0ma1n.app). The worker imports the core library directly (pure JS, no Node APIs in the hot path) and uses DNS-over-HTTPS for resolution.

Scan results are cached in KV (1 hour TTL) and shareable via URL: `d0ma1n.app/scan/paypal.com`

To run locally:

```bash
cd worker
npx wrangler dev
```

## Where the data comes from

Three open-source projects work together:

1. **[confusable-vision](https://github.com/paultendo/confusable-vision)** renders 230 system fonts and computes SSIM similarity for Unicode character pairs. This produces the scored confusable maps.

2. **[namespace-guard](https://github.com/paultendo/namespace-guard)** ships the maps as runtime data and provides `skeleton()`, `areConfusable()`, and cross-script detection.

3. **d0ma1n** inverts the maps into bidirectional lookup buckets, generates domain variants through k-edit enumeration, scores them, and resolves DNS.

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
