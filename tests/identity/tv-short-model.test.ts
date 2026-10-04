// TV short manufacturer-model evidence (research prototype, shadow only — nothing in production imports the module).
// Fixtures are FIXED strings copied from the live catalogue on 2026-10-04 (stores: amazon, noon, jarir, extra, almanea …); the
// expectations are the founder's: two different stated models never merge, a code on one side stays Review, agreeing codes
// match, and no technology / size / refresh-rate / retailer-id token is ever taken for a model.
import { composeVerifierModel, declaredShortModel, screenSizeOf, titleShortModel, titleWordRefusal, titleWords, trapClass, norm } from '@/lib/identity/tv-short-model';
import { resolveGroup, modelCodeOfKey } from '../../scripts/tps-core/identity-verifier';

describe('lane D — declared in a structured manufacturer field', () => {
  const title = 'TCL, 85 Inch, MiniLED, AIPQ Pro, 144 Hz';
  it('accepts a short model with a variant word (Extra modelNumber "85C6K PRO")', () => expect(declaredShortModel({ modelNumber: '85C6K PRO' }, title)).toBe('85C6K PRO'));
  it('accepts a plain short model (Extra modelNumber "65S7N")', () => expect(declaredShortModel({ modelNumber: '65S7N' }, 'Hisense, 65 inch')).toBe('65S7N'));
  it('reads mpn and model_number too', () => {
    expect(declaredShortModel({ mpn: '55E8S' }, 'x')).toBe('55E8S');
    expect(declaredShortModel({ model_number: '98C8L' }, 'x')).toBe('98C8L');
  });
  it('NEVER reads the generic `model` field (amazon "85T" truncation, jarir/alnakheelk whole titles, noon fragments)', () => {
    expect(declaredShortModel({ model: '85T' }, 'TCL 85T8D Television 85 Inch')).toBeNull();
    expect(declaredShortModel({ model: '85T8D' }, 'TCL 85T8D Television')).toBeNull();
    expect(declaredShortModel({ model: 'Hisense 65" Smart TV, 4K QLED, 144 Hz, Black, Q71Q' }, 'x')).toBeNull();
  });
  it.each([
    ['amazon ASIN', 'B0H1M7X5R7'], ['noon product code', 'N70206861V'], ['jarir numeric sku', '682058'], ['refresh rate', '144HZ'], ['size', '65INCH'],
    ['technology word', 'QLED'], ['spec only', '4K'], ['free text', 'Smart TV 4K'], ['digits only', '8574'], ['letters only', 'MINILED'],
  ])('refuses %s', (_c, v) => expect(declaredShortModel({ modelNumber: v }, 'some other title')).toBeNull());
  it('refuses a field that merely repeats the title', () => expect(declaredShortModel({ modelNumber: 'TCL 85C6K' }, 'tcl-85c6k')).toBeNull());
});

describe('lane T — size-prefixed short code read from the title (ADR-177 conditions)', () => {
  it.each([
    ['TCL 85T8D Television 85 Inch Smart TV 4K QD-Mini LED Dimming Colorful Quantum Crystal HDR 10+ Gaming Google TV', '85T8D'],
    ['Hisense-65 Inch Mini LED 4K Smart TV,65E8S,8 Years OS Update,Hi-View AI Engine,144Hz', '65E8S'],
    ['Hisense 55 inch 4K Smart TV 144Hz QLED 55E7S PRO,Quantum Dot Colour, HDR10+,HSR', '55E7S PRO'],
    ['TCL Smart TV 85",4K UHD, Smart, QD Mini LED - 85Q6C', '85Q6C'],
    ['Hisense Smart TV 75 Inch 4K UHD QLED, 8 Years OS update AI - 75Q6Q', '75Q6Q'],
  ])('reads the code from "%s"', (title, expected) => expect(titleShortModel(title)).toBe(expected));
  it.each([
    ['technology word welded to the size', 'Hisense 65 Inch QLED TV 65QLED 4K'],
    ['refresh rate', 'Hisense 65 Inch Smart TV 144HZ Game Mode'],
    ['size alone', 'Samsung 55 Inch 4K Smart TV'],
    ['series code WITHOUT a size prefix (Jarir "Q71Q" is not accepted — it stays unknown, never guessed)', 'Hisense 65" Smart TV, 4K QLED, 144 Hz, Black, Q71Q'],
    ['code whose size differs from the listing size', 'TCL 55 Inch 4K Smart TV 85T8D'],
    ['no parsable size at all', 'TCL Television QD Mini LED 85T8D'],
  ])('refuses: %s', (_c, title) => expect(titleShortModel(title)).toBeNull());
  it('a token that is a prefix of a longer token in the same title is a truncation, not a model', () => {
    const w = titleWords('TCL 55 Inch 55C6 55C6K Smart TV');
    expect(titleWordRefusal('55C6', w, 55)).toBe('prefix_of_longer_token');
    expect(titleWordRefusal('55C6K', w, 55)).toBeNull();
  });
  it('parses the screen size from inch / quote / Arabic forms', () => {
    expect(screenSizeOf('TCL 85 Inch')).toBe(85);
    expect(screenSizeOf('TCL Smart TV 85",4K')).toBe(85);
    expect(screenSizeOf('شاشة هايسنس 55 بوصة')).toBe(55);
    expect(screenSizeOf('no size')).toBeNull();
  });
});

