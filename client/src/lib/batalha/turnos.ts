import type { Token } from '../../types/map'
import { valorDoRank } from '../ajusteDaFicha'
import { entraNaBatalha } from '../livros/combate'
import type { Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import type { CombateDoPersonagem, ContraAtaque, GolpeDaBatalha } from './combate'
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
  /** O nome do token na inclusão: o texto do registro e o painel do mestre. O jogador lê o nome do recorte dele, não este. */
  nome?: string
  /** Só na carta extra: quanto ela dura e em que rodada nasceu. */
  extra?: { duracao: DuracaoDaExtra; criadaNaRodada: number }
}

/** F2: ações a mais que o mestre deu para a vez de uma carta (atacar duas vezes). Na F1, nunca preenchido. */
export interface AcoesExtras {
  simples: number
  bonus: number
  mov: number
  duracao: DuracaoDaExtra
  /** F2: a rodada em que foi dada. As "rodada" somem quando a carta passa a vez e quando a rodada vira. */
  rodada?: number
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
  /** F2: personagemId → recargas, usos, Overload, carga e armas. Mora aqui para o Desfazer voltá-lo. Ausente = ninguém agiu. */
  combate?: Readonly<Record<string, CombateDoPersonagem>>
  /** F2: os golpes que ainda têm alvo esperando a reação (no máximo `GOLPES_PENDENTES_MAX`). */
  golpes?: readonly GolpeDaBatalha[]
  /** F2 (Q6): os contra-ataques ganhos e ainda não usados. */
  contras?: readonly ContraAtaque[]
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

// ───────────────────────────────────────────────────────────────────────────
// Montar e mudar a ordem (o reducer que a store chama). Toda função devolve
// estado NOVO; nada mudou = o MESMO objeto, para a store não subir revisão.
// ───────────────────────────────────────────────────────────────────────────

/** Uma carta guardada com a posição em que estava: o Desfazer a põe de volta ali. */
export interface CartaNoLugar {
  carta: CartaDaOrdem
  indice: number
}

/** Teto do d20 do desempate e de re-rolagens do mesmo grupo (grupo com mais de 20 nunca fica todo diferente). */
const LADOS_DO_D20 = 20
const REROLAGENS_MAX = 50

const SEM_NUMEROS: Readonly<Record<string, number>> = {}
const SEM_EXTRAS: Readonly<Record<string, AcoesExtras>> = {}
const SEM_GASTOS: Readonly<Record<string, GastoDaVez>> = {}

export function novoIdDeCarta(): string {
  return `carta_${crypto.randomUUID()}`
}

/** A ordem de uma batalha que acabou de ligar sem ninguém: rodada 1, sem vez. */
export function turnosVazios(desempate: Desempate = 'd20'): TurnosDaCena {
  return { cartas: [], vez: null, rodada: 1, desempate, d20: SEM_NUMEROS, empates: SEM_NUMEROS, extras: SEM_EXTRAS, gastos: SEM_GASTOS }
}

/** A carta de um token (sem ser extra). */
export function novaCarta(tokenId: string, personagemId: string | null, nome?: string): CartaDaOrdem {
  const carta: CartaDaOrdem = { id: novoIdDeCarta(), tokenId, personagemId }
  if (nome !== undefined) carta.nome = nome
  return carta
}

/**
 * A Agilidade que ordena: o total do atributo (`valorDoRank`). O sistema sem
 * a chave `agilidade` usa o atributo de NOME "Agilidade"; sem nenhum dos dois,
 * todo mundo vale 0 (e a ordem fica a da inclusão, com empate geral).
 */
export function agilidadeDe(personagem: Personagem, sistema: SistemaDeRpg | null): number {
  if (sistema === null) return 0
  const atributo =
    sistema.atributos.find((candidato) => candidato.id === 'agilidade') ??
    sistema.atributos.find((candidato) => candidato.nome.trim().toLocaleLowerCase('pt-BR') === 'agilidade')
  if (atributo === undefined) return 0
  const valor = valorDoRank(personagem, atributo.id)
  return Number.isFinite(valor) ? valor : 0
}

type TokenDaOrdem = Pick<Token, 'id' | 'characterId' | 'name' | 'hidden'>

/**
 * As cartas de quem entra na luta ao Iniciar: toda ficha da cena com
 * personagem ligado (que ainda existe) e não escondida no editor, maior
 * Agilidade primeiro. O empate fica na ordem do mapa: `ordenarPelaAgilidade`
 * o resolve (d20 ou marca).
 *
 * MUNDO DO LIVRO (M1): sem `incluir`, o NPC "Só no cenário" fica fora
 * (`entraNaBatalha`). Com `incluir` (os ids de token MARCADOS na caixa "Quem
 * entra na batalha?"), entram só eles — inclusive o de cenário que o mestre
 * marcou com a própria ficha: a escolha dele na caixa vale para esta batalha.
 */
export function combatentesIniciais(
  tokens: readonly TokenDaOrdem[],
  personagens: readonly Personagem[],
  sistema: SistemaDeRpg | null,
  incluir?: ReadonlySet<string>,
): CartaDaOrdem[] {
  const porId = new Map(personagens.map((personagem) => [personagem.id, personagem]))
  const comAgilidade: { carta: CartaDaOrdem; agilidade: number }[] = []
  for (const token of tokens) {
    if (token.hidden === true || token.characterId === null) continue
    if (incluir !== undefined && !incluir.has(token.id)) continue
    const personagem = porId.get(token.characterId)
    if (personagem === undefined) continue
    if (incluir === undefined && !entraNaBatalha(personagem)) continue
    comAgilidade.push({ carta: novaCarta(token.id, personagem.id, token.name), agilidade: agilidadeDe(personagem, sistema) })
  }
  // `sort` é estável: empate fica na ordem do mapa.
  return comAgilidade.sort((a, b) => b.agilidade - a.agilidade).map(({ carta }) => carta)
}

/** A Agilidade de cada carta (pelo personagem dela); carta sem personagem, ou de personagem apagado, vale 0. */
export function agilidadesDasCartas(cartas: readonly CartaDaOrdem[], personagens: readonly Personagem[], sistema: SistemaDeRpg | null): Map<string, number> {
  const porId = new Map(personagens.map((personagem) => [personagem.id, personagem]))
  const agilidades = new Map<string, number>()
  for (const carta of cartas) {
    const personagem = carta.personagemId === null ? undefined : porId.get(carta.personagemId)
    agilidades.set(carta.id, personagem === undefined ? 0 : agilidadeDe(personagem, sistema))
  }
  return agilidades
}

/** Rola para cada carta do grupo até todas saírem diferentes (no teto de tentativas, o empate que sobrar fica estável). */
function rolarGrupo(grupo: readonly CartaDaOrdem[], rolarD20: () => number): Map<string, number> {
  let rolagens = new Map<string, number>()
  for (let tentativa = 0; tentativa < REROLAGENS_MAX; tentativa += 1) {
    rolagens = new Map(grupo.map((carta) => [carta.id, Math.min(LADOS_DO_D20, Math.max(1, Math.trunc(rolarD20())))]))
    if (new Set(rolagens.values()).size === grupo.length) break
  }
  return rolagens
}

/** Cada carta extra logo depois da original do mesmo token; extra sem original vai ao fim, na ordem em que estava. */
function comExtrasAoLado(originais: readonly CartaDaOrdem[], extras: readonly CartaDaOrdem[]): CartaDaOrdem[] {
  const ordem: CartaDaOrdem[] = []
  const usadas = new Set<string>()
  for (const carta of originais) {
    ordem.push(carta)
    for (const extra of extras) {
      if (extra.tokenId !== carta.tokenId || usadas.has(extra.id)) continue
      usadas.add(extra.id)
      ordem.push(extra)
    }
  }
  return [...ordem, ...extras.filter((extra) => !usadas.has(extra.id))]
}

/**
 * "Ordenar pela Agilidade" (e o Iniciar): maior primeiro. Empate em "d20": o
 * app rola 1d20 para cada um do grupo (re-rola até sair diferente) e grava o
 * número na carta (`d20`, só o mestre vê); em "manual", grava a marca do
 * grupo (`empates`) e a ordem fica a de antes, para o mestre arrastar. A
 * carta extra fica logo depois da original. A vez não muda de carta.
 */
export function ordenarPelaAgilidade(turnos: TurnosDaCena, agilidades: ReadonlyMap<string, number>, rolarD20: () => number): TurnosDaCena {
  const originais = turnos.cartas.filter((carta) => carta.extra === undefined)
  const extras = turnos.cartas.filter((carta) => carta.extra !== undefined)
  const agilidade = (carta: CartaDaOrdem): number => agilidades.get(carta.id) ?? 0
  const ordenadas = [...originais].sort((a, b) => agilidade(b) - agilidade(a))
  const grupos: CartaDaOrdem[][] = []
  for (const carta of ordenadas) {
    const ultimo = grupos[grupos.length - 1]
    if (ultimo !== undefined && ultimo[0] !== undefined && agilidade(ultimo[0]) === agilidade(carta)) ultimo.push(carta)
    else grupos.push([carta])
  }
  const d20: Record<string, number> = {}
  const empates: Record<string, number> = {}
  const final: CartaDaOrdem[] = []
  let grupoDeEmpate = 0
  for (const grupo of grupos) {
    if (grupo.length === 1) {
      final.push(...grupo)
      continue
    }
    if (turnos.desempate === 'manual') {
      grupoDeEmpate += 1
      for (const carta of grupo) empates[carta.id] = grupoDeEmpate
      final.push(...grupo)
      continue
    }
    const rolagens = rolarGrupo(grupo, rolarD20)
    for (const [cartaId, valor] of rolagens) d20[cartaId] = valor
    final.push(...[...grupo].sort((a, b) => (rolagens.get(b.id) ?? 0) - (rolagens.get(a.id) ?? 0)))
  }
  return { ...turnos, cartas: comExtrasAoLado(final, extras), d20, empates }
}

/** Troca o modo de desempate. As marcas do modo antigo saem: o próximo "Ordenar" faz as do novo. */
export function trocarDesempate(turnos: TurnosDaCena, desempate: Desempate): TurnosDaCena {
  if (turnos.desempate === desempate) return turnos
  return { ...turnos, desempate, d20: SEM_NUMEROS, empates: SEM_NUMEROS }
}

/** Primeira carta de `cartas`, a partir de `inicio`, cujo token não caiu. */
function primeiraQueJoga(cartas: readonly CartaDaOrdem[], inicio: number, caidos: ReadonlySet<string>): CartaDaOrdem | null {
  for (let i = Math.max(0, inicio); i < cartas.length; i += 1) {
    const carta = cartas[i]
    if (carta !== undefined && !caidos.has(carta.tokenId)) return carta
  }
  return null
}

/** O que o "Passar a vez" fez: o estado novo e as extras "só nesta rodada" que saíram ao virar a rodada. */
export interface VezPassada {
  turnos: TurnosDaCena
  removidas: CartaNoLugar[]
}

/**
 * "Passar a vez": a próxima carta cujo token não caiu (Q3). Sem vez, começa
 * pela primeira. Ao dar a volta: rodada + 1, as cartas extras "só nesta
 * rodada" saem e a vez vai à primeira que joga. Os gastos da vez zeram.
 * `null` = ninguém joga (todos caídos, ou ordem vazia).
 */
export function passarVez(turnos: TurnosDaCena, caidos: ReadonlySet<string>): VezPassada | null {
  const atual = turnos.vez === null ? -1 : turnos.cartas.findIndex((carta) => carta.id === turnos.vez)
  const seguinte = primeiraQueJoga(turnos.cartas, atual + 1, caidos)
  if (seguinte !== null) return { turnos: aoComecarAVez({ ...turnos, vez: seguinte.id, gastos: SEM_GASTOS }, turnos.vez, seguinte, false), removidas: [] }
  const removidas: CartaNoLugar[] = []
  const ficam: CartaDaOrdem[] = []
  turnos.cartas.forEach((carta, indice) => {
    if (carta.extra?.duracao === 'rodada') removidas.push({ carta, indice })
    else ficam.push(carta)
  })
  const primeira = primeiraQueJoga(ficam, 0, caidos)
  if (primeira === null) return null
  const fora = new Set(removidas.map(({ carta }) => carta.id))
  const virada: TurnosDaCena = { ...turnos, cartas: ficam, vez: primeira.id, rodada: turnos.rodada + 1, gastos: SEM_GASTOS, extras: semChaves(turnos.extras, fora), d20: semChaves(turnos.d20, fora), empates: semChaves(turnos.empates, fora) }
  return { turnos: aoComecarAVez(virada, turnos.vez, primeira, true), removidas }
}

/** O mestre dá a vez a qualquer carta (até a de quem caiu). Carta que não existe: nada. */
export function darVez(turnos: TurnosDaCena, cartaId: string): TurnosDaCena {
  const para = turnos.cartas.find((carta) => carta.id === cartaId)
  if (turnos.vez === cartaId || para === undefined) return turnos
  return aoComecarAVez({ ...turnos, vez: cartaId, gastos: SEM_GASTOS }, turnos.vez, para, false)
}

/**
 * F2 (seção 2.3 do plano): o que muda quando a vez passa de `de` para `para`.
 * As ações extras "rodada" da carta que SAI somem (e, ao virar a rodada,
 * todas as "rodada"); as recargas do personagem da carta que ENTRA descem 1
 * (no 0 saem). Nada a mudar = os mesmos mapas.
 */
function aoComecarAVez(turnos: TurnosDaCena, de: string | null, para: CartaDaOrdem, virouRodada: boolean): TurnosDaCena {
  const extrasQueSaem = new Set(Object.entries(turnos.extras).filter(([cartaId, extra]) => extra.duracao === 'rodada' && (virouRodada || cartaId === de)).map(([cartaId]) => cartaId))
  const extras = semChaves(turnos.extras, extrasQueSaem)
  const combate = recargasDescendo(turnos.combate, para.personagemId)
  if (extras === turnos.extras && combate === turnos.combate) return turnos
  const novo: TurnosDaCena = { ...turnos, extras }
  if (combate !== undefined) novo.combate = combate
  return novo
}

/** As recargas do personagem menos 1; no 0, a técnica sai da lista. Sem recarga = o mesmo mapa. */
function recargasDescendo(
  combate: TurnosDaCena['combate'],
  personagemId: string | null,
): TurnosDaCena['combate'] {
  if (combate === undefined || personagemId === null) return combate
  const dele = combate[personagemId]
  if (dele === undefined || Object.keys(dele.recargas).length === 0) return combate
  const recargas: Record<string, number> = {}
  for (const [cartaoId, faltam] of Object.entries(dele.recargas)) if (faltam > 1) recargas[cartaoId] = faltam - 1
  return { ...combate, [personagemId]: { ...dele, recargas } }
}

/** O registro sem as chaves de `fora`; nada a tirar = o mesmo objeto. */
function semChaves<T>(registro: Readonly<Record<string, T>>, fora: ReadonlySet<string>): Readonly<Record<string, T>> {
  if (!Object.keys(registro).some((chave) => fora.has(chave))) return registro
  const resto: Record<string, T> = {}
  for (const [chave, valor] of Object.entries(registro)) if (!fora.has(chave)) resto[chave] = valor
  return resto
}

/**
 * Arrastar (ou Alt + seta): a carta vai para `indice` (limitado à ordem). A
 * marca de empate dela sai — o mestre decidiu —, e a do grupo que ficou com
 * uma carta só também.
 */
export function moverCarta(turnos: TurnosDaCena, cartaId: string, indice: number): TurnosDaCena {
  const de = turnos.cartas.findIndex((carta) => carta.id === cartaId)
  const carta = turnos.cartas[de]
  if (carta === undefined) return turnos
  const para = Math.min(turnos.cartas.length - 1, Math.max(0, Math.trunc(indice)))
  if (para === de) return turnos
  const cartas = turnos.cartas.filter((_, i) => i !== de)
  cartas.splice(para, 0, carta)
  return { ...turnos, cartas, empates: semEmpateDe(turnos.empates, cartaId) }
}

function semEmpateDe(empates: Readonly<Record<string, number>>, cartaId: string): Readonly<Record<string, number>> {
  if (!Object.hasOwn(empates, cartaId)) return empates
  const resto = semChaves(empates, new Set([cartaId]))
  const porGrupo = new Map<number, number>()
  for (const grupo of Object.values(resto)) porGrupo.set(grupo, (porGrupo.get(grupo) ?? 0) + 1)
  const sozinhas = new Set(Object.entries(resto).filter(([, grupo]) => porGrupo.get(grupo) === 1).map(([id]) => id))
  return semChaves(resto, sozinhas)
}

/** Põe a carta na ordem em `indice` (ausente = no fim). Carta de mesmo id já na ordem: nada. */
export function inserirCarta(turnos: TurnosDaCena, carta: CartaDaOrdem, indice?: number): TurnosDaCena {
  if (turnos.cartas.some((existente) => existente.id === carta.id)) return turnos
  const onde = indice === undefined ? turnos.cartas.length : Math.min(turnos.cartas.length, Math.max(0, Math.trunc(indice)))
  const cartas = [...turnos.cartas]
  cartas.splice(onde, 0, carta)
  return { ...turnos, cartas }
}

/** "Incluir combatente": a carta do token entra no fim (ou em `indice`). Token já na ordem (sem ser extra): nada. */
export function incluirCombatente(turnos: TurnosDaCena, carta: CartaDaOrdem, indice?: number): TurnosDaCena {
  if (turnos.cartas.some((existente) => existente.tokenId === carta.tokenId && existente.extra === undefined)) return turnos
  return inserirCarta(turnos, carta, indice)
}

/**
 * Tira a carta. Era a vez dela: a vez anda para a carta que ficou no lugar
 * (ou a primeira, se era a última), sem virar a rodada. `null` = não existe.
 */
export function removerCarta(turnos: TurnosDaCena, cartaId: string): { turnos: TurnosDaCena; removida: CartaNoLugar } | null {
  const indice = turnos.cartas.findIndex((carta) => carta.id === cartaId)
  const carta = turnos.cartas[indice]
  if (carta === undefined) return null
  return { turnos: semCartas(turnos, new Set([cartaId])), removida: { carta, indice } }
}

/** "Tirar combatente": todas as cartas do token (a original e as extras), com o lugar de cada uma. */
export function tirarCombatente(turnos: TurnosDaCena, tokenId: string): { turnos: TurnosDaCena; removidas: CartaNoLugar[] } {
  const removidas: CartaNoLugar[] = []
  turnos.cartas.forEach((carta, indice) => {
    if (carta.tokenId === tokenId) removidas.push({ carta, indice })
  })
  if (removidas.length === 0) return { turnos, removidas }
  return { turnos: semCartas(turnos, new Set(removidas.map(({ carta }) => carta.id))), removidas }
}

/** A ordem sem as cartas `fora`; a vez que saiu anda para a primeira que ficou depois dela (ou a primeira de todas). */
function semCartas(turnos: TurnosDaCena, fora: ReadonlySet<string>): TurnosDaCena {
  const cartas = turnos.cartas.filter((carta) => !fora.has(carta.id))
  let vez = turnos.vez
  if (vez !== null && fora.has(vez)) {
    const antes = turnos.cartas.findIndex((carta) => carta.id === vez)
    const depois = turnos.cartas.slice(antes + 1).find((carta) => !fora.has(carta.id))
    vez = (depois ?? cartas[0])?.id ?? null
  }
  return {
    ...turnos,
    cartas,
    vez,
    d20: semChaves(turnos.d20, fora),
    empates: semChaves(turnos.empates, fora),
    extras: semChaves(turnos.extras, fora),
    gastos: semChaves(turnos.gastos, fora),
  }
}

/**
 * "+ Carta extra": outra carta do mesmo token em `indice`, só nesta rodada ou
 * em todas. `null` = o token não está na ordem.
 */
export function adicionarCartaExtra(turnos: TurnosDaCena, tokenId: string, indice: number, duracao: DuracaoDaExtra): { turnos: TurnosDaCena; carta: CartaDaOrdem } | null {
  const original = turnos.cartas.find((carta) => carta.tokenId === tokenId && carta.extra === undefined) ?? turnos.cartas.find((carta) => carta.tokenId === tokenId)
  if (original === undefined) return null
  const carta: CartaDaOrdem = { id: novoIdDeCarta(), tokenId, personagemId: original.personagemId, extra: { duracao, criadaNaRodada: turnos.rodada } }
  if (original.nome !== undefined) carta.nome = original.nome
  return { turnos: inserirCarta(turnos, carta, indice), carta }
}

/** Cartas de fichas que sumiram da cena saem (a vez anda, sem virar a rodada). Nada sumiu = o mesmo objeto. */
export function normalizar(turnos: TurnosDaCena, tokenIdsDaCena: ReadonlySet<string>): TurnosDaCena {
  const fora = new Set(turnos.cartas.filter((carta) => !tokenIdsDaCena.has(carta.tokenId)).map((carta) => carta.id))
  const semAsCartas = fora.size === 0 ? turnos : semCartas(turnos, fora)
  return golpesNaCena(semAsCartas, tokenIdsDaCena)
}

/**
 * F2: golpe cujo atacante sumiu da cena sai; alvo que sumiu sai do golpe (e o
 * golpe sem alvo esperando sai); contra-ataque de ficha que sumiu sai. Nada a
 * tirar = o mesmo objeto.
 */
function golpesNaCena(turnos: TurnosDaCena, tokenIdsDaCena: ReadonlySet<string>): TurnosDaCena {
  const golpes = turnos.golpes ?? []
  const contras = turnos.contras ?? []
  let mudou = false
  const ficam: GolpeDaBatalha[] = []
  for (const golpe of golpes) {
    const alvos = golpe.alvos.filter((alvo) => tokenIdsDaCena.has(alvo.tokenId))
    const esperando = alvos.some((alvo) => alvo.danoFinal === undefined)
    if (!tokenIdsDaCena.has(golpe.atacanteTokenId) || !esperando) {
      mudou = true
      continue
    }
    if (alvos.length !== golpe.alvos.length) mudou = true
    ficam.push(alvos.length === golpe.alvos.length ? golpe : { ...golpe, alvos })
  }
  const contrasQueFicam = contras.filter((contra) => tokenIdsDaCena.has(contra.tokenId))
  if (contrasQueFicam.length !== contras.length) mudou = true
  if (!mudou) return turnos
  return { ...turnos, golpes: ficam, contras: contrasQueFicam }
}
