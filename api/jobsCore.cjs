const crypto = require('crypto');
const pipelineCore = require('../src/utils/pipelineCore.cjs');
const { deriveFPRow } = require('../src/utils/fpDerivation.cjs');
const { deriveDataFunctionMetrics } = require('../src/utils/dataFunctionDerivation.cjs');
const { REUSE_TYPE } = require('../src/utils/fpConstants.cjs');
const { isDataFunction, mergeRecalculatedFPRows } = require('../src/utils/fpList.cjs');

const ACTIVE_STATUSES = ['queued', 'running', 'awaiting_confirmation', 'paused_quota'];
const AI_STEPS = new Set(['project_info', 'requirements', 'domain_classify', 'domain_expand', 'data_groups', 'fp_classify']);
const MAX_STEP_ATTEMPTS = 3;
const TRANSIENT_ERROR = /(?:529|503|502|504|overloaded|시간\s*초과|타임아웃|timeout)/i;

const send = (res, status, body) => res.status(status).json(body);
const bearerToken = req => {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
};
const safeEqual = (left, right) => {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
const splitChunks = (text, size = 4000, overlap = 200) => {
  const value = String(text || '');
  if (!value) return [];
  const chunks = [];
  for (let start = 0; start < value.length; start += Math.max(1, size - overlap)) {
    chunks.push(value.slice(start, start + size));
    if (start + size >= value.length) break;
  }
  return chunks;
};
const extractText = response => {
  if (typeof response === 'string') return response;
  if (response?.content) return response.content.map(item => item.type === 'text' ? item.text : '').join('');
  return JSON.stringify(response || {});
};
const stepLabel = step => step?.label || step?.domain?.lv1 || step?.kind || 'unknown';
const resetSplitAttempts = (attempts = {}, splitIndex) => Object.fromEntries(
  Object.entries(attempts).flatMap(([key, value]) => {
    const index = Number(key);
    if (index === splitIndex) return [];
    return [[String(index > splitIndex ? index + 1 : index), value]];
  })
);

const prompts = {
  projectInfo: input => `다음 문서에서 시스템 정보를 JSON으로 추출하세요. {"systemName":"","systemOverview":"","mainUsers":[],"projectType":""}\n${input}`,
  requirements: (chunk, label, systemName) => `시스템 ${systemName}의 기능 요구사항을 수집하세요. JSON {"requirements":[]} 청크 ${label}\n${chunk}`,
  domains: state => `다음 요구사항을 업무 도메인으로 분류하세요. JSON {"domains":[{"lv1":"","description":"","requirements":[],"expectedLv2":[]}]}\n시스템:${state.info?.systemName || '정보시스템'}\n${state.allReqs.join('\n')}`,
  expand: (domain, state) => `"${state.info?.systemName || '정보시스템'}"의 ${domain.lv1} 기능을 JSON {"functions":[{"lv2":"","lv3":"","definition":""}]}으로 생성하세요.\nLV3는 화면에서 사용자가 수행하는 단위 프로세스를 동사로 끝내세요. AI 서비스 LV2는 다음처럼 분해합니다: <서비스> 분석 요청(실행), 결과 목록조회, 결과 상세조회, 결과 확정 또는 반려, 기준·임계값 설정, 현황·통계조회 또는 보고서 출력. 예: 이상거래 탐지 → 탐지 실행 / 탐지 결과 목록조회 / 탐지 결과 상세조회 / 탐지 결과 확정 / 탐지 기준 설정 / 탐지 현황 통계조회. 대용량·병렬·분산처리·실시간연동·백업복구·인프라·성능·보안 같은 비기능 요구는 기능으로 만들지 마세요.\n요구사항:${(domain.requirements || []).join('\n')}`,
  dataGroups: state => `기능 목록에서 ILF/EIF 데이터그룹을 JSON {"ilf":[],"eif":[]}으로 도출하세요.\n${JSON.stringify(state.functions)}`,
  fpClassify: (chunk, state) => `기능을 EI/EO/EQ로 분류하세요. 입력 순서 idx를 유지하고 JSON {"fpList":[{"idx":0,"fpType":"EI","refGroups":[]}]}만 출력하세요.\n데이터그룹:${(state.dataGroupNames || []).join(',')}\n${JSON.stringify(chunk)}`,
};

const buildInitialState = (type, input = {}, project = {}) => {
  if (type === 'domains') {
    const chunks = splitChunks(input.rfpText || input.text || '');
    return {
      input,
      steps: [
        { kind: 'project_info' },
        ...chunks.map((chunk, index) => ({ kind: 'requirements', chunk, label: index + 1 })),
        { kind: 'domain_classify' },
      ],
      results: {},
      allReqs: [],
      userInput: input.userInput || '',
    };
  }
  if (type === 'fp') {
    const functions = input.functions || project.functions || [];
    const existingRows = input.fpList || project.fpList || [];
    const keepDataRows = existingRows.some(row => ['ILF', 'EIF'].includes(row.fpType));
    const chunks = [];
    for (let index = 0; index < functions.length; index += 25) chunks.push(functions.slice(index, index + 25));
    return {
      input,
      functions,
      existingRows,
      systemName: input.systemName || project.systemName || project.name || '',
      steps: [
        ...(!keepDataRows ? [{ kind: 'data_groups' }] : []),
        ...chunks.map((chunk, index) => ({ kind: 'fp_classify', chunk, offset: index * 25 })),
        { kind: 'fp_finalize' },
      ],
      results: {},
      dataGroups: { ilf: [], eif: [] },
    };
  }
  throw Object.assign(new Error('지원하지 않는 작업 유형입니다.'), { status: 400 });
};

const buildFunctionsState = (domainJob, input = {}, project = {}) => {
  const domains = input.domains || domainJob.state?.domains || [];
  const info = { ...(domainJob.state?.info || {}), allReqs: domainJob.state?.allReqs || [], userInput: domainJob.state?.userInput || '', rfpText: domainJob.state?.input?.rfpText || '' };
  return {
    input,
    domains,
    info,
    upgradeMode: Boolean(input.upgradeMode),
    existingFunctions: input.existingFunctions || project.functions || [],
    steps: [...domains.map((domain, index) => ({ kind: 'domain_expand', domain, domainIndex: index })), { kind: 'functions_finalize' }],
    results: {},
    completed: {},
  };
};

const defaultExecuteStep = async (job, step, callModel) => {
  const state = { ...(job.state || {}), results: { ...(job.state?.results || {}) } };
  let value;
  if (step.kind === 'project_info') {
    value = pipelineCore.parseModelJSON(extractText(await callModel(prompts.projectInfo(`${state.input?.rfpText || ''}\n${state.input?.userInput || ''}`), 2000)));
    state.info = {
      systemName: value.systemName || '정보시스템',
      overview: value.systemOverview || '',
      mainUsers: value.mainUsers || ['사용자', '관리자'],
      projectType: value.projectType || 'SW개발',
    };
  } else if (step.kind === 'requirements') {
    value = pipelineCore.parseModelJSON(extractText(await callModel(prompts.requirements(step.chunk, step.label, state.info?.systemName), 3000)));
    const requirements = (value.requirements || []).filter(item => String(item || '').length > 5);
    state.allReqs = [...new Set([...(state.allReqs || []), ...requirements])].slice(0, 400);
  } else if (step.kind === 'domain_classify') {
    if (state.userInput?.trim()) state.allReqs = [...new Set([...(state.allReqs || []), ...state.userInput.split(/[\n,。、]/).map(item => item.trim()).filter(item => item.length > 4)])].slice(0, 400);
    value = pipelineCore.parseModelJSON(extractText(await callModel(prompts.domains(state), 2000)));
    state.domains = value.domains || [];
  } else if (step.kind === 'domain_expand') {
    value = pipelineCore.parseModelJSON(extractText(await callModel(prompts.expand(step.domain, state), 6000)));
    const funcs = (value.functions || []).filter(func => func.lv2 && func.lv3).map(func => ({
      lv1: step.domain.lv1,
      lv2: func.lv2,
      lv3: String(func.lv3).replace(/^[A-Z]{2,}-\d+[-\w]*:\s*/i, '').trim(),
      definition: func.definition || `${func.lv3 || func.lv2}을 처리한다`,
    }));
    state.completed = { ...(state.completed || {}), [step.domain.lv1]: funcs };
    value = funcs;
  } else if (step.kind === 'data_groups') {
    value = pipelineCore.parseModelJSON(extractText(await callModel(prompts.dataGroups(state), 3000)));
    state.dataGroups = value;
    state.dataGroupNames = pipelineCore.normalizeDataGroups(value, deriveDataFunctionMetrics).ilf.map(group => group.name);
  } else if (step.kind === 'fp_classify') {
    value = pipelineCore.parseModelJSON(extractText(await callModel(prompts.fpClassify(step.chunk, state), 4000)));
    state.classified = { ...(state.classified || {}) };
    (value.fpList || []).forEach(row => {
      state.classified[step.offset + (row.idx || 0)] = { fpType: row.fpType, refGroups: row.refGroups || [] };
    });
  } else if (step.kind === 'functions_finalize') {
    const raw = Object.values(state.completed || {}).flat();
    const finalized = pipelineCore.finalizeDomainFunctions(raw, state.info || {}, state.existingFunctions || []);
    state.finalFunctions = pipelineCore.mergeGeneratedFunctions(finalized.functions, state.existingFunctions || [], state.upgradeMode);
    state.toBeFunctionReport = {
      excluded: finalized.excluded || [],
      mergedLv1Count: finalized.mergedLv1Count || 0,
    };
    value = state.finalFunctions;
  } else if (step.kind === 'fp_finalize') {
    const functions = state.functions || [];
    const existingRows = state.existingRows || [];
    const keepDataRows = existingRows.some(isDataFunction);
    const transactionRows = pipelineCore.applyFPClassifications(functions, state.classified, deriveFPRow, REUSE_TYPE.NEW);
    const { fpList } = pipelineCore.assembleFPList({
      transactionRows,
      previousRows: keepDataRows ? existingRows : [],
      dataGroups: keepDataRows ? undefined : pipelineCore.normalizeDataGroups(state.dataGroups, deriveDataFunctionMetrics),
      functions,
      fpMethod: state.input?.fpMethod,
      upgradeMode: Boolean(state.input?.upgradeMode),
      rfpText: state.input?.rfpText || '',
      autoCalcRow: row => row,
      isDataFunction,
      mergeRecalculatedFPRows,
      reuseTypes: REUSE_TYPE,
    });
    state.finalFpList = fpList;
    value = state.finalFpList;
  } else {
    throw new Error(`알 수 없는 작업 스텝: ${step.kind}`);
  }
  state.results[job.step] = value;
  return state;
};

const createJobsHandler = options => {
  const { repository, authenticate, callModel, triggerNext = () => Promise.resolve(), now = () => new Date(), executeStep = defaultExecuteStep } = options;

  return async (req, res) => {
    const action = String(req.query?.action || req.body?.action || 'status');
    try {
      if (action === 'tick') {
        const secret = req.headers?.['x-worker-secret'];
        if (!safeEqual(secret, options.workerSecret)) return send(res, 401, { error: 'Invalid worker secret' });
        const jobId = req.body?.jobId || req.query?.jobId;
        const job = await repository.acquire(jobId, new Date(now().getTime() + 90000).toISOString());
        if (!job) return send(res, 202, { skipped: true });
        if (job.status === 'cancelled') return send(res, 200, { status: 'cancelled' });
        const step = job.state?.steps?.[job.step];
        if (!step) return send(res, 200, { status: job.status });

        if (AI_STEPS.has(step.kind)) {
          const allowed = await repository.consumeQuota(job.owner_id, Number(options.dailyQuota) || 200);
          if (!allowed) {
            const updated = await repository.updateIfNotCancelled(job.id, { status: 'paused_quota', lease_until: null, updated_at: now().toISOString() });
            if (!updated) return send(res, 200, { status: 'cancelled' });
            return send(res, 200, { status: 'paused_quota' });
          }
        }
        let nextState;
        try {
          nextState = await executeStep(job, step, callModel);
        } catch (error) {
          if (step.kind === 'requirements' && /시간 초과|타임아웃|timeout/i.test(error.message) && step.chunk?.length > 1200) {
            const half = Math.floor(step.chunk.length / 2);
            const replacement = [
              { ...step, chunk: step.chunk.slice(0, half), label: `${step.label}-1` },
              { ...step, chunk: step.chunk.slice(half), label: `${step.label}-2` },
            ];
            const state = {
              ...job.state,
              steps: [...job.state.steps.slice(0, job.step), ...replacement, ...job.state.steps.slice(job.step + 1)],
              stepAttempts: resetSplitAttempts(job.state?.stepAttempts, job.step),
            };
            const updated = await repository.updateIfNotCancelled(job.id, { state, total_steps: state.steps.length, status: 'running', error: null, lease_until: null, updated_at: now().toISOString() });
            if (!updated) return send(res, 200, { status: 'cancelled' });
            await triggerNext(job.id);
            return send(res, 202, { status: 'running', split: true, totalSteps: state.steps.length });
          }
          const attempts = Number(job.state?.stepAttempts?.[job.step] || 0) + 1;
          const state = {
            ...job.state,
            stepAttempts: { ...(job.state?.stepAttempts || {}), [job.step]: attempts },
          };
          const failed = attempts >= MAX_STEP_ATTEMPTS;
          const errorMessage = failed
            ? `${stepLabel(step)} ${MAX_STEP_ATTEMPTS}회 실패: ${error.message}`
            : error.message;
          const updated = await repository.updateIfNotCancelled(job.id, {
            state,
            status: failed ? 'failed' : 'running',
            error: errorMessage,
            lease_until: null,
            updated_at: now().toISOString(),
          });
          if (!updated) return send(res, 200, { status: 'cancelled' });
          if (!failed && TRANSIENT_ERROR.test(error.message)) await triggerNext(job.id);
          return send(res, 500, { error: errorMessage, retryable: !failed, status: failed ? 'failed' : 'running' });
        }
        if (nextState.stepAttempts?.[job.step] !== undefined) {
          const stepAttempts = { ...nextState.stepAttempts };
          delete stepAttempts[job.step];
          nextState = { ...nextState, stepAttempts };
        }
        const nextStep = job.step + 1;
        const complete = nextStep >= nextState.steps.length;
        let status = 'running';
        let result = null;
        if (complete && job.type === 'domains') {
          status = 'awaiting_confirmation';
          result = { domains: nextState.domains || [], systemName: nextState.info?.systemName };
        } else if (complete) {
          status = 'completed';
          if (job.type === 'functions') {
            result = { functionCount: nextState.finalFunctions?.length || 0 };
          } else if (job.type === 'fp') {
            result = { fpCount: nextState.finalFpList?.length || 0 };
          }
        }
        const updated = await repository.updateIfNotCancelled(job.id, { state: nextState, step: nextStep, status, result, error: null, lease_until: null, updated_at: now().toISOString() });
        if (!updated) return send(res, 200, { status: 'cancelled' });
        if (complete && job.type === 'functions') {
          await repository.updateProject(job.project_id, { functions: nextState.finalFunctions || [] });
        } else if (complete && job.type === 'fp') {
          await repository.updateProject(job.project_id, { fpList: nextState.finalFpList || [] });
        }
        if (status === 'running') await triggerNext(job.id);
        return send(res, 200, { status, step: nextStep, totalSteps: nextState.steps.length });
      }

      const user = await authenticate(req);
      if (!user?.id) return send(res, 401, { error: 'Authentication required' });
      if (action === 'start') {
        const { projectId, type, input = {} } = req.body || {};
        const project = await repository.getProject(projectId);
        if (!project || project.owner_id !== user.id) return send(res, 403, { error: 'Project access denied' });
        const active = await repository.findActive(projectId);
        if (active) return send(res, 409, {
          error: 'An active job already exists',
          jobId: active.id,
          status: active.status,
          type: active.type,
        });
        const state = buildInitialState(type, input, project);
        let job;
        try {
          job = await repository.insert({ project_id: projectId, owner_id: user.id, type, status: 'running', step: 0, total_steps: state.steps.length, state });
        } catch (error) {
          if (error.status !== 409 && error.code !== '23505') throw error;
          const conflictedJob = await repository.findActive(projectId);
          if (!conflictedJob) throw error;
          return send(res, 409, {
            error: 'An active job already exists',
            jobId: conflictedJob.id,
            status: conflictedJob.status,
            type: conflictedJob.type,
          });
        }
        await triggerNext(job.id);
        return send(res, 201, { jobId: job.id });
      }
      if (action === 'status') {
        const job = req.query?.jobId
          ? await repository.get(req.query.jobId)
          : await repository.findActive(req.query?.projectId);
        if (!job) return send(res, 404, { error: 'Job not found' });
        if (job.owner_id !== user.id) {
          return send(res, req.query?.projectId ? 403 : 404, {
            error: req.query?.projectId ? 'Project access denied' : 'Job not found',
          });
        }
        return send(res, 200, job);
      }
      const job = await repository.get(req.body?.jobId);
      if (!job || job.owner_id !== user.id) return send(res, 404, { error: 'Job not found' });
      if (action === 'cancel') {
        await repository.update(job.id, { status: 'cancelled', lease_until: null, updated_at: now().toISOString() });
        return send(res, 200, { status: 'cancelled' });
      }
      if (action === 'resume') {
        const stale = now().getTime() - new Date(job.updated_at).getTime() >= 120000;
        if (!['paused_quota', 'failed'].includes(job.status) && !(job.status === 'running' && stale)) return send(res, 409, { error: 'Job is not resumable' });
        const state = { ...(job.state || {}), stepAttempts: { ...(job.state?.stepAttempts || {}) } };
        delete state.stepAttempts[job.step];
        await repository.update(job.id, { state, status: 'running', lease_until: null, error: null, updated_at: now().toISOString() });
        await triggerNext(job.id);
        return send(res, 200, { status: 'running' });
      }
      if (action === 'confirm') {
        if (job.type !== 'domains' || job.status !== 'awaiting_confirmation') return send(res, 409, { error: 'Job is not awaiting confirmation' });
        const project = await repository.getProject(job.project_id);
        const state = buildFunctionsState(job, req.body?.input || {}, project || {});
        await repository.update(job.id, { status: 'completed', result: { confirmed: true }, updated_at: now().toISOString() });
        const next = await repository.insert({ project_id: job.project_id, owner_id: user.id, type: 'functions', status: 'running', step: 0, total_steps: state.steps.length, state });
        await triggerNext(next.id);
        return send(res, 201, { jobId: next.id });
      }
      return send(res, 400, { error: 'Unknown action' });
    } catch (error) {
      console.error('[jobs]', action, error.status, error.message);
      return send(res, error.status || 500, { error: error.message });
    }
  };
};

module.exports = {
  ACTIVE_STATUSES,
  MAX_STEP_ATTEMPTS,
  buildFunctionsState,
  buildInitialState,
  createJobsHandler,
  defaultExecuteStep,
  safeEqual,
  splitChunks,
};
