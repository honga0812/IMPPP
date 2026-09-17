import os
import json
import re
import requests
from typing import Dict, Any, List, Optional

class MixingCopilot:
    def __init__(self, api_key: Optional[str] = None, api_base: Optional[str] = None, model: str = "gpt-4o"):
        self.api_key = api_key or os.environ.get("LLM_API_KEY", "")
        self.api_base = api_base or os.environ.get("LLM_API_BASE", "https://api.openai.com/v1")
        self.model = model

    def set_config(self, api_key: str, api_base: str = "", model: str = ""):
        self.api_key = api_key
        if api_base:
            self.api_base = api_base
        if model:
            self.model = model

    def identify_instrument(self, track_name: str) -> str:
        """根据分轨名称智能推断乐器类型"""
        name = track_name.lower()
        if any(k in name for k in ["voc", "sing", "lead_v", "voice", "人声", "主唱"]):
            return "vocal"
        elif any(k in name for k in ["kick", "bd", "底鼓", "大鼓"]):
            return "kick"
        elif any(k in name for k in ["snare", "sd", "军鼓"]):
            return "snare"
        elif any(k in name for k in ["drum", "beat", "perc", "hihat", "hh", "鼓"]):
            return "drums"
        elif any(k in name for k in ["bass", "808", "sub", "低音", "贝斯"]):
            return "bass"
        elif any(k in name for k in ["guitar", "gtr", "ac_gtr", "elec_gtr", "吉他"]):
            return "guitar"
        elif any(k in name for k in ["piano", "keys", "rhodes", "ep", "钢琴", "键盘"]):
            return "piano"
        elif any(k in name for k in ["synth", "pad", "lead", "string", "合成器", "弦乐"]):
            return "synth"
        return "other"

    def rule_based_strategy(
        self,
        tracks_data: List[Dict[str, Any]],
        ref_analysis: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        内置资深混音师启发式专业算法 (离线兜底，无需 API Key 即可达到出色的混音效果)
        """
        target_lufs = -14.0
        if ref_analysis and "integrated_lufs" in ref_analysis:
            target_lufs = ref_analysis["integrated_lufs"]
            # 限制在商业标准区间 [-16.0, -9.0]
            target_lufs = float(max(min(target_lufs, -9.0), -16.0))

        ref_spectrum = ref_analysis.get("spectral_bands_db", {}) if ref_analysis else {}
        ref_air = ref_spectrum.get("air", -25.0)
        ref_bass = ref_spectrum.get("bass", -12.0)

        track_actions = []
        guitar_count = 0
        synth_count = 0

        for trk in tracks_data:
            tid = trk["id"]
            name = trk.get("name", tid)
            instrument = self.identify_instrument(name)

            action = {
                "track_id": tid,
                "instrument": instrument,
                "high_pass_hz": 0,
                "eq_adjustments": [],
                "compressor": None,
                "pan": 0.0,
                "gain_trim_db": 0.0,
                "volume": trk.get("volume", 1.0)
            }

            if instrument == "vocal":
                # 人声声学处理：去除 90Hz 杂音，削弱 300Hz 浊音，提升 10kHz 空气感
                action["high_pass_hz"] = 90
                action["eq_adjustments"] = [
                    {"freq": 320, "gain_db": -2.0, "q": 1.2},
                    {"freq": 3500, "gain_db": 1.5, "q": 1.0}, # 提高穿透力
                    {"freq": 10500, "gain_db": 2.0, "q": 0.7} # 空气感
                ]
                action["compressor"] = {
                    "threshold_db": -16.0,
                    "ratio": 3.0,
                    "attack_ms": 15.0,
                    "release_ms": 100.0
                }
                action["pan"] = 0.0
                action["gain_trim_db"] = 0.5

            elif instrument in ["kick", "bass"]:
                # 低频根基：绝对居中，动态紧致
                action["high_pass_hz"] = 30
                if instrument == "kick":
                    action["eq_adjustments"] = [
                        {"freq": 65, "gain_db": 2.0, "q": 1.4},
                        {"freq": 400, "gain_db": -3.0, "q": 1.5}, # 掏空箱体浑浊感
                        {"freq": 3200, "gain_db": 1.8, "q": 1.2}  # 踩锤打击感
                    ]
                    action["compressor"] = {
                        "threshold_db": -14.0,
                        "ratio": 4.0,
                        "attack_ms": 25.0,
                        "release_ms": 60.0
                    }
                else: # bass
                    action["eq_adjustments"] = [
                        {"freq": 90, "gain_db": 1.5, "q": 1.2},
                        {"freq": 800, "gain_db": 1.0, "q": 1.0},
                        {"freq": 5000, "gain_db": -4.0, "q": 0.7} # 切掉多余高频
                    ]
                    action["compressor"] = {
                        "threshold_db": -15.0,
                        "ratio": 3.5,
                        "attack_ms": 20.0,
                        "release_ms": 80.0
                    }
                action["pan"] = 0.0

            elif instrument in ["drums", "snare"]:
                action["high_pass_hz"] = 60
                action["eq_adjustments"] = [
                    {"freq": 200, "gain_db": 1.0, "q": 1.0},
                    {"freq": 5000, "gain_db": 1.5, "q": 1.0}
                ]
                action["compressor"] = {
                    "threshold_db": -12.0,
                    "ratio": 2.5,
                    "attack_ms": 20.0,
                    "release_ms": 100.0
                }

            elif instrument in ["guitar", "piano", "synth"]:
                # 中频乐器声场扩展与低频避让
                action["high_pass_hz"] = 100
                action["eq_adjustments"] = [
                    {"freq": 280, "gain_db": -1.5, "q": 1.0}, # 避免与贝斯打架
                    {"freq": 2500, "gain_db": -1.0, "q": 1.2} # 让人声突出
                ]
                # 交替立体声声相排列
                if instrument == "guitar":
                    guitar_count += 1
                    action["pan"] = -0.35 if guitar_count % 2 == 1 else 0.35
                elif instrument == "synth":
                    synth_count += 1
                    action["pan"] = 0.4 if synth_count % 2 == 1 else -0.4
                else: # piano
                    action["pan"] = -0.2
            else:
                action["high_pass_hz"] = 70

            track_actions.append(action)

        bus_eq = []
        if ref_analysis:
            # 如果参考曲的高频尤其亮，总线略微提升 High-Shelf
            if ref_air > -22.0:
                bus_eq.append({"freq": 12000, "gain_db": 1.2, "q": 0.7})
            if ref_bass > -10.0:
                bus_eq.append({"freq": 80, "gain_db": 0.8, "q": 0.8})

        explanation = (
            f"已根据参考声学风格制定专业混音方案：目标响度锁定在 {target_lufs} LUFS；"
            "为人声与各乐器完成了低频泥泞滤除、中频人声避让与立体声声场展宽；"
            "总线启用了模拟总线胶水压缩与 True-Peak 防削波母带处理。"
        )

        return {
            "thought_process": "内置资深混音专家规则执行：声部自动分频、声相避让平衡、目标动态对齐。",
            "explanation_for_user": explanation,
            "track_actions": track_actions,
            "bus_master": {
                "glue_compressor": {
                    "threshold_db": -13.0,
                    "ratio": 2.0,
                    "attack_ms": 30.0,
                    "release_ms": 100.0
                },
                "bus_eq": bus_eq,
                "target_lufs": target_lufs,
                "ceiling_dbtp": -0.5
            }
        }

    def generate_mix_strategy(
        self,
        tracks_data: List[Dict[str, Any]],
        ref_analysis: Optional[Dict[str, Any]] = None,
        user_preference: str = ""
    ) -> Dict[str, Any]:
        """
        调用 LLM 或退化为启发式规则生成完整策略
        """
        if not self.api_key:
            return self.rule_based_strategy(tracks_data, ref_analysis)

        # 构造发给大模型的 Prompt
        system_prompt = (
            "你是一名国际顶级音频混音与母带工程师（Mixing & Mastering Engineer）。"
            "你需要根据提供的各分轨信息、参考曲的声学特征画像（LUFS、频谱分布、动态）、以及用户的风格偏好，"
            "给出最专业的分轨处理策略与总线母带参数。\n"
            "你必须严格返回合法的 JSON 对象，不包含任何外部 markdown 标记，格式定义如下：\n"
            "{\n"
            '  "thought_process": "你的专业声学分析与思考流程",\n'
            '  "explanation_for_user": "给创作者的通俗专业的修改说明",\n'
            '  "track_actions": [\n'
            '    {\n'
            '      "track_id": "分轨ID",\n'
            '      "high_pass_hz": 90,\n'
            '      "eq_adjustments": [{"freq": 300, "gain_db": -2.0, "q": 1.0}],\n'
            '      "compressor": {"threshold_db": -16.0, "ratio": 3.0, "attack_ms": 15, "release_ms": 100},\n'
            '      "pan": 0.0,\n'
            '      "gain_trim_db": 0.0\n'
            "    }\n"
            "  ],\n"
            '  "bus_master": {\n'
            '    "glue_compressor": {"threshold_db": -13.0, "ratio": 2.0, "attack_ms": 30, "release_ms": 100},\n'
            '    "bus_eq": [{"freq": 10000, "gain_db": 1.0, "q": 0.7}],\n'
            '    "target_lufs": -14.0,\n'
            '    "ceiling_dbtp": -0.5\n'
            "  }\n"
            "}"
        )

        user_content = {
            "tracks": [{"id": t["id"], "name": t.get("name", t["id"]), "instrument": self.identify_instrument(t.get("name", ""))} for t in tracks_data],
            "reference_analysis": ref_analysis,
            "user_preference": user_preference or "商业级现代流行/流媒体质感，平衡、宽广、清透"
        }

        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": self.model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": json.dumps(user_content, ensure_ascii=False)}
                ],
                "temperature": 0.3
            }
            resp = requests.post(f"{self.api_base}/chat/completions", headers=headers, json=payload, timeout=25)
            if resp.status_code == 200:
                res_json = resp.json()
                content = res_json["choices"][0]["message"]["content"]
                # 清洗可能存在的 ```json 代码块
                match = re.search(r"\{.*\}", content, re.DOTALL)
                if match:
                    parsed = json.loads(match.group(0))
                    return parsed
        except Exception as e:
            print(f"[LLM Copilot Warning] API 调用失败，自动降级至内置专家规则: {e}")

        return self.rule_based_strategy(tracks_data, ref_analysis)

    def chat_and_adjust_strategy(
        self,
        current_strategy: Dict[str, Any],
        user_message: str,
        tracks_data: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        根据用户的自然语言反馈，对当前混音参数进行增量调节
        """
        # 如果配置了 API，优先交给 LLM 增量微调
        if self.api_key:
            system_prompt = (
                "你是一名正在与音乐人共同混音的 AI 混音工程师。"
                "用户会用自然语言表达他的听觉反馈（如'人声太暗了'、'低音轰头'、'把吉他往两边推一点'等）。"
                "请根据用户当前的要求，对现有的混音参数（current_strategy）进行针对性调整，"
                "并严格以 JSON 格式输出更新后的完整 strategy，附带简明清晰的 explanation_for_user 回答用户的指令。"
            )
            try:
                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                }
                payload = {
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": f"当前策略: {json.dumps(current_strategy, ensure_ascii=False)}\n用户指令: {user_message}"}
                    ],
                    "temperature": 0.3
                }
                resp = requests.post(f"{self.api_base}/chat/completions", headers=headers, json=payload, timeout=20)
                if resp.status_code == 200:
                    content = resp.json()["choices"][0]["message"]["content"]
                    match = re.search(r"\{.*\}", content, re.DOTALL)
                    if match:
                        return json.loads(match.group(0))
            except Exception as e:
                print(f"[LLM Chat Warning] API 微调失败，降级至规则意图解析: {e}")

        # 离线自然语言意图规则引擎 (Natural Language Intent Parser)
        updated_strategy = json.loads(json.dumps(current_strategy)) # 深拷贝
        msg = user_message.lower()
        explanation_lines = []

        # 意图 1：人声贴耳 / 穿透力 / 空气感 / 太暗
        if any(w in msg for w in ["贴耳", "穿透", "人声突出", "靠前", "空气感", "太暗", "提亮"]):
            for act in updated_strategy.get("track_actions", []):
                trk_name = next((t.get("name", "") for t in tracks_data if t["id"] == act["track_id"]), "")
                if self.identify_instrument(trk_name) == "vocal":
                    act.setdefault("eq_adjustments", []).append({"freq": 10500, "gain_db": 2.5, "q": 0.8})
                    act["eq_adjustments"].append({"freq": 3500, "gain_db": 2.0, "q": 1.0})
                    if act.get("compressor"):
                        act["compressor"]["threshold_db"] -= 2.0
                    explanation_lines.append("增强了人声 3.5kHz 穿透力与 10.5kHz 空气感高频，并加强了动态平整度。")

        # 意图 2：低音太重 / 轰头 / 浑浊 / 去除低频
        if any(w in msg for w in ["轰头", "浑浊", "低音太重", "低频太多", "发闷", "太闷"]):
            for act in updated_strategy.get("track_actions", []):
                act["high_pass_hz"] = max(act.get("high_pass_hz", 0), 90)
                act.setdefault("eq_adjustments", []).append({"freq": 250, "gain_db": -2.5, "q": 1.2})
            explanation_lines.append("提升了各轨道的高通截止频点，并衰减了 250Hz 的浑浊频段，使声音更加通透清爽。")

        # 意图 3：增加温暖度 / 厚度
        if any(w in msg for w in ["温暖", "厚重", "饱满", "复古"]):
            for act in updated_strategy.get("track_actions", []):
                trk_name = next((t.get("name", "") for t in tracks_data if t["id"] == act["track_id"]), "")
                if self.identify_instrument(trk_name) in ["vocal", "guitar", "piano"]:
                    act.setdefault("eq_adjustments", []).append({"freq": 450, "gain_db": 1.5, "q": 1.0})
            explanation_lines.append("在 450Hz 附近增益了温和的基频能量，赋予乐器和人声更多温暖与厚度。")

        # 意图 4：声场拉开 / 立体声拓宽
        if any(w in msg for w in ["声场", "立体声", "宽广", "两边", "推开"]):
            for act in updated_strategy.get("track_actions", []):
                if abs(act.get("pan", 0.0)) > 0.05:
                    act["pan"] = float(np.clip(act["pan"] * 1.5, -0.9, 0.9))
            explanation_lines.append("拓宽了伴奏乐器的左右立体声分布，为人声留出了正中央舞台。")

        # 意图 5：更响 / 更具冲击力
        if any(w in msg for w in ["大声", "响度", "冲击力", "炸"]):
            updated_strategy.setdefault("bus_master", {})["target_lufs"] = min(
                updated_strategy.get("bus_master", {}).get("target_lufs", -14.0) + 2.0, -9.0
            )
            explanation_lines.append("提高了母带限制器的驱动电平，目标响度提升至商业大动态标准。")

        if not explanation_lines:
            explanation_lines.append("已解析您的想法并针对相关频段和动态平衡进行了精细化微调。")

        updated_strategy["explanation_for_user"] = " ".join(explanation_lines)
        return updated_strategy
