/**
 * BRASEIRO COM FERROS DE MARCAR de cima com volume (lote L03 de 24/11/2026,
 * Tortura e fogo; versão do Braseiro, desenho ORIGINAL): a bacia do carrasco.
 * Um TACHO baixo e bojudo de ferro batido, de borda chata rebitada e escura de
 * fuligem, sobre três pés curtos, com duas ARGOLAS de carregar; dentro, o
 * carvão em BRASA VIVA; e, enfiados nele, TRÊS FERROS DE MARCAR: a haste de
 * ferro que entra em brasa (vermelha perto do fogo, escura para fora), a
 * marca na ponta (uma argola, uma cruz e um triângulo, acesos) e o PUNHO de
 * madeira com a virola, apoiado na borda e sobrando para fora.
 *
 * É o que o separa do Braseiro (a bacia alta no tripé, só brasa): este é
 * baixo, sem tripé, e os três punhos em leque dizem para que serve. A brasa é
 * parada, sem chama: não entra na disposição do fogo de casa
 * (`lib/mobilia/fogoDeCasa.ts`). O brilho do desenho é contido; quem ilumina é
 * a entrada em `LUZ_DOS_OBJETOS` (laranja).
 *
 * NA 3/4 é derivado (`tresQuartos.ts`): o tacho é uma coluna (`ALTURA` casa)
 * e tudo o que está na boca sobe com ele; os ferros têm a caixa centrada no
 * meio do tacho, para subir junto e ficar com os punhos no ar, por cima da
 * borda; os pés ficam no chão. A sombra dos punhos é pintada no chão já longe
 * deles (como a bacia do Braseiro), para não virar estrutura. Nada lê o giro.
 *
 * A 25% de zoom sobram o anel escuro com o miolo quente e os três riscos dos
 * punhos saindo para baixo à direita. Material: `metal` (o tacho e as hastes).
 * A madeira dos punhos, o carvão e o fogo são fixos. Tudo sai do menor lado da
 * pegada (1 x 1 casa de partida).
 */
import { hash, limitar01, misturar, type Rgb } from '../../ruido'
import { anel, barra, capsula, elipse, menos, poligono, uniao, type Forma, type Ponto } from './formas'
import { bordaDaSombra, contato, ruido, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type MaterialDaPeca, type OpcoesDaPeca, type Peca, type Textura } from './motor'
import { G, type MontarMovel } from './contexto'
import { comMeioEm, crescida, deslocada } from './andaimeDaTresQuartos'
import { FOGO_PARADO, texHalo } from './fogoDeCasa'
import { BRASA_QUENTE, BRASA_VIVA } from './fogueira'

/** O braseiro foi medido no tamanho de partida (1 casa, 28 px de meio lado): as medidas miúdas escalam por aqui. */
const MEIO_LADO_DE_PARTIDA = 0.5 * G
const GRAUS = Math.PI / 180
/** A altura do tacho, em casas do lado. */
const ALTURA = 0.26

/** O meio do tacho na pegada (fração do meio lado): para cima à esquerda, para os punhos caberem. */
const MEIO: Ponto = [-0.15, -0.15]
/** Os raios, em fração do meio lado: a borda por fora e por dentro, a roda dos rebites, o leito e o bojo. */
const BORDA_DE_FORA = 0.66
const BORDA_DE_DENTRO = 0.54
const RAIO_DOS_REBITES = 0.6
const REBITES = 12
const RAIO_DO_LEITO = 0.56
const RAIO_DO_BOJO = 0.64
/** Os pés (o ângulo de cada um, 90 = a frente) e as argolas de carregar. */
const PES: readonly number[] = [128, 248, 8]
const ARGOLAS: readonly number[] = [188, 282]
/**
 * Os ferros: o ângulo (graus), onde fica a ponta com a marca (fração do meio lado a partir do meio do tacho;
 * negativo = passa do meio), onde o punho começa e onde acaba.
 */
