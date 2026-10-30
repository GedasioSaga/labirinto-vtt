import { BufferImageSource, Container, Graphics, Matrix, RenderTexture, Sprite, Texture } from 'pixi.js'
import type { Light, MapData, Periodo, Prop, RegionPoint } from '../types/map'
import { CASA_DO_FOGO_PX } from '../lib/mobilia/fogo'
import { ambienteDoPeriodo, periodoDaCena, type Ambiente, type LuzDoJogador, type PeriodoLido } from '../lib/periodo'
import { computeVisibility, type Segment } from '../lib/visibility'

/**
 * MAPA DE LUZ (Luz L4b, plano `docs/planos/luz-dia-tarde-noite-2026-10-24.md`).
 *
 * Uma textura a MEIA resolução da vista, preenchida com a tinta do período
 * (a cor do período misturada ao branco na força do período), onde cada luz
 * soma o seu claro quente (blend aditivo) recortado pela parede. O resultado
 * entra num sprite em MULTIPLY sobre o mapa: o que está sob a luz fica como de
 * dia, o resto escurece para a cor da noite ou da tarde. É a montagem do
 * protótipo aprovado (`docs/design/luz/prototipo-dia-tarde-noite.html`).
 *
 * Dia (e cena interior, e força 0) não tem tinta: o sprite fica invisível e
 * nada é desenhado — o mapa sai idêntico, pixel a pixel, ao de antes da Luz.
 *
 * A parte pura (cor, força, chave, geometria) fica separada do que usa o Pixi
 * para ser testada sem placa de vídeo.
 */

// ───────────────────────────────────────────────────────────────────────────
// Números aprovados (protótipo L4a, decisão do usuário de 24/10/2026)
// ───────────────────────────────────────────────────────────────────────────

/** O mestre vê a tinta a 50% (D5): enxerga o mapa todo e ainda sabe que é noite. */
export const TINTA_NO_EDITOR = 0.5

/** Quanto da força de cada luz entra em cada período: à tarde a luz só tira o laranja (protótipo). */
export const LUZ_POR_PERIODO: Readonly<Record<Periodo, number>> = { dia: 0, tarde: 0.3, noite: 1 }

/** Contorno creme da PRÓPRIA ficha do jogador, em px de tela (D2). */
export const CONTORNO_DA_FICHA_PX = 2.5
export const COR_DO_CONTORNO = 0xf3efe2
/** O fio escuro por fora do creme: separa a ficha do chão claro sob o lampião. */
const FIO_DO_CONTORNO_PX = 1.2
const COR_DO_FIO = 0x121214
const ALFA_DO_FIO = 0.55
/** O contorno acende quando a tinta passa deste escuro (a conta do protótipo). */
const LUMINANCIA_SEM_CONTORNO = 0.88
const FAIXA_DO_CONTORNO = 0.3

/** A textura do mapa tem metade do lado da vista: a luz é suave, meia resolução basta (e custa 1/4). */
export const ESCALA_DO_MAPA_DE_LUZ = 0.5

/** Queda da luz do centro (0) até o alcance (1): curva quase quadrática, a do protótipo. */
export const QUEDA_DA_LUZ: readonly (readonly [number, number])[] = [
  [0, 1],
  [0.25, 0.82],
  [0.5, 0.5],
  [0.75, 0.2],
  [1, 0],
]

const BRANCO = 0xffffff

// ───────────────────────────────────────────────────────────────────────────
// Parte pura: a tinta
// ───────────────────────────────────────────────────────────────────────────

/** A tinta pronta para desenhar. `null` em quem a devolve = sem tinta (dia). */
export interface Tinta {
  periodo: Exclude<Periodo, 'dia'>
  /** A cor do período misturada ao branco na força do período, `0xRRGGBB`. */
  rgb: number
  /** Opacidade do sprite: 1 no jogador, `TINTA_NO_EDITOR` no mestre. */
  alfa: number
  /** `LUZ_POR_PERIODO` do período. */
  fatorDaLuz: number
}

