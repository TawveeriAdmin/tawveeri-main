'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

const STATS = [
  { n: '+٨٥,٠٠٠', l: 'منتج مقارن' },
  { n: '٨',        l: 'متجر موثوق' },
  { n: '+٦٢,٠٠٠', l: 'فرصة توفير' },
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

const CSS = `
  @keyframes taw-dot {
    0%,100%{opacity:1;transform:scale(1)}
    50%{opacity:.4;transform:scale(1.5)}
  }
  @keyframes taw-bounce {
    0%,80%,100%{transform:scale(0)}
    40%{transform:scale(1)}
  }
  .taw-dot{animation:taw-dot 2s ease-in-out infinite}
  .taw-typing span{
    display:inline-block;width:6px;height:6px;margin:0 2px;
    background:var(--brand-green);border-radius:50%;
    animation:taw-bounce 1.4s ease-in-out infinite;
  }
  .taw-typing span:nth-child(2){animation-delay:.16s}
  .taw-typing span:nth-child(3){animation-delay:.32s}
  .taw-msg{white-space:pre-wrap;line-height:1.6}
  .taw-msg a{color:var(--brand-green);text-decoration:underline}
`;

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface HomePageContentProps {
  locale: string;
}

export function HomePageContent({ locale }: HomePageContentProps) {
  const [input,    setInput]    = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [history,  setHistory]  = useState<Message[]>([]);
  const [open,     setOpen]     = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    setInput('');
    setOpen(true);

    const userMsg: Message = { role: 'user', content: msg };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          conversationHistory: history,
        }),
      });

      const data = await res.json();
      const reply = data.reply || 'عذراً، حدث خطأ. حاول مرة ثانية.';
      const assistantMsg: Message = { role: 'assistant', content: reply };

      setMessages(prev => [...prev, assistantMsg]);
      setHistory(data.updatedHistory || [...history, userMsg, assistantMsg]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'عذراً، ما قدرت أتصل بالخادم. حاول مرة ثانية.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  // تحويل markdown بسيط للروابط والخط العريض
  const renderMarkdown = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid rgba(0,0,0,.08);margin:8px 0">');
  };

  return (
    <>
      <style>{CSS}</style>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>

        {/* ① STATS */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          {STATS.map(s => (
            <div key={s.l} style={{
              flex: 1, background: 'var(--color-surface)',
              borderRadius: 14, padding: '14px 10px', textAlign: 'center',
              border: '1px solid var(--color-outline-variant)',
              boxShadow: '0 2px 8px rgba(0,0,0,.04)',
            }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--brand-green)', lineHeight: 1, marginBottom: 4 }}>{s.n}</div>
              <div style={{ fontSize: 11, color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* ② وفّر AI — شات حقيقي */}
        <section style={{
          background: 'var(--color-surface)', borderRadius: 20,
          border: '2px solid var(--brand-green)', padding: '18px',
          marginBottom: 14,
          boxShadow: '0 6px 24px rgba(85,178,149,.12)',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Glow */}
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
              borderRadius: 12, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 19, flexShrink: 0,
              boxShadow: '0 4px 14px rgba(85,178,149,.32)',
            }}>✨</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--color-on-surface)' }}>
                وفّر — مساعدك الذكي
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-on-surface-variant)', marginTop: 2 }}>
                يقارن لك ٨ متاجر ويعطيك أفضل ٣ أسعار
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: 'var(--brand-green)' }}>
              <span className="taw-dot" style={{ width: 8, height: 8, background: '#4ade80', borderRadius: '50%', display: 'inline-block' }} />
              متاح
            </div>
          </div>

          {/* Chat messages */}
          {open && messages.length > 0 && (
            <div style={{
              background: 'var(--color-surface-container-low, #f8fafb)',
              borderRadius: 14, padding: '12px',
              marginBottom: 10, maxHeight: 340,
              overflowY: 'auto', display: 'flex',
              flexDirection: 'column', gap: 10,
            }}>
              {messages.map((m, i) => (
                <div key={i} style={{
                  display: 'flex',
                  justifyContent: m.role === 'user' ? 'flex-start' : 'flex-end',
                }}>
                  <div style={{
                    maxWidth: '85%',
                    background: m.role === 'user'
                      ? 'var(--brand-bg-green, #e6f5f0)'
                      : 'var(--color-surface, #fff)',
                    border: m.role === 'assistant'
                      ? '1px solid var(--color-outline-variant, #dde8ec)'
                      : 'none',
                    borderRadius: m.role === 'user'
                      ? '14px 14px 14px 4px'
                      : '14px 14px 4px 14px',
                    padding: '10px 13px',
                    fontSize: 13,
                    color: 'var(--color-on-surface)',
                    boxShadow: m.role === 'assistant' ? '0 2px 8px rgba(0,0,0,.05)' : 'none',
                  }}>
                    {m.role === 'assistant' ? (
                      <div
                        className="taw-msg"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }}
                      />
                    ) : (
                      <div className="taw-msg">{m.content}</div>
                    )}
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {loading && (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{
                    background: 'var(--color-surface, #fff)',
                    border: '1px solid var(--color-outline-variant, #dde8ec)',
                    borderRadius: '14px 14px 4px 14px',
                    padding: '12px 16px',
                    boxShadow: '0 2px 8px rgba(0,0,0,.05)',
                  }}>
                    <div className="taw-typing">
                      <span/><span/><span/>
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}

          {/* Input */}
          <div style={{
            background: 'var(--brand-bg-green, #e6f5f0)',
            borderRadius: 12,
            border: '1px solid rgba(85,178,149,.2)',
            padding: '10px 14px',
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: messages.length === 0 ? 10 : 0,
            gap: 10,
          }}>
            <button
              onClick={() => sendMessage()}
              disabled={loading}
              style={{
                background: loading ? '#a0c4b8' : 'var(--brand-green)',
                color: '#fff', border: 'none', borderRadius: 9,
                padding: '6px 14px', fontSize: 12, fontWeight: 800,
                cursor: loading ? 'not-allowed' : 'pointer', flexShrink: 0,
                boxShadow: '0 3px 10px rgba(85,178,149,.3)',
              }}
            >
              {loading ? '...' : 'اسأل ←'}
            </button>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder='مثلاً: "ابي مكيف لغرفة ٢٠ متر"'
              style={{
                flex: 1, border: 'none', background: 'transparent',
                fontSize: 12, color: 'var(--color-on-surface)',
                textAlign: 'right', fontFamily: 'inherit', outline: 'none',
              }}
            />
          </div>

          {/* Quick chips — تظهر فقط قبل أول رسالة */}
          {messages.length === 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {CHIPS.map(chip => (
                <button
                  key={chip}
                  onClick={() => sendMessage(chip)}
                  style={{
                    background: 'var(--brand-bg-green, #e6f5f0)',
                    border: '1px solid rgba(85,178,149,.25)',
                    borderRadius: 50, padding: '5px 12px',
                    fontSize: 10, fontWeight: 700,
                    color: 'var(--brand-green-dark, #3a7a66)',
                    cursor: 'pointer', transition: 'all .15s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'var(--brand-green)';
                    e.currentTarget.style.color = '#fff';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'var(--brand-bg-green, #e6f5f0)';
                    e.currentTarget.style.color = 'var(--brand-green-dark, #3a7a66)';
                  }}
                >{chip}</button>
              ))}
            </div>
          )}
        </section>

        {/* ③ FINANCIAL STRIP */}
        <div style={{
          background: '#fdf6e0', borderRadius: 13,
          padding: '10px 16px', marginBottom: 14,
          border: '1px solid rgba(226,187,78,.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#7a6010' }}>💳 قسّط بدون فائدة مع</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {[{ l: 'Tamara', c: '#00b69f' }, { l: 'Tabby', c: '#8b5cf6' }, { l: '+ بنوك', c: '#1d6fb5' }].map(b => (
              <span key={b.l} style={{
                background: '#fff', borderRadius: 7,
                padding: '3px 9px', fontSize: 10, fontWeight: 900, color: b.c,
              }}>{b.l}</span>
            ))}
          </div>
        </div>

        {/* ④ DEAL BANNER */}
        <Link href={`/${locale}/deals`} style={{
          display: 'block',
          background: 'linear-gradient(135deg, var(--brand-green) 0%, #3a7a66 100%)',
          borderRadius: 18, padding: '16px 20px', marginBottom: 14,
          color: '#fff', textDecoration: 'none',
          position: 'relative', overflow: 'hidden',
        }}>
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

        {/* ⑤ TRUSTED PARTNERS */}
        <div style={{
          background: 'var(--color-surface)', borderRadius: 16,
          padding: '14px 16px', marginBottom: 14,
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
                  background: p.bg, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 17, margin: '0 auto 4px',
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
