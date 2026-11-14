/**
 * MESA DE NAVEGAÇÃO de cima com volume (lote L07 dos objetos de 14/11/2026, grupo Mar e piratas; pedido do
 * mestre: "mesa de navegação: cartas, compasso, bússola de vidro"). A mesa do piloto, de madeira escura, com a
 * GRADINHA em volta do tampo (a borda alta que segura as coisas quando o navio joga) e cantoneiras de latão.
 *
 * Em cima, aberta e um pouco torta, a CARTA NÁUTICA: papel velho com o fio da moldura, três ILHAS (a terra
 * cáqui, a linha da costa e o raso claro em volta), a ROSA DOS VENTOS no canto de baixo com as LINHAS DE RUMO
 * saindo dela para a carta toda, a ROTA pontilhada até o X vermelho e o canto de baixo à direita dobrado para
 * cima. Por cima da carta: a BÚSSOLA DE VIDRO no canto de cima à esquerda, segurando a carta (a caixa de latão,
 * o mostrador claro com as marcas, a agulha de ponta vermelha e o reflexo do vidro) e o COMPASSO de pontas
 * aberto em V (as pernas de latão, as pontas de aço e a cabeça com o parafuso). Atrás, na beira do tampo, uma
 * carta ENROLADA com a fita; à direita, o TINTEIRO com a pena.
 *
 * O que a separa da mesa de guerra (mapa com peças e bandeirinhas) e da escrivaninha: o papel grande e claro
 * com as linhas de rumo em estrela e os instrumentos de latão. A 1x sobram a carta clara com as manchas das
 * ilhas, o disco da bússola e o V do compasso.
 *
 * NA 3/4 é a mesa de sempre: o tampo sobe com tudo o que está em cima dele e as quatro pernas vão do chão até
 * ele (`tresQuartos.ts` deriva tudo pelas sombras). As coisas em cima do tampo têm o tamanho do menor lado
 * (1,5 x 1 casa de partida): a mesa esticada ganha tampo, não carta maior. Material: `madeira` (a nogueira, de
 * partida); o papel, a tinta, o latão, o vidro e a pena são fixos.
 */
