/**
 * As VERSÕES do alçapão (L01 do plano de arte por tema, 28/11/2026): a 1ª, Fechado, é o desenho de `MONTADORES`
 * (`../alcapao.ts`); o ABERTO é o mesmo batente, agora em volta do BURACO escuro, com a ESCADA de mão descendo no
 * escuro (as tábuas somem com a fundura), e a TAMPA caída para trás, deitada no chão do lado das dobradiças, de
 * barriga para cima: as tábuas pelo avesso, as duas travessas pregadas e as pontas dos cravos das cintas.
 *
 * O batente e os nós das dobradiças são os de hoje, peça por peça (a cena sai do desenho base e daqui só se tiram a
 * tampa, as cintas, a argola e a chapa): trocar a versão não mexe no quadro. A tampa deitada passa da pegada para o
 * lado de trás (a pegada é a do buraco); o mestre gira o objeto para escolher onde ela cai. Objeto de chão, como o
 * de hoje: na 3/4 fica rente, só os nós sobem um nada. Lugares de material: `madeira` e `ferragens`, os do alçapão.
 */
import type { VersoesDesenhadas } from '.'
import { hash, type Rgb } from '../../../ruido'
import { montarAlcapao } from '../alcapao'
import { QUARTO, type ContextoDoMovel, type MontarMovel } from '../contexto'
import { caixa, elipse, poligono, type Ponto } from '../formas'
import { contato, type Cena, type CriarPeca, type MaterialDaPeca, type Peca } from '../motor'

/** As medidas do alçapão (copiadas de `../alcapao.ts`, que não as exporta): a folga da beira, o batente e a fresta da tampa (px). */
const FOLGA = 0.6
const BATENTE = 3.8
const FRESTA = 1.15
/** O eixo das dobradiças: o meio do nó, este tanto acima da beira de dentro do batente de trás (px). */
const EIXO_ACIMA_DO_BATENTE = 0.6
/** A tábua de partida e a junta entre duas (px), as do desenho base: a tampa deitada tem as mesmas tábuas. */
const TABUA = 9.4
const JUNTA = 0.55
/** As cintas de cima (agora por baixo): o comprimento em fração da tampa e o lugar em fração da meia largura. */
const CINTA = { comprimento: 0.6, lugar: 0.5 } as const
/** As sementes do desenho base que ficam: as quatro réguas do batente e os dois nós das dobradiças. */
const SEMENTES_QUE_FICAM: ReadonlySet<number> = new Set([4010, 4011, 4012, 4013, 4039, 4041])

/**
 * O fundo do buraco e a pedra das paredes de dentro. O escuro do buraco é neutro (`ESCURO_DO_BURACO`, o piso de luz
 * da cena): com o da nogueira, o padrão, o fundo levantado saía marrom-avermelhado e lia como tampa pintada. Ele fica
 * no limite do portão da folha (luz mínima 0,043): com 0x34 a luz caía a 0,030 e a peça saía reprovada.
 */
const FUNDO: MaterialDaPeca = { classe: 'liso', rgb: [0x26, 0x22, 0x20] }
const ESCURO_DO_BURACO: Rgb = [0x41, 0x3c, 0x38]
const PEDRA_DA_PAREDE: MaterialDaPeca = { classe: 'pedra', rgb: [0x7a, 0x70, 0x66], pedra: 'granito' }
/** As paredes de dentro vistas da boca: a largura de cada uma (px) e a luz (a de baixo e a da direita pegam a luz que entra). */
const PAREDES_DE_DENTRO = { frente: 5.2, direita: 4.2, fundo: 3, esquerda: 3.4 } as const
/** A escada no buraco: a meia largura, onde o pé fica (fração da fundura do buraco, a partir da beira da frente) e quantos degraus. */
const ESCADA = { meiaLargura: 6.2, pe: 0.66, degraus: 5, banzo: 1.05, degrau: 0.85 } as const
/** As travessas da tampa deitada: o meio de cada uma (fração do comprimento) e a largura (px). */
const TRAVESSAS: readonly number[] = [0.2, 0.8]
const LARGURA_DA_TRAVESSA = 5.6

