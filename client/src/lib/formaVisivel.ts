import type { MapData, Token } from '../types/map'

/**
 * MUDAR FICHA — o lado do TOKEN (`Token.formaVisivel`): ler do arquivo e
 * trocar no mapa. Só depende do tipo do mapa, para o arquivo (`lib/mapFile.ts`)
 * não puxar a ficha de personagem; as regras da ficha estão em `lib/mudarFicha.ts`.
 */

/** Teto do id gravado em `Token.formaVisivel` (o mapa do disco chega cru). */
const FORMA_VISIVEL_MAX = 120

function semFormaVisivel(token: Token): Token {
  const { formaVisivel: _forma, ...resto } = token
  return resto
}

/** `formaVisivel` do arquivo: ausente continua ausente; torta (não é texto curto) some e o token volta à imagem base. */
export function fichaComFormaDoArquivo(token: Token): Token {
  if (!('formaVisivel' in token)) return token
  const valor: unknown = token.formaVisivel
  return typeof valor === 'string' && valor.length > 0 && valor.length <= FORMA_VISIVEL_MAX ? token : semFormaVisivel(token)
}

/**
 * O token `tokenId` passa a mostrar a forma `formaId` (`null` = a imagem base:
 * o campo sai). Já mostrando essa (ou token que não existe): o MESMO mapa.
 */
export function mapaComFormaVisivel(map: MapData, tokenId: string, formaId: string | null): MapData {
  const token = map.tokens.find((t) => t.id === tokenId)
  if (token === undefined || (token.formaVisivel ?? null) === formaId) return map
  const novo = formaId === null ? semFormaVisivel(token) : { ...token, formaVisivel: formaId }
  return { ...map, tokens: map.tokens.map((t) => (t === token ? novo : t)) }
}
