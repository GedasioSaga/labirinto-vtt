import type { Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { recursoDeVida, vidaDoPersonagem } from '../vidaDaFicha'

/**
 * ORDEM DOS TURNOS DA BATALHA ONE PIECE (F1 de
 * docs/planos/batalha-one-piece-f1-plano.md; decisões 2, 3 e 4 de
 * docs/planos/batalha-one-piece-2026-10-30.md): a fila de cartas, a vez, a
 * rodada, as cartas extras e o desempate de uma cena em batalha.
 *
 * Estado da SESSÃO do mestre (`stores/batalhaStore.ts`): nunca vai ao
 * `map.json` nem, inteiro, ao jogador — o recorte dele sai de
 * `vistaDoJogador.ts`, sem Agilidade, d20 nem marca de empate.
 *
 * Os campos `extras` e `gastos` já existem para a F2 (ações extras dadas pelo
 * mestre e ações gastas na vez) e ficam vazios na F1: assim a forma do estado
 * e o Desfazer não mudam quando a F2 chegar.
 *
 * Puro: sem store, sem rede. Relógio e d20 entram por parâmetro.
 */

/** Como o empate de Agilidade se resolve: o app rola 1d20, ou o mestre arrasta ("Eu decido"). */
export type Desempate = 'd20' | 'manual'

/** A carta extra (e a ação extra) vale só nesta rodada, ou em todas até o mestre tirar. */
export type DuracaoDaExtra = 'rodada' | 'sempre'

export interface CartaDaOrdem {
  /** `carta_<rand>`. A carta extra tem id próprio e o MESMO `tokenId` da original. */
  id: string
  tokenId: string
  /**
   * O personagem ligado ao token (`Token.characterId`), lido na inclusão e no
   * "Ordenar". `null` = ficha sem personagem: entra na ordem, sem perfil nem vida.
   */
  personagemId: string | null
  /** Só na carta extra: quanto ela dura e em que rodada nasceu. */
  extra?: { duracao: DuracaoDaExtra; criadaNaRodada: number }
}

/** F2: ações a mais que o mestre deu para a vez de uma carta (atacar duas vezes). Na F1, nunca preenchido. */
export interface AcoesExtras {
  simples: number
  bonus: number
  mov: number
  duracao: DuracaoDaExtra
}

/**
 * F2: o que a carta já gastou NESTA vez. Zera no "Passar a vez". Contador, e
 * não booleano, porque as ações extras dão mais de uma Simples; a Completa
 * conta 1 Simples + 1 Movimento. Reação não entra: não tem limite (decisão 8).
 */
export interface GastoDaVez {
  simples: number
  movimento: number
  bonus: number
  /** Blocos andados nesta vez, para o "Mov 2/4" (conta e não trava, decisão 6). */
  blocos: number
}

export interface TurnosDaCena {
  /** A ordem, da primeira à última carta da rodada. */
  cartas: readonly CartaDaOrdem[]
  /** Id da carta da vez; `null` antes de começar. */
  vez: string | null
  /** 1 em diante. */
  rodada: number
  desempate: Desempate
  /** cartaId → d20 rolado no desempate. Só o mestre vê. */
  d20: Readonly<Record<string, number>>
  /** cartaId → grupo de empate (modo "manual"). A marca fica até o mestre arrastar. Só o mestre vê. */
  empates: Readonly<Record<string, number>>
  /** F2: cartaId → ações extras dadas pelo mestre. */
  extras: Readonly<Record<string, AcoesExtras>>
  /** F2: cartaId → o que já gastou nesta vez. */
  gastos: Readonly<Record<string, GastoDaVez>>
}

/** Quem fez a ação que entra no registro. O `nome` do jogador é o da mesa, na hora. */
export type AutorDaAcao = { tipo: 'mestre' } | { tipo: 'jogador'; playerId: string; nome: string }

/** "Turno N/M": a posição da vez e o total de cartas. */
export interface TurnoNoM {
  n: number
  m: number
}

/** A carta da vez, ou `null` (não começou, ou a vez aponta para carta que sumiu). */
export function cartaDaVez(turnos: TurnosDaCena): CartaDaOrdem | null {
  if (turnos.vez === null) return null
  return turnos.cartas.find((carta) => carta.id === turnos.vez) ?? null
}

/**
 * "Turno N/M". Com `visivel`, conta só as cartas que passam (o recorte do
 * jogador, decisão Q1): `m` = quantas ele vê, `n` = a posição da vez entre
 * elas. Vez numa carta que ele não vê conta as visíveis que já passaram — o
 * jogador lê "Turno 2/5" e "Vez de alguém fora da sua vista", sem saber
 * quantas cartas escondidas há. Sem vez, `n` = 0.
 */
export function turnoNoM(turnos: TurnosDaCena, visivel: (carta: CartaDaOrdem) => boolean = () => true): TurnoNoM {
  let m = 0
  let n = 0
  let passouDaVez = false
  for (const carta of turnos.cartas) {
    const conta = visivel(carta)
    if (conta) m += 1
    if (passouDaVez) continue
    if (conta) n += 1
    if (carta.id === turnos.vez) passouDaVez = true
  }
  // Sem vez (ou vez que sumiu) nada "passou": nenhuma carta jogou ainda nesta conta.
  return { n: passouDaVez ? n : 0, m }
}

/**
 * Os tokens cuja ficha está com a vida em 0 (decisão Q3: a carta deles é
 * pulada no "Passar a vez"; o mestre ainda pode dar a vez a ela). Sem sistema
 * de vida, sem personagem ou sem máximo: não caiu — na dúvida a carta joga.
 */
export function tokensCaidos(cartas: readonly CartaDaOrdem[], personagens: readonly Personagem[], sistema: SistemaDeRpg | null): ReadonlySet<string> {
  const recurso = recursoDeVida(sistema)
  const caidos = new Set<string>()
  if (recurso === null) return caidos
  const porId = new Map(personagens.map((personagem) => [personagem.id, personagem]))
  for (const carta of cartas) {
    if (carta.personagemId === null) continue
    const personagem = porId.get(carta.personagemId)
    if (personagem === undefined) continue
    const vida = vidaDoPersonagem(personagem, recurso)
    if (vida !== null && vida.atual <= 0) caidos.add(carta.tokenId)
  }
  return caidos
}

/**
 * A carta que vem depois da vez, dando a volta na ordem e pulando as de token
 * caído (`caidos`, de `tokensCaidos`) e as que `visivel` recusa. `null` = sem
 * vez, ou nenhuma outra carta joga. Pode ser a própria vez, se ela for a única
 * que joga (a rodada seguinte).
 */
export function proximaCarta(
  turnos: TurnosDaCena,
  caidos: ReadonlySet<string>,
  visivel: (carta: CartaDaOrdem) => boolean = () => true,
): CartaDaOrdem | null {
  const { cartas } = turnos
  const indice = cartas.findIndex((carta) => carta.id === turnos.vez)
  if (indice < 0) return null
  for (let passo = 1; passo <= cartas.length; passo += 1) {
    const carta = cartas[(indice + passo) % cartas.length]
    if (carta !== undefined && !caidos.has(carta.tokenId) && visivel(carta)) return carta
  }
  return null
}
