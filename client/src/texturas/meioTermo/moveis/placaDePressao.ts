/**
 * PLACA DE PRESSÃO (L01 do plano de arte por tema, 28/11/2026, temas Dungeons e Prisão; fila de 24/11): a laje solta
 * no piso da masmorra que dispara a armadilha. Uma PLACA de pedra lisa, um nada acima do piso, cercada por uma FRESTA
 * escura e por uma MOLDURA de quatro blocos em meia-esquadria; no meio, o SULCO redondo gasto pelos pés (o da placa
 * na soleira da armadilha de espinhos) e, nos cantos, os quatro PINOS de ferro que a prendem ao mecanismo. Em volta,
 * a sujeira que junta na fresta.
 *
 * Três versões no mesmo tipo (`versoes/placaDePressaoVersoes.ts`):
 * - QUADRADA (a 1ª, `montarPlacaDePressao`);
 * - LOSANGO (`montarPlacaDePressaoLosango`): a mesma placa de quina, menor para a ponta caber na pegada;
 * - AFUNDADA (`montarPlacaDePressaoAfundada`): a quadrada já pisada. A placa desceu: a beira de cima e da esquerda da
 *   moldura faz sombra nela, a parede de baixo e da direita da cova pega a luz, e a fresta abre.
 *
 * Objeto de chão (as fichas passam por cima), rente: na 3/4 fica como de cima. A 1x (50 px por casa) sobram o
 * quadrado claro, a fresta escura em volta e o anel do meio: "laje que não é do chão". Tudo sai do menor lado da
 * pegada (1 x 1 casa de partida). Material: `pedra` (a placa e a moldura); o ferro dos pinos e a sujeira são fixos.
 */
import { hash } from '../../ruido'
import { anel, elipse, poligono, type Forma, type Ponto } from './formas'
import { contato, type Cena, type MaterialDaPeca } from './motor'
import type { ContextoDoMovel, MontarMovel } from './contexto'

/** O escuro da fresta e do sulco (o da armadilha de espinhos), o ferro dos pinos e a sujeira em volta. */
const ESCURO_DA_FRESTA: MaterialDaPeca = { classe: 'liso', rgb: [0x38, 0x36, 0x34] }
const FERRO_DOS_PINOS: MaterialDaPeca = { classe: 'metal', rgb: [0x70, 0x6c, 0x68] }
const SUJEIRA: MaterialDaPeca = { classe: 'liso', rgb: [0x5a, 0x4e, 0x42] }

/** As medidas em frações do menor lado da pegada: a meia placa, a fresta, a moldura e a sujeira em volta. */
const MEIA_PLACA = 0.31
const FRESTA = 0.026
const MOLDURA = 0.06
const SUJEIRA_EM_VOLTA = 0.04
/** O sulco: o raio em fração da meia placa e a largura do risco (px). */
const SULCO = 0.32
const LARGURA_DO_SULCO = 0.6
/** Os pinos: o lugar (fração da meia placa, nas diagonais) e o raio (px). */
const LUGAR_DOS_PINOS = 0.8
const RAIO_DO_PINO = 0.95
/** O losango encolhe para a ponta caber na pegada. */
const ENCOLHE_NO_LOSANGO = 0.74
/** A afundada: o quanto a placa encolhe (a fresta abre) e a faixa clara da parede da cova que pega luz (px). */
const FRESTA_A_MAIS = 0.7
const PAREDE_DA_COVA = 1.7

interface Feitio {
  /** O giro da placa no desenho: 0 (quadrada) ou meia volta de quina (losango). */
  readonly giro: number
  readonly afundada: boolean
}

const CANTOS: readonly Ponto[] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
]

