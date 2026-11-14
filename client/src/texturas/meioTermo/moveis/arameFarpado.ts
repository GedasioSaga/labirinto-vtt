/**
 * ARAME FARPADO EM ROLO de cima (14/11/2026, lote L05 dos objetos novos, base
 * militar): a sanfona de arame (a concertina) deitada no chão, presa em
 * piquetes de cantoneira de ferro, que o mestre estica em linha para fechar
 * um perímetro, como a cerca e o muro baixo de pedra.
 *
 * O rolo é um cilindro deitado ao comprido, e um cilindro deitado visto de
 * cima é igual a ele visto de lado: os LAÇOS aparecem como argolas inclinadas,
 * uma para cada lado, encavaladas umas nas outras ao longo do trecho. Cada laço
 * tem as FARPAS (um X miúdo, mais escuro que o arame) espalhadas pela volta e
 * faz sombra nos de baixo. Os PIQUETES (o L da cantoneira visto de cima, que
 * atravessa o rolo pelo meio) ficam nas pontas e a cada
 * `VAO_DOS_PIQUETES`, com a sombra comprida de quem é alto. A sombra do rolo
 * no chão é rendada: cada laço solta a dele, deslocada pela altura do meio do
 * rolo.
 *
 * Por ser igual de cima e de lado, a 3/4 é a mesma imagem com a sombra de
 * baixo (perfil EM_PE, como a bigorna e as cordas enroladas): derivado, cada
 * argola viraria uma parede maciça varrida do chão até a altura dela.
 *
 * O desenho se REPARTE pelo comprimento (`c.w` e `c.h`): o trecho esticado
 * ganha mais laços e mais piquetes, nunca laços esticados. O rolo corre pelo
 * lado MAIOR da pegada (montado no referencial dele, `u` ao comprido e `v` de
 * través, e trocado de eixo no trecho em pé); o diâmetro do rolo é a fundura
 * da pegada. Sem material escolhido: o aço galvanizado e o ferro dos piquetes
 * são fixos.
 */
import { hash, type Rgb } from '../../ruido'
import { capsula, elipseGirada, menos, uniao, type Forma, type Ponto } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import { G, type MontarMovel } from './contexto'

/** O aço galvanizado do arame: cinza claro, para a argola de 1 px ler sobre a terra e sobre a lajota (o contorno dá a borda escura). */
const ACO: MaterialDaPeca = { classe: 'metal', rgb: [0x9d, 0x9f, 0x9c] }
/** O ferro dos piquetes, mais escuro e um nada enferrujado. */
const FERRO_DO_PIQUETE: MaterialDaPeca = { classe: 'metal', rgb: [0x5b, 0x55, 0x4f] }
/** O escuro em que o pixel escuro demais é levantado: o cinza do ferro (com a nogueira, a borda do arame saía marrom). */
const ESCURO_DO_ARAME: Rgb = [0x48, 0x48, 0x47]

/** O laço, em fração da fundura da pegada: o raio de través (o diâmetro do rolo quase toda a fundura) e o raio ao comprido. */
const RAIO_DE_TRAVES = 0.46
const RAIO_AO_COMPRIDO = 0.3
/** A distância entre dois laços vizinhos, em fração da fundura: bem menor que o laço, para eles encavalarem. */
const PASSO_DOS_LACOS = 0.27
/** A inclinação de cada laço (radianos), um para cada lado, e o quanto ela varia de laço para laço. */
const INCLINACAO = 0.34
const INCLINACAO_VARIA = 0.12
/** Quanto cada laço sai do eixo e muda de tamanho, em fração (nenhum laço é igual ao vizinho). */
const DESVIO_DO_LACO = 0.04
const TAMANHO_VARIA = 0.05
/** A grossura do arame (px do protótipo): com menos de ~1 px a argola some no tamanho de mesa. */
const GROSSURA_DO_ARAME = 1.25
/**
 * As farpas: quantas por laço, o meio comprimento de cada perna do X, a grossura (px do protótipo) e o tom.
 * Na rodada 1, com 4 farpas de perna 1,5 no tom do arame, o rolo parecia costurado de X claros.
 */
