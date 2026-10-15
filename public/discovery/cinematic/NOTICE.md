# Cinematic discovery scenery

Created 2026-10-10 using the OpenAI image-generation tool for TravelMate, with the user's generated reference used as composition guidance only. This is **AI-generated decorative scenery**, not a verified photograph of a destination. No external source photograph, third-party logo, website UI, or embedded globe was used. Destination/venue photo integrations remain separate.

## Usage terms and provenance

Use is subject to the applicable [OpenAI output terms](https://openai.com/policies/terms-of-use/) (effective January 1, 2026). Those terms assign OpenAI's rights in output to the user to the extent permitted by law. This is not a claim of a Creative Commons license, public-domain status, or exclusive copyright. There is no third-party photographer attribution for this generated scenery. Existing actual destination-photo attribution is unchanged.

Original generated PNG: `audit/2026-10-10/globe-cinematic/scenery-source.png` (project root). Original generation filename: `exec-3805b517-595e-49f0-a961-11054bda21e5.png`.
The production files are optimized derivatives; the PNG is not shipped in public assets.

| Asset | Dimensions | Bytes | Processing |
| --- | --- | ---: | --- |
| tropical-sunset-desktop.webp | 1600 × 900 | 223692 | Cover resize, WebP quality 83 |
| tropical-sunset-tablet.webp | 960 × 1000 | 117844 | Right-focused crop, WebP quality 81 |
| tropical-sunset-mobile.webp | 640 × 960 | 82092 | Right-focused crop, WebP quality 80 |

Regenerate derivatives with the existing Sharp installation:
`node scripts/prepare-cinematic-background.mjs ../audit/2026-10-10/globe-cinematic/scenery-source.png`

## Exact generation prompt

Use case: photorealistic-natural. Asset type: scenery-only wide background illustration for the TravelMate travel discovery section. Create a premium cinematic realistic tropical bay at golden sunset, landscape 16:9 composition, preferably 2048x1152 or wider. Layered forest-covered steep limestone karst islands and mountains recede into pale atmospheric sea mist. Deep emerald green wooded foreground islands at lower left and lower right frame a calm deep teal ocean in the central lower half. Distant soft mountains and islands near the horizon. Golden setting sun around horizontal 68% and vertical 30%, with natural warm sunlight reflections on the ocean. Realistic textured clouds across the upper third, darker dark teal sky on the upper left, warm golden horizon on the right. Rich natural tropical foliage, photographic quality, cinematic depth, soft natural haze, realistic water. The middle area remains spacious ocean and distant landscape for a separate interactive globe rendered by the website; darker left third for readable white website copy. This is an atmospheric decorative illustration inspired by a generated reference, not a claimed photograph of any specific geographic destination. Scenery only. Absolutely no globe, no planet, no text, no typography, no logos, no website elements, no cards, no buttons, no maps, no people, no UI. Avoid cartoon forms, painted brush strokes, harsh artificial glow and over-saturated orange. Keep the sunset soft and realistic, foreground rich dark emerald, water deep teal, subtle warm gold light.


## Separate animated atmospheric layers — 2026-10-10

The cloud and mist layers are new AI-generated decorative assets produced with the built-in image-generation tool, with genuine alpha transparency. No external photograph or screenshot was used as an image input. They contain atmosphere only; no landscape or embedded interface. Applicable output usage terms are the same as documented above; no Creative Commons or public-domain license is claimed. Existing scenery files remain unchanged.

Original PNGs are retained outside public at `audit/2026-10-10/globe-animation-fix/clouds-source.png` and `mist-source.png`.

Derivatives are `clouds-layer-v1.webp`, `mist-layer-v1.webp`, `clouds-layer-mobile-v1.webp`, and `mist-layer-mobile-v1.webp`. The existing Sharp installation crops transparent vertical margins and encodes to WebP while preserving alpha; it does not composite these textures into the scenery. The CSS independently animates each texture.

Reproduce encoding: `node scripts/prepare-atmosphere-layers.mjs ../audit/2026-10-10/globe-animation-fix`.

### Exact cloud generation prompt

Use case: photorealistic-natural. Asset type: standalone transparent cloud texture layer for CSS animation over an existing cinematic tropical sunset landscape. Primary request: a wide horizontal band of several realistic wispy stratocumulus cloud formations with organic fine texture, isolated on genuine transparent alpha. Composition: landscape 16:9 canvas; cloud formations spread across the central horizontal band, generous completely transparent margins on all sides, clouds fade softly to transparency at their edges. Some uneven disconnected wisps and open transparent gaps between formations; not one solid opaque rectangle. Lighting: soft warm cream and muted pale gold rim light with cool sage-gray shadow detail, sunset atmosphere. Moderate subtle texture that will remain recognizable at low CSS opacity. Natural photographic volumetric cloud detail, not cartoon, not radial-gradient blobs, not smoke explosion. Clouds only. No sky, no landscape, no mountain, no island, no ocean, no globe, no UI, no words, no logos, no checkerboard baked into the image. Genuine transparent background; preserve semi-transparent fine wisps. This is decorative generated atmosphere, not a verified destination photograph.

### Exact mist generation prompt

Use case: photorealistic-natural. Asset type: standalone transparent sea mist texture layer for gentle horizontal CSS animation over existing tropical islands. Primary request: several thin low horizontal ribbons of delicate natural atmospheric fog, pale cool sage-white, semi-transparent wisps with irregular soft tendrils, isolated on genuine transparent alpha. Wide landscape 16:9 canvas, bands extend across the central lower horizontal third, generous fully transparent top and bottom margins. Airy broken patches, fine subtle irregular drifting texture, soft natural edges fading into transparency. Low-lying ocean valley mist, viewed from above and far away, not billowing smoke, not cloud towers, not solid white wall. No scene or islands baked into asset. Slight muted warm cream highlights consistent with golden sunset, predominantly cool neutral gray-green mist. Photographic natural atmospheric quality. No ground, sky, ocean, mountains, scenery, planet, globe, UI, text, logos, checkerboard or backdrop. True transparent background and semi-transparent wispy edges. Generated decorative layer only, not a real destination photograph.
