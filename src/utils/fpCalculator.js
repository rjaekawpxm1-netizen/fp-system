// FP 복잡도 판정 및 가중치 산정
// IFPUG CPM ISO/IEC 20926 정통법 기준 (2025년 SW사업 대가산정 가이드)

// ============================================================
// 정통법 가중치 테이블
// ============================================================
const FP_WEIGHTS = {
  EI:  { low: 3, medium: 4, high: 6 },
  EO:  { low: 4, medium: 5, high: 7 },
  EQ:  { low: 3, medium: 4, high: 6 },
  ILF: { low: 7, medium: 10, high: 15 },
  EIF: { low: 5, medium: 7,  high: 10 },
};

// 간이법 평균복잡도 가중치
export const AVG_WEIGHTS = {
  EI: 4.0, EO: 5.2, EQ: 3.9, ILF: 7.5, EIF: 5.4,
};

// ============================================================
// 정통법 복잡도 판정 (IFPUG 표준 테이블 그대로 구현)
// ============================================================

// EI 복잡도 (FTR/DET 기준)
// | FTR\DET | 1~4  | 5~15 | 16+  |
// |---------|------|------|------|
// | 0~1     | 낮음 | 낮음 | 보통 |
// | 2       | 낮음 | 보통 | 높음 |
// | 3+      | 보통 | 높음 | 높음 |
const getEIComplexity = (ftr, det) => {
  const f = Number(ftr);
  const d = Number(det);
  if (f <= 1) {
    if (d <= 4)  return 'low';
    if (d <= 15) return 'low';
    return 'medium'; // d >= 16
  }
  if (f === 2) {
    if (d <= 4)  return 'low';
    if (d <= 15) return 'medium';
    return 'high'; // d >= 16
  }
  // f >= 3
  if (d <= 4)  return 'medium';
  if (d <= 15) return 'high';
  return 'high'; // d >= 16
};

// EO 복잡도 (FTR/DET 기준)
// | FTR\DET | 1~5  | 6~19 | 20+  |
// |---------|------|------|------|
// | 0~1     | 낮음 | 낮음 | 보통 |
// | 2~3     | 낮음 | 보통 | 높음 |
// | 4+      | 보통 | 높음 | 높음 |
const getEOComplexity = (ftr, det) => {
  const f = Number(ftr);
  const d = Number(det);
  if (f <= 1) {
    if (d <= 5)  return 'low';
    if (d <= 19) return 'low';
    return 'medium'; // d >= 20
  }
  if (f <= 3) {
    if (d <= 5)  return 'low';
    if (d <= 19) return 'medium';
    return 'high'; // d >= 20
  }
  // f >= 4
  if (d <= 5)  return 'medium';
  if (d <= 19) return 'high';
  return 'high'; // d >= 20
};

// EQ 복잡도 (FTR/DET 기준)
// | FTR\DET | 1~5  | 6~19 | 20+  |
// |---------|------|------|------|
// | 1       | 낮음 | 낮음 | 보통 |
// | 2~3     | 낮음 | 보통 | 높음 |
// | 4+      | 보통 | 높음 | 높음 |
const getEQComplexity = (ftr, det) => {
  const f = Number(ftr);
  const d = Number(det);
  if (f <= 1) {
    if (d <= 5)  return 'low';
    if (d <= 19) return 'low';
    return 'medium'; // d >= 20
  }
  if (f <= 3) {
    if (d <= 5)  return 'low';
    if (d <= 19) return 'medium';
    return 'high'; // d >= 20
  }
  // f >= 4
  if (d <= 5)  return 'medium';
  if (d <= 19) return 'high';
  return 'high'; // d >= 20
};

