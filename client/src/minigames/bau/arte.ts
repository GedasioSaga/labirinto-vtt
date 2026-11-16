/**
 * ARTE DO BAÚ: baú de carvalho com cintas de ferro e tampa abaulada, os
 * fechos de latão na frente (lingueta deitada = fechado, em pé = aberto) com
 * a barrinha de 3 zonas embaixo de cada um, a fresta de luz da tampa subindo
 * e a animação de abrir. Pixel art só com retângulo, na tela lógica de
 * 240x135, sem texto. O estado entra por parâmetro; nada é lido de global.
 *
 * Partes paradas (corpo e tampa fechada) ficam numa tela fora da página; sem
 * tela (teste em Node) são pintadas direto, com o mesmo desenho.
 */
import { COR, H, bloco, contorno, luz, misturar, pix } from '../abrir/desenho'
import { CENTRO_X, CHAO_Y, desenharFundo, desenharLuz, desenharVela, novaTela } from '../abrir/cenario'
import { abertura, tempoDaVela } from './sim'
import type { OpcoesDeDesenho } from '../abrir/tipos'
import type { Estado, ParametrosDaDificuldade } from './sim'

/** Corpo do baú: x de BAU_X a BAU_X + BAU_W, do topo CORPO_Y ao chão. */
export const BAU_X = 66
export const BAU_W = 108
export const CORPO_Y = 64
/** Tampa fechada: um pouco mais larga que o corpo, de TAMPA_Y a CORPO_Y. */
export const TAMPA_X = 64
export const TAMPA_W = 112
export const TAMPA_H = 28
const TAMPA_Y = CORPO_Y - TAMPA_H
/** Borda de trás da boca (a dobradiça): a tampa aberta fica em pé daqui para cima. */
const BORDA_Y = CORPO_Y - 10
/** Altura da face de dentro da tampa, aberta. */
const DENTRO_H = 24
/** Espessura da tampa vista de lado, em px: o mínimo que ela mostra no meio do giro. */
const ESPESSURA_DA_TAMPA = 3
/** Brilhos de moeda no fundo da boca aberta: [x a partir do centro, y a partir da borda de trás]. */
const MOEDAS: readonly (readonly [number, number])[] = [[-14, 7], [-9, 8], [6, 7], [11, 8], [17, 8], [-2, 8]]
/** Raios de luz saindo da boca: [x a partir do centro, largura]. */
const RAIOS: readonly (readonly [number, number])[] = [[-24, 8], [-6, 12], [16, 8]]

/** Ponto por onde a armadilha sai do baú aberto: o meio da boca escura. */
export const BOCA: readonly [number, number] = [CENTRO_X, CORPO_Y - 5]

/** Fecho: placa de latão no corpo, logo abaixo da tampa, e o pivô da lingueta. */
const PLACA_Y = CORPO_Y
const PIVO_Y = CORPO_Y + 3
/** Comprimento da lingueta, em px. */
const LINGUETA = 9
/** Passos de ângulo da lingueta (de deitada a em pé): ângulo contínuo tremia pixel a pixel. */
const PASSOS_DO_ANGULO = 8
/** Barrinha de nível: 5 px de largura, de BARRA_Y a BARRA_Y + BARRA_H. */
const BARRA_Y = 77
const BARRA_H = 20
/** Recuo de cada linha de cima da tampa, em px de cada lado: o arco da tampa abaulada. */
const DOMO: readonly number[] = [14, 9, 6, 4, 2, 1]
/** Quanto a tampa sobe com a tampa cheia, em px (a fresta de luz). */
const LEVANTA = 4

/** Alvo de toque: coluna de cada fecho, da tampa até o fim da tela; as pontas ganham folga. */
const ALVO_TOPO = TAMPA_Y - 6
const ALVO_FOLGA = 10

/** Tremor do fecho em aviso: ±1 px a 11 Hz (só fora do movimento reduzido). */
const TREMOR_HZ = 11
/** Tranco do solavanco: o baú afunda 1 px por este tanto de s (só fora do reduzido). */
const TRANCO_S = 0.12

/** Centro x do fecho `i` de `n`: os fechos dividem a frente do corpo em colunas iguais. */
export const centroDoFecho = (i: number, n: number): number => Math.round(BAU_X + ((i + 0.5) * BAU_W) / n)

