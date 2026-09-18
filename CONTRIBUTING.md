# Contributing to mojiyose

Please read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before opening an issue or
pull request.

## Setup

This repository uses [Bun](https://bun.sh). The `engines` field requires
Node.js 18 or later.

```sh
bun install
```

## Checks

```sh
bun run test
bun run lint
bun run typecheck
bun run build
```

`bun run format` rewrites files with Biome.

## Encoding tables

`src/jis0208-table.ts` and `src/jis0212-table.ts` are generated from the WHATWG
index files under `scripts/`. Do not edit the generated modules by hand. After
changing an index file, regenerate with:

```sh
bun run generate:table
```

## Pull requests

Target `main` and fill in the pull request template. Add tests under `test/`
when encoding or decoding behavior changes.

## Security

Report vulnerabilities as described in [SECURITY.md](SECURITY.md). Do not open
a public issue for a security problem.
