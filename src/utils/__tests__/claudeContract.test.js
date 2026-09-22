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
  test('모델·토큰·temperature를 서버 허용 범위로 정규화', () => {
    expect(normalizeClaudeRequest({
      model: 'unknown', max_tokens: 999999, temperature: 4,
      messages: [{ role:'user', content:'x' }],
    })).toMatchObject({ model:'claude-sonnet-4-5', max_tokens:8000, temperature:1 });
  });

  test('개발/운영 공통 핸들러가 잘못된 본문을 거부', async () => {
    const res = responseMock();
    await handleClaudeRequest(
      { method:'POST', body:{} }, res,
      { env:{ ANTHROPIC_API_KEY:'test' }, fetchImpl:jest.fn() },
    );
    expect(res.result).toEqual({ statusCode:400, body:{ error:'messages 배열이 필요합니다.' } });
  });

  test('서버 전용 키로 Anthropic 요청 전달', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ status:200, json:async()=>({ content:[] }) });
    const res = responseMock();
    await handleClaudeRequest(
      { method:'POST', body:{ messages:[{ role:'user', content:'x' }] } }, res,
      { env:{ ANTHROPIC_API_KEY:'server-secret' }, fetchImpl },
    );
    expect(fetchImpl.mock.calls[0][1].headers['x-api-key']).toBe('server-secret');
    expect(res.result.statusCode).toBe(200);
  });
});
