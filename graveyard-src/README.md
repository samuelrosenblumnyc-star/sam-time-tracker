# Graveyard easter-egg GIF

Source for `graveyard.gif` and `graveyard-final-frame.png` (repo root).

- `scene.py` builds each frame as SVG on a 96 x 72 grid from time `t` alone (deterministic). The arm is a rigid two-bone rig: the elbow only folds left, bone lengths never change, and once the palm lands, two-bone IK keeps the wrist pinned to its contact point while the buried shoulder dips on impact and heaves during the hold.
- `render.py` rasterises every frame with headless Chromium at 4x (1152 x 864), downsamples to 288 x 216, quantises to one shared 96-colour palette with no dithering, and writes a play-once GIF (25 fps, final frame held 1.5 s).

```
pip install pillow playwright      # Chromium must already be installed
python graveyard-src/render.py                     # writes to the repo root
python graveyard-src/render.py --out /tmp --sheet /tmp/contact.png
```

Timing (seconds): ground still 0 to 0.1, soil bulges and bursts at 0.2, punch tops out about 0.5, beat with tremor and finger flex to 0.82, anticipation, forearm folds left and the palm lands at 1.22, fingers slap flat at 1.28, impact settles by 1.48, slight heave and pile crack during the hold, static from 2.55 to the end.
