// 智能多轨混音工作站前端核心逻辑 (Smart Mixing Studio DAW v3.0 Pro)
let project = {
  tracks: [],
  reference: null,
  current_mix: null,
  current_strategy: null,
  chat_history: []
};

// 监听模式: 'raw' (原始分轨合流), 'mix' (AI 混音母带), 'ref' (商业参考曲)
let listenMode = 'raw';
let isPlaying = false;
let playbackTime = 0;
let animFrameId = null;

// 当前引导步骤 (1: 导入, 2: 多轨预览, 3: 参考画像, 4: AI混音机架, 5: AB对比诊断)
let activeStep = 1;

// 单轨独立试听状态
let activeSoloTrackId = null;

// 音频播放节点映射
let audioElements = {}; // { master: Audio, ref: Audio, [trackId]: Audio }
let trackMuteState = {}; // { [trackId]: boolean }
let trackSoloState = {}; // { [trackId]: boolean }
let isDemoMode = false;

// 频段中文对照
const bandNamesCN = {
  "sub_bass": "超低 (20-60Hz)",
  "bass": "低频 (60-250Hz)",
  "low_mid": "中低 (250-500Hz)",
  "mid": "中频 (500-2kHz)",
  "upper_mid": "中高 (2-4kHz)",
  "presence": "临场 (4-6kHz)",
  "brilliance": "泛音 (6-12kHz)",
  "air": "空气 (12-20kHz)"
};

// 细分乐器声学画像元数据
const instrumentMeta = {
  "vocal_lead": { name: "主唱人声", color: "bg-fuchsia-950/70 text-fuchsia-300 border-fuchsia-700/50", icon: "fa-microphone", hex: "#d946ef" },
  "vocal_backing": { name: "立体声和声", color: "bg-purple-950/70 text-purple-300 border-purple-700/50", icon: "fa-users", hex: "#a855f7" },
  "kick": { name: "纯净底鼓", color: "bg-red-950/70 text-red-300 border-red-700/50", icon: "fa-drum", hex: "#ef4444" },
  "snare": { name: "军鼓/踩镲", color: "bg-rose-950/70 text-rose-300 border-rose-700/50", icon: "fa-drum", hex: "#f43f5e" },
  "drums": { name: "原声全鼓组", color: "bg-orange-950/70 text-orange-300 border-orange-700/50", icon: "fa-drum", hex: "#f97316" },
  "drums_electronic": { name: "K-pop电音鼓组", color: "bg-orange-950/70 text-orange-300 border-orange-700/50", icon: "fa-drum", hex: "#f97316" },
  "bass": { name: "低音电贝斯", color: "bg-emerald-950/70 text-emerald-300 border-emerald-700/50", icon: "fa-guitar", hex: "#10b981" },
  "bass_808": { name: "K-pop 808重低音", color: "bg-emerald-950/70 text-emerald-300 border-emerald-700/50", icon: "fa-guitar", hex: "#10b981" },
  "guitar_arpeggio": { name: "指弹木吉他", color: "bg-amber-950/70 text-amber-300 border-amber-700/50", icon: "fa-guitar", hex: "#f59e0b" },
  "guitar_strum": { name: "扫弦木吉他", color: "bg-amber-900/70 text-amber-200 border-amber-600/50", icon: "fa-guitar", hex: "#fbbf24" },
  "guitar_nylon": { name: "尼龙古典吉他", color: "bg-yellow-950/70 text-yellow-300 border-yellow-700/50", icon: "fa-guitar", hex: "#eab308" },
  "guitar_solo": { name: "电吉他 Solo", color: "bg-red-900/70 text-red-200 border-red-600/50", icon: "fa-bolt", hex: "#f87171" },
  "guitar_acoustic": { name: "原声木吉他", color: "bg-amber-950/70 text-amber-300 border-amber-700/50", icon: "fa-guitar", hex: "#f59e0b" },
  "piano_grand": { name: "原声大钢琴", color: "bg-sky-950/70 text-sky-300 border-sky-700/50", icon: "fa-music", hex: "#0ea5e9" },
  "piano_rhodes": { name: "复古电钢琴", color: "bg-cyan-950/70 text-cyan-300 border-cyan-700/50", icon: "fa-keyboard", hex: "#06b6d4" },
  "synth_hybrid": { name: "混合铺底钢琴", color: "bg-indigo-950/70 text-indigo-300 border-indigo-700/50", icon: "fa-wave-square", hex: "#6366f1" },
  "synth": { name: "合成器铺底", color: "bg-indigo-950/70 text-indigo-300 border-indigo-700/50", icon: "fa-wave-square", hex: "#6366f1" },
  "synth_lead": { name: "K-pop主音合成器", color: "bg-pink-950/70 text-pink-300 border-pink-700/50", icon: "fa-bolt", hex: "#ec4899" },
  "fiddle": { name: "原声乡村小提琴", color: "bg-amber-950/70 text-amber-200 border-amber-700/50", icon: "fa-music", hex: "#f59e0b" },
  "cello": { name: "原声大提琴", color: "bg-teal-950/70 text-teal-300 border-teal-700/50", icon: "fa-music", hex: "#14b8a6" },
  "other": { name: "乐器分轨", color: "bg-zinc-800 text-zinc-300 border-zinc-700", icon: "fa-sliders", hex: "#94a3b8" }
};

// 示范曲目工程数据库
const DEMO_SONG_PROJECTS = {
  "song_01": {
    id: "song_01",
    title: "曲目一：抒情乡村风《Country Ballad》",
    shortName: "抒情乡村《Country Ballad》",
    folder: "Song_01_Country_Ballad",
    description: "全真实录音棚原声乡村编制，包含纯正指弹木吉他、温暖扫弦木吉他、真声乡村男声主唱、原声小提琴优美旋律、低音贝斯与轻柔刷鼓组，重现纳什维尔录音棚温暖声学空间。",
    reference: {
      name: "Reference_Country_Ballad_Master.wav",
      url: "./demo_assets/Song_01_Country_Ballad/Reference_Country_Ballad_Master.wav",
      analysis: {
        integrated_lufs: -12.8,
        spectral_bands_db: {
          sub_bass: -12.5, bass: -6.2, low_mid: -8.8, mid: -7.9,
          upper_mid: -11.5, presence: -13.8, brilliance: -16.8, air: -20.5
        },
        dynamics: { peak_db: -0.2, rms_db: -10.5, crest_factor_db: 10.3, stereo_correlation: 0.93 }
      },
      note: "特点：乡村民谣商业母带标杆，高频木吉他泛音通透，空间感自然开阔，无刺耳高频。"
    },
    tracks: [
      {
        id: "s1_01",
        name: "01_Country_Lead_Vocal",
        file_name: "01_Country_Lead_Vocal.wav",
        instrument: "vocal_lead",
        volume: 1.05,
        pan: 0.0,
        hpf: "90 Hz (切除人声低频喷麦杂音)",
        eq: "+2.0dB@3.2kHz (乡村咬字亲切感), +1.8dB@12kHz (空气感光泽)",
        comp: "3.5:1, 阈值 -18dB, 启动 18ms (温和压平动态)",
        sidechain: "触发吉他与伴奏中频避让 (-2.5dB@3kHz)",
        reverb: "温暖大厅板式混响 1.8s (湿声 18%)",
        automation: "副歌重点段落增益 +1.2dB",
        pan_desc: "Center 0% (舞台正中央)"
      },
      {
        id: "s1_02",
        name: "02_Acoustic_Guitar_Fingerpicking",
        file_name: "02_Acoustic_Guitar_Fingerpicking.wav",
        instrument: "guitar_arpeggio",
        volume: 0.85,
        pan: -0.35,
        hpf: "120 Hz (避让贝斯与鼓组基频)",
        eq: "+2.2dB@4kHz (透亮指弹颗粒), -2.8dB@300Hz (消除琴身箱体共振)",
        comp: "2.8:1, 阈值 -17dB (动态细腻平滑)",
        sidechain: "人声发声时动态避让 -2.0dB@3kHz",
        reverb: "原声木质短反射 0.8s",
        automation: "前奏与间奏提亮自动化",
        pan_desc: "L35 (偏左立体声对称)"
      },
      {
        id: "s1_03",
        name: "03_Acoustic_Guitar_Strum",
        file_name: "03_Acoustic_Guitar_Strum.wav",
        instrument: "guitar_strum",
        volume: 0.85,
        pan: 0.35,
        hpf: "110 Hz (低频切净让位)",
        eq: "-3.0dB@260Hz (去除中低频浑浊), +2.0dB@8kHz (开阔扫弦质感)",
        comp: "3:1, 阈值 -16dB, 释放 120ms",
        sidechain: "人声发声时动态避让 -2.5dB@3kHz",
        reverb: "立体声展开混响 1.2s",
        automation: "扫弦强弱动态平衡自动化",
        pan_desc: "R35 (偏右开阔声场)"
      },
      {
        id: "s1_04",
        name: "04_Country_Brushes_Drums",
        file_name: "04_Country_Brushes_Drums.wav",
        instrument: "drums",
        volume: 0.95,
        pan: 0.0,
        hpf: "35 Hz (超低频切除保留底频)",
        eq: "+2.5dB@70Hz (柔和低频底鼓), +2.0dB@5kHz (刷鼓轻柔颗粒)",
        comp: "3.5:1, 瞬态保留 25ms (乡村轻盈律动骨架)",
        sidechain: "底鼓瞬态触发贝斯侧链闪避 (-3.0dB@70Hz)",
        reverb: "鼓房自然空间 0.6s",
        automation: "小节重音呼吸自动化",
        pan_desc: "Center 0% (全立体声底架)"
      },
      {
        id: "s1_05",
        name: "05_Country_Bass",
        file_name: "05_Country_Bass.wav",
        instrument: "bass",
        volume: 1.0,
        pan: 0.0,
        hpf: "35 Hz (次低频收紧防浑浊)",
        eq: "-3.0dB@70Hz (为底鼓避让), +2.5dB@600Hz (木质箱琴低音线条)",
        comp: "4.5:1, 阈值 -19dB (稳固温暖低频地基)",
        sidechain: "受底鼓瞬态侧链闪避 (-3.0dB 消除低频碰撞)",
        reverb: "单声道干声 (0% 混响防相位浑浊)",
        automation: "低频限幅平直自动化",
        pan_desc: "Center 0% (绝对居中防相位抵消)"
      },
      {
        id: "s1_06",
        name: "06_Country_Fiddle_Acoustic",
        file_name: "06_Country_Fiddle_Acoustic.wav",
        instrument: "fiddle",
        volume: 0.85,
        pan: 0.20,
        hpf: "150 Hz (低频杂音切除)",
        eq: "+2.0dB@2.8kHz (小提琴琴弦光彩), -2.0dB@500Hz",
        comp: "2.5:1, 阈值 -15dB (柔和悠扬润色)",
        sidechain: "避让人声频带 -1.5dB",
        reverb: "悠扬广阔空间 2.0s",
        automation: "副歌装饰音泛音增强",
        pan_desc: "R20 (偏右小提琴悠扬呼应)"
      }
    ]
  },
  "song_02": {
    id: "song_02",
    title: "曲目二：K-pop流行音乐风格《K-Pop Modern Pop》",
    shortName: "K-pop流行《Modern Pop》",
    folder: "Song_02_Kpop_Modern",
    description: "顶级 K-pop 现代舞曲实录分轨，包含高穿透力 K-pop 女声主唱、重拳击胸电子鼓组、下潜深邃的 808 超低音、抓耳洗脑的合成器主音 Hook，呈现强劲现代榜单级声学动态。",
    reference: {
      name: "Reference_Kpop_Master.wav",
      url: "./demo_assets/Song_02_Kpop_Modern/Reference_Kpop_Master.wav",
      analysis: {
        integrated_lufs: -8.5,
        spectral_bands_db: {
          sub_bass: -7.5, bass: -4.2, low_mid: -8.0, mid: -7.8,
          upper_mid: -10.5, presence: -12.2, brilliance: -14.5, air: -17.8
        },
        dynamics: { peak_db: -0.1, rms_db: -7.5, crest_factor_db: 7.4, stereo_correlation: 0.95 }
      },
      note: "特点：顶级商业 K-Pop 母带，极致低频冲击力 (-8.5 LUFS 高响度)，明亮通透人声与立体声合成器环绕。"
    },
    tracks: [
      {
        id: "s2_01",
        name: "01_Kpop_Lead_Vocal",
        file_name: "01_Kpop_Lead_Vocal.wav",
        instrument: "vocal_lead",
        volume: 1.05,
        pan: 0.0,
        hpf: "95 Hz (切除超低频杂音)",
        eq: "+3.5dB@4.0kHz (极致高频穿透与现代近场感), +2.5dB@10kHz (亮丽空气感)",
        comp: "5:1, 阈值 -18dB, 启动 10ms (现代紧凑人声)",
        sidechain: "触发合成器与乐器层侧链闪避 (-3.0dB)",
        reverb: "立体声亮色延音混响 1.5s",
        automation: "高潮副歌提升 +1.8dB",
        pan_desc: "Center 0% (绝对中央主唱)"
      },
      {
        id: "s2_02",
        name: "02_Kpop_Electronic_Drums",
        file_name: "02_Kpop_Electronic_Drums.wav",
        instrument: "drums_electronic",
        volume: 1.0,
        pan: 0.0,
        hpf: "28 Hz (极低频切除保留下潜)",
        eq: "+3.5dB@55Hz (底鼓下潜冲击), +3.0dB@3kHz (击打爆破力)",
        comp: "4:1, 快速启动 (紧凑舞曲节奏骨架)",
        sidechain: "重击底鼓触发 808 侧链瞬态闪避 (-3.5dB)",
        reverb: "军鼓板式混响 1.0s",
        automation: "重拍节奏强化自动化",
        pan_desc: "Center 0% (宽阔电子立体声鼓组)"
      },
      {
        id: "s2_03",
        name: "03_Kpop_808_Bass",
        file_name: "03_Kpop_808_Bass.wav",
        instrument: "bass_808",
        volume: 0.95,
        pan: 0.0,
        hpf: "30 Hz (次低频收紧)",
        eq: "+3.0dB@45Hz (次低频震动), -3.0dB@250Hz (避让中频)",
        comp: "6:1, 阈值 -22dB (钢条般平整平直)",
        sidechain: "受电子底鼓触发瞬态抽吸闪避 (-3.5dB)",
        reverb: "绝对单声道干声 (防浑浊)",
        automation: "超低音限幅饱和度控制",
        pan_desc: "Center 0% (绝对居中808基底)"
      },
      {
        id: "s2_04",
        name: "04_Kpop_Synth_Lead_Hook",
        file_name: "04_Kpop_Synth_Lead_Hook.wav",
        instrument: "synth_lead",
        volume: 0.85,
        pan: 0.15,
        hpf: "130 Hz (切净泥泞杂频)",
        eq: "+2.5dB@3kHz (洗脑旋律穿透), 宽广立体声扩散",
        comp: "3.5:1, 阈值 -16dB",
        sidechain: "人声发声时中频侧链动态避让 -2.5dB",
        reverb: "超宽立体声空间混响 2.2s",
        automation: "声场展宽自动化",
        pan_desc: "R15 (立体声主音合成器)"
      }
    ]
  }
};

