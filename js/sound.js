// Tiny WebAudio blips. No audio files. Silent unless the Sound setting is on.
let ac = null;

const TONES = {
  ok:   [[660, 0], [880, 0.09]],
  bad:  [[220, 0], [160, 0.12]],
  tick: [[520, 0]],
  win:  [[660, 0], [880, 0.09], [1100, 0.18]],
};

export function blip(kind, enabled) {
  if (!enabled) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = ac || new AC();
    if (ac.state === "suspended") ac.resume();
    for (const [freq, delay] of TONES[kind] || TONES.tick) {
      const t0 = ac.currentTime + delay;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.12, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
      osc.connect(gain).connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + 0.16);
    }
  } catch (e) { /* audio is optional */ }
}
