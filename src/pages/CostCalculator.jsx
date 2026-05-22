import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { calcTotalFP } from '../utils/fpCalculator';
import { color, button } from '../styles/tokens';

const { blue: BLUE, blueTint: BLUE_TINT, ink: INK, sub: SUB, mute: MUTE, line: LINE, bg: BG } = color;

// ============================================================
// 보정계수 테이블 (2025년 SW사업 대가산정 가이드 기준)
// ============================================================

const calcSizeCoeff = (fp) => {
  const f = Number(fp);
  if (f < 500) return 1.2800;
  if (f > 3000) return 1.1530;
  const val = 0.4057 * Math.pow(Math.log(f) - 7.1978, 2) + 0.8878;
  return Math.round(val * 10000) / 10000;
};

const LINK_COMPLEXITY = [
  { label: '1. 타기관 연계 없음', value: 0.88 },
  { label: '2. 1~2개의 타기관 연계', value: 0.94 },
  { label: '3. 3~5개의 타기관 연계', value: 1.00 },
  { label: '4. 6~10개의 타기관 연계', value: 1.06 },
  { label: '5. 10개 초과 타기관 연계', value: 1.12 },
];

const PERFORMANCE = [
  { label: '1. 응답성능 특별 요구사항 없음', value: 0.91 },
  { label: '2. 요구사항 있으나 특별조치 불필요', value: 0.95 },
  { label: '3. 피크타임에 중요, 처리시한 명시', value: 1.00 },
  { label: '4. 모든 업무시간에 중요, 처리시한 명시', value: 1.05 },
  { label: '5. 엄격한 성능요구, 설계단계부터 분석 필요', value: 1.09 },
];

const ENV_COMPAT = [
  { label: '1. 운영환경 호환성 요구사항 없음', value: 0.94 },
  { label: '2. 동일 HW/SW 환경에서 운영', value: 1.00 },
  { label: '3. 유사 HW/SW 환경에서 운영', value: 1.06 },
  { label: '4. 이질적 HW/SW 환경에서 운영', value: 1.13 },
  { label: '5. 이질적 환경 + 문서화 및 모의훈련 필요', value: 1.19 },
];

const SECURITY = [
  { label: '1. 보안 요구사항 1가지 (암호화/웹취약점/시큐어코딩/개인정보보호 중 1개)', value: 0.97 },
  { label: '2. 보안 요구사항 2가지', value: 1.00 },
  { label: '3. 보안 요구사항 3가지', value: 1.03 },
  { label: '4. 보안 요구사항 4가지', value: 1.06 },
  { label: '5. 보안 요구사항 5가지 이상', value: 1.08 },
];

const FP_UNIT_PRICE = 605784;

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

