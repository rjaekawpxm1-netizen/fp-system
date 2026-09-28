/** @jest-environment node */

jest.mock('../../api/claudeCore.cjs', () => ({
  handleClaudeRequest: jest.fn((req, res) => res.json(req.body)),
  callAnthropic: jest.fn(),
  normalizeClaudeRequest: jest.fn(body => body),
}));

const express = require('express');
const http = require('http');
const setupProxy = require('../setupProxy');
const { handleClaudeRequest } = require('../../api/claudeCore.cjs');

const postJson = (port, body, path = '/api/claude', headers = {}) => new Promise((resolve, reject) => {
  const payload = JSON.stringify(body);
  const req = http.request({
    hostname: '127.0.0.1',
    port,
    path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      ...headers,
    },
  }, res => {
    let responseBody = '';
    res.setEncoding('utf8');
    res.on('data', chunk => { responseBody += chunk; });
    res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(responseBody) }));
  });
  req.on('error', reject);
  req.end(payload);
});

describe('local Claude proxy JSON parsing', () => {
  let server;
  let port;
  const originalFetch = global.fetch;

  beforeAll(done => {
    const app = express();
    setupProxy(app);
    server = app.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      done();
    });
  });

  afterAll(done => {
    global.fetch = originalFetch;
    server.close(done);
  });

  beforeEach(() => {
    handleClaudeRequest.mockImplementation((req, res) => res.json(req.body));
    global.fetch = originalFetch;
  });

  test('messages 배열이 포함된 JSON 본문을 Claude 핸들러에 전달한다', async () => {
    const result = await postJson(port, { messages: [{ role: 'user', content: 'hi' }] });

    expect(result.status).toBe(200);
    expect(handleClaudeRequest.mock.calls[0][0].body.messages).toEqual([
      { role: 'user', content: 'hi' },
    ]);
  });

  test('약 300KB 한글 JSON 본문을 413 없이 전달한다', async () => {
    const content = '가'.repeat(100000);
    const result = await postJson(port, { messages: [{ role: 'user', content }] });

    expect(result.status).toBe(200);
    expect(handleClaudeRequest.mock.calls[0][0].body.messages[0].content).toHaveLength(100000);
  });

  test('tick fetch가 pending이어도 start 응답은 즉시 201을 반환한다', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-test';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-test';
    process.env.JOB_WORKER_SECRET = 'worker-test';
    const pending = new Promise(() => {});
    global.fetch = jest.fn(async (url, options = {}) => {
      if (String(url).includes('/api/jobs?action=tick')) return pending;
      if (String(url).includes('/auth/v1/user')) return { ok: true, status: 200, json: async () => ({ id: 'u1' }) };
      if (String(url).includes('/projects?')) return { ok: true, status: 200, json: async () => [{ id: 'p1', owner_id: 'u1', functions: [], fpList: [] }] };
      if (String(url).includes('generation_jobs?project_id=')) return { ok: true, status: 200, json: async () => [] };
      if (String(url).endsWith('/generation_jobs') && options.method === 'POST') {
        return { ok: true, status: 201, json: async () => [{ id: 'j1' }] };
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const response = await Promise.race([
      postJson(port, { projectId: 'p1', type: 'domains', input: { rfpText: '요구사항' } }, '/api/jobs?action=start', { Authorization: 'Bearer user-token' }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('start response timeout')), 1000)),
    ]);

    expect(response).toEqual({ status: 201, body: { jobId: 'j1' } });
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/jobs?action=tick'), expect.any(Object));
  });
});
