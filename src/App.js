import { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import ProjectList from './pages/ProjectList';
import ProjectDetail from './pages/ProjectDetail';
import Login from './pages/Login';
import {
  fetchProjects,
  createProject as dbCreateProject,
  updateProject as dbUpdateProject,
  deleteProject as dbDeleteProject,
  supabase,
} from './utils/supabase';
import { flushPendingProjectUpdates, mergeProjectPatches, registerProjectSaveFlush } from './utils/projectUpdateQueue';

const App = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const projectsRef = useRef([]);
  const updateTimersRef = useRef({});
  const pendingUpdatesRef = useRef({});

  const reportSaveError = useCallback((err) => {
    setSaveError(`프로젝트 저장에 실패했습니다: ${err.message}`);
  }, []);

  const flushPendingUpdates = useCallback(() => {
    flushPendingProjectUpdates(
      pendingUpdatesRef.current,
      updateTimersRef.current,
      dbUpdateProject,
      reportSaveError
    );
  }, [reportSaveError]);

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const data = await fetchProjects();
      const mergedData = data.map(project =>
        mergeProjectPatches(project, pendingUpdatesRef.current[project.id])
      );
      projectsRef.current = mergedData;
      setProjects(mergedData);
    } catch (err) {
      setError('데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
      setInitialLoadDone(true);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(prev =>
        prev && nextSession && prev.user?.id === nextSession.user?.id ? prev : nextSession
      );
      setAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const userId = session?.user?.id;
  useEffect(() => {
    if (authLoading) return;
    if (userId) loadProjects();
    else {
      projectsRef.current = [];
      setProjects([]);
      setLoading(false);
      setInitialLoadDone(false);
    }
  }, [authLoading, userId, loadProjects]);
  useEffect(() => { projectsRef.current = projects; }, [projects]);

  const handleCreateProject = async (name) => {
    const newProject = {
      id: Date.now().toString(), name,
      systemName: '', systemOverview: '', userInput: '', rfpText: '',
      mainFunctions: '', relatedOrgs: '',
      functions: [], fpList: [], fpSummary: { newDev: 0, changed: 0 },
      screenList: [], reqList: [], crudMatrix: { entities: [], matrix: [] },
      settings: {},
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

  const handleUpdateProject = useCallback((id, updates) => {
    let normalizedUpdates = updates;
    const nextProjects = projectsRef.current.map(p => {
      if (p.id !== id) return p;
      const merged = mergeProjectPatches(p, updates);
      if (updates.settings) normalizedUpdates = { ...updates, settings: merged.settings };
      return merged;
    });
    projectsRef.current = nextProjects;
    setProjects(nextProjects);
    setSaveError(null);
    pendingUpdatesRef.current[id] = mergeProjectPatches(pendingUpdatesRef.current[id], normalizedUpdates);
    if (updateTimersRef.current[id]) clearTimeout(updateTimersRef.current[id]);
    updateTimersRef.current[id] = setTimeout(async () => {
      const mergedUpdates = pendingUpdatesRef.current[id];
      delete pendingUpdatesRef.current[id];
      delete updateTimersRef.current[id];
      try {
        await dbUpdateProject(id, mergedUpdates);
      } catch (err) {
        reportSaveError(err);
      }
    }, 500);
  }, [reportSaveError]);

  useEffect(() => {
    const updateTimers = updateTimersRef.current;
    const unregisterFlush = registerProjectSaveFlush(flushPendingUpdates);
    return () => {
      unregisterFlush();
      Object.values(updateTimers).forEach(clearTimeout);
    };
  }, [flushPendingUpdates]);

  const handleCopyProject = async (project, newName) => {
    const copied = { ...project, id: Date.now().toString(), name: newName, createdAt: new Date().toISOString() };
    try {
      const created = await dbCreateProject(copied);
      setProjects(prev => [created, ...prev]);
    } catch (err) { alert('복사 실패: ' + err.message); }
  };

  if (authLoading || (session && loading && !initialLoadDone)) return (
    <div style={{display:'flex',justifyContent:'center',alignItems:'center',height:'100vh',flexDirection:'column',gap:16,fontFamily:"'Pretendard',-apple-system,'Malgun Gothic',sans-serif"}}>
      <div style={{fontSize:36}}>⚙️</div>
      <p style={{fontSize:16,color:'#374151',fontWeight:600}}>데이터 불러오는 중...</p>
    </div>
  );

  if (!session) return <Login />;

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
        <button onClick={()=>supabase.auth.signOut()} style={{position:'fixed',zIndex:9000,right:16,top:16,border:'1px solid #cbd5e1',borderRadius:7,background:'#fff',padding:'6px 10px',fontSize:11,cursor:'pointer'}}>로그아웃</button>
        {saveError && (
          <div role="alert" style={{position:'fixed',zIndex:9999,right:16,bottom:16,maxWidth:420,padding:'12px 14px',borderRadius:8,background:'#fee2e2',border:'1px solid #f87171',color:'#991b1b',fontSize:13,boxShadow:'0 4px 16px rgba(0,0,0,.15)'}}>
            {saveError}
            <button onClick={()=>setSaveError(null)} aria-label="저장 오류 닫기" style={{marginLeft:10,border:0,background:'transparent',color:'#991b1b',cursor:'pointer'}}>✕</button>
          </div>
        )}
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
            <ProjectDetail
              projects={projects}
              onUpdateProject={handleUpdateProject}
              onCopyProject={handleCopyProject}
            />
          }/>
        </Routes>
      </div>
    </BrowserRouter>
  );
};

export default App;
