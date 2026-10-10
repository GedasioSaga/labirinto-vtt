import { AJUSTE_DO_RELEVO } from '../lib/relevo'
import { css, type DesenhoDeCarimbo, type Rgb, type SombraDoCarimbo } from './embutidos'

/**
 * A ARTE de um carimbo em tela: o corpo (o objeto desenhado) e a silhueta da
 * sombra dele já deitada no chão. Feita uma vez por desenho (cada objeto da
 * biblioteca tem oito, um a cada 45° de giro) e reaproveitada por todos os
 * objetos iguais do mapa — no palco eles são sprites da mesma textura.
 *
 * A SOMBRA sai da silhueta do próprio corpo, então o objeto do pacote e a
 * imagem importada ganham sombra sem desenhá-la: a silhueta é projetada no
 * chão na direção da sombra do relevo (`AJUSTE_DO_RELEVO.sombra`, para baixo
 * e para a direita), comprida no que é alto (`em-pe`), curta no que é baixo
 * (`baixa`), e deslocada inteira na imagem importada (`solta`: não sabemos
 * onde é o pé dela). A silhueta é opaca; a transparência entra uma vez só,
 * na camada inteira (`drawCarimbos.ts`), e duas sombras que se cruzam não
 * escurecem duas vezes — a mesma regra do protótipo Diorama.
 */

/** O quadro do corpo, em unidades do tamanho, com a base do objeto na origem. */
export interface QuadroDaArte {
  esquerda: number
  topo: number
  lado: number
}

/** Os desenhos da biblioteca e do pacote: x de -0,75 a 0,75, y de -1,2 (o alto) a 0,3. */
export const QUADRO_DA_BIBLIOTECA: QuadroDaArte = { esquerda: -0.75, topo: -1.2, lado: 1.5 }
/** A imagem importada: centrada no ponto do clique, o lado maior com uma unidade. */
export const QUADRO_DO_IMPORTADO: QuadroDaArte = { esquerda: -0.5, topo: -0.5, lado: 1 }

/** O quadro da silhueta da sombra, em unidades: cabe a sombra mais comprida (a do `em-pe`) e a deslocada. */
export const QUADRO_DA_SOMBRA = { esquerda: -0.95, topo: -0.6, largura: 2.3, altura: 1.5 } as const
/** Resolução da silhueta: a sombra é macia, e a camada dela no palco é de baixa resolução. */
export const TEXELS_DA_SOMBRA_POR_UNIDADE = 40

/** Cor e transparência da sombra dos objetos (as do protótipo Diorama: `#0a1c28` a 30%, um pouco mais leve). */
export const COR_DA_SOMBRA: Rgb = [10, 28, 40]
export const ALFA_DA_SOMBRA = 0.28

export type JeitoDaSombra = SombraDoCarimbo | 'solta'

/** Matriz afim do Canvas: x' = a·x + c·y + e, y' = b·x + d·y + f. */
export type Matriz = readonly [number, number, number, number, number, number]

export function multiplicar(p: Matriz, q: Matriz): Matriz {
  return [
    p[0] * q[0] + p[2] * q[1],
    p[1] * q[0] + p[3] * q[1],
    p[0] * q[2] + p[2] * q[3],
    p[1] * q[2] + p[3] * q[3],
    p[0] * q[4] + p[2] * q[5] + p[4],
    p[1] * q[4] + p[3] * q[5] + p[5],
  ]
}

/** A direção da sombra do relevo, de comprimento 1. */
const DIRECAO = (() => {
  const { dx, dy } = AJUSTE_DO_RELEVO.sombra
  const n = Math.hypot(dx, dy)
  return { x: dx / n, y: dy / n }
})()

/** Comprimento da sombra por unidade de altura: o sol da tarde do mapa, nem a pino nem rasante. */
const COMPRIMENTO = { 'em-pe': 0.78, baixa: 0.4 } as const
/** Deslocamento da sombra da imagem importada, em unidades. */
const DESLOCAMENTO_SOLTO = 0.13

/**
 * Para onde cada ponto do corpo cai no chão. Um ponto a altura `h` acima da
 * base (y = -h) cai `h × comprimento` na direção da sombra: o pé fica no
 * lugar e o alto se deita para baixo e para a direita.
 */
export function matrizDaSombra(jeito: Exclude<JeitoDaSombra, 'nenhuma'>): Matriz {
  if (jeito === 'solta') return [1, 0, 0, 1, DIRECAO.x * DESLOCAMENTO_SOLTO, DIRECAO.y * DESLOCAMENTO_SOLTO]
  const l = COMPRIMENTO[jeito]
  return [1, 0, -l * DIRECAO.x, -l * DIRECAO.y, 0, 0]
}

export interface ArteEmTela {
  corpo: HTMLCanvasElement
  quadro: QuadroDaArte
  /** A silhueta da sombra no `QUADRO_DA_SOMBRA`, opaca na cor da sombra; `null` = objeto do chão. */
  sombra: HTMLCanvasElement | null
  /** Do chão (a poça): vai por baixo das sombras e dos outros objetos. */
  chao: boolean
}

function novaTela(largura: number, altura: number): { tela: HTMLCanvasElement; g: CanvasRenderingContext2D } | null {
  const tela = document.createElement('canvas')
  tela.width = largura
  tela.height = altura
  const g = tela.getContext('2d')
  return g === null ? null : { tela, g }
}

