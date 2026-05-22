import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getConnectStatus } from '../utils/daApi';
import { color, button, card } from '../styles/tokens';

const { blue: BLUE, blueTint: BLUE_TINT, ink: INK, sub: SUB, mute: MUTE, line: LINE, bg: BG } = color;

const STEPS = [
  { num: '01', title: 'DB 연결', desc: 'Oracle·MySQL·PostgreSQL 직접 연결 또는 CSV/Excel 파일 업로드', tip: 'Oracle Wallet 파일 업로드 방식도 지원해요', route: '/da/connect' },
  { num: '02', title: '진단 항목 설정', desc: '테이블 선택 후 컬럼별 진단 규칙을 설정해요', tip: 'DATE/NUMBER/TEXT 타입별 기본 규칙이 자동 설정돼요', route: '/da/setup' },
  { num: '03', title: '진단 실행', desc: '6개 품질 영역 자동 진단', tip: '진단 완료 후 오류 데이터 원본을 바로 확인할 수 있어요', route: '/da/setup' },
  { num: '04', title: '결과 분석', desc: '영역별 등급, 레이더 차트, 드릴다운', tip: 'Claude AI가 결과를 분석하고 개선 방안을 제시해요', route: '/da/result' },
  { num: '05', title: '보고서 출력', desc: 'Excel 3시트 + PDF 공문 형식', tip: '진단 이력이 자동 저장되어 추이를 비교할 수 있어요', route: '/da/result' },
  { num: '06', title: 'AI 표준화 추천', desc: '공통표준용어 13,177개 기반 컬럼명 표준화', tip: 'DB 연결 없이 컬럼명 입력으로도 사용할 수 있어요', route: '/da/standard' },
];

const QUALITY_AREAS = [
  { label: '완전성', eng: 'Completeness', color: '#3182F6', bg: '#EAF3FF', desc: '필수값 누락, 공백값 검사' },
  { label: '일관성', eng: 'Consistency',  color: '#0F8B47', bg: '#E7F8EF', desc: '앞뒤 공백 등 형식 일관성' },
  { label: '정확성', eng: 'Accuracy',     color: '#D97706', bg: '#FFF3D6', desc: '비정상 특수문자 검사' },
  { label: '유용성', eng: 'Usefulness',   color: '#CA8A04', bg: '#FEF9C3', desc: 'N/A, 테스트 등 더미 데이터' },
  { label: '유일성', eng: 'Uniqueness',   color: '#7C3AED', bg: '#F3EEFE', desc: '단일/복합키 중복 검사' },
  { label: '유효성', eng: 'Validity',     color: '#E11D48', bg: '#FFEBEB', desc: '날짜 형식, 숫자 혼입 검사' },
];

