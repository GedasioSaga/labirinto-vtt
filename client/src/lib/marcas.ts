import type { MapData, MarcaNoLugar, MarcaRumo, RegionPoint, Token } from '../types/map'
import { tokenRadiusOf } from './doorReach'

/**
 * BILHETE NO LUGAR — o jogador crava um bilhete curto ou risca uma seta de giz
 * no ponto onde a ficha dele está, e quem passar ali depois vê. Aqui ficam as
 * peças puras que o host (`net/hostSession.ts`), o recorte
 * (`lib/fogFilter.ts`), o arquivo (`lib/mapFile.ts`) e as duas telas dividem:
 * mesmo teto, mesmo alcance e mesma forma nos quatro lugares.
 */

/** Teto do bilhete, em unidades UTF-16 (o `maxLength` do campo do jogador conta igual). */
export const MARCA_TEXTO_MAX = 80
/** Folga além da borda da ficha, em células: a marca vai "onde a ficha está", não longe dela. */
export const MARCA_ALCANCE_CASAS = 1
/** Quantas marcas cada jogador deixa numa cena. Passou, o host recusa (`full`) até o mestre apagar alguma. */
export const MARCAS_POR_JOGADOR_POR_CENA = 30
/** Teto da cena inteira, somando todos: o map.json não cresce sem limite numa aventura longa. */
export const MARCAS_POR_CENA = 200
/** Uma marca por jogador nesta janela; a que vem cedo demais volta `too_soon`. */
export const MARCA_INTERVALO_MS = 1000

/** Os 8 rumos, na ordem da rosa (começa no norte, gira no sentido horário). */
export const MARCA_RUMOS: readonly MarcaRumo[] = ['n', 'ne', 'l', 'se', 's', 'so', 'o', 'no']

/** Nome do rumo como o jogador lê ("Seta para o nordeste"). */
export const RUMO_NOME: Readonly<Record<MarcaRumo, string>> = {
  n: 'norte',
  ne: 'nordeste',
  l: 'leste',
  se: 'sudeste',
  s: 'sul',
  so: 'sudoeste',
  o: 'oeste',
  no: 'noroeste',
}

/** Ângulo de desenho em graus, no sentido da tela (y para baixo): leste = 0, sul = 90. */
export const RUMO_GRAUS: Readonly<Record<MarcaRumo, number>> = {
  l: 0,
  se: 45,
  s: 90,
  so: 135,
  o: 180,
  no: 225,
  n: 270,
  ne: 315,
}

export function isMarcaRumo(value: unknown): value is MarcaRumo {
  return typeof value === 'string' && MARCA_RUMOS.some((rumo) => rumo === value)
}

/** Caractere de controle que sobra depois de juntar os espaços (NUL, BEL, DEL…): some. */
const CONTROLE = /[\u0000-\u001f\u007f]/g

/**
 * O bilhete como o jogador quis dizer: espaços e quebras de linha viram um
 * espaço só (é uma linha no cartão), controle some e as pontas saem. Não corta
 * no teto: quem valida (`net/protocol.ts`) recusa o que passar, em vez de
 * gravar meio recado.
 */
export function normalizarTextoDaMarca(texto: string): string {
  return texto.replace(/\s+/g, ' ').replace(CONTROLE, '').trim()
}

/**
 * Normaliza e corta no teto sem deixar meia letra no fim (emoji partido ao
 * meio vira losango de erro). É o que o arquivo usa para marca gravada à mão.
 */
export function limparTextoDaMarca(texto: string): string {
  const limpo = normalizarTextoDaMarca(texto)
  if (limpo.length <= MARCA_TEXTO_MAX) return limpo
  const corte = limpo.slice(0, MARCA_TEXTO_MAX)
  const ultimo = corte.charCodeAt(corte.length - 1)
  return (ultimo >= 0xd800 && ultimo <= 0xdbff ? corte.slice(0, -1) : corte).trimEnd()
}

