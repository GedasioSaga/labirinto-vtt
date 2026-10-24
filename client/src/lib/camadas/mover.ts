/**
 * MOVER ITEM DE CAMADA (fatia 8 de `docs/planos/camadas-fase3-2026-10-22.md`):
 * a regra pura por trás dos três gestos (seletor "Camada" da ficha, "Mover
 * para camada" do clique direito e arrastar a linha da lista de objetos para
 * a camada). A store embrulha num `withHistory`: um gesto, um passo do Ctrl+Z,
 * por mais itens que a seleção tenha.
 *
 * - Camada travada não recebe nem entrega: destino travado recusa tudo; item
 *   preso (cadeado dele ou da camada de onde sai) fica onde está.
 * - Voltar à camada padrão do tipo TIRA o campo `camada` (o arquivo volta a
 *   ser o de antes); no objeto, Objetos e Decoração gravam no `layer` de
 *   sempre, que o cliente antigo também entende.
 * - Item numa camada livre APAGADA já responde pela padrão do tipo
 *   (`contextoDeCamadas().camadaDe`, regra da fatia 7): mover para a padrão
 *   limpa o id órfão.
 * - Só mudam de camada os tipos que já desenham no nó da camada escolhida
 *   (fatias 3, 3b, 4 e 4b); os outros ficam na padrão e dizem por quê.
 */
import type { CamadaId, MapData, Prop, Region } from '../../types/map'
import type { SelectionKind } from '../../types/tools'
import { contextoDeCamadas } from './consulta'
import { ROTULOS_DAS_CAMADAS, camadaPadraoDe, ehCamadaPadrao, type ItemPorTipo, type TipoDeObjeto } from './padrao'

/** Um item que o gesto quer mover: o tipo na camada e o id dele (o telhado usa o id da Sala). */
export interface RefDeItem {
  readonly tipo: TipoDeObjeto
  readonly id: string
}

/** O tipo e o item juntos: estreitar `tipo` estreita `item`. */
export type ParDeItem = { [K in TipoDeObjeto]: { readonly tipo: K; readonly item: ItemPorTipo[K] } }[TipoDeObjeto]

export type RecusaDeMover = 'destino-travado' | 'origem-travada' | 'camada-inexistente' | 'tipo-na-padrao'

export interface ResultadoDeMover {
  /** O mapa depois do gesto; o MESMO objeto quando nada mudou (sem passo vazio no Ctrl+Z). */
  readonly map: MapData
  /** Quantos itens trocaram de camada. */
  readonly movidos: number
  /** Itens que ficaram: presos pelo cadeado, ou de tipo que ainda desenha na padrão. */
  readonly ficaram: number
  /** Por que nada se moveu (só quando `movidos` é 0 e havia o que mover). */
  readonly recusa?: RecusaDeMover
  /** A camada que segurou (a que manda no cadeado: no mapa de antes, Salas por Chão). */
  readonly camadaQueRecusa?: CamadaId
}

/** O que a ficha e o menu dizem quando o tipo ainda não muda de camada. */
export const MOTIVO_CAMADA_PADRAO = 'Desenha na camada padrão por enquanto.'

/**
 * O tipo já desenha no nó da camada escolhida, no editor e no jogador. Ficam
 * de fora (LIMITACAO ATUAL de `pixi/paresDoEditor.test.ts` e
 * `player/pilhaDoJogador.test.ts`): sala/região, peça de chão, carimbo e texto.
 */
export function tipoMudaDeCamada(par: ParDeItem): boolean {
  if (par.tipo === 'regiao' || par.tipo === 'peca' || par.tipo === 'carimbo') return false
  if (par.tipo === 'desenho') return par.item.kind !== 'text'
  return true
}

const TIPO_DA_SELECAO: Record<SelectionKind, TipoDeObjeto> = {
  token: 'ficha',
  wall: 'parede',
  light: 'luz',
  region: 'regiao',
  stair: 'escada',
  prop: 'objeto',
  drawing: 'desenho',
  floor: 'peca',
}

