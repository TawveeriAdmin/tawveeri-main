"use client";

import { useState, useRef } from "react";

const CATEGORIES = [
  { emoji: "📱", label: "الجوالات",  slug: "phones"   },
  { emoji: "❄️", label: "التكييف",  slug: "ac"        },
  { emoji: "💻", label: "اللابتوب", slug: "laptops"   },
  { emoji: "📺", label: "التلفاز",  slug: "tv"        },
  { emoji: "🎧", label: "الصوتيات", slug: "audio"     },
  { emoji: "🍳", label: "المطبخ",   slug: "kitchen"   },
  { emoji: "🌀", label: "الغسيل",   slug: "washing"   },
  { emoji: "🏷️", label: "العروض",   slug: "offers"    },
];

const STORES = ["الكل", "أمازون", "نون", "المنيع", "اكسترا", "جرير"];

const PRODUCTS = [
  { id: "1", emoji: "📱", name: "iPhone 16 128GB",       price: "٣٬٢٩٩", save: "وفّر ١٬٧٠٠ ﷼", disc: "-٣٥٪" },
  { id: "2", emoji: "❄️", name: "مكيف LG ١٨,٠٠٠ وحدة",  price: "١٬٨٩٩", save: "وفّر ١٬٧٥١ ﷼", disc: "-٤٨٪" },
  { id: "3", emoji: "💻", name: "MacBook Air M2",         price: "٤٬١٩٩", save: "وفّر ١٬٢٠٠ ﷼", disc: "-٢٢٪" },
  { id: "4", emoji: "📺", name: 'Samsung 55" QLED 4K',   price: "٢٬٦٩٩", save: "وفّر ١٬٩٠٠ ﷼", disc: "-٤١٪" },
];

const CHIPS = ["ابي آيفون ١٦", "مكيف لغرفة ٢٠م", "لابتوب للدراسة ٢٥٠٠", "سماعات تحت ٥٠٠"];

const PARTNERS = [
  { emoji: "🛒", name: "أمازون", bg: "#f0f7ff" },
  { emoji: "🌙", name: "نون",    bg: "#fff0f5" },
  { emoji: "🏪", name: "المنيع", bg: "#f0fff4" },
  { emoji: "⚡", name: "اكسترا",bg: "#fff8f0" },
  { emoji: "📚", name: "جرير",   bg: "#f5f0ff" },
];

const FOOTER_COLS = [
  { title: "عن توفيري",    links: ["من نحن", "كيف تعمل المنصة", "المدونة"] },
  { title: "تسوّق وقارن", links: ["بحث المنتجات", "العروض", "الكوبونات", "المتاجر", "الفئات"] },
  { title: "المساعدة",     links: ["تواصل معنا", "الأسئلة الشائعة", "الشروط والأحكام", "سياسة الخصوصية"] },
  { title: "تابعنا",       links: ["𝕏 تويتر", "انستقرام", "لينكدإن"] },
];

const NAV_ITEMS = [
  { icon: "🏠", label: "الرئيسية", id: "home"    },
  { icon: "🔍", label: "بحث",      id: "search"  },
  { icon: "✨", label: "وفّر",      id: "waffar"  },
  { icon: "🏷️", label: "عروض",     id: "offers"  },
  { icon: "👤", label: "حسابي",    id: "account" },
];

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
  :root {
    --g:#55B295; --gd:#3a7a66; --gl:#e6f5f0; --gx:#f3fbf8;
    --gold:#E2BB4E; --goldl:#fdf6e0;
    --dark:#0f1923; --dark2:#162230;
    --text:#1a2e3b; --muted:#5a7a8a; --brd:#dde8ec; --red:#e53e3e; --bg:#f0f6f4;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Cairo',sans-serif;background:var(--bg);direction:rtl;-webkit-font-smoothing:antialiased}
  @keyframes glow{0%,100%{box-shadow:0 4px 20px rgba(85,178,149,.15)}50%{box-shadow:0 4px 32px rgba(85,178,149,.35)}}
  @keyframes dot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(1.5)}}
  @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  @keyframes slide{from{transform:translateY(100%)}to{transform:translateY(0)}}
  .glow{animation:glow 3s ease-in-out infinite}
  .dot{animation:dot 2s ease-in-out infinite}
  .fadeUp{animation:fadeUp .3s ease both}
  .slide{animation:slide .3s cubic-bezier(.16,1,.3,1) both}
  input:focus{outline:none}
  button{font-family:'Cairo',sans-serif;cursor:pointer}
  ::-webkit-scrollbar{display:none}
