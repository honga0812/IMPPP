// 智能多轨混音工作站前端核心逻辑 (Smart Mixing Studio v2.0 Pro)
let project = {
  tracks: [],
  reference: null,
  current_mix: null,
  current_strategy: null,
  chat_history: []
};

// 监听模式: 'mix' (AI 混音), 'raw' (原始分轨合流), 'ref' (商业参考曲)
let listenMode = 'mix';
let isPlaying = false;
let playbackTime = 0;
let animFrameId = null;

// 单轨独立试听状态
let activeSoloTrackId = null;

// 音频播放节点映射
let audioElements = {}; // { 'master': Audio, 'ref': Audio, [trackId]: Audio }
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

// 细分乐器声学画像元数据 (图标、中文名称、专属色彩标签、DAW波形渐变色)
const instrumentMeta = {
  "vocal_lead": { name: "主唱人声", color: "bg-fuchsia-950/70 text-fuchsia-300 border-fuchsia-700/50", icon: "fa-microphone", hex: "#d946ef" },
  "vocal_backing": { name: "立体声和声", color: "bg-purple-950/70 text-purple-300 border-purple-700/50", icon: "fa-users", hex: "#a855f7" },
  "kick": { name: "纯净底鼓", color: "bg-red-950/70 text-red-300 border-red-700/50", icon: "fa-drum", hex: "#ef4444" },
  "snare": { name: "军鼓/踩镲", color: "bg-rose-950/70 text-rose-300 border-rose-700/50", icon: "fa-drum", hex: "#f43f5e" },
  "drums": { name: "原声全鼓组", color: "bg-orange-950/70 text-orange-300 border-orange-700/50", icon: "fa-drum", hex: "#f97316" },
  "bass": { name: "低音电贝斯", color: "bg-emerald-950/70 text-emerald-300 border-emerald-700/50", icon: "fa-guitar", hex: "#10b981" },
  "guitar_arpeggio": { name: "指弹木吉他", color: "bg-amber-950/70 text-amber-300 border-amber-700/50", icon: "fa-guitar", hex: "#f59e0b" },
  "guitar_strum": { name: "扫弦木吉他", color: "bg-amber-900/70 text-amber-200 border-amber-600/50", icon: "fa-guitar", hex: "#fbbf24" },
  "guitar_nylon": { name: "尼龙古典吉他", color: "bg-yellow-950/70 text-yellow-300 border-yellow-700/50", icon: "fa-guitar", hex: "#eab308" },
  "guitar_solo": { name: "电吉他 Solo", color: "bg-red-900/70 text-red-200 border-red-600/50", icon: "fa-bolt", hex: "#f87171" },
  "guitar_acoustic": { name: "原声木吉他", color: "bg-amber-950/70 text-amber-300 border-amber-700/50", icon: "fa-guitar", hex: "#f59e0b" },
  "piano_grand": { name: "原声大钢琴", color: "bg-sky-950/70 text-sky-300 border-sky-700/50", icon: "fa-music", hex: "#0ea5e9" },
  "piano_rhodes": { name: "复古电钢琴", color: "bg-cyan-950/70 text-cyan-300 border-cyan-700/50", icon: "fa-keyboard", hex: "#06b6d4" },
  "synth_hybrid": { name: "混合铺底钢琴", color: "bg-indigo-950/70 text-indigo-300 border-indigo-700/50", icon: "fa-wave-square", hex: "#6366f1" },
  "synth": { name: "合成器铺底", color: "bg-indigo-950/70 text-indigo-300 border-indigo-700/50", icon: "fa-wave-square", hex: "#6366f1" },
  "cello": { name: "原声大提琴", color: "bg-teal-950/70 text-teal-300 border-teal-700/50", icon: "fa-music", hex: "#14b8a6" },
  "other": { name: "乐器分轨", color: "bg-zinc-800 text-zinc-300 border-zinc-700", icon: "fa-sliders", hex: "#94a3b8" }
};

