// tests/catalog/canonical-host.test.ts
// ADR-190 — the Railway preview domain is indexed and competes with tawveeri.com.
//
// The dangerous failure here is NOT missing a duplicate. It is marking the REAL site
// `noindex`, which would remove the whole product from search. Every "unknown" case must
// therefore resolve to *canonical*, and the tests below are mostly about that direction.
import { isNonCanonicalHost, canonicalHost, NON_CANONICAL_ROBOTS_TAG } from "../../src/lib/seo/canonical-host";

const withEnv = (value: string | undefined, fn: () => void) => {
  const prev = process.env.NEXT_PUBLIC_APP_URL;
  const prevSite = process.env.NEXT_PUBLIC_SITE_URL;
  if (value === undefined) { delete process.env.NEXT_PUBLIC_APP_URL; delete process.env.NEXT_PUBLIC_SITE_URL; }
  else process.env.NEXT_PUBLIC_APP_URL = value;
  try { fn(); } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_APP_URL; else process.env.NEXT_PUBLIC_APP_URL = prev;
    if (prevSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL; else process.env.NEXT_PUBLIC_SITE_URL = prevSite;
  }
};

describe("the real site is never marked noindex", () => {
  it("treats the canonical host as canonical", () => {
    withEnv("https://tawveeri.com", () => {
      expect(isNonCanonicalHost("tawveeri.com")).toBe(false);
      expect(isNonCanonicalHost("TAWVEERI.COM")).toBe(false);
      expect(isNonCanonicalHost("tawveeri.com:443")).toBe(false);
    });
  });

  it("treats www as the same site, not a duplicate to de-index", () => {
    withEnv("https://tawveeri.com", () => {
      expect(isNonCanonicalHost("www.tawveeri.com")).toBe(false);
    });
  });

  it("says canonical when the env var is missing — never guess the site out of the index", () => {
    withEnv(undefined, () => {
      expect(canonicalHost()).toBeNull();
      expect(isNonCanonicalHost("anything.example.com")).toBe(false);
    });
  });

  it("says canonical when the Host header is absent or empty", () => {
    withEnv("https://tawveeri.com", () => {
      expect(isNonCanonicalHost(null)).toBe(false);
      expect(isNonCanonicalHost(undefined)).toBe(false);
      expect(isNonCanonicalHost("")).toBe(false);
    });
  });

  it("never marks local development", () => {
    withEnv("https://tawveeri.com", () => {
      expect(isNonCanonicalHost("localhost:3000")).toBe(false);
      expect(isNonCanonicalHost("127.0.0.1:3000")).toBe(false);
    });
  });
});

describe("the deployment domain is marked", () => {
  it("marks the Railway preview host — the one actually found in search results", () => {
    withEnv("https://tawveeri.com", () => {
      expect(isNonCanonicalHost("tawveeri-main-production.up.railway.app")).toBe(true);
    });
  });

  it("marks any other host serving the same app", () => {
    withEnv("https://tawveeri.com", () => {
      expect(isNonCanonicalHost("some-preview.vercel.app")).toBe(true);
      expect(isNonCanonicalHost("tawveeri.com.evil.example")).toBe(true);
    });
  });

  it("takes the first host when a proxy sends a list", () => {
    withEnv("https://tawveeri.com", () => {
      expect(isNonCanonicalHost("tawveeri-main-production.up.railway.app, tawveeri.com")).toBe(true);
      expect(isNonCanonicalHost("tawveeri.com, internal")).toBe(false);
    });
  });

  it("tolerates an env var that is a bare host rather than a URL", () => {
    withEnv("tawveeri.com", () => {
      expect(isNonCanonicalHost("tawveeri.com")).toBe(false);
      expect(isNonCanonicalHost("tawveeri-main-production.up.railway.app")).toBe(true);
    });
  });
});

describe("the tag follows links so the signal reaches the real domain", () => {
  it("is noindex but NOT nofollow", () => {
    // Every canonical, sitemap entry and internal href on the preview host points at
    // NEXT_PUBLIC_APP_URL. Following them passes that signal to tawveeri.com rather than
    // stranding it on a host we are de-indexing.
    expect(NON_CANONICAL_ROBOTS_TAG).toContain("noindex");
    expect(NON_CANONICAL_ROBOTS_TAG).toContain("follow");
    expect(NON_CANONICAL_ROBOTS_TAG).not.toContain("nofollow");
  });
});
