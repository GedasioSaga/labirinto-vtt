import { useMapStore } from './mapStore'
import { avisarCamadaOculta, avisarCamadaTravada } from '../lib/avisoCamadaTravada'
import { compileFloor } from '../lib/floorSdf'
import { isLayerLocked, isLayerVisible } from '../lib/layers'
import { criarMovel } from '../lib/mobilia'
import { TOCHA_DE_PAREDE } from '../lib/mobilia/fogoDeCasa'
import { cenaTemChao } from '../lib/offFloor'
import { mapaDoPiso } from '../lib/pisos'
import { findContainingRoom, pointInPolygonInclusive } from '../lib/roomNesting'
import { normalizeRotation, roomRotationOf, withoutRotationNoise } from '../lib/roomRotation'
import { EMPTY_SELECTION, selectionSingle } from '../lib/selectionModel'
import type { LayerId, MapData, Prop, TipoMobilia, Wall } from '../types/map'
import { lembrarObjetoUsado } from './objetosUsados'

/** `criarMovel` não grava `layer`, e objeto sem `layer` mora em Objetos (`propLayer`). */
const CAMADA_DO_MOVEL: LayerId = 'objetos'

/** O que o clique da ferramenta Objetos fez — o móvel posto ou por que não pôs. */
export type ResultadoDoMovel = { kind: 'posto'; id: string } | { kind: 'camada-travada' } | { kind: 'camada-oculta' }

/**
 * MOBÍLIA NA BARRA — o clique da ferramenta Objetos no mapa (`PixiCanvas`).
 * O móvel do tipo escolhido na setinha nasce centrado em `ponto` (já com o
 * encaixe da Peça aplicado por quem chama). Dentro de uma Sala girada ele
 * deita no giro dela; fora de sala, ou em sala nunca girada, nasce sem giro,
 * igual a objeto comum. A ferramenta segue na mão para pôr o próximo. Um passo
 * só no desfazer (`addProp`).
 *
 * Pôr NÃO seleciona (pedido de 12/11/2026): o painel fica em "Colocar", com a
 * busca e a rolagem da lista, para pôr vários em seguida. Quem abre a ficha do
 * objeto é o clique nele (o hit-test do `PixiCanvas`). A seleção de antes
 * (objeto, pino ou zona) é largada, senão a ficha dela seguiria no painel.
 *
 * Só as Salas do piso em edição doam giro: a de outro piso não está na tela.
 *
 * Tocha de parede posta perto de uma parede já nasce presa nela, virada para
 * ela (`encostarTochaNaParede`), no mesmo passo do desfazer.
 *
 * Camada Objetos travada ou oculta não recebe móvel: travada, o item nasceria
 * fora do alcance do Selecionar; oculta, nasceria invisível e o clique
 * pareceria não ter pegado. Em vez disso, o aviso da camada, com o botão que a
 * libera ali mesmo.
 */
export function porMovelNoPonto(
  tipo: TipoMobilia,
  ponto: { x: number; y: number },
  novoId: () => string = () => crypto.randomUUID(),
): ResultadoDoMovel {
  const store = useMapStore.getState()
  const { map, pisoAtivo } = store
  if (isLayerLocked(map.lockedLayers, CAMADA_DO_MOVEL)) {
    avisarCamadaTravada(CAMADA_DO_MOVEL)
    return { kind: 'camada-travada' }
  }
  if (!isLayerVisible(map.hiddenLayers, CAMADA_DO_MOVEL)) {
    avisarCamadaOculta(CAMADA_DO_MOVEL)
    return { kind: 'camada-oculta' }
  }
  const movel = criarMovel(tipo, ponto, map.grid, novoId())
  const doPiso = mapaDoPiso(map, pisoAtivo)
  const sala = findContainingRoom(doPiso.regions, [ponto])
  // Fora de qualquer sala `sala` é null: o `?.` é o caso "sem giro", não um remendo.
  const giro = roomRotationOf(sala?.room)
  const posto = giro === 0 ? movel : { ...movel, rotation: giro }
  store.addProp(encostarTochaNaParede(posto, doPiso) ?? posto)
  store.setSelection(EMPTY_SELECTION)
  store.setSelectedPin(null)
  store.setSelectedConcealZone(null)
  // "Usados há pouco" da ficha da ferramenta: conta o móvel posto, não a escolha.
  lembrarObjetoUsado(tipo)
  return { kind: 'posto', id: movel.id }
}

