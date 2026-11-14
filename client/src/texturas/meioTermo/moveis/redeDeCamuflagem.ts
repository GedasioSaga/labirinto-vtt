/**
 * REDE DE CAMUFLAGEM esticada em estacas, de cima com volume (L06 dos objetos
 * novos, 14/11/2026, grupo Base militar). A rede grande, no alto, cobrindo o
 * que está embaixo: seis VARAS (quatro nos cantos e duas no meio dos lados
 * compridos) seguram a beira, e uma vara mais alta no MEIO levanta o pano em
 * bico; entre uma vara e outra a beira cede para dentro. O pano é a malha de
 * corda coberta de RETALHOS (as tiras recortadas em folha), em manchas de
 * verde-escuro, oliva, marrom e areia; perto da beira os retalhos rareiam e a
 * MALHA aparece, com os furos deixando ver o chão. Os panos descem das varas
 * em cone: o lado virado para a luz é claro, o de trás, escuro. Cada vara da
 * beira tem o ESTAI de corda até a estaca no chão.
 *
 * A 25% de zoom sobra a mancha grande e rajada de verdes e marrons com a beira
 * esfarrapada e furada e os estais nos cantos: é o que diz "rede de
 * camuflagem" e não "tenda" (pano liso, de uma cor só) nem "sebe".
 *
 * NA 3/4: a rede é um tampo solto no ar (a sombra dela cai longe) e cada vara,
 * uma coluna da mesma altura; os estais e as estacas ficam no chão. O desenho
 * não lê `c.giro`: o claro dos panos gira com o objeto.
 *
 * Material: `madeira` (as varas e as estacas; o pinho de partida). A rede e a
 * corda são fixas. As medidas saem de frações da pegada (3 x 2 casas de
 * partida): esticada, a rede estica junto.
 */
import { hash, type Rgb } from '../../ruido'
import { capsula, elipse, poligono, type Forma, type Ponto } from './formas'
import { contato, PISO_DA_FOLHA, ruido, SOMBRA_X, SOMBRA_Y, TOM_DA_CORDA, type MaterialDaPeca, type Textura } from './motor'
import { G, type MontarMovel } from './contexto'

// ---------- as medidas, em frações da meia pegada ----------

/** As varas da beira (os cantos e o meio dos lados compridos), em volta, e onde fica a estaca de cada uma. */
const VARAS_DA_BEIRA: readonly { readonly vara: Ponto; readonly estaca: Ponto }[] = [
  { vara: [-0.84, -0.78], estaca: [-0.97, -0.96] },
  { vara: [0, -0.8], estaca: [0.04, -0.98] },
  { vara: [0.84, -0.78], estaca: [0.97, -0.96] },
  { vara: [0.84, 0.78], estaca: [0.97, 0.96] },
  { vara: [0, 0.8], estaca: [-0.04, 0.98] },
  { vara: [-0.84, 0.78], estaca: [-0.97, 0.96] },
]
/** Quanto a beira cede para dentro entre duas varas, em fração do vão. */
const BARRIGA_DA_BEIRA = 0.09
/** Pontos por vão da beira e o quanto cada um tremula (px do protótipo): a beira esfarrapada. */
const PONTOS_POR_VAO = 10
const TREMOR_DA_BEIRA = 1.6
/** A grade das distâncias da beira (px do protótipo): o passo e a folga em volta, que cobre o borrão da sombra solta. */
const PASSO_DA_GRADE = 0.5
const FOLGA_DA_GRADE = 16
/** A vara do meio, um pouco fora do centro, que levanta o bico. */
const VARA_DO_MEIO: Ponto = [0.04, -0.02]

/** Alturas (px do protótipo): o bico e a beira acima da altura média da rede, e o raio de cada cone de pano. */
const SOBRA_DO_BICO = 20
const SOBRA_DA_BEIRA = 8
const RAIO_DO_CONE_DO_BICO = 95
const RAIO_DO_CONE_DA_BEIRA = 48
/** Quanto o declive do pano clareia ou escurece. */
const FORCA_DO_DECLIVE = 1.5

