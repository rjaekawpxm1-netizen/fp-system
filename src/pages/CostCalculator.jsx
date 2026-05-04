import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { calcTotalFP } from '../utils/fpCalculator';

// ============================================================
// 보정계수 테이블 (2025년 SW사업 대가산정 가이드 기준)
// ============================================================

// 1. 규모 보정계수 (수식 기반 자동 계산)
const calcSizeCoeff = (fp) => {
  const f = Number(fp);
  if (f < 500) return 1.2800;
  if (f > 3000) return 1.1530;
  const val = 0.4057 * Math.pow(Math.log(f) - 7.1978, 2) + 0.8878;
  return Math.round(val * 10000) / 10000;
};

// 2. 연계복잡성 보정계수
const LINK_COMPLEXITY = [
  { label: '1. 타기관 연계 없음', value: 0.88 },
  { label: '2. 1~2개의 타기관 연계', value: 0.94 },
  { label: '3. 3~5개의 타기관 연계', value: 1.00 },
  { label: '4. 6~10개의 타기관 연계', value: 1.06 },
  { label: '5. 10개 초과 타기관 연계', value: 1.12 },
];

// 3. 성능 요구수준 보정계수
const PERFORMANCE = [
  { label: '1. 응답성능 특별 요구사항 없음', value: 0.91 },
  { label: '2. 요구사항 있으나 특별조치 불필요', value: 0.95 },
  { label: '3. 피크타임에 중요, 처리시한 명시', value: 1.00 },
  { label: '4. 모든 업무시간에 중요, 처리시한 명시', value: 1.05 },
  { label: '5. 엄격한 성능요구, 설계단계부터 분석 필요', value: 1.09 },
];

// 4. 운영환경 호환성 보정계수
const ENV_COMPAT = [
  { label: '1. 운영환경 호환성 요구사항 없음', value: 0.94 },
  { label: '2. 동일 HW/SW 환경에서 운영', value: 1.00 },
  { label: '3. 유사 HW/SW 환경에서 운영', value: 1.06 },
  { label: '4. 이질적 HW/SW 환경에서 운영', value: 1.13 },
  { label: '5. 이질적 환경 + 문서화 및 모의훈련 필요', value: 1.19 },
];

// 5. 보안성 보정계수
const SECURITY = [
  { label: '1. 보안 요구사항 1가지 (암호화/웹취약점/시큐어코딩/개인정보보호 중 1개)', value: 0.97 },
  { label: '2. 보안 요구사항 2가지', value: 1.00 },
  { label: '3. 보안 요구사항 3가지', value: 1.03 },
  { label: '4. 보안 요구사항 4가지', value: 1.06 },
  { label: '5. 보안 요구사항 5가지 이상', value: 1.08 },
];

const FP_UNIT_PRICE = 605784; // 2025년 기능점수당 단가

