import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider, Group, GroupItem, Button, Input } from '@telegram-tools/ui-kit';
import '@telegram-tools/ui-kit/index.css';
import './style.css';
import Admin from './Admin.jsx';

const tg = window.Telegram?.WebApp;
const native = Boolean(tg?.initData && tg.isVersionAtLeast?.('6.1'));
const secondary = native && tg.isVersionAtLeast('7.10');
const fullscreenCapable = Boolean(native && typeof tg?.requestFullscreen === 'function');
const titles = { home: 'Участие', news: 'Объявления', about: 'О проекте', admin: 'Управление' };

function Icon({ name, className = '' }) {
  const paths = {
    home: 'M3.5 10.5 12 3l8.5 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-4.5v-6h-5v6H5a1.5 1.5 0 0 1-1.5-1.5v-9Z',
    news: 'M4 5.5h11.5A2.5 2.5 0 0 1 18 8v10.5H6A2 2 0 0 1 4 16.5v-11Zm14 4h2v7a2 2 0 0 1-2 2M7.5 9h7M7.5 12.5h7M7.5 16h4',
    about: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-10v6m0-9h.01',
    steam: 'M7.2 16.8 10 18a3.2 3.2 0 1 0 1.1-4.7l-1.9-.8m1.9.8 3.5-3.5M18 4.5a4.5 4.5 0 1 1-4.5 4.5A4.5 4.5 0 0 1 18 4.5Zm0 2.3A2.2 2.2 0 1 0 20.2 9 2.2 2.2 0 0 0 18 6.8ZM7.2 16.8a2.3 2.3 0 1 1-4.2-1.3',
    key: 'M14.5 5.5a5 5 0 1 1-3.2 8.8L4 21.5H1.5V19l2-2v-2h2v-2h2l2.1-2.1a5 5 0 0 1 4.9-5.4Zm2.5 3h.01',
    telegram: 'M21 4 18.4 19.4c-.2 1.1-.9 1.4-1.8.9l-4-2.9-1.9 1.8c-.2.2-.4.4-.8.4l.3-4.1 7.5-6.8c.3-.3-.1-.5-.5-.2l-9.3 5.8-4-1.3c-.9-.3-.9-.9.2-1.3L19.7 3.8c.7-.3 1.4.2 1.3.2Z',
    check: 'm5 12.5 4.2 4.2L19.5 6.5',
    admin: 'M12 3 4.5 6.2v5.6c0 4.5 3.2 7.6 7.5 9.2 4.3-1.6 7.5-4.7 7.5-9.2V6.2L12 3Zm-3 9.2 2 2 4.5-5',
    refresh: 'M20 7.5A8.5 8.5 0 1 0 20.2 16M20 3.5v4h-4',
    back: 'm15 5-7 7 7 7',
    route: 'M5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm14-10a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM7 17c6 0 4-10 10-10',
    flag: 'M5 21V4m0 1h10l-1.5 3L15 11H5',
    users: 'M16 20v-1.5a4.5 4.5 0 0 0-4.5-4.5h-3A4.5 4.5 0 0 0 4 18.5V20m6-10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7-5.8a3.3 3.3 0 0 1 0 6.4m3 9.4v-1.5a4.5 4.5 0 0 0-3.4-4.3',
    flask: 'M9 3h6m-5 0v5l-5 8.2A3 3 0 0 0 7.6 21h8.8a3 3 0 0 0 2.6-4.8L14 8V3M8 15h8',
    layers: 'm12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5m-18 4 9 5 9-5',
    shield: 'M12 3 4.5 6.2v5.6c0 4.5 3.2 7.6 7.5 9.2 4.3-1.6 7.5-4.7 7.5-9.2V6.2L12 3Z',
    chevron: 'm9 5 7 7-7 7',
  };
  const d = paths[name] || paths.about;
  return <svg className={`icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}

function BrandMark({ compact = false }) {
  return <span className={`brand-mark ${compact ? 'compact' : ''}`} aria-hidden="true">
    <span className="brand-half red-half" />
    <span className="brand-half blu-half" />
    <svg viewBox="0 0 36 36" fill="none">
      <path d="M9 10.5h18v4.2H20.2v11h-4.4v-11H9v-4.2Z" fill="currentColor" />
      <path d="M6.5 6.5h23v23h-23z" stroke="currentColor" strokeWidth="1.5" opacity=".5" />
    </svg>
  </span>;
}

function CampaignGraphic() {
  return <section className="campaign-card" aria-labelledby="campaign-title">
    <div className="campaign-topline">
      <span>CAMPAIGN / CONCEPT</span>
      <span className="prototype-chip">EARLY BUILD</span>
    </div>
    <div className="campaign-copy">
      <div>
        <p className="campaign-kicker">RED ↔ BLU</p>
        <h2 id="campaign-title">Один матч — часть большей кампании</h2>
        <p>Идея Team Frontress — связать отдельные этапы, регионы и общий прогресс в одну долгую командную историю.</p>
      </div>
      <div className="campaign-emblem"><Icon name="route" /></div>
    </div>
    <svg className="campaign-map" viewBox="0 0 560 230" role="img" aria-label="Концептуальная схема регионов RED и BLU, соединённых маршрутами">
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" className="map-grid" fill="none" />
        </pattern>
      </defs>
      <rect width="560" height="230" rx="18" fill="url(#grid)" />
      <g className="route-line">
        <path d="M70 72 170 58 255 110 340 76 478 60" />
        <path d="M88 166 174 152 255 110 350 158 476 170" />
        <path d="M170 58 174 152M340 76l10 82" />
      </g>
      <g className="red-region">
        <path d="m33 44 74-18 45 40-22 58-77 2-32-45Z" />
        <path d="m50 137 76-9 50 42-31 42-84-8-25-34Z" />
        <circle cx="70" cy="72" r="8" /><circle cx="88" cy="166" r="8" /><circle cx="170" cy="58" r="8" /><circle cx="174" cy="152" r="8" />
      </g>
      <g className="blu-region">
        <path d="m408 30 91 8 38 47-42 45-85-14-28-49Z" />
        <path d="m389 127 93 5 46 43-37 37-93-5-29-42Z" />
        <circle cx="478" cy="60" r="8" /><circle cx="476" cy="170" r="8" /><circle cx="340" cy="76" r="8" /><circle cx="350" cy="158" r="8" />
      </g>
      <g className="neutral-region">
        <path d="m224 78 66-9 40 41-32 48-70-9-21-39Z" />
        <circle cx="255" cy="110" r="11" />
      </g>
      <text x="46" y="113" className="map-label red-label">RED</text>
      <text x="465" y="116" className="map-label blu-label">BLU</text>
      <text x="235" y="194" className="map-note">СХЕМА ИДЕИ · НЕ ЖИВАЯ КАРТА</text>
    </svg>
  </section>;
}

function ProjectFact({ icon, label, value }) {
  return <div className="project-fact"><span><Icon name={icon} /></span><div><small>{label}</small><strong>{value}</strong></div></div>;
}

function App() {
  const [theme, setTheme] = useState(tg?.initData ? tg.colorScheme : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const [screen, setScreen] = useState('home');
  const [me, setMe] = useState({ user: null });
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [waiting, setWaiting] = useState(false);
  const [news, setNews] = useState(null);
  const [newsError, setNewsError] = useState('');
  const [newsBusy, setNewsBusy] = useState(false);
  const [fullscreen, setFullscreen] = useState(Boolean(tg?.isFullscreen));
  const token = useRef('');
  const lock = useRef(false);
  const newsLock = useRef(false);
  const lastRefresh = useRef(0);
  const keyInput = useRef(null);
  const heading = useRef(null);
  const user = me.user;
  const key = !me.key_revoked && user?.key;

  async function api(path, body) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 50000);
    try {
      const response = await fetch(path, { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
        headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token.current ? { Authorization: `Bearer ${token.current}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body) });
      let data;
      try { data = await response.json(); } catch { throw new Error('Не удалось прочитать ответ сервера. Повторите попытку.'); }
      if (!response.ok) {
        if (response.status === 401) { token.current = ''; setMe({ user: null }); setNews(null); }
        throw new Error(data.error || 'Не удалось выполнить запрос. Попробуйте позже.');
      }
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Сервер не ответил вовремя. Обновите данные перед повторной попыткой.');
      if (error instanceof TypeError) throw new Error('Нет связи с сервером. Проверьте интернет.');
      throw error;
    } finally { clearTimeout(timeout); }
  }

  async function refresh() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setStatus(null);
    try {
      let data = await api('/api/me');
      // Identity comes only from the server's signed initData validation.
      if (tg?.initData && (!token.current || !data.user)) {
        data = await api('/api/auth/telegram', { init_data: tg.initData });
        token.current = data.session_token || '';
        delete data.session_token;
      }
      setMe(data);
      if (data.user?.key || data.key_revoked || !data.user) setWaiting(false);
    } catch (error) { setStatus({ text: error.message, error: true }); }
    finally { lock.current = false; setBusy(false); setLoaded(true); lastRefresh.current = Date.now(); }
  }

  async function loadNews() {
    if (newsLock.current) return;
    newsLock.current = true; setNewsBusy(true); setNewsError('');
    try { const data = await api('/api/announcements'); setNews(data.announcements || []); }
    catch (error) { setNewsError(error.message); }
    finally { newsLock.current = false; setNewsBusy(false); }
  }

  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const update = () => {
      setTheme(tg?.initData ? tg.colorScheme : media.matches ? 'dark' : 'light');
      if (native) {
        tg.setHeaderColor('secondary_bg_color');
        tg.setBackgroundColor(tg.themeParams.secondary_bg_color || (tg.colorScheme === 'dark' ? '#1c1c1d' : '#f2f2f7'));
      }
      if (secondary) tg.setBottomBarColor(tg.themeParams.secondary_bg_color || (tg.colorScheme === 'dark' ? '#1c1c1d' : '#f2f2f7'));
    };
    const onFullscreen = event => {
      const next = Boolean(event?.is_fullscreen ?? tg?.isFullscreen);
      setFullscreen(next);
      document.documentElement.dataset.fullscreen = String(next);
    };
    update();
    if (tg?.initData) {
      tg.ready();
      tg.expand();
      setFullscreen(Boolean(tg.isFullscreen));
      document.documentElement.dataset.fullscreen = String(Boolean(tg.isFullscreen));
      tg.onEvent('themeChanged', update);
      if (fullscreenCapable) {
        tg.onEvent('fullscreenChanged', onFullscreen);
        try { if (!tg.isFullscreen) tg.requestFullscreen(); } catch { /* expand() remains the fallback. */ }
      }
    }
    media.addEventListener('change', update);
    refresh();
    const onReturn = () => { if (!document.hidden && Date.now() - lastRefresh.current > 1500) refresh(); };
    window.addEventListener('focus', onReturn);
    document.addEventListener('visibilitychange', onReturn);
    return () => {
      tg?.offEvent('themeChanged', update);
      if (fullscreenCapable) tg?.offEvent('fullscreenChanged', onFullscreen);
      media.removeEventListener('change', update);
      window.removeEventListener('focus', onReturn);
      document.removeEventListener('visibilitychange', onReturn);
    };
  }, []);

  useEffect(() => { if (screen === 'news' && user) loadNews(); }, [screen, user?.telegram_id]);
  useEffect(() => { if (screen === 'admin' && !me.admin) setScreen('home'); }, [me.admin, screen]);

  function navigate(next) {
    setScreen(next);
    window.scrollTo({ top: 0 });
    if (native) tg.HapticFeedback.selectionChanged();
    requestAnimationFrame(() => heading.current?.focus());
  }

  async function confirm(text) {
    if (native) return new Promise(resolve => tg.showConfirm(text, resolve));
    return window.confirm(text);
  }

  function openExternal(rawURL, telegram = false) {
    if (typeof rawURL !== 'string' || !rawURL.trim()) throw new Error('Сервер не вернул ссылку.');
    const url = new URL(rawURL, location.origin);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Сервер вернул недопустимую ссылку.');
    if (tg?.initData) {
      try {
        if (telegram && url.hostname === 't.me') tg.openTelegramLink(url.href);
        else tg.openLink(url.href, { try_instant_view: false });
        return;
      } catch { /* Browser navigation remains available without a working bridge. */ }
    }
    location.assign(url.href);
  }

  async function copyKey() {
    try { await navigator.clipboard.writeText(key); setStatus({ text: 'Ключ скопирован' }); if (native) tg.HapticFeedback.notificationOccurred('success'); }
    catch { keyInput.current?.focus(); keyInput.current?.select(); setStatus({ text: 'Ключ выделен. Скопируйте его через меню устройства.' }); }
  }

  async function run(kind) {
    if (lock.current || !user) return;
    lock.current = true; setBusy(true); setStatus(null);
    try {
      if (kind === 'steam') {
        const data = await api('/api/steam/start', {});
        setStatus({ text: 'Завершите вход в Steam в браузере и вернитесь сюда. Статус обновится автоматически.' });
        openExternal(data.url);
      } else if (kind === 'claim') {
        const data = await api('/api/claim', {});
        setMe(previous => ({ ...previous, user: previous.user ? { ...previous.user, key: data.key || '' } : null }));
        setWaiting(Boolean(data.waiting));
        setStatus({ text: data.key ? 'Ключ сохранён в вашем аккаунте. Теперь можно вступить в группу.' : 'Свободных ключей пока нет. Проверьте позже.' });
        if (data.key && me.join_request_pending) await approveJoin();
      } else if (kind === 'group') {
        if (me.join_request_pending) await approveJoin();
        else { const data = await api('/api/group', {}); openExternal(data.url, true); }
      }
      if (native) tg.HapticFeedback.notificationOccurred('success');
    } catch (error) { setStatus({ text: error.message, error: true }); if (native) tg.HapticFeedback.notificationOccurred('error'); }
    finally { lock.current = false; setBusy(false); }
  }

  async function approveJoin() {
    const data = await api('/api/join-request/approve', {});
    if (data.approved) {
      setMe(previous => ({ ...previous, join_request_pending: false }));
      setStatus({ text: 'Заявка одобрена. Telegram добавит вас в группу.' });
      if (tg?.initData) tg.close();
    }
  }

  const primary = !user || me.key_revoked ? null : !user.steam_id ? { text: 'Привязать Steam', kind: 'steam' } : !key ? { text: waiting ? 'Проверить наличие ключей' : 'Получить ключ', kind: 'claim' } : me.group_enabled ? { text: me.join_request_pending ? 'Подтвердить вступление' : 'Вступить в группу', kind: 'group' } : null;

  useEffect(() => {
    if (!native) return;
    const back = () => navigate('home');
    const main = () => { if (!busy && primary) run(primary.kind); };
    const extra = () => { if (!busy) key ? copyKey() : refresh(); };
    tg.BackButton.onClick(back);
    screen === 'home' ? tg.BackButton.hide() : tg.BackButton.show();
    tg.MainButton.onClick(main);
    if (screen === 'home' && primary) {
      tg.MainButton.setParams({ text: primary.text, is_visible: true, is_active: !busy });
      busy ? tg.MainButton.showProgress() : tg.MainButton.hideProgress();
    } else { tg.MainButton.hideProgress(); tg.MainButton.hide(); }
    if (secondary) {
      tg.SecondaryButton.onClick(extra);
      tg.SecondaryButton.setParams({ text: key ? 'Копировать ключ' : 'Обновить', is_visible: screen === 'home', is_active: !busy, position: 'top' });
    }
    return () => {
      tg.BackButton.offClick(back);
      tg.BackButton.hide();
      tg.MainButton.offClick(main);
      tg.MainButton.hideProgress();
      tg.MainButton.hide();
      if (secondary) { tg.SecondaryButton.offClick(extra); tg.SecondaryButton.hide(); }
    };
  }, [screen, busy, primary?.text, primary?.kind, key, me.join_request_pending]);

  const progress = key ? 3 : user?.steam_id ? 2 : user ? 1 : 0;

  return <ThemeProvider theme={theme}>
    <div className={`app-shell ${fullscreen ? 'is-fullscreen' : ''}`}>
      <header className="app-header">
        <button className="icon-button" aria-label={screen === 'home' ? 'Обновить данные' : 'Назад'} disabled={busy} onClick={() => screen === 'home' ? refresh() : navigate('home')}><Icon name={screen === 'home' ? 'refresh' : 'back'} /></button>
        <div className="app-title"><strong>Team Frontress</strong><span>Field Test Console</span></div>
        <BrandMark compact />
      </header>

      <main className="page-stack" aria-busy={busy}>
        <div className="page-heading">
          <div><span className="eyebrow">{screen === 'home' ? 'TESTER ACCESS' : screen === 'news' ? 'FIELD COMMS' : screen === 'about' ? 'PROJECT FILE' : 'CONTROL ROOM'}</span><h1 ref={heading} tabIndex={-1}>{titles[screen]}</h1></div>
          {screen === 'home' && fullscreen && <span className="fullscreen-badge"><span /> FULLSCREEN</span>}
        </div>
        {status && <p className={`notice ${status.error ? 'error' : ''}`} role={status.error ? 'alert' : 'status'}>{status.text}</p>}

        {screen === 'home' && <>
          <section className="profile mission-profile">
            <div className="profile-avatar">{user?.first_name?.slice(0, 1).toUpperCase() || <BrandMark />}</div>
            <div className="profile-copy">
              <span className="profile-label">{key ? 'ACTIVE TESTER' : me.key_revoked ? 'ACCESS REVOKED' : 'RECRUIT'}</span>
              <h2>{loaded ? user?.first_name || 'Добро пожаловать' : 'Подключаемся'}</h2>
              <p>{!loaded ? 'Проверяем аккаунт Telegram' : me.key_revoked ? 'Доступ к тестированию отозван' : key ? 'Доступ к полевому тестированию активен' : 'Пройдите регистрацию и получите тестовый ключ'}</p>
            </div>
          </section>

          {!loaded ? <p className="muted" role="status">Загружаем профиль...</p> : <>
            {!user && <p className="notice">Откройте приложение через меню бота в Telegram, чтобы подтвердить аккаунт, привязать Steam и получить ключ.</p>}

            <div className="mission-strip">
              <div><small>СИСТЕМА</small><strong>Source / TC2</strong></div>
              <div><small>ФОРМАТ</small><strong>RED vs BLU</strong></div>
              <div><small>СТАТУС</small><strong>Ранний тест</strong></div>
            </div>

            <Group header="Ваши аккаунты" footer="Пароль Steam мы не получаем. Привязанный аккаунт нельзя заменить.">
              <GroupItem before={<span className="tile blue"><Icon name="telegram" /></span>} text="Telegram" description={user ? `ID ${user.telegram_id}` : 'Вход через меню бота'} after={<span className={user ? 'success' : 'muted'}>{user ? 'Подключён' : 'Нет входа'}</span>} />
              <GroupItem before={<span className="tile charcoal"><Icon name="steam" /></span>} text="Steam" description={user?.steam_id || 'Ваш игровой аккаунт'} after={user?.steam_id ? <Icon name="check" className="success" /> : <Button type="secondary" disabled={!user || busy} onClick={() => run('steam')}>Привязать</Button>} />
            </Group>

            <Group header="Доступ к тестам" footer={me.key_revoked ? 'Отзыв закрывает доступ к группе. Для восстановления обратитесь к администраторам.' : 'Ключ выдаётся при наличии и остаётся закреплён за вашим аккаунтом.'}>
              <GroupItem before={<span className={`tile ${me.key_revoked ? 'red' : 'orange'}`}><Icon name="key" /></span>} text={me.key_revoked ? 'Доступ отозван' : key ? 'Ключ получен' : waiting ? 'Ожидаем новые ключи' : 'Ключ Team Frontress'} description={key ? 'Активируйте в Steam' : user?.steam_id ? 'Аккаунт готов к выдаче' : 'Сначала привяжите Steam'} after={key ? <Icon name="check" className="success" /> : <span className="muted">{me.key_revoked ? 'Закрыт' : `${progress} / 3`}</span>} />
              {key && <div className="key-panel"><label htmlFor="issued-key">Ваш ключ. Не передавайте другим.</label><Input ref={keyInput} id="issued-key" value={key} readOnly autoComplete="off" spellCheck={false} /><Button type="secondary" onClick={copyKey}>Копировать ключ</Button></div>}
              {!key && !me.key_revoked && <div className="progress-track" aria-label={`Пройдено ${progress} из 3 шагов`}><span style={{ width: `${progress / 3 * 100}%` }} /></div>}
            </Group>

            <Group header="Сообщество" footer={me.join_request_pending ? 'Ваша заявка ожидает подтверждения. Для вступления нужен активный ключ.' : 'Группа доступна участникам с активным ключом.'}>
              <GroupItem before={<span className="tile green"><Icon name="users" /></span>} text="Группа тестеров" description={!user ? 'После получения ключа' : !me.group_enabled ? 'Пока не настроена' : key ? 'Обсуждения, отчёты и обратная связь' : 'После получения ключа'} after={<Button type="secondary" disabled={busy || !key || !me.group_enabled} onClick={() => run('group')}>{me.join_request_pending ? 'Подтвердить' : 'Открыть'}</Button>} />
            </Group>

            <button className="project-teaser" onClick={() => navigate('about')}>
              <span className="teaser-icon"><Icon name="route" /></span>
              <span><small>ЗАЧЕМ ЭТО НУЖНО</small><strong>Матчи как этапы одной кампании</strong><em>Посмотреть концепт и текущее состояние проекта</em></span>
              <Icon name="chevron" />
            </button>

            {!native && primary && <Button loading={busy} disabled={busy} onClick={() => run(primary.kind)}>{primary.text}</Button>}
            {me.admin && <button className="row-button" onClick={() => navigate('admin')}><Icon name="admin" /><span>Управление набором</span><Icon name="chevron" /></button>}
          </>}
        </>}

        {screen === 'news' && <>
          <div className="section-intro"><Icon name="news" /><div><h2>Связь с командой</h2><p>Даты сессий, изменения сборок и инструкции для тестеров.</p></div></div>
          {!user ? <div className="empty-state"><Icon name="shield" /><h2>Нужен вход через Telegram</h2><p>Объявления доступны зарегистрированным участникам проекта.</p></div> : <>
            <Button type="secondary" disabled={newsBusy} loading={newsBusy} onClick={loadNews}>Обновить объявления</Button>
            {newsError && <p className="notice error" role="alert">{newsError}</p>}
            {newsBusy && !news && <p role="status" className="muted">Загружаем объявления...</p>}
            {news?.length === 0 && <div className="empty-state"><Icon name="news" /><h2>Пока тихо</h2><p>Здесь появятся даты тестов, изменения сборок и задачи на следующую сессию.</p></div>}
            {news?.map(item => <article className="news-post" key={item.id}><header><BrandMark compact /><div><strong>Team Frontress</strong><time>{Number.isNaN(Date.parse(item.created_at)) ? 'Объявление команды' : new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(item.created_at))}</time></div></header><p>{item.text}</p></article>)}
          </>}
        </>}

        {screen === 'about' && <>
          <CampaignGraphic />

          <div className="facts-grid">
            <ProjectFact icon="layers" label="ТЕХНОЛОГИЯ" value="Source SDK + Team Comtress 2" />
            <ProjectFact icon="users" label="ТЕСТИРОВАНИЕ" value="Небольшие группы" />
            <ProjectFact icon="route" label="КОНЦЕПТ" value="Регионы и последовательные этапы" />
            <ProjectFact icon="flask" label="СТАТУС" value="Механики ещё формируются" />
          </div>

          <Group header="Что мы исследуем">
            <GroupItem before={<span className="tile red"><Icon name="flag" /></span>} text="Не отдельный матч, а кампания" description={<p className="row-description">Идея — чтобы знакомое противостояние RED и BLU продолжалось между сессиями: регионы, последовательные этапы и общий прогресс складываются в более длинную историю.</p>} />
            <GroupItem before={<span className="tile blue"><Icon name="route" /></span>} text="Результат должен иметь контекст" description={<p className="row-description">Мы проверяем сам формат постоянной кампании: насколько игрокам понятны цели этапа, интересно ли следить за общим состоянием и что стоит переносить из одной сессии в следующую.</p>} />
            <GroupItem before={<span className="tile orange"><Icon name="flask" /></span>} text="Сначала — маленькие тесты" description={<p className="row-description">Это ранняя разработка, а не готовая игра. Механики, сроки и правила могут меняться; первые сборки нужны прежде всего для наблюдений и обратной связи.</p>} />
          </Group>

          <section className="briefing-card">
            <div className="briefing-stamp">TESTER BRIEF</div>
            <h2>Что делает участник</h2>
            <ol>
              <li><span>01</span><div><strong>Получает доступ</strong><p>Telegram → Steam → тестовый ключ. Один ключ закрепляется за одним аккаунтом.</p></div></li>
              <li><span>02</span><div><strong>Заходит в закрытую группу</strong><p>Там появляются инструкции, обсуждения и связь с командой перед тестовыми сессиями.</p></div></li>
              <li><span>03</span><div><strong>Проверяет идею на практике</strong><p>Нам важны ошибки, непонятные места, темп этапов и то, хочется ли возвращаться к общей кампании.</p></div></li>
            </ol>
          </section>

          <Group header="Важно понимать" footer="Team Frontress — независимый проект сообщества, не связан с Valve и не одобрен ею. Steam и другие товарные знаки принадлежат правообладателям.">
            <GroupItem before={<span className="tile charcoal"><Icon name="flask" /></span>} text="Это эксперимент" description={<p className="row-description">Схема кампании выше — визуализация направления, а не живая карта или обещание конкретных механик. Содержание тестов будет меняться по мере разработки.</p>} />
            <GroupItem before={<span className="tile green"><Icon name="shield" /></span>} text="Какие данные хранит бот" description={<p className="row-description">Telegram ID и имя, Steam ID, выданный ключ, статус доступа и заявки в группу. Они нужны для учёта участников и выдачи доступа. Пароли мы не запрашиваем.</p>} />
            <GroupItem before={<span className="tile blue"><Icon name="news" /></span>} text="Уведомления" description={<p className="row-description">Бот может присылать объявления проекта. Отключить их можно, заблокировав бот в Telegram.</p>} />
          </Group>
        </>}

        {screen === 'admin' && me.admin && <Admin api={api} confirm={confirm} onSelfChange={refresh} userID={user.telegram_id} />}
      </main>

      <nav className="tab-bar" aria-label="Разделы приложения">
        {['home', 'news', 'about'].map(tab => <button key={tab} aria-current={screen === tab ? 'page' : undefined} onClick={() => navigate(tab)}><Icon name={tab} /><span>{tab === 'home' ? 'Участие' : tab === 'news' ? 'Связь' : 'Проект'}</span></button>)}
      </nav>
    </div>
  </ThemeProvider>;
}

createRoot(document.getElementById('root')).render(<App />);