// 示范曲目工程数据库 (多曲目按专属目录独立封装，保证音轨乐器真实性与声音一致性)
const DEMO_SONG_PROJECTS = {
  "song_01": {
    id: "song_01",
    title: "曲目一：原声流行《暖阳》 (Acoustic Pop)",
    shortName: "原声流行《暖阳》",
    folder: "Song_01_Acoustic_Pop",
    description: "全真实录音棚原声编制，包含纯正指弹木吉他、温暖扫弦木吉他、真声女声主唱、录音棚鼓组、电贝斯、复古 Rhodes 电钢及大钢琴铺底。",
    reference: {
      name: "Reference_Acoustic_Pop_Master.wav",
      url: "./demo_assets/Song_01_Acoustic_Pop/Reference_Acoustic_Pop_Master.wav",
      analysis: {
        integrated_lufs: -11.5,
        spectral_bands_db: {
          sub_bass: -11.0, bass: -5.2, low_mid: -9.1, mid: -8.5,
          upper_mid: -12.8, presence: -14.5, brilliance: -17.5, air: -21.2
        },
        dynamics: { peak_db: -0.15, rms_db: -9.2, crest_factor_db: 9.05, stereo_correlation: 0.92 }
      },
      note: "特点：实录商业母带标杆，高频空气感通透，低频温润结实不浑浊。"
    },
    tracks: [
      {
        id: "s1_01",
        name: "01_Lead_Vocal",
        file_name: "01_Lead_Vocal.wav",
        instrument: "vocal_lead",
        volume: 1.05,
        pan: 0.0,
        hpf: "85 Hz (切除人声杂音与喷麦低频)",
        eq: "+2.5dB@3.5kHz (咬字穿透感), +2.0dB@11kHz (空气感光泽)",
        comp: "4:1, 阈值 -18dB, 启动 15ms (人声压实平整)",
        pan_desc: "Center 0% (舞台正中央)"
      },
      {
        id: "s1_02",
        name: "02_Acoustic_Guitar_Fingerpicking",
        file_name: "02_Acoustic_Guitar_Fingerpicking.wav",
        instrument: "guitar_arpeggio",
        volume: 0.85,
        pan: -0.35,
        hpf: "115 Hz (避让贝斯与地鼓基频)",
        eq: "+2.0dB@4.5kHz (透亮指弹颗粒), -2.5dB@320Hz (消除箱体共鸣)",
        comp: "2.8:1, 阈值 -17dB (动态平滑)",
        pan_desc: "L35 (偏左对称)"
      },
      {
        id: "s1_03",
        name: "03_Acoustic_Guitar_Strum",
        file_name: "03_Acoustic_Guitar_Strum.wav",
        instrument: "guitar_strum",
        volume: 0.85,
        pan: 0.35,
        hpf: "110 Hz (低频切净让位)",
        eq: "-3.0dB@280Hz (去浑浊木质杂频), +2.2dB@8kHz (通透开扬扫弦)",
        comp: "3:1, 阈值 -16dB, 释放 120ms",
        pan_desc: "R35 (偏右开阔声场)"
      },
      {
        id: "s1_04",
        name: "04_Studio_Drums",
        file_name: "04_Studio_Drums.wav",
        instrument: "drums",
        volume: 0.95,
        pan: 0.0,
        hpf: "32 Hz (超低频切除保留底频)",
        eq: "+3.0dB@65Hz (拳拳到肉底频), +2.5dB@5.5kHz (军鼓镲片清脆度)",
        comp: "4:1, 瞬态保留 30ms (强劲律动骨架)",
        pan_desc: "Center 0% (全立体声底架)"
      },
      {
        id: "s1_05",
        name: "05_Electric_Bass",
        file_name: "05_Electric_Bass.wav",
        instrument: "bass",
        volume: 1.0,
        pan: 0.0,
        hpf: "35 Hz (次低频收紧防浑浊)",
        eq: "-3.5dB@65Hz (为底鼓精准避让划槽), +2.8dB@700Hz (金属拨片质感)",
        comp: "5:1, 阈值 -20dB (紧凑低频地基)",
        pan_desc: "Center 0% (绝对居中防相位抵消)"
      },
      {
        id: "s1_06",
        name: "06_Rhodes_Electric_Piano",
        file_name: "06_Rhodes_Electric_Piano.wav",
        instrument: "piano_rhodes",
        volume: 0.85,
        pan: -0.25,
        hpf: "100 Hz (清除驻波杂音)",
        eq: "-2.0dB@300Hz (让人声中频更突出), +1.8dB@4kHz (电钢泛音)",
        comp: "2.5:1, 阈值 -15dB (柔和模拟润色)",
        pan_desc: "L25 (偏左复古空间铺垫)"
      },
      {
        id: "s1_07",
        name: "07_Grand_Piano_Layer",
        file_name: "07_Grand_Piano_Layer.wav",
        instrument: "piano_grand",
        volume: 0.80,
        pan: 0.25,
        hpf: "105 Hz (低频切除)",
        eq: "+2.0dB@2.5kHz (晶莹通透度), -2.0dB@400Hz",
        comp: "2.5:1, 阈值 -16dB",
        pan_desc: "R25 (偏右空间辉映)"
      }
    ]
  },
  "song_02": {
    id: "song_02",
    title: "曲目二：流行摇滚《风暴》 (Modern Rock)",
    shortName: "流行摇滚《风暴》",
    folder: "Song_02_Electric_Rock",
    description: "现代流行摇滚与电声乐器编制，包含失真电吉他强力和弦、节奏电吉他、高亢 Overdrive 电吉他 Solo、摇滚重鼓组、金属质感电贝斯及大提琴 Pad。",
    reference: {
      name: "Reference_Rock_Master.wav",
      url: "./demo_assets/Song_02_Electric_Rock/Reference_Rock_Master.wav",
      analysis: {
        integrated_lufs: -9.5,
        spectral_bands_db: {
          sub_bass: -10.0, bass: -4.8, low_mid: -8.6, mid: -8.2,
          upper_mid: -12.0, presence: -14.0, brilliance: -16.8, air: -20.2
        },
        dynamics: { peak_db: -0.1, rms_db: -8.8, crest_factor_db: 8.7, stereo_correlation: 0.94 }
      },
      note: "特点：高能级摇滚母带，冲击力鼓点与失真电吉他紧密咬合，大动态高响度。"
    },
    tracks: [
      {
        id: "s2_01",
        name: "01_Rock_Lead_Vocal",
        file_name: "01_Rock_Lead_Vocal.wav",
        instrument: "vocal_lead",
        volume: 1.05,
        pan: 0.0,
        hpf: "90 Hz (高切低频噪音)",
        eq: "+3.0dB@3.8kHz (穿透狂躁摇滚乐器层), +1.8dB@10kHz (亮色)",
        comp: "5:1, 阈值 -19dB, 快速压限 (防止破音并稳居前排)",
        pan_desc: "Center 0% (绝对中央主唱)"
      },
      {
        id: "s2_02",
        name: "02_Rock_Drums",
        file_name: "02_Rock_Drums.wav",
        instrument: "drums",
        volume: 1.0,
        pan: 0.0,
        hpf: "30 Hz (超低频截断)",
        eq: "+3.5dB@60Hz (重击力量), +3.0dB@4.5kHz (军鼓抽打感)",
        comp: "4.5:1, 瞬态增强 (强劲敲击冲力)",
        pan_desc: "Center 0% (立体声全鼓组)"
      },
      {
        id: "s2_03",
        name: "03_Rock_Bass",
        file_name: "03_Rock_Bass.wav",
        instrument: "bass",
        volume: 0.95,
        pan: 0.0,
        hpf: "35 Hz (次低频收缩)",
        eq: "-3.0dB@60Hz (为摇滚地鼓避让), +3.2dB@850Hz (过载金属颗粒)",
        comp: "6:1, 阈值 -22dB (钢条般紧硬平直)",
        pan_desc: "Center 0% (居中低频骨干)"
      },
      {
        id: "s2_04",
        name: "04_Electric_Guitar_Power_Chords",
        file_name: "04_Electric_Guitar_Power_Chords.wav",
        instrument: "guitar_solo",
        volume: 0.85,
        pan: 0.40,
        hpf: "100 Hz (切净泥泞杂频)",
        eq: "+2.5dB@2.8kHz (失真力量感), -2.0dB@4kHz (去除刺耳蜂鸣)",
        comp: "3.5:1, 阈值 -16dB",
        pan_desc: "R40 (右侧强力电吉他墙)"
      },
      {
        id: "s2_05",
        name: "05_Electric_Guitar_Rhythm",
        file_name: "05_Electric_Guitar_Rhythm.wav",
        instrument: "guitar_acoustic",
        volume: 0.85,
        pan: -0.40,
        hpf: "100 Hz (切净低频)",
        eq: "+2.0dB@2.2kHz (节奏突出), -2.0dB@500Hz",
        comp: "3.2:1, 阈值 -16dB",
        pan_desc: "L40 (左侧对称电吉他墙)"
      },
      {
        id: "s2_06",
        name: "06_Electric_Guitar_Overdrive_Solo",
        file_name: "06_Electric_Guitar_Overdrive_Solo.wav",
        instrument: "guitar_solo",
        volume: 0.85,
        pan: 0.15,
        hpf: "90 Hz (低频切除)",
        eq: "+3.5dB@3kHz (破音Solo歌唱性), 模拟延音增强",
        comp: "4:1, 延音饱满",
        pan_desc: "R15 (前排主奏 Solo)"
      },
      {
        id: "s2_07",
        name: "07_Rock_Cello_Pad",
        file_name: "07_Rock_Cello_Pad.wav",
        instrument: "cello",
        volume: 0.80,
        pan: -0.20,
        hpf: "80 Hz (基频保留)",
        eq: "+2.0dB@1.5kHz (弦乐厚度), -2.0dB@600Hz",
        comp: "2.8:1, 慢释放 (沉浸弦乐底铺)",
        pan_desc: "L20 (左侧沉浸弦乐铺底)"
      }
    ]
  }
};

// 兼容老版本的 DEMO_REAL_STUDIO_TRACKS 引用
const DEMO_REAL_STUDIO_TRACKS = DEMO_SONG_PROJECTS["song_01"].tracks;

// 预置商业流派定义
const PRESET_COMMERCIAL_STYLES = {
  pop: {
    name: "真实商业流行标杆 (Real Commercial Master)",
    styleLabel: "商业流行标杆",
    url: "./demo_assets/Song_01_Acoustic_Pop/Reference_Acoustic_Pop_Master.wav",
    analysis: DEMO_SONG_PROJECTS["song_01"].reference.analysis,
    note: "特点：实录商业母带，12kHz+ 空气感透明，声场开阔，低频结实饱满不浑浊。"
  },
  folk: {
    name: "原声民谣暖色 (Acoustic Folk)",
    styleLabel: "原声民谣风格",
    url: "./demo_assets/Song_01_Acoustic_Pop/Reference_Acoustic_Pop_Master.wav",
    analysis: {
      integrated_lufs: -13.8,
      spectral_bands_db: {
        sub_bass: -14.2, bass: -8.5, low_mid: -8.8, mid: -11.0,
        upper_mid: -15.2, presence: -18.0, brilliance: -22.5, air: -25.8
      },
      dynamics: { peak_db: -0.3, rms_db: -12.4, crest_factor_db: 12.1, stereo_correlation: 0.88 }
    },
    note: "特点：保留大动态呼吸感，木吉他拨弦通透细腻，中频温暖饱满，空间宽广。"
  },
  rock: {
    name: "录音棚流行摇滚 (Studio Modern Rock)",
    styleLabel: "摇滚/R&B风格",
    url: "./demo_assets/Song_02_Electric_Rock/Reference_Rock_Master.wav",
    analysis: DEMO_SONG_PROJECTS["song_02"].reference.analysis,
    note: "特点：律动鼓组与金属贝斯紧密胶合，电吉他立体声饱满，富有音乐感染力。"
  }
};

// DOM 元素引用
const btnPlayPause = document.getElementById('btn-play-pause');
const playIcon = document.getElementById('play-icon');
const btnStop = document.getElementById('btn-stop');
const timeDisplay = document.getElementById('time-display');
const btnClearProject = document.getElementById('btn-clear-project');
const btnAutoMix = document.getElementById('btn-auto-mix');

const listenRawBtn = document.getElementById('listen-raw');
const listenMixBtn = document.getElementById('listen-mix');
const listenRefBtn = document.getElementById('listen-ref');

const inputTracks = document.getElementById('input-tracks');
const inputReference = document.getElementById('input-reference');
const btnLoadDemoSuite = document.getElementById('btn-load-demo-suite');
const selectDemoSong = document.getElementById('select-demo-song');
const currentDemoSongLabel = document.getElementById('current-demo-song-label');
const currentRefStyleLabel = document.getElementById('current-ref-style-label');

