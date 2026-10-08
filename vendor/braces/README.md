# Temporary braces security patch

These sources are copied from MIT-licensed `micromatch/braces@3.0.3`, with its
license retained. The local npm workspace and override install this package for
the `braces` dependency used by the development linting/glob toolchain. Its version
`3.0.4-travelmate.1` identifies this private fork; it is not an upstream release.

[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) has no
published patched version as of 6 October 2026. `index.js` now guards all public
recursive walker entry points, and guards strings before parsing. The iterative
guard limits nesting to 64, limits input/AST size, rejects cycles, and cannot be
disabled through options. Ordinary brace alternatives and ranges retain the
upstream implementation. Very deeply nested literal patterns are also rejected.

`tests/braces-security.test.ts` exercises the installed override, normal glob
behavior, deeply nested strings, supplied ASTs, and cycles. Replace this override
with an audited upstream patch when one is available, then rerun these tests and
ESLint. A clean npm audit after substitution does not certify this local patch;
the regression tests and retained patch are the evidence for this mitigation.
