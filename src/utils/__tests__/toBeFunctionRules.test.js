const { applyToBeFunctionRules, buildRequiredAiDomains, hasActionVerb } = require('../shared/toBeFunctionRules');
const { diceSimilarity } = require('../shared/textSimilarity');

describe('To-Be 기능 단위화 규칙', () => {
  test('관리로 끝나는 LV3를 CRUD 단위로 확장한다', () => {
    const result = applyToBeFunctionRules([
      { lv1: 'AI 운영', lv2: '모델', lv3: '모델 관리' },
    ]);

    expect(result.functions.map(item => item.lv3)).toEqual([
      '모델 등록', '모델 수정', '모델 삭제', '모델 목록조회', '모델 상세조회',
    ]);
    expect(result.functions.every(item => hasActionVerb(item.lv3))).toBe(true);
  });

  test('동사가 없는 비기능 항목은 제외하고 사용자 조회 기능은 보존한다', () => {
    const result = applyToBeFunctionRules([
      { lv1: '운영', lv2: '성능', lv3: '대용량 배치' },
      { lv1: '연계', lv2: '연계 이력', lv3: '연계 이력 조회' },
    ]);

    expect(result.excluded).toEqual([
      expect.objectContaining({ lv3: '대용량 배치', reason: '비기능 항목' }),
    ]);
    expect(result.functions).toEqual([
      expect.objectContaining({ lv3: '연계 이력 조회' }),
    ]);
  });

  test('AI 서비스의 동사 미종결 LV3만 검토 대상으로 표시한다', () => {
    const result = applyToBeFunctionRules([
      { lv1: 'AI 분석', lv2: '탐지', lv3: '탐지 모델' },
      { lv1: 'AI 분석', lv2: '결과', lv3: '탐지 결과 조회' },
    ]);

    expect(result.functions.find(item => item.lv3 === '탐지 모델')).toMatchObject({ needsReview: true });
    expect(result.functions.find(item => item.lv3 === '탐지 결과 조회')).not.toHaveProperty('needsReview');
  });

  test('LV1과 LV2가 유사한 중복은 하나로 병합하고 출처를 남긴다', () => {
    const result = applyToBeFunctionRules([
      { lv1: 'AI 운영 관리', lv2: '모델 관리', lv3: '모델 등록' },
      { lv1: 'AI 운영관리', lv2: '모델관리', lv3: '모델 조회' },
    ]);

    expect(diceSimilarity('AI 운영 관리', 'AI 운영관리')).toBeGreaterThanOrEqual(0.85);
    expect(result.mergedLv1Count).toBe(1);
    expect(result.functions).toEqual(expect.arrayContaining([
      expect.objectContaining({ lv1: 'AI 운영 관리', mergedFrom: 'AI 운영관리' }),
    ]));
  });

  test('AI ISMP 컨설팅은 기능을 직접 추가하지 않고 시스템 인프라 LV1만 AI 운영관리로 정리한다', () => {
    const info = { projectType: 'AI ISMP 컨설팅', rfpText: '생성형 AI, LLM, RAG 및 에이전트 플랫폼을 구축한다.' };
    const result = applyToBeFunctionRules([
      { lv1: '시스템 인프라', lv2: '운영', lv3: '운영 현황 조회' },
    ], info);

    expect(result.functions).toHaveLength(1);
    expect(result.functions[0]).toMatchObject({ lv1: 'AI 운영관리', mergedFrom: '시스템 인프라' });
    expect(result.functions.some(item => item.requiredAiArea)).toBe(false);
  });

  test('AI ISMP 컨설팅에는 체크 해제된 제안 도메인을 만들고 기존 LV1은 제외한다', () => {
    const info = { projectType: 'AI ISMP 컨설팅', rfpText: '생성형 AI, LLM, RAG 및 에이전트 플랫폼을 구축한다.' };
    const domains = buildRequiredAiDomains(info, ['AI 운영관리']);

    expect(domains.map(item => item.lv1)).toEqual(['AI 공통 플랫폼', '직원 업무지원 AI']);
    domains.forEach(item => expect(item).toMatchObject({ enabled: false, suggested: true }));
    expect(buildRequiredAiDomains(info)).toHaveLength(3);
  });

  test('일반 사업에는 AI 제안 도메인을 추가하지 않는다', () => {
    const result = applyToBeFunctionRules([
      { lv1: '회원관리', lv2: '회원정보', lv3: '회원 조회' },
    ], { projectType: '구축', rfpText: '회원 관리 시스템' });

    expect(result.functions.map(item => item.lv1)).toEqual(['회원관리']);
  });
});
