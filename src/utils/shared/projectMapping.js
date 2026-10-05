// DB 컬럼(snake_case) ↔ 앱 객체(camelCase) 매핑. 서버와 클라이언트가 공유한다.
// CommonJS 유지(ESM 구문 혼용 금지).

// DB → React 변환
const dbToProject = (row) => ({
  id: row.id,
  name: row.name,
  systemName: row.system_name || '',
  systemOverview: row.system_overview || '',
  mainFunctions: row.main_functions || '',
  relatedOrgs: row.related_orgs || '',
  userInput: row.user_input || '',
  rfpText: row.rfp_text || '',
  uploadedFiles: (() => { try { return JSON.parse(row.uploaded_files || '[]'); } catch { return []; } })(),
  xlsxFunctions: (() => { try { return JSON.parse(row.xlsx_functions || '[]'); } catch { return []; } })(),
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
  settings: row.settings || {},
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
  if (project.userInput !== undefined) db.user_input = project.userInput;
  if (project.rfpText !== undefined) db.rfp_text = project.rfpText;
  if (project.uploadedFiles !== undefined) db.uploaded_files = JSON.stringify(project.uploadedFiles);
  if (project.xlsxFunctions !== undefined) db.xlsx_functions = JSON.stringify(project.xlsxFunctions);
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
  if (project.settings !== undefined) db.settings = project.settings;
  return db;
};

module.exports = { dbToProject, projectToDb };
