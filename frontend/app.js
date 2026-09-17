// 智能多轨混音工作站前端核心逻辑
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
let playbackDuration = 0;
let animFrameId = null;

// 音频播放节点映射
let audioElements = {}; // { 'master': Audio, 'ref': Audio, [trackId]: Audio }
let trackMuteState = {}; // { [trackId]: boolean }
let trackSoloState = {}; // { [trackId]: boolean }

const bandNamesCN = {
  "sub_bass": "超低音 (20-60Hz)",
  "bass": "低频 (60-250Hz)",
  "low_mid": "中低频 (250-500Hz)",
  "mid": "核心中频 (500-2kHz)",
  "upper_mid": "中高频 (2-4kHz)",
  "presence": "临场感 (4-6kHz)",
  "brilliance": "高频泛音 (6-12kHz)",
  "air": "空气感 (12-20kHz)"
};

const instrumentIcons = {
  "vocal": "fa-microphone",
  "kick": "fa-drum",
  "snare": "fa-drum",
  "drums": "fa-drum",
  "bass": "fa-guitar",
  "guitar": "fa-guitar",
  "piano": "fa-music",
  "synth": "fa-wave-square",
  "other": "fa-sliders"
};

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
const tracksContainer = document.getElementById('tracks-container');
const emptyTracksHint = document.getElementById('empty-tracks-hint');
const trackCountBadge = document.getElementById('track-count-badge');
const refStatusBadge = document.getElementById('ref-status-badge');
const refFilename = document.getElementById('ref-filename');
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
}

let isDemoMode = false;

function loadDemoProject() {
  isDemoMode = true;
  project = {
    tracks: [
      { id: "trk_1", name: "01_Drums", instrument: "drums", volume: 1.0, pan: 0.0, url: "" },
      { id: "trk_2", name: "02_Bass", instrument: "bass", volume: 1.0, pan: 0.0, url: "" },
      { id: "trk_3", name: "03_Keys", instrument: "piano", volume: 1.0, pan: -0.2, url: "" },
      { id: "trk_4", name: "04_Lead_Vocal", instrument: "vocal", volume: 1.0, pan: 0.0, url: "" }
    ],
    reference: {
      name: "Commercial_Reference.wav",
      url: "",
      analysis: {
        integrated_lufs: -9.5,
        spectral_bands_db: {
          sub_bass: -12.4,
          bass: -7.8,
          low_mid: -11.2,
          mid: -10.5,
          upper_mid: -14.2,
          presence: -16.8,
          brilliance: -19.4,
          air: -22.1
        },
        dynamics: {
          peak_db: -0.2,
          rms_db: -10.8,
          crest_factor_db: 10.6,
          stereo_correlation: 0.88
        }
      }
    },
    current_mix: {
      lufs: -14.0,
      peak_db: -0.5,
      duration: 32.5
    },
    chat_history: [
      {
        role: "assistant",
        content: "欢迎访问 Smart Mixing Studio 在线演示！\n当前运行于 GitHub Pages 静态展示环境，已为您载入虚拟演示工程。\n您可自由测试多轨控制、推子、声相、A/B 监听以及 Mixing Copilot 自然语言对话交互！"
      }
    ]
  };
  const modeBadge = document.getElementById('current-llm-label');
  if (modeBadge) {
    modeBadge.textContent = '在线演示模式';
    modeBadge.className = 'text-[11px] bg-indigo-900/60 text-indigo-300 border border-indigo-700/50 px-2 py-0.5 rounded';
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
    console.warn('后端 API 未连接或处于静态托管环境，自动启用在线演示模式:', err);
    loadDemoProject();
  }
  renderTracks();
  renderReference();
  renderMixMetrics();
  renderChat();
  rebuildAudioElements();
}

