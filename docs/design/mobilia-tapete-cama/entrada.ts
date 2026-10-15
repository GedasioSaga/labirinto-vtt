/**
 * Página do protótipo. O desenho dos móveis de hoje é o `drawPropSilhouettes`
 * REAL do app, pintando num Canvas 2D por um adaptador do pedaço do `Graphics`
 * do Pixi que ele usa; o tapete e a cama com tecido saem de `proposta.ts`.
 * Montado por `montar.cjs` (esbuild) dentro de `modelo.html`.
 */
import type { Graphics } from 'pixi.js'
import { aceitaVista, criarMovel, movelComOutraVista, NOME_COM_ARTIGO, ROTULO_MOBILIA, ROTULO_VISTA, TIPOS_MOBILIA, VISTAS_MOBILIA } from '../../../client/src/lib/mobilia'
import { drawPropSilhouettes, PROP_SILHOUETTE_EDGE_COLOR, PROP_SILHOUETTE_FILL_COLOR, type PropSilhouette } from '../../../client/src/pixi/drawPropSilhouettes'
import type { TipoMobilia, VistaMobilia } from '../../../client/src/types/map'
import {
  emOrdemDeDesenho,
  FORMAS_DO_TAPETE,
  PALETA_DE_TECIDO,
  pintarMovelProposto,
  ROTULO_FORMA,
  TAMANHO_DO_TAPETE_EM_CASAS,
  usaPinturaProposta,
  type FormaDoTapete,
  type GraficoDoMovel,
  type PropProposto,
  type TipoProposto,
} from './proposta'

const DPR = Math.max(1, Math.min(3, window.devicePixelRatio || 1))
/** Fio de 1 px nítido em tela comum (o fundo do protótipo; os móveis encostam sozinhos, `alignToPixel`). */
const MEIO = DPR === 1 ? 0.5 : 0
/** px de mundo por casa. A escala da câmera é `ppc / GRADE`, então o valor não muda o desenho. */
const GRADE = 50
const COR = { vazio: '#2b2b2b', chao: '#a8776a', grade: 'rgba(0,0,0,0.25)', parede: '#d8d2c4', porta: '#d08c3a' }

const hex = (cor: number): string => `#${cor.toString(16).padStart(6, '0')}`
function rgba(cor: number, alpha: number): string {
  return `rgba(${(cor >> 16) & 0xff},${(cor >> 8) & 0xff},${cor & 0xff},${alpha})`
}

// ---------------------------------------------------------------- Graphics do Pixi -> Canvas 2D

/**
 * O caminho atual vale até a próxima forma depois de um `fill`/`stroke`, como no
 * Pixi 8: `poly().fill().stroke()` pinta e contorna a mesma forma; o `moveTo`
 * seguinte começa outra. `clear()` não apaga nada: a cena pinta o chão antes.
 */
class GraficoDeCanvas implements GraficoDoMovel {
  private caminho = new Path2D()
  private gasto = false
  constructor(private readonly ctx: CanvasRenderingContext2D) {}
  clear(): this {
    return this
  }
  private atual(): Path2D {
    if (this.gasto) {
      this.caminho = new Path2D()
      this.gasto = false
    }
    return this.caminho
  }
  poly(pontos: number[], fechar = true): this {
    const p = this.atual()
    for (let i = 0; i < pontos.length; i += 2) {
      if (i === 0) p.moveTo(pontos[0], pontos[1])
      else p.lineTo(pontos[i], pontos[i + 1])
    }
    if (fechar) p.closePath()
    return this
  }
  moveTo(x: number, y: number): this {
    this.atual().moveTo(x, y)
    return this
  }
  lineTo(x: number, y: number): this {
    this.caminho.lineTo(x, y)
    return this
  }
  fill(estilo: { color: number; alpha: number }): this {
    this.ctx.fillStyle = rgba(estilo.color, estilo.alpha)
    this.ctx.fill(this.caminho)
    this.gasto = true
    return this
  }
  stroke(estilo: { width: number; color: number; alpha: number; join?: 'miter'; cap?: 'butt' }): this {
    this.ctx.lineWidth = estilo.width
    this.ctx.strokeStyle = rgba(estilo.color, estilo.alpha)
    this.ctx.lineJoin = estilo.join ?? 'miter'
    this.ctx.lineCap = estilo.cap ?? 'butt'
    this.ctx.stroke(this.caminho)
    this.gasto = true
    return this
  }
}

// ---------------------------------------------------------------- móveis

interface Movel {
  tipo: TipoProposto
  /** Centro em casas. */
  cx: number
  cy: number
  /** Tamanho em casas; ausente = o padrão do tipo (e da forma e da vista). */
  w?: number
  h?: number
  rot?: number
  vista?: VistaMobilia
  forma?: FormaDoTapete
  preenchido?: boolean
  cor?: string
  linha?: string
  travesseiro?: string
  cobertor?: string
}

/** Tamanho padrão em casas, pelo código do app (os de hoje) ou da proposta (o tapete). */
function tamanhoEmCasas(tipo: TipoProposto, vista: VistaMobilia, forma: FormaDoTapete): { w: number; h: number } {
  if (tipo === 'tapete') {
    const t = TAMANHO_DO_TAPETE_EM_CASAS[forma][vista]
    return { w: t.largura, h: t.altura }
  }
  const base = criarMovel(tipo, { x: 0, y: 0 }, GRADE, 'medida')
  const p = vista === 'lado' ? movelComOutraVista(base, 'lado', GRADE) : base
  return { w: p.width / GRADE, h: p.height / GRADE }
}

