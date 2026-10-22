"""
Graveyard easter-egg animation: scene model + per-frame SVG builder.

Everything is designed on a 96 x 72 unit grid (y grows downward) and is a pure
function of time t (seconds), so any frame can be rebuilt deterministically.

Rig
---
A rigid two-bone arm (upper arm + forearm) plus a hand.
  * Angles are measured from straight up, clockwise positive (screen space).
  * The upper arm hangs from a shoulder S that sits underground.
  * The elbow only bends one way (negative = forearm folds to the LEFT).
  * Bone lengths never change; joints only rotate. While the palm is planted,
    the elbow is placed with analytic two-bone IK so the wrist stays exactly
    on its contact point even when the shoulder dips or heaves underneath.
"""
import math

# ── palette ──────────────────────────────────────────────────────────
BG = "#2a2650"
MOON = "#f6f1c7"
STAR = "#ffffff"
STONE = "#9ca3af"
STONE_LINE = "#6b7280"
STONE_TEXT = "#4b5563"
BONE = "#f3f0e6"
BONE_LINE = "#cfc8b4"
SOIL = "#4a3728"
GRASS = "#3f7a4a"
PILE = "#5a4332"
PILE_HI = "#6e5340"
PILE_DARK = "#3a2a1e"
CLUMP = "#6b4f3a"
DUST = "#b09679"

# ── layout ───────────────────────────────────────────────────────────
GROUND = 60.0          # soil surface
REST_Y = 59.0          # top edge of the 2px grass line (things rest on this)
FPS = 25
DURATION = 3.0         # seconds of animation (the final frame is then held)

LU = 23.0              # upper arm length
LF = 16.0              # forearm length
PALM = 4.6             # wrist -> knuckles
FINGER_LEN = [4.3, 5.3, 5.1, 4.2]
FINGER_OFF = [-1.95, -0.65, 0.65, 1.95]   # across the palm
SPREAD_UP = [-13.0, -4.5, 4.5, 13.0]      # splay while reaching up
SPREAD_FLAT = [-1.0, 3.0, 7.0, 12.0]       # splay while lying on the ground
THUMB_LEN = 3.7
OUTLINE = 0.5          # outline thickness on each side of a bone

S0 = (60.5, 66.0)      # rest position of the (hidden) shoulder
PILE_X = 58.6          # centre of the hole / dirt pile
HAND_AXIS_FLAT = 56.6  # wrist / hand centre-line height when the palm is flat
WRIST_PLANT = (46.6, HAND_AXIS_FLAT)

# ── timeline (seconds) ───────────────────────────────────────────────
T_PUSH = 0.10          # still ground until here, then the soil starts to bulge
T_BREAK = 0.20         # bones break the surface
T_TOP = 0.50           # punch reaches (and slightly overshoots) full height
T_UPRIGHT = 0.58       # settled upright
T_ANTIC = 0.82         # anticipation (small lean back) starts
T_SWING = 0.94         # forearm starts to fold left
T_CONTACT = 1.22       # heel of the palm meets the dirt
T_FLAT = 1.28          # fingers slapped flat
T_SETTLED = 1.48       # impact fully settled (final pose)
T_HEAVE = 1.80         # slight heave / pile crack during the hold
T_END_MOTION = 2.55


# ── maths helpers ────────────────────────────────────────────────────
def clamp01(x):
    return 0.0 if x < 0 else 1.0 if x > 1 else x


def seg(t, a, b):
    return clamp01((t - a) / (b - a))


def lerp(a, b, u):
    return a + (b - a) * u


def smooth(u):
    u = clamp01(u)
    return u * u * (3 - 2 * u)


def ease_in_out(u):
    u = clamp01(u)
    return 0.5 - 0.5 * math.cos(math.pi * u)


def ease_out(u, p=3):
    u = clamp01(u)
    return 1 - (1 - u) ** p


def ease_in(u, p=2):
    return clamp01(u) ** p


def back_out(u, s=1.6):
    """Ease-out that overshoots past 1 and settles back (overshoot ~ s/10)."""
    u = clamp01(u) - 1
    return 1 + u * u * ((s + 1) * u + s)


def damped(u, freq, decay):
    return math.sin(2 * math.pi * freq * u) * math.exp(-decay * u)


