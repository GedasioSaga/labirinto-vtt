import type { Graphics } from 'pixi.js'
import type { PapelDesenhado } from '../documentos/noMapa'
import type { PapelDoDocumento } from '../documentos/tipos'

/**
 * O PAPEL NO CHÃO no canvas (plano dos puzzles, fase D2; desenho do protótipo
 * aprovado `prototipo-v2.html`, `svgPapelMapa`): os 5 papéis e a imagem
 * própria, em vetor num `Graphics` só, sem `Text` nem sprite. Serve ao editor
 * do mestre (todos os papéis, o pego apagado, o aberto aceso) e à tela do
 * jogador (só o recorte, `PapelNoChao`), que entra na D3.
 *
 * O desenho do protótipo é em unidades de uma casa de 60 px; aqui ele escala
 * pela grade do mapa, então o papel ocupa ~0,6 casa em qualquer mapa.
 */

/** A casa do protótipo: o desenho foi feito para ela. */
const CASA_DO_DESENHO = 60
/** Papel já pego ("some depois de pego"): o mestre ainda o vê, bem apagado. */
const ALFA_DO_PEGO = 0.35
/** O realce do documento aberto na página: o anel do "perto" do protótipo. */
const COR_DO_ANEL = 0xf3ba66
const RAIO_DO_ANEL = 30
const TRACO_DO_ANEL = 3
/** A sombra que descola o papel do chão. */
const SOMBRA = { cor: 0x000000, alfa: 0.28, dx: 1.5, dy: 2.5 } as const
/** O alfinete fica um pouco torto (o `rotate(-4)` do protótipo). */
const GIRO_DO_ALFINETE = (-4 * Math.PI) / 180

/** Desenha no espaço do protótipo: (0, 0) é o centro do papel, e cada unidade vale `k` px de mundo. */
interface Pincel {
  g: Graphics
  cx: number
  cy: number
  k: number
  alfa: number
}

type Ponto = readonly [number, number]

function emMundo(p: Pincel, [x, y]: Ponto, giro = 0): [number, number] {
  const cos = Math.cos(giro)
  const sin = Math.sin(giro)
  return [p.cx + (x * cos - y * sin) * p.k, p.cy + (x * sin + y * cos) * p.k]
}

function poligono(p: Pincel, pontos: readonly Ponto[], fundo: number, contorno: number, largura: number, giro = 0): void {
  p.g
    .poly(pontos.flatMap((ponto) => emMundo(p, ponto, giro)))
    .fill({ color: fundo, alpha: p.alfa })
    .stroke({ width: largura * p.k, color: contorno, alpha: p.alfa, join: 'round' })
}

function retangulo(p: Pincel, x: number, y: number, w: number, h: number, fundo: number, contorno: number, largura: number, raio = 0): void {
  const [mx, my] = emMundo(p, [x, y])
  const forma = raio > 0 ? p.g.roundRect(mx, my, w * p.k, h * p.k, raio * p.k) : p.g.rect(mx, my, w * p.k, h * p.k)
  forma.fill({ color: fundo, alpha: p.alfa }).stroke({ width: largura * p.k, color: contorno, alpha: p.alfa })
}

function traco(p: Pincel, de: Ponto, para: Ponto, cor: number, largura: number, giro = 0): void {
  const [x0, y0] = emMundo(p, de, giro)
  const [x1, y1] = emMundo(p, para, giro)
  p.g.moveTo(x0, y0).lineTo(x1, y1).stroke({ width: largura * p.k, color: cor, alpha: p.alfa, cap: 'round' })
}

function bola(p: Pincel, x: number, y: number, r: number, fundo: number, contorno: number | null, largura: number): void {
  const [mx, my] = emMundo(p, [x, y])
  const forma = p.g.circle(mx, my, r * p.k).fill({ color: fundo, alpha: p.alfa })
  if (contorno !== null) forma.stroke({ width: largura * p.k, color: contorno, alpha: p.alfa })
}

/** O contorno de cada papel, para a sombra (o mesmo do desenho, deslocado). */
const SILHUETAS: Readonly<Record<PapelDoDocumento, readonly Ponto[]>> = {
  carta: [[-17, -12], [17, -12], [17, 12], [-17, 12]],
  diario: [[-14, -17], [14, -17], [14, 17], [-14, 17]],
  bilhete: [[-15, -14], [15, -14], [15, 9], [-15, 9]],
  pergaminho: [[-16, -18], [16, -18], [16, 18], [-16, 18]],
  imagem: [[-15, -18], [15, -18], [15, 18], [-15, 18]],
  alfinete: [[-15, -17], [15, -17], [15, 19], [-15, 19]],
}