const FARPAS_POR_LACO = 3
const PERNA_DA_FARPA = 1
const RAIO_DA_FARPA = 0.36
const TOM_DA_FARPA = 0.72
/** Os piquetes: um a cada tantas casas, o lado do L e a espessura da chapa (px do protótipo), a altura em casas. */
const VAO_DOS_PIQUETES = 1.2
const LADO_DO_PIQUETE = 5.4
const CHAPA_DO_PIQUETE = 1.6
const ALTURA_DO_PIQUETE = 0.8
const FORCA_DA_SOMBRA_DO_PIQUETE = 0.26
const FORCA_DO_CONTATO_DO_PIQUETE = 0.3
/** A sombra que o piquete faz no arame debaixo dele. */
const SOMBRA_DO_PIQUETE = { dist: 1.4, forca: 0.35, suave: 0.7 } as const
/** Os laços que caem mais fundo no rolo ficam mais escuros: dois tons, alternados. */
const TOM_DO_LACO_DE_CIMA = 1.06
const TOM_DO_LACO_DE_BAIXO = 0.86
/** A sombra rendada de cada laço: solta à altura do meio do rolo, fraca (as de vários laços não somam). */
const FORCA_DA_SOMBRA_DO_LACO = 0.24
const SUAVE_DA_SOMBRA_DO_LACO = 0.9
/** O contato do rolo com o chão: a linha de baixo do eixo. */
const FORCA_DO_CONTATO = 0.22
const GROSSURA_DO_CONTATO = 1.6
/** A sombra que cada laço faz nos de baixo (o rolo tem fundura). */
const SOMBRA_NO_LACO = { dist: 1.1, forca: 0.32, suave: 0.6 } as const

