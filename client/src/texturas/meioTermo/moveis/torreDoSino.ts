/**
 * TORRE DO SINO de cima com volume (construção do lote L15, 14/11/2026, grupo
 * Cidade e porto): a torre quadrada de pedra de vila, com a PORTA de tábuas e
 * duas SETEIRAS na frente, a CORNIJA no alto, o PEITORIL baixo em volta do
 * piso de lajes e, no meio, a ESPADANA: dois pilares, a verga e o frontão em
 * degraus com a bola no bico, e o SINO de bronze pendurado no vão.
 *
 * De cima: o piso de lajes com o peitoril em volta, os dois pilares e a verga
 * atravessada com o frontão, e o SINO aparecendo dos dois lados da verga (o
 * aro de bronze, o bojo e a coroa, em anéis): é o sino que diz "torre do
 * sino" e não torre de pedra, poço ou chafariz. A sombra comprida vai para
 * baixo à direita, com o recorte da espadana na ponta.
 *
 * NA 3/4 (`tresQuartos.ts`, perfil derivado com a beirada
 * `ESPESSURA_DA_FIADA_DO_SINO`, a altura de uma fiada):
 * - a parede são FIADAS, cada uma só a casca da face da frente em blocos com
 *   as juntas desencontradas (as outras faces não aparecem: o desenho é montado
 *   na tela, `montadaNaTela`, e a frente é sempre a de baixo); a cornija, um
 *   tampo inteiro, tapa o alto;
 * - a porta é uma coluna que sai um tico da parede, e cada seteira, um tampo
 *   escuro que sai um tico mais; a peça de cada uma tem o meio fora da parede;
 * - o rodapé vai em duas metades (a do norte antes da torre, a faixa do sul
 *   depois dela), senão o tampo dele cobriria o pé da parede;
 * - os pilares e a verga são fiadas maciças; o sino são três tampos de bronze,
 *   do aro (o mais largo) à coroa, cada um com um pingo de bronze só dele (a
 *   frente sai de bronze e não de pedra);
 * - a ordem de pintura é dada à mão (`emOrdem`), de baixo para cima.
 *
 * As medidas saem do menor lado da pegada (2 x 2 casas de partida). Materiais:
 * `pedra` e `madeira` (a porta); o bronze, o ferro e o escuro são fixos.
 */
import { hash } from '../../ruido'
import { caixa, elipse, type Forma } from './formas'
import { contato, type MaterialDaPeca, type OpcoesDaPeca } from './motor'
import { BURACO, G, type MontarMovel } from './contexto'
import { arrastada, colunaSemSombra, comMeioEm, emOrdem, fiadaRetangular, montadaNaTela, solta, texturaComSombra, texturaDeLajes, type QueFazSombra } from './andaimeDaTresQuartos'

/** A altura de uma fiada (px do protótipo), a beirada de todo tampo da torre na 3/4. O perfil usa este valor. */
export const ESPESSURA_DA_FIADA_DO_SINO = 0.18 * G

