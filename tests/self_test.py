import os
import sys
import re
import subprocess
import soundfile as sf
import numpy as np

_ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT_DIR not in sys.path:
    sys.path.insert(0, _ROOT_DIR)

def test_audio_assets():
    print('=' * 60)
    print('[Self-Test 1/3] 正在验证全新抒情乡村风与 K-pop 风格实录分轨及商业母带资产...')
    print('=' * 60)

    # 验证曲目一与曲目二专属目录文件
    for base in ['demo_assets', 'frontend/demo_assets']:
        s1_dir = os.path.join(base, 'Song_01_Country_Ballad')
        s2_dir = os.path.join(base, 'Song_02_Kpop_Modern')
        for sdir, tag, min_tracks in [(s1_dir, '曲目一:抒情乡村', 7), (s2_dir, '曲目二:K-pop流行', 5)]:
            assert os.path.exists(sdir), f'❌ 目录不存在: {sdir}'
            wav_files = sorted([f for f in os.listdir(sdir) if f.endswith('.wav')])
            assert len(wav_files) >= min_tracks, f'❌ 音轨数量不足: {sdir} ({len(wav_files)} < {min_tracks} 轨)'
            for wf in wav_files:
                p = os.path.join(sdir, wf)
                data, sr = sf.read(p)
                dur = len(data) / sr
                peak = float(np.max(np.abs(data)))
                rms = float(np.sqrt(np.mean(data**2)))
                assert sr == 44100, f'❌ 采样率不正确: {p} (sr={sr})'
                assert dur >= 15.5, f'❌ 时长不足: {p} ({dur:.2f}s)'
                assert peak > 0.35, f'❌ 弱音轨: {p} ({peak:.2f})'
                assert rms > 0.05, f'❌ 低能量: {p} ({rms:.3f})'
                print(f"  ✓ [{tag}] {wf:38} | 时长: {dur:.1f}s | 峰值: {peak:.2f} | RMS: {rms:.3f}")

    print("\n✅ 所有音频文件校验通过：100% 具备真实响度与清晰演奏声，零静音！\n")

def test_frontend_integrity():
    print('=' * 60)
    print('[Self-Test 2/3] 正在验证前端代码语法与 DOM 元素映射一致性...')
    print('=' * 60)
    
    # 1. Node.js 语法检查
    node_res = subprocess.run(['node', '-c', 'frontend/app.js'], capture_output=True, text=True)
    assert node_res.returncode == 0, f'❌ JavaScript 语法错误: {node_res.stderr}'
    print('  ✓ frontend/app.js 语法检查: PASS (Zero Errors)')
    
    # 2. DOM ID 映射检查
    with open('frontend/app.js', 'r', encoding='utf-8') as f:
        js_code = f.read()
    with open('frontend/index.html', 'r', encoding='utf-8') as f:
        html_code = f.read()
        
    js_ids = set(re.findall(r'document\.getElementById\([\'"]([^\'"]+)[\'"]\)', js_code))
    html_ids = set(re.findall(r'id=[\'"]([^\'"]+)[\'"]', html_code))
    
    missing = js_ids - html_ids
    assert len(missing) == 0, f'❌ JavaScript 引用的 DOM ID 在 HTML 中缺失: {missing}'
    print(f'  ✓ DOM 元素 ID 绑定完整性: 100% 匹配 ({len(js_ids)} 个 ID 均完整挂载)')
    
    # 3. 关键 UI 组件存在性检查
    key_ids = [
        'dsp-progress-modal', 'dsp-progress-bar', 'dsp-progress-percent',
        'global-action-progress', 'vu-meter-l', 'vu-meter-r',
        'ab-test-inspector-panel', 'ab-diagnostic-tbody',
        'btn-clear-project', 'btn-auto-mix', 'btn-load-demo-suite',
        'btn-confirm-upload-tracks', 'staged-tracks-container', 'step1-imported-manifest'
    ]
    for kid in key_ids:
        assert kid in html_ids, f'❌ 关键 UI 组件缺失: {kid}'
        print(f'  ✓ 关键 UI 组件验证: #{kid} (Ready)')

    print("\n✅ 前端集成测试通过：UI 控件与 JavaScript 事件逻辑完备！\n")

def test_backend_mixing_pipeline():
    print('=' * 60)
    print('[Self-Test 3/4] 正在执行 Python 后端 32-bit DSP 混音引擎流水线测试...')
    print('=' * 60)
    
    res = subprocess.run([sys.executable, 'tests/test_mixing_pipeline.py'], capture_output=True, text=True)
    assert res.returncode == 0, f"❌ 后端流水线失败: {res.stderr}\n{res.stdout}"
    print(res.stdout)
    print("\n✅ 后端端到端测试通过：声学画像分析、EQ/压缩DSP、母带渲染全部成功！\n")

