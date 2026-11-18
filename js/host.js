// Quizmaster: inloggen, vragen beheren en het grote scherm.
import {
  configured, auth, db, ref, get, set, update, remove, onValue, push, serverTimestamp,
  signInWithEmailAndPassword, signOut, onAuthStateChanged, serverNow, emuSuffix,
} from "./firebase.js";
import {
  shapeSvg, esc, optionsFor, computeResults, ranking, startSnow, confetti, resizeImage, fmtNum, TYPE_LABELS,
  avatarOf, lightsHtml, countUp, monogram, bubbleBurst, burstFrom,
} from "./common.js";
import * as sfx from "./sound.js";
import { SAMPLE_QUESTIONS } from "./samples.js";

const $app = document.getElementById("app");
const $modal = document.getElementById("modal");
const ACTIVE = "kq-active-game";

let user = null;
let questions = [];      // [{id, ...}] gesorteerd op volgorde
let settings = {};
let dashUnsubs = [];

startSnow(1);

// ==================================================================
// Inloggen
// ==================================================================
function showSetupNeeded() {
  $app.innerHTML = `<div class="admin">${lightsHtml(16)}<div class="card">
    <h1 style="color:var(--gold-light)">Bijna klaar</h1>
    <p>De quiz is nog niet gekoppeld aan Firebase. Volg de stappen in <b>README.md</b> en vul daarna
    <code>js/config.js</code> in met de gegevens van je Firebase-project.</p></div></div>`;
}

function showLogin(msg = "") {
  $app.innerHTML = `
    <div class="admin">${lightsHtml(16)}<form class="frame login enter" id="loginForm">
      <h1 class="center" style="color:var(--gold-light)">Quizmaster</h1>
      <p class="center muted">Log in om de quiz te beheren en te starten.</p>
      <div class="field"><label for="email">E-mailadres</label><input class="input" id="email" type="email" autocomplete="username" required></div>
      <div class="field"><label for="pw">Wachtwoord</label><input class="input" id="pw" type="password" autocomplete="current-password" required></div>
      <p class="error" id="err">${esc(msg)}</p>
      <button class="btn" style="width:100%" type="submit">Inloggen</button>
    </form></div>`;
  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const $err = document.getElementById("err");
    $err.textContent = "";
    try {
      await signInWithEmailAndPassword(auth, document.getElementById("email").value.trim(), document.getElementById("pw").value);
    } catch (err) {
      console.warn(err);
      $err.textContent = /invalid|wrong|not-found|credential/.test(err.code || "")
        ? "E-mailadres of wachtwoord klopt niet."
        : "Inloggen lukt niet: " + (err.code || err.message);
    }
  });
}

// ==================================================================
// Beheer (dashboard)
// ==================================================================
let activeTab = "questions";

function showDashboard() {
  stopDash();
  sfx.stopMusic();
  $app.innerHTML = `
    <div class="admin">
      ${lightsHtml(16)}
      <div class="admin-head">
        <h1>Quizmaster</h1>
        <div class="row" style="flex:0 0 auto;gap:.5em">
          <button class="btn ghost small" id="logout">Uitloggen</button>
        </div>
      </div>
      <div id="resume"></div>
      <div class="card" style="display:flex;justify-content:space-between;align-items:center;gap:1em;flex-wrap:wrap;margin-bottom:1.2em">
        <div><b id="sumTitle">Kerstquiz</b><div class="muted" id="sumCount">0 vragen</div></div>
        <button class="btn big" id="startBtn">Start de quiz</button>
      </div>
      <div class="tabs">
        <button class="tab" data-tab="questions">Vragen</button>
        <button class="tab" data-tab="settings">Instellingen</button>
      </div>
      <div id="tabBody"></div>
    </div>`;
  document.getElementById("logout").onclick = () => signOut(auth);
  document.getElementById("startBtn").onclick = startNewGame;
  $app.querySelectorAll(".tab").forEach((t) => (t.onclick = () => { activeTab = t.dataset.tab; renderTab(); }));

  const base = `quiz/${user.uid}`;
  dashUnsubs.push(onValue(ref(db, `${base}/questions`), (s) => {
    questions = Object.entries(s.val() || {}).map(([id, q]) => ({ id, ...q })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    renderSummary();
    if (activeTab === "questions") renderTab();
  }));
  dashUnsubs.push(onValue(ref(db, `${base}/settings`), (s) => {
    settings = s.val() || {};
    renderSummary();
    if (activeTab === "settings") renderTab();
  }));
  checkResume();
  renderTab();
}

function stopDash() { dashUnsubs.forEach((u) => u()); dashUnsubs = []; }

function renderSummary() {
  const t = document.getElementById("sumTitle");
  if (!t) return;
  t.textContent = settings.title || "Kerstquiz";
  document.getElementById("sumCount").textContent = `${questions.length} ${questions.length === 1 ? "vraag" : "vragen"}`;
  document.getElementById("startBtn").disabled = questions.length === 0;
}

async function checkResume() {
  let code = null;
  try { code = localStorage.getItem(ACTIVE); } catch { /* */ }
  if (!code) return;
  try {
    const snap = await get(ref(db, `games/${code}`));
    const g = snap.val();
    if (!g || g.host !== user.uid || g.state?.phase === "ended") { localStorage.removeItem(ACTIVE); return; }
    const box = document.getElementById("resume");
    if (!box) return;
    box.innerHTML = `<div class="notice" style="display:flex;justify-content:space-between;align-items:center;gap:1em;flex-wrap:wrap">
      <span>Er loopt nog een quiz met code <b>${esc(code)}</b>.</span>
      <span class="row" style="flex:0 0 auto;gap:.5em"><button class="btn small" id="resumeBtn">Verder gaan</button>
      <button class="btn ghost small" id="endBtn">Beëindigen</button></span></div>`;
    document.getElementById("resumeBtn").onclick = () => enterStage(code, g);
    document.getElementById("endBtn").onclick = async () => {
      await update(ref(db, `games/${code}/state`), { phase: "ended" });
      localStorage.removeItem(ACTIVE); box.innerHTML = "";
    };
  } catch (e) { console.warn(e); }
}

function renderTab() {
  $app.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === activeTab));
  const body = document.getElementById("tabBody");
  if (!body) return;
  if (activeTab === "questions") renderQuestions(body);
  else renderSettings(body);
}

