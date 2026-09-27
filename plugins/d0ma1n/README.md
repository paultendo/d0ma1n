# d0ma1n skill

A skill for Claude Code, Codex and other agents that read `SKILL.md` files. It finds lookalike domains of a real domain, the kind used in IDN homograph phishing, where letters from other alphabets pass for Latin ones: `paypal.com` spelt with a Cyrillic а, for example.

**lookalike-domains** has the agent ask [d0ma1n](https://d0ma1n.app) for the lookalikes of a domain and explain which ones are registered, live, parked or able to receive email, and who appears to hold them. It can also read a suspicious domain, including an `xn--` form from an email header, back to the real domain it imitates. The agent is told to lead with the lookalikes worth acting on and to give the registrar's abuse contact for a takedown.

## What it runs and contacts

The agent calls two endpoints with the domain you're checking:

- `https://d0ma1n.app/api/scan?domain=…` for the lookalikes of a domain
- `https://d0ma1n.app/api/reverse?domain=…` to read a suspicious domain back

Nothing else is sent, and no key is needed. d0ma1n caches results for an hour and keeps IP addresses in memory only, for rate limiting. Its [terms](https://d0ma1n.app/terms) allow occasional lookups by agents working for a person, within the rate limits.

## Install

In Claude Code:

```bash
claude plugin marketplace add paultendo/skills
claude plugin install d0ma1n@paultendo
```

For Codex or another agent, copy `skills/lookalike-domains` into your agent's skills folder, such as `~/.codex/skills/`.

## Where the data comes from

d0ma1n builds lookalikes from [confusable-vision](https://github.com/paultendo/confusable-vision), which measures 64,751 characters in 322 fonts, through the [namespace-guard](https://github.com/paultendo/namespace-guard) library. addons.mozilla.org checks add-on names for lookalikes with characters from confusable-vision.

## License

MIT, by Paul Wood FRSA ([@paultendo](https://github.com/paultendo)).
