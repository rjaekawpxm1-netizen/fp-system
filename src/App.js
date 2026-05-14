import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import ProjectList from './pages/ProjectList';
import ProjectDetail from './pages/ProjectDetail';
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

  if (loading) return (
    <div style={{display:'flex',justifyContent:'center',alignItems:'center',height:'100vh',flexDirection:'column',gap:16,fontFamily:"'Pretendard',-apple-system,'Malgun Gothic',sans-serif"}}>
      <div style={{fontSize:36}}>⚙️</div>
      <p style={{fontSize:16,color:'#374151',fontWeight:600}}>데이터 불러오는 중...</p>
    </div>
  );

  if (error) return (
    <div style={{display:'flex',justifyContent:'center',alignItems:'center',height:'100vh',flexDirection:'column',gap:16,fontFamily:"'Pretendard',-apple-system,'Malgun Gothic',sans-serif"}}>
      <div style={{fontSize:36}}>⚠️</div>
      <p style={{fontSize:16,color:'#dc2626'}}>{error}</p>
      <button onClick={loadProjects} style={{background:'#2563eb',color:'#fff',border:'none',borderRadius:8,padding:'10px 20px',fontSize:14,cursor:'pointer'}}>다시 시도</button>
    </div>
  );

  return (
    <BrowserRouter>
      <div style={{minHeight:'100vh',fontFamily:"'Pretendard',-apple-system,'Malgun Gothic',sans-serif"}}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/ba" element={
            <ProjectList
              projects={projects}
              onCreateProject={handleCreateProject}
              onDeleteProject={handleDeleteProject}
              onCopyProject={handleCopyProject}
            />
          }/>
          <Route path="/project/:id" element={
            <ProjectDetail projects={projects} onUpdateProject={handleUpdateProject}/>
          }/>
        </Routes>
      </div>
    </BrowserRouter>
  );
};

export default App;
