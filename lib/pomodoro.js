export const defaultPomodoroSettings = Object.freeze({
  focus: 25,
  shortBreak: 5,
  longBreak: 15,
  longBreakEvery: 4,
});

export const pomodoroModes = ['focus', 'shortBreak', 'longBreak'];

export function localDayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function validPomodoroSettings(value) {
  if (!value || typeof value !== 'object') return null;
  const settings = Object.fromEntries(
    Object.keys(defaultPomodoroSettings).map(key => [key, Number(value[key])]),
  );
  if (!Number.isInteger(settings.focus) || settings.focus < 1 || settings.focus > 180 ||
      !Number.isInteger(settings.shortBreak) || settings.shortBreak < 1 || settings.shortBreak > 60 ||
      !Number.isInteger(settings.longBreak) || settings.longBreak < 1 || settings.longBreak > 60 ||
      !Number.isInteger(settings.longBreakEvery) || settings.longBreakEvery < 2 || settings.longBreakEvery > 8) {
    return null;
  }
  return settings;
}

export function durationSeconds(mode, settings) {
  return settings[mode] * 60;
}

export function createPomodoroState(today = localDayKey()) {
  return {
    settings: { ...defaultPomodoroSettings },
    mode: 'focus',
    remainingSeconds: durationSeconds('focus', defaultPomodoroSettings),
    endAt: null,
    completedInCycle: 0,
    completedToday: 0,
    todayDate: today,
    completedTotal: 0,
    soundEnabled: true,
  };
}

export function restorePomodoroState(saved, today = localDayKey()) {
  const fresh = createPomodoroState(today);
  if (!saved || typeof saved !== 'object') return fresh;
  const settings = validPomodoroSettings(saved.settings);
  const mode = pomodoroModes.includes(saved.mode) ? saved.mode : null;
  if (!settings || !mode) return fresh;
  const remainingSeconds = Number(saved.remainingSeconds);
  const endAt = saved.endAt == null ? null : Number(saved.endAt);
  const completedInCycle = Number(saved.completedInCycle);
  const completedTotal = Number(saved.completedTotal);
  const completedToday = Number(saved.completedToday);
  if (!Number.isInteger(remainingSeconds) || remainingSeconds < 0 || remainingSeconds > durationSeconds(mode, settings) ||
      (endAt !== null && (!Number.isFinite(endAt) || endAt <= 0)) ||
      !Number.isInteger(completedInCycle) || completedInCycle < 0 || completedInCycle >= settings.longBreakEvery ||
      !Number.isInteger(completedTotal) || completedTotal < 0 ||
      !Number.isInteger(completedToday) || completedToday < 0) return fresh;
  return {
    settings,
    mode,
    remainingSeconds,
    endAt,
    completedInCycle,
    completedToday: saved.todayDate === today ? completedToday : 0,
    todayDate: today,
    completedTotal,
    soundEnabled: saved.soundEnabled !== false,
  };
}

export function advancePomodoro(state, today = localDayKey(), completed = true) {
  const completedToday = state.todayDate === today ? state.completedToday : 0;
  if (state.mode === 'focus') {
    const inCycle = state.completedInCycle + (completed ? 1 : 0);
    const longBreak = completed && inCycle >= state.settings.longBreakEvery;
    const mode = longBreak ? 'longBreak' : 'shortBreak';
    return {
      ...state,
      mode,
      remainingSeconds: durationSeconds(mode, state.settings),
      endAt: null,
      completedInCycle: longBreak ? 0 : inCycle,
      completedToday: completedToday + (completed ? 1 : 0),
      completedTotal: state.completedTotal + (completed ? 1 : 0),
      todayDate: today,
    };
  }
  return {
    ...state,
    mode: 'focus',
    remainingSeconds: durationSeconds('focus', state.settings),
    endAt: null,
    completedToday,
    todayDate: today,
  };
}

export function formatPomodoroTime(seconds) {
  const safe = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}
