import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://awodtedhysfgfztietnh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3b2R0ZWRoeXNmZ2Z6dGlldG5oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3MjYwODAsImV4cCI6MjA5MzMwMjA4MH0.5yJ5JSvPUc5cJatCzutIrKdQjR4ea6B8IiQvFiIEvn8';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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

// DB → React 변환
const dbToProject = (row) => ({
  id: row.id,
  name: row.name,
  systemName: row.system_name || '',
  systemOverview: row.system_overview || '',
  mainFunctions: row.main_functions || '',
  relatedOrgs: row.related_orgs || '',
  functions: row.functions || [],
  fpList: row.fp_list || [],
  fpSummary: row.fp_summary || { newDev: 0, changed: 0 },
  screenList: row.screen_list || [],
  reqList: row.req_list || [],
  crudMatrix: row.crud_matrix || { entities: [], matrix: [] },
  ifList: row.if_list || [],
  wbsList: row.wbs_list || [],
  traceList: row.trace_list || [],
  tcList: row.tc_list || [],
  asisList: row.asis_list || [],
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// React → DB 변환
const projectToDb = (project) => {
  const db = {};
  if (project.id !== undefined) db.id = project.id;
  if (project.name !== undefined) db.name = project.name;
  if (project.systemName !== undefined) db.system_name = project.systemName;
  if (project.systemOverview !== undefined) db.system_overview = project.systemOverview;
  if (project.mainFunctions !== undefined) db.main_functions = project.mainFunctions;
  if (project.relatedOrgs !== undefined) db.related_orgs = project.relatedOrgs;
  if (project.functions !== undefined) db.functions = project.functions;
  if (project.fpList !== undefined) db.fp_list = project.fpList;
  if (project.fpSummary !== undefined) db.fp_summary = project.fpSummary;
  if (project.screenList !== undefined) db.screen_list = project.screenList;
  if (project.reqList !== undefined) db.req_list = project.reqList;
  if (project.crudMatrix !== undefined) db.crud_matrix = project.crudMatrix;
  if (project.ifList !== undefined) db.if_list = project.ifList;
  if (project.wbsList !== undefined) db.wbs_list = project.wbsList;
  if (project.traceList !== undefined) db.trace_list = project.traceList;
  if (project.tcList !== undefined) db.tc_list = project.tcList;
  if (project.asisList !== undefined) db.asis_list = project.asisList;
  return db;
};
