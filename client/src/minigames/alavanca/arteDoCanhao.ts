/**
 * A ARTE DO CANHÃO DO CHÃO: a cena do canhão do protótipo aprovado em
 * 20/11/2026 (`docs/design/minigames/alavanca-da-ponte.html`, `?cena=canhao`),
 * traço por traço. O mesmo jogo da ponte; aqui, girar a alavanca abre o
 * alçapão do baluarte e sobe a plataforma com o canhão de bronze. Na vitória
 * os ferrolhos entram e o cano baixa até a ameia, um dente por clique do som.
 *
 * O terraço do baluarte em projeção oblíqua: X anda para a direita, Z entra na
 * tela (sobe e desliza um pouco para a direita) e H sobe. Quem olha está à
 * direita e acima: aparecem as faces viradas para +X, para cima e para quem
 * olha (-Z). O canhão aponta para dentro (+Z), para a ameia do parapeito, de
 * viés (GUINADA) para a boca, no fim, sair quase deitada pela ameia da
 * direita. A cena inteira é vista com ZOOM em torno do poço.
 */
import {
  blocos,
  chama,
  comecarQuadro,
  contorno,
  COR,
  desenharCorrente,
  desenharPoeira,
  desenharSarilho,
  grao,
  mistura,
  nuvem,
  quadroFixo,
  tomDe,
  torre,
  type EstadoVisual,
} from './arte'
import { criarRng } from './sim'
import { FOLHAS } from './som'

type G = CanvasRenderingContext2D
type Pt = [number, number]

export const BAL = { y0: 340, kx: 0.35, kz: 0.55, xc: 300, meia: 58, z0: 150, z1: 262, zc: 206, poco: 165, zp: 284, esp: 28, merlao: 62, peitoril: 20, larg: 42, vao: 40, ameia: 369 }
/** Pivô alto: o cano erguido no topo não sai do quadro em 16:9. */
const ZOOM = { k: 1.25, x: 372, y: 175 }
/** Direção em que se olha, em (X, H, Z): face com normal·VISTA < 0 aparece. */
const VISTA: readonly [number, number, number] = [-0.35, -0.55, 1]
const CANO = { ergue: (75 * Math.PI) / 180, mira: (2 * Math.PI) / 180, guinada: (40 * Math.PI) / 180, atras: 34, frente: 100, rAtras: 13, rFrente: 9, munhao: [8, 50] }
const BRONZE = '#a8733e'
const LAJE = '#cec7b4'

function pb(X: number, Z: number, H = 0): Pt {
  return [X + Z * BAL.kx, BAL.y0 - Z * BAL.kz - H]
}

/** O mesmo ponto já com o zoom da cena (para a poeira, que é desenhada sem zoom). */
export function pbz(X: number, Z: number, H = 0): Pt {
  const [x, y] = pb(X, Z, H)
  return [ZOOM.x + (x - ZOOM.x) * ZOOM.k, ZOOM.y + (y - ZOOM.y) * ZOOM.k]
}

function aplicarZoom(g: G): void {
  g.translate(ZOOM.x, ZOOM.y)
  g.scale(ZOOM.k, ZOOM.k)
  g.translate(-ZOOM.x, -ZOOM.y)
}

function caminho(g: G, pts: readonly Pt[]): void {
  g.beginPath()
  g.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1])
  g.closePath()
}

function preencher(g: G, pts: readonly Pt[], cor: string | CanvasGradient, borda?: string, lw = 1): void {
  caminho(g, pts)
  g.fillStyle = cor
  g.fill()
  if (borda !== undefined) {
    g.strokeStyle = borda
    g.lineWidth = lw
    g.stroke()
  }
}

function linha(g: G, a: Pt, b: Pt, cor: string, lw: number): void {
  g.strokeStyle = cor
  g.lineWidth = lw
  g.beginPath()
  g.moveTo(a[0], a[1])
  g.lineTo(b[0], b[1])
  g.stroke()
}

function buracoPts(m = 0): Pt[] {
  const { xc, meia, z0, z1 } = BAL
  return [pb(xc - meia - m, z0 - m), pb(xc + meia + m, z0 - m), pb(xc + meia + m, z1 + m), pb(xc - meia - m, z1 + m)]
}

