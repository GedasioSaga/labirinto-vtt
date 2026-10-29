import { AlphaFilter, BlurFilter, Container, Graphics, type Geometry, type Mesh, type Renderer, type Shader, type TextureSource } from 'pixi.js'
import { desenhadoLigado } from '../lib/estiloDoMapa'
import { assinarTracosDesenhados, pedirFaceDoTraco, type FaceCarregada } from '../texturas/desenhado/carregadorDoTraco'
import { rampaDoTom } from '../texturas/desenhado/movel'
import { lerParamsDaParede, malhasDasParedes, PAPEIS_DA_PAREDE, type CadeiaDaParede, type PapelDaParede, type ParamsDaParede } from '../texturas/desenhado/parede'
import { CASA_DO_TRACO, type AlturaDoTraco } from '../texturas/desenhado/traco'
import type { Rgb } from '../texturas/ruido'
import { SELECTION_COLOR } from './constants'
import { clampWallWidth, drawWallMarks, drawWalls, groupWallChains, isClosedChain, selectionOutlineWidth, traceWallChain, wallColorFor, type WallWithStyle } from './drawWalls'
import { atlasDasRampas, chaveDaCor, meshDoContorno, meshDoMiolo, paredeCompila } from './malhaDaParede'
import { soltarMesh, texturaDoTraco, type ImagemNaPlaca } from './malhaDoTraco'

/**
 * AS PAREDES NO ESTILO DESENHADO (plano de 29/10/2026, F4b; CONTRATO.md 11.15),
 * por nó da faixa das paredes (editor e jogador). Dentro do nó, de baixo para
 * cima:
 *  1. `vetor`: o Atual de sempre (`drawWalls`), quando o mapa não é Desenhado,
 *     as imagens ainda não chegaram ou o shader não compilou;
 *  2. `abaixo`: o contorno amarelo da seleção (parede, Sala), por baixo, como no Atual;
 *  3. a SOMBRA: a faixa inteira de todas as paredes, andada 5 px na direção
 *     (7, 11), desfocada e com alfa 0,25 (a união antes do alfa: sem dobra no cruzamento);
 *  4. o CONTORNO: a faixa inteira de todas as cadeias no valor 0,10 da rampa;
 *  5. os MIOLOS: a alvenaria pela espessura (Baixo lajes, Médio blocos, Alto
 *     muralha), na ordem da referência: o T primeiro, a mais fina, a fechada por
 *     último. O miolo de uma apaga o contorno da outra: o T e o cruzamento se fundem;
 *  6. `acima`: as marcas do editor (a invisível e a passagem tracejadas).
 *
 * A janela e a grade não partem a cadeia: são trechos dela com a imagem
 * própria. A porta parte (o vão é dela, `drawDoors.ts`). A visão, a névoa e o
 * bloqueio não passam por aqui: só o desenho muda.
 *
 * A espessura é do MUNDO só no Desenhado (decisão do usuário): fina 12, média
 * 20, grossa 32 px do traço (vezes `grid / 64`); a contínua passa direto. No
 * Atual e no Simples, a parede continua em px de tela.
 */

type Pt = readonly [number, number]

export interface PedidoDasParedes {
  /** As paredes que saem na tela (o jogador: só as perto da ficha e as já vistas). */
  readonly walls: WallWithStyle[]
  /** As paredes de que saem as cadeias (o jogador manda todas as do nó: a sequência é a mesma do mestre). */
  readonly todas?: readonly WallWithStyle[]
  readonly selectedWallId: string | null
  readonly cameraScale: number
  readonly rendererResolution: number
  readonly highlightedRegionId: string | null
  readonly marcarPassagem: boolean
  readonly grid: number
}

export interface PintorDeParedes {
  desenhar: (no: Container, pedido: PedidoDasParedes) => void
  destroy: () => void
}

/** Os ids do pacote (CONTRATO 11.15). */
const ID_DA_PAREDE = 'parede'
const ID_DA_JANELA = 'janela'
const ID_DA_GRADE = 'grade-de-prisao'

