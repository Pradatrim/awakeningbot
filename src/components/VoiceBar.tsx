/* ============================================================
   VoiceBar — the on-screen voice control for guided screens.
   Toggle the narration on/off, or replay the current line.
   ============================================================ */

import { setMuted, speak, useMuted, voiceSupported } from '../voice';

export default function VoiceBar({ line }: { line?: string }) {
  const muted = useMuted();
  if (!voiceSupported()) return null;

  return (
    <div className="voicebar" role="group" aria-label="Voice guide">
      <button
        className={`voicechip${muted ? '' : ' on'}`}
        onClick={() => setMuted(!muted)}
        aria-pressed={!muted}
      >
        <span style={{ fontSize: 22 }}>{muted ? '🔇' : '🔊'}</span>
        {muted ? 'Voice off' : 'Voice on'}
      </button>
      {!muted && line && (
        <button className="voicechip" onClick={() => speak(line)}>
          <span style={{ fontSize: 20 }}>↻</span> Hear again
        </button>
      )}
    </div>
  );
}
