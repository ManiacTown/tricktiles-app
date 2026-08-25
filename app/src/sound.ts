export type SoundName = 'place' | 'error' | 'roundComplete' | 'puzzleComplete';

const SOUND_FILES: Record<SoundName, string> = {
  place: '/sounds/place.mp3',
  error: '/sounds/error.mp3',
  roundComplete: '/sounds/round-complete.mp3',
  puzzleComplete: '/sounds/puzzle-complete.mp3',
};

const MUTE_KEY = 'tricktiles_sound_muted';

// Web Audio API instead of <audio>/new Audio(): each file is fetched and
// fully decoded into raw audio data (an AudioBuffer) exactly once, up front.
// Playing a sound later just hands that already-decoded buffer to the audio
// hardware — no per-play fetch or MP3 decode, which is what made the
// simpler `new Audio(path).play()` approach audibly laggy.
const audioContext = new AudioContext();
const buffers: Partial<Record<SoundName, AudioBuffer>> = {};

async function loadBuffer(name: SoundName): Promise<void> {
  const response = await fetch(SOUND_FILES[name]);
  const arrayBuffer = await response.arrayBuffer();
  buffers[name] = await audioContext.decodeAudioData(arrayBuffer);
}

for (const name of Object.keys(SOUND_FILES) as SoundName[]) {
  loadBuffer(name).catch(() => {});
}

export function playSound(name: SoundName): void {
  if (isSoundMuted()) return;
  const buffer = buffers[name];
  if (!buffer) return; // still decoding (e.g. a sound fired right on page load) — skip rather than wait
  // Browsers keep a fresh AudioContext "suspended" until a real user
  // gesture (click/keydown) resumes it — every playSound call site in this
  // app is already inside one, so this just clears that gate the first time.
  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {});
  }
  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.connect(audioContext.destination);
  source.start();
}

// Dev-only console helper — lets you run `playSound('place')` etc. directly
// in the browser DevTools console instead of playing through the game.
// import.meta.env.DEV is false in a production build, so this whole block
// (and the code it references) gets stripped out and never ships.
// Note: typing a command into the console isn't always treated as a "real"
// user gesture, so if nothing plays, click anywhere on the page once first.
if (import.meta.env.DEV) {
  (window as unknown as { playSound: typeof playSound }).playSound = playSound;
}

export function isSoundMuted(): boolean {
  return localStorage.getItem(MUTE_KEY) === 'true';
}

export function setSoundMuted(muted: boolean): void {
  localStorage.setItem(MUTE_KEY, String(muted));
}