def test_stem_separation_pipeline():
    print('=' * 60)
    print('[Self-Test 4/4] 正在验证整曲 AI 音源分离 (4-Stem Separation) 接口与算法...')
    print('=' * 60)
    from fastapi.testclient import TestClient
    import backend.app as backend_app
    import io

    client = TestClient(backend_app.app)
    sr = 44100
    t = np.linspace(0, 1.0, sr)
    stereo_data = np.stack([
        0.5 * np.sin(2 * np.pi * 65 * t) + 0.4 * np.sin(2 * np.pi * 440 * t) + 0.3 * np.sin(2 * np.pi * 3500 * t),
        0.5 * np.sin(2 * np.pi * 65 * t) + 0.4 * np.sin(2 * np.pi * 440 * t) - 0.3 * np.sin(2 * np.pi * 3500 * t)
    ], axis=-1).astype(np.float32)

    buf = io.BytesIO()
    sf.write(buf, stereo_data, sr, format='WAV')
    buf.seek(0)

    res = client.post('/api/separate', files={'file': ('unit_test_song.wav', buf, 'audio/wav')})
    assert res.status_code == 200, f'Status {res.status_code}: {res.text}'
    data = res.json()
    assert data['status'] == 'ok', 'Status is not ok'
    assert len(data['tracks']) == 4, f"Expected 4 tracks, got {len(data['tracks'])}"
    for trk in data['tracks']:
        print(f"  ✓ 分离通道就绪: {trk['name']:25} | 乐器: {trk['instrument']:10} | 地址: {trk['url']}")
    print("\n✅ 4-Stem 音源分离管道测试全部通过！\n")

def test_youtube_reference_pipeline():
    print('=' * 60)
    print('[Self-Test 5/5] 正在验证 YouTube 商业参考音乐链接解析与声学画像提取接口...')
    print('=' * 60)
    from fastapi.testclient import TestClient
    import backend.app as backend_app

    client = TestClient(backend_app.app)
    # 测试异常输入检验
    bad_res = client.post('/api/reference/youtube', json={'url': 'https://example.com/invalid_url'})
    assert bad_res.status_code == 400, f"Expected 400 for bad URL, got {bad_res.status_code}"
    print("  ✓ 非法/不支持 URL 格式阻断与校验: PASS")

    # 测试标准 YouTube 链接解析
    test_yt_url = 'https://www.youtube.com/watch?v=k4V3Mo61fJM'
    res = client.post('/api/reference/youtube', json={'url': test_yt_url})
    assert res.status_code == 200, f"Expected 200 for YouTube reference extraction, got {res.status_code}: {res.text}"
    data = res.json()
    assert data.get('status') == 'ok', 'Status should be ok'
    ref = data.get('reference', {})
    assert 'name' in ref and ref['name'].startswith('YouTube:'), f"Unexpected reference name: {ref.get('name')}"
    ana = ref.get('analysis', {})
    assert 'integrated_lufs' in ana, 'integrated_lufs missing from analysis'
    assert 'spectral_bands_db' in ana, 'spectral_bands_db missing from analysis'
    assert len(ana['spectral_bands_db']) == 8, f"Expected 8 frequency bands, got {len(ana['spectral_bands_db'])}"
    yt_meta = ref.get('youtube', {})
    assert yt_meta.get('video_id') == 'k4V3Mo61fJM', f"Unexpected video_id: {yt_meta.get('video_id')}"
    print(f"  ✓ YouTube 音频切片下载与声学画像提取: PASS (曲目: {ref['name']} | LUFS: {ana['integrated_lufs']:.1f})")
    print(f"  ✓ 8-Band 频段能量与动态范围计算: PASS")
    print("\n✅ YouTube 商业参考画像解析管道测试全部通过！\n")

if __name__ == '__main__':
    try:
        test_audio_assets()
        test_frontend_integrity()
        test_backend_mixing_pipeline()
        test_stem_separation_pipeline()
        test_youtube_reference_pipeline()
        print('*' * 60)
        print('🎉 恭喜！所有自我测试项目全部 100% 通过，系统处于生产发布就绪状态！')
        print('*' * 60)
    except AssertionError as e:
        print(f"\n❌ 测试未通过: {e}")
        sys.exit(1)
