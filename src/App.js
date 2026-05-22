import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import ProjectList from './pages/ProjectList';
import ProjectDetail from './pages/ProjectDetail';
import CostCalculator from './pages/CostCalculator';
import RebuildCost from './pages/RebuildCost';
import MaintenanceCost from './pages/MaintenanceCost';
import DAMain from './pages/DAMain';
import DAConnect from './pages/DAConnect';
import DASetup from './pages/DASetup';
import DAStandard from './pages/DAStandard';
import DAResult from './pages/DAResult';
import {
  fetchProjects,
  createProject as dbCreateProject,
  updateProject as dbUpdateProject,
  deleteProject as dbDeleteProject,
} from './utils/supabase';

const BLUE = '#3182F6';
const SUB = '#4E5968';
const LINE = '#F2F4F6';
const BG = '#F9FAFB';

const App = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const data = await fetchProjects();
      setProjects(data);
    } catch (err) {
      setError('데이터를 불러오지 못했습니다.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const handleCreateProject = async (name) => {
    const newProject = {
      id: Date.now().toString(), name,
      systemName: '', systemOverview: '', userInput: '', rfpText: '',
      mainFunctions: '', relatedOrgs: '',
      functions: [], fpList: [], fpSummary: { newDev: 0, changed: 0 },
      screenList: [], reqList: [], crudMatrix: { entities: [], matrix: [] },
    };
    try {
      const created = await dbCreateProject(newProject);
      setProjects(prev => [created, ...prev]);
    } catch (err) { alert('프로젝트 생성 실패: ' + err.message); }
  };

  const handleDeleteProject = async (id) => {
    try {
      await dbDeleteProject(id);
      setProjects(prev => prev.filter(p => p.id !== id));
    } catch (err) { alert('삭제 실패: ' + err.message); }
  };

  const updateTimers = {};
  const handleUpdateProject = useCallback((id, updates) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    if (updateTimers[id]) clearTimeout(updateTimers[id]);
    updateTimers[id] = setTimeout(async () => {
      try { await dbUpdateProject(id, updates); }
      catch (err) { console.error('저장 실패:', err); }
    }, 500);
  }, []);

  const handleCopyProject = async (project, newName) => {
    const copied = { ...project, id: Date.now().toString(), name: newName, createdAt: new Date().toISOString() };
    try {
      const created = await dbCreateProject(copied);
      setProjects(prev => [created, ...prev]);
    } catch (err) { alert('복사 실패: ' + err.message); }
  };

  const baseStyle = {
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    height: '100vh', flexDirection: 'column', gap: 16,
    fontFamily: "'Pretendard', system-ui, sans-serif",
    background: BG, color: '#191F28',
  };

  if (loading) return (
    <div style={baseStyle}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 20 }}>j</div>
      <p style={{ fontSize: 15, color: SUB, fontWeight: 600, margin: 0 }}>데이터 불러오는 중...</p>
    </div>
  );

  if (error) return (
    <div style={baseStyle}>
      <div style={{ fontSize: 36 }}>⚠️</div>
      <p style={{ fontSize: 15, color: '#E11D48', fontWeight: 600, margin: 0 }}>{error}</p>
      <button onClick={loadProjects}
        style={{ height: 44, padding: '0 20px', background: BLUE, color: '#fff', border: 'none', borderRadius: 999, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
        다시 시도
      </button>
    </div>
  );

  return (
    <BrowserRouter>
      <div style={{ minHeight: '100vh', fontFamily: "'Pretendard', system-ui, sans-serif", background: BG }}>
        <Routes>
          <Route path="/" element={<Home />} />

          {/* BA */}
          <Route path="/ba" element={
            <ProjectList
              projects={projects}
              onCreateProject={handleCreateProject}
              onDeleteProject={handleDeleteProject}
              onCopyProject={handleCopyProject}
            />
          }/>
          <Route path="/project/:id" element={
            <ProjectDetail projects={projects} onUpdateProject={handleUpdateProject} />
          }/>
          <Route path="/project/:id/cost" element={
            <CostCalculator projects={projects} projectsLoading={loading} />
          }/>
          <Route path="/project/:id/rebuild" element={
            <RebuildCost projects={projects} projectsLoading={loading} />
          }/>
          <Route path="/project/:id/maintenance" element={
            <MaintenanceCost projects={projects} projectsLoading={loading} />
          }/>

          {/* DA */}
          <Route path="/da" element={<DAMain />} />
          <Route path="/da/connect" element={<DAConnect />} />
          <Route path="/da/setup" element={<DASetup />} />
          <Route path="/da/standard" element={<DAStandard />} />
          <Route path="/da/result" element={<DAResult />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
};

export default App;
