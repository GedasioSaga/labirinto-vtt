import type { MapData } from '../types/map'
import { boundsOfDrawing, boundsOfRegion, boundsOfWall } from './areaSelection'
import { caixaDoAlvo } from './baldeDeTextura'
import { contextoDeCamadas } from './camadas/consulta'
import type { ItemPorTipo, TipoDeObjeto } from './camadas/padrao'
import { caixaDoCarimbo } from './carimbos'
import { caixaDaAgua } from './agua/forma'
import { pieceBounds } from './floorSdf'
import { mapForImageExport } from './mapImageExport'
import { mapaDoPiso, pisoDe } from './pisos'
import { caixaDoCaminho } from './texturas'

/**
 * MINIATURA DA CENA NA LISTA (pedido de 25/11/2026: "sem textura e focam lá
 * longe"). A conta de O QUE sai na miniatura e ONDE ela enquadra, e a redução
 * final; quem pinta é o canvas do editor (`gerarMiniatura`,
 * `pixi/PixiCanvas.tsx`), pelos mesmos renderers do "Exportar imagem" — chão
 * pintado, carimbos, paredes, objetos e salas no estilo de agora. Quem guarda
 * e enfileira é `stores/miniaturasDasCenas.ts`.
 */

/** Pinta a miniatura de uma cena; `null` = nada desenhado nela (a lista mostra o ícone). */
export type FabricanteDeMiniatura = (cena: MapData) => Promise<Blob | null>

/** A imagem guardada: 4:3, a caixa da linha da lista (`.lb-cenas__mini`, 40 × 30). */
export const MINIATURA_LARGURA_PX = 256
export const MINIATURA_ALTURA_PX = 192
/** O canvas desenha no dobro e a redução faz o serrilhado sumir (fio de parede de 1 px some num corte direto). */
export const MINIATURA_SUPERAMOSTRA = 2
/**
 * Mudou o desenho da miniatura (outro enquadramento, outra camada)? Sobe o
 * número: as guardadas com o antigo deixam de valer e são refeitas.
 */
export const VERSAO_DA_MINIATURA = 1

/** WebP com perda leve: ~10-20 KB por cena, sem mancha visível no tamanho mostrado. */
const QUALIDADE_DO_WEBP = 0.86

/** Folga em volta do conteúdo, em fração do lado maior da caixa: o desenho não encosta na borda. */
const MARGEM_DO_CONTEUDO = 0.06
/** O quadro nunca é menor que isto, em casas da grade: um barril sozinho não vira uma mancha do tamanho da caixa. */
const MENOR_QUADRO_EM_CASAS = 6