/** Fecho no ponto (x, y) da tela lógica; -1 = nada (ou a tentativa acabou). */
export function alvoEm(x: number, y: number, e: Readonly<Estado>): number {
  if (e.fim !== null || y < ALVO_TOPO || y >= H) return -1
  const n = e.fechos.length
  if (x < BAU_X - ALVO_FOLGA || x >= BAU_X + BAU_W + ALVO_FOLGA) return -1
  const i = Math.floor(((x - BAU_X) * n) / BAU_W)
  return Math.max(0, Math.min(n - 1, i))
}

// ------------------------------------------------------------------ partes paradas

const sprites = new Map<string, CanvasImageSource | null>()

/**
 * Pinta `pintar` (que desenha em coordenadas da tela) pela tela fora da página
 * na primeira vez, e depois só copia. `dy` desloca na vertical. Sem tela fora
 * da página, pinta direto com o mesmo deslocamento.
 */
function comCache(
  g: CanvasRenderingContext2D, nome: string, x: number, y: number, w: number, h: number, dy: number,
  pintar: (g: CanvasRenderingContext2D) => void,
): void {
  let s = sprites.get(nome)
  if (s === undefined) {
    const t = novaTela(w, h)
    s = null
    if (t !== null) {
      t.g.translate(-x, -y)
      pintar(t.g)
      s = t.tela
    }
    sprites.set(nome, s)
  }
  if (s !== null) {
    g.drawImage(s, x, y + dy)
    return
  }
  if (dy !== 0) g.translate(0, dy)
  pintar(g)
  if (dy !== 0) g.translate(0, -dy)
}

/** Corpo do baú: tábuas de carvalho, cintas de ferro com rebites e a sombra no chão. */
function pintarCorpo(g: CanvasRenderingContext2D): void {
  const x = BAU_X
  const y = CORPO_Y
  const w = BAU_W
  const h = CHAO_Y - CORPO_Y
  pix(g, COR.sombra, x - 4, CHAO_Y - 1, w + 8, 3)
  pix(g, contorno(COR.carvalho), x, y, w, h)
  pix(g, COR.carvalho, x + 1, y + 1, w - 2, h - 2)
  // Tábuas: junta escura com realce embaixo.
  for (let py = y + 10; py < CHAO_Y - 6; py += 10) {
    pix(g, luz(COR.carvalho, 0.78), x + 1, py, w - 2, 1)
    pix(g, luz(COR.carvalho, 1.1), x + 1, py + 1, w - 2, 1)
  }
  // Veio da madeira: sempre o mesmo (regra do Meio-Termo: textura por código, determinística).
  let s = 0x5eed
  for (let k = 0; k < 36; k++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    const vx = x + 7 + (s % (w - 16))
    const vy = y + 2 + ((s >> 8) % (h - 7))
    pix(g, luz(COR.carvalho, 0.88), vx, vy, 3, 1)
  }
  // Cintas de ferro nas quinas e a cinta do pé.
  bloco(g, COR.ferro, x, y, 6, h)
  bloco(g, COR.ferro, x + w - 6, y, 6, h)
  bloco(g, COR.ferro, x, CHAO_Y - 4, w, 4)
  for (let ry = y + 4; ry < CHAO_Y - 5; ry += 8) {
    pix(g, luz(COR.ferro, 1.4), x + 2, ry, 2, 1)
    pix(g, luz(COR.ferro, 1.4), x + w - 4, ry, 2, 1)
  }
}

