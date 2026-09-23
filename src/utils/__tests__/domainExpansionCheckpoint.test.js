jest.mock('../supabase', () => ({
  getAuthHeaders: jest.fn().mockResolvedValue({ Authorization: 'Bearer test' }),
}));

import { expandDomainsToFunctions } from '../claudeApi';

const response = text => ({
  ok: true,
  status: 200,
  json: jest.fn().mockResolvedValue({ content: [{ type: 'text', text }] }),
});

const domains = [
  { lv1: '회원업무', description: '회원', requirements: ['회원 관리'] },
  { lv1: '결제업무', description: '결제', requirements: ['결제 관리'] },
  { lv1: '실패업무', description: '실패', requirements: ['실패 확인'] },
];

const info = { systemName: '테스트 시스템', overview: '테스트', mainUsers: ['사용자'] };

const functionResult = lv1 => JSON.stringify({
  functions: [{
    lv2: `${lv1}처리`,
    lv3: `${lv1} 목록조회`,
    definition: `${lv1} 목록을 조회한다`,
  }],
});

const mockExpansionResponses = failedLv1s => {
  global.fetch.mockImplementation((url, options) => {
    const prompt = JSON.parse(options.body).messages[0].content;
    const domain = domains.find(item => prompt.includes(`LV1: ${item.lv1}`));
    return Promise.resolve(response(
      failedLv1s.includes(domain.lv1)
        ? JSON.stringify({ functions: [] })
        : functionResult(domain.lv1)
    ));
  });
};

describe('도메인 확장 체크포인트', () => {
  let warnSpy;

  beforeEach(() => {
    global.fetch = jest.fn();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    delete global.fetch;
  });

  test('3개 중 1개 실패 시 성공한 2개와 실패 목록을 반환한다', async () => {
    mockExpansionResponses(['실패업무']);

    const result = await expandDomainsToFunctions(domains, info);

    expect(result.functions.map(func => func.lv1)).toEqual(['회원업무', '결제업무']);
    expect(result.failedDomains).toEqual([{ lv1: '실패업무', message: '유효한 기능 0개 반환' }]);
  });

  test('3개 도메인이 모두 실패하면 오류를 던진다', async () => {
    mockExpansionResponses(domains.map(domain => domain.lv1));

    await expect(expandDomainsToFunctions(domains, info)).rejects.toThrow('기능이 생성되지 않았습니다');
  });

  test('onDomainDone은 성공한 도메인 수만큼 호출된다', async () => {
    mockExpansionResponses(['실패업무']);
    const onDomainDone = jest.fn();

    await expandDomainsToFunctions(domains, info, undefined, [], onDomainDone);

    expect(onDomainDone).toHaveBeenCalledTimes(2);
    expect(onDomainDone.mock.calls.map(([domain]) => domain.lv1)).toEqual(['회원업무', '결제업무']);
  });

  test('skipLv1s에 포함된 도메인은 fetch하지 않는다', async () => {
    mockExpansionResponses([]);

    const result = await expandDomainsToFunctions(domains.slice(0, 2), info, undefined, [], undefined, ['회원업무']);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const prompt = JSON.parse(global.fetch.mock.calls[0][1].body).messages[0].content;
    expect(prompt).toContain('LV1: 결제업무');
    expect(result.functions.map(func => func.lv1)).toEqual(['결제업무']);
  });
});