describe('trap classes are labelled by rule, independent of the extractors', () => {
  it.each([['B0H1M7X5R7', 'retailer_asin'], ['N70206861V', 'retailer_noon_code'], ['682058', 'retailer_numeric_sku'], ['65INCH', 'size'], ['144HZ', 'refresh_rate'], ['UHD', 'resolution'], ['QLED', 'panel_or_marketing']])(
    '%s → %s', (t, cls) => expect(trapClass(norm(t))).toBe(cls));
  it('a real model is not a trap', () => { expect(trapClass('85T8D')).toBeNull(); expect(trapClass('65S7N')).toBeNull(); });
});

// ── verifier verdicts with the composed model (plugin lane omitted: these listings carry no payload/title model of ≥ 6 chars) ──
type L = { label: string; title: string; payload?: Record<string, unknown> };
const verdicts = (key: string, listings: L[]) =>
  Object.fromEntries(resolveGroup(
    listings.map((l) => { const m = composeVerifierModel(null, l.payload ?? {}, l.title); return { title: l.title, label: l.label, structured: m ? { model: m } : undefined }; }),
    'tv', null, modelCodeOfKey(key)).map((r, i) => [listings[i].label, r.outcome]));

describe('verifier outcomes with the proposed model evidence (the founder\'s named cases)', () => {
  it('TCL 85T8D (Amazon title) vs 85C6K PRO (Extra declared) no longer merge', () => {
    const v = verdicts('tcl|85|4k|mini_led|144', [
      { label: 'amazon', title: 'TCL 85T8D Television 85 Inch Smart TV 4K QD-Mini LED Dimming Colorful Quantum Crystal HDR 10+ Gaming Google TV' },
      { label: 'noon', title: 'Television 85 Inch Smart TV 4K QD-Mini LED Colorful Quantum Crystal HDR 10+ Gaming Google TV, 144Hz Native Refresh Rate' },
      { label: 'extra', title: 'TCL, 85 Inch, MiniLED, AIPQ Pro, 144 Hz', payload: { modelNumber: '85C6K PRO' } },
    ]);
    expect(Object.values(v).every((o) => o === 'match')).toBe(false);
    expect(v.amazon).not.toBe('match');
  });
  it('Hisense Q71Q (Jarir, no extractable code) vs 65S7N (Extra declared): the one-sided listings are Review', () => {
    const v = verdicts('hisense|65|4k|qled|144', [
      { label: 'jarir', title: 'Hisense 65" Smart TV, 4K QLED, 144 Hz, Black, Q71Q' },
      { label: 'amazon', title: 'Hisense 65 Inch Smart TV, QLED, 4K Ultra HD, Dolby Atmos, VIDAA Smart OS, 144HZ, Game Mode, AI Picture' },
      { label: 'extra', title: 'Hisense, 65 inch, QLED 4K Smart TV,144Hz ,8 Years OS update AI', payload: { modelNumber: '65S7N' } },
    ]);
    expect(v.jarir).toBe('review');
    expect(v.amazon).toBe('review');
    expect(v.extra).toBe('match');
  });
  it('two different stated models never both stand (Hisense 58E6Q vs 58A6N)', () => {
    const v = verdicts('hisense|58|4k|led|60', [
      { label: 'amazon', title: 'Hisense 58 inch 4K UHD Smart TV 58E6Q,Dolby Vision,AI 4K Upscaler' },
      { label: 'extra', title: 'Hisense, 58 inch, LED 4K Smart ,Dolby,8 Years OS update AI', payload: { modelNumber: '58A6N' } },
    ]);
    expect(v.amazon).not.toBe('match');
    expect(v.extra).not.toBe('match');
  });
  it('agreeing codes match — the comparison is recovered, not lost (Hisense 55U6Q)', () => {
    const v = verdicts('hisense|55|4k|mini_led|60', [
      { label: 'noon', title: '55 Inch Mini LED QLED 4K Smart TV 55U6Q,Quantum Dot,HSR120Hz' },
      { label: 'extra', title: 'Hisense, 55 inch, Mini LED 4K Smart , 8 Years OS update AI', payload: { modelNumber: '55U6Q' } },
    ]);
    expect(v).toEqual({ noon: 'match', extra: 'match' });
  });
  it('the odd one out is rejected, the agreeing pair stays (TCL 98Q6C ×2 vs declared 98C8L)', () => {
    const v = verdicts('tcl|98|4k|mini_led|144', [
      { label: 'amazon', title: 'TCL 98Q6C Television 98 Inch Smart TV 4K QD-Mini LED Colorful Quantum Crystal HDR 10+' },
      { label: 'noon', title: '98 Inch Smart TV 4K QD-Mini LED Colorful Quantum Crystal HDR 10+ Gaming Google TV 98Q6C' },
      { label: 'extra', title: 'TCL, 98 Inch, MiniLED, AIPQ Pro, Smart TV, HDMI 3, USB1, 144Hz', payload: { modelNumber: '98C8L' } },
    ]);
    expect(v.amazon).toBe('match');
    expect(v.noon).toBe('match');
    expect(v.extra).toBe('reject');
  });
  it('a listing with no model on ANY side is unchanged by the proposal (family key, nothing to contradict)', () => {
    const v = verdicts('tcl|75|4k|led|60', [
      { label: 'a', title: 'TCL 75 Inch UHD 4K Smart TV 60 Hz' },
      { label: 'b', title: 'TCL, 75 Inch, UHD 4K Smart TV, 60 Hz' },
    ]);
    expect(v).toEqual({ a: 'match', b: 'match' });
  });
});
