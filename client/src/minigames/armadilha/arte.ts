/**
 * ARTE DAS ARMADILHAS: a cobra (cabeça de frente, boca escancarada, presas e
 * olho de fenda) e a aranha (sobe pela boca do recipiente e ergue as patas),
 * desenhadas por cima da cena do jogo, e o flash quente do bote. Tudo por
 * retângulo de pixel, em qualquer tamanho, sem sprite pronto: a cabeça da
 * cobra é feita de elipses por linha, então cresce no salto sem borrar.
 *
 * O tremor não é desenhado aqui: o motor desloca a cena inteira por
 * `tremorX/tremorY` do quadro (sim.ts) antes de desenhar o jogo e o bicho.
 */
import { COR, H, W, contorno, luz, pix } from '../abrir/desenho'
import { quadro, type QuadroDoSusto, type Susto } from './sim'

/** Meia largura da cabeça da cobra no tamanho cheio, em px: a cabeça cobre ~120 de 240 px. */
export const MEIA_CABECA = 60

/* Cores da cobra: oliva escura de víbora, ventre de palha, boca rosada. Contidas, nunca neon. */
const ESCAMA = '#66773f'
const ESCAMA_ESCURA = '#3f4a26'
const ESCAMA_CLARA = '#8a9a5a'
const VENTRE = '#c9b98a'
const VENTRE_ESCURO = '#a8996c'
const GENGIVA = '#cf7787'
const BOCA = '#a8475a'
const GARGANTA = '#3a1a20'
const LINGUA = '#d4485a'

/*
 * Cores da aranha: castanho de celeiro, com a marca âmbar nas costas. Mais clara
 * que a boca escura do recipiente: na primeira folha de contato ela sumia no escuro.
 */
const ARANHA_CORPO = '#8a5a3a'
const ARANHA_PATA = '#6b4630'
/** Tamanho da aranha em relação ao desenho base (o base tinha 10 px de corpo e ficava miúdo). */
const ESCALA_DA_ARANHA = 1.6

/** Elipse cheia por linhas de pixel (centro, raios). */
function elipse(g: CanvasRenderingContext2D, cor: string, cx: number, cy: number, rx: number, ry: number): void {
  if (rx < 0.5 || ry < 0.5) return
  g.fillStyle = cor
  const y0 = Math.round(cy - ry)
  const y1 = Math.round(cy + ry)
  for (let y = y0; y <= y1; y++) {
    const k = (y + 0.5 - cy) / ry
    if (k <= -1 || k >= 1) continue
    const w = rx * Math.sqrt(1 - k * k)
    const xa = Math.round(cx - w)
    const xb = Math.round(cx + w)
    if (xb > xa) g.fillRect(xa, y, xb - xa, 1)
  }
}

/** Elipse com contorno da própria cor (1 px). */
function elipseContornada(g: CanvasRenderingContext2D, cor: string, cx: number, cy: number, rx: number, ry: number): void {
  elipse(g, contorno(cor), cx, cy, rx + 1, ry + 1)
  elipse(g, cor, cx, cy, rx, ry)
}

/** Linha de pixel (Bresenham). */
function linha(g: CanvasRenderingContext2D, cor: string, x0: number, y0: number, x1: number, y1: number): void {
  let xa = Math.round(x0), ya = Math.round(y0)
  const xb = Math.round(x1), yb = Math.round(y1)
  const dx = Math.abs(xb - xa), dy = -Math.abs(yb - ya)
  const sx = xa < xb ? 1 : -1, sy = ya < yb ? 1 : -1
  let err = dx + dy
  g.fillStyle = cor
  for (let n = 0; n < 400; n++) {
    g.fillRect(xa, ya, 1, 1)
    if (xa === xb && ya === yb) return
    const e2 = 2 * err
    if (e2 >= dy) { err += dy; xa += sx }
    if (e2 <= dx) { err += dx; ya += sy }
  }
}

