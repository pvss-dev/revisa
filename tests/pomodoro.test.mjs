import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advancePomodoro, createPomodoroState, durationSeconds, formatPomodoroTime,
  restorePomodoroState, validPomodoroSettings,
} from '../lib/pomodoro.js';

test('durações personalizadas têm limites válidos', () => {
  assert.deepEqual(validPomodoroSettings({ focus: '40', shortBreak: '8', longBreak: '20', longBreakEvery: '4' }), {
    focus: 40, shortBreak: 8, longBreak: 20, longBreakEvery: 4,
  });
  assert.equal(validPomodoroSettings({ focus: 0, shortBreak: 5, longBreak: 15, longBreakEvery: 4 }), null);
  assert.equal(validPomodoroSettings({ focus: 25, shortBreak: 5, longBreak: 15, longBreakEvery: 9 }), null);
});

test('quatro focos completos levam à pausa longa e reiniciam o ciclo', () => {
  let state = createPomodoroState('2026-10-12');
  for (let index = 0; index < 3; index++) {
    state = advancePomodoro(state, '2026-10-12');
    assert.equal(state.mode, 'shortBreak');
    state = advancePomodoro(state, '2026-10-12');
  }
  state = advancePomodoro(state, '2026-10-12');
  assert.equal(state.mode, 'longBreak');
  assert.equal(state.remainingSeconds, durationSeconds('longBreak', state.settings));
  assert.equal(state.completedInCycle, 0);
  assert.equal(state.completedToday, 4);
  assert.equal(state.completedTotal, 4);
  state = advancePomodoro(state, '2026-10-12');
  assert.equal(state.mode, 'focus');
});

test('pular foco não conta como sessão concluída', () => {
  const state = advancePomodoro(createPomodoroState('2026-10-12'), '2026-10-12', false);
  assert.equal(state.mode, 'shortBreak');
  assert.equal(state.completedInCycle, 0);
  assert.equal(state.completedToday, 0);
});

test('estado salvo preserva o prazo e zera apenas a contagem diária ao mudar o dia', () => {
  const saved = { ...createPomodoroState('2026-10-12'), endAt: 1_800_000_000_000,
    completedToday: 2, completedTotal: 7 };
  const restored = restorePomodoroState(saved, '2026-10-13');
  assert.equal(restored.endAt, saved.endAt);
  assert.equal(restored.completedToday, 0);
  assert.equal(restored.completedTotal, 7);
  assert.equal(formatPomodoroTime(1500), '25:00');
  assert.equal(formatPomodoroTime(9), '00:09');
});
