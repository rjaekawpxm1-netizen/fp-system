const serviceHeaders = env => ({
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
});

const expectJson = async response => {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(
    new Error(body?.message || body?.error || `Supabase request failed (${response.status})`),
    { status: response.status, code: body?.code }
  );
  return body;
};

const createRestRepository = (env = process.env, fetchImpl = fetch) => {
  const base = `${env.SUPABASE_URL}/rest/v1`;
  const headers = serviceHeaders(env);
  const selectOne = async path => {
    const rows = await expectJson(await fetchImpl(`${base}/${path}`, { headers }));
    return Array.isArray(rows) ? rows[0] || null : rows;
  };
  const patch = async (path, changes) => {
    const rows = await expectJson(await fetchImpl(`${base}/${path}`, {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify(changes),
    }));
    return Array.isArray(rows) ? rows[0] || null : rows;
  };
  return {
    get: id => selectOne(`generation_jobs?id=eq.${encodeURIComponent(id)}&select=*&limit=1`),
    getProject: id => selectOne(`projects?id=eq.${encodeURIComponent(id)}&select=*&limit=1`),
    findActive: projectId => selectOne(`generation_jobs?project_id=eq.${encodeURIComponent(projectId)}&status=in.(queued,running,awaiting_confirmation,paused_quota)&select=*&order=created_at.desc&limit=1`),
    insert: async row => {
      const rows = await expectJson(await fetchImpl(`${base}/generation_jobs`, {
        method: 'POST', headers: { ...headers, Prefer: 'return=representation' }, body: JSON.stringify(row),
      }));
      return rows[0];
    },
    update: (id, changes) => patch(`generation_jobs?id=eq.${encodeURIComponent(id)}&select=*`, changes),
    updateIfNotCancelled: (id, changes) => patch(
      `generation_jobs?id=eq.${encodeURIComponent(id)}&status=neq.cancelled&select=*`,
      changes
    ),
    updateProject: (id, changes) => patch(`projects?id=eq.${encodeURIComponent(id)}&select=id`, changes),
    acquire: (id, leaseUntil) => patch(
      `generation_jobs?id=eq.${encodeURIComponent(id)}&or=(lease_until.is.null,lease_until.lt.${encodeURIComponent(new Date().toISOString())})&status=in.(queued,running)&select=*`,
      { status: 'running', lease_until: leaseUntil, updated_at: new Date().toISOString() }
    ),
    consumeQuota: async (ownerId, dailyLimit) => expectJson(await fetchImpl(`${base}/rpc/consume_api_quota_for_user`, {
      method: 'POST', headers, body: JSON.stringify({ p_user_id: ownerId, p_daily_limit: dailyLimit }),
    })),
  };
};

const authenticateWithSupabase = (env = process.env, fetchImpl = fetch) => async req => {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  const response = await fetchImpl(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: header },
  });
  return response.ok ? response.json() : null;
};

module.exports = { authenticateWithSupabase, createRestRepository };