def dirv(theta_deg):
    a = math.radians(theta_deg)
    return math.sin(a), -math.cos(a)


def perp(theta_deg):
    a = math.radians(theta_deg)
    return math.cos(a), math.sin(a)


def angle_of(dx, dy):
    return math.degrees(math.atan2(dx, -dy))


def wrap(a):
    while a > 180:
        a -= 360
    while a < -180:
        a += 360
    return a


def two_bone_ik(S, W, l1=LU, l2=LF):
    """Elbow placed so the forearm folds to the left (negative elbow angle)."""
    dx, dy = W[0] - S[0], W[1] - S[1]
    d = math.hypot(dx, dy)
    d = max(abs(l1 - l2) + 1e-6, min(l1 + l2 - 1e-6, d))
    a = math.degrees(math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)))
    th_u = angle_of(dx, dy) + a
    ex, ey = dirv(th_u)
    E = (S[0] + l1 * ex, S[1] + l1 * ey)
    th_f = angle_of(W[0] - E[0], W[1] - E[1])
    return th_u, wrap(th_f - th_u)


# Pose the swing must land on: solved once, then FK-animated into it.
TH_U_PLANT, ELBOW_PLANT = two_bone_ik(S0, WRIST_PLANT)
TH_F_PLANT = TH_U_PLANT + ELBOW_PLANT
HAND_CONTACT = -90.0 + 16.0          # heel first, fingers still 16 deg up
HAND_FLAT = -90.0                    # pointing left, lying flat
WRIST_CONTACT = HAND_CONTACT - TH_F_PLANT
WRIST_FLAT = HAND_FLAT - TH_F_PLANT


# ── animation state ──────────────────────────────────────────────────
def arm_state(t):
    """Joint values for time t.  Returns a dict used by both draw + checks."""
    st = dict(squash=1.0, curl=0.0, spread=1.0, pron=0.0, plant=False)

    # Shoulder vertical offset: buried, pushing, punching up, overshoot+settle.
    tip_rest = S0[1] - LU - LF - PALM - 5.6       # fingertip height when upright
    d_hidden = GROUND + 4.5 - tip_rest            # fingertips just under the soil
    d_break = GROUND + 0.8 - tip_rest
    if t < T_PUSH:
        dy = d_hidden
    elif t < T_BREAK:
        dy = lerp(d_hidden, d_break, ease_in(seg(t, T_PUSH, T_BREAK), 2))
    elif t < T_UPRIGHT:
        # fast ease-out with a little overshoot past full height
        u = seg(t, T_BREAK, T_UPRIGHT)
        dy = d_break * (1 - back_out(u, 1.25))
    else:
        dy = 0.0

    th_u = 0.0
    elbow = 0.0
    wrist = 0.0

    # Beat at the top: a small tremor plus a finger flex (curl in, splay out).
    if T_UPRIGHT - 0.06 <= t < T_SWING:
        u = t - (T_UPRIGHT - 0.06)
        th_u += 1.7 * damped(u, 8.0, 5.0)
        wrist += 3.0 * damped(u + 0.03, 8.0, 5.0)
    if T_UPRIGHT <= t < T_ANTIC + 0.06:
        u = seg(t, T_UPRIGHT, T_ANTIC + 0.06)
        st["curl"] = -22.0 * math.sin(math.pi * u)
        st["spread"] = 1.0 + 0.25 * math.sin(math.pi * clamp01(u * 1.3 - 0.3))

    # Anticipation: lean back a touch to the right, hand gathers.
    if T_ANTIC <= t < T_SWING:
        u = ease_in_out(seg(t, T_ANTIC, T_SWING))
        th_u += 4.0 * u
        wrist += -8.0 * u
        st["curl"] += -8.0 * u

    # Swing: upper arm leans left, elbow folds (accelerating into the slam),
    # wrist extends ahead of time so the heel of the palm lands first.
    if T_SWING <= t < T_CONTACT:
        u = seg(t, T_SWING, T_CONTACT)
        # elbow stays up over the shoulder while the forearm sweeps past
        # horizontal, then the upper arm leans in as the palm drives down
        th_u = lerp(4.0, 2.5, smooth(u / 0.7)) if u < 0.7 else \
            lerp(2.5, TH_U_PLANT, smooth((u - 0.7) / 0.3))
        elbow = ELBOW_PLANT * ease_in(u, 2.2)
        if u < 0.72:  # hand trails roughly in line with the forearm
            wrist = lerp(-8.0, 12.0, smooth(u / 0.72))
        else:         # then the wrist cocks back so the heel lands first
            wrist = lerp(12.0, WRIST_CONTACT, smooth((u - 0.72) / 0.28))
        # fingers stay gathered through the arc, then open just before the slap
        st["curl"] = lerp(-8.0, -16.0, smooth(u / 0.5)) if u < 0.5 else lerp(-16.0, 6.0, smooth((u - 0.5) / 0.5))
        st["spread"] = lerp(1.0, 0.8, u)
        st["pron"] = smooth(u)

    S = (S0[0], S0[1] + dy)
    if t >= T_CONTACT:
        st["plant"] = True
        st["pron"] = 1.0
        st["spread"] = 0.8
        # Shoulder dips on impact (overshoot) then heaves during the hold.
        u = t - T_CONTACT
        sdy = 0.0
        if u > 0:
            sdy += 1.0 * math.sin(math.pi * clamp01(u / 0.16)) if u < 0.16 else 0.0
            if 0.16 <= u < 0.40:
                sdy += -0.3 * math.sin(math.pi * seg(u, 0.16, 0.40))
        hv = heave(t)
        sdy += -1.3 * hv
        S = (S0[0] + 0.25 * hv, S0[1] + sdy)
        th_u, elbow = two_bone_ik(S, WRIST_PLANT)
        th_f = th_u + elbow
        # Hand pivots on its heel from "fingers up" to flat, fingers bounce.
        v = seg(t, T_CONTACT, T_FLAT)
        hand = lerp(HAND_CONTACT, HAND_FLAT, ease_in(v, 2))
        wrist = hand - th_f
        f = t - T_FLAT
        if f < 0:
            st["curl"] = lerp(6.0, 0.0, v)
        else:
            st["curl"] = 9.0 * max(0.0, damped(f, 3.2, 9.0))   # lift only
        if 0 <= f < 0.20:
            st["squash"] = 1.0 - 0.24 * math.sin(math.pi * clamp01(f / 0.20))

    st.update(S=S, th_u=th_u, elbow=elbow, wrist=wrist)
    return st


