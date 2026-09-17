# Smart Mixing Studio (智能参考混音工作站) - Phase 1 MVP

基于 **Spotify Pedalboard 高性能 DSP 引擎** 与 **LLM 混音决策大脑 (Mixing Copilot)** 构建的专业级智能多轨参考混音工作站。

---

## 🌟 核心特色与功能

1. **多轨工作台 (Multitrack Studio)**：
   - 支持批量拖拽导入人声（Vocal）、鼓组（Drums）、贝斯（Bass）、键盘（Keys）、吉他（Guitar）等各种分轨音频。
   - 每轨独立提供：**独奏 (Solo)**、**静音 (Mute)**、**音量推子 (Volume)**、**立体声声相 (Pan)**、**实时波形可视化**。
   - Web Audio API 多轨毫秒级同步走带与播放控制。

2. **参考曲声学画像解构 (Acoustic Reference Analyzer)**：
   - 导入任意商业参考音频（Commercial Reference Track）。
   - 自动提取：**ITU-R BS.1770-4 国际标准综合响度 (LUFS)**、**真实峰值 (True Peak)**、**8 频段能量分布 (Sub-bass 到 Air 频段)**、**动态范围 (Crest Factor)** 与 **立体声场相关度**。

3. **双模式 LLM 混音决策大脑 (Mixing Copilot)**：
   - **离线专家引擎 (默认)**：内置资深混音师启发式声学规则，无需任何 API Key，开箱即用。
   - **大模型驱动 (可选)**：支持一键接入 OpenAI (GPT-4o)、Anthropic (Claude 3.5 Sonnet)、Google Gemini 或本地 **Ollama** (Qwen 2.5 / Llama 3)。
   - **自然语言对话调音 (Natural Language Mixing)**：直接用日常口语描述需求（例如：“*副歌人声更贴耳更有空气感*”、“*中低频太闷了，消除浑浊*”、“*拓宽立体声场*”），AI 自动将主观感受转换为精准 DSP 动作并毫秒级重渲染。

4. **专业 DSP 处理链路 (Pedalboard / SciPy)**：
   - 自动增益平整（Gain Staging，杜绝爆音失真）。
   - 智能高通滤波（High-pass Filter）滤除 80Hz 以下无用泥泞隆隆声。
   - 参量 Match EQ 频响对齐与中频人声避让。
   - 模拟总线胶水压缩（Glue Compressor）。
   - True-Peak 防削波母带压限器，达到商业流媒体响度（如 -14 ~ -9 LUFS）。

5. **A/B 盲听对比与无损导出**：
   - 支持在 **「原分轨合流 (Raw)」**、**「AI 混音版 (AI Mix)」**、**「商业参考曲 (Reference)」** 之间无缝切换试听对比。
   - 一键导出 **24-bit 无损母带 WAV**。
   - 一键导出 **处理后的全部纯净独立分轨 ZIP 包 (Processed Stems)**。

---

## 🚀 极速启动指南

### 方式一：一键启动脚本 (推荐)
打开终端，在项目根目录下运行：
```bash
./start.sh
```

### 方式二：手动启动
```bash
source .venv/bin/activate
uvicorn backend.app:app --host 0.0.0.0 --port 8000
```

服务启动后，在浏览器访问：
👉 **http://127.0.0.1:8000**

---

## 🎧 体验试用指南（含预置演示素材）

项目中已预置了一套用于快速体验的合成音乐分轨素材（位于 `./demo_assets/` 目录）：
- `01_Drums.wav`（鼓组分轨）
- `02_Bass.wav`（贝斯分轨）
- `03_Keys.wav`（键盘和弦分轨）
- `04_Lead_Vocal.wav`（主旋律人声分轨）
- `Commercial_Reference.wav`（商业风格参考音频）

### 体验步骤：
1. 打开网页后，将 `01_Drums.wav`, `02_Bass.wav`, `03_Keys.wav`, `04_Lead_Vocal.wav` 一同拖入或点击**「添加分轨」**导入。
2. 将 `Commercial_Reference.wav` 导入到**「风格参考曲」**框中，观察网页上自动展开的 **8 频段声学能量画像** 与 LUFS 指标。
3. 点击顶部蓝紫色的 **「一键参考混音」** 按钮，系统将在 1~2 秒内完成多轨 DSP 处理与母带化。
4. 点击播放按钮，使用顶部的 **「原分轨」/「AI 混音」/「参考曲」** 按钮实时切换，盲听对比混音前后的巨大质感差异！
5. 在右侧 **Mixing Copilot** 面板中，尝试点击快捷指令（如 *“✨ 人声贴耳空气感”*、*“🧹 去浑浊发闷”*）或输入您自己的要求，查看 AI 混音师的解释与实时渲染结果。
6. 点击右上角 **「导出」** 菜单，下载处理后的母带 WAV 或打包的独立分轨 ZIP。
