/**
 * COREOGRAFIA DA REVELAÇÃO — mede o palco, posiciona as peças e aplica, a
 * cada quadro, o estado de `tempo.ts`. Só mexe em transform, opacity e
 * filter por quadro; nada força layout no meio da animação. Porte de
 * `coreografia.js` do protótipo v3.
 */

import { calcularLayout, ESPACO_DO_PULAR, type Layout, type Retangulo } from './layout'
import { comporMoldura, prepararMoldura } from './moldura'
import { clamp01, type EstadoDaRevelacao } from './tempo'

/** As peças do DOM que a coreografia move. As da imagem faltam no pino sem imagem. */
export interface PecasDaRevelacao {
  raiz: HTMLDivElement
  fundo: HTMLDivElement
  grupo: HTMLDivElement
  quadro: HTMLDivElement | null
  molduraImagem: HTMLCanvasElement | null
  vista: HTMLDivElement | null
  dobradicas: HTMLDivElement | null
  trilho: HTMLDivElement | null
  carro: HTMLDivElement | null
  painel: HTMLElement | null
  molduraPainel: HTMLCanvasElement | null
  folhas: HTMLDivElement | null
  nome: HTMLElement | null
  faceSombra: HTMLDivElement | null
  reflexo: HTMLSpanElement | null
}

/** Semente da moldura de cada peça: a madeira sai sempre com o mesmo veio. */
const SEMENTE_DO_PAINEL = 7
const SEMENTE_DA_IMAGEM = 11
/** Desfoque máximo (px) da entrada no pico da velocidade. */
const DESFOQUE_MAX = 1.2

const px = (v: number) => `${v.toFixed(2)}px`

function posicionar(el: HTMLElement, r: Retangulo): void {
  el.style.left = `${r.x}px`
  el.style.top = `${r.y}px`
  el.style.width = `${r.w}px`
  el.style.height = `${r.h}px`
}

/** Espessura (px) de uma variável de tema do palco; sem CSS carregado, o padrão. */
function pxDoTema(el: HTMLElement, nome: string, padrao: number): number {
  const valor = parseFloat(getComputedStyle(el).getPropertyValue(nome))
  return Number.isFinite(valor) && valor > 0 ? valor : padrao
}

export interface MedidasDaImagem {
  proporcao: number
  altura: number
}

/**
 * Mede o palco e posiciona tudo no lugar final. `null` = palco sem tamanho
 * (escondido, ou um teste sem layout): o relógio segue, só não há o que mover.
 */
export function medirEPosicionar(p: PecasDaRevelacao, imagem: MedidasDaImagem | null, temPainel: boolean, comPular: boolean): Layout | null {
  const madeira = pxDoTema(p.raiz, '--madeira', 16)
  const metal = pxDoTema(p.raiz, '--metal', 9)
  const painel = p.painel
  const L = calcularLayout({
    W: p.raiz.clientWidth,
    H: p.raiz.clientHeight,
    proporcao: imagem === null ? null : imagem.proporcao,
    naturalAltura: imagem === null ? 0 : imagem.altura,
    madeira,
    metal,
    temPainel,
    espacoDoPular: comPular ? ESPACO_DO_PULAR : 0,
    alturaDoPainel: (largura, minima, maxima) => {
      if (!painel) return 0
      painel.style.width = `${largura}px`
      painel.style.minHeight = `${minima}px`
      painel.style.maxHeight = `${maxima}px`
      return painel.offsetHeight
    },
  })
  if (L === null) return null
  p.raiz.dataset.modo = L.coluna ? 'coluna' : 'linha'
  posicionar(p.grupo, L.grupo)
  if (p.quadro) posicionar(p.quadro, L.quadro)
  if (p.vista) posicionar(p.vista, { x: L.f, y: L.f, w: L.imgW, h: L.imgH })
  if (p.trilho) {
    posicionar(p.trilho, L.trilho)
    p.trilho.style.perspectiveOrigin = L.perspectiveOrigin
  }
  if (p.carro) {
    posicionar(p.carro, { x: L.carro.x, y: L.carro.y, w: L.pw, h: L.ph })
    p.carro.style.transformOrigin = L.transformOrigin
  }
  if (p.painel) p.painel.style.height = `${L.ph}px`
  p.dobradicas?.querySelectorAll('i').forEach((cano, k) => {
    const r = L.canos[k]
    if (r) posicionar(cano, r)
  })
  p.folhas?.querySelectorAll('i').forEach((folha, k) => {
    const r = L.folhas[k]
    if (r) posicionar(folha, r)
  })
  if (p.molduraPainel && L.pw > 0 && L.ph > 0) {
    const pronta = prepararMoldura(L.pw, L.ph, madeira, metal, SEMENTE_DO_PAINEL)
    if (pronta) comporMoldura(p.molduraPainel, pronta)
  }
  if (p.molduraImagem && L.ow > 0) {
    const pronta = prepararMoldura(L.ow, L.oh, madeira, metal, SEMENTE_DA_IMAGEM)
    if (pronta) comporMoldura(p.molduraImagem, pronta)
  }
  return L
}

