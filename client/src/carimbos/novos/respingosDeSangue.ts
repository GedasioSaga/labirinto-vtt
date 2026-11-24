import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Sangue espalhado (lote L02 dos objetos de 24/11/2026, Masmorra: carcereiro e tortura; a versão de carimbo do
 * Objeto "Sangue no chão"): o sangue que sobrou no chão, visto de cima e um pouco de frente, como a lama. A
 * SEMENTE escolhe a cena, para o mesmo carimbo espalhado não repetir:
 * - 0 e 4: a POÇA (a película seca em volta, a beira molhada, o miolo vinho, os coágulos e o reflexo na beira do
 *   lado da luz), com respingos em volta; na 4, uma trilha de pingos saindo dela;
 * - 1 e 5: o RASTRO ARRASTADO (a faixa que afina e se parte no fim, com os riscos ao comprido), saindo de uma poça
 *   pequena; na 5, respingos no começo;
 * - 2 e 6: os RESPINGOS de um golpe (as gotas com a cauda apontando para longe do impacto e a névoa de pingos
 *   finos); na 6, uma poça pequena no ponto do impacto;
 * - 3 e 7: a TRILHA de pingos de quem passou sangrando (cada pingo com a coroa de gotinhas); na 7, um rastro curto
 *   no fim.
 * As cores são vinho velho e marrom (nenhum vermelho vivo, nenhum canal acima de 245). Fica rente ao chão: sem
 * sombra, por baixo das sombras dos outros. O giro gira a cena inteira; a luz (o reflexo) não gira.
 */

const SECO: Rgb = [118, 72, 60]
const BEIRA: Rgb = [110, 52, 46]
const MIOLO: Rgb = [84, 34, 32]
const COAGULO: Rgb = [64, 27, 27]
const GOTA: Rgb = [96, 40, 37]
const REFLEXO: Rgb = [212, 194, 188]

/** O chão visto de cima e um pouco de frente (a regra da lama). */
const ACHATA = 0.55
/** O meio da cena no quadro. */
const MEIO_Y = -0.02
/** Nenhuma parte da cena passa deste raio (no chão), em qualquer giro: o quadro tem 0,3 abaixo da base. */
const RAIO_MAXIMO = 0.5

type Ponto = readonly [number, number]
type Mancha = readonly [number, number, number]

function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

/** O ponto do chão (já girado) na tela, preso dentro do raio máximo. */
function naTela(p: Ponto, giro: number): Ponto {
  const d = Math.hypot(p[0], p[1])
  const k = d > RAIO_MAXIMO ? RAIO_MAXIMO / d : 1
  const x = p[0] * k
  const y = p[1] * k
  const c = Math.cos(giro)
  const s = Math.sin(giro)
  return [x * c - y * s, MEIO_Y + (x * s + y * c) * ACHATA]
}

/** Manchas redondas no chão (elipses na tela) num caminho só: o preenchimento é a união delas. */
function manchas(g: CanvasRenderingContext2D, lista: readonly Mancha[], giro: number, cor: Rgb, alfa: number, cresce = 1, dx = 0, dy = 0): void {
  g.fillStyle = css(cor, alfa)
  g.beginPath()
  for (const [x, y, r] of lista) {
    const [tx, ty] = naTela([x, y], giro)
    const rx = r * cresce
    g.moveTo(tx + dx + rx, ty + dy)
    g.ellipse(tx + dx, ty + dy, rx, rx * ACHATA, 0, 0, Math.PI * 2)
  }
  g.fill()
}

/** Uma gota com cauda: o corpo redondo e a cauda afinando no rumo `a` (no chão), e uma gotinha solta adiante. */
function gotaComCauda(g: CanvasRenderingContext2D, x: number, y: number, r: number, a: number, giro: number, cor: Rgb, alfa: number): void {
  const [cx, cy] = naTela([x, y], giro)
  const [px, py] = naTela([x + Math.cos(a) * r * 1.5, y + Math.sin(a) * r * 1.5], giro)
  const [sx, sy] = naTela([x + Math.cos(a) * r * 3.4, y + Math.sin(a) * r * 3.4], giro)
  const naTelaA = Math.atan2(py - cy, px - cx)
  const comp = Math.hypot(px - cx, py - cy)
  g.fillStyle = css(cor, alfa)
  g.beginPath()
  g.moveTo(cx + r, cy)
  g.ellipse(cx, cy, r, r * ACHATA, 0, 0, Math.PI * 2)
  g.moveTo(px + comp, py)
  g.ellipse(px, py, comp, r * 0.42, naTelaA, 0, Math.PI * 2)
  g.moveTo(sx + r * 0.32, sy)
  g.ellipse(sx, sy, r * 0.32, r * 0.32 * ACHATA, 0, 0, Math.PI * 2)
  g.fill()
}

