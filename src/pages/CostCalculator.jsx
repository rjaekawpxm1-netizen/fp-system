import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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

  if (!projects || projects.length === 0) {
    return (
      <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', flexDirection:'column', gap:16, fontFamily:"'Pretendard', -apple-system, 'Malgun Gothic', sans-serif" }}>
        <div style={{ fontSize:32 }}>⚙️</div>
        <p style={{ fontSize:15, color:'#374151', fontWeight:600 }}>데이터 불러오는 중...</p>
        <button onClick={() => navigate('/ba')} style={{ background:'#e5e7eb', color:'#374151', border:'none', borderRadius:7, padding:'8px 16px', fontSize:13, cursor:'pointer' }}>목록으로</button>
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', flexDirection:'column', gap:16, fontFamily:"'Pretendard', -apple-system, 'Malgun Gothic', sans-serif" }}>
        <div style={{ fontSize:32 }}>⚠️</div>
        <p style={{ fontSize:15, color:'#374151', fontWeight:600 }}>프로젝트를 찾을 수 없습니다.</p>
        <button onClick={() => navigate('/ba')} style={{ background:'#1d4ed8', color:'#fff', border:'none', borderRadius:7, padding:'8px 16px', fontSize:13, cursor:'pointer' }}>목록으로</button>
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

  // ── 새 디자인 스타일 ──
  const S = {
    wrap: { minHeight:'100vh', background:'#f5f4f0', fontFamily:"'Pretendard',-apple-system,'Malgun Gothic',sans-serif" },
    header: { background:'#111318', borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'0 28px', height:52, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:50 },
    main: { maxWidth:980, margin:'0 auto', padding:'22px 20px' },
    card: { background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:'18px 20px', marginBottom:14 },
    sectionTitle: { fontSize:12, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:12, display:'block' },
    label: { fontSize:11, fontWeight:600, color:'#374151', display:'block', marginBottom:5 },
    select: { width:'100%', padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:7, fontSize:12, color:'#111827', background:'#fafafa', outline:'none' },
    btnPrimary: { background:'#111827', color:'#fff', border:'none', borderRadius:7, padding:'8px 14px', fontSize:12, fontWeight:600, cursor:'pointer' },
    btnOutline: { background:'#fff', color:'#374151', border:'1px solid #e5e7eb', borderRadius:7, padding:'8px 12px', fontSize:12, cursor:'pointer' },
    resultRow: (label, value, highlight) => (
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0', borderBottom:'1px solid #f3f4f6' }}>
        <span style={{ fontSize:12, color: highlight?'#111827':'#6b7280', fontWeight: highlight?600:400 }}>{label}</span>
        <span style={{ fontSize: highlight?14:12, fontWeight: highlight?700:500, color: highlight?'#111827':'#374151' }}>{value}</span>
      </div>
    ),
  };

  return (
    <div style={S.wrap}>
      {/* 헤더 */}
      <div style={S.header}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:28, height:28, background:'#3b6cf8', borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, color:'#fff' }}>BA</div>
          <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12 }}>
            <span style={{ color:'#6b7280', cursor:'pointer' }} onClick={()=>navigate('/')}>프로젝트</span>
            <span style={{ color:'#4b5563' }}>/</span>
            <span style={{ color:'#9ca3af', cursor:'pointer' }} onClick={()=>navigate('/project/'+id)}>{project.name}</span>
            <span style={{ color:'#4b5563' }}>/</span>
            <span style={{ color:'#fff', fontWeight:600 }}>개발비 산출</span>
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={()=>navigate('/project/'+id+'/rebuild')} style={{ ...S.btnOutline, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'#9ca3af', fontSize:11 }}>🔄 재개발비</button>
          <button onClick={()=>navigate('/project/'+id+'/maintenance')} style={{ ...S.btnOutline, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'#9ca3af', fontSize:11 }}>🔧 유지관리비</button>
          <button onClick={exportExcel} style={{ ...S.btnPrimary, fontSize:12 }}>📥 Excel 출력</button>
        </div>
      </div>

      <div style={S.main}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

          {/* 좌측: 입력 */}
          <div>
            {/* FP 정보 */}
            <div style={S.card}>
              <span style={S.sectionTitle}>FP 산정 결과</span>
              <div style={{ display:'flex', gap:6, marginBottom:12 }}>
                {['standard','simple'].map(m=>(
                  <button key={m} onClick={()=>setMethod(m)} style={{ flex:1, padding:'7px', fontSize:11, fontWeight:600, border:'1px solid '+(method===m?'#111827':'#e5e7eb'), borderRadius:6, cursor:'pointer', background:method===m?'#111827':'#fff', color:method===m?'#fff':'#374151' }}>
                    {m==='standard'?'정통법':'간이법'}
                  </button>
                ))}
              </div>

              <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:7, padding:'9px 12px', marginBottom:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:11, color:'#92400e', fontWeight:600 }}>기능점수당 단가: {fpUnitPrice.toLocaleString()}원</span>
                  <button onClick={()=>setShowUnitEdit(!showUnitEdit)} style={{ fontSize:10, color:'#d97706', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>{showUnitEdit?'닫기':'변경'}</button>
                </div>
                {showUnitEdit && (
                  <div style={{ marginTop:8 }}>
                    <input type="number" value={fpUnitPrice} onChange={e=>setFpUnitPrice(Number(e.target.value))}
                      style={{ width:'100%', padding:'6px 10px', fontSize:12, border:'1px solid #fde68a', borderRadius:6, outline:'none', boxSizing:'border-box', marginBottom:6 }}/>
                    <div style={{ display:'flex', gap:5 }}>
                      {[{year:'2025',price:605784},{year:'2024',price:582004},{year:'2023',price:559600}].map(p=>(
                        <button key={p.year} onClick={()=>setFpUnitPrice(p.price)} style={{ fontSize:10, padding:'2px 8px', borderRadius:8, background:fpUnitPrice===p.price?'#d97706':'#fef3c7', color:fpUnitPrice===p.price?'#fff':'#92400e', border:'none', cursor:'pointer' }}>{p.year}년</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ background:'#f9fafb', borderRadius:8, padding:'10px 12px' }}>
                {S.resultRow('신규개발 FP', fpSummary.newDev+' FP')}
                {S.resultRow('기능변경 FP', fpSummary.changed+' FP')}
                {S.resultRow('총 기능점수', totalFP.toFixed(2)+' FP', true)}
                {S.resultRow('기능점수당 단가', FP_UNIT_PRICE.toLocaleString()+'원')}
                {S.resultRow('보정전 개발원가', fmt(preCorrectionCost), true)}
              </div>
            </div>

            {/* 보정계수 */}
            <div style={S.card}>
              <span style={S.sectionTitle}>보정계수 선택</span>

              <div style={{ background:'#f0f4ff', borderRadius:7, padding:'10px 12px', marginBottom:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:12, fontWeight:600, color:'#3730a3' }}>① 규모 보정계수</span>
                  <span style={{ fontSize:15, fontWeight:800, color:'#3730a3' }}>{sizeCoeff}</span>
                </div>
                <p style={{ margin:'4px 0 0', fontSize:10, color:'#6b7280' }}>= 0.4057×(log({totalFP.toFixed(1)})-7.1978)²+0.8878{totalFP<500?' → 500FP 미만 → 1.2800 적용':totalFP>3000?' → 3000FP 초과 → 1.1530 적용':''}</p>
              </div>

              {[
                ['② 연계복잡성', linkIdx, setLinkIdx, LINK_COMPLEXITY, linkCoeff],
                ['③ 성능 요구수준', perfIdx, setPerfIdx, PERFORMANCE, perfCoeff],
                ['④ 운영환경 호환성', envIdx, setEnvIdx, ENV_COMPAT, envCoeff],
                ['⑤ 보안성', secIdx, setSecIdx, SECURITY, secCoeff],
              ].map(([label, idx, setter, items, val])=>(
                <div key={label} style={{ marginBottom:10 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <label style={{ fontSize:11, fontWeight:600, color:'#374151' }}>{label}</label>
                    <span style={{ fontSize:12, fontWeight:700, color:'#2563eb' }}>{val}</span>
                  </div>
                  <select value={idx} onChange={e=>setter(Number(e.target.value))} style={S.select}>
                    {items.map((item,i)=><option key={i} value={i}>{item.label}</option>)}
                  </select>
                </div>
              ))}

              <div style={{ marginBottom:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <label style={{ fontSize:11, fontWeight:600, color:'#374151' }}>직접 인건비 외 비용</label>
                  <span style={{ fontSize:10, color:'#9ca3af' }}>원</span>
                </div>
                <input type="number" value={directCost} onChange={e=>setDirectCost(Number(e.target.value))}
                  style={{ width:'100%', padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:7, fontSize:12, outline:'none', boxSizing:'border-box' }}/>
              </div>

              <div>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <label style={{ fontSize:11, fontWeight:600, color:'#374151' }}>이윤율</label>
                  <span style={{ fontSize:12, fontWeight:700, color:'#2563eb' }}>{profitRate}%</span>
                </div>
                <input type="range" min={0} max={25} value={profitRate} onChange={e=>setProfitRate(Number(e.target.value))}
                  style={{ width:'100%', marginBottom:4 }}/>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#9ca3af' }}>
                  <span>0%</span><span>25% (상한)</span>
                </div>
              </div>
            </div>

            {/* 역산 */}
            <div style={S.card}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <span style={S.sectionTitle}>금액 역산</span>
                <button onClick={()=>setReverseMode(!reverseMode)} style={{ ...S.btnOutline, fontSize:11, padding:'5px 10px' }}>
                  {reverseMode?'닫기':'역산 열기'}
                </button>
              </div>
              {reverseMode && (
                <div>
                  <label style={S.label}>목표 예산 (원)</label>
                  <input type="text" value={targetBudget} onChange={e=>setTargetBudget(e.target.value.replace(/[^0-9]/g,''))}
                    style={{ ...S.select, marginBottom:8 }} placeholder="예산 입력"/>
                  <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:8 }}>
                    {[[1,1e8],[2,2e8],[5,5e8],[10,1e9],[20,2e9]].map(([l,v])=>(
                      <button key={l} onClick={()=>setTargetBudget(String(v))} style={{ fontSize:10, padding:'2px 8px', borderRadius:8, background:'#f3f4f6', color:'#374151', border:'1px solid #e5e7eb', cursor:'pointer' }}>{l}억</button>
                    ))}
                  </div>
                  {targetBudget && Number(targetBudget)>0 && (() => {
                    const budget = Number(targetBudget);
                    const revFP = Math.round(budget / (fpUnitPrice * Number(totalCoeff)));
                    const revFuncs = Math.round(revFP / 4.2);
                    const gap = revFuncs - (project.functions||[]).length;
                    return (
                      <div style={{ background:'#f9fafb', borderRadius:7, padding:'10px 12px' }}>
                        {S.resultRow('목표 예산', (budget/1e8).toFixed(1)+'억원')}
                        {S.resultRow('역산 FP', revFP.toLocaleString()+' FP')}
                        {S.resultRow('필요 기능 수', '약 '+revFuncs+'개')}
                        {S.resultRow('현재 기능 수', (project.functions||[]).length+'개')}
                        <div style={{ marginTop:8, padding:'6px 10px', borderRadius:6, background:gap>0?'#eff6ff':gap<0?'#fef2f2':'#f0fdf4', fontSize:11, fontWeight:600, color:gap>0?'#1e40af':gap<0?'#dc2626':'#16a34a' }}>
                          {gap>0?`📈 ${gap}개 더 필요`:gap<0?`📉 ${Math.abs(gap)}개 초과`:'✅ 적합'}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* 우측: 결과 */}
          <div>
            <div style={S.card}>
              <span style={S.sectionTitle}>개발비 산출 결과</span>

              {/* 보정계수 요약 */}
              <div style={{ background:'#f9fafb', borderRadius:8, padding:'10px 12px', marginBottom:12 }}>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, marginBottom:8 }}>
                  {[['규모',sizeCoeff],['연계',linkCoeff],['성능',perfCoeff],['환경',envCoeff],['보안',secCoeff]].map(([l,v])=>(
                    <div key={l} style={{ textAlign:'center', padding:'6px', background:'#fff', borderRadius:6, border:'1px solid #e5e7eb' }}>
                      <div style={{ fontSize:13, fontWeight:700, color:'#111827' }}>{v}</div>
                      <div style={{ fontSize:9, color:'#9ca3af' }}>{l}</div>
                    </div>
                  ))}
                  <div style={{ textAlign:'center', padding:'6px', background:'#111827', borderRadius:6 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'#fff' }}>{totalCoeff}</div>
                    <div style={{ fontSize:9, color:'#9ca3af' }}>종합</div>
                  </div>
                </div>
                {S.resultRow('보정전 개발원가', fmt(preCorrectionCost))}
                {S.resultRow('보정계수', '× '+totalCoeff)}
                {S.resultRow('보정 개발원가', fmt(correctedCost), true)}
              </div>

              {/* 비용 분해 */}
              <div style={{ background:'#f9fafb', borderRadius:8, padding:'10px 12px', marginBottom:12 }}>
                {S.resultRow('직접인건비', fmt(directLabor))}
                {S.resultRow('제경비 (110%)', fmt(overhead))}
                {S.resultRow('기술료 (20%)', fmt(techFee))}
                {S.resultRow('직접비', fmt(directCost))}
                {S.resultRow('이윤 ('+profitRate+'%)', fmt(profit))}
                {S.resultRow('개발비 합계 (부가세 제외)', fmt(totalWithoutVAT), true)}
              </div>

              {/* 최종 금액 */}
              <div style={{ background:'#111827', borderRadius:10, padding:'16px 18px', textAlign:'center' }}>
                <div style={{ fontSize:11, color:'#6b7280', marginBottom:4 }}>최종 개발비 (부가세 포함)</div>
                <div style={{ fontSize:28, fontWeight:900, color:'#fff', letterSpacing:'-0.5px' }}>
                  {(totalWithVAT/1e8).toFixed(2)}<span style={{ fontSize:16, fontWeight:400, color:'#9ca3af' }}>억원</span>
                </div>
                <div style={{ fontSize:12, color:'#6b7280', marginTop:4 }}>{fmt(totalWithVAT)}</div>
              </div>
            </div>

            {/* FP 유형별 */}
            <div style={S.card}>
              <span style={S.sectionTitle}>FP 유형별 구성</span>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8, marginBottom:14 }}>
                {[['ILF','#22c55e'],['EIF','#f59e0b'],['EI','#3b82f6'],['EO','#8b5cf6'],['EQ','#ec4899']].map(([type,color])=>{
                  const cnt = fpList.filter(f=>f.fpType===type).length;
                  return (
                    <div key={type} style={{ textAlign:'center', padding:'10px 6px', background:'#f9fafb', borderRadius:8, borderTop:`2px solid ${color}` }}>
                      <div style={{ fontSize:18, fontWeight:800, color:'#111827' }}>{cnt}</div>
                      <div style={{ fontSize:10, color:'#6b7280', marginTop:2 }}>{type}</div>
                    </div>
                  );
                })}
              </div>

              {fpList.length > 0 && (
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                    <thead>
                      <tr style={{ background:'#f9fafb' }}>
                        {['LV3','유형','가중치','비고'].map(h=>(
                          <th key={h} style={{ padding:'6px 8px', textAlign:'left', fontSize:9, fontWeight:600, color:'#9ca3af', textTransform:'uppercase', borderBottom:'1px solid #e5e7eb' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {fpList.slice(0,20).map((fp,i)=>{
                        const typeColors = {ILF:{bg:'#dcfce7',c:'#166534'},EIF:{bg:'#fef9c3',c:'#854d0e'},EI:{bg:'#dbeafe',c:'#1e40af'},EO:{bg:'#ede9fe',c:'#5b21b6'},EQ:{bg:'#fce7f3',c:'#9d174d'}};
                        const tc = typeColors[fp.fpType]||{bg:'#f3f4f6',c:'#374151'};
                        return (
                          <tr key={i}>
                            <td style={{ padding:'6px 8px', borderBottom:'1px solid #f3f4f6', color:'#111827', fontWeight:500 }}>{fp.lv3}</td>
                            <td style={{ padding:'6px 8px', borderBottom:'1px solid #f3f4f6' }}>
                              <span style={{ background:tc.bg, color:tc.c, padding:'1px 5px', borderRadius:3, fontSize:10, fontWeight:700 }}>{fp.fpType}</span>
                            </td>
                            <td style={{ padding:'6px 8px', borderBottom:'1px solid #f3f4f6', fontWeight:700, color:'#374151', textAlign:'center' }}>{fp.weight||fp.simpWeight||'-'}</td>
                            <td style={{ padding:'6px 8px', borderBottom:'1px solid #f3f4f6', color:'#9ca3af' }}>{fp.reuseType||''}</td>
                          </tr>
                        );
                      })}
                      {fpList.length > 20 && (
                        <tr><td colSpan={4} style={{ padding:'8px', textAlign:'center', color:'#9ca3af', fontSize:11 }}>+ {fpList.length-20}개 더 있음 (Excel 출력으로 전체 확인)</td></tr>
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