def heave(t):
    """0..1 slow push during the hold (rises, then eases back a little)."""
    if t < T_HEAVE:
        return 0.0
    up = ease_in_out(seg(t, T_HEAVE, T_HEAVE + 0.45))
    down = ease_in_out(seg(t, T_HEAVE + 0.45, T_END_MOTION))
    return up * (1 - 0.45 * down)


def skeleton(st):
    """Forward kinematics -> list of joints / capsules for drawing + checks."""
    S = st["S"]
    th_u = st["th_u"]
    th_f = th_u + st["elbow"]
    th_h = th_f + st["wrist"]
    ux, uy = dirv(th_u)
    E = (S[0] + LU * ux, S[1] + LU * uy)
    fx, fy = dirv(th_f)
    W = (E[0] + LF * fx, E[1] + LF * fy)

    pron = st["pron"]
    sq = st["squash"]
    across = lerp(1.0, 0.6, pron) * sq        # palm seen edge-on when flat
    ax, ay = dirv(th_h)
    px, py = perp(th_h)

    caps = {"upper": [], "fore": [], "hand": []}
    caps["upper"].append((S, E, 4.6))
    fpx, fpy = perp(th_f)
    for o in (-1.25, 1.25):
        caps["fore"].append(((E[0] + fpx * o, E[1] + fpy * o),
                             (W[0] + fpx * o, W[1] + fpy * o), 2.35))

    # palm
    p0 = (W[0] + ax * 0.9, W[1] + ay * 0.9)
    p1 = (W[0] + ax * (PALM - 0.4), W[1] + ay * (PALM - 0.4))
    caps["hand"].append((p0, p1, 5.6 * across))
    parts = {"palm": [(p0, p1, 5.6 * across)], "fingers": [None] * 4}

    # fingers: two phalanges each, curl at the knuckle and the middle joint
    for i in range(4):
        off = FINGER_OFF[i] * across
        base = (W[0] + ax * PALM + px * off, W[1] + ay * PALM + py * off)
        spread = lerp(SPREAD_UP[i] * st["spread"], SPREAD_FLAT[i], pron)
        a1 = th_h + spread + st["curl"] * 0.6
        a2 = a1 + st["curl"] * 0.7
        l1 = FINGER_LEN[i] * 0.55
        l2 = FINGER_LEN[i] * 0.45
        d1 = dirv(a1)
        mid = (base[0] + d1[0] * l1, base[1] + d1[1] * l1)
        d2 = dirv(a2)
        tip = (mid[0] + d2[0] * l2, mid[1] + d2[1] * l2)
        w = 1.9 * lerp(1.0, 0.86, pron)
        caps["hand"].append((base, mid, w))
        caps["hand"].append((mid, tip, w * 0.92))
        parts["fingers"][i] = [(base, mid, w), (mid, tip, w * 0.92)]

    # thumb (on the side that ends up on top when the hand lies flat)
    tb = (W[0] + ax * 1.7 + px * 2.5 * across, W[1] + ay * 1.7 + py * 2.5 * across)
    ta = th_h + lerp(40.0, 14.0, pron) + st["curl"] * 0.3
    td = dirv(ta)
    caps["hand"].append((tb, (tb[0] + td[0] * THUMB_LEN, tb[1] + td[1] * THUMB_LEN), 2.0))
    parts["thumb"] = [caps["hand"][-1]]
    caps["hand_parts"] = parts

    return dict(S=S, E=E, W=W, th_u=th_u, th_f=th_f, th_h=th_h, caps=caps,
                across=across)