/** Altura da rede (casas) e a grossura do pano na 3/4. */
const ALTURA_DA_REDE = 1.1
export const ESPESSURA_DA_REDE_DE_CAMUFLAGEM = 0.03 * G

/** A malha (px do protótipo): o passo dos losangos e o quanto da casa o furo ocupa; a faixa da beira onde ela aparece. */
const PASSO_DA_MALHA = 3.2
const FURO_DA_MALHA = 0.3
const FAIXA_DA_MALHA = 9
/** Os retalhos: largura e altura de cada um (px do protótipo). */
const LARGURA_DO_RETALHO = 3.6
const ALTURA_DO_RETALHO = 2.6
/** O giro das fileiras de retalhos (~34 graus). */
const COS_DOS_RETALHOS = Math.cos(0.6)
const SEN_DOS_RETALHOS = Math.sin(0.6)

/** Raios (px do protótipo): a ponta da vara sob a rede, a corda do estai e a estaca. */
const RAIO_DA_VARA = 2.2
const RAIO_DO_ESTAI = 0.55
const RAIO_DA_ESTACA = 1.5

// ---------- as cores (fixas) ----------

const VERDE_ESCURO: Rgb = [0x45, 0x50, 0x37]
const OLIVA: Rgb = [0x6c, 0x70, 0x4b]
const MARROM: Rgb = [0x6a, 0x56, 0x3e]
const AREIA: Rgb = [0x98, 0x8c, 0x68]
/** A corda da malha, à mostra na beira. */
const CORDA_DA_MALHA: Rgb = [0x5a, 0x55, 0x40]
const REDE: MaterialDaPeca = { classe: 'liso', rgb: OLIVA }
const CORDA: MaterialDaPeca = { classe: 'corda', rgb: TOM_DA_CORDA }

// ---------- a luz do motor (de cima à esquerda) ----------

const LUZ_X = -0.62
const LUZ_Y = -0.48
const LUZ_Z = 0.62

/** O pano: as manchas, os retalhos, a malha furada na beira e o claro do declive de cada cone. */
function texDaRede(forma: Forma, varas: readonly (readonly [number, number, number, number])[]): Textura {
  return (_u, _v, x, y, _p, s) => {
    // As manchas, em duas escalas, cada cor no seu limiar.
    const a = ruido(x * 0.042 + 13, y * 0.042) + 0.5 * ruido(x * 0.11 + 3, y * 0.11 + 9)
    const b = ruido(x * 0.048 + 71, y * 0.048 + 37) + 0.5 * ruido(x * 0.12 + 40, y * 0.12 + 5)
    const cor = a > 0.14 ? VERDE_ESCURO : b > 0.12 ? MARROM : a < -0.2 ? AREIA : OLIVA
    s[0] = cor[0]
    s[1] = cor[1]
    s[2] = cor[2]
    // Os retalhos em fileiras tortas (a grade girada e entortada pelo ruído, cada fileira deslocada por sorteio):
    // em fileira reta e desencontrada de meio em meio eles liam como tijolo. A sombrinha fica só no bico do retalho.
    const wx = x + ruido(x * 0.15 + 7, y * 0.15) * 3
    const wy = y + ruido(x * 0.15, y * 0.15 + 11) * 3
    const ru = wx * COS_DOS_RETALHOS + wy * SEN_DOS_RETALHOS
    const rv = -wx * SEN_DOS_RETALHOS + wy * COS_DOS_RETALHOS
    const fila = Math.floor(rv / ALTURA_DO_RETALHO)
    const desloca = hash(fila, 0, 2906)
    const ao = ru / LARGURA_DO_RETALHO + desloca
    const col = Math.floor(ao)
    const fx = ao - col
    const fy = rv / ALTURA_DO_RETALHO - fila
    let luz = (hash(col, fila, 2901) - 0.5) * 0.2 + ruido(x * 0.2 + 5, y * 0.2) * 0.08
    const bico = fy - 0.6 - 0.5 * Math.abs(fx - 0.5)
    if (bico > 0) luz -= 0.16 * Math.min(1, bico / 0.3)
    // O declive: o cone mais alto no ponto manda (o pano desce de cada vara).
    let topo = -Infinity
    let gx = 0
    let gy = 0
    for (const [vx, vy, h, raio] of varas) {
      const d = Math.hypot(x - vx, y - vy) || 1e-6
      const z = h * (1 - d / raio)
      if (z <= topo) continue
      topo = z
      gx = (-h / raio) * ((x - vx) / d)
      gy = (-h / raio) * ((y - vy) / d)
    }
    const n = Math.sqrt(gx * gx + gy * gy + 1)
    luz += FORCA_DO_DECLIVE * ((-gx * LUZ_X - gy * LUZ_Y + LUZ_Z) / n - LUZ_Z)
    // Perto da beira os retalhos rareiam: aparece a corda da malha e os furos deixam ver o chão.
    const ateABeira = -forma.d(x, y)
    if (ateABeira < FAIXA_DA_MALHA) {
      const t = 1 - Math.max(0, ateABeira) / FAIXA_DA_MALHA
      const ma = (x + y) / PASSO_DA_MALHA
      const mb = (x - y) / PASSO_DA_MALHA
      const ia = Math.floor(ma)
      const ib = Math.floor(mb)
      const furo = Math.abs(ma - ia - 0.5) < FURO_DA_MALHA && Math.abs(mb - ib - 0.5) < FURO_DA_MALHA
      if (furo && hash(ia, ib, 2903) < t * 1.25) s[5] = 0
      const semRetalho = hash(ia, ib, 2904) < t * 0.9
      if (semRetalho) {
        s[0] = CORDA_DA_MALHA[0]
        s[1] = CORDA_DA_MALHA[1]
        s[2] = CORDA_DA_MALHA[2]
        luz -= 0.05
      }
    }
    s[3] += luz
  }
}

