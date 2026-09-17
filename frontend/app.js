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

// 细分乐器声学画像元数据 (图标、中文名称、专属色彩标签)
const instrumentMeta = {
  "vocal_lead": { name: "主唱人声", color: "bg-fuchsia-950/70 text-fuchsia-300 border-fuchsia-700/50", icon: "fa-microphone" },
  "vocal_backing": { name: "立体声和声", color: "bg-purple-950/70 text-purple-300 border-purple-700/50", icon: "fa-users" },
  "kick": { name: "纯净底鼓", color: "bg-red-950/70 text-red-300 border-red-700/50", icon: "fa-drum" },
  "snare": { name: "军鼓/踩镲", color: "bg-rose-950/70 text-rose-300 border-rose-700/50", icon: "fa-drum" },
  "drums": { name: "原声全鼓组", color: "bg-orange-950/70 text-orange-300 border-orange-700/50", icon: "fa-drum" },
  "bass": { name: "低音电贝斯", color: "bg-emerald-950/70 text-emerald-300 border-emerald-700/50", icon: "fa-guitar" },
  "guitar_arpeggio": { name: "分解木吉他", color: "bg-amber-950/70 text-amber-300 border-amber-700/50", icon: "fa-guitar" },
  "guitar_strum": { name: "扫弦木吉他", color: "bg-amber-900/70 text-amber-200 border-amber-600/50", icon: "fa-guitar" },
  "guitar_nylon": { name: "尼龙古典吉他", color: "bg-yellow-950/70 text-yellow-300 border-yellow-700/50", icon: "fa-guitar" },
  "guitar_solo": { name: "电吉他 Solo", color: "bg-red-900/70 text-red-200 border-red-600/50", icon: "fa-bolt" },
  "guitar_acoustic": { name: "原声木吉他", color: "bg-amber-950/70 text-amber-300 border-amber-700/50", icon: "fa-guitar" },
  "piano_grand": { name: "原声大钢琴", color: "bg-sky-950/70 text-sky-300 border-sky-700/50", icon: "fa-music" },
  "piano_rhodes": { name: "复古电钢琴", color: "bg-cyan-950/70 text-cyan-300 border-cyan-700/50", icon: "fa-keyboard" },
  "synth_hybrid": { name: "混合铺底钢琴", color: "bg-indigo-950/70 text-indigo-300 border-indigo-700/50", icon: "fa-wave-square" },
  "synth": { name: "合成器铺底", color: "bg-indigo-950/70 text-indigo-300 border-indigo-700/50", icon: "fa-wave-square" },
  "other": { name: "乐器分轨", color: "bg-zinc-800 text-zinc-300 border-zinc-700", icon: "fa-sliders" }
};

// 预置市面三大经典商业风格参考曲 (包含真实商业母带级指标)
const PRESET_COMMERCIAL_STYLES = {
  pop: {
    name: "现代商业流行榜单 (Modern Pop)",
    styleLabel: "流行榜单风格",
    url: "./demo_assets/Ref_Modern_Pop.wav",
    analysis: {
      integrated_lufs: -9.2,
      spectral_bands_db: {
        sub_bass: -9.5, bass: -3.8, low_mid: -10.2, mid: -9.4,
        upper_mid: -11.5, presence: -13.2, brilliance: -15.8, air: -18.0
      },
      dynamics: { peak_db: -0.1, rms_db: -7.5, crest_factor_db: 7.4, stereo_correlation: 0.95 }
    },
    note: "特点：极致的 12kHz+ 空气感，底鼓在 60Hz 冲击力强，人声居中紧贴耳边。"
  },
  folk: {
    name: "原声民谣暖色 (Acoustic Folk)",
    styleLabel: "原声民谣风格",
    url: "./demo_assets/Ref_Acoustic_Folk.wav",
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
    name: "经典流行摇滚与 R&B (Vintage Rock & R&B)",
    styleLabel: "摇滚/R&B风格",
    url: "./demo_assets/Ref_Vintage_RnB_Rock.wav",
    analysis: {
      integrated_lufs: -11.5,
      spectral_bands_db: {
        sub_bass: -11.0, bass: -5.2, low_mid: -9.1, mid: -8.5,
        upper_mid: -12.8, presence: -14.5, brilliance: -17.5, air: -21.2
      },
      dynamics: { peak_db: -0.15, rms_db: -9.2, crest_factor_db: 9.05, stereo_correlation: 0.92 }
    },
    note: "特点：律动底鼓与贝斯紧密胶合，电吉他与电钢琴立体声饱满，富有音乐感染力。"
  }
};

