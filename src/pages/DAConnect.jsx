import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { connectDB, connectOracleHost, connectOracleTNS, connectOracleWallet, connectFile } from '../utils/daApi';
import { color, button, card } from '../styles/tokens';

const { blue: BLUE, blueTint: BLUE_TINT, ink: INK, sub: SUB, mute: MUTE, line: LINE, bg: BG } = color;

const INPUT_STYLE = {
  width: '100%', height: 42, padding: '0 14px',
  background: BG, border: `1px solid ${LINE}`,
  borderRadius: 10, color: INK, fontSize: 13.5,
  fontWeight: 600, outline: 'none', boxSizing: 'border-box',
  fontFamily: "'Pretendard', system-ui, sans-serif",
  letterSpacing: '-0.01em',
};

const DB_INFO = {
  postgresql: { label: 'PostgreSQL', short: 'PG', color: '#3182F6' },
  mysql:      { label: 'MySQL',      short: 'MY', color: '#0F8B47' },
  'oracle-host':   { label: 'Oracle (Host)',   short: 'OR', color: '#E11D48' },
  'oracle-tns':    { label: 'Oracle (TNS)',    short: 'OR', color: '#E11D48' },
  'oracle-wallet': { label: 'Oracle (Wallet)', short: 'OR', color: '#7C3AED' },
  file: { label: 'CSV / Excel', short: 'FL', color: '#7C3AED' },
};