import { anel, barra, capsula, caixa, cadeia, dentroDe, elipse, menos, poligono, type Forma, type Ponto } from './formas'
import { contato, ruido, texturaDaClasse, type MaterialDaPeca, type Peca, type Projecao, type Textura } from './motor'
import { G, materialDaPeca, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

// ---------- os materiais fixos ----------

const PAPEL: MaterialDaPeca = { classe: 'liso', rgb: [0xdd, 0xcf, 0xab] }
const AVESSO: MaterialDaPeca = { classe: 'liso', rgb: [0xe6, 0xdc, 0xc0] }
const TINTA: MaterialDaPeca = { classe: 'liso', rgb: [0x5a, 0x48, 0x38] }
const TERRA: MaterialDaPeca = { classe: 'liso', rgb: [0xb6, 0xa6, 0x76] }
const RASO: MaterialDaPeca = { classe: 'liso', rgb: [0xa8, 0xb2, 0xa2] }
const VERMELHO: MaterialDaPeca = { classe: 'liso', rgb: [0x9c, 0x46, 0x3a] }
const LATAO: MaterialDaPeca = materialDaPeca('latao')
const ACO: MaterialDaPeca = { classe: 'metal', rgb: [0x9a, 0x9c, 0x9e] }
const MOSTRADOR: MaterialDaPeca = { classe: 'liso', rgb: [0xe8, 0xe0, 0xca] }
const AGULHA_ESCURA: MaterialDaPeca = { classe: 'liso', rgb: [0x4c, 0x48, 0x46] }
const VIDRO: MaterialDaPeca = { classe: 'liso', rgb: [0xd4, 0xdc, 0xdc] }
const BRILHO: MaterialDaPeca = { classe: 'liso', rgb: [0xf4, 0xf2, 0xea] }
const TINTEIRO: MaterialDaPeca = { classe: 'liso', rgb: [0x3e, 0x46, 0x4c] }
const PENA: MaterialDaPeca = { classe: 'liso', rgb: [0xe2, 0xdc, 0xd0] }

// ---------- as medidas ----------

/** A pegada de partida, px do protótipo: as coisas em cima do tampo têm o tamanho de desenho nela. */
const LARGURA_DE_PARTIDA = 1.5 * G
const FUNDO_DE_PARTIDA = 1 * G
/** A altura do tampo, em casas, e a beirada que a 3/4 dá a ele (a perna para debaixo dela). */
const ALTURA_DO_TAMPO = 0.52
const BEIRADA_DO_TAMPO = 0.06 * G
/** O tampo: a sobra até a beira da pegada, a quina, as pranchas e a gradinha em volta. */
const FOLGA_DO_TAMPO = 0.6
const QUINA_DO_TAMPO = 1.4
const PRANCHAS = 4
const GRADINHA = 1.7
/** As pernas: o lado e o recuo da beira do tampo. */
const PERNA = 5.4
const RECUO_DA_PERNA = 2.2

/** A carta: o meio, as meias medidas e o giro (px de partida). */
const CARTA_X = -3.6
const CARTA_Y = 2
const CARTA_MX = 27
const CARTA_MY = 19
const GIRO_DA_CARTA = -0.045
/** O canto dobrado da carta (de baixo à direita): quanto a dobra corta de cada beira. */
const DOBRA = 5.4
/** As linhas de rumo: quantas, a grossura e a força. */
const RUMOS = 16
/** A rota pontilhada: os pontos da curva (no papel da carta) e o passo dos traços. */
const ROTA: readonly [Ponto, Ponto, Ponto] = [[-6.5, -2.5], [3, 11], [15.5, 4]]
const TRACOS_DA_ROTA = 11

/** A sombra que cada instrumento faz no papel. */
const SOMBRA_NA_CARTA: Projecao = { dist: 1.1, forca: 0.36, suave: 0.8 }

/** As ilhas, no papel da carta: o contorno (pontos em volta do meio, raio por ângulo). */
interface Ilha {
  readonly x: number
  readonly y: number
  readonly rx: number
  readonly ry: number
  readonly raios: readonly number[]
}

const ILHAS: readonly Ilha[] = [
  { x: -11, y: -6.5, rx: 9.5, ry: 6, raios: [1, 0.82, 1.05, 0.7, 0.95, 1.1, 0.78, 0.92, 1.04, 0.86] },
  { x: 14.5, y: -10, rx: 5.6, ry: 3.6, raios: [1, 1.08, 0.7, 0.95, 1.05, 0.8, 1] },
  { x: 7.5, y: 9.5, rx: 3.6, ry: 2.6, raios: [1, 0.85, 1.1, 0.9, 1.05, 0.8] },
]
/** A rosa dos ventos: o meio (no papel) e os raios das pontas grandes, das pequenas e do miolo. */
const ROSA: Ponto = [-17.5, 11]
const PONTA_GRANDE = 5.4
const PONTA_PEQUENA = 3
const MIOLO_DA_ROSA = 1.05

// ---------- texturas ----------

/** O tampo: o veio, a beira gasta clara e as manchas largas. */
function texDoTampo(tampo: Forma): Textura {
  const madeira = texturaDaClasse('madeira')
  return (u, v, x, y, p, s, escala) => {
    if (madeira !== null) madeira(u, v, x, y, p, s, escala)
    const t = -tampo.d(x, y)
    if (t < 1.6) s[3] += 0.1 * (1 - (t > 0 ? t : 0) / 1.6)
    s[3] += ruido(x * 0.08 + p.su, y * 0.1 + p.sv) * 0.1
  }
}

/** O papel da carta: manchas, grão e a beira mais escura. */
function texDoPapel(papel: Forma): Textura {
  return (_u, _v, x, y, p, s) => {
    const t = -papel.d(x, y)
    s[3] += ruido(x * 0.12 + p.su, y * 0.12 + p.sv) * 0.08 + ruido(x * 1.1, y * 1.1) * 0.025
    if (t < 2.4) s[3] -= 0.12 * (1 - Math.max(0, t) / 2.4)
  }
}

/** Muitas formas numa peça só: a distância é a da forma mais perto. */
function varias(lista: readonly Forma[]): Forma {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const f of lista) {
    x0 = Math.min(x0, f.b[0])
    y0 = Math.min(y0, f.b[1])
    x1 = Math.max(x1, f.b[2])
    y1 = Math.max(y1, f.b[3])
  }
  return {
    b: [x0, y0, x1, y1],
    d(x, y) {
      let menor = Infinity
      for (const f of lista) {
        const d = f.d(x, y)
        if (d < menor) menor = d
      }
      return menor
    },
  }
}

