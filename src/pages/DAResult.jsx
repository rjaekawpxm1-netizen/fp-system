import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateExcel, generatePdf, downloadBase64File, aiAnalyzeDiagnosis } from '../utils/daApi';

const DIM_KEYWORDS = ['완전성', '일관성', '정확성', '유용성', '유일성', '유효성'];
const DIM_COLORS = { '완전성': '#2563eb', '일관성': '#059669', '정확성': '#d97706', '유용성': '#ca8a04', '유일성': '#7c3aed', '유효성': '#dc2626' };
const DIM_BG = { '완전성': '#eff6ff', '일관성': '#f0fdf4', '정확성': '#fffbeb', '유용성': '#fefce8', '유일성': '#faf5ff', '유효성': '#fef2f2' };

const INPUT = { padding: '9px 12px', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 8, color: '#1e293b', fontSize: 13, outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' };

const DAResult = () => {
  const navigate = useNavigate();
  const [results, setResults] = useState([]);
  const [errorData, setErrorData] = useState({});
  const [tableName, setTableName] = useState('');
  const [selectedDrill, setSelectedDrill] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState('');
  const [orgName, setOrgName] = useState('');
  const [projectName, setProjectName] = useState('');

  useEffect(() => {
    const raw = localStorage.getItem('da-diag-results');
    const tbl = localStorage.getItem('da-diag-table');
    if (raw) { const p = JSON.parse(raw); setResults(p.results || []); setErrorData(p.error_data || {}); }
    if (tbl) setTableName(tbl);
  }, []);

  const valid = results.filter(r => r.total_cnt >= 0);
  const errors = valid.filter(r => r.error_cnt > 0);
  const totalCnt = valid.reduce((s, r) => s + r.total_cnt, 0);
  const totalErr = valid.reduce((s, r) => s + r.error_cnt, 0);
  const overallRate = totalCnt > 0 ? (totalErr / totalCnt * 100).toFixed(2) : '0.00';
  const qualityScore = (100 - parseFloat(overallRate)).toFixed(1);
  const scoreColor = qualityScore >= 90 ? '#059669' : qualityScore >= 70 ? '#d97706' : '#dc2626';
  const scoreBg = qualityScore >= 90 ? '#f0fdf4' : qualityScore >= 70 ? '#fffbeb' : '#fef2f2';

  const dimStats = DIM_KEYWORDS.map(dim => {
    const sub = valid.filter(r => r.rule_name?.includes(dim));
    const avgRate = sub.length > 0 ? sub.reduce((s, r) => s + (r.error_rate || 0), 0) / sub.length : 0;
    const grade = avgRate === 0 ? '🟢 양호' : avgRate < 10 ? '🟡 주의' : '🔴 위험';
    return { dim, count: sub.length, errCount: sub.filter(r => r.error_cnt > 0).length, totalErr: sub.reduce((s, r) => s + r.error_cnt, 0), avgRate: avgRate.toFixed(2), grade };
  });

  const handleAI = async () => {
    setAiLoading(true);
    try { setAiAnalysis(await aiAnalyzeDiagnosis(tableName, results)); }
    catch (e) { alert('AI 분석 실패: ' + e.message); }
    finally { setAiLoading(false); }
  };

  const handleReport = async (type) => {
    if (!orgName || !projectName) { alert('기관명과 사업명을 입력하세요'); return; }
    setReportLoading(type);
    try {
      const pi = { org_name: orgName, project_name: projectName, table_name: tableName };
      if (type === 'excel') {
        const r = await generateExcel(pi, results);
        downloadBase64File(r.file_base64, r.filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      } else {
        const r = await generatePdf(pi, results);
        downloadBase64File(r.file_base64, r.filename, 'application/pdf');
      }
    } catch (e) { alert('보고서 생성 실패: ' + e.message); }
    finally { setReportLoading(''); }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', fontFamily: "'Apple SD Gothic Neo','Noto Sans KR',sans-serif", padding: '32px 24px' }}>
      <div style={{ maxWidth: 1060, margin: '0 auto' }}>

        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => navigate('/da')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 20 }}>←</button>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e293b' }}>📈 진단 결과 분석</h2>
              <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>테이블: {tableName}</p>
            </div>
          </div>
          <button onClick={() => navigate('/da/setup')} style={{ background: '#fff', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            🔄 재진단
          </button>
        </div>

        {/* KPI */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: '품질 점수', value: qualityScore + '점', color: scoreColor, bg: scoreBg, big: true },
            { label: '총 진단 항목', value: valid.length + '개', color: '#374151', bg: '#f8fafc' },
            { label: '오류 발생 항목', value: errors.length + '개', color: errors.length > 0 ? '#dc2626' : '#059669', bg: errors.length > 0 ? '#fef2f2' : '#f0fdf4' },
            { label: '총 점검 건수', value: totalCnt.toLocaleString() + '건', color: '#374151', bg: '#f8fafc' },
            { label: '총 오류 건수', value: totalErr.toLocaleString() + '건', color: totalErr > 0 ? '#dc2626' : '#059669', bg: totalErr > 0 ? '#fef2f2' : '#f0fdf4' },
          ].map(k => (
            <div key={k.label} style={{ background: k.bg, border: `1px solid ${k.color}20`, borderRadius: 10, padding: '14px 16px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: k.big ? 24 : 18, fontWeight: 800, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{k.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          {/* 영역별 현황 */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: '#1e293b' }}>📊 영역별 품질 현황</h3>
            {dimStats.map(d => (
              <div key={d.dim} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: DIM_COLORS[d.dim], flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: '#374151', minWidth: 48, fontWeight: 500 }}>{d.dim}</span>
                <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 20, height: 7, overflow: 'hidden' }}>
                  <div style={{ width: Math.min(parseFloat(d.avgRate) * 5, 100) + '%', height: '100%', background: DIM_COLORS[d.dim], borderRadius: 20 }} />
                </div>
                <span style={{ fontSize: 11, color: '#64748b', minWidth: 48, textAlign: 'right' }}>{d.avgRate}%</span>
                <span style={{ fontSize: 11, minWidth: 50 }}>{d.grade}</span>
              </div>
            ))}
          </div>

          {/* 드릴다운 */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: '#1e293b' }}>🔍 오류 항목 드릴다운</h3>
            {errors.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: '#059669', fontSize: 14, fontWeight: 600 }}>🎉 오류가 없습니다!</div>
            ) : (
              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                {errors.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedDrill(selectedDrill === i ? null : i)}
                    style={{ width: '100%', textAlign: 'left', background: selectedDrill === i ? '#fef2f2' : '#f8fafc', border: `1px solid ${selectedDrill === i ? '#fca5a5' : '#e2e8f0'}`, borderRadius: 8, padding: '8px 12px', cursor: 'pointer', marginBottom: 6 }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: '#1e293b', fontWeight: 500 }}>{r.rule_name} · {r.column}</span>
                      <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 700 }}>{r.error_cnt?.toLocaleString()}건</span>
                    </div>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>오류율 {r.error_rate?.toFixed(2)}%</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 드릴다운 상세 */}
        {selectedDrill !== null && errorData[String(selectedDrill)]?.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #fca5a5', borderRadius: 12, padding: 20, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#dc2626' }}>
              🔎 오류 데이터 원본 ({errorData[String(selectedDrill)].length}건)
            </h3>
            <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {Object.keys(errorData[String(selectedDrill)][0] || {}).map(k => (
                      <th key={k} style={{ padding: '8px 12px', color: '#475569', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '1px solid #e2e8f0' }}>{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {errorData[String(selectedDrill)].slice(0, 20).map((row, ri) => (
                    <tr key={ri} style={{ borderBottom: '1px solid #f8fafc' }}>
                      {Object.values(row).map((v, vi) => (
                        <td key={vi} style={{ padding: '7px 12px', color: '#374151', whiteSpace: 'nowrap' }}>{String(v ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* AI 분석 */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1e293b' }}>🤖 AI 진단 분석</h3>
            <button onClick={handleAI} disabled={aiLoading} style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: aiLoading ? 0.6 : 1 }}>
              {aiLoading ? '분석 중...' : 'AI 분석 요청'}
            </button>
          </div>
          {aiAnalysis ? (
            <div>
              <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, marginBottom: 12 }}>{aiAnalysis.summary}</p>
              {aiAnalysis.recommendations?.length > 0 && (
                <div>
                  <p style={{ fontSize: 12, color: '#475569', fontWeight: 600, marginBottom: 8 }}>📌 권고사항</p>
                  {aiAnalysis.recommendations.map((r, i) => (
                    <div key={i} style={{ fontSize: 12, color: '#374151', padding: '5px 12px', borderLeft: '3px solid #7c3aed', marginBottom: 6, background: '#faf5ff', borderRadius: '0 6px 6px 0' }}>{r}</div>
                  ))}
                </div>
              )}
              {aiAnalysis.report_comment && (
                <div style={{ marginTop: 12, background: '#faf5ff', border: '1px solid #d8b4fe', borderRadius: 8, padding: '12px 14px', fontSize: 12, color: '#7c3aed', lineHeight: 1.7 }}>
                  <span style={{ fontWeight: 700 }}>📄 보고서 의견:</span> {aiAnalysis.report_comment}
                </div>
              )}
            </div>
          ) : (
            <p style={{ color: '#94a3b8', fontSize: 13 }}>AI 분석 요청 버튼을 클릭하면 Claude AI가 진단 결과를 분석하고 개선 방안을 제시합니다.</p>
          )}
        </div>

        {/* 보고서 출력 */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: '#1e293b' }}>📄 보고서 출력</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 11, color: '#475569', display: 'block', marginBottom: 6, fontWeight: 600 }}>기관명 *</label>
              <input value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="예) 행정안전부" style={INPUT} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#475569', display: 'block', marginBottom: 6, fontWeight: 600 }}>사업명 *</label>
              <input value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="예) 2025 공공데이터 품질진단" style={INPUT} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => handleReport('excel')} disabled={!!reportLoading} style={{ flex: 1, padding: '12px', background: '#059669', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: reportLoading ? 0.6 : 1 }}>
              {reportLoading === 'excel' ? '⏳ 생성 중...' : '📊 Excel 보고서'}
            </button>
            <button onClick={() => handleReport('pdf')} disabled={!!reportLoading} style={{ flex: 1, padding: '12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: reportLoading ? 0.6 : 1 }}>
              {reportLoading === 'pdf' ? '⏳ 생성 중...' : '📋 PDF 보고서'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DAResult;
