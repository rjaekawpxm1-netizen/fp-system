const { applyToBeFunctionRules } = require('./toBeFunctionRules');

const parseModelJSON = text => {
  let clean = String(text || '').replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  try { return JSON.parse(clean); } catch (_) {}
  const start = clean.indexOf('{');
  if (start !== -1) clean = clean.slice(start);
  for (let end = clean.length; end > 0;) {
    const position = clean.lastIndexOf('}', end - 1);
    if (position === -1) break;
    try { return JSON.parse(clean.slice(0, position + 1)); } catch (_) { end = position; }
  }
  return {};
};

const crossLv1Dedup = funcs => {
  const normalize = value => String(value || '').replace(/\s+/g, '');
  const seen = new Set();
  return (funcs || []).filter(func => {
    const key = `${normalize(func.lv2)}|${normalize(func.lv3)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const finalizeDomainFunctions = (allFunctions, info, existingFunctions = [], options = {}) => {
  const { classifyReuse, summarizeReuse, onProgress } = options;
  const report = (step, message, percent) => onProgress && onProgress(step, message, percent);
  const systemName = info?.systemName;
  if (!allFunctions?.length) {
    throw new Error('기능이 생성되지 않았습니다. 업로드 문서에 기능 요구사항이 충분한지, 브라우저 콘솔(F12)의 API 오류를 확인하세요.');
  }

  const badLv1 = ['AI/ML','AIOps','클라우드 및 인프라','아키텍처 설계',
    '실시간 데이터 스트리밍','인프라 고도화','지능형 운영','운영 자동화',
    '포렌식','비즈니스연속성','사이버보안 통합'];
  const adminLv1 = ['사업관리','품질관리','일정관리','위험관리','교육관리','유지보수'];
  const badAdmin = adminLv1.filter(keyword => !String(systemName || '').includes(keyword.slice(0, 2)));
  const badLv3 = [/자동화\s*구현/,/지능화\s*적용/,/고도화\s*수행/,/아키텍처\s*설계/];
  const filtered = allFunctions.filter(func => {
    if (!func.lv1 || !func.lv2 || !func.lv3?.trim()) return false;
    if (badLv1.some(keyword => func.lv1.includes(keyword))) return false;
    if (badAdmin.some(keyword => func.lv1.replace(/\s/g, '') === keyword)) return false;
    if (badLv3.some(pattern => pattern.test(func.lv3))) return false;
    return func.lv3.trim() !== func.lv2.trim();
  });
  const seen = new Set();
  const deduped = filtered.filter(func => {
    const key = `${func.lv1}|${func.lv2}|${func.lv3}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const normalized = deduped.map(func => ({
    ...func,
    lv3: (func.lv3 || '').replace(/\s*한다\.?$/, '').replace(/\s*합니다\.?$/, '').trim() || func.lv3,
  }));
  let finalFunctions = normalized;
  if (new Set(normalized.map(func => func.lv1)).size > 10) {
    const rules = [
      { pattern: /보안|인증|접근제어|감사/, target: '보안관리' },
      { pattern: /운영|모니터링|장애|알람|알림/, target: '운영관리' },
      { pattern: /통계|분석|현황|보고/, target: '통계및분석' },
    ];
    finalFunctions = normalized.map(func => {
      const rule = rules.find(item => item.pattern.test(func.lv1) && func.lv1 !== item.target);
      return rule ? { ...func, lv1: rule.target } : func;
    });
  }
  finalFunctions = crossLv1Dedup(finalFunctions);
  const toBeResult = applyToBeFunctionRules(finalFunctions, info);
  finalFunctions = toBeResult.functions;
  if (existingFunctions?.length && classifyReuse) {
    finalFunctions = classifyReuse(finalFunctions, existingFunctions);
    const summary = summarizeReuse ? summarizeReuse(finalFunctions) : {};
    report(4, `완료! 신규 ${summary.신규개발 || 0} / 변경 ${summary.기능변경 || 0} / 재사용 ${summary.재사용 || 0}`, 100);
  } else {
    report(4, `완료! ${finalFunctions.length}개 기능 생성`, 100);
  }
  const result = {
    systemName,
    overview: info?.overview || '',
    functions: finalFunctions,
  };
  if (toBeResult.excluded.length) result.excluded = toBeResult.excluded;
  if (toBeResult.mergedLv1Count) result.mergedLv1Count = toBeResult.mergedLv1Count;
  return result;
};

const mergeGeneratedFunctions = (generated, existingFunctions, upgradeMode, idBase = Date.now()) => {
  const created = (generated || []).map((func, index) => ({ ...func, id: idBase + index }));
  if (!upgradeMode || !existingFunctions?.length) return created;
  const keys = new Set(existingFunctions.map(func => `${func.lv1}|${func.lv2}|${func.lv3}`));
  return [...existingFunctions, ...created.filter(func => !keys.has(`${func.lv1}|${func.lv2}|${func.lv3}`))];
};

const applyFPClassifications = (functions, classifiedMap, deriveFPRow, reuseNew) =>
  (functions || []).map((func, index) => {
    const derived = deriveFPRow(func, classifiedMap?.[index]);
    return {
      idx: index,
      lv1: func.lv1,
      lv2: func.lv2,
      lv3: func.lv3,
      definition: func.definition,
      fpType: derived.fpType,
      ftr: derived.ftr,
      det: derived.det,
      reuseType: reuseNew,
      classified: derived.classified,
      bigo: derived.classified ? derived.fpBasis : `분류폴백 | ${derived.fpBasis}`,
    };
  });

const normalizeDataGroups = (parsed, deriveDataFunctionMetrics) => ({
  ilf: (parsed?.ilf || []).filter(group => group.name).map(group => ({
    name: String(group.name).trim(),
    ...deriveDataFunctionMetrics(group),
    relatedLv2: Array.isArray(group.relatedLv2) ? group.relatedLv2 : [],
  })),
  eif: (parsed?.eif || []).filter(group => group.name && group.source).map(group => ({
    name: String(group.name).trim(),
    ...deriveDataFunctionMetrics(group),
    source: String(group.source).slice(0, 120),
  })),
});

const assembleFPList = ({
  transactionRows,
  previousRows = [],
  dataGroups = { ilf: [], eif: [] },
  functions = [],
  fpMethod,
  upgradeMode,
  rfpText = '',
  autoCalcRow,
  isDataFunction,
  mergeRecalculatedFPRows,
  reuseTypes,
  idBase = Date.now(),
}) => {
  const existingDataRows = previousRows.filter(isDataFunction);
  const keepExistingDataRows = existingDataRows.length > 0;
  const withIds = transactionRows.map((row, index) => {
    const original = functions.find(func => func.lv1 === row.lv1 && func.lv2 === row.lv2 && func.lv3 === row.lv3);
    const reuseType = upgradeMode && original?.reuseType && original.reuseType !== reuseTypes.NEW
      ? original.reuseType
      : (row.reuseType || reuseTypes.NEW);
    return autoCalcRow({ ...row, id: idBase + index, ftrChange: 0, detChange: 0, bigo: row.bigo || '-', reuseType }, fpMethod);
  });
  let result = keepExistingDataRows ? mergeRecalculatedFPRows(withIds, existingDataRows) : withIds;
  if (!keepExistingDataRows) {
    const ilfRows = dataGroups.ilf.length > 0
      ? dataGroups.ilf.map((group, index) => autoCalcRow({
        id: idBase + 100000 + index, lv1: '데이터기능', lv2: group.relatedLv2?.[0] || '공통',
        lv3: `${group.name} (ILF)`, definition: `${group.name} 데이터그룹을 관리한다`, fpType: 'ILF',
        ftr: group.ret, det: group.det, calculationPending: group.calculationPending, needsReview: group.needsReview,
        reuseType: upgradeMode ? reuseTypes.REUSED : reuseTypes.NEW, ftrChange: 0, detChange: 0,
        bigo: `${group.metricBasis} | 관련: ${(group.relatedLv2 || []).slice(0, 4).join(', ') || '-'}`,
      }, fpMethod))
      : [...new Set(withIds.map(row => `${row.lv1}||${row.lv2}`))].map((key, index) => {
        const [lv1, lv2] = key.split('||');
        return autoCalcRow({
          id: idBase + 100000 + index, lv1, lv2, lv3: `${lv2} (ILF)`, definition: `${lv2} 데이터를 관리한다`,
          fpType: 'ILF', ftr: 1, det: 10, calculationPending: true, needsReview: true,
          reuseType: upgradeMode ? reuseTypes.REUSED : reuseTypes.NEW, ftrChange: 0, detChange: 0,
          bigo: 'ILF자동배정(메뉴단위-검토필요)',
        }, fpMethod);
      });
    result = [...withIds, ...ilfRows];
  }
  if (!result.some(row => row.fpType === 'EIF')) {
    let eifRows = dataGroups.eif.slice(0, 8).map((group, index) => autoCalcRow({
      id: idBase + 200000 + index, lv1: '연동관리', lv2: group.name, lv3: `${group.name} (EIF)`,
      definition: `외부에서 참조하는 ${group.name} 데이터`, fpType: 'EIF', ftr: group.ret, det: group.det,
      calculationPending: group.calculationPending, needsReview: group.needsReview, reuseType: reuseTypes.NEW,
      ftrChange: 0, detChange: 0, bigo: `${group.metricBasis} | EIF 근거: ${group.source}`,
    }, fpMethod));
    if (!eifRows.length && rfpText) {
      const systems = [];
      rfpText.split('\n').forEach(line => {
        const first = line.match(/연동\s*대상\s*[:：]\s*(.{2,20})/);
        const second = line.match(/([가-힣]{2,10}(?:체계|시스템|서버))\s*(?:와|과|및)\s*연동/);
        [first?.[1], second?.[1]].filter(Boolean).forEach(value => {
          const name = value.trim();
          if (name && !systems.includes(name)) systems.push(name);
        });
      });
      eifRows = systems.slice(0, 5).map((name, index) => autoCalcRow({
        id: idBase + 200000 + index, lv1: '연동관리', lv2: name, lv3: `${name} (EIF)`,
        definition: `${name}에서 참조하는 외부 연계 데이터`, fpType: 'EIF', ftr: 1, det: 5,
        calculationPending: true, needsReview: true, reuseType: reuseTypes.NEW,
        ftrChange: 0, detChange: 0, bigo: 'EIF자동배정(정규식-검토필요)',
      }, fpMethod));
    }
    if (eifRows.length) result = [...result, ...eifRows];
  }
  return { fpList: result, keepExistingDataRows };
};

module.exports = {
  applyFPClassifications,
  assembleFPList,
  crossLv1Dedup,
  finalizeDomainFunctions,
  mergeGeneratedFunctions,
  normalizeDataGroups,
  parseModelJSON,
};