/** O desvio da sombra de três caixas, como desvio do gaussiano do Pixi (5 tomadas: 1,29 do passo). */
const DESVIO_POR_FORCA = 1.29
/** A resolução dos alvos do filtro da sombra (relativa à tela). */
const RESOLUCAO_DA_SOMBRA = 0.5

interface Tinta {
  readonly parede: FaceCarregada
  readonly janela: FaceCarregada | null
  readonly grade: FaceCarregada | null
  readonly params: ParamsDaParede
}

/** A tinta pronta (a da parede é obrigatória; sem a janela ou a grade, a parede vale por elas). */
function tintaPronta(): Tinta | null {
  const parede = pedirFaceDoTraco(ID_DA_PAREDE)
  const janela = pedirFaceDoTraco(ID_DA_JANELA)
  const grade = pedirFaceDoTraco(ID_DA_GRADE)
  if (parede === null) return null
  const params = lerParamsDaParede(parede.bruto)
  return params === null ? null : { parede, janela, grade, params }
}

// ---------- as cadeias com as paredes do app ----------

function papelDe(w: WallWithStyle): PapelDaParede {
  if (w.janela !== true) return 'parede'
  return w.grade === true ? 'grade' : 'janela'
}

/** A espessura em px do traço: o degrau pelo `parede.espessuraDoDegrauPx`; a contínua (px do mundo) passa direto. */
function espessuraDoTraco(w: WallWithStyle, p: ParamsDaParede, k: number): number {
  const t = w.thickness
  if (typeof t === 'number' && Number.isFinite(t)) return clampWallWidth(t) / k
  return t === 'thin' || t === 'thick' ? p.degrau[t] : p.degrau.medium
}

function rgbDe(cor: number): Rgb {
  return [(cor >> 16) & 255, (cor >> 8) & 255, cor & 255]
}

function invertida<T extends WallWithStyle>(cadeia: readonly T[]): T[] {
  return [...cadeia].reverse().map((w) => ({ ...w, x1: w.x2, y1: w.y2, x2: w.x1, y2: w.y1 }))
}

const PERTO = 1e-6

function mesmoPonto(ax: number, ay: number, bx: number, by: number): boolean {
  return Math.abs(ax - bx) < PERTO && Math.abs(ay - by) < PERTO
}

/**
 * As cadeias soltas que se tocam ponta com ponta viram uma (a parede solta não tem
 * `regionEdgeIndex`): a janela de uma parede solta emenda na vizinha e o L de duas
 * soltas fecha em esquadro. Três pontas no mesmo ponto: junta o par mais reto; a
 * terceira fica como o T.
 */
function juntarSoltas<T extends WallWithStyle>(cadeias: T[][], quebra: (a: T, b: T) => boolean): T[][] {
  const lista = cadeias.map((c) => [...c])
  for (let volta = 0; volta < 10000; volta += 1) {
    let feito = false
    const pontas: { i: number; fim: boolean; x: number; y: number; dx: number; dy: number }[] = []
    lista.forEach((c, i) => {
      if (c.length === 0 || isClosedChain(c)) return
      const a = c[0]
      const b = c[c.length - 1]
      const la = Math.hypot(a.x2 - a.x1, a.y2 - a.y1) || 1
      const lb = Math.hypot(b.x2 - b.x1, b.y2 - b.y1) || 1
      pontas.push({ i, fim: false, x: a.x1, y: a.y1, dx: (a.x2 - a.x1) / la, dy: (a.y2 - a.y1) / la })
      pontas.push({ i, fim: true, x: b.x2, y: b.y2, dx: (b.x1 - b.x2) / lb, dy: (b.y1 - b.y2) / lb })
    })
    let melhor: { p: (typeof pontas)[number]; q: (typeof pontas)[number]; reto: number } | null = null
    for (let u = 0; u < pontas.length; u += 1) {
      for (let v = u + 1; v < pontas.length; v += 1) {
        const p = pontas[u]
        const q = pontas[v]
        if (p.i === q.i || !mesmoPonto(p.x, p.y, q.x, q.y)) continue
        const wp = p.fim ? lista[p.i][lista[p.i].length - 1] : lista[p.i][0]
        const wq = q.fim ? lista[q.i][lista[q.i].length - 1] : lista[q.i][0]
        if (quebra(wp, wq)) continue
        const reto = -(p.dx * q.dx + p.dy * q.dy)
        if (melhor === null || reto > melhor.reto) melhor = { p, q, reto }
      }
    }
    if (melhor !== null) {
      // O sentido de quem já vem riscado na ordem fica (a sequência dos blocos sai do id da primeira).
      const { p, q } = melhor
      const [primeira, segunda] = p.fim ? [p, q] : q.fim ? [q, p] : [q, p]
      const A = primeira.fim ? lista[primeira.i] : invertida(lista[primeira.i])
      const B = segunda.fim ? invertida(lista[segunda.i]) : lista[segunda.i]
      lista[primeira.i] = [...A, ...B]
      lista[segunda.i] = []
      feito = true
    }
    if (!feito) break
  }
  return lista.filter((c) => c.length > 0)
}