const FERROS: readonly { readonly graus: number; readonly ponta: number; readonly punho: number; readonly fim: number }[] = [
  { graus: 24, ponta: -0.3, punho: 0.86, fim: 1.2 },
  { graus: 48, ponta: 0.2, punho: 0.9, fim: 1.27 },
  { graus: 73, ponta: -0.3, punho: 0.84, fim: 1.17 },
]
const RAIO_DA_HASTE = 0.95
const RAIO_DO_PUNHO = 1.9
/** Até onde a haste fica em brasa, a partir do meio do tacho (fração do meio lado). */
const HASTE_EM_BRASA = 0.58

/** O leito: o lado de cada torrão (px de partida) e a largura da fresta em brasa. */
const TORRAO = 4.3
const FRESTA = 0.2
const ALFA_DO_HALO = 0.12

const TOM_DO_BOJO = 0.74
const TOM_DA_BORDA = 1.02
const TOM_DO_REBITE = 1.34
const TOM_DO_PE = 0.8
const BRILHO_DO_FERRO = 0.3
const FULIGEM_NA_BORDA = 0.34
const ESCURO_DO_FERRO: Rgb = [0x4a, 0x45, 0x41]
/** O carvão e a cinza da crista dele; a brasa funda das frestas da beira e o miolo mais claro dos torrões acesos. */
const CARVAO: Rgb = [0x40, 0x3a, 0x36]
const CINZA_DO_CARVAO: Rgb = [0x82, 0x7b, 0x73]
const BRASA_FUNDA: Rgb = [0x66, 0x38, 0x2c]
const MIOLO_DA_BRASA: Rgb = [0xda, 0x9c, 0x62]
/** A marca em brasa na ponta de cada ferro: mais clara que o leito, com a beira escura que a destaca dele. */
const MARCA_NO_MIOLO: Rgb = [0xec, 0xb8, 0x7c]
const BEIRA_DA_MARCA: MaterialDaPeca = { classe: 'liso', rgb: [0x46, 0x2a, 0x23] }
/** O quanto o bojo cresce a caixa (fração do meio lado): a maior peça do tacho dá o material da frente dele na 3/4. */
const FOLGA_DA_CAIXA_DO_BOJO = 0.42
/** A madeira escura dos punhos (a nogueira do Meio-Termo, um pouco mais clara). */
const PUNHO: MaterialDaPeca = { classe: 'madeira', rgb: [0x80, 0x5e, 0x42] }

const DO_METAL = texturaDaClasse('metal')

/** O ferro batido: as covinhas do martelo por cima da textura do metal e, na borda, a fuligem crescendo para dentro. */
function texFerroBatido(cx: number, cy: number, R: number, fuligem: number): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (DO_METAL !== null) DO_METAL(u, v, x, y, p, s, escala)
    s[3] += (0.14 - Math.abs(ruido(x * 0.6 + p.su, y * 0.6 + p.sv))) * 0.2
    if (fuligem <= 0) return
    const t = limitar01((BORDA_DE_FORA - Math.hypot(x - cx, y - cy) / R) / (BORDA_DE_FORA - BORDA_DE_DENTRO))
    s[3] -= fuligem * t * t * (0.75 + ruido(x * 0.35 + 9, y * 0.35) * 0.9)
  }
}

/**
 * O LEITO de carvão em brasa viva, numa textura só: células de torrão (a mais
 * perto e a segunda dão a fresta entre dois torrões), o carvão escuro com a
 * cinza na crista, a brasa nas frestas e, quanto mais perto do meio, mais
 * torrões inteiros acesos.
 */
