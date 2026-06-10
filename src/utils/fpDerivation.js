// ============================================================
// fpDerivation.js — FTR/DET 결정론적 도출
// ============================================================
// 설계 원칙:
//   AI의 역할은 "분류"까지 — fpType(EI/EO/EQ) + 참조 데이터그룹(refGroups).
//   FTR/DET 숫자는 아래 규칙표가 결정한다.
//
// 왜 이렇게 하는가:
//   기존(AI가 FTR/DET 직접 생성)은 ① 같은 입력에 다른 결과(재현 불가),
//   ② 응답 잘림/실패 시 기본값(EI/1/5=L)으로 조용히 도배 → "L 93.6%"의 직접 원인,
//   ③ 감리에서 "DET 5의 근거가 뭐냐"에 답변 불가.
//   규칙표 방식은 거칠어도 일관적이고, 근거를 문서로 제시할 수 있으며,
//   행 단위 수동 수정(updateFP)으로 보정 가능하다.
// ============================================================

// ── DET 규칙표: LV3 동사 카테고리 → DET ─────────────────────
// 근거: 동사 유형이 화면 데이터 항목 수의 1차 결정 요인.
// 값은 공공SW 화면 설계 관행 기반 보수적 중앙값 — 캘리브레이션 셋 확보 시 조정 대상.
const DET_RULES = [
  // 주의: 구체적 패턴이 먼저 와야 한다 ('상세조회'는 '조회'로도 끝나므로)
  { pattern: /(상세조회|상세보기)$/,                       det: 13, basis: '상세화면 항목' },
  { pattern: /(통계조회|현황조회|집계|분석)$/,             det: 16, basis: '차원+측정값+기간' },
  { pattern: /(삭제|취소|초기화|활성|비활성)$/,           det: 4,  basis: '단순액션(식별자+확인)' },
  { pattern: /(승인|반려|확정|제출|배정|알림)$/,           det: 6,  basis: '상태변경(키+상태+의견)' },
  { pattern: /(등록|수정|업로드|설정)$/,                   det: 9,  basis: '입력폼 필드' },
  { pattern: /(목록조회|검색|이력조회|조회)$/,             det: 8,  basis: '검색조건+목록컬럼' },
  { pattern: /(출력|다운로드|보고서)$/,                    det: 14, basis: '보고서 항목' },
  { pattern: /(처리)$/,                                    det: 7,  basis: '업무처리 항목' },
];
const DET_DEFAULT = { det: 7, basis: '일반 기능 기본값' };

export const deriveDET = (lv3) => {
  const name = (lv3 || '').trim();
  for (const r of DET_RULES) {
    if (r.pattern.test(name)) return { det: r.det, basis: r.basis };
  }
  return { ...DET_DEFAULT };
};

// ── FTR 도출 ────────────────────────────────────────────────
// 1순위: AI가 분류 단계에서 식별한 참조 데이터그룹 수 (근거 = 그룹명 나열)
// 2순위(폴백): 동사 기반 규칙
const FTR_FALLBACK_RULES = [
  { pattern: /(통계|현황|집계|보고서|분석|대시보드)/, ftr: 3 },
  { pattern: /(승인|반려|처리|이력|배정|연동)/,       ftr: 2 },
];
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

export const deriveFTR = (lv3, refGroups) => {
  if (Array.isArray(refGroups) && refGroups.length > 0) {
    return {
      ftr: clamp(refGroups.length, 1, 5),
      basis: `참조: ${refGroups.slice(0, 5).join(', ')}`,
    };
  }
  const name = (lv3 || '').trim();
  for (const r of FTR_FALLBACK_RULES) {
    if (r.pattern.test(name)) return { ftr: r.ftr, basis: '동사규칙(폴백)' };
  }
  return { ftr: 1, basis: '단일참조(폴백)' };
};

// ── 통합: 분류 결과 → FP 행 ─────────────────────────────────
// classified: { fpType: 'EI'|'EO'|'EQ', refGroups: ['연동합의서','사용자'] }
export const deriveFPRow = (func, classified) => {
  const fpType = ['EI', 'EO', 'EQ'].includes(classified?.fpType) ? classified.fpType : null;
  const { ftr, basis: ftrBasis } = deriveFTR(func.lv3, classified?.refGroups);
  const { det } = deriveDET(func.lv3);
  return {
    fpType: fpType || classifyByVerb(func.lv3), // AI 분류 실패 시 동사 기반 폴백
    ftr,
    det,
    fpBasis: ftrBasis, // 산정 근거 (bigo/감리 방어용)
    classified: !!fpType, // false = 폴백 사용됨 (검증 탭에서 표시)
  };
};

// ── fpType 동사 기반 폴백 분류 (AI 응답 누락 행 전용) ────────
// validateFP의 의심 패턴과 동일 기준 — 기본값 EI 고정 대신 사용.
export const classifyByVerb = (lv3) => {
  const name = (lv3 || '').trim();
  if (/(통계|집계|보고서|출력|다운로드|현황|분석|그래프)/.test(name)) return 'EO';
  if (/(조회|검색|목록|상세|이력|확인)/.test(name)) return 'EQ';
  return 'EI'; // 등록/수정/삭제/처리/승인 등
};

export const DET_RULES_DOC = DET_RULES.map(r => ({ pattern: String(r.pattern), det: r.det, basis: r.basis }));
