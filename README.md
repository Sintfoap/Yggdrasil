# 3D Static Site — Cloudflare Pages Boilerplate

A minimal, production-ready 3D website using **Three.js r128**, styled with a dark editorial aesthetic, ready to deploy to **Cloudflare Pages** via Git.

## Project Structure

```
/
├── index.html    # Main page + HTML structure
├── style.css     # Styles (dark theme, typography, layout)
├── scene.js      # Three.js 3D scene (particles, icosahedron, torus, cubes)
└── README.md
```

No build step required — it's plain HTML/CSS/JS. Three.js is loaded from a CDN.

---

## Deploy to Cloudflare Pages

### 1. Push to GitHub / GitLab

```bash
git init
git add .
git commit -m "initial 3d site"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### 2. Connect to Cloudflare Pages

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **Pages** → **Create a project**
2. Connect your GitHub or GitLab account and select this repo
3. Configure the build:

| Setting              | Value              |
|----------------------|--------------------|
| Framework preset     | **None**           |
| Build command        | *(leave empty)*    |
| Build output dir     | `/` *(or leave as `.`)* |

4. Click **Save and Deploy** ✓

Cloudflare Pages will detect the `index.html` and serve it at your `.pages.dev` URL automatically. You can then add a custom domain in the Pages dashboard.

---

## Customisation

### Scene (`scene.js`)
- **Colors**: Change `0xc8f542` (lime) and `0x42f5c8` (teal) to your brand palette
- **Geometry**: Swap `IcosahedronGeometry`, `TorusGeometry`, or `BoxGeometry` for any Three.js primitive
- **Particle count**: Adjust `PARTICLE_COUNT` (default 600)
- **Camera speed**: Tweak the parallax multipliers near `camera.position.x = target.x * 4`

### Styles (`style.css`)
- All colours are CSS variables at the top of the file under `:root`
- Fonts are loaded from Google Fonts — swap the `@import` URL to change them

### Content (`index.html`)
- Edit the hero title, nav links, section copy, and card content freely
- The page structure is: Nav → Hero → About → Work → Contact → Footer

---

## Tech

- [Three.js r128](https://threejs.org/) via CDN (no build tools)
- Plain CSS with custom properties
- Google Fonts (Playfair Display + DM Mono)
- Zero npm dependencies
