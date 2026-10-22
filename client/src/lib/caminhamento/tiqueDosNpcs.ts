import type { Point } from '../../pixi/world'
import type { MapData } from '../../types/map'
import { AgendaDeCaminhos } from './agenda'
import { type Andarilho, type FimDoTrecho, type MotivoDoAndarilho, novoAndarilho, type TiqueDoAndarilho, tiqueDoAndarilho } from './andarilho'
import type { ResultadoDoCaminho } from './busca'
import { entradaDaFicha } from './daFicha'

/**
 * TIQUE DOS NPCS — a ponte entre o motor (`andarilho.ts`, `agenda.ts`) e quem
 * anda sozinho no editor (a rotina andando, a patrulha andando). Num tique,
 * cada NPC anda um passo do trecho dele, um depois do outro: quem anda depois
 * vê quem já andou no lugar novo e a porta que outro abriu já aberta — dois
 * NPCs não pisam no mesmo lugar no mesmo tique.
 *
 * O caminho que o NPC pede sai no mesmo tique quando cabe no orçamento do
 * motor (mapa pequeno, sempre): a rotina simples anda como antes do motor,
 * passo a passo desde o primeiro tique. O que não couber segue entre os tiques
 * (o store rega a agenda) e o NPC espera parado, sem pular.
 *
 * Puro: o mapa entra por parâmetro, as portas saem como mudanças para quem
 * aplica (`comPortaDoNpc`).
 */

export interface MotorDosNpcs {
  readonly agenda: AgendaDeCaminhos
  /** Quanto a agenda trabalha dentro do tique, em ms do relógio dela. */
  readonly orcamentoDoTique: number
}

/**
 * Orçamento do motor dentro de um tique do editor: um mapa pequeno responde no
 * mesmo tique, e sobra folga até a tarefa longa (50 ms).
 */
export const ORCAMENTO_DO_TIQUE_MS = 8
/** Entre dois tiques, a agenda segue o que não coube neles, um pedaço (`ORCAMENTO_POR_QUADRO_MS`) a cada quadro destes. */
export const QUADRO_DA_AGENDA_MS = 16

/** O motor do editor, com o relógio de verdade (`performance.now`). */
export function motorComRelogio(relogio: () => number): MotorDosNpcs {
  return { agenda: new AgendaDeCaminhos(relogio), orcamentoDoTique: ORCAMENTO_DO_TIQUE_MS }
}

/** Relógio parado e orçamento sem fim: toda resposta sai no mesmo tique (teste, e quem não passa um motor). */
export function motorImediato(): MotorDosNpcs {
  return { agenda: new AgendaDeCaminhos(() => 0), orcamentoDoTique: Number.POSITIVE_INFINITY }
}

/** Uma porta que o NPC abriu (`aberta`) ou fechou. */
export interface MudancaDePorta {
  wallId: string
  aberta: boolean
}

/** A porta mexida numa cena (`sceneId`). */
export interface PortaDoNpc extends MudancaDePorta {
  sceneId: string
}

/**
 * Por que o NPC desistiu de ir a (x, y): a porta que o mestre teria de
 * destrancar, a ficha que tapa o caminho. Estado da sessão (o do agendador),
 * nunca da ficha: some quando ele chega lá ou quando o mestre o para.
 */
export interface AvisoDoNpc {
  motivo: MotivoDoAndarilho
  portas: readonly string[]
  fichas: readonly string[]
  x: number
  y: number
  desde: number
}

/**
 * O mapa com a porta `wallId` aberta ou fechada pelo NPC, como a do jogador
 * (`net/playerChanges.ts`): trancada não abre. Nada a mudar: o MESMO mapa —
 * pura e reaplicável, serve de `transform` para `applyPlayerChange`.
 */
export function comPortaDoNpc(map: MapData, wallId: string, aberta: boolean): MapData {
  const porta = map.walls.find((w) => w.id === wallId)?.door
  if (porta === undefined || porta === null || porta.open === aberta || (aberta && porta.locked)) return map
  return { ...map, walls: map.walls.map((w) => (w.id === wallId && w.door !== null ? { ...w, door: { ...w.door, open: aberta } } : w)) }
}

/** O mapa com as portas mexidas, em ordem. */
export function comPortasDoNpc(map: MapData, portas: readonly MudancaDePorta[]): MapData {
  return portas.reduce((m, p) => comPortaDoNpc(m, p.wallId, p.aberta), map)
}

/** O aviso de quem desistiu de ir a `destino`; `null` se o trecho não acabou em desistência. */
export function avisoDoFim(fim: FimDoTrecho | null, destino: Point, agora: number): AvisoDoNpc | null {
  if (fim === null || fim.tipo !== 'desistiu') return null
  return { motivo: fim.motivo, portas: fim.portas, fichas: fim.fichas, x: destino.x, y: destino.y, desde: agora }
}

