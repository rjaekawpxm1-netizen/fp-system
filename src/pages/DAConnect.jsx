import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { connectDB, connectOracleHost, connectOracleTNS, connectOracleWallet, connectFile } from '../utils/daApi';

const TAB_STYLE = (active) => ({
  padding: '10px 18px', fontSize: 13, fontWeight: 600, border: 'none',
  cursor: 'pointer', borderRadius: '8px 8px 0 0', transition: 'all 0.15s',
  background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
  color: active ? '#10b981' : '#64748b',
  borderBottom: active ? '2px solid #10b981' : '2px solid transparent',
});

const INPUT = { width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f1f5f9', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' };
const LABEL = { fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6, fontWeight: 500 };

const DAConnect = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState('postgresql');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  // 각 탭 폼 상태
  const [pg, setPg] = useState({ host: 'localhost', port: '5432', dbname: '', user: '', password: '' });
  const [mysql, setMysql] = useState({ host: 'localhost', port: '3306', dbname: '', user: '', password: '' });
  const [oraHost, setOraHost] = useState({ host: 'localhost', port: '1521', service_name: '', user: '', password: '' });
  const [oraTns, setOraTns] = useState({ tns_string: '', user: '', password: '' });
  const [oraWallet, setOraWallet] = useState({ tns_alias: '', user: '', password: '', wallet_password: '' });
  const [walletFiles, setWalletFiles] = useState([]);

  const handleConnect = async () => {
    setLoading(true);
    setResult(null);
    try {
      let res;
      if (tab === 'postgresql') res = await connectDB({ db_type: 'postgresql', ...pg });
      else if (tab === 'mysql') res = await connectDB({ db_type: 'mysql', ...mysql });
      else if (tab === 'oracle-host') res = await connectOracleHost(oraHost);
      else if (tab === 'oracle-tns') res = await connectOracleTNS(oraTns);
      else if (tab === 'oracle-wallet') {
        const fd = new FormData();
        walletFiles.forEach(f => fd.append('files', f));
        fd.append('tns_alias', oraWallet.tns_alias);
        fd.append('user', oraWallet.user);
        fd.append('password', oraWallet.password);
        fd.append('wallet_password', oraWallet.wallet_password);
        res = await connectOracleWallet(fd);
      }
      setResult(res);
      if (res.success) {
        setTimeout(() => navigate('/da/setup'), 1200);
      }
    } catch (e) {
      setResult({ success: false, message: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await connectFile(file);
      setResult(res);
      if (res.success) setTimeout(() => navigate('/da/setup'), 1200);
    } catch (err) {
      setResult({ success: false, message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const inputRow = (label, val, setter, field, type = 'text', placeholder = '') => (
    <div style={{ marginBottom: 12 }}>
      <label style={LABEL}>{label}</label>
      <input type={type} value={val[field]} onChange={e => setter(v => ({ ...v, [field]: e.target.value }))} placeholder={placeholder} style={INPUT} />
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
    <div style={{ minHeight: '100vh', background: '#0a0f1e', fontFamily: "'Apple SD Gothic Neo','Noto Sans KR',sans-serif", padding: '32px 24px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>

        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <button onClick={() => navigate('/da')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 18 }}>←</button>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#f1f5f9' }}>🔌 DB 연결</h2>
            <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>품질진단을 수행할 DB에 접속하세요</p>
          </div>
        </div>

        {/* 탭 */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 0, flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={TAB_STYLE(tab === t.key)}>{t.label}</button>
          ))}
        </div>

        {/* 폼 */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: 24 }}>

          {tab === 'postgresql' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              {inputRow('Host', pg, setPg, 'host', 'text', 'localhost')}
              {inputRow('Port', pg, setPg, 'port', 'text', '5432')}
              {inputRow('Database', pg, setPg, 'dbname')}
              {inputRow('User ID', pg, setPg, 'user')}
              <div style={{ gridColumn: '1/-1' }}>{inputRow('Password', pg, setPg, 'password', 'password')}</div>
            </div>
          )}

          {tab === 'mysql' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              {inputRow('Host', mysql, setMysql, 'host', 'text', 'localhost')}
              {inputRow('Port', mysql, setMysql, 'port', 'text', '3306')}
              {inputRow('Database', mysql, setMysql, 'dbname')}
              {inputRow('User ID', mysql, setMysql, 'user')}
              <div style={{ gridColumn: '1/-1' }}>{inputRow('Password', mysql, setMysql, 'password', 'password')}</div>
            </div>
          )}

          {tab === 'oracle-host' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              {inputRow('Host', oraHost, setOraHost, 'host')}
              {inputRow('Port', oraHost, setOraHost, 'port', 'text', '1521')}
              <div style={{ gridColumn: '1/-1' }}>{inputRow('Service Name (또는 SID)', oraHost, setOraHost, 'service_name')}</div>
              {inputRow('User ID', oraHost, setOraHost, 'user')}
              {inputRow('Password', oraHost, setOraHost, 'password', 'password')}
            </div>
          )}

          {tab === 'oracle-tns' && (
            <div>
              <div style={{ marginBottom: 12 }}>
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
                {inputRow('User ID', oraTns, setOraTns, 'user')}
                {inputRow('Password', oraTns, setOraTns, 'password', 'password')}
              </div>
            </div>
          )}

          {tab === 'oracle-wallet' && (
            <div>
              <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#6ee7b7' }}>
                💡 Wallet 폴더(cwallet.sso, tnsnames.ora, sqlnet.ora 등)를 모두 선택해 올려주세요
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={LABEL}>Wallet 파일들 (다중 선택)</label>
                <input type="file" multiple onChange={e => setWalletFiles(Array.from(e.target.files))} style={{ ...INPUT, padding: '8px 14px' }} />
                {walletFiles.length > 0 && (
                  <p style={{ fontSize: 11, color: '#10b981', marginTop: 6 }}>✅ {walletFiles.length}개 파일 선택됨: {walletFiles.map(f => f.name).join(', ')}</p>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                {inputRow('접속명 (TNS Alias)', oraWallet, setOraWallet, 'tns_alias', 'text', 'dqmdb_high')}
                {inputRow('Wallet 비밀번호 (선택)', oraWallet, setOraWallet, 'wallet_password', 'password')}
                {inputRow('DB User ID', oraWallet, setOraWallet, 'user')}
                {inputRow('DB Password', oraWallet, setOraWallet, 'password', 'password')}
              </div>
            </div>
          )}

          {tab === 'file' && (
            <div>
              <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#93c5fd' }}>
                💡 CSV 또는 Excel 파일을 업로드하면 자동으로 SQLite DB에 적재됩니다
              </div>
              <label style={{ display: 'block', border: '2px dashed rgba(255,255,255,0.15)', borderRadius: 10, padding: '32px', textAlign: 'center', cursor: 'pointer' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
                <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 4 }}>CSV 또는 Excel 파일 선택</div>
                <div style={{ fontSize: 11, color: '#475569' }}>.csv, .xls, .xlsx 지원</div>
                <input type="file" accept=".csv,.xls,.xlsx" onChange={handleFile} style={{ display: 'none' }} />
              </label>
            </div>
          )}

          {/* 결과 */}
          {result && (
            <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 8, background: result.success ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${result.success ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, fontSize: 13, color: result.success ? '#6ee7b7' : '#fca5a5' }}>
              {result.success ? '✅ ' : '❌ '}{result.message}
              {result.success && <span style={{ marginLeft: 8, color: '#10b981' }}>→ 진단 항목 설정으로 이동 중...</span>}
            </div>
          )}

          {/* 연결 버튼 */}
          {tab !== 'file' && (
            <button
              onClick={handleConnect}
              disabled={loading}
              style={{ marginTop: 20, width: '100%', padding: '12px', background: loading ? '#334155' : 'linear-gradient(135deg, #059669, #10b981)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: loading ? 'default' : 'pointer' }}
            >
              {loading ? '⏳ 연결 중...' : '🔌 연결하기'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DAConnect;
