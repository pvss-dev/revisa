import test from 'node:test';
import assert from 'node:assert/strict';
import { appearanceTokens, contrastRatio, normalizeHex, resolvedTheme, validAppearance } from '../lib/appearance.js';

test('valida tema e cor hexadecimal, incluindo forma abreviada', () => {
  assert.deepEqual(validAppearance({ theme: 'auto', accentColor: '#f08' }), { theme: 'auto', accentColor: '#FF0088' });
  assert.equal(normalizeHex('red'), null);
  assert.equal(validAppearance({ theme: 'unknown', accentColor: '#246D54' }), null);
  assert.equal(validAppearance({ theme: 'dark', accentColor: '#12345G' }), null);
});

test('tema automático acompanha a preferência do sistema', () => {
  assert.equal(resolvedTheme('auto', true), 'dark');
  assert.equal(resolvedTheme('auto', false), 'light');
  assert.equal(resolvedTheme('light', true), 'light');
  assert.equal(resolvedTheme('dark', false), 'dark');
});

test('cores extremas mantêm contraste em botões e destaques claros e escuros', () => {
  for (const color of ['#FFFFFF', '#000000', '#F9FF00', '#246D54', '#2563EB']) {
    for (const mode of ['light', 'dark']) {
      const tokens = appearanceTokens(color, mode);
      assert.ok(contrastRatio(tokens['--accent-solid'], tokens['--accent-on']) >= 4.5, `${color} ${mode} button`);
      assert.ok(contrastRatio(tokens['--accent-ui'], mode === 'dark' ? '#1E2927' : '#FFFFFF') >= 4.5, `${color} ${mode} text`);
      assert.ok(contrastRatio(tokens['--sidebar-bg'], '#FFFFFF') >= 7, `${color} ${mode} sidebar`);
      assert.ok(contrastRatio(tokens['--hero-end'], '#FFFFFF') >= 7, `${color} ${mode} hero`);
      assert.ok(contrastRatio(tokens['--hero-end'], tokens['--hero-highlight']) >= 4.5, `${color} ${mode} hero highlight`);
    }
  }
});
