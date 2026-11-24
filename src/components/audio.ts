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

/** Wrong flag fallback: plays public/sounds/faaah.mp3, else the synth. */
export function playWrong() {
  playSound(`${import.meta.env.BASE_URL}sounds/faaah.mp3`, 4, synthFaaah);
}

/* ---------------- cue playback (Soundboard) ---------------- */

const clips = new Map<string, HTMLAudioElement>();
let stopTimer: ReturnType<typeof setTimeout> | null = null;
let playing: HTMLAudioElement | null = null;

/** Loads a clip ahead of time so it starts instantly. */
export function preloadSound(src: string | null) {
  if (!src || clips.has(src) || typeof Audio === "undefined") return;
  try {
    const a = new Audio(src);
    a.preload = "auto";
    clips.set(src, a);
  } catch {
    /* no audio */
  }
}

/**
 * Plays a sound for at most `seconds`, fading out at the end. `src` null means a generated sound
 * (`synth`) or nothing. Respects the player's sound switch and stops whatever was playing before.
 */
export function playSound(src: string | null, seconds: number, synth?: () => void) {
  if (!soundOn()) return;
  if (playing) {
    playing.pause();
    playing = null;
  }
  if (stopTimer) clearTimeout(stopTimer);
  if (!src) {
    synth?.();
    return;
  }
  try {
    let a = clips.get(src);
    if (!a) {
      a = new Audio(src);
      clips.set(src, a);
    }
    a.currentTime = 0;
    a.volume = 0.9;
    playing = a;
    void a.play().catch(() => synth?.());
    const el = a;
    stopTimer = setTimeout(() => {
      let v = el.volume;
      const fade = setInterval(() => {
        v -= 0.1;
        if (v <= 0.05) {
          clearInterval(fade);
          el.pause();
        } else el.volume = v;
      }, 40);
    }, Math.max(1, seconds) * 1000);
  } catch {
    synth?.();
  }
}

/** The generated fallback for a built-in sound reference, if it has one. */
export function synthFor(ref: string): (() => void) | undefined {
  if (ref === "builtin:seal") return playSealSynth;
  if (ref === "builtin:faaah") return synthFaaah;
  return undefined;
}

/** Plays a Soundboard sound reference ("none", "builtin:…", "upload:…"). */
export function playRef(ref: string, src: string | null, seconds: number) {
  if (ref === "none") return;
  playSound(src, seconds, synthFor(ref));
}

/** Correct flag: a synthesised power-up chord (no audio file). */
export function playSeal() {
  if (!soundOn()) return;
  playSealSynth();
}

function playSealSynth() {
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