/** As cadeias Desenhadas de um nó: as paredes desenháveis (sem porta e não invisíveis), em px do mundo. */
function cadeiasDoNo(todas: readonly WallWithStyle[], saem: ReadonlySet<string>, p: ParamsDaParede, k: number, linhaDaCor: (c: Rgb) => number): CadeiaDaParede[] {
  const solidas = todas.filter((w) => w.door === null && w.hidden !== true && Math.hypot(w.x2 - w.x1, w.y2 - w.y1) > PERTO)
  const quebra = (a: WallWithStyle, b: WallWithStyle): boolean => espessuraDoTraco(a, p, k) !== espessuraDoTraco(b, p, k) || wallColorFor(a) !== wallColorFor(b)
  const cadeias = juntarSoltas(groupWallChains(solidas, quebra), quebra)
  const out: CadeiaDaParede[] = []
  for (const c of cadeias) {
    const fechada = isClosedChain(c)
    const pontos: Pt[] = [[c[0].x1, c[0].y1]]
    for (const w of c) pontos.push([w.x2, w.y2])
    if (fechada) pontos.pop()
    out.push({
      id: c[0].id,
      pontos,
      papeis: c.map(papelDe),
      desenha: c.map((w) => saem.has(w.id)),
      fechada,
      espessura: espessuraDoTraco(c[0], p, k),
      linha: linhaDaCor(rgbDe(wallColorFor(c[0]))),
    })
  }
  return out
}

// ---------- o pintor ----------

const rampasGuardadas = new Map<string, Float32Array>()

function rampaDa(cor: Rgb, p: ParamsDaParede): Float32Array {
  const chave = chaveDaCor(cor)
  let r = rampasGuardadas.get(chave)
  if (r === undefined) {
    r = rampaDoTom(cor, p.rampa)
    rampasGuardadas.set(chave, r)
  }
  return r
}

function faceDoItem(t: Tinta, item: PapelDaParede): FaceCarregada {
  return (item === 'janela' ? t.janela : item === 'grade' ? t.grade : null) ?? t.parede
}

/** A margem do anti-serrilhado em px do mundo: fixa de 100% para cima (o zoom não refaz a malha). */
function pxDaTela(escala: number): number {
  return 1 / Math.min(1, Number.isFinite(escala) && escala > 0 ? escala : 1)
}

