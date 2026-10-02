import type { Point } from '../pixi/world'
import type { MapData, ModoDaPatrulha, PassoDaPatrulha, Token, TokenPatrol } from '../types/map'
import { andarPeloTrajeto, TENTAR_DE_NOVO_MS, trajetoAte } from './andarPeloCaminho'
import { passosDoPonto, tokenPatrolOf, VELOCIDADE_PADRAO } from './npcPatrol'
import { PASSO_DA_ROTINA_MS, passoEmPx } from './rotinaAndando'

export { adiarEsperas } from './rotinaAndando'
export { TENTAR_DE_NOVO_MS } from './andarPeloCaminho'

/**
 * PATRULHA ANDANDO — "Patrulhar sozinha": ligada, a ficha anda pela própria
 * rota de patrulha (`lib/npcPatrol.ts`) casa a casa, como a rotina andando
 * (`lib/rotinaAndando.ts`), e em cada ponto faz a MACRO dele (esperar, olhar,
 * falar, sumir...) antes de seguir, em circuito (1-2-3-1) ou em vai-e-volta
 * (1-2-3-2-1). Até o mestre tocar "Parar".
 *
 * O trecho até o ponto anda pelo caminho em grade, com a mesma regra da rotina
 * (`lib/andarPeloCaminho.ts`): contorna parede, passa por porta aberta, e sem
 * caminho a ficha NÃO pula — fica onde está e tenta de novo a cada
 * `TENTAR_DE_NOVO_MS`.
 *
 * Diferente da rotina, não depende de aventura nem de estado do mundo: a rota
 * é da ficha, na cena aberta. Por isso o agendador recebe só o MAPA aberto —
 * ficha que saiu dele (removida, cena trocada) para de patrulhar.
 *
 * Aqui só o agendador puro: quem anda, para onde e quando. Aplicar o passo é
 * do editor (`stores/patrulhaAndandoStore.ts`), fora do Ctrl+Z. Quem está
 * andando vive só na memória do editor: o arquivo guarda a rota e a
 * configuração, nunca "ligada" — o mapa reaberto volta com todo mundo parado.
 */

/** O mesmo tique da rotina: emenda no deslize de 240 ms do jogador. */
export const PASSO_DA_PATRULHA_MS = PASSO_DA_ROTINA_MS
/** Parada no ponto de mapa antigo (sem macro): o `PASSO_PADRAO`, em ms. */
export const ESPERA_NO_PONTO_MS = 2000

/** A ficha com a patrulha ligada. */
export interface FichaPatrulhando {
  /** Índice, em `pontos`, do ponto para onde ela anda agora (ou anda ao terminar a macro do ponto). */
  destino: number
  /** No vai-e-volta, para que lado da rota ela segue (1 = rumo ao último). No circuito, sempre 1. */
  sentido: 1 | -1
  /** Parada no ponto (ou à espera de caminho): não anda antes deste instante. */
  esperaAte: number
  /** Os cantos que faltam do trecho atual, o último é o ponto. Ausente: calcular no próximo passo. */
  trajeto?: readonly Point[]
  /** Fazendo a macro do ponto `ponto`: o próximo passo a fazer é `passo`. Ausente: andando. */
  noPonto?: { ponto: number; passo: number }
  /** Parada no passo "Esperar o mestre": só sai com `seguirPatrulha` ("Seguir" no painel). */
  esperandoMestre?: true
  /** Passo "Velocidade": casas/s só neste trecho; ao chegar ao próximo ponto, volta à da rota. */
  velocidadeDoTrecho?: number
}

/** Fichas com a patrulha ligada, por id. */
export type PatrulhasAndando = ReadonlyMap<string, FichaPatrulhando>

/** O que a macro do ponto muda na ficha, além de onde ela está. */
export interface EfeitosDosPassos {
  /** Passo "Olhar": a frente da ficha, em graus (0 = para cima, horário). */
  olhar?: number
  /** Passo "Falar": o texto; `null` cala (ela voltou a andar). */
  fala?: string | null
  /** Passo "Sumir" (`true`) ou "Aparecer" (`false`). */
  sumida?: boolean
}

/** O passo de uma ficha, aplicado ao mapa por `moverPatrulhas`. */
export interface MovimentoDaPatrulha extends EfeitosDosPassos {
  tokenId: string
  x: number
  y: number
  /** Presente quando ela CHEGOU a um ponto: vira o `atual` da rota. */
  atual?: number
}

/**
 * Os passos que a ficha faz ao chegar ao ponto `indice` da `rota`. O padrão lê
 * a macro gravada no ponto (`passosDoPonto`: ponto de mapa antigo vale
 * [Esperar 2 s]); quem chama pode trocar a fonte.
 */
