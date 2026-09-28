import { act, renderHook, waitFor } from '@testing-library/react';
import { formatJobStep, getJobDocumentTitle, getStartButtonState, useServerGenerationJob } from '../useServerGenerationJob';
import { cancelJob, confirmJob, getActiveJob, getJob, resumeJob, startJob } from '../../utils/jobApi';

jest.mock('../../utils/jobApi', () => ({
  cancelJob: jest.fn(),
  confirmJob: jest.fn(),
  getActiveJob: jest.fn(),
  getJob: jest.fn(),
  resumeJob: jest.fn(),
  startJob: jest.fn(),
}));

const activeJob = overrides => ({
  id: 'j1', project_id: 'p1', type: 'domains', status: 'running', step: 1, total_steps: 4,
  state: {}, updated_at: new Date().toISOString(), ...overrides,
});

const createProps = overrides => ({
  project: { id: 'p1' }, rfpText: '회원 요구사항', userInput: '', projectScale: '10', upgradeMode: false,
  functions: [{ lv1: '회원', lv2: '회원정보', lv3: '회원 조회' }], fpList: [], fpMethod: 'standard',
  setPendingDomains: jest.fn(), setPendingInfo: jest.fn(), setDomainStep: jest.fn(), setTab: jest.fn(),
  reloadProjects: jest.fn().mockResolvedValue(undefined), ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  getActiveJob.mockRejectedValue(Object.assign(new Error('not found'), { status: 404 }));
  getJob.mockResolvedValue(activeJob());
  resumeJob.mockResolvedValue({ status: 'running' });
  startJob.mockResolvedValue({ jobId: 'j1' });
  confirmJob.mockResolvedValue({ jobId: 'j2' });
  cancelJob.mockResolvedValue({ status: 'cancelled' });
});

afterEach(() => {
  jest.useRealTimers();
});

test('시작 후 3초 폴링으로 완료 결과를 반영한다', async () => {
  jest.useFakeTimers();
  const props = createProps();
  const { result } = renderHook(() => useServerGenerationJob(props));
  await act(async () => {});
  await act(async () => result.current.handleGenerate());
  getJob.mockResolvedValue(activeJob({ status: 'completed', type: 'functions', step: 4 }));

  await act(async () => { jest.advanceTimersByTime(3000); await Promise.resolve(); });

  expect(startJob).toHaveBeenCalledWith('p1', 'domains', expect.objectContaining({ rfpText: '회원 요구사항' }));
  expect(props.reloadProjects).toHaveBeenCalled();
  expect(props.setTab).toHaveBeenCalledWith('functions');
  jest.useRealTimers();
});

test('페이지 재마운트 시 진행 작업과 진행률을 복원한다', async () => {
  getActiveJob.mockResolvedValue(activeJob({ step: 2, total_steps: 4 }));
  const { result } = renderHook(() => useServerGenerationJob(createProps()));

  await waitFor(() => expect(result.current.restoring).toBe(false));

  expect(result.current.job.id).toBe('j1');
  expect(result.current.progress).toBe(50);
});

test('2분 이상 정체된 running 작업은 자동 resume한다', async () => {
  getActiveJob.mockResolvedValue(activeJob({ updated_at: new Date(Date.now() - 180000).toISOString() }));
  renderHook(() => useServerGenerationJob(createProps()));

  await waitFor(() => expect(resumeJob).toHaveBeenCalledWith('j1'));
});

test('진행 중인 작업은 기능목록과 FP표 편집 잠금 상태를 제공한다', async () => {
  getActiveJob.mockResolvedValue(activeJob());
  const { result } = renderHook(() => useServerGenerationJob(createProps()));

  await waitFor(() => expect(result.current.restoring).toBe(false));

  expect(result.current.jobLocked).toBe(true);
});

test('paused_quota 상태를 복원하고 사용자가 이어서 진행할 수 있다', async () => {
  getActiveJob.mockResolvedValue(activeJob({ status: 'paused_quota' }));
  const props = createProps();
  const { result } = renderHook(() => useServerGenerationJob(props));
  await waitFor(() => expect(result.current.job?.status).toBe('paused_quota'));

  await act(async () => result.current.handleResume());

  expect(resumeJob).toHaveBeenCalledWith('j1');
  expect(getJob).toHaveBeenCalledWith('j1');
});

test('failed 작업의 오류와 재시도 동작을 제공한다', async () => {
  getActiveJob.mockResolvedValue(activeJob({ status: 'failed', error: 'project_info 3회 실패: JSON 파싱 실패' }));
  const { result } = renderHook(() => useServerGenerationJob(createProps()));
  await waitFor(() => expect(result.current.job?.status).toBe('failed'));

  expect(result.current.canRetry).toBe(true);
  expect(result.current.jobError).toContain('3회 실패');
});

test('시작 요청 409에 jobId가 있으면 alert 없이 활성 작업에 재연결한다', async () => {
  const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
  startJob.mockRejectedValue(Object.assign(new Error('An active job already exists'), { status: 409, jobId: 'existing' }));
  getJob.mockResolvedValue(activeJob({ id: 'existing', type: 'domains', status: 'paused_quota', step: 2 }));
  const { result } = renderHook(() => useServerGenerationJob(createProps()));
  await waitFor(() => expect(result.current.restoring).toBe(false));

  await result.current.handleGenerate();

  await waitFor(() => expect(result.current.job?.id).toBe('existing'));
  expect(getJob).toHaveBeenCalledWith('existing');
  expect(alertSpy).not.toHaveBeenCalled();
  alertSpy.mockRestore();
});

