// FTR/복잡도 분포 리포트. CommonJS 유지(ESM 구문 혼용 금지).
// getComplexity(fpType, ftr, det)는 계산식 중복을 피하려고 호출자가 주입한다(생략 시 복잡도 분포 생략).
const TRANSACTION_TYPES = ['EI', 'EO', 'EQ'];
const bucketOf = ftr => (Number(ftr) >= 3 ? '3+' : String(Math.max(1, Number(ftr) || 1)));
const percent = (count, total) => (total ? Math.round((count / total) * 1000) / 10 : 0);

const distribution = (rows, keyOf, keys) => {
  const counts = Object.fromEntries(keys.map(key => [key, 0]));
  rows.forEach(row => { counts[keyOf(row)] += 1; });
  return Object.fromEntries(keys.map(key => [key, { count: counts[key], pct: percent(counts[key], rows.length) }]));
};

const buildFtrReport = (fpList, getComplexity) => {
  const rows = (fpList || []).filter(row => TRANSACTION_TYPES.includes(row.fpType));
  const ftrKeys = ['1', '2', '3+'];
  const report = {
    transactionCount: rows.length,
    ftr: distribution(rows, row => bucketOf(row.ftr), ftrKeys),
    ftrByType: Object.fromEntries(TRANSACTION_TYPES.map(type => {
      const typed = rows.filter(row => row.fpType === type);
      return [type, { count: typed.length, ...distribution(typed, row => bucketOf(row.ftr), ftrKeys) }];
    })),
    fallbackFtrCount: rows.filter(row => /폴백/.test(String(row.bigo || ''))).length,
  };
  if (typeof getComplexity === 'function') {
    report.complexity = distribution(rows, row => getComplexity(row.fpType, row.ftr, row.det) || 'low', ['low', 'medium', 'high']);
  }
  return report;
};

const formatFtrReport = report => {
  const line = (label, dist) => `${label}: ${Object.entries(dist).map(([key, value]) => `${key}=${value.count}(${value.pct}%)`).join(' / ')}`;
  return [
    `트랜잭션 ${report.transactionCount}건`,
    line('FTR 분포', report.ftr),
    ...Object.entries(report.ftrByType).map(([type, value]) => line(`  ${type}(${value.count})`, { 1: value['1'], 2: value['2'], '3+': value['3+'] })),
    ...(report.complexity ? [line('복잡도 분포', report.complexity)] : []),
    `FTR 폴백 사용: ${report.fallbackFtrCount}건`,
  ].join('\n');
};

module.exports = { buildFtrReport, formatFtrReport };