/** A silhueta deitada no chão, esfumada de leve (onde o navegador sabe borrar). */
export function silhuetaDaSombra(corpo: HTMLCanvasElement, quadro: QuadroDaArte, jeito: Exclude<JeitoDaSombra, 'nenhuma'>): HTMLCanvasElement | null {
  const k = TEXELS_DA_SOMBRA_POR_UNIDADE
  const q = QUADRO_DA_SOMBRA
  const nova = novaTela(Math.ceil(q.largura * k), Math.ceil(q.altura * k))
  if (nova === null) return null
  const { tela, g } = nova
  const kb = corpo.width / quadro.lado
  const daUnidadeParaATela: Matriz = [k, 0, 0, k, -q.esquerda * k, -q.topo * k]
  const doCorpoParaAUnidade: Matriz = [1 / kb, 0, 0, 1 / kb, quadro.esquerda, quadro.topo]
  const m = multiplicar(daUnidadeParaATela, multiplicar(matrizDaSombra(jeito), doCorpoParaAUnidade))
  // Borrão de uns 3% do tamanho: a sombra macia de uma luz grande. Sem
  // `filter` (Safari antigo) ela sai com a borda firme, e só.
  if ('filter' in g) g.filter = `blur(${(k * 0.03).toFixed(2)}px)`
  g.setTransform(m[0], m[1], m[2], m[3], m[4], m[5])
  g.drawImage(corpo, 0, 0)
  g.setTransform(1, 0, 0, 1, 0, 0)
  if ('filter' in g) g.filter = 'none'
  g.globalCompositeOperation = 'source-in'
  g.fillStyle = css(COR_DA_SOMBRA)
  g.fillRect(0, 0, tela.width, tela.height)
  return tela
}

/**
 * O desenho (biblioteca ou pacote) no quadro, num quadrado de `lado` texels.
 * O desenho que lança (pacote com defeito) sai `null`: o objeto não aparece,
 * e o resto do mapa segue.
 */
export function assarDesenho(desenhar: DesenhoDeCarimbo, sombra: SombraDoCarimbo, giro: number, semente: number, lado: number): ArteEmTela | null {
  const nova = novaTela(lado, lado)
  if (nova === null) return null
  const { tela, g } = nova
  const q = QUADRO_DA_BIBLIOTECA
  const k = lado / q.lado
  g.setTransform(k, 0, 0, k, -q.esquerda * k, -q.topo * k)
  try {
    desenhar(g, giro, semente)
  } catch (erro) {
    console.warn('[carimbos] o desenho falhou', erro)
    return null
  }
  g.setTransform(1, 0, 0, 1, 0, 0)
  return { corpo: tela, quadro: q, sombra: sombra === 'nenhuma' ? null : silhuetaDaSombra(tela, q, sombra), chao: sombra === 'nenhuma' }
}

/** A imagem importada no quadro dela: o lado maior com uma unidade, centrada no ponto do clique. */
export function assarImagem(imagem: CanvasImageSource, largura: number, altura: number, lado: number): ArteEmTela | null {
  if (!(largura > 0 && altura > 0)) return null
  const nova = novaTela(lado, lado)
  if (nova === null) return null
  const { tela, g } = nova
  const escala = lado / Math.max(largura, altura)
  const w = largura * escala
  const h = altura * escala
  g.imageSmoothingQuality = 'high'
  g.drawImage(imagem, (lado - w) / 2, (lado - h) / 2, w, h)
  return { corpo: tela, quadro: QUADRO_DO_IMPORTADO, sombra: silhuetaDaSombra(tela, QUADRO_DO_IMPORTADO, 'solta'), chao: false }
}

/** O chão da miniatura: a terra clara do mapa do usuário, para o pinheiro escuro e a sombra se lerem. */
export const CHAO_DA_MINIATURA: Rgb = [200, 190, 152]

/**
 * A miniatura do painel: o objeto sobre um quadrado de chão, com a sombra —
 * como ele vai ficar no mapa. Mostra o quadro do corpo inteiro e um pouco da
 * sombra que sai dele.
 */
export function miniaturaDaArte(arte: ArteEmTela, lado: number, chao: boolean = true): HTMLCanvasElement | null {
  const nova = novaTela(lado, lado)
  if (nova === null) return null
  const { tela, g } = nova
  if (chao) {
    g.fillStyle = css(CHAO_DA_MINIATURA)
    g.fillRect(0, 0, lado, lado)
  }
  const q = arte.quadro
  // O recorte: o corpo inteiro e um respiro à direita e embaixo, onde a sombra cai.
  const respiro = q.lado * 0.2
  const lote = q.lado + respiro
  const k = lado / lote
  const x0 = q.esquerda - respiro * 0.25
  const y0 = q.topo - respiro * 0.25
  if (arte.sombra !== null) {
    const s = QUADRO_DA_SOMBRA
    g.globalAlpha = ALFA_DA_SOMBRA
    g.drawImage(arte.sombra, (s.esquerda - x0) * k, (s.topo - y0) * k, s.largura * k, s.altura * k)
    g.globalAlpha = 1
  }
  g.imageSmoothingQuality = 'high'
  g.drawImage(arte.corpo, (q.esquerda - x0) * k, (q.topo - y0) * k, q.lado * k, q.lado * k)
  return tela
}
