const {
  buildFunctionsState,
  buildInitialState,
  createJobsHandler,
} = require('../../api/jobsCore.cjs');

const createRepository = () => {
  const jobs = new Map();
  const projects = new Map([['p1', { id: 'p1', owner_id: 'u1', functions: [], fpList: [] }]]);
  let sequence = 1;
  const repository = {
    jobs,
    projects,
    quota: true,
    get: async id => jobs.get(id) || null,
    getProject: async id => projects.get(id) || null,
    findActive: async projectId => [...jobs.values()].find(job => job.project_id === projectId && ['queued','running','awaiting_confirmation','paused_quota'].includes(job.status)) || null,
    insert: async row => {
      const job = { id: `j${sequence++}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), lease_until: null, ...row };
      jobs.set(job.id, job);
      return job;
    },
    update: async (id, changes) => {
      const job = jobs.get(id);
      if (!job) return null;
      Object.assign(job, changes);
      return job;
    },
    updateIfNotCancelled: async (id, changes) => {
      const job = jobs.get(id);
      if (!job || job.status === 'cancelled') return null;
      Object.assign(job, changes);
      return job;
    },
    updateProject: jest.fn(async (id, changes) => {
      Object.assign(projects.get(id), changes);
      return projects.get(id);
    }),
    acquire: async (id, leaseUntil) => {
      const job = jobs.get(id);
      if (!job || !['queued', 'running'].includes(job.status) || job.lease_until) return null;
      job.status = 'running';
      job.lease_until = leaseUntil;
      return { ...job, state: JSON.parse(JSON.stringify(job.state)) };
    },
    consumeQuota: jest.fn(async () => repository.quota),
  };
  return repository;
};

const invoke = async (handler, action, { body = {}, headers = {}, query = {} } = {}) => {
  const result = {};
  const res = {
    status(code) { result.status = code; return this; },
    json(payload) { result.body = payload; return payload; },
  };
  await handler({ body, headers, query: { action, ...query } }, res);
  return result;
};

const auth = async req => req.headers.authorization ? { id: req.headers.authorization.replace('Bearer ', '') } : null;
const userHeaders = { authorization: 'Bearer u1' };
const workerHeaders = { 'x-worker-secret': 'worker-secret' };

const createHarness = overrides => {
  const repository = overrides?.repository || createRepository();
  const callModel = overrides?.callModel || jest.fn(async prompt => {
    if (prompt.includes('시스템 정보를')) return JSON.stringify({ systemName: '테스트', mainUsers: ['사용자'] });
    if (prompt.includes('기능 요구사항')) return JSON.stringify({ requirements: ['회원 정보를 등록하고 조회한다'] });
    if (prompt.includes('업무 도메인')) return JSON.stringify({ domains: [{ lv1: '회원관리', requirements: ['회원 정보를 등록하고 조회한다'] }] });
    if (prompt.includes('업무영역의 기능목록을 생성')) {
      const domain = prompt.match(/> "([^"]+)" 업무영역/)?.[1] || '회원관리';
      return JSON.stringify({ functions: [{ lv2: `${domain}정보`, lv3: `${domain} 목록조회`, definition: `${domain}을 조회한다` }] });
    }
    if (prompt.includes('ILF/EIF')) return JSON.stringify({ ilf: [], eif: [] });
    if (prompt.includes('fpType 분류 기준')) return JSON.stringify({ fpList: [{ idx: 0, fpType: 'EQ', refGroups: ['회원'] }] });
    return '{}';
  });
  const triggerNext = jest.fn(async () => {});
  const now = overrides?.now || (() => new Date('2026-09-23T03:00:00.000Z'));
  const handler = createJobsHandler({ repository, authenticate: overrides?.authenticate || auth, callModel, triggerNext, workerSecret: 'worker-secret', now, executeStep: overrides?.executeStep });
  return { repository, callModel, triggerNext, handler };
};

const insertJob = async (repository, values) => repository.insert({
  project_id: 'p1', owner_id: 'u1', status: 'running', step: 0, result: null, error: null, ...values,
});

describe('서버 생성 작업 실행기', () => {
  test('top-level failures log only the action, status, and message', async () => {
    const error = Object.assign(new Error('authentication unavailable'), { status: 503 });
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { handler } = createHarness({ authenticate: jest.fn(async () => { throw error; }) });

    try {
      const response = await invoke(handler, 'status', {
        headers: userHeaders,
        query: { projectId: 'p1' },
      });

      expect(response).toEqual({ status: 503, body: { error: 'authentication unavailable' } });
      expect(consoleError).toHaveBeenCalledWith('[jobs]', 'status', 503, 'authentication unavailable');
    } finally {
      consoleError.mockRestore();
    }
  });

  test('start는 다른 사용자 프로젝트를 403으로 거절하고 활성 작업 중복을 409로 거절', async () => {
    const { handler, repository } = createHarness();
    const forbidden = await invoke(handler, 'start', { headers: { authorization: 'Bearer u2' }, body: { projectId: 'p1', type: 'domains', input: { rfpText: '요구사항' } } });
    expect(forbidden.status).toBe(403);
    await insertJob(repository, { type: 'domains', state: { steps: [] } });
    const conflict = await invoke(handler, 'start', { headers: userHeaders, body: { projectId: 'p1', type: 'domains', input: { rfpText: '요구사항' } } });
    expect(conflict.status).toBe(409);
    expect(conflict.body).toEqual(expect.objectContaining({ jobId: 'j1', status: 'running', type: 'domains' }));
  });

  test('start insert conflict returns the active job created by a concurrent request', async () => {
    const repository = createRepository();
    const originalFindActive = repository.findActive;
    repository.findActive = jest.fn()
      .mockResolvedValueOnce(null)
      .mockImplementation(originalFindActive);
    repository.insert = jest.fn(async row => {
      repository.jobs.set('j-race', {
        id: 'j-race',
        ...row,
        status: 'running',
      });
      throw Object.assign(new Error('duplicate key'), { status: 409, code: '23505' });
    });
    const { handler, triggerNext } = createHarness({ repository });

    const response = await invoke(handler, 'start', {
      headers: userHeaders,
      body: { projectId: 'p1', type: 'domains', input: { rfpText: 'requirements' } },
    });

    expect(response).toEqual({
      status: 409,
      body: {
        error: 'An active job already exists',
        jobId: 'j-race',
        status: 'running',
        type: 'domains',
      },
    });
    expect(repository.findActive).toHaveBeenCalledTimes(2);
    expect(triggerNext).not.toHaveBeenCalled();
  });

  test('status by projectId returns 403 when the active job belongs to another user', async () => {
    const { handler, repository } = createHarness();
    repository.jobs.set('j-foreign', {
      id: 'j-foreign',
      project_id: 'p1',
      owner_id: 'u2',
      type: 'domains',
      status: 'running',
    });

    const response = await invoke(handler, 'status', {
      headers: userHeaders,
      query: { projectId: 'p1' },
    });

    expect(response).toEqual({ status: 403, body: { error: 'Project access denied' } });
  });

  test('tick은 worker secret이 없거나 틀리면 401', async () => {
    const { handler } = createHarness();
    expect((await invoke(handler, 'tick')).status).toBe(401);
    expect((await invoke(handler, 'tick', { headers: { 'x-worker-secret': 'wrong' } })).status).toBe(401);
  });

  test('동시 tick 두 개 중 하나만 락을 획득해 스텝을 한 번 실행', async () => {
    const { handler, repository, callModel } = createHarness();
    const state = buildInitialState('domains', { rfpText: '회원 기능 요구사항' });
    const job = await insertJob(repository, { type: 'domains', state, total_steps: state.steps.length });
    const results = await Promise.all([
      invoke(handler, 'tick', { headers: workerHeaders, body: { jobId: job.id } }),
      invoke(handler, 'tick', { headers: workerHeaders, body: { jobId: job.id } }),
    ]);
    expect(callModel).toHaveBeenCalledTimes(1);
    expect(results.some(result => result.body.skipped)).toBe(true);
  });

  test('3개 도메인 functions 작업은 순차 tick 후 functions를 저장', async () => {
    const { handler, repository } = createHarness();
    const domainJob = { state: { info: { systemName: '테스트' }, allReqs: [], userInput: '' } };
    const domains = ['A', 'B', 'C'].map(lv1 => ({ lv1, requirements: [`${lv1} 요구`] }));
    const state = buildFunctionsState(domainJob, { domains }, repository.projects.get('p1'));
    const job = await insertJob(repository, { type: 'functions', state, total_steps: state.steps.length });
    for (let index = 0; index < state.steps.length; index++) await invoke(handler, 'tick', { headers: workerHeaders, body: { jobId: job.id } });
    expect(repository.jobs.get(job.id).status).toBe('completed');
    expect(repository.projects.get('p1').functions.map(func => func.lv1)).toEqual(['A', 'B', 'C']);
  });

  test('스텝 예외는 현재 step과 이전 results를 보존해 재시도 가능', async () => {
    const repository = createRepository();
    const callModel = jest.fn().mockRejectedValueOnce(new Error('temporary')).mockResolvedValueOnce(JSON.stringify({ systemName: '복구' }));
    const { handler } = createHarness({ repository, callModel });
    const state = buildInitialState('domains', { rfpText: '회원 요구사항' });
    state.results.previous = { ok: true };
    const job = await insertJob(repository, { type: 'domains', state, total_steps: state.steps.length });
    expect((await invoke(handler, 'tick', { headers: workerHeaders, body: { jobId: job.id } })).status).toBe(500);
    expect(repository.jobs.get(job.id).step).toBe(0);
    expect(repository.jobs.get(job.id).state.results.previous).toEqual({ ok: true });
    expect((await invoke(handler, 'tick', { headers: workerHeaders, body: { jobId: job.id } })).status).toBe(200);
    expect(repository.jobs.get(job.id).state.stepAttempts).toEqual({});
  });

  test('같은 스텝이 3회 실패하면 failed로 종료하고 쿼터 소모를 제한한다', async () => {
    const callModel = jest.fn(async () => { throw new Error('JSON 파싱 실패'); });
    const { handler, repository, triggerNext } = createHarness({ callModel });
    const state = { input: {}, results: {}, steps: [{ kind: 'project_info' }] };
    const job = await insertJob(repository, { type: 'domains', state, total_steps: 1 });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await invoke(handler, 'tick', { headers: workerHeaders, body: { jobId: job.id } });
    }

    expect(repository.jobs.get(job.id).status).toBe('failed');
    expect(repository.jobs.get(job.id).error).toBe('project_info 3회 실패: JSON 파싱 실패');
    expect(repository.consumeQuota).toHaveBeenCalledTimes(3);
    expect(triggerNext).not.toHaveBeenCalled();
  });

  test('529 일시 오류는 즉시 재호출하고 다음 성공 시 attempts를 정리한다', async () => {
    const callModel = jest.fn()
      .mockRejectedValueOnce(new Error('Anthropic overloaded (529)'))
      .mockResolvedValueOnce(JSON.stringify({ systemName: '복구 시스템' }));
    const { handler, repository, triggerNext } = createHarness({ callModel });
    const state = { input: {}, results: {}, steps: [{ kind: 'project_info' }] };
    const job = await insertJob(repository, { type: 'domains', state, total_steps: 1 });

    await invoke(handler, 'tick', { headers: workerHeaders, body: { jobId: job.id } });
    expect(triggerNext).toHaveBeenCalledTimes(1);
    expect(repository.jobs.get(job.id).state.stepAttempts).toEqual({ 0: 1 });

    await invoke(handler, 'tick', { headers: workerHeaders, body: { jobId: job.id } });
    expect(repository.jobs.get(job.id).status).toBe('awaiting_confirmation');
    expect(repository.jobs.get(job.id).state.stepAttempts).toEqual({});
  });

  test('failed 작업을 resume하면 현재 스텝 attempts를 초기화한다', async () => {
    const { handler, repository, triggerNext } = createHarness();
    const state = { input: {}, results: {}, stepAttempts: { 0: 3, 2: 1 }, steps: [{ kind: 'project_info' }] };
    const job = await insertJob(repository, { type: 'domains', status: 'failed', state, total_steps: 1 });

    const response = await invoke(handler, 'resume', { headers: userHeaders, body: { jobId: job.id } });

    expect(response.body.status).toBe('running');
    expect(repository.jobs.get(job.id).state.stepAttempts).toEqual({ 2: 1 });
    expect(triggerNext).toHaveBeenCalledWith(job.id);
  });

  test('쿼터 초과는 완료 결과를 보존해 paused_quota로 멈추고 resume 가능', async () => {
    const { handler, repository } = createHarness();
    repository.quota = false;
    const state = buildInitialState('domains', { rfpText: '회원 요구사항' });
    state.results.previous = ['완료'];
    const job = await insertJob(repository, { type: 'domains', state, total_steps: state.steps.length, updated_at: '2026-09-23T00:00:00.000Z' });
    expect((await invoke(handler, 'tick', { headers: workerHeaders, body: { jobId: job.id } })).body.status).toBe('paused_quota');
    expect(repository.jobs.get(job.id).state.results.previous).toEqual(['완료']);
    const resumed = await invoke(handler, 'resume', { headers: userHeaders, body: { jobId: job.id } });
    expect(resumed.body.status).toBe('running');
  });

  test('요구사항 청크 타임아웃은 절반 크기 스텝 두 개로 재큐잉', async () => {
    const repository = createRepository();
    const { handler } = createHarness({ repository, callModel: jest.fn(async () => { throw new Error('응답 시간 초과'); }) });
    const state = { input: {}, info: { systemName: '테스트' }, allReqs: [], results: {}, steps: [{ kind: 'requirements', chunk: '가'.repeat(2000), label: 1 }] };
    const job = await insertJob(repository, { type: 'domains', state, total_steps: 1 });
    const response = await invoke(handler, 'tick', { headers: workerHeaders, body: { jobId: job.id } });
    expect(response.body.split).toBe(true);
    expect(repository.jobs.get(job.id).state.steps).toHaveLength(2);
    expect(repository.jobs.get(job.id).state.stepAttempts).toEqual({});
  });

  test('cancel 뒤 tick은 모델을 호출하지 않는다', async () => {
    const { handler, repository, callModel } = createHarness();
    const state = buildInitialState('domains', { rfpText: '회원 요구사항' });
    const job = await insertJob(repository, { type: 'domains', state, total_steps: state.steps.length });
    await invoke(handler, 'cancel', { headers: userHeaders, body: { jobId: job.id } });
    await invoke(handler, 'tick', { headers: workerHeaders, body: { jobId: job.id } });
    expect(callModel).not.toHaveBeenCalled();
  });

  test('스텝 실행 중 취소하면 결과 저장과 다음 tick을 건너뛴다', async () => {
    const repository = createRepository();
    const executeStep = jest.fn(async (job, step) => {
      repository.jobs.get(job.id).status = 'cancelled';
      return { ...job.state, results: { 0: [] }, finalFunctions: [], steps: [step] };
    });
    const { handler, triggerNext } = createHarness({ repository, executeStep });
    const state = { steps: [{ kind: 'functions_finalize' }], results: {}, completed: {} };
    const job = await insertJob(repository, { type: 'functions', state, total_steps: 1 });

    const response = await invoke(handler, 'tick', { headers: workerHeaders, body: { jobId: job.id } });

    expect(response.body.status).toBe('cancelled');
    expect(repository.jobs.get(job.id).status).toBe('cancelled');
    expect(triggerNext).not.toHaveBeenCalled();
    expect(repository.updateProject).not.toHaveBeenCalled();
  });

  test.each([
    ['split', new Error('응답 시간 초과'), '가'.repeat(2000)],
    ['오류', new Error('영구 오류'), '짧은 청크'],
  ])('%s 저장 경로에서도 실행 중 취소 상태를 유지한다', async (_label, thrown, chunk) => {
    const repository = createRepository();
    const callModel = jest.fn(async () => {
      repository.jobs.get('j1').status = 'cancelled';
      throw thrown;
    });
    const { handler, triggerNext } = createHarness({ repository, callModel });
    const state = { input: {}, info: { systemName: '테스트' }, allReqs: [], results: {}, steps: [{ kind: 'requirements', chunk, label: 1 }] };
    const job = await insertJob(repository, { type: 'domains', state, total_steps: 1 });

    const response = await invoke(handler, 'tick', { headers: workerHeaders, body: { jobId: job.id } });

    expect(response.body.status).toBe('cancelled');
    expect(repository.jobs.get(job.id).status).toBe('cancelled');
    expect(triggerNext).not.toHaveBeenCalled();
    expect(repository.updateProject).not.toHaveBeenCalled();
  });

  test('domains 완료 시 awaiting_confirmation과 재개 입력을 보존', async () => {
    const { handler, repository } = createHarness();
    const state = buildInitialState('domains', { rfpText: '회원 요구사항', userInput: '관리자는 회원을 승인한다' });
    const job = await insertJob(repository, { type: 'domains', state, total_steps: state.steps.length });
    for (let index = 0; index < state.steps.length; index++) await invoke(handler, 'tick', { headers: workerHeaders, body: { jobId: job.id } });
    const saved = repository.jobs.get(job.id);
    expect(saved.status).toBe('awaiting_confirmation');
    expect(saved.state.allReqs.length).toBeGreaterThan(0);
    expect(saved.state.userInput).toContain('관리자');
    expect(saved.state.domains[0].requirements).toBeDefined();
  });

  test('fp 작업은 분류 결과와 기존 ILF를 합쳐 프로젝트에 저장', async () => {
    const { handler, repository } = createHarness();
    const projectRow = repository.projects.get('p1');
    projectRow.functions = [{ lv1: '회원', lv2: '회원정보', lv3: '회원 목록조회', definition: '회원을 조회한다' }];
    projectRow.fpList = [{ id: 9, lv1: '데이터기능', lv2: '회원', lv3: '회원 (ILF)', fpType: 'ILF' }];
    const state = buildInitialState('fp', {}, projectRow);
    const job = await insertJob(repository, { type: 'fp', state, total_steps: state.steps.length });
    for (let index = 0; index < state.steps.length; index++) await invoke(handler, 'tick', { headers: workerHeaders, body: { jobId: job.id } });
    expect(repository.projects.get('p1').fpList.map(row => row.fpType)).toEqual(['EQ', 'ILF']);
  });
});
