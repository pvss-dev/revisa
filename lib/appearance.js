export const defaultAppearance = Object.freeze({ theme: 'light', accentColor: '#246D54' });

export const appearanceColors = Object.freeze([
  { name: 'Verde', hex: '#246D54' },
  { name: 'Azul', hex: '#2563EB' },
  { name: 'Roxo', hex: '#7C3AED' },
  { name: 'Vermelho', hex: '#C43D4A' },
  { name: 'Laranja', hex: '#C05621' },
  { name: 'Turquesa', hex: '#0D9488' },
  { name: 'Índigo', hex: '#4F46E5' },
]);

export function normalizeHex(value) {
  if (typeof value !== 'string') return null;
  const hex = value.trim();
  if (/^#[0-9a-f]{3}$/i.test(hex)) return `#${[...hex.slice(1)].map(char => char + char).join('').toUpperCase()}`;
  return /^#[0-9a-f]{6}$/i.test(hex) ? hex.toUpperCase() : null;
}

export function validAppearance(value) {
  if (!value || !['light', 'dark', 'auto'].includes(value.theme)) return null;
  const accentColor = normalizeHex(value.accentColor);
  return accentColor ? { theme: value.theme, accentColor } : null;
}

export function appearanceFromUser(user) {
  return validAppearance({ theme: user?.appearanceTheme, accentColor: user?.accentColor }) || defaultAppearance;
}

export function resolvedTheme(theme, systemDark) {
  return theme === 'auto' ? systemDark ? 'dark' : 'light' : theme;
}

function channels(hex) { return [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16)); }
function toHex(rgb) { return `#${rgb.map(value => Math.round(value).toString(16).padStart(2, '0')).join('').toUpperCase()}`; }
export function mixHex(first, second, amount) {
  const a = channels(first), b = channels(second);
  return toHex(a.map((value, index) => value * (1 - amount) + b[index] * amount));
}
export function contrastRatio(first, second) {
  const luminance = hex => {
    const linear = channels(hex).map(value => {
      const normalized = value / 255;
      return normalized <= .04045 ? normalized / 12.92 : ((normalized + .055) / 1.055) ** 2.4;
    });
    return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
  };
  const a = luminance(first), b = luminance(second);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

function readableColor(color, background, target = 4.5) {
  if (contrastRatio(color, background) >= target) return color;
  const end = contrastRatio('#FFFFFF', background) > contrastRatio('#000000', background) ? '#FFFFFF' : '#000000';
  for (let step = 1; step <= 100; step++) {
    const candidate = mixHex(color, end, step / 100);
    if (contrastRatio(candidate, background) >= target) return candidate;
  }
  return end;
}

export function appearanceTokens(accentColor, mode) {
  const accent = normalizeHex(accentColor) || defaultAppearance.accentColor;
  const dark = mode === 'dark';
  const surface = dark ? '#1E2927' : '#FFFFFF';
  const solid = readableColor(accent, dark ? '#101918' : '#FFFFFF', dark ? 5 : 4.5);
  const onSolid = contrastRatio('#FFFFFF', solid) >= 4.5 ? '#FFFFFF' : '#101918';
  const sidebar = readableColor(dark ? mixHex(accent, '#0B1415', .87) : accent === defaultAppearance.accentColor ? '#173D35' : mixHex(accent, '#0D2721', .58), '#FFFFFF', 7);
  const sidebarActive = readableColor(dark ? mixHex(accent, '#172321', .67) : accent === defaultAppearance.accentColor ? '#2A5848' : mixHex(accent, '#284638', .58), '#FFFFFF', 7);
  const heroStart = readableColor(dark ? mixHex(accent, '#192725', .7) : accent === defaultAppearance.accentColor ? '#245E4B' : mixHex(accent, '#173B30', .34), '#FFFFFF', 7);
  const heroEnd = readableColor(dark ? mixHex(accent, '#263C35', .62) : accent === defaultAppearance.accentColor ? '#397C61' : mixHex(accent, '#42866C', .28), '#FFFFFF', 7);
  const lift = accent === defaultAppearance.accentColor ? '#D8E99C' : mixHex(accent, '#FFFFFF', .65);
  return {
    '--accent': accent,
    '--accent-ui': readableColor(accent, surface),
    '--accent-solid': solid,
    '--accent-on': onSolid,
    '--accent-hover': mixHex(solid, dark ? '#FFFFFF' : '#000000', .13),
    '--sidebar-bg': sidebar,
    '--sidebar-active': sidebarActive,
    '--sidebar-muted': readableColor('#BDD3C5', sidebar),
    '--hero-start': heroStart,
    '--hero-end': heroEnd,
    '--hero-muted': readableColor('#D7E9DB', heroEnd),
    '--hero-highlight': readableColor(lift, heroEnd),
    '--accent-lift': lift,
  };
}
