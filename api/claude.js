export const config = {
  runtime: 'edge',
};

// 허용 모델 화이트리스트 (클라이언트가 임의 모델 지정하는 것 방지)
const ALLOWED_MODELS = [
  'claude-sonnet-4-5',
  'claude-haiku-4-5-20251001',
];
const DEFAULT_MODEL = 'claude-sonnet-4-5';

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();

    const maxTokens = body.max_tokens || 4000;
    // [버그수정] 기존: 'claude-haiku-4-5-20251001' 하드코딩 → 클라이언트의
    // model(claude-sonnet-4-5)과 temperature(0)가 전부 무시되고
    // 프로덕션이 Haiku + temperature 1.0으로 동작하고 있었음.
    const model = ALLOWED_MODELS.includes(body.model) ? body.model : DEFAULT_MODEL;
    const temperature = typeof body.temperature === 'number' ? body.temperature : 0;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        ...(body.system ? { system: body.system } : {}),
        messages: body.messages,
      }),
    });

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
