# Privacy

d0ma1n checks domain names. It doesn't ask for or keep personal data.

- **What it receives:** the domain you ask it to check, and your IP address as part of the request.
- **What it keeps:** scan results are cached for an hour so repeat lookups are fast. IP addresses are held in memory only, to apply the rate limit, and are never written to storage.
- **What it sends:** to check whether lookalike domains exist, it queries public DNS over HTTPS and, where it can change the answer, public RDAP registration records. Those queries contain the lookalike domain names, not anything about you.
- **The skill** for Claude Code, Codex and other agents sends only the domain you're checking to d0ma1n.app's API, and nothing else.

Questions: open an issue at [github.com/paultendo/d0ma1n/issues](https://github.com/paultendo/d0ma1n/issues).
