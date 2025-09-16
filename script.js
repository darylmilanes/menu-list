// ---------- Helpers ----------
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

const meals = ["breakfast", "lunch", "snacks", "dinner"];
let currentDate = new Date();

function formatDate(d) {
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
}

function displayDate(d) {
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function getData(dateStr) {
  // Return localStorage value immediately so callers remain synchronous.
  const key = 'menu-' + dateStr;
  const fromLocal = JSON.parse(localStorage.getItem(key)) || { breakfast: [], lunch: [], snacks: [], dinner: [] };

  // If IndexedDB is available, asynchronously sync DB -> localStorage and refresh views if data changed.
  try {
    if (window.DB && typeof window.DB.get === 'function') {
      window.DB.get(key).then(v => {
        if (v && JSON.stringify(v) !== JSON.stringify(fromLocal)) {
          try {
            localStorage.setItem(key, JSON.stringify(v));
          } catch (e) {}
          // If the currently displayed date matches, refresh the UI to show DB values.
          if (formatDate(currentDate) === dateStr) {
            loadDailyView();
            loadWeeklyView();
          }
        }
      }).catch(()=>{});
    }
  } catch (e) {
    // ignore
  }

  return fromLocal;
}

function saveData(dateStr, data) {
  try {
    if (window.DB) window.DB.put({ id: 'menu-' + dateStr, value: data }).catch(()=>{});
  } catch (e) {}
  localStorage.setItem("menu-" + dateStr, JSON.stringify(data));
}

// ---------- Daily View ----------
function loadDailyView() {
  const dateStr = formatDate(currentDate);
  $("#currentDate").textContent = displayDate(currentDate);
  const data = getData(dateStr);

  meals.forEach(meal => {
    const mealBlock = $(`.meal[data-meal="${meal}"]`);
    const ul = mealBlock.querySelector(".meal-list");
    ul.innerHTML = "";
    data[meal].forEach((item, idx) => {
      const li = document.createElement("li");
      li.textContent = item;
      const del = document.createElement("button");
      del.textContent = "×";
      del.style.border = "none";
      del.style.background = "transparent";
      del.style.cursor = "pointer";
      del.onclick = () => {
        data[meal].splice(idx,1);
        saveData(dateStr,data);
        loadDailyView();
        loadWeeklyView();
      };
      li.appendChild(del);
      ul.appendChild(li);
    });
  });
}

function initAddButtons() {
  $$(".meal").forEach(mealBlock => {
    const meal = mealBlock.dataset.meal;
    const input = mealBlock.querySelector("input");
    const addBtn = mealBlock.querySelector(".add-btn");

    const doAdd = () => {
      const text = input.value.trim();
      if (!text) return;
      const dateStr = formatDate(currentDate);
      // if offline, enqueue the operation to be processed later
      if (!navigator.onLine && window.DB && typeof window.DB.queueAdd === 'function') {
        window.DB.queueAdd({ action: 'add', date: dateStr, meal, value: text }).then(()=>{
          // reflect in localStorage immediately for UX
          const data = getData(dateStr);
          data[meal].push(text);
          saveData(dateStr, data);
          input.value = "";
          loadDailyView();
          loadWeeklyView();
        }).catch(()=>{
          // fallback to normal save if queue fails
          const data = getData(dateStr);
          data[meal].push(text);
          saveData(dateStr, data);
          input.value = "";
          loadDailyView();
          loadWeeklyView();
        });
        return;
      }
      const data = getData(dateStr);
      data[meal].push(text);
      saveData(dateStr, data);
      input.value = "";
      loadDailyView();
      loadWeeklyView();
      try {
        // ensure focus and put caret at end; use setTimeout to wait for DOM updates
        setTimeout(() => {
          input.focus();
          try { input.setSelectionRange(input.value.length, input.value.length); } catch(e) {}
        }, 0);
      } catch (e) {}
    };

    // ensure button doesn't act as a form submit
    try { addBtn.type = 'button'; } catch (e) {}
  addBtn.onclick = () => { try { doAdd(); } catch (err) { console.error('add error', err); } };

    // Allow Enter/Return to add the input. Use keydown for responsiveness,
    // fall back to keyCode for older browsers, and ignore IME composition.
    input.addEventListener('keydown', (e) => {
      const isEnter = (e.key === 'Enter') || (e.keyCode === 13);
      if (isEnter && !e.isComposing) {
        e.preventDefault();
        doAdd();
      }
    });
  });
}

// ---------- Weekly View ----------
function loadWeeklyView() {
  const weekGrid = $("#weekGrid");
  weekGrid.innerHTML = "";
  const base = new Date(currentDate);

  for (let i=0; i<7; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() - base.getDay() + i); // Sunday start
    const dateStr = formatDate(d);
    const data = getData(dateStr);

    const card = document.createElement("div");
    card.className = "week-card";
    const h3 = document.createElement("h3");
    h3.textContent = displayDate(d);
    card.appendChild(h3);

    meals.forEach(meal => {
      const title = document.createElement("strong");
      title.textContent = meal.charAt(0).toUpperCase()+meal.slice(1)+":";
      card.appendChild(title);
      const ul = document.createElement("ul");
      if (data[meal].length === 0) {
        const li = document.createElement("li");
        li.textContent = "(none)";
        ul.appendChild(li);
      } else {
        data[meal].forEach(item=>{
          const li = document.createElement("li");
          li.textContent = item;
          ul.appendChild(li);
        });
      }
      card.appendChild(ul);
    });

    weekGrid.appendChild(card);
  }
}

