import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getConnectStatus } from '../utils/daApi';

  const STEPS = [
  { num: '01', icon: '🔌', title: 'DB 연결', desc: 'Oracle·MySQL·PostgreSQL 직접 연결 또는 CSV/Excel 파일 업로드', tip: '💡 Oracle Wallet 파일 업로드 방식도 지원합니다', color: '#2563eb' },
  { num: '02', icon: '⚙️', title: '진단 항목 설정', desc: '테이블 선택 후 컬럼별 진단 규칙을 설정합니다. 타입에 따라 자동 추천됩니다', tip: '💡 DATE/NUMBER/TEXT 타입별로 기본 규칙이 자동 설정됩니다', color: '#7c3aed' },
  { num: '03', icon: '▶️', title: '진단 실행', desc: '6개 품질 영역(완전성·일관성·정확성·유용성·유일성·유효성) 자동 진단', tip: '💡 진단 완료 후 오류 데이터 원본을 바로 확인할 수 있습니다', color: '#db2777' },
  { num: '04', icon: '📈', title: '결과 분석', desc: '영역별 등급, 레이더 차트, 드릴다운으로 오류 원본 데이터 추적', tip: '💡 Claude AI가 진단 결과를 분석하고 개선 방안을 제시합니다', color: '#059669' },
  { num: '05', icon: '📄', title: '보고서 출력', desc: 'Excel 3시트(진단개요·상세결과·영역별요약) + PDF 공문 형식 출력', tip: '💡 진단 이력이 자동으로 저장되어 추이를 비교할 수 있습니다', color: '#d97706' },
  { num: '06', icon: '🤖', title: 'AI 표준화 추천', desc: '공통표준용어 13,177개 기반 컬럼명 표준화 · 영문약어 자동 추천 · DDL 생성', tip: '💡 DB 연결 없이 컬럼명 직접 입력으로도 사용 가능합니다', color: '#059669' },
];

