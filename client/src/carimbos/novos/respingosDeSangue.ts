import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Sangue espalhado (lote L02 dos objetos de 24/11/2026, Masmorra: carcereiro e tortura; a versão de carimbo do
 * Objeto "Sangue no chão"): o sangue que sobrou no chão, visto de cima e um pouco de frente, como a lama. A
 * SEMENTE escolhe a cena, para o mesmo carimbo espalhado não repetir:
 * - 0 e 4: a POÇA (uma película seca e fina em volta e uma poça molhada só, de beira ondulada, mais escura no meio,
 *   com um risco curto de reflexo na beira do lado da luz), com respingos em volta; na 4, uma trilha de pingos
 *   saindo dela;
 * - 1 e 5: o RASTRO ARRASTADO (a faixa contínua que sai larga da poça pequena e afina até o fim arredondado, com os
 *   riscos ao comprido, também contínuos, finos no começo); na 5, uns pingos soltos em volta da poça (nunca em leque);
 * - 2 e 6: os RESPINGOS de um golpe (as gotas com a cauda apontando para longe do impacto e a névoa de pingos
 *   finos); na 6, uma poça pequena no ponto do impacto;
 * - 3 e 7: a TRILHA de pingos de quem passou sangrando (pingos de tamanhos e espaços desiguais, metade com a cauda
 *   no rumo da caminhada); na 7, um rastro curto no fim.
 * Em volta das peças grandes, o halo seco marrom, um pouco mais claro que a pedra escura, para a mancha não sumir
 * nela. As cores são vinho velho e marrom (nenhum vermelho vivo, nenhum canal acima de 245). Fica rente ao chão:
 * sem sombra, por baixo das sombras dos outros. O giro gira a cena inteira; a luz (o reflexo) não gira.
 */

const SECO: Rgb = [118, 72, 60]
const HALO: Rgb = [110, 64, 52]
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
/** O halo seco em volta das peças grandes: o quanto passa da peça e a força. */
const CRESCE_O_HALO = 1.32
const ALFA_DO_HALO = 0.35
/** O reflexo da poça: o arco (rad, na tela) em volta do rumo da luz, em cima à esquerda. */
const RUMO_DA_LUZ = -2.25
const ARCO_DO_REFLEXO = 0.6

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
function manchas(g: CanvasRenderingContext2D, lista: readonly Mancha[], giro: number, cor: Rgb, alfa: number, cresce = 1): void {
  g.fillStyle = css(cor, alfa)
  g.beginPath()
  for (const [x, y, r] of lista) {
    const [tx, ty] = naTela([x, y], giro)
    const rx = r * cresce
    g.moveTo(tx + rx, ty)
    g.ellipse(tx, ty, rx, rx * ACHATA, 0, 0, Math.PI * 2)
  }
  g.fill()
}

