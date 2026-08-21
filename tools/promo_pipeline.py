#!/usr/bin/env python3
"""
promo_pipeline.py — batch the tedious parts of publishing DISTINCT promo clips.

You bring several genuinely different clips (different takes/angles you actually
filmed). This tool, in one run:
  1. burns a different on-screen hook into each clip (solves "add on-screen text
     in bulk" without doing it by hand in the app),
  2. optionally muxes your song in as the audio track,
  3. writes a distribution manifest (CSV) mapping each rendered file to its target
     account, caption, and scheduled time — the hand-off the posting step consumes.

It does NOT post, and it deliberately does NOT manufacture near-duplicate copies
of one video to spread across multiple accounts. Posting near-identical clips
across accounts you control is spam/inauthentic behaviour under TikTok's rules and
risks the whole cluster (main included) — so this tool takes one distinct source
per post. Different real content per channel is both allowed and what actually
performs.

Posting itself is the browser step (schedule-tiktok / -youtube / -instagram
skills, or a multi-account scheduler). Library sound + captcha stay manual by
design — see the notes the run prints.

Usage:
  python3 tools/promo_pipeline.py --plan plan.json --out build/

plan.json shape:
  {
    "song": "growing_pains_audio.m4a",         # optional; omit to keep each clip's audio
    "start_time": "2026-08-22T08:00:00+12:00",  # first slot (NZ time)
    "spacing_minutes": 150,                      # gap between posts
    "posts": [
      { "video": "clips/car_take.mp4",           # a distinct clip you filmed
        "account": "theillcollective", "platform": "tiktok",
        "hook": "i'm convinced tiktok won't let my song leave taranaki. where are you from?",
        "caption": "growing pains is out 🍊 where are you listening from #theillcollective #singersongwriter #nzmusic",
        "library_sound": true },
      ...
    ]
  }
"""
import argparse, json, os, subprocess, sys, csv, datetime, textwrap

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
for _f in (FONT, "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
           "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"):
    if os.path.exists(_f):
        FONT = _f
        break


def run(cmd):
    r = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if r.returncode != 0:
        sys.stderr.write(r.stderr.decode()[-1500:])
        raise SystemExit(f"ffmpeg failed: {' '.join(cmd[:6])} ...")
    return r


def esc(text):
    # escape for ffmpeg drawtext
    return text.replace("\\", "\\\\").replace(":", "\\:").replace("'", "’").replace("%", "\\%")


def wrap_hook(text, width=24):
    return "\n".join(textwrap.wrap(text, width=width)) or text


def render(src, out, hook, song):
    """Burn the hook as a TikTok-style caption box; optionally swap in the song."""
    hook_wrapped = esc(wrap_hook(hook))
    draw = (
        f"drawtext=fontfile='{FONT}':text='{hook_wrapped}':"
        f"fontcolor=black:fontsize=h/26:line_spacing=10:"
        f"box=1:boxcolor=white@0.92:boxborderw=28:"
        f"x=(w-text_w)/2:y=h*0.14"
    )
    cmd = ["ffmpeg", "-y", "-i", src]
    if song:
        cmd += ["-i", song]
    cmd += ["-vf", draw]
    if song:
        cmd += ["-map", "0:v:0", "-map", "1:a:0", "-shortest"]
    cmd += ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
            "-c:a", "aac", "-b:a", "192k",
            "-movflags", "+faststart", out]
    run(cmd)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--plan", required=True)
    ap.add_argument("--out", default="build")
    ap.add_argument("--video", help="fallback clip if a post omits its own 'video'")
    args = ap.parse_args()

    plan = json.load(open(args.plan))
    os.makedirs(args.out, exist_ok=True)
    song = plan.get("song")
    if song and not os.path.exists(song):
        raise SystemExit(f"song file not found: {song}")

    start = plan.get("start_time")
    t0 = datetime.datetime.fromisoformat(start) if start else None
    gap = datetime.timedelta(minutes=plan.get("spacing_minutes", 150))

    rows = []
    for i, p in enumerate(plan["posts"]):
        src = p.get("video") or args.video
        if not src or not os.path.exists(src):
            raise SystemExit(f"post {i+1} (@{p.get('account')}): missing clip '{src}'. "
                             f"Give each post its own distinct 'video'.")
        fname = f"{i+1:02d}_{p['platform']}_{p['account'].replace(' ', '_')}.mp4"
        fpath = os.path.join(args.out, fname)
        print(f"[{i+1}/{len(plan['posts'])}] {fname}  <- {os.path.basename(src)}")
        render(src, fpath, p["hook"], song)
        when = (t0 + i * gap).isoformat() if t0 else ""
        rows.append({
            "order": i + 1, "file": fname, "platform": p["platform"],
            "account": p["account"], "post_at": when,
            "sound": "PHONE (app-only)" if p.get("library_sound") else "baked-in",
            "hook": p["hook"], "caption": p["caption"],
        })

    mpath = os.path.join(args.out, "distribution_manifest.csv")
    with open(mpath, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader(); w.writerows(rows)

    print(f"\n✓ {len(rows)} clips rendered to {args.out}/")
    print(f"✓ manifest: {mpath}")
    phone = [r for r in rows if "PHONE" in r["sound"]]
    if phone:
        print("\n⚠ Post these from the phone so you can attach the official library "
              "sound (automation can't add TikTok library sounds):")
        for r in phone:
            print(f"   • {r['file']}  ->  @{r['account']}")


if __name__ == "__main__":
    main()