export function criarPintorDeParedes(): PintorDeParedes {
  const vetor = new Graphics()
  const abaixo = new Graphics()
  const acima = new Graphics()
  const desenhado = new Container()
  const sombra = new Container()
  const sombraG = new Graphics()
  // A sombra é borrada: meia resolução basta e os alvos do filtro pesam um quarto na placa.
  const desfoque = new BlurFilter({ strength: 4, quality: 3, resolution: RESOLUCAO_DA_SOMBRA })
  const alfaDaSombra = new AlphaFilter({ alpha: 0.25, resolution: RESOLUCAO_DA_SOMBRA })
  for (const n of [vetor, abaixo, acima, desenhado, sombra, sombraG]) n.eventMode = 'none'
  sombra.addChild(sombraG)
  sombra.filters = [desfoque, alfaDaSombra]
  let no: Container | null = null
  let ultimo: PedidoDasParedes | null = null
  let semShader = false
  let conferido: Renderer | null = null
  let meshes: Mesh<Geometry, Shader>[] = []
  let atlas: TextureSource | null = null
  let chaveDaMalha = ''
  const imagens = new Map<string, { face: FaceCarregada; img: ImagemNaPlaca }>()

  desenhado.onRender = (renderer: Renderer) => {
    if (conferido === renderer || meshes.length === 0) return
    conferido = renderer
    if (!paredeCompila(renderer)) {
      semShader = true
      if (no !== null && ultimo !== null) desenhar(no, ultimo)
    }
  }

  const pararDeOuvir = assinarTracosDesenhados(() => {
    if (no !== null && ultimo !== null) desenhar(no, ultimo)
  })

  function soltarMalhas(): void {
    for (const m of meshes) {
      desenhado.removeChild(m)
      soltarMesh(m)
    }
    meshes = []
    atlas?.destroy()
    atlas = null
    sombraG.clear()
    chaveDaMalha = ''
  }

  function soltarImagens(): void {
    for (const { img } of imagens.values()) {
      img.cor.destroy()
      img.relevo.destroy()
    }
    imagens.clear()
  }

  function imagemDe(t: Tinta, item: PapelDaParede, altura: AlturaDoTraco): ImagemNaPlaca {
    const face = faceDoItem(t, item)
    const chave = `${item}:${altura}`
    const pronta = imagens.get(chave)
    if (pronta !== undefined && pronta.face === face) return pronta.img
    if (pronta !== undefined) {
      pronta.img.cor.destroy()
      pronta.img.relevo.destroy()
    }
    const medidas = face.face.alturas[altura]
    const img: ImagemNaPlaca = {
      cor: texturaDoTraco(face.imagens[altura].cor, false),
      relevo: texturaDoTraco(face.imagens[altura].relevo, true),
      acimaPx: face.face.acimaPx,
      hPx: medidas.hPx,
      largura: medidas.largura,
      altura: medidas.altura,
    }
    imagens.set(chave, { face, img })
    return img
  }

  function montar(alvo: Container): void {
    if (no === alvo) return
    no = alvo
    desenhado.addChildAt(sombra, 0)
    alvo.addChild(vetor, abaixo, desenhado, acima)
  }

  /** A seleção por baixo, na espessura do mundo (a do Atual é de tela). */
  function pintarSelecao(pedido: PedidoDasParedes, larguraDe: (w: WallWithStyle) => number): void {
    abaixo.clear()
    const borda = 2 * selectionOutlineWidth(pedido.cameraScale)
    if (pedido.highlightedRegionId !== null) {
      const proprias = pedido.walls.filter((w) => w.regionId === pedido.highlightedRegionId)
      for (const cadeia of groupWallChains(proprias, () => false)) {
        traceWallChain(abaixo, cadeia)
        abaixo.stroke({ width: Math.max(...cadeia.map(larguraDe)) + borda, color: SELECTION_COLOR, cap: 'square', join: 'miter' })
      }
    }
    const escolhida = pedido.selectedWallId === null ? undefined : pedido.walls.find((w) => w.id === pedido.selectedWallId && w.door === null)
    if (escolhida !== undefined) {
      abaixo.moveTo(escolhida.x1, escolhida.y1).lineTo(escolhida.x2, escolhida.y2)
      abaixo.stroke({ width: larguraDe(escolhida) + borda, color: SELECTION_COLOR, cap: 'square' })
    }
  }

  function pintarAtual(pedido: PedidoDasParedes): void {
    soltarMalhas()
    sombra.visible = false
    abaixo.clear()
    acima.clear()
    drawWalls(vetor, pedido.walls, pedido.selectedWallId, pedido.cameraScale, pedido.rendererResolution, pedido.highlightedRegionId, pedido.marcarPassagem)
  }

  function pintarDesenhado(pedido: PedidoDasParedes, t: Tinta): void {
    vetor.clear()
    sombra.visible = true
    const k = pedido.grid / CASA_DO_TRACO
    const p = t.params
    pintarSelecao(pedido, (w) => (w.door === null ? espessuraDoTraco(w, p, k) * k : 0))
    if (pedido.marcarPassagem) drawWallMarks(acima, pedido.walls, pedido.cameraScale, pedido.rendererResolution)
    else acima.clear()
    // A sombra: só o desfoque acompanha o zoom (px da tela), a malha não.
    const sigma = p.sombra.borraoPx * k * 0.5
    desfoque.strength = Math.max(0.01, (sigma * pedido.cameraScale * RESOLUCAO_DA_SOMBRA) / DESVIO_POR_FORCA)
    alfaDaSombra.alpha = p.sombra.alfa
    const m = pxDaTela(pedido.cameraScale)
    const todas = pedido.todas ?? pedido.walls
    // A malha só se refaz quando muda o que ela desenha (o zoom de 100% para cima não refaz).
    const chave = JSON.stringify([
      pedido.grid,
      m,
      todas.map((w) => [w.id, w.x1, w.y1, w.x2, w.y2, w.door === null, w.hidden === true, w.janela === true, w.grade === true, w.thickness, w.color, w.regionId, w.regionEdgeIndex]),
      pedido.walls.map((w) => w.id),
      [t.parede.face.id, t.janela?.face.id, t.grade?.face.id],
    ])
    if (chave === chaveDaMalha) return
    soltarMalhas()
    chaveDaMalha = chave
    const cores: Rgb[] = []
    const linhaDaCor = (c: Rgb): number => {
      const i = cores.findIndex((x) => x[0] === c[0] && x[1] === c[1] && x[2] === c[2])
      if (i >= 0) return i
      cores.push(c)
      return cores.length - 1
    }
    const saem = new Set(pedido.walls.map((w) => w.id))
    const cadeias = cadeiasDoNo(todas, saem, p, k, linhaDaCor)
    const faces = { parede: t.parede.face, janela: t.janela?.face ?? null, grade: t.grade?.face ?? null }
    const malhas = malhasDasParedes(cadeias, faces, p, pedido.grid, m)
    if (cores.length === 0) return
    const at = atlasDasRampas(cores.map((c) => rampaDa(c, p)))
    atlas = at
    // 1. A sombra: a faixa inteira de todas, andada; o desfoque e o alfa são do filtro (a união antes do alfa).
    const desl = p.sombra.deslocamentoPx * k
    sombra.position.set(p.sombra.direcao[0] * desl, p.sombra.direcao[1] * desl)
    sombraG.clear()
    for (const f of malhas.faixas) sombraG.poly(f.flatMap((q) => [q[0], q[1]]))
    if (malhas.faixas.length > 0) sombraG.fill({ color: p.sombra.cor })
    const por = (mesh: Mesh<Geometry, Shader>): void => {
      meshes.push(mesh)
      desenhado.addChild(mesh)
    }
    // 2. O contorno de todas as cadeias.
    if (malhas.contorno !== null) por(meshDoContorno(malhas.contorno, at, cores.length, p.contorno.valor))
    // 3. Os miolos, lote por lote (a ordem da referência), a parede antes da janela e da grade.
    for (const lote of malhas.miolos) {
      for (const item of PAPEIS_DA_PAREDE) {
        const malha = lote.malhas[item]
        if (malha === null) continue
        por(meshDoMiolo(malha, imagemDe(t, item, lote.altura), faceDoItem(t, item).face.luz, at, cores.length))
      }
    }
  }

  function desenhar(alvo: Container, pedido: PedidoDasParedes): void {
    montar(alvo)
    ultimo = pedido
    const tinta = desenhadoLigado() && !semShader ? tintaPronta() : null
    if (tinta === null) pintarAtual(pedido)
    else pintarDesenhado(pedido, tinta)
  }

  return {
    desenhar,
    destroy: () => {
      pararDeOuvir()
      soltarMalhas()
      soltarImagens()
      desenhado.onRender = null
      for (const n of [vetor, abaixo, acima, sombraG]) n.destroy()
      sombra.destroy()
      desenhado.destroy()
      desfoque.destroy()
      alfaDaSombra.destroy()
      no = null
      ultimo = null
    },
  }
}