// ILF 복잡도 (RET/DET 기준)
// | RET\DET | 1~19 | 20~50 | 51+  |
// |---------|------|-------|------|
// | 1       | 낮음 | 낮음  | 보통 |
// | 2~5     | 낮음 | 보통  | 높음 |
// | 6+      | 보통 | 높음  | 높음 |
const getILFComplexity = (ret, det) => {
  const r = Number(ret);
  const d = Number(det);
  if (r <= 1) {
    if (d <= 19) return 'low';
    if (d <= 50) return 'low';
    return 'medium'; // d >= 51
  }
  if (r <= 5) {
    if (d <= 19) return 'low';
    if (d <= 50) return 'medium';
    return 'high'; // d >= 51
  }
  // r >= 6
  if (d <= 19) return 'medium';
  if (d <= 50) return 'high';
  return 'high'; // d >= 51
};

// EIF 복잡도 (RET/DET 기준)
// | RET\DET | 1~19 | 20~50 | 51+  |
// |---------|------|-------|------|
// | 1       | 낮음 | 낮음  | 보통 |
// | 2~5     | 낮음 | 보통  | 높음 |
// | 6+      | 보통 | 높음  | 높음 |
const getEIFComplexity = (ret, det) => {
  const r = Number(ret);
  const d = Number(det);
  if (r <= 1) {
    if (d <= 19) return 'low';
    if (d <= 50) return 'low';
    return 'medium';
  }
  if (r <= 5) {
    if (d <= 19) return 'low';
    if (d <= 50) return 'medium';
    return 'high';
  }
  if (d <= 19) return 'medium';
  if (d <= 50) return 'high';
  return 'high';
};

// ============================================================
// 공개 함수
// ============================================================

// 복잡도 판정 (정통법)
export const getComplexity = (fpType, ftr, det) => {
  switch (fpType) {
    case 'EI':  return getEIComplexity(ftr, det);
    case 'EO':  return getEOComplexity(ftr, det);
    case 'EQ':  return getEQComplexity(ftr, det);
    case 'ILF': return getILFComplexity(ftr, det);
    case 'EIF': return getEIFComplexity(ftr, det);
    default:    return 'medium';
  }
};

// 복잡도 한글명
export const getComplexityLabel = (complexity) => {
  const map = { low: '낮음', medium: '보통', high: '높음' };
  return map[complexity] || '-';
};

// 정통법 가중치
export const getWeight = (fpType, ftr, det) => {
  const complexity = getComplexity(fpType, ftr, det);
  return (FP_WEIGHTS[fpType] && FP_WEIGHTS[fpType][complexity]) || 0;
};

// 간이법 가중치
export const getAvgWeight = (fpType) => {
  return AVG_WEIGHTS[fpType] || 0;
};

// 변경률 계산
export const getChangePct = (changeAmt, total) => {
  if (!total || Number(total) === 0) return 0;
  return ((Number(changeAmt) / Number(total)) * 100).toFixed(1);
};

// 기능 변경률 계산
export const getFuncChangePct = (ftrChangePct, detChangePct) => {
  const avg = (Number(ftrChangePct) + Number(detChangePct)) / 2;
  return avg.toFixed(1);
};

// 영향계수 계산
export const getImpactFactor = (funcChangePct) => {
  const pct = Number(funcChangePct);
  if (pct <= 25) return 0.25;
  if (pct <= 50) return 0.50;
  if (pct <= 75) return 0.75;
  return 1.00;
};

// FP 합계 계산 (정통법 + 간이법 둘 다)
export const calcTotalFP = (rows, method = 'standard') => {
  let newDev = 0;
  let changed = 0;

  rows.forEach((row) => {
    const weight = method === 'simple'
      ? getAvgWeight(row.fpType)
      : getWeight(row.fpType, row.ftr, row.det);

    if (row.reuseType === '신규개발') {
      newDev += weight;
    } else if (row.reuseType === '기능변경') {
      const ftrPct = getChangePct(row.ftrChange || 0, row.ftr);
      const detPct = getChangePct(row.detChange || 0, row.det);
      const funcPct = getFuncChangePct(ftrPct, detPct);
      const impact = getImpactFactor(funcPct);
      changed += weight * impact;
    }
  });

  return {
    newDev: newDev.toFixed(2),
    changed: changed.toFixed(2),
  };
};

export const FP_UNIT_PRICE = 605784;
