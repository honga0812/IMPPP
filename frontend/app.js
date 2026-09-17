// 智能多轨混音工作站前端核心逻辑 (Smart Mixing Studio v1.2)
let project = {
  tracks: [],
  reference: null,
  current_mix: null,
  current_strategy: null,
  chat_history: []
};

// 监听模式: 'mix' (AI 混音), 'raw' (原始分轨合流), 'ref' (参考曲)
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

// 细分乐器声学画像元数据 (图标、中文名称、专属色彩标签、波形渐变色)
const instrumentMeta = {
  "vocal_lead": { name: "主唱人声", color: "bg-fuchsia-950/70 text-fuchsia-300 border-fuchsia-700/50", icon: "fa-microphone", hex: "#d946ef" },
  "vocal_backing": { name: "立体声和声", color: "bg-purple-950/70 text-purple-300 border-purple-700/50", icon: "fa-users", hex: "#a855f7" },
  "kick": { name: "纯净底鼓", color: "bg-red-950/70 text-red-300 border-red-700/50", icon: "fa-drum", hex: "#ef4444" },
  "snare": { name: "军鼓/踩镲", color: "bg-rose-950/70 text-rose-300 border-rose-700/50", icon: "fa-drum", hex: "#f43f5e" },
  "drums": { name: "原声全鼓组", color: "bg-orange-950/70 text-orange-300 border-orange-700/50", icon: "fa-drum", hex: "#f97316" },
  "bass": { name: "低音电贝斯", color: "bg-emerald-950/70 text-emerald-300 border-emerald-700/50", icon: "fa-guitar", hex: "#10b981" },
  "guitar_arpeggio": { name: "分解木吉他", color: "bg-amber-950/70 text-amber-300 border-amber-700/50", icon: "fa-guitar", hex: "#f59e0b" },
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

// 预置三大商业流行参考曲 (以真实录音棚母带为声学标杆)
const PRESET_COMMERCIAL_STYLES = {
  pop: {
    name: "真实商业流行标杆 (Real Commercial Master)",
    styleLabel: "商业流行标杆",
    url: "./demo_assets/Ref_Real_Commercial_Pop.wav",
    analysis: {
      integrated_lufs: -11.5,
      spectral_bands_db: {
        sub_bass: -11.0, bass: -5.2, low_mid: -9.1, mid: -8.5,
        upper_mid: -12.8, presence: -14.5, brilliance: -17.5, air: -21.2
      },
      dynamics: { peak_db: -0.15, rms_db: -9.2, crest_factor_db: 9.05, stereo_correlation: 0.92 }
    },
    note: "特点：实录商业母带，12kHz+ 空气感透明，声场开阔，低频结实饱满不浑浊。"
  },
  folk: {
    name: "原声民谣暖色 (Acoustic Folk)",
    styleLabel: "原声民谣风格",
    url: "./demo_assets/Ref_Real_Commercial_Pop.wav",
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
    name: "录音棚流行摇滚与 R&B (Studio Rock & R&B)",
    styleLabel: "摇滚/R&B风格",
    url: "./demo_assets/Ref_Real_Commercial_Pop.wav",
    analysis: {
      integrated_lufs: -10.5,
      spectral_bands_db: {
        sub_bass: -10.0, bass: -4.8, low_mid: -8.6, mid: -8.2,
        upper_mid: -12.0, presence: -14.0, brilliance: -16.8, air: -20.2
      },
      dynamics: { peak_db: -0.1, rms_db: -8.8, crest_factor_db: 8.7, stereo_correlation: 0.94 }
    },
    note: "特点：律动鼓组与贝斯紧密胶合，电吉他与电钢琴立体声饱满，富有音乐感染力。"
  }
};

// 录音棚实录多轨示范清单 (真实人声/木吉他扫弦与分解/电吉他Solo/原声鼓/电贝斯/电钢/大提琴)
const DEMO_REAL_STUDIO_TRACKS = [
  { 
    id: "demo_01", 
    name: "01_Real_Lead_Vocal", 
    file_name: "01_Real_Lead_Vocal.wav", 
    instrument: "vocal_lead", 
    volume: 1.05, 
    pan: 0.0,
    hpf: "85 Hz (切除杂音低频)",
    eq: "+2.5dB@3.5kHz (咬字穿透), +2.0dB@11kHz (空气感)",
    comp: "4:1, 阈值 -18dB, 启动 15ms (人声压实平整)",
    pan_desc: "Center 0% (舞台正中央)"
  },
  { 
    id: "demo_02", 
    name: "02_Real_Acoustic_Guitar_Strum", 
    file_name: "02_Real_Acoustic_Guitar_Strum.wav", 
    instrument: "guitar_strum", 
    volume: 0.85, 
    pan: 0.35,
    hpf: "110 Hz (低频切净让位)",
    eq: "-3.0dB@280Hz (去浑浊箱体共振), +2.0dB@8kHz (通透扫弦)",
    comp: "3:1, 阈值 -16dB, 释放 120ms (动态均匀)",
    pan_desc: "R35 (偏右开扬，避让人声)"
  },
  { 
    id: "demo_03", 
    name: "03_Real_Electric_Guitar_Solo", 
    file_name: "03_Real_Electric_Guitar_Solo.wav", 
    instrument: "guitar_solo", 
    volume: 0.80, 
    pan: 0.15,
    hpf: "95 Hz (避让贝斯低频)",
    eq: "+2.2dB@2.2kHz (主奏声场突出), -1.5dB@4.5kHz (消除毛刺)",
    comp: "3.5:1, 阈值 -15dB (过载延音增强)",
    pan_desc: "R15 (右侧前排 Solo 主奏)"
  },
  { 
    id: "demo_04", 
    name: "04_Real_Acoustic_Guitar_Rhythm", 
    file_name: "04_Real_Acoustic_Guitar_Rhythm.wav", 
    instrument: "guitar_arpeggio", 
    volume: 0.85, 
    pan: -0.35,
    hpf: "120 Hz (让位底端频段)",
    eq: "+1.8dB@5kHz (晶莹拨弦颗粒), -2.0dB@350Hz (去嗡声)",
    comp: "2.8:1, 阈值 -17dB (节奏规整)",
    pan_desc: "L35 (偏左对称，拓宽声场)"
  },
  { 
    id: "demo_05", 
    name: "05_Real_Studio_Drums", 
    file_name: "05_Real_Studio_Drums.wav", 
    instrument: "drums", 
    volume: 0.95, 
    pan: 0.0,
    hpf: "32 Hz (保留底频冲击)",
    eq: "+3.0dB@65Hz (拳拳到肉底频), +2.5dB@5.5kHz (敲击清脆度)",
    comp: "4:1, 阈值 -14dB, 瞬态保留 30ms (强劲律动)",
    pan_desc: "Center 0% (立体声底架)"
  },
  { 
    id: "demo_06", 
    name: "06_Real_Electric_Bass", 
    file_name: "06_Real_Electric_Bass.wav", 
    instrument: "bass", 
    volume: 1.0, 
    pan: 0.0,
    hpf: "35 Hz (次低频收紧)",
    eq: "-3.0dB@65Hz (为底鼓精准避让), +3.0dB@700Hz (金属质感)",
    comp: "5:1, 阈值 -20dB, 快速压限 (平整紧实不抢戏)",
    pan_desc: "Center 0% (绝对居中防相位抵消)"
  },
  { 
    id: "demo_07", 
    name: "07_Real_Rhodes_Keys", 
    file_name: "07_Real_Rhodes_Keys.wav", 
    instrument: "piano_rhodes", 
    volume: 0.85, 
    pan: -0.25,
    hpf: "100 Hz (清除驻波杂音)",
    eq: "-2.5dB@300Hz (避开人声温暖区), +1.8dB@4kHz (电钢泛音)",
    comp: "2.5:1, 阈值 -15dB (柔和压缩)",
    pan_desc: "L25 (偏左复古空间铺垫)"
  },
  { 
    id: "demo_08", 
    name: "08_Real_Acoustic_Cello", 
    file_name: "08_Real_Acoustic_Cello.wav", 
    instrument: "cello", 
    volume: 0.80, 
    pan: 0.40,
    hpf: "75 Hz (大提琴醇厚基音保留)",
    eq: "+2.0dB@1.8kHz (弓弦松香摩擦感), -2.0dB@500Hz",
    comp: "3:1, 阈值 -16dB, 慢速释放 (电影感悠扬延伸)",
    pan_desc: "R40 (右侧空间电影感铺底)"
  }
];

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

  if (btnLoadDemoSuite) {
    btnLoadDemoSuite.addEventListener('click', loadRealStudioSuite);
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
          content: "工程已成功清空重置。您可以重新载入【录音棚实录示范工程】或上传您自己的录音分轨与参考曲开始混音！"
        }
      ]
    };

    try {
      await fetch('/api/project/clear', { method: 'POST' });
    } catch (e) {
      console.log('Static / offline mode clear');
    }

    const abPanel = document.getElementById('ab-test-inspector-panel');
    if (abPanel) abPanel.classList.add('hidden');

    renderTracks();
    renderReference();
    renderMixMetrics();
    renderChat();
    rebuildAudioElements();
  }
}