const DAMain = () => {
  const navigate = useNavigate();
  const [connected, setConnected] = useState(false);
  const [dbType, setDbType] = useState('');
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    getConnectStatus().then(r => {
      setConnected(r.connected);
      setDbType(r.db_type || '');
    }).catch(() => {});
  }, []);

  return (
    <div style={{ width: '100%', minHeight: '100vh', background: BG, fontFamily: "'Pretendard', system-ui, sans-serif", color: INK, display: 'flex', flexDirection: 'column' }}>
      {/* ── Header ── */}
      <header style={{ height: 64, background: '#fff', borderBottom: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', padding: '0 24px', gap: 24, position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 15 }}>j</div>
          <span style={{ fontWeight: 800, fontSize: 16 }}>junsu</span>
        </div>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 16 }}>
          {[
            { l: 'BA', path: '/ba' },
            { l: 'AA', soon: true },
            { l: 'DA', active: true },
            { l: 'TA', soon: true },
          ].map(n => (
            <button key={n.l} onClick={() => !n.soon && n.path && navigate(n.path)}
              style={{ height: 40, padding: '0 18px', borderRadius: 999, background: n.active ? BLUE_TINT : 'transparent', color: n.active ? BLUE : n.soon ? MUTE : SUB, border: 'none', cursor: n.soon ? 'default' : 'pointer', fontSize: 14, fontWeight: 800, opacity: n.soon ? 0.6 : 1 }}>
              {n.l}{n.soon && <span style={{ fontSize: 10, marginLeft: 4, fontWeight: 600 }}>준비중</span>}
            </button>
          ))}
        </nav>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {connected ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, background: '#E7F8EF', color: '#0F8B47', fontSize: 12, fontWeight: 800 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0F8B47' }} />
              {dbType} 연결됨
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, background: '#FFEBEB', color: '#E53935', fontSize: 12, fontWeight: 800 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#E53935' }} />
              미연결
            </span>
          )}
          <span style={{ fontSize: 11, color: MUTE, fontWeight: 600 }}>행안부 공공데이터 표준화 관리 매뉴얼 2026</span>
        </div>
      </header>

      <div style={{ flex: 1, overflow: 'auto', padding: '32px 32px 40px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ fontSize: 12, color: MUTE, fontWeight: 600, marginBottom: 12 }}>
            홈 · <span style={{ color: BLUE, fontWeight: 700 }}>DA 도우미</span>
          </div>

          {/* ── Hero ── */}
          <section style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 20, padding: '32px 36px', marginBottom: 16, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -80, right: -40, width: 280, height: 280, borderRadius: '50%', background: '#E7F8EF', opacity: 0.6 }} />
            <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderRadius: 999, background: '#E7F8EF', color: '#0F8B47', fontSize: 12, fontWeight: 800, marginBottom: 16 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0F8B47' }} />
                  행안부 공공데이터 표준화 관리 매뉴얼 2026
                </div>
                <h1 style={{ margin: 0, fontSize: 36, fontWeight: 800, letterSpacing: '-0.035em' }}>DA 도우미</h1>
                <p style={{ margin: '8px 0 24px', fontSize: 15, color: SUB, fontWeight: 500, lineHeight: 1.55, maxWidth: 460 }}>
                  공공데이터 품질진단부터 표준화까지,<br />
                  AI가 자동으로 도와드려요.
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => navigate('/da/connect')} style={{ ...button.primary }}>
                    {connected ? '🔌 DB 재연결' : '⚙ 진단 시작하기'}
                  </button>
                  {connected && (
                    <button onClick={() => navigate('/da/setup')} style={{ height: 48, padding: '0 20px', borderRadius: 999, background: '#fff', color: INK, border: `1px solid ${LINE}`, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                      ⚙️ 진단 설정 →
                    </button>
                  )}
                  <button onClick={() => navigate('/da/standard')} style={{ height: 48, padding: '0 20px', borderRadius: 999, background: '#fff', color: INK, border: `1px solid ${LINE}`, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                    🤖 AI 표준화 →
                  </button>
                  <button onClick={() => setShowGuide(!showGuide)} style={{ height: 48, padding: '0 20px', borderRadius: 999, background: '#fff', color: SUB, border: `1px solid ${LINE}`, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                    {showGuide ? '가이드 닫기' : '📖 사용 가이드'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: LINE, borderRadius: 14, overflow: 'hidden', border: `1px solid ${LINE}` }}>
                {[
                  { l: '연결된 테이블', v: connected ? '●' : '0', u: '개' },
                  { l: '진단 완료', v: '-', u: '건' },
                  { l: '표준화 추천', v: '-', u: '개' },
                ].map(k => (
                  <div key={k.l} style={{ background: '#fff', padding: '14px 22px', minWidth: 100, textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: MUTE, fontWeight: 600, marginBottom: 4 }}>{k.l}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.025em' }}>
                      {k.v}<span style={{ fontSize: 11, color: MUTE, marginLeft: 2, fontWeight: 600 }}>{k.u}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Guide (collapsible) ── */}
          {showGuide && (
            <section style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 16, padding: '20px 24px', marginBottom: 16 }}>
              <h2 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800 }}>📖 사용 방법</h2>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: SUB, fontWeight: 500 }}>순서대로 따라하면 품질진단 보고서가 자동으로 완성됩니다</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {STEPS.map(s => (
                  <button key={s.num} onClick={() => navigate(s.route)} style={{ background: BG, border: `1px solid ${LINE}`, borderRadius: 12, padding: '16px 18px', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ fontSize: 10, color: BLUE, fontWeight: 800, letterSpacing: '0.08em', marginBottom: 6 }}>STEP {s.num}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: INK, marginBottom: 6 }}>{s.title}</div>
                    <div style={{ fontSize: 12, color: SUB, lineHeight: 1.5, marginBottom: 8 }}>{s.desc}</div>
                    <div style={{ fontSize: 11.5, color: BLUE, fontWeight: 600, padding: '7px 10px', background: BLUE_TINT, borderRadius: 8, lineHeight: 1.5 }}>💡 {s.tip}</div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* ── Steps ── */}
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 800, letterSpacing: '-0.025em' }}>📌 진단 워크플로우</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {STEPS.map(s => (
                <div key={s.num} onClick={() => navigate(s.route)} style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, padding: '20px 22px', cursor: 'pointer' }}>
                  <div style={{ marginBottom: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: BLUE, padding: '3px 9px', borderRadius: 6, background: BLUE_TINT, letterSpacing: '0.08em' }}>STEP {s.num}</span>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: INK, marginBottom: 8, letterSpacing: '-0.02em' }}>{s.title}</div>
                  <div style={{ fontSize: 13, color: SUB, fontWeight: 500, lineHeight: 1.55, marginBottom: 12 }}>{s.desc}</div>
                  <div style={{ fontSize: 11.5, color: BLUE, fontWeight: 600, padding: '8px 10px', background: BLUE_TINT, borderRadius: 8, lineHeight: 1.5 }}>💡 {s.tip}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Quality areas ── */}
          <section style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 16, padding: '24px 28px', marginBottom: 24 }}>
            <h2 style={{ margin: '0 0 18px', fontSize: 18, fontWeight: 800, letterSpacing: '-0.025em' }}>📚 6대 품질 진단 영역</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {QUALITY_AREAS.map(a => (
                <div key={a.label} style={{ background: a.bg, borderRadius: 12, padding: '14px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: a.color }} />
                    <span style={{ fontSize: 14, fontWeight: 800, color: INK }}>{a.label}</span>
                    <span style={{ fontSize: 10, color: MUTE, fontFamily: 'SF Mono, monospace', fontWeight: 600 }}>{a.eng}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: SUB, fontWeight: 500, lineHeight: 1.5 }}>{a.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Footer ── */}
          <div style={{ paddingTop: 16, borderTop: `1px solid ${LINE}`, display: 'flex', justifyContent: 'space-between' }}>
            <p style={{ fontSize: 11, color: MUTE, margin: 0 }}>DA 도우미 · 행정안전부 공공데이터베이스 표준화 관리 매뉴얼 2026 기준</p>
            <p style={{ fontSize: 11, color: MUTE, margin: 0 }}>Powered by Claude AI</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DAMain;
