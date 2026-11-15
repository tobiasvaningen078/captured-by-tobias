// Gedeelde hulpfuncties: vormen, sneeuw, confetti, puntentelling.

export const SHAPE_NAMES = ["Ster", "Sneeuwvlok", "Bel", "Kerstboom"];

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

export const TYPE_LABELS = { mc: "Meerkeuze", tf: "Waar / niet waar", estimate: "Schatvraag" };

/** Antwoordopties zoals spelers ze zien. */
export function optionsFor(q) {
  if (q.type === "tf") return ["Waar", "Niet waar"];
  if (q.type === "mc") return (q.options || []).map((o) => o || "");
  return [];
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
 * @param q        de vraag (met correct antwoord)
 * @param qkey     sleutel van de vraag in dit spel, bijv. "q3"
 * @param answers  { uid: { v, t } }
 * @param players  { uid: { name } }
 * @param prev     { uid: { score, streak } }
 * @param startedAt servertijd waarop de vraag begon (ms)
 * @param durationMs duur van de vraag
 */
export function computeResults(q, qkey, answers, players, prev, startedAt, durationMs) {
  answers = answers || {};
  prev = prev || {};
  const mult = q.double ? 2 : 1;
  const scores = {};
  const reveal = { qkey, type: q.type, answered: 0 };

  let estimate = null;
  if (q.type === "estimate") {
    const target = Number(q.correct);
    const errs = {};
    let minErr = Infinity;
    for (const [uid, a] of Object.entries(answers)) {
      if (!players[uid] || typeof a.v !== "number" || !isFinite(a.v)) continue;
      errs[uid] = Math.abs(a.v - target);
      minErr = Math.min(minErr, errs[uid]);
    }
    estimate = { target, errs, minErr };
    const closest = Object.keys(errs).filter((u) => errs[u] === minErr);
    reveal.correct = target;
    reveal.closest = closest.map((u) => ({ name: players[u].name, v: answers[u].v }));
  } else {
    const n = q.type === "tf" ? 2 : 4;
    reveal.correct = Number(q.correct);
    reveal.counts = Array(n).fill(0);
    for (const [uid, a] of Object.entries(answers)) {
      if (players[uid] && a.v >= 0 && a.v < n) reveal.counts[a.v]++;
    }
  }

  for (const [uid, p] of Object.entries(players)) {
    const a = answers[uid];
    const before = prev[uid] || { score: 0, streak: 0 };
    let correct = false;
    let base = 0;
    if (a) reveal.answered++;
    if (a && q.type === "estimate") {
      const err = estimate.errs[uid];
      if (err !== undefined) {
        const rel = err / Math.max(Math.abs(estimate.target), 1);
        if (err === estimate.minErr) { correct = true; base = MAX_POINTS; }
        else { base = Math.round(800 * Math.max(0, 1 - rel)); correct = rel <= 0.1; }
      }
    } else if (a) {
      correct = a.v === Number(q.correct);
      if (correct) base = speedPoints((a.t || startedAt) - startedAt, durationMs);
    }
    const streak = correct ? (before.streak || 0) + 1 : 0;
    const bonus = correct ? streakBonus(streak) : 0;
    const points = base * mult + bonus;
    scores[uid] = {
      name: p.name,
      score: (before.score || 0) + points,
      streak,
      last: { qkey, points, bonus, correct, answered: !!a },
    };
  }
  return { scores, reveal };
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
export function startSnow(density = 1) {
  const c = document.getElementById("snow");
  if (!c || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const ctx = c.getContext("2d");
  let w, h, flakes = [];
  const resize = () => {
    w = c.width = innerWidth; h = c.height = innerHeight;
    const n = Math.round((w * h) / 14000 * density);
    flakes = Array.from({ length: n }, () => newFlake(true));
  };
  const newFlake = (anywhere) => ({
    x: Math.random() * w, y: anywhere ? Math.random() * h : -10,
    r: Math.random() * 2.6 + 0.8, s: Math.random() * 0.6 + 0.3, d: Math.random() * Math.PI * 2,
  });
  addEventListener("resize", resize);
  resize();
  const tick = () => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,.75)";
    for (const f of flakes) {
      f.d += 0.01; f.y += f.s; f.x += Math.sin(f.d) * 0.4;
      if (f.y > h + 5) Object.assign(f, newFlake(false));
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
    }
    requestAnimationFrame(tick);
  };
  tick();
}

// ------------------------------------------------------------------
// Confetti
// ------------------------------------------------------------------
let confettiParts = [];
let confettiRunning = false;
export function confetti(amount = 160) {
  const c = document.getElementById("confetti");
  if (!c) return;
  const ctx = c.getContext("2d");
  c.width = innerWidth; c.height = innerHeight;
  const colors = ["#f2c14e", "#c62839", "#2fb365", "#ffffff", "#2a6fb5"];
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
