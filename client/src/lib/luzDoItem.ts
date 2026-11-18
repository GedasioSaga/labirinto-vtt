import type { CarriedItem, Light, LuzDoItem, MapData, NaCamada, NoPiso, Token } from '../types/map'

/**
 * ITEM QUE ILUMINA (pedido de 18/11/2026: "na criação do item dê para colocar
 * se o item ilumina ou não, se ilumina qual cor ele ilumina e quanto ele
 * ilumina"). O item do Acervo leva `luz` ({cor, alcance, força, crepita}) para
 * onde for: no CHÃO (imagem, estrela ou pino) ele clareia em volta; na MOCHILA
 * só quando a vaga está acesa (`CarriedItem.acesa`), e a luz anda com a ficha.
 *
 * A luz NUNCA é gravada no mapa: nasce na leitura (`luzesDosItens`), como o
 * brilho do abismo (`carimbosComOsAbismos`), e entra num lugar só de cada
 * tela — o recorte do jogador (`soLuzesAcesas` em `lib/fogFilter.ts`, então a
 * visão da "Cena escura" também a conta) e o editor (halo e mapa de luz em
 * `pixi/PixiCanvas.tsx`). Item dentro de baú fechado (`Prop.conteudo`) não
 * ilumina: só o item solto e o da mão. Puro: sem DOM, sem store.
 */

/** Alcance mínimo e máximo, em casas. */
export const ALCANCE_DA_LUZ_DO_ITEM_MIN = 0.5
export const ALCANCE_DA_LUZ_DO_ITEM_MAX = 20
/** Força mínima (abaixo disso o claro nem se vê) e máxima. */
export const FORCA_DA_LUZ_DO_ITEM_MIN = 0.1
export const FORCA_DA_LUZ_DO_ITEM_MAX = 1

/** A luz que o "Ilumina" liga: um lampião, de tom claro (cor forte escurece o chão, `lib/luzDoFogo.ts`). */
export const LUZ_DO_ITEM_PADRAO: LuzDoItem = { cor: '#ffe2b0', alcanceEmCasas: 3, forca: 0.8 }

/**
 * Os tons que a janela do item sugere. Todos claros de propósito: a luz entra
 * multiplicando o mapa, e o laranja forte deixava o chão verde marrom escuro
 * (medido em 09/11/2026, `lib/luzDoFogo.ts`).
 */
export const CORES_SUGERIDAS_DA_LUZ_DO_ITEM: readonly { nome: string; cor: string }[] = [
  { nome: 'Vela', cor: '#ffe9c2' },
  { nome: 'Tocha', cor: '#ffd29c' },
  { nome: 'Lampião', cor: '#ffe2b0' },
  { nome: 'Luar', cor: '#d8e4ff' },
  { nome: 'Magia', cor: '#e0d2ff' },
  { nome: 'Fogo-fátuo', cor: '#d2ffd8' },
]

const FORMA_DA_COR = /^#[0-9a-f]{6}$/i
/** O prefixo do id de toda luz que nasce de item: nenhuma luz gravada o usa (`luz_…`, `light-…`). */
const PREFIXO = 'item:'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function numeroEntre(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(Math.max(value, min), max) : null
}

/**
 * `luz` lida de fora (disco, recorte, snapshot, o Acervo): cor `#rrggbb`,
 * alcance e força dentro dos tetos (fora deles, presos na ponta). Forma torta
 * volta AUSENTE — o item só deixa de iluminar.
 */
export function luzDoItemLida(value: unknown): LuzDoItem | undefined {
  if (!isRecord(value) || typeof value.cor !== 'string' || !FORMA_DA_COR.test(value.cor)) return undefined
  const alcanceEmCasas = numeroEntre(value.alcanceEmCasas, ALCANCE_DA_LUZ_DO_ITEM_MIN, ALCANCE_DA_LUZ_DO_ITEM_MAX)
  const forca = numeroEntre(value.forca, FORCA_DA_LUZ_DO_ITEM_MIN, FORCA_DA_LUZ_DO_ITEM_MAX)
  if (alcanceEmCasas === null || forca === null) return undefined
  const luz: LuzDoItem = { cor: value.cor.toLowerCase(), alcanceEmCasas, forca }
  if (value.crepita === true) luz.crepita = true
  return luz
}

/** As duas luzes dizem o mesmo (ausente só é igual a ausente). */
export function luzesDoItemIguais(a: LuzDoItem | undefined, b: LuzDoItem | undefined): boolean {
  if (a === undefined || b === undefined) return a === b
  return a.cor === b.cor && a.alcanceEmCasas === b.alcanceEmCasas && a.forca === b.forca && a.crepita === b.crepita
}

/** A luz é de um item (não está no mapa: não se seleciona, não tem marcador). */
export function ehLuzDeItem(light: Pick<Light, 'id'>): boolean {
  return light.id.startsWith(PREFIXO)
}

/**
 * A vaga `vagaId` acesa ou apagada. `null` = nada a gravar: a vaga não está
 * lá, não ilumina, ou já está como pedido.
 */