// ---------------- Vragenlijst ----------------
function questionMeta(q) {
  const bits = [TYPE_LABELS[q.type] || q.type, `${q.time || 20} sec`];
  if (q.double) bits.push("⭐ dubbele punten");
  if (q.type === "mc") bits.push(`antwoord: ${q.options?.[q.correct] ?? "?"}`);
  if (q.type === "tf") bits.push(`antwoord: ${q.correct === 0 ? "Waar" : "Niet waar"}`);
  if (q.type === "estimate") bits.push(`antwoord: ${fmtNum(q.correct)}${q.unit ? " " + q.unit : ""}`);
  return bits.join(" · ");
}

function renderQuestions(body) {
  body.innerHTML = `
    <div class="row" style="margin-bottom:1em;gap:.6em">
      <button class="btn" id="addQ" style="flex:0 0 auto">+ Nieuwe vraag</button>
      ${questions.length === 0 ? '<button class="btn ghost" id="addSamples" style="flex:0 0 auto">Voorbeeldvragen toevoegen</button>' : ""}
    </div>
    ${questions.length === 0 ? `<div class="card empty">Nog geen vragen. Voeg er een toe, of begin met een paar voorbeeldvragen over kerst.</div>` : ""}
    <div class="q-list">
      ${questions.map((q, i) => `
        <div class="q-item" data-id="${q.id}">
          <span class="nr">${i + 1}</span>
          <span class="thumb" style="${q.image ? `background-image:url('${q.image}')` : ""}">${q.image ? "" : { mc: "🔠", tf: "⚖️", estimate: "🔢" }[q.type] || "❓"}</span>
          <div class="info"><div class="t">${esc(q.text) || "<i>(zonder tekst)</i>"}</div><div class="m">${esc(questionMeta(q))}</div></div>
          <div class="acts">
            <button class="icon-btn" data-act="up" title="Omhoog" ${i === 0 ? "disabled" : ""}>↑</button>
            <button class="icon-btn" data-act="down" title="Omlaag" ${i === questions.length - 1 ? "disabled" : ""}>↓</button>
            <button class="icon-btn" data-act="edit" title="Bewerken">✏️</button>
            <button class="icon-btn" data-act="copy" title="Dupliceren">⧉</button>
            <button class="icon-btn" data-act="del" title="Verwijderen">🗑</button>
          </div>
        </div>`).join("")}
    </div>`;
  document.getElementById("addQ").onclick = () => openEditor(null);
  const s = document.getElementById("addSamples");
  if (s) s.onclick = addSamples;
  body.querySelectorAll(".q-item").forEach((row) => {
    const id = row.dataset.id;
    row.querySelectorAll("[data-act]").forEach((b) => (b.onclick = () => questionAction(id, b.dataset.act)));
    row.querySelector(".info").onclick = () => openEditor(questions.find((q) => q.id === id));
    row.querySelector(".info").style.cursor = "pointer";
  });
}

async function questionAction(id, act) {
  const i = questions.findIndex((q) => q.id === id);
  const q = questions[i];
  const base = `quiz/${user.uid}/questions`;
  if (act === "edit") return openEditor(q);
  if (act === "del") {
    if (confirm(`Vraag ${i + 1} verwijderen?\n\n${q.text}`)) await remove(ref(db, `${base}/${id}`));
    return;
  }
  if (act === "copy") {
    const { id: _, ...data } = q;
    await renumber([...questions.slice(0, i + 1), { ...data, id: push(ref(db, base)).key, text: q.text }, ...questions.slice(i + 1)], true);
    return;
  }
  const j = act === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= questions.length) return;
  const list = [...questions];
  [list[i], list[j]] = [list[j], list[i]];
  await renumber(list);
}

/** Zet de volgorde opnieuw. Met full=true worden ook nieuwe vragen weggeschreven. */
async function renumber(list, full = false) {
  const upd = {};
  list.forEach((q, idx) => {
    if (full && !questions.some((x) => x.id === q.id)) {
      const { id, ...data } = q;
      upd[`${id}`] = { ...data, order: idx };
    } else upd[`${q.id}/order`] = idx;
  });
  await update(ref(db, `quiz/${user.uid}/questions`), upd);
}

async function addSamples() {
  const base = `quiz/${user.uid}/questions`;
  const upd = {};
  SAMPLE_QUESTIONS.forEach((q, i) => { upd[push(ref(db, base)).key] = { ...q, order: i }; });
  await update(ref(db, base), upd);
}

