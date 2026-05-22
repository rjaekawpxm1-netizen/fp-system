import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTables, getColumns, getRules, runDiagnosis, getConnectStatus } from '../utils/daApi';
import { color, button, card } from '../styles/tokens';

const { blue: BLUE, blueTint: BLUE_TINT, ink: INK, sub: SUB, mute: MUTE, line: LINE, bg: BG } = color;

const RULE_COLORS = {
  completeness: '#3182F6', consistency: '#0F8B47',
  accuracy: '#D97706', usefulness: '#CA8A04',
  uniqueness: '#7C3AED', validity: '#E11D48',
};
const TYPE_DEFAULTS = {
  DATE:    ['COMP_001', 'COMP_002', 'CONS_001', 'VAL_001'],
  NUMBER:  ['COMP_001', 'COMP_002', 'CONS_001', 'USE_001', 'UNIQ_001', 'VAL_002'],
  TEXT:    ['COMP_001', 'COMP_002', 'CONS_001', 'ACC_001', 'USE_001', 'UNIQ_001'],
  UNKNOWN: ['COMP_001', 'COMP_002', 'CONS_001', 'ACC_001', 'USE_001'],
};
const TYPE_COLOR = { DATE: '#3182F6', NUMBER: '#0F8B47', TEXT: '#D97706', UNKNOWN: MUTE };
const TYPE_BG    = { DATE: BLUE_TINT, NUMBER: '#E7F8EF', TEXT: '#FFF3D6', UNKNOWN: LINE };

