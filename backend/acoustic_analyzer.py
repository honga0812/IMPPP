import soundfile as sf
import numpy as np
from scipy import signal
import pyloudnorm as pyln
from typing import Dict, Any, Tuple

# 8 声学分析关键频段划分 (Hz)
SPECTRAL_BANDS = {
    "sub_bass": (20, 60),
    "bass": (60, 250),
    "low_mid": (250, 500),
    "mid": (500, 2000),
    "upper_mid": (2000, 4000),
    "presence": (4000, 6000),
    "brilliance": (6000, 12000),
    "air": (12000, 20000)
}

def load_audio_normalized(file_path: str, target_sr: int = 44100) -> Tuple[np.ndarray, int]:
    """读取音频并转换为 [channels, samples] float32 数组，统一为目标采样率"""
    data, sr = sf.read(file_path, dtype='float32')
    # soundfile returns [samples, channels] or [samples]
    if data.ndim == 1:
        data = np.stack([data, data], axis=0) # 转为双声道 [2, samples]
    else:
        data = data.T # [channels, samples]
        if data.shape[0] > 2:
            data = data[:2, :]
        elif data.shape[0] == 1:
            data = np.repeat(data, 2, axis=0)

    # 重采样如果需要
    if sr != target_sr:
        num_target_samples = int(round(data.shape[1] * target_sr / sr))
        resampled_ch0 = signal.resample(data[0], num_target_samples)
        resampled_ch1 = signal.resample(data[1], num_target_samples)
        data = np.stack([resampled_ch0, resampled_ch1], axis=0)
        sr = target_sr

    return data, sr

def calculate_lufs(audio_data: np.ndarray, sr: int) -> float:
    """计算 ITU-R BS.1770-4 标准综合响度 (LUFS)"""
    try:
        # pyloudnorm expects [samples, channels]
        audio_for_meter = audio_data.T
        meter = pyln.Meter(sr)
        loudness = meter.integrated_loudness(audio_for_meter)
        if np.isinf(loudness) or np.isnan(loudness):
            return -70.0
        return float(round(loudness, 2))
    except Exception:
        return -70.0

def calculate_spectral_bands(audio_data: np.ndarray, sr: int) -> Dict[str, float]:
    """通过 Welch 功率谱密度分析 8 频段能量分布 (以相对 dB 呈现)"""
    # 转为单声道混合信号进行频谱计算
    mono = np.mean(audio_data, axis=0)
    
    # 计算功率谱
    freqs, psd = signal.welch(mono, fs=sr, nperseg=min(len(mono), 4096), scaling='spectrum')
    total_energy = np.sum(psd) + 1e-12

    band_energies = {}
    for band_name, (low_f, high_f) in SPECTRAL_BANDS.items():
        mask = (freqs >= low_f) & (freqs <= high_f)
        band_power = np.sum(psd[mask]) if np.any(mask) else 1e-12
        relative_ratio = band_power / total_energy
        # 换算成 dB
        db_val = 10 * np.log10(max(relative_ratio, 1e-6))
        band_energies[band_name] = float(round(db_val, 2))

    return band_energies

def calculate_dynamics_and_stereo(audio_data: np.ndarray) -> Dict[str, float]:
    """计算峰值、RMS、峰均比 (Crest Factor) 及立体声相位相关度与宽度"""
    ch0 = audio_data[0]
    ch1 = audio_data[1]

    # Peak & RMS
    peak = float(np.max(np.abs(audio_data)))
    peak_db = float(20 * np.log10(max(peak, 1e-6)))

    rms = float(np.sqrt(np.mean(audio_data ** 2)))
    rms_db = float(20 * np.log10(max(rms, 1e-6)))

    crest_factor_db = float(round(peak_db - rms_db, 2))

    # Stereo Correlation & Width
    # Pearson correlation coefficient between ch0 and ch1
    denom = (np.std(ch0) * np.std(ch1))
    if denom > 1e-8:
        correlation = float(np.mean((ch0 - np.mean(ch0)) * (ch1 - np.mean(ch1))) / denom)
    else:
        correlation = 1.0
    correlation = float(np.clip(correlation, -1.0, 1.0))

    # Mid / Side energy ratio
    mid = (ch0 + ch1) * 0.5
    side = (ch0 - ch1) * 0.5
    mid_energy = float(np.sum(mid ** 2))
    side_energy = float(np.sum(side ** 2))
    side_to_mid_ratio = float(round(side_energy / (mid_energy + 1e-8), 3))

    return {
        "peak_db": float(round(peak_db, 2)),
        "rms_db": float(round(rms_db, 2)),
        "crest_factor_db": crest_factor_db,
        "stereo_correlation": float(round(correlation, 2)),
        "side_to_mid_ratio": side_to_mid_ratio
    }

def analyze_audio_file(file_path: str) -> Dict[str, Any]:
    """对单音频文件进行全维度声学画像提取"""
    audio_data, sr = load_audio_normalized(file_path)
    duration = float(round(audio_data.shape[1] / sr, 2))
    
    lufs = calculate_lufs(audio_data, sr)
    spectral = calculate_spectral_bands(audio_data, sr)
    dynamics = calculate_dynamics_and_stereo(audio_data)

    return {
        "file_path": file_path,
        "sample_rate": sr,
        "duration_seconds": duration,
        "integrated_lufs": lufs,
        "spectral_bands_db": spectral,
        "dynamics": dynamics
    }