/** Face da frente da tampa, com a altura dada (a animação de abrir achata a tampa). */
function pintarTampaFrente(g: CanvasRenderingContext2D, yTopo: number, h: number): void {
  if (h <= 0) return
  const x = TAMPA_X
  const w = TAMPA_W
  const borda = contorno(COR.carvalho)
  if (h < 6) {
    pix(g, borda, x, yTopo, w, h)
    if (h > 2) pix(g, luz(COR.carvalho, 1.15), x + 1, yTopo + 1, w - 2, h - 2)
    return
  }
  // Tampa abaulada: as linhas de cima entram para dentro. Com 3 ou 4 linhas o arco sumia atrás das
  // cintas; com 6 ele aparece. Mais claro em cima, onde a luz do lampião bate.
  const domo = h >= 12 ? DOMO : [2]
  domo.forEach((dentro, j) => pix(g, borda, x + dentro, yTopo + j, w - 2 * dentro, 1))
  domo.forEach((dentro, j) => {
    if (j > 0) pix(g, luz(COR.carvalho, 1.24 - 0.02 * j), x + dentro + 1, yTopo + j, w - 2 * dentro - 2, 1)
  })
  const corpoY = yTopo + domo.length
  const corpoH = h - domo.length
  pix(g, borda, x, corpoY, w, corpoH)
  pix(g, COR.carvalho, x + 1, corpoY, w - 2, corpoH - 1)
  pix(g, luz(COR.carvalho, 1.12), x + 1, corpoY, w - 2, 1)
  for (const f of [0.4, 0.72]) pix(g, luz(COR.carvalho, 0.8), x + 1, yTopo + Math.round(h * f), w - 2, 1)
  // Cintas de ferro da tampa, alinhadas com as do corpo; começam na linha do domo em que cabem.
  const cintaY = yTopo + Math.max(0, domo.findIndex((dentro) => dentro <= 2))
  for (const sx of [x + 2, x + w - 8]) {
    bloco(g, COR.ferro, sx, cintaY, 6, yTopo + h - cintaY)
    pix(g, luz(COR.ferro, 1.4), sx + 2, cintaY + 2, 2, 1)
  }
  // Friso de latão na borda de baixo, onde os fechos encostam.
  pix(g, contorno(COR.latao), x, yTopo + h - 3, w, 3)
  pix(g, COR.latao, x + 1, yTopo + h - 2, w - 2, 1)
}

/** Face de dentro da tampa aberta, em pé atrás da boca. */
function pintarTampaDentro(g: CanvasRenderingContext2D, h: number): void {
  if (h <= 0) return
  const cor = luz(COR.nogueira, 0.8)
  const yTopo = BORDA_Y - h
  pix(g, contorno(cor), TAMPA_X + 2, yTopo, TAMPA_W - 4, h)
  if (h <= 2) return
  pix(g, cor, TAMPA_X + 3, yTopo + 1, TAMPA_W - 6, h - 2)
  for (let py = yTopo + 6; py < BORDA_Y - 2; py += 6) pix(g, luz(cor, 0.82), TAMPA_X + 3, py, TAMPA_W - 6, 1)
  pix(g, luz(COR.ferro, 0.9), TAMPA_X + 4, yTopo + 1, 5, h - 2)
  pix(g, luz(COR.ferro, 0.9), TAMPA_X + TAMPA_W - 9, yTopo + 1, 5, h - 2)
}

/** Boca aberta: borda de trás, fundo escuro com um brilho de moeda e a borda da frente. */
function pintarBoca(g: CanvasRenderingContext2D): void {
  pix(g, contorno(COR.carvalho), BAU_X, BORDA_Y, BAU_W, CORPO_Y - BORDA_Y)
  pix(g, luz(COR.carvalho, 0.7), BAU_X + 1, BORDA_Y + 1, BAU_W - 2, 2)
  pix(g, COR.sombra, BAU_X + 3, BORDA_Y + 3, BAU_W - 6, CORPO_Y - BORDA_Y - 4)
  for (const [mx, my] of MOEDAS) {
    pix(g, luz(COR.ouro, 0.75), CENTRO_X + mx, BORDA_Y + my, 2, 1)
  }
  pix(g, luz(COR.carvalho, 1.15), BAU_X + 1, CORPO_Y - 1, BAU_W - 2, 1)
}

// ------------------------------------------------------------------ fechos

/** Tremor do fecho em aviso, em px; 0 no movimento reduzido. */
function tremor(t: number, reduzido: boolean): number {
  if (reduzido) return 0
  return Math.sin(t * 2 * Math.PI * TREMOR_HZ) >= 0 ? 1 : -1
}

/** Tranco do solavanco, em px; 0 no movimento reduzido. */
function tranco(e: Readonly<Estado>, reduzido: boolean): number {
  if (reduzido || e.tSolavanco < 0) return 0
  return e.t - e.tSolavanco < TRANCO_S ? 1 : 0
}

/** Lingueta girando no pivô: deitada para a direita (a = 0) até em pé (a = 1). */
function pintarLingueta(g: CanvasRenderingContext2D, px: number, py: number, a: number, cor: string, borda: string): void {
  const k = Math.round(Math.max(0, Math.min(1, a)) * PASSOS_DO_ANGULO) / PASSOS_DO_ANGULO
  const c = Math.cos((k * Math.PI) / 2)
  const s = Math.sin((k * Math.PI) / 2)
  for (let d = 0; d <= LINGUETA; d++) pix(g, borda, px + c * d - 1, py - s * d - 1, 4, 4)
  for (let d = 0; d <= LINGUETA; d++) pix(g, cor, px + c * d, py - s * d, 2, 2)
  pix(g, luz(cor, 1.3), px + c * LINGUETA, py - s * LINGUETA, 1, 1)
}