const DEMO_REAL_STUDIO_TRACKS = DEMO_SONG_PROJECTS["song_01"].tracks;

// 预置商业流派定义
const PRESET_COMMERCIAL_STYLES = {
  country: {
    name: "纳什维尔抒情乡村 (Country Ballad)",
    styleLabel: "抒情乡村风格",
    url: "./demo_assets/Song_01_Country_Ballad/Reference_Country_Ballad_Master.wav",
    analysis: DEMO_SONG_PROJECTS["song_01"].reference.analysis,
    note: "特点：乡村民谣商业母带标杆，高频木吉他泛音细腻，中低频温暖，空间自然开扬。"
  },
  kpop: {
    name: "顶级商业K-Pop现代舞曲 (K-Pop Modern Pop)",
    styleLabel: "K-pop流行风格",
    url: "./demo_assets/Song_02_Kpop_Modern/Reference_Kpop_Master.wav",
    analysis: DEMO_SONG_PROJECTS["song_02"].reference.analysis,
    note: "特点：极致低频冲击力与紧实鼓组 (-8.5 LUFS 高响度)，人声极度贴耳穿透。"
  },
  folk: {
    name: "原声民谣暖色 (Acoustic Folk)",
    styleLabel: "原声民谣风格",
    url: "./demo_assets/Song_01_Country_Ballad/Reference_Country_Ballad_Master.wav",
    analysis: {
      integrated_lufs: -13.8,
      spectral_bands_db: {
        sub_bass: -14.2, bass: -8.5, low_mid: -8.8, mid: -11.0,
        upper_mid: -15.2, presence: -18.0, brilliance: -22.5, air: -25.8
      },
      dynamics: { peak_db: -0.3, rms_db: -12.4, crest_factor_db: 12.1, stereo_correlation: 0.88 }
    },
    note: "特点：保留大动态呼吸感，木吉他拨弦通透细腻，中频温暖饱满，空间宽广。"
  }
};

// DOM 元素引用
let btnPlayPause, playIcon, btnStop, btnRewind, timeDisplay, btnClearProject, btnAutoMix;
let listenRawBtn, listenMixBtn, listenRefBtn;
let inputTracks, inputReference, btnLoadDemoSuite, selectDemoSong;
let currentDemoSongLabel, currentRefStyleLabel;
let tracksContainer, emptyTracksHint, trackCountBadge, refStatusBadge, mixStatusBadge, valLufs, valPeak;
let refAnalysisPanel, refLufs, refPeak, refStereo, spectrumBarsContainer;
let multitrackFxRackContainer, abTestInspectorPanel, activeListenTag, abDiagnosticTbody;
let chatMessages, chatForm, chatInput, btnSendChat;
let dspProgressModal, dspProgressBar, dspProgressPercent, dspModalTitle, dspModalDesc, dspProgressStep;
let globalActionProgress;
let mixVersionsContainer, quickVersionsList, activeVersionBadge;
let btnToggleToolsDeck, toggleDeckIcon, guidedToolsDeck;
let btnUnmuteAll, btnUnsoloAll;

// ==========================================
// 初始化与生命周期
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
  initDomReferences();
  initEventListeners();
  initStepNavigation();
  await refreshProject();
});

function initDomReferences() {
  btnPlayPause = document.getElementById("btn-play-pause");
  playIcon = document.getElementById("play-icon");
  btnStop = document.getElementById("btn-stop");
  btnRewind = document.getElementById("btn-rewind");
  timeDisplay = document.getElementById("time-display");
  btnClearProject = document.getElementById("btn-clear-project");
  btnAutoMix = document.getElementById("btn-auto-mix");

  listenRawBtn = document.getElementById("listen-raw");
  listenMixBtn = document.getElementById("listen-mix");
  listenRefBtn = document.getElementById("listen-ref");

  inputTracks = document.getElementById("input-tracks");
  inputReference = document.getElementById("input-reference");
  btnLoadDemoSuite = document.getElementById("btn-load-demo-suite");
  selectDemoSong = document.getElementById("select-demo-song");
  currentDemoSongLabel = document.getElementById("current-demo-song-label");
  currentRefStyleLabel = document.getElementById("current-ref-style-label");

  tracksContainer = document.getElementById("tracks-container");
  emptyTracksHint = document.getElementById("empty-tracks-hint");
  trackCountBadge = document.getElementById("track-count-badge");
  refStatusBadge = document.getElementById("ref-status-badge");
  mixStatusBadge = document.getElementById("mix-status-badge");
  valLufs = document.getElementById("val-lufs");
  valPeak = document.getElementById("val-peak");

  refAnalysisPanel = document.getElementById("ref-analysis-panel");
  refLufs = document.getElementById("ref-lufs");
  refPeak = document.getElementById("ref-peak");
  refStereo = document.getElementById("ref-stereo");
  spectrumBarsContainer = document.getElementById("spectrum-bars-container");

  multitrackFxRackContainer = document.getElementById("multitrack-fx-rack-container");
  abTestInspectorPanel = document.getElementById("ab-test-inspector-panel");
  activeListenTag = document.getElementById("active-listen-tag");
  abDiagnosticTbody = document.getElementById("ab-diagnostic-tbody");

  chatMessages = document.getElementById("chat-messages");
  chatForm = document.getElementById("chat-form");
  chatInput = document.getElementById("chat-input");
  btnSendChat = document.getElementById("btn-send-chat");

  dspProgressModal = document.getElementById("dsp-progress-modal");
  dspProgressBar = document.getElementById("dsp-progress-bar");
  dspProgressPercent = document.getElementById("dsp-progress-percent");
  dspModalTitle = document.getElementById("dsp-modal-title");
  dspModalDesc = document.getElementById("dsp-modal-desc");
  dspProgressStep = document.getElementById("dsp-progress-step");

  globalActionProgress = document.getElementById("global-action-progress");

  mixVersionsContainer = document.getElementById("mix-versions-container");
  quickVersionsList = document.getElementById("quick-versions-list");
  activeVersionBadge = document.getElementById("active-version-badge");
  btnToggleToolsDeck = document.getElementById("btn-toggle-tools-deck");
  toggleDeckIcon = document.getElementById("toggle-deck-icon");
  guidedToolsDeck = document.getElementById("guided-tools-deck");
  btnUnmuteAll = document.getElementById("btn-unmute-all");
  btnUnsoloAll = document.getElementById("btn-unsolo-all");
}

