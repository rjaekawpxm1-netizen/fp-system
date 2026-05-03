import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const STEPS = [
  { icon: '①', label: '시스템 개요 입력', desc: '시스템명, 주요기능, 키워드 입력 또는 문서 업로드' },
  { icon: '②', label: '기능 목록 생성', desc: 'AI가 LV1~LV3 기능목록 자동 생성 (쉼표로 여러 키워드 한번에)' },
  { icon: '③', label: 'FP 산정표 작성', desc: 'AI가 EI/EO/EQ/ILF/EIF 자동 분류 및 가중치 산정' },
  { icon: '④', label: '화면목록/요구사항', desc: 'AI가 화면목록, 요구사항, CRUD, 인터페이스, WBS, 테스트케이스 자동 생성' },
  { icon: '💰', label: '개발비 산출', desc: '보정계수 적용 → 개발비/재개발비/유지관리비 자동 계산' },
];

// 프로젝트 완성도 계산
const calcProgress = (project) => {
  const checks = [
    !!project.systemName,
    (project.functions || []).length > 0,
    (project.fpList || []).length > 0,
    (project.screenList || []).length > 0,
    (project.reqList || []).length > 0,
    (project.crudMatrix?.matrix || []).length > 0,
    (project.ifList || []).length > 0,
    (project.wbsList || []).length > 0,
    (project.traceList || []).length > 0,
    (project.tcList || []).length > 0,
  ];
  return Math.round(checks.filter(Boolean).length / checks.length * 100);
};

