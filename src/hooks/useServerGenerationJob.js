import { useCallback, useEffect, useRef, useState } from 'react';
import { confirmJob, getActiveJob, getJob, resumeJob, startJob } from '../utils/jobApi';

const ACTIVE = new Set(['queued', 'running', 'awaiting_confirmation', 'paused_quota']);
const RESTORE_RETRY_MS = 5000;
const RESTORE_RETRIES = 3;
const POLL_INTERVALS = { queued: 3000, running: 3000, paused_quota: 30000, failed: 30000 };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

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
  restoreDelay = wait,
}) => {
  const [job, setJob] = useState(null);
  const [restoring, setRestoring] = useState(true);
  const [resuming, setResuming] = useState(false);
  const [jobNotice, setJobNotice] = useState('');
  const completedRef = useRef(null);

  const applyJob = useCallback(async nextJob => {
    setJob(nextJob);
    if (nextJob?.status === 'awaiting_confirmation' && nextJob.type === 'domains') {
      const domains = (nextJob.state?.domains || []).map(domain => ({ ...domain, enabled: domain.enabled !== false }));
      setPendingDomains(domains);
      setPendingInfo({ ...(nextJob.state?.info || {}), allReqs: nextJob.state?.allReqs || [], userInput: nextJob.state?.userInput || '', rfpText });
      setDomainStep(true);
      setTab('setup');
    }
    if (nextJob?.status === 'completed' && completedRef.current !== nextJob.id) {
      completedRef.current = nextJob.id;
      await reloadProjects?.();
      setDomainStep(false);
      setPendingDomains([]);
      setPendingInfo(null);
      setTab(nextJob.type === 'fp' ? 'fp' : 'functions');
    }
  }, [reloadProjects, rfpText, setDomainStep, setPendingDomains, setPendingInfo, setTab]);

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
          await restoreDelay(RESTORE_RETRY_MS);
        }
      }
    };
    restore().finally(() => { if (!cancelled) { setRestoring(false); setResuming(false); } });
    return () => { cancelled = true; };
  }, [project.id, applyJob, restoreDelay]);

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
    if (job && ACTIVE.has(job.status)) {
      if (job.type === 'fp') setJobNotice('진행 중인 FP 산정 작업이 끝난 뒤 기능 생성을 시작할 수 있습니다.');
      return;
    }
    try {
      const started = await startJob(project.id, 'domains', {
        rfpText,
        userInput,
        targetFuncCount: projectScale ? Number(projectScale) : 0,
        existingLv1s: upgradeMode ? [...new Set(functions.map(func => func.lv1))] : [],
      });
      await applyJob({ id: started.jobId, project_id: project.id, type: 'domains', status: 'running', step: 0, total_steps: null, state: {} });
    } catch (error) {
      if (await reconnectConflict(error, 'domains')) return;
      alert('기능 생성 작업 시작 오류: ' + error.message);
    }
  };

  const handleConfirmDomains = async pendingDomains => {
    const domains = pendingDomains.filter(domain => domain.enabled);
    if (!domains.length) return alert('최소 1개 이상의 LV1을 선택하세요.');
    try {
      const next = await confirmJob(job.id, { domains, upgradeMode, existingFunctions: upgradeMode ? functions : [] });
      setDomainStep(false);
      await applyJob({ id: next.jobId, project_id: project.id, type: 'functions', status: 'running', step: 0, total_steps: domains.length + 1, state: {} });
    } catch (error) {
      alert('기능 생성 확인 오류: ' + error.message);
    }
  };

  const handleGenerateFP = async () => {
    if (!functions.length) return alert('기능목록을 먼저 생성하세요.');
    if (job && ACTIVE.has(job.status)) {
      if (job.type !== 'fp') setJobNotice('진행 중인 기능 생성 작업이 끝난 뒤 FP 산정을 시작할 수 있습니다.');
      return;
    }
    if (fpList.length && !window.confirm(`기존 FP ${fpList.length}개를 재산정할까요?`)) return;
    try {
      const started = await startJob(project.id, 'fp', { functions, fpList, fpMethod, upgradeMode, rfpText });
      await applyJob({ id: started.jobId, project_id: project.id, type: 'fp', status: 'running', step: 0, total_steps: Math.ceil(functions.length / 25) + 2, state: {} });
    } catch (error) {
      if (await reconnectConflict(error, 'fp')) return;
      alert('FP 산정 작업 시작 오류: ' + error.message);
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

  return {
    job,
    restoring,
    resuming,
    jobLocked: Boolean(job && ACTIVE.has(job.status)),
    jobError: job?.status === 'failed' ? job.error || '서버 작업에 실패했습니다.' : '',
    canRetry: job?.status === 'failed',
    jobNotice,
    progress: job?.total_steps ? Math.round(((job.step || 0) / job.total_steps) * 100) : 0,
    handleGenerate,
    handleConfirmDomains,
    handleGenerateFP,
    handleResume,
  };
};
