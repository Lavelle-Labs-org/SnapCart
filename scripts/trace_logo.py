import matplotlib.pyplot as plt
from PIL import Image
import numpy as np
from scipy import ndimage
import os

src_path = r'C:\Users\Student4\.gemini\antigravity-ide\brain\0a9bb0ab-bc79-4947-9754-70eb877a27c4\.user_uploaded\media_1793087720958.jpg'
img = Image.open(src_path).convert('RGB')
arr = np.array(img, dtype=float)
icon = arr[115:305, 370:690]
bg_color = np.array([236., 239., 242.])
dist_bg = np.sqrt(np.sum((icon - bg_color)**2, axis=2))
greenness = icon[:, :, 1] - 0.5 * (icon[:, :, 0] + icon[:, :, 2])
is_green = (greenness > 15) & (dist_bg > 30)
is_wheel = (greenness < 15) & (dist_bg > 35) & (np.arange(190)[:, None] > 120)

# Smooth masks
sm_green = ndimage.gaussian_filter(is_green.astype(float), sigma=0.8)
sm_wheel = ndimage.gaussian_filter(is_wheel.astype(float), sigma=0.8)

def ramer_douglas_peucker(points, epsilon):
    if len(points) < 3:
        return points
    dmax = 0.0
    index = 0
    start = points[0]
    end = points[-1]
    
    # Distance from line between start and end
    line_vec = end - start
    line_len = np.hypot(line_vec[0], line_vec[1])
    if line_len == 0:
        dists = np.hypot(points[:, 0] - start[0], points[:, 1] - start[1])
    else:
        # Cross product distance
        dists = np.abs(line_vec[0] * (start[1] - points[:, 1]) - (start[0] - points[:, 0]) * line_vec[1]) / line_len
    
    index = np.argmax(dists)
    dmax = dists[index]
    
    if dmax > epsilon:
        rec1 = ramer_douglas_peucker(points[:index+1], epsilon)
        rec2 = ramer_douglas_peucker(points[index:], epsilon)
        return np.vstack([rec1[:-1], rec2])
    else:
        return np.vstack([start, end])

def path_to_svg_d(contour_set, epsilon=0.7):
    paths = contour_set.get_paths()
    d_list = []
    for p in paths:
        verts = p.vertices
        codes = p.codes
        moveto_indices = np.where(codes == 1)[0]
        sub_paths = np.split(np.arange(len(codes)), moveto_indices[1:])
        for sub in sub_paths:
            sub_v = verts[sub]
            if len(sub_v) < 3:
                continue
            simplified = ramer_douglas_peucker(sub_v, epsilon)
            if not np.allclose(simplified[-1], simplified[0]):
                simplified = np.vstack([simplified, simplified[0]])
            cmds = [f'M {simplified[0,0]:.1f} {simplified[0,1]:.1f}']
            for pt in simplified[1:]:
                cmds.append(f'L {pt[0]:.1f} {pt[1]:.1f}')
            cmds.append('Z')
            d_list.append(' '.join(cmds))
    return ' '.join(d_list)

fig, ax = plt.subplots()
cs_g = ax.contourf(sm_green, levels=[0.5, 1.5])
cs_w = ax.contourf(sm_wheel, levels=[0.5, 1.5])

d_green = path_to_svg_d(cs_g, epsilon=0.6)
d_wheels = path_to_svg_d(cs_w, epsilon=0.4)
plt.close(fig)

print(f"Green SVG path: {len(d_green)} chars")
print(f"Wheels SVG path: {len(d_wheels)} chars")

# 1. Clean standalone SVG icon (with dark-mode media query embedded!)
svg_icon_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 190" fill="none">
  <style>
    .cart-body {{ fill: #00976f; }}
    .cart-wheels {{ fill: #18262f; }}
    @media (prefers-color-scheme: dark) {{
      .cart-body {{ fill: #10b981; }}
      .cart-wheels {{ fill: #f8fafc; }}
    }}
  </style>
  <path d="{d_green}" class="cart-body" fill-rule="evenodd" />
  <path d="{d_wheels}" class="cart-wheels" fill-rule="evenodd" />
</svg>'''

os.makedirs('apps/web/public', exist_ok=True)
with open('apps/web/public/snapcart-icon.svg', 'w', encoding='utf-8') as f:
    f.write(svg_icon_content)

# 2. Modern SVG favicon for browser tabs!
with open('apps/web/public/favicon.svg', 'w', encoding='utf-8') as f:
    f.write(svg_icon_content)

# 3. Export SVG path data for direct React inline SVG component
with open('apps/web/src/components/snapcart-svg-paths.ts', 'w', encoding='utf-8') as f:
    f.write(f'''// Automatically generated high-precision vector paths traced from master logo artwork
export const SNAPCART_BODY_PATH = "{d_green}";
export const SNAPCART_WHEELS_PATH = "{d_wheels}";
''')

print("Generated snapcart-icon.svg, favicon.svg, and snapcart-svg-paths.ts successfully!")
