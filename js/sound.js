// Geluid en muziek, volledig in de browser gemaakt (Web Audio). Geen bestanden nodig.

let ctx = null;
let master = null;
let muted = false;
try { muted = localStorage.getItem("kq-muted") === "1"; } catch { /* privémodus */ }

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.8;
    master.connect(ctx.destination);
  }
  return ctx;
}

/** Aanroepen bij een klik: browsers staan geluid pas toe na een handeling. */
export function unlock() { const c = ac(); if (c && c.state === "suspended") c.resume(); }
export const isMuted = () => muted;
export function setMuted(m) {
  muted = m;
  try { localStorage.setItem("kq-muted", m ? "1" : "0"); } catch { /* */ }
  if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.05);
}

const NOTE = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
function hz(n) { // "E5", "F#4"
  const m = /^([A-G])(#?)(\d)$/.exec(n);
  const semi = NOTE[m[1]] + (m[2] ? 1 : 0) + (Number(m[3]) - 4) * 12;
  return 440 * Math.pow(2, semi / 12);
}

function tone(freq, t, dur, { type = "sine", gain = 0.2, attack = 0.005, partials = null } = {}) {
  const c = ac(); if (!c) return;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(master);
  for (const [mul, amp] of partials || [[1, 1]]) {
    const o = c.createOscillator();
    const og = c.createGain();
    o.type = type; o.frequency.value = freq * mul; og.gain.value = amp;
    o.connect(og); og.connect(g);
    o.start(t); o.stop(t + dur + 0.05);
  }
}
const bell = (f, t, d = 1.2, gain = 0.16) => tone(f, t, d, { gain, partials: [[1, 1], [2.01, 0.35], [3.98, 0.12]] });
const bass = (f, t, d = 0.4, gain = 0.18) => tone(f, t, d, { type: "triangle", gain });

function noise(t, dur, gain = 0.15, hp = 4000) {
  const c = ac(); if (!c) return;
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = "highpass"; f.frequency.value = hp;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(master); src.start(t);
}

// ------------------------------------------------------------------
// Herhalende muziek
// ------------------------------------------------------------------
let loopTimer = null;
function playLoop(events, lengthBeats, bpmFn) {
  stopMusic();
  const c = ac(); if (!c) return;
  let beatPos = 0; // positie in beats binnen de loop
  let nextTime = c.currentTime + 0.1;
  let idx = 0;
  const sorted = [...events].sort((a, b) => a.at - b.at);
  loopTimer = setInterval(() => {
    const spb = 60 / bpmFn();
    while (nextTime < c.currentTime + 0.25) {
      const ev = sorted[idx];
      ev.play(nextTime, spb);
      const nextEv = sorted[idx + 1];
      const gap = nextEv ? nextEv.at - ev.at : lengthBeats - ev.at + sorted[0].at;
      idx = nextEv ? idx + 1 : 0;
      beatPos = (beatPos + gap) % lengthBeats;
      nextTime += gap * spb;
    }
  }, 40);
}
export function stopMusic() { if (loopTimer) clearInterval(loopTimer); loopTimer = null; }

// Jingle Bells (traditioneel, publiek domein) als belletjesmelodie
const JINGLE = [
  ["E5", .5], ["E5", .5], ["E5", 1], ["E5", .5], ["E5", .5], ["E5", 1], ["E5", .5], ["G5", .5], ["C5", .75], ["D5", .25], ["E5", 2],
  ["F5", .5], ["F5", .5], ["F5", .75], ["F5", .25], ["F5", .5], ["E5", .5], ["E5", .5], ["E5", .25], ["E5", .25],
  ["E5", .5], ["D5", .5], ["D5", .5], ["E5", .5], ["D5", 1], ["G5", 1],
  ["E5", .5], ["E5", .5], ["E5", 1], ["E5", .5], ["E5", .5], ["E5", 1], ["E5", .5], ["G5", .5], ["C5", .75], ["D5", .25], ["E5", 2],
  ["F5", .5], ["F5", .5], ["F5", .5], ["F5", .5], ["F5", .5], ["E5", .5], ["E5", .5], ["E5", .25], ["E5", .25],
  ["G5", .5], ["G5", .5], ["F5", .5], ["D5", .5], ["C5", 2], [null, 2],
];
const JINGLE_BASS = ["C3", "C3", "C3", "C3", "F2", "C3", "G2", "G2", "C3", "C3", "C3", "C3", "F2", "C3", "G2", "C3", "C3"];

export function lobbyMusic() {
  const ev = [];
  let at = 0;
  for (const [n, b] of JINGLE) { if (n) { const f = hz(n); ev.push({ at, play: (t) => bell(f, t, 0.9, 0.12) }); } at += b; }
  const len = at;
  JINGLE_BASS.forEach((n, i) => { const f = hz(n); if (i * 2 < len) ev.push({ at: i * 2 + 0.001, play: (t, spb) => bass(f, t, spb * 1.6, 0.12) }); });
  playLoop(ev, len, () => 132);
}

let questionTempo = 118;
export function questionMusic() {
  questionTempo = 118;
  const line = ["A2", "A2", "C3", "A2", "E3", "A2", "D3", "C3", "F2", "F2", "A2", "F2", "G2", "G2", "B2", "G2"];
  const ev = line.map((n, i) => ({ at: i / 2, play: (t, spb) => bass(hz(n), t, spb * 0.45, 0.14) }));
  for (let i = 0; i < 16; i++) ev.push({ at: i / 2 + 0.25, play: (t) => noise(t, 0.04, 0.05, 7000) });
  [0, 2, 4, 6].forEach((b) => ev.push({ at: b + 0.0001, play: (t) => bell(hz(["E5", "C5", "A4", "B4"][b / 2]), t, 0.5, 0.05) }));
  playLoop(ev, 8, () => questionTempo);
}
export function hurry() { questionTempo = 150; }

// ------------------------------------------------------------------
// Losse effecten
// ------------------------------------------------------------------
export function tick() { const c = ac(); if (c) tone(1500, c.currentTime, 0.08, { type: "square", gain: 0.05 }); }
export function joinBlip() { const c = ac(); if (!c) return; const t = c.currentTime; bell(hz("G5"), t, 0.4, 0.1); bell(hz("C6"), t + 0.08, 0.5, 0.1); }
export function timeUp() {
  const c = ac(); if (!c) return; const t = c.currentTime;
  bell(hz("C4"), t, 2.2, 0.25); bell(hz("G3"), t, 2.2, 0.15);
}
export function reveal() {
  const c = ac(); if (!c) return; const t = c.currentTime;
  ["C5", "E5", "G5", "C6"].forEach((n, i) => bell(hz(n), t + i * 0.09, 1.4, 0.13));
}
export function whoosh() { const c = ac(); if (c) noise(c.currentTime, 0.35, 0.12, 1500); }
export function drumroll(seconds) {
  const c = ac(); if (!c) return; const t0 = c.currentTime;
  for (let t = 0; t < seconds; t += 0.05) noise(t0 + t, 0.06, 0.03 + 0.08 * (t / seconds), 800);
}
export function fanfare() {
  const c = ac(); if (!c) return; const t = c.currentTime;
  const seq = [["C5", 0, .25], ["C5", .18, .2], ["C5", .36, .2], ["G5", .54, .9], ["E5", 1.2, .3], ["G5", 1.45, 1.6]];
  for (const [n, at, d] of seq) {
    tone(hz(n), t + at, d + 0.3, { type: "sawtooth", gain: 0.07, partials: [[1, 1], [2, 0.3]] });
    bell(hz(n), t + at, d + 0.6, 0.08);
  }
  ["C3", "G3", "C4"].forEach((n) => tone(hz(n), t + 1.45, 2, { type: "triangle", gain: 0.1 }));
}
