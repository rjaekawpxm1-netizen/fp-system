// ─── BA Project List · Toss Style ───
const ProjectListToss = () => {
  const BLUE = '#3182F6';
  const BLUE_TINT = '#EAF3FF';
  const INK = '#191F28';
  const SUB = '#4E5968';
  const MUTE = '#8B95A1';
  const LINE = '#F2F4F6';
  const BG = '#F9FAFB';

  const projects = [
    { name: '신용평가 시스템 재구축', system: '신용평가 v2', progress: 92, funcs: 312, fp: 1240, screens: 84, reqs: 156, date: '2026-04-12', tags: ['기능 312개', 'FP 1,240', '화면목록', '요구사항', 'WBS'] },
    { name: '공공 행정포털 통합', system: '행정포털', progress: 64, funcs: 218, fp: 842, screens: 56, reqs: 98, date: '2026-04-28', tags: ['기능 218개', 'FP 842', '화면목록', '요구사항'] },
    { name: 'AI 컨설팅 자동화 플랫폼', system: 'AX', progress: 38, funcs: 96, fp: 312, screens: 0, reqs: 42, date: '2026-05-02', tags: ['기능 96개', 'FP 312', '요구사항'] },
    { name: '제조 ERP 차세대 PoC', system: '', progress: 12, funcs: 28, fp: 0, screens: 0, reqs: 0, date: '2026-05-08', tags: ['기능 28개'] },
  ];

  const totalFP = projects.reduce((s, p) => s + p.fp, 0);
  const totalFuncs = projects.reduce((s, p) => s + p.funcs, 0);
  const totalCost = (totalFP * 605784 / 1e8).toFixed(1);
  const progressColor = (p) => p < 30 ? '#E53935' : p < 70 ? '#F5A623' : '#0F8B47';

  return (
    <div style={{
      width: '100%', height: '100%',
      background: BG,
      fontFamily: "'Pretendard', 'Apple SD Gothic Neo', system-ui, sans-serif",
      color: INK,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* ─── Top Header (same vocab) ─── */}
      <header style={{
        height: 64, background: '#fff',
        borderBottom: `1px solid ${LINE}`,
        display: 'flex', alignItems: 'center', padding: '0 24px', gap: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
            { l: 'DA', active: false },
            { l: 'TA', soon: true },
          ].map(n => (
            <button key={n.l} style={{
              height: 40, padding: '0 18px', borderRadius: 999,
              background: n.active ? BLUE_TINT : 'transparent',
              color: n.active ? BLUE : (n.soon ? MUTE : SUB),
              border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 800, letterSpacing: '-0.01em',
              opacity: n.soon ? 0.6 : 1,
            }}>{n.l}{n.soon && <span style={{ fontSize: 10, marginLeft: 4, fontWeight: 600 }}>준비중</span>}</button>
          ))}
        </nav>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            height: 40, padding: '0 16px',
            background: BG, borderRadius: 999, width: 240,
          }}>
            <span style={{ color: MUTE, fontSize: 14 }}>⌕</span>
            <input placeholder="프로젝트 검색" readOnly
              style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1, fontSize: 13, color: SUB, fontFamily: 'inherit' }} />
            <span style={{ fontSize: 11, color: MUTE, padding: '2px 6px', background: '#fff', borderRadius: 4, fontWeight: 600 }}>⌘K</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', background: BLUE, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 800,
            }}>준수</div>
            <div style={{ lineHeight: 1.15 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>김준수 님</div>
              <div style={{ fontSize: 11, color: MUTE, fontWeight: 500 }}>BA팀 · 책임</div>
            </div>
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
              fontSize: 12, fontWeight: 800,
              marginBottom: 16,
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
              <button style={{
                height: 48, padding: '0 22px', borderRadius: 999,
                background: BLUE, color: '#fff', border: 'none',
                fontSize: 14, fontWeight: 800, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 8,
                boxShadow: '0 8px 20px rgba(49,130,246,0.28)',
              }}>+ 새 프로젝트 만들기</button>
              <button style={{
                height: 48, padding: '0 20px', borderRadius: 999,
                background: '#fff', color: INK, border: `1px solid ${LINE}`,
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}>가이드 보기 →</button>
            </div>
          </div>

          {/* Stats */}
          <div style={{
            position: 'relative',
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1,
            background: LINE, borderRadius: 14, overflow: 'hidden',
            border: `1px solid ${LINE}`,
          }}>
            {[
              { l: '프로젝트', v: projects.length, u: '개' },
              { l: '총 기능', v: totalFuncs.toLocaleString(), u: '개' },
              { l: '총 FP', v: totalFP.toLocaleString(), u: 'FP' },
              { l: '개발비', v: totalCost, u: '억' },
            ].map(k => (
              <div key={k.l} style={{ background: '#fff', padding: '14px 22px', minWidth: 100, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: MUTE, fontWeight: 600, marginBottom: 4, letterSpacing: '-0.01em' }}>{k.l}</div>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.025em', color: INK }}>
                  {k.v}<span style={{ fontSize: 11, color: MUTE, marginLeft: 2, fontWeight: 600 }}>{k.u}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Filter row ─── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 12,
        }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {['전체', '진행중', '완료', '대기'].map((c, i) => (
              <button key={c} style={{
                height: 36, padding: '0 16px', borderRadius: 999,
                background: i === 0 ? BLUE_TINT : '#fff',
                color: i === 0 ? BLUE : SUB,
                border: i === 0 ? 'none' : `1px solid ${LINE}`,
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                letterSpacing: '-0.01em',
              }}>{c} {i === 0 && <span style={{ marginLeft: 4 }}>{projects.length}</span>}</button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: SUB, fontWeight: 600 }}>
            <span>최신순</span>
            <span style={{ color: MUTE }}>▾</span>
          </div>
        </div>

        {/* ─── Project list ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {projects.map((p, i) => (
            <div key={i} style={{
              background: '#fff',
              border: `1px solid ${LINE}`,
              borderRadius: 16,
              padding: '20px 24px',
              display: 'flex', alignItems: 'center', gap: 24,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}>
              {/* Left: name + progress + tags */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: INK, letterSpacing: '-0.02em' }}>{p.name}</span>
                  {p.system && (
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
                      background: BLUE_TINT, color: BLUE,
                    }}>{p.system}</span>
                  )}
                  <span style={{ fontSize: 12, color: MUTE, marginLeft: 'auto', fontWeight: 500 }}>{p.date}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <div style={{ flex: 1, height: 6, background: LINE, borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{
                      width: p.progress + '%', height: '100%',
                      background: progressColor(p.progress), borderRadius: 999,
                    }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: progressColor(p.progress), minWidth: 36, letterSpacing: '-0.01em' }}>
                    {p.progress}%
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {p.tags.map(t => (
                    <span key={t} style={{
                      fontSize: 11.5, fontWeight: 700,
                      padding: '4px 10px', borderRadius: 999,
                      background: BG, color: SUB, border: `1px solid ${LINE}`,
                      letterSpacing: '-0.01em',
                    }}>{t}</span>
                  ))}
                </div>
              </div>

              {/* Right: actions */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button style={{
                  height: 40, padding: '0 18px', borderRadius: 10,
                  background: BLUE, color: '#fff', border: 'none',
                  fontSize: 13, fontWeight: 800, cursor: 'pointer',
                  letterSpacing: '-0.01em',
                }}>열기 →</button>
                <button style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: '#fff', color: SUB, border: `1px solid ${LINE}`,
                  fontSize: 14, cursor: 'pointer',
                }}>⎘</button>
                <button style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: '#fff', color: MUTE, border: `1px solid ${LINE}`,
                  fontSize: 16, cursor: 'pointer',
                }}>⋯</button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer note */}
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
          <button style={{
            height: 36, padding: '0 14px', borderRadius: 999,
            background: '#fff', color: BLUE, border: 'none',
            fontSize: 12, fontWeight: 800, cursor: 'pointer',
          }}>가이드 보기 →</button>
        </div>
      </div>
    </div>
  );
};

window.ProjectListToss = ProjectListToss;
