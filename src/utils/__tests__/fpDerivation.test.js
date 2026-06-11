import { deriveDET, deriveFTR, deriveFPRow, classifyByVerb } from '../fpDerivation';
import { getComplexity } from '../fpCalculator';

describe('deriveDET — 동사 규칙표', () => {
  test.each([
    ['사용자 삭제', 4],
    ['연동합의서 등록', 9],
    ['사용자 목록조회', 8],
    ['합의서 상세조회', 13],   // '조회'보다 구체 규칙 우선
    ['연동 통계조회', 16],
    ['보고서 출력', 14],
  ])('%s → DET %i', (lv3, det) => {
    expect(deriveDET(lv3).det).toBe(det);
  });
});

describe('deriveFTR', () => {
  test('refGroups 우선 + 근거 기록', () => {
    const r = deriveFTR('합의서 승인', ['연동합의서', '결재이력']);
    expect(r.ftr).toBe(2);
    expect(r.basis).toContain('연동합의서');
  });
  test('refGroups 없으면 동사 폴백', () => {
    expect(deriveFTR('연동통계 조회', null).ftr).toBe(3);
    expect(deriveFTR('사용자 등록', null).ftr).toBe(1);
  });
  test('1~5 클램프', () => {
    expect(deriveFTR('x', ['a','b','c','d','e','f','g']).ftr).toBe(5);
  });
});

describe('deriveFPRow', () => {
  test('분류+도출 → 복잡도 재현 (같은 입력 = 같은 결과)', () => {
    const r = deriveFPRow({ lv3: '연동합의서 승인' }, { fpType: 'EI', refGroups: ['합의서', '결재이력'] });
    expect(getComplexity('EI', r.ftr, r.det)).toBe('medium');
    expect(r.classified).toBe(true);
  });
  test('AI 분류 누락 행: 동사 폴백 + 마킹', () => {
    const r = deriveFPRow({ lv3: '사용자 등록' }, null);
    expect(r.classified).toBe(false);
    expect(r.fpType).toBe('EI');
  });
});

describe('classifyByVerb 폴백', () => {
  test.each([
    ['연동보고서 출력', 'EO'],
    ['사용자 목록조회', 'EQ'],
    ['사용자 등록', 'EI'],
  ])('%s → %s', (lv3, type) => {
    expect(classifyByVerb(lv3)).toBe(type);
  });
});
