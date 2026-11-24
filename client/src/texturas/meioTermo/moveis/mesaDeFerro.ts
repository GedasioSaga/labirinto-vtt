/**
 * MESA DE FERRO de cima com volume (lote L01 dos objetos de 24/11/2026, "Prisão: ferro e cela"; a versão de ferro da
 * mesa): a mesa do guarda e do refeitório da cadeia, chumbada no chão. O TAMPO é de chapa, recuado da pegada, com a
 * dobra da beira aparecendo embaixo e a quina gasta mais clara; cada chapa tem uma casa de comprimento, e onde uma
 * encontra a outra corre a TIRA da emenda, com uma fileira de rebites. Em volta, perto da beira, os REBITES que
 * prendem a chapa ao quadro de baixo. Os PÉS são de CANTONEIRA: o L de ferro aparece em cada quina, de fora do tampo.
 * No meio, uns RISCOS claros de prato e caneca arrastados. Desenho original: só a ideia do móvel de cadeia.
 *
 * A FERRUGEM fica nas quinas da chapa e nas pontas dos pés (`texFerroGasto`), com umas manchas fracas pela chapa.
 * As sombras são as da mesa de madeira (`mesaComPernas.ts`): a de baixo, pesada, logo em volta do tampo; a do tampo,
 * solta e mais clara; e cada pé uma coluna com o contato. Na 3/4 (DERIVADO) o tampo sobe e os quatro L descem até o
 * chão. As medidas são por casa: a mesa de 3 x 1 ganha uma chapa e uma emenda a mais, não rebites maiores. Sem
 * material escolhido: o ferro é fixo.
 */
import { hash } from '../../ruido'
import { caixa, capsula, uniao, type Forma } from './formas'
import { contato, type CriarPeca, type MaterialDaPeca, type Peca, type Sombra, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import { ESCURO_DO_FERRO, FERRO_DA_PRISAO, rebite, texFerroGasto } from './cadeiraDeFerro'

/** Altura do tampo, em casas (a da mesa de madeira). */
const ALTURA_EM_CASAS = 0.5
/** Medidas em casas: o recuo do tampo (por onde os pés aparecem), o lado e a aba do L da cantoneira. */
const RECUO_DO_TAMPO = 0.075
const LADO_DA_CANTONEIRA = 0.15
const ABA_DA_CANTONEIRA = 0.042
const RAIO_DA_QUINA = 0.035
/** A dobra da chapa que aparece embaixo e um fio à direita (casas). */
const DOBRA_EMBAIXO = 0.03
const DOBRA_A_DIREITA = 0.008
/** A quina gasta: a faixa clara em volta do tampo (casas) e a luz somada na beira. */
const BORDA_CLARA = 0.05
const LUZ_DA_BORDA = 0.16
/** Os rebites da beira: o passo entre eles, quanto ficam para dentro e o raio (casas). */
const PASSO_DOS_REBITES = 0.165
const DENTRO_DOS_REBITES = 0.045
const RAIO_DO_REBITE = 0.017
/** A tira da emenda entre duas chapas (casas). */
const LARGURA_DA_TIRA = 0.072
/** Os riscos claros do meio: o tom (um cinza claro do próprio ferro) e a força. */
const RISCO: MaterialDaPeca = { classe: 'liso', rgb: [0x9c, 0x9a, 0x94] }
const QUANTOS_RISCOS = 7

/** As sombras no chão: a de baixo e a do tampo (como a mesa de madeira). */
const FORCA_DA_SOMBRA_DE_BAIXO = 0.4
const FORCA_DA_SOMBRA_DO_TAMPO = 0.22

type Quina = readonly [number, number]
const QUINAS: readonly Quina[] = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
]

/** O tampo de ferro: o metal gasto e a quina clara, que cresce do fim da faixa até a beira. */
function texDoTampo(tampo: Forma, largura: number): Textura {
  const gasto = texFerroGasto(tampo, 0.95, 0.14)
  return (u, v, x, y, p, s, escala) => {
    gasto(u, v, x, y, p, s, escala)
    const t = -tampo.d(x, y)
    if (t < largura) s[3] += LUZ_DA_BORDA * (1 - (t > 0 ? t : 0) / largura)
  }
}

/** O L da cantoneira na quina (sx, sy): uma aba ao longo de cada beira de fora da pegada. */
function cantoneira(hw: number, hh: number, sx: number, sy: number, lado: number, aba: number): Forma {
  const x0 = sx < 0 ? -hw : hw - lado
  const y0 = sy < 0 ? -hh : hh - lado
  const yAba = sy < 0 ? -hh : hh - aba
  const xAba = sx < 0 ? -hw : hw - aba
  return uniao(caixa(x0, yAba, x0 + lado, yAba + aba, aba * 0.3), caixa(xAba, y0, xAba + aba, y0 + lado, aba * 0.3))
}

/** Os rebites ao longo de uma reta, do começo ao fim, com as duas pontas. */
function rebitesNaReta(P: CriarPeca, ax: number, ay: number, bx: number, by: number, passo: number, r: number, semente: number): Peca[] {
  const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / passo))
  return Array.from({ length: n + 1 }, (_, i) => rebite(P, ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n, r, semente + i, 1.08 + 0.08 * hash(i, semente, 2411)))
}

