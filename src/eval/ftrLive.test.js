/**
 * @jest-environment node
 */
// 국세청 RFP 실측 재산정 리포트 (실제 API 비용 발생 — FTR_LIVE=1 일 때만 실행).
//   node scripts/ftr-live-extract.mjs
//   FTR_LIVE=1 CI=true npx react-scripts test --watchAll=false src/eval/ftrLive.test.js
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
const { buildInitialState, buildFunctionsState, defaultExecuteStep } = require('../../api/jobsCore.cjs');
const { buildFtrReport, formatFtrReport } = require('../utils/shared/ftrReport');
const { getComplexity, calcTotalFP } = require('../utils/fpCalculator');
const { validateDistribution } = require('../utils/fpValidation');

const live = process.env.FTR_LIVE === '1';
const run = live ? test : test.skip;
const ROOT = path.join(__dirname, '..', '..');

const loadKey = () => {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  return (env.match(/^ANTHROPIC_API_KEY\s*=\s*(.+)$/m) || [])[1]?.trim().replace(/^["']|["']$/g, '');
};

const callModel = async (prompt, maxTokens) => {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': loadKey(), 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: maxTokens, temperature: 0, messages: [{ role: 'user', content: prompt }] }),
    });
    const body = await response.json();
    if (response.ok) return body.content.filter(item => item.type === 'text').map(item => item.text).join('');
    if (attempt === 3) throw new Error(body?.error?.message || `API ${response.status}`);
    await new Promise(resolve => setTimeout(resolve, attempt * 2000));
  }
  return '';
};

const runSteps = async (state) => {
  let current = state;
  for (let step = 0; step < current.steps.length; step += 1) {
    current = await defaultExecuteStep({ step, state: current }, current.steps[step], callModel);
  }
  return current;
};

run('국세청 RFP 재산정 FTR/복잡도 리포트', async () => {
  const rfpText = fs.readFileSync(path.join(ROOT, 'eval', 'out', 'nts_rfp.txt'), 'utf8');
  const domainState = await runSteps(buildInitialState('domains', { rfpText }));
  const domains = domainState.domains.filter(domain => domain.enabled !== false);
  const functionsState = await runSteps(buildFunctionsState({ state: domainState }, { domains }, {}));
  const functions = functionsState.finalFunctions;
  const fpState = await runSteps({ ...buildInitialState('fp', { functions, fpMethod: 'standard', rfpText, systemName: domainState.info?.systemName }, {}) });
  const fpList = fpState.finalFpList;

  const report = buildFtrReport(fpList, getComplexity);
  const ilf = fpList.filter(row => row.fpType === 'ILF');
  const eif = fpList.filter(row => row.fpType === 'EIF');
  const standard = calcTotalFP(fpList, 'standard');
  const simple = calcTotalFP(fpList, 'simple');
  const total = value => Number(value.newDev) + Number(value.changed);
  const summary = {
    functions: functions.length,
    report,
    lowRatio: report.complexity.low.pct,
    ftrGe2Pct: Math.round((report.ftr['2'].pct + report.ftr['3+'].pct) * 10) / 10,
    ilfCount: ilf.length,
    ilfAvgDet: ilf.length ? Math.round((ilf.reduce((sum, row) => sum + Number(row.det || 0), 0) / ilf.length) * 10) / 10 : 0,
    eifCount: eif.length,
    eifHaveSource: eif.every(row => /EIF 근거/.test(String(row.bigo || ''))),
    standard: total(standard),
    simple: total(simple),
    standardOverSimple: total(simple) ? Math.round((total(standard) / total(simple)) * 100) / 100 : null,
    distributionIssues: validateDistribution(fpList).map(issue => issue.message),
  };
  fs.mkdirSync(path.join(ROOT, 'eval', 'out'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'eval', 'out', 'ftr-report.json'), JSON.stringify({ summary, fpList }, null, 2));
  console.log(`\n${formatFtrReport(report)}\n${JSON.stringify({ ...summary, report: undefined }, null, 2)}`);
}, 3600000);