/** Forma por linhas de pixel: meia largura rx * perfil(k), com k de −1 (topo) a 1 (base). */
function forma(g: CanvasRenderingContext2D, cor: string, cx: number, cy: number, rx: number, ry: number, perfil: (k: number) => number): void {
  if (rx < 0.5 || ry < 0.5) return
  g.fillStyle = cor
  const y0 = Math.round(cy - ry)
  const y1 = Math.round(cy + ry)
  for (let y = y0; y <= y1; y++) {
    const k = (y + 0.5 - cy) / ry
    if (k <= -1 || k >= 1) continue
    const w = rx * perfil(k)
    const xa = Math.round(cx - w)
    const xb = Math.round(cx + w)
    if (xb > xa) g.fillRect(xa, y, xb - xa, 1)
  }
}

/** Cabeça chata de víbora: superelipse (alto quase reto) que estreita um pouco no focinho. */
const SUPERELIPSE = 2.6
const perfilDaCabeca = (k: number): number => Math.pow(1 - Math.pow(Math.abs(k), SUPERELIPSE), 1 / SUPERELIPSE) * (1 - 0.12 * k)

/** Traço grosso (esp px) de pixel: empilha linhas de lado no traço em pé e de cima a baixo no deitado. */
function traco(g: CanvasRenderingContext2D, cor: string, x0: number, y0: number, x1: number, y1: number, esp: number): void {
  const n = Math.max(1, Math.round(esp))
  const emPe = Math.abs(x1 - x0) < Math.abs(y1 - y0)
  for (let i = 0; i < n; i++) {
    if (emPe) linha(g, cor, x0 + i, y0, x1 + i, y1)
    else linha(g, cor, x0, y0 + i, x1, y1 + i)
  }
}

/** Presa longa e curva (para fora e de volta para dentro), branca com contorno. */
function presa(g: CanvasRenderingContext2D, x: number, y: number, larg: number, comp: number, lado: number): void {
  const n = Math.max(2, Math.round(comp))
  for (let i = 0; i < n; i++) {
    const w = Math.max(1, Math.round(larg * (1 - i / n)))
    const curva = lado * larg * 0.6 * Math.sin((Math.PI * i) / n)
    pix(g, contorno(COR.branco), x + curva - Math.floor(w / 2) - 1, y + i, w + 2, 1)
  }
  for (let i = 0; i < n - 1; i++) {
    const w = Math.max(1, Math.round(larg * (1 - i / n)) - 1)
    const curva = lado * larg * 0.6 * Math.sin((Math.PI * i) / n)
    pix(g, COR.branco, x + curva - Math.floor(w / 2), y + i, w, 1)
  }
}