// 渲染分轨列表
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
    const iconClass = instrumentIcons[track.instrument] || 'fa-sliders';

    const card = document.createElement('div');
    card.className = `bg-zinc-900 border ${isSolo ? 'border-amber-500/60' : isMute ? 'border-zinc-800 opacity-60' : 'border-zinc-800'} rounded-xl p-3 flex flex-col md:flex-row items-center justify-between gap-4 transition`;
    card.innerHTML = `
      <div class="flex items-center space-x-3 w-full md:w-56 flex-shrink-0">
        <div class="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-indigo-400">
          <i class="fa-solid ${iconClass}"></i>
        </div>
        <div class="truncate">
          <div class="text-xs font-bold text-zinc-200 truncate" title="${track.name}">${track.name}</div>
          <div class="text-[10px] text-zinc-400 uppercase">${track.instrument || '分轨'}</div>
        </div>
      </div>

      <!-- 独奏与静音 -->
      <div class="flex items-center space-x-1 flex-shrink-0">
        <button class="btn-solo w-6 h-6 rounded text-[10px] font-bold ${isSolo ? 'active' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}" data-tid="${track.id}">S</button>
        <button class="btn-mute w-6 h-6 rounded text-[10px] font-bold ${isMute ? 'active' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}" data-tid="${track.id}">M</button>
      </div>

      <!-- 推子与声相控制 -->
      <div class="flex items-center space-x-4 flex-1 w-full max-w-sm">
        <div class="flex-1 flex items-center space-x-2">
          <span class="text-[10px] text-zinc-400 w-6">Vol</span>
          <input type="range" min="0" max="1.5" step="0.05" value="${track.volume || 1.0}" class="fader-vol flex-1" data-tid="${track.id}">
          <span class="text-[10px] font-mono text-zinc-400 w-8 text-right">${Math.round((track.volume || 1.0) * 100)}%</span>
        </div>
        <div class="flex-1 flex items-center space-x-2">
          <span class="text-[10px] text-zinc-400 w-6">Pan</span>
          <input type="range" min="-1" max="1" step="0.1" value="${track.pan || 0.0}" class="fader-pan flex-1" data-tid="${track.id}">
          <span class="text-[10px] font-mono text-zinc-400 w-7 text-right">${formatPan(track.pan || 0.0)}</span>
        </div>
      </div>

      <!-- 波形模拟条 -->
      <div class="hidden lg:flex flex-1 h-8 bg-zinc-950/80 rounded border border-zinc-800/80 items-center px-2 relative overflow-hidden">
        <canvas class="track-waveform w-full h-full" data-url="${track.url}"></canvas>
      </div>

      <!-- 删除按钮 -->
      <button class="btn-del-track text-zinc-600 hover:text-red-400 p-1.5 transition" data-tid="${track.id}" title="移除轨道">
        <i class="fa-regular fa-trash-can text-xs"></i>
      </button>
    `;

    // 绑定卡片内事件
    card.querySelector('.btn-solo').addEventListener('click', () => toggleSolo(track.id));
    card.querySelector('.btn-mute').addEventListener('click', () => toggleMute(track.id));
    
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

    // 简易波形绘制
    const canvas = card.querySelector('.track-waveform');
    drawSimulatedWaveform(canvas, track.name);
  });
}

function formatPan(val) {
  if (Math.abs(val) < 0.05) return 'C';
  return val < 0 ? `L${Math.round(Math.abs(val) * 50)}` : `R${Math.round(val * 50)}`;
}

// 模拟波形渲染 (在没有完整 decodeAudioData 缓存时提供专业 DAW 视觉)
function drawSimulatedWaveform(canvas, seedStr) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width = 200;
  const h = canvas.height = 32;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#6366f1';

  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) hash = (hash << 5) - hash + seedStr.charCodeAt(i);

  const barCount = 50;
  const barW = w / barCount;
  for (let i = 0; i < barCount; i++) {
    const pseudoRandom = Math.abs(Math.sin(hash + i * 0.45));
    const barH = Math.max(4, pseudoRandom * (h - 8));
    const y = (h - barH) / 2;
    ctx.globalAlpha = 0.4 + pseudoRandom * 0.5;
    ctx.fillRect(i * barW, y, barW - 1, barH);
  }
}

