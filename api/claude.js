// Vercel Serverless Function (Node.js 런타임)
// [변경] Edge 런타임은 응답 스트리밍 없이는 ~25초에서 게이트웨이가 끊겨
// 504를 유발(영역 제안·FP 분류 등 긴 호출). Node 런타임 + maxDuration으로 해결.
export const config = {
  runtime: 'nodejs',
  maxDuration: 60, // Vercel Pro면 300까지 가능. Hobby는 60이 상한.
};

const ALLOWED_MODELS = ['claude-sonnet-4-5', 'claude-haiku-4-5-20251001'];
const DEFAULT_MODEL = 'claude-sonnet-4-5';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const maxTokens = body.max_tokens || 4000;
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
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