export const montarMesaDeFerro: MontarMovel = (c, cena) => {
  const { hw, hh, w, h, g, peca: P } = c
  const casa = Math.min(g, w, h)
  const L = cena.partes
  cena.corDoPiso = ESCURO_DO_FERRO
  const altura = g * ALTURA_EM_CASAS
  const recuo = RECUO_DO_TAMPO * casa
  const [x0, y0, x1, y1] = [-hw + recuo, -hh + recuo, hw - recuo, hh - recuo]
  const tampo = caixa(x0, y0, x1, y1, RAIO_DA_QUINA * casa)
  const pes = QUINAS.map(([sx, sy]) => cantoneira(hw, hh, sx, sy, LADO_DA_CANTONEIRA * casa, ABA_DA_CANTONEIRA * casa))

  // As sombras: a de baixo (pesada, logo em volta do tampo), a do tampo (solta) e a de cada pé.
  const alem = 0.025 * casa
  const sombras: Sombra[] = [
    { forma: caixa(x0 - alem, y0 - alem, x1 + alem, y1 + alem, RAIO_DA_QUINA * casa + alem), z: 0, suave: alem, forca: FORCA_DA_SOMBRA_DE_BAIXO },
    { forma: tampo, z: altura, solta: true, suave: 1.8, forca: FORCA_DA_SOMBRA_DO_TAMPO },
  ]
  for (const pe of pes) sombras.push(contato(pe, 0.34), { forma: pe, z: altura, suave: 0.9, forca: 0.3 })
  cena.sombras.push(...sombras)

  // Os PÉS de cantoneira (na sombra do tampo, mais escuros), a DOBRA da chapa e o TAMPO.
  pes.forEach((pe, i) => L.push(P(pe, FERRO_DA_PRISAO, { tabua: 0, bisel: 0.7, tom: 0.72, metal: 0.3, contorno: 0.26, textura: texFerroGasto(pe, 1), semente: 24201 + i })))
  L.push(P(tampo, FERRO_DA_PRISAO, { dx: DOBRA_A_DIREITA * casa, dy: DOBRA_EMBAIXO * casa, tabua: 0, bisel: 0.7, contorno: 0.26, tom: 0.56, semente: 24205 }))
  L.push(P(tampo, FERRO_DA_PRISAO, { tabua: 0, bisel: 1.5, tom: 1.02, metal: 0.3, contorno: 0.16, textura: texDoTampo(tampo, BORDA_CLARA * casa), semente: 24206 }))

  // Os RISCOS de prato e caneca arrastados, no meio do tampo (fixos: toda mesa de ferro foi usada do mesmo jeito).
  for (let i = 0; i < QUANTOS_RISCOS; i += 1) {
    const cx = (hash(i, 1, 2421) - 0.5) * (x1 - x0) * 0.62
    const cy = (hash(i, 2, 2421) - 0.5) * (y1 - y0) * 0.5
    const a = (hash(i, 3, 2421) - 0.5) * 1.4
    const meio = (0.05 + 0.07 * hash(i, 4, 2421)) * casa
    const [dx, dy] = [Math.cos(a) * meio, Math.sin(a) * meio]
    L.push(P(capsula(cx - dx, cy - dy, cx + dx, cy + dy, 0.24), RISCO, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.22 + 0.12 * hash(i, 5, 2421), semente: 24210 + i }))
  }

  // A TIRA de cada emenda (uma chapa por casa ao longo do lado maior), com a fileira de rebites no meio.
  const deitada = x1 - x0 >= y1 - y0
  const comprimento = deitada ? x1 - x0 : y1 - y0
  const chapas = Math.max(1, Math.round(comprimento / casa))
  const meiaTira = (LARGURA_DA_TIRA * casa) / 2
  const r = RAIO_DO_REBITE * casa
  const dentro = DENTRO_DOS_REBITES * casa
  const passo = PASSO_DOS_REBITES * casa
  for (let j = 1; j < chapas; j += 1) {
    const m = (deitada ? x0 : y0) + (comprimento * j) / chapas
    const tira = deitada ? caixa(m - meiaTira, y0 + 0.6, m + meiaTira, y1 - 0.6, 0.6) : caixa(x0 + 0.6, m - meiaTira, x1 - 0.6, m + meiaTira, 0.6)
    L.push(P(tira, FERRO_DA_PRISAO, { tabua: 0, bisel: 0.8, tom: 1.06, metal: 0.36, contorno: 0.22, textura: texFerroGasto(tira, 0.8, 0.2), semente: 24220 + j, projeta: { dist: 0.7, forca: 0.3, suave: 0.7 } }))
    const pontas = deitada ? [m, y0 + dentro, m, y1 - dentro] : [x0 + dentro, m, x1 - dentro, m]
    L.push(...rebitesNaReta(P, pontas[0], pontas[1], pontas[2], pontas[3], passo * 0.62, r, 24230 + j * 20))
  }

  // Os REBITES da beira: as quatro beiras, sem repetir a quina.
  const [rx0, ry0, rx1, ry1] = [x0 + dentro, y0 + dentro, x1 - dentro, y1 - dentro]
  L.push(...rebitesNaReta(P, rx0, ry0, rx1, ry0, passo, r, 24300))
  L.push(...rebitesNaReta(P, rx0, ry1, rx1, ry1, passo, r, 24350))
  L.push(...rebitesNaReta(P, rx0, ry0, rx0, ry1, passo, r, 24400).slice(1, -1))
  L.push(...rebitesNaReta(P, rx1, ry0, rx1, ry1, passo, r, 24450).slice(1, -1))
}
