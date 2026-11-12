/**
 * CORRENTE de cima com volume (lote 13 dos objetos novos, 11/11/2026, grupo
 * Templo e masmorra): a corrente pesada de masmorra largada no chão. Uma
 * PLACA de ferro chumbada no piso (o chumbo derramado em volta, quatro
 * parafusos) com um ARGOLÃO preso por um grampo; dele a CORRENTE grossa
 * serpenteia pelo chão até um anel de junção, de onde saem dois pedaços curtos
 * para um PAR DE GRILHÕES abertos. Ao lado, o CADEADO aberto (a alça solta e
 * virada para fora) e a CHAVE de latão caída.
 *
 * Os elos se leem como elos: um DEITADO (o oval vazado, de frente para cima),
 * o seguinte EM PÉ (de quina: a barra fina que entra no furo dos vizinhos e
 * passa por cima deles). Brilho nas pontas, onde um elo roça no outro, e
 * ferrugem nos lados. `elosAoLongo` e `texDoElo` servem também à corrente
 * curta da cela com grade.
 *
 * Rente ao chão como os ossos: na 3/4 (`alturaSolta` de 0,03 casa) a corrente
 * sobe um fio e fica como é vista de cima. Sem luz nem chama. Tudo sai do
 * menor lado da pegada (1 x 1 casa de partida); esticada, a corrente segue o
 * mesmo caminho, mais comprida, e ganha elos. Material: `metal` (a placa, o
 * argolão, a corrente, os grilhões e o cadeado); o chumbo e o latão da chave
 * são fixos.
 */
import { hash, limitar01, type Rgb } from '../../ruido'
import { anel, cadeia, capsula, elipse, elipseGirada, menos, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, ruido, texturaDaClasse, type CriarPeca, type MaterialDaPeca, type Peca, type Textura } from './motor'
import { G, type MontarMovel } from './contexto'

/** A corrente foi medida no tamanho de partida (1 casa, 28 px de meio lado): as medidas miúdas escalam por aqui. */
const MEIO_LADO_DE_PARTIDA = 0.5 * G

/** Um elo da corrente: a forma, se está deitado (o oval vazado) ou em pé (a barra de quina), o meio, o ângulo e o meio comprimento. */
export interface Elo {
  readonly forma: Forma
  readonly deitado: boolean
  readonly cx: number
  readonly cy: number
  readonly angulo: number
  readonly meio: number
}

/** O elo em frações do passo da corrente: o meio comprimento por fora, a meia largura e a grossura do arame. */
const MEIO_DO_ELO = 0.8
const LARGURA_DO_ELO = 0.47
const ARAME_DO_ELO = 0.25
/** O elo em pé fica um pouco mais grosso que o arame: o chanfro come a beira, e a 1x ele sumia. */
const GROSSURA_EM_PE = 0.62
/** Quantas amostras da curva por trecho entre dois pontos do caminho. */
const AMOSTRAS_POR_TRECHO = 24

/** O passo da corrente grossa e o dos pedaços curtos até os grilhões (px de partida). */
const PASSO_DA_CORRENTE = 4.3
const PASSO_CURTO = 3.5
/**
 * O caminho da corrente, em frações da meia pegada: sai do argolão (em cima à esquerda), desce pela esquerda,
 * cruza o meio por baixo e sobe até o anel de junção, à direita.
 */