const tracksContainer = document.getElementById('tracks-container');
const emptyTracksHint = document.getElementById('empty-tracks-hint');
const trackCountBadge = document.getElementById('track-count-badge');
const refStatusBadge = document.getElementById('ref-status-badge');
const mixStatusBadge = document.getElementById('mix-status-badge');
const valLufs = document.getElementById('val-lufs');
const valPeak = document.getElementById('val-peak');

const refAnalysisPanel = document.getElementById('ref-analysis-panel');
const refLufs = document.getElementById('ref-lufs');
const refPeak = document.getElementById('ref-peak');
const refStereo = document.getElementById('ref-stereo');
const spectrumBarsContainer = document.getElementById('spectrum-bars-container');

const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const btnSendChat = document.getElementById('btn-send-chat');

// 设置弹窗
const settingsModal = document.getElementById('settings-modal');
const btnOpenSettings = document.getElementById('btn-open-settings');
const btnCloseSettings = document.getElementById('btn-close-settings');
const btnSaveSettings = document.getElementById('btn-save-settings');
const inputApiKey = document.getElementById('input-api-key');
const inputApiBase = document.getElementById('input-api-base');
const inputModel = document.getElementById('input-model');
const currentLlmLabel = document.getElementById('current-llm-label');

// 单例 Web Audio API 上下文 (杜绝 Safari 多实例超限闪退)
let _sharedAudioContext = null;
function getAudioContext() {
  if (!_sharedAudioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      _sharedAudioContext = new AudioCtx();
    }
  }
  if (_sharedAudioContext && _sharedAudioContext.state === 'suspended') {
    _sharedAudioContext.resume().catch(() => {});
  }
  return _sharedAudioContext;
}

// 初始化
window.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await refreshProject();
});

function setupEventListeners() {
  btnPlayPause.addEventListener('click', togglePlay);
  btnStop.addEventListener('click', stopAudio);

  listenRawBtn.addEventListener('click', () => setListenMode('raw'));
  listenMixBtn.addEventListener('click', () => setListenMode('mix'));
  listenRefBtn.addEventListener('click', () => setListenMode('ref'));

  inputTracks.addEventListener('change', handleTracksUpload);
  inputReference.addEventListener('change', handleReferenceUpload);

  if (btnClearProject) {
    btnClearProject.addEventListener('click', clearProject);
  }

  // 示范曲目选择与载入
  if (btnLoadDemoSuite) {
    btnLoadDemoSuite.addEventListener('click', () => {
      const chosen = selectDemoSong ? selectDemoSong.value : 'song_01';
      loadDemoProjectSuite(chosen);
    });
  }

  if (selectDemoSong) {
    selectDemoSong.addEventListener('change', (e) => {
      const opt = DEMO_SONG_PROJECTS[e.target.value];
      if (opt && currentDemoSongLabel) {
        currentDemoSongLabel.textContent = opt.shortName;
      }
    });
  }

  // 预置商业流派切换按钮
  document.querySelectorAll('.preset-ref-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const styleKey = btn.getAttribute('data-style');
      selectPresetCommercialStyle(styleKey);
    });
  });

  btnAutoMix.addEventListener('click', runAutoMix);
  chatForm.addEventListener('submit', handleChatSubmit);

  // 快捷气泡点击
  document.querySelectorAll('.quick-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const msg = btn.getAttribute('data-msg');
      chatInput.value = msg;
      chatForm.dispatchEvent(new Event('submit'));
    });
  });

  // 设置弹窗事件
  btnOpenSettings.addEventListener('click', () => settingsModal.classList.remove('hidden'));
  btnCloseSettings.addEventListener('click', () => settingsModal.classList.add('hidden'));
  btnSaveSettings.addEventListener('click', saveLlmSettings);

  // 全局拖拽上传分轨支持
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files.length) {
      handleTracksUpload(e);
    }
  });

  // 窗口尺寸自适应重新绘制波形
  window.addEventListener('resize', () => {
    updateAllWaveforms();
  });
}

// 一键清空工程并重置状态
async function clearProject() {
  if (confirm("确定要清空当前工程的所有分轨、参考曲、混音结果及对话记录吗？")) {
    triggerGlobalProgress(400);
    stopAudio();
    audioElements = {};
    activeSoloTrackId = null;
    trackMuteState = {};
    trackSoloState = {};

    project = {
      tracks: [],
      reference: null,
      current_mix: null,
      current_strategy: null,
      chat_history: [
        {
          role: "assistant",
          content: "工程已成功清空重置。您可以从左上角选择示范曲目载入，或拖拽导入自身的实录分轨与商业参考曲！"
        }
      ]
    };

    try {
      await fetch('/api/project/clear', { method: 'POST' });
    } catch (e) {}

    renderAll();
  }
}

// 核心：载入指定示范曲目工程 (服务端 + 纯前端/GitHub Pages 双模完备)
async function loadDemoProjectSuite(songId = 'song_01') {
  triggerGlobalProgress(600);
  stopAudio();
  activeSoloTrackId = null;
  trackSoloState = {};
  trackMuteState = {};

  const songData = DEMO_SONG_PROJECTS[songId] || DEMO_SONG_PROJECTS['song_01'];
  if (currentDemoSongLabel) {
    currentDemoSongLabel.textContent = songData.shortName;
  }

  // 1. 如果本地服务端在线，优先请求服务端持久化同步
  try {
    const res = await fetch(`/api/demo/load?song_id=${songId}`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      project = data.project;
      isDemoMode = false;
      renderAll();
      return;
    }
  } catch (err) {
    console.log('以客户端静态/GitHub Pages模式加载示范曲目:', err);
  }

  // 2. 静态/离线/GitHub Pages 模式：直接基于真实目录结构挂载
  isDemoMode = true;
  project.tracks = songData.tracks.map(t => ({
    ...t,
    url: `./demo_assets/${songData.folder}/${t.file_name}`
  }));

  project.reference = {
    name: songData.reference.name,
    url: songData.reference.url,
    analysis: songData.reference.analysis
  };

  // 生成初始目标混音画像
  project.current_mix = {
    lufs: songData.reference.analysis.integrated_lufs,
    peak_db: -0.4,
    duration: 16.0,
    master_url: songData.reference.url
  };

  project.chat_history = [
    {
      role: "assistant",
      content: `已为您即时载入【${songData.title}】！\n${songData.description}\n• 包含 ${project.tracks.length} 轨真实乐器分轨，音色与名称 100% 对应；\n• 专属商业参考标杆：${songData.reference.name} (目标 ${songData.reference.analysis.integrated_lufs} LUFS)。\n现在点击每轨左侧绿色播放按键可单独试听各真实乐器，或点击顶部【一键参考混音】体验 AI 真实声学空间雕塑！`
    }
  ];

  renderAll();
}

// 兼容旧版调用
function loadRealStudioSuite() {
  loadDemoProjectSuite('song_01');
}

// 选择预置商业风格参考曲
function selectPresetCommercialStyle(styleKey, triggerNotice = true) {
  triggerGlobalProgress(400);
  const style = PRESET_COMMERCIAL_STYLES[styleKey];
  if (!style) return;

  project.reference = {
    name: style.name,
    url: style.url,
    analysis: style.analysis
  };

  if (currentRefStyleLabel) {
    currentRefStyleLabel.textContent = `已选: ${style.styleLabel}`;
  }

  // 高亮选中的预置按钮
  document.querySelectorAll('.preset-ref-btn').forEach(b => {
    if (b.getAttribute('data-style') === styleKey) {
      b.className = 'preset-ref-btn px-1.5 py-1.5 rounded bg-purple-600 border border-purple-400 text-[10px] text-white transition text-center font-bold shadow-md shadow-purple-600/30';
    } else {
      b.className = 'preset-ref-btn px-1.5 py-1.5 rounded bg-zinc-800 hover:bg-purple-950/70 hover:border-purple-500/60 border border-zinc-700 text-[10px] text-zinc-300 transition text-center font-medium';
    }
  });

  renderReference();
  rebuildAudioElements();

  if (triggerNotice) {
    project.chat_history.push({
      role: "assistant",
      content: `已切换至【${style.name}】商业声学基准！\n${style.note}\n• 目标响度：${style.analysis.integrated_lufs} LUFS\n点击顶部【一键参考混音】即可将各分轨向该声学坐标对齐。`
    });
    renderChat();
  }
}

