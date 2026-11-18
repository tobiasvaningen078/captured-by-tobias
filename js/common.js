// Gedeelde hulpfuncties: vormen, sneeuw, confetti, puntentelling.

export const SHAPE_NAMES = ["Ster", "Sneeuwvlok", "Bel", "Kerstboom"];

export const AVATARS = ["🎅", "🤶", "🦌", "⛄", "🧝", "🐧", "🎁", "🍪", "⭐", "🔔", "🎄", "🐻‍❄️"];

/** Avatar van een speler; valt terug op een vaste keuze op basis van het id. */
export function avatarOf(p, uid = "") {
  if (p && AVATARS.includes(p.avatar)) return p.avatar;
  let h = 0;
  for (const ch of String(uid)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATARS[h % AVATARS.length];
}

/** Initialen voor een monogram, bijv. "Sanne de Vries" → "SV". */
export function initials(name) {
  const parts = String(name || "?").trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : (parts[0]?.[1] || "");
  return (first + last).toUpperCase();
}
export function monogram(name) {
  return `<span class="monogram" aria-hidden="true">${esc(initials(name))}</span>`;
}

/** Vroeger een slinger lampjes; in de galastijl bewust leeg. */
export function lightsHtml() { return ""; }

/** Laat een getal in een element oplopen. */
export function countUp(el, from, to, ms = 900) {
  if (!el) return;
  const t0 = performance.now();
  const step = (t) => {
    const f = Math.min(1, (t - t0) / ms);
    const e = 1 - Math.pow(1 - f, 3);
    el.textContent = Math.round(from + (to - from) * e).toLocaleString("nl-NL");
    if (f < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

const SHAPES = [
  // ster
  '<polygon fill="currentColor" points="12,1.8 14.9,8.5 22.2,9.2 16.7,14.1 18.3,21.3 12,17.6 5.7,21.3 7.3,14.1 1.8,9.2 9.1,8.5"/>',
  // sneeuwvlok
  '<g stroke="currentColor" stroke-width="2.3" stroke-linecap="round" fill="none"><path d="M12 2v20M3.3 7l17.4 10M3.3 17l17.4-10"/><path d="M9.5 3.5 12 6l2.5-2.5M9.5 20.5 12 18l2.5 2.5M3.6 10.4l3.3-.9-.9-3.3M20.4 13.6l-3.3.9.9 3.3M3.6 13.6l3.3.9-.9 3.3M20.4 10.4l-3.3-.9.9-3.3"/></g>',
  // bel
  '<path fill="currentColor" d="M12 2a1.8 1.8 0 0 1 1.8 1.8v.5A7 7 0 0 1 19 11v4.6l2.2 2.4v1.2H2.8V18L5 15.6V11a7 7 0 0 1 5.2-6.7v-.5A1.8 1.8 0 0 1 12 2Zm-2.6 18.2h5.2a2.6 2.6 0 0 1-5.2 0Z"/>',
  // kerstboom
  '<path fill="currentColor" d="M12 1.5 18 9h-3l5 6.5h-4.5L20 21H4l4.5-5.5H4L9 9H6Z"/><rect x="10.3" y="20" width="3.4" height="3" fill="currentColor"/>',
];

export function shapeSvg(i, cls = "shape") {
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${SHAPES[i % 4]}</svg>`;
}

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export const fmtNum = (n) => Number(n).toLocaleString("nl-NL", { maximumFractionDigits: 2 });

export const TYPE_LABELS = {
  mc: "Meerkeuze", tf: "Waar / niet waar", estimate: "Schatvraag", closest: "Dichtstbij-vraag", pin: "Prik-vraag",
};
export const DEFAULT_TIME = { mc: 20, tf: 15, estimate: 30, closest: 30, pin: 30 };

/** Antwoordopties zoals spelers ze zien (bij dichtstbij: alleen de namen, nooit de waarden). */
export function optionsFor(q) {
  if (q.type === "tf") return ["Waar", "Niet waar"];
  if (q.type === "mc") return (q.options || []).map((o) => o || "");
  // Op de telefoon staan alleen de namen in q.options; bij de quizmaster de volledige items
  if (q.type === "closest") return q.items ? q.items.map((it) => it.label || "") : (q.options || []);
  return [];
}

/** Getal uit Nederlandse of internationale schrijfwijze: "48.000.000", "1,5", "1.5", "2 500". */
export function parseNumberNL(input) {
  if (typeof input === "number") return input;
  let s = String(input ?? "").trim().replace(/[\s_']/g, "").replace(/[^\d.,\-eE+]/g, "");
  if (!s) return NaN;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  return Number(s);
}

// Prik-vraag: x en y (0..1) worden in één getal opgeslagen, zodat de databaseregels niet hoeven te veranderen.
export const encodePin = (x, y) => Math.round(Math.min(1, Math.max(0, x)) * 10000) * 10001 + Math.round(Math.min(1, Math.max(0, y)) * 10000);
export const decodePin = (v) => ({ x: Math.floor(v / 10001) / 10000, y: (v % 10001) / 10000 });

/** Afstand tussen twee punten op een afbeelding, als fractie van de diagonaal (0 = raak, 1 = hoek tot hoek). */
export function pinDistance(a, b, aspect = 1.5) {
  return Math.hypot((a.x - b.x) * aspect, a.y - b.y) / Math.hypot(aspect, 1);
}

// ------------------------------------------------------------------
// Puntentelling (Kahoot-stijl)
// ------------------------------------------------------------------
export const MAX_POINTS = 1000;
export const STREAK_STEP = 100;
export const STREAK_MAX = 500;

/** Punten voor een goed antwoord: 1000 bij direct antwoorden, 500 bij de laatste milliseconde. */
export function speedPoints(ms, durationMs) {
  const f = Math.min(Math.max(ms / durationMs, 0), 1);
  return Math.round(MAX_POINTS * (1 - f / 2));
}

export function streakBonus(streak) {
  return streak >= 2 ? Math.min((streak - 1) * STREAK_STEP, STREAK_MAX) : 0;
}

/**
 * Bereken de nieuwe scores en de onthulling voor één vraag.
 * Per soort: meerkeuze/waar-niet-waar → goed + snelheid; schatting, dichtstbij en prik → hoe dichter, hoe meer.
 */
export function computeResults(q, qkey, answers, players, prev, startedAt, durationMs) {
  answers = answers || {};
  prev = prev || {};
  const mult = q.double ? 2 : 1;
  const scores = {};
  const reveal = { qkey, type: q.type, answered: 0 };
  const result = {}; // uid → { base, correct }
  const valid = Object.entries(answers).filter(([uid, a]) => players[uid] && typeof a.v === "number" && isFinite(a.v));

  if (q.type === "estimate") {
    const target = Number(q.correct);
    const errs = Object.fromEntries(valid.map(([uid, a]) => [uid, Math.abs(a.v - target)]));
    const minErr = Math.min(Infinity, ...Object.values(errs));
    for (const [uid, err] of Object.entries(errs)) {
      const rel = err / Math.max(Math.abs(target), 1);
      if (err === minErr) result[uid] = { base: MAX_POINTS, correct: true };
      else result[uid] = { base: Math.round(800 * Math.max(0, 1 - rel)), correct: rel <= 0.1 };
    }
    reveal.correct = target;
    reveal.closest = Object.keys(errs).filter((u) => errs[u] === minErr).map((u) => ({ name: players[u].name, v: answers[u].v }));
    reveal.guesses = valid.slice(0, 80).map(([uid, a]) => ({ name: players[uid].name, v: a.v, best: errs[uid] === minErr }));
  } else if (q.type === "closest") {
    const items = q.items || [];
    const target = Number(q.target);
    const errs = items.map((it) => Math.abs(Number(it.value) - target));
    const best = Math.min(...errs), worst = Math.max(...errs);
    const counts = items.map(() => 0);
    for (const [uid, a] of valid) {
      const i = Math.round(a.v);
      if (i < 0 || i >= items.length) continue;
      counts[i]++;
      const f = worst === best ? 0 : (errs[i] - best) / (worst - best);
      result[uid] = { base: Math.round(MAX_POINTS * Math.pow(1 - f, 1.6)), correct: errs[i] === best, pick: i };
    }
    reveal.target = target;
    reveal.ranked = items
      .map((it, i) => ({ label: it.label, value: Number(it.value), count: counts[i], best: errs[i] === best, err: errs[i] }))
      .sort((x, y) => x.err - y.err);
  } else if (q.type === "pin") {
    const point = q.point || { x: 0.5, y: 0.5 };
    const aspect = Number(q.aspect) || 1.5;
    const pins = [];
    for (const [uid, a] of valid) {
      const p = decodePin(a.v);
      const d = pinDistance(p, point, aspect);
      pins.push({ uid, name: players[uid].name, x: p.x, y: p.y, d });
    }
    const minD = Math.min(Infinity, ...pins.map((p) => p.d));
    for (const p of pins) {
      result[p.uid] = { base: Math.round(MAX_POINTS * Math.max(0, 1 - p.d / 0.35)), correct: p.d <= 0.04 || (p.d === minD && p.d <= 0.12) };
    }
    reveal.point = point;
    reveal.pins = pins.slice(0, 80).map(({ name, x, y, d }) => ({ name, x, y, best: d === minD }));
    reveal.closest = pins.filter((p) => p.d === minD).map((p) => ({ name: p.name }));
  } else {
    const n = q.type === "tf" ? 2 : 4;
    reveal.correct = Number(q.correct);
    reveal.counts = Array(n).fill(0);
    for (const [uid, a] of valid) {
      if (a.v >= 0 && a.v < n) reveal.counts[a.v]++;
      const correct = a.v === Number(q.correct);
      result[uid] = { base: correct ? speedPoints((a.t || startedAt) - startedAt, durationMs) : 0, correct };
    }
  }

  for (const [uid, p] of Object.entries(players)) {
    const a = answers[uid];
    const before = prev[uid] || { score: 0, streak: 0 };
    if (a) reveal.answered++;
    const { base = 0, correct = false } = result[uid] || {};
    const streak = correct ? (before.streak || 0) + 1 : 0;
    const bonus = correct ? streakBonus(streak) : 0;
    const points = base * mult + bonus;
    scores[uid] = {
      name: p.name,
      avatar: avatarOf(p, uid),
      score: (before.score || 0) + points,
      streak,
      last: { qkey, points, bonus, correct, answered: !!a },
    };
  }
  return { scores, reveal };
}

// ------------------------------------------------------------------
// Vragen plakken (uit de chat)
// ------------------------------------------------------------------
export const IMPORT_PROMPT = `Maak quizvragen voor de kerstquiz van ons werk. Geef ze terug als één JSON-lijst, zonder uitleg eromheen, precies in dit formaat:

[
  { "soort": "meerkeuze", "vraag": "Welk land schenkt Londen elk jaar een kerstboom?", "opties": ["Zweden", "Noorwegen", "Denemarken", "Finland"], "goed": 2 },
  { "soort": "waar-niet-waar", "vraag": "De Kerstman is deels gebaseerd op Sint-Nicolaas.", "goed": true },
  { "soort": "schatting", "vraag": "Hoeveel cadeaus krijg je in totaal in 'The Twelve Days of Christmas'?", "antwoord": 364, "eenheid": "cadeaus" },
  { "soort": "dichtstbij", "vraag": "Kies een land met ongeveer 50 miljoen inwoners", "doel": 50000000, "eenheid": "inwoners",
    "items": [ { "naam": "Spanje", "waarde": 48600000 }, { "naam": "Italië", "waarde": 58900000 }, { "naam": "Polen", "waarde": 36700000 } ] }
]

Regels:
- "soort" is "meerkeuze", "waar-niet-waar", "schatting" of "dichtstbij".
- Meerkeuze: 2 tot 4 opties; "goed" is het nummer van het goede antwoord (1 = eerste optie).
- Waar-niet-waar: "goed" is true of false.
- Schatting: "antwoord" is een getal (geen punten of komma's als duizendtal), "eenheid" mag leeg.
- Dichtstbij: spelers kiezen uit "items" het ding waarvan de waarde het dichtst bij "doel" ligt. Geef 8 tot 20 items met echte, gecontroleerde waarden.
- Optioneel per vraag: "tijd" in seconden (10–90) en "dubbel": true voor dubbele punten.
- Controleer alle feiten zorgvuldig.

Onderwerp en wensen: `;

const pick = (o, ...keys) => { for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== "") return o[k]; return undefined; };

/** Lees geplakte JSON (of een lijst in een codeblok) in. Geeft {questions, errors}. */
export function parseImport(text) {
  const errors = [];
  let raw = String(text || "").replace(/```(json)?/gi, "").trim();
  const start = raw.indexOf("["), end = raw.lastIndexOf("]");
  let data;
  try {
    if (start >= 0 && end > start) raw = raw.slice(start, end + 1);
    data = JSON.parse(raw);
  } catch (e) {
    return { questions: [], errors: ["Dit is geen geldige lijst. Kopieer het antwoord van de chat precies zoals het is (het begint met [ en eindigt met ])."] };
  }
  if (!Array.isArray(data)) data = data.vragen || data.questions || [data];
  const questions = [];
  data.forEach((o, n) => {
    const nr = `Vraag ${n + 1}`;
    if (!o || typeof o !== "object") { errors.push(`${nr}: onleesbaar`); return; }
    const soort = String(pick(o, "soort", "type", "kind") || "").toLowerCase();
    const type = /meer|mc|multiple|keuze/.test(soort) ? "mc"
      : /waar|tf|true|false|boolean/.test(soort) ? "tf"
      : /dichtst|closest|plain|nearest/.test(soort) ? "closest"
      : /schat|estimate|getal|number/.test(soort) ? "estimate" : null;
    const text = String(pick(o, "vraag", "question", "text") || "").trim().slice(0, 200);
    if (!type) { errors.push(`${nr}: onbekende soort "${soort}"`); return; }
    if (!text) { errors.push(`${nr}: de vraag ontbreekt`); return; }
    const t = Number(pick(o, "tijd", "time", "seconden"));
    const q = { type, text, time: [10, 15, 20, 30, 45, 60, 90].includes(t) ? t : DEFAULT_TIME[type], double: !!pick(o, "dubbel", "double") };
    if (type === "mc") {
      const opts = (pick(o, "opties", "options", "antwoorden") || []).map((x) => String(x).trim()).filter(Boolean).slice(0, 4);
      if (opts.length < 2) { errors.push(`${nr}: minimaal 2 opties nodig`); return; }
      const g = pick(o, "goed", "correct", "answer", "antwoord");
      let ci = typeof g === "number" ? g - 1 : opts.findIndex((x) => x.toLowerCase() === String(g ?? "").trim().toLowerCase());
      if (ci < 0 && /^\d+$/.test(String(g ?? ""))) ci = Number(g) - 1;
      if (!(ci >= 0 && ci < opts.length)) { errors.push(`${nr}: het goede antwoord is onduidelijk`); return; }
      Object.assign(q, { options: opts, correct: ci });
    } else if (type === "tf") {
      const g = pick(o, "goed", "correct", "answer", "antwoord");
      const s = String(g).toLowerCase();
      const isTrue = g === true || g === 1 || /^(waar|true|ja|juist|goed)$/.test(s);
      const isFalse = g === false || g === 0 || /^(niet waar|onwaar|false|nee|fout)$/.test(s);
      if (!isTrue && !isFalse) { errors.push(`${nr}: zeg met true of false of het waar is`); return; }
      q.correct = isTrue ? 0 : 1;
    } else if (type === "estimate") {
      const v = parseNumberNL(pick(o, "antwoord", "answer", "goed", "correct"));
      if (!isFinite(v)) { errors.push(`${nr}: het antwoord is geen getal`); return; }
      q.correct = v;
      const u = pick(o, "eenheid", "unit"); if (u) q.unit = String(u).slice(0, 20);
    } else if (type === "closest") {
      const target = parseNumberNL(pick(o, "doel", "target"));
      let items = pick(o, "items", "keuzes", "opties", "options") || [];
      if (!Array.isArray(items) && typeof items === "object") items = Object.entries(items).map(([naam, waarde]) => ({ naam, waarde }));
      items = items.map((it) => {
        if (typeof it === "string") { const m = it.split(/[=:]/); return { label: m[0].trim(), value: parseNumberNL(m.slice(1).join(":")) }; }
        return { label: String(pick(it, "naam", "name", "label") || "").trim(), value: parseNumberNL(pick(it, "waarde", "value")) };
      }).filter((it) => it.label && isFinite(it.value)).slice(0, 40);
      if (!isFinite(target)) { errors.push(`${nr}: het doel is geen getal`); return; }
      if (items.length < 2) { errors.push(`${nr}: minimaal 2 items met een waarde nodig`); return; }
      Object.assign(q, { target, items });
      const u = pick(o, "eenheid", "unit"); if (u) q.unit = String(u).slice(0, 20);
    }
    questions.push(q);
  });
  return { questions, errors };
}

/** Sorteer scores van hoog naar laag: [{uid, name, score, streak, rank}] */
export function ranking(scores) {
  const list = Object.entries(scores || {}).map(([uid, s]) => ({ uid, ...s }));
  list.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  let rank = 0, lastScore = null;
  list.forEach((r, i) => { if (r.score !== lastScore) { rank = i + 1; lastScore = r.score; } r.rank = rank; });
  return list;
}

// ------------------------------------------------------------------
// Sneeuw
// ------------------------------------------------------------------
// Goudstof + opstijgende champagnebubbels, plus bruisende uitbarstingen op afroep.
let burstQueue = [];
export function bubbleBurst(x, y, n = 40, spread = 60) {
  for (let i = 0; i < n; i++) {
    burstQueue.push({
      x: x + (Math.random() - 0.5) * spread, y: y + (Math.random() - 0.5) * spread * 0.4,
      r: Math.random() * 4 + 1.5, vy: -(Math.random() * 2.6 + 1.4), vx: (Math.random() - 0.5) * 1.2,
      phase: Math.random() * 6, life: 0, max: 90 + Math.random() * 70,
    });
  }
}
/** Bubbels vanuit het midden van een element. */
export function burstFrom(el, n = 40) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  bubbleBurst(r.left + r.width / 2, r.top + r.height * 0.7, n, r.width * 0.8);
}

export function startSnow(density = 1) {
  const c = document.getElementById("snow");
  if (!c || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const ctx = c.getContext("2d");
  const dpr = Math.min(devicePixelRatio || 1, 2);
  let w, h, dust = [], bubbles = [];
  const newBubble = (anywhere) => ({
    x: Math.random() * w, y: anywhere ? Math.random() * h : h + 10,
    r: Math.random() * 3.2 + 1.2, vy: -(Math.random() * 0.5 + 0.25), phase: Math.random() * 6, wob: Math.random() * 0.6 + 0.2,
  });
  const resize = () => {
    w = innerWidth; h = innerHeight;
    c.width = w * dpr; c.height = h * dpr; c.style.width = w + "px"; c.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round((w * h) / 26000 * density);
    dust = Array.from({ length: n }, () => ({
      x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.3 + 0.3,
      vy: Math.random() * 0.12 + 0.03, phase: Math.random() * Math.PI * 2, speed: Math.random() * 0.02 + 0.006,
      star: Math.random() < 0.12,
    }));
    bubbles = Array.from({ length: Math.round(n * 0.45) }, () => newBubble(true));
  };
  const drawBubble = (x, y, r, a) => {
    ctx.strokeStyle = `rgba(241, 221, 170, ${(0.55 * a).toFixed(3)})`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = `rgba(255, 248, 225, ${(0.7 * a).toFixed(3)})`;
    ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, Math.max(0.6, r * 0.28), 0, Math.PI * 2); ctx.fill();
  };
  addEventListener("resize", resize);
  resize();
  const tick = () => {
    ctx.clearRect(0, 0, w, h);
    for (const d of dust) {
      d.phase += d.speed; d.y += d.vy;
      if (d.y > h + 4) { d.y = -4; d.x = Math.random() * w; }
      const a = 0.15 + 0.55 * (0.5 + 0.5 * Math.sin(d.phase));
      ctx.fillStyle = `rgba(241, 221, 170, ${a.toFixed(3)})`;
      if (d.star) {
        const s = d.r * 3 * a;
        ctx.fillRect(d.x - s, d.y - 0.4, s * 2, 0.8);
        ctx.fillRect(d.x - 0.4, d.y - s, 0.8, s * 2);
      } else {
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill();
      }
    }
    for (const b of bubbles) {
      b.phase += 0.03; b.y += b.vy; b.x += Math.sin(b.phase) * b.wob * 0.3;
      if (b.y < -10) Object.assign(b, newBubble(false));
      const fade = Math.min(1, b.y / (h * 0.5));
      drawBubble(b.x, b.y, b.r, 0.25 + 0.5 * fade);
    }
    burstQueue = burstQueue.filter((p) => p.life < p.max);
    for (const p of burstQueue) {
      p.life++; p.phase += 0.15; p.y += p.vy; p.vy *= 0.995; p.x += p.vx + Math.sin(p.phase) * 0.6; p.vx *= 0.97;
      drawBubble(p.x, p.y, p.r, 1 - p.life / p.max);
    }
    requestAnimationFrame(tick);
  };
  tick();
}

/** Gouden vonkjes vanaf een aantikpunt (telefoon). */
export function sparkleAt(x, y, n = 10) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  for (let i = 0; i < n; i++) {
    const s = document.createElement("span");
    s.className = "spark"; s.textContent = "✦";
    s.style.left = x + "px"; s.style.top = y + "px";
    document.body.appendChild(s);
    const ang = (i / n) * Math.PI * 2 + Math.random() * 0.5;
    const dist = 40 + Math.random() * 50;
    s.animate([
      { transform: "translate(-50%, -50%) scale(.6)", opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(ang) * dist}px), calc(-50% + ${Math.sin(ang) * dist}px)) scale(1) rotate(90deg)`, opacity: 0 },
    ], { duration: 520 + Math.random() * 200, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }).onfinish = () => s.remove();
  }
}

/** Het champagneglas (SVG). state: "empty" | "filling" | "full" | "tipped" */
export function glassSvg(state = "filling") {
  return `<svg class="glass ${state}" viewBox="0 0 100 120" aria-hidden="true">
    <defs>
      <clipPath id="bowl"><path d="M10 22 H90 C88 47 71 61 50 61 C29 61 12 47 10 22 Z"/></clipPath>
      <linearGradient id="fizz" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6e4b0"/><stop offset="1" stop-color="#c99a3e"/></linearGradient>
    </defs>
    <g clip-path="url(#bowl)">
      <rect class="liquid" x="0" y="22" width="100" height="42" fill="url(#fizz)"/>
      <circle class="b b1" cx="34" cy="58" r="2"/><circle class="b b2" cx="52" cy="60" r="1.6"/>
      <circle class="b b3" cx="66" cy="57" r="2.2"/><circle class="b b4" cx="44" cy="59" r="1.3"/>
    </g>
    <path d="M10 22 H90 C88 47 71 61 50 61 C29 61 12 47 10 22 Z" fill="none" stroke="#f1ddaa" stroke-width="2"/>
    <path d="M50 61 V100" stroke="#f1ddaa" stroke-width="2.4"/>
    <ellipse cx="50" cy="103" rx="20" ry="4.5" fill="none" stroke="#f1ddaa" stroke-width="2"/>
  </svg>`;
}

// ------------------------------------------------------------------
// Confetti
// ------------------------------------------------------------------
let confettiParts = [];
let confettiRunning = false;
export function confetti(amount = 160) {
  const c = document.getElementById("confetti");
  if (!c || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const ctx = c.getContext("2d");
  c.width = innerWidth; c.height = innerHeight;
  const colors = ["#f1ddaa", "#d4af6a", "#b48a3e", "#fbf6ea", "#e9cf8f"];
  for (let i = 0; i < amount; i++) {
    const fromLeft = i % 2 === 0;
    confettiParts.push({
      x: fromLeft ? 0 : c.width, y: c.height * 0.7,
      vx: (fromLeft ? 1 : -1) * (Math.random() * 9 + 4), vy: -(Math.random() * 14 + 8),
      w: Math.random() * 8 + 5, h: Math.random() * 5 + 3, rot: Math.random() * 6, vr: Math.random() * 0.3 - 0.15,
      color: colors[i % colors.length], life: 0,
    });
  }
  if (confettiRunning) return;
  confettiRunning = true;
  const tick = () => {
    ctx.clearRect(0, 0, c.width, c.height);
    confettiParts = confettiParts.filter((p) => p.y < c.height + 20 && p.life < 400);
    for (const p of confettiParts) {
      p.life++; p.vy += 0.32; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
    }
    if (confettiParts.length) requestAnimationFrame(tick);
    else { confettiRunning = false; ctx.clearRect(0, 0, c.width, c.height); }
  };
  tick();
}

// ------------------------------------------------------------------
// Afbeelding verkleinen naar data-URL (zodat hij in de database past)
// ------------------------------------------------------------------
export function resizeImage(file, maxSize = 1280, type = "image/jpeg", quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.width * scale);
      cv.height = Math.round(img.height * scale);
      const ctx = cv.getContext("2d");
      if (type === "image/jpeg") { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height); }
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      resolve(cv.toDataURL(type, quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Kon de afbeelding niet lezen")); };
    img.src = url;
  });
}
