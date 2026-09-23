import { waitUntil } from '@vercel/functions';
import jobsCore from './jobsCore.cjs';
import jobsRest from './jobsRest.cjs';
import claudeCore from './claudeCore.cjs';

export const config = { runtime: 'nodejs', maxDuration: 60 };

const repository = jobsRest.createRestRepository(process.env, fetch);
const authenticate = jobsRest.authenticateWithSupabase(process.env, fetch);
const callModel = async (prompt, maxTokens) => {
  const request = claudeCore.normalizeClaudeRequest({
    model: 'claude-sonnet-4-5',
    max_tokens: maxTokens,
    temperature: 0,
    messages: [{ role: 'user', content: prompt }],
  });
  const response = await claudeCore.callAnthropic(request, process.env, fetch);
  if (response.status < 200 || response.status >= 300) throw new Error(response.data?.error?.message || `Anthropic API error (${response.status})`);
  return response.data;
};
const triggerNext = jobId => {
  const request = fetch(`${process.env.APP_BASE_URL}/api/jobs?action=tick`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Worker-Secret': process.env.JOB_WORKER_SECRET },
    body: JSON.stringify({ jobId }),
  });
  waitUntil(request);
  return Promise.resolve();
};
const handler = jobsCore.createJobsHandler({
  repository,
  authenticate,
  callModel,
  triggerNext,
  workerSecret: process.env.JOB_WORKER_SECRET,
  dailyQuota: process.env.API_DAILY_QUOTA,
});

export default async function jobsHandler(req, res) {
  return handler(req, res);
}