/** Meios lados em fração do menor meio lado: o rodapé, a parede, a cornija e o lado de dentro do peitoril. */
const RODAPE = 0.84
const PAREDE = 0.74
const CORNIJA = 0.8
const DENTRO_DO_PEITORIL = 0.64
/** As alturas, na mesma fração (2 x 2 casas: 1 = uma casa): o rodapé, o piso do alto e o vão da espadana. */
const ALTURA_DO_RODAPE = 0.14
const ALTURA_DO_PISO = 2.5
const ALTURA_DOS_PILARES = 0.86
/** Os pilares: o meio em x, a meia largura e a meia espessura (a da verga e do frontão também). */
const PILAR = { x: 0.48, l: 0.1 }
const MEIA_ESPESSURA_DA_ESPADANA = 0.1
/** O frontão em degraus: a meia largura de cada degrau, de baixo para cima (a verga é o primeiro). */
const DEGRAUS_DO_FRONTAO: readonly number[] = [0.58, 0.44, 0.28, 0.13]
/** O sino: o raio do aro, do bojo e da coroa, e onde a boca começa (acima do piso). */
const SINO = { aro: 0.3, bojo: 0.24, coroa: 0.17, pe: 0.22 }
/** A porta (meia largura e altura) e as seteiras (o meio em x, a altura do pé e a meia largura), em fração. */
const PORTA = { l: 0.17, altura: 0.64 }
const SETEIRAS: readonly (readonly [number, number])[] = [[0, 1.15], [0, 1.85]]
const MEIA_SETEIRA = 0.035
/** A casca de cada bloco (px) e o comprimento do bloco (fração), e quanto a porta e a seteira saem da parede (px). */
const CASCA = 4
const BLOCO = 0.34
const PORTA_SAI = 1.6
const SETEIRA_SAI = 1.3
/** As lajes do piso (px de lado). */
const LAJE: readonly [number, number] = [0.34 * G, 0.25 * G]
/** As sombras no chão: força e borda. */
const FORCA_DA_SOMBRA = 0.34
const BORDA_DA_SOMBRA = 2.6
/** A sombra pintada no piso do alto: borda e força. */
const BORDA_DA_SOMBRA_NO_PISO = 1.4
const FORCA_DA_SOMBRA_NO_PISO = 0.3

const BRONZE: MaterialDaPeca = { classe: 'metal', rgb: [0x86, 0x6c, 0x45] }
const TEX_DO_PISO = texturaDeLajes(LAJE[0], LAJE[1], 1871)