interface Mesa {
  readonly c: ContextoDoMovel
  readonly L: Peca[]
  readonly k: number
  /** O ponto do papel da carta (px de partida, meio da carta em 0) no px da pegada. */
  readonly naCarta: (u: number, v: number) => Ponto
}

// ---------- a mesa ----------

function montarTampo(m: Mesa, tampo: Forma): void {
  const { c, L, k } = m
  const P = c.peca
  const mad = c.m.madeira
  const [x0, y0, x1, y1] = tampo.b
  L.push(P(tampo, mad, { dx: 0.4 * k, dy: 1.2 * k, tabua: 0, bisel: 0.7, contorno: 0.2, tom: 0.6, semente: 7501 }))
  L.push(P(tampo, mad, { tabua: (y1 - y0) / PRANCHAS, bisel: 1.2, contorno: 0.12, tom: 0.98, textura: texDoTampo(tampo), semente: 7502 }))
  // A gradinha em volta, mais clara, com a sombra para dentro do tampo, e as cantoneiras de latão.
  const g = GRADINHA * k
  const dentro = caixa(x0 + g, y0 + g, x1 - g, y1 - g, 0.6 * k)
  L.push(P(menos(tampo, dentro), mad, { tabua: 0, bisel: 0.7 * k, contorno: 0.22, tom: 1.12, projeta: { dist: 0.9 * k, forca: 0.34, suave: 0.7 * k }, semente: 7503 }))
  const lado = 3.4 * k
  for (const [cx, cy, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]] as const) {
    const canto = poligono([[cx, cy], [cx + sx * lado, cy], [cx + sx * lado, cy + sy * g], [cx + sx * g, cy + sy * g], [cx + sx * g, cy + sy * lado], [cx, cy + sy * lado]])
    L.push(P(canto, LATAO, { bisel: 0.4 * k, contorno: 0.24, semente: 7504 }))
  }
}

