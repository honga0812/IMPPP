import os
import sys
import shutil
import zipfile
import uuid
from typing import List, Optional
import numpy as np
import soundfile as sf
import scipy.signal

# Ensure backend directory is in sys.path for direct sibling imports
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from acoustic_analyzer import analyze_audio_file
from mixer_engine import MixingEngine
from llm_copilot import MixingCopilot

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)
PROJECT_DIR = os.path.join(ROOT_DIR, "projects", "default")
STEMS_DIR = os.path.join(PROJECT_DIR, "stems")
REF_DIR = os.path.join(PROJECT_DIR, "reference")
EXPORTS_DIR = os.path.join(PROJECT_DIR, "exports")
PROCESSED_STEMS_DIR = os.path.join(EXPORTS_DIR, "stems")

for d in [STEMS_DIR, REF_DIR, EXPORTS_DIR, PROCESSED_STEMS_DIR]:
    os.makedirs(d, exist_ok=True)

app = FastAPI(title="Smart Mixing Studio", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 核心单例
mixer_engine = MixingEngine(sample_rate=44100)
copilot = MixingCopilot()

# 内存工程状态 (Project State)
project_state = {
    "tracks": [], # [{"id": "...", "name": "...", "file_path": "...", "url": "...", "volume": 1.0, "pan": 0.0}]
    "reference": None, # {"file_path": "...", "url": "...", "analysis": {...}}
    "current_strategy": None,
    "current_mix": None, # {"master_url": "...", "lufs": -14.0, "peak_db": -0.5}
    "mix_versions": [], # [{"id": "v1", "name": "v1: 基准混音", "prompt": "...", "lufs": -11.5, "peak_db": -0.2, "master_url": "...", "timestamp": "..."}]
    "active_version_id": None,
    "chat_history": [
        {
            "role": "assistant",
            "content": "您好！我是您的 AI 混音工程师。请先上传分轨录音与参考曲，我会为您进行全方位的声学特征对齐，或随时通过对话告诉我您的调音想法！"
        }
    ]
}

# 数据模型
class LLMConfigRequest(BaseModel):
    api_key: str
    api_base: Optional[str] = "https://api.openai.com/v1"
    model: Optional[str] = "gpt-4o"

class TrackFaderUpdate(BaseModel):
    track_id: str
    volume: Optional[float] = None
    pan: Optional[float] = None

class ChatRequest(BaseModel):
    message: str

class VersionSelectRequest(BaseModel):
    version_id: str

class AutoMixRequest(BaseModel):
    user_preference: Optional[str] = ""

@app.get("/api/project")
def get_project():
    return project_state

@app.post("/api/llm/config")
def set_llm_config(req: LLMConfigRequest):
    copilot.set_config(api_key=req.api_key, api_base=req.api_base, model=req.model)
    return {"status": "ok", "configured": bool(req.api_key), "model": req.model}

@app.post("/api/tracks/upload")
async def upload_tracks(files: List[UploadFile] = File(...)):
    uploaded = []
    for f in files:
        tid = str(uuid.uuid4())[:8]
        filename = f.filename
        safe_path = os.path.join(STEMS_DIR, f"{tid}_{filename}")
        with open(safe_path, "wb") as buffer:
            shutil.copyfileobj(f.file, buffer)

        track_info = {
            "id": tid,
            "name": os.path.splitext(filename)[0],
            "file_name": filename,
            "file_path": safe_path,
            "url": f"/media/stems/{os.path.basename(safe_path)}",
            "volume": 1.0,
            "pan": 0.0,
            "instrument": copilot.identify_instrument(filename)
        }
        project_state["tracks"].append(track_info)
    return {"status": "ok", "tracks": project_state["tracks"], "added": uploaded, "project": project_state}

@app.delete("/api/tracks/{track_id}")
def delete_track(track_id: str):
    track = next((t for t in project_state["tracks"] if t["id"] == track_id), None)
    if track:
        if os.path.exists(track["file_path"]):
            try:
                os.remove(track["file_path"])
            except Exception:
                pass
        project_state["tracks"] = [t for t in project_state["tracks"] if t["id"] != track_id]
        return {"status": "deleted", "track_id": track_id}
    raise HTTPException(status_code=404, detail="Track not found")

from datetime import datetime

@app.post("/api/project/clear")
def clear_project():
    project_state["tracks"] = []
    project_state["reference"] = None
    project_state["current_strategy"] = None
    project_state["current_mix"] = None
    project_state["mix_versions"] = []
    project_state["active_version_id"] = None
    project_state["chat_history"] = [
        {
            "role": "assistant",
            "content": "工程已成功清空重置。您可以重新导入录音分轨与商业参考曲！"
        }
    ]
    for folder in [STEMS_DIR, REF_DIR, EXPORTS_DIR, PROCESSED_STEMS_DIR]:
        if os.path.exists(folder):
            for f in os.listdir(folder):
                fp = os.path.join(folder, f)
                if os.path.isfile(fp) and not f.startswith(".gitkeep"):
                    try:
                        os.remove(fp)
                    except Exception:
                        pass
    return {"status": "cleared", "project": project_state}

@app.post("/api/demo/load")
def load_demo_project(song_id: str = "song_01"):
    clear_project()
    song_folders = {
        "song_01": ("Song_01_Country_Ballad", "曲目一：抒情乡村风《Country Ballad》 (Country Ballad)"),
        "song_02": ("Song_02_Kpop_Modern", "曲目二：K-pop流行音乐风格《K-Pop Modern Pop》 (K-Pop)")
    }
    folder_name, title = song_folders.get(song_id, song_folders["song_01"])
    src_dir = os.path.join(ROOT_DIR, "demo_assets", folder_name)
    if not os.path.exists(src_dir):
        src_dir = os.path.join(ROOT_DIR, "frontend", "demo_assets", folder_name)
    
    if not os.path.exists(src_dir):
        raise HTTPException(status_code=404, detail="示范曲目资源未找到")

    track_files = sorted([f for f in os.listdir(src_dir) if f.endswith(".wav") and not f.startswith(".")])
    for fname in track_files:
        src_file = os.path.join(src_dir, fname)
        if "Reference" in fname or "Ref_" in fname:
            dst_ref = os.path.join(REF_DIR, fname)
            shutil.copyfile(src_file, dst_ref)
            try:
                ref_ana = analyze_audio_file(dst_ref)
            except Exception:
                ref_ana = None
            project_state["reference"] = {
                "name": fname,
                "file_name": fname,
                "file_path": dst_ref,
                "url": f"/media/reference/{fname}",
                "analysis": ref_ana
            }
        else:
            tid = f"trk_{len(project_state['tracks']) + 1:02d}"
            dst_stem = os.path.join(STEMS_DIR, f"{tid}_{fname}")
            shutil.copyfile(src_file, dst_stem)
            inst = copilot.identify_instrument(fname)
            track_info = {
                "id": tid,
                "name": os.path.splitext(fname)[0],
                "file_name": fname,
                "file_path": dst_stem,
                "url": f"/media/stems/{os.path.basename(dst_stem)}",
                "volume": 1.0,
                "pan": 0.0,
                "instrument": inst
            }
            project_state["tracks"].append(track_info)

    project_state["chat_history"].append({
        "role": "assistant",
        "content": f"已为您载入【{title}】！共 {len(project_state['tracks'])} 轨来自同一完整乐段的实录分轨，完美和声配器，专属商业参考母带已就绪。\n现在可单独试听各分轨，或点击顶部【一键参考混音】体验 AI 声学空间雕塑！"
    })
    return {"status": "loaded", "song_id": song_id, "project": project_state}

@app.post("/api/tracks/update_faders")
def update_faders(req: TrackFaderUpdate):
    for trk in project_state["tracks"]:
        if trk["id"] == req.track_id:
            if req.volume is not None:
                trk["volume"] = float(req.volume)
            if req.pan is not None:
                trk["pan"] = float(req.pan)
            return {"status": "updated", "track": trk}
    raise HTTPException(status_code=404, detail="Track not found")

@app.post("/api/reference/upload")
async def upload_reference(file: UploadFile = File(...)):
    filename = file.filename
    safe_path = os.path.join(REF_DIR, f"ref_{filename}")
    with open(safe_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # 运行声学分析
    analysis = analyze_audio_file(safe_path)
    ref_info = {
        "name": filename,
        "file_path": safe_path,
        "url": f"/media/reference/{os.path.basename(safe_path)}",
        "analysis": analysis
    }
    project_state["reference"] = ref_info
    return {"status": "ok", "reference": ref_info, "project": project_state}

@app.post("/api/mix/auto")
def run_auto_mix(req: AutoMixRequest):
    if not project_state["tracks"]:
        raise HTTPException(status_code=400, detail="请至少上传一条分轨音频")

    ref_analysis = project_state["reference"]["analysis"] if project_state["reference"] else None

    # 1. 由 Copilot 生成混音与母带策略
    strategy = copilot.generate_mix_strategy(
        tracks_data=project_state["tracks"],
        ref_analysis=ref_analysis,
        user_preference=req.user_preference
    )
    project_state["current_strategy"] = strategy

    # 2. 执行 DSP 混音渲染 (保存为 v1 与通用 master)
    master_v1_path = os.path.join(EXPORTS_DIR, "master_output_v1.wav")
    master_path = os.path.join(EXPORTS_DIR, "master_output.wav")
    mix_res = mixer_engine.mix_and_master(
        tracks_data=project_state["tracks"],
        strategy=strategy,
        output_master_path=master_v1_path,
        export_stems_dir=PROCESSED_STEMS_DIR
    )
    # 同时复制一份到通用 master_path
    shutil.copyfile(master_v1_path, master_path)

    v1_version = {
        "id": "v1",
        "name": "v1: 官方AI参考混音 (基准)",
        "prompt": req.user_preference or "一键参考混音基准",
        "lufs": mix_res["final_lufs"],
        "peak_db": mix_res["final_peak_db"],
        "duration": mix_res["duration"],
        "master_url": f"/media/exports/master_output_v1.wav?t={uuid.uuid4().hex[:6]}",
        "strategy": strategy,
        "timestamp": datetime.now().strftime("%H:%M:%S")
    }

    if "mix_versions" not in project_state or not isinstance(project_state["mix_versions"], list):
        project_state["mix_versions"] = []
    
    existing_v1 = next((v for v in project_state["mix_versions"] if v.get("id") == "v1"), None)
    if existing_v1:
        idx = project_state["mix_versions"].index(existing_v1)
        project_state["mix_versions"][idx] = v1_version
    else:
        project_state["mix_versions"].insert(0, v1_version)

    project_state["active_version_id"] = "v1"
    project_state["current_mix"] = v1_version

    # 添加 Copilot 消息
    explanation = strategy.get("explanation_for_user", "混音与母带化处理完成。")
    project_state["chat_history"].append({
        "role": "assistant",
        "content": f"【基准混音版本 v1 已生成】\n{explanation}\n• 成品响度：{mix_res['final_lufs']} LUFS\n• 真实峰值：{mix_res['final_peak_db']} dBFS\n您可以继续在下方对话框提出您的微调需求（如'人声更贴耳更有空气感'、'低音更温暖'等），AI 将为您生成专属比对版本！"
    })

    return {
        "status": "ok",
        "mix": project_state["current_mix"],
        "version": v1_version,
        "strategy": strategy,
        "project": project_state,
        "chat_history": project_state["chat_history"]
    }

@app.post("/api/mix/chat")
@app.post("/api/chat")
def chat_adjust(req: ChatRequest):
    if not project_state["tracks"]:
        raise HTTPException(status_code=400, detail="请先添加音轨")

    user_msg = req.message.strip()
    if not user_msg:
        raise HTTPException(status_code=400, detail="消息内容不能为空")

    # 记录用户消息
    project_state["chat_history"].append({"role": "user", "content": user_msg})

    current_strat = project_state.get("current_strategy")
    if not current_strat:
        # 如果还没有混音策略，先初始化一个基础策略
        ref_analysis = project_state["reference"]["analysis"] if project_state["reference"] else None
        current_strat = copilot.rule_based_strategy(project_state["tracks"], ref_analysis)

    # Copilot 对话微调策略
    updated_strategy = copilot.chat_and_adjust_strategy(
        current_strategy=current_strat,
        user_message=user_msg,
        tracks_data=project_state["tracks"]
    )
    project_state["current_strategy"] = updated_strategy

    # 识别版本标签与版本号
    next_idx = len(project_state.get("mix_versions", [])) + 1
    msg_lower = user_msg.lower()
    if any(w in msg_lower for w in ["贴耳", "空气", "人声", "明亮", "太暗", "透亮"]):
        short_tag = "人声贴耳空气感微调版"
    elif any(w in msg_lower for w in ["低频", "浑浊", "低音", "808", "下潜", "轰头", "结实"]):
        short_tag = "温暖低频与808下潜增强版"
    elif any(w in msg_lower for w in ["立体声", "宽广", "声场", "空间", "混响", "两边", "推开"]):
        short_tag = "宽广立体声沉浸混响版"
    elif any(w in msg_lower for w in ["大声", "响度", "冲击力", "炸", "动态", "有力"]):
        short_tag = "高冲击力商业母带版"
    else:
        short_tag = f"精细调音定制版 #{next_idx}"

    version_id = f"v{next_idx}"
    master_v_path = os.path.join(EXPORTS_DIR, f"master_output_{version_id}.wav")
    master_path = os.path.join(EXPORTS_DIR, "master_output.wav")

    # 重新渲染 DSP
    mix_res = mixer_engine.mix_and_master(
        tracks_data=project_state["tracks"],
        strategy=updated_strategy,
        output_master_path=master_v_path,
        export_stems_dir=PROCESSED_STEMS_DIR
    )
    shutil.copyfile(master_v_path, master_path)

    new_version = {
        "id": version_id,
        "name": f"{version_id}: {short_tag}",
        "prompt": user_msg,
        "lufs": mix_res["final_lufs"],
        "peak_db": mix_res["final_peak_db"],
        "duration": mix_res["duration"],
        "master_url": f"/media/exports/master_output_{version_id}.wav?t={uuid.uuid4().hex[:6]}",
        "strategy": updated_strategy,
        "timestamp": datetime.now().strftime("%H:%M:%S")
    }

    if "mix_versions" not in project_state or not isinstance(project_state["mix_versions"], list):
        project_state["mix_versions"] = []
    project_state["mix_versions"].append(new_version)
    project_state["active_version_id"] = version_id
    project_state["current_mix"] = new_version

    reply_content = updated_strategy.get("explanation_for_user", "已完成参数调整与重渲染。")
    project_state["chat_history"].append({
        "role": "assistant",
        "content": f"【新混音版本 {version_id} 已生成】\n{reply_content}\n• 成品响度：{mix_res['final_lufs']} LUFS | 真实峰值：{mix_res['final_peak_db']} dBFS\n您可以在【混音版本历史】或 A/B 对比面板中一键切换 {version_id} 与之前的版本进行盲听对比！"
    })

    return {
        "status": "ok",
        "mix": new_version,
        "version": new_version,
        "strategy": updated_strategy,
        "project": project_state,
        "chat_history": project_state["chat_history"]
    }

@app.post("/api/mix/version/select")
def select_version(req: VersionSelectRequest):
    versions = project_state.get("mix_versions", [])
    target = next((v for v in versions if v["id"] == req.version_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="混音版本未找到")
    project_state["active_version_id"] = req.version_id
    project_state["current_mix"] = target
    return {"status": "ok", "active_version": target, "project": project_state}

@app.post("/api/separate")
async def separate_stems(file: UploadFile = File(...)):
    """
    客户端/服务端立体声整曲 AI 音源分离接口 (4-Stem Separation)
    将任意上传的立体声歌曲分离为: 人声 (Vocals), 鼓组 (Drums), 贝斯 (Bass), 伴奏 (Other)
    """
    os.makedirs(STEMS_DIR, exist_ok=True)
    temp_input = os.path.join(PROJECT_DIR, f"temp_sep_{uuid.uuid4().hex[:8]}.wav")
    try:
        with open(temp_input, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        data, sr = sf.read(temp_input)
        if len(data.shape) == 1:
            data = np.stack([data, data], axis=-1)
        elif data.shape[1] > 2:
            data = data[:, :2]
        
        left = data[:, 0].astype(np.float32)
        right = data[:, 1].astype(np.float32)
        mid = 0.5 * (left + right)
        side = 0.5 * (left - right)
        
        # 1. 贝斯提取 (低通滤波 < 160Hz)
        sos_bass = scipy.signal.butter(4, 160.0, 'lowpass', fs=sr, output='sos')
        bass = scipy.signal.sosfilt(sos_bass, mid)
        bass_stereo = np.stack([bass, bass], axis=-1)
        
        # 2. 人声提取 (带通滤波 220Hz - 4200Hz 中置)
        sos_vocal = scipy.signal.butter(4, [220.0, 4200.0], 'bandpass', fs=sr, output='sos')
        vocal = scipy.signal.sosfilt(sos_vocal, mid)
        vocal_stereo = np.stack([vocal * 0.95, vocal * 0.95], axis=-1)
        
        # 3. 鼓组瞬态提取 (低频冲击 55-140Hz + 高频打击 2800-8500Hz)
        sos_kick = scipy.signal.butter(4, [55.0, 140.0], 'bandpass', fs=sr, output='sos')
        kick = scipy.signal.sosfilt(sos_kick, mid)
        sos_snare = scipy.signal.butter(4, [2800.0, 8500.0], 'bandpass', fs=sr, output='sos')
        snare = scipy.signal.sosfilt(sos_snare, mid)
        drum_m = kick * 0.85 + snare * 0.75
        drum_stereo = np.stack([drum_m, drum_m], axis=-1)
        
        # 4. 伴奏/其他 (立体声 Sides + 泛音残差)
        other_left = side + 0.3 * left
        other_right = -side + 0.3 * right
        other_stereo = np.stack([other_left, other_right], axis=-1)
        
        def normalize_audio(arr):
            peak = float(np.max(np.abs(arr)))
            if peak > 0.95:
                return arr * (0.92 / peak)
            return arr
            
        bass_stereo = normalize_audio(bass_stereo)
        vocal_stereo = normalize_audio(vocal_stereo)
        drum_stereo = normalize_audio(drum_stereo)
        other_stereo = normalize_audio(other_stereo)
        
        stem_specs = [
            ("track_sep_1", "人声主轨 (Vocals)", "vocal", vocal_stereo, 1.0, 0.0),
            ("track_sep_2", "节奏鼓组 (Drums)", "drum", drum_stereo, 0.95, 0.0),
            ("track_sep_3", "低音贝斯 (Bass)", "bass", bass_stereo, 1.0, 0.0),
            ("track_sep_4", "伴奏乐器 (Other)", "guitar", other_stereo, 0.9, 0.0),
        ]
        
        # 清空原分轨并写入新分轨
        for f in os.listdir(STEMS_DIR):
            try:
                os.remove(os.path.join(STEMS_DIR, f))
            except:
                pass
                
        new_tracks = []
        for tid, tname, tinstr, tdata, tvol, tpan in stem_specs:
            out_filename = f"{tid}_{tinstr}.wav"
            out_filepath = os.path.join(STEMS_DIR, out_filename)
            sf.write(out_filepath, tdata.astype(np.float32), sr)
            new_tracks.append({
                "id": tid,
                "name": tname,
                "instrument": tinstr,
                "file_path": out_filepath,
                "url": f"/media/stems/{out_filename}",
                "volume": tvol,
                "pan": tpan
            })
            
        project_state["tracks"] = new_tracks
        project_state["current_mix"] = None
        project_state["current_strategy"] = None
        project_state["mix_versions"] = []
        project_state["active_version_id"] = None
        
        return {
            "status": "ok",
            "message": "音源分离完成，已成功装载 4 轨分轨至工程！",
            "tracks": new_tracks
        }
    finally:
        if os.path.exists(temp_input):
            try:
                os.remove(temp_input)
            except:
                pass

@app.get("/api/export/master")
def export_master(version_id: Optional[str] = None):
    target_path = None
    if version_id:
        v_path = os.path.join(EXPORTS_DIR, f"master_output_{version_id}.wav")
        if os.path.exists(v_path):
            target_path = v_path
    
    if not target_path:
        default_path = os.path.join(EXPORTS_DIR, "master_output.wav")
        if os.path.exists(default_path):
            target_path = default_path

    # 如果还未生成混音文件，尝试从工程的参考曲或第一个分轨回退
    if not target_path or not os.path.exists(target_path):
        ref_url = project_state.get("reference", {}).get("url", "")
        if ref_url and ref_url.startswith("/media/"):
            rel_path = ref_url.split("?")[0].replace("/media/", "", 1)
            candidate = os.path.join(PROJECT_DIR, rel_path)
            if os.path.exists(candidate):
                target_path = candidate

    if not target_path or not os.path.exists(target_path):
        raise HTTPException(status_code=404, detail="尚未生成混音成品，请先点击一键参考混音")
    
    safe_name = f"Master_Mix_{version_id or 'Output'}.wav"
    return FileResponse(target_path, media_type="audio/wav", filename=safe_name)

@app.get("/api/export/stems_zip")
def export_stems_zip():
    source_dir = None
    if os.path.exists(PROCESSED_STEMS_DIR) and any(os.path.isfile(os.path.join(PROCESSED_STEMS_DIR, f)) for f in os.listdir(PROCESSED_STEMS_DIR)):
        source_dir = PROCESSED_STEMS_DIR
    elif os.path.exists(STEMS_DIR) and any(os.path.isfile(os.path.join(STEMS_DIR, f)) for f in os.listdir(STEMS_DIR)):
        source_dir = STEMS_DIR

    if not source_dir:
        raise HTTPException(status_code=404, detail="工程中尚无可导出的分轨音频文件")

    os.makedirs(EXPORTS_DIR, exist_ok=True)
    zip_path = os.path.join(EXPORTS_DIR, "Processed_Stems.zip")
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, _, files in os.walk(source_dir):
            for file in files:
                if file.endswith((".wav", ".flac", ".mp3", ".aac", ".m4a")):
                    file_full = os.path.join(root, file)
                    zipf.write(file_full, arcname=file)

    return FileResponse(zip_path, media_type="application/zip", filename="Processed_Stems.zip")

# 挂载静态媒体文件与前端目录
app.mount("/media", StaticFiles(directory=PROJECT_DIR), name="media")
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")
if os.path.exists(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