/** O batente de hoje: a cena do desenho base só com as réguas e os nós (e as sombras deles e o contato). */
function soOBatente(c: ContextoDoMovel, cena: Cena): void {
  const ficam = new Set<Peca>()
  const P: CriarPeca = (forma, mat, o) => {
    const peca = c.peca(forma, mat, o)
    if (o?.semente !== undefined && SEMENTES_QUE_FICAM.has(o.semente)) ficam.add(peca)
    return peca
  }
  const base: Cena = { partes: [], sombras: [] }
  montarAlcapao({ ...c, peca: P }, base)
  cena.partes.push(...base.partes.filter((p) => ficam.has(p)))
  // Ficam o contato do quadro e as sombras dos nós (atrás); sai a da chapa da argola (na frente).
  cena.sombras.push(...base.sombras.filter((s) => s.z === 0 || s.forma.b[3] < 0))
}


/**
 * O buraco visto da boca: o fundo escuro, e as quatro paredes de dentro descendo da beira, em meia-esquadria, como
 * as do poço. A da frente e a da direita pegam a luz que entra pela boca; a de trás e a da esquerda ficam na sombra da
 * beira. Por cima, o escuro do fundo, que come o pé da escada.
 */
function buraco(P: CriarPeca, L: Peca[], x0: number, y0: number, x1: number, y1: number): void {
  const fundura = y1 - y0
  const W = PAREDES_DE_DENTRO
  const [i0, j0, i1, j1] = [x0 + W.esquerda, y0 + W.fundo, x1 - W.direita, y1 - W.frente]
  L.push(P(caixa(x0, y0, x1, y1, 0.5), FUNDO, { tabua: 0, bisel: 0, contorno: 0.14, tom: 1, semente: 4100 }))
  const paredes: readonly (readonly [readonly Ponto[], number, number])[] = [
    [[[x0, y1], [i0, j1], [i1, j1], [x1, y1]], 0.72, 0],
    [[[x1, y0], [x1, y1], [i1, j1], [i1, j0]], 0.58, QUARTO],
    [[[x0, y0], [x1, y0], [i1, j0], [i0, j0]], 0.34, 0],
    [[[x0, y0], [i0, j0], [i0, j1], [x0, y1]], 0.4, QUARTO],
  ]
  paredes.forEach(([pontos, tom, eixo], i) => L.push(P(poligono(pontos), PEDRA_DA_PAREDE, { eixo, tabua: 0, bisel: 0, tom, contorno: 0.1, suave: 0.8, semente: 4101 + i })))
  L.push(P(caixa(i0, j0, i1, j1, 0.4), FUNDO, { tabua: 0, bisel: 0, contorno: 0.2, tom: 1, recesso: { k: 4, forca: 0.5 }, semente: 4105 }))
  L.push(P(elipse((x0 + x1) / 2 - 1, y0 + fundura * 0.38, (x1 - x0) * 0.36, fundura * 0.3), FUNDO, { tabua: 0, bisel: 0, contorno: 0, tom: 0.8, alfa: 0.6, suave: 6, semente: 4106 }))
}

/** A escada de mão descendo da beira da frente para o fundo: os banzos e os degraus escurecem com a fundura. */
function escada(P: CriarPeca, L: Peca[], madeira: MaterialDaPeca, y0: number, y1: number): void {
  const yPe = y1 - (y1 - y0) * ESCADA.pe
  const m = ESCADA.meiaLargura
  const trechos = 4
  for (let i = 0; i < trechos; i += 1) {
    const a = y1 + 0.4 - ((y1 + 0.4 - yPe) * i) / trechos
    const b = y1 + 0.4 - ((y1 + 0.4 - yPe) * (i + 1)) / trechos
    const fundo = (i + 0.5) / trechos
    for (const lado of [-1, 1]) {
      // O banzo afina um nada para o fundo (mais longe de quem olha).
      const x = lado * (m - 0.5 * fundo)
      L.push(P(caixa(x - ESCADA.banzo, b - 0.3, x + ESCADA.banzo, a, 0.4), madeira, { eixo: QUARTO, tabua: 0, bisel: 0.6, tom: 0.92 - 0.62 * fundo, alfa: 1 - 0.4 * fundo, contorno: 0.22, semente: 4110 + i * 2 + (lado > 0 ? 1 : 0) }))
    }
  }
  for (let j = 0; j < ESCADA.degraus; j += 1) {
    const t = (j + 0.6) / ESCADA.degraus
    const y = y1 - (y1 - yPe) * t
    const meia = m - 0.5 * t
    L.push(P(caixa(-meia, y - ESCADA.degrau, meia, y + ESCADA.degrau, 0.4), madeira, { eixo: 0, tabua: 0, bisel: 0.55, tom: 0.98 - 0.66 * t, alfa: 1 - 0.45 * t, contorno: 0.22, semente: 4120 + j }))
  }
}

