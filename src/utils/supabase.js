import { createClient } from '@supabase/supabase-js';
import projectMapping from './shared/projectMapping';

const SUPABASE_URL = 'https://awodtedhysfgfztietnh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3b2R0ZWRoeXNmZ2Z6dGlldG5oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3MjYwODAsImV4cCI6MjA5MzMwMjA4MH0.5yJ5JSvPUc5cJatCzutIrKdQjR4ea6B8IiQvFiIEvn8';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export const getAuthHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('로그인이 필요합니다.');
  return { Authorization: `Bearer ${session.access_token}` };
};

// 프로젝트 전체 조회
export const fetchProjects = async () => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(dbToProject);
};

// 프로젝트 단건 조회
export const fetchProject = async (id) => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return dbToProject(data);
};

export const fetchLatestCompletedJobs = async (projectIds) => {
  if (!projectIds.length) return [];
  const { data, error } = await supabase
    .from('generation_jobs')
    .select('project_id,type,updated_at')
    .in('project_id', projectIds)
    .eq('status', 'completed')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  const latestByProject = new Map();
  for (const job of data || []) {
    if (!latestByProject.has(job.project_id)) latestByProject.set(job.project_id, job);
  }
  return [...latestByProject.values()];
};

// 프로젝트 생성
export const createProject = async (project) => {
  const { data, error } = await supabase
    .from('projects')
    .insert(projectToDb(project))
    .select()
    .single();
  if (error) throw error;
  return dbToProject(data);
};

// 프로젝트 업데이트
export const updateProject = async (id, updates) => {
  const dbUpdates = projectToDb(updates);
  const { error } = await supabase
    .from('projects')
    .update(dbUpdates)
    .eq('id', id);
  if (error) throw error;
};

// 프로젝트 삭제
export const deleteProject = async (id) => {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id);
  if (error) throw error;
};

// DB ↔ React 행 매핑은 서버(api/jobsCore.cjs)와 공유하는 shared/projectMapping에 있다.
export const { dbToProject, projectToDb } = projectMapping;
