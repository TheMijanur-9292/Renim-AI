import React, { useState, useEffect, useRef } from 'react';

interface FocusTimerWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionComplete?: (minutes: number) => void;
}

type SoundMode = 'none' | 'rain' | 'brown' | 'drone';

export const FocusTimerWidget: React.FC<FocusTimerWidgetProps> = ({
  isOpen,
  onClose,
  onSessionComplete,
}) => {
  const [presetMinutes, setPresetMinutes] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [soundMode, setSoundMode] = useState<SoundMode>('none');
  const [focusLabel, setFocusLabel] = useState('Deep Work Sprint');

  const audioCtxRef = useRef<AudioContext | null>(null);
  const soundNodeRef = useRef<AudioNode | null>(null);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setRunning(false);
          onSessionComplete?.(presetMinutes);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running, presetMinutes, onSessionComplete]);

  // WebAudio synthesized ambient sound (zero external audio files needed)
  useEffect(() => {
    const stopAudio = () => {
      try {
        if (soundNodeRef.current && 'stop' in soundNodeRef.current) {
          (soundNodeRef.current as AudioScheduledSourceNode).stop();
        }
        soundNodeRef.current?.disconnect();
      } catch {}
      soundNodeRef.current = null;
    };

    stopAudio();
    if (soundMode === 'none') return;

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContextClass();
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    const gain = ctx.createGain();
    gain.gain.value = 0.08;
    gain.connect(ctx.destination);

    if (soundMode === 'drone') {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 174;
      osc.connect(gain);
      osc.start();
      soundNodeRef.current = osc;
    } else {
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        if (soundMode === 'brown') {
          data[i] = (lastOut + 0.02 * white) / 1.02;
          lastOut = data[i];
          data[i] *= 2.5;
        } else {
          data[i] = white * 0.35;
        }
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = soundMode === 'rain' ? 1200 : 420;

      noise.connect(filter);
      filter.connect(gain);
      noise.start();
      soundNodeRef.current = noise;
    }

    return stopAudio;
  }, [soundMode]);

  if (!isOpen) return null;

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const secs = String(secondsLeft % 60).padStart(2, '0');

  const selectPreset = (m: number) => {
    setRunning(false);
    setPresetMinutes(m);
    setSecondsLeft(m * 60);
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '22px',
        left: '260px',
        zIndex: 8500,
        width: '320px',
        background: 'var(--mui-surface)',
        border: '1px solid var(--mui-border)',
        borderRadius: '14px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
        padding: '16px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '13.5px' }}>
          <span className="material-symbols-rounded" style={{ color: '#06b6d4' }}>timer</span>
          <span>Focus Studio & Ambient</span>
        </div>
        <button className="mui-btn-icon" onClick={onClose} title="Close">
          <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>close</span>
        </button>
      </div>

      <input
        className="mui-input"
        value={focusLabel}
        onChange={(e) => setFocusLabel(e.target.value)}
        placeholder="What are you focusing on?"
        style={{ marginBottom: '12px', fontSize: '12.5px', padding: '7px 10px' }}
      />

      <div style={{ textAlign: 'center', padding: '12px 0', background: 'var(--mui-paper)', borderRadius: '10px', border: '1px solid var(--mui-border)', marginBottom: '12px' }}>
        <div style={{ fontSize: '38px', fontWeight: 800, letterSpacing: '0.04em', fontVariantNumeric: 'tabular-nums', color: running ? '#06b6d4' : 'var(--mui-text-primary)' }}>
          {mins}:{secs}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '8px' }}>
          {[15, 25, 45, 5].map((m) => (
            <button
              key={m}
              onClick={() => selectPreset(m)}
              style={{
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                cursor: 'pointer',
                border: '1px solid var(--mui-border)',
                background: presetMinutes === m ? 'var(--mui-primary-subtle)' : 'transparent',
                color: 'var(--mui-text-primary)',
              }}
            >
              {m === 5 ? '5m Break' : `${m}m`}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <button
          className="mui-btn mui-btn-primary"
          style={{ flex: 1, justifyContent: 'center' }}
          onClick={() => setRunning((r) => !r)}
        >
          <span className="material-symbols-rounded">{running ? 'pause' : 'play_arrow'}</span>
          {running ? 'Pause' : 'Start Focus'}
        </button>
        <button
          className="mui-btn mui-btn-outlined"
          onClick={() => {
            setRunning(false);
            setSecondsLeft(presetMinutes * 60);
          }}
        >
          Reset
        </button>
      </div>

      <div style={{ fontSize: '11.5px', color: 'var(--mui-text-muted)', marginBottom: '6px' }}>Ambient Soundscape</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
        {(
          [
            { id: 'none', label: 'Mute' },
            { id: 'rain', label: 'Rain' },
            { id: 'brown', label: 'Deep' },
            { id: 'drone', label: 'Zen' },
          ] as Array<{ id: SoundMode; label: string }>
        ).map((s) => (
          <button
            key={s.id}
            onClick={() => setSoundMode(s.id)}
            style={{
              padding: '6px 4px',
              borderRadius: '7px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              border: '1px solid var(--mui-border)',
              background: soundMode === s.id ? 'var(--mui-primary-subtle)' : 'var(--mui-paper)',
              color: soundMode === s.id ? '#22d3ee' : 'var(--mui-text-secondary)',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
};