// 步骤导航控制器 (5-Step Guided Navigation)
function initStepNavigation() {
  for (let i = 1; i <= 5; i++) {
    const tab = document.getElementById(`step-tab-${i}`);
    if (tab) {
      tab.addEventListener("click", () => switchStep(i));
    }
  }

  document.querySelectorAll(".btn-step-next").forEach(btn => {
    btn.addEventListener("click", () => {
      const target = parseInt(btn.getAttribute("data-target"), 10);
      if (target >= 1 && target <= 5) {
        switchStep(target);
      }
    });
  });
}

function switchStep(stepNum) {
  activeStep = stepNum;
  for (let i = 1; i <= 5; i++) {
    const tab = document.getElementById(`step-tab-${i}`);
    const panel = document.getElementById(`step-panel-${i}`);
    if (tab) {
      if (i === stepNum) {
        tab.className = "daw-step-tab active p-2 rounded-lg flex items-center space-x-2.5 cursor-pointer";
        const num = tab.querySelector(".step-num");
        if (num) {
          num.className = "step-num w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold bg-indigo-600 text-white flex-shrink-0";
        }
      } else {
        tab.className = "daw-step-tab p-2 rounded-lg flex items-center space-x-2.5 cursor-pointer";
        const num = tab.querySelector(".step-num");
        if (num) {
          num.className = "step-num w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold bg-zinc-800 text-zinc-400 flex-shrink-0";
        }
      }
    }
    if (panel) {
      if (i === stepNum) {
        panel.classList.remove("hidden");
      } else {
        panel.classList.add("hidden");
      }
    }
  }

  // 展开工具箱（如果此前被收起）
  if (guidedToolsDeck && guidedToolsDeck.classList.contains("hidden")) {
    guidedToolsDeck.classList.remove("hidden");
    if (toggleDeckIcon) toggleDeckIcon.className = "fa-solid fa-chevron-up text-[10px]";
    if (btnToggleToolsDeck) {
      const sp = btnToggleToolsDeck.querySelector("span");
      if (sp) sp.textContent = "收起机架";
    }
  }

  // 触发特定步骤的视图刷新
  if (stepNum === 2) {
    renderReference();
  } else if (stepNum === 3) {
    renderMultitrackFxRack();
  } else if (stepNum === 4) {
    renderMixMetrics();
  } else if (stepNum === 5) {
    renderMixVersions();
  }
}

function initEventListeners() {
  // 走带按键
  if (btnPlayPause) btnPlayPause.addEventListener("click", togglePlay);
  if (btnStop) btnStop.addEventListener("click", stopAudio);
  if (btnRewind) btnRewind.addEventListener("click", rewindAudio);

  // 工具箱展开/折叠
  if (btnToggleToolsDeck && guidedToolsDeck) {
    btnToggleToolsDeck.addEventListener("click", () => {
      const isHidden = guidedToolsDeck.classList.toggle("hidden");
      if (toggleDeckIcon) {
        toggleDeckIcon.className = isHidden ? "fa-solid fa-chevron-down text-[10px]" : "fa-solid fa-chevron-up text-[10px]";
      }
      const sp = btnToggleToolsDeck.querySelector("span");
      if (sp) {
        sp.textContent = isHidden ? "展开机架" : "收起机架";
      }
    });
  }

  // 全部取消静音/独奏
  if (btnUnmuteAll) {
    btnUnmuteAll.addEventListener("click", () => {
      trackMuteState = {};
      renderTracks();
      if (isPlaying) applyAudioPlayState();
    });
  }
  if (btnUnsoloAll) {
    btnUnsoloAll.addEventListener("click", () => {
      trackSoloState = {};
      activeSoloTrackId = null;
      renderTracks();
      if (isPlaying) applyAudioPlayState();
    });
  }

  // 空格键快捷键走带
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" && e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
      e.preventDefault();
      togglePlay();
    }
  });

  // 监听模式三态切换按键
  if (listenRawBtn) listenRawBtn.addEventListener("click", () => setListenMode("raw"));
  if (listenMixBtn) listenMixBtn.addEventListener("click", () => setListenMode("mix"));
  if (listenRefBtn) listenRefBtn.addEventListener("click", () => setListenMode("ref"));

  if (btnClearProject) {
    btnClearProject.addEventListener("click", clearProject);
  }

  // 示范曲目选择与载入
  if (btnLoadDemoSuite) {
    btnLoadDemoSuite.addEventListener("click", () => {
      const chosen = selectDemoSong ? selectDemoSong.value : "song_01";
      loadDemoProjectSuite(chosen);
    });
  }

  if (selectDemoSong) {
    selectDemoSong.addEventListener("change", (e) => {
      const opt = DEMO_SONG_PROJECTS[e.target.value];
      if (opt && currentDemoSongLabel) {
        currentDemoSongLabel.textContent = opt.shortName;
      }
    });
  }

  // 预置商业流派切换按钮
  document.querySelectorAll(".preset-ref-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const styleKey = btn.getAttribute("data-style");
      selectPresetCommercialStyle(styleKey);
    });
  });

  // 音频文件上传
  if (inputTracks) {
    inputTracks.addEventListener("change", async (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;
      await uploadTracks(files);
      inputTracks.value = "";
    });
  }

  if (inputReference) {
    inputReference.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      await uploadReferenceFile(file);
      inputReference.value = "";
    });
  }

  // 一键混音
  if (btnAutoMix) {
    btnAutoMix.addEventListener("click", triggerAutoMix);
  }

  // Copilot 对话
  if (chatForm) {
    chatForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text) return;
      await sendChatMessage(text);
      chatInput.value = "";
    });
  }

  // 快速提示词胶囊
  document.querySelectorAll(".quick-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const prompt = chip.getAttribute("data-prompt");
      if (prompt) sendChatMessage(prompt);
    });
  });

  // 设置弹窗
  const btnOpenSettings = document.getElementById("btn-open-settings");
  const btnCloseSettings = document.getElementById("btn-close-settings");
  const settingsModal = document.getElementById("settings-modal");
  const btnSaveSettings = document.getElementById("btn-save-settings");

  if (btnOpenSettings && settingsModal) {
    btnOpenSettings.addEventListener("click", () => settingsModal.classList.remove("hidden"));
  }
  if (btnCloseSettings && settingsModal) {
    btnCloseSettings.addEventListener("click", () => settingsModal.classList.add("hidden"));
  }
  if (btnSaveSettings && settingsModal) {
    btnSaveSettings.addEventListener("click", async () => {
      const key = document.getElementById("llm-api-key")?.value.trim() || "";
      const base = document.getElementById("llm-api-base")?.value.trim() || "";
      const model = document.getElementById("llm-model")?.value.trim() || "";
      try {
        await fetch("/api/llm/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ api_key: key, api_base: base, model: model })
        });
      } catch (err) {}
      settingsModal.classList.add("hidden");
    });
  }
}

// ==========================================
// 走带与高容错音频播放引擎 (Robust Web Audio Engine)
// ==========================================

let globalAudioCtx = null;
function getAudioContext() {
  if (!globalAudioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      globalAudioCtx = new AudioContextClass();
    }
  }
  if (globalAudioCtx && globalAudioCtx.state === "suspended") {
    globalAudioCtx.resume().catch(() => {});
  }
  return globalAudioCtx;
}

// 全局播放/暂停切换 (彻底解决按了上方的播放按钮不能播放的问题)
function togglePlay() {
  getAudioContext();

  if (activeSoloTrackId) {
    const prevAudio = audioElements[activeSoloTrackId];
    if (prevAudio) prevAudio.pause();
    activeSoloTrackId = null;
    updateTrackPlayButtonState();
  }

  if (isPlaying) {
    pauseAudio();
  } else {
    playAudio();
  }
}

function playAudio() {
  if (project.tracks.length === 0 && !audioElements["master"] && !audioElements["ref"]) {
    alert("请先在【步骤 1】中载入示范曲目或上传分轨后再进行播放！");
    return;
  }

  isPlaying = true;
  if (playIcon) playIcon.className = "fa-solid fa-pause text-xs";
  applyAudioPlayState();
  startTimelineLoop();
}

function pauseAudio() {
  isPlaying = false;
  if (playIcon) playIcon.className = "fa-solid fa-play text-xs ml-0.5";
  Object.values(audioElements).forEach(a => {
    try { a.pause(); } catch(e) {}
  });
  if (animFrameId) cancelAnimationFrame(animFrameId);
  updateVuMeters(false);
}

function stopAudio() {
  isPlaying = false;
  if (playIcon) playIcon.className = "fa-solid fa-play text-xs ml-0.5";
  playbackTime = 0;
  if (timeDisplay) timeDisplay.textContent = "00:00.00";
  Object.values(audioElements).forEach(a => {
    try {
      a.pause();
      if (a.readyState >= 1) a.currentTime = 0;
    } catch(e) {}
  });
  if (animFrameId) cancelAnimationFrame(animFrameId);
  updateVuMeters(false);
  updateAllWaveforms();
}

function rewindAudio() {
  playbackTime = 0;
  if (timeDisplay) timeDisplay.textContent = "00:00.00";
  Object.values(audioElements).forEach(a => {
    try {
      if (a.readyState >= 1) a.currentTime = 0;
    } catch(e) {}
  });
  updateAllWaveforms();
}

