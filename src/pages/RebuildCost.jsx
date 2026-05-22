import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { calcTotalFP } from '../utils/fpCalculator';
import { color, button } from '../styles/tokens';

const { blue: BLUE, blueTint: BLUE_TINT, ink: INK, sub: SUB, mute: MUTE, line: LINE, bg: BG } = color;

// ============================================================
// 재사용 난이도 테이블 (공식 산정양식 기준)
// ============================================================
const STRUCT_LEVELS = [
  { label: '매우 어려움 (50)', value: 50 },
  { label: '어려움 (40)', value: 40 },
  { label: '보통 (30)', value: 30 },
  { label: '쉬움 (20)', value: 20 },
  { label: '매우 쉬움 (10)', value: 10 },
];

const DOC_LEVELS = [
  { label: '매우 어려움 (50)', value: 50 },
  { label: '어려움 (40)', value: 40 },
  { label: '보통 (30)', value: 30 },
  { label: '쉬움 (20)', value: 20 },
  { label: '매우 쉬움 (10)', value: 10 },
];

const LINK_COMPLEXITY = [
  { label: '1. 타기관 연계 없음', value: 0.88 },
  { label: '2. 1~2개 타기관 연계', value: 0.94 },
  { label: '3. 3~5개 타기관 연계', value: 1.00 },
  { label: '4. 6~10개 타기관 연계', value: 1.06 },
  { label: '5. 10개 초과 타기관 연계', value: 1.12 },
];
const PERFORMANCE = [
  { label: '1. 응답성능 특별 요구사항 없음', value: 0.91 },
  { label: '2. 요구사항 있으나 특별조치 불필요', value: 0.95 },
  { label: '3. 피크타임에 중요, 처리시한 명시', value: 1.00 },
  { label: '4. 모든 업무시간에 중요, 처리시한 명시', value: 1.05 },
  { label: '5. 엄격한 성능요구, 설계단계부터 분석', value: 1.09 },
];
const ENV_COMPAT = [
  { label: '1. 운영환경 호환성 요구사항 없음', value: 0.94 },
  { label: '2. 동일 HW/SW 환경에서 운영', value: 1.00 },
  { label: '3. 유사 HW/SW 환경에서 운영', value: 1.06 },
  { label: '4. 이질적 HW/SW 환경에서 운영', value: 1.13 },
  { label: '5. 이질적 환경 + 문서화 및 모의훈련 필요', value: 1.19 },
];
const SECURITY = [
  { label: '1. 보안 요구사항 1가지', value: 0.97 },
  { label: '2. 보안 요구사항 2가지', value: 1.00 },
  { label: '3. 보안 요구사항 3가지', value: 1.03 },
  { label: '4. 보안 요구사항 4가지', value: 1.06 },
  { label: '5. 보안 요구사항 5가지 이상', value: 1.08 },
];

const FP_UNIT_PRICE = 605784;

const calcSizeCoeff = (fp) => {
  const f = Number(fp);
  if (!f || f <= 0) return 1.28;
  if (f < 500) return 1.2800;
  if (f > 3000) return 1.1530;
  return Math.round((0.4057 * Math.pow(Math.log(f) - 7.1978, 2) + 0.8878) * 10000) / 10000;
};

const SELECT_STYLE = {
  width: '100%', padding: '8px 12px', border: `1px solid ${LINE}`, borderRadius: 8,
  fontSize: 12, outline: 'none', background: BG, color: INK,
  fontFamily: "'Pretendard', system-ui, sans-serif",
};

const ResultRow = ({ label, value, highlight }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `1px solid ${LINE}` }}>
    <span style={{ fontSize: 12, color: highlight ? INK : MUTE, fontWeight: highlight ? 700 : 500 }}>{label}</span>
    <span style={{ fontSize: highlight ? 14 : 12, fontWeight: highlight ? 800 : 600, color: highlight ? BLUE : INK }}>{value}</span>
  </div>
);

