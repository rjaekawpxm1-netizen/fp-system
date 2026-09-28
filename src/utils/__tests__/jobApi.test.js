import { startJob } from '../jobApi';
import { getAuthHeaders } from '../supabase';

jest.mock('../supabase', () => ({ getAuthHeaders: jest.fn() }));

beforeEach(() => {
  global.fetch = jest.fn();
  getAuthHeaders.mockResolvedValue({ Authorization: 'Bearer test' });
});

test('409 응답의 활성 작업 정보를 오류 객체에 보존한다', async () => {
  global.fetch.mockResolvedValue({
    ok: false,
    status: 409,
    jobStatus: 'running',
    json: async () => ({ error: 'An active job already exists', jobId: 'j7', status: 'running', type: 'domains' }),
  });

  await expect(startJob('p1', 'domains', {})).rejects.toEqual(expect.objectContaining({
    status: 409,
    jobId: 'j7',
    type: 'domains',
    data: expect.objectContaining({ jobId: 'j7' }),
  }));
});