let proximoId = 0
function paraProp(m: Movel): PropProposto {
  const vista = m.vista ?? 'frente'
  const forma = m.forma ?? 'retangular'
  const padrao = tamanhoEmCasas(m.tipo, vista, forma)
  proximoId += 1
  return {
    id: `m${proximoId}`,
    src: '',
    linkedMapPath: null,
    x: m.cx * GRADE,
    y: m.cy * GRADE,
    width: (m.w ?? padrao.w) * GRADE,
    height: (m.h ?? padrao.h) * GRADE,
    rotation: m.rot,
    mobilia: m.tipo,
    mobiliaVista: vista === 'lado' && (m.tipo === 'tapete' || aceitaVista(m.tipo)) ? 'lado' : undefined,
    mobiliaForma: m.tipo === 'tapete' && forma === 'redondo' ? 'redondo' : undefined,
    mobiliaPreenchido: m.preenchido === false ? false : undefined,
    mobiliaCor: m.cor,
    mobiliaCorDaLinha: m.linha,
    mobiliaCorDoTravesseiro: m.travesseiro,
    mobiliaCorDoCobertor: m.cobertor,
  }
}

/** O objeto como o `drawPropSilhouettes` de hoje o recebe; o tapete ainda não existe lá. */
function paraOApp(p: PropProposto): PropSilhouette | null {
  const tipo = p.mobilia
  if (tipo === 'tapete') return null
  return {
    x: p.x,
    y: p.y,
    width: p.width,
    height: p.height,
    rotation: p.rotation,
    mobilia: tipo,
    mobiliaPreenchido: p.mobiliaPreenchido,
    mobiliaCor: p.mobiliaCor,
    mobiliaCorDaLinha: p.mobiliaCorDaLinha,
    mobiliaVista: p.mobiliaVista,
  }
}

function prepararCanvas(canvas: HTMLCanvasElement, larguraCss: number, alturaCss: number): CanvasRenderingContext2D {
  canvas.width = Math.round(larguraCss * DPR)
  canvas.height = Math.round(alturaCss * DPR)
  canvas.style.width = `${larguraCss}px`
  canvas.style.height = `${alturaCss}px`
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (ctx === null) throw new Error('Canvas 2D indisponível')
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
  return ctx
}

/** Pinta os móveis com a câmera em `ppc` px por casa: tapetes primeiro (no chão), o resto na ordem da lista. */
function pintarMoveis(ctx: CanvasRenderingContext2D, props: readonly PropProposto[], ppc: number, moldura: boolean): void {
  const escala = ppc / GRADE
  ctx.save()
  ctx.setTransform(DPR * escala, 0, 0, DPR * escala, 0, 0)
  const g = new GraficoDeCanvas(ctx)
  for (const p of emOrdemDeDesenho(props)) {
    if (usaPinturaProposta(p, moldura)) {
      pintarMovelProposto(g, p, escala, DPR, moldura)
      continue
    }
    const doApp = paraOApp(p)
    if (doApp !== null) drawPropSilhouettes(g as unknown as Graphics, [doApp], escala, DPR)
  }
  ctx.restore()
}

function desenharGrade(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, ppc: number): void {
  ctx.beginPath()
  for (let x = x0 + ppc; x < x1 - 0.5; x += ppc) {
    ctx.moveTo(Math.round(x) + MEIO, y0)
    ctx.lineTo(Math.round(x) + MEIO, y1)
  }
  for (let y = y0 + ppc; y < y1 - 0.5; y += ppc) {
    ctx.moveTo(x0, Math.round(y) + MEIO)
    ctx.lineTo(x1, Math.round(y) + MEIO)
  }
  ctx.lineWidth = 1
  ctx.strokeStyle = COR.grade
  ctx.stroke()
}

/** Chão com grade e parede em volta, com meia casa de vazio; `porta` = casa da porta na parede de baixo. */
function fundoDeSala(ctx: CanvasRenderingContext2D, larguraCasas: number, alturaCasas: number, ppc: number, porta: number | null): void {
  ctx.fillStyle = COR.vazio
  ctx.fillRect(0, 0, larguraCasas * ppc, alturaCasas * ppc)
  const x0 = 0.5 * ppc
  const y0 = 0.5 * ppc
  const x1 = (larguraCasas - 0.5) * ppc
  const y1 = (alturaCasas - 0.5) * ppc
  ctx.fillStyle = COR.chao
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
  desenharGrade(ctx, x0, y0, x1, y1, ppc)
  ctx.lineWidth = 2
  ctx.strokeStyle = COR.parede
  ctx.strokeRect(x0, y0, x1 - x0, y1 - y0)
  if (porta !== null) {
    const espessura = Math.max(4, 0.14 * ppc)
    ctx.fillStyle = COR.porta
    ctx.fillRect(porta * ppc, y1 - espessura / 2, ppc, espessura)
  }
}

