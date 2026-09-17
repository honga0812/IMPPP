import os
import subprocess
import urllib.request
import urllib.parse

STEM_SOURCES = [
    {
        "url": "https://archive.org/download/instrumental_201607/stem%20vocals.mp3",
        "output_name": "01_Real_Lead_Vocal.wav",
        "instrument": "vocal_lead",
        "start": 35.0,
        "duration": 16.0
    },
    {
        "url": "https://archive.org/download/jamendo-184200/14-1644435-Kamil%20Muzyk%20_Howarang%20Van%20K_-Guitar%20Strum.mp3",
        "output_name": "02_Real_Acoustic_Guitar_Strum.wav",
        "instrument": "guitar_strum",
        "start": 135.0,
        "duration": 16.0
    },
    {
        "url": "https://archive.org/download/jamendo-184200/18-1644444-Kamil%20Muzyk%20_Howarang%20Van%20K_-Electric%20Guitar%20Chords.mp3",
        "output_name": "03_Real_Electric_Guitar_Solo.wav",
        "instrument": "guitar_solo",
        "start": 235.0,
        "duration": 16.0
    },
    {
        "url": "https://archive.org/download/jamendo-184200/11-1643787-Kamil%20Muzyk%20_Howarang%20Van%20K_-Guitar%20Rhythm.mp3",
        "output_name": "04_Real_Acoustic_Guitar_Rhythm.wav",
        "instrument": "guitar_arpeggio",
        "start": 125.0,
        "duration": 16.0
    },
    {
        "url": "https://archive.org/download/instrumental_201607/stem%20drum.mp3",
        "output_name": "05_Real_Studio_Drums.wav",
        "instrument": "drums",
        "start": 35.0,
        "duration": 16.0
    },
    {
        "url": "https://archive.org/download/instrumental_201607/stem%20bass.mp3",
        "output_name": "06_Real_Electric_Bass.wav",
        "instrument": "bass",
        "start": 35.0,
        "duration": 16.0
    },
    {
        "url": "https://archive.org/download/instrumental_201607/stem%20keys.mp3",
        "output_name": "07_Real_Rhodes_Keys.wav",
        "instrument": "piano_rhodes",
        "start": 35.0,
        "duration": 16.0
    },
    {
        "url": "https://archive.org/download/jamendo-184200/16-1644438-Kamil%20Muzyk%20_Howarang%20Van%20K_-Cello.mp3",
        "output_name": "08_Real_Acoustic_Cello.wav",
        "instrument": "synth",
        "start": 25.0,
        "duration": 16.0
    },
    {
        "url": "https://archive.org/download/instrumental_201607/mix.mp3",
        "output_name": "Ref_Real_Commercial_Pop.wav",
        "instrument": "other",
        "start": 35.0,
        "duration": 16.0
    }
]

def download_and_slice():
    tmp_dir = "/tmp/real_stems_download"
    os.makedirs(tmp_dir, exist_ok=True)
    out_dirs = [
        os.path.abspath("./demo_assets"),
        os.path.abspath("./frontend/demo_assets")
    ]
    for od in out_dirs:
        os.makedirs(od, exist_ok=True)

    headers = {"User-Agent": "Mozilla/5.0"}

    for item in STEM_SOURCES:
        url = item["url"]
        out_name = item["output_name"]
        print(f"-> 正在下载真实录音乐器: {out_name} ...")
        tmp_mp3 = os.path.join(tmp_dir, os.path.basename(url))

        if not os.path.exists(tmp_mp3):
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req) as resp, open(tmp_mp3, "wb") as f:
                f.write(resp.read())

        # 使用 ffmpeg 切出高保真 16 秒 WAV
        for od in out_dirs:
            final_wav = os.path.join(od, out_name)
            cmd = [
                "/opt/homebrew/bin/ffmpeg",
                "-y",
                "-ss", str(item["start"]),
                "-t", str(item["duration"]),
                "-i", tmp_mp3,
                "-ar", "44100",
                "-ac", "2",
                "-c:a", "pcm_s16le",
                final_wav
            ]
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
            print(f"   [OK] 生成至: {final_wav}")

    print("\n✅ 所有真实示范录音分轨下载与截取完成！")

if __name__ == "__main__":
    download_and_slice()