# ── ground, pile, debris ─────────────────────────────────────────────
def bulge_amount(t):
    return 4.2 * ease_in(seg(t, T_PUSH, T_BREAK), 1.6) if t < T_BREAK else 0.0


def pile_progress(t):
    if t < T_BREAK:
        return 0.0
    return 0.32 + 0.68 * back_out(seg(t, T_BREAK, T_BREAK + 0.38), 1.4)


def impact_slump(t):
    return ease_out(seg(t, T_CONTACT + 0.02, T_CONTACT + 0.30), 2)


def _bump(z):
    return 0.5 + 0.5 * math.cos(math.pi * z) if abs(z) < 1 else 0.0


def pile_height(x, t):
    p = pile_progress(t)
    if p <= 0:
        return 0.0
    sl = impact_slump(t)
    hv = heave(t)
    cL = PILE_X - (3.0 + 2.4 * p) - 0.9 * sl
    hL = 6.4 * p * (1 - 0.10 * sl)
    wL = 3.0 + 3.4 * p + 0.9 * sl
    cR = PILE_X + 3.2 + 2.8 * p
    hR = 7.2 * p + 0.6 * hv
    wR = 3.4 + 4.0 * p
    hC = 5.2 * p
    h = max(hL * _bump((x - cL) / wL), hR * _bump((x - cR) / wR),
            hC * _bump((x - PILE_X) / 3.4))
    if h > 0.25:  # lumpy, hand-made edge (deterministic)
        h += 0.28 * math.sin(x * 2.1 + 1.3) + 0.18 * math.sin(x * 4.7)
    return max(0.0, h)


def surface_y(x, t):
    """Top of the dirt at x (what loose things rest on)."""
    if t < T_BREAK:
        b = bulge_amount(t)
        return REST_Y - b * max(0.0, 1 - ((x - PILE_X) / 6.5) ** 2) ** 2
    return min(REST_Y, GROUND + 0.6 - pile_height(x, t))


CLUMPS = [  # (launch delay, vx, vy, radius)  units/s
    (0.00, -21.0, -80.0, 1.75),
    (0.02, -15.0, -98.0, 1.35),
    (0.01, 13.0, -104.0, 1.85),
    (0.03, 31.0, -82.0, 1.45),
    (0.05, 44.0, -62.0, 1.15),
    (0.04, -40.0, -56.0, 1.05),
]
GRAV = 400.0


