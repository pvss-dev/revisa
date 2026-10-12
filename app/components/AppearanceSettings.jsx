'use client';

import { useEffect, useState } from 'react';
import { Check, CircleHelp, Monitor, Moon, Palette, RotateCcw, Sun } from 'lucide-react';
import { appearanceColors, defaultAppearance, normalizeHex } from '@/lib/appearance';

const themes = [
  { key: 'light', label: 'Claro', detail: 'Fundos claros e leitura leve.', icon: Sun },
  { key: 'dark', label: 'Escuro', detail: 'Menos brilho para estudar à noite.', icon: Moon },
  { key: 'auto', label: 'Automático', detail: 'Acompanha a preferência do dispositivo.', icon: Monitor },
];

export default function AppearanceSettings({ appearance, onPreview, onSave }) {
  const [customHex, setCustomHex] = useState(appearance.accentColor);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setCustomHex(appearance.accentColor); }, [appearance.accentColor]);

  async function save(next) {
    setError('');
    setBusy(true);
    try { await onSave(next); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }

  function changeCustom(value) {
    setCustomHex(value);
    const accentColor = normalizeHex(value);
    if (accentColor) onPreview({ ...appearance, accentColor });
  }

  function applyCustom(event) {
    event.preventDefault();
    const accentColor = normalizeHex(customHex);
    if (!accentColor) return setError('Informe uma cor HEX válida, como #2563EB.');
    save({ ...appearance, accentColor });
  }

  const customSelected = !appearanceColors.some(color => color.hex === appearance.accentColor);

  return <>
    <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot"/> DO SEU JEITO</div><h1>Aparência</h1><p>Escolha um tema e uma cor para seu espaço de estudo.</p></div></div>
    <div className="appearance-layout">
      <section className="panel settings-panel"><div className="settings-intro"><span className="modal-icon"><Sun size={22}/></span><div><h2>Tema</h2><p>A mudança aparece em todas as telas imediatamente.</p></div></div>
        <div className="appearance-section"><div className="appearance-theme-grid">{themes.map(({ key, label, detail, icon: Icon }) => <button key={key} type="button" className={`appearance-theme ${appearance.theme === key ? 'selected' : ''}`} aria-pressed={appearance.theme === key} disabled={busy} onClick={() => save({ ...appearance, theme: key })}><span className="appearance-theme-icon"><Icon size={22}/></span><span className="appearance-theme-copy"><b>{label}</b><small>{detail}</small></span><span className="appearance-selected-icon"><Check size={16}/></span></button>)}</div></div>
      </section>
      <section className="panel settings-panel"><div className="settings-intro"><span className="modal-icon"><Palette size={22}/></span><div><h2>Cor principal</h2><p>Personalize botões, links, seleções e indicadores.</p></div></div>
        <div className="appearance-section"><h3>Paleta de cores</h3><div className="appearance-swatches">{appearanceColors.map(color => <button key={color.hex} type="button" className={`appearance-swatch ${appearance.accentColor === color.hex ? 'selected' : ''}`} aria-label={color.name} aria-pressed={appearance.accentColor === color.hex} disabled={busy} onClick={() => save({ ...appearance, accentColor: color.hex })}><span className="appearance-swatch-dot" style={{ backgroundColor: color.hex }}/><span>{color.name}</span>{appearance.accentColor === color.hex && <Check size={15}/>}</button>)}</div>
          <div className="appearance-custom"><div><h3>Cor personalizada {customSelected && <span className="appearance-custom-badge">Selecionada</span>}</h3><p>Use o seletor ou digite um código HEX.</p></div><form onSubmit={applyCustom} className="appearance-custom-form"><label className="appearance-color-picker" aria-label="Escolher cor personalizada"><input type="color" value={normalizeHex(customHex) || appearance.accentColor} onChange={event => changeCustom(event.target.value)}/></label><label className="appearance-hex-field">Código HEX<input aria-label="Código HEX" value={customHex} maxLength={7} onChange={event => changeCustom(event.target.value)} placeholder="#2563EB" spellCheck={false}/></label><button className="button primary" type="submit" disabled={busy || !normalizeHex(customHex)}>Aplicar cor</button></form></div>
          <div className="info-note"><CircleHelp size={17}/><span>O Revisa ajusta tons e contraste automaticamente quando necessário para manter a leitura confortável.</span></div>
          {error && <div className="form-error" role="alert">{error}</div>}
        </div>
      </section>
      <div className="appearance-footer"><span>Suas escolhas são salvas na sua conta e acompanham você em outros dispositivos.</span><button className="button secondary" type="button" disabled={busy || (appearance.theme === defaultAppearance.theme && appearance.accentColor === defaultAppearance.accentColor)} onClick={() => save(defaultAppearance)}><RotateCcw size={17}/> Restaurar padrão</button></div>
    </div>
  </>;
}
