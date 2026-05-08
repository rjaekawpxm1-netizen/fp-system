// FP 복잡도 판정 및 가중치 산정
// IFPUG CPM 4.3.1 / SW사업 대가산정 가이드 2025 기준

const FP_WEIGHTS = {
  EI:  { low: 3, medium: 4, high: 6  },
  EO:  { low: 4, medium: 5, high: 7  },
  EQ:  { low: 3, medium: 4, high: 6  },
  ILF: { low: 7, medium: 10, high: 15 },
  EIF: { low: 5, medium: 7,  high: 10 },
};

// 간이법 평균 가중치
const AVG_WEIGHTS = {
  EI: 4.0, EO: 5.2, EQ: 3.9, ILF: 7.5, EIF: 5.4,
};

/**
 * IFPUG CPM 4.3.1 정통법 복잡도 매트릭스
 *
 * EI:
 *   FTR 0-1 / DET 1-4   → Low(3)
 *   FTR 0-1 / DET 5-15  → Low(3)
 *   FTR 0-1 / DET 16+   → Average(4)
 *   FTR 2   / DET 1-4   → Low(3)
 *   FTR 2   / DET 5-15  → Average(4)  ← 기존 버그: Low로 계산
 *   FTR 2   / DET 16+   → High(6)     ← 기존 버그: Medium으로 계산
 *   FTR 3+  / DET 1-4   → Average(4)
 *   FTR 3+  / DET 5-15  → High(6)     ← 기존 버그: Medium으로 계산
 *   FTR 3+  / DET 16+   → High(6)
 */
const COMPLEXITY_RULES = {
  EI: (ftr, det) => {
    if (ftr <= 1) {
      if (det <= 15) return 'low';
      return 'medium';
    }
    if (ftr === 2) {
      if (det <= 4)  return 'low';
      if (det <= 15) return 'medium';
      return 'high';
    }
    // ftr >= 3
    if (det <= 4) return 'medium';
    return 'high';
  },

  EO: (ftr, det) => {
    if (ftr <= 1) {
      if (det <= 19) return 'low';
      return 'medium';
    }
    if (ftr <= 3) {
      if (det <= 5)  return 'low';
      if (det <= 19) return 'medium';
      return 'high';
    }
    // ftr >= 4
    if (det <= 5) return 'medium';
    return 'high';
  },

  EQ: (ftr, det) => {
    if (ftr <= 1) {
      if (det <= 19) return 'low';
      return 'medium';
    }
    if (ftr <= 3) {
      if (det <= 5)  return 'low';
      if (det <= 19) return 'medium';
      return 'high';
    }
    // ftr >= 4
    if (det <= 5) return 'medium';
    return 'high';
  },

  // ILF/EIF: ftr 필드를 RET(레코드서브그룹수)로 사용
  ILF: (ret, det) => {
    if (ret <= 1) {
      if (det <= 19) return 'low';
      if (det <= 50) return 'medium';
      return 'high';
    }
    if (ret <= 5) {
      if (det <= 50) return 'medium';
      return 'high';
    }
    return 'high';
  },

  EIF: (ret, det) => {
    if (ret <= 1) {
      if (det <= 19) return 'low';
      if (det <= 50) return 'medium';
      return 'high';
    }
    if (ret <= 5) {
      if (det <= 50) return 'medium';
      return 'high';
    }
    return 'high';
  },
};

// 복잡도 판정
export const getComplexity = (fpType, ftr, det) => {
  const rule = COMPLEXITY_RULES[fpType];
  if (!rule) return 'medium';
  return rule(Number(ftr) || 0, Number(det) || 0);
};

// 복잡도 레이블 변환 (low→L, medium→A, high→H)
export const getComplexityLabel = (complexity) => {
  return { low: 'L', medium: 'A', high: 'H' }[complexity] || 'A';
};

// 정통법 가중치
export const getWeight = (fpType, ftr, det) => {
  const complexity = getComplexity(fpType, ftr, det);
  return (FP_WEIGHTS[fpType] || {})[complexity] || 0;
};

// 간이법 평균 가중치
export const getAvgWeight = (fpType) => {
  return AVG_WEIGHTS[fpType] || 0;
};

// 변경률 계산 (%)
export const getChangePct = (changeAmt, total) => {
  if (!total || Number(total) === 0) return 0;
  return ((Number(changeAmt) / Number(total)) * 100).toFixed(1);
};

// 기능 변경률 계산
// ILF/EIF는 DET변경률만, 나머지는 FTR+DET 평균
export const getFuncChangePct = (ftrChangePct, detChangePct, fpType) => {
  if (['ILF', 'EIF'].includes(fpType)) {
    return Number(detChangePct).toFixed(1);
  }
  const avg = (Number(ftrChangePct) + Number(detChangePct)) / 2;
  return avg.toFixed(1);
};

// 영향계수 (기능변경률 → 25%/50%/75%/100% 구간)
export const getImpactFactor = (funcChangePct) => {
  const pct = Number(funcChangePct);
  if (pct <= 25) return 0.25;
  if (pct <= 50) return 0.50;
  if (pct <= 75) return 0.75;
  return 1.00;
};

// FP 합계 계산 (정통법/간이법 모두 지원)
export const calcTotalFP = (rows, method = 'standard') => {
  let newDev = 0;
  let changed = 0;

  (rows || []).forEach((row) => {
    const weight = method === 'simple'
      ? getAvgWeight(row.fpType)
      : getWeight(row.fpType, row.ftr, row.det);

    if (row.reuseType === '신규개발') {
      newDev += weight;
    } else if (row.reuseType === '기능변경') {
      const ftrPct = getChangePct(row.ftrChange, row.ftr);
      const detPct = getChangePct(row.detChange, row.det);
      const funcPct = getFuncChangePct(ftrPct, detPct, row.fpType);
      const impact = getImpactFactor(funcPct);
      changed += weight * impact;
    }
  });

  return {
    newDev: newDev.toFixed(2),
    changed: changed.toFixed(2),
  };
};