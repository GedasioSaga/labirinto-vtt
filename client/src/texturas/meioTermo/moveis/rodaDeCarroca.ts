/**
 * RODA DE CARROÇA solta (L07 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`; tema Vila e
 * fazenda; da fila de 24/11): a roda de madeira de raios, a mesma família das rodas da carroça (`carroca.ts`), com
 * o aro de ferro por fora, as cambotas de madeira emendadas (seis, cada emenda com o rebite do aro), doze raios e o
 * cubo com a cinta de ferro e o furo do eixo. Duas versões:
 *
 * - ENCOSTADA (a 1ª): de pé, encostada na parede do fundo da pegada, vista de frente e um nada de cima (a roda
 *   inclina para trás: a banda do aro aparece em cima, a ponta do cubo sai para a frente e para baixo). O mestre
 *   encosta a pegada na parede e gira.
 * - DEITADA: largada no chão, de cara para cima: a roda inteira, redonda, com a espessura das cambotas na frente e o
 *   cubo de pé no meio. Entre os raios aparece o chão.
 *
 * O perfil da 3/4 é `EM_PE` (`tresQuartos.ts`): a roda encostada já é desenhada como se vê de pé, e a deitada, rente
 * ao chão, mostra a frente das cambotas no próprio desenho. Com o perfil derivado, a roda de pé subiria como uma
 * coluna cheia, sem o chão entre os raios.
 *
 * Materiais: `madeira` (cambotas, raios e cubo; a da carroça) e `aros` (o aro, a cinta do cubo e os rebites).
 * Pegada: 1 x 1 casa.
 */
import { anel, barra, caixa, elipse, uniao, type Forma } from './formas'
import { contato, ruido, type Cena, type MaterialDaPeca, type Textura } from './motor'
import { BURACO, PREGO, type ContextoDoMovel, type MontarMovel } from './contexto'

const VOLTA = Math.PI * 2
/** O raio da roda (casas): 0,84 casa de diâmetro, a roda de uma carroça de fazenda. */
const RAIO_DA_RODA = 0.42
/** As medidas da roda, em fração do raio: o aro de ferro, as cambotas, o cubo e a cinta dele. */
const ARO = 0.075
const CAMBOTA = 0.2
const CUBO = 0.235
const CINTA = 0.05
const FURO = 0.065
const CAMBOTAS = 6
const RAIOS = 12
/** A largura do raio, em px do protótipo. */
const LARGURA_DO_RAIO = 2.3
/** Tons: o aro e a madeira na luz; a frente das cambotas e a banda do aro, que olham para baixo, mais escuras. */
const TOM_DA_CAMBOTA = 0.96
const TOM_DO_RAIO = 0.9
const TOM_DO_CUBO = 0.86
const TOM_DA_FRENTE = 0.66

/** A roda no plano dela, achatada no y por `ky` (1 = redonda), com o centro em (cx, cy). */
interface Roda {
  readonly cx: number
  readonly cy: number
  readonly R: number
  readonly ky: number
}

/** O ponto da roda no ângulo `a` e no raio `r` (px), já achatado. */
function naRoda(roda: Roda, a: number, r: number): [number, number] {
  return [roda.cx + Math.cos(a) * r, roda.cy + Math.sin(a) * r * roda.ky]
}

/** O anel da roda entre os raios `de` e `ate` (px), achatado. */
function anelDaRoda(roda: Roda, de: number, ate: number): Forma {
  return anel(roda.cx, roda.cy, de, de * roda.ky, ate, ate * roda.ky)
}

/** O ângulo da roda de um ponto da tela (o achatado desfeito). */
function anguloNaRoda(roda: Roda, x: number, y: number): number {
  return Math.atan2((y - roda.cy) / roda.ky, x - roda.cx)
}

/** As emendas das cambotas: uma risca escura em cada uma das seis, e um nada de ruído na madeira. */
function texDasCambotas(roda: Roda, fase: number): Textura {
  return (_u, _v, x, y, p, s) => {
    let a = anguloNaRoda(roda, x, y) - fase
    a -= Math.floor(a / (VOLTA / CAMBOTAS)) * (VOLTA / CAMBOTAS)
    const longe = Math.min(a, VOLTA / CAMBOTAS - a) * roda.R * (1 - ARO - CAMBOTA / 2)
    s[3] += (longe < 0.55 ? -0.3 * (1 - longe / 0.55) : 0) + ruido(x * 0.5 + p.semente, y * 0.5) * 0.06
  }
}

