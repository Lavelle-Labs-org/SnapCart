import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.path import Path
from PIL import Image
import numpy as np
import os
import re

# Read SVG paths from components/snapcart-svg-paths.ts
with open('apps/web/src/components/snapcart-svg-paths.ts', 'r', encoding='utf-8') as f:
    content = f.read()

body_match = re.search(r'SNAPCART_BODY_PATH = "(.*?)";', content)
wheels_match = re.search(r'SNAPCART_WHEELS_PATH = "(.*?)";', content)

body_d = body_match.group(1)
wheels_d = wheels_match.group(1)

def parse_svg_path(d):
    tokens = d.split()
    verts = []
    codes = []
    i = 0
    while i < len(tokens):
        cmd = tokens[i]
        if cmd == 'M':
            verts.append([float(tokens[i+1]), float(tokens[i+2])])
            codes.append(Path.MOVETO)
            i += 3
        elif cmd == 'L':
            verts.append([float(tokens[i+1]), float(tokens[i+2])])
            codes.append(Path.LINETO)
            i += 3
        elif cmd == 'Z':
            verts.append([0, 0])
            codes.append(Path.CLOSEPOLY)
            i += 1
        else:
            i += 1
    return Path(verts, codes)

body_path = parse_svg_path(body_d)
wheels_path = parse_svg_path(wheels_d)

def render_vector_icon(size=256, dark=False):
    # Render with matplotlib offscreen at high DPI
    fig = plt.figure(figsize=(size/100, size/100), dpi=100)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(-10, 330)
    ax.set_ylim(200, -10) # invert y for SVG coordinate space
    ax.axis('off')
    fig.patch.set_alpha(0.0)
    ax.patch.set_alpha(0.0)
    
    green_color = '#10b981' if dark else '#00976f'
    wheels_color = '#f8fafc' if dark else '#18262f'
    
    patch_b = patches.PathPatch(body_path, facecolor=green_color, edgecolor='none')
    patch_w = patches.PathPatch(wheels_path, facecolor=wheels_color, edgecolor='none')
    ax.add_patch(patch_b)
    ax.add_patch(patch_w)
    
    fig.canvas.draw()
    rgba = np.array(fig.canvas.buffer_rgba())
    plt.close(fig)
    return Image.fromarray(rgba)

# Render crisp vector-based icons
icon_light = render_vector_icon(320, dark=False)
icon_dark = render_vector_icon(320, dark=True)

# Save transparent PNGs
icon_light.save('apps/web/public/snapcart-icon.png')
icon_dark.save('apps/web/public/snapcart-icon-dark.png')

# Favicon: render at 64x64, 48x48, 32x32, 16x16
fav_128 = render_vector_icon(128, dark=True) # dark wheels pop on all tab backgrounds!
fav_64 = fav_128.resize((64, 64), Image.Resampling.LANCZOS)
fav_48 = fav_128.resize((48, 48), Image.Resampling.LANCZOS)
fav_32 = fav_128.resize((32, 32), Image.Resampling.LANCZOS)
fav_16 = fav_128.resize((16, 16), Image.Resampling.LANCZOS)

fav_32.save('apps/web/public/favicon.png')
fav_128.save('apps/web/public/favicon.ico', format='ICO', sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
fav_128.save('apps/web/src/app/favicon.ico', format='ICO', sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])

# Copy SVG icon to app/icon.svg for Next.js automatic SVG favicon handling
svg_path = 'apps/web/public/snapcart-icon.svg'
with open(svg_path, 'r', encoding='utf-8') as f:
    svg_data = f.read()

with open('apps/web/src/app/icon.svg', 'w', encoding='utf-8') as f:
    f.write(svg_data)

print("Vector rendering complete: snapcart-icon.png, snapcart-icon-dark.png, favicon.ico, favicon.png, and icon.svg!")
