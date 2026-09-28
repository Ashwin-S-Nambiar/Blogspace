import { load, save } from './store.js';

let enabled = load('bs:sound', true);
let ctx = null;
let noiseBuf = null;

export const soundOn = () => enabled;

export function setSound(on) {
  enabled = on;
  save('bs:sound', on);
}

function audio() {
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) {
    return null;
  }
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (navigator.audioSession) navigator.audioSession.type = 'ambient';
    ctx = new AC();
  }
  if (ctx.state === 'suspended') {
    ctx.resume();
    return null;
  }
  return ctx;
}

function noise(c) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

function tone({ freq, to, dur, type = 'sine', gain = 0.05, delay = 0 }) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + delay;
  const osc = c.createOscillator();
  const amp = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + 0.006);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(amp).connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.03);
}

function hiss({ dur, freq, to, q = 1, gain = 0.05, delay = 0, pulse = 0, attack = 0.005 }) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + delay;
  const src = c.createBufferSource();
  src.buffer = noise(c);
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(freq, t);
  if (to) filter.frequency.exponentialRampToValueAtTime(to, t + dur);
  filter.Q.value = q;
  const amp = c.createGain();
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + attack);
  if (pulse) {
    const steps = Math.floor(dur / pulse);
    for (let i = 1; i < steps; i++) {
      amp.gain.setValueAtTime(i % 2 ? gain * 0.35 : gain, t + i * pulse);
    }
  }
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(amp).connect(c.destination);
  src.start(t, Math.random() * 0.2);
  src.stop(t + dur + 0.02);
}

const play =
  (fn) =>
  (...args) => {
    if (!enabled || document.hidden) return;
    try {
      fn(...args);
    } catch {}
  };

export const sfx = {
  tap: play(() => tone({ freq: 1100, to: 700, dur: 0.04, gain: 0.025 })),
  like: play((on) => {
    if (on) {
      tone({ freq: 660, dur: 0.08, type: 'triangle', gain: 0.05 });
      tone({
        freq: 990,
        dur: 0.14,
        type: 'triangle',
        gain: 0.045,
        delay: 0.05,
      });
    } else {
      tone({ freq: 520, to: 380, dur: 0.1, type: 'triangle', gain: 0.035 });
    }
  }),
  pass: play((delay = 0) => {
    hiss({
      dur: 0.36,
      freq: 1400,
      to: 2600,
      q: 0.9,
      gain: 0.05,
      pulse: 0.018,
      attack: 0.04,
      delay,
    });
    tone({ freq: 96, dur: 0.34, type: 'triangle', gain: 0.03, delay });
  }),
  land: play((delay = 0) => {
    tone({ freq: 170, to: 70, dur: 0.14, gain: 0.12, delay });
    hiss({ dur: 0.05, freq: 1100, q: 0.8, gain: 0.04, delay });
  }),
  remove: play(() => hiss({ dur: 0.16, freq: 2400, to: 900, q: 0.8, gain: 0.045, attack: 0.01 })),
  copy: play(() => {
    tone({ freq: 880, dur: 0.07, type: 'triangle', gain: 0.045 });
    tone({ freq: 1320, dur: 0.12, type: 'triangle', gain: 0.045, delay: 0.06 });
  }),
  error: play(() => tone({ freq: 240, to: 160, dur: 0.22, type: 'square', gain: 0.02 })),
};
