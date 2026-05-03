import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { generateFunctions, generateFPList, parseDocument, parseSystemInfo } from '../utils/claudeApi';
import { getWeight, getAvgWeight, getComplexity, getComplexityLabel, calcTotalFP, getChangePct, getFuncChangePct, getImpactFactor } from '../utils/fpCalculator';
import mammoth from 'mammoth';

const REUSE_TYPES = ['신규개발', '기능변경', '기능삭제', '수정없이재사용'];
const FP_TYPES = ['EI', 'EO', 'EQ', 'ILF', 'EIF'];
const BIGO_TYPES = ['-', '고도화', '신규'];

const REUSE_COLORS = {
  신규개발: { bg: '#fce7f3', color: '#9d174d' },
  기능변경: { bg: '#dbeafe', color: '#1e40af' },
  기능삭제: { bg: '#f3f4f6', color: '#374151' },
  수정없이재사용: { bg: '#fef9c3', color: '#854d0e' },
};

const COMPLEXITY_COLORS = {
  low: { bg: '#f0fdf4', color: '#16a34a' },
  medium: { bg: '#fff7ed', color: '#ea580c' },
  high: { bg: '#fef2f2', color: '#dc2626' },
};

// ============================================================
// 자동 계산 함수 (가이드 공식 기준)
// ============================================================

// FTR 변경률 = FTR변경량 / FTR전체 × 100
const calcFtrChangePct = (ftrChange, ftr) => {
  const f = Number(ftr);
  const fc = Number(ftrChange);
  if (!f || f === 0) return 0;
  return Number(((fc / f) * 100).toFixed(1));
};

// DET 변경률 = DET변경량 / DET전체 × 100
const calcDetChangePct = (detChange, det) => {
  const d = Number(det);
  const dc = Number(detChange);
  if (!d || d === 0) return 0;
  return Number(((dc / d) * 100).toFixed(1));
};

// 기능 변경률 = (FTR변경률 + DET변경률) / 2
const calcFuncChangePct = (ftrPct, detPct) => {
  return Number(((Number(ftrPct) + Number(detPct)) / 2).toFixed(1));
};

// 영향계수 (기능변경률 기준)
const calcImpactFactor = (funcPct) => {
  const p = Number(funcPct);
  if (p <= 25) return 0.25;
  if (p <= 50) return 0.50;
  if (p <= 75) return 0.75;
  return 1.00;
};

// 재사용 기능점수 = 가중치 × 영향계수 (기능변경일 때만)
const calcReuseScore = (weight, reuseType, impactFactor) => {
  if (reuseType === '기능변경') {
    return Number((Number(weight) * Number(impactFactor)).toFixed(2));
  }
  if (reuseType === '신규개발') return Number(weight);
  if (reuseType === '수정없이재사용') return 0;
  if (reuseType === '기능삭제') return 0;
  return 0;
};

// 행 전체 자동 계산 (FTR/DET/변경량 입력 시 자동 갱신)
const autoCalcRow = (row, method = 'standard') => {
  const weight = method === 'simple'
    ? getAvgWeight(row.fpType)
    : getWeight(row.fpType, row.ftr, row.det);

  if (row.reuseType === '기능변경') {
    const ftrChangePct = calcFtrChangePct(row.ftrChange, row.ftr);
    const detChangePct = calcDetChangePct(row.detChange, row.det);
    const funcChangePct = calcFuncChangePct(ftrChangePct, detChangePct);
    const impactFactor = calcImpactFactor(funcChangePct);
    const reuseScore = calcReuseScore(weight, row.reuseType, impactFactor);
    return { ...row, ftrChangePct, detChangePct, funcChangePct, impactFactor, reuseScore, weight };
  }

  const reuseScore = calcReuseScore(weight, row.reuseType, 1);
  return { ...row, ftrChangePct: 0, detChangePct: 0, funcChangePct: 0, impactFactor: 0, reuseScore, weight };
};

