#!/bin/bash
# 智能参考混音工作站启动脚本

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "========================================================="
echo "🎵 启动 Smart Mixing Studio (智能参考混音工作站) 🎵"
echo "========================================================="

if [ ! -d ".venv" ]; then
    echo "正在初始化虚拟环境..."
    /opt/homebrew/bin/python3.11 -m venv .venv
    source .venv/bin/activate
    pip install -r backend/requirements.txt
else
    source .venv/bin/activate
fi

# 如果没有演示音频，自动生成一组供体验
if [ ! -d "demo_assets" ]; then
    echo "生成默认演示分轨音频 (Drums, Bass, Keys, Vocal, Reference)..."
    python tests/generate_demo_assets.py ./demo_assets
fi

echo ""
echo "🚀 服务已启动！请在浏览器访问："
echo "   👉 http://127.0.0.1:8000"
echo ""
echo "提示：按 Ctrl+C 可停止服务"
echo "========================================================="

uvicorn backend.app:app --host 0.0.0.0 --port 8000
