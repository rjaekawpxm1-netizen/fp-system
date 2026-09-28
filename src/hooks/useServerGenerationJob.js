import { useCallback, useEffect, useRef, useState } from 'react';
import { cancelJob, confirmJob, getActiveJob, getJob, resumeJob, startJob } from '../utils/jobApi';

const ACTIVE = new Set(['queued', 'running', 'awaiting_confirmation', 'paused_quota']);
const RESTORE_RETRY_MS = 5000;
const RESTORE_RETRIES = 3;
const POLL_INTERVALS = { queued: 3000, running: 3000, paused_quota: 30000, failed: 30000 };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export const formatJobStep = (step, steps = []) => {
  if (!step) return '완료 처리 중';
  const sameKind = steps.filter(candidate => candidate.kind === step.kind);
  const absoluteIndex = steps.indexOf(step);
  const kindIndex = steps.slice(0, absoluteIndex + 1).filter(candidate => candidate.kind === step.kind).length;
  if (step.kind === 'project_info') return '문서에서 시스템 정보 추출';
  if (step.kind === 'requirements') return `요구사항 수집 (청크 ${kindIndex}/${sameKind.length})`;
  if (step.kind === 'domain_classify') return '업무 도메인(LV1) 분류';
  if (step.kind === 'domain_expand') return `'${step.domain?.lv1 || step.label || '도메인'}' 기능 확장`;
  if (step.kind === 'data_groups') return '데이터 기능(ILF/EIF) 도출';
  if (step.kind === 'fp_classify') return `FP 유형 분류 (묶음 ${kindIndex}/${sameKind.length})`;
  if (step.kind === 'functions_finalize') return '기능목록 최종 정리 및 저장';
  if (step.kind === 'fp_finalize') return 'FP 산정 결과 최종 저장';
  return step.label || step.kind || '처리 중';
};

const JOB_TITLES = {
  domains: 'AI 기능목록 생성 1/2 (도메인 분석)',
  functions: 'AI 기능목록 생성 2/2 (기능 확장)',
  fp: 'FP 산정',
};

const formatClock = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

export const getStartButtonState = ({ jobLocked, starting, progress, idleLabel }) => ({
  disabled: Boolean(jobLocked || starting),
  label: jobLocked ? `진행 중… (${progress}%)` : starting ? '시작 중…' : idleLabel,
});

export const getJobDocumentTitle = (status, progress, fallback = 'fp-system') => {
  if (status === 'running') return `(${progress}%) fp-system`;
  if (status === 'completed') return '✅ 완료 - fp-system';
  return fallback;
};

