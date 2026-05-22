import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { calcTotalFP } from '../utils/fpCalculator';
import { color, button } from '../styles/tokens';

const { blue: BLUE, blueTint: BLUE_TINT, ink: INK, sub: SUB, mute: MUTE, line: LINE, bg: BG } = color;

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

const calcMaintainRate = (tmp) => {
  if (tmp <= 19) return 0.05;
  if (tmp <= 29) return 0.07;
  if (tmp <= 39) return 0.09;
  if (tmp <= 49) return 0.11;
  if (tmp <= 59) return 0.125;
  if (tmp <= 69) return 0.14;
  if (tmp <= 79) return 0.155;
  return 0.17;
};

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
    <span style={{ fontSize: highlight ? 14 : 12, fontWeight: highlight ? 800 : 600, color: highlight ? '#0F8B47' : INK }}>{value}</span>
  </div>
);

const RATE_TABLE = [
  { range: '0~19점', rate: '5.0%', min: 0, max: 19 },
  { range: '20~29점', rate: '7.0%', min: 20, max: 29 },
  { range: '30~39점', rate: '9.0%', min: 30, max: 39 },
  { range: '40~49점', rate: '11.0%', min: 40, max: 49 },
  { range: '50~59점', rate: '12.5%', min: 50, max: 59 },
  { range: '60~69점', rate: '14.0%', min: 60, max: 69 },
  { range: '70~79점', rate: '15.5%', min: 70, max: 79 },
  { range: '80~100점', rate: '17.0%', min: 80, max: 100 },
];