/** Cena de lado: chão chapado até a linha do piso (parede de 2 px), vazio embaixo. */
function fundoDeLado(ctx: CanvasRenderingContext2D, larguraCasas: number, alturaCasas: number, piso: number, ppc: number): void {
  ctx.fillStyle = COR.chao
  ctx.fillRect(0, 0, larguraCasas * ppc, piso * ppc)
  ctx.fillStyle = COR.vazio
  ctx.fillRect(0, piso * ppc, larguraCasas * ppc, (alturaCasas - piso) * ppc)
  desenharGrade(ctx, 0, 0, larguraCasas * ppc, piso * ppc, ppc)
  ctx.fillStyle = COR.parede
  ctx.fillRect(0, Math.round(piso * ppc), larguraCasas * ppc, 2)
}

// ---------------------------------------------------------------- 1 · sala de cima

// Os tapetes vêm DEPOIS dos móveis na lista, de propósito: a ordem de desenho os põe embaixo.
const SALA: Movel[] = [
  { tipo: 'mesa', cx: 3.2, cy: 2.4 },
  { tipo: 'cadeira', cx: 2.7, cy: 1.6 },
  { tipo: 'cadeira', cx: 3.7, cy: 1.6 },
  { tipo: 'cadeira', cx: 2.7, cy: 3.2, rot: 180 },
  { tipo: 'cadeira', cx: 3.7, cy: 3.2, rot: 180 },
  { tipo: 'barril', cx: 6.6, cy: 2.0 },
  { tipo: 'catre', cx: 9.4, cy: 1.6 },
  { tipo: 'catre', cx: 10.7, cy: 1.6, travesseiro: '#e6e1d6', cobertor: '#9a3f36' },
  { tipo: 'bau', cx: 6.9, cy: 4.9, rot: 25 },
  { tipo: 'cadeira', cx: 2.7, cy: 5.1, rot: 90 },
  { tipo: 'tapete', cx: 3.2, cy: 2.4 },
  { tipo: 'tapete', cx: 6.6, cy: 2.0, forma: 'redondo', cor: '#7a3a33' },
  { tipo: 'tapete', cx: 6.9, cy: 4.9, rot: 25, cor: '#3f5577' },
  { tipo: 'tapete', cx: 2.7, cy: 5.1, forma: 'redondo', w: 3, h: 2, cor: '#4f6644' },
  { tipo: 'tapete', cx: 10.05, cy: 2.85, w: 2.6, h: 1, cor: '#8f7448' },
]

function sala(ppc: number): void {
  const canvas = document.getElementById(`sala-${ppc}`)
  if (!(canvas instanceof HTMLCanvasElement)) return
  const ctx = prepararCanvas(canvas, 12 * ppc, 7 * ppc)
  fundoDeSala(ctx, 12, 7, ppc, 9)
  pintarMoveis(ctx, SALA.map(paraProp), ppc, moldura)
}

// ---------------------------------------------------------------- 2 · lado

const PISO_DE_LADO = 1.7
function deLado(m: Omit<Movel, 'cy' | 'vista'>): Movel {
  const { h } = tamanhoEmCasas(m.tipo, 'lado', m.forma ?? 'retangular')
  return { ...m, vista: 'lado', cy: PISO_DE_LADO - (m.h ?? h) / 2 }
}
const LADO: Movel[] = [
  deLado({ tipo: 'tapete', cx: 2 }),
  deLado({ tipo: 'cadeira', cx: 5.3 }),
  deLado({ tipo: 'tapete', cx: 5.6, cor: '#7a3a33' }),
  deLado({ tipo: 'bau', cx: 8.9 }),
  deLado({ tipo: 'tapete', cx: 8.9, forma: 'redondo' }),
  deLado({ tipo: 'cadeira', cx: 11.2 }),
]

function lado(ppc: number): void {
  const canvas = document.getElementById(`lado-${ppc}`)
  if (!(canvas instanceof HTMLCanvasElement)) return
  const ctx = prepararCanvas(canvas, 12 * ppc, 2.1 * ppc)
  fundoDeLado(ctx, 12, 2.1, PISO_DE_LADO, ppc)
  pintarMoveis(ctx, LADO.map(paraProp), ppc, false)
}

// ---------------------------------------------------------------- 3 · camas

const nomeDaCor = (cor: string | undefined): string => (cor === undefined ? 'padrão' : (PALETA_DE_TECIDO.find((p) => p.cor === cor)?.nome ?? cor))
const T = Object.fromEntries(PALETA_DE_TECIDO.map((p) => [p.nome, p.cor])) as Record<string, string>
const MADEIRA = '#6b4a30'

const CAMAS: { travesseiro?: string; cobertor?: string; cor?: string; hoje?: true }[] = [
  { hoje: true },
  { travesseiro: T.Branco, cobertor: T.Vermelho },
  { travesseiro: T.Creme, cobertor: T.Azul },
  { travesseiro: T.Branco, cobertor: T.Verde },
  { travesseiro: T.Cinza, cobertor: T.Roxo },
  { travesseiro: T.Creme, cobertor: T.Castanho },
  { travesseiro: T.Branco, cobertor: T.Azul, cor: MADEIRA },
  { travesseiro: T.Creme, cobertor: T.Vermelho, cor: '#4a3a2c' },
  { travesseiro: T.Branco },
  { cobertor: T.Verde },
]

