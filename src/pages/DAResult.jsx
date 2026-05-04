import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateExcel, generatePdf, downloadBase64File, aiAnalyzeDiagnosis } from '../utils/daApi';

const DIM_KEYWORDS = ['완전성', '일관성', '정확성', '유용성', '유일성', '유효성'];
const DIM_COLORS = {
  '완전성': '#3b82f6', '일관성': '#10b981', '정확성': '#f59e0b',
  '유용성': '#eab308', '유일성': '#8b5cf6', '유효성': '#ef4444',
};

const DAResult = () => {
  const navigate = useNavigate();
  const [results, setResults] = useState([]);
  const [errorData, setErrorData] = useState({});
  const [tableName, setTableName] = useState('');
  const [selectedDrilldown, setSelectedDrilldown] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState('');
  const [orgName, setOrgName] = useState('');
  const [projectName, setProjectName] = useState('');

  useEffect(() => {
    const raw = localStorage.getItem('da-diag-results');
    const tbl = localStorage.getItem('da-diag-table');
    if (raw) {
      const parsed = JSON.parse(raw);
      setResults(parsed.results || []);
      setErrorData(parsed.error_data || {});
    }
    if (tbl) setTableName(tbl);
  }, []);

  const valid = results.filter(r => r.total_cnt >= 0);
  const errors = valid.filter(r => r.error_cnt > 0);
  const totalCnt = valid.reduce((s, r) => s + r.total_cnt, 0);
  const totalErr = valid.reduce((s, r) => s + r.error_cnt, 0);
  const overallRate = totalCnt > 0 ? (totalErr / totalCnt * 100).toFixed(2) : '0.00';
  const qualityScore = (100 - parseFloat(overallRate)).toFixed(1);

  // 영역별 집계
  const dimStats = DIM_KEYWORDS.map(dim => {
    const sub = valid.filter(r => r.rule_name?.includes(dim));
    const errSub = sub.filter(r => r.error_cnt > 0);
    const avgRate = sub.length > 0 ? sub.reduce((s, r) => s + r.error_rate, 0) / sub.length : 0;
    const grade = avgRate === 0 ? '🟢 양호' : avgRate < 10 ? '🟡 주의' : '🔴 위험';
    return { dim, count: sub.length, errCount: errSub.length, totalErr: sub.reduce((s, r) => s + r.error_cnt, 0), avgRate: avgRate.toFixed(2), grade };
  });

  const handleAiAnalyze = async () => {
    setAiLoading(true);
    try {
      const res = await aiAnalyzeDiagnosis(tableName, results);
      setAiAnalysis(res);
    } catch (e) {
      alert('AI 분석 실패: ' + e.message);
    } finally {
      setAiLoading(false);
    }
  };

  const handleReport = async (type) => {
    if (!orgName || !projectName) { alert('기관명과 사업명을 입력하세요'); return; }
    setReportLoading(type);
    try {
      const projectInfo = { org_name: orgName, project_name: projectName, table_name: tableName };
      if (type === 'excel') {
        const res = await generateExcel(projectInfo, results);
        downloadBase64File(res.file_base64, res.filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      } else {
        const res = await generatePdf(projectInfo, results);
        downloadBase64File(res.file_base64, res.filename, 'application/pdf');
      }
    } catch (e) {
      alert('보고서 생성 실패: ' + e.message);
    } finally {
      setReportLoading('');
    }
  };

  const scoreColor = qualityScore >= 90 ? '#10b981' : qualityScore >= 70 ? '#f59e0b' : '#ef4444';

  const INPUT = { padding: '9px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f1f5f9', fontSize: 13, outline: 'none', fontFamily: 'inherit' };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0f1e', fontFamily: "'Apple SD Gothic Neo','Noto Sans KR',sans-serif", padding: '32px 24px' }}>
      <div style={{ maxWidth: 1060, margin: '0 auto' }}>

        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => navigate('/da')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 18 }}>←</button>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#f1f5f9' }}>📈 진단 결과 분석</h2>
              <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>테이블: {tableName}</p>
            </div>
          </div>
          <button onClick={() => navigate('/da/setup')} style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 14px', fontSize: 12, cursor: 'pointer' }}>
            🔄 재진단
          </button>
        </div>

        {/* KPI 카드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: '품질 점수', value: qualityScore + '점', color: scoreColor, big: true },
            { label: '총 진단 항목', value: valid.length + '개', color: '#94a3b8' },
            { label: '오류 발생 항목', value: errors.length + '개', color: errors.length > 0 ? '#ef4444' : '#10b981' },
            { label: '총 점검 건수', value: totalCnt.toLocaleString() + '건', color: '#94a3b8' },
            { label: '총 오류 건수', value: totalErr.toLocaleString() + '건', color: totalErr > 0 ? '#ef4444' : '#10b981' },
          ].map(k => (
            <div key={k.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: k.big ? 24 : 18, fontWeight: 800, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{k.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

          {/* 영역별 현황 */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>📊 영역별 품질 현황</h3>
            {dimStats.map(d => (
              <div key={d.dim} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: DIM_COLORS[d.dim], flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: '#e2e8f0', minWidth: 50 }}>{d.dim}</span>
                <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 20, height: 6, overflow: 'hidden' }}>
                  <div style={{ width: Math.min(parseFloat(d.avgRate) * 5, 100) + '%', height: '100%', background: DIM_COLORS[d.dim], borderRadius: 20 }} />
                </div>
                <span style={{ fontSize: 11, color: '#64748b', minWidth: 50, textAlign: 'right' }}>{d.avgRate}%</span>
                <span style={{ fontSize: 11, minWidth: 45 }}>{d.grade}</span>
              </div>
            ))}
          </div>

          {/* 오류 발생 항목 */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>🔍 드릴다운 (오류 원본 추적)</h3>
            {errors.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#10b981', fontSize: 13 }}>🎉 오류가 없습니다!</div>
            ) : (
              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                {errors.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedDrilldown(selectedDrilldown === i ? null : i)}
                    style={{ width: '100%', textAlign: 'left', background: selectedDrilldown === i ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.02)', border: '1px solid ' + (selectedDrilldown === i ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.06)'), borderRadius: 8, padding: '8px 12px', cursor: 'pointer', marginBottom: 6 }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: '#f1f5f9', fontWeight: 500 }}>{r.rule_name} · {r.column}</span>
                      <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 700 }}>{r.error_cnt.toLocaleString()}건</span>
                    </div>
                    <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>오류율 {r.error_rate?.toFixed(2)}%</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 드릴다운 상세 */}
        {selectedDrilldown !== null && errorData[String(selectedDrilldown)] && (
          <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#fca5a5' }}>
              🔎 오류 데이터 원본 ({errorData[String(selectedDrilldown)].length}건)
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                    {Object.keys(errorData[String(selectedDrilldown)][0] || {}).map(k => (
                      <th key={k} style={{ padding: '8px 10px', color: '#94a3b8', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {errorData[String(selectedDrilldown)].slice(0, 20).map((row, ri) => (
                    <tr key={ri} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                      {Object.values(row).map((v, vi) => (
                        <td key={vi} style={{ padding: '7px 10px', color: '#e2e8f0', whiteSpace: 'nowrap' }}>{String(v ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* AI 분석 */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>🤖 AI 진단 분석</h3>
            <button onClick={handleAiAnalyze} disabled={aiLoading} style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: aiLoading ? 0.6 : 1 }}>
              {aiLoading ? '분석 중...' : 'AI 분석 요청'}
            </button>
          </div>
          {aiAnalysis ? (
            <div>
              <p style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.7, marginBottom: 12 }}>{aiAnalysis.summary}</p>
              {aiAnalysis.recommendations?.length > 0 && (
                <div>
                  <p style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, marginBottom: 8 }}>📌 권고사항</p>
                  {aiAnalysis.recommendations.map((r, i) => (
                    <div key={i} style={{ fontSize: 12, color: '#cbd5e1', padding: '4px 0', paddingLeft: 12, borderLeft: '2px solid #7c3aed', marginBottom: 6 }}>{r}</div>
                  ))}
                </div>
              )}
              {aiAnalysis.report_comment && (
                <div style={{ marginTop: 12, background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 8, padding: '12px 14px', fontSize: 12, color: '#c4b5fd', lineHeight: 1.7 }}>
                  <span style={{ fontWeight: 700 }}>📄 보고서 의견:</span> {aiAnalysis.report_comment}
                </div>
              )}
            </div>
          ) : (
            <p style={{ color: '#475569', fontSize: 13 }}>AI 분석 요청 버튼을 클릭하면 Claude AI가 진단 결과를 분석하고 개선 방안을 제시합니다.</p>
          )}
        </div>

        {/* 보고서 출력 */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>📄 보고서 출력</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 6 }}>기관명 *</label>
              <input value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="예) 행정안전부" style={{ ...INPUT, width: '100%', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 6 }}>사업명 *</label>
              <input value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="예) 2025 공공데이터 품질진단" style={{ ...INPUT, width: '100%', boxSizing: 'border-box' }} />
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
