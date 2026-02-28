# Contributing

Thanks for helping improve `d0ma1n`.

## Before You Start

- Open an issue before starting non-trivial work so we can discuss the approach.
- Keep runtime dependencies minimal. The core library depends only on `namespace-guard`.
- This tool works across all 12 ICANN-approved IDN scripts. Contributions should respect that design: avoid Latin-centric assumptions.

## Good First Contributions

- New TLD coverage or IDN TLD mappings in `src/tld.ts`
- Output format improvements in `src/format.ts`
- Test coverage for edge cases
- Documentation and examples
- Landing page design improvements in `worker/page.ts`
- Accessibility improvements

## Pull Request Flow

1. Fork the repo and create a branch from `main`.
2. Implement your change with focused scope.
3. Run `npm test` and `npm run typecheck`.
4. Open a PR against `main` with a short summary of what changed and why.

## Project Structure

```
src/           Core library + CLI (npm package)
worker/        Cloudflare Worker (d0ma1n.app)
tests/         Vitest test files
```

The core library (`src/`) is pure JS with no Node-specific APIs (except `src/resolve.ts` which uses `node:dns`). The worker imports core library modules directly.

## Development

```bash
npm install
npm run build
npm test
npm run typecheck
```

To run the worker locally:

```bash
cd worker
npx wrangler dev
```

## Community

This project follows the [Contributor Covenant](./CODE_OF_CONDUCT.md).

Thank you for contributing to `d0ma1n`.

Paul Wood FRSA (@paultendo)