// 渲染参考曲画像
function renderReference() {
  if (!project.reference) {
    refStatusBadge.textContent = '未导入';
    refStatusBadge.className = 'text-[11px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full';
    refFilename.textContent = '上传目标商业曲目，AI 将提取其声学特征与频响';
    refAnalysisPanel.classList.add('hidden');
    return;
  }

  refStatusBadge.textContent = '已就绪';
  refStatusBadge.className = 'text-[11px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-medium';
  refFilename.textContent = `已载入: ${project.reference.name}`;
  refAnalysisPanel.classList.remove('hidden');

  const ana = project.reference.analysis;
  if (ana) {
    refLufs.textContent = ana.integrated_lufs ?? '--';
    refPeak.textContent = ana.dynamics?.peak_db ?? '--';
    refStereo.textContent = ana.dynamics?.stereo_correlation ?? '--';

    // 渲染 8 频段柱状图
    spectrumBarsContainer.innerHTML = '';
    const bands = ana.spectral_bands_db || {};
    const maxVal = -5;
    const minVal = -35;

    for (const [key, dbVal] of Object.entries(bands)) {
      const normHeight = Math.max(8, Math.min(100, ((dbVal - minVal) / (maxVal - minVal)) * 100));
      const col = document.createElement('div');
      col.className = 'flex flex-col items-center space-y-1.5';
      col.innerHTML = `
        <div class="w-full h-24 bg-zinc-950 rounded-lg flex items-end p-1 relative border border-zinc-800/80">
          <div class="spectrum-bar-fill w-full bg-gradient-to-t from-purple-600 to-indigo-400 rounded" style="height: ${normHeight}%"></div>
          <span class="absolute top-1 left-0 right-0 text-center text-[9px] font-mono text-zinc-400">${dbVal}dB</span>
        </div>
        <span class="text-[9px] text-zinc-400 text-center leading-tight truncate w-full" title="${bandNamesCN[key] || key}">
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
        <span>${isUser ? '创作者' : 'Mixing Copilot'}</span>
      </div>
      <div class="p-3 rounded-xl max-w-[90%] whitespace-pre-wrap ${
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
  // 停止现有播放
  stopAudio();
  audioElements = {};

  // 1. 各原始分轨
  project.tracks.forEach(track => {
    const audio = new Audio(track.url);
    audio.preload = 'auto';
    audio.volume = (track.volume || 1.0);
    audioElements[track.id] = audio;
  });

  // 2. 混音母带
  if (project.current_mix?.master_url) {
    const masterAudio = new Audio(project.current_mix.master_url);
    masterAudio.preload = 'auto';
    audioElements['master'] = masterAudio;
  }

  // 3. 参考曲
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
    // 无缝切换播放轨道
    applyAudioPlayState();
  }
}

// 播放 / 暂停切换
function togglePlay() {
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

  // 先暂停所有
  Object.values(audioElements).forEach(a => a.pause());

  if (!isPlaying) return;

  if (listenMode === 'mix' && audioElements['master']) {
    audioElements['master'].currentTime = playbackTime;
    audioElements['master'].play();
  } else if (listenMode === 'ref' && audioElements['ref']) {
    audioElements['ref'].currentTime = playbackTime;
    audioElements['ref'].play();
  } else {
    // raw 多轨合流
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

    // 获取主时钟时间
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
  } catch (e) {
    console.error('更新推子失败:', e);
  }
}

// 上传分轨
async function handleTracksUpload(e) {
  const files = e.target.files;
  if (!files.length) return;

  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    formData.append('files', files[i]);
  }

  try {
    const res = await fetch('/api/tracks/upload', {
      method: 'POST',
      body: formData
    });
    if (res.ok) {
      await refreshProject();
    }
  } catch (err) {
    alert('上传分轨失败: ' + err.message);
  }
}

// 上传参考曲
async function handleReferenceUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('/api/reference/upload', {
      method: 'POST',
      body: formData
    });
    if (res.ok) {
      await refreshProject();
    }
  } catch (err) {
    alert('导入参考曲失败: ' + err.message);
  }
}

// 删除音轨
async function deleteTrack(trackId) {
  try {
    const res = await fetch(`/api/tracks/${trackId}`, { method: 'DELETE' });
    if (res.ok) {
      await refreshProject();
    }
  } catch (err) {
    alert('删除音轨失败: ' + err.message);
  }
}

// 一键自动参考混音
async function runAutoMix() {
  if (project.tracks.length === 0) {
    alert('请先上传至少一条分轨录音！');
    return;
  }

  btnAutoMix.disabled = true;
  btnAutoMix.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>混音渲染中...</span>';

  if (isDemoMode) {
    setTimeout(() => {
      project.current_mix = {
        lufs: -14.2,
        peak_db: -0.4,
        duration: 30.0
      };
      project.chat_history.push({
        role: "assistant",
        content: "【智能参考混音完成 (在线演示模式)】\n已根据参考曲解构指标将目标响度对齐至 -14.2 LUFS。\n为人声执行了 90Hz 高通与 3.5kHz 穿透力提升，贝斯与底鼓完成声部动态压缩与避让。"
      });
      renderMixMetrics();
      renderChat();
      setListenMode('mix');
      btnAutoMix.disabled = false;
      btnAutoMix.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i><span>一键参考混音</span>';
    }, 700);
    return;
  }

  try {
    const res = await fetch('/api/mix/auto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_preference: "" })
    });
    if (res.ok) {
      await refreshProject();
      setListenMode('mix');
      playAudio();
    } else {
      const errData = await res.json();
      alert('混音执行失败: ' + (errData.detail || '未知错误'));
    }
  } catch (err) {
    alert('混音网络错误: ' + err.message);
  } finally {
    btnAutoMix.disabled = false;
    btnAutoMix.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i><span>一键参考混音</span>';
  }
}

// Copilot 对话交互
async function handleChatSubmit(e) {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  chatInput.value = '';

  if (project.tracks.length === 0) {
    alert('请先上传音轨后再进行混音对话！');
    return;
  }

  btnSendChat.disabled = true;
  btnSendChat.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-xs"></i>';

  // 乐观插入用户消息
  project.chat_history.push({ role: 'user', content: text });
  renderChat();

  if (isDemoMode) {
    setTimeout(() => {
      let reply = "【在线演示响应】已解析您的听觉诉求并针对相关频段进行了精准补偿。";
      if (text.includes("贴耳") || text.includes("空气感") || text.includes("暗") || text.includes("亮")) {
        reply = "【在线演示响应】已提升人声 3.5kHz 穿透力与 10.5kHz 空气感高频，并适度加强了动态压缩。";
      } else if (text.includes("浑浊") || text.includes("发闷") || text.includes("低音")) {
        reply = "【在线演示响应】已切除 90Hz 以下无效泥泞能量，并在 250Hz 做窄带陷波，声音更通透清爽。";
      } else if (text.includes("声场") || text.includes("立体声") || text.includes("宽")) {
        reply = "【在线演示响应】已将键盘和吉他左右声相扩展至 L40 / R40，大幅增强了立体声包围感。";
      } else if (text.includes("温暖") || text.includes("厚")) {
        reply = "【在线演示响应】已在 450Hz 附近增益了温和的基频能量，赋予乐器和人声更多温暖与厚度。";
      } else if (text.includes("响") || text.includes("炸") || text.includes("冲击力")) {
        reply = "【在线演示响应】已推高总线限制器电平，母带动态更具冲击力，响度推升至 -11.0 LUFS。";
      }
      project.chat_history.push({ role: "assistant", content: reply });
      renderChat();
      btnSendChat.disabled = false;
      btnSendChat.innerHTML = '<i class="fa-solid fa-arrow-up text-xs"></i>';
    }, 600);
    return;
  }

  try {
    const res = await fetch('/api/mix/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    });
    if (res.ok) {
      await refreshProject();
      setListenMode('mix');
    } else {
      const errData = await res.json();
      alert('调整失败: ' + (errData.detail || '未知错误'));
    }
  } catch (err) {
    alert('对话网络错误: ' + err.message);
  } finally {
    btnSendChat.disabled = false;
    btnSendChat.innerHTML = '<i class="fa-solid fa-arrow-up text-xs"></i>';
  }
}

// 保存 LLM 配置
async function saveLlmSettings() {
  const key = inputApiKey.value.trim();
  const base = inputApiBase.value.trim();
  const model = inputModel.value.trim();

  try {
    const res = await fetch('/api/llm/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: key, api_base: base, model: model })
    });
    if (res.ok) {
      currentLlmLabel.textContent = key ? `${model} 已连接` : '内置专家引擎';
      settingsModal.classList.add('hidden');
    }
  } catch (err) {
    alert('配置失败: ' + err.message);
  }
}