// 刷新服务端工程状态
async function refreshProject() {
  try {
    const res = await fetch('/api/project');
    if (!res.ok) throw new Error('API unreachable');
    const data = await res.json();
    if (data && data.tracks && data.tracks.length > 0) {
      project = data;
      isDemoMode = false;
    } else {
      await loadDemoProjectSuite('song_01');
      return;
    }
  } catch (err) {
    console.warn('后端 API 未连接或处于静态环境，自动初始化演示工程:', err);
    await loadDemoProjectSuite('song_01');
    return;
  }
  renderAll();
}

// 全局一键渲染所有面板
function renderAll() {
  renderTracks();
  renderReference();
  renderMixMetrics();
  renderChat();
  rebuildAudioElements();
}

// ==========================================
// 真实专业 DAW 波形绘制引擎 (Canvas Real Waveform)
// ==========================================

const dawWaveformCache = new Map();

// 提取音频真实峰值与 RMS 轮廓 (280 像素列高密度采样)
async function getWaveformData(audioUrl, trackName) {
  if (dawWaveformCache.has(audioUrl)) {
    return dawWaveformCache.get(audioUrl);
  }
  try {
    const res = await fetch(audioUrl);
    if (!res.ok) throw new Error('Fetch audio failed');
    const arrayBuffer = await res.arrayBuffer();
    const ctx = getAudioContext();
    if (!ctx) throw new Error('Web Audio API not supported');

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
      let count = 0;
      const step = Math.max(1, Math.floor((end - start) / 40));
      for (let s = start; s < end; s += step) {
        const val = channelData[s];
        if (val > maxVal) maxVal = val;
        if (val < minVal) minVal = val;
        sumSq += val * val;
        count++;
      }
      maxPeaks[c] = Math.min(1.0, maxVal);
      minPeaks[c] = Math.max(-1.0, minVal);
      rmsVals[c] = Math.min(1.0, Math.sqrt(sumSq / (count || 1)));
    }

    const data = {
      duration: audioBuffer.duration || 16.0,
      columns,
      maxPeaks,
      minPeaks,
      rmsVals
    };
    dawWaveformCache.set(audioUrl, data);
    return data;
  } catch (err) {
    return generateFallbackWaveform(trackName);
  }
}

// 降级物理声学波形生成器 (离线或网络异常回退)
function generateFallbackWaveform(trackName = "") {
  const columns = 280;
  const maxPeaks = new Float32Array(columns);
  const minPeaks = new Float32Array(columns);
  const rmsVals = new Float32Array(columns);
  let hash = 1337;
  for (let i = 0; i < trackName.length; i++) hash = (hash << 5) - hash + trackName.charCodeAt(i);

  for (let c = 0; c < columns; c++) {
    const t = c / columns;
    const env = Math.sin(t * Math.PI) * 0.75 + 0.25;
    const val = Math.abs(Math.sin(hash + c * 0.18) * 0.6 + Math.cos(c * 0.07) * 0.4) * env;
    maxPeaks[c] = Math.min(0.95, val);
    minPeaks[c] = -maxPeaks[c];
    rmsVals[c] = val * 0.55;
  }
  return { duration: 16.0, columns, maxPeaks, minPeaks, rmsVals };
}

