import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const STEPS = [
  { icon: '①', label: '시스템 개요 입력', desc: '시스템명, 주요기능, 키워드 입력 또는 문서 업로드' },
  { icon: '②', label: '기능 목록 생성', desc: 'AI가 LV1~LV3 기능목록 자동 생성 (쉼표로 여러 키워드 한번에)' },
  { icon: '③', label: 'FP 산정표 작성', desc: 'AI가 EI/EO/EQ/ILF/EIF 자동 분류 및 가중치 산정' },
  { icon: '④', label: '화면 목록 생성', desc: 'AI가 기능목록 기반 화면목록 자동 생성' },
  { icon: '⑤', label: '요구사항 정의서', desc: 'AI가 FR/NFR/제약사항 자동 생성' },
  { icon: '⑥', label: 'CRUD 분석', desc: 'AI가 기능×엔티티 매트릭스 자동 생성' },
  { icon: '💰', label: '개발비 산출', desc: '보정계수 적용 → 개발비/재개발비/유지관리비 자동 계산' },
];

const ProjectList = ({ projects, onCreateProject, onDeleteProject, onCopyProject }) => {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [showGuide, setShowGuide] = useState(false);

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

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 20px', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>

      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: '#111827' }}>
            SW사업 BA 산정 시스템
          </h1>
          <p style={{ color: '#6b7280', marginTop: 6, fontSize: 14 }}>
            FP 기능점수 산정 · 개발비/재개발비/유지관리비 · 화면목록 · 요구사항 · CRUD 분석
          </p>
          <p style={{ color: '#9ca3af', fontSize: 12, marginTop: 2 }}>
            2025년 SW사업 대가산정 가이드 기준 · Powered by AI
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowGuide(!showGuide)}
            style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #86efac', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            {showGuide ? '가이드 닫기' : '📖 사용 가이드'}
          </button>
          <button
            onClick={() => setShowForm(true)}
            style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            + 새 프로젝트
          </button>
        </div>
      </div>

      {/* A. 온보딩 가이드 */}
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
              💡 <strong>팁:</strong> 키워드 입력 시 쉼표로 구분하면 여러 업무를 한번에 생성할 수 있습니다.
              예: "연동계획, 연동운영, 연동관제, 체계운영, 체계관리" 입력 시 전체 기능목록 생성
            </p>
          </div>
        </div>
      )}

      {/* 프로젝트 생성 폼 */}
      {showForm && (
        <div style={{ background: '#f0f4ff', border: '1px solid #c7d2fe', borderRadius: 10, padding: 20, marginBottom: 24 }}>
          <p style={{ fontWeight: 600, marginBottom: 10, color: '#1e40af' }}>새 프로젝트 생성</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="프로젝트명 입력 (예: 국방연동관리체계 DIMS 고도화)"
              style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #a5b4fc', fontSize: 14, outline: 'none' }}
              autoFocus
            />
            <button onClick={handleCreate} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>생성</button>
            <button onClick={() => setShowForm(false)} style={{ background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 14, cursor: 'pointer' }}>취소</button>
          </div>
        </div>
      )}

      {/* 프로젝트 목록 */}
      {projects.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#9ca3af', border: '2px dashed #e5e7eb', borderRadius: 12 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
          <p style={{ fontSize: 16, marginBottom: 8, color: '#374151', fontWeight: 600 }}>프로젝트가 없습니다</p>
          <p style={{ fontSize: 14, marginBottom: 20 }}>새 프로젝트를 생성해서 FP 산정을 시작하세요</p>
          <button
            onClick={() => { setShowForm(true); setShowGuide(true); }}
            style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            + 첫 프로젝트 만들기
          </button>
        </div>
      ) : (
        <div>
          <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 12 }}>총 {projects.length}개 프로젝트</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {projects.map((project) => {
              const fpCount = (project.fpList || []).length;
              const funcCount = (project.functions || []).length;
              const hasScreens = (project.screenList || []).length > 0;
              const hasReqs = (project.reqList || []).length > 0;
              const hasCrud = (project.crudMatrix?.matrix || []).length > 0;

              return (
                <div
                  key={project.id}
                  onClick={() => navigate('/project/' + project.id)}
                  style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', transition: 'box-shadow 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <p style={{ fontWeight: 700, fontSize: 16, margin: 0, color: '#111827' }}>{project.name}</p>
                      {project.systemName && (
                        <span style={{ fontSize: 11, padding: '2px 8px', background: '#eff6ff', color: '#2563eb', borderRadius: 4, fontWeight: 500 }}>
                          {project.systemName}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {/* 진행상태 뱃지 */}
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: funcCount > 0 ? '#f0fdf4' : '#f9fafb', color: funcCount > 0 ? '#16a34a' : '#9ca3af', border: `1px solid ${funcCount > 0 ? '#86efac' : '#e5e7eb'}` }}>
                        기능 {funcCount}개
                      </span>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: fpCount > 0 ? '#fce7f3' : '#f9fafb', color: fpCount > 0 ? '#9d174d' : '#9ca3af', border: `1px solid ${fpCount > 0 ? '#f9a8d4' : '#e5e7eb'}` }}>
                        FP {project.fpSummary?.newDev || 0}점
                      </span>
                      {hasScreens && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd' }}>화면목록 ✓</span>}
                      {hasReqs && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#fff7ed', color: '#9a3412', border: '1px solid #fdba74' }}>요구사항 ✓</span>}
                      {hasCrud && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#fdf4ff', color: '#7e22ce', border: '1px solid #d8b4fe' }}>CRUD ✓</span>}
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>
                        {new Date(project.createdAt).toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginLeft: 16 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate('/project/' + project.id); }}
                      style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 6, padding: '6px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
                    >
                      열기
                    </button>
                    <button
                      onClick={(e) => handleCopy(e, project)}
                      style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #86efac', borderRadius: 6, padding: '6px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
                      title="프로젝트 복사"
                    >
                      복사
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); if (window.confirm('프로젝트를 삭제하시겠습니까?')) { onDeleteProject(project.id); } }}
                      style={{ background: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3', borderRadius: 6, padding: '6px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectList;