export const useServerGenerationJob = ({
  project,
  rfpText,
  userInput,
  projectScale,
  upgradeMode,
  functions,
  fpList,
  fpMethod,
  setPendingDomains,
  setPendingInfo,
  setDomainStep,
  setTab,
  reloadProjects,
  refreshCompletedProject,
  onServerJobActivityChange,
  restoreDelay = wait,
}) => {
  const [job, setJob] = useState(null);
  const [restoring, setRestoring] = useState(true);
  const [resuming, setResuming] = useState(false);
  const [jobNotice, setJobNotice] = useState('');
  const [recentLogs, setRecentLogs] = useState([]);
  const [completionSync, setCompletionSync] = useState(null);
  const [clock, setClock] = useState(Date.now());
  const [starting, setStarting] = useState(false);
  const completedRef = useRef(null);
  const startingRef = useRef(false);
  const observedStepRef = useRef({ id: null, step: 0 });
  const cancelHideTimerRef = useRef(null);
  const titleTimerRef = useRef(null);
  const completionTimerRef = useRef(null);
  const originalTitleRef = useRef(document.title);
  const restoreDelayRef = useRef(restoreDelay);
  restoreDelayRef.current = restoreDelay;

  const dismissCompletedJob = useCallback(jobId => {
    clearTimeout(completionTimerRef.current);
    completionTimerRef.current = setTimeout(() => {
      setJob(current => current?.id === jobId ? null : current);
      setCompletionSync(null);
    }, 5000);
  }, []);

  const syncCompletedResult = useCallback(async completedJob => {
    setCompletionSync({ status: 'loading' });
    try {
      const refreshed = await refreshCompletedProject?.(completedJob.type);
      if (!refreshed) throw new Error('Project refresh is unavailable');
      const count = completedJob.type === 'fp'
        ? (refreshed.fpList || []).length
        : (refreshed.functions || []).length;
      const label = completedJob.type === 'fp' ? 'FP 항목' : '기능';
      setCompletionSync({ status: 'success', message: `✅ 완료: ${label} ${count}개로 반영했습니다.` });
      dismissCompletedJob(completedJob.id);
      return refreshed;
    } catch (error) {
      setCompletionSync({ status: 'error', message: '결과 불러오기 실패' });
      return null;
    }
  }, [dismissCompletedJob, refreshCompletedProject]);

  const applyJob = useCallback(async nextJob => {
    onServerJobActivityChange?.(nextJob?.project_id || project.id, ACTIVE.has(nextJob?.status));
    setJob(nextJob);
    const steps = nextJob?.state?.steps || [];
    const completedStep = Math.max(0, Math.min(Number(nextJob?.step) || 0, steps.length));
    const observed = observedStepRef.current;
    if (nextJob?.id !== observed.id || completedStep < observed.step) {
      setRecentLogs(steps.slice(0, completedStep).map(step => formatJobStep(step, steps)).slice(-5));
    } else if (completedStep > observed.step) {
      const added = steps.slice(observed.step, completedStep).map(step => formatJobStep(step, steps));
      setRecentLogs(current => [...current, ...added].slice(-5));
    }
    observedStepRef.current = { id: nextJob?.id || null, step: completedStep };
    if (nextJob?.status === 'awaiting_confirmation' && nextJob.type === 'domains') {
      const domains = (nextJob.state?.domains || []).map(domain => ({ ...domain, enabled: domain.enabled !== false }));
      setPendingDomains(domains);
      setPendingInfo({ ...(nextJob.state?.info || {}), allReqs: nextJob.state?.allReqs || [], userInput: nextJob.state?.userInput || '', rfpText });
      setDomainStep(true);
      setTab('setup');
    }
    if (nextJob?.status === 'completed' && completedRef.current !== nextJob.id) {
      completedRef.current = nextJob.id;
      const refreshed = await syncCompletedResult(nextJob);
      if (refreshed) {
        await reloadProjects?.();
        setDomainStep(false);
        setPendingDomains([]);
        setPendingInfo(null);
        setTab(nextJob.type === 'fp' ? 'fp' : 'functions');
      }
    }
  }, [onServerJobActivityChange, project.id, reloadProjects, rfpText, setDomainStep, setPendingDomains, setPendingInfo, setTab, syncCompletedResult]);

  useEffect(() => {
    if (!job?.id) return undefined;
    setClock(Date.now());
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [job?.id]);

  useEffect(() => () => clearTimeout(cancelHideTimerRef.current), []);

  const reconnectConflict = async (error, requestedType) => {
    if (error.status !== 409 || !error.jobId) return false;
    const active = await getJob(error.jobId);
    await applyJob(active);
    setJobNotice(active.type !== requestedType
      ? requestedType === 'fp'
        ? '진행 중인 기능 생성 작업이 끝난 뒤 FP 산정을 시작할 수 있습니다.'
        : '진행 중인 FP 산정 작업이 끝난 뒤 기능 생성을 시작할 수 있습니다.'
      : '이미 진행 중인 작업에 다시 연결했습니다.');
    return true;
  };

  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      setRestoring(true);
      for (let attempt = 0; attempt <= RESTORE_RETRIES && !cancelled; attempt += 1) {
        try {
          const active = await getActiveJob(project.id);
          if (cancelled) return;
          await applyJob(active);
          const stale = active.status === 'running' && Date.now() - new Date(active.updated_at).getTime() >= 120000;
          if (stale) {
            setResuming(true);
            await resumeJob(active.id);
          }
          return;
        } catch (error) {
          if (error.status === 404 || attempt === RESTORE_RETRIES) {
            if (error.status !== 404) console.warn('작업 상태 복원 실패:', error.message);
            return;
          }
          await restoreDelayRef.current(RESTORE_RETRY_MS);
        }
      }
    };
    restore().finally(() => { if (!cancelled) { setRestoring(false); setResuming(false); } });
    return () => { cancelled = true; };
  }, [project.id, applyJob, restoreDelayRef]);

  useEffect(() => {
    const interval = job?.id ? POLL_INTERVALS[job.status] : null;
    if (!interval) return undefined;
    const timer = setInterval(() => {
      getJob(job.id).then(applyJob).catch(error => console.warn('작업 상태 조회 실패:', error.message));
    }, interval);
    return () => clearInterval(timer);
  }, [job?.id, job?.status, applyJob]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      const request = job?.id ? getJob(job.id) : getActiveJob(project.id);
      request.then(applyJob).catch(error => {
        if (error.status !== 404) console.warn('탭 복귀 작업 조회 실패:', error.message);
      });
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [job?.id, project.id, applyJob]);

  const handleGenerate = async () => {
    if (!rfpText && !userInput.trim()) return alert('파일을 업로드하거나 시스템 설명을 입력해주세요.');
    if (startingRef.current) return;
    if (job && ACTIVE.has(job.status)) {
      if (job.type === 'fp') setJobNotice('진행 중인 FP 산정 작업이 끝난 뒤 기능 생성을 시작할 수 있습니다.');
      return;
    }
    startingRef.current = true;
    setStarting(true);
    try {
      const started = await startJob(project.id, 'domains', {
        rfpText,
        userInput,
        targetFuncCount: projectScale ? Number(projectScale) : 0,
        existingLv1s: upgradeMode ? [...new Set(functions.map(func => func.lv1))] : [],
      });
      const now = new Date().toISOString();
      await applyJob({ id: started.jobId, project_id: project.id, type: 'domains', status: 'running', step: 0, total_steps: null, state: {}, created_at: now, updated_at: now });
    } catch (error) {
      if (await reconnectConflict(error, 'domains')) return;
      alert('기능 생성 작업 시작 오류: ' + error.message);
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  };

  const handleConfirmDomains = async pendingDomains => {
    const domains = pendingDomains.filter(domain => domain.enabled);
    if (!domains.length) return alert('최소 1개 이상의 LV1을 선택하세요.');
    try {
      const next = await confirmJob(job.id, { domains, upgradeMode, existingFunctions: upgradeMode ? functions : [] });
      setDomainStep(false);
      const now = new Date().toISOString();
      await applyJob({ id: next.jobId, project_id: project.id, type: 'functions', status: 'running', step: 0, total_steps: domains.length + 1, state: {}, created_at: now, updated_at: now });
    } catch (error) {
      alert('기능 생성 확인 오류: ' + error.message);
    }
  };

  const handleGenerateFP = async () => {
    if (!functions.length) return alert('기능목록을 먼저 생성하세요.');
    if (startingRef.current) return;
    if (job && ACTIVE.has(job.status)) {
      if (job.type !== 'fp') setJobNotice('진행 중인 기능 생성 작업이 끝난 뒤 FP 산정을 시작할 수 있습니다.');
      return;
    }
    if (fpList.length && !window.confirm(`기존 FP ${fpList.length}개를 재산정할까요?`)) return;
    startingRef.current = true;
    setStarting(true);
    try {
      const started = await startJob(project.id, 'fp', { functions, fpList, fpMethod, upgradeMode, rfpText });
      const now = new Date().toISOString();
      await applyJob({ id: started.jobId, project_id: project.id, type: 'fp', status: 'running', step: 0, total_steps: Math.ceil(functions.length / 25) + 2, state: {}, created_at: now, updated_at: now });
    } catch (error) {
      if (await reconnectConflict(error, 'fp')) return;
      alert('FP 산정 작업 시작 오류: ' + error.message);
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  };

  const handleResume = async () => {
    if (!job?.id) return;
    setResuming(true);
    try {
      await resumeJob(job.id);
      await applyJob(await getJob(job.id));
    } catch (error) {
      alert('작업 재개 오류: ' + error.message);
    } finally { setResuming(false); }
  };

  const handleCancel = async () => {
    if (!job?.id || job.status !== 'running') return;
    if (!window.confirm('진행 중인 서버 작업을 취소할까요?')) return;
    try {
      await cancelJob(job.id);
      const cancelledId = job.id;
      setJob(current => current?.id === cancelledId ? { ...current, status: 'cancelled', updated_at: new Date().toISOString() } : current);
      clearTimeout(cancelHideTimerRef.current);
      cancelHideTimerRef.current = setTimeout(() => {
        setJob(current => current?.id === cancelledId ? null : current);
        setJobNotice('');
        setRecentLogs([]);
      }, 3000);
    } catch (error) {
      alert('작업 취소 오류: ' + error.message);
    }
  };

  const steps = job?.state?.steps || [];
  const currentStep = steps[job?.step || 0];
  const elapsedSeconds = job?.created_at ? Math.max(0, Math.floor((clock - new Date(job.created_at).getTime()) / 1000)) : 0;
  const updatedSeconds = job?.updated_at ? Math.max(0, Math.floor((clock - new Date(job.updated_at).getTime()) / 1000)) : 0;
  const progress = job?.total_steps ? Math.round(((job.step || 0) / job.total_steps) * 100) : 0;

  useEffect(() => {
    clearTimeout(titleTimerRef.current);
    if (job?.status === 'running') {
      document.title = getJobDocumentTitle(job.status, progress, originalTitleRef.current);
    } else if (job?.status === 'completed') {
      document.title = getJobDocumentTitle(job.status, progress, originalTitleRef.current);
      titleTimerRef.current = setTimeout(() => { document.title = originalTitleRef.current; }, 5000);
    } else {
      document.title = originalTitleRef.current;
    }
    return () => clearTimeout(titleTimerRef.current);
  }, [job?.status, progress]);

  useEffect(() => () => {
    clearTimeout(titleTimerRef.current);
    clearTimeout(completionTimerRef.current);
    document.title = originalTitleRef.current;
  }, []);

  return {
    job,
    restoring,
    resuming,
    starting,
    jobLocked: Boolean(job && ACTIVE.has(job.status)),
    jobError: job?.status === 'failed' ? job.error || '서버 작업에 실패했습니다.' : '',
    canRetry: job?.status === 'failed',
    jobNotice,
    progress,
    jobTitle: JOB_TITLES[job?.type] || '서버 작업',
    currentStepLabel: formatJobStep(currentStep, steps),
    elapsed: formatClock(elapsedSeconds),
    updatedSeconds,
    delayed: job?.status === 'running' && updatedSeconds > 120,
    recentLogs,
    completionSync,
    handleGenerate,
    handleConfirmDomains,
    handleGenerateFP,
    handleResume,
    handleCancel,
    retryCompletedResult: () => job?.status === 'completed' ? syncCompletedResult(job) : Promise.resolve(null),
  };
};