const ProjectList = ({ projects, onCreateProject, onDeleteProject, onCopyProject }) => {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const [view, setView] = useState('list'); // list | dashboard

  const handleCreate = () => {
    if (!name.trim()) return alert('프로젝트명을 입력하세요.');
    onCreateProject(name.trim());
    setName('');
    setShowForm(false);
  };

  const handleCopy = (e, project) => {
    e.stopPropagation();
    const newName = prompt('복사할 프로젝트명을 입력하세요:', project.name + ' (복사본)');
    if (!newName) return;
    onCopyProject(project, newName);
  };

  // 전체 통계
  const totalFP = projects.reduce((sum, p) => sum + Number(p.fpSummary?.newDev || 0), 0);
  const totalFuncs = projects.reduce((sum, p) => sum + (p.functions || []).length, 0);
  const FP_UNIT = 605784;
  const totalDevCost = Math.round(totalFP * FP_UNIT);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 20px', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>

      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: '#111827' }}>
            SW사업 BA 산정 시스템
          </h1>
          <p style={{ color: '#6b7280', marginTop: 6, fontSize: 14 }}>
            FP 기능점수 산정 · 개발비/재개발비/유지관리비 · 화면목록 · 요구사항 · CRUD · WBS · 테스트케이스
          </p>
          <p style={{ color: '#9ca3af', fontSize: 12, marginTop: 2 }}>
            2025년 SW사업 대가산정 가이드 기준 · Powered by AI
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {/* 뷰 전환 */}
          <div style={{ display: 'flex', border: '1px solid #d1d5db', borderRadius: 8, overflow: 'hidden' }}>
            <button onClick={() => setView('list')} style={{ padding: '8px 14px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: view === 'list' ? '#2563eb' : '#fff', color: view === 'list' ? '#fff' : '#374151' }}>
              📋 목록
            </button>
            <button onClick={() => setView('dashboard')} style={{ padding: '8px 14px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: view === 'dashboard' ? '#2563eb' : '#fff', color: view === 'dashboard' ? '#fff' : '#374151' }}>
              📊 대시보드
            </button>
          </div>
          <button onClick={() => setShowGuide(!showGuide)} style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #86efac', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {showGuide ? '가이드 닫기' : '📖 사용 가이드'}
          </button>
          <button onClick={() => setShowForm(true)} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            + 새 프로젝트
          </button>
        </div>
      </div>

      {/* 온보딩 가이드 */}
      {showGuide && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12, padding: '20px 24px', marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#166534' }}>📖 사용 순서 가이드</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {STEPS.map((s) => (
              <div key={s.icon} style={{ background: '#fff', borderRadius: 8, padding: '12px 14px', border: '1px solid #86efac' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#16a34a' }}>{s.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#166534' }}>{s.label}</span>
                </div>
                <p style={{ fontSize: 11, color: '#6b7280', margin: 0, lineHeight: 1.5 }}>{s.desc}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, padding: '10px 14px', background: '#fff', borderRadius: 8, border: '1px solid #86efac' }}>
            <p style={{ fontSize: 12, color: '#374151', margin: 0 }}>
              💡 <strong>팁:</strong> 키워드에 쉼표로 구분하면 여러 업무를 한번에 생성합니다. 예: "연동계획, 연동운영, 연동관제, 체계운영, 체계관리"
            </p>
          </div>
        </div>
      )}

      {/* 프로젝트 생성 폼 */}
      {showForm && (
        <div style={{ background: '#f0f4ff', border: '1px solid #c7d2fe', borderRadius: 10, padding: 20, marginBottom: 24 }}>
          <p style={{ fontWeight: 600, marginBottom: 10, color: '#1e40af' }}>새 프로젝트 생성</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreate()} placeholder="프로젝트명 입력 (예: 국방연동관리체계 DIMS 고도화)" style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #a5b4fc', fontSize: 14, outline: 'none' }} autoFocus />
            <button onClick={handleCreate} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>생성</button>
            <button onClick={() => setShowForm(false)} style={{ background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 14, cursor: 'pointer' }}>취소</button>
          </div>
        </div>
      )}

      {/* 대시보드 뷰 */}
      {view === 'dashboard' && projects.length > 0 && (
        <div>
          {/* 전체 통계 카드 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
            {[
              { label: '전체 프로젝트', value: projects.length + '개', icon: '📁', bg: '#eff6ff', color: '#1e40af' },
              { label: '총 기능 수', value: totalFuncs.toLocaleString() + '개', icon: '📝', bg: '#f0fdf4', color: '#166534' },
              { label: '총 FP 합계', value: totalFP.toFixed(1) + ' FP', icon: '📊', bg: '#fce7f3', color: '#9d174d' },
              { label: '총 개발비 추정', value: (totalDevCost / 100000000).toFixed(1) + '억원', icon: '💰', bg: '#fff7ed', color: '#9a3412' },
            ].map((stat) => (
              <div key={stat.label} style={{ background: stat.bg, borderRadius: 10, padding: '16px 20px' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>{stat.icon}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* 프로젝트별 완성도 */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px', marginBottom: 24 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>📈 프로젝트별 산출물 완성도</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {projects.map(p => {
                const progress = calcProgress(p);
                const progressColor = progress < 30 ? '#ef4444' : progress < 70 ? '#f59e0b' : '#16a34a';
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => navigate('/project/' + p.id)}>
                    <div style={{ minWidth: 160, fontSize: 13, fontWeight: 500, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    <div style={{ flex: 1, background: '#f3f4f6', borderRadius: 20, height: 8, overflow: 'hidden' }}>
                      <div style={{ width: progress + '%', height: '100%', background: progressColor, borderRadius: 20, transition: 'width 0.3s' }} />
                    </div>
                    <div style={{ minWidth: 40, fontSize: 12, fontWeight: 700, color: progressColor, textAlign: 'right' }}>{progress}%</div>
                    <div style={{ minWidth: 60, fontSize: 11, color: '#9ca3af' }}>{(p.fpSummary?.newDev || 0)} FP</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 산출물별 현황 */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>📋 산출물별 작성 현황</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
              {[
                { label: '기능목록', key: p => (p.functions||[]).length > 0 },
                { label: 'FP산정표', key: p => (p.fpList||[]).length > 0 },
                { label: '화면목록', key: p => (p.screenList||[]).length > 0 },
                { label: '요구사항', key: p => (p.reqList||[]).length > 0 },
                { label: 'CRUD분석', key: p => (p.crudMatrix?.matrix||[]).length > 0 },
                { label: '인터페이스', key: p => (p.ifList||[]).length > 0 },
                { label: 'WBS', key: p => (p.wbsList||[]).length > 0 },
                { label: '추적표', key: p => (p.traceList||[]).length > 0 },
                { label: '테스트케이스', key: p => (p.tcList||[]).length > 0 },
              ].map(item => {
                const done = projects.filter(item.key).length;
                const pct = projects.length > 0 ? Math.round(done / projects.length * 100) : 0;
                return (
                  <div key={item.label} style={{ background: '#f8fafc', borderRadius: 8, padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: pct === 100 ? '#16a34a' : pct > 0 ? '#f59e0b' : '#d1d5db' }}>{done}/{projects.length}</div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>{item.label}</div>
                    <div style={{ background: '#e5e7eb', borderRadius: 20, height: 4, marginTop: 6, overflow: 'hidden' }}>
                      <div style={{ width: pct + '%', height: '100%', background: pct === 100 ? '#16a34a' : '#f59e0b', borderRadius: 20 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 목록 뷰 */}
      {view === 'list' && (
        projects.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#9ca3af', border: '2px dashed #e5e7eb', borderRadius: 12 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
            <p style={{ fontSize: 16, marginBottom: 8, color: '#374151', fontWeight: 600 }}>프로젝트가 없습니다</p>
            <p style={{ fontSize: 14, marginBottom: 20 }}>새 프로젝트를 생성해서 FP 산정을 시작하세요</p>
            <button onClick={() => { setShowForm(true); setShowGuide(true); }} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              + 첫 프로젝트 만들기
            </button>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 12 }}>총 {projects.length}개 프로젝트</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {projects.map((project) => {
                const progress = calcProgress(project);
                const progressColor = progress < 30 ? '#ef4444' : progress < 70 ? '#f59e0b' : '#16a34a';
                const funcCount = (project.functions || []).length;
                const fpCount = (project.fpList || []).length;
                const hasScreens = (project.screenList || []).length > 0;
                const hasReqs = (project.reqList || []).length > 0;
                const hasCrud = (project.crudMatrix?.matrix || []).length > 0;
                const hasIf = (project.ifList || []).length > 0;
                const hasWbs = (project.wbsList || []).length > 0;
                const hasTc = (project.tcList || []).length > 0;

                return (
                  <div key={project.id} onClick={() => navigate('/project/' + project.id)}
                    style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 20px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', transition: 'all 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          <p style={{ fontWeight: 700, fontSize: 15, margin: 0, color: '#111827' }}>{project.name}</p>
                          {project.systemName && (
                            <span style={{ fontSize: 11, padding: '2px 8px', background: '#eff6ff', color: '#2563eb', borderRadius: 4, fontWeight: 500 }}>{project.systemName}</span>
                          )}
                          <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 'auto' }}>
                            {new Date(project.createdAt).toLocaleDateString('ko-KR')}
                          </span>
                        </div>

                        {/* 완성도 바 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <div style={{ flex: 1, background: '#f3f4f6', borderRadius: 20, height: 6, overflow: 'hidden' }}>
                            <div style={{ width: progress + '%', height: '100%', background: progressColor, borderRadius: 20 }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: progressColor, minWidth: 32 }}>{progress}%</span>
                        </div>

                        {/* 산출물 뱃지 */}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: funcCount > 0 ? '#f0fdf4' : '#f9fafb', color: funcCount > 0 ? '#16a34a' : '#9ca3af', border: `1px solid ${funcCount > 0 ? '#86efac' : '#e5e7eb'}` }}>기능 {funcCount}</span>
                          <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: fpCount > 0 ? '#fce7f3' : '#f9fafb', color: fpCount > 0 ? '#9d174d' : '#9ca3af', border: `1px solid ${fpCount > 0 ? '#f9a8d4' : '#e5e7eb'}` }}>FP {project.fpSummary?.newDev || 0}</span>
                          {hasScreens && <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd' }}>화면 ✓</span>}
                          {hasReqs && <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: '#fff7ed', color: '#9a3412', border: '1px solid #fdba74' }}>요구사항 ✓</span>}
                          {hasCrud && <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: '#fdf4ff', color: '#7e22ce', border: '1px solid #d8b4fe' }}>CRUD ✓</span>}
                          {hasIf && <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: '#f0fdfa', color: '#0f766e', border: '1px solid #99f6e4' }}>인터페이스 ✓</span>}
                          {hasWbs && <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: '#f0f9ff', color: '#0369a1', border: '1px solid #7dd3fc' }}>WBS ✓</span>}
                          {hasTc && <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: '#fef9c3', color: '#854d0e', border: '1px solid #fde047' }}>테스트 ✓</span>}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 6, marginLeft: 16, flexShrink: 0 }}>
                        <button onClick={(e) => { e.stopPropagation(); navigate('/project/' + project.id); }} style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>열기</button>
                        <button onClick={(e) => handleCopy(e, project)} style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #86efac', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>복사</button>
                        <button onClick={(e) => { e.stopPropagation(); if (window.confirm('삭제하시겠습니까?')) onDeleteProject(project.id); }} style={{ background: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>삭제</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}
    </div>
  );
};

export default ProjectList;