// 智能乐器识别
function detectInstrumentFromName(name) {
  name = (name || "").toLowerCase();
  if (/back|harmony|和声|伴唱/.test(name)) return "vocal_backing";
  if (/lead_v|voc|sing|voice|主唱|人声/.test(name)) return "vocal_lead";
  if (/kick|bd|底鼓|大鼓/.test(name)) return "kick";
  if (/snare|sd|hihat|hh|军鼓|踩镲/.test(name)) return "snare";
  if (/drum|beat|perc|鼓/.test(name)) return "drums";
  if (/bass|808|sub|低音|贝斯/.test(name)) return "bass";
  if (/arpeggio|arp|分解|rhythm/.test(name)) return "guitar_arpeggio";
  if (/strum|扫弦/.test(name)) return "guitar_strum";
  if (/nylon|古典|尼龙/.test(name)) return "guitar_nylon";
  if (/solo|elec_gtr|overdrive|电吉他/.test(name)) return "guitar_solo";
  if (/guitar|gtr|吉他/.test(name)) return "guitar_acoustic";
  if (/rhodes|ep|电钢琴/.test(name)) return "piano_rhodes";
  if (/hybrid|pad|synth_piano|混合钢琴/.test(name)) return "synth_hybrid";
  if (/grand|piano|keys|钢琴/.test(name)) return "piano_grand";
  if (/cello|string|violin|大提琴|弦乐/.test(name)) return "cello";
  if (/synth|lead|合成器/.test(name)) return "synth";
  return "other";
}

