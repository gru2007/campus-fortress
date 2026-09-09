import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider, Group, GroupItem, Button, Input } from '@telegram-tools/ui-kit';
import '@telegram-tools/ui-kit/index.css';
import './style.css';
import Admin from './Admin.jsx';

const tg = window.Telegram?.WebApp;
const native = Boolean(tg?.initData && tg.isVersionAtLeast?.('6.1'));
const secondary = native && tg.isVersionAtLeast('7.10');
const titles = { home: 'Участие', news: 'Объявления', about: 'О проекте', admin: 'Управление' };

function Icon({ name, className = '' }) {
  const paths = {
    home: 'M4 21v-9m16 9v-9M2 11l10-9 10 9M9 21v-7h6v7',
    news: 'M4 10v7h4l9 4V3L8 7H4v3Zm4 7 2 5m11-14v8',
    about: 'M12 11v6m0-10v.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
    steam: 'm3 16 6 3 5-4m-5 4a3 3 0 1 1-6-3m19-8a6 6 0 1 1-12 0 6 6 0 0 1 12 0Zm-3 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    key: 'M14 10a5 5 0 1 0-4 4L3 21H0v-3l7-7m9-6h.01',
    telegram: 'm22 3-4 18-6-5-4 3v-6L22 3 2 10l6 3m0 0 10-7-6 10',
    check: 'm5 12 4 4L19 6',
    admin: 'M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6l-9-4Zm-4 10 3 3 5-6',
    refresh: 'M20 7a9 9 0 1 0 1 9M20 2v6h-6',
    back: 'm15 5-7 7 7 7',
  };
  return <svg className={`icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.about} /></svg>;
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
      if (native) { tg.setHeaderColor('secondary_bg_color'); tg.setBackgroundColor(tg.themeParams.secondary_bg_color || (tg.colorScheme === 'dark' ? '#1c1c1d' : '#f2f2f7')); }
      if (secondary) tg.setBottomBarColor(tg.themeParams.secondary_bg_color || (tg.colorScheme === 'dark' ? '#1c1c1d' : '#f2f2f7'));
    };
    update();
    if (tg?.initData) { tg.ready(); tg.expand(); tg.onEvent('themeChanged', update); }
    media.addEventListener('change', update);
    refresh();
    const onReturn = () => { if (!document.hidden && Date.now() - lastRefresh.current > 1500) refresh(); };
    window.addEventListener('focus', onReturn);
    document.addEventListener('visibilitychange', onReturn);
    return () => { tg?.offEvent('themeChanged', update); media.removeEventListener('change', update); window.removeEventListener('focus', onReturn); document.removeEventListener('visibilitychange', onReturn); };
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
    return () => { tg.BackButton.offClick(back); tg.BackButton.hide(); tg.MainButton.offClick(main); tg.MainButton.hideProgress(); tg.MainButton.hide(); if (secondary) { tg.SecondaryButton.offClick(extra); tg.SecondaryButton.hide(); } };
  }, [screen, busy, primary?.text, primary?.kind, key, me.join_request_pending]);

  const progress = key ? 3 : user?.steam_id ? 2 : user ? 1 : 0;
  return <ThemeProvider theme={theme}>
    <div className="app-shell">
      <header className="app-header">
        <button className="icon-button" aria-label={screen === 'home' ? 'Обновить данные' : 'Назад'} disabled={busy} onClick={() => screen === 'home' ? refresh() : navigate('home')}><Icon name={screen === 'home' ? 'refresh' : 'back'} /></button>
        <div><strong>Team Frontress</strong><span>Приложение участника</span></div>
        <span className="app-avatar" aria-hidden="true">TF</span>
      </header>
      <main className="page-stack" aria-busy={busy}>
        <h1 ref={heading} tabIndex={-1}>{titles[screen]}</h1>
        {status && <p className={`notice ${status.error ? 'error' : ''}`} role={status.error ? 'alert' : 'status'}>{status.text}</p>}
        {screen === 'home' && <>
          <section className="profile">
            <div className="profile-avatar">{user?.first_name?.slice(0, 1).toUpperCase() || 'TF'}</div>
            <h2>{loaded ? user?.first_name || 'Добро пожаловать' : 'Подключаемся'}</h2>
            <p>{!loaded ? 'Проверяем аккаунт Telegram' : me.key_revoked ? 'Доступ к тестированию отозван' : key ? 'Участник тестирования' : 'Присоединяйтесь к тестированию'}</p>
          </section>
          {!loaded ? <p className="muted" role="status">Загружаем профиль...</p> : <>
            {!user && <p className="notice">Откройте приложение через меню бота в Telegram, чтобы привязать Steam и получить ключ.</p>}
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
              <GroupItem before={<span className="tile green"><Icon name="news" /></span>} text="Группа тестеров" description={!user ? 'После получения ключа' : !me.group_enabled ? 'Пока не настроена' : key ? 'Обсуждения и обратная связь' : 'После получения ключа'} after={<Button type="secondary" disabled={busy || !key || !me.group_enabled} onClick={() => run('group')}>{me.join_request_pending ? 'Подтвердить' : 'Открыть'}</Button>} />
            </Group>
            {!native && primary && <Button loading={busy} disabled={busy} onClick={() => run(primary.kind)}>{primary.text}</Button>}
            {me.admin && <button className="row-button" onClick={() => navigate('admin')}><Icon name="admin" /><span>Управление набором</span><span aria-hidden="true">›</span></button>}
          </>}
        </>}
        {screen === 'news' && <>
          <p className="page-description">Этапы тестирования и сообщения команды.</p>
          {!user ? <div className="empty-state"><Icon name="news" /><h2>Войдите через Telegram</h2><p>Объявления доступны участникам проекта.</p></div> : <>
            <Button type="secondary" disabled={newsBusy} loading={newsBusy} onClick={loadNews}>Обновить объявления</Button>
            {newsError && <p className="notice error" role="alert">{newsError}</p>}
            {newsBusy && !news && <p role="status" className="muted">Загружаем объявления...</p>}
            {news?.length === 0 && <div className="empty-state"><Icon name="news" /><h2>Пока без объявлений</h2><p>Здесь появятся даты тестов и инструкции команды.</p></div>}
            {news?.map(item => <article className="news-post" key={item.id}><header><span className="app-avatar">TF</span><div><strong>Team Frontress</strong><time>{Number.isNaN(Date.parse(item.created_at)) ? 'Объявление команды' : new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(item.created_at))}</time></div></header><p>{item.text}</p></article>)}
          </>}
        </>}
        {screen === 'about' && <>
          <section className="profile"><div className="profile-avatar project-avatar">TF</div><h2>Team Frontress</h2><p>Независимый проект сообщества</p></section>
          <Group header="О проекте">
            <GroupItem text="Постоянная кампания RED и BLU" description={<p className="row-description">Исследуем командную кампанию с регионами, последовательными этапами и общим прогрессом на базе Team Comtress 2 и Source SDK.</p>} />
            <GroupItem text="Раннее тестирование" description={<p className="row-description">Проект в разработке. Начинаем с небольших групп: механики, сроки и условия ещё формируются. В сборках возможны ошибки.</p>} />
          </Group>
          <Group header="Ваши данные" footer="Проект не связан с Valve и не одобрен ею. Steam и другие товарные знаки принадлежат правообладателям.">
            <GroupItem text="Что сохраняет бот" description={<p className="row-description">Telegram ID и имя, Steam ID, выданный ключ, статус доступа и заявки в группу. Эти данные нужны для учёта участников и выдачи доступа. Пароли не запрашиваем.</p>} />
            <GroupItem text="Уведомления" description={<p className="row-description">Бот может присылать объявления проекта. Отключить сообщения можно, заблокировав бот в Telegram.</p>} />
          </Group>
        </>}
        {screen === 'admin' && me.admin && <Admin api={api} confirm={confirm} onSelfChange={refresh} userID={user.telegram_id} />}
      </main>
      <nav className="tab-bar" aria-label="Разделы приложения">{['home', 'news', 'about'].map(tab => <button key={tab} aria-current={screen === tab ? 'page' : undefined} onClick={() => navigate(tab)}><Icon name={tab} /><span>{titles[tab]}</span></button>)}</nav>
    </div>
  </ThemeProvider>;
}

createRoot(document.getElementById('root')).render(<App />);
