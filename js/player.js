// Telefoonscherm voor spelers.
import {
  configured, auth, db, ref, get, set, onValue, serverTimestamp, signInAnonymously, onAuthStateChanged, serverNow,
} from "./firebase.js";
import {
  shapeSvg, esc, optionsFor, ranking, startSnow, confetti, fmtNum, avatarOf, countUp, monogram,
} from "./common.js";

const $screen = document.getElementById("screen");
const $brand = document.getElementById("brand");
const STORE = "kq-player";

let code = null;
let uid = null;
let myName = "";
let myAvatar = "";
let settings = {};
let state = {};
let current = null;
let scores = {};
let answeredKey = null; // qkey waarop dit toestel al antwoordde
let unsubs = [];
let timerInt = null;

startSnow(0.6);

function saveSession() { try { localStorage.setItem(STORE, JSON.stringify({ code, name: myName, avatar: myAvatar })); } catch { /* */ } }
function loadSession() { try { return JSON.parse(localStorage.getItem(STORE) || "null"); } catch { return null; } }
function clearSession() {
  try { const s = loadSession(); localStorage.setItem(STORE, JSON.stringify({ name: s?.name, avatar: s?.avatar })); } catch { /* */ }
}

function render(html) { $screen.innerHTML = html; }

// ------------------------------------------------------------------
// Meedoen
// ------------------------------------------------------------------
function showJoin(msg = "") {
  stopListening();
  const params = new URLSearchParams(location.search);
  const saved = loadSession();
  const prefill = params.get("code") || saved?.code || "";
  const name = saved?.name || "";
  render(`
    <form id="joinForm" class="frame join-card enter" autocomplete="off">
      <h2>Doe mee</h2>
      <p class="lead">Vul de code van het grote scherm in en je naam.</p>
      <div class="field">
        <label for="code">Spelcode</label>
        <input class="input code-input" id="code" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="000000"
          autocomplete="off" enterkeyhint="next" value="${esc(prefill)}" required>
      </div>
      <div class="field">
        <label for="name">Jouw naam</label>
        <input class="input" id="name" maxlength="20" placeholder="Bijv. Sanne" autocomplete="given-name" enterkeyhint="go" value="${esc(name)}" required>
      </div>
      <p class="error" id="err">${esc(msg)}</p>
      <button class="btn big" style="width:100%" type="submit" id="joinBtn">Meedoen</button>
    </form>`);
  const form = document.getElementById("joinForm");
  const $code = document.getElementById("code");
  const $name = document.getElementById("name");
  if (!prefill) $code.focus();
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const c = $code.value.replace(/\D/g, "");
    const n = $name.value.trim().replace(/\s+/g, " ").slice(0, 20);
    const $err = document.getElementById("err");
    if (c.length !== 6) { $err.textContent = "De code bestaat uit 6 cijfers."; return; }
    if (!n) { $err.textContent = "Vul je naam in."; return; }
    document.getElementById("joinBtn").disabled = true;
    try {
      await join(c, n);
    } catch (err) {
      console.error(err);
      $err.textContent = err.userMessage || explainError(err);
      document.getElementById("joinBtn").disabled = false;
    }
  });
}

function explainError(err) {
  const code = String(err.code || err.message || "onbekend");
  if (/operation-not-allowed|admin-restricted/.test(code)) {
    return "Anoniem inloggen staat nog uit. Quizmaster: zet 'Anonymous' aan in Firebase → Authentication → Sign-in method. (" + code + ")";
  }
  if (/permission.denied|PERMISSION_DENIED/i.test(code)) {
    return "Geen toegang tot de database. Quizmaster: controleer of de regels uit database.rules.json zijn gepubliceerd. (" + code + ")";
  }
  if (/network|unavailable/i.test(code)) return "Geen verbinding. Controleer je internet en probeer opnieuw. (" + code + ")";
  return "Er ging iets mis: " + code;
}

async function ensureAuth() {
  if (auth.currentUser) return auth.currentUser.uid;
  const cred = await signInAnonymously(auth);
  return cred.user.uid;
}

