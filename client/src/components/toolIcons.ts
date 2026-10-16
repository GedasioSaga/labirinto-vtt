import type { ComponentType } from 'react'
import type { DrawingTool } from '../types/tools'
import {
  BrushIcon,
  CircleIcon,
  ConcealZoneIcon,
  CurveIcon,
  CursorIcon,
  DoorIcon,
  EllipseIcon,
  EraserIcon,
  FloorIcon,
  LightIcon,
  LineIcon,
  MeasureIcon,
  ObjetosIcon,
  PathIcon,
  PenhascoIcon,
  TexturasIcon,
  CarimbosIcon,
  PinIcon,
  PolygonIcon,
  PropIcon,
  RectIcon,
  RegionIcon,
  RegularPolygonIcon,
  RevealBrushIcon,
  RoomCircleIcon,
  RoomFreeIcon,
  RoomIcon,
  StairIcon,
  TextIcon,
  TokenIcon,
  WallIcon,
} from './icons'

/**
 * O ícone de cada ferramenta, o mesmo desenho na barra (Toolbar), nas opções
 * do cantinho de variantes e na medalha da ficha da ferramenta (página Ficha
 * do livro do mestre): quem arma a Sala Circular vê o mesmo círculo nos três.
 *
 * Partial, não Record<DrawingTool, ...>: assim uma futura extensão de
 * DrawingTool não força entrada aqui antes do ícone existir.
 */
export const TOOL_ICONS: Partial<Record<DrawingTool, ComponentType<{ size?: number }>>> = {
  select: CursorIcon,
  wall: WallIcon,
  door: DoorIcon,
  light: LightIcon,
  region: RegionIcon,
  room: RoomIcon,
  roomCircle: RoomCircleIcon,
  roomPolygon: RegularPolygonIcon,
  roomFree: RoomFreeIcon,
  floor: FloorIcon,
  path: PathIcon,
  stair: StairIcon,
  token: TokenIcon,
  prop: PropIcon,
  brush: BrushIcon,
  line: LineIcon,
  circle: CircleIcon,
  ellipse: EllipseIcon,
  rect: RectIcon,
  polygon: PolygonIcon,
  curve: CurveIcon,
  text: TextIcon,
  measure: MeasureIcon,
  eraser: EraserIcon,
  concealZone: ConcealZoneIcon,
  revealBrush: RevealBrushIcon,
  penhasco: PenhascoIcon,
  texturas: TexturasIcon,
  carimbos: CarimbosIcon,
  pin: PinIcon,
  mobilia: ObjetosIcon,
}
