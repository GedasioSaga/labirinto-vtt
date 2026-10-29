import { Container, Graphics, Texture, TilingSprite } from 'pixi.js'
import type { Caixa } from '../lib/texturas'
import type { FloorPolygon } from '../lib/floorContour'
import type { RegionPoint } from '../types/map'
import { desenhadoLigado, versaoDoEstilo } from '../lib/estiloDoMapa'
import { assinarDesenhado, chaoParaPintar, pedirChaoDesenhado } from '../texturas/desenhado/carregador'
import type { IdDoChaoDesenhado } from '../texturas/desenhado/chao'
import { TINGIR_PADRAO, rampaGuardada } from '../texturas/desenhado/tingir'
import { montarChaoEmPedacos, type CacheDoChao, type ChaoEmPedacos } from './pedacosDoChao'

/**
 * O PISO DESENHADO (plano de 29/10/2026, F1b): o chão das peças do Chão
 * (`FloorPiece.fillColor`) e o fundo das salas (`Region.fillColor`) no estilo
 * Desenhado. Cada forma vira os pedaços do chão `piso` do pacote, tingidos pela
 * cor dela (`texturas/desenhado/tingir.ts`), pelo mesmo cache de pedaços das
 * texturas (o teto de 64 MB de placa não cresce), vistos por uma máscara de
 * stencil com a forma (sem textura de filtro: nenhum byte a mais na placa).
 *
 * A cor chapada de hoje continua por baixo (é o Atual): enquanto as imagens
 * não chegam, ou se o chão não carregar, a tela mostra o Atual, sem buraco.
 * Quando o carregador avisa (`assinarDesenhado`), a camada monta sozinha.
 */

/** Uma forma com piso: o que a máscara desenha, a caixa dela e a cor que o piso pega. */
export interface FormaDoPiso {
  /** Identidade estável da forma (a mesma forma, a mesma camada de pedaços). */
  readonly chave: string
  readonly textura: IdDoChaoDesenhado
  /** A cor que o piso pega; `null` = a cor da própria textura (o caminho). */
  readonly cor: string | null
  /** O que forma a máscara, por referência: mudou = traça de novo. */
  readonly desenho: unknown
  readonly caixa: Caixa
  /** Desenha a forma (cheia) na máscara. */
  readonly tracar: (g: Graphics) => void
}

export interface ContextoDoPiso {
  /** `MapData.id`: o teto de memória do carregador é por mapa. */
  readonly cena: string
  /** px do mundo por casa: o Desenhado tem 64 px por casa. */
  readonly grid: number
  readonly cache: CacheDoChao
}

export interface CamadaDePiso {
  readonly camada: Container
  /** `contexto` nulo (estilo que não é o Desenhado, modo raster): a camada fica vazia. */
  atualizar: (formas: readonly FormaDoPiso[], contexto: ContextoDoPiso | null) => void
  ajustarAVista: (vista: Caixa | null) => void
  destruir: () => void
}

interface NoDoPiso {
  readonly chaveDoChao: string
  readonly desenho: unknown
  readonly chao: ChaoEmPedacos
  readonly mascara: Graphics
}

const BRANCO = 0xffffff
/** O piso pinta um nível acima do da vista (`MontagemDoChao.nivelAMais`). */
const NIVEL_A_MAIS_DO_PISO = 1

function soltarNo(no: NoDoPiso): void {
  no.chao.soltar()
  no.mascara.destroy()
}

