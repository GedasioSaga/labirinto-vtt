import type { MapData, ModoDaPatrulha, PassoDaPatrulha, PontoDaPatrulha, Token, TokenPatrol } from '../types/map'

/**
 * ROTA DE PATRULHA — regras compartilhadas pelo painel do mestre, pelo desenho
 * da rota no editor e pelo recorte do jogador. Puro: sem DOM, sem Pixi, sem store.
 *
 * O mestre marca a rota pondo a ficha do NPC em cima de cada ponto e clicando
 * "Marcar ponto aqui". "Avançar patrulha" leva o NPC ao ponto seguinte ao
 * último alcançado; do último volta ao primeiro (ronda em circuito). O passo é
 * a decisão do mestre sobre onde o NPC está: não pergunta à parede, igual a
 * quando ele arrasta a ficha segurando a regra de movimento de lado.
 */

/** Teto de pontos numa rota: ronda de verdade tem poucos; o teto segura arquivo torto. */
export const PATROL_MAX_POINTS = 64

/** Patrulha automática: duas casas por segundo, o passo da rotina — gente andando, sem correr. */
export const VELOCIDADE_PADRAO = 2
/** Mais devagar que isto a ficha parece parada entre um deslize e outro. */
export const VELOCIDADE_MINIMA = 0.5
/** Mais rápido que isto o passo de um tique passa de casa e meia: o jogador vê pulo, não andar. */
export const VELOCIDADE_MAXIMA = 8

/** O que o painel muda na ronda automática. */
export interface ConfigDaPatrulha {
  velocidade?: number
  modo?: ModoDaPatrulha
}

/** O que o painel pede à rota da ficha. */
export type PatrolOp = 'marcar' | 'desfazer' | 'apagar' | 'avancar'

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** Teto de passos na macro de um ponto: ronda tem poucos; o teto segura arquivo torto. */
export const PASSOS_MAX_POR_PONTO = 32
/** Espera mais longa de um passo: dez minutos — para mais, o mestre usa "Esperar o mestre". */
export const ESPERA_MAXIMA_S = 600
/** Teto da fala de um passo: cabe num balão sobre a ficha. */
export const FALA_MAX_LETRAS = 140
/** O passo de quem não disse nada: ponto novo e ponto de mapa antigo esperam 2 s, como antes da macro. */
export const PASSO_PADRAO: PassoDaPatrulha = { tipo: 'esperar', segundos: 2 }

/** Graus no giro de 0 a 360 (sem o 360): 450 → 90, −90 → 270. */
function grausNoGiro(graus: number): number {
  const g = graus % 360
  return g < 0 ? g + 360 : g === 0 ? 0 : g
}

/** Um passo como vale para executar, ou `null` (passo torto some). */
export function readPasso(raw: unknown): PassoDaPatrulha | null {
  if (typeof raw !== 'object' || raw === null) return null
  const tipo: unknown = Reflect.get(raw, 'tipo')
  switch (tipo) {
    case 'esperar': {
      const segundos: unknown = Reflect.get(raw, 'segundos')
      return finite(segundos) ? { tipo, segundos: Math.min(ESPERA_MAXIMA_S, Math.max(0, segundos)) } : null
    }
    case 'olhar': {
      const graus: unknown = Reflect.get(raw, 'graus')
      return finite(graus) ? { tipo, graus: grausNoGiro(graus) } : null
    }
    case 'velocidade': {
      const casas: unknown = Reflect.get(raw, 'casas')
      return finite(casas) ? { tipo, casas: velocidadeNaFaixa(casas) } : null
    }
    case 'falar': {
      const texto: unknown = Reflect.get(raw, 'texto')
      return typeof texto === 'string' ? { tipo, texto: texto.slice(0, FALA_MAX_LETRAS) } : null
    }
    case 'sumir':
    case 'aparecer':
    case 'esperarMestre':
      return { tipo }
    default:
      return null
  }
}