export const montarArameFarpado: MontarMovel = (c, cena) => {
  const P = c.peca
  const deitado = c.w >= c.h
  const meioC = (deitado ? c.w : c.h) / 2
  const fundura = deitado ? c.h : c.w
  const pt = (u: number, v: number): Ponto => (deitado ? [u, v] : [v, u])
  /** O laço (uma elipse girada no referencial do rolo) trocado de eixo no trecho em pé: o ângulo espelha em volta da diagonal. */
  const elipseDoRolo = (u: number, v: number, rU: number, rV: number, a: number): Forma => {
    const [x, y] = pt(u, v)
    return deitado ? elipseGirada(x, y, rU, rV, a) : elipseGirada(x, y, rU, rV, Math.PI / 2 - a)
  }
  const tracoDoRolo = (u1: number, v1: number, u2: number, v2: number, r: number): Forma => {
    const [x1, y1] = pt(u1, v1)
    const [x2, y2] = pt(u2, v2)
    return capsula(x1, y1, x2, y2, r)
  }
  const farpa = (u: number, v: number): Forma =>
    uniao(tracoDoRolo(u - PERNA_DA_FARPA, v - PERNA_DA_FARPA, u + PERNA_DA_FARPA, v + PERNA_DA_FARPA, RAIO_DA_FARPA), tracoDoRolo(u - PERNA_DA_FARPA, v + PERNA_DA_FARPA, u + PERNA_DA_FARPA, v - PERNA_DA_FARPA, RAIO_DA_FARPA))

  const rV0 = RAIO_DE_TRAVES * fundura
  const rU0 = RAIO_AO_COMPRIDO * fundura
  const alturaDoMeio = rV0
  const inicio = -meioC + rU0
  const vao = 2 * meioC - 2 * rU0
  const lacos = Math.max(2, Math.round(vao / (PASSO_DOS_LACOS * fundura)) + 1)
  const passo = vao / (lacos - 1)

  // Os piquetes: nas duas pontas e repartidos no meio, um pouco para dentro do primeiro e do último laço.
  const vaos = Math.max(1, Math.round((2 * meioC) / (VAO_DOS_PIQUETES * G)))
  const recuoDoPiquete = Math.min(rU0 * 0.6, meioC * 0.2)
  const piquetes = Array.from({ length: vaos + 1 }, (_, i) => -meioC + recuoDoPiquete + ((2 * meioC - 2 * recuoDoPiquete) * i) / vaos)
  for (const u of piquetes) {
    // A sombra do piquete é a do L inteiro, um bastão na diagonal dele: comprida, de quem é alto.
    const pe = tracoDoRolo(u - LADO_DO_PIQUETE / 2, -LADO_DO_PIQUETE / 2, u + LADO_DO_PIQUETE / 2, LADO_DO_PIQUETE / 2, LADO_DO_PIQUETE * 0.4)
    cena.sombras.push({ forma: pe, z: ALTURA_DO_PIQUETE * G, forca: FORCA_DA_SOMBRA_DO_PIQUETE, suave: SUAVE_DA_SOMBRA_DO_LACO }, contato(pe, FORCA_DO_CONTATO_DO_PIQUETE))
  }
  cena.sombras.push(contato(tracoDoRolo(inicio, 0, inicio + vao, 0, GROSSURA_DO_CONTATO), FORCA_DO_CONTATO))

  // Os laços, do primeiro ao último; os de baixo (tom escuro) e os de cima alternam, e cada um faz sombra no anterior.
  for (let i = 0; i < lacos; i += 1) {
    const sorte = hash(i, 3, 41)
    const lado = i % 2 === 0 ? 1 : -1
    const a = lado * (INCLINACAO + (sorte - 0.5) * 2 * INCLINACAO_VARIA)
    const k = 1 + (hash(i, 5, 41) - 0.5) * 2 * TAMANHO_VARIA
    const u = inicio + passo * i
    const v = (hash(i, 7, 41) - 0.5) * 2 * DESVIO_DO_LACO * fundura
    const rU = rU0 * k
    const rV = rV0 * k
    const laco = menos(elipseDoRolo(u, v, rU, rV, a), elipseDoRolo(u, v, rU - GROSSURA_DO_ARAME, rV - GROSSURA_DO_ARAME, a))
    cena.sombras.push({ forma: laco, z: alturaDoMeio, solta: true, forca: FORCA_DA_SOMBRA_DO_LACO, suave: SUAVE_DA_SOMBRA_DO_LACO })
    const tom = i % 2 === 0 ? TOM_DO_LACO_DE_CIMA : TOM_DO_LACO_DE_BAIXO
    cena.partes.push(P(laco, ACO, { tabua: 0, bisel: 0.55, contorno: 0.34, metal: 0.62, tom, semente: 200 + i, projeta: SOMBRA_NO_LACO }))
    // As farpas pela volta do laço, cada uma num ponto sorteado do arco dela.
    for (let f = 0; f < FARPAS_POR_LACO; f += 1) {
      const t = ((f + 0.25 + hash(i, f, 43) * 0.5) / FARPAS_POR_LACO) * Math.PI * 2
      const ca = Math.cos(a)
      const sa = Math.sin(a)
      const pu = (rU - GROSSURA_DO_ARAME / 2) * Math.cos(t)
      const pv = (rV - GROSSURA_DO_ARAME / 2) * Math.sin(t)
      cena.partes.push(P(farpa(u + pu * ca - pv * sa, v + pu * sa + pv * ca), ACO, { tabua: 0, bisel: 0.25, contorno: 0.3, metal: 0.4, tom: tom * TOM_DA_FARPA, semente: 260 + i * 7 + f }))
    }
  }

  // Os piquetes por cima de tudo: o L da cantoneira (duas chapas), com a quina virada para a luz.
  piquetes.forEach((u, i) => {
    const m = LADO_DO_PIQUETE / 2
    const abaDeCima = tracoDoRolo(u - m, -m, u + m, -m, CHAPA_DO_PIQUETE / 2)
    const abaDoLado = tracoDoRolo(u - m, -m, u - m, m, CHAPA_DO_PIQUETE / 2)
    cena.partes.push(P(uniao(abaDeCima, abaDoLado), FERRO_DO_PIQUETE, { tabua: 0, bisel: 0.6, contorno: 0.3, metal: 0.35, semente: 180 + i, projeta: SOMBRA_DO_PIQUETE }))
  })
  cena.corDoPiso = ESCURO_DO_ARAME
}
