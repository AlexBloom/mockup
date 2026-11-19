# Mockup

Upload a logo, SVG or image once and see it on 111 3D product mockups at the same time: apparel, headwear, patches, drinkware, stickers, print, music packaging, bags, home goods, packaging and device screens. Open any mockup to move, scale and rotate the design on the 3D surface, change product and background colors by hex code, and download a transparent PNG.

Everything runs in the browser. There is no backend and no account; your design and edits are saved to IndexedDB on your device.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Type-check and build to `dist/` |
| `npm test` | Unit tests (Vitest) |
| `npm run test:visual` | Visual regression snapshots of every mockup (Playwright) |
| `npm run lint` | Oxlint |

The first `npm run test:visual` run needs `npx playwright install chromium` and writes baseline snapshots; later runs compare against them. Use `npx playwright test --update-snapshots` after an intentional visual change.

## How rendering works

Rendering is a pure function of `(item, design, transform, colors, background, camera)`. Nothing is random at runtime: procedural textures use a seeded PRNG, lights and environment are fixed, and the camera is framed from the object's bounding box. The same inputs always produce the same PNG on the same GPU and browser.

- **Print zones.** Each item has one or more print zones. The design is drawn into a 2D canvas per zone using the zone's transform (`x`/`y` as fractions of the zone, `scale` 1 = fit inside, `rotation` in degrees), then applied as a texture to a mesh that follows the product surface: a cylinder segment for mugs, a sphere segment for cap fronts, a displaced grid for cloth. That is what keeps the 3D wrap when you move or resize the design.
- **Effects.** Zones can be `print`, `embroidery`, `woven`, `emboss`, `engrave` or `screen`. Relief effects posterize the design and generate a normal map from it.
- **Die-cut shapes.** Stickers, magnets, acrylic keychains, enamel pins and die-cut patches trace the design's alpha outline (marching squares plus a border offset) and extrude that shape.
- **One WebGL context.** Grid thumbnails and exports share a single offscreen renderer and a queue that prioritizes visible cards, so mobile browsers never hit their WebGL context limit. The detail view uses its own live canvas.

Main folders:

- `src/catalog/`: item definitions (`items/*.ts`), types, camera presets
- `src/geometry/`: procedural builders, one per product family
- `src/render/`: zone composer, materials, renderer, thumbnail queue, PNG and zip export, GLB loader
- `src/features/`: upload, grid, detail view, test harness
- `src/state/`: Zustand store, override cascade (item, then global, then default), IndexedDB persistence

## Swapping in GLB models

Every item currently uses procedural geometry, so the app works with no model files. You can replace any item with a GLB without touching the renderer.

1. Put the file in `public/models/`, for example `public/models/hoodie.glb`. Meshopt-compressed geometry and KTX2 textures are supported.
2. In the item's definition in `src/catalog/items/`, add `glb: { url: \`${import.meta.env.BASE_URL}models/hoodie.glb\`, scale: 1 }`. The `builder` and `params` stay as a fallback reference but are no longer used.
3. Name the meshes in the GLB to match the item:
   - **Print zones:** a mesh named `zone:<zoneId>` (for example `zone:front`) receives the design. Its UVs should cover the printable area. If the zone only uses part of the mesh's UV space, set `uvRect: [u0, v0, u1, v1]` on the zone, in glTF UV convention (v runs top to bottom). The zone mesh should sit slightly in front of the garment surface or share its geometry.
   - **Color targets:** meshes named `color:<targetId>` (for example `color:body`) are tinted by that color input. To use other mesh names, pass them as the fourth argument to `color()`, for example `color('body', '#1c1c1f', 'Hoodie', ['Body', 'Sleeves'])`.
   - Other meshes keep their own materials.
4. Add the model's source, author and license to `public/models/CREDITS.md`. Only use CC0 or similarly permissive models unless you have a license for the asset.

Camera framing, colors, transforms, export and thumbnails all work the same for GLB items.