async function join(c, n) {
  uid = await ensureAuth();
  const hostSnap = await get(ref(db, `games/${c}/host`));
  if (!hostSnap.exists()) throw Object.assign(new Error("not found"), { userMessage: "Deze code bestaat niet. Kijk nog eens op het grote scherm." });
  const stateSnap = await get(ref(db, `games/${c}/state`));
  if (stateSnap.val()?.phase === "ended") throw Object.assign(new Error("ended"), { userMessage: "Deze quiz is al afgelopen." });
  const meSnap = await get(ref(db, `games/${c}/players/${uid}`));
  if (meSnap.exists()) {
    myName = meSnap.val().name; // terugkeren na herladen
    myAvatar = avatarOf(meSnap.val(), uid);
  } else {
    // Naam al in gebruik? Voeg een nummer toe.
    const playersSnap = await get(ref(db, `games/${c}/players`));
    const taken = new Set(Object.values(playersSnap.val() || {}).map((p) => p.name.toLowerCase()));
    let finalName = n, i = 2;
    while (taken.has(finalName.toLowerCase())) finalName = `${n.slice(0, 17)} ${i++}`;
    await set(ref(db, `games/${c}/players/${uid}`), { name: finalName, joinedAt: serverTimestamp() });
    myName = finalName;
    myAvatar = avatarOf(null, uid);
  }
  code = c;
  saveSession();
  if (new URLSearchParams(location.search).get("code") !== c) {
    const u = new URL(location.href); u.searchParams.set("code", c); history.replaceState(null, "", u);
  }
  listen();
}

// ------------------------------------------------------------------
// Live meeluisteren
// ------------------------------------------------------------------
function stopListening() { unsubs.forEach((u) => u()); unsubs = []; clearInterval(timerInt); }

function listen() {
  stopListening();
  const base = `games/${code}`;
  unsubs.push(onValue(ref(db, `${base}/settings`), (s) => { settings = s.val() || {}; renderBrand(); }));
  unsubs.push(onValue(ref(db, `${base}/players/${uid}`), (s) => {
    if (!s.exists()) { clearSession(); code = null; showJoin("Je bent uit het spel verwijderd. Je kunt opnieuw meedoen."); }
  }));
  unsubs.push(onValue(ref(db, `${base}/scores`), (s) => { scores = s.val() || {}; update(); }));
  unsubs.push(onValue(ref(db, `${base}/current`), (s) => { current = s.val(); update(); }));
  unsubs.push(onValue(ref(db, `${base}/state`), (s) => { state = s.val() || {}; update(); }));
}

function renderBrand() {
  const logo = settings.logo ? `<img src="${esc(settings.logo)}" alt="">` : "";
  $brand.innerHTML = `${logo}<span class="title">${esc(settings.title || "Kerstquiz")}</span>`;
  document.title = `${settings.title || "Kerstquiz"} – Meedoen`;
}

function myScore() { return scores[uid] || { score: 0, streak: 0 }; }
function myRank() { const r = ranking(scores).find((x) => x.uid === uid); return r ? r.rank : null; }

function topbar() {
  const s = myScore();
  return `<div class="topbar"><span class="me">${monogram(myName)}<span class="nm">${esc(myName)}</span></span>
    <span class="score-pill"><span id="scorePill">${fmtNum(s.score)}</span><small>punten</small></span></div>`;
}