`;

export default function HomePage() {
  const [store,       setStore]       = useState("الكل");
  const [activeNav,   setActiveNav]   = useState("home");
  const [waffarOpen,  setWaffarOpen]  = useState(false);
  const [waffarQuery, setWaffarQuery] = useState("");
  const [searchVal,   setSearchVal]   = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const handleCTA = () => {
    searchRef.current?.focus();
    searchRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <>
      <style>{CSS}</style>
      <div style={{ maxWidth:430, margin:"0 auto", minHeight:"100dvh", background:"var(--bg)", fontFamily:"'Cairo',sans-serif", position:"relative", overflowX:"hidden" }}>

        {/* ① NAV */}
        <nav style={{ position:"sticky", top:0, zIndex:100, background:"rgba(255,255,255,.97)", backdropFilter:"blur(14px)", borderBottom:"1px solid var(--brd)", padding:"10px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", boxShadow:"0 2px 16px rgba(0,0,0,.06)" }}>
          <span style={{ fontSize:22, fontWeight:900, color:"var(--g)", letterSpacing:-0.5 }}>توفيري</span>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <button style={{ width:34, height:34, background:"var(--gl)", border:"none", borderRadius:9, fontSize:15, display:"flex", alignItems:"center", justifyContent:"center", position:"relative" }}>
              🔔
              <span style={{ position:"absolute", top:7, right:7, width:7, height:7, background:"var(--red)", borderRadius:"50%", border:"1.5px solid white" }} />
            </button>
            <button onClick={handleCTA} style={{ background:"var(--g)", color:"#fff", border:"none", borderRadius:9, padding:"7px 14px", fontSize:12, fontWeight:800 }}>
              قارن الآن ←
            </button>
          </div>
        </nav>

        {/* ② SEARCH — واحد فقط */}
        <div style={{ padding:"10px 14px 0" }}>
          <div className="glow" style={{ background:"#fff", borderRadius:14, border:"2px solid var(--g)", display:"flex", alignItems:"center", padding:"10px 14px", gap:9 }}>
            <button style={{ background:"none", border:"none", fontSize:14, color:"var(--muted)" }}>🎙</button>
            <button style={{ background:"none", border:"none", fontSize:13, color:"var(--muted)" }}>⊞</button>
            <input ref={searchRef} type="search" value={searchVal} onChange={e=>setSearchVal(e.target.value)}
              placeholder='ابحث: "آيفون ١٦" أو "مكيف سامسونج"...'
              style={{ flex:1, border:"none", background:"transparent", fontSize:12, color:"var(--text)", textAlign:"right", fontFamily:"'Cairo',sans-serif" }} />
            <span style={{ fontSize:15, color:"var(--g)" }}>🔍</span>
          </div>
        </div>

        {/* ③ STATS — أرقام كاملة */}
        <div style={{ display:"flex", gap:6, padding:"8px 14px 0" }}>
          {[{ n:"+٨٥,٠٠٠", l:"منتج مقارن" }, { n:"٨", l:"متجر موثوق" }, { n:"+٦٢,٠٠٠", l:"فرصة توفير" }].map(s => (
            <div key={s.l} style={{ flex:1, background:"#fff", borderRadius:11, padding:"7px 5px", textAlign:"center", border:"1px solid var(--brd)" }}>
              <div style={{ fontSize:12, fontWeight:900, color:"var(--g)", lineHeight:1 }}>{s.n}</div>
              <div style={{ fontSize:8, color:"var(--muted)", marginTop:3, fontWeight:600 }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* ④ CATEGORIES */}
        <section style={{ padding:"10px 14px 0" }}>
          <p style={{ fontSize:10, fontWeight:800, color:"var(--muted)", marginBottom:7 }}>تسوّق حسب الفئة</p>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:7 }}>
            {CATEGORIES.map(c => (
              <button key={c.slug}
                style={{ background:"#fff", borderRadius:13, padding:"9px 4px 7px", textAlign:"center", border:"1px solid var(--brd)", display:"flex", flexDirection:"column", alignItems:"center", transition:"all .15s" }}
                onMouseEnter={e=>{ e.currentTarget.style.borderColor="var(--g)"; e.currentTarget.style.background="var(--gx)"; }}
                onMouseLeave={e=>{ e.currentTarget.style.borderColor="var(--brd)"; e.currentTarget.style.background="#fff"; }}>
                <span style={{ fontSize:20, marginBottom:3 }}>{c.emoji}</span>
                <span style={{ fontSize:9, fontWeight:800, color:"var(--text)" }}>{c.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* ⑤ وفّر — كارت أبيض + حد أخضر */}
        <section style={{ margin:"10px 14px 0", background:"#fff", borderRadius:18, border:"2px solid var(--g)", padding:"14px 15px", boxShadow:"0 6px 24px rgba(85,178,149,.14)", position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", top:-20, right:-20, width:90, height:90, background:"radial-gradient(circle,rgba(85,178,149,.08) 0%,transparent 70%)", borderRadius:"50%", pointerEvents:"none" }} />
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:11 }}>
            <div style={{ width:38, height:38, background:"linear-gradient(135deg,var(--g),var(--gd))", borderRadius:11, display:"flex", alignItems:"center", justifyContent:"center", fontSize:17, flexShrink:0, boxShadow:"0 4px 12px rgba(85,178,149,.35)" }}>✨</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:900, color:"var(--dark)" }}>وفّر — مساعدك الذكي</div>
              <div style={{ fontSize:10, color:"var(--muted)", marginTop:1 }}>يقارن لك ٨ متاجر في ثوانٍ</div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:4, fontSize:10, fontWeight:700, color:"var(--g)" }}>
              <span className="dot" style={{ width:7, height:7, background:"#4ade80", borderRadius:"50%", display:"inline-block" }} />
              متاح
            </div>
          </div>
          <div style={{ background:"var(--gx)", borderRadius:11, border:"1px solid rgba(85,178,149,.18)", padding:"10px 13px", display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:9 }}>
            <button onClick={()=>setWaffarOpen(true)} style={{ background:"var(--g)", color:"#fff", border:"none", borderRadius:8, padding:"5px 12px", fontSize:11, fontWeight:800, boxShadow:"0 3px 10px rgba(85,178,149,.3)" }}>اسأل ←</button>
            <input type="text" value={waffarQuery} onChange={e=>setWaffarQuery(e.target.value)}
              placeholder='مثلاً: "ابي مكيف لغرفة ٢٠ متر"'
              style={{ flex:1, border:"none", background:"transparent", fontSize:11, color:"var(--muted)", textAlign:"right", fontFamily:"'Cairo',sans-serif", marginRight:8 }} />
          </div>
          <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
            {CHIPS.map(chip => (
              <button key={chip} onClick={()=>{ setWaffarQuery(chip); setWaffarOpen(true); }}
                style={{ background:"var(--gl)", border:"none", borderRadius:50, padding:"4px 10px", fontSize:9, fontWeight:700, color:"var(--gd)", transition:"all .15s" }}
                onMouseEnter={e=>{ e.currentTarget.style.background="var(--g)"; e.currentTarget.style.color="#fff"; }}
                onMouseLeave={e=>{ e.currentTarget.style.background="var(--gl)"; e.currentTarget.style.color="var(--gd)"; }}>
                {chip}
              </button>
            ))}
          </div>
        </section>

        {/* ⑥ FINANCIAL STRIP */}
        <div style={{ margin:"8px 14px 0", background:"var(--goldl)", borderRadius:12, padding:"9px 13px", border:"1px solid rgba(226,187,78,.35)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <span style={{ fontSize:10, fontWeight:700, color:"#7a6010" }}>💳 قسّط بدون فائدة مع</span>
          <div style={{ display:"flex", gap:5 }}>
            {[{ l:"Tamara", c:"#00b69f" }, { l:"Tabby", c:"#8b5cf6" }, { l:"+ بنوك", c:"#1d6fb5" }].map(b => (
              <span key={b.l} style={{ background:"#fff", borderRadius:6, padding:"3px 8px", fontSize:9, fontWeight:900, color:b.c }}>{b.l}</span>
            ))}
          </div>
        </div>

        {/* ⑦ DEAL BANNER */}
        <div style={{ margin:"8px 14px 0", background:"linear-gradient(135deg,var(--g) 0%,var(--gd) 100%)", borderRadius:16, padding:"14px 16px", color:"#fff", position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", fontSize:42, opacity:.2, pointerEvents:"none" }}>🔥</div>
          <span style={{ background:"var(--gold)", color:"var(--dark)", borderRadius:6, padding:"2px 8px", fontSize:9, fontWeight:900, display:"inline-block", marginBottom:5 }}>🔥 عروض اليوم</span>
          <div style={{ fontSize:14, fontWeight:900, marginBottom:2 }}>المنيع — تنزيلات تصل ٥٩٪</div>
          <div style={{ fontSize:11, opacity:.85 }}>أجهزة غسيل وتكييف — محدود</div>
        </div>

        {/* ⑧ STORE FILTER */}
        <div style={{ padding:"8px 14px 0", overflowX:"auto" }}>
          <div style={{ display:"flex", gap:6, width:"max-content" }}>
            {STORES.map(s => (
              <button key={s} onClick={()=>setStore(s)} style={{ background:store===s?"var(--g)":"#fff", border:`1.5px solid ${store===s?"var(--g)":"var(--brd)"}`, color:store===s?"#fff":"var(--text)", borderRadius:50, padding:"5px 13px", fontSize:10, fontWeight:700, whiteSpace:"nowrap", transition:"all .15s" }}>{s}</button>
            ))}
          </div>
        </div>

        {/* ⑨ PRODUCTS */}
        <section style={{ padding:"8px 14px 0" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <span style={{ fontSize:11, fontWeight:800, color:"var(--text)" }}>الأكثر مقارنة اليوم</span>
            <button style={{ fontSize:10, fontWeight:700, color:"var(--g)", background:"none", border:"none" }}>عرض الكل ←</button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            {PRODUCTS.map(p => (
              <div key={p.id}
                style={{ background:"#fff", borderRadius:14, overflow:"hidden", border:"1px solid var(--brd)", cursor:"pointer", transition:"transform .15s,box-shadow .15s" }}
                onMouseEnter={e=>{ e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow="0 8px 24px rgba(0,0,0,.08)"; }}
                onMouseLeave={e=>{ e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow="none"; }}>
                <div style={{ background:"var(--gx)", height:88, display:"flex", alignItems:"center", justifyContent:"center", fontSize:34, position:"relative" }}>
                  {p.emoji}
                  <span style={{ position:"absolute", top:7, right:7, background:"var(--gold)", color:"var(--dark)", borderRadius:5, padding:"2px 6px", fontSize:9, fontWeight:900 }}>{p.disc}</span>
                </div>
                <div style={{ padding:10 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:"var(--dark)", marginBottom:3, lineHeight:1.4 }}>{p.name}</div>
                  <div style={{ fontSize:14, fontWeight:900, color:"var(--g)" }}>{p.price} ﷼</div>
                  <div style={{ fontSize:9, color:"var(--red)", fontWeight:700, marginTop:1 }}>{p.save}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ⑩ PARTNERS */}
        <div style={{ margin:"8px 14px 0", background:"#fff", borderRadius:14, padding:"10px 13px", border:"1px solid var(--brd)" }}>
          <p style={{ fontSize:9, fontWeight:800, color:"var(--muted)", textAlign:"center", marginBottom:8, textTransform:"uppercase", letterSpacing:.5 }}>متاجرنا الموثوقة</p>
          <div style={{ display:"flex", justifyContent:"space-around", alignItems:"center" }}>
            {PARTNERS.map(p => (
              <div key={p.name} style={{ textAlign:"center" }}>
                <div style={{ width:32, height:32, borderRadius:9, background:p.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, margin:"0 auto 3px" }}>{p.emoji}</div>
                <div style={{ fontSize:8, fontWeight:700, color:"var(--muted)" }}>{p.name}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ⑪ FOOTER */}
        <footer style={{ margin:"10px 14px 0", background:"var(--dark)", borderRadius:18, padding:"20px 16px" }}>
          <div style={{ fontSize:20, fontWeight:900, color:"var(--g)", marginBottom:4 }}>توفيري</div>
          <div style={{ fontSize:10, color:"rgba(255,255,255,.3)", marginBottom:18 }}>قارن. وفّر. بذكاء</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:18 }}>
            {FOOTER_COLS.map(col => (
              <div key={col.title}>
                <h4 style={{ fontSize:9, fontWeight:800, color:"var(--gold)", letterSpacing:.8, textTransform:"uppercase", marginBottom:10 }}>{col.title}</h4>
                {col.links.map(link => (
                  <a key={link} href="#"
                    style={{ fontSize:11, color:"rgba(255,255,255,.5)", textDecoration:"none", fontWeight:600, display:"block", marginBottom:7 }}
                    onMouseEnter={e=>(e.currentTarget.style.color="rgba(255,255,255,.85)")}
                    onMouseLeave={e=>(e.currentTarget.style.color="rgba(255,255,255,.5)")}>{link}</a>
                ))}
              </div>
            ))}
          </div>
          <div style={{ borderTop:"1px solid rgba(255,255,255,.07)", paddingTop:12, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontSize:9, color:"rgba(255,255,255,.2)" }}>© ٢٠٢٥ توفيري. جميع الحقوق محفوظة.</span>
            <div style={{ display:"flex", gap:6 }}>
              {["𝕏","📸","in"].map(s => (
                <button key={s} style={{ width:26, height:26, background:"rgba(255,255,255,.07)", border:"none", borderRadius:7, fontSize:11, color:"rgba(255,255,255,.4)", display:"flex", alignItems:"center", justifyContent:"center" }}>{s}</button>
              ))}
            </div>
          </div>
        </footer>

        <div style={{ height:80 }} />

        {/* ⑫ BOTTOM NAV — 👤 الحساب هنا فقط */}
        <nav style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:430, zIndex:200, background:"rgba(255,255,255,.97)", backdropFilter:"blur(12px)", borderTop:"1px solid var(--brd)", display:"flex", padding:"8px 0 16px", boxShadow:"0 -4px 20px rgba(0,0,0,.07)" }}>
          {NAV_ITEMS.map(item => (
            <button key={item.id}
              style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3, fontSize:9, fontWeight:700, color:activeNav===item.id?"var(--g)":"var(--muted)", background:"none", border:"none", transition:"color .15s" }}
              onClick={()=>{ setActiveNav(item.id); if(item.id==="waffar") setWaffarOpen(true); }}>
              <span style={{ fontSize:17, filter:activeNav===item.id?"drop-shadow(0 2px 6px rgba(85,178,149,.5))":"none" }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* وفّر MODAL */}
        {waffarOpen && (
          <div className="fadeUp" style={{ position:"fixed", inset:0, zIndex:300, background:"rgba(15,25,35,.75)", backdropFilter:"blur(6px)", display:"flex", alignItems:"flex-end" }}
            onClick={e=>{ if(e.target===e.currentTarget) setWaffarOpen(false); }}>
            <div className="slide" style={{ width:"100%", maxWidth:430, margin:"0 auto", background:"var(--dark2)", borderRadius:"24px 24px 0 0", padding:"20px 20px 40px" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
                <button onClick={()=>setWaffarOpen(false)} style={{ background:"none", border:"none", color:"rgba(255,255,255,.4)", fontSize:20 }}>✕</button>
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontSize:16, fontWeight:900, color:"#fff" }}>✨ وفّر</div>
                  <div style={{ fontSize:10, color:"rgba(255,255,255,.4)" }}>اسألني وأقارن لك فوراً</div>
                </div>
                <div style={{ width:28 }} />
              </div>
              <div style={{ background:"rgba(255,255,255,.06)", border:"1px solid rgba(255,255,255,.1)", borderRadius:12, padding:"12px 14px", display:"flex", gap:10, alignItems:"center", marginBottom:12 }}>
                <button style={{ background:"var(--g)", color:"#fff", border:"none", borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:800, flexShrink:0 }}>ابحث ←</button>
                <input autoFocus type="text" value={waffarQuery} onChange={e=>setWaffarQuery(e.target.value)}
                  placeholder="مثلاً: ابي مكيف لغرفة ٢٠ متر..."
                  style={{ flex:1, background:"transparent", border:"none", color:"#fff", fontSize:13, textAlign:"right", fontFamily:"'Cairo',sans-serif" }} />
              </div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {CHIPS.map(chip => (
                  <button key={chip} onClick={()=>setWaffarQuery(chip)}
                    style={{ background:"rgba(85,178,149,.15)", border:"1px solid rgba(85,178,149,.25)", borderRadius:50, padding:"5px 11px", fontSize:10, fontWeight:700, color:"var(--g)" }}>{chip}</button>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
