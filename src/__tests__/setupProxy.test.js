/** @jest-environment node */

jest.mock('../../api/claudeCore.cjs', () => ({
  handleClaudeRequest: jest.fn((req, res) => res.json(req.body)),
}));

const express = require('express');
const http = require('http');
const setupProxy = require('../setupProxy');
const { handleClaudeRequest } = require('../../api/claudeCore.cjs');

const postJson = (port, body) => new Promise((resolve, reject) => {
  const payload = JSON.stringify(body);
  const req = http.request({
    hostname: '127.0.0.1',
    port,
    path: '/api/claude',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
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

  beforeAll(done => {
    const app = express();
    setupProxy(app);
    server = app.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      done();
    });
  });

  afterAll(done => {
    server.close(done);
  });

  beforeEach(() => {
    handleClaudeRequest.mockImplementation((req, res) => res.json(req.body));
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
});