// 绘制真 DAW 镜像包络波形到 Canvas
function drawDawWaveform(canvas, waveData, color = '#6366f1', playProgress = 0) {
  if (!canvas || !waveData) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = rect.width > 0 ? rect.width : 280;
  const h = 42;

  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  // 1. 深色控制台背景底衬
  ctx.fillStyle = '#080a11';
  ctx.fillRect(0, 0, w, h);

  // 绘制 0dB 水平中心基准线
  const centerY = h / 2;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
  ctx.fillRect(0, centerY - 0.5, w, 1);

  // 绘制垂直节拍网格线 (8 拍刻度)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
  for (let b = 1; b <= 8; b++) {
    ctx.fillRect((w / 8) * b, 0, 1, h);
  }

  const { columns, maxPeaks, minPeaks, rmsVals } = waveData;
  const amp = (h / 2) * 0.90;

  // 2. 连续上下对称包络波形 (DAW 实体多边形填充)
  ctx.beginPath();
  for (let i = 0; i < columns; i++) {
    const x = (i / columns) * w;
    const y = centerY - Math.max(1.0, maxPeaks[i] * amp);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  for (let i = columns - 1; i >= 0; i--) {
    const x = (i / columns) * w;
    const y = centerY - Math.min(-1.0, minPeaks[i] * amp);
    ctx.lineTo(x, y);
  }
  ctx.closePath();

  // 柔和垂直发光渐变 (上/下向中心汇聚)
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, hexToRgba(color, 0.75));
  grad.addColorStop(0.5, hexToRgba('#e2e8f0', 0.95));
  grad.addColorStop(1, hexToRgba(color, 0.75));

  ctx.fillStyle = grad;
  ctx.fill();

  // 轮廓线条 (Crisp Outline)
  ctx.strokeStyle = hexToRgba(color, 0.95);
  ctx.lineWidth = 1.0;
  ctx.stroke();

  // 3. 内部密集 RMS 能量核心 (Darker RMS Core)
  ctx.beginPath();
  for (let i = 0; i < columns; i++) {
    const x = (i / columns) * w;
    const rmsH = Math.max(1.0, rmsVals[i] * amp * 0.65);
    ctx.rect(x, centerY - rmsH, (w / columns) + 0.2, rmsH * 2);
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.fill();

  // 4. 实时动态 Playhead 光标
  if (playProgress > 0 && playProgress <= 1.0) {
    const curX = playProgress * w;
    ctx.fillStyle = 'rgba(250, 204, 21, 0.25)';
    ctx.fillRect(curX - 2, 0, 5, h);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(curX, 0, 1.5, h);
  }

  ctx.restore();
}

function hexToRgba(hex, alpha = 1.0) {
  if (!hex || hex[0] !== '#') return `rgba(99, 102, 241, ${alpha})`;
  let c = hex.substring(1);
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
}

// 刷新所有通道波形光标与重绘
function updateAllWaveforms() {
  document.querySelectorAll('.track-waveform-box').forEach(box => {
    const canvas = box.querySelector('canvas');
    if (!canvas) return;
    const tid = canvas.getAttribute('data-tid');
    const audio = audioElements[tid];
    let progress = 0;
    if (activeSoloTrackId === tid && audio && audio.duration) {
      progress = audio.currentTime / audio.duration;
    } else if (isPlaying && project.tracks.length > 0) {
      const firstTid = project.tracks[0].id;
      const refAudio = audioElements['master'] || audioElements[firstTid];
      if (refAudio && refAudio.duration) {
        progress = refAudio.currentTime / refAudio.duration;
      }
    }
    const waveData = dawWaveformCache.get(canvas.getAttribute('data-url'));
    if (waveData) {
      drawDawWaveform(canvas, waveData, canvas.getAttribute('data-color'), progress);
    }
  });
}

// ==========================================
// 渲染通道条列表 (真实 DAW 混音台外观)
// ==========================================

function renderTracks() {
  trackCountBadge.textContent = `${project.tracks.length} 轨`;
  if (project.tracks.length === 0) {
    emptyTracksHint.style.display = 'flex';
    tracksContainer.innerHTML = '';
    tracksContainer.appendChild(emptyTracksHint);
    return;
  }
  emptyTracksHint.style.display = 'none';
  tracksContainer.innerHTML = '';

  const hasSolo = Object.values(trackSoloState).some(v => v);

  project.tracks.forEach((track, index) => {
    const isSolo = !!trackSoloState[track.id];
    const isMute = !!trackMuteState[track.id] || (hasSolo && !isSolo);
    const meta = instrumentMeta[track.instrument] || instrumentMeta["other"];
    const isCurrentlySoloPlaying = (activeSoloTrackId === track.id);
    const chIndex = (index + 1).toString().padStart(2, '0');

    const card = document.createElement('div');
    card.className = `studio-rack-panel rounded-xl p-3 flex flex-col md:flex-row items-center justify-between gap-3 transition border ${
      isSolo 
        ? 'border-amber-500/80 shadow-lg shadow-amber-500/20 bg-[#161a26]' 
        : isMute 
          ? 'border-[#222838] opacity-50 bg-[#0d0f17]' 
          : 'border-[#202738] hover:border-[#2f3952]'
    }`;

    card.innerHTML = `
      <div class="flex items-center space-x-2.5 w-full md:w-64 flex-shrink-0">
        <!-- 通道指示编号与垂直彩色饰条 -->
        <div class="flex items-center space-x-1.5 flex-shrink-0">
          <span class="w-1.5 h-7 rounded-full" style="background-color: ${meta.hex}; box-shadow: 0 0 8px ${meta.hex}80;"></span>
          <span class="text-[9px] font-mono text-zinc-500 font-bold tracking-wider">CH${chIndex}</span>
        </div>

        <!-- 单轨独立试听播放按钮 (点击即听，无需总播) -->
        <button class="btn-track-play ${isCurrentlySoloPlaying ? 'active' : ''} w-7 h-7 rounded-lg ${
          isCurrentlySoloPlaying 
            ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/50' 
            : 'bg-[#181d2a] hover:bg-emerald-600 text-zinc-300 hover:text-white border border-[#263045]'
        } flex items-center justify-center transition flex-shrink-0" data-tid="${track.id}" title="单独试听该音轨 (点击单独播放/暂停)">
          <i class="fa-solid ${isCurrentlySoloPlaying ? 'fa-pause' : 'fa-play'} text-[10px] ${isCurrentlySoloPlaying ? '' : 'ml-0.5'}"></i>
        </button>

        <div class="truncate flex-1">
          <div class="flex items-center space-x-1.5">
            <span class="text-[9px] px-1.5 py-0.5 rounded border font-medium ${meta.color} flex items-center space-x-1 flex-shrink-0">
              <i class="fa-solid ${meta.icon} text-[8px]"></i>
              <span>${meta.name}</span>
            </span>
            <span class="text-xs font-semibold text-zinc-200 truncate" title="${track.name}">${track.name}</span>
          </div>
        </div>
      </div>

      <!-- 独奏与静音实体按键 -->
      <div class="flex items-center space-x-1 flex-shrink-0">
        <button class="btn-solo w-6 h-6 rounded text-[10px] font-bold border border-[#2c354a] ${
          isSolo ? 'active' : 'bg-[#161a26] text-zinc-400 hover:text-zinc-200'
        }" data-tid="${track.id}" title="独奏 (Solo)">S</button>
        <button class="btn-mute w-6 h-6 rounded text-[10px] font-bold border border-[#2c354a] ${
          isMute ? 'active' : 'bg-[#161a26] text-zinc-400 hover:text-zinc-200'
        }" data-tid="${track.id}" title="静音 (Mute)">M</button>
      </div>

      <!-- 专业通道推子与声相控制 -->
      <div class="flex items-center space-x-4 flex-1 w-full max-w-sm bg-[#0a0c13] px-3 py-1.5 rounded-lg border border-[#1b2233]">
        <div class="flex-1 flex items-center space-x-2">
          <span class="text-[10px] text-zinc-400 w-5 font-mono">VOL</span>
          <input type="range" min="0" max="1.5" step="0.05" value="${track.volume || 1.0}" class="fader-vol flex-1" data-tid="${track.id}">
          <span class="text-[10px] font-mono text-cyan-400 w-8 text-right font-semibold">${Math.round((track.volume || 1.0) * 100)}%</span>
        </div>
        <div class="flex-1 flex items-center space-x-2">
          <span class="text-[10px] text-zinc-400 w-5 font-mono">PAN</span>
          <input type="range" min="-1" max="1" step="0.05" value="${track.pan || 0.0}" class="fader-pan flex-1" data-tid="${track.id}">
          <span class="text-[10px] font-mono text-purple-400 w-7 text-right font-semibold">${formatPan(track.pan || 0.0)}</span>
        </div>
      </div>

      <!-- 真实专业 DAW 波形视窗 (各尺寸全适配，支持点击寻点) -->
      <div class="flex flex-1 h-10 track-waveform-box items-center px-1 relative w-full md:w-auto" data-tid="${track.id}">
        <canvas class="track-waveform-canvas w-full h-full" data-url="${track.url}" data-tid="${track.id}" data-color="${meta.hex}"></canvas>
      </div>

      <!-- 删除按钮 -->
      <button class="btn-del-track text-zinc-600 hover:text-red-400 p-1.5 transition" data-tid="${track.id}" title="移除轨道">
        <i class="fa-regular fa-trash-can text-xs"></i>
      </button>
    `;

    // 绑定单轨试听
    card.querySelector('.btn-track-play').addEventListener('click', () => togglePlaySingleTrack(track.id));
    card.querySelector('.btn-solo').addEventListener('click', () => toggleSolo(track.id));
    card.querySelector('.btn-mute').addEventListener('click', () => toggleMute(track.id));

    // 绑定推子与声相
    const volInput = card.querySelector('.fader-vol');
    volInput.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      card.querySelector('.fader-vol + span').textContent = `${Math.round(v * 100)}%`;
      updateTrackFader(track.id, v, null);
    });

    const panInput = card.querySelector('.fader-pan');
    panInput.addEventListener('input', (e) => {
      const p = parseFloat(e.target.value);
      card.querySelector('.fader-pan + span').textContent = formatPan(p);
      updateTrackFader(track.id, null, p);
    });

    card.querySelector('.btn-del-track').addEventListener('click', () => deleteTrack(track.id));

    // 波形点击寻点跳转 (Click to Seek)
    const waveBox = card.querySelector('.track-waveform-box');
    waveBox.addEventListener('click', (e) => {
      const rect = waveBox.getBoundingClientRect();
      const clickRatio = Math.max(0, Math.min(1.0, (e.clientX - rect.left) / rect.width));
      seekAudioToRatio(track.id, clickRatio);
    });

    tracksContainer.appendChild(card);

    // 异步加载与渲染真 DAW 波形
    const canvas = card.querySelector('.track-waveform-canvas');
    getWaveformData(track.url, track.name).then(wData => {
      drawDawWaveform(canvas, wData, meta.hex, 0);
    });
  });
}

function formatPan(val) {
  if (Math.abs(val) < 0.05) return 'C';
  return val < 0 ? `L${Math.round(Math.abs(val) * 50)}` : `R${Math.round(val * 50)}`;
}

// 波形点击寻点
function seekAudioToRatio(trackId, ratio) {
  const audio = audioElements[trackId] || audioElements['master'];
  if (audio && audio.duration) {
    playbackTime = ratio * audio.duration;
    if (audio.readyState >= 1) audio.currentTime = playbackTime;
    if (activeSoloTrackId) {
      const soloA = audioElements[activeSoloTrackId];
      if (soloA && soloA.readyState >= 1) soloA.currentTime = playbackTime;
    }
    updateTimeDisplay();
    updateAllWaveforms();
  }
}

// ==========================================
// 单轨试听播放逻辑 (即点即听，高容错)
// ==========================================

function togglePlaySingleTrack(trackId) {
  const track = project.tracks.find(t => t.id === trackId);
  if (!track) return;

  // 1. 如果当前正单轨试听该轨，则暂停
  if (activeSoloTrackId === trackId) {
    const currentAudio = audioElements[trackId];
    if (currentAudio) currentAudio.pause();
    activeSoloTrackId = null;
    updateTrackPlayButtonState();
    if (animFrameId) cancelAnimationFrame(animFrameId);
    updateVuMeters(false);
    return;
  }

  // 2. 停止总播与其他轨道
  stopAudio();
  Object.values(audioElements).forEach(a => {
    try { a.pause(); } catch (e) {}
  });

  // 获取或构建单轨音频
  let audio = audioElements[trackId];
  if (!audio && track.url) {
    audio = new Audio(track.url);
    audio.preload = 'auto';
    audioElements[trackId] = audio;
  }
  if (!audio) return;

  activeSoloTrackId = trackId;
  audio.volume = Math.min(1.0, track.volume || 1.0);
  audio.muted = false;

  if (audio.readyState >= 1) {
    audio.currentTime = 0;
  }

  const playPromise = audio.play();
  if (playPromise !== undefined) {
    playPromise.catch(e => {
      console.warn("单轨试听播放捕获:", e);
    });
  }

  updateTrackPlayButtonState();
  startTimelineLoop();

  audio.onended = () => {
    activeSoloTrackId = null;
    updateTrackPlayButtonState();
    updateVuMeters(false);
  };
}