export function mochilaComAVagaAcesa(mochila: readonly CarriedItem[], vagaId: string, acesa: boolean): CarriedItem[] | null {
  const vaga = mochila.find((item) => item.id === vagaId)
  if (vaga === undefined || vaga.luz === undefined || (vaga.acesa === true) === acesa) return null
  const { acesa: _antes, ...apagada } = vaga
  const nova: CarriedItem = acesa ? { ...apagada, acesa: true } : apagada
  return mochila.map((item) => (item === vaga ? nova : item))
}

/** O que a luz herda de quem a leva: o piso e a camada. */
function ondeEsta(dono: NoPiso & NaCamada): NoPiso & NaCamada {
  return { ...(dono.piso === undefined ? {} : { piso: dono.piso }), ...(dono.camada === undefined ? {} : { camada: dono.camada }) }
}

function luzNoPonto(id: string, x: number, y: number, luz: LuzDoItem, grid: number, dono: NoPiso & NaCamada): Light {
  return {
    id,
    x,
    y,
    radius: luz.alcanceEmCasas * grid,
    color: luz.cor,
    intensity: luz.forca,
    ...ondeEsta(dono),
    ...(luz.crepita === true ? { crepita: true as const } : {}),
  }
}

/** As vagas acesas da ficha que iluminam: a luz no meio dela, presa a ela (anda junto, e some com ela do recorte). */
function luzesDaFicha(token: Token, grid: number): Light[] {
  if (token.hidden === true) return []
  return (token.mochila ?? []).flatMap((vaga) => {
    if (vaga.acesa !== true || vaga.luz === undefined) return []
    return [{ ...luzNoPonto(`${PREFIXO}${token.id}:${vaga.id}`, token.x, token.y, vaga.luz, grid, token), attachedTokenId: token.id }]
  })
}

export interface OpcoesDasLuzesDosItens {
  /**
   * O recorte do jogador: o item "Oculto para jogadores" não ilumina (o claro
   * contaria que ele está lá). O mestre vê o claro de todos.
   */
  doJogador?: boolean
}

/**
 * As luzes dos itens de `map`, na ordem: os do chão (objeto e pino, id
 * `item:<id>`), depois os acesos na mochila (id `item:<ficha>:<vaga>`). Item
 * escondido no editor (`hidden`) não ilumina; o baú fechado nem é lido.
 */
export function luzesDosItens(map: Pick<MapData, 'props' | 'pins' | 'tokens' | 'grid'>, opcoes: OpcoesDasLuzesDosItens = {}): Light[] {
  const grid = Number.isFinite(map.grid) && map.grid > 0 ? map.grid : 50
  const doJogador = opcoes.doJogador === true
  const luzes: Light[] = []
  for (const prop of map.props) {
    const luz = prop.item?.luz
    if (luz === undefined || prop.hidden === true || (doJogador && prop.secret === true)) continue
    luzes.push(luzNoPonto(`${PREFIXO}${prop.id}`, prop.x, prop.y, luz, grid, prop))
  }
  for (const pin of map.pins) {
    const luz = pin.item?.luz
    if (luz === undefined || pin.hidden === true || (doJogador && pin.secret === true)) continue
    luzes.push(luzNoPonto(`${PREFIXO}${pin.id}`, pin.x, pin.y, luz, grid, pin))
  }
  for (const token of map.tokens) luzes.push(...luzesDaFicha(token, grid))
  return luzes
}

/** O conteúdo que muda o desenho: a mesma lista com o mesmo conteúdo não refaz halo nem mapa de luz. */
function conteudoDasLuzes(luzes: readonly Light[]): string {
  let chave = ''
  for (const l of luzes) chave += `${l.id}|${l.x}|${l.y}|${l.radius}|${l.color}|${l.intensity}|${l.crepita === true}|${l.piso ?? 0}|${l.camada ?? ''};`
  return chave
}

type FonteDasLuzes = Pick<MapData, 'props' | 'pins' | 'tokens' | 'grid'>
let lembradas: { props: FonteDasLuzes['props']; pins: FonteDasLuzes['pins']; tokens: FonteDasLuzes['tokens']; grid: number; chave: string; luzes: Light[] } | null = null

/**
 * `luzesDosItens` para o EDITOR, que pergunta a cada quadro e a cada redesenho:
 * as mesmas listas do mapa devolvem o MESMO array; listas novas com o mesmo
 * conteúdo (a ficha que andou sem luz, outro objeto que mudou) também — o halo
 * compara luz a luz por identidade (`drawLights.ts`) e o mapa de luz pela revisão.
 */
export function luzesDosItensLembradas(map: FonteDasLuzes): Light[] {
  const anterior = lembradas
  if (anterior !== null && anterior.props === map.props && anterior.pins === map.pins && anterior.tokens === map.tokens && anterior.grid === map.grid) return anterior.luzes
  const luzes = luzesDosItens(map)
  const chave = conteudoDasLuzes(luzes)
  const mesmas = anterior !== null && anterior.chave === chave ? anterior.luzes : luzes
  lembradas = { props: map.props, pins: map.pins, tokens: map.tokens, grid: map.grid, chave, luzes: mesmas }
  return mesmas
}