const CAMINHO: readonly Ponto[] = [
  [-0.354, -0.296],
  [-0.31, -0.02],
  [-0.15, 0.24],
  [0.08, 0.25],
  [0.24, 0.13],
  [0.38, 0.16],
]
/** A placa e o argolão (frações da meia pegada) e as medidas deles (px de partida). */
const PLACA = { x: -0.52, y: -0.5, lado: 4.3, giro: 0.14 } as const
const ARGOLAO = { x: -0.42, y: -0.38, raio: 3.9, arame: 1.35 } as const
const RAIO_DO_CHUMBO = 6.3
/** Os parafusos da placa, um em cada canto (em frações do que vai do meio ao parafuso). */
const CANTOS_DA_PLACA: readonly Ponto[] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
]
/** Os grilhões: o meio de cada um (fração), o raio, o arame, para onde abre a boca e o meio ângulo dela. */
const GRILHOES: readonly (readonly [number, number, number])[] = [
  [0.3, 0.6, Math.PI / 2],
  [0.72, 0.26, 0],
]
const RAIO_DO_GRILHAO = 4.3
const ARAME_DO_GRILHAO = 1.45
const MEIA_BOCA = 0.62
const RAIO_DO_ANEL_DE_JUNCAO = 2.6
/** O cadeado aberto e a chave caída: o meio (fração) e o giro de cada um. */
const CADEADO = { x: -0.05, y: 0.66, giro: -0.22 } as const
const CHAVE = { x: -0.62, y: 0.5, giro: -0.62 } as const

/** O ferro: o tom, o brilho (o ferro velho; o novo é 0,42) e a ferrugem em cada peça. */
const BRILHO_DO_FERRO = 0.34
const BRILHO_DO_GASTO = 0.22
const FERRUGEM: Rgb = [0x7e, 0x5e, 0x4a]
/** O escuro em que o pixel escuro demais é levantado: o cinza quente do ferro (o piso padrão é a nogueira). */
const ESCURO_DO_FERRO: Rgb = [0x4a, 0x45, 0x41]
/** O chumbo derramado em volta da placa: cinza fosco, um pouco azulado. */
const CHUMBO: MaterialDaPeca = { classe: 'metal', rgb: [0x84, 0x85, 0x88] }
/** O latão da chave. */
const LATAO: MaterialDaPeca = { classe: 'metal', rgb: [0xb0, 0x8e, 0x56] }
/** O furo (do cadeado, das orelhas do grilhão). */
const FURO: MaterialDaPeca = { classe: 'liso', rgb: [0x2e, 0x2a, 0x27] }

const DO_METAL = texturaDaClasse('metal')

function catmull(a: number, b: number, c: number, d: number, t: number): number {
  const t2 = t * t
  return 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t2 * t)
}

/** A curva lisa (Catmull-Rom) que passa pelos pontos, `porTrecho` amostras por trecho. */
function curvaPelos(pontos: readonly Ponto[], porTrecho: number): Ponto[] {
  const n = pontos.length
  if (n < 2) return pontos.slice()
  const saida: Ponto[] = []
  for (let i = 0; i < n - 1; i += 1) {
    const p0 = pontos[Math.max(0, i - 1)]
    const p1 = pontos[i]
    const p2 = pontos[i + 1]
    const p3 = pontos[Math.min(n - 1, i + 2)]
    for (let j = 0; j < porTrecho; j += 1) {
      const t = j / porTrecho
      saida.push([catmull(p0[0], p1[0], p2[0], p3[0], t), catmull(p0[1], p1[1], p2[1], p3[1], t)])
    }
  }
  saida.push(pontos[n - 1])
  return saida
}

/**
 * Os elos ao longo do caminho (px), a cada `passo` px mais ou menos (o passo se ajusta para os elos cobrirem o
 * caminho inteiro), alternando deitado e em pé; o primeiro é deitado se `comecaDeitado`.
 */
