'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarSync, ChevronLeft, ChevronRight, ExternalLink, RefreshCw } from 'lucide-react';
import { addDays } from '@/lib/validation';

const weekDays = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

function localToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function firstDayOfMonth(date) {
  return `${date.slice(0, 7)}-01`;
}

function shiftMonth(date, amount) {
  const value = new Date(`${firstDayOfMonth(date)}T12:00:00.000Z`);
  value.setUTCMonth(value.getUTCMonth() + amount);
  return value.toISOString().slice(0, 10);
}

function monthLabel(date) {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${date}T12:00:00.000Z`));
}

function localDateTimeDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function eventTime(event) {
  if (event.allDay) return '';
  const date = new Date(event.start);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function localEventTitle(event) {
  const stage = Number(event.stage) === 0 ? 'Questões iniciais' : `Revisão ${event.stage}`;
  return `${stage}: ${event.topic.title}`;
}

export default function AgendaCalendar({ localEvents, selectedDate, today, onSelectDate }) {
  const currentDate = today || localToday();
  const [visibleMonth, setVisibleMonth] = useState(() => firstDayOfMonth(currentDate));
  const [googleState, setGoogleState] = useState({ loading: true, connected: false, events: [], error: '', needsAdditionalPermission: false, calendarCount: 0 });
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (today) setVisibleMonth(firstDayOfMonth(today));
  }, [today]);

  const range = useMemo(() => {
    const first = firstDayOfMonth(visibleMonth);
    const day = new Date(`${first}T12:00:00.000Z`).getUTCDay();
    const start = addDays(first, -day);
    return { start, end: addDays(start, 42) };
  }, [visibleMonth]);

  useEffect(() => {
    const controller = new AbortController();
    setGoogleState(current => ({ ...current, loading: true, error: '' }));
    fetch(`/api/integrations/google/events?start=${range.start}&end=${range.end}`, {
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
    }).then(async response => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Não foi possível carregar o Google Calendar.');
      setGoogleState({
        loading: false,
        connected: Boolean(data.connected),
        events: data.events || [],
        error: '',
        needsAdditionalPermission: Boolean(data.needsAdditionalPermission),
        calendarCount: Number(data.calendarCount) || 0,
      });
    }).catch(failure => {
      if (failure.name !== 'AbortError') setGoogleState(current => ({ ...current, loading: false, error: failure.message }));
    });
    return () => controller.abort();
  }, [range.start, range.end, reload]);

  const days = useMemo(() => Array.from({ length: 42 }, (_, index) => addDays(range.start, index)), [range.start]);
  const entriesByDate = useMemo(() => {
    const grouped = new Map();
    const add = (date, entry) => {
      if (!date || date < range.start || date >= range.end) return;
      const list = grouped.get(date) || [];
      list.push(entry);
      grouped.set(date, list);
    };

    localEvents.forEach(event => add(event.date, {
      id: `revisa-${event.topic.id}-${event.stage}`,
      source: 'revisa',
      title: localEventTitle(event),
      colorIndex: Math.abs(Number(event.topic?.discipline?.colorIndex) || 0) % 5,
    }));

    googleState.events.filter(event => !event.managedByRevisa).forEach(event => {
      const start = event.allDay ? String(event.start).slice(0, 10) : localDateTimeDate(event.start);
      const entry = { ...event, source: 'google', time: eventTime(event) };
      if (event.allDay && event.end) {
        const exclusiveEnd = String(event.end).slice(0, 10);
        const firstVisibleDate = start < range.start ? range.start : start;
        const lastVisibleDate = exclusiveEnd > range.end ? range.end : exclusiveEnd;
        for (let date = firstVisibleDate; date && date < lastVisibleDate; date = addDays(date, 1)) add(date, entry);
      } else add(start, entry);
    });

    grouped.forEach(list => list.sort((a, b) => a.source.localeCompare(b.source) || String(a.time || '').localeCompare(String(b.time || '')) || a.title.localeCompare(b.title)));
    return grouped;
  }, [googleState.events, localEvents, range.end, range.start]);

  function selectDay(date) {
    if (!date.startsWith(visibleMonth.slice(0, 7))) setVisibleMonth(firstDayOfMonth(date));
    onSelectDate(date);
  }

  function goToday() {
    setVisibleMonth(firstDayOfMonth(currentDate));
    onSelectDate(currentDate);
  }

  return <section className="panel agenda-calendar" aria-label="Calendário mensal">
    <div className="agenda-calendar-head">
      <div>
        <span className="section-overline">CALENDÁRIO MENSAL</span>
        <h2>{monthLabel(visibleMonth)}</h2>
        <div className={`calendar-source ${googleState.error ? 'error' : ''}`}>
          <CalendarSync size={14}/>
          {googleState.loading
            ? 'Atualizando Google Calendar...'
            : googleState.error
              ? googleState.error
              : googleState.connected
                ? googleState.needsAdditionalPermission
                  ? 'Reconecte a conta Google pelo perfil para atualizar a integração'
                  : `${googleState.calendarCount} ${googleState.calendarCount === 1 ? 'calendário conectado' : 'calendários conectados'}`
                : <a href="/perfil">Conecte o Google Calendar no seu perfil</a>}
        </div>
      </div>
      <div className="calendar-controls">
        <button type="button" className="icon-button" onClick={() => setVisibleMonth(current => shiftMonth(current, -1))} aria-label="Mês anterior"><ChevronLeft size={19}/></button>
        <button type="button" className="calendar-today-button" onClick={goToday}>Hoje</button>
        <button type="button" className="icon-button" onClick={() => setVisibleMonth(current => shiftMonth(current, 1))} aria-label="Próximo mês"><ChevronRight size={19}/></button>
        <button type="button" className="icon-button calendar-refresh" onClick={() => setReload(value => value + 1)} aria-label="Atualizar eventos do Google Calendar" disabled={googleState.loading}><RefreshCw className={googleState.loading ? 'spinning' : ''} size={17}/></button>
      </div>
    </div>
    <div className="agenda-calendar-scroll">
      <div className="agenda-calendar-grid" role="grid" aria-label={monthLabel(visibleMonth)}>
        {weekDays.map(day => <div className="calendar-weekday" role="columnheader" key={day}>{day}</div>)}
        {days.map(date => {
          const entries = entriesByDate.get(date) || [];
          const outside = !date.startsWith(visibleMonth.slice(0, 7));
          return <div
            className={`calendar-month-day ${outside ? 'outside' : ''} ${date === currentDate ? 'today' : ''} ${date === selectedDate ? 'selected' : ''}`}
            role="gridcell"
            tabIndex={0}
            aria-label={`Filtrar agenda em ${date}`}
            aria-selected={date === selectedDate}
            onClick={() => selectDay(date)}
            onKeyDown={event => {
              if (event.currentTarget !== event.target || (event.key !== 'Enter' && event.key !== ' ')) return;
              event.preventDefault();
              selectDay(date);
            }}
            key={date}
          >
            <span className="calendar-day-number" aria-hidden="true">{Number(date.slice(8, 10))}</span>
            <div className="calendar-day-events">
              {entries.slice(0, 2).map(entry => entry.source === 'google' && entry.link
                ? <a className="calendar-month-event google" href={entry.link} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()} title={`${entry.title}${entry.calendarName ? ` — ${entry.calendarName}` : ''}`} key={`${entry.id}-${date}`}>{entry.time&&<span className="event-time">{entry.time}</span>}<span className="event-title">{entry.title}</span><ExternalLink size={11}/></a>
                : <button type="button" className={`calendar-month-event ${entry.source} ${entry.source === 'revisa' ? `color-${entry.colorIndex}` : ''}`} onClick={() => selectDay(date)} title={entry.title} key={`${entry.id}-${date}`}>{entry.time&&<span className="event-time">{entry.time}</span>}<span className="event-title">{entry.title}</span></button>)}
              {entries.length > 2 && <button type="button" className="calendar-more" onClick={() => selectDay(date)}>+{entries.length - 2} eventos</button>}
            </div>
          </div>;
        })}
      </div>
    </div>
    <div className="calendar-legend"><span><i className="revisa"/>Revisões do Revisa</span>{googleState.connected && <span><i className="google"/>Eventos dos calendários Google</span>}</div>
  </section>;
}
