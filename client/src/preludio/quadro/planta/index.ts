/**
 * Formas de planta (mapa de masmorra) copiadas do Grimório, para o quadro do Prelúdio
 * conseguir abrir as fotos do tldraw que contêm plantas.
 *
 * O tldraw só carrega a foto se todo tipo de forma gravado nela estiver registrado com o
 * MESMO esquema (props + migrações) que gravou. Por isso cada ShapeUtil daqui mantém
 * `type`, `props`, `getDefaultProps` e `migrations` idênticos aos do Grimório.
 * O CSS do tldraw (`tldraw/tldraw.css`) fica a cargo de quem monta o editor.
 */
import type { TLAnyShapeUtilConstructor } from 'tldraw'
import { CorredorMapaShapeUtil } from './CorredorMapaShape'
import { EscadaMapaShapeUtil } from './EscadaMapaShape'
import { ItemMapaShapeUtil } from './ItemMapaShape'
import { LinhaMapaShapeUtil } from './LinhaMapaShape'
import { MuralhaMapaShapeUtil } from './MuralhaMapaShape'
import { PortaShapeUtil } from './PortaShape'
import { RetanguloMapaShapeUtil } from './RetanguloMapaShape'
import { SalaMapaShapeUtil } from './SalaMapaShape'
import { SalaPoligonoMapaShapeUtil } from './SalaPoligonoMapaShape'
import { SimboloMapaShapeUtil } from './SimboloMapaShape'
import { TorreMapaShapeUtil } from './TorreMapaShape'

export const UTILS_DA_PLANTA: TLAnyShapeUtilConstructor[] = [
  PortaShapeUtil,
  SimboloMapaShapeUtil,
  SalaMapaShapeUtil,
  LinhaMapaShapeUtil,
  ItemMapaShapeUtil,
  RetanguloMapaShapeUtil,
  EscadaMapaShapeUtil,
  CorredorMapaShapeUtil,
  TorreMapaShapeUtil,
  SalaPoligonoMapaShapeUtil,
  MuralhaMapaShapeUtil,
]

export { definirResolvedoresDaPlanta, type ResolvedoresDaPlanta } from './resolvedores'
