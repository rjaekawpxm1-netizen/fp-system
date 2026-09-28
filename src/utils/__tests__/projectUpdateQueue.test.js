import {
  flushPendingProjectUpdates,
  mergeProjectPatches,
  registerProjectSaveFlush,
  withoutProjectFields,
} from '../projectUpdateQueue';

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

  test('체크포인트 저장 시 기존 settings 값을 보존', () => {
    expect(mergeProjectPatches(
      { settings: { projectBudget: '100', projectScale: '250', fpMethod: 'standard' } },
      { settings: { generationCheckpoint: { stage: 'domains', completed: {} } } },
    )).toEqual({
      settings: {
        projectBudget: '100',
        projectScale: '250',
        fpMethod: 'standard',
        generationCheckpoint: { stage: 'domains', completed: {} },
      },
    });
  });

  test('visibilitychange로 hidden이 되면 debounce를 기다리지 않고 저장', () => {
    jest.useFakeTimers();
    const save = jest.fn().mockResolvedValue(undefined);
    const projectPatch = { settings: { generationCheckpoint: { stage: 'expanding' } } };
    const pendingUpdates = { p1: projectPatch };
    const updateTimers = { p1: setTimeout(() => {}, 500) };
    const listeners = {};
    const fakeDocument = {
      hidden: false,
      addEventListener: (name, listener) => { listeners[name] = listener; },
      removeEventListener: jest.fn(),
    };
    const fakeWindow = {
      addEventListener: (name, listener) => { listeners[name] = listener; },
      removeEventListener: jest.fn(),
    };
    const unregister = registerProjectSaveFlush(
      () => flushPendingProjectUpdates(pendingUpdates, updateTimers, save),
      fakeDocument,
      fakeWindow
    );

    fakeDocument.hidden = true;
    listeners.visibilitychange();

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('p1', projectPatch);
    expect(pendingUpdates).toEqual({});
    expect(updateTimers).toEqual({});
    unregister();
    jest.useRealTimers();
  });
});

test('active server jobs omit functions and fpList from a hidden-tab flush payload', () => {
  const save = jest.fn().mockResolvedValue(undefined);
  const pendingUpdates = {
    p1: {
      functions: [{ id: 1 }],
      fpList: [{ id: 2 }],
      settings: { fpMethod: 'standard' },
    },
  };
  const updateTimers = {};
  const listeners = {};
  const fakeDocument = {
    hidden: false,
    addEventListener: (name, listener) => { listeners[name] = listener; },
    removeEventListener: jest.fn(),
  };
  const fakeWindow = {
    addEventListener: (name, listener) => { listeners[name] = listener; },
    removeEventListener: jest.fn(),
  };
  const unregister = registerProjectSaveFlush(
    () => flushPendingProjectUpdates(pendingUpdates, updateTimers, save, undefined, () => ['functions', 'fpList']),
    fakeDocument,
    fakeWindow
  );

  fakeDocument.hidden = true;
  listeners.visibilitychange();

  expect(save).toHaveBeenCalledWith('p1', { settings: { fpMethod: 'standard' } });
  expect(withoutProjectFields({ functions: [], fpList: [], name: 'keep' }, ['functions', 'fpList'])).toEqual({ name: 'keep' });
  unregister();
});