// ---------------- Vraag-editor ----------------
function openEditor(q) {
  const isNew = !q;
  const d = q ? structuredClone(q) : { type: "mc", text: "", options: ["", "", "", ""], correct: 0, time: 20, double: false };
  if (!d.options) d.options = ["", "", "", ""];
  while (d.options.length < 4) d.options.push("");

  const draw = () => {
    const mcCorrect = d.type === "mc" ? d.correct : 0;
    $modal.innerHTML = `
      <div class="modal-bg"><form class="modal" id="qForm">
        <h2>${isNew ? "Nieuwe vraag" : "Vraag bewerken"}</h2>
        <div class="row">
          <div class="field"><label for="qType">Soort vraag</label>
            <select class="input" id="qType">
              ${Object.entries(TYPE_LABELS).map(([k, v]) => `<option value="${k}" ${d.type === k ? "selected" : ""}>${v}</option>`).join("")}
            </select></div>
          <div class="field"><label for="qTime">Tijd</label>
            <select class="input" id="qTime">
              ${[10, 15, 20, 30, 45, 60, 90].map((t) => `<option value="${t}" ${Number(d.time) === t ? "selected" : ""}>${t} seconden</option>`).join("")}
            </select></div>
        </div>
        <div class="field"><label for="qText">Vraag</label>
          <textarea class="input" id="qText" maxlength="200" required placeholder="Bijv. Hoeveel rendieren trekken de slee van de Kerstman?">${esc(d.text)}</textarea></div>

        <div class="field"><label>Foto (optioneel, alleen op het grote scherm)</label>
          ${d.image ? `<img class="img-preview" src="${d.image}" alt=""><div><button type="button" class="btn ghost small" id="rmImg">Foto verwijderen</button></div>` : ""}
          <input type="file" accept="image/*" id="qImg" class="input">
        </div>

        <div id="typeFields">
        ${d.type === "mc" ? `
          <label class="muted" style="font-weight:600;font-size:.9em">Antwoorden (vink het goede antwoord aan, minimaal 2 invullen)</label>
          ${[0, 1, 2, 3].map((i) => `
            <div class="opt-edit">
              <span class="sw opt-${i}">${shapeSvg(i)}</span>
              <input class="input" data-opt="${i}" maxlength="80" placeholder="Antwoord ${i + 1}" value="${esc(d.options[i])}">
              <label class="correct"><input type="radio" name="corr" value="${i}" ${mcCorrect === i ? "checked" : ""}> goed</label>
            </div>`).join("")}` : ""}
        ${d.type === "tf" ? `
          <div class="field"><label>Het goede antwoord is</label>
            <div class="row">
              <label class="correct"><input type="radio" name="corr" value="0" ${d.correct === 0 ? "checked" : ""}> Waar</label>
              <label class="correct"><input type="radio" name="corr" value="1" ${d.correct === 1 ? "checked" : ""}> Niet waar</label>
            </div></div>` : ""}
        ${d.type === "estimate" ? `
          <div class="row">
            <div class="field"><label for="qNum">Goede antwoord (getal)</label>
              <input class="input" id="qNum" type="number" step="any" required value="${d.type === "estimate" && d.correct !== undefined ? esc(d.correct) : ""}"></div>
            <div class="field"><label for="qUnit">Eenheid (optioneel)</label>
              <input class="input" id="qUnit" maxlength="20" placeholder="bijv. kilo, jaar, stuks" value="${esc(d.unit || "")}"></div>
          </div>
          <p class="muted" style="font-size:.9em">Wie het dichtst in de buurt zit krijgt 1000 punten. Anderen krijgen minder, afhankelijk van hoe ver ze ernaast zitten.</p>` : ""}
        </div>

        <label class="correct" style="display:flex;gap:.5em;align-items:center;margin-top:.5em;cursor:pointer">
          <input type="checkbox" id="qDouble" ${d.double ? "checked" : ""}> ⭐ Dubbele punten voor deze vraag</label>
        <p class="error" id="qErr"></p>
        <div class="modal-actions">
          <button type="button" class="btn ghost" id="qCancel">Annuleren</button>
          <button type="submit" class="btn">Opslaan</button>
        </div>
      </form></div>`;

    const collect = () => {
      d.text = document.getElementById("qText").value;
      d.time = Number(document.getElementById("qTime").value);
      d.double = document.getElementById("qDouble").checked;
      if (d.type === "mc") {
        $modal.querySelectorAll("[data-opt]").forEach((inp) => { d.options[Number(inp.dataset.opt)] = inp.value; });
        const r = $modal.querySelector("input[name=corr]:checked"); d.correct = r ? Number(r.value) : 0;
      } else if (d.type === "tf") {
        const r = $modal.querySelector("input[name=corr]:checked"); d.correct = r ? Number(r.value) : 0;
      } else if (d.type === "estimate") {
        const v = document.getElementById("qNum").value; d.correct = v === "" ? undefined : Number(v);
        d.unit = document.getElementById("qUnit").value;
      }
    };

    document.getElementById("qType").onchange = (e) => {
      collect();
      const prevType = d.type;
      d.type = e.target.value;
      if (prevType !== d.type) d.correct = d.type === "estimate" ? undefined : 0;
      draw();
    };
    document.getElementById("qCancel").onclick = closeModal;
    const rm = document.getElementById("rmImg");
    if (rm) rm.onclick = () => { collect(); delete d.image; draw(); };
    document.getElementById("qImg").onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      collect();
      try { d.image = await resizeImage(f, 1280); draw(); }
      catch (err) { document.getElementById("qErr").textContent = err.message; }
    };
    document.getElementById("qForm").onsubmit = async (e) => {
      e.preventDefault();
      collect();
      const $err = document.getElementById("qErr");
      const out = { type: d.type, text: d.text.trim(), time: d.time, double: !!d.double };
      if (!out.text) { $err.textContent = "Vul de vraag in."; return; }
      if (d.image) out.image = d.image;
      if (d.type === "mc") {
        const filled = d.options.map((o, i) => ({ o: o.trim(), i })).filter((x) => x.o);
        if (filled.length < 2) { $err.textContent = "Vul minimaal 2 antwoorden in."; return; }
        const ci = filled.findIndex((x) => x.i === d.correct);
        if (ci < 0) { $err.textContent = "Het aangevinkte goede antwoord is leeg."; return; }
        out.options = filled.map((x) => x.o);
        out.correct = ci;
      } else if (d.type === "tf") {
        out.correct = d.correct === 1 ? 1 : 0;
      } else {
        if (d.correct === undefined || !isFinite(d.correct)) { $err.textContent = "Vul het goede getal in."; return; }
        out.correct = d.correct;
        if (d.unit?.trim()) out.unit = d.unit.trim();
      }
      const base = `quiz/${user.uid}/questions`;
      try {
        if (isNew) {
          out.order = questions.length ? Math.max(...questions.map((x) => x.order ?? 0)) + 1 : 0;
          await set(push(ref(db, base)), out);
        } else {
          out.order = q.order ?? 0;
          await set(ref(db, `${base}/${q.id}`), out);
        }
        closeModal();
      } catch (err) {
        console.error(err);
        $err.textContent = "Opslaan mislukt: " + (err.code || err.message);
      }
    };
  };
  draw();
}

function closeModal() { $modal.innerHTML = ""; }