/** Cabeça de víbora de frente, boca escancarada, presas, língua e olhos de fenda sob a sobrancelha. */
function desenharCobra(g: CanvasRenderingContext2D, q: QuadroDoSusto): void {
  const u = MEIA_CABECA * q.escala
  if (u < 2) return
  const x = q.x, y = q.y
  const abre = 0.45 + 0.55 * q.pose
  const px1 = (v: number): number => Math.max(1, Math.round(v))
  // Pescoço com as placas do ventre, sumindo para baixo (de volta ao recipiente).
  elipseContornada(g, ESCAMA, x, y + 1.15 * u, 0.46 * u, 0.9 * u)
  elipse(g, VENTRE_ESCURO, x, y + 1.2 * u, 0.24 * u, 0.86 * u)
  for (let k = 0; k < 6; k++) pix(g, luz(VENTRE_ESCURO, 0.8), x - 0.22 * u, y + (0.6 + 0.17 * k) * u, 0.44 * u, px1(0.025 * u))
  // Mandíbula de baixo, estreita, com o lábio claro.
  const yMandibula = y + (0.3 + 0.32 * abre) * u
  elipseContornada(g, ESCAMA, x, yMandibula, 0.6 * u, 0.2 * u)
  elipse(g, VENTRE, x, yMandibula - 0.09 * u, 0.55 * u, 0.07 * u)
  // Boca: gengiva clara na borda, céu da boca escuro e a garganta funda.
  elipse(g, contorno(GENGIVA), x, y + 0.14 * u, 0.86 * u, 0.46 * u * abre)
  elipse(g, GENGIVA, x, y + 0.14 * u, 0.84 * u, 0.44 * u * abre)
  elipse(g, BOCA, x, y + 0.17 * u, 0.72 * u, 0.35 * u * abre)
  elipse(g, GARGANTA, x, y + 0.24 * u, 0.24 * u, 0.15 * u * abre)
  // Língua bifurcada saindo da garganta e caindo por cima da mandíbula.
  const raiz = y + 0.24 * u
  const ponta = raiz + (0.22 + 0.36 * q.lingua) * u
  const esp = 0.035 * u
  traco(g, LINGUA, x, raiz, x, ponta, esp)
  traco(g, LINGUA, x, ponta, x - 0.09 * u, ponta + 0.1 * u, esp)
  traco(g, LINGUA, x, ponta, x + 0.09 * u, ponta + 0.1 * u, esp)
  // Cabeça (maxila de cima) por cima da boca: chata, larga, de víbora.
  forma(g, contorno(ESCAMA), x, y - 0.3 * u, 1.0 * u + 1, 0.46 * u + 1, perfilDaCabeca)
  forma(g, ESCAMA, x, y - 0.3 * u, 1.0 * u, 0.46 * u, perfilDaCabeca)
  forma(g, ESCAMA_CLARA, x, y - 0.6 * u, 0.6 * u, 0.09 * u, perfilDaCabeca)
  // O "V" escuro das víboras no alto da cabeça.
  traco(g, ESCAMA_ESCURA, x - 0.5 * u, y - 0.74 * u, x, y - 0.48 * u, 0.06 * u)
  traco(g, ESCAMA_ESCURA, x + 0.5 * u, y - 0.74 * u, x, y - 0.48 * u, 0.06 * u)
  // Lábio de cima claro, com uma fileira de dentinhos.
  elipse(g, VENTRE, x, y - 0.03 * u, 0.88 * u, 0.06 * u)
  for (let i = -4; i <= 4; i++) {
    if (Math.abs(i) === 2) continue
    pix(g, COR.branco, x + i * 0.15 * u - 0.015 * u, y + 0.02 * u, px1(0.03 * u), px1(0.05 * u))
  }
  // Presas longas, curvas.
  const comp = (0.28 + 0.2 * q.pose) * u
  presa(g, x - 0.3 * u, y + 0.01 * u, 0.1 * u, comp, -1)
  presa(g, x + 0.3 * u, y + 0.01 * u, 0.1 * u, comp, 1)
  // Olhos de fenda com a sobrancelha descendo para o meio: cara de brava.
  for (const lado of [-1, 1]) {
    const ox = x + lado * 0.56 * u, oy = y - 0.36 * u
    elipseContornada(g, COR.ouro, ox, oy, 0.11 * u, 0.085 * u)
    pix(g, GARGANTA, ox - 0.02 * u, oy - 0.08 * u, px1(0.045 * u), px1(0.17 * u))
    pix(g, COR.branco, ox - 0.07 * u, oy - 0.05 * u, px1(0.03 * u), px1(0.03 * u))
    traco(g, ESCAMA_ESCURA, ox + lado * 0.17 * u, oy - 0.17 * u, ox - lado * 0.15 * u, oy - 0.05 * u, 0.07 * u)
  }
  // Narinas e as fossetas que sentem calor.
  pix(g, GARGANTA, x - 0.13 * u, y - 0.16 * u, px1(0.05 * u), px1(0.03 * u))
  pix(g, GARGANTA, x + 0.09 * u, y - 0.16 * u, px1(0.05 * u), px1(0.03 * u))
  pix(g, ESCAMA_ESCURA, x - 0.36 * u, y - 0.2 * u, px1(0.04 * u), px1(0.04 * u))
  pix(g, ESCAMA_ESCURA, x + 0.32 * u, y - 0.2 * u, px1(0.04 * u), px1(0.04 * u))
}