export type PassosDoPonto = (rota: TokenPatrol, indice: number) => readonly PassoDaPatrulha[]

export const passosDaRota: PassosDoPonto = (rota, indice) => {
  const ponto = rota.pontos[indice]
  return ponto === undefined ? [] : passosDoPonto(ponto)
}

/** O ponto depois de `indice` na ordem da ronda, e o sentido em que se segue dele. */
export function proximoPonto(indice: number, sentido: 1 | -1, total: number, modo: ModoDaPatrulha): { indice: number; sentido: 1 | -1 } {
  if (total < 2) return { indice: 0, sentido: 1 }
  if (modo === 'circuito') return { indice: (indice + 1) % total, sentido: 1 }
  const seguinte = indice + sentido
  // Bateu na ponta: volta pelo mesmo caminho.
  if (seguinte < 0 || seguinte >= total) return { indice: indice - sentido, sentido: sentido === 1 ? -1 : 1 }
  return { indice: seguinte, sentido }
}

function modoDa(rota: TokenPatrol): ModoDaPatrulha {
  return rota.modo ?? 'circuito'
}

/** A rota de patrulha andável da ficha `tokenId` no mapa: com 2 pontos ou mais. */
function rotaAndavel(map: MapData, tokenId: string): { x: number; y: number; fala: string | undefined; rota: TokenPatrol } | null {
  const token = map.tokens.find((t) => t.id === tokenId)
  const rota = token === undefined ? null : tokenPatrolOf(token)
  if (token === undefined || rota === null || rota.pontos.length < 2) return null
  return { x: token.x, y: token.y, fala: token.fala, rota }
}

/**
 * Liga a patrulha de `tokenId`. Em cima de um ponto da rota (o atual primeiro),
 * a ficha sai rumo ao seguinte; fora da rota (o mestre a arrastou), volta antes
 * ao ponto onde parou. Sem rota de 2 pontos, ou ficha fora do mapa: não liga.
 */
export function ligarPatrulha(andando: PatrulhasAndando, map: MapData, tokenId: string, now: number): PatrulhasAndando {
  const achada = rotaAndavel(map, tokenId)
  if (achada === null) return andando
  const { rota } = achada
  const emCima = (i: number) => rota.pontos[i]?.x === achada.x && rota.pontos[i]?.y === achada.y
  const aqui = emCima(rota.atual) ? rota.atual : rota.pontos.findIndex((_, i) => emCima(i))
  const rumo = aqui === -1 ? { indice: rota.atual, sentido: 1 as const } : proximoPonto(aqui, 1, rota.pontos.length, modoDa(rota))
  const next = new Map(andando)
  next.set(tokenId, { destino: rumo.indice, sentido: rumo.sentido, esperaAte: now })
  return next
}

export function desligarPatrulha(andando: PatrulhasAndando, tokenId: string): PatrulhasAndando {
  if (!andando.has(tokenId)) return andando
  const next = new Map(andando)
  next.delete(tokenId)
  return next
}

/** "Seguir" do painel: a ficha parada em "Esperar o mestre" faz o resto da macro e segue. Quem não espera: o mesmo mapa. */
export function seguirPatrulha(andando: PatrulhasAndando, tokenId: string, now: number): PatrulhasAndando {
  const ficha = andando.get(tokenId)
  if (ficha?.esperandoMestre !== true) return andando
  const { esperandoMestre: _parou, ...resto } = ficha
  const next = new Map(andando)
  next.set(tokenId, { ...resto, esperaAte: now })
  return next
}

/** Até onde a macro do ponto foi neste tique. */
export interface Execucao {
  efeitos: EfeitosDosPassos
  /** O próximo passo a fazer; `null` = a macro acabou e a ficha segue. */
  proximo: number | null
  esperaAte: number
  esperandoMestre: boolean
  /** Passo "Velocidade" feito neste tique. */
  velocidade?: number
}

/**
 * O EXECUTOR DA MACRO: faz os passos a partir de `desde`, de uma vez, até um
 * que segura a ficha (esperar, esperar o mestre) ou até o fim. Olhar, falar,
 * sumir, aparecer e velocidade não levam tempo: valem no mesmo tique.
 */