const PPC_DA_CAMA = 56
/** Variante proposta: o cobertor deixa a madeira à vista nos lados e no pé (o botão da seção 3 compara). */
let moldura = true

function camas(): void {
  const lista = document.getElementById('camas')
  if (lista === null) return
  lista.replaceChildren()
  for (const c of CAMAS) {
    const figura = document.createElement('figure')
    figura.className = 'cama-figura'
    const canvas = document.createElement('canvas')
    canvas.setAttribute('role', 'img')
    const ctx = prepararCanvas(canvas, 1.8 * PPC_DA_CAMA, 2.8 * PPC_DA_CAMA)
    ctx.fillStyle = COR.chao
    ctx.fillRect(0, 0, 1.8 * PPC_DA_CAMA, 2.8 * PPC_DA_CAMA)
    pintarMoveis(ctx, [paraProp({ tipo: 'catre', cx: 0.9, cy: 1.4, travesseiro: c.travesseiro, cobertor: c.cobertor, cor: c.cor })], PPC_DA_CAMA, moldura)
    const legenda = document.createElement('figcaption')
    if (c.hoje) {
      legenda.innerHTML = '<span class="hoje">Hoje</span><br>sem os campos novos'
      canvas.setAttribute('aria-label', 'Cama de hoje, sem as cores novas')
    } else {
      const madeira = c.cor === undefined ? '' : `<br>Cor <span class="num">${c.cor}</span>`
      legenda.innerHTML = `Travesseiro <b>${nomeDaCor(c.travesseiro)}</b><br>Cobertor <b>${nomeDaCor(c.cobertor)}</b>${madeira}`
      canvas.setAttribute('aria-label', `Cama com travesseiro ${nomeDaCor(c.travesseiro)} e cobertor ${nomeDaCor(c.cobertor)}`)
    }
    figura.append(canvas, legenda)
    lista.append(figura)
  }
}

/**
 * Prova de que o mapa antigo abre igual: a cama sem os campos novos pintada pelo
 * `drawPropSilhouettes` de hoje e pelo caminho novo, comparada pixel a pixel.
 */
function provaDaCamaAntiga(): void {
  const alvo = document.getElementById('prova')
  if (alvo === null) return
  let casos = 0
  let diferentes = 0
  let total = 0
  for (const ppc of [24, 48, 96]) {
    for (const rot of [0, 30, 90]) {
      for (const comMoldura of [false, true]) {
        const prop = paraProp({ tipo: 'catre', cx: 1.5, cy: 1.5, rot })
        const doApp = paraOApp(prop)
        if (doApp === null) continue
        const a = document.createElement('canvas')
        const b = document.createElement('canvas')
        const ca = prepararCanvas(a, 3 * ppc, 3 * ppc)
        const cb = prepararCanvas(b, 3 * ppc, 3 * ppc)
        for (const ctx of [ca, cb]) {
          ctx.fillStyle = COR.chao
          ctx.fillRect(0, 0, 3 * ppc, 3 * ppc)
        }
        const escala = ppc / GRADE
        ca.setTransform(DPR * escala, 0, 0, DPR * escala, 0, 0)
        cb.setTransform(DPR * escala, 0, 0, DPR * escala, 0, 0)
        drawPropSilhouettes(new GraficoDeCanvas(ca) as unknown as Graphics, [doApp], escala, DPR)
        pintarMovelProposto(new GraficoDeCanvas(cb), prop, escala, DPR, comMoldura)
        const da = ca.getImageData(0, 0, a.width, a.height).data
        const db = cb.getImageData(0, 0, b.width, b.height).data
        for (let i = 0; i < da.length; i += 4) {
          if (da[i] !== db[i] || da[i + 1] !== db[i + 1] || da[i + 2] !== db[i + 2] || da[i + 3] !== db[i + 3]) diferentes += 1
        }
        total += da.length / 4
        casos += 1
      }
    }
  }
  const classe = diferentes === 0 ? 'ok' : 'falhou'
  alvo.innerHTML = `<span class="${classe}">${diferentes === 0 ? 'Mapa antigo abre igual' : 'Diferença encontrada'}</span><span>Cama sem os campos novos, desenho de hoje contra o caminho novo: <span class="num">${diferentes}</span> de <span class="num">${total.toLocaleString('pt-BR')}</span> pixels diferentes em ${casos} casos (24, 48 e 96 px por casa; giro 0°, 30° e 90°; com e sem a variante).</span>`
  document.documentElement.dataset.provaCama = String(diferentes)
}

// ---------------------------------------------------------------- 4 · painel

interface EstadoDoPainel {
  tipo: TipoProposto
  vista: VistaMobilia
  forma: FormaDoTapete
  preenchido: boolean
  cor?: string
  linha?: string
  travesseiro?: string
  cobertor?: string
}

const TIPOS_DA_LISTA: readonly TipoProposto[] = [...TIPOS_MOBILIA, 'tapete']
const rotuloDoTipo = (tipo: TipoProposto): string => (tipo === 'tapete' ? 'Tapete' : ROTULO_MOBILIA[tipo])
const temVista = (tipo: TipoProposto): boolean => tipo === 'tapete' || aceitaVista(tipo as TipoMobilia)