/** A carta aberta: o papel com a dobra, a moldura, as ilhas, as linhas de rumo, a rosa e a rota. */
function montarCarta(m: Mesa): void {
  const { c, L, k, naCarta } = m
  const P = c.peca
  const papelDaCarta: Ponto[] = [
    naCarta(-CARTA_MX, -CARTA_MY),
    naCarta(CARTA_MX, -CARTA_MY),
    naCarta(CARTA_MX, CARTA_MY - DOBRA),
    naCarta(CARTA_MX - DOBRA, CARTA_MY),
    naCarta(-CARTA_MX, CARTA_MY),
  ]
  const papel = poligono(papelDaCarta)
  L.push(P(papel, PAPEL, { bisel: 0.5 * k, contorno: 0.16, tabua: 0, textura: texDoPapel(papel), projeta: { dist: 0.8 * k, forca: 0.3, suave: 0.8 * k }, semente: 7510 }))
  const retangulo = (u0: number, v0: number, u1: number, v1: number): Forma => poligono([naCarta(u0, v0), naCarta(u1, v0), naCarta(u1, v1), naCarta(u0, v1)])
  const miolo = retangulo(-CARTA_MX + 2.2, -CARTA_MY + 2.2, CARTA_MX - 2.2, CARTA_MY - 2.2)

  // O raso em volta de cada ilha e a terra com a linha da costa.
  const contornoDaIlha = (ilha: Ilha, cresce: number): Forma =>
    poligono(ilha.raios.map((r, i) => {
      const a = (i / ilha.raios.length) * Math.PI * 2
      return naCarta(ilha.x + Math.cos(a) * (ilha.rx * r + cresce), ilha.y + Math.sin(a) * (ilha.ry * r + cresce))
    }))
  ILHAS.forEach((ilha, i) => {
    L.push(P(contornoDaIlha(ilha, 1.6), RASO, { bisel: 0, contorno: 0, alfa: 0.55, suave: 0.8 * k, semente: 7511 + i }))
  })
  ILHAS.forEach((ilha, i) => {
    L.push(P(contornoDaIlha(ilha, 0), TERRA, { bisel: 0.3 * k, contorno: 0.5, tabua: 0, textura: texDoPapel(papel), semente: 7515 + i }))
  })

  // As linhas de rumo saindo da rosa, finas e claras, só dentro da moldura.
  const [rx, ry] = naCarta(ROSA[0], ROSA[1])
  const rumos: Forma[] = []
  for (let i = 0; i < RUMOS; i += 1) {
    const a = (i / RUMOS) * Math.PI * 2 + GIRO_DA_CARTA
    rumos.push(barra(rx, ry, rx + Math.cos(a) * 70 * k, ry + Math.sin(a) * 70 * k, 0.3 * k))
  }
  L.push(P(dentroDe(varias(rumos), miolo), TINTA, { bisel: 0, contorno: 0, alfa: 0.32, semente: 7520 }))
  // A moldura: o fio fino a 1,5 px da beira.
  L.push(P(menos(retangulo(-CARTA_MX + 1.5, -CARTA_MY + 1.5, CARTA_MX - 1.5, CARTA_MY - 1.5), retangulo(-CARTA_MX + 1.85, -CARTA_MY + 1.85, CARTA_MX - 1.85, CARTA_MY - 1.85)), TINTA, { bisel: 0, contorno: 0, alfa: 0.75, semente: 7521 }))

  // A rosa dos ventos: a estrela de oito pontas, o anel e o miolo claro.
  const estrela: Ponto[] = []
  for (let i = 0; i < 16; i += 1) {
    const a = (i / 16) * Math.PI * 2 - Math.PI / 2 + GIRO_DA_CARTA
    const r = i % 2 === 1 ? MIOLO_DA_ROSA : i % 4 === 0 ? PONTA_GRANDE : PONTA_PEQUENA
    estrela.push([rx + Math.cos(a) * r * k, ry + Math.sin(a) * r * k])
  }
  L.push(P(anel(rx, ry, 3.9 * k, 3.9 * k, 3.5 * k, 3.5 * k), TINTA, { bisel: 0, contorno: 0, alfa: 0.8, semente: 7522 }))
  L.push(P(poligono(estrela), TINTA, { bisel: 0.3 * k, contorno: 0, semente: 7523 }))
  L.push(P(elipse(rx, ry, 0.7 * k, 0.7 * k), PAPEL, { bisel: 0, contorno: 0, semente: 7524 }))
  // A ponta do norte em vermelho.
  const norte = -Math.PI / 2 + GIRO_DA_CARTA
  L.push(P(poligono([[rx + Math.cos(norte) * PONTA_GRANDE * k, ry + Math.sin(norte) * PONTA_GRANDE * k], [rx + Math.cos(norte + 0.38) * 1.2 * k, ry + Math.sin(norte + 0.38) * 1.2 * k], [rx + Math.cos(norte - 0.38) * 1.2 * k, ry + Math.sin(norte - 0.38) * 1.2 * k]]), VERMELHO, { bisel: 0, contorno: 0, semente: 7525 }))

  // A rota pontilhada até o X.
  const [a, b, d] = ROTA
  const tracos: Forma[] = []
  for (let i = 0; i < TRACOS_DA_ROTA; i += 1) {
    const ponto = (t: number): Ponto => naCarta((1 - t) * (1 - t) * a[0] + 2 * t * (1 - t) * b[0] + t * t * d[0], (1 - t) * (1 - t) * a[1] + 2 * t * (1 - t) * b[1] + t * t * d[1])
    const t0 = i / TRACOS_DA_ROTA
    tracos.push(capsula(...ponto(t0), ...ponto(t0 + 0.45 / TRACOS_DA_ROTA), 0.36 * k))
  }
  L.push(P(varias(tracos), VERMELHO, { bisel: 0, contorno: 0, alfa: 0.85, semente: 7526 }))
  const [xx, xy] = naCarta(d[0] + 2.2, d[1] - 0.4)
  const x = 1.4 * k
  L.push(P(varias([capsula(xx - x, xy - x, xx + x, xy + x, 0.45 * k), capsula(xx - x, xy + x, xx + x, xy - x, 0.45 * k)]), VERMELHO, { bisel: 0.2 * k, contorno: 0, semente: 7527 }))

  // O canto dobrado: o avesso do papel, refletido pela linha da dobra, com a sombra na carta.
  L.push(P(poligono([naCarta(CARTA_MX, CARTA_MY - DOBRA), naCarta(CARTA_MX - DOBRA, CARTA_MY), naCarta(CARTA_MX - DOBRA, CARTA_MY - DOBRA)]), AVESSO, { bisel: 0.4 * k, contorno: 0.2, projeta: SOMBRA_NA_CARTA, semente: 7528 }))
}