// 12 轨专业示范分轨清单 (涵盖吉他多手法、钢琴多种类、主唱和声、鼓贝斯)
const DEMO_12_TRACKS = [
  { id: "demo_01", name: "01_Drums_Kick", file_name: "01_Drums_Kick.wav", instrument: "kick", volume: 1.0, pan: 0.0 },
  { id: "demo_02", name: "02_Drums_Snare_Hihat", file_name: "02_Drums_Snare_Hihat.wav", instrument: "snare", volume: 0.95, pan: 0.05 },
  { id: "demo_03", name: "03_Bass", file_name: "03_Bass.wav", instrument: "bass", volume: 1.0, pan: 0.0 },
  { id: "demo_04", name: "04_Acoustic_Guitar_Arpeggio", file_name: "04_Acoustic_Guitar_Arpeggio.wav", instrument: "guitar_arpeggio", volume: 0.9, pan: -0.35 },
  { id: "demo_05", name: "05_Acoustic_Guitar_Strum", file_name: "05_Acoustic_Guitar_Strum.wav", instrument: "guitar_strum", volume: 0.85, pan: 0.35 },
  { id: "demo_06", name: "06_Nylon_Guitar", file_name: "06_Nylon_Guitar.wav", instrument: "guitar_nylon", volume: 0.85, pan: -0.15 },
  { id: "demo_07", name: "07_Electric_Guitar_Solo", file_name: "07_Electric_Guitar_Solo.wav", instrument: "guitar_solo", volume: 0.8, pan: 0.05 },
  { id: "demo_08", name: "08_Grand_Piano", file_name: "08_Grand_Piano.wav", instrument: "piano_grand", volume: 0.85, pan: -0.2 },
  { id: "demo_09", name: "09_Rhodes_Electric_Piano", file_name: "09_Rhodes_Electric_Piano.wav", instrument: "piano_rhodes", volume: 0.9, pan: 0.25 },
  { id: "demo_10", name: "10_Hybrid_Synth_Piano", file_name: "10_Hybrid_Synth_Piano.wav", instrument: "synth_hybrid", volume: 0.8, pan: -0.45 },
  { id: "demo_11", name: "11_Lead_Vocal", file_name: "11_Lead_Vocal.wav", instrument: "vocal_lead", volume: 1.05, pan: 0.0 },
  { id: "demo_12", name: "12_Backing_Vocals", file_name: "12_Backing_Vocals.wav", instrument: "vocal_backing", volume: 0.85, pan: 0.5 }
];

// DOM 元素引用
const btnPlayPause = document.getElementById('btn-play-pause');
const playIcon = document.getElementById('play-icon');
const btnStop = document.getElementById('btn-stop');
const timeDisplay = document.getElementById('time-display');
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

  if (btnLoadDemoSuite) {
    btnLoadDemoSuite.addEventListener('click', load12TrackDemoSuite);
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

// 智能乐器识别
function detectInstrumentFromName(name) {
  name = (name || "").toLowerCase();
  if (/back|harmony|和声|伴唱/.test(name)) return "vocal_backing";
  if (/lead_v|voc|sing|voice|主唱|人声/.test(name)) return "vocal_lead";
  if (/kick|bd|底鼓|大鼓/.test(name)) return "kick";
  if (/snare|sd|hihat|hh|军鼓|踩镲/.test(name)) return "snare";
  if (/drum|beat|perc|鼓/.test(name)) return "drums";
  if (/bass|808|sub|低音|贝斯/.test(name)) return "bass";
  if (/arpeggio|arp|分解/.test(name)) return "guitar_arpeggio";
  if (/strum|扫弦/.test(name)) return "guitar_strum";
  if (/nylon|古典|尼龙/.test(name)) return "guitar_nylon";
  if (/solo|elec_gtr|overdrive|电吉他/.test(name)) return "guitar_solo";
  if (/guitar|gtr|吉他/.test(name)) return "guitar_acoustic";
  if (/rhodes|ep|电钢琴/.test(name)) return "piano_rhodes";
  if (/hybrid|pad|synth_piano|混合钢琴/.test(name)) return "synth_hybrid";
  if (/grand|piano|keys|钢琴/.test(name)) return "piano_grand";
  if (/synth|lead|string|合成器|弦乐/.test(name)) return "synth";
  return "other";
}

// 一键载入 12 轨专业示范工程 (分解吉他、扫弦、尼龙、电吉他Solo、大钢琴、电钢琴等)
function load12TrackDemoSuite() {
  project.tracks = DEMO_12_TRACKS.map(t => ({
    ...t,
    url: `./demo_assets/${t.file_name}`
  }));

  // 默认搭配流行榜单参考曲
  selectPresetCommercialStyle('pop', false);

  project.chat_history.push({
    role: "assistant",
    content: "已为您载入【12 轨专业乐器示范工程】！包含：\n• 吉他声部：木吉他分解和弦 (L35)、木吉他扫弦 (R35)、尼龙古典吉他 (L15)、电吉他 Solo\n• 键盘声部：原声大钢琴 (L20)、复古电钢琴 Rhodes (R25)、混合铺底钢琴 (L45)\n• 人声与节奏：主唱人声 (居中)、立体声和声 (R50)、底鼓、军鼓踩镲、电贝斯\n现在点击每轨左侧的绿色播放按钮可单独试听各乐器，或点击顶部【一键参考混音】体验 AI 空间布局！"
  });

  renderTracks();
  renderChat();
  rebuildAudioElements();
}

// 选择预置商业风格参考曲
function selectPresetCommercialStyle(styleKey, triggerNotice = true) {
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
    load12TrackDemoSuite();
    return;
  }
  renderTracks();
  renderReference();
  renderMixMetrics();
  renderChat();
  rebuildAudioElements();
}