const ICONE_PIPETA =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 5.5l4 4"/><path d="M17.8 3.2a2 2 0 0 1 2.9 2.9l-2.2 2.2-2.9-2.9z"/><path d="M15.6 6.4L6 16l-1 3 3-1 9.6-9.6"/></svg>'
const ICONE_FORMA: Record<FormaDoTapete, string> = {
  retangular: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="6.5" width="18" height="11"/></svg>',
  redondo: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="7.5"/></svg>',
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, atributos: Record<string, string> = {}, ...filhos: (Node | string)[]): HTMLElementTagNameMap[K] {
  const no = document.createElement(tag)
  for (const [nome, valor] of Object.entries(atributos)) {
    if (nome === 'class') no.className = valor
    else no.setAttribute(nome, valor)
  }
  no.append(...filhos)
  return no
}

/** A pipeta armada (uma só na página): o campo para onde vai a cor da prévia. */
let pipetaArmada: { botao: HTMLButtonElement; canvas: HTMLCanvasElement; dica: HTMLElement; aplicar: (cor: string) => void } | null = null

function desarmarPipeta(): void {
  if (pipetaArmada === null) return
  pipetaArmada.botao.setAttribute('aria-pressed', 'false')
  pipetaArmada.canvas.classList.remove('mirando')
  pipetaArmada.dica.textContent = ''
  pipetaArmada = null
}

window.addEventListener(
  'keydown',
  (evento) => {
    if (evento.key === 'Escape' && pipetaArmada !== null) {
      evento.preventDefault()
      const botao = pipetaArmada.botao
      desarmarPipeta()
      botao.focus()
    }
  },
  true,
)

interface Painel {
  estado: EstadoDoPainel
  raiz: HTMLElement
  previa: HTMLCanvasElement
  dica: HTMLElement
  desenharPrevia: (painel: Painel) => void
}

function montarPainel(painel: Painel): void {
  const { estado, raiz } = painel
  const foco = document.activeElement instanceof HTMLElement && raiz.contains(document.activeElement) ? document.activeElement.dataset.foco : undefined
  const base = raiz.id
  const secao = el('section', { class: 'lb-section' }, el('h2', { class: 'lb-eyebrow' }, 'Móvel'))

  const tipo = el('select', { id: `${base}-tipo`, class: 'lb-input', 'data-foco': 'tipo' })
  for (const opcao of TIPOS_DA_LISTA) tipo.append(el('option', { value: opcao }, rotuloDoTipo(opcao)))
  tipo.value = estado.tipo
  tipo.addEventListener('change', () => {
    estado.tipo = tipo.value as TipoProposto
    if (!temVista(estado.tipo)) estado.vista = 'frente'
    atualizar(painel, true)
  })
  secao.append(el('div', { class: 'lb-field' }, el('label', { class: 'lb-label', for: `${base}-tipo` }, 'Tipo'), tipo))

  if (temVista(estado.tipo)) {
    secao.append(segmentado('Vista', VISTAS_MOBILIA, (v) => ROTULO_VISTA[v], () => estado.vista, (v) => (estado.vista = v), painel, 'vista'))
  }
  if (estado.tipo === 'tapete') {
    secao.append(segmentado('Forma', FORMAS_DO_TAPETE, (f) => ROTULO_FORMA[f], () => estado.forma, (f) => (estado.forma = f), painel, 'forma', ICONE_FORMA))
  }

  const preencher = el('input', { class: 'lb-switch__input', type: 'checkbox', 'data-foco': 'preencher' })
  preencher.checked = estado.preenchido
  preencher.addEventListener('change', () => {
    estado.preenchido = preencher.checked
    atualizar(painel, true)
  })
  secao.append(el('label', { class: 'lb-switch' }, el('span', {}, 'Preencher'), el('span', { class: 'lb-switch__track' }, preencher)))

  const fundoPadrao = hex(PROP_SILHOUETTE_FILL_COLOR)
  secao.append(
    campoDeCor(painel, 'cor', 'Cor', () => estado.cor, (c) => (estado.cor = c), fundoPadrao, !estado.preenchido),
  )
  if (estado.tipo === 'catre') {
    // O tom da cama padrão sobre o chão padrão (preto a 35% sobre #a8776a), não o preto puro: a amostra "Padrão" mostra o que a cama pinta.
    const madeira = (): string => estado.cor ?? CAMA_PADRAO_NO_CHAO
    secao.append(
      campoDeTecido(painel, 'travesseiro', 'Cor do travesseiro', () => estado.travesseiro, (c) => (estado.travesseiro = c), madeira),
      campoDeTecido(painel, 'cobertor', 'Cor do cobertor', () => estado.cobertor, (c) => (estado.cobertor = c), madeira),
    )
  }
  secao.append(campoDeCor(painel, 'linha', 'Cor da linha', () => estado.linha, (c) => (estado.linha = c), hex(PROP_SILHOUETTE_EDGE_COLOR), false))

  raiz.replaceChildren(secao)
  if (foco !== undefined) raiz.querySelector<HTMLElement>(`[data-foco="${foco}"]`)?.focus()
}

