import type { Agua, CorProntaDaAgua, MapData, RegionPoint, TipoDeAgua } from '../../types/map'
import { pisoLido } from '../pisos'

/**
 * ÁGUA (pedido de 12/11/2026, protótipo aprovado `docs/design/agua/`): o dado
 * de cada rio, lago e mar, as cores prontas e a leitura do arquivo. Nada aqui
 * desenha: o campo é `campo.ts`, o desenho `pixi/aguaDoMapa.ts`.
 */

/** As cores prontas, no estilo do mapa (Meio-Termo): contidas, nunca neon. A base é o meio da profundidade. */
export const CORES_DA_AGUA: readonly { id: CorProntaDaAgua; nome: string; cor: string }[] = [
  { id: 'rio', nome: 'Azul de rio', cor: '#4b87a8' },
  { id: 'mar', nome: 'Azul de mar fundo', cor: '#2d5f8c' },
  { id: 'verde', nome: 'Verde-mar', cor: '#3f8a78' },
  { id: 'turquesa', nome: 'Turquesa', cor: '#45a09c' },
  { id: 'pantano', nome: 'Água de pântano', cor: '#5d6b45' },
  { id: 'barrenta', nome: 'Água barrenta', cor: '#8a7454' },
]

export const NOME_DO_TIPO_DE_AGUA: Record<TipoDeAgua, string> = { rio: 'Rio', lago: 'Lago', mar: 'Mar' }

/** A cor pronta com que cada tipo nasce. */
export const COR_PRONTA_DO_TIPO: Record<TipoDeAgua, CorProntaDaAgua> = { rio: 'rio', lago: 'rio', mar: 'mar' }

export const LARGURA_DO_RIO = { min: 0.5, max: 6, padrao: 2 } as const
export const AJUSTE_PADRAO = { velocidade: 45, ondas: 50, espuma: 60 } as const

/** Teto de águas por mapa e de pontos por água: o arquivo torto não vira campo gigante. */
export const AGUAS_MAX = 200
export const PONTOS_MAX = 2000

const TIPOS: readonly TipoDeAgua[] = ['rio', 'lago', 'mar']
const COR_HEX = /^#[0-9a-f]{6}$/i

export function corProntaDaAgua(id: CorProntaDaAgua): string {
  return CORES_DA_AGUA.find((c) => c.id === id)?.cor ?? CORES_DA_AGUA[0].cor
}

/** A largura do rio em casas, grampeada; ausente = 2. */
export function larguraDoRio(agua: Pick<Agua, 'largura'>): number {
  const v = agua.largura ?? LARGURA_DO_RIO.padrao
  return Math.min(LARGURA_DO_RIO.max, Math.max(LARGURA_DO_RIO.min, v))
}

/** Os três ajustes, de 0 a 1. */
export function ajustesDaAgua(agua: Pick<Agua, 'velocidade' | 'ondas' | 'espuma'>): { velocidade: number; ondas: number; espuma: number } {
  const umDe = (v: number | undefined, padrao: number) => Math.min(100, Math.max(0, v ?? padrao)) / 100
  return {
    velocidade: umDe(agua.velocidade, AJUSTE_PADRAO.velocidade),
    ondas: umDe(agua.ondas, AJUSTE_PADRAO.ondas),
    espuma: umDe(agua.espuma, AJUSTE_PADRAO.espuma),
  }
}

/** O nome que aparece no painel: o do mestre, ou "Rio 2", "Lago 1"... pela ordem no mapa. */
export function nomeDaAgua(agua: Agua, todas: readonly Agua[]): string {
  if (agua.nome !== undefined && agua.nome.trim() !== '') return agua.nome
  const doTipo = todas.filter((a) => a.tipo === agua.tipo)
  const i = doTipo.findIndex((a) => a.id === agua.id)
  return `${NOME_DO_TIPO_DE_AGUA[agua.tipo]} ${i < 0 ? doTipo.length + 1 : i + 1}`
}

/** O mapa com esta lista de águas; vazia tira o campo (o mapa volta a ser o de antes). */
export function comAguas(map: MapData, aguas: Agua[]): MapData {
  if (aguas.length === 0) {
    if (map.aguas === undefined) return map
    const { aguas: _fora, ...resto } = map
    return resto
  }
  return { ...map, aguas }
}

