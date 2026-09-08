"use strict";

(() => {
  const $ = (id) => document.getElementById(id);
  const tg = window.Telegram?.WebApp;
  let me = { user: null };
  let sessionToken = "";
  let initialized = false;
  let refreshing = false;
  let acting = false;
  let adminBusy = false;
  let adminLoading = false;
  let newsLoading = false;
  let waiting = false;
  let lastRefresh = 0;

  function theme() {
    if (tg?.initData) document.documentElement.dataset.theme = tg.colorScheme;
  }
  theme();
  if (tg?.initData) {
    tg.ready();
    tg.expand();
    tg.onEvent("themeChanged", theme);
  }

  function message(id, text = "", error = false) {
    const element = $(id);
    element.textContent = text;
    element.hidden = !text;
    element.classList.toggle("error", error);
  }

  async function api(path, body) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 50000);
    try {
      const response = await fetch(path, {
        method: body === undefined ? "GET" : "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      let data;
      try { data = await response.json(); } catch { throw new Error("Сервер вернул неожиданный ответ. Попробуйте обновить страницу."); }
      if (!response.ok) {
        if (response.status === 401) {
          sessionToken = "";
          me = { user: null };
          render();
        }
        throw new Error(data.error || "Не удалось выполнить запрос. Попробуйте позже.");
      }
      return data;
    } catch (error) {
      if (error.name === "AbortError") throw new Error("Сервер не ответил вовремя. Обновите данные, прежде чем повторять действие.");
      if (error instanceof TypeError) throw new Error("Нет связи с сервером. Проверьте интернет и повторите попытку.");
      throw error;
    } finally { clearTimeout(timeout); }
  }

  function step(name, done, active, text) {
    $(name + "-step").classList.toggle("complete", done);
    $(name + "-step").classList.toggle("active", active);
    $(name + "-state").textContent = text;
    if (active) $(name + "-step").setAttribute("aria-current", "step");
    else $(name + "-step").removeAttribute("aria-current");
  }

  function render() {
    const user = me.user;
    const linked = Boolean(user?.steam_id);
    const key = user?.key || "";
    const busy = acting || refreshing || !initialized;
    $("account-status").textContent = !initialized ? "Проверяем вход…" : user ? `Вы вошли: ${user.first_name || "Участник"}` : "Знакомство с проектом · без входа";
    step("telegram", Boolean(user), !user, user ? "Подтверждено" : "Вход через бот");
    step("steam", linked, Boolean(user) && !linked, linked ? "Привязан" : user ? "Ваш следующий шаг" : "После входа");
    step("key", Boolean(key), linked && !key, key ? "Выдан" : waiting ? "Пока нет ключей" : linked ? "Проверьте наличие" : "После Steam");
    $("telegram-description").textContent = user ? `Telegram ID: ${user.telegram_id}. Аккаунт подтверждён.` : "Откройте бот проекта в Telegram и запустите Mini App кнопкой в его меню. Если вы уже в Telegram, откройте приложение заново через бот.";
    $("steam-description").textContent = linked ? `Steam ID: ${user.steam_id}` : "Steam откроется во внешнем браузере. После привязки вернитесь сюда: статус обновится. Пароль Steam мы не получаем.";
    $("steam").hidden = linked;
    $("steam").disabled = busy || !user;
    $("claim").hidden = Boolean(key);
    $("claim").disabled = busy || !linked;
    $("claim").textContent = waiting ? "Проверить ещё раз" : "Проверить наличие ключа";
    $("key-box").hidden = !key;
    $("issued-key").value = key;
    $("key-description").textContent = key ? "Ключ закреплён за вашим аккаунтом. Следите за инструкциями и этапами тестов в объявлениях." : waiting ? "Свободных ключей пока нет. Проверьте позже; точные сроки выдачи не объявлены." : "Ключ выдаётся при наличии. Если свободных ключей нет, проверьте позже.";
    $("group").disabled = busy || !key || !me.group_enabled;
    $("group-description").textContent = user && !me.group_enabled ? "Группа тестеров пока не настроена организаторами." : key ? "Можно присоединиться к группе тестеров и обсуждению проекта." : "Доступ откроется после привязки Steam и получения ключа.";
    $("refresh").disabled = refreshing || acting;
    $("refresh").textContent = refreshing ? "Обновляем…" : "Обновить";
    $("participation").setAttribute("aria-busy", String(refreshing || acting));
    $("admin-panel").hidden = !me.admin;
    if (!user) {
      $("announcements").replaceChildren(empty("Объявления доступны после входа через Telegram."));
      $("news-retry").hidden = true;
    }
    if (!me.admin) {
      $("stats").replaceChildren();
      $("participants").replaceChildren();
      $("keys").value = "";
      $("announcement-text").value = "";
    }
  }

  function empty(text) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = text;
    return p;
  }

  async function loadNews() {
    if (!me.user || newsLoading) return;
    newsLoading = true;
    $("news-retry").hidden = true;
    $("announcements").setAttribute("aria-busy", "true");
    if (!$("announcements").querySelector(".news-item")) $("announcements").replaceChildren(empty("Загружаем объявления…"));
    try {
      const data = await api("/api/announcements");
      if (!me.user) return;
      const items = (data.announcements || []).map((item) => {
        const article = document.createElement("article");
        article.className = "news-item";
        const time = document.createElement("time");
        const date = new Date(item.created_at);
        if (!Number.isNaN(date.getTime())) {
          time.dateTime = date.toISOString();
          time.textContent = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
        } else time.textContent = "Объявление команды";
        const text = document.createElement("p");
        text.textContent = item.text;
        article.append(time, text);
        return article;
      });
      $("announcements").replaceChildren(...(items.length ? items : [empty("Пока без объявлений. Здесь появятся новости о следующих этапах.")]));
    } catch (error) {
      if (me.user) {
        $("announcements").replaceChildren(empty(error.message));
        $("news-retry").hidden = false;
      }
    } finally {
      newsLoading = false;
      $("announcements").setAttribute("aria-busy", "false");
    }
  }

  async function loadAdmin() {
    if (!me.admin || adminLoading) return;
    adminLoading = true;
    $("admin-refresh").disabled = true;
    $("admin-refresh").textContent = "Загружаем…";
    $("stats").setAttribute("aria-busy", "true");
    try {
      const data = await api("/api/admin");
      if (!me.admin) return;
      $("stats").replaceChildren(...Object.entries({ participants: "Участников", linked: "Со Steam", available_keys: "Свободных ключей", issued_keys: "Выдано ключей" }).map(([key, label]) => {
        const card = document.createElement("div");
        card.className = "stat";
        const value = document.createElement("strong");
        value.textContent = data.stats[key];
        card.append(value, document.createTextNode(label));
        return card;
      }));
      const rows = (data.participants || []).map((person) => {
        const row = document.createElement("tr");
        const name = document.createElement("td");
        name.textContent = person.first_name || "Без имени";
        const id = document.createElement("small");
        id.textContent = person.telegram_id;
        name.append(id);
        const steam = document.createElement("td");
        steam.textContent = person.steam_id || "Не привязан";
        const key = document.createElement("td");
        key.textContent = person.has_key ? "Выдан" : "Не выдан";
        row.append(name, steam, key);
        return row;
      });
      if (!rows.length) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 3;
        cell.textContent = "Участников пока нет.";
        row.append(cell);
        rows.push(row);
      }
      $("participants").replaceChildren(...rows);
    } catch (error) { message("admin-status", `Не удалось обновить данные: ${error.message}`, true); }
    finally {
      adminLoading = false;
      $("admin-refresh").disabled = adminBusy;
      $("admin-refresh").textContent = "Обновить данные";
      $("stats").setAttribute("aria-busy", "false");
    }
  }

  async function refresh() {
    if (refreshing || acting || adminBusy) return;
    refreshing = true;
    render();
    message("session-error");
    try {
      let data = await api("/api/me");
      // The server validates signed initData; never trust initDataUnsafe for identity.
      if (tg?.initData && (!initialized || !data.user)) {
        data = await api("/api/auth/telegram", { init_data: tg.initData });
        sessionToken = data.session_token;
        delete data.session_token;
      }
      me = data;
      if (me.user?.key || !me.user) waiting = false;
    } catch (error) { message("session-error", error.message, true); }
    finally {
      initialized = true;
      refreshing = false;
      lastRefresh = Date.now();
      render();
    }
    await Promise.all([loadNews(), loadAdmin()]);
  }

  function openExternal(rawURL, telegramLink = false) {
    if (typeof rawURL !== "string" || !rawURL.trim()) throw new Error("Сервер не вернул ссылку. Попробуйте ещё раз.");
    const url = new URL(rawURL, window.location.origin);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error("Сервер вернул недопустимую ссылку.");
    if (tg?.initData) {
      try {
        if (telegramLink && url.hostname === "t.me" && tg.openTelegramLink) tg.openTelegramLink(url.href);
        else tg.openLink(url.href, { try_instant_view: false });
        return;
      } catch { /* Fall back to normal browser navigation when the bridge is unavailable. */ }
    }
    window.location.assign(url.href);
  }

  async function action(button, pending, task) {
    if (acting || refreshing) return;
    acting = true;
    render();
    const previous = button.textContent;
    button.textContent = pending;
    message("action-status", pending);
    try { await task(); }
    catch (error) { message("action-status", error.message, true); }
    finally { acting = false; button.textContent = previous; render(); }
  }

  $("steam").addEventListener("click", () => action($("steam"), "Открываем Steam…", async () => {
    const data = await api("/api/steam/start", {});
    message("action-status", "Завершите привязку во внешнем браузере и вернитесь сюда. Если статус не изменился, нажмите «Обновить».");
    openExternal(data.url);
  }));
  $("claim").addEventListener("click", () => action($("claim"), "Проверяем ключи…", async () => {
    const data = await api("/api/claim", {});
    if (me.user) me.user.key = data.key || "";
    waiting = Boolean(data.waiting);
    message("action-status", data.key ? "Ключ получен и сохранён в вашем аккаунте." : "Свободных ключей пока нет. Попробуйте проверить позже.");
    await loadAdmin();
  }));
  $("group").addEventListener("click", () => action($("group"), "Создаём приглашение…", async () => {
    const data = await api("/api/group", {});
    openExternal(data.url, true);
    message("action-status", "Приглашение в группу открыто.");
  }));
  $("copy").addEventListener("click", async () => {
    if (!$("issued-key").value) return;
    $("copy").disabled = true;
    try {
      await navigator.clipboard.writeText($("issued-key").value);
      $("copy-status").textContent = "Ключ скопирован.";
    } catch {
      $("issued-key").focus();
      $("issued-key").select();
      $("copy-status").textContent = "Не удалось скопировать автоматически. Ключ выделен: скопируйте его через меню устройства или Ctrl/Cmd+C.";
    } finally { $("copy").disabled = false; }
  });

  async function adminSubmit(form, path, body, success) {
    if (adminBusy || !me.admin) return;
    adminBusy = true;
    for (const element of document.querySelectorAll(".admin-forms button, .admin-forms textarea, #admin-refresh")) element.disabled = true;
    message("admin-status", "Сохраняем…");
    try {
      const data = await api(path, body);
      form.reset();
      message("admin-status", success(data));
      await Promise.all([loadAdmin(), loadNews()]);
    } catch (error) { message("admin-status", error.message, true); }
    finally {
      adminBusy = false;
      for (const element of document.querySelectorAll(".admin-forms button, .admin-forms textarea, #admin-refresh")) element.disabled = false;
    }
  }
  $("keys-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const keys = $("keys").value.trim();
    if (!keys) { message("admin-status", "Добавьте хотя бы один ключ.", true); return; }
    adminSubmit(event.currentTarget, "/api/admin/keys", { keys }, (data) => `Импортировано ключей: ${data.imported}. Повторы пропущены.`);
  });
  $("announcement-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (adminBusy) return;
    const text = $("announcement-text").value.trim();
    if (!text) { message("admin-status", "Введите текст объявления.", true); return; }
    $("publish-preview").textContent = text;
    $("publish-dialog").returnValue = "cancel";
    $("publish-dialog").showModal();
  });
  $("publish-dialog").addEventListener("close", () => {
    if ($("publish-dialog").returnValue !== "publish") return;
    const text = $("publish-preview").textContent;
    adminSubmit($("announcement-form"), "/api/admin/announcements", { text }, () => "Объявление опубликовано. Рассылка поставлена в очередь.");
  });
  $("refresh").addEventListener("click", refresh);
  $("news-retry").addEventListener("click", loadNews);
  $("admin-refresh").addEventListener("click", () => { message("admin-status"); loadAdmin(); });
  function onReturn() {
    if (!document.hidden && initialized && Date.now() - lastRefresh > 1500) refresh();
  }
  window.addEventListener("focus", onReturn);
  window.addEventListener("pageshow", (event) => { if (event.persisted) onReturn(); });
  document.addEventListener("visibilitychange", onReturn);
  refresh();
})();
