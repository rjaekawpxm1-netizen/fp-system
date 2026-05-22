// ─── DA · AI 표준화 추천 ───
const DAStandard = () => {
  const BLUE = '#3182F6'; const BLUE_TINT = '#EAF3FF';
  const INK = '#191F28'; const SUB = '#4E5968'; const MUTE = '#8B95A1';
  const LINE = '#F2F4F6'; const BG = '#F9FAFB';

  const CONF = {
    high: { bg:'#E7F8EF', fg:'#0F8B47', l:'높음' },
    medium: { bg:'#FFF3D6', fg:'#B26A00', l:'보통' },
    low: { bg:'#FFEBEB', fg:'#E53935', l:'낮음' },
  };

  const results = [
    { orig:'회원번호', kr:'회원번호', en:'MBR_NO', domain:'식별자', type:'VARCHAR2(20)', conf:'high', reason:'표준용어 사전 매칭. 회원→MBR, 번호→NO' },
    { orig:'등록일자', kr:'등록일자', en:'REG_DT', domain:'일자', type:'DATE', conf:'high', reason:'표준 형식단어 매칭. 등록→REG, 일자→DT' },
    { orig:'사용여부', kr:'사용여부', en:'USE_YN', domain:'여부', type:'CHAR(1)', conf:'high', reason:'표준 형식단어 여부→YN. Y/N 단일 문자' },
    { orig:'신용점수', kr:'신용평점', en:'CRDT_PNT', domain:'수치', type:'NUMBER(5)', conf:'medium', reason:'신용→CRDT, 점수→PNT. 평점이 표준용어' },
    { orig:'INST_CD', kr:'기관코드', en:'INST_CD', domain:'코드', type:'VARCHAR2(10)', conf:'high', reason:'이미 표준 영문약어. 기관→INST, 코드→CD' },
    { orig:'전화번호1', kr:'연락처번호', en:'CTAC_NO', domain:'번호', type:'VARCHAR2(20)', conf:'medium', reason:'순번 표기 권장하지 않음. 연락처→CTAC가 표준' },
    { orig:'tmp_data', kr:'-', en:'-', domain:'-', type:'-', conf:'low', reason:'의미 불분명한 임시 컬럼명. 삭제 또는 명확한 명명 권장', issue: '컬럼명이 모호함' },
  ];

  return (
    <div style={{ width:'100%', height:'100%', background: BG, fontFamily:"'Pretendard', system-ui, sans-serif", color: INK, display:'flex', flexDirection:'column' }}>
      <header style={{ height: 64, background:'#fff', borderBottom:`1px solid ${LINE}`, display:'flex', alignItems:'center', padding:'0 24px', gap: 24 }}>
        <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: BLUE, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight: 900, fontSize: 15 }}>j</div>
          <span style={{ fontWeight: 800, fontSize: 16 }}>junsu</span>
        </div>
        <div style={{ marginLeft: 16, fontSize: 13, color: SUB, fontWeight: 600 }}>
          <span style={{ color: MUTE }}>DA</span> <span style={{ color: MUTE }}>›</span> AI 표준화 추천
        </div>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap: 8 }}>
          <button style={{ height: 40, padding:'0 16px', borderRadius: 999, background:'#0F8B47', color:'#fff', border:'none', fontSize: 13, fontWeight: 800, cursor:'pointer' }}>↓ CSV</button>
          <button style={{ height: 40, padding:'0 16px', borderRadius: 999, background: BLUE, color:'#fff', border:'none', fontSize: 13, fontWeight: 800, cursor:'pointer' }}>📝 DDL 생성</button>
        </div>
      </header>

      <div style={{ flex: 1, overflow:'auto', padding:'28px 32px' }}>
        <div style={{ maxWidth: 1280, margin:'0 auto' }}>
          <h1 style={{ margin:'0 0 8px', fontSize: 26, fontWeight: 800, letterSpacing:'-0.03em' }}>🤖 AI 표준화 추천</h1>
          <p style={{ margin:'0 0 24px', fontSize: 14, color: SUB, fontWeight: 500, lineHeight: 1.6 }}>
            행정안전부 공통표준용어 13,177개 기반<br />
            한글용어 + 영문약어 + 도메인 자동 추천
          </p>

          <div style={{ display:'grid', gridTemplateColumns:'340px 1fr', gap: 16 }}>
            {/* Left: input */}
            <aside style={{ display:'flex', flexDirection:'column', gap: 12 }}>
              <section style={{ background:'#fff', border:`1px solid ${LINE}`, borderRadius: 14, padding:'18px 20px' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: MUTE, letterSpacing:'0.08em', marginBottom: 12 }}>테이블 선택</div>
                <div style={{ height: 42, padding:'0 14px', borderRadius: 10, border:`1px solid ${LINE}`, background: BG, display:'flex', alignItems:'center', justifyContent:'space-between', fontSize: 13, fontWeight: 700, color: INK, fontFamily:'SF Mono, monospace' }}>
                  TB_MEMBER <span style={{ color: MUTE }}>▾</span>
                </div>
                <div style={{ marginTop: 8, fontSize: 11, color: MUTE, fontWeight: 600 }}>24개 컬럼 로드됨</div>
              </section>

              <section style={{ background:'#fff', border:`1px solid ${LINE}`, borderRadius: 14, padding:'18px 20px' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: MUTE, letterSpacing:'0.08em', marginBottom: 12 }}>또는 직접 입력</div>
                <div style={{ minHeight: 160, padding:'12px 14px', borderRadius: 10, border:`1px solid ${LINE}`, background: BG, fontSize: 13, color: SUB, fontFamily:'SF Mono, monospace', lineHeight: 1.7, whiteSpace:'pre-wrap', fontWeight: 500 }}>
                  {`회원번호\n등록일자\n사용여부\n신용점수\nINST_CD\n전화번호1\ntmp_data`}
                </div>
                <div style={{ marginTop: 8, fontSize: 11, color: MUTE, fontWeight: 600 }}>✓ 7개 컬럼 입력됨</div>
              </section>

              <button style={{ height: 48, borderRadius: 12, background: BLUE, color:'#fff', border:'none', fontSize: 14, fontWeight: 800, cursor:'pointer', boxShadow:'0 8px 20px rgba(49,130,246,0.28)' }}>
                🤖 AI 표준화 분석 시작
              </button>
              <button style={{ height: 40, borderRadius: 10, background:'#fff', color: SUB, border:`1px solid ${LINE}`, fontSize: 12, fontWeight: 700, cursor:'pointer' }}>⚡ 빠른 규칙 기반</button>

              <div style={{ background:'#FFF3D6', borderRadius: 12, padding:'12px 14px', fontSize: 11.5, color:'#7A5C00', fontWeight: 600, lineHeight: 1.6 }}>
                💡 <strong>주요 형식단어:</strong><br/>
                코드→CD · 번호→NO · 명칭→NM · 일자→DT · 금액→AMT · 여부→YN · 건수→CNT · 순번→SEQ · 구분→TP
              </div>
            </aside>

            {/* Right: results */}
            <div style={{ display:'flex', flexDirection:'column', gap: 14 }}>
              {/* AI summary */}
              <div style={{ background:'#F3EEFE', border:'1px solid #E0D4FB', borderRadius: 14, padding:'16px 20px' }}>
                <div style={{ display:'flex', alignItems:'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 18 }}>📊</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color:'#5B21B6' }}>AI 종합 평가</span>
                </div>
                <p style={{ margin:'0 0 8px', fontSize: 13, color:'#5B21B6', fontWeight: 500, lineHeight: 1.7 }}>
                  전체 24개 중 18개(75%)가 표준용어와 일치하거나 간단히 변환 가능해요.<br />
                  일부 임시명("tmp_data", "전화번호1")은 의미가 모호하니<br />
                  컬럼명을 명확히 정리하시는 걸 권장드려요.
                </p>
                <div style={{ fontSize: 12, color:'#5B21B6', fontWeight: 600 }}>
                  💡 테이블명 제안: <span style={{ background:'#fff', padding:'2px 10px', borderRadius: 6, fontFamily:'SF Mono, monospace', fontWeight: 800 }}>TB_MBR_MST</span>
                </div>
              </div>

              {/* Result header */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 4px' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: INK }}>표준화 결과 · 7개 컬럼</div>
                <div style={{ display:'flex', gap: 6 }}>
                  {[['높음', 3, 'high'], ['보통', 2, 'medium'], ['낮음', 1, 'low']].map(([l, c, k]) => (
                    <span key={l} style={{ fontSize: 11, padding:'3px 10px', borderRadius: 999, background: CONF[k].bg, color: CONF[k].fg, fontWeight: 700 }}>
                      {l} {c}
                    </span>
                  ))}
                </div>
              </div>

              {/* Result list */}
              <div style={{ display:'flex', flexDirection:'column', gap: 8 }}>
                {results.map((r, i) => (
                  <div key={i} style={{ background:'#fff', border:`1px solid ${LINE}`, borderRadius: 12, padding:'14px 18px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap: 10, marginBottom: r.reason ? 10 : 0, flexWrap:'wrap' }}>
                      <span style={{ minWidth: 100, fontSize: 13, color: SUB, fontWeight: 700, fontFamily:'SF Mono, monospace' }}>{r.orig}</span>
                      <span style={{ color: MUTE, fontSize: 16 }}>→</span>
                      {r.kr !== '-' && (
                        <span style={{ fontSize: 12, padding:'3px 10px', borderRadius: 6, background:'#F3EEFE', color:'#7C3AED', fontWeight: 700 }}>{r.kr}</span>
                      )}
                      {r.en !== '-' && (
                        <span style={{ fontSize: 13, padding:'3px 10px', borderRadius: 6, background: BG, color: INK, fontWeight: 800, fontFamily:'SF Mono, monospace', border:`1px solid ${LINE}` }}>{r.en}</span>
                      )}
                      {r.domain !== '-' && (
                        <span style={{ fontSize: 11, padding:'2px 9px', borderRadius: 6, background: BLUE_TINT, color: BLUE, fontWeight: 700 }}>{r.domain}</span>
                      )}
                      {r.type !== '-' && (
                        <span style={{ fontSize: 11, padding:'2px 9px', borderRadius: 6, background:'#E7F8EF', color:'#0F8B47', fontWeight: 700, fontFamily:'SF Mono, monospace' }}>{r.type}</span>
                      )}
                      <span style={{ marginLeft:'auto', fontSize: 11, padding:'3px 10px', borderRadius: 999, background: CONF[r.conf].bg, color: CONF[r.conf].fg, fontWeight: 800 }}>
                        신뢰도 {CONF[r.conf].l}
                      </span>
                    </div>
                    {r.reason && (
                      <div style={{ fontSize: 12, color: SUB, fontWeight: 500, lineHeight: 1.55, paddingTop: 8, borderTop:`1px solid ${LINE}` }}>
                        📌 {r.reason}
                      </div>
                    )}
                    {r.issue && (
                      <div style={{ marginTop: 6, fontSize: 11.5, color:'#E53935', fontWeight: 600 }}>
                        ⚠️ {r.issue}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
window.DAStandard = DAStandard;
