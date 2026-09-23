jest.mock('../supabase', () => ({
  getAuthHeaders: jest.fn().mockResolvedValue({ Authorization: 'Bearer test' }),
}));

import { callAPI, extractDomainsOnly } from '../claudeApi';

const response = (status, text = '') => ({
  ok: status >= 200 && status < 300,
  status,
  json: jest.fn().mockResolvedValue(status >= 200 && status < 300
    ? { content: [{ type: 'text', text }] }
    : {}),
});

const errorResponse = (status, error) => ({
  ok: false,
  status,
  json: jest.fn().mockResolvedValue({ error }),
});

const settleWithTimers = async (promise) => {
  let settled;
  promise.then(
    value => { settled = { value }; },
    error => { settled = { error }; },
  );
  for (let i = 0; i < 30 && !settled; i++) {
    for (let j = 0; j < 8; j++) await Promise.resolve();
    jest.runOnlyPendingTimers();
  }
  if (!settled) throw new Error('비동기 작업이 제한 시간 안에 완료되지 않았습니다.');
  return settled;
};

describe('callAPI 재시도 소진 처리', () => {
  let warnSpy;

  beforeEach(() => {
    jest.useFakeTimers();
    global.fetch = jest.fn();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    jest.useRealTimers();
    delete global.fetch;
  });

  test('504를 3번 받으면 타임아웃 오류로 reject한다', async () => {
    global.fetch.mockResolvedValue(response(504));

    const result = await settleWithTimers(callAPI('요청'));

    expect(result.error).toEqual(expect.objectContaining({ message: expect.stringMatching(/타임아웃/) }));
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  test('429를 3번 받으면 undefined가 아니라 오류로 reject한다', async () => {
    global.fetch.mockResolvedValue(response(429));

    const result = await settleWithTimers(callAPI('요청'));

    expect(result.error).toEqual(expect.objectContaining({ message: expect.stringMatching(/429/) }));
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  test('504, 504 이후 200 응답을 받으면 정상 텍스트로 resolve한다', async () => {
    global.fetch
      .mockResolvedValueOnce(response(504))
      .mockResolvedValueOnce(response(504))
      .mockResolvedValueOnce(response(200, '정상 응답'));

    const result = await settleWithTimers(callAPI('요청'));

    expect(result).toEqual({ value: '정상 응답' });
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  test('문자열 형태의 서버 오류 메시지를 그대로 표시한다', async () => {
    global.fetch.mockResolvedValue(errorResponse(400, 'messages 배열이 필요합니다.'));

    const result = await settleWithTimers(callAPI('요청'));

    expect(result.error).toEqual(expect.objectContaining({ message: 'messages 배열이 필요합니다.' }));
  });

  test('객체 형태의 서버 오류 메시지를 그대로 표시한다', async () => {
    global.fetch.mockResolvedValue(errorResponse(400, { message: 'invalid request' }));

    const result = await settleWithTimers(callAPI('요청'));

    expect(result.error).toEqual(expect.objectContaining({ message: 'invalid request' }));
  });

  test('요구사항 청크가 계속 504이면 절반 크기의 두 요청으로 분할 재시도한다', async () => {
    let requirementAttempts = 0;
    global.fetch.mockImplementation((url, options) => {
      const content = JSON.parse(options.body).messages[0].content;
      if (content.includes('구축 대상 시스템 정보를 추출하세요')) {
        return Promise.resolve(response(200, JSON.stringify({ systemName: '테스트 시스템' })));
      }
      if (content.includes('기능 요구사항을 수집하세요')) {
        requirementAttempts += 1;
        if (requirementAttempts <= 3) return Promise.resolve(response(504));
        return Promise.resolve(response(200, JSON.stringify({ requirements: ['사용자 정보를 조회해야 한다'] })));
      }
      if (content.includes('업무 도메인')) {
        return Promise.resolve(response(200, JSON.stringify({ domains: [{ lv1: '사용자관리' }] })));
      }
      return Promise.resolve(response(500));
    });
    const text = Array.from({ length: 80 }, (_, i) => `REQ-${i} 사용자 정보를 등록하고 조회해야 한다.`).join('\n');

    const result = await settleWithTimers(extractDomainsOnly(text, '', jest.fn()));

    expect(result.error).toBeUndefined();
    const requirementBodies = global.fetch.mock.calls
      .map(([, options]) => JSON.parse(options.body).messages[0].content)
      .filter(content => content.includes('기능 요구사항을 수집하세요'));
    expect(requirementBodies).toHaveLength(5);
    expect(requirementBodies[3].length).toBeLessThan(requirementBodies[0].length);
    expect(requirementBodies[4].length).toBeLessThan(requirementBodies[0].length);
  });
});