function texBrasasVivas(cx: number, cy: number, raio: number, lado: number, semente: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const gx = x / lado
    const gy = y / lado
    const ix = Math.floor(gx)
    const iy = Math.floor(gy)
    let perto = 9
    let segunda = 9
    let sorte = 0
    for (let j = -1; j <= 1; j += 1) {
      for (let i = -1; i <= 1; i += 1) {
        const d = Math.hypot(gx - (ix + i + 0.18 + 0.64 * hash(ix + i, iy + j, semente)), gy - (iy + j + 0.18 + 0.64 * hash(ix + i, iy + j, semente + 1)))
        if (d < perto) {
          segunda = perto
          perto = d
          sorte = hash(ix + i, iy + j, semente + 2)
        } else if (d < segunda) segunda = d
      }
    }
    const calor = limitar01(1.12 - Math.hypot(x - cx, y - cy) / raio + ruido(x * 0.12 + 5, y * 0.12 + 13) * 0.45)
    const fresta = limitar01(1 - (segunda - perto) / FRESTA)
    const miolo = limitar01(1 - perto * 1.5)
    const acesa = sorte < 0.1 + 0.42 * calor
    let cor: Rgb
    let emissao: number
    if (acesa) {
      cor = misturar(BRASA_VIVA, MIOLO_DA_BRASA, miolo * (0.3 + 0.7 * calor))
      emissao = 0.9
    } else {
      cor = misturar(CARVAO, CINZA_DO_CARVAO, miolo * miolo * (0.55 - 0.3 * calor))
      emissao = 0.1
      s[3] += (miolo - 0.45) * 0.3
    }
    const naFresta = misturar(BRASA_FUNDA, BRASA_QUENTE, 0.15 + 0.85 * calor)
    const t = fresta * (acesa ? 0.35 : 0.9)
    s[0] = cor[0] + (naFresta[0] - cor[0]) * t
    s[1] = cor[1] + (naFresta[1] - cor[1]) * t
    s[2] = cor[2] + (naFresta[2] - cor[2]) * t
    s[4] = emissao + (0.92 - emissao) * fresta
  }
}

/** A haste do ferro de marcar: o metal e, até `ate` px do meio do tacho, o ferro em brasa (mais claro perto da ponta). */
function texHasteEmBrasa(cx: number, cy: number, ate: number): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (DO_METAL !== null) DO_METAL(u, v, x, y, p, s, escala)
    const t = limitar01(1 - Math.hypot(x - cx, y - cy) / ate)
    if (t <= 0) return
    const cor = misturar(BRASA_VIVA, BRASA_QUENTE, t)
    const q = Math.min(1, t * 1.8)
    s[0] += (cor[0] - s[0]) * q
    s[1] += (cor[1] - s[1]) * q
    s[2] += (cor[2] - s[2]) * q
    s[4] = q * 0.85
  }
}

/** A forma `g` px mais gorda para todos os lados: a beira escura por baixo da marca. */
function engordada(f: Forma, g: number): Forma {
  return { b: [f.b[0] - g, f.b[1] - g, f.b[2] + g, f.b[3] + g], d: (x, y) => f.d(x, y) - g }
}

/** A marca em brasa: o claro no meio dela, o tom do leito na beira; toda emissão. */
function texMarcaEmBrasa(cx: number, cy: number, r: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const cor = misturar(MARCA_NO_MIOLO, BRASA_QUENTE, Math.min(1, Math.hypot(x - cx, y - cy) / r))
    s[0] = cor[0]
    s[1] = cor[1]
    s[2] = cor[2]
    s[4] = 1
  }
}

/** A marca na ponta do ferro: uma argola, uma cruz ou um triângulo vazado, em volta de (x, y), de raio `r`. */
function marca(qual: number, x: number, y: number, r: number, giro: number): Forma {
  if (qual === 0) return anel(x, y, r, r, r * 0.56, r * 0.56)
  const em = (graus: number, f: number): Ponto => [x + Math.cos(giro + graus * GRAUS) * r * f, y + Math.sin(giro + graus * GRAUS) * r * f]
  if (qual === 1) {
    const [a, b, c2, d] = [em(45, 1.1), em(225, 1.1), em(135, 1.1), em(315, 1.1)]
    return uniao(barra(a[0], a[1], b[0], b[1], r * 0.5), barra(c2[0], c2[1], d[0], d[1], r * 0.5))
  }
  return menos(poligono([em(0, 1.25), em(120, 1.25), em(240, 1.25)]), poligono([em(0, 0.52), em(120, 0.52), em(240, 0.52)]))
}

