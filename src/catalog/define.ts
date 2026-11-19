import type {
  BuilderId,
  BuilderParams,
  CameraPose,
  Category,
  ColorTarget,
  MaterialPreset,
  MockupItem,
  PrintZone,
  Transform,
} from './types'
import { IDENTITY_TRANSFORM } from './types'

export const CAM = {
  front: { id: 'front', label: 'Front', azimuth: 0, elevation: 6 },
  hero: { id: 'hero', label: '3/4', azimuth: -28, elevation: 14 },
  soft: { id: 'soft', label: 'Angled', azimuth: -18, elevation: 8 },
  vessel: { id: 'vessel', label: 'Front', azimuth: 0, elevation: 10 },
  vesselLeft: { id: 'vesselLeft', label: 'Left', azimuth: -50, elevation: 10 },
  overhead: { id: 'overhead', label: 'Overhead', azimuth: -10, elevation: 48 },
  heroRight: { id: 'heroRight', label: '3/4 R', azimuth: 28, elevation: 14 },
  side: { id: 'side', label: 'Side', azimuth: -90, elevation: 6 },
  back: { id: 'back', label: 'Back', azimuth: 180, elevation: 6 },
  top: { id: 'top', label: 'Top', azimuth: 0, elevation: 62 },
  low: { id: 'low', label: 'Low', azimuth: -20, elevation: -12 },
  under: { id: 'under', label: 'Bottom', azimuth: 0, elevation: -70 },
} satisfies Record<string, CameraPose>

type ZoneInput = Partial<Omit<PrintZone, 'id' | 'defaultTransform'>> & {
  aspect: number
  transform?: Partial<Transform>
}

export function zone(id: string, input: ZoneInput): PrintZone {
  const { transform, ...rest } = input
  return {
    id,
    label: rest.label ?? labelFromId(id),
    meshName: rest.meshName ?? `zone:${id}`,
    uvRect: rest.uvRect ?? [0, 0, 1, 1],
    wrap: rest.wrap ?? 'flat',
    defaultTransform: { ...IDENTITY_TRANSFORM, ...transform },
    ...rest,
  }
}

export function color(id: string, value: string, label?: string, meshNames?: string[]): ColorTarget {
  return { id, label: label ?? labelFromId(id), meshNames: meshNames ?? [`color:${id}`], default: value }
}

type ItemInput = {
  id: string
  name: string
  category: Category
  tags?: string[]
  builder: BuilderId
  params?: BuilderParams
  /** Replaces the procedural builder with a GLB whose mesh names match the zones' `meshName` and colors' `meshNames`. */
  glb?: { url: string; scale?: number }
  zones: PrintZone[]
  colors: ColorTarget[]
  material: MaterialPreset
  thumb?: CameraPose
  views?: CameraPose[]
  designDrivenGeometry?: boolean
}

export function item(input: ItemInput): MockupItem {
  const thumb = input.thumb ?? CAM.hero
  const views = input.views ?? [CAM.front, CAM.hero, CAM.side]
  return {
    id: input.id,
    name: input.name,
    category: input.category,
    tags: input.tags ?? [],
    geometry: input.glb ? { kind: 'glb', ...input.glb } : { kind: 'procedural', builder: input.builder, params: input.params ?? {} },
    printZones: input.zones,
    colorTargets: input.colors,
    material: input.material,
    cameras: { thumb, views: views.some((v) => v.id === thumb.id) ? views : [thumb, ...views] },
    designDrivenGeometry: input.designDrivenGeometry,
  }
}

function labelFromId(id: string) {
  return id.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())
}