const QUALITY_AREAS = [
  { label: '완전성', eng: 'Completeness', color: '#2563eb', bg: '#eff6ff', desc: '필수값 누락, 공백값 검사' },
  { label: '일관성', eng: 'Consistency',  color: '#059669', bg: '#f0fdf4', desc: '앞뒤 공백 등 형식 일관성' },
  { label: '정확성', eng: 'Accuracy',     color: '#d97706', bg: '#fffbeb', desc: '비정상 특수문자 검사' },
  { label: '유용성', eng: 'Usefulness',   color: '#ca8a04', bg: '#fefce8', desc: 'N/A, 테스트 등 더미 데이터' },
  { label: '유일성', eng: 'Uniqueness',   color: '#7c3aed', bg: '#faf5ff', desc: '단일/복합키 중복 검사' },
  { label: '유효성', eng: 'Validity',     color: '#dc2626', bg: '#fef2f2', desc: '날짜 형식, 숫자 혼입 검사' },
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
    <div style={{ minHeight: '100vh', background: '#f0f2f5', fontFamily: "'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif" }}>

      {/* 네비게이션 */}
      <div style={{ background: '#1e3a5f', borderBottom: '1px solid #163058', padding: '0 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 56 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 18 }}>←</button>
            <div style={{ width: 28, height: 28, background: 'linear-gradient(135deg, #059669, #10b981)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🗄️</div>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>DA 도우미</span>
            <span style={{ color: '#64748b', fontSize: 11 }}>v1.0</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {connected ? (
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(16,185,129,0.2)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.3)', fontWeight: 600 }}>
                ✅ {dbType} 연결됨
              </span>
            ) : (
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(239,68,68,0.2)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)', fontWeight: 600 }}>
                ❌ 미연결
              </span>
            )}
            <span style={{ fontSize: 11, color: '#94a3b8' }}>행안부 공공데이터 표준화 관리 매뉴얼 2026 기준</span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px' }}>

        {/* 히어로 */}
        <div style={{ background: 'linear-gradient(135deg, #065f46 0%, #059669 100%)', borderRadius: 16, padding: '32px 36px', marginBottom: 24, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: -40, top: -40, width: 200, height: 200, background: 'rgba(255,255,255,0.04)', borderRadius: '50%' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <h1 style={{ margin: '0 0 8px', fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
                  공공데이터 품질진단 시스템
                </h1>
                <p style={{ margin: '0 0 20px', fontSize: 14, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 }}>
                  Oracle · MySQL · PostgreSQL DB 직접 연결 · 6개 품질 영역 자동 진단<br />
                  AI 표준화 추천 · ERD 자동 생성 · Excel/PDF 보고서 출력
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => navigate('/da/connect')} style={{ background: '#fff', color: '#065f46', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                    {connected ? '🔌 DB 재연결' : '🔌 DB 연결 시작'}
                  </button>
                  <button onClick={() => setShowGuide(!showGuide)} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    {showGuide ? '가이드 닫기' : '📖 사용 가이드'}
                  </button>
                  {connected && (
                    <button onClick={() => navigate('/da/setup')} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      ⚙️ 진단 시작
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 사용 가이드 */}
        {showGuide && (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '24px 28px', marginBottom: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>📖 사용 방법</h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>순서대로 따라하면 품질진단 보고서가 자동으로 완성됩니다</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {STEPS.map((step) => (
                <div key={step.num} style={{ border: `1px solid ${step.color}20`, borderRadius: 12, padding: '16px 18px', background: `${step.color}06`, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', right: -8, top: -8, fontSize: 40, opacity: 0.06 }}>{step.icon}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 26, height: 26, background: step.color, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{step.icon}</div>
                    <div>
                      <div style={{ fontSize: 10, color: step.color, fontWeight: 700 }}>STEP {step.num}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{step.title}</div>
                    </div>
                  </div>
                  <p style={{ margin: '0 0 8px', fontSize: 12, color: '#475569', lineHeight: 1.6 }}>{step.desc}</p>
                  <div style={{ background: `${step.color}15`, borderRadius: 6, padding: '5px 9px', fontSize: 11, color: step.color, fontWeight: 500 }}>{step.tip}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 워크플로우 */}
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ color: '#1e293b', fontSize: 15, fontWeight: 700, marginBottom: 14 }}>📌 진단 워크플로우</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {STEPS.map((step) => (
              <button
                key={step.num}
                onClick={() => {
                  const routes = { '01': '/da/connect', '02': '/da/setup', '03': '/da/setup', '04': '/da/result', '05': '/da/result', '06': '/da/standard' };
                  navigate(routes[step.num] || '/da');
                }}
                style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 14px', cursor: 'pointer', textAlign: 'left', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; e.currentTarget.style.borderColor = step.color + '60'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
              >
                <div style={{ fontSize: 10, color: step.color, fontWeight: 700, marginBottom: 6 }}>STEP {step.num}</div>
                <div style={{ fontSize: 20, marginBottom: 6 }}>{step.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>{step.title}</div>
                <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>{step.desc.split('·')[0]}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 6대 품질 영역 */}
        <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', border: '1px solid #e2e8f0', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
          <h2 style={{ color: '#1e293b', fontSize: 15, fontWeight: 700, marginBottom: 14 }}>📚 6대 품질 진단 영역</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {QUALITY_AREAS.map(area => (
              <div key={area.label} style={{ background: area.bg, border: `1px solid ${area.color}20`, borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: area.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{area.label}</span>
                  <span style={{ fontSize: 10, color: '#94a3b8' }}>{area.eng}</span>
                </div>
                <p style={{ margin: 0, fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>{area.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 푸터 */}
        <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
          <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>DA 도우미 · 행정안전부 공공데이터베이스 표준화 관리 매뉴얼 2026 기준</p>
          <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>Powered by Claude AI</p>
        </div>
      </div>
    </div>
  );
};

export default DAMain;