/**
 * A forma lida de uma GRADE de distâncias feita uma vez (bilinear, de `passo` em `passo` px, com `folga` em
 * volta): a beira da rede tem dezenas de lados, e o motor lê a distância por pixel na peça, na textura, na
 * sombra solta e na beirada da 3/4 (a rede de 3 x 2 levava 1,3 s no portão). Fora da grade, a conta exata.
 */
function formaEmGrade(forma: Forma, passo: number, folga: number): Forma {
  const x0 = forma.b[0] - folga
  const y0 = forma.b[1] - folga
  const nx = Math.ceil((forma.b[2] + folga - x0) / passo) + 1
  const ny = Math.ceil((forma.b[3] + folga - y0) / passo) + 1
  const grade = new Float32Array(nx * ny)
  for (let j = 0; j < ny; j += 1) {
    for (let i = 0; i < nx; i += 1) grade[j * nx + i] = forma.d(x0 + i * passo, y0 + j * passo)
  }
  return {
    b: forma.b,
    d(x, y) {
      const fx = (x - x0) / passo
      const fy = (y - y0) / passo
      const i = Math.floor(fx)
      const j = Math.floor(fy)
      if (i < 0 || j < 0 || i >= nx - 1 || j >= ny - 1) return forma.d(x, y)
      const tx = fx - i
      const ty = fy - j
      const o = j * nx + i
      const a = grade[o]
      const b = grade[o + 1]
      const c = grade[o + nx]
      const e = grade[o + nx + 1]
      return a + (b - a) * tx + (c - a) * ty + (a - b - c + e) * tx * ty
    },
  }
}

/** A beira da rede: de vara em vara, cedendo para dentro no meio do vão, com o tremor dos retalhos soltos. */
function contornoDaRede(varas: readonly Ponto[]): Ponto[] {
  const pontos: Ponto[] = []
  varas.forEach(([ax, ay], i) => {
    const [bx, by] = varas[(i + 1) % varas.length]
    const comprimento = Math.hypot(bx - ax, by - ay)
    // A normal do vão aponta para fora (as varas vão no sentido do relógio na tela): tirar dela leva para dentro.
    const nx = (by - ay) / comprimento
    const ny = -(bx - ax) / comprimento
    for (let k = 0; k < PONTOS_POR_VAO; k += 1) {
      const t = k / PONTOS_POR_VAO
      const barriga = BARRIGA_DA_BEIRA * comprimento * Math.sin(Math.PI * t)
      const tremor = k === 0 ? 0 : (hash(i, k, 2905) - 0.5) * 2 * TREMOR_DA_BEIRA
      pontos.push([ax + (bx - ax) * t - nx * (barriga + tremor), ay + (by - ay) * t - ny * (barriga + tremor)])
    }
  })
  return pontos
}

