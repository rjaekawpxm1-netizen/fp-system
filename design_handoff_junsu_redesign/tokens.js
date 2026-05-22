// ─────────────────────────────────────────────────────────
// junsu · 디자인 토큰 (D · Toss Style)
// 사용법:
//   import { color, radius, font, size, button, card } from '@/styles/tokens';
//
//   <div style={{ background: color.blueTint, borderRadius: radius.md, padding: 20 }}>
//   <button style={button.primary}>저장</button>
// ─────────────────────────────────────────────────────────

export const color = {
  // Primary
  blue:      '#3182F6',
  blueTint:  '#EAF3FF',

  // Neutral
  ink:       '#191F28',  // 본문 / 헤드라인
  sub:       '#4E5968',  // 보조 텍스트
  mute:      '#8B95A1',  // 캡션 / placeholder
  line:      '#F2F4F6',  // 보더
  bg:        '#F9FAFB',  // 회색 배경
  surface:   '#FFFFFF',  // 카드 배경

  // Status
  success:   '#0F8B47',  successBg: '#E7F8EF',
  warning:   '#B26A00',  warningBg: '#FFF3D6',
  danger:    '#E53935',  dangerBg:  '#FFEBEB',

  // BA/AA/DA/TA accents
  ba: '#3182F6',  baTint: '#EAF3FF',
  aa: '#7C3AED',  aaTint: '#F3EEFE',
  da: '#0F8B47',  daTint: '#E7F8EF',
  ta: '#D97706',  taTint: '#FFF3D6',
};

export const radius = {
  sm: 8,    // 작은 칩, 작은 인풋
  md: 10,   // 일반 버튼, 인풋
  lg: 14,   // 카드, 리스트
  xl: 16,   // 큰 카드, 히어로
  pill: 999, // 둥근 필 (액션 버튼, 뱃지)
};

export const font = {
  family: "'Pretendard', 'Apple SD Gothic Neo', system-ui, sans-serif",
  mono: "'SF Mono', ui-monospace, monospace",

  // size / weight 한 쌍
  display: { fontSize: 48, fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1.1 },
  h1:      { fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em',  lineHeight: 1.2 },
  h2:      { fontSize: 22, fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.3 },
  h3:      { fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em',  lineHeight: 1.4 },
  body:    { fontSize: 14, fontWeight: 500, letterSpacing: '-0.01em',  lineHeight: 1.6 },
  bodyB:   { fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em',  lineHeight: 1.5 },
  caption: { fontSize: 12, fontWeight: 600, letterSpacing: '-0.01em',  lineHeight: 1.5, color: color.mute },
  label:   { fontSize: 11, fontWeight: 800, letterSpacing: '0.08em',   color: color.mute, textTransform: 'uppercase' },
};

export const size = {
  // 높이
  inputH: 42,
  buttonH: 40,
  buttonLgH: 48,
  buttonSmH: 34,
  chipH: 32,

  // 간격
  s4: 4, s6: 6, s8: 8, s10: 10, s12: 12, s14: 14, s16: 16, s20: 20, s24: 24, s28: 28, s32: 32, s40: 40,
};

// ─── Pre-baked component styles ───

export const button = {
  // 큰 액션 (히어로 CTA)
  primary: {
    height: size.buttonLgH, padding: '0 22px', borderRadius: radius.pill,
    background: color.blue, color: '#fff', border: 'none',
    fontSize: 14, fontWeight: 800, cursor: 'pointer',
    letterSpacing: '-0.01em',
    boxShadow: '0 8px 20px rgba(49,130,246,0.28)',
  },
  // 일반 액션
  default: {
    height: size.buttonH, padding: '0 16px', borderRadius: radius.md,
    background: color.blue, color: '#fff', border: 'none',
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
    letterSpacing: '-0.01em',
  },
  // 보조
  ghost: {
    height: size.buttonH, padding: '0 14px', borderRadius: radius.md,
    background: '#fff', color: color.sub, border: `1px solid ${color.line}`,
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
    letterSpacing: '-0.01em',
  },
  // 다크
  dark: {
    height: size.buttonH, padding: '0 16px', borderRadius: radius.md,
    background: color.ink, color: '#fff', border: 'none',
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
  },
  // 칩 (필터, 탭)
  chip: (active = false) => ({
    height: size.chipH, padding: '0 14px', borderRadius: radius.pill,
    background: active ? color.blueTint : '#fff',
    color: active ? color.blue : color.sub,
    border: active ? 'none' : `1px solid ${color.line}`,
    fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
    letterSpacing: '-0.01em',
  }),
};

export const card = {
  default: {
    background: '#fff',
    border: `1px solid ${color.line}`,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  header: {
    padding: '16px 20px',
    borderBottom: `1px solid ${color.line}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
};

export const input = {
  default: {
    height: size.inputH,
    padding: '0 14px',
    borderRadius: radius.md,
    border: `1px solid ${color.line}`,
    background: color.bg,
    fontSize: 13.5,
    fontWeight: 600,
    color: color.ink,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: font.family,
    letterSpacing: '-0.01em',
  },
};

// 상태 뱃지
export const badge = (kind = 'default') => {
  const map = {
    success: { bg: color.successBg, fg: color.success },
    warning: { bg: color.warningBg, fg: color.warning },
    danger:  { bg: color.dangerBg,  fg: color.danger },
    info:    { bg: color.blueTint,  fg: color.blue },
    default: { bg: color.line,      fg: color.sub },
  };
  const c = map[kind] || map.default;
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '4px 10px', borderRadius: radius.pill,
    fontSize: 11.5, fontWeight: 700,
    background: c.bg, color: c.fg,
    letterSpacing: '-0.01em',
  };
};
