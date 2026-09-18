# Smart Mixing Studio (AI 智能多轨混音工作站)

[![GitHub Pages](https://img.shields.io/badge/Demo-GitHub%20Pages-blue?style=flat-square&logo=github)](https://honga0812.github.io/IMPPP/)
[![Python 3.10+](https://img.shields.io/badge/Python-3.10%2B-green.svg?style=flat-square&logo=python)](https://www.python.org/)
[![Pedalboard DSP](https://img.shields.io/badge/DSP-Spotify%20Pedalboard-orange.svg?style=flat-square)](https://github.com/spotify/pedalboard)

基于 **Spotify Pedalboard 32-bit 浮点高性能 DSP 引擎** 与 **AI 混音决策大脑 (Mixing Copilot)** 构建的专业级智能多轨参考混音工作站。支持本地全功能后端流水线与 GitHub Pages 纯前端沉浸式交互双模式。

---

## 🌟 核心特色与架构重构

1. **核心多轨工作台永久常驻可见 (Permanent Multitrack Studio Console)**：
   - 彻底解决切步骤导致分轨消失的痛点，DAW 录音室多轨通道条、波形、推子、声相、Solo/Mute 永久置于中心可见；
   - 顶部提供可随时折叠/展开的五步引导式工具箱（工程导入、风格画像、参数机架、A/B诊断、多版本历史）；
   - 在任何步骤与工具面板下，均可随时走带监听、调节通道参数与查看波形。

2. **AI 混音大脑多版本快照与历史比对 (Mix Versions & Snapshot History)**：
   - 系统自动记录每一次【一键参考混音】及向 AI 混音大脑提出的自然语言调音指令（如“*人声更贴耳更有空气感*”、“*低频更温暖更饱满*”、“*拓宽立体声场*”）；
   - 自动生成并归档独立版本（`v1: 官方AI基准`、`v2: 人声贴耳空气感版`、`v3: 温暖低频增强版`...）；
   - 顶部配备版本快速切换胶囊栏与专属版本历史管理面板，支持一键热切、试听与多版本 A/B 盲听对比！

3. **100% 同一乐段和谐实录示范分轨 (100% Cohesive & Harmonious Stems)**：
   - **🌾 曲目一：抒情乡村风《Country Ballad》** (`Song_01_Country_Ballad`)
     - 全部 6 轨来自同一完整乐段实录（同调性、同节拍、同和弦进程），完美融合：
     - `01_Country_Lead_Vocal.wav`：真实乡村男声实录主唱
     - `02_Acoustic_Guitar_Fingerpicking.wav`：纯正指弹木吉他颗粒分解
     - `03_Acoustic_Guitar_Strum.wav`：温暖开阔原声扫弦木吉他
     - `04_Country_Brushes_Drums.wav`：经典乡村刷鼓打击组
     - `05_Country_Bass.wav`：温暖扎实原声低音贝斯
     - `06_Country_Fiddle_Acoustic.wav`：悠扬原声小提琴弦乐高频
     - `Reference_Country_Ballad_Master.wav`：商业母带参考标杆
   - **⚡ 曲目二：K-pop流行音乐风格《K-Pop Modern Pop》** (`Song_02_Kpop_Modern`)
     - `01_Kpop_Lead_Vocal.wav`：高穿透力与现代贴耳感 K-Pop 女声主唱
     - `02_Kpop_Electronic_Drums.wav`：现代电子舞曲打击鼓组
     - `03_Kpop_808_Bass.wav`：下潜深邃、动态紧凑平直的 808 超重低音
     - `04_Kpop_Synth_Lead_Hook.wav`：立体声扩散洗脑电音合成器 Lead Hook
     - `Reference_Kpop_Master.wav`：顶级商业 K-Pop 母带标杆

4. **真实专业 DAW 音乐波形可视化 (Canvas Real Waveform Engine)**：
   - 采用 280 像素高密度采样真实解码音频 ArrayBuffer，呈现正负包络峰值与 RMS 能量阴影；
   - 走带指针毫秒级联动，单轨与全轨同步。

5. **全自动质量自测套件 (`tests/self_test.py`)**：
   - 自动化音频资产零静音/高能量校验；
   - 前端 JavaScript 语法与 60+ 处 DOM 挂载完整性校验；
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