// ---------------- Instellingen ----------------
function renderSettings(body) {
  const s = { title: "Kerstquiz", company: "", autoNext: 10, ...settings };
  body.innerHTML = `
    <form class="card" id="setForm">
      <div class="row">
        <div class="field"><label for="sTitle">Naam van de quiz</label><input class="input" id="sTitle" maxlength="40" value="${esc(s.title)}"></div>
        <div class="field"><label for="sCompany">Bedrijfsnaam</label><input class="input" id="sCompany" maxlength="40" value="${esc(s.company)}" placeholder="Bijv. Jansen & Co"></div>
      </div>
      <div class="field"><label for="sAuto">Automatisch doorgaan na het antwoord en de tussenstand</label>
        <select class="input" id="sAuto">
          ${[[0, "Uit – ik klik zelf door"], [5, "Na 5 seconden"], [8, "Na 8 seconden"], [10, "Na 10 seconden"], [15, "Na 15 seconden"], [20, "Na 20 seconden"]]
            .map(([v, l]) => `<option value="${v}" ${Number(s.autoNext) === v ? "selected" : ""}>${l}</option>`).join("")}
        </select>
        <span class="muted" style="font-size:.85em">Tijdens de quiz kun je dit altijd pauzeren met de knop ⏸ of de toets P.</span>
      </div>
      <div class="field"><label>Logo</label>
        ${s.logo ? `<div><img class="logo-preview" src="${s.logo}" alt="Logo"></div><div><button type="button" class="btn ghost small" id="rmLogo">Logo verwijderen</button></div>` : ""}
        <input class="input" type="file" accept="image/*" id="sLogo">
        <span class="muted" style="font-size:.85em">Tip: een logo met transparante achtergrond (PNG) staat het mooist.</span>
      </div>
      <p class="error" id="sErr"></p>
      <div class="row" style="align-items:center"><button class="btn" type="submit" style="flex:0 0 auto">Opslaan</button><span class="muted" id="sOk"></span></div>
    </form>`;
  const base = `quiz/${user.uid}/settings`;
  document.getElementById("setForm").onsubmit = async (e) => {
    e.preventDefault();
    await update(ref(db, base), {
      title: document.getElementById("sTitle").value.trim() || "Kerstquiz",
      company: document.getElementById("sCompany").value.trim(),
      autoNext: Number(document.getElementById("sAuto").value),
    });
    document.getElementById("sOk").textContent = "Opgeslagen ✓";
  };
  document.getElementById("sLogo").onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try { await update(ref(db, base), { logo: await resizeImage(f, 400, "image/png") }); }
    catch (err) { document.getElementById("sErr").textContent = err.message; }
  };
  const rm = document.getElementById("rmLogo");
  if (rm) rm.onclick = () => update(ref(db, base), { logo: null });
}

// ==================================================================
// Spel: groot scherm
// ==================================================================
const G = {
  code: null, qs: [], settings: {}, players: {}, scores: {}, state: {}, reveal: null,
  unsubs: [], timerInt: null, answerUnsub: null, busy: false, introTimer: null,
  autoTimer: null, paused: false, prevRanks: {},
};

async function startNewGame() {
  if (!questions.length) return;
  sfx.unlock();
  const btn = document.getElementById("startBtn");
  btn.disabled = true;
  try {
    let code;
    for (let i = 0; i < 20; i++) {
      const c = String(Math.floor(100000 + Math.random() * 900000));
      if (!(await get(ref(db, `games/${c}/host`))).exists()) { code = c; break; }
    }
    if (!code) throw new Error("Geen vrije code gevonden");
    const qs = questions.map(({ id, order, ...q }) => q);
    const st = {
      title: settings.title || "Kerstquiz", company: settings.company || "", logo: settings.logo || null,
      autoNext: settings.autoNext ?? 10,
    };
    const game = {
      host: user.uid, createdAt: serverTimestamp(), settings: st, questions: qs,
      state: { phase: "lobby", index: -1, total: qs.length },
    };
    await set(ref(db, `games/${code}`), game);
    try { localStorage.setItem(ACTIVE, code); } catch { /* */ }
    enterStage(code, { ...game, state: game.state });
  } catch (err) {
    console.error(err);
    alert("Starten mislukt: " + (err.code || err.message));
    btn.disabled = false;
  }
}

function enterStage(code, g) {
  stopDash();
  closeModal();
  sfx.unlock();
  Object.assign(G, {
    code, qs: g.questions || [], settings: g.settings || {}, players: g.players || {}, scores: g.scores || {},
    state: g.state || { phase: "lobby" }, reveal: g.reveal || null, busy: false, paused: false, prevRanks: {},
  });
  $app.innerHTML = `
    <div class="stage">
      ${lightsHtml(26)}
      <div class="stage-top">
        <div class="stage-brand">
          ${G.settings.logo ? `<img src="${G.settings.logo}" alt="">` : ""}
          <span>${esc(G.settings.title || "Kerstquiz")}</span>
          ${G.settings.company ? `<span class="company">${esc(G.settings.company)}</span>` : ""}
        </div>
        <div class="stage-controls">
          <span class="pill" id="pCount">0 spelers</span>
          <button class="icon-btn" id="muteBtn" title="Geluid aan/uit">${sfx.isMuted() ? "🔇" : "🔊"}</button>
          <button class="icon-btn" id="fsBtn" title="Volledig scherm">⛶</button>
          <button class="icon-btn" id="quitBtn" title="Terug naar beheer">✕</button>
        </div>
      </div>
      <div class="stage-main" id="main"></div>
      <div class="stage-bottom">
        <div class="auto-bar hidden" id="autoBar"><div></div></div>
        <span id="bottomLeft">Meedoen: code <b style="color:var(--gold)">${code}</b></span>
        <div class="right">
          <button class="icon-btn hidden" id="pauseBtn" title="Automatisch doorgaan pauzeren (P)">Pauze</button>
          <button class="btn" id="nextBtn">Volgende</button>
        </div>
      </div>
    </div>`;
  document.getElementById("muteBtn").onclick = (e) => {
    sfx.setMuted(!sfx.isMuted()); e.currentTarget.textContent = sfx.isMuted() ? "🔇" : "🔊";
  };
  document.getElementById("fsBtn").onclick = () => {
    if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.();
  };
  document.getElementById("quitBtn").onclick = () => {
    if (!confirm("Terug naar het beheerscherm? De quiz blijft bewaard; je kunt daarna verder gaan.")) return;
    leaveStage();
  };
  document.getElementById("nextBtn").onclick = next;
  document.getElementById("pauseBtn").onclick = togglePause;
  document.addEventListener("keydown", onKey);

  const base = `games/${code}`;
  G.unsubs.push(onValue(ref(db, `${base}/players`), (s) => {
    const before = Object.keys(G.players).length;
    G.players = s.val() || {};
    const n = Object.keys(G.players).length;
    document.getElementById("pCount").textContent = `${n} ${n === 1 ? "speler" : "spelers"}`;
    if (G.state.phase === "lobby") { renderLobbyPlayers(); if (n > before) sfx.clink(); }
    updateNextBtn();
  }));
  G.unsubs.push(onValue(ref(db, `${base}/scores`), (s) => { G.scores = s.val() || {}; }));

  resumePhase();
}

