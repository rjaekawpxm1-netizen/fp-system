// ─── DA · 메인 페이지 ───
const DAMain = () => {
  const BLUE = '#3182F6'; const BLUE_TINT = '#EAF3FF';
  const INK = '#191F28'; const SUB = '#4E5968'; const MUTE = '#8B95A1';
  const LINE = '#F2F4F6'; const BG = '#F9FAFB';

  const steps = [
    { n:'01', title:'DB 연결', desc:'Oracle · MySQL · PostgreSQL 직접 연결 또는 CSV/Excel 업로드', tip:'Oracle Wallet 파일 업로드 방식도 지원해요' },
    { n:'02', title:'진단 항목 설정', desc:'테이블 선택 후 컬럼별 진단 규칙을 설정해요', tip:'DATE/NUMBER/TEXT 타입별 기본 규칙이 자동 설정돼요' },
    { n:'03', title:'진단 실행', desc:'6개 품질 영역 자동 진단', tip:'진단 완료 후 오류 데이터 원본을 바로 확인할 수 있어요' },
    { n:'04', title:'결과 분석', desc:'영역별 등급, 레이더 차트, 드릴다운', tip:'Claude AI가 결과를 분석하고 개선 방안을 제시해요' },
    { n:'05', title:'보고서 출력', desc:'Excel 3시트 + PDF 공문 형식', tip:'진단 이력이 자동 저장되어 추이를 비교할 수 있어요' },
    { n:'06', title:'AI 표준화 추천', desc:'공통표준용어 13,177개 기반 컬럼명 표준화', tip:'DB 연결 없이 컬럼명 입력으로도 사용할 수 있어요' },
  ];

  const areas = [
    { l:'완전성', eng:'Completeness', desc:'필수값 누락, 공백값 검사', color:'#3182F6', bg: BLUE_TINT },
    { l:'일관성', eng:'Consistency',  desc:'앞뒤 공백 등 형식 일관성', color:'#0F8B47', bg:'#E7F8EF' },
    { l:'정확성', eng:'Accuracy',     desc:'비정상 특수문자 검사', color:'#D97706', bg:'#FFF3D6' },
    { l:'유용성', eng:'Usefulness',   desc:'N/A, 테스트 등 더미 데이터', color:'#CA8A04', bg:'#FEF9C3' },
    { l:'유일성', eng:'Uniqueness',   desc:'단일/복합키 중복 검사', color:'#7C3AED', bg:'#F3EEFE' },
    { l:'유효성', eng:'Validity',     desc:'날짜 형식, 숫자 혼입 검사', color:'#E11D48', bg:'#FFEBEB' },
  ];

  return (
    <div style={{ width:'100%', height:'100%', background: BG, fontFamily:"'Pretendard', system-ui, sans-serif", color: INK, display:'flex', flexDirection:'column' }}>
      <header style={{ height: 64, background:'#fff', borderBottom:`1px solid ${LINE}`, display:'flex', alignItems:'center', padding:'0 24px', gap: 24 }}>
        <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: BLUE, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight: 900, fontSize: 15 }}>j</div>
          <span style={{ fontWeight: 800, fontSize: 16 }}>junsu</span>
        </div>
        <nav style={{ display:'flex', alignItems:'center', gap: 4, marginLeft: 16 }}>
          {[
            { l:'BA', active: false }, { l:'AA', soon: true },
            { l:'DA', active: true }, { l:'TA', soon: true }
          ].map(n => (
            <button key={n.l} style={{ height: 40, padding:'0 18px', borderRadius: 999, background: n.active ? BLUE_TINT : 'transparent', color: n.active ? BLUE : (n.soon ? MUTE : SUB), border:'none', cursor:'pointer', fontSize: 14, fontWeight: 800, opacity: n.soon ? 0.6 : 1 }}>
              {n.l}{n.soon && <span style={{ fontSize: 10, marginLeft: 4, fontWeight: 600 }}>준비중</span>}
            </button>
          ))}
        </nav>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap: 10 }}>
          <span style={{ display:'inline-flex', alignItems:'center', gap: 6, padding:'6px 12px', borderRadius: 999, background:'#E7F8EF', color:'#0F8B47', fontSize: 12, fontWeight: 800 }}>
            <span style={{ width: 6, height: 6, borderRadius:'50%', background:'#0F8B47' }} />
            Oracle 연결됨
          </span>
          <div style={{ width: 36, height: 36, borderRadius:'50%', background: BLUE, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize: 13, fontWeight: 800 }}>준수</div>
        </div>
      </header>

      <div style={{ flex: 1, overflow:'auto', padding:'32px 32px 40px' }}>
        <div style={{ maxWidth: 1280, margin:'0 auto' }}>
          <div style={{ fontSize: 12, color: MUTE, fontWeight: 600, marginBottom: 12 }}>
            홈 · <span style={{ color: BLUE, fontWeight: 700 }}>DA 도우미</span>
          </div>

          {/* Hero */}
          <section style={{ background:'#fff', border:`1px solid ${LINE}`, borderRadius: 20, padding:'32px 36px', marginBottom: 16, position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:-80, right:-40, width: 280, height: 280, borderRadius:'50%', background:'#E7F8EF', opacity: 0.6 }} />
            <div style={{ position:'relative', display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap: 24 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display:'inline-flex', alignItems:'center', gap: 8, padding:'5px 12px', borderRadius: 999, background:'#E7F8EF', color:'#0F8B47', fontSize: 12, fontWeight: 800, marginBottom: 16 }}>
                  <span style={{ width: 6, height: 6, borderRadius:'50%', background:'#0F8B47' }} />
                  행안부 공공데이터 표준화 관리 매뉴얼 2026
                </div>
                <h1 style={{ margin: 0, fontSize: 36, fontWeight: 800, letterSpacing:'-0.035em' }}>DA 도우미</h1>
                <p style={{ margin:'8px 0 24px', fontSize: 15, color: SUB, fontWeight: 500, lineHeight: 1.55, maxWidth: 460 }}>
                  공공데이터 품질진단부터 표준화까지,<br />
                  AI가 자동으로 도와드려요.
                </p>
                <div style={{ display:'flex', gap: 8 }}>
                  <button style={{ height: 48, padding:'0 22px', borderRadius: 999, background: BLUE, color:'#fff', border:'none', fontSize: 14, fontWeight: 800, cursor:'pointer', boxShadow:'0 8px 20px rgba(49,130,246,0.28)' }}>⚙ 진단 시작하기</button>
                  <button style={{ height: 48, padding:'0 20px', borderRadius: 999, background:'#fff', color: INK, border:`1px solid ${LINE}`, fontSize: 14, fontWeight: 700, cursor:'pointer' }}>🤖 AI 표준화 →</button>
                </div>
              </div>

              <div style={{ position:'relative', display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap: 1, background: LINE, borderRadius: 14, overflow:'hidden', border:`1px solid ${LINE}` }}>
                {[
                  { l:'연결된 테이블', v:'48', u:'개' },
                  { l:'진단 완료', v:'12', u:'건' },
                  { l:'표준화 추천', v:'1.2K', u:'개' },
                ].map(k => (
                  <div key={k.l} style={{ background:'#fff', padding:'14px 22px', minWidth: 100, textAlign:'center' }}>
                    <div style={{ fontSize: 11, color: MUTE, fontWeight: 600, marginBottom: 4 }}>{k.l}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, letterSpacing:'-0.025em' }}>
                      {k.v}<span style={{ fontSize: 11, color: MUTE, marginLeft: 2, fontWeight: 600 }}>{k.u}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Steps */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ margin:'0 0 16px', fontSize: 20, fontWeight: 800, letterSpacing:'-0.025em' }}>📌 진단 워크플로우</h2>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap: 12 }}>
              {steps.map(s => (
                <div key={s.n} style={{ background:'#fff', border:`1px solid ${LINE}`, borderRadius: 14, padding:'20px 22px', cursor:'pointer' }}>
                  <div style={{ display:'flex', alignItems:'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: BLUE, padding:'3px 9px', borderRadius: 6, background: BLUE_TINT, letterSpacing:'0.08em' }}>STEP {s.n}</span>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: INK, marginBottom: 8, letterSpacing:'-0.02em' }}>{s.title}</div>
                  <div style={{ fontSize: 13, color: SUB, fontWeight: 500, lineHeight: 1.55, marginBottom: 12 }}>{s.desc}</div>
                  <div style={{ fontSize: 11.5, color: BLUE, fontWeight: 600, padding:'8px 10px', background: BLUE_TINT, borderRadius: 8, lineHeight: 1.5 }}>
                    💡 {s.tip}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quality areas */}
          <section style={{ background:'#fff', border:`1px solid ${LINE}`, borderRadius: 16, padding:'24px 28px' }}>
            <h2 style={{ margin:'0 0 18px', fontSize: 18, fontWeight: 800, letterSpacing:'-0.025em' }}>📚 6대 품질 진단 영역</h2>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap: 12 }}>
              {areas.map(a => (
                <div key={a.l} style={{ background: a.bg, borderRadius: 12, padding:'14px 18px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius:'50%', background: a.color }} />
                    <span style={{ fontSize: 14, fontWeight: 800, color: INK }}>{a.l}</span>
                    <span style={{ fontSize: 10, color: MUTE, fontFamily:'SF Mono, monospace', fontWeight: 600 }}>{a.eng}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: SUB, fontWeight: 500, lineHeight: 1.5 }}>{a.desc}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
window.DAMain = DAMain;
