import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTables, getColumns, standardizeColumns, aiStandardize, getConnectStatus } from '../utils/daApi';

const CONF_COLOR = { high: '#059669', medium: '#d97706', low: '#dc2626' };
const CONF_BG = { high: '#f0fdf4', medium: '#fffbeb', low: '#fef2f2' };
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
  const [mode, setMode] = useState('rule'); // rule | ai
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
    } finally {
      setLoading(false);
    }
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
    } finally {
      setLoading(false);
    }
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
    } finally {
      setAiLoading(false);
    }
  };

  // Excel 다운로드
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
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTable}_표준화추천.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // DDL 생성
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

    // CREATE TABLE DDL
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
    <div style={{ minHeight: '100vh', background: '#f0f2f5', fontFamily: "'Apple SD Gothic Neo','Noto Sans KR',sans-serif", padding: '32px 24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button onClick={() => navigate('/da')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 20 }}>←</button>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e293b' }}>🤖 AI 표준화 추천</h2>
            <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
              행정안전부 공공데이터베이스 표준화 관리 매뉴얼 2026 · 공통표준용어 13,177개 기반
            </p>
          </div>
        </div>

        {/* DB 미연결 안내 */}
        {!connected && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
            <p style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 600, color: '#92400e' }}>⚠️ DB가 연결되지 않았습니다</p>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: '#78350f' }}>DB 연결 없이도 컬럼명을 직접 입력하여 표준화 추천을 받을 수 있습니다.</p>
            <button onClick={() => navigate('/da/connect')} style={{ background: '#d97706', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              🔌 DB 연결하기
            </button>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>
          {/* 좌측: 입력 */}
          <div>
            {/* 테이블 선택 */}
            {connected && (
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, marginBottom: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: '#1e293b' }}>📋 테이블 선택</h3>
                <select
                  value={selectedTable}
                  onChange={e => setSelectedTable(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 8, color: '#1e293b', fontSize: 13, outline: 'none', marginBottom: 10 }}
                >
                  <option value="">테이블 선택...</option>
                  {tables.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <button
                  onClick={handleLoadColumns}
                  disabled={!selectedTable || loading}
                  style={{ width: '100%', padding: '9px', background: selectedTable ? '#1e3a5f' : '#e2e8f0', color: selectedTable ? '#fff' : '#94a3b8', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: selectedTable ? 'pointer' : 'default' }}
                >
                  {loading ? '⏳ 로딩 중...' : '컬럼 불러오기'}
                </button>
              </div>
            )}

            {/* 직접 입력 */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, marginBottom: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: '#1e293b' }}>✏️ 컬럼명 직접 입력</h3>
              <p style={{ fontSize: 11, color: '#64748b', marginBottom: 10 }}>한 줄에 하나씩 입력 (한글/영문 모두 가능)</p>
              <textarea
                placeholder={'기관명\n등록일자\n사용여부\nINST_CD\nREG_DT\nUSE_YN'}
                rows={8}
                onChange={e => {
                  const cols = e.target.value.split('\n').map(c => c.trim()).filter(c => c);
                  setColumns(cols);
                  setRuleResults(null);
                  setAiResults(null);
                }}
                style={{ width: '100%', padding: '10px 12px', background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 8, color: '#1e293b', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
              <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
                {columns.length > 0 ? `✅ ${columns.length}개 컬럼 입력됨` : '컬럼명을 입력하세요'}
              </p>
            </div>

            {/* 실행 버튼 */}
            {columns.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  onClick={handleRuleStandardize}
                  disabled={loading}
                  style={{ padding: '11px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}
                >
                  {loading ? '⏳ 분석 중...' : '⚡ 규칙 기반 표준화 (빠름)'}
                </button>
                <button
                  onClick={handleAiStandardize}
                  disabled={aiLoading}
                  style={{ padding: '11px', background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: aiLoading ? 0.6 : 1 }}
                >
                  {aiLoading ? '⏳ AI 분석 중...' : '🤖 AI 표준화 추천 (정확)'}
                </button>
                <p style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', margin: 0 }}>
                  규칙 기반: 즉시 · AI: 5~15초 소요
                </p>
              </div>
            )}
          </div>

          {/* 우측: 결과 */}
          <div>
            {/* 종합 평가 (AI만) */}
            {mode === 'ai' && aiResults?.overall_assessment && (
              <div style={{ background: '#faf5ff', border: '1px solid #d8b4fe', borderRadius: 12, padding: '14px 18px', marginBottom: 14 }}>
                <p style={{ margin: 0, fontSize: 13, color: '#7c3aed', lineHeight: 1.7 }}>
                  <span style={{ fontWeight: 700 }}>📊 AI 종합 평가:</span> {aiResults.overall_assessment}
                </p>
                {aiResults.table_name_suggestion && (
                  <p style={{ margin: '8px 0 0', fontSize: 12, color: '#6b21a8' }}>
                    💡 테이블명 제안: <span style={{ fontWeight: 700, background: '#ede9fe', padding: '2px 8px', borderRadius: 4 }}>{aiResults.table_name_suggestion}</span>
                  </p>
                )}
              </div>
            )}

            {/* 결과 없음 */}
            {!hasResults && (
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '60px 40px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🔤</div>
                <p style={{ fontSize: 15, color: '#374151', fontWeight: 600, marginBottom: 8 }}>컬럼명을 입력하고 표준화를 실행하세요</p>
                <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
                  공통표준용어 13,177개 기반으로<br />
                  영문약어명 자동 추천 · 도메인 분류 · 데이터타입 권장
                </p>
              </div>
            )}

            {/* 결과 테이블 */}
            {hasResults && (
              <>
                {/* 헤더 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                      {mode === 'ai' ? '🤖 AI 표준화 결과' : '⚡ 규칙 기반 결과'} · {columns.length}개 컬럼
                    </span>
                    {/* 신뢰도 분포 */}
                    {mode === 'rule' && ruleResults && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        {['high', 'medium', 'low'].map(conf => {
                          const cnt = columns.filter(col => ruleResults[col]?.confidence === conf).length;
                          if (!cnt) return null;
                          return (
                            <span key={conf} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: CONF_BG[conf], color: CONF_COLOR[conf], fontWeight: 600 }}>
                              {CONF_LABEL[conf]} {cnt}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={exportExcel} style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      📥 CSV 다운로드
                    </button>
                    {mode === 'ai' && aiResults?.columns && (
                      <button onClick={generateDDL} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        📝 DDL 생성
                      </button>
                    )}
                  </div>
                </div>

                {/* 결과 카드 목록 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {mode === 'rule' && columns.map(col => {
                    const r = ruleResults?.[col] || {};
                    const conf = r.confidence || 'low';
                    return (
                      <div key={col} style={{ background: '#fff', border: `1px solid ${CONF_COLOR[conf]}20`, borderRadius: 10, padding: '12px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          {/* 원래 컬럼명 */}
                          <span style={{ fontSize: 13, color: '#64748b', minWidth: 120 }}>{col}</span>
                          <span style={{ color: '#cbd5e1', fontSize: 16 }}>→</span>
                          {/* 추천 영문약어 */}
                          <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', background: '#f8fafc', padding: '3px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontFamily: 'monospace' }}>
                            {r.recommended || col.toUpperCase()}
                          </span>
                          {/* 도메인 */}
                          {r.domain && (
                            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#eff6ff', color: '#2563eb', fontWeight: 500 }}>{r.domain}</span>
                          )}
                          {/* 데이터타입 */}
                          {r.data_type && (
                            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#f0fdf4', color: '#059669', fontWeight: 500, fontFamily: 'monospace' }}>{r.data_type}</span>
                          )}
                          {/* 신뢰도 */}
                          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: CONF_BG[conf], color: CONF_COLOR[conf], fontWeight: 700, marginLeft: 'auto' }}>
                            신뢰도 {CONF_LABEL[conf]}
                          </span>
                        </div>
                        {r.example && (
                          <p style={{ margin: '6px 0 0', fontSize: 11, color: '#94a3b8' }}>예시: {r.example}</p>
                        )}
                      </div>
                    );
                  })}

                  {mode === 'ai' && (aiResults?.columns || []).map((c, i) => {
                    const conf = c.confidence || 'low';
                    return (
                      <div key={i} style={{ background: '#fff', border: `1px solid ${CONF_COLOR[conf]}20`, borderRadius: 10, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: c.reason ? 8 : 0 }}>
                          <span style={{ fontSize: 13, color: '#64748b', minWidth: 120 }}>{c.original}</span>
                          <span style={{ color: '#cbd5e1', fontSize: 16 }}>→</span>
                          {/* 한글 표준용어 */}
                          {c.recommended_kr && (
                            <span style={{ fontSize: 12, color: '#7c3aed', background: '#faf5ff', padding: '2px 8px', borderRadius: 6, border: '1px solid #e9d5ff' }}>{c.recommended_kr}</span>
                          )}
                          {/* 영문약어 */}
                          <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', background: '#f8fafc', padding: '3px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontFamily: 'monospace' }}>
                            {c.recommended_en || c.original?.toUpperCase()}
                          </span>
                          {c.domain && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#eff6ff', color: '#2563eb', fontWeight: 500 }}>{c.domain}</span>}
                          {c.data_type && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#f0fdf4', color: '#059669', fontWeight: 500, fontFamily: 'monospace' }}>{c.data_type}</span>}
                          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: CONF_BG[conf], color: CONF_COLOR[conf], fontWeight: 700, marginLeft: 'auto' }}>
                            신뢰도 {CONF_LABEL[conf]}
                          </span>
                        </div>
                        {c.reason && (
                          <p style={{ margin: 0, fontSize: 11, color: '#64748b', lineHeight: 1.6, borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
                            📌 {c.reason}
                          </p>
                        )}
                        {c.issues && (
                          <p style={{ margin: '4px 0 0', fontSize: 11, color: '#dc2626', lineHeight: 1.5 }}>
                            ⚠️ {c.issues}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* 표준화 사전 참고 */}
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 16px', marginTop: 14 }}>
                  <p style={{ margin: 0, fontSize: 12, color: '#92400e', lineHeight: 1.6 }}>
                    💡 <strong>주요 형식단어 영문약어:</strong> 코드→CD, 번호→NO, 명칭→NM, 일자→DT, 금액→AMT, 여부→YN, 건수→CNT, 순번→SEQ, 구분→TP, 상태→STS
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DAStandard;
