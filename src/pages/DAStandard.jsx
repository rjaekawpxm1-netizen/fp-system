import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTables, getColumns, standardizeColumns, aiStandardize, getConnectStatus } from '../utils/daApi';
import { color, button, card } from '../styles/tokens';

const { blue: BLUE, blueTint: BLUE_TINT, ink: INK, sub: SUB, mute: MUTE, line: LINE, bg: BG } = color;

const CONF_COLOR = { high: '#0F8B47', medium: '#B26A00', low: '#E53935' };
const CONF_BG    = { high: '#E7F8EF', medium: '#FFF3D6', low: '#FFEBEB' };
const CONF_LABEL = { high: '높음', medium: '보통', low: '낮음' };

const DAStandard = () => {
  const navigate = useNavigate();
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [ruleResults, setRuleResults] = useState(null);
  const [aiResults, setAiResults] = useState(null);
  const [mode, setMode] = useState('rule');
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    getConnectStatus().then(r => {
      setConnected(r.connected);
      if (!r.connected) return;
      getTables().then(r2 => setTables(r2.tables || []));
    });
  }, []);

  const handleLoadColumns = async () => {
    if (!selectedTable) return;
    setLoading(true);
    setRuleResults(null);
    setAiResults(null);
    try {
      const r = await getColumns(selectedTable);
      setColumns(r.columns || []);
    } catch (e) {
      alert('컬럼 로드 실패: ' + e.message);
    } finally { setLoading(false); }
  };

  const handleRuleStandardize = async () => {
    if (!columns.length) return;
    setLoading(true);
    try {
      const res = await standardizeColumns(columns);
      setRuleResults(res.results || {});
      setMode('rule');
    } catch (e) {
      alert('표준화 실패: ' + e.message);
    } finally { setLoading(false); }
  };

  const handleAiStandardize = async () => {
    if (!columns.length) return;
    setAiLoading(true);
    try {
      const res = await aiStandardize(selectedTable, columns);
      setAiResults(res);
      setMode('ai');
    } catch (e) {
      alert('AI 표준화 실패: ' + e.message);
    } finally { setAiLoading(false); }
  };

  const exportExcel = () => {
    const data = mode === 'ai'
      ? (aiResults?.columns || []).map(c => ({
          '원래 컬럼명': c.original,
          '표준 한글용어': c.recommended_kr || '',
          '표준 영문약어': c.recommended_en || '',
          '도메인': c.domain || '',
          '권장 데이터타입': c.data_type || '',
          '신뢰도': CONF_LABEL[c.confidence] || '',
          '추천 근거': c.reason || '',
          '문제점': c.issues || '',
        }))
      : columns.map(col => {
          const r = ruleResults?.[col] || {};
          return {
            '원래 컬럼명': col,
            '표준 영문약어': r.recommended || '',
            '도메인': r.domain || '',
            '권장 데이터타입': r.data_type || '',
            '신뢰도': CONF_LABEL[r.confidence] || '',
          };
        });
    const headers = Object.keys(data[0] || {});
    const rows = [headers, ...data.map(r => headers.map(h => r[h] || ''))];
    const csvContent = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTable}_표준화추천.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generateDDL = () => {
    if (!aiResults?.columns) return;
    const lines = [`-- ${selectedTable} 표준화 적용 DDL`, `-- 생성일: ${new Date().toLocaleDateString('ko-KR')}`, ''];
    const alterLines = aiResults.columns
      .filter(c => c.recommended_en && c.recommended_en !== c.original?.toUpperCase())
      .map(c => `ALTER TABLE ${selectedTable} RENAME COLUMN ${c.original} TO ${c.recommended_en};`);
    if (alterLines.length > 0) {
      lines.push('-- 컬럼명 표준화');
      lines.push(...alterLines);
      lines.push('');
    }
    lines.push(`-- 표준화 적용 후 테이블 구조`);
    lines.push(`CREATE TABLE ${selectedTable} (`);
    const colLines = aiResults.columns.map((c, i) => {
      const colName = c.recommended_en || c.original?.toUpperCase();
      const dataType = c.data_type || 'VARCHAR2(200)';
      const comma = i < aiResults.columns.length - 1 ? ',' : '';
      return `    ${colName.padEnd(30)} ${dataType}${comma}`;
    });
    lines.push(...colLines);
    lines.push(');');
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTable}_표준화.sql`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasResults = (mode === 'rule' && ruleResults) || (mode === 'ai' && aiResults);
  const displayColumns = mode === 'ai'
    ? (aiResults?.columns || [])
    : columns.map(col => ({ original: col, ...ruleResults?.[col] }));

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
          AI 표준화 추천
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {hasResults && (
            <>
              <button onClick={exportExcel} style={{ height: 40, padding: '0 16px', borderRadius: 999, background: '#0F8B47', color: '#fff', border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>↓ CSV</button>
              {mode === 'ai' && aiResults?.columns && (
                <button onClick={generateDDL} style={{ height: 40, padding: '0 16px', borderRadius: 999, background: BLUE, color: '#fff', border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>📝 DDL 생성</button>
              )}
            </>
          )}
        </div>
      </header>

      <div style={{ flex: 1, overflow: 'auto', padding: '28px 32px 40px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <h1 style={{ margin: '0 0 6px', fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em' }}>🤖 AI 표준화 추천</h1>
          <p style={{ margin: '0 0 20px', fontSize: 14, color: SUB, fontWeight: 500, lineHeight: 1.6 }}>
            행정안전부 공통표준용어 13,177개 기반 · 한글용어 + 영문약어 + 도메인 자동 추천
          </p>

          {/* DB 미연결 안내 */}
          {!connected && (
            <div style={{ background: '#FFF3D6', border: '1px solid #FDE68A', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
              <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: '#92400E' }}>⚠️ DB가 연결되지 않았습니다</p>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: '#78350F' }}>DB 연결 없이도 컬럼명을 직접 입력하여 표준화 추천을 받을 수 있습니다.</p>
              <button onClick={() => navigate('/da/connect')} style={{ height: 38, padding: '0 16px', borderRadius: 999, background: '#D97706', color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                🔌 DB 연결하기
              </button>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 16 }}>
            {/* ── Left: input ── */}
            <aside style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Table selector */}
              {connected && (
                <section style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, padding: '18px 20px' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: MUTE, letterSpacing: '0.08em', marginBottom: 12 }}>테이블 선택</div>
                  <select
                    value={selectedTable}
                    onChange={e => setSelectedTable(e.target.value)}
                    style={{ width: '100%', height: 42, padding: '0 14px', background: BG, border: `1px solid ${LINE}`, borderRadius: 10, color: INK, fontSize: 13, fontWeight: 700, outline: 'none', fontFamily: "'Pretendard', system-ui, sans-serif", marginBottom: 8 }}
                  >
                    <option value="">테이블 선택...</option>
                    {tables.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <button
                    onClick={handleLoadColumns}
                    disabled={!selectedTable || loading}
                    style={{ width: '100%', height: 38, borderRadius: 10, background: selectedTable ? INK : LINE, color: selectedTable ? '#fff' : MUTE, border: 'none', fontSize: 13, fontWeight: 700, cursor: selectedTable ? 'pointer' : 'default' }}
                  >
                    {loading ? '⏳ 로딩 중...' : '컬럼 불러오기'}
                  </button>
                  {columns.length > 0 && <div style={{ marginTop: 6, fontSize: 11, color: MUTE, fontWeight: 600 }}>{columns.length}개 컬럼 로드됨</div>}
                </section>
              )}

              {/* Direct input */}
              <section style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, padding: '18px 20px' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: MUTE, letterSpacing: '0.08em', marginBottom: 12 }}>또는 직접 입력</div>
                <p style={{ fontSize: 11, color: MUTE, marginBottom: 8, fontWeight: 500 }}>한 줄에 하나씩 입력 (한글/영문 모두 가능)</p>
                <textarea
                  placeholder={'기관명\n등록일자\n사용여부\nINST_CD\nREG_DT\nUSE_YN'}
                  rows={8}
                  onChange={e => {
                    const cols = e.target.value.split('\n').map(c => c.trim()).filter(c => c);
                    setColumns(cols);
                    setRuleResults(null);
                    setAiResults(null);
                  }}
                  style={{ width: '100%', padding: '10px 14px', background: BG, border: `1px solid ${LINE}`, borderRadius: 10, color: INK, fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'SF Mono, monospace', boxSizing: 'border-box', lineHeight: 1.7 }}
                />
                <div style={{ marginTop: 6, fontSize: 11, color: MUTE, fontWeight: 600 }}>
                  {columns.length > 0 ? `✓ ${columns.length}개 컬럼 입력됨` : '컬럼명을 입력하세요'}
                </div>
              </section>

              {/* Action buttons */}
              {columns.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button onClick={handleAiStandardize} disabled={aiLoading}
                    style={{ height: 48, borderRadius: 12, background: BLUE, color: '#fff', border: 'none', fontSize: 14, fontWeight: 800, cursor: aiLoading ? 'default' : 'pointer', boxShadow: aiLoading ? 'none' : '0 8px 20px rgba(49,130,246,0.28)', opacity: aiLoading ? 0.6 : 1 }}>
                    {aiLoading ? '⏳ AI 분석 중...' : '🤖 AI 표준화 분석 시작'}
                  </button>
                  <button onClick={handleRuleStandardize} disabled={loading}
                    style={{ height: 40, borderRadius: 10, background: '#fff', color: SUB, border: `1px solid ${LINE}`, fontSize: 12, fontWeight: 700, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1 }}>
                    {loading ? '⏳ 분석 중...' : '⚡ 빠른 규칙 기반'}
                  </button>
                  <p style={{ fontSize: 11, color: MUTE, textAlign: 'center', margin: 0, fontWeight: 500 }}>규칙 기반: 즉시 · AI: 5~15초 소요</p>
                </div>
              )}

              {/* Hint */}
              <div style={{ background: '#FFF3D6', borderRadius: 12, padding: '12px 14px', fontSize: 11.5, color: '#7A5C00', fontWeight: 600, lineHeight: 1.6 }}>
                💡 <strong>주요 형식단어:</strong><br />
                코드→CD · 번호→NO · 명칭→NM · 일자→DT<br />
                금액→AMT · 여부→YN · 건수→CNT · 순번→SEQ
              </div>
            </aside>

            {/* ── Right: results ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* AI summary */}
              {mode === 'ai' && aiResults?.overall_assessment && (
                <div style={{ background: '#F3EEFE', border: '1px solid #E0D4FB', borderRadius: 14, padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 18 }}>📊</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#5B21B6' }}>AI 종합 평가</span>
                  </div>
                  <p style={{ margin: '0 0 8px', fontSize: 13, color: '#5B21B6', fontWeight: 500, lineHeight: 1.7 }}>{aiResults.overall_assessment}</p>
                  {aiResults.table_name_suggestion && (
                    <div style={{ fontSize: 12, color: '#5B21B6', fontWeight: 600 }}>
                      💡 테이블명 제안: <span style={{ background: '#fff', padding: '2px 10px', borderRadius: 6, fontFamily: 'SF Mono, monospace', fontWeight: 800 }}>{aiResults.table_name_suggestion}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Confidence distribution */}
              {hasResults && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: INK }}>
                    {mode === 'ai' ? '🤖 AI 표준화 결과' : '⚡ 규칙 기반 결과'} · {columns.length}개 컬럼
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {['high', 'medium', 'low'].map(conf => {
                      const cnt = mode === 'ai'
                        ? (aiResults?.columns || []).filter(c => c.confidence === conf).length
                        : columns.filter(col => ruleResults?.[col]?.confidence === conf).length;
                      if (!cnt) return null;
                      return (
                        <span key={conf} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, background: CONF_BG[conf], color: CONF_COLOR[conf], fontWeight: 700 }}>
                          {CONF_LABEL[conf]} {cnt}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {!hasResults && (
                <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, padding: '60px 40px', textAlign: 'center' }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>🔤</div>
                  <p style={{ fontSize: 15, color: INK, fontWeight: 700, marginBottom: 8 }}>컬럼명을 입력하고 표준화를 실행하세요</p>
                  <p style={{ fontSize: 13, color: MUTE, lineHeight: 1.6 }}>공통표준용어 13,177개 기반으로<br />영문약어명 자동 추천 · 도메인 분류 · 데이터타입 권장</p>
                </div>
              )}

              {/* Result cards */}
              {hasResults && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {mode === 'rule' && columns.map(col => {
                    const r = ruleResults?.[col] || {};
                    const conf = r.confidence || 'low';
                    return (
                      <div key={col} style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <span style={{ minWidth: 120, fontSize: 13, color: SUB, fontWeight: 700, fontFamily: 'SF Mono, monospace' }}>{col}</span>
                          <span style={{ color: MUTE, fontSize: 16 }}>→</span>
                          <span style={{ fontSize: 13, fontWeight: 800, color: INK, background: BG, padding: '3px 10px', borderRadius: 6, border: `1px solid ${LINE}`, fontFamily: 'SF Mono, monospace' }}>
                            {r.recommended || col.toUpperCase()}
                          </span>
                          {r.domain && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: BLUE_TINT, color: BLUE, fontWeight: 700 }}>{r.domain}</span>}
                          {r.data_type && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#E7F8EF', color: '#0F8B47', fontWeight: 700, fontFamily: 'SF Mono, monospace' }}>{r.data_type}</span>}
                          <span style={{ marginLeft: 'auto', fontSize: 11, padding: '3px 10px', borderRadius: 999, background: CONF_BG[conf], color: CONF_COLOR[conf], fontWeight: 800 }}>
                            신뢰도 {CONF_LABEL[conf]}
                          </span>
                        </div>
                        {r.example && <p style={{ margin: '6px 0 0', fontSize: 11, color: MUTE }}>예시: {r.example}</p>}
                      </div>
                    );
                  })}

                  {mode === 'ai' && (aiResults?.columns || []).map((c, i) => {
                    const conf = c.confidence || 'low';
                    return (
                      <div key={i} style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: c.reason ? 10 : 0 }}>
                          <span style={{ minWidth: 120, fontSize: 13, color: SUB, fontWeight: 700, fontFamily: 'SF Mono, monospace' }}>{c.original}</span>
                          <span style={{ color: MUTE, fontSize: 16 }}>→</span>
                          {c.recommended_kr && <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 6, background: '#F3EEFE', color: '#7C3AED', fontWeight: 700 }}>{c.recommended_kr}</span>}
                          {c.recommended_en && <span style={{ fontSize: 13, padding: '3px 10px', borderRadius: 6, background: BG, color: INK, fontWeight: 800, fontFamily: 'SF Mono, monospace', border: `1px solid ${LINE}` }}>{c.recommended_en}</span>}
                          {c.domain && <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 6, background: BLUE_TINT, color: BLUE, fontWeight: 700 }}>{c.domain}</span>}
                          {c.data_type && <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 6, background: '#E7F8EF', color: '#0F8B47', fontWeight: 700, fontFamily: 'SF Mono, monospace' }}>{c.data_type}</span>}
                          <span style={{ marginLeft: 'auto', fontSize: 11, padding: '3px 10px', borderRadius: 999, background: CONF_BG[conf], color: CONF_COLOR[conf], fontWeight: 800 }}>
                            신뢰도 {CONF_LABEL[conf]}
                          </span>
                        </div>
                        {c.reason && (
                          <div style={{ fontSize: 12, color: SUB, fontWeight: 500, lineHeight: 1.55, paddingTop: 8, borderTop: `1px solid ${LINE}` }}>
                            📌 {c.reason}
                          </div>
                        )}
                        {c.issues && (
                          <div style={{ marginTop: 6, fontSize: 11.5, color: '#E53935', fontWeight: 600 }}>⚠️ {c.issues}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DAStandard;