/*
 * TOCHA DE PAREDE SE PRENDE NA PAREDE (caça de 12/11/2026, item V5 b, decisão
 * 27 do mestre). Nas cenas dele as tochas ficavam com o centro em cima da linha
 * da parede e as da parede de baixo sem giro: o corpo sumia debaixo da parede e
 * só a chama aparecia. A ferramenta não ajudava. Agora, ao SOLTAR a tocha (pôr
 * nova ou acabar de arrastar) a menos de meia casa de uma parede, a beira de
 * cima da pegada (onde o desenho põe a chapa, `moveis/tochaDeParede.ts`) encosta
 * na parede e a tocha gira para ela.
 *
 * Giro: graus no sentido horário; com giro 0 a beira de cima aponta para y
 * negativo e, girada de `g`, para (sen g, −cos g) (`rotatePointAround` de
 * `lib/roomRotation.ts`, o mesmo que `propCorners` usa). O centro é `x, y`
 * (`criarMovel`, `propBoundingBox`).
 */

/** Só este móvel se prende na parede: os outros ficam onde o mestre os solta. */
const TIPO_QUE_SE_PRENDE: TipoMobilia = 'tochaDeParede'

/**
 * Centro a menos disto (px) da linha da parede está EM CIMA dela, sem lado.
 * É o caso comum, não a exceção: com a grade ligada o centro do objeto cai no
 * vértice, e a parede da Sala passa pelos vértices.
 */
const EM_CIMA_DA_LINHA = 0.5

interface Vetor {
  x: number
  y: number
}

/** A parede mais perto do centro da tocha e o ponto dela mais perto do centro. */
interface ParedePerto {
  parede: Wall
  pe: Vetor
  distancia: number
}

/**
 * A parede (do piso já recortado) mais perto de `centro` em que a chapa cabe
 * INTEIRA. Porta e janela ficam de fora: a tocha não vai na folha que abre. O
 * pé anda no trecho só até a chapa (meia largura `meiaChapa`) tocar a ponta:
 * solta em cima de uma porta ou de um vão, a tocha vai para a parede sólida ao
 * lado com a chapa toda nela, nunca com metade sobre o vão (caça 12/11, prova
 * P27 caso 10). Trecho mais curto que a chapa não prende.
 */
function paredeMaisPerto(centro: Vetor, paredes: readonly Wall[], meiaChapa: number): ParedePerto | null {
  let melhor: ParedePerto | null = null
  for (const parede of paredes) {
    if (parede.door !== null) continue
    const dx = parede.x2 - parede.x1
    const dy = parede.y2 - parede.y1
    const comprimento2 = dx * dx + dy * dy
    if (comprimento2 === 0) continue
    const comprimento = Math.sqrt(comprimento2)
    if (comprimento < 2 * meiaChapa) continue
    // O pé fica DENTRO do trecho e a chapa também: perto da ponta, a tocha vai até onde a chapa cabe.
    const margem = meiaChapa / comprimento
    const t = Math.min(1 - margem, Math.max(margem, ((centro.x - parede.x1) * dx + (centro.y - parede.y1) * dy) / comprimento2))
    const pe = { x: parede.x1 + t * dx, y: parede.y1 + t * dy }
    const distancia = Math.hypot(centro.x - pe.x, centro.y - pe.y)
    if (melhor === null || distancia < melhor.distancia) melhor = { parede, pe, distancia }
  }
  return melhor
}

/**
 * Perguntas que dizem de que lado da parede a tocha fica quando o centro está
 * em cima da linha, da mais forte para a mais fraca: dentro da sala dona da
 * parede, dentro de alguma Sala, em cima do Chão. A primeira que separa os
 * dois lados decide.
 */
function perguntasDeDentro(parede: Wall, mapa: Pick<MapData, 'regions' | 'floor'>): ((ponto: Vetor) => boolean)[] {
  const perguntas: ((ponto: Vetor) => boolean)[] = []
  const dona = parede.regionId === undefined ? undefined : mapa.regions.find((r) => r.id === parede.regionId)
  if (dona !== undefined && dona.points.length >= 3) perguntas.push((ponto) => pointInPolygonInclusive(ponto, dona.points))
  perguntas.push((ponto) => findContainingRoom(mapa.regions, [ponto]) !== null)
  // O Chão aqui é pintura (onde se anda), não limite: vale também na cena "Fora do Chão: livre".
  if (cenaTemChao(mapa)) {
    const chao = compileFloor(mapa.floor)
    perguntas.push((ponto) => chao.sample(ponto.x, ponto.y) < 0)
  }
  return perguntas
}

/**
 * Para onde a beira de cima da tocha aponta: o vetor unitário perpendicular à
 * parede, do centro da tocha PARA a parede. Centro em cima da linha: o lado de
 * dentro (`perguntasDeDentro`) e, sem resposta, o lado para onde a tocha já
 * apontava.
 */