/** O topo do cubo: anéis do corte da madeira em volta do furo. */
function texDoCubo(cx: number, cy: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const longe = Math.hypot(x - cx, y - cy) + ruido(x * 0.3 + p.semente, y * 0.3) * 0.8
    s[3] += Math.sin(longe * 3.6) * 0.04 + ruido(x * 0.7, y * 0.7) * 0.05
  }
}

/**
 * A FACE da roda: o aro de ferro, as cambotas com as emendas e os rebites, os doze raios e o cubo (a cinta, a ponta
 * e o furo). `nariz` = o quanto a ponta do cubo sai do meio para baixo na tela (a roda encostada, que inclina para
 * trás). Devolve a forma da face inteira (para a sombra).
 */
function faceDaRoda(c: ContextoDoMovel, cena: Cena, roda: Roda, nariz: number): Forma {
  const P = c.peca
  const mad = c.m.madeira
  const aro = c.m.aros
  const { cx, cy, R } = roda
  const fora = R
  const dentroDoAro = R * (1 - ARO)
  const dentroDaCambota = R * (1 - ARO - CAMBOTA)
  const rc = R * CUBO
  const fase = 0.26
  // Os raios primeiro (as pontas entram debaixo das cambotas e do cubo).
  const raios: Forma[] = []
  for (let k = 0; k < RAIOS; k += 1) {
    const a = fase + (k / RAIOS) * VOLTA + VOLTA / RAIOS / 2
    const [ax, ay] = naRoda(roda, a, rc * 0.7)
    const [bx, by] = naRoda(roda, a, dentroDaCambota + 1.2)
    const raio = barra(ax, ay, bx, by, LARGURA_DO_RAIO)
    raios.push(raio)
    cena.partes.push(P(raio, mad, { eixo: Math.atan2(by - ay, bx - ax), tabua: 0, bisel: 0.8, tom: TOM_DO_RAIO * (0.95 + 0.1 * ruido(k * 7.3, 3)), contorno: 0.28, semente: 40 + k }))
  }
  const cambotas = anelDaRoda(roda, dentroDoAro + 0.3, dentroDaCambota)
  cena.partes.push(P(cambotas, mad, { arco: { cx, cy, r: R * (1 - ARO - CAMBOTA / 2), a0: fase }, tabua: 0, bisel: 1, tom: TOM_DA_CAMBOTA, contorno: 0.28, textura: texDasCambotas(roda, fase), semente: 30 }))
  const ferro = anelDaRoda(roda, fora, dentroDoAro)
  cena.partes.push(P(ferro, aro, { bisel: 0.8, contorno: 0.32, semente: 31 }))
  // Um rebite do aro em cada emenda.
  for (let k = 0; k < CAMBOTAS; k += 1) {
    const [rx, ry] = naRoda(roda, fase + (k / CAMBOTAS) * VOLTA, R * (1 - ARO / 2))
    cena.partes.push(P(elipse(rx, ry, 0.85, 0.85 * Math.max(0.6, roda.ky)), PREGO, { bisel: 0.6, contorno: 0.2, tom: 1.2, semente: 50 + k }))
  }
  // O cubo: a madeira, a cinta de ferro e a ponta com o furo do eixo (na encostada, a ponta sai para baixo).
  const cubo = elipse(cx, cy, rc, rc * roda.ky)
  cena.partes.push(P(cubo, mad, { tabua: 0, bisel: rc * 0.4, tom: TOM_DO_CUBO, contorno: 0.3, textura: texDoCubo(cx, cy), semente: 60 }))
  const px = cx
  const py = cy + nariz
  if (nariz > 0) {
    // O corpo do cubo que sai para a frente: a madeira de lado, mais escura, entre a face e a ponta.
    cena.partes.push(P(uniao(caixa(cx - rc * 0.72, cy, cx + rc * 0.72, py), elipse(px, py, rc * 0.72, rc * 0.72 * roda.ky)), mad, { eixo: Math.PI / 2, tabua: 0, bisel: 1.2, tom: TOM_DO_CUBO * 0.8, contorno: 0.3, semente: 61 }))
  }
  cena.partes.push(P(anel(px, py, rc * 0.72, rc * 0.72 * roda.ky, rc * 0.72 - R * CINTA * 2, (rc * 0.72 - R * CINTA * 2) * roda.ky), aro, { bisel: 0.7, contorno: 0.3, semente: 62 }))
  cena.partes.push(P(elipse(px, py, rc * 0.72 - R * CINTA * 2, (rc * 0.72 - R * CINTA * 2) * roda.ky), mad, { tabua: 0, bisel: 0.8, tom: 1.02, contorno: 0.2, textura: texDoCubo(px, py), semente: 63 }))
  cena.partes.push(P(elipse(px, py, R * FURO, R * FURO * roda.ky), BURACO, { bisel: 0.6, contorno: 0.3, recesso: { k: 1, forca: 0.3 }, semente: 64 }))
  return uniao(uniao(ferro, cambotas), uniao(cubo, raios.reduce(uniao)))
}

