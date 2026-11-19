import type * as THREE from 'three'
import type { BuilderId, BuilderParams } from '@/catalog/types'
import type { BuildContext } from '@/render/types'
import { buildDieCut, buildPatch } from './dieCut'
import { buildBottle, buildDrinkware } from './drinkware'
import { buildCalendar, buildCard, buildDisc, buildDome, buildFlat, buildFrame, buildYardSign } from './flat'
import { buildGarment } from './garment'
import { buildBeanie, buildBucketHat, buildCap, buildVisor } from './headwear'
import {
  buildBackpack,
  buildBand,
  buildBox,
  buildCassette,
  buildDevice,
  buildDrape,
  buildNotebook,
  buildPillow,
  buildPouch,
  buildShoppingBag,
  buildSkateboard,
  buildTote,
  buildVinyl,
} from './objects'

export type Builder = (params: BuilderParams, ctx: BuildContext) => THREE.Object3D

export const BUILDERS: Record<BuilderId, Builder> = {
  drinkware: buildDrinkware,
  bottle: buildBottle,
  flat: buildFlat,
  disc: buildDisc,
  dome: buildDome,
  box: buildBox,
  dieCut: buildDieCut,
  garment: buildGarment,
  cap: buildCap,
  beanie: buildBeanie,
  bucketHat: buildBucketHat,
  visor: buildVisor,
  patch: buildPatch,
  tote: buildTote,
  backpack: buildBackpack,
  pillow: buildPillow,
  drape: buildDrape,
  frame: buildFrame,
  card: buildCard,
  vinyl: buildVinyl,
  cassette: buildCassette,
  device: buildDevice,
  band: buildBand,
  skateboard: buildSkateboard,
  pouch: buildPouch,
  shoppingBag: buildShoppingBag,
  calendar: buildCalendar,
  notebook: buildNotebook,
  yardSign: buildYardSign,
}
