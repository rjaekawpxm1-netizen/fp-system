import { classifyReuse, diceSimilarity, summarizeReuse, snapDomainsToExisting } from '../upgradeMatch';

describe('snapDomainsToExisting', () => {
  const existing = ['연동계획', '연동운영', '연동현황', '장애처리'];

  test('"~관리" 덧붙은 이름을 기존 명칭으로 스냅', () => {
    const domains = [{ lv1: '연동계획관리' }, { lv1: '연동운영관리' }];
    const r = snapDomainsToExisting(domains, existing);
    expect(r[0].lv1).toBe('연동계획');
    expect(r[0].snappedFrom).toBe('연동계획관리');
    expect(r[1].lv1).toBe('연동운영');
  });

  test('기존과 정확히 같으면 그대로', () => {
    const r = snapDomainsToExisting([{ lv1: '연동계획' }], existing);
    expect(r[0].lv1).toBe('연동계획');
    expect(r[0].snappedFrom).toBeUndefined();
  });

  test('완전히 새로운 도메인은 스냅하지 않음', () => {
    const r = snapDomainsToExisting([{ lv1: 'API게이트웨이' }], existing);
    expect(r[0].lv1).toBe('API게이트웨이');
    expect(r[0].snappedFrom).toBeUndefined();
  });

  test('기존 목록 없으면 원본 유지', () => {
    const domains = [{ lv1: '연동계획관리' }];
    expect(snapDomainsToExisting(domains, [])[0].lv1).toBe('연동계획관리');
    expect(snapDomainsToExisting(domains, null)[0].lv1).toBe('연동계획관리');
  });
});

describe('diceSimilarity', () => {
  test('동일 문자열 = 1', () => {
    expect(diceSimilarity('사용자 등록', '사용자 등록')).toBe(1);
  });
  test('공백/조사 정규화 후 동일 = 1', () => {
    expect(diceSimilarity('사용자등록', '사용자 등록')).toBe(1);
  });
  test('전혀 다른 기능 = 낮음', () => {
    expect(diceSimilarity('사용자 등록', '연동현황 통계조회')).toBeLessThan(0.4);
  });
  test('짧은 비동일 안전', () => {
    expect(diceSimilarity('가', '나')).toBe(0);
    expect(diceSimilarity('', '')).toBe(1);
  });
});

describe('classifyReuse', () => {
  const existing = [
    { lv1: '연동관리', lv2: '연동합의서관리', lv3: '연동합의서 등록' },
    { lv1: '연동관리', lv2: '연동합의서관리', lv3: '연동합의서 목록조회' },
    { lv1: '시스템관리', lv2: '사용자관리', lv3: '사용자 등록' },
  ];

  test('완전 일치 → 재사용', () => {
    const gen = [{ lv1: '연동관리', lv2: '연동합의서관리', lv3: '연동합의서 등록', definition: 'x' }];
    const r = classifyReuse(gen, existing);
    expect(r[0].reuseType).toBe('재사용');
    expect(r[0].matchedWith).toContain('연동합의서 등록');
  });

  test('공백 차이만 있는 일치 → 재사용', () => {
    const gen = [{ lv1: '연동관리', lv2: '연동합의서 관리', lv3: '연동합의서등록' }];
    expect(classifyReuse(gen, existing)[0].reuseType).toBe('재사용');
  });

  test('이름 거의 같음(높은 유사도) → 기능변경', () => {
    // 동일 LV2 내 매우 유사한 변형 (유사도 0.82+)
    const gen = [{ lv1: '시스템관리', lv2: '사용자관리', lv3: '사용자 등록 처리' }];
    const r = classifyReuse(gen, existing, { changeThreshold: 0.6 });
    expect(r[0].reuseType).toBe('기능변경');
    expect(r[0].matchedWith).toContain('유사도');
  });

  test('애매한 유사도(0.6~0.82) → 신규개발 + 검토표시 (오분류 방지)', () => {
    const gen = [{ lv1: '연동관리', lv2: '연동합의서관리', lv3: '연동합의서 일괄등록' }];
    const r = classifyReuse(gen, existing);
    expect(r[0].reuseType).toBe('신규개발');
    expect(r[0].needsReview).toBe(true);
  });

  test('조회 vs 상세조회는 변경으로 오분류하지 않음', () => {
    const ex2 = [{ lv1: 'A', lv2: '현황', lv3: '연동현황 조회' }];
    const gen = [{ lv1: 'A', lv2: '현황', lv3: '연동현황 상세조회' }];
    const r = classifyReuse(gen, ex2);
    expect(r[0].reuseType).not.toBe('기능변경'); // 0.75 < 0.82
  });

  test('매칭 없는 완전 신규 → 신규개발', () => {
    const gen = [{ lv1: '통계관리', lv2: '대시보드', lv3: '실시간 모니터링 대시보드' }];
    const r = classifyReuse(gen, existing);
    expect(r[0].reuseType).toBe('신규개발');
    expect(r[0].needsReview).toBeUndefined();
  });

  test('기존이 없으면 전부 신규개발 (방어)', () => {
    const gen = [{ lv1: 'A', lv2: 'B', lv3: 'C 등록' }];
    expect(classifyReuse(gen, [])[0].reuseType).toBe('신규개발');
    expect(classifyReuse(gen, null)[0].reuseType).toBe('신규개발');
  });

  test('혼합 입력 분류', () => {
    const gen = [
      { lv1: '연동관리', lv2: '연동합의서관리', lv3: '연동합의서 등록' },      // 재사용(완전일치)
      { lv1: '신규영역', lv2: '신규메뉴', lv3: '완전히 새로운 기능 처리' },    // 신규
    ];
    const s = summarizeReuse(classifyReuse(gen, existing));
    expect(s.재사용).toBe(1);
    expect(s.신규개발).toBe(1);
  });
});