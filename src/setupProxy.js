const express = require('express');
const { handleClaudeRequest } = require('../api/claudeCore.cjs');
const { callAnthropic, normalizeClaudeRequest } = require('../api/claudeCore.cjs');
const { createJobsHandler } = require('../api/jobsCore.cjs');
const { authenticateWithSupabase, createRestRepository } = require('../api/jobsRest.cjs');

module.exports = function(app) {
  app.post('/api/claude', express.json({ limit: '1mb' }), (req, res) => handleClaudeRequest(req, res));
  const fetchImpl = (...args) => global.fetch(...args);
  const repository = createRestRepository(process.env, fetchImpl);
  const jobsHandler = createJobsHandler({
    repository,
    authenticate: authenticateWithSupabase(process.env, fetchImpl),
    callModel: async (prompt, maxTokens) => {
      const request = normalizeClaudeRequest({
        model: 'claude-sonnet-4-5', max_tokens: maxTokens, temperature: 0,
        messages: [{ role: 'user', content: prompt }],
      });
      const response = await callAnthropic(request, process.env, fetchImpl);
      if (response.status < 200 || response.status >= 300) throw new Error(response.data?.error?.message || `Anthropic API error (${response.status})`);
      return response.data;
    },
    triggerNext: jobId => fetchImpl(`${process.env.APP_BASE_URL || 'http://localhost:3000'}/api/jobs?action=tick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Worker-Secret': process.env.JOB_WORKER_SECRET },
      body: JSON.stringify({ jobId }),
    }),
    workerSecret: process.env.JOB_WORKER_SECRET,
    dailyQuota: process.env.API_DAILY_QUOTA,
  });
  app.use('/api/jobs', express.json({ limit: '2mb' }), jobsHandler);
};
