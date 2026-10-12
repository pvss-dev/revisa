'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CalendarSync, CheckCircle2, Link2, RefreshCw, Unlink } from 'lucide-react';

async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a operação.');
  return data;
}

function syncDate(value) {
  if (!value) return 'Ainda não sincronizado';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Cuiaba',
  }).format(new Date(value));
}

export default function GoogleCalendarSettings({ notify }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    try {
      setStatus(await request('/api/integrations/google/status'));
      setError('');
    } catch (failure) { setError(failure.message); }
  }

  useEffect(() => {
    load();
    const params = new URLSearchParams(window.location.search);
    const result = params.get('google');
    if (result) {
      const messages = {
        connected: 'Google Calendar conectado. A sincronização inicial foi iniciada.',
        'sync-error': 'Conta conectada. Algumas revisões aguardam uma nova tentativa de sincronização.',
        denied: 'A conexão com o Google Calendar foi cancelada.',
        'invalid-state': 'A conexão expirou. Inicie o processo novamente.',
        failed: 'Não foi possível concluir a conexão com o Google Calendar.',
        'login-required': 'Entre novamente antes de conectar o Google Calendar.',
      };
      notify?.(messages[result] || 'A conexão com o Google Calendar não foi concluída.');
      window.history.replaceState(window.history.state, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!status?.connected || !status.pending || status.lastError) return undefined;
    const timer = window.setTimeout(load, 2000);
    return () => window.clearTimeout(timer);
  }, [status?.connected, status?.pending, status?.lastError]);

  async function synchronize() {
    setBusy(true); setError('');
    try {
      const result = await request('/api/integrations/google/sync', { method: 'POST' });
      setStatus(result.status);
      notify?.('Google Calendar sincronizado.');
    } catch (failure) {
      setError(failure.message);
      await load();
    } finally { setBusy(false); }
  }

  async function disconnect() {
    if (!window.confirm('Desconectar o Google Calendar e remover dele todos os eventos criados pelo Revisa?')) return;
    setBusy(true); setError('');
    try {
      await request('/api/integrations/google', { method: 'DELETE' });
      await load();
      notify?.('Google Calendar desconectado.');
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }

  return <section className="panel settings-panel google-calendar-panel">
    <div className="settings-intro"><span className="modal-icon"><CalendarSync size={22}/></span><div><h2>Google Calendar</h2><p>Mantenha as revisões do Revisa atualizadas automaticamente no seu calendário.</p></div></div>
    <div className="google-calendar-content">
      {!status && !error && <div className="integration-loading"><RefreshCw size={18}/><span>Verificando a integração...</span></div>}
      {status && !status.configured && <div className="integration-state warning"><AlertCircle size={21}/><div><b>Integração aguardando configuração</b><span>As credenciais do Google Calendar ainda precisam ser adicionadas ao ambiente de produção.</span></div></div>}
      {status?.configured && !status.connected && <div className="integration-connect"><div className="integration-state"><CalendarSync size={22}/><div><b>Conecte sua conta Google</b><span>O Revisa criará, atualizará e removerá os eventos conforme você alterar seu planejamento.</span></div></div><button type="button" className="button primary" onClick={() => window.location.assign('/api/integrations/google/connect')}><Link2 size={17}/> Conectar Google Calendar</button></div>}
      {status?.connected && <>
        <div className="integration-account">
          <div className="integration-state success"><CheckCircle2 size={22}/><div><b>Sincronização ativa</b><span>{status.email || 'Conta Google conectada'}</span></div></div>
          <dl><div><dt>Última sincronização</dt><dd>{syncDate(status.lastSyncAt)}</dd></div><div><dt>Operações pendentes</dt><dd>{status.pending}</dd></div></dl>
        </div>
        {status.lastError && <div className="integration-state error" role="alert"><AlertCircle size={20}/><div><b>Falha na última sincronização</b><span>{status.lastError}</span></div></div>}
        <div className="integration-actions"><button type="button" className="button secondary danger" disabled={busy} onClick={disconnect}><Unlink size={17}/> Desconectar</button><button type="button" className="button primary" disabled={busy} onClick={synchronize}><RefreshCw size={17} className={busy ? 'spinning' : ''}/>{busy ? 'Sincronizando...' : status.lastError || status.pending ? 'Tentar novamente' : 'Sincronizar agora'}</button></div>
      </>}
      {error && <div className="form-error" role="alert">{error}</div>}
    </div>
  </section>;
}
