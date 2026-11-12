/**
 * VELAS E OFERENDAS de cima com volume (11/11/2026, lote 8 dos objetos novos,
 * grupo Cemitério): um pano de renda no chão com as oferendas, uma tigela de
 * barro com água, um pão redondo, um ramo de flores e umas moedas, e em volta
 * um punhado de velas de alturas diferentes, derretidas, ACESAS.
 *
 * As velas são as do candelabro de chão (`candelabroDeChao.ts`): o alto de
 * cera com a cova derretida e o pavio, a chama em gota pintada (sem
 * animação: só emissão) e um halo pequeno e quente. Aqui cada uma também
 * escorreu: o alto tem um beiço de cera de um lado e uma poça no chão do
 * mesmo lado. A chama aponta para cima NA TELA (o desenho lê `c.giro`, a
 * conta do candelabro). Duas ceras, a branca e a de abelha.
 *
 * A LUZ é do integrador (decisão do mestre: só ilumina em volta, sem chama
 * animada e sem botão Aceso/Apagado). O centro dela é a média dos pavios, que
 * o arquivo EXPORTA: `LUZ_DAS_VELAS` (frações da largura e da altura, a
 * partir do canto de cima à esquerda) e `ALTURA_DA_LUZ_DAS_VELAS` (a altura
 * média das chamas, em casas, para a 3/4).
 *
 * Na 3/4 (perfil DERIVADO) cada vela é uma coluna de cera do chão até o alto
 * dela; o halo, a maior peça de cada vela, dá à frente a cera clara do corpo
 * (`ceraDoCorpo`, a conta do `CERA_DO_CORPO` do candelabro). A tigela e o pão são colunas
 * baixas. O pano, as flores, as moedas e as poças ficam no chão: a caixa de
 * cada um cai fora das colunas (`comMeioEm` no pano e nas poças).
 *
 * Material: `pano` (os tecidos; vinho de partida). A renda, a cera, o barro,
 * o pão, as flores e as moedas são fixos.
 */
