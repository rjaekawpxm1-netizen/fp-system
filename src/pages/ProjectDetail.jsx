import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  setClaudeProjectContext,
} from '../utils/claudeApi';
import {
  getWeight, getAvgWeight, getComplexity,
  calcTotalFP, getChangePct, getFuncChangePct, getImpactFactor,
} from '../utils/fpCalculator';
import { exportFPExcel, exportCostExcel } from '../utils/excelExport';
import { REUSE_TYPE, REUSE_TYPES } from '../utils/fpConstants';
import { validateFPRowValues } from '../utils/fpRowValidation';
import { useFileIngestion } from '../hooks/useFileIngestion';
import { useFunctionGeneration } from '../hooks/useFunctionGeneration';
import { useFPCalculation } from '../hooks/useFPCalculation';
import { useDerivedTotals } from '../hooks/useDerivedTotals';
import { useServerGenerationJob } from '../hooks/useServerGenerationJob';

// ── 상수 ──────────────────────────────────────────────────────
const FP_TYPES = ['ILF','EIF','EI','EO','EQ'];
const COMPLEXITY_COLORS = {
  low:    { bg:'#f0fdf4', color:'#16a34a', label:'L' },
  medium: { bg:'#fffbeb', color:'#d97706', label:'M' },
  high:   { bg:'#fef2f2', color:'#dc2626', label:'H' },
};

// 보정계수
const COST_LINK=[{l:'연계없음',v:0.88},{l:'1~2개',v:0.94},{l:'3~5개',v:1.00},{l:'6~10개',v:1.06},{l:'10개초과',v:1.12}];
const COST_PERF=[{l:'요구없음',v:0.91},{l:'일반',v:0.95},{l:'표준',v:1.00},{l:'중요',v:1.05},{l:'엄격',v:1.09}];
const COST_ENV=[{l:'요구없음',v:0.94},{l:'동일환경',v:1.00},{l:'유사환경',v:1.06},{l:'이질환경',v:1.13},{l:'이질+훈련',v:1.19}];
const COST_SEC=[{l:'1가지',v:0.97},{l:'2가지',v:1.00},{l:'3가지',v:1.03},{l:'4가지',v:1.06},{l:'5가지+',v:1.08}];
const calcSizeCoeff = fp => {
  const f = Number(fp);
  if (f < 500) return 1.28;
  if (f > 3000) return 1.153;
  return Math.round((0.4057 * Math.pow(Math.log(f) - 7.1978, 2) + 0.8878) * 10000) / 10000;
};

// 예산(원) → 적정 기능수 역산 — 단일 진실 공급원(SSOT)
// [통일] 기존엔 프로젝트설정(여기)과 기능목록탭이 서로 다른 공식을 써서
// 같은 예산에 다른 기능수(414 vs 473)가 나왔다. 두 경로가 이 함수를 공유한다.
// opts로 보정계수/직접비/평균FP를 받아 호출처마다 같은 식으로 계산.
const FP_UNIT_PRICE = 605784;       // SW사업 대가 FP 단가 (최신 가이드로 갱신 필요)
const DEFAULT_AVG_FP_PER_FUNC = 4;  // 기능당 평균 FP (캘리브레이션 대상 상수)

const calcTargetFuncCount = (budgetWon, opts = {}) => {
  if (!budgetWon || budgetWon <= 0) return 0;
  const {
    unitPrice = FP_UNIT_PRICE,
    profitRate = 0.1,        // 이윤율 (0.1 = 10%)
    directExp = 0,           // 직접경비(원)
    coeff = 1.0,             // 연계×성능×환경×보안 보정계수 곱
    avgFpPerFunc = DEFAULT_AVG_FP_PER_FUNC,
  } = opts;
  const profitMul = 1 + profitRate;
  const base = Number(budgetWon) - Number(directExp || 0);
  // 규모보정계수 3회 수렴
  let fp = base / (unitPrice * coeff * profitMul);
  for (let i = 0; i < 3; i++) {
    const sC = calcSizeCoeff(fp);
    fp = base / (unitPrice * sC * coeff * profitMul);
  }
  return Math.round(fp / Math.max(avgFpPerFunc, 1));
};

const autoCalcRow = (row, method) => {
  const c = getComplexity(row.fpType, row.ftr, row.det);
  const w = method === 'simple' ? getAvgWeight(row.fpType) : getWeight(row.fpType, row.ftr, row.det);
  const ftrPct = getChangePct(row.ftrChange || 0, row.ftr);
  const detPct = getChangePct(row.detChange || 0, row.det);
  const funcPct = getFuncChangePct(ftrPct, detPct, row.fpType);
  const impact = getImpactFactor(funcPct);
  const fpPoint = row.reuseType === REUSE_TYPE.CHANGED ? Math.round(w * impact * 100) / 100 : w;
  return { ...row, complexity: c, weight: w, funcChangePct: funcPct, impactFactor: impact, fpPoint };
};