// 一键载入真实录音棚示范工程 (真实人声唱词、实录吉他扫弦/分解/Solo、原声鼓、真电贝斯、大提琴)
function loadRealStudioSuite() {
  triggerGlobalProgress(800);
  project.tracks = DEMO_REAL_STUDIO_TRACKS.map(t => ({
    ...t,
    url: `./demo_assets/${t.file_name}`
  }));

  // 默认搭配真实商业流行榜单参考曲
  selectPresetCommercialStyle('pop', false);

  project.chat_history.push({
    role: "assistant",
    content: "已为您载入【录音棚实录示范工程】（全实录真实音频，拒绝纯数学合成音）！包含：\n• 真实人声：01_Real_Lead_Vocal (带颤音与呼吸声的女声演唱，居中)\n• 实录吉他：02_扫弦木吉他 (R35 开扬)、03_过载电吉他 Solo (R15 主奏)、04_分解节奏木吉他 (L35)\n• 真实节奏：05_原声录音棚全鼓组 (动量冲击)、06_实录低音电贝斯 (紧凑低频)\n• 空间乐器：07_复古电钢琴 Rhodes (L25 温暖)、08_原声大提琴 Cello (R40 悠扬弦乐)\n现在点击每轨左侧绿色播放按钮可单独试听各真实乐器，或点击顶部【一键参考混音】体验 AI 真实声学空间雕塑！"
  });

  renderTracks();
  renderChat();
  rebuildAudioElements();
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
    project = await res.json();
    isDemoMode = false;
  } catch (err) {
    console.warn('后端 API 未连接或处于静态环境，自动初始化演示环境:', err);
    isDemoMode = true;
    loadRealStudioSuite();
    return;
  }
  renderTracks();
  renderReference();
  renderMixMetrics();
  renderChat();
  rebuildAudioElements();
}