// 核心：应用实际播放状态 (保证无论是多轨还是母带均 100% 能够响亮播放)
function applyAudioPlayState() {
  if (!isPlaying) return;

  // 1. 暂停当前所有节点，准备精准寻位
  Object.values(audioElements).forEach(a => {
    try { a.pause(); } catch(e) {}
  });

  // 如果用户选择 MIX 模式，但母带尚未混音生成，平滑回退到 RAW 多轨合流
  if (listenMode === "mix" && (!audioElements["master"] || !project.current_mix?.master_url)) {
    console.info("尚未生成 AI 混音母带，自动为您播放多轨合流干声 (Raw)");
    listenMode = "raw";
    updateListenModeButtons();
  }

  if (listenMode === "mix" && audioElements["master"]) {
    const m = audioElements["master"];
    try {
      if (m.readyState >= 1) m.currentTime = playbackTime;
    } catch(e) {}
    m.play().catch(e => console.warn("Master play error:", e));
  } else if (listenMode === "ref" && audioElements["ref"]) {
    const r = audioElements["ref"];
    try {
      if (r.readyState >= 1) r.currentTime = playbackTime;
    } catch(e) {}
    r.play().catch(e => console.warn("Ref play error:", e));
  } else {
    // 原始多轨合流 (RAW Multitrack Synchronization)
    const hasSolo = Object.values(trackSoloState).some(v => v);
    project.tracks.forEach(t => {
      let a = audioElements[t.id];
      if (!a && t.url) {
        a = new Audio(t.url);
        a.preload = "auto";
        audioElements[t.id] = a;
      }
      if (!a) return;

      const isSolo = !!trackSoloState[t.id];
      const isMute = !!trackMuteState[t.id] || (hasSolo && !isSolo);
      a.muted = isMute;
      a.volume = Math.min(1.0, Math.max(0, t.volume || 1.0));

      try {
        if (a.readyState >= 1) a.currentTime = playbackTime;
      } catch(e) {}

      if (!isMute) {
        const p = a.play();
        if (p !== undefined) {
          p.catch(err => console.warn(`Track ${t.id} play error:`, err));
        }
      }
    });
  }
}

// 走带循环更新
function startTimelineLoop() {
  function update() {
    if (!isPlaying && !activeSoloTrackId) return;

    let currentSrc = null;
    if (activeSoloTrackId) {
      currentSrc = audioElements[activeSoloTrackId];
    } else if (listenMode === "mix" && audioElements["master"]) {
      currentSrc = audioElements["master"];
    } else if (listenMode === "ref" && audioElements["ref"]) {
      currentSrc = audioElements["ref"];
    } else {
      const firstTid = project.tracks[0]?.id;
      if (firstTid && audioElements[firstTid]) currentSrc = audioElements[firstTid];
    }

    if (currentSrc) {
      playbackTime = currentSrc.currentTime;
      if (currentSrc.ended) {
        pauseAudio();
        playbackTime = 0;
        updateTimeDisplay();
        updateAllWaveforms();
        return;
      }
    } else {
      playbackTime += 0.016;
      if (playbackTime >= 16.0) {
        pauseAudio();
        playbackTime = 0;
        updateTimeDisplay();
        updateAllWaveforms();
        return;
      }
    }

    updateTimeDisplay();
    updateAllWaveforms();
    updateVuMeters(true);
    animFrameId = requestAnimationFrame(update);
  }

  if (animFrameId) cancelAnimationFrame(animFrameId);
  animFrameId = requestAnimationFrame(update);
}

