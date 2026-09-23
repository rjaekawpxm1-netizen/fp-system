const ALLOWED_MODELS = new Set(['claude-sonnet-4-5', 'claude-haiku-4-5-20251001']);
const DEFAULT_MODEL = 'claude-sonnet-4-5';
const MAX_TOKENS = 8000;
const MAX_BODY_CHARS = 200000;
const TOKEN_LIMITS = { vision: 4000, text: 6000 };
const IP_WINDOW_MS = 60 * 1000;
const IP_WINDOW_LIMIT = 20;
const ipWindows = new Map();

const getBearerToken = req => {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
};

const enforceIpRateLimit = req => {
  const forwarded = req.headers?.['x-forwarded-for'];
  const ip = String(Array.isArray(forwarded) ? forwarded[0] : forwarded || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const now = Date.now();
  const current = ipWindows.get(ip);
  if (!current || now - current.startedAt >= IP_WINDOW_MS) {
    ipWindows.set(ip, { startedAt: now, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= IP_WINDOW_LIMIT;
};

const authenticateRequest = async (req, env, fetchImpl) => {
  const token = getBearerToken(req);
  if (!token) return null;
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) throw Object.assign(new Error('Supabase Auth is not configured'), { status: 500 });
  const response = await fetchImpl(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  return response.json();
};

const consumeDailyQuota = async (req, env, fetchImpl) => {
  const token = getBearerToken(req);
  const response = await fetchImpl(`${env.SUPABASE_URL}/rest/v1/rpc/consume_api_quota`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_daily_limit: Number(env.API_DAILY_QUOTA) || 200 }),
  });
  if (!response.ok) throw Object.assign(new Error('API quota service unavailable'), { status: 503 });
  return response.json();
};

const authorizeProject = async (req, env, fetchImpl) => {
  const projectId = req.headers?.['x-project-id'] || req.headers?.['X-Project-Id'];
  if (!projectId) return false;
  const token = getBearerToken(req);
  const response = await fetchImpl(`${env.SUPABASE_URL}/rest/v1/projects?id=eq.${encodeURIComponent(projectId)}&select=id&limit=1`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return false;
  const rows = await response.json();
  return Array.isArray(rows) && rows.length === 1;
};

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
  const hasImage = body.messages.some(message => Array.isArray(message.content)
    && message.content.some(content => content?.type === 'image'));
  const operation = hasImage ? 'vision' : 'text';
  return {
    model: ALLOWED_MODELS.has(body.model) ? body.model : DEFAULT_MODEL,
    max_tokens: Math.min(MAX_TOKENS, TOKEN_LIMITS[operation], Math.max(1, Number(body.max_tokens) || 4000)),
    temperature: Math.min(1, Math.max(0, Number(body.temperature) || 0)),
    ...(body.system ? { system: body.system } : {}),
    messages: body.messages,
  };
};

const callAnthropic = async (requestBody, env = process.env, fetchImpl = fetch) => {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) throw Object.assign(new Error('ANTHROPIC_API_KEY is not configured'), { status: 500 });
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
  return { status: response.status, data };
};

const handleClaudeRequest = async (req, res, options = {}) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const env = options.env || process.env;
    const fetchImpl = options.fetchImpl || fetch;
    const authenticate = options.authenticate || authenticateRequest;
    const authorize = options.authorize || authorizeProject;
    const consumeQuota = options.consumeQuota || consumeDailyQuota;
    const user = await authenticate(req, env, fetchImpl);
    if (!user?.id) return res.status(401).json({ error: 'Authentication required' });
    if (!await authorize(req, env, fetchImpl)) return res.status(403).json({ error: 'Project access denied' });
    const requestBody = normalizeClaudeRequest(req.body);
    if (!enforceIpRateLimit(req)) return res.status(429).json({ error: 'Too many requests' });
    if (!await consumeQuota(req, env, fetchImpl)) return res.status(429).json({ error: 'Daily API quota exceeded' });
    const anthropic = await callAnthropic(requestBody, env, fetchImpl);
    return res.status(anthropic.status).json(anthropic.data);
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
};

module.exports = { callAnthropic, handleClaudeRequest, normalizeClaudeRequest, MAX_BODY_CHARS, MAX_TOKENS };
