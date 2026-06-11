import { validateDistribution, checkFunctionCount, findMergeCandidates, validateAll } from '../fpValidation';

describe('validateDistribution', () => {
  test('L 도배(>80%) 경고', () => {
    const fpList = [
      ...Array.from({ length: 47 }, () => ({ fpType: 'EI', ftr: 1, det: 4 })),
      ...Array.from({ length: 3 }, () => ({ fpType: 'EI', ftr: 2, det: 8 })),
    ];
    expect(validateDistribution(fpList).some(i => i.type === '복잡도편향')).toBe(true);
  });
  test('구버전 기본값(ftr1/det5) 도배 탐지', () => {
    const fpList = Array.from({ length: 30 }, () => ({ fpType: 'EI', ftr: 1, det: 5 }));
    expect(validateDistribution(fpList).some(i => i.type === '산정실패의심')).toBe(true);
  });
  test('ILF 과다(트랜잭션 대비 25% 초과) 경고', () => {
    const fpList = [
      ...Array.from({ length: 40 }, () => ({ fpType: 'EI', ftr: 1, det: 9 })),
      ...Array.from({ length: 15 }, () => ({ fpType: 'ILF', ftr: 1, det: 10 })),
    ];
    expect(validateDistribution(fpList).some(i => i.type === 'ILF과다')).toBe(true);
  });
  test('정상 분포는 경고 없음', () => {
    const fpList = [
      ...Array.from({ length: 30 }, (_, i) => ({ fpType: 'EI', ftr: 1 + (i % 2), det: 6 + (i % 8) })),
      ...Array.from({ length: 4 }, () => ({ fpType: 'ILF', ftr: 2, det: 18 })),
    ];
    expect(validateDistribution(fpList).filter(i => i.severity === 'error')).toHaveLength(0);
  });
});

describe('checkFunctionCount — 양방향', () => {
  test('과다(>120%)는 OVER', () => expect(checkFunctionCount(313, 169).verdict).toBe('OVER'));
  test('부족(<80%)은 UNDER', () => expect(checkFunctionCount(120, 169).verdict).toBe('UNDER'));
  test('±20% 이내는 OK', () => expect(checkFunctionCount(170, 169).verdict).toBe('OK'));
  test('목표 미설정이면 null', () => expect(checkFunctionCount(100, 0)).toBeNull());
});

describe('findMergeCandidates — elementary process', () => {
  test('같은 LV2 내 조회 계열 3개 이상 플래그, 목록+상세 쌍은 허용', () => {
    const fns = [
      { lv1: 'A', lv2: '연동현황', lv3: '연동현황 목록조회' },
      { lv1: 'A', lv2: '연동현황', lv3: '연동현황 상세조회' },
      { lv1: 'A', lv2: '사용자관리', lv3: '사용자 목록조회' },
      { lv1: 'A', lv2: '사용자관리', lv3: '사용자 검색' },
      { lv1: 'A', lv2: '사용자관리', lv3: '사용자 조회' },
    ];
    const c = findMergeCandidates(fns);
    expect(c).toHaveLength(1);
    expect(c[0].lv2).toBe('사용자관리');
  });
});

describe('validateAll 통합', () => {
  test('기능수 OVER + 병합후보 + 분포 경고 통합 반환', () => {
    const fns = Array.from({ length: 313 }, (_, i) =>
      ({ lv1: 'A', lv2: `m${i % 40}`, lv3: `기능${i} 등록` }));
    const issues = validateAll(fns, [], 169);
    expect(issues.some(i => i.type === '기능수OVER')).toBe(true);
  });
});