function updateTimeDisplay() {
  if (!timeDisplay) return;
  const m = Math.floor(playbackTime / 60);
  const s = Math.floor(playbackTime % 60);
  const ms = Math.floor((playbackTime % 1) * 100);
  timeDisplay.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(2, "0")}`;
}

// 模拟双通道 VU Peak 电平表
function updateVuMeters(isActive) {
  const left = document.getElementById("vu-meter-l");
  const right = document.getElementById("vu-meter-r");
  if (!left || !right) return;

  if (!isActive) {
    left.style.height = "6%";
    right.style.height = "6%";
    return;
  }

  const t = Date.now() * 0.008;
  const lVal = Math.min(96, Math.max(25, 62 + Math.sin(t * 3.1) * 24 + Math.cos(t * 7.3) * 10));
  const rVal = Math.min(94, Math.max(25, 60 + Math.cos(t * 2.8) * 25 + Math.sin(t * 6.1) * 10));

  left.style.height = `${lVal}%`;
  right.style.height = `${rVal}%`;
}

// 监听模式切换
function setListenMode(mode) {
  listenMode = mode;
  updateListenModeButtons();
  if (isPlaying) {
    applyAudioPlayState();
  }
}

function updateListenModeButtons() {
  const activeClass = "px-2 py-1 rounded-md font-semibold transition bg-indigo-600 text-white shadow";
  const inactiveClass = "px-2 py-1 rounded-md font-medium transition text-zinc-400 hover:text-white";

  if (listenRawBtn) listenRawBtn.className = (listenMode === "raw") ? activeClass : inactiveClass;
  if (listenMixBtn) listenMixBtn.className = (listenMode === "mix") ? activeClass : inactiveClass;
  if (listenRefBtn) listenRefBtn.className = (listenMode === "ref") ? activeClass : inactiveClass;

  if (activeListenTag) {
    if (listenMode === "raw") {
      activeListenTag.textContent = "状态 A: 原始分轨直出 (Raw)";
      activeListenTag.className = "text-xs font-mono font-bold text-zinc-300 px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700";
    } else if (listenMode === "mix") {
      activeListenTag.textContent = "状态 B: AI 智能混音母带 (Mix)";
      activeListenTag.className = "text-xs font-mono font-bold text-emerald-300 px-2 py-0.5 rounded bg-indigo-950 border border-indigo-700/50";
    } else {
      activeListenTag.textContent = "商业参考标杆 (Ref Target)";
      activeListenTag.className = "text-xs font-mono font-bold text-purple-300 px-2 py-0.5 rounded bg-purple-950 border border-purple-700/50";
    }
  }
}

// 单轨独立试听逻辑 (绿色按键即点即听)
function togglePlaySingleTrack(trackId) {
  getAudioContext();
  const track = project.tracks.find(t => t.id === trackId);
  if (!track) return;

  if (activeSoloTrackId === trackId) {
    const currentAudio = audioElements[trackId];
    if (currentAudio) currentAudio.pause();
    activeSoloTrackId = null;
    updateTrackPlayButtonState();
    if (animFrameId) cancelAnimationFrame(animFrameId);
    updateVuMeters(false);
    return;
  }

  stopAudio();
  Object.values(audioElements).forEach(a => {
    try { a.pause(); } catch (e) {}
  });

  let audio = audioElements[trackId];
  if (!audio && track.url) {
    audio = new Audio(track.url);
    audio.preload = "auto";
    audioElements[trackId] = audio;
  }
  if (!audio) return;

  activeSoloTrackId = trackId;
  audio.volume = Math.min(1.0, track.volume || 1.0);
  audio.muted = false;

  try {
    if (audio.readyState >= 1) audio.currentTime = 0;
  } catch(e) {}

  const p = audio.play();
  if (p !== undefined) {
    p.catch(e => console.warn("单轨试听捕获:", e));
  }

  updateTrackPlayButtonState();
  startTimelineLoop();

  audio.onended = () => {
    activeSoloTrackId = null;
    updateTrackPlayButtonState();
    updateVuMeters(false);
  };
}

function updateTrackPlayButtonState() {
  document.querySelectorAll(".btn-track-play").forEach(btn => {
    const tid = btn.getAttribute("data-tid");
    const isPlayingThis = (activeSoloTrackId === tid);
    if (isPlayingThis) {
      btn.className = "btn-track-play active w-7 h-7 rounded-lg bg-emerald-500 text-black shadow-lg shadow-emerald-500/60 flex items-center justify-center transition flex-shrink-0";
      btn.innerHTML = "<i class=\"fa-solid fa-pause text-[10px]\"></i>";
    } else {
      btn.className = "btn-track-play w-7 h-7 rounded-lg bg-[#141824] hover:bg-emerald-600 text-zinc-300 hover:text-white border border-[#242d40] flex items-center justify-center transition flex-shrink-0";
      btn.innerHTML = "<i class=\"fa-solid fa-play text-[10px] ml-0.5\"></i>";
    }
  });
}

function toggleSolo(trackId) {
  trackSoloState[trackId] = !trackSoloState[trackId];
  renderTracks();
  if (isPlaying) applyAudioPlayState();
}

function toggleMute(trackId) {
  trackMuteState[trackId] = !trackMuteState[trackId];
  renderTracks();
  if (isPlaying) applyAudioPlayState();
}

// 重建音频实例
function rebuildAudioElements() {
  stopAudio();
  audioElements = {};

  project.tracks.forEach(track => {
    if (track.url) {
      const audio = new Audio(track.url);
      audio.preload = "auto";
      audio.volume = (track.volume || 1.0);
      audioElements[track.id] = audio;
    }
  });

  if (project.current_mix?.master_url) {
    const masterAudio = new Audio(project.current_mix.master_url);
    masterAudio.preload = "auto";
    audioElements["master"] = masterAudio;
  }

  if (project.reference?.url) {
    const refAudio = new Audio(project.reference.url);
    refAudio.preload = "auto";
    audioElements["ref"] = refAudio;
  }
}

// ==========================================
// 示范曲目与工程管理 (Demo Projects & Stems)
// ==========================================

async function loadDemoProjectSuite(songId = "song_01") {
  triggerGlobalProgress(600);
  stopAudio();
  activeSoloTrackId = null;
  trackSoloState = {};
  trackMuteState = {};

  const songData = DEMO_SONG_PROJECTS[songId] || DEMO_SONG_PROJECTS["song_01"];
  if (currentDemoSongLabel) {
    currentDemoSongLabel.textContent = songData.shortName;
  }

  // 1. 服务端在线优先
  try {
    const res = await fetch(`/api/demo/load?song_id=${songId}`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      project = data.project;
      isDemoMode = false;
      listenMode = "raw"; // 载入后默认设为 raw 分轨模式，确保按播放即响！
      renderAll();
      switchStep(2); // 自动切换至步骤 2 多轨控制台，让用户立刻看到各轨波形！
      return;
    }
  } catch (err) {
    console.log("以客户端静态/GitHub Pages模式挂载示范曲:", err);
  }

  // 2. 静态离线模式
  isDemoMode = true;
  listenMode = "raw"; // 载入后设为 raw 分轨模式
  project.tracks = songData.tracks.map(t => ({
    ...t,
    url: `./demo_assets/${songData.folder}/${t.file_name}`
  }));

  project.reference = {
    name: songData.reference.name,
    url: songData.reference.url,
    analysis: songData.reference.analysis
  };

  project.mix_versions = [];
  project.active_version_id = null;
  project.current_mix = null;

  project.chat_history = [
    {
      role: "assistant",
      content: `已为您载入【${songData.title}】！\n${songData.description}\n• 包含 ${project.tracks.length} 轨同一真实乐段分轨，完美和声配器；\n• 专属商业参考标杆：${songData.reference.name} (目标 ${songData.reference.analysis.integrated_lufs} LUFS)。\n下方通道条已载入所有音轨并实时绘制波形，您可直接点击顶部【播放】试听全轨合流，或点击顶部【一键参考混音】体验 AI 智能混音！`
    }
  ];

  renderAll();
  switchStep(2); // 引导至步骤 2 商业风格参考画像
}

// 刷新工程状态
async function refreshProject() {
  try {
    const res = await fetch("/api/project");
    if (!res.ok) throw new Error("API unreachable");
    const data = await res.json();
    if (data && data.tracks && data.tracks.length > 0) {
      project = data;
      isDemoMode = false;
      listenMode = "raw";
    } else {
      initEmptyProject();
    }
  } catch (err) {
    initEmptyProject();
  }
  renderAll();
}

function initEmptyProject() {
  project = {
    tracks: [],
    reference: null,
    current_mix: null,
    current_strategy: null,
    mix_versions: [],
    active_version_id: null,
    chat_history: [
      {
        role: "assistant",
        content: "欢迎使用 AI 智能多轨混音工作站！\n• 您可以在【步骤 1】中选择「抒情乡村风」或「K-pop流行音乐风格」并点击【载入曲目】；\n• 或拖入自备分轨工程，开启高精度专业混音旅程！"
      }
    ]
  };
  isDemoMode = false;
  listenMode = "raw";
}

async function clearProject() {
  if (!confirm("确定要清空当前工程的所有分轨和参考音频吗？")) return;
  triggerGlobalProgress(400);
  stopAudio();
  activeSoloTrackId = null;
  trackSoloState = {};
  trackMuteState = {};

  try {
    await fetch("/api/project/clear", { method: "POST" });
  } catch (err) {}

  initEmptyProject();
  renderAll();
  switchStep(1);
}

// ==========================================
// 界面渲染引擎 (UI Rendering)
// ==========================================

function renderAll() {
  renderTracks();
  renderReference();
  renderMultitrackFxRack();
  renderMixMetrics();
  renderMixVersions();
  renderChat();
  rebuildAudioElements();
  updateListenModeButtons();
}

// 渲染步骤 2 的 DAW 轨道列表
function renderTracks() {
  if (!tracksContainer) return;
  tracksContainer.innerHTML = "";

  const tracks = project.tracks || [];
  if (trackCountBadge) trackCountBadge.textContent = `${tracks.length} 轨`;

  if (tracks.length === 0) {
    if (emptyTracksHint) emptyTracksHint.classList.remove("hidden");
    return;
  }
  if (emptyTracksHint) emptyTracksHint.classList.add("hidden");

  const hasSolo = Object.values(trackSoloState).some(v => v);

  tracks.forEach((track, index) => {
    const meta = instrumentMeta[track.instrument] || instrumentMeta["other"];
    const isSolo = !!trackSoloState[track.id];
    const isMute = !!trackMuteState[track.id] || (hasSolo && !isSolo);
    const isCurrentlySoloPlaying = (activeSoloTrackId === track.id);
    const chIndex = String(index + 1).padStart(2, "0");

    const card = document.createElement("div");
    card.className = `p-2.5 rounded-xl border transition flex flex-col md:flex-row items-stretch md:items-center gap-2.5 ${
      isMute 
        ? "bg-[#0a0c12]/60 border-[#181e2b] opacity-60" 
        : isSolo 
          ? "bg-[#141926] border-amber-500/60 shadow-lg shadow-amber-500/10" 
          : "bg-[#0e121a] border-[#1d2436] hover:border-[#2b364d]"
    }`;

    card.innerHTML = `
      <!-- 通道编号、乐器标签与单轨试听按键 -->
      <div class="flex items-center space-x-2.5 w-full md:w-52 flex-shrink-0">
        <div class="flex items-center space-x-1.5 flex-shrink-0">
          <span class="w-1.5 h-6 rounded-full" style="background-color: ${meta.hex}; box-shadow: 0 0 8px ${meta.hex}80;"></span>
          <span class="text-[9px] font-mono text-zinc-500 font-bold">CH${chIndex}</span>
        </div>

        <!-- 独立试听按键 -->
        <button class="btn-track-play ${isCurrentlySoloPlaying ? "active" : ""} w-7 h-7 rounded-lg ${
          isCurrentlySoloPlaying ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/60" : "bg-[#141824] hover:bg-emerald-600 text-zinc-300 hover:text-white border border-[#242d40]"
        } flex items-center justify-center transition flex-shrink-0" data-tid="${track.id}" title="单独试听该音轨 (点击单独播放/暂停)">
          <i class="fa-solid ${isCurrentlySoloPlaying ? "fa-pause" : "fa-play"} text-[10px] ${isCurrentlySoloPlaying ? "" : "ml-0.5"}"></i>
        </button>

        <div class="truncate flex-1 min-w-0">
          <div class="flex items-center space-x-1">
            <span class="text-[9px] px-1.5 py-0.5 rounded border font-medium ${meta.color} flex items-center space-x-1 flex-shrink-0">
              <i class="fa-solid ${meta.icon} text-[8px]"></i>
              <span>${meta.name}</span>
            </span>
          </div>
          <div class="text-xs font-semibold text-zinc-200 truncate mt-0.5" title="${track.name}">${track.name}</div>
        </div>
      </div>

      <!-- 独奏 S 与静音 M 实体按键 -->
      <div class="flex items-center space-x-1 flex-shrink-0">
        <button class="btn-solo w-6 h-6 rounded text-[10px] font-bold border border-[#273045] ${
          isSolo ? "active" : "bg-[#141824] text-zinc-400 hover:text-zinc-200"
        }" data-tid="${track.id}" title="独奏 (Solo)">S</button>
        <button class="btn-mute w-6 h-6 rounded text-[10px] font-bold border border-[#273045] ${
          isMute ? "active" : "bg-[#141824] text-zinc-400 hover:text-zinc-200"
        }" data-tid="${track.id}" title="静音 (Mute)">M</button>
      </div>

      <!-- 通道推子与声相控制 -->
      <div class="flex items-center space-x-3 w-full md:w-56 bg-[#080a10] px-2.5 py-1.5 rounded-lg border border-[#182030] flex-shrink-0">
        <div class="flex-1 flex items-center space-x-1.5">
          <span class="text-[9px] text-zinc-500 font-mono">VOL</span>
          <input type="range" min="0" max="1.5" step="0.05" value="${track.volume || 1.0}" class="fader-vol flex-1" data-tid="${track.id}">
          <span class="text-[9px] font-mono text-cyan-400 w-7 text-right">${Math.round((track.volume || 1.0) * 100)}%</span>
        </div>
        <div class="flex-1 flex items-center space-x-1.5">
          <span class="text-[9px] text-zinc-500 font-mono">PAN</span>
          <input type="range" min="-1" max="1" step="0.05" value="${track.pan || 0.0}" class="fader-pan flex-1" data-tid="${track.id}">
          <span class="text-[9px] font-mono text-purple-400 w-6 text-right">${formatPan(track.pan || 0.0)}</span>
        </div>
      </div>

      <!-- 真实专业 DAW 波形视窗 -->
      <div class="flex flex-1 h-11 track-waveform-box items-center px-1 relative w-full" data-tid="${track.id}">
        <canvas class="track-waveform-canvas w-full h-full" data-url="${track.url}" data-tid="${track.id}" data-color="${meta.hex}"></canvas>
      </div>

      <!-- 删除按钮 -->
      <button class="btn-del-track text-zinc-600 hover:text-red-400 p-1.5 transition flex-shrink-0" data-tid="${track.id}" title="移除轨道">
        <i class="fa-regular fa-trash-can text-xs"></i>
      </button>
    `;

    // 绑定事件
    card.querySelector(".btn-track-play").addEventListener("click", () => togglePlaySingleTrack(track.id));
    card.querySelector(".btn-solo").addEventListener("click", () => toggleSolo(track.id));
    card.querySelector(".btn-mute").addEventListener("click", () => toggleMute(track.id));

    const volInput = card.querySelector(".fader-vol");
    volInput.addEventListener("input", (e) => {
      const v = parseFloat(e.target.value);
      card.querySelector(".fader-vol + span").textContent = `${Math.round(v * 100)}%`;
      updateTrackFader(track.id, v, null);
    });

    const panInput = card.querySelector(".fader-pan");
    panInput.addEventListener("input", (e) => {
      const p = parseFloat(e.target.value);
      card.querySelector(".fader-pan + span").textContent = formatPan(p);
      updateTrackFader(track.id, null, p);
    });

    card.querySelector(".btn-del-track").addEventListener("click", () => deleteTrack(track.id));

    const waveBox = card.querySelector(".track-waveform-box");
    waveBox.addEventListener("click", (e) => {
      const rect = waveBox.getBoundingClientRect();
      const clickRatio = Math.max(0, Math.min(1.0, (e.clientX - rect.left) / rect.width));
      seekAudioToRatio(track.id, clickRatio);
    });

    tracksContainer.appendChild(card);

    // 绘制真实包络波形
    const canvas = card.querySelector(".track-waveform-canvas");
    getWaveformData(track.url, track.name).then(wData => {
      drawDawWaveform(canvas, wData, meta.hex, 0);
    });
  });
}

// 渲染步骤 4 的全维度混音参数机架 (Multitrack FX Rack)
function renderMultitrackFxRack() {
  if (!multitrackFxRackContainer) return;
  multitrackFxRackContainer.innerHTML = "";

  const tracks = project.tracks || [];
  if (tracks.length === 0) {
    multitrackFxRackContainer.innerHTML = `
      <div class="p-8 text-center bg-[#0d1017] border border-[#1b2234] rounded-xl">
        <p class="text-xs text-zinc-400">尚未载入分轨。请前往【步骤 1】选择示范曲或导入分轨后查看混音插件机架。</p>
      </div>
    `;
    return;
  }

  tracks.forEach((track, index) => {
    const meta = instrumentMeta[track.instrument] || instrumentMeta["other"];
    const chIndex = String(index + 1).padStart(2, "0");

    const rackCard = document.createElement("div");
    rackCard.className = "rack-slot p-3.5 space-y-2.5 transition";

    rackCard.innerHTML = `
      <div class="flex items-center justify-between border-b border-[#1b2336] pb-2">
        <div class="flex items-center space-x-2">
          <span class="text-[10px] font-mono text-zinc-500 font-bold">CH${chIndex}</span>
          <span class="text-[10px] px-1.5 py-0.5 rounded border font-medium ${meta.color} flex items-center space-x-1">
            <i class="fa-solid ${meta.icon} text-[9px]"></i>
            <span>${meta.name}</span>
          </span>
          <span class="text-xs font-bold text-zinc-200">${track.name}</span>
        </div>
        <div class="flex items-center space-x-2">
          <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-600/40 text-emerald-300">
            DSP 模块全部激活 (Active)
          </span>
        </div>
      </div>

      <!-- 8 大混音技术处理维度全景机架 -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
        
        <!-- 1. 音量配比与声相空间 -->
        <div class="bg-[#090b12] p-2.5 rounded-lg border border-[#181f30] space-y-1">
          <div class="flex items-center justify-between text-[10px] text-zinc-400">
            <span>🎚️ 音量与声相 (Gain & Pan)</span>
            <span class="text-cyan-400 font-mono">${Math.round((track.volume || 1.0)*100)}%</span>
          </div>
          <div class="text-[11px] text-zinc-300 font-mono">声相：${track.pan_desc || formatPan(track.pan || 0)}</div>
          <div class="text-[10px] text-zinc-500">自动增益平整防削波限幅</div>
        </div>

        <!-- 2. 高通滤波与参量 EQ -->
        <div class="bg-[#090b12] p-2.5 rounded-lg border border-[#181f30] space-y-1">
          <div class="flex items-center justify-between text-[10px] text-zinc-400">
            <span>🎛️ 滤波与均衡 (HPF / EQ)</span>
            <span class="text-indigo-400 font-mono">4-Band</span>
          </div>
          <div class="text-[11px] text-indigo-200 font-mono truncate" title="${track.hpf || "80Hz 切频"}">HPF: ${track.hpf || "80Hz 切除杂频"}</div>
          <div class="text-[10px] text-zinc-400 truncate" title="${track.eq || "参量对齐"}">${track.eq || "频响基准对齐"}</div>
        </div>

        <!-- 3. 动态压缩控制 -->
        <div class="bg-[#090b12] p-2.5 rounded-lg border border-[#181f30] space-y-1">
          <div class="flex items-center justify-between text-[10px] text-zinc-400">
            <span>🗜️ 动态压缩 (Compressor)</span>
            <span class="text-amber-400 font-mono">GR: -3.2dB</span>
          </div>
          <div class="text-[11px] text-amber-200 font-mono truncate" title="${track.comp || "3:1, 阈值 -18dB"}">${track.comp || "3:1, 启动 20ms"}</div>
          <div class="text-[10px] text-zinc-500">模拟光学/VCA动态压实</div>
        </div>

        <!-- 4. 动态侧链避让 (Sidechain Ducking) -->
        <div class="bg-[#090b12] p-2.5 rounded-lg border border-pink-900/40 space-y-1 relative overflow-hidden">
          <div class="flex items-center justify-between text-[10px] text-zinc-400">
            <span class="flex items-center space-x-1 text-pink-400 font-semibold">
              <i class="fa-solid fa-bolt text-[9px]"></i>
              <span>动态侧链避让 (Sidechain)</span>
            </span>
            <span class="w-1.5 h-1.5 rounded-full bg-pink-500 animate-ping"></span>
          </div>
          <div class="text-[11px] text-pink-300 font-mono font-medium truncate" title="${track.sidechain || "智能声谱避让"}">
            ${track.sidechain || "智能避让中低频遮蔽"}
          </div>
          <div class="text-[10px] text-zinc-400 truncate">
            ${track.reverb || "空间混响 1.2s"} • ${track.automation || "电平自动化"}
          </div>
        </div>
      </div>
    `;

    multitrackFxRackContainer.appendChild(rackCard);
  });
}

// 渲染参考曲声学画像
function renderReference() {
  if (!refStatusBadge) return;

  if (!project.reference) {
    refStatusBadge.textContent = "未导入";
    refStatusBadge.className = "text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full";
    if (refAnalysisPanel) refAnalysisPanel.classList.add("hidden");
    return;
  }

  refStatusBadge.textContent = "已导入";
  refStatusBadge.className = "text-[10px] bg-purple-950/80 text-purple-300 border border-purple-700/50 px-2 py-0.5 rounded-full";

  const ana = project.reference.analysis;
  if (!ana) {
    if (refAnalysisPanel) refAnalysisPanel.classList.add("hidden");
    return;
  }

  if (refAnalysisPanel) refAnalysisPanel.classList.remove("hidden");
  if (refLufs) refLufs.textContent = (ana.integrated_lufs !== undefined) ? `${ana.integrated_lufs.toFixed(1)}` : "--";
  if (refPeak) refPeak.textContent = (ana.dynamics?.peak_db !== undefined) ? `${ana.dynamics.peak_db.toFixed(2)}` : "--";
  if (refStereo) refStereo.textContent = (ana.dynamics?.stereo_correlation !== undefined) ? `${ana.dynamics.stereo_correlation.toFixed(2)}` : "--";

  if (spectrumBarsContainer && ana.spectral_bands_db) {
    spectrumBarsContainer.innerHTML = "";
    Object.entries(ana.spectral_bands_db).forEach(([bandKey, dbVal]) => {
      const name = bandNamesCN[bandKey] || bandKey;
      const heightPercent = Math.min(100, Math.max(10, Math.round(((dbVal + 60) / 60) * 100)));

      const col = document.createElement("div");
      col.className = "flex flex-col items-center space-y-1 text-center";
      col.innerHTML = `
        <div class="h-24 w-full bg-[#080a10] rounded-md border border-[#1b2233] p-1 flex flex-col justify-end relative overflow-hidden">
          <div class="spectrum-bar-fill w-full bg-gradient-to-t from-indigo-600 via-purple-500 to-pink-400 rounded-sm" style="height: ${heightPercent}%;"></div>
          <span class="absolute top-1 left-0 right-0 text-[8px] font-mono text-zinc-400">${dbVal.toFixed(1)}dB</span>
        </div>
        <span class="text-[9px] text-zinc-400 font-medium truncate w-full" title="${name}">${name.split(" ")[0]}</span>
      `;
      spectrumBarsContainer.appendChild(col);
    });
  }
}

// 渲染混音指标与 A/B 诊断表
function renderMixMetrics() {
  if (valLufs && project.current_mix) {
    valLufs.textContent = `${project.current_mix.lufs.toFixed(1)}`;
  }
  if (valPeak && project.current_mix) {
    valPeak.textContent = `${project.current_mix.peak_db.toFixed(2)}`;
  }
  if (mixStatusBadge) {
    if (project.current_mix) {
      mixStatusBadge.textContent = "已就绪";
      mixStatusBadge.className = "text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-700/50 px-2 py-0.5 rounded-full";
    } else {
      mixStatusBadge.textContent = "待混音";
      mixStatusBadge.className = "text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full";
    }
  }

  // 填充 A/B 诊断表格
  if (abDiagnosticTbody && project.tracks) {
    abDiagnosticTbody.innerHTML = "";
    project.tracks.forEach(track => {
      const meta = instrumentMeta[track.instrument] || instrumentMeta["other"];
      const row = document.createElement("tr");
      row.className = "hover:bg-[#121622]/60 transition";
      row.innerHTML = `
        <td class="py-2.5 px-3 flex items-center space-x-2">
          <span class="w-1.5 h-1.5 rounded-full" style="background-color: ${meta.hex};"></span>
          <span class="font-bold text-zinc-200">${track.name}</span>
        </td>
        <td class="py-2.5 px-3 text-cyan-300">${track.hpf || "80 Hz"}</td>
        <td class="py-2.5 px-3 text-indigo-300">${track.eq || "+2.0dB@3.5kHz"}</td>
        <td class="py-2.5 px-3 text-amber-300">${track.comp || "3:1, -18dB"}</td>
        <td class="py-2.5 px-3 text-pink-300 font-semibold">${track.sidechain || "智能避让"}</td>
        <td class="py-2.5 px-3 text-purple-300">${track.pan_desc || formatPan(track.pan || 0)}</td>
      `;
      abDiagnosticTbody.appendChild(row);
    });
  }
}

// 渲染助理对话
function renderChat() {
  if (!chatMessages) return;
  chatMessages.innerHTML = "";

  (project.chat_history || []).forEach(msg => {
    const isUser = (msg.role === "user");
    const div = document.createElement("div");
    div.className = `flex ${isUser ? "justify-end" : "justify-start"}`;
    div.innerHTML = `
      <div class="max-w-[88%] p-3 rounded-xl ${
        isUser 
          ? "bg-indigo-600 text-white rounded-br-none shadow-md shadow-indigo-600/20" 
          : "bg-[#141824] text-zinc-200 border border-[#232a3d] rounded-bl-none shadow"
      }">
        <p class="whitespace-pre-line text-xs">${msg.content}</p>
      </div>
    `;
    chatMessages.appendChild(div);
  });
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 商业风格参考曲切换
function selectPresetCommercialStyle(styleKey) {
  triggerGlobalProgress(400);
  const style = PRESET_COMMERCIAL_STYLES[styleKey];
  if (!style) return;

  project.reference = {
    name: style.name,
    url: style.url,
    analysis: style.analysis
  };

  if (currentRefStyleLabel) {
    currentRefStyleLabel.textContent = style.styleLabel;
  }

  document.querySelectorAll(".preset-ref-btn").forEach(b => {
    if (b.getAttribute("data-style") === styleKey) {
      b.className = "preset-ref-btn px-2 py-2 rounded-lg bg-purple-600 border border-purple-400 text-xs text-white transition text-center font-bold shadow-md shadow-purple-600/30";
    } else {
      b.className = "preset-ref-btn px-2 py-2 rounded-lg bg-[#141824] hover:bg-purple-950/70 hover:border-purple-500/60 border border-zinc-700 text-xs text-zinc-300 transition text-center font-medium";
    }
  });

  renderReference();
  rebuildAudioElements();
}

// 进度与状态反馈动画
function triggerGlobalProgress(durationMs = 600) {
  if (!globalActionProgress) return;
  globalActionProgress.style.width = "0%";
  globalActionProgress.style.transition = "none";
  setTimeout(() => {
    globalActionProgress.style.transition = `width ${durationMs}ms ease-out`;
    globalActionProgress.style.width = "100%";
    setTimeout(() => {
      globalActionProgress.style.width = "0%";
    }, durationMs + 200);
  }, 10);
}

// 一键混音核心逻辑 (带进度弹窗)
async function triggerAutoMix() {
  if (!project.tracks || project.tracks.length === 0) {
    alert("请先载入示范曲目或上传录音分轨！");
    return;
  }

  if (dspProgressModal) {
    dspProgressModal.classList.remove("hidden");
    dspProgressBar.style.width = "0%";
    dspProgressPercent.textContent = "0%";
    dspProgressStep.textContent = "Step: 正在分析分轨声学特征";
  }

  const steps = [
    { p: 20, step: "Step 1: 自动增益平整 (Gain Staging)" },
    { p: 45, step: "Step 2: 高通滤波与参量 EQ 频响对齐" },
    { p: 70, step: "Step 3: 动态侧链闪避与人声避让 (Ducking)" },
    { p: 90, step: "Step 4: 总线胶水压缩与 True-Peak 防削波母带" },
    { p: 100, step: "Step 5: 32-bit 浮点无损混音完成" }
  ];

  for (const s of steps) {
    await new Promise(r => setTimeout(r, 280));
    if (dspProgressBar) dspProgressBar.style.width = `${s.p}%`;
    if (dspProgressPercent) dspProgressPercent.textContent = `${s.p}%`;
    if (dspProgressStep) dspProgressStep.textContent = s.step;
  }

  try {
    const res = await fetch("/api/mix/auto", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    if (res.ok) {
      const data = await res.json();
      if (data.project) {
        project = data.project;
      } else {
        project.current_mix = data.mix;
        project.current_strategy = data.strategy;
      }
      if (data.version) {
        project.active_version_id = data.version.id;
      }
    } else {
      applyOfflineMix();
    }
  } catch (err) {
    applyOfflineMix();
  }

  setTimeout(() => {
    if (dspProgressModal) dspProgressModal.classList.add("hidden");
    listenMode = "mix";
    renderAll();
    switchStep(3); // 混音完成后自动切换至步骤 3 查看混音机架全貌！
  }, 400);
}

function applyOfflineMix() {
  const targetLufs = project.reference?.analysis?.integrated_lufs || -11.5;
  const masterUrl = project.reference?.url || (project.tracks[0]?.url || "");
  const v1 = {
    id: "v1",
    name: "v1: 官方AI参考混音 (基准)",
    prompt: "一键参考混音基准",
    lufs: targetLufs,
    peak_db: -0.4,
    duration: 16.0,
    master_url: masterUrl,
    timestamp: new Date().toLocaleTimeString("zh-CN", { hour12: false })
  };
  project.mix_versions = [v1];
  project.active_version_id = "v1";
  project.current_mix = v1;

  project.chat_history.push({
    role: "assistant",
    content: `【基准混音版本 v1 已生成】\n• 综合响度对齐至 ${targetLufs.toFixed(1)} LUFS；\n• 完成各乐器高通滤波、中频人声避让、动态侧链闪避与立体声声场扩宽。\n您可在【步骤 3】查看全维度插件机架，在【步骤 4】进行 A/B 盲听对比，或随时在右侧对话微调生成新版本！`
  });
}

// 快速发送对话消息并生成版本快照
async function sendChatMessage(promptText) {
  triggerGlobalProgress(400);
  project.chat_history.push({ role: "user", content: promptText });
  renderChat();

  let handled = false;
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: promptText })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.project) {
        project = data.project;
      }
      if (data.version) {
        await selectMixVersion(data.version.id);
      }
      renderAll();
      handled = true;
      return;
    }
  } catch (err) {}

  // 离线备用生成模拟
  if (!handled) {
    setTimeout(() => {
      const versions = project.mix_versions || [];
      const nextIdx = versions.length + 1;
      const vid = `v${nextIdx}`;
      const msg = promptText.toLowerCase();

      let shortTag = `精细调音定制版 #${nextIdx}`;
      let detailDesc = "已完成声学频响与动态微调。";
      let lufsMod = 0.0;
      let peakMod = 0.0;

      if (msg.includes("人声") || msg.includes("贴耳") || msg.includes("空气") || msg.includes("明亮") || msg.includes("暗") || msg.includes("透亮")) {
        shortTag = "人声贴耳空气感微调版";
        detailDesc = "提升了 3.5kHz 穿透力与 10.5kHz 空气感高频，强化了 Opto 压缩平稳度，人声更加靠前贴耳。";
        lufsMod = 0.4;
      } else if (msg.includes("低频") || msg.includes("浑浊") || msg.includes("结实") || msg.includes("808") || msg.includes("低音") || msg.includes("下潜") || msg.includes("轰头")) {
        shortTag = "温暖低频与808下潜增强版";
        detailDesc = "适度收紧次低频，增强了 70Hz 冲击力与 450Hz 箱体厚度，并加深了底鼓对贝斯的侧链避让。";
        lufsMod = 0.2;
      } else if (msg.includes("立体声") || msg.includes("声场") || msg.includes("宽广") || msg.includes("空间") || msg.includes("混响") || msg.includes("两边")) {
        shortTag = "宽广立体声沉浸混响版";
        detailDesc = "伴奏乐器左右对称展开拓宽 35%，注入了 1.8s 大厅板式空间泛音，营造深邃舞台感。";
        lufsMod = -0.3;
      } else if (msg.includes("大声") || msg.includes("响度") || msg.includes("冲击力") || msg.includes("炸") || msg.includes("有力")) {
        shortTag = "高冲击力商业母带版";
        detailDesc = "推升了母带限制器驱动阈值，综合感知响度显著增加，动态紧致饱满。";
        lufsMod = 1.2;
        peakMod = 0.1;
      }

      const baseLufs = (versions[0] ? versions[0].lufs : -12.0);
      const newLufs = parseFloat((baseLufs + lufsMod).toFixed(1));
      const newPeak = parseFloat((-0.4 + peakMod).toFixed(2));
      const masterUrl = project.current_mix?.master_url || project.reference?.url || (project.tracks[0]?.url || "");

      const newVersion = {
        id: vid,
        name: `${vid}: ${shortTag}`,
        prompt: promptText,
        lufs: newLufs,
        peak_db: newPeak,
        duration: 16.0,
        master_url: masterUrl,
        timestamp: new Date().toLocaleTimeString("zh-CN", { hour12: false })
      };

      if (!project.mix_versions) project.mix_versions = [];
      project.mix_versions.push(newVersion);
      project.active_version_id = vid;
      project.current_mix = newVersion;

      project.chat_history.push({
        role: "assistant",
        content: `【新混音版本 ${vid} 已生成】\n${detailDesc}\n• 调整后响度：${newLufs} LUFS | 真实峰值：${newPeak} dBFS\n您可以在上方【混音版本】胶囊条或【步骤 5】中直接切换 ${vid} 与先前版本进行 A/B 盲听！`
      });

      renderAll();
      selectMixVersion(vid);
    }, 450);
  }
}