function grampear01(valor: number): number {
  return Number.isFinite(valor) ? Math.min(1, Math.max(0, valor)) : 0
}

function canais(cor: number): [number, number, number] {
  return [(cor >> 16) & 255, (cor >> 8) & 255, cor & 255]
}

/** `#rrggbb` (já validado por `ambienteDoPeriodo`/`lerLuzDoJogador`) em número; torto vira branco. */
function corDoHex(hex: string): number {
  const valor = /^#[0-9a-f]{6}$/i.test(hex) ? Number.parseInt(hex.slice(1), 16) : BRANCO
  return Number.isFinite(valor) ? valor : BRANCO
}

/** A cor da tinta: o branco misturado à cor do período na força dele (força 0 = branco). */
export function corDaTinta(ambiente: Ambiente): number {
  const forca = grampear01(ambiente.forca)
  const [r, g, b] = canais(corDoHex(ambiente.cor))
  const misturar = (canal: number) => Math.round(255 + (canal - 255) * forca)
  return (misturar(r) << 16) | (misturar(g) << 8) | misturar(b)
}

/** A tinta do período, ou `null` quando não há o que escurecer (dia, força 0, opacidade 0). */
export function tintaDoPeriodo(periodo: Periodo, ambiente: Ambiente, alfa: number): Tinta | null {
  if (periodo === 'dia') return null
  const rgb = corDaTinta(ambiente)
  const opacidade = grampear01(alfa)
  if (rgb === BRANCO || opacidade === 0) return null
  return { periodo, rgb, alfa: opacidade, fatorDaLuz: LUZ_POR_PERIODO[periodo] }
}

/**
 * A tinta da cena aberta no editor: o período da CENA (`periodoDaCena` — a
 * interior fica de dia, D1) e o ambiente dela (`ambienteDoPeriodo`, D7).
 */
export function tintaDaCena(
  cena: Pick<MapData, 'externa' | 'periodoFixo' | 'ambientePorPeriodo'>,
  sessao: PeriodoLido | null | undefined,
  alfa: number,
): Tinta | null {
  const periodo = periodoDaCena(cena, sessao)
  return tintaDoPeriodo(periodo, ambienteDoPeriodo(cena, periodo), alfa)
}

/** A tinta do jogador: o `snapshot.luz` da cena dele (ausente = dia). Sempre cheia. */
export function tintaDoJogador(luz: LuzDoJogador | null | undefined): Tinta | null {
  if (luz === null || luz === undefined) return null
  return tintaDoPeriodo(luz.periodo, luz, 1)
}

/**
 * Opacidade do contorno da própria ficha: some com tinta clara (dia, tarde
 * leve) e fica cheio quando escurece. A tinta efetiva é a que chega à tela
 * (branco misturado à tinta na opacidade do sprite).
 */
export function alfaDoContorno(tinta: Tinta | null): number {
  if (tinta === null) return 0
  const [r, g, b] = canais(tinta.rgb).map((canal) => 255 + (canal - 255) * tinta.alfa)
  const luminancia = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return grampear01((LUMINANCIA_SEM_CONTORNO - luminancia) / FAIXA_DO_CONTORNO)
}

// ───────────────────────────────────────────────────────────────────────────
// Parte pura: a luz quente
// ───────────────────────────────────────────────────────────────────────────

/** A queda em `t` (0 = centro, 1 = alcance), linear entre as paradas de `QUEDA_DA_LUZ`. */
export function quedaDaLuz(t: number): number {
  if (!(t > 0)) return 1
  for (let i = 1; i < QUEDA_DA_LUZ.length; i += 1) {
    const [t1, f1] = QUEDA_DA_LUZ[i]
    if (t <= t1) {
      const [t0, f0] = QUEDA_DA_LUZ[i - 1]
      return f0 + ((f1 - f0) * (t - t0)) / (t1 - t0)
    }
  }
  return 0
}

/** Uma luz pronta para o mapa: o claro recortado pela parede e a força já no período. */
export interface LuzNoMapa {
  id: string
  x: number
  y: number
  raio: number
  cor: number
  forca: number
  poligono: RegionPoint[]
}

