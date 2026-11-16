import type {
  EstadoDoMetalDaEscada,
  FeitioDaPedraDaEscada,
  MapData,
  MaterialDaEscada,
  Stair,
  TomDaMadeiraDaEscada,
} from '../types/map'
import { MATERIAIS } from '../texturas/meioTermo/materiais'

/**
 * ESCADA COM MATERIAL (pedido de 16/11/2026, item 9): "coloque a opção da
 * escada ter textura que nem a parede onde pode ser tirado e colocado".
 * Catálogo, leitura do arquivo e a troca com desfazer; o desenho é de
 * `pixi/drawStairs.ts` e as imagens moram em `texturas/escadas/imagens/`.
 *
 * O formato da FOLHA de cada material (`FOLHA_DA_ESCADA`), PNG de 256 x 128:
 * 8 FIADAS de 16 texels empilhadas, cada uma a matéria de UM degrau inteiro
 * (uma tábua, uma fileira de tijolos, de pedregulhos, de ladrilhos). Repete
 * nos dois eixos: o patamar usa a folha com as fiadas empilhadas. A luz e a
 * sombra do degrau não estão na folha (senão o patamar viraria degrau); são do
 * desenho. Gerador (Python, determinístico) no estúdio:
 * `jogos/texturas-labirinto/prova/escadas/gerar_escadas.py`.
 */
export const FOLHA_DA_ESCADA = {
  largura: 256,
  altura: 128,
  fiada: 16,
  fiadas: 8,
} as const

/** Uma folha de textura: o arquivo `imagens/<id>.png`. A madeira é uma só, neutra, tingida pelo tom. */
export type FolhaDaEscada = 'madeira' | 'metal-nova' | 'metal-enferrujada' | 'pedra-cascalho' | 'pedra-pedregulhos' | 'ceramica' | 'tijolo'

export interface MaterialDaEscadaNoCatalogo {
  readonly id: MaterialDaEscada
  readonly nome: string
  readonly descricao: string
}

/** A ordem é a do pedido do mestre. */
export const MATERIAIS_DA_ESCADA: readonly MaterialDaEscadaNoCatalogo[] = [
  { id: 'madeira', nome: 'Madeira', descricao: 'Uma tábua por degrau, na cor da madeira escolhida.' },
  { id: 'metal', nome: 'Metal', descricao: 'Chapa xadrez de ferro, nova ou enferrujada.' },
  { id: 'pedra', nome: 'Pedra', descricao: 'Cascalho socado ou pedregulhos assentados.' },
  { id: 'ceramica', nome: 'Cerâmica', descricao: 'Ladrilho vidrado claro, com rejunte fino.' },
  { id: 'tijolo', nome: 'Tijolo', descricao: 'Tijolos deitados ao comprido do degrau.' },
]

/** Os tons da madeira, na ordem da mobília (`MADEIRAS` de `texturas/meioTermo/materiais.ts`). */
export const TONS_DA_MADEIRA_DA_ESCADA: readonly TomDaMadeiraDaEscada[] = ['carvalho', 'nogueira', 'pinho', 'cerejeira', 'velha']

export const ESTADOS_DO_METAL: readonly { id: EstadoDoMetalDaEscada; nome: string }[] = [
  { id: 'nova', nome: 'Nova' },
  { id: 'enferrujada', nome: 'Enferrujada' },
]

export const FEITIOS_DA_PEDRA: readonly { id: FeitioDaPedraDaEscada; nome: string }[] = [
  { id: 'cascalho', nome: 'Cascalho' },
  { id: 'pedregulhos', nome: 'Pedregulhos' },
]

/** O que vale quando o campo está ausente: o tom e os feitios de quem nunca escolheu. */
export const TOM_PADRAO: TomDaMadeiraDaEscada = 'carvalho'
export const ESTADO_PADRAO_DO_METAL: EstadoDoMetalDaEscada = 'nova'
export const FEITIO_PADRAO_DA_PEDRA: FeitioDaPedraDaEscada = 'cascalho'
/** O primeiro material de quem liga "Com textura" sem ter escolhido nenhum. */
export const MATERIAL_PADRAO_DA_ESCADA: MaterialDaEscada = 'madeira'

const IDS_DOS_MATERIAIS = new Set<string>(MATERIAIS_DA_ESCADA.map((m) => m.id))
const IDS_DOS_TONS = new Set<string>(TONS_DA_MADEIRA_DA_ESCADA)
const IDS_DO_METAL = new Set<string>(ESTADOS_DO_METAL.map((e) => e.id))
const IDS_DA_PEDRA = new Set<string>(FEITIOS_DA_PEDRA.map((f) => f.id))

export function ehMaterialDaEscada(valor: unknown): valor is MaterialDaEscada {
  return typeof valor === 'string' && IDS_DOS_MATERIAIS.has(valor)
}

export function nomeDoMaterialDaEscada(material: MaterialDaEscada): string {
  return MATERIAIS_DA_ESCADA.find((m) => m.id === material)?.nome ?? material
}

/**
 * A escada como ela entra no mapa ao abrir o arquivo: material, tom e feitios
 * que esta versão não conhece (map.json editado à mão, versão mais nova) caem
 * fora, e a escada sai como linha em vez de quebrar o desenho. Sem nenhum dos
 * campos, devolve o MESMO objeto (mapa velho passa intocado).
 */
