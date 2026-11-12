#!/usr/bin/env python3
"""Pipeline for one vertical gaming/tech short. Run from anywhere; <short> is the project's short/ folder.

  short.py new <short>                 copy the template in
  short.py tts <short> [voice_id]      narration/short.txt -> short.mp3 + short.align.json (ElevenLabs, costs credits)
  short.py voice <short> <speed>       speed up -> assets/audio/vo.mp3, words.json, prints numbered words
  short.py gen <short>                 scenes.json -> index.html + captions.html, prints scene times and local word times
  short.py bgm <short> <track> [vol]   loop a track under the whole video, prints how far under the voice it sits
  short.py finish <short> <name>       renders/<name>.mp4 -> renders/<name>-final.mp4 at -14 LUFS
"""
import base64, html, json, math, os, re, shutil, subprocess, sys, urllib.request

V = 0.2            # the voice starts this far into the video
LEAD = 0.05        # a scene cuts just before its first word
OUTRO_GAP = 1.0    # held after the last word
OUTRO_LEN = 3.63   # assets/template/compositions/outro.html is this long
CHRIS = "iP95p4xoKVk53GoZ742B"
HERE = os.path.dirname(os.path.abspath(__file__))


def ff(*a):
    return subprocess.run(["ffmpeg", "-hide_banner", "-y", *a], capture_output=True, text=True, errors="replace", check=True).stderr


def duration(p):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p],
                                capture_output=True, text=True, check=True).stdout)


def lufs(p):
    return float(re.findall(r"^\s+I:\s+(-?[\d.]+) LUFS", ff("-i", p, "-af", "ebur128", "-f", "null", "-"), re.M)[-1])


def new(root):
    if os.path.exists(os.path.join(root, "meta.json")):
        sys.exit(root + " already has a project; refusing to overwrite it")
    shutil.copytree(os.path.join(HERE, "..", "assets", "template"), root, dirs_exist_ok=True)
    for d in ("narration", "renders"):
        os.makedirs(os.path.join(root, d), exist_ok=True)
    name = os.path.basename(os.path.dirname(os.path.abspath(root)))
    json.dump({"id": name + "-short", "name": name + "-short"}, open(os.path.join(root, "meta.json"), "w"), indent=2)
    print("Next: put ELEVENLABS_API_KEY=... in", os.path.join(root, ".env"), "and write narration/short.txt")


def api_key(root):
    if os.environ.get("ELEVENLABS_API_KEY"):
        return os.environ["ELEVENLABS_API_KEY"]
    env = os.path.join(root, ".env")
    if os.path.exists(env):
        for line in open(env):
            if line.startswith("ELEVENLABS_API_KEY"):
                return line.split("=", 1)[1].strip()
    sys.exit("No ElevenLabs key: set ELEVENLABS_API_KEY or put it in " + env)


def tts(root, voice=CHRIS):
    out = os.path.join(root, "narration", "short")
    if os.path.exists(out + ".mp3"):
        sys.exit(out + ".mp3 exists. Move it aside first if you really want to pay for a new take.")
    body = {"text": open(out + ".txt", encoding="utf8").read().strip(), "model_id": "eleven_multilingual_v2",
            "voice_settings": {"stability": 0.45, "similarity_boost": 0.8, "style": 0.15, "use_speaker_boost": True}}
    req = urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{voice}/with-timestamps?output_format=mp3_44100_128",
                                 data=json.dumps(body).encode(), headers={"xi-api-key": api_key(root), "Content-Type": "application/json"})
    d = json.load(urllib.request.urlopen(req))
    open(out + ".mp3", "wb").write(base64.b64decode(d["audio_base64"]))
    json.dump(d["alignment"], open(out + ".align.json", "w"))
    print("raw voice", round(d["alignment"]["character_end_times_seconds"][-1], 1), "s")


def split_words(a):
    words, cur = [], None
    for c, s, e in zip(a["characters"], a["character_start_times_seconds"], a["character_end_times_seconds"]):
        if c.isspace():
            if cur: words.append(cur); cur = None
        elif cur:
            cur["w"] += c; cur["e"] = e
        else:
            cur = {"w": c, "s": s, "e": e}
    if cur: words.append(cur)
    return words


def voice(root, speed):
    n = os.path.join(root, "narration")
    words = split_words(json.load(open(os.path.join(n, "short.align.json"))))
    json.dump(words, open(os.path.join(n, "words.json"), "w"))
    vo = os.path.join(root, "assets", "audio", "vo.mp3")
    ff("-i", os.path.join(n, "short.mp3"), "-af", f"atempo={speed}", vo)
    print(f"voice {duration(vo):.1f} s at {speed}x, video about {duration(vo) + V + OUTRO_GAP + OUTRO_LEN:.1f} s")
    print(" ".join(f"{k}:{w['w']}" for k, w in enumerate(words)))
    print('\nscenes.json: {"speed": %s, "helpers": [], "bgm_volume": 0.45, "scenes": [["hook", 0], ["next-scene", <index of its first word>]]}' % speed)


