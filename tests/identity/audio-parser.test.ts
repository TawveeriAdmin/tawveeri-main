// tests/identity/audio-parser.test.ts
// ADR-073 regression gate for the audio parser. Every title below is a real
// Saudi listing observed in production on 2026-07-24 whose comparison v1 dropped
// by failing to read the model line (Arabic Huawei lines, Sony's letter-prefixed
// models, bare-number Soundcore, a JBL suffix that defeated a trailing \b). The
// additions are ordered AFTER the existing branches, so they only rescue lines
// v1 left null — the zero-churn discipline this suite pins down.
import { normalize } from "../../scripts/tps-plugins/audio/parser";
import { buildIdentityKey } from "../../scripts/tps-plugins/audio/identity";

const m = (ar: string, en: string, brand: string | null) => {
  const n = normalize(ar, en, brand, {});
  const id = buildIdentityKey(brand, n.payload, { model_number: n.model_number });
  return { key: id.key, status: id.status, model: (n.payload as Record<string, unknown>).model, type: (n.payload as Record<string, unknown>).type };
};
const identified = (r: { status: string; key: string | null }) => r.status !== "invalid" && !!r.key;

describe("Huawei — FreeClip / FreeArc / FreeBuds SE (Arabic-heavy)", () => {
  it("FreeClip (ear-cuff) reads as earbuds, not a JBL Clip speaker", () => {
    const r = m("", "Huawei FreeClip Earbuds, Bluetooth, USB (Charging), Built-in Microphone, Black", "Huawei");
    expect(r.model).toBe("freeclip");
    expect(r.type).toBe("earbuds");
    expect(r.key).toBe("huawei|freeclip");
  });
  it("FreeClip 2 keeps its generation distinct from FreeClip", () => {
    expect(m("", "HUAWEI FreeClip 2 Earbuds, Bluetooth, USB-C (Charging), Built-in Microphone, Purple", "Huawei").model).toBe("freeclip 2");
  });
  it("FreeArc (open-ear)", () => {
    expect(m("", "Huawei FreeArc Earbuds, Bluetooth, USB-C (Charging), Built-in Microphone, Black", "Huawei").model).toBe("freearc");
  });
  it("FreeBuds SE 3 written Arabic 'فري بودز اس ايه 3'", () => {
    expect(m("هواوي، فري بودز اس ايه 3، سماعات أذن لاسلكية، بيج", "", "Huawei").model).toBe("freebuds se 3");
  });
  it("FreeBuds SE 4 written 'فري بادز SE 4'", () => {
    expect(m("سماعة هواوي TWS فري بادز SE 4 مع خاصية إلغاء الضوضاء النشط (ANC) طراز FUJI-T010", "", "Huawei").model).toBe("freebuds se 4");
  });
});

describe("Sony — letter-prefixed models the digit-only pattern missed", () => {
  it("WH-CH520", () => { expect(m("", "Sony WH-CH520 Wireless Bluetooth On-Ear with Mic for Phone Call, Black", "Sony").model).toBe("wh-ch520"); });
  it("WH-CH720N", () => { expect(m("", "Sony WH-CH720N Noise Cancelling Wireless Headphones", "Sony").model).toBe("wh-ch720n"); });
  it("WI-XB400 (brand read from payload; no 'Sony' in title)", () => { expect(m("", "WI-XB400 Extra Bass Wireless In-Ear Headphones With Mic-Bluetooth Black", "Sony").model).toBe("wi-xb400"); });
  it("INZONE H3", () => { expect(m("", "Sony INZONE H3 Gaming Headset, Active Noise Cancelling, Wired", "Sony").model).toBe("inzone h3"); });
});

describe("other multi-merchant lines", () => {
  it("JBL Tune 730BT — the 'BT' suffix no longer defeats the match", () => {
    expect(m("", "JBL Tune 730BT On-Ear Headphones, Bluetooth, Built-in Microphone, Black", "JBL").model).toBe("tune 730");
  });
  it("Anker Soundcore 2 (bare-number speaker)", () => {
    expect(m("", "Anker Soundcore 2 Portable Bluetooth Speaker with 12W Stereo Sound, BassUp, IPX7 Waterproof", "Anker").model).toBe("soundcore 2");
  });
  it("HyperX Cloud Mini", () => {
    expect(m("", "HyperX Cloud Mini Gaming Headset, Wired, 3.5 mm Connector, Omnidirectional Microphone, Black", "HyperX").model).toBe("cloud mini");
  });
  it("Apple EarPods — connector is identity-relevant", () => {
    expect(m("", "Apple EarPods (USB-C) In-Ear Earphones, Wired, USB-C, Built-in Microphone, White", "Apple").model).toBe("earpods usb-c");
    expect(m("", "Apple EarPods In-Ear Earphones, Wired, Lightning, In-line Microphone, White", "Apple").model).toBe("earpods lightning");
  });
});

describe("zero churn — existing identifications are byte-identical", () => {
  it.each([
    ["Apple AirPods Pro (2nd generation)", "Apple", "apple|airpods pro 2"],
    ["JBL Flip 6 Portable Waterproof Bluetooth Speaker, Blue", "JBL", "jbl|flip 6"],
    ["Sony WH-1000XM5 Wireless Noise Cancelling Headphones, Black", "Sony", "sony|wh-1000xm5"],
    ["Huawei FreeBuds Pro 3 Wireless Earbuds", "Huawei", "huawei|freebuds pro 3"],
    ["JBL Charge 5 Portable Bluetooth Speaker", "JBL", "jbl|charge 5"],
  ])("%s → %s", (title, brand, key) => {
    expect(m("", title, brand).key).toBe(key);
  });
});

describe("precision — no fabricated identity", () => {
  it("bare 'Bose QuietComfort' is NOT identified (would false-merge with QC Earbuds)", () => {
    // Deliberately left unidentified rather than collapse two distinct SKUs.
    expect(identified(m("", "Bose QuietComfort Over-Ear Headphones, Active Noise Cancelling, Bluetooth", "Bose"))).toBe(false);
  });
  it("a generic wired earbud with no line stays unidentified", () => {
    expect(identified(m("جي بي إل ,سماعة أذن سلكية رياضية مقاومة للعرق , أسود", "", "JBL"))).toBe(false);
  });
});
