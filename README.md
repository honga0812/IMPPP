# Smart Mixing Studio (AI 智能多轨混音工作站)

[![GitHub Pages](https://img.shields.io/badge/Demo-GitHub%20Pages-blue?style=flat-square&logo=github)](https://honga0812.github.io/IMPPP/)
[![Python 3.10+](https://img.shields.io/badge/Python-3.10%2B-green.svg?style=flat-square&logo=python)](https://www.python.org/)
[![Pedalboard DSP](https://img.shields.io/badge/DSP-Spotify%20Pedalboard-orange.svg?style=flat-square)](https://github.com/spotify/pedalboard)

基于 **Spotify Pedalboard 32-bit 浮点高性能 DSP 引擎** 与 **AI 混音决策大脑 (Mixing Copilot)** 构建的专业级智能多轨参考混音工作站。支持本地全功能后端流水线与 GitHub Pages 纯前端沉浸式交互双模式。

---

## 🌟 核心特色与更新

1. **干净纯粹的初始工程状态 (Clean Project State)**：
   - 网页打开时不强制预载任何音频，保持初始清爽空白工程；
   - 随时通过下拉菜单选择并载入示范曲目，或拖拽导入自身的录音分轨；
   - 提供随时一键「清除工程」功能，秒级重置全部工作台状态。

2. **两大全新真实实录乐器示范曲库 (按目录独立封装，音色与名称 100% 吻合)**：
   - **🌾 曲目一：抒情乡村风《Country Ballad》** (`Song_01_Country_Ballad`)
     - `01_Country_Lead_Vocal.wav`：温润真实的乡村男声实录主唱
     - `02_Acoustic_Guitar_Fingerpicking.wav`：纯正指弹木吉他分解和弦 (透亮颗粒感)
     - `03_Acoustic_Guitar_Strum.wav`：温暖开阔原声扫弦木吉他 (声场开扬)
     - `04_Country_Brushes_Drums.wav`：乡村轻柔原声刷鼓组 (律动轻盈)
     - `05_Country_Bass.wav`：木质温暖低音电贝斯 (低频地基)
     - `06_Country_Fiddle_Acoustic.wav`：乡村悠扬原声小提琴旋律 (高频亮彩)
     - `Reference_Country_Ballad_Master.wav`：纳什维尔商业母带标杆 (-12.8 LUFS)
   - **⚡ 曲目二：K-pop流行音乐风格《K-Pop Modern Pop》** (`Song_02_Kpop_Modern`)
     - `01_Kpop_Lead_Vocal.wav`：高穿透力与现代贴耳感 K-Pop 女声主唱
     - `02_Kpop_Electronic_Drums.wav`：拳拳到肉的现代电子舞曲打击鼓组
     - `03_Kpop_808_Bass.wav`：下潜深邃、动态紧凑平直的 808 超重低音
     - `04_Kpop_Synth_Lead_Hook.wav`：立体声扩散洗脑电音合成器 Lead Hook
     - `Reference_Kpop_Master.wav`：顶级商业 K-Pop 母带标杆 (-8.5 LUFS 高能动态)

3. **真实专业 DAW 音乐波形可视化 (Canvas Real Waveform Engine)**：
   - 舍弃粗糙伪随机波形，采用 280 像素高密度采样真实解码音频 ArrayBuffer；
   - 精准绘制乐器音轨的正负包络峰值（Peak Envelope）与核心 RMS 能量阴影；
   - 包含走带指针毫秒级同步联动与悬浮高亮反馈。

4. **单轨独立试听与全局走带控制**：
   - 轨道列表中每轨均配备独立的绿色单轨试听按键，无需顶部全混音即可单独鉴赏各乐器真实演奏细节；
   - 包含专业独奏 (Solo)、静音 (Mute)、音量推子 (Volume)、声相定位 (Pan) 与动态电平表联动。

5. **全流程可视化进度与 A/B 深度声学诊断**：
   - 包含全流程进度条与百分比跳动提示，彻底告别无反馈等待；
   - 内置 A/B Test 声学画像诊断台，横向对比【原分轨合流】、【AI 混音母带】与【商业参考曲】在综合响度 (LUFS)、真实峰值 (True Peak)、动态波峰因数 (Crest Factor)、立体声相关度与 8 大频段能量上的具体数值与听感差异。

6. **全自动质量自测套件 (`tests/self_test.py`)**：
   - 自动化音频资产零静音/高能量校验；
   - 前端 JavaScript 语法与 62+ 处 DOM 挂载完整性校验；
   - 后端 32-bit DSP 完整混音流水线端到端验证。

---

## 🚀 极速启动指南

### 方式一：一键启动 (推荐)
打开终端，在项目根目录下运行：
```bash
./start.sh
```

### 方式二：手动激活虚拟环境启动
```bash
source .venv/bin/activate
uvicorn backend.app:app --host 0.0.0.0 --port 8000
```
启动后在浏览器打开：👉 **http://127.0.0.1:8000**

### 方式三：GitHub Pages 在线试用
无需安装任何环境，直接访问：
👉 **https://honga0812.github.io/IMPPP/**

---

## 🎧 体验试用指南

1. **载入示范曲目**：
   - 在左侧【选择示范曲目工程】下拉框中，选择 **🌾 抒情乡村风** 或 **⚡ K-pop流行音乐风格**；
   - 点击 **【载入曲目】**，系统将瞬间载入全部真实乐器分轨并对应就绪商业参考母带。
2. **单独试听各乐器**：
   - 点击任一音轨左侧的绿色独立试听按键，即可单独聆听纯正的指弹木吉他、真声人声或 808 贝斯。
3. **一键参考混音**：
   - 点击顶部紫色 **【一键参考混音】** 按钮，系统展示 DSP 进度条并在 1~2 秒内完成高通滤波、动态压限、频响塑形与母带胶水压缩。
4. **A/B 听感对比与诊断**：
   - 使用顶部 **【原分轨】/【AI 混音】/【参考曲】** 实时无缝切换；
   - 点击 **【A/B 对比声学诊断说明】** 展开查看各项指标的量化改动。
5. **自然语言交互**：
   - 在右侧 Mixing Copilot 中输入口语要求（例如：“*人声更有空气感*”、“*低频更温暖一些*”），AI 即刻重算并微调 DSP 参数。

---

## 🧪 运行自我测试

在项目根目录下运行：
```bash
.venv/bin/python tests/self_test.py
```
全部 3 个测试模块（音频质量、前端 DOM/JS 一致性、后端 DSP 混音渲染）均应输出 `100% 通过`。