test('FP 요청과 활성 작업 타입이 다르면 재연결 안내를 제공한다', async () => {
  const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
  startJob.mockRejectedValue(Object.assign(new Error('An active job already exists'), { status: 409, jobId: 'domains-job' }));
  getJob.mockResolvedValue(activeJob({ id: 'domains-job', type: 'domains', status: 'paused_quota' }));
  const { result } = renderHook(() => useServerGenerationJob(createProps()));
  await waitFor(() => expect(result.current.restoring).toBe(false));

  await result.current.handleGenerateFP();

  await waitFor(() => expect(result.current.jobNotice).toContain('기능 생성 작업이 끝난 뒤 FP 산정'));
  expect(alertSpy).not.toHaveBeenCalled();
  alertSpy.mockRestore();
});

test('초기 활성 작업 조회가 네트워크 오류 후 성공하면 패널 상태를 복원한다', async () => {
  getActiveJob
    .mockRejectedValueOnce(new Error('network unavailable'))
    .mockResolvedValueOnce(activeJob({ id: 'retry-job', step: 2 }));
  const restoreDelay = jest.fn().mockResolvedValue(undefined);
  const { result } = renderHook(() => useServerGenerationJob(createProps({ restoreDelay })));

  await waitFor(() => expect(result.current.job?.id).toBe('retry-job'));
  expect(getActiveJob.mock.calls.length).toBeGreaterThanOrEqual(2);
  expect(restoreDelay).toHaveBeenCalledWith(5000);
});

test('restore uses the latest delay function without restarting its effect', async () => {
  let rejectFirstLookup;
  getActiveJob.mockImplementationOnce(() => new Promise((_, reject) => {
    rejectFirstLookup = reject;
  }));
  const firstDelay = jest.fn().mockResolvedValue(undefined);
  const latestDelay = jest.fn().mockResolvedValue(undefined);
  const props = createProps();
  let restoreDelay = firstDelay;
  const { rerender, result } = renderHook(() => useServerGenerationJob({ ...props, restoreDelay }));

  restoreDelay = latestDelay;
  rerender();
  await act(async () => { rejectFirstLookup(new Error('network unavailable')); });

  await waitFor(() => expect(result.current.restoring).toBe(false));
  expect(firstDelay).not.toHaveBeenCalled();
  expect(latestDelay).toHaveBeenCalledWith(5000);
  expect(getActiveJob).toHaveBeenCalledTimes(2);
});

test('탭이 visible로 복귀하면 작업이 없을 때 활성 작업을 다시 조회한다', async () => {
  const { result } = renderHook(() => useServerGenerationJob(createProps()));
  await waitFor(() => expect(result.current.restoring).toBe(false));
  getActiveJob.mockClear();
  getActiveJob.mockResolvedValue(activeJob({ id: 'visible-job', status: 'paused_quota' }));
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });

  act(() => { document.dispatchEvent(new Event('visibilitychange')); });

  await waitFor(() => expect(result.current.job?.id).toBe('visible-job'));
  expect(getActiveJob).toHaveBeenCalledWith('p1');
});

test('requirements 세 번째 단계를 전체 청크 수와 함께 표시한다', () => {
  const steps = [
    { kind: 'project_info' },
    ...Array.from({ length: 28 }, (_, index) => ({ kind: 'requirements', label: index + 1 })),
    { kind: 'domain_classify' },
  ];
  expect(formatJobStep(steps[3], steps)).toBe('요구사항 수집 (청크 3/28)');
});

test('실행 중 작업을 확인 후 취소하고 패널 상태를 cancelled로 바꾼다', async () => {
  const originalConfirm = window.confirm;
  Object.defineProperty(window, 'confirm', { configurable: true, value: jest.fn(() => true) });
  getActiveJob.mockResolvedValue(activeJob());
  const { result } = renderHook(() => useServerGenerationJob(createProps()));
  await waitFor(() => expect(result.current.job?.status).toBe('running'));

  await result.current.handleCancel();

  expect(cancelJob).toHaveBeenCalledWith('j1');
  Object.defineProperty(window, 'confirm', { configurable: true, value: originalConfirm });
});

test('jobLocked이면 시작 버튼을 비활성화하고 진행률을 라벨에 표시한다', () => {
  expect(getStartButtonState({ jobLocked: true, starting: false, progress: 42, idleLabel: '기능 생성 시작' }))
    .toEqual({ disabled: true, label: '진행 중… (42%)' });
});

test('시작 요청이 끝나기 전 중복 호출을 차단한다', async () => {
  let resolveStart;
  startJob.mockReturnValue(new Promise(resolve => { resolveStart = resolve; }));
  const { result } = renderHook(() => useServerGenerationJob(createProps()));
  await waitFor(() => expect(result.current.restoring).toBe(false));

  const first = result.current.handleGenerate();
  const second = result.current.handleGenerate();
  expect(startJob).toHaveBeenCalledTimes(1);
  resolveStart({ jobId: 'started-once' });
  await Promise.all([first, second]);
});

test('running 진행률과 완료 상태의 브라우저 탭 제목을 생성한다', () => {
  expect(getJobDocumentTitle('running', 50)).toBe('(50%) fp-system');
  expect(getJobDocumentTitle('completed', 100)).toBe('✅ 완료 - fp-system');
  expect(getJobDocumentTitle('failed', 50, '원래 제목')).toBe('원래 제목');
});
