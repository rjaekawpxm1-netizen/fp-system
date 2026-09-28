/** @jest-environment node */

const { createRestRepository } = require('../../api/jobsRest.cjs');

describe('jobs REST repository', () => {
  test('findActive keeps the PostgREST status list commas unencoded', async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [],
    }));
    const repository = createRestRepository({
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-test',
    }, fetchImpl);

    await repository.findActive('project 1');

    const url = fetchImpl.mock.calls[0][0];
    expect(url).toContain('status=in.(queued,running,awaiting_confirmation,paused_quota)');
    expect(url).not.toContain('%2C');
    expect(url).toContain('project_id=eq.project%201');
  });
});
