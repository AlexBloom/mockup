import { CAM, color, item, zone } from '../define'
import type { ColorTarget, MaterialPreset, MockupItem } from '../types'

const views = [CAM.vessel, CAM.vesselLeft, CAM.hero, CAM.top]
const wrap = (aspect: number, scale = 0.7) => zone('wrap', { label: 'Wrap', aspect, wrap: 'cylindrical', transform: { scale } })

function vessel(id: string, name: string, kind: string, aspect: number, colors: ColorTarget[], material: MaterialPreset, tags: string[], extra: Record<string, number | string | boolean> = {}): MockupItem {
  return item({ id, name, category: 'drinkware', tags, builder: 'drinkware', params: { kind, ...extra }, zones: [wrap(aspect)], colors, material, thumb: CAM.vessel, views })
}

function bottle(id: string, name: string, kind: string, aspect: number, colors: ColorTarget[], material: MaterialPreset, tags: string[]): MockupItem {
  return item({ id, name, category: 'drinkware', tags, builder: 'bottle', params: { kind }, zones: [wrap(aspect, 0.65)], colors, material, thumb: CAM.vessel, views })
}

export const DRINKWARE: MockupItem[] = [
  vessel('mug-11oz', 'Ceramic Mug 11oz', 'mug', 1.6, [color('body', '#f7f7f5', 'Mug'), color('interior', '#f7f7f5', 'Inside'), color('handle', '#f7f7f5', 'Handle')], 'ceramic', ['mug', 'coffee', 'cup']),
  vessel('mug-15oz', 'Ceramic Mug 15oz', 'mug15', 1.55, [color('body', '#1c1c1f', 'Mug'), color('interior', '#c0392b', 'Inside'), color('handle', '#1c1c1f', 'Handle')], 'ceramic', ['mug', 'coffee', 'large']),
  vessel('camp-mug', 'Enamel Camp Mug', 'campMug', 2.1, [color('body', '#f4f4f1', 'Mug'), color('interior', '#f4f4f1', 'Inside'), color('rim', '#1f2a44', 'Rim'), color('handle', '#f4f4f1', 'Handle')], 'enamel', ['camping', 'enamel', 'mug']),
  vessel('travel-mug', 'Travel Mug', 'travelMug', 0.85, [color('body', '#2b2b2e', 'Body'), color('lid', '#1c1c1f', 'Lid'), color('handle', '#2b2b2e', 'Handle')], 'brushedMetal', ['travel', 'insulated', 'thermos']),
  vessel('tumbler', 'Tumbler with Straw', 'tumbler', 0.85, [color('body', '#e8c5c8', 'Tumbler'), color('lid', '#e8c5c8', 'Lid')], 'plastic', ['tumbler', 'stanley', 'insulated']),
  vessel('glass-can', 'Glass Can Cup', 'glassCan', 1.0, [color('body', '#ffffff', 'Glass')], 'glass', ['libbey', 'beer can glass', 'iced coffee']),
  vessel('pint-glass', 'Pint Glass', 'pint', 0.95, [color('body', '#ffffff', 'Glass'), color('interior', '#ffffff', 'Inside')], 'glass', ['beer', 'pint', 'glass']),
  vessel('shot-glass', 'Shot Glass', 'shot', 2.2, [color('body', '#ffffff', 'Glass')], 'glass', ['shot', 'glass'], { zoneHeight: 0.24, zoneY: 0.26 }),
  bottle('water-bottle', 'Stainless Water Bottle', 'water', 0.63, [color('body', '#3a6b8c', 'Bottle'), color('cap', '#1c1c1f', 'Cap')], 'plastic', ['bottle', 'hydro flask', 'insulated']),
  bottle('sports-bottle', 'Sports Squeeze Bottle', 'sports', 0.75, [color('body', '#f4f4f1', 'Bottle'), color('cap', '#2a7de1', 'Cap')], 'plastic', ['bottle', 'gym', 'squeeze']),
  vessel('can-cooler', 'Can Cooler', 'canCooler', 1.4, [color('body', '#1c1c1f', 'Sleeve')], 'fabric', ['koozie', 'coozie', 'neoprene']),
]
