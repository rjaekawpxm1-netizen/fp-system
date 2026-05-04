const DA_API = 'https://web-production-c814e.up.railway.app';

// 세션 ID 생성 (브라우저별 고유)
export const getSessionId = () => {
  let sid = localStorage.getItem('da-session-id');
  if (!sid) {
    sid = 'sess-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    localStorage.setItem('da-session-id', sid);
  }
  return sid;
};

// DB 연결
export const connectDB = async (params) => {
  const res = await fetch(`${DA_API}/api/connect/db`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: getSessionId(), ...params }),
  });
  return res.json();
};

export const connectOracleHost = async (params) => {
  const res = await fetch(`${DA_API}/api/connect/oracle-host`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: getSessionId(), ...params }),
  });
  return res.json();
};

export const connectOracleTNS = async (params) => {
  const res = await fetch(`${DA_API}/api/connect/oracle-tns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: getSessionId(), ...params }),
  });
  return res.json();
};

export const connectOracleWallet = async (formData) => {
  const res = await fetch(`${DA_API}/api/connect/oracle-wallet?session_id=${getSessionId()}&tns_alias=${formData.get('tns_alias')}&user=${formData.get('user')}&password=${formData.get('password')}&wallet_password=${formData.get('wallet_password') || ''}`, {
    method: 'POST',
    body: formData,
  });
  return res.json();
};

export const connectFile = async (file) => {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${DA_API}/api/connect/file?session_id=${getSessionId()}`, {
    method: 'POST',
    body: fd,
  });
  return res.json();
};

export const getConnectStatus = async () => {
  const res = await fetch(`${DA_API}/api/connect/status/${getSessionId()}`);
  return res.json();
};

// 테이블/컬럼
export const getTables = async () => {
  const res = await fetch(`${DA_API}/api/tables/${getSessionId()}`);
  return res.json();
};

export const getColumns = async (tableName) => {
  const res = await fetch(`${DA_API}/api/tables/${getSessionId()}/${tableName}/columns`);
  return res.json();
};

// 진단 규칙
export const getRules = async () => {
  const res = await fetch(`${DA_API}/api/rules`);
  return res.json();
};

// 진단 실행
export const runDiagnosis = async (table, columnRuleMap, dbType = 'postgresql') => {
  const res = await fetch(`${DA_API}/api/diagnose`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: getSessionId(),
      table,
      column_rule_map: columnRuleMap,
      db_type: dbType,
    }),
  });
  return res.json();
};

// 표준화
export const standardizeColumns = async (columns) => {
  const res = await fetch(`${DA_API}/api/standardize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ columns }),
  });
  return res.json();
};

// AI 표준화
export const aiStandardize = async (tableName, columns) => {
  const res = await fetch(`${DA_API}/api/ai/standardize?session_id=${getSessionId()}&table_name=${tableName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ columns }),
  });
  return res.json();
};

// AI ERD
export const aiERD = async () => {
  const res = await fetch(`${DA_API}/api/ai/erd?session_id=${getSessionId()}`, {
    method: 'POST',
  });
  return res.json();
};

// AI 진단 분석
export const aiAnalyzeDiagnosis = async (tableName, results) => {
  const res = await fetch(`${DA_API}/api/ai/analyze-diagnosis?session_id=${getSessionId()}&table_name=${tableName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ results }),
  });
  return res.json();
};

// 보고서
export const generateExcel = async (projectInfo, results) => {
  const res = await fetch(`${DA_API}/api/report/excel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_info: projectInfo, results }),
  });
  return res.json();
};

export const generatePdf = async (projectInfo, results) => {
  const res = await fetch(`${DA_API}/api/report/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_info: projectInfo, results }),
  });
  return res.json();
};

// base64 파일 다운로드
export const downloadBase64File = (base64, filename, mime) => {
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  const blob = new Blob([arr], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};