import { hash, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { anel, capsula, elipse, elipseGirada, poligono, type Forma, type Ponto } from './formas'
import { contato, luminanciaLinear, ruido, type MaterialDaPeca, type Textura } from './motor'
import { BURACO, LENCOL, materialDaPeca, type MontarMovel } from './contexto'

/** O lado de partida, em casas: abaixo dele tudo encolhe junto (acima, só se espalha). */
const LADO_DE_PARTIDA = 0.8

/** Uma vela: o pavio (frações da meia pegada), a altura (casas), o raio (px do protótipo) e a cera de abelha ou não. */
interface Vela {
  readonly fx: number
  readonly fy: number
  readonly altura: number
  readonly raio: number
  readonly abelha: boolean
}

/** As velas, em volta do pano: de alturas diferentes, de toco a vela inteira. */
const VELAS: readonly Vela[] = [
  { fx: -0.71, fy: -0.56, altura: 0.3, raio: 2.1, abelha: true },
  { fx: 0.03, fy: -0.71, altura: 0.15, raio: 1.6, abelha: false },
  { fx: 0.67, fy: -0.54, altura: 0.23, raio: 1.9, abelha: false },
  { fx: 0.76, fy: 0.19, altura: 0.12, raio: 1.7, abelha: true },
  { fx: 0.45, fy: 0.69, altura: 0.19, raio: 1.8, abelha: false },
  { fx: -0.32, fy: 0.73, altura: 0.1, raio: 1.5, abelha: false },
  { fx: -0.76, fy: 0.15, altura: 0.17, raio: 1.7, abelha: false },
]

function media(valores: readonly number[]): number {
  return valores.reduce((soma, v) => soma + v, 0) / valores.length
}

/** O centro da luz: a média dos pavios, em frações da largura e da altura do objeto, a partir do canto de cima à esquerda. */
export const LUZ_DAS_VELAS = {
  x: Math.round((0.5 + media(VELAS.map((v) => v.fx)) / 2) * 100) / 100,
  y: Math.round((0.5 + media(VELAS.map((v) => v.fy)) / 2) * 100) / 100,
} as const
/** A altura média das velas, em casas: na 3/4 as chamas ficam em volta dela. */
export const ALTURA_DA_LUZ_DAS_VELAS = Math.round(media(VELAS.map((v) => v.altura)) * 100) / 100

/** A cera branca e a de abelha, um pouco mais amarela (as duas de saturação baixa). */
const CERA: MaterialDaPeca = { classe: 'liso', rgb: [0xe2, 0xd7, 0xbc] }
const CERA_DE_ABELHA: MaterialDaPeca = { classe: 'liso', rgb: [0xe4, 0xcd, 0x9c] }
/**
 * A cera do CORPO da vela, que só a 3/4 pinta (a conta do candelabro): a
 * frente varrida tem 0,74 da luz do material, e com a cera do alto a vela
 * saía cinza. É o material do halo, a maior peça de cada vela.
 */
const LUZ_DO_CORPO_DA_VELA = 0.92 / 0.74
function ceraDoCorpo(cera: MaterialDaPeca): MaterialDaPeca {
  return { classe: 'liso', rgb: [cera.rgb[0] * LUZ_DO_CORPO_DA_VELA, cera.rgb[1] * LUZ_DO_CORPO_DA_VELA, cera.rgb[2] * LUZ_DO_CORPO_DA_VELA] }
}
/** A chama: quase branca no pé, amarela no meio, laranja contido na ponta (a do candelabro). */
const PE_DA_CHAMA: Rgb = [0xff, 0xf4, 0xcf]
const MEIO_DA_CHAMA: Rgb = [0xf6, 0xd0, 0x7e]
const PONTA_DA_CHAMA: Rgb = [0xe4, 0x9a, 0x52]
const CHAMA: MaterialDaPeca = { classe: 'liso', rgb: PE_DA_CHAMA }
/** A gota da chama: ao longo dela (de -1, o pé, a 1, a ponta), a meia largura em fração da maior. O lado direito. */
const GOTA_DA_CHAMA: readonly (readonly [number, number])[] = [[-1, 0.35], [-0.7, 0.8], [-0.3, 1], [0.15, 0.85], [0.6, 0.45], [1, 0]]
/** A chama de cada vela, pelo raio dela: meio comprimento e meia largura (px), e quanto do meio comprimento fica acima do pavio. */
const CHAMA_POR_RAIO = 0.62
const CHAMA_FIXA = 0.5
const LARGURA_POR_RAIO = 0.4
const LARGURA_FIXA = 0.15
const SUBIDA_DA_CHAMA = 0.75
/** O halo: a cor do brilho do lampião, o alfa no meio e o raio pelo raio da vela (pequeno e quente). */
const COR_DO_HALO: Rgb = [226, 170, 96]
const ALFA_DO_HALO = 0.34
const HALO_POR_RAIO = 2.4
const HALO_FIXO = 1
/** O derretido: quanto o beiço de cera passa da borda do alto, e a poça no chão (raios em fração do raio da vela). */
const BEICO = 0.3
const POCA_AO_LONGO = 1.35
const POCA_DE_TRAVES = 1.05
/**
 * O escuro em que o pixel escuro demais é levantado: o do próprio pano
 * escolhido, escurecido até a luminância linear 0,08 (a da sombra do pano).
 * Com o de sempre (o da nogueira, 0,062) a beira mais escura do pano ficava
 * logo abaixo do piso; com um escuro fixo (um vinho amarronzado) o pano azul
 * ganhava um fio vinho na beira e, misturada em sRGB com uma cor de outro
 * matiz, a beira dele ainda caía abaixo do piso.
 */
const LUZ_DO_ESCURO_DO_PANO = 0.08
const PASSO_DO_ESCURO = 0.02

function escuroDoPano(pano: MaterialDaPeca): Rgb {
  const escuro = (f: number): Rgb => [Math.round(pano.rgb[0] * f), Math.round(pano.rgb[1] * f), Math.round(pano.rgb[2] * f)]
  let f = 1
  while (f > PASSO_DO_ESCURO && luminanciaLinear(...escuro(f)) > LUZ_DO_ESCURO_DO_PANO) f -= PASSO_DO_ESCURO
  return escuro(f)
}

/** O pano: o meio e as meias medidas (frações da meia pegada), a volta (rad) e o ondulado da beira (px). A renda passa dele. */
const PANO: readonly [number, number, number, number] = [-0.01, 0.04, 0.6, 0.53]
const VOLTA_DO_PANO = -0.07
const ONDA_DO_PANO = 0.35
const RENDA = 1.3
const BICOS_DA_RENDA = 2.3
/** O meio da caixa do pano (frações da meia pegada): no pano, fora da tigela, do pão e das velas; fica no chão na 3/4. */
const MEIO_DO_PANO: readonly [number, number] = [0.02, -0.42]

/** A tigela de barro com água: o meio (frações), o raio (px), a altura (casas) e as cores. */
const TIGELA: readonly [number, number, number] = [-0.2, -0.14, 4.6]
const ALTURA_DA_TIGELA = 0.05
const BARRO: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('telhaTerracota', 0.98)) }
/**
 * A água: o azul da água da vila quase cheio. Mais escura, a beira dela caía
 * abaixo do piso de luz, e o levantamento (a mistura com o escuro do pano, de
 * outra cor) não a trazia de volta.
 */
const AGUA: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('agua', 0.95)) }
const REFLEXO: MaterialDaPeca = { classe: 'liso', rgb: [0xf6, 0xd9, 0x9a] }
/**
 * O pão redondo: o meio (frações), as meias medidas (px), a volta, a altura
 * (casas), a casca e os cortes. Baixo: na 3/4 a beirada é pouca e o que se vê
 * é a cúpula da casca (mais alto, lia como uma lata).
 */
const PAO: readonly [number, number, number, number, number] = [0.22, 0.06, 4.4, 3.7, 0.35]
const ALTURA_DO_PAO = 0.035
const CASCA: MaterialDaPeca = { classe: 'liso', rgb: rgb('#b58a55') }
const MIOLO: MaterialDaPeca = { classe: 'liso', rgb: rgb('#e3cfa2') }
const FARINHA: MaterialDaPeca = { classe: 'liso', rgb: rgb('#f1e8d2') }
/** As moedas de latão: o meio (frações) e o raio (px). A última cai em cima da anterior. */
const MOEDAS: readonly (readonly [number, number])[] = [
  [0.3, -0.36],
  [0.43, -0.27],
  [0.29, -0.2],
  [0.33, -0.33],
]
const RAIO_DA_MOEDA = 1.25
/**
 * O ramo de flores deitado no pano: as flores (meio em frações, raio em px e
 * cor), o laço e a ponta dos talos (frações). Cravos-de-defunto laranja, um
 * amarelo e dois brancos.
 */
const FLORES: readonly (readonly [number, number, number, Rgb])[] = [
  [-0.14, 0.27, 1.9, rgb(tomDoMeio('fogo', 0.98))],
  [-0.02, 0.36, 1.7, rgb(tomDoMeio('branco', 1))],
  [-0.2, 0.42, 1.8, rgb(tomDoMeio('amarelo', 0.96))],
  [0.02, 0.21, 1.6, rgb(tomDoMeio('fogo', 0.92))],
  [-0.06, 0.5, 1.5, rgb(tomDoMeio('branco', 0.97))],
]
const LACO: readonly [number, number] = [-0.36, 0.5]
const PONTA_DOS_TALOS: readonly [number, number] = [-0.52, 0.58]
/**
 * Os talos e as folhas: o verde da vila pouco escurecido. O talo é tão fino
 * que é quase todo contorno, e mais escuro ele caía abaixo do piso de luz
 * (verde misturado ao escuro do pano, de outra cor, fica abaixo do que a conta
 * do levantamento espera).
 */
const TALO: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('folha', 0.96)) }
const FOLHA: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('folha', 0.98)) }
const FITA: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('branco', 0.96)) }
const MIOLO_DA_FLOR: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('amarelo', 0.8)) }

/**
 * A mesma forma com a caixa de pintura centrada em (mx, my): o desenho não
 * muda (fora da forma nada pinta), mas o meio da caixa, que é o que a 3/4 lê
 * para saber com que estrutura a peça sobe, cai onde se quer.
 */
function comMeioEm(forma: Forma, mx: number, my: number): Forma {
  const ex = Math.max(mx - forma.b[0], forma.b[2] - mx)
  const ey = Math.max(my - forma.b[1], forma.b[3] - my)
  return { b: [mx - ex, my - ey, mx + ex, my + ey], d: (x, y) => forma.d(x, y) }
}

/** O deslocamento no desenho que cai em (dx, dy) NA TELA depois do quarto de volta que a 3/4 pinta (a conta do candelabro). */
function desgirado(dx: number, dy: number, giro: number): [number, number] {
  const quartos = ((Math.round(giro / 90) % 4) + 4) % 4
  return quartos === 1 ? [dy, -dx] : quartos === 2 ? [-dx, -dy] : quartos === 3 ? [-dy, dx] : [dx, dy]
}

/** O halo: a cor quente com alfa que cai suave do meio (cx, cy) até `r`, sem pegar luz nem sombra. */
function texHalo(cx: number, cy: number, r: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const q = Math.min(1, ((x - cx) * (x - cx) + (y - cy) * (y - cy)) / (r * r))
    s[0] = COR_DO_HALO[0]
    s[1] = COR_DO_HALO[1]
    s[2] = COR_DO_HALO[2]
    s[4] = 1
    s[5] = ALFA_DO_HALO * (1 - q) * (1 - q)
  }
}

/** A gota da chama de meio (cx, cy), apontada para (ux, uy), com as meias medidas `comprida` e `larga`. */
function gotaDaChama(cx: number, cy: number, ux: number, uy: number, comprida: number, larga: number): Forma {
  const em = (ao: number, de: number): Ponto => [cx + ao * comprida * ux - de * larga * uy, cy + ao * comprida * uy + de * larga * ux]
  const direita = GOTA_DA_CHAMA.map(([ao, de]) => em(ao, de))
  const esquerda = GOTA_DA_CHAMA.slice(0, -1).reverse().map(([ao, de]) => em(ao, -de))
  return poligono([...direita, ...esquerda])
}

/** A chama: do pé (px, py), quase branco, pelo amarelo, até o laranja da ponta, `comprimento` px adiante na direção (ux, uy); só emissão. */
function texChama(px: number, py: number, ux: number, uy: number, comprimento: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const t = Math.max(0, Math.min(1, ((x - px) * ux + (y - py) * uy) / comprimento)) * 2
    const naPonta = t >= 1
    const de = naPonta ? MEIO_DA_CHAMA : PE_DA_CHAMA
    const para = naPonta ? PONTA_DA_CHAMA : MEIO_DA_CHAMA
    const k = naPonta ? t - 1 : t
    s[0] = de[0] + (para[0] - de[0]) * k
    s[1] = de[1] + (para[1] - de[1]) * k
    s[2] = de[2] + (para[2] - de[2]) * k
    s[4] = 1
  }
}

/** O alto de uma vela derretida: a borda com um tremor e, para o lado `escorre`, o beiço de cera que transbordou. */
function altoDerretido(x: number, y: number, r: number, escorre: number, sem: number): Forma {
  const pontos: Ponto[] = []
  for (let i = 0; i < 18; i += 1) {
    const t = (i / 18) * 2 * Math.PI
    const perto = Math.cos(t - escorre)
    const beico = perto > 0.8 ? ((perto - 0.8) / 0.2) * BEICO : 0
    const k = 1 + 0.05 * Math.sin(3 * t + sem) + beico
    pontos.push([x + Math.cos(t) * r * k, y + Math.sin(t) * r * k])
  }
  return poligono(pontos)
}

/** A poça de cera no chão, para o lado `escorre`: oval com a beira tremida. */
function poca(x: number, y: number, r: number, escorre: number, sem: number): Forma {
  const cx = x + Math.cos(escorre) * r * 0.85
  const cy = y + Math.sin(escorre) * r * 0.85
  const pontos: Ponto[] = []
  for (let i = 0; i < 14; i += 1) {
    const t = (i / 14) * 2 * Math.PI
    const k = 0.85 + 0.3 * hash(i, sem, 73)
    const a = Math.cos(t) * r * POCA_AO_LONGO * k
    const b = Math.sin(t) * r * POCA_DE_TRAVES * k
    pontos.push([cx + a * Math.cos(escorre) - b * Math.sin(escorre), cy + a * Math.sin(escorre) + b * Math.cos(escorre)])
  }
  return poligono(pontos)
}

/** Uma flor vista de cima: pétalas em volta (dez bicos) de raio `r`. */
function flor(x: number, y: number, r: number, sem: number): Forma {
  const pontos: Ponto[] = []
  const giro = hash(sem, 2, 74) * Math.PI
  for (let i = 0; i < 20; i += 1) {
    const t = giro + (i / 20) * 2 * Math.PI
    const k = i % 2 === 0 ? 1 : 0.74
    pontos.push([x + Math.cos(t) * r * k, y + Math.sin(t) * r * k])
  }
  return poligono(pontos)
}

/** As pétalas: a luz de cima à esquerda em cada flor e um vinco escuro no meio de cada pétala. */
function texDaFlor(x0: number, y0: number, r: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const dx = (x - x0) / r
    const dy = (y - y0) / r
    s[3] += -0.16 * (0.62 * dx + 0.48 * dy) + ruido(x * 2.1, y * 2.1) * 0.1 - Math.hypot(dx, dy) * 0.08
  }
}

/** O pano com a beira ondulada (as dobras de quem o estendeu no chão): um retângulo girado, cada lado em pedaços. */
function contornoDoPano(cx: number, cy: number, a: number, b: number, sobra: number, bicos: number, sem: number): Ponto[] {
  const cantos: Ponto[] = [[-a - sobra, -b - sobra], [a + sobra, -b - sobra], [a + sobra, b + sobra], [-a - sobra, b + sobra]]
  const pontos: Ponto[] = []
  const cos = Math.cos(VOLTA_DO_PANO)
  const sin = Math.sin(VOLTA_DO_PANO)
  cantos.forEach(([x0, y0], i) => {
    const [x1, y1] = cantos[(i + 1) % 4]
    const comprimento = Math.hypot(x1 - x0, y1 - y0)
    const passos = Math.max(6, Math.round(comprimento / 0.6))
    // Para fora do pano: a normal do lado.
    const nx = (y1 - y0) / comprimento
    const ny = -(x1 - x0) / comprimento
    for (let j = 0; j < passos; j += 1) {
      const t = j / passos
      const onda = ONDA_DO_PANO * Math.sin(t * Math.PI * 2 + i * 1.7 + sem) + (bicos > 0 ? 0.55 * Math.abs(Math.sin((t * comprimento * Math.PI) / bicos)) : 0)
      const px = x0 + (x1 - x0) * t + nx * onda
      const py = y0 + (y1 - y0) * t + ny * onda
      pontos.push([cx + px * cos - py * sin, cy + px * sin + py * cos])
    }
  })
  return pontos
}

export const montarVelasEOferendas: MontarMovel = (c, cena) => {
  const { w, h, hw, hh, g, peca: P } = c
  const pano = c.m.pano
  const L = cena.partes
  cena.corDoPiso = escuroDoPano(pano)
  const k = Math.min(1, w / (g * LADO_DE_PARTIDA), h / (g * LADO_DE_PARTIDA))
  const em = (fx: number, fy: number): Ponto => [fx * hw, fy * hh]
  const [ux, uy] = desgirado(0, -1, c.giro)

  // ---------- o pano de renda, no chão ----------
  const [pcx, pcy] = em(PANO[0], PANO[1])
  const [pa, pb] = [PANO[2] * hw, PANO[3] * hh]
  const [mpx, mpy] = em(MEIO_DO_PANO[0], MEIO_DO_PANO[1])
  const renda = poligono(contornoDoPano(pcx, pcy, pa, pb, RENDA * k, BICOS_DA_RENDA * k, 3))
  const corpoDoPano = poligono(contornoDoPano(pcx, pcy, pa, pb, 0, 0, 3))
  cena.sombras.push(contato(corpoDoPano, 0.14))
  L.push(P(comMeioEm(renda, mpx, mpy), LENCOL, { bisel: 0.5, contorno: 0.22, tom: 1.04, semente: 700 }))
  // Contorno e chanfro leves: no pano azul a beira escura, levantada para o escuro do pano vinho, caía abaixo do piso.
  L.push(P(comMeioEm(corpoDoPano, mpx, mpy), pano, { bisel: 1.2, contorno: 0.2, semente: 701 }))

  // ---------- as moedas e o ramo de flores, no pano ----------
  MOEDAS.forEach(([fx, fy], i) => {
    const [x, y] = em(fx, fy)
    const r = RAIO_DA_MOEDA * k
    cena.sombras.push(contato(elipse(x, y, r, r), 0.22))
    L.push(P(elipse(x, y, r, r), materialDaPeca('latao'), { bisel: r * 0.5, contorno: 0.3, tom: 0.94 + 0.12 * hash(i, 1, 75), semente: 710 + i }))
    L.push(P(anel(x, y, r * 0.66, r * 0.66, r * 0.42, r * 0.42), materialDaPeca('latao'), { bisel: 0, contorno: 0, tom: 0.84, semente: 715 + i }))
  })
  const [lx, ly] = em(LACO[0], LACO[1])
  const [tx, ty] = em(PONTA_DOS_TALOS[0], PONTA_DOS_TALOS[1])
  FLORES.forEach(([fx, fy], i) => {
    const [x, y] = em(fx, fy)
    L.push(P(capsula(x, y, lx, ly, 0.45 * k), TALO, { bisel: 0.4, contorno: 0.14, semente: 720 + i }))
  })
  for (let i = 0; i < 3; i += 1) {
    const abre = (i - 1) * 1.1 * k
    L.push(P(capsula(lx, ly, tx + abre * 0.5, ty - abre, 0.45 * k), TALO, { bisel: 0.4, contorno: 0.14, semente: 726 + i }))
  }
  // Duas folhas e o laço de fita nos talos.
  const angulo = Math.atan2(ty - ly, tx - lx)
  L.push(P(elipseGirada(lx + 2.6 * k, ly - 2.4 * k, 2.2 * k, 0.9 * k, angulo + 0.9), FOLHA, { bisel: 0.5, contorno: 0.16, semente: 730 }))
  L.push(P(elipseGirada(lx + 1.2 * k, ly + 1.6 * k, 2 * k, 0.8 * k, angulo - 0.7), FOLHA, { bisel: 0.5, contorno: 0.16, tom: 0.94, semente: 731 }))
  L.push(P(elipseGirada(lx, ly, 1.4 * k, 0.6 * k, angulo + Math.PI / 2), FITA, { bisel: 0.5, contorno: 0.28, semente: 732 }))
  FLORES.forEach(([fx, fy, r, cor], i) => {
    const [x, y] = em(fx, fy)
    const rf = r * k
    L.push(P(flor(x, y, rf, 740 + i), { classe: 'liso', rgb: cor }, { bisel: rf * 0.4, contorno: 0.26, textura: texDaFlor(x, y, rf), semente: 740 + i }))
    L.push(P(elipse(x - 0.15 * rf, y - 0.15 * rf, rf * 0.3, rf * 0.3), MIOLO_DA_FLOR, { bisel: rf * 0.2, contorno: 0.2, tom: i % 2 === 0 ? 0.7 : 1, semente: 750 + i }))
  })

  // ---------- a tigela de barro com água: uma coluna baixa ----------
  const [bx, by] = em(TIGELA[0], TIGELA[1])
  const rb = TIGELA[2] * k
  cena.sombras.push({ forma: elipse(bx, by, rb, rb), z: g * ALTURA_DA_TIGELA * k }, contato(elipse(bx, by, rb, rb), 0.3))
  L.push(P(elipse(bx, by, rb, rb), BARRO, { bisel: rb * 0.3, contorno: 0.3, semente: 760 }))
  L.push(P(elipse(bx, by, rb * 0.72, rb * 0.72), AGUA, { bisel: 0, contorno: 0.12, recesso: { k: 1.2, forca: 0.24 }, semente: 761 }))
  L.push(P(elipseGirada(bx - rb * 0.22, by - rb * 0.2, rb * 0.24, rb * 0.12, -0.6), REFLEXO, { bisel: 0, contorno: 0, alfa: 0.55, suave: 0.5, luz: 0.5, semente: 762 }))

  // ---------- o pão redondo: casca, os três cortes e a farinha ----------
  const [qx, qy] = em(PAO[0], PAO[1])
  const [prx, pry, volta] = [PAO[2] * k, PAO[3] * k, PAO[4]]
  const pao = elipseGirada(qx, qy, prx, pry, volta)
  cena.sombras.push({ forma: pao, z: g * ALTURA_DO_PAO * k }, contato(pao, 0.3))
  L.push(P(pao, CASCA, { bisel: Math.min(prx, pry) * 0.6, contorno: 0.3, semente: 770 }))
  for (let i = -1; i <= 1; i += 1) {
    const ox = Math.cos(volta) * i * prx * 0.42
    const oy = Math.sin(volta) * i * prx * 0.42
    L.push(P(elipseGirada(qx + ox, qy + oy, pry * 0.62, 0.42 * k, volta + Math.PI / 2 + 0.25), MIOLO, { bisel: 0.3, contorno: 0.2, semente: 771 + i }))
  }
  L.push(P(elipse(qx - prx * 0.25, qy - pry * 0.3, prx * 0.5, pry * 0.4), FARINHA, { bisel: 0, contorno: 0, alfa: 0.3, suave: 1.2, semente: 775 }))

  // ---------- as velas, do fundo para a frente ----------
  const velas = [...VELAS].sort((a, b) => a.fy - b.fy)
  velas.forEach((v, i) => {
    const [x, y] = em(v.fx, v.fy)
    const r = v.raio * k
    const cera = v.abelha ? CERA_DE_ABELHA : CERA
    const escorre = hash(i, 4, 76) * 2 * Math.PI
    // A poça no chão (a caixa fora da vela: fica no chão na 3/4) e a coluna de cera.
    const meioDaPoca: Ponto = [x + Math.cos(escorre) * r * 1.9, y + Math.sin(escorre) * r * 1.9]
    L.push(P(comMeioEm(poca(x, y, r, escorre, 780 + i), meioDaPoca[0], meioDaPoca[1]), cera, { bisel: 0.6, contorno: 0.2, tom: 0.95, semente: 780 + i }))
    const base = elipse(x, y, r, r)
    cena.sombras.push({ forma: base, z: g * v.altura * k }, contato(base, 0.3))
    // O alto, com o beiço de cera, a cova derretida e o pavio.
    L.push(P(altoDerretido(x, y, r, escorre, 790 + i), cera, { bisel: r * 0.45, contorno: 0.22, semente: 790 + i }))
    L.push(P(elipse(x - Math.cos(escorre) * r * 0.12, y - Math.sin(escorre) * r * 0.12, r * 0.58, r * 0.58), cera, { bisel: 0, tom: 0.92, contorno: 0, recesso: { k: 0.5, forca: 0.22 }, semente: 800 + i }))
    L.push(P(elipse(x, y, r * 0.17, r * 0.17), BURACO, { bisel: 0, contorno: 0, semente: 810 + i }))
    // O halo e a chama ficam acima do pavio, mas a caixa de cada um é centrada na vela: sobem com o alto dela.
    const comprida = CHAMA_POR_RAIO * r + CHAMA_FIXA * k
    const larga = LARGURA_POR_RAIO * r + LARGURA_FIXA * k
    const rHalo = HALO_POR_RAIO * r + HALO_FIXO * k
    const [cx, cy] = [x + ux * SUBIDA_DA_CHAMA * comprida, y + uy * SUBIDA_DA_CHAMA * comprida]
    L.push(P(comMeioEm(elipse(cx, cy, rHalo, rHalo), x, y), ceraDoCorpo(cera), { bisel: 0, contorno: 0, textura: texHalo(cx, cy, rHalo), semente: 820 + i }))
    const textura = texChama(cx - ux * comprida, cy - uy * comprida, ux, uy, 2 * comprida)
    L.push(P(comMeioEm(gotaDaChama(cx, cy, ux, uy, comprida, larga), x, y), CHAMA, { bisel: 0, contorno: 0, suave: 0.6, textura, semente: 830 + i }))
  })
}