/** A água sem os campos opcionais que a mudança deixou `undefined` (o arquivo não guarda chave vazia). */
export function semCamposVazios(agua: Agua): Agua {
  const limpa: Agua = { id: agua.id, tipo: agua.tipo, pontos: agua.pontos, cor: agua.cor }
  if (agua.corPronta !== undefined) limpa.corPronta = agua.corPronta
  if (agua.tipo === 'rio' && agua.largura !== undefined) limpa.largura = agua.largura
  if (agua.barra === true) limpa.barra = true
  if (agua.velocidade !== undefined) limpa.velocidade = agua.velocidade
  if (agua.ondas !== undefined) limpa.ondas = agua.ondas
  if (agua.espuma !== undefined) limpa.espuma = agua.espuma
  if (agua.nome !== undefined && agua.nome.trim() !== '') limpa.nome = agua.nome
  if (agua.secret === true) limpa.secret = true
  if (agua.piso !== undefined) limpa.piso = agua.piso
  return limpa
}

/** Menor número de pontos de controle que forma cada tipo. */
export function pontosMinimos(tipo: TipoDeAgua): number {
  return tipo === 'rio' ? 2 : 3
}

// ---------- leitura do arquivo ----------

function lerPonto(raw: unknown): RegionPoint | null {
  if (typeof raw !== 'object' || raw === null) return null
  const { x, y } = raw as { x?: unknown; y?: unknown }
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return null
  return { x, y }
}

function numeroEntre(raw: unknown, min: number, max: number): number | undefined {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined
  return Math.min(max, Math.max(min, raw))
}

/** Uma água do arquivo, ou `null` (tipo fora da lista, cor torta, pontos de menos). O que é opcional e torto sai. */
export function lerAgua(raw: unknown): Agua | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (typeof r.id !== 'string' || r.id === '') return null
  if (typeof r.tipo !== 'string' || !TIPOS.includes(r.tipo as TipoDeAgua)) return null
  const tipo = r.tipo as TipoDeAgua
  if (typeof r.cor !== 'string' || !COR_HEX.test(r.cor)) return null
  if (!Array.isArray(r.pontos)) return null
  const pontos: RegionPoint[] = []
  for (const p of r.pontos.slice(0, PONTOS_MAX)) {
    const ponto = lerPonto(p)
    if (ponto !== null) pontos.push(ponto)
  }
  if (pontos.length < pontosMinimos(tipo)) return null
  const agua: Agua = { id: r.id, tipo, pontos, cor: r.cor.toLowerCase() }
  if (typeof r.corPronta === 'string' && CORES_DA_AGUA.some((c) => c.id === r.corPronta)) agua.corPronta = r.corPronta as CorProntaDaAgua
  const largura = numeroEntre(r.largura, LARGURA_DO_RIO.min, LARGURA_DO_RIO.max)
  if (tipo === 'rio' && largura !== undefined) agua.largura = largura
  if (r.barra === true) agua.barra = true
  const velocidade = numeroEntre(r.velocidade, 0, 100)
  if (velocidade !== undefined) agua.velocidade = velocidade
  const ondas = numeroEntre(r.ondas, 0, 100)
  if (ondas !== undefined) agua.ondas = ondas
  const espuma = numeroEntre(r.espuma, 0, 100)
  if (espuma !== undefined) agua.espuma = espuma
  if (typeof r.nome === 'string' && r.nome.trim() !== '') agua.nome = r.nome.slice(0, 80)
  if (r.secret === true) agua.secret = true
  return { ...agua, ...pisoLido(r) }
}

/** A lista do arquivo: água torta sai; vazia (ou ausente) abre sem o campo. O `recorte` nunca vem do arquivo. */
export function aguasDoArquivo(raw: unknown): Pick<MapData, 'aguas'> {
  if (!Array.isArray(raw)) return {}
  const aguas: Agua[] = []
  const vistos = new Set<string>()
  for (const item of raw.slice(0, AGUAS_MAX)) {
    const agua = lerAgua(item)
    if (agua === null || vistos.has(agua.id)) continue
    vistos.add(agua.id)
    aguas.push(agua)
  }
  return aguas.length === 0 ? {} : { aguas }
}
