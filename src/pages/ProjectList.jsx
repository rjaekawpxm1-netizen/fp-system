import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const calcProgress = (project) => {
  const checks = [
    !!project.systemName,
    (project.functions || []).length > 0,
    (project.fpList || []).length > 0,
    (project.screenList || []).length > 0,
    (project.reqList || []).length > 0,
    (project.crudMatrix?.matrix || []).length > 0,
    (project.ifList || []).length > 0,
    (project.wbsList || []).length > 0,
    (project.traceList || []).length > 0,
    (project.tcList || []).length > 0,
  ];
  return Math.round(checks.filter(Boolean).length / checks.length * 100);
};

const ProjectList = ({ projects, onCreateProject, onDeleteProject, onCopyProject }) => {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [view, setView] = useState('list');

  const handleCreate = () => {
    if (!name.trim()) return alert('프로젝트명을 입력하세요.');
    onCreateProject(name.trim());
    setName('');
    setShowForm(false);
  };

  const handleCopy = (e, project) => {
    e.stopPropagation();
    const newName = prompt('복사할 프로젝트명:', project.name + ' (복사본)');
    if (!newName) return;
    onCopyProject(project, newName);
  };

  const totalFP = projects.reduce((sum, p) => sum + Number(p.fpSummary?.newDev || 0), 0);
  const totalFuncs = projects.reduce((sum, p) => sum + (p.functions || []).length, 0);
  const totalDevCost = Math.round(totalFP * 605784);

  const btnPrimary = { background:'#1d4ed8', color:'#fff', border:'none', borderRadius:7, padding:'8px 14px', fontSize:12, fontWeight:600, cursor:'pointer' };
  const btnSecondary = { background:'#fff', color:'#374151', border:'1px solid #e5e7eb', borderRadius:7, padding:'8px 12px', fontSize:12, cursor:'pointer' };
  const btnDanger = { background:'#fff1f2', color:'#e11d48', border:'1px solid #fecdd3', borderRadius:7, padding:'8px 12px', fontSize:12, cursor:'pointer' };
  const card = { background:'#fff', border:'1px solid #e5e7eb', borderRadius:12 };

  return (
    <div style={{ minHeight:'100vh', background:'#f5f4f0', fontFamily:"'Pretendard',-apple-system,'Malgun Gothic',sans-serif" }}>

      {/* 헤더 */}
      <div style={{ background:'#1e3a8a', borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'0 32px', height:52, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:28, height:28, background:'#3b6cf8', borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, color:'#fff' }}>BA</div>
          <span style={{ color:'#fff', fontWeight:700, fontSize:14 }}>BA 도우미</span>
          <span style={{ color:'rgba(255,255,255,0.5)', fontSize:10, padding:'2px 7px', background:'rgba(255,255,255,0.05)', borderRadius:4 }}>2025 SW사업 대가산정 가이드</span>
        </div>
        <button onClick={()=>navigate('/')} style={{ ...btnSecondary, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'rgba(255,255,255,0.6)', fontSize:11, padding:'5px 10px' }}>← 홈</button>
      </div>

      <div style={{ maxWidth:1060, margin:'0 auto', padding:'24px 20px' }}>

        {/* 히어로 */}
        <div style={{ background:'#1e3a8a', borderRadius:14, padding:'26px 30px', marginBottom:18, position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', right:-60, top:-60, width:200, height:200, background:'rgba(59,108,248,0.07)', borderRadius:'50%' }}/>
          <div style={{ position:'absolute', right:60, bottom:-70, width:150, height:150, background:'rgba(59,108,248,0.04)', borderRadius:'50%' }}/>
          <div style={{ position:'relative', display:'flex', justifyContent:'space-between', alignItems:'center', gap:20, flexWrap:'wrap' }}>
            <div>
              <h1 style={{ margin:'0 0 5px', fontSize:20, fontWeight:800, color:'#fff', letterSpacing:'-0.5px' }}>SW사업 BA 도우미</h1>
              <p style={{ margin:'0 0 16px', fontSize:12, color:'rgba(255,255,255,0.6)', lineHeight:1.6 }}>기능점수 산정 · 개발비 산출 · AI 기반 자동 산출물 생성</p>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={()=>setShowForm(true)} style={{ background:'#3b6cf8', color:'#fff', border:'none', borderRadius:7, padding:'8px 16px', fontSize:13, fontWeight:700, cursor:'pointer' }}>+ 새 프로젝트</button>
                <div style={{ display:'flex', border:'1px solid rgba(255,255,255,0.1)', borderRadius:7, overflow:'hidden' }}>
                  {[['list','목록'],['dashboard','대시보드']].map(([k,l])=>(
                    <button key={k} onClick={()=>setView(k)} style={{ padding:'8px 13px', fontSize:11, fontWeight:500, border:'none', cursor:'pointer', background:view===k?'rgba(255,255,255,0.12)':'transparent', color:view===k?'#fff':'#6b7280' }}>{l}</button>
                  ))}
                </div>
              </div>
            </div>
            {projects.length > 0 && (
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {[['프로젝트',projects.length,'개'],['총 기능',totalFuncs.toLocaleString(),'개'],['총 FP',totalFP.toFixed(0),'FP'],['개발비',(totalDevCost/100000000).toFixed(1),'억']].map(([l,v,u])=>(
                  <div key={l} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'11px 14px', textAlign:'center', minWidth:68 }}>
                    <div style={{ fontSize:17, fontWeight:800, color:'#fff', lineHeight:1 }}>{v}<span style={{ fontSize:10, fontWeight:400, color:'rgba(255,255,255,0.6)' }}>{u}</span></div>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.5)', marginTop:3 }}>{l}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 새 프로젝트 폼 */}
        {showForm && (
          <div style={{ ...card, padding:'16px 20px', marginBottom:14, borderColor:'#bfdbfe' }}>
            <p style={{ margin:'0 0 10px', fontWeight:700, color:'#1e40af', fontSize:12 }}>새 프로젝트 생성</p>
            <div style={{ display:'flex', gap:8 }}>
              <input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleCreate()}
                placeholder="프로젝트명" autoFocus
                style={{ flex:1, padding:'8px 12px', borderRadius:7, border:'1.5px solid #93c5fd', fontSize:13, outline:'none', fontFamily:'inherit' }}/>
              <button onClick={handleCreate} style={btnPrimary}>생성</button>
              <button onClick={()=>setShowForm(false)} style={btnSecondary}>취소</button>
            </div>
          </div>
        )}

        {/* 대시보드 */}
        {view === 'dashboard' && projects.length > 0 && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
            <div style={{ ...card, padding:'18px 20px' }}>
              <p style={{ margin:'0 0 12px', fontSize:12, fontWeight:700, color:'#111827' }}>프로젝트 완성도</p>
              <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                {projects.map(p=>{
                  const prog = calcProgress(p);
                  const col = prog<30?'#ef4444':prog<70?'#f59e0b':'#10b981';
                  return (
                    <div key={p.id} style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', padding:'5px 7px', borderRadius:6 }}
                      onClick={()=>navigate('/project/'+p.id)}
                      onMouseEnter={e=>e.currentTarget.style.background='#f9fafb'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <div style={{ minWidth:150, fontSize:11, fontWeight:600, color:'#374151', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</div>
                      <div style={{ flex:1, background:'#f3f4f6', borderRadius:20, height:5, overflow:'hidden' }}>
                        <div style={{ width:prog+'%', height:'100%', background:col, borderRadius:20 }}/>
                      </div>
                      <div style={{ fontSize:10, fontWeight:700, color:col, minWidth:30 }}>{prog}%</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ ...card, padding:'18px 20px' }}>
              <p style={{ margin:'0 0 12px', fontSize:12, fontWeight:700, color:'#111827' }}>산출물 현황</p>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:7 }}>
                {[['기능목록',p=>(p.functions||[]).length>0],['FP산정표',p=>(p.fpList||[]).length>0],['화면목록',p=>(p.screenList||[]).length>0],['요구사항',p=>(p.reqList||[]).length>0],['CRUD',p=>(p.crudMatrix?.matrix||[]).length>0],['WBS',p=>(p.wbsList||[]).length>0]].map(([label,fn])=>{
                  const done = projects.filter(fn).length;
                  const pct = projects.length>0?Math.round(done/projects.length*100):0;
                  return (
                    <div key={label} style={{ background:'#f9fafb', borderRadius:7, padding:'9px', textAlign:'center' }}>
                      <div style={{ fontSize:15, fontWeight:800, color:pct>0?'#111827':'#d1d5db' }}>{done}<span style={{ fontSize:9, color:'rgba(255,255,255,0.7)' }}>/{projects.length}</span></div>
                      <div style={{ fontSize:9, color:'rgba(255,255,255,0.6)', margin:'2px 0 5px' }}>{label}</div>
                      <div style={{ background:'#e5e7eb', borderRadius:20, height:3, overflow:'hidden' }}>
                        <div style={{ width:pct+'%', height:'100%', background:pct===100?'#10b981':pct>0?'#f59e0b':'transparent', borderRadius:20 }}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 목록 */}
        {view === 'list' && (
          projects.length === 0 ? (
            <div style={{ ...card, padding:'60px 40px', textAlign:'center', border:'2px dashed #e5e7eb' }}>
              <div style={{ fontSize:36, marginBottom:10 }}>📋</div>
              <p style={{ fontSize:15, fontWeight:700, color:'#111827', marginBottom:5 }}>아직 프로젝트가 없습니다</p>
              <p style={{ fontSize:12, color:'rgba(255,255,255,0.7)', marginBottom:18 }}>새 프로젝트를 만들어 시작하세요</p>
              <button onClick={()=>setShowForm(true)} style={{ ...btnPrimary, padding:'9px 22px', fontSize:13 }}>+ 첫 프로젝트 만들기</button>
            </div>
          ) : (
            <div>
              <p style={{ fontSize:11, color:'rgba(255,255,255,0.7)', margin:'0 0 10px' }}>총 {projects.length}개 프로젝트</p>
              <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                {projects.map(project=>{
                  const progress = calcProgress(project);
                  const pc = progress<30?'#ef4444':progress<70?'#f59e0b':'#10b981';
                  const funcCount = (project.functions||[]).length;
                  const fp = Number(project.fpSummary?.newDev||0);
                  const badges = [
                    funcCount>0&&{label:`기능 ${funcCount}개`,bg:'#f0fdf4',color:'#16a34a',border:'#86efac'},
                    fp>0&&{label:`FP ${fp.toFixed(0)}`,bg:'#fdf2f8',color:'#9d174d',border:'#f9a8d4'},
                    (project.screenList||[]).length>0&&{label:'화면목록',bg:'#eff6ff',color:'#1e40af',border:'#93c5fd'},
                    (project.reqList||[]).length>0&&{label:'요구사항',bg:'#fff7ed',color:'#9a3412',border:'#fdba74'},
                    (project.wbsList||[]).length>0&&{label:'WBS',bg:'#f0f9ff',color:'#0369a1',border:'#7dd3fc'},
                  ].filter(Boolean);

                  return (
                    <div key={project.id} onClick={()=>navigate('/project/'+project.id)}
                      style={{ ...card, padding:'14px 18px', cursor:'pointer', transition:'all 0.12s' }}
                      onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 4px 14px rgba(0,0,0,0.07)';e.currentTarget.style.borderColor='#bfdbfe';}}
                      onMouseLeave={e=>{e.currentTarget.style.boxShadow='none';e.currentTarget.style.borderColor='#e5e7eb';}}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:7 }}>
                            <p style={{ fontWeight:700, fontSize:13, margin:0, color:'#111827', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{project.name}</p>
                            {project.systemName && (
                              <span style={{ fontSize:10, padding:'2px 7px', background:'#eff6ff', color:'#2563eb', borderRadius:4, fontWeight:500, whiteSpace:'nowrap', flexShrink:0 }}>{project.systemName}</span>
                            )}
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:badges.length?7:0 }}>
                            <div style={{ flex:1, background:'#f3f4f6', borderRadius:20, height:4, overflow:'hidden' }}>
                              <div style={{ width:progress+'%', height:'100%', background:pc, borderRadius:20 }}/>
                            </div>
                            <span style={{ fontSize:10, fontWeight:700, color:pc, minWidth:26 }}>{progress}%</span>
                            <span style={{ fontSize:10, color:'#d1d5db' }}>{new Date(project.createdAt).toLocaleDateString('ko-KR')}</span>
                          </div>
                          {badges.length>0 && (
                            <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                              {badges.map((b,i)=>(
                                <span key={i} style={{ fontSize:10, padding:'2px 7px', borderRadius:20, background:b.bg, color:b.color, border:`1px solid ${b.border}`, fontWeight:500 }}>{b.label}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div style={{ display:'flex', gap:5, flexShrink:0 }} onClick={e=>e.stopPropagation()}>
                          <button onClick={()=>navigate('/project/'+project.id)} style={btnPrimary}>열기</button>
                          <button onClick={e=>handleCopy(e,project)} style={btnSecondary}>복사</button>
                          <button onClick={()=>{if(window.confirm('삭제하시겠습니까?'))onDeleteProject(project.id);}} style={btnDanger}>삭제</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        )}

        <div style={{ marginTop:28, paddingTop:14, borderTop:'1px solid #e5e7eb', display:'flex', justifyContent:'space-between' }}>
          <p style={{ fontSize:10, color:'rgba(255,255,255,0.7)', margin:0 }}>BA 도우미 · 2025 SW사업 대가산정 가이드 · FP 단가 605,784원</p>
          <p style={{ fontSize:10, color:'rgba(255,255,255,0.7)', margin:0 }}>Powered by Claude AI</p>
        </div>
      </div>
    </div>
  );
};

export default ProjectList;
