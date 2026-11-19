import { CAM, color, item, zone } from '../define'
import type { Category, ColorTarget, MaterialPreset, MockupItem, PrintZone } from '../types'

type Placement = { zone: PrintZone; at: string }

const front = (aspect: number, at: string, scale = 0.8): Placement => ({ zone: zone('front', { aspect, transform: { scale } }), at })
const back = (aspect: number, at: string, optional = true): Placement => ({ zone: zone('back', { aspect, optional, transform: { scale: 0.85 } }), at: `b:${at}` })
const leftChest = (at: string, optional = true): Placement => ({ zone: zone('leftChest', { label: 'Left chest', aspect: 1, optional, transform: { scale: 0.9 } }), at })
const leg = (aspect: number, at: string): Placement => ({ zone: zone('leg', { aspect, transform: { scale: 0.8 } }), at })

function garment(
  id: string,
  name: string,
  category: Category,
  kind: string,
  placements: Placement[],
  colors: ColorTarget[],
  opts: { material?: MaterialPreset; tags?: string[]; puff?: number } = {},
): MockupItem {
  const params: Record<string, string | number> = { kind }
  if (opts.puff) params.puff = opts.puff
  for (const p of placements) params[`z_${p.zone.id}`] = p.at
  const hasBack = placements.some((p) => p.zone.id === 'back')
  return item({
    id,
    name,
    category,
    tags: opts.tags,
    builder: 'garment',
    params,
    zones: placements.map((p) => p.zone),
    colors,
    material: opts.material ?? 'fabric',
    thumb: placements[0].zone.id === 'back' ? { ...CAM.back, elevation: 4 } : { ...CAM.front, elevation: 4 },
    views: hasBack ? [CAM.front, CAM.hero, CAM.back] : [CAM.front, CAM.hero, CAM.heroRight],
  })
}

const WHITE = '#f4f4f1'
const BLACK = '#1c1c1f'

export const TOPS: MockupItem[] = [
  garment('crew-tee', 'Crew Neck T-Shirt', 'tops', 'tee', [front(0.85, '0,0.84,0.5'), back(0.8, '0,0.86,0.58'), leftChest('0.19,1.06,0.15')], [color('body', WHITE, 'Shirt')], { tags: ['tshirt', 'tee', 'shirt'] }),
  garment('vneck-tee', 'V-Neck T-Shirt', 'tops', 'vneck', [front(0.85, '0,0.8,0.46'), back(0.8, '0,0.86,0.58')], [color('body', '#2f3a4f', 'Shirt')], { tags: ['tshirt', 'tee'] }),
  garment('long-sleeve-tee', 'Long Sleeve T-Shirt', 'tops', 'longsleeve', [front(0.85, '0,0.84,0.5'), back(0.8, '0,0.86,0.58'), leftChest('0.19,1.06,0.15')], [color('body', BLACK, 'Shirt')], { tags: ['tshirt', 'longsleeve'] }),
  garment('tank-top', 'Tank Top', 'tops', 'tank', [front(0.8, '0,0.72,0.45'), back(0.8, '0,0.8,0.5')], [color('body', WHITE, 'Tank')], { tags: ['tank', 'sleeveless'] }),
  garment('ringer-tee', 'Ringer T-Shirt', 'tops', 'ringer', [front(0.85, '0,0.84,0.48')], [color('body', WHITE, 'Shirt'), color('trim', '#c0392b', 'Ringer trim')], { tags: ['tshirt', 'retro'] }),
  garment('fitted-tee', "Women's Fitted Tee", 'tops', 'fitted', [front(0.8, '0,0.84,0.44'), back(0.8, '0,0.86,0.5')], [color('body', '#e8d9cf', 'Shirt')], { tags: ['tshirt', 'womens'] }),
  garment('crop-top', 'Crop Top', 'tops', 'crop', [front(1.1, '0,0.5,0.36')], [color('body', '#f0c7c2', 'Top')], { tags: ['crop', 'womens'] }),
  garment('kids-tee', 'Kids T-Shirt', 'tops', 'kids', [front(0.85, '0,0.63,0.36')], [color('body', '#f7d84a', 'Shirt')], { tags: ['youth', 'tshirt'] }),
  garment('baby-onesie', 'Baby Onesie', 'tops', 'onesie', [front(0.9, '0,0.56,0.34')], [color('body', WHITE, 'Onesie')], { tags: ['baby', 'bodysuit'], puff: 0.06 }),
  garment('polo', 'Polo Shirt', 'tops', 'polo', [leftChest('0.2,1.0,0.15', false), back(0.8, '0,0.86,0.55')], [color('body', '#1f3b63', 'Shirt')], { tags: ['polo', 'golf', 'uniform'] }),
  garment('sports-jersey', 'Sports Jersey', 'tops', 'jersey', [front(0.9, '0,0.78,0.48'), back(0.8, '0,0.84,0.62', false)], [color('body', '#d13b3b', 'Jersey'), color('trim', WHITE, 'Trim')], { tags: ['jersey', 'team', 'sports'] }),
]

