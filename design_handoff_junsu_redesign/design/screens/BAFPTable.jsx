// ─── BA · FP 산정표 탭 ───
const BAFPTable = () => {
  const BLUE = '#3182F6'; const BLUE_TINT = '#EAF3FF';
  const INK = '#191F28'; const SUB = '#4E5968'; const MUTE = '#8B95A1';
  const LINE = '#F2F4F6'; const BG = '#F9FAFB';

  const FP_TYPES = { ILF: '#3182F6', EIF: '#7C3AED', EI: '#0F8B47', EO: '#D97706', EQ: '#E11D48' };
  const CPLX = { low: { bg:'#E7F8EF', fg:'#0F8B47', l:'L' }, medium: { bg:'#FFF3D6', fg:'#B26A00', l:'M' }, high: { bg:'#FFEBEB', fg:'#E53935', l:'H' } };

  const rows = [
    { lv1:'회원관리', lv2:'회원가입', lv3:'회원정보 등록', type:'EI', cplx:'medium', ftr:2, det:12, w:4, reuse:'신규개발', fp:4.0 },
    { lv1:'회원관리', lv2:'로그인', lv3:'아이디/비번 로그인', type:'EI', cplx:'low', ftr:1, det:4, w:3, reuse:'신규개발', fp:3.0 },
    { lv1:'회원관리', lv2:'로그인', lv3:'SNS 로그인', type:'EQ', cplx:'medium', ftr:1, det:6, w:4, reuse:'신규개발', fp:4.0 },
    { lv1:'신용평가', lv2:'평가요청', lv3:'신청서 작성', type:'EI', cplx:'high', ftr:3, det:24, w:6, reuse:'기능변경', fp:3.0 },
    { lv1:'신용평가', lv2:'평가요청', lv3:'신청 제출', type:'EI', cplx:'medium', ftr:2, det:8, w:4, reuse:'신규개발', fp:4.0 },
    { lv1:'신용평가', lv2:'AI평가', lv3:'점수 자동 산정', type:'EO', cplx:'high', ftr:4, det:18, w:7, reuse:'신규개발', fp:7.0 },
    { lv1:'신용평가', lv2:'AI평가', lv3:'평가이력 조회', type:'EQ', cplx:'low', ftr:1, det:6, w:3, reuse:'신규개발', fp:3.0 },
    { lv1:'데이터', lv2:'마스터', lv3:'회원 정보 (ILF)', type:'ILF', cplx:'medium', ftr:2, det:24, w:10, reuse:'신규개발', fp:10.0 },
    { lv1:'데이터', lv2:'마스터', lv3:'평가 이력 (ILF)', type:'ILF', cplx:'high', ftr:3, det:36, w:15, reuse:'신규개발', fp:15.0 },
    { lv1:'데이터', lv2:'연계', lv3:'외부 신용평가사 (EIF)', type:'EIF', cplx:'medium', ftr:2, det:18, w:7, reuse:'신규개발', fp:7.0 },
  ];

  return (
    <div style={{ width:'100%', height:'100%', background: BG, fontFamily:"'Pretendard', system-ui, sans-serif", color: INK, display:'flex', flexDirection:'column' }}>
      <header style={{ height: 64, background:'#fff', borderBottom:`1px solid ${LINE}`, display:'flex', alignItems:'center', padding:'0 24px', gap: 24 }}>
        <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: BLUE, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight: 900, fontSize: 15 }}>j</div>
          <span style={{ fontWeight: 800, fontSize: 16 }}>junsu</span>
        </div>
        <div style={{ marginLeft: 16, fontSize: 13, color: SUB, fontWeight: 600 }}>
          <span style={{ color: MUTE }}>BA</span> <span style={{ color: MUTE }}>›</span> 신용평가 시스템 재구축
        </div>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap: 8 }}>
          <button style={{ height: 40, padding:'0 16px', borderRadius: 999, background:'#fff', color: SUB, border:`1px solid ${LINE}`, fontSize: 13, fontWeight: 700, cursor:'pointer' }}>↓ Excel</button>
          <button style={{ height: 40, padding:'0 16px', borderRadius: 999, background:'#FFF3D6', color:'#B26A00', border:'none', fontSize: 13, fontWeight: 800, cursor:'pointer' }}>💰 개발비 산출</button>
          <div style={{ width: 36, height: 36, borderRadius:'50%', background: BLUE, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize: 13, fontWeight: 800, marginLeft: 4 }}>준수</div>
        </div>
      </header>

      <div style={{ flex: 1, display:'flex', minHeight: 0 }}>
        <aside style={{ width: 260, background:'#fff', borderRight:`1px solid ${LINE}`, padding:'20px 16px', flexShrink: 0 }}>
          <div style={{ padding:'14px 16px', borderRadius: 12, background: BLUE_TINT, marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: BLUE, letterSpacing:'0.08em', marginBottom: 6 }}>FP 요약 · 정통법</div>
            <div style={{ display:'flex', alignItems:'baseline', gap: 4, marginBottom: 6 }}>
              <span style={{ fontSize: 28, fontWeight: 800, letterSpacing:'-0.03em' }}>1,240</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: SUB }}>FP</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize: 11, fontWeight: 600, color: SUB }}>
              <span>신규 1,180</span><span>변경 60</span>
            </div>
          </div>

          <div style={{ padding:'14px 16px', borderRadius: 12, background:'#FFF3D6', marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color:'#B26A00', letterSpacing:'0.08em', marginBottom: 6 }}>예상 개발비</div>
            <div style={{ display:'flex', alignItems:'baseline', gap: 4 }}>
              <span style={{ fontSize: 24, fontWeight: 800, letterSpacing:'-0.03em', color:'#B26A00' }}>7.51</span>
              <span style={{ fontSize: 13, fontWeight: 700, color:'#B26A00' }}>억원</span>
            </div>
            <div style={{ fontSize: 11, color:'#8A4F00', marginTop: 4, fontWeight: 600 }}>단가 605,784원/FP</div>
          </div>

          <div style={{ fontSize: 10, fontWeight: 800, color: MUTE, letterSpacing:'0.08em', padding:'4px 12px', marginBottom: 6 }}>FP 유형 분포</div>
          {Object.entries({ EI: 84, EO: 32, EQ: 56, ILF: 28, EIF: 18 }).map(([k, v]) => (
            <div key={k} style={{ display:'flex', alignItems:'center', gap: 8, padding:'6px 12px', marginBottom: 2 }}>
              <span style={{ width: 24, fontSize: 11, fontWeight: 800, color: FP_TYPES[k] }}>{k}</span>
              <div style={{ flex: 1, height: 6, background: LINE, borderRadius: 999 }}>
                <div style={{ width: `${v}%`, height:'100%', background: FP_TYPES[k], borderRadius: 999 }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: SUB }}>{v}</span>
            </div>
          ))}
        </aside>

        <main style={{ flex: 1, display:'flex', flexDirection:'column', minWidth: 0, overflow:'auto' }}>
          <div style={{ height: 48, background:'#fff', borderBottom:`1px solid ${LINE}`, display:'flex', alignItems:'center', padding:'0 24px', gap: 4 }}>
            {[{l:'프로젝트 설정'}, {l:'기능목록 (218)'}, {l:'FP 산정표 (218)', active: true}].map(t => (
              <div key={t.l} style={{ height: 36, padding:'0 16px', borderRadius: 999, display:'flex', alignItems:'center', fontSize: 13, fontWeight: 800, background: t.active ? BLUE_TINT : 'transparent', color: t.active ? BLUE : SUB }}>{t.l}</div>
            ))}
          </div>

          <div style={{ padding:'24px 28px 16px' }}>
            <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom: 18 }}>
              <div>
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing:'-0.03em' }}>FP 산정표</h1>
                <p style={{ margin:'6px 0 0', fontSize: 13, color: SUB, fontWeight: 500 }}>총 218개 기능 · 정통법 기준 · 2025 SW사업 대가산정 가이드</p>
              </div>
              <div style={{ display:'flex', gap: 6, background:'#fff', border:`1px solid ${LINE}`, borderRadius: 10, padding: 4 }}>
                {['정통법','간이법'].map((m, i) => (
                  <button key={m} style={{ height: 32, padding:'0 14px', borderRadius: 8, background: i === 0 ? INK : 'transparent', color: i === 0 ? '#fff' : SUB, border:'none', fontSize: 12.5, fontWeight: 800, cursor:'pointer' }}>{m}</button>
                ))}
              </div>
            </div>

            {/* validation banner */}
            <div style={{ background:'#FFFBE7', border:'1px solid #FFE7A0', borderRadius: 12, padding:'12px 16px', display:'flex', alignItems:'center', gap: 12, marginBottom: 16 }}>
              <span style={{ fontSize: 18 }}>💡</span>
              <div style={{ flex: 1, fontSize: 12.5, color:'#7A5C00', fontWeight: 600 }}>
                EQ 비율이 41%로 다소 높아요. 일부를 EI/EO로 재검토하시면 정확도가 올라가요.
              </div>
              <button style={{ height: 28, padding:'0 12px', borderRadius: 999, background:'#fff', color:'#B26A00', border:'none', fontSize: 11, fontWeight: 800, cursor:'pointer' }}>자세히 →</button>
            </div>

            {/* table */}
            <div style={{ background:'#fff', border:`1px solid ${LINE}`, borderRadius: 14, overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize: 12.5 }}>
                <thead style={{ background: BG }}>
                  <tr>
                    {['#','LV1','LV2','LV3','FP유형','복잡도','FTR','DET','가중치','재사용','FP점수','비고'].map(h => (
                      <th key={h} style={{ padding:'12px 10px', fontSize: 11, fontWeight: 800, color: SUB, textAlign: h==='LV3' ? 'left' : 'center', letterSpacing:'-0.01em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} style={{ borderTop:`1px solid ${LINE}` }}>
                      <td style={{ padding:'12px 10px', textAlign:'center', fontSize: 11, color: MUTE, fontFamily:'SF Mono, monospace' }}>{(i+1).toString().padStart(2,'0')}</td>
                      <td style={{ padding:'12px 10px', textAlign:'center', fontSize: 12, color: SUB, fontWeight: 600 }}>{r.lv1}</td>
                      <td style={{ padding:'12px 10px', textAlign:'center', fontSize: 12, color: SUB, fontWeight: 600 }}>{r.lv2}</td>
                      <td style={{ padding:'12px 10px', fontSize: 13, color: INK, fontWeight: 700 }}>{r.lv3}</td>
                      <td style={{ padding:'12px 10px', textAlign:'center' }}>
                        <span style={{ display:'inline-flex', alignItems:'center', padding:'3px 10px', borderRadius: 6, background: FP_TYPES[r.type] + '15', color: FP_TYPES[r.type], fontSize: 11, fontWeight: 800, fontFamily:'SF Mono, monospace' }}>{r.type}</span>
                      </td>
                      <td style={{ padding:'12px 10px', textAlign:'center' }}>
                        <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width: 24, height: 24, borderRadius: 6, background: CPLX[r.cplx].bg, color: CPLX[r.cplx].fg, fontSize: 11, fontWeight: 800 }}>{CPLX[r.cplx].l}</span>
                      </td>
                      <td style={{ padding:'12px 10px', textAlign:'center', fontSize: 12, color: INK, fontVariantNumeric:'tabular-nums', fontWeight: 600 }}>{r.ftr}</td>
                      <td style={{ padding:'12px 10px', textAlign:'center', fontSize: 12, color: INK, fontVariantNumeric:'tabular-nums', fontWeight: 600 }}>{r.det}</td>
                      <td style={{ padding:'12px 10px', textAlign:'center', fontSize: 12, color: SUB, fontVariantNumeric:'tabular-nums', fontWeight: 600 }}>{r.w.toFixed(1)}</td>
                      <td style={{ padding:'12px 10px', textAlign:'center' }}>
                        <span style={{ fontSize: 11, padding:'2px 8px', borderRadius: 999, background: r.reuse === '신규개발' ? BLUE_TINT : '#FFF3D6', color: r.reuse === '신규개발' ? BLUE : '#B26A00', fontWeight: 700 }}>{r.reuse}</span>
                      </td>
                      <td style={{ padding:'12px 10px', textAlign:'center', fontSize: 13, color: INK, fontVariantNumeric:'tabular-nums', fontWeight: 800 }}>{r.fp.toFixed(1)}</td>
                      <td style={{ padding:'12px 10px', textAlign:'center', fontSize: 12, color: MUTE }}>-</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: BLUE_TINT, borderTop:`2px solid ${BLUE}` }}>
                    <td colSpan={10} style={{ padding:'14px 14px', textAlign:'right', fontSize: 13, color: BLUE, fontWeight: 800 }}>합계 (표시된 10개 행)</td>
                    <td style={{ padding:'14px 10px', textAlign:'center', fontSize: 15, color: BLUE, fontWeight: 800, fontVariantNumeric:'tabular-nums' }}>60.0 FP</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
              <div style={{ padding:'14px 18px', borderTop:`1px solid ${LINE}`, background: BG, display:'flex', justifyContent:'space-between', alignItems:'center', fontSize: 12, color: SUB, fontWeight: 500 }}>
                <span>10 / 218 표시 중</span>
                <div style={{ display:'flex', gap: 4 }}>
                  {['‹','1','2','3','22','›'].map((p,i) => <button key={i} style={{ width: 32, height: 32, borderRadius: 8, background: p==='1' ? BLUE : '#fff', color: p==='1' ? '#fff' : SUB, border: p==='1' ? 'none' : `1px solid ${LINE}`, fontSize: 12, fontWeight: 700, cursor:'pointer' }}>{p}</button>)}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
window.BAFPTable = BAFPTable;
