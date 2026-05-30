export default function AboutPage() {
  return (
    <main style={{direction:'rtl', fontFamily:'Cairo, sans-serif', 
      background:'#0A0F0D', minHeight:'100vh', color:'#F0F7F4', padding:'40px 24px'}}>
      <div style={{maxWidth:'800px', margin:'0 auto'}}>
        <h1 style={{fontSize:'36px', fontWeight:'900', color:'#55B295', marginBottom:'16px'}}>
          من نحن
        </h1>
        <p style={{fontSize:'16px', color:'#7A9E92', lineHeight:'1.9', marginBottom:'24px'}}>
          توفيري منصة سعودية متخصصة في مقارنة أسعار الإلكترونيات والأجهزة المنزلية 
          من أكبر المتاجر في المملكة — في صفحة واحدة، بنقرة واحدة.
        </p>
        <h2 style={{fontSize:'22px', fontWeight:'700', marginBottom:'12px'}}>قصتنا</h2>
        <p style={{fontSize:'15px', color:'#7A9E92', lineHeight:'1.9', marginBottom:'16px'}}>
          كل واحد منّا مرّ بهذا الموقف — تريد تشتري جهازاً جديداً فتفتح أمازون ثم نون 
          ثم جرير ثم إكسترا وتضيع ساعات في المقارنة. توفيري وُلد من هذه المشكلة.
        </p>
        <p style={{fontSize:'15px', color:'#7A9E92', lineHeight:'1.9', marginBottom:'32px'}}>
          هدفنا واحد: أن تجد أفضل سعر للمنتج الذي تريده دون أن تفتح أكثر من صفحة.
        </p>
        <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'16px', marginBottom:'40px'}}>
          {[
            {icon:'🎯', title:'الشفافية أولاً', desc:'الأرخص أولاً دائماً — لا إعلانات تؤثر على النتائج'},
            {icon:'⚡', title:'تحديث يومي', desc:'أسعار حقيقية ومحدّثة يومياً من جميع المتاجر'},
            {icon:'🇸🇦', title:'محلي بامتياز', desc:'صُمّم للمستهلك السعودي بالمتاجر السعودية'},
          ].map(v => (
            <div key={v.title} style={{background:'#162019', border:'1px solid rgba(85,178,149,0.15)', 
              borderRadius:'12px', padding:'20px'}}>
              <div style={{fontSize:'28px', marginBottom:'8px'}}>{v.icon}</div>
              <div style={{fontWeight:'700', marginBottom:'6px'}}>{v.title}</div>
              <div style={{fontSize:'13px', color:'#7A9E92'}}>{v.desc}</div>
            </div>
          ))}
        </div>
        <div style={{background:'rgba(85,178,149,0.06)', border:'1px solid rgba(85,178,149,0.2)', 
          borderRadius:'16px', padding:'24px', display:'flex', gap:'20px', alignItems:'flex-start'}}>
          <div style={{width:'56px', height:'56px', borderRadius:'50%', 
            background:'linear-gradient(135deg,#55B295,#3D8468)', 
            display:'flex', alignItems:'center', justifyContent:'center', 
            fontSize:'24px', flexShrink:'0'}}>👤</div>
          <div>
            <div style={{fontSize:'11px', color:'#E2BB4E', letterSpacing:'1px', marginBottom:'4px'}}>
              المؤسس والرئيس التنفيذي
            </div>
            <div style={{fontSize:'18px', fontWeight:'700', marginBottom:'8px'}}>محمد عبدالله القريني</div>
            <div style={{fontSize:'13px', color:'#7A9E92', lineHeight:'1.8'}}>
              رائد أعمال سعودي آمن بأن المستهلك السعودي يستحق أداة تساعده على اتخاذ قرار شراء ذكي.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