/** O reflexo do céu na beira do lado da luz (em cima à esquerda NA TELA, em qualquer giro). */
function reflexo(g: CanvasRenderingContext2D, x: number, y: number, r: number, giro: number): void {
  const [cx, cy] = naTela([x, y], giro)
  g.fillStyle = css(REFLEXO, 0.32)
  g.beginPath()
  g.ellipse(cx - r * 0.42, cy - r * 0.3 * ACHATA, r * 0.36, r * 0.07, -0.12, 0, Math.PI * 2)
  g.fill()
}

/** A poça: a película seca, a beira molhada, o miolo, os coágulos e o reflexo. */
function poca(g: CanvasRenderingContext2D, x: number, y: number, r: number, giro: number, semente: number): void {
  const lobos: Mancha[] = Array.from({ length: 6 }, (_, i) => {
    const a = (i * Math.PI * 2) / 6 + (sorteio(semente, 200 + i) - 0.5) * 0.8
    const d = r * (0.45 + 0.35 * sorteio(semente, 210 + i))
    return [x + Math.cos(a) * d, y + Math.sin(a) * d, r * (0.36 + 0.24 * sorteio(semente, 220 + i))] as const
  })
  lobos.push([x, y, r * 0.62])
  manchas(g, lobos, giro, SECO, 0.5, 1.2)
  manchas(g, lobos, giro, BEIRA, 0.92)
  manchas(g, lobos.map(([lx, ly, lr]) => [x + (lx - x) * 0.8, y + (ly - y) * 0.8, lr * 0.7] as const), giro, MIOLO, 0.95, 1, 0.003, 0.004)
  const coagulos: Mancha[] = [0, 1, 2].map((i) => {
    const a = sorteio(semente, 230 + i) * Math.PI * 2
    const d = r * 0.32 * sorteio(semente, 233 + i)
    return [x + Math.cos(a) * d, y + Math.sin(a) * d, r * (0.1 + 0.08 * sorteio(semente, 236 + i))] as const
  })
  manchas(g, coagulos, giro, COAGULO, 0.7)
  reflexo(g, x, y, r * 1.1, giro)
}

/** Os respingos de um impacto em (x, y), num leque em volta do rumo `a`. */
function respingos(g: CanvasRenderingContext2D, x: number, y: number, a: number, abre: number, n: number, alcance: number, giro: number, semente: number): void {
  for (let i = 0; i < n; i++) {
    const ang = a + (sorteio(semente, 300 + i) - 0.5) * abre
    const d = alcance * (0.25 + 0.75 * sorteio(semente, 330 + i))
    const r = 0.031 * (1.25 - d / alcance) + 0.01
    gotaComCauda(g, x + Math.cos(ang) * d, y + Math.sin(ang) * d, r, ang, giro, i % 3 === 0 ? BEIRA : GOTA, 0.9)
  }
  // A névoa: pingos finos espalhados no mesmo leque.
  const nevoa: Mancha[] = Array.from({ length: n + 4 }, (_, i) => {
    const ang = a + (sorteio(semente, 360 + i) - 0.5) * abre * 1.2
    const d = alcance * (0.15 + 0.95 * sorteio(semente, 390 + i))
    return [x + Math.cos(ang) * d, y + Math.sin(ang) * d, 0.005 + 0.006 * sorteio(semente, 420 + i)] as const
  })
  manchas(g, nevoa, giro, GOTA, 0.75)
}