export function limparMaterialDaEscada<T extends Stair>(escada: T): T {
  const { material, tom, estadoDoMetal, feitioDaPedra } = escada
  if (material === undefined && tom === undefined && estadoDoMetal === undefined && feitioDaPedra === undefined) return escada
  const limpa: T = { ...escada }
  if (!ehMaterialDaEscada(material)) delete limpa.material
  if (typeof tom !== 'string' || !IDS_DOS_TONS.has(tom)) delete limpa.tom
  if (typeof estadoDoMetal !== 'string' || !IDS_DO_METAL.has(estadoDoMetal)) delete limpa.estadoDoMetal
  if (typeof feitioDaPedra !== 'string' || !IDS_DA_PEDRA.has(feitioDaPedra)) delete limpa.feitioDaPedra
  return limpa
}

/**
 * O que o painel pede: `material: null` = "Só linhas" (tira o material e deixa
 * o tom e os feitios guardados, para "Com textura" voltar como estava).
 */
export interface MudancaDoMaterialDaEscada {
  material?: MaterialDaEscada | null
  tom?: TomDaMadeiraDaEscada
  estadoDoMetal?: EstadoDoMetalDaEscada
  feitioDaPedra?: FeitioDaPedraDaEscada
}

/** Troca o material de uma escada já colocada (um Ctrl+Z por chamada, no `mapStore`). Escada que não existe: o mapa igual. */
export function mudarMaterialDaEscada(map: MapData, id: string, mudanca: MudancaDoMaterialDaEscada): MapData {
  if (!map.stairs.some((s) => s.id === id)) return map
  return {
    ...map,
    stairs: map.stairs.map((s) => {
      if (s.id !== id) return s
      const nova: Stair = { ...s }
      if (mudanca.material === null) delete nova.material
      else if (mudanca.material !== undefined) nova.material = mudanca.material
      if (mudanca.tom !== undefined) nova.tom = mudanca.tom
      if (mudanca.estadoDoMetal !== undefined) nova.estadoDoMetal = mudanca.estadoDoMetal
      if (mudanca.feitioDaPedra !== undefined) nova.feitioDaPedra = mudanca.feitioDaPedra
      return nova
    }),
  }
}

/**
 * Cor média de cada folha (impressa pelo gerador do estúdio): é o que o degrau
 * pinta enquanto a imagem não chega e onde não há placa de vídeo (teste). O
 * contorno é a própria cor a 60% da luz, a regra do Meio-Termo (nunca preto).
 */
const COR_MEDIA_DA_FOLHA: Readonly<Record<FolhaDaEscada, number>> = {
  madeira: 0xede9e1,
  'metal-nova': 0x90969a,
  'metal-enferrujada': 0x6f6962,
  'pedra-cascalho': 0x938e83,
  'pedra-pedregulhos': 0x908b81,
  ceramica: 0xcdbfa8,
  tijolo: 0xa37362,
}

const LUZ_DO_CONTORNO = 0.6

/** O que o desenho precisa para pintar a escada com material: a folha, o tingimento e as cores. */
export interface AparenciaDaEscada {
  folha: FolhaDaEscada
  /** Multiplica a folha (o tom da madeira); branco nas outras. */
  tinta: number
  /** A cor média já tingida: o degrau sem imagem. */
  media: number
  /** A aresta do degrau e a moldura. */
  contorno: number
}

function multiplicar(a: number, b: number): number {
  const canal = (deslocamento: number) => Math.round((((a >> deslocamento) & 0xff) * ((b >> deslocamento) & 0xff)) / 255)
  return (canal(16) << 16) | (canal(8) << 8) | canal(0)
}

function escurecer(cor: number, fator: number): number {
  const canal = (deslocamento: number) => Math.round(((cor >> deslocamento) & 0xff) * fator)
  return (canal(16) << 16) | (canal(8) << 8) | canal(0)
}

/** A aparência da escada com material; `null` = "Só linhas", o desenho de sempre. */
export function aparenciaDaEscada(escada: Pick<Stair, 'material' | 'tom' | 'estadoDoMetal' | 'feitioDaPedra'>): AparenciaDaEscada | null {
  const { material } = escada
  if (!ehMaterialDaEscada(material)) return null
  let folha: FolhaDaEscada
  let tinta = 0xffffff
  switch (material) {
    case 'madeira':
      folha = 'madeira'
      tinta = Number.parseInt(MATERIAIS[escada.tom ?? TOM_PADRAO].tom.slice(1), 16)
      break
    case 'metal':
      folha = escada.estadoDoMetal === 'enferrujada' ? 'metal-enferrujada' : 'metal-nova'
      break
    case 'pedra':
      folha = escada.feitioDaPedra === 'pedregulhos' ? 'pedra-pedregulhos' : 'pedra-cascalho'
      break
    case 'ceramica':
      folha = 'ceramica'
      break
    case 'tijolo':
      folha = 'tijolo'
      break
  }
  const media = multiplicar(COR_MEDIA_DA_FOLHA[folha], tinta)
  return { folha, tinta, media, contorno: escurecer(media, LUZ_DO_CONTORNO) }
}

/** A amostra do painel (`imagens/amostras/<id>.png`): a da madeira é por tom. */
export function amostraDaEscada(escada: Pick<Stair, 'material' | 'tom' | 'estadoDoMetal' | 'feitioDaPedra'>): string | null {
  const aparencia = aparenciaDaEscada(escada)
  if (aparencia === null) return null
  return aparencia.folha === 'madeira' ? `madeira-${escada.tom ?? TOM_PADRAO}` : aparencia.folha
}
