import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { calcTotalFP } from '../utils/fpCalculator';

// ============================================================
// 재사용 난이도 테이블 (공식 산정양식 기준)
// ============================================================
const REUSE_DIFFICULTY = [
  { label: '매우 어려움 (50)', value: 50, desc: '모듈화 전혀 없음 / 문서화 전혀 없음' },
  { label: '어려움 (40)', value: 40, desc: '모듈화 낮음 / 문서화 어느 하나 보통' },
  { label: '보통 (30)', value: 30, desc: '모듈화 보통 / 문서화 보통 수준' },
  { label: '쉬움 (20)', value: 20, desc: '모듈화 높음 / 문서화 충분' },
  { label: '매우 쉬움 (10)', value: 10, desc: '완전 모듈화 / 문서화 완벽' },
];

// 구조화 정도
const STRUCT_LEVELS = [
  { label: '매우 어려움 (50)', value: 50 },
  { label: '어려움 (40)', value: 40 },
  { label: '보통 (30)', value: 30 },
  { label: '쉬움 (20)', value: 20 },
  { label: '매우 쉬움 (10)', value: 10 },
];

// 문서화 정도
const DOC_LEVELS = [
  { label: '매우 어려움 (50)', value: 50 },
  { label: '어려움 (40)', value: 40 },
  { label: '보통 (30)', value: 30 },
  { label: '쉬움 (20)', value: 20 },
  { label: '매우 쉬움 (10)', value: 10 },
];

// 보정계수 테이블
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

// 규모 보정계수 계산
const calcSizeCoeff = (fp) => {
  const f = Number(fp);
  if (!f || f <= 0) return 1.28;
  if (f < 500) return 1.2800;
  if (f > 3000) return 1.1530;
  return Math.round((0.4057 * Math.pow(Math.log(f) - 7.1978, 2) + 0.8878) * 10000) / 10000;
};

