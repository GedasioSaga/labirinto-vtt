/**
 * JOIA de cima com volume (lote 17 dos objetos novos, 12/11/2026, grupo Tesouro; pedido do mestre: "coloque Ouro,
 * Diamente, Joias, Moedas de ouro como objeto única e em poças"): a peça ÚNICA das joias, um pingente largado no chão.
 *
 * O MEDALHÃO é uma oval de ouro velho com um RUBI grande lapidado no meio (oval, de facetas, `pedraLapidada.ts`),
 * preso no aro do engaste; em volta, a moldura trabalhada: as volutas finas entalhadas, o sulco escuro e a beira de
 * grãos de ouro, e QUATRO PÉROLAS nas diagonais, cada uma na sua taça. Da argola na ponta de cima sai a CORRENTE de
 * ouro, largada no chão numa curva solta que dá a volta pela direita e por baixo até o fecho. É a pedra vermelha no
 * meio do ouro e a corrente que dizem "joia": a moeda é um disco liso; o diamante, uma pedra branca sem ouro. Uma
 * estrelinha de brilho no canto da mesa do rubi, do lado da luz. Desenho genérico, inventado: não copia peça nenhuma.
 *
 * Na 3/4 o medalhão é uma coluna baixa (a espessura dele, com a sombra no chão) e o rubi um tampo solto um pouco
 * mais alto, que deixa ver o engaste embaixo; as peças do medalhão levam o meio para um ponto dele fora do rubi
 * (`comMeioEm`), senão subiriam com o rubi. A argola e os primeiros elos sobem com o medalhão; o resto da corrente
 * fica no chão. Com o giro, a luz das facetas e o brilho ficam no lugar NA TELA (`desgirado`).
 *
 * Tamanho de partida 0,5 x 0,5 casa. Esticada, a joia segue o menor lado. Sem material a escolher. Não escreve
 * `cena.corDoPiso`.
 */
import { cadeia, capsula, elipse, elipseGirada, menos, type Forma, type Ponto } from './formas'
import { contato } from './motor'
import type { MontarMovel } from './contexto'
import { aoLongo, comMeioEm, corrente, estrelinha, luzNoDesenho, mesaDaPedra, noOuro, OURO_NA_SOMBRA, OURO_VELHO, pedraLapidada, perola, RUBI, rumoDaLuz, type PoseDaPedra } from './pedraLapidada'

// ---------- as medidas (frações do menor meio lado, salvo onde diz) ----------

/** O medalhão: o meio, o rumo do eixo comprido (radianos, para a argola) e as meias medidas ao longo e de través. */
const MEIO_DO_MEDALHAO: Ponto = [-0.12, -0.14]
const EIXO = -1.2
const AO_LONGO = 0.56
const DE_TRAVES = 0.46
/** A espessura do medalhão e o quanto o rubi sobe acima dele na 3/4, em casas. */
const ESPESSURA = 0.028
const RUBI_ACIMA = 0.016
/** As voltas da moldura, em frações da oval: a beira de grãos, o sulco, as volutas, o aro do engaste e o rubi. */
const RAIO_DOS_GRAOS = 0.9
const GRAOS = 20
const GRAO = 0.068
const SULCO_DE_FORA = 0.79
const SULCO_DE_DENTRO = 0.74
const RAIO_DAS_VOLUTAS = 0.67
const ABERTURA_DA_VOLUTA = 0.34
const GROSSURA_DA_VOLUTA = 0.026
const ENGASTE_DE_FORA = 0.62
const ENGASTE_DE_DENTRO = 0.53
const RAIO_DO_RUBI = 0.55
/** O rubi tomba um pouco para a luz (radianos): a mesa pega mais luz e as facetas variam. */
const TOMBO_DO_RUBI = 0.14
/** As pérolas nas diagonais: o raio do lugar (fração da oval), o tamanho e a taça de ouro debaixo (vezes a pérola). */
const RAIO_DAS_PEROLAS = 0.69
const PEROLA_DA_JOIA = 0.095
const TACA_DA_PEROLA = 1.28
/** A argola: o meio (além da ponta da oval), as meias medidas de fora e as do furo; a conta que a prende. */
const ALEM_DA_PONTA = 0.07
const ARGOLA: readonly [number, number, number, number] = [0.13, 0.1, 0.06, 0.035]
const CONTA_DA_ARGOLA = 0.07
/** Onde as peças do medalhão levam o meio da caixa: na oval, fora do rubi (fração da meia medida de través). */
const MEIO_DAS_PECAS = 0.82
/** A corrente: o elo e o caminho pelo chão, da argola até o fecho; quantos elos sobem com o medalhão. */
const ELO = 0.1
const CAMINHO: readonly Ponto[] = [[0.34, -0.68], [0.62, -0.5], [0.8, -0.16], [0.78, 0.24], [0.56, 0.58], [0.2, 0.78], [-0.2, 0.8], [-0.54, 0.66], [-0.78, 0.4], [-0.86, 0.08]]
const ELOS_PRESOS = 3
/** O fecho na ponta da corrente: o comprimento e a grossura, em elos. */
const FECHO = 1.6
const GROSSURA_DO_FECHO = 0.5
/** A estrelinha de brilho no canto da mesa do rubi: onde (fração da mesa) e o braço (raios do rubi). */
const CANTO_DO_BRILHO = 0.48
const BRACO_DO_BRILHO = 0.62

