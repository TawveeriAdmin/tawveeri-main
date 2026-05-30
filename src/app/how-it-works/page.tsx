export default function HowItWorksPage() {
  const steps = [
    {num:'1', icon:'🔍', title:'ابحث عن المنتج', desc:'اكتب اسم الجهاز في خانة البحث — آيفون، سامسونج، ثلاجة، مكيف. يدعم العربي والإنجليزي.'},
    {num:'2', icon:'📊', title:'قارن الأسعار دفعة واحدة', desc:'نجمع أسعار نفس المنتج من جميع المتاجر في صفحة واحدة مرتّبة من الأرخص للأغلى مع نسبة الخصم.'},
    {num:'3', icon:'🛒', title:'اشترِ من المتجر مباشرة', desc:'اضغط "عرض في المتجر" وستنتقل لصفحة المنتج في المتجر الأصلي. نحن نُرشدك للأرخص فقط.'},
    {num:'✨', icon:'🔔', title:'فعّل تنبيه انخفاض السعر', desc:'حدد السعر المستهدف وسنُرسل لك إشعاراً فور انخفاض السعر لما تريد.'},
  ];
  const stores = ['أمازون SA','نون','جرير','إكسترا','المنيع','الشتاء والصيف','سامسونج SA','شاكر'];
  return (
    <main style={{direction:'rtl', fontFamily:'Cairo, sans-serif',
      background:'#0A0F0D', minHeight:'100vh', color:'#F0F7F4', padding:'40px 24px'}}>
      <div style={{maxWidth:'800px', margin:'0 auto'}}>
        <h1 style={{fontSize:'36px', fontWeight:'900', color:'#55B295', marginBottom:'12px'}}>
          كيف يعمل توفيري؟
        </h1>
        <p style={{fontSize:'16px', color:'#7A9E92', lineHeight:'1.8', marginBottom:'48px'}}>
          ثلاث خطوات فقط تفصلك عن أفضل سعر للمنتج الذي تبحث عنه.
        </p>
        {steps.map((s,i) => (
          <div key={i} style={{display:'flex', gap:'20px', marginBottom:'24px', alignItems:'flex-start'}}>
            <div style={{width:'52px', height:'52px', borderRadius:'50%',
              background:'#162019', border:'2px solid #55B295',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontWeight:'900', fontSize:'18px', color:'#55B295', flexShrink:'0'}}>
              {s.num}
            </div>
            <div style={{background:'#162019', border:'1px solid rgba(85,178,149,0.15)',
              borderRadius:'14px', padding:'20px', flex:'1'}}>
              <div style={{fontSize:'26px', marginBottom:'8px'}}>{s.icon}</div>
              <div style={{fontWeight:'700', fontSize:'16px', marginBottom:'6px'}}>{s.title}</div>
              <div style={{fontSize:'13px', color:'#7A9E92', lineHeight:'1.8'}}>{s.desc}</div>
            </div>
          </div>
        ))}
        <h2 style={{fontSize:'20px', fontWeight:'700', margin:'40px 0 20px'}}>
          المتاجر المربوطة
        </h2>
        <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px', marginBottom:'48px'}}>
          {stores.map(s => (
            <div key={s} style={{background:'#162019', border:'1px solid rgba(85,178,149,0.15)',
              borderRadius:'10px', padding:'12px', textAlign:'center', fontSize:'13px', fontWeight:'600'}}>
              {s}
            </div>
          ))}
        </div>
        <div style={{background:'rgba(85,178,149,0.06)', border:'1px solid rgba(85,178,149,0.2)',
          borderRadius:'20px', padding:'40px', textAlign:'center'}}>
          <h2 style={{fontSize:'22px', fontWeight:'700', marginBottom:'10px'}}>جاهز تبدأ التوفير؟</h2>
          <p style={{fontSize:'14px', color:'#7A9E92', marginBottom:'24px'}}>
            ابحث عن أي منتج الآن وشوف كم ستوفّر.
          </p>
          <a href="/" style={{background:'#55B295', color:'#fff', padding:'12px 32px',
            borderRadius:'10px', textDecoration:'none', fontWeight:'700', fontSize:'15px'}}>
            ابدأ المقارنة ←
          </a>
        </div>
      </div>
    </main>
  );
}

