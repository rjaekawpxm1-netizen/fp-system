const ALLOWED_MODELS = new Set(['claude-sonnet-4-5', 'claude-haiku-4-5-20251001']);
const DEFAULT_MODEL = 'claude-sonnet-4-5';
const MAX_TOKENS = 8000;
const MAX_BODY_CHARS = 200000;

const normalizeClaudeRequest = rawBody => {
  const body = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    const error = new Error('messages 배열이 필요합니다.');
    error.status = 400;
    throw error;
  }
  if (JSON.stringify(body).length > MAX_BODY_CHARS) {
    const error = new Error('요청 본문이 허용 크기를 초과했습니다.');
    error.status = 413;
    throw error;
  }
  return {
    model: ALLOWED_MODELS.has(body.model) ? body.model : DEFAULT_MODEL,
    max_tokens: Math.min(MAX_TOKENS, Math.max(1, Number(body.max_tokens) || 4000)),
    temperature: Math.min(1, Math.max(0, Number(body.temperature) || 0)),
    ...(body.system ? { system: body.system } : {}),
    messages: body.messages,
  };
};

const handleClaudeRequest = async (req, res, options = {}) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const apiKey = (options.env || process.env).ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured' });
    const requestBody = normalizeClaudeRequest(req.body);
    const fetchImpl = options.fetchImpl || fetch;
    const response = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody),
    });
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
};

module.exports = { handleClaudeRequest, normalizeClaudeRequest, MAX_BODY_CHARS, MAX_TOKENS };