/** Parafuso do pivô; torto quando o fecho emperrou. */
function pintarParafuso(g: CanvasRenderingContext2D, px: number, py: number, torto: boolean): void {
  pix(g, contorno(COR.ferro), px - 1, py - 1, 4, 4)
  pix(g, luz(COR.ferro, 1.25), px, py, 2, 2)
  if (torto) {
    pix(g, COR.sombra, px, py + 1, 1, 1)
    pix(g, COR.sombra, px + 1, py, 1, 1)
  } else pix(g, COR.sombra, px, py, 2, 1)
}

/** Cores de uma zona da barrinha: apagada (fundo) e acesa (até o nível). */
interface Zona {
  de: number
  ate: number
  apagada: string
  acesa: string
}

function zonas(d: ParametrosDaDificuldade): Zona[] {
  return [
    // Abaixo do limiar: o fecho conta como fechado. Escura, puxada para a brasa quando acesa.
    { de: 0, ate: d.limiar, apagada: luz(COR.nogueira, 0.45), acesa: misturar(COR.nogueira, COR.brasa, 0.55) },
    // Hora de tocar.
    { de: d.limiar, ate: d.cedo, apagada: luz(COR.ambar, 0.38), acesa: COR.ambar },
    // Cedo demais: clara.
    { de: d.cedo, ate: 1, apagada: luz(COR.papel, 0.32), acesa: COR.papel },
  ]
}

/** Barrinha de 3 zonas com o nível atual do fecho. */
function pintarBarrinha(
  g: CanvasRenderingContext2D, cx: number, a: number, d: ParametrosDaDificuldade, borda: string, dy: number,
): void {
  const x = cx - 2
  const base = BARRA_Y + BARRA_H + dy
  const yDe = (v: number): number => base - Math.round(v * BARRA_H)
  pix(g, borda, x - 1, BARRA_Y - 1 + dy, 7, BARRA_H + 2)
  for (const z of zonas(d)) {
    const y0 = yDe(z.ate)
    const y1 = yDe(z.de)
    pix(g, z.apagada, x, y0, 5, y1 - y0)
    if (a > z.de) {
      const yA = yDe(Math.min(a, z.ate))
      pix(g, z.acesa, x, yA, 5, y1 - yA)
    }
  }
  if (a > 0) pix(g, COR.branco, x - 1, Math.max(BARRA_Y + dy, yDe(a)), 7, 1)
}

/**
 * Um fecho inteiro: placa, grampo, lingueta, parafuso e barrinha. Em aviso
 * ganha contorno brasa e brilho (e treme, fora do movimento reduzido);
 * emperrado fica cor de ferro com o parafuso torto.
 */
export function desenharFecho(g: CanvasRenderingContext2D, e: Readonly<Estado>, i: number, op: OpcoesDeDesenho): void {
  const f = e.fechos[i]
  const emAviso = e.avisoEm === i
  const preso = f.preso > 0
  const dy = tranco(e, op.reduzido)
  const cx = centroDoFecho(i, e.fechos.length) + (emAviso ? tremor(e.t, op.reduzido) : 0)
  const cor = preso ? COR.ferro : COR.latao
  const borda = emAviso ? COR.brasa : contorno(cor)
  if (emAviso) {
    // Brilho que cresce ao longo do aviso (urgência sem piscar); fixo no movimento reduzido.
    const feito = 1 - e.avisoResta / e.d.aviso
    const alfa = op.reduzido ? 0.34 : 0.2 + 0.25 * feito
    const brilho = g.createRadialGradient(cx, PIVO_Y + dy, 1, cx, PIVO_Y + dy, 14)
    brilho.addColorStop(0, `rgba(226,100,90,${alfa.toFixed(3)})`)
    brilho.addColorStop(1, 'rgba(226,100,90,0)')
    g.fillStyle = brilho
    g.fillRect(cx - 14, PIVO_Y + dy - 14, 28, 28)
  }
  pix(g, borda, cx - 6, PLACA_Y + dy, 13, 9)
  pix(g, cor, cx - 5, PLACA_Y + 1 + dy, 11, 7)
  pix(g, luz(cor, 1.2), cx - 5, PLACA_Y + 1 + dy, 11, 1)
  bloco(g, COR.ferro, cx + 5, PIVO_Y - 2 + dy, 3, 5)
  pintarLingueta(g, cx - 3, PIVO_Y + dy, f.a, cor, borda)
  pintarParafuso(g, cx - 3, PIVO_Y + dy, preso)
  const bordaDaBarra = emAviso ? COR.brasa : preso ? COR.ferro : contorno(COR.nogueira)
  pintarBarrinha(g, centroDoFecho(i, e.fechos.length), f.a, e.d, bordaDaBarra, dy)
}