/** A banda que a espessura da roda mostra: a face arrastada `dy` px na tela, por baixo dela (ferro e madeira). */
function banda(c: ContextoDoMovel, cena: Cena, roda: Roda, dy: number, mat: MaterialDaPeca, sem: number): void {
  const { cx, cy, R, ky } = roda
  const y2 = cy + dy
  const varrida = uniao(caixa(cx - R, Math.min(cy, y2), cx + R, Math.max(cy, y2)), uniao(elipse(cx, cy, R, R * ky), elipse(cx, y2, R, R * ky)))
  // Só o anel: no meio a roda é vazada (o chão aparece entre os raios).
  const furo = elipse(cx, (cy + y2) / 2, R * (1 - ARO - CAMBOTA) - 0.4, R * (1 - ARO - CAMBOTA) * ky - 0.4 - Math.abs(dy) / 2)
  cena.partes.push(c.peca({ b: varrida.b, d: (x, y) => Math.max(varrida.d(x, y), -furo.d(x, y)) }, mat, { eixo: 0, tabua: 0, bisel: 0.8, tom: TOM_DA_FRENTE, contorno: 0.3, semente: sem }))
}

/** A roda encostada na parede do fundo: de pé, vista de frente e um nada de cima. */
export const montarRodaDeCarroca: MontarMovel = (c, cena) => {
  const R = c.g * RAIO_DA_RODA
  const ky = 0.9
  // O pé da roda no chão, na frente da pegada; o alto encosta na parede (o fundo da pegada).
  const pe = c.hh * 0.66
  const roda: Roda = { cx: 0, cy: pe - R * ky, R, ky }
  // A sombra: a da roda no chão, curta e mole (a roda está de pé contra a parede), e o contato do pé.
  cena.sombras.push({ forma: elipse(0, pe - 3, R * 0.92, 3.2), z: c.g * 0.55, forca: 0.2, solta: true }, contato(elipse(0, pe - 0.6, R * 0.32, 1.6), 0.36))
  // A banda do aro em cima: a roda inclina para trás, e de cima se vê a borda de rodagem.
  banda(c, cena, roda, -2.4, c.m.aros, 20)
  faceDaRoda(c, cena, roda, R * 0.16)
}

/** A roda deitada no chão, de cara para cima: redonda, com a frente das cambotas embaixo. */
export const montarRodaDeCarrocaDeitada: MontarMovel = (c, cena) => {
  const R = c.g * RAIO_DA_RODA
  const espessura = 3.8
  const roda: Roda = { cx: 0, cy: -espessura / 2, R, ky: 1 }
  // A sombra da roda (o anel, os raios e o cubo, rentes ao chão) e o contato do aro.
  const sombra: Forma = uniao(anelDaRoda(roda, R, R * (1 - ARO - CAMBOTA)), elipse(0, roda.cy, R * CUBO, R * CUBO))
  cena.sombras.push({ forma: sombra, z: c.g * 0.09, forca: 0.3 }, contato(anelDaRoda({ ...roda, cy: roda.cy + espessura }, R, R * (1 - ARO - CAMBOTA)), 0.3))
  // A frente que aparece é a rodagem do aro (o ferro), deitada.
  banda(c, cena, { ...roda, cy: roda.cy + espessura }, -espessura, c.m.aros, 21)
  faceDaRoda(c, cena, roda, 0)
}