/** A bússola de vidro no canto de cima à esquerda da carta. */
function montarBussola(m: Mesa, cx: number, cy: number): void {
  const { c, L, k } = m
  const P = c.peca
  const R = 7 * k
  const r = 5.9 * k
  L.push(P(elipse(cx, cy, R, R), LATAO, { bisel: 1.4 * k, contorno: 0.3, projeta: { dist: 1.5 * k, forca: 0.4, suave: 1 * k }, semente: 7530 }))
  L.push(P(elipse(cx, cy, r, r), MOSTRADOR, { bisel: 0.5 * k, contorno: 0.24, recesso: { k: 1.6, forca: 0.3 }, semente: 7531 }))
  // As marcas do mostrador: as quatro grandes e as quatro pequenas, e o anel de dentro.
  const marcas: Forma[] = []
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2
    const dentro = i % 2 === 0 ? 3.6 : 4.4
    marcas.push(barra(cx + Math.cos(a) * dentro * k, cy + Math.sin(a) * dentro * k, cx + Math.cos(a) * 5.2 * k, cy + Math.sin(a) * 5.2 * k, (i % 2 === 0 ? 0.55 : 0.35) * k))
  }
  L.push(P(varias(marcas), TINTA, { bisel: 0, contorno: 0, alfa: 0.85, semente: 7532 }))
  L.push(P(anel(cx, cy, 3.1 * k, 3.1 * k, 2.8 * k, 2.8 * k), TINTA, { bisel: 0, contorno: 0, alfa: 0.6, semente: 7533 }))
  // A agulha, um losango comprido: a metade do norte vermelha, a outra escura; o pino de latão no meio.
  const rumo = -Math.PI / 2 + 0.32
  const [ex, ey] = [Math.cos(rumo), Math.sin(rumo)]
  const [nx, ny] = [-ey, ex]
  const ponta = (s: number, lado: number): Ponto => [cx + (ex * s + nx * lado) * k, cy + (ey * s + ny * lado) * k]
  L.push(P(poligono([ponta(4.8, 0), ponta(0, 0.95), ponta(0, -0.95)]), VERMELHO, { bisel: 0.3 * k, contorno: 0.24, projeta: { dist: 0.6 * k, forca: 0.3, suave: 0.4 * k }, semente: 7534 }))
  L.push(P(poligono([ponta(-4.8, 0), ponta(0, 0.95), ponta(0, -0.95)]), AGULHA_ESCURA, { bisel: 0.3 * k, contorno: 0.24, projeta: { dist: 0.6 * k, forca: 0.3, suave: 0.4 * k }, semente: 7535 }))
  L.push(P(elipse(cx, cy, 0.75 * k, 0.75 * k), LATAO, { bisel: 0.5 * k, contorno: 0.2, semente: 7536 }))
  // O vidro por cima: um véu claro e o reflexo em meia-lua, para cima à esquerda.
  L.push(P(elipse(cx, cy, r, r), VIDRO, { bisel: 0, contorno: 0, alfa: 0.16, semente: 7537 }))
  L.push(P(dentroDe(menos(elipse(cx, cy, r * 0.9, r * 0.9), elipse(cx + 1.2 * k, cy + 1.2 * k, r * 0.86, r * 0.86)), elipse(cx, cy, r, r)), BRILHO, { bisel: 0, contorno: 0, alfa: 0.55, suave: 0.4 * k }))
}

