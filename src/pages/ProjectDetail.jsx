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
        </div>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', borderBottom: '2px solid #e5e7eb', marginBottom: 24 }}>
        {[{ key: 'setup', label: '① 시스템 개요' }, { key: 'functions', label: '② 기능 목록' }, { key: 'fp', label: '③ FP 산정표' }].map((t) => (
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
    </div>
  );
};

export default ProjectDetail;
