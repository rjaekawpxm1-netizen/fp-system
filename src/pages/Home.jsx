import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Home = () => {
  const navigate = useNavigate();
  const [showTools, setShowTools] = useState(false);

  const tools = [
    { key: 'BA', features: ['기능점수(FP) 산정', '요구사항 정의서', '화면 목록', 'WBS', '개발비 산출'], available: true, path: '/ba' },
    { key: 'AA', features: ['시스템 아키텍처', '컴포넌트 설계', '인터페이스 설계', '표준 산출물'], available: false },
    { key: 'DA', features: ['데이터 표준화', 'ERD 설계', '테이블 정의서', '품질 진단'], available: true, path: '/da' },
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
      minHeight: '100vh',
      background: '#FFFFFF',
      color: INK,
      fontFamily: "'Pretendard', 'Apple SD Gothic Neo', system-ui, sans-serif",
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* ─── 헤더 ─── */}
      <header style={{ height: 72, padding: '0 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
          onClick={() => setShowTools(false)}
        >
          <div style={{ width: 32, height: 32, borderRadius: 10, background: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 15 }}>j</div>
          <span style={{ fontWeight: 800, fontSize: 16 }}>junsu</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={{ height: 40, padding: '0 16px', borderRadius: 999, background: 'transparent', color: SUB, border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>로그인</button>
          <button style={{ height: 40, padding: '0 20px', borderRadius: 999, background: INK, color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>시스템 입장</button>
        </div>
      </header>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  화면 1: 히어로 (AX consulting + 버튼)  */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {!showTools && (
        <section style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px',
          textAlign: 'center',
        }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 999, background: '#EAF3FF', color: BLUE, fontSize: 13, fontWeight: 700, marginBottom: 40 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: BLUE }} />
            IT 컨설팅, 이제 자동으로
          </div>

          <h1 style={{ margin: 0, fontSize: 200, fontWeight: 900, letterSpacing: '-0.065em', lineHeight: 0.9, color: INK }}>
            AX <span style={{ color: BLUE }}>consulting</span>
          </h1>

          <button
            onClick={() => setShowTools(true)}
            style={{ marginTop: 64, height: 64, padding: '0 36px', borderRadius: 999, background: BLUE, color: '#fff', border: 'none', fontSize: 17, fontWeight: 800, cursor: 'pointer', boxShadow: '0 16px 40px rgba(49,130,246,0.32)' }}
          >
            지금 시작하기 →
          </button>
        </section>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  화면 2: BA / AA / DA / TA 카드        */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {showTools && (
        <section style={{
          flex: 1,
          padding: '60px 40px 80px',
          background: BG_2,
        }}>
          <div style={{ maxWidth: 1280, margin: '0 auto' }}>
            {/* 뒤로 가기 */}
            <button
              onClick={() => setShowTools(false)}
              style={{
                height: 38, padding: '0 16px', borderRadius: 999,
                background: '#fff', color: SUB, border: `1px solid ${LINE}`,
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                marginBottom: 28,
              }}
            >← 뒤로</button>

            <h2 style={{ margin: '0 0 8px', fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', color: INK }}>
              어떤 도우미를 사용하실래요?
            </h2>
            <p style={{ margin: '0 0 36px', fontSize: 15, color: SUB, fontWeight: 500 }}>
              BA · AA · DA · TA, 네 가지 아키텍처를 한 플랫폼에서 만나보세요.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {tools.map(t => (
                <div
                  key={t.key}
                  onClick={() => t.available && t.path && navigate(t.path)}
                  style={{
                    background: '#fff',
                    border: `1px solid ${LINE}`,
                    borderRadius: 20,
                    padding: '28px 24px',
                    minHeight: 360,
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: t.available ? 'pointer' : 'default',
                  }}
                >
                  <span style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 999, background: t.available ? '#E7F8EF' : '#F2F4F6', color: t.available ? '#0F8B47' : MUTE, fontSize: 11.5, fontWeight: 700, marginBottom: 28 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.available ? '#0F8B47' : MUTE }} />
                    {t.available ? '사용 가능' : '준비 중'}
                  </span>

                  <div style={{ fontSize: 110, fontWeight: 900, letterSpacing: '-0.07em', lineHeight: 0.85, color: t.available ? INK : '#D1D6DB', marginBottom: 28 }}>
                    {t.key}
                  </div>

                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                    {t.features.map(f => (
                      <li key={f} style={{ fontSize: 14, color: t.available ? SUB : MUTE, display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600 }}>
                        <span style={{ width: 16, height: 16, borderRadius: 4, background: t.available ? '#EAF3FF' : '#F2F4F6', color: t.available ? BLUE : MUTE, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900 }}>✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={(e) => { e.stopPropagation(); if (t.available && t.path) navigate(t.path); }}
                    style={{ marginTop: 24, width: '100%', height: 48, borderRadius: 12, background: t.available ? INK : '#F2F4F6', color: t.available ? '#fff' : MUTE, border: 'none', fontSize: 14, fontWeight: 700, cursor: t.available ? 'pointer' : 'not-allowed' }}
                  >
                    {t.available ? `${t.key} 시작하기` : '곧 출시'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default Home;