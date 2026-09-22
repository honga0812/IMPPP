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

5. **多版本真实声学 DSP 听觉差异化 (Web Audio Parametric DSP Engine)**：
   - 彻底解决切换不同混音版本比较时听感相同的问题；
   - 运用 Web Audio API 参数化动态滤波与压限链路，`v1`（平衡母带）、`v2`（人声清晰临场 +4.8dB@3.4kHz & +5.2dB 空气感）、`v3`（温暖低频 +5.5dB@85Hz & 808 侧链闪避）、`v4`（35% 宽广立体声场）实时热切，听感差异立竿见影；离线导出 WAV 同步嵌入定制声学画像！

6. **通道条可视化微型 EQ 曲线与动态 GR 增益衰减表 (Mini EQ Curve & Dynamic GR Meter)**：
   - 每个音轨通道条配备高清 Canvas 参量 EQ 频响曲线（`频响分布 20-20k`），直观呈现 HPF 低切与各乐器专属频段雕塑；
   - 配备硬件级动态 LED 增益衰减表 (Gain Reduction)，直观监视压限器与侧链动态避让行程。

7. **移动端深度响应式适配 (Mobile DAW Experience & Responsive Architecture)**：
   - **AI 混音大脑移动端抽屉化 (Mobile Drawer Architecture)**：桌面端常驻专业侧栏，移动端自动切换为全屏滑出式抽屉，带呼吸灯光晕快捷入口，彻底消除窄屏侧栏挤压主屏的问题；
   - **顶部走带控制台紧凑两段化**：首行整合品牌、播放/暂停/停止/归零、LCD 高精度时间码与 AI 入口；次行整合三态监听胶囊与操作菜单，高度由 220px 骤减至约 80px；
   - **五步向导单指横向流畅滑动 (Horizontal Stepper)**：免去纵向多行笨重卡片堆叠，支持单指横向弹性滚动，点击任意步骤平滑定位居中；
   - **单轨通道条紧凑 3 层架构与防溢出排版**：
     - **层 1 (通道头)**：`[CH01] [▶ 独立试听] [乐器图标徽标] [音轨名称] ... [S] [M] [🗑️]`；
     - **层 2 (声学与增益控制条)**：
       - **增益与声相控制模块**：VOL（音量增益）与 PAN（立体声声相）上下独立行排布，配置专属荧光青色 (`#38bdf8`) 与霓虹紫色 (`#c084fc`) 发光滑块，高分辨率防误触，数值百分比独立显示杜绝文字换行；
       - **频率分布与增益衰减模块**：微型 EQ 画布规范为 88px × 28px，清晰展现 20Hz~20kHz 对数频率曲线；与 `GR` 动态压限衰减 LED 严格对齐并排；超窄屏 (< 360px) 自动平铺折叠，100% 杜绝叠字与溢出；
     - **层 3 (全宽波形视窗)**：100% 占据容器宽度，走带黄色游标毫秒级平滑跟随；
   - **移动端常驻底部吸底快捷栏 (Mobile Bottom Action Dock)**：浮动磨砂底栏常驻 `播放/暂停`、`⚡ 一键混音`、`🤖 AI大脑`、`📤 导出`，单手操作如丝般顺滑。

8. **混音版本快照对比 (Mix Snapshots A / B / C)**：
   - 提供快照 A / B / C 零延迟热切按键与键盘快捷键 `1`、`2`、`3`，支持播放中无缝盲听对比；
   - 配备核心声学差异诊断矩阵，清晰量化响度、EQ 雕塑与动态压缩。

9. **YouTube 4 轨音源分离与整曲 AI 拆解 (YouTube 4-Stem Separation)**：
   - 步骤 1 支持直接粘贴任意 YouTube 音乐/MV 链接（或一键填入 Coldplay、Ed Sheeran 等示范），结合 `yt-dlp` 高保真提取与 4-Stem 神经网络相位抵消与多频带滤波算法；
   - 极速拆解为【人声主轨】、【节奏鼓组】、【低音贝斯】与【伴奏乐器】4 条独立音轨并直接载入 DAW 工作台；
   - 同时支持拖入本地立体声音频文件，纯前端与离线模式无缝适配！

10. **YouTube 音乐链接参考解析与商业标杆画像 (YouTube Reference Analyzer)**：
    - 步骤 2 贴心提供 **YouTube 音乐链接解析组件**，支持直接粘贴任何 YouTube 音乐或官方 MV 链接，亦提供 Taylor Swift、NewJeans、Ed Sheeran 等热门商业标杆一键快捷填入；
    - **后端高性能切片**：结合 `yt-dlp` 极速获取高潮乐段音频切片，经 ITU-R BS.1770-4 与 8-Band 滤波器快速解构出真实综合响度 (LUFS)、峰值 dB、动态波峰因数与频段能量分布；
    - **GitHub Pages 纯前端自适应**：支持免安装环境，通过公用 oEmbed 协议极速拉取官方曲名、创作者与高清封面，一键设为混音参考标杆并参与步骤 4 A/B 测试；
    - 彻底打破本地音频文件限制，随时随地以全球流行热歌为混音标杆！