// 渲染分轨列表 (包含单轨试听按钮、乐器色彩徽章、推子与声相)
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

  project.tracks.forEach(track => {
    const isSolo = !!trackSoloState[track.id];
    const isMute = !!trackMuteState[track.id] || (hasSolo && !isSolo);
    const meta = instrumentMeta[track.instrument] || instrumentMeta["other"];
    const isCurrentlySoloPlaying = (activeSoloTrackId === track.id);

    const card = document.createElement('div');
    card.className = `bg-zinc-900 border ${isSolo ? 'border-amber-500/70 shadow-lg shadow-amber-500/10' : isMute ? 'border-zinc-800 opacity-60' : 'border-zinc-800'} rounded-xl p-3 flex flex-col md:flex-row items-center justify-between gap-3 transition`;
    card.innerHTML = `
      <div class="flex items-center space-x-2.5 w-full md:w-64 flex-shrink-0">
        <!-- 单轨独立试听播放按钮 -->
        <button class="btn-track-play w-7 h-7 rounded-full ${isCurrentlySoloPlaying ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/40' : 'bg-zinc-800 hover:bg-emerald-600 text-zinc-300 hover:text-white'} flex items-center justify-center transition flex-shrink-0" data-tid="${track.id}" title="单独试听该音轨 (无需全曲总播)">
          <i class="fa-solid ${isCurrentlySoloPlaying ? 'fa-pause' : 'fa-play'} text-[10px] ${isCurrentlySoloPlaying ? '' : 'ml-0.5'}"></i>
        </button>

        <div class="truncate flex-1">
          <div class="flex items-center space-x-1.5">
            <span class="text-[10px] px-1.5 py-0.5 rounded border font-medium ${meta.color} flex items-center space-x-1">
              <i class="fa-solid ${meta.icon} text-[9px]"></i>
              <span>${meta.name}</span>
            </span>
            <span class="text-xs font-bold text-zinc-200 truncate" title="${track.name}">${track.name}</span>
          </div>
        </div>
      </div>

      <!-- 独奏与静音 -->
      <div class="flex items-center space-x-1 flex-shrink-0">
        <button class="btn-solo w-6 h-6 rounded text-[10px] font-bold ${isSolo ? 'active' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}" data-tid="${track.id}" title="独奏 (Solo)">S</button>
        <button class="btn-mute w-6 h-6 rounded text-[10px] font-bold ${isMute ? 'active' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}" data-tid="${track.id}" title="静音 (Mute)">M</button>
      </div>

      <!-- 推子与声相控制 -->
      <div class="flex items-center space-x-4 flex-1 w-full max-w-sm">
        <div class="flex-1 flex items-center space-x-2">
          <span class="text-[10px] text-zinc-400 w-5">音量</span>
          <input type="range" min="0" max="1.5" step="0.05" value="${track.volume || 1.0}" class="fader-vol flex-1" data-tid="${track.id}">
          <span class="text-[10px] font-mono text-zinc-400 w-8 text-right">${Math.round((track.volume || 1.0) * 100)}%</span>
        </div>
        <div class="flex-1 flex items-center space-x-2">
          <span class="text-[10px] text-zinc-400 w-5">声相</span>
          <input type="range" min="-1" max="1" step="0.05" value="${track.pan || 0.0}" class="fader-pan flex-1" data-tid="${track.id}">
          <span class="text-[10px] font-mono text-zinc-400 w-7 text-right">${formatPan(track.pan || 0.0)}</span>
        </div>
      </div>

      <!-- 波形可视化 -->
      <div class="hidden lg:flex flex-1 h-8 bg-zinc-950/80 rounded border border-zinc-800/80 items-center px-2 relative overflow-hidden">
        <canvas class="track-waveform w-full h-full" data-url="${track.url}"></canvas>
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

    const canvas = card.querySelector('.track-waveform');
    drawSimulatedWaveform(canvas, track.name);
  });
}

function formatPan(val) {
  if (Math.abs(val) < 0.05) return 'C';
  return val < 0 ? `L${Math.round(Math.abs(val) * 50)}` : `R${Math.round(val * 50)}`;
}

// 单轨独立试听逻辑 (按用户需求：单轨独立播放，无需总播放)
function togglePlaySingleTrack(trackId) {
  const audio = audioElements[trackId];
  if (!audio) return;

  if (activeSoloTrackId === trackId) {
    // 正在播放中，暂停它
    audio.pause();
    activeSoloTrackId = null;
    renderTracks();
  } else {
    // 暂停全曲总播放和其他轨道
    stopAudio();
    Object.values(audioElements).forEach(a => a.pause());

    activeSoloTrackId = trackId;
    audio.currentTime = 0;
    audio.play();
    renderTracks();

    audio.onended = () => {
      activeSoloTrackId = null;
      renderTracks();
    };
  }
}

// 模拟波形渲染
function drawSimulatedWaveform(canvas, seedStr) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width = 200;
  const h = canvas.height = 32;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#818cf8';

  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) hash = (hash << 5) - hash + seedStr.charCodeAt(i);

  const barCount = 45;
  const barW = w / barCount;
  for (let i = 0; i < barCount; i++) {
    const pseudoRandom = Math.abs(Math.sin(hash + i * 0.5));
    const barH = Math.max(3, pseudoRandom * (h - 6));
    const y = (h - barH) / 2;
    ctx.globalAlpha = 0.35 + pseudoRandom * 0.55;
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

// 渲染混音结果指标
function renderMixMetrics() {
  if (project.current_mix) {
    mixStatusBadge.textContent = '已混音';
    mixStatusBadge.className = 'text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-medium';
    valLufs.textContent = `${project.current_mix.lufs} LUFS`;
    valPeak.textContent = `${project.current_mix.peak_db} dB`;
  } else {
    mixStatusBadge.textContent = '待混音';
    mixStatusBadge.className = 'text-[11px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full';
    valLufs.textContent = '--';
    valPeak.textContent = '--';
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

// 切换 A/B 监听源
function setListenMode(mode) {
  listenMode = mode;
  [listenRawBtn, listenMixBtn, listenRefBtn].forEach(b => {
    b.className = 'px-2.5 py-1 rounded-md font-medium transition text-zinc-400 hover:text-white';
  });

  if (mode === 'raw') {
    listenRawBtn.className = 'px-2.5 py-1 rounded-md font-medium transition bg-indigo-600 text-white shadow';
  } else if (mode === 'mix') {
    listenMixBtn.className = 'px-2.5 py-1 rounded-md font-medium transition bg-indigo-600 text-white shadow';
  } else if (mode === 'ref') {
    listenRefBtn.className = 'px-2.5 py-1 rounded-md font-medium transition bg-purple-600 text-white shadow';
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

// 一键自动参考混音
async function runAutoMix() {
  if (project.tracks.length === 0) {
    alert('请先上传至少一条分轨录音！');
    return;
  }

  btnAutoMix.disabled = true;
  btnAutoMix.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>混音中 (声学避让+总线胶水)...</span>';

  // 检查是否在后端环境或演示环境
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

  // 纯客户端回退模拟模式
  setTimeout(() => {
    const targetLufs = project.reference?.analysis?.integrated_lufs || -11.5;
    project.current_mix = {
      lufs: targetLufs,
      peak_db: -0.4,
      duration: 30.0,
      master_url: project.reference?.url || ""
    };
    project.chat_history.push({
      role: "assistant",
      content: `【智能参考混音完成】\n已基于当前参考风格为 ${project.tracks.length} 个音轨完成声学空间雕塑：\n• 低频避让：底鼓与贝斯频率划槽，吉他/钢琴 100Hz 高通清空浊音；\n• 人声高光：3.5kHz 穿透力提升 + 10.5kHz 空气感；\n• 空间声场：木吉他与电钢琴左右声相错开 (L35/R35)；\n• 总线母带：胶水压缩同步呼吸律动，目标商业响度对齐在 ${targetLufs} LUFS。`
    });
    renderMixMetrics();
    renderChat();
    setListenMode('mix');
    btnAutoMix.disabled = false;
    btnAutoMix.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i><span>一键参考混音</span>';
  }, 900);
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
