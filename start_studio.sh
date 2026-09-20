#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=========================================================="
echo "🚀 启动 Smart Mixing Pro 智能混音与 AI 分离工作站..."
echo "=========================================================="

if [ -d ".venv" ]; then
    PYTHON_EXEC=".venv/bin/python"
else
    PYTHON_EXEC="python3"
fi

if lsof -i :8000 > /dev/null 2>&1; then
    echo "💡 本地工作站已在端口 8000 运行中！正在打开浏览器..."
    open "http://127.0.0.1:8000"
    exit 0
fi

echo "正在启动本地 FastAPI + Demucs v4 (MPS GPU加速) 服务..."
open "http://127.0.0.1:8000"
$PYTHON_EXEC -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