export const FLEECE: MockupItem[] = [
  garment('crewneck-sweatshirt', 'Crewneck Sweatshirt', 'fleece', 'crewneck', [front(0.95, '0,0.82,0.46'), back(0.8, '0,0.84,0.58'), leftChest('0.2,1.04,0.15')], [color('body', '#9ea3a8', 'Sweatshirt')], { tags: ['sweatshirt', 'crewneck'] }),
  garment('pullover-hoodie', 'Pullover Hoodie', 'fleece', 'hoodie', [front(1.0, '0,0.56,0.3'), back(0.8, '0,0.7,0.46')], [color('body', BLACK, 'Hoodie'), color('trim', '#e9e9e9', 'Drawstrings')], { tags: ['hoodie', 'sweatshirt'] }),
  garment('zip-hoodie', 'Zip Hoodie', 'fleece', 'zipHoodie', [leftChest('0.2,1.02,0.16', false), back(0.8, '0,0.86,0.6', false)], [color('body', '#3d4b3f', 'Hoodie')], { tags: ['hoodie', 'zip', 'full zip'] }),
  garment('quarter-zip', 'Quarter Zip Pullover', 'fleece', 'quarterZip', [leftChest('0.21,1.0,0.15', false), back(0.8, '0,0.84,0.55')], [color('body', '#20283a', 'Pullover')], { tags: ['quarter zip', 'pullover'] }),
  garment('bomber-jacket', 'Bomber Jacket', 'fleece', 'bomber', [back(0.85, '0,0.7,0.56', false), leftChest('0.22,0.9,0.15')], [color('body', '#3b4232', 'Jacket'), color('trim', '#1c1c1f', 'Rib trim')], { tags: ['jacket', 'bomber', 'outerwear'] }),
  garment('denim-jacket', 'Denim Jacket', 'fleece', 'denim', [back(0.85, '0,0.72,0.55', false)], [color('body', '#4a6a93', 'Denim')], { tags: ['jacket', 'denim', 'jean'], material: 'canvas' }),
  garment('joggers', 'Joggers', 'fleece', 'joggers', [leg(0.7, '0.2,0.55,0.24')], [color('body', '#5b5f66', 'Joggers'), color('trim', WHITE, 'Drawstring')], { tags: ['sweatpants', 'pants'] }),
  garment('shorts', 'Shorts', 'fleece', 'shorts', [leg(0.9, '0.22,0.84,0.16')], [color('body', BLACK, 'Shorts')], { tags: ['shorts', 'athletic'] }),
  garment('leggings', 'Leggings', 'fleece', 'leggings', [leg(0.6, '0.17,0.55,0.26')], [color('body', '#26262b', 'Leggings')], { tags: ['leggings', 'yoga'], puff: 0.05 }),
  garment('socks', 'Crew Socks', 'fleece', 'socks', [{ zone: zone('leg', { aspect: 0.75, transform: { scale: 0.8 } }), at: '0,0.66,0.4' }], [color('body', WHITE, 'Socks')], { tags: ['socks'], material: 'knit', puff: 0.045 }),
  garment('apron', 'Apron', 'fleece', 'apron', [front(0.95, '0,0.6,0.42')], [color('body', '#2b2b2e', 'Apron'), color('strap', '#2b2b2e', 'Straps')], { tags: ['apron', 'kitchen', 'barista'], material: 'canvas' }),
]