const DASetup = () => {
  const navigate = useNavigate();
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [columns, setColumns] = useState([]);
  const [columnTypes, setColumnTypes] = useState({});
  const [rules, setRules] = useState({});
  const [columnRuleMap, setColumnRuleMap] = useState({});
  const [dbType, setDbType] = useState('postgresql');
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    getConnectStatus().then(r => {
      if (!r.connected) { navigate('/da/connect'); return; }
      setDbType(r.db_type?.toLowerCase() || 'postgresql');
    });
    getTables().then(r => setTables(r.tables || []));
    getRules().then(r => setRules(r.rules || {}));
  }, []);

  useEffect(() => {
    if (!selectedTable) return;
    setLoading(true);
    getColumns(selectedTable).then(r => {
      setColumns(r.columns || []);
      setColumnTypes(r.types || {});
      const map = {};
      (r.columns || []).forEach(col => {
        const t = (r.types || {})[col] || 'UNKNOWN';
        map[col] = [...(TYPE_DEFAULTS[t] || TYPE_DEFAULTS.UNKNOWN)];
      });
      setColumnRuleMap(map);
      setLoading(false);
    });
  }, [selectedTable]);

  const allRules = Object.entries(rules).flatMap(([dim, rs]) =>
    (rs || []).map(r => ({ ...r, _dim: dim }))
  ).filter(r => !r.level || r.level === 'column');

  const toggleRule = (col, ruleId) => {
    setColumnRuleMap(prev => {
      const cur = prev[col] || [];
      return { ...prev, [col]: cur.includes(ruleId) ? cur.filter(r => r !== ruleId) : [...cur, ruleId] };
    });
  };

  const totalQueries = columns.reduce((sum, col) => sum + (columnRuleMap[col]?.length || 0), 0);

  const handleRun = async () => {
    if (!selectedTable) return;
    setRunning(true);
    setProgress(0);
    try {
      const interval = setInterval(() => setProgress(p => Math.min(p + 6, 88)), 350);
      const res = await runDiagnosis(selectedTable, columnRuleMap, dbType);
      clearInterval(interval);
      setProgress(100);
      localStorage.setItem('da-diag-results', JSON.stringify(res));
      localStorage.setItem('da-diag-table', selectedTable);
      setTimeout(() => navigate('/da/result'), 600);
    } catch (err) {
      setRunning(false);
      alert('진단 실패: ' + err.message);
    }
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
          진단 항목 설정
        </div>
      </header>

      <div style={{ flex: 1, overflow: 'auto', padding: '32px 32px 40px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          {/* Step indicator */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24, padding: '14px 20px', background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14 }}>
            {[
              { n: '01', l: 'DB 연결', done: true },
              { n: '02', l: '진단 항목 설정', active: true },
              { n: '03', l: '진단 실행' },
              { n: '04', l: '결과 확인' },
            ].map((s, i) => (
              <div key={s.n} style={{ display: 'flex', alignItems: 'center', flex: i < 3 ? 1 : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: s.active ? BLUE : s.done ? '#0F8B47' : LINE, color: (s.active || s.done) ? '#fff' : MUTE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                    {s.done ? '✓' : s.n}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: s.active ? 800 : 600, color: s.active ? INK : MUTE, whiteSpace: 'nowrap' }}>{s.l}</span>
                </div>
                {i < 3 && <div style={{ flex: 1, height: 2, background: LINE, margin: '0 16px' }} />}
              </div>
            ))}
          </div>

          {/* ── Running overlay ── */}
          {running && (
            <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 20, padding: '60px 48px', textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⚙️</div>
              <h3 style={{ color: INK, fontSize: 20, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.025em' }}>품질진단 실행 중...</h3>
              <p style={{ color: SUB, fontSize: 14, marginBottom: 28 }}>{totalQueries}개 쿼리 실행 중</p>
              <div style={{ background: LINE, borderRadius: 999, height: 8, overflow: 'hidden', maxWidth: 400, margin: '0 auto 12px' }}>
                <div style={{ width: progress + '%', height: '100%', background: BLUE, borderRadius: 999, transition: 'width 0.4s' }} />
              </div>
              <p style={{ color: BLUE, fontSize: 15, fontWeight: 800 }}>{progress}%</p>
            </div>
          )}

          {!running && (
            <>
              {/* ── Table selector ── */}
              <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, padding: '18px 22px', marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: MUTE, letterSpacing: '0.08em', marginBottom: 10 }}>① 진단할 테이블 선택</div>
                <select
                  value={selectedTable}
                  onChange={e => setSelectedTable(e.target.value)}
                  style={{ width: '100%', height: 42, padding: '0 14px', background: BG, border: `1px solid ${LINE}`, borderRadius: 10, color: INK, fontSize: 13.5, fontWeight: 600, outline: 'none', fontFamily: "'Pretendard', system-ui, sans-serif" }}
                >
                  <option value="">테이블을 선택하세요...</option>
                  {tables.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {loading && (
                <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, padding: '40px', textAlign: 'center', color: SUB, fontSize: 14, fontWeight: 600 }}>
                  ⏳ 컬럼 정보 로딩 중...
                </div>
              )}

              {!loading && columns.length > 0 && (
                <>
                  {/* Stats chips */}
                  <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                    {[
                      { label: '컬럼 수', value: columns.length + '개', color: BLUE, bg: BLUE_TINT },
                      { label: '총 진단 쿼리', value: totalQueries + '개', color: '#0F8B47', bg: '#E7F8EF' },
                      { label: '연결 DB', value: dbType.toUpperCase(), color: '#7C3AED', bg: '#F3EEFE' },
                    ].map(s => (
                      <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: '10px 18px', flex: 1, textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: 11, color: MUTE, fontWeight: 600, marginTop: 2 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Column list */}
                  <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '180px 80px 1fr', padding: '10px 16px', borderBottom: `1px solid ${LINE}`, background: BG }}>
                      {['컬럼명', '타입', '진단 규칙 (클릭하여 ON/OFF)'].map(h => (
                        <span key={h} style={{ fontSize: 11, color: MUTE, fontWeight: 800, letterSpacing: '-0.01em' }}>{h}</span>
                      ))}
                    </div>
                    {columns.map((col, i) => {
                      const colType = columnTypes[col] || 'UNKNOWN';
                      const selectedRules = columnRuleMap[col] || [];
                      return (
                        <div key={col} style={{ display: 'grid', gridTemplateColumns: '180px 80px 1fr', padding: '12px 16px', borderBottom: i < columns.length - 1 ? `1px solid ${LINE}` : 'none', alignItems: 'center' }}>
                          <span style={{ fontSize: 13, color: INK, fontWeight: 600, fontFamily: 'SF Mono, monospace' }}>{col}</span>
                          <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 6, background: TYPE_BG[colType], color: TYPE_COLOR[colType], fontWeight: 800, display: 'inline-block' }}>
                            {colType}
                          </span>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {allRules.map(rule => {
                              const active = selectedRules.includes(rule.id);
                              const color = RULE_COLORS[rule._dim] || MUTE;
                              const shortName = (rule.name || '').replace(/완전성_|일관성_|정확성_|유용성_|유일성_|유효성_/, '');
                              return (
                                <button key={rule.id} onClick={() => toggleRule(col, rule.id)}
                                  style={{ fontSize: 10, padding: '3px 9px', borderRadius: 999, border: `1px solid ${active ? color : LINE}`, background: active ? color : '#fff', color: active ? '#fff' : MUTE, cursor: 'pointer', fontWeight: active ? 800 : 600, transition: 'all 0.15s' }}>
                                  {shortName}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Run button */}
                  <button onClick={handleRun}
                    style={{ width: '100%', height: 56, background: BLUE, color: '#fff', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 20px rgba(49,130,246,0.28)', letterSpacing: '-0.01em' }}>
                    🚀 품질진단 시작하기 ({totalQueries}개 쿼리)
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DASetup;