/** Cache do raycast por luz: a mesma pose com os mesmos obstáculos não recalcula. */
export type CacheDePoligonos = Map<string, { obstaculos: Segment[]; poligono: RegionPoint[] }>

/**
 * As luzes que somam claro: acesas, com alcance e com força no período. O
 * claro de cada uma é o MESMO raycast da visão (`computeVisibility`): a luz
 * para na parede como o olho pararia.
 */
export function luzesDoMapa(luzes: readonly Light[], obstaculos: Segment[], fatorDaLuz: number, cache?: CacheDePoligonos): LuzNoMapa[] {
  const fator = grampear01(fatorDaLuz)
  if (fator === 0) return []
  const saida: LuzNoMapa[] = []
  for (const l of luzes) {
    const forca = grampear01(l.intensity) * fator
    if (l.apagada === true || !(l.radius > 0) || forca <= 0) continue
    const chave = `${l.id}|${l.x}|${l.y}|${l.radius}`
    const guardado = cache?.get(chave)
    const poligono = guardado !== undefined && guardado.obstaculos === obstaculos ? guardado.poligono : computeVisibility({ x: l.x, y: l.y }, obstaculos, l.radius)
    cache?.set(chave, { obstaculos, poligono })
    if (poligono.length < 3) continue
    saida.push({ id: l.id, x: l.x, y: l.y, raio: l.radius, cor: corDoHex(l.color), forca, poligono })
  }
  return saida
}

// ───────────────────────────────────────────────────────────────────────────
// Parte pura: a luz do objeto Fogo
// ───────────────────────────────────────────────────────────────────────────

/** O que a luz do fogo lê do objeto. */
export type FogoQueIlumina = Pick<Prop, 'id' | 'x' | 'y' | 'width' | 'height' | 'mobilia' | 'hidden'>

/**
 * A LUZ DO FOGO (decisão do mestre, 27/10/2026): à noite o objeto Fogo acende
 * uma luz no mapa, como um lampião, no tom do fogo. Alcance: meia diagonal da
 * pegada mais 2,5 casas (3,2 casas na Chama, 5 no Incêndio).
 */
export const COR_DA_LUZ_DO_FOGO = 0xf2a65a
export const FORCA_DA_LUZ_DO_FOGO = 0.85
const ALCANCE_ALEM_DA_PEGADA = 2.5 * CASA_DO_FOGO_PX

/** FNV-1a do id, em [0, 1): o tremor de cada fogo no seu passo, igual nas duas telas. */
function faseDoId(id: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < id.length; i += 1) hash = Math.imul(hash ^ id.charCodeAt(i), 0x01000193)
  return (hash >>> 0) / 2 ** 32
}

/** Uma luz de fogo pronta: a luz de sempre e a fase do tremor. */
export interface LuzDoFogo extends LuzNoMapa {
  fase: number
}

/** A luz de cada fogo (`hidden` não ilumina), recortada pela parede como as outras luzes. */
/**
 * O conteúdo que muda a luz dos fogos. O jogador recebe snapshot novo (listas
 * novas) a cada pacote: comparar a lista por identidade refaria o mapa de luz sem
 * nada ter mudado.
 */
function conteudoDosFogos(fogos: readonly FogoQueIlumina[] | undefined): string {
  let chave = ''
  for (const f of fogos ?? []) if (f.mobilia === 'fogo' && f.hidden !== true) chave += `${f.id}|${f.x}|${f.y}|${f.width}|${f.height};`
  return chave
}

