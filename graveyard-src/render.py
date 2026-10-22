"""
Render the graveyard animation to graveyard.gif + graveyard-final-frame.png.

  pip install pillow playwright      (Chromium must already be available)
  python graveyard-src/render.py [--out DIR] [--sheet contact.png]

Each frame is built as SVG by scene.py, rasterised by headless Chromium at 4x
(1152 x 864), downsampled to 288 x 216 with Lanczos, then quantised against one
shared palette (no dithering) and assembled into a play-once GIF.
"""
import argparse
import io
import os
import sys

from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import scene  # noqa: E402

W, H = 288, 216
SCALE = 4
FRAME_MS = 1000 // scene.FPS
FINAL_HOLD_MS = 1500
COLORS = 96


def render_frames():
    frames = []
    times = scene.frame_times()
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": W, "height": H}, device_scale_factor=SCALE)
        for t in times:
            svg = scene.frame_svg(t, W, H)
            page.set_content(
                "<!doctype html><html><body style='margin:0;background:#2a2650'>" + svg + "</body></html>")
            png = page.screenshot(clip={"x": 0, "y": 0, "width": W, "height": H})
            big = Image.open(io.BytesIO(png)).convert("RGB")
            frames.append(big.resize((W, H), Image.LANCZOS))
        browser.close()
    return times, frames


def build_palette(frames):
    # Sample frames across the whole action so every colour family is covered.
    picks = frames[:: max(1, len(frames) // 12)] + [frames[-1]]
    strip = Image.new("RGB", (W, H * len(picks)))
    for i, fr in enumerate(picks):
        strip.paste(fr, (0, i * H))
    return strip.quantize(colors=COLORS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)


def save_gif(frames, path):
    pal = build_palette(frames)
    q = [fr.quantize(palette=pal, dither=Image.Dither.NONE) for fr in frames]
    durations = [FRAME_MS] * len(q)
    durations[-1] = FINAL_HOLD_MS
    # No "loop" argument -> no NETSCAPE loop block -> browsers play it once
    # and stay on the final frame.
    q[0].save(path, save_all=True, append_images=q[1:], duration=durations,
              optimize=True, disposal=1)


def contact_sheet(times, frames, path, n=12):
    idx = sorted(set(round(i * (len(frames) - 1) / (n - 1)) for i in range(n)))
    # make sure the key beats are in the sheet
    for key in (scene.T_BREAK + 0.04, scene.T_UPRIGHT, scene.T_SWING + 0.12,
                scene.T_CONTACT, scene.T_FLAT + 0.04):
        idx.append(min(range(len(times)), key=lambda i: abs(times[i] - key)))
    idx = sorted(set(idx))
    cols = 4
    rows = (len(idx) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (W + 6) + 6, rows * (H + 22) + 6), "#111")
    d = ImageDraw.Draw(sheet)
    for k, i in enumerate(idx):
        x = 6 + (k % cols) * (W + 6)
        y = 6 + (k // cols) * (H + 22)
        sheet.paste(frames[i], (x, y))
        d.text((x + 2, y + H + 4), f"#{i}  t={times[i]:.2f}s", fill="#ddd")
    sheet.save(path)


def main():
    ap = argparse.ArgumentParser()
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ap.add_argument("--out", default=root)
    ap.add_argument("--sheet", default=None, help="optional contact-sheet PNG path")
    args = ap.parse_args()

    # rig sanity checks: rigid bones and nothing below the dirt
    worst = -99
    for t in scene.frame_times():
        lu, lf, pen = scene.check_frame(t)
        assert abs(lu - scene.LU) < 1e-6 and abs(lf - scene.LF) < 1e-6, (t, lu, lf)
        worst = max(worst, pen)
    print(f"bones rigid; max hand/forearm overlap with grass top: {worst:.2f} units")

    times, frames = render_frames()
    gif = os.path.join(args.out, "graveyard.gif")
    save_gif(frames, gif)
    frames[-1].save(os.path.join(args.out, "graveyard-final-frame.png"), optimize=True)
    if args.sheet:
        contact_sheet(times, frames, args.sheet)
    print(f"{gif}: {len(frames)} frames, {os.path.getsize(gif) / 1024:.1f} KB")


if __name__ == "__main__":
    main()