const RebuildCost = ({ projects, projectsLoading }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const project = projects.find((p) => p.id === id);

  const [method, setMethod] = useState('simple');

  const [structIdx, setStructIdx] = useState(2);
  const [docIdx, setDocIdx] = useState(2);
  const [testRatio, setTestRatio] = useState(25);

  const [linkIdx, setLinkIdx] = useState(1);
  const [perfIdx, setPerfIdx] = useState(2);
  const [envIdx, setEnvIdx] = useState(1);
  const [secIdx, setSecIdx] = useState(1);
  const [profitRate, setProfitRate] = useState(25);
  const [directCost, setDirectCost] = useState(0);

  if (projectsLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: 16, fontFamily: "'Pretendard', system-ui, sans-serif", background: BG }}>
        <div style={{ fontSize: 32 }}>⚙️</div>
        <p style={{ fontSize: 15, color: SUB, fontWeight: 600 }}>데이터 불러오는 중...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: 16, fontFamily: "'Pretendard', system-ui, sans-serif", background: BG }}>
        <div style={{ fontSize: 32 }}>⚠️</div>
        <p style={{ fontSize: 15, color: SUB, fontWeight: 600 }}>프로젝트를 찾을 수 없습니다.</p>
        <button onClick={() => navigate('/ba')} style={{ ...button.primary }}>목록으로</button>
      </div>
    );
  }

  const fpList = project?.fpList || [];
  const fpSummary = calcTotalFP(fpList, method);
  const newDevFP = Number(fpSummary.newDev);
  const changedFP = Number(fpSummary.changed);

  const reuseFP = fpList
    .filter(f => f.reuseType === '수정없이재사용')
    .reduce((sum, f) => {
      const w = method === 'simple'
        ? ({ EI: 4.0, EO: 5.2, EQ: 3.9, ILF: 7.5, EIF: 5.4 }[f.fpType] || 0)
        : 0;
      return sum + w;
    }, 0);

  const reuseWithTest = Math.round(reuseFP * (testRatio / 100) * 100) / 100;

  const structVal = STRUCT_LEVELS[structIdx].value;
  const docVal = DOC_LEVELS[docIdx].value;
  // 재사용 난이도 계수: 1 + (구조화+문서화)/100 × 0.4  (검증: 40+30=70 → 1.28 ✓)
  const reuseDiffCoeff = Math.round((1 + (structVal + docVal) / 100 * 0.4) * 10000) / 10000;

  const modifiedReuseFP = Math.round(changedFP * reuseDiffCoeff * 100) / 100;
  const totalRebuildFP = Math.round((newDevFP + reuseWithTest + modifiedReuseFP) * 100) / 100;

  const sizeCoeff = calcSizeCoeff(totalRebuildFP);
  const linkCoeff = LINK_COMPLEXITY[linkIdx].value;
  const perfCoeff = PERFORMANCE[perfIdx].value;
  const envCoeff = ENV_COMPAT[envIdx].value;
  const secCoeff = SECURITY[secIdx].value;
  const totalCoeff = Math.round(sizeCoeff * linkCoeff * perfCoeff * envCoeff * secCoeff * 10000) / 10000;

  const preCorrectionCost = Math.round(totalRebuildFP * FP_UNIT_PRICE);
  const devCost = Math.round(preCorrectionCost * totalCoeff);
  const profit = Math.round(devCost * (profitRate / 100));
  const totalCost = devCost + profit + Number(directCost);
  const totalWithVAT = Math.round(totalCost * 1.1);

  const fmt = (n) => Math.round(n).toLocaleString('ko-KR') + '원';

  const exportExcel = () => {
    const rows = [
      ['SW 재개발비 산출서', '', '', ''],
      ['프로젝트명', project.name, '', ''],
      ['산정방법', method === 'simple' ? '간이법' : '정통법', '', ''],
      ['산정일자', new Date().toLocaleDateString('ko-KR'), '', ''],
      ['', '', '', ''],
      ['구분', '내용', 'FP규모', '금액(원)'],
      ['신규개발 기능규모', '', newDevFP + ' FP', ''],
      ['수정없이재사용 대상 기능규모', '', reuseFP + ' FP', ''],
      ['시험단계 비율', testRatio + '%', '', ''],
      ['수정없이재사용 기능규모', '= 재사용FP × 시험단계비율', reuseWithTest + ' FP', ''],
      ['기능변경(수정후재사용) 규모', '', changedFP + ' FP', ''],
      ['재사용 난이도', '구조화(' + structVal + ') + 문서화(' + docVal + ') → ' + reuseDiffCoeff, '', ''],
      ['수정후 재사용 기능규모', '= 기능변경 × 재사용난이도', modifiedReuseFP + ' FP', ''],
      ['재개발 소프트웨어 규모', '= 신규 + 수정없이재사용 + 수정후재사용', totalRebuildFP + ' FP', ''],
      ['기능점수당 단가', '2025년 기준', FP_UNIT_PRICE.toLocaleString() + '원', ''],
      ['보정전 재개발원가', '', '', preCorrectionCost.toLocaleString()],
      ['', '', '', ''],
      ['보정계수', '', '', ''],
      ['규모 보정계수', '', sizeCoeff, ''],
      ['연계복잡성', LINK_COMPLEXITY[linkIdx].label, linkCoeff, ''],
      ['성능 요구수준', PERFORMANCE[perfIdx].label, perfCoeff, ''],
      ['운영환경 호환성', ENV_COMPAT[envIdx].label, envCoeff, ''],
      ['보안성', SECURITY[secIdx].label, secCoeff, ''],
      ['총 보정계수', '', totalCoeff, ''],
      ['', '', '', ''],
      ['보정후 재개발원가', '', '', devCost.toLocaleString()],
      ['이윤 (' + profitRate + '%)', '', '', profit.toLocaleString()],
      ['직접경비', '', '', Number(directCost).toLocaleString()],
      ['재개발 사업대가 (부가세 별도)', '', '', totalCost.toLocaleString()],
      ['재개발 사업대가 (부가세 포함)', '', '', totalWithVAT.toLocaleString()],
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 30 }, { wch: 40 }, { wch: 15 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, '재개발비산출서');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf]), project.name + '_재개발비산출서.xlsx');
  };

  const CARD = { background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, padding: '18px 20px', marginBottom: 14 };
  const PURPLE = '#7C3AED';
  const PURPLE_BG = '#F3EEFE';

  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: "'Pretendard', system-ui, sans-serif", color: INK }}>
      {/* ── Header ── */}
      <header style={{ height: 64, background: '#fff', borderBottom: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 15 }}>j</div>
          <span style={{ fontWeight: 800, fontSize: 16 }}>junsu</span>
        </div>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: MUTE }}>
          <span style={{ cursor: 'pointer', color: SUB }} onClick={() => navigate('/ba')}>프로젝트</span>
          <span style={{ margin: '0 4px' }}>/</span>
          <span style={{ cursor: 'pointer', color: SUB }} onClick={() => navigate('/project/' + id)}>{project.name}</span>
          <span style={{ margin: '0 4px' }}>/</span>
          <span style={{ cursor: 'pointer', color: SUB }} onClick={() => navigate('/project/' + id + '/cost')}>개발비 산출</span>
          <span style={{ margin: '0 4px' }}>/</span>
          <span style={{ color: INK, fontWeight: 700 }}>재개발비</span>
        </nav>
        <div style={{ marginLeft: 'auto' }}>
          <button onClick={exportExcel} style={{ ...button.primary, height: 36, padding: '0 16px', fontSize: 13 }}>
            📥 Excel 출력
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px' }}>
        <div style={{ fontSize: 12, color: MUTE, fontWeight: 600, marginBottom: 20 }}>
          홈 · 프로젝트 · 개발비 산출 · <span style={{ color: BLUE, fontWeight: 700 }}>재개발비</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* ── 좌측: 입력 ── */}
          <div>
            {/* 산정방법 + FP */}
            <div style={CARD}>
              <span style={{ fontSize: 11, fontWeight: 800, color: MUTE, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 12 }}>FP 산정 방법</span>
              <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                {['simple', 'standard'].map(m => (
                  <button key={m} onClick={() => setMethod(m)}
                    style={{ flex: 1, height: 34, fontSize: 12, fontWeight: 700, border: `1px solid ${method === m ? BLUE : LINE}`, borderRadius: 8, cursor: 'pointer', background: method === m ? BLUE_TINT : '#fff', color: method === m ? BLUE : SUB }}>
                    {m === 'simple' ? '간이법' : '정통법'}
                  </button>
                ))}
              </div>
              <div style={{ background: BG, borderRadius: 10, padding: '10px 14px' }}>
                <ResultRow label="신규개발 FP" value={newDevFP.toFixed(2) + ' FP'} />
                <ResultRow label="기능변경 FP" value={changedFP.toFixed(2) + ' FP'} />
                <ResultRow label="수정없이재사용 FP" value={reuseFP.toFixed(2) + ' FP'} />
              </div>
            </div>

            {/* 재사용 난이도 */}
            <div style={CARD}>
              <span style={{ fontSize: 11, fontWeight: 800, color: MUTE, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>재사용 난이도 산정</span>
              <p style={{ fontSize: 11, color: MUTE, marginBottom: 14, marginTop: 0 }}>
                재사용 난이도 = 1 + (구조화점수 + 문서화점수) / 100 × 0.4
              </p>

              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: INK }}>① 구조화 및 애플리케이션 명확화 정도</label>
                  <span style={{ fontSize: 13, fontWeight: 800, color: PURPLE }}>{structVal}점</span>
                </div>
                <select value={structIdx} onChange={e => setStructIdx(Number(e.target.value))} style={SELECT_STYLE}>
                  {STRUCT_LEVELS.map((s, i) => <option key={i} value={i}>{s.label}</option>)}
                </select>
                <div style={{ fontSize: 11, color: MUTE, marginTop: 4 }}>
                  {['프로그램 모듈화 전혀 없음', '모듈화 낮음', '모듈화 보통', '모듈화 높음', '완전 모듈화'][structIdx]}
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: INK }}>② 문서화 및 소스코드 서술화 정도</label>
                  <span style={{ fontSize: 13, fontWeight: 800, color: PURPLE }}>{docVal}점</span>
                </div>
                <select value={docIdx} onChange={e => setDocIdx(Number(e.target.value))} style={SELECT_STYLE}>
                  {DOC_LEVELS.map((d, i) => <option key={i} value={i}>{d.label}</option>)}
                </select>
                <div style={{ fontSize: 11, color: MUTE, marginTop: 4 }}>
                  {['문서화/소스코드 서술화 전혀 없음', '어느 하나만 보통 수준', '두 가지 모두 보통 수준', '두 가지 모두 충분', '완벽한 문서화'][docIdx]}
                </div>
              </div>

              <div style={{ background: PURPLE_BG, borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
                <ResultRow label="구조화 점수" value={structVal + '점'} />
                <ResultRow label="문서화 점수" value={docVal + '점'} />
                <ResultRow label="합계" value={(structVal + docVal) + '점'} />
                <ResultRow label="재사용 난이도 계수" value={reuseDiffCoeff} highlight />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: INK }}>시험단계 비율 (수정없이재사용, 0~25%)</label>
                  <span style={{ fontSize: 13, fontWeight: 800, color: PURPLE }}>{testRatio}%</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="range" min={0} max={25} value={testRatio} onChange={e => setTestRatio(Number(e.target.value))}
                    style={{ flex: 1, accentColor: PURPLE }} />
                  <input type="number" min={0} max={25} value={testRatio} onChange={e => setTestRatio(Math.min(25, Number(e.target.value)))}
                    style={{ ...SELECT_STYLE, width: 60, textAlign: 'center', padding: '6px 8px' }} />
                  <span style={{ fontSize: 13, color: SUB, fontWeight: 600 }}>%</span>
                </div>
                <p style={{ fontSize: 11, color: MUTE, marginTop: 6 }}>* 수정없이 재사용 기능 중 시험단계 적용 비율 (최대 25%)</p>
              </div>
            </div>

            {/* 보정계수 */}
            <div style={CARD}>
              <span style={{ fontSize: 11, fontWeight: 800, color: MUTE, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 14 }}>보정계수</span>
              {[
                { label: '연계복잡성', idx: linkIdx, setter: setLinkIdx, items: LINK_COMPLEXITY },
                { label: '성능 요구수준', idx: perfIdx, setter: setPerfIdx, items: PERFORMANCE },
                { label: '운영환경 호환성', idx: envIdx, setter: setEnvIdx, items: ENV_COMPAT },
                { label: '보안성', idx: secIdx, setter: setSecIdx, items: SECURITY },
              ].map(item => (
                <div key={item.label} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: INK }}>{item.label}</label>
                    <span style={{ fontSize: 13, fontWeight: 800, color: BLUE }}>{item.items[item.idx].value}</span>
                  </div>
                  <select value={item.idx} onChange={e => item.setter(Number(e.target.value))} style={SELECT_STYLE}>
                    {item.items.map((opt, i) => <option key={i} value={i}>{opt.label} → {opt.value}</option>)}
                  </select>
                </div>
              ))}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: INK }}>이윤율 (최대 25%)</label>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#0F8B47' }}>{profitRate}%</span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="range" min={0} max={25} value={profitRate} onChange={e => setProfitRate(Number(e.target.value))}
                    style={{ flex: 1, accentColor: '#0F8B47' }} />
                  <input type="number" min={0} max={25} value={profitRate} onChange={e => setProfitRate(Math.min(25, Number(e.target.value)))}
                    style={{ ...SELECT_STYLE, width: 60, textAlign: 'center', padding: '6px 8px' }} />
                  <span style={{ fontSize: 13, color: SUB, fontWeight: 600 }}>%</span>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: INK, display: 'block', marginBottom: 5 }}>직접경비 (원)</label>
                <input type="number" value={directCost} onChange={e => setDirectCost(e.target.value)} placeholder="0"
                  style={{ ...SELECT_STYLE, textAlign: 'right' }} />
              </div>
            </div>
          </div>

          {/* ── 우측: 결과 ── */}
          <div>
            <div style={{ ...CARD, position: 'sticky', top: 80 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: MUTE, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 14 }}>재개발비 산출 결과</span>

              {/* FP 규모 계산 */}
              <div style={{ background: BLUE_TINT, borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 800, color: BLUE }}>재개발 소프트웨어 규모</p>
                <ResultRow label="신규개발 기능규모" value={newDevFP.toFixed(2) + ' FP'} />
                <ResultRow label="수정없이재사용 기능규모" value={reuseWithTest.toFixed(2) + ' FP'} />
                <ResultRow label="수정후재사용 기능규모" value={modifiedReuseFP.toFixed(2) + ' FP'} />
                <ResultRow label="재개발 소프트웨어 규모" value={totalRebuildFP.toFixed(2) + ' FP'} highlight />
              </div>

              {/* 보정계수 */}
              <div style={{ background: PURPLE_BG, borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 800, color: PURPLE }}>보정계수</p>
                <div style={{ fontSize: 11, color: MUTE, marginBottom: 8 }}>
                  {sizeCoeff} × {linkCoeff} × {perfCoeff} × {envCoeff} × {secCoeff}
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: PURPLE, textAlign: 'center' }}>{totalCoeff}</div>
              </div>

              {/* 원가 계산 */}
              <div style={{ background: BG, borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
                <ResultRow label="기능점수당 단가" value={FP_UNIT_PRICE.toLocaleString() + '원'} />
                <ResultRow label="보정전 재개발원가" value={fmt(preCorrectionCost)} />
                <ResultRow label="× 총 보정계수" value={totalCoeff} />
                <ResultRow label="보정후 재개발원가" value={fmt(devCost)} highlight />
                <ResultRow label={`이윤 (${profitRate}%)`} value={fmt(profit)} />
                <ResultRow label="직접경비" value={fmt(Number(directCost))} />
              </div>

              {/* 최종 금액 */}
              <div style={{ background: BLUE_TINT, border: `1.5px solid ${BLUE}`, borderRadius: 12, padding: '16px', marginBottom: 10 }}>
                <p style={{ margin: '0 0 4px', fontSize: 12, color: BLUE, fontWeight: 700 }}>재개발 사업대가 (부가세 별도)</p>
                <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: BLUE }}>{fmt(totalCost)}</p>
              </div>
              <div style={{ background: INK, borderRadius: 12, padding: '16px' }}>
                <p style={{ margin: '0 0 4px', fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>재개발 사업대가 (부가세 포함, VAT 10%)</p>
                <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#fff' }}>{fmt(totalWithVAT)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RebuildCost;