// ── 스타일 ────────────────────────────────────────────────────
const S = {
  wrap: { display:'flex', minHeight:'100vh', background:'#f0f4ff', fontFamily:"'Pretendard',-apple-system,'Malgun Gothic',sans-serif" },
  sidebar: { width:200, background:'#1e3a8a', display:'flex', flexDirection:'column', flexShrink:0, position:'sticky', top:0, height:'100vh' },
  sidebarLogo: { padding:'20px 16px', borderBottom:'1px solid rgba(255,255,255,0.1)' },
  navItem: (active) => ({ display:'flex', alignItems:'center', gap:8, padding:'10px 16px', cursor:'pointer', background: active?'rgba(255,255,255,0.15)':'transparent', color:'#fff', fontSize:13, fontWeight: active?700:400, borderLeft: active?'3px solid #60a5fa':'3px solid transparent' }),
  main: { flex:1, display:'flex', flexDirection:'column', overflow:'auto' },
  topbar: { background:'#1e3a8a', padding:'0 24px', display:'flex', alignItems:'center', justifyContent:'space-between', height:52, flexShrink:0 },
  content: { flex:1, padding:'20px 24px' },
  card: { background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', overflow:'hidden', marginBottom:16 },
  cardHeader: { padding:'14px 20px', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', justifyContent:'space-between' },
  btn: (bg, color='#fff') => ({ background:bg, color, border:'none', borderRadius:7, padding:'8px 16px', fontSize:13, fontWeight:600, cursor:'pointer' }),
  btnOutline: (color='#374151') => ({ background:'#fff', color, border:`1px solid ${color}`, borderRadius:7, padding:'7px 15px', fontSize:13, fontWeight:500, cursor:'pointer' }),
  input: { padding:'8px 12px', border:'1px solid #e5e7eb', borderRadius:7, fontSize:13, width:'100%', outline:'none', boxSizing:'border-box' },
  label: { fontSize:12, fontWeight:600, color:'#374151', marginBottom:4, display:'block' },
  tag: (bg, color) => ({ background:bg, color, fontSize:10, padding:'2px 7px', borderRadius:10, fontWeight:600 }),
};

const ProjectDetail = ({ projects, onUpdateProject, onCopyProject, onReloadProjects }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const project = projects.find(p => p.id === id);
  useEffect(() => {
    setClaudeProjectContext(id);
    return () => setClaudeProjectContext('');
  }, [id]);

  // ── 탭 ──────────────────────────────────────────────────────
  const [tab, setTab] = useState('setup'); // setup | functions | fp

  // ── 프로젝트 설정 상태 ───────────────────────────────────────
  const [systemName, setSystemName] = useState(project?.systemName || '');
  const [systemOverview, setSystemOverview] = useState(project?.systemOverview || '');
  const [projectBudget, setProjectBudget] = useState(project?.settings?.projectBudget || ''); // 사업 예산
  const [projectScale, setProjectScale] = useState(project?.settings?.projectScale || ''); // 목표 기능수 (예산에서 자동계산)
  const [userInput, setUserInput] = useState(project?.userInput || '');
  const [rfpText, setRfpText] = useState(project?.rfpText || ''); // 합산 텍스트 (하위호환)
  const [uploadedFiles, setUploadedFiles] = useState(project?.uploadedFiles || []); // [{name,text,type,size}]
  const [xlsxFunctions, setXlsxFunctions] = useState(project?.xlsxFunctions || []); // xlsx에서 파싱된 기능

  // ── 기능목록 상태 ────────────────────────────────────────────
  const [functions, setFunctions] = useState(project?.functions || []);
  const [fpMethod, setFpMethod] = useState(project?.settings?.fpMethod || 'standard');

  // ── FP 산정 상태 ────────────────────────────────────────────
  const [fpList, setFpList] = useState(project?.fpList || []);
  const [showValidation, setShowValidation] = useState(false);

  // ── 개발비 상태 ──────────────────────────────────────────────
  const [showCostPanel, setShowCostPanel] = useState(false);
  const [costLinkIdx, setCostLinkIdx] = useState(project?.settings?.costLinkIdx ?? 2);
  const [costPerfIdx, setCostPerfIdx] = useState(project?.settings?.costPerfIdx ?? 2);
  const [costEnvIdx, setCostEnvIdx] = useState(project?.settings?.costEnvIdx ?? 1);
  const [costSecIdx, setCostSecIdx] = useState(project?.settings?.costSecIdx ?? 1);
  const [costUnitPrice, setCostUnitPrice] = useState(project?.settings?.costUnitPrice ?? 605784);
  const [costProfitRate, setCostProfitRate] = useState(project?.settings?.costProfitRate ?? 10);
  const [costDirectExp, setCostDirectExp] = useState(project?.settings?.costDirectExp ?? 0);
  const [costReverseMode, setCostReverseMode] = useState(project?.settings?.costReverseMode ?? false);
  const [costTargetBudget, setCostTargetBudget] = useState(project?.settings?.costTargetBudget || '');

  // ── 영역 추가 상태 ───────────────────────────────────────────
  const [showAreaPanel, setShowAreaPanel] = useState(false);
  const [areaSuggestions, setAreaSuggestions] = useState(null);
  const [selectedAreas, setSelectedAreas] = useState([]);
  // 검색/필터
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterLV1, setFilterLV1] = useState('');
  // 고도화 모드
  const [upgradeMode, setUpgradeMode] = useState(project?.settings?.upgradeMode ?? false);
  // 도메인 확인 단계
  const [domainStep, setDomainStep] = useState(false); // true=도메인확인중
  const [pendingDomains, setPendingDomains] = useState([]); // AI가 뽑은 LV1 목록
  const [pendingInfo, setPendingInfo] = useState(null); // 시스템정보 임시저장
  const [newDomainInput, setNewDomainInput] = useState(''); // LV1 직접추가
  // 일괄 선택/수정
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkLV1, setBulkLV1] = useState('');
  const [bulkReuseType, setBulkReuseType] = useState('재사용');
  // 직접입력 영역 여러개
  const [customAreas, setCustomAreas] = useState(['']);
  const [areaTargetCount, setAreaTargetCount] = useState('');

  // ── 로딩 상태 ────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [parseStep, setParseStep] = useState(0);
  const [parsePct, setParsePct] = useState(0);
  // Virtual Scroll
  const [vsStart, setVsStart] = useState(0); // 표시 시작 인덱스
  const VS_PAGE = 100; // 한 번에 표시할 행 수

  const saveProject = useCallback((updates) => {
    if (onUpdateProject) onUpdateProject(id, updates);
  }, [id, onUpdateProject]);

  const saveSettings = useCallback((settings) => {
    saveProject({ settings });
  }, [saveProject]);

  const { handleFileUpload, handleRemoveFile } = useFileIngestion({
    id,
    project,
    upgradeMode,
    setUpgradeMode,
    saveSettings,
    functions,
    setFunctions,
    saveProject,
    uploadedFiles,
    setUploadedFiles,
    xlsxFunctions,
    setXlsxFunctions,
    setTab,
    setLoading,
    setLoadingMsg,
    systemName,
    setSystemName,
    systemOverview,
    setSystemOverview,
    setRfpText,
  });

  const {
    handleRetryFailedDomains,
    handleDiscardCheckpoint,
    handleSuggestAreas,
    handleExpandAreas,
    failedDomains,
    generationCheckpoint,
  } = useFunctionGeneration({
    rfpText,
    userInput,
    upgradeMode,
    setUpgradeMode,
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
    project,
    saveSettings,
  });
  const { updateFP, validateFP } = useFPCalculation({
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
  });
  const {
    job: generationJob,
    restoring: restoringJob,
    resuming: resumingJob,
    jobLocked,
    jobError,
    canRetry: canRetryJob,
    jobNotice,
    progress: jobProgress,
    handleGenerate,
    handleConfirmDomains: confirmServerDomains,
    handleGenerateFP,
    handleResume: handleResumeJob,
  } = useServerGenerationJob({
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
    reloadProjects: onReloadProjects,
  });
  const handleConfirmDomains = () => confirmServerDomains(pendingDomains);
  const { stdSummary, simpleSummary, costCalc } = useDerivedTotals({
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
  });
  if (!project) return (
    <div style={{display:'flex',justifyContent:'center',alignItems:'center',height:'100vh',flexDirection:'column',gap:16}}>
      <p style={{fontSize:15,color:'#374151'}}>프로젝트를 찾을 수 없습니다.</p>
      <button onClick={()=>navigate('/ba')} style={S.btn('#1d4ed8')}>목록으로</button>
    </div>
  );
  const fmt = n => Math.round(n).toLocaleString();
  const fmtB = n => (n/1e8).toFixed(2)+'억원';

  // ── 렌더링 ───────────────────────────────────────────────────
  const TAB_LABELS = [
    {key:'setup', label:'📋 프로젝트 설정'},
    {key:'functions', label:`⚙️ 기능목록 ${functions.length>0?`(${functions.length})`:''}`.trim()},
    {key:'fp', label:(()=>{
      if (fpList.length === 0) return '📊 FP 산정표';
      const ilfCount = fpList.filter(f=>f.fpType==='ILF'||f.fpType==='EIF').length;
      const txCount = fpList.length - ilfCount;
      return ilfCount > 0
        ? `📊 FP 산정표 (${txCount}+ILF ${ilfCount})`
        : `📊 FP 산정표 (${fpList.length})`;
    })()},
  ];

  return (
    <div style={S.wrap}>
      {/* ── 사이드바 ── */}
      <div style={S.sidebar}>
        <div style={S.sidebarLogo}>
          <div style={{display:'flex',alignItems:'center',gap:9}}>
            <div style={{width:30,height:30,background:'#3b82f6',borderRadius:7,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:800,color:'#fff'}}>BA</div>
            <div>
              <div style={{color:'#fff',fontSize:13,fontWeight:700}}>BA 도우미</div>
              <div style={{color:'rgba(255,255,255,0.45)',fontSize:9,letterSpacing:'0.5px',textTransform:'uppercase',marginTop:1}}>CAS IT CONSULTING</div>
            </div>
          </div>
        </div>
        <div style={{padding:'12px 8px',flex:1}}>
          <div style={{fontSize:10,color:'rgba(255,255,255,0.4)',fontWeight:700,letterSpacing:'0.8px',padding:'0 8px',marginBottom:6,textTransform:'uppercase'}}>현재 프로젝트</div>
          <div style={{color:'#fff',fontSize:12,fontWeight:600,padding:'6px 8px',background:'rgba(255,255,255,0.1)',borderRadius:6,marginBottom:12}}>
            {project.name}
          </div>
          <div style={{fontSize:10,color:'rgba(255,255,255,0.4)',fontWeight:700,letterSpacing:'0.8px',padding:'0 8px',marginBottom:6,textTransform:'uppercase'}}>이동</div>
          <div style={S.navItem(false)} onClick={()=>navigate('/ba')}>
            <span>← 목록으로</span>
          </div>
          <div style={S.navItem(false)} onClick={async ()=>{
            const name = window.prompt('복사할 프로젝트 이름:', project.name + ' (복사)');
            if (!name || !name.trim()) return;
            if (!onCopyProject) return alert('복사 기능을 사용할 수 없습니다.');
            try {
              await onCopyProject(project, name.trim());
              alert(`✅ "${name.trim()}"으로 복사됐습니다.\n목록에서 확인하세요.`);
            } catch(e) {
              alert('복사 실패: ' + e.message);
            }
          }}>
            <span>📋 프로젝트 복사</span>
          </div>
          <div style={S.navItem(false)} onClick={()=>setShowCostPanel(v=>!v)}>
            <span>💰 개발비 산출</span>
          </div>
        </div>
        {fpList.length>0 && (
          <div style={{padding:'12px',borderTop:'1px solid rgba(255,255,255,0.1)'}}>
            <div style={{fontSize:9,color:'rgba(255,255,255,0.45)',fontWeight:700,letterSpacing:'0.8px',textTransform:'uppercase',marginBottom:6}}>FP 요약</div>
            {[
              ['정통법 신규', stdSummary.newDev+' FP'],
              ['정통법 변경', stdSummary.changed+' FP'],
              ['간이법 신규', simpleSummary.newDev+' FP'],
            ].map(([l,v])=>(
              <div key={l} style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                <span style={{fontSize:10,color:'rgba(255,255,255,0.6)'}}>{l}</span>
                <span style={{fontSize:10,color:'#fff',fontWeight:600}}>{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 메인 ── */}
      <div style={S.main}>
        {/* 탑바 */}
        <div style={S.topbar}>
          <div style={{color:'#fff',fontSize:13}}>
            <span style={{color:'rgba(255,255,255,0.6)'}}>프로젝트</span>
            <span style={{margin:'0 6px',color:'rgba(255,255,255,0.4)'}}>›</span>
            <span style={{fontWeight:600}}>{project.name}</span>
            {systemName && <><span style={{margin:'0 6px',color:'rgba(255,255,255,0.4)'}}>›</span><span>{systemName}</span></>}
          </div>
          <div style={{display:'flex',gap:8}}>
            {tab==='functions' && (
              <button onClick={handleGenerateFP} style={S.btn('#16a34a')}>
                AI FP 산정 →
              </button>
            )}
            {tab==='fp' && (
              <>
                <button onClick={async()=>{
                  try { await exportFPExcel(fpList, {systemName, method:'both'}, 'both'); }
                  catch(e) { alert('Excel 출력 오류: '+e.message); }
                }} style={S.btn('#16a34a')}>📥 Excel 출력</button>
                <button onClick={()=>setShowCostPanel(v=>!v)} style={S.btn(showCostPanel?'#f59e0b':'rgba(255,255,255,0.15)')}>
                  💰 개발비 산출
                </button>
              </>
            )}
          </div>
        </div>

        {/* 개발비 패널 */}
        {showCostPanel && fpList.length>0 && (() => {
          const {tFP,sC,tC,dev,tot,revFP} = costCalc();
          const inp = {padding:'5px 8px',border:'1px solid #e5e7eb',borderRadius:5,fontSize:12,width:110};
          const sel = {padding:'4px 6px',border:'1px solid #e5e7eb',borderRadius:5,fontSize:11,background:'#fff',width:'100%',marginBottom:6};
          return (
            <div style={{background:'#fff',borderBottom:'2px solid #f59e0b',padding:'16px 24px',fontSize:12}}>
              <div style={{display:'flex',gap:20,flexWrap:'wrap',alignItems:'flex-start'}}>
                <div style={{minWidth:170}}>
                  <div style={{fontSize:10,color:'#6b7280',marginBottom:3}}>산정 방법</div>
                  <div style={{display:'flex',gap:4,marginBottom:8}}>
                    {['standard','simple'].map(m=><button key={m} onClick={()=>{
                      setFpMethod(m);
                      saveSettings({ fpMethod: m });
                      const updated = fpList.map(f=>autoCalcRow(f,m));
                      setFpList(updated); saveProject({fpList:updated});
                    }} style={{padding:'4px 12px',fontSize:11,fontWeight:600,border:'1px solid '+(fpMethod===m?'#1d4ed8':'#e5e7eb'),borderRadius:5,cursor:'pointer',background:fpMethod===m?'#1d4ed8':'#fff',color:fpMethod===m?'#fff':'#374151'}}>{m==='standard'?'정통법':'간이법'}</button>)}
                  </div>
                  <div style={{fontSize:10,color:'#6b7280',marginBottom:2}}>단가(원/FP)</div>
                  <input type="number" value={costUnitPrice} onChange={e=>{const v=Number(e.target.value);setCostUnitPrice(v);saveSettings({costUnitPrice:v});}} style={{...inp,marginBottom:6}}/>
                  <div style={{fontSize:10,color:'#6b7280',marginBottom:2}}>이윤율(%)</div>
                  <input type="number" value={costProfitRate} onChange={e=>{const v=Number(e.target.value);setCostProfitRate(v);saveSettings({costProfitRate:v});}} style={{...inp,marginBottom:6}}/>
                  <div style={{fontSize:10,color:'#6b7280',marginBottom:2}}>직접경비(원)</div>
                  <input type="number" value={costDirectExp} onChange={e=>{const v=Number(e.target.value);setCostDirectExp(v);saveSettings({costDirectExp:v});}} style={inp}/>
                </div>
                <div style={{minWidth:210}}>
                  <div style={{fontSize:10,color:'#6b7280',marginBottom:2}}>연계복잡성</div><select value={costLinkIdx} onChange={e=>{const v=Number(e.target.value);setCostLinkIdx(v);saveSettings({costLinkIdx:v});}} style={sel}>{COST_LINK.map((c,i)=><option key={i} value={i}>{c.l} ({c.v})</option>)}</select>
                  <div style={{fontSize:10,color:'#6b7280',marginBottom:2}}>성능 요구수준</div><select value={costPerfIdx} onChange={e=>{const v=Number(e.target.value);setCostPerfIdx(v);saveSettings({costPerfIdx:v});}} style={sel}>{COST_PERF.map((c,i)=><option key={i} value={i}>{c.l} ({c.v})</option>)}</select>
                  <div style={{fontSize:10,color:'#6b7280',marginBottom:2}}>운영환경 호환성</div><select value={costEnvIdx} onChange={e=>{const v=Number(e.target.value);setCostEnvIdx(v);saveSettings({costEnvIdx:v});}} style={sel}>{COST_ENV.map((c,i)=><option key={i} value={i}>{c.l} ({c.v})</option>)}</select>
                  <div style={{fontSize:10,color:'#6b7280',marginBottom:2}}>보안성</div><select value={costSecIdx} onChange={e=>{const v=Number(e.target.value);setCostSecIdx(v);saveSettings({costSecIdx:v});}} style={sel}>{COST_SEC.map((c,i)=><option key={i} value={i}>{c.l} ({c.v})</option>)}</select>
                </div>
                <div style={{minWidth:190}}>
                  <div style={{background:'#eff6ff',borderRadius:8,padding:'10px 14px',textAlign:'center',marginBottom:6}}>
                    <div style={{fontSize:10,color:'#6b7280'}}>총 FP</div>
                    <div style={{fontSize:18,fontWeight:800,color:'#1d4ed8'}}>{fmt(tFP)} FP</div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5,marginBottom:6}}>
                    <div style={{background:'#f0fdf4',borderRadius:7,padding:'8px',textAlign:'center'}}><div style={{fontSize:10,color:'#6b7280'}}>규모보정</div><div style={{fontWeight:700,color:'#16a34a'}}>{sC.toFixed(4)}</div></div>
                    <div style={{background:'#faf5ff',borderRadius:7,padding:'8px',textAlign:'center'}}><div style={{fontSize:10,color:'#6b7280'}}>총보정</div><div style={{fontWeight:700,color:'#7c3aed'}}>{tC.toFixed(4)}</div></div>
                  </div>
                  <div style={{background:'#fff7ed',border:'2px solid #f59e0b',borderRadius:9,padding:'10px',textAlign:'center',marginBottom:5}}>
                    <div style={{fontSize:10,color:'#92400e'}}>개발비(보정후)</div>
                    <div style={{fontSize:15,fontWeight:800,color:'#b45309'}}>{fmtB(dev)}</div>
                    <div style={{fontSize:10,color:'#9ca3af'}}>{fmt(dev)}원</div>
                  </div>
                  <div style={{background:'#fef2f2',border:'2px solid #ef4444',borderRadius:9,padding:'10px',textAlign:'center',marginBottom:6}}>
                    <div style={{fontSize:10,color:'#991b1b'}}>총사업비</div>
                    <div style={{fontSize:17,fontWeight:800,color:'#dc2626'}}>{fmtB(tot)}</div>
                  </div>
                  <button onClick={async()=>{
                    try {
                      await exportCostExcel({
                        projectName:systemName||project.name, method:fpMethod,
                        totalFP:tFP, fpSummary:calcTotalFP(fpList, fpMethod),
                        fpUnitPrice:costUnitPrice, preCorrectionCost:Math.round(tFP*costUnitPrice),
                        sizeCoeff:sC, totalCoeff:tC, devCost:dev,
                        directCost:Number(costDirectExp||0), profit:Math.round(dev*costProfitRate/100),
                        profitRate:costProfitRate, totalDevCost:tot, totalWithVAT:Math.round(tot*1.1),
                        linkCoeff:COST_LINK[costLinkIdx].v, linkLabel:COST_LINK[costLinkIdx].l,
                        perfCoeff:COST_PERF[costPerfIdx].v, perfLabel:COST_PERF[costPerfIdx].l,
                        envCoeff:COST_ENV[costEnvIdx].v, envLabel:COST_ENV[costEnvIdx].l,
                        secCoeff:COST_SEC[costSecIdx].v, secLabel:COST_SEC[costSecIdx].l,
                      });
                    } catch(e){alert('Excel 오류: '+e.message);}
                  }} style={{...S.btn('#16a34a'),width:'100%',fontSize:12}}>📥 개발비 Excel</button>
                </div>
                <div style={{minWidth:170}}>
                  <button onClick={()=>{const v=!costReverseMode;setCostReverseMode(v);saveSettings({costReverseMode:v});}} style={{padding:'5px 12px',fontSize:11,fontWeight:600,border:'none',borderRadius:5,cursor:'pointer',background:costReverseMode?'#f59e0b':'#e5e7eb',color:costReverseMode?'#fff':'#374151',marginBottom:8}}>
                    🔄 예산역산 {costReverseMode?'ON':'OFF'}
                  </button>
                  {costReverseMode&&<>
                    <input type="number" value={costTargetBudget} onChange={e=>{setCostTargetBudget(e.target.value);saveSettings({costTargetBudget:e.target.value});}} placeholder="목표예산(원)" style={{padding:'5px 8px',border:'1px solid #e5e7eb',borderRadius:5,fontSize:12,width:'100%',marginBottom:5}}/>
                    <div style={{display:'flex',gap:3,flexWrap:'wrap',marginBottom:6}}>
                      {[[1,1e8],[2,2e8],[3,3e8],[5,5e8],[10,1e9],[20,2e9],[30,3e9],[50,5e9],[100,1e10]].map(([l,v])=>(
                        <button key={l} onClick={()=>{setCostTargetBudget(String(v));saveSettings({costTargetBudget:String(v)});}} style={{fontSize:10,padding:'2px 7px',borderRadius:8,background:'#f3f4f6',color:'#374151',border:'1px solid #e5e7eb',cursor:'pointer'}}>{l}억</button>
                      ))}
                    </div>
                    {costTargetBudget&&<div style={{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:7,padding:'9px 12px'}}>
                      <div style={{fontWeight:700,color:'#b45309',fontSize:12}}>필요 FP: {fmt(revFP)}</div>
                      <div style={{fontSize:11,color:'#6b7280',marginTop:2}}>현재 {fmt(tFP)} · {revFP>tFP?`부족 ${fmt(revFP-tFP)}`:`초과 ${fmt(tFP-revFP)}`}</div>
                      {revFP>tFP&&<div style={{fontSize:10,color:'#9ca3af',marginTop:4}}>기능목록 탭 → 영역 추가로 기능을 늘리세요</div>}
                    </div>}
                  </>}
                </div>
              </div>
            </div>
          );
        })()}

        {/* 탭 바 */}
        <div style={{background:'#fff',borderBottom:'1px solid #e5e7eb',display:'flex',paddingLeft:24}}>
          {TAB_LABELS.map(t=>(
            <button key={t.key} onClick={()=>setTab(t.key)} style={{padding:'12px 16px',background:'none',border:'none',cursor:'pointer',fontSize:13,fontWeight:tab===t.key?700:400,color:tab===t.key?'#1d4ed8':'#6b7280',borderBottom:tab===t.key?'2px solid #1d4ed8':'2px solid transparent'}}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── 탭 콘텐츠 ── */}
        <div style={S.content}>
          {(generationJob || restoringJob) && (
            <div style={{...S.card,padding:'12px 16px',border:'1px solid #60a5fa',background:'#eff6ff',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
              <div style={{flex:1,minWidth:220}}>
                <div style={{fontSize:13,fontWeight:700,color:'#1e3a8a'}}>
                  {restoringJob ? '서버 작업 상태 확인 중...' : generationJob.status === 'failed'
                    ? jobError
                    : generationJob.status === 'paused_quota'
                    ? '일일 한도 초과로 작업이 일시정지됐습니다.'
                    : generationJob.status === 'awaiting_confirmation'
                      ? '도메인 분석 완료 — 아래 구조를 확인해 주세요.'
                      : resumingJob ? '중단된 서버 작업 재개 중...' : '서버에서 작업을 계속 진행하고 있습니다.'}
                </div>
                {!restoringJob && generationJob?.status === 'running' && (
                  <div style={{marginTop:7,height:6,borderRadius:4,background:'#bfdbfe',overflow:'hidden'}}>
                    <div style={{width:`${jobProgress}%`,height:'100%',background:'#2563eb',transition:'width .3s'}} />
                  </div>
                )}
                <div style={{fontSize:11,color:'#475569',marginTop:5}}>
                  다른 탭으로 이동하거나 창을 닫아도 서버에서 계속 진행됩니다.
                </div>
                {jobNotice && <div style={{fontSize:11,color:'#92400e',marginTop:5}}>{jobNotice}</div>}
              </div>
              {generationJob?.status === 'paused_quota' && (
                <button onClick={handleResumeJob} style={S.btn('#1d4ed8')}>이어서 진행</button>
              )}
              {canRetryJob && (
                <button onClick={handleResumeJob} disabled={resumingJob} style={S.btn('#dc2626')}>{resumingJob ? '재시도 중...' : '재시도'}</button>
              )}
            </div>
          )}

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              탭1: 프로젝트 설정
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {tab === 'setup' && (
            <div>
              {/* ── 1. 프로젝트 기본 정보 + 예산 입력 ── */}
              <div style={{...S.card,marginBottom:16,border:'2px solid #e5e7eb'}}>
                <div style={{...S.cardHeader,background:'#f8fafc'}}>
                  <span style={{fontSize:14,fontWeight:700,color:'#374151'}}>📌 프로젝트 기본 정보</span>
                  <span style={{fontSize:11,color:'#9ca3af'}}>사업명과 예산을 먼저 입력하면 목표 기능수를 자동으로 계산합니다</span>
                </div>
                <div style={{padding:'16px 20px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                  {/* 시스템명 */}
                  <div>
                    <div style={{fontSize:11,color:'#6b7280',fontWeight:600,marginBottom:4}}>시스템명</div>
                    <input value={systemName} onChange={e=>{setSystemName(e.target.value);saveProject({systemName:e.target.value});}}
                      placeholder="예: 국방연동관리체계 고도화"
                      style={{...S.input,width:'100%',fontSize:13}}/>
                  </div>
                  {/* 사업 예산 */}
                  <div>
                    <div style={{fontSize:11,color:'#6b7280',fontWeight:600,marginBottom:4}}>사업 예산 (VAT 포함)</div>
                    <div style={{display:'flex',gap:6,marginBottom:6}}>
                      <input type="number" value={projectBudget}
                        onChange={e=>{
                          setProjectBudget(e.target.value);
                          const target = calcTargetFuncCount(e.target.value);
                          setProjectScale(target > 0 ? String(target) : '');
                          setAreaTargetCount(target > 0 ? String(target) : '');
                          saveSettings({projectBudget:e.target.value,projectScale:target > 0 ? String(target) : ''});
                        }}
                        placeholder="예산 입력 (원)"
                        style={{...S.input,flex:1,fontSize:13}}/>
                    </div>
                    {/* 빠른 입력 버튼 */}
                    <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                      {[[1,1e8],[2,2e8],[3,3e8],[4,4e8],[5,5e8],[10,1e9],[20,2e9],[30,3e9],[50,5e9],[100,1e10]].map(([l,v])=>(
                        <button key={l} onClick={()=>{
                          setProjectBudget(String(v));
                          const target = calcTargetFuncCount(v);
                          setProjectScale(target > 0 ? String(target) : '');
                          setAreaTargetCount(target > 0 ? String(target) : '');
                          saveSettings({projectBudget:String(v),projectScale:target > 0 ? String(target) : ''});
                        }} style={{fontSize:10,padding:'2px 8px',borderRadius:8,
                          background: projectBudget===String(v)?'#1d4ed8':'#f3f4f6',
                          color: projectBudget===String(v)?'#fff':'#374151',
                          border:'1px solid '+(projectBudget===String(v)?'#1d4ed8':'#e5e7eb'),cursor:'pointer'}}>
                          {l}억
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* 시스템 설명 */}
                  <div>
                    <div style={{fontSize:11,color:'#6b7280',fontWeight:600,marginBottom:4}}>시스템 설명 (선택)</div>
                    <textarea value={systemOverview} onChange={e=>{setSystemOverview(e.target.value);saveProject({systemOverview:e.target.value});}}
                      placeholder="시스템 목적, 주요 기능 등 간략히 입력하면 AI 생성 정확도가 높아집니다"
                      rows={2} style={{...S.input,width:'100%',fontSize:12,resize:'vertical'}}/>
                  </div>
                  {/* 목표 기능수 (예산 기반 자동계산) */}
                  <div>
                    <div style={{fontSize:11,color:'#6b7280',fontWeight:600,marginBottom:4}}>목표 기능수</div>
                    {projectBudget && projectScale ? (
                      <div style={{background:'#eff6ff',border:'2px solid #1d4ed8',borderRadius:8,padding:'12px 16px'}}>
                        <div style={{fontSize:22,fontWeight:800,color:'#1d4ed8'}}>{Number(projectScale).toLocaleString()}개</div>
                        <div style={{fontSize:11,color:'#6b7280',marginTop:2}}>
                          {(Number(projectBudget)/1e8).toFixed(1)}억 예산 기준 적정 기능수
                        </div>
                        <div style={{fontSize:10,color:'#9ca3af',marginTop:1}}>
                          (기본 가정: 보정계수 1.0 · 기능당 평균 {DEFAULT_AVG_FP_PER_FUNC}FP · 이윤 10%.
                          개발비 탭에서 보정계수를 조정하면 값이 달라집니다)
                        </div>
                        <div style={{fontSize:10,color:'#9ca3af',marginTop:4}}>
                          현재 {functions.length}개
                          {functions.length > 0 && (() => {
                            // [변경] 기존: 목표 이상이면 무조건 '✅ 달성' → 초과(인플레)를
                            // 정상으로 표시해 과다산정을 유도했음. 과다는 미달보다 위험하다.
                            const target = Number(projectScale);
                            const ratio = functions.length / target;
                            if (ratio > 1.2) return (
                              <span style={{marginLeft:6,color:'#d97706',fontWeight:600}}>
                                ⚠ {(functions.length-target).toLocaleString()}개 초과 ({Math.round(ratio*100)}%) — 중복/과분해 검토
                              </span>
                            );
                            if (ratio < 0.8) return (
                              <span style={{marginLeft:6,color:'#ef4444',fontWeight:600}}>
                                {(target-functions.length).toLocaleString()}개 부족
                              </span>
                            );
                            return <span style={{marginLeft:6,color:'#16a34a',fontWeight:600}}>✅ 적정 범위 (±20%)</span>;
                          })()}
                        </div>
                      </div>
                    ) : (
                      <div style={{background:'#f9fafb',border:'1px dashed #d1d5db',borderRadius:8,padding:'12px 16px',color:'#9ca3af',fontSize:12}}>
                        예산을 입력하면 자동 계산됩니다
                      </div>
                    )}
                    {/* 직접 입력도 가능 */}
                    <input type="number" value={projectScale}
                      onChange={e=>{setProjectScale(e.target.value);setAreaTargetCount(e.target.value);saveSettings({projectScale:e.target.value});}}
                      placeholder="직접 입력도 가능"
                      style={{...S.input,width:'100%',fontSize:12,marginTop:6}}/>
                  </div>
                </div>
              </div>

              {/* ── 신규 / 고도화 선택 ── */}
              <div style={{display:'flex',gap:10,marginBottom:20}}>
                {[
                  {key:false, label:'🆕 신규 구축', desc:'RFP/기능정의서 기반으로 기능목록 새로 생성'},
                  {key:true,  label:'🔧 고도화 사업', desc:'기존 기능 업로드 후 신규 기능만 추가 생성'},
                ].map(({key,label,desc})=>(
                  <div key={String(key)} onClick={()=>{setUpgradeMode(key);saveSettings({upgradeMode:key});}}
                    style={{flex:1,padding:'14px 20px',borderRadius:10,cursor:'pointer',
                      border:`2px solid ${upgradeMode===key?'#1d4ed8':'#e5e7eb'}`,
                      background:upgradeMode===key?'#eff6ff':'#fff',transition:'all 0.2s'}}>
                    <div style={{fontSize:14,fontWeight:700,color:upgradeMode===key?'#1d4ed8':'#374151',marginBottom:4}}>{label}</div>
                    <div style={{fontSize:11,color:'#6b7280'}}>{desc}</div>
                  </div>
                ))}
              </div>
              {upgradeMode && (
                <div style={{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:8,padding:'10px 16px',marginBottom:16,fontSize:12,color:'#92400e'}}>
                  🔧 <strong>고도화 모드:</strong> 기존 기능정의서(xlsx)를 먼저 업로드하세요. 기존 기능은 <strong>재사용</strong>으로 표시되고, AI는 신규 기능만 추가 생성합니다.
                </div>
              )}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginBottom:20}}>
                {/* 파일 업로드 */}
                <div style={S.card}>
                  <div style={S.cardHeader}>
                    <span style={{fontSize:14,fontWeight:700,color:'#374151'}}>📁 파일 업로드</span>
                    <span style={S.tag(uploadedFiles.length>0||xlsxFunctions.length>0?'#dcfce7':'#f3f4f6', uploadedFiles.length>0||xlsxFunctions.length>0?'#16a34a':'#9ca3af')}>
                      {uploadedFiles.length + (xlsxFunctions.length>0?1:0)}개 파일
                    </span>
                  </div>
                  <div style={{padding:'16px 20px'}}>
                    <p style={{fontSize:12,color:'#6b7280',marginBottom:10}}>
                      파일을 여러 개 올릴수록 기능 정확도가 높아집니다. 나중에 파일이 생기면 추가 업로드 후 재생성하세요.
                    </p>

                    {/* 업로드된 파일 목록 */}
                    {(uploadedFiles.length > 0 || xlsxFunctions.length > 0) && (
                      <div style={{marginBottom:12,display:'flex',flexDirection:'column',gap:6}}>
                        {xlsxFunctions.length > 0 && (
                          <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',background:'#f0fdf4',border:'1px solid #86efac',borderRadius:7}}>
                            <span style={{fontSize:16}}>📋</span>
                            <div style={{flex:1}}>
                              <div style={{fontSize:12,fontWeight:600,color:'#16a34a'}}>기능정의서 (Excel)</div>
                              <div style={{fontSize:10,color:'#6b7280'}}>{xlsxFunctions.length}개 기능 로드됨</div>
                            </div>
                            <button onClick={()=>{setXlsxFunctions([]);saveProject({xlsxFunctions:[]});}} style={{background:'none',border:'none',color:'#9ca3af',cursor:'pointer',fontSize:14}}>✕</button>
                          </div>
                        )}
                        {uploadedFiles.map(f=>(
                          <div key={f.name} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',background:f.isXlsx?'#f0fdf4':'#eff6ff',border:`1px solid ${f.isXlsx?'#86efac':'#bfdbfe'}`,borderRadius:7}}>
                            <span style={{fontSize:16}}>{f.isXlsx?'📋':f.type==='pdf'?'📄':f.type==='docx'?'📝':'📑'}</span>
                            <div style={{flex:1}}>
                              <div style={{fontSize:12,fontWeight:600,color:f.isXlsx?'#16a34a':'#1d4ed8'}}>{f.name}</div>
                              <div style={{fontSize:10,color:'#6b7280'}}>
                                {f.isXlsx ? `${f.functionCount || 0}개 기능 파싱됨` : `${f.size}KB 읽음`}
                              </div>
                            </div>
                            <button onClick={()=>handleRemoveFile(f.name)} style={{background:'none',border:'none',color:'#9ca3af',cursor:'pointer',fontSize:14}}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 파일 추가 버튼 */}
                    <label style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,padding:'10px',border:'2px dashed #e5e7eb',borderRadius:8,cursor:'pointer',background:'#fafafa',transition:'all 0.2s'}}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor='#3b82f6';e.currentTarget.style.background='#eff6ff';}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor='#e5e7eb';e.currentTarget.style.background='#fafafa';}}>
                      <input type="file" accept=".pdf,.docx,.txt,.xlsx,.xls" onChange={handleFileUpload} style={{display:'none'}}/>
                      <span style={{fontSize:16}}>➕</span>
                      <span style={{fontSize:13,fontWeight:600,color:'#6b7280'}}>파일 추가 (PDF / DOCX / XLSX / TXT)</span>
                    </label>

                    {uploadedFiles.length > 0 && (
                      <div style={{marginTop:10,background:'#fffbeb',border:'1px solid #fde68a',borderRadius:7,padding:'8px 12px',fontSize:11,color:'#92400e'}}>
                        💡 파일이 {uploadedFiles.length}개 있습니다. "기능 생성" 버튼을 누르면 전체 파일을 종합해서 생성합니다.
                        {uploadedFiles.length >= 2 && <span style={{color:'#d97706',fontWeight:700}}> (다중 파일 → 정확도 향상)</span>}
                      </div>
                    )}
                  </div>
                </div>

                {/* 직접 입력 */}
                <div style={S.card}>
                  <div style={S.cardHeader}>
                    <span style={{fontSize:14,fontWeight:700,color:'#374151'}}>✏️ 시스템 정보 입력</span>
                  </div>
                  <div style={{padding:'16px 20px',display:'flex',flexDirection:'column',gap:12}}>
                    <div>
                      <label style={S.label}>시스템명 *</label>
                      <input value={systemName} onChange={e=>{setSystemName(e.target.value);saveProject({systemName:e.target.value});}} placeholder="예) 출입관리시스템" style={S.input}/>
                    </div>
                    <div>
                      <label style={S.label}>시스템 개요</label>
                      <textarea value={systemOverview} onChange={e=>{setSystemOverview(e.target.value);saveProject({systemOverview:e.target.value});}} placeholder="시스템의 목적과 주요 기능을 간략히 설명하세요." rows={3} style={{...S.input,resize:'vertical'}}/>
                    </div>
                    <div>
                      <label style={S.label}>추가 설명 / 직접 작성 요구사항</label>
                      <textarea value={userInput} onChange={e=>{setUserInput(e.target.value);saveProject({userInput:e.target.value});}}
                        placeholder={`RFP가 없을 때 여기에 직접 작성하세요.\n\n예)\n- 출입신청서 작성 및 제출 기능\n- 관리자 승인/반려 기능\n- 출입이력 조회 및 통계`}
                        rows={7} style={{...S.input,resize:'vertical'}}/>
                    </div>
                  </div>
                </div>
              </div>

              {/* 기능 생성 버튼 */}
              <div style={{...S.card,background:'linear-gradient(135deg,#1e3a8a,#1d4ed8)'}}>
                <div style={{padding:'24px 28px',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:16}}>
                  <div>
                    <div style={{fontSize:16,fontWeight:700,color:'#fff',marginBottom:4}}>
                      {upgradeMode ? '🔧 고도화 기능 추가 생성' : '✨ AI 기능목록 생성'}
                    </div>
                    <div style={{fontSize:12,color:'rgba(255,255,255,0.7)'}}>
                      {upgradeMode
                        ? '기존 기능(재사용) 위에 RFP 기반 신규 기능만 추가 생성합니다.'
                        : '파일과 입력 내용을 분석해서 정확한 기능목록을 생성합니다.'}
                    </div>
                    {upgradeMode && functions.length===0 && <div style={{marginTop:6,fontSize:11,color:'#fcd34d'}}>⚠️ 먼저 기존 기능정의서(xlsx)를 업로드하세요.</div>}
                    {functions.length>0 && <div style={{marginTop:6,fontSize:11,color:'#93c5fd'}}>현재 {functions.length}개 기능 {upgradeMode?'(재사용 포함)':'있음 — 재생성하면 덮어쓰기'}</div>}
                  </div>
                  <button onClick={handleGenerate} style={{...S.btn('#fff','#1e3a8a'),padding:'12px 28px',fontSize:14,flexShrink:0}}>
                    {upgradeMode ? '🔧 신규 기능 추가' : '🚀 기능 생성 시작'}
                  </button>
                </div>
              </div>

              {/* ── 도메인 확인 단계 ── */}
              {domainStep && pendingDomains.length > 0 && (
                <div style={{...S.card,border:'2px solid #1d4ed8',marginTop:0}}>
                  <div style={{...S.cardHeader,background:'#eff6ff'}}>
                    <div>
                      <span style={{fontSize:14,fontWeight:700,color:'#1d4ed8'}}>📋 2단계: LV1 메뉴 구조 확인</span>
                      <div style={{fontSize:11,color:'#6b7280',marginTop:2}}>AI가 분석한 메뉴 구조입니다. 불필요한 LV1을 제거하거나 추가한 후 "기능 생성 시작"을 누르세요.</div>
                    </div>
                    <button onClick={()=>{setDomainStep(false);setPendingDomains([]);setPendingInfo(null);}}
                      style={{background:'none',border:'none',color:'#9ca3af',cursor:'pointer',fontSize:18}}>✕</button>
                  </div>
                  <div style={{padding:'16px 20px'}}>
                    {(pendingInfo?.analysisStatus?.infoFailed || pendingInfo?.analysisStatus?.domainFallback || pendingInfo?.analysisStatus?.requirementChunks?.failures?.length > 0) && (
                      <div style={{marginBottom:14,padding:'10px 12px',border:'1px solid #f59e0b',borderRadius:8,background:'#fffbeb',color:'#92400e',fontSize:12,lineHeight:1.5}}>
                        <strong>⚠ 분석 결과를 수동 확인해야 합니다.</strong>
                        {pendingInfo.analysisStatus.infoFailed && <div>시스템 기본정보 추출에 실패해 기본값을 사용했습니다.</div>}
                        {pendingInfo.analysisStatus.domainFallback && <div>도메인 분류 실패로 일반 폴백 도메인을 표시했습니다.</div>}
                        {pendingInfo.analysisStatus.requirementChunks.failures.length > 0 && (
                          <div>요구사항 청크 {pendingInfo.analysisStatus.requirementChunks.total}개 중 {pendingInfo.analysisStatus.requirementChunks.failures.length}개 실패: {pendingInfo.analysisStatus.requirementChunks.failures.map(f=>f.range).join(', ')}</div>
                        )}
                        <div>검토한 도메인을 직접 선택해야 다음 단계로 진행할 수 있습니다.</div>
                      </div>
                    )}
                    <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:14}}>
                      {pendingDomains.map((d,i)=>(
                        <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',
                          border:`2px solid ${d.enabled?'#1d4ed8':'#e5e7eb'}`,borderRadius:8,
                          background:d.enabled?'#eff6ff':'#f9fafb',cursor:'pointer'}}
                          onClick={()=>{
                            const next=[...pendingDomains];
                            next[i]={...next[i],enabled:!next[i].enabled};
                            setPendingDomains(next);
                          }}>
                          <input type="checkbox" checked={d.enabled} readOnly
                            style={{width:16,height:16,flexShrink:0,cursor:'pointer'}}/>
                          <div style={{flex:1}}>
                            <input value={d.lv1} onChange={e=>{
                              const next=[...pendingDomains];
                              next[i]={...next[i],lv1:e.target.value};
                              setPendingDomains(next);
                            }} onClick={e=>e.stopPropagation()}
                            style={{fontWeight:700,fontSize:13,color:d.enabled?'#1d4ed8':'#9ca3af',
                              border:'none',outline:'none',background:'transparent',width:'auto',minWidth:100}}/>
                            <div style={{fontSize:11,color:'#6b7280',marginTop:2}}>{d.description}</div>
                            {d.expectedLv2?.length>0 && (
                              <div style={{display:'flex',gap:4,flexWrap:'wrap',marginTop:4}}>
                                {d.expectedLv2.map((lv2,j)=>(
                                  <span key={j} style={{fontSize:10,background:'#dbeafe',color:'#1e40af',padding:'1px 6px',borderRadius:8}}>{lv2}</span>
                                ))}
                              </div>
                            )}
                          </div>
                          <button onClick={e=>{e.stopPropagation();setPendingDomains(pendingDomains.filter((_,idx)=>idx!==i));}}
                            style={{background:'none',border:'none',color:'#ef4444',cursor:'pointer',fontSize:14,flexShrink:0}}>✕</button>
                        </div>
                      ))}
                    </div>
                    {/* LV1 직접 추가 */}
                    <div style={{display:'flex',gap:8,marginBottom:14}}>
                      <input value={newDomainInput} onChange={e=>setNewDomainInput(e.target.value)}
                        onKeyDown={e=>{if(e.key==='Enter'&&newDomainInput.trim()){
                          setPendingDomains([...pendingDomains,{lv1:newDomainInput.trim(),description:'직접 추가',enabled:true,expectedLv2:[],requirements:[]}]);
                          setNewDomainInput('');
                        }}}
                        placeholder="LV1 직접 추가 (Enter)" style={{...S.input,flex:1}}/>
                      <button onClick={()=>{
                        if(!newDomainInput.trim()) return;
                        setPendingDomains([...pendingDomains,{lv1:newDomainInput.trim(),description:'직접 추가',enabled:true,expectedLv2:[],requirements:[]}]);
                        setNewDomainInput('');
                      }} style={S.btnOutline('#1d4ed8')}>+ 추가</button>
                    </div>
                    <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                      <span style={{fontSize:12,color:'#6b7280',alignSelf:'center'}}>
                        {pendingDomains.filter(d=>d.enabled).length}개 LV1 선택됨
                      </span>
                      <button onClick={()=>{setDomainStep(false);setPendingDomains([]);setPendingInfo(null);}}
                        style={S.btnOutline()}>취소</button>
                      <button onClick={handleConfirmDomains} style={{...S.btn('#1d4ed8'),padding:'10px 24px',fontSize:14}}>
                        🚀 이 구조로 기능 생성
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              탭2: 기능목록
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {tab === 'functions' && (
            <div style={{position:'relative'}}>
              {jobLocked && <div aria-label="기능목록 편집 잠금" style={{position:'absolute',inset:0,zIndex:20,background:'rgba(248,250,252,.45)',cursor:'not-allowed'}} />}
              {generationCheckpoint && (
                <div style={{...S.card,marginBottom:12,padding:'12px 16px',border:'1px solid #3b82f6',background:'#eff6ff',display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
                  <span style={{fontSize:12,color:'#1e3a8a'}}>
                    이전 방식의 중단 기록입니다. 폐기 후 서버 작업으로 새로 시작하세요.
                  </span>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    <button onClick={handleDiscardCheckpoint} style={S.btnOutline('#dc2626')}>폐기</button>
                  </div>
                </div>
              )}
              {failedDomains.length > 0 && (
                <div style={{...S.card,marginBottom:12,padding:'12px 16px',border:'1px solid #f59e0b',background:'#fffbeb',display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
                  <span style={{fontSize:12,color:'#92400e'}}>
                    ⚠ {failedDomains.length}개 도메인 생성 실패: {failedDomains.map(item=>item.lv1).join(', ')}
                  </span>
                  <button onClick={handleRetryFailedDomains} style={S.btn('#d97706')}>실패 도메인만 다시 생성</button>
                </div>
              )}
              {/* 검색/필터 바 */}
              <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
                <div style={{position:'relative',flex:1,minWidth:180}}>
                  <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'#9ca3af',fontSize:14}}>🔍</span>
                  <input
                    value={searchKeyword}
                    onChange={e=>{setSearchKeyword(e.target.value);setVsStart(0);}}
                    placeholder="LV1/LV2/LV3/기능정의 통합 검색..."
                    style={{...S.input,paddingLeft:32,fontSize:13}}
                  />
                </div>
                <select
                  value={filterLV1}
                  onChange={e=>{setFilterLV1(e.target.value);setVsStart(0);}}
                  style={{padding:'8px 12px',border:'1px solid #e5e7eb',borderRadius:7,fontSize:13,background:'#fff',minWidth:160}}>
                  <option value="">전체 LV1 ({functions.length}개)</option>
                  {[...new Set(functions.map(f=>f.lv1).filter(Boolean))].sort().map(lv1=>(
                    <option key={lv1} value={lv1}>
                      {lv1} ({functions.filter(f=>f.lv1===lv1).length}개)
                    </option>
                  ))}
                </select>
                {(searchKeyword || filterLV1) && (
                  <button onClick={()=>{setSearchKeyword('');setFilterLV1('');}} style={S.btnOutline('#6b7280')}>
                    ✕ 초기화
                  </button>
                )}
              </div>
              {/* 헤더 */}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap',gap:8}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <p style={{fontSize:14,color:'#6b7280',margin:0}}>
                    {(searchKeyword||filterLV1)
                      ? `${functions.filter(f=>{const kw=searchKeyword.toLowerCase();return(!kw||[f.lv1,f.lv2,f.lv3,f.definition].some(v=>(v||'').toLowerCase().includes(kw)))&&(!filterLV1||f.lv1===filterLV1);}).length}개 표시 (전체 ${functions.length}개)`
                      : `총 ${functions.length}개 기능`}
                  </p>
                  {upgradeMode && <span style={{fontSize:11,background:'#fef3c7',color:'#d97706',padding:'2px 8px',borderRadius:8,fontWeight:600}}>🔧 고도화 모드</span>}
                  {selectedIds.size>0 && <span style={{fontSize:11,background:'#eff6ff',color:'#1d4ed8',padding:'2px 8px',borderRadius:8,fontWeight:600}}>{selectedIds.size}개 선택</span>}
                </div>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {/* 일괄 편집 패널 토글 */}
                  {selectedIds.size>0 && (
                    <div style={{display:'flex',gap:4,alignItems:'center',background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:7,padding:'4px 8px',flexWrap:'wrap'}}>
                      <span style={{fontSize:11,color:'#1d4ed8',fontWeight:600}}>{selectedIds.size}개 선택:</span>
                      <input value={bulkLV1} onChange={e=>setBulkLV1(e.target.value)} placeholder="LV1 일괄수정" style={{...S.input,width:100,fontSize:11,padding:'3px 6px'}}/>
                      <button onClick={()=>{
                        if(!bulkLV1.trim()) return;
                        const cnt = selectedIds.size;
                        const updated = functions.map(f=>selectedIds.has(f.id)?{...f,lv1:bulkLV1.trim()}:f);
                        setFunctions(updated); saveProject({functions:updated});
                        setSelectedIds(new Set()); setBulkLV1('');
                        alert(`✅ ${cnt}개 LV1을 "${bulkLV1}"으로 수정했습니다.`);
                      }} style={{...S.btn('#1d4ed8'),padding:'3px 8px',fontSize:11}}>LV1수정</button>
                      <select value={bulkReuseType} onChange={e=>setBulkReuseType(e.target.value)}
                        style={{border:'1px solid #e5e7eb',borderRadius:5,fontSize:11,padding:'3px 6px',background:'#fff'}}>
                        {REUSE_TYPES.map(t=><option key={t}>{t}</option>)}
                      </select>
                      <button onClick={()=>{
                        const cnt = selectedIds.size;
                        const updated = functions.map(f=>selectedIds.has(f.id)?{...f,reuseType:bulkReuseType}:f);
                        setFunctions(updated); saveProject({functions:updated});
                        setSelectedIds(new Set());
                        alert(`✅ ${cnt}개를 "${bulkReuseType}"으로 변경했습니다.`);
                      }} style={{...S.btn('#16a34a'),padding:'3px 8px',fontSize:11}}>유형변경</button>
                      <button onClick={()=>{
                        if(!window.confirm(`선택한 ${selectedIds.size}개를 삭제할까요?`)) return;
                        const updated = functions.filter(f=>!selectedIds.has(f.id));
                        setFunctions(updated); saveProject({functions:updated});
                        setSelectedIds(new Set());
                      }} style={{...S.btn('#ef4444'),padding:'3px 8px',fontSize:11}}>삭제</button>
                      <button onClick={()=>setSelectedIds(new Set())} style={{background:'none',border:'none',color:'#6b7280',cursor:'pointer',fontSize:13}}>✕</button>
                    </div>
                  )}
                  <button onClick={()=>{setShowAreaPanel(v=>!v);setAreaSuggestions(null);}} style={S.btn(showAreaPanel?'#7c3aed':'#6b7280')}>
                    {showAreaPanel?'닫기':'+ 영역 추가'}
                  </button>
                  <button onClick={()=>{
                    const newRow = {id:Date.now(),lv1:'',lv2:'',lv3:'',definition:''};
                    const updated = [...functions,newRow];
                    setFunctions(updated); saveProject({functions:updated});
                  }} style={S.btnOutline('#2563eb')}>+ 행 추가</button>
                  <button onClick={async()=>{
                    const {exportGenericExcel} = await import('../utils/excelExport');
                    await exportGenericExcel('기능목록',['LV1','LV2','LV3','기능정의'],
                      functions.map(f=>[f.lv1,f.lv2,f.lv3,f.definition]),
                      [20,20,25,40], systemName||project.name);
                  }} style={S.btn('#374151')}>📥 Excel</button>
                </div>
              </div>

              {/* 영역 추가 패널 */}
              {showAreaPanel && (
                <div style={{...S.card,marginBottom:16,border:'2px solid #7c3aed'}}>
                  <div style={{...S.cardHeader,background:'#faf5ff'}}>
                    <span style={{fontSize:14,fontWeight:700,color:'#7c3aed'}}>🔍 추가 업무 영역 제안</span>
                    <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                      {/* 예산 입력으로 목표 기능 수 자동 계산 */}
                      <div style={{display:'flex',alignItems:'center',gap:6,background:'#fff',border:'1px solid #e9d5ff',borderRadius:8,padding:'6px 10px'}}>
                        <span style={{fontSize:11,color:'#7c3aed',fontWeight:600,whiteSpace:'nowrap'}}>예산</span>
                        <input type="number" placeholder="억원"
                          style={{...S.input,width:80,fontSize:11}}
                          onChange={e=>{
                            const budgetWon = Number(e.target.value) * 1e8;
                            if (!budgetWon) { setAreaTargetCount(''); return; }
                            // [통일] 프로젝트설정과 동일한 calcTargetFuncCount 사용.
                            // 보정계수/직접비/이윤율은 현재 개발비 설정값을 그대로 전달.
                            const coeff = COST_LINK[costLinkIdx].v * COST_PERF[costPerfIdx].v * COST_ENV[costEnvIdx].v * COST_SEC[costSecIdx].v;
                            // 평균 FP: 실측이 있으면 실측, 없으면 기본 상수(4)로 설정과 일치
                            const avgFpPerFunc = fpList.length > 0
                              ? (Number(calcTotalFP(fpList,'standard').newDev) / Math.max(fpList.filter(f=>f.reuseType===REUSE_TYPE.NEW).length,1))
                              : DEFAULT_AVG_FP_PER_FUNC;
                            const needFuncs = calcTargetFuncCount(budgetWon, {
                              unitPrice: costUnitPrice,
                              profitRate: costProfitRate/100,
                              directExp: Number(costDirectExp||0),
                              coeff,
                              avgFpPerFunc,
                            });
                            setAreaTargetCount(String(Math.max(needFuncs, functions.length+1)));
                          }}
                        />
                        <span style={{fontSize:11,color:'#9ca3af'}}>억원</span>
                        <span style={{fontSize:10,color:'#c4b5fd'}}>→</span>
                        <span style={{fontSize:11,color:'#7c3aed',fontWeight:700}}>
                          {areaTargetCount ? `목표 ${Number(areaTargetCount).toLocaleString()}개` : '?'}
                        </span>
                      </div>
                      <span style={{color:'#d1d5db',fontSize:12}}>또는</span>
                      <input type="number" value={areaTargetCount} onChange={e=>setAreaTargetCount(e.target.value)}
                        placeholder="목표 기능 수 직접 입력" style={{...S.input,width:140,fontSize:12}}/>
                      {areaTargetCount && Number(areaTargetCount) > functions.length && (
                        <div style={{background:'#faf5ff',border:'1px solid #e9d5ff',borderRadius:7,padding:'5px 10px',fontSize:11,color:'#7c3aed',whiteSpace:'nowrap'}}>
                          현재 {functions.length.toLocaleString()}개 →
                          <span style={{fontWeight:700,color:'#dc2626'}}> {(Number(areaTargetCount)-functions.length).toLocaleString()}개 더 필요</span>
                        </div>
                      )}
                      {areaTargetCount && Number(areaTargetCount) <= functions.length && (
                        <div style={{background:'#f0fdf4',border:'1px solid #86efac',borderRadius:7,padding:'5px 10px',fontSize:11,color:'#16a34a',whiteSpace:'nowrap'}}>
                          ✅ 목표 달성! (현재 {functions.length.toLocaleString()}개)
                        </div>
                      )}
                      <button onClick={handleSuggestAreas} style={S.btn('#7c3aed')}>AI 분석</button>
                    </div>
                  </div>
                  <div style={{padding:'16px 20px'}}>
                    {!areaSuggestions ? (
                      <div style={{textAlign:'center',padding:'20px',color:'#9ca3af',fontSize:13}}>
                        목표 기능 수를 입력하고 "AI 분석" 버튼을 누르면<br/>
                        이 프로젝트에서 추가 가능한 업무 영역을 제안합니다.
                      </div>
                    ) : (
                      <>
                        {areaSuggestions.analysis && (
                          <div style={{background:'#f0f9ff',borderRadius:8,padding:'10px 14px',marginBottom:12,fontSize:12,color:'#0369a1'}}>
                            📊 {areaSuggestions.analysis}
                          </div>
                        )}
                        <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:12}}>
                          {(areaSuggestions.suggestions||[]).map((s,i)=>(
                            <label key={i} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'10px 14px',border:`2px solid ${selectedAreas.includes(i)?'#7c3aed':'#e5e7eb'}`,borderRadius:8,cursor:'pointer',background:selectedAreas.includes(i)?'#faf5ff':'#fff'}}>
                              <input type="checkbox" checked={selectedAreas.includes(i)}
                                onChange={e=>setSelectedAreas(prev=>e.target.checked?[...prev,i]:prev.filter(x=>x!==i))}
                                style={{marginTop:2,flexShrink:0}}/>
                              <div style={{flex:1}}>
                                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
                                  <span style={{fontSize:13,fontWeight:700,color:'#374151'}}>{s.lv1}</span>
                                  <span style={S.tag('#e9d5ff','#7c3aed')}>+{s.expectedFunctions}개 예상</span>
                                </div>
                                <div style={{fontSize:11,color:'#6b7280',marginBottom:4}}>{s.description}</div>
                                {s.sampleLv2?.length>0 && (
                                  <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                                    {s.sampleLv2.map((lv2,j)=><span key={j} style={S.tag('#f3f4f6','#374151')}>{lv2}</span>)}
                                  </div>
                                )}
                                {s.relatedRequirement && <div style={{fontSize:10,color:'#9ca3af',marginTop:4}}>근거: {s.relatedRequirement}</div>}
                                {s.weakEvidence && <div style={{fontSize:10,color:'#d97706',marginTop:2,fontWeight:600}}>⚠ RFP 근거가 약함 — 추가 전 확인 권장</div>}
                              </div>
                            </label>
                          ))}
                        </div>
                        {/* 직접 입력 여러개 */}
                        <div style={{marginBottom:8}}>
                          <div style={{fontSize:11,color:'#7c3aed',fontWeight:600,marginBottom:6}}>✏️ 직접 입력 (여러 개 가능)</div>
                          {customAreas.map((area, idx)=>(
                            <div key={idx} style={{display:'flex',gap:6,marginBottom:5}}>
                              <input value={area} onChange={e=>{
                                const next = [...customAreas];
                                next[idx] = e.target.value;
                                setCustomAreas(next);
                              }} placeholder={`추가할 업무 영역명 ${idx+1}`}
                              style={{...S.input,flex:1,fontSize:12}}/>
                              {customAreas.length > 1 && (
                                <button onClick={()=>setCustomAreas(customAreas.filter((_,i)=>i!==idx))}
                                  style={{background:'none',border:'1px solid #e5e7eb',borderRadius:6,color:'#9ca3af',cursor:'pointer',padding:'0 8px',fontSize:13}}>✕</button>
                              )}
                            </div>
                          ))}
                          <button onClick={()=>setCustomAreas([...customAreas,''])}
                            style={{...S.btnOutline('#7c3aed'),fontSize:11,padding:'4px 10px',marginTop:2}}>
                            + 영역 추가
                          </button>
                        </div>
                        <button onClick={handleExpandAreas}
                          disabled={selectedAreas.length===0 && customAreas.every(a=>!a.trim())}
                          style={{...S.btn('#7c3aed'),width:'100%',padding:'10px'}}>
                          🚀 선택 영역 기능 생성 ({selectedAreas.length + customAreas.filter(a=>a.trim()).length}개 영역)
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* 기능 테이블 */}
              {functions.length === 0 ? (
                <div style={{...S.card,padding:'60px',textAlign:'center',color:'#9ca3af'}}>
                  <div style={{fontSize:40,marginBottom:12}}>📋</div>
                  <p style={{fontSize:14}}>기능목록이 없습니다.</p>
                  <p style={{fontSize:12}}>프로젝트 설정 탭에서 파일을 업로드하거나 설명을 입력 후 기능을 생성하세요.</p>
                  <button onClick={()=>setTab('setup')} style={{...S.btn('#1d4ed8'),marginTop:16}}>프로젝트 설정으로 이동</button>
                </div>
              ) : (
                <div style={{...S.card,overflow:'hidden'}}>
                  <div style={{overflowX:'auto'}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                      <thead>
                        <tr style={{background:'#f8fafc',borderBottom:'2px solid #e5e7eb'}}>
                          <th style={{padding:'10px 8px',width:32,textAlign:'center'}}>
                            <input type="checkbox" title="전체 선택/해제"
                              checked={(() => {
                                const filtered = functions.filter(f => {
                                  const kw = searchKeyword.toLowerCase();
                                  return (!kw || [f.lv1,f.lv2,f.lv3,f.definition].some(v=>(v||'').toLowerCase().includes(kw)))
                                    && (!filterLV1 || f.lv1===filterLV1);
                                });
                                return filtered.length > 0 && filtered.every(f => selectedIds.has(f.id));
                              })()}
                              onChange={e => {
                                const filtered = functions.filter(f => {
                                  const kw = searchKeyword.toLowerCase();
                                  return (!kw || [f.lv1,f.lv2,f.lv3,f.definition].some(v=>(v||'').toLowerCase().includes(kw)))
                                    && (!filterLV1 || f.lv1===filterLV1);
                                });
                                const next = new Set(selectedIds);
                                if (e.target.checked) filtered.forEach(f => next.add(f.id));
                                else filtered.forEach(f => next.delete(f.id));
                                setSelectedIds(next);
                              }}
                            />
                          </th>
                          <th style={{padding:'10px 12px',textAlign:'left',fontWeight:600,color:'#374151',minWidth:80}}>LV1</th>
                          <th style={{padding:'10px 12px',textAlign:'left',fontWeight:600,color:'#374151',minWidth:100}}>LV2</th>
                          <th style={{padding:'10px 12px',textAlign:'left',fontWeight:600,color:'#374151',minWidth:120}}>LV3</th>
                          <th style={{padding:'10px 12px',textAlign:'left',fontWeight:600,color:'#374151',minWidth:200}}>기능 정의</th>
                          {upgradeMode && <th style={{padding:'10px 8px',textAlign:'center',fontWeight:600,color:'#d97706',background:'#fefce8',whiteSpace:'nowrap'}}>재사용유형</th>}
                          <th style={{padding:'10px 12px',textAlign:'center',fontWeight:600,color:'#374151'}}>삭제</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(()=>{
                          const kw = searchKeyword.toLowerCase();
                          const filtered = functions.filter(f=>{
                            const matchKw = !kw || [f.lv1,f.lv2,f.lv3,f.definition].some(v=>(v||'').toLowerCase().includes(kw));
                            const matchLv1 = !filterLV1 || f.lv1===filterLV1;
                            return matchKw && matchLv1;
                          });
                          if (filtered.length === 0 && (searchKeyword||filterLV1)) return (
                            <tr><td colSpan={upgradeMode?7:6} style={{padding:'30px',textAlign:'center',color:'#9ca3af',fontSize:13}}>
                              검색 결과가 없습니다. <button onClick={()=>{setSearchKeyword('');setFilterLV1('');setVsStart(0);}} style={{color:'#3b82f6',background:'none',border:'none',cursor:'pointer',textDecoration:'underline'}}>초기화</button>
                            </td></tr>
                          );
                          const visible = filtered.slice(vsStart, vsStart + VS_PAGE);
                          return visible.map((f,idx)=>(
                          <tr key={f.id} style={{borderBottom:'1px solid #f3f4f6',background:selectedIds.has(f.id)?'#eff6ff':idx%2===0?'#fff':'#fafafa'}}>
                            <td style={{padding:'6px 8px',textAlign:'center',width:32}}><input type="checkbox" checked={selectedIds.has(f.id)} onChange={e=>{const n=new Set(selectedIds);e.target.checked?n.add(f.id):n.delete(f.id);setSelectedIds(n);}}/></td>
                            {(['lv1','lv2','lv3','definition']).map(field=>(
                              <td key={field} style={{padding:'6px 8px'}}>
                                <input value={f[field]||''} onChange={e=>{
                                  const updated = functions.map(fn=>fn.id===f.id?{...fn,[field]:e.target.value}:fn);
                                  setFunctions(updated); saveProject({functions:updated});
                                }} style={{width:'100%',border:'none',outline:'none',fontSize:12,background:'transparent',minWidth:field==='definition'?200:80}}/>
                              </td>
                            ))}
                            {upgradeMode && (
                              <td style={{padding:'4px 6px',textAlign:'center',background:'#fefce8'}}>
                                <select value={f.reuseType||REUSE_TYPE.NEW} onChange={e=>{
                                  const updated = functions.map(fn=>fn.id===f.id?{...fn,reuseType:e.target.value}:fn);
                                  setFunctions(updated); saveProject({functions:updated});
                                }} style={{border:'1px solid #e5e7eb',borderRadius:4,fontSize:10,padding:'2px 3px',
                                  background:f.reuseType===REUSE_TYPE.REUSED?'#f0fdf4':f.reuseType===REUSE_TYPE.CHANGED?'#fffbeb':'#fff',
                                  color:f.reuseType===REUSE_TYPE.REUSED?'#16a34a':f.reuseType===REUSE_TYPE.CHANGED?'#d97706':'#374151',fontWeight:600}}>
                                  {REUSE_TYPES.map(t=><option key={t}>{t}</option>)}
                                </select>
                              </td>
                            )}
                            <td style={{padding:'6px 8px',textAlign:'center'}}>
                              <button onClick={()=>{
                                const updated = functions.filter(fn=>fn.id!==f.id);
                                setFunctions(updated); saveProject({functions:updated});
                              }} style={{background:'none',border:'none',color:'#ef4444',cursor:'pointer',fontSize:14}}>✕</button>
                            </td>
                          </tr>
                        ))})()}
                      </tbody>
                    </table>
                  </div>

                  {/* Virtual Scroll 페이지네이션 */}
                  {(()=>{
                    const kw = searchKeyword.toLowerCase();
                    const filtered = functions.filter(f=>{
                      const matchKw = !kw || [f.lv1,f.lv2,f.lv3,f.definition].some(v=>(v||'').toLowerCase().includes(kw));
                      return matchKw && (!filterLV1 || f.lv1===filterLV1);
                    });
                    if (filtered.length <= VS_PAGE) return null;
                    const totalPages = Math.ceil(filtered.length / VS_PAGE);
                    const curPage = Math.floor(vsStart / VS_PAGE);
                    return (
                      <div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:8,padding:'12px',borderTop:'1px solid #f3f4f6',background:'#f9fafb'}}>
                        <button onClick={()=>setVsStart(0)} disabled={curPage===0}
                          style={{padding:'4px 10px',border:'1px solid #e5e7eb',borderRadius:6,background:'#fff',cursor:curPage===0?'default':'pointer',color:curPage===0?'#9ca3af':'#374151',fontSize:12}}>처음</button>
                        <button onClick={()=>setVsStart(Math.max(0,vsStart-VS_PAGE))} disabled={curPage===0}
                          style={{padding:'4px 10px',border:'1px solid #e5e7eb',borderRadius:6,background:'#fff',cursor:curPage===0?'default':'pointer',color:curPage===0?'#9ca3af':'#374151',fontSize:12}}>◀ 이전</button>
                        <span style={{fontSize:12,color:'#6b7280'}}>{curPage+1} / {totalPages} 페이지 ({filtered.length}개)</span>
                        <button onClick={()=>setVsStart(Math.min((totalPages-1)*VS_PAGE,vsStart+VS_PAGE))} disabled={curPage===totalPages-1}
                          style={{padding:'4px 10px',border:'1px solid #e5e7eb',borderRadius:6,background:'#fff',cursor:curPage===totalPages-1?'default':'pointer',color:curPage===totalPages-1?'#9ca3af':'#374151',fontSize:12}}>다음 ▶</button>
                        <button onClick={()=>setVsStart((totalPages-1)*VS_PAGE)} disabled={curPage===totalPages-1}
                          style={{padding:'4px 10px',border:'1px solid #e5e7eb',borderRadius:6,background:'#fff',cursor:curPage===totalPages-1?'default':'pointer',color:curPage===totalPages-1?'#9ca3af':'#374151',fontSize:12}}>끝</button>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              탭3: FP 산정표
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {tab === 'fp' && (
            <div style={{position:'relative'}}>
              {jobLocked && <div aria-label="FP표 편집 잠금" style={{position:'absolute',inset:0,zIndex:20,background:'rgba(248,250,252,.45)',cursor:'not-allowed'}} />}
              {/* 헤더 */}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap',gap:8}}>
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  <p style={{fontSize:14,color:'#6b7280',margin:0}}>총 {fpList.length}개</p>
                  <div style={{display:'flex',gap:4}}>
                    {['standard','simple'].map(m=>(
                      <button key={m} onClick={()=>{
                        setFpMethod(m);
                        saveSettings({fpMethod:m});
                        const updated = fpList.map(f=>autoCalcRow(f,m));
                        setFpList(updated); saveProject({fpList:updated});
                      }} style={{padding:'4px 10px',fontSize:11,fontWeight:600,border:'1px solid '+(fpMethod===m?'#1d4ed8':'#e5e7eb'),borderRadius:5,cursor:'pointer',background:fpMethod===m?'#1d4ed8':'#fff',color:fpMethod===m?'#fff':'#374151'}}>
                        {m==='standard'?'정통법':'간이법'}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={()=>setShowValidation(v=>!v)} style={S.btn(showValidation?'#dc2626':'#f59e0b')}>
                    {showValidation?'검증 닫기':'🔍 FP 검증'}
                  </button>
                  <button onClick={()=>{
                    const newRow = autoCalcRow({id:Date.now(),lv1:'',lv2:'',lv3:'',definition:'',fpType:'EI',ftr:1,det:5,reuseType:REUSE_TYPE.NEW,ftrChange:0,detChange:0,bigo:'-'},fpMethod);
                    const updated = [...fpList,newRow];
                    setFpList(updated); saveProject({fpList:updated});
                  }} style={S.btnOutline()}>+ 행 추가</button>
                </div>
              </div>

              {/* FP 검증 */}
              {showValidation && (() => {
                const issues = validateFP();
                const errors = issues.filter(i=>i.severity==='error');
                const warnings = issues.filter(i=>i.severity==='warning');
                return (
                  <div style={{...S.card,marginBottom:12,border:`2px solid ${errors.length>0?'#ef4444':'#f59e0b'}`}}>
                    <div style={{...S.cardHeader,background:errors.length>0?'#fef2f2':'#fffbeb'}}>
                      <span style={{fontSize:13,fontWeight:700,color:errors.length>0?'#dc2626':'#d97706'}}>
                        {issues.length===0?'✅ FP 검증 통과':`⚠️ 총 ${issues.length}개 항목 검토 필요 (오류 ${errors.length}, 경고 ${warnings.length})`}
                      </span>
                    </div>
                    {issues.length>0 && (
                      <div style={{padding:'10px 16px',display:'flex',flexDirection:'column',gap:5}}>
                        {issues.map((issue,i)=>(
                          <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'6px 10px',borderRadius:6,background:issue.severity==='error'?'#fef2f2':'#fffbeb'}}>
                            <span>{issue.severity==='error'?'❌':'⚠️'}</span>
                            <span style={{fontSize:11,fontWeight:700,padding:'1px 6px',borderRadius:4,background:issue.severity==='error'?'#fee2e2':'#fef9c3',color:issue.severity==='error'?'#dc2626':'#854d0e'}}>{issue.type}</span>
                            <span style={{fontSize:12,color:'#374151',flex:1}}>{issue.message}</span>
                            {issue.id && (
                              <button onClick={()=>{
                                const el = document.getElementById(`fp-row-${issue.id}`);
                                if(el){el.scrollIntoView({behavior:'smooth',block:'center'});el.style.outline='2px solid #f59e0b';setTimeout(()=>el.style.outline='',2000);}
                              }} style={{fontSize:10,padding:'2px 8px',background:'#f59e0b',color:'#fff',border:'none',borderRadius:4,cursor:'pointer',whiteSpace:'nowrap'}}>
                                위치로 →
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* FP 없을 때 */}
              {fpList.length === 0 ? (
                <div style={{...S.card,padding:'60px',textAlign:'center',color:'#9ca3af'}}>
                  <div style={{fontSize:40,marginBottom:12}}>📊</div>
                  <p style={{fontSize:14}}>FP 산정표가 없습니다.</p>
                  <p style={{fontSize:12}}>기능목록을 먼저 생성한 후 AI FP 산정 버튼을 눌러주세요.</p>
                  <button onClick={()=>setTab('functions')} style={{...S.btn('#1d4ed8'),marginTop:16}}>기능목록으로 이동</button>
                </div>
              ) : (
                <div style={S.card}>
                  <div style={{overflowX:'auto'}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
                      <thead>
                        <tr style={{background:'#f8fafc',borderBottom:'2px solid #e5e7eb'}}>
                          <th style={{padding:'8px',minWidth:80,textAlign:'left',color:'#374151'}}>LV1</th>
                          <th style={{padding:'8px',minWidth:80,textAlign:'left',color:'#374151'}}>LV2</th>
                          <th style={{padding:'8px',minWidth:100,textAlign:'left',color:'#374151'}}>LV3</th>
                          <th style={{padding:'8px',minWidth:160,textAlign:'left',color:'#374151'}}>단위프로세스 설명</th>
                          <th style={{padding:'8px',textAlign:'center',color:'#374151',background:'#e8f4ff'}}>FP유형</th>
                          <th style={{padding:'8px',textAlign:'center',color:'#374151',background:'#e8f4ff'}}>FTR</th>
                          <th style={{padding:'8px',textAlign:'center',color:'#374151',background:'#e8f4ff'}}>DET</th>
                          <th style={{padding:'8px',textAlign:'center',color:'#374151',background:'#e8f4ff'}}>복잡도</th>
                          <th style={{padding:'8px',textAlign:'center',color:'#374151',background:'#e8f4ff'}}>점수</th>
                          <th style={{padding:'8px',textAlign:'center',color:'#374151'}}>재사용유형</th>
                          <th style={{padding:'8px',textAlign:'center',color:'#374151',background:'#fef9c3',minWidth:55}}>FTR변경</th>
                          <th style={{padding:'8px',textAlign:'center',color:'#374151',background:'#fef9c3',minWidth:55}}>DET변경</th>
                          <th style={{padding:'8px',textAlign:'center',color:'#374151',background:'#fef9c3',minWidth:55}}>변경률%</th>
                          <th style={{padding:'8px',textAlign:'center',color:'#374151',background:'#fef9c3',minWidth:55}}>영향계수</th>
                          <th style={{padding:'8px',textAlign:'center',color:'#374151',background:'#f0fdf4',minWidth:55}}>FP점수</th>
                          <th style={{padding:'8px',textAlign:'center',color:'#374151'}}>비고</th>
                          <th style={{padding:'8px',textAlign:'center',color:'#374151'}}>삭제</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fpList.map((f,idx)=>{
                          const c = getComplexity(f.fpType,f.ftr,f.det);
                          const cColor = COMPLEXITY_COLORS[c]||{};
                          const w = fpMethod==='simple'?getAvgWeight(f.fpType):getWeight(f.fpType,f.ftr,f.det);
                          const isChanged = f.reuseType === REUSE_TYPE.CHANGED;
                          const ftrPct = getChangePct(f.ftrChange||0, f.ftr);
                          const detPct = getChangePct(f.detChange||0, f.det);
                          const funcPct = getFuncChangePct(ftrPct, detPct, f.fpType);
                          const impact = getImpactFactor(funcPct);
                          const fpPoint = isChanged ? Math.round(w * impact * 100)/100 : w;
                          const rowValidation = validateFPRowValues(f);
                          return (
                            <tr key={f.id} id={`fp-row-${f.id}`} style={{borderBottom:'1px solid #f3f4f6',background:idx%2===0?'#fff':'#fafafa'}}>
                              {['lv1','lv2','lv3','definition'].map(field=>(
                                <td key={field} style={{padding:'5px 8px'}}>
                                  <input value={f[field]||''} onChange={e=>updateFP(f.id,field,e.target.value)} style={{width:'100%',border:'none',outline:'none',fontSize:11,background:'transparent',minWidth:field==='definition'?150:60}}/>
                                </td>
                              ))}
                              <td style={{padding:'5px 8px',textAlign:'center',background:'#f0f9ff'}}>
                                <select value={f.fpType||'EI'} onChange={e=>updateFP(f.id,'fpType',e.target.value)} style={{border:'1px solid #e5e7eb',borderRadius:4,fontSize:11,padding:'2px 4px',background:'#fff'}}>
                                  {FP_TYPES.map(t=><option key={t}>{t}</option>)}
                                </select>
                              </td>
                              <td style={{padding:'5px 8px',textAlign:'center',background:'#f0f9ff'}}>
                                <input type="number" min="1" max={['ILF','EIF'].includes(f.fpType)?6:5} value={f.ftr??''} onChange={e=>updateFP(f.id,'ftr',Number(e.target.value))} style={{width:40,border:`1px solid ${rowValidation.valid?'#e5e7eb':'#ef4444'}`,borderRadius:4,fontSize:11,padding:'2px 4px',textAlign:'center'}}/>
                              </td>
                              <td style={{padding:'5px 8px',textAlign:'center',background:'#f0f9ff'}}>
                                <input type="number" min="1" value={f.det??''} onChange={e=>updateFP(f.id,'det',Number(e.target.value))} style={{width:40,border:`1px solid ${rowValidation.valid?'#e5e7eb':'#ef4444'}`,borderRadius:4,fontSize:11,padding:'2px 4px',textAlign:'center'}}/>
                              </td>
                              <td style={{padding:'5px 8px',textAlign:'center',background:cColor.bg||'#f9fafb'}}>
                                <span style={{fontWeight:700,color:cColor.color,fontSize:12}}>{cColor.label||'-'}</span>
                              </td>
                              <td style={{padding:'5px 8px',textAlign:'center',background:'#f0f9ff',fontWeight:700,color:'#1d4ed8'}}>{w}</td>
                              <td style={{padding:'5px 8px',textAlign:'center'}}>
                                <select value={f.reuseType||REUSE_TYPE.NEW} onChange={e=>updateFP(f.id,'reuseType',e.target.value)} style={{border:'1px solid #e5e7eb',borderRadius:4,fontSize:10,padding:'2px 4px',background:'#fff'}}>
                                  {REUSE_TYPES.map(t=><option key={t}>{t}</option>)}
                                </select>
                              </td>
                              {/* 변경량 컬럼 - 기능변경일 때만 활성 */}
                              <td style={{padding:'5px 6px',textAlign:'center',background:isChanged?'#fefce8':'#fafafa'}}>
                                <input type="number" value={f.ftrChange||0} onChange={e=>updateFP(f.id,'ftrChange',Number(e.target.value))}
                                  min="0" max={Number(f.ftr)||0}
                                  disabled={!isChanged}
                                  style={{width:38,border:'1px solid #e5e7eb',borderRadius:4,fontSize:11,padding:'2px 3px',textAlign:'center',background:isChanged?'#fff':'#f3f4f6',color:isChanged?'#374151':'#9ca3af'}}/>
                              </td>
                              <td style={{padding:'5px 6px',textAlign:'center',background:isChanged?'#fefce8':'#fafafa'}}>
                                <input type="number" value={f.detChange||0} onChange={e=>updateFP(f.id,'detChange',Number(e.target.value))}
                                  min="0" max={Number(f.det)||0}
                                  disabled={!isChanged}
                                  style={{width:38,border:'1px solid #e5e7eb',borderRadius:4,fontSize:11,padding:'2px 3px',textAlign:'center',background:isChanged?'#fff':'#f3f4f6',color:isChanged?'#374151':'#9ca3af'}}/>
                              </td>
                              <td style={{padding:'5px 6px',textAlign:'center',background:isChanged?'#fefce8':'#fafafa',color:isChanged?'#d97706':'#9ca3af',fontWeight:isChanged?700:400,fontSize:11}}>
                                {isChanged ? `${Math.round(funcPct)}%` : '-'}
                              </td>
                              <td style={{padding:'5px 6px',textAlign:'center',background:isChanged?'#fefce8':'#fafafa',color:isChanged?'#d97706':'#9ca3af',fontWeight:isChanged?700:400,fontSize:11}}>
                                {isChanged ? impact.toFixed(2) : '-'}
                              </td>
                              <td style={{padding:'5px 6px',textAlign:'center',background:f.calculationPending?'#fff7ed':'#f0fdf4',fontWeight:700,color:f.calculationPending?'#c2410c':'#16a34a',fontSize:12}}>
                                {!rowValidation.valid ? (
                                  <span title={rowValidation.errors.join(', ')} style={{fontSize:10}}>합계 제외</span>
                                ) : f.calculationPending ? (
                                  <button onClick={()=>updateFP(f.id,'calculationPending',false)} title="FTR/DET를 검토한 뒤 확정하세요"
                                    style={{border:'1px solid #fdba74',borderRadius:4,background:'#fff',color:'#c2410c',fontSize:10,cursor:'pointer',padding:'2px 4px'}}>수치 확정</button>
                                ) : fpPoint}
                              </td>
                              <td style={{padding:'5px 6px',textAlign:'center'}}>
                                <input value={f.bigo||''} onChange={e=>updateFP(f.id,'bigo',e.target.value)}
                                  style={{width:60,border:'1px solid #e5e7eb',borderRadius:4,fontSize:10,padding:'2px 4px',textAlign:'center'}}
                                  placeholder="-"/>
                              </td>
                              <td style={{padding:'5px 8px',textAlign:'center'}}>
                                <button onClick={()=>{
                                  const updated = fpList.filter(fp=>fp.id!==f.id);
                                  setFpList(updated); saveProject({fpList:updated});
                                }} style={{background:'none',border:'none',color:'#ef4444',cursor:'pointer',fontSize:13}}>✕</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ── 로딩 오버레이 ── */}
      {loading && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{background:'#fff',borderRadius:14,padding:'28px 36px',textAlign:'center',maxWidth:400,width:'90%'}}>
            {parseStep > 0 ? (
              <>
                <div style={{fontSize:28,marginBottom:8}}>📄</div>
                <div style={{fontSize:15,fontWeight:700,color:'#1e3a8a',marginBottom:4}}>기능목록 생성 중...</div>
                <div style={{fontSize:12,color:'#6b7280',marginBottom:14,minHeight:18}}>{loadingMsg}</div>
                <div style={{background:'#e5e7eb',borderRadius:99,height:8,marginBottom:14,overflow:'hidden'}}>
                  <div style={{background:'linear-gradient(90deg,#1d4ed8,#3b82f6)',height:'100%',borderRadius:99,width:`${parsePct}%`,transition:'width 0.4s ease'}}/>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',gap:4}}>
                  {[{n:1,l:'정보추출'},{n:2,l:'요구사항'},{n:3,l:'도메인'},{n:4,l:'기능확장'}].map(s=>(
                    <div key={s.n} style={{flex:1,textAlign:'center'}}>
                      <div style={{width:28,height:28,borderRadius:'50%',margin:'0 auto 4px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,background:parseStep>s.n?'#16a34a':parseStep===s.n?'#1d4ed8':'#e5e7eb',color:parseStep>=s.n?'#fff':'#9ca3af'}}>
                        {parseStep>s.n?'✓':s.n}
                      </div>
                      <div style={{fontSize:9,color:parseStep>=s.n?'#1d4ed8':'#9ca3af',fontWeight:parseStep===s.n?700:400}}>{s.l}</div>
                    </div>
                  ))}
                </div>
                <div style={{fontSize:11,color:'#9ca3af',marginTop:10}}>도메인 수에 따라 수분 소요</div>
                <div style={{fontSize:11,color:'#b45309',background:'#fffbeb',border:'1px solid #fde68a',borderRadius:6,padding:'8px 10px',marginTop:12,lineHeight:1.5}}>
                  다른 탭으로 이동하거나 창을 닫아도 서버에서 계속 진행됩니다.
                </div>
              </>
            ) : (
              <>
                <div style={{fontSize:28,marginBottom:12}}>⚙️</div>
                <div style={{fontSize:14,fontWeight:700,color:'#111827',marginBottom:6}}>처리 중...</div>
                <div style={{fontSize:13,color:'#6b7280'}}>{loadingMsg}</div>
                <div style={{fontSize:11,color:'#b45309',background:'#fffbeb',border:'1px solid #fde68a',borderRadius:6,padding:'8px 10px',marginTop:12,lineHeight:1.5}}>
                  다른 탭으로 이동하거나 창을 닫아도 서버에서 계속 진행됩니다.
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetail;