/** As quatro bordas da boca do poço, já com o zoom: de onde sai a poeira da plataforma assentando. */
export function bordasDoPoco(): Pt[] {
  const { xc, meia, z0, z1 } = BAL
  return [pbz(xc - meia - 1, z0 - 1), pbz(xc + meia + 1, z0 - 1), pbz(xc + meia + 1, z1 + 1), pbz(xc - meia - 1, z1 + 1)]
}

/** Disco num plano X constante (roda, polia, munhão): círculo em (Z, H). */
function discoLateral(X: number, Z: number, H: number, r: number, n = 18): Pt[] {
  const pts: Pt[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    pts.push(pb(X, Z + r * Math.cos(a), H + r * Math.sin(a)))
  }
  return pts
}

/** Cilindro em pé (barril): o arco da frente embaixo, o de trás em cima. */
function barril(g: G, X: number, Z: number, r: number, h: number): void {
  const aD = Math.atan(BAL.kx)
  const arco = (H: number, a0: number, a1: number): Pt[] => {
    const pts: Pt[] = []
    for (let i = 0; i <= 12; i++) {
      const a = a0 + ((a1 - a0) * i) / 12
      pts.push(pb(X + r * Math.cos(a), Z + r * Math.sin(a), H))
    }
    return pts
  }
  const corpo = [...arco(0, aD + Math.PI, aD + 2 * Math.PI), ...arco(h, aD, aD + Math.PI)]
  const [xa] = pb(X - r, Z)
  const [xb] = pb(X + r, Z)
  const grad = g.createLinearGradient(xa, 0, xb, 0)
  grad.addColorStop(0, tomDe(COR.carvalho, 0.78))
  grad.addColorStop(0.65, COR.carvalho)
  grad.addColorStop(1, tomDe(COR.carvalho, 1.08))
  preencher(g, corpo, grad, contorno(COR.carvalho))
  g.strokeStyle = COR.ferro
  g.lineWidth = 2.2
  for (const H of [5, h - 5]) {
    const a = arco(H, aD + Math.PI, aD + 2 * Math.PI)
    g.beginPath()
    g.moveTo(a[0][0], a[0][1])
    for (const q of a) g.lineTo(q[0], q[1])
    g.stroke()
  }
  preencher(g, arco(h, 0, Math.PI * 2), tomDe(COR.carvalho, 1.14), contorno(COR.carvalho))
}

const PILHA_DE_BALAS: readonly (readonly [number, number])[] = [
  [-13, 6.5],
  [0, 6.5],
  [13, 6.5],
  [-6.5, 17.5],
  [6.5, 17.5],
  [0, 28.5],
]

