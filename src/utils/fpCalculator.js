// FP 복잡도 판정 및 가중치 산정 (SW사업 FP 대가산정 가이드 기준)

const FP_WEIGHTS = {
  EI: { low: 3, medium: 4, high: 6 },
  EO: { low: 4, medium: 5, high: 7 },
  EQ: { low: 3, medium: 4, high: 6 },
  ILF: { low: 7, medium: 10, high: 15 },
  EIF: { low: 5, medium: 7, high: 10 },
};

const COMPLEXITY_RULES = {
  EI: (ftr, det) => {
    if (ftr <= 1 && det <= 15) return 'low';
    if (ftr <= 2 && det <= 15) return 'low';
    if (ftr <= 2 && det >= 16) return 'medium';
    if (ftr >= 3 && det <= 15) return 'medium';
    if (ftr >= 3 && det >= 16) return 'high';
    return 'medium';
  },
  EO: (ftr, det) => {
    if (ftr <= 1 && det <= 19) return 'low';
    if (ftr <= 2 && det <= 19) return 'low';
    if (ftr <= 2 && det >= 20) return 'medium';
    if (ftr >= 3 && det <= 19) return 'medium';
    if (ftr >= 3 && det >= 20) return 'high';
    return 'medium';
  },
  EQ: (ftr, det) => {
    if (ftr <= 1 && det <= 19) return 'low';
    if (ftr <= 2 && det <= 19) return 'low';
    if (ftr <= 2 && det >= 20) return 'medium';
    if (ftr >= 3 && det <= 19) return 'medium';
    if (ftr >= 3 && det >= 20) return 'high';
    return 'medium';
  },
  ILF: (ftr, det) => {
    if (ftr <= 1 && det <= 19) return 'low';
    if (ftr <= 1 && det >= 20) return 'medium';
    if (ftr >= 2 && det <= 19) return 'medium';
    if (ftr >= 2 && det >= 20) return 'high';
    return 'medium';
  },
  EIF: (ftr, det) => {
    if (ftr <= 1 && det <= 19) return 'low';
    if (ftr <= 1 && det >= 20) return 'medium';
    if (ftr >= 2 && det <= 19) return 'medium';
    if (ftr >= 2 && det >= 20) return 'high';
    return 'medium';
  },
};

// 복잡도 판정
export const getComplexity = (fpType, ftr, det) => {
  const rule = COMPLEXITY_RULES[fpType];
  if (!rule) return 'medium';
  return rule(Number(ftr), Number(det));
};

// 가중치 산정
export const getWeight = (fpType, ftr, det) => {
  const complexity = getComplexity(fpType, ftr, det);
  const weights = FP_WEIGHTS[fpType];
  if (!weights) return 0;
  return weights[complexity];
};

// 변경률 계산
export const getChangePct = (changeAmt, total) => {
  if (!total || total === 0) return 0;
  return ((changeAmt / total) * 100).toFixed(1);
};

// 기능 변경률 계산
export const getFuncChangePct = (ftrChangePct, detChangePct) => {
  const avg = (Number(ftrChangePct) + Number(detChangePct)) / 2;
  return avg.toFixed(1);
};

// 영향계수 계산 (기능변경률 기준)
export const getImpactFactor = (funcChangePct) => {
  const pct = Number(funcChangePct);
  if (pct <= 25) return 0.25;
  if (pct <= 50) return 0.50;
  if (pct <= 75) return 0.75;
  return 1.00;
};

// FP 합계 계산
export const calcTotalFP = (rows) => {
  let newDev = 0;
  let changed = 0;

  rows.forEach((row) => {
    const weight = getWeight(row.fpType, row.ftr, row.det);
    if (row.reuseType === '신규개발') {
      newDev += weight;
    } else if (row.reuseType === '기능변경') {
      const funcChangePct = getFuncChangePct(
        getChangePct(row.ftrChange, row.ftr),
        getChangePct(row.detChange, row.det)
      );
      const impact = getImpactFactor(funcChangePct);
      changed += weight * impact;
    }
  });

  return {
    newDev: newDev.toFixed(2),
    changed: changed.toFixed(2),
  };
};