function readPassos(raw: unknown[]): PassoDaPatrulha[] {
  return raw
    .flatMap((p: unknown) => {
      const passo = readPasso(p)
      return passo === null ? [] : [passo]
    })
    .slice(0, PASSOS_MAX_POR_PONTO)
}

function readPoint(raw: unknown): PontoDaPatrulha | null {
  if (typeof raw !== 'object' || raw === null) return null
  const x: unknown = Reflect.get(raw, 'x')
  const y: unknown = Reflect.get(raw, 'y')
  if (!finite(x) || !finite(y)) return null
  // Sem lista (mapa antigo), sem o campo: o ponto relido fica como estava.
  const passos: unknown = Reflect.get(raw, 'passos')
  return Array.isArray(passos) ? { x, y, passos: readPassos(passos) } : { x, y }
}

/** O que a ficha faz ao chegar ao ponto: os passos dele, ou [Esperar 2 s] no ponto sem lista (mapa antigo). */
export function passosDoPonto(ponto: PontoDaPatrulha): readonly PassoDaPatrulha[] {
  return ponto.passos ?? [PASSO_PADRAO]
}

/**
 * A rota como vale para andar e desenhar. O mapa do disco chega cru
 * (`lib/mapFile.ts`): ponto torto sai, `atual` fora da faixa volta para dentro,
 * e texto enfiado no objeto fica de fora. Sem ponto válido, `null` (ficha comum).
 */
export function readTokenPatrol(raw: unknown): TokenPatrol | null {
  if (typeof raw !== 'object' || raw === null) return null
  const rawPoints: unknown = Reflect.get(raw, 'pontos')
  if (!Array.isArray(rawPoints)) return null
  const pontos = rawPoints.flatMap((p: unknown) => {
    const point = readPoint(p)
    return point === null ? [] : [point]
  }).slice(0, PATROL_MAX_POINTS)
  if (pontos.length === 0) return null
  const rawAtual: unknown = Reflect.get(raw, 'atual')
  const atual = finite(rawAtual) ? Math.min(pontos.length - 1, Math.max(0, Math.round(rawAtual))) : 0
  const rawVelocidade: unknown = Reflect.get(raw, 'velocidade')
  const rawModo: unknown = Reflect.get(raw, 'modo')
  // Configuração ausente fica ausente: mapa antigo relido não ganha campo novo.
  return {
    pontos,
    atual,
    ...(finite(rawVelocidade) ? { velocidade: velocidadeNaFaixa(rawVelocidade) } : {}),
    ...(rawModo === 'circuito' || rawModo === 'vai-e-volta' ? { modo: rawModo } : {}),
  }
}

/** Velocidade presa à faixa que o passo de 200 ms aguenta. */
function velocidadeNaFaixa(velocidade: number): number {
  return Math.min(VELOCIDADE_MAXIMA, Math.max(VELOCIDADE_MINIMA, velocidade))
}

/** A rota de uma ficha, ou `null` se ela não patrulha. */
export function tokenPatrolOf(token: { patrulha?: unknown }): TokenPatrol | null {
  return readTokenPatrol(token.patrulha)
}

/** A ficha com a rota trocada; `null` tira o campo (a ficha volta a ser comum, sem `patrulha: null` gravado). */
function withPatrol(token: Token, patrol: TokenPatrol | null): Token {
  if (patrol !== null) return { ...token, patrulha: patrol }
  const { patrulha: _rota, ...rest } = token
  return rest
}