function leaveStage() {
  cleanupStage();
  showDashboard();
}

function cleanupStage() {
  G.unsubs.forEach((u) => u()); G.unsubs = [];
  if (G.answerUnsub) { G.answerUnsub(); G.answerUnsub = null; }
  clearInterval(G.timerInt); clearTimeout(G.introTimer); clearAuto();
  document.removeEventListener("keydown", onKey);
  sfx.stopMusic();
}

function onKey(e) {
  if (e.target.matches("input, textarea, select")) return;
  if (e.key === "p" || e.key === "P") { e.preventDefault(); togglePause(); return; }
  if (e.key === " " || e.key === "Enter" || e.key === "ArrowRight") {
    e.preventDefault();
    const b = document.getElementById("nextBtn");
    if (b && !b.disabled && !b.classList.contains("hidden")) next();
  }
}

const $main = () => document.getElementById("main");
const playerCount = () => Object.keys(G.players).length;

function setNext(label, enabled = true, visible = true) {
  const b = document.getElementById("nextBtn");
  if (!b) return;
  b.textContent = label; b.disabled = !enabled; b.classList.toggle("hidden", !visible);
}
function updateNextBtn() {
  if (G.state.phase === "lobby") setNext("Start de quiz", playerCount() > 0);
}

async function setState(patch, extra = {}) {
  G.state = { ...G.state, ...patch };
  const upd = { ...extra };
  for (const [k, v] of Object.entries(patch)) upd[`state/${k}`] = v;
  await update(ref(db, `games/${G.code}`), upd);
}

// ---------------- Automatisch doorgaan ----------------
function autoSeconds() { return Number(G.settings.autoNext ?? 10) || 0; }

function clearAuto() {
  clearTimeout(G.autoTimer); G.autoTimer = null;
  const bar = document.getElementById("autoBar");
  if (bar) { bar.classList.add("hidden"); bar.firstElementChild.style.transition = "none"; bar.firstElementChild.style.width = "0"; }
}

/** Start het aftellen naar de volgende stap (alleen na antwoord en tussenstand). */
function scheduleAuto() {
  clearAuto();
  const sec = autoSeconds();
  const pb = document.getElementById("pauseBtn");
  if (pb) {
    pb.classList.toggle("hidden", !sec);
    pb.textContent = G.paused ? "Hervat" : "Pauze";
    pb.classList.toggle("on", G.paused);
  }
  if (!sec || G.paused) return;
  const bar = document.getElementById("autoBar");
  if (bar) {
    const fill = bar.firstElementChild;
    bar.classList.remove("hidden");
    fill.style.transition = "none"; fill.style.width = "0";
    void fill.offsetWidth;
    fill.style.transition = `width ${sec}s linear`; fill.style.width = "100%";
  }
  const phase = G.state.phase;
  G.autoTimer = setTimeout(() => { if (G.state.phase === phase) next(); }, sec * 1000);
}

function hidePause() { const pb = document.getElementById("pauseBtn"); if (pb) pb.classList.add("hidden"); }

function togglePause() {
  if (!autoSeconds() || !["reveal", "leaderboard"].includes(G.state.phase)) return;
  G.paused = !G.paused;
  if (G.paused) clearAuto();
  scheduleAuto();
}

function next() {
  if (G.busy) return;
  clearAuto();
  hidePause();
  sfx.unlock();
  const p = G.state.phase;
  if (p === "lobby") startGameplay();
  else if (p === "question") doReveal();
  else if (p === "reveal") (G.state.index >= G.qs.length - 1 ? showPodium() : showLeaderboard());
  else if (p === "leaderboard") startIntro(G.state.index + 1);
  else if (p === "podium") finishGame();
}

function resumePhase() {
  const p = G.state.phase;
  if (p === "lobby") return showLobby();
  if (p === "intro") return startIntro(G.state.index);
  if (p === "question") {
    if (serverNow() > G.state.startedAt + G.state.duration * 1000) return doReveal();
    return showQuestion(true);
  }
  if (p === "reveal") return renderReveal();
  if (p === "leaderboard") return showLeaderboard();
  if (p === "podium") return showPodium();
  return leaveStage();
}

// ---------------- Lobby ----------------
function joinUrl() {
  return `${new URL("./", location.href).href}?code=${G.code}${emuSuffix ? "&emu" : ""}`;
}

function showLobby() {
  sfx.lobbyMusic();
  const url = joinUrl();
  const shortUrl = new URL("./", location.href).host + new URL("./", location.href).pathname.replace(/\/$/, "");
  let qrSvg = "";
  try {
    const qr = window.qrcode(0, "M"); qr.addData(url); qr.make();
    qrSvg = qr.createSvgTag({ cellSize: 8, margin: 0, scalable: true });
  } catch (e) { console.warn(e); }
  $main().innerHTML = `
    <div class="lobby">
      <div class="join">
        <div class="frame ivory invite">
          <div class="script" style="color:var(--gold-deep)">Welkom bij de</div>
          <div class="event">${esc(G.settings.title || "Kerstquiz")}</div>
          <div class="qr">${qrSvg}</div>
          <div class="how">Scan de code met je telefoon, of ga naar</div>
          <div class="url">${esc(shortUrl)}</div>
          <div class="how">en vul deze code in</div>
          <div class="code">${G.code}</div>
        </div>
      </div>
      <div class="players">
        <h2><span class="foil">Gastenlijst</span> <span class="count-badge" id="pNum">0</span></h2>
        <div class="chips" id="chips"></div>
        <p class="muted" style="margin-top:auto;font-size:2vh">Klik op een naam om iemand te verwijderen.</p>
      </div>
    </div>`;
  document.getElementById("bottomLeft").innerHTML = `Druk op <b>spatie</b> of de knop om te beginnen`;
  renderLobbyPlayers();
  updateNextBtn();
}