11. **步骤 3 混音定制与进阶声学特效工作区 (Mixing Setup & 6 Advanced FX)**：
    - 位于选择风格后、A/B 盲听前的黄金流程节点（步骤 3）；
    - 支持电脑智能建议混音方式，并提供 6 大专业级进阶特效自由勾选组合：
      1. 🎤 **人声深度质感处理** (Vocal Polish & Air)：增强 3.4kHz 穿透力、11.5kHz 空气感与 De-Esser 齿音抚平；
      2. 🎶 **人声虚拟立体声和声** (Vocal Doubler)：微调和声层拓宽人声厚度；
      3. ✨ **空间氛围与闪烁混响** (Shimmer Reverb & Ping-Pong Delay)：高频空灵混响与立体声延迟；
      4. 💥 **次低频与 808 冲击力** (Sub-Bass & 808 Enhancer)：65Hz 拳拳到肉下潜；
      5. 📼 **复古模拟磁带磁饱和** (Tape Warmth & Glue Comp)：经典偶次谐波暖化与总线胶水；
      6. 🌊 **动态侧链重力抽吸** (Sidechain Ducking & Pumping)：底鼓踩下时对贝斯和伴奏的节奏型避让；
    - 支持自定义版本名称（如“*空间和声特效版*”），一键渲染并加入版本快照历史与 A/B 盲听！

12. **处理后成品分轨导出 (Processed Stems ZIP Export)**：
    - 步骤 5 提供针对当前激活混音版本的 **【导出处理后分轨 (Processed Stems ZIP)】**；
    - 导出的所有分轨音频均包含该版本实际执行的真实 EQ、压缩、声相、空间混响与侧链等 DSP 效果（非原始干声），为母带工程师与协作方交付即插即用的专业分轨；
    - 离线环境通过 Web Audio `OfflineAudioContext` 与 `JSZip` 自动无损渲染打包！

13. **本地音乐生成与重新编曲工作台 (ComfyUI / Stable Audio / MusicGen Prompt Generator)**：
    - 专为 AI 编曲创作者设计，保留当前歌曲的主旋律骨架、节拍 BPM 与调性 Key；
    - 智能提取并生成 16 小节结构（Intro / Verse / Chorus / Outro）与和弦进行模式；
    - 预置 **民谣指弹 (Folk)**、**80s 复古浪潮 (Synthwave)**、**Lo-Fi 氛围 (Chillout)**、**赛博朋克工业摇滚 (Cyberpunk)**、**宏大交响乐 (Cinematic)** 5 种风格；
    - 一键复制结构化 Prompt（含 Positive / Negative Prompt、旋律保留指示），直接粘贴至本地 **ComfyUI (Stable Audio / MusicGen / DiffRhythm)** 工作流进行全新编曲生成！

14. **全自动质量自测套件 (`tests/self_test.py`)**：
    - 自动化音频资产零静音/高能量校验；
    - 前端 JavaScript 语法与 164 处 DOM 挂载 100% 完整性校验；
    - 后端 32-bit DSP 完整混音流水线端到端验证；
    - 4-Stem 音源分离管道自动化校验；
    - YouTube 商业参考画像解析管道端到端校验；
    - YouTube 4-Stem 音源分离、进阶声学特效与处理后分轨导出端到端测试。

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

### 方式三：GitHub Pages 在线交互体验 (纯前端免安装)
无需安装任何环境，直接在浏览器中打开：
- 👉 **https://honga0812.github.io/IMPPP/** （自动重定向进入）
- 👉 **https://honga0812.github.io/IMPPP/frontend/** （直达工作台主页面）

---

## 🎧 体验试用指南

1. **导入音频分轨 (步骤 1)**：
   - **方式 A：载入官方实录示范曲目**：选择 **🌾 抒情乡村风** 或 **⚡ K-pop流行音乐风格**，点击【确认导入所选示范曲分轨】；
   - **方式 B：导入自备多轨音频 (Local Stems)**：拖拽自备分轨文件，确认乐器声部后点击【🚀 确认上传并导入工程】；
   - **方式 C：粘贴 YouTube 链接 4 轨分离**：在输入框贴入 YouTube 视频链接或点击示范曲，点击【提取分离】，系统将歌曲自动拆解为人声、鼓组、贝斯与伴奏 4 轨并载入工程！
2. **商业参考标杆与 YouTube 解析 (步骤 2)**：
   - 可选用经典商业风格预置或粘贴 YouTube 音乐链接建立 8 频段能量画像与综合响度基准。
3. **AI 智能混音定制与进阶特效 (步骤 3)**：
   - 自由勾选人声深度质感、虚拟和声层、空间闪烁混响、次低频 808 冲击、复古磁带饱和、动态抽吸侧链；
   - 自定义新版本名称，点击【⚡ 执行混音并生成新版本】，立即渲染并自动跳转至步骤 4！
4. **A/B 盲听与声学数据诊断 (步骤 4)**：
   - 随时切换快照 A / B / C 或多版本快照，无缝盲听比对；
   - 查看各分轨实际执行的 HPF、EQ、压缩比与侧链参数表。
5. **版本快照历史、处理后分轨导出与 ComfyUI 编曲 (步骤 5)**：
   - 点击【导出当前版本母带 WAV】下载 24-bit PCM 母带；
   - 点击【导出处理后分轨 (Processed Stems ZIP)】下载包含独立 DSP 效果的完整分轨包；
   - 选用编曲风格预置，一键复制 ComfyUI 提示词到本地音乐生成模型重新编曲！

---

## 🧪 运行自我测试

在项目根目录下运行：
```bash
.venv/bin/python tests/self_test.py
```
- 全部 6 个测试模块（音频质量、前端 DOM/JS 一致性、后端 DSP 混音渲染、4-Stem 分离、YouTube 商业标杆解析、进阶特效定制与处理后分轨导出）均应输出 `100% 通过`。

