import { useCallback, useEffect, useRef, useState } from 'react';
import { confirmJob, getActiveJob, getJob, resumeJob, startJob } from '../utils/jobApi';

const ACTIVE = new Set(['queued', 'running', 'awaiting_confirmation', 'paused_quota']);

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
}) => {
  const [job, setJob] = useState(null);
  const [restoring, setRestoring] = useState(true);
  const [resuming, setResuming] = useState(false);
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

  useEffect(() => {
    let cancelled = false;
    setRestoring(true);
    getActiveJob(project.id)
      .then(async active => {
        if (cancelled) return;
        await applyJob(active);
        const stale = active.status === 'running' && Date.now() - new Date(active.updated_at).getTime() >= 120000;
        if (stale) {
          setResuming(true);
          await resumeJob(active.id);
        }
      })
      .catch(error => { if (error.status !== 404) console.warn('작업 상태 복원 실패:', error.message); })
      .finally(() => { if (!cancelled) { setRestoring(false); setResuming(false); } });
    return () => { cancelled = true; };
  }, [project.id, applyJob]);

  useEffect(() => {
    if (!job?.id || !ACTIVE.has(job.status) || job.status === 'awaiting_confirmation' || job.status === 'paused_quota') return undefined;
    const timer = setInterval(() => {
      getJob(job.id).then(applyJob).catch(error => console.warn('작업 상태 조회 실패:', error.message));
    }, 3000);
    return () => clearInterval(timer);
  }, [job?.id, job?.status, applyJob]);

  const handleGenerate = async () => {
    if (!rfpText && !userInput.trim()) return alert('파일을 업로드하거나 시스템 설명을 입력해주세요.');
    if (job && ACTIVE.has(job.status)) return alert('이미 진행 중인 서버 작업이 있습니다.');
    try {
      const started = await startJob(project.id, 'domains', {
        rfpText,
        userInput,
        targetFuncCount: projectScale ? Number(projectScale) : 0,
        existingLv1s: upgradeMode ? [...new Set(functions.map(func => func.lv1))] : [],
      });
      await applyJob({ id: started.jobId, project_id: project.id, type: 'domains', status: 'running', step: 0, total_steps: null, state: {} });
    } catch (error) {
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
    if (job && ACTIVE.has(job.status)) return alert('이미 진행 중인 서버 작업이 있습니다.');
    if (fpList.length && !window.confirm(`기존 FP ${fpList.length}개를 재산정할까요?`)) return;
    try {
      const started = await startJob(project.id, 'fp', { functions, fpList, fpMethod, upgradeMode, rfpText });
      await applyJob({ id: started.jobId, project_id: project.id, type: 'fp', status: 'running', step: 0, total_steps: Math.ceil(functions.length / 25) + 2, state: {} });
    } catch (error) {
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
    progress: job?.total_steps ? Math.round(((job.step || 0) / job.total_steps) * 100) : 0,
    handleGenerate,
    handleConfirmDomains,
    handleGenerateFP,
    handleResume,
  };
};
