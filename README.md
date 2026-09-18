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

9. **客户端立体声整曲 AI 音源分离 (In-Browser 4-Stem Spleeter)**：
   - 选取任意单首完整歌曲，无需多轨工程！系统在客户端利用中置相位提取与频带滤波直接分解为【人声】、【鼓组】、【贝斯】与【伴奏】4 轨挂载进 DAW 多轨机架！

10. **YouTube 音乐链接参考解析与商业标杆画像 (YouTube Reference Analyzer)**：
    - 步骤 2 贴心提供 **YouTube 音乐链接解析组件**，支持直接粘贴任何 YouTube 音乐或官方 MV 链接，亦提供 Taylor Swift、NewJeans、Ed Sheeran 等热门商业标杆一键快捷填入；
    - **后端高性能切片**：结合 `yt-dlp` 极速获取高潮乐段音频切片，经 ITU-R BS.1770-4 与 8-Band 滤波器快速解构出真实综合响度 (LUFS)、峰值 dB、动态波峰因数与频段能量分布；
    - **GitHub Pages 纯前端自适应**：支持免安装环境，通过公用 oEmbed 协议极速拉取官方曲名、创作者与高清封面，一键设为混音参考标杆并参与步骤 4 A/B 测试；
    - 彻底打破本地音频文件限制，随时随地以全球流行热歌为混音标杆！

11. **全自动质量自测套件 (`tests/self_test.py`)**：
    - 自动化音频资产零静音/高能量校验；
    - 前端 JavaScript 语法与 144 处 DOM 挂载 100% 完整性校验；
    - 后端 32-bit DSP 完整混音流水线端到端验证；
    - 4-Stem 音源分离管道自动化校验；
    - YouTube 商业参考画像解析管道端到端校验。

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

1. **导入音频分轨 (步骤 1)**：
   - **方式 A：载入官方实录示范曲目**：
     - 在【官方实录示范曲目】下拉框选择 **🌾 抒情乡村风** 或 **⚡ K-pop流行音乐风格**；
     - 实时预览该曲目包含的完整 6 轨/4 轨分轨构成与商业参考标杆；
     - 点击 **【确认导入所选示范曲分轨】**，系统即刻载入全部真实乐器分轨，并在步骤 1 与主工作台就绪。
   - **方式 B：导入自备多轨音频 (Local Stems)**：
     - 点击或批量拖拽自备音频文件（WAV / MP3 / FLAC / AAC 等）至上传区域；
     - 系统自动展开 **【待确认上传分轨清单】**，智能推测并标注乐器声部（人声主唱、木吉他、贝斯、鼓组等，支持手动下拉修改）；
     - 点击显眼的 **【🚀 确认上传并导入工程 (Confirm Upload)】** 按键，进度条解析完成后即刻完成导入，杜绝隐式静默操作！
2. **步骤 1 导入总览与单独试听**：
   - 导入后，步骤 1 内直接呈现 **【当前工程已就绪分轨清单 (Manifest)】**，可直接点击单轨试听按键预览；
   - 点击 **【下一步：商业风格参考画像 ➔】** 顺畅进入风格对齐。
3. **主工作台多轨通道控制**：
   - 下方常驻多轨控制台实时绘制真实音频高密度包络波形；
   - 点击任一音轨的试听按键单独试听，或调节推子音量、声相、S(独奏)与 M(静音)。
4. **一键参考混音与多版本管理**：
   - 点击顶部紫色 **【一键参考混音】** 按钮，系统展示 DSP 进度条并在秒级内完成高通滤波、动态压限、频响塑形与母带胶水压缩；
   - 自动生成并归档版本（如 `v1 基准`）；在右侧 AI 混音大脑输入建议（如“*人声更贴耳更有空气感*”）即刻生成 `v2` 新版本；
   - 随时在常驻控制台顶部的版本药丸栏（`v1`, `v2`...）进行 1 键瞬时无缝 A/B 听感切换！

---

## 🧪 运行自我测试

在项目根目录下运行：
```bash
.venv/bin/python tests/self_test.py
```
- 全部 5 个测试模块（音频质量、前端 DOM/JS 一致性、后端 DSP 混音渲染、4-Stem 分离、YouTube 商业标杆解析）均应输出 `100% 通过`。
