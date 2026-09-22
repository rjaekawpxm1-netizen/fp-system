import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('./pages/ProjectDetail', () => () => <div>프로젝트 상세</div>);
jest.mock('./utils/supabase', () => ({
  supabase: { auth: {
    getSession: async () => ({ data:{ session:{ user:{ id:'u1' } } } }),
    onAuthStateChange: () => ({ data:{ subscription:{ unsubscribe:() => {} } } }),
    signOut: async () => {},
  } },
  fetchProjects: async () => [],
  createProject: jest.fn(),
  updateProject: jest.fn(),
  deleteProject: jest.fn(),
}));

test('프로젝트 로딩 후 홈 화면을 표시', async () => {
  render(<App />);
  expect(await screen.findByText('IT 컨설팅, 이제 자동으로')).toBeInTheDocument();
});
