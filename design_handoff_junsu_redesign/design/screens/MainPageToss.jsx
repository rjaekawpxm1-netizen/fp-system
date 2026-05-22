// ─── Variation D · Toss Style ───
// Bold, confident, single strong blue accent · 토스/카카오뱅크 톤

const MainPageToss = () => {
  const tools = [
    { key: 'BA', features: ['기능점수(FP) 산정', '요구사항 정의서', '화면 목록', 'WBS', '개발비 산출'], available: true },
    { key: 'AA', features: ['시스템 아키텍처', '컴포넌트 설계', '인터페이스 설계', '표준 산출물'], available: false },
    { key: 'DA', features: ['데이터 표준화', 'ERD 설계', '테이블 정의서', '품질 진단'], available: true },
    { key: 'TA', features: ['서버 규모 산정', '네트워크 설계', '보안 아키텍처', '인프라 설계'], available: false },
  ];

  const BLUE = '#3182F6';
  const INK = '#191F28';
  const SUB = '#4E5968';
  const MUTE = '#8B95A1';
  const LINE = '#F2F4F6';
  const BG_2 = '#F9FAFB';

  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#FFFFFF',
      color: INK,
      fontFamily: "'Pretendard', 'Apple SD Gothic Neo', system-ui, sans-serif",
      display: 'flex', flexDirection: 'column',
    }}>
      {/* ─── Header ─── */}
      <header style={{
        height: 72, padding: '0 40px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: BLUE,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 900, fontSize: 15, letterSpacing: '-0.04em',
          }}>j</div>
          <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em' }}>junsu</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button style={{
            height: 40, padding: '0 16px', borderRadius: 999,
            background: 'transparent', color: SUB,
            border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>로그인</button>
          <button style={{
            height: 40, padding: '0 20px', borderRadius: 999,
            background: INK, color: '#fff',
            border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}>시스템 입장</button>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section style={{
        padding: '120px 40px 140px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* subtle blob */}
        <div style={{
          position: 'absolute',
          top: '40%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 900, height: 500,
          background: 'radial-gradient(ellipse at center, rgba(49,130,246,0.10) 0%, transparent 60%)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }} />

        {/* badge */}
        <div style={{
          position: 'relative',
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '8px 16px', borderRadius: 999,
          background: '#EAF3FF', color: BLUE,
          fontSize: 13, fontWeight: 700,
          marginBottom: 40,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: BLUE }} />
          IT 컨설팅, 이제 자동으로
        </div>

        <h1 style={{
          position: 'relative',
          margin: 0,
          fontSize: 200,
          fontWeight: 900,
          letterSpacing: '-0.065em',
          lineHeight: 0.9,
          color: INK,
        }}>
          AX <span style={{ color: BLUE }}>consulting</span>
        </h1>

        <button style={{
          position: 'relative',
          marginTop: 64,
          height: 64, padding: '0 36px', borderRadius: 999,
          background: BLUE, color: '#fff',
          border: 'none', fontSize: 17, fontWeight: 800, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 12,
          boxShadow: '0 16px 40px rgba(49,130,246,0.32)',
          letterSpacing: '-0.01em',
        }}>
          지금 시작하기
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, borderRadius: '50%',
            background: '#fff', color: BLUE,
            fontSize: 14, fontWeight: 900,
          }}>→</span>
        </button>
      </section>

      {/* ─── Tools ─── */}
      <section style={{
        padding: '60px 40px 80px',
        background: BG_2,
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {tools.map(t => (
              <div key={t.key} style={{
                background: '#fff',
                border: `1px solid ${LINE}`,
                borderRadius: 20,
                padding: '28px 24px',
                minHeight: 360,
                display: 'flex', flexDirection: 'column',
                position: 'relative',
              }}>
                {/* status pill */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: 28,
                }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '5px 11px', borderRadius: 999,
                    background: t.available ? '#E7F8EF' : '#F2F4F6',
                    color: t.available ? '#0F8B47' : MUTE,
                    fontSize: 11.5, fontWeight: 700, letterSpacing: '-0.01em',
                  }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: t.available ? '#0F8B47' : MUTE,
                    }} />
                    {t.available ? '사용 가능' : '준비 중'}
                  </span>
                </div>

                {/* huge label */}
                <div style={{
                  fontSize: 110,
                  fontWeight: 900,
                  letterSpacing: '-0.07em',
                  lineHeight: 0.85,
                  color: t.available ? INK : '#D1D6DB',
                  marginBottom: 28,
                }}>{t.key}</div>

                <ul style={{
                  margin: 0, padding: 0, listStyle: 'none',
                  display: 'flex', flexDirection: 'column', gap: 10,
                  flex: 1,
                }}>
                  {t.features.map(f => (
                    <li key={f} style={{
                      fontSize: 14, color: t.available ? SUB : MUTE,
                      display: 'flex', alignItems: 'center', gap: 10,
                      fontWeight: 600,
                    }}>
                      <span style={{
                        width: 16, height: 16, borderRadius: 4,
                        background: t.available ? '#EAF3FF' : '#F2F4F6',
                        color: t.available ? BLUE : MUTE,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 900,
                        flexShrink: 0,
                      }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <button style={{
                  marginTop: 24,
                  width: '100%', height: 48, borderRadius: 12,
                  background: t.available ? INK : '#F2F4F6',
                  color: t.available ? '#fff' : MUTE,
                  border: 'none', fontSize: 14, fontWeight: 700,
                  cursor: t.available ? 'pointer' : 'not-allowed',
                  letterSpacing: '-0.01em',
                }}>
                  {t.available ? `${t.key} 시작하기` : '곧 출시'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer style={{
        padding: '32px 40px',
        background: '#fff',
        borderTop: `1px solid ${LINE}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: MUTE, fontSize: 13 }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, background: BLUE, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900 }}>j</div>
          <span>© 2026 junsu</span>
        </div>
        <span style={{ fontSize: 13, color: MUTE, fontWeight: 500 }}>안녕하세요, 처음이신가요?</span>
      </footer>
    </div>
  );
};

window.MainPageToss = MainPageToss;
