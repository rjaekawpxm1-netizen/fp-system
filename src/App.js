import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ProjectList from './pages/ProjectList';
import ProjectDetail from './pages/ProjectDetail';
import CostCalculator from './pages/CostCalculator';
import RebuildCost from './pages/RebuildCost';
import MaintenanceCost from './pages/MaintenanceCost';
import {
  fetchProjects,
  createProject as dbCreateProject,
  updateProject as dbUpdateProject,
  deleteProject as dbDeleteProject,
} from './utils/supabase';

const App = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 프로젝트 목록 불러오기
  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchProjects();
      setProjects(data);
    } catch (err) {
      console.error('프로젝트 로드 실패:', err);
      setError('데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // 프로젝트 생성
  const handleCreateProject = async (name) => {
    const newProject = {
      id: Date.now().toString(),
      name,
      systemName: '',
      systemOverview: '',
      mainFunctions: '',
      relatedOrgs: '',
      functions: [],
      fpList: [],
      fpSummary: { newDev: 0, changed: 0 },
      screenList: [],
      reqList: [],
      crudMatrix: { entities: [], matrix: [] },
    };
    try {
      const created = await dbCreateProject(newProject);
      setProjects((prev) => [created, ...prev]);
    } catch (err) {
      alert('프로젝트 생성 실패: ' + err.message);
    }
  };

  // 프로젝트 삭제
  const handleDeleteProject = async (id) => {
    try {
      await dbDeleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      alert('삭제 실패: ' + err.message);
    }
  };

  // 프로젝트 업데이트 (디바운스 적용)
  const updateTimers = {};
  const handleUpdateProject = useCallback((id, updates) => {
    // 즉시 UI 반영
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );

    // DB 저장은 500ms 디바운스
    if (updateTimers[id]) clearTimeout(updateTimers[id]);
    updateTimers[id] = setTimeout(async () => {
      try {
        await dbUpdateProject(id, updates);
      } catch (err) {
        console.error('저장 실패:', err);
      }
    }, 500);
  }, []);

  // 프로젝트 복사 (D. 프로젝트 복사)
  const handleCopyProject = async (project, newName) => {
    const copied = {
      ...project,
      id: Date.now().toString(),
      name: newName,
      createdAt: new Date().toISOString(),
    };
    try {
      const created = await dbCreateProject(copied);
      setProjects((prev) => [created, ...prev]);
    } catch (err) {
      alert('복사 실패: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: 16, fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
        <div style={{ fontSize: 36 }}>⚙️</div>
        <p style={{ fontSize: 16, color: '#374151', fontWeight: 600 }}>데이터 불러오는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: 16, fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
        <div style={{ fontSize: 36 }}>⚠️</div>
        <p style={{ fontSize: 16, color: '#dc2626' }}>{error}</p>
        <button onClick={loadProjects} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer' }}>
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
        <Routes>
          <Route
            path="/"
            element={
              <ProjectList
                projects={projects}
                onCreateProject={handleCreateProject}
                onDeleteProject={handleDeleteProject}
                onCopyProject={handleCopyProject}
              />
            }
          />
          <Route
            path="/project/:id"
            element={
              <ProjectDetail
                projects={projects}
                onUpdateProject={handleUpdateProject}
              />
            }
          />
          <Route path="/project/:id/cost" element={<CostCalculator projects={projects} />} />
          <Route path="/project/:id/rebuild" element={<RebuildCost projects={projects} />} />
          <Route path="/project/:id/maintenance" element={<MaintenanceCost projects={projects} />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
};

export default App;