def timing(root):
    """Scene list with times, from scenes.json + words.json. The outro is added automatically."""
    cfg = json.load(open(os.path.join(root, "scenes.json")))
    sp = cfg["speed"]
    words = [{"w": w["w"], "s": w["s"] / sp, "e": w["e"] / sp} for w in json.load(open(os.path.join(root, "narration", "words.json")))]
    starts = [0 if k == 0 else round(words[i]["s"] + V - LEAD, 2) for k, (_, i) in enumerate(cfg["scenes"])]
    outro = round(words[-1]["e"] + V + OUTRO_GAP, 2)
    total = round(outro + OUTRO_LEN, 2)
    assert starts == sorted(starts), "scenes.json: word indexes must increase"
    ids = [s for s, _ in cfg["scenes"]] + ["outro"]
    ends = starts[1:] + [outro, total]
    return cfg, words, list(zip(ids, starts + [outro], ends)), total


def gen(root):
    cfg, words, scenes, TOTAL = timing(root)
    hosts = "\n".join(f'      <div id="{i}" data-composition-id="{i}" data-composition-src="compositions/{i}.html" data-start="{a}" data-duration="{round(b - a, 3)}" data-track-index="1" data-track-kind="graphics" data-width="1080" data-height="1920"></div>' for i, a, b in scenes)
    cuts = [a for _, a, _ in scenes[1:]]
    whoosh = "\n".join(f'      <audio id="wh-{k}" class="clip" src="assets/audio/whoosh-short.mp3" data-start="{round(c - 0.3, 2)}" data-duration="0.57" data-track-index="{6 + k}" data-volume="0.35"></audio>' for k, c in enumerate(cuts))
    helpers = "\n".join(f'    <script src="{h}"></script>' for h in cfg.get("helpers", []))
    bgm = ""
    if os.path.exists(os.path.join(root, "assets", "audio", "bgm.mp3")):
        bgm = f'\n      <audio id="bgm" class="clip" src="assets/audio/bgm.mp3" data-start="0" data-duration="{TOTAL}" data-track-index="5" data-volume="{cfg.get("bgm_volume", 0.45)}"></audio>'
    vo = round(duration(os.path.join(root, "assets", "audio", "vo.mp3")), 2)
    index = f'''<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <script src="assets/fire.js"></script>
{helpers}
    <style>
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ margin: 0; width: 1080px; height: 1920px; overflow: hidden; background: #070707; }}
      #root {{ width: 100%; height: 100%; position: relative; }}
      #burn {{ position: absolute; inset: 0; z-index: 50; pointer-events: none; }}
      #burn i {{ position: absolute; left: 0; width: 100%; height: 12.6%; display: block; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{TOTAL}" data-width="1080" data-height="1920">
{hosts}
      <div id="captions" style="z-index:10" data-composition-id="captions" data-composition-src="compositions/captions.html" data-start="0" data-duration="{TOTAL}" data-track-index="2" data-track-kind="captions" data-width="1080" data-height="1920"></div>
      <audio id="vo" class="clip" src="assets/audio/vo.mp3" data-start="{V}" data-duration="{vo}" data-track-index="3" data-volume="1"></audio>{bgm}
{whoosh}
      <div id="burn" class="clip" data-start="0" data-duration="{TOTAL}" data-track-index="4" data-layout-ignore>
        <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
      </div>
    </div>
    <script>
      // Scene change: eight palette bands sweep up over the cut.
      const tl = gsap.timeline({{ paused: true }});
      const bands = [...document.querySelectorAll("#burn i")];
      const ramp = [4, 9, 15, 21, 26, 30, 33, 36];
      bands.forEach((b, k) => {{ b.style.background = DF.css(DF.PAL[ramp[k]]); b.style.top = k * 12.5 + "%"; }});
      gsap.set(bands, {{ yPercent: 800 }});
      {json.dumps(cuts)}.forEach((c) => {{
        bands.forEach((b, k) => tl.fromTo(b, {{ yPercent: 800 }}, {{ yPercent: -800, duration: 0.45, ease: "power2.inOut" }}, c - 0.22 + k * 0.01));
      }});
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
'''
    open(os.path.join(root, "index.html"), "w", encoding="utf8").write(index)

    # Caption groups: up to 4 words, break after punctuation or a pause >= 0.15 s; the spoken word is in the accent.
    groups, cur = [], []
    for k, w in enumerate(words):
        cur.append(w)
        nxt = words[k + 1] if k + 1 < len(words) else None
        if len(cur) >= 4 or w["w"][-1] in ".?!,:" or nxt is None or nxt["s"] - w["e"] >= 0.15:
            groups.append(cur); cur = []
    rows, js = [], []
    for g, ws in enumerate(groups):
        a = round(V + ws[0]["s"] - 0.05, 2)
        nxt = groups[g + 1][0]["s"] + V - 0.06 if g + 1 < len(groups) else ws[-1]["e"] + V + 0.6
        b = round(min(nxt, ws[-1]["e"] + V + 0.7), 2)
        spans = " ".join(f'<span id="cap-{g}-{j}">{html.escape(w["w"].upper())}</span>' for j, w in enumerate(ws))
        rows.append(f'    <div id="cap-{g}" class="clip cap" data-start="{a}" data-duration="{round(b - a, 2)}" data-track-index="1"><p>{spans}</p></div>')
        for j, w in enumerate(ws):
            js.append(f'tl.set("#cap-{g}-{j}", {{ color: "#df4f07" }}, {round(V + w["s"], 2)}); tl.set("#cap-{g}-{j}", {{ color: "#efefc7" }}, {round(V + w["e"] + 0.02, 2)});')
    caps = f'''<template>
  <style>
    #root {{ position: absolute; inset: 0; pointer-events: none; }}
    .cap {{ position: absolute; left: 0; right: 0; top: 1190px; text-align: center; overflow: visible; }}
    .cap p {{ display: inline-block; background: #070707; padding: 10px 26px 14px; font-family: "League Gothic"; font-size: 92px; line-height: 1; color: #efefc7; letter-spacing: 0.01em; max-width: 960px; }}
  </style>
  <div id="root" data-composition-id="captions" data-width="1080" data-height="1920">
{chr(10).join(rows)}
  </div>
  <script>
    const tl = gsap.timeline({{ paused: true }});
    {(chr(10) + "    ").join(js)}
    window.__timelines["captions"] = tl;
  </script>
</template>
'''
    open(os.path.join(root, "compositions", "captions.html"), "w", encoding="utf8").write(caps)

    print(f"total {TOTAL} s, {len(groups)} caption groups")
    for i, a, b in scenes:
        local = [f"{w['w']}@{w['s'] + V - a:.2f}" for w in words if a <= w["s"] + V < b]
        print(f"\n{i}: start {a}, data-duration {round(b - a, 2)}\n  " + " ".join(local))
        if not os.path.exists(os.path.join(root, "compositions", i + ".html")):
            print("  (compositions/%s.html not written yet)" % i)