export function luzesDosFogos(fogos: readonly FogoQueIlumina[], obstaculos: Segment[], fatorDaLuz: number, cache?: CacheDePoligonos): LuzDoFogo[] {
  const fator = grampear01(fatorDaLuz)
  if (fator === 0) return []
  const saida: LuzDoFogo[] = []
  for (const f of fogos) {
    if (f.mobilia !== 'fogo' || f.hidden === true || !Number.isFinite(f.x) || !Number.isFinite(f.y) || !(f.width > 0) || !(f.height > 0)) continue
    const raio = 0.5 * Math.hypot(f.width, f.height) + ALCANCE_ALEM_DA_PEGADA
    const chave = `${f.id}|${f.x}|${f.y}|${raio}`
    const guardado = cache?.get(chave)
    const poligono = guardado !== undefined && guardado.obstaculos === obstaculos ? guardado.poligono : computeVisibility({ x: f.x, y: f.y }, obstaculos, raio)
    cache?.set(chave, { obstaculos, poligono })
    if (poligono.length < 3) continue
    saida.push({ id: f.id, x: f.x, y: f.y, raio, cor: COR_DA_LUZ_DO_FOGO, forca: FORCA_DA_LUZ_DO_FOGO * fator, poligono, fase: faseDoId(f.id) })
  }
  return saida
}

/** O tremor leve da luz do fogo no instante `tempoMs`: entre 0,84 e 1 da força, sem salto. */
export function tremorDoFogo(tempoMs: number, fase: number): number {
  const s = tempoMs / 1000
  const volta = 2 * Math.PI
  return 0.92 + 0.05 * Math.sin(volta * (1.7 * s + fase)) + 0.03 * Math.sin(volta * (4.3 * s + 2 * fase))
}

// ───────────────────────────────────────────────────────────────────────────
// Parte pura: a chave de revisão
// ───────────────────────────────────────────────────────────────────────────

/** Igualdade por valor de dado de mapa (listas, objetos simples, números, textos). Sem serializar. */
export function mesmoConteudo(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false
    for (let i = 0; i < a.length; i += 1) if (!mesmoConteudo(a[i], b[i])) return false
    return true
  }
  if (Array.isArray(b)) return false
  const chavesA = Object.keys(a)
  if (chavesA.length !== Object.keys(b).length) return false
  for (const chave of chavesA) {
    if (!Object.prototype.hasOwnProperty.call(b, chave)) return false
    if (!mesmoConteudo(Reflect.get(a, chave), Reflect.get(b, chave))) return false
  }
  return true
}

/** Número que só muda quando o conteúdo de que ele depende muda. */
export interface Revisao {
  de(refs: readonly unknown[]): number
}

/**
 * CHAVE DE REVISÃO no lugar do `JSON.stringify` do mapa: mesmas referências
 * (o patch do mestre mantém a referência de todo campo que não mudou) = mesma
 * revisão, sem olhar dentro; referência nova com o mesmo conteúdo (snapshot
 * inteiro) = mesma revisão, por comparação de valor sem montar texto;
 * conteúdo novo = número novo, nunca reaproveitado.
 */
