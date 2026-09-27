---
name: lookalike-domains
description: Finds lookalike domains of a real domain (IDN homograph and homoglyph domains made with confusable characters) and says which are registered, live, parked or able to receive email, using the free d0ma1n.app API. Use when someone asks whether their brand or domain is being impersonated, wants a list of homoglyph, homograph or punycode lookalike domains, is checking a suspicious link or email sender domain (such as paypal.com spelt with a Cyrillic а), or is writing a phishing, typosquatting or brand-protection report. Also reads a suspicious domain back to the real domain it imitates.
license: MIT
---

# Lookalike domains

[d0ma1n](https://d0ma1n.app) builds lookalikes of a domain from measured character similarity ([confusable-vision](https://github.com/paultendo/confusable-vision)), checks which ones exist with DNS and RDAP, and says who appears to hold them. The two endpoints below return JSON and need no key.

## Find lookalikes of a domain

```bash
curl -s -A "your-agent (lookalike-domains skill)" "https://d0ma1n.app/api/scan?domain=example.com&top=20"
```

Options: `top` (default 20, at most 200), `resolve=false` to skip the DNS checks (faster, and cheaper against the rate limit), `threshold` (0 to 1) to drop weak lookalikes.

The response is `{ original, label, tld, totalGenerated, variants: [...] }`, strongest lookalikes first. For each variant:

| Field | Meaning |
|---|---|
| `domain`, `punycode` | the lookalike as a reader sees it, and its `xn--` form |
| `dangerScore` | 0 to 1: how alike it looks overall, measured across fonts |
| `substitutions` | each swapped letter: `original`, `replacement`, `codepoint`, `script`, and its own `danger` |
| `policy.decision` | `allow`, `warn`, `review` or `block`: how risky this lookalike is as a domain |
| `policy.reasons` | the reasons behind the decision, each with a plain `message`; quote these |
| `policy.registrable` | whether a registry would accept it today |
| `policy.surfaces` | per browser, `unicode` means the lookalike is shown as it looks and `punycode` means the browser shows the `xn--` form instead |
| `dns.registered` | whether it exists |
| `dns.threatLevel` | `active` (has a website or mail), `parked` or `unregistered` |
| `dns.hasMx` | it can receive email, so it can be used for phishing replies or fake invoices |
| `dns.holder` | who appears to hold it: the brand itself (`brand-registrar`, `brand-dns`), a brand-protection service (`brand-protection-registrar`), or someone else (`other-registrar`) |
| `dns.rdap` | `since`, `registrar`, `expires` and `abuse`, the address for a takedown request |
| `dns.checked` | `false` means DNS wasn't looked up for this one, so treat it as unknown, not as unregistered |

How to report it to a person:

1. Lead with lookalikes that are registered, held by `other-registrar`, and either `active` or able to receive email (`hasMx`). Those are the ones to act on.
2. Say how each is shown: if `surfaces.firefox` is `unicode`, Firefox users see the lookalike as it looks.
3. Registered lookalikes held by the brand or a brand-protection service are defensive registrations. Mention them as covered.
4. Quote `policy.reasons[].message` rather than the numbers, give `rdap.abuse` as the contact for a takedown, and link the full report at `https://d0ma1n.app/scan/<domain>`.
5. Don't present `dangerScore` as a probability. It says how alike two domains look, not how likely an attack is.

## Read a suspicious domain back

```bash
curl -s -A "your-agent (lookalike-domains skill)" "https://d0ma1n.app/api/reverse?domain=xn--pypal-4ve.com"
```

This returns `{ domain, punycode, impersonates: [{ domain, similarity, substitutions }] }`. It maps each lookalike letter back to the letter it imitates, so it works on any domain, including `xn--` forms from email headers.

`similarity` is how alike the letters look in measured fonts. A low value doesn't mean safe: `paypa1.com` scores 0.05 against `paypal.com` because most fonts draw 1 and l differently, but swapping them is still a common phishing trick. Report the imitated domain and the swapped letters either way.

## Limits

- Each connection gets about six new scans a minute with DNS checks on, or 30 without. Results are cached for an hour, and cached results don't count. On a `429`, wait a minute and try again.
- Scan a domain once per task and reuse the JSON. Don't use the API for bulk scanning; the [terms](https://d0ma1n.app/terms) don't allow scraping at scale.
- Send a `User-Agent` that says what's calling, as in the examples.

To check names in your own code without a network call, such as sign-up handles, use the `lookalike-names-and-text` skill from the namespace-guard plugin.
