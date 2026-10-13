'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ArrowRight, BookOpen, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronLeft,
  ChevronRight, CircleHelp, Clock3, Filter, Flag,
  LayoutDashboard, Library, LockKeyhole, LogOut, Menu, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Pencil, Plus, Search, Settings2, Sparkles,
  Target, Timer, Trash2, TrendingUp, UserRound, X, Palette,
} from 'lucide-react';
import { addDays, maxReviewIntervals, minReviewIntervals, offsets, validReviewOffsets } from '@/lib/validation';
import { appearanceFromUser, appearanceTokens, defaultAppearance, resolvedTheme } from '@/lib/appearance';
import { appRoutes, viewForPath } from '@/lib/navigation';
import AppearanceSettings from './AppearanceSettings';
import PomodoroTimer from './PomodoroTimer';
import GoogleCalendarSettings from './GoogleCalendarSettings';
import AgendaCalendar from './AgendaCalendar';

const stageName = stage => stage === 0 ? 'Questões iniciais' : `Revisão ${stage}`;
const stageShort = stage => stage === 0 ? 'Q0' : `R${stage}`;
const navGroups = [
  {
    key: 'home',
    label: 'INÍCIO',
    items: [
      { key: 'overview', label: 'Visão geral', icon: LayoutDashboard, href: appRoutes.overview },
    ],
  },
  {
    key: 'planning',
    label: 'PLANEJAMENTO',
    items: [
      { key: 'agenda', label: 'Agenda', icon: CalendarDays, href: appRoutes.agenda },
      { key: 'topics', label: 'Meus assuntos', icon: BookOpen, href: appRoutes.topics },
      { key: 'disciplines', label: 'Minhas disciplinas', icon: Library, href: appRoutes.disciplines },
    ],
  },
  {
    key: 'study-sessions',
    label: 'SESSÕES DE ESTUDO',
    items: [
      { key: 'pomodoro', label: 'Pomodoro', icon: Timer, href: appRoutes.pomodoro },
      { key: 'settings', label: 'Intervalos', icon: Settings2, href: appRoutes.settings },
    ],
  },
  {
    key: 'assessment',
    label: 'AVALIAÇÃO',
    items: [
      { key: 'exams', label: 'Provas completas', icon: Target, href: appRoutes.exams },
    ],
  },
  {
    key: 'preferences',
    label: 'PREFERÊNCIAS',
    items: [
      { key: 'appearance', label: 'Aparência', icon: Palette, href: appRoutes.appearance },
      { key: 'profile', label: 'Meu perfil', icon: UserRound, href: appRoutes.profile },
    ],
  },
];
const navItems = navGroups.flatMap(group => group.items);

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function dateOnly(v) { return v ? String(v).slice(0,10) : null; }
function formatDate(v, options = { day: '2-digit', month: 'short' }) {
  if (!v) return '—';
  return new Intl.DateTimeFormat('pt-BR', { ...options, timeZone: 'UTC' }).format(new Date(`${dateOnly(v)}T12:00:00Z`));
}
function monthTitle(v) { return formatDate(v, { month: 'long', year: 'numeric' }); }
function initials(s) { return String(s || 'U').trim().split(/\s+/).slice(0,2).map(x => x[0]).join('').toUpperCase(); }
function topicOffsets(topic, userOffsets) { return topic.reviewOffsets || userOffsets || offsets.slice(1); }
function stageDate(topic, stage, userOffsets) { return addDays(dateOnly(topic.practiceDate), stage === 0 ? 0 : topicOffsets(topic, userOffsets)[stage - 1]); }
function pct(correct, total) { return total ? Math.round(correct * 100 / total) : 0; }
function statusOf(date, today) { return date < today ? 'overdue' : date === today ? 'today' : 'upcoming'; }
function disciplineColor(topic) { return Math.abs(Number(topic?.discipline?.colorIndex) || 0) % 5; }
function syncedMessage(result, success) { return result?.calendarSync?.ok === false ? `${success} A sincronização com o Google falhou e ficou disponível para nova tentativa no perfil.` : success; }
function nextDisciplineColor(disciplines) { const counts=Array.from({length:5},()=>0);disciplines.forEach(item=>{if(item.colorIndex>=0&&item.colorIndex<counts.length)counts[item.colorIndex]++;});return counts.indexOf(Math.min(...counts)); }
async function api(path, options = {}) {
  const res = await fetch(path, { credentials: 'same-origin', ...options, headers: { ...(options.body instanceof FormData ? {} : options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Não foi possível concluir a operação.');
  return data;
}

function SelectMenu({ id, value, onChange, options, ariaLabel, icon: Icon, className = '', disabled = false, required = false }) {
  const generatedId = useId().replaceAll(':', '');
  const controlId = id || `select-${generatedId}`;
  const listboxId = `${controlId}-options`;
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const normalizedOptions = options.map(option => typeof option === 'string'
    ? { value: option, label: option }
    : { ...option, value: String(option.value) });
  const selectedIndex = normalizedOptions.findIndex(option => option.value === String(value ?? ''));
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(Math.max(0, selectedIndex));
  const selectedOption = normalizedOptions[selectedIndex];

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = event => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const nextIndex = selectedIndex >= 0 ? selectedIndex : normalizedOptions.findIndex(option => !option.disabled);
    setActiveIndex(Math.max(0, nextIndex));
  }, [open, selectedIndex]);

  useEffect(() => {
    if (!open) return;
    document.getElementById(`${listboxId}-option-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, listboxId, open]);

  function moveActive(direction) {
    if (!normalizedOptions.length) return;
    let next = activeIndex;
    do next = (next + direction + normalizedOptions.length) % normalizedOptions.length;
    while (normalizedOptions[next]?.disabled && next !== activeIndex);
    setActiveIndex(next);
  }

  function choose(option) {
    if (!option || option.disabled) return;
    onChange(option.value);
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function handleKeyDown(event) {
    if (disabled) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) setOpen(true);
      else moveActive(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (event.key === 'Home' && open) {
      event.preventDefault();
      setActiveIndex(Math.max(0, normalizedOptions.findIndex(option => !option.disabled)));
      return;
    }
    if (event.key === 'End' && open) {
      event.preventDefault();
      for (let index = normalizedOptions.length - 1; index >= 0; index -= 1) {
        if (!normalizedOptions[index].disabled) { setActiveIndex(index); break; }
      }
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (open) choose(normalizedOptions[activeIndex]);
      else setOpen(true);
      return;
    }
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (event.key === 'Tab') setOpen(false);
  }

  return <div ref={rootRef} className={`custom-select ${className} ${open ? 'open' : ''} ${disabled ? 'disabled' : ''}`} onKeyDown={handleKeyDown}>
    {Icon && <Icon className="custom-select-leading" size={17}/>}
    <button
      ref={triggerRef}
      id={controlId}
      type="button"
      role="combobox"
      className="custom-select-trigger"
      aria-label={ariaLabel}
      aria-controls={listboxId}
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-activedescendant={open ? `${listboxId}-option-${activeIndex}` : undefined}
      aria-required={required || undefined}
      disabled={disabled}
      onClick={() => setOpen(current => !current)}
    >
      <span>{selectedOption?.label || 'Selecione uma opção'}</span>
      <ChevronDown className="custom-select-chevron" size={16}/>
    </button>
    {open && <div id={listboxId} className="custom-select-menu" role="listbox" aria-label={ariaLabel}>
      {normalizedOptions.map((option, index) => <button
        id={`${listboxId}-option-${index}`}
        type="button"
        role="option"
        aria-selected={index === selectedIndex}
        className={`custom-select-option ${index === activeIndex ? 'active' : ''} ${index === selectedIndex ? 'selected' : ''}`}
        disabled={option.disabled}
        key={`${option.value}-${index}`}
        onMouseEnter={() => setActiveIndex(index)}
        onClick={() => choose(option)}
      >
        <span>{option.label}</span>
        {index === selectedIndex && <Check size={15}/>}
      </button>)}
    </div>}
  </div>;
}

export default function RevisaApp({ initialView = 'overview' }) {
  const [user, setUser] = useState(undefined);
  const [appearance, setAppearance] = useState(defaultAppearance);
  const [authMode, setAuthMode] = useState('login');
  const [authFields, setAuthFields] = useState({ name: '', email: '', password: '' });
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [view, setView] = useState(initialView);
  const [disciplines, setDisciplines] = useState([]);
  const [topics, setTopics] = useState([]);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [today, setToday] = useState('');
  const [modal, setModal] = useState(null);
  const [disciplineEditor, setDisciplineEditor] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [selectedExam, setSelectedExam] = useState(null);
  const [query, setQuery] = useState('');
  const [disciplineFilter, setDisciplineFilter] = useState('all');
  const [topicFilter, setTopicFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('Todas');
  const [agendaFilter, setAgendaFilter] = useState('all');
  const [agendaSelectedDate, setAgendaSelectedDate] = useState('');
  const [toast, setToast] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const toastTimer = useRef(null);

  function notify(message) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4500);
  }
  async function refresh() {
    setLoading(true);
    try {
      const [t,e,d] = await Promise.all([api('/api/topics'), api('/api/exams'), api('/api/disciplines')]);
      setTopics(t.topics);
      setExams(e.exams);
      setDisciplines(d.disciplines);
    } catch (e) { notify(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    const currentDate = todayLocal();
    setToday(currentDate);
    setAgendaSelectedDate(currentDate);
    api('/api/me').then(d => { setUser(d.user); setAppearance(appearanceFromUser(d.user)); if (d.user) refresh(); }).catch(() => setUser(null));
    return () => clearTimeout(toastTimer.current);
  }, []);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('revisa-sidebar-collapsed');
      const legacy = window.localStorage.getItem('revisa-sidebar-hidden');
      setSidebarCollapsed(saved === null ? legacy === 'true' : saved === 'true');
    } catch { /* armazenamento indisponível */ }
  }, []);
  useEffect(() => {
    const syncViewWithUrl = () => {
      const nextView = viewForPath(window.location.pathname);
      if (!nextView) return;
      setView(nextView);
      setMenuOpen(false);
      setSelectedTopic(null);
      setSelectedExam(null);
    };
    syncViewWithUrl();
    window.addEventListener('popstate', syncViewWithUrl);
    return () => window.removeEventListener('popstate', syncViewWithUrl);
  }, []);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const mode = resolvedTheme(appearance.theme, media.matches);
      const root = document.documentElement;
      root.dataset.theme = mode;
      root.style.colorScheme = mode;
      Object.entries(appearanceTokens(appearance.accentColor, mode)).forEach(([name, value]) => root.style.setProperty(name, value));
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [appearance]);
  useEffect(() => {
    if (disciplineFilter !== 'all' && !disciplines.some(item => String(item.id) === disciplineFilter)) setDisciplineFilter('all');
    if (topicFilter !== 'all' && !topics.some(item => String(item.id) === topicFilter)) setTopicFilter('all');
    if (selectedTopic && !topics.some(item => String(item.id) === String(selectedTopic.id))) setSelectedTopic(null);
  }, [disciplines, topics, disciplineFilter, topicFilter, selectedTopic]);

  async function submitAuth(e) {
    e.preventDefault(); setAuthBusy(true); setAuthError('');
    try {
      const d = await api(`/api/auth/${authMode === 'register' ? 'register' : 'login'}`, { method: 'POST', body: JSON.stringify(authFields) });
      setUser(d.user); setAppearance(appearanceFromUser(d.user)); setAuthFields({ name: '', email: '', password: '' });
      await refresh();
    } catch (err) { setAuthError(err.message); }
    finally { setAuthBusy(false); }
  }
  async function logout() {
    await api('/api/auth/logout', { method: 'POST' });
    setUser(null); setAppearance(defaultAppearance); setDisciplines([]); setTopics([]); setExams([]); setModal(null); setDisciplineEditor(null); setView('overview');
    window.history.replaceState({}, '', appRoutes.overview);
  }

  const events = useMemo(() => topics.flatMap(topic => Array.from({ length: topicOffsets(topic, user?.reviewOffsets).length + 1 }, (_, stage) => {
    const attempt = topic.attempts?.find(a => Number(a.stage) === stage);
    return { topic, stage, date: stageDate(topic, stage, user?.reviewOffsets), attempt };
  })).sort((a,b) => a.date.localeCompare(b.date) || a.topic.title.localeCompare(b.topic.title)), [topics, user?.reviewOffsets]);
  const pending = events.filter(x => !x.attempt);
  const completed = events.filter(x => x.attempt);
  const dueToday = pending.filter(x => x.date === today).length;
  const overdue = pending.filter(x => x.date < today).length;
  const totalQuestions = completed.reduce((n,x) => n + Number(x.attempt.total), 0);
  const totalCorrect = completed.reduce((n,x) => n + Number(x.attempt.correct), 0);
  const accuracy = pct(totalCorrect,totalQuestions);
  const nextEvents = pending.filter(x => x.date >= today).slice(0,4);
  const urgentEvents = pending.filter(x => x.date <= today).sort((a,b) => b.date.localeCompare(a.date)).slice(0,5);
  const filteredTopics = topics.filter(t =>
    (priorityFilter === 'Todas' || t.priority === priorityFilter) &&
    (disciplineFilter === 'all' || String(t.disciplineId) === disciplineFilter) &&
    (topicFilter === 'all' || String(t.id) === topicFilter) &&
    `${t.subject} ${t.title}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))
  );
  const filterTopics = disciplineFilter === 'all' ? topics : topics.filter(topic => String(topic.disciplineId) === disciplineFilter);
  const hasTopicFilters = Boolean(query) || priorityFilter !== 'Todas' || disciplineFilter !== 'all' || topicFilter !== 'all';
  const subjectStats = useMemo(() => {
    const map = new Map();
    topics.forEach(t => {
      const key = t.disciplineId;
      const s = map.get(key) || { id: key, name: t.subject, colorIndex: disciplineColor(t), topics: 0, planned: 0, completed: 0, total: 0, correct: 0 };
      s.topics++; s.planned += topicOffsets(t, user?.reviewOffsets).length + 1; t.attempts?.forEach(a => { s.completed++; s.total += Number(a.total); s.correct += Number(a.correct); });
      map.set(key, s);
    });
    return [...map.values()].sort((a,b) => b.topics - a.topics);
  }, [topics, user?.reviewOffsets]);

  if (user === undefined) return <div className="boot"><div className="brand-symbol"><BookOpen size={28}/></div><span>Carregando seu espaço de estudo...</span></div>;
  if (!user) return <div className="auth-page grid min-h-screen">
    <div className="auth-showcase">
      <div className="auth-brand"><div className="brand-symbol"><BookOpen size={23}/></div><strong>revisa<span>.</span></strong></div>
      <div className="auth-hero">
        <div className="eyebrow light"><span className="eyebrow-dot"/> SEU ESTUDO, EM DIA</div>
        <h1>Estude hoje.<br/><em>Lembre amanhã.</em></h1>
        <p>Transforme seu planejamento de revisões em uma rotina clara. Saiba o que revisar, registre seus acertos e acompanhe sua evolução.</p>
        <div className="auth-feature-list">
          <div><span><CalendarDays size={19}/></span><div><b>Revisões no momento certo</b><small>Intervalos ajustáveis para sua rotina</small></div></div>
          <div><span><TrendingUp size={19}/></span><div><b>Progresso que você enxerga</b><small>Questões, acertos e provas em um só lugar</small></div></div>
          <div><span><Timer size={19}/></span><div><b>Foco com Pomodoro</b><small>Estude em blocos e acompanhe suas sessões</small></div></div>
        </div>
      </div>
      <div className="auth-footer">UM PLANO MAIS LEVE PARA CHEGAR MAIS LONGE <span>✳</span></div>
      <div className="decor decor-one"/><div className="decor decor-two"/>
    </div>
    <div className="auth-panel">
      <div className="auth-card">
        <div className="auth-mobile-brand"><div className="brand-symbol"><BookOpen size={21}/></div><strong>revisa<span>.</span></strong></div>
        <div className="auth-icon"><Sparkles size={24}/></div>
        <h2>{authMode === 'register' ? 'Comece por aqui' : 'Boas-vindas de volta'}</h2>
        <p>{authMode === 'register' ? 'Crie sua conta para organizar seus estudos.' : 'Entre para continuar de onde parou.'}</p>
        <form onSubmit={submitAuth} className="auth-form grid gap-[17px]">
          {authMode === 'register' && <label>Seu nome<input autoComplete="name" required minLength={2} maxLength={100} value={authFields.name} onChange={e => setAuthFields({ ...authFields, name: e.target.value })} placeholder="Como podemos chamar você?"/></label>}
          <label>E-mail<input type="email" autoComplete="email" required value={authFields.email} onChange={e => setAuthFields({ ...authFields, email: e.target.value })} placeholder="seuemail@exemplo.com"/></label>
          <label>Senha<input type="password" autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} required minLength={authMode === 'register' ? 10 : 1} value={authFields.password} onChange={e => setAuthFields({ ...authFields, password: e.target.value })} placeholder={authMode === 'register' ? 'Mínimo de 10 caracteres' : 'Sua senha'}/></label>
          {authError && <div className="form-error">{authError}</div>}
          <button className="button primary full" disabled={authBusy}>{authBusy ? 'Aguarde...' : authMode === 'register' ? 'Criar minha conta' : 'Entrar na minha conta'} <ArrowRight size={18}/></button>
        </form>
        <div className="auth-switch">{authMode === 'register' ? 'Já tem uma conta?' : 'Ainda não tem uma conta?'} <button onClick={() => { setAuthMode(authMode === 'register' ? 'login' : 'register'); setAuthError(''); }}>{authMode === 'register' ? 'Entrar' : 'Cadastre-se'}</button></div>
      </div>
    </div>
  </div>;

  function chooseView(key) {
    if (view === 'appearance') setAppearance(appearanceFromUser(user));
    setView(key);
    setMenuOpen(false);
    setSelectedTopic(null);
    setSelectedExam(null);
    const href = appRoutes[key];
    if (href && window.location.pathname !== href) window.history.pushState({ revisaView: key }, '', href);
  }
  async function saveAppearance(next) {
    const previous = appearanceFromUser(user);
    setAppearance(next);
    try {
      const result = await api('/api/settings/appearance', { method: 'PATCH', body: JSON.stringify(next) });
      setAppearance(result.appearance);
      setUser(current => ({ ...current, appearanceTheme: result.appearance.theme, accentColor: result.appearance.accentColor }));
      notify('Aparência salva.');
    } catch (failure) { setAppearance(previous); throw failure; }
  }
  function toggleSidebar() {
    const collapsed = !sidebarCollapsed;
    setSidebarCollapsed(collapsed);
    try {
      window.localStorage.setItem('revisa-sidebar-collapsed', String(collapsed));
      window.localStorage.removeItem('revisa-sidebar-hidden');
    } catch { /* armazenamento indisponível */ }
  }
  function openAttempt(topic, stage) { setSelectedTopic(topic); setModal({ type: 'attempt', topic, stage }); }
  function openTopic(topic) {
    setView('topics');
    setSelectedTopic(topic);
    if (window.location.pathname !== appRoutes.topics) window.history.pushState({ revisaView: 'topics' }, '', appRoutes.topics);
  }
  const greeting = new Date().getHours() < 12 ? 'Bom dia' : new Date().getHours() < 18 ? 'Boa tarde' : 'Boa noite';

  return <div className={`app-shell flex min-h-screen ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
    <aside id="app-sidebar" className={`sidebar flex flex-none flex-col ${menuOpen ? 'open' : ''}`}>
      <div className="sidebar-top"><div className="brand"><div className="brand-symbol"><BookOpen size={21}/></div><strong>revisa<span>.</span></strong></div><button className="icon-button sidebar-toggle sidebar-tooltip-target" onClick={toggleSidebar} aria-label={sidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'} data-tooltip={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'} aria-expanded={!sidebarCollapsed} aria-controls="app-sidebar">{sidebarCollapsed ? <PanelLeftOpen size={21}/> : <PanelLeftClose size={21}/>}</button><button className="icon-button mobile-close" onClick={() => setMenuOpen(false)} aria-label="Fechar menu"><X size={20}/></button></div>
      <nav className="nav-groups" aria-label="Navegação principal">
        {navGroups.map(group => <section className="sidebar-nav-group" aria-labelledby={`nav-group-${group.key}`} key={group.key}>
          <h2 className="sidebar-caption" id={`nav-group-${group.key}`}>{group.label}</h2>
          <div className="nav-list">
            {group.items.map(item => <button type="button" key={item.key} className={`nav-item sidebar-tooltip-target ${view === item.key ? 'active' : ''}`} data-tooltip={item.label} aria-label={item.label} aria-current={view === item.key ? 'page' : undefined} onClick={() => chooseView(item.key)}><item.icon size={19}/><span className="nav-label">{item.label}</span>{item.key === 'agenda' && overdue > 0 && <i aria-label={`${overdue} revisões em atraso`}>{overdue}</i>}</button>)}
          </div>
        </section>)}
      </nav>
      <div className="sidebar-profile flex items-center gap-2.5"><button className="profile-link sidebar-tooltip-target" data-tooltip="Meu perfil" onClick={() => chooseView('profile')} aria-label="Abrir meu perfil"><span className="avatar">{initials(user.name)}</span><span className="profile-copy"><b>{user.name}</b><small>{user.email}</small></span></button><button className="logout-button sidebar-tooltip-target" data-tooltip="Sair" aria-label="Sair" onClick={logout}><LogOut size={18}/></button></div>
    </aside>
    {menuOpen && <button className="mobile-overlay" onClick={() => setMenuOpen(false)} aria-label="Fechar menu"/>}
    <main className="main-area min-w-0 flex-1">
      <header className="topbar flex items-center justify-between"><div className="topbar-start flex min-w-0 items-center gap-4"><button className="icon-button menu-button" onClick={() => setMenuOpen(true)} aria-label="Abrir menu" aria-expanded={menuOpen} aria-controls="app-sidebar"><Menu size={21}/></button><div className="breadcrumb">Meu espaço <ChevronRight size={14}/> <strong>{navItems.find(n => n.key === view)?.label}</strong></div></div><div className="topbar-right flex items-center gap-[22px]"><div className="today-chip"><CalendarDays size={16}/>{formatDate(today, { weekday: 'long', day: 'numeric', month: 'long' })}</div><button className="top-avatar" onClick={() => chooseView('profile')} title="Meu perfil" aria-label="Abrir meu perfil">{initials(user.name)}</button></div></header>
      <div className="page-content mx-auto">
        {view === 'overview' && <>
          <div className="page-heading overview-heading"><div><div className="eyebrow"><span className="eyebrow-dot"/> SEU PAINEL DE ESTUDOS</div><h1>{greeting}, {user.name.split(' ')[0]} <span className="wave">✳</span></h1><p>Veja o que precisa da sua atenção e siga no seu ritmo.</p></div><button className="button primary" onClick={() => setModal({ type: 'topic' })}><Plus size={18}/> Novo assunto</button></div>
          <div className="hero-banner"><div><span className="hero-kicker"><span/> EM FOCO AGORA</span><h2>{overdue + dueToday ? `${overdue + dueToday} ${overdue + dueToday === 1 ? 'revisão espera' : 'revisões esperam'} por você` : 'Sua agenda está em dia'}</h2><p>{overdue + dueToday ? 'Comece pelas pendências e mantenha o conhecimento fresco.' : 'Continue adicionando assuntos e acompanhando seu progresso.'}</p><button onClick={() => chooseView('agenda')}>Ver minha agenda <ArrowRight size={17}/></button></div><div className="hero-art"><div className="art-circle circle-back"/><div className="art-circle circle-front"><BookOpen size={63} strokeWidth={1.5}/></div><div className="art-star star-one">✳</div><div className="art-star star-two">✦</div><div className="art-line l1"/><div className="art-line l2"/></div></div>
          <div className="stat-grid"><Stat icon={CalendarDays} label="Para hoje" value={dueToday} helper="revisões agendadas" color="orange"/><Stat icon={Clock3} label="Em atraso" value={overdue} helper="precisam de atenção" color="rose"/><Stat icon={CheckCircle2} label="Concluídas" value={completed.length} helper={`de ${events.length} sessões`} color="green"/><Stat icon={Target} label="Taxa de acertos" value={`${accuracy}%`} helper={`${totalCorrect} de ${totalQuestions} questões`} color="blue"/></div>
          <div className="dashboard-grid"><section className="panel agenda-preview"><div className="panel-heading"><div><span className="section-overline">ORGANIZE O DIA</span><h3>Próximas revisões</h3></div><button className="text-button" onClick={() => chooseView('agenda')}>Ver agenda <ArrowRight size={15}/></button></div>{(urgentEvents.length ? urgentEvents : nextEvents).length ? <div className="event-list">{(urgentEvents.length ? urgentEvents : nextEvents).map((event, i) => <EventRow key={`${event.topic.id}-${event.stage}`} event={event} today={today} onOpen={() => openAttempt(event.topic,event.stage)} onTopic={() => openTopic(event.topic)}/>)}</div> : <Empty icon={CalendarDays} title="Tudo em dia por aqui" text="Quando você adicionar assuntos, as próximas revisões aparecerão aqui." action="Adicionar assunto" onClick={() => setModal({ type:'topic' })}/>}</section>
          <section className="panel progress-panel"><div className="panel-heading"><div><span className="section-overline">VISÃO POR DISCIPLINA</span><h3>Seu progresso</h3></div><span className="panel-badge">{subjectStats.length} disciplinas</span></div>{subjectStats.length ? <div className="subject-list">{subjectStats.slice(0,5).map(s => <div className="subject-row" key={s.id}><div className="subject-row-head"><span className={`subject-dot color-${s.colorIndex}`}/><b>{s.name}</b><strong>{pct(s.correct,s.total)}%</strong></div><div className="progress-track"><div style={{ width: `${pct(s.completed,s.planned)}%` }}/></div><small>{s.completed} de {s.planned} revisões concluídas</small></div>)}</div> : <Empty icon={TrendingUp} title="Seu progresso começa aqui" text="Registre questões e revisões para acompanhar os resultados."/>}</section></div>
        </>}
        {view === 'agenda' && <>
          <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot"/> SEU CRONOGRAMA</div><h1>Agenda de revisões</h1><p>O planejamento é calculado a partir da data das primeiras questões.</p></div><div className="heading-actions"><button className="button secondary" onClick={() => chooseView('settings')}><Settings2 size={17}/> Ajustar intervalos</button><button className="button primary" onClick={() => setModal({ type: 'topic' })}><Plus size={18}/> Novo assunto</button></div></div>
          <AgendaCalendar localEvents={pending} selectedDate={agendaSelectedDate} today={today} onSelectDate={date=>{setAgendaSelectedDate(date);setAgendaFilter(date);}}/>
          <div className="agenda-toolbar"><div className="segmented">{[['all','Todas'],['overdue','Atrasadas'],['today','Hoje'],['upcoming','Próximas'],['done','Concluídas']].map(([key,label])=><button key={key} className={agendaFilter===key?'active':''} onClick={()=>{setAgendaFilter(key);setAgendaSelectedDate(key==='today'?today:key==='all'?today:'');}}>{label}</button>)}</div><span>{pending.length} pendentes</span></div>
          <section className="panel agenda-full">{(() => { const list = events.filter(x => agendaFilter==='done' ? !!x.attempt : !x.attempt && (agendaFilter==='all' || (agendaFilter==='overdue' && x.date<today) || (agendaFilter==='today' && x.date===today) || (agendaFilter==='upcoming' && x.date>today) || x.date===agendaFilter)); return list.length ? <div className="event-list">{list.map(x=><EventRow key={`${x.topic.id}-${x.stage}`} event={x} today={today} onOpen={()=>openAttempt(x.topic,x.stage)} onTopic={()=>openTopic(x.topic)}/>)}</div> : <Empty icon={CalendarDays} title="Nenhuma revisão nesta seleção" text="Escolha outro período ou adicione um assunto novo."/>; })()}</section>
        </>}
        {view === 'topics' && <>
          <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot"/> SUA BIBLIOTECA</div><h1>Meus assuntos</h1><p>Todos os seus conteúdos e revisões organizados em um só lugar.</p></div><div className="heading-actions"><button className="button secondary" onClick={() => chooseView('disciplines')}><Library size={17}/> Minhas disciplinas</button><button className="button primary" onClick={() => { setSelectedTopic(null); setModal({ type:'topic' }); }}><Plus size={18}/> Novo assunto</button></div></div>
          <div className="topics-summary"><div><BookOpen size={20}/><b>{topics.length}</b><span>assuntos cadastrados</span></div><div><CheckCircle2 size={20}/><b>{completed.length}</b><span>sessões realizadas</span></div><div><Target size={20}/><b>{totalQuestions}</b><span>questões respondidas</span></div></div>
          <div className="list-toolbar content-list-toolbar">
            <div className="search-field"><Search size={18}/><input aria-label="Buscar assuntos" placeholder="Buscar disciplina ou assunto..." value={query} onChange={e=>setQuery(e.target.value)}/></div>
            <div className="content-filter-group">
              <SelectMenu className="select-field" icon={BookOpen} ariaLabel="Filtrar disciplina" value={disciplineFilter} onChange={next=>{ setDisciplineFilter(next); setTopicFilter('all'); }} options={[{ value:'all', label:'Todas as disciplinas' }, ...disciplines.map(discipline=>({ value:discipline.id, label:discipline.name }))]}/>
              <SelectMenu className="select-field" icon={Search} ariaLabel="Filtrar assunto" value={topicFilter} onChange={setTopicFilter} options={[{ value:'all', label:'Todos os assuntos' }, ...filterTopics.map(topic=>({ value:topic.id, label:topic.title }))]}/>
              <SelectMenu className="select-field" icon={Filter} ariaLabel="Filtrar prioridade" value={priorityFilter} onChange={setPriorityFilter} options={['Todas','Alta','Média','Baixa']}/>
            </div>
          </div>
          <section className="panel topic-table"><div className="table-head"><span>ASSUNTO</span><span>PRIORIDADE</span><span>PROGRESSO</span><span>PRÓXIMA REVISÃO</span><span/></div>{filteredTopics.length ? filteredTopics.map(topic=>{ const done=topic.attempts?.length||0;const planned=topicOffsets(topic,user.reviewOffsets).length+1;const next=Array.from({length:planned},(_,stage)=>({stage,date:stageDate(topic,stage,user.reviewOffsets)})).find(x=>!topic.attempts?.some(a=>Number(a.stage)===x.stage));return <button className="topic-row" key={topic.id} onClick={()=>setSelectedTopic(topic)}><div className="topic-name"><span className={`topic-icon color-${disciplineColor(topic)}`}><BookOpen size={17}/></span><div><b>{topic.title}</b><small>{topic.subject}</small></div></div><span className={`priority-pill ${topic.priority.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'')}`}>{topic.priority}</span><div className="topic-progress"><div className="mini-track"><i style={{width:`${pct(done,planned)}%`}}/></div><small>{done}/{planned}</small></div><div className="next-date">{next ? <><CalendarDays size={16}/>{formatDate(next.date,{day:'2-digit',month:'short',year:'numeric'})}</> : <span className="done-label"><Check size={15}/> Completo</span>}</div><ChevronRight className="row-arrow" size={18}/></button>}) : <Empty icon={BookOpen} title={hasTopicFilters ? 'Nenhum assunto encontrado' : 'Sua biblioteca está vazia'} text={hasTopicFilters ? 'Tente mudar a busca ou os filtros.' : 'Cadastre uma disciplina e adicione seu primeiro assunto.'} action={!hasTopicFilters ? 'Adicionar assunto' : null} onClick={()=>setModal({ type:'topic' })}/>}</section>
        </>}
        {view === 'disciplines' && <DisciplinePage disciplines={disciplines} topicCount={topics.length} onCreate={()=>setDisciplineEditor({})} onEdit={discipline=>setDisciplineEditor({discipline})} onViewTopics={discipline=>{setDisciplineFilter(String(discipline.id));setTopicFilter('all');chooseView('topics');}} onChanged={refresh} notify={notify}/>}
        {view === 'settings' && <ReviewSettings initial={user.reviewOffsets || offsets.slice(1)} onSave={async reviewOffsets => { const result = await api('/api/settings/reviews', { method: 'PATCH', body: JSON.stringify({ reviewOffsets }) }); setUser(current => ({ ...current, reviewOffsets: result.reviewOffsets })); notify(syncedMessage(result, 'Intervalos atualizados. A agenda foi recalculada.')); }} />}
        {view === 'appearance' && <AppearanceSettings appearance={appearance} onPreview={setAppearance} onSave={saveAppearance}/>}
        <PomodoroTimer key={user.id} userId={user.id} visible={view === 'pomodoro'} onComplete={notify}/>
        {view === 'profile' && <ProfileSettings user={user} notify={notify} onProfileSave={async details => { const result = await api('/api/me', { method: 'PATCH', body: JSON.stringify(details) }); setUser(result.user); notify('Perfil atualizado.'); }} onPasswordSave={async details => { await api('/api/me/password', { method: 'PUT', body: JSON.stringify(details) }); notify('Senha atualizada. As outras sessões foram encerradas.'); }} />}
        {view === 'exams' && <>
          <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot"/> SIMULE, ANALISE, EVOLUA</div><h1>Provas completas</h1><p>Marque seus acertos questão por questão e acompanhe cada prova.</p></div><button className="button primary" onClick={() => setModal({ type:'exam' })}><Plus size={18}/> Nova prova</button></div>
          <div className="exam-intro"><div className="exam-intro-icon"><Target size={29}/></div><div><h3>O treino também conta</h3><p>Registre respostas certas e erradas. O percentual de acertos é calculado automaticamente.</p></div></div>
          {exams.length ? <div className="exam-grid">{exams.map((exam,i)=>{ const right=exam.answers.filter(a=>a.result==='correct').length; const answered=exam.answers.length; return <button className="exam-card" key={exam.id} onClick={()=>setSelectedExam(exam)}><div className="exam-card-top"><span className={`exam-icon color-${i%5}`}><Target size={22}/></span><span className="exam-percent">{pct(right,answered)}%</span></div><h3>{exam.title}</h3><p>{exam.examDate ? formatDate(exam.examDate,{day:'2-digit',month:'long',year:'numeric'}) : 'Sem data definida'}</p><div className="exam-progress"><div style={{width:`${pct(answered,exam.questionCount)}%`}}/></div><div className="exam-card-bottom"><span>{answered} de {exam.questionCount} questões</span><span>Ver prova <ArrowRight size={15}/></span></div></button>})}</div> : <section className="panel exam-empty"><Empty icon={Target} title="Sua primeira prova começa aqui" text="Crie uma prova e registre o resultado de cada questão para acompanhar sua evolução." action="Criar prova" onClick={()=>setModal({ type:'exam' })}/></section>}
        </>}
      </div>
    </main>
    {selectedTopic && view === 'topics' && <TopicDrawer topic={topics.find(t=>String(t.id)===String(selectedTopic.id)) || selectedTopic} userOffsets={user.reviewOffsets} today={today} onClose={()=>setSelectedTopic(null)} onAttempt={stage=>openAttempt(topics.find(t=>String(t.id)===String(selectedTopic.id)) || selectedTopic,stage)} onEdit={()=>setModal({ type:'topic', topic: topics.find(t=>String(t.id)===String(selectedTopic.id)) || selectedTopic })} onDelete={async()=>{ if (!confirm('Excluir este assunto e todo o histórico de revisões?')) return; try { const result=await api(`/api/topics/${selectedTopic.id}`,{method:'DELETE'});setSelectedTopic(null);await refresh();notify(syncedMessage(result,'Assunto excluído.')); } catch(e){notify(e.message);} }}/>}
    {selectedExam && view === 'exams' && <ExamDrawer exam={exams.find(e=>String(e.id)===String(selectedExam.id)) || selectedExam} onClose={()=>setSelectedExam(null)} onUpdate={refresh} onDelete={async()=>{if(!confirm('Excluir esta prova e todas as respostas?'))return;try{await api(`/api/exams/${selectedExam.id}`,{method:'DELETE'});setSelectedExam(null);await refresh();notify('Prova excluída.');}catch(e){notify(e.message);}}} notify={notify}/>}
    {modal && <Modal onClose={()=>setModal(null)}>{modal.type==='topic' ? <TopicForm topic={modal.topic} disciplines={disciplines} userOffsets={user.reviewOffsets} onCreateDiscipline={onSaved=>setDisciplineEditor({onSaved})} onSave={async body=>{const result=await api(modal.topic?`/api/topics/${modal.topic.id}`:'/api/topics',{method:modal.topic?'PATCH':'POST',body:JSON.stringify(body)});setModal(null);await refresh();notify(syncedMessage(result,modal.topic?'Assunto atualizado.':'Assunto adicionado.'));}} onClose={()=>setModal(null)}/> : modal.type==='attempt' ? <AttemptForm topic={modal.topic} userOffsets={user.reviewOffsets} stage={modal.stage} onSave={async body=>{const result=await api(`/api/topics/${modal.topic.id}/attempts`,{method:'PUT',body:JSON.stringify(body)});setModal(null);await refresh();notify(syncedMessage(result,'Revisão registrada.'));}} onClose={()=>setModal(null)}/> : <ExamForm onSave={async body=>{await api('/api/exams',{method:'POST',body:JSON.stringify(body)});setModal(null);await refresh();notify('Prova criada.');}} onClose={()=>setModal(null)}/>}</Modal>}
    {disciplineEditor && <Modal onClose={()=>setDisciplineEditor(null)}><DisciplineForm discipline={disciplineEditor.discipline} colorIndex={disciplineEditor.discipline?.colorIndex??nextDisciplineColor(disciplines)} onClose={()=>setDisciplineEditor(null)} onSave={async body=>{const result=await api(disciplineEditor.discipline?`/api/disciplines/${disciplineEditor.discipline.id}`:'/api/disciplines',{method:disciplineEditor.discipline?'PATCH':'POST',body:JSON.stringify(body)});await refresh();disciplineEditor.onSaved?.(result.discipline?.id||disciplineEditor.discipline?.id);setDisciplineEditor(null);notify(syncedMessage(result,disciplineEditor.discipline?'Disciplina atualizada.':'Disciplina cadastrada.'));}}/></Modal>}
    {toast && <div className="toast"><CheckCircle2 size={19}/>{toast}<button onClick={()=>setToast('')} aria-label="Fechar aviso"><X size={16}/></button></div>}
  </div>;
}

function Stat({ icon: Icon, label, value, helper, color }) { return <div className="stat-card"><span className={`stat-icon ${color}`}><Icon size={22}/></span><div className="stat-value">{value}</div><b>{label}</b><small>{helper}</small></div>; }
function Empty({ icon: Icon, title, text, action, onClick }) { return <div className="empty-state"><span><Icon size={26}/></span><h4>{title}</h4><p>{text}</p>{action && <button className="button secondary" onClick={onClick}>{action}<ArrowRight size={16}/></button>}</div>; }
function EventRow({ event, today, onOpen, onTopic }) {
  const status = event.attempt ? 'done' : statusOf(event.date,today);
  return <div className="event-row"><div className={`event-date ${status}`}><b>{formatDate(event.date,{day:'2-digit'})}</b><small>{formatDate(event.date,{month:'short'})}</small></div><div className="event-details"><button onClick={onTopic}>{event.topic.title}</button><span>{event.topic.subject} <i>·</i> {stageName(event.stage)}</span></div><span className={`status-pill ${status}`}>{status==='done'?'Concluída':status==='overdue'?'Atrasada':status==='today'?'Hoje':'Agendada'}</span><button className="event-action" onClick={onOpen}>{event.attempt ? 'Editar' : 'Registrar'} <ArrowRight size={15}/></button></div>;
}
function Modal({ children, onClose }) { return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><div className="modal-card">{children}</div></div>; }
function ModalHead({ icon: Icon, title, subtitle, onClose }) { return <div className="modal-head"><span className="modal-icon"><Icon size={22}/></span><div><h2>{title}</h2><p>{subtitle}</p></div><button className="icon-button" onClick={onClose} aria-label="Fechar"><X size={20}/></button></div>; }
function IntervalFields({ days, onChange, prefix }) {
  const last = Number(days.at(-1));
  const canAdd = days.length < maxReviewIntervals && Boolean(validReviewOffsets(days)) && last < 3650;
  const next = Math.min(3650, Math.max(last + 1, Math.ceil(last * 1.5)));
  return <div className="interval-fields"><div className="interval-grid">{days.map((day, index) => <label key={index}>{index + 1}ª revisão <span>dias após as primeiras questões</span><input aria-label={`${prefix} ${index + 1}`} type="number" min="1" max="3650" step="1" required value={day} onChange={e => onChange(days.map((current, i) => i === index ? e.target.value : current))}/></label>)}</div><div className="interval-actions"><span>{days.length} {days.length === 1 ? 'revisão planejada' : 'revisões planejadas'} · até {maxReviewIntervals}</span><div><button type="button" className="button secondary" onClick={() => onChange(days.slice(0, -1))} disabled={days.length <= minReviewIntervals}><Trash2 size={16}/> Remover última</button><button type="button" className="button secondary" onClick={() => onChange([...days, String(next)])} disabled={!canAdd}><Plus size={16}/> Adicionar revisão</button></div></div></div>;
}
function ReviewSettings({ initial, onSave }) {
  const [days, setDays] = useState(initial.map(String));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const valid = validReviewOffsets(days);
  useEffect(() => { setDays(initial.map(String)); }, [initial.join(',')]);
  async function submit(e) {
    e.preventDefault();
    if (!valid) return setError('Use de 4 a 20 números de dias em ordem crescente.');
    setBusy(true); setError('');
    try { await onSave(valid); } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <>
    <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot"/> PLANEJAMENTO FLEXÍVEL</div><h1>Intervalos de revisão</h1><p>Escolha quando cada revisão deve aparecer na sua agenda.</p></div></div>
    <section className="panel settings-panel"><div className="settings-intro"><span className="modal-icon"><CalendarDays size={22}/></span><div><h2>Seu padrão de revisões</h2><p>Os dias são contados a partir da data das primeiras questões de cada assunto.</p></div></div>
      <form onSubmit={submit} className="settings-form"><IntervalFields days={days} onChange={setDays} prefix="Intervalo padrão da revisão"/>
        <div className="schedule-preview"><b>Exemplo a partir de hoje</b><div><span>Questões iniciais<br/><strong>{formatDate(todayLocal(),{day:'2-digit',month:'short'})}</strong></span>{days.map((day,i)=><span key={i}>Revisão {i+1}<br/><strong>{Number.isInteger(Number(day)) && Number(day) > 0 && Number(day) <= 3650 ? formatDate(addDays(todayLocal(),Number(day)),{day:'2-digit',month:'short'}) : '—'}</strong></span>)}</div></div>
        <div className="info-note"><CircleHelp size={17}/><span>Ao salvar, as datas planejadas dos assuntos que usam o padrão serão recalculadas. Seus resultados já registrados continuam salvos. Assuntos com intervalos próprios não mudam.</span></div>
        {!valid && <div className="form-error">Informe de 4 a 20 intervalos em ordem crescente, entre 1 e 3650 dias.</div>}
        {error && <div className="form-error">{error}</div>}
        <button className="button primary settings-save" disabled={busy || !valid}>{busy ? 'Salvando...' : 'Salvar intervalos'} <Check size={17}/></button>
      </form>
    </section>
  </>;
}
function ProfileSettings({ user, onProfileSave, onPasswordSave, notify }) {
  const [details, setDetails] = useState({ name: user.name, email: user.email, currentPassword: '' });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [detailsBusy, setDetailsBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const emailChanged = details.email.trim().toLowerCase() !== user.email;

  async function saveDetails(e) {
    e.preventDefault(); setDetailsBusy(true); setDetailsError('');
    try {
      await onProfileSave(details);
      setDetails(current => ({ ...current, currentPassword: '' }));
    } catch (err) { setDetailsError(err.message); }
    finally { setDetailsBusy(false); }
  }
  async function savePassword(e) {
    e.preventDefault(); setPasswordError('');
    if (passwords.newPassword !== passwords.confirmPassword) return setPasswordError('A confirmação não corresponde à nova senha.');
    setPasswordBusy(true);
    try {
      await onPasswordSave({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword });
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) { setPasswordError(err.message); }
    finally { setPasswordBusy(false); }
  }
  return <>
    <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot"/> SUA CONTA</div><h1>Meu perfil</h1><p>Atualize seus dados de acesso e como você aparece no Revisa.</p></div></div>
    <div className="profile-grid grid items-stretch gap-5">
      <section className="panel settings-panel"><div className="settings-intro"><span className="modal-icon"><LockKeyhole size={22}/></span><div><h2>Alterar senha</h2><p>Uma nova senha encerra as sessões em outros dispositivos.</p></div></div>
        <form className="settings-form profile-form" onSubmit={savePassword}>
          <label>Senha atual<input type="password" autoComplete="current-password" required value={passwords.currentPassword} onChange={e => setPasswords({ ...passwords, currentPassword: e.target.value })}/></label>
          <label>Nova senha<input type="password" autoComplete="new-password" required minLength={10} maxLength={128} value={passwords.newPassword} onChange={e => setPasswords({ ...passwords, newPassword: e.target.value })} placeholder="Mínimo de 10 caracteres"/></label>
          <label>Confirmar nova senha<input type="password" autoComplete="new-password" required minLength={10} maxLength={128} value={passwords.confirmPassword} onChange={e => setPasswords({ ...passwords, confirmPassword: e.target.value })}/></label>
          {passwordError && <div className="form-error" role="alert">{passwordError}</div>}
          <button className="button primary settings-save" disabled={passwordBusy}>{passwordBusy ? 'Atualizando...' : 'Atualizar senha'} <Check size={17}/></button>
        </form>
      </section>
      <section className="panel settings-panel"><div className="settings-intro"><span className="modal-icon"><UserRound size={22}/></span><div><h2>Informações pessoais</h2><p>Seu nome e e-mail de acesso.</p></div></div>
        <form className="settings-form profile-form" onSubmit={saveDetails}>
          <label>Nome<input autoComplete="name" required minLength={2} maxLength={100} value={details.name} onChange={e => setDetails({ ...details, name: e.target.value })}/></label>
          <label>E-mail<input type="email" autoComplete="email" required maxLength={254} value={details.email} onChange={e => setDetails({ ...details, email: e.target.value })}/></label>
          {emailChanged && <><label>Senha atual<input type="password" autoComplete="current-password" required value={details.currentPassword} onChange={e => setDetails({ ...details, currentPassword: e.target.value })}/></label><div className="info-note"><LockKeyhole size={17}/><span>Para alterar seu e-mail de acesso, confirme sua senha atual.</span></div></>}
          {detailsError && <div className="form-error" role="alert">{detailsError}</div>}
          <button className="button primary settings-save" disabled={detailsBusy || (!emailChanged && details.name.trim() === user.name)}>{detailsBusy ? 'Salvando...' : 'Salvar informações'} <Check size={17}/></button>
        </form>
      </section>
      <GoogleCalendarSettings notify={notify}/>
    </div>
  </>;
}
function TopicForm({ topic, disciplines, userOffsets, onSave, onClose, onCreateDiscipline }) {
  const [form,setForm]=useState({ disciplineId:String(topic?.disciplineId||''), title:topic?.title||'', lessonDate:dateOnly(topic?.lessonDate)||'', practiceDate:dateOnly(topic?.practiceDate)||todayLocal(), priority:topic?.priority||'Média', reviewOffsets:(topic?.reviewOffsets || userOffsets || offsets.slice(1)).map(String) });
  const [custom,setCustom]=useState(Boolean(topic?.reviewOffsets));
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function submit(e){e.preventDefault();if(!form.disciplineId)return setError('Selecione uma disciplina.');if(custom && !validReviewOffsets(form.reviewOffsets)) return setError('Use de 4 a 20 intervalos em ordem crescente.');setBusy(true);setError('');try{await onSave({...form,disciplineId:Number(form.disciplineId),reviewOffsets:custom ? validReviewOffsets(form.reviewOffsets) : null});}catch(err){setError(err.message);setBusy(false);}}
  return <>
    <ModalHead icon={BookOpen} title={topic?'Editar assunto':'Novo assunto'} subtitle="Vincule o conteúdo à disciplina correspondente." onClose={onClose}/>
    <form className="modal-form grid gap-[17px]" onSubmit={submit}>
      <div className="discipline-select-block">
        <div className="form-label-row">
          <label htmlFor="topic-discipline">Disciplina</label>
          <div className="form-label-actions"><button type="button" className="quick-create-button" onClick={()=>onCreateDiscipline(id=>setForm(current=>({...current,disciplineId:String(id)})))}><Plus size={15}/> Nova disciplina</button></div>
        </div>
        <SelectMenu id="topic-discipline" required ariaLabel="Disciplina" value={form.disciplineId} onChange={disciplineId=>setForm({...form,disciplineId})} disabled={!disciplines.length} options={[{ value:'', label:'Selecione uma disciplina' }, ...disciplines.map(discipline=>({ value:discipline.id, label:discipline.name }))]}/>
      </div>
      {!disciplines.length&&<div className="info-note discipline-empty-note"><BookOpen size={17}/><span>Cadastre a primeira disciplina pelo botão acima para continuar.</span></div>}
      <label>Assunto<input required maxLength={240} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Ex.: Morfologia"/></label>
      <div className="form-grid topic-date-grid"><label><span className="field-label">Data da aula <small>(opcional)</small></span><input type="date" value={form.lessonDate} onChange={e=>setForm({...form,lessonDate:e.target.value})}/></label><label><span className="field-label">Primeiras questões</span><input type="date" required value={form.practiceDate} onChange={e=>setForm({...form,practiceDate:e.target.value})}/></label></div>
      <div className="modal-select-field"><label htmlFor="topic-priority">Prioridade</label><SelectMenu id="topic-priority" ariaLabel="Prioridade" value={form.priority} onChange={priority=>setForm({...form,priority})} options={['Alta','Média','Baixa']}/></div>
      <label className="custom-toggle"><input type="checkbox" checked={custom} onChange={e=>setCustom(e.target.checked)}/><span><b>Intervalos próprios para este assunto</b><small>{custom ? 'Defina os dias abaixo.' : `Usando o padrão: ${(userOffsets || offsets.slice(1)).join(', ')} dias.`}</small></span></label>
      {custom&&<IntervalFields days={form.reviewOffsets} onChange={reviewOffsets=>setForm({...form,reviewOffsets})} prefix="Intervalo deste assunto para a revisão"/>}
      <div className="info-note"><CalendarDays size={17}/><span>As datas são calculadas após as primeiras questões. Você pode alterar o padrão geral em Intervalos.</span></div>
      {error&&<div className="form-error">{error}</div>}
      <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancelar</button><button className="button primary" disabled={busy || !disciplines.length || (custom && !validReviewOffsets(form.reviewOffsets))}>{busy?'Salvando...':topic?'Salvar alterações':'Adicionar assunto'}<ArrowRight size={17}/></button></div>
    </form>
  </>;
}
function DisciplineForm({ discipline, colorIndex, onSave, onClose }) {
  const [name,setName]=useState(discipline?.name||'');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  async function submit(e){e.preventDefault();setBusy(true);setError('');try{await onSave({name});}catch(failure){setError(failure.message);setBusy(false);}}
  return <><ModalHead icon={BookOpen} title={discipline?'Editar disciplina':'Nova disciplina'} subtitle={discipline?'Atualize o nome usado em todos os assuntos vinculados.':'Crie uma disciplina para organizar seus assuntos.'} onClose={onClose}/><form className="modal-form discipline-register-form grid gap-[17px]" onSubmit={submit}><label>Nome da disciplina<input autoFocus required minLength={2} maxLength={120} value={name} onChange={e=>setName(e.target.value)} placeholder="Ex.: Matemática"/></label><div className="discipline-color-preview"><span className={`topic-icon color-${colorIndex}`}><BookOpen size={17}/></span><div><b>Cor definida automaticamente</b><small>Todos os assuntos desta disciplina usarão a mesma cor em toda a aplicação.</small></div></div>{error&&<div className="form-error" role="alert">{error}</div>}<div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancelar</button><button className="button primary" disabled={busy||name.trim().length<2}>{busy?'Salvando...':discipline?'Salvar alterações':'Cadastrar disciplina'}<ArrowRight size={17}/></button></div></form></>;
}
function DisciplinePage({ disciplines, topicCount, onChanged, notify, onCreate, onEdit, onViewTopics }) {
  const [busyId,setBusyId]=useState(null);
  const [error,setError]=useState('');
  async function remove(discipline) {
    const count=Number(discipline.topicCount)||0;
    const detail=count?` Esta ação também excluirá ${count} ${count===1?'assunto vinculado':'assuntos vinculados'} e seus históricos.`:'';
    if(!confirm(`Excluir a disciplina “${discipline.name}”?${detail}`)) return;
    setBusyId(discipline.id);setError('');
    try { const result=await api(`/api/disciplines/${discipline.id}`,{method:'DELETE'});await onChanged();notify(syncedMessage(result,'Disciplina excluída.')); }
    catch(failure) { setError(failure.message); }
    finally { setBusyId(null); }
  }
  const activeCount=disciplines.filter(discipline=>Number(discipline.topicCount)>0).length;
  return <>
    <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot"/> ORGANIZE SEUS CONTEÚDOS</div><h1>Minhas disciplinas</h1><p>Cadastre as áreas de estudo e mantenha seus assuntos organizados por disciplina.</p></div><button className="button primary" onClick={onCreate}><Plus size={18}/> Nova disciplina</button></div>
    <div className="topics-summary discipline-summary"><div><Library size={20}/><b>{disciplines.length}</b><span>disciplinas cadastradas</span></div><div><BookOpen size={20}/><b>{topicCount}</b><span>assuntos vinculados</span></div><div><CheckCircle2 size={20}/><b>{activeCount}</b><span>disciplinas com assuntos</span></div></div>
    {error&&<div className="form-error discipline-page-error" role="alert">{error}</div>}
    <section className="panel discipline-page-table">
      {disciplines.length ? <><div className="discipline-table-head"><span>DISCIPLINA</span><span>ASSUNTOS</span><span>AÇÕES</span></div><div className="discipline-table-body">{disciplines.map(discipline=><div className="discipline-table-row" key={discipline.id}><div className="discipline-name"><span className={`topic-icon color-${discipline.colorIndex}`}><BookOpen size={17}/></span><div><b>{discipline.name}</b><small>Cor aplicada automaticamente aos assuntos</small></div></div><button className="discipline-topic-link" type="button" onClick={()=>onViewTopics(discipline)}>{discipline.topicCount} {discipline.topicCount===1?'assunto':'assuntos'}<ChevronRight size={16}/></button><div className="discipline-row-actions"><button className="icon-button" type="button" onClick={()=>onEdit(discipline)} disabled={busyId!==null} aria-label={`Editar ${discipline.name}`} title="Editar"><Pencil size={17}/></button><button className="icon-button discipline-delete" type="button" onClick={()=>remove(discipline)} disabled={busyId!==null} aria-label={`Excluir ${discipline.name}`} title="Excluir"><Trash2 size={17}/></button></div></div>)}</div></> : <Empty icon={Library} title="Nenhuma disciplina cadastrada" text="Crie sua primeira disciplina para começar a organizar os assuntos." action="Nova disciplina" onClick={onCreate}/>}
    </section>
  </>;
}
function AttemptForm({ topic, stage, userOffsets, onSave, onClose }) {
  const attempt=topic.attempts?.find(a=>Number(a.stage)===stage);
  const [form,setForm]=useState({stage,total:attempt?.total??20,correct:attempt?.correct??'',completedAt:dateOnly(attempt?.completedAt)||todayLocal()});
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function submit(e){e.preventDefault();setBusy(true);setError('');try{await onSave(form);}catch(err){setError(err.message);setBusy(false);}}
  return <><ModalHead icon={CheckCircle2} title={attempt?'Editar resultado':'Registrar revisão'} subtitle={`${stageName(stage)} · ${topic.title}`} onClose={onClose}/><form className="modal-form grid gap-[17px]" onSubmit={submit}><div className="session-schedule"><CalendarDays size={19}/><div><b>Data planejada</b><span>{formatDate(stageDate(topic,stage,userOffsets),{day:'2-digit',month:'long',year:'numeric'})}</span></div><span className="stage-tag">{stageShort(stage)}</span></div><div className="form-grid"><label>Questões respondidas<input type="number" min="1" max="10000" required value={form.total} onChange={e=>setForm({...form,total:e.target.value})}/></label><label>Acertos<input type="number" min="0" max={form.total} required value={form.correct} onChange={e=>setForm({...form,correct:e.target.value})}/></label></div><label>Data em que você revisou<input type="date" required value={form.completedAt} onChange={e=>setForm({...form,completedAt:e.target.value})}/></label>{form.total>0&&form.correct!==''&&Number(form.correct)<=Number(form.total)&&<div className="result-preview"><span>Seu desempenho</span><strong>{pct(Number(form.correct),Number(form.total))}%</strong><div className="progress-track"><div style={{width:`${pct(Number(form.correct),Number(form.total))}%`}}/></div></div>}{attempt?.imported&&<div className="info-note"><CircleHelp size={17}/><span>A planilha não informa a data real desta revisão. Ao salvar, a data acima ficará registrada.</span></div>}{error&&<div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancelar</button><button className="button primary" disabled={busy}>{busy?'Salvando...':'Salvar resultado'}<Check size={17}/></button></div></form></>;
}
function ExamForm({ onSave, onClose }) {
  const [form,setForm]=useState({title:'',examDate:todayLocal(),questionCount:100});
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function submit(e){e.preventDefault();setBusy(true);setError('');try{await onSave(form);}catch(err){setError(err.message);setBusy(false);}}
  return <><ModalHead icon={Target} title="Nova prova" subtitle="Crie uma prova para registrar suas respostas." onClose={onClose}/><form className="modal-form grid gap-[17px]" onSubmit={submit}><label>Nome da prova<input required maxLength={200} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Ex.: Simulado INSS 01"/></label><div className="form-grid"><label>Data da prova <small>(opcional)</small><input type="date" value={form.examDate} onChange={e=>setForm({...form,examDate:e.target.value})}/></label><label>Quantidade de questões<input type="number" min="1" max="300" required value={form.questionCount} onChange={e=>setForm({...form,questionCount:e.target.value})}/></label></div>{error&&<div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancelar</button><button className="button primary" disabled={busy}>{busy?'Criando...':'Criar prova'}<ArrowRight size={17}/></button></div></form></>;
}
function TopicDrawer({ topic, userOffsets, today, onClose, onAttempt, onEdit, onDelete }) {
  const total=topic.attempts?.reduce((n,a)=>n+Number(a.total),0)||0;
  const correct=topic.attempts?.reduce((n,a)=>n+Number(a.correct),0)||0;
  return <div className="drawer-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><div className="drawer"><div className="drawer-top"><span className="drawer-kicker">DETALHES DO ASSUNTO</span><button className="icon-button" onClick={onClose} aria-label="Fechar"><X size={21}/></button></div><span className="drawer-subject">{topic.subject}</span><h2>{topic.title}</h2><div className="drawer-tags"><span className={`priority-pill ${topic.priority.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'')}`}>{topic.priority}</span><span><CalendarDays size={15}/> Questões em {formatDate(topic.practiceDate,{day:'2-digit',month:'short',year:'numeric'})}</span></div><div className="drawer-stats"><div><b>{topic.attempts?.length||0}/{topicOffsets(topic,userOffsets).length+1}</b><span>revisões feitas</span></div><div><b>{pct(correct,total)}%</b><span>de acertos</span></div><div><b>{total}</b><span>questões</span></div></div><div className="drawer-section-head"><h3>Linha do tempo</h3><span>{topicOffsets(topic,userOffsets).map(n=>`+${n}`).join(' · ')} dias</span></div><div className="timeline">{Array.from({length:topicOffsets(topic,userOffsets).length+1},(_,stage)=>{const attempt=topic.attempts?.find(a=>Number(a.stage)===stage);const date=stageDate(topic,stage,userOffsets);const status=attempt?'done':statusOf(date,today);return <div className={`timeline-item ${status}`} key={stage}><span className="timeline-marker">{attempt?<Check size={14}/>:stage+1}</span><div><b>{stageName(stage)}</b><small>{formatDate(date,{day:'2-digit',month:'long',year:'numeric'})}</small>{attempt&&<span className="timeline-result">{attempt.correct}/{attempt.total} acertos · {pct(Number(attempt.correct),Number(attempt.total))}%{attempt.imported?' · importado':''}</span>}</div><button onClick={()=>onAttempt(stage)}>{attempt?'Editar':'Registrar'}<ArrowRight size={14}/></button></div>;})}</div><div className="drawer-bottom"><button className="button secondary" onClick={onEdit}><Settings2 size={17}/> Editar assunto</button><button className="delete-button" onClick={onDelete}><Trash2 size={17}/> Excluir</button></div></div></div>;
}
function ExamDrawer({ exam, onClose, onUpdate, onDelete, notify }) {
  const answers = new Map(exam.answers.map(a=>[Number(a.questionNumber),a.result]));
  const correct=exam.answers.filter(a=>a.result==='correct').length;
  const wrong=exam.answers.filter(a=>a.result==='wrong').length;
  const [busy,setBusy]=useState(false);
  async function toggle(number){if(busy)return;const old=answers.get(number);const result=old==='correct'?'wrong':old==='wrong'?null:'correct';setBusy(true);try{await api(`/api/exams/${exam.id}/answers`,{method:'PUT',body:JSON.stringify({questionNumber:number,result})});await onUpdate();}catch(e){notify(e.message);}finally{setBusy(false);}}
  return <div className="drawer-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><div className="drawer exam-drawer"><div className="drawer-top"><span className="drawer-kicker">PROVA COMPLETA</span><button className="icon-button" onClick={onClose} aria-label="Fechar"><X size={21}/></button></div><span className="drawer-subject">{exam.examDate?formatDate(exam.examDate,{day:'2-digit',month:'long',year:'numeric'}):'SEM DATA'}</span><h2>{exam.title}</h2><div className="exam-drawer-stats"><div><b>{correct}</b><span>acertos</span></div><div><b>{wrong}</b><span>erros</span></div><div><b>{pct(correct,correct+wrong)}%</b><span>aproveitamento</span></div></div><div className="drawer-section-head"><h3>Gabarito</h3><span>{exam.answers.length}/{exam.questionCount} respondidas</span></div><p className="question-help">Toque em uma questão para alternar entre <b>acerto</b>, <b>erro</b> e <b>sem resposta</b>.</p><div className="question-grid">{Array.from({length:exam.questionCount},(_,i)=>{const number=i+1;const result=answers.get(number);return <button key={number} disabled={busy} onClick={()=>toggle(number)} className={`question-cell ${result||''}`} title={`Questão ${number}: ${result==='correct'?'acerto':result==='wrong'?'erro':'sem resposta'}`}>{number}</button>;})}</div><div className="question-legend"><span><i className="correct"/> Acerto</span><span><i className="wrong"/> Erro</span><span><i/> Sem resposta</span></div><div className="drawer-bottom"><button className="delete-button" onClick={onDelete}><Trash2 size={17}/> Excluir prova</button></div></div></div>;
}
