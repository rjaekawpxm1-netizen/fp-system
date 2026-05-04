import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getConnectStatus } from '../utils/daApi';

const STEPS = [
  { num: '01', icon: '🔌', label: 'DB 연결', desc: 'Oracle·MySQL·PostgreSQL·파일 업로드', key: 'connect' },
  { num: '02', icon: '⚙️', label: '진단 항목 설정', desc: '테이블 선택 · 컬럼별 규칙 설정', key: 'setup' },
  { num: '03', icon: '▶️', label: '진단 실행', desc: '6개 품질 영역 자동 쿼리 실행', key: 'run' },
  { num: '04', icon: '📈', label: '결과 분석', desc: '레이더 차트 · 드릴다운 원본 추적', key: 'result' },
  { num: '05', icon: '📄', label: '보고서 출력', desc: 'Excel · PDF 공문 형식', key: 'report' },
  { num: '06', icon: '🤖', label: 'AI 표준화', desc: '컬럼명 표준화 추천 · ERD 자동 생성', key: 'standard' },
];

const QUALITY_AREAS = [
  { label: '완전성', eng: 'Completeness', color: '#3b82f6', desc: '필수값 누락, 공백값 검사' },
  { label: '일관성', eng: 'Consistency',  color: '#10b981', desc: '앞뒤 공백 등 형식 일관성 검사' },
  { label: '정확성', eng: 'Accuracy',     color: '#f59e0b', desc: '비정상 특수문자 검사' },
  { label: '유용성', eng: 'Usefulness',   color: '#eab308', desc: 'N/A, 테스트 등 더미 데이터 검사' },
  { label: '유일성', eng: 'Uniqueness',   color: '#8b5cf6', desc: '단일/복합키 중복 검사' },
  { label: '유효성', eng: 'Validity',     color: '#ef4444', desc: '날짜 형식, 숫자 혼입 검사' },
];

const DAMain = () => {
  const navigate = useNavigate();
  const [connected, setConnected] = useState(false);
  const [dbType, setDbType] = useState('');

  useEffect(() => {
    getConnectStatus().then(r => {
      setConnected(r.connected);
      setDbType(r.db_type || '');
    }).catch(() => {});
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#0a0f1e', fontFamily: "'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif" }}>

      {/* 네비게이션 */}
      <div style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 32px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 56 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 18 }}>←</button>
            <div style={{ width: 28, height: 28, background: 'linear-gradient(135deg, #10b981, #059669)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🗄️</div>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>DA 도우미</span>
            <span style={{ color: '#334155', fontSize: 11 }}>v1.0</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {connected ? (
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', fontWeight: 600 }}>
                ✅ {dbType} 연결됨
              </span>
            ) : (
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', fontWeight: 600 }}>
                ❌ 미연결
              </span>
            )}
            <span style={{ fontSize: 11, color: '#334155' }}>행정안전부 공공데이터 표준화 관리 매뉴얼 2026 기준</span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>

        {/* 히어로 */}
        <div style={{ background: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #059669 100%)', borderRadius: 20, padding: '40px 48px', marginBottom: 32, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: -60, top: -60, width: 280, height: 280, background: 'rgba(255,255,255,0.03)', borderRadius: '50%' }} />
          <div style={{ position: 'absolute', right: 60, bottom: -80, width: 200, height: 200, background: 'rgba(255,255,255,0.04)', borderRadius: '50%' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: '2px', marginBottom: 12, fontWeight: 600 }}>DATA ARCHITECT ASSISTANT</div>
            <h1 style={{ margin: '0 0 10px', fontSize: 32, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>
              공공데이터 품질진단 시스템
            </h1>
            <p style={{ margin: '0 0 28px', fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 1.7 }}>
              Oracle · MySQL · PostgreSQL DB에 직접 연결하여<br />
              6개 품질 영역 자동 진단 · AI 표준화 추천 · ERD 자동 생성
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => navigate('/da/connect')}
                style={{ background: '#fff', color: '#065f46', border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
              >
                {connected ? '🔌 DB 재연결' : '🔌 DB 연결 시작'}
              </button>
              {connected && (
                <button
                  onClick={() => navigate('/da/setup')}
                  style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                >
                  ⚙️ 진단 항목 설정
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 워크플로우 */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ color: '#fff', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>📌 진단 워크플로우</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {STEPS.map((step, i) => (
              <button
                key={step.key}
                onClick={() => navigate(`/da/${step.key}`)}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 12,
                  padding: '16px 20px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.borderColor = 'rgba(16,185,129,0.4)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: '#10b981', fontWeight: 700, letterSpacing: '1px' }}>STEP {step.num}</span>
                  <span style={{ fontSize: 18 }}>{step.icon}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>{step.label}</div>
                <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>{step.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 6대 품질 영역 */}
        <div>
          <h2 style={{ color: '#fff', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>📚 6대 품질 진단 영역</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {QUALITY_AREAS.map(area => (
              <div key={area.label} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${area.color}30`, borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: area.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>{area.label}</span>
                  <span style={{ fontSize: 10, color: '#475569' }}>{area.eng}</span>
                </div>
                <p style={{ margin: 0, fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>{area.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DAMain;
