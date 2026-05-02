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
  const [crudMatrix, setCrudMatrix] = useState(project?.crudMatrix || { entities: [], matrix: {} });
  const [crudLoading, setCrudLoading] = useState(false);

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
    setLoading(true);
    setLoadingMsg('AI가 기능 목록 생성 중...');
    try {
      saveProject({ systemName, systemOverview, mainFunctions, relatedOrgs });
      const result = await generateFunctions(systemInfo, keyword);
      const withId = result.map((f, i) => ({ ...f, id: Date.now() + i }));
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 20 }}>←</button>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{project.name}</h2>
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
          <button onClick={() => navigate('/project/' + id + '/cost')} style={{ background: '#7e22ce', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            💰 개발비 산출
          </button>
        </div>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', borderBottom: '2px solid #e5e7eb', marginBottom: 24 }}>
        {[{ key: 'setup', label: '① 시스템 개요' }, { key: 'functions', label: '② 기능 목록' }, { key: 'fp', label: '③ FP 산정표' }, { key: 'screens', label: '④ 화면 목록' }, { key: 'requirements', label: '⑤ 요구사항 정의서' }, { key: 'crud', label: '⑥ CRUD 분석' }].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '10px 24px', fontSize: 14, fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer', borderBottom: tab === t.key ? '2px solid #2563eb' : '2px solid transparent', color: tab === t.key ? '#2563eb' : '#6b7280', marginBottom: -2 }}>
            {t.label}
          </button>
        ))}
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
                  키워드 입력 <span style={{ color: '#6b7280', fontWeight: 400 }}>(예: 연동계획, 연동운영)</span>
                </label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input value={keyword} onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleGenerateFunctions()} placeholder="키워드 입력 후 Enter 또는 버튼 클릭" style={{ ...inputStyle, flex: 1 }} />
                  <button onClick={handleGenerateFunctions} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    AI 기능목록 생성
                  </button>
                </div>
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
            <button onClick={addFPRow} style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 6, padding: '7px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>+ 행 추가</button>
          </div>

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
                        const letters = val.split('').filter(c => ['C','R','U','D'].includes(c));
                        return (
                          <td key={e} style={{ ...cellStyle, textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                              {letters.length > 0 ? letters.map((c, i) => (
                                <span key={i} style={{ fontSize: 11, padding: '1px 5px', borderRadius: 3, background: CRUD_COLORS[c]?.bg, color: CRUD_COLORS[c]?.color, fontWeight: 700 }}>{c}</span>
                              )) : (
                                <select value={val} onChange={ev => updateCrud(fi, e, ev.target.value)}
                                  style={{ fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 4, padding: '1px 2px', width: 55, textAlign: 'center', background: '#f9fafb' }}>
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
                                </select>
                              )}
                            </div>
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
    </div>
  );
};

export default ProjectDetail;
