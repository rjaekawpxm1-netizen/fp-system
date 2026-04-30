import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ProjectList = ({ projects, onCreateProject, onDeleteProject }) => {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');

  const handleCreate = () => {
    if (!name.trim()) return alert('프로젝트명을 입력하세요.');
    onCreateProject(name.trim());
    setName('');
    setShowForm(false);
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>FP 기능점수 산정 시스템</h1>
          <p style={{ color: '#666', marginTop: 6, fontSize: 14 }}>SW사업 대가산정 가이드 2025 기준</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
        >
          + 새 프로젝트
        </button>
      </div>

      {showForm && (
        <div style={{ background: '#f0f4ff', border: '1px solid #c7d2fe', borderRadius: 10, padding: 20, marginBottom: 24 }}>
          <p style={{ fontWeight: 600, marginBottom: 10 }}>새 프로젝트 생성</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="프로젝트명 입력 (예: 국방연동관리체계 DIMS)"
              style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #a5b4fc', fontSize: 14, outline: 'none' }}
            />
            <button onClick={handleCreate} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>생성</button>
            <button onClick={() => setShowForm(false)} style={{ background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 14, cursor: 'pointer' }}>취소</button>
          </div>
        </div>
      )}

      {projects.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#9ca3af', border: '2px dashed #e5e7eb', borderRadius: 12 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
          <p style={{ fontSize: 16, marginBottom: 8 }}>프로젝트가 없습니다</p>
          <p style={{ fontSize: 14 }}>새 프로젝트를 생성해서 FP 산정을 시작하세요</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {projects.map((project) => (
            <div
              key={project.id}
              style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
              onClick={() => navigate('/project/' + project.id)}
            >
              <div>
                <p style={{ fontWeight: 600, fontSize: 16, margin: 0 }}>{project.name}</p>
                <p style={{ color: '#6b7280', fontSize: 13, marginTop: 4 }}>
                  {project.systemName ? 'System: ' + project.systemName + ' · ' : ''}
                  신규 {project.fpSummary ? project.fpSummary.newDev : 0} FP · 변경 {project.fpSummary ? project.fpSummary.changed : 0} FP · 생성일: {new Date(project.createdAt).toLocaleDateString('ko-KR')}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); navigate('/project/' + project.id); }}
                  style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 6, padding: '6px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
                >
                  열기
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); if (window.confirm('프로젝트를 삭제하시겠습니까?')) { onDeleteProject(project.id); } }}
                  style={{ background: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3', borderRadius: 6, padding: '6px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectList;
