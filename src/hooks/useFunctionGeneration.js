import { extractDomainsOnly, expandDomainsToFunctions, suggestAreas, expandArea } from '../utils/claudeApi';
import { REUSE_TYPE } from '../utils/fpConstants';

export const useFunctionGeneration = ({
  rfpText,
  userInput,
  upgradeMode,
  functions,
  setLoading,
  setParseStep,
  setParsePct,
  setLoadingMsg,
  projectScale,
  systemName,
  setSystemName,
  systemOverview,
  setSystemOverview,
  setPendingDomains,
  setPendingInfo,
  setDomainStep,
  pendingDomains,
  pendingInfo,
  setFunctions,
  saveProject,
  projectBudget,
  setTab,
  areaTargetCount,
  setAreaSuggestions,
  setSelectedAreas,
  areaSuggestions,
  selectedAreas,
  customAreas,
  setCustomAreas,
  setShowAreaPanel,
}) => {
  // ── 기능 생성 핸들러 ─────────────────────────────────────────
  // ── 1단계: 도메인 분류까지만 실행 ─────────────────────────
  const handleGenerate = async () => {
    if (!rfpText && !userInput.trim()) {
      return alert('파일을 업로드하거나 시스템 설명을 입력해주세요.');
    }
    // ── 모드-입력 정합성 체크 ──────────────────────────────────
    // 흔한 실수: 고도화 사업인데 "신규 구축" 모드로 두고 기존 기능목록(xlsx)을
    // 올린 경우. 이 상태로 생성하면 신규 모드라 기존 기능이 '재사용'으로 인식되지
    // 않고, 덮어쓰기로 기존 114개가 날아간다.
    if (!upgradeMode && functions.length > 0) {
      const proceed = window.confirm(
        `⚠ 현재 "신규 구축" 모드인데 이미 기능목록 ${functions.length}개가 있습니다.\n\n` +
        `• 고도화 사업이라면 → [취소] 후 상단에서 "고도화 사업"을 선택하세요.\n` +
        `  (기존 기능은 재사용/변경으로 자동 분류되고, 신규 기능만 추가됩니다)\n\n` +
        `• 신규 사업이 맞다면 → [확인]. 기존 ${functions.length}개는 새로 생성된 목록으로 덮어써집니다.`
      );
      if (!proceed) return;
    }
    setLoading(true);
    setParseStep(0);
    setParsePct(0);
    try {
      const text = rfpText || userInput;
      // 고도화 모드: 기존 기능의 LV1 목록을 도메인 추출에 전달해
      // AI가 기존 명칭("연동계획")을 새 이름("연동계획관리")으로 바꾸지 않게 한다.
      const existingLv1s = (upgradeMode && functions.length > 0)
        ? [...new Set(functions.map(f => f.lv1))]
        : [];
      // 도메인 분류까지만 실행 (기능 확장 전 멈춤)
      const result = await extractDomainsOnly(
        text, userInput,
        (step, msg, pct) => { setParseStep(step); setLoadingMsg(msg); setParsePct(pct); },
        projectScale ? Number(projectScale) : 0,  // 목표 기능수 전달
        existingLv1s
      );
      // 시스템 정보 반영
      if (result.systemName && !systemName) setSystemName(result.systemName);
      if (result.overview && !systemOverview) setSystemOverview(result.overview);
      // 도메인 확인 단계로 이동
      const requiresReview = result.analysisStatus?.infoFailed
        || result.analysisStatus?.domainFallback
        || result.analysisStatus?.requirementChunks?.failures?.length > 0;
      setPendingDomains(result.domains.map(d => ({...d, enabled: !requiresReview})));
      setPendingInfo(result);
      setDomainStep(true);
    } catch (err) {
      alert('분석 오류: ' + err.message);
    } finally {
      setLoading(false);
      setLoadingMsg('');
      setParseStep(0);
      setParsePct(0);
    }
  };

  // ── 2단계: 도메인 확인 후 기능 확장 실행 ────────────────────
  const handleConfirmDomains = async () => {
    const activeDomains = pendingDomains.filter(d => d.enabled);
    if (activeDomains.length === 0) return alert('최소 1개 이상의 LV1을 선택하세요.');
    setDomainStep(false);
    setLoading(true);
    setParseStep(4);
    setParsePct(42);
    try {
      const result = await expandDomainsToFunctions(
        activeDomains,
        pendingInfo,
        (step, msg, pct) => { setParseStep(step); setLoadingMsg(msg); setParsePct(pct); },
        upgradeMode ? functions : []   // 고도화면 기존 기능 전달 → 재사용/변경 자동 분류
      );
      const newFuncs = (result.functions||[]).map((f,i)=>({...f,id:Date.now()+i}));
      let finalFunctions;
      if (upgradeMode && functions.length > 0) {
        // classifyReuse가 부여한 reuseType(재사용/기능변경/신규) 유지.
        // 기존 기능과 완전 일치(재사용)인 항목은 기존 목록에 이미 있으므로
        // 중복 추가하지 않고, 신규/변경만 추가한다.
        const existingKeys = new Set(functions.map(f=>`${f.lv1}|${f.lv2}|${f.lv3}`));
        const onlyNew = newFuncs.filter(f=>!existingKeys.has(`${f.lv1}|${f.lv2}|${f.lv3}`));
        finalFunctions = [...functions, ...onlyNew];
        const rc = onlyNew.filter(f=>f.reuseType===REUSE_TYPE.CHANGED).length;
        const nc = onlyNew.filter(f=>f.reuseType===REUSE_TYPE.NEW).length;
        const rv = onlyNew.filter(f=>f.needsReview).length;
        setTimeout(()=>alert(`✅ 고도화 기능 생성 완료!\n추가: 신규 ${nc}개 / 변경 ${rc}개${rv>0?`\n⚠ 검토 필요 ${rv}개 (재사용/변경 여부 확인)`:''}\n총 ${finalFunctions.length}개`),100);
      } else {
        finalFunctions = newFuncs;
      }
      setFunctions(finalFunctions);
      saveProject({
        functions: finalFunctions,
        systemName: pendingInfo.systemName || systemName,
        systemOverview: pendingInfo.overview || systemOverview,
        settings: { projectBudget, projectScale },
        rfpText, userInput,
      });
      setTab('functions');
      if (!(upgradeMode && functions.length > 0)) {
        alert(`✅ 기능 생성 완료!\n총 ${finalFunctions.length}개 기능목록 생성`);
      }
    } catch (err) {
      alert('기능 생성 오류: ' + err.message);
    } finally {
      setLoading(false);
      setLoadingMsg('');
      setParseStep(0);
      setParsePct(0);
      setPendingDomains([]);
      setPendingInfo(null);
    }
  };

  // ── 영역 제안 핸들러 ─────────────────────────────────────────
  const handleSuggestAreas = async () => {
    if (functions.length === 0) return alert('먼저 기능목록을 생성해주세요.');
    const target = Number(areaTargetCount) || functions.length + 100;
    setLoading(true);
    setLoadingMsg('AI가 추가 가능한 업무 영역 분석 중...');
    try {
      const result = await suggestAreas(systemName, rfpText, functions, target, upgradeMode);
      setAreaSuggestions(result);
      setSelectedAreas([]);
    } catch (err) {
      alert('영역 제안 오류: ' + err.message);
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  };

  // ── 선택된 영역 기능 추가 생성 ──────────────────────────────
  const handleExpandAreas = async () => {
    const areasToExpand = [
      ...(areaSuggestions?.suggestions ? selectedAreas.map(i => areaSuggestions.suggestions[i]) : []),
      ...customAreas.filter(a=>a.trim()).map(a=>({
        lv1: a.trim(),
        description: `${a.trim()} 관련 기능`,
        expectedFunctions: 40,
        sampleLv2: []
      })),
    ].filter(Boolean);

    if (areasToExpand.length === 0) return alert('추가할 영역을 선택해주세요.');

    setLoading(true);
    let currentFunctions = [...functions];
    let totalAdded = 0;

    try {
      for (let i = 0; i < areasToExpand.length; i++) {
        const area = areasToExpand[i];
        setLoadingMsg(`[${i+1}/${areasToExpand.length}] "${area.lv1}" 기능 생성 중... (현재 ${currentFunctions.length}개)`);
        try {
          const newFuncs = await expandArea(area, systemName, currentFunctions);
          if (newFuncs.length > 0) {
            const idOffset = totalAdded;
            const createdAt = Date.now();
            const withId = newFuncs.map((f,j)=>({...f,id:createdAt+idOffset+j}));
            currentFunctions = [...currentFunctions, ...withId];
            totalAdded += withId.length;
            // 즉시 반영 (영역마다)
            setFunctions([...currentFunctions]);
            saveProject({functions: currentFunctions});
          }
        } catch (e) {
          console.warn(`"${area.lv1}" 실패:`, e.message);
        }
        // Tier1 Rate Limit 방지: 영역 사이 5초 대기
        // Tier2: 딜레이 없음
      }
      setAreaSuggestions(null);
      setSelectedAreas([]);
      setCustomAreas(['']);
      setShowAreaPanel(false);
      alert(`✅ ${totalAdded}개 추가 완료!\n총 ${currentFunctions.length}개 기능`);
    } catch (err) {
      alert('영역 추가 오류: ' + err.message);
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  };

  return { handleGenerate, handleConfirmDomains, handleSuggestAreas, handleExpandAreas };
};
