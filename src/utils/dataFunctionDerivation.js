const normalizeCandidates = (values) => {
  const seen = new Set();
  return (Array.isArray(values) ? values : [])
    .map(value => String(value?.name || value || '').trim())
    .filter(value => {
      const key = value.toLocaleLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

// AI는 후보를 식별하고, 숫자는 후보의 고유 개수로만 결정한다.
export const deriveDataFunctionMetrics = (group) => {
  const recordSubgroups = normalizeCandidates(group?.recordSubgroups);
  const dataElements = normalizeCandidates(group?.dataElements);
  const calculationPending = dataElements.length === 0;

  return {
    recordSubgroups,
    dataElements,
    ret: Math.min(6, Math.max(1, recordSubgroups.length)),
    det: Math.min(99, Math.max(1, dataElements.length)),
    calculationPending,
    needsReview: calculationPending,
    metricBasis: calculationPending
      ? 'DET 후보가 없어 수동 수치 확정 필요'
      : `규칙 산정: RET 후보 ${recordSubgroups.length || 1}개, DET 후보 ${dataElements.length}개`,
  };
};