def bgm(root, track, vol=None):
    cfg, _, _, total = timing(root)
    if vol is not None:
        cfg["bgm_volume"] = float(vol)
        json.dump(cfg, open(os.path.join(root, "scenes.json"), "w"), indent=2)
    d, X = duration(track), 1.5
    n = max(1, math.ceil((total - X) / (d - X)))
    chain = "[0]"
    if n > 1:
        chain = "[0][1]acrossfade=d=1.5" + "".join(f"[a{k}];[a{k}][{k + 1}]acrossfade=d=1.5" for k in range(1, n - 1)) + ","
    f = f"{chain}atrim=0:{total},afade=t=in:d=0.4,afade=t=out:st={round(total - 3.3, 2)}:d=3.3"
    args = []
    for _ in range(n): args += ["-i", track]
    out = os.path.join(root, "assets", "audio", "bgm.mp3")
    ff(*args, "-filter_complex", f, out)
    v = cfg.get("bgm_volume", 0.45)
    gap = lufs(os.path.join(root, "assets", "audio", "vo.mp3")) - (lufs(out) + 20 * math.log10(v))
    print(f"bgm {n}x loop, {total} s, volume {v}: {gap:.1f} dB under the voice (aim for about 12 to 18). Re-run gen.")


def finish(root, name):
    r = os.path.join(root, "renders")
    src, dst = os.path.join(r, name + ".mp4"), os.path.join(r, name + "-final.mp4")
    base = "I=-14:TP=-1.5:LRA=11"
    m = json.loads(re.findall(r"\{[^{}]*\}", ff("-i", src, "-af", f"loudnorm={base}:print_format=json", "-f", "null", "-"))[-1])
    ff("-i", src, "-c:v", "copy", "-af", f"loudnorm={base}:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true",
       "-ar", "48000", "-c:a", "aac", "-b:a", "256k", dst)
    print(dst, f"{lufs(dst)} LUFS (-14 +/- 0.7 is fine), {duration(dst):.1f} s")


if __name__ == "__main__":
    cmds = {"new": new, "tts": tts, "voice": voice, "gen": gen, "bgm": bgm, "finish": finish}
    if len(sys.argv) < 3 or sys.argv[1] not in cmds:
        sys.exit(__doc__)
    if sys.argv[1] == "voice":
        voice(sys.argv[2], float(sys.argv[3]))
    else:
        cmds[sys.argv[1]](*sys.argv[2:])
