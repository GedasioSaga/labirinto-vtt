import type { Personagem } from '../lib/personagem'
import { ehRefDeMidia } from '../lib/midia'
import { urlDaMidiaNoMestre } from '../lib/midiaNoDisco'
import { buildTokenPhotoData, isTokenPhotoData } from '../lib/tokenPhoto'
import { visibleTokens } from '../lib/layers'
import { mapaDoPiso } from '../lib/pisos'
import { findTokenAt, snapPointForTarget } from '../pixi/tokenInteraction'
import type { Camera, Point } from '../pixi/world'
import type { MapData } from '../types/map'
import { criarToken, type TamanhoDaVista } from './criarToken'
import { useMapStore } from './mapStore'

/**
 * PERSONAGENS → MAPA (pedido de 06/11/2026: "quando eu puxar o jogador para o
 * campo é para o token dele aparecer"). Arrastar a linha de um personagem do
 * painel Personagens e soltar no mapa põe um token LIGADO àquela ficha, na
 * casa onde o ponteiro subiu, com o retrato dela. Passa por `criarToken`, o
 * mesmo caminho do botão Token e do acervo: um `addToken` só, um passo do
 * Ctrl+Z, e a peça nasce selecionada.
 *
 * Personagem que já tem token na cena ganha OUTRO: o app já aceita várias
 * fichas do mesmo personagem (a batalha soma os usos delas, `lib/batalha`), e
 * o "Pôr token" da entrada pela conta também cria em vez de mover.
 */

/** A casa sob o ponteiro: o centro dela no mundo e o quadrado dela na tela (px de janela). */
export interface CasaDoSoltar {
  mundo: Point
  /** `redonda`: grade hexagonal, o realce vira disco em vez de quadrado. */
  tela: { x: number; y: number; lado: number; redonda: boolean }
}

/**
 * Tela → mundo pela mesma conta do soltar do acervo (`handleDropFromLibrary`),
 * presa dentro do mapa e encaixada no centro da casa como a colocação do
 * mestre (`aoEscolherCasa` no PixiCanvas). Volta para a tela pela mesma
 * câmera: o realce acompanha zoom e pan sem saber deles.
 */
export function casaDoSoltar(
  cliente: Point,
  caixa: { left: number; top: number },
  camera: Camera,
  mapa: Pick<MapData, 'grid' | 'width' | 'height' | 'gridShape'>,
): CasaDoSoltar {
  const ponto = { x: (cliente.x - caixa.left - camera.x) / camera.scale, y: (cliente.y - caixa.top - camera.y) / camera.scale }
  const meia = mapa.grid / 2
  const x = Math.min(Math.max(ponto.x, meia), Math.max(meia, mapa.width * mapa.grid - meia))
  const y = Math.min(Math.max(ponto.y, meia), Math.max(meia, mapa.height * mapa.grid - meia))
  const mundo = snapPointForTarget('token', mapa.gridShape, x, y, mapa.grid)
  return {
    mundo,
    tela: { x: caixa.left + camera.x + mundo.x * camera.scale, y: caixa.top + camera.y + mundo.y * camera.scale, lado: mapa.grid * camera.scale, redonda: mapa.gridShape === 'hex' },
  }
}

/**
 * A casa sob o ponteiro, só se ali está o MAPA (o elemento sob o ponteiro
 * mora dentro do canvas, e não num painel que o cobre); `null` fora dele.
 */
export function casaSobOPonteiro(host: HTMLElement | null, clientX: number, clientY: number): CasaDoSoltar | null {
  const sob = document.elementFromPoint(clientX, clientY)
  if (host === null || sob === null || !host.contains(sob)) return null
  const { camera, map } = useMapStore.getState()
  return casaDoSoltar({ x: clientX, y: clientY }, host.getBoundingClientRect(), camera, map)
}

/**
 * SOLTAR EM CIMA DO TOKEN (pedido de 09/11/2026): o token sob o ponteiro no
 * piso em edição, e os tokens que a ficha vai ligar — ele só, ou a seleção
 * inteira quando ele faz parte de uma seleção de vários tokens ("vários de
 * uma vez"). `tela` é o disco do token (px de janela), para o realce.
 */
export interface TokenDoSoltar {
  tokenIds: string[]
  nome: string
  tela: { x: number; y: number; lado: number }
}

export function tokenSobOPonteiro(host: HTMLElement | null, clientX: number, clientY: number): TokenDoSoltar | null {
  const sob = document.elementFromPoint(clientX, clientY)
  if (host === null || sob === null || !host.contains(sob)) return null
  const { camera, map, pisoAtivo, selection } = useMapStore.getState()
  const caixa = host.getBoundingClientRect()
  const ponto = { x: (clientX - caixa.left - camera.x) / camera.scale, y: (clientY - caixa.top - camera.y) / camera.scale }
  const doPiso = mapaDoPiso(map, pisoAtivo)
  const token = findTokenAt(visibleTokens(doPiso.tokens, map.hiddenLayers), ponto, map.grid)
  if (token === null) return null
  const selecionados = selection.filter((item) => item.kind === 'token').map((item) => item.id)
  const tokenIds = selecionados.length > 1 && selecionados.includes(token.id) ? selecionados : [token.id]
  return {
    tokenIds,
    nome: token.name,
    tela: { x: caixa.left + camera.x + token.x * camera.scale, y: caixa.top + camera.y + token.y * camera.scale, lado: map.grid * token.size * camera.scale },
  }
}

/**
 * A foto do token a partir do retrato: a embutida vai como está; a `midia:`
 * passa pela ponte de arquivos do mestre e é reduzida como toda foto de
 * token. Falhou = `null` (disco de iniciais). Mesma regra da invocação
 * (`fotoDoCartao`, InvocacoesDoMestre.tsx).
 */
export async function fotoDoRetrato(retrato: string | null): Promise<string | null> {
  if (retrato === null) return null
  if (isTokenPhotoData(retrato)) return retrato
  if (!ehRefDeMidia(retrato)) return null
  try {
    const url = await urlDaMidiaNoMestre(retrato)
    if (url === null) return null
    const resposta = await fetch(url)
    if (!resposta.ok) return null
    return await buildTokenPhotoData(await resposta.blob())
  } catch {
    return null
  }
}

/**
 * O token do personagem nasce em `at` (centro da casa, px do mundo), no piso
 * em edição. A foto é lida ANTES (peça e foto num passo só do desfazer); se a
 * cena trocou durante a leitura, nada nasce na cena errada.
 */
export async function porPersonagemNoMapa(personagem: Pick<Personagem, 'id' | 'nome' | 'tipo' | 'retrato'>, at: Point, vista: TamanhoDaVista | null): Promise<string | null> {
  const mapaId = useMapStore.getState().map.id
  const imageData = await fotoDoRetrato(personagem.retrato)
  const { map, pisoAtivo } = useMapStore.getState()
  if (map.id !== mapaId) return null
  return criarToken(personagem.nome.trim() || 'Personagem', { at, characterId: personagem.id, imageData, npc: personagem.tipo === 'npc', piso: pisoAtivo }, vista)
}