export interface Caixa {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** O pedaço do mundo que a miniatura mostra, em px de mundo, já na proporção dela. */
export interface QuadroDaMiniatura {
  x: number
  y: number
  width: number
  height: number
}

export interface PlanoDaMiniatura {
  /** O mapa de um piso só, sem fichas, pinos e o que é só do mestre. */
  mapa: MapData
  piso: number
  quadro: QuadroDaMiniatura
}

function caixaVazia(): Caixa {
  return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
}

/** Soma a caixa `b` em `a`. A degenerada (polígono sem ponto, número torto) não entra. */
function somar(a: Caixa, b: Caixa | null): void {
  if (b === null) return
  if (![b.minX, b.minY, b.maxX, b.maxY].every(Number.isFinite) || b.maxX < b.minX || b.maxY < b.minY) return
  a.minX = Math.min(a.minX, b.minX)
  a.minY = Math.min(a.minY, b.minY)
  a.maxX = Math.max(a.maxX, b.maxX)
  a.maxY = Math.max(a.maxY, b.maxY)
}

/** A caixa do objeto girado em torno do centro (`x`, `y` é o centro dele, como em `pontosDoObjeto`). */
function caixaDoObjeto(p: MapData['props'][number]): Caixa {
  const rad = ((p.rotation ?? 0) * Math.PI) / 180
  const cos = Math.abs(Math.cos(rad))
  const sen = Math.abs(Math.sin(rad))
  const meiaL = (p.width * cos + p.height * sen) / 2
  const meiaA = (p.width * sen + p.height * cos) / 2
  return { minX: p.x - meiaL, minY: p.y - meiaA, maxX: p.x + meiaL, maxY: p.y + meiaA }
}

function caixaDosSegmentos(segmentos: readonly { x1: number; y1: number; x2: number; y2: number }[]): Caixa {
  const caixa = caixaVazia()
  for (const s of segmentos) {
    somar(caixa, { minX: Math.min(s.x1, s.x2), minY: Math.min(s.y1, s.y2), maxX: Math.max(s.x1, s.x2), maxY: Math.max(s.y1, s.y2) })
  }
  return caixa
}

/**
 * A CAIXA DO CONTEÚDO: a união do que o mestre desenhou e enxerga — peças de
 * chão, salas, textura pintada (pincel e balde), paredes, objetos, carimbos,
 * desenhos, escadas, linhas de minimapa e água. A ficha não conta (andar com
 * ela não muda o mapa) nem o retângulo do mapa (é ele o "lá longe" vazio).
 * `null` = nada desenhado.
 */
export function caixaDoConteudo(map: MapData): Caixa | null {
  const camadas = contextoDeCamadas(map)
  // O olho "Mestre vê" da camada do item: a camada escondida no editor não puxa o quadro para onde nada aparece.
  const ve = <K extends TipoDeObjeto>(tipo: K, item: ItemPorTipo[K]): boolean => camadas.mestreVe(camadas.camadaDe(tipo, item))
  const caixa = caixaVazia()

  for (const peca of map.floor) if (peca.op === 'add' && ve('peca', peca)) somar(caixa, pieceBounds(peca))
  for (const regiao of map.regions) if (regiao.points.length >= 3 && ve('regiao', regiao)) somar(caixa, boundsOfRegion(regiao))
  for (const parede of map.walls) if (ve('parede', parede)) somar(caixa, boundsOfWall(parede))
  for (const objeto of map.props) if (ve('objeto', objeto)) somar(caixa, caixaDoObjeto(objeto))
  for (const carimbo of map.carimbos ?? []) if (ve('carimbo', carimbo)) somar(caixa, caixaDoCarimbo(carimbo))
  for (const desenho of map.drawings) if (ve('desenho', desenho)) somar(caixa, boundsOfDrawing(desenho))
  for (const escada of map.stairs) if (ve('escada', escada)) somar(caixa, caixaDosSegmentos(escada.segments))
  for (const linha of map.lines) if (linha.points.length > 0 && ve('linha', linha)) somar(caixa, caixaDoCaminho(linha.points, 0))

  if (camadas.mestreVe('terreno')) {
    for (const passo of map.texturas ?? []) {
      // A borracha e o "esvaziar" só tiram tinta; a "sala" pinta a sala, que já está na caixa.
      if (passo.tipo === 'pincel' && passo.pontos.length > 0) somar(caixa, caixaDoCaminho(passo.pontos, passo.raio))
      else if (passo.tipo === 'balde') somar(caixa, caixaDoAlvo(passo.alvo, map.regions, map.drawings))
    }
    for (const agua of map.aguas ?? []) {
      const c = caixaDaAgua(agua, map.grid)
      somar(caixa, { minX: c.x0, minY: c.y0, maxX: c.x1, maxY: c.y1 })
    }
  }

  return caixa.minX <= caixa.maxX && caixa.minY <= caixa.maxY ? caixa : null
}

/**
 * O quadro da miniatura em volta de `caixa`: com folga, nunca menor que
 * `MENOR_QUADRO_EM_CASAS` e na proporção da imagem. Conteúdo mais largo (ou
 * mais alto) que 4:3 fica no MEIO-TERMO entre caber inteiro (sobra faixa
 * escura) e encher a caixa (corta as pontas): metade do caminho em escala, o
 * corte é central. A estrada comprida não vira um fio, nem perde as duas pontas.
 */
export function quadroDaMiniatura(caixa: Caixa, grid: number): QuadroDaMiniatura {
  const proporcao = MINIATURA_LARGURA_PX / MINIATURA_ALTURA_PX
  const ladoMaior = Math.max(caixa.maxX - caixa.minX, caixa.maxY - caixa.minY)
  const folga = ladoMaior * MARGEM_DO_CONTEUDO
  const menor = Number.isFinite(grid) && grid > 0 ? grid * MENOR_QUADRO_EM_CASAS : 0
  let largura = Math.max(caixa.maxX - caixa.minX + 2 * folga, menor)
  let altura = Math.max(caixa.maxY - caixa.minY + 2 * folga, menor / proporcao)
  if (largura / altura > proporcao) {
    // Caber inteiro: a largura fica e a altura cresce. Encher: a altura fica e a largura encolhe.
    largura = Math.sqrt(largura * altura * proporcao)
    altura = largura / proporcao
  } else if (largura / altura < proporcao) {
    altura = Math.sqrt(altura * (largura / proporcao))
    largura = altura * proporcao
  }
  const cx = (caixa.minX + caixa.maxX) / 2
  const cy = (caixa.minY + caixa.maxY) / 2
  return { x: cx - largura / 2, y: cy - altura / 2, width: largura, height: altura }
}

/**
 * O mapa como a miniatura o mostra: a imagem "para os jogadores" do Exportar
 * imagem (`mapForImageExport` sem "Incluir objetos só do mestre": sem sala
 * secreta, zona oculta, item oculto, interior da casa de teto fechado), sem
 * grade, e também sem as fichas, os pinos e a luz presa numa ficha (o halo
 * boiaria onde ela estava). Na caixa de 40 px, a ficha era o "pontinho".
 */
export function mapaDaMiniatura(map: MapData): MapData {
  const paraOsJogadores = mapForImageExport(map, { grid: false, masterOnly: false })
  return {
    ...paraOsJogadores,
    tokens: [],
    pins: [],
    lights: paraOsJogadores.lights.filter((luz) => luz.attachedTokenId === undefined),
  }
}

/** Os pisos da cena na ordem da escolha: o térreo, os de cima do mais baixo ao mais alto, e só então os porões. */
function pisosEmOrdem(map: MapData): number[] {
  const pisos = new Set<number>([0])
  const listas = [map.floor, map.regions, map.walls, map.props, map.drawings, map.stairs, map.carimbos ?? [], map.texturas ?? []]
  for (const lista of listas) for (const item of lista) pisos.add(pisoDe(item))
  const chave = (piso: number): number => (piso >= 0 ? piso : Number.MAX_SAFE_INTEGER / 2 - piso)
  return [...pisos].sort((a, b) => chave(a) - chave(b))
}

/**
 * O que a miniatura de `cena` desenha: o térreo, ou o primeiro piso com
 * conteúdo, e o quadro dele. `null` = cena vazia (a lista mostra o ícone).
 */
export function planoDaMiniatura(cena: MapData): PlanoDaMiniatura | null {
  for (const piso of pisosEmOrdem(cena)) {
    const mapa = mapaDaMiniatura(mapaDoPiso(cena, piso))
    const caixa = caixaDoConteudo(mapa)
    if (caixa !== null) return { mapa, piso, quadro: quadroDaMiniatura(caixa, mapa.grid) }
  }
  return null
}

/**
 * A REDUÇÃO: o canvas pintado no dobro (`MINIATURA_SUPERAMOSTRA`) vira a
 * imagem de 256 × 192 com suavização alta, em WebP (o navegador sem WebP
 * devolve PNG). Lança se `fonte` não é um canvas que o 2D saiba ler.
 */
export async function reduzirParaMiniatura(fonte: unknown): Promise<Blob | null> {
  const imagem = fonte instanceof HTMLCanvasElement ? fonte : typeof OffscreenCanvas !== 'undefined' && fonte instanceof OffscreenCanvas ? fonte : null
  if (imagem === null) throw new Error('a pintura da miniatura não devolveu um canvas')
  const destino = document.createElement('canvas')
  destino.width = MINIATURA_LARGURA_PX
  destino.height = MINIATURA_ALTURA_PX
  const ctx = destino.getContext('2d')
  if (ctx === null) throw new Error('sem contexto 2D para reduzir a miniatura')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(imagem, 0, 0, MINIATURA_LARGURA_PX, MINIATURA_ALTURA_PX)
  const blob = await new Promise<Blob | null>((resolve) => destino.toBlob(resolve, 'image/webp', QUALIDADE_DO_WEBP))
  if (blob === null) throw new Error('o navegador não gerou a imagem da miniatura')
  return blob
}

/**
 * cyrb53 (domínio público): 53 bits de hash do texto. Duas cenas diferentes
 * com a mesma assinatura teriam de bater os 53 bits E o tamanho do texto.
 */
function hash53(texto: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < texto.length; i += 1) {
    const c = texto.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

const assinaturas = new WeakMap<MapData, string>()

/**
 * A assinatura do que a miniatura desenha: o mapa inteiro sem as fichas (a
 * ficha que anda não refaz a imagem), mais a versão do desenho. Mesma
 * assinatura = mesma imagem, também de uma abertura do app para a outra.
 * Guardada por referência (a store é imutável): o texto sai uma vez por mapa.
 */
export function assinaturaDaMiniatura(map: MapData): string {
  const guardada = assinaturas.get(map)
  if (guardada !== undefined) return guardada
  const texto = JSON.stringify({ ...map, tokens: [] })
  const assinatura = `v${VERSAO_DA_MINIATURA}-${texto.length.toString(36)}-${hash53(texto)}`
  assinaturas.set(map, assinatura)
  return assinatura
}
