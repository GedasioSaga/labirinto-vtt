/**
 * OBELISCO de praça de cima com volume (construção do lote L15, 14/11/2026,
 * grupo Monumentos e colunas): dois DEGRAUS de pedra, o DADO quadrado com a
 * moldura no alto, o FUSTE alto que afina para cima e a PIRAMIDEZINHA da ponta,
 * com um pingo dourado no bico. No degrau de cima, na frente do dado, uma
 * PLACA de bronze com as linhas do texto; musgo nos cantos do degrau de baixo.
 *
 * De cima: os degraus e a moldura do dado em volta, as quatro faces do fuste
 * (largo no pé, estreito no alto) e as quatro faces da ponta, cada uma com a
 * luz do seu lado (a do norte e a do oeste claras, a do sul e a do leste
 * escuras): de cima é a pirâmide de faces que diz "obelisco". E a SOMBRA
 * comprida e afinando para baixo à direita, a de um ponteiro de relógio de sol.
 *
 * NA 3/4 (`tresQuartos.ts`, com o perfil derivado e a beirada
 * `ESPESSURA_DO_FUSTE_DO_OBELISCO`, a altura do fuste):
 * - o FUSTE são `FATIAS` tampos soltos, cada um mais estreito e mais alto que
 *   o de baixo, e com a beirada da altura do fuste inteiro: o de cima, o mais
 *   estreito, é pintado por último e desce até o dado, e de cada um sobra uma
 *   lasca dos lados. Sai uma face só que afina, sem as linhas de junta que
 *   fatias finas deixariam (o obelisco é uma pedra só);
 * - cada degrau e o dado vão em DUAS metades, a do norte (até a frente do que
 *   está em cima) e a do sul, e a ordem de pintura é dada à mão (`emOrdem`):
 *   as metades do norte de baixo para cima, o fuste, e as do sul de cima para
 *   baixo. Inteiros, o degrau de baixo (a base mais ao sul) seria pintado por
 *   último e cobriria tudo; a metade do sul do dado cobre o pé das fatias;
 * - as peças de cada parte têm o meio da caixa nela (`comMeioEm`), longe do
 *   fuste, que é o mais alto e levaria todas.
 * O desenho é montado na tela (`montadaNaTela`): girado, sai igual.
 *
 * As medidas saem do menor lado da pegada (2 x 2 casas de partida). Material:
 * `pedra`; o bronze da placa, o dourado do bico e o musgo são fixos.
 */