function renderLobbyPlayers() {
  const el = document.getElementById("chips");
  if (!el) return;
  const list = Object.entries(G.players).sort((a, b) => (a[1].joinedAt || 0) - (b[1].joinedAt || 0));
  const badge = document.getElementById("pNum");
  badge.textContent = `${list.length} ${list.length === 1 ? "gast" : "gasten"}`;
  // Alleen nieuwe namen toevoegen, zodat bestaande chips niet opnieuw animeren
  const have = new Set([...el.querySelectorAll(".chip")].map((c) => c.dataset.uid));
  const want = new Set(list.map(([uid]) => uid));
  el.querySelectorAll(".chip").forEach((c) => { if (!want.has(c.dataset.uid)) c.remove(); });
  el.querySelector(".waiting")?.remove();
  for (const [uid, p] of list) {
    if (have.has(uid)) continue;
    const b = document.createElement("button");
    let h = 0; for (const ch of uid) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    // Gasten krijgen om de beurt een metaalkleur, zodat buren verschillen
    b.className = `chip opt-${(el.querySelectorAll(".chip").length) % 4}`; b.dataset.uid = uid; b.title = "Verwijderen";
    b.style.setProperty("--r", `${((h % 9) - 4) * 0.7}deg`);
    b.innerHTML = `${monogram(p.name)}<span>${esc(p.name)}</span>`;
    b.onclick = async () => {
      if (confirm(`${p.name} verwijderen?`)) {
        await update(ref(db, `games/${G.code}`), { [`players/${uid}`]: null, [`scores/${uid}`]: null });
      }
    };
    el.appendChild(b);
    if (have.size || list.length === 1) setTimeout(() => burstFrom(b, 14), 350);
  }
  if (!list.length) el.innerHTML = `<div class="waiting">Wachten op de eerste gast…</div>`;
}

async function startGameplay() {
  G.busy = true;
  // Iedereen begint met 0 punten zodat ze op het scorebord staan.
  const upd = {};
  for (const [uid, p] of Object.entries(G.players)) {
    if (!G.scores[uid]) upd[`scores/${uid}`] = { name: p.name, avatar: avatarOf(p, uid), score: 0, streak: 0 };
  }
  if (Object.keys(upd).length) await update(ref(db, `games/${G.code}`), upd);
  G.busy = false;
  startIntro(0);
}

// ---------------- Vraag ----------------
async function startIntro(i) {
  G.busy = true;
  sfx.stopMusic();
  sfx.clink();
  const q = G.qs[i];
  await setState({ phase: "intro", index: i, total: G.qs.length, qkey: `q${i}` });
  $main().innerHTML = `
    <div class="big-title">
      <div class="numeral"><span class="foil">${i + 1}</span></div>
      <div class="numeral-of">van ${G.qs.length}</div>
      <div class="rule" style="width:min(28vw,420px)"><span>✦</span></div>
      <div class="sub enter-soft" style="animation-delay:200ms">${q.double ? '<span class="badge-double">Dubbele punten</span>' : esc(TYPE_LABELS[q.type])}</div>
      <div class="intro-bar"><div></div></div>
    </div>`;
  document.getElementById("bottomLeft").innerHTML = `Meedoen: code <b style="color:var(--gold)">${G.code}</b>`;
  setNext("", false, false);
  G.busy = false;
  clearTimeout(G.introTimer);
  G.introTimer = setTimeout(() => startQuestion(i), 3500);
}

async function startQuestion(i) {
  G.busy = true;
  const q = G.qs[i];
  const qkey = `q${i}`;
  const current = { qkey, index: i, total: G.qs.length, type: q.type, text: q.text, options: optionsFor(q), double: !!q.double };
  if (q.unit) current.unit = q.unit;
  await setState(
    { phase: "question", index: i, total: G.qs.length, qkey, startedAt: serverTimestamp(), duration: Number(q.time) || 20 },
    { current },
  );
  // Haal de echte starttijd (servertijd) op
  const st = (await get(ref(db, `games/${G.code}/state`))).val();
  G.state = st;
  G.busy = false;
  showQuestion(false);
}

const RING = 2 * Math.PI * 45;

function showQuestion(resumed) {
  const i = G.state.index;
  const q = G.qs[i];
  const opts = optionsFor(q);
  sfx.questionMusic();
  $main().innerHTML = `
    <div class="q-head"><div class="q-text frame">${esc(q.text)}</div></div>
    <div class="q-mid">
      <div class="timer-ring" id="timerRing">
        <svg viewBox="0 0 100 100"><circle class="track" cx="50" cy="50" r="45" fill="none" stroke-width="8"/>
          <circle class="prog" id="ringProg" cx="50" cy="50" r="45" fill="none" stroke-width="8" stroke-dasharray="${RING}" stroke-dashoffset="0"/></svg>
        <div class="num" id="timer">${G.state.duration}</div>
      </div>
      <div class="q-image">${q.image ? `<img src="${q.image}" alt="">` : `<div class="placeholder">✦</div>`}</div>
      <div class="answered"><b id="ansCount">0</b>antwoorden</div>
    </div>
    ${q.type === "estimate"
      ? `<div class="estimate-box frame enter">Schatvraag: typ je antwoord op je telefoon${q.unit ? ` (in ${esc(q.unit)})` : ""}</div>`
      : `<div class="s-answers">${opts.map((o, k) => `<div class="s-answer opt-${k}"><span class="badge">${shapeSvg(k)}</span><span>${esc(o)}</span><span class="gem-glint">✦</span></div>`).join("")}</div>`}`;
  setNext("Toon antwoord", true);

  if (G.answerUnsub) G.answerUnsub();
  let lastN = 0;
  G.answerUnsub = onValue(ref(db, `games/${G.code}/answers/${G.state.qkey}`), (s) => {
    const n = s.size || Object.keys(s.val() || {}).length;
    const el = document.getElementById("ansCount");
    if (el) {
      el.textContent = n;
      if (n > lastN) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }
    }
    lastN = n;
    const active = Object.keys(G.players).length;
    if (G.state.phase === "question" && active > 0 && n >= active) setTimeout(() => doReveal(), 600);
  });

  clearInterval(G.timerInt);
  let lastShown = null;
  const durMs = G.state.duration * 1000;
  const endAt = G.state.startedAt + durMs;
  const tickFn = () => {
    const leftMs = Math.max(0, endAt - serverNow());
    const left = Math.ceil(leftMs / 1000);
    const prog = document.getElementById("ringProg");
    if (prog) prog.style.strokeDashoffset = String(RING * (1 - leftMs / durMs));
    const el = document.getElementById("timer");
    if (el && left !== lastShown) {
      el.textContent = left;
      document.getElementById("timerRing")?.classList.toggle("low", left <= 5);
      if (left <= 5 && left > 0) { sfx.tick(); sfx.hurry(); }
      lastShown = left;
    }
    if (left <= 0) {
      clearInterval(G.timerInt);
      sfx.stopMusic(); sfx.timeUp();
      setTimeout(() => doReveal(), 800); // marge voor antwoorden die nog onderweg zijn
    }
  };
  tickFn();
  G.timerInt = setInterval(tickFn, 200);
}