let lastRendered = "";
let shownScore = 0;
function update() {
  if (!code) return;
  const phase = state.phase || "lobby";
  const key = `${phase}|${state.qkey}|${answeredKey}|${JSON.stringify(myScore())}|${current?.qkey}`;
  if (key === lastRendered) return;
  lastRendered = key;
  clearInterval(timerInt);

  if (phase === "lobby") {
    render(`${topbar()}
      <div class="center enter" style="font-size:2.4em">${monogram(myName)}</div>
      <div class="status-big enter">Je staat op de gastenlijst</div>
      <p class="center muted">Kijk of je naam op het grote scherm staat. De quiz begint zo.</p>`);
  } else if (phase === "intro") {
    render(`${topbar()}
      <div class="status-emoji enter">✦</div>
      <div class="status-big enter">Vraag ${state.index + 1} van ${state.total}</div>
      <p class="center muted">Kijk naar het grote scherm.</p>`);
  } else if (phase === "question") {
    if (!current || current.qkey !== state.qkey) return;
    if (answeredKey === state.qkey) showWaiting();
    else showQuestion();
  } else if (phase === "reveal" || phase === "leaderboard") {
    showResult();
  } else if (phase === "podium" || phase === "ended") {
    showFinal();
  }
}

function showQuestion() {
  const q = current;
  const opts = optionsFor(q);
  const endAt = state.startedAt + state.duration * 1000;
  const remainingMs = () => Math.max(0, endAt - serverNow());
  const head = `${topbar()}
    <div class="p-timer"><div id="pbar" style="transform:scaleX(${remainingMs() / (state.duration * 1000)})"></div></div>
    ${q.double ? '<div class="center"><span class="pill">Dubbele punten</span></div>' : ""}
    <div class="p-qtext">${esc(q.text)}</div>`;
  if (q.type === "estimate") {
    render(`${head}
      <form class="p-estimate" id="estForm">
        <input class="input" id="est" type="number" inputmode="decimal" step="any" placeholder="Jouw schatting" required>
        ${q.unit ? `<p class="center muted" style="margin:0">in ${esc(q.unit)}</p>` : ""}
        <button class="btn big" type="submit">Verstuur</button>
      </form>`);
    const $est = document.getElementById("est");
    $est.focus();
    document.getElementById("estForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const v = Number(String($est.value).replace(",", "."));
      if (!isFinite(v) || $est.value === "") return;
      sendAnswer(v);
    });
  } else {
    render(`${head}
      <div class="p-answers ${opts.length === 2 ? "two" : ""}">
        ${opts.map((o, i) => `<button class="p-answer opt-${i}" data-i="${i}">${shapeSvg(i)}<span>${esc(o)}</span></button>`).join("")}
      </div>`);
    $screen.querySelectorAll(".p-answer").forEach((b) => b.addEventListener("click", () => {
      $screen.querySelectorAll(".p-answer").forEach((x) => { x.disabled = true; x.classList.add(x === b ? "chosen" : "faded"); });
      setTimeout(() => sendAnswer(Number(b.dataset.i)), 250);
    }));
  }
  timerInt = setInterval(() => {
    const el = document.getElementById("pbar");
    const r = remainingMs();
    if (el) el.style.transform = `scaleX(${r / (state.duration * 1000)})`;
    if (r <= 0) { clearInterval(timerInt); if (answeredKey !== state.qkey) showTooLate(); }
  }, 200);
}

async function sendAnswer(v) {
  const qkey = state.qkey;
  if (navigator.vibrate) navigator.vibrate(30);
  try {
    await set(ref(db, `games/${code}/answers/${qkey}/${uid}`), { v, t: serverTimestamp() });
    answeredKey = qkey;
    lastRendered = "";
    update();
  } catch (err) {
    console.warn(err);
    // Te laat of al geantwoord
    answeredKey = qkey;
    showTooLate();
  }
}

function showWaiting() {
  const lines = ["Even wachten op de rest.", "Spannend.", "De anderen denken nog na."];
  render(`${topbar()}
    <div class="waiting-mark">✦</div>
    <div class="status-big enter">Antwoord verstuurd</div>
    <p class="center muted">${lines[Math.floor(Math.random() * lines.length)]}</p>`);
}

function showTooLate() {
  render(`${topbar()}
    <div class="status-emoji">✦</div>
    <div class="status-big enter">De tijd is om</div>
    <p class="center muted">Kijk op het grote scherm voor het antwoord.</p>`);
}