/** Os itens da seleção do editor (e o pino aberto, que mora fora dela) como refs de mover. */
export function refsDaSelecao(selection: readonly { kind: SelectionKind; id: string }[], pinoId: string | null): RefDeItem[] {
  const refs: RefDeItem[] = selection.map((item) => ({ tipo: TIPO_DA_SELECAO[item.kind], id: item.id }))
  if (pinoId !== null) refs.push({ tipo: 'pino', id: pinoId })
  return refs
}

function porId<T extends { id: string }>(lista: readonly T[] | undefined, id: string): T | undefined {
  return lista?.find((item) => item.id === id)
}

/** O item de uma ref no mapa (o telhado é a Região da sala com teto). */
export function itemDaRef(map: MapData, ref: RefDeItem): ParDeItem | undefined {
  const par = <K extends TipoDeObjeto>(tipo: K, item: ItemPorTipo[K] | undefined) => (item === undefined ? undefined : ({ tipo, item }) as ParDeItem) // as: K concreto em cada chamada abaixo
  switch (ref.tipo) {
    case 'parede':
      return par('parede', porId(map.walls, ref.id))
    case 'escada':
      return par('escada', porId(map.stairs, ref.id))
    case 'regiao':
      return par('regiao', porId(map.regions, ref.id))
    case 'telhado': {
      const regiao = porId(map.regions, ref.id)
      return par('telhado', regiao?.room?.roof === true ? regiao : undefined)
    }
    case 'peca':
      return par('peca', porId(map.floor, ref.id))
    case 'objeto':
      return par('objeto', porId(map.props, ref.id))
    case 'ficha':
      return par('ficha', porId(map.tokens, ref.id))
    case 'pino':
      return par('pino', porId(map.pins, ref.id))
    case 'luz':
      return par('luz', porId(map.lights, ref.id))
    case 'desenho':
      return par('desenho', porId(map.drawings, ref.id))
    case 'linha':
      return par('linha', porId(map.lines, ref.id))
    case 'marcador':
      return par('marcador', porId(map.markers, ref.id))
    case 'carimbo':
      return par('carimbo', porId(map.carimbos, ref.id))
  }
}

function paresDe(map: MapData, refs: readonly RefDeItem[]): ParDeItem[] {
  const vistos = new Set<string>()
  const pares: ParDeItem[] = []
  for (const ref of refs) {
    const chave = `${ref.tipo}:${ref.id}`
    if (vistos.has(chave)) continue
    vistos.add(chave)
    const par = itemDaRef(map, ref)
    if (par !== undefined) pares.push(par)
  }
  return pares
}

/** A camada em comum dos itens; `'varias'` quando divergem; `null` sem item nenhum. */
export function camadaDosItens(map: MapData, refs: readonly RefDeItem[]): CamadaId | 'varias' | null {
  const camadas = contextoDeCamadas(map)
  const atuais = paresDe(map, refs).map((par) => camadas.camadaDe(par.tipo, par.item))
  if (atuais.length === 0) return null
  return atuais.every((id) => id === atuais[0]) ? atuais[0] : 'varias'
}

/** Algum item das refs muda de camada (os outros ficam na padrão do tipo). */
export function algumMudaDeCamada(map: MapData, refs: readonly RefDeItem[]): boolean {
  return paresDe(map, refs).some(tipoMudaDeCamada)
}

/**
 * Por que nenhum item das refs muda de camada agora (o seletor da ficha se
 * desliga e diz isto); `null` quando algum pode ir.
 */
export function motivoParaNaoMover(map: MapData, refs: readonly RefDeItem[]): string | null {
  const camadas = contextoDeCamadas(map)
  const mudam = paresDe(map, refs).filter(tipoMudaDeCamada)
  if (mudam.length === 0) return MOTIVO_CAMADA_PADRAO
  if (mudam.some((par) => camadas.podeMexer(par.tipo, par.item))) return null
  const travada = mudam.map((par) => camadas.camadaDe(par.tipo, par.item)).find((id) => camadas.travada(id))
  return travada === undefined ? 'Travado: destrave para mudar de camada.' : `A camada ${nomeDaCamada(map, camadas.camadaQueManda(travada))} está travada.`
}

