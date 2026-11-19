export type Category =
  | 'tops'
  | 'fleece'
  | 'headwear'
  | 'patches'
  | 'drinkware'
  | 'stickers'
  | 'print'
  | 'music'
  | 'bags'
  | 'home'
  | 'packaging'
  | 'screens'

export const CATEGORY_LABELS: Record<Category, string> = {
  tops: 'Tops',
  fleece: 'Fleece & Outerwear',
  headwear: 'Headwear',
  patches: 'Patches & Pins',
  drinkware: 'Drinkware',
  stickers: 'Stickers',
  print: 'Print & Wall',
  music: 'Music',
  bags: 'Bags & Accessories',
  home: 'Home',
  packaging: 'Packaging',
  screens: 'Screens',
}

export type MaterialPreset =
  | 'fabric'
  | 'knit'
  | 'mesh'
  | 'canvas'
  | 'ceramic'
  | 'enamel'
  | 'metal'
  | 'brushedMetal'
  | 'gold'
  | 'glass'
  | 'paper'
  | 'glossyPaper'
  | 'acrylic'
  | 'embroidery'
  | 'vinyl'
  | 'holographic'
  | 'plastic'
  | 'rubber'
  | 'screen'
  | 'wood'

/** Normalized to the print zone: x/y are offsets of the design center as a fraction of zone width/height (y up), scale 1 = design fits the zone, rotation in degrees. */
export type Transform = { x: number; y: number; scale: number; rotation: number }

export const IDENTITY_TRANSFORM: Transform = { x: 0, y: 0, scale: 0.8, rotation: 0 }

export type ZoneEffect = 'print' | 'embroidery' | 'engrave' | 'screen' | 'woven' | 'emboss'

export type ZoneLayout = { kind: 'single' } | { kind: 'grid'; cols: number; rows: number; gap: number }

export type PrintZone = {
  id: string
  label: string
  /** Mesh that receives the composed canvas. Procedural builders name these `zone:<id>`; GLB models must use the same name. */
  meshName: string
  /** Region of the mesh UV space covered by the zone. Procedural zones use the whole [0,1] range. */
  uvRect: [u0: number, v0: number, u1: number, v1: number]
  /** Physical width / height of the zone. Sets the composed canvas proportions. */
  aspect: number
  wrap: 'flat' | 'cylindrical' | 'uv'
  defaultTransform: Transform
  clip?: 'rect' | 'roundRect' | 'circle'
  effect?: ZoneEffect
  layout?: ZoneLayout
  /** Optional zones (e.g. back prints) start disabled. */
  optional?: boolean
}

export type ColorTarget = {
  id: string
  label: string
  /** Meshes tinted by this target. Procedural builders name these `color:<id>`. */
  meshNames: string[]
  default: string
}

export type CameraPose = {
  id: string
  label: string
  /** Degrees around the Y axis; 0 looks at the front (+Z). */
  azimuth: number
  /** Degrees above the horizon. */
  elevation: number
  /** Extra framing room; 1 fits the bounding sphere exactly. */
  padding?: number
}

export type BuilderParams = Record<string, number | string | boolean>

export type ItemGeometry =
  | { kind: 'procedural'; builder: BuilderId; params: BuilderParams }
  | { kind: 'glb'; url: string; scale?: number }

export type MockupItem = {
  id: string
  name: string
  category: Category
  tags: string[]
  geometry: ItemGeometry
  printZones: PrintZone[]
  colorTargets: ColorTarget[]
  material: MaterialPreset
  cameras: { thumb: CameraPose; views: CameraPose[] }
  /** Geometry depends on the composed design (die-cut shapes), so it rebuilds when the design moves. */
  designDrivenGeometry?: boolean
}

export type BuilderId =
  | 'drinkware'
  | 'bottle'
  | 'flat'
  | 'disc'
  | 'dome'
  | 'box'
  | 'dieCut'
  | 'garment'
  | 'cap'
  | 'beanie'
  | 'bucketHat'
  | 'visor'
  | 'patch'
  | 'tote'
  | 'backpack'
  | 'pillow'
  | 'drape'
  | 'frame'
  | 'card'
  | 'vinyl'
  | 'cassette'
  | 'device'
  | 'band'
  | 'skateboard'
  | 'pouch'
  | 'shoppingBag'
  | 'calendar'
  | 'notebook'
  | 'yardSign'
