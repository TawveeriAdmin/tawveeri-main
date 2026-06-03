'use client';

import { useState } from 'react';
import Link from 'next/link';

// ─── البيانات ───────────────────────────────────────────
const CATEGORIES = [
  { emoji: '📱', label: 'الجوالات',  slug: 'smartphone' },
  { emoji: '❄️', label: 'التكييف',  slug: 'appliance'   },
  { emoji: '💻', label: 'اللابتوب', slug: 'laptop'      },
  { emoji: '📺', label: 'التلفاز',  slug: 'tv'          },
  { emoji: '🎧', label: 'الصوتيات', slug: 'audio'       },
  { emoji: '🍳', label: 'المطبخ',   slug: 'kitchen'     },
  { emoji: '🌀', label: 'الغسيل',   slug: 'appliance'   },
  { emoji: '🏷️', label: 'العروض',   slug: 'deals'       },
];

const STATS = [
  { n: '+٨٥,٠٠٠', l: 'منتج مقارن'  },
  { n: '٨',        l: 'متجر موثوق'  },
  { n: '+٦٢,٠٠٠', l: 'فرصة توفير'  },
];

const CHIPS = [
  'ابي آيفون ١٦',
  'مكيف لغرفة ٢٠م',
  'لابتوب للدراسة ٢٥٠٠',
  'سماعات تحت ٥٠٠',
];

const PARTNERS = [
  { emoji: '🛒', name: 'أمازون', bg: '#f0f7ff' },
  { emoji: '🌙', name: 'نون',    bg: '#fff0f5' },
  { emoji: '🏪', name: 'المنيع', bg: '#f0fff4' },
  { emoji: '⚡', name: 'اكسترا', bg: '#fff8f0' },
  { emoji: '📚', name: 'جرير',   bg: '#f5f0ff' },
];

// ─── CSS ────────────────────────────────────────────────
const CSS = `
  @keyframes taw-glow {
    0%,100% { box-shadow: 0 4px 20px rgba(85,178,149,.15); }
    50%      { box-shadow: 0 4px 32px rgba(85,178,149,.35); }
  }
  @keyframes taw-dot {
    0%,100% { opacity:1; transform:scale(1); }
    50%      { opacity:.4; transform:scale(1.5); }
  }
  @keyframes taw-fadeUp {
    from { opacity:0; transform:translateY(10px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes taw-slide {
    from { transform:translateY(100%); }
    to   { transform:translateY(0); }
  }
  .taw-glow    { animation: taw-glow 3s ease-in-out infinite; }
  .taw-dot     { animation: taw-dot  2s ease-in-out infinite; }
  .taw-fadeUp  { animation: taw-fadeUp .3s ease both; }
  .taw-slide   { animation: taw-slide .3s cubic-bezier(.16,1,.3,1) both; }
`;

// ─── COMPONENT ──────────────────────────────────────────
interface HomePageContentProps {
  locale: string;
}

