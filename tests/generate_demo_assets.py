import os
import numpy as np
import soundfile as sf

def generate_demo_stems(dest_dir: str):
    os.makedirs(dest_dir, exist_ok=True)
    sr = 44100
    duration = 8.0 # 8秒循环工程
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    bpm = 110
    beat_interval = 60.0 / bpm

    # 和弦走势：Am - F - C - G
    chord_roots = [220.0, 174.61, 261.63, 196.0] # A3, F3, C4, G3
    step_dur = duration / 4

    # 1. 鼓组分轨：底鼓 (Kick)
    kick = np.zeros_like(t)
    for beat_t in np.arange(0, duration, beat_interval):
        idx = int(beat_t * sr)
        hit_len = min(int(0.25 * sr), len(t) - idx)
        if hit_len > 0:
            env = np.exp(-np.linspace(0, 18, hit_len))
            freq_sweep = np.sin(2 * np.pi * np.linspace(130, 48, hit_len) * np.linspace(0, 0.25, hit_len))
            kick[idx:idx+hit_len] += 0.85 * env * freq_sweep
    sf.write(os.path.join(dest_dir, "01_Drums_Kick.wav"), np.stack([kick, kick], axis=1), sr)

    # 2. 鼓组分轨：军鼓与踩镲 (Snare & Hi-Hat)
    snare_hat = np.zeros_like(t)
    # 军鼓在 2, 4 拍
    for beat_t in np.arange(beat_interval, duration, beat_interval * 2):
        idx = int(beat_t * sr)
        hit_len = min(int(0.2 * sr), len(t) - idx)
        if hit_len > 0:
            noise = (np.random.rand(hit_len) * 2 - 1) * np.exp(-np.linspace(0, 15, hit_len))
            body = np.sin(2 * np.pi * 180 * np.linspace(0, 0.2, hit_len)) * np.exp(-np.linspace(0, 20, hit_len))
            snare_hat[idx:idx+hit_len] += 0.6 * (0.7 * noise + 0.3 * body)
    # 踩镲在每半拍
    for beat_t in np.arange(beat_interval / 2, duration, beat_interval / 2):
        idx = int(beat_t * sr)
        hit_len = min(int(0.04 * sr), len(t) - idx)
        if hit_len > 0:
            hat = (np.random.rand(hit_len) * 2 - 1) * np.exp(-np.linspace(0, 30, hit_len))
            snare_hat[idx:idx+hit_len] += 0.2 * hat
    sf.write(os.path.join(dest_dir, "02_Drums_Snare_Hihat.wav"), np.stack([snare_hat, snare_hat], axis=1), sr)

    # 3. 贝斯 (Electric Bass: 紧致富有弹性的低频律动)
    bass = np.zeros_like(t)
    bass_notes = [55.0, 43.65, 65.41, 49.0] # A1, F1, C2, G1
    for i, f in enumerate(bass_notes):
        start_i = int(i * step_dur * sr)
        end_i = int((i + 1) * step_dur * sr)
        st = t[start_i:end_i]
        env = np.sin(np.pi * np.linspace(0, 1, len(st))) ** 0.5
        b_sig = 0.5 * np.sin(2 * np.pi * f * st) + 0.25 * np.sin(2 * np.pi * 2 * f * st)
        bass[start_i:end_i] = b_sig * env
    sf.write(os.path.join(dest_dir, "03_Bass.wav"), np.stack([bass, bass], axis=1), sr)

    # 4. 木吉他分解和弦 (Acoustic Guitar Arpeggio: 晶莹透亮的指弹音色)
    ac_arp_l = np.zeros_like(t)
    ac_arp_r = np.zeros_like(t)
    chord_arps = [
        [220, 261.6, 329.6, 440], # Am
        [174.6, 220, 261.6, 349.2], # F
        [261.6, 329.6, 392, 523.2], # C
        [196, 246.9, 293.7, 392]    # G
    ]
    sub_note_dur = step_dur / 4
    for c_idx, chord in enumerate(chord_arps):
        c_start = c_idx * step_dur
        for n_idx, freq in enumerate(chord):
            n_start = c_start + n_idx * sub_note_dur
            idx = int(n_start * sr)
            n_len = min(int(0.6 * sr), len(t) - idx)
            if n_len > 0:
                decay = np.exp(-np.linspace(0, 6, n_len))
                string_tone = np.sin(2 * np.pi * freq * np.linspace(0, 0.6, n_len))
                harm = 0.4 * np.sin(2 * np.pi * 2 * freq * np.linspace(0, 0.6, n_len))
                sig = 0.35 * (string_tone + harm) * decay
                ac_arp_l[idx:idx+n_len] += sig * 0.95
                ac_arp_r[idx:idx+n_len] += sig * 0.5 # 偏左声像
    sf.write(os.path.join(dest_dir, "04_Acoustic_Guitar_Arpeggio.wav"), np.stack([ac_arp_l, ac_arp_r], axis=1), sr)

    # 5. 木吉他扫弦 (Acoustic Guitar Strum: 律动强劲的中频扫弦)
    ac_strum_l = np.zeros_like(t)
    ac_strum_r = np.zeros_like(t)
    for beat_t in np.arange(0, duration, beat_interval):
        idx = int(beat_t * sr)
        s_len = min(int(0.35 * sr), len(t) - idx)
        if s_len > 0:
            c_idx = min(int(beat_t / step_dur), 3)
            root = chord_roots[c_idx]
            decay = np.exp(-np.linspace(0, 9, s_len))
            sig = 0.25 * (np.sin(2 * np.pi * root * np.linspace(0, 0.35, s_len)) +
                          np.sin(2 * np.pi * root * 1.5 * np.linspace(0, 0.35, s_len))) * decay
            ac_strum_l[idx:idx+s_len] += sig * 0.4
            ac_strum_r[idx:idx+s_len] += sig * 0.95 # 偏右声像，与分解和弦互补
    sf.write(os.path.join(dest_dir, "05_Acoustic_Guitar_Strum.wav"), np.stack([ac_strum_l, ac_strum_r], axis=1), sr)

    # 6. 尼龙古典吉他 (Nylon Guitar: 温暖温润的柔和指弹)
    nylon = np.zeros_like(t)
    for i, root in enumerate(chord_roots):
        start_i = int(i * step_dur * sr)
        end_i = int((i + 1) * step_dur * sr)
        st = t[start_i:end_i]
        # 尼龙弦基频更纯、高频泛音柔和
        sig = 0.3 * np.sin(2 * np.pi * (root * 0.5) * st) * np.exp(-np.linspace(0, 4, len(st)))
        nylon[start_i:end_i] = sig
    sf.write(os.path.join(dest_dir, "06_Nylon_Guitar.wav"), np.stack([nylon * 0.8, nylon * 0.7], axis=1), sr)

    # 7. 电吉他过载 Solo (Electric Guitar Solo: 极具穿透力与延音的领奏)
    elec_solo = np.zeros_like(t)
    solo_notes = [440, 523.2, 587.3, 659.2, 587.3, 523.2, 440, 392]
    s_dur = duration / len(solo_notes)
    for i, sf_hz in enumerate(solo_notes):
        idx = int(i * s_dur * sr)
        slen = min(int(s_dur * 1.1 * sr), len(t) - idx)
        if slen > 0:
            st = np.linspace(0, s_dur * 1.1, slen)
            vibrato = 1.0 + 0.015 * np.sin(2 * np.pi * 5.5 * st)
            dry = np.sin(2 * np.pi * sf_hz * vibrato * st)
            # 模拟轻度过载饱和失真
            od = np.tanh(dry * 2.8) * 0.35
            elec_solo[idx:idx+slen] += od
    sf.write(os.path.join(dest_dir, "07_Electric_Guitar_Solo.wav"), np.stack([elec_solo, elec_solo], axis=1), sr)

    # 8. 原声大钢琴 (Grand Piano: 雄厚宏大、动态宽广的和弦铺陈)
    grand_p_l = np.zeros_like(t)
    grand_p_r = np.zeros_like(t)
    for i, chord in enumerate(chord_arps):
        start_i = int(i * step_dur * sr)
        end_i = int((i + 1) * step_dur * sr)
        st = t[start_i:end_i]
        decay = np.exp(-np.linspace(0, 3.5, len(st)))
        sig = np.zeros_like(st)
        for note in chord:
            sig += 0.12 * np.sin(2 * np.pi * note * st) + 0.04 * np.sin(2 * np.pi * 2 * note * st)
        grand_p_l[start_i:end_i] = sig * decay * 0.9
        grand_p_r[start_i:end_i] = sig * decay * 1.0
    sf.write(os.path.join(dest_dir, "08_Grand_Piano.wav"), np.stack([grand_p_l, grand_p_r], axis=1), sr)

    # 9. 复古电钢琴 (Rhodes Electric Piano: 经典钟鸣质感与暖色颤音)
    rhodes = np.zeros_like(t)
    for i, chord in enumerate(chord_arps):
        start_i = int(i * step_dur * sr)
        end_i = int((i + 1) * step_dur * sr)
        st = t[start_i:end_i]
        decay = np.exp(-np.linspace(0, 5, len(st)))
        tremolo = 0.5 * (1 + 0.3 * np.sin(2 * np.pi * 4.0 * st)) # 颤音调制
        sig = np.zeros_like(st)
        for note in chord:
            # 电钢琴特有的类似音叉纯净感与高次谐波
            sig += 0.15 * np.sin(2 * np.pi * note * st) + 0.08 * np.sin(2 * np.pi * 3 * note * st)
        rhodes[start_i:end_i] = sig * decay * tremolo
    sf.write(os.path.join(dest_dir, "09_Rhodes_Electric_Piano.wav"), np.stack([rhodes * 0.9, rhodes * 0.6], axis=1), sr)

    # 10. 混合铺底钢琴 (Hybrid Synth Piano: 现代长音 Pad 环绕声景)
    hybrid_pad_l = np.zeros_like(t)
    hybrid_pad_r = np.zeros_like(t)
    for i, root in enumerate(chord_roots):
        start_i = int(i * step_dur * sr)
        end_i = int((i + 1) * step_dur * sr)
        st = t[start_i:end_i]
        env = np.sin(np.pi * np.linspace(0, 1, len(st))) ** 0.3
        sig_l = 0.12 * (np.sin(2 * np.pi * root * st) + np.sin(2 * np.pi * (root * 1.004) * st)) # 合唱合音
        sig_r = 0.12 * (np.sin(2 * np.pi * root * st) + np.sin(2 * np.pi * (root * 0.996) * st))
        hybrid_pad_l[start_i:end_i] = sig_l * env
        hybrid_pad_r[start_i:end_i] = sig_r * env
    sf.write(os.path.join(dest_dir, "10_Hybrid_Synth_Piano.wav"), np.stack([hybrid_pad_l, hybrid_pad_r], axis=1), sr)

    # 11. 主唱人声 (Lead Vocal: 核心旋律、清透咬字与主舞台定位)
    lead_vocal = np.zeros_like(t)
    melody = [440, 523.2, 659.2, 587.3, 523.2, 440, 392, 440]
    m_dur = duration / len(melody)
    for i, m_freq in enumerate(melody):
        start_i = int(i * m_dur * sr)
        end_i = int((i + 1) * m_dur * sr)
        st = t[start_i:end_i]
        env = np.sin(np.pi * np.linspace(0, 1, len(st))) ** 0.6
        sig = 0.45 * env * (np.sin(2 * np.pi * m_freq * st) + 0.25 * np.sin(2 * np.pi * 2 * m_freq * st) + 0.1 * np.sin(2 * np.pi * 3 * m_freq * st))
        lead_vocal[start_i:end_i] = sig
    sf.write(os.path.join(dest_dir, "11_Lead_Vocal.wav"), np.stack([lead_vocal, lead_vocal], axis=1), sr)

    # 12. 立体声和声 (Backing Vocals: 宽广侧向铺排的高频和声)
    backing_l = np.zeros_like(t)
    backing_r = np.zeros_like(t)
    for i, m_freq in enumerate(melody):
        start_i = int(i * m_dur * sr)
        end_i = int((i + 1) * m_dur * sr)
        st = t[start_i:end_i]
        env = np.sin(np.pi * np.linspace(0, 1, len(st))) ** 0.7
        # 3度/5度和声
        sig_hi = 0.2 * env * np.sin(2 * np.pi * (m_freq * 1.25) * st)
        backing_l[start_i:end_i] = sig_hi * 0.95
        backing_r[start_i:end_i] = sig_hi * 0.2
    sf.write(os.path.join(dest_dir, "12_Backing_Vocals.wav"), np.stack([backing_l, backing_r], axis=1), sr)

    # ==========================================
    # 生成 3 款不同风格的独立商业参考曲 (Reference Tracks)
    # ==========================================
    # 风格 1：现代商业流行 (Modern Pop) - 高频极其通透空气感、低频超重打击感、人声突出紧贴
    pop_sum = (
        np.stack([kick, kick], axis=1) * 0.9 +
        np.stack([snare_hat, snare_hat], axis=1) * 0.7 +
        np.stack([bass, bass], axis=1) * 0.8 +
        np.stack([ac_strum_l, ac_strum_r], axis=1) * 0.4 +
        np.stack([lead_vocal, lead_vocal], axis=1) * 0.85
    )
    pop_ref = np.clip(pop_sum * 1.8, -0.98, 0.98)
    sf.write(os.path.join(dest_dir, "Ref_Modern_Pop.wav"), pop_ref, sr)

    # 风格 2：原声民谣暖色 (Acoustic Folk) - 原声大动态、木吉他拨弦细腻、温暖中低频
    folk_sum = (
        np.stack([ac_arp_l, ac_arp_r], axis=1) * 0.7 +
        np.stack([ac_strum_l, ac_strum_r], axis=1) * 0.6 +
        np.stack([nylon * 0.8, nylon * 0.7], axis=1) * 0.5 +
        np.stack([grand_p_l, grand_p_r], axis=1) * 0.5 +
        np.stack([lead_vocal, lead_vocal], axis=1) * 0.75 +
        np.stack([bass, bass], axis=1) * 0.4
    )
    folk_ref = np.clip(folk_sum * 1.3, -0.98, 0.98)
    sf.write(os.path.join(dest_dir, "Ref_Acoustic_Folk.wav"), folk_ref, sr)

    # 风格 3：复古都市摇滚与 R&B (Vintage Rock & R&B) - 电钢琴律动、电吉他 Solo、饱满总线胶水
    rnb_sum = (
        np.stack([kick, kick], axis=1) * 0.8 +
        np.stack([snare_hat, snare_hat], axis=1) * 0.75 +
        np.stack([bass, bass], axis=1) * 0.85 +
        np.stack([rhodes * 0.9, rhodes * 0.6], axis=1) * 0.7 +
        np.stack([elec_solo, elec_solo], axis=1) * 0.5 +
        np.stack([lead_vocal, lead_vocal], axis=1) * 0.8
    )
    rnb_ref = np.clip(rnb_sum * 1.5, -0.98, 0.98)
    sf.write(os.path.join(dest_dir, "Ref_Vintage_RnB_Rock.wav"), rnb_ref, sr)

    print(f"✅ 成功在 {dest_dir} 生成 12 轨专业示范乐器分轨及 3 款经典商业风格参考曲！")

if __name__ == "__main__":
    import sys
    target = sys.argv[1] if len(sys.argv) > 1 else "./demo_assets"
    generate_demo_stems(target)
