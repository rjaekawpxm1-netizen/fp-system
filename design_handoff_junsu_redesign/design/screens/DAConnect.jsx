// ─── DA · DB 연결 ───
const DAConnect = () => {
  const BLUE = '#3182F6'; const BLUE_TINT = '#EAF3FF';
  const INK = '#191F28'; const SUB = '#4E5968'; const MUTE = '#8B95A1';
  const LINE = '#F2F4F6'; const BG = '#F9FAFB';

  const dbs = [
    { id:'oracle', name:'Oracle', desc:'Oracle Wallet 지원', color:'#E11D48', selected: true },
    { id:'mysql', name:'MySQL', desc:'MySQL 5.7+ / 8.0', color:'#0F8B47' },
    { id:'postgres', name:'PostgreSQL', desc:'PostgreSQL 12+', color:'#3182F6' },
    { id:'file', name:'CSV / Excel', desc:'파일 직접 업로드', color:'#7C3AED' },
  ];

  return (
    <div style={{ width:'100%', height:'100%', background: BG, fontFamily:"'Pretendard', system-ui, sans-serif", color: INK, display:'flex', flexDirection:'column' }}>
      <header style={{ height: 64, background:'#fff', borderBottom:`1px solid ${LINE}`, display:'flex', alignItems:'center', padding:'0 24px', gap: 24 }}>
        <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: BLUE, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight: 900, fontSize: 15 }}>j</div>
          <span style={{ fontWeight: 800, fontSize: 16 }}>junsu</span>
        </div>
        <div style={{ marginLeft: 16, fontSize: 13, color: SUB, fontWeight: 600 }}>
          <span style={{ color: MUTE }}>DA</span> <span style={{ color: MUTE }}>›</span> DB 연결
        </div>
      </header>

      <div style={{ flex: 1, overflow:'auto', padding:'32px 32px 40px' }}>
        <div style={{ maxWidth: 1080, margin:'0 auto' }}>
          <h1 style={{ margin:'0 0 8px', fontSize: 28, fontWeight: 800, letterSpacing:'-0.03em' }}>DB 연결</h1>
          <p style={{ margin:'0 0 24px', fontSize: 14, color: SUB, fontWeight: 500 }}>
            진단할 데이터베이스 종류를 선택하고 연결 정보를 입력해주세요.
          </p>

          {/* Step indicator */}
          <div style={{ display:'flex', alignItems:'center', gap: 0, marginBottom: 24, padding:'14px 20px', background:'#fff', border:`1px solid ${LINE}`, borderRadius: 14 }}>
            {[
              { n:'01', l:'DB 연결', active: true },
              { n:'02', l:'진단 항목 설정' },
              { n:'03', l:'진단 실행' },
              { n:'04', l:'결과 확인' },
            ].map((s, i) => (
              <React.Fragment key={s.n}>
                <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius:'50%', background: s.active ? BLUE : LINE, color: s.active ? '#fff' : MUTE, display:'flex', alignItems:'center', justifyContent:'center', fontSize: 11, fontWeight: 800 }}>{s.n}</div>
                  <span style={{ fontSize: 13, fontWeight: s.active ? 800 : 600, color: s.active ? INK : MUTE }}>{s.l}</span>
                </div>
                {i < 3 && <div style={{ flex: 1, height: 2, background: LINE, margin:'0 16px' }} />}
              </React.Fragment>
            ))}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 16 }}>
            {/* Left: DB type */}
            <section style={{ background:'#fff', border:`1px solid ${LINE}`, borderRadius: 16, padding:'20px 24px' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: MUTE, letterSpacing:'0.08em', marginBottom: 14 }}>① DB 종류 선택</div>
              <div style={{ display:'flex', flexDirection:'column', gap: 8 }}>
                {dbs.map(d => (
                  <button key={d.id} style={{ display:'flex', alignItems:'center', gap: 14, padding:'14px 16px', borderRadius: 12, background: d.selected ? BLUE_TINT : '#fff', border: d.selected ? `2px solid ${BLUE}` : `1px solid ${LINE}`, cursor:'pointer' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: d.color + '15', color: d.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize: 13, fontWeight: 900, letterSpacing:'-0.04em' }}>
                      {d.name.slice(0,2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, textAlign:'left' }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: INK, marginBottom: 2 }}>{d.name}</div>
                      <div style={{ fontSize: 12, color: SUB, fontWeight: 500 }}>{d.desc}</div>
                    </div>
                    {d.selected && (
                      <span style={{ width: 22, height: 22, borderRadius:'50%', background: BLUE, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize: 12, fontWeight: 900 }}>✓</span>
                    )}
                  </button>
                ))}
              </div>
            </section>

            {/* Right: Connection form */}
            <section style={{ background:'#fff', border:`1px solid ${LINE}`, borderRadius: 16, padding:'20px 24px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: MUTE, letterSpacing:'0.08em' }}>② Oracle 연결 정보</div>
                <span style={{ fontSize: 11, fontWeight: 700, padding:'3px 9px', borderRadius: 6, background:'#FFF3D6', color:'#B26A00' }}>Wallet 지원</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap: 12 }}>
                <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap: 10 }}>
                  <DAField label="호스트" value="prod-db.junsu.io" />
                  <DAField label="포트" value="1521" />
                </div>
                <DAField label="SID / 서비스명" value="JUNSUDB" />
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 10 }}>
                  <DAField label="사용자명" value="junsu_da" />
                  <DAField label="비밀번호" value="••••••••••" />
                </div>
                <DAField label="Wallet 파일 (선택)" value="cwallet.sso 업로드됨" file />
              </div>

              <div style={{ display:'flex', gap: 8, marginTop: 18 }}>
                <button style={{ flex: 1, height: 44, borderRadius: 10, background:'#fff', color: SUB, border:`1px solid ${LINE}`, fontSize: 13, fontWeight: 700, cursor:'pointer' }}>연결 테스트</button>
                <button style={{ flex: 1, height: 44, borderRadius: 10, background: BLUE, color:'#fff', border:'none', fontSize: 13, fontWeight: 800, cursor:'pointer', boxShadow:'0 8px 16px rgba(49,130,246,0.25)' }}>연결하기 →</button>
              </div>

              <div style={{ marginTop: 14, padding:'12px 14px', background:'#E7F8EF', borderRadius: 10, display:'flex', alignItems:'center', gap: 10, fontSize: 12, color:'#0F8B47', fontWeight: 600 }}>
                <span style={{ fontSize: 16 }}>✓</span>
                마지막 연결 테스트 성공 · 2분 전 · 48개 테이블 발견
              </div>
            </section>
          </div>

          {/* Discovered tables preview */}
          <section style={{ background:'#fff', border:`1px solid ${LINE}`, borderRadius: 16, padding:'20px 24px', marginTop: 16 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: MUTE, letterSpacing:'0.08em', marginBottom: 4 }}>③ 발견된 테이블 (미리보기)</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>총 <span style={{ color: BLUE }}>48개</span> 테이블</div>
              </div>
              <button style={{ height: 36, padding:'0 14px', borderRadius: 999, background: BLUE_TINT, color: BLUE, border:'none', fontSize: 12, fontWeight: 800, cursor:'pointer' }}>전체 보기 →</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 8 }}>
              {[
                { n:'TB_MEMBER', d:'회원 정보', cols: 24, rows: '120K' },
                { n:'TB_CREDIT_EVAL', d:'신용평가', cols: 36, rows: '480K' },
                { n:'TB_EVAL_HIST', d:'평가 이력', cols: 18, rows: '2.1M' },
                { n:'TB_CODE', d:'공통코드', cols: 8, rows: '1.2K' },
              ].map(t => (
                <div key={t.n} style={{ background: BG, borderRadius: 10, padding:'12px 14px' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: INK, fontFamily:'SF Mono, monospace', marginBottom: 4 }}>{t.n}</div>
                  <div style={{ fontSize: 11, color: SUB, marginBottom: 8, fontWeight: 500 }}>{t.d}</div>
                  <div style={{ display:'flex', gap: 6 }}>
                    <span style={{ fontSize: 10, padding:'2px 7px', borderRadius: 6, background:'#fff', color: MUTE, fontWeight: 700 }}>{t.cols}컬럼</span>
                    <span style={{ fontSize: 10, padding:'2px 7px', borderRadius: 6, background:'#fff', color: MUTE, fontWeight: 700 }}>{t.rows}행</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

const DAField = ({ label, value, file }) => (
  <div>
    <div style={{ fontSize: 12, fontWeight: 800, color:'#4E5968', marginBottom: 6 }}>{label}</div>
    <div style={{ height: 40, padding:'0 14px', borderRadius: 10, border:'1px solid #F2F4F6', background:'#F9FAFB', display:'flex', alignItems:'center', fontSize: 13, fontWeight: 600, color:'#191F28', fontFamily: file ? 'inherit' : 'SF Mono, monospace' }}>
      {file && <span style={{ marginRight: 8 }}>📎</span>}
      {value}
      {file && <span style={{ marginLeft:'auto', color:'#0F8B47', fontSize: 11, fontWeight: 800 }}>✓ 업로드됨</span>}
    </div>
  </div>
);

window.DAConnect = DAConnect;
