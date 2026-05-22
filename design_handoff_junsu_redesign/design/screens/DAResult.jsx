// ─── DA · 진단 결과 ───
const DAResult = () => {
  const BLUE = '#3182F6'; const BLUE_TINT = '#EAF3FF';
  const INK = '#191F28'; const SUB = '#4E5968'; const MUTE = '#8B95A1';
  const LINE = '#F2F4F6'; const BG = '#F9FAFB';

  const areas = [
    { l:'완전성', v: 96, g:'A', color:'#0F8B47', desc:'필수값 누락 적음' },
    { l:'일관성', v: 88, g:'B', color:'#3182F6', desc:'일부 공백 데이터' },
    { l:'정확성', v: 91, g:'A', color:'#0F8B47', desc:'특수문자 일부' },
    { l:'유용성', v: 72, g:'C', color:'#D97706', desc:'테스트 데이터 다수' },
    { l:'유일성', v: 98, g:'A+', color:'#0F8B47', desc:'중복 거의 없음' },
    { l:'유효성', v: 84, g:'B', color:'#3182F6', desc:'날짜 형식 오류' },
  ];

  const issues = [
    { sev:'high', table:'TB_MEMBER', col:'EMAIL', area:'완전성', cnt:'1,248', rate:'1.0%', desc:'NULL 또는 공백 이메일' },
    { sev:'med',  table:'TB_CREDIT_EVAL', col:'EVAL_DT', area:'유효성', cnt:'342', rate:'0.07%', desc:'잘못된 날짜 형식 (YYYYMMDD 아님)' },
    { sev:'high', table:'TB_MEMBER', col:'PHONE', area:'정확성', cnt:'2,104', rate:'1.7%', desc:'전화번호에 특수문자/한글 포함' },
    { sev:'low',  table:'TB_CODE', col:'CODE_NM', area:'유용성', cnt:'48', rate:'4.0%', desc:'"테스트", "삭제예정" 등 더미 값' },
    { sev:'med',  table:'TB_EVAL_HIST', col:'SCORE', area:'유효성', cnt:'820', rate:'0.04%', desc:'음수 또는 범위 외 점수' },
  ];

  return (
    <div style={{ width:'100%', height:'100%', background: BG, fontFamily:"'Pretendard', system-ui, sans-serif", color: INK, display:'flex', flexDirection:'column' }}>
      <header style={{ height: 64, background:'#fff', borderBottom:`1px solid ${LINE}`, display:'flex', alignItems:'center', padding:'0 24px', gap: 24 }}>
        <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: BLUE, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight: 900, fontSize: 15 }}>j</div>
          <span style={{ fontWeight: 800, fontSize: 16 }}>junsu</span>
        </div>
        <div style={{ marginLeft: 16, fontSize: 13, color: SUB, fontWeight: 600 }}>
          <span style={{ color: MUTE }}>DA</span> <span style={{ color: MUTE }}>›</span> 진단 결과
        </div>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap: 8 }}>
          <button style={{ height: 40, padding:'0 16px', borderRadius: 999, background:'#fff', color: SUB, border:`1px solid ${LINE}`, fontSize: 13, fontWeight: 700, cursor:'pointer' }}>↓ Excel 보고서</button>
          <button style={{ height: 40, padding:'0 16px', borderRadius: 999, background: BLUE, color:'#fff', border:'none', fontSize: 13, fontWeight: 800, cursor:'pointer' }}>📄 PDF 출력</button>
        </div>
      </header>

      <div style={{ flex: 1, overflow:'auto', padding:'28px 32px 40px' }}>
        <div style={{ maxWidth: 1280, margin:'0 auto' }}>
          <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom: 20 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing:'-0.03em' }}>진단 결과</h1>
              <p style={{ margin:'8px 0 0', fontSize: 14, color: SUB, fontWeight: 500 }}>
                JUNSUDB · 48개 테이블 · 2026.05.17 09:42 진단 완료
              </p>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: MUTE, fontWeight: 600 }}>다른 진단:</span>
              <span style={{ height: 32, padding:'0 12px', borderRadius: 8, background:'#fff', border:`1px solid ${LINE}`, display:'flex', alignItems:'center', fontSize: 12, fontWeight: 700, color: INK }}>
                2026.05.17 09:42 <span style={{ color: MUTE, marginLeft: 6 }}>▾</span>
              </span>
            </div>
          </div>

          {/* Top: overall + radar */}
          <div style={{ display:'grid', gridTemplateColumns:'380px 1fr', gap: 16, marginBottom: 16 }}>
            {/* Overall score */}
            <section style={{ background:`linear-gradient(135deg, ${INK} 0%, #2A3340 100%)`, color:'#fff', borderRadius: 16, padding:'24px 28px', position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:-40, right:-40, width: 200, height: 200, borderRadius:'50%', background:'rgba(49,130,246,0.15)' }} />
              <div style={{ position:'relative' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color:'rgba(255,255,255,0.6)', letterSpacing:'0.08em', marginBottom: 12 }}>종합 품질 점수</div>
                <div style={{ display:'flex', alignItems:'baseline', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 64, fontWeight: 800, letterSpacing:'-0.04em', lineHeight: 1 }}>88.2</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color:'rgba(255,255,255,0.6)' }}>/ 100</span>
                </div>
                <div style={{ display:'inline-flex', alignItems:'center', gap: 8, padding:'5px 14px', borderRadius: 999, background:'rgba(15,139,71,0.25)', color:'#5DE08A', fontSize: 14, fontWeight: 800, marginTop: 8 }}>
                  등급 B+ · 우수
                </div>
                <div style={{ marginTop: 18, paddingTop: 14, borderTop:'1px solid rgba(255,255,255,0.1)', fontSize: 12.5, color:'rgba(255,255,255,0.75)', fontWeight: 500, lineHeight: 1.75 }}>
                  💡 <strong style={{ color:'#fff' }}>AI 코멘트</strong><br />
                  전반적으로 우수한 품질이에요. 유용성(72점)을 개선하면<br />
                  A 등급으로 올라갈 수 있어요. 테스트 데이터 정리부터 시작해보세요.
                </div>
              </div>
            </section>

            {/* Radar areas */}
            <section style={{ background:'#fff', border:`1px solid ${LINE}`, borderRadius: 16, padding:'20px 24px' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: MUTE, letterSpacing:'0.08em', marginBottom: 16 }}>6대 품질 영역</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap: 12 }}>
                {areas.map(a => (
                  <div key={a.l} style={{ background: BG, borderRadius: 12, padding:'14px 16px', border:`1px solid ${LINE}` }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: INK }}>{a.l}</span>
                      <span style={{ fontSize: 11, fontWeight: 800, padding:'3px 9px', borderRadius: 6, background: a.color + '15', color: a.color }}>{a.g}</span>
                    </div>
                    <div style={{ display:'flex', alignItems:'baseline', gap: 4, marginBottom: 8 }}>
                      <span style={{ fontSize: 24, fontWeight: 800, color: INK, letterSpacing:'-0.025em' }}>{a.v}</span>
                      <span style={{ fontSize: 11, color: MUTE, fontWeight: 600 }}>/ 100</span>
                    </div>
                    <div style={{ height: 4, background: LINE, borderRadius: 999, marginBottom: 8 }}>
                      <div style={{ width: `${a.v}%`, height:'100%', background: a.color, borderRadius: 999 }} />
                    </div>
                    <div style={{ fontSize: 11, color: SUB, fontWeight: 500 }}>{a.desc}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Issues table */}
          <section style={{ background:'#fff', border:`1px solid ${LINE}`, borderRadius: 16, overflow:'hidden' }}>
            <div style={{ padding:'18px 22px', borderBottom:`1px solid ${LINE}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, letterSpacing:'-0.02em' }}>
                  발견된 이슈 <span style={{ color: BLUE }}>4,562건</span>
                </div>
                <div style={{ fontSize: 11.5, color: MUTE, fontWeight: 500, marginTop: 4 }}>심각도 순 정렬 · 클릭하면 원본 데이터로 이동해요</div>
              </div>
              <div style={{ display:'flex', gap: 4 }}>
                {[
                  { l:'전체', c: 4562, active: true },
                  { l:'심각', c: 3352, color:'#E53935' },
                  { l:'경고', c: 1162, color:'#D97706' },
                  { l:'정보', c: 48, color:'#0F8B47' },
                ].map(b => (
                  <button key={b.l} style={{ height: 34, padding:'0 14px', borderRadius: 999, background: b.active ? BLUE_TINT : '#fff', color: b.active ? BLUE : SUB, border: b.active ? 'none' : `1px solid ${LINE}`, fontSize: 12.5, fontWeight: 700, cursor:'pointer' }}>
                    {b.color && <span style={{ display:'inline-block', width: 6, height: 6, borderRadius:'50%', background: b.color, marginRight: 6, verticalAlign:'middle' }} />}
                    {b.l} {b.c.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            <table style={{ width:'100%', borderCollapse:'collapse', fontSize: 13 }}>
              <thead style={{ background: BG }}>
                <tr>
                  {['심각도','테이블','컬럼','영역','오류 건수','비율','내용','액션'].map((h, i) => (
                    <th key={h} style={{ padding:'12px 16px', fontSize: 11, fontWeight: 800, color: SUB, textAlign: i === 6 ? 'left' : 'center', letterSpacing:'-0.01em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {issues.map((r, i) => (
                  <tr key={i} style={{ borderTop:`1px solid ${LINE}` }}>
                    <td style={{ padding:'14px 16px', textAlign:'center' }}>
                      <span style={{ display:'inline-flex', alignItems:'center', gap: 5, padding:'3px 10px', borderRadius: 999, background: r.sev==='high' ? '#FFEBEB' : r.sev==='med' ? '#FFF3D6' : '#E7F8EF', color: r.sev==='high' ? '#E53935' : r.sev==='med' ? '#B26A00' : '#0F8B47', fontSize: 11, fontWeight: 800 }}>
                        <span style={{ width: 5, height: 5, borderRadius:'50%', background: r.sev==='high' ? '#E53935' : r.sev==='med' ? '#D97706' : '#0F8B47' }} />
                        {r.sev === 'high' ? '심각' : r.sev === 'med' ? '경고' : '정보'}
                      </span>
                    </td>
                    <td style={{ padding:'14px 16px', textAlign:'center', fontSize: 12.5, color: INK, fontFamily:'SF Mono, monospace', fontWeight: 700 }}>{r.table}</td>
                    <td style={{ padding:'14px 16px', textAlign:'center', fontSize: 12.5, color: SUB, fontFamily:'SF Mono, monospace', fontWeight: 600 }}>{r.col}</td>
                    <td style={{ padding:'14px 16px', textAlign:'center' }}>
                      <span style={{ fontSize: 11, padding:'2px 9px', borderRadius: 6, background: BLUE_TINT, color: BLUE, fontWeight: 700 }}>{r.area}</span>
                    </td>
                    <td style={{ padding:'14px 16px', textAlign:'center', fontSize: 13, color: INK, fontWeight: 800, fontVariantNumeric:'tabular-nums' }}>{r.cnt}</td>
                    <td style={{ padding:'14px 16px', textAlign:'center', fontSize: 12, color: SUB, fontWeight: 600 }}>{r.rate}</td>
                    <td style={{ padding:'14px 16px', fontSize: 13, color: SUB, fontWeight: 500 }}>{r.desc}</td>
                    <td style={{ padding:'14px 16px', textAlign:'center' }}>
                      <button style={{ height: 30, padding:'0 12px', borderRadius: 999, background: BG, color: BLUE, border:'none', fontSize: 11.5, fontWeight: 800, cursor:'pointer' }}>원본 보기 →</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </div>
  );
};
window.DAResult = DAResult;