/** A tampa caída para trás, deitada no chão de barriga para cima, entre `ya` (a ponta longe) e `yb` (a beira das dobradiças). */
function tampaCaida(P: CriarPeca, cena: Cena, madeira: MaterialDaPeca, ferro: MaterialDaPeca, x0: number, x1: number, ya: number, yb: number): void {
  const L = cena.partes
  const largura = x1 - x0
  const comprido = yb - ya
  cena.sombras.push(contato(caixa(x0, ya, x1, yb, 0.6), 0.3))
  const n = Math.max(3, Math.round(largura / TABUA))
  const passo = largura / n
  for (let i = 0; i < n; i += 1) {
    const a = x0 + i * passo + (i === 0 ? 0 : JUNTA / 2)
    const b = x0 + (i + 1) * passo - (i === n - 1 ? 0 : JUNTA / 2)
    // O avesso é a madeira que não pegou sol: mais clara e mais lisa que a de cima, com a tábua de reparo também.
    const tom = 0.86 + 0.1 * hash(i, 7, 4130) + (i === n - 2 ? 0.08 : 0)
    L.push(P(caixa(a, ya, b, yb, 0.4), madeira, { eixo: QUARTO, tabua: 0, bisel: 0.8, tom, contorno: 0.26, projeta: { dist: 0.6, forca: 0.22 }, semente: 4131 + i }))
  }
  // As travessas pregadas por baixo, que agora ficam por cima, com dois cravos em cada tábua.
  TRAVESSAS.forEach((f, k) => {
    const y = ya + comprido * f
    const meia = LARGURA_DA_TRAVESSA / 2
    L.push(P(caixa(x0 + 1.2, y - meia, x1 - 1.2, y + meia, 0.6), madeira, { eixo: 0, tabua: 0, bisel: 1, tom: 0.74, contorno: 0.3, projeta: { dist: 0.9, forca: 0.32 }, semente: 4140 + k }))
    for (let i = 0; i < n; i += 1) {
      const x = x0 + (i + 0.5) * passo
      for (const dy of [-1.2, 1.2]) L.push(P(elipse(x + (hash(i, k, 4142) - 0.5) * 1.6, y + dy, 0.6, 0.6), ferro, { tabua: 0, bisel: 0.5, tom: 0.85, contorno: 0.2, semente: 4143 }))
    }
  })
  // As pontas dos cravos das cintas, que atravessam a tampa: a fila de cada cinta, do lado das dobradiças.
  for (const lado of [-1, 1]) {
    const x = lado * (largura / 2) * CINTA.lugar
    for (let k = 0; k < 3; k += 1) {
      const y = yb - 3 - k * ((comprido * CINTA.comprimento - 6) / 2)
      L.push(P(elipse(x, y, 0.65, 0.65), ferro, { tabua: 0, bisel: 0.55, tom: 0.8, contorno: 0.2, semente: 4150 + k }))
    }
  }
}

const montarAlcapaoAberto: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  soOBatente(c, cena)
  cena.corDoPiso = ESCURO_DO_BURACO
  const [x0, y0, x1, y1] = [-hw + FOLGA, -hh + FOLGA, hw - FOLGA, hh - FOLGA]
  const [bx0, by0, bx1, by1] = [x0 + BATENTE, y0 + BATENTE, x1 - BATENTE, y1 - BATENTE]
  const L = cena.partes
  buraco(P, L, bx0, by0, bx1, by1)
  escada(P, L, c.m.madeira, by0, by1)
  // A tampa virou no eixo das dobradiças: o que era a beira de trás dela fica rente ao eixo, do outro lado.
  const eixo = by0 - EIXO_ACIMA_DO_BATENTE
  const [ty0, ty1] = [by0 + FRESTA, by1 - FRESTA]
  tampaCaida(P, cena, c.m.madeira, c.m.ferragens, bx0 + FRESTA, bx1 - FRESTA, 2 * eixo - ty1, 2 * eixo - ty0)
}

export const versoesDoAlcapao: VersoesDesenhadas = {
  aberto: montarAlcapaoAberto,
}