export function executarPassos(passos: readonly PassoDaPatrulha[], desde: number, now: number): Execucao {
  const efeitos: EfeitosDosPassos = {}
  let velocidade: number | undefined
  const depois = (i: number) => (i + 1 < passos.length ? i + 1 : null)
  for (let i = desde; i < passos.length; i += 1) {
    const passo = passos[i]
    if (passo === undefined) continue
    switch (passo.tipo) {
      case 'esperar':
        if (passo.segundos > 0) return { efeitos, velocidade, proximo: depois(i), esperaAte: now + passo.segundos * 1000, esperandoMestre: false }
        break
      case 'esperarMestre':
        return { efeitos, velocidade, proximo: depois(i), esperaAte: now, esperandoMestre: true }
      case 'olhar':
        efeitos.olhar = passo.graus
        break
      case 'velocidade':
        velocidade = passo.casas
        break
      case 'falar':
        efeitos.fala = passo.texto === '' ? null : passo.texto
        break
      case 'sumir':
        efeitos.sumida = true
        break
      case 'aparecer':
        efeitos.sumida = false
        break
    }
  }
  return { efeitos, velocidade, proximo: null, esperaAte: now, esperandoMestre: false }
}

/** A ficha depois de um pedaço da macro do ponto `ponto`. */
function depoisDosPassos(ficha: FichaPatrulhando, ponto: number, ex: Execucao): FichaPatrulhando {
  const { noPonto: _antes, esperandoMestre: _parou, velocidadeDoTrecho: _velocidade, ...resto } = ficha
  const velocidadeDoTrecho = ex.velocidade ?? ficha.velocidadeDoTrecho
  return {
    ...resto,
    esperaAte: ex.esperaAte,
    ...(ex.proximo === null ? {} : { noPonto: { ponto, passo: ex.proximo } }),
    ...(ex.esperandoMestre ? { esperandoMestre: true as const } : {}),
    ...(velocidadeDoTrecho === undefined ? {} : { velocidadeDoTrecho }),
  }
}

/** A macro segura a ficha agora (espera ainda correndo, ou o mestre)? */
function segurada(ficha: FichaPatrulhando, now: number): boolean {
  return ficha.esperandoMestre === true || ficha.esperaAte > now
}

function temEfeito(efeitos: EfeitosDosPassos): boolean {
  return efeitos.olhar !== undefined || efeitos.fala !== undefined || efeitos.sumida !== undefined
}

/**
 * Um tique do relógio: para cada ficha com a patrulha ligada, o resto da macro
 * do ponto onde ela está e/ou um passo rumo ao ponto seguinte, na velocidade do
 * trecho, pelo caminho em grade. Ao chegar, o ponto vira o `atual` e a macro
 * dele começa no mesmo tique (`executarPassos`, com os passos de `passosDe`);
 * acabada a macro, ela segue. A fala acaba quando a ficha volta a andar.
 * - sem caminho até o ponto: não anda e procura de novo em `TENTAR_DE_NOVO_MS`;
 * - ficha em `paradas` (um jogador segura, o mestre arrasta), esperando ou à espera do mestre: nada;
 * - ficha que saiu do mapa, perdeu a rota ou ficou com menos de 2 pontos: para.
 */
export function darPassoDaPatrulha(
  map: MapData,
  andando: PatrulhasAndando,
  now: number,
  paradas: ReadonlySet<string> = new Set(),
  passosDe: PassosDoPonto = passosDaRota,
): { movimentos: MovimentoDaPatrulha[]; andando: PatrulhasAndando } {
  const movimentos: MovimentoDaPatrulha[] = []
  const next = new Map<string, FichaPatrulhando>()
  for (const [tokenId, ficha] of andando) {
    const achada = rotaAndavel(map, tokenId)
    if (achada === null) continue
    if (paradas.has(tokenId) || segurada(ficha, now)) {
      next.set(tokenId, ficha)
      continue
    }
    const { rota } = achada
    const aqui = { x: achada.x, y: achada.y }
    let estado = ficha
    let efeitos: EfeitosDosPassos = {}

    // O resto da macro do ponto onde ela está.
    if (estado.noPonto !== undefined) {
      const { ponto, passo } = estado.noPonto
      const ex = executarPassos(passosDe(rota, ponto), passo, now)
      efeitos = { ...efeitos, ...ex.efeitos }
      estado = depoisDosPassos(estado, ponto, ex)
      if (segurada(estado, now)) {
        if (temEfeito(efeitos)) movimentos.push({ tokenId, ...aqui, ...efeitos })
        next.set(tokenId, estado)
        continue
      }
    }

    // Rota encurtada enquanto ela andava ("Tirar último ponto"): o destino volta para dentro.
    const destino = Math.min(estado.destino, rota.pontos.length - 1)
    const ponto = rota.pontos[destino]
    if (ponto === undefined) continue
    const trajeto = trajetoAte(aqui, ponto, estado.trajeto, map)
    if (trajeto === null) {
      // Sem caminho (porta fechada): parada onde está, sem pular, até a próxima tentativa.
      if (temEfeito(efeitos)) movimentos.push({ tokenId, ...aqui, ...efeitos })
      const { trajeto: _velho, ...resto } = estado
      next.set(tokenId, { ...resto, destino, esperaAte: now + TENTAR_DE_NOVO_MS })
      continue
    }
    const velocidade = estado.velocidadeDoTrecho ?? rota.velocidade ?? VELOCIDADE_PADRAO
    const { para, resta } = andarPeloTrajeto(aqui, trajeto, passoEmPx(map.grid, velocidade))
    const chegou = resta.length === 0 && para.x === ponto.x && para.y === ponto.y
    const andou = para.x !== aqui.x || para.y !== aqui.y
    // Voltou a andar: a fala acaba.
    if (andou && (achada.fala !== undefined || efeitos.fala !== undefined)) efeitos = { ...efeitos, fala: null }
    if (!chegou) {
      if (andou || temEfeito(efeitos)) movimentos.push({ tokenId, x: para.x, y: para.y, ...efeitos })
      next.set(tokenId, { ...estado, destino, trajeto: resta })
      continue
    }

    // Chegou: o ponto vira o atual, a velocidade do trecho acaba e a macro dele começa já.
    const seguinte = proximoPonto(destino, estado.sentido, rota.pontos.length, modoDa(rota))
    const ex = executarPassos(passosDe(rota, destino), 0, now)
    efeitos = { ...efeitos, ...ex.efeitos }
    if (andou || rota.atual !== destino || temEfeito(efeitos)) movimentos.push({ tokenId, x: para.x, y: para.y, atual: destino, ...efeitos })
    next.set(tokenId, depoisDosPassos({ destino: seguinte.indice, sentido: seguinte.sentido, esperaAte: now }, destino, ex))
  }
  return { movimentos, andando: next }
}