// ------------------------------------------------------------------ tampa e luz

/** Luz dourada saindo do baú (fresta ou boca), por cima do que já foi pintado. */
function luzDourada(g: CanvasRenderingContext2D, x: number, y: number, raio: number, alfa: number): void {
  if (alfa <= 0) return
  const l = g.createRadialGradient(x, y, 2, x, y, raio)
  l.addColorStop(0, `rgba(242,193,78,${alfa.toFixed(3)})`)
  l.addColorStop(1, 'rgba(242,193,78,0)')
  g.fillStyle = l
  g.fillRect(x - raio, y - raio, raio * 2, raio * 2)
}

/** Tampa fechada, subindo alguns px com a tampa do jogo, e a fresta de luz por baixo. */
function desenharFechado(g: CanvasRenderingContext2D, e: Readonly<Estado>, dy: number): void {
  const sobe = Math.round(e.tampa * LEVANTA)
  if (sobe > 0) {
    pix(g, misturar(luz(COR.chama, 0.6), COR.ouro, e.tampa), TAMPA_X + 3, CORPO_Y - sobe + dy, TAMPA_W - 6, sobe)
    luzDourada(g, CENTRO_X, CORPO_Y + dy, 46, 0.22 * e.tampa)
  }
  comCache(g, 'tampa', TAMPA_X, TAMPA_Y, TAMPA_W, TAMPA_H, dy - sobe, (t) => pintarTampaFrente(t, TAMPA_Y, TAMPA_H))
}

/**
 * Tampa girando para trás em `ABRIR_S`: primeiro a frente achata até a
 * dobradiça, depois a face de dentro sobe em pé. Ease-out forte (é uma
 * entrada: começa rápido e assenta). No movimento reduzido não gira: aparece
 * aberta, e só a luz acende aos poucos.
 */
function desenharAberto(g: CanvasRenderingContext2D, k: number, reduzido: boolean): void {
  const giro = reduzido ? 1 : 1 - Math.pow(1 - k, 3)
  // A luz acende com ease-out também (é entrada); no reduzido é o que resta do movimento.
  const acende = 1 - Math.pow(1 - k, 2)
  pintarBoca(g)
  luzDourada(g, BOCA[0], BOCA[1], 60, 0.42 * acende)
  for (const [fx, fw] of RAIOS) {
    pix(g, `rgba(242,193,78,${(0.09 * acende).toFixed(3)})`, CENTRO_X + fx, 14, fw, BORDA_Y - 12)
  }
  // Espessura mínima no meio do giro: a tampa de lado ainda é uma tábua, não some por um quadro.
  if (giro < 0.5) {
    const u = giro / 0.5
    const h = Math.max(ESPESSURA_DA_TAMPA, Math.round(TAMPA_H * (1 - u)))
    const fundo = Math.round(CORPO_Y + (BORDA_Y - CORPO_Y) * u)
    pintarTampaFrente(g, fundo - h, h)
  } else {
    pintarTampaDentro(g, Math.max(ESPESSURA_DA_TAMPA, Math.round(DENTRO_H * ((giro - 0.5) / 0.5))))
  }
}

/** Cena inteira do baú na tela lógica de 240x135. */
export function desenhar(g: CanvasRenderingContext2D, e: Readonly<Estado>, op: OpcoesDeDesenho): void {
  desenharFundo(g)
  desenharLuz(g, e.t, op.reduzido)
  const dy = tranco(e, op.reduzido)
  comCache(g, 'corpo', BAU_X - 4, CORPO_Y, BAU_W + 8, CHAO_Y - CORPO_Y + 2, dy, pintarCorpo)
  const k = abertura(e)
  if (k > 0) desenharAberto(g, k, op.reduzido)
  else desenharFechado(g, e, dy)
  for (let i = 0; i < e.fechos.length; i++) desenharFecho(g, e, i, op)
  desenharVela(g, tempoDaVela(e), op.reduzido)
}