def clump_positions(t):
    out = []
    for k, (delay, vx, vy, r) in enumerate(CLUMPS):
        t0 = T_BREAK + delay
        if t < t0:
            continue
        x0, y0 = PILE_X + (k - 2.5) * 0.7, 57.5
        # integrate until landing (closed form per step, deterministic)
        landed = None
        steps = 400
        dt = 1.6 / steps
        for s in range(1, steps + 1):
            tt = s * dt
            x = x0 + vx * tt
            y = y0 + vy * tt + 0.5 * GRAV * tt * tt
            if vy + GRAV * tt > 0 and y + r * 0.6 >= surface_y(x, t0 + tt):
                landed = (tt, x)
                break
        tau = t - t0
        spin = (vx * 9) * min(tau, landed[0] if landed else tau)
        if landed and tau >= landed[0]:
            x = landed[1]
            y = surface_y(x, t) - r * 0.6
            sq = 1 - 0.3 * math.sin(math.pi * clamp01((tau - landed[0]) / 0.1))
            out.append((x, y, r, sq, spin))
        else:
            x = x0 + vx * tau
            y = y0 + vy * tau + 0.5 * GRAV * tau * tau
            out.append((x, y, r, 1.0, spin))
    return out


def crumbs(t):
    """Two tiny crumbs that tumble off the pile when the palm lands."""
    out = []
    for k, (dx, vx, vy) in enumerate([(-6.5, -12.0, -16.0), (5.5, 10.0, -13.0)]):
        t0 = T_CONTACT + 0.04 + 0.03 * k
        if t < t0:
            continue
        x0 = PILE_X + dx
        y0 = surface_y(x0, t0) - 0.6
        tau = min(t - t0, 0.35)
        x = x0 + vx * tau
        y = min(y0 + vy * tau + 0.5 * GRAV * tau * tau, surface_y(x, t) - 0.6)
        out.append((x, y, 0.75))
    return out


# ── SVG output ───────────────────────────────────────────────────────
def f(v):
    return f"{v:.3f}".rstrip("0").rstrip(".")


def capsule_layers(caps):
    outline, fill = [], []
    for (a, b, w) in caps:
        d = f"M{f(a[0])} {f(a[1])}L{f(b[0])} {f(b[1])}"
        outline.append(f'<path d="{d}" stroke="{BONE_LINE}" stroke-width="{f(w + 2 * OUTLINE)}"/>')
        fill.append(f'<path d="{d}" stroke="{BONE}" stroke-width="{f(w)}"/>')
    return outline, fill


def bone_group(caps, extra_outline=(), extra_fill=()):
    o, fl = capsule_layers(caps)
    return ('<g fill="none" stroke-linecap="round">' + "".join(o) + "".join(extra_outline)
            + "".join(fl) + "".join(extra_fill) + "</g>")


def joint(c, r):
    return (f'<circle cx="{f(c[0])}" cy="{f(c[1])}" r="{f(r + OUTLINE)}" fill="{BONE_LINE}"/>',
            f'<circle cx="{f(c[0])}" cy="{f(c[1])}" r="{f(r)}" fill="{BONE}"/>')


def ground_svg(t):
    parts = []
    b = bulge_amount(t)
    if b > 0:
        pts = []
        x = 0.0
        while x <= 96.0:
            y = GROUND - b * max(0.0, 1 - ((x - PILE_X) / 6.5) ** 2) ** 2
            pts.append(f"{f(x)},{f(y)}")
            x += 0.5
        line = " ".join(pts)
        parts.append(f'<polygon points="0,72 {line} 96,72" fill="{SOIL}"/>')
        parts.append(f'<polyline points="{line}" fill="none" stroke="{GRASS}" stroke-width="2"/>')
        # strain cracks on the dome just before it bursts
        if b > 1.8:
            parts.append(f'<path d="M{f(PILE_X - 1.5)} {f(GROUND - b + 1.1)} l1.2 1.2 1 -1.3 1.1 1.1" '
                         f'stroke="{PILE_DARK}" stroke-width=".7" fill="none" stroke-linecap="round"/>')
    else:
        parts.append(f'<rect x="0" y="{f(GROUND)}" width="96" height="12" fill="{SOIL}"/>')
        parts.append(f'<path d="M0 {f(GROUND)}H96" stroke="{GRASS}" stroke-width="2"/>')
    parts.append(f'<path d="M4 60l1-4 1.5 4M28 60l1-3 1.2 3M88 60l1-4 1.5 4M80 60l.8-2.6 1 2.6" '
                 f'stroke="{GRASS}" stroke-width="1.2" fill="none" stroke-linejoin="round"/>')
    return "".join(parts)


