import os
import sys

# 添加 backend 到搜索路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from acoustic_analyzer import analyze_audio_file
from mixer_engine import MixingEngine
from llm_copilot import MixingCopilot
from generate_demo_assets import generate_demo_stems

def test_full_mixing_pipeline():
    test_dir = os.path.join(os.path.dirname(__file__), "test_workspace")
    os.makedirs(test_dir, exist_ok=True)
    
    # 1. 生成测试音频资产
    demo_audio_dir = os.path.join(test_dir, "stems")
    generate_demo_stems(demo_audio_dir)

    ref_path = os.path.join(demo_audio_dir, "Commercial_Reference.wav")
    assert os.path.exists(ref_path), "Reference file must exist"

    # 2. 测试声学画像提取 (Acoustic Analyzer)
    print("\n[Step 1] 测试参考曲声学画像提取...")
    ref_analysis = analyze_audio_file(ref_path)
    print(f"-> 综合响度 LUFS: {ref_analysis['integrated_lufs']}")
    print(f"-> 8 频段能量: {ref_analysis['spectral_bands_db']}")
    print(f"-> 动态与立体声: {ref_analysis['dynamics']}")
    assert ref_analysis["integrated_lufs"] > -70.0, "LUFS must be calculated"
    assert "air" in ref_analysis["spectral_bands_db"]

    # 3. 测试策略生成 (Mixing Copilot)
    print("\n[Step 2] 测试混音决策大脑 (LLM / 专家规则)...")
    copilot = MixingCopilot()
    tracks_data = [
        {"id": "trk_1", "name": "01_Drums", "file_path": os.path.join(demo_audio_dir, "01_Drums.wav"), "volume": 1.0, "pan": 0.0},
        {"id": "trk_2", "name": "02_Bass", "file_path": os.path.join(demo_audio_dir, "02_Bass.wav"), "volume": 1.0, "pan": 0.0},
        {"id": "trk_3", "name": "03_Keys", "file_path": os.path.join(demo_audio_dir, "03_Keys.wav"), "volume": 1.0, "pan": 0.0},
        {"id": "trk_4", "name": "04_Lead_Vocal", "file_path": os.path.join(demo_audio_dir, "04_Lead_Vocal.wav"), "volume": 1.0, "pan": 0.0}
    ]
    strategy = copilot.generate_mix_strategy(tracks_data, ref_analysis)
    print(f"-> 生成决策说明: {strategy['explanation_for_user']}")
    print(f"-> 分轨操作数量: {len(strategy['track_actions'])}")
    assert len(strategy["track_actions"]) == 4

    # 4. 测试 DSP 混音与母带化渲染 (Mixing Engine)
    print("\n[Step 3] 测试 DSP 混音与母带渲染...")
    mixer = MixingEngine(sample_rate=44100)
    master_out = os.path.join(test_dir, "output_master.wav")
    stems_out_dir = os.path.join(test_dir, "processed_stems")
    mix_res = mixer.mix_and_master(
        tracks_data=tracks_data,
        strategy=strategy,
        output_master_path=master_out,
        export_stems_dir=stems_out_dir
    )
    print(f"-> 母带生成完成: {mix_res['master_file']}")
    print(f"-> 最终成品响度: {mix_res['final_lufs']} LUFS, 峰值: {mix_res['final_peak_db']} dB")
    print(f"-> 独立处理后分轨: {list(mix_res['processed_stems'].keys())}")
    assert os.path.exists(master_out), "Master WAV must be created"
    assert len(mix_res["processed_stems"]) == 4

    # 5. 测试自然语言对话微调 (Chat & Adjust)
    print("\n[Step 4] 测试自然语言对话意图解析与重混音...")
    chat_cmd = "人声更贴耳、更有空气感，另外整体声音要更温暖一些"
    updated_strat = copilot.chat_and_adjust_strategy(strategy, chat_cmd, tracks_data)
    print(f"-> 对话响应: {updated_strat['explanation_for_user']}")

    re_mix_res = mixer.mix_and_master(
        tracks_data=tracks_data,
        strategy=updated_strat,
        output_master_path=master_out
    )
    print(f"-> 微调后响度: {re_mix_res['final_lufs']} LUFS")

    print("\n✅ 所有端到端测试均成功通过！")

if __name__ == "__main__":
    test_full_mixing_pipeline()
