import type { MapData, Prop } from '../types/map'
import { contextoDeCamadas } from '../lib/camadas/consulta'
import { FAIXAS_EDITOR } from '../lib/camadas/ordem'
import { MODELO_PADRAO } from '../lib/camadas/padrao'
import { contornoDaCercaCurva } from '../lib/cercaCurva'
import { ehMovelDeCimaDaMesa, ehMovelDoChao } from '../lib/mobilia'
import { pointInPolygonInclusive } from '../lib/roomNesting'
import { rotatePointAround, rotationTrig } from '../lib/roomRotation'
import { criarParesDoEditor } from './paresDoEditor'
import { distribuir, planejarPilha, type NoDaFaixa } from './pilhaDeCamadas'

/** A faixa dos objetos na pilha do editor (`FAIXAS_EDITOR`, `PixiCanvas`). */
const FAIXA_DOS_OBJETOS = 'propsContainer'

/** Os pares (faixa, camada) do mapa, os mesmos que a pilha do editor recebe (memorizados pelas listas). */
const paresDoMapa = criarParesDoEditor()

/**
 * O objeto sob o ponto, o de cima NA TELA primeiro. `mapa` (o do clique):
 * a ordem é a da pilha do editor (achado E12, caça 12/11/2026) — os nós da
 * faixa dos objetos de cima para baixo e, dentro do nó, a camada de cima
 * primeiro (Decoração por cima de Objetos), com a MESMA divisão que o desenho
 * usa (`planejarPilha` + `distribuir`). Sem `mapa`, a lista é a pilha. Dentro
 * de cada nó, o último da lista está por cima, e o TAPETE fica no chão, por
 * baixo de todo objeto (`emOrdemDeDesenho`): o clique procura primeiro no
 * resto e só depois nos tapetes — a cadeira em cima do tapete é a cadeira.
 */
export function findPropAt(props: Prop[], point: { x: number; y: number }, mapa?: MapData): Prop | null {
  const sobOPonto = props.filter((prop) => propContainsPoint(prop, point))
  // Um ou nenhum: não há ordem a decidir (o caso comum; a pilha nem é planejada).
  if (sobOPonto.length < 2) return sobOPonto[0] ?? null
  const nos = mapa === undefined ? [sobOPonto] : objetosPorNoDaPilha(mapa, sobOPonto)
  for (let i = nos.length - 1; i >= 0; i -= 1) {
    const doNo = topmostInNode(nos[i])
    if (doNo !== null) return doNo
  }
  return null
}

/**
 * Os objetos divididos pelos nós da faixa deles, de baixo para cima, como a
 * pilha do editor os desenha (`PixiCanvas.redrawProps`): o mesmo plano
 * (`planejarPilha` com a lista do mestre, as opacidades e os pares do mapa) e a
 * mesma divisão e ordem dentro do nó (`distribuir`). Estável: a ordem relativa
 * da entrada se mantém dentro da mesma camada.
 */
function objetosPorNoDaPilha(mapa: MapData, objetos: Prop[]): Prop[][] {
  const camadas = contextoDeCamadas(mapa)
  const plano = planejarPilha(FAIXAS_EDITOR, { modelo: mapa.modeloCamadas ?? MODELO_PADRAO, alfa: camadas.alfa, pares: paresDoMapa(mapa) })
  const nos: NoDaFaixa<number>[] = plano
    .filter((no) => no.faixa === FAIXA_DOS_OBJETOS)
    .map((no, indice) => ({ no: indice, camadas: no.camadas, base: no.base }))
  // A faixa sempre tem o nó de hoje no plano; sem ele (não deveria acontecer), a lista é a pilha.
  if (nos.length === 0) return [objetos]
  return distribuir(objetos, nos, (prop: Prop) => camadas.camadaDe('objeto', prop)).map((balde) => balde.itens)
}

/**
 * O de cima dentro de um nó, entre os que já estão sob o ponto. O tapete longo
 * (MT5) também mora no chão (`ehMovelDoChao`). A mesa posta (os Pratos) é
 * desenhada por cima da mesa: o clique pega ela primeiro (`ehMovelDeCimaDaMesa`).
 */
function topmostInNode(sobOPonto: readonly Prop[]): Prop | null {
  return (
    lastAccepted(sobOPonto, (prop) => ehMovelDeCimaDaMesa(prop.mobilia)) ??
    lastAccepted(sobOPonto, (prop) => !ehMovelDoChao(prop.mobilia)) ??
    lastAccepted(sobOPonto, (prop) => ehMovelDoChao(prop.mobilia))
  )
}

function lastAccepted(props: readonly Prop[], accepts: (prop: Prop) => boolean): Prop | null {
  for (let i = props.length - 1; i >= 0; i -= 1) {
    if (accepts(props[i])) return props[i]
  }
  return null
}

function propContainsPoint(prop: Prop, point: { x: number; y: number }): boolean {
  // CERCA CURVA: o clique pega a faixa dobrada no arco, não o retângulo reto (`lib/cercaCurva.ts`).
  const curva = contornoDaCercaCurva(prop)
  if (curva !== null) return pointInPolygonInclusive(point, curva)
  // OBJETO GIRADO: o ponto volta para o referencial do objeto (o giro ao contrário em volta do
  // centro, onde a tela gira a imagem). Sem isso a sebe, o arco ou o tapete longo girados 90° só
  // respondiam onde a caixa SEM giro cruzava o desenho. Sem giro, o ponto fica como está.
  const local = prop.rotation ? rotatePointAround(point, prop, rotationTrig(-prop.rotation)) : point
  const halfWidth = prop.width / 2
  const halfHeight = prop.height / 2
  const withinX = local.x >= prop.x - halfWidth && local.x <= prop.x + halfWidth
  const withinY = local.y >= prop.y - halfHeight && local.y <= prop.y + halfHeight
  return withinX && withinY
}