/** A ficha depois da operação, ou a MESMA instância quando nada muda. */
function tokenAfterOp(token: Token, op: PatrolOp): Token {
  const patrol = tokenPatrolOf(token)
  switch (op) {
    case 'marcar': {
      const pontos = patrol?.pontos ?? []
      if (pontos.length >= PATROL_MAX_POINTS) return token
      // A configuração da ronda automática (velocidade, modo) fica com a rota.
      // O ponto novo nasce com a macro de sempre: espera 2 s e segue.
      return withPatrol(token, { ...patrol, pontos: [...pontos, { x: token.x, y: token.y, passos: [PASSO_PADRAO] }], atual: pontos.length })
    }
    case 'desfazer': {
      if (patrol === null) return token
      const pontos = patrol.pontos.slice(0, -1)
      return withPatrol(token, pontos.length === 0 ? null : { ...patrol, pontos, atual: Math.min(patrol.atual, pontos.length - 1) })
    }
    case 'apagar':
      return 'patrulha' in token ? withPatrol(token, null) : token
    case 'avancar': {
      if (patrol === null || patrol.pontos.length < 2) return token
      const atual = (patrol.atual + 1) % patrol.pontos.length
      const destino = patrol.pontos[atual]
      if (destino === undefined) return token
      return { ...withPatrol(token, { ...patrol, atual }), x: destino.x, y: destino.y }
    }
  }
}

/**
 * Aplica `op` à rota da ficha `tokenId`. Devolve o mapa pela MESMA referência
 * quando nada muda (ficha que não existe, sem rota para andar, rota cheia) —
 * é o que deixa o store não gastar entrada de histórico à toa.
 */
export function applyPatrolOp(map: MapData, tokenId: string, op: PatrolOp): MapData {
  const index = map.tokens.findIndex((t) => t.id === tokenId)
  const token = map.tokens[index]
  if (token === undefined) return map
  const next = tokenAfterOp(token, op)
  if (next === token) return map
  const tokens = [...map.tokens]
  tokens[index] = next
  return { ...map, tokens }
}

/**
 * Troca velocidade e/ou modo da ronda automática da ficha `tokenId`. Devolve
 * o mapa pela MESMA referência quando nada muda (ficha sem rota, valor igual):
 * o store não gasta entrada de histórico à toa.
 */
export function setPatrolConfig(map: MapData, tokenId: string, config: ConfigDaPatrulha): MapData {
  const index = map.tokens.findIndex((t) => t.id === tokenId)
  const token = map.tokens[index]
  const patrol = token === undefined ? null : tokenPatrolOf(token)
  if (token === undefined || patrol === null) return map
  const velocidade = config.velocidade === undefined || !finite(config.velocidade) ? patrol.velocidade : velocidadeNaFaixa(config.velocidade)
  const modo = config.modo ?? patrol.modo
  if (velocidade === patrol.velocidade && modo === patrol.modo) return map
  const next: TokenPatrol = { ...patrol, ...(velocidade === undefined ? {} : { velocidade }), ...(modo === undefined ? {} : { modo }) }
  const tokens = [...map.tokens]
  tokens[index] = withPatrol(token, next)
  return { ...map, tokens }
}

/**
 * Troca a macro do ponto `indice` da rota da ficha `tokenId` (o painel monta a
 * lista; a leitura é a mesma do disco: passo torto some, valores na faixa).
 * Devolve o mapa pela MESMA referência quando nada muda (mesma lista, ponto
 * que não existe, ficha sem rota): o store não gasta entrada de histórico à toa.
 */
export function setPassosDoPonto(map: MapData, tokenId: string, indice: number, passos: readonly PassoDaPatrulha[]): MapData {
  const index = map.tokens.findIndex((t) => t.id === tokenId)
  const token = map.tokens[index]
  const patrol = token === undefined ? null : tokenPatrolOf(token)
  const ponto = patrol?.pontos[indice]
  if (token === undefined || patrol === null || ponto === undefined) return map
  const lidos = readPassos([...passos])
  if (ponto.passos !== undefined && JSON.stringify(ponto.passos) === JSON.stringify(lidos)) return map
  const pontos = patrol.pontos.map((p, i) => (i === indice ? { x: p.x, y: p.y, passos: lidos } : p))
  const tokens = [...map.tokens]
  tokens[index] = withPatrol(token, { ...patrol, pontos })
  return { ...map, tokens }
}