def pile_svg(t, crossing_x):
    if t < T_BREAK:
        return ""
    xs = [PILE_X - 13 + i * 0.25 for i in range(int(26 / 0.25) + 1)]
    pts = []
    for x in xs:
        h = pile_height(x, t)
        pts.append((x, GROUND + 0.6 - h))
    poly = " ".join(f"{f(x)},{f(y)}" for x, y in pts)
    out = [f'<polygon points="{f(xs[0])},61.2 {poly} {f(xs[-1])},61.2" fill="{PILE}"/>']
    p = pile_progress(t)
    # highlights + torn grass riding on the pile
    sl = impact_slump(t)
    cl = PILE_X - (3.0 + 2.4 * p) - 0.9 * sl
    cr = PILE_X + 3.2 + 2.8 * p
    for (cx, dx, k) in [(cl, -1.6, 0), (cr, -1.2, 1)]:
        y = GROUND + 0.6 - pile_height(cx + dx, t)
        out.append(f'<path d="M{f(cx + dx - 1.2)} {f(y + 1.6)}q1.5 -1.7 3 -.6" stroke="{PILE_HI}" '
                   f'stroke-width=".9" fill="none" stroke-linecap="round"/>')
    for (gx, lean) in [(cl - 0.6, -1), (cr + 1.4, 1)]:
        y = GROUND + 0.6 - pile_height(gx, t)
        if y < 58.5:
            out.append(f'<path d="M{f(gx)} {f(y + .3)}l{f(lean * .6)} -1.6M{f(gx + .9)} {f(y + .4)}l{f(lean * .2)} -1.3" '
                       f'stroke="{GRASS}" stroke-width=".8" fill="none" stroke-linecap="round"/>')
    # dark lip where the bones go into the earth
    cy = GROUND + 0.6 - pile_height(crossing_x, t)
    out.append(f'<ellipse cx="{f(crossing_x)}" cy="{f(cy + 0.5)}" rx="3.3" ry="1.0" fill="{PILE_DARK}"/>')
    # crack opening on the right mound during the heave
    hv = heave(t)
    if hv > 0.02:
        x0 = cr + 0.3
        y0 = GROUND + 0.6 - pile_height(x0, t)
        L = 1.0
        d = (f"M{f(x0 - 1.4)} {f(y0 + 0.4)}l1.2 1 1 -.9 1.2 1.3")
        out.append(f'<path d="{d}" stroke="{PILE_DARK}" stroke-width=".75" fill="none" '
                   f'stroke-linecap="round" stroke-linejoin="round" pathLength="{L}" '
                   f'stroke-dasharray="{L}" stroke-dashoffset="{f(L * (1 - min(1, hv * 1.4)))}"/>')
    return "".join(out)


def debris_svg(t):
    out = []
    for (x, y, r, sq, spin) in clump_positions(t):
        out.append(f'<ellipse cx="{f(x)}" cy="{f(y + r * (1 - sq) * 0.5)}" rx="{f(r / max(sq, .6) ** .5)}" '
                   f'ry="{f(r * sq)}" fill="{CLUMP}" transform="rotate({f(spin % 360)} {f(x)} {f(y)})"/>')
    for (x, y, r) in crumbs(t):
        out.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r)}" fill="{CLUMP}"/>')
    return "".join(out)


def dust_svg(t):
    u0 = t - (T_CONTACT + 0.03)
    if u0 < 0 or u0 > 0.5:
        return ""
    out = []
    for (x, delay, rmax) in [(36.4, 0.0, 3.4), (33.4, 0.04, 2.6), (49.4, 0.01, 3.0), (52.4, 0.05, 2.4)]:
        u = seg(u0, delay, delay + 0.42)
        if u <= 0 or u >= 1:
            continue
        r = lerp(0.8, rmax, ease_out(u, 2))
        op = 0.9 * (1 - u) ** 1.2
        out.append(f'<circle cx="{f(x + (x - 43) * 0.25 * u)}" cy="{f(58.4 - 2.4 * u)}" r="{f(r)}" '
                   f'fill="{DUST}" opacity="{f(op)}"/>')
    return "".join(out)