function balas(g: G, X: number, Z: number): void {
  g.fillStyle = 'rgba(40, 30, 24, 0.22)'
  caminho(g, [pb(X - 22, Z - 8), pb(X + 22, Z - 8), pb(X + 22, Z + 8), pb(X - 22, Z + 8)])
  g.fill()
  for (const [dx, h] of PILHA_DE_BALAS) {
    const [x, y] = pb(X + dx, Z, h)
    g.fillStyle = COR.ferro
    g.beginPath()
    g.arc(x, y, 6.5, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = contorno(COR.ferro)
    g.lineWidth = 1
    g.stroke()
    g.fillStyle = tomDe(COR.ferro, 1.55)
    g.beginPath()
    g.arc(x + 2.2, y - 2.2, 1.7, 0, Math.PI * 2)
    g.fill()
  }
}

/** O céu, o vale lá embaixo e o parapeito com os merlões. */
function desenharFundo(g: G): number {
  const { zp, esp, merlao, peitoril, larg, vao, ameia } = BAL
  const ceu = g.createLinearGradient(0, -140, 0, 170)
  ceu.addColorStop(0, '#a3bfcc')
  ceu.addColorStop(0.62, '#dcd8c8')
  ceu.addColorStop(1, '#efd5ac')
  g.fillStyle = ceu
  g.fillRect(-700, -500, 2000, 700)
  const sol = g.createRadialGradient(560, 46, 4, 560, 46, 110)
  sol.addColorStop(0, 'rgba(255, 242, 210, 0.95)')
  sol.addColorStop(0.16, 'rgba(255, 234, 196, 0.5)')
  sol.addColorStop(1, 'rgba(255, 234, 196, 0)')
  g.fillStyle = sol
  g.fillRect(420, -80, 300, 260)
  nuvem(g, 150, 34, 0.9)
  nuvem(g, 420, 18, 0.7)
  nuvem(g, 680, 44, 1.05)
  nuvem(g, -120, 26, 0.9)
  // o vale lá embaixo, visto por cima do parapeito e pelas ameias
  const morro = (cor: string, base: number, a1: number, a2: number, f: number) => {
    g.fillStyle = cor
    g.beginPath()
    g.moveTo(-700, 220)
    for (let x = -700; x <= 1300; x += 20) g.lineTo(x, base + a1 * Math.sin(x * 0.011 + f) + a2 * Math.sin(x * 0.029 + 2 * f))
    g.lineTo(1300, 220)
    g.closePath()
    g.fill()
  }
  morro(mistura(COR.gramaS, '#dcd8c8', 0.66), 100, 9, 5, 0.4)
  morro(mistura(COR.gramaS, '#dcd8c8', 0.44), 116, 7, 4, 1.7)
  morro(mistura(COR.grama, '#dcd8c8', 0.3), 128, 3, 2, 2.9)
  g.strokeStyle = mistura(COR.agua, '#dcd8c8', 0.3)
  g.lineWidth = 2.4
  g.beginPath()
  for (let x = -700; x <= 1300; x += 20) {
    const y = 140 + 4 * Math.sin(x * 0.02) + 2 * Math.sin(x * 0.051)
    if (x === -700) g.moveTo(x, y)
    else g.lineTo(x, y)
  }
  g.stroke()
  const rngV = criarRng('vale')
  g.fillStyle = mistura(COR.gramaS, '#dcd8c8', 0.22)
  for (let i = 0; i < 70; i++) {
    const x = -500 + rngV() * 1600
    const y = 124 + rngV() * 28
    g.beginPath()
    g.arc(x, y, 1.4 + rngV() * 1.6, 0, Math.PI * 2)
    g.fill()
  }
  // o parapeito: muro baixo de ponta a ponta e os merlões por cima
  const [ax, ay] = pb(-900, zp, 0)
  const [bx, by] = pb(1300, zp, peitoril)
  g.fillStyle = tomDe(COR.pedra, 0.95)
  g.fillRect(ax, by, bx - ax, ay - by)
  blocos(g, ax, by, bx - ax, ay - by, 10, 24, tomDe(COR.pedra, 0.84, 0.7), 'peitoril')
  preencher(g, [pb(-900, zp, peitoril), pb(1300, zp, peitoril), pb(1300, zp + esp, peitoril), pb(-900, zp + esp, peitoril)], tomDe(COR.pedra, 1.08), contorno(COR.pedra))
  for (let a = ameia + vao / 2 - (larg + vao) * 14; a < 1300; a += larg + vao) {
    const b = a + larg
    const [fx, fy] = pb(a, zp, merlao)
    const [gx, gy] = pb(b, zp, peitoril)
    preencher(g, [pb(b, zp, peitoril), pb(b, zp + esp, peitoril), pb(b, zp + esp, merlao), pb(b, zp, merlao)], tomDe(COR.pedra, 0.8), contorno(COR.pedra))
    g.fillStyle = COR.pedra
    g.fillRect(fx, fy, gx - fx, gy - fy)
    blocos(g, fx, fy, gx - fx, gy - fy, 10, 22, tomDe(COR.pedra, 0.84, 0.7), `merlao${a}`)
    grao(g, fx, fy, gx - fx, gy - fy, tomDe(COR.pedra, 0.76, 0.45), 14, `gm${a}`)
    g.strokeStyle = contorno(COR.pedra)
    g.lineWidth = 1
    g.strokeRect(fx, fy, gx - fx, gy - fy)
    preencher(g, [pb(a, zp, merlao), pb(b, zp, merlao), pb(b, zp + esp, merlao), pb(a, zp + esp, merlao)], tomDe(COR.pedra, 1.12), contorno(COR.pedra))
  }
  g.strokeStyle = contorno(COR.pedra)
  g.lineWidth = 1.2
  g.beginPath()
  g.moveTo(ax, ay + 0.5)
  g.lineTo(bx, ay + 0.5)
  g.stroke()
  torre(g, 150, 104, 68, ay)
  return ay
}

/** As lajes do terraço, de `ay` (o pé do parapeito) para baixo. */
function desenharLajes(g: G, ay: number): void {
  g.fillStyle = LAJE
  g.fillRect(-700, ay, 2000, 640)
  const rngL = criarRng('lajes')
  for (let z = BAL.zp, fila = 0; z > -340; z -= 26, fila++) {
    const juntas: number[] = []
    for (let x = -1000 + (fila % 2) * 21 + rngL() * 8; x < 1300; x += 34 + rngL() * 18) juntas.push(x)
    for (let i = 0; i + 1 < juntas.length; i++) {
      const t = rngL()
      if (t < 0.3) preencher(g, [pb(juntas[i], z), pb(juntas[i + 1], z), pb(juntas[i + 1], z - 26), pb(juntas[i], z - 26)], tomDe(LAJE, t < 0.15 ? 0.94 : 1.04))
    }
    g.strokeStyle = tomDe(LAJE, 0.8, 0.8)
    g.lineWidth = 0.9
    g.beginPath()
    const [, y] = pb(0, z)
    g.moveTo(-700, y)
    g.lineTo(1300, y)
    for (const x of juntas) {
      const [x0, y0] = pb(x, z)
      const [x1, y1] = pb(x, z - 26)
      g.moveTo(x0, y0)
      g.lineTo(x1, y1)
    }
    g.stroke()
  }
  grao(g, -700, ay, 2000, 640, tomDe(LAJE, 0.78, 0.45), 1400, 'glaje')
  const ao = g.createLinearGradient(0, ay, 0, ay + 16)
  ao.addColorStop(0, 'rgba(50, 38, 30, 0.26)')
  ao.addColorStop(1, 'rgba(50, 38, 30, 0)')
  g.fillStyle = ao
  g.fillRect(-700, ay, 2000, 16)
}

/** A boca do poço: soleira de pedra, o vão escuro, as paredes de dentro. */
function desenharPoco(g: G): void {
  const { xc, meia, z0, z1, poco } = BAL
  preencher(g, buracoPts(6), tomDe(COR.pedra, 0.88), contorno(COR.pedra), 1.2)
  preencher(g, buracoPts(0), '#1d1713')
  g.save()
  caminho(g, buracoPts(0))
  g.clip()
  const L = xc - meia
  const [tx, ty] = pb(L, z1, 0)
  const [ux] = pb(xc + meia, z1, 0)
  const fundo = g.createLinearGradient(0, ty, 0, ty + 70)
  fundo.addColorStop(0, '#54463b')
  fundo.addColorStop(1, '#1b1512')
  g.fillStyle = fundo
  g.fillRect(tx, ty, ux - tx, poco)
  blocos(g, tx, ty, ux - tx, poco, 10, 22, 'rgba(0, 0, 0, 0.28)', 'poco')
  const lado = g.createLinearGradient(0, pb(L, z0, 0)[1] - 60, 0, pb(L, z0, 0)[1] + 10)
  lado.addColorStop(0, '#685749')
  lado.addColorStop(1, '#1c1613')
  preencher(g, [pb(L, z0, 0), pb(L, z1, 0), pb(L, z1, -poco), pb(L, z0, -poco)], lado)
  g.strokeStyle = 'rgba(0, 0, 0, 0.3)'
  g.lineWidth = 0.8
  g.beginPath()
  for (let h = -10; h > -poco; h -= 10) {
    const [x0, y0] = pb(L, z0, h)
    const [x1, y1] = pb(L, z1, h)
    g.moveTo(x0, y0)
    g.lineTo(x1, y1)
  }
  g.stroke()
  for (const z of [182, 236]) {
    preencher(g, discoLateral(L + 2, z, -6, 5.5), COR.ferro, contorno(COR.ferro))
    const [x, y] = pb(L + 2, z, -6)
    g.fillStyle = COR.latao
    g.beginPath()
    g.arc(x, y, 1.6, 0, Math.PI * 2)
    g.fill()
  }
  // o suporte da tocha, na parede do fundo
  const [sx, sy] = pb(xc - 36, z1, -34)
  g.fillStyle = COR.ferro
  g.fillRect(sx - 2, sy, 4, 10)
  g.restore()
  // dobradiças das folhas e as caixas dos ferrolhos
  for (const hx of [xc - meia, xc + meia]) {
    for (const z of [172, 240]) preencher(g, [pb(hx - 5, z - 4), pb(hx + 5, z - 4), pb(hx + 5, z + 4), pb(hx - 5, z + 4)], tomDe(COR.ferro, 0.9), contorno(COR.ferro))
  }
  for (const [za, zb] of [
    [z0 - 22, z0 - 4],
    [z1 + 4, z1 + 22],
  ]) {
    preencher(g, [pb(xc - 7, za), pb(xc + 7, za), pb(xc + 7, zb), pb(xc - 7, zb)], tomDe(COR.ferro, 0.75), contorno(COR.ferro))
  }
}

/** Tudo o que não se mexe na cena do canhão: céu, vale, parapeito, lajes, a boca do poço. */
function desenharFixoCanhao(g: G): void {
  g.save()
  aplicarZoom(g)
  const ay = desenharFundo(g)
  desenharLajes(g, ay)
  desenharPoco(g)
  balas(g, 446, 214)
  barril(g, 470, 116, 13, 28)
  g.restore()
  quadroFixo(g, 'Sarilho, debaixo do baluarte')
}

/** Uma folha do alçapão (lado -1 esquerda, 1 direita), girada th radianos (0 fechada, π deitada aberta). */
function desenharFolha(g: G, lado: number, th: number): void {
  const { xc, meia, z0, z1 } = BAL
  const hx = xc + lado * meia
  const w = meia - 1
  const ponta = (f: number): Pt => [hx - lado * w * f * Math.cos(th), w * f * Math.sin(th)]
  const [tx, tH] = ponta(1)
  const pts = [pb(hx, z0), pb(hx, z1), pb(tx, z1, tH), pb(tx, z0, tH)]
  const topo = VISTA[0] * lado * Math.sin(th) + VISTA[1] * Math.cos(th) < 0
  const cor = topo ? tomDe(COR.carvalho, 1.02 - 0.14 * Math.sin(th)) : tomDe(COR.nogueira, 0.92 + 0.16 * Math.abs(Math.cos(th)))
  preencher(g, pts, cor)
  const veio = topo ? tomDe(COR.nogueira, 0.95, 0.7) : tomDe(COR.nogueira, 0.7, 0.7)
  for (const f of [1 / 3, 2 / 3]) {
    const [x, h] = ponta(f)
    linha(g, pb(x, z0 + 2, h), pb(x, z1 - 2, h), veio, 1)
  }
  if (!topo) linha(g, pb(hx, z0 + 6), pb(tx, z1 - 6, tH), tomDe(COR.nogueira, 0.62), 3)
  for (const z of [172, 240]) {
    linha(g, pb(hx, z), pb(tx, z, tH), COR.ferro, 3.4)
    g.fillStyle = COR.latao
    for (const f of [0.3, 0.7]) {
      const [x, h] = ponta(f)
      const [px, py] = pb(x, z, h)
      g.beginPath()
      g.arc(px, py, 1.3, 0, Math.PI * 2)
      g.fill()
    }
  }
  linha(g, pb(hx, z0), pb(tx, z0, tH), tomDe(COR.nogueira, 0.78), 3)
  caminho(g, pts)
  g.strokeStyle = contorno(COR.carvalho)
  g.lineWidth = 1.1
  g.stroke()
}

type NoReparo = (dx: number, dz: number, h: number) => Pt

/** Os anéis do cano: onde ficam ao longo dele e quanto saltam. */
const ANEIS_DO_CANO: readonly (readonly [number, number])[] = [
  [-CANO.atras + 3, 1.6],
  [-2, 1.1],
  [44, 0.8],
  [CANO.frente - 7, 1.5],
]

/** O cano de bronze, girado phi (radianos acima do chão), preso no munhão do reparo. */
function desenharCano(g: G, P: NoReparo, phi: number, luz: number): void {
  const s = Math.sin(phi)
  const c = Math.cos(phi)
  const [mz, mh] = CANO.munhao
  const ponto = (t: number) => P(0, mz + t * c, mh + t * s)
  const p0 = ponto(-CANO.atras)
  const p1 = ponto(CANO.frente)
  let nx = p1[1] - p0[1]
  let ny = p0[0] - p1[0]
  const L = Math.hypot(nx, ny) || 1
  nx /= L
  ny /= L
  if (nx - ny < 0) {
    // n aponta para cima e para a direita, o lado da luz
    nx = -nx
    ny = -ny
  }
  const r0 = CANO.rAtras
  const r1 = CANO.rFrente
  const raio = (t: number) => r0 + ((r1 - r0) * (t + CANO.atras)) / (CANO.atras + CANO.frente)
  const meio = tomDe(BRONZE, luz)
  const borda = tomDe(BRONZE, 0.55 * luz)
  const sombra = tomDe(BRONZE, 0.68 * luz)
  // os dois eixos do disco das pontas, na tela: o X do reparo e o que fica no plano do cano
  const O = P(0, 0, 0)
  const eixo = (dx: number, dz: number, h: number): Pt => {
    const q = P(dx, dz, h)
    return [q[0] - O[0], q[1] - O[1]]
  }
  const a1 = eixo(1, 0, 0)
  const a2 = eixo(0, -s, c)
  const disco = (q: Pt, r: number) => {
    g.save()
    g.transform(a1[0] * r, a1[1] * r, a2[0] * r, a2[1] * r, q[0], q[1])
    g.beginPath()
    g.arc(0, 0, 1, 0, Math.PI * 2)
    g.restore()
  }
  const gs = Math.sin(CANO.guinada)
  const gc = Math.cos(CANO.guinada)
  // a boca vira para quem olha quando o cano está erguido
  const boca = VISTA[0] * c * gs + VISTA[1] * s + VISTA[2] * c * gc < 0
  const pc = ponto(-CANO.atras - 7)
  const botao = () => {
    linha(g, pc, p0, sombra, 4)
    g.fillStyle = meio
    g.beginPath()
    g.arc(pc[0], pc[1], 4.4, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = borda
    g.lineWidth = 1
    g.stroke()
  }
  if (boca) botao()
  const m = ponto((CANO.frente - CANO.atras) / 2)
  const rm = raio((CANO.frente - CANO.atras) / 2)
  const grad = g.createLinearGradient(m[0] + nx * rm, m[1] + ny * rm, m[0] - nx * rm, m[1] - ny * rm)
  grad.addColorStop(0, tomDe(BRONZE, 1.22 * luz))
  grad.addColorStop(0.3, tomDe(BRONZE, 1.08 * luz))
  grad.addColorStop(1, tomDe(BRONZE, 0.7 * luz))
  caminho(g, [
    [p0[0] + nx * r0, p0[1] + ny * r0],
    [p1[0] + nx * r1, p1[1] + ny * r1],
    [p1[0] - nx * r1, p1[1] - ny * r1],
    [p0[0] - nx * r0, p0[1] - ny * r0],
  ])
  g.fillStyle = grad
  g.fill()
  g.strokeStyle = borda
  g.lineWidth = 1.1
  g.stroke()
  for (const [t, extra] of ANEIS_DO_CANO) {
    const q = ponto(t)
    const r = raio(t) + extra
    linha(g, [q[0] + nx * r, q[1] + ny * r], [q[0] - nx * r, q[1] - ny * r], sombra, 2.6)
  }
  linha(g, [p0[0] + nx * r0 * 0.45, p0[1] + ny * r0 * 0.45], [p1[0] + nx * r1 * 0.45, p1[1] + ny * r1 * 0.45], tomDe(BRONZE, 1.45 * luz, 0.5), 1.6)
  if (boca) {
    disco(p1, r1 + 1.4)
    g.fillStyle = meio
    g.fill()
    g.strokeStyle = borda
    g.lineWidth = 1
    g.stroke()
    disco(p1, r1 * 0.58)
    g.fillStyle = '#1a1410'
    g.fill()
  } else {
    disco(p0, r0)
    g.fillStyle = sombra
    g.fill()
    g.strokeStyle = borda
    g.lineWidth = 1
    g.stroke()
    disco(p0, r0 * 0.66)
    g.strokeStyle = tomDe(BRONZE, 0.9 * luz)
    g.stroke()
    botao()
  }
}

/** O perfil da bochecha do reparo, em (dz, h). */
const PERFIL_DO_REPARO: readonly (readonly [number, number])[] = [
  [-30, 4],
  [34, 4],
  [34, 26],
  [24, 46],
  [-4, 46],
  [-10, 26],
  [-30, 26],
]

/** O canhão no reparo de madeira, com a plataforma na altura Hp (0 = rente às lajes). */
function desenharCanhao(g: G, Hp: number, phi: number, luz: number): void {
  // dx, dz, h são do próprio reparo (dz para onde o cano aponta); o reparo está girado CANO.guinada
  const gs = Math.sin(CANO.guinada)
  const gc = Math.cos(CANO.guinada)
  const P: NoReparo = (dx, dz, h) => pb(BAL.xc + dx * gc + dz * gs, BAL.zc - dx * gs + dz * gc, Hp + h)
  const disco = (dx: number, dz: number, h: number, r: number, n = 18): Pt[] => {
    const pts: Pt[] = []
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      pts.push(P(dx, dz + r * Math.cos(a), h + r * Math.sin(a)))
    }
    return pts
  }
  const cor = (h: string, f = 1) => tomDe(h, f * luz)
  const borda = (h: string) => tomDe(h, 0.6 * luz)
  const [mz, mh] = CANO.munhao
  const c = Math.cos(phi)
  g.fillStyle = `rgba(24, 16, 12, ${0.26 * luz})`
  caminho(g, [P(-30, -36, 0), P(30, -36, 0), P(30, 38, 0), P(-30, 38, 0)])
  g.fill()
  // a sombra do cano no chão: comprida quando ele deita, curta quando aponta para cima
  g.lineCap = 'round'
  linha(g, P(0, mz - CANO.atras * c, 0.5), P(0, mz + CANO.frente * c, 0.5), `rgba(24, 16, 12, ${0.2 * luz})`, 16)
  g.lineCap = 'butt'
  const roda = (dx: number, dz: number, f: number) => {
    // a face mais longe (escura) primeiro; a que aparece por cima
    const longe = dx < 0 ? dx : dx - 4
    const perto = dx < 0 ? dx + 4 : dx
    preencher(g, disco(longe, dz, 9, 9), cor(COR.nogueira, 0.6 * f))
    preencher(g, disco(perto, dz, 9, 9), cor(COR.nogueira, 0.92 * f), cor(COR.ferro, f), 1.8)
    const [x, y] = P(perto, dz, 9)
    g.fillStyle = cor(COR.ferro, 1.1 * f)
    g.beginPath()
    g.arc(x, y, 2.2, 0, Math.PI * 2)
    g.fill()
  }
  const bochecha = (dx: number) => PERFIL_DO_REPARO.map(([z, h]) => P(dx, z, h))
  roda(-26, -20, 0.8)
  roda(-26, 24, 0.8)
  preencher(g, bochecha(-20), cor(COR.carvalho, 1.1), borda(COR.carvalho))
  preencher(g, bochecha(-14), cor(COR.carvalho, 0.76), borda(COR.carvalho))
  preencher(g, [P(-20, -30, 4), P(-14, -30, 4), P(-14, -30, 26), P(-20, -30, 26)], cor(COR.carvalho, 0.92), borda(COR.carvalho))
  preencher(g, [P(-26, -24, 4), P(26, -24, 4), P(26, -24, 13), P(-26, -24, 13)], cor(COR.nogueira), borda(COR.nogueira))
  desenharCano(g, P, phi, luz)
  preencher(g, bochecha(14), cor(COR.carvalho, 1.16), borda(COR.carvalho))
  preencher(g, bochecha(20), cor(COR.carvalho), borda(COR.carvalho))
  preencher(g, [P(14, -30, 4), P(20, -30, 4), P(20, -30, 26), P(14, -30, 26)], cor(COR.carvalho, 1.06), borda(COR.carvalho))
  preencher(g, disco(20.5, mz, mh, 4.6, 12), cor(BRONZE, 0.9), borda(BRONZE))
  g.strokeStyle = cor(COR.ferro)
  g.lineWidth = 2.6
  g.beginPath()
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * Math.PI
    const [x, y] = P(20.6, mz + 6.5 * Math.cos(a), mh + 6.5 * Math.sin(a))
    if (i) g.lineTo(x, y)
    else g.moveTo(x, y)
  }
  g.stroke()
  roda(26, -20, 1)
  roda(26, 24, 1)
}