/** A direção do cone da vigia (0 = leste) para a frente `graus` da ficha (0 = para cima). */
function direcaoDaVigia(graus: number): number {
  return (graus + 270) % 360
}

/** A ficha com os efeitos da macro; a MESMA instância quando nada muda. */
function comEfeitos(token: Token, m: EfeitosDosPassos): Token {
  let t = token
  if (m.olhar !== undefined && t.rotation !== m.olhar) t = { ...t, rotation: m.olhar }
  if (m.olhar !== undefined && t.vigia !== undefined && t.vigia !== null) {
    const direcao = direcaoDaVigia(m.olhar)
    if (t.vigia.direcao !== direcao) t = { ...t, vigia: { ...t.vigia, direcao } }
  }
  if (m.fala === null && 'fala' in t) {
    const { fala: _calou, ...resto } = t
    t = resto
  } else if (typeof m.fala === 'string' && t.fala !== m.fala) {
    t = { ...t, fala: m.fala }
  }
  if (m.sumida === true && t.hidden !== true) {
    t = { ...t, hidden: true }
  } else if (m.sumida === false && 'hidden' in t) {
    const { hidden: _sumida, ...resto } = t
    t = resto
  }
  return t
}

/**
 * Os passos aplicados a um mapa: a ficha no lugar novo, na chegada o ponto como
 * `atual` da rota, e o que a macro mudou nela (frente, cone da vigia, fala,
 * oculta). Pura e reaplicável a qualquer versão do mapa (é o `transform` de
 * `applyPlayerChange`, que a repassa ao histórico): ponto que não existe naquela
 * versão não vira `atual`. Mesmo mapa quando nada muda.
 */
export function moverPatrulhas(map: MapData, movimentos: readonly MovimentoDaPatrulha[]): MapData {
  if (movimentos.length === 0) return map
  const porFicha = new Map(movimentos.map((m): [string, MovimentoDaPatrulha] => [m.tokenId, m]))
  let mudou = false
  const tokens = map.tokens.map((token) => {
    const m = porFicha.get(token.id)
    if (m === undefined) return token
    const rota = token.patrulha
    const novoAtual = m.atual !== undefined && rota !== undefined && m.atual < rota.pontos.length && m.atual !== rota.atual ? m.atual : undefined
    let t = comEfeitos(token, m)
    if (t.x !== m.x || t.y !== m.y) t = { ...t, x: m.x, y: m.y }
    if (novoAtual !== undefined && rota !== undefined) t = { ...t, patrulha: { ...rota, atual: novoAtual } }
    if (t !== token) mudou = true
    return t
  })
  return mudou ? { ...map, tokens } : map
}

/** A ficha `tokenId` sem a fala ("Parar" no meio de um "Falar"); o MESMO mapa se ela já estava calada. */
export function calarFicha(map: MapData, tokenId: string): MapData {
  const index = map.tokens.findIndex((t) => t.id === tokenId)
  const token = map.tokens[index]
  if (token === undefined || !('fala' in token)) return map
  const tokens = [...map.tokens]
  tokens[index] = comEfeitos(token, { fala: null })
  return { ...map, tokens }
}