export function criarCamadaDePiso(): CamadaDePiso {
  const camada = new Container()
  camada.label = 'piso-desenhado'
  camada.eventMode = 'none'
  let nos = new Map<string, NoDoPiso>()
  let vista: Caixa | null = null
  let ultimas: { formas: readonly FormaDoPiso[]; contexto: ContextoDoPiso } | null = null
  let destruida = false

  function limpar(): void {
    for (const no of nos.values()) soltarNo(no)
    nos.clear()
  }

  function montar(forma: FormaDoPiso, contexto: ContextoDoPiso, chaveDoChao: string, rampa: Uint8Array | null): NoDoPiso | null {
    const carregado = pedirChaoDesenhado(forma.textura, contexto.cena)
    if (carregado === null) return null
    const mascara = new Graphics()
    forma.tracar(mascara)
    // O placeholder é a cor chapada que já está por baixo: a repetida não desenha nada.
    const repetida = new TilingSprite({ texture: Texture.EMPTY, width: 0, height: 0 })
    repetida.visible = false
    const chao = montarChaoEmPedacos({
      cache: contexto.cache,
      chaveDoChao,
      chao: chaoParaPintar(carregado, contexto.grid, rampa),
      caixa: forma.caixa,
      repetida,
      vista,
      // Meia resolução: o piso é calmo (sem atlas) e a sala cobre muito chão; um quarto da placa.
      nivelAMais: NIVEL_A_MAIS_DO_PISO,
    })
    chao.grupo.mask = mascara
    return { chaveDoChao, desenho: forma.desenho, chao, mascara }
  }

  function atualizar(formas: readonly FormaDoPiso[], contexto: ContextoDoPiso | null): void {
    if (destruida) return
    if (contexto === null || !desenhadoLigado()) {
      ultimas = null
      limpar()
      camada.removeChildren()
      return
    }
    ultimas = { formas, contexto }
    const proximos = new Map<string, NoDoPiso>()
    for (const forma of formas) {
      const carregado = pedirChaoDesenhado(forma.textura, contexto.cena)
      if (carregado === null) continue
      const conta = carregado.textura.tingir ?? TINGIR_PADRAO
      const rampa = forma.cor === null ? null : rampaGuardada(forma.cor, conta)
      // Cor que não é cor (texto estranho no arquivo): fica a chapada de hoje.
      if (forma.cor !== null && rampa === null) continue
      const chaveDoChao = `desenhado:${forma.textura}#${contexto.grid}#${forma.cor ?? ''}#${versaoDoEstilo()}`
      const velho = nos.get(forma.chave)
      if (velho !== undefined && velho.chaveDoChao === chaveDoChao && velho.desenho === forma.desenho) {
        nos.delete(forma.chave)
        proximos.set(forma.chave, velho)
        continue
      }
      const novo = montar(forma, contexto, chaveDoChao, rampa)
      if (novo !== null) proximos.set(forma.chave, novo)
    }
    limpar()
    nos = proximos
    // A ordem das formas é a ordem de pintura (a peça nova por cima da velha).
    camada.removeChildren()
    for (const no of nos.values()) camada.addChild(no.chao.grupo, no.mascara)
  }

  const pararDeOuvir = assinarDesenhado(() => {
    if (ultimas !== null) atualizar(ultimas.formas, ultimas.contexto)
  })

  return {
    camada,
    atualizar,
    ajustarAVista: (agora) => {
      vista = agora
      for (const no of nos.values()) no.chao.ajustar(agora)
    },
    destruir: () => {
      destruida = true
      pararDeOuvir()
      limpar()
      camada.destroy({ children: true })
    },
  }
}

/** A caixa de pontos (anéis de polígono); `null` = sem pontos. */
export function caixaDosPontos(aneis: readonly (readonly RegionPoint[])[]): Caixa | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const anel of aneis) {
    for (const p of anel) {
      if (p.x < minX) minX = p.x
      if (p.y < minY) minY = p.y
      if (p.x > maxX) maxX = p.x
      if (p.y > maxY) maxY = p.y
    }
  }
  if (!(maxX > minX && maxY > minY)) return null
  return { minX: Math.floor(minX), minY: Math.floor(minY), maxX: Math.ceil(maxX), maxY: Math.ceil(maxY) }
}

function achatar(anel: readonly RegionPoint[]): number[] {
  const out: number[] = new Array(anel.length * 2)
  anel.forEach((p, i) => {
    out[i * 2] = p.x
    out[i * 2 + 1] = p.y
  })
  return out
}

/** Polígonos do contorno do chão, cheios e com os buracos recortados (como `drawFloor.fillPolygons`). */
export function tracarPoligonos(g: Graphics, poligonos: readonly FloorPolygon[]): void {
  for (const poligono of poligonos) {
    g.poly(achatar(poligono.outer), true).fill({ color: BRANCO })
    for (const buraco of poligono.holes) g.poly(achatar(buraco), true).cut()
  }
}

/** Uma camada de cor do chão (`drawFloor.FloorColorLayer`): `null` = a cor do chão do mapa. */
interface CamadaDeCor {
  readonly color: string | null
  readonly polygons: FloorPolygon[]
}

/**
 * As formas do piso do Chão: o contorno inteiro na cor do chão do mapa e, por
 * cima, cada camada de cor própria, na ordem do `drawFloor` (a mesma pintura,
 * agora com piso).
 */
export function formasDoPisoDoChao(poligonos: readonly FloorPolygon[], camadas: readonly CamadaDeCor[], corDoChao: string): FormaDoPiso[] {
  const formas: FormaDoPiso[] = []
  const lista: { chave: string; cor: string; poligonos: readonly FloorPolygon[] }[] = [
    { chave: 'chao:base', cor: corDoChao, poligonos },
    ...camadas.map((c, k) => ({ chave: `chao:${k}`, cor: c.color ?? corDoChao, poligonos: c.polygons })),
  ]
  for (const item of lista) {
    const caixa = caixaDosPontos(item.poligonos.map((p) => p.outer))
    if (caixa === null) continue
    formas.push({ chave: item.chave, textura: 'piso', cor: item.cor, desenho: item.poligonos, caixa, tracar: (g) => tracarPoligonos(g, item.poligonos) })
  }
  return formas
}