/** O aviso que segue valendo depois de chegar a `aqui`: o de lá some. */
export function avisoDepoisDeChegar(aviso: AvisoDoNpc | undefined, aqui: Point): AvisoDoNpc | undefined {
  return aviso !== undefined && aviso.x === aqui.x && aviso.y === aqui.y ? undefined : aviso
}

/**
 * O trecho rumo a `destino`: o que já anda para lá, ou um novo, que herda as
 * portas que o anterior deixou abertas atrás dela.
 */
function trechoPara(anterior: Andarilho | undefined, destino: Point, aqui: Point): Andarilho {
  if (anterior !== undefined && anterior.fim === null && anterior.destino.x === destino.x && anterior.destino.y === destino.y) return anterior
  const herdadas = anterior === undefined ? [] : [...new Set([...anterior.fechar, ...anterior.abertas])]
  return novoAndarilho(destino, aqui, herdadas)
}

export class TiqueDosNpcs {
  /** As portas mexidas neste tique, na ordem. */
  readonly portas: PortaDoNpc[] = []
  private gasto = 0
  private readonly mapas = new Map<string, MapData>()
  private readonly posicoes = new Map<string, Point>()

  constructor(
    private readonly motor: MotorDosNpcs,
    private readonly agora: number,
  ) {}

  /**
   * Um passo do trecho de `tokenId` rumo a `destino`, na cena `sceneId` (`map`
   * é o mapa dela no começo do tique), andando `passo` px. `chave`: o nome do
   * pedido na agenda. `null`: a ficha não está no mapa.
   */
  andar(chave: string, sceneId: string, map: MapData, tokenId: string, destino: Point, anterior: Andarilho | undefined, passo: number): TiqueDoAndarilho | null {
    const mapa = this.mapas.get(sceneId) ?? map
    const token = mapa.tokens.find((t) => t.id === tokenId)
    const entrada = entradaDaFicha(mapa, tokenId, this.posicoes)
    if (token === undefined || entrada === null) return null
    const { agenda } = this.motor
    const aqui = this.posicoes.get(tokenId) ?? { x: token.x, y: token.y }
    const malha = agenda.cache.malhaPara(entrada.mapa, entrada.raio)
    const mundo = { aqui, agora: this.agora, passo, malha, paredes: entrada.mapa.walls, fichas: entrada.fichas }
    let andarilho = trechoPara(anterior, destino, aqui)
    const resposta = andarilho.aguardando ? agenda.pegar(chave) : undefined
    // O pedido sumiu da agenda (o mestre parou e religou, o editor recarregou): pede de novo, senão espera para sempre.
    if (andarilho.aguardando && resposta === undefined && !agenda.pendente(chave)) andarilho = { ...andarilho, aguardando: false }
    let tique = tiqueDoAndarilho(andarilho, mundo, resposta)
    if (tique.pedido !== null) {
      agenda.pedir(chave, entrada.mapa, entrada.raio, tique.pedido)
      const pronta = this.responder(chave)
      if (pronta !== undefined) tique = tiqueDoAndarilho(tique.andarilho, mundo, pronta)
      // O caminho que acabou de chegar já não serve (raro): o pedido novo fica para o próximo tique.
      if (tique.pedido !== null) agenda.pedir(chave, entrada.mapa, entrada.raio, tique.pedido)
    }
    this.aplicar(sceneId, mapa, tokenId, tique)
    return tique
  }

  /** A agenda trabalha o que resta do orçamento do tique; a resposta de `chave`, se saiu. */
  private responder(chave: string): ResultadoDoCaminho | undefined {
    const resta = this.motor.orcamentoDoTique - this.gasto
    if (resta > 0) this.gasto += this.motor.agenda.rodar(resta)
    return this.motor.agenda.pegar(chave)
  }

  /** O passo de `tokenId` entra no mundo do tique: a posição nova e as portas mexidas. */
  private aplicar(sceneId: string, mapa: MapData, tokenId: string, tique: TiqueDoAndarilho): void {
    let depois = mapa
    for (const acao of tique.acoes) {
      const aberta = acao.tipo === 'abrir'
      const mexido = comPortaDoNpc(depois, acao.wallId, aberta)
      if (mexido === depois) continue
      depois = mexido
      this.portas.push({ sceneId, wallId: acao.wallId, aberta })
    }
    if (depois !== mapa) this.mapas.set(sceneId, depois)
    this.posicoes.set(tokenId, tique.para)
  }
}
