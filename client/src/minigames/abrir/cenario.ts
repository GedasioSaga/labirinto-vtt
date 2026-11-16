/**
 * CENÁRIO COMUM DOS JOGOS DE ABRIR: o porão onde ficam o baú, a caixa e o
 * barril (parede de pedra quente, piso de tábua, luz de lampião) e a vela que
 * marca o tempo da tentativa. O fundo é gerado por código, igual em toda
 * execução, e fica numa tela fora da página; sem tela disponível (teste em
 * Node), é desenhado direto.
 */
import { COR, H, W, contorno, luz, misturar, pix } from './desenho'
import { rngDe } from './rng'
import { LIMITE_S } from './tipos'

/** Linha do chão, em px: a base dos recipientes encosta aqui. */
export const CHAO_Y = 104
/** Centro horizontal da cena, em px: onde fica o recipiente. */
export const CENTRO_X = 120

/** Vela do tempo: canto de cima à direita, longe do recipiente e dos alvos de toque. */
export const VELA_X = 222
export const VELA_TOPO = 10
const VELA_ALTURA = 26

export interface TelaFora {
  tela: CanvasImageSource
  g: CanvasRenderingContext2D
}

/** Cria uma tela fora da página; null sem DOM (teste em Node). Ponto de troca do teste (o OffscreenCanvas). */
export function novaTela(w: number, h: number): TelaFora | null {
  if (typeof OffscreenCanvas !== 'undefined') {
    const c = new OffscreenCanvas(w, h)
    const g = c.getContext('2d') as unknown as CanvasRenderingContext2D | null // a arte só pinta (fill, drawImage, gradiente, transform), API igual nos dois; `canvas` e os métodos de foco, que diferem, nunca são usados
    if (g) return { tela: c, g }
  }
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const g = c.getContext('2d')
    if (g) return { tela: c, g }
  }
  return null
}

function pintarParede(g: CanvasRenderingContext2D): void {
  const r = rngDe('porao|parede')
  pix(g, COR.argamassa, 0, 0, W, CHAO_Y)
  const FIADA = 9
  for (let y = 0, fila = 0; y < CHAO_Y; y += FIADA, fila++) {
    let x = fila % 2 === 0 ? -6 : -14
    while (x < W) {
      const larg = 12 + Math.floor(r() * 12)
      const tom = misturar(COR.muro, COR.muroRealce, r() * 0.6)
      const alt = Math.min(FIADA - 1, CHAO_Y - y - 1)
      if (alt > 1) {
        pix(g, tom, x + 1, y + 1, larg - 1, alt)
        pix(g, luz(tom, 1.12), x + 1, y + 1, larg - 1, 1)
        pix(g, luz(tom, 0.86), x + 1, y + alt, larg - 1, 1)
        // Grão leve na pedra (regra do Meio-Termo: textura por código).
        for (let k = 0; k < 3; k++) pix(g, luz(tom, r() < 0.5 ? 0.9 : 1.08), x + 2 + Math.floor(r() * (larg - 3)), y + 2 + Math.floor(r() * Math.max(1, alt - 2)))
      }
      x += larg
    }
  }
}

function pintarPiso(g: CanvasRenderingContext2D): void {
  const r = rngDe('porao|piso')
  pix(g, COR.pisoFresta, 0, CHAO_Y, W, H - CHAO_Y)
  // Rodapé de sombra onde a parede encontra o chão.
  pix(g, COR.sombra, 0, CHAO_Y, W, 2)
  for (let y = CHAO_Y + 2, fila = 0; y < H; y += 6, fila++) {
    let x = -Math.floor(r() * 30)
    while (x < W) {
      const larg = 34 + Math.floor(r() * 30)
      const tom = misturar(COR.piso, luz(COR.nogueira, 0.7), r() * 0.5)
      pix(g, tom, x, y, larg - 1, 5)
      pix(g, luz(tom, 1.1), x, y, larg - 1, 1)
      for (let k = 0; k < 4; k++) pix(g, luz(tom, 0.88), x + Math.floor(r() * (larg - 4)), y + 2 + Math.floor(r() * 2), 3, 1)
      x += larg
    }
  }
}