const SEMENTE = 9300

/** O sulco e as volutas entalhados na moldura: o ouro na sombra. */
const ENTALHE = OURO_NA_SOMBRA

export const montarJoia: MontarMovel = (c, cena) => {
  const P = c.peca
  const L = cena.partes
  const R = Math.min(c.hw, c.hh)
  const luz = luzNoDesenho(c.giro)
  const [lx, ly] = rumoDaLuz(luz)
  const [mx, my] = [MEIO_DO_MEDALHAO[0] * R, MEIO_DO_MEDALHAO[1] * R]
  const [a, b] = [AO_LONGO * R, DE_TRAVES * R]
  const co = Math.cos(EIXO)
  const si = Math.sin(EIXO)
  /** O ponto da oval em frações (u ao longo, v de través). */
  const naOval = (u: number, v: number): Ponto => [mx + u * a * co - v * b * si, my + u * a * si + v * b * co]
  const oval = (f: number): Forma => elipseGirada(mx, my, a * f, b * f, EIXO)
  const [pmx, pmy] = naOval(0, MEIO_DAS_PECAS)
  const doMedalhao = (f: Forma): Forma => comMeioEm(f, pmx, pmy)
  const zMedalhao = ESPESSURA * c.g

  // As sombras: o medalhão é uma coluna baixa e o rubi um tampo solto acima dele; a corrente só encosta no chão.
  // O tampo do rubi tem a MESMA caixa do medalhão: a 3/4 pinta as estruturas do norte para o sul pela base da caixa
  // e, na mesma base, a mais alta por cima; com a caixa dele, o medalhão (mais ao sul) cobriria o rubi. A caixa
  // inteira igual, e não só a base, vale para os quatro giros (a cena girada gira as caixas).
  const pontosDaCorrente = aoLongo([naOval(1 + ALEM_DA_PONTA, 0), ...CAMINHO.map(([x, y]): Ponto => [x * R, y * R])], ELO * R * 1.1)
  const medalhao = oval(1)
  const ondeORubiSobe = oval(RAIO_DO_RUBI * 0.9)
  cena.sombras.push(
    contato(medalhao, 0.3),
    { forma: medalhao, z: zMedalhao, forca: 0.3 },
    { forma: { b: medalhao.b, d: ondeORubiSobe.d }, z: zMedalhao + RUBI_ACIMA * c.g, solta: true, forca: 0 },
    contato(cadeia(pontosDaCorrente.map(([x, y]): Ponto => [x, y]), ELO * R * 0.55), 0.22),
  )

  // A CORRENTE no chão (os primeiros elos sobem com o medalhão) e o fecho na ponta.
  const elo = ELO * R
  corrente(L, P, pontosDaCorrente, elo, SEMENTE, (i) => (i < ELOS_PRESOS ? [pmx, pmy] : null))
  const [fx, fy, rumo] = pontosDaCorrente[pontosDaCorrente.length - 1]
  const [ex, ey] = [fx + Math.cos(rumo) * elo * FECHO, fy + Math.sin(rumo) * elo * FECHO]
  L.push(P(capsula(fx, fy, ex, ey, elo * GROSSURA_DO_FECHO), OURO_VELHO, noOuro(elo * 0.4, SEMENTE + 200)))

  // O MEDALHÃO: a chapa, a beira de grãos, o sulco, as volutas e o aro do engaste.
  L.push(P(doMedalhao(oval(1)), OURO_VELHO, { ...noOuro(1.3, SEMENTE + 210), contorno: 0.34 }))
  for (let i = 0; i < GRAOS; i += 1) {
    const t = (i / GRAOS) * 2 * Math.PI
    const [x, y] = naOval(RAIO_DOS_GRAOS * Math.cos(t), RAIO_DOS_GRAOS * Math.sin(t))
    const r = GRAO * R
    L.push(P(doMedalhao(elipse(x, y, r, r)), OURO_VELHO, { ...noOuro(r, SEMENTE + 220 + i), metal: 0.62 }))
  }
  L.push(P(doMedalhao(menos(oval(SULCO_DE_FORA), oval(SULCO_DE_DENTRO))), ENTALHE, { bisel: 0, contorno: 0, semente: SEMENTE + 250 }))
  for (let k = 0; k < 4; k += 1) {
    const t = (k * Math.PI) / 2
    const arco: Ponto[] = []
    for (let j = 0; j <= 6; j += 1) {
      const s = t - ABERTURA_DA_VOLUTA + (2 * ABERTURA_DA_VOLUTA * j) / 6
      // A voluta: o arco pela moldura, com as pontas enroladas para dentro.
      const recolhe = 1 - 0.1 * Math.abs(j - 3) / 3
      arco.push(naOval(RAIO_DAS_VOLUTAS * recolhe * Math.cos(s), RAIO_DAS_VOLUTAS * recolhe * Math.sin(s)))
    }
    L.push(P(doMedalhao(cadeia(arco, GROSSURA_DA_VOLUTA * R)), ENTALHE, { bisel: 0, contorno: 0, semente: SEMENTE + 260 + k }))
  }
  L.push(P(doMedalhao(menos(oval(ENGASTE_DE_FORA), oval(ENGASTE_DE_DENTRO))), OURO_VELHO, noOuro(0.7, SEMENTE + 270, 1.06)))

  // As PÉROLAS nas diagonais, cada uma na taça de ouro.
  for (let k = 0; k < 4; k += 1) {
    const t = Math.PI / 4 + (k * Math.PI) / 2
    const [x, y] = naOval(RAIO_DAS_PEROLAS * Math.cos(t), RAIO_DAS_PEROLAS * Math.sin(t))
    const r = PEROLA_DA_JOIA * R
    L.push(P(doMedalhao(elipse(x, y, r * TACA_DA_PEROLA, r * TACA_DA_PEROLA)), OURO_VELHO, noOuro(r * 0.5, SEMENTE + 280 + k, 0.9)))
    perola(L, P, x, y, r, luz, SEMENTE + 290 + k * 2, [pmx, pmy])
  }

  // A ARGOLA na ponta de cima, com a conta que a prende ao medalhão (sobem com ele).
  const [ax, ay] = naOval(1 + ALEM_DA_PONTA, 0)
  const [cx, cy] = naOval(1 - CONTA_DA_ARGOLA * 0.3, 0)
  L.push(P(doMedalhao(elipse(cx, cy, CONTA_DA_ARGOLA * R, CONTA_DA_ARGOLA * R)), OURO_VELHO, noOuro(CONTA_DA_ARGOLA * R, SEMENTE + 300)))
  const [fa, fb, da, db] = ARGOLA
  L.push(P(doMedalhao(menos(elipseGirada(ax, ay, fa * R, fb * R, EIXO), elipseGirada(ax, ay, da * R, db * R, EIXO))), OURO_VELHO, noOuro(0.5, SEMENTE + 301)))

  // O RUBI no engaste: oval, tombado um pouco para a luz; as peças dele levam o meio para o meio do medalhão (o tampo).
  const pose: PoseDaPedra = { x: mx, y: my, raio: RAIO_DO_RUBI * a, achatado: b / a, giro: EIXO, tombo: TOMBO_DO_RUBI, rumo: Math.atan2(ly, lx) }
  pedraLapidada(L, P, pose, { paleta: RUBI, detalhe: 'inteira', luz, semente: SEMENTE + 400, fresta: 0.1, meio: [mx, my] })
  const [tx, ty] = mesaDaPedra(pose)
  const raioDoRubi = RAIO_DO_RUBI * a
  estrelinha(L, P, tx + lx * CANTO_DO_BRILHO * raioDoRubi, ty + ly * CANTO_DO_BRILHO * raioDoRubi, BRACO_DO_BRILHO * raioDoRubi, SEMENTE + 480, [mx, my])
}