function showResult() {
  const s = myScore();
  const last = s.last && s.last.qkey === state.qkey ? s.last : null;
  const rank = myRank();
  const total = Object.keys(scores).length;
  let box;
  if (!last || !last.answered) {
    box = `<div class="result-box neutral frame"><div class="status-big">Geen antwoord</div>
      <p>De volgende keer sneller.</p></div>`;
  } else if (last.correct) {
    const cheers = ["Goed", "Helemaal goed", "Prachtig", "Goed gezien"];
    box = `<div class="result-box ok frame"><div class="status-big">${cheers[Math.floor(Math.random() * cheers.length)]}</div>
      <div class="points">+<span id="ptsUp">0</span></div>
      ${s.streak >= 2 ? `<p>${s.streak} keer op rij goed${last.bonus ? `, +${last.bonus} bonus` : ""}</p>` : ""}</div>`;
  } else if (last.points > 0) {
    box = `<div class="result-box neutral frame"><div class="status-big">Bijna</div>
      <div class="points">+<span id="ptsUp">0</span></div></div>`;
  } else {
    box = `<div class="result-box bad frame"><div class="status-big">Helaas, fout</div>
      <p>De volgende is voor jou.</p></div>`;
  }
  render(`${topbar()}${box}
    ${rank ? `<p class="rank-big">Je staat op plek <b>${rank}</b> <span class="muted">van ${total}</span></p>` : ""}`);
  if (last?.points) countUp(document.getElementById("ptsUp"), 0, last.points, 800);
  const pill = document.getElementById("scorePill");
  if (pill && shownScore !== s.score) countUp(pill, shownScore, s.score, 1000);
  shownScore = s.score;
  if (last?.correct && navigator.vibrate) navigator.vibrate([40, 60, 40]);
}

function showFinal() {
  const rank = myRank();
  const s = myScore();
  const msg = rank === 1 ? "Je hebt gewonnen" : rank <= 3 ? "Je staat op het podium" : "Bedankt voor het meespelen";
  render(`${topbar()}
    <div class="frame result-box ${rank === 1 ? "ok" : "neutral"}">
      <div class="center" style="font-size:2.6em;margin-bottom:.4em">${monogram(myName)}</div>
      <div class="status-big">${msg}</div>
      <p class="rank-big" style="margin-top:.6em">Plek <b>${rank ?? "–"}</b> met <b>${fmtNum(s.score)}</b> punten</p>
    </div>
    <p class="center muted script" style="font-size:1.3em">Fijne feestdagen</p>`);
  if (state.phase === "podium" && rank && rank <= 3) setTimeout(() => confetti(140), 600);
}

// ------------------------------------------------------------------
// Start
// ------------------------------------------------------------------
if (!configured) {
  render(`<div class="card center"><h2>Nog niet ingesteld</h2><p class="muted">De quizmaster moet Firebase nog koppelen (zie README).</p></div>`);
} else {
  const saved = loadSession();
  const urlCode = new URLSearchParams(location.search).get("code");
  const unsub = onAuthStateChanged(auth, async (user) => {
    unsub();
    if (user && saved?.code && (!urlCode || urlCode === saved.code)) {
      // Automatisch terugkeren in het spel na herladen
      try {
        uid = user.uid;
        const me = await get(ref(db, `games/${saved.code}/players/${uid}`));
        const st = await get(ref(db, `games/${saved.code}/state`));
        if (me.exists() && st.val()?.phase !== "ended") {
          code = saved.code; myName = me.val().name; myAvatar = avatarOf(me.val(), uid);
          const ans = st.val()?.qkey ? await get(ref(db, `games/${code}/answers/${st.val().qkey}/${uid}`)).catch(() => null) : null;
          if (ans?.exists()) answeredKey = st.val().qkey;
          const sc = await get(ref(db, `games/${code}/scores/${uid}`)).catch(() => null);
          shownScore = sc?.val()?.score || 0;
          listen();
          return;
        }
      } catch (e) { console.warn(e); }
    }
    showJoin();
  });
}
