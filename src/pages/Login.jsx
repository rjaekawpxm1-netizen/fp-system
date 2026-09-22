import { useState } from 'react';
import { supabase } from '../utils/supabase';

const Login = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const sendMagicLink = async (event) => {
    event.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    setMessage('');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setSending(false);
    setMessage(error ? `로그인 링크 전송 실패: ${error.message}` : '이메일로 보낸 로그인 링크를 확인하세요.');
  };

  return (
    <main style={{minHeight:'100vh',display:'grid',placeItems:'center',background:'#f8fafc',fontFamily:"'Pretendard',sans-serif"}}>
      <form onSubmit={sendMagicLink} style={{width:360,padding:28,borderRadius:14,background:'#fff',boxShadow:'0 10px 30px rgba(15,23,42,.1)'}}>
        <h1 style={{margin:'0 0 8px',fontSize:22}}>fp-system 로그인</h1>
        <p style={{margin:'0 0 20px',fontSize:13,color:'#64748b'}}>프로젝트와 AI API를 보호하기 위해 인증이 필요합니다.</p>
        <label htmlFor="login-email" style={{display:'block',fontSize:12,fontWeight:700,marginBottom:6}}>이메일</label>
        <input id="login-email" type="email" required value={email} onChange={e=>setEmail(e.target.value)}
          style={{boxSizing:'border-box',width:'100%',padding:'10px 12px',border:'1px solid #cbd5e1',borderRadius:8,fontSize:14}} />
        <button disabled={sending} style={{width:'100%',marginTop:12,padding:'10px 12px',border:0,borderRadius:8,background:'#2563eb',color:'#fff',fontWeight:700,cursor:'pointer'}}>
          {sending ? '전송 중...' : '로그인 링크 받기'}
        </button>
        {message && <p role="status" style={{fontSize:12,color:'#475569',margin:'12px 0 0'}}>{message}</p>}
      </form>
    </main>
  );
};

export default Login;