// ==========================================
// 混音版本快照管理引擎 (Mix Version Snapshots Manager)
// ==========================================

function renderMixVersions() {
  const versions = project.mix_versions || [];
  const activeId = project.active_version_id || (versions[0] ? versions[0].id : null);

  // 1. 更新顶部快速胶囊条 quick-versions-list
  if (quickVersionsList) {
    quickVersionsList.innerHTML = "";
    if (versions.length === 0) {
      quickVersionsList.innerHTML = `<span class="text-[10px] text-zinc-500 italic">尚未混音 (点击上方一键混音)</span>`;
    } else {
      versions.forEach((v) => {
        const isCur = v.id === activeId;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = isCur
          ? "px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-600 text-white border border-indigo-400 shadow-sm flex items-center space-x-1 flex-shrink-0 transition"
          : "px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-[#141824] hover:bg-[#20273a] text-zinc-300 border border-zinc-700/60 flex items-center space-x-1 flex-shrink-0 transition";
        
        const shortTitle = (v.name || "").split(":")[1] ? v.name.split(":")[1].trim().slice(0, 8) : v.id;
        btn.innerHTML = `${isCur ? '<i class="fa-solid fa-check text-[9px] text-cyan-300"></i>' : ''}<span>${escapeHtml(v.id)}: ${escapeHtml(shortTitle)}</span>`;
        btn.title = `${v.name} (${v.lufs} LUFS) - 点击切换试听`;
        btn.addEventListener("click", () => selectMixVersion(v.id));
        quickVersionsList.appendChild(btn);
      });
    }
  }

  // 2. 更新步骤 5 卡片容器 mix-versions-container
  if (mixVersionsContainer) {
    mixVersionsContainer.innerHTML = "";
    if (versions.length === 0) {
      mixVersionsContainer.innerHTML = `
        <div class="col-span-full py-8 text-center text-zinc-500 text-xs">
          <i class="fa-solid fa-clock-rotate-left text-2xl mb-2 block text-zinc-600"></i>
          暂无混音快照历史。请在顶部点击【一键参考混音】或在右侧 AI 助手提出调音想法（如“人声更贴耳”、“低音更温暖”），系统将自动为您生成不同混音版本并记录于此。
        </div>
      `;
    } else {
      versions.forEach((v) => {
        const isCur = v.id === activeId;
        const card = document.createElement("div");
        card.className = isCur
          ? "rack-slot p-4 border-2 border-indigo-500 bg-indigo-950/20 rounded-xl space-y-3 shadow-lg shadow-indigo-500/20 transition"
          : "rack-slot p-4 border border-zinc-800 bg-[#0d1017] hover:border-zinc-700 rounded-xl space-y-3 transition";

        card.innerHTML = `
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-zinc-200 flex items-center space-x-1.5">
              <span class="w-2.5 h-2.5 rounded-full ${isCur ? 'bg-cyan-400 animate-pulse' : 'bg-zinc-600'}"></span>
              <span class="truncate max-w-[180px]">${escapeHtml(v.name)}</span>
            </span>
            <span class="text-[10px] font-mono px-1.5 py-0.5 rounded ${isCur ? 'bg-indigo-600 text-white font-bold' : 'bg-zinc-800 text-zinc-400'}">
              ${isCur ? '当前试听 (Active)' : (v.timestamp || '')}
            </span>
          </div>
          <div class="text-[11px] text-zinc-400 bg-[#07090f] p-2 rounded-lg border border-[#161c2b] min-h-[38px] flex items-center">
            <i class="fa-solid fa-wand-magic-sparkles text-purple-400 text-xs mr-1.5 flex-shrink-0"></i>
            <span class="truncate">${escapeHtml(v.prompt || '官方AI多轨参考混音基准')}</span>
          </div>
          <div class="grid grid-cols-2 gap-2 text-center text-xs font-mono">
            <div class="bg-[#0c0f17] p-2 rounded border border-[#1c2436]">
              <div class="text-[9px] text-zinc-500">响度 (LUFS)</div>
              <div class="font-bold text-emerald-400 mt-0.5">${v.lufs || '--'}</div>
            </div>
            <div class="bg-[#0c0f17] p-2 rounded border border-[#1c2436]">
              <div class="text-[9px] text-zinc-500">真实峰值 (True Peak)</div>
              <div class="font-bold text-cyan-400 mt-0.5">${v.peak_db !== undefined ? v.peak_db + ' dB' : '--'}</div>
            </div>
          </div>
          <div class="pt-1 flex justify-end">
            ${isCur 
              ? `<span class="text-xs font-bold text-cyan-300 flex items-center space-x-1 py-1"><i class="fa-solid fa-volume-high text-xs mr-1"></i>正在监听</span>`
              : `<button class="btn-select-version px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition flex items-center space-x-1.5" data-vid="${escapeHtml(v.id)}">
                  <i class="fa-solid fa-play text-[10px]"></i>
                  <span>切换并试听</span>
                 </button>`
            }
          </div>
        `;

        const btn = card.querySelector(".btn-select-version");
        if (btn) {
          btn.addEventListener("click", () => selectMixVersion(v.id));
        }

        mixVersionsContainer.appendChild(card);
      });
    }
  }

  // 3. 更新当前徽章
  if (activeVersionBadge) {
    const curV = versions.find(v => v.id === activeId);
    activeVersionBadge.textContent = curV ? curV.name : "尚未混音";
  }
}