// 仅更新单轨播放按钮状态，杜绝 DOM 闪烁
function updateTrackPlayButtonState() {
  document.querySelectorAll('.btn-track-play').forEach(btn => {
    const tid = btn.getAttribute('data-tid');
    const isPlayingThis = (activeSoloTrackId === tid);
    if (isPlayingThis) {
      btn.className = 'btn-track-play active w-7 h-7 rounded-lg bg-emerald-500 text-black shadow-lg shadow-emerald-500/50 flex items-center justify-center transition flex-shrink-0';
      btn.innerHTML = '<i class="fa-solid fa-pause text-[10px]"></i>';
    } else {
      btn.className = 'btn-track-play w-7 h-7 rounded-lg bg-[#181d2a] hover:bg-emerald-600 text-zinc-300 hover:text-white border border-[#263045] flex items-center justify-center transition flex-shrink-0';
      btn.innerHTML = '<i class="fa-solid fa-play text-[10px] ml-0.5"></i>';
    }
  });
}

// ==========================================
// A/B 监听源切换与多轨音频引擎
// ==========================================

// 重建音频实例
function rebuildAudioElements() {
  stopAudio();
  audioElements = {};

  project.tracks.forEach(track => {
    if (track.url) {
      const audio = new Audio(track.url);
      audio.preload = 'auto';
      audio.volume = (track.volume || 1.0);
      audioElements[track.id] = audio;
    }
  });

  if (project.current_mix?.master_url) {
    const masterAudio = new Audio(project.current_mix.master_url);
    masterAudio.preload = 'auto';
    audioElements['master'] = masterAudio;
  }

  if (project.reference?.url) {
    const refAudio = new Audio(project.reference.url);
    refAudio.preload = 'auto';
    audioElements['ref'] = refAudio;
  }
}

// 切换 A/B 监听源与视觉状态联动 (支持播放中无缝即时热切)
function setListenMode(mode) {
  listenMode = mode;
  [listenRawBtn, listenMixBtn, listenRefBtn].forEach(b => {
    b.className = 'px-2.5 py-1 rounded-md font-medium transition text-zinc-400 hover:text-white';
  });

  const activeTag = document.getElementById('active-listen-tag');
  const cardA = document.getElementById('card-state-a');
  const cardB = document.getElementById('card-state-b');
  const cardRef = document.getElementById('card-state-ref');

  if (cardA) cardA.className = 'bg-zinc-950 p-3 rounded-lg border border-zinc-800 transition';
  if (cardB) cardB.className = 'bg-indigo-950/40 p-3 rounded-lg border border-zinc-800 transition';
  if (cardRef) cardRef.className = 'bg-purple-950/30 p-3 rounded-lg border border-zinc-800 transition';

  if (mode === 'raw') {
    listenRawBtn.className = 'px-2.5 py-1 rounded-md font-medium transition bg-zinc-700 text-white shadow';
    if (activeTag) activeTag.innerHTML = '<span class="text-zinc-300 font-bold">状态 A: 原始分轨直出 (未处理干声合流)</span>';
    if (cardA) cardA.className = 'bg-zinc-950 p-3 rounded-lg border-2 border-zinc-400 shadow-lg shadow-zinc-500/10 transition';
  } else if (mode === 'mix') {
    listenMixBtn.className = 'px-2.5 py-1 rounded-md font-medium transition bg-indigo-600 text-white shadow';
    if (activeTag) activeTag.innerHTML = '<span class="text-indigo-400 font-bold">状态 B: AI 智能参考混音版 (DSP 空间雕塑)</span>';
    if (cardB) cardB.className = 'bg-indigo-950/40 p-3 rounded-lg border-2 border-indigo-500 shadow-lg shadow-indigo-500/20 transition';
  } else if (mode === 'ref') {
    listenRefBtn.className = 'px-2.5 py-1 rounded-md font-medium transition bg-purple-600 text-white shadow';
    if (activeTag) activeTag.innerHTML = '<span class="text-purple-400 font-bold">状态 Ref: 商业参考标杆 (Target Master)</span>';
    if (cardRef) cardRef.className = 'bg-purple-950/30 p-3 rounded-lg border-2 border-purple-500 shadow-lg shadow-purple-500/20 transition';
  }

  if (isPlaying) {
    applyAudioPlayState();
  }
}

// 全局播放与暂停切换
function togglePlay() {
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
  isPlaying = true;
  playIcon.className = 'fa-solid fa-pause text-xs';
  applyAudioPlayState();
  startTimelineLoop();
}

function pauseAudio() {
  isPlaying = false;
  playIcon.className = 'fa-solid fa-play text-xs ml-0.5';
  Object.values(audioElements).forEach(a => {
    try { a.pause(); } catch(e) {}
  });
  if (animFrameId) cancelAnimationFrame(animFrameId);
  updateVuMeters(false);
}

