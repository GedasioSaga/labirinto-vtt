import type { FloorPiece, MapData } from '../types/map'
import { ehCamadaDoPincel, nomeDaPeca, proximoNomeDeCamada } from './camadasDoChao'
import { buildBlocosShape, chaveDoBloco, type Bloco } from './floorBlocks'
import { baldeNoPonto, buildFloorPiece } from './floorTool'
import { apagarBlocosNoPiso } from './pisoEmEdicao'
import { comPiso, mapaDoPiso, pisoDe } from './pisos'

/**
 * CAMADAS DO PINCEL — a parte PURA (pedido de 03/10/2026: "eu quero que você
 * crie camadas para as ferramentas de pincel, uma fica em cima da outra").
 *
 * MODELO: cada camada é UMA peça de chão de blocos que soma (`FloorPiece` com
 * `shape.kind === 'blocos'`, `op: 'add'`), com o nome, a cor, o olho e o
 * cadeado que a peça já tinha. A ordem de `MapData.floor` já era "a de cima
 * pinta por cima" (`buildColorLayers` em `pixi/drawFloor.ts`) e a lista
 * "Camadas do chão" já era a lista das peças; uma estrutura paralela teria de
 * repetir essas duas coisas e ficar em dia com elas. Por isso nada de lista
 * nova no mapa: só `FloorPiece.nome`, opcional.
 *
 * O que muda é QUEM recebe a tinta: o pincel e o balde pintam só na camada
 * ativa (preferência de sessão do mestre, fora do mapa e do Ctrl+Z), e a
 * pincelada não tira mais os blocos das outras camadas — a de cima cobre a de
 * baixo sem apagá-la. Dentro da mesma camada continua somando.
 */

/** Camada ativa = "a próxima pincelada abre uma camada nova". */
export const NOVA_CAMADA = '__nova-camada__'

export type AlvoDoPincel =
  | { tipo: 'camada'; peca: FloorPiece }
  /** O mestre pediu "Nova camada": a próxima pincelada cria. */
  | { tipo: 'nova' }
  /** O piso não tem camada do pincel nenhuma: a próxima pincelada cria a primeira. */
  | { tipo: 'nenhuma' }

/** As camadas do pincel do piso, de baixo para cima. */
export function camadasDoPincelNoPiso(floor: readonly FloorPiece[], piso: number): FloorPiece[] {
  return floor.filter((peca) => ehCamadaDoPincel(peca) && pisoDe(peca) === piso)
}

/**
 * Onde o pincel pinta agora. A camada escolhida, se ainda existe neste piso;
 * senão a de cima (o Ctrl+Z que desfez a camada, a troca de piso, o mapa
 * aberto agora). Mapa antigo, com várias peças de pincel, cai na mais nova.
 */
export function alvoDoPincel(floor: readonly FloorPiece[], piso: number, ativaId: string | null): AlvoDoPincel {
  if (ativaId === NOVA_CAMADA) return { tipo: 'nova' }
  const camadas = camadasDoPincelNoPiso(floor, piso)
  const peca = camadas.find((c) => c.id === ativaId) ?? camadas.at(-1)
  return peca === undefined ? { tipo: 'nenhuma' } : { tipo: 'camada', peca }
}

export type RecusaDaCamada = 'travada' | 'escondida'

export interface ResultadoNaCamada {
  /** O próprio `map` quando nada mudou — quem chama não gasta Ctrl+Z. */
  map: MapData
  /** Camada ativa depois do gesto (a recém-criada, ou `null` se a ativa sumiu). */
  ativaId: string | null
  recusa?: RecusaDaCamada
  /** Nome da camada que recusou, para o aviso. */
  nome?: string
}

function recusaDe(peca: FloorPiece): RecusaDaCamada | null {
  if (peca.locked) return 'travada'
  return peca.hidden ? 'escondida' : null
}

/** Aviso curto da camada que não recebe tinta. */
export function avisoDaRecusa(recusa: RecusaDaCamada, nome: string): string {
  return recusa === 'travada' ? `${nome} está travada: destrave o cadeado para pintar nela.` : `${nome} está escondida: mostre a camada (olho) para pintar nela.`
}

function trocarPeca(map: MapData, peca: FloorPiece): MapData {
  return { ...map, floor: map.floor.map((p) => (p.id === peca.id ? peca : p)) }
}

function somarNaCamada(map: MapData, peca: FloorPiece, blocos: readonly Bloco[]): MapData {
  if (peca.shape.kind !== 'blocos') return map
  const { shape } = peca
  const existentes = new Set(shape.cells.map((c) => chaveDoBloco(c.col, c.row)))
  const novas: Bloco[] = []
  for (const bloco of blocos) {
    const chave = chaveDoBloco(bloco.col, bloco.row)
    if (existentes.has(chave)) continue
    existentes.add(chave)
    novas.push({ col: bloco.col, row: bloco.row })
  }
  if (novas.length === 0) return map
  return trocarPeca(map, { ...peca, shape: { ...shape, cells: [...shape.cells, ...novas] } })
}

interface OpcoesDaPintura {
  novoId: () => string
  /** Cor da camada que nascer (`null` = a cor do chão do mapa). Camada existente fica com a dela. */
  cor: string | null
}

/**
 * Pincelada (ou balde) na camada ativa: as células somam na camada; as das
 * outras camadas ficam intocadas. Sem camada (ou com "Nova camada"), nasce
 * uma — "Camada N", no topo, no piso em edição — e ela vira a ativa. Camada
 * de outra grade (o mapa mudou de grade depois de pintada) não recebe célula
 * de tamanho diferente: nasce uma camada nova, como na falta de camada.
 */
