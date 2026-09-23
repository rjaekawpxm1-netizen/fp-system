import { getAuthHeaders } from './supabase';

const requestJob = async (action, { method = 'GET', body, query = {} } = {}) => {
  const authHeaders = await getAuthHeaders();
  const params = new URLSearchParams({ action, ...query });
  const response = await fetch(`/api/jobs?${params}`, {
    method,
    headers: { ...authHeaders, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `작업 API 오류 (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return data;
};

export const startJob = (projectId, type, input) => requestJob('start', {
  method: 'POST', body: { projectId, type, input },
});
export const getActiveJob = projectId => requestJob('status', { query: { projectId } });
export const getJob = jobId => requestJob('status', { query: { jobId } });
export const confirmJob = (jobId, input) => requestJob('confirm', { method: 'POST', body: { jobId, input } });
export const resumeJob = jobId => requestJob('resume', { method: 'POST', body: { jobId } });
export const cancelJob = jobId => requestJob('cancel', { method: 'POST', body: { jobId } });