function segmentado<T extends string>(
  rotulo: string,
  opcoes: readonly T[],
  nome: (opcao: T) => string,
  atual: () => T,
  escolher: (opcao: T) => void,
  painel: Painel,
  chave: string,
  icones?: Record<T, string>,
): HTMLElement {
  const grupo = el('div', { class: 'lb-seg', role: 'radiogroup', 'aria-label': rotulo })
  for (const opcao of opcoes) {
    const botao = el('button', { type: 'button', role: 'radio', class: 'lb-seg__option', 'aria-checked': String(atual() === opcao), 'data-foco': `${chave}-${opcao}` })
    if (icones !== undefined) botao.insertAdjacentHTML('beforeend', icones[opcao])
    botao.append(nome(opcao))
    botao.addEventListener('click', () => {
      if (atual() === opcao) return
      escolher(opcao)
      atualizar(painel, true)
    })
    grupo.append(botao)
  }
  return el('div', { class: 'lb-field' }, el('span', { class: 'lb-label' }, rotulo), grupo)
}

/** A linha de uma cor no molde do `CampoDeCor` de hoje: "Padrão" só com cor própria, pipeta, amostra nativa. */
function campoDeCor(
  painel: Painel,
  chave: string,
  rotulo: string,
  atual: () => string | undefined,
  escolher: (cor: string | undefined) => void,
  padrao: string | (() => string),
  desabilitado: boolean,
  comBotaoPadrao = true,
): HTMLElement {
  const id = `${painel.raiz.id}-${chave}`
  const valorPadrao = (): string => (typeof padrao === 'string' ? padrao : padrao())
  const botaoPadrao = el('button', { type: 'button', class: 'lb-btn lb-btn--ghost', 'aria-label': `Padrão: ${rotulo.toLowerCase()}`, 'data-foco': `${chave}-padrao` }, 'Padrão')
  const pipeta = el('button', { type: 'button', class: 'lb-iconbtn', 'aria-label': `Pegar da prévia: ${rotulo}`, 'aria-pressed': 'false', title: `Pegar da prévia: ${rotulo}`, 'data-foco': `${chave}-pipeta` })
  pipeta.innerHTML = ICONE_PIPETA
  const amostra = el('input', { id, class: 'lb-swatch', type: 'color', 'data-foco': `${chave}-amostra` })
  amostra.value = atual() ?? valorPadrao()
  botaoPadrao.hidden = atual() === undefined
  for (const controle of [botaoPadrao, pipeta, amostra]) controle.disabled = desabilitado
  amostra.addEventListener('input', () => {
    escolher(amostra.value)
    botaoPadrao.hidden = false
    atualizar(painel, false)
  })
  // Fechou o seletor livre: a paleta e o "Padrão" se arrumam (marcada, ponto de Tab).
  amostra.addEventListener('change', () => atualizar(painel, true))
  botaoPadrao.addEventListener('click', () => {
    escolher(undefined)
    atualizar(painel, true)
    painel.raiz.querySelector<HTMLElement>(`[data-foco="${chave}-amostra"]`)?.focus()
  })
  pipeta.addEventListener('click', () => {
    const jaEra = pipetaArmada?.botao === pipeta
    desarmarPipeta()
    if (jaEra) return
    pipeta.setAttribute('aria-pressed', 'true')
    painel.previa.classList.add('mirando')
    painel.dica.textContent = `Clique na prévia para pegar a cor (${rotulo}). Esc cancela.`
    pipetaArmada = {
      botao: pipeta,
      canvas: painel.previa,
      dica: painel.dica,
      aplicar: (cor) => {
        escolher(cor)
        atualizar(painel, true)
      },
    }
  })
  const grupo = el('div', { class: 'lb-mobilia__color' }, ...(comBotaoPadrao ? [botaoPadrao] : []), el('span', { class: 'lb-campo-cor' }, pipeta, amostra))
  return el('div', { class: 'lb-section__row' }, el('label', { class: 'lb-label', for: id }, rotulo), grupo)
}

/**
 * NOVO: a cor de tecido = a linha de cor de sempre (pipeta e seletor livre) e,
 * embaixo, a paleta. O "Padrão" é a PRIMEIRA amostra da paleta (riscada: pinta
 * com a cama, como hoje), e não o botão fantasma da linha: com o botão, o
 * rótulo longo quebrava em duas linhas no primeiro clique e a paleta descia
 * debaixo do cursor. Um ponto de Tab; setas, Home e End andam e escolhem.
 */
