import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';

let mockAuthCallback;
const mockGetSession = jest.fn();
const mockFetchProjects = jest.fn();
const mockFetchProject = jest.fn();
const mockFetchLatestCompletedJobs = jest.fn();
const mockUpdateProject = jest.fn();

jest.mock('./pages/ProjectDetail', () => ({ projects, onUpdateProject, onRefreshProject, onReloadProjects }) => {
  const projectItem = projects.find(item => item.id === 'p1');
  return (
    <div>
      <span>프로젝트 작업 화면</span>
      <span>{projectItem?.name}</span>
      <span>기능 {projectItem?.functions.length || 0}개</span>
      <button onClick={() => onUpdateProject('p1', { name: '로컬 수정' })}>프로젝트 수정</button>
      <button onClick={() => onUpdateProject('p1', { functions: [] })}>빈 기능 대기</button>
      <button onClick={() => onRefreshProject('p1', 'functions')}>서버 결과 반영</button>
      <button onClick={onReloadProjects}>프로젝트 다시 읽기</button>
    </div>
  );
});

jest.mock('./pages/Login', () => () => <div>로그인 화면</div>);

jest.mock('./utils/supabase', () => ({
  supabase: { auth: {
    getSession: (...args) => mockGetSession(...args),
    onAuthStateChange: callback => {
      mockAuthCallback = callback;
      return { data: { subscription: { unsubscribe: jest.fn() } } };
    },
    signOut: jest.fn(),
  } },
  fetchProjects: (...args) => mockFetchProjects(...args),
  fetchProject: (...args) => mockFetchProject(...args),
  fetchLatestCompletedJobs: (...args) => mockFetchLatestCompletedJobs(...args),
  createProject: jest.fn(),
  updateProject: (...args) => mockUpdateProject(...args),
  deleteProject: jest.fn(),
}));

const session = userId => ({ user: { id: userId }, access_token: `token-${userId}` });
const project = name => ({ id: 'p1', name, settings: {}, functions: [], fpList: [] });
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

beforeEach(() => {
  mockAuthCallback = null;
  mockGetSession.mockReset().mockResolvedValue({ data: { session: session('u1') } });
  mockFetchProjects.mockReset().mockResolvedValue([]);
  mockFetchProject.mockReset();
  mockFetchLatestCompletedJobs.mockReset().mockResolvedValue([]);
  mockUpdateProject.mockReset().mockResolvedValue(undefined);
  window.history.pushState({}, '', '/');
});

test('프로젝트 로딩 후 홈 화면을 표시', async () => {
  render(<App />);
  expect(await screen.findByText('IT 컨설팅, 이제 자동으로')).toBeInTheDocument();
});

test('같은 사용자의 새 SIGNED_IN 세션 객체는 프로젝트를 다시 조회하지 않는다', async () => {
  render(<App />);
  await screen.findByText('IT 컨설팅, 이제 자동으로');
  expect(mockFetchProjects).toHaveBeenCalledTimes(1);

  act(() => mockAuthCallback('SIGNED_IN', session('u1')));

  await waitFor(() => expect(mockFetchProjects).toHaveBeenCalledTimes(1));
});

test('최초 로드 후 재조회 중에도 프로젝트 작업 화면을 유지한다', async () => {
  window.history.pushState({}, '', '/project/p1');
  mockFetchProjects.mockResolvedValueOnce([project('서버 프로젝트')]);
  const reload = deferred();
  mockFetchProjects.mockImplementationOnce(() => reload.promise);
  render(<App />);
  expect(await screen.findByText('프로젝트 작업 화면')).toBeInTheDocument();

  act(() => mockAuthCallback('SIGNED_IN', session('u2')));
  await waitFor(() => expect(mockFetchProjects).toHaveBeenCalledTimes(2));

  expect(screen.getByText('프로젝트 작업 화면')).toBeInTheDocument();
  expect(screen.queryByText('데이터 불러오는 중...')).not.toBeInTheDocument();

  await act(async () => reload.resolve([project('새 사용자 프로젝트')]));
});

test('SIGNED_OUT 이벤트는 로그인 화면으로 전환한다', async () => {
  render(<App />);
  await screen.findByText('IT 컨설팅, 이제 자동으로');

  act(() => mockAuthCallback('SIGNED_OUT', null));

  expect(await screen.findByText('로그인 화면')).toBeInTheDocument();
});

test('다른 사용자로 로그인하면 프로젝트를 다시 조회한다', async () => {
  render(<App />);
  await screen.findByText('IT 컨설팅, 이제 자동으로');

  act(() => mockAuthCallback('SIGNED_IN', session('u2')));

  await waitFor(() => expect(mockFetchProjects).toHaveBeenCalledTimes(2));
});

test('저장 대기 patch가 있으면 재조회 결과보다 우선해 유지한다', async () => {
  window.history.pushState({}, '', '/project/p1');
  mockFetchProjects
    .mockResolvedValueOnce([project('서버 원본')])
    .mockResolvedValueOnce([project('서버 재조회')]);
  render(<App />);
  expect(await screen.findByText('서버 원본')).toBeInTheDocument();

  fireEvent.click(screen.getByText('프로젝트 수정'));
  expect(await screen.findByText('로컬 수정')).toBeInTheDocument();
  act(() => mockAuthCallback('SIGNED_IN', session('u2')));

  await waitFor(() => expect(mockFetchProjects).toHaveBeenCalledTimes(2));
  expect(screen.getByText('로컬 수정')).toBeInTheDocument();
  expect(screen.queryByText('서버 재조회')).not.toBeInTheDocument();
});

test('completed job result replaces the local project from a single DB fetch', async () => {
  window.history.pushState({}, '', '/project/p1');
  mockFetchProjects.mockResolvedValueOnce([project('서버 원본')]);
  mockFetchProject.mockResolvedValue({
    ...project('서버 반영'),
    functions: Array.from({ length: 89 }, (_, id) => ({ id })),
  });
  render(<App />);
  await screen.findByText('프로젝트 작업 화면');

  fireEvent.click(screen.getByText('서버 결과 반영'));

  await waitFor(() => expect(mockFetchProject).toHaveBeenCalledWith('p1'));
  await waitFor(() => expect(screen.getByText('서버 반영')).toBeInTheDocument());
});

test('a completed job newer than the cache keeps DB functions ahead of a pending empty array', async () => {
  window.history.pushState({}, '', '/project/p1');
  const cached = { ...project('캐시 프로젝트'), updatedAt: '2026-09-28T06:34:00.000Z' };
  const refreshed = {
    ...project('서버 프로젝트'),
    updatedAt: '2026-09-28T06:35:00.000Z',
    functions: Array.from({ length: 89 }, (_, id) => ({ id })),
  };
  mockFetchProjects.mockResolvedValueOnce([cached]).mockResolvedValueOnce([refreshed]);
  mockFetchLatestCompletedJobs
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ project_id: 'p1', type: 'functions', updated_at: '2026-09-28T06:34:57.000Z' }]);
  render(<App />);
  await screen.findByText('기능 0개');

  fireEvent.click(screen.getByText('빈 기능 대기'));
  fireEvent.click(screen.getByText('프로젝트 다시 읽기'));

  await waitFor(() => expect(screen.getByText('기능 89개')).toBeInTheDocument());
});
