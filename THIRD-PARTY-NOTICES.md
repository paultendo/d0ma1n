# Third-party notices

d0ma1n includes data derived from third-party sources. The d0ma1n source
code is MIT-licensed (see `LICENSE`). The embedded data retains its original
licence as noted below.

---

## namespace-guard

**Used by:** skeletons, confusable pairs and visual similarity weights
(dependency; bundled into `dist/` and the Worker)

**Source:** https://github.com/paultendo/namespace-guard

**Licence:** MIT. Its embedded data keeps its own licences: Unicode
confusables.txt (Unicode License v3) and confusable-vision similarity
weights (CC-BY-4.0). See namespace-guard's `THIRD-PARTY-NOTICES.md`.

---

## confusable-vision data

**Used by:** `TLD_TABLES`, `TLD_RULES`, `TLD_ASSUMED_ASCII` (in
`src/policy/repertoire-data.ts`), `ASCII_LOOKALIKES` (in `src/ascii-data.ts`)

**Source:** https://github.com/paultendo/confusable-vision
(`data/input/tld-rules.json`, compiled from the IANA IDN tables, the IANA
root zone database and researched country-code registry policies;
`data/output/ascii-sequences.jsonl`)

**Licence:** CC-BY-4.0
https://creativecommons.org/licenses/by/4.0/

**Attribution:** Paul Wood FRSA (@paultendo), confusable-vision.
Reformatted as code point ranges per TLD.

Regenerate: `node scripts/import-tld-rules.mjs`,
`node scripts/import-ascii-lookalikes.mjs`

---

## Unicode Character Database

**Used by:** `IDENTIFIER_ALLOWED` (in `src/policy/identifier-status-data.ts`,
from IdentifierStatus.txt), `UNICODE_BLOCKS` (in `src/blocks-data.ts`, from
Blocks.txt)

**Source:** https://www.unicode.org/Public/

**Licence:** Unicode License v3
https://www.unicode.org/license.txt

> Copyright © 1991-Present Unicode, Inc. All rights reserved.

Regenerate: `node scripts/import-identifier-status.mjs`

---

## Public Suffix List

**Used by:** `MULTI_SUFFIXES`, `WILDCARD_SUFFIXES`, `SUFFIX_EXCEPTIONS` (in
`src/suffix-data.ts`, the ICANN section only)

**Source:** https://publicsuffix.org/list/public_suffix_list.dat

**Licence:** Mozilla Public License 2.0
https://mozilla.org/MPL/2.0/

`src/suffix-data.ts` is a modified form (a subset, reformatted) and remains
under MPL-2.0; the rest of d0ma1n is not.

Regenerate: `node scripts/import-public-suffixes.mjs`
