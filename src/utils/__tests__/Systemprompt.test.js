import { getDomainExpandPrompt, getDomainClassifyPrompt } from '../systemPrompt';

describe('getDomainExpandPrompt — 컨텍스트 주입', () => {
  const domain = { lv1: 'API게이트웨이', description: 'API GW', requirements: ['표준 API 제공'], expectedLv2: ['게이트웨이'] };

  test('기본 호출(opts 없음)에도 정상 동작 — 하위호환', () => {
    const p = getDomainExpandPrompt(domain, 'DIMS', ['운영자']);
    expect(p).toContain('API게이트웨이');
    expect(p).toContain('기능목록을 생성');
    expect(p).not.toContain('사용자 추가 설명'); // 없을 땐 섹션 미출력
  });

  test('userInput(추가설명) 주입 시 최우선 섹션 포함', () => {
    const p = getDomainExpandPrompt(domain, 'DIMS', ['운영자'], {
      userInput: 'API Gateway가 핵심이다. Rate Limit 필수.',
    });
    expect(p).toContain('사용자 추가 설명');
    expect(p).toContain('Rate Limit 필수');
  });

  test('rfpSnippet 주입 시 RFP 발췌 섹션 포함', () => {
    const p = getDomainExpandPrompt(domain, 'DIMS', ['운영자'], {
      rfpSnippet: 'API Gateway는 호출 제어와 인증을 담당한다',
    });
    expect(p).toContain('RFP 발췌');
    expect(p).toContain('호출 제어');
  });

  test('고도화 — existingInDomain 주입 시 중복금지 섹션 포함', () => {
    const p = getDomainExpandPrompt(domain, 'DIMS', ['운영자'], {
      existingInDomain: ['게이트웨이 > API Proxy 설정', '게이트웨이 > 인증키 발급'],
    });
    expect(p).toContain('이미 존재하는 기능');
    expect(p).toContain('중복 생성 금지');
    expect(p).toContain('API Proxy 설정');
  });

  test('빈 컨텍스트는 해당 섹션을 출력하지 않음', () => {
    const p = getDomainExpandPrompt(domain, 'DIMS', ['운영자'], { userInput: '', rfpSnippet: '', existingInDomain: [] });
    expect(p).not.toContain('사용자 추가 설명');
    expect(p).not.toContain('RFP 발췌');
    expect(p).not.toContain('이미 존재하는 기능');
  });
});

describe('getDomainClassifyPrompt — 핵심주제/고도화', () => {
  const reqs = ['API Gateway 제공', '연동 현황 조회'];

  test('핵심 주제 누락 방지 규칙 포함', () => {
    const p = getDomainClassifyPrompt(reqs, 'DIMS', '국방연동', ['운영자'], 'SW개발', '', 0, []);
    expect(p).toContain('핵심으로 언급된 주제');
  });

  test('고도화 — 기존 LV1 재사용 지시 포함', () => {
    const p = getDomainClassifyPrompt(reqs, 'DIMS', '국방연동', ['운영자'], 'SW개발', '', 0, ['연동계획', '연동운영']);
    expect(p).toContain('기존 LV1 명칭 재사용 필수');
    expect(p).toContain('연동계획');
  });

  test('신규(기존 LV1 없음) — 재사용 섹션 미출력', () => {
    const p = getDomainClassifyPrompt(reqs, 'DIMS', '국방연동', ['운영자'], 'SW개발', '', 0, []);
    expect(p).not.toContain('기존 LV1 명칭 재사용 필수');
  });
});