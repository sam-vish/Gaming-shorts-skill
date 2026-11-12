---
name: gaming-tech-shorts
description: Make a finished vertical gaming or tech explainer short (4K MP4, voiceover, word-by-word captions, retro DOOM-fire look) with HyperFrames, from a script or just a topic. Use whenever someone wants a YouTube Short, Reel or TikTok that explains how a game works or a dev/AI tool, in the style of "DOOM isn't 3D", "Pac-Man's ghosts aren't chasing you" or "Tetris isn't random", or pastes a timed short script and asks to turn it into a video, even if they never mention HyperFrames or a skill. Not for long-form videos, talking-head edits, or editing existing footage.
---

# Gaming and tech shorts

One vertical explainer, from script to a loudness-normalised 4K file. The look stays the same from video to video, so the channel is recognisable; the job each time is finding the one visual idea that makes the topic click.

**Needs:** Node, Python 3, ffmpeg, an ElevenLabs key. Read the `hyperframes` skill first if it's installed (`npx skills add heygen-com/hyperframes`). Pin `npx --yes hyperframes@0.8.202` for every command so a CLI update can't change a render halfway through a series.

`scripts/short.py` does the mechanical steps. Below, `$S` means this skill's `scripts/short.py`.

## 1. Script and facts

- **Length:** about 130 words makes a 43 s short at 1.10x. Count words before anything else. If the timestamps in a script can't hold its words, say so with the real length, and ask or keep the words rather than silently cutting lines.
- **Facts:** check technical claims against primary sources (the repo, the source code, the official docs). If a line is wrong, reword it and tell the person exactly what changed. Viewers of this niche will correct you in the comments, and a wrong claim discredits the whole series.
- **First-person claims:** numbers like "took me 42 minutes" or "a million views" and any "I built this" story can only come from the person. Never invent them, and if there's no recording of the thing, tell them the video will show a stylised version, so they can decide whether the claim holds up. Flag this at the end as well.
- **Voice spelling:** write what the voice should say. "IT WORKED" can come out as "I.T.", so use "It worked!". Captions are uppercased anyway.

## 2. Voice

```bash
python $S new <project>/short
# put ELEVENLABS_API_KEY in <project>/short/.env, write narration/short.txt
python $S tts <project>/short            # costs credits; default voice is Chris
python $S voice <project>/short 1.10     # 1.06 to 1.18; prints numbered words
```

Keep real pauses in storytelling scripts, because they're the pacing. For a small script change, cut the words out of the existing take rather than paying for a new one, and warn that a cut can leave a line sounding unfinished, since you can't hear the result yourself.

## 3. Plan scenes

Plan one idea per sentence group, and cut on sentence starts. Write `<short>/scenes.json`, naming each scene and the index of its first word:

```json
{"speed": 1.10, "helpers": ["assets/topic.js"], "bgm_volume": 0.45,
 "scenes": [["hook", 0], ["how", 24], ["twist", 61], ["cta", 118]]}
```

Then `python $S gen <short>`. It writes `index.html` and `compositions/captions.html` (never hand-edit those, the next `gen` replaces them) and prints every scene's start, `data-duration`, and the local time of each word. Author scene timing from that printout so things land on the spoken word. The outro is added automatically; change its label in `compositions/outro.html`.

**Music (optional):** `python $S bgm <short> track.mp3 0.45`, then `gen` again. It loops the track with crossfades, fades the end, and prints the gap under the voice. Commercial game soundtracks usually get a Content ID claim, so mention that when someone supplies one.

## 4. Build the scenes

Each scene is `compositions/<id>.html`. Copy the shape of `references/examples/`: `stats.html` is the simplest, `prompt.html` reveals text word by word, `fail.html` drives a canvas. Their `.sh-tag`, `.sh-card` and `.sh-doc` classes are defined at the top of `sheet.js`; copy that CSS into your own helper.

- A `<template>` whose `#root` has `data-composition-id`, using **local** times.
- A paused GSAP timeline on `window.__timelines["<id>"]`, ended with `tl.to({}, { duration: D }, 0)`.
- Timed elements: `class="clip"`, `data-start`, `data-duration`, `data-track-index`.
- Scene audio: `<audio class="clip">` on tracks 20 and up. The lint warning about nested media timing is expected.
- **Seek safety:** frames are rendered by seeking, not playing, so everything has to come from the timeline: `tl.set`, `fromTo`, or `onUpdate` on a plain object that redraws a canvas. No timers, no `Math.random`, no `Date.now`.
- **Canvas images:** use real `<img>` tags in the document (hidden is fine), so the renderer waits for them. See `sheet.js`.

**The topic helper is where the video gets good.** Put the real mechanism in `assets/<topic>.js` and let scenes tween its state: `maze.js` holds Pac-Man's actual targeting maths with a `?test` self-check, and `sheet.js` samples a game view into spreadsheet cells. When a visual is backed by the real logic, it can't quietly drift from the claim.

### Look

| | |
|---|---|
| Colours | Only the 37 `DF.PAL` fire colours (`assets/fire.js`). Ground `#070707`, cards `#FFFFFF`, ink `#EFEFC7`, one accent `#DF4F07`, plus `#672807` and `#CF8717` |
| Fonts | League Gothic for display, JetBrains Mono for labels and numbers. Use them for buttons too |
| Motion | `ease: "steps(n)"`, hard cuts. The palette wipe at each cut comes from the generator. No glow, gradients or particles |
| Fire | Only as the closing sign-off (`DF.Sim`, already in the outro). A constant fire strip looks cheap |
| Layout | Content in y 0 to 1150, text below y 168, captions at y 1190 |

Things that have gone wrong before: `~` renders oversized in League Gothic, so write "ABOUT 8 FPS". Sprites sampled into low-res grids turn to mush unless the background is darkened and the sprite brightened.

**Assets:** use licence-clean sources only. Freedoom sprites (BSD) from `raw.githubusercontent.com/freedoom/freedoom/master/sprites/<name>.png`, publisher download pages, or original pixel art. Don't use ripped game assets, and credit sources in the video description. The bundled SFX are `click`, `pop`, `key-press`, `typing`, `glitch-1` and `whoosh-short`.

## 5. Check, render, finish

```bash
cd <short>
npx --yes hyperframes@0.8.202 check --json > check.log    # the report's "ok" must be true
npx --yes hyperframes@0.8.202 snapshot --at 1.5,6,12,... --no-end -o ../snap
```

Look at `contact-sheet*.jpg` before rendering, since a render takes minutes and snapshots take seconds. Fix `layout` errors, or add `data-layout-allow-overlap` where an overlap is intended.

```bash
npx --yes hyperframes@0.8.202 render -o renders/<name>.mp4 --quality delivery --resolution portrait-4k > render.log 2>&1
python $S finish <short> <name>
```

Run the render in the background. Log to a file, not through `tail`, or you can't see progress. Allow several minutes per minute of video, and before restarting a render that seems dead, check whether it's still running, because a second copy writing the same file wastes the whole run. If the system drive is short on space, point `TEMP`, `TMP` and `TMPDIR` at a bigger drive first and delete that folder afterwards.

## 6. Hand over

Pull a frame or two from the final file to confirm it. Then report the path, length and LUFS, plus:
- every line of the script you changed, and why;
- claims you couldn't verify, stylised stand-ins for real footage, and likely music claims;
- anything you couldn't check, which always includes how the audio actually sounds.
