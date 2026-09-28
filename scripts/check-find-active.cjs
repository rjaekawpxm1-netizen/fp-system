const fs = require('fs');
const path = require('path');

const loadEnv = filePath => {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
};

loadEnv(path.resolve(process.cwd(), '.env'));

const projectId = process.argv[2] || process.env.CHECK_PROJECT_ID;
const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!projectId) {
  console.error('Usage: node scripts/check-find-active.cjs <project-id>');
  process.exitCode = 1;
} else if (!supabaseUrl || !serviceKey) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exitCode = 1;
} else {
  const statuses = 'queued,running,awaiting_confirmation,paused_quota';
  const base = `${supabaseUrl}/rest/v1/generation_jobs?project_id=eq.${encodeURIComponent(projectId)}`;
  const suffix = '&select=id&limit=100';
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

  const countRows = async (label, statusFilter) => {
    const response = await fetch(`${base}&status=in.(${statusFilter})${suffix}`, { headers });
    if (!response.ok) throw new Error(`${label} query failed (${response.status})`);
    const rows = await response.json();
    console.log(`${label} row count: ${Array.isArray(rows) ? rows.length : 0}`);
  };

  Promise.all([
    countRows('encoded commas', encodeURIComponent(statuses)),
    countRows('literal commas', statuses),
  ]).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
