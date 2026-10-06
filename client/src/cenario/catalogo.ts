/**
 * ANIMAÇÃO DO CENÁRIO — a animação 2D sobre a imagem do pino "!" (panorâmica
 * com névoa, raios e partículas). O mestre escolhe no painel do pino; o
 * jogador vê ao abrir o cartão. Este arquivo é só dado e validação: o disco, a
 * rede e o editor leem daqui sem montar nada de tela.
 */

export const MOVIMENTO_IDS = ['sobe', 'desce', 'direita', 'esquerda', 'aproxima'] as const
export type MovimentoId = (typeof MOVIMENTO_IDS)[number]

export interface Enquadramento {
  /** 1 = a foto inteira no quadro; maior = mais perto. */
  zoom: number
  /** Ponto da foto que fica no centro do quadro, de 0 a 1 em cada eixo. */
  x: number
  y: number
}

export interface MovimentoInfo {
  id: MovimentoId
  nome: string
  inicio: Enquadramento
  fim: Enquadramento
}

/** Perto o bastante para a câmera ter por onde andar, sem esfarelar a foto. */
const PERTO = 1.5

export const MOVIMENTOS: readonly MovimentoInfo[] = [
  { id: 'sobe', nome: 'De baixo para cima', inicio: { zoom: PERTO, x: 0.5, y: 1 }, fim: { zoom: 1, x: 0.5, y: 0.5 } },
  { id: 'desce', nome: 'De cima para baixo', inicio: { zoom: PERTO, x: 0.5, y: 0 }, fim: { zoom: 1, x: 0.5, y: 0.5 } },
  { id: 'direita', nome: 'Da esquerda para a direita', inicio: { zoom: PERTO, x: 0, y: 0.5 }, fim: { zoom: 1, x: 0.5, y: 0.5 } },
  { id: 'esquerda', nome: 'Da direita para a esquerda', inicio: { zoom: PERTO, x: 1, y: 0.5 }, fim: { zoom: 1, x: 0.5, y: 0.5 } },
  { id: 'aproxima', nome: 'Aproximar', inicio: { zoom: 1, x: 0.5, y: 0.5 }, fim: { zoom: 1.35, x: 0.5, y: 0.45 } },
]

/** Duração da animação inteira quando o mestre não escolhe outra. */
export const CENARIO_DURACAO_NATURAL_S = 12
export const CENARIO_DURACAO_MIN_S = 3
export const CENARIO_DURACAO_MAX_S = 40

export type QuandoToca = 'primeira' | 'sempre'

/** O que fica gravado no pino "!". Ausente = o cartão de sempre, sem animação. */
export interface CenarioDoPino {
  quando: QuandoToca
  movimento: MovimentoId
  /** Ausente = a duração natural. */
  duracaoS?: number
  nevoa: boolean
  raios: boolean
  particulas: boolean
  som: boolean
}

/** O que o mestre ganha ao ligar a animação: o movimento da fortaleza, com tudo ligado. */
export const CENARIO_PADRAO: CenarioDoPino = { quando: 'primeira', movimento: 'sobe', nevoa: true, raios: true, particulas: true, som: true }

export function isMovimentoId(valor: unknown): valor is MovimentoId {
  return typeof valor === 'string' && (MOVIMENTO_IDS as readonly string[]).includes(valor)
}

export function movimentoInfo(id: MovimentoId): MovimentoInfo {
  const info = MOVIMENTOS.find((m) => m.id === id)
  if (!info) throw new Error(`movimento desconhecido: ${id}`)
  return info
}

export function isDuracaoDeCenario(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor) && valor >= CENARIO_DURACAO_MIN_S && valor <= CENARIO_DURACAO_MAX_S
}

/**
 * Lê a animação vinda do disco ou da rede. Sem `quando` ou `movimento` válidos
 * = sem animação; duração fora do teto cai e fica a natural; efeito que não é
 * booleano vale desligado (na dúvida, menos coisa na tela do jogador).
 */
export function parseCenario(valor: unknown): CenarioDoPino | undefined {
  if (typeof valor !== 'object' || valor === null) return undefined
  const v = valor as Record<string, unknown>
  if ((v.quando !== 'primeira' && v.quando !== 'sempre') || !isMovimentoId(v.movimento)) return undefined
  const lido: CenarioDoPino = {
    quando: v.quando,
    movimento: v.movimento,
    nevoa: v.nevoa === true,
    raios: v.raios === true,
    particulas: v.particulas === true,
    som: v.som === true,
  }
  if (isDuracaoDeCenario(v.duracaoS)) lido.duracaoS = v.duracaoS
  return lido
}

export function sameCenario(a: CenarioDoPino | undefined, b: CenarioDoPino | undefined): boolean {
  if (a === undefined || b === undefined) return a === b
  return (
    a.quando === b.quando &&
    a.movimento === b.movimento &&
    a.duracaoS === b.duracaoS &&
    a.nevoa === b.nevoa &&
    a.raios === b.raios &&
    a.particulas === b.particulas &&
    a.som === b.som
  )
}

export function duracaoDoCenarioS(cenario: CenarioDoPino): number {
  return cenario.duracaoS ?? CENARIO_DURACAO_NATURAL_S
}