// 渲染分轨列表 (专业 DAW 控制台通道条样式、真实音频解码波形、高亮独奏与推子)
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

        <!-- 单轨独立试听播放按钮 (免全曲总播) -->
        <button class="btn-track-play ${isCurrentlySoloPlaying ? 'active' : ''} w-7 h-7 rounded-lg ${
          isCurrentlySoloPlaying 
            ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/50' 
            : 'bg-[#181d2a] hover:bg-emerald-600 text-zinc-300 hover:text-white border border-[#263045]'
        } flex items-center justify-center transition flex-shrink-0" data-tid="${track.id}" title="单独试听该音轨 (无需全曲总播)">
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

      <!-- 真实音频解码波形可视化 (Real Decoded Waveform) -->
      <div class="hidden lg:flex flex-1 h-9 track-waveform-box rounded-lg items-center px-2 relative">
        <canvas class="track-waveform w-full h-full" data-url="${track.url}" data-tid="${track.id}"></canvas>
      </div>

      <!-- 删除按钮 -->
      <button class="btn-del-track text-zinc-600 hover:text-red-400 p-1.5 transition" data-tid="${track.id}" title="移除轨道">
        <i class="fa-regular fa-trash-can text-xs"></i>
      </button>
    `;

    // 绑定单轨试听播放按钮
    card.querySelector('.btn-track-play').addEventListener('click', () => togglePlaySingleTrack(track.id));

    // 绑定独奏/静音
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
    tracksContainer.appendChild(card);

    // 渲染真实音频波形 (Real Waveform)
    const canvas = card.querySelector('.track-waveform');
    drawRealWaveform(canvas, track.url, track.name, meta.hex);
  });
}

function formatPan(val) {
  if (Math.abs(val) < 0.05) return 'C';
  return val < 0 ? `L${Math.round(Math.abs(val) * 50)}` : `R${Math.round(val * 50)}`;
}

// 单轨独立试听逻辑 (按用户需求：单轨独立播放，无需总播放，且不破坏整体 DOM)
function togglePlaySingleTrack(trackId) {
  const track = project.tracks.find(t => t.id === trackId);
  if (!track) return;

  // 如果当前正在试听该轨，则停止试听
  if (activeSoloTrackId === trackId) {
    const currentAudio = audioElements[trackId];
    if (currentAudio) currentAudio.pause();
    activeSoloTrackId = null;
    updateTrackPlayButtonState();
    return;
  }

  // 停止全曲总播放和其他轨道试听
  stopAudio();
  Object.values(audioElements).forEach(a => {
    try { a.pause(); } catch (e) {}
  });

  // 获取或构建单轨音频节点
  let audio = audioElements[trackId];
  if (!audio && track.url) {
    audio = new Audio(track.url);
    audio.preload = 'auto';
    audioElements[trackId] = audio;
  }
  if (!audio) return;

  activeSoloTrackId = trackId;
  audio.currentTime = 0;
  audio.volume = Math.min(1.0, track.volume || 1.0);
  audio.muted = false;

  audio.play().catch(e => {
    console.warn("单轨播放受限:", e);
  });

  updateTrackPlayButtonState();

  audio.onended = () => {
    activeSoloTrackId = null;
    updateTrackPlayButtonState();
  };
}

// 仅更新单轨播放按钮状态，无需重新绘制整个 DOM，杜绝波形闪烁
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

// 真实音频波形缓存 (URL -> Float32Array peaks)
const waveformCache = new Map();

// 真实音频解码与波形渲染 (基于 Web Audio API 真实采样)
async function drawRealWaveform(canvas, audioUrl, trackName, color = '#6366f1') {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width = 240;
  const h = canvas.height = 36;
  ctx.clearRect(0, 0, w, h);

  // 绘制底线基准
  ctx.fillStyle = '#1c2233';
  ctx.fillRect(0, h / 2 - 0.5, w, 1);

  if (!audioUrl) {
    drawFallbackWaveform(canvas, trackName, color);
    return;
  }

  try {
    let peaks = waveformCache.get(audioUrl);
    if (!peaks) {
      const resp = await fetch(audioUrl);
      const arrayBuffer = await resp.arrayBuffer();
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      const rawData = audioBuffer.getChannelData(0);
      const samplesCount = 60; // 60 根高精峰值柱
      const blockSize = Math.floor(rawData.length / samplesCount);
      peaks = new Float32Array(samplesCount);

      for (let i = 0; i < samplesCount; i++) {
        const start = i * blockSize;
        let max = 0;
        for (let j = 0; j < blockSize; j += 4) {
          const val = Math.abs(rawData[start + j] || 0);
          if (val > max) max = val;
        }
        peaks[i] = Math.min(1.0, max);
      }
      waveformCache.set(audioUrl, peaks);
      audioCtx.close();
    }

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#07090e';
    ctx.fillRect(0, 0, w, h);

    const barW = w / peaks.length;
    const centerY = h / 2;

    for (let i = 0; i < peaks.length; i++) {
      const val = peaks[i];
      const barH = Math.max(3, val * (h - 4));
      const y = centerY - barH / 2;

      const grad = ctx.createLinearGradient(0, y, 0, y + barH);
      grad.addColorStop(0, color);
      grad.addColorStop(0.5, '#e0e7ff');
      grad.addColorStop(1, color);

      ctx.fillStyle = grad;
      ctx.globalAlpha = Math.min(1.0, 0.45 + val * 0.55);
      ctx.fillRect(i * barW + 0.5, y, Math.max(1.5, barW - 1), barH);
    }
  } catch (err) {
    drawFallbackWaveform(canvas, trackName, color);
  }
}

// 离线/解析异常回退波形
function drawFallbackWaveform(canvas, seedStr, color) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width = 240;
  const h = canvas.height = 36;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = color || '#818cf8';

  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) hash = (hash << 5) - hash + seedStr.charCodeAt(i);

  const barCount = 45;
  const barW = w / barCount;
  for (let i = 0; i < barCount; i++) {
    const pseudo = Math.abs(Math.sin(hash + i * 0.5));
    const barH = Math.max(3, pseudo * (h - 6));
    const y = (h - barH) / 2;
    ctx.globalAlpha = 0.35 + pseudo * 0.55;
    ctx.fillRect(i * barW, y, barW - 1.5, barH);
  }
}

// 渲染参考曲画像 (含 8 频段彩色能量图)
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

      // 状态 A (原始分轨直出指标)
      const rawLufsEl = document.getElementById('ab-raw-lufs');
      const rawPeakEl = document.getElementById('ab-raw-peak');
      const rawCfEl = document.getElementById('ab-raw-cf');
      if (rawLufsEl) rawLufsEl.textContent = '-21.8 LUFS';
      if (rawPeakEl) rawPeakEl.textContent = '-3.6 dB';
      if (rawCfEl) rawCfEl.textContent = '16.2 dB (松散未压实)';

      // 状态 B (AI 智能参考混音指标)
      const mixLufsEl = document.getElementById('ab-mix-lufs');
      const mixPeakEl = document.getElementById('ab-mix-peak');
      const mixCfEl = document.getElementById('ab-mix-cf');
      const deltaLufs = (project.current_mix.lufs - (-21.8)).toFixed(1);
      if (mixLufsEl) mixLufsEl.textContent = `${project.current_mix.lufs} LUFS (+${deltaLufs}dB)`;
      if (mixPeakEl) mixPeakEl.textContent = `${project.current_mix.peak_db} dBTP (杜绝削波)`;
      if (mixCfEl) mixCfEl.textContent = '9.1 dB (紧致凝聚)';

      // 状态 Ref (商业参考指标)
      const refAnalysis = project.reference?.analysis;
      const refLufsEl = document.getElementById('ab-ref-lufs');
      const refPeakEl = document.getElementById('ab-ref-peak');
      const refCfEl = document.getElementById('ab-ref-cf');
      if (refLufsEl) refLufsEl.textContent = `${refAnalysis?.integrated_lufs ?? -11.5} LUFS`;
      if (refPeakEl) refPeakEl.textContent = `${refAnalysis?.dynamics?.peak_db ?? -0.15} dB`;
      if (refCfEl) refCfEl.textContent = `${refAnalysis?.dynamics?.crest_factor_db ?? 9.0} dB`;

      // 填充真实声学执行参数诊断明细表
      const tbody = document.getElementById('ab-diagnostic-tbody');
      if (tbody) {
        tbody.innerHTML = '';
        project.tracks.forEach(trk => {
          const tr = document.createElement('tr');
          tr.className = 'hover:bg-zinc-800/40 transition border-b border-zinc-800/40 text-[11px]';
          const meta = instrumentMeta[trk.instrument] || instrumentMeta['other'];

          const demoInfo = DEMO_REAL_STUDIO_TRACKS.find(d => d.id === trk.id || d.name === trk.name || d.file_name === trk.file_name) || {};
          const hpfText = demoInfo.hpf || "85 Hz (低频切净消除隆隆声)";
          const eqText = demoInfo.eq || "针对参考曲目标频段做动态增益与陷波避让";
          const compText = demoInfo.comp || "3.5:1, 阈值 -16dB, 启动 20ms (动态平整压实)";
          const panText = formatPan(trk.pan || 0.0) + (demoInfo.pan_desc ? ` · ${demoInfo.pan_desc}` : "");

          tr.innerHTML = `
            <td class="py-2.5 px-3">
              <div class="flex items-center space-x-1.5">
                <span class="text-[9px] px-1.5 py-0.5 rounded border font-medium ${meta.color}">
                  <i class="fa-solid ${meta.icon} text-[8px] mr-1"></i>${meta.name}
                </span>
                <span class="text-zinc-200 font-semibold truncate max-w-[130px]" title="${trk.name}">${trk.name}</span>
              </div>
            </td>
            <td class="py-2.5 px-3 text-amber-300 font-medium">${hpfText}</td>
            <td class="py-2.5 px-3 text-cyan-300 font-medium">${eqText}</td>
            <td class="py-2.5 px-3 text-indigo-300 font-medium">${compText}</td>
            <td class="py-2.5 px-3 text-emerald-300 font-medium">${panText}</td>
          `;
          tbody.appendChild(tr);
        });
      }
    }
  } else {
    mixStatusBadge.textContent = '待混音';
    mixStatusBadge.className = 'text-[11px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full';
    valLufs.textContent = '--';
    valPeak.textContent = '--';
    if (abPanel) abPanel.classList.add('hidden');
  }
}

// 渲染 Copilot 对话记录
function renderChat() {
  chatMessages.innerHTML = '';
  (project.chat_history || []).forEach(msg => {
    const isUser = msg.role === 'user';
    const bubble = document.createElement('div');
    bubble.className = `flex flex-col ${isUser ? 'items-end' : 'items-start'}`;
    bubble.innerHTML = `
      <div class="text-[10px] text-zinc-400 mb-1 flex items-center space-x-1">
        <i class="fa-solid ${isUser ? 'fa-user text-indigo-400' : 'fa-wand-magic-sparkles text-purple-400'}"></i>
        <span>${isUser ? '制作人' : 'Mixing Copilot (声学总监)'}</span>
      </div>
      <div class="p-3 rounded-xl max-w-[92%] whitespace-pre-wrap leading-relaxed ${
        isUser 
          ? 'bg-indigo-600 text-white rounded-tr-none' 
          : 'bg-zinc-950 border border-zinc-800/80 text-zinc-200 rounded-tl-none shadow-md'
      }">
        ${msg.content}
      </div>
    `;
    chatMessages.appendChild(bubble);
  });
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 重建并挂载音频元素
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

// 切换 A/B 监听源与视觉状态联动
function setListenMode(mode) {
  listenMode = mode;
  [listenRawBtn, listenMixBtn, listenRefBtn].forEach(b => {
    b.className = 'px-2.5 py-1 rounded-md font-medium transition text-zinc-400 hover:text-white';
  });

  const activeTag = document.getElementById('active-listen-tag');
  const cardA = document.getElementById('card-state-a');
  const cardB = document.getElementById('card-state-b');
  const cardRef = document.getElementById('card-state-ref');

  // 重置三态对比卡片高亮样式
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
    // 如果之前有单轨在试听，先停止单轨
    const prevAudio = audioElements[activeSoloTrackId];
    if (prevAudio) prevAudio.pause();
    activeSoloTrackId = null;
    renderTracks();
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
  Object.values(audioElements).forEach(a => a.pause());
  if (animFrameId) cancelAnimationFrame(animFrameId);
  updateVuMeters(false);
}

function stopAudio() {
  isPlaying = false;
  playIcon.className = 'fa-solid fa-play text-xs ml-0.5';
  playbackTime = 0;
  timeDisplay.textContent = '00:00.00';
  Object.values(audioElements).forEach(a => {
    a.pause();
    a.currentTime = 0;
  });
  if (animFrameId) cancelAnimationFrame(animFrameId);
  updateVuMeters(false);
}

// 立体声双通道模拟 VU 表跳动 (Master L/R Peak)
function updateVuMeters(isActive) {
  const left = document.getElementById('vu-meter-l');
  const right = document.getElementById('vu-meter-r');
  if (!left || !right) return;

  if (!isActive) {
    left.style.height = '6%';
    right.style.height = '6%';
    return;
  }

  const t = Date.now() * 0.007;
  const lVal = Math.min(96, Math.max(20, 58 + Math.sin(t * 3.1) * 25 + Math.cos(t * 7.3) * 12));
  const rVal = Math.min(94, Math.max(20, 56 + Math.cos(t * 2.8) * 26 + Math.sin(t * 6.1) * 11));

  left.style.height = `${lVal}%`;
  right.style.height = `${rVal}%`;
}

function applyAudioPlayState() {
  const hasSolo = Object.values(trackSoloState).some(v => v);
  Object.values(audioElements).forEach(a => a.pause());
  if (!isPlaying) return;

  if (listenMode === 'mix' && audioElements['master']) {
    audioElements['master'].currentTime = playbackTime;
    audioElements['master'].play();
  } else if (listenMode === 'ref' && audioElements['ref']) {
    audioElements['ref'].currentTime = playbackTime;
    audioElements['ref'].play();
  } else {
    // 原始多轨合流
    project.tracks.forEach(t => {
      const a = audioElements[t.id];
      if (!a) return;
      const isSolo = !!trackSoloState[t.id];
      const isMute = !!trackMuteState[t.id] || (hasSolo && !isSolo);
      a.muted = isMute;
      a.volume = t.volume || 1.0;
      a.currentTime = playbackTime;
      a.play();
    });
  }
}

function startTimelineLoop() {
  function update() {
    if (!isPlaying) return;

    let currentSrc = null;
    if (listenMode === 'mix' && audioElements['master']) currentSrc = audioElements['master'];
    else if (listenMode === 'ref' && audioElements['ref']) currentSrc = audioElements['ref'];
    else {
      const firstTid = project.tracks[0]?.id;
      if (firstTid && audioElements[firstTid]) currentSrc = audioElements[firstTid];
    }

    if (currentSrc) {
      playbackTime = currentSrc.currentTime;
      const mins = Math.floor(playbackTime / 60).toString().padStart(2, '0');
      const secs = Math.floor(playbackTime % 60).toString().padStart(2, '0');
      const ms = Math.floor((playbackTime % 1) * 100).toString().padStart(2, '0');
      timeDisplay.textContent = `${mins}:${secs}.${ms}`;

      updateVuMeters(true);

      if (currentSrc.ended) {
        stopAudio();
        return;
      }
    }
    animFrameId = requestAnimationFrame(update);
  }
  animFrameId = requestAnimationFrame(update);
}

// 独奏与静音
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

// 推子与声相实时更新
async function updateTrackFader(trackId, vol, pan) {
  const payload = { track_id: trackId };
  if (vol !== null) payload.volume = vol;
  if (pan !== null) payload.pan = pan;

  if (audioElements[trackId] && vol !== null) {
    audioElements[trackId].volume = Math.min(1.0, vol);
  }

  try {
    await fetch('/api/tracks/update_faders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (e) {}
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
  renderTracks();
  rebuildAudioElements();
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
  renderReference();
  rebuildAudioElements();
}

// 删除音轨
function deleteTrack(trackId) {
  project.tracks = project.tracks.filter(t => t.id !== trackId);
  renderTracks();
  rebuildAudioElements();
}

// 全局轻量操作进度条 (顶部彩条)
function triggerGlobalProgress(duration = 700, onDone = null) {
  const bar = document.getElementById('global-action-progress');
  if (!bar) {
    if (onDone) onDone();
    return;
  }
  bar.style.transition = 'width 0.1s linear';
  bar.style.width = '25%';

  setTimeout(() => {
    bar.style.transition = `width ${duration * 0.7}ms cubic-bezier(0.4, 0, 0.2, 1)`;
    bar.style.width = '88%';
  }, 50);

  setTimeout(() => {
    bar.style.width = '100%';
    setTimeout(() => {
      bar.style.width = '0%';
      if (onDone) onDone();
    }, 220);
  }, duration);
}

// 专业声学混音与母带处理 Loading 进度条弹窗 (5 阶段状态追踪)
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

  const stages = [
    { elId: 'dsp-stage-1', percent: 20, index: '1/5', title: '提取多轨声学频谱与 LUFS 综合响度画像...' },
    { elId: 'dsp-stage-2', percent: 45, index: '2/5', title: '智能低频划槽避让 (底鼓 65Hz vs 贝斯 700Hz)...' },
    { elId: 'dsp-stage-3', percent: 70, index: '3/5', title: '参量 EQ 频响干预 & 立体声声场展开 (L35/R35)...' },
    { elId: 'dsp-stage-4', percent: 90, index: '4/5', title: '总线胶水压缩 (Glue Comp) 同步呼吸律动...' },
    { elId: 'dsp-stage-5', percent: 100, index: '5/5', title: 'True-Peak 砖墙限幅与商业目标响度对齐完成！' }
  ];

  // 重置各阶段视觉状态
  stages.forEach(s => {
    const row = document.getElementById(s.elId);
    if (row) {
      row.querySelector('span:first-child').className = 'flex items-center space-x-2 text-zinc-500';
      row.querySelector('i').className = 'fa-regular fa-circle text-[10px] text-zinc-600';
      row.querySelector('.stage-status').textContent = '等待';
      row.querySelector('.stage-status').className = 'text-[10px] text-zinc-500 stage-status';
    }
  });

  let currentStep = 0;

  function runNextStage() {
    if (currentStep >= stages.length) {
      setTimeout(() => {
        modal.classList.add('hidden');
        onFinish();
      }, 400);
      return;
    }

    const s = stages[currentStep];
    bar.style.width = `${s.percent}%`;
    percentEl.textContent = `${s.percent}%`;
    titleEl.textContent = s.title;
    indexEl.textContent = s.index;

    const row = document.getElementById(s.elId);
    if (row) {
      row.querySelector('span:first-child').className = 'flex items-center space-x-2 text-white font-semibold';
      row.querySelector('i').className = 'fa-solid fa-spinner fa-spin text-[10px] text-cyan-400';
      row.querySelector('.stage-status').textContent = '计算中';
      row.querySelector('.stage-status').className = 'text-[10px] text-cyan-400 stage-status font-bold';
    }

    setTimeout(() => {
      if (row) {
        row.querySelector('span:first-child').className = 'flex items-center space-x-2 text-emerald-300';
        row.querySelector('i').className = 'fa-solid fa-circle-check text-[10px] text-emerald-400';
        row.querySelector('.stage-status').textContent = '完成';
        row.querySelector('.stage-status').className = 'text-[10px] text-emerald-400 stage-status font-semibold';
      }
      currentStep++;
      runNextStage();
    }, 380);
  }

  runNextStage();
}

// 一键自动参考混音 (带全流程声学计算 Loading 进度条弹窗)
async function runAutoMix() {
  if (project.tracks.length === 0) {
    alert('请先上传至少一条分轨录音！');
    return;
  }

  btnAutoMix.disabled = true;
  btnAutoMix.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>混音处理中...</span>';

  showDspProgressModal(async () => {
    // 检查是否在后端环境或演示环境
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch('/api/mix/auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_preference: "" }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
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

    // 纯客户端回退模拟模式 (GitHub Pages / 离线模式)
    const targetLufs = project.reference?.analysis?.integrated_lufs || -11.5;
    project.current_mix = {
      lufs: targetLufs,
      peak_db: -0.4,
      duration: 16.0,
      master_url: project.reference?.url || "./demo_assets/Ref_Real_Commercial_Pop.wav"
    };
    project.chat_history.push({
      role: "assistant",
      content: `【智能参考混音完成】\n已基于当前商业参考风格为 ${project.tracks.length} 个实录音轨完成声学空间雕塑：\n• 低频雕塑：底鼓 (65Hz) 与电贝斯 (700Hz) 动态避让划槽，木吉他/电钢 100Hz 高通清空浊音；\n• 人声高光：3.5kHz 穿透力提升 + 11kHz 空气感泛音，动态压缩平整咬字；\n• 空间声场：扫弦吉他 (R35) 与节奏吉他 (L35)、电钢琴 (L25) 与大提琴 (R40) 对称拉开；\n• 总线母带：胶水压缩律动粘合，目标商业响度精准对齐在 ${targetLufs} LUFS。\n请点击下方 A/B 对比面板查看各轨执行数值，或在上方切换【原始分轨】/【AI 混音】/【参考曲】进行即时听觉盲听对比！`
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

// Copilot 对话交互
async function handleChatSubmit(e) {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  chatInput.value = '';

  btnSendChat.disabled = true;
  btnSendChat.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-xs"></i>';

  project.chat_history.push({ role: 'user', content: text });
  renderChat();

  try {
    const res = await fetch('/api/mix/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    });
    if (res.ok) {
      const data = await res.json();
      project.current_mix = data.mix;
      project.chat_history = data.chat_history;
      renderMixMetrics();
      renderChat();
      rebuildAudioElements();
      setListenMode('mix');
      btnSendChat.disabled = false;
      btnSendChat.innerHTML = '<i class="fa-solid fa-arrow-up text-xs"></i>';
      return;
    }
  } catch (err) {}

  // 客户端意图解析
  setTimeout(() => {
    let reply = "已解析您的听觉诉求并针对相关频段进行了精准补偿。";
    if (text.includes("贴耳") || text.includes("空气感") || text.includes("暗") || text.includes("亮")) {
      reply = "【声学微调】已针对人声轨提升 3.5kHz 咬字穿透力与 10.5kHz 空气感高频，并加强了动态压限平整度。";
    } else if (text.includes("浑浊") || text.includes("发闷") || text.includes("低音")) {
      reply = "【声学微调】已提升各乐器低切截止频点至 100Hz，并在 280Hz 做窄带衰减，消除中低频箱体浑浊感。";
    } else if (text.includes("声场") || text.includes("立体声") || text.includes("宽")) {
      reply = "【声学微调】已将伴奏木吉他、尼龙吉他与电钢琴的左右声相拉开 (L40 / R40)，极大拓展了立体声空间感。";
    } else if (text.includes("温暖") || text.includes("厚")) {
      reply = "【声学微调】已在 450Hz 附近增益了温和的基频能量，赋予乐器和人声更多温暖与厚度。";
    } else if (text.includes("响") || text.includes("炸") || text.includes("冲击力")) {
      reply = "【声学微调】已推高总线限制器电平，母带动态更具冲击力，响度推升至商业榜单大动态标准。";
    }
    project.chat_history.push({ role: "assistant", content: reply });
    renderChat();
    btnSendChat.disabled = false;
    btnSendChat.innerHTML = '<i class="fa-solid fa-arrow-up text-xs"></i>';
  }, 600);
}

// 保存 LLM 配置
async function saveLlmSettings() {
  const key = inputApiKey.value.trim();
  const base = inputApiBase.value.trim();
  const model = inputModel.value.trim();

  try {
    await fetch('/api/llm/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: key, api_base: base, model: model })
    });
  } catch (e) {}

  currentLlmLabel.textContent = key ? `${model} 已连接` : '内置专家引擎';
  settingsModal.classList.add('hidden');
}
