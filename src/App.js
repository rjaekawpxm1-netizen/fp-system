import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ProjectList from './pages/ProjectList';
import ProjectDetail from './pages/ProjectDetail';
import CostCalculator from './pages/CostCalculator';

const App = () => {
  const [projects, setProjects] = useState(() => {
    try {
      const saved = localStorage.getItem('fp-projects');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('fp-projects', JSON.stringify(projects));
  }, [projects]);

  const createProject = (name) => {
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
      createdAt: new Date().toISOString(),
    };
    setProjects((prev) => [newProject, ...prev]);
  };

  const deleteProject = (id) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  const updateProject = (id, updates) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  };

  return (
    <BrowserRouter>
      <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
        <Routes>
          <Route
            path="/"
            element={
              <ProjectList
                projects={projects}
                onCreateProject={createProject}
                onDeleteProject={deleteProject}
              />
            }
          />
          <Route
            path="/project/:id"
            element={
              <ProjectDetail
                projects={projects}
                onUpdateProject={updateProject}
              />
            }
          />
          <Route
            path="/project/:id/cost"
            element={
              <CostCalculator
                projects={projects}
              />
            }
          />
        </Routes>
      </div>
    </BrowserRouter>
  );
};

export default App;