/** O compasso de pontas, aberto em V: a cabeça com o parafuso, as pernas de latão e as pontas de aço. */
function montarCompasso(m: Mesa, cx: number, cy: number): void {
  const { c, L, k } = m
  const P = c.peca
  const pes: readonly Ponto[] = [[-4.6, 15.6], [6.6, 14.6]]
  for (const [i, [px, py]] of pes.entries()) {
    const l = Math.hypot(px, py)
    const [nx, ny] = [-py / l, px / l]
    const joelho = 0.72
    const perna = poligono([
      [cx + nx * 0.95 * k, cy + ny * 0.95 * k],
      [cx + (px * joelho + nx * 0.55) * k, cy + (py * joelho + ny * 0.55) * k],
      [cx + (px * joelho - nx * 0.55) * k, cy + (py * joelho - ny * 0.55) * k],
      [cx - nx * 0.95 * k, cy - ny * 0.95 * k],
    ])
    const pontaDeAco = poligono([
      [cx + (px * joelho + nx * 0.5) * k, cy + (py * joelho + ny * 0.5) * k],
      [cx + px * k, cy + py * k],
      [cx + (px * joelho - nx * 0.5) * k, cy + (py * joelho - ny * 0.5) * k],
    ])
    L.push(P(pontaDeAco, ACO, { bisel: 0.3 * k, contorno: 0.28, projeta: SOMBRA_NA_CARTA, semente: 7540 + i }))
    L.push(P(perna, LATAO, { bisel: 0.45 * k, contorno: 0.28, projeta: SOMBRA_NA_CARTA, semente: 7542 + i }))
  }
  L.push(P(capsula(cx, cy, cx + 0.6 * k, cy - 3 * k, 0.75 * k), LATAO, { bisel: 0.4 * k, contorno: 0.28, projeta: SOMBRA_NA_CARTA, semente: 7544 }))
  L.push(P(elipse(cx, cy, 1.7 * k, 1.7 * k), LATAO, { bisel: 0.7 * k, contorno: 0.3, projeta: SOMBRA_NA_CARTA, semente: 7545 }))
  L.push(P(capsula(cx - 0.8 * k, cy, cx + 0.8 * k, cy, 0.22 * k), TINTA, { bisel: 0, contorno: 0, alfa: 0.7 }))
}

/** A carta enrolada atrás, na beira do tampo, com a ponta mostrando a espiral do papel e a fita. */
function montarCartaEnrolada(m: Mesa, x0: number, x1: number, y: number): void {
  const { c, L, k } = m
  const P = c.peca
  const r = 2.5 * k
  L.push(P(capsula(x0, y, x1, y, r), PAPEL, { tabua: 0, bisel: 1.6 * k, contorno: 0.24, eixo: 0, curvaY: { c: y, r, forca: 0.5 }, projeta: { dist: 1.2 * k, forca: 0.36, suave: 0.9 * k }, semente: 7550 }))
  const pontas: Ponto[] = []
  for (let t = 0; t <= Math.PI * 5; t += 0.3) {
    const raio = (0.25 + (t / (Math.PI * 5)) * 0.75) * r * 0.9
    pontas.push([x1 + 0.4 * k + Math.cos(t) * raio * 0.38, y + Math.sin(t) * raio])
  }
  L.push(P(cadeia(pontas, 0.18 * k), TINTA, { bisel: 0, contorno: 0, alfa: 0.45 }))
  const meio = (x0 + x1) / 2
  L.push(P(caixa(meio - 0.9 * k, y - r - 0.3 * k, meio + 0.9 * k, y + r + 0.3 * k, 0.4 * k), VERMELHO, { bisel: 0.5 * k, contorno: 0.26, eixo: QUARTO, semente: 7551 }))
}

