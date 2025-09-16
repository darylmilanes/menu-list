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
  return JSON.parse(localStorage.getItem("menu-" + dateStr)) || {
    breakfast: [], lunch: [], snacks: [], dinner: []
  };
}

function saveData(dateStr, data) {
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
      const data = getData(dateStr);
      data[meal].push(text);
      saveData(dateStr, data);
      input.value = "";
      loadDailyView();
      loadWeeklyView();
    };

    addBtn.onclick = doAdd;

    // Allow Enter/Return to add the input
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
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