export function criarRevisao(): Revisao {
  let anteriores: readonly unknown[] | null = null
  let numero = 0
  return {
    de(refs) {
      if (anteriores !== null && anteriores.length === refs.length && anteriores.every((valor, i) => valor === refs[i])) return numero
      const mesmo = anteriores !== null && mesmoConteudo(anteriores, refs)
      anteriores = refs
      if (!mesmo) numero += 1
      return numero
    },
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Parte pura: a vista
// ───────────────────────────────────────────────────────────────────────────

/** A câmera como o mapa de luz a vê: posição e escala do mundo, tamanho da tela (px CSS). */
export interface Vista {
  x: number
  y: number
  escala: number
  largura: number
  altura: number
}

/** Mundo → pixel da textura a meia resolução. */
export function matrizDaVista(vista: Vista, saida: Matrix): Matrix {
  const k = ESCALA_DO_MAPA_DE_LUZ
  return saida.set(vista.escala * k, 0, 0, vista.escala * k, vista.x * k, vista.y * k)
}

function chaveDaVista(vista: Vista): string {
  return `${vista.x}|${vista.y}|${vista.escala}|${vista.largura}|${vista.altura}`
}

// ───────────────────────────────────────────────────────────────────────────
// Pixi
// ───────────────────────────────────────────────────────────────────────────

/** O pedaço do renderer que o mapa usa (o `app.renderer`; nos testes, um falso que conta). */
export interface RenderizadorDoMapaDeLuz {
  render(opcoes: { container: Container; target: RenderTexture; clear: boolean; clearColor: number; transform: Matrix }): void
}

/** A ficha que ganha o contorno creme, em coordenadas de mundo. */
export interface FichaComContorno {
  x: number
  y: number
  raio: number
}

export interface QuadroDoMapaDeLuz {
  tinta: Tinta | null
  /** Muda quando muda luz ou parede (`criarRevisao`); a geometria só é refeita então. */
  revisao: number
  /** Lidas só quando a revisão ou o período mudam. */
  luzes: () => readonly Light[]
  obstaculos: () => Segment[]
  /** Tamanho do mapa em px de mundo: fora dele a tela não escurece. */
  mapa: { largura: number; altura: number }
  vista: Vista
  fichas: readonly FichaComContorno[]
  /**
   * Os objetos do mapa: o Fogo acende luz (`luzesDosFogos`). No jogador, a lista
   * já recortada pela visão: fogo que ele não vê não ilumina. A MESMA lista
   * (referência) entre quadros não refaz a geometria. Ausente = sem luz de fogo.
   */
  fogos?: readonly FogoQueIlumina[]
}

export interface MedidasDoMapaDeLuz {
  /** Quantas vezes a textura foi redesenhada. */
  refeitos: number
  /** Quantas vezes o raycast das luzes foi refeito. */
  geometrias: number
  /** Tempo de CPU do último refazer (geometria + desenho), em ms. */
  ultimoMs: number
  maiorMs: number
}

export interface MapaDeLuz {
  /** O mapa em multiply: entra no mundo por cima de tudo o que escurece. */
  readonly sprite: Sprite
  /** O contorno da própria ficha: logo acima do sprite (não escurece). */
  readonly contorno: Graphics
  readonly medidas: MedidasDoMapaDeLuz
  /** `null` = sem tinta (dia): esconde tudo e não desenha. */
  atualizar(quadro: QuadroDoMapaDeLuz | null): void
  destruir(): void
}

/** O tremor da luz do fogo é redesenhado a 10 quadros por segundo, e só com fogo aceso na vista. */
const QUADRO_DO_TREMOR_MS = 100
/** De quanto em quanto tempo o mapa de luz relê o "menos movimento" do sistema (com ele, o tremor para). */
const CONFERIR_MOVIMENTO_MS = 1000

function prefereMenosMovimento(): boolean {
  return typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
}

/** Lado da textura da queda; a borda fica transparente porque o preenchimento global repete a textura. */
const LADO_DA_QUEDA = 128
const RAIO_DA_QUEDA = LADO_DA_QUEDA / 2 - 2

function criarTexturaDaQueda(): Texture {
  const pixels = new Uint8Array(LADO_DA_QUEDA * LADO_DA_QUEDA * 4)
  const centro = LADO_DA_QUEDA / 2
  for (let y = 0; y < LADO_DA_QUEDA; y += 1) {
    for (let x = 0; x < LADO_DA_QUEDA; x += 1) {
      const t = Math.hypot(x + 0.5 - centro, y + 0.5 - centro) / RAIO_DA_QUEDA
      // Branco pré-multiplicado: a cor de cada luz entra pelo `color` do preenchimento.
      const valor = Math.round(255 * quedaDaLuz(t))
      const i = (y * LADO_DA_QUEDA + x) * 4
      pixels[i] = valor
      pixels[i + 1] = valor
      pixels[i + 2] = valor
      pixels[i + 3] = valor
    }
  }
  const source = new BufferImageSource({
    resource: pixels,
    width: LADO_DA_QUEDA,
    height: LADO_DA_QUEDA,
    format: 'rgba8unorm',
    alphaMode: 'premultiplied-alpha',
    scaleMode: 'linear',
  })
  return new Texture({ source })
}

/** Textura (pixel) → mundo: o centro da textura na luz, o raio da queda no alcance. */
function matrizDaLuz(luz: LuzNoMapa): Matrix {
  const k = luz.raio / RAIO_DA_QUEDA
  const meio = (LADO_DA_QUEDA / 2) * k
  return new Matrix(k, 0, 0, k, luz.x - meio, luz.y - meio)
}

export function criarMapaDeLuz(renderizador: RenderizadorDoMapaDeLuz): MapaDeLuz {
  const queda = criarTexturaDaQueda()
  // `dynamic`: sem ele o Sprite do Pixi não ouve o `resize` da textura e guarda o
  // tamanho antigo; a janela que cresce à noite deixava a tinta só num retângulo
  // no canto superior esquerdo, do tamanho da tela de antes.
  const textura = RenderTexture.create({ width: 1, height: 1, resolution: 1, dynamic: true })
  const sprite = new Sprite(textura)
  sprite.label = 'mapaDeLuz'
  sprite.blendMode = 'multiply'
  sprite.eventMode = 'none'
  sprite.visible = false
  const contorno = new Graphics()
  contorno.label = 'contornoDaFicha'
  contorno.eventMode = 'none'
  contorno.visible = false

  // O palco do mapa (fora da cena): a tinta sobre o mapa e as luzes somando por cima.
  const palco = new Container()
  const fundo = new Graphics()
  const claros = new Graphics()
  claros.blendMode = 'add'
  // A luz de cada fogo num Graphics próprio: o tremor só troca o alpha dele, sem refazer a geometria.
  const clarosDosFogos = new Container()
  palco.addChild(fundo, claros, clarosDosFogos)
  let luzesDosFogosNoPalco: { desenho: Graphics; fase: number; forca: number; caixa: { minX: number; minY: number; maxX: number; maxY: number } }[] = []
  const poligonosDosFogos: CacheDePoligonos = new Map()
  let fogosLidos: readonly FogoQueIlumina[] | undefined
  let revisaoDosFogos: string | null = null
  let chaveDosFogos: string | null = null
  let versaoDosFogos = 0
  let passoDoTremor = -1
  let reduzido = prefereMenosMovimento()
  let movimentoConferidoEm = 0
  // Os obstáculos da revisão de agora: arrastar um móvel troca a lista de objetos, não as paredes.
  let obstaculosGuardados: { revisao: number; lista: Segment[] } | null = null

  const poligonos: CacheDePoligonos = new Map()
  const transformacao = new Matrix()
  const medidas: MedidasDoMapaDeLuz = { refeitos: 0, geometrias: 0, ultimoMs: 0, maiorMs: 0 }
  let chaveDaGeometria: string | null = null
  let chaveDoFundo: string | null = null
  let chaveDoDesenho: string | null = null
  let chaveDoContorno: string | null = null

  function refazerGeometria(quadro: QuadroDoMapaDeLuz, tinta: Tinta): void {
    const chave = `${quadro.revisao}|${tinta.fatorDaLuz}`
    if (chave === chaveDaGeometria) return
    chaveDaGeometria = chave
    medidas.geometrias += 1
    const obstaculos = quadro.obstaculos()
    const luzes = luzesDoMapa(quadro.luzes(), obstaculos, tinta.fatorDaLuz, poligonos)
    // O cache só guarda as poses de agora: luz que andou não deixa o raycast velho para trás.
    const vivas = new Set(luzes.map((l) => `${l.id}|${l.x}|${l.y}|${l.raio}`))
    for (const chaveDaLuz of poligonos.keys()) if (!vivas.has(chaveDaLuz)) poligonos.delete(chaveDaLuz)
    claros.clear()
    for (const luz of luzes) {
      claros.poly(luz.poligono, true).fill({ texture: queda, matrix: matrizDaLuz(luz), textureSpace: 'global', color: luz.cor, alpha: luz.forca })
    }
  }

  /** A luz dos fogos: refeita só quando a lista, a parede ou o período mudam. */
  function refazerFogos(quadro: QuadroDoMapaDeLuz, tinta: Tinta): void {
    const revisao = `${quadro.revisao}|${tinta.fatorDaLuz}`
    if (quadro.fogos === fogosLidos && revisao === revisaoDosFogos) return
    fogosLidos = quadro.fogos
    revisaoDosFogos = revisao
    // Lista nova com os mesmos fogos (snapshot novo do jogador, outro objeto que mudou): nada a refazer.
    const chave = `${revisao}|${conteudoDosFogos(quadro.fogos)}`
    if (chave === chaveDosFogos) return
    chaveDosFogos = chave
    versaoDosFogos += 1
    for (const luz of luzesDosFogosNoPalco) luz.desenho.destroy()
    luzesDosFogosNoPalco = []
    const lista = quadro.fogos ?? []
    // Mapa sem fogo não pede os obstáculos nem cria nada.
    if (!lista.some((p) => p.mobilia === 'fogo')) {
      poligonosDosFogos.clear()
      return
    }
    if (obstaculosGuardados === null || obstaculosGuardados.revisao !== quadro.revisao) obstaculosGuardados = { revisao: quadro.revisao, lista: quadro.obstaculos() }
    const luzes = luzesDosFogos(lista, obstaculosGuardados.lista, tinta.fatorDaLuz, poligonosDosFogos)
    const vivas = new Set(luzes.map((l) => `${l.id}|${l.x}|${l.y}|${l.raio}`))
    for (const chaveDaLuz of poligonosDosFogos.keys()) if (!vivas.has(chaveDaLuz)) poligonosDosFogos.delete(chaveDaLuz)
    for (const luz of luzes) {
      const desenho = new Graphics()
      desenho.blendMode = 'add'
      desenho.poly(luz.poligono, true).fill({ texture: queda, matrix: matrizDaLuz(luz), textureSpace: 'global', color: luz.cor, alpha: 1 })
      desenho.alpha = luz.forca
      clarosDosFogos.addChild(desenho)
      luzesDosFogosNoPalco.push({ desenho, fase: luz.fase, forca: luz.forca, caixa: { minX: luz.x - luz.raio, minY: luz.y - luz.raio, maxX: luz.x + luz.raio, maxY: luz.y + luz.raio } })
    }
    passoDoTremor = -1
  }

  /** O tremor leve: com fogo aceso na vista e movimento normal, um passo a cada 100 ms; senão, a força parada. */
  function tremer(quadro: QuadroDoMapaDeLuz): void {
    if (luzesDosFogosNoPalco.length === 0) return
    const agora = performance.now()
    if (Math.abs(agora - movimentoConferidoEm) >= CONFERIR_MOVIMENTO_MS) {
      movimentoConferidoEm = agora
      reduzido = prefereMenosMovimento()
    }
    const escala = quadro.vista.escala > 0 && Number.isFinite(quadro.vista.escala) ? quadro.vista.escala : 1
    const minX = -quadro.vista.x / escala
    const minY = -quadro.vista.y / escala
    const maxX = minX + quadro.vista.largura / escala
    const maxY = minY + quadro.vista.altura / escala
    const naVista = luzesDosFogosNoPalco.some(({ caixa }) => caixa.minX <= maxX && caixa.maxX >= minX && caixa.minY <= maxY && caixa.maxY >= minY)
    const passo = reduzido || !naVista ? -1 : Math.floor(agora / QUADRO_DO_TREMOR_MS)
    if (passo === passoDoTremor) return
    passoDoTremor = passo
    for (const luz of luzesDosFogosNoPalco) luz.desenho.alpha = passo < 0 ? luz.forca : luz.forca * tremorDoFogo(passo * QUADRO_DO_TREMOR_MS, luz.fase)
  }

  function refazerFundo(quadro: QuadroDoMapaDeLuz, tinta: Tinta): void {
    const chave = `${tinta.rgb}|${quadro.mapa.largura}|${quadro.mapa.altura}`
    if (chave === chaveDoFundo) return
    chaveDoFundo = chave
    fundo.clear()
    // Só o mapa escurece: fora dele a textura fica branca (multiply por branco = nada muda).
    fundo.rect(0, 0, quadro.mapa.largura, quadro.mapa.altura).fill({ color: tinta.rgb })
  }

  function posicionarSprite(vista: Vista): void {
    const escala = vista.escala > 0 && Number.isFinite(vista.escala) ? vista.escala : 1
    sprite.position.set(-vista.x / escala, -vista.y / escala)
    sprite.scale.set(1 / ESCALA_DO_MAPA_DE_LUZ / escala)
  }

  function desenhar(quadro: QuadroDoMapaDeLuz): void {
    const chave = `${chaveDaGeometria}|${chaveDoFundo}|${chaveDaVista(quadro.vista)}|${versaoDosFogos}|${passoDoTremor}`
    if (chave === chaveDoDesenho) return
    chaveDoDesenho = chave
    const largura = Math.max(1, Math.ceil(quadro.vista.largura * ESCALA_DO_MAPA_DE_LUZ))
    const altura = Math.max(1, Math.ceil(quadro.vista.altura * ESCALA_DO_MAPA_DE_LUZ))
    if (textura.width !== largura || textura.height !== altura) textura.resize(largura, altura, 1)
    renderizador.render({ container: palco, target: textura, clear: true, clearColor: BRANCO, transform: matrizDaVista(quadro.vista, transformacao) })
    medidas.refeitos += 1
  }

  function desenharContorno(quadro: QuadroDoMapaDeLuz, tinta: Tinta): void {
    const alfa = alfaDoContorno(tinta)
    const escala = quadro.vista.escala > 0 && Number.isFinite(quadro.vista.escala) ? quadro.vista.escala : 1
    if (alfa <= 0.01 || quadro.fichas.length === 0) {
      contorno.visible = false
      return
    }
    contorno.visible = true
    const chave = `${alfa}|${escala}|${quadro.fichas.map((f) => `${f.x},${f.y},${f.raio}`).join(';')}`
    if (chave === chaveDoContorno) return
    chaveDoContorno = chave
    const creme = CONTORNO_DA_FICHA_PX / escala
    const fio = FIO_DO_CONTORNO_PX / escala
    contorno.clear()
    for (const ficha of quadro.fichas) {
      contorno.circle(ficha.x, ficha.y, ficha.raio + creme / 2).stroke({ width: creme, color: COR_DO_CONTORNO, alpha: alfa })
      contorno.circle(ficha.x, ficha.y, ficha.raio + creme + fio / 2).stroke({ width: fio, color: COR_DO_FIO, alpha: ALFA_DO_FIO * alfa })
    }
  }

  function atualizar(quadro: QuadroDoMapaDeLuz | null): void {
    const tinta = quadro === null ? null : quadro.tinta
    if (quadro === null || tinta === null) {
      sprite.visible = false
      contorno.visible = false
      // Sem tinta, nem no mundo: de dia a cena fica com os mesmos filhos de antes da Luz.
      if (sprite.parent !== null) sprite.removeFromParent()
      if (contorno.parent !== null) contorno.removeFromParent()
      return
    }
    const inicio = performance.now()
    const refeitosAntes = medidas.refeitos
    refazerGeometria(quadro, tinta)
    refazerFogos(quadro, tinta)
    tremer(quadro)
    refazerFundo(quadro, tinta)
    desenhar(quadro)
    posicionarSprite(quadro.vista)
    sprite.alpha = tinta.alfa
    sprite.visible = true
    desenharContorno(quadro, tinta)
    if (medidas.refeitos !== refeitosAntes) {
      medidas.ultimoMs = performance.now() - inicio
      medidas.maiorMs = Math.max(medidas.maiorMs, medidas.ultimoMs)
    }
  }

  function destruir(): void {
    // Fora do mundo antes: o `app.destroy` com filhos não destrói de novo o que já se foi.
    sprite.removeFromParent()
    contorno.removeFromParent()
    sprite.destroy()
    contorno.destroy()
    palco.destroy({ children: true })
    textura.destroy(true)
    queda.destroy(true)
    poligonos.clear()
    poligonosDosFogos.clear()
    luzesDosFogosNoPalco = []
    obstaculosGuardados = null
  }

  return { sprite, contorno, medidas, atualizar, destruir }
}