// ---------- Init ----------
window.onload = () => {
  loadDailyView();
  initAddButtons();
  loadWeeklyView();

  // --- Service Worker registration ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      console.log('ServiceWorker registered', reg.scope);
    }).catch(err => console.warn('SW registration failed', err));
  }

  // --- Install prompt handling ---
  let deferredPrompt = null;
  const installBtn = document.getElementById('installBtn');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.style.display = 'inline-block';
  });

  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice && choice.outcome) {
      console.log('User choice', choice.outcome);
    }
    deferredPrompt = null;
    installBtn.style.display = 'none';
  });

  // --- Online/offline indicator ---
  const offlineBanner = document.getElementById('offlineBanner');
  function updateOnlineStatus() {
    if (navigator.onLine) {
      offlineBanner.style.display = 'none';
      offlineBanner.setAttribute('aria-hidden', 'true');
    } else {
      offlineBanner.style.display = 'block';
      offlineBanner.setAttribute('aria-hidden', 'false');
    }
  }
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();

  // --- Simple IndexedDB wrapper (opens DB and exposes basic methods) ---
  (function initDB() {
    if (!('indexedDB' in window)) return;
    const DB_NAME = 'menu-list-db';
    const DB_VERSION = 1;
    const STORE = 'kv';

  function openDB() {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      // queue store for offline write operations
      if (!db.objectStoreNames.contains('queue')) db.createObjectStore('queue', { keyPath: 'qid', autoIncrement: true });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }

    const DBAPI = {
      db: null,
      async ready() { if (!this.db) this.db = await openDB(); return this.db; },
      async put(obj) {
        const db = await this.ready();
        return new Promise((res, rej) => {
          const tx = db.transaction(STORE, 'readwrite');
          const store = tx.objectStore(STORE);
          const r = store.put(obj);
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
        });
      },
      async get(id) {
        const db = await this.ready();
        return new Promise((res, rej) => {
          const tx = db.transaction(STORE, 'readonly');
          const store = tx.objectStore(STORE);
          const r = store.get(id);
          r.onsuccess = () => res(r.result && r.result.value);
          r.onerror = () => rej(r.error);
        });
      },
      async delete(id) {
        const db = await this.ready();
        return new Promise((res, rej) => {
          const tx = db.transaction(STORE, 'readwrite');
          const store = tx.objectStore(STORE);
          const r = store.delete(id);
          r.onsuccess = () => res();
          r.onerror = () => rej(r.error);
        });
      }
      ,
      // queue methods for offline operations
      async queueAdd(obj) {
        const db = await this.ready();
        return new Promise((res, rej) => {
          const tx = db.transaction('queue', 'readwrite');
          const store = tx.objectStore('queue');
          const r = store.add(obj);
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
        });
      },
      async queueGetAll() {
        const db = await this.ready();
        return new Promise((res, rej) => {
          const tx = db.transaction('queue', 'readonly');
          const store = tx.objectStore('queue');
          const r = store.getAll();
          r.onsuccess = () => res(r.result || []);
          r.onerror = () => rej(r.error);
        });
      },
      async queueDelete(qid) {
        const db = await this.ready();
        return new Promise((res, rej) => {
          const tx = db.transaction('queue', 'readwrite');
          const store = tx.objectStore('queue');
          const r = store.delete(qid);
          r.onsuccess = () => res();
          r.onerror = () => rej(r.error);
        });
      },
      async queueClear() {
        const db = await this.ready();
        return new Promise((res, rej) => {
          const tx = db.transaction('queue', 'readwrite');
          const store = tx.objectStore('queue');
          const r = store.clear();
          r.onsuccess = () => res();
          r.onerror = () => rej(r.error);
        });
      }
    };

    window.DB = DBAPI;
    // when DB is ready, process any queued operations
    DBAPI.ready().then(()=>{
      processQueue().catch(()=>{});
    }).catch(()=>{});
  })();

  async function processQueue() {
    if (!window.DB || typeof window.DB.queueGetAll !== 'function') return;
    try {
      const items = await window.DB.queueGetAll();
      for (const item of items) {
        if (item.action === 'add') {
          const dateStr = item.date;
          const data = getData(dateStr);
          data[item.meal].push(item.value);
          saveData(dateStr, data);
        }
        // remove queue item
        await window.DB.queueDelete(item.qid);
      }
      // refresh UI
      loadDailyView();
      loadWeeklyView();
    } catch (e) {
      console.error('processQueue error', e);
    }
  }

  // process queue on reconnect
  window.addEventListener('online', () => { processQueue().catch(()=>{}); });

  $("#prevDay").onclick = () => {
    currentDate.setDate(currentDate.getDate() - 1);
    loadDailyView();
    loadWeeklyView();
  };
  $("#nextDay").onclick = () => {
    currentDate.setDate(currentDate.getDate() + 1);
    loadDailyView();
    loadWeeklyView();
  };

  $("#toggleView").onclick = () => {
    const daily = $("#dailyView");
    const weekly = $("#weeklyView");
    if (daily.classList.contains("active")) {
      daily.classList.remove("active");
      weekly.classList.add("active");
      $("#toggleView").textContent = "Hide Weekly View";
    } else {
      weekly.classList.remove("active");
      daily.classList.add("active");
      $("#toggleView").textContent = "Show Weekly View";
    }
  };

  // Clicking the app title returns to today's Daily view
  const appTitle = document.querySelector('header.appbar h1');
  if (appTitle) {
    appTitle.style.cursor = 'pointer';
    appTitle.title = 'Go to today';
    appTitle.addEventListener('click', () => {
      currentDate = new Date();
      // ensure daily view is visible
      const daily = $("#dailyView");
      const weekly = $("#weeklyView");
      weekly.classList.remove('active');
      daily.classList.add('active');
      $("#toggleView").textContent = "Show Weekly View";
      loadDailyView();
      loadWeeklyView();
    });
  }
};
