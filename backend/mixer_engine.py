import os
import sys
import soundfile as sf
import numpy as np
from typing import List, Dict, Any, Optional

_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from pedalboard import Pedalboard, HighpassFilter, PeakFilter, LowShelfFilter, HighShelfFilter, Compressor, Limiter, Gain
import pyloudnorm as pyln
from acoustic_analyzer import load_audio_normalized, calculate_lufs

class MixingEngine:
    def __init__(self, sample_rate: int = 44100):
        self.sample_rate = sample_rate

    def apply_pan(self, audio: np.ndarray, pan: float) -> np.ndarray:
        """
        等功率立体声声相算法 (Constant Power Panning)
        pan: -1.0 (全左) ~ 0.0 (居中) ~ +1.0 (全右)
        audio: [2, samples]
        """
        pan = np.clip(pan, -1.0, 1.0)
        # 将 -1 ~ 1 映射到 0 ~ pi/2
        theta = (pan + 1.0) * (np.pi / 4.0)
        gain_l = np.cos(theta) * np.sqrt(2.0)
        gain_r = np.sin(theta) * np.sqrt(2.0)
        
        out = np.zeros_like(audio)
        out[0] = audio[0] * gain_l
        out[1] = audio[1] * gain_r
        return out

    def build_track_dsp_board(self, action: Dict[str, Any]) -> Pedalboard:
        """根据单轨策略参数构建 Pedalboard 效果器链"""
        board = Pedalboard()

        # 1. 高通滤波 (High-pass Filter 去除无用低频隆隆声)
        hp_freq = action.get("high_pass_hz", 0)
        if hp_freq and hp_freq > 20:
            board.append(HighpassFilter(cutoff_frequency_hz=float(hp_freq)))

        # 2. 参量 EQ 调整
        eq_list = action.get("eq_adjustments", [])
        for eq in eq_list:
            freq = float(eq.get("freq", 1000))
            gain_db = float(eq.get("gain_db", 0.0))
            q = float(eq.get("q", 1.0))
            if abs(gain_db) > 0.1:
                board.append(PeakFilter(cutoff_frequency_hz=freq, gain_db=gain_db, q=q))

        # 3. 动态压缩 (Compressor)
        comp = action.get("compressor")
        if comp and isinstance(comp, dict):
            thresh = float(comp.get("threshold_db", 0.0))
            ratio = float(comp.get("ratio", 1.0))
            attack = float(comp.get("attack_ms", 10.0))
            release = float(comp.get("release_ms", 100.0))
            if thresh < -0.1 and ratio > 1.0:
                board.append(Compressor(
                    threshold_db=thresh,
                    ratio=ratio,
                    attack_ms=attack,
                    release_ms=release
                ))

        # 4. 增益修整 (Gain Trim)
        gain_trim = float(action.get("gain_trim_db", 0.0))
        if abs(gain_trim) > 0.05:
            board.append(Gain(gain_db=gain_trim))

        return board

    def process_stem(self, file_path: str, action: Dict[str, Any]) -> np.ndarray:
        """处理单一分轨音频"""
        audio, _ = load_audio_normalized(file_path, self.sample_rate)
        
        # 效果器处理
        dsp_board = self.build_track_dsp_board(action)
        processed = dsp_board(audio, self.sample_rate)
        
        # 声相调节
        pan = float(action.get("pan", 0.0))
        processed = self.apply_pan(processed, pan)

        # 最终推子音量倍率 (fader_gain: 0.0 ~ 2.0)
        fader_volume = float(action.get("volume", 1.0))
        processed = processed * fader_volume

        return processed

    def mix_and_master(
        self,
        tracks_data: List[Dict[str, Any]],
        strategy: Dict[str, Any],
        output_master_path: str,
        export_stems_dir: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        完整多轨混音与母带化流程
        tracks_data: [{"id": "...", "file_path": "...", "name": "...", ...}]
        strategy: LLM 或专家算法生成的执行配置
        """
        track_actions = {a["track_id"]: a for a in strategy.get("track_actions", [])}
        processed_stems = []
        max_samples = 0

        # 第一阶段：各分轨 DSP 处理与长度对齐
        for trk in tracks_data:
            tid = trk["id"]
            action = track_actions.get(tid, {})
            # 兼容前端临时传入的音量和声相
            if "volume" in trk:
                action["volume"] = trk["volume"]
            if "pan" in trk:
                action["pan"] = trk["pan"]

            proc_audio = self.process_stem(trk["file_path"], action)
            processed_stems.append({
                "id": tid,
                "name": trk.get("name", tid),
                "audio": proc_audio
            })
            if proc_audio.shape[1] > max_samples:
                max_samples = proc_audio.shape[1]

        if max_samples == 0:
            raise ValueError("没有有效的音频轨道输入")

        # 第二阶段：多轨累加求和 (Summing Bus) 与 分轨导出
        master_sum = np.zeros((2, max_samples), dtype=np.float32)
        saved_stem_paths = {}

        if export_stems_dir:
            os.makedirs(export_stems_dir, exist_ok=True)

        for item in processed_stems:
            audio = item["audio"]
            pad_len = max_samples - audio.shape[1]
            if pad_len > 0:
                audio = np.pad(audio, ((0, 0), (0, pad_len)))
            
            # 混入总线
            master_sum += audio

            # 如果需要保存独立处理后分轨
            if export_stems_dir:
                stem_file = os.path.join(export_stems_dir, f"stem_{item['name']}.wav")
                sf.write(stem_file, audio.T, self.sample_rate, subtype='PCM_24')
                saved_stem_paths[item["id"]] = stem_file

        # 第三阶段：总线母带化处理 (Master Bus DSP)
        bus_cfg = strategy.get("bus_master", {})
        master_board = Pedalboard()

        # 1. 胶水压缩 (Glue Compressor)
        glue = bus_cfg.get("glue_compressor", {})
        if glue and isinstance(glue, dict):
            thresh = float(glue.get("threshold_db", -14.0))
            ratio = float(glue.get("ratio", 2.0))
            attack = float(glue.get("attack_ms", 30.0))
            release = float(glue.get("release_ms", 100.0))
            master_board.append(Compressor(
                threshold_db=thresh,
                ratio=ratio,
                attack_ms=attack,
                release_ms=release
            ))

        # 2. 总线频响修饰
        bus_eq = bus_cfg.get("bus_eq", [])
        for eq in bus_eq:
            freq = float(eq.get("freq", 1000))
            gain_db = float(eq.get("gain_db", 0.0))
            q = float(eq.get("q", 1.0))
            if abs(gain_db) > 0.1:
                master_board.append(PeakFilter(cutoff_frequency_hz=freq, gain_db=gain_db, q=q))

        # 执行总线效果
        master_audio = master_board(master_sum, self.sample_rate)

        # 3. 响度匹配与 True-Peak 限幅
        target_lufs = float(bus_cfg.get("target_lufs", -14.0))
        current_lufs = calculate_lufs(master_audio, self.sample_rate)
        
        if current_lufs > -70.0:
            gain_needed_db = target_lufs - current_lufs
            # 安全防失真限制：单次自动补偿增益限制在 -12dB ~ +14dB
            gain_needed_db = float(np.clip(gain_needed_db, -12.0, 14.0))
            gain_lin = 10.0 ** (gain_needed_db / 20.0)
            master_audio = master_audio * gain_lin

        # 4. 终极砖墙限幅器 (Limiter)，确保母带真峰值不超过 -0.5 dBTP
        ceiling_db = float(bus_cfg.get("ceiling_dbtp", -0.5))
        limiter = Pedalboard([Limiter(threshold_db=ceiling_db, release_ms=100.0)])
        master_audio = limiter(master_audio, self.sample_rate)

        # 写入最终输出母带
        os.makedirs(os.path.dirname(output_master_path), exist_ok=True)
        sf.write(output_master_path, master_audio.T, self.sample_rate, subtype='PCM_24')

        final_lufs = calculate_lufs(master_audio, self.sample_rate)
        final_peak = float(20 * np.log10(max(float(np.max(np.abs(master_audio))), 1e-6)))

        return {
            "master_file": output_master_path,
            "sample_rate": self.sample_rate,
            "duration": float(round(max_samples / self.sample_rate, 2)),
            "final_lufs": final_lufs,
            "final_peak_db": float(round(final_peak, 2)),
            "processed_stems": saved_stem_paths
        }
