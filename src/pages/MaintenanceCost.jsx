import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { calcTotalFP } from '../utils/fpCalculator';

// ============================================================
// 유지관리 난이도 테이블 (공식 산정양식 기준)
// ============================================================

const MAINTAIN_CRITERIA = [
  {
    key: 'frequency',
    label: '유지관리 횟수 (년간)',
    options: [
      { label: '연 4회 이하', score: 0, level: '단순' },
      { label: '연 5~12회', score: 14, level: '보통' },
      { label: '연 12회 초과', score: 27, level: '복잡' },
    ],
  },
  {
    key: 'users',
    label: '시스템 사용자수',
    options: [
      { label: '내부 25% 이하 / 대국민 1만명 이하', score: 0, level: '단순' },
      { label: '내부 50% 이하 / 대국민 10만명 이하', score: 8, level: '보통' },
      { label: '내부 50% 초과 / 대국민 10만명 초과', score: 18, level: '복잡' },
    ],
  },
  {
    key: 'importance',
    label: '시스템 중요도',
    options: [
      { label: '단순 (4~5급: 경미한 영향)', score: 0, level: '단순' },
      { label: '보통 (3급: 다소의 문제/불편)', score: 17, level: '보통' },
      { label: '복잡 (1~2급: 중대한 문제/국가안보)', score: 31, level: '복잡' },
    ],
  },
  {
    key: 'linkage',
    label: '타시스템 연계',
    options: [
      { label: '연계 없음', score: 0, level: '단순' },
      { label: '1~2개 연계', score: 6, level: '보통' },
      { label: '3개 이상 연계', score: 11, level: '복잡' },
    ],
  },
  {
    key: 'recovery',
    label: '오류복구 신속성',
    options: [
      { label: '12시간 초과', score: 0, level: '단순' },
      { label: '12시간 이내', score: 6, level: '보통' },
      { label: '6시간 이내', score: 13, level: '복잡' },
    ],
  },
];

// 난이도 점수(TMP) → 유지관리 요율 매핑
const calcMaintainRate = (tmp) => {
  if (tmp <= 19) return 0.05;
  if (tmp <= 29) return 0.07;
  if (tmp <= 39) return 0.09;
  if (tmp <= 49) return 0.11;
  if (tmp <= 59) return 0.125;
  if (tmp <= 69) return 0.14;
  if (tmp <= 79) return 0.155;
  return 0.17; // 80~100
};

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

const calcSizeCoeff = (fp) => {
  const f = Number(fp);
  if (!f || f <= 0) return 1.28;
  if (f < 500) return 1.2800;
  if (f > 3000) return 1.1530;
  return Math.round((0.4057 * Math.pow(Math.log(f) - 7.1978, 2) + 0.8878) * 10000) / 10000;
};

