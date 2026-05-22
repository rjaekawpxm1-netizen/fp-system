// ─── BA · 개발비 산출 ───
const BACost = () => {
  const BLUE = '#3182F6'; const BLUE_TINT = '#EAF3FF';
  const INK = '#191F28'; const SUB = '#4E5968'; const MUTE = '#8B95A1';
  const LINE = '#F2F4F6'; const BG = '#F9FAFB'; const ORANGE = '#D97706';

  const coeffs = [
    { l:'연계 복잡성', sub:'외부 시스템 연계 개수', value:'3~5개 시스템', factor: 1.00, options:['연계없음', '1~2개', '3~5개', '6~10개', '10개초과'] },
    { l:'성능 요구수준', sub:'응답시간/처리량 요구', value:'표준', factor: 1.00, options:['요구없음', '일반', '표준', '중요', '엄격'] },
    { l:'운영환경 호환성', sub:'동일/유사 환경 정도', value:'동일환경', factor: 1.00, options:['요구없음', '동일환경', '유사환경', '이질환경', '이질+훈련'] },
    { l:'보안성', sub:'적용 보안 항목 수', value:'2가지', factor: 1.00, options:['1가지', '2가지', '3가지', '4가지', '5가지+'] },
  ];

  return (
    <div style={{ width:'100%', height:'100%', background: BG, fontFamily:"'Pretendard', system-ui, sans-serif", color: INK, display:'flex', flexDirection:'column' }}>
      <header style={{ height: 64, background:'#fff', borderBottom:`1px solid ${LINE}`, display:'flex', alignItems:'center', padding:'0 24px', gap: 24 }}>
        <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: BLUE, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight: 900, fontSize: 15 }}>j</div>
          <span style={{ fontWeight: 800, fontSize: 16 }}>junsu</span>
        </div>
        <div style={{ marginLeft: 16, fontSize: 13, color: SUB, fontWeight: 600 }}>
          <span style={{ color: MUTE }}>BA</span> <span style={{ color: MUTE }}>›</span> <span style={{ color: MUTE }}>신용평가 시스템</span> <span style={{ color: MUTE }}>›</span> 개발비 산출
        </div>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap: 8 }}>
          <button style={{ height: 40, padding:'0 16px', borderRadius: 999, background:'#0F8B47', color:'#fff', border:'none', fontSize: 13, fontWeight: 800, cursor:'pointer' }}>↓ Excel 출력</button>
        </div>
      </header>

      <div style={{ flex: 1, overflow:'auto', padding:'28px 32px 40px' }}>
        <div style={{ maxWidth: 1280, margin:'0 auto' }}>
          <h1 style={{ margin:'0 0 8px', fontSize: 28, fontWeight: 800, letterSpacing:'-0.03em' }}>개발비 산출</h1>
          <p style={{ margin:'0 0 24px', fontSize: 14, color: SUB, fontWeight: 500, lineHeight: 1.6 }}>
            총 FP에 보정계수를 적용해서 정확한 개발비를 계산해드려요.
          </p>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 380px', gap: 16 }}>
            {/* Left: settings */}
            <div style={{ display:'flex', flexDirection:'column', gap: 14 }}>
              {/* Method + Base */}
              <section style={{ background:'#fff', border:`1px solid ${LINE}`, borderRadius: 16, padding:'20px 24px' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: MUTE, letterSpacing:'0.08em', marginBottom: 14 }}>① 산정 방법 · 기본 단가</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap: 14, marginBottom: 18 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: SUB, marginBottom: 8 }}>산정 방법</div>
                    <div style={{ display:'flex', background: BG, borderRadius: 10, padding: 4 }}>
                      {['정통법','간이법'].map((m,i) => (
                        <button key={m} style={{ flex: 1, height: 36, borderRadius: 8, background: i===0 ? INK : 'transparent', color: i===0 ? '#fff' : SUB, border:'none', fontSize: 13, fontWeight: 800, cursor:'pointer' }}>{m}</button>
                      ))}
                    </div>
                  </div>
                  <NumField label="단가 (원/FP)" value="605,784" />
                  <NumField label="이윤율 (%)" value="10" />
                </div>
                <NumField label="직접경비 (원)" value="0" full />
              </section>

              {/* Coefficients */}
              <section style={{ background:'#fff', border:`1px solid ${LINE}`, borderRadius: 16, padding:'20px 24px' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: MUTE, letterSpacing:'0.08em', marginBottom: 14 }}>② 보정계수 — 프로젝트 특성을 반영해요</div>
                <div style={{ display:'flex', flexDirection:'column', gap: 12 }}>
                  {coeffs.map(c => (
                    <div key={c.l}>
                      <div style={{ display:'flex', alignItems:'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 800, color: INK }}>{c.l}</span>
                        <span style={{ marginLeft: 8, fontSize: 11.5, color: MUTE, fontWeight: 500 }}>{c.sub}</span>
                        <span style={{ marginLeft:'auto', fontSize: 12, fontWeight: 800, color: BLUE }}>× {c.factor.toFixed(2)}</span>
                      </div>
                      <div style={{ display:'flex', gap: 4 }}>
                        {c.options.map((o, i) => (
                          <button key={o} style={{ flex: 1, height: 36, borderRadius: 8, background: o === c.value ? BLUE_TINT : '#fff', color: o === c.value ? BLUE : SUB, border: o === c.value ? 'none' : `1px solid ${LINE}`, fontSize: 11.5, fontWeight: 700, cursor:'pointer' }}>{o}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Reverse calc */}
              <section style={{ background:'#fff', border:`1px solid ${LINE}`, borderRadius: 16, padding:'20px 24px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: MUTE, letterSpacing:'0.08em', marginBottom: 4 }}>③ 예산 역산 (선택)</div>
                    <div style={{ fontSize: 13, color: SUB, fontWeight: 500 }}>예산이 정해져 있다면 필요한 FP를 계산해드려요</div>
                  </div>
                  <button style={{ height: 32, padding:'0 14px', borderRadius: 999, background: ORANGE, color:'#fff', border:'none', fontSize: 12, fontWeight: 800, cursor:'pointer' }}>역산 ON</button>
                </div>
                <div style={{ display:'flex', gap: 8, marginTop: 14 }}>
                  {[5, 10, 20, 30, 50, 70, 100].map(v => (
                    <button key={v} style={{ flex: 1, height: 38, borderRadius: 8, background:'#fff', color: SUB, border:`1px solid ${LINE}`, fontSize: 12, fontWeight: 700, cursor:'pointer' }}>{v}억</button>
                  ))}
                </div>
              </section>
            </div>

            {/* Right: result */}
            <aside style={{ display:'flex', flexDirection:'column', gap: 12, position:'sticky', top: 20, height:'fit-content' }}>
              {/* Total */}
              <div style={{ background: `linear-gradient(135deg, ${INK} 0%, #2A3340 100%)`, color:'#fff', borderRadius: 16, padding:'24px 26px', position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', top:-40, right:-40, width: 200, height: 200, borderRadius:'50%', background:'rgba(49,130,246,0.15)' }} />
                <div style={{ position:'relative' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color:'rgba(255,255,255,0.6)', letterSpacing:'0.08em', marginBottom: 8 }}>총 사업비</div>
                  <div style={{ display:'flex', alignItems:'baseline', gap: 8 }}>
                    <span style={{ fontSize: 44, fontWeight: 800, letterSpacing:'-0.035em' }}>8.26</span>
                    <span style={{ fontSize: 16, fontWeight: 700, color:'rgba(255,255,255,0.7)' }}>억원</span>
                  </div>
                  <div style={{ fontSize: 12, color:'rgba(255,255,255,0.5)', marginTop: 4, fontVariantNumeric:'tabular-nums' }}>826,170,500 원</div>
                  <div style={{ fontSize: 11, color:'rgba(255,255,255,0.7)', marginTop: 14, padding:'8px 12px', background:'rgba(255,255,255,0.08)', borderRadius: 8, fontWeight: 600 }}>
                    부가세 포함 시 약 9.09억원
                  </div>
                </div>
              </div>

              {/* Breakdown */}
              <div style={{ background:'#fff', border:`1px solid ${LINE}`, borderRadius: 14, padding:'18px 20px', display:'flex', flexDirection:'column', gap: 12 }}>
                {[
                  { l:'총 FP', v:'1,240', u:'FP', bold: true },
                  { l:'규모 보정', v:'× 1.0312', u:'', sub: true },
                  { l:'총 보정', v:'× 1.0312', u:'', sub: true, line: true },
                  { l:'개발비 (보정 후)', v:'7.51', u:'억원' },
                  { l:'+ 이윤 10%', v:'0.75', u:'억원', sub: true },
                  { l:'+ 직접경비', v:'0.00', u:'억원', sub: true },
                ].map((r, i) => (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop: r.line ? 8 : 0, borderTop: r.line ? `1px solid ${LINE}` : 'none' }}>
                    <span style={{ fontSize: r.sub ? 12 : 13, fontWeight: r.bold ? 800 : (r.sub ? 600 : 700), color: r.sub ? MUTE : INK }}>{r.l}</span>
                    <span style={{ fontSize: r.bold ? 16 : 13, fontWeight: r.bold ? 800 : 700, color: r.sub ? SUB : INK, fontVariantNumeric:'tabular-nums' }}>
                      {r.v} <span style={{ fontSize: 11, color: MUTE, fontWeight: 600 }}>{r.u}</span>
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ background: BLUE_TINT, borderRadius: 12, padding:'14px 16px', fontSize: 12, color: BLUE, fontWeight: 600, lineHeight: 1.6 }}>
                💡 보정계수를 바꾸면 결과가 실시간으로 반영돼요. 만족스러우면 "Excel 출력"으로 저장하세요.
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
};

const NumField = ({ label, value, full }) => (
  <div style={{ gridColumn: full ? '1 / -1' : 'auto' }}>
    <div style={{ fontSize: 12, fontWeight: 800, color:'#4E5968', marginBottom: 8 }}>{label}</div>
    <div style={{ height: 42, padding:'0 14px', borderRadius: 10, border:'1px solid #F2F4F6', background:'#F9FAFB', display:'flex', alignItems:'center', fontSize: 14, fontWeight: 700, color:'#191F28', fontVariantNumeric:'tabular-nums' }}>{value}</div>
  </div>
);

window.BACost = BACost;