const ProjectDetail = ({ projects, onUpdateProject }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const project = projects.find((p) => p.id === id);

  const [tab, setTab] = useState('setup');
  const [fpMethod, setFpMethod] = useState('standard');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');

  const [inputMethod, setInputMethod] = useState('direct');
  const [systemName, setSystemName] = useState(project?.systemName || '');
  const [systemOverview, setSystemOverview] = useState(project?.systemOverview || '');
  const [mainFunctions, setMainFunctions] = useState(project?.mainFunctions || '');
  const [relatedOrgs, setRelatedOrgs] = useState(project?.relatedOrgs || '');
  const [keyword, setKeyword] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploadedFuncFileName, setUploadedFuncFileName] = useState('');

  const [functions, setFunctions] = useState(project?.functions || []);
  const [fpList, setFpList] = useState(project?.fpList || []);
  const [screenList, setScreenList] = useState(project?.screenList || []);
  const [screenLoading, setScreenLoading] = useState(false);
  const [reqList, setReqList] = useState(project?.reqList || []);
  const [reqLoading, setReqLoading] = useState(false);
  const [crudMatrix, setCrudMatrix] = useState(() => {
    const saved = project?.crudMatrix;
    if (saved && Array.isArray(saved.matrix)) return saved;
    return { entities: [], matrix: [] };
  });
  const [crudLoading, setCrudLoading] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [ifList, setIfList] = useState(project?.ifList || []);
  const [ifLoading, setIfLoading] = useState(false);
  const [wbsList, setWbsList] = useState(project?.wbsList || []);
  const [wbsLoading, setWbsLoading] = useState(false);
  const [traceList, setTraceList] = useState(project?.traceList || []);
  const [traceLoading, setTraceLoading] = useState(false);
  const [tcList, setTcList] = useState(project?.tcList || []);
  const [tcLoading, setTcLoading] = useState(false);
  const [asisList, setAsisList] = useState(project?.asisList || []);
  const [asisLoading, setAsisLoading] = useState(false);

  // ============================================================
  // 4. FP 검증 기능
  // ============================================================
  const validateFP = () => {
    const issues = [];
    const lv3Names = fpList.map(f => f.lv3?.trim()).filter(Boolean);
    const duplicates = lv3Names.filter((name, i) => lv3Names.indexOf(name) !== i);
    [...new Set(duplicates)].forEach(name => {
      issues.push({ severity: 'error', type: '중복 기능', message: `"${name}" 기능이 중복 식별됩니다.` });
    });

    fpList.forEach((f, i) => {
      const rowNum = i + 1;
      const name = f.lv3 || `${rowNum}번째 행`;
      const lv3 = (f.lv3 || '').toLowerCase();

      if ((lv3.includes('등록') || lv3.includes('수정') || lv3.includes('삭제') || lv3.includes('승인')) && f.fpType === 'EQ') {
        issues.push({ severity: 'warning', type: 'FP유형 의심', message: `"${name}": 등록/수정/삭제는 EI가 맞습니다. (현재: EQ)` });
      }
      if ((lv3.includes('조회') || lv3.includes('검색') || lv3.includes('목록')) && f.fpType === 'EI') {
        issues.push({ severity: 'warning', type: 'FP유형 의심', message: `"${name}": 조회/검색/목록은 EQ가 맞습니다. (현재: EI)` });
      }
      if ((lv3.includes('통계') || lv3.includes('보고서') || lv3.includes('집계')) && f.fpType === 'EQ') {
        issues.push({ severity: 'warning', type: 'FP유형 의심', message: `"${name}": 통계/보고서/집계는 EO가 맞습니다. (현재: EQ)` });
      }

      const det = Number(f.det);
      const ftr = Number(f.ftr);
      if (det < 2) issues.push({ severity: 'warning', type: 'DET 이상치', message: `"${name}": DET=${det} (최소 2 이상 권장)` });
      if (det > 50 && ['EI','EQ'].includes(f.fpType)) issues.push({ severity: 'info', type: 'DET 검토', message: `"${name}": DET=${det} (50 초과, 검토 필요)` });
      if (ftr === 0 && ['EI','EO','EQ'].includes(f.fpType)) issues.push({ severity: 'error', type: 'FTR 오류', message: `"${name}": FTR=0은 불가합니다. (최소 1 이상)` });
      if (f.fpType === 'EIF' && f.reuseType === '기능변경') issues.push({ severity: 'error', type: 'EIF 오류', message: `"${name}": EIF는 기능변경 측정 대상이 아닙니다.` });
      if (!f.lv3?.trim()) issues.push({ severity: 'error', type: '필수값 누락', message: `${rowNum}번째 행: LV3(단위프로세스명)이 비어있습니다.` });
    });

    const ilfCount = fpList.filter(f => f.fpType === 'ILF').length;
    const eifCount = fpList.filter(f => f.fpType === 'EIF').length;
    const maxFtr = fpList.filter(f => ['EI','EO','EQ'].includes(f.fpType)).reduce((max, f) => Math.max(max, Number(f.ftr)), 0);
    if (maxFtr > ilfCount + eifCount && fpList.length > 0) {
      issues.push({ severity: 'info', type: 'FTR 검토', message: `최대 FTR(${maxFtr}) > ILF+EIF 수(${ilfCount + eifCount}). ILF/EIF가 누락됐을 수 있습니다.` });
    }

    return issues;
  };

  if (!project) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p>프로젝트를 찾을 수 없습니다.</p>
        <button onClick={() => navigate('/')}>목록으로</button>
      </div>
    );
  }

  const systemInfo = `시스템명: ${systemName}\n시스템개요: ${systemOverview}\n주요기능: ${mainFunctions}\n관련기관: ${relatedOrgs}`;

  const extractPdfText = async (file) => {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item) => item.str).join(' ') + '\n';
    }
    return text;
  };

  const isImageFile = (file) => file && (
    file.type === 'image/png' || file.type === 'image/jpeg' ||
    file.name.toLowerCase().endsWith('.png') ||
    file.name.toLowerCase().endsWith('.jpg') ||
    file.name.toLowerCase().endsWith('.jpeg')
  );

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadedFileName(file.name);
    setLoading(true);
    setLoadingMsg('파일 읽는 중...');
    try {
      let text = '';
      let imageFile = null;
      if (isImageFile(file)) {
        imageFile = file;
      } else if (file.name.endsWith('.pdf')) {
        text = await extractPdfText(file);
      } else if (file.name.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const arrayBuffer = await file.arrayBuffer();
        const wb = XLSX.read(arrayBuffer);
        const ws = wb.Sheets[wb.SheetNames[0]];
        text = XLSX.utils.sheet_to_csv(ws);
      }
      setLoadingMsg('AI가 시스템 정보 분석 중...');
      const info = await parseSystemInfo(text, imageFile);
      if (info.systemName) setSystemName(info.systemName);
      if (info.overview) setSystemOverview(info.overview);
      if (info.mainFunctions) setMainFunctions(Array.isArray(info.mainFunctions) ? info.mainFunctions.join(', ') : info.mainFunctions);
      if (info.relatedOrgs) setRelatedOrgs(Array.isArray(info.relatedOrgs) ? info.relatedOrgs.join(', ') : info.relatedOrgs);
      alert('파일 분석 완료! 내용을 확인하고 키워드를 입력하세요.');
    } catch (err) {
      alert('오류: ' + err.message);
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  };

  const handleFuncDefUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadedFuncFileName(file.name);
    setLoading(true);
    setLoadingMsg('기능정의서 파싱 중...');
    try {
      let text = '';
      let imageFile = null;
      if (isImageFile(file)) {
        imageFile = file;
      } else if (file.name.endsWith('.pdf')) {
        text = await extractPdfText(file);
      } else if (file.name.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const arrayBuffer = await file.arrayBuffer();
        const wb = XLSX.read(arrayBuffer);
        const ws = wb.Sheets[wb.SheetNames[0]];
        text = XLSX.utils.sheet_to_csv(ws);
      }
      setLoadingMsg('AI가 기능 목록 추출 중...');
      const parsed = await parseDocument(text, imageFile);
      const withId = parsed.map((f, i) => ({ ...f, id: Date.now() + i }));
      setFunctions(withId);
      setTab('functions');
      saveProject({ functions: withId });
      alert('기능정의서 파싱 완료! 기능 목록을 확인하세요.');
    } catch (err) {
      alert('오류: ' + err.message);
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  };

  const handleGenerateFunctions = async () => {
    if (!keyword.trim()) return alert('키워드를 입력하세요.');

    // E. AI 재생성 경고
    if (functions.length > 0) {
      const ok = window.confirm(`기존 기능 목록 ${functions.length}개가 있습니다.\nAI 재생성 시 기존 데이터가 덮어쓰기 됩니다.\n계속하시겠습니까?`);
      if (!ok) return;
    }

    // C. 여러 키워드 일괄 생성 지원
    const keywords = keyword.split(/[,，\s]+/).map(k => k.trim()).filter(k => k);

    setLoading(true);
    setLoadingMsg(`AI가 기능 목록 생성 중... (키워드 ${keywords.length}개)`);
    try {
      saveProject({ systemName, systemOverview, mainFunctions, relatedOrgs });
      let allFunctions = [];
      for (let i = 0; i < keywords.length; i++) {
        setLoadingMsg(`AI가 기능 목록 생성 중... (${i + 1}/${keywords.length}: ${keywords[i]})`);
        const result = await generateFunctions(systemInfo, keywords[i]);
        allFunctions = [...allFunctions, ...result];
      }
      const withId = allFunctions.map((f, i) => ({ ...f, id: Date.now() + i }));
      setFunctions(withId);
      setTab('functions');
      saveProject({ functions: withId, systemName, systemOverview, mainFunctions, relatedOrgs });
    } catch (err) {
      alert('오류: ' + err.message);
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  };

  const handleGenerateFP = async () => {
    if (functions.length === 0) return alert('기능 목록을 먼저 생성하세요.');

    // E. AI 재생성 경고
    if (fpList.length > 0) {
      const ok = window.confirm(`기존 FP 산정표 ${fpList.length}개가 있습니다.\nAI 재산정 시 기존 데이터가 덮어쓰기 됩니다.\n계속하시겠습니까?`);
      if (!ok) return;
    }
    setLoading(true);
    setLoadingMsg('AI가 FP 산정 중...');
    try {
      const result = await generateFPList(functions);
      const withId = result.map((f, i) => {
        const base = {
          ...f,
          id: Date.now() + i,
          ftr: Number(f.ftr) || 1,
          det: Number(f.det) || 5,
          ftrChange: 0,
          detChange: 0,
          bigo: '-',
        };
        return autoCalcRow(base, fpMethod);
      });
      setFpList(withId);
      setTab('fp');
      const summary = calcTotalFP(withId, fpMethod);
      saveProject({ fpList: withId, fpSummary: summary });
    } catch (err) {
      alert('오류: ' + err.message);
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  };

  const saveProject = (updates) => onUpdateProject(id, updates);

  const updateFunction = (fid, field, value) => {
    const updated = functions.map((f) => f.id === fid ? { ...f, [field]: value } : f);
    setFunctions(updated);
    saveProject({ functions: updated });
  };

  const addFunction = () => {
    const updated = [...functions, { id: Date.now(), lv1: '', lv2: '', lv3: '', definition: '' }];
    setFunctions(updated);
    saveProject({ functions: updated });
  };

  const deleteFunction = (fid) => {
    const updated = functions.filter((f) => f.id !== fid);
    setFunctions(updated);
    saveProject({ functions: updated });
  };

  // FP 행 수정 - 자동 계산 포함
  const updateFP = (fid, field, value) => {
    const updated = fpList.map((f) => {
      if (f.id !== fid) return f;
      const newRow = { ...f, [field]: value };
      return autoCalcRow(newRow, fpMethod);
    });
    setFpList(updated);
    const summary = calcTotalFP(updated, fpMethod);
    saveProject({ fpList: updated, fpSummary: summary });
  };

  const addFPRow = () => {
    const base = { id: Date.now(), lv1: '', lv2: '', lv3: '', definition: '', fpType: 'EQ', ftr: 1, det: 5, reuseType: '신규개발', ftrChange: 0, detChange: 0, bigo: '-' };
    const newRow = autoCalcRow(base, fpMethod);
    const updated = [...fpList, newRow];
    setFpList(updated);
    saveProject({ fpList: updated });
  };

  const deleteFPRow = (fid) => {
    const updated = fpList.filter((f) => f.id !== fid);
    setFpList(updated);
    const summary = calcTotalFP(updated, fpMethod);
    saveProject({ fpList: updated, fpSummary: summary });
  };

  // 정통법/간이법 토글 시 전체 재계산
  const toggleMethod = (method) => {
    setFpMethod(method);
    const updated = fpList.map((f) => autoCalcRow(f, method));
    setFpList(updated);
    const summary = calcTotalFP(updated, method);
    saveProject({ fpList: updated, fpSummary: summary });
  };

  const stdSummary = calcTotalFP(fpList, 'standard');
  const simpleSummary = calcTotalFP(fpList, 'simple');

  // B. 전체 Excel 일괄 출력
  const exportAllExcel = () => {
    const wb = XLSX.utils.book_new();

    // 시트1: 기능목록
    if (functions.length > 0) {
      const funcRows = functions.map(f => ({ 'LV1': f.lv1, 'LV2': f.lv2, 'LV3': f.lv3, '기능정의': f.definition }));
      const ws1 = XLSX.utils.json_to_sheet(funcRows);
      ws1['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 25 }, { wch: 50 }];
      XLSX.utils.book_append_sheet(wb, ws1, '기능목록');
    }

    // 시트2: FP산정표
    if (fpList.length > 0) {
      const fpRows = fpList.map((f) => {
        const stdWeight = getWeight(f.fpType, f.ftr, f.det);
        const avgWeight = getAvgWeight(f.fpType);
        const complexity = getComplexity(f.fpType, f.ftr, f.det);
        return {
          'LV1': f.lv1, 'LV2': f.lv2, 'LV3': f.lv3,
          '단위프로세스 설명': f.definition,
          'FP유형': f.fpType, 'FTR': f.ftr, 'DET': f.det,
          '복잡도': getComplexityLabel(complexity),
          '정통법 가중치': stdWeight, '간이법 가중치': avgWeight,
          '재사용유형': f.reuseType,
          'FTR변경량': f.ftrChange || '', 'DET변경량': f.detChange || '',
          'FTR변경률(%)': f.reuseType === '기능변경' ? f.ftrChangePct : '',
          'DET변경률(%)': f.reuseType === '기능변경' ? f.detChangePct : '',
          '기능변경률(%)': f.reuseType === '기능변경' ? f.funcChangePct : '',
          '영향계수': f.reuseType === '기능변경' ? f.impactFactor : '',
          '재사용기능점수': f.reuseScore || '', '비고': f.bigo || '',
        };
      });
      const ws2 = XLSX.utils.json_to_sheet(fpRows);
      XLSX.utils.book_append_sheet(wb, ws2, 'FP산정표');

      // FP 요약
      const summaryRows = [
        { '구분': '정통법 신규개발', 'FP합계': stdSummary.newDev },
        { '구분': '정통법 기능변경', 'FP합계': stdSummary.changed },
        { '구분': '간이법 신규개발', 'FP합계': simpleSummary.newDev },
        { '구분': '간이법 기능변경', 'FP합계': simpleSummary.changed },
        { '구분': '기능삭제', 'FP합계': '측정 비대상' },
      ];
      const ws2s = XLSX.utils.json_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, ws2s, 'FP요약');
    }

    // 시트3: 화면목록
    if (screenList.length > 0) {
      const screenRows = screenList.map(s => ({
        '화면ID': s.screenId, '화면명': s.screenName, '화면유형': s.screenType,
        'LV1': s.lv1, 'LV2': s.lv2, '관련기능': s.relatedFunctions, '비고': s.note || '',
      }));
      const ws3 = XLSX.utils.json_to_sheet(screenRows);
      ws3['!cols'] = [{ wch: 12 }, { wch: 25 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 40 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, ws3, '화면목록');
    }

    // 시트4: 요구사항정의서
    if (reqList.length > 0) {
      const reqRows = reqList.map(r => ({
        '요구사항ID': r.reqId, '유형': r.type, '요구사항명': r.reqName,
        '상세내용': r.detail, '관련화면': r.relatedScreen,
        '우선순위': r.priority, '비고': r.note || '',
      }));
      const ws4 = XLSX.utils.json_to_sheet(reqRows);
      ws4['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 25 }, { wch: 50 }, { wch: 12 }, { wch: 10 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, ws4, '요구사항정의서');
    }

    // 시트5: CRUD 분석
    if ((crudMatrix.matrix || []).length > 0) {
      const entities = crudMatrix.entities || [];
      const crudRows = (crudMatrix.matrix || []).map(f => ({
        'LV1': f.lv1, 'LV2': f.lv2, 'LV3': f.lv3,
        ...Object.fromEntries(entities.map(e => [e, f.crud?.[e] || ''])),
      }));
      const ws5 = XLSX.utils.json_to_sheet(crudRows);
      XLSX.utils.book_append_sheet(wb, ws5, 'CRUD분석');
    }

    // 시트6: 인터페이스 정의서
    if (ifList.length > 0) {
      const ifRows = ifList.map(f => ({
        '인터페이스ID': f.ifId, '인터페이스명': f.ifName,
        '송신시스템': f.sendSystem, '수신시스템': f.receiveSystem,
        '연동방식': f.method, '연동주기': f.cycle,
        '주요데이터항목': f.dataItems, '비고': f.note || '',
      }));
      const ws6 = XLSX.utils.json_to_sheet(ifRows);
      ws6['!cols'] = [{ wch: 14 }, { wch: 25 }, { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 40 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, ws6, '인터페이스정의서');
    }

    // 시트7: WBS
    if (wbsList.length > 0) {
      const wbsRows = wbsList.map(w => ({
        'WBS ID': w.wbsId, '단계': w.phase, '작업명': w.task,
        'LV1': w.lv1, 'LV2': w.lv2,
        '공수(일)': w.workDays, '담당자': w.role, '비고': w.note || '',
      }));
      const ws7 = XLSX.utils.json_to_sheet(wbsRows);
      ws7['!cols'] = [{ wch: 8 }, { wch: 10 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, ws7, 'WBS');
    }

    // 시트8: 요구사항 추적표
    if (traceList.length > 0) {
      const traceRows = traceList.map(t => ({
        '요구사항ID': t.reqId, '요구사항명': t.reqName,
        '관련기능': t.relatedFunctions, '관련화면': t.relatedScreens,
        '테스트케이스ID': t.testId, '상태': t.status,
      }));
      const ws8 = XLSX.utils.json_to_sheet(traceRows);
      ws8['!cols'] = [{ wch: 12 }, { wch: 25 }, { wch: 30 }, { wch: 20 }, { wch: 14 }, { wch: 10 }];
      XLSX.utils.book_append_sheet(wb, ws8, '요구사항추적표');
    }

    // 시트9: 테스트케이스
    if (tcList.length > 0) {
      const tcRows = tcList.map(t => ({
        'TC ID': t.tcId, '요구사항ID': t.reqId, '테스트케이스명': t.tcName,
        '유형': t.type, '사전조건': t.precondition,
        '테스트절차': t.steps, '기대결과': t.expected, '결과': t.result,
      }));
      const ws9 = XLSX.utils.json_to_sheet(tcRows);
      ws9['!cols'] = [{ wch: 10 }, { wch: 10 }, { wch: 30 }, { wch: 8 }, { wch: 20 }, { wch: 40 }, { wch: 30 }, { wch: 10 }];
      XLSX.utils.book_append_sheet(wb, ws9, '테스트케이스');
    }

    // 시트10: AS-IS/TO-BE
    if (asisList.length > 0) {
      const asisRows = asisList.map(a => ({
        'LV1': a.lv1, 'LV2': a.lv2,
        'AS-IS(현행)': a.asIs,
        'TO-BE(목표)': a.toBe,
        '기대효과': a.improvement,
        '변화유형': a.changeType,
      }));
      const ws10 = XLSX.utils.json_to_sheet(asisRows);
      ws10['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 40 }, { wch: 40 }, { wch: 30 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, ws10, 'AS-IS_TO-BE');
    }

    if (wb.SheetNames.length === 0) {
      alert('출력할 데이터가 없습니다. 먼저 기능목록을 생성하세요.');
      return;
    }

    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf]), project.name + '_전체산출물.xlsx');
  };

  const exportExcel = () => {
    const rows = fpList.map((f) => {
      const stdWeight = getWeight(f.fpType, f.ftr, f.det);
      const avgWeight = getAvgWeight(f.fpType);
      const complexity = getComplexity(f.fpType, f.ftr, f.det);
      return {
        'LV1': f.lv1, 'LV2': f.lv2, 'LV3': f.lv3,
        '단위프로세스 설명': f.definition,
        'FP유형': f.fpType, 'FTR': f.ftr, 'DET': f.det,
        '복잡도': getComplexityLabel(complexity),
        '정통법 가중치': stdWeight,
        '간이법 가중치': avgWeight,
        '재사용유형': f.reuseType,
        'FTR변경량': f.ftrChange || '',
        'DET변경량': f.detChange || '',
        'FTR변경률(%)': f.reuseType === '기능변경' ? f.ftrChangePct : '',
        'DET변경률(%)': f.reuseType === '기능변경' ? f.detChangePct : '',
        '기능변경률(%)': f.reuseType === '기능변경' ? f.funcChangePct : '',
        '영향계수': f.reuseType === '기능변경' ? f.impactFactor : '',
        '재사용기능점수': f.reuseScore || '',
        '비고': f.bigo || '',
      };
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'FP산정');
    const summaryData = [
      { '구분': '정통법 신규개발', 'FP합계': stdSummary.newDev },
      { '구분': '정통법 기능변경', 'FP합계': stdSummary.changed },
      { '구분': '간이법 신규개발', 'FP합계': simpleSummary.newDev },
      { '구분': '간이법 기능변경', 'FP합계': simpleSummary.changed },
      { '구분': '기능삭제', 'FP합계': '측정 비대상' },
    ];
    const ws2 = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws2, 'FP요약');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf]), project.name + '_FP산정.xlsx');
  };

  const inputStyle = { width: '100%', padding: '7px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, outline: 'none', boxSizing: 'border-box' };
  const cellStyle = { padding: '5px 6px', borderBottom: '1px solid #e5e7eb', fontSize: 12, verticalAlign: 'middle' };

  // 화면목록 AI 자동 생성
  const handleGenerateScreens = async () => {
    if (functions.length === 0) return alert('기능 목록을 먼저 생성하세요.');
    setScreenLoading(true);
    try {
      const response = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `당신은 SW사업 BA 전문가입니다.
아래 기능 목록을 분석하여 화면 목록을 생성하세요.

기능 목록:
${JSON.stringify(functions.map(f => ({ lv1: f.lv1, lv2: f.lv2, lv3: f.lv3, definition: f.definition })), null, 2)}

규칙:
- 관련 기능들을 묶어서 화면 단위로 정의
- 목록조회+검색조건 → 목록 화면 1개
- 상세조회+수정+삭제 → 상세/수정 화면 1개
- 등록 → 등록 화면 1개 (단순하면 상세화면과 통합 가능)
- 화면ID: SCR-001 형식 (LV2 그룹별로 묶어서 순번)
- 화면유형: 목록화면/상세화면/등록화면/팝업/대시보드 중 선택
- 관련기능: 해당 화면에서 수행하는 LV3 기능명 나열

반드시 아래 JSON만 응답 (다른 텍스트 없이):
{"screens":[{"screenId":"SCR-001","screenName":"화면명","screenType":"화면유형","lv1":"LV1명","lv2":"LV2명","relatedFunctions":"관련기능 목록","note":"비고"}]}`
          }]
        }),
      });
      const data = await response.json();
      const text = data.content.map(c => c.type === 'text' ? c.text : '').join('');
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      const parsed = JSON.parse(text.slice(start, end + 1));
      const withId = (parsed.screens || []).map((s, i) => ({ ...s, id: Date.now() + i }));
      setScreenList(withId);
      saveProject({ screenList: withId });
    } catch (err) {
      alert('오류: ' + err.message);
    } finally {
      setScreenLoading(false);
    }
  };

  const updateScreen = (sid, field, value) => {
    const updated = screenList.map(s => s.id === sid ? { ...s, [field]: value } : s);
    setScreenList(updated);
    saveProject({ screenList: updated });
  };

  const addScreen = () => {
    const nextNum = String(screenList.length + 1).padStart(3, '0');
    const updated = [...screenList, { id: Date.now(), screenId: 'SCR-' + nextNum, screenName: '', screenType: '목록화면', lv1: '', lv2: '', relatedFunctions: '', note: '' }];
    setScreenList(updated);
    saveProject({ screenList: updated });
  };

  const deleteScreen = (sid) => {
    const updated = screenList.filter(s => s.id !== sid);
    setScreenList(updated);
    saveProject({ screenList: updated });
  };

  const exportScreenExcel = () => {
    const rows = screenList.map(s => ({
      '화면ID': s.screenId,
      '화면명': s.screenName,
      '화면유형': s.screenType,
      'LV1': s.lv1,
      'LV2': s.lv2,
      '관련기능': s.relatedFunctions,
      '비고': s.note || '',
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 12 }, { wch: 25 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 40 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ws, '화면목록');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf]), project.name + '_화면목록.xlsx');
  };

  const SCREEN_TYPES = ['목록화면', '상세화면', '등록화면', '수정화면', '팝업', '대시보드', '보고서', '기타'];

  // 요구사항 AI 자동 생성
  const handleGenerateRequirements = async () => {
    if (functions.length === 0) return alert('기능 목록을 먼저 생성하세요.');
    setReqLoading(true);
    try {
      const response = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `당신은 SW사업 BA 전문가입니다.
아래 기능 목록과 화면 목록을 분석하여 요구사항 정의서를 생성하세요.

기능 목록:
${JSON.stringify(functions.map(f => ({ lv1: f.lv1, lv2: f.lv2, lv3: f.lv3, definition: f.definition })), null, 2)}

화면 목록:
${JSON.stringify(screenList.map(s => ({ screenId: s.screenId, screenName: s.screenName })), null, 2)}

규칙:
1. 기능 요구사항(FR): 각 LV3 기능별로 1~2개 생성
   - "시스템은 ~할 수 있어야 한다" 형식
   - 관련 화면ID 연결
2. 비기능 요구사항(NFR): 성능/보안/가용성/사용성 각 1~2개
   - 응답시간, 동시접속, 보안, 가용성 등
3. 제약사항(CON): 기술/환경 제약 1~2개
4. 우선순위: 상/중/하

반드시 아래 JSON만 응답 (다른 텍스트 없이):
{"requirements":[{"reqId":"FR-001","type":"기능","reqName":"요구사항명","detail":"상세내용 (~해야 한다 형식)","relatedScreen":"SCR-001","priority":"상","note":""}]}`
          }]
        }),
      });
      const data = await response.json();
      const text = data.content.map(c => c.type === 'text' ? c.text : '').join('');
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      const parsed = JSON.parse(text.slice(start, end + 1));
      const withId = (parsed.requirements || []).map((r, i) => ({ ...r, id: Date.now() + i }));
      setReqList(withId);
      saveProject({ reqList: withId });
    } catch (err) {
      alert('오류: ' + err.message);
    } finally {
      setReqLoading(false);
    }
  };

  const updateReq = (rid, field, value) => {
    const updated = reqList.map(r => r.id === rid ? { ...r, [field]: value } : r);
    setReqList(updated);
    saveProject({ reqList: updated });
  };

  const addReq = () => {
    const frCount = reqList.filter(r => r.type === '기능').length;
    const nextNum = String(frCount + 1).padStart(3, '0');
    const updated = [...reqList, { id: Date.now(), reqId: 'FR-' + nextNum, type: '기능', reqName: '', detail: '', relatedScreen: '', priority: '중', note: '' }];
    setReqList(updated);
    saveProject({ reqList: updated });
  };

  const deleteReq = (rid) => {
    const updated = reqList.filter(r => r.id !== rid);
    setReqList(updated);
    saveProject({ reqList: updated });
  };

  const exportReqExcel = () => {
    const rows = reqList.map(r => ({
      '요구사항ID': r.reqId,
      '유형': r.type,
      '요구사항명': r.reqName,
      '상세내용': r.detail,
      '관련화면': r.relatedScreen,
      '우선순위': r.priority,
      '비고': r.note || '',
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 25 }, { wch: 50 }, { wch: 12 }, { wch: 10 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ws, '요구사항정의서');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf]), project.name + '_요구사항정의서.xlsx');
  };

  const REQ_TYPES = ['기능', '비기능', '제약사항'];
  const PRIORITIES = ['상', '중', '하'];
  const TYPE_COLORS = {
    기능: { bg: '#eff6ff', color: '#1e40af' },
    비기능: { bg: '#f0fdf4', color: '#166534' },
    제약사항: { bg: '#fff7ed', color: '#9a3412' },
  };
  const PRIORITY_COLORS = {
    상: { bg: '#fef2f2', color: '#dc2626' },
    중: { bg: '#fff7ed', color: '#ea580c' },
    하: { bg: '#f8fafc', color: '#6b7280' },
  };

  // CRUD 분석 AI 자동 생성
  const handleGenerateCRUD = async () => {
    if (functions.length === 0) return alert('기능 목록을 먼저 생성하세요.');
    setCrudLoading(true);
    try {
      const response = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `당신은 SW사업 DA 전문가입니다.
아래 기능 목록을 분석하여 CRUD 분석 매트릭스를 생성하세요.

기능 목록:
${JSON.stringify(functions.map(f => ({ lv1: f.lv1, lv2: f.lv2, lv3: f.lv3, definition: f.definition })), null, 2)}

규칙:
1. 기능목록에서 사용되는 엔티티(테이블)를 추출
2. 각 기능(LV3)이 각 엔티티에 대해 C/R/U/D 중 어떤 작업을 하는지 분석
   - C: Create (등록/생성)
   - R: Read (조회/검색)
   - U: Update (수정/변경)
   - D: Delete (삭제)
3. 해당 없으면 빈값("")
4. 여러 작업이면 조합 가능 (예: "CR", "RU")
5. ILF는 내부 엔티티, EIF는 외부 엔티티로 구분

반드시 아래 JSON만 응답 (다른 텍스트 없이):
{"entities":["엔티티1","엔티티2"],"matrix":[{"lv1":"","lv2":"","lv3":"","crud":{"엔티티1":"C","엔티티2":"R"}}]}`
          }]
        }),
      });
      const data = await response.json();
      const text = data.content.map(c => c.type === 'text' ? c.text : '').join('');
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      const parsed = JSON.parse(text.slice(start, end + 1));
      setCrudMatrix(parsed);
      saveProject({ crudMatrix: parsed });
    } catch (err) {
      alert('오류: ' + err.message);
    } finally {
      setCrudLoading(false);
    }
  };

  const addEntity = () => {
    const name = prompt('엔티티명 입력:');
    if (!name) return;
    const updated = {
      ...crudMatrix,
      entities: [...(crudMatrix.entities || []), name],
    };
    setCrudMatrix(updated);
    saveProject({ crudMatrix: updated });
  };

  const updateCrud = (funcIdx, entity, value) => {
    const updatedMatrix = [...(crudMatrix.matrix || [])];
    if (!updatedMatrix[funcIdx].crud) updatedMatrix[funcIdx].crud = {};
    updatedMatrix[funcIdx].crud[entity] = value;
    const updated = { ...crudMatrix, matrix: updatedMatrix };
    setCrudMatrix(updated);
    saveProject({ crudMatrix: updated });
  };

  const exportCrudExcel = () => {
    const entities = crudMatrix.entities || [];
    const matrix = crudMatrix.matrix || [];
    const header = ['LV1', 'LV2', 'LV3', ...entities];
    const rows = matrix.map(f => ({
      LV1: f.lv1,
      LV2: f.lv2,
      LV3: f.lv3,
      ...Object.fromEntries(entities.map(e => [e, f.crud?.[e] || ''])),
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows, { header });
    ws['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 25 }, ...entities.map(() => ({ wch: 10 }))];
    XLSX.utils.book_append_sheet(wb, ws, 'CRUD분석');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf]), project.name + '_CRUD분석.xlsx');
  };

  const CRUD_COLORS = {
    C: { bg: '#dcfce7', color: '#166534' },
    R: { bg: '#dbeafe', color: '#1e40af' },
    U: { bg: '#fef9c3', color: '#854d0e' },
    D: { bg: '#fee2e2', color: '#dc2626' },
  };
  const numInput = (value, onChange, width = 45) => (
    <input
      type="number"
      value={value || 0}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ width, border: '1px solid #d1d5db', borderRadius: 4, padding: '2px 4px', fontSize: 12, textAlign: 'center' }}
    />
  );
  const readOnlyCell = (value, unit = '') => (
    <div style={{ textAlign: 'center', fontWeight: 600, color: '#374151', fontSize: 12 }}>
      {value !== undefined && value !== null && value !== '' ? value + unit : '-'}
    </div>
  );

  return (
    <div style={{ maxWidth: 1800, margin: '0 auto', padding: '24px 16px' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 20 }}>←</button>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{project.name}</h2>
            <div style={{ display: 'flex', align: 'center', gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>
                💾 자동저장됨 · {new Date(project.updatedAt || project.createdAt).toLocaleString('ko-KR')}
              </span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ background: '#f0f4ff', border: '1px solid #c7d2fe', borderRadius: 8, padding: '6px 12px', fontSize: 12 }}>
            <div style={{ fontWeight: 700, color: '#3730a3', marginBottom: 4 }}>정통법</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ background: '#fce7f3', color: '#9d174d', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>신규 {stdSummary.newDev} FP</span>
              <span style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>변경 {stdSummary.changed} FP</span>
            </div>
          </div>
          <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '6px 12px', fontSize: 12 }}>
            <div style={{ fontWeight: 700, color: '#166534', marginBottom: 4 }}>간이법</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ background: '#fce7f3', color: '#9d174d', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>신규 {simpleSummary.newDev} FP</span>
              <span style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>변경 {simpleSummary.changed} FP</span>
            </div>
          </div>
          <button onClick={exportExcel} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Excel 출력
          </button>
          <button onClick={exportAllExcel} style={{ background: '#0891b2', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            📦 전체 출력
          </button>
          <button onClick={() => navigate('/project/' + id + '/cost')} style={{ background: '#7e22ce', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            💰 개발비 산출
          </button>
        </div>
      </div>

      {/* 탭 - 스크롤 가능 */}
      <div style={{ position: 'relative', marginBottom: 24 }}>
        <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '2px solid #e5e7eb', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {[
            { key: 'setup', label: '① 시스템개요', icon: '📋' },
            { key: 'functions', label: '② 기능목록', icon: '📝', count: functions.length },
            { key: 'fp', label: '③ FP산정표', icon: '📊', count: fpList.length },
            { key: 'screens', label: '④ 화면목록', icon: '🖥️', count: screenList.length },
            { key: 'requirements', label: '⑤ 요구사항', icon: '📌', count: reqList.length },
            { key: 'crud', label: '⑥ CRUD', icon: '🗃️' },
            { key: 'interface', label: '⑦ 인터페이스', icon: '🔗', count: ifList.length },
            { key: 'wbs', label: '⑧ WBS', icon: '📅', count: wbsList.length },
            { key: 'traceability', label: '⑨ 추적표', icon: '🔎', count: traceList.length },
            { key: 'testcase', label: '⑩ 테스트', icon: '🧪', count: tcList.length },
            { key: 'asis', label: '⑪ AS-IS/TO-BE', icon: '🔄' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '8px 14px', fontSize: 12, fontWeight: 600, border: 'none',
                background: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                borderBottom: tab === t.key ? '2px solid #2563eb' : '2px solid transparent',
                color: tab === t.key ? '#2563eb' : '#6b7280', marginBottom: -2,
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
              {t.count > 0 && (
                <span style={{ background: tab === t.key ? '#2563eb' : '#e5e7eb', color: tab === t.key ? '#fff' : '#6b7280', borderRadius: 10, padding: '0 5px', fontSize: 10, fontWeight: 700 }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 로딩 */}
      {loading && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '32px 48px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>⚙️</div>
            <p style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>{loadingMsg}</p>
            <p style={{ color: '#6b7280', fontSize: 13 }}>잠시만 기다려주세요...</p>
          </div>
        </div>
      )}

      {/* ① 시스템 개요 */}
      {tab === 'setup' && (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            {[{ key: 'direct', label: '직접 입력' }, { key: 'file', label: '파일 업로드 (시스템개요)' }, { key: 'funcdef', label: '기능정의서 바로 업로드' }].map((m) => (
              <button key={m.key} onClick={() => setInputMethod(m.key)} style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', background: inputMethod === m.key ? '#2563eb' : '#f3f4f6', color: inputMethod === m.key ? '#fff' : '#374151', border: 'none' }}>
                {m.label}
              </button>
            ))}
          </div>

          {inputMethod === 'direct' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 700 }}>
              {[
                { label: '시스템명', value: systemName, setter: setSystemName, placeholder: '예) 국방연동관리체계(DIMS)' },
                { label: '시스템 개요', value: systemOverview, setter: setSystemOverview, placeholder: '시스템 개요를 입력하세요', multi: true },
                { label: '주요기능', value: mainFunctions, setter: setMainFunctions, placeholder: '예) 연동계획, 연동운영, 연동관제, 체계운영, 체계관리' },
                { label: '관련기관', value: relatedOrgs, setter: setRelatedOrgs, placeholder: '예) 국방부, 국방전산정보원' },
              ].map((item) => (
                <div key={item.label}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>{item.label}</label>
                  {item.multi ? (
                    <textarea value={item.value} onChange={(e) => item.setter(e.target.value)} placeholder={item.placeholder} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                  ) : (
                    <input value={item.value} onChange={(e) => item.setter(e.target.value)} placeholder={item.placeholder} style={inputStyle} />
                  )}
                </div>
              ))}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                  키워드 입력 <span style={{ color: '#6b7280', fontWeight: 400 }}>(쉼표로 구분하면 여러 키워드 한번에 생성)</span>
                </label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input value={keyword} onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleGenerateFunctions()} placeholder="예: 연동계획, 연동운영, 체계관리" style={{ ...inputStyle, flex: 1 }} />
                  <button onClick={handleGenerateFunctions} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    AI 기능목록 생성
                  </button>
                </div>
                <p style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                  💡 여러 키워드를 쉼표로 구분하면 한번에 생성됩니다. 예: "연동계획, 연동운영, 연동관제"
                </p>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  {['연동계획', '연동운영', '연동관제', '체계운영', '체계관리'].map((kw) => (
                    <button key={kw} onClick={() => setKeyword(kw)} style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', cursor: 'pointer' }}>{kw}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {inputMethod === 'file' && (
            <div style={{ maxWidth: 500 }}>
              <p style={{ fontSize: 14, color: '#374151', marginBottom: 12 }}>
                시스템 개요 문서를 업로드하면 AI가 자동으로 분석합니다.<br />
                <span style={{ color: '#ef4444', fontSize: 12 }}>※ HWP는 PDF로 변환 후 업로드하세요.</span>
              </p>
              <label style={{ display: 'block', border: '2px dashed #93c5fd', borderRadius: 10, padding: '32px', textAlign: 'center', cursor: 'pointer', background: '#eff6ff' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
                <p style={{ fontWeight: 600, color: '#2563eb' }}>PDF / DOCX / Excel / PNG / JPG 업로드</p>
                <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>클릭하여 파일 선택</p>
                <input type="file" accept=".pdf,.docx,.xlsx,.xls,.png,.jpg,.jpeg" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>
              {uploadedFileName && (
                <div style={{ marginTop: 12, padding: '10px 14px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #86efac', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>📎</span><span style={{ fontSize: 13, fontWeight: 500, color: '#16a34a' }}>{uploadedFileName}</span>
                  <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 'auto' }}>업로드 완료</span>
                </div>
              )}
              {(systemName || systemOverview) && (
                <div style={{ marginTop: 16, padding: 16, background: '#f0fdf4', borderRadius: 8, border: '1px solid #86efac' }}>
                  <p style={{ fontWeight: 600, color: '#16a34a', marginBottom: 8 }}>✅ 파싱 완료</p>
                  <p style={{ fontSize: 13 }}>시스템명: {systemName}</p>
                  <p style={{ fontSize: 13 }}>주요기능: {mainFunctions}</p>
                  <div style={{ marginTop: 12 }}>
                    <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="키워드 입력" style={{ ...inputStyle, marginBottom: 8 }} />
                    <button onClick={handleGenerateFunctions} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                      AI 기능목록 생성
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {inputMethod === 'funcdef' && (
            <div style={{ maxWidth: 500 }}>
              <p style={{ fontSize: 14, color: '#374151', marginBottom: 12 }}>
                기능정의서를 업로드하면 LV1~LV3를 자동 추출합니다.<br />
                <span style={{ color: '#6b7280', fontSize: 12 }}>PDF / DOCX / Excel / PNG / JPG 지원</span>
              </p>
              <label style={{ display: 'block', border: '2px dashed #86efac', borderRadius: 10, padding: '32px', textAlign: 'center', cursor: 'pointer', background: '#f0fdf4' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                <p style={{ fontWeight: 600, color: '#16a34a' }}>기능정의서 업로드</p>
                <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>PDF / DOCX / Excel / PNG / JPG</p>
                <input type="file" accept=".pdf,.docx,.xlsx,.xls,.png,.jpg,.jpeg" onChange={handleFuncDefUpload} style={{ display: 'none' }} />
              </label>
              {uploadedFuncFileName && (
                <div style={{ marginTop: 12, padding: '10px 14px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #86efac', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>📎</span><span style={{ fontSize: 13, fontWeight: 500, color: '#16a34a' }}>{uploadedFuncFileName}</span>
                  <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 'auto' }}>업로드 완료</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ② 기능 목록 */}
      {tab === 'functions' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p style={{ fontSize: 14, color: '#6b7280' }}>총 {functions.length}개 기능 · 셀 클릭하여 수정 가능</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={addFunction} style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 6, padding: '7px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>+ 행 추가</button>
              <button onClick={handleGenerateFP} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>AI FP 산정 →</button>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['LV1', 'LV2', 'LV3', '기능 정의', '삭제'].map((h) => (
                    <th key={h} style={{ ...cellStyle, fontWeight: 600, textAlign: 'left', color: '#374151', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {functions.map((f) => (
                  <tr key={f.id}>
                    {['lv1', 'lv2', 'lv3'].map((field) => (
                      <td key={field} style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                        <input value={f[field] || ''} onChange={(e) => updateFunction(f.id, field, e.target.value)} style={{ width: '100%', border: 'none', outline: 'none', fontSize: 13, background: 'transparent', padding: '2px 4px', minWidth: 80 }} />
                      </td>
                    ))}
                    <td style={{ ...cellStyle, minWidth: 300 }}>
                      <textarea value={f.definition || ''} onChange={(e) => updateFunction(f.id, 'definition', e.target.value)} rows={2} style={{ width: '100%', border: 'none', outline: 'none', fontSize: 13, background: 'transparent', padding: '2px 4px', resize: 'vertical', fontFamily: 'inherit' }} />
                    </td>
                    <td style={cellStyle}>
                      <button onClick={() => deleteFunction(f.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16 }}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ③ FP 산정표 */}
      {tab === 'fp' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>총 {fpList.length}개 · FTR/DET 수정 시 자동 계산</p>
              <div style={{ display: 'flex', border: '1px solid #d1d5db', borderRadius: 8, overflow: 'hidden' }}>
                <button onClick={() => toggleMethod('standard')} style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: fpMethod === 'standard' ? '#2563eb' : '#fff', color: fpMethod === 'standard' ? '#fff' : '#374151' }}>정통법</button>
                <button onClick={() => toggleMethod('simple')} style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: fpMethod === 'simple' ? '#16a34a' : '#fff', color: fpMethod === 'simple' ? '#fff' : '#374151' }}>간이법</button>
              </div>
              {fpMethod === 'simple' && (
                <span style={{ fontSize: 11, color: '#6b7280', background: '#f0fdf4', padding: '2px 8px', borderRadius: 4 }}>EI=4.0 EO=5.2 EQ=3.9 ILF=7.5 EIF=5.4</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowValidation(!showValidation)}
                style={{ background: showValidation ? '#fef2f2' : '#fff7ed', color: showValidation ? '#dc2626' : '#ea580c', border: `1px solid ${showValidation ? '#fca5a5' : '#fdba74'}`, borderRadius: 6, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                {showValidation ? '검증 닫기' : '🔍 FP 검증'}
              </button>
              <button onClick={addFPRow} style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 6, padding: '7px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>+ 행 추가</button>
            </div>
          </div>

          {/* 검증 결과 */}
          {showValidation && (() => {
            const issues = validateFP();
            const errors = issues.filter(i => i.severity === 'error');
            const warnings = issues.filter(i => i.severity === 'warning');
            const infos = issues.filter(i => i.severity === 'info');
            return (
              <div style={{ marginBottom: 16, border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', background: issues.length === 0 ? '#f0fdf4' : errors.length > 0 ? '#fef2f2' : '#fff7ed', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 18 }}>{issues.length === 0 ? '✅' : errors.length > 0 ? '❌' : '⚠️'}</span>
                  <span style={{ fontWeight: 700, fontSize: 14, color: issues.length === 0 ? '#166534' : errors.length > 0 ? '#dc2626' : '#ea580c' }}>
                    {issues.length === 0 ? 'FP 산정이 정확합니다!' : `총 ${issues.length}개 항목 검토 필요 (오류 ${errors.length}, 경고 ${warnings.length}, 정보 ${infos.length})`}
                  </span>
                </div>
                {issues.length > 0 && (
                  <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {issues.map((issue, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '6px 10px', borderRadius: 6, background: issue.severity === 'error' ? '#fef2f2' : issue.severity === 'warning' ? '#fff7ed' : '#eff6ff' }}>
                        <span style={{ fontSize: 14, flexShrink: 0 }}>{issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️'}</span>
                        <div>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 4, marginRight: 6, background: issue.severity === 'error' ? '#fee2e2' : issue.severity === 'warning' ? '#fef9c3' : '#dbeafe', color: issue.severity === 'error' ? '#dc2626' : issue.severity === 'warning' ? '#854d0e' : '#1e40af' }}>
                            {issue.type}
                          </span>
                          <span style={{ fontSize: 12, color: '#374151' }}>{issue.message}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* 범례 */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 12, fontSize: 11, color: '#6b7280' }}>
            <span style={{ background: '#f9fafb', padding: '2px 8px', borderRadius: 4 }}>🔵 파란 배경 = 자동 계산 (읽기 전용)</span>
            <span>FTR변경량/DET변경량 입력 시 변경률·영향계수·재사용기능점수 자동 계산</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 12, minWidth: 1800 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th colSpan={4} style={{ ...cellStyle, background: '#eff6ff', color: '#1e40af', fontWeight: 700, textAlign: 'center', borderBottom: '2px solid #93c5fd' }}>기능명</th>
                  <th colSpan={4} style={{ ...cellStyle, background: '#f0fdf4', color: '#166534', fontWeight: 700, textAlign: 'center', borderBottom: '2px solid #86efac' }}>데이터 및 트랜잭션</th>
                  <th colSpan={2} style={{ ...cellStyle, background: '#fef3c7', color: '#92400e', fontWeight: 700, textAlign: 'center', borderBottom: '2px solid #fcd34d' }}>변경량 입력</th>
                  <th colSpan={4} style={{ ...cellStyle, background: '#e0f2fe', color: '#0369a1', fontWeight: 700, textAlign: 'center', borderBottom: '2px solid #7dd3fc' }}>자동 계산</th>
                  <th colSpan={3} style={{ ...cellStyle, background: '#fdf4ff', color: '#7e22ce', fontWeight: 700, textAlign: 'center', borderBottom: '2px solid #d8b4fe' }}>결과</th>
                  <th style={{ ...cellStyle, borderBottom: '2px solid #e5e7eb' }}></th>
                </tr>
                <tr style={{ background: '#f8fafc' }}>
                  {['LV1','LV2','LV3','단위프로세스 설명'].map((h) => (
                    <th key={h} style={{ ...cellStyle, fontWeight: 600, color: '#374151', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', textAlign: 'left', minWidth: h === '단위프로세스 설명' ? 200 : 60 }}>{h}</th>
                  ))}
                  {['FP유형','FTR','DET','복잡도/가중치'].map((h) => (
                    <th key={h} style={{ ...cellStyle, fontWeight: 600, color: '#374151', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', textAlign: 'center' }}>{h}</th>
                  ))}
                  {['FTR변경량','DET변경량'].map((h) => (
                    <th key={h} style={{ ...cellStyle, fontWeight: 600, color: '#374151', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', textAlign: 'center' }}>{h}</th>
                  ))}
                  {['FTR변경률','DET변경률','기능변경률','영향계수'].map((h) => (
                    <th key={h} style={{ ...cellStyle, fontWeight: 600, color: '#374151', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', textAlign: 'center' }}>{h}</th>
                  ))}
                  {['재사용유형','재사용기능점수','비고'].map((h) => (
                    <th key={h} style={{ ...cellStyle, fontWeight: 600, color: '#374151', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', textAlign: 'center' }}>{h}</th>
                  ))}
                  <th style={{ ...cellStyle, borderBottom: '2px solid #e5e7eb' }}>삭제</th>
                </tr>
              </thead>
              <tbody>
                {fpList.map((f) => {
                  const complexity = getComplexity(f.fpType, f.ftr, f.det);
                  const stdWeight = getWeight(f.fpType, f.ftr, f.det);
                  const avgWeight = getAvgWeight(f.fpType);
                  const displayWeight = fpMethod === 'simple' ? avgWeight : stdWeight;
                  const cColor = COMPLEXITY_COLORS[complexity] || {};
                  const isChanged = f.reuseType === '기능변경';
                  const rColor = REUSE_COLORS[f.reuseType] || {};
                  const autoCalcBg = '#f0f9ff';

                  return (
                    <tr key={f.id}>
                      {/* LV1~LV3 */}
                      {['lv1','lv2','lv3'].map((field) => (
                        <td key={field} style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                          <input value={f[field] || ''} onChange={(e) => updateFP(f.id, field, e.target.value)} style={{ width: '100%', border: 'none', outline: 'none', fontSize: 12, background: 'transparent', minWidth: 60 }} />
                        </td>
                      ))}
                      {/* 단위프로세스 설명 */}
                      <td style={{ ...cellStyle, minWidth: 200, maxWidth: 350 }}>
                        <textarea value={f.definition || ''} onChange={(e) => updateFP(f.id, 'definition', e.target.value)} rows={2} style={{ width: '100%', border: 'none', outline: 'none', fontSize: 12, background: 'transparent', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} />
                      </td>
                      {/* FP유형 */}
                      <td style={{ ...cellStyle, textAlign: 'center' }}>
                        <select value={f.fpType} onChange={(e) => updateFP(f.id, 'fpType', e.target.value)} style={{ fontSize: 12, border: '1px solid #d1d5db', borderRadius: 4, padding: '2px 4px' }}>
                          {FP_TYPES.map((t) => <option key={t}>{t}</option>)}
                        </select>
                      </td>
                      {/* FTR */}
                      <td style={{ ...cellStyle, textAlign: 'center' }}>
                        {numInput(f.ftr, (v) => updateFP(f.id, 'ftr', v))}
                      </td>
                      {/* DET */}
                      <td style={{ ...cellStyle, textAlign: 'center' }}>
                        {numInput(f.det, (v) => updateFP(f.id, 'det', v))}
                      </td>
                      {/* 복잡도/가중치 */}
                      <td style={{ ...cellStyle, textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          {fpMethod === 'standard' && (
                            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: cColor.bg, color: cColor.color, fontWeight: 500 }}>
                              {getComplexityLabel(complexity)}
                            </span>
                          )}
                          <span style={{ fontWeight: 700, color: '#2563eb', fontSize: 14 }}>{displayWeight}</span>
                        </div>
                      </td>
                      {/* FTR변경량 - 입력 가능 */}
                      <td style={{ ...cellStyle, textAlign: 'center', background: isChanged ? '#fff' : '#f9fafb' }}>
                        {isChanged
                          ? numInput(f.ftrChange || 0, (v) => updateFP(f.id, 'ftrChange', v))
                          : <span style={{ color: '#9ca3af' }}>-</span>}
                      </td>
                      {/* DET변경량 - 입력 가능 */}
                      <td style={{ ...cellStyle, textAlign: 'center', background: isChanged ? '#fff' : '#f9fafb' }}>
                        {isChanged
                          ? numInput(f.detChange || 0, (v) => updateFP(f.id, 'detChange', v))
                          : <span style={{ color: '#9ca3af' }}>-</span>}
                      </td>
                      {/* FTR변경률 - 자동 계산 */}
                      <td style={{ ...cellStyle, textAlign: 'center', background: isChanged ? autoCalcBg : '#f9fafb' }}>
                        {isChanged ? readOnlyCell(f.ftrChangePct, '%') : <span style={{ color: '#9ca3af' }}>-</span>}
                      </td>
                      {/* DET변경률 - 자동 계산 */}
                      <td style={{ ...cellStyle, textAlign: 'center', background: isChanged ? autoCalcBg : '#f9fafb' }}>
                        {isChanged ? readOnlyCell(f.detChangePct, '%') : <span style={{ color: '#9ca3af' }}>-</span>}
                      </td>
                      {/* 기능변경률 - 자동 계산 */}
                      <td style={{ ...cellStyle, textAlign: 'center', background: isChanged ? autoCalcBg : '#f9fafb' }}>
                        {isChanged ? readOnlyCell(f.funcChangePct, '%') : <span style={{ color: '#9ca3af' }}>-</span>}
                      </td>
                      {/* 영향계수 - 자동 계산 */}
                      <td style={{ ...cellStyle, textAlign: 'center', background: isChanged ? autoCalcBg : '#f9fafb' }}>
                        {isChanged ? readOnlyCell(f.impactFactor) : <span style={{ color: '#9ca3af' }}>-</span>}
                      </td>
                      {/* 재사용유형 */}
                      <td style={{ ...cellStyle, textAlign: 'center' }}>
                        <select value={f.reuseType} onChange={(e) => updateFP(f.id, 'reuseType', e.target.value)} style={{ fontSize: 11, border: '1px solid #d1d5db', borderRadius: 4, padding: '2px 2px', background: rColor.bg, color: rColor.color, fontWeight: 500 }}>
                          {REUSE_TYPES.map((t) => <option key={t}>{t}</option>)}
                        </select>
                      </td>
                      {/* 재사용기능점수 - 자동 계산 */}
                      <td style={{ ...cellStyle, textAlign: 'center', background: autoCalcBg }}>
                        <div style={{ fontWeight: 700, color: '#7e22ce', fontSize: 13 }}>
                          {f.reuseType === '기능삭제' ? '비대상' : readOnlyCell(f.reuseScore)}
                        </div>
                      </td>
                      {/* 비고 - 고도화/신규 선택 */}
                      <td style={{ ...cellStyle, textAlign: 'center' }}>
                        <select value={f.bigo || '-'} onChange={(e) => updateFP(f.id, 'bigo', e.target.value)} style={{ fontSize: 11, border: '1px solid #d1d5db', borderRadius: 4, padding: '2px 4px', minWidth: 55 }}>
                          {BIGO_TYPES.map((t) => <option key={t}>{t}</option>)}
                        </select>
                      </td>
                      {/* 삭제 */}
                      <td style={cellStyle}>
                        <button onClick={() => deleteFPRow(f.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16 }}>✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* ④ 화면 목록 */}
      {tab === 'screens' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>총 {screenList.length}개 화면 · 셀 클릭하여 수정 가능</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleGenerateScreens}
                disabled={screenLoading}
                style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: screenLoading ? 0.6 : 1 }}
              >
                {screenLoading ? '⚙️ AI 생성 중...' : 'AI 화면목록 생성'}
              </button>
              <button onClick={addScreen} style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 6, padding: '7px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                + 행 추가
              </button>
              <button onClick={exportScreenExcel} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Excel 출력
              </button>
            </div>
          </div>

          {screenList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af', border: '2px dashed #e5e7eb', borderRadius: 12 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🖥️</div>
              <p style={{ fontSize: 15, marginBottom: 8 }}>화면 목록이 없습니다</p>
              <p style={{ fontSize: 13 }}>기능 목록 생성 후 AI 화면목록 생성 버튼을 클릭하세요</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['화면ID', '화면명', '화면유형', 'LV1', 'LV2', '관련기능', '비고', '삭제'].map(h => (
                      <th key={h} style={{ ...cellStyle, fontWeight: 600, textAlign: 'left', color: '#374151', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {screenList.map((s) => (
                    <tr key={s.id}>
                      {/* 화면ID */}
                      <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                        <input value={s.screenId || ''} onChange={e => updateScreen(s.id, 'screenId', e.target.value)} style={{ width: 80, border: 'none', outline: 'none', fontSize: 12, background: 'transparent', fontWeight: 600, color: '#2563eb' }} />
                      </td>
                      {/* 화면명 */}
                      <td style={{ ...cellStyle, minWidth: 150 }}>
                        <input value={s.screenName || ''} onChange={e => updateScreen(s.id, 'screenName', e.target.value)} style={{ width: '100%', border: 'none', outline: 'none', fontSize: 12, background: 'transparent', fontWeight: 500 }} />
                      </td>
                      {/* 화면유형 */}
                      <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                        <select value={s.screenType || '목록화면'} onChange={e => updateScreen(s.id, 'screenType', e.target.value)} style={{ fontSize: 11, border: '1px solid #d1d5db', borderRadius: 4, padding: '2px 4px' }}>
                          {SCREEN_TYPES.map(t => <option key={t}>{t}</option>)}
                        </select>
                      </td>
                      {/* LV1 */}
                      <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                        <input value={s.lv1 || ''} onChange={e => updateScreen(s.id, 'lv1', e.target.value)} style={{ width: 80, border: 'none', outline: 'none', fontSize: 12, background: 'transparent' }} />
                      </td>
                      {/* LV2 */}
                      <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                        <input value={s.lv2 || ''} onChange={e => updateScreen(s.id, 'lv2', e.target.value)} style={{ width: 100, border: 'none', outline: 'none', fontSize: 12, background: 'transparent' }} />
                      </td>
                      {/* 관련기능 */}
                      <td style={{ ...cellStyle, minWidth: 250 }}>
                        <textarea value={s.relatedFunctions || ''} onChange={e => updateScreen(s.id, 'relatedFunctions', e.target.value)} rows={2} style={{ width: '100%', border: 'none', outline: 'none', fontSize: 12, background: 'transparent', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} />
                      </td>
                      {/* 비고 */}
                      <td style={{ ...cellStyle, minWidth: 100 }}>
                        <input value={s.note || ''} onChange={e => updateScreen(s.id, 'note', e.target.value)} style={{ width: '100%', border: 'none', outline: 'none', fontSize: 12, background: 'transparent' }} />
                      </td>
                      {/* 삭제 */}
                      <td style={cellStyle}>
                        <button onClick={() => deleteScreen(s.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16 }}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {/* ⑤ 요구사항 정의서 */}
      {tab === 'requirements' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>총 {reqList.length}개 요구사항 · 셀 클릭하여 수정 가능</p>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { type: '기능', color: TYPE_COLORS['기능'] },
                  { type: '비기능', color: TYPE_COLORS['비기능'] },
                  { type: '제약사항', color: TYPE_COLORS['제약사항'] },
                ].map(t => (
                  <span key={t.type} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: t.color.bg, color: t.color.color, fontWeight: 500 }}>
                    {t.type} {reqList.filter(r => r.type === t.type).length}개
                  </span>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleGenerateRequirements}
                disabled={reqLoading}
                style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: reqLoading ? 0.6 : 1 }}
              >
                {reqLoading ? '⚙️ AI 생성 중...' : 'AI 요구사항 생성'}
              </button>
              <button onClick={addReq} style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 6, padding: '7px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                + 행 추가
              </button>
              <button onClick={exportReqExcel} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Excel 출력
              </button>
            </div>
          </div>

          {reqList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af', border: '2px dashed #e5e7eb', borderRadius: 12 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <p style={{ fontSize: 15, marginBottom: 8 }}>요구사항 정의서가 없습니다</p>
              <p style={{ fontSize: 13 }}>기능 목록 생성 후 AI 요구사항 생성 버튼을 클릭하세요</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['요구사항ID', '유형', '요구사항명', '상세내용', '관련화면', '우선순위', '비고', '삭제'].map(h => (
                      <th key={h} style={{ ...cellStyle, fontWeight: 600, textAlign: 'left', color: '#374151', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reqList.map((r) => {
                    const tColor = TYPE_COLORS[r.type] || {};
                    const pColor = PRIORITY_COLORS[r.priority] || {};
                    return (
                      <tr key={r.id}>
                        {/* 요구사항ID */}
                        <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                          <input value={r.reqId || ''} onChange={e => updateReq(r.id, 'reqId', e.target.value)} style={{ width: 80, border: 'none', outline: 'none', fontSize: 12, background: 'transparent', fontWeight: 600, color: '#2563eb' }} />
                        </td>
                        {/* 유형 */}
                        <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                          <select value={r.type || '기능'} onChange={e => updateReq(r.id, 'type', e.target.value)} style={{ fontSize: 11, border: '1px solid #d1d5db', borderRadius: 4, padding: '2px 4px', background: tColor.bg, color: tColor.color, fontWeight: 500 }}>
                            {REQ_TYPES.map(t => <option key={t}>{t}</option>)}
                          </select>
                        </td>
                        {/* 요구사항명 */}
                        <td style={{ ...cellStyle, minWidth: 150 }}>
                          <input value={r.reqName || ''} onChange={e => updateReq(r.id, 'reqName', e.target.value)} style={{ width: '100%', border: 'none', outline: 'none', fontSize: 12, background: 'transparent', fontWeight: 500 }} />
                        </td>
                        {/* 상세내용 */}
                        <td style={{ ...cellStyle, minWidth: 300 }}>
                          <textarea value={r.detail || ''} onChange={e => updateReq(r.id, 'detail', e.target.value)} rows={2} style={{ width: '100%', border: 'none', outline: 'none', fontSize: 12, background: 'transparent', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} />
                        </td>
                        {/* 관련화면 */}
                        <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                          <input value={r.relatedScreen || ''} onChange={e => updateReq(r.id, 'relatedScreen', e.target.value)} style={{ width: 90, border: 'none', outline: 'none', fontSize: 12, background: 'transparent' }} />
                        </td>
                        {/* 우선순위 */}
                        <td style={{ ...cellStyle, textAlign: 'center' }}>
                          <select value={r.priority || '중'} onChange={e => updateReq(r.id, 'priority', e.target.value)} style={{ fontSize: 11, border: '1px solid #d1d5db', borderRadius: 4, padding: '2px 4px', background: pColor.bg, color: pColor.color, fontWeight: 600 }}>
                            {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                          </select>
                        </td>
                        {/* 비고 */}
                        <td style={{ ...cellStyle, minWidth: 100 }}>
                          <input value={r.note || ''} onChange={e => updateReq(r.id, 'note', e.target.value)} style={{ width: '100%', border: 'none', outline: 'none', fontSize: 12, background: 'transparent' }} />
                        </td>
                        {/* 삭제 */}
                        <td style={cellStyle}>
                          <button onClick={() => deleteReq(r.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16 }}>✕</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ⑥ CRUD 분석 */}
      {tab === 'crud' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>
                기능 {(crudMatrix.matrix || []).length}개 × 엔티티 {(crudMatrix.entities || []).length}개
              </p>
              <div style={{ display: 'flex', gap: 6 }}>
                {['C','R','U','D'].map(c => (
                  <span key={c} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: CRUD_COLORS[c]?.bg, color: CRUD_COLORS[c]?.color, fontWeight: 700 }}>
                    {c} = {c === 'C' ? '등록' : c === 'R' ? '조회' : c === 'U' ? '수정' : '삭제'}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleGenerateCRUD} disabled={crudLoading} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: crudLoading ? 0.6 : 1 }}>
                {crudLoading ? '⚙️ AI 생성 중...' : 'AI CRUD 분석'}
              </button>
              <button onClick={addEntity} style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 6, padding: '7px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                + 엔티티 추가
              </button>
              <button onClick={exportCrudExcel} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Excel 출력
              </button>
            </div>
          </div>

          {(crudMatrix.matrix || []).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af', border: '2px dashed #e5e7eb', borderRadius: 12 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🗃️</div>
              <p style={{ fontSize: 15, marginBottom: 8 }}>CRUD 분석 매트릭스가 없습니다</p>
              <p style={{ fontSize: 13 }}>기능 목록 생성 후 AI CRUD 분석 버튼을 클릭하세요</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 12, minWidth: 800 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ ...cellStyle, fontWeight: 600, color: '#374151', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', minWidth: 80 }}>LV1</th>
                    <th style={{ ...cellStyle, fontWeight: 600, color: '#374151', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', minWidth: 80 }}>LV2</th>
                    <th style={{ ...cellStyle, fontWeight: 600, color: '#374151', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', minWidth: 120 }}>LV3 (기능명)</th>
                    {(crudMatrix.entities || []).map(e => (
                      <th key={e} style={{ ...cellStyle, fontWeight: 600, color: '#374151', borderBottom: '2px solid #e5e7eb', textAlign: 'center', whiteSpace: 'nowrap', minWidth: 70, background: '#f0f4ff' }}>{e}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(crudMatrix.matrix || []).map((f, fi) => (
                    <tr key={fi} style={{ background: fi % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ ...cellStyle, whiteSpace: 'nowrap', color: '#6b7280' }}>{f.lv1}</td>
                      <td style={{ ...cellStyle, whiteSpace: 'nowrap', color: '#6b7280' }}>{f.lv2}</td>
                      <td style={{ ...cellStyle, whiteSpace: 'nowrap', fontWeight: 500 }}>{f.lv3}</td>
                      {(crudMatrix.entities || []).map(e => {
                        const val = f.crud?.[e] || '';
                        return (
                          <td key={e} style={{ ...cellStyle, textAlign: 'center', padding: '4px 6px' }}>
                            <select
                              value={val}
                              onChange={ev => updateCrud(fi, e, ev.target.value)}
                              style={{
                                fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 4,
                                padding: '2px 4px', width: 65, textAlign: 'center',
                                background: val === 'C' ? '#dcfce7' : val === 'R' ? '#dbeafe' : val === 'U' ? '#fef9c3' : val === 'D' ? '#fee2e2' : val ? '#f3e8ff' : '#f9fafb',
                                color: val === 'C' ? '#166534' : val === 'R' ? '#1e40af' : val === 'U' ? '#854d0e' : val === 'D' ? '#dc2626' : val ? '#7e22ce' : '#9ca3af',
                                fontWeight: val ? 700 : 400,
                                cursor: 'pointer',
                              }}
                            >
                              <option value="">-</option>
                              <option value="C">C</option>
                              <option value="R">R</option>
                              <option value="U">U</option>
                              <option value="D">D</option>
                              <option value="CR">CR</option>
                              <option value="CRU">CRU</option>
                              <option value="CRUD">CRUD</option>
                              <option value="RU">RU</option>
                              <option value="RUD">RUD</option>
                              <option value="CU">CU</option>
                            </select>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 엔티티별 통계 */}
          {(crudMatrix.entities || []).length > 0 && (crudMatrix.matrix || []).length > 0 && (
            <div style={{ marginTop: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>📊 엔티티별 CRUD 통계</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {(crudMatrix.entities || []).map(e => {
                  const counts = { C: 0, R: 0, U: 0, D: 0 };
                  (crudMatrix.matrix || []).forEach(f => {
                    const val = f.crud?.[e] || '';
                    ['C','R','U','D'].forEach(c => { if (val.includes(c)) counts[c]++; });
                  });
                  return (
                    <div key={e} style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px', minWidth: 120 }}>
                      <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#374151' }}>{e}</p>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {['C','R','U','D'].map(c => (
                          <div key={c} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: CRUD_COLORS[c]?.bg, color: CRUD_COLORS[c]?.color, fontWeight: 700, marginBottom: 2 }}>{c}</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{counts[c]}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ⑦ 인터페이스 정의서 */}
      {tab === 'interface' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>총 {ifList.length}개 인터페이스 · EIF 기반 자동 생성</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={async () => {
                  if (fpList.length === 0) return alert('FP 산정표를 먼저 작성하세요.');
                  if (ifList.length > 0 && !window.confirm('기존 인터페이스 정의서를 덮어쓰시겠습니까?')) return;
                  setIfLoading(true);
                  try {
                    const eifList = fpList.filter(f => f.fpType === 'EIF');
                    const response = await fetch('/api/claude', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        messages: [{
                          role: 'user',
                          content: `SW사업 BA 전문가로서 아래 EIF(외부연계파일) 목록을 기반으로 인터페이스 정의서를 작성하세요.

시스템명: ${systemName}
EIF 목록:
${JSON.stringify(eifList.map(f => ({ lv1: f.lv1, lv2: f.lv2, lv3: f.lv3, definition: f.definition })), null, 2)}

각 EIF에 대해:
- ifId: IF-001 형식
- ifName: 인터페이스명
- sendSystem: 송신 시스템명
- receiveSystem: 수신 시스템명 (현재 시스템 또는 외부)
- method: 연동방식 (REST API/DB Link/파일/MQ/SOAP 중)
- cycle: 연동주기 (실시간/배치/일회성)
- dataItems: 주요 데이터 항목 (쉼표 구분)
- note: 비고

JSON만 응답:
{"interfaces":[{"ifId":"IF-001","ifName":"","sendSystem":"","receiveSystem":"","method":"REST API","cycle":"실시간","dataItems":"","note":""}]}`
                        }]
                      }),
                    });
                    const data = await response.json();
                    const text = data.content.map(c => c.type === 'text' ? c.text : '').join('');
                    const start = text.indexOf('{'); const end = text.lastIndexOf('}');
                    const parsed = JSON.parse(text.slice(start, end + 1));
                    const withId = (parsed.interfaces || []).map((f, i) => ({ ...f, id: Date.now() + i }));
                    setIfList(withId);
                    saveProject({ ifList: withId });
                  } catch (err) { alert('오류: ' + err.message); }
                  finally { setIfLoading(false); }
                }}
                disabled={ifLoading}
                style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: ifLoading ? 0.6 : 1 }}
              >
                {ifLoading ? '⚙️ AI 생성 중...' : 'AI 인터페이스 생성'}
              </button>
              <button
                onClick={() => {
                  const updated = [...ifList, { id: Date.now(), ifId: `IF-${String(ifList.length+1).padStart(3,'0')}`, ifName: '', sendSystem: '', receiveSystem: systemName, method: 'REST API', cycle: '실시간', dataItems: '', note: '' }];
                  setIfList(updated); saveProject({ ifList: updated });
                }}
                style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 6, padding: '7px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
              >+ 행 추가</button>
              <button
                onClick={() => {
                  const rows = ifList.map(f => ({ '인터페이스ID': f.ifId, '인터페이스명': f.ifName, '송신시스템': f.sendSystem, '수신시스템': f.receiveSystem, '연동방식': f.method, '연동주기': f.cycle, '주요데이터항목': f.dataItems, '비고': f.note }));
                  const wb = XLSX.utils.book_new();
                  const ws = XLSX.utils.json_to_sheet(rows);
                  XLSX.utils.book_append_sheet(wb, ws, '인터페이스정의서');
                  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
                  saveAs(new Blob([buf]), project.name + '_인터페이스정의서.xlsx');
                }}
                style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >Excel 출력</button>
            </div>
          </div>

          {ifList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af', border: '2px dashed #e5e7eb', borderRadius: 12 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔗</div>
              <p style={{ fontSize: 15, marginBottom: 8 }}>인터페이스 정의서가 없습니다</p>
              <p style={{ fontSize: 13 }}>FP 산정표에 EIF를 입력한 후 AI 생성 버튼을 클릭하세요</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['인터페이스ID','인터페이스명','송신시스템','수신시스템','연동방식','연동주기','주요 데이터 항목','비고','삭제'].map(h => (
                      <th key={h} style={{ ...cellStyle, fontWeight: 600, color: '#374151', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ifList.map((f) => (
                    <tr key={f.id}>
                      <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                        <input value={f.ifId||''} onChange={e => { const u=ifList.map(r=>r.id===f.id?{...r,ifId:e.target.value}:r); setIfList(u); saveProject({ifList:u}); }} style={{ width: 70, border: 'none', outline: 'none', fontSize: 12, background: 'transparent', fontWeight: 600, color: '#2563eb' }} />
                      </td>
                      {['ifName','sendSystem','receiveSystem'].map(field => (
                        <td key={field} style={{ ...cellStyle, minWidth: 100 }}>
                          <input value={f[field]||''} onChange={e => { const u=ifList.map(r=>r.id===f.id?{...r,[field]:e.target.value}:r); setIfList(u); saveProject({ifList:u}); }} style={{ width: '100%', border: 'none', outline: 'none', fontSize: 12, background: 'transparent' }} />
                        </td>
                      ))}
                      <td style={cellStyle}>
                        <select value={f.method||'REST API'} onChange={e => { const u=ifList.map(r=>r.id===f.id?{...r,method:e.target.value}:r); setIfList(u); saveProject({ifList:u}); }} style={{ fontSize: 11, border: '1px solid #d1d5db', borderRadius: 4, padding: '2px 4px' }}>
                          {['REST API','DB Link','파일','MQ','SOAP','Web Service'].map(m => <option key={m}>{m}</option>)}
                        </select>
                      </td>
                      <td style={cellStyle}>
                        <select value={f.cycle||'실시간'} onChange={e => { const u=ifList.map(r=>r.id===f.id?{...r,cycle:e.target.value}:r); setIfList(u); saveProject({ifList:u}); }} style={{ fontSize: 11, border: '1px solid #d1d5db', borderRadius: 4, padding: '2px 4px' }}>
                          {['실시간','배치(일간)','배치(주간)','배치(월간)','일회성','이벤트'].map(c => <option key={c}>{c}</option>)}
                        </select>
                      </td>
                      <td style={{ ...cellStyle, minWidth: 200 }}>
                        <textarea value={f.dataItems||''} onChange={e => { const u=ifList.map(r=>r.id===f.id?{...r,dataItems:e.target.value}:r); setIfList(u); saveProject({ifList:u}); }} rows={2} style={{ width: '100%', border: 'none', outline: 'none', fontSize: 12, background: 'transparent', resize: 'vertical', fontFamily: 'inherit' }} />
                      </td>
                      <td style={{ ...cellStyle, minWidth: 80 }}>
                        <input value={f.note||''} onChange={e => { const u=ifList.map(r=>r.id===f.id?{...r,note:e.target.value}:r); setIfList(u); saveProject({ifList:u}); }} style={{ width: '100%', border: 'none', outline: 'none', fontSize: 12, background: 'transparent' }} />
                      </td>
                      <td style={cellStyle}>
                        <button onClick={() => { const u=ifList.filter(r=>r.id!==f.id); setIfList(u); saveProject({ifList:u}); }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16 }}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ⑧ WBS */}
      {tab === 'wbs' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>총 {wbsList.length}개 작업 · 기능목록 기반 개발 일정 자동 생성</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={async () => {
                  if (functions.length === 0) return alert('기능 목록을 먼저 생성하세요.');
                  if (wbsList.length > 0 && !window.confirm('기존 WBS를 덮어쓰시겠습니까?')) return;
                  setWbsLoading(true);
                  try {
                    const response = await fetch('/api/claude', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        messages: [{
                          role: 'user',
                          content: `SW사업 BA 전문가로서 아래 기능목록 기반으로 WBS(작업분류체계)를 작성하세요.

시스템명: ${systemName}
총 기능수: ${functions.length}개
FP합계(정통법 신규): ${stdSummary.newDev} FP

기능 목록:
${JSON.stringify(functions.map(f=>({lv1:f.lv1,lv2:f.lv2,lv3:f.lv3})),null,2)}

WBS 규칙:
- 단계: 분석/설계/개발/테스트/이행 순서
- LV2 업무단위별로 그룹화
- 각 단계별 공수(일) 산정
- 담당자: 분석가/설계자/개발자/테스터 구분
- 전자정부프레임워크 기준 적용

JSON만 응답:
{"wbs":[{"wbsId":"1","phase":"분석","task":"요구사항 분석","lv1":"","lv2":"","workDays":3,"role":"분석가","note":""}]}`
                        }]
                      }),
                    });
                    const data = await response.json();
                    const text = data.content.map(c=>c.type==='text'?c.text:'').join('');
                    const start = text.indexOf('{'); const end = text.lastIndexOf('}');
                    const parsed = JSON.parse(text.slice(start, end+1));
                    const withId = (parsed.wbs||[]).map((w,i)=>({...w,id:Date.now()+i}));
                    setWbsList(withId);
                    saveProject({ wbsList: withId });
                  } catch(err) { alert('오류: '+err.message); }
                  finally { setWbsLoading(false); }
                }}
                disabled={wbsLoading}
                style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: wbsLoading ? 0.6 : 1 }}
              >
                {wbsLoading ? '⚙️ AI 생성 중...' : 'AI WBS 생성'}
              </button>
              <button
                onClick={() => {
                  const rows = wbsList.map(w=>({'WBS ID':w.wbsId,'단계':w.phase,'작업명':w.task,'LV1':w.lv1,'LV2':w.lv2,'공수(일)':w.workDays,'담당자':w.role,'비고':w.note}));
                  const wb = XLSX.utils.book_new();
                  const ws = XLSX.utils.json_to_sheet(rows);
                  ws['!cols']=[{wch:8},{wch:10},{wch:30},{wch:15},{wch:15},{wch:10},{wch:10},{wch:20}];
                  XLSX.utils.book_append_sheet(wb,ws,'WBS');
                  const buf=XLSX.write(wb,{bookType:'xlsx',type:'array'});
                  saveAs(new Blob([buf]),project.name+'_WBS.xlsx');
                }}
                style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >Excel 출력</button>
            </div>
          </div>

          {wbsList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af', border: '2px dashed #e5e7eb', borderRadius: 12 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
              <p style={{ fontSize: 15, marginBottom: 8 }}>WBS가 없습니다</p>
              <p style={{ fontSize: 13 }}>기능 목록 생성 후 AI WBS 생성 버튼을 클릭하세요</p>
            </div>
          ) : (
            <div>
              {/* 단계별 요약 */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                {['분석','설계','개발','테스트','이행'].map(phase => {
                  const phaseTasks = wbsList.filter(w=>w.phase===phase);
                  const totalDays = phaseTasks.reduce((sum,w)=>sum+Number(w.workDays||0),0);
                  if (phaseTasks.length === 0) return null;
                  return (
                    <div key={phase} style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 16px', minWidth: 100, textAlign: 'center' }}>
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{phase}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#2563eb' }}>{totalDays}일</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{phaseTasks.length}개 작업</div>
                    </div>
                  );
                })}
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 16px', minWidth: 100, textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: '#1e40af', marginBottom: 4 }}>총 공수</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#1e40af' }}>{wbsList.reduce((sum,w)=>sum+Number(w.workDays||0),0)}일</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>{wbsList.length}개 작업</div>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {['WBS ID','단계','작업명','LV1','LV2','공수(일)','담당자','비고','삭제'].map(h => (
                        <th key={h} style={{ ...cellStyle, fontWeight: 600, color: '#374151', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', textAlign: 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {wbsList.map((w) => {
                      const phaseColor = { '분석':'#eff6ff', '설계':'#f0fdf4', '개발':'#fff7ed', '테스트':'#fdf4ff', '이행':'#fef2f2' }[w.phase] || '#f9fafb';
                      return (
                        <tr key={w.id} style={{ background: phaseColor }}>
                          <td style={{ ...cellStyle, whiteSpace: 'nowrap', fontWeight: 600, color: '#374151' }}>{w.wbsId}</td>
                          <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                            <select value={w.phase||'개발'} onChange={e=>{const u=wbsList.map(r=>r.id===w.id?{...r,phase:e.target.value}:r);setWbsList(u);saveProject({wbsList:u});}} style={{ fontSize: 11, border: '1px solid #d1d5db', borderRadius: 4, padding: '2px 4px' }}>
                              {['분석','설계','개발','테스트','이행'].map(p=><option key={p}>{p}</option>)}
                            </select>
                          </td>
                          <td style={{ ...cellStyle, minWidth: 180 }}>
                            <input value={w.task||''} onChange={e=>{const u=wbsList.map(r=>r.id===w.id?{...r,task:e.target.value}:r);setWbsList(u);saveProject({wbsList:u});}} style={{ width:'100%',border:'none',outline:'none',fontSize:12,background:'transparent',fontWeight:500 }} />
                          </td>
                          <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                            <input value={w.lv1||''} onChange={e=>{const u=wbsList.map(r=>r.id===w.id?{...r,lv1:e.target.value}:r);setWbsList(u);saveProject({wbsList:u});}} style={{ width:80,border:'none',outline:'none',fontSize:12,background:'transparent' }} />
                          </td>
                          <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                            <input value={w.lv2||''} onChange={e=>{const u=wbsList.map(r=>r.id===w.id?{...r,lv2:e.target.value}:r);setWbsList(u);saveProject({wbsList:u});}} style={{ width:90,border:'none',outline:'none',fontSize:12,background:'transparent' }} />
                          </td>
                          <td style={{ ...cellStyle, textAlign: 'center' }}>
                            <input type="number" value={w.workDays||0} onChange={e=>{const u=wbsList.map(r=>r.id===w.id?{...r,workDays:Number(e.target.value)}:r);setWbsList(u);saveProject({wbsList:u});}} style={{ width:50,border:'1px solid #d1d5db',borderRadius:4,padding:'2px 4px',fontSize:12,textAlign:'center' }} />
                          </td>
                          <td style={cellStyle}>
                            <select value={w.role||'개발자'} onChange={e=>{const u=wbsList.map(r=>r.id===w.id?{...r,role:e.target.value}:r);setWbsList(u);saveProject({wbsList:u});}} style={{ fontSize:11,border:'1px solid #d1d5db',borderRadius:4,padding:'2px 4px' }}>
                              {['분석가','설계자','개발자','테스터','PM'].map(r=><option key={r}>{r}</option>)}
                            </select>
                          </td>
                          <td style={{ ...cellStyle, minWidth: 80 }}>
                            <input value={w.note||''} onChange={e=>{const u=wbsList.map(r=>r.id===w.id?{...r,note:e.target.value}:r);setWbsList(u);saveProject({wbsList:u});}} style={{ width:'100%',border:'none',outline:'none',fontSize:12,background:'transparent' }} />
                          </td>
                          <td style={cellStyle}>
                            <button onClick={()=>{const u=wbsList.filter(r=>r.id!==w.id);setWbsList(u);saveProject({wbsList:u});}} style={{ background:'none',border:'none',color:'#ef4444',cursor:'pointer',fontSize:16 }}>✕</button>
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
      {/* ⑨ 요구사항 추적표 */}
      {tab === 'traceability' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>총 {traceList.length}개 · 요구사항 → 기능 → 화면 → 테스트 매핑</p>
              <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>감리/검수 시 필수 산출물</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={async () => {
                  if (reqList.length === 0) return alert('요구사항 정의서를 먼저 작성하세요.');
                  if (traceList.length > 0 && !window.confirm('기존 추적표를 덮어쓰시겠습니까?')) return;
                  setTraceLoading(true);
                  try {
                    const response = await fetch('/api/claude', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        messages: [{
                          role: 'user',
                          content: `SW사업 BA 전문가로서 요구사항 추적표를 작성하세요.

요구사항 목록:
${JSON.stringify(reqList.map(r=>({reqId:r.reqId,type:r.type,reqName:r.reqName})),null,2)}

기능 목록:
${JSON.stringify(functions.map(f=>({lv2:f.lv2,lv3:f.lv3})),null,2)}

화면 목록:
${JSON.stringify(screenList.map(s=>({screenId:s.screenId,screenName:s.screenName})),null,2)}

각 요구사항에 대해:
- reqId: 요구사항ID
- reqName: 요구사항명
- relatedFunctions: 관련 기능명 (쉼표 구분)
- relatedScreens: 관련 화면ID (쉼표 구분)
- testId: 테스트케이스ID (TC-001 형식)
- status: 상태 (미착수/진행중/완료)

JSON만 응답:
{"traces":[{"reqId":"FR-001","reqName":"","relatedFunctions":"","relatedScreens":"","testId":"TC-001","status":"미착수"}]}`
                        }]
                      }),
                    });
                    const data = await response.json();
                    const text = data.content.map(c=>c.type==='text'?c.text:'').join('');
                    const start=text.indexOf('{'); const end=text.lastIndexOf('}');
                    const parsed = JSON.parse(text.slice(start,end+1));
                    const withId = (parsed.traces||[]).map((t,i)=>({...t,id:Date.now()+i}));
                    setTraceList(withId);
                    saveProject({ traceList: withId });
                  } catch(err) { alert('오류: '+err.message); }
                  finally { setTraceLoading(false); }
                }}
                disabled={traceLoading}
                style={{ background:'#2563eb',color:'#fff',border:'none',borderRadius:6,padding:'7px 16px',fontSize:13,fontWeight:600,cursor:'pointer',opacity:traceLoading?0.6:1 }}
              >
                {traceLoading ? '⚙️ AI 생성 중...' : 'AI 추적표 생성'}
              </button>
              <button
                onClick={() => {
                  const rows = traceList.map(t=>({'요구사항ID':t.reqId,'요구사항명':t.reqName,'관련기능':t.relatedFunctions,'관련화면':t.relatedScreens,'테스트케이스ID':t.testId,'상태':t.status}));
                  const wb=XLSX.utils.book_new();
                  const ws=XLSX.utils.json_to_sheet(rows);
                  ws['!cols']=[{wch:12},{wch:25},{wch:30},{wch:20},{wch:14},{wch:10}];
                  XLSX.utils.book_append_sheet(wb,ws,'요구사항추적표');
                  const buf=XLSX.write(wb,{bookType:'xlsx',type:'array'});
                  saveAs(new Blob([buf]),project.name+'_요구사항추적표.xlsx');
                }}
                style={{ background:'#16a34a',color:'#fff',border:'none',borderRadius:6,padding:'7px 14px',fontSize:13,fontWeight:600,cursor:'pointer' }}
              >Excel 출력</button>
            </div>
          </div>

          {traceList.length === 0 ? (
            <div style={{ textAlign:'center',padding:'60px 0',color:'#9ca3af',border:'2px dashed #e5e7eb',borderRadius:12 }}>
              <div style={{ fontSize:40,marginBottom:12 }}>🔎</div>
              <p style={{ fontSize:15,marginBottom:8 }}>요구사항 추적표가 없습니다</p>
              <p style={{ fontSize:13 }}>요구사항 정의서 작성 후 AI 추적표 생성 버튼을 클릭하세요</p>
            </div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%',borderCollapse:'collapse',fontSize:12 }}>
                <thead>
                  <tr style={{ background:'#f8fafc' }}>
                    {['요구사항ID','요구사항명','관련기능','관련화면','테스트케이스ID','상태','삭제'].map(h=>(
                      <th key={h} style={{ ...cellStyle,fontWeight:600,color:'#374151',borderBottom:'2px solid #e5e7eb',whiteSpace:'nowrap',textAlign:'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {traceList.map((t) => {
                    const statusColor = { '미착수':'#f9fafb', '진행중':'#fff7ed', '완료':'#f0fdf4' }[t.status] || '#f9fafb';
                    const statusTextColor = { '미착수':'#6b7280', '진행중':'#ea580c', '완료':'#16a34a' }[t.status] || '#6b7280';
                    return (
                      <tr key={t.id} style={{ background: statusColor }}>
                        <td style={{ ...cellStyle,whiteSpace:'nowrap',fontWeight:600,color:'#2563eb' }}>{t.reqId}</td>
                        <td style={{ ...cellStyle,minWidth:150 }}>
                          <input value={t.reqName||''} onChange={e=>{const u=traceList.map(r=>r.id===t.id?{...r,reqName:e.target.value}:r);setTraceList(u);saveProject({traceList:u});}} style={{ width:'100%',border:'none',outline:'none',fontSize:12,background:'transparent',fontWeight:500 }} />
                        </td>
                        <td style={{ ...cellStyle,minWidth:200 }}>
                          <textarea value={t.relatedFunctions||''} onChange={e=>{const u=traceList.map(r=>r.id===t.id?{...r,relatedFunctions:e.target.value}:r);setTraceList(u);saveProject({traceList:u});}} rows={2} style={{ width:'100%',border:'none',outline:'none',fontSize:12,background:'transparent',resize:'vertical',fontFamily:'inherit' }} />
                        </td>
                        <td style={{ ...cellStyle,minWidth:120 }}>
                          <input value={t.relatedScreens||''} onChange={e=>{const u=traceList.map(r=>r.id===t.id?{...r,relatedScreens:e.target.value}:r);setTraceList(u);saveProject({traceList:u});}} style={{ width:'100%',border:'none',outline:'none',fontSize:12,background:'transparent' }} />
                        </td>
                        <td style={{ ...cellStyle,whiteSpace:'nowrap',color:'#7e22ce',fontWeight:600 }}>{t.testId}</td>
                        <td style={{ ...cellStyle,textAlign:'center' }}>
                          <select value={t.status||'미착수'} onChange={e=>{const u=traceList.map(r=>r.id===t.id?{...r,status:e.target.value}:r);setTraceList(u);saveProject({traceList:u});}} style={{ fontSize:11,border:'1px solid #d1d5db',borderRadius:4,padding:'2px 4px',color:statusTextColor,fontWeight:600 }}>
                            {['미착수','진행중','완료'].map(s=><option key={s}>{s}</option>)}
                          </select>
                        </td>
                        <td style={cellStyle}>
                          <button onClick={()=>{const u=traceList.filter(r=>r.id!==t.id);setTraceList(u);saveProject({traceList:u});}} style={{ background:'none',border:'none',color:'#ef4444',cursor:'pointer',fontSize:16 }}>✕</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {/* 진행 현황 */}
              <div style={{ display:'flex',gap:12,marginTop:16 }}>
                {['미착수','진행중','완료'].map(s => {
                  const cnt = traceList.filter(t=>t.status===s).length;
                  const color = { '미착수':'#6b7280', '진행중':'#ea580c', '완료':'#16a34a' }[s];
                  const bg = { '미착수':'#f9fafb', '진행중':'#fff7ed', '완료':'#f0fdf4' }[s];
                  return (
                    <div key={s} style={{ background:bg,border:`1px solid #e5e7eb`,borderRadius:8,padding:'10px 20px',textAlign:'center' }}>
                      <div style={{ fontSize:12,color,fontWeight:600,marginBottom:4 }}>{s}</div>
                      <div style={{ fontSize:22,fontWeight:700,color }}>{cnt}</div>
                      <div style={{ fontSize:11,color:'#9ca3af' }}>{traceList.length > 0 ? Math.round(cnt/traceList.length*100) : 0}%</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ⑩ 테스트케이스 */}
      {tab === 'testcase' && (
        <div>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
            <div>
              <p style={{ fontSize:14,color:'#6b7280',margin:0 }}>총 {tcList.length}개 테스트케이스 · 요구사항 기반 자동 생성</p>
              <p style={{ fontSize:11,color:'#9ca3af',marginTop:4 }}>단위테스트/통합테스트/인수테스트 포함</p>
            </div>
            <div style={{ display:'flex',gap:8 }}>
              <button
                onClick={async () => {
                  if (reqList.length === 0) return alert('요구사항 정의서를 먼저 작성하세요.');
                  if (tcList.length > 0 && !window.confirm('기존 테스트케이스를 덮어쓰시겠습니까?')) return;
                  setTcLoading(true);
                  try {
                    const frList = reqList.filter(r=>r.type==='기능').slice(0,15);
                    const response = await fetch('/api/claude', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        messages: [{
                          role: 'user',
                          content: `SW사업 QA 전문가로서 아래 기능 요구사항 기반으로 테스트케이스를 작성하세요.

시스템명: ${systemName}
기능 요구사항:
${JSON.stringify(frList.map(r=>({reqId:r.reqId,reqName:r.reqName,detail:r.detail})),null,2)}

각 요구사항당 2~3개 테스트케이스 작성:
- tcId: TC-001 형식
- reqId: 관련 요구사항ID
- tcName: 테스트케이스명
- type: 단위/통합/인수 중 하나
- precondition: 사전조건
- steps: 테스트 절차 (간략히)
- expected: 기대결과
- result: 테스트결과 (미실시/성공/실패)

JSON만 응답:
{"testcases":[{"tcId":"TC-001","reqId":"FR-001","tcName":"","type":"단위","precondition":"","steps":"","expected":"","result":"미실시"}]}`
                        }]
                      }),
                    });
                    const data = await response.json();
                    const text = data.content.map(c=>c.type==='text'?c.text:'').join('');
                    const start=text.indexOf('{'); const end=text.lastIndexOf('}');
                    const parsed = JSON.parse(text.slice(start,end+1));
                    const withId = (parsed.testcases||[]).map((t,i)=>({...t,id:Date.now()+i}));
                    setTcList(withId);
                    saveProject({ tcList: withId });
                  } catch(err) { alert('오류: '+err.message); }
                  finally { setTcLoading(false); }
                }}
                disabled={tcLoading}
                style={{ background:'#2563eb',color:'#fff',border:'none',borderRadius:6,padding:'7px 16px',fontSize:13,fontWeight:600,cursor:'pointer',opacity:tcLoading?0.6:1 }}
              >
                {tcLoading ? '⚙️ AI 생성 중...' : 'AI 테스트케이스 생성'}
              </button>
              <button
                onClick={() => {
                  const rows = tcList.map(t=>({'테스트케이스ID':t.tcId,'관련요구사항':t.reqId,'테스트케이스명':t.tcName,'유형':t.type,'사전조건':t.precondition,'테스트절차':t.steps,'기대결과':t.expected,'테스트결과':t.result}));
                  const wb=XLSX.utils.book_new();
                  const ws=XLSX.utils.json_to_sheet(rows);
                  ws['!cols']=[{wch:14},{wch:12},{wch:30},{wch:8},{wch:20},{wch:40},{wch:30},{wch:10}];
                  XLSX.utils.book_append_sheet(wb,ws,'테스트케이스');
                  const buf=XLSX.write(wb,{bookType:'xlsx',type:'array'});
                  saveAs(new Blob([buf]),project.name+'_테스트케이스.xlsx');
                }}
                style={{ background:'#16a34a',color:'#fff',border:'none',borderRadius:6,padding:'7px 14px',fontSize:13,fontWeight:600,cursor:'pointer' }}
              >Excel 출력</button>
            </div>
          </div>

          {tcList.length === 0 ? (
            <div style={{ textAlign:'center',padding:'60px 0',color:'#9ca3af',border:'2px dashed #e5e7eb',borderRadius:12 }}>
              <div style={{ fontSize:40,marginBottom:12 }}>🧪</div>
              <p style={{ fontSize:15,marginBottom:8 }}>테스트케이스가 없습니다</p>
              <p style={{ fontSize:13 }}>요구사항 정의서 작성 후 AI 테스트케이스 생성 버튼을 클릭하세요</p>
            </div>
          ) : (
            <div>
              {/* 결과 요약 */}
              <div style={{ display:'flex',gap:10,marginBottom:16,flexWrap:'wrap' }}>
                {['미실시','성공','실패'].map(r=>{
                  const cnt=tcList.filter(t=>t.result===r).length;
                  const color={'미실시':'#6b7280','성공':'#16a34a','실패':'#dc2626'}[r];
                  const bg={'미실시':'#f9fafb','성공':'#f0fdf4','실패':'#fef2f2'}[r];
                  return (
                    <div key={r} style={{ background:bg,border:'1px solid #e5e7eb',borderRadius:8,padding:'10px 20px',textAlign:'center',minWidth:90 }}>
                      <div style={{ fontSize:12,color,fontWeight:600,marginBottom:4 }}>{r}</div>
                      <div style={{ fontSize:22,fontWeight:700,color }}>{cnt}</div>
                    </div>
                  );
                })}
                <div style={{ background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:8,padding:'10px 20px',textAlign:'center',minWidth:90 }}>
                  <div style={{ fontSize:12,color:'#1e40af',fontWeight:600,marginBottom:4 }}>성공률</div>
                  <div style={{ fontSize:22,fontWeight:700,color:'#1e40af' }}>
                    {tcList.length > 0 ? Math.round(tcList.filter(t=>t.result==='성공').length/tcList.length*100) : 0}%
                  </div>
                </div>
              </div>

              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%',borderCollapse:'collapse',fontSize:12 }}>
                  <thead>
                    <tr style={{ background:'#f8fafc' }}>
                      {['TC ID','요구사항','테스트케이스명','유형','사전조건','테스트절차','기대결과','결과','삭제'].map(h=>(
                        <th key={h} style={{ ...cellStyle,fontWeight:600,color:'#374151',borderBottom:'2px solid #e5e7eb',whiteSpace:'nowrap',textAlign:'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tcList.map((t) => {
                      const resultColor={'미실시':'#6b7280','성공':'#16a34a','실패':'#dc2626'}[t.result]||'#6b7280';
                      const resultBg={'미실시':'#f9fafb','성공':'#f0fdf4','실패':'#fef2f2'}[t.result]||'#f9fafb';
                      return (
                        <tr key={t.id}>
                          <td style={{ ...cellStyle,whiteSpace:'nowrap',fontWeight:600,color:'#7e22ce' }}>{t.tcId}</td>
                          <td style={{ ...cellStyle,whiteSpace:'nowrap',color:'#2563eb' }}>{t.reqId}</td>
                          <td style={{ ...cellStyle,minWidth:180 }}>
                            <input value={t.tcName||''} onChange={e=>{const u=tcList.map(r=>r.id===t.id?{...r,tcName:e.target.value}:r);setTcList(u);saveProject({tcList:u});}} style={{ width:'100%',border:'none',outline:'none',fontSize:12,background:'transparent',fontWeight:500 }} />
                          </td>
                          <td style={cellStyle}>
                            <select value={t.type||'단위'} onChange={e=>{const u=tcList.map(r=>r.id===t.id?{...r,type:e.target.value}:r);setTcList(u);saveProject({tcList:u});}} style={{ fontSize:11,border:'1px solid #d1d5db',borderRadius:4,padding:'2px 4px' }}>
                              {['단위','통합','인수','시스템'].map(tp=><option key={tp}>{tp}</option>)}
                            </select>
                          </td>
                          {['precondition','steps','expected'].map(field=>(
                            <td key={field} style={{ ...cellStyle,minWidth:field==='steps'?200:120 }}>
                              <textarea value={t[field]||''} onChange={e=>{const u=tcList.map(r=>r.id===t.id?{...r,[field]:e.target.value}:r);setTcList(u);saveProject({tcList:u});}} rows={2} style={{ width:'100%',border:'none',outline:'none',fontSize:12,background:'transparent',resize:'vertical',fontFamily:'inherit' }} />
                            </td>
                          ))}
                          <td style={{ ...cellStyle,textAlign:'center',background:resultBg }}>
                            <select value={t.result||'미실시'} onChange={e=>{const u=tcList.map(r=>r.id===t.id?{...r,result:e.target.value}:r);setTcList(u);saveProject({tcList:u});}} style={{ fontSize:11,border:'1px solid #d1d5db',borderRadius:4,padding:'2px 4px',color:resultColor,fontWeight:700 }}>
                              {['미실시','성공','실패'].map(r=><option key={r}>{r}</option>)}
                            </select>
                          </td>
                          <td style={cellStyle}>
                            <button onClick={()=>{const u=tcList.filter(r=>r.id!==t.id);setTcList(u);saveProject({tcList:u});}} style={{ background:'none',border:'none',color:'#ef4444',cursor:'pointer',fontSize:16 }}>✕</button>
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
      {/* ⑪ AS-IS / TO-BE */}
      {tab === 'asis' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>현행(AS-IS) → 목표(TO-BE) 업무 흐름 비교</p>
              <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>제안서/기획 단계 필수 산출물</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={async () => {
                  if (functions.length === 0) return alert('기능 목록을 먼저 생성하세요.');
                  if (asisList.length > 0 && !window.confirm('기존 AS-IS/TO-BE를 덮어쓰시겠습니까?')) return;
                  setAsisLoading(true);
                  try {
                    const response = await fetch('/api/claude', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        messages: [{
                          role: 'user',
                          content: `SW사업 BA 전문가로서 AS-IS/TO-BE 업무 흐름 분석을 작성하세요.

시스템명: ${systemName}
시스템 개요: ${systemOverview}
주요기능: ${mainFunctions}

기능 목록:
${JSON.stringify(functions.map(f=>({lv1:f.lv1,lv2:f.lv2,lv3:f.lv3})),null,2)}

각 LV2 업무단위별로 AS-IS와 TO-BE를 작성하세요:
- lv1: LV1 업무 분류
- lv2: LV2 업무명
- asIs: 현행 업무 방식 (수기/이메일/전화 등 현재 문제점 포함)
- toBe: 목표 업무 방식 (시스템화 후 개선 방향)
- improvement: 기대 효과 (효율성/정확성/시간단축 등)
- changeType: 변화 유형 (신규도입/업무개선/자동화/폐지 중 하나)

JSON만 응답:
{"items":[{"lv1":"","lv2":"","asIs":"","toBe":"","improvement":"","changeType":"업무개선"}]}`
                        }]
                      }),
                    });
                    const data = await response.json();
                    const text = data.content.map(c=>c.type==='text'?c.text:'').join('');
                    const start=text.indexOf('{'); const end=text.lastIndexOf('}');
                    const parsed = JSON.parse(text.slice(start,end+1));
                    const withId = (parsed.items||[]).map((a,i)=>({...a,id:Date.now()+i}));
                    setAsisList(withId);
                    saveProject({ asisList: withId });
                  } catch(err) { alert('오류: '+err.message); }
                  finally { setAsisLoading(false); }
                }}
                disabled={asisLoading}
                style={{ background:'#2563eb',color:'#fff',border:'none',borderRadius:6,padding:'7px 16px',fontSize:13,fontWeight:600,cursor:'pointer',opacity:asisLoading?0.6:1 }}
              >
                {asisLoading ? '⚙️ AI 생성 중...' : 'AI AS-IS/TO-BE 생성'}
              </button>
              <button
                onClick={() => {
                  const updated = [...asisList, { id:Date.now(), lv1:'', lv2:'', asIs:'', toBe:'', improvement:'', changeType:'업무개선' }];
                  setAsisList(updated); saveProject({ asisList: updated });
                }}
                style={{ background:'#eff6ff',color:'#2563eb',border:'1px solid #bfdbfe',borderRadius:6,padding:'7px 14px',fontSize:13,fontWeight:500,cursor:'pointer' }}
              >+ 행 추가</button>
              <button
                onClick={() => {
                  const rows = asisList.map(a=>({'LV1':a.lv1,'LV2':a.lv2,'AS-IS(현행)':a.asIs,'TO-BE(목표)':a.toBe,'기대효과':a.improvement,'변화유형':a.changeType}));
                  const wb=XLSX.utils.book_new();
                  const ws=XLSX.utils.json_to_sheet(rows);
                  ws['!cols']=[{wch:15},{wch:20},{wch:40},{wch:40},{wch:30},{wch:12}];
                  XLSX.utils.book_append_sheet(wb,ws,'AS-IS_TO-BE');
                  const buf=XLSX.write(wb,{bookType:'xlsx',type:'array'});
                  saveAs(new Blob([buf]),project.name+'_ASIS_TOBE.xlsx');
                }}
                style={{ background:'#16a34a',color:'#fff',border:'none',borderRadius:6,padding:'7px 14px',fontSize:13,fontWeight:600,cursor:'pointer' }}
              >Excel 출력</button>
            </div>
          </div>

          {asisList.length === 0 ? (
            <div style={{ textAlign:'center',padding:'60px 0',color:'#9ca3af',border:'2px dashed #e5e7eb',borderRadius:12 }}>
              <div style={{ fontSize:40,marginBottom:12 }}>🔄</div>
              <p style={{ fontSize:15,marginBottom:8 }}>AS-IS/TO-BE 분석이 없습니다</p>
              <p style={{ fontSize:13 }}>기능 목록 생성 후 AI AS-IS/TO-BE 생성 버튼을 클릭하세요</p>
            </div>
          ) : (
            <div style={{ display:'flex',flexDirection:'column',gap:16 }}>
              {/* 변화유형 범례 */}
              <div style={{ display:'flex',gap:8,flexWrap:'wrap' }}>
                {[
                  { type:'신규도입', bg:'#dbeafe', color:'#1e40af' },
                  { type:'업무개선', bg:'#f0fdf4', color:'#166534' },
                  { type:'자동화', bg:'#fdf4ff', color:'#7e22ce' },
                  { type:'폐지', bg:'#f3f4f6', color:'#374151' },
                ].map(t => (
                  <span key={t.type} style={{ fontSize:11,padding:'2px 8px',borderRadius:4,background:t.bg,color:t.color,fontWeight:600 }}>
                    {t.type} {asisList.filter(a=>a.changeType===t.type).length}개
                  </span>
                ))}
              </div>

              {/* AS-IS/TO-BE 카드 */}
              {asisList.map((a) => {
                const typeColors = {
                  '신규도입': { bg:'#dbeafe', color:'#1e40af', border:'#93c5fd' },
                  '업무개선': { bg:'#f0fdf4', color:'#166534', border:'#86efac' },
                  '자동화': { bg:'#fdf4ff', color:'#7e22ce', border:'#d8b4fe' },
                  '폐지': { bg:'#f3f4f6', color:'#374151', border:'#d1d5db' },
                };
                const tc = typeColors[a.changeType] || typeColors['업무개선'];
                return (
                  <div key={a.id} style={{ border:`1px solid ${tc.border}`,borderRadius:12,overflow:'hidden' }}>
                    {/* 카드 헤더 */}
                    <div style={{ background:tc.bg,padding:'10px 16px',display:'flex',alignItems:'center',gap:10 }}>
                      <span style={{ fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:4,background:'#fff',color:tc.color }}>{a.changeType}</span>
                      <input value={a.lv1||''} onChange={e=>{const u=asisList.map(r=>r.id===a.id?{...r,lv1:e.target.value}:r);setAsisList(u);saveProject({asisList:u});}} placeholder="LV1" style={{ fontSize:12,border:'none',outline:'none',background:'transparent',color:tc.color,fontWeight:600,width:100 }} />
                      <span style={{ color:tc.color }}>›</span>
                      <input value={a.lv2||''} onChange={e=>{const u=asisList.map(r=>r.id===a.id?{...r,lv2:e.target.value}:r);setAsisList(u);saveProject({asisList:u});}} placeholder="LV2 업무명" style={{ fontSize:13,border:'none',outline:'none',background:'transparent',color:tc.color,fontWeight:700,flex:1 }} />
                      <select value={a.changeType||'업무개선'} onChange={e=>{const u=asisList.map(r=>r.id===a.id?{...r,changeType:e.target.value}:r);setAsisList(u);saveProject({asisList:u});}} style={{ fontSize:11,border:'1px solid '+tc.border,borderRadius:4,padding:'2px 6px',background:'#fff',color:tc.color,fontWeight:600 }}>
                        {['신규도입','업무개선','자동화','폐지'].map(t=><option key={t}>{t}</option>)}
                      </select>
                      <button onClick={()=>{const u=asisList.filter(r=>r.id!==a.id);setAsisList(u);saveProject({asisList:u});}} style={{ background:'none',border:'none',color:'#ef4444',cursor:'pointer',fontSize:16,padding:'0 4px' }}>✕</button>
                    </div>

                    {/* AS-IS / TO-BE 비교 */}
                    <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:0 }}>
                      {/* AS-IS */}
                      <div style={{ padding:'14px 16px',borderRight:'1px solid #e5e7eb' }}>
                        <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:8 }}>
                          <span style={{ fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:4,background:'#fee2e2',color:'#dc2626' }}>AS-IS 현행</span>
                        </div>
                        <textarea
                          value={a.asIs||''}
                          onChange={e=>{const u=asisList.map(r=>r.id===a.id?{...r,asIs:e.target.value}:r);setAsisList(u);saveProject({asisList:u});}}
                          placeholder="현재 업무 방식, 문제점 입력..."
                          rows={4}
                          style={{ width:'100%',border:'1px solid #fca5a5',borderRadius:6,padding:'8px 10px',fontSize:12,resize:'vertical',fontFamily:'inherit',lineHeight:1.6,outline:'none',boxSizing:'border-box' }}
                        />
                      </div>

                      {/* TO-BE */}
                      <div style={{ padding:'14px 16px' }}>
                        <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:8 }}>
                          <span style={{ fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:4,background:'#dcfce7',color:'#16a34a' }}>TO-BE 목표</span>
                        </div>
                        <textarea
                          value={a.toBe||''}
                          onChange={e=>{const u=asisList.map(r=>r.id===a.id?{...r,toBe:e.target.value}:r);setAsisList(u);saveProject({asisList:u});}}
                          placeholder="목표 업무 방식, 개선 방향 입력..."
                          rows={4}
                          style={{ width:'100%',border:'1px solid #86efac',borderRadius:6,padding:'8px 10px',fontSize:12,resize:'vertical',fontFamily:'inherit',lineHeight:1.6,outline:'none',boxSizing:'border-box' }}
                        />
                      </div>
                    </div>

                    {/* 기대효과 */}
                    <div style={{ padding:'10px 16px',borderTop:'1px solid #e5e7eb',background:'#fafafa',display:'flex',alignItems:'center',gap:8 }}>
                      <span style={{ fontSize:11,fontWeight:600,color:'#6b7280',whiteSpace:'nowrap' }}>💡 기대효과:</span>
                      <input
                        value={a.improvement||''}
                        onChange={e=>{const u=asisList.map(r=>r.id===a.id?{...r,improvement:e.target.value}:r);setAsisList(u);saveProject({asisList:u});}}
                        placeholder="업무 효율화, 오류 감소, 처리 시간 단축 등..."
                        style={{ flex:1,border:'none',outline:'none',fontSize:12,background:'transparent',color:'#374151' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProjectDetail;