import { hash, misturar, rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { caixa, dentroDe, elipse, poligono, type Forma, type Ponto } from './formas'
import { contato, texturaDaClasse, type MaterialDaPeca, type OpcoesDaPeca, type Textura } from './motor'
import { G, type MontarMovel } from './contexto'
import { arrastada, colunaSemSombra, comMeioEm, emOrdem, montadaNaTela, solta, texturaComSombra, type QueFazSombra } from './andaimeDaTresQuartos'

/** Meios lados em fração do menor meio lado: os dois degraus, o dado, o fuste no pé e no alto. */
const DEGRAU_DE_BAIXO = 0.97
const DEGRAU_DE_CIMA = 0.78
const DADO = 0.5
const FUSTE_NO_PE = 0.27
const FUSTE_NO_ALTO = 0.165
/** As alturas, na mesma fração (2 x 2 casas: 1 = uma casa): os degraus, o dado e o alto do fuste. */
const ALTURA_DO_DEGRAU_DE_BAIXO = 0.12
const ALTURA_DO_DEGRAU_DE_CIMA = 0.25
const ALTURA_DO_DADO = 0.95
const ALTURA_DO_FUSTE = 3.3
/** A beirada das fatias do fuste (px do protótipo): a altura dele na pegada de partida. O perfil da 3/4 usa. */
export const ESPESSURA_DO_FUSTE_DO_OBELISCO = (ALTURA_DO_FUSTE - ALTURA_DO_DADO) * G
const FATIAS = 14
/** O tom de cada face (a luz vem de cima à esquerda): norte, oeste, leste e sul. */
const TOM_DAS_FACES = { norte: 1.06, oeste: 0.97, leste: 0.78, sul: 0.7 } as const
const TOM_DA_PONTA = { norte: 1.16, oeste: 1.04, leste: 0.8, sul: 0.68 } as const
/** A moldura do alto do dado, inclinada para fora: cada lado com a luz dele. */
const TOM_DA_MOLDURA = { norte: 1.08, oeste: 1.02, leste: 0.9, sul: 0.86 } as const
/** A placa no degrau de cima: meia largura, de onde a onde (fração), e as linhas do texto. */
const PLACA = { l: 0.2, y0: 0.56, y1: 0.7 }
const LINHAS_DA_PLACA = 3
/** O musgo nos cantos do degrau de baixo: o canto (sinal x, sinal y) e o tamanho do tufo. */
const MUSGO: readonly (readonly [number, number, number])[] = [[-1, 1, 0.1], [1, 1, 0.07], [-1, -1, 0.06], [1, -1, 0.05]]
/** As sombras no chão: força e borda. */
const FORCA_DA_SOMBRA = 0.32
const BORDA_DA_SOMBRA = 2.2
/** A sombra pintada nos degraus e no dado (a que não cai no chão): borda, força e em quantos trechos o fuste afina nela. */
const BORDA_DA_SOMBRA_PINTADA = 1.6
const FORCA_DA_SOMBRA_PINTADA = 0.3
const TRECHOS_DO_FUSTE_NA_SOMBRA = 4

const BRONZE: MaterialDaPeca = { classe: 'metal', rgb: [0x7a, 0x62, 0x3e] }
const DOURADO: MaterialDaPeca = { classe: 'metal', rgb: [0xb8, 0x96, 0x52] }

const DA_PEDRA = texturaDaClasse('pedra')

type Lado = keyof typeof TOM_DAS_FACES

/** As quatro faces de um tronco de pirâmide entre o quadrado de meio lado `a` (fora) e o de `b` (dentro). */
function faces(a: number, b: number): readonly (readonly [Lado, Ponto[]])[] {
  return [
    ['norte', [[-a, -a], [a, -a], [b, -b], [-b, -b]]],
    ['oeste', [[-a, -a], [-b, -b], [-b, b], [-a, a]]],
    ['leste', [[a, -a], [a, a], [b, b], [b, -b]]],
    ['sul', [[-a, a], [-b, b], [b, b], [a, a]]],
  ]
}

const montarNaTela: MontarMovel = (c, cena) => {
  const P = c.peca
  const R = Math.min(c.hw, c.hh)
  const f = (v: number): number => v * R
  const pedra = c.m.pedra
  const L = cena.partes
  const S = cena.sombras
  const daPedra = (semente: number, mais: OpcoesDaPeca = {}): OpcoesDaPeca => ({ bisel: 1.4, contorno: 0.28, semente, ...mais })
  const [d1, d2, dd, fp, fa] = [f(DEGRAU_DE_BAIXO), f(DEGRAU_DE_CIMA), f(DADO), f(FUSTE_NO_PE), f(FUSTE_NO_ALTO)]
  const [z1, z2, zd, zf] = [f(ALTURA_DO_DEGRAU_DE_BAIXO), f(ALTURA_DO_DEGRAU_DE_CIMA), f(ALTURA_DO_DADO), f(ALTURA_DO_FUSTE)]

  // ---------- as sombras no chão (só a vista de cima as vê): o pé, os degraus, o dado e o fuste afinando ----------
  const quadrado = (m: number): Forma => caixa(-m, -m, m, m)
  const deslocar = (m: number, z: number): Ponto[] => [[-m + 0.27 * z, -m + 0.21 * z], [m + 0.27 * z, -m + 0.21 * z], [m + 0.27 * z, m + 0.21 * z], [-m + 0.27 * z, m + 0.21 * z]]
  const [pe, alto] = [deslocar(fp, zd), deslocar(fa, zf)]
  // O fuste visto pela luz: o casco do quadrado do pé (no alto do dado) e o do alto do fuste, já arrastados.
  const fusteNoChao = poligono([pe[0], pe[1], alto[1], alto[2], alto[3], pe[3]])
  S.push(contato(quadrado(d1 + 0.5), 0.34))
  for (const [m, z] of [[d1, z1], [d2, z2], [dd, zd]] as const) S.push({ forma: arrastada(quadrado(m), z), z: 0, suave: BORDA_DA_SOMBRA, forca: FORCA_DA_SOMBRA })
  S.push({ forma: fusteNoChao, z: 0, suave: BORDA_DA_SOMBRA, forca: FORCA_DA_SOMBRA })

  // ---------- as estruturas da 3/4, na ordem de pintura ----------
  const metadeNorte = (m: number, ate: number): Forma => caixa(-m, -m, m, ate)
  const metadeSul = (m: number, de: number): Forma => caixa(-m, de, m, m)
  const fatias = Array.from({ length: FATIAS }, (_, k) => {
    const m = fp - ((fp - fa) * k) / (FATIAS - 1)
    return { forma: quadrado(m), z: zd + ((zf - zd) * (k + 1)) / FATIAS }
  })
  const ordem = emOrdem(
    [metadeNorte(d1, d2), metadeNorte(d2, dd), metadeNorte(dd, fp), ...fatias.map((x) => x.forma), metadeSul(dd, fp), metadeSul(d2, dd), metadeSul(d1, d2)],
    R,
  )
  const alturas = [z1, z2, zd, ...fatias.map((x) => x.z), zd, z2, z1]
  ordem.forEach((forma, i) => {
    const ehFatia = i >= 3 && i < 3 + FATIAS
    S.push(ehFatia ? solta(forma, alturas[i]) : colunaSemSombra(forma, alturas[i]))
  })

  // ---------- os degraus: cada um em duas peças (a do norte e a do sul), com o meio na metade certa ----------
  // ---------- a sombra do que está em cima, pintada em cada tampo (o fuste afinando em trechos) ----------
  const fusteAcimaDe = (z: number): QueFazSombra[] =>
    Array.from({ length: TRECHOS_DO_FUSTE_NA_SOMBRA }, (_, k) => ({
      forma: quadrado(fp - ((fp - fa) * (k + 0.5)) / TRECHOS_DO_FUSTE_NA_SOMBRA),
      de: zd - z + ((zf - zd) * k) / TRECHOS_DO_FUSTE_NA_SOMBRA,
      ate: zd - z + ((zf - zd) * (k + 1)) / TRECHOS_DO_FUSTE_NA_SOMBRA,
    }))
  const comSombra = (base: Textura | null, sombras: readonly QueFazSombra[]): Textura => texturaComSombra(base, sombras, BORDA_DA_SOMBRA_PINTADA, FORCA_DA_SOMBRA_PINTADA)
  const noDegrauDeBaixo = comSombra(DA_PEDRA, [{ forma: quadrado(d2), de: 0, ate: z2 - z1 }, { forma: quadrado(dd), de: z2 - z1, ate: zd - z1 }, ...fusteAcimaDe(z1)])
  const sombrasNoDegrauDeCima = [{ forma: quadrado(dd), de: 0, ate: zd - z2 }, ...fusteAcimaDe(z2)]
  const noDegrauDeCima = comSombra(DA_PEDRA, sombrasNoDegrauDeCima)
  const noDado = comSombra(DA_PEDRA, fusteAcimaDe(zd))

  // ---------- os degraus: cada um em duas peças (a do norte e a do sul), com o meio na metade certa ----------
  const degrau = (m: number, emCima: number, tom: number, textura: Textura, semente: number): void => {
    const meioNorte = -(m + emCima) / 2
    const meioSul = (m + emCima) / 2
    L.push(P(comMeioEm(caixa(-m, -m, m, emCima, 1), 0, meioNorte), pedra, daPedra(semente, { tom, textura })))
    L.push(P(comMeioEm(caixa(-m, emCima, m, m, 1), 0, meioSul), pedra, daPedra(semente + 1, { tom, textura })))
  }
  degrau(d1, d2, 0.86, noDegrauDeBaixo, 18100)
  // O musgo no degrau de baixo, nos cantos (o meio de cada tufo fora do degrau de cima).
  const musgo: MaterialDaPeca = { classe: 'folha', rgb: misturar(rgb(tomDoMeio('musgo', 0.84)), pedra.rgb, 0.16) }
  MUSGO.forEach(([sx, sy, tamanho], i) => {
    const [mx, my] = [sx * f(0.88), sy * f(0.88)]
    for (let k = 0; k < 6; k += 1) {
      const t = hash(i, k, 1811) * 2 * Math.PI
      const longe = hash(i, k, 1812) * f(tamanho)
      const raio = 1.1 * (0.7 + 0.6 * hash(i, k, 1813))
      L.push(P(elipse(mx + Math.cos(t) * longe, my + Math.sin(t) * longe * 0.8, raio, raio * 0.85), musgo, { bisel: raio * 0.7, contorno: 0.26, tom: 0.82 + 0.3 * hash(i, k, 1814), semente: 18110 + i * 8 + k }))
    }
  })
  degrau(d2, dd, 0.94, noDegrauDeCima, 18120)

  // ---------- a placa de bronze no degrau de cima, na frente do dado ----------
  const [pl, py0, py1] = [f(PLACA.l), f(PLACA.y0), f(PLACA.y1)]
  L.push(P(caixa(-pl, py0, pl, py1, 0.8), BRONZE, { tabua: 0, bisel: 0.9, contorno: 0.32, metal: 0.4, textura: comSombra(texturaDaClasse('metal'), sombrasNoDegrauDeCima), semente: 18130 }))
  for (let k = 0; k < LINHAS_DA_PLACA; k += 1) {
    const y = py0 + ((py1 - py0) * (k + 1)) / (LINHAS_DA_PLACA + 1)
    const meia = pl * (k === 0 ? 0.55 : 0.75)
    L.push(P(caixa(-meia, y - 0.35, meia, y + 0.35), BRONZE, { tabua: 0, bisel: 0, contorno: 0, tom: 0.6, semente: 18131 + k }))
  }

  // ---------- o dado: a moldura do alto em quatro, inclinada para fora (fora do fuste) ----------
  // As faces do oeste e do leste passam do corte das metades: cada uma vai em dois pedaços, um em cada metade (a do
  // sul cobriria o pedaço de cima dela com a frente lisa).
  const corte = (forma: Forma, norte: boolean): Forma => dentroDe(forma, norte ? caixa(-dd - 1, -dd - 1, dd + 1, fp) : caixa(-dd - 1, fp, dd + 1, dd + 1))
  faces(dd, fp).forEach(([lado, pontos], i) => {
    const opcoes = daPedra(18140 + i, { bisel: 1.2, tom: TOM_DA_MOLDURA[lado], textura: noDado })
    const face = poligono(pontos)
    if (lado === 'norte' || lado === 'sul') {
      L.push(P(comMeioEm(face, 0, lado === 'norte' ? -(dd + fp) / 2 : (dd + fp) / 2), pedra, opcoes))
      return
    }
    const x = ((lado === 'oeste' ? -1 : 1) * (dd + fp)) / 2
    L.push(P(comMeioEm(corte(face, true), x, 0), pedra, opcoes))
    L.push(P(comMeioEm(corte(face, false), x, (dd + fp) / 2), pedra, { ...opcoes, semente: 18145 + i }))
  })

  // ---------- o fuste: as quatro faces (com o meio na fatia de baixo) e a ponta (sobe com a de cima) ----------
  const naFatiaDeBaixo = fp - (fp - fa) / (2 * (FATIAS - 1))
  faces(fp, fa).forEach(([lado, pontos], i) => {
    const meio: Ponto = lado === 'norte' ? [0, -naFatiaDeBaixo] : lado === 'sul' ? [0, naFatiaDeBaixo] : lado === 'oeste' ? [-naFatiaDeBaixo, 0] : [naFatiaDeBaixo, 0]
    L.push(P(comMeioEm(poligono(pontos), meio[0], meio[1]), pedra, { bisel: 0.5, contorno: 0.26, tom: TOM_DAS_FACES[lado], semente: 18160 + i }))
  })
  faces(fa, 0).forEach(([lado, pontos], i) => {
    L.push(P(poligono(pontos), pedra, { bisel: 0.4, contorno: 0.28, tom: TOM_DA_PONTA[lado], semente: 18170 + i }))
  })
  const bico = Math.max(1.1, fa * 0.22)
  L.push(P(elipse(0, 0, bico, bico), DOURADO, { bisel: bico, contorno: 0.3, metal: 0.55, projeta: { dist: 0.8, forca: 0.3 }, semente: 18180 }))
}

export const montarObelisco: MontarMovel = montadaNaTela(montarNaTela)
