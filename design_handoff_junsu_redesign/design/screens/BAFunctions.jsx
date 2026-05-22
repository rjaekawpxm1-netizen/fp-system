// ─── BA · 기능목록 탭 ───
const BAFunctions = () => {
  const BLUE = '#3182F6'; const BLUE_TINT = '#EAF3FF';
  const INK = '#191F28'; const SUB = '#4E5968'; const MUTE = '#8B95A1';
  const LINE = '#F2F4F6'; const BG = '#F9FAFB';

  // 선택된 항목 수 (mock)
  const selectedCount = 3;
  const upgradeMode = true;

  const groups = [
    { lv1: '회원관리', count: 42, color: '#3182F6', funcs: [
      { lv2: '회원가입', lv3: '약관 동의 처리', def: '회원가입 약관 동의 정보를 저장한다', checked: true, reuse: '재사용' },
      { lv2: '회원가입', lv3: '본인인증', def: '휴대폰 본인인증을 처리한다', checked: true, reuse: '재사용' },
      { lv2: '회원가입', lv3: '회원정보 등록', def: '회원정보를 신규 등록한다', checked: true, reuse: '신규개발' },
      { lv2: '로그인', lv3: '아이디/비밀번호 로그인', def: '회원 인증 후 로그인을 처리한다', reuse: '재사용' },
      { lv2: '로그인', lv3: 'SNS 로그인', def: '카카오/네이버 SNS 로그인을 처리한다', reuse: '신규개발' },
    ]},
    { lv1: '신용평가', count: 86, color: '#7C3AED', funcs: [
      { lv2: '평가 요청', lv3: '신용평가 신청서 작성', def: '평가 신청 정보를 입력받는다' },
      { lv2: '평가 요청', lv3: '신용평가 신청 제출', def: '평가 신청을 저장하고 결재 요청한다' },
      { lv2: 'AI 평가', lv3: '신용점수 자동 산정', def: 'AI 모델로 신용점수를 산정한다' },
    ]},
    { lv1: '리포트', count: 24, color: '#0F8B47', funcs: [], collapsed: true },
    { lv1: '시스템 관리', count: 18, color: '#D97706', funcs: [], collapsed: true },
  ];

  return (
    <div style={{ width:'100%', height:'100%', background: BG, fontFamily:"'Pretendard', system-ui, sans-serif", color: INK, display:'flex', flexDirection:'column' }}>
      <header style={{ height: 64, background:'#fff', borderBottom: `1px solid ${LINE}`, display:'flex', alignItems:'center', padding:'0 24px', gap: 24 }}>
        <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: BLUE, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight: 900, fontSize: 15 }}>j</div>
          <span style={{ fontWeight: 800, fontSize: 16 }}>junsu</span>
        </div>
        <div style={{ marginLeft: 16, fontSize: 13, color: SUB, fontWeight: 600, display:'flex', alignItems:'center', gap: 6 }}>
          <span style={{ color: MUTE }}>BA 도우미</span><span style={{ color: MUTE }}>›</span>
          <span>신용평가 시스템 재구축</span>
        </div>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap: 10 }}>
          <button style={{ height: 40, padding:'0 16px', borderRadius: 999, background: BG, color: SUB, border:'none', fontSize: 13, fontWeight: 700, cursor:'pointer' }}>← 목록으로</button>
          <div style={{ width: 36, height: 36, borderRadius:'50%', background: BLUE, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize: 13, fontWeight: 800 }}>준수</div>
        </div>
      </header>

      <div style={{ flex: 1, display:'flex', minHeight: 0 }}>
        {/* Sidebar */}
        <aside style={{ width: 260, background:'#fff', borderRight:`1px solid ${LINE}`, padding:'20px 16px', flexShrink: 0 }}>
          <div style={{ padding:'14px 16px', borderRadius: 12, background: BLUE_TINT, marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: BLUE, letterSpacing:'0.08em', marginBottom: 6 }}>현재 프로젝트</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: INK, marginBottom: 4 }}>신용평가 시스템 재구축</div>
            <div style={{ display:'flex', alignItems:'center', gap: 8, marginTop: 12 }}>
              <div style={{ flex: 1, height: 5, background:'#fff', borderRadius: 999 }}><div style={{ width:'72%', height:'100%', background: BLUE, borderRadius: 999 }} /></div>
              <span style={{ fontSize: 12, fontWeight: 800, color: BLUE }}>72%</span>
            </div>
          </div>
          {[
            { l:'프로젝트 설정', icon:'⚙', count: null },
            { l:'기능목록', icon:'⊞', count: 218, active: true },
            { l:'FP 산정표', icon:'⌧', count: 218 },
            { l:'화면목록', icon:'▦', count: 56 },
            { l:'요구사항', icon:'✓', count: 98 },
            { l:'WBS', icon:'⊟', count: null },
            { l:'프로젝트 복사', icon:'⎘', count: null, divider: true },
          ].map(n => (
            <React.Fragment key={n.l}>
              {n.divider && <div style={{ height: 1, background: LINE, margin: '8px 4px' }} />}
              <button style={{ width:'100%', height: 42, padding:'0 12px', border:'none', cursor:'pointer', borderRadius: 10, display:'flex', alignItems:'center', gap: 10, background: n.active ? BLUE_TINT : 'transparent', color: n.active ? BLUE : SUB, fontSize: 13.5, fontWeight: n.active ? 800 : 600, marginBottom: 2 }}>
                <span style={{ fontSize: 14, opacity: 0.8 }}>{n.icon}</span>
                <span style={{ flex: 1, textAlign:'left' }}>{n.l}</span>
                {n.count !== null && <span style={{ fontSize: 11, fontWeight: 700, padding:'2px 8px', borderRadius: 999, background: n.active ? '#fff' : LINE, color: n.active ? BLUE : MUTE }}>{n.count}</span>}
              </button>
            </React.Fragment>
          ))}
        </aside>

        {/* Main */}
        <main style={{ flex: 1, display:'flex', flexDirection:'column', minWidth: 0 }}>
          <div style={{ height: 48, background:'#fff', borderBottom: `1px solid ${LINE}`, display:'flex', alignItems:'center', padding:'0 24px', gap: 4 }}>
            {[{l:'프로젝트 설정'}, {l:'기능목록 (218)', active: true}, {l:'FP 산정표 (218)'}].map(t => (
              <div key={t.l} style={{ height: 36, padding:'0 16px', borderRadius: 999, display:'flex', alignItems:'center', fontSize: 13, fontWeight: 800, background: t.active ? BLUE_TINT : 'transparent', color: t.active ? BLUE : SUB, cursor:'pointer' }}>{t.l}</div>
            ))}
          </div>

          <div style={{ padding:'28px 32px 0' }}>
            <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap: 10, marginBottom: 8 }}>
                  <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing:'-0.03em' }}>기능목록</h1>
                  {upgradeMode && (
                    <span style={{
                      display:'inline-flex', alignItems:'center', gap: 6,
                      padding:'4px 10px', borderRadius: 999,
                      background:'#FFF3D6', color:'#B26A00',
                      fontSize: 12, fontWeight: 800, letterSpacing:'-0.01em',
                    }}>🔧 고도화 모드</span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: 14, color: SUB, fontWeight: 500 }}>총 218개 기능 · 클릭해서 바로 수정할 수 있어요</p>
              </div>
              <div style={{ display:'flex', gap: 8 }}>
                <button style={{ height: 40, padding:'0 16px', borderRadius: 999, background:'#fff', color: SUB, border:`1px solid ${LINE}`, fontSize: 13, fontWeight: 700, cursor:'pointer' }}>+ 영역 추가</button>
                <button style={{ height: 40, padding:'0 16px', borderRadius: 999, background:'#fff', color: SUB, border:`1px solid ${LINE}`, fontSize: 13, fontWeight: 700, cursor:'pointer' }}>+ 행 추가</button>
                <button style={{ height: 40, padding:'0 16px', borderRadius: 999, background:'#0F8B47', color:'#fff', border:'none', fontSize: 13, fontWeight: 700, cursor:'pointer' }}>↓ Excel</button>
                <button style={{ height: 40, padding:'0 18px', borderRadius: 999, background: BLUE, color:'#fff', border:'none', fontSize: 13, fontWeight: 800, cursor:'pointer' }}>FP 산정 →</button>
              </div>
            </div>

            {/* Bulk edit toolbar (선택 시 활성) */}
            {selectedCount > 0 && (
              <div style={{
                display:'flex', alignItems:'center', gap: 10,
                padding:'12px 16px', marginBottom: 14,
                background: BLUE_TINT, borderRadius: 12,
                border:`1px solid #D1E3FA`,
              }}>
                <span style={{
                  display:'inline-flex', alignItems:'center', gap: 6,
                  padding:'4px 10px', borderRadius: 999,
                  background: BLUE, color:'#fff',
                  fontSize: 12, fontWeight: 800,
                }}>✓ {selectedCount}개 선택됨</span>
                <span style={{ fontSize: 13, color: BLUE, fontWeight: 600, marginRight: 'auto' }}>
                  선택 항목 일괄 편집:
                </span>
                <div style={{
                  display:'flex', alignItems:'center', gap: 6,
                  height: 36, padding:'0 12px',
                  background:'#fff', borderRadius: 8, border:`1px solid #D1E3FA`,
                }}>
                  <span style={{ fontSize: 12, color: MUTE, fontWeight: 600 }}>LV1 →</span>
                  <input placeholder="회원관리" readOnly style={{
                    border:'none', outline:'none', background:'transparent',
                    fontSize: 13, fontWeight: 600, color: INK,
                    width: 100, fontFamily:'inherit',
                  }} />
                </div>
                <button style={{
                  height: 36, padding:'0 14px', borderRadius: 8,
                  background: BLUE, color:'#fff', border:'none',
                  fontSize: 12, fontWeight: 800, cursor:'pointer',
                }}>일괄 수정</button>
                <button style={{
                  height: 36, padding:'0 14px', borderRadius: 8,
                  background:'#fff', color:'#E53935', border:`1px solid #FFCDD2`,
                  fontSize: 12, fontWeight: 800, cursor:'pointer',
                }}>🗑 일괄 삭제</button>
                <button style={{
                  width: 32, height: 32, borderRadius: 8,
                  background:'transparent', color: SUB, border:'none',
                  fontSize: 14, cursor:'pointer',
                }}>✕</button>
              </div>
            )}

            {/* Search bar */}
            <div style={{ display:'flex', gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1, height: 42, padding:'0 14px', background:'#fff', border:`1px solid ${LINE}`, borderRadius: 10, display:'flex', alignItems:'center', gap: 10 }}>
                <span style={{ color: MUTE }}>⌕</span>
                <span style={{ fontSize: 13, color: MUTE, fontWeight: 500 }}>LV1 / LV2 / LV3 / 기능정의 통합 검색</span>
              </div>
              <div style={{ height: 42, padding:'0 14px', background:'#fff', border:`1px solid ${LINE}`, borderRadius: 10, display:'flex', alignItems:'center', gap: 8, fontSize: 13, fontWeight: 600, color: INK }}>
                전체 LV1 (218개) <span style={{ color: MUTE }}>▾</span>
              </div>
            </div>
          </div>

          {/* Tree groups */}
          <div style={{ padding:'0 32px 32px', display:'flex', flexDirection:'column', gap: 10 }}>
            {groups.map(g => (
              <div key={g.lv1} style={{ background:'#fff', border:`1px solid ${LINE}`, borderRadius: 14, overflow:'hidden' }}>
                <div style={{ display:'flex', alignItems:'center', padding:'14px 18px', background: g.collapsed ? BG : '#fff', borderBottom: g.collapsed ? 'none' : `1px solid ${LINE}` }}>
                  <span style={{ color: MUTE, marginRight: 10, fontSize: 12 }}>{g.collapsed ? '▸' : '▾'}</span>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: g.color, marginRight: 12 }} />
                  <span style={{ fontSize: 15, fontWeight: 800, color: INK, letterSpacing:'-0.02em' }}>{g.lv1}</span>
                  <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 700, padding:'3px 9px', borderRadius: 999, background: BG, color: SUB }}>{g.count}개</span>
                  <button style={{ marginLeft:'auto', height: 32, padding:'0 12px', borderRadius: 8, background: BG, border:'none', fontSize: 12, fontWeight: 700, color: SUB, cursor:'pointer' }}>+ LV2 추가</button>
                </div>
                {!g.collapsed && (
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize: 13 }}>
                    <thead style={{ background: BG }}>
                      <tr>
                        <th style={{ width: 44, padding:'10px 0 10px 16px' }}>
                          <input type="checkbox" style={{ accentColor: BLUE, width: 14, height: 14 }} />
                        </th>
                        {['LV2','LV3 (기능명)','기능정의','재사용','액션'].map((h, i) => (
                          <th key={h} style={{ padding:'10px 16px', textAlign: i === 2 ? 'left' : i >= 3 ? 'center' : 'left', fontSize: 11, fontWeight: 700, color: MUTE, letterSpacing:'-0.01em', width: i === 4 ? 80 : i === 3 ? 100 : 'auto' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {g.funcs.map((f, i) => (
                        <tr key={i} style={{ borderTop: `1px solid ${LINE}`, background: f.checked ? BLUE_TINT : 'transparent' }}>
                          <td style={{ padding:'14px 0 14px 16px' }}>
                            <input type="checkbox" defaultChecked={f.checked} style={{ accentColor: BLUE, width: 14, height: 14 }} />
                          </td>
                          <td style={{ padding:'14px 16px', fontSize: 13, color: SUB, fontWeight: 600 }}>{f.lv2}</td>
                          <td style={{ padding:'14px 16px', fontSize: 13.5, color: INK, fontWeight: 700 }}>{f.lv3}</td>
                          <td style={{ padding:'14px 16px', fontSize: 13, color: SUB, fontWeight: 500 }}>{f.def}</td>
                          <td style={{ padding:'14px 16px', textAlign:'center' }}>
                            <span style={{
                              fontSize: 11, fontWeight: 700,
                              padding:'3px 10px', borderRadius: 999,
                              background: f.reuse === '신규개발' ? BLUE_TINT : '#FFF3D6',
                              color: f.reuse === '신규개발' ? BLUE : '#B26A00',
                            }}>{f.reuse || '신규개발'}</span>
                          </td>
                          <td style={{ padding:'14px 16px', textAlign:'center' }}>
                            <span style={{ color: MUTE, fontSize: 14, cursor:'pointer' }}>⋯</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
};
window.BAFunctions = BAFunctions;