function sentidoParaAParede(prop: Prop, perto: ParedePerto, mapa: Pick<MapData, 'regions' | 'floor'>): Vetor {
  const { parede, pe } = perto
  const comprimento = Math.hypot(parede.x2 - parede.x1, parede.y2 - parede.y1)
  const normal = { x: -(parede.y2 - parede.y1) / comprimento, y: (parede.x2 - parede.x1) / comprimento }
  const oposta = { x: -normal.x, y: -normal.y }
  const lado = (prop.x - pe.x) * normal.x + (prop.y - pe.y) * normal.y
  if (lado > EM_CIMA_DA_LINHA) return oposta
  if (lado < -EM_CIMA_DA_LINHA) return normal
  const meia = prop.height / 2
  // O centro que a tocha teria apontando para `normal` (fica do lado de `oposta`) e o do outro jeito.
  const comNormal = { x: pe.x - normal.x * meia, y: pe.y - normal.y * meia }
  const comOposta = { x: pe.x + normal.x * meia, y: pe.y + normal.y * meia }
  for (const dentro of perguntasDeDentro(parede, mapa)) {
    const aquiDentro = dentro(comNormal)
    if (aquiDentro !== dentro(comOposta)) return aquiDentro ? normal : oposta
  }
  const giro = ((prop.rotation ?? 0) * Math.PI) / 180
  const cima = { x: Math.sin(giro), y: -Math.cos(giro) }
  return cima.x * normal.x + cima.y * normal.y >= 0 ? normal : oposta
}

/**
 * A tocha de parede `prop` presa na parede mais perto, se alguma está a menos
 * de meia casa do centro dela: a beira de cima da pegada encostada na linha da
 * parede e o giro com a cabeça para ela. `null` = nada a fazer (não é tocha de
 * parede, não há parede perto, ou ela já está presa). `mapa` é o piso em edição
 * (`mapaDoPiso`): parede de outro piso não está na tela. Giro 0 sai sem o
 * campo, como o objeto que nasce sem giro.
 */
export function encostarTochaNaParede(prop: Prop, mapa: Pick<MapData, 'walls' | 'regions' | 'floor' | 'grid'>): Prop | null {
  if (prop.mobilia !== TIPO_QUE_SE_PRENDE) return null
  const meiaChapa = (TOCHA_DE_PAREDE.meiaLarguraDaChapa * Math.min(prop.width, prop.height)) / 2
  const perto = paredeMaisPerto(prop, mapa.walls, meiaChapa)
  if (perto === null || perto.distancia >= mapa.grid / 2) return null
  const sentido = sentidoParaAParede(prop, perto, mapa)
  const giro = normalizeRotation((Math.atan2(sentido.x, -sentido.y) * 180) / Math.PI)
  const meia = prop.height / 2
  const x = withoutRotationNoise(perto.pe.x - sentido.x * meia)
  const y = withoutRotationNoise(perto.pe.y - sentido.y * meia)
  if (x === prop.x && y === prop.y && giro === normalizeRotation(prop.rotation ?? 0)) return null
  const { rotation: _giroDeAntes, ...semGiro } = prop
  return giro === 0 ? { ...semGiro, x, y } : { ...prop, x, y, rotation: giro }
}

/**
 * O SOLTAR do arrasto de objeto (`PixiCanvas`, fim do 'dragging-prop'): a
 * tocha de parede arrastada sozinha se prende na parede perto
 * (`encostarTochaNaParede`). Roda ANTES do `commitDragHistory(antes)` e só com
 * as ações ao vivo, sem histórico: o encaixe entra no MESMO passo do Ctrl+Z
 * do arrasto, e um Ctrl+Z desfaz os dois. Arrasto de vários itens não passa
 * por aqui (a seleção tem de ser UM objeto). Clique sem arrasto não mexe no
 * mapa: só selecionar uma tocha velha não a move.
 */
export function encostarTochaArrastadaNaParede(antes: MapData): void {
  const store = useMapStore.getState()
  const item = selectionSingle(store.selection)
  if (item === null || item.kind !== 'prop') return
  const prop = store.map.props.find((p) => p.id === item.id)
  if (prop === undefined) return
  // A cópia do Alt+arrastar não existia antes: ela andou.
  const deAntes = antes.props.find((p) => p.id === prop.id)
  if (deAntes !== undefined && deAntes.x === prop.x && deAntes.y === prop.y) return
  const presa = encostarTochaNaParede(prop, mapaDoPiso(store.map, store.pisoAtivo))
  if (presa === null) return
  store.movePropLive(presa.id, presa.x, presa.y)
  store.setPropRotationLive(presa.id, presa.rotation)
}