export function elosAoLongo(caminho: readonly Ponto[], passo: number, comecaDeitado: boolean): Elo[] {
  const curva = curvaPelos(caminho, AMOSTRAS_POR_TRECHO)
  const acumulado: number[] = [0]
  for (let i = 1; i < curva.length; i += 1) {
    acumulado.push(acumulado[i - 1] + Math.hypot(curva[i][0] - curva[i - 1][0], curva[i][1] - curva[i - 1][1]))
  }
  const total = acumulado[acumulado.length - 1]
  const quantos = Math.max(1, Math.round(total / passo))
  const passoReal = total / quantos
  const a = MEIO_DO_ELO * passoReal
  const b = LARGURA_DO_ELO * passoReal
  const t = ARAME_DO_ELO * passoReal
  const elos: Elo[] = []
  let i = 0
  for (let j = 0; j < quantos; j += 1) {
    const s = (j + 0.5) * passoReal
    while (i < curva.length - 2 && acumulado[i + 1] < s) i += 1
    const [x0, y0] = curva[i]
    const [x1, y1] = curva[i + 1]
    const f = limitar01((s - acumulado[i]) / Math.max(1e-6, acumulado[i + 1] - acumulado[i]))
    const cx = x0 + (x1 - x0) * f
    const cy = y0 + (y1 - y0) * f
    const angulo = Math.atan2(y1 - y0, x1 - x0)
    const deitado = (j % 2 === 0) === comecaDeitado
    const ex = Math.cos(angulo) * (a - t * 0.5)
    const ey = Math.sin(angulo) * (a - t * 0.5)
    const forma = deitado
      ? menos(elipseGirada(cx, cy, a, b, angulo), elipseGirada(cx, cy, a - t, b - t, angulo))
      : capsula(cx - ex, cy - ey, cx + ex, cy + ey, t * GROSSURA_EM_PE)
    elos.push({ forma, deitado, cx, cy, angulo, meio: a })
  }
  return elos
}

/** Puxa a cor da peça para a ferrugem, `t` de 0 a 1. */
function enferrujar(s: Float32Array, t: number): void {
  s[0] += (FERRUGEM[0] - s[0]) * t
  s[1] += (FERRUGEM[1] - s[1]) * t
  s[2] += (FERRUGEM[2] - s[2]) * t
}

/** O elo: o metal, o brilho nas pontas (onde os elos roçam) e a ferrugem em manchas nos lados (`ferrugem` de 0 a 1). */
export function texDoElo(elo: Elo, ferrugem: number): Textura {
  const co = Math.cos(elo.angulo)
  const si = Math.sin(elo.angulo)
  return (u, v, x, y, p, s, escala) => {
    if (DO_METAL !== null) DO_METAL(u, v, x, y, p, s, escala)
    const ao = Math.abs(((x - elo.cx) * co + (y - elo.cy) * si) / elo.meio)
    // A ponta, onde um elo roça no outro, brilha; a dobra logo antes dela junta ferrugem.
    s[3] += limitar01((ao - 0.8) / 0.18) * BRILHO_DO_GASTO
    const mancha = limitar01((ruido(x * 0.55 + p.su, y * 0.55 + p.sv) + 0.35) * 1.5)
    enferrujar(s, mancha * limitar01(1 - Math.abs(ao - 0.62) / 0.3) * ferrugem)
  }
}

/** O ferro velho das peças grandes (a placa, os grilhões, o cadeado): o metal e a ferrugem em manchas. */
function texFerrugem(quanto: number): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (DO_METAL !== null) DO_METAL(u, v, x, y, p, s, escala)
    enferrujar(s, limitar01((ruido(x * 0.45 + p.su, y * 0.45 + p.sv) + 0.1) * 1.8) * quanto)
  }
}

/** O ponto (x, y) do desenho local, girado `angulo` e posto em (cx, cy). */
function posto(x: number, y: number, cx: number, cy: number, angulo: number): Ponto {
  const co = Math.cos(angulo)
  const si = Math.sin(angulo)
  return [cx + x * co - y * si, cy + x * si + y * co]
}

/** Um retângulo local de (x0, y0) a (x1, y1), girado e posto em (cx, cy). */
function retanguloPosto(x0: number, y0: number, x1: number, y1: number, cx: number, cy: number, angulo: number): Forma {
  return poligono([posto(x0, y0, cx, cy, angulo), posto(x1, y0, cx, cy, angulo), posto(x1, y1, cx, cy, angulo), posto(x0, y1, cx, cy, angulo)])
}