/** Uma pata da aranha: ombro, joelho e pé (com a passada e a pose de ameaça). */
function pata(g: CanvasRenderingContext2D, x: number, y: number, lado: number, i: number, q: QuadroDoSusto): void {
  const s = ESCALA_DA_ARANHA
  const fase = Math.sin(q.passada + i * 1.7 + (lado > 0 ? Math.PI : 0))
  const ameaca = i === 0 && q.pose > 0
  const ox = x + lado * 3 * s, oy = y + (3 + i * 1.5) * s
  const jx = ox + lado * (6 + i) * s, jy = ameaca ? oy - 9 * s : oy + (-4 + fase * 1.5) * s
  const px = jx + lado * (ameaca ? 3 : 4) * s, py = ameaca ? jy - 4 * s : oy + (5 + i * 1.2 + fase) * s
  traco(g, ARANHA_PATA, ox, oy, jx, jy, 2)
  traco(g, ARANHA_PATA, jx, jy, px, py, 2)
}

/** A aranha saindo pela boca do recipiente (recortada abaixo da borda). */
function desenharAranha(g: CanvasRenderingContext2D, q: QuadroDoSusto, boca: readonly [number, number]): void {
  const s = ESCALA_DA_ARANHA
  g.save()
  g.beginPath()
  g.rect(0, 0, W, Math.round(boca[1]))
  g.clip()
  const x = Math.round(q.x), y = Math.round(q.y)
  for (let i = 0; i < 4; i++) {
    pata(g, x, y, -1, i, q)
    pata(g, x, y, 1, i, q)
  }
  // Abdômen atrás e acima, com a marca âmbar; cefalotórax na frente.
  elipseContornada(g, ARANHA_CORPO, x, y - 3 * s, 5 * s, 4.5 * s)
  pix(g, luz(ARANHA_CORPO, 1.18), x - 3 * s, y - 6 * s, 2 * s, 1)
  pix(g, COR.ambar, x - 1 * s, y - 5 * s, 2 * s, 3 * s)
  pix(g, luz(COR.ambar, 0.8), x - 2 * s, y - 4 * s, s, s)
  elipseContornada(g, luz(ARANHA_CORPO, 1.1), x, y + 3 * s, 3.5 * s, 3 * s)
  // Olhos.
  pix(g, COR.brasa, x - 2 * s, y + 2 * s, 2, 2)
  pix(g, COR.brasa, x + 1 * s, y + 2 * s, 2, 2)
  pix(g, COR.ouro, x - 1, y + 3 * s, 1, 1)
  pix(g, COR.ouro, x + 1, y + 3 * s, 1, 1)
  g.restore()
}

/** O bicho do susto, por cima da cena (já deslocada pelo tremor). */
export function desenharSusto(g: CanvasRenderingContext2D, s: Readonly<Susto>): void {
  const q = quadro(s)
  if (q.opacidade <= 0) return
  const antes = g.globalAlpha
  g.globalAlpha = antes * q.opacidade
  if (s.bicho === 'cobra') desenharCobra(g, q)
  else desenharAranha(g, q, s.boca)
  g.globalAlpha = antes
}

/** O flash quente do bote, por cima de tudo (fora do tremor). Zero no reduzido. */
export function desenharFlash(g: CanvasRenderingContext2D, s: Readonly<Susto>): void {
  const f = quadro(s).flash
  if (f <= 0) return
  g.fillStyle = `rgba(255,236,204,${f.toFixed(3)})`
  g.fillRect(0, 0, W, H)
}

/** Deslocamento da cena inteira neste instante (tremor), em px inteiros. */
export function tremorDoSusto(s: Readonly<Susto>): readonly [number, number] {
  const q = quadro(s)
  return [q.tremorX, q.tremorY]
}
