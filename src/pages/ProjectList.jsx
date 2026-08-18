import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { color, button, card } from '../styles/tokens';
import GuideModal from './GuideModal';

const { blue: BLUE, blueTint: BLUE_TINT, ink: INK, sub: SUB, mute: MUTE, line: LINE, bg: BG } = color;

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
  const [filter, setFilter] = useState('전체');
  const [showGuide, setShowGuide] = useState(false);

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
  const progressColor = (p) => p < 30 ? '#E53935' : p < 70 ? '#F5A623' : '#0F8B47';

  const filterCount = (c) => {
    if (c === '전체') return projects.length;
    return projects.filter(p => {
      const pr = calcProgress(p);
      if (c === '완료') return pr === 100;
      if (c === '진행중') return pr > 0 && pr < 100;
      if (c === '대기') return pr === 0;
      return false;
    }).length;
  };

  const filteredProjects = projects.filter(p => {
    const pr = calcProgress(p);
    if (filter === '전체') return true;
    if (filter === '완료') return pr === 100;
    if (filter === '진행중') return pr > 0 && pr < 100;
    if (filter === '대기') return pr === 0;
    return true;
  });

  return (
    <div style={{
      minHeight: '100vh',
      background: BG,
      fontFamily: "'Pretendard', 'Apple SD Gothic Neo', system-ui, sans-serif",
      color: INK,
      display: 'flex',
      flexDirection: 'column',
    }}>

      {/* ─── Header ─── */}
      <header style={{
        height: 64, background: '#fff',
        borderBottom: `1px solid ${LINE}`,
        display: 'flex', alignItems: 'center', padding: '0 24px', gap: 24,
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div
          onClick={() => navigate('/')}
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
        >
          <div style={{
            width: 32, height: 32, borderRadius: 10, background: BLUE,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 900, fontSize: 15, letterSpacing: '-0.04em',
          }}>j</div>
          <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em' }}>junsu</span>
        </div>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 16 }}>
          {[
            { l: 'BA', active: true },
            { l: 'AA', soon: true },
            { l: 'DA', path: '/da' },
            { l: 'TA', soon: true },
          ].map(n => (
            <button
              key={n.l}
              onClick={() => !n.soon && n.path && navigate(n.path)}
              style={{
                height: 40, padding: '0 18px', borderRadius: 999,
                background: n.active ? BLUE_TINT : 'transparent',
                color: n.active ? BLUE : (n.soon ? MUTE : SUB),
                border: 'none', cursor: n.soon ? 'default' : 'pointer',
                fontSize: 14, fontWeight: 800, letterSpacing: '-0.01em',
                opacity: n.soon ? 0.6 : 1,
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}
            >
              {n.l}
              {n.soon && <span style={{ fontSize: 10, fontWeight: 600 }}>준비중</span>}
            </button>
          ))}
        </nav>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            height: 40, padding: '0 16px',
            background: BG, borderRadius: 999, width: 240,
          }}>
            <span style={{ color: MUTE, fontSize: 14 }}>⌕</span>
            <input
              placeholder="프로젝트 검색"
              style={{
                border: 'none', background: 'transparent', outline: 'none',
                flex: 1, fontSize: 13, color: SUB, fontFamily: 'inherit',
              }}
            />
            <span style={{ fontSize: 11, color: MUTE, padding: '2px 6px', background: '#fff', borderRadius: 4, fontWeight: 600 }}>⌘K</span>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 32px 40px', width: '100%', boxSizing: 'border-box' }}>

        {/* breadcrumb */}
        <div style={{ fontSize: 12, color: MUTE, fontWeight: 600, marginBottom: 12 }}>
          홈 · <span style={{ color: BLUE, fontWeight: 700 }}>BA 도우미</span>
        </div>

        {/* ─── Hero ─── */}
        <section style={{
          background: '#fff',
          border: `1px solid ${LINE}`,
          borderRadius: 20,
          padding: '32px 36px',
          marginBottom: 16,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24,
          position: 'relative', overflow: 'hidden',
        }}>
          {/* soft blob */}
          <div style={{
            position: 'absolute', top: -80, right: -40,
            width: 280, height: 280, borderRadius: '50%',
            background: BLUE_TINT, opacity: 0.6, pointerEvents: 'none',
          }} />

          <div style={{ position: 'relative', flex: 1 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '5px 12px', borderRadius: 999,
              background: BLUE_TINT, color: BLUE,
              fontSize: 12, fontWeight: 800, marginBottom: 16,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: BLUE }} />
              2025 SW사업 대가산정 가이드
            </div>
            <h1 style={{ margin: 0, fontSize: 36, fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1.15 }}>
              BA 도우미
            </h1>
            <p style={{ margin: '8px 0 24px', fontSize: 15, color: SUB, fontWeight: 500, lineHeight: 1.55, maxWidth: 460 }}>
              기능점수 산정부터 개발비 산출까지,<br />
              AI가 자동으로 도와드려요.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowForm(true)}
                style={{
                  height: 48, padding: '0 22px', borderRadius: 999,
                  background: BLUE, color: '#fff', border: 'none',
                  fontSize: 14, fontWeight: 800, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  boxShadow: '0 8px 20px rgba(49,130,246,0.28)',
                }}
              >+ 새 프로젝트 만들기</button>
              <button onClick={() => setShowGuide(true)} style={{
                height: 48, padding: '0 20px', borderRadius: 999,
                background: '#fff', color: INK, border: `1px solid ${LINE}`,
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}>가이드 보기 →</button>
            </div>
          </div>

          {/* Stats */}
          {projects.length > 0 && (
            <div style={{
              position: 'relative',
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1,
              background: LINE, borderRadius: 14, overflow: 'hidden',
              border: `1px solid ${LINE}`, flexShrink: 0,
            }}>
              {[
                { l: '프로젝트', v: projects.length, u: '개' },
                { l: '총 기능', v: totalFuncs.toLocaleString(), u: '개' },
                { l: '총 FP', v: Number(totalFP).toFixed(0), u: 'FP' },
                { l: '개발비', v: (totalDevCost / 1e8).toFixed(1), u: '억' },
              ].map(k => (
                <div key={k.l} style={{ background: '#fff', padding: '14px 22px', minWidth: 100, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: MUTE, fontWeight: 600, marginBottom: 4, letterSpacing: '-0.01em' }}>{k.l}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.025em', color: INK }}>
                    {k.v}<span style={{ fontSize: 11, color: MUTE, marginLeft: 2, fontWeight: 600 }}>{k.u}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ─── New project form ─── */}
        {showForm && (
          <div style={{
            background: '#fff', border: `1.5px solid ${BLUE}`,
            borderRadius: 14, padding: '16px 20px', marginBottom: 12,
          }}>
            <p style={{ margin: '0 0 10px', fontWeight: 800, color: BLUE, fontSize: 13, letterSpacing: '-0.01em' }}>새 프로젝트 생성</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                placeholder="프로젝트명을 입력하세요"
                autoFocus
                style={{
                  flex: 1, height: 42, padding: '0 14px',
                  borderRadius: 10, border: `1px solid ${LINE}`,
                  background: BG, fontSize: 13, fontWeight: 600,
                  outline: 'none', fontFamily: 'inherit', color: INK,
                  letterSpacing: '-0.01em',
                }}
              />
              <button onClick={handleCreate} style={{
                height: 42, padding: '0 20px', borderRadius: 10,
                background: BLUE, color: '#fff', border: 'none',
                fontSize: 13, fontWeight: 800, cursor: 'pointer',
              }}>생성</button>
              <button onClick={() => { setShowForm(false); setName(''); }} style={{
                height: 42, padding: '0 16px', borderRadius: 10,
                background: '#fff', color: SUB, border: `1px solid ${LINE}`,
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}>취소</button>
            </div>
          </div>
        )}

        {/* ─── Filter row ─── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 12,
        }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {['전체', '진행중', '완료', '대기'].map(c => {
              const active = filter === c;
              return (
                <button key={c} onClick={() => setFilter(c)} style={{
                  ...button.chip(active),
                  height: 36, padding: '0 16px',
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                }}>
                  {c}
                  <span style={{ fontSize: 11, fontWeight: 800, color: active ? BLUE : MUTE }}>{filterCount(c)}</span>
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: SUB, fontWeight: 600 }}>
            <span>최신순</span>
            <span style={{ color: MUTE }}>▾</span>
          </div>
        </div>

        {/* ─── Project list ─── */}
        {projects.length === 0 ? (
          <div style={{
            background: '#fff', border: `2px dashed ${LINE}`,
            borderRadius: 16, padding: '60px 40px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
            <p style={{ fontSize: 16, fontWeight: 800, color: INK, margin: '0 0 6px', letterSpacing: '-0.02em' }}>아직 프로젝트가 없어요</p>
            <p style={{ fontSize: 14, color: MUTE, margin: '0 0 24px', fontWeight: 500 }}>새 프로젝트를 만들어 시작해보세요</p>
            <button onClick={() => setShowForm(true)} style={{
              height: 48, padding: '0 24px', borderRadius: 999,
              background: BLUE, color: '#fff', border: 'none',
              fontSize: 14, fontWeight: 800, cursor: 'pointer',
              boxShadow: '0 8px 20px rgba(49,130,246,0.28)',
            }}>+ 첫 프로젝트 만들기</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredProjects.map(project => {
              const progress = calcProgress(project);
              const funcCount = (project.functions || []).length;
              const fp = Number(project.fpSummary?.newDev || 0);
              const tags = [
                funcCount > 0 && `기능 ${funcCount}개`,
                fp > 0 && `FP ${fp.toFixed(0)}`,
                (project.screenList || []).length > 0 && '화면목록',
                (project.reqList || []).length > 0 && '요구사항',
                (project.wbsList || []).length > 0 && 'WBS',
              ].filter(Boolean);

              return (
                <div
                  key={project.id}
                  onClick={() => navigate('/project/' + project.id)}
                  style={{
                    background: '#fff',
                    border: `1px solid ${LINE}`,
                    borderRadius: 16,
                    padding: '20px 24px',
                    display: 'flex', alignItems: 'center', gap: 24,
                    cursor: 'pointer',
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = BLUE}
                  onMouseLeave={e => e.currentTarget.style.borderColor = LINE}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: INK, letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {project.name}
                      </span>
                      {project.systemName && (
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
                          background: BLUE_TINT, color: BLUE, flexShrink: 0,
                        }}>{project.systemName}</span>
                      )}
                      <span style={{ fontSize: 12, color: MUTE, marginLeft: 'auto', fontWeight: 500, flexShrink: 0 }}>
                        {project.createdAt ? new Date(project.createdAt).toLocaleDateString('ko-KR') : ''}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: tags.length ? 10 : 0 }}>
                      <div style={{ flex: 1, height: 6, background: LINE, borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{
                          width: progress + '%', height: '100%',
                          background: progressColor(progress), borderRadius: 999,
                        }} />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 800, color: progressColor(progress), minWidth: 36, letterSpacing: '-0.01em' }}>
                        {progress}%
                      </span>
                    </div>

                    {tags.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {tags.map(t => (
                          <span key={t} style={{
                            fontSize: 11.5, fontWeight: 700,
                            padding: '4px 10px', borderRadius: 999,
                            background: BG, color: SUB, border: `1px solid ${LINE}`,
                            letterSpacing: '-0.01em',
                          }}>{t}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => navigate('/project/' + project.id)}
                      style={{
                        height: 40, padding: '0 18px', borderRadius: 10,
                        background: BLUE, color: '#fff', border: 'none',
                        fontSize: 13, fontWeight: 800, cursor: 'pointer',
                        letterSpacing: '-0.01em',
                      }}>열기 →</button>
                    <button
                      onClick={e => handleCopy(e, project)}
                      style={{
                        width: 40, height: 40, borderRadius: 10,
                        background: '#fff', color: SUB, border: `1px solid ${LINE}`,
                        fontSize: 16, cursor: 'pointer',
                      }}>⎘</button>
                    <button
                      onClick={() => { if (window.confirm('프로젝트를 삭제하시겠어요?')) onDeleteProject(project.id); }}
                      style={{
                        width: 40, height: 40, borderRadius: 10,
                        background: '#fff', color: '#E53935', border: '1px solid #FFCDD2',
                        fontSize: 18, cursor: 'pointer',
                      }}>×</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── Footer help card ─── */}
        <div style={{
          marginTop: 28, padding: '20px 24px',
          background: BLUE_TINT, borderRadius: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 22 }}>💡</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: BLUE, letterSpacing: '-0.01em' }}>처음이신가요?</div>
              <div style={{ fontSize: 12, color: SUB, marginTop: 2, fontWeight: 500, lineHeight: 1.6, maxWidth: 520 }}>
                BA 도우미는 2025 SW사업 대가산정 가이드 기준으로 작동해요.<br />
                FP 단가 605,784원이 적용됩니다.
              </div>
            </div>
          </div>
          <button onClick={() => setShowGuide(true)} style={{
            height: 36, padding: '0 14px', borderRadius: 999,
            background: '#fff', color: BLUE, border: 'none',
            fontSize: 12, fontWeight: 800, cursor: 'pointer',
          }}>가이드 보기 →</button>
        </div>

      </div>

      {showGuide && <GuideModal onClose={() => setShowGuide(false)} />}
    </div>
  );
};

export default ProjectList;