/** Um contorno no chão já na tela: os pontos ligados e fechados. */
function caminho(g: CanvasRenderingContext2D, pontos: readonly Ponto[], giro: number): void {
  g.beginPath()
  pontos.forEach((p, i) => {
    const [tx, ty] = naTela(p, giro)
    if (i === 0) g.moveTo(tx, ty)
    else g.lineTo(tx, ty)
  })
  g.closePath()
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

/** A beira ondulada de uma poça: o raio, em cada rumo do chão, vezes três ondas sobrepostas. */
function beiraOndulada(semente: number): (a: number) => number {
  const f1 = sorteio(semente, 240) * Math.PI * 2
  const f2 = sorteio(semente, 241) * Math.PI * 2
  const f3 = sorteio(semente, 242) * Math.PI * 2
  return (a) => 1 + 0.13 * Math.sin(3 * a + f1) + 0.07 * Math.sin(5 * a + f2) + 0.035 * Math.sin(9 * a + f3)
}

/** O contorno da poça de meio (x, y), raio `r` e beira `onda`, crescido `cresce`. */
function contornoDaPoca(x: number, y: number, r: number, onda: (a: number) => number, cresce: number): Ponto[] {
  const passos = 56
  return Array.from({ length: passos }, (_, i): Ponto => {
    const a = (i / passos) * Math.PI * 2
    const rr = r * onda(a) * cresce
    return [x + Math.cos(a) * rr, y + Math.sin(a) * rr]
  })
}

/**
 * A poça: o halo seco marrom, a película seca e fina, e UMA poça molhada de beira ondulada, do vinho da beira ao
 * miolo escuro (degradê, nunca lobos em três tons, que liam como flor); dois coágulos e o risco do reflexo.
 */
function poca(g: CanvasRenderingContext2D, x: number, y: number, r: number, giro: number, semente: number): void {
  const onda = beiraOndulada(semente)
  caminho(g, contornoDaPoca(x, y, r, onda, CRESCE_O_HALO), giro)
  g.fillStyle = css(HALO, ALFA_DO_HALO)
  g.fill()
  caminho(g, contornoDaPoca(x, y, r, onda, 1.12), giro)
  g.fillStyle = css(SECO, 0.4)
  g.fill()
  caminho(g, contornoDaPoca(x, y, r, onda, 1), giro)
  const [cx, cy] = naTela([x, y], giro)
  g.save()
  g.translate(cx, cy)
  g.scale(1, ACHATA)
  const degrade = g.createRadialGradient(0, 0, 0, 0, 0, r * 1.15)
  degrade.addColorStop(0, css(MIOLO, 0.96))
  degrade.addColorStop(0.62, css(MIOLO, 0.94))
  degrade.addColorStop(1, css(BEIRA, 0.92))
  g.fillStyle = degrade
  g.fill()
  g.restore()
  const coagulos: Mancha[] = [0, 1].map((i) => {
    const a = sorteio(semente, 230 + i) * Math.PI * 2
    const d = r * 0.3 * sorteio(semente, 233 + i)
    return [x + Math.cos(a) * d, y + Math.sin(a) * d, r * (0.08 + 0.06 * sorteio(semente, 236 + i))] as const
  })
  manchas(g, coagulos, giro, COAGULO, 0.45)
  // O reflexo: um risco curto (menos de 30% da poça) seguindo a beira do lado da luz, que não gira com a cena.
  const arco: Ponto[] = Array.from({ length: 9 }, (_, i): Ponto => {
    const a = RUMO_DA_LUZ - ARCO_DO_REFLEXO / 2 + (ARCO_DO_REFLEXO * i) / 8 - giro
    const rr = r * onda(a) * 0.84
    return [x + Math.cos(a) * rr, y + Math.sin(a) * rr]
  })
  g.strokeStyle = css(REFLEXO, 0.36)
  g.lineWidth = r * 0.06
  g.lineCap = 'round'
  g.beginPath()
  arco.forEach((p, i) => {
    const [tx, ty] = naTela(p, giro)
    if (i === 0) g.moveTo(tx, ty)
    else g.lineTo(tx, ty)
  })
  g.stroke()
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

/** Uma faixa contínua ao longo de `ponto(t)`, de `t0` a `t1`, deslocada `lado(t)` e de meia largura `meia(t)`. */
function faixa(ponto: (t: number) => Ponto, t0: number, t1: number, lado: (t: number) => number, meia: (t: number) => number): Ponto[] {
  const passos = 44
  const esquerda: Ponto[] = []
  const direita: Ponto[] = []
  for (let i = 0; i <= passos; i++) {
    const t = t0 + ((t1 - t0) * i) / passos
    const [px, py] = ponto(t)
    const [qx, qy] = ponto(Math.min(1, t + 0.01))
    const [ox, oy] = ponto(Math.max(0, t - 0.01))
    const l = Math.hypot(qx - ox, qy - oy) || 1
    const nx = -(qy - oy) / l
    const ny = (qx - ox) / l
    const m = meia(t)
    const d = lado(t)
    esquerda.push([px + nx * (d + m), py + ny * (d + m)])
    direita.push([px + nx * (d - m), py + ny * (d - m)])
  }
  return [...esquerda, ...direita.reverse()]
}

/**
 * O rastro arrastado de `de` até `ate`: uma faixa só, contínua, que sai larga da poça e afina até o fim arredondado
 * (sem dedos no fim), com os riscos ao comprido, também contínuos, finos no começo e de largura variável.
 */
function rastro(g: CanvasRenderingContext2D, de: Ponto, ate: Ponto, largura: number, giro: number, semente: number): void {
  const curva = (sorteio(semente, 500) - 0.5) * 0.24
  const ponto = (t: number): Ponto => {
    const nx = -(ate[1] - de[1])
    const ny = ate[0] - de[0]
    const b = Math.sin(t * Math.PI) * curva
    return [de[0] + (ate[0] - de[0]) * t + nx * b, de[1] + (ate[1] - de[1]) * t + ny * b]
  }
  const fase = sorteio(semente, 520) * Math.PI * 2
  // O corpo sai largo da poça (onde havia mais sangue) e afina até o fim arredondado; só os riscos nascem finos.
  const corpo = (t: number): number => largura * (1 - 0.58 * t) * (1 + 0.07 * Math.sin(t * 21 + fase)) * Math.sqrt(Math.max(0, 1 - Math.max(0, (t - 0.93) / 0.07) ** 2))
  const meio = (): number => 0
  caminho(g, faixa(ponto, 0, 1, meio, (t) => corpo(t) * CRESCE_O_HALO), giro)
  g.fillStyle = css(HALO, ALFA_DO_HALO)
  g.fill()
  caminho(g, faixa(ponto, 0, 1, meio, (t) => corpo(t) * 1.12), giro)
  g.fillStyle = css(SECO, 0.42)
  g.fill()
  caminho(g, faixa(ponto, 0, 1, meio, corpo), giro)
  g.fillStyle = css(BEIRA, 0.72)
  g.fill()
  // Os riscos: três sulcos ao comprido, contínuos, finos no começo e afinando antes do fim, cada um de um jeito.
  ;[-0.46, 0.04, 0.5].forEach((desvio, j) => {
    const fim = 0.8 + 0.1 * sorteio(semente, 700 + j)
    const f = sorteio(semente, 710 + j) * Math.PI * 2
    const risco = (t: number): number => {
      const sobe = Math.sin(Math.min(1, t / 0.45) * (Math.PI / 2))
      const desce = Math.min(1, Math.max(0, (fim - t) / 0.12))
      return largura * 0.13 * (0.2 + 0.8 * sobe) * desce * (0.75 + 0.5 * (0.5 + 0.5 * Math.sin(t * 17 + f)))
    }
    caminho(g, faixa(ponto, 0.03, fim, (t) => desvio * corpo(t), risco), giro)
    g.fillStyle = css(MIOLO, 0.55)
    g.fill()
  })
}

/**
 * A trilha de pingos de `de` até `ate`: os espaços desiguais (de 0,6 a 1,8 do passo médio), os pingos de tamanhos
 * desiguais (de 0,4 a 1,5), metade deles com a cauda no rumo da caminhada e os grandes com o halo seco.
 */
function trilha(g: CanvasRenderingContext2D, de: Ponto, ate: Ponto, n: number, giro: number, semente: number): void {
  const espacos = Array.from({ length: Math.max(1, n - 1) }, (_, i) => 0.6 + 1.2 * sorteio(semente, 850 + i))
  const total = espacos.reduce((soma, e) => soma + e, 0)
  const rumo = Math.atan2(ate[1] - de[1], ate[0] - de[0])
  let andado = 0
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? andado / total : 0
    if (i < n - 1) andado += espacos[i]
    const ondula = Math.sin(t * Math.PI * 2 + sorteio(semente, 800) * 6) * 0.05
    const x = de[0] + (ate[0] - de[0]) * t - (ate[1] - de[1]) * ondula
    const y = de[1] + (ate[1] - de[1]) * t + (ate[0] - de[0]) * ondula
    const fator = 0.4 + 1.1 * sorteio(semente, 810 + i)
    const r = 0.026 * fator
    if (fator > 1.05) manchas(g, [[x, y, r]], giro, HALO, ALFA_DO_HALO, 1.7)
    manchas(g, [[x, y, r]], giro, SECO, 0.45, 1.25)
    if (i % 2 === 1) {
      gotaComCauda(g, x, y, r, rumo + (sorteio(semente, 870 + i) - 0.5) * 0.4, giro, GOTA, 0.92)
    } else {
      const coroa: Mancha[] = fator < 0.9 ? [] : Array.from({ length: 3 }, (_, j) => {
        const a = sorteio(semente, 830 + i * 4 + j) * Math.PI * 2
        return [x + Math.cos(a) * r * 1.7, y + Math.sin(a) * r * 1.7, r * 0.22] as const
      })
      manchas(g, [[x, y, r], ...coroa], giro, GOTA, 0.92)
    }
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
    if (extra) trilha(g, [c * 0.27, sn * 0.27], [c * 0.47, sn * 0.47], 4, giro, s)
  } else if (tipo === 1) {
    poca(g, -c * 0.3, -sn * 0.3, 0.12, giro, s)
    rastro(g, [-c * 0.24, -sn * 0.24], [c * 0.44, sn * 0.44], 0.11, giro, s)
    // Na 5, uns pingos soltos em volta da poça, em roda: o leque de respingos ali lia como a mão no fim do braço.
    if (extra) respingos(g, -c * 0.3, -sn * 0.3, a + Math.PI, Math.PI * 2, 4, 0.15, giro, s)
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

export const paleta: readonly Rgb[] = [SECO, HALO, BEIRA, MIOLO, COAGULO, GOTA, REFLEXO]