function montarPlaca(c: ContextoDoMovel, cena: Cena, feitio: Feitio): void {
  const P = c.peca
  const pedra = c.m.pedra
  const L = cena.partes
  const lado = Math.min(c.w, c.h)
  const s = feitio.giro === 0 ? 1 : ENCOLHE_NO_LOSANGO
  const co = Math.cos(feitio.giro)
  const si = Math.sin(feitio.giro)
  const gira = (x: number, y: number): Ponto => [x * co - y * si, x * si + y * co]
  const quadrado = (r: number): Forma => poligono(CANTOS.map(([x, y]) => gira(x * r, y * r)))
  const rf = (MEIA_PLACA + FRESTA) * lado * s
  const rp = MEIA_PLACA * lado * s - (feitio.afundada ? FRESTA_A_MAIS : 0)
  const ro = rf + MOLDURA * lado * s

  // A sujeira que junta em volta e o contato da moldura com o piso.
  L.push(P(quadrado(ro + SUJEIRA_EM_VOLTA * lado), SUJEIRA, { bisel: 0, contorno: 0, alfa: 0.22, suave: 2.4, semente: 3001 }))
  cena.sombras.push(contato(quadrado(ro), 0.16))

  // A MOLDURA: quatro blocos em meia-esquadria, cada um com o veio ao comprido e um tom.
  CANTOS.forEach(([ax, ay], i) => {
    const [bx, by] = CANTOS[(i + 1) % CANTOS.length]
    const pontos: Ponto[] = [gira(ax * ro, ay * ro), gira(bx * ro, by * ro), gira(bx * rf, by * rf), gira(ax * rf, ay * rf)]
    const eixo = (i % 2 === 0 ? 0 : Math.PI / 2) + feitio.giro
    L.push(P(poligono(pontos), pedra, { eixo, tabua: 0, bisel: 1, tom: 0.76 + 0.1 * hash(i, 1, 3002), contorno: 0.26, semente: 3003 + i }))
  })

  // A FRESTA escura entre a moldura e a placa.
  L.push(P(quadrado(rf), ESCURO_DA_FRESTA, { bisel: 0, contorno: 0.14, semente: 3010 }))
  if (feitio.afundada) {
    // A parede da cova do lado de baixo e da direita (NA TELA) pega a luz: uma faixa de pedra clara rente à moldura.
    const dentro = rf - PAREDE_DA_COVA
    const [c1, c2, c3] = [gira(rf, -rf), gira(rf, rf), gira(-rf, rf)]
    const [d1, d2, d3] = [gira(dentro, -dentro), gira(dentro, dentro), gira(-dentro, dentro)]
    L.push(P(poligono([c1, c2, c3, d3, d2, d1]), pedra, { tabua: 0, bisel: 0, tom: 0.9, contorno: 0, alfa: 0.85, suave: 0.6, semente: 3011 }))
  }

  // A PLACA: lisa e mais clara que a moldura; de pé, faz sombra na fresta; afundada, recebe a sombra da beira.
  const placa = quadrado(rp)
  if (feitio.afundada) {
    L.push(P(placa, pedra, { tabua: 0, bisel: 1.2, tom: 0.84, contorno: 0.24, recesso: { k: 3.2, forca: 0.5 }, semente: 3012 }))
  } else {
    L.push(P(placa, pedra, { tabua: 0, bisel: 1.4, tom: 0.98, contorno: 0.26, projeta: { dist: 1.1, forca: 0.42 }, semente: 3012 }))
  }

  // O SULCO gasto no meio e o miolo mais liso, que os pés poliram.
  const rs = rp * SULCO
  L.push(P(elipse(0, 0, rs - LARGURA_DO_SULCO, rs - LARGURA_DO_SULCO), pedra, { tabua: 0, bisel: 0.8, tom: feitio.afundada ? 0.9 : 1.06, contorno: 0, alfa: 0.55, semente: 3013 }))
  L.push(P(anel(0, 0, rs, rs, rs - LARGURA_DO_SULCO, rs - LARGURA_DO_SULCO), ESCURO_DA_FRESTA, { bisel: 0, contorno: 0, alfa: 0.55, semente: 3014 }))

  // Os PINOS de ferro nos quatro cantos da placa.
  CANTOS.forEach(([x, y], i) => {
    const [px, py] = gira(x * rp * LUGAR_DOS_PINOS, y * rp * LUGAR_DOS_PINOS)
    L.push(P(elipse(px, py, RAIO_DO_PINO, RAIO_DO_PINO), FERRO_DOS_PINOS, { tabua: 0, bisel: 0.8, tom: 0.92 + 0.1 * hash(i, 2, 3002), contorno: 0.26, semente: 3015 + i }))
  })
}

export const montarPlacaDePressao: MontarMovel = (c, cena) => {
  montarPlaca(c, cena, { giro: 0, afundada: false })
}

export const montarPlacaDePressaoLosango: MontarMovel = (c, cena) => {
  montarPlaca(c, cena, { giro: Math.PI / 4, afundada: false })
}

export const montarPlacaDePressaoAfundada: MontarMovel = (c, cena) => {
  montarPlaca(c, cena, { giro: 0, afundada: true })
}
