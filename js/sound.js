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

// Rustige lounge: zachte jazzakkoorden (pad), een warme bas en af en toe een belletje.
function pad(freq, t, dur, gain = 0.05) {
  const c = ac(); if (!c) return;
  const g = c.createGain();
  const lp = c.createBiquadFilter();
  lp.type = "lowpass"; lp.frequency.value = 1100; lp.Q.value = 0.3;
  const attack = Math.min(0.9, dur * 0.3);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.setValueAtTime(gain, t + dur - 0.6);
  g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.6);
  lp.connect(g); g.connect(master);
  for (const detune of [-6, 6]) {
    const o = c.createOscillator();
    o.type = "triangle"; o.frequency.value = freq; o.detune.value = detune;
    o.connect(lp); o.start(t); o.stop(t + dur + 0.7);
  }
}

// Cmaj9 – Am9 – Dm9 – G13 (twee tellen per akkoord-wissel van de bas)
const LOUNGE = [
  { root: "C3", chord: ["E3", "G3", "B3", "D4"], top: ["G4", "B4", "D5"] },
  { root: "A2", chord: ["G3", "C4", "E4", "B3"], top: ["E5", "C5", "B4"] },
  { root: "D3", chord: ["F3", "A3", "C4", "E4"], top: ["A4", "C5", "E5"] },
  { root: "G2", chord: ["F3", "B3", "E4", "A3"], top: ["D5", "B4", "E5"] },
];

export function lobbyMusic() {
  const ev = [];
  const barBeats = 4;
  // Vaste, losse plekken voor de belletjes, zodat het niet mechanisch klinkt
  const bellSpots = [[1.5, 0], [3, 1]], bellSpots2 = [[0.5, 2], [2.5, 0]];
  LOUNGE.forEach((bar, i) => {
    const at = i * barBeats;
    ev.push({ at: at + 0.0001, play: (t, spb) => bar.chord.forEach((n) => pad(hz(n), t, spb * barBeats, 0.028)) });
    ev.push({ at: at + 0.0002, play: (t, spb) => tone(hz(bar.root), t, spb * 2.6, { type: "sine", gain: 0.09, attack: 0.04 }) });
    ev.push({ at: at + 2.5, play: (t, spb) => tone(hz(bar.root) * 1.5, t, spb * 1.2, { type: "sine", gain: 0.05, attack: 0.04 }) });
    for (const [beat, k] of (i % 2 ? bellSpots2 : bellSpots)) {
      ev.push({ at: at + beat, play: (t) => bell(hz(bar.top[k]), t, 2.2, 0.035) });
    }
  });
  playLoop(ev, LOUNGE.length * barBeats, () => 72);
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
