import { useNavigate } from 'react-router-dom';

const Home = () => {
  const navigate = useNavigate();

  const tools = [
    {
      key: 'ba',
      label: 'BA',
      fullName: 'Business Analyst',
      korean: '업무 분석',
      desc: '기능점수 산정 · 요구사항 정의 · 화면목록 · WBS · 개발비 산출',
      icon: '📋',
      color: '#2563eb',
      bg: 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)',
      available: true,
      badge: '사용 가능',
    },
    {
      key: 'aa',
      label: 'AA',
      fullName: 'Application Architect',
      korean: '응용 아키텍처',
      desc: '시스템 아키텍처 설계 · 컴포넌트 설계 · 인터페이스 설계',
      icon: '🏗️',
      color: '#7c3aed',
      bg: 'linear-gradient(135deg, #5b21b6 0%, #7c3aed 100%)',
      available: false,
      badge: '준비 중',
    },
    {
      key: 'da',
      label: 'DA',
      fullName: 'Data Architect',
      korean: '데이터 아키텍처',
      desc: 'ERD 설계 · 테이블 정의서 · 데이터 표준 · 품질 진단',
      icon: '🗄️',
      color: '#059669',
      bg: 'linear-gradient(135deg, #065f46 0%, #059669 100%)',
      available: false,
      badge: '준비 중',
    },
    {
      key: 'ta',
      label: 'TA',
      fullName: 'Technical Architect',
      korean: '기술 아키텍처',
      desc: '서버 규모 산정 · 네트워크 설계 · 보안 아키텍처 · 인프라 설계',
      icon: '⚙️',
      color: '#dc2626',
      bg: 'linear-gradient(135deg, #991b1b 0%, #dc2626 100%)',
      available: false,
      badge: '준비 중',
    },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f1923',
      fontFamily: "'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif",
      display: 'flex',
      flexDirection: 'column',
    }}>

      {/* 상단 네비 */}
      <div style={{ padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #2563eb, #7c3aed)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, color: '#fff' }}>C</div>
          <div>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 16, letterSpacing: '0.5px' }}>CAS IT</div>
            <div style={{ color: '#64748b', fontSize: 10, letterSpacing: '1px' }}>CONSULTING</div>
          </div>
        </div>
        <div style={{ color: '#475569', fontSize: 12 }}>IT 컨설팅 통합 플랫폼</div>
      </div>

      {/* 중앙 메인 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>

        {/* 큰 로고/타이틀 */}
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 80, height: 80, background: 'linear-gradient(135deg, #2563eb, #7c3aed)', borderRadius: 24, marginBottom: 24, boxShadow: '0 0 60px rgba(37,99,235,0.4)' }}>
            <span style={{ fontSize: 40 }}>⚡</span>
          </div>
          <h1 style={{ margin: '0 0 12px', fontSize: 42, fontWeight: 900, color: '#fff', letterSpacing: '-1px', lineHeight: 1.1 }}>
            IT 컨설팅 도우미
          </h1>
          <p style={{ margin: 0, fontSize: 16, color: '#64748b', letterSpacing: '0.3px' }}>
            AI 기반 자동화 · 2025 SW사업 대가산정 가이드 기준
          </p>
        </div>

        {/* BA / AA / DA / TA 카드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, maxWidth: 1000, width: '100%' }}>
          {tools.map((tool) => (
            <div
              key={tool.key}
              onClick={() => tool.available && navigate('/ba')}
              style={{
                background: tool.available ? '#1a2535' : '#131c27',
                border: `1px solid ${tool.available ? tool.color + '40' : '#1e2d3d'}`,
                borderRadius: 20,
                padding: '28px 24px',
                cursor: tool.available ? 'pointer' : 'default',
                transition: 'all 0.25s',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={e => {
                if (!tool.available) return;
                e.currentTarget.style.transform = 'translateY(-6px)';
                e.currentTarget.style.boxShadow = `0 20px 60px ${tool.color}30`;
                e.currentTarget.style.borderColor = tool.color + '80';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.borderColor = tool.available ? tool.color + '40' : '#1e2d3d';
              }}
            >
              {/* 배경 글로우 */}
              {tool.available && (
                <div style={{ position: 'absolute', top: -40, right: -40, width: 120, height: 120, background: tool.color + '15', borderRadius: '50%', pointerEvents: 'none' }} />
              )}

              {/* 뱃지 */}
              <div style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: tool.available ? tool.color + '20' : '#1e2d3d', color: tool.available ? tool.color : '#3d5068', letterSpacing: '0.5px', marginBottom: 20 }}>
                {tool.badge}
              </div>

              {/* 아이콘 + 라벨 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                <div style={{ width: 52, height: 52, background: tool.available ? tool.bg : '#1e2d3d', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                  {tool.available ? tool.icon : <span style={{ fontSize: 20, opacity: 0.3 }}>{tool.icon}</span>}
                </div>
                <div>
                  <div style={{ fontSize: 32, fontWeight: 900, color: tool.available ? '#fff' : '#2d4056', lineHeight: 1, letterSpacing: '-1px' }}>{tool.label}</div>
                  <div style={{ fontSize: 11, color: tool.available ? tool.color : '#2d4056', fontWeight: 600, marginTop: 2 }}>{tool.fullName}</div>
                </div>
              </div>

              {/* 한글명 */}
              <div style={{ fontSize: 15, fontWeight: 700, color: tool.available ? '#e2e8f0' : '#2d4056', marginBottom: 10 }}>
                {tool.korean} 도우미
              </div>

              {/* 설명 */}
              <p style={{ margin: '0 0 24px', fontSize: 12, color: tool.available ? '#64748b' : '#1e2d3d', lineHeight: 1.7 }}>
                {tool.desc}
              </p>

              {/* 버튼 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {tool.available ? (
                  <>
                    <div style={{ flex: 1, height: 40, background: tool.bg, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff' }}>
                      시작하기 →
                    </div>
                  </>
                ) : (
                  <div style={{ flex: 1, height: 40, background: '#1e2d3d', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: '#2d4056' }}>
                    준비 중
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 하단 설명 */}
        <p style={{ marginTop: 48, fontSize: 12, color: '#334155', textAlign: 'center', lineHeight: 1.8 }}>
          BA 도우미는 현재 사용 가능합니다 · AA, DA, TA 도우미는 순차적으로 출시 예정
        </p>
      </div>

      {/* 푸터 */}
      <div style={{ padding: '20px 40px', borderTop: '1px solid #1e2d3d', display: 'flex', justifyContent: 'space-between' }}>
        <p style={{ margin: 0, fontSize: 11, color: '#334155' }}>CAS IT Consulting · IT 컨설팅 통합 플랫폼</p>
        <p style={{ margin: 0, fontSize: 11, color: '#334155' }}>Powered by Claude AI</p>
      </div>
    </div>
  );
};

export default Home;