const TABS = Object.entries(DB_INFO).map(([key, v]) => ({ key, label: v.label }));

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
    <div>
      <div style={{ fontSize: 12, fontWeight: 800, color: SUB, marginBottom: 6 }}>{label}</div>
      <input
        type={type} value={val[field]}
        onChange={e => setter(v => ({ ...v, [field]: e.target.value }))}
        placeholder={placeholder}
        style={INPUT_STYLE}
        onFocus={e => e.target.style.borderColor = BLUE}
        onBlur={e => e.target.style.borderColor = LINE}
      />
    </div>
  );

  const dbColor = DB_INFO[tab]?.color || BLUE;

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
          DB 연결
        </div>
      </header>

      <div style={{ flex: 1, overflow: 'auto', padding: '32px 32px 40px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          {/* Step indicator */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24, padding: '14px 20px', background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, overflow: 'hidden' }}>
            {[
              { n: '01', l: 'DB 연결', active: true },
              { n: '02', l: '진단 항목 설정' },
              { n: '03', l: '진단 실행' },
              { n: '04', l: '결과 확인' },
            ].map((s, i) => (
              <div key={s.n} style={{ display: 'flex', alignItems: 'center', flex: i < 3 ? 1 : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: s.active ? BLUE : LINE, color: s.active ? '#fff' : MUTE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{s.n}</div>
                  <span style={{ fontSize: 13, fontWeight: s.active ? 800 : 600, color: s.active ? INK : MUTE, whiteSpace: 'nowrap' }}>{s.l}</span>
                </div>
                {i < 3 && <div style={{ flex: 1, height: 2, background: LINE, margin: '0 16px' }} />}
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* ── Left: DB type ── */}
            <section style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 16, padding: '20px 24px' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: MUTE, letterSpacing: '0.08em', marginBottom: 14 }}>① DB 종류 선택</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {TABS.map(t => {
                  const info = DB_INFO[t.key];
                  return (
                    <button key={t.key} onClick={() => { setTab(t.key); setResult(null); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 12, background: tab === t.key ? BLUE_TINT : '#fff', border: tab === t.key ? `2px solid ${BLUE}` : `1px solid ${LINE}`, cursor: 'pointer', textAlign: 'left' }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: info.color + '18', color: info.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, letterSpacing: '-0.04em', flexShrink: 0 }}>
                        {info.short}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: INK }}>{t.label}</div>
                      </div>
                      {tab === t.key && (
                        <span style={{ width: 20, height: 20, borderRadius: '50%', background: BLUE, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, flexShrink: 0 }}>✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* ── Right: Connection form ── */}
            <section style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 16, padding: '20px 24px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: MUTE, letterSpacing: '0.08em' }}>② 연결 정보 입력</div>
                {tab === 'oracle-wallet' && (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6, background: '#FFF3D6', color: '#B26A00' }}>Wallet 지원</span>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
                {tab === 'postgresql' && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                      {F('Host', pg, setPg, 'host', 'text', 'localhost')}
                      {F('Port', pg, setPg, 'port', 'text', '5432')}
                    </div>
                    {F('Database', pg, setPg, 'dbname')}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {F('User ID', pg, setPg, 'user')}
                      {F('Password', pg, setPg, 'password', 'password')}
                    </div>
                  </>
                )}
                {tab === 'mysql' && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                      {F('Host', mysql, setMysql, 'host', 'text', 'localhost')}
                      {F('Port', mysql, setMysql, 'port', 'text', '3306')}
                    </div>
                    {F('Database', mysql, setMysql, 'dbname')}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {F('User ID', mysql, setMysql, 'user')}
                      {F('Password', mysql, setMysql, 'password', 'password')}
                    </div>
                  </>
                )}
                {tab === 'oracle-host' && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                      {F('Host', oraHost, setOraHost, 'host')}
                      {F('Port', oraHost, setOraHost, 'port', 'text', '1521')}
                    </div>
                    {F('Service Name (또는 SID)', oraHost, setOraHost, 'service_name')}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {F('User ID', oraHost, setOraHost, 'user')}
                      {F('Password', oraHost, setOraHost, 'password', 'password')}
                    </div>
                  </>
                )}
                {tab === 'oracle-tns' && (
                  <>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: SUB, marginBottom: 6 }}>TNS 문자열</div>
                      <textarea
                        value={oraTns.tns_string}
                        onChange={e => setOraTns(v => ({ ...v, tns_string: e.target.value }))}
                        placeholder={'① TNS명: ORCL\n② Easy Connect: 192.168.1.10:1521/ORCL\n③ Full descriptor: (DESCRIPTION=...)'}
                        rows={4}
                        style={{ width: '100%', padding: '10px 14px', background: BG, border: `1px solid ${LINE}`, borderRadius: 10, color: INK, fontSize: 13, outline: 'none', resize: 'vertical', lineHeight: 1.6, fontFamily: "'Pretendard', system-ui, sans-serif", boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {F('User ID', oraTns, setOraTns, 'user')}
                      {F('Password', oraTns, setOraTns, 'password', 'password')}
                    </div>
                  </>
                )}
                {tab === 'oracle-wallet' && (
                  <>
                    <div style={{ background: '#E7F8EF', border: '1px solid #A7F3CC', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#0F8B47', fontWeight: 600 }}>
                      💡 Wallet 폴더(cwallet.sso, tnsnames.ora, sqlnet.ora 등)를 모두 선택해 올려주세요
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: SUB, marginBottom: 6 }}>Wallet 파일들 (다중 선택)</div>
                      <input type="file" multiple onChange={e => setWalletFiles(Array.from(e.target.files))} style={{ ...INPUT_STYLE, height: 'auto', padding: '10px 14px' }} />
                      {walletFiles.length > 0 && <p style={{ fontSize: 11, color: '#0F8B47', marginTop: 6, fontWeight: 700 }}>✓ {walletFiles.length}개 파일 선택됨</p>}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {F('접속명 (TNS Alias)', oraWallet, setOraWallet, 'tns_alias', 'text', 'dqmdb_high')}
                      {F('Wallet 비밀번호 (선택)', oraWallet, setOraWallet, 'wallet_password', 'password')}
                      {F('DB User ID', oraWallet, setOraWallet, 'user')}
                      {F('DB Password', oraWallet, setOraWallet, 'password', 'password')}
                    </div>
                  </>
                )}
                {tab === 'file' && (
                  <>
                    <div style={{ background: BLUE_TINT, border: `1px solid #BDD6FA`, borderRadius: 10, padding: '10px 14px', fontSize: 12, color: BLUE, fontWeight: 600 }}>
                      💡 CSV 또는 Excel 파일을 업로드하면 자동으로 SQLite DB에 적재되어 진단할 수 있습니다
                    </div>
                    <label
                      style={{ display: 'block', border: `2px dashed ${LINE}`, borderRadius: 14, padding: '40px', textAlign: 'center', cursor: 'pointer', background: BG, transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = BLUE; e.currentTarget.style.background = BLUE_TINT; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = LINE; e.currentTarget.style.background = BG; }}
                    >
                      <div style={{ fontSize: 40, marginBottom: 10 }}>📁</div>
                      <div style={{ fontSize: 14, color: INK, fontWeight: 700, marginBottom: 4 }}>CSV 또는 Excel 파일 선택</div>
                      <div style={{ fontSize: 12, color: MUTE }}>.csv, .xls, .xlsx 지원</div>
                      <input type="file" accept=".csv,.xls,.xlsx" onChange={handleFile} style={{ display: 'none' }} />
                    </label>
                    {loading && (
                      <div style={{ textAlign: 'center', padding: '12px', background: BLUE_TINT, borderRadius: 10, fontSize: 13, color: BLUE, fontWeight: 700 }}>⏳ 업로드 중...</div>
                    )}
                  </>
                )}
              </div>

              {/* Result message */}
              {result && (
                <div style={{ marginTop: 14, padding: '12px 16px', borderRadius: 10, background: result.success ? '#E7F8EF' : '#FFEBEB', border: `1px solid ${result.success ? '#A7F3CC' : '#FCA5A5'}`, fontSize: 13, color: result.success ? '#0F8B47' : '#E53935', fontWeight: 600 }}>
                  {result.success ? '✓ ' : '✕ '}{result.message}
                  {result.success && <span style={{ marginLeft: 8, fontWeight: 700 }}>→ 진단 항목 설정으로 이동 중...</span>}
                </div>
              )}

              {/* Connect button */}
              {tab !== 'file' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <button onClick={() => navigate('/da')} style={{ height: 44, flex: 1, borderRadius: 10, background: '#fff', color: SUB, border: `1px solid ${LINE}`, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>취소</button>
                  <button onClick={handleConnect} disabled={loading}
                    style={{ height: 44, flex: 2, borderRadius: 10, background: loading ? LINE : BLUE, color: loading ? MUTE : '#fff', border: 'none', fontSize: 14, fontWeight: 800, cursor: loading ? 'default' : 'pointer', boxShadow: loading ? 'none' : '0 8px 16px rgba(49,130,246,0.25)' }}>
                    {loading ? '⏳ 연결 중...' : '연결하기 →'}
                  </button>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DAConnect;