function sombra(p: Pincel, papel: PapelDoDocumento): void {
  const giro = papel === 'alfinete' ? GIRO_DO_ALFINETE : 0
  const pontos = SILHUETAS[papel].map(([x, y]) => emMundo(p, [x + SOMBRA.dx, y + SOMBRA.dy], giro))
  p.g.poly(pontos.flat()).fill({ color: SOMBRA.cor, alpha: SOMBRA.alfa * p.alfa })
}

function desenharPapel(p: Pincel, papel: PapelDoDocumento): void {
  switch (papel) {
    case 'carta':
      retangulo(p, -17, -12, 34, 24, 0xf4eee1, 0x9a8e74, 2, 2)
      traco(p, [-17, -12], [0, 2], 0x9a8e74, 2)
      traco(p, [0, 2], [17, -12], 0x9a8e74, 2)
      bola(p, 0, 3, 4.5, 0xb8473b, 0x7a241d, 1.5)
      return
    case 'diario':
      retangulo(p, -14, -17, 28, 34, 0xf2ecdc, 0x8b8270, 2, 2)
      traco(p, [-6, -17], [-6, 17], 0xc4574a, 1.5)
      traco(p, [-2, -8], [10, -8], 0x7a8aa3, 1.6)
      traco(p, [-2, -2], [10, -2], 0x7a8aa3, 1.6)
      traco(p, [-2, 4], [7, 4], 0x7a8aa3, 1.6)
      return
    case 'bilhete':
      poligono(p, [[-15, -14], [15, -14], [15, 8], [11, 11], [7, 8], [3, 11], [-1, 8], [-5, 11], [-9, 8], [-13, 11], [-15, 9]], 0xece0bd, 0x9a8a5e, 2)
      traco(p, [-9, -7], [9, -7], 0x8b7a55, 1.6)
      traco(p, [-9, -1], [5, -1], 0x8b7a55, 1.6)
      return
    case 'pergaminho':
      retangulo(p, -12, -14, 24, 28, 0xecdcb2, 0x9a7646, 2)
      retangulo(p, -16, -18, 32, 7, 0xc7a46a, 0x8a673a, 2, 3.5)
      retangulo(p, -16, 11, 32, 7, 0xc7a46a, 0x8a673a, 2, 3.5)
      return
    case 'imagem':
      retangulo(p, -15, -18, 30, 36, 0xd8ccb0, 0x8b8270, 2)
      p.g.poly([[-11, 12], [-4, 3], [1, 9], [5, 5], [11, 12]].flatMap(([x, y]) => emMundo(p, [x, y]))).fill({ color: 0x8b8270, alpha: p.alfa })
      bola(p, 6, -8, 3.5, 0x8b8270, null, 0)
      return
    case 'alfinete':
      poligono(p, [[-15, -17], [15, -17], [15, 19], [-15, 19]], 0xf1e8d2, 0x9a8e74, 2, GIRO_DO_ALFINETE)
      traco(p, [-9, -6], [9, -6], 0x8b7a60, 1.6, GIRO_DO_ALFINETE)
      traco(p, [-9, 0], [7, 0], 0x8b7a60, 1.6, GIRO_DO_ALFINETE)
      traco(p, [-9, 6], [9, 6], 0x8b7a60, 1.6, GIRO_DO_ALFINETE)
      traco(p, [-9, 12], [2, 12], 0x8b7a60, 1.6, GIRO_DO_ALFINETE)
      bola(p, 0, -15, 4, 0xd2483b, 0x8e2a22, 1.5)
      return
  }
}

/** Repinta todos os papéis do piso. `grid` = a casa do mapa, em px de mundo. */
export function drawDocumentos(g: Graphics, papeis: readonly PapelDesenhado[], grid: number): void {
  g.clear()
  const k = Math.max(grid, 1) / CASA_DO_DESENHO
  for (const papel of papeis) {
    const pincel: Pincel = { g, cx: papel.x, cy: papel.y, k, alfa: papel.apagado === true ? ALFA_DO_PEGO : 1 }
    if (papel.aceso === true) {
      g.circle(papel.x, papel.y, RAIO_DO_ANEL * k).stroke({ width: TRACO_DO_ANEL * k, color: COR_DO_ANEL, alpha: 0.95 })
    }
    sombra(pincel, papel.papel)
    desenharPapel(pincel, papel.papel)
  }
}

/** O alvo do toque no papel: o círculo que cobre o maior dos papéis (meia altura de 19 no desenho), com folga. */
const RAIO_DO_TOQUE = 21

/** O raio do toque no papel, em px de mundo, para a grade do mapa (o papel escala com ela). */
export function raioDoToqueNoPapel(grid: number): number {
  return (RAIO_DO_TOQUE * Math.max(grid, 1)) / CASA_DO_DESENHO
}
