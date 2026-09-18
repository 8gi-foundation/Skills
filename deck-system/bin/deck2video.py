#!/usr/bin/env python3
"""deck2video - turn an HTML slide deck into a narrated MP4 in the Create pane.

A standing system capability (not a one-off): any deck whose slides are
`<div class="slide" data-slide="N">` toggled by an `.active` class - the 8GI
deck convention - becomes a narrated video. Per-slide narration is read from
`data-voiceover` (spoken with the slide's `data-voice`, mapped to an installed
macOS voice); each slide stays up for the length of its line; a soft, low,
lowpassed pad sits underneath. The finished MP4 lands in ~/.8gent/creative/ so
the relay `GET /creative` (:7890) surfaces it on the Mac pill AND the phone.

Usage:
  python3 deck2video.py <deck.html|file-url> [--out NAME] [--rate WPM]
                        [--max-slides K] [--no-voice]

On the fly: this is what a voice/pill "make a video of <deck>" should invoke -
it is fully headless, deterministic, and prints the output path + JSON summary.
"""
import argparse, html, json, os, re, subprocess, sys, tempfile, shutil

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
CREATIVE = os.path.expanduser(os.environ.get("DECK_OUT_DIR", "~/.8gent/creative"))
TD = 0.5; LEAD = 0.8; TAIL = 1.1; MIN_D = 3.5; FR = 30

# Neural Supertonic TTS (same binary the relay /tts uses). Map a voice name to a
# Supertonic style; mirrors mac/relay/server.py.
SUPERTONIC_BIN = next((p for p in [
    os.path.join(os.path.dirname(sys.executable), "supertonic"),
    shutil.which("supertonic") or "",
    os.path.expanduser("~/.pyenv/shims/supertonic")] if p and os.path.exists(p)), None)
ST_VOICE = {"Daniel": "M2", "Rishi": "M3", "Samantha": "F1", "Moira": "F2",
            "Karen": "F3", "Tessa": "F4", "Reed": "M4", "Grandpa": "M5",
            "Alex": "M2", "Fred": "M5", "Victoria": "F3", "Jorge": "M2"}

# KittenTTS (neural, local). Voices: Bella Jasper Luna Bruno Rosie Hugo Kiki Leo
KITTEN_MODEL = "KittenML/kitten-tts-nano-0.8"
KITTEN_VOICES = {"Bella","Jasper","Luna","Bruno","Rosie","Hugo","Kiki","Leo"}
_KITTEN = {"m": None}

# NEURAL routing: every deck voice is pinned to a real neural engine.
# ("st", style) -> Supertonic.   ("kt", voice) -> KittenTTS.
# Using BOTH engines is deliberate: it doubles the number of genuinely
# distinguishable timbres, which matters when a deck has many speakers.
NEURAL_VOICE = {
    "Daniel":   ("st", "M2"),   # narrator
    "Moira":    ("st", "F2"),
    "Karen":    ("st", "F3"),
    "Samantha": ("st", "F1"),
    "Tessa":    ("st", "F4"),
    "Reed":     ("st", "M4"),
    "Rishi":    ("st", "M3"),
    "Fred":     ("kt", "Bruno"),
    "Ralph":    ("kt", "Hugo"),
    "Albert":   ("kt", "Leo"),
    "Alex":     ("kt", "Jasper"),
    "Victoria": ("kt", "Rosie"),
    "Kathy":    ("kt", "Kiki"),
    "Allison":  ("kt", "Luna"),
    "Ava":      ("kt", "Bella"),
}

def kitten_say(text, out_wav, voice):
    """Synthesize with KittenTTS. Returns out_wav or None."""
    try:
        from kittentts import KittenTTS
    except Exception:
        return None
    try:
        if _KITTEN["m"] is None:
            _KITTEN["m"] = KittenTTS(KITTEN_MODEL)
        v = voice if voice in KITTEN_VOICES or str(voice).startswith("expr-") else "Jasper"
        _KITTEN["m"].generate_to_file(text, out_wav, voice=v)
        return out_wav if os.path.exists(out_wav) else None
    except Exception:
        return None

