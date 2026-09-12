# Contributing

Thanks for improving the Spatial Digital Twin Interface. Contributions should make the spatial interaction more measurable, robust, or useful—not merely add visual effects.

## Development workflow

1. Use Node.js 20.19 or newer and install with `npm ci`.
2. Create a focused branch from `main`.
3. Keep provider-independent math and state transitions pure where practical.
4. Add or update tests for behavior changes.
5. Run `npm run check` before opening a pull request.
6. Use a conventional-style commit subject (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, or `chore:`).

Do not commit recordings containing identifiable people, camera frames, secrets, build output, or unlicensed 3D/media assets. Any external asset must include its source, author, exact license, and redistribution terms.

## Camera and hardware changes

Core camera support must continue to use browser standards. Vendor-specific support belongs behind a provider and must have a no-hardware test or recorded fixture. Report the browser, OS, camera label shown by the browser, requested/actual resolution, lighting condition, and whether the issue reproduces in demo mode.

## Pull requests

Describe the user-visible outcome, architecture impact, verification commands, and hardware you actually tested. Separate measured results from expectations. Screenshots are welcome for interface changes but should not expose camera imagery without consent.