export function HomePageContent({ locale }: HomePageContentProps) {
  const [waffarOpen,  setWaffarOpen]  = useState(false);
  const [waffarQuery, setWaffarQuery] = useState('');
  const isRTL = locale === 'ar';

  const handleWaffarSearch = () => {
    if (!waffarQuery.trim()) return;
    window.location.href = `/${locale}/search?q=${encodeURIComponent(waffarQuery.trim())}`;
  };

  return (
    <>
      <style>{CSS}</style>

      <div style={{ maxWidth: 860, margin: '0 auto' }}>

        {/* ══════════════════════════════════════
            ① STATS — أرقام كاملة بدون "ك"
        ══════════════════════════════════════ */}
        <div style={{
          display: 'flex', gap: 10, marginBottom: 20,
          padding: '0 4px',
        }}>
          {STATS.map(s => (
            <div key={s.l} style={{
              flex: 1, background: 'var(--color-surface)',
              borderRadius: 14, padding: '14px 10px',
              textAlign: 'center',
              border: '1px solid var(--color-outline-variant)',
              boxShadow: '0 2px 8px rgba(0,0,0,.04)',
            }}>
              <div style={{
                fontSize: 20, fontWeight: 900,
                color: 'var(--brand-green)',
                lineHeight: 1, marginBottom: 4,
              }}>{s.n}</div>
              <div style={{
                fontSize: 11, color: 'var(--color-on-surface-variant)',
                fontWeight: 600,
              }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* ══════════════════════════════════════
            ② CATEGORIES — مباشرة وواضحة
        ══════════════════════════════════════ */}
        <section style={{ marginBottom: 20 }}>
          <p style={{
            fontSize: 12, fontWeight: 800,
            color: 'var(--color-on-surface-variant)',
            marginBottom: 10,
          }}>تسوّق حسب الفئة</p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 8,
          }}>
            {CATEGORIES.map(c => (
              <Link
                key={c.slug + c.label}
                href={`/${locale}/search?category=${c.slug}`}
                style={{
                  background: 'var(--color-surface)',
                  borderRadius: 14,
                  padding: '12px 6px 10px',
                  textAlign: 'center',
                  border: '1px solid var(--color-outline-variant)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  textDecoration: 'none',
                  transition: 'all .15s',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--brand-green)';
                  e.currentTarget.style.background = 'var(--brand-bg-green)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--color-outline-variant)';
                  e.currentTarget.style.background = 'var(--color-surface)';
                }}
              >
                <span style={{ fontSize: 22, marginBottom: 4 }}>{c.emoji}</span>
                <span style={{
                  fontSize: 10, fontWeight: 800,
                  color: 'var(--color-on-surface)',
                  lineHeight: 1.3,
                }}>{c.label}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* ══════════════════════════════════════
            ③ وفّر AI — كارت أبيض + حد أخضر
            فوق البانر — نية المستخدم = بحث
        ══════════════════════════════════════ */}
        <section style={{
          background: 'var(--color-surface)',
          borderRadius: 20,
          border: '2px solid var(--brand-green)',
          padding: '18px 18px',
          marginBottom: 14,
          boxShadow: '0 6px 24px rgba(85,178,149,.12)',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Glow bg */}
          <div style={{
            position: 'absolute', top: -24, right: -24,
            width: 100, height: 100,
            background: 'radial-gradient(circle,rgba(85,178,149,.07) 0%,transparent 70%)',
            borderRadius: '50%', pointerEvents: 'none',
          }} />

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{
              width: 42, height: 42,
              background: 'linear-gradient(135deg, var(--brand-green), #3a7a66)',
              borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 19, flexShrink: 0,
              boxShadow: '0 4px 14px rgba(85,178,149,.32)',
            }}>✨</div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 15, fontWeight: 900,
                color: 'var(--color-on-surface)',
              }}>وفّر — مساعدك الذكي</div>
              <div style={{
                fontSize: 11,
                color: 'var(--color-on-surface-variant)',
                marginTop: 2,
              }}>يقارن لك ٨ متاجر في ثوانٍ</div>
            </div>
            {/* Live dot */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 11, fontWeight: 700,
              color: 'var(--brand-green)',
            }}>
              <span className="taw-dot" style={{
                width: 8, height: 8,
                background: '#4ade80',
                borderRadius: '50%',
                display: 'inline-block',
              }} />
              متاح
            </div>
          </div>

          {/* Input row */}
          <div style={{
            background: 'var(--brand-bg-green)',
            borderRadius: 12,
            border: '1px solid rgba(85,178,149,.2)',
            padding: '10px 14px',
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
            gap: 10,
          }}>
            <button
              onClick={handleWaffarSearch}
              style={{
                background: 'var(--brand-green)', color: '#fff',
                border: 'none', borderRadius: 9,
                padding: '6px 14px', fontSize: 12, fontWeight: 800,
                cursor: 'pointer', flexShrink: 0,
                boxShadow: '0 3px 10px rgba(85,178,149,.3)',
              }}
            >
              {isRTL ? 'اسأل ←' : 'Ask →'}
            </button>
            <input
              type="text"
              value={waffarQuery}
              onChange={e => setWaffarQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleWaffarSearch()}
              placeholder={isRTL ? 'مثلاً: "ابي مكيف لغرفة ٢٠ متر"' : 'e.g. "I need an AC for 20m room"'}
              style={{
                flex: 1, border: 'none', background: 'transparent',
                fontSize: 12, color: 'var(--color-on-surface)',
                textAlign: isRTL ? 'right' : 'left',
                fontFamily: 'inherit', outline: 'none',
              }}
            />
          </div>

          {/* Quick chips */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CHIPS.map(chip => (
              <button
                key={chip}
                onClick={() => {
                  setWaffarQuery(chip);
                  window.location.href = `/${locale}/search?q=${encodeURIComponent(chip)}`;
                }}
                style={{
                  background: 'var(--brand-bg-green)',
                  border: '1px solid rgba(85,178,149,.25)',
                  borderRadius: 50, padding: '5px 12px',
                  fontSize: 10, fontWeight: 700,
                  color: 'var(--brand-green-dark)',
                  cursor: 'pointer', transition: 'all .15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'var(--brand-green)';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'var(--brand-bg-green)';
                  e.currentTarget.style.color = 'var(--brand-green-dark)';
                }}
              >{chip}</button>
            ))}
          </div>
        </section>

        {/* ══════════════════════════════════════
            ④ FINANCIAL STRIP — مساحة إعلانية
        ══════════════════════════════════════ */}
        <div style={{
          background: '#fdf6e0',
          borderRadius: 13, padding: '10px 16px', marginBottom: 14,
          border: '1px solid rgba(226,187,78,.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#7a6010' }}>
            💳 قسّط بدون فائدة مع
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { l: 'Tamara', c: '#00b69f' },
              { l: 'Tabby',  c: '#8b5cf6' },
              { l: '+ بنوك', c: '#1d6fb5' },
            ].map(b => (
              <span key={b.l} style={{
                background: '#fff', borderRadius: 7,
                padding: '3px 9px', fontSize: 10,
                fontWeight: 900, color: b.c,
              }}>{b.l}</span>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════
            ⑤ DEAL BANNER — ديناميكي
        ══════════════════════════════════════ */}
        <Link
          href={`/${locale}/deals`}
          style={{
            display: 'block',
            background: 'linear-gradient(135deg, var(--brand-green) 0%, #3a7a66 100%)',
            borderRadius: 18, padding: '16px 20px', marginBottom: 14,
            color: '#fff', textDecoration: 'none',
            position: 'relative', overflow: 'hidden',
          }}
        >
          <div style={{
            position: 'absolute', left: 16, top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 48, opacity: .18, pointerEvents: 'none',
          }}>🔥</div>
          <span style={{
            background: '#E2BB4E', color: '#0f1923',
            borderRadius: 7, padding: '3px 10px',
            fontSize: 10, fontWeight: 900,
            display: 'inline-block', marginBottom: 6,
          }}>🔥 عروض اليوم</span>
          <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 3 }}>
            المنيع — تنزيلات تصل ٥٩٪
          </div>
          <div style={{ fontSize: 12, opacity: .85 }}>
            أجهزة غسيل وتكييف — محدود
          </div>
        </Link>

        {/* ══════════════════════════════════════
            ⑥ TRUSTED PARTNERS
        ══════════════════════════════════════ */}
        <div style={{
          background: 'var(--color-surface)',
          borderRadius: 16, padding: '14px 16px', marginBottom: 14,
          border: '1px solid var(--color-outline-variant)',
        }}>
          <p style={{
            fontSize: 10, fontWeight: 800,
            color: 'var(--color-on-surface-variant)',
            textAlign: 'center', marginBottom: 12,
            textTransform: 'uppercase', letterSpacing: .5,
          }}>متاجرنا الموثوقة</p>
          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
            {PARTNERS.map(p => (
              <div key={p.name} style={{ textAlign: 'center' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: p.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 17, margin: '0 auto 4px',
                }}>{p.emoji}</div>
                <div style={{
                  fontSize: 9, fontWeight: 700,
                  color: 'var(--color-on-surface-variant)',
                }}>{p.name}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </>
  );
}