const CostCalculator = ({ projects }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const project = projects.find((p) => p.id === id);

  // 보정계수 선택
  const [linkIdx, setLinkIdx] = useState(1);
  const [perfIdx, setPerfIdx] = useState(2);
  const [envIdx, setEnvIdx] = useState(1);
  const [secIdx, setSecIdx] = useState(1);
  const [profitRate, setProfitRate] = useState(25);
  const [directCost, setDirectCost] = useState(0);
  const [method, setMethod] = useState('standard');

  // 요구사항 4: 기능점수당 단가 변경 가능
  const [fpUnitPrice, setFpUnitPrice] = useState(FP_UNIT_PRICE);
  const [showUnitEdit, setShowUnitEdit] = useState(false);

  // 요구사항 5: 금액 역산
  const [reverseMode, setReverseMode] = useState(false);
  const [targetBudget, setTargetBudget] = useState('');

  if (!project) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p>프로젝트를 찾을 수 없습니다.</p>
        <button onClick={() => navigate('/')}>목록으로</button>
      </div>
    );
  }

  const fpList = project.fpList || [];
  const fpSummary = calcTotalFP(fpList, method);
  const totalFP = Number(fpSummary.newDev) + Number(fpSummary.changed);

  // 보정계수
  const sizeCoeff = calcSizeCoeff(totalFP);
  const linkCoeff = LINK_COMPLEXITY[linkIdx].value;
  const perfCoeff = PERFORMANCE[perfIdx].value;
  const envCoeff = ENV_COMPAT[envIdx].value;
  const secCoeff = SECURITY[secIdx].value;
  const totalCoeff = sizeCoeff * linkCoeff * perfCoeff * envCoeff * secCoeff;

  // 순방향 계산
  const preCorrectionCost = Math.round(totalFP * fpUnitPrice);
  const devCost = Math.round(preCorrectionCost * totalCoeff);
  const profit = Math.round(devCost * (profitRate / 100));
  const totalDevCost = devCost + profit + Number(directCost);
  const totalWithVAT = Math.round(totalDevCost * 1.1);

  // 역산: 예산 → FP → 기능 수
  const calcReverse = () => {
    const budget = Number(String(targetBudget).replace(/[^0-9]/g, ''));
    if (!budget) return null;
    // 예산 = FP × 단가 × 보정계수 × (1 + 이윤율) + 직접경비
    // FP = (예산 - 직접경비) / (단가 × 보정계수 × (1 + 이윤율/100))
    const reversedFP = Math.round(
      (budget - Number(directCost)) / (fpUnitPrice * totalCoeff * (1 + profitRate / 100))
    );
    // 기능 수 추정 (평균 FP 3.9~4.5점 기준)
    const estFuncCount = Math.round(reversedFP / 4.2);
    const estLV2Count = Math.round(estFuncCount / 6); // LV2당 평균 6개 LV3
    return { reversedFP, estFuncCount, estLV2Count };
  };

  const reverseResult = reverseMode && targetBudget ? calcReverse() : null;

  const fmt = (n) => n.toLocaleString('ko-KR') + '원';

  // Excel 출력
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const rows = [
      ['SW사업 개발비 산출서', '', '', ''],
      ['프로젝트명', project.name, '', ''],
      ['산정일자', new Date().toLocaleDateString('ko-KR'), '', ''],
      ['', '', '', ''],
      ['구분', '내용', '값', '금액(원)'],
      ['총 기능점수', method === 'standard' ? '정통법' : '간이법', totalFP + ' FP', ''],
      ['신규개발 FP', '', fpSummary.newDev + ' FP', ''],
      ['기능변경 FP', '', fpSummary.changed + ' FP', ''],
      ['기능점수당 단가', '2025년 기준', FP_UNIT_PRICE.toLocaleString() + '원', ''],
      ['보정전 개발원가', '', '', preCorrectionCost.toLocaleString()],
      ['', '', '', ''],
      ['보정계수', '', '', ''],
      ['① 규모 보정계수', `= 0.4057×(log(${totalFP})-7.1978)²+0.8878${totalFP < 500 ? ' (500FP 미만 → 1.28 적용)' : ''}`, sizeCoeff, ''],
      ['② 연계복잡성', LINK_COMPLEXITY[linkIdx].label, linkCoeff, ''],
      ['③ 성능 요구수준', PERFORMANCE[perfIdx].label, perfCoeff, ''],
      ['④ 운영환경 호환성', ENV_COMPAT[envIdx].label, envCoeff, ''],
      ['⑤ 보안성', SECURITY[secIdx].label, secCoeff, ''],
      ['총 보정계수', '① × ② × ③ × ④ × ⑤', Math.round(totalCoeff * 10000) / 10000, ''],
      ['', '', '', ''],
      ['보정후 개발원가', '보정전 × 총보정계수', '', devCost.toLocaleString()],
      ['이윤', `개발원가의 ${profitRate}%`, '', profit.toLocaleString()],
      ['직접경비', '', '', Number(directCost).toLocaleString()],
      ['SW 개발비 합계', '(부가세 별도)', '', totalDevCost.toLocaleString()],
      ['SW 개발비 합계', '(부가세 포함, VAT 10%)', '', totalWithVAT.toLocaleString()],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 25 }, { wch: 50 }, { wch: 15 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, '개발비산출서');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf]), project.name + '_개발비산출서.xlsx');
  };

  const sectionStyle = {
    background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
    padding: '20px 24px', marginBottom: 16,
  };
  const labelStyle = {
    fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8,
  };
  const selectStyle = {
    width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #d1d5db',
    borderRadius: 6, outline: 'none', background: '#fff',
  };
  const resultRow = (label, value, highlight = false) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
      <span style={{ fontSize: 13, color: highlight ? '#1e40af' : '#374151', fontWeight: highlight ? 700 : 400 }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: highlight ? '#1e40af' : '#111827' }}>{value}</span>
    </div>
  );

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/project/' + id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 20 }}>←</button>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>개발비 산출서</h2>
            <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>{project.name} · 2025년 SW사업 대가산정 가이드 기준</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => navigate('/project/' + id + '/rebuild')} style={{ background: '#7e22ce', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            🔄 재개발비
          </button>
          <button onClick={() => navigate('/project/' + id + '/maintenance')} style={{ background: '#0891b2', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            🔧 유지관리비
          </button>
          <button onClick={exportExcel} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Excel 출력
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* 좌측: 입력 */}
        <div>
          {/* FP 정보 */}
          <div style={sectionStyle}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#1e40af' }}>📊 FP 산정 결과</h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {['standard', 'simple'].map((m) => (
                <button key={m} onClick={() => setMethod(m)} style={{ flex: 1, padding: '8px', fontSize: 12, fontWeight: 600, border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', background: method === m ? '#2563eb' : '#fff', color: method === m ? '#fff' : '#374151' }}>
                  {m === 'standard' ? '정통법' : '간이법'}
                </button>
              ))}
            </div>

            {/* 요구사항 4: 기능점수당 단가 변경 */}
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showUnitEdit ? 8 : 0 }}>
                <span style={{ fontSize: 12, color: '#92400e', fontWeight: 600 }}>
                  💰 기능점수당 단가: {fpUnitPrice.toLocaleString()}원/FP
                </span>
                <button onClick={() => setShowUnitEdit(!showUnitEdit)} style={{ fontSize: 11, color: '#d97706', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                  {showUnitEdit ? '닫기' : '✏️ 변경'}
                </button>
              </div>
              {showUnitEdit && (
                <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <input
                      type="number"
                      value={fpUnitPrice}
                      onChange={e => setFpUnitPrice(Number(e.target.value))}
                      style={{ flex: 1, padding: '6px 10px', fontSize: 13, border: '1px solid #fde68a', borderRadius: 6, outline: 'none' }}
                    />
                    <span style={{ fontSize: 12, color: '#92400e' }}>원/FP</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[{ year: '2025', price: 605784 }, { year: '2024', price: 582004 }, { year: '2023', price: 559600 }].map(p => (
                      <button key={p.year} onClick={() => setFpUnitPrice(p.price)} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: fpUnitPrice === p.price ? '#d97706' : '#fef3c7', color: fpUnitPrice === p.price ? '#fff' : '#92400e', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                        {p.year}년 {p.price.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12 }}>
              {resultRow('신규개발 FP', fpSummary.newDev + ' FP')}
              {resultRow('기능변경 FP', fpSummary.changed + ' FP')}
              {resultRow('총 기능점수', totalFP.toFixed(2) + ' FP', true)}
              {resultRow('기능점수당 단가', FP_UNIT_PRICE.toLocaleString() + '원')}
              {resultRow('보정전 개발원가', fmt(preCorrectionCost), true)}
            </div>
          </div>

          {/* 보정계수 입력 */}
          <div style={sectionStyle}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#7e22ce' }}>⚙️ 보정계수 선택</h3>

            {/* 규모 보정계수 */}
            <div style={{ background: '#f0f4ff', borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#3730a3' }}>① 규모 보정계수</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#3730a3' }}>{sizeCoeff}</span>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 11, color: '#6b7280' }}>
                = 0.4057×(log({totalFP.toFixed(1)})-7.1978)²+0.8878
                {totalFP < 500 ? ' → 500FP 미만 → 1.2800 적용' : totalFP > 3000 ? ' → 3000FP 초과 → 1.1530 적용' : ''}
              </p>
            </div>

            {/* 연계복잡성 */}
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>② 연계복잡성 <span style={{ color: '#2563eb', fontWeight: 700 }}>{linkCoeff}</span></label>
              <select value={linkIdx} onChange={(e) => setLinkIdx(Number(e.target.value))} style={selectStyle}>
                {LINK_COMPLEXITY.map((item, i) => (
                  <option key={i} value={i}>{item.label} → {item.value}</option>
                ))}
              </select>
            </div>

            {/* 성능 요구수준 */}
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>③ 성능 요구수준 <span style={{ color: '#2563eb', fontWeight: 700 }}>{perfCoeff}</span></label>
              <select value={perfIdx} onChange={(e) => setPerfIdx(Number(e.target.value))} style={selectStyle}>
                {PERFORMANCE.map((item, i) => (
                  <option key={i} value={i}>{item.label} → {item.value}</option>
                ))}
              </select>
            </div>

            {/* 운영환경 호환성 */}
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>④ 운영환경 호환성 <span style={{ color: '#2563eb', fontWeight: 700 }}>{envCoeff}</span></label>
              <select value={envIdx} onChange={(e) => setEnvIdx(Number(e.target.value))} style={selectStyle}>
                {ENV_COMPAT.map((item, i) => (
                  <option key={i} value={i}>{item.label} → {item.value}</option>
                ))}
              </select>
            </div>

            {/* 보안성 */}
            <div>
              <label style={labelStyle}>⑤ 보안성 <span style={{ color: '#2563eb', fontWeight: 700 }}>{secCoeff}</span></label>
              <select value={secIdx} onChange={(e) => setSecIdx(Number(e.target.value))} style={selectStyle}>
                {SECURITY.map((item, i) => (
                  <option key={i} value={i}>{item.label} → {item.value}</option>
                ))}
              </select>
              <p style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                * 보안 요구사항: 암호화, 웹취약점점검, 시큐어코딩, 개인정보보호 등
              </p>
            </div>
          </div>

          {/* 이윤 및 직접경비 */}
          <div style={sectionStyle}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#166534' }}>💰 이윤 및 직접경비</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>이윤율 (최대 25%) <span style={{ color: '#16a34a', fontWeight: 700 }}>{profitRate}%</span></label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="range" min={0} max={25} value={profitRate} onChange={(e) => setProfitRate(Number(e.target.value))} style={{ flex: 1 }} />
                <input type="number" min={0} max={25} value={profitRate} onChange={(e) => setProfitRate(Math.min(25, Number(e.target.value)))} style={{ width: 60, padding: '6px 8px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, textAlign: 'center' }} />
                <span style={{ fontSize: 13 }}>%</span>
              </div>
              <p style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>* 국가계약법 시행규칙: 이윤율은 25% 초과 불가</p>
            </div>
            <div>
              <label style={labelStyle}>직접경비 (원)</label>
              <input
                type="number"
                value={directCost}
                onChange={(e) => setDirectCost(e.target.value)}
                placeholder="0"
                style={{ ...selectStyle, textAlign: 'right' }}
              />
              <p style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>* 출장비, 교육비, 라이선스비 등 직접 소요 경비</p>
            </div>
          </div>
        </div>

        {/* 우측: 결과 */}
        <div>
          <div style={{ ...sectionStyle, position: 'sticky', top: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#374151' }}>📋 개발비 산출 결과</h3>

            {/* 보정계수 요약 */}
            <div style={{ background: '#fdf4ff', border: '1px solid #d8b4fe', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
              <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: '#7e22ce' }}>총 보정계수</p>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                {sizeCoeff} × {linkCoeff} × {perfCoeff} × {envCoeff} × {secCoeff}
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#7e22ce', textAlign: 'center' }}>
                {Math.round(totalCoeff * 10000) / 10000}
              </div>
            </div>

            {/* 계산 상세 */}
            <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12, marginBottom: 16 }}>
              {resultRow('보정전 개발원가', fmt(preCorrectionCost))}
              {resultRow('× 총 보정계수', Math.round(totalCoeff * 10000) / 10000)}
              {resultRow('보정후 개발원가', fmt(devCost), true)}
              {resultRow('이윤 (' + profitRate + '%)', fmt(profit))}
              {resultRow('직접경비', fmt(Number(directCost)))}
            </div>

            {/* 최종 금액 */}
            <div style={{ background: '#eff6ff', border: '2px solid #3b82f6', borderRadius: 10, padding: 16, marginBottom: 12 }}>
              <p style={{ margin: '0 0 4px', fontSize: 13, color: '#1e40af' }}>SW 개발비 (부가세 별도)</p>
              <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#1e40af' }}>{fmt(totalDevCost)}</p>
            </div>

            <div style={{ background: '#f0fdf4', border: '2px solid #16a34a', borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <p style={{ margin: '0 0 4px', fontSize: 13, color: '#166534' }}>SW 개발비 (부가세 포함, VAT 10%)</p>
              <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#166534' }}>{fmt(totalWithVAT)}</p>
            </div>

            {/* 단계별 발주 참고 */}
            <div style={{ background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: '#92400e' }}>📌 단계별 발주 참고</p>
              {[
                { label: '분석 (19.0%)', rate: 0.190 },
                { label: '설계사업 (28.1%)', rate: 0.281 },
                { label: '구축사업 (71.9%)', rate: 0.719 },
              ].map((s) => (
                <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#374151', padding: '3px 0' }}>
                  <span>{s.label}</span>
                  <span style={{ fontWeight: 600 }}>{fmt(Math.round(devCost * s.rate))}</span>
                </div>
              ))}
            </div>

            {/* 투입공수 산정 */}
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: '#166534' }}>👥 투입공수 추정</p>
              {(() => {
                // 직무별 비율 (전자정부 표준프레임워크 기준)
                const roles = [
                  { role: '분석가', ratio: 0.10, unitCost: 75000 },
                  { role: '설계자', ratio: 0.15, unitCost: 70000 },
                  { role: '개발자', ratio: 0.50, unitCost: 55000 },
                  { role: '테스터', ratio: 0.15, unitCost: 50000 },
                  { role: 'PM', ratio: 0.10, unitCost: 90000 },
                ];
                const totalDays = Math.round(devCost / 550000); // 일당 평균 55만원 기준
                return (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                      <span style={{ color: '#374151' }}>총 투입공수 (추정)</span>
                      <span style={{ fontWeight: 700, color: '#166534' }}>{totalDays}일 ({Math.round(totalDays/20)}개월)</span>
                    </div>
                    {roles.map(r => (
                      <div key={r.role} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280', padding: '2px 0' }}>
                        <span>{r.role} ({Math.round(r.ratio*100)}%)</span>
                        <span>{Math.round(totalDays * r.ratio)}일</span>
                      </div>
                    ))}
                  </>
                );
              })()}
            </div>

            {/* 사업비 총괄표 */}
            <div style={{ background: '#fdf4ff', border: '1px solid #d8b4fe', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: '#7e22ce' }}>📊 사업비 총괄표</p>
              {[
                { label: 'SW 개발비', value: totalDevCost },
                { label: 'SW 유지관리비 (연간 추정 9%)', value: Math.round(totalDevCost * 0.09) },
                { label: '합계 (개발+1년유지)', value: totalDevCost + Math.round(totalDevCost * 0.09) },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px solid #f3e8ff' }}>
                  <span style={{ color: '#374151' }}>{item.label}</span>
                  <span style={{ fontWeight: 600, color: '#7e22ce' }}>{fmt(item.value)}</span>
                </div>
              ))}
              <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 6 }}>* 유지관리비는 평균 요율(9%) 적용.</p>
            </div>

            {/* 요구사항 5: 금액 역산 */}
            <div style={{ background: '#f0f9ff', border: '1px solid #7dd3fc', borderRadius: 8, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#0369a1' }}>🔄 금액 역산 (예산 → FP · 기능 수)</p>
                <button onClick={() => setReverseMode(!reverseMode)} style={{ fontSize: 11, color: '#0369a1', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                  {reverseMode ? '닫기' : '열기'}
                </button>
              </div>
              {reverseMode && (
                <div>
                  <p style={{ fontSize: 11, color: '#0369a1', marginBottom: 8 }}>
                    목표 예산을 입력하면 필요한 FP와 기능 수를 역산합니다.<br />
                    현재 설정된 보정계수와 단가가 적용됩니다.
                  </p>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
                    <input
                      type="text"
                      value={targetBudget}
                      onChange={e => setTargetBudget(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="예산 입력 (원)"
                      style={{ flex: 1, padding: '7px 10px', fontSize: 13, border: '1px solid #7dd3fc', borderRadius: 6, outline: 'none' }}
                    />
                    <span style={{ fontSize: 12, color: '#0369a1', whiteSpace: 'nowrap' }}>원</span>
                  </div>
                  {/* 빠른 선택 */}
                  <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                    {['2억', '4억', '6억', '10억', '20억'].map(v => {
                      const num = v.includes('억') ? Number(v.replace('억', '')) * 100000000 : Number(v.replace('천만', '')) * 10000000;
                      return (
                        <button key={v} onClick={() => setTargetBudget(String(num))} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 10, background: targetBudget === String(num) ? '#0369a1' : '#e0f2fe', color: targetBudget === String(num) ? '#fff' : '#0369a1', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                          {v}
                        </button>
                      );
                    })}
                  </div>
                  {reverseResult && (
                    <div style={{ background: '#fff', borderRadius: 8, padding: '10px 12px', border: '1px solid #bae6fd' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px solid #f0f9ff' }}>
                        <span style={{ color: '#374151' }}>목표 예산</span>
                        <span style={{ fontWeight: 700, color: '#0369a1' }}>{Number(targetBudget).toLocaleString()}원</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px solid #f0f9ff' }}>
                        <span style={{ color: '#374151' }}>필요 FP (역산)</span>
                        <span style={{ fontWeight: 700, color: '#0369a1' }}>{reverseResult.reversedFP.toLocaleString()} FP</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px solid #f0f9ff' }}>
                        <span style={{ color: '#374151' }}>추정 기능 수 (LV3)</span>
                        <span style={{ fontWeight: 700, color: '#0369a1' }}>약 {reverseResult.estFuncCount.toLocaleString()}개</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0' }}>
                        <span style={{ color: '#374151' }}>추정 LV2 업무단위</span>
                        <span style={{ fontWeight: 700, color: '#0369a1' }}>약 {reverseResult.estLV2Count}개</span>
                      </div>
                      <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 6 }}>
                        * 평균 FP 4.2점/기능, LV2당 6개 LV3 기준 추정값
                      </p>
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

export default CostCalculator;