/** O grilhão aberto: o aro com a boca cortada para o lado `boca` (radianos). */
function grilhao(cx: number, cy: number, r: number, arame: number, boca: number): Forma {
  const aro = anel(cx, cy, r, r, r - arame, r - arame)
  const longe = r * 2.2
  const cunha = poligono([
    [cx, cy],
    [cx + Math.cos(boca - MEIA_BOCA) * longe, cy + Math.sin(boca - MEIA_BOCA) * longe],
    [cx + Math.cos(boca + MEIA_BOCA) * longe, cy + Math.sin(boca + MEIA_BOCA) * longe],
  ])
  return menos(aro, cunha)
}

/** A placa chumbada no chão, os parafusos e o argolão deitado (o grampo que o prende sai depois dos elos). */
function montarPlaca(P: CriarPeca, ferro: MaterialDaPeca, hw: number, hh: number, k: number, L: Peca[], sombra: (f: Forma, forca: number) => void): void {
  const px = PLACA.x * hw
  const py = PLACA.y * hh
  const chumbo = poligono(
    Array.from({ length: 11 }, (_, i): Ponto => {
      const a = (i / 11) * Math.PI * 2
      const r = (RAIO_DO_CHUMBO + 1.1 * hash(i, 3, 1331)) * k
      return [px + Math.cos(a) * r, py + Math.sin(a) * r * 0.92]
    }),
  )
  sombra(chumbo, 0.16)
  L.push(P(chumbo, CHUMBO, { tabua: 0, bisel: 1.6 * k, tom: 0.92, metal: 0.12, contorno: 0.2, semente: 13300 }))
  const lado = PLACA.lado * k
  const placa = retanguloPosto(-lado, -lado, lado, lado, px, py, PLACA.giro)
  sombra(placa, 0.3)
  L.push(P(placa, ferro, { tabua: 0, bisel: 1.1 * k, tom: 0.86, metal: BRILHO_DO_FERRO, contorno: 0.3, textura: texFerrugem(0.35), semente: 13301 }))
  CANTOS_DA_PLACA.forEach(([fx, fy], i) => {
    const [x, y] = posto(fx * 2.85 * k, fy * 2.85 * k, px, py, PLACA.giro)
    L.push(P(elipse(x, y, 0.9 * k, 0.9 * k), ferro, { tabua: 0, bisel: 0.9 * k, tom: 1.25, metal: 0.5, contorno: 0.24, semente: 13302 + i }))
  })
  const r = ARGOLAO.raio * k
  const argolao = anel(ARGOLAO.x * hw, ARGOLAO.y * hh, r, r, r - ARGOLAO.arame * k, r - ARGOLAO.arame * k)
  sombra(argolao, 0.32)
  L.push(P(argolao, ferro, { tabua: 0, bisel: ARGOLAO.arame * k * 0.55, tom: 1.02, metal: 0.45, contorno: 0.3, textura: texFerrugem(0.3), semente: 13306 }))
}

/** O cadeado aberto, deitado: o corpo, o buraco da chave e a alça solta, virada para fora. */
function montarCadeado(P: CriarPeca, ferro: MaterialDaPeca, cx: number, cy: number, k: number, L: Peca[], sombra: (f: Forma, forca: number) => void): void {
  const g = CADEADO.giro
  const corpo = retanguloPosto(-2.3 * k, -1.6 * k, 2.3 * k, 2.2 * k, cx, cy, g)
  const alca: Ponto[] = [posto(-1.25 * k, -1.3 * k, cx, cy, g)]
  for (let i = 0; i <= 8; i += 1) {
    const a = -(i / 8) * Math.PI
    alca.push(posto((-2.75 + Math.cos(a) * 1.5) * k, (-2.4 + Math.sin(a) * 1.5) * k, cx, cy, g))
  }
  alca.push(posto(-4.25 * k, -1.0 * k, cx, cy, g))
  const formaDaAlca = cadeia(alca, 0.55 * k)
  sombra(uniao(corpo, formaDaAlca), 0.32)
  L.push(P(formaDaAlca, ferro, { tabua: 0, bisel: 0.55 * k, tom: 1.15, metal: 0.5, contorno: 0.28, textura: texFerrugem(0.15), semente: 13340 }))
  L.push(P(corpo, ferro, { tabua: 0, bisel: 1.1 * k, tom: 0.9, metal: 0.4, contorno: 0.3, textura: texFerrugem(0.25), semente: 13341 }))
  const [bx, by] = posto(0, 0.3 * k, cx, cy, g)
  const [fx, fy] = posto(0, 1.3 * k, cx, cy, g)
  L.push(P(uniao(elipse(bx, by, 0.5 * k, 0.5 * k), capsula(bx, by, fx, fy, 0.26 * k)), FURO, { tabua: 0, bisel: 0, contorno: 0, semente: 13342 }))
}