/**
 * A marca como o JOGADOR pode recebê-la. LISTA DO QUE VAI: autor, hora e
 * qualquer campo que o arquivo trouxer e o app não conheça ficam para trás.
 */
export function marcaParaJogador(marca: MarcaNoLugar): MarcaNoLugar {
  const base: MarcaNoLugar = { id: marca.id, tipo: marca.tipo, x: marca.x, y: marca.y }
  if (marca.tipo === 'bilhete' && marca.texto !== undefined) return { ...base, texto: marca.texto }
  if (marca.tipo === 'seta' && marca.rumo !== undefined) return { ...base, rumo: marca.rumo }
  return base
}

/** Põe a marca no fim da lista. Id que já está no mapa devolve o mesmo mapa (reaplicar não duplica). */
export function adicionarMarca(map: MapData, marca: MarcaNoLugar): MapData {
  const marcas = map.marcas ?? []
  if (marcas.some((m) => m.id === marca.id)) return map
  return { ...map, marcas: [...marcas, marca] }
}

/** Tira a marca `id`. Sem ela no mapa, devolve o mesmo mapa. */
export function apagarMarca(map: MapData, id: string): MapData {
  const marcas = map.marcas ?? []
  if (!marcas.some((m) => m.id === id)) return map
  return { ...map, marcas: marcas.filter((m) => m.id !== id) }
}

/** O ponto está a até `MARCA_ALCANCE_CASAS` célula da borda da ficha. */
export function fichaAlcancaPonto(ficha: Pick<Token, 'x' | 'y' | 'size'>, ponto: RegionPoint, grid: number): boolean {
  const alcance = tokenRadiusOf(ficha, grid) + grid * MARCA_ALCANCE_CASAS
  return Math.hypot(ponto.x - ficha.x, ponto.y - ficha.y) <= alcance
}

/** O bilhete mais perto do ponto, dentro de `folga` (px de mundo). A seta não tem o que ler: nunca é achada. */
export function acharBilheteEm(marcas: readonly MarcaNoLugar[], ponto: RegionPoint, folga: number): MarcaNoLugar | null {
  let melhor: MarcaNoLugar | null = null
  let melhorDistancia = Number.POSITIVE_INFINITY
  for (const marca of marcas) {
    if (marca.tipo !== 'bilhete') continue
    const distancia = Math.hypot(ponto.x - marca.x, ponto.y - marca.y)
    if (distancia <= folga && distancia < melhorDistancia) {
      melhor = marca
      melhorDistancia = distancia
    }
  }
  return melhor
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** Uma marca do arquivo, conferida campo a campo; fora da forma, `null`. */
function lerMarca(value: unknown): MarcaNoLugar | null {
  if (!isRecord(value)) return null
  const { id, tipo, x, y, texto, rumo, autor, em } = value
  if (typeof id !== 'string' || id.length === 0 || !isFiniteNumber(x) || !isFiniteNumber(y)) return null
  let marca: MarcaNoLugar
  if (tipo === 'bilhete') {
    if (typeof texto !== 'string') return null
    const limpo = limparTextoDaMarca(texto)
    if (limpo.length === 0) return null
    marca = { id, tipo, x, y, texto: limpo }
  } else if (tipo === 'seta') {
    if (!isMarcaRumo(rumo)) return null
    marca = { id, tipo, x, y, rumo }
  } else {
    return null
  }
  if (typeof autor === 'string') marca.autor = autor
  if (isFiniteNumber(em)) marca.em = em
  return marca
}

/**
 * As marcas como voltam do disco. Ausente continua ausente (o round-trip de
 * mapa antigo não inventa o campo); marca torta cai sozinha e as boas ficam —
 * mesma regra das saídas extras do pino (`readPinExits`).
 */
export function lerMarcasDoArquivo(value: unknown): MarcaNoLugar[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const marca = lerMarca(item)
    return marca === null ? [] : [marca]
  })
}
