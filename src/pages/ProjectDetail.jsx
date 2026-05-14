import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import {
  generateFunctionsFromDoc,
  generateFPList,
  suggestAreas,
  expandArea,
  extractProjectInfo,
  parseDocumentFunctions,
} from '../utils/claudeApi';
import {
  getWeight, getAvgWeight, getComplexity, getComplexityLabel,
  calcTotalFP, getChangePct, getFuncChangePct, getImpactFactor,
} from '../utils/fpCalculator';
import { exportFPExcel, exportCostExcel } from '../utils/excelExport';

// ── 상수 ──────────────────────────────────────────────────────
const FP_TYPES = ['ILF','EIF','EI','EO','EQ'];
const REUSE_TYPES = ['신규개발','기능변경','재사용'];
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

const autoCalcRow = (row, method) => {
  const c = getComplexity(row.fpType, row.ftr, row.det);
  const w = method === 'simple' ? getAvgWeight(row.fpType) : getWeight(row.fpType, row.ftr, row.det);
  const ftrPct = getChangePct(row.ftrChange || 0, row.ftr);
  const detPct = getChangePct(row.detChange || 0, row.det);
  const funcPct = getFuncChangePct(ftrPct, detPct, row.fpType);
  const impact = getImpactFactor(funcPct);
  const fpPoint = row.reuseType === '기능변경' ? Math.round(w * impact * 100) / 100 : w;
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

const ProjectDetail = ({ projects, onUpdateProject }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const project = projects.find(p => p.id === id);

  // ── 탭 ──────────────────────────────────────────────────────
  const [tab, setTab] = useState('setup'); // setup | functions | fp

  // ── 프로젝트 설정 상태 ───────────────────────────────────────
  const [systemName, setSystemName] = useState(project?.systemName || '');
  const [systemOverview, setSystemOverview] = useState(project?.systemOverview || '');
  const [userInput, setUserInput] = useState(project?.userInput || '');
  const [rfpText, setRfpText] = useState(project?.rfpText || '');
  const [uploadedFileName, setUploadedFileName] = useState('');

  // ── 기능목록 상태 ────────────────────────────────────────────
  const [functions, setFunctions] = useState(project?.functions || []);
  const [fpMethod, setFpMethod] = useState('standard');

  // ── FP 산정 상태 ────────────────────────────────────────────
  const [fpList, setFpList] = useState(project?.fpList || []);
  const [showValidation, setShowValidation] = useState(false);

  // ── 개발비 상태 ──────────────────────────────────────────────
  const [showCostPanel, setShowCostPanel] = useState(false);
  const [costMethod, setCostMethod] = useState('정통법');
  const [costLinkIdx, setCostLinkIdx] = useState(2);
  const [costPerfIdx, setCostPerfIdx] = useState(2);
  const [costEnvIdx, setCostEnvIdx] = useState(1);
  const [costSecIdx, setCostSecIdx] = useState(1);
  const [costUnitPrice, setCostUnitPrice] = useState(605784);
  const [costProfitRate, setCostProfitRate] = useState(10);
  const [costDirectExp, setCostDirectExp] = useState(0);
  const [costReverseMode, setCostReverseMode] = useState(false);
  const [costTargetBudget, setCostTargetBudget] = useState('');

  // ── 영역 추가 상태 ───────────────────────────────────────────
  const [showAreaPanel, setShowAreaPanel] = useState(false);
  const [areaSuggestions, setAreaSuggestions] = useState(null);
  const [selectedAreas, setSelectedAreas] = useState([]);
  const [customArea, setCustomArea] = useState('');
  const [areaTargetCount, setAreaTargetCount] = useState('');

  // ── 로딩 상태 ────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [parseStep, setParseStep] = useState(0);
  const [parsePct, setParsePct] = useState(0);

  const saveProject = useCallback((updates) => {
    if (onUpdateProject) onUpdateProject(id, updates);
  }, [id, onUpdateProject]);

  if (!project) return (
    <div style={{display:'flex',justifyContent:'center',alignItems:'center',height:'100vh',flexDirection:'column',gap:16}}>
      <p style={{fontSize:15,color:'#374151'}}>프로젝트를 찾을 수 없습니다.</p>
      <button onClick={()=>navigate('/ba')} style={S.btn('#1d4ed8')}>목록으로</button>
    </div>
  );

  // ── PDF 텍스트 추출 ──────────────────────────────────────────
  const extractPdfText = async (file) => {
    const pdfjsLib = await import('pdfjs-dist/build/pdf');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
    const ab = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(item => item.str).join(' ') + '\n';
    }
    return text;
  };

  // ── 파일 읽기 ────────────────────────────────────────────────
  const readFile = async (file) => {
    if (file.name.endsWith('.pdf')) return await extractPdfText(file);
    if (file.name.endsWith('.docx')) {
      const ab = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer: ab });
      return result.value;
    }
    if (file.name.endsWith('.txt')) return await file.text();
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      // xlsx는 기능정의서 직접 파싱
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      // 병합셀 처리
      const merges = ws['!merges'] || [];
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      const cellMap = {};
      for (let R = range.s.r; R <= range.e.r; R++)
        for (let C = range.s.c; C <= range.e.c; C++) {
          const addr = XLSX.utils.encode_cell({r:R,c:C});
          cellMap[`${R}_${C}`] = ws[addr]?.v ?? null;
        }
      for (const m of merges) {
        const v = cellMap[`${m.s.r}_${m.s.c}`];
        for (let R = m.s.r; R <= m.e.r; R++)
          for (let C = m.s.c; C <= m.e.c; C++)
            cellMap[`${R}_${C}`] = v;
      }
      // 컬럼 자동 탐지
      const totalCols = range.e.c - range.s.c + 1;
      const colStats = [];
      for (let C = 0; C < totalCols; C++) {
        const vals = new Set();
        let nn = 0;
        for (let R = 1; R <= Math.min(range.e.r, 200); R++) {
          const v = cellMap[`${R}_${C}`];
          if (v != null && String(v).trim()) { nn++; vals.add(String(v).trim()); }
        }
        colStats.push({c:C,nonNull:nn,unique:vals.size});
      }
      const valid = colStats.filter(s=>s.nonNull>=10).sort((a,b)=>a.unique-b.unique);
      const lv1C = valid[0]?.c??1, lv2C = valid[1]?.c??2, lv3C = valid[2]?.c??3, defC = valid[3]?.c??4;
      const seen = new Set();
      const funcs = [];
      for (let R = 1; R <= range.e.r; R++) {
        const lv1 = String(cellMap[`${R}_${lv1C}`]||'').trim();
        const lv2 = String(cellMap[`${R}_${lv2C}`]||'').trim();
        const lv3 = String(cellMap[`${R}_${lv3C}`]||'').trim();
        const def = String(cellMap[`${R}_${defC}`]||'').trim();
        if (!lv1||!lv2||!lv3) continue;
        if (def.endsWith('데이터정보')||lv3.endsWith('데이터정보')) continue;
        if (lv1==='LV1'||lv1==='대분류') continue;
        const key = `${lv1}|${lv2}|${lv3}`;
        if (seen.has(key)) continue;
        seen.add(key);
        funcs.push({lv1,lv2,lv3,definition:def||`${lv3}을 처리한다`});
      }
      return { isXlsx: true, functions: funcs };
    }
    throw new Error('HWP는 PDF로 변환 후 업로드하세요.');
  };

  // ── 파일 업로드 핸들러 ───────────────────────────────────────
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    setLoading(true);
    setLoadingMsg('파일 읽는 중...');
    try {
      const result = await readFile(file);
      setUploadedFileName(file.name);

      // xlsx 기능정의서 → 바로 기능목록으로
      if (result?.isXlsx) {
        if (result.functions.length > 0) {
          const withId = result.functions.map((f,i)=>({...f,id:Date.now()+i}));
          setFunctions(withId);
          saveProject({functions:withId});
          alert(`✅ 기능정의서 파싱 완료!\n${withId.length}개 기능 추출`);
          setTab('functions');
        }
        return;
      }

      // 텍스트 문서 → rfpText에 저장
      const text = result;
      const rfpFull = text.slice(0, 20000);
      setRfpText(rfpFull);
      saveProject({rfpText: rfpFull});

      // 시스템 정보 자동 추출
      setLoadingMsg('시스템 정보 추출 중...');
      const info = await extractProjectInfo(text.slice(0,3000));
      if (info.systemName && !systemName) { setSystemName(info.systemName); saveProject({systemName:info.systemName}); }
      if (info.systemOverview && !systemOverview) { setSystemOverview(info.systemOverview); saveProject({systemOverview:info.systemOverview}); }
      alert(`✅ 파일 업로드 완료!\n"시스템명, 개요"를 확인하고 필요하면 수정 후 "기능 생성" 버튼을 눌러주세요.`);
    } catch (err) {
      alert('파일 읽기 오류: ' + err.message);
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  };

  // ── 기능 생성 핸들러 ─────────────────────────────────────────
  const handleGenerate = async () => {
    if (!rfpText && !userInput.trim()) {
      return alert('파일을 업로드하거나 시스템 설명을 입력해주세요.');
    }
    setLoading(true);
    setParseStep(0);
    setParsePct(0);
    try {
      const text = rfpText || userInput;
      const result = await generateFunctionsFromDoc(
        text,
        userInput,
        (step, msg, pct) => {
          setParseStep(step);
          setLoadingMsg(msg);
          setParsePct(pct);
        }
      );
      if (result.systemName && !systemName) setSystemName(result.systemName);
      if (result.overview && !systemOverview) setSystemOverview(result.overview);

      const withId = (result.functions||[]).map((f,i)=>({...f,id:Date.now()+i}));
      setFunctions(withId);
      setParseStep(0);
      saveProject({
        functions: withId,
        systemName: result.systemName || systemName,
        systemOverview: result.overview || systemOverview,
        rfpText,
        userInput,
      });
      setTab('functions');
      alert(`✅ 기능 생성 완료!\n총 ${withId.length}개 기능목록 생성`);
    } catch (err) {
      alert('기능 생성 오류: ' + err.message);
    } finally {
      setLoading(false);
      setLoadingMsg('');
      setParseStep(0);
      setParsePct(0);
    }
  };

  // ── 영역 제안 핸들러 ─────────────────────────────────────────
  const handleSuggestAreas = async () => {
    if (functions.length === 0) return alert('먼저 기능목록을 생성해주세요.');
    const target = Number(areaTargetCount) || functions.length + 100;
    setLoading(true);
    setLoadingMsg('AI가 추가 가능한 업무 영역 분석 중...');
    try {
      const result = await suggestAreas(systemName, rfpText, functions, target);
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
      ...selectedAreas.map(i => areaSuggestions.suggestions[i]),
      ...(customArea.trim() ? [{ lv1: customArea.trim(), description: `${customArea.trim()} 관련 기능`, expectedFunctions: 20, sampleLv2: [] }] : []),
    ].filter(Boolean);

    if (areasToExpand.length === 0) return alert('추가할 영역을 선택해주세요.');

    setLoading(true);
    let currentFunctions = [...functions];
    let totalAdded = 0;

    try {
      for (let i = 0; i < areasToExpand.length; i++) {
        const area = areasToExpand[i];
        setLoadingMsg(`[${i+1}/${areasToExpand.length}] "${area.lv1}" 기능 생성 중...`);
        try {
          const newFuncs = await expandArea(area, systemName, currentFunctions);
          const withId = newFuncs.map((f,j)=>({...f,id:Date.now()+totalAdded+j}));
          currentFunctions = [...currentFunctions, ...withId];
          totalAdded += withId.length;
          setFunctions([...currentFunctions]);
          saveProject({functions: currentFunctions});
        } catch (e) {
          console.warn(`"${area.lv1}" 실패:`, e.message);
        }
        if (i < areasToExpand.length - 1) await new Promise(r => setTimeout(r, 3000));
      }
      setAreaSuggestions(null);
      setSelectedAreas([]);
      setCustomArea('');
      setShowAreaPanel(false);
      alert(`✅ ${totalAdded}개 추가 완료!\n총 ${currentFunctions.length}개 기능`);
    } catch (err) {
      alert('영역 추가 오류: ' + err.message);
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  };

  // ── FP 행 업데이트 ───────────────────────────────────────────
  const updateFP = (id, field, value) => {
    const updated = fpList.map(f => {
      if (f.id !== id) return f;
      const newRow = { ...f, [field]: value };
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
    const totalChunks = Math.ceil(functions.length / 5);
    setLoading(true);
    setLoadingMsg(`FP 산정 중... (0/${totalChunks})`);
    try {
      const result = await generateFPList(functions, (cur, total) => {
        setLoadingMsg(`FP 산정 중... (${cur}/${total})`);
      });
      const withId = result.map((f,i) => autoCalcRow({...f, id:Date.now()+i, ftrChange:0, detChange:0, bigo:'-'}, fpMethod));
      setFpList(withId);
      const summary = calcTotalFP(withId, fpMethod);
      saveProject({fpList:withId, fpSummary:summary});
      setTab('fp');
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
    return issues;
  };

  // ── FP 요약 계산 ────────────────────────────────────────────
  const stdSummary = calcTotalFP(fpList, 'standard');
  const simpleSummary = calcTotalFP(fpList, 'simple');

  // ── 개발비 계산 ──────────────────────────────────────────────
  const costCalc = () => {
    const s = calcTotalFP(fpList, fpMethod==='정통법'?'standard':'simple');
    const rawFP = Number(s.newDev) + Number(s.changed);
    const tFP = costMethod==='간이법' ? rawFP*1.286 : rawFP;
    const sC = calcSizeCoeff(tFP);
    const tC = sC*COST_LINK[costLinkIdx].v*COST_PERF[costPerfIdx].v*COST_ENV[costEnvIdx].v*COST_SEC[costSecIdx].v;
    const dev = Math.round(tFP*costUnitPrice*tC);
    const tot = Math.round(dev*(1+costProfitRate/100)+Number(costDirectExp||0));
    const revFP = costReverseMode&&costTargetBudget ? Math.round((Number(costTargetBudget)-Number(costDirectExp||0))/(costUnitPrice*tC*(1+costProfitRate/100))) : 0;
    return {tFP, sC, tC, dev, tot, revFP};
  };

  const fmt = n => Math.round(n).toLocaleString();
  const fmtB = n => (n/1e8).toFixed(2)+'억원';

  // ── 렌더링 ───────────────────────────────────────────────────
  const TAB_LABELS = [
    {key:'setup', label:'📋 프로젝트 설정'},
    {key:'functions', label:`⚙️ 기능목록 ${functions.length>0?`(${functions.length})`:''}`.trim()},
    {key:'fp', label:`📊 FP 산정표 ${fpList.length>0?`(${fpList.length})`:''}`.trim()},
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
                    {['정통법','간이법'].map(m=><button key={m} onClick={()=>setCostMethod(m)} style={{padding:'4px 12px',fontSize:11,fontWeight:600,border:'1px solid '+(costMethod===m?'#1d4ed8':'#e5e7eb'),borderRadius:5,cursor:'pointer',background:costMethod===m?'#1d4ed8':'#fff',color:costMethod===m?'#fff':'#374151'}}>{m}</button>)}
                  </div>
                  <div style={{fontSize:10,color:'#6b7280',marginBottom:2}}>단가(원/FP)</div>
                  <input type="number" value={costUnitPrice} onChange={e=>setCostUnitPrice(Number(e.target.value))} style={{...inp,marginBottom:6}}/>
                  <div style={{fontSize:10,color:'#6b7280',marginBottom:2}}>이윤율(%)</div>
                  <input type="number" value={costProfitRate} onChange={e=>setCostProfitRate(Number(e.target.value))} style={{...inp,marginBottom:6}}/>
                  <div style={{fontSize:10,color:'#6b7280',marginBottom:2}}>직접경비(원)</div>
                  <input type="number" value={costDirectExp} onChange={e=>setCostDirectExp(Number(e.target.value))} style={inp}/>
                </div>
                <div style={{minWidth:210}}>
                  <div style={{fontSize:10,color:'#6b7280',marginBottom:2}}>연계복잡성</div><select value={costLinkIdx} onChange={e=>setCostLinkIdx(Number(e.target.value))} style={sel}>{COST_LINK.map((c,i)=><option key={i} value={i}>{c.l} ({c.v})</option>)}</select>
                  <div style={{fontSize:10,color:'#6b7280',marginBottom:2}}>성능 요구수준</div><select value={costPerfIdx} onChange={e=>setCostPerfIdx(Number(e.target.value))} style={sel}>{COST_PERF.map((c,i)=><option key={i} value={i}>{c.l} ({c.v})</option>)}</select>
                  <div style={{fontSize:10,color:'#6b7280',marginBottom:2}}>운영환경 호환성</div><select value={costEnvIdx} onChange={e=>setCostEnvIdx(Number(e.target.value))} style={sel}>{COST_ENV.map((c,i)=><option key={i} value={i}>{c.l} ({c.v})</option>)}</select>
                  <div style={{fontSize:10,color:'#6b7280',marginBottom:2}}>보안성</div><select value={costSecIdx} onChange={e=>setCostSecIdx(Number(e.target.value))} style={sel}>{COST_SEC.map((c,i)=><option key={i} value={i}>{c.l} ({c.v})</option>)}</select>
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
                        totalFP:tFP, fpSummary:{newDev:stdSummary.newDev,changed:stdSummary.changed},
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
                  <button onClick={()=>setCostReverseMode(v=>!v)} style={{padding:'5px 12px',fontSize:11,fontWeight:600,border:'none',borderRadius:5,cursor:'pointer',background:costReverseMode?'#f59e0b':'#e5e7eb',color:costReverseMode?'#fff':'#374151',marginBottom:8}}>
                    🔄 예산역산 {costReverseMode?'ON':'OFF'}
                  </button>
                  {costReverseMode&&<>
                    <input type="number" value={costTargetBudget} onChange={e=>setCostTargetBudget(e.target.value)} placeholder="목표예산(원)" style={{padding:'5px 8px',border:'1px solid #e5e7eb',borderRadius:5,fontSize:12,width:'100%',marginBottom:5}}/>
                    <div style={{display:'flex',gap:3,flexWrap:'wrap',marginBottom:6}}>
                      {[[5,5e9],[10,1e10],[20,2e10],[30,3e10],[50,5e10],[70,7e10],[100,1e11]].map(([l,v])=>(
                        <button key={l} onClick={()=>setCostTargetBudget(String(v))} style={{fontSize:10,padding:'2px 7px',borderRadius:8,background:'#f3f4f6',color:'#374151',border:'1px solid #e5e7eb',cursor:'pointer'}}>{l}억</button>
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

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              탭1: 프로젝트 설정
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {tab === 'setup' && (
            <div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginBottom:20}}>
                {/* 파일 업로드 */}
                <div style={S.card}>
                  <div style={S.cardHeader}>
                    <span style={{fontSize:14,fontWeight:700,color:'#374151'}}>📁 파일 업로드</span>
                    {uploadedFileName && <span style={S.tag('#dcfce7','#16a34a')}>✅ {uploadedFileName}</span>}
                  </div>
                  <div style={{padding:'16px 20px'}}>
                    <p style={{fontSize:12,color:'#6b7280',marginBottom:12}}>RFP 또는 기능정의서를 업로드하면 AI가 자동으로 분석합니다.</p>
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      {[
                        {icon:'📑', label:'RFP / 제안요청서', desc:'PDF, DOCX, TXT', accept:'.pdf,.docx,.txt'},
                        {icon:'📋', label:'기능정의서 (Excel)', desc:'XLSX - LV1/LV2/LV3 자동 파싱', accept:'.xlsx,.xls'},
                        {icon:'📄', label:'기타 문서', desc:'시스템 설명 문서', accept:'.pdf,.docx,.txt'},
                      ].map(item=>(
                        <label key={item.label} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',border:'1px dashed #e5e7eb',borderRadius:8,cursor:'pointer',background:'#f9fafb',transition:'border-color 0.2s'}}
                          onMouseEnter={e=>e.currentTarget.style.borderColor='#3b82f6'}
                          onMouseLeave={e=>e.currentTarget.style.borderColor='#e5e7eb'}>
                          <input type="file" accept={item.accept} onChange={handleFileUpload} style={{display:'none'}}/>
                          <span style={{fontSize:20}}>{item.icon}</span>
                          <div>
                            <div style={{fontSize:13,fontWeight:600,color:'#374151'}}>{item.label}</div>
                            <div style={{fontSize:11,color:'#9ca3af'}}>{item.desc}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                    {rfpText && (
                      <div style={{marginTop:12,background:'#eff6ff',borderRadius:7,padding:'8px 12px',fontSize:11,color:'#1d4ed8'}}>
                        ✅ RFP 저장됨 ({Math.round(rfpText.length/1000)}KB)
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
                    <div style={{fontSize:16,fontWeight:700,color:'#fff',marginBottom:4}}>✨ AI 기능목록 생성</div>
                    <div style={{fontSize:12,color:'rgba(255,255,255,0.7)'}}>
                      파일과 입력 내용을 분석해서 정확한 기능목록을 생성합니다.
                      시간이 걸려도 정확도를 최우선으로 합니다.
                    </div>
                    {functions.length>0 && <div style={{marginTop:6,fontSize:11,color:'#93c5fd'}}>현재 {functions.length}개 기능 있음 — 재생성하면 덮어쓰기 됩니다</div>}
                  </div>
                  <button onClick={handleGenerate} style={{...S.btn('#fff','#1e3a8a'),padding:'12px 28px',fontSize:14,flexShrink:0}}>
                    🚀 기능 생성 시작
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              탭2: 기능목록
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {tab === 'functions' && (
            <div>
              {/* 헤더 */}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:8}}>
                <p style={{fontSize:14,color:'#6b7280',margin:0}}>총 {functions.length}개 기능 · 셀 클릭하여 수정 가능</p>
                <div style={{display:'flex',gap:8}}>
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
                    <div style={{display:'flex',gap:8,alignItems:'center'}}>
                      <input type="number" value={areaTargetCount} onChange={e=>setAreaTargetCount(e.target.value)}
                        placeholder="목표 기능 수" style={{...S.input,width:120}}/>
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
                              </div>
                            </label>
                          ))}
                        </div>
                        <div style={{display:'flex',gap:8,alignItems:'center'}}>
                          <input value={customArea} onChange={e=>setCustomArea(e.target.value)}
                            placeholder="직접 입력: 추가할 업무 영역명" style={{...S.input,flex:1}}/>
                          <button onClick={handleExpandAreas}
                            disabled={selectedAreas.length===0 && !customArea.trim()}
                            style={S.btn('#7c3aed')}>
                            선택 영역 기능 생성 ({selectedAreas.length + (customArea.trim()?1:0)}개 영역)
                          </button>
                        </div>
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
                          {['LV1','LV2','LV3','기능 정의','삭제'].map(h=>(
                            <th key={h} style={{padding:'10px 12px',textAlign:'left',fontWeight:600,color:'#374151',whiteSpace:'nowrap'}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {functions.map((f,idx)=>(
                          <tr key={f.id} style={{borderBottom:'1px solid #f3f4f6',background:idx%2===0?'#fff':'#fafafa'}}>
                            {(['lv1','lv2','lv3','definition']).map(field=>(
                              <td key={field} style={{padding:'6px 8px'}}>
                                <input value={f[field]||''} onChange={e=>{
                                  const updated = functions.map(fn=>fn.id===f.id?{...fn,[field]:e.target.value}:fn);
                                  setFunctions(updated); saveProject({functions:updated});
                                }} style={{width:'100%',border:'none',outline:'none',fontSize:12,background:'transparent',minWidth:field==='definition'?200:80}}/>
                              </td>
                            ))}
                            <td style={{padding:'6px 8px',textAlign:'center'}}>
                              <button onClick={()=>{
                                const updated = functions.filter(fn=>fn.id!==f.id);
                                setFunctions(updated); saveProject({functions:updated});
                              }} style={{background:'none',border:'none',color:'#ef4444',cursor:'pointer',fontSize:14}}>✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              탭3: FP 산정표
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {tab === 'fp' && (
            <div>
              {/* 헤더 */}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap',gap:8}}>
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  <p style={{fontSize:14,color:'#6b7280',margin:0}}>총 {fpList.length}개</p>
                  <div style={{display:'flex',gap:4}}>
                    {['standard','simple'].map(m=>(
                      <button key={m} onClick={()=>{
                        setFpMethod(m);
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
                    const newRow = autoCalcRow({id:Date.now(),lv1:'',lv2:'',lv3:'',definition:'',fpType:'EI',ftr:1,det:5,reuseType:'신규개발',ftrChange:0,detChange:0,bigo:'-'},fpMethod);
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
                          <th style={{padding:'8px',textAlign:'center',color:'#374151'}}>삭제</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fpList.map((f,idx)=>{
                          const c = getComplexity(f.fpType,f.ftr,f.det);
                          const cColor = COMPLEXITY_COLORS[c]||{};
                          const w = fpMethod==='simple'?getAvgWeight(f.fpType):getWeight(f.fpType,f.ftr,f.det);
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
                                <input type="number" value={f.ftr||1} onChange={e=>updateFP(f.id,'ftr',Number(e.target.value))} style={{width:40,border:'1px solid #e5e7eb',borderRadius:4,fontSize:11,padding:'2px 4px',textAlign:'center'}}/>
                              </td>
                              <td style={{padding:'5px 8px',textAlign:'center',background:'#f0f9ff'}}>
                                <input type="number" value={f.det||5} onChange={e=>updateFP(f.id,'det',Number(e.target.value))} style={{width:40,border:'1px solid #e5e7eb',borderRadius:4,fontSize:11,padding:'2px 4px',textAlign:'center'}}/>
                              </td>
                              <td style={{padding:'5px 8px',textAlign:'center',background:cColor.bg||'#f9fafb'}}>
                                <span style={{fontWeight:700,color:cColor.color,fontSize:12}}>{cColor.label||'-'}</span>
                              </td>
                              <td style={{padding:'5px 8px',textAlign:'center',background:'#f0f9ff',fontWeight:700,color:'#1d4ed8'}}>{w}</td>
                              <td style={{padding:'5px 8px',textAlign:'center'}}>
                                <select value={f.reuseType||'신규개발'} onChange={e=>updateFP(f.id,'reuseType',e.target.value)} style={{border:'1px solid #e5e7eb',borderRadius:4,fontSize:10,padding:'2px 4px',background:'#fff'}}>
                                  {REUSE_TYPES.map(t=><option key={t}>{t}</option>)}
                                </select>
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
                <div style={{fontSize:11,color:'#9ca3af',marginTop:10}}>Tier1 API — 도메인 수에 따라 수분 소요</div>
              </>
            ) : (
              <>
                <div style={{fontSize:28,marginBottom:12}}>⚙️</div>
                <div style={{fontSize:14,fontWeight:700,color:'#111827',marginBottom:6}}>처리 중...</div>
                <div style={{fontSize:13,color:'#6b7280'}}>{loadingMsg}</div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetail;