/**
 * Desfoque de movimento: cresce com o quadrado da velocidade e some quando a
 * entrada assenta. Fica ligado (mesmo em 0 px) durante a entrada inteira:
 * ligar e desligar recria a camada e engasga.
 */
function desfoque(velocidade: number, assentou: boolean): string {
  return assentou ? '' : `blur(${(DESFOQUE_MAX * velocidade * velocidade).toFixed(2)}px)`
}

function titulo(nome: HTMLElement | null, p: number): void {
  if (!nome) return
  nome.style.opacity = p.toFixed(3)
  nome.style.transform = p >= 1 ? '' : `translate3d(0, ${((1 - p) * 6).toFixed(2)}px, 0)`
  nome.style.filter = p >= 1 ? '' : `blur(${((1 - p) * 3).toFixed(2)}px)`
}

function definir(el: HTMLElement | null, propriedade: 'opacity' | 'transform' | 'filter', valor: string): void {
  if (el) el.style[propriedade] = valor
}

/** Aplica um instante. Sem layout (palco sem tamanho) só o véu muda. */
export function aplicarEstado(p: PecasDaRevelacao, L: Layout | null, est: EstadoDaRevelacao, reduzir: boolean): void {
  p.fundo.style.opacity = est.fundo.toFixed(3)
  if (L === null) return
  if (reduzir) {
    // Só fades curtos, tudo já no lugar.
    p.grupo.style.transform = ''
    definir(p.quadro, 'filter', '')
    definir(p.carro, 'filter', '')
    definir(p.carro, 'transform', '')
    definir(p.quadro, 'opacity', est.imagemOpac.toFixed(3))
    definir(p.dobradicas, 'opacity', est.imagemOpac.toFixed(3))
    definir(p.trilho, 'opacity', est.painelOpac.toFixed(3))
    definir(p.faceSombra, 'opacity', '0')
    definir(p.reflexo, 'opacity', '0')
    titulo(p.nome, 1)
    return
  }
  definir(p.quadro, 'opacity', '1')
  definir(p.dobradicas, 'opacity', '1')
  definir(p.trilho, 'opacity', '1')
  const ida = L.entradaX * (1 - est.entrada)
  p.grupo.style.transform = `translate3d(${px(ida)}, 0, 0)`
  if (L.semImagem) {
    // Sem imagem quem chega deslizando é o próprio painel: o desfoque vai nele.
    definir(p.carro, 'filter', desfoque(est.velocidade, est.entrada >= 1))
    titulo(p.nome, est.titulo)
    return
  }
  // Celular: o painel é mais largo que a imagem e vem preso a ela. Enquanto a imagem ainda está à direita,
  // o painel fica para trás o que passaria da borda (só nos primeiros quadros, quando dele se vê uma fresta).
  const excesso = L.coluna ? Math.max(0, ida - L.folgaDireita) : 0
  definir(p.quadro, 'filter', desfoque(est.velocidade, est.entrada >= 1))
  const th = est.angulo
  definir(p.carro, 'transform', L.coluna ? `translate3d(${px(-excesso)}, 0, 0) rotateX(${(-th).toFixed(2)}deg)` : `rotateY(${th.toFixed(2)}deg)`)
  // A face escurece de lado (luz do alto à esquerda, de frente) e uma faixa de brilho corre nela ao assentar.
  definir(p.faceSombra, 'opacity', (0.72 * Math.pow(clamp01(th / 90), 1.3)).toFixed(3))
  const g = clamp01(1 - th / 60)
  definir(p.reflexo, 'opacity', (0.34 * Math.sin(Math.PI * g)).toFixed(3))
  definir(p.reflexo, 'transform', `translate3d(${(-60 + 260 * g).toFixed(1)}%, 0, 0) skewX(-14deg)`)
  titulo(p.nome, est.titulo)
}
