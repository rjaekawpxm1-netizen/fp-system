import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTables, getColumns, getRules, runDiagnosis, getConnectStatus } from '../utils/daApi';

const RULE_COLORS = {
  completeness: '#2563eb', consistency: '#059669',
  accuracy: '#d97706', usefulness: '#ca8a04',
  uniqueness: '#7c3aed', validity: '#dc2626',
};
const TYPE_DEFAULTS = {
  DATE:    ['COMP_001', 'COMP_002', 'CONS_001', 'VAL_001'],
  NUMBER:  ['COMP_001', 'COMP_002', 'CONS_001', 'USE_001', 'UNIQ_001', 'VAL_002'],
  TEXT:    ['COMP_001', 'COMP_002', 'CONS_001', 'ACC_001', 'USE_001', 'UNIQ_001'],
  UNKNOWN: ['COMP_001', 'COMP_002', 'CONS_001', 'ACC_001', 'USE_001'],
};
const TYPE_COLOR = { DATE: '#2563eb', NUMBER: '#059669', TEXT: '#d97706', UNKNOWN: '#94a3b8' };
const TYPE_BG = { DATE: '#eff6ff', NUMBER: '#f0fdf4', TEXT: '#fffbeb', UNKNOWN: '#f8fafc' };

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
    <div style={{ minHeight: '100vh', background: '#f0f2f5', fontFamily: "'Apple SD Gothic Neo','Noto Sans KR',sans-serif", padding: '32px 24px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>

        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button onClick={() => navigate('/da')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 20 }}>←</button>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e293b' }}>⚙️ 진단 항목 설정</h2>
            <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>테이블 선택 후 컬럼별 진단 규칙을 설정하세요</p>
          </div>
        </div>

        {/* 진단 중 */}
        {running && (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '48px', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚙️</div>
            <h3 style={{ color: '#1e293b', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>품질진단 실행 중...</h3>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 24 }}>{totalQueries}개 쿼리 실행 중</p>
            <div style={{ background: '#f1f5f9', borderRadius: 20, height: 10, overflow: 'hidden', maxWidth: 400, margin: '0 auto' }}>
              <div style={{ width: progress + '%', height: '100%', background: 'linear-gradient(90deg, #059669, #10b981)', borderRadius: 20, transition: 'width 0.4s' }} />
            </div>
            <p style={{ color: '#059669', fontSize: 14, marginTop: 10, fontWeight: 700 }}>{progress}%</p>
          </div>
        )}

        {!running && (
          <>
            {/* 테이블 선택 */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <label style={{ fontSize: 12, color: '#475569', display: 'block', marginBottom: 8, fontWeight: 600 }}>📋 진단할 테이블 선택</label>
              <select
                value={selectedTable}
                onChange={e => setSelectedTable(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 8, color: '#1e293b', fontSize: 14, outline: 'none' }}
              >
                <option value="">테이블을 선택하세요...</option>
                {tables.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {loading && (
              <div style={{ background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center', color: '#64748b', fontSize: 14 }}>
                ⏳ 컬럼 정보 로딩 중...
              </div>
            )}

            {!loading && columns.length > 0 && (
              <>
                {/* 요약 */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                  {[
                    { label: '컬럼 수', value: columns.length + '개', color: '#2563eb', bg: '#eff6ff' },
                    { label: '총 진단 쿼리', value: totalQueries + '개', color: '#059669', bg: '#f0fdf4' },
                    { label: '연결 DB', value: dbType.toUpperCase(), color: '#7c3aed', bg: '#faf5ff' },
                  ].map(s => (
                    <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.color}20`, borderRadius: 10, padding: '10px 16px', flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* 컬럼 목록 */}
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '180px 80px 1fr', padding: '10px 16px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                    {['컬럼명', '타입', '진단 규칙 (클릭하여 ON/OFF)'].map(h => (
                      <span key={h} style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{h}</span>
                    ))}
                  </div>
                  {columns.map((col, i) => {
                    const colType = columnTypes[col] || 'UNKNOWN';
                    const selectedRules = columnRuleMap[col] || [];
                    return (
                      <div key={col} style={{ display: 'grid', gridTemplateColumns: '180px 80px 1fr', padding: '10px 16px', borderBottom: i < columns.length - 1 ? '1px solid #f8fafc' : 'none', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, color: '#1e293b', fontWeight: 500 }}>{col}</span>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: TYPE_BG[colType], color: TYPE_COLOR[colType], fontWeight: 700, display: 'inline-block' }}>
                          {colType}
                        </span>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {allRules.map(rule => {
                            const active = selectedRules.includes(rule.id);
                            const color = RULE_COLORS[rule._dim] || '#64748b';
                            const shortName = (rule.name || '').replace(/완전성_|일관성_|정확성_|유용성_|유일성_|유효성_/, '');
                            return (
                              <button
                                key={rule.id}
                                onClick={() => toggleRule(col, rule.id)}
                                style={{
                                  fontSize: 10, padding: '3px 9px', borderRadius: 12,
                                  border: `1px solid ${active ? color : '#e2e8f0'}`,
                                  background: active ? color : '#fff',
                                  color: active ? '#fff' : '#94a3b8',
                                  cursor: 'pointer', fontWeight: active ? 700 : 400,
                                  transition: 'all 0.15s',
                                }}
                              >
                                {shortName}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 실행 버튼 */}
                <button
                  onClick={handleRun}
                  style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #059669, #10b981)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(5,150,105,0.3)' }}
                >
                  🚀 품질진단 시작하기 ({totalQueries}개 쿼리)
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default DASetup;
