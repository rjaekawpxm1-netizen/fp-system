import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { connectDB, connectOracleHost, connectOracleTNS, connectOracleWallet, connectFile } from '../utils/daApi';

const INPUT = {
  width: '100%', padding: '10px 14px',
  background: '#fff', border: '1.5px solid #e2e8f0',
  borderRadius: 8, color: '#1e293b', fontSize: 13,
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};
const LABEL = { fontSize: 12, color: '#475569', display: 'block', marginBottom: 6, fontWeight: 600 };

const DAConnect = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState('postgresql');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const [pg, setPg] = useState({ host: 'localhost', port: '5432', dbname: '', user: '', password: '' });
  const [mysql, setMysql] = useState({ host: 'localhost', port: '3306', dbname: '', user: '', password: '' });
  const [oraHost, setOraHost] = useState({ host: 'localhost', port: '1521', service_name: '', user: '', password: '' });
  const [oraTns, setOraTns] = useState({ tns_string: '', user: '', password: '' });
  const [oraWallet, setOraWallet] = useState({ tns_alias: '', user: '', password: '', wallet_password: '' });
  const [walletFiles, setWalletFiles] = useState([]);

  const handleConnect = async () => {
    setLoading(true); setResult(null);
    try {
      let res;
      if (tab === 'postgresql') res = await connectDB({ db_type: 'postgresql', ...pg });
      else if (tab === 'mysql') res = await connectDB({ db_type: 'mysql', ...mysql });
      else if (tab === 'oracle-host') res = await connectOracleHost(oraHost);
      else if (tab === 'oracle-tns') res = await connectOracleTNS(oraTns);
      else if (tab === 'oracle-wallet') {
        const fd = new FormData();
        walletFiles.forEach(f => fd.append('files', f));
        Object.entries(oraWallet).forEach(([k, v]) => fd.append(k, v));
        res = await connectOracleWallet(fd);
      }
      setResult(res);
      if (res?.success) setTimeout(() => navigate('/da/setup'), 1200);
    } catch (e) {
      setResult({ success: false, message: e.message });
    } finally { setLoading(false); }
  };

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true); setResult(null);
    try {
      const res = await connectFile(file);
      setResult(res);
      if (res?.success) setTimeout(() => navigate('/da/setup'), 1200);
    } catch (err) {
      setResult({ success: false, message: err.message });
    } finally { setLoading(false); }
  };

  const F = (label, val, setter, field, type = 'text', placeholder = '') => (
    <div style={{ marginBottom: 14 }}>
      <label style={LABEL}>{label}</label>
      <input
        type={type} value={val[field]}
        onChange={e => setter(v => ({ ...v, [field]: e.target.value }))}
        placeholder={placeholder}
        style={INPUT}
        onFocus={e => e.target.style.borderColor = '#059669'}
        onBlur={e => e.target.style.borderColor = '#e2e8f0'}
      />
    </div>
  );

  const TABS = [
    { key: 'postgresql', label: '🐘 PostgreSQL' },
    { key: 'mysql', label: '🐬 MySQL' },
    { key: 'oracle-host', label: '🔶 Oracle (Host)' },
    { key: 'oracle-tns', label: '🔶 Oracle (TNS)' },
    { key: 'oracle-wallet', label: '🔐 Oracle (Wallet)' },
    { key: 'file', label: '📁 파일 업로드' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', fontFamily: "'Apple SD Gothic Neo','Noto Sans KR',sans-serif", padding: '32px 24px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>

        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button onClick={() => navigate('/da')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 20 }}>←</button>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e293b' }}>🔌 DB 연결</h2>
            <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>품질진단을 수행할 DB에 접속하세요</p>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          {/* 탭 */}
          <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap', background: '#f8fafc' }}>
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  padding: '12px 16px', fontSize: 12, fontWeight: 600, border: 'none',
                  cursor: 'pointer', background: tab === t.key ? '#fff' : 'transparent',
                  color: tab === t.key ? '#059669' : '#64748b',
                  borderBottom: tab === t.key ? '2px solid #059669' : '2px solid transparent',
                  marginBottom: -1,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* 폼 */}
          <div style={{ padding: '24px' }}>
            {tab === 'postgresql' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                {F('Host', pg, setPg, 'host', 'text', 'localhost')}
                {F('Port', pg, setPg, 'port', 'text', '5432')}
                {F('Database', pg, setPg, 'dbname')}
                {F('User ID', pg, setPg, 'user')}
                <div style={{ gridColumn: '1/-1' }}>{F('Password', pg, setPg, 'password', 'password')}</div>
              </div>
            )}
            {tab === 'mysql' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                {F('Host', mysql, setMysql, 'host', 'text', 'localhost')}
                {F('Port', mysql, setMysql, 'port', 'text', '3306')}
                {F('Database', mysql, setMysql, 'dbname')}
                {F('User ID', mysql, setMysql, 'user')}
                <div style={{ gridColumn: '1/-1' }}>{F('Password', mysql, setMysql, 'password', 'password')}</div>
              </div>
            )}
            {tab === 'oracle-host' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                {F('Host', oraHost, setOraHost, 'host')}
                {F('Port', oraHost, setOraHost, 'port', 'text', '1521')}
                <div style={{ gridColumn: '1/-1' }}>{F('Service Name (또는 SID)', oraHost, setOraHost, 'service_name')}</div>
                {F('User ID', oraHost, setOraHost, 'user')}
                {F('Password', oraHost, setOraHost, 'password', 'password')}
              </div>
            )}
            {tab === 'oracle-tns' && (
              <div>
                <div style={{ marginBottom: 14 }}>
                  <label style={LABEL}>TNS 문자열</label>
                  <textarea
                    value={oraTns.tns_string}
                    onChange={e => setOraTns(v => ({ ...v, tns_string: e.target.value }))}
                    placeholder={'① TNS명: ORCL\n② Easy Connect: 192.168.1.10:1521/ORCL\n③ Full descriptor: (DESCRIPTION=...)'}
                    rows={4}
                    style={{ ...INPUT, resize: 'vertical', lineHeight: 1.6 }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                  {F('User ID', oraTns, setOraTns, 'user')}
                  {F('Password', oraTns, setOraTns, 'password', 'password')}
                </div>
              </div>
            )}
            {tab === 'oracle-wallet' && (
              <div>
                <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#166534' }}>
                  💡 Wallet 폴더(cwallet.sso, tnsnames.ora, sqlnet.ora 등)를 모두 선택해 올려주세요
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={LABEL}>Wallet 파일들 (다중 선택)</label>
                  <input type="file" multiple onChange={e => setWalletFiles(Array.from(e.target.files))} style={{ ...INPUT, padding: '8px 14px' }} />
                  {walletFiles.length > 0 && <p style={{ fontSize: 11, color: '#059669', marginTop: 6 }}>✅ {walletFiles.length}개 파일 선택됨</p>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                  {F('접속명 (TNS Alias)', oraWallet, setOraWallet, 'tns_alias', 'text', 'dqmdb_high')}
                  {F('Wallet 비밀번호 (선택)', oraWallet, setOraWallet, 'wallet_password', 'password')}
                  {F('DB User ID', oraWallet, setOraWallet, 'user')}
                  {F('DB Password', oraWallet, setOraWallet, 'password', 'password')}
                </div>
              </div>
            )}
            {tab === 'file' && (
              <div>
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#1e40af' }}>
                  💡 CSV 또는 Excel 파일을 업로드하면 자동으로 SQLite DB에 적재되어 진단할 수 있습니다
                </div>
                <label style={{ display: 'block', border: '2px dashed #e2e8f0', borderRadius: 12, padding: '40px', textAlign: 'center', cursor: 'pointer', background: '#f8fafc', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#059669'; e.currentTarget.style.background = '#f0fdf4'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#f8fafc'; }}
                >
                  <div style={{ fontSize: 40, marginBottom: 10 }}>📁</div>
                  <div style={{ fontSize: 14, color: '#374151', fontWeight: 600, marginBottom: 4 }}>CSV 또는 Excel 파일 선택</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>.csv, .xls, .xlsx 지원</div>
                  <input type="file" accept=".csv,.xls,.xlsx" onChange={handleFile} style={{ display: 'none' }} />
                </label>
              </div>
            )}

            {/* 결과 메시지 */}
            {result && (
              <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 8, background: result.success ? '#f0fdf4' : '#fef2f2', border: `1px solid ${result.success ? '#86efac' : '#fca5a5'}`, fontSize: 13, color: result.success ? '#166534' : '#dc2626' }}>
                {result.success ? '✅ ' : '❌ '}{result.message}
                {result.success && <span style={{ marginLeft: 8, color: '#059669', fontWeight: 600 }}>→ 진단 항목 설정으로 이동 중...</span>}
              </div>
            )}

            {/* 연결 버튼 */}
            {tab !== 'file' && (
              <button
                onClick={handleConnect}
                disabled={loading}
                style={{ marginTop: 20, width: '100%', padding: '13px', background: loading ? '#e2e8f0' : 'linear-gradient(135deg, #059669, #10b981)', color: loading ? '#94a3b8' : '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: loading ? 'default' : 'pointer' }}
              >
                {loading ? '⏳ 연결 중...' : '🔌 연결하기'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DAConnect;