/** O tinteiro de vidro escuro, a tampa de latão e a pena encostada. */
function montarTinteiro(m: Mesa, cx: number, cy: number): void {
  const { c, L, k } = m
  const P = c.peca
  L.push(P(elipse(cx, cy, 3.2 * k, 3.2 * k), TINTEIRO, { bisel: 1.2 * k, contorno: 0.3, projeta: { dist: 1.2 * k, forca: 0.36, suave: 0.8 * k }, semente: 7560 }))
  L.push(P(anel(cx, cy, 1.7 * k, 1.7 * k, 1 * k, 1 * k), LATAO, { bisel: 0.4 * k, contorno: 0.24, semente: 7561 }))
  L.push(P(elipse(cx, cy, 1 * k, 1 * k), { classe: 'liso', rgb: [0x2e, 0x2a, 0x2a] }, { bisel: 0, contorno: 0, alfa: 0.9 }))
  L.push(P(elipse(cx - 1.2 * k, cy - 1.3 * k, 0.8 * k, 0.5 * k), BRILHO, { bisel: 0, contorno: 0, alfa: 0.5, suave: 0.3 * k }))
  // A pena: sai do tinteiro e deita para cima à direita.
  const [ax, ay] = [cx + 0.2 * k, cy - 0.4 * k]
  const [bx, by] = [cx + 4.4 * k, cy - 14 * k]
  const l = Math.hypot(bx - ax, by - ay)
  const [nx, ny] = [-(by - ay) / l, (bx - ax) / l]
  const ao = (t: number, lado: number): Ponto => [ax + (bx - ax) * t + nx * lado * k, ay + (by - ay) * t + ny * lado * k]
  L.push(P(poligono([ao(0.18, 0), ao(0.35, 1.3), ao(0.7, 1.6), ao(1, 0.2), ao(0.75, -1), ao(0.4, -0.9)]), PENA, { bisel: 0.5 * k, contorno: 0.22, projeta: SOMBRA_NA_CARTA, semente: 7562 }))
  L.push(P(capsula(...ao(0, 0), ...ao(0.98, 0.1), 0.22 * k), TINTA, { bisel: 0, contorno: 0, alfa: 0.5 }))
}

export const montarMesaDeNavegacao: MontarMovel = (c, cena) => {
  const { hw, hh, g } = c
  const k = Math.min(c.w / LARGURA_DE_PARTIDA, c.h / FUNDO_DE_PARTIDA)
  const co = Math.cos(GIRO_DA_CARTA)
  const si = Math.sin(GIRO_DA_CARTA)
  const naCarta = (u: number, v: number): Ponto => [(CARTA_X + u * co - v * si) * k, (CARTA_Y + u * si + v * co) * k]
  const m: Mesa = { c, L: cena.partes, k, naCarta }
  const zTampo = g * ALTURA_DO_TAMPO
  const tampo = caixa(-hw + FOLGA_DO_TAMPO, -hh + FOLGA_DO_TAMPO, hw - FOLGA_DO_TAMPO, hh - FOLGA_DO_TAMPO, QUINA_DO_TAMPO * k)

  // A sombra de baixo (pesada, em volta do tampo), a do tampo (solta, mais clara) e a de cada perna.
  const alem = 1.3 * k
  cena.sombras.push(
    { forma: caixa(tampo.b[0] - alem, tampo.b[1] - alem, tampo.b[2] + alem, tampo.b[3] + alem, QUINA_DO_TAMPO * k + alem), z: 0, suave: alem, forca: 0.36 },
    { forma: tampo, z: zTampo, solta: true, suave: 1.8, forca: 0.24 },
  )
  const lado = PERNA * k
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const x = sx < 0 ? tampo.b[0] + RECUO_DA_PERNA * k : tampo.b[2] - RECUO_DA_PERNA * k - lado
      const y = sy < 0 ? tampo.b[1] + RECUO_DA_PERNA * k : tampo.b[3] - RECUO_DA_PERNA * k - lado
      const perna = caixa(x, y, x + lado, y + lado, 0.32 * lado)
      cena.sombras.push({ forma: perna, z: zTampo - BEIRADA_DO_TAMPO, suave: 0.9, forca: 0.3 }, contato(perna, 0.34))
    }
  }

  montarTampo(m, tampo)
  montarCartaEnrolada(m, 6 * k, 30 * k, -22.2 * k)
  montarCarta(m)
  montarTinteiro(m, 34.2 * k, 9 * k)
  montarCompasso(m, 6.2 * k, -12.4 * k)
  montarBussola(m, ...naCarta(-24.6, -14.6))
}
