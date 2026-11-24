/**
 * CATRE DE FERRO de cima com volume (lote L01 dos objetos de 24/11/2026, "Prisão: ferro e cela"; a versão de ferro do
 * catre). A cama de cela que desce da parede: a PAREDE é a beira de cima da pegada (giro 0), com as duas DOBRADIÇAS
 * onde o quadro se apoia. O QUADRO é de cantoneira e o ESTRADO, de barras chatas atravessadas e duas cintas ao
 * comprido; duas CORRENTES descem dos chumbadores da parede até as quinas da frente do quadro e o seguram no ar. Em
 * cima, o COLCHÃO fino de lona crua, com o vivo da costura, uma só depressão mansa onde se deita e uma mancha velha
 * quase apagada; nos pés, o COBERTOR de lã cinza quente dobrado, largo no sentido do comprimento, com a beira de cima
 * mais clara (a dobra pegando a luz) e uma lista escura. O colchão não chega ao pé do quadro: ali as barras do
 * estrado ficam à mostra, claras, com o chão escuro entre elas (lê grade, e não buraco). Desenho original: só a
 * ideia do móvel de cadeia.
 *
 * Pendurado, sem pé: a sombra é a de um tampo solto na altura do catre (o quadro, as dobradiças e as correntes juntos)
 * e a sombra de baixo, no chão, logo em volta. Na 3/4 (DERIVADO) o catre sobe inteiro e mostra a beirada da
 * cantoneira. Medidas por casa (2 x 1 de partida, deitado ao longo da parede). Sem material escolhido: o ferro, a lona
 * e o cobertor são fixos.
 */
import { anel, caixa, capsula, elipse, menos, uniao, type Forma, type Ponto } from './formas'
import { ruido, type MaterialDaPeca, type Peca, type Textura } from './motor'
import { G, type MontarMovel } from './contexto'
import { elosAoLongo, texDoElo } from './corrente'
import { ESCURO_DO_FERRO, FERRO_DA_PRISAO, rebite, texFerroGasto } from './cadeiraDeFerro'
import { girar } from './grilhoesDeParede'

/** A altura do quadro do catre, em casas. */
const ALTURA = 0.42
/** A lona crua do colchão: castanho acinzentado, gasta. */
const LONA: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0x9b, 0x91, 0x77] }
/** O cobertor de lã num cinza quente (o cinza-azulado lia como livro ou travesseiro) e a lista escura dele. */
const COBERTOR: MaterialDaPeca = { classe: 'tecido', fio: 'la', rgb: [0x80, 0x7c, 0x74] }
const LISTA: MaterialDaPeca = { classe: 'tecido', fio: 'la', rgb: [0x55, 0x50, 0x4a] }
/** A mancha velha do colchão (suor e anos), quase apagada. */
const MANCHA: MaterialDaPeca = { classe: 'liso', rgb: [0x6b, 0x5b, 0x45] }
/** O chão que se vê entre as barras do estrado: só ele escurece, o ferro não. */
const CHAO_DO_ESTRADO: MaterialDaPeca = { classe: 'liso', rgb: [0x2c, 0x29, 0x26] }
/** Quanto o chão entre as barras escurece: com 0,5 o vão ficava no tom das barras e a grade sumia. */
const ALFA_DO_CHAO_DO_ESTRADO = 0.85

/** As medidas, em px da pegada de partida (2 x 1 casa): o quadro, a aba da cantoneira e o colchão. */
const QUADRO = { lado: 1.4, fundo: 2.4, frente: 1.6 } as const
const ABA = 2.5
const PASSO_DAS_BARRAS = 6.4
const TOM_DAS_BARRAS = 0.95
const COLCHAO = { lado: 3.4, fundo: 4.4, frente: 3.9, pe: 15 } as const
/** A depressão onde o corpo afunda (uma só, mansa) e a mancha velha. */
const ALFA_DA_DEPRESSAO = 0.3
const ALFA_DA_MANCHA = 0.08
/** O cobertor dobrado, do pé do quadro para dentro (px): largo no sentido do comprimento do catre. */
const COBERTOR_DOBRADO = { de: 40, ate: 14, fundo: 5.2, frente: 8 } as const
/** O cobertor não fica alinhado com o catre: foi jogado ali (radianos). */
const GIRO_DO_COBERTOR = 0.05
const PASSO_DOS_ELOS = 3.5