/** O rastro arrastado de `de` até `ate`, afinando, com os riscos ao comprido e o fim partido. */
function rastro(g: CanvasRenderingContext2D, de: Ponto, ate: Ponto, largura: number, giro: number, semente: number): void {
  const curva = (sorteio(semente, 500) - 0.5) * 0.24
  const ponto = (t: number): Ponto => {
    const nx = -(ate[1] - de[1])
    const ny = ate[0] - de[0]
    const b = Math.sin(t * Math.PI) * curva
    return [de[0] + (ate[0] - de[0]) * t + nx * b, de[1] + (ate[1] - de[1]) * t + ny * b]
  }
  const corpo: Mancha[] = []
  for (let t = 0; t <= 1.0001; t += 0.035) {
    if (t > 0.78 && sorteio(semente, 510 + Math.round(t * 100)) < 0.45) continue
    const [px, py] = ponto(t)
    corpo.push([px, py, largura * (1 - t * 0.62) * (0.86 + 0.28 * sorteio(semente, 610 + Math.round(t * 100)))])
  }
  manchas(g, corpo, giro, SECO, 0.42, 1.12)
  manchas(g, corpo, giro, BEIRA, 0.7)
  // Os riscos: três faixas mais escuras ao comprido, partidas (a coisa arrastada deixa os sulcos).
  for (const lado of [-0.45, 0.05, 0.5]) {
    const riscos: Mancha[] = []
    for (let t = 0.04; t <= 0.9; t += 0.03) {
      if (sorteio(semente, 700 + Math.round(t * 100 + lado * 10)) < 0.3) continue
      const [px, py] = ponto(t)
      const [qx, qy] = ponto(Math.min(1, t + 0.01))
      const l = Math.hypot(qx - px, qy - py) || 1
      const off = lado * largura * (1 - t * 0.62)
      riscos.push([px - ((qy - py) / l) * off, py + ((qx - px) / l) * off, largura * 0.2 * (1 - t * 0.5)])
    }
    manchas(g, riscos, giro, MIOLO, 0.55)
  }
}

/** A trilha de pingos de `de` até `ate`, cada pingo com a coroa de gotinhas. */
function trilha(g: CanvasRenderingContext2D, de: Ponto, ate: Ponto, n: number, giro: number, semente: number): void {
  for (let i = 0; i < n; i++) {
    const t = i / Math.max(1, n - 1)
    const ondula = Math.sin(t * Math.PI * 2 + sorteio(semente, 800) * 6) * 0.05
    const x = de[0] + (ate[0] - de[0]) * t - (ate[1] - de[1]) * ondula
    const y = de[1] + (ate[1] - de[1]) * t + (ate[0] - de[0]) * ondula
    const r = 0.027 + 0.016 * sorteio(semente, 810 + i)
    const coroa: Mancha[] = Array.from({ length: 4 }, (_, j) => {
      const a = sorteio(semente, 830 + i * 4 + j) * Math.PI * 2
      return [x + Math.cos(a) * r * 1.7, y + Math.sin(a) * r * 1.7, r * 0.22] as const
    })
    manchas(g, [[x, y, r]], giro, SECO, 0.5, 1.25)
    manchas(g, [[x, y, r], ...coroa], giro, GOTA, 0.92)
    manchas(g, [[x + r * 0.15, y + r * 0.15, r * 0.55]], giro, MIOLO, 0.8)
  }
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const s = Math.floor(Math.abs(semente)) % 8
  const tipo = s % 4
  const extra = s >= 4
  const a = sorteio(s, 1) * Math.PI * 2
  const c = Math.cos(a)
  const sn = Math.sin(a)
  if (tipo === 0) {
    poca(g, -0.04, 0.02, 0.2, giro, s)
    respingos(g, -0.04, 0.02, a, Math.PI * 2, 12, 0.42, giro, s)
    if (extra) trilha(g, [c * 0.26, sn * 0.26], [c * 0.47, sn * 0.47], 4, giro, s)
  } else if (tipo === 1) {
    poca(g, -c * 0.3, -sn * 0.3, 0.12, giro, s)
    rastro(g, [-c * 0.26, -sn * 0.26], [c * 0.44, sn * 0.44], 0.11, giro, s)
    if (extra) respingos(g, -c * 0.3, -sn * 0.3, a + Math.PI, 1.6, 8, 0.2, giro, s)
  } else if (tipo === 2) {
    // O baque: sem a mancha de onde o leque sai, os pingos soltos sumiam na pedra escura.
    poca(g, -c * 0.22, -sn * 0.22, extra ? 0.09 : 0.055, giro, s)
    respingos(g, -c * 0.22, -sn * 0.22, a, 1.25, 18, 0.62, giro, s)
  } else {
    trilha(g, [-c * 0.44, -sn * 0.44], [c * (extra ? 0.16 : 0.44), sn * (extra ? 0.16 : 0.44)], extra ? 6 : 9, giro, s)
    if (extra) rastro(g, [c * 0.2, sn * 0.2], [c * 0.46, sn * 0.46], 0.06, giro, s)
  }
}

export const carimbo: DefinicaoDeCarimbo = { id: 'respingos-de-sangue', nome: 'Sangue espalhado', tamanho: 10, sombra: 'nenhuma', desenhar }

export const paleta: readonly Rgb[] = [SECO, BEIRA, MIOLO, COAGULO, GOTA, REFLEXO]
