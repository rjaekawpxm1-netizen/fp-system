import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateExcel, generatePdf, downloadBase64File, aiAnalyzeDiagnosis } from '../utils/daApi';
import { color, button, card } from '../styles/tokens';

const { blue: BLUE, blueTint: BLUE_TINT, ink: INK, sub: SUB, mute: MUTE, line: LINE, bg: BG } = color;

const DIM_KEYWORDS = ['완전성', '일관성', '정확성', '유용성', '유일성', '유효성'];
const DIM_COLORS = {
  '완전성': '#3182F6', '일관성': '#0F8B47', '정확성': '#D97706',
  '유용성': '#CA8A04', '유일성': '#7C3AED', '유효성': '#E11D48',
};
const DIM_BG = {
  '완전성': '#EAF3FF', '일관성': '#E7F8EF', '정확성': '#FFF3D6',
  '유용성': '#FEF9C3', '유일성': '#F3EEFE', '유효성': '#FFEBEB',
};

const INPUT_STYLE = {
  height: 42, padding: '0 14px',
  background: BG, border: `1px solid ${LINE}`,
  borderRadius: 10, color: INK, fontSize: 13.5,
  fontWeight: 600, outline: 'none', width: '100%',
  boxSizing: 'border-box', fontFamily: "'Pretendard', system-ui, sans-serif",
  letterSpacing: '-0.01em',
};

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
  const scoreGrade = qualityScore >= 95 ? 'A+' : qualityScore >= 90 ? 'A' : qualityScore >= 80 ? 'B+' : qualityScore >= 70 ? 'B' : 'C';
  const scoreColor = qualityScore >= 90 ? '#0F8B47' : qualityScore >= 70 ? '#D97706' : '#E53935';

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
    <div style={{ width: '100%', minHeight: '100vh', background: BG, fontFamily: "'Pretendard', system-ui, sans-serif", color: INK, display: 'flex', flexDirection: 'column' }}>
      {/* ── Header ── */}
      <header style={{ height: 64, background: '#fff', borderBottom: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', padding: '0 24px', gap: 24, position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 15 }}>j</div>
          <span style={{ fontWeight: 800, fontSize: 16 }}>junsu</span>
        </div>
        <div style={{ marginLeft: 16, fontSize: 13, color: SUB, fontWeight: 600 }}>
          <span style={{ color: MUTE, cursor: 'pointer' }} onClick={() => navigate('/da')}>DA</span>
          <span style={{ color: MUTE, margin: '0 6px' }}>›</span>
          진단 결과
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => navigate('/da/setup')} style={{ height: 40, padding: '0 16px', borderRadius: 999, background: '#fff', color: SUB, border: `1px solid ${LINE}`, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>🔄 재진단</button>
          <button onClick={() => handleReport('excel')} disabled={!!reportLoading} style={{ height: 40, padding: '0 16px', borderRadius: 999, background: '#fff', color: SUB, border: `1px solid ${LINE}`, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: reportLoading ? 0.6 : 1 }}>↓ Excel 보고서</button>
          <button onClick={() => handleReport('pdf')} disabled={!!reportLoading} style={{ height: 40, padding: '0 16px', borderRadius: 999, background: BLUE, color: '#fff', border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer', opacity: reportLoading ? 0.6 : 1 }}>
            {reportLoading === 'pdf' ? '⏳ 생성 중...' : '📄 PDF 출력'}
          </button>
        </div>
      </header>

      <div style={{ flex: 1, overflow: 'auto', padding: '28px 32px 40px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          {/* Page title */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>진단 결과</h1>
              <p style={{ margin: '8px 0 0', fontSize: 14, color: SUB, fontWeight: 500 }}>
                {tableName || '테이블'} · {valid.length}개 진단 항목 · {new Date().toLocaleDateString('ko-KR')}
              </p>
            </div>
          </div>

          {/* KPI chips */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
            {[
              { label: '품질 점수', value: qualityScore + '점', color: scoreColor, big: true },
              { label: '총 진단 항목', value: valid.length + '개', color: INK },
              { label: '오류 발생 항목', value: errors.length + '개', color: errors.length > 0 ? '#E53935' : '#0F8B47' },
              { label: '총 점검 건수', value: totalCnt.toLocaleString() + '건', color: INK },
              { label: '총 오류 건수', value: totalErr.toLocaleString() + '건', color: totalErr > 0 ? '#E53935' : '#0F8B47' },
            ].map(k => (
              <div key={k.label} style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: k.big ? 26 : 20, fontWeight: 800, color: k.color, letterSpacing: '-0.025em' }}>{k.value}</div>
                <div style={{ fontSize: 11, color: MUTE, marginTop: 4, fontWeight: 600 }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Score + Areas */}
          <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 16, marginBottom: 16 }}>
            {/* Overall score card */}
            <section style={{ background: `linear-gradient(135deg, ${INK} 0%, #2A3340 100%)`, color: '#fff', borderRadius: 16, padding: '24px 28px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(49,130,246,0.15)' }} />
              <div style={{ position: 'relative' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.08em', marginBottom: 12 }}>종합 품질 점수</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 64, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }}>{qualityScore}</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>/ 100</span>
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 14px', borderRadius: 999, background: `${scoreColor}25`, color: scoreColor === '#0F8B47' ? '#5DE08A' : scoreColor === '#D97706' ? '#FBD96D' : '#FC8181', fontSize: 14, fontWeight: 800 }}>
                  등급 {scoreGrade}
                </div>
                {aiAnalysis && (
                  <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: 12.5, color: 'rgba(255,255,255,0.75)', fontWeight: 500, lineHeight: 1.75 }}>
                    💡 <strong style={{ color: '#fff' }}>AI 코멘트</strong><br />
                    {aiAnalysis.summary}
                  </div>
                )}
                {!aiAnalysis && (
                  <button onClick={handleAI} disabled={aiLoading} style={{ marginTop: 16, height: 36, padding: '0 16px', borderRadius: 999, background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', fontSize: 12, fontWeight: 700, cursor: aiLoading ? 'default' : 'pointer', opacity: aiLoading ? 0.6 : 1 }}>
                    {aiLoading ? '분석 중...' : '🤖 AI 분석 요청'}
                  </button>
                )}
              </div>
            </section>

            {/* 6-area grid */}
            <section style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 16, padding: '20px 24px' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: MUTE, letterSpacing: '0.08em', marginBottom: 16 }}>6대 품질 영역</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {dimStats.map(d => {
                  const score = Math.max(0, 100 - parseFloat(d.avgRate) * 5).toFixed(0);
                  const color = DIM_COLORS[d.dim];
                  const bg = DIM_BG[d.dim];
                  return (
                    <div key={d.dim} style={{ background: BG, borderRadius: 12, padding: '14px 16px', border: `1px solid ${LINE}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: INK }}>{d.dim}</span>
                        <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 6, background: bg, color }}>{d.grade}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
                        <span style={{ fontSize: 24, fontWeight: 800, color: INK, letterSpacing: '-0.025em' }}>{score}</span>
                        <span style={{ fontSize: 11, color: MUTE, fontWeight: 600 }}>/ 100</span>
                      </div>
                      <div style={{ height: 4, background: LINE, borderRadius: 999, marginBottom: 6 }}>
                        <div style={{ width: score + '%', height: '100%', background: color, borderRadius: 999 }} />
                      </div>
                      <div style={{ fontSize: 11, color: SUB, fontWeight: 500 }}>오류율 {d.avgRate}%</div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Area bar chart + Drill-down */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, padding: '20px 24px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800, letterSpacing: '-0.02em' }}>영역별 품질 현황</h3>
              {dimStats.map(d => (
                <div key={d.dim} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: DIM_COLORS[d.dim], flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: INK, minWidth: 48, fontWeight: 600 }}>{d.dim}</span>
                  <div style={{ flex: 1, background: LINE, borderRadius: 999, height: 7, overflow: 'hidden' }}>
                    <div style={{ width: Math.min(parseFloat(d.avgRate) * 5, 100) + '%', height: '100%', background: DIM_COLORS[d.dim], borderRadius: 999 }} />
                  </div>
                  <span style={{ fontSize: 11, color: MUTE, minWidth: 48, textAlign: 'right', fontWeight: 600 }}>{d.avgRate}%</span>
                  <span style={{ fontSize: 11, minWidth: 50 }}>{d.grade}</span>
                </div>
              ))}
            </div>

            <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, padding: '20px 24px' }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 800, letterSpacing: '-0.02em' }}>오류 항목 드릴다운</h3>
              {errors.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#0F8B47', fontSize: 14, fontWeight: 700 }}>🎉 오류가 없습니다!</div>
              ) : (
                <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {errors.map((r, i) => (
                    <button key={i} onClick={() => setSelectedDrill(selectedDrill === i ? null : i)}
                      style={{ textAlign: 'left', background: selectedDrill === i ? '#FFEBEB' : BG, border: `1px solid ${selectedDrill === i ? '#FCA5A5' : LINE}`, borderRadius: 10, padding: '8px 12px', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: INK, fontWeight: 600 }}>{r.rule_name} · {r.column}</span>
                        <span style={{ fontSize: 11, color: '#E53935', fontWeight: 800 }}>{r.error_cnt?.toLocaleString()}건</span>
                      </div>
                      <div style={{ fontSize: 10, color: MUTE, marginTop: 2, fontWeight: 500 }}>오류율 {r.error_rate?.toFixed(2)}%</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Drill-down detail */}
          {selectedDrill !== null && errorData[String(selectedDrill)]?.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #FCA5A5', borderRadius: 14, padding: '20px 24px', marginBottom: 16 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 800, color: '#E53935' }}>
                오류 데이터 원본 ({errorData[String(selectedDrill)].length}건)
              </h3>
              <div style={{ overflowX: 'auto', borderRadius: 10, border: `1px solid ${LINE}` }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: BG }}>
                      {Object.keys(errorData[String(selectedDrill)][0] || {}).map(k => (
                        <th key={k} style={{ padding: '8px 14px', color: SUB, textAlign: 'left', fontWeight: 700, whiteSpace: 'nowrap', borderBottom: `1px solid ${LINE}`, fontSize: 11, letterSpacing: '-0.01em' }}>{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {errorData[String(selectedDrill)].slice(0, 20).map((row, ri) => (
                      <tr key={ri} style={{ borderBottom: `1px solid ${LINE}` }}>
                        {Object.values(row).map((v, vi) => (
                          <td key={vi} style={{ padding: '8px 14px', color: INK, whiteSpace: 'nowrap' }}>{String(v ?? '')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* AI analysis */}
          {aiAnalysis && (
            <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, padding: '20px 24px', marginBottom: 16 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 800 }}>🤖 AI 진단 분석</h3>
              <p style={{ fontSize: 13, color: INK, lineHeight: 1.7, marginBottom: 12 }}>{aiAnalysis.summary}</p>
              {aiAnalysis.recommendations?.length > 0 && (
                <div>
                  <p style={{ fontSize: 12, color: SUB, fontWeight: 700, marginBottom: 8 }}>📌 권고사항</p>
                  {aiAnalysis.recommendations.map((r, i) => (
                    <div key={i} style={{ fontSize: 12, color: INK, padding: '6px 12px', borderLeft: `3px solid #7C3AED`, marginBottom: 6, background: '#F3EEFE', borderRadius: '0 8px 8px 0', lineHeight: 1.6 }}>{r}</div>
                  ))}
                </div>
              )}
              {aiAnalysis.report_comment && (
                <div style={{ marginTop: 12, background: '#F3EEFE', border: '1px solid #E0D4FB', borderRadius: 10, padding: '12px 14px', fontSize: 12, color: '#7C3AED', lineHeight: 1.7 }}>
                  <span style={{ fontWeight: 700 }}>📄 보고서 의견:</span> {aiAnalysis.report_comment}
                </div>
              )}
            </div>
          )}

          {/* Report form */}
          <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, padding: '20px 24px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>📄 보고서 출력</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: SUB, marginBottom: 6 }}>기관명 *</div>
                <input value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="예) 행정안전부" style={INPUT_STYLE} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: SUB, marginBottom: 6 }}>사업명 *</div>
                <input value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="예) 2025 공공데이터 품질진단" style={INPUT_STYLE} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => handleReport('excel')} disabled={!!reportLoading}
                style={{ flex: 1, height: 48, background: '#0F8B47', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: 'pointer', opacity: reportLoading ? 0.6 : 1 }}>
                {reportLoading === 'excel' ? '⏳ 생성 중...' : '📊 Excel 보고서'}
              </button>
              <button onClick={() => handleReport('pdf')} disabled={!!reportLoading}
                style={{ flex: 1, height: 48, background: BLUE, color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: 'pointer', opacity: reportLoading ? 0.6 : 1, boxShadow: '0 8px 20px rgba(49,130,246,0.25)' }}>
                {reportLoading === 'pdf' ? '⏳ 생성 중...' : '📋 PDF 보고서'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DAResult;