const MaintenanceCost = ({ projects }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const project = projects.find((p) => p.id === id);

  const [method, setMethod] = useState('simple');

  // 유지관리 난이도 선택 (각 항목별 옵션 인덱스)
  const [selections, setSelections] = useState({
    frequency: 1,   // 기본: 보통 (14점)
    users: 1,       // 기본: 보통 (8점)
    importance: 1,  // 기본: 보통 (17점)
    linkage: 1,     // 기본: 보통 (6점)
    recovery: 1,    // 기본: 보통 (6점)
  });

  // 보정계수
  const [linkIdx, setLinkIdx] = useState(0);
  const [perfIdx, setPerfIdx] = useState(0);
  const [envIdx, setEnvIdx] = useState(1);
  const [secIdx, setSecIdx] = useState(1);
  const [profitRate, setProfitRate] = useState(20);
  const [directCost, setDirectCost] = useState(0);

  if (!project) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p>프로젝트를 찾을 수 없습니다.</p>
        <button onClick={() => navigate('/')}>목록으로</button>
      </div>
    );
  }

  const fpList = project?.fpList || [];
  const fpSummary = calcTotalFP(fpList, method);
  const totalFP = Number(fpSummary.newDev) + Number(fpSummary.changed);

  // 난이도 총점 계산
  const tmp = MAINTAIN_CRITERIA.reduce((sum, c) => sum + c.options[selections[c.key]].score, 0);
  const maintainRate = calcMaintainRate(tmp);

  // 개발비 재산정 (보정계수 적용)
  const sizeCoeff = calcSizeCoeff(totalFP);
  const linkCoeff = LINK_COMPLEXITY[linkIdx].value;
  const perfCoeff = PERFORMANCE[perfIdx].value;
  const envCoeff = ENV_COMPAT[envIdx].value;
  const secCoeff = SECURITY[secIdx].value;
  const totalCoeff = Math.round(sizeCoeff * linkCoeff * perfCoeff * envCoeff * secCoeff * 10000) / 10000;

  const preCorrCost = Math.round(totalFP * FP_UNIT_PRICE);
  const devCost = Math.round(preCorrCost * totalCoeff);
  const profit = Math.round(devCost * (profitRate / 100));
  const swDevCost = devCost + profit + Number(directCost); // SW 개발비

  // 유지관리비 = SW 개발비 × 유지관리 요율
  const maintainCost = Math.round(swDevCost * maintainRate);
  const maintainWithVAT = Math.round(maintainCost * 1.1);

  const fmt = (n) => Math.round(n).toLocaleString('ko-KR') + '원';
  const pct = (n) => (n * 100).toFixed(1) + '%';

  const exportExcel = () => {
    const rows = [
      ['SW 유지관리비 산출서 (요율제)', '', '', ''],
      ['프로젝트명', project.name, '', ''],
      ['산정방법', method === 'simple' ? '간이법' : '정통법', '', ''],
      ['', '', '', ''],
      ['구분', '내용', '값', '금액(원)'],
      ['총 기능점수', '', totalFP.toFixed(2) + ' FP', ''],
      ['SW 개발비', '', '', swDevCost.toLocaleString()],
      ['', '', '', ''],
      ['유지관리 난이도 산정', '', '', ''],
      ...MAINTAIN_CRITERIA.map(c => [
        c.label,
        c.options[selections[c.key]].label,
        c.options[selections[c.key]].score + '점',
        '',
      ]),
      ['총 유지관리 점수 (TMP)', '', tmp + '점', ''],
      ['유지관리 요율', '', pct(maintainRate), ''],
      ['', '', '', ''],
      ['유지관리비 (부가세 별도)', 'SW개발비 × 유지관리요율', '', maintainCost.toLocaleString()],
      ['유지관리비 (부가세 포함)', '', '', maintainWithVAT.toLocaleString()],
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 30 }, { wch: 40 }, { wch: 15 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, '유지관리비산출서');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf]), project.name + '_유지관리비산출서.xlsx');
  };

  const sectionStyle = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '20px 24px', marginBottom: 16 };
  const labelStyle = { fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 };
  const selectStyle = { width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, outline: 'none', background: '#fff' };
  const resultRow = (label, value, highlight = false) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
      <span style={{ fontSize: 13, color: highlight ? '#166534' : '#374151', fontWeight: highlight ? 700 : 400 }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: highlight ? '#166534' : '#111827' }}>{value}</span>
    </div>
  );

  // TMP 점수 → 색상
  const tmpColor = tmp <= 29 ? '#16a34a' : tmp <= 59 ? '#ea580c' : '#dc2626';

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/project/' + id + '/cost')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 20 }}>←</button>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>유지관리비 산출서</h2>
            <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>{project.name} · 응용SW 유지관리비 요율제</p>
          </div>
        </div>
        <button onClick={exportExcel} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          Excel 출력
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* 좌측 */}
        <div>
          {/* FP / 개발비 */}
          <div style={sectionStyle}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#1e40af' }}>📊 SW 개발비 재산정</h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {['simple', 'standard'].map((m) => (
                <button key={m} onClick={() => setMethod(m)} style={{ flex: 1, padding: '8px', fontSize: 12, fontWeight: 600, border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', background: method === m ? '#2563eb' : '#fff', color: method === m ? '#fff' : '#374151' }}>
                  {m === 'simple' ? '간이법' : '정통법'}
                </button>
              ))}
            </div>
            <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              {resultRow('총 기능점수', totalFP.toFixed(2) + ' FP')}
              {resultRow('기능점수당 단가', FP_UNIT_PRICE.toLocaleString() + '원')}
              {resultRow('총 보정계수', totalCoeff)}
              {resultRow('보정후 개발원가', fmt(devCost))}
              {resultRow('이윤 (' + profitRate + '%)', fmt(profit))}
              {resultRow('SW 개발비', fmt(swDevCost), true)}
            </div>

            {/* 보정계수 간략 입력 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: '연계복잡성', idx: linkIdx, setter: setLinkIdx, items: LINK_COMPLEXITY },
                { label: '성능', idx: perfIdx, setter: setPerfIdx, items: PERFORMANCE },
                { label: '운영환경', idx: envIdx, setter: setEnvIdx, items: ENV_COMPAT },
                { label: '보안성', idx: secIdx, setter: setSecIdx, items: SECURITY },
              ].map((item) => (
                <div key={item.label}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                    {item.label} <span style={{ color: '#2563eb' }}>{item.items[item.idx].value}</span>
                  </label>
                  <select value={item.idx} onChange={(e) => item.setter(Number(e.target.value))} style={{ ...selectStyle, fontSize: 11, padding: '4px 8px' }}>
                    {item.items.map((opt, i) => <option key={i} value={i}>{opt.label.split('.')[0]}. ({opt.value})</option>)}
                  </select>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>이윤율 (최대 25%)</label>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input type="range" min={0} max={25} value={profitRate} onChange={(e) => setProfitRate(Number(e.target.value))} style={{ flex: 1 }} />
                  <span style={{ fontSize: 12, fontWeight: 600, minWidth: 30 }}>{profitRate}%</span>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>직접경비</label>
                <input type="number" value={directCost} onChange={(e) => setDirectCost(e.target.value)} placeholder="0" style={{ ...selectStyle, fontSize: 12, padding: '4px 8px' }} />
              </div>
            </div>
          </div>

          {/* 유지관리 난이도 */}
          <div style={sectionStyle}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#7e22ce' }}>🔧 유지관리 난이도 산정</h3>
            {MAINTAIN_CRITERIA.map((c) => (
              <div key={c.key} style={{ marginBottom: 12 }}>
                <label style={labelStyle}>
                  {c.label}
                  <span style={{ marginLeft: 8, fontSize: 11, padding: '1px 6px', borderRadius: 4,
                    background: c.options[selections[c.key]].score === 0 ? '#f0fdf4' : c.options[selections[c.key]].level === '복잡' ? '#fef2f2' : '#fff7ed',
                    color: c.options[selections[c.key]].score === 0 ? '#16a34a' : c.options[selections[c.key]].level === '복잡' ? '#dc2626' : '#ea580c',
                    fontWeight: 500 }}>
                    {c.options[selections[c.key]].level} ({c.options[selections[c.key]].score}점)
                  </span>
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {c.options.map((opt, i) => (
                    <button key={i} onClick={() => setSelections(prev => ({ ...prev, [c.key]: i }))}
                      style={{ flex: 1, padding: '6px 4px', fontSize: 11, border: '1px solid', borderRadius: 6, cursor: 'pointer', textAlign: 'center',
                        borderColor: selections[c.key] === i ? '#7e22ce' : '#d1d5db',
                        background: selections[c.key] === i ? '#fdf4ff' : '#fff',
                        color: selections[c.key] === i ? '#7e22ce' : '#374151',
                        fontWeight: selections[c.key] === i ? 700 : 400 }}>
                      {opt.level}<br />
                      <span style={{ fontSize: 10 }}>{opt.score}점</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 우측: 결과 */}
        <div>
          <div style={{ ...sectionStyle, position: 'sticky', top: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>📋 유지관리비 산출 결과</h3>

            {/* 난이도 점수 */}
            <div style={{ background: '#fdf4ff', border: '1px solid #d8b4fe', borderRadius: 8, padding: 16, marginBottom: 12, textAlign: 'center' }}>
              <p style={{ margin: '0 0 4px', fontSize: 12, color: '#7e22ce' }}>총 유지관리 점수 (TMP)</p>
              <p style={{ margin: '0 0 8px', fontSize: 36, fontWeight: 700, color: tmpColor }}>{tmp}점</p>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                {MAINTAIN_CRITERIA.map(c => (
                  <span key={c.key} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#f3f4f6', color: '#374151' }}>
                    {c.options[selections[c.key]].score}
                  </span>
                ))}
                <span style={{ fontSize: 10, color: '#6b7280' }}>= {tmp}</span>
              </div>
            </div>

            {/* 요율 */}
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 16, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1e40af' }}>유지관리 요율</span>
                <span style={{ fontSize: 24, fontWeight: 700, color: '#1e40af' }}>{pct(maintainRate)}</span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 11, color: '#6b7280' }}>TMP {tmp}점 기준 요율</p>
            </div>

            {/* 요율 구간 참고 */}
            <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, color: '#374151' }}>요율 구간 참고표</p>
              {[
                { range: '0~19점', rate: '5.0%' }, { range: '20~29점', rate: '7.0%' },
                { range: '30~39점', rate: '9.0%' }, { range: '40~49점', rate: '11.0%' },
                { range: '50~59점', rate: '12.5%' }, { range: '60~69점', rate: '14.0%' },
                { range: '70~79점', rate: '15.5%' }, { range: '80~100점', rate: '17.0%' },
              ].map((r) => (
                <div key={r.range} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '2px 0',
                  color: tmp >= parseInt(r.range) && tmp <= parseInt(r.range.split('~')[1]) ? '#1e40af' : '#9ca3af',
                  fontWeight: pct(maintainRate) === r.rate ? 700 : 400 }}>
                  <span>{r.range}</span><span>{r.rate}</span>
                </div>
              ))}
            </div>

            {/* 계산 */}
            <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              {resultRow('SW 개발비', fmt(swDevCost))}
              {resultRow('× 유지관리 요율', pct(maintainRate))}
            </div>

            <div style={{ background: '#f0fdf4', border: '2px solid #16a34a', borderRadius: 10, padding: 16, marginBottom: 12 }}>
              <p style={{ margin: '0 0 4px', fontSize: 13, color: '#166534' }}>연간 유지관리비 (부가세 별도)</p>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#166534' }}>{fmt(maintainCost)}</p>
            </div>
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: 16 }}>
              <p style={{ margin: '0 0 4px', fontSize: 13, color: '#166534' }}>연간 유지관리비 (부가세 포함)</p>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#166534' }}>{fmt(maintainWithVAT)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MaintenanceCost;