const MaintenanceCost = ({ projects, projectsLoading }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const project = projects.find((p) => p.id === id);

  const [method, setMethod] = useState('simple');

  const [selections, setSelections] = useState({
    frequency: 1,
    users: 1,
    importance: 1,
    linkage: 1,
    recovery: 1,
  });

  const [linkIdx, setLinkIdx] = useState(0);
  const [perfIdx, setPerfIdx] = useState(0);
  const [envIdx, setEnvIdx] = useState(1);
  const [secIdx, setSecIdx] = useState(1);
  const [profitRate, setProfitRate] = useState(20);
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
  const totalFP = Number(fpSummary.newDev) + Number(fpSummary.changed);

  const tmp = MAINTAIN_CRITERIA.reduce((sum, c) => sum + c.options[selections[c.key]].score, 0);
  const maintainRate = calcMaintainRate(tmp);

  const sizeCoeff = calcSizeCoeff(totalFP);
  const linkCoeff = LINK_COMPLEXITY[linkIdx].value;
  const perfCoeff = PERFORMANCE[perfIdx].value;
  const envCoeff = ENV_COMPAT[envIdx].value;
  const secCoeff = SECURITY[secIdx].value;
  const totalCoeff = Math.round(sizeCoeff * linkCoeff * perfCoeff * envCoeff * secCoeff * 10000) / 10000;

  const preCorrCost = Math.round(totalFP * FP_UNIT_PRICE);
  const devCost = Math.round(preCorrCost * totalCoeff);
  const profit = Math.round(devCost * (profitRate / 100));
  const swDevCost = devCost + profit + Number(directCost);

  const maintainCost = Math.round(swDevCost * maintainRate);
  const maintainWithVAT = Math.round(maintainCost * 1.1);

  const fmt = (n) => Math.round(n).toLocaleString('ko-KR') + '원';
  const pct = (n) => (n * 100).toFixed(1) + '%';

  const tmpColor = tmp <= 29 ? '#0F8B47' : tmp <= 59 ? '#B26A00' : '#E11D48';
  const tmpBg = tmp <= 29 ? '#E7F8EF' : tmp <= 59 ? '#FFF3D6' : '#FFEBEB';

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

  const CARD = { background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, padding: '18px 20px', marginBottom: 14 };
  const GREEN = '#0F8B47';
  const GREEN_BG = '#E7F8EF';

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
          <span style={{ color: INK, fontWeight: 700 }}>유지관리비</span>
        </nav>
        <div style={{ marginLeft: 'auto' }}>
          <button onClick={exportExcel} style={{ ...button.primary, height: 36, padding: '0 16px', fontSize: 13 }}>
            📥 Excel 출력
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px' }}>
        <div style={{ fontSize: 12, color: MUTE, fontWeight: 600, marginBottom: 20 }}>
          홈 · 프로젝트 · 개발비 산출 · <span style={{ color: BLUE, fontWeight: 700 }}>유지관리비</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* ── 좌측 ── */}
          <div>
            {/* FP / 개발비 */}
            <div style={CARD}>
              <span style={{ fontSize: 11, fontWeight: 800, color: MUTE, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 12 }}>SW 개발비 재산정</span>
              <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                {['simple', 'standard'].map(m => (
                  <button key={m} onClick={() => setMethod(m)}
                    style={{ flex: 1, height: 34, fontSize: 12, fontWeight: 700, border: `1px solid ${method === m ? BLUE : LINE}`, borderRadius: 8, cursor: 'pointer', background: method === m ? BLUE_TINT : '#fff', color: method === m ? BLUE : SUB }}>
                    {m === 'simple' ? '간이법' : '정통법'}
                  </button>
                ))}
              </div>
              <div style={{ background: BG, borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
                <ResultRow label="총 기능점수" value={totalFP.toFixed(2) + ' FP'} />
                <ResultRow label="기능점수당 단가" value={FP_UNIT_PRICE.toLocaleString() + '원'} />
                <ResultRow label="총 보정계수" value={totalCoeff} />
                <ResultRow label="보정후 개발원가" value={fmt(devCost)} />
                <ResultRow label={`이윤 (${profitRate}%)`} value={fmt(profit)} />
                <ResultRow label="SW 개발비" value={fmt(swDevCost)} highlight />
              </div>

              {/* 보정계수 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                {[
                  { label: '연계복잡성', idx: linkIdx, setter: setLinkIdx, items: LINK_COMPLEXITY },
                  { label: '성능', idx: perfIdx, setter: setPerfIdx, items: PERFORMANCE },
                  { label: '운영환경', idx: envIdx, setter: setEnvIdx, items: ENV_COMPAT },
                  { label: '보안성', idx: secIdx, setter: setSecIdx, items: SECURITY },
                ].map(item => (
                  <div key={item.label}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: INK, display: 'block', marginBottom: 4 }}>
                      {item.label} <span style={{ color: BLUE }}>{item.items[item.idx].value}</span>
                    </label>
                    <select value={item.idx} onChange={e => item.setter(Number(e.target.value))}
                      style={{ ...SELECT_STYLE, fontSize: 11, padding: '4px 8px' }}>
                      {item.items.map((opt, i) => <option key={i} value={i}>{opt.label.split('.')[0]}. ({opt.value})</option>)}
                    </select>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: INK, display: 'block', marginBottom: 4 }}>이윤율 (최대 25%)</label>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <input type="range" min={0} max={25} value={profitRate} onChange={e => setProfitRate(Number(e.target.value))}
                      style={{ flex: 1, accentColor: GREEN }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: GREEN, minWidth: 32 }}>{profitRate}%</span>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: INK, display: 'block', marginBottom: 4 }}>직접경비</label>
                  <input type="number" value={directCost} onChange={e => setDirectCost(e.target.value)} placeholder="0"
                    style={{ ...SELECT_STYLE, fontSize: 12, padding: '4px 8px' }} />
                </div>
              </div>
            </div>

            {/* 유지관리 난이도 */}
            <div style={CARD}>
              <span style={{ fontSize: 11, fontWeight: 800, color: MUTE, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 16 }}>유지관리 난이도 산정</span>
              {MAINTAIN_CRITERIA.map(c => {
                const sel = c.options[selections[c.key]];
                const levelColor = sel.score === 0 ? GREEN : sel.level === '복잡' ? '#E11D48' : '#B26A00';
                const levelBg = sel.score === 0 ? GREEN_BG : sel.level === '복잡' ? '#FFEBEB' : '#FFF3D6';
                return (
                  <div key={c.key} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: INK }}>{c.label}</label>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: levelBg, color: levelColor, fontWeight: 700 }}>
                        {sel.level} ({sel.score}점)
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {c.options.map((opt, i) => (
                        <button key={i} onClick={() => setSelections(prev => ({ ...prev, [c.key]: i }))}
                          style={{ flex: 1, padding: '8px 4px', fontSize: 11, border: `1.5px solid`, borderRadius: 8, cursor: 'pointer', textAlign: 'center',
                            borderColor: selections[c.key] === i ? BLUE : LINE,
                            background: selections[c.key] === i ? BLUE_TINT : '#fff',
                            color: selections[c.key] === i ? BLUE : SUB,
                            fontWeight: selections[c.key] === i ? 800 : 500 }}>
                          {opt.level}<br />
                          <span style={{ fontSize: 10, fontWeight: 600 }}>{opt.score}점</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── 우측: 결과 ── */}
          <div>
            <div style={{ ...CARD, position: 'sticky', top: 80 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: MUTE, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 14 }}>유지관리비 산출 결과</span>

              {/* TMP 점수 */}
              <div style={{ background: tmpBg, borderRadius: 14, padding: '16px', marginBottom: 14, textAlign: 'center' }}>
                <p style={{ margin: '0 0 4px', fontSize: 12, color: tmpColor, fontWeight: 700 }}>총 유지관리 점수 (TMP)</p>
                <p style={{ margin: '0 0 10px', fontSize: 40, fontWeight: 900, color: tmpColor, letterSpacing: '-0.04em' }}>{tmp}점</p>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                  {MAINTAIN_CRITERIA.map(c => (
                    <span key={c.key} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.7)', color: tmpColor, fontWeight: 700 }}>
                      {c.options[selections[c.key]].score}
                    </span>
                  ))}
                  <span style={{ fontSize: 11, color: tmpColor, fontWeight: 700 }}>= {tmp}</span>
                </div>
              </div>

              {/* 요율 */}
              <div style={{ background: BLUE_TINT, borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: BLUE }}>유지관리 요율</span>
                  <span style={{ fontSize: 26, fontWeight: 900, color: BLUE }}>{pct(maintainRate)}</span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 11, color: MUTE }}>TMP {tmp}점 기준 요율</p>
              </div>

              {/* 요율 구간 참고표 */}
              <div style={{ background: BG, borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: INK }}>요율 구간 참고표</p>
                {RATE_TABLE.map(r => {
                  const active = tmp >= r.min && tmp <= r.max;
                  return (
                    <div key={r.range} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '3px 0',
                      color: active ? BLUE : MUTE, fontWeight: active ? 800 : 500 }}>
                      <span>{r.range}</span>
                      <span>{r.rate}</span>
                    </div>
                  );
                })}
              </div>

              {/* 계산 */}
              <div style={{ background: BG, borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
                <ResultRow label="SW 개발비" value={fmt(swDevCost)} />
                <ResultRow label="× 유지관리 요율" value={pct(maintainRate)} />
              </div>

              {/* 최종 금액 */}
              <div style={{ background: GREEN_BG, border: `1.5px solid ${GREEN}`, borderRadius: 12, padding: '16px', marginBottom: 10 }}>
                <p style={{ margin: '0 0 4px', fontSize: 12, color: GREEN, fontWeight: 700 }}>연간 유지관리비 (부가세 별도)</p>
                <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: GREEN }}>{fmt(maintainCost)}</p>
              </div>
              <div style={{ background: INK, borderRadius: 12, padding: '16px' }}>
                <p style={{ margin: '0 0 4px', fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>연간 유지관리비 (부가세 포함)</p>
                <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#fff' }}>{fmt(maintainWithVAT)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MaintenanceCost;
