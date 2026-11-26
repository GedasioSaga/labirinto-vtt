import type { MapData, Token } from '../types/map'
import { gatherSpots } from './gatherParty'
import { grupoDaFicha, textoDeBusca } from './pastasDeFichas'
import type { Personagem } from './personagem'
import { mapaDoPiso, pisoDe } from './pisos'
import { tokenSizeInSquares } from './tokenSize'

/**
 * "ENVIAR PARA PERTO DE ›" do botão direito (pedido de 25/11/2026: "um botão
 * de enviar para perto de outro NPC ou para perto de um jogador no mapa,
 * porque eu to criando várias cópias do mesmo NPC") — a parte pura: quem o
 * submenu oferece e onde cada ficha assenta. Quem move (num passo do Ctrl+Z)
 * é `stores/enviarParaPerto.ts`.
 */

/** Uma linha do submenu: o token do mapa e o que a lista mostra dele. */
export interface AlvoDoEnvio {
  token: Token
  /** A ficha ligada (o retrato); `undefined` = token sem ficha. */
  personagem: Personagem | undefined
  /** O nome como o mestre o distingue: cópias do mesmo nome ganham número ("Zumbi 2"). */
  nome: string
  jogador: boolean
}

/**
 * Jogador = o token não é NPC e é ficha de jogador (a marca do token ou o tipo
 * da ficha ligada). O resto (NPC, inimigo, token sem ficha) vai na lista dos NPCs.
 */
function ehJogador(token: Token, personagem: Personagem | undefined): boolean {
  if (token.npc === true) return false
  return token.playerCharacter === true || (personagem !== undefined && grupoDaFicha(personagem) === 'jogadores')
}

/**
 * Os tokens do mapa aberto para onde a seleção pode ir, menos os que vão:
 * JOGADORES primeiro, depois os NPCs, cada grupo em ordem de nome (com o
 * número no lugar certo: "Zumbi 2" antes de "Zumbi 10"). `rotulos` = os nomes
 * numerados do mapa (`nomesNumerados`).
 */
export function alvosParaPerto(
  tokens: readonly Token[],
  personagens: readonly Personagem[],
  rotulos: ReadonlyMap<string, string>,
  indo: readonly string[],
): AlvoDoEnvio[] {
  const vao = new Set(indo)
  const porId = new Map(personagens.map((personagem) => [personagem.id, personagem]))
  const alvos = tokens
    .filter((token) => !vao.has(token.id))
    .map((token): AlvoDoEnvio => {
      const personagem = token.characterId === null ? undefined : porId.get(token.characterId)
      return { token, personagem, nome: rotulos.get(token.id) ?? (token.name.trim() || 'Token sem nome'), jogador: ehJogador(token, personagem) }
    })
  return alvos.sort((a, b) => Number(b.jogador) - Number(a.jogador) || a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true, sensitivity: 'base' }))
}

/** Os alvos cujo nome bate com a busca (sem acento, sem caixa). Busca vazia: todos. */
export function filtrarAlvos(alvos: readonly AlvoDoEnvio[], busca: string): AlvoDoEnvio[] {
  const termo = textoDeBusca(busca)
  return termo.length === 0 ? [...alvos] : alvos.filter((alvo) => textoDeBusca(alvo.nome).includes(termo))
}

/** Onde cada ficha assenta, o piso do alvo e as que não couberam. */
export interface LugaresPertoDoAlvo {
  piso: number
  lugares: { id: string; x: number; y: number }[]
  /** Os ids que não acharam casa livre perto do alvo: ficam onde estão. */
  semLugar: string[]
}

/**
 * As casas livres mais perto do token `alvoId`, uma para cada ficha de
 * `tokenIds` (menos o próprio alvo), no PISO DO ALVO: a procura do "Reunir o
 * grupo aqui" (`gatherSpots`) no recorte daquele piso, então a ficha nunca cai
 * dentro de parede, do outro lado de uma, nem em cima de outra ficha de lá;
 * várias se espalham em volta, a primeira mais perto. As que vão não contam
 * como obstáculo (saem do lugar). `null` = o alvo não está no mapa.
 */
export function lugaresPertoDoAlvo(map: MapData, alvoId: string, tokenIds: readonly string[]): LugaresPertoDoAlvo | null {
  const alvo = map.tokens.find((token) => token.id === alvoId)
  if (alvo === undefined) return null
  const piso = pisoDe(alvo)
  const ids = new Set(tokenIds)
  const indo = map.tokens.filter((token) => ids.has(token.id) && token.id !== alvoId)
  const casas = gatherSpots(
    mapaDoPiso(map, piso),
    { x: alvo.x, y: alvo.y },
    indo.map((token) => tokenSizeInSquares(token)),
    new Set(indo.map((token) => token.id)),
  )
  const lugares: LugaresPertoDoAlvo['lugares'] = []
  const semLugar: string[] = []
  indo.forEach((token, indice) => {
    const casa = casas[indice]
    if (casa === undefined || casa === null) semLugar.push(token.id)
    else lugares.push({ id: token.id, x: casa.x, y: casa.y })
  })
  return { piso, lugares, semLugar }
}
