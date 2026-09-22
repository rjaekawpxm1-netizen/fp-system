import { dbToProject, projectToDb } from '../supabase';

describe('프로젝트 설정 DB 매핑', () => {
  const settings = {
    projectBudget: '100000000', projectScale: '42', upgradeMode: true,
    fpMethod: 'simple', costUnitPrice: 605784, costLinkIdx: 3,
  };

  test('DB settings를 프로젝트 설정으로 복원', () => {
    expect(dbToProject({ id: '1', name: '테스트', settings }).settings).toEqual(settings);
  });

  test('프로젝트 settings를 JSONB 컬럼에 저장', () => {
    expect(projectToDb({ settings })).toEqual({ settings });
  });
});