/** A chave de latão caída: a argola, a haste e o palhetão de dois dentes. */
function montarChave(P: CriarPeca, cx: number, cy: number, k: number, L: Peca[], sombra: (f: Forma, forca: number) => void): void {
  const g = CHAVE.giro
  const argola = anel(cx, cy, 1.75 * k, 1.75 * k, 0.85 * k, 0.85 * k)
  const [h0x, h0y] = posto(1.55 * k, 0, cx, cy, g)
  const [h1x, h1y] = posto(7.4 * k, 0, cx, cy, g)
  const haste = capsula(h0x, h0y, h1x, h1y, 0.5 * k)
  const dentes = uniao(retanguloPosto(5.5 * k, 0.3 * k, 6.15 * k, 1.9 * k, cx, cy, g), retanguloPosto(6.65 * k, 0.3 * k, 7.3 * k, 1.6 * k, cx, cy, g))
  const chave = uniao(uniao(argola, haste), dentes)
  sombra(chave, 0.3)
  L.push(P(chave, LATAO, { tabua: 0, bisel: 0.5 * k, tom: 1, metal: 0.55, contorno: 0.28, semente: 13350 }))
}

export const montarCorrente: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const k = Math.min(hw, hh) / MEIO_LADO_DE_PARTIDA
  const ferro = c.m.metal
  const L = cena.partes
  cena.corDoPiso = ESCURO_DO_FERRO
  const sombra = (f: Forma, forca: number): void => {
    cena.sombras.push(contato(f, forca))
  }
  const em = ([fx, fy]: readonly [number, number]): Ponto => [fx * hw, fy * hh]

  montarPlaca(P, ferro, hw, hh, k, L, sombra)

  // ---------- a corrente grossa, o anel de junção e os dois pedaços curtos até os grilhões ----------
  const juncao = em(CAMINHO[CAMINHO.length - 1])
  const elos = elosAoLongo(CAMINHO.map(em), PASSO_DA_CORRENTE * k, false)
  const rGrilhao = RAIO_DO_GRILHAO * k
  const grilhoes = GRILHOES.map(([fx, fy, boca]) => {
    const [gx, gy] = em([fx, fy])
    const costas = boca + Math.PI
    const dobradica: Ponto = [gx + Math.cos(costas) * (rGrilhao + 0.2 * k), gy + Math.sin(costas) * (rGrilhao + 0.2 * k)]
    // O pedaço curto faz uma barriga para o lado, como corrente largada.
    const meio: Ponto = [(juncao[0] + dobradica[0]) / 2 + Math.sin(costas) * 0.9 * k, (juncao[1] + dobradica[1]) / 2 - Math.cos(costas) * 0.9 * k]
    elos.push(...elosAoLongo([juncao, meio, dobradica], PASSO_CURTO * k, false))
    return { gx, gy, boca, dobradica }
  })
  const rJuncao = RAIO_DO_ANEL_DE_JUNCAO * k
  const anelDeJuncao = anel(juncao[0], juncao[1], rJuncao, rJuncao, rJuncao - 1.1 * k, rJuncao - 1.1 * k)
  const deitados = elos.filter((e) => e.deitado)
  const emPe = elos.filter((e) => !e.deitado)
  deitados.forEach((e, i) => {
    sombra(e.forma, 0.3)
    L.push(P(e.forma, ferro, { tabua: 0, bisel: ARAME_DO_ELO * e.meio * 0.5, tom: 0.98, metal: 0.45, contorno: 0.3, textura: texDoElo(e, 0.85), semente: 13310 + i }))
  })
  sombra(anelDeJuncao, 0.3)
  L.push(P(anelDeJuncao, ferro, { tabua: 0, bisel: 0.6 * k, tom: 1.04, metal: 0.45, contorno: 0.3, textura: texFerrugem(0.3), semente: 13309 }))

  // ---------- os grilhões abertos: o aro, as orelhas da boca com o furo do pino e a dobradiça ----------
  grilhoes.forEach(({ gx, gy, boca, dobradica }, i) => {
    const aro = grilhao(gx, gy, rGrilhao, ARAME_DO_GRILHAO * k, boca)
    const meioDoArame = rGrilhao - ARAME_DO_GRILHAO * k * 0.5
    const orelhas = [boca - MEIA_BOCA + 0.1, boca + MEIA_BOCA - 0.1].map((a): Ponto => [gx + Math.cos(a) * meioDoArame, gy + Math.sin(a) * meioDoArame])
    const formaDasOrelhas = uniao(elipse(orelhas[0][0], orelhas[0][1], 1.2 * k, 1.2 * k), elipse(orelhas[1][0], orelhas[1][1], 1.2 * k, 1.2 * k))
    const junta = elipse(dobradica[0], dobradica[1], 1.25 * k, 1.25 * k)
    sombra(uniao(aro, formaDasOrelhas), 0.32)
    L.push(P(aro, ferro, { tabua: 0, bisel: ARAME_DO_GRILHAO * k * 0.6, tom: 0.96, metal: 0.42, contorno: 0.3, textura: texFerrugem(0.32), semente: 13320 + i * 4 }))
    L.push(P(formaDasOrelhas, ferro, { tabua: 0, bisel: 0.9 * k, tom: 1.06, metal: 0.42, contorno: 0.28, semente: 13321 + i * 4 }))
    L.push(P(uniao(elipse(orelhas[0][0], orelhas[0][1], 0.42 * k, 0.42 * k), elipse(orelhas[1][0], orelhas[1][1], 0.42 * k, 0.42 * k)), FURO, { tabua: 0, bisel: 0, contorno: 0, semente: 13322 + i * 4 }))
    L.push(P(junta, ferro, { tabua: 0, bisel: 1.1 * k, tom: 1.18, metal: 0.5, contorno: 0.28, semente: 13323 + i * 4 }))
  })

  // ---------- os elos em pé, por cima dos deitados (entram no furo deles), e o grampo do argolão ----------
  emPe.forEach((e, i) => {
    sombra(e.forma, 0.34)
    L.push(P(e.forma, ferro, { tabua: 0, bisel: ARAME_DO_ELO * e.meio * GROSSURA_EM_PE * 0.9, tom: 1.08, metal: 0.5, contorno: 0.3, textura: texDoElo(e, 0.7), semente: 13360 + i }))
  })
  const [px, py] = em([PLACA.x, PLACA.y])
  const [g0x, g0y] = posto(0, -1.7 * k, px, py, PLACA.giro + 0.75)
  const [g1x, g1y] = posto(0, 1.7 * k, px, py, PLACA.giro + 0.75)
  const grampo = capsula(g0x, g0y, g1x, g1y, 0.8 * k)
  sombra(grampo, 0.3)
  L.push(P(grampo, ferro, { tabua: 0, bisel: 0.8 * k, tom: 1.12, metal: 0.45, contorno: 0.3, semente: 13308 }))

  // ---------- ao lado: o cadeado aberto e a chave caída ----------
  const [cx, cy] = em([CADEADO.x, CADEADO.y])
  montarCadeado(P, ferro, cx, cy, k, L, sombra)
  const [kx, ky] = em([CHAVE.x, CHAVE.y])
  montarChave(P, kx, ky, k, L, sombra)
}