function pintarFundo(g: CanvasRenderingContext2D): void {
  pintarParede(g)
  pintarPiso(g)
}

let fundo: CanvasImageSource | null = null

/** Parede e piso do porão. */
export function desenharFundo(g: CanvasRenderingContext2D): void {
  if (fundo === null) {
    const t = novaTela(W, H)
    if (t === null) {
      pintarFundo(g)
      return
    }
    pintarFundo(t.g)
    fundo = t.tela
  }
  g.drawImage(fundo, 0, 0)
}

/** Tremulação da chama, 0..1 (fixa em 1 no movimento reduzido). */
export function tremular(t: number, reduzido: boolean): number {
  if (reduzido) return 1
  return 0.85 + 0.1 * Math.sin(t * 9.1) + 0.05 * Math.sin(t * 23.7 + 1.3)
}

/** Luz quente do lampião, por cima do fundo (o canto de baixo fica mais escuro). */
export function desenharLuz(g: CanvasRenderingContext2D, t: number, reduzido: boolean): void {
  const k = tremular(t, reduzido)
  const luzQuente = g.createRadialGradient(CENTRO_X, 46, 8, CENTRO_X, 46, 150)
  luzQuente.addColorStop(0, `rgba(243,186,102,${(0.16 * k).toFixed(3)})`)
  luzQuente.addColorStop(1, 'rgba(243,186,102,0)')
  g.fillStyle = luzQuente
  g.fillRect(0, 0, W, H)
  const canto = g.createRadialGradient(CENTRO_X, 60, 70, CENTRO_X, 60, 170)
  canto.addColorStop(0, 'rgba(18,13,10,0)')
  canto.addColorStop(1, 'rgba(18,13,10,0.55)')
  g.fillStyle = canto
  g.fillRect(0, 0, W, H)
}

/**
 * Vela do tempo: a cera desce de cheia (t = 0) a quase nada (t = LIMITE_S).
 * Nos últimos 5 s a chama fica vermelha. Sem texto: quem precisa do número
 * lê o HUD do DOM.
 */
export function desenharVela(g: CanvasRenderingContext2D, tempo: number, reduzido: boolean): void {
  const resta = Math.max(0, Math.min(1, 1 - tempo / LIMITE_S))
  const cera = Math.max(2, Math.round(VELA_ALTURA * resta))
  const base = VELA_TOPO + VELA_ALTURA
  // Castiçal de latão.
  pix(g, contorno(COR.latao), VELA_X - 6, base, 13, 3)
  pix(g, COR.latao, VELA_X - 5, base, 11, 2)
  pix(g, luz(COR.latao, 1.2), VELA_X - 5, base, 11, 1)
  // Cera.
  const topo = base - cera
  pix(g, contorno(COR.branco), VELA_X - 3, topo, 7, cera)
  pix(g, COR.branco, VELA_X - 2, topo, 5, cera)
  pix(g, luz(COR.branco, 0.9), VELA_X + 1, topo + 1, 1, cera - 1)
  // Pavio e chama.
  pix(g, COR.sombra, VELA_X, topo - 2, 1, 2)
  if (resta <= 0) return
  const k = tremular(tempo, reduzido)
  const fim = resta * LIMITE_S <= 5
  const corChama = fim ? COR.brasa : COR.chama
  const alt = Math.round(3 + 2 * k)
  pix(g, corChama, VELA_X - 1, topo - 2 - alt, 3, alt)
  pix(g, fim ? COR.chama : COR.ouro, VELA_X, topo - 1 - alt, 1, alt - 1)
  const halo = g.createRadialGradient(VELA_X, topo - 4, 1, VELA_X, topo - 4, 14)
  halo.addColorStop(0, `rgba(243,186,102,${(0.22 * k).toFixed(3)})`)
  halo.addColorStop(1, 'rgba(243,186,102,0)')
  g.fillStyle = halo
  g.fillRect(VELA_X - 14, topo - 18, 28, 28)
}
