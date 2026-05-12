import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { generateFunctions, generateFPList, parseDocument, parseSystemInfo, generateISPSection, parseRFPLarge, parseRFPFull } from '../utils/claudeApi';
import { getWeight, getAvgWeight, getComplexity, getComplexityLabel, calcTotalFP, getChangePct, getFuncChangePct, getImpactFactor } from '../utils/fpCalculator';
import { getRFPParsePrompt, getValidationPrompt, getRegenFromReqPrompt, getQualityCheckPrompt, getFPValidationPrompt, getISPDraftPrompt } from '../utils/systemPrompt';
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
// 강화된 JSON 파싱 헬퍼 (잘림 방지)
// ============================================================
const safeParseJSON = (text) => {
  // 마크다운 제거
  let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();

  // 1차: 그대로 파싱
  try { return JSON.parse(clean); } catch (e1) {}

  // JSON 시작점 찾기
  const start = clean.indexOf('{');
  if (start === -1) throw new Error('JSON을 찾을 수 없습니다.');
  clean = clean.slice(start);

  // 2차: 끝에서부터 } 찾아서 파싱 시도
  let end = clean.length;
  while (end > 0) {
    const candidate = clean.slice(0, end);
    const lastBrace = candidate.lastIndexOf('}');
    if (lastBrace === -1) break;
    try {
      return JSON.parse(candidate.slice(0, lastBrace + 1));
    } catch (e) {
      end = lastBrace;
    }
  }

  // 3차: 잘린 배열 복구 - 마지막 완전한 객체 }까지 자르고 닫기
  const tryFix = (str) => {
    // 열린 배열/객체 카운트
    let depth = 0;
    let lastCompleteObj = -1;
    for (let i = 0; i < str.length; i++) {
      if (str[i] === '{') depth++;
      if (str[i] === '}') {
        depth--;
        if (depth === 1) lastCompleteObj = i; // 최상위 배열 안의 완전한 객체
      }
    }
    if (lastCompleteObj > 0) {
      // 마지막 완전한 객체 뒤에 ]} 붙이기
      const truncated = str.slice(0, lastCompleteObj + 1);
      // 열린 배열 닫기
      const opens = (truncated.match(/\[/g) || []).length;
      const closes = (truncated.match(/\]/g) || []).length;
      const suffix = ']'.repeat(Math.max(0, opens - closes)) + '}';
      try { return JSON.parse(truncated + suffix); } catch (e) {}
    }
    return null;
  };

  const fixed = tryFix(clean);
  if (fixed) return fixed;

  throw new Error('JSON 파싱 실패 (응답이 잘렸습니다)');
};

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

  // 역산 관련 state
  const [showReversePanel, setShowReversePanel] = useState(false);
  const [reverseTarget, setReverseTarget] = useState('');
  const [reverseUnitPrice, setReverseUnitPrice] = useState(605784);
  const [reverseCoeff, setReverseCoeff] = useState(1.0);

  // 요구사항 검증 state
  const [rfpText, setRfpText] = useState(project?.rfpText || '');
  const [validationResult, setValidationResult] = useState(project?.validationResult || null);
  const [validationLoading, setValidationLoading] = useState(false);
  const [showValidationPanel, setShowValidationPanel] = useState(false);
  // ISP 정보화전략계획서 state
  const [ispDraft, setIspDraft] = useState(project?.ispDraft || null);
  const [ispLoading, setIspLoading] = useState(false);
  const [ispLoadingSection, setIspLoadingSection] = useState("");
  const [ispEditMode, setIspEditMode] = useState(false);
  // RFP 파싱 진행률
  const [rfpParseStep, setRfpParseStep] = useState(0);   // 1~4
  const [rfpParseMsg, setRfpParseMsg] = useState('');
  const [rfpParsePct, setRfpParsePct] = useState(0);
  // 기능 품질 검증 state
  const [qualityResult, setQualityResult] = useState(project?.qualityResult || null);
  const [qualityLoading, setQualityLoading] = useState(false);
  const [showQualityPanel, setShowQualityPanel] = useState(false);
  // FP 역검증 state
  const [fpValidResult, setFpValidResult] = useState(project?.fpValidResult || null);
  const [fpValidLoading, setFpValidLoading] = useState(false);
  // 통합 분석 패널
  const [showAnalysisPanel, setShowAnalysisPanel] = useState(false);
  const [validationStep, setValidationStep] = useState(0); // 0=대기 1=요구사항 2=품질 3=FP

  // ============================================================
  // 4. FP 검증 기능 (강화버전)
  // ============================================================
  const validateFP = () => {
    const issues = [];
    if (!fpList || fpList.length === 0) return issues;

    const ilfCount = fpList.filter(f => f.fpType === 'ILF').length;
    const eifCount = fpList.filter(f => f.fpType === 'EIF').length;
    const txList   = fpList.filter(f => ['EI','EO','EQ'].includes(f.fpType));
    const maxFtr   = txList.reduce((max, f) => Math.max(max, Number(f.ftr) || 0), 0);

    // ── 1. 중복 LV3 ───────────────────────────────────────────
    const lv3Names = fpList.map(f => f.lv3?.trim()).filter(Boolean);
    const duplicates = lv3Names.filter((n, i) => lv3Names.indexOf(n) !== i);
    [...new Set(duplicates)].forEach(name => {
      issues.push({ severity: 'error', type: '중복 기능', message: `"${name}" 기능이 중복 식별됩니다.` });
    });

    // ── 2. ILF 누락 경고 ──────────────────────────────────────
    if (ilfCount === 0 && fpList.length > 5) {
      issues.push({ severity: 'error', type: 'ILF 누락', message: `ILF(내부논리파일)가 없습니다. 시스템이 관리하는 주요 데이터 그룹(사용자정보, 신청정보, 기준코드 등)을 ILF로 추가해야 합니다.` });
    } else if (ilfCount < 3 && fpList.length > 20) {
      issues.push({ severity: 'warning', type: 'ILF 부족', message: `ILF가 ${ilfCount}개입니다. 기능 수 대비 ILF가 적습니다. (권장: 최소 3개 이상)` });
    }

    // ── 3. FTR > ILF+EIF 경고 ────────────────────────────────
    if (maxFtr > ilfCount + eifCount && txList.length > 0) {
      issues.push({ severity: 'warning', type: 'FTR/ILF 불일치', message: `최대 FTR(${maxFtr}) > ILF+EIF 수(${ilfCount + eifCount}). FTR은 참조하는 ILF/EIF 수이므로 ILF/EIF를 추가하거나 FTR을 줄여야 합니다.` });
    }

    // ── 4. EIF 확인 (외부연동 있으면 필요) ───────────────────
    const hasExternal = fpList.some(f =>
      (f.lv3 || '').match(/연동|인터페이스|외부|API|EIF|연계/)
    );
    if (hasExternal && eifCount === 0) {
      issues.push({ severity: 'info', type: 'EIF 검토', message: `외부연동/인터페이스 관련 기능이 있지만 EIF(외부연계파일)가 없습니다. 외부시스템 데이터를 참조한다면 EIF를 추가하세요.` });
    }

    // ── 5. 행별 FP유형 의심 검사 ─────────────────────────────
    fpList.forEach((f, i) => {
      const rowNum = i + 1;
      const name   = f.lv3 || `${rowNum}번째 행`;
      const lv3    = (f.lv3 || '').toLowerCase();
      const type   = f.fpType;

      // 필수값
      if (!f.lv3?.trim()) {
        issues.push({ severity: 'error', type: '필수값 누락', message: `${rowNum}번째 행: LV3(단위프로세스명)이 비어있습니다.` });
        return;
      }
      if (!type) {
        issues.push({ severity: 'error', type: 'FP유형 누락', message: `"${name}": FP유형이 선택되지 않았습니다.` });
        return;
      }

      // ILF/EIF 행은 트랜잭션 규칙 적용 안 함
      if (['ILF','EIF'].includes(type)) {
        const det = Number(f.det);
        const ret = Number(f.ftr); // ILF/EIF에서 ftr 필드는 RET
        if (ret < 1) issues.push({ severity: 'warning', type: 'RET 오류', message: `"${name}": RET=${ret} (ILF/EIF의 RET는 최소 1 이상)` });
        if (det < 5) issues.push({ severity: 'warning', type: 'DET 적음', message: `"${name}": DET=${det} (ILF/EIF의 DET는 보통 5~50)` });
        if (type === 'EIF' && f.reuseType === '기능변경') {
          issues.push({ severity: 'error', type: 'EIF 오류', message: `"${name}": EIF는 기능변경 측정 대상이 아닙니다.` });
        }
        return;
      }

      // 트랜잭션 유형 의심
      const isEI = type === 'EI';
      const isEO = type === 'EO';
      const isEQ = type === 'EQ';

      const hasCreate = lv3.match(/등록|신청|생성|작성|저장|입력|추가|발급|승인|반려|처리|설정|배포|업로드|일괄/);
      const hasModify = lv3.match(/수정|변경|편집|업데이트/);
      const hasDelete = lv3.match(/삭제|취소|폐기|철회/);
      const hasQuery  = lv3.match(/조회|검색|목록|리스트|현황|확인|출력|다운로드|뷰|보기/);
      const hasStat   = lv3.match(/통계|집계|분석|그래프|차트|보고서|현황도|대시보드/);

      if ((hasCreate || hasModify || hasDelete) && isEQ) {
        issues.push({ severity: 'warning', type: 'FP유형 의심', message: `"${name}": 등록/수정/삭제는 EI가 맞습니다. (현재: EQ)` });
      }
      if (hasQuery && !hasStat && isEI) {
        issues.push({ severity: 'warning', type: 'FP유형 의심', message: `"${name}": 조회/검색/목록은 EQ가 맞습니다. (현재: EI)` });
      }
      if (hasStat && isEQ) {
        issues.push({ severity: 'warning', type: 'FP유형 의심', message: `"${name}": 통계/보고서/집계는 EO가 맞습니다. (현재: EQ)` });
      }
      if (hasStat && isEI) {
        issues.push({ severity: 'warning', type: 'FP유형 의심', message: `"${name}": 통계/보고서/집계는 EO가 맞습니다. (현재: EI)` });
      }

      // FTR/DET 이상치
      const det = Number(f.det);
      const ftr = Number(f.ftr);
      if (ftr < 1) {
        issues.push({ severity: 'error', type: 'FTR 오류', message: `"${name}": FTR=${ftr} (트랜잭션은 최소 1 이상)` });
      }
      if (det < 2) {
        issues.push({ severity: 'warning', type: 'DET 적음', message: `"${name}": DET=${det} (최소 3 이상 권장)` });
      }
      if (det > 60 && isEI) {
        issues.push({ severity: 'info', type: 'DET 검토', message: `"${name}": DET=${det} (60 초과, EI 화면 필드 수 재확인)` });
      }
      if (ftr > ilfCount + eifCount && ilfCount > 0) {
        issues.push({ severity: 'info', type: 'FTR 검토', message: `"${name}": FTR=${ftr} > ILF+EIF(${ilfCount + eifCount}). FTR은 참조하는 ILF/EIF 수입니다.` });
      }
    });

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
    // 설치된 버전과 일치하는 worker 사용 (버전 하드코딩 제거)
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).toString();
    } catch {
      // fallback: worker 없이 실행 (느리지만 동작함)
      pdfjsLib.GlobalWorkerOptions.workerSrc = '';
    }
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
    // 같은 파일 재업로드 허용
    e.target.value = '';
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
      if (info.keywords?.length) setKeyword(Array.isArray(info.keywords) ? info.keywords.join(', ') : info.keywords);
      saveProject({ systemName: info.systemName || systemName, systemOverview: info.overview || systemOverview });
      setLoadingMsg('');
      // alert 대신 탭 내 결과 표시로 대체 (업로드 완료 상태는 UI에서 확인)
    } catch (err) {
      alert('파일 분석 오류: ' + err.message);
      setUploadedFileName('');
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  };

  const handleFuncDefUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
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
      if (!parsed || parsed.length === 0) {
        throw new Error('기능 목록을 추출할 수 없습니다. 파일 형식을 확인하세요.');
      }
      const withId = parsed.map((f, i) => ({ ...f, id: Date.now() + i }));
      setFunctions(withId);
      saveProject({ functions: withId });
      setTab('functions');
    } catch (err) {
      alert('기능정의서 파싱 오류: ' + err.message);
      setUploadedFuncFileName('');
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  };

  // RFP(제안요청서) 업로드 → 기능요구사항 추출 → 기능목록 생성
  const handleRFPUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    setLoading(true);
    setRfpParseStep(0);
    setRfpParsePct(0);
    setRfpParseMsg('RFP 파일 읽는 중...');
    setLoadingMsg('RFP 파일 읽는 중...');
    try {
      let text = '';

      if (isImageFile(file)) {
        alert('이미지 RFP는 현재 지원하지 않습니다. PDF 또는 Word 파일로 업로드해주세요.');
        return;
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
      } else if (file.name.endsWith('.txt')) {
        text = await file.text();
      } else {
        throw new Error('HWP는 PDF로 변환 후 업로드해주세요. (한글 → 다른 이름으로 저장 → PDF)');
      }

      if (!text || text.trim().length < 50) {
        throw new Error('문서에서 텍스트를 추출할 수 없습니다. 스캔본 PDF는 텍스트 추출이 안 됩니다.');
      }

      const rfpFull = text.slice(0, 20000);
      setRfpText(rfpFull);
      saveProject({ rfpText: rfpFull });

      const result = await parseRFPFull(text, (step, msg, pct) => {
        setRfpParseStep(step);
        setRfpParseMsg(msg);
        setRfpParsePct(pct);
        setLoadingMsg(msg);
      });

      if (result.systemName) setSystemName(result.systemName);
      if (result.overview)   setSystemOverview(result.overview);

      let funcs = result.functions || [];

      if (funcs.length < 10) {
        const fallback = [
          { lv1:'공통기능', lv2:'사용자관리', lv3:'사용자 등록', definition:'사용자 정보를 등록한다' },
          { lv1:'공통기능', lv2:'사용자관리', lv3:'사용자 수정', definition:'사용자 정보를 수정한다' },
          { lv1:'공통기능', lv2:'사용자관리', lv3:'사용자 삭제', definition:'사용자 정보를 삭제한다' },
          { lv1:'공통기능', lv2:'사용자관리', lv3:'사용자 목록조회', definition:'사용자 목록을 조회한다' },
          { lv1:'공통기능', lv2:'사용자관리', lv3:'사용자 상세조회', definition:'사용자 상세 정보를 조회한다' },
          { lv1:'공통기능', lv2:'권한관리', lv3:'권한 등록', definition:'권한 정보를 등록한다' },
          { lv1:'공통기능', lv2:'권한관리', lv3:'권한 목록조회', definition:'권한 목록을 조회한다' },
          { lv1:'공통기능', lv2:'시스템관리', lv3:'공통코드 관리', definition:'공통코드를 관리한다' },
          { lv1:'공통기능', lv2:'시스템관리', lv3:'메뉴 관리', definition:'메뉴 정보를 관리한다' },
          { lv1:'공통기능', lv2:'시스템관리', lv3:'시스템 로그 조회', definition:'시스템 로그를 조회한다' },
        ];
        const existingKeys = new Set(funcs.map(f => `${f.lv1}|${f.lv2}|${f.lv3}`));
        funcs = [...funcs, ...fallback.filter(f => !existingKeys.has(`${f.lv1}|${f.lv2}|${f.lv3}`))];
      }

      const withId = funcs.map((f, i) => ({ ...f, id: Date.now() + i }));
      setFunctions(withId);
      saveProject({
        functions: withId,
        systemName: result.systemName || systemName,
        systemOverview: result.overview || systemOverview,
      });
      setUploadedFuncFileName(file.name + ' (RFP)');
      setRfpParseStep(0);
      setTab('functions');
      alert(`✅ RFP 분석 완료!\n총 ${withId.length}개 기능목록 생성\n\n💡 불필요한 기능을 삭제하거나 추가 후 FP 산정으로 이동하세요.`);
    } catch (err) {
      alert('RFP 파싱 오류: ' + err.message);
    } finally {
      setLoading(false);
      setLoadingMsg('');
      setRfpParseStep(0);
      setRfpParsePct(0);
      setRfpParseMsg('');
    }
  };

  // ISP 정보화전략계획서 전체 생성
  const handleGenerateISP = async () => {
    if (!rfpText && functions.length === 0) {
      alert('RFP를 먼저 업로드하거나 기능목록을 생성해주세요.');
      return;
    }
    setIspLoading(true);
    const sections = ['executive', 'background', 'asIs', 'toBe', 'requirements', 'implementation'];
    const sectionNames = {
      executive: '경영진 요약',
      background: '사업 배경 및 목적',
      asIs: '현황 분석(AS-IS)',
      toBe: '목표 시스템(TO-BE)',
      requirements: '기능 요구사항',
      implementation: '구현 전략 및 로드맵',
    };
    const draft = {};
    try {
      for (const sec of sections) {
        setIspLoadingSection(sectionNames[sec]);
        const result = await generateISPSection(sec, rfpText, systemName, systemOverview, functions);
        draft[sec] = result;
      }
      setIspDraft(draft);
      saveProject({ ispDraft: draft });
      alert('✅ 정보화전략계획서 초안 생성 완료!');
    } catch (err) {
      alert('ISP 계획서 생성 오류: ' + err.message);
    } finally {
      setIspLoading(false);
      setIspLoadingSection('');
    }
  };

  // ISP Word 출력
  const handleISPWordExport = async () => {
    if (!ispDraft) { alert('먼저 계획서 초안을 생성해주세요.'); return; }
    try {
      const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } = await import('docx');
      const children = [];
      const addHeading = (text, level) => children.push(
        new Paragraph({ heading: level, children: [new TextRun({ text, bold: true })] })
      );
      const addText = (text) => children.push(
        new Paragraph({ children: [new TextRun({ text: text || '' })] })
      );
      const addBullet = (text) => children.push(
        new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: text || '' })] })
      );
      const addSpace = () => children.push(new Paragraph({ children: [] }));

      // 표지
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 2880, after: 480 },
        children: [new TextRun({ text: systemName || '정보화전략계획서', size: 48, bold: true })],
      }));
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: '정보화전략계획서(ISP)', size: 32, color: '1e40af' })],
      }));
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 960 },
        children: [new TextRun({ text: new Date().getFullYear() + '년', size: 24, color: '6b7280' })],
      }));
      addSpace(); addSpace();

      const sectionOrder = ['executive', 'background', 'asIs', 'toBe', 'requirements', 'implementation'];
      const sectionNums = { executive: '1', background: '2', asIs: '3', toBe: '4', requirements: '5', implementation: '6' };

      for (const sec of sectionOrder) {
        const d = ispDraft[sec];
        if (!d) continue;
        addHeading(`${sectionNums[sec]}. ${d.title || sec}`, HeadingLevel.HEADING_1);
        addSpace();

        if (sec === 'executive') {
          addText(d.content || '');
          addSpace();
          if (d.keyPoints?.length) {
            addText('■ 핵심 포인트');
            d.keyPoints.forEach(p => addBullet(p));
          }
          addSpace();
          if (d.investmentValue) { addText('■ 투자 가치'); addText(d.investmentValue); }
        } else if (sec === 'background') {
          addHeading('2.1 사업 추진 배경', HeadingLevel.HEADING_2);
          addText(d.background || '');
          addSpace();
          addHeading('2.2 사업 목적', HeadingLevel.HEADING_2);
          addText(d.purpose || '');
          addSpace();
          if (d.goals?.length) {
            addHeading('2.3 추진 목표', HeadingLevel.HEADING_2);
            d.goals.forEach(g => addBullet(g));
          }
          addSpace();
          if (d.scope) { addHeading('2.4 사업 범위', HeadingLevel.HEADING_2); addText(d.scope); }
        } else if (sec === 'asIs') {
          addHeading('3.1 현재 업무 현황', HeadingLevel.HEADING_2);
          addText(d.currentStatus || '');
          addSpace();
          if (d.problems?.length) {
            addHeading('3.2 주요 문제점', HeadingLevel.HEADING_2);
            d.problems.forEach(p => addBullet(p));
          }
          addSpace();
          if (d.limitations) { addHeading('3.3 현재 시스템 한계', HeadingLevel.HEADING_2); addText(d.limitations); }
          addSpace();
          if (d.improvementNeeds) { addHeading('3.4 개선 필요사항', HeadingLevel.HEADING_2); addText(d.improvementNeeds); }
        } else if (sec === 'toBe') {
          if (d.vision) { addHeading('4.1 목표 시스템 비전', HeadingLevel.HEADING_2); addText(d.vision); addSpace(); }
          if (d.architecture) { addHeading('4.2 시스템 아키텍처', HeadingLevel.HEADING_2); addText(d.architecture); addSpace(); }
          if (d.coreFeatures?.length) {
            addHeading('4.3 핵심 기능', HeadingLevel.HEADING_2);
            d.coreFeatures.forEach(f => addBullet(f));
            addSpace();
          }
          if (d.expectedEffects?.length) {
            addHeading('4.4 기대 효과', HeadingLevel.HEADING_2);
            d.expectedEffects.forEach(e => addBullet(e));
            addSpace();
          }
          if (d.technicalStack) { addHeading('4.5 기술 스택', HeadingLevel.HEADING_2); addText(d.technicalStack); }
        } else if (sec === 'requirements') {
          addText(d.summary || '');
          addSpace();
          if (d.functionalAreas?.length) {
            addHeading('5.1 기능 요구사항', HeadingLevel.HEADING_2);
            d.functionalAreas.forEach(area => {
              children.push(new Paragraph({ children: [new TextRun({ text: `▶ ${area.area}`, bold: true })] }));
              addText(area.description || '');
              area.keyFunctions?.forEach(f => addBullet(f));
              addSpace();
            });
          }
          if (d.nonFunctional?.length) {
            addHeading('5.2 비기능 요구사항', HeadingLevel.HEADING_2);
            d.nonFunctional.forEach(r => addBullet(r));
          }
        } else if (sec === 'implementation') {
          if (d.strategy) { addHeading('6.1 구현 전략', HeadingLevel.HEADING_2); addText(d.strategy); addSpace(); }
          if (d.phases?.length) {
            addHeading('6.2 추진 로드맵', HeadingLevel.HEADING_2);
            d.phases.forEach(ph => {
              children.push(new Paragraph({ children: [new TextRun({ text: `${ph.phase} (${ph.period})`, bold: true, color: '1e40af' })] }));
              ph.tasks?.forEach(t => addBullet(`과제: ${t}`));
              ph.deliverables?.forEach(dl => addBullet(`산출물: ${dl}`));
              addSpace();
            });
          }
          if (d.risks?.length) {
            addHeading('6.3 리스크 관리', HeadingLevel.HEADING_2);
            d.risks.forEach(r => addBullet(r));
            addSpace();
          }
          if (d.successFactors?.length) {
            addHeading('6.4 성공 요인', HeadingLevel.HEADING_2);
            d.successFactors.forEach(s => addBullet(s));
          }
        }
        addSpace();
      }

      const doc = new Document({
        styles: {
          default: { document: { run: { font: '맑은 고딕', size: 22 } } },
          paragraphStyles: [
            { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
              run: { size: 32, bold: true, color: '1e3a8a', font: '맑은 고딕' },
              paragraph: { spacing: { before: 400, after: 200 }, outlineLevel: 0,
                border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '1e40af', space: 4 } } } },
            { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
              run: { size: 24, bold: true, color: '1d4ed8', font: '맑은 고딕' },
              paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
          ],
        },
        sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1134, bottom: 1440, left: 1701 } } }, children }],
      });

      const buffer = await Packer.toBuffer(doc);
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${systemName || '정보화전략계획서'}_ISP초안.docx`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Word 출력 오류: ' + err.message);
    }
  };

  const handleGenerateFunctions = async () => {
    if (!systemName.trim()) return alert('시스템명을 입력하세요.');
    if (!systemOverview.trim()) return alert('시스템 개요를 입력하세요.');

    // AI 재생성 경고
    if (functions.length > 0) {
      const ok = window.confirm(`기존 기능 목록 ${functions.length}개가 있습니다.\nAI 재생성 시 기존 데이터가 덮어쓰기 됩니다.\n계속하시겠습니까?`);
      if (!ok) return;
    }

    const keywords = keyword.trim()
      ? keyword.split(/[,，\s]+/).map(k => k.trim()).filter(k => k)
      : [];

    setLoading(true);
    setLoadingMsg(keywords.length > 0
      ? `AI가 기능 목록 생성 중... (키워드 ${keywords.length}개)`
      : 'AI가 시스템을 분석하여 기능 목록 생성 중...'
    );

    try {
      saveProject({ systemName, systemOverview, mainFunctions, relatedOrgs });
      let allFunctions = [];

      if (keywords.length > 0) {
        // 키워드별 청크 생성
        for (let i = 0; i < keywords.length; i++) {
          setLoadingMsg(`AI가 기능 목록 생성 중... (${i + 1}/${keywords.length}: ${keywords[i]})`);
          const result = await generateFunctions(systemInfo, keywords[i]);
          allFunctions = [...allFunctions, ...result];
        }
      } else {
        // 키워드 없음 → 시스템명+개요로 전체 자동 생성
        setLoadingMsg('AI가 시스템 분석 후 전체 기능목록 자동 생성 중...');
        const result = await generateFunctions(systemInfo, '');
        allFunctions = result;
      }

      // 중복 제거 (lv1+lv2+lv3 조합 기준)
      const seen = new Set();
      const unique = allFunctions.filter(f => {
        const key = `${f.lv1}|${f.lv2}|${f.lv3}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const withId = unique.map((f, i) => ({ ...f, id: Date.now() + i }));
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
  const exportAllExcel = async () => {
    if (!functions.length && !fpList.length) {
      alert('출력할 데이터가 없습니다. 먼저 기능목록을 생성하세요.');
      return;
    }
    try {
      const { exportAllExcelNew } = await import('../utils/excelExport');
      await exportAllExcelNew({
        functions, fpList, screenList, reqList,
        crudMatrix, ifList, wbsList, traceList, tcList, asisList,
        systemName, projectNameStr: systemName, manager: '',
      }, project.name);
    } catch (err) {
      alert('Excel 출력 오류: ' + err.message);
    }
  };

  const exportExcel = async () => {
    if (!fpList.length) { alert('FP 산정 데이터가 없습니다.'); return; }
    try {
      const { exportFPExcel } = await import('../utils/excelExport');
      await exportFPExcel(fpList, { systemName, projectName: project.name }, 'both');
    } catch (err) {
      alert('Excel 출력 오류: ' + err.message);
    }
  };

  // 탭별 Excel 출력 함수들
  const exportTabExcel = async (tabName, headers, rows, colWidths = []) => {
    try {
      const { exportGenericExcel } = await import('../utils/excelExport');
      await exportGenericExcel(tabName, headers, rows, colWidths, project.name);
    } catch (err) {
      alert('Excel 출력 오류: ' + err.message);
    }
  };

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
      const parsed = safeParseJSON(text);
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

  const exportScreenExcel = async () => {
    const { exportGenericExcel } = await import('../utils/excelExport');
    await exportGenericExcel('화면목록',
      ['화면ID','화면명','화면유형','LV1','LV2','관련기능','비고'],
      screenList.map(s => ({ '화면ID': s.screenId, '화면명': s.screenName, '화면유형': s.screenType, 'LV1': s.lv1, 'LV2': s.lv2, '관련기능': s.relatedFunctions, '비고': s.note||'' })),
      [12,25,12,15,15,40,15], project.name
    );
  };

  const SCREEN_TYPES = ['목록화면', '상세화면', '등록화면', '수정화면', '팝업', '대시보드', '보고서', '기타'];

  // 요구사항 AI 자동 생성
  const handleGenerateRequirements = async () => {
    if (functions.length === 0) return alert('기능 목록을 먼저 생성하세요.');
    if (reqList.length > 0 && !window.confirm('기존 요구사항을 덮어쓰시겠습니까?')) return;
    setReqLoading(true);
    try {
      // 기능을 10개씩 나눠서 처리 (JSON 잘림 방지)
      const chunkSize = 10;
      const chunks = [];
      for (let i = 0; i < functions.length; i += chunkSize) {
        chunks.push(functions.slice(i, i + chunkSize));
      }

      let allReqs = [];
      let frNum = 1;

      for (let ci = 0; ci < chunks.length; ci++) {
        const chunk = chunks[ci];
        const response = await fetch('/api/claude', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{
              role: 'user',
              content: `SW사업 BA 전문가입니다. 아래 기능 목록으로 요구사항을 작성하세요.

기능 목록 (${ci + 1}/${chunks.length} 묶음):
${JSON.stringify(chunk.map(f => ({ lv2: f.lv2, lv3: f.lv3 })), null, 2)}

화면 목록:
${JSON.stringify(screenList.slice(0, 10).map(s => ({ screenId: s.screenId, screenName: s.screenName })), null, 2)}

규칙:
- 기능 요구사항(FR): 각 LV3 기능당 정확히 1개만 생성 (짧고 명확하게)
- NFR/CON은 마지막 묶음(${ci === chunks.length - 1 ? '이번' : '제외'})에만 각 2개씩 추가
- reqId는 FR-${String(frNum).padStart(3,'0')}부터 순서대로
- detail은 30자 이내로 간결하게

JSON만 응답:
{"requirements":[{"reqId":"FR-${String(frNum).padStart(3,'0')}","type":"기능","reqName":"","detail":"시스템은 ~할 수 있어야 한다","relatedScreen":"","priority":"중","note":""}]}`
            }]
          }),
        });

        const data = await response.json();
        const text = data.content.map(c => c.type === 'text' ? c.text : '').join('');

        // JSON 추출 (잘림 방지 - 마지막 완전한 객체까지만 파싱)
        const start = text.indexOf('{');
        let end = text.lastIndexOf('}');
        if (start === -1 || end === -1) continue;

        let jsonStr = text.slice(start, end + 1);

        // JSON이 잘렸을 경우 복구 시도
        try {
          const parsed = JSON.parse(jsonStr);
          const items = (parsed.requirements || []).map((r, i) => ({
            ...r,
            id: Date.now() + allReqs.length + i,
          }));
          allReqs = [...allReqs, ...items];
          frNum += items.filter(r => r.type === '기능').length;
        } catch (parseErr) {
          // 잘린 JSON 복구: 마지막 완전한 객체까지만 추출
          const lastComplete = jsonStr.lastIndexOf('},');
          if (lastComplete > 0) {
            jsonStr = jsonStr.slice(0, lastComplete + 1) + ']}';
            try {
              const parsed = JSON.parse(jsonStr);
              const items = (parsed.requirements || []).map((r, i) => ({
                ...r,
                id: Date.now() + allReqs.length + i,
              }));
              allReqs = [...allReqs, ...items];
              frNum += items.filter(r => r.type === '기능').length;
            } catch (e) {
              console.error('청크 파싱 실패:', ci, e);
            }
          }
        }
      }

      setReqList(allReqs);
      saveProject({ reqList: allReqs });
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

  const exportReqExcel = async () => {
    const { exportGenericExcel } = await import('../utils/excelExport');
    await exportGenericExcel('요구사항정의서',
      ['요구사항ID','유형','요구사항명','상세내용','관련화면','우선순위','비고'],
      reqList.map(r => ({ '요구사항ID': r.reqId, '유형': r.type, '요구사항명': r.reqName, '상세내용': r.detail, '관련화면': r.relatedScreen, '우선순위': r.priority, '비고': r.note||'' })),
      [12,10,25,50,12,10,15], project.name
    );
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
      const parsed = safeParseJSON(text);
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

  const exportCrudExcel = async () => {
    const entities = crudMatrix.entities || [];
    const matrix   = crudMatrix.matrix   || [];
    const { exportGenericExcel } = await import('../utils/excelExport');
    await exportGenericExcel('CRUD분석',
      ['LV1','LV2','LV3',...entities],
      matrix.map(f => ({ 'LV1':f.lv1,'LV2':f.lv2,'LV3':f.lv3,...Object.fromEntries(entities.map(e=>[e,f.crud?.[e]||''])) })),
      [15,15,25,...entities.map(()=>10)], project.name
    );
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

  const S = {
    wrap: { display:'flex', minHeight:'100vh', background:'#f0f4ff', fontFamily:"'Pretendard', -apple-system, 'Malgun Gothic', sans-serif" },
    sidebar: { width:200, flexShrink:0, background:'#1e3a8a', display:'flex', flexDirection:'column', position:'sticky', top:0, height:'100vh', overflowY:'auto' },
    sidebarLogo: { padding:'18px 16px 14px', borderBottom:'1px solid rgba(255,255,255,0.12)' },
    sidebarSection: { padding:'14px 10px 6px' },
    sidebarLabel: { color:'rgba(255,255,255,0.45)', fontSize:9, fontWeight:700, letterSpacing:'0.8px', textTransform:'uppercase', padding:'0 8px', marginBottom:4, display:'block' },
    navItem: (active) => ({ display:'flex', alignItems:'center', gap:8, padding:'7px 8px', borderRadius:6, cursor:'pointer', color: active?'#fff':'rgba(255,255,255,0.6)', fontSize:12, fontWeight: active?600:400, background: active?'rgba(255,255,255,0.15)':'transparent', marginBottom:1 }),
    navDot: (active) => ({ width:5, height:5, borderRadius:'50%', background: active?'#93c5fd':'rgba(255,255,255,0.3)', flexShrink:0 }),
    main: { flex:1, display:'flex', flexDirection:'column', minWidth:0 },
    topbar: { background:'#1e40af', borderBottom:'1px solid rgba(255,255,255,0.1)', padding:'0 24px', height:50, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:50 },
    breadcrumb: { display:'flex', alignItems:'center', gap:6, fontSize:12, color:'rgba(255,255,255,0.7)' },
    tabbar: { background:'#1d4ed8', borderBottom:'1px solid rgba(255,255,255,0.1)', padding:'0 24px', display:'flex', alignItems:'center', overflowX:'auto' },
    tab: (active, disabled) => ({ display:'flex', alignItems:'center', gap:5, padding:'11px 14px', fontSize:12, fontWeight: active?700:400, color: active?'#fff': disabled?'rgba(255,255,255,0.2)':'rgba(255,255,255,0.55)', cursor: disabled?'not-allowed':'pointer', whiteSpace:'nowrap', flexShrink:0, marginBottom:-1, background:'none', border:'none', borderBottomStyle:'solid', borderBottomWidth:2, borderBottomColor: active?'#fff':'transparent', opacity: disabled?0.4:1 }),
    tabCount: (active) => ({ background: active?'rgba(255,255,255,0.9)':'rgba(255,255,255,0.15)', color: active?'#1d4ed8':'rgba(255,255,255,0.7)', fontSize:10, padding:'1px 5px', borderRadius:8, fontWeight:600 }),
    content: { padding:'20px 24px', flex:1 },
    card: { background:'#fff', border:'1px solid #dbeafe', borderRadius:12, padding:'20px 22px', marginBottom:14 },
    label: { fontSize:10, fontWeight:700, color:'#3b82f6', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5, display:'flex', alignItems:'center', gap:3 },
    input: { width:'100%', padding:'8px 11px', border:'1.5px solid #dbeafe', borderRadius:7, fontSize:13, color:'#1e3a8a', background:'#f8faff', outline:'none', boxSizing:'border-box' },
    textarea: { width:'100%', padding:'9px 11px', border:'1.5px solid #dbeafe', borderRadius:7, fontSize:13, color:'#1e3a8a', background:'#f8faff', outline:'none', resize:'vertical', fontFamily:'inherit', boxSizing:'border-box' },
    btnPrimary: { background:'#1d4ed8', color:'#fff', border:'none', borderRadius:7, padding:'8px 16px', fontSize:12, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:6 },
    btnSecondary: { background:'#fff', color:'#1d4ed8', border:'1.5px solid #bfdbfe', borderRadius:7, padding:'8px 14px', fontSize:12, fontWeight:500, cursor:'pointer', display:'flex', alignItems:'center', gap:5 },
    btnSuccess: { background:'#16a34a', color:'#fff', border:'none', borderRadius:7, padding:'8px 14px', fontSize:12, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:5 },
    lv1Badge: { background:'#eff6ff', color:'#1d4ed8', padding:'2px 7px', borderRadius:4, fontSize:10, fontWeight:600, whiteSpace:'nowrap' },
    statusDot: { width:6, height:6, borderRadius:'50%', background:'#4ade80', display:'inline-block' },
    th: { padding:'8px 12px', textAlign:'left', fontSize:10, fontWeight:700, color:'#3b82f6', textTransform:'uppercase', letterSpacing:'0.4px', borderBottom:'2px solid #dbeafe', background:'#eff6ff', whiteSpace:'nowrap' },
    td: { padding:'8px 12px', borderBottom:'1px solid #eff6ff', fontSize:12, color:'#1e3a8a', verticalAlign:'middle' },
  };

  const inputStyle = S.input;
  const cellStyle  = S.td;

  const TAB_LABELS = [
    {key:'setup',        label:'시스템개요'},
    {key:'functions',    label:'기능목록',   count:functions.length},
    {key:'fp',           label:'FP산정표',   count:fpList.length},
    {key:'isp',          label:'ISP계획서',  count:ispDraft ? 6 : 0},
    {key:'screens',      label:'화면목록',   count:screenList.length, disabled:true},
    {key:'requirements', label:'요구사항',   count:reqList.length, disabled:true},
    {key:'crud',         label:'CRUD',       disabled:true},
    {key:'interface',    label:'인터페이스', count:ifList.length, disabled:true},
    {key:'wbs',          label:'WBS',        count:wbsList.length, disabled:true},
    {key:'traceability', label:'추적표',     count:traceList.length, disabled:true},
    {key:'testcase',     label:'테스트',     count:tcList.length, disabled:true},
    {key:'asis',         label:'AS-IS/TO-BE',disabled:true},
  ];

  return (
    <div style={S.wrap}>

    <div style={S.wrap}>

      {/* ── 사이드바 ── */}
      <div style={S.sidebar}>
        <div style={S.sidebarLogo}>
          <div style={{display:'flex',alignItems:'center',gap:9}}>
            <div style={{width:30,height:30,background:'#3b82f6',borderRadius:7,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:800,color:'#fff'}}>BA</div>
            <div>
              <div style={{color:'#fff',fontSize:13,fontWeight:700}}>BA 도우미</div>
              <div style={{color:'rgba(255,255,255,0.45)',fontSize:9,letterSpacing:'0.5px',textTransform:'uppercase',marginTop:1}}>CAS IT Consulting</div>
            </div>
          </div>
        </div>
        <div style={S.sidebarSection}>
          <span style={S.sidebarLabel}>현재 프로젝트</span>
          <div style={S.navItem(true)}>
            <div style={S.navDot(true)}/>
            <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:11}}>{project.name}</span>
          </div>
        </div>
        <div style={S.sidebarSection}>
          <span style={S.sidebarLabel}>이동</span>
          <div style={S.navItem(false)} onClick={()=>navigate('/')}>
            <div style={S.navDot(false)}/>
            <span>← 목록으로</span>
          </div>
          <div style={S.navItem(false)} onClick={()=>navigate('/project/'+id+'/cost')}>
            <div style={S.navDot(false)}/>
            <span>💰 개발비 산출</span>
          </div>
        </div>
        {fpList.length > 0 && (
          <div style={{margin:'auto 0 0',padding:'12px',borderTop:'1px solid rgba(255,255,255,0.1)'}}>
            <div style={{fontSize:9,color:'rgba(255,255,255,0.45)',fontWeight:700,letterSpacing:'0.8px',textTransform:'uppercase',marginBottom:6}}>FP 요약</div>
            {[['정통법 신규',stdSummary.newDev+' FP'],['정통법 변경',stdSummary.changed+' FP'],['간이법 신규',simpleSummary.newDev+' FP']].map(([l,v])=>(
              <div key={l} style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'rgba(255,255,255,0.6)',padding:'2px 0'}}>
                <span>{l}</span><span style={{color:'rgba(255,255,255,0.9)',fontWeight:600}}>{v}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{padding:'11px 12px',borderTop:'1px solid rgba(255,255,255,0.1)',marginTop:fpList.length>0?0:'auto'}}>
          <div style={{display:'flex',alignItems:'center',gap:5,fontSize:10,color:'rgba(255,255,255,0.5)'}}>
            <span style={S.statusDot}/><span>API 연결됨</span>
          </div>
        </div>
      </div>

      {/* ── 메인 ── */}
      <div style={S.main}>
        {/* 상단 바 */}
        <div style={S.topbar}>
          <div style={S.breadcrumb}>
            <span style={{color:'rgba(255,255,255,0.6)',cursor:'pointer'}} onClick={()=>navigate('/')}>프로젝트</span>
            <span style={{color:'rgba(255,255,255,0.3)'}}>›</span>
            <span style={{color:'#fff',fontWeight:600}}>{project.name}</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            {loading && <span style={{fontSize:11,color:'#bfdbfe',fontWeight:600}}>⚙️ {loadingMsg||'처리 중...'}</span>}
            <div style={{display:'flex',alignItems:'center',gap:4,fontSize:11,color:'rgba(255,255,255,0.6)'}}>
              <span style={S.statusDot}/><span>저장됨</span>
            </div>
            <button onClick={exportAllExcel} style={{...S.btnPrimary,background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.3)'}}>📥 전체 Excel</button>
          </div>
        </div>

        {/* 탭 바 */}
        <div style={S.tabbar}>
          {TAB_LABELS.map(t=>(
            <button key={t.key} onClick={()=>!t.disabled&&setTab(t.key)}
              style={{...S.tab(tab===t.key, t.disabled), borderBottom:`2px solid ${tab===t.key?'#111827':'transparent'}`}}>
              {t.label}
              {t.count!=null&&t.count>0&&<span style={S.tabCount(tab===t.key)}>{t.count}</span>}
            </button>
          ))}
        </div>

        {/* 로딩 오버레이 */}
        {loading && (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <div style={{background:'#fff',borderRadius:14,padding:'28px 36px',textAlign:'center',maxWidth:380,width:'90%'}}>
              {rfpParseStep > 0 ? (
                // RFP 4단계 파이프라인 진행률
                <>
                  <div style={{fontSize:28,marginBottom:10}}>📄</div>
                  <div style={{fontSize:15,fontWeight:700,color:'#1e3a8a',marginBottom:4}}>RFP 분석 중...</div>
                  <div style={{fontSize:12,color:'#6b7280',marginBottom:16,minHeight:18}}>{rfpParseMsg}</div>
                  {/* 진행바 */}
                  <div style={{background:'#e5e7eb',borderRadius:99,height:8,marginBottom:14,overflow:'hidden'}}>
                    <div style={{background:'linear-gradient(90deg,#1d4ed8,#3b82f6)',height:'100%',borderRadius:99,width:`${rfpParsePct}%`,transition:'width 0.4s ease'}}/>
                  </div>
                  {/* 4단계 표시 */}
                  <div style={{display:'flex',justifyContent:'space-between',gap:4}}>
                    {[
                      {n:1,label:'정보추출'},
                      {n:2,label:'요구사항수집'},
                      {n:3,label:'도메인분류'},
                      {n:4,label:'기능확장'},
                    ].map(s => (
                      <div key={s.n} style={{flex:1,textAlign:'center'}}>
                        <div style={{
                          width:28,height:28,borderRadius:'50%',margin:'0 auto 4px',
                          display:'flex',alignItems:'center',justifyContent:'center',
                          fontSize:12,fontWeight:700,
                          background: rfpParseStep > s.n ? '#16a34a' : rfpParseStep === s.n ? '#1d4ed8' : '#e5e7eb',
                          color: rfpParseStep >= s.n ? '#fff' : '#9ca3af',
                        }}>
                          {rfpParseStep > s.n ? '✓' : s.n}
                        </div>
                        <div style={{fontSize:9,color: rfpParseStep >= s.n ? '#1d4ed8':'#9ca3af',fontWeight: rfpParseStep===s.n?700:400}}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{fontSize:11,color:'#9ca3af',marginTop:12}}>약 1~3분 소요됩니다</div>
                </>
              ) : (
                // 일반 로딩
                <>
                  <div style={{fontSize:28,marginBottom:12}}>⚙️</div>
                  <div style={{fontSize:14,fontWeight:700,color:'#111827',marginBottom:6}}>AI 처리 중</div>
                  <div style={{fontSize:13,color:'#6b7280'}}>{loadingMsg||'잠시만 기다려주세요...'}</div>
                </>
              )}
            </div>
          </div>
        )}

        {/* 콘텐츠 */}

      {/* ── 메인 콘텐츠 ── */}
      <div style={{flex:1, display:'flex', flexDirection:'column', minWidth:0, overflowY:'auto'}}>

        {/* 탭 콘텐츠 */}
        <div style={{flex:1, padding:'20px 24px'}}>
          {tab === 'setup' && (
        <div>
          {/* 입력 방식 선택 */}
          <div style={{ display:'flex', gap:8, marginBottom:20 }}>
            {[{key:'direct',label:'✏️ 직접 입력'},{key:'file',label:'📁 파일 업로드'}].map(m=>(
              <button key={m.key} onClick={()=>setInputMethod(m.key)} style={{ padding:'7px 16px', borderRadius:7, fontSize:12, fontWeight:600, cursor:'pointer', background: inputMethod===m.key?'#111827':'#fff', color: inputMethod===m.key?'#fff':'#374151', border: inputMethod===m.key?'none':'1px solid #e5e7eb' }}>
                {m.label}
              </button>
            ))}
          </div>

          {inputMethod === 'direct' && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, maxWidth:820 }}>
              {/* 왼쪽 */}
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div style={S.card}>
                  <div style={{ marginBottom:12 }}>
                    <div style={S.label}><span style={{width:4,height:4,borderRadius:'50%',background:'#ef4444',display:'inline-block'}}/>시스템명</div>
                    <input value={systemName} onChange={e=>setSystemName(e.target.value)} style={S.input} />
                  </div>
                  <div style={{ marginBottom:12 }}>
                    <div style={S.label}><span style={{width:4,height:4,borderRadius:'50%',background:'#ef4444',display:'inline-block'}}/>시스템 개요</div>
                    <textarea value={systemOverview} onChange={e=>setSystemOverview(e.target.value)} rows={4} style={S.textarea} />
                  </div>
                  <div style={{ marginBottom:12 }}>
                    <div style={S.label}>주요기능</div>
                    <input value={mainFunctions} onChange={e=>setMainFunctions(e.target.value)} style={S.input} />
                  </div>
                  <div>
                    <div style={S.label}>관련기관</div>
                    <input value={relatedOrgs} onChange={e=>setRelatedOrgs(e.target.value)} style={S.input} />
                  </div>
                </div>
              </div>

              {/* 오른쪽 */}
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div style={S.card}>
                  <div style={{ background:'#f8faff', border:'1px solid #dbeafe', borderRadius:7, padding:'9px 12px', marginBottom:14, fontSize:12, color:'#3b82f6', lineHeight:1.5 }}>
                    💡 시스템명 + 개요만 입력해도 AI가 전체 기능목록을 자동 생성합니다.
                  </div>
                  <div style={S.label}>키워드 <span style={{fontWeight:400,color:'#9ca3af',textTransform:'none',letterSpacing:0}}>(선택 · 쉼표 구분)</span></div>
                  <input value={keyword} onChange={e=>setKeyword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleGenerateFunctions()} style={{...S.input,marginBottom:10}} />
                  <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:14 }}>
                    {['현황분석','과제관리','로드맵','출입관리','사용자관리','시스템관리'].map(kw=>(
                      <button key={kw} onClick={()=>setKeyword(prev=>prev?prev+', '+kw:kw)} style={{ padding:'3px 10px', borderRadius:20, fontSize:11, background:'#f3f4f6', color:'#374151', border:'1px solid #e5e7eb', cursor:'pointer' }}>{kw}</button>
                    ))}
                  </div>
                  <button onClick={handleGenerateFunctions} disabled={!systemName.trim()||!systemOverview.trim()}
                    style={{ width:'100%', padding:'10px', background: (!systemName.trim()||!systemOverview.trim())?'#e5e7eb':'#111827', color: (!systemName.trim()||!systemOverview.trim())?'#9ca3af':'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor: (!systemName.trim()||!systemOverview.trim())?'not-allowed':'pointer' }}>
                    ✦ AI 기능목록 생성
                  </button>
                </div>
              </div>
            </div>
          )}

          {inputMethod === 'file' && (
            <div style={{ maxWidth:680 }}>
              <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:7, padding:'9px 13px', marginBottom:14, fontSize:12, color:'#92400e' }}>
                ⚠️ HWP 파일은 PDF로 변환 후 업로드하세요.
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:16 }}>
                {[
                  {label:'시스템개요 문서', color:'#2563eb', bg:'#eff6ff', border:'#93c5fd', icon:'📄', desc:'시스템명 · 개요 · 키워드 자동 추출', handler:handleFileUpload},
                  {label:'기능정의서',     color:'#16a34a', bg:'#f0fdf4', border:'#86efac', icon:'📋', desc:'LV1~LV3 기능목록 자동 추출', handler:handleFuncDefUpload},
                  {label:'제안요청서(RFP)',color:'#7c3aed', bg:'#faf5ff', border:'#c4b5fd', icon:'📑', desc:'기능요구사항 추출 → 기능목록 생성', handler:handleRFPUpload},
                ].map(c=>(
                  <div key={c.label}>
                    <div style={{fontSize:11,fontWeight:600,color:'#374151',marginBottom:7}}>{c.icon} {c.label}</div>
                    <label style={{display:'block',border:`1.5px dashed ${c.border}`,borderRadius:9,padding:'20px 12px',textAlign:'center',cursor:'pointer',background:c.bg}}>
                      <div style={{fontSize:22,marginBottom:6}}>{c.icon}</div>
                      <div style={{fontSize:12,fontWeight:600,color:c.color,marginBottom:3}}>업로드</div>
                      <div style={{fontSize:10,color:'#9ca3af'}}>PDF · DOCX · Excel · 이미지</div>
                      <input type="file" accept=".pdf,.docx,.xlsx,.xls,.png,.jpg,.jpeg" onChange={c.handler} style={{display:'none'}} />
                    </label>
                    <div style={{fontSize:10,color:'#9ca3af',marginTop:5}}>→ {c.desc}</div>
                  </div>
                ))}
              </div>

              {(uploadedFileName||uploadedFuncFileName) && (
                <div style={{display:'flex',flexDirection:'column',gap:5,marginBottom:12}}>
                  {uploadedFileName && <div style={{padding:'8px 12px',background:'#f0fdf4',borderRadius:7,border:'1px solid #86efac',display:'flex',alignItems:'center',gap:7,fontSize:12}}>
                    <span>📎</span><span style={{color:'#16a34a',fontWeight:500}}>{uploadedFileName}</span>
                    <span style={{marginLeft:'auto',fontSize:11,color:'#6b7280'}}>{(systemName||systemOverview)?'✅ 분석 완료':'⏳ 분석 중...'}</span>
                  </div>}
                  {uploadedFuncFileName && <div style={{padding:'8px 12px',background:'#f0fdf4',borderRadius:7,border:'1px solid #86efac',display:'flex',alignItems:'center',gap:7,fontSize:12}}>
                    <span>📎</span><span style={{color:'#16a34a',fontWeight:500}}>{uploadedFuncFileName}</span>
                    <span style={{marginLeft:'auto',fontSize:11,color:'#6b7280'}}>✅ 추출 완료</span>
                  </div>}
                </div>
              )}

              {(systemName||systemOverview) && (
                <div style={S.card}>
                  <div style={{fontSize:12,fontWeight:600,color:'#16a34a',marginBottom:8}}>✅ 시스템 정보 추출 완료</div>
                  {systemName && <div style={{fontSize:12,color:'#374151',marginBottom:4}}>시스템명: <strong>{systemName}</strong></div>}
                  <div style={{display:'flex',gap:8}}>
                    <input value={keyword} onChange={e=>setKeyword(e.target.value)} placeholder="키워드 추가 입력 (선택)" style={{...S.input,flex:1,fontSize:12}} />
                    <button onClick={handleGenerateFunctions} style={{...S.btnPrimary,whiteSpace:'nowrap'}}>✦ 기능목록 생성</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
                {tab === 'functions' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>총 {functions.length}개 기능 · 셀 클릭하여 수정 가능</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={addFunction} style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 6, padding: '7px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>+ 행 추가</button>
              <button
                onClick={() => setShowAnalysisPanel(!showAnalysisPanel)}
                style={{ background: showAnalysisPanel ? '#1e40af' : '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                {showAnalysisPanel ? '📊 분석 닫기' : '📊 분석 도구'}
              </button>
              <button onClick={handleGenerateFP} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>AI FP 산정 →</button>
            </div>
          </div>

          {/* ── 통합 분석 도구 ── */}
          {showAnalysisPanel && (
            <div style={{ marginBottom: 16 }}>

              {/* 상단: RFP 입력 + 검증 실행 */}
              <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 20px', marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                      📄 요구사항 / RFP 입력
                      <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 400, marginLeft: 6 }}>RFP 업로드 시 자동 입력 · 직접 입력도 가능</span>
                      {rfpText && <span style={{ fontSize: 11, color: '#16a34a', marginLeft: 6 }}>✅ {rfpText.length.toLocaleString()}자</span>}
                    </label>
                    <textarea
                      value={rfpText}
                      onChange={e => { setRfpText(e.target.value); saveProject({ rfpText: e.target.value }); }}
                      placeholder="FR-001: 출입신청 등록 기능...&#10;FR-002: 승인처리 기능..."
                      rows={3}
                      style={{ width: '100%', padding: '8px 12px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 8, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 160 }}>
                    <button
                      onClick={async () => {
                        if (!rfpText.trim()) return alert('요구사항을 먼저 입력해주세요.');
                        if (functions.length === 0) return alert('기능목록을 먼저 생성해주세요.');
                        setValidationLoading(true);
                        setValidationResult(null);
                        setQualityResult(null);
                        setFpValidResult(null);

                        const callClaude = async (prompt, maxTokens = 1500) => {
                          const res = await fetch('/api/claude', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
                          });
                          const data = await res.json();
                          if (data.error) throw new Error(data.error.message || 'API 오류');
                          return data.content?.map(c => c.type === 'text' ? c.text : '').join('') || '';
                        };
                        const sleep = ms => new Promise(r => setTimeout(r, ms));
                        const totalFPVal = Number(stdSummary?.newDev || 0) + Number(stdSummary?.changed || 0);

                        try {
                          // 1단계: 요구사항 검증
                          setValidationStep(1);
                          const t1 = await callClaude(getValidationPrompt(rfpText, functions, fpList), 1500);
                          let r1; try { r1 = safeParseJSON(t1); } catch(e) { r1 = { coverage: { score: 0, items: [] }, crudCheck: [], commonCheck: { userMgmt: false, authMgmt: false, sysMgmt: false }, suggestions: [], summary: '응답이 잘렸습니다.' }; }
                          setValidationResult(r1);
                          saveProject({ validationResult: r1, rfpText });

                          // 2단계: 품질 검증 (8초 딜레이)
                          setValidationStep(2);
                          await sleep(8000);
                          const t2 = await callClaude(getQualityCheckPrompt(functions), 1000);
                          let r2; try { r2 = safeParseJSON(t2); } catch(e) { r2 = { qualityScore: 0, issues: [], crudGaps: [], summary: '응답이 잘렸습니다.' }; }
                          setQualityResult(r2);
                          saveProject({ qualityResult: r2 });

                          // 3단계: FP 역검증 (8초 딜레이)
                          setValidationStep(3);
                          await sleep(8000);
                          const t3 = await callClaude(getFPValidationPrompt(fpList, totalFPVal), 1000);
                          let r3; try { r3 = safeParseJSON(t3); } catch(e) { r3 = { fpScore: 0, issues: [], summary: '응답이 잘렸습니다.' }; }
                          setFpValidResult(r3);
                          saveProject({ fpValidResult: r3 });

                          setValidationStep(0);
                        } catch (err) {
                          alert('검증 오류: ' + err.message);
                        } finally {
                          setValidationLoading(false);
                          setValidationStep(0);
                        }
                      }}
                      disabled={validationLoading || !rfpText.trim() || functions.length === 0}
                      style={{ background: validationLoading ? '#e5e7eb' : '#2563eb', color: validationLoading ? '#9ca3af' : '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: validationLoading ? 'not-allowed' : 'pointer' }}
                    >
                      {validationLoading ? '⚙️ 검증 실행 중...' : '🔍 AI 검증 실행'}
                    </button>

                    {/* 진행 상태 */}
                    {validationLoading && (
                      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px' }}>
                        {[
                          [1, '요구사항 커버리지'],
                          [2, '기능 품질'],
                          [3, 'FP 역검증'],
                        ].map(([step, label]) => (
                          <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: 11 }}>
                            <span>{validationStep > step ? '✅' : validationStep === step ? '⚙️' : '⬜'}</span>
                            <span style={{ color: validationStep >= step ? '#1f2937' : '#9ca3af', fontWeight: validationStep === step ? 700 : 400 }}>{step}. {label}</span>
                          </div>
                        ))}
                        {validationStep > 0 && validationStep < 3 && (
                          <p style={{ margin: '4px 0 0', fontSize: 10, color: '#6b7280' }}>다음 단계까지 잠시 대기...</p>
                        )}
                      </div>
                    )}

                    {/* 예산 역산 입력 */}
                    <div style={{ background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 8, padding: '10px 12px' }}>
                      <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#92400e' }}>🔄 예산 역산</p>
                      <input type="text" value={reverseTarget} onChange={e => setReverseTarget(e.target.value.replace(/[^0-9]/g, ''))} placeholder="예산 입력 (원)" style={{ width: '100%', padding: '6px 8px', border: '1px solid #fdba74', borderRadius: 6, fontSize: 11, outline: 'none', boxSizing: 'border-box', marginBottom: 4 }} />
                      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 4 }}>
                        {[['2억',200000000],['4억',400000000],['6억',600000000],['10억',1000000000]].map(([l,v]) => (
                          <button key={l} onClick={() => setReverseTarget(String(v))} style={{ fontSize: 10, padding: '2px 5px', borderRadius: 6, background: reverseTarget===String(v)?'#d97706':'#fef3c7', color: reverseTarget===String(v)?'#fff':'#92400e', border: 'none', cursor: 'pointer' }}>{l}</button>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 3 }}>
                        {[['2025',605784],['2024',582004],['2023',559600]].map(([y,v]) => (
                          <button key={y} onClick={() => setReverseUnitPrice(v)} style={{ fontSize: 10, padding: '2px 5px', borderRadius: 6, background: reverseUnitPrice===v?'#d97706':'#fef3c7', color: reverseUnitPrice===v?'#fff':'#92400e', border: 'none', cursor: 'pointer' }}>{y}년</button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 예산 역산 결과 (인라인) */}
                {reverseTarget && Number(reverseTarget) > 0 && (() => {
                  const budget = Number(reverseTarget);
                  const reversedFP = Math.round(budget / (reverseUnitPrice * reverseCoeff));
                  const estFuncCount = Math.round(reversedFP / 4.2);
                  const gap = estFuncCount - functions.length;
                  return (
                    <div style={{ marginTop: 10, padding: '10px 14px', background: '#fff', border: '1px solid #fed7aa', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                      {[
                        [`${(budget/100000000).toFixed(1)}억원`, '목표 예산', '#92400e'],
                        [`${reversedFP.toLocaleString()} FP`, '필요 FP', '#d97706'],
                        [`약 ${estFuncCount}개`, '목표 기능 수', '#059669'],
                      ].map(([v,l,c]) => (
                        <div key={l} style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 16, fontWeight: 800, color: c }}>{v}</div>
                          <div style={{ fontSize: 10, color: '#6b7280' }}>{l}</div>
                        </div>
                      ))}
                      <div style={{ padding: '5px 10px', background: gap > 0 ? '#eff6ff' : gap < 0 ? '#fef2f2' : '#f0fdf4', borderRadius: 6, fontSize: 12, fontWeight: 600, color: gap > 0 ? '#1e40af' : gap < 0 ? '#dc2626' : '#16a34a' }}>
                        {gap > 0 ? `📈 ${gap}개 더 필요` : gap < 0 ? `📉 ${Math.abs(gap)}개 초과` : '✅ 적합'}
                      </div>
                      {gap > 0 && (
                        <button onClick={async () => {
                          const ok = window.confirm(`부족한 기능 약 ${gap}개를 AI로 추가 생성할까요?`);
                          if (!ok) return;
                          setLoading(true);
                          let merged = [...functions]; let totalAdded = 0;
                          const maxRounds = Math.min(Math.ceil(gap / 50), 10);
                          const sleep = ms => new Promise(r => setTimeout(r, ms));
                          try {
                            for (let round = 0; round < maxRounds; round++) {
                              if (merged.length >= estFuncCount) break;
                              setLoadingMsg(`추가 생성 중... (${round+1}/${maxRounds}회 · ${merged.length}개 → ${estFuncCount}개)`);
                              if (round > 0) await sleep(3000);
                              const existingLV3 = new Set(merged.map(f => f.lv3));
                              try {
                                const result = await generateFunctions(systemInfo, `추가기능(목표${estFuncCount}개중현재${merged.length}개,중복제외새기능만)`);
                                const newFuncs = result.filter(f => !existingLV3.has(f.lv3)).map((f,i) => ({...f, id: Date.now()+totalAdded+i}));
                                if (!newFuncs.length) break;
                                merged = [...merged, ...newFuncs]; totalAdded += newFuncs.length;
                                setFunctions([...merged]); saveProject({ functions: merged });
                              } catch(e) { break; }
                            }
                            alert(`✅ ${totalAdded}개 추가 (총 ${merged.length}개)`);
                          } finally { setLoading(false); setLoadingMsg(''); }
                        }} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                          ✨ AI 추가 생성
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* 하단: 결과 3열 */}
              {(validationResult || qualityResult || fpValidResult) && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>

                  {/* 결과① 요구사항 커버리지 */}
                  <div style={{ background: '#fff', border: '1px solid #86efac', borderRadius: 12, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#166534' }}>✅ 요구사항 커버리지</p>
                      {validationResult && (
                        <button onClick={async () => {
                          const { exportGenericExcel } = await import('../utils/excelExport');
                          await exportGenericExcel('요구사항검증', ['요구사항','반영여부','관련기능','비고'],
                            (validationResult.coverage?.items||[]).map(i => ({ '요구사항': i.req, '반영여부': i.status, '관련기능': (i.functions||[]).join(', '), '비고': i.comment||'' })),
                            [35,10,50,30], project.name);
                        }} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 5, padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>📥</button>
                      )}
                    </div>
                    {validationResult ? (() => {
                      const score = validationResult.coverage?.score || 0;
                      const items = validationResult.coverage?.items || [];
                      const ok = items.filter(i => i.status === '✅').length;
                      const fail = items.filter(i => i.status === '❌').length;
                      const scoreColor = score >= 80 ? '#16a34a' : score >= 60 ? '#d97706' : '#dc2626';
                      return (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#f0fdf4', borderRadius: 8, marginBottom: 8 }}>
                            <div style={{ fontSize: 32, fontWeight: 900, color: scoreColor, lineHeight: 1 }}>{score}</div>
                            <div>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>✅ {ok}반영</span>
                                {fail > 0 && <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>❌ {fail}미반영</span>}
                              </div>
                              <p style={{ margin: 0, fontSize: 10, color: '#6b7280' }}>{validationResult.summary?.slice(0, 40)}</p>
                            </div>
                          </div>
                          <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8 }}>
                            {items.map((item, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '5px 8px', background: item.status==='✅'?'#f0fdf4':item.status==='⚠️'?'#fffbeb':'#fef2f2', borderRadius: 6, fontSize: 11 }}>
                                <span style={{ flexShrink: 0 }}>{item.status}</span>
                                <div style={{ flex: 1 }}>
                                  <span style={{ fontWeight: 600 }}>{item.req}</span>
                                  {item.comment && <p style={{ margin: '1px 0 0', color: '#dc2626', fontSize: 10 }}>{item.comment}</p>}
                                </div>
                                {item.status === '❌' && (
                                  <button onClick={async () => {
                                    setValidationLoading(true);
                                    try {
                                      const res = await fetch('/api/claude', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ max_tokens: 4000, messages: [{ role: 'user', content: getRegenFromReqPrompt([item], systemInfo, functions) }] }) });
                                      const data = await res.json();
                                      const text = data.content?.map(c => c.type==='text'?c.text:'').join('')||'';
                                      const parsed = safeParseJSON(text);
                                      const existingLV3 = new Set(functions.map(f => f.lv3));
                                      const newFuncs = (parsed.functions||[]).filter(f => !existingLV3.has(f.lv3)).map((f,j) => ({...f, id: Date.now()+j}));
                                      const merged = [...functions, ...newFuncs];
                                      setFunctions(merged); saveProject({ functions: merged });
                                      alert(`✅ ${newFuncs.length}개 추가`);
                                    } catch(err) { alert('오류: '+err.message); }
                                    finally { setValidationLoading(false); }
                                  }} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 6px', fontSize: 10, cursor: 'pointer', flexShrink: 0 }}>재생성</button>
                                )}
                              </div>
                            ))}
                          </div>
                          {fail > 0 && (
                            <button onClick={async () => {
                              const failedItems = items.filter(i => i.status === '❌');
                              const ok = window.confirm(`미반영 ${failedItems.length}개를 일괄 재생성할까요?`);
                              if (!ok) return;
                              setValidationLoading(true);
                              try {
                                const res = await fetch('/api/claude', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ max_tokens: 4000, messages: [{ role: 'user', content: getRegenFromReqPrompt(failedItems, systemInfo, functions) }] }) });
                                const data = await res.json();
                                const text = data.content?.map(c => c.type==='text'?c.text:'').join('')||'';
                                const parsed = safeParseJSON(text);
                                const existingLV3 = new Set(functions.map(f => f.lv3));
                                const newFuncs = (parsed.functions||[]).filter(f => !existingLV3.has(f.lv3)).map((f,j) => ({...f, id: Date.now()+j}));
                                const merged = [...functions, ...newFuncs];
                                setFunctions(merged); saveProject({ functions: merged });
                                alert(`✅ ${newFuncs.length}개 추가`);
                              } catch(err) { alert('오류: '+err.message); }
                              finally { setValidationLoading(false); }
                            }} style={{ width: '100%', padding: '7px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                              ❌ 미반영 {fail}개 일괄 재생성
                            </button>
                          )}
                        </div>
                      );
                    })() : (
                      <div style={{ textAlign: 'center', padding: '30px 0', color: '#9ca3af', fontSize: 12 }}>검증 실행 후 결과가 표시됩니다</div>
                    )}
                  </div>

                  {/* 결과② 기능 품질 */}
                  <div style={{ background: '#fff', border: '1px solid #c4b5fd', borderRadius: 12, padding: '14px 16px' }}>
                    <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#5b21b6' }}>🔬 기능 품질</p>
                    {qualityResult ? (() => {
                      const score = qualityResult.qualityScore || 0;
                      const errors = (qualityResult.issues||[]).filter(i => i.severity==='error');
                      const warnings = (qualityResult.issues||[]).filter(i => i.severity==='warning');
                      const scoreColor = score>=80?'#7c3aed':score>=60?'#d97706':'#dc2626';
                      return (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#f5f3ff', borderRadius: 8, marginBottom: 8 }}>
                            <div style={{ fontSize: 32, fontWeight: 900, color: scoreColor, lineHeight: 1 }}>{score}</div>
                            <div>
                              <div style={{ display: 'flex', gap: 6 }}>
                                {errors.length>0&&<span style={{ fontSize:11, color:'#dc2626', fontWeight:600 }}>❌ {errors.length}오류</span>}
                                {warnings.length>0&&<span style={{ fontSize:11, color:'#d97706', fontWeight:600 }}>⚠️ {warnings.length}경고</span>}
                                {!errors.length&&!warnings.length&&<span style={{ fontSize:11, color:'#16a34a', fontWeight:600 }}>✅ 이슈없음</span>}
                              </div>
                              <p style={{ margin:0, fontSize:10, color:'#6b7280' }}>{qualityResult.summary?.slice(0,40)}</p>
                            </div>
                          </div>
                          <div style={{ maxHeight:200, overflowY:'auto', display:'flex', flexDirection:'column', gap:3, marginBottom:8 }}>
                            {(qualityResult.issues||[]).map((issue,i) => (
                              <div key={i} style={{ padding:'5px 8px', background:issue.severity==='error'?'#fef2f2':issue.severity==='warning'?'#fffbeb':'#eff6ff', borderRadius:6, fontSize:11 }}>
                                <span style={{ fontWeight:600 }}>{issue.severity==='error'?'❌':'⚠️'} {issue.lv2} {issue.lv3?`› ${issue.lv3}`:''}</span>
                                <p style={{ margin:'2px 0 0', color:'#6b7280', fontSize:10 }}>{issue.message}</p>
                                {issue.suggestion&&<p style={{ margin:'1px 0 0', color:'#2563eb', fontSize:10 }}>💡 {issue.suggestion}</p>}
                              </div>
                            ))}
                          </div>
                          {(qualityResult.crudGaps||[]).filter(g=>g.missing?.length>0).map((g,i) => (
                            <div key={i} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 8px', background:'#fffbeb', borderRadius:6, fontSize:11, marginBottom:4 }}>
                              <span style={{ flex:1, color:'#92400e' }}>{g.lv2}: <strong>{g.missing?.join('/')}</strong> 누락</span>
                              <button onClick={() => {
                                const lv1 = functions.find(f=>f.lv2===g.lv2)?.lv1||'';
                                const newFuncs = g.missing.map((m,j) => ({lv1,lv2:g.lv2,lv3:`${g.lv2} ${m}`,definition:`${g.lv2} 정보를 ${m}한다`,id:Date.now()+j}));
                                const merged = [...functions,...newFuncs];
                                setFunctions(merged); saveProject({functions:merged});
                              }} style={{ background:'#7c3aed', color:'#fff', border:'none', borderRadius:4, padding:'2px 6px', fontSize:10, cursor:'pointer', flexShrink:0 }}>추가</button>
                            </div>
                          ))}
                        </div>
                      );
                    })() : (
                      <div style={{ textAlign:'center', padding:'30px 0', color:'#9ca3af', fontSize:12 }}>검증 실행 후 결과가 표시됩니다</div>
                    )}
                  </div>

                  {/* 결과③ FP 역검증 */}
                  <div style={{ background: '#fff', border: '1px solid #bae6fd', borderRadius: 12, padding: '14px 16px' }}>
                    <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#0369a1' }}>🔁 FP 역검증</p>
                    {fpValidResult ? (() => {
                      const score = fpValidResult.fpScore || 0;
                      const errors = (fpValidResult.issues||[]).filter(i=>i.severity==='error');
                      const warnings = (fpValidResult.issues||[]).filter(i=>i.severity==='warning');
                      const scoreColor = score>=80?'#0369a1':score>=60?'#d97706':'#dc2626';
                      return (
                        <div>
                          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', background:'#f0f9ff', borderRadius:8, marginBottom:8 }}>
                            <div style={{ fontSize:32, fontWeight:900, color:scoreColor, lineHeight:1 }}>{score}</div>
                            <div>
                              <div style={{ display:'flex', gap:6 }}>
                                {errors.length>0&&<span style={{ fontSize:11, color:'#dc2626', fontWeight:600 }}>❌ {errors.length}오류</span>}
                                {warnings.length>0&&<span style={{ fontSize:11, color:'#d97706', fontWeight:600 }}>⚠️ {warnings.length}경고</span>}
                                {!errors.length&&!warnings.length&&<span style={{ fontSize:11, color:'#16a34a', fontWeight:600 }}>✅ 이슈없음</span>}
                              </div>
                              <p style={{ margin:0, fontSize:10, color:'#6b7280' }}>{fpValidResult.summary?.slice(0,40)}</p>
                            </div>
                          </div>
                          <div style={{ maxHeight:200, overflowY:'auto', display:'flex', flexDirection:'column', gap:3 }}>
                            {(fpValidResult.issues||[]).map((issue,i) => (
                              <div key={i} style={{ padding:'5px 8px', background:issue.severity==='error'?'#fef2f2':issue.severity==='warning'?'#fffbeb':'#eff6ff', borderRadius:6, fontSize:11 }}>
                                <span style={{ fontWeight:600 }}>{issue.severity==='error'?'❌':'⚠️'} [{issue.type}]</span>
                                <p style={{ margin:'2px 0 0', color:'#6b7280', fontSize:10 }}>{issue.message}</p>
                                {issue.suggestion&&<p style={{ margin:'1px 0 0', color:'#2563eb', fontSize:10 }}>💡 {issue.suggestion}</p>}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })() : (
                      <div style={{ textAlign:'center', padding:'30px 0', color:'#9ca3af', fontSize:12 }}>검증 실행 후 결과가 표시됩니다</div>
                    )}
                  </div>

                </div>
              )}
            </div>
          )}
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
              <button
                onClick={async () => {
                  if (fpList.length === 0) return alert('FP 산정을 먼저 실행해주세요.');
                  setFpValidLoading(true);
                  try {
                    const totalFPVal = Number(stdSummary.newDev) + Number(stdSummary.changed);
                    const prompt = getFPValidationPrompt(fpList, totalFPVal, null);
                    const response = await fetch('/api/claude', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ max_tokens: 1000, messages: [{ role: 'user', content: prompt }] }),
                    });
                    const data = await response.json();
                    if (data.error) throw new Error(data.error.message || 'API 오류');
                    const text = data.content?.map(c => c.type === 'text' ? c.text : '').join('') || '';
                    const result = safeParseJSON(text);
                    setFpValidResult(result);
                    saveProject({ fpValidResult: result });
                  } catch (err) {
                    alert('FP 역검증 오류: ' + err.message);
                  } finally {
                    setFpValidLoading(false);
                  }
                }}
                disabled={fpValidLoading}
                style={{ background: fpValidLoading ? '#e5e7eb' : '#f0fdf4', color: fpValidLoading ? '#9ca3af' : '#16a34a', border: '1px solid #86efac', borderRadius: 6, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: fpValidLoading ? 'not-allowed' : 'pointer' }}
              >
                {fpValidLoading ? '⚙️ 역검증 중...' : '🔁 FP 역검증'}
              </button>
              <button onClick={addFPRow} style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 6, padding: '7px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>+ 행 추가</button>
              <button onClick={exportExcel} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>📥 Excel 출력</button>
            </div>
          </div>

          {/* FP 역검증 결과 */}
          {fpValidResult && (
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 32, fontWeight: 900, color: fpValidResult.fpScore >= 80 ? '#16a34a' : fpValidResult.fpScore >= 60 ? '#d97706' : '#dc2626', lineHeight: 1 }}>{fpValidResult.fpScore}</div>
                    <div style={{ fontSize: 10, color: '#6b7280' }}>FP 품질</div>
                  </div>
                  <div>
                    <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: '#166534' }}>🔁 FP 역검증 결과</p>
                    <p style={{ margin: 0, fontSize: 12, color: '#374151' }}>{fpValidResult.summary}</p>
                  </div>
                </div>
                <button onClick={() => { setFpValidResult(null); saveProject({ fpValidResult: null }); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 18 }}>✕</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(fpValidResult.issues || []).map((issue, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, padding: '8px 12px', background: issue.severity === 'error' ? '#fef2f2' : issue.severity === 'warning' ? '#fffbeb' : '#eff6ff', borderRadius: 8, fontSize: 12 }}>
                    <span>{issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️'}</span>
                    <div>
                      <span style={{ fontWeight: 600 }}>[{issue.type}]</span> {issue.message}
                      {issue.suggestion && <p style={{ margin: '2px 0 0', color: '#2563eb' }}>💡 {issue.suggestion}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
                    const parsed = safeParseJSON(text);
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
                onClick={async () => {
                  const { exportGenericExcel } = await import('../utils/excelExport');
                  await exportGenericExcel('인터페이스정의서',
                    ['인터페이스ID','인터페이스명','송신시스템','수신시스템','연동방식','연동주기','주요데이터항목','비고'],
                    ifList.map(f=>({'인터페이스ID':f.ifId,'인터페이스명':f.ifName,'송신시스템':f.sendSystem,'수신시스템':f.receiveSystem,'연동방식':f.method,'연동주기':f.cycle,'주요데이터항목':f.dataItems,'비고':f.note})),
                    [14,25,20,20,12,12,40,15], project.name
                  );
                }}
                style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >📥 Excel 출력</button>
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
                    const parsed = safeParseJSON(text);
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
                onClick={async () => {
                  const { exportGenericExcel } = await import('../utils/excelExport');
                  await exportGenericExcel('WBS',
                    ['WBS ID','단계','작업명','LV1','LV2','공수(일)','담당자','비고'],
                    wbsList.map(w=>({'WBS ID':w.wbsId,'단계':w.phase,'작업명':w.task,'LV1':w.lv1,'LV2':w.lv2,'공수(일)':w.workDays,'담당자':w.role,'비고':w.note})),
                    [8,10,30,15,15,10,10,20], project.name
                  );
                }}
                style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >📥 Excel 출력</button>
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
                    const parsed = safeParseJSON(text);
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
                onClick={async () => {
                  const { exportGenericExcel } = await import('../utils/excelExport');
                  await exportGenericExcel('요구사항추적표',
                    ['요구사항ID','요구사항명','관련기능','관련화면','테스트케이스ID','상태'],
                    traceList.map(t=>({'요구사항ID':t.reqId,'요구사항명':t.reqName,'관련기능':t.relatedFunctions,'관련화면':t.relatedScreens,'테스트케이스ID':t.testId,'상태':t.status})),
                    [12,25,30,20,14,10], project.name
                  );
                }}
                style={{ background:'#16a34a',color:'#fff',border:'none',borderRadius:6,padding:'7px 14px',fontSize:13,fontWeight:600,cursor:'pointer' }}
              >📥 Excel 출력</button>
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
                    const parsed = safeParseJSON(text);
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
                onClick={async () => {
                  const { exportGenericExcel } = await import('../utils/excelExport');
                  await exportGenericExcel('테스트케이스',
                    ['테스트케이스ID','관련요구사항','테스트케이스명','유형','사전조건','테스트절차','기대결과','테스트결과'],
                    tcList.map(t=>({'테스트케이스ID':t.tcId,'관련요구사항':t.reqId,'테스트케이스명':t.tcName,'유형':t.type,'사전조건':t.precondition,'테스트절차':t.steps,'기대결과':t.expected,'테스트결과':t.result})),
                    [14,12,30,8,20,40,30,10], project.name
                  );
                }}
                style={{ background:'#16a34a',color:'#fff',border:'none',borderRadius:6,padding:'7px 14px',fontSize:13,fontWeight:600,cursor:'pointer' }}
              >📥 Excel 출력</button>
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
                {tab === 'isp' && (
        <div style={{ padding: '24px' }}>
          {/* 헤더 */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20, flexWrap:'wrap', gap:12 }}>
            <div>
              <h2 style={{ fontSize:18, fontWeight:700, color:'#1e3a8a', margin:0 }}>📋 정보화전략계획서 (ISP)</h2>
              <p style={{ fontSize:12, color:'#6b7280', marginTop:4 }}>RFP 기반 자동 초안 생성 · 편집 후 Word 출력</p>
            </div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <button
                onClick={handleGenerateISP}
                disabled={ispLoading}
                style={{ background: ispLoading ? '#9ca3af' : '#1d4ed8', color:'#fff', border:'none', borderRadius:7, padding:'9px 18px', fontSize:13, fontWeight:600, cursor: ispLoading ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', gap:6 }}
              >
                {ispLoading ? `⏳ ${ispLoadingSection} 생성 중...` : (ispDraft ? '🔄 재생성' : '✨ 초안 자동 생성')}
              </button>
              {ispDraft && (
                <button
                  onClick={handleISPWordExport}
                  style={{ background:'#16a34a', color:'#fff', border:'none', borderRadius:7, padding:'9px 18px', fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}
                >
                  📄 Word 출력
                </button>
              )}
            </div>
          </div>

          {/* 준비 안내 */}
          {!ispDraft && !ispLoading && (
            <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:10, padding:'20px 24px', marginBottom:20 }}>
              <p style={{ fontSize:14, fontWeight:600, color:'#1e40af', margin:'0 0 8px' }}>📌 정보화전략계획서 자동 생성 준비</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:12 }}>
                {[
                  { label:'RFP 업로드', ok: !!rfpText, desc: rfpText ? `${Math.round(rfpText.length/1000)}KB 저장됨` : '시스템개요 탭에서 RFP 업로드' },
                  { label:'시스템명', ok: !!systemName, desc: systemName || '시스템개요 탭에서 입력' },
                  { label:'시스템 개요', ok: !!systemOverview, desc: systemOverview ? `${systemOverview.slice(0,30)}...` : '시스템개요 탭에서 입력' },
                  { label:'기능목록', ok: functions.length > 0, desc: functions.length > 0 ? `${functions.length}개 기능` : '기능목록 탭에서 생성' },
                ].map(item => (
                  <div key={item.label} style={{ display:'flex', alignItems:'center', gap:8, background:'#fff', borderRadius:6, padding:'8px 12px', border:'1px solid #e0e7ff' }}>
                    <span style={{ fontSize:16 }}>{item.ok ? '✅' : '⚠️'}</span>
                    <div>
                      <div style={{ fontWeight:600, color: item.ok ? '#166534' : '#92400e' }}>{item.label}</div>
                      <div style={{ color:'#6b7280', fontSize:11 }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 로딩 */}
          {ispLoading && (
            <div style={{ background:'#f0f9ff', border:'1px solid #bae6fd', borderRadius:10, padding:'24px', textAlign:'center', marginBottom:20 }}>
              <div style={{ fontSize:24, marginBottom:8 }}>⏳</div>
              <p style={{ fontSize:14, fontWeight:600, color:'#0c4a6e', margin:0 }}>정보화전략계획서 초안 생성 중...</p>
              <p style={{ fontSize:12, color:'#0369a1', marginTop:4 }}>{ispLoadingSection} 섹션 작성 중</p>
              <div style={{ display:'flex', justifyContent:'center', gap:4, marginTop:12 }}>
                {['경영진 요약','사업 배경','현황 분석','목표 시스템','기능 요구사항','구현 전략'].map(s => (
                  <span key={s} style={{ fontSize:10, padding:'2px 6px', borderRadius:10, background: s===ispLoadingSection?'#0369a1':'#e0f2fe', color: s===ispLoadingSection?'#fff':'#0369a1' }}>{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* 생성된 계획서 */}
          {ispDraft && !ispLoading && (() => {
            const sections = [
              { key:'executive', num:'1', icon:'💼', color:'#7c3aed', bg:'#faf5ff', border:'#e9d5ff' },
              { key:'background', num:'2', icon:'🎯', color:'#0369a1', bg:'#f0f9ff', border:'#bae6fd' },
              { key:'asIs', num:'3', icon:'🔍', color:'#b45309', bg:'#fffbeb', border:'#fde68a' },
              { key:'toBe', num:'4', icon:'🚀', color:'#047857', bg:'#f0fdf4', border:'#a7f3d0' },
              { key:'requirements', num:'5', icon:'📋', color:'#1d4ed8', bg:'#eff6ff', border:'#bfdbfe' },
              { key:'implementation', num:'6', icon:'🗓️', color:'#be123c', bg:'#fff1f2', border:'#fecdd3' },
            ];
            return (
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                {sections.map(({ key, num, icon, color, bg, border }) => {
                  const d = ispDraft[key];
                  if (!d) return null;
                  return (
                    <div key={key} style={{ background: bg, border:`1px solid ${border}`, borderRadius:10, overflow:'hidden' }}>
                      <div style={{ padding:'14px 20px', borderBottom:`1px solid ${border}`, display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:18 }}>{icon}</span>
                        <span style={{ fontSize:15, fontWeight:700, color }}>{num}. {d.title}</span>
                      </div>
                      <div style={{ padding:'16px 20px', fontSize:13, lineHeight:1.7 }}>

                        {/* 경영진 요약 */}
                        {key === 'executive' && <>
                          <p style={{ color:'#374151', margin:'0 0 12px' }}>{d.content}</p>
                          {d.keyPoints?.length > 0 && <><p style={{ fontWeight:600, color, margin:'8px 0 4px' }}>핵심 포인트</p>
                          <ul style={{ margin:0, paddingLeft:20 }}>{d.keyPoints.map((p,i) => <li key={i} style={{ color:'#374151', marginBottom:3 }}>{p}</li>)}</ul></>}
                          {d.investmentValue && <p style={{ background:'#fff', borderRadius:6, padding:'8px 12px', marginTop:10, color:'#374151', borderLeft:`3px solid ${color}` }}>{d.investmentValue}</p>}
                        </>}

                        {/* 사업 배경 */}
                        {key === 'background' && <>
                          {d.background && <><p style={{ fontWeight:600, color, margin:'0 0 4px' }}>추진 배경</p><p style={{ color:'#374151', margin:'0 0 12px' }}>{d.background}</p></>}
                          {d.purpose && <><p style={{ fontWeight:600, color, margin:'0 0 4px' }}>사업 목적</p><p style={{ color:'#374151', margin:'0 0 12px' }}>{d.purpose}</p></>}
                          {d.goals?.length > 0 && <><p style={{ fontWeight:600, color, margin:'0 0 4px' }}>추진 목표</p>
                          <ul style={{ margin:'0 0 12px', paddingLeft:20 }}>{d.goals.map((g,i) => <li key={i} style={{ color:'#374151', marginBottom:3 }}>{g}</li>)}</ul></>}
                          {d.scope && <><p style={{ fontWeight:600, color, margin:'0 0 4px' }}>사업 범위</p><p style={{ color:'#374151', margin:0 }}>{d.scope}</p></>}
                        </>}

                        {/* AS-IS */}
                        {key === 'asIs' && <>
                          {d.currentStatus && <><p style={{ fontWeight:600, color, margin:'0 0 4px' }}>현재 업무 현황</p><p style={{ color:'#374151', margin:'0 0 12px' }}>{d.currentStatus}</p></>}
                          {d.problems?.length > 0 && <><p style={{ fontWeight:600, color, margin:'0 0 4px' }}>주요 문제점</p>
                          <ul style={{ margin:'0 0 12px', paddingLeft:20 }}>{d.problems.map((p,i) => <li key={i} style={{ color:'#374151', marginBottom:3 }}>{p}</li>)}</ul></>}
                          {d.limitations && <><p style={{ fontWeight:600, color, margin:'0 0 4px' }}>현재 시스템 한계</p><p style={{ color:'#374151', margin:'0 0 12px' }}>{d.limitations}</p></>}
                          {d.improvementNeeds && <><p style={{ fontWeight:600, color, margin:'0 0 4px' }}>개선 필요사항</p><p style={{ color:'#374151', margin:0 }}>{d.improvementNeeds}</p></>}
                        </>}

                        {/* TO-BE */}
                        {key === 'toBe' && <>
                          {d.vision && <p style={{ background:'#fff', borderRadius:6, padding:'10px 14px', margin:'0 0 12px', color:'#374151', fontWeight:500, borderLeft:`3px solid ${color}`, fontSize:14 }}>{d.vision}</p>}
                          {d.architecture && <><p style={{ fontWeight:600, color, margin:'0 0 4px' }}>시스템 아키텍처</p><p style={{ color:'#374151', margin:'0 0 12px' }}>{d.architecture}</p></>}
                          {d.coreFeatures?.length > 0 && <><p style={{ fontWeight:600, color, margin:'0 0 6px' }}>핵심 기능</p>
                          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:12 }}>{d.coreFeatures.map((f,i) => <span key={i} style={{ background:'#fff', border:`1px solid ${border}`, borderRadius:16, padding:'3px 10px', fontSize:12, color }}>{f}</span>)}</div></>}
                          {d.expectedEffects?.length > 0 && <><p style={{ fontWeight:600, color, margin:'0 0 4px' }}>기대 효과</p>
                          <ul style={{ margin:'0 0 12px', paddingLeft:20 }}>{d.expectedEffects.map((e,i) => <li key={i} style={{ color:'#374151', marginBottom:3 }}>{e}</li>)}</ul></>}
                          {d.technicalStack && <><p style={{ fontWeight:600, color, margin:'0 0 4px' }}>기술 스택</p><p style={{ color:'#374151', margin:0 }}>{d.technicalStack}</p></>}
                        </>}

                        {/* 기능 요구사항 */}
                        {key === 'requirements' && <>
                          {d.summary && <p style={{ color:'#374151', margin:'0 0 12px' }}>{d.summary}</p>}
                          {d.functionalAreas?.length > 0 && <>
                            <p style={{ fontWeight:600, color, margin:'0 0 8px' }}>기능 요구사항 영역</p>
                            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:12 }}>
                              {d.functionalAreas.map((area,i) => (
                                <div key={i} style={{ background:'#fff', borderRadius:6, padding:'10px 14px', border:`1px solid ${border}` }}>
                                  <p style={{ fontWeight:600, color, margin:'0 0 3px' }}>▶ {area.area}</p>
                                  <p style={{ fontSize:12, color:'#6b7280', margin:'0 0 6px' }}>{area.description}</p>
                                  <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                                    {area.keyFunctions?.map((f,j) => <span key={j} style={{ background:bg, border:`1px solid ${border}`, borderRadius:10, padding:'1px 8px', fontSize:11, color }}>{f}</span>)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>}
                          {d.nonFunctional?.length > 0 && <><p style={{ fontWeight:600, color, margin:'0 0 4px' }}>비기능 요구사항</p>
                          <ul style={{ margin:0, paddingLeft:20 }}>{d.nonFunctional.map((r,i) => <li key={i} style={{ color:'#374151', marginBottom:3 }}>{r}</li>)}</ul></>}
                        </>}

                        {/* 구현 전략 */}
                        {key === 'implementation' && <>
                          {d.strategy && <><p style={{ fontWeight:600, color, margin:'0 0 4px' }}>구현 전략</p><p style={{ color:'#374151', margin:'0 0 12px' }}>{d.strategy}</p></>}
                          {d.phases?.length > 0 && <>
                            <p style={{ fontWeight:600, color, margin:'0 0 8px' }}>추진 로드맵</p>
                            <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8, marginBottom:12 }}>
                              {d.phases.map((ph,i) => (
                                <div key={i} style={{ background:'#fff', borderRadius:8, padding:'12px', border:`1px solid ${border}` }}>
                                  <p style={{ fontWeight:700, color, margin:'0 0 2px', fontSize:13 }}>{ph.phase}</p>
                                  <p style={{ fontSize:11, color:'#6b7280', margin:'0 0 8px' }}>{ph.period}</p>
                                  {ph.tasks?.map((t,j) => <p key={j} style={{ fontSize:11, color:'#374151', margin:'1px 0' }}>• {t}</p>)}
                                  {ph.deliverables?.length > 0 && <p style={{ fontSize:10, color:'#9ca3af', marginTop:6 }}>📦 {ph.deliverables.join(', ')}</p>}
                                </div>
                              ))}
                            </div>
                          </>}
                          {d.risks?.length > 0 && <><p style={{ fontWeight:600, color, margin:'0 0 4px' }}>리스크 관리</p>
                          <ul style={{ margin:'0 0 12px', paddingLeft:20 }}>{d.risks.map((r,i) => <li key={i} style={{ color:'#374151', marginBottom:3 }}>{r}</li>)}</ul></>}
                          {d.successFactors?.length > 0 && <><p style={{ fontWeight:600, color, margin:'0 0 4px' }}>성공 요인</p>
                          <ul style={{ margin:0, paddingLeft:20 }}>{d.successFactors.map((s,i) => <li key={i} style={{ color:'#374151', marginBottom:3 }}>{s}</li>)}</ul></>}
                        </>}

                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}
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
                    const parsed = safeParseJSON(text);
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
                onClick={async () => {
                  const { exportGenericExcel } = await import('../utils/excelExport');
                  await exportGenericExcel('AS-IS_TO-BE',
                    ['LV1','LV2','AS-IS(현행)','TO-BE(목표)','기대효과','변화유형'],
                    asisList.map(a=>({'LV1':a.lv1,'LV2':a.lv2,'AS-IS(현행)':a.asIs,'TO-BE(목표)':a.toBe,'기대효과':a.improvement,'변화유형':a.changeType})),
                    [15,20,40,40,30,12], project.name
                  );
                }}
                style={{ background:'#16a34a',color:'#fff',border:'none',borderRadius:6,padding:'7px 14px',fontSize:13,fontWeight:600,cursor:'pointer' }}
              >📥 Excel 출력</button>
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
      </div>
    </div>
  </div>
</div>
  );
};

export default ProjectDetail;
