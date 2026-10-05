import { generateFPList, deriveDataGroups } from '../utils/claudeApi';
import { calcTotalFP } from '../utils/fpCalculator';
import { validateAll } from '../utils/fpValidation';
import { REUSE_TYPE } from '../utils/fpConstants';
import { isDataFunction, mergeRecalculatedFPRows } from '../utils/fpList';

export const useFPCalculation = ({
  fpList,
  fpMethod,
  autoCalcRow,
  setFpList,
  saveProject,
  functions,
  setLoading,
  setLoadingMsg,
  systemName,
  rfpText,
  upgradeMode,
  setTab,
  projectScale,
}) => {
  // ── FP 행 업데이트 ───────────────────────────────────────────
  const updateFP = (id, field, value) => {
    const updated = fpList.map(f => {
      if (f.id !== id) return f;
      const newRow = field === 'calculationPending' && value === false
        ? { ...f, calculationPending: false, needsReview: false }
        : { ...f, [field]: value };
      return autoCalcRow(newRow, fpMethod);
    });
    setFpList(updated);
    const summary = calcTotalFP(updated, fpMethod);
    saveProject({fpList: updated, fpSummary: summary});
  };

  // ── FP 산정 핸들러 ───────────────────────────────────────────
  const handleGenerateFP = async () => {
    if (functions.length === 0) return alert('기능목록을 먼저 생성하세요.');
    if (fpList.length > 0 && !window.confirm(`기존 FP ${fpList.length}개를 재산정할까요?`)) return;
    const totalChunks = Math.ceil(functions.length / 25);
    setLoading(true);
    setLoadingMsg(`FP 산정 중... (0/${totalChunks})`);
    try {
      // ── 0) 데이터그룹(ILF/EIF) 도출 ──────────────────────────
      // [변경] 기존: LV2(메뉴)당 ILF 1개 자동배정 → ILF는 논리 데이터그룹
      // 단위여야 하므로 메뉴 단위 배정은 같은 엔터티를 중복 계상 (ILF 43개 사고).
      // AI가 기능 구조에서 데이터그룹을 도출하고, 그룹명을 FP 분류에도 전달해
      // FTR 근거(참조 그룹)와 ILF 명칭을 일치시킨다.
      const existingDataRows = fpList.filter(isDataFunction);
      const keepExistingDataRows = existingDataRows.length > 0;
      let dataGroups = { ilf: [], eif: [] };
      if (!keepExistingDataRows) {
        setLoadingMsg('데이터그룹(ILF/EIF) 도출 중...');
        try {
          dataGroups = await deriveDataGroups(functions, systemName, rfpText);
        } catch (e) {
          console.warn('데이터그룹 도출 실패 (메뉴 단위 폴백 사용):', e.message);
        }
      }

      // ── 1) 트랜잭션 기능 분류 + 결정론적 FTR/DET 도출 ────────
      const result = await generateFPList(
        functions,
        (cur, total) => { setLoadingMsg(`FP 산정 중... (${cur}/${total})`); },
        [...dataGroups.ilf, ...dataGroups.eif].map(g => g.name)
      );
      const withId = result.map((f,i) => {
        // 고도화 모드: 기존 기능의 reuseType 유지
        const originalFunc = functions.find(fn => fn.lv1===f.lv1 && fn.lv2===f.lv2 && fn.lv3===f.lv3);
        const reuseType = (upgradeMode && originalFunc?.reuseType && originalFunc.reuseType !== REUSE_TYPE.NEW)
          ? originalFunc.reuseType
          : (f.reuseType || REUSE_TYPE.NEW);
        return autoCalcRow({...f, id:Date.now()+i, ftrChange:0, detChange:0, bigo:f.bigo||'-', reuseType}, fpMethod);
      });

      // ── 2) ILF 행 생성 ────────────────────────────────────────
      let finalFpList = keepExistingDataRows
        ? mergeRecalculatedFPRows(withId, existingDataRows)
        : withId;
      if (!keepExistingDataRows) {
        let ilfRows = [];
        if (dataGroups.ilf.length > 0) {
          // AI 도출 데이터그룹 기반 (ftr 필드 = RET)
          ilfRows = dataGroups.ilf.map((g, i) => autoCalcRow({
            id: Date.now() + 100000 + i,
            lv1: '데이터기능',
            lv2: (g.relatedLv2 && g.relatedLv2[0]) || '공통',
            lv3: `${g.name} (ILF)`,
            definition: `${g.name} 데이터그룹을 관리한다`,
            fpType: 'ILF',
            ftr: g.ret, det: g.det,
            calculationPending: g.calculationPending,
            needsReview: g.needsReview,
            reuseType: upgradeMode ? REUSE_TYPE.REUSED : REUSE_TYPE.NEW,
            ftrChange: 0, detChange: 0,
            bigo: `${g.metricBasis} | 관련: ${(g.relatedLv2 || []).slice(0, 4).join(', ') || '-'}`,
          }, fpMethod));
        } else {
          // 폴백: 기존 LV2 단위 방식 (검토 필요 표시 — validateAll이 과다 시 경고)
          const lv2Groups = [...new Set(withId.map(f => `${f.lv1}||${f.lv2}`))];
          ilfRows = lv2Groups.map((key, i) => {
            const [lv1, lv2] = key.split('||');
            return autoCalcRow({
              id: Date.now() + 100000 + i,
              lv1, lv2,
              lv3: `${lv2} (ILF)`,
              definition: `${lv2} 데이터를 관리한다`,
              fpType: 'ILF',
              ftr: 1, det: 10,
              calculationPending: true,
              needsReview: true,
              reuseType: upgradeMode ? REUSE_TYPE.REUSED : REUSE_TYPE.NEW,
              ftrChange: 0, detChange: 0, bigo: 'ILF자동배정(메뉴단위-검토필요)',
            }, fpMethod);
          });
        }
        finalFpList = [...withId, ...ilfRows];
        setLoadingMsg(`ILF ${ilfRows.length}개 배정 완료`);
      }

      // ── 3) EIF 행 생성 ────────────────────────────────────────
      let finalFpList2 = finalFpList;
      const existingEIFs = finalFpList.filter(f => f.fpType === 'EIF');
      if (existingEIFs.length === 0) {
        let eifRows = [];
        if (dataGroups.eif.length > 0) {
          // AI 도출 (RFP 근거 문장 보유분만 — deriveDataGroups에서 필터됨)
          eifRows = dataGroups.eif.slice(0, 8).map((g, i) => autoCalcRow({
            id: Date.now() + 200000 + i,
            lv1: '연동관리', lv2: g.name,
            lv3: `${g.name} (EIF)`,
            definition: `외부에서 참조하는 ${g.name} 데이터`,
            fpType: 'EIF', ftr: g.ret, det: g.det,
            calculationPending: g.calculationPending,
            needsReview: g.needsReview,
            reuseType: REUSE_TYPE.NEW,
            ftrChange: 0, detChange: 0,
            bigo: `${g.metricBasis} | EIF 근거: ${g.source}`,
          }, fpMethod));
        } else if (rfpText) {
          // 폴백: rfpText 정규식 추출 (기존 방식)
          const extSystems = [];
          rfpText.split('\n').forEach(line => {
            const m1 = line.match(/연동\s*대상\s*[:：]\s*(.{2,20})/);
            if (m1) { const n = m1[1].trim(); if (n && !extSystems.includes(n)) extSystems.push(n); }
            const m2 = line.match(/([가-힣]{2,10}(?:체계|시스템|서버))\s*(?:와|과|및)\s*연동/);
            if (m2) { const n = m2[1].trim(); if (n && !extSystems.includes(n)) extSystems.push(n); }
          });
          eifRows = extSystems.slice(0, 5).map((sys, i) =>
            autoCalcRow({
              id: Date.now() + 200000 + i,
              lv1: '연동관리', lv2: sys,
              lv3: `${sys} (EIF)`,
              definition: `${sys}에서 참조하는 외부 연계 데이터`,
              fpType: 'EIF', ftr: 1, det: 5,
              calculationPending: true,
              needsReview: true,
              reuseType: REUSE_TYPE.NEW,
              ftrChange: 0, detChange: 0, bigo: 'EIF자동배정(정규식-검토필요)',
            }, fpMethod)
          );
        }
        if (eifRows.length > 0) finalFpList2 = [...finalFpList, ...eifRows];
      }

      setFpList(finalFpList2);
      const summary = calcTotalFP(finalFpList2, fpMethod);
      saveProject({fpList:finalFpList2, fpSummary:summary});
      setTab('fp');
      if (upgradeMode) {
        const reuseCount = finalFpList.filter(f=>f.reuseType===REUSE_TYPE.REUSED).length;
        const changeCount = finalFpList.filter(f=>f.reuseType===REUSE_TYPE.CHANGED).length;
        const newCount = finalFpList.filter(f=>f.reuseType===REUSE_TYPE.NEW).length;
        const ilfCount = finalFpList.filter(f=>f.fpType==='ILF').length;
        alert(`✅ FP 산정 완료!\n재사용: ${reuseCount}개 / 기능변경: ${changeCount}개 / 신규개발: ${newCount}개\nILF: ${ilfCount}개 자동 배정`);
      } else {
        const ilfCount = finalFpList2.filter(f=>f.fpType==='ILF').length;
        const eifCount = finalFpList2.filter(f=>f.fpType==='EIF').length;
        const fallbackCount = finalFpList2.filter(f=>f.classified===false).length;
        if (!keepExistingDataRows) {
          alert(`✅ FP 산정 완료!\n총 ${finalFpList2.length}개 (ILF ${ilfCount}개 / EIF ${eifCount}개 포함)`
            + (fallbackCount > 0 ? `\n⚠ 분류 폴백 ${fallbackCount}개 — 검증 버튼으로 확인하세요.` : ''));
        }
      }
    } catch (err) {
      alert('FP 산정 오류: ' + err.message);
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  };

  // ── FP 검증 ──────────────────────────────────────────────────
  const validateFP = () => {
    const issues = [];
    if (fpList.length === 0) return issues;
    const fullKeys = fpList.map(f=>`${f.lv1}|${f.lv2}|${f.lv3?.trim()}`);
    const dupKeys = fullKeys.filter((k,i)=>fullKeys.indexOf(k)!==i);
    [...new Set(dupKeys)].forEach(k=>{
      const name = k.split('|')[2];
      issues.push({severity:'error',type:'중복',message:`"${name}" 동일 LV1/LV2 내 중복`});
    });
    const ilfs = fpList.filter(f=>f.fpType==='ILF');
    if (ilfs.length===0) issues.push({severity:'error',type:'ILF부족',message:'ILF가 없습니다. 시스템이 관리하는 데이터 그룹을 ILF로 추가하세요.'});
    const totals = {EI:0,EO:0,EQ:0,ILF:0,EIF:0};
    fpList.forEach(f=>{if(totals[f.fpType]!==undefined) totals[f.fpType]++;});
    if (totals.EI+totals.EO+totals.EQ===0) issues.push({severity:'error',type:'기능프로세스누락',message:'EI/EO/EQ가 모두 0입니다.'});
    if (totals.EQ > 0) {
      const eqRatio = totals.EQ / fpList.length;
      if (eqRatio > 0.7) issues.push({severity:'warning',type:'EQ과다',message:`EQ 비율 ${Math.round(eqRatio*100)}%. 일부를 EI/EO로 재검토하세요.`});
    }
    fpList.forEach(f=>{
      if (f.fpType==='EI' && /조회|검색|목록|상세/.test(f.lv3)) issues.push({severity:'warning',type:'FP유형의심',message:`"${f.lv3}": 조회/검색은 EQ가 맞습니다.`,id:f.id});
      if (f.fpType==='EQ' && /등록|수정|삭제|처리|승인/.test(f.lv3)) issues.push({severity:'warning',type:'FP유형의심',message:`"${f.lv3}": 등록/수정/삭제는 EI가 맞습니다.`,id:f.id});
      if (f.fpType==='EO' && /조회|목록|상세/.test(f.lv3) && !/통계|집계|보고/.test(f.lv3)) issues.push({severity:'warning',type:'FP유형의심',message:`"${f.lv3}": 단순 조회는 EQ가 맞습니다.`,id:f.id});
    });
    // 분포 검증 + 기능수 적정성 + elementary process 병합 후보 (fpValidation.js)
    issues.push(...validateAll(functions, fpList, projectScale));
    return issues;
  };

  return { updateFP, handleGenerateFP, validateFP };
};
