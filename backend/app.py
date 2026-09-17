import os
import sys
import shutil
import zipfile
import uuid
from typing import List, Optional

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
        uploaded.append(track_info)
    return {"tracks": project_state["tracks"], "added": uploaded}

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

@app.post("/api/project/clear")
def clear_project():
    project_state["tracks"] = []
    project_state["reference"] = None
    project_state["current_strategy"] = None
    project_state["current_mix"] = None
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
    return {"status": "ok", "reference": ref_info}

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

    # 2. 执行 DSP 混音渲染
    master_path = os.path.join(EXPORTS_DIR, "master_output.wav")
    mix_res = mixer_engine.mix_and_master(
        tracks_data=project_state["tracks"],
        strategy=strategy,
        output_master_path=master_path,
        export_stems_dir=PROCESSED_STEMS_DIR
    )

    project_state["current_mix"] = {
        "master_url": "/media/exports/master_output.wav",
        "lufs": mix_res["final_lufs"],
        "peak_db": mix_res["final_peak_db"],
        "duration": mix_res["duration"]
    }

    # 添加 Copilot 消息
    explanation = strategy.get("explanation_for_user", "混音与母带化处理完成。")
    project_state["chat_history"].append({
        "role": "assistant",
        "content": f"【智能参考混音完成】\n{explanation}\n• 成品响度：{mix_res['final_lufs']} LUFS\n• 真实峰值：{mix_res['final_peak_db']} dBFS"
    })

    return {
        "status": "ok",
        "mix": project_state["current_mix"],
        "strategy": strategy,
        "chat_history": project_state["chat_history"]
    }

@app.post("/api/mix/chat")
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

    # 重新渲染 DSP
    master_path = os.path.join(EXPORTS_DIR, "master_output.wav")
    mix_res = mixer_engine.mix_and_master(
        tracks_data=project_state["tracks"],
        strategy=updated_strategy,
        output_master_path=master_path,
        export_stems_dir=PROCESSED_STEMS_DIR
    )

    project_state["current_mix"] = {
        "master_url": f"/media/exports/master_output.wav?t={uuid.uuid4().hex[:6]}",
        "lufs": mix_res["final_lufs"],
        "peak_db": mix_res["final_peak_db"],
        "duration": mix_res["duration"]
    }

    reply_content = updated_strategy.get("explanation_for_user", "已完成参数调整与重渲染。")
    project_state["chat_history"].append({
        "role": "assistant",
        "content": f"{reply_content}\n• 当前响度：{mix_res['final_lufs']} LUFS"
    })

    return {
        "status": "ok",
        "mix": project_state["current_mix"],
        "strategy": updated_strategy,
        "chat_history": project_state["chat_history"]
    }

@app.get("/api/export/master")
def export_master():
    master_path = os.path.join(EXPORTS_DIR, "master_output.wav")
    if not os.path.exists(master_path):
        raise HTTPException(status_code=404, detail="尚未生成混音成品")
    return FileResponse(master_path, media_type="audio/wav", filename="Master_Mix_Output.wav")

@app.get("/api/export/stems_zip")
def export_stems_zip():
    if not os.path.exists(PROCESSED_STEMS_DIR):
        raise HTTPException(status_code=404, detail="尚无处理后的分轨")

    zip_path = os.path.join(EXPORTS_DIR, "Processed_Stems.zip")
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, _, files in os.walk(PROCESSED_STEMS_DIR):
            for file in files:
                if file.endswith((".wav", ".flac", ".mp3")):
                    file_full = os.path.join(root, file)
                    zipf.write(file_full, arcname=file)

    return FileResponse(zip_path, media_type="application/zip", filename="Processed_Stems.zip")

# 挂载静态媒体文件与前端目录
app.mount("/media", StaticFiles(directory=PROJECT_DIR), name="media")
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")
if os.path.exists(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
