# Country discovery data

Country names and ISO code reference: mledoze/countries, https://github.com/mledoze/countries,
under the Open Database License 1.0 (see country-registry-LICENSE.txt).
The derived name/code registry and its associations in countries-10m.v5.1.2.json
and country-photos.v2.json are made available under ODbL 1.0. This applies to
the databases; application code and each photograph retain their own licenses.
The full editable derived databases are provided in those JSON files.

Geometry: Natural Earth v5.1.2 1:10m admin-0 map units, public domain.
https://www.naturalearthdata.com/about/terms-of-use/
See countries-NOTICE.txt for the upstream source hash, normalization and grouping.

Country identity and photo associations: Wikidata structured data, CC0.
Each photograph is linked to an exact country/territory identity, or an individually
reviewed Commons description. ISO codes are validated against Wikidata P297.
Non-ISO areas use stable WD-Q identifiers, never another area's ISO code.

Photographs: Wikimedia Commons, with file title, author, license URL, original
source URL, geographic evidence and transformation notice in country-photos.v2.json.
Local WebP copies use reviewed subject-focused crops at 432 × 270, without
enlarging the source crop. This supports the maximum 240px card at 1.8× pixel
density. The card keeps a 1.6:1 photo frame with object-fit: cover. Adaptations retain
the original linked license. Country-specific alternatives are tried only within
the same country entry. Cached local copies work without live provider requests.
Per-photo credits are also available from Image and map credits in the site footer.

Rebuild using scripts/prepare-worldwide-discovery.mjs and the upstream files named
there. It caches source responses, checks country identities and reuse licenses,
and writes every unresolved code into the manifest rather than borrowing a photo.
Individually reviewed fallback choices are in scripts/discovery-photo-overrides.json.

Apply the destination-photo editorial review with
`node --experimental-strip-types scripts/curate-worldwide-discovery.mjs`.
Review the candidate manifest and contact sheets generated with
`node scripts/review-discovery-photo-crops.mjs` (and `--fallback`). Then run
the curation command with `--publish` to atomically replace the live catalog.
The complete per-country plan, preferences, exclusions and crop focal points are in
scripts/discovery-photo-curation.json. Every country and geographic area has a plan.
Landmarks are checked against Wikidata country, administrative-area or coordinate
claims; individually reviewed Commons descriptions and photographer coordinates
provide source-specific evidence. No random stock-image or other-country fallback
is used. Maps, flags, historical artwork, unsupported rights and inadequate source
resolution are rejected. Publication is blocked if existing coverage would decrease.
Source dimensions, crop rectangles, focal points and individual licenses remain
available in the public photo catalog and the existing footer credits.