export const montarRedeDeCamuflagem: MontarMovel = (c, cena) => {
  const P = c.peca
  const L = cena.partes
  const mad = c.m.madeira
  // O escuro da folha da sebe: com a nogueira as dobras amarronzavam (e um verde mais escuro que ele caía abaixo do piso).
  cena.corDoPiso = PISO_DA_FOLHA
  const noMapa = ([fx, fy]: Ponto): Ponto => [fx * c.hw, fy * c.hh]
  const varas = VARAS_DA_BEIRA.map((v) => noMapa(v.vara))
  const meio = noMapa(VARA_DO_MEIO)
  const rede = formaEmGrade(poligono(contornoDaRede(varas)), PASSO_DA_GRADE, FOLGA_DA_GRADE)
  const zRede = ALTURA_DA_REDE * G
  const [ox, oy] = [SOMBRA_X * zRede, SOMBRA_Y * zRede]

  // ---------- as sombras: a rede no ar e as varas, colunas da mesma altura ----------
  cena.sombras.push({ forma: rede, z: zRede, solta: true, forca: 0.3 })
  for (const [vx, vy] of [...varas, meio]) cena.sombras.push({ forma: elipse(vx, vy, RAIO_DA_VARA * 0.7, RAIO_DA_VARA * 0.7), z: zRede, forca: 0.3 })

  // ---------- no chão: os estais e as estacas ----------
  VARAS_DA_BEIRA.forEach(({ estaca }, i) => {
    const [vx, vy] = varas[i]
    const [ex, ey] = noMapa(estaca)
    const estai = capsula(ex, ey, vx, vy, RAIO_DO_ESTAI)
    // A sombra do estai sobe da estaca até a sombra da ponta da vara.
    cena.sombras.push({ forma: capsula(ex, ey, vx + ox, vy + oy, RAIO_DO_ESTAI * 1.2), z: 0, suave: 1.2, forca: 0.22 })
    cena.sombras.push(contato(elipse(ex, ey, RAIO_DA_ESTACA, RAIO_DA_ESTACA), 0.32))
    L.push(P(estai, CORDA, { tabua: 0, bisel: RAIO_DO_ESTAI, contorno: 0.28, semente: 29001 + i }))
    L.push(P(elipse(ex, ey, RAIO_DA_ESTACA, RAIO_DA_ESTACA), mad, { tabua: 0, bisel: RAIO_DA_ESTACA * 0.8, tom: 1.05, contorno: 0.3, polar: { cx: ex, cy: ey, r: RAIO_DA_ESTACA }, semente: 29010 + i }))
  })

  // ---------- a rede, com a ponta de cada vara por cima, onde ela levanta o pano ----------
  const conesDasVaras = [
    ...varas.map(([vx, vy]): readonly [number, number, number, number] => [vx, vy, SOBRA_DA_BEIRA, RAIO_DO_CONE_DA_BEIRA]),
    [meio[0], meio[1], SOBRA_DO_BICO, RAIO_DO_CONE_DO_BICO] as const,
  ]
  L.push(P(rede, REDE, { tabua: 0, bisel: 0.8, contorno: 0.24, textura: texDaRede(rede, conesDasVaras), semente: 29020 }))
  ;[...varas, meio].forEach(([vx, vy], i) => {
    L.push(P(elipse(vx, vy, RAIO_DA_VARA, RAIO_DA_VARA), mad, { tabua: 0, bisel: RAIO_DA_VARA * 0.9, tom: 0.92, contorno: 0.3, polar: { cx: vx, cy: vy, r: RAIO_DA_VARA }, semente: 29030 + i, projeta: { dist: 1.2, forca: 0.32 } }))
  })
}
