const { handleClaudeRequest, normalizeClaudeRequest } = require('../../../api/claudeCore.cjs');

const responseMock = () => {
  const result = { statusCode: null, body: null };
  return {
    result,
    status(code) { result.statusCode = code; return this; },
    json(body) { result.body = body; return this; },
  };
};

describe('Claude API 공통 계약', () => {
  const authenticated = {
    authenticate: async () => ({ id:'user-1' }),
    authorize: async () => true,
    consumeQuota: async () => true,
  };
  test('모델·토큰·temperature를 서버 허용 범위로 정규화', () => {
    expect(normalizeClaudeRequest({
      model: 'unknown', max_tokens: 999999, temperature: 4,
      messages: [{ role:'user', content:'x' }],
    })).toMatchObject({ model:'claude-sonnet-4-5', max_tokens:6000, temperature:1 });
  });

  test('개발/운영 공통 핸들러가 잘못된 본문을 거부', async () => {
    const res = responseMock();
    await handleClaudeRequest(
      { method:'POST', body:{} }, res,
      { env:{ ANTHROPIC_API_KEY:'test' }, fetchImpl:jest.fn(), ...authenticated },
    );
    expect(res.result).toEqual({ statusCode:400, body:{ error:'messages 배열이 필요합니다.' } });
  });

  test('서버 전용 키로 Anthropic 요청 전달', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ status:200, json:async()=>({ content:[] }) });
    const res = responseMock();
    await handleClaudeRequest(
      { method:'POST', body:{ messages:[{ role:'user', content:'x' }] } }, res,
      { env:{ ANTHROPIC_API_KEY:'server-secret' }, fetchImpl, ...authenticated },
    );
    expect(fetchImpl.mock.calls[0][1].headers['x-api-key']).toBe('server-secret');
    expect(res.result.statusCode).toBe(200);
  });

  test('인증 헤더 없는 POST를 거부', async () => {
    const res = responseMock();
    await handleClaudeRequest(
      { method:'POST', headers:{}, body:{ messages:[{ role:'user', content:'x' }] } }, res,
      { env:{ ANTHROPIC_API_KEY:'server-secret' }, fetchImpl:jest.fn(), authenticate:jest.fn().mockResolvedValue(null) },
    );
    expect(res.result.statusCode).toBe(401);
  });

  test('일일 쿼터 초과를 거부', async () => {
    const res = responseMock();
    await handleClaudeRequest(
      { method:'POST', headers:{}, body:{ messages:[{ role:'user', content:'x' }] } }, res,
      { env:{ ANTHROPIC_API_KEY:'server-secret' }, fetchImpl:jest.fn(), authenticate:authenticated.authenticate, authorize:authenticated.authorize, consumeQuota:async()=>false },
    );
    expect(res.result.statusCode).toBe(429);
  });

  test('접근 권한이 없는 프로젝트 요청을 거부', async () => {
    const res = responseMock();
    await handleClaudeRequest(
      { method:'POST', headers:{}, body:{ messages:[{ role:'user', content:'x' }] } }, res,
      { env:{ ANTHROPIC_API_KEY:'server-secret' }, fetchImpl:jest.fn(), authenticate:authenticated.authenticate, authorize:async()=>false },
    );
    expect(res.result.statusCode).toBe(403);
  });
});