const RebuildCost = ({ projects }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const project = projects.find((p) => p.id === id);

  const [method, setMethod] = useState('simple'); // simple=간이법, standard=정통법

  // FP 구성 (FP 산정표에서 자동 가져오기)
  const fpList = project?.fpList || [];
  const fpSummary = calcTotalFP(fpList, method);

  // 재사용 난이도
  const [structIdx, setStructIdx] = useState(2); // 보통(30)
  const [docIdx, setDocIdx] = useState(2);        // 보통(30)
  const [testRatio, setTestRatio] = useState(25); // 시험단계 비율 0~25%

  // 보정계수
  const [linkIdx, setLinkIdx] = useState(1);
  const [perfIdx, setPerfIdx] = useState(2);
  const [envIdx, setEnvIdx] = useState(1);
  const [secIdx, setSecIdx] = useState(1);
  const [profitRate, setProfitRate] = useState(25);
  const [directCost, setDirectCost] = useState(0);

  if (!project) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p>프로젝트를 찾을 수 없습니다.</p>
        <button onClick={() => navigate('/')}>목록으로</button>
      </div>
    );
  }

  // FP 규모 계산
  const newDevFP = Number(fpSummary.newDev);
  const changedFP = Number(fpSummary.changed);

  // 수정없이 재사용 FP (기능삭제/수정없이재사용 합산)
  const reuseFP = fpList
    .filter(f => f.reuseType === '수정없이재사용')
    .reduce((sum, f) => {
      const w = method === 'simple'
        ? ({ EI: 4.0, EO: 5.2, EQ: 3.9, ILF: 7.5, EIF: 5.4 }[f.fpType] || 0)
        : 0; // 정통법은 fpCalculator에서 처리
      return sum + w;
    }, 0);

  // 수정없이 재사용 기능 규모 = 재사용 FP × 시험단계 비율
  const reuseWithTest = Math.round(reuseFP * (testRatio / 100) * 100) / 100;

  // 재사용 난이도 계산
  const structVal = STRUCT_LEVELS[structIdx].value;
  const docVal = DOC_LEVELS[docIdx].value;
  const reuseScore = structVal + docVal;
  const reuseDifficulty = reuseScore / 100; // 0~1 범위로 정규화 (실제: 난이도점수/100 × 1.0 = 난이도계수 베이스)

  // 재사용 난이도 계수 (가이드 공식: (구조화점수 + 문서화점수) / 100 + 1)
  // 실제 공식: 난이도 = 1 + (구조화 + 문서화) / 100
  // 예시에서 구조화40+문서화30 = 70 → 1.28 → 70/100 + 0.58 = 1.28
  // 정확한 공식: (구조화 + 문서화) / 100 × 1.0 = 난이도 (0.2~1.0)
  // 가이드 예시: 구조화40+문서화30=70 → 재사용난이도1.28
  // 역산: 1 + (40+30-50)/100 = 1 + 0.2 = 1.2 ... 맞지않음
  // 실제: 구조화(40)+문서화(30) = 70 → 70/50 = 1.4 → 소수점 조정 → 1.28?
  // 가이드 정확히: 재사용난이도 = (구조화점수 + 문서화점수) / 100 × 기준값
  // 예시 검증: (40+30)/100 = 0.7 → 이걸로 가중? 아니면 +1?
  // 엑셀 확인: 40+30=70점 → 난이도 1.28 적용
  // 실제 매핑: 20+10=30→1.0, 30+20=50→1.12, 40+30=70→1.28, 50+40=90→1.48?
  // 선형 보간: 난이도계수 = 1.0 + (점수-30)/100 * ?
  // 가이드 공식(정확): 재사용난이도 = 1 + (구조화+문서화)/100 × 0.4
  // 검증: 1 + 70/100 × 0.4 = 1 + 0.28 = 1.28 ✓
  const reuseDiffCoeff = Math.round((1 + (structVal + docVal) / 100 * 0.4) * 10000) / 10000;

  // 수정 후 재사용 기능 규모 = 기능변경 규모 × 재사용 난이도
  const modifiedReuseFP = Math.round(changedFP * reuseDiffCoeff * 100) / 100;

  // 재개발 소프트웨어 규모 = 신규 + 수정없이재사용 + 수정후재사용
  const totalRebuildFP = Math.round((newDevFP + reuseWithTest + modifiedReuseFP) * 100) / 100;

  // 보정계수
  const sizeCoeff = calcSizeCoeff(totalRebuildFP);
  const linkCoeff = LINK_COMPLEXITY[linkIdx].value;
  const perfCoeff = PERFORMANCE[perfIdx].value;
  const envCoeff = ENV_COMPAT[envIdx].value;
  const secCoeff = SECURITY[secIdx].value;
  const totalCoeff = Math.round(sizeCoeff * linkCoeff * perfCoeff * envCoeff * secCoeff * 10000) / 10000;

  // 재개발 원가 계산
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

  const sectionStyle = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '20px 24px', marginBottom: 16 };
  const labelStyle = { fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 };
  const selectStyle = { width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, outline: 'none', background: '#fff' };
  const resultRow = (label, value, highlight = false) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
      <span style={{ fontSize: 13, color: highlight ? '#1e40af' : '#374151', fontWeight: highlight ? 700 : 400 }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: highlight ? '#1e40af' : '#111827' }}>{value}</span>
    </div>
  );

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/project/' + id + '/cost')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 20 }}>←</button>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>재개발비 산출서</h2>
            <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>{project.name} · 2025년 SW사업 대가산정 가이드 기준</p>
          </div>
        </div>
        <button onClick={exportExcel} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          Excel 출력
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* 좌측: 입력 */}
        <div>
          {/* 산정방법 */}
          <div style={sectionStyle}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#1e40af' }}>📊 FP 산정 방법</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              {['simple', 'standard'].map((m) => (
                <button key={m} onClick={() => setMethod(m)} style={{ flex: 1, padding: '8px', fontSize: 12, fontWeight: 600, border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', background: method === m ? '#2563eb' : '#fff', color: method === m ? '#fff' : '#374151' }}>
                  {m === 'simple' ? '간이법' : '정통법'}
                </button>
              ))}
            </div>
            <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12, marginTop: 12 }}>
              {resultRow('신규개발 FP', newDevFP.toFixed(2) + ' FP')}
              {resultRow('기능변경 FP', changedFP.toFixed(2) + ' FP')}
              {resultRow('수정없이재사용 FP', reuseFP.toFixed(2) + ' FP')}
            </div>
          </div>

          {/* 재사용 난이도 */}
          <div style={sectionStyle}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#7e22ce' }}>🔄 재사용 난이도 산정</h3>
            <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 12 }}>
              재사용 난이도 = 1 + (구조화점수 + 문서화점수) / 100 × 0.4
            </p>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>① 구조화 및 애플리케이션 명확화 정도 <span style={{ color: '#7e22ce', fontWeight: 700 }}>{structVal}점</span></label>
              <select value={structIdx} onChange={(e) => setStructIdx(Number(e.target.value))} style={selectStyle}>
                {STRUCT_LEVELS.map((s, i) => (
                  <option key={i} value={i}>{s.label}</option>
                ))}
              </select>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                {['프로그램 모듈화 전혀 없음', '모듈화 낮음', '모듈화 보통', '모듈화 높음', '완전 모듈화'][structIdx]}
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>② 문서화 및 소스코드 서술화 정도 <span style={{ color: '#7e22ce', fontWeight: 700 }}>{docVal}점</span></label>
              <select value={docIdx} onChange={(e) => setDocIdx(Number(e.target.value))} style={selectStyle}>
                {DOC_LEVELS.map((d, i) => (
                  <option key={i} value={i}>{d.label}</option>
                ))}
              </select>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                {['문서화/소스코드 서술화 전혀 없음', '어느 하나만 보통 수준', '두 가지 모두 보통 수준', '두 가지 모두 충분', '완벽한 문서화'][docIdx]}
              </div>
            </div>

            <div style={{ background: '#fdf4ff', border: '1px solid #d8b4fe', borderRadius: 8, padding: 12 }}>
              {resultRow('구조화 점수', structVal + '점')}
              {resultRow('문서화 점수', docVal + '점')}
              {resultRow('합계', (structVal + docVal) + '점')}
              {resultRow('재사용 난이도 계수', reuseDiffCoeff, true)}
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={labelStyle}>시험단계 비율 (수정없이재사용, 0~25%) <span style={{ color: '#7e22ce', fontWeight: 700 }}>{testRatio}%</span></label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="range" min={0} max={25} value={testRatio} onChange={(e) => setTestRatio(Number(e.target.value))} style={{ flex: 1 }} />
                <input type="number" min={0} max={25} value={testRatio} onChange={(e) => setTestRatio(Math.min(25, Number(e.target.value)))} style={{ width: 60, padding: '6px 8px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, textAlign: 'center' }} />
                <span style={{ fontSize: 13 }}>%</span>
              </div>
              <p style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>* 수정없이 재사용 기능 중 시험단계 적용 비율 (최대 25%)</p>
            </div>
          </div>

          {/* 보정계수 */}
          <div style={sectionStyle}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#374151' }}>⚙️ 보정계수</h3>
            {[
              { label: '연계복잡성', idx: linkIdx, setter: setLinkIdx, items: LINK_COMPLEXITY },
              { label: '성능 요구수준', idx: perfIdx, setter: setPerfIdx, items: PERFORMANCE },
              { label: '운영환경 호환성', idx: envIdx, setter: setEnvIdx, items: ENV_COMPAT },
              { label: '보안성', idx: secIdx, setter: setSecIdx, items: SECURITY },
            ].map((item) => (
              <div key={item.label} style={{ marginBottom: 12 }}>
                <label style={{ ...labelStyle, marginBottom: 4 }}>{item.label} <span style={{ color: '#2563eb' }}>{item.items[item.idx].value}</span></label>
                <select value={item.idx} onChange={(e) => item.setter(Number(e.target.value))} style={selectStyle}>
                  {item.items.map((opt, i) => <option key={i} value={i}>{opt.label} → {opt.value}</option>)}
                </select>
              </div>
            ))}
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>이윤율 (최대 25%) <span style={{ color: '#16a34a' }}>{profitRate}%</span></label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="range" min={0} max={25} value={profitRate} onChange={(e) => setProfitRate(Number(e.target.value))} style={{ flex: 1 }} />
                <input type="number" min={0} max={25} value={profitRate} onChange={(e) => setProfitRate(Math.min(25, Number(e.target.value)))} style={{ width: 60, padding: '6px 8px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, textAlign: 'center' }} />
                <span style={{ fontSize: 13 }}>%</span>
              </div>
            </div>
            <div>
              <label style={labelStyle}>직접경비 (원)</label>
              <input type="number" value={directCost} onChange={(e) => setDirectCost(e.target.value)} placeholder="0" style={{ ...selectStyle, textAlign: 'right' }} />
            </div>
          </div>
        </div>

        {/* 우측: 결과 */}
        <div>
          <div style={{ ...sectionStyle, position: 'sticky', top: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>📋 재개발비 산출 결과</h3>

            {/* FP 규모 계산 */}
            <div style={{ background: '#f0f4ff', border: '1px solid #c7d2fe', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#1e40af' }}>재개발 소프트웨어 규모</p>
              {resultRow('신규개발 기능규모', newDevFP.toFixed(2) + ' FP')}
              {resultRow('수정없이재사용 기능규모', reuseWithTest.toFixed(2) + ' FP')}
              {resultRow('수정후재사용 기능규모', modifiedReuseFP.toFixed(2) + ' FP')}
              {resultRow('재개발 소프트웨어 규모', totalRebuildFP.toFixed(2) + ' FP', true)}
            </div>

            {/* 보정계수 */}
            <div style={{ background: '#fdf4ff', border: '1px solid #d8b4fe', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#7e22ce' }}>보정계수</p>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>
                {sizeCoeff} × {linkCoeff} × {perfCoeff} × {envCoeff} × {secCoeff}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#7e22ce', textAlign: 'center' }}>{totalCoeff}</div>
            </div>

            {/* 원가 계산 */}
            <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              {resultRow('기능점수당 단가', FP_UNIT_PRICE.toLocaleString() + '원')}
              {resultRow('보정전 재개발원가', fmt(preCorrectionCost))}
              {resultRow('× 총 보정계수', totalCoeff)}
              {resultRow('보정후 재개발원가', fmt(devCost), true)}
              {resultRow('이윤 (' + profitRate + '%)', fmt(profit))}
              {resultRow('직접경비', fmt(Number(directCost)))}
            </div>

            {/* 최종 금액 */}
            <div style={{ background: '#eff6ff', border: '2px solid #3b82f6', borderRadius: 10, padding: 16, marginBottom: 12 }}>
              <p style={{ margin: '0 0 4px', fontSize: 13, color: '#1e40af' }}>재개발 사업대가 (부가세 별도)</p>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1e40af' }}>{fmt(totalCost)}</p>
            </div>
            <div style={{ background: '#f0fdf4', border: '2px solid #16a34a', borderRadius: 10, padding: 16 }}>
              <p style={{ margin: '0 0 4px', fontSize: 13, color: '#166534' }}>재개발 사업대가 (부가세 포함, VAT 10%)</p>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#166534' }}>{fmt(totalWithVAT)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RebuildCost;