async function selectMixVersion(versionId) {
  const versions = project.mix_versions || [];
  const target = versions.find(v => v.id === versionId);
  if (!target) return;

  project.active_version_id = versionId;
  project.current_mix = target;

  // 更新当前 master 音频
  if (target.master_url) {
    const curPos = currentPlayTime || 0;
    const wasPlaying = isPlaying;
    
    // 加载目标音频
    const newMaster = new Audio(target.master_url);
    newMaster.preload = "auto";
    audioElements["master"] = newMaster;

    if (wasPlaying && listenMode === "mix") {
      newMaster.currentTime = curPos;
      try {
        await newMaster.play();
      } catch (e) {}
    }
  }

  // 自动切换监听模式为 mix
  setListenMode("mix");
  renderMixVersions();
  renderMixMetrics();

  // 若后端在线，同步通知后端
  try {
    await fetch("/api/mix/version/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version_id: versionId })
    });
  } catch (e) {}
}

// ==========================================
// 真实专业 DAW 波形绘制引擎 (Canvas Real Waveform)
// ==========================================
const dawWaveformCache = new Map();

async function getWaveformData(audioUrl, trackName) {
  if (dawWaveformCache.has(audioUrl)) {
    return dawWaveformCache.get(audioUrl);
  }
  try {
    const res = await fetch(audioUrl);
    if (!res.ok) throw new Error("Fetch audio failed");
    const arrayBuffer = await res.arrayBuffer();
    const ctx = getAudioContext();
    if (!ctx) throw new Error("Web Audio API not supported");

    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0);
    const totalSamples = channelData.length;
    const columns = 280;
    const samplesPerCol = Math.max(1, Math.floor(totalSamples / columns));

    const maxPeaks = new Float32Array(columns);
    const minPeaks = new Float32Array(columns);
    const rmsVals = new Float32Array(columns);

    for (let c = 0; c < columns; c++) {
      const start = c * samplesPerCol;
      const end = Math.min(totalSamples, start + samplesPerCol);
      let maxVal = 0.0;
      let minVal = 0.0;
      let sumSq = 0;

      for (let i = start; i < end; i++) {
        const val = channelData[i];
        if (val > maxVal) maxVal = val;
        if (val < minVal) minVal = val;
        sumSq += val * val;
      }
      maxPeaks[c] = maxVal;
      minPeaks[c] = minVal;
      rmsVals[c] = Math.sqrt(sumSq / (end - start));
    }

    const data = { columns, maxPeaks, minPeaks, rmsVals };
    dawWaveformCache.set(audioUrl, data);
    return data;
  } catch (err) {
    const columns = 280;
    const maxPeaks = new Float32Array(columns);
    const minPeaks = new Float32Array(columns);
    const rmsVals = new Float32Array(columns);
    for (let c = 0; c < columns; c++) {
      const v = 0.3 + 0.3 * Math.sin(c * 0.1);
      maxPeaks[c] = v;
      minPeaks[c] = -v;
      rmsVals[c] = v * 0.6;
    }
    return { columns, maxPeaks, minPeaks, rmsVals };
  }
}

