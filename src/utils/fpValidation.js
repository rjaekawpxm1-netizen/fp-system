// ============================================================
// fpValidation.js — 산정 결과 자기검증
// ============================================================
// 목적: "조용히 틀린 값"을 막는 마지막 방어선.
//   ① FP 분포가 통계적으로 비정상이면 경고 (L 93.6% 같은 사고 조기 탐지)
//   ② 기능수가 예산 대비 과다/과소면 경고 (313개 vs 적정 169개 사고 방지)
//   ③ 같은 LV2 내 조회/검색/목록 계열 분리 = FP상 동일 elementary process
//      가능성 → 병합 후보 플래그 (기능수 인플레의 주범 중 하나)
// fpCalculator.js의 getComplexity를 그대로 사용한다 (계산 엔진 중복 금지).
// ============================================================
import { getComplexity } from './fpCalculator';

// ── ① FP 분포 검증 ──────────────────────────────────────────
export const validateDistribution = (fpList) => {
  const issues = [];
  if (!fpList || fpList.length === 0) return issues;

  const tx = fpList.filter(f => ['EI', 'EO', 'EQ'].includes(f.fpType));
  const ilfs = fpList.filter(f => f.fpType === 'ILF');

  // ILF 과다: ILF는 "논리 데이터 그룹" 단위. 트랜잭션 대비 25% 초과면 과다 의심
  if (tx.length > 0 && ilfs.length / tx.length > 0.25) {
    issues.push({
      severity: 'error', type: 'ILF과다',
      message: `ILF ${ilfs.length}개 = 트랜잭션 대비 ${Math.round((ilfs.length / tx.length) * 100)}%. ILF는 논리 데이터그룹 단위입니다. 메뉴(LV2)마다 1개씩 배정되었는지 확인하세요. (통상 중형 시스템 10~25개)`,
    });
  }

  // 복잡도 분포: 실측 통상치 L 50~65% / M 25~40% / H 5~15%
  if (tx.length >= 20) {
    const dist = { low: 0, medium: 0, high: 0 };
    tx.forEach(f => { dist[getComplexity(f.fpType, f.ftr, f.det)]++; });
    const pL = dist.low / tx.length;
    const pH = dist.high / tx.length;
    if (pL > 0.8) issues.push({
      severity: 'warning', type: '복잡도편향',
      message: `복잡도 L이 ${Math.round(pL * 100)}% — FTR/DET 과소추정 또는 산정 실패행(기본값) 의심. 통상 L 50~65%.`,
    });
    if (pH > 0.4) issues.push({
      severity: 'warning', type: '복잡도편향',
      message: `복잡도 H가 ${Math.round(pH * 100)}% — 과다추정 의심.`,
    });
  }

  // 기본값 도배 탐지: ftr=1, det=5 (구버전 기본값) 행이 30% 넘으면 산정 실패 의심
  const defaultRows = tx.filter(f => Number(f.ftr) === 1 && Number(f.det) === 5);
  if (tx.length >= 20 && defaultRows.length / tx.length > 0.3) {
    issues.push({
      severity: 'error', type: '산정실패의심',
      message: `FTR=1/DET=5 행이 ${defaultRows.length}개(${Math.round((defaultRows.length / tx.length) * 100)}%) — AI 산정 실패 시 기본값이 유지된 흔적일 수 있습니다. 재산정을 권장합니다.`,
    });
  }

  // 분류 폴백 행 표시
  const fallbackRows = fpList.filter(f => f.classified === false);
  if (fallbackRows.length > 0) {
    issues.push({
      severity: 'warning', type: '분류폴백',
      message: `AI 분류가 누락되어 동사 규칙으로 폴백 분류된 행 ${fallbackRows.length}개 (비고에 '분류폴백' 표시). 유형을 확인하세요.`,
    });
  }

  return issues;
};