async function doReveal() {
  if (G.state.phase !== "question" || G.busy) return;
  G.busy = true;
  clearInterval(G.timerInt);
  if (G.answerUnsub) { G.answerUnsub(); G.answerUnsub = null; }
  sfx.stopMusic();
  const i = G.state.index;
  const q = G.qs[i];
  const qkey = G.state.qkey;
  try {
    const gameSnap = await get(ref(db, `games/${G.code}`));
    const g = gameSnap.val();
    if (g.reveal?.qkey === qkey) {
      G.reveal = g.reveal; // al berekend (bijv. na herladen)
    } else {
      const { scores, reveal } = computeResults(
        q, qkey, g.answers?.[qkey], g.players || {}, g.scores || {}, g.state.startedAt, g.state.duration * 1000,
      );
      const upd = { reveal, "state/phase": "reveal" };
      for (const [uid, s] of Object.entries(scores)) upd[`scores/${uid}`] = s;
      await update(ref(db, `games/${G.code}`), upd);
      G.reveal = reveal;
      G.scores = { ...(g.scores || {}), ...scores };
    }
    G.state.phase = "reveal";
    await update(ref(db, `games/${G.code}/state`), { phase: "reveal" });
  } catch (err) {
    console.error(err);
    alert("Er ging iets mis bij het tonen van het antwoord: " + (err.code || err.message));
  }
  G.busy = false;
  renderReveal();
}

function renderReveal() {
  const i = G.state.index;
  const q = G.qs[i];
  const r = G.reveal || {};
  sfx.pop();
  setTimeout(() => sfx.reveal(), 180);
  const last = i >= G.qs.length - 1;
  setNext(last ? "Naar de uitslag" : "Tussenstand", true);
  if (q.type === "estimate") {
    const closest = r.closest || [];
    $main().innerHTML = `
      <div class="q-head"><div class="q-text frame">${esc(q.text)}</div></div>
      <div class="big-title">
        <div class="kicker">Het goede antwoord</div>
        <div class="estimate-box enter"><div class="val">${fmtNum(q.correct)}${q.unit ? ` <span style="font-size:.5em">${esc(q.unit)}</span>` : ""}</div></div>
        ${closest.length ? `<div class="sub">Het dichtst in de buurt</div>
          <div class="estimate-list">${closest.slice(0, 6).map((c) => `<span class="pill">${esc(c.name)}: ${fmtNum(c.v)}</span>`).join("")}</div>`
          : `<div class="sub">Niemand heeft een schatting gegeven.</div>`}
        <div class="sub">${r.answered || 0} van ${playerCount()} spelers antwoordden</div>
      </div>`;
    setTimeout(() => burstFrom($main().querySelector(".estimate-box"), 60), 150);
    scheduleAuto();
    return;
  }
  const opts = optionsFor(q);
  const counts = r.counts || opts.map(() => 0);
  const max = Math.max(1, ...counts);
  $main().innerHTML = `
    <div class="q-head"><div class="q-text frame" style="animation:none">${esc(q.text)}</div></div>
    <div class="q-mid" style="grid-template-columns:1fr">
      <div class="dist">
        ${opts.map((o, k) => `
          <div class="bar-wrap">
            <div class="num">${counts[k] || 0}</div>
            <div class="bar opt-${k}" style="height:${Math.max(4, ((counts[k] || 0) / max) * 85)}%;animation-delay:${k * 0.1}s;${k === q.correct ? "" : "opacity:.35"}">${shapeSvg(k)}</div>
          </div>`).join("")}
      </div>
    </div>
    <div class="s-answers">
      ${opts.map((o, k) => `<div class="s-answer opt-${k} ${k === q.correct ? "correct" : "dim"}"><span class="badge">${shapeSvg(k)}</span><span>${esc(o)}</span>
        ${k === q.correct ? '<span class="check count">✔</span>' : ""}</div>`).join("")}
    </div>`;
  setTimeout(() => burstFrom($main().querySelector(".s-answer.correct"), 70), 150);
  scheduleAuto();
}