/** O nome que o mestre lê: um dos 13 rótulos, ou o nome da camada livre no modelo. */
export function nomeDaCamada(map: Pick<MapData, 'modeloCamadas'>, id: CamadaId): string {
  if (ehCamadaPadrao(id)) return ROTULOS_DAS_CAMADAS[id]
  const nome = map.modeloCamadas?.ordem.find((def) => def.id === id)?.nome?.trim()
  return nome === undefined || nome === '' ? 'sem nome' : nome
}

/** O aviso do gesto que moveu: quantos, para onde e quantos ficaram (presos ou de tipo que fica na padrão). */
export function avisoDoMover(resultado: Pick<ResultadoDeMover, 'movidos' | 'ficaram'>, nomeDoDestino: string): string {
  const movidos = resultado.movidos === 1 ? 'Item movido' : `${resultado.movidos} itens movidos`
  const ficaram = resultado.ficaram === 0 ? '' : resultado.ficaram === 1 ? ' 1 ficou onde estava.' : ` ${resultado.ficaram} ficaram onde estavam.`
  return `${movidos} para ${nomeDoDestino}.${ficaram}`
}

/** O item com `camada` = destino; voltar à padrão do tipo tira o campo (o arquivo volta ao de antes). */
function comCamada<T extends { camada?: CamadaId }>(item: T, destino: CamadaId, padrao: CamadaId): T {
  if (destino !== padrao) return { ...item, camada: destino }
  const { camada: _antiga, ...semCamada } = item
  return semCamada as T // as: o item sem o campo opcional `camada` continua sendo um T
}

/** Objetos e Decoração moram no `layer` de antes (o cliente antigo entende); o resto, no `camada`. */
function objetoNaCamada(prop: Prop, destino: CamadaId): Prop {
  if (destino !== 'objetos' && destino !== 'decoracao') return { ...prop, camada: destino }
  const { camada: _antiga, layer: _layer, ...resto } = prop
  return destino === 'decoracao' ? { ...resto, layer: 'decoracao' } : resto
}

function telhadoNaCamada(regiao: Region, destino: CamadaId): Region {
  if (regiao.room === undefined) return regiao
  const { camadaDoTelhado: _antiga, ...room } = regiao.room
  return { ...regiao, room: destino === 'telhados' ? room : { ...room, camadaDoTelhado: destino } }
}

/** O item em `destino`, do jeito que o arquivo guarda. */
function noDestino(par: ParDeItem, destino: CamadaId): ParDeItem {
  switch (par.tipo) {
    case 'telhado':
      return { tipo: 'telhado', item: telhadoNaCamada(par.item, destino) }
    case 'objeto':
      return { tipo: 'objeto', item: objetoNaCamada(par.item, destino) }
    default: {
      const padrao = camadaPadraoDe(par.tipo, par.item as never) // as: `par` estreitado pelo switch; o TS não liga tipo e item no ramo `default`
      return { tipo: par.tipo, item: comCamada(par.item, destino, padrao) } as ParDeItem // as: idem, o item segue sendo do mesmo tipo
    }
  }
}

/** O que o arquivo guarda sobre a camada do item (para não gastar passo com o que já está igual). */
function assinatura(par: ParDeItem): string {
  if (par.tipo === 'telhado') return par.item.room?.camadaDoTelhado ?? ''
  if (par.tipo === 'objeto') return `${par.item.camada ?? ''}|${par.item.layer ?? ''}`
  return par.item.camada ?? ''
}

type Trocas = Map<string, ParDeItem['item']>