export function pintarNaCamada(
  map: MapData,
  piso: number,
  ativaId: string | null,
  blocos: readonly Bloco[],
  cell: number,
  opcoes: OpcoesDaPintura,
): ResultadoNaCamada {
  const alvo = alvoDoPincel(map.floor, piso, ativaId)
  if (alvo.tipo === 'camada') {
    const recusa = recusaDe(alvo.peca)
    if (recusa) return { map, ativaId: alvo.peca.id, recusa, nome: nomeDaPeca(map.floor, alvo.peca) }
    if (alvo.peca.shape.kind === 'blocos' && alvo.peca.shape.cell === cell) {
      return { map: somarNaCamada(map, alvo.peca, blocos), ativaId: alvo.peca.id }
    }
  }
  const shape = buildBlocosShape(cell, blocos)
  if (!shape) return { map, ativaId }
  const base: FloorPiece = { ...buildFloorPiece(opcoes.novoId(), shape, 'add'), nome: proximoNomeDeCamada(map.floor) }
  const camada = comPiso(opcoes.cor === null ? base : { ...base, fillColor: opcoes.cor }, piso)
  return { map: { ...map, floor: [...map.floor, camada] }, ativaId: camada.id }
}

/**
 * Borracha do pincel (botão direito ou Subtrair) na camada ativa: as células
 * saem SÓ dela. Camada que fica sem célula some da lista, como sempre.
 *
 * "Nova camada" ainda não tem célula: nada a apagar. O piso SEM camada do
 * pincel nenhuma segue a borracha de antes (`apagarBlocosNoPiso`): é o chão
 * feito de outras formas (retângulo, corredor, imagem), e o buraco é o único
 * jeito de tirar um pedaço dele — sem camada não há o que proteger.
 */
export function apagarNaCamada(
  map: MapData,
  piso: number,
  ativaId: string | null,
  blocos: readonly Bloco[],
  cell: number,
  novoId: () => string,
): ResultadoNaCamada {
  const alvo = alvoDoPincel(map.floor, piso, ativaId)
  if (alvo.tipo === 'nova') return { map, ativaId }
  if (alvo.tipo === 'nenhuma') return { map: apagarBlocosNoPiso(map, piso, blocos, cell, novoId), ativaId }
  const { peca } = alvo
  const recusa = recusaDe(peca)
  if (recusa) return { map, ativaId: peca.id, recusa, nome: nomeDaPeca(map.floor, peca) }
  if (peca.shape.kind !== 'blocos' || peca.shape.cell !== cell) return { map, ativaId: peca.id }
  const alvoDaBorracha = new Set(blocos.map((b) => chaveDoBloco(b.col, b.row)))
  const restantes = peca.shape.cells.filter((c) => !alvoDaBorracha.has(chaveDoBloco(c.col, c.row)))
  if (restantes.length === peca.shape.cells.length) return { map, ativaId: peca.id }
  if (restantes.length === 0) return { map: { ...map, floor: map.floor.filter((p) => p.id !== peca.id) }, ativaId: null }
  return { map: trocarPeca(map, { ...peca, shape: { ...peca.shape, cells: restantes } }), ativaId: peca.id }
}

/**
 * Balde na camada ativa. O enchimento para nas paredes (portas inclusive), nas
 * linhas do mapa, no contorno das salas e regiões e na borda do mapa — e na
 * tinta da PRÓPRIA camada, como o balde de qualquer editor de imagem. A tinta
 * das outras camadas não segura nada: ela fica por baixo (ou por cima) e o
 * balde passa. `vazio: true` = não havia o que encher (clique fora do mapa ou
 * em cima da própria camada).
 */
export function encherNaCamada(
  map: MapData,
  piso: number,
  ativaId: string | null,
  ponto: { x: number; y: number },
  opcoes: OpcoesDaPintura,
): ResultadoNaCamada & { vazio?: true } {
  const alvo = alvoDoPincel(map.floor, piso, ativaId)
  if (alvo.tipo === 'camada') {
    const recusa = recusaDe(alvo.peca)
    if (recusa) return { map, ativaId: alvo.peca.id, recusa, nome: nomeDaPeca(map.floor, alvo.peca) }
  }
  const seguram = alvo.tipo === 'camada' ? [alvo.peca] : []
  const area = baldeNoPonto({ ...mapaDoPiso(map, piso), floor: seguram }, ponto, opcoes.novoId)
  if (area === null || area.shape.kind !== 'blocos') return { map, ativaId, vazio: true }
  const ativa = alvo.tipo === 'camada' ? alvo.peca.id : ativaId
  return pintarNaCamada(map, piso, ativa, area.shape.cells, area.shape.cell, opcoes)
}

/**
 * Cor com que o pincel pinta agora — a da prévia do traço: a da camada ativa;
 * numa camada que vai nascer, a tinta escolhida no menu (`corDaTintaNova`,
 * `null` = cor do chão do mapa).
 */
export function corDoPincel(map: MapData, piso: number, ativaId: string | null, corDaTintaNova: string | null): string {
  const alvo = alvoDoPincel(map.floor, piso, ativaId)
  if (alvo.tipo === 'camada') return alvo.peca.fillColor ?? map.floorStyle.fillColor
  return corDaTintaNova ?? map.floorStyle.fillColor
}
