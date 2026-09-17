import os
import numpy as np
import soundfile as sf

def generate_demo_stems(dest_dir: str):
    os.makedirs(dest_dir, exist_ok=True)
    sr = 44100
    duration = 6.0 # 6秒循环测试音频
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)

    # 1. 鼓组 (Drums: Kick + Hihat)
    kick = np.zeros_like(t)
    bpm = 120
    beat_interval = 60.0 / bpm
    for beat_t in np.arange(0, duration, beat_interval):
        idx = int(beat_t * sr)
        hit_len = min(int(0.2 * sr), len(t) - idx)
        if hit_len > 0:
            env = np.exp(-np.linspace(0, 15, hit_len))
            freq_sweep = np.sin(2 * np.pi * np.linspace(150, 45, hit_len) * np.linspace(0, 0.2, hit_len))
            kick[idx:idx+hit_len] += 0.8 * env * freq_sweep
    
    # Hi-hat on off-beats
    for beat_t in np.arange(beat_interval / 2, duration, beat_interval):
        idx = int(beat_t * sr)
        hit_len = min(int(0.05 * sr), len(t) - idx)
        if hit_len > 0:
            noise = (np.random.rand(hit_len) * 2 - 1) * np.exp(-np.linspace(0, 20, hit_len))
            kick[idx:idx+hit_len] += 0.25 * noise

    kick_stereo = np.stack([kick, kick], axis=1)
    sf.write(os.path.join(dest_dir, "01_Drums.wav"), kick_stereo, sr)

    # 2. 贝斯 (Bass: 80-110Hz warm bassline)
    bass = np.zeros_like(t)
    bass_freqs = [55, 65.4, 73.4, 82.4] # A1, C2, D2, E2
    step_dur = duration / len(bass_freqs)
    for i, f in enumerate(bass_freqs):
        start_idx = int(i * step_dur * sr)
        end_idx = int((i + 1) * step_dur * sr)
        seg_t = t[start_idx:end_idx]
        bass[start_idx:end_idx] = 0.5 * (np.sin(2 * np.pi * f * seg_t) + 0.3 * np.sin(2 * np.pi * 2 * f * seg_t))
    bass_stereo = np.stack([bass, bass], axis=1)
    sf.write(os.path.join(dest_dir, "02_Bass.wav"), bass_stereo, sr)

    # 3. 键盘/吉他伴奏 (Keys / Chords: 300Hz ~ 800Hz rich chords)
    keys_l = np.zeros_like(t)
    keys_r = np.zeros_like(t)
    chord_notes = [
        [220, 261.6, 329.6], # Am
        [174.6, 220, 261.6], # F
        [261.6, 329.6, 392], # C
        [196, 246.9, 293.7]  # G
    ]
    for i, chord in enumerate(chord_notes):
        start_idx = int(i * step_dur * sr)
        end_idx = int((i + 1) * step_dur * sr)
        seg_t = t[start_idx:end_idx]
        sig = np.zeros_like(seg_t)
        for note_f in chord:
            sig += 0.15 * np.sin(2 * np.pi * note_f * seg_t)
        keys_l[start_idx:end_idx] = sig * 0.9
        keys_r[start_idx:end_idx] = sig * 1.1 # 制造立体声差
    keys_stereo = np.stack([keys_l, keys_r], axis=1)
    sf.write(os.path.join(dest_dir, "03_Keys.wav"), keys_stereo, sr)

    # 4. 主旋律/人声模拟 (Lead Vocal Melody: 440Hz ~ 880Hz)
    vocal = np.zeros_like(t)
    melody_notes = [440, 523.2, 659.2, 587.3, 523.2, 440]
    note_dur = duration / len(melody_notes)
    for i, mf in enumerate(melody_notes):
        start_idx = int(i * note_dur * sr)
        end_idx = int((i + 1) * note_dur * sr)
        seg_t = t[start_idx:end_idx]
        env = np.sin(np.pi * np.linspace(0, 1, len(seg_t))) ** 0.8
        vocal[start_idx:end_idx] = 0.4 * env * (np.sin(2 * np.pi * mf * seg_t) + 0.2 * np.sin(2 * np.pi * 3 * mf * seg_t))
    vocal_stereo = np.stack([vocal, vocal], axis=1)
    sf.write(os.path.join(dest_dir, "04_Lead_Vocal.wav"), vocal_stereo, sr)

    # 5. 商业参考曲 (Reference Track: 已经过商业母带响度强化的完整混音)
    ref_mix = (kick_stereo * 0.7 + bass_stereo * 0.7 + keys_stereo * 0.5 + vocal_stereo * 0.6)
    # 增加空气感和压缩
    ref_mix = np.clip(ref_mix * 1.6, -0.98, 0.98)
    sf.write(os.path.join(dest_dir, "Commercial_Reference.wav"), ref_mix, sr)

    print("Demo audio assets successfully generated in:", dest_dir)

if __name__ == "__main__":
    import sys
    target = sys.argv[1] if len(sys.argv) > 1 else "./demo_assets"
    generate_demo_stems(target)
