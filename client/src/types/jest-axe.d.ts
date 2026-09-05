// @types/jest-axe supplies the module's own types; this file only augments vitest's
// `expect` with the custom `toHaveNoViolations()` matcher, mirroring what
// `expect.extend(toHaveNoViolations)` registers at runtime in tests/setup.ts.
// The `import type {}` (rather than a bare `declare module`) makes TS treat this as
// an augmentation/merge of vitest's own ambient module instead of replacing it.
import type {} from 'vitest';
import type { AxeResults } from 'jest-axe';

declare module 'vitest' {
  interface Assertion<T = unknown> {
    toHaveNoViolations(): T;
  }
  interface AsymmetricMatchersContaining {
    toHaveNoViolations(): void;
  }
}

// Referenced only to keep the AxeResults import "used" for documentation purposes.
export type { AxeResults };
