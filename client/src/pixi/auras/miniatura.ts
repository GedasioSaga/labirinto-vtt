import type { TipoDeAura } from '../../lib/auras'

/**
 * AURA DA FICHA — a miniatura de cada aura para os menus ("Aura ›").
 *
 * PROVISÓRIO (F1.1): um anel colorido por tipo em volta de um disco neutro, só
 * para o mestre distinguir uma aura da outra enquanto o desenho de verdade não
 * entra. A fase do desenho troca o que `pintar` faz e mantém a assinatura de
 * `miniaturaDaAura` e o cache por tipo e lado.
 */

/** Duas cores por aura: a do anel e a do brilho por fora. */
const CORES: Record<Exclude<TipoDeAura, 'multicolorida'>, readonly [anel: string, brilho: string]> = {
  'almas-roxas': ['#a78bfa', '#6d28d9'],
  'chamas-negras': ['#3f3f46', '#09090b'],
  'fogo-raios-roxos': ['#fb923c', '#a855f7'],
  fogo: ['#fb923c', '#fde047'],
  trevas: ['#475569', '#0f172a'],
  'eletrica-amarela': ['#fde047', '#ca8a04'],
  'eletrica-azul': ['#7dd3fc', '#0284c7'],
  vermelha: ['#f87171', '#b91c1c'],
}

/** A multicolorida: o anel em fatias, uma cor por fatia. */
const FATIAS_DA_MULTICOLORIDA = ['#f87171', '#fb923c', '#fde047', '#4ade80', '#7dd3fc', '#a78bfa'] as const

/** Frações do lado: o disco da ficha no meio, o anel em volta, o brilho por fora. */
const RAIO_DO_DISCO = 0.24
const RAIO_DO_ANEL = 0.36
const LARGURA_DO_ANEL = 0.09
const LARGURA_DO_BRILHO = 0.2
const OPACIDADE_DO_BRILHO = 0.45
const COR_DO_DISCO = '#78716c'

function tracarAnel(ctx: CanvasRenderingContext2D, centro: number, raio: number, largura: number, cor: string, de = 0, ate = Math.PI * 2): void {
  ctx.beginPath()
  ctx.arc(centro, centro, raio, de, ate)
  ctx.lineWidth = largura
  ctx.strokeStyle = cor
  ctx.stroke()
}

function pintar(ctx: CanvasRenderingContext2D, tipo: TipoDeAura, lado: number): void {
  const centro = lado / 2
  if (tipo === 'multicolorida') {
    const fatia = (Math.PI * 2) / FATIAS_DA_MULTICOLORIDA.length
    FATIAS_DA_MULTICOLORIDA.forEach((cor, i) => tracarAnel(ctx, centro, lado * RAIO_DO_ANEL, lado * LARGURA_DO_ANEL, cor, i * fatia, (i + 1) * fatia))
  } else {
    const [anel, brilho] = CORES[tipo]
    ctx.globalAlpha = OPACIDADE_DO_BRILHO
    tracarAnel(ctx, centro, lado * RAIO_DO_ANEL, lado * LARGURA_DO_BRILHO, brilho)
    ctx.globalAlpha = 1
    tracarAnel(ctx, centro, lado * RAIO_DO_ANEL, lado * LARGURA_DO_ANEL, anel)
  }
  ctx.beginPath()
  ctx.arc(centro, centro, lado * RAIO_DO_DISCO, 0, Math.PI * 2)
  ctx.fillStyle = COR_DO_DISCO
  ctx.fill()
}

/** Por tipo e lado: 9 auras vezes os poucos tamanhos de menu que existem. */
const prontas = new Map<string, HTMLCanvasElement>()

/**
 * A miniatura da aura `tipo` num quadrado de `lado` px (do canvas, não do CSS:
 * quem quer nitidez em tela densa pede o lado já multiplicado). O MESMO canvas
 * a cada pedido igual: quem mostra copia com `drawImage`, não o põe na página.
 * Sem contexto 2D (ambiente sem canvas), devolve o canvas em branco.
 */
export function miniaturaDaAura(tipo: TipoDeAura, lado: number): HTMLCanvasElement {
  const tamanho = Math.max(1, Math.round(lado))
  const chave = `${tipo}:${tamanho}`
  const pronta = prontas.get(chave)
  if (pronta !== undefined) return pronta
  const canvas = document.createElement('canvas')
  canvas.width = tamanho
  canvas.height = tamanho
  const ctx = canvas.getContext('2d')
  if (ctx !== null) pintar(ctx, tipo, tamanho)
  prontas.set(chave, canvas)
  return canvas
}
