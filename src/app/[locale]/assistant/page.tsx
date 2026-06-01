'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isTyping?: boolean;
}

const SUGGESTED_PROMPTS = [
  'ابي ارخص ايفون 16 برو ماكس',
  'مكيف لغرفة 25 متر بأقل من 2000',
  'افضل سماعات لاسلكية تحت 500 ريال',
  'ثلاجة عائلية بتقييم عالي',
  'لابتوب للدراسة بأقل من 2500',
  'تلفزيون 65 بوصة بأفضل سعر',
];

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `هلا والله! 👋

أنا **وفّر** — مساعدك الذكي في توفيري 🛍️

أقدر أساعدك تلاقي أفضل سعر لأي جهاز إلكتروني أو منزلي من أكبر 8 متاجر في السعودية.

بس قولي وش تبي، وأنا أدور لك وأقارن! ⚡`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<{ role: string; content: string }[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    setInput('');

    const userMsg: Message = {
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    const typingMsg: Message = {
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isTyping: true,
    };

    setMessages(prev => [...prev, userMsg, typingMsg]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          conversationHistory,
        }),
      });

      const data = await res.json();

      setMessages(prev => {
        const withoutTyping = prev.filter(m => !m.isTyping);
        return [
          ...withoutTyping,
          {
            role: 'assistant' as const,
            content: data.reply || 'عذراً، حدث خطأ. حاول مرة ثانية.',
            timestamp: new Date(),
          },
        ];
      });

      if (data.updatedHistory) {
        setConversationHistory(data.updatedHistory);
      }
    } catch {
      setMessages(prev => {
        const withoutTyping = prev.filter(m => !m.isTyping);
        return [
          ...withoutTyping,
          {
            role: 'assistant' as const,
            content: 'عذراً، ما قدرت أتصل بالخادم. حاول مرة ثانية.',
            timestamp: new Date(),
          },
        ];
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatMessage = (content: string) => {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#55B295;text-decoration:underline;font-weight:600">$1 ↗</a>')
      .replace(/\n/g, '<br/>');
  };

  return (
    <div style={{
      direction: 'rtl',
      fontFamily: 'Cairo, sans-serif',
      background: '#080D0B',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* Background glow */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(85,178,149,0.07) 0%, transparent 70%)',
      }} />

      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(8,13,11,0.95)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(85,178,149,0.12)',
        padding: '0 20px',
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Avatar */}
          <div style={{
            width: '40px', height: '40px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #55B295, #2D6B55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '20px',
            boxShadow: '0 0 0 2px rgba(85,178,149,0.3), 0 0 20px rgba(85,178,149,0.2)',
            position: 'relative',
          }}>
            🤖
            {/* Online indicator */}
            <div style={{
              position: 'absolute', bottom: '1px', left: '1px',
              width: '10px', height: '10px',
              borderRadius: '50%',
              background: '#4ade80',
              border: '2px solid #080D0B',
            }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '15px', color: '#F0F7F4' }}>وفّر</div>
            <div style={{ fontSize: '11px', color: '#55B295', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
              متاح الآن · مساعد توفيري الذكي
            </div>
          </div>
        </div>

        <a href="/" style={{
          color: '#7A9E92', fontSize: '13px', textDecoration: 'none',
          display: 'flex', alignItems: 'center', gap: '4px',
        }}>
          ← الرئيسية
        </a>
      </header>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '20px 16px',
        display: 'flex', flexDirection: 'column', gap: '16px',
        position: 'relative', zIndex: 1,
        maxWidth: '800px', margin: '0 auto', width: '100%',
      }}>

        {messages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex',
            flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
            gap: '10px',
            alignItems: 'flex-end',
          }}>

            {/* Avatar */}
            {msg.role === 'assistant' && (
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #55B295, #2D6B55)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '16px', flexShrink: 0,
                boxShadow: '0 0 12px rgba(85,178,149,0.2)',
              }}>🤖</div>
            )}

            {/* Bubble */}
            <div style={{
              maxWidth: '75%',
              padding: msg.isTyping ? '16px 20px' : '14px 18px',
              borderRadius: msg.role === 'user'
                ? '18px 4px 18px 18px'
                : '4px 18px 18px 18px',
              background: msg.role === 'user'
                ? 'linear-gradient(135deg, #55B295, #3D8468)'
                : '#111C17',
              border: msg.role === 'user'
                ? 'none'
                : '1px solid rgba(85,178,149,0.12)',
              boxShadow: msg.role === 'user'
                ? '0 4px 20px rgba(85,178,149,0.25)'
                : '0 2px 12px rgba(0,0,0,0.3)',
              color: msg.role === 'user' ? '#fff' : '#E8F4F0',
              fontSize: '14px',
              lineHeight: '1.7',
            }}>
              {msg.isTyping ? (
                <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                  {[0, 1, 2].map(j => (
                    <div key={j} style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: '#55B295',
                      animation: `bounce 1.2s ease-in-out ${j * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
              ) : (
                <div dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }} />
              )}

              {!msg.isTyping && (
                <div style={{
                  fontSize: '10px',
                  color: msg.role === 'user' ? 'rgba(255,255,255,0.6)' : '#4A7A68',
                  marginTop: '6px',
                  textAlign: 'left',
                }}>
                  {msg.timestamp.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Suggested prompts — show only at start */}
        {messages.length === 1 && (
          <div style={{ marginTop: '8px' }}>
            <div style={{ fontSize: '12px', color: '#4A7A68', marginBottom: '10px', textAlign: 'center' }}>
              أو اختر من الاقتراحات ⬇️
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '8px',
            }}>
              {SUGGESTED_PROMPTS.map((prompt, i) => (
                <button key={i} onClick={() => sendMessage(prompt)} style={{
                  background: 'rgba(85,178,149,0.06)',
                  border: '1px solid rgba(85,178,149,0.15)',
                  borderRadius: '12px',
                  padding: '10px 12px',
                  fontSize: '13px',
                  color: '#C8E8DC',
                  cursor: 'pointer',
                  textAlign: 'right',
                  fontFamily: 'Cairo, sans-serif',
                  transition: 'all 0.2s',
                  lineHeight: '1.4',
                }}>
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        position: 'sticky', bottom: 0, zIndex: 50,
        background: 'rgba(8,13,11,0.98)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(85,178,149,0.1)',
        padding: '12px 16px 20px',
      }}>
        <div style={{
          maxWidth: '800px', margin: '0 auto',
          display: 'flex', gap: '10px', alignItems: 'flex-end',
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="اكتب طلبك هنا... مثلاً: ابي مكيف لغرفة 25 متر بأقل من 2000"
            disabled={isLoading}
            rows={1}
            style={{
              flex: 1,
              background: '#111C17',
              border: '1px solid rgba(85,178,149,0.2)',
              borderRadius: '16px',
              padding: '12px 16px',
              fontSize: '14px',
              color: '#E8F4F0',
              fontFamily: 'Cairo, sans-serif',
              resize: 'none',
              outline: 'none',
              direction: 'rtl',
              lineHeight: '1.5',
              maxHeight: '120px',
              overflowY: 'auto',
              transition: 'border-color 0.2s',
            }}
            onFocus={e => e.target.style.borderColor = 'rgba(85,178,149,0.5)'}
            onBlur={e => e.target.style.borderColor = 'rgba(85,178,149,0.2)'}
          />
          <button
            onClick={() => sendMessage()}
            disabled={isLoading || !input.trim()}
            style={{
              width: '46px', height: '46px',
              borderRadius: '50%',
              background: input.trim() && !isLoading
                ? 'linear-gradient(135deg, #55B295, #3D8468)'
                : '#1A2820',
              border: 'none',
              cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '20px',
              transition: 'all 0.2s',
              flexShrink: 0,
              boxShadow: input.trim() && !isLoading
                ? '0 4px 16px rgba(85,178,149,0.3)'
                : 'none',
            }}
          >
            {isLoading ? '⏳' : '⬆️'}
          </button>
        </div>
        <div style={{
          textAlign: 'center', fontSize: '11px', color: '#2D4A3E',
          marginTop: '8px', maxWidth: '800px', margin: '8px auto 0',
        }}>
          وفّر مدعوم بـ Claude AI · يقارن من 8 متاجر سعودية
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-8px); }
        }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(85,178,149,0.2); border-radius: 2px; }
      `}</style>
    </div>
  );
}