// ---------------- Tussenstand ----------------
async function showLeaderboard() {
  G.busy = true;
  await setState({ phase: "leaderboard" });
  const snap = await get(ref(db, `games/${G.code}/scores`));
  G.scores = snap.val() || {};
  G.busy = false;
  const qkey = G.state.qkey;
  // Stand vóór deze vraag, om stijgers en dalers te tonen
  const before = {};
  for (const [uid, s] of Object.entries(G.scores)) {
    const gained = s.last?.qkey === qkey ? s.last.points : 0;
    before[uid] = { ...s, score: s.score - gained };
  }
  const prevRank = Object.fromEntries(ranking(before).map((r) => [r.uid, r.rank]));
  const top = ranking(G.scores).slice(0, 5);
  // Eerst tonen in de oude volgorde, dan naar de nieuwe plek schuiven
  const startOrder = [...top].sort((x, y) => (prevRank[x.uid] || 99) - (prevRank[y.uid] || 99) || x.rank - y.rank);
  sfx.lobbyMusic();
  $main().innerHTML = `
    <div class="big-title" style="justify-content:center">
      <div class="board frame">
        <div class="center" style="margin-bottom:2vh">
          <div style="font-family:var(--serif);font-size:4.4vh"><span class="foil">Tussenstand</span></div>
          <div class="script" style="font-size:2.6vh;color:var(--muted)">na vraag ${G.state.index + 1} van ${G.qs.length}</div>
        </div>
        <div class="rows" id="rows">
        ${startOrder.map((r, k) => {
          const d = (prevRank[r.uid] || r.rank) - r.rank;
          const move = d > 0 ? `<span class="move up">▲ ${d}</span>` : d < 0 ? `<span class="move down">▼ ${-d}</span>` : '<span class="move"></span>';
          const from = before[r.uid]?.score ?? r.score;
          return `
          <div class="board-row ${d > 0 ? "climber" : ""}" data-uid="${r.uid}" style="animation-delay:${[0, 70, 125, 165, 195][k]}ms">
            <span class="rank">${prevRank[r.uid] || r.rank}</span>${monogram(r.name)}
            <span class="name">${esc(r.name)}</span>
            <span class="leader"></span>
            ${r.streak >= 2 ? `<span class="glasses" title="${r.streak} keer op rij goed">${"🥂".repeat(Math.min(r.streak, 5))}</span>` : ""}
            ${move}
            <span class="pts" data-from="${from}" data-to="${r.score}">${fmtNum(from)}</span>
          </div>`;
        }).join("") || '<p class="muted">Nog geen scores.</p>'}
        </div>
      </div>
    </div>`;
  const rowsEl = document.getElementById("rows");
  const rowEls = [...rowsEl.querySelectorAll(".board-row")];
  const slotTop = rowEls.map((el) => el.offsetTop);
  // Punten tellen op…
  rowEls.forEach((el, k) => {
    const pts = el.querySelector(".pts");
    setTimeout(() => countUp(pts, Number(pts.dataset.from), Number(pts.dataset.to), 1000), 350 + k * 60);
  });
  // …en daarna schuift iedereen naar zijn nieuwe plek
  setTimeout(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let moved = false;
    rowEls.forEach((el, oldIdx) => {
      const newIdx = top.findIndex((r) => r.uid === el.dataset.uid);
      const r = top[newIdx];
      el.querySelector(".rank").textContent = r.rank;
      el.classList.toggle("first", r.rank === 1);
      if (newIdx === oldIdx) return;
      moved = true;
      el.style.transition = reduce ? "none" : "transform 800ms cubic-bezier(0.77, 0, 0.175, 1)";
      el.style.transform = `translateY(${slotTop[newIdx] - slotTop[oldIdx]}px)`;
      if (newIdx < oldIdx) el.style.zIndex = 2;
    });
    if (moved) sfx.whoosh();
  }, 1500);
  setNext("Volgende vraag", true);
  scheduleAuto();
}

// ---------------- Podium ----------------
async function showPodium() {
  G.busy = true;
  await setState({ phase: "podium" });
  const snap = await get(ref(db, `games/${G.code}/scores`));
  G.scores = snap.val() || {};
  const list = ranking(G.scores);
  const [p1, p2, p3] = list;
  const step = (p, cls, n) => `
    <div class="step ${cls}" id="step-${n}">
      ${n === 1 ? `<svg class="crown" id="crown" viewBox="0 0 64 44" aria-hidden="true"><defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2c4"/><stop offset=".5" stop-color="#e2bd6a"/><stop offset="1" stop-color="#9c7a3c"/></linearGradient></defs><path d="M4 38 L8 12 L20 24 L32 4 L44 24 L56 12 L60 38 Z" fill="url(#cg)" stroke="#6b5226" stroke-width="1.2" stroke-linejoin="round"/><rect x="4" y="36" width="56" height="6" rx="1.5" fill="url(#cg)" stroke="#6b5226" stroke-width="1.2"/><circle cx="32" cy="4" r="3" fill="#b4283c"/><circle cx="8" cy="12" r="2.4" fill="#2c5aa8"/><circle cx="56" cy="12" r="2.4" fill="#1f7f56"/></svg>` : ""}
      <div class="av">${p ? monogram(p.name) : ""}</div>
      <div class="who">${p ? esc(p.name) : "–"}</div>
      <div class="pts">${p ? fmtNum(p.score) + " punten" : ""}</div>
      <div class="block">${n}</div>
    </div>`;
  $main().innerHTML = `
    <div class="podium-title enter-soft"><span class="foil">En de winnaars zijn</span></div>
    <div class="podium" id="podium">${step(p2, "p2", 2)}${step(p1, "p1", 1)}${step(p3, "p3", 3)}</div>
    <div class="estimate-list" id="rest" style="opacity:0;transition:opacity .8s">
      ${list.slice(3, 10).map((r) => `<span class="pill">${r.rank}. ${esc(r.name)}, ${fmtNum(r.score)}</span>`).join("")}
    </div>`;
  setNext("", false, false);
  sfx.stopMusic();
  const show = (n) => document.getElementById(`step-${n}`)?.classList.add("show");
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  sfx.drumroll(2.2); await wait(2300); show(3); sfx.reveal();
  await wait(1500);
  sfx.drumroll(2.2); await wait(2300); show(2); sfx.reveal();
  await wait(1500);
  sfx.drumroll(3.2); await wait(3300);
  document.getElementById("podium")?.classList.add("lit");
  show(1); sfx.pop(); setTimeout(() => sfx.fanfare(), 250); confetti(220);
  setTimeout(() => document.getElementById("crown")?.classList.add("on"), 500);
  setTimeout(() => burstFrom(document.querySelector("#step-1 .block"), 120), 200);
  setTimeout(() => bubbleBurst(innerWidth * 0.2, innerHeight, 60, 200), 900);
  setTimeout(() => bubbleBurst(innerWidth * 0.8, innerHeight, 60, 200), 1200);
  setTimeout(() => confetti(160), 1200);
  setTimeout(() => confetti(160), 2600);
  const rest = document.getElementById("rest");
  if (rest) rest.style.opacity = 1;
  G.busy = false;
  setNext("Quiz afsluiten", true);
}

async function finishGame() {
  if (!confirm("Quiz afsluiten? Spelers zien dan hun eindstand.")) return;
  await setState({ phase: "ended" });
  try { localStorage.removeItem(ACTIVE); } catch { /* */ }
  leaveStage();
}

// ==================================================================
// Start
// ==================================================================
if (!configured) {
  showSetupNeeded();
} else {
  onAuthStateChanged(auth, (u) => {
    if (u && !u.isAnonymous) { user = u; showDashboard(); }
    else { user = null; cleanupStage(); stopDash(); showLogin(); }
  });
}
