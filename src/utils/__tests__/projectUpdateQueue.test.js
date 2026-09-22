import { mergeProjectPatches } from '../projectUpdateQueue';

describe('mergeProjectPatches', () => {
  test('debounce 기간의 서로 다른 필드를 모두 보존', () => {
    const first = { uploadedFiles: [{ name: 'a.xlsx' }], xlsxFunctions: [{ lv3: '등록' }] };
    const second = { functions: [{ lv3: '등록' }], xlsxFunctions: [{ lv3: '등록' }, { lv3: '조회' }] };
    expect(mergeProjectPatches(first, second)).toEqual({
      uploadedFiles: [{ name: 'a.xlsx' }],
      functions: [{ lv3: '등록' }],
      xlsxFunctions: [{ lv3: '등록' }, { lv3: '조회' }],
    });
  });

  test('연속 설정 patch도 필드 단위로 병합', () => {
    expect(mergeProjectPatches(
      { settings: { projectBudget: '100', fpMethod: 'standard' } },
      { settings: { fpMethod: 'simple', upgradeMode: true } },
    )).toEqual({ settings: { projectBudget: '100', fpMethod: 'simple', upgradeMode: true } });
  });
});