const montarNaTela: MontarMovel = (c, cena) => {
  const P = c.peca
  const R = Math.min(c.hw, c.hh)
  const f = (v: number): number => v * R
  const e = ESPESSURA_DA_FIADA_DO_SINO
  const { pedra, madeira } = c.m
  const L = cena.partes
  const S = cena.sombras
  const daPedra = (semente: number, mais: OpcoesDaPeca = {}): OpcoesDaPeca => ({ bisel: 1.4, contorno: 0.28, semente, ...mais })
  const [rodape, parede, cornija, dentro] = [f(RODAPE), f(PAREDE), f(CORNIJA), f(DENTRO_DO_PEITORIL)]
  const [zRodape, zPiso] = [f(ALTURA_DO_RODAPE), f(ALTURA_DO_PISO)]
  const zPilares = zPiso + f(ALTURA_DOS_PILARES)
  const [px, pl, me] = [f(PILAR.x), f(PILAR.l), f(MEIA_ESPESSURA_DA_ESPADANA)]

  // ---------- as sombras no chão (só a vista de cima as vê) ----------
  S.push(contato(caixa(-rodape, -rodape, rodape, rodape), 0.36))
  S.push({ forma: arrastada(caixa(-parede, -parede, parede, parede), zPiso + e), z: 0, suave: BORDA_DA_SOMBRA, forca: FORCA_DA_SOMBRA })
  const pilares = [-1, 1].map((s) => caixa(s * px - pl, -me, s * px + pl, me))
  for (const pilar of pilares) S.push({ forma: arrastada(pilar, zPilares), z: 0, suave: BORDA_DA_SOMBRA, forca: FORCA_DA_SOMBRA })
  DEGRAUS_DO_FRONTAO.forEach((meia, i) => {
    S.push({ forma: arrastada(caixa(-f(meia), -me, f(meia), me), zPilares + e * (i + 1)), z: 0, suave: BORDA_DA_SOMBRA, forca: FORCA_DA_SOMBRA })
  })

  // ---------- as estruturas da 3/4, na ordem de pintura (de baixo para cima) ----------
  const estruturas: { forma: Forma; z: number; coluna: boolean }[] = []
  const pore = (forma: Forma, z: number, coluna = false): void => {
    estruturas.push({ forma, z, coluna })
  }
  pore(caixa(-rodape, -rodape, rodape, parede), zRodape, true)
  // O miolo da parede, atrás das fiadas da frente: é ele que aparece escuro nas juntas (sem ele, o chão).
  pore(caixa(-parede + 1, -parede, parede - 1, parede - CASCA), zPiso - 1, true)
  const fiadas = Math.ceil(zPiso / e - 0.01)
  const bloco = f(BLOCO)
  for (let k = 0; k < fiadas; k += 1) {
    pore(fiadaRetangular(-parede, parede - CASCA, parede, parede, CASCA, bloco, (k % 2) * bloco * 0.5 + hash(k, 1, 1872) * 2), Math.min(zPiso, e * (k + 1)))
  }
  const [dl, dz] = [f(PORTA.l), f(PORTA.altura)]
  const porta = caixa(-dl, parede - 3, dl, parede + PORTA_SAI)
  pore(porta, dz, true)
  const seteiras = SETEIRAS.map(([x, pe]) => ({ forma: caixa(f(x) - f(MEIA_SETEIRA), parede - 3, f(x) + f(MEIA_SETEIRA), parede + SETEIRA_SAI), z: f(pe) + e }))
  for (const s of seteiras) pore(s.forma, s.z)
  pore(caixa(-rodape, parede, rodape, rodape), zRodape, true)
  // A cornija é uma fiada que sai da parede; o peitoril, um anel de uma fiada em cima dela.
  pore(caixa(-cornija, -cornija, cornija, cornija), zPiso)
  const peitoril: Forma = { b: [-cornija, -cornija, cornija, cornija], d: (x, y) => Math.max(Math.abs(x) - cornija, Math.abs(y) - cornija, dentro - Math.max(Math.abs(x), Math.abs(y))) }
  pore(peitoril, zPiso + e)
  const fiadasDosPilares = Math.ceil(f(ALTURA_DOS_PILARES) / e - 0.01)
  for (let k = 0; k < fiadasDosPilares; k += 1) {
    const z = Math.min(zPilares, zPiso + e * (k + 1))
    for (const pilar of pilares) pore(pilar, z)
  }
  const zBoca = zPiso + f(SINO.pe)
  const sino = [SINO.aro, SINO.bojo, SINO.coroa].map((r, i) => ({ forma: elipse(0, 0, f(r), f(r)), z: zBoca + e * (i + 1) }))
  for (const s of sino) pore(s.forma, s.z)
  DEGRAUS_DO_FRONTAO.forEach((meia, i) => pore(caixa(-f(meia), -me, f(meia), me), zPilares + e * (i + 1)))
  const emPe = emOrdem(
    estruturas.map((x) => x.forma),
    R + PORTA_SAI,
  )
  estruturas.forEach((x, i) => S.push(x.coluna ? colunaSemSombra(emPe[i], x.z) : solta(emPe[i], x.z)))

  // ---------- o rodapé (a peça do norte e a faixa do sul), a porta e as seteiras ----------
  L.push(P(comMeioEm(caixa(-rodape, -rodape, rodape, parede, 1), 0, -(rodape + parede) / 2), pedra, daPedra(18700, { tom: 0.84 })))
  L.push(P(comMeioEm(caixa(-rodape, parede, rodape, rodape, 1), 0, (rodape + parede) / 2), pedra, daPedra(18701, { tom: 0.84 })))
  L.push(P(comMeioEm(caixa(-dl, parede + 0.3, dl, parede + PORTA_SAI, 0.4), 0, parede + PORTA_SAI * 0.7), madeira, { eixo: Math.PI / 2, tabua: 0, bisel: 0.5, contorno: 0.3, tom: 0.9, semente: 18702 }))
  for (const s of seteiras) {
    const [x0, , x1] = s.forma.b
    L.push(P(comMeioEm(caixa(x0, parede + SETEIRA_SAI - 0.6, x1, parede + SETEIRA_SAI), (x0 + x1) / 2, parede + SETEIRA_SAI - 0.3), BURACO, { tabua: 0, bisel: 0, contorno: 0.2, tom: 0.5, semente: 18703 }))
  }

  // ---------- o alto: o piso de lajes (sobe com a cornija) e o peitoril em quatro faixas ----------
  // A sombra dos pilares, da verga, do frontão, do sino e do peitoril, pintada no piso (as alturas acima dele).
  const altoDosPilares = zPilares - zPiso
  const sombrasNoPiso: QueFazSombra[] = [
    { forma: peitoril, de: 0, ate: e },
    ...pilares.map((forma) => ({ forma, de: 0, ate: altoDosPilares })),
    { forma: elipse(0, 0, f(SINO.aro), f(SINO.aro)), de: f(SINO.pe), ate: f(SINO.pe) + 3 * e },
    ...DEGRAUS_DO_FRONTAO.map((meia, i) => ({ forma: caixa(-f(meia), -me, f(meia), me), de: altoDosPilares + e * i, ate: altoDosPilares + e * (i + 1) })),
  ]
  const piso = texturaComSombra(TEX_DO_PISO, sombrasNoPiso, BORDA_DA_SOMBRA_NO_PISO, FORCA_DA_SOMBRA_NO_PISO)
  L.push(P(comMeioEm(caixa(-dentro, -dentro, dentro, dentro), 0, -f(0.5)), pedra, { bisel: 0, contorno: 0.2, tom: 0.92, recesso: { k: 4, forca: 0.4 }, textura: piso, semente: 18711 }))
  const faixas: readonly Forma[] = [
    caixa(-cornija, -cornija, cornija, -dentro, 0.8),
    caixa(-cornija, dentro, cornija, cornija, 0.8),
    caixa(-cornija, -dentro, -dentro, dentro, 0.8),
    caixa(dentro, -dentro, cornija, dentro, 0.8),
  ]
  faixas.forEach((faixa, i) => L.push(P(faixa, pedra, daPedra(18720 + i, { tom: i === 1 || i === 3 ? 0.98 : 1.06 }))))

  // ---------- o sino: o aro, o bojo e a coroa, cada um com o meio no tampo dele e fora da verga ----------
  const [aro, bojo, coroa] = [f(SINO.aro), f(SINO.bojo), f(SINO.coroa)]
  const meios = [(bojo + aro) / 2, (coroa + bojo) / 2, Math.min(coroa - 0.6, me + 0.8)]
  ;[aro, bojo, coroa].forEach((r, i) => {
    L.push(P(comMeioEm(elipse(0, 0, r, r), 0, meios[i]), BRONZE, { bisel: r * 0.4, contorno: 0.28, tom: 1 - 0.07 * i, metal: 0.5, projeta: { dist: 0.8, forca: 0.26 }, semente: 18730 + i }))
  })

  // ---------- os pilares e a verga com o frontão em degraus (cada degrau sobe com o seu), e a bola no bico ----------
  for (const [i, pilar] of pilares.entries()) L.push(P(pilar, pedra, daPedra(18740 + i, { bisel: 1.6, tom: i === 0 ? 1.04 : 0.96 })))
  DEGRAUS_DO_FRONTAO.forEach((meia, i) => {
    const proximo = i + 1 < DEGRAUS_DO_FRONTAO.length ? DEGRAUS_DO_FRONTAO[i + 1] : 0
    L.push(P(comMeioEm(caixa(-f(meia), -me, f(meia), me, 0.8), f((meia + proximo) / 2), 0), pedra, daPedra(18750 + i, { bisel: 1.3, tom: 0.94 + 0.05 * i, projeta: { dist: 1, forca: 0.24 } })))
  })
  const bola = Math.max(1.4, f(0.06))
  L.push(P(elipse(0, 0, bola, bola), pedra, { bisel: bola, contorno: 0.3, tom: 1.12, projeta: { dist: 1, forca: 0.3 }, semente: 18760 }))
}

export const montarTorreDoSino: MontarMovel = montadaNaTela(montarNaTela)