/**
 * A lona do colchão: a trama do linho bem mais mansa (o fio fino do motor, a 0,08, fazia um listrado horizontal que
 * lia como chapa ondulada) e um grão largo e fraco, de pano gasto.
 */
const texDaLona: Textura = (u, v, _x, _y, p, s) => {
  const tela = ((Math.floor(u * 1.4) + Math.floor(v * 1.4)) & 1) === 1 ? 0.008 : -0.008
  s[3] += ruido(u * 0.05 + p.semente * 5, v * 1.15) * 0.022 + ruido(u * 0.11 + p.su, v * 0.11 + p.sv) * 0.05 + ruido(u * 0.6, v * 0.6) * 0.03 + tela
}

export const montarCatreDeFerro: MontarMovel = (c, cena) => {
  const { hw, hh, w, h, g, peca: P } = c
  const k = Math.min(w / (2 * G), h / G)
  const L = cena.partes
  cena.corDoPiso = ESCURO_DO_FERRO
  const z = g * ALTURA

  // O QUADRO de cantoneira: a caixa de fora, a de dentro (o vão do estrado) e as correntes, das quinas da frente até
  // os chumbadores da parede.
  const [x0, y0, x1, y1] = [-hw + QUADRO.lado * k, -hh + QUADRO.fundo * k, hw - QUADRO.lado * k, hh - QUADRO.frente * k]
  const fora = caixa(x0, y0, x1, y1, 1 * k)
  const dentro = caixa(x0 + ABA * k, y0 + ABA * k, x1 - ABA * k, y1 - ABA * k, 0.4 * k)
  const correntes = [-1, 1].map((lado): readonly Ponto[] => {
    const xQuina = lado < 0 ? x0 + 1.3 * k : x1 - 1.3 * k
    const xParede = lado < 0 ? -hw + 3.6 * k : hw - 3.6 * k
    return [[xParede, -hh + 1.6 * k], [(xParede + xQuina) / 2 + lado * 0.5 * k, 0], [xQuina, y1 - 1.3 * k]]
  })

  // As sombras: o catre inteiro é um tampo solto (com as correntes e as dobradiças junto da parede) e o chão debaixo
  // dele escurece logo em volta.
  const noAr = correntes.map((cj) => capsulaPelos(cj, 1.2 * k)).reduce(uniao, caixa(x0, -hh, x1, y1, 1 * k))
  cena.sombras.push({ forma: noAr, z, solta: true, suave: 2, forca: 0.3 }, { forma: caixa(x0 - 1, y0 - 1, x1 + 1, y1 + 1, 2), z: 0, suave: 2.4, forca: 0.3 })

  // A grossura do quadro, um fio embaixo à direita: antes do estrado, que a cobre por dentro (por cima dele ela
  // apagava as barras do pé).
  L.push(P(fora, FERRO_DA_PRISAO, { dx: 0.3 * k, dy: 1.2 * k, tabua: 0, bisel: 0.5 * k, tom: 0.56, contorno: 0.3, semente: 24750 }))

  // O ESTRADO: o chão escuro entre as barras, as barras atravessadas (claras, de contorno firme) e as duas cintas ao
  // comprido, debaixo do colchão (à mostra no pé).
  const [ix0, iy0, ix1, iy1] = dentro.b
  L.push(P(dentro, CHAO_DO_ESTRADO, { tabua: 0, bisel: 0, contorno: 0, alfa: ALFA_DO_CHAO_DO_ESTRADO, semente: 24700 }))
  const barras = Math.max(2, Math.round((ix1 - ix0) / (PASSO_DAS_BARRAS * k)))
  for (let i = 0; i <= barras; i += 1) {
    const x = ix0 + ((ix1 - ix0) * i) / barras
    const barra = caixa(x - 0.9 * k, iy0 - 0.4 * k, x + 0.9 * k, iy1 + 0.4 * k, 0.3 * k)
    L.push(P(barra, FERRO_DA_PRISAO, { tabua: 0, bisel: 0.5 * k, tom: TOM_DAS_BARRAS, metal: 0.3, contorno: 0.3, textura: texFerroGasto(barra, 0.7), semente: 24701 + i }))
  }
  for (const f of [0.32, 0.68]) {
    const y = iy0 + (iy1 - iy0) * f
    const cinta = caixa(ix0 - 0.4 * k, y - 0.75 * k, ix1 + 0.4 * k, y + 0.75 * k, 0.3 * k)
    L.push(P(cinta, FERRO_DA_PRISAO, { tabua: 0, bisel: 0.5 * k, tom: 0.92, metal: 0.32, contorno: 0.24, textura: texFerroGasto(cinta, 0.6, 0.15), semente: 24740 + Math.round(f * 10), projeta: { dist: 0.5 * k, forca: 0.3 } }))
  }

  // O QUADRO por cima do estrado, com um rebite em cada quina.
  const quadro = menos(fora, dentro)
  L.push(P(quadro, FERRO_DA_PRISAO, { tabua: 0, bisel: 1 * k, tom: 1.02, metal: 0.34, contorno: 0.26, textura: texFerroGasto(fora, 1, 0.1), semente: 24751 }))
  for (const [qx, qy] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]] as const) {
    L.push(rebite(P, qx + Math.sign(-qx) * ABA * 0.5 * k, qy + Math.sign(-qy) * ABA * 0.5 * k, 0.8 * k, 24752 + Math.sign(qx) + 2 * Math.sign(qy)))
  }

  // As DOBRADIÇAS na parede: a chapa e o pino em que o quadro de trás se apoia.
  for (const lado of [-1, 1]) {
    const x = lado * (x1 - x0) * 0.3
    const chapa = caixa(x - 3.2 * k, -hh, x + 3.2 * k, y0 + 0.2 * k, 0.5 * k)
    L.push(P(chapa, FERRO_DA_PRISAO, { tabua: 0, bisel: 0.6 * k, tom: 0.84, metal: 0.3, contorno: 0.28, textura: texFerroGasto(chapa, 1), semente: 24760 + lado }))
    L.push(P(capsula(x - 2.2 * k, y0 + 0.9 * k, x + 2.2 * k, y0 + 0.9 * k, 0.9 * k), FERRO_DA_PRISAO, { tabua: 0, bisel: 0.7 * k, tom: 1.12, metal: 0.45, contorno: 0.26, semente: 24763 + lado }))
  }

  // O COLCHÃO de lona: o corpo fofo (a trama mansa), o vivo da costura, a depressão onde se deita e a mancha velha.
  const cx1 = x1 - COLCHAO.pe * k
  const colchao = caixa(x0 + COLCHAO.lado * k, y0 + COLCHAO.fundo * k - 2.4 * k, cx1, y1 - COLCHAO.frente * k + 1.6 * k, 3 * k)
  L.push(P(colchao, LONA, { tabua: 0, bisel: 2.8 * k, ruga: 1.5, contorno: 0.2, textura: texDaLona, semente: 24770, projeta: { dist: 1.4 * k, forca: 0.32, suave: 1.2 * k } }))
  const [mx0, my0, mx1, my1] = colchao.b
  const vivo = menos(caixa(mx0 + 1.5 * k, my0 + 1.5 * k, mx1 - 1.5 * k, my1 - 1.5 * k, 2 * k), caixa(mx0 + 2.1 * k, my0 + 2.1 * k, mx1 - 2.1 * k, my1 - 2.1 * k, 1.6 * k))
  L.push(P(vivo, LONA, { tabua: 0, bisel: 0, contorno: 0, tom: 0.82, alfa: 0.55, textura: texDaLona, semente: 24771 }))
  L.push(P(elipse(mx0 + (mx1 - mx0) * 0.42, (my0 + my1) / 2 + 0.6 * k, (mx1 - mx0) * 0.3, (my1 - my0) * 0.28), LONA, { tabua: 0, bisel: 0, contorno: 0, tom: 0.86, alfa: ALFA_DA_DEPRESSAO, suave: 4.5 * k, textura: texDaLona, semente: 24772 }))
  L.push(P(elipse(mx0 + (mx1 - mx0) * 0.24, (my0 + my1) / 2 - 2.6 * k, 6.5 * k, 3.8 * k), MANCHA, { tabua: 0, bisel: 0, contorno: 0, alfa: ALFA_DA_MANCHA, suave: 2.4 * k, semente: 24773 }))

  // O COBERTOR dobrado nos pés, um pouco torto e largo no sentido do comprimento: a dobra de baixo aparecendo um fio
  // embaixo à direita, o corpo de lã de quinas moles, a beira de cima mais clara (a dobra que pega a luz) e uma só
  // lista escura atravessada. Passa um nada da ponta do colchão: caiu ali, não foi posto.
  const [bx0, bx1] = [x1 - COBERTOR_DOBRADO.de * k, x1 - COBERTOR_DOBRADO.ate * k]
  const [by0, by1] = [y0 + COBERTOR_DOBRADO.fundo * k, y1 - COBERTOR_DOBRADO.frente * k]
  const torto = (f: Forma): Forma => girar(f, (bx0 + bx1) / 2, (by0 + by1) / 2, GIRO_DO_COBERTOR)
  L.push(P(torto(caixa(bx0 + 0.5 * k, by0 + 1.3 * k, bx1 + 0.6 * k, by1 + 1.2 * k, 2.6 * k)), COBERTOR, { tabua: 0, bisel: 1.4 * k, ruga: 1.2, tom: 0.78, contorno: 0.2, semente: 24780, projeta: { dist: 1.2 * k, forca: 0.3, suave: 1 * k } }))
  const corpo = torto(caixa(bx0, by0, bx1, by1, 2.8 * k))
  L.push(P(corpo, COBERTOR, { tabua: 0, bisel: 2.2 * k, ruga: 1.6, tom: 0.97, contorno: 0.18, semente: 24781, projeta: { dist: 1 * k, forca: 0.3, suave: 0.9 * k } }))
  L.push(P(torto(capsula(bx0 + 2.4 * k, by0 + 1.3 * k, bx1 - 2.4 * k, by0 + 1.3 * k, 1.1 * k)), COBERTOR, { tabua: 0, bisel: 1 * k, ruga: 0.6, tom: 1.16, contorno: 0, alfa: 0.85, semente: 24784 }))
  // A lista atravessa a dobra de cima de ponta a ponta (perto do pé e em pé ela lia como lombada de livro).
  const yLista = by0 + (by1 - by0) * 0.7
  L.push(P(torto(caixa(bx0 + 0.8 * k, yLista - 0.75 * k, bx1 - 0.8 * k, yLista + 0.75 * k, 0.4 * k)), LISTA, { tabua: 0, bisel: 0.4 * k, ruga: 0.8, contorno: 0, alfa: 0.72, semente: 24786 }))

  // As CORRENTES: o chumbador na parede, os elos até a quina e a argola que pega o quadro.
  correntes.forEach((pontos, n) => {
    const [px, py] = pontos[0]
    L.push(P(elipse(px, py, 1.9 * k, 1.5 * k), FERRO_DA_PRISAO, { tabua: 0, bisel: 0.9 * k, tom: 0.9, metal: 0.36, contorno: 0.28, semente: 24790 + n }))
    const [qx, qy] = pontos[pontos.length - 1]
    L.push(P(anel(qx, qy, 1.9 * k, 1.9 * k, 1 * k, 1 * k), FERRO_DA_PRISAO, { tabua: 0, bisel: 0.5 * k, tom: 1.06, metal: 0.45, contorno: 0.3, semente: 24792 + n }))
    const elos = elosAoLongo(pontos, PASSO_DOS_ELOS * k, false)
    const pecas: Peca[] = []
    elos.forEach((e, i) => {
      const peca = P(e.forma, FERRO_DA_PRISAO, { tabua: 0, bisel: e.meio * (e.deitado ? 0.12 : 0.17), tom: e.deitado ? 0.98 : 1.1, metal: e.deitado ? 0.45 : 0.5, contorno: 0.3, textura: texDoElo(e, 0.55), semente: 24800 + n * 40 + i, projeta: { dist: 1.6 * k, forca: 0.26, suave: 1 * k } })
      if (e.deitado) L.push(peca)
      else pecas.push(peca)
    })
    L.push(...pecas)
  })
}

/** A cápsula pelos pontos do caminho (a sombra de uma corrente esticada). */
function capsulaPelos(pontos: readonly Ponto[], r: number): Forma {
  return pontos.slice(1).map((p, i): Forma => capsula(pontos[i][0], pontos[i][1], p[0], p[1], r)).reduce(uniao)
}