/** Tudo o que se mexe na cena do canhão. */
function desenharMovelCanhao(g: G, est: EstadoVisual): void {
  const { xc, meia, z0, z1, poco } = BAL
  const p = est.p
  const Hp = -poco * (1 - p)
  const luz = 0.6 + 0.4 * p
  const k = Math.min(1, p / FOLHAS)
  const th = Math.PI * Math.pow(k, 1.4)
  const phi = CANO.mira + (CANO.ergue - CANO.mira) * est.cano
  const buraco = buracoPts(0)
  g.save()
  caminho(g, buraco)
  g.clip()
  const [tx, ty] = pb(xc - 36, z1, -30)
  chama(g, tx, ty, est.t, 0.7)
  const L = xc - meia + 2
  for (const [i, z] of [
    [0, 182],
    [1, 236],
  ]) {
    const a = pb(L, z, -6)
    const b = pb(L, z, Hp - 8)
    if (b[1] > a[1] + 1) desenharCorrente(g, a[0], a[1], b[0], b[1], (1 - p) * 240, est.vib * 0.8, est.t, i * 1.7)
  }
  const plat = [pb(xc - meia + 2, z0 + 2, Hp), pb(xc + meia - 2, z0 + 2, Hp), pb(xc + meia - 2, z1 - 2, Hp), pb(xc - meia + 2, z1 - 2, Hp)]
  preencher(g, plat, tomDe(LAJE, 0.9 * luz), tomDe(COR.ferro, luz), 2.2)
  linha(g, pb(xc, z0 + 2, Hp), pb(xc, z1 - 2, Hp), tomDe(LAJE, 0.72 * luz, 0.8), 0.9)
  g.restore()
  // ferrolhos: correm para dentro da plataforma quando o canhão trava no topo
  const tv = est.trava * 14
  preencher(g, [pb(xc - 4, z0 - 19 + tv, 1), pb(xc + 4, z0 - 19 + tv, 1), pb(xc + 4, z0 - 5 + tv, 1), pb(xc - 4, z0 - 5 + tv, 1)], tomDe(COR.ferro, 1.2), contorno(COR.ferro))
  preencher(g, [pb(xc - 4, z1 + 5 - tv, 1), pb(xc + 4, z1 + 5 - tv, 1), pb(xc + 4, z1 + 19 - tv, 1), pb(xc - 4, z1 + 19 - tv, 1)], tomDe(COR.ferro, 1.2), contorno(COR.ferro))
  if (th > Math.PI / 2) desenharFolha(g, -1, th)
  // dentro do poço o canhão só aparece pela boca do alçapão; acima das lajes, inteiro
  const [, yc] = pb(0, BAL.zc)
  g.save()
  caminho(g, buraco.slice().reverse())
  g.rect(-900, -600, 2400, 600 + yc)
  g.clip()
  desenharCanhao(g, Hp, phi, luz)
  g.restore()
  if (th <= Math.PI / 2) desenharFolha(g, -1, th)
  desenharFolha(g, 1, th)
}

/** A cena do canhão inteira num canvas de W x H pixels. */
export function desenharCenaDoCanhao(ctx: G, W: number, H: number, est: EstadoVisual): void {
  comecarQuadro(ctx, W, H, est, 'canhao', desenharFixoCanhao)
  ctx.save()
  aplicarZoom(ctx)
  desenharMovelCanhao(ctx, est)
  ctx.restore()
  desenharPoeira(ctx, est.poeira)
  desenharSarilho(ctx, est)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
}