def tombstone_svg(t):
    rot = 0.0
    u = t - (T_CONTACT + 0.04)
    if u > 0:
        rot = -2.0 * damped(u, 6.5, 7.0)
    return (f'<g transform="rotate({f(rot)} 22 62)">'
            f'<rect x="9" y="16" width="26" height="46" rx="13" fill="{STONE}" stroke="{STONE_LINE}" stroke-width="1.2"/>'
            f'<text x="22" y="38.2" text-anchor="middle" font-family="Georgia, \'DejaVu Serif\', serif" '
            f'font-weight="bold" font-size="9" fill="{STONE_TEXT}">RIP</text></g>')


def sky_svg():
    return (f'<rect width="96" height="72" fill="{BG}"/>'
            f'<circle cx="82" cy="11" r="6" fill="{MOON}"/><circle cx="85" cy="9" r="5.2" fill="{BG}"/>'
            f'<circle cx="14" cy="9" r="1" fill="{STAR}" opacity=".8"/>'
            f'<circle cx="46" cy="6" r="1.2" fill="{STAR}" opacity=".7"/>'
            f'<circle cx="68" cy="20" r=".9" fill="{STAR}" opacity=".6"/>')


def crossing_x(sk, t):
    """Where the upper arm passes through the soil surface (for the dark lip)."""
    S, E = sk["S"], sk["E"]
    target = GROUND - 2.5
    if abs(E[1] - S[1]) < 1e-6:
        return S[0]
    u = (target - S[1]) / (E[1] - S[1])
    return S[0] + (E[0] - S[0]) * clamp01(u)


def frame_svg(t, px_w=288, px_h=216):
    st = arm_state(t)
    sk = skeleton(st)
    caps = sk["caps"]

    elbow_o, elbow_f = joint(sk["E"], 3.0)
    wo, wf = joint(sk["W"], 2.25 * (0.8 + 0.2 * sk["across"]))

    upper = bone_group(caps["upper"])
    # back forearm bone, front forearm bone, then the elbow knob on top
    fore = (bone_group(caps["fore"][1:]) + bone_group(caps["fore"][:1])
            + "".join([elbow_o, elbow_f]))
    hp = caps["hand_parts"]
    # thumb + far fingers behind, palm, near fingers in front: each piece keeps
    # its own outline so the fingers read as separate bones.
    hand = (bone_group(hp["thumb"]) + wo + wf + bone_group(hp["palm"])
            + "".join(bone_group(hp["fingers"][i]) for i in (3, 2, 1, 0)))
    arm_front = t >= T_ANTIC   # once fully above ground, forearm/hand go in front of the pile

    layers = [sky_svg(), tombstone_svg(t), upper]
    if not arm_front:
        layers += [fore, hand]
    layers.append(ground_svg(t))
    layers.append(pile_svg(t, crossing_x(sk, t)))
    layers.append(debris_svg(t))
    layers.append(dust_svg(t))
    if arm_front:
        layers += [fore, hand]
    body = "".join(layers)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 72" width="{px_w}" height="{px_h}" '
            f'shape-rendering="geometricPrecision">{body}</svg>')


def frame_times():
    n = int(round(DURATION * FPS))
    return [i / FPS for i in range(n + 1)]


# ── self-checks used by render.py ────────────────────────────────────
def check_frame(t):
    """Returns (upper_len, fore_len, worst ground penetration of hand/forearm)."""
    st = arm_state(t)
    sk = skeleton(st)
    lu = math.dist(sk["S"], sk["E"])
    lf = math.dist(sk["E"], sk["W"])
    worst = -99.0
    if t >= T_ANTIC:
        for (a, b, w) in sk["caps"]["hand"] + sk["caps"]["fore"]:
            for k in range(11):
                x = lerp(a[0], b[0], k / 10)
                y = lerp(a[1], b[1], k / 10) + w / 2 + OUTLINE
                worst = max(worst, y - max(surface_y(x, t), REST_Y))
    return lu, lf, worst