def run(cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def dur(p):
    r = subprocess.run(["ffprobe","-v","error","-show_entries","format=duration",
                        "-of","csv=p=0",p], capture_output=True, text=True)
    try: return float(r.stdout.strip())
    except ValueError: return 0.0

def installed_voices():
    r = subprocess.run(["say","-v","?"], capture_output=True, text=True)
    return {ln.split()[0] for ln in r.stdout.splitlines() if ln.strip()}

def resolve_voice(name, have):
    if name in have: return name
    female = {"Victoria","Allison","Ava","Susan","Vicki","Kate","Serena","Moira","Tessa","Fiona"}
    if name in female:
        for f in ("Samantha","Karen","Moira"):
            if f in have: return f
    return "Daniel" if "Daniel" in have else (sorted(have)[0] if have else "Alex")

def parse_slides(src_html):
    blocks = re.findall(r'<div class="slide[^"]*"[^>]*data-slide="(\d+)"(.*?)>', src_html, re.S)
    out = []
    for idx, attrs in blocks:
        vo = re.search(r'data-voiceover="([^"]*)"', attrs)
        vc = re.search(r'data-voice="([^"]*)"', attrs)
        out.append((int(idx),
                    (vc.group(1) if vc else "Daniel"),
                    html.unescape(vo.group(1)).strip() if vo else ""))
    out.sort()
    return out

def inject_capture(src_path, work):
    h = open(src_path, encoding="utf-8").read()
    inject = r"""
<style id="cap-override">
#controls,#slide-counter,#kbd-hint{display:none!important}
.slide{transition:none!important}
.slide.active .slide-inner>*,.slide-inner>*{animation:none!important;opacity:1!important;transform:none!important}
</style>
<script>(function(){function show(){var m=(location.hash.match(/slide=(\d+)/)||[])[1];
if(m==null)return;var i=+m,s=document.querySelectorAll('.slide');
s.forEach(function(el,idx){el.classList.remove('exit-up');var key=el.getAttribute('data-slide');el.classList.toggle('active',key!=null?key===m:idx===i);});}
window.addEventListener('hashchange',show);setTimeout(show,40);setTimeout(show,250);setTimeout(show,600);})();</script>
"""
    h = h.replace("</body>", inject + "</body>") if "</body>" in h else h + inject
    cap = os.path.join(work, "deck_cap.html")
    open(cap, "w", encoding="utf-8").write(h)
    return cap

def screenshot(cap, i, work):
    f = os.path.join(work, f"frame-{i:02d}.png")
    run([CHROME, "--headless=new", "--hide-scrollbars", "--force-device-scale-factor=1",
         "--window-size=1920,1080", "--virtual-time-budget=2800",
         f"--screenshot={f}", f"file://{cap}#slide={i}"])
    return f

def narrate(idx, voice, text, rate, work, no_voice, tts="say"):
    wav = os.path.join(work, f"vo-{idx:02d}.wav")
    if not text or no_voice:
        run(["ffmpeg","-y","-f","lavfi","-i","anullsrc=r=48000:cl=stereo","-t","3",wav])
        return wav
    src = None

    def _supertonic(style):
        if not SUPERTONIC_BIN: return None
        cand = os.path.join(work, f"vo-{idx:02d}.st.wav")
        try:
            subprocess.run([SUPERTONIC_BIN, "tts", text, "-o", cand, "--voice", style, "--steps", "8"],
                           check=True, timeout=120, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return cand if os.path.exists(cand) else None
        except Exception:
            return None

    def _kitten(v):
        return kitten_say(text, os.path.join(work, f"vo-{idx:02d}.kt.wav"), v)

    if tts == "neural":
        # Standing rule: neural only. Route each speaker to its pinned engine,
        # then try the other neural engine before ever touching macOS say.
        eng, v = NEURAL_VOICE.get(voice, ("st", ST_VOICE.get(voice, "M2")))
        src = _supertonic(v) if eng == "st" else _kitten(v)
        if src is None:
            src = _kitten("Jasper") if eng == "st" else _supertonic(ST_VOICE.get(voice, "M2"))
        if src is None:
            print(f"  ! slide {idx}: both neural engines failed for '{voice}', using say", file=sys.stderr)
    elif tts == "kitten":
        src = _kitten(NEURAL_VOICE.get(voice, ("kt","Jasper"))[1])
        if src is None: src = _supertonic(ST_VOICE.get(voice, "M2"))
    elif tts == "supertonic":
        src = _supertonic(ST_VOICE.get(voice, "M2"))
        if src is None: src = _kitten("Jasper")

    if src is None:  # last resort only
        src = os.path.join(work, f"vo-{idx:02d}.aiff")
        subprocess.run(["say","-v",voice,"-r",str(rate),"-o",src,text], check=True)
    run(["ffmpeg","-y","-i",src,"-af","loudnorm=I=-18:TP=-2:LRA=11","-ar","48000","-ac","2",wav])
    return wav

def build_music(total, work):
    pad=("(0.5*sin(130.81*2*PI*t)+0.42*sin(196*2*PI*t)+0.34*sin(261.63*2*PI*t)"
         "+0.22*sin(329.63*2*PI*t))*(0.65+0.35*sin(0.07*2*PI*t))")
    m=os.path.join(work,"music.wav"); fo=max(0.1,total-4)
    run(["ffmpeg","-y","-f","lavfi","-i",f"aevalsrc={pad}:s=48000:d={total+0.5}",
         "-af",f"aecho=0.85:0.9:220:0.3,lowpass=f=2000,highpass=f=70,"
               f"afade=t=in:st=0:d=4,afade=t=out:st={fo}:d=4,volume=0.15", m])
    return m

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("deck")
    ap.add_argument("--out"); ap.add_argument("--rate",type=int,default=168)
    ap.add_argument("--max-slides",type=int,default=0); ap.add_argument("--no-voice",action="store_true")
    ap.add_argument("--no-music",action="store_true",help="voiceover only - no music bed at all")
    ap.add_argument("--tts",default="neural",choices=["neural","supertonic","kitten","say"],
                    help="narration engine. Default 'neural' = Supertonic + KittenTTS, "
                         "never macOS say unless both fail.")
    a=ap.parse_args()
    src=a.deck[7:] if a.deck.startswith("file://") else a.deck
    src=os.path.abspath(os.path.expanduser(src))
    if not os.path.isfile(src): sys.exit(f"deck not found: {src}")
    os.makedirs(CREATIVE, exist_ok=True)
    name=a.out or ("deck-"+re.sub(r'[^a-zA-Z0-9_-]','-',os.path.splitext(os.path.basename(src))[0]))
    out=os.path.join(CREATIVE,name+".mp4")
    work=tempfile.mkdtemp(prefix="deck2video-")
    try:
        slides=parse_slides(open(src,encoding="utf-8").read())
        if a.max_slides>0: slides=slides[:a.max_slides]
        if not slides: sys.exit("no .slide/data-slide elements found - not an 8GI-convention deck")
        have=installed_voices(); N=len(slides)
        print(f"{N} slides; rendering...", file=sys.stderr)
        cap=inject_capture(src, work)
        vdur=[]
        for k,(idx,voice,text) in enumerate(slides):
            screenshot(cap, idx, work)
            vdur.append(dur(narrate(idx, resolve_voice(voice,have), text, a.rate, work, a.no_voice, a.tts)))
        d=[max(MIN_D,v+LEAD+TAIL) for v in vdur]
        start=[sum(d[:j])-j*TD for j in range(N)]
        total=sum(d)-(N-1)*TD
        if not a.no_music: build_music(total, work)
        for k,(idx,_,_) in enumerate(slides):
            run(["ffmpeg","-y","-loop","1","-t",f"{d[k]:.3f}","-i",os.path.join(work,f"frame-{idx:02d}.png"),
                 "-vf","scale=1920:1080:force_original_aspect_ratio=decrease,"
                       "pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p",
                 "-r",str(FR),"-c:v","libx264","-tune","stillimage","-preset","veryfast",
                 "-pix_fmt","yuv420p",os.path.join(work,f"kb-{idx:02d}.mp4")])
        inputs=[]
        for k,(idx,_,_) in enumerate(slides): inputs+=["-i",os.path.join(work,f"kb-{idx:02d}.mp4")]
        for k,(idx,_,_) in enumerate(slides): inputs+=["-i",os.path.join(work,f"vo-{idx:02d}.wav")]
        if not a.no_music: inputs+=["-i",os.path.join(work,"music.wav")]
        fc=""; prev="[0]"
        for j in range(1,N):
            lbl=f"[v{j}]"; fc+=f"{prev}[{j}]xfade=transition=fade:duration={TD}:offset={start[j]:.3f}{lbl};"; prev=lbl
        amix=""
        for k in range(N):
            delay=int(round((start[k]+LEAD)*1000)); fc+=f"[{N+k}]adelay={delay}|{delay}[a{k}];"; amix+=f"[a{k}]"
        if a.no_music:
            fc+=(f"{amix}amix=inputs={N}:normalize=0:duration=longest,alimiter=limit=0.95[aout]"
                 if N >= 2 else f"{amix}volume=1[aout]")
        else:
            fc+=f"[{2*N}]anull[mus];{amix}[mus]amix=inputs={N+1}:normalize=0:duration=longest,alimiter=limit=0.95[aout]"
        subprocess.run(["ffmpeg","-y","-hide_banner","-loglevel","error",*inputs,
            "-filter_complex",fc,"-map",prev,"-map","[aout]",
            "-c:v","libx264","-profile:v","high","-pix_fmt","yuv420p","-g","60","-keyint_min","60",
            "-sc_threshold","0","-c:a","aac","-b:a","160k","-ar","48000",
            "-t",f"{total:.3f}","-movflags","+faststart",out], check=True)
        print(out)
        print(json.dumps({"out":out,"name":name+".mp4","slides":N,
                          "dur":round(dur(out),2),"size":os.path.getsize(out)}))
    finally:
        shutil.rmtree(work, ignore_errors=True)

if __name__=="__main__":
    main()
