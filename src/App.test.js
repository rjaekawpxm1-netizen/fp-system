import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('./pages/ProjectDetail', () => () => <div>프로젝트 상세</div>);
jest.mock('./utils/supabase', () => ({
  fetchProjects: jest.fn().mockResolvedValue([]),
  createProject: jest.fn(),
  updateProject: jest.fn(),
  deleteProject: jest.fn(),
}));

test('프로젝트 로딩 후 홈 화면을 표시', async () => {
  render(<App />);
  expect(screen.getByText('데이터 불러오는 중...')).toBeInTheDocument();
  expect(await screen.findByText('IT 컨설팅, 이제 자동으로')).toBeInTheDocument();
});
