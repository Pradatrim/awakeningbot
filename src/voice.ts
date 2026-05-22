/* ============================================================
   Medisun voice — the app reads itself aloud.

   Built on the Web Speech API (SpeechSynthesis). Every guided
   screen narrates itself in a warm, slow voice so an elder with
   poor eyesight can complete onboarding without reading a word.

   Best-effort: where speech synthesis is unavailable the app
   stays fully usable, just silent.
   ============================================================ */

import { useEffect } from 'react';
import { useSyncExternalStore } from 'react';

const MUTE_KEY = 'medisun.voice.muted';

const supported =
  typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

let muted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
})();

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Warm, natural voice if the platform offers one. */
function pickVoice(): SpeechSynthesisVoice | undefined {
  if (!supported) return undefined;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return undefined;
  const warm = ['Samantha', 'Google US English', 'Microsoft Aria', 'Microsoft Jenny', 'Karen'];
  for (const name of warm) {
    const v = voices.find((x) => x.name.includes(name));
    if (v) return v;
  }
  return voices.find((v) => v.lang.startsWith('en-US')) ?? voices.find((v) => v.lang.startsWith('en')) ?? voices[0];
}

// getVoices() populates asynchronously on some browsers.
if (supported) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}

/** Speaks a line, cancelling anything already in progress. */
export function speak(text: string): void {
  if (!supported || muted || !text) return;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.93;
    u.pitch = 1.03;
    u.volume = 1;
    const v = pickVoice();
    if (v) u.voice = v;
    synth.speak(u);
  } catch {
    /* speech unavailable — stay silent */
  }
}

export function stopSpeaking(): void {
  if (supported) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }
}

export function voiceSupported(): boolean {
  return supported;
}

export function setMuted(m: boolean): void {
  muted = m;
  try {
    localStorage.setItem(MUTE_KEY, m ? '1' : '0');
  } catch {
    /* ignore */
  }
  if (m) stopSpeaking();
  emit();
}

/** Reactive mute state for the voice toggle. */
export function useMuted(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => muted,
    () => muted,
  );
}

/**
 * Narrates `text` whenever it changes, and stops on unmount.
 * Guided screens pass their spoken script here.
 */
export function useNarration(text: string | undefined): void {
  const isMuted = useMuted();
  useEffect(() => {
    if (!text || isMuted) return;
    // A short beat so the screen settles before the voice starts.
    const t = setTimeout(() => speak(text), 280);
    return () => {
      clearTimeout(t);
      stopSpeaking();
    };
  }, [text, isMuted]);
}