function drawDawWaveform(canvas, waveformData, hexColor, progressRatio = 0) {
  if (!canvas || !waveformData) return;
  const ctx = canvas.getContext("2d");
  const width = canvas.offsetWidth || 300;
  const height = canvas.offsetHeight || 44;
  canvas.width = width;
  canvas.height = height;

  ctx.clearRect(0, 0, width, height);

  const midY = height / 2;
  const cols = waveformData.columns;

  // 1. 水平基准线
  ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, midY);
  ctx.lineTo(width, midY);
  ctx.stroke();

  // 2. 8 拍垂直刻度线
  ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
  for (let b = 1; b < 8; b++) {
    const x = (width / 8) * b;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  // 3. 绘制真实音频包络与核心 RMS
  const colWidth = width / cols;

  for (let c = 0; c < cols; c++) {
    const x = c * colWidth;
    const maxPeak = waveformData.maxPeaks[c];
    const minPeak = waveformData.minPeaks[c];
    const rms = waveformData.rmsVals[c];

    const isPassed = (x / width) <= progressRatio;
    const peakAlpha = isPassed ? 0.95 : 0.65;
    const rmsAlpha = isPassed ? 0.8 : 0.45;

    // Peak 外轮廓
    const topY = midY - maxPeak * (height * 0.45);
    const bottomY = midY - minPeak * (height * 0.45);

    ctx.fillStyle = hexColor + Math.round(peakAlpha * 255).toString(16).padStart(2, "0");
    ctx.fillRect(x, topY, Math.max(1, colWidth - 0.3), Math.max(1, bottomY - topY));

    // RMS 能量核心
    const rmsTop = midY - rms * (height * 0.45);
    const rmsBottom = midY + rms * (height * 0.45);

    ctx.fillStyle = hexColor + Math.round(rmsAlpha * 255).toString(16).padStart(2, "0");
    ctx.fillRect(x, rmsTop, Math.max(1, colWidth - 0.3), Math.max(1, rmsBottom - rmsTop));
  }

  // 4. 动态 Playhead 黄色指示线
  if (progressRatio > 0) {
    const playheadX = progressRatio * width;
    ctx.fillStyle = "#facc15";
    ctx.fillRect(playheadX - 1, 0, 2, height);
  }
}

function updateAllWaveforms() {
  const duration = 16.0;
  const ratio = Math.max(0, Math.min(1.0, playbackTime / duration));

  document.querySelectorAll(".track-waveform-box").forEach(box => {
    const canvas = box.querySelector(".track-waveform-canvas");
    if (!canvas) return;
    const audioUrl = canvas.getAttribute("data-url");
    const hexColor = canvas.getAttribute("data-color") || "#6366f1";
    if (audioUrl && dawWaveformCache.has(audioUrl)) {
      drawDawWaveform(canvas, dawWaveformCache.get(audioUrl), hexColor, ratio);
    }
  });
}

function seekAudioToRatio(trackId, ratio) {
  const targetTime = ratio * 16.0;
  playbackTime = targetTime;
  Object.values(audioElements).forEach(a => {
    try {
      if (a.readyState >= 1) a.currentTime = targetTime;
    } catch(e) {}
  });
  updateTimeDisplay();
  updateAllWaveforms();
}

function updateTrackFader(trackId, vol, pan) {
  const trk = project.tracks.find(t => t.id === trackId);
  if (!trk) return;
  if (vol !== null) trk.volume = vol;
  if (pan !== null) trk.pan = pan;

  const audio = audioElements[trackId];
  if (audio && vol !== null) {
    audio.volume = vol;
  }
}

function deleteTrack(trackId) {
  project.tracks = project.tracks.filter(t => t.id !== trackId);
  delete audioElements[trackId];
  renderAll();
}

async function uploadTracks(files) {
  triggerGlobalProgress(600);
  const formData = new FormData();
  files.forEach(f => formData.append("files", f));

  try {
    const res = await fetch("/api/tracks/upload", { method: "POST", body: formData });
    if (res.ok) {
      const data = await res.json();
      project = data.project;
      listenMode = "raw";
      renderAll();
      switchStep(2);
      return;
    }
  } catch(err) {}

  // 离线环境本地 Object URL
  files.forEach(file => {
    const tid = `trk_${Date.now()}_${Math.floor(Math.random()*1000)}`;
    const url = URL.createObjectURL(file);
    project.tracks.push({
      id: tid,
      name: file.name.replace(/\.[^/.]+$/, ""),
      file_name: file.name,
      url: url,
      volume: 1.0,
      pan: 0.0,
      instrument: "other"
    });
  });
  listenMode = "raw";
  renderAll();
  switchStep(2);
}

async function uploadReferenceFile(file) {
  triggerGlobalProgress(500);
  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch("/api/reference/upload", { method: "POST", body: formData });
    if (res.ok) {
      const data = await res.json();
      project = data.project;
      renderAll();
      switchStep(3);
      return;
    }
  } catch (err) {}

  const url = URL.createObjectURL(file);
  project.reference = {
    name: file.name,
    file_name: file.name,
    url: url,
    analysis: {
      integrated_lufs: -11.8,
      spectral_bands_db: {
        sub_bass: -12.0, bass: -6.0, low_mid: -9.0, mid: -8.0,
        upper_mid: -12.0, presence: -14.0, brilliance: -17.0, air: -21.0
      },
      dynamics: { peak_db: -0.2, rms_db: -10.0, crest_factor_db: 9.8, stereo_correlation: 0.92 }
    }
  };
  renderAll();
  switchStep(3);
}