export const montarBraseiroComFerros: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const R = Math.min(hw, hh)
  const k = R / MEIO_LADO_DE_PARTIDA
  const ferro = c.m.metal
  const L = cena.partes
  const altura = 2 * R * ALTURA
  cena.corDoPiso = ESCURO_DO_FERRO
  const [cx, cy] = [MEIO[0] * hw, MEIO[1] * hh]
  const disco = (f: number): Forma => elipse(cx, cy, f * R, f * R)
  const em = (graus: number, f: number): Ponto => [cx + Math.cos(graus * GRAUS) * f * R, cy + Math.sin(graus * GRAUS) * f * R]
  const doFerro = (semente: number, mais: OpcoesDaPeca = {}): OpcoesDaPeca => ({ tabua: 0, bisel: 0.9 * k, contorno: 0.28, metal: BRILHO_DO_FERRO, semente, ...mais })
  const tacho = disco(BORDA_DE_FORA)

  // ---------- as sombras: o tacho (coluna) e a dos punhos, pintada no chão já longe deles ----------
  cena.sombras.push(contato(tacho, 0.34), { forma: tacho, z: altura, forca: 0.3 })
  const [sx, sy] = [SOMBRA_X * altura, SOMBRA_Y * altura]
  for (const f of FERROS) {
    const [ax, ay] = em(f.graus, BORDA_DE_FORA)
    const [bx, by] = em(f.graus, f.fim)
    cena.sombras.push({ forma: deslocada(capsula(ax, ay, bx, by, RAIO_DO_PUNHO * k * 0.9), sx, sy), z: 0, suave: bordaDaSombra({ z: altura }), forca: 0.24 })
  }

  // ---------- no chão: os três pés curtos, saindo de debaixo do bojo ----------
  PES.forEach((graus, i) => {
    const [ax, ay] = em(graus, BORDA_DE_FORA - 0.06)
    const [bx, by] = em(graus, BORDA_DE_FORA + 0.13)
    const pe = uniao(capsula(ax, ay, bx, by, 1.5 * k), elipse(bx, by, 2.1 * k, 2.1 * k))
    cena.sombras.push(contato(pe, 0.3))
    L.push(P(comMeioEm(pe, bx, by), ferro, doFerro(24301 + i, { bisel: 1.5 * k, tom: TOM_DO_PE, textura: texFerroBatido(cx, cy, R, 0) })))
  })

  // ---------- o tacho: o bojo (a barriga, que a 3/4 mostra), o leito em brasa, o halo, a borda e os rebites ----------
  const boca: Peca[] = []
  boca.push(P(crescida(disco(RAIO_DO_BOJO), FOLGA_DA_CAIXA_DO_BOJO * R), ferro, doFerro(24310, { bisel: RAIO_DO_BOJO * R * 0.6, tom: TOM_DO_BOJO, contorno: 0.3, textura: texFerroBatido(cx, cy, R, 0) })))
  boca.push(P(disco(RAIO_DO_LEITO), FOGO_PARADO, { tabua: 0, bisel: 0, contorno: 0, recesso: { k: 2.4 * k, forca: 0.4 }, textura: texBrasasVivas(cx, cy, RAIO_DO_LEITO * R, TORRAO * k, 24311), semente: 24311 }))
  boca.push(P(disco(RAIO_DO_LEITO), FOGO_PARADO, { textura: texHalo(cx, cy, RAIO_DO_LEITO * R, RAIO_DO_LEITO * R, ALFA_DO_HALO), bisel: 0, contorno: 0, semente: 24312 }))

  // ---------- os ferros de marcar: a haste em brasa, o punho de madeira com a virola e, por cima de todas as hastes, a marca acesa ----------
  const marcas: Peca[] = []
  FERROS.forEach((f, i) => {
    const [px, py] = em(f.graus, f.ponta)
    const [hx, hy] = em(f.graus, f.punho)
    const [fx, fy] = em(f.graus, f.fim)
    const rumo = f.graus * GRAUS
    const raioDaMarca = 3.5 * k
    const forma = marca(i, px, py, raioDaMarca, rumo)
    marcas.push(P(engordada(forma, 0.75 * k), BEIRA_DA_MARCA, { bisel: 0, contorno: 0, alfa: 0.7, semente: 24316 + i }))
    marcas.push(P(forma, FOGO_PARADO, { textura: texMarcaEmBrasa(px, py, raioDaMarca * 1.3), bisel: 0, contorno: 0, semente: 24320 + i }))
    boca.push(P(capsula(px, py, hx, hy, RAIO_DA_HASTE * k), ferro, doFerro(24324 + i, { eixo: rumo, bisel: RAIO_DA_HASTE * k, tom: 0.96, textura: texHasteEmBrasa(cx, cy, HASTE_EM_BRASA * R), projeta: { dist: 1.3 * k, forca: 0.3 } })))
    boca.push(P(capsula(hx, hy, fx, fy, RAIO_DO_PUNHO * k), PUNHO, { tabua: 0, eixo: rumo, bisel: RAIO_DO_PUNHO * k * 0.9, contorno: 0.3, tom: 0.94 + 0.12 * hash(i, 1, 24328), semente: 24328 + i, projeta: { dist: 1.4 * k, forca: 0.3 } }))
    // A virola de ferro onde a haste entra no punho, e o furo de pendurar na outra ponta.
    const [vx, vy] = em(f.graus, f.punho + 0.05)
    const [nx, ny] = [-Math.sin(rumo) * RAIO_DO_PUNHO * k, Math.cos(rumo) * RAIO_DO_PUNHO * k]
    boca.push(P(barra(vx - nx, vy - ny, vx + nx, vy + ny, 2 * k), ferro, doFerro(24332 + i, { bisel: 0.7 * k, tom: 1.16, metal: 0.42 })))
    const [ox, oy] = em(f.graus, f.fim - 0.04)
    boca.push(P(elipse(ox, oy, 0.7 * k, 0.7 * k), ferro, doFerro(24336 + i, { bisel: 0, tom: 0.6, contorno: 0, metal: 0 })))
  })

  // ---------- a borda chata e os rebites: por baixo dos ferros, que apoiam nela ----------
  const borda = P(anel(cx, cy, BORDA_DE_FORA * R, BORDA_DE_FORA * R, BORDA_DE_DENTRO * R, BORDA_DE_DENTRO * R), ferro, doFerro(24340, { bisel: 1.3 * k, tom: TOM_DA_BORDA, contorno: 0.3, textura: texFerroBatido(cx, cy, R, FULIGEM_NA_BORDA), projeta: { dist: 1.4 * k, forca: 0.38 } }))
  const rebites: Peca[] = []
  for (let i = 0; i < REBITES; i += 1) {
    const graus = ((i + 0.5) * 360) / REBITES
    // Nenhum rebite debaixo de uma haste.
    if (FERROS.some((f) => Math.abs(graus - f.graus) < 9)) continue
    const [rx, ry] = em(graus, RAIO_DOS_REBITES)
    rebites.push(P(elipse(rx, ry, 1.05 * k, 1.05 * k), ferro, doFerro(24341 + i, { bisel: 1.05 * k, tom: TOM_DO_REBITE, metal: 0.55, contorno: 0.2 })))
  }
  // A ordem de baixo para cima: o bojo, o leito e o halo; a borda e os rebites; as hastes e os punhos; as marcas.
  const [bojo, leito, halo, ...ferros] = boca
  for (const p of [bojo, leito, halo, borda, ...rebites, ...ferros, ...marcas]) L.push({ ...p, forma: comMeioEm(p.forma, cx, cy) })

  // ---------- as argolas de carregar, caídas contra o bojo, cada uma no seu grampo ----------
  ARGOLAS.forEach((graus, i) => {
    const [gx, gy] = em(graus, RAIO_DOS_REBITES)
    const [ax, ay] = em(graus, BORDA_DE_FORA + 0.1)
    L.push(P(comMeioEm(anel(ax, ay, 3.3 * k, 3.3 * k, 2 * k, 2 * k), cx, cy), ferro, doFerro(24360 + i, { bisel: 0.7 * k, tom: 0.92, metal: 0.4 })))
    L.push(P(comMeioEm(elipse(gx, gy, 1.7 * k, 1.7 * k), cx, cy), ferro, doFerro(24362 + i, { bisel: 1.3 * k, tom: 1.14, metal: 0.45, projeta: { dist: 0.8 * k, forca: 0.3 } })))
  })
}