function campoDeTecido(painel: Painel, chave: string, rotulo: string, atual: () => string | undefined, escolher: (cor: string | undefined) => void, padrao: () => string): HTMLElement {
  const desabilitado = !painel.estado.preenchido
  const opcoes: { nome: string; cor: string | undefined }[] = [{ nome: 'Padrão', cor: undefined }, ...PALETA_DE_TECIDO]
  const paleta = el('div', { class: 'lb-paleta', role: 'radiogroup', 'aria-label': `Paleta: ${rotulo.toLowerCase()}` })
  const amostras = opcoes.map(({ nome, cor }) => {
    const marcada = atual() === cor
    const titulo = cor === undefined ? 'Padrão: pinta com a cama, como hoje' : nome
    const b = el('button', {
      type: 'button',
      role: 'radio',
      class: cor === undefined ? 'lb-paleta__amostra lb-paleta__amostra--padrao' : 'lb-paleta__amostra',
      'aria-checked': String(marcada),
      'aria-label': cor === undefined ? 'Padrão (como hoje)' : nome,
      title: titulo,
      'data-foco': `${chave}-${nome}`,
      'data-cor': cor ?? '',
      style: `--amostra:${cor ?? padrao()}`,
    })
    b.disabled = desabilitado
    return b
  })
  // Roving tabindex: a marcada (ou a primeira) é o único ponto de Tab da paleta.
  const indiceMarcado = Math.max(0, amostras.findIndex((b) => b.getAttribute('aria-checked') === 'true'))
  const ir = (destino: number): void => {
    escolher(opcoes[destino].cor)
    atualizar(painel, true)
    painel.raiz.querySelector<HTMLElement>(`[data-foco="${chave}-${opcoes[destino].nome}"]`)?.focus()
  }
  amostras.forEach((b, i) => {
    b.tabIndex = i === indiceMarcado ? 0 : -1
    b.addEventListener('click', () => ir(i))
    b.addEventListener('keydown', (evento) => {
      const ultimo = amostras.length - 1
      const destino = evento.key === 'ArrowRight' || evento.key === 'ArrowDown' ? (i === ultimo ? 0 : i + 1) : evento.key === 'ArrowLeft' || evento.key === 'ArrowUp' ? (i === 0 ? ultimo : i - 1) : evento.key === 'Home' ? 0 : evento.key === 'End' ? ultimo : null
      if (destino === null) return
      evento.preventDefault()
      ir(destino)
    })
  })
  paleta.append(...amostras)
  return el('div', { class: 'lb-cor-de-tecido' }, campoDeCor(painel, chave, rotulo, atual, escolher, padrao, desabilitado, false), paleta)
}

/** Depois de cada troca: a paleta e o "Padrão" refletem o estado; `reconstruir` = a seção muda de forma (tipo, vista, forma, preencher). */
function atualizar(painel: Painel, reconstruir: boolean): void {
  if (reconstruir) montarPainel(painel)
  else {
    for (const b of painel.raiz.querySelectorAll<HTMLButtonElement>('.lb-paleta__amostra')) {
      const grupo = b.closest('.lb-cor-de-tecido')
      const amostra = grupo?.querySelector<HTMLInputElement>('input[type=color]')
      b.setAttribute('aria-checked', String(amostra !== null && amostra !== undefined && b.dataset.cor === amostra.value))
    }
  }
  painel.desenharPrevia(painel)
}

function movelDoPainel(estado: EstadoDoPainel, cx: number, cy: number): Movel {
  return {
    tipo: estado.tipo,
    cx,
    cy,
    vista: estado.vista,
    forma: estado.forma,
    preenchido: estado.preenchido,
    cor: estado.cor,
    linha: estado.linha,
    travesseiro: estado.tipo === 'catre' ? estado.travesseiro : undefined,
    cobertor: estado.tipo === 'catre' ? estado.cobertor : undefined,
  }
}

const PPC_DA_PREVIA = 48
const CAMA_PADRAO_NO_CHAO = '#6d4d45'
function previaDoTapete(painel: Painel): void {
  const { estado } = painel
  const largura = 5.6
  const altura = 4.4
  const ctx = prepararCanvas(painel.previa, largura * PPC_DA_PREVIA, altura * PPC_DA_PREVIA)
  if (estado.vista === 'lado') {
    const piso = 3.2
    fundoDeLado(ctx, largura, altura, piso, PPC_DA_PREVIA)
    const m = movelDoPainel(estado, largura / 2, 0)
    const { h } = tamanhoEmCasas(m.tipo, 'lado', m.forma ?? 'retangular')
    const moveis: Movel[] = [{ ...m, cy: piso - h / 2 }]
    if (estado.tipo === 'tapete') moveis.push({ tipo: 'cadeira', vista: 'lado', cx: largura / 2 + 0.6, cy: piso - tamanhoEmCasas('cadeira', 'lado', 'retangular').h / 2 })
    pintarMoveis(ctx, moveis.map(paraProp), PPC_DA_PREVIA, false)
    return
  }
  ctx.fillStyle = COR.chao
  ctx.fillRect(0, 0, largura * PPC_DA_PREVIA, altura * PPC_DA_PREVIA)
  desenharGrade(ctx, 0, 0, largura * PPC_DA_PREVIA, altura * PPC_DA_PREVIA, PPC_DA_PREVIA)
  const moveis: Movel[] = [movelDoPainel(estado, largura / 2, altura / 2)]
  if (estado.tipo === 'tapete') moveis.unshift({ tipo: 'mesa', cx: largura / 2, cy: altura / 2 })
  pintarMoveis(ctx, moveis.map(paraProp), PPC_DA_PREVIA, false)
}

function previaDaCama(painel: Painel): void {
  const largura = 4.4
  const altura = 3.4
  const ctx = prepararCanvas(painel.previa, largura * PPC_DA_PREVIA, altura * PPC_DA_PREVIA)
  ctx.fillStyle = COR.chao
  ctx.fillRect(0, 0, largura * PPC_DA_PREVIA, altura * PPC_DA_PREVIA)
  desenharGrade(ctx, 0, 0, largura * PPC_DA_PREVIA, altura * PPC_DA_PREVIA, PPC_DA_PREVIA)
  const selecionada = movelDoPainel(painel.estado, 3.1, 1.6)
  pintarMoveis(ctx, [paraProp({ tipo: 'catre', cx: 1.2, cy: 1.6 }), paraProp(selecionada)], PPC_DA_PREVIA, moldura)
  ctx.fillStyle = 'rgba(28,26,22,0.78)'
  ctx.font = '600 11px "Segoe UI", system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('hoje', 1.2 * PPC_DA_PREVIA, 3.05 * PPC_DA_PREVIA)
  ctx.fillText('selecionada', 3.1 * PPC_DA_PREVIA, 3.05 * PPC_DA_PREVIA)
}