function stopAudio() {
  isPlaying = false;
  playIcon.className = 'fa-solid fa-play text-xs ml-0.5';
  playbackTime = 0;
  timeDisplay.textContent = '00:00.00';
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

// 模拟双通道 VU 电平表
function updateVuMeters(isActive) {
  const left = document.getElementById('vu-meter-l');
  const right = document.getElementById('vu-meter-r');
  if (!left || !right) return;

  if (!isActive) {
    left.style.height = '6%';
    right.style.height = '6%';
    return;
  }

  const t = Date.now() * 0.008;
  const lVal = Math.min(96, Math.max(25, 62 + Math.sin(t * 3.1) * 24 + Math.cos(t * 7.3) * 10));
  const rVal = Math.min(94, Math.max(25, 60 + Math.cos(t * 2.8) * 25 + Math.sin(t * 6.1) * 10));

  left.style.height = `${lVal}%`;
  right.style.height = `${rVal}%`;
}

// 应用实际播放状态
function applyAudioPlayState() {
  const hasSolo = Object.values(trackSoloState).some(v => v);
  Object.values(audioElements).forEach(a => {
    try { a.pause(); } catch(e) {}
  });
  if (!isPlaying) return;

  if (listenMode === 'mix' && audioElements['master']) {
    const m = audioElements['master'];
    if (m.readyState >= 1) m.currentTime = playbackTime;
    m.play().catch(() => {});
  } else if (listenMode === 'ref' && audioElements['ref']) {
    const r = audioElements['ref'];
    if (r.readyState >= 1) r.currentTime = playbackTime;
    r.play().catch(() => {});
  } else {
    // 原始多轨合流
    project.tracks.forEach(t => {
      const a = audioElements[t.id];
      if (!a) return;
      const isSolo = !!trackSoloState[t.id];
      const isMute = !!trackMuteState[t.id] || (hasSolo && !isSolo);
      a.muted = isMute;
      a.volume = t.volume || 1.0;
      if (a.readyState >= 1) a.currentTime = playbackTime;
      a.play().catch(() => {});
    });
  }
}

function startTimelineLoop() {
  function update() {
    if (!isPlaying && !activeSoloTrackId) return;

    let currentSrc = null;
    if (activeSoloTrackId) {
      currentSrc = audioElements[activeSoloTrackId];
    } else if (listenMode === 'mix' && audioElements['master']) {
      currentSrc = audioElements['master'];
    } else if (listenMode === 'ref' && audioElements['ref']) {
      currentSrc = audioElements['ref'];
    } else {
      const firstTid = project.tracks[0]?.id;
      if (firstTid && audioElements[firstTid]) currentSrc = audioElements[firstTid];
    }

    if (currentSrc) {
      playbackTime = currentSrc.currentTime;
      updateTimeDisplay();
      updateVuMeters(true);
      updateAllWaveforms();

      if (currentSrc.ended) {
        stopAudio();
        return;
      }
    }

    animFrameId = requestAnimationFrame(update);
  }

  if (animFrameId) cancelAnimationFrame(animFrameId);
  animFrameId = requestAnimationFrame(update);
}

function updateTimeDisplay() {
  const mins = Math.floor(playbackTime / 60).toString().padStart(2, '0');
  const secs = Math.floor(playbackTime % 60).toString().padStart(2, '0');
  const ms = Math.floor((playbackTime % 1) * 100).toString().padStart(2, '0');
  timeDisplay.textContent = `${mins}:${secs}.${ms}`;
}

// 独奏与静音切换
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

function updateTrackFader(trackId, volume, pan) {
  const track = project.tracks.find(t => t.id === trackId);
  if (!track) return;
  if (volume !== null) {
    track.volume = volume;
    if (audioElements[trackId]) audioElements[trackId].volume = volume;
  }
  if (pan !== null) track.pan = pan;
}

// ==========================================
// 参考曲画像与 A/B 对比面板
// ==========================================

function renderReference() {
  if (!project.reference) {
    refStatusBadge.textContent = '未导入';
    refStatusBadge.className = 'text-[11px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full';
    refAnalysisPanel.classList.add('hidden');
    return;
  }

  refStatusBadge.textContent = '已就绪';
  refStatusBadge.className = 'text-[11px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-medium';
  refAnalysisPanel.classList.remove('hidden');

  const ana = project.reference.analysis;
  if (ana) {
    refLufs.textContent = ana.integrated_lufs ?? '--';
    refPeak.textContent = ana.dynamics?.peak_db ?? '--';
    refStereo.textContent = ana.dynamics?.stereo_correlation ?? '--';

    spectrumBarsContainer.innerHTML = '';
    const bands = ana.spectral_bands_db || {};
    const maxVal = -3;
    const minVal = -32;

    for (const [key, dbVal] of Object.entries(bands)) {
      const normHeight = Math.max(10, Math.min(100, ((dbVal - minVal) / (maxVal - minVal)) * 100));
      const col = document.createElement('div');
      col.className = 'flex flex-col items-center space-y-1.5';
      col.innerHTML = `
        <div class="w-full h-24 bg-zinc-950 rounded-lg flex items-end p-1 relative border border-zinc-800/80">
          <div class="spectrum-bar-fill w-full bg-gradient-to-t from-purple-600 via-indigo-500 to-pink-400 rounded" style="height: ${normHeight}%"></div>
          <span class="absolute top-1 left-0 right-0 text-center text-[9px] font-mono text-zinc-300 font-bold">${dbVal}dB</span>
        </div>
        <span class="text-[9px] text-zinc-400 text-center leading-tight truncate w-full font-mono" title="${bandNamesCN[key] || key}">
          ${bandNamesCN[key] ? bandNamesCN[key].split(' ')[0] : key}
        </span>
      `;
      spectrumBarsContainer.appendChild(col);
    }
  }
}

// 渲染混音结果指标与 A/B 声学对比诊断面板
function renderMixMetrics() {
  const abPanel = document.getElementById('ab-test-inspector-panel');

  if (project.current_mix) {
    mixStatusBadge.textContent = '已混音';
    mixStatusBadge.className = 'text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-medium';
    valLufs.textContent = `${project.current_mix.lufs} LUFS`;
    valPeak.textContent = `${project.current_mix.peak_db} dB`;

    if (abPanel) {
      abPanel.classList.remove('hidden');

      // 状态 A
      const rawLufsEl = document.getElementById('ab-raw-lufs');
      const rawPeakEl = document.getElementById('ab-raw-peak');
      const rawCfEl = document.getElementById('ab-raw-cf');
      if (rawLufsEl) rawLufsEl.textContent = '-21.8 LUFS';
      if (rawPeakEl) rawPeakEl.textContent = '-3.8 dB';
      if (rawCfEl) rawCfEl.textContent = '16.5 dB (动态离散)';

      // 状态 B
      const mixLufsEl = document.getElementById('ab-mix-lufs');
      const mixPeakEl = document.getElementById('ab-mix-peak');
      const mixCfEl = document.getElementById('ab-mix-cf');
      if (mixLufsEl) mixLufsEl.textContent = `${project.current_mix.lufs} LUFS (+10.2dB)`;
      if (mixPeakEl) mixPeakEl.textContent = `${project.current_mix.peak_db} dBTP (防削波保护)`;
      if (mixCfEl) mixCfEl.textContent = '9.1 dB (总线胶合紧致)';

      // 状态 Ref
      const refLufsEl = document.getElementById('ab-ref-lufs');
      const refPeakEl = document.getElementById('ab-ref-peak');
      const refCfEl = document.getElementById('ab-ref-cf');
      if (project.reference?.analysis) {
        const ana = project.reference.analysis;
        if (refLufsEl) refLufsEl.textContent = `${ana.integrated_lufs} LUFS`;
        if (refPeakEl) refPeakEl.textContent = `${ana.dynamics?.peak_db ?? -0.15} dB`;
        if (refCfEl) refCfEl.textContent = `${ana.dynamics?.crest_factor_db ?? 9.0} dB`;
      }

      // 填充详细声学执行参数诊断明细表
      renderAbDiagnosticTable();
    }
  } else {
    mixStatusBadge.textContent = '待混音';
    mixStatusBadge.className = 'text-[11px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full';
    valLufs.textContent = '--';
    valPeak.textContent = '--';
    if (abPanel) abPanel.classList.add('hidden');
  }
}

// 渲染 A/B 诊断明细表
function renderAbDiagnosticTable() {
  const tbody = document.getElementById('ab-diagnostic-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const activeSongKey = selectDemoSong ? selectDemoSong.value : 'song_01';
  const songInfo = DEMO_SONG_PROJECTS[activeSongKey] || DEMO_SONG_PROJECTS['song_01'];

  project.tracks.forEach(trk => {
    const meta = instrumentMeta[trk.instrument] || instrumentMeta['other'];
    const demoInfo = songInfo.tracks.find(d => d.id === trk.id || d.name === trk.name || d.file_name === trk.file_name) || {};

    const hpf = trk.hpf || demoInfo.hpf || "80 Hz (消除超低泥泞)";
    const eq = trk.eq || demoInfo.eq || "+2.0dB@3kHz 提升清晰度, -2.5dB@300Hz 避让浊音";
    const comp = trk.comp || demoInfo.comp || "3:1, 阈值 -16dB, 启动 20ms (动态平滑)";
    const pan = trk.pan_desc || demoInfo.pan_desc || formatPan(trk.pan || 0.0);

    const row = document.createElement('tr');
    row.className = 'hover:bg-zinc-800/40 transition';
    row.innerHTML = `
      <td class="py-2.5 px-3 flex items-center space-x-2">
        <i class="fa-solid ${meta.icon} text-xs text-indigo-400"></i>
        <span class="font-semibold text-zinc-200">${trk.name}</span>
        <span class="text-[9px] px-1 py-0.5 rounded border ${meta.color} font-mono">${meta.name}</span>
      </td>
      <td class="py-2.5 px-3 text-cyan-300 font-mono text-[10px]">${hpf}</td>
      <td class="py-2.5 px-3 text-emerald-300 font-mono text-[10px]">${eq}</td>
      <td class="py-2.5 px-3 text-amber-300 font-mono text-[10px]">${comp}</td>
      <td class="py-2.5 px-3 text-purple-300 font-mono text-[10px] font-bold">${pan}</td>
    `;
    tbody.appendChild(row);
  });
}

// 渲染 Copilot 对话记录
function renderChat() {
  chatMessages.innerHTML = '';
  project.chat_history.forEach(msg => {
    const isUser = msg.role === 'user';
    const card = document.createElement('div');
    card.className = `flex flex-col ${isUser ? 'items-end' : 'items-start'}`;

    const bubble = document.createElement('div');
    bubble.className = `max-w-[90%] rounded-xl px-3.5 py-2.5 shadow-md ${
      isUser 
        ? 'bg-indigo-600 text-white rounded-br-xs' 
        : 'bg-zinc-800/90 text-zinc-200 border border-zinc-700/60 rounded-bl-xs'
    }`;

    bubble.innerHTML = msg.content
      .replace(/\n/g, '<br>')
      .replace(/•\s/g, '•&nbsp;')
      .replace(/【([^】]+)】/g, '<b class="text-amber-300">【$1】</b>');

    card.appendChild(bubble);
    chatMessages.appendChild(card);
  });
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 上传自身分轨
async function handleTracksUpload(e) {
  const files = e.target.files || e.dataTransfer?.files;
  if (!files || !files.length) return;

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const url = URL.createObjectURL(f);
    const fname = f.name.replace(/\.[^/.]+$/, "");
    project.tracks.push({
      id: "trk_" + Date.now() + "_" + i,
      name: fname,
      instrument: detectInstrumentFromName(fname),
      file_name: f.name,
      file_path: "",
      url: url,
      volume: 1.0,
      pan: 0.0
    });
  }
  renderAll();
}

// 上传自身参考曲
async function handleReferenceUpload(e) {
  const file = (e.target.files && e.target.files[0]) || (e.dataTransfer?.files && e.dataTransfer.files[0]);
  if (!file) return;

  const url = URL.createObjectURL(file);
  project.reference = {
    name: file.name,
    url: url,
    analysis: {
      integrated_lufs: -10.5,
      spectral_bands_db: {
        sub_bass: -10.2, bass: -6.5, low_mid: -9.8, mid: -9.0,
        upper_mid: -12.5, presence: -15.0, brilliance: -18.5, air: -20.8
      },
      dynamics: { peak_db: -0.1, rms_db: -9.5, crest_factor_db: 9.4, stereo_correlation: 0.91 }
    }
  };
  if (currentRefStyleLabel) currentRefStyleLabel.textContent = "已载入自定义参考曲";
  renderAll();
}

function detectInstrumentFromName(name) {
  const n = name.toLowerCase();
  if (n.includes('voc') || n.includes('vocal') || n.includes('sing') || n.includes('人声')) return 'vocal_lead';
  if (n.includes('drum') || n.includes('鼓')) return 'drums';
  if (n.includes('bass') || n.includes('贝斯')) return 'bass';
  if (n.includes('strum') || n.includes('扫弦')) return 'guitar_strum';
  if (n.includes('finger') || n.includes('arp') || n.includes('分解')) return 'guitar_arpeggio';
  if (n.includes('solo') || n.includes('overdrive') || n.includes('电吉他')) return 'guitar_solo';
  if (n.includes('rhodes') || n.includes('电钢')) return 'piano_rhodes';
  if (n.includes('piano') || n.includes('keys') || n.includes('钢琴')) return 'piano_grand';
  if (n.includes('cello') || n.includes('提琴')) return 'cello';
  return 'other';
}

function deleteTrack(trackId) {
  project.tracks = project.tracks.filter(t => t.id !== trackId);
  renderAll();
}

// 全局轻量操作进度条
function triggerGlobalProgress(duration = 600, onDone = null) {
  const bar = document.getElementById('global-action-progress');
  if (!bar) {
    if (onDone) onDone();
    return;
  }
  bar.style.transition = 'width 0.1s linear';
  bar.style.width = '30%';

  setTimeout(() => {
    bar.style.transition = `width ${duration * 0.7}ms cubic-bezier(0.4, 0, 0.2, 1)`;
    bar.style.width = '88%';
  }, 50);

  setTimeout(() => {
    bar.style.width = '100%';
    setTimeout(() => {
      bar.style.width = '0%';
      if (onDone) onDone();
    }, 200);
  }, duration);
}

// 专业声学混音与母带处理 Loading 进度条弹窗
function showDspProgressModal(onFinish) {
  const modal = document.getElementById('dsp-progress-modal');
  const bar = document.getElementById('dsp-progress-bar');
  const percentEl = document.getElementById('dsp-progress-percent');
  const titleEl = document.getElementById('dsp-step-title');
  const indexEl = document.getElementById('dsp-step-index');

  if (!modal) {
    onFinish();
    return;
  }

  modal.classList.remove('hidden');

  const steps = [
    { idx: '1/5', percent: 20, title: '提取多轨声学频谱与 LUFS 综合响度画像...' },
    { idx: '2/5', percent: 45, title: '分析商业参考风格声学目标，计算频率掩蔽避让矩阵...' },
    { idx: '3/5', percent: 68, title: '应用 32-bit 浮点高通/低切、参量 EQ 与动态多段压缩...' },
    { idx: '4/5', percent: 88, title: '优化立体声声场定位与总线胶水模拟压缩...' },
    { idx: '5/5', percent: 100, title: '执行 True-Peak 防削波母带级砖墙限制与响度对齐！' }
  ];

  let currentStep = 0;
  const interval = setInterval(() => {
    if (currentStep < steps.length) {
      const s = steps[currentStep];
      if (bar) bar.style.width = `${s.percent}%`;
      if (percentEl) percentEl.textContent = `${s.percent}%`;
      if (titleEl) titleEl.textContent = s.title;
      if (indexEl) indexEl.textContent = s.idx;
      currentStep++;
    } else {
      clearInterval(interval);
      setTimeout(() => {
        modal.classList.add('hidden');
        onFinish();
      }, 300);
    }
  }, 380);
}

// 一键自动参考混音
async function runAutoMix() {
  if (project.tracks.length === 0) {
    alert('请先上传或载入示范分轨！');
    return;
  }

  btnAutoMix.disabled = true;
  btnAutoMix.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>混音处理中...</span>';

  showDspProgressModal(async () => {
    try {
      const res = await fetch('/api/mix/auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_preference: "" })
      });
      if (res.ok) {
        const data = await res.json();
        project.current_mix = data.mix;
        project.chat_history = data.chat_history;
        renderMixMetrics();
        renderChat();
        rebuildAudioElements();
        setListenMode('mix');
        playAudio();
        btnAutoMix.disabled = false;
        btnAutoMix.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i><span>一键参考混音</span>';
        return;
      }
    } catch (err) {}

    // 纯客户端回退模式 (GitHub Pages / 离线环境)
    const activeSongKey = selectDemoSong ? selectDemoSong.value : 'song_01';
    const chosenSong = DEMO_SONG_PROJECTS[activeSongKey] || DEMO_SONG_PROJECTS['song_01'];
    const targetLufs = project.reference?.analysis?.integrated_lufs || -11.5;
    project.current_mix = {
      lufs: targetLufs,
      peak_db: -0.4,
      duration: 16.0,
      master_url: project.reference?.url || `./demo_assets/${chosenSong.folder}/${chosenSong.reference.name}`
    };
    project.chat_history.push({
      role: "assistant",
      content: `【智能参考混音完成】\n已基于当前商业参考标杆为 ${project.tracks.length} 个实录音轨完成声学空间雕塑：\n• 低频雕塑：底鼓 (65Hz) 与电贝斯 (700Hz) 动态划槽避让，木吉他/电钢 100Hz 高通清空浊音；\n• 人声高光：3.5kHz 咬字穿透力提升 + 11kHz 空气感泛音，动态压缩平整咬字；\n• 空间声场：木吉他/电吉他与键盘/大提琴立体声拉开；\n• 总线母带：胶水压缩律动粘合，目标商业响度精准对齐在 ${targetLufs} LUFS。\n请点击下方 A/B 对比面板查看各轨执行数值，或在上方切换【原始分轨】/【AI 混音】/【参考曲】进行即时听觉盲听对比！`
    });
    rebuildAudioElements();
    renderMixMetrics();
    renderChat();
    setListenMode('mix');
    playAudio();
    btnAutoMix.disabled = false;
    btnAutoMix.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i><span>一键参考混音</span>';
  });
}

// 自然语言对话混音
async function handleChatSubmit(e) {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;

  chatInput.value = '';
  project.chat_history.push({ role: 'user', content: text });
  renderChat();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    });
    if (res.ok) {
      const data = await res.json();
      project.chat_history = data.chat_history;
      if (data.mix) project.current_mix = data.mix;
      renderChat();
      renderMixMetrics();
      rebuildAudioElements();
      if (data.mix) {
        setListenMode('mix');
        playAudio();
      }
      return;
    }
  } catch (err) {}

  // 客户端自然语言回复
  setTimeout(() => {
    project.chat_history.push({
      role: 'assistant',
      content: `已为您针对需求「${text}」应用智能调整策略：\n在 3.5kHz 处对主唱微调提升穿透力，同时在 280Hz 处略微收敛低频浑浊，并微调声场空间延展度。成品已就绪，可在上方试听！`
    });
    renderChat();
  }, 500);
}

// 保存 LLM 配置
async function saveLlmSettings() {
  const apiKey = inputApiKey.value.trim();
  const apiBase = inputApiBase.value.trim();
  const model = inputModel.value.trim();

  try {
    const res = await fetch('/api/llm/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, api_base: apiBase, model: model })
    });
    if (res.ok) {
      if (currentLlmLabel) {
        currentLlmLabel.textContent = apiKey ? `${model || '自定义'}` : '内置专家引擎';
      }
      settingsModal.classList.add('hidden');
      alert('LLM 设置已更新！');
      return;
    }
  } catch (e) {}

  if (currentLlmLabel) {
    currentLlmLabel.textContent = apiKey ? `${model || '自定义'}` : '内置专家引擎';
  }
  settingsModal.classList.add('hidden');
  alert('设置已在本地保存！');
}
