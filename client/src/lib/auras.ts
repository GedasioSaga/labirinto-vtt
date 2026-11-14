import type { MapData, Token } from '../types/map'

/**
 * AURA DA FICHA (pedido de 14/11/2026): o efeito em volta do disco. O MESTRE
 * escolhe a aura de qualquer ficha (botão direito, "Aura ›"); o JOGADOR só
 * liga e desliga a da própria ficha. Aqui ficam o dado e as regras puras; o
 * desenho no mapa é de `pixi/auras/`.
 */
export type TipoDeAura =
  | 'almas-roxas'
  | 'chamas-negras'
  | 'fogo-raios-roxos'
  | 'fogo'
  | 'trevas'
  | 'eletrica-amarela'
  | 'eletrica-azul'
  | 'vermelha'
  | 'multicolorida'

/** A aura gravada na ficha: qual é, e se está acesa agora. */
export interface AuraDaFicha {
  tipo: TipoDeAura
  ligada: boolean
}

/** As auras na ordem do menu, com o nome que o mestre lê. */
export const AURAS: readonly { tipo: TipoDeAura; nome: string }[] = [
  { tipo: 'almas-roxas', nome: 'Almas roxas' },
  { tipo: 'chamas-negras', nome: 'Chamas negras' },
  { tipo: 'fogo-raios-roxos', nome: 'Fogo com raios roxos' },
  { tipo: 'fogo', nome: 'Fogo' },
  { tipo: 'trevas', nome: 'Trevas' },
  { tipo: 'eletrica-amarela', nome: 'Elétrica amarela' },
  { tipo: 'eletrica-azul', nome: 'Elétrica azul' },
  { tipo: 'vermelha', nome: 'Vermelha' },
  { tipo: 'multicolorida', nome: 'Multicolorida' },
]

const TIPOS: ReadonlySet<string> = new Set(AURAS.map((aura) => aura.tipo))

export function ehTipoDeAura(valor: unknown): valor is TipoDeAura {
  return typeof valor === 'string' && TIPOS.has(valor)
}

/** O nome da aura para a tela. */
export function nomeDaAura(tipo: TipoDeAura): string {
  return AURAS.find((aura) => aura.tipo === tipo)?.nome ?? tipo
}

function ehRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

/**
 * A aura como veio de fora (arquivo do mapa, recorte do jogador): só o tipo da
 * lista e o interruptor. Qualquer outra forma = `null` (ficha sem aura); o
 * resultado é sempre um objeto novo, só com os dois campos.
 */
export function lerAura(valor: unknown): AuraDaFicha | null {
  if (!ehRegistro(valor) || !ehTipoDeAura(valor.tipo) || typeof valor.ligada !== 'boolean') return null
  return { tipo: valor.tipo, ligada: valor.ligada }
}

function semAura(token: Token): Token {
  const { aura: _aura, ...resto } = token
  return resto
}

/**
 * A aura que o JOGADOR pode ligar e desligar nesta ficha (a dele, na tela
 * dele): a que o mestre deu. `null` = sem menu: ficha sem aura, ou emprestada
 * (ajudante contratado, NPC emprestado), que é do mestre e o host recusaria.
 */
export function auraQueOJogadorLiga(token: Token | undefined): AuraDaFicha | null {
  if (token === undefined || token.contrato !== undefined || token.emprestada === true) return null
  return lerAura(token.aura)
}

/** `aura` do arquivo: ausente continua ausente; torta some e a ficha abre sem aura; a certa volta só com os dois campos. */
export function fichaComAuraDoArquivo(token: Token): Token {
  if (!('aura' in token)) return token
  const aura = lerAura(token.aura)
  return aura === null ? semAura(token) : { ...token, aura }
}

/** Troca a ficha `tokenId` pela que `mudar` devolver; a mesma ficha de volta (ou ficha que não existe) devolve o MESMO mapa. */
function comFichaMudada(map: MapData, tokenId: string, mudar: (token: Token) => Token): MapData {
  const token = map.tokens.find((t) => t.id === tokenId)
  if (token === undefined) return map
  const novo = mudar(token)
  return novo === token ? map : { ...map, tokens: map.tokens.map((t) => (t === token ? novo : t)) }
}

/**
 * O MESTRE escolhe a aura da ficha: ela começa LIGADA. `null` = "Sem aura"
 * (o campo sai da ficha, como no mapa de antes). Escolher a mesma aura que já
 * está ligada não muda nada (o MESMO mapa: sem passo no Ctrl+Z).
 */
export function mapaComAura(map: MapData, tokenId: string, tipo: TipoDeAura | null): MapData {
  return comFichaMudada(map, tokenId, (token) => {
    const atual = lerAura(token.aura)
    if (tipo === null) return token.aura === undefined ? token : semAura(token)
    if (atual !== null && atual.tipo === tipo && atual.ligada) return token
    return { ...token, aura: { tipo, ligada: true } }
  })
}

/**
 * O JOGADOR liga ou desliga a aura da própria ficha. Ficha sem aura (o mestre
 * não deu, ou tirou nesse meio-tempo) não ganha uma: o MESMO mapa.
 */
export function mapaComAuraLigada(map: MapData, tokenId: string, ligada: boolean): MapData {
  return comFichaMudada(map, tokenId, (token) => {
    const atual = lerAura(token.aura)
    if (atual === null || atual.ligada === ligada) return token
    return { ...token, aura: { tipo: atual.tipo, ligada } }
  })
}
