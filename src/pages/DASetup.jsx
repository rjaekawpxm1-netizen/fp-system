import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTables, getColumns, getRules, runDiagnosis, getConnectStatus } from '../utils/daApi';

const RULE_COLORS = {
  completeness: '#3b82f6', consistency: '#10b981',
  accuracy: '#f59e0b', usefulness: '#eab308',
  uniqueness: '#8b5cf6', validity: '#ef4444',
};
const DIM_LABELS = {
  completeness: '완전성', consistency: '일관성',
  accuracy: '정확성', usefulness: '유용성',
  uniqueness: '유일성', validity: '유효성',
};
const TYPE_DEFAULTS = {
  DATE:    ['COMP_001', 'COMP_002', 'CONS_001', 'VAL_001'],
  NUMBER:  ['COMP_001', 'COMP_002', 'CONS_001', 'USE_001', 'UNIQ_001', 'VAL_002'],
  TEXT:    ['COMP_001', 'COMP_002', 'CONS_001', 'ACC_001', 'USE_001', 'UNIQ_001'],
  UNKNOWN: ['COMP_001', 'COMP_002', 'CONS_001', 'ACC_001', 'USE_001'],
};

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
  const [step, setStep] = useState('setup'); // setup | running | done
  const [diagResults, setDiagResults] = useState(null);

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
      // 타입별 기본 규칙 자동 설정
      const map = {};
      (r.columns || []).forEach(col => {
        const t = (r.types || {})[col] || 'UNKNOWN';
        map[col] = TYPE_DEFAULTS[t] || TYPE_DEFAULTS.UNKNOWN;
      });
      setColumnRuleMap(map);
      setLoading(false);
    });
  }, [selectedTable]);

  // 모든 규칙 flat
  const allRules = Object.entries(rules).flatMap(([dim, rs]) =>
    (rs || []).map(r => ({ ...r, _dim: dim }))
  );

  const toggleRule = (col, ruleId) => {
    setColumnRuleMap(prev => {
      const cur = prev[col] || [];
      return {
        ...prev,
        [col]: cur.includes(ruleId) ? cur.filter(r => r !== ruleId) : [...cur, ruleId],
      };
    });
  };

  const handleRunDiagnosis = async () => {
    if (!selectedTable) return;
    setRunning(true);
    setStep('running');
    setProgress(0);
    try {
      // 진행률 시뮬레이션
      const interval = setInterval(() => {
        setProgress(p => Math.min(p + 8, 90));
      }, 400);

      const res = await runDiagnosis(selectedTable, columnRuleMap, dbType);
      clearInterval(interval);
      setProgress(100);

      setTimeout(() => {
        setDiagResults(res);
        // 결과 localStorage에 저장
        localStorage.setItem('da-diag-results', JSON.stringify(res));
        localStorage.setItem('da-diag-table', selectedTable);
        setStep('done');
        setRunning(false);
        navigate('/da/result');
      }, 500);
    } catch (err) {
      setRunning(false);
      setStep('setup');
      alert('진단 실패: ' + err.message);
    }
  };

  const TYPE_COLOR = { DATE: '#3b82f6', NUMBER: '#10b981', TEXT: '#f59e0b', UNKNOWN: '#64748b' };

  const totalQueries = columns.reduce((sum, col) => sum + (columnRuleMap[col]?.length || 0), 0);

  return (
    <div style={{ minHeight: '100vh', background: '#0a0f1e', fontFamily: "'Apple SD Gothic Neo','Noto Sans KR',sans-serif", padding: '32px 24px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>

        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <button onClick={() => navigate('/da')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 18 }}>←</button>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#f1f5f9' }}>⚙️ 진단 항목 설정</h2>
            <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>테이블 선택 후 컬럼별 진단 규칙을 설정하세요</p>
          </div>
        </div>

        {/* 진단 중 오버레이 */}
        {step === 'running' && (
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '48px', textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚙️</div>
            <h3 style={{ color: '#f1f5f9', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>품질진단 실행 중...</h3>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 24 }}>{totalQueries}개 쿼리 실행 중</p>
            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 20, height: 8, overflow: 'hidden', maxWidth: 400, margin: '0 auto' }}>
              <div style={{ width: progress + '%', height: '100%', background: 'linear-gradient(90deg, #059669, #10b981)', borderRadius: 20, transition: 'width 0.4s' }} />
            </div>
            <p style={{ color: '#10b981', fontSize: 13, marginTop: 8, fontWeight: 600 }}>{progress}%</p>
          </div>
        )}

        {step === 'setup' && (
          <>
            {/* 테이블 선택 */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 8, fontWeight: 500 }}>📋 진단할 테이블 선택</label>
              <select
                value={selectedTable}
                onChange={e => setSelectedTable(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f1f5f9', fontSize: 14, outline: 'none' }}
              >
                <option value="">테이블을 선택하세요...</option>
                {tables.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* 컬럼별 규칙 설정 */}
            {loading && <div style={{ color: '#64748b', textAlign: 'center', padding: 40 }}>⏳ 컬럼 정보 로딩 중...</div>}

            {!loading && columns.length > 0 && (
              <>
                {/* 요약 */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                  {[
                    { label: '컬럼 수', value: columns.length + '개' },
                    { label: '총 진단 쿼리', value: totalQueries + '개' },
                    { label: '연결 DB', value: dbType.toUpperCase() },
                  ].map(s => (
                    <div key={s.label} style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '10px 16px', flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#10b981' }}>{s.value}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* 컬럼 테이블 */}
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '180px 80px 1fr', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.04)' }}>
                    <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>컬럼명</span>
                    <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>타입</span>
                    <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>진단 규칙</span>
                  </div>
                  {columns.map((col, i) => {
                    const colType = columnTypes[col] || 'UNKNOWN';
                    const selectedRules = columnRuleMap[col] || [];
                    return (
                      <div key={col} style={{ display: 'grid', gridTemplateColumns: '180px 80px 1fr', padding: '10px 16px', borderBottom: i < columns.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, color: '#f1f5f9', fontWeight: 500 }}>{col}</span>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: TYPE_COLOR[colType] + '20', color: TYPE_COLOR[colType], fontWeight: 700, display: 'inline-block' }}>
                          {colType}
                        </span>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {allRules.filter(r => r.get && r.level !== 'table' || !r.level || r.level === 'column').map(rule => {
                            const active = selectedRules.includes(rule.id);
                            const color = RULE_COLORS[rule._dim] || '#64748b';
                            return (
                              <button
                                key={rule.id}
                                onClick={() => toggleRule(col, rule.id)}
                                style={{
                                  fontSize: 10, padding: '2px 8px', borderRadius: 12, border: `1px solid ${active ? color : 'rgba(255,255,255,0.1)'}`,
                                  background: active ? color + '20' : 'transparent', color: active ? color : '#475569',
                                  cursor: 'pointer', fontWeight: active ? 700 : 400, transition: 'all 0.15s',
                                }}
                              >
                                {rule.name?.replace(/완전성_|일관성_|정확성_|유용성_|유일성_|유효성_/, '')}
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
                  onClick={handleRunDiagnosis}
                  style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #059669, #10b981)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
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
