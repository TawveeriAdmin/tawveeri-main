import { detectCondition } from "../tps-core/condition-detector";

const samples = [
  ["", "Renewed Grade B Apple iPhone 15 Pro, 256 GB, Natural Titanium, 5G"],
  ["", "Apple iPhone 16 Pro Max (256 GB) - Desert Titanium"],
  ["", "Apple iPhone 16 Pro Max, 256GB (Renewed Premium)"],
  ["جوال ايفون 15 برو مجدد درجة أ", ""],
  ["", "Samsung Galaxy S24 Ultra Open Box 512GB"],
  ["", "Refurbished HP Laptop 15"],
];
for (const [ar, en] of samples) {
  const r = detectCondition(ar, en);
  console.log(`${r.condition.padEnd(16)} | ${r.labelAr.padEnd(14)} | "${(en || ar).slice(0, 55)}"`);
}