function trocar<T extends { id: string }>(lista: readonly T[], trocas: Trocas | undefined): T[] | undefined {
  if (trocas === undefined) return undefined
  return lista.map((item) => (trocas.get(item.id) as T | undefined) ?? item) // as: a troca de um id veio da MESMA lista
}

/**
 * Move os itens das refs para `destino`, num mapa só. Ref repetida, item
 * sumido e item que já está lá não contam. Nada mudou = o mesmo `map`.
 */
export function moverParaCamada(map: MapData, refs: readonly RefDeItem[], destino: CamadaId): ResultadoDeMover {
  const camadas = contextoDeCamadas(map)
  const pares = paresDe(map, refs)
  if (!camadas.ordem.includes(destino)) return { map, movidos: 0, ficaram: pares.length, recusa: 'camada-inexistente' }
  if (camadas.travada(destino)) {
    return { map, movidos: 0, ficaram: pares.length, recusa: 'destino-travado', camadaQueRecusa: camadas.camadaQueManda(destino) }
  }
  const trocas = new Map<string, Trocas>()
  let movidos = 0
  let ficaram = 0
  let presos = 0
  let origemQueSegurou: CamadaId | undefined
  for (const par of pares) {
    if (!tipoMudaDeCamada(par)) {
      ficaram += 1
      continue
    }
    if (!camadas.podeMexer(par.tipo, par.item)) {
      ficaram += 1
      presos += 1
      const atual = camadas.camadaDe(par.tipo, par.item)
      if (camadas.travada(atual)) origemQueSegurou ??= camadas.camadaQueManda(atual)
      continue
    }
    const novo = noDestino(par, destino)
    if (assinatura(novo) === assinatura(par)) continue
    movidos += 1
    const lista = LISTA_DO_TIPO[par.tipo]
    const daLista = trocas.get(lista) ?? new Map()
    daLista.set(par.item.id, novo.item)
    trocas.set(lista, daLista)
  }
  if (movidos === 0) {
    if (ficaram === 0) return { map, movidos: 0, ficaram: 0 }
    if (presos === 0) return { map, movidos: 0, ficaram, recusa: 'tipo-na-padrao' }
    return { map, movidos: 0, ficaram, recusa: 'origem-travada', ...(origemQueSegurou === undefined ? {} : { camadaQueRecusa: origemQueSegurou }) }
  }
  const proximo: MapData = { ...map }
  for (const [lista, daLista] of trocas) {
    switch (lista) {
      case 'walls':
        proximo.walls = trocar(map.walls, daLista) ?? map.walls
        break
      case 'stairs':
        proximo.stairs = trocar(map.stairs, daLista) ?? map.stairs
        break
      case 'regions':
        proximo.regions = trocar(map.regions, daLista) ?? map.regions
        break
      case 'props':
        proximo.props = trocar(map.props, daLista) ?? map.props
        break
      case 'tokens':
        proximo.tokens = trocar(map.tokens, daLista) ?? map.tokens
        break
      case 'pins':
        proximo.pins = trocar(map.pins, daLista) ?? map.pins
        break
      case 'lights':
        proximo.lights = trocar(map.lights, daLista) ?? map.lights
        break
      case 'drawings':
        proximo.drawings = trocar(map.drawings, daLista) ?? map.drawings
        break
      case 'lines':
        proximo.lines = trocar(map.lines, daLista) ?? map.lines
        break
      case 'markers':
        proximo.markers = trocar(map.markers, daLista) ?? map.markers
        break
    }
  }
  return { map: proximo, movidos, ficaram }
}

/** Em que lista do mapa mora cada tipo (região e telhado dividem a das regiões). */
const LISTA_DO_TIPO: Record<TipoDeObjeto, string> = {
  parede: 'walls',
  escada: 'stairs',
  regiao: 'regions',
  peca: 'floor',
  objeto: 'props',
  ficha: 'tokens',
  pino: 'pins',
  luz: 'lights',
  desenho: 'drawings',
  linha: 'lines',
  marcador: 'markers',
  carimbo: 'carimbos',
  telhado: 'regions',
}
