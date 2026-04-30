import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { generateFunctions, generateFPList, parseDocument, parseSystemInfo } from '../utils/claudeApi';
import { getWeight, calcTotalFP, getChangePct, getFuncChangePct, getImpactFactor } from '../utils/fpCalculator';
import mammoth from 'mammoth';

const REUSE_TYPES = ['신규개발', '기능변경', '기능삭제', '수정없이재사용'];
const FP_TYPES = ['EI', 'EO', 'EQ', 'ILF', 'EIF'];

const REUSE_COLORS = {
  신규개발: { bg: '#fce7f3', color: '#9d174d' },
  기능변경: { bg: '#dbeafe', color: '#1e40af' },
  기능삭제: { bg: '#f3f4f6', color: '#374151' },
  수정없이재사용: { bg: '#fef9c3', color: '#854d0e' },
};

const ProjectDetail = ({ projects, onUpdateProject }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const project = projects.find((p) => p.id === id);

  const [tab, setTab] = useState('setup'); // setup | functions | fp
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');

  // 시스템 개요
  const [inputMethod, setInputMethod] = useState('direct'); // direct | file
  const [systemName, setSystemName] = useState(project?.systemName || '');
  const [systemOverview, setSystemOverview] = useState(project?.systemOverview || '');
  const [mainFunctions, setMainFunctions] = useState(project?.mainFunctions || '');
  const [relatedOrgs, setRelatedOrgs] = useState(project?.relatedOrgs || '');
  const [keyword, setKeyword] = useState('');

  // 기능 목록
  const [functions, setFunctions] = useState(project?.functions || []);
  // FP 목록
  const [fpList, setFpList] = useState(project?.fpList || []);

  if (!project) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p>프로젝트를 찾을 수 없습니다.</p>
        <button onClick={() => navigate('/')}>목록으로</button>
      </div>
    );
  }

  const systemInfo = `시스템명: ${systemName}
시스템개요: ${systemOverview}
주요기능: ${mainFunctions}
관련기관: ${relatedOrgs}`;

  // 파일 업로드 처리
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    setLoadingMsg('파일 읽는 중...');
    try {
      let text = '';
      if (file.name.endsWith('.pdf')) {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map((item) => item.str).join(' ') + '\n';
        }
      } else if (file.name.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
      } else if (file.name.endsWith('.png') || file.name.endsWith('.jpg')) {
        text = '이미지 파일은 직접 입력 방식을 사용해주세요.';
      }

      setLoadingMsg('AI가 시스템 정보 분석 중...');
      const info = await parseSystemInfo(text);
      setSystemName(info.systemName || '');
      setSystemOverview(info.overview || '');
      setMainFunctions((info.mainFunctions || []).join(', '));
      setRelatedOrgs((info.relatedOrgs || []).join(', '));
    } catch (err) {
      alert('파일 처리 중 오류: ' + err.message);
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  };

  // 기능정의서 업로드
  const handleFuncDefUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    setLoadingMsg('기능정의서 파싱 중...');
    try {
      let text = '';
      if (file.name.endsWith('.pdf')) {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map((item) => item.str).join(' ') + '\n';
        }
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
      const parsed = await parseDocument(text);
      const withId = parsed.map((f, i) => ({ ...f, id: Date.now() + i }));
      setFunctions(withId);
      setTab('functions');
      saveProject({ functions: withId });
    } catch (err) {
      alert('파일 처리 중 오류: ' + err.message);
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  };

  // AI로 기능목록 생성
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

  // AI로 FP 산정
  const handleGenerateFP = async () => {
    if (functions.length === 0) return alert('기능 목록을 먼저 생성하세요.');
    setLoading(true);
    setLoadingMsg('AI가 FP 산정 중...');
    try {
      const result = await generateFPList(functions);
      const withId = result.map((f, i) => ({
        ...f,
        id: Date.now() + i,
        ftr: Number(f.ftr) || 1,
        det: Number(f.det) || 5,
        ftrChange: f.ftrChange || 0,
        detChange: f.detChange || 0,
      }));
      setFpList(withId);
      setTab('fp');
      const summary = calcTotalFP(withId);
      saveProject({ fpList: withId, fpSummary: summary });
    } catch (err) {
      alert('오류: ' + err.message);
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  };

  // 저장
  const saveProject = (updates) => {
    onUpdateProject(id, updates);
  };

  // 기능목록 행 수정
  const updateFunction = (fid, field, value) => {
    const updated = functions.map((f) =>
      f.id === fid ? { ...f, [field]: value } : f
    );
    setFunctions(updated);
    saveProject({ functions: updated });
  };

  const addFunction = () => {
    const newRow = {
      id: Date.now(), lv1: '', lv2: '', lv3: '', definition: '',
    };
    const updated = [...functions, newRow];
    setFunctions(updated);
    saveProject({ functions: updated });
  };

  const deleteFunction = (fid) => {
    const updated = functions.filter((f) => f.id !== fid);
    setFunctions(updated);
    saveProject({ functions: updated });
  };

  // FP 행 수정
  const updateFP = (fid, field, value) => {
    const updated = fpList.map((f) =>
      f.id === fid ? { ...f, [field]: value } : f
    );
    setFpList(updated);
    const summary = calcTotalFP(updated);
    saveProject({ fpList: updated, fpSummary: summary });
  };

  const addFPRow = () => {
    const newRow = {
      id: Date.now(), lv1: '', lv2: '', lv3: '', definition: '',
      fpType: 'EQ', ftr: 1, det: 5, reuseType: '신규개발',
      ftrChange: 0, detChange: 0,
    };
    const updated = [...fpList, newRow];
    setFpList(updated);
    saveProject({ fpList: updated });
  };

  const deleteFPRow = (fid) => {
    const updated = fpList.filter((f) => f.id !== fid);
    setFpList(updated);
    const summary = calcTotalFP(updated);
    saveProject({ fpList: updated, fpSummary: summary });
  };

  // FP 요약
  const summary = calcTotalFP(fpList);

  // Excel 출력
  const exportExcel = () => {
    const rows = fpList.map((f) => {
      const weight = getWeight(f.fpType, f.ftr, f.det);
      const ftrPct = getChangePct(f.ftrChange, f.ftr);
      const detPct = getChangePct(f.detChange, f.det);
      const funcPct = getFuncChangePct(ftrPct, detPct);
      const impact = f.reuseType === '기능변경' ? getImpactFactor(funcPct) : '';
      return {
        'LV1': f.lv1, 'LV2': f.lv2, 'LV3': f.lv3,
        '단위프로세스 설명': f.definition,
        'FP유형': f.fpType, 'FTR': f.ftr, 'DET': f.det,
        '가중치': weight, '재사용유형': f.reuseType,
        'FTR변경량': f.ftrChange || '',
        'DET변경량': f.detChange || '',
        'FTR변경률(%)': f.reuseType === '기능변경' ? ftrPct : '',
        'DET변경률(%)': f.reuseType === '기능변경' ? detPct : '',
        '기능변경률(%)': f.reuseType === '기능변경' ? funcPct : '',
        '영향계수': impact,
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'FP산정');

    // 요약 시트
    const summaryData = [
      { '구분': '신규개발', 'FP합계': summary.newDev },
      { '구분': '기능변경', 'FP합계': summary.changed },
      { '구분': '기능삭제', 'FP합계': '측정 비대상' },
    ];
    const ws2 = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws2, 'FP요약');

    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf]), `${project.name}_FP산정.xlsx`);
  };

  const inputStyle = {
    width: '100%', padding: '7px 10px', fontSize: 13,
    border: '1px solid #d1d5db', borderRadius: 6, outline: 'none',
    boxSizing: 'border-box',
  };

  const cellStyle = {
    padding: '6px 8px', borderBottom: '1px solid #e5e7eb',
    fontSize: 13, verticalAlign: 'middle',
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 16px' }}>
      {/* 상단 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => navigate('/')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 20 }}
          >←</button>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{project.name}</h2>
        </div>
        {/* FP 요약 카드 */}
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { label: '신규개발', value: `${summary.newDev} FP`, bg: '#fce7f3', color: '#9d174d' },
            { label: '기능변경', value: `${summary.changed} FP`, bg: '#dbeafe', color: '#1e40af' },
            { label: '기능삭제', value: '측정비대상', bg: '#f3f4f6', color: '#374151' },
          ].map((s) => (
            <div key={s.label} style={{
              background: s.bg, color: s.color, borderRadius: 8,
              padding: '8px 16px', textAlign: 'center', minWidth: 100,
            }}>
              <div style={{ fontSize: 11, fontWeight: 500 }}>{s.label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{s.value}</div>
            </div>
          ))}
          <button
            onClick={exportExcel}
            style={{
              background: '#16a34a', color: '#fff', border: 'none',
              borderRadius: 8, padding: '8px 16px', fontSize: 13,
              fontWeight: 600, cursor: 'pointer',
            }}
          >
            Excel 출력
          </button>
        </div>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e5e7eb', marginBottom: 24 }}>
        {[
          { key: 'setup', label: '① 시스템 개요' },
          { key: 'functions', label: '② 기능 목록' },
          { key: 'fp', label: '③ FP 산정표' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '10px 24px', fontSize: 14, fontWeight: 600,
              border: 'none', background: 'none', cursor: 'pointer',
              borderBottom: tab === t.key ? '2px solid #2563eb' : '2px solid transparent',
              color: tab === t.key ? '#2563eb' : '#6b7280',
              marginBottom: -2,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 로딩 */}
      {loading && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999,
        }}>
          <div style={{
            background: '#fff', borderRadius: 12, padding: '32px 48px',
            textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>⚙️</div>
            <p style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>{loadingMsg}</p>
            <p style={{ color: '#6b7280', fontSize: 13 }}>잠시만 기다려주세요...</p>
          </div>
        </div>
      )}

      {/* ① 시스템 개요 탭 */}
      {tab === 'setup' && (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            {['direct', 'file', 'funcdef'].map((m) => (
              <button
                key={m}
                onClick={() => setInputMethod(m)}
                style={{
                  padding: '8px 18px', borderRadius: 8, fontSize: 13,
                  fontWeight: 500, cursor: 'pointer',
                  background: inputMethod === m ? '#2563eb' : '#f3f4f6',
                  color: inputMethod === m ? '#fff' : '#374151',
                  border: 'none',
                }}
              >
                {m === 'direct' ? '직접 입력' : m === 'file' ? '파일 업로드 (시스템개요)' : '기능정의서 바로 업로드'}
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
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                    {item.label}
                  </label>
                  {item.multi ? (
                    <textarea
                      value={item.value}
                      onChange={(e) => item.setter(e.target.value)}
                      placeholder={item.placeholder}
                      rows={3}
                      style={{ ...inputStyle, resize: 'vertical' }}
                    />
                  ) : (
                    <input
                      value={item.value}
                      onChange={(e) => item.setter(e.target.value)}
                      placeholder={item.placeholder}
                      style={inputStyle}
                    />
                  )}
                </div>
              ))}

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                  키워드 입력 <span style={{ color: '#6b7280', fontWeight: 400 }}>(예: 연동계획, 연동운영, 체계관리)</span>
                </label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleGenerateFunctions()}
                    placeholder="키워드 입력 후 Enter 또는 버튼 클릭"
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button
                    onClick={handleGenerateFunctions}
                    style={{
                      background: '#2563eb', color: '#fff', border: 'none',
                      borderRadius: 8, padding: '8px 20px', fontSize: 14,
                      fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    AI 기능목록 생성
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  {['연동계획', '연동운영', '연동관제', '체계운영', '체계관리'].map((kw) => (
                    <button
                      key={kw}
                      onClick={() => setKeyword(kw)}
                      style={{
                        padding: '4px 12px', borderRadius: 20, fontSize: 12,
                        background: '#eff6ff', color: '#2563eb',
                        border: '1px solid #bfdbfe', cursor: 'pointer',
                      }}
                    >
                      {kw}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {inputMethod === 'file' && (
            <div style={{ maxWidth: 500 }}>
              <p style={{ fontSize: 14, color: '#374151', marginBottom: 12 }}>
                시스템 개요 문서를 업로드하면 AI가 자동으로 분석합니다.
                <br />
                <span style={{ color: '#ef4444', fontSize: 12 }}>※ HWP는 PDF로 변환 후 업로드하세요.</span>
              </p>
              <label style={{
                display: 'block', border: '2px dashed #93c5fd',
                borderRadius: 10, padding: '32px', textAlign: 'center',
                cursor: 'pointer', background: '#eff6ff',
              }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
                <p style={{ fontWeight: 600, color: '#2563eb' }}>PDF / DOCX / PNG 업로드</p>
                <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>클릭하여 파일 선택</p>
                <input type="file" accept=".pdf,.docx,.png,.jpg" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>
              {(systemName || systemOverview) && (
                <div style={{ marginTop: 16, padding: 16, background: '#f0fdf4', borderRadius: 8, border: '1px solid #86efac' }}>
                  <p style={{ fontWeight: 600, color: '#16a34a', marginBottom: 8 }}>✅ 파싱 완료</p>
                  <p style={{ fontSize: 13 }}>시스템명: {systemName}</p>
                  <p style={{ fontSize: 13 }}>주요기능: {mainFunctions}</p>
                  <div style={{ marginTop: 12 }}>
                    <input
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      placeholder="키워드 입력"
                      style={{ ...inputStyle, marginBottom: 8 }}
                    />
                    <button
                      onClick={handleGenerateFunctions}
                      style={{
                        background: '#2563eb', color: '#fff', border: 'none',
                        borderRadius: 8, padding: '10px 20px', fontSize: 14,
                        fontWeight: 600, cursor: 'pointer',
                      }}
                    >
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
                기능정의서를 업로드하면 LV1~LV3를 자동 추출하고 바로 FP 산정으로 이동합니다.
                <br />
                <span style={{ color: '#6b7280', fontSize: 12 }}>PDF / DOCX / Excel (.xlsx) 지원</span>
              </p>
              <label style={{
                display: 'block', border: '2px dashed #86efac',
                borderRadius: 10, padding: '32px', textAlign: 'center',
                cursor: 'pointer', background: '#f0fdf4',
              }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                <p style={{ fontWeight: 600, color: '#16a34a' }}>기능정의서 업로드</p>
                <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>PDF / DOCX / Excel</p>
                <input type="file" accept=".pdf,.docx,.xlsx,.xls" onChange={handleFuncDefUpload} style={{ display: 'none' }} />
              </label>
            </div>
          )}
        </div>
      )}

      {/* ② 기능 목록 탭 */}
      {tab === 'functions' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p style={{ fontSize: 14, color: '#6b7280' }}>
              총 {functions.length}개 기능 · 셀 클릭하여 수정 가능
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={addFunction} style={{
                background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe',
                borderRadius: 6, padding: '7px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
              }}>
                + 행 추가
              </button>
              <button onClick={handleGenerateFP} style={{
                background: '#2563eb', color: '#fff', border: 'none',
                borderRadius: 6, padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                AI FP 산정 →
              </button>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['LV1', 'LV2', 'LV3', '기능 정의', '삭제'].map((h) => (
                    <th key={h} style={{ ...cellStyle, fontWeight: 600, textAlign: 'left', color: '#374151', borderBottom: '2px solid #e5e7eb' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {functions.map((f) => (
                  <tr key={f.id} style={{ ':hover': { background: '#f9fafb' } }}>
                    {['lv1', 'lv2', 'lv3', 'definition'].map((field) => (
                      <td key={field} style={cellStyle}>
                        <input
                          value={f[field] || ''}
                          onChange={(e) => updateFunction(f.id, field, e.target.value)}
                          style={{
                            width: '100%', border: 'none', outline: 'none',
                            fontSize: 13, background: 'transparent', padding: '2px 4px',
                          }}
                        />
                      </td>
                    ))}
                    <td style={cellStyle}>
                      <button
                        onClick={() => deleteFunction(f.id)}
                        style={{
                          background: 'none', border: 'none', color: '#ef4444',
                          cursor: 'pointer', fontSize: 16, padding: '2px 8px',
                        }}
                      >✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ③ FP 산정표 탭 */}
      {tab === 'fp' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p style={{ fontSize: 14, color: '#6b7280' }}>
              총 {fpList.length}개 기능 · 모든 셀 수정 가능 · FTR/DET 수정 시 가중치 자동 재계산
            </p>
            <button onClick={addFPRow} style={{
              background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe',
              borderRadius: 6, padding: '7px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}>
              + 행 추가
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['LV1','LV2','LV3','단위프로세스 설명','FP유형','FTR','DET','가중치','재사용유형','FTR변경량','DET변경량','FTR변경률','DET변경률','기능변경률','영향계수','삭제'].map((h) => (
                    <th key={h} style={{ ...cellStyle, fontWeight: 600, color: '#374151', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', textAlign: 'left' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fpList.map((f) => {
                  const weight = getWeight(f.fpType, f.ftr, f.det);
                  const isChanged = f.reuseType === '기능변경';
                  const ftrPct = isChanged ? getChangePct(f.ftrChange, f.ftr) : '';
                  const detPct = isChanged ? getChangePct(f.detChange, f.det) : '';
                  const funcPct = isChanged ? getFuncChangePct(ftrPct, detPct) : '';
                  const impact = isChanged ? getImpactFactor(funcPct) : '';
                  const rColor = REUSE_COLORS[f.reuseType] || {};

                  return (
                    <tr key={f.id}>
                      {['lv1','lv2','lv3','definition'].map((field) => (
                        <td key={field} style={cellStyle}>
                          <input
                            value={f[field] || ''}
                            onChange={(e) => updateFP(f.id, field, e.target.value)}
                            style={{ width: '100%', border: 'none', outline: 'none', fontSize: 12, background: 'transparent', minWidth: 60 }}
                          />
                        </td>
                      ))}
                      <td style={cellStyle}>
                        <select
                          value={f.fpType}
                          onChange={(e) => updateFP(f.id, 'fpType', e.target.value)}
                          style={{ fontSize: 12, border: '1px solid #d1d5db', borderRadius: 4, padding: '2px 4px' }}
                        >
                          {FP_TYPES.map((t) => <option key={t}>{t}</option>)}
                        </select>
                      </td>
                      {['ftr','det'].map((field) => (
                        <td key={field} style={cellStyle}>
                          <input
                            type="number"
                            value={f[field] || 0}
                            onChange={(e) => updateFP(f.id, field, Number(e.target.value))}
                            style={{ width: 50, border: '1px solid #d1d5db', borderRadius: 4, padding: '2px 4px', fontSize: 12 }}
                          />
                        </td>
                      ))}
                      <td style={{ ...cellStyle, fontWeight: 700, color: '#2563eb', textAlign: 'center' }}>
                        {weight}
                      </td>
                      <td style={cellStyle}>
                        <select
                          value={f.reuseType}
                          onChange={(e) => updateFP(f.id, 'reuseType', e.target.value)}
                          style={{
                            fontSize: 12, border: '1px solid #d1d5db', borderRadius: 4,
                            padding: '2px 4px', background: rColor.bg, color: rColor.color, fontWeight: 500,
                          }}
                        >
                          {REUSE_TYPES.map((t) => <option key={t}>{t}</option>)}
                        </select>
                      </td>
                      {['ftrChange','detChange'].map((field) => (
                        <td key={field} style={{ ...cellStyle, background: isChanged ? '#fff' : '#f9fafb' }}>
                          {isChanged ? (
                            <input
                              type="number"
                              value={f[field] || 0}
                              onChange={(e) => updateFP(f.id, field, Number(e.target.value))}
                              style={{ width: 50, border: '1px solid #d1d5db', borderRadius: 4, padding: '2px 4px', fontSize: 12 }}
                            />
                          ) : '-'}
                        </td>
                      ))}
                      <td style={{ ...cellStyle, textAlign: 'center', color: '#6b7280' }}>{ftrPct ? `${ftrPct}%` : '-'}</td>
                      <td style={{ ...cellStyle, textAlign: 'center', color: '#6b7280' }}>{detPct ? `${detPct}%` : '-'}</td>
                      <td style={{ ...cellStyle, textAlign: 'center', color: '#6b7280' }}>{funcPct ? `${funcPct}%` : '-'}</td>
                      <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 600 }}>{impact || '-'}</td>
                      <td style={cellStyle}>
                        <button
                          onClick={() => deleteFPRow(f.id)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16 }}
                        >✕</button>
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