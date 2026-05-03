import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const GUIDE_STEPS = [
  {
    num: '01',
    icon: '📋',
    title: '시스템 개요 입력',
    color: '#2563eb',
    desc: '분석할 시스템의 이름과 개요를 입력하거나 문서 파일을 업로드하세요. PDF, DOCX, Excel, 이미지 파일 모두 지원합니다.',
    tip: '💡 HWP 파일은 PDF로 변환 후 업로드하세요',
  },
  {
    num: '02',
    icon: '📝',
    title: 'AI 기능목록 자동 생성',
    color: '#7c3aed',
    desc: '키워드를 입력하면 AI가 LV1~LV3 계층 구조의 기능목록을 자동으로 생성합니다. 여러 업무를 한번에 생성하려면 쉼표로 구분하세요.',
    tip: '💡 예시: "연동계획, 연동운영, 체계관리" 입력 시 전체 기능 자동 생성',
  },
  {
    num: '03',
    icon: '📊',
    title: 'FP 기능점수 자동 산정',
    color: '#db2777',
    desc: 'AI가 IFPUG 국제표준 기준으로 EI/EO/EQ/ILF/EIF를 자동 분류하고 가중치를 산정합니다. 정통법과 간이법 모두 지원합니다.',
    tip: '💡 FP 검증 버튼으로 오류와 이상치를 자동으로 감지할 수 있습니다',
  },
  {
    num: '04',
    icon: '🖥️',
    title: '화면목록 · 요구사항 · CRUD',
    color: '#059669',
    desc: 'AI가 기능목록 기반으로 화면목록, 요구사항 정의서, CRUD 분석 매트릭스를 자동으로 생성합니다.',
    tip: '💡 인터페이스 정의서, WBS, 요구사항 추적표, 테스트케이스, AS-IS/TO-BE도 자동 생성됩니다',
  },
  {
    num: '05',
    icon: '💰',
    title: '개발비 · 재개발비 · 유지관리비',
    color: '#d97706',
    desc: '2025년 SW사업 대가산정 가이드 기준으로 보정계수를 적용한 개발비, 재개발비, 유지관리비를 자동으로 산출합니다.',
    tip: '💡 규모/연계복잡성/성능/보안성 보정계수 5종 자동 적용',
  },
];

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
  const [view, setView] = useState('list');

  const handleCreate = () => {
    if (!name.trim()) return alert('프로젝트명을 입력하세요.');
    onCreateProject(name.trim());
    setName('');
    setShowForm(false);
  };

  const handleCopy = (e, project) => {
    e.stopPropagation();
    const newName = prompt('복사할 프로젝트명:', project.name + ' (복사본)');
    if (!newName) return;
    onCopyProject(project, newName);
  };

  const totalFP = projects.reduce((sum, p) => sum + Number(p.fpSummary?.newDev || 0), 0);
  const totalFuncs = projects.reduce((sum, p) => sum + (p.functions || []).length, 0);
  const totalDevCost = Math.round(totalFP * 605784);

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', fontFamily: "'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif" }}>

      {/* 상단 네비게이션 */}
      <div style={{ background: '#1e3a5f', borderBottom: '1px solid #163058', padding: '0 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 56 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, background: '#3b82f6', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📐</div>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 18, letterSpacing: '-0.3px' }}>BA 도우미</span>
            <span style={{ color: '#64748b', fontSize: 12, marginLeft: 4 }}>v2.0</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: '#94a3b8', background: '#0f2744', padding: '3px 8px', borderRadius: 4 }}>
              2025 SW사업 대가산정 가이드 기준
            </span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px' }}>

        {/* 히어로 섹션 */}
        <div style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)', borderRadius: 16, padding: '32px 36px', marginBottom: 24, color: '#fff', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: -40, top: -40, width: 200, height: 200, background: 'rgba(255,255,255,0.04)', borderRadius: '50%' }} />
          <div style={{ position: 'absolute', right: 40, bottom: -60, width: 150, height: 150, background: 'rgba(255,255,255,0.04)', borderRadius: '50%' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <h1 style={{ margin: '0 0 8px', fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px' }}>
                  SW사업 BA 도우미
                </h1>
                <p style={{ margin: '0 0 20px', fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 1.6 }}>
                  기능점수 산정부터 개발비 산출까지 · AI 기반 자동 산출물 생성 시스템<br />
                  기능목록 · FP산정 · 화면목록 · 요구사항 · CRUD · WBS · 테스트케이스 · AS-IS/TO-BE
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setShowForm(true)}
                    style={{ background: '#fff', color: '#1e3a5f', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <span>+</span> 새 프로젝트
                  </button>
                  <button
                    onClick={() => setShowGuide(!showGuide)}
                    style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                  >
                    {showGuide ? '가이드 닫기' : '📖 사용 가이드'}
                  </button>
                  <div style={{ display: 'flex', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, overflow: 'hidden' }}>
                    <button onClick={() => setView('list')} style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: view === 'list' ? 'rgba(255,255,255,0.25)' : 'transparent', color: '#fff' }}>
                      목록
                    </button>
                    <button onClick={() => setView('dashboard')} style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: view === 'dashboard' ? 'rgba(255,255,255,0.25)' : 'transparent', color: '#fff' }}>
                      대시보드
                    </button>
                  </div>
                </div>
              </div>
              {/* 통계 */}
              {projects.length > 0 && (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {[
                    { label: '프로젝트', value: projects.length, unit: '개' },
                    { label: '총 기능', value: totalFuncs.toLocaleString(), unit: '개' },
                    { label: '총 FP', value: totalFP.toFixed(0), unit: 'FP' },
                    { label: '개발비 추정', value: (totalDevCost / 100000000).toFixed(1), unit: '억' },
                  ].map(s => (
                    <div key={s.label} style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '12px 16px', textAlign: 'center', minWidth: 80 }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{s.value}<span style={{ fontSize: 12, fontWeight: 400 }}>{s.unit}</span></div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 사용 가이드 */}
        {showGuide && (
          <div style={{ background: '#fff', borderRadius: 14, padding: '28px 32px', marginBottom: 24, border: '1px solid #e2e8f0', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e293b' }}>📖 사용 방법</h2>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>순서대로 따라하면 모든 BA 산출물이 자동으로 완성됩니다</p>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {GUIDE_STEPS.map((step) => (
                <div key={step.num} style={{ border: `1px solid ${step.color}20`, borderRadius: 12, padding: '18px 20px', background: `${step.color}06`, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', right: -8, top: -8, fontSize: 48, opacity: 0.06 }}>{step.icon}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 28, height: 28, background: step.color, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{step.icon}</div>
                    <div>
                      <div style={{ fontSize: 10, color: step.color, fontWeight: 700, letterSpacing: '0.5px' }}>STEP {step.num}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{step.title}</div>
                    </div>
                  </div>
                  <p style={{ margin: '0 0 10px', fontSize: 12, color: '#475569', lineHeight: 1.7 }}>{step.desc}</p>
                  <div style={{ background: `${step.color}15`, borderRadius: 6, padding: '6px 10px', fontSize: 11, color: step.color, fontWeight: 500 }}>{step.tip}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 프로젝트 생성 폼 */}
        {showForm && (
          <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', marginBottom: 20, border: '1px solid #bfdbfe', boxShadow: '0 2px 8px rgba(37,99,235,0.1)' }}>
            <p style={{ margin: '0 0 12px', fontWeight: 700, color: '#1e40af', fontSize: 15 }}>새 프로젝트 생성</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="프로젝트명 입력 (예: DIMS 고도화 사업)"
                style={{ flex: 1, padding: '11px 16px', borderRadius: 8, border: '1.5px solid #93c5fd', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
                autoFocus
              />
              <button onClick={handleCreate} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>생성</button>
              <button onClick={() => setShowForm(false)} style={{ background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 8, padding: '11px 16px', fontSize: 14, cursor: 'pointer' }}>취소</button>
            </div>
          </div>
        )}

        {/* 대시보드 */}
        {view === 'dashboard' && projects.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ background: '#fff', borderRadius: 14, padding: '24px 28px', marginBottom: 16, border: '1px solid #e2e8f0', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
              <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 700, color: '#1e293b' }}>📈 프로젝트별 완성도</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {projects.map(p => {
                  const progress = calcProgress(p);
                  const color = progress < 30 ? '#ef4444' : progress < 70 ? '#f59e0b' : '#10b981';
                  return (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '8px 12px', borderRadius: 8, transition: 'background 0.15s' }}
                      onClick={() => navigate('/project/' + p.id)}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ minWidth: 180, fontSize: 13, fontWeight: 600, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                      <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 20, height: 8, overflow: 'hidden' }}>
                        <div style={{ width: progress + '%', height: '100%', background: color, borderRadius: 20, transition: 'width 0.3s' }} />
                      </div>
                      <div style={{ minWidth: 40, fontSize: 12, fontWeight: 700, color, textAlign: 'right' }}>{progress}%</div>
                      <div style={{ minWidth: 60, fontSize: 11, color: '#94a3b8' }}>{(p.fpSummary?.newDev || 0)} FP</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ background: '#fff', borderRadius: 14, padding: '24px 28px', border: '1px solid #e2e8f0', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
              <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 700, color: '#1e293b' }}>📋 산출물 작성 현황</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
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
                  const color = pct === 100 ? '#10b981' : pct > 0 ? '#f59e0b' : '#e2e8f0';
                  return (
                    <div key={item.label} style={{ background: '#f8fafc', borderRadius: 10, padding: '14px', textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: pct > 0 ? '#1e293b' : '#cbd5e1' }}>{done}<span style={{ fontSize: 12, fontWeight: 400, color: '#94a3b8' }}>/{projects.length}</span></div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, marginBottom: 8 }}>{item.label}</div>
                      <div style={{ background: '#e2e8f0', borderRadius: 20, height: 4, overflow: 'hidden' }}>
                        <div style={{ width: pct + '%', height: '100%', background: color, borderRadius: 20 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 프로젝트 목록 */}
        {view === 'list' && (
          projects.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: 14, padding: '80px 40px', textAlign: 'center', border: '2px dashed #e2e8f0' }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>📋</div>
              <p style={{ fontSize: 17, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>아직 프로젝트가 없습니다</p>
              <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24, lineHeight: 1.6 }}>
                새 프로젝트를 만들고 AI가 자동으로<br />모든 BA 산출물을 생성하는 것을 경험해보세요
              </p>
              <button onClick={() => { setShowForm(true); setShowGuide(true); }} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 10, padding: '13px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                + 첫 프로젝트 만들기
              </button>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>총 {projects.length}개 프로젝트</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {projects.map((project) => {
                  const progress = calcProgress(project);
                  const progressColor = progress < 30 ? '#ef4444' : progress < 70 ? '#f59e0b' : '#10b981';
                  const funcCount = (project.functions || []).length;
                  const fpCount = (project.fpList || []).length;

                  const badges = [
                    { show: funcCount > 0, label: `기능 ${funcCount}개`, bg: '#f0fdf4', color: '#16a34a', border: '#86efac' },
                    { show: fpCount > 0, label: `FP ${Number(project.fpSummary?.newDev || 0).toFixed(0)}점`, bg: '#fdf2f8', color: '#9d174d', border: '#f9a8d4' },
                    { show: (project.screenList||[]).length > 0, label: '화면목록', bg: '#eff6ff', color: '#1e40af', border: '#93c5fd' },
                    { show: (project.reqList||[]).length > 0, label: '요구사항', bg: '#fff7ed', color: '#9a3412', border: '#fdba74' },
                    { show: (project.crudMatrix?.matrix||[]).length > 0, label: 'CRUD', bg: '#faf5ff', color: '#7e22ce', border: '#d8b4fe' },
                    { show: (project.ifList||[]).length > 0, label: '인터페이스', bg: '#f0fdfa', color: '#0f766e', border: '#99f6e4' },
                    { show: (project.wbsList||[]).length > 0, label: 'WBS', bg: '#f0f9ff', color: '#0369a1', border: '#7dd3fc' },
                    { show: (project.tcList||[]).length > 0, label: '테스트', bg: '#fefce8', color: '#854d0e', border: '#fde047' },
                  ].filter(b => b.show);

                  return (
                    <div
                      key={project.id}
                      onClick={() => navigate('/project/' + project.id)}
                      style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '18px 22px', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)'; e.currentTarget.style.borderColor = '#bfdbfe'; }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                            <p style={{ fontWeight: 700, fontSize: 15, margin: 0, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.name}</p>
                            {project.systemName && (
                              <span style={{ fontSize: 11, padding: '2px 8px', background: '#eff6ff', color: '#2563eb', borderRadius: 4, fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0 }}>{project.systemName}</span>
                            )}
                          </div>

                          {/* 완성도 바 */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                            <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 20, height: 5, overflow: 'hidden' }}>
                              <div style={{ width: progress + '%', height: '100%', background: progressColor, borderRadius: 20 }} />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: progressColor, minWidth: 32 }}>{progress}%</span>
                            <span style={{ fontSize: 11, color: '#94a3b8' }}>{new Date(project.createdAt).toLocaleDateString('ko-KR')}</span>
                          </div>

                          {/* 뱃지 */}
                          {badges.length > 0 && (
                            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                              {badges.map((b, i) => (
                                <span key={i} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: b.bg, color: b.color, border: `1px solid ${b.border}`, fontWeight: 500 }}>
                                  {b.label}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* 버튼 */}
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate('/project/' + project.id); }}
                            style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                          >열기</button>
                          <button
                            onClick={(e) => handleCopy(e, project)}
                            style={{ background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 7, padding: '7px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
                          >복사</button>
                          <button
                            onClick={(e) => { e.stopPropagation(); if (window.confirm('프로젝트를 삭제하시겠습니까?')) onDeleteProject(project.id); }}
                            style={{ background: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3', borderRadius: 7, padding: '7px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
                          >삭제</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        )}

        {/* 푸터 */}
        <div style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>BA 도우미 · 2025년 SW사업 대가산정 가이드 기준 · FP 단가 605,784원</p>
          <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>Powered by Claude AI</p>
        </div>
      </div>
    </div>
  );
};

export default ProjectList;
