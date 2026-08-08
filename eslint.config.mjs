import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
    "mobile/**",
    "scripts/scraping/.venv/**",
    // Gitignored local scratch file (see .gitignore) — not part of the shipped codebase, and
    // it fails to parse (binary) when a stale copy is present on a dev machine.
    "matcher-old.ts",
  ]),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "react/no-unescaped-entities": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      // React Compiler-only advisories, not correctness bugs: `Date.now()`/`new Date()` inside a
      // render-path helper or useMemo (relative "time ago" labels, expiry countdowns) is a
      // deliberate, common pattern — the compiler flags it as non-deterministic for memoization
      // purposes, but there is no actual memoization-correctness issue in these call sites today.
      "react-hooks/purity": "warn",
      // Likewise advisory: flags a manual useCallback/useMemo the compiler can't safely
      // auto-optimize. The manual memoization still works correctly; this only affects whether
      // the (not yet enabled) React Compiler can further optimize it.
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
]);

export default eslintConfig;
