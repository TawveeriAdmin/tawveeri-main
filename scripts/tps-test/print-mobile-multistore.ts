// scripts/tps-test/print-mobile-multistore.ts
// READ ONLY — no DB writes
// run: npx ts-node scripts/tps-test/print-mobile-multistore.ts

import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";
import { mobilePlugin } from "../tps-plugins/mobile";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ACCESSORY_WORDS = [
  "case", "cover", "protector", "charger", "cable", "earphone",
  "screen protector", "كفر", "غطاء", "واقي", "شاحن", "كابل", "سماعة",
];

function isAccessory(title: string): boolean {
  const lower = title.toLowerCase();
  return ACCESSORY_WORDS.some((w) => lower.includes(w));
}

function extractFields(row: any): {
  nameAr: string;
  nameEn: string;
  brand: string;
} {
  const store: string = String(row.store_name ?? "").toLowerCase();
  const payload = row.payload ?? {};

  function safeBrand(raw: any): string {
    if (!raw) return "";
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed[0] ?? "";
      } catch {}
      return raw;
    }
    if (Array.isArray(raw)) return raw[0] ?? "";
    return String(raw);
  }

  if (store.includes("extra") || store.includes("اكسترا") || store.includes("إكسترا")) {
    return {
      nameAr: row.raw_name ?? "",
      nameEn: payload.nameEn ?? payload.name_en ?? "",
      brand:  safeBrand(payload.brandEn ?? payload.brand),
    };
  }

  if (store.includes("almanea") || store.includes("المنيع")) {
    return {
      nameAr: row.raw_name ?? "",
      nameEn: "",
      brand:  safeBrand(payload.brand),
    };
  }

  // افتراضي (Amazon, Noon, Jarir, وغيرها)
  return {
    nameAr: row.raw_name ?? "",
    nameEn: payload.nameEn ?? payload.name_en ?? "",
    brand:  safeBrand(payload.brand ?? payload.brandEn),
  };
}

async function main() {
  const { data, error } = await supabase
    .from("raw_observations")
    .select("id, store_name, raw_name, payload")
    .not("raw_name", "is", null);

  if (error) { console.error("DB error:", error); process.exit(1); }
  if (!data?.length) { console.log("No rows found."); return; }

  const grouped = new Map<
    string,
    { stores: Set<string>; titles: string[] }
  >();

  for (const row of data) {
    const { nameAr, nameEn, brand } = extractFields(row);

    if (!mobilePlugin.detect(nameAr, nameEn)) continue;

    const norm = mobilePlugin.normalize(nameAr, nameEn, brand);
    if (!norm) continue;

    const identity = mobilePlugin.buildIdentityKey(brand, norm.payload, {});
    if (identity.status !== "valid" || !identity.key) continue;

    const identityKey = identity.key;

    if (!grouped.has(identityKey)) {
      grouped.set(identityKey, { stores: new Set(), titles: [] });
    }
    grouped.get(identityKey)!.stores.add(String(row.store_name));
    grouped.get(identityKey)!.titles.push(nameAr || nameEn);
  }

  console.log("\n=== Multi-Store Mobile Matches ===\n");
  let count = 0;

  for (const [key, val] of grouped.entries()) {
    if (val.stores.size < 2) continue;
    count++;

    const hasAccessory = val.titles.some(isAccessory);
    console.log(`KEY    : ${key}${hasAccessory ? "  ⚠️  POSSIBLE ACCESSORY" : ""}`);
    console.log(`STORES : ${[...val.stores].join(" | ")}`);
    console.log(`TITLES :`);
    val.titles.slice(0, 4).forEach((t) => {
      console.log(`  → ${t}${isAccessory(t) ? " ← ⚠️" : ""}`);
    });
    console.log("");
  }

  console.log(`─────────────────────────────`);
  console.log(`Total multi-store matches: ${count}`);
  console.log(`Total rows processed     : ${data.length}`);
}

main();