'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, CircleHelp, Coffee, Pause, Play, RotateCcw, SkipForward, Timer, Volume2 } from 'lucide-react';
import {
  advancePomodoro, durationSeconds, formatPomodoroTime,
  localDayKey, restorePomodoroState, validPomodoroSettings,
} from '@/lib/pomodoro';

const modes = [
  { key: 'focus', label: 'Foco' },
  { key: 'shortBreak', label: 'Pausa curta' },
  { key: 'longBreak', label: 'Pausa longa' },
];
const modeLabel = mode => modes.find(item => item.key === mode)?.label ?? 'Foco';
const settingsFields = [
  { key: 'focus', label: 'Foco', max: 180 },
  { key: 'shortBreak', label: 'Pausa curta', max: 60 },
  { key: 'longBreak', label: 'Pausa longa', max: 60 },
  { key: 'longBreakEvery', label: 'Pausa longa após', min: 2, max: 8, suffix: 'focos' },
];

function playCompletionTone(context) {
  if (!context || context.state !== 'running') return;
  try {
    for (const [index, frequency] of [660, 880].entries()) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + index * 0.22;
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.16, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.2);
    }
  } catch { /* o aviso visual continua disponível se o áudio for bloqueado */ }
}

export default function PomodoroTimer({ userId, visible, onComplete }) {
  const [state, setState] = useState(null);
  const [draft, setDraft] = useState(null);
  const [settingsError, setSettingsError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const completionRef = useRef(null);
  const audioRef = useRef(null);
  const titleRef = useRef('');
  const onCompleteRef = useRef(onComplete);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => {
    titleRef.current = document.title;
    const key = `revisa-pomodoro-v1-${userId}`;
    let saved = null;
    try { saved = JSON.parse(window.localStorage.getItem(key)); } catch { /* armazenamento indisponível */ }
    const restored = restorePomodoroState(saved, localDayKey());
    setState(restored);
    setDraft(Object.fromEntries(Object.entries(restored.settings).map(([name, value]) => [name, String(value)])));
    return () => {
      document.title = titleRef.current;
      audioRef.current?.close().catch(() => {});
    };
  }, [userId]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!state) return;
    try { window.localStorage.setItem(`revisa-pomodoro-v1-${userId}`, JSON.stringify(state)); }
    catch { /* o cronômetro continua funcionando sem armazenamento local */ }
  }, [state, userId]);

  const seconds = state?.endAt ? Math.max(0, Math.ceil((state.endAt - now) / 1000)) : state?.remainingSeconds ?? 0;

  useEffect(() => {
    if (!state || state.todayDate === localDayKey()) return;
    setState(current => current && current.todayDate !== localDayKey()
      ? { ...current, completedToday: 0, todayDate: localDayKey() } : current);
  }, [state, now]);

  useEffect(() => {
    if (!state?.endAt || now < state.endAt || completionRef.current === state.endAt) return;
    const deadline = state.endAt;
    completionRef.current = deadline;
    const next = advancePomodoro(state, localDayKey());
    setState(current => current?.endAt === deadline ? next : current);
    if (state.soundEnabled) playCompletionTone(audioRef.current);
    onCompleteRef.current?.(state.mode === 'focus'
      ? `Foco concluído! Hora da ${next.mode === 'longBreak' ? 'pausa longa' : 'pausa curta'}.`
      : 'Pausa concluída! Hora de voltar ao foco.');
  }, [state, now]);

  useEffect(() => {
    if (!state) return;
    document.title = state.endAt
      ? `${formatPomodoroTime(seconds)} · ${modeLabel(state.mode)} | Revisa`
      : titleRef.current;
  }, [state, seconds]);

  function prepareAudio(enabled = state?.soundEnabled) {
    if (!enabled) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      audioRef.current ??= new AudioContextClass();
      audioRef.current.resume().catch(() => {});
    } catch { /* navegador sem saída de áudio */ }
  }

  function toggleTimer() {
    if (state.endAt) {
      setState(current => ({
        ...current,
        remainingSeconds: Math.max(1, Math.ceil((current.endAt - Date.now()) / 1000)),
        endAt: null,
      }));
    } else {
      prepareAudio();
      completionRef.current = null;
      const startedAt = Date.now();
      setNow(startedAt);
      setState(current => ({ ...current, endAt: startedAt + current.remainingSeconds * 1000 }));
    }
  }

  function selectMode(mode) {
    completionRef.current = null;
    setState(current => ({ ...current, mode, endAt: null,
      remainingSeconds: durationSeconds(mode, current.settings) }));
  }

  function resetTimer() {
    completionRef.current = null;
    setState(current => ({ ...current, endAt: null,
      remainingSeconds: durationSeconds(current.mode, current.settings) }));
  }

  function skipStage() {
    completionRef.current = null;
    setState(current => advancePomodoro(current, localDayKey(), false));
  }

  function saveSettings(event) {
    event.preventDefault();
    const settings = validPomodoroSettings(draft);
    if (!settings) return setSettingsError('Confira as durações e a quantidade de focos.');
    setSettingsError('');
    completionRef.current = null;
    setState(current => ({ ...current, settings, endAt: null,
      remainingSeconds: durationSeconds(current.mode, settings),
      completedInCycle: Math.min(current.completedInCycle, settings.longBreakEvery - 1) }));
    onCompleteRef.current?.('Durações salvas. A etapa atual foi reiniciada.');
  }

  if (!visible) return null;
  if (!state || !draft) return <div className="boot">Carregando Pomodoro...</div>;

  const fullDuration = durationSeconds(state.mode, state.settings);
  const progress = Math.max(0, Math.min(100, (fullDuration - seconds) * 100 / fullDuration));
  const nextMode = state.mode === 'focus'
    ? state.completedInCycle + 1 >= state.settings.longBreakEvery ? 'longBreak' : 'shortBreak'
    : 'focus';
  const status = state.endAt ? 'Em andamento' : seconds < fullDuration ? 'Pausado' : 'Pronto para começar';

  return <>
    <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot"/> TEMPO DE QUALIDADE</div><h1>Pomodoro</h1><p>Alterne foco e pausas para estudar com mais constância.</p></div></div>
    <div className="pomodoro-layout">
      <section className="panel pomodoro-main" aria-label="Cronômetro Pomodoro">
        <div className="pomodoro-mode-tabs" role="group" aria-label="Etapa do Pomodoro">
          {modes.map(mode => <button key={mode.key} type="button" className={state.mode === mode.key ? 'active' : ''}
            aria-pressed={state.mode === mode.key} onClick={() => selectMode(mode.key)}>{mode.label}</button>)}
        </div>
        <div className={`pomodoro-dial ${state.mode}`} style={{ '--progress': `${progress}%` }}>
          <div className="pomodoro-dial-inner">
            <span className="pomodoro-dial-icon">{state.mode === 'focus' ? <Timer size={24}/> : <Coffee size={24}/>}</span>
            <span className="pomodoro-mode-name">{modeLabel(state.mode)}</span>
            <output className="pomodoro-clock" role="timer" aria-label={`${formatPomodoroTime(seconds)} restantes`}>{formatPomodoroTime(seconds)}</output>
            <span className="pomodoro-status">{status}</span>
          </div>
        </div>
        <div className="pomodoro-controls">
          <button type="button" className="button primary" onClick={toggleTimer} disabled={seconds === 0}>
            {state.endAt ? <><Pause size={18}/> Pausar</> : <><Play size={18}/> {seconds < fullDuration ? 'Continuar' : state.mode === 'focus' ? 'Iniciar foco' : 'Iniciar pausa'}</>}
          </button>
          <button type="button" className="button secondary" onClick={resetTimer}><RotateCcw size={17}/> Reiniciar</button>
          <button type="button" className="button secondary" onClick={skipStage}><SkipForward size={17}/> Pular etapa</button>
        </div>
        <p className="pomodoro-next">Ao concluir: <strong>{modeLabel(nextMode)}</strong>. O cronômetro aguarda você iniciar a próxima etapa.</p>
      </section>
      <div className="pomodoro-side">
        <section className="panel pomodoro-summary"><div className="pomodoro-card-heading"><span className="modal-icon"><Check size={21}/></span><div><h2>Seu ritmo</h2><p>Acompanhe os focos concluídos.</p></div></div>
          <div className="pomodoro-counts"><div><strong>{state.completedToday}</strong><span>focos hoje</span></div><div><strong>{state.completedTotal}</strong><span>focos no total</span></div></div>
          <div className="pomodoro-cycle"><div><b>Ciclo atual</b><span>{state.completedInCycle} de {state.settings.longBreakEvery} focos até a pausa longa</span></div><div className="pomodoro-dots">{Array.from({ length: state.settings.longBreakEvery }, (_, index) => <i key={index} className={index < state.completedInCycle ? 'done' : ''}/>)}</div></div>
        </section>
        <section className="panel pomodoro-settings"><div className="pomodoro-card-heading"><span className="modal-icon"><Timer size={21}/></span><div><h2>Ajustar durações</h2><p>Escolha um ritmo que funcione para você.</p></div></div>
          <form onSubmit={saveSettings} className="pomodoro-settings-form"><div className="pomodoro-fields">{settingsFields.map(field => <label key={field.key}>{field.label}<span><input type="number" min={field.min ?? 1} max={field.max} step="1" required value={draft[field.key]} onChange={event => setDraft(current => ({ ...current, [field.key]: event.target.value }))}/><small>{field.suffix ?? 'min'}</small></span></label>)}</div>
            <label className="pomodoro-sound"><input type="checkbox" checked={state.soundEnabled} onChange={event => { if (event.target.checked) prepareAudio(true); setState(current => ({ ...current, soundEnabled: event.target.checked })); }}/><Volume2 size={18}/><span>Aviso sonoro ao terminar</span></label>
            <div className="info-note"><CircleHelp size={17}/><span>Ao salvar as durações, a etapa atual recomeça. O cronômetro continua ao navegar pelo site ou atualizar a página neste navegador.</span></div>
            {settingsError && <div className="form-error" role="alert">{settingsError}</div>}
            <button type="submit" className="button secondary pomodoro-save"><Check size={17}/> Salvar durações</button>
          </form>
        </section>
      </div>
    </div>
  </>;
}