const CostCalculator = ({ projects, projectsLoading }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const project = projects.find((p) => p.id === id);

  const [linkIdx, setLinkIdx] = useState(1);
  const [perfIdx, setPerfIdx] = useState(2);
  const [envIdx, setEnvIdx] = useState(1);
  const [secIdx, setSecIdx] = useState(1);
  const [profitRate, setProfitRate] = useState(25);
  const [directCost, setDirectCost] = useState(0);
  const [method, setMethod] = useState('standard');

  const [fpUnitPrice, setFpUnitPrice] = useState(FP_UNIT_PRICE);
  const [showUnitEdit, setShowUnitEdit] = useState(false);

  const [reverseMode, setReverseMode] = useState(false);
  const [targetBudget, setTargetBudget] = useState('');

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

  const fpList = project.fpList || [];
  const fpSummary = calcTotalFP(fpList, method);
  const totalFP = Number(fpSummary.newDev) + Number(fpSummary.changed);

  const sizeCoeff = calcSizeCoeff(totalFP);
  const linkCoeff = LINK_COMPLEXITY[linkIdx].value;
  const perfCoeff = PERFORMANCE[perfIdx].value;
  const envCoeff = ENV_COMPAT[envIdx].value;
  const secCoeff = SECURITY[secIdx].value;
  const totalCoeff = Math.round(sizeCoeff * linkCoeff * perfCoeff * envCoeff * secCoeff * 10000) / 10000;

  const preCorrectionCost = Math.round(totalFP * fpUnitPrice);
  const devCost = Math.round(preCorrectionCost * totalCoeff);
  const profit = Math.round(devCost * (profitRate / 100));
  const totalDevCost = devCost + profit + Number(directCost);
  const totalWithVAT = Math.round(totalDevCost * 1.1);

  const calcReverse = () => {
    const budget = Number(String(targetBudget).replace(/[^0-9]/g, ''));
    if (!budget) return null;
    const reversedFP = Math.round(
      (budget - Number(directCost)) / (fpUnitPrice * totalCoeff * (1 + profitRate / 100))
    );
    const estFuncCount = Math.round(reversedFP / 4.2);
    const estLV2Count = Math.round(estFuncCount / 6);
    return { reversedFP, estFuncCount, estLV2Count };
  };

  const fmt = (n) => Math.round(n).toLocaleString('ko-KR') + '원';

  const exportExcel = async () => {
    try {
      const { exportCostExcel } = await import('../utils/excelExport');
      await exportCostExcel({
        projectName: project.name,
        method,
        totalFP,
        fpSummary,
        fpUnitPrice,
        sizeCoeff, linkCoeff, perfCoeff, envCoeff, secCoeff, totalCoeff,
        linkLabel: LINK_COMPLEXITY[linkIdx].label,
        perfLabel: PERFORMANCE[perfIdx].label,
        envLabel: ENV_COMPAT[envIdx].label,
        secLabel: SECURITY[secIdx].label,
        preCorrectionCost, devCost, profit, profitRate,
        directCost: Number(directCost),
        totalDevCost, totalWithVAT,
      });
    } catch (err) {
      alert('Excel 출력 오류: ' + err.message);
    }
  };

  const CARD = { background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, padding: '18px 20px', marginBottom: 14 };

  const FP_TYPE_COLORS = {
    ILF: { bg: '#E7F8EF', c: '#0F8B47' },
    EIF: { bg: '#FFF3D6', c: '#B26A00' },
    EI:  { bg: '#EAF3FF', c: '#3182F6' },
    EO:  { bg: '#F3EEFE', c: '#7C3AED' },
    EQ:  { bg: '#FFEBEB', c: '#E11D48' },
  };

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
          <span style={{ color: INK, fontWeight: 700 }}>개발비 산출</span>
        </nav>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={() => navigate('/project/' + id + '/rebuild')}
            style={{ height: 36, padding: '0 14px', borderRadius: 999, background: '#fff', color: SUB, border: `1px solid ${LINE}`, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            🔄 재개발비
          </button>
          <button onClick={() => navigate('/project/' + id + '/maintenance')}
            style={{ height: 36, padding: '0 14px', borderRadius: 999, background: '#fff', color: SUB, border: `1px solid ${LINE}`, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            🔧 유지관리비
          </button>
          <button onClick={exportExcel} style={{ ...button.primary, height: 36, padding: '0 16px', fontSize: 13 }}>
            📥 Excel 출력
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px' }}>
        <div style={{ fontSize: 12, color: MUTE, fontWeight: 600, marginBottom: 20 }}>
          홈 · 프로젝트 · <span style={{ color: BLUE, fontWeight: 700 }}>개발비 산출</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* ── 좌측: 입력 ── */}
          <div>
            {/* FP 정보 */}
            <div style={CARD}>
              <span style={{ fontSize: 11, fontWeight: 800, color: MUTE, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 12 }}>FP 산정 결과</span>

              <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                {['standard', 'simple'].map(m => (
                  <button key={m} onClick={() => setMethod(m)}
                    style={{ flex: 1, height: 34, fontSize: 12, fontWeight: 700, border: `1px solid ${method === m ? BLUE : LINE}`, borderRadius: 8, cursor: 'pointer', background: method === m ? BLUE_TINT : '#fff', color: method === m ? BLUE : SUB }}>
                    {m === 'standard' ? '정통법' : '간이법'}
                  </button>
                ))}
              </div>

              {/* 단가 편집 */}
              <div style={{ background: '#FFF9E6', border: '1px solid #FFE082', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#B26A00', fontWeight: 700 }}>기능점수당 단가: {fpUnitPrice.toLocaleString()}원</span>
                  <button onClick={() => setShowUnitEdit(!showUnitEdit)}
                    style={{ fontSize: 11, color: '#B26A00', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                    {showUnitEdit ? '닫기' : '변경'}
                  </button>
                </div>
                {showUnitEdit && (
                  <div style={{ marginTop: 10 }}>
                    <input type="number" value={fpUnitPrice} onChange={e => setFpUnitPrice(Number(e.target.value))}
                      style={{ ...SELECT_STYLE, marginBottom: 8 }} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[{ year: '2025', price: 605784 }, { year: '2024', price: 582004 }, { year: '2023', price: 559600 }].map(p => (
                        <button key={p.year} onClick={() => setFpUnitPrice(p.price)}
                          style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, background: fpUnitPrice === p.price ? '#B26A00' : '#FFF3D6', color: fpUnitPrice === p.price ? '#fff' : '#B26A00', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                          {p.year}년
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ background: BG, borderRadius: 10, padding: '10px 14px' }}>
                <ResultRow label="신규개발 FP" value={fpSummary.newDev + ' FP'} />
                <ResultRow label="기능변경 FP" value={fpSummary.changed + ' FP'} />
                <ResultRow label="총 기능점수" value={totalFP.toFixed(2) + ' FP'} highlight />
                <ResultRow label="기능점수당 단가" value={fpUnitPrice.toLocaleString() + '원'} />
                <ResultRow label="보정전 개발원가" value={fmt(preCorrectionCost)} highlight />
              </div>
            </div>

            {/* 보정계수 */}
            <div style={CARD}>
              <span style={{ fontSize: 11, fontWeight: 800, color: MUTE, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 14 }}>보정계수 선택</span>

              <div style={{ background: BLUE_TINT, borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: BLUE }}>① 규모 보정계수</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: BLUE }}>{sizeCoeff}</span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 10, color: MUTE }}>
                  = 0.4057×(log({totalFP.toFixed(1)})-7.1978)²+0.8878
                  {totalFP < 500 ? ' → 500FP 미만 → 1.2800 적용' : totalFP > 3000 ? ' → 3000FP 초과 → 1.1530 적용' : ''}
                </p>
              </div>

              {[
                ['② 연계복잡성', linkIdx, setLinkIdx, LINK_COMPLEXITY, linkCoeff],
                ['③ 성능 요구수준', perfIdx, setPerfIdx, PERFORMANCE, perfCoeff],
                ['④ 운영환경 호환성', envIdx, setEnvIdx, ENV_COMPAT, envCoeff],
                ['⑤ 보안성', secIdx, setSecIdx, SECURITY, secCoeff],
              ].map(([label, idx, setter, items, val]) => (
                <div key={label} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: INK }}>{label}</label>
                    <span style={{ fontSize: 13, fontWeight: 800, color: BLUE }}>{val}</span>
                  </div>
                  <select value={idx} onChange={e => setter(Number(e.target.value))} style={SELECT_STYLE}>
                    {items.map((item, i) => <option key={i} value={i}>{item.label}</option>)}
                  </select>
                </div>
              ))}

              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: INK }}>직접 인건비 외 비용</label>
                  <span style={{ fontSize: 10, color: MUTE }}>원</span>
                </div>
                <input type="number" value={directCost} onChange={e => setDirectCost(Number(e.target.value))}
                  style={SELECT_STYLE} />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: INK }}>이윤율</label>
                  <span style={{ fontSize: 13, fontWeight: 800, color: BLUE }}>{profitRate}%</span>
                </div>
                <input type="range" min={0} max={25} value={profitRate} onChange={e => setProfitRate(Number(e.target.value))}
                  style={{ width: '100%', marginBottom: 4, accentColor: BLUE }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: MUTE }}>
                  <span>0%</span><span>25% (상한)</span>
                </div>
              </div>
            </div>

            {/* 역산 */}
            <div style={CARD}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: reverseMode ? 14 : 0 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: MUTE, textTransform: 'uppercase', letterSpacing: '0.06em' }}>금액 역산</span>
                <button onClick={() => setReverseMode(!reverseMode)}
                  style={{ height: 30, padding: '0 12px', borderRadius: 999, background: '#fff', color: SUB, border: `1px solid ${LINE}`, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  {reverseMode ? '닫기' : '역산 열기'}
                </button>
              </div>
              {reverseMode && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: INK, display: 'block', marginBottom: 6 }}>목표 예산 (원)</label>
                  <input type="text" value={targetBudget} onChange={e => setTargetBudget(e.target.value.replace(/[^0-9]/g, ''))}
                    style={{ ...SELECT_STYLE, marginBottom: 8 }} placeholder="예산 입력" />
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                    {[[1, 1e8], [2, 2e8], [5, 5e8], [10, 1e9], [20, 2e9]].map(([l, v]) => (
                      <button key={l} onClick={() => setTargetBudget(String(v))}
                        style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, background: BG, color: SUB, border: `1px solid ${LINE}`, cursor: 'pointer', fontWeight: 600 }}>
                        {l}억
                      </button>
                    ))}
                  </div>
                  {targetBudget && Number(targetBudget) > 0 && (() => {
                    const budget = Number(targetBudget);
                    const revFP = Math.round(budget / (fpUnitPrice * Number(totalCoeff)));
                    const revFuncs = Math.round(revFP / 4.2);
                    const gap = revFuncs - (project.functions || []).length;
                    return (
                      <div style={{ background: BG, borderRadius: 10, padding: '10px 14px' }}>
                        <ResultRow label="목표 예산" value={(budget / 1e8).toFixed(1) + '억원'} />
                        <ResultRow label="역산 FP" value={revFP.toLocaleString() + ' FP'} />
                        <ResultRow label="필요 기능 수" value={'약 ' + revFuncs + '개'} />
                        <ResultRow label="현재 기능 수" value={(project.functions || []).length + '개'} />
                        <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                          background: gap > 0 ? BLUE_TINT : gap < 0 ? '#FFEBEB' : '#E7F8EF',
                          color: gap > 0 ? BLUE : gap < 0 ? '#E11D48' : '#0F8B47' }}>
                          {gap > 0 ? `📈 ${gap}개 더 필요` : gap < 0 ? `📉 ${Math.abs(gap)}개 초과` : '✅ 적합'}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* ── 우측: 결과 ── */}
          <div>
            <div style={{ ...CARD, position: 'sticky', top: 80 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: MUTE, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 14 }}>개발비 산출 결과</span>

              {/* 보정계수 요약 */}
              <div style={{ background: BG, borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10 }}>
                  {[['규모', sizeCoeff], ['연계', linkCoeff], ['성능', perfCoeff], ['환경', envCoeff], ['보안', secCoeff]].map(([l, v]) => (
                    <div key={l} style={{ textAlign: 'center', padding: '8px 4px', background: '#fff', borderRadius: 8, border: `1px solid ${LINE}` }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: INK }}>{v}</div>
                      <div style={{ fontSize: 10, color: MUTE, fontWeight: 600 }}>{l}</div>
                    </div>
                  ))}
                  <div style={{ textAlign: 'center', padding: '8px 4px', background: BLUE, borderRadius: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{totalCoeff}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>종합</div>
                  </div>
                </div>
                <ResultRow label="보정전 개발원가" value={fmt(preCorrectionCost)} />
                <ResultRow label="× 총 보정계수" value={totalCoeff} />
                <ResultRow label="보정 개발원가" value={fmt(devCost)} highlight />
              </div>

              {/* 비용 분해 */}
              <div style={{ background: BG, borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
                <ResultRow label="보정 개발원가" value={fmt(devCost)} />
                <ResultRow label={`이윤 (${profitRate}%)`} value={fmt(profit)} />
                <ResultRow label="직접경비" value={fmt(Number(directCost))} />
                <ResultRow label="개발비 합계 (부가세 별도)" value={fmt(totalDevCost)} highlight />
                <ResultRow label="부가세 (10%)" value={fmt(totalDevCost * 0.1)} />
              </div>

              {/* 최종 금액 */}
              <div style={{ background: INK, borderRadius: 14, padding: '20px', textAlign: 'center', marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: 6 }}>최종 개발비 (부가세 포함)</div>
                <div style={{ fontSize: 30, fontWeight: 900, color: '#fff', letterSpacing: '-0.04em' }}>
                  {(totalWithVAT / 1e8).toFixed(2)}<span style={{ fontSize: 16, fontWeight: 500, color: 'rgba(255,255,255,0.6)', marginLeft: 4 }}>억원</span>
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{fmt(totalWithVAT)}</div>
              </div>
            </div>

            {/* FP 유형별 */}
            <div style={CARD}>
              <span style={{ fontSize: 11, fontWeight: 800, color: MUTE, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 14 }}>FP 유형별 구성</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 14 }}>
                {['ILF', 'EIF', 'EI', 'EO', 'EQ'].map(type => {
                  const cnt = fpList.filter(f => f.fpType === type).length;
                  const tc = FP_TYPE_COLORS[type];
                  return (
                    <div key={type} style={{ textAlign: 'center', padding: '10px 4px', background: tc.bg, borderRadius: 10 }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: tc.c }}>{cnt}</div>
                      <div style={{ fontSize: 10, color: tc.c, marginTop: 2, fontWeight: 700 }}>{type}</div>
                    </div>
                  );
                })}
              </div>

              {fpList.length > 0 && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: BG }}>
                        {['LV3', '유형', '가중치', '비고'].map(h => (
                          <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: MUTE, textTransform: 'uppercase', borderBottom: `1px solid ${LINE}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {fpList.slice(0, 20).map((fp, i) => {
                        const tc = FP_TYPE_COLORS[fp.fpType] || { bg: BG, c: SUB };
                        return (
                          <tr key={i}>
                            <td style={{ padding: '6px 8px', borderBottom: `1px solid ${LINE}`, color: INK, fontWeight: 600 }}>{fp.lv3}</td>
                            <td style={{ padding: '6px 8px', borderBottom: `1px solid ${LINE}` }}>
                              <span style={{ background: tc.bg, color: tc.c, padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 800 }}>{fp.fpType}</span>
                            </td>
                            <td style={{ padding: '6px 8px', borderBottom: `1px solid ${LINE}`, fontWeight: 700, color: INK, textAlign: 'center' }}>{fp.weight || fp.simpWeight || '-'}</td>
                            <td style={{ padding: '6px 8px', borderBottom: `1px solid ${LINE}`, color: MUTE }}>{fp.reuseType || ''}</td>
                          </tr>
                        );
                      })}
                      {fpList.length > 20 && (
                        <tr><td colSpan={4} style={{ padding: '10px', textAlign: 'center', color: MUTE, fontSize: 11 }}>+ {fpList.length - 20}개 더 있음 (Excel 출력으로 전체 확인)</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CostCalculator;