// ── ② 기능수 적정성 (양방향) ────────────────────────────────
// 기존 UI는 "목표 미달 = 빨간색 부족"만 표시해 인플레를 유도했다.
// 초과도 동일하게 경고해야 한다 — 과다산정은 미달보다 더 위험하다(감리 반려).
export const checkFunctionCount = (actualCount, targetCount) => {
  if (!targetCount || targetCount <= 0) return null;
  const ratio = actualCount / targetCount;
  if (ratio > 1.2) return {
    verdict: 'OVER', ratio: Math.round(ratio * 100) / 100,
    message: `기능수 ${actualCount}개는 목표(${targetCount}개)의 ${Math.round(ratio * 100)}%입니다. LV3가 화면동작 수준까지 분해됐거나 도메인 간 중복이 의심됩니다. 검증 결과의 병합 후보를 확인하세요.`,
  };
  if (ratio < 0.8) return {
    verdict: 'UNDER', ratio: Math.round(ratio * 100) / 100,
    message: `기능수가 목표의 ${Math.round(ratio * 100)}%로 부족합니다.`,
  };
  return { verdict: 'OK', ratio: Math.round(ratio * 100) / 100, message: '목표 대비 적정 범위(±20%)입니다.' };
};

// ── ③ elementary process 병합 후보 ──────────────────────────
// FP에서 트랜잭션 기능 단위는 elementary process.
// "X 조회 / X 검색 / X 목록조회"는 화면상 3개 동작이어도
// 동일 FTR·동일 처리로직이면 FP상 1개다.
const MERGE_VERB_GROUPS = [
  { canonical: '조회계열', members: ['목록조회', '상세조회', '조회', '검색', '목록', '리스트', '열람', '출력'] },
  { canonical: '등록계열', members: ['등록', '추가', '생성', '작성', '입력'] },
  { canonical: '수정계열', members: ['수정', '변경', '편집', '갱신'] },
];

const norm = (s) => (s || '').replace(/\s+/g, '').replace(/(한다|하기|함)$/, '');

const verbGroupOf = (lv3) => {
  const n = norm(lv3);
  for (const g of MERGE_VERB_GROUPS) {
    const sorted = [...g.members].sort((a, b) => b.length - a.length);
    for (const m of sorted) if (n.endsWith(m)) return { group: g.canonical, verb: m };
  }
  return null;
};

export const findMergeCandidates = (functions) => {
  const candidates = [];
  const byLv2 = new Map();
  (functions || []).forEach(f => {
    const k = `${norm(f.lv1)}|${norm(f.lv2)}`;
    if (!byLv2.has(k)) byLv2.set(k, []);
    byLv2.get(k).push(f);
  });

  for (const [, group] of byLv2) {
    const byVerbGroup = new Map();
    for (const f of group) {
      const v = verbGroupOf(f.lv3);
      if (!v) continue;
      if (!byVerbGroup.has(v.group)) byVerbGroup.set(v.group, []);
      byVerbGroup.get(v.group).push({ f, verb: v.verb });
    }
    for (const [vg, items] of byVerbGroup) {
      // 목록조회+상세조회 1쌍은 공공 기능목록 관행상 허용 (검색조건 EQ + 상세 EQ)
      // → 조회계열은 3개 이상일 때만, 그 외 계열은 2개 이상이면 플래그
      const threshold = vg === '조회계열' ? 3 : 2;
      if (items.length >= threshold) {
        candidates.push({
          lv1: items[0].f.lv1, lv2: items[0].f.lv2, verbGroup: vg,
          functions: items.map(i => i.f),
          message: `"${items[0].f.lv2}" 내 ${vg} ${items.length}개 (${items.map(i => i.f.lv3).join(' / ')}) — FP상 동일 기능(elementary process)일 가능성. 처리 로직이 실제로 다른 경우에만 분리하세요.`,
        });
      }
    }
  }
  return candidates;
};

// ── 통합 진입점: 기능목록+FP목록 전체 검증 ──────────────────
export const validateAll = (functions, fpList, targetCount) => {
  const issues = [];
  const countCheck = checkFunctionCount((functions || []).length, Number(targetCount) || 0);
  if (countCheck && countCheck.verdict !== 'OK') {
    issues.push({ severity: countCheck.verdict === 'OVER' ? 'error' : 'warning', type: '기능수' + countCheck.verdict, message: countCheck.message });
  }
  findMergeCandidates(functions).forEach(c => {
    issues.push({ severity: 'warning', type: 'EP병합후보', message: c.message });
  });
  issues.push(...validateDistribution(fpList));
  return issues;
};
