export default function HowItWorksPage() {
  return (
    <main style={{direction:'rtl',fontFamily:'Cairo,sans-serif',
      background:'#0A0F0D',minHeight:'100vh',color:'#F0F7F4',padding:'40px 24px'}}>
      <div style={{maxWidth:'800px',margin:'0 auto'}}>
        <h1 style={{fontSize:'36px',fontWeight:'900',color:'#55B295',marginBottom:'16px'}}>
          كيف يعمل توفيري؟
        </h1>
        <p style={{fontSize:'16px',color:'#7A9E92',lineHeight:'1.8',marginBottom:'40px'}}>
          ثلاث خطوات فقط تفصلك عن أفضل سعر للمنتج الذي تبحث عنه.
        </p>
        <div style={{marginBottom:'24px',display:'flex',gap:'20px',alignItems:'flex-start'}}>
          <div style={{width:'52px',height:'52px',borderRadius:'50%',background:'#162019',
            border:'2px solid #55B295',display:'flex',alignItems:'center',justifyContent:'center',
            fontWeight:'900',fontSize:'18px',color:'#55B295',flexShrink:'0'}}>1</div>
          <div style={{background:'#162019',border:'1px solid rgba(85,178,149,0.15)',
            borderRadius:'14px',padding:'20px',flex:'1'}}>
            <div style={{fontSize:'26px',marginBottom:'8px'}}>🔍</div>
            <div style={{fontWeight:'700',fontSize:'16px',marginBottom:'6px'}}>ابحث عن المنتج</div>
            <div style={{fontSize:'13px',color:'#7A9E92',lineHeight:'1.8'}}>
              اكتب اسم الجهاز في خانة البحث — آيفون، سامسونج، ثلاجة، مكيف. يدعم العربي والإنجليزي.
            </div>
          </div>
        </div>
        <div style={{marginBottom:'24px',display:'flex',gap:'20px',alignItems:'flex-start'}}>
          <div style={{width:'52px',height:'52px',borderRadius:'50%',background:'#162019',
            border:'2px solid #55B295',display:'flex',alignItems:'center',justifyContent:'center',
            fontWeight:'900',fontSize:'18px',color:'#55B295',flexShrink:'0'}}>2</div>
          <div style={{background:'#162019',border:'1px solid rgba(85,178,149,0.15)',
            borderRadius:'14px',padding:'20px',flex:'1'}}>
            <div style={{fontSize:'26px',marginBottom:'8px'}}>📊</div>
            <div style={{fontWeight:'700',fontSize:'16px',marginBottom:'6px'}}>قارن الأسعار دفعة واحدة</div>
            <div style={{fontSize:'13px',color:'#7A9E92',lineHeight:'1.8'}}>
              نجمع أسعار نفس المنتج من جميع المتاجر في صفحة واحدة مرتّبة من الأرخص للأغلى.
            </div>
          </div>
        </div>
        <div style={{marginBottom:'24px',display:'flex',gap:'20px',alignItems:'flex-start'}}>
          <div style={{width:'52px',height:'52px',borderRadius:'50%',background:'#162019',
            border:'2px solid #55B295',display:'flex',alignItems:'center',justifyContent:'center',
            fontWeight:'900',fontSize:'18px',color:'#55B295',flexShrink:'0'}}>3</div>
          <div style={{background:'#162019',border:'1px solid rgba(85,178,149,0.15)',
            borderRadius:'14px',padding:'20px',flex:'1'}}>
            <div style={{fontSize:'26px',marginBottom:'8px'}}>🛒</div>
            <div style={{fontWeight:'700',fontSize:'16px',marginBottom:'6px'}}>اشترِ من المتجر مباشرة</div>
            <div style={{fontSize:'13px',color:'#7A9E92',lineHeight:'1.8'}}>
              اضغط "عرض في المتجر" وستنتقل لصفحة المنتج في المتجر الأصلي لإتمام الشراء بأمان.
            </div>
          </div>
        </div>
        <div style={{background:'rgba(85,178,149,0.06)',border:'1px solid rgba(85,178,149,0.2)',
          borderRadius:'20px',padding:'40px',textAlign:'center',marginTop:'40px'}}>
          <h2 style={{fontSize:'22px',fontWeight:'700',marginBottom:'10px'}}>جاهز تبدأ التوفير؟</h2>
          <p style={{fontSize:'14px',color:'#7A9E92',marginBottom:'24px'}}>
            ابحث عن أي منتج الآن وشوف كم ستوفّر.
          </p>
          <a href="/" style={{background:'#55B295',color:'#fff',padding:'12px 32px',
            borderRadius:'10px',textDecoration:'none',fontWeight:'700',fontSize:'15px'}}>
            ابدأ المقارنة ←
          </a>
        </div>
      </div>
    </main>
  );
}
