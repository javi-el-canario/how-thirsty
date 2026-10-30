"""Prepare pictures for "Real or AI?": square crop, 1000 px, WebP, no metadata (no GPS!).

Setup (once):   pip install pillow
iPhone HEIC photos too (optional):   pip install pillow-heif

Real photos  -> images/real/NNN.webp   (numbered in order, continuing after the last one):
    python tools/prepare-images.py "C:/path/to/my-photos" --kind real

AI pictures  -> images/ai/NNN.webp. Files named 1.png, 2.png ... keep their number (it matches the prompt list):
    python tools/prepare-images.py "C:/path/to/ai-pictures" --kind ai

Pictures are not paired any more: the game picks one real and one AI picture at random every round.
The originals are never touched or copied. A line per picture is appended to tools/pictures-sources.log
so you can find the original later.
"""
import argparse
import re
import sys
from datetime import date
from pathlib import Path

try:
    from PIL import Image, ImageOps
except ImportError:
    sys.exit("Pillow is missing. Install it with:  pip install pillow")

try:                                           # optional: lets Pillow open iPhone HEIC photos
    from pillow_heif import register_heif_opener
    register_heif_opener()
except ImportError:
    pass

SIZE = 1000
QUALITY = 82
EXTS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".avif", ".bmp", ".tif", ".tiff"}
ROOT = Path(__file__).resolve().parent.parent
LOG = Path(__file__).resolve().parent / "pictures-sources.log"


def prepare(src: Path, dest: Path, inset: float) -> None:
    im = Image.open(src)
    im = ImageOps.exif_transpose(im)          # honour the phone's rotation flag
    im = im.convert("RGB")                    # drops alpha; EXIF/GPS is not carried over
    w, h = im.size
    side = int(min(w, h) * (1 - inset))       # optional inset trims corner marks (e.g. the Gemini sparkle)
    left, top = (w - side) // 2, (h - side) // 2
    im = im.crop((left, top, left + side, top + side)).resize((SIZE, SIZE), Image.LANCZOS)
    im.save(dest, "WEBP", quality=QUALITY, method=6)   # no exif/icc argument = metadata stripped


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("folder", help="folder with the original pictures")
    ap.add_argument("--kind", choices=["real", "ai"], required=True)
    ap.add_argument("--start", type=int, default=None, help="first number (default: continue after the last existing one)")
    ap.add_argument("--inset", type=float, default=None, help="trim this fraction from the edges before the square crop (default 0.06 for ai, 0 for real)")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    src_dir = Path(a.folder)
    def natural(path: Path):                     # 1, 2, 10 (not 1, 10, 2)
        return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", path.stem)]

    files = sorted((p for p in src_dir.iterdir() if p.suffix.lower() in EXTS), key=natural)
    if not files:
        sys.exit("No pictures found in that folder.")
    inset = a.inset if a.inset is not None else (0.06 if a.kind == "ai" else 0.0)
    out_dir = ROOT / "images" / a.kind
    out_dir.mkdir(parents=True, exist_ok=True)

    existing = {int(m.group(1)) for f in out_dir.glob("*.webp") if (m := re.fullmatch(r"(\d+)", f.stem))}
    n = a.start if a.start is not None else (max(existing) + 1 if existing else 1)
    lines = []
    for p in files:
        if a.kind == "ai" and p.stem.isdigit():     # AI files named 1, 2, 3...: the file name IS the prompt number
            n = int(p.stem)
        else:
            while n in existing:
                n += 1
        existing.add(n)
        dest = out_dir / f"{n:03d}.webp"
        print(f"{p.name}  ->  {a.kind}/{dest.name}" + ("  (dry run)" if a.dry_run else ""))
        if not a.dry_run:
            prepare(p, dest, inset)
            lines.append(f"{date.today()}  {a.kind}/{dest.name}  <-  {p}")
        n += 1
    if lines:
        with LOG.open("a", encoding="utf8") as f:
            f.write("\n".join(lines) + "\n")
        print(f"\nDone: {len(lines)} picture(s). Next: node tools/build-pictures-json.mjs")


if __name__ == "__main__":
    main()