function pegarCorDaPrevia(evento: MouseEvent): void {
  const armada = pipetaArmada
  if (armada === null || evento.currentTarget !== armada.canvas) return
  const caixa = armada.canvas.getBoundingClientRect()
  const ctx = armada.canvas.getContext('2d', { willReadFrequently: true })
  if (ctx === null) return
  const x = Math.floor((evento.clientX - caixa.left) * DPR)
  const y = Math.floor((evento.clientY - caixa.top) * DPR)
  const [r, g, b] = ctx.getImageData(x, y, 1, 1).data
  const cor = hex((r << 16) | (g << 8) | b)
  const { aplicar, botao } = armada
  desarmarPipeta()
  aplicar(cor)
  botao.focus()
}

function painel(id: string, estado: EstadoDoPainel, desenharPrevia: (p: Painel) => void): Painel | null {
  const raiz = document.getElementById(`painel-${id}`)
  const previa = document.getElementById(`previa-${id}`)
  const dica = document.getElementById(`dica-${id}`)
  if (raiz === null || !(previa instanceof HTMLCanvasElement) || dica === null) return null
  const p: Painel = { estado, raiz, previa, dica, desenharPrevia }
  previa.addEventListener('click', pegarCorDaPrevia)
  montarPainel(p)
  desenharPrevia(p)
  return p
}

// ---------------------------------------------------------------- lista e ícones

const SVG = (corpo: string, tamanho = 18): string =>
  `<svg width="${tamanho}" height="${tamanho}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${corpo}</svg>`
/** O ícone novo: o corpo, o losango do medalhão e três fios de franja em cada ponta curta. */
const ICONE_TAPETE = '<rect x="4.5" y="6" width="15" height="12" /><path d="M12 8.6l4.4 3.4-4.4 3.4-4.4-3.4z" /><path d="M4.5 8.5H2.5M4.5 12H2.5M4.5 15.5H2.5M19.5 8.5h2M19.5 12h2M19.5 15.5h2" />'
// Copiados de components/icons.tsx (glifoDoMovel), para a lista ficar ao lado dos vizinhos reais.
const ICONES_DE_HOJE: Partial<Record<TipoMobilia, string>> = {
  armario: '<rect x="3" y="7.5" width="18" height="9" /><path d="M3 11.6h18M7.5 16.5v-1.6M16.5 16.5v-1.6" />',
  aparador: '<rect x="2" y="9" width="20" height="6" /><path d="M2 13.3h20M12 13.3V15" />',
  fogueira:
    '<circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="6.3" /><path d="M17.8 14.4l2.5 1.0M14.4 17.8l1.0 2.5M9.6 17.8l-1.0 2.5M6.2 14.4l-2.5 1.0M6.2 9.6l-2.5-1.0M9.6 6.2l-1.0-2.5M14.4 6.2l1.0-2.5M17.8 9.6l2.5-1.0" /><path d="M8.3 9.4l7.4 5.2M8.3 14.6l7.4-5.2" />',
}

function lista(): void {
  const alvo = document.getElementById('lista')
  const icones = document.getElementById('icones')
  if (alvo === null || icones === null) return
  const linhas: string[] = []
  for (const tipo of ['armario', 'aparador', 'fogueira'] as const) {
    linhas.push(`<div class="opcao">${SVG(ICONES_DE_HOJE[tipo] ?? '')}<b>${ROTULO_MOBILIA[tipo]}</b><span>Clique no mapa para pôr ${NOME_COM_ARTIGO[tipo]}.</span></div>`)
  }
  linhas.push(`<div class="opcao nova">${SVG(ICONE_TAPETE)}<b>Tapete</b><span>Clique no mapa para pôr um tapete.</span></div>`)
  alvo.innerHTML = linhas.join('')
  icones.innerHTML = [18, 24, 36].map((t) => SVG(ICONE_TAPETE, t)).join('')
}

// ---------------------------------------------------------------- montagem

function tudo(): void {
  for (const ppc of [24, 48, 96]) sala(ppc)
  for (const ppc of [48, 96]) lado(ppc)
  camas()
  provaDaCamaAntiga()
  lista()
  painel('tapete', { tipo: 'tapete', vista: 'frente', forma: 'retangular', preenchido: true, cor: '#7a3a33' }, previaDoTapete)
  const cama = painel('cama', { tipo: 'catre', vista: 'frente', forma: 'retangular', preenchido: true, travesseiro: T.Branco, cobertor: T.Vermelho }, previaDaCama)
  const botaoMoldura = document.getElementById('moldura')
  botaoMoldura?.addEventListener('click', () => {
    moldura = !moldura
    botaoMoldura.setAttribute('aria-pressed', String(moldura))
    camas()
    for (const ppc of [24, 48, 96]) sala(ppc)
    if (cama !== null) cama.desenharPrevia(cama)
  })
  document.documentElement.dataset.pronto = '1'
}

tudo()
