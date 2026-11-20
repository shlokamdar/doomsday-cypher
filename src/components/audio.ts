/* Sound effects. Respects the "Sound on/off" toggle stored in localStorage. */

function soundOn(): boolean {
  try {
    return localStorage.getItem("doomsday.sound") !== "off";
  } catch {
    return true;
  }
}

let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  try {
    ctx = ctx ?? new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Fallback "FAAAH": a falling, wobbling sawtooth groan. */
function synthFaaah() {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  const osc = a.createOscillator();
  const lfo = a.createOscillator();
  const lfoGain = a.createGain();
  const gain = a.createGain();
  const filter = a.createBiquadFilter();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(440, t);
  osc.frequency.exponentialRampToValueAtTime(140, t + 1.3);
  lfo.frequency.value = 7;
  lfoGain.gain.value = 18;
  lfo.connect(lfoGain).connect(osc.frequency);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(2200, t);
  filter.frequency.exponentialRampToValueAtTime(500, t + 1.3);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.25, t + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
  osc.connect(filter).connect(gain).connect(a.destination);
  osc.start(t);
  lfo.start(t);
  osc.stop(t + 1.45);
  lfo.stop(t + 1.45);
}

/** Wrong flag: plays public/sounds/faaah.mp3, falling back to a synth if it can't play. */
export function playWrong() {
  if (!soundOn()) return;
  try {
    const el = new Audio(`${import.meta.env.BASE_URL}sounds/faaah.mp3`);
    el.volume = 0.9;
    let fellBack = false;
    const fallback = () => {
      if (!fellBack) {
        fellBack = true;
        synthFaaah();
      }
    };
    el.addEventListener("error", fallback, { once: true });
    el.play().catch(fallback);
  } catch {
    synthFaaah();
  }
}

/** Correct flag: a synthesised power-up chord (no audio file). */
export function playSeal() {
  if (!soundOn()) return;
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  const master = a.createGain();
  master.gain.setValueAtTime(0.0001, t);
  master.gain.exponentialRampToValueAtTime(0.3, t + 0.04);
  master.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
  master.connect(a.destination);
  // rising sweep
  const sweep = a.createOscillator();
  sweep.type = "square";
  sweep.frequency.setValueAtTime(180, t);
  sweep.frequency.exponentialRampToValueAtTime(880, t + 0.25);
  const sg = a.createGain();
  sg.gain.value = 0.12;
  sweep.connect(sg).connect(master);
  sweep.start(t);
  sweep.stop(t + 0.26);
  // major chord
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    const o = a.createOscillator();
    o.type = i % 2 ? "triangle" : "sawtooth";
    o.frequency.value = f;
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t + 0.22 + i * 0.05);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.26 + i * 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
    o.connect(g).connect(master);
    o.start(t + 0.22 + i * 0.05);
    o.stop(t + 1.8);
  });
}
