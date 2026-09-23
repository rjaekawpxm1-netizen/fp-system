import { calcTotalFP, calcCostFP } from '../utils/fpCalculator';

export const useDerivedTotals = ({
  fpList,
  fpMethod,
  calcSizeCoeff,
  COST_LINK,
  costLinkIdx,
  COST_PERF,
  costPerfIdx,
  COST_ENV,
  costEnvIdx,
  COST_SEC,
  costSecIdx,
  costUnitPrice,
  costProfitRate,
  costDirectExp,
  costReverseMode,
  costTargetBudget,
}) => {
  // ── FP 요약 계산 ────────────────────────────────────────────
  const stdSummary = calcTotalFP(fpList, 'standard');
  const simpleSummary = calcTotalFP(fpList, 'simple');

  // ── 개발비 계산 ──────────────────────────────────────────────
  const costCalc = () => {
    const { totalFP: tFP } = calcCostFP(fpList, fpMethod);
    const sC = calcSizeCoeff(tFP);
    const tC = sC*COST_LINK[costLinkIdx].v*COST_PERF[costPerfIdx].v*COST_ENV[costEnvIdx].v*COST_SEC[costSecIdx].v;
    const dev = Math.round(tFP*costUnitPrice*tC);
    const tot = Math.round(dev*(1+costProfitRate/100)+Number(costDirectExp||0));
    const revFP = costReverseMode&&costTargetBudget ? Math.round((Number(costTargetBudget)-Number(costDirectExp||0))/(costUnitPrice*tC*(1+costProfitRate/100))) : 0;
    return {tFP, sC, tC, dev, tot, revFP};
  };

  return { stdSummary, simpleSummary, costCalc };
};
