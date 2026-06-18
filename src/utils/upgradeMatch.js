// ============================================================
// upgradeMatch.js — 고도화 모드: 기존 기능 대비 신규/변경/재사용 자동 분류
// ============================================================
// 문제: 고도화 사업에서 기존 기능목록을 올린 뒤 AI가 기능을 생성하면,
//   생성된 기능이 기존과 의미상 같아도 전부 '신규개발'로 분류됐다.
//   → FP가 부풀고(재사용은 가중치↓), 고도화 사업비 산정이 과다해진다.
//
// 해결: 생성 기능 각각을 기존 기능과 대조해
//   - 완전 일치(정규화)           → '재사용'   (그대로 씀)
//   - 높은 유사도(이름 거의 같음)  → '기능변경' (일부 수정)
//   - 매칭 없음                    → '신규개발'
//   판별은 100% 규칙 기반(결정론) — AI 비결정성 배제, 근거(matchedWith) 기록.
//
// 의존성 0. 기존 fpValidation의 norm과 동일 철학이되 독립 구현(순환참조 방지).

const norm = (s) => (s || '')
  .replace(/\s+/g, '')
  .replace(/[()\[\]·\-_/.,]/g, '')
  .replace(/(한다|하기|함|조회|관리)$/g, '')
  .toLowerCase();

// 문자 bigram Dice 유사도 (한국어 짧은 기능명에 적합)
export const diceSimilarity = (a, b) => {
  const A = norm(a), B = norm(b);
  if (!A && !B) return 1;
  if (A === B) return 1;
  if (A.length < 2 || B.length < 2) return A === B ? 1 : 0;
  const bigrams = (s) => {
    const m = new Map();
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i + 2);
      m.set(bg, (m.get(bg) || 0) + 1);
    }
    return m;
  };
  const ma = bigrams(A), mb = bigrams(B);
  let inter = 0;
  for (const [bg, c] of ma) if (mb.has(bg)) inter += Math.min(c, mb.get(bg));
  return (2 * inter) / (A.length - 1 + B.length - 1);
};

/**
 * 생성 기능 목록을 기존 기능과 대조해 reuseType을 부여한다.
 * @param {Array} generated - 신규 생성 [{lv1,lv2,lv3,definition}]
 * @param {Array} existing  - 기존 기능 [{lv1,lv2,lv3,...}]
 * @param {object} opts - { changeThreshold, reviewThreshold }
 * @returns {Array} generated에 reuseType, matchedWith, needsReview 부여된 새 배열
 *
 * 분류 정책(보수적 — 거짓양성 최소화):
 *   sim = 1.0           → 재사용 (확실)
 *   sim >= changeThr    → 기능변경 (이름 거의 동일)
 *   reviewThr~changeThr → 신규개발 + needsReview=true (사람이 확인)
 *   sim < reviewThr     → 신규개발
 * "조회 vs 상세조회"(0.75)처럼 실제로는 다른 기능을 변경으로 오분류하지 않도록
 * changeThreshold를 높게(0.82) 두고, 애매한 구간은 자동 확정 대신 표시만 한다.
 */
export const classifyReuse = (generated, existing, opts = {}) => {
  const { changeThreshold = 0.82, reviewThreshold = 0.6 } = opts;
  if (!existing || existing.length === 0) {
    return (generated || []).map(f => ({ ...f, reuseType: f.reuseType || '신규개발' }));
  }

  const exactMap = new Map();
  const byLv2 = new Map();
  for (const e of existing) {
    const k2 = norm(e.lv2), k3 = norm(e.lv3);
    exactMap.set(k2 + '|' + k3, e);
    if (!byLv2.has(k2)) byLv2.set(k2, []);
    byLv2.get(k2).push(e);
  }

  return (generated || []).map(f => {
    const k2 = norm(f.lv2), k3 = norm(f.lv3);
    // 1) 완전 일치 → 재사용
    const exact = exactMap.get(k2 + '|' + k3);
    if (exact) {
      return { ...f, reuseType: '재사용', matchedWith: `${exact.lv2} > ${exact.lv3}` };
    }
    // 2) 유사도 최고값 (같은 LV2 우선, 없으면 전체)
    let best = null, bestSim = 0;
    for (const e of (byLv2.get(k2) || [])) {
      const sim = diceSimilarity(f.lv3, e.lv3);
      if (sim > bestSim) { bestSim = sim; best = e; }
    }
    if (bestSim < changeThreshold) {
      for (const e of existing) {
        if (norm(e.lv2) === k2) continue;
        const sim = diceSimilarity(f.lv3, e.lv3);
        if (sim > bestSim) { bestSim = sim; best = e; }
      }
    }
    if (best && bestSim >= changeThreshold) {
      return { ...f, reuseType: '기능변경', matchedWith: `${best.lv2} > ${best.lv3} (유사도 ${Math.round(bestSim * 100)}%)` };
    }
    // 3) 애매 구간 → 신규로 두되 검토 표시 (자동 오분류 방지)
    if (best && bestSim >= reviewThreshold) {
      return { ...f, reuseType: '신규개발', needsReview: true, matchedWith: `유사: ${best.lv2} > ${best.lv3} (${Math.round(bestSim * 100)}%) — 재사용/변경 여부 확인` };
    }
    // 4) 완전 신규
    return { ...f, reuseType: '신규개발' };
  });
};

/** 고도화 결과 요약 (UI 알림/검증용) */
export const summarizeReuse = (functions) => {
  const s = { 신규개발: 0, 기능변경: 0, 재사용: 0 };
  (functions || []).forEach(f => { if (s[f.reuseType] !== undefined) s[f.reuseType]++; });
  return s;
};