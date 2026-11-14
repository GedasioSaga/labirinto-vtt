/**
 * TENDA MILITAR GRANDE de cima com volume (14/11/2026, lote L16, construções da base militar): a barraca de
 * campanha de lona, de cumeeira, para um pelotão. As PAREDES baixas de lona, o TELHADO de duas águas com as
 * COSTURAS dos panos de través e os dois MASTROS saindo nas pontas da cumeeira, a CHAMINÉ do fogareiro, a PORTA
 * de pano enrolada e amarrada numa das empenas (a da direita), e as CORDAS de esticar de cada lado até as
 * ESTACAS no chão.
 *
 * De cima: as duas águas (a do lado da luz clara, a outra escura) com a cumeeira no meio e as costuras de
 * través, a chaminé, as cordas em leque até as estacas e a SOMBRA para baixo à direita. É a cumeeira comprida
 * com as cordas que diz "tenda de campanha" e não a tenda redonda nem a barraca de feira. A lona é trocável
 * (`lona`, as lãs da tabela e o linho: o musgo é o verde-oliva do exército, o ocre e o linho os do deserto).
 *
 * NA 3/4 (`tresQuartos.ts`): as paredes são uma coluna até o beiral, que leva a faixa mais baixa das duas águas;
 * as águas sobem em tampos de lona, cada um mais estreito, até a cumeeira (a beirada de cada tampo é o degrau
 * da água), com o material clareando para o alto para a frente dos degraus arredondar; nos dois lados compridos,
 * três JANELAS de tela (a aba enrolada) saem um tico da parede; a chaminé são tampos de disco que saem depois do
 * telhado. As cordas e as estacas ficam no chão. Lê `c.giro` para cada degrau e a chaminé saírem na ordem certa.
 *
 * Corre pelo lado MAIOR da pegada (u ao comprido, v de través, trocados na tenda em pé). Alturas em fração do
 * lado MENOR. NÃO BARRA (entra-se nela).
 */
import { hash, type Rgb } from '../../ruido'
import { caixa, capsula, elipse, type Forma, type Ponto } from './formas'
import { contato, texturaDaClasse, type Textura } from './motor'
import { BURACO, materialDaPeca, type MontarMovel } from './contexto'
import { discosQueAlargam, esticadaParaAFrente, faixaQueSai, solta, tingido } from './apoioDasConstrucoes'

/** A beirada dos tampos da tenda (px do protótipo): a altura de cada degrau das águas. O perfil usa este valor. */
export const ESPESSURA_DA_AGUA_DA_TENDA_MILITAR = 0.16 * 56

/** A tenda (fração da meia pegada): o meio comprimento e a meia largura das paredes. */
const MEIO_COMPRIMENTO = 0.8
const MEIA_LARGURA = 0.6
/** As estacas: até onde vão, de través e nas pontas. */
const ESTACA_DE_TRAVES = 0.93
const ESTACA_NA_PONTA = 0.95
/** As cordas de cada lado comprido, em fração do meio comprimento. */
const CORDAS: readonly number[] = [-0.78, -0.26, 0.26, 0.78]
/** As costuras dos panos de través (px de passo) e quanto escurecem. */
const PASSO_DA_COSTURA = 0.48 * 56
const FORCA_DA_COSTURA = 0.16
/** A chaminé: (u, v) em fração da tenda, o raio (px) e quanto passa da cumeeira (lados). */
const CHAMINE: readonly [number, number] = [-0.52, -0.38]
const RAIO_DA_CHAMINE = 1.9
const CHAMINE_ACIMA = 0.12
/** Alturas em lados: o beiral (o alto das paredes) e a cumeeira. */
const ALTURA_DO_BEIRAL = 0.3
const ALTURA_DA_CUMEEIRA = 0.86
/** A meia largura da faixa da cumeeira no alto, em fração da meia largura. */
const CUMEEIRA = 0.07
/** O tom das duas águas vistas de cima: a do lado da luz e a do outro (a 3/4 pinta a frente dos degraus com 0,74). */
const TOM_DA_AGUA_DA_LUZ = 1.13
const TOM_DA_AGUA_DA_SOMBRA = 0.74
/** O material dos degraus, do de baixo ao de cima (base, quanto sobe): a frente de cada um na 3/4 sai nele. */
const DEGRADE_DA_FRENTE: readonly [number, number] = [0.84, 0.34]
/** O escuro em que o pixel escuro demais é levantado: neutro, claro o bastante para o piso de luz. */
const ESCURO_DA_TENDA: Rgb = [0x4a, 0x46, 0x42]

const CORDA = materialDaPeca('corda')
const MADEIRA_DA_ESTACA = materialDaPeca('nogueira')
const FERRO = materialDaPeca('ferro')
const DO_TECIDO = texturaDaClasse('tecido')
/** As janelas de tela dos lados compridos: o meio de cada uma (fração do comprimento), a largura e a altura (fração do lado). */
const JANELAS_DA_TENDA: readonly number[] = [-0.55, 0, 0.55]
const LARGURA_DA_JANELA = 0.24
const JANELA_DE = 0.09
const JANELA_ATE = 0.24
const TELA_DA_JANELA = materialDaPeca('ferro')

export const montarTendaMilitar: MontarMovel = (c, cena) => {
  const P = c.peca
  const L = cena.partes
  const S = cena.sombras
  const deitado = c.w >= c.h
  const [meioC, meiaL] = deitado ? [c.hw, c.hh] : [c.hh, c.hw]
  const lado = 2 * Math.min(c.hw, c.hh)
  const e = ESPESSURA_DA_AGUA_DA_TENDA_MILITAR
  const [U, V] = [MEIO_COMPRIMENTO * meioC, MEIA_LARGURA * meiaL]
  const lona = c.m.lona
  const [zBeiral, zCumeeira] = [ALTURA_DO_BEIRAL * lado, ALTURA_DA_CUMEEIRA * lado]
  cena.corDoPiso = ESCURO_DA_TENDA
  const extremo = Math.max(meioC, meiaL) + 1

  const bloco = (u0: number, v0: number, u1: number, v1: number, raio = 0): Forma => (deitado ? caixa(u0, v0, u1, v1, raio) : caixa(v0, u0, v1, u1, raio))
  const pt = (u: number, v: number): Ponto => (deitado ? [u, v] : [v, u])
  /** As costuras de través: a lona escurece num risco a cada pano. */
  const costurada: Textura = (u, v, x, y, p, s, escala) => {
    if (DO_TECIDO !== null) DO_TECIDO(u, v, x, y, p, s, escala)
    const ao = (deitado ? x : y) / PASSO_DA_COSTURA + 0.5
    const perto = Math.abs(ao - Math.round(ao)) * PASSO_DA_COSTURA
    if (perto < 0.8) s[3] -= FORCA_DA_COSTURA * (1 - perto / 0.8)
  }

  // ---------- no chão: as cordas de esticar e as estacas ----------
  const estaca = (u: number, v: number, i: number): void => {
    const [x, y] = pt(u, v)
    S.push(contato(elipse(x, y, 1.6, 1.6), 0.3))
    L.push(P(elipse(x, y, 1.3, 1.3), MADEIRA_DA_ESTACA, { tabua: 0, bisel: 0.6, tom: 0.9, contorno: 0.34, semente: 16900 + i }))
  }
  const corda = (u0: number, v0: number, u1: number, v1: number, i: number): void => {
    const [a, b] = [pt(u0, v0), pt(u1, v1)]
    S.push({ forma: capsula(a[0], a[1], b[0], b[1], 0.5), z: 0, suave: 1.2, forca: 0.16 })
    L.push(P(capsula(a[0], a[1], b[0], b[1], 0.42), CORDA, { tabua: 0, bisel: 0.3, contorno: 0.2, semente: 16920 + i }))
  }
  CORDAS.forEach((t, i) => {
    for (const lado2 of [-1, 1]) {
      const k = i * 2 + (lado2 > 0 ? 1 : 0)
      corda(t * U, lado2 * V, t * U * 1.04, lado2 * ESTACA_DE_TRAVES * meiaL, k)
      estaca(t * U * 1.04, lado2 * ESTACA_DE_TRAVES * meiaL, k)
    }
  })
  for (const ponta of [-1, 1]) {
    for (const lado2 of [-1, 1]) {
      const k = 10 + (ponta > 0 ? 2 : 0) + (lado2 > 0 ? 1 : 0)
      corda(ponta * U, lado2 * V * 0.4, ponta * ESTACA_NA_PONTA * meioC, lado2 * V * 0.7, k)
      estaca(ponta * ESTACA_NA_PONTA * meioC, lado2 * V * 0.7, k)
    }
  }

  // ---------- a porta enrolada na empena da direita: a sombra de dentro e os dois rolos amarrados ----------
  L.push(P(bloco(U - 0.4, -V * 0.32, U + 2.6, V * 0.32, 0.6), BURACO, { tabua: 0, bisel: 0, contorno: 0.2, tom: 0.72, semente: 16940 }))
  for (const lado2 of [-1, 1]) {
    const [a, b] = [pt(U + 1.6, lado2 * V * 0.3), pt(U + 1.6, lado2 * V * 0.82)]
    L.push(P(capsula(a[0], a[1], b[0], b[1], 1.7), lona, { tabua: 0, bisel: 1.2, tom: 0.9, contorno: 0.32, projeta: { dist: 1, forca: 0.3 }, semente: 16941 + lado2 }))
    const [nx, ny] = pt(U + 1.6, lado2 * V * 0.56)
    L.push(P(deitado ? caixa(nx - 2.1, ny - 0.4, nx + 2.1, ny + 0.4) : caixa(nx - 0.4, ny - 2.1, nx + 0.4, ny + 2.1), CORDA, { tabua: 0, bisel: 0.2, contorno: 0.24, semente: 16944 + lado2 }))
  }

  // ---------- as paredes: a coluna até o beiral, com a faixa de baixo das duas águas ----------
  const degraus = Math.max(2, Math.ceil((zCumeeira - zBeiral) / e - 0.01))
  const meiaDoDegrau = (k: number): number => V * (CUMEEIRA + (1 - CUMEEIRA) * (1 - (k + 1) / degraus))
  const contatoDaTenda = bloco(-U - 0.5, -V - 0.5, U + 0.5, V + 0.5, 0.8)
  S.push(contato(contatoDaTenda, 0.32), { forma: bloco(-U, -V, U, V), z: zBeiral })
  // As janelas de tela dos dois lados compridos (a aba enrolada para cima): na 3/4 são os vãos escuros da parede
  // da frente, o que diz "tenda de lona" e não "caixa verde". De cima ficam debaixo do beiral.
  for (const lado2 of [-1, 1]) {
    JANELAS_DA_TENDA.forEach((t, i) => {
      const [u0, u1] = [(t - LARGURA_DA_JANELA / 2) * U, (t + LARGURA_DA_JANELA / 2) * U]
      const forma = (sai: number): Forma => (lado2 > 0 ? bloco(u0, V - 0.3, u1, V + sai) : bloco(u0, -V - sai, u1, -V + 0.3))
      const ponto = (sai: number): Ponto => pt(t * U, lado2 * (V + sai))
      faixaQueSai(P, cena, forma, ponto, { sai: 0.8, de: JANELA_DE * lado, ate: JANELA_ATE * lado, espessura: e }, TELA_DA_JANELA, 16930 + i * 4 + (lado2 > 0 ? 2 : 0))
    })
  }
  const agua = (v0: number, v1: number, norte: boolean, semente: number, k = -1): void => {
    // A água do norte, virada para a luz, clara; a do sul escura. Na tenda em pé, a do oeste é a clara. O material
    // de cada degrau clareia para o alto (é ele que pinta a frente do degrau na 3/4, e o degradê arredonda a lona);
    // o tom compensa, e de cima a água fica igual.
    const clareia = k < 0 ? 1 : DEGRADE_DA_FRENTE[0] + DEGRADE_DA_FRENTE[1] * (k / Math.max(1, degraus - 1))
    const tom = (norte ? TOM_DA_AGUA_DA_LUZ : TOM_DA_AGUA_DA_SOMBRA) / clareia
    L.push(P(bloco(-U, v0, U, v1), tingido(lona, clareia), { tabua: 0, bisel: 0.5, tom, contorno: 0.2, textura: costurada, projeta: { dist: 1.2, forca: 0.26 }, semente }))
  }
  const v0 = meiaDoDegrau(0)
  agua(-V, -v0, true, 16950)
  agua(v0, V, false, 16951)

  // ---------- as águas: tampos cada vez mais estreitos até a cumeeira ----------
  for (let k = 0; k < degraus; k += 1) {
    const [vk, vProx] = [meiaDoDegrau(k), k + 1 < degraus ? meiaDoDegrau(k + 1) : 0]
    const z = zBeiral + ((zCumeeira - zBeiral) * (k + 1)) / degraus
    // Cada degrau sai depois do de baixo: a caixa vai até além da pegada, embaixo na tela (senão o de baixo pinta por cima).
    S.push(solta(esticadaParaAFrente(bloco(-U, -vk, U, vk), extremo + 0.01 * k, c.giro), z, k === 0 ? 0.28 : 0))
    if (vProx > 0) {
      agua(-vk, -vProx, true, 16960 + k * 2, k)
      agua(vProx, vk, false, 16961 + k * 2, k)
    } else {
      // A cumeeira: a faixa do alto, as duas metades no tom das águas, com a costura escura no meio (é a risca que
      // diz "duas águas" de cima) e os dois mastros saindo nas pontas.
      L.push(P(bloco(-U, -vk, U, 0), lona, { tabua: 0, bisel: 0.3, tom: TOM_DA_AGUA_DA_LUZ * 1.04, contorno: 0.2, textura: costurada, semente: 16980 }))
      L.push(P(bloco(-U, 0, U, vk), lona, { tabua: 0, bisel: 0.3, tom: TOM_DA_AGUA_DA_SOMBRA * 1.04, contorno: 0.2, textura: costurada, semente: 16981 }))
      const [r0, r1] = [pt(-U + 0.6, 0), pt(U - 0.6, 0)]
      L.push(P(capsula(r0[0], r0[1], r1[0], r1[1], 0.55), tingido(lona, 0.62), { tabua: 0, bisel: 0, contorno: 0.1, semente: 16984 }))
      for (const ponta of [-1, 1]) {
        const [x, y] = pt(ponta * (U - 1.6), 0)
        L.push(P(elipse(x, y, 1.5, 1.5), MADEIRA_DA_ESTACA, { tabua: 0, bisel: 0.7, tom: 1.05, contorno: 0.34, projeta: { dist: 0.9, forca: 0.3 }, semente: 16982 + ponta }))
      }
    }
  }

  // ---------- a chaminé do fogareiro: o cano que passa da cumeeira, com o chapéu ----------
  const [cx, cy] = pt(CHAMINE[0] * U, CHAMINE[1] * V)
  const noAlto = (f: Forma): Forma => esticadaParaAFrente(f, extremo + 0.5, c.giro)
  discosQueAlargam(P, cena, [cx, cy], RAIO_DA_CHAMINE, 0.2, { de: zCumeeira - 0.2 * lado, ate: zCumeeira + CHAMINE_ACIMA * lado, espessura: e, forca: 0.22, estica: noAlto }, FERRO, 16990)
  L.push(P(elipse(cx, cy, RAIO_DA_CHAMINE * 1.6, RAIO_DA_CHAMINE * 1.6), FERRO, { tabua: 0, bisel: 1, tom: 0.9, contorno: 0.34, metal: 0.3, projeta: { dist: 1.2, forca: 0.32 }, semente: 16996 }))
  L.push(P(elipse(cx - 0.6, cy - 0.6, 0.9, 0.9), FERRO, { tabua: 0, bisel: 0.3, tom: 1.25, contorno: 0, metal: 0.5, semente: 16997 }))
  // O remendo e a mancha de fuligem em volta da chaminé (descem com a água em que caem).
  for (let i = 0; i < 3; i += 1) {
    const [x, y] = pt(CHAMINE[0] * U + (hash(i, 1, 1699) - 0.5) * 6, CHAMINE[1] * V + 3.4 + i * 1.4)
    L.push(P(elipse(x, y, 2.4, 1.6), tingido(lona, 0.6), { tabua: 0, bisel: 0, contorno: 0, alfa: 0.35, suave: 1.2, semente: 16998 + i }))
  }
}
