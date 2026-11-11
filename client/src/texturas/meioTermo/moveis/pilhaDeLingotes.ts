/**
 * PILHA DE LINGOTES de cima com volume (lote 10 dos objetos novos, 11/11/2026):
 * o estoque de metal da oficina do ferreiro. Num ESTRADO de tábuas, as barras
 * em tronco de pirâmide EMPILHADAS EM CAMADAS CRUZADAS: a de baixo ao
 * comprido, a do meio de través e a de cima ao comprido de novo, cada uma
 * menor que a de baixo, então a pilha sobe em degraus. A maioria é de ferro; a
 * fileira da frente da camada de baixo é de COBRE e duas barras são de
 * ESTANHO, claras. Três trazem a MARCA DO FUNDIDOR batida em cima (o olho, a
 * cruz e a estrela de três pontas), e uma barra caiu ao lado do estrado.
 *
 * O que diz "lingote" é o BISEL: cada barra tem a face de cima menor que a
 * base, e as quatro rampas em volta pegam a luz de um lado (a da ponta da
 * esquerda e a de trás, claras) e a perdem do outro. A 25% de zoom sobram os
 * degraus de barras cruzadas, a faixa de cobre na frente e a barra torta ao
 * lado: é o que diz "pilha de lingotes" e não "pilha de caixas" ou "lenha".
 *
 * Materiais: `metal` (as barras de ferro; o latão dá uma pilha de bronze) e
 * `madeira` (o estrado). O cobre e o estanho são fixos: a tabela não tem
 * nenhum dos dois. Escreve `cena.corDoPiso` (o escuro do ferro, como o
 * canhão): com o piso padrão a rampa de ferro na sombra saía marrom. As
 * medidas são de uma pegada de 1 x 0,7 casa e esticam com ela.
 */
import { hash, rgb } from '../../ruido'
import { anel, capsula, caixa, elipse, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, type Cena, type CriarPeca, type MaterialDaPeca } from './motor'
import { PREGO, QUARTO, type MontarMovel } from './contexto'

// ---------- as medidas (px do protótipo, na pegada de partida) ----------

/** A meia pegada de partida (1 x 0,7 casa): tudo abaixo é medido nela e estica com a pegada. */
const MEIA_LARGURA_DE_PARTIDA = 28
const MEIA_ALTURA_DE_PARTIDA = 19.6

/** A barra: o comprimento e a largura da base e o quanto a face de cima recua das pontas e dos lados (o bisel). */
const COMPRIMENTO = 16.5
const LARGURA = 5.6
const RECUO_DA_PONTA = 1.7
const RECUO_DO_LADO = 1.25
/** De uma barra à vizinha da mesma camada: de lado (a largura e o vão) e de ponta (o comprimento e o vão). */
const PASSO_DE_LADO = 6.85
const PASSO_DE_PONTA = 17.9

/** O estrado: o meio dele em x, as meias medidas e a fresta entre as tábuas. */
const MEIO_DO_ESTRADO = -6.7
const MEIA_LARGURA_DO_ESTRADO = 20.6
const MEIA_FUNDURA_DO_ESTRADO = 18.8
const FRESTA_DO_ESTRADO = 0.8
/** O prego da ponta de cada tábua: a que distância da ponta e de cada beira (fração da largura da tábua), e o raio. */
const PREGO_DA_PONTA = 1.5
const PREGO_DA_BEIRA = 0.28
const RAIO_DO_PREGO = 0.55
/**
 * O tom de cada tábua, da esquerda para a direita: tábuas da mesma madeira, de toras diferentes. As tábuas vão
 * de través, e as barras de baixo cruzam por cima delas: ao comprido, as frestas casavam com os vãos das
 * barras e a pilha virava uma grade.
 */
const TONS_DAS_TABUAS: readonly number[] = [1.04, 0.95, 1.08, 0.98, 1.02]
/** As barras não foram assentadas a régua: cada uma escorrega um pouco ao comprido e de través e gira um tico. */
const MEXIDA_AO_COMPRIDO = 0.5
const MEXIDA_DE_TRAVES = 0.2
const MEXIDA_DO_GIRO = 0.03
/** O fundo entre as tábuas: os barrotes de baixo, na sombra delas. */
const TOM_DO_FUNDO = 0.46

/** Alturas em casas: o tampo do estrado e cada camada de barras. */
const ALTURA_DO_ESTRADO = 0.1
const ALTURA_DA_CAMADA = 0.075

// ---------- a luz das rampas e os metais fixos ----------

/** O chão, na direção de onde vem a luz (a do motor: de cima à esquerda). */
const PARA_A_LUZ_X = -0.79
const PARA_A_LUZ_Y = -0.61
/**
 * Cada rampa é uma faceta plana com a luz dela: clareia o quanto a beira olha para a luz (e a do outro lado
 * escurece), menos um tanto que todas perdem por serem mais em pé que a face de cima. Sem chanfro e sem
 * contorno: a faixa escura do contorno cobria meia rampa e o lingote lia como bandeja, rebaixado.
 */
const FORCA_DAS_RAMPAS = 0.42
const SOMBRA_DAS_RAMPAS = 0.1
/** As normais dos quatro lados, na ordem dos cantos (atrás, a ponta da direita, a frente, a ponta da esquerda), antes do giro. */
const NORMAIS_DOS_LADOS: readonly Ponto[] = [[0, -1], [1, 0], [0, 1], [-1, 0]]
/** A face de cima, de chapa para a luz: o tom, a luz e o brilho do metal. */
const TOM_DO_TOPO = 1.04
const LUZ_DO_TOPO = 0.04
const BRILHO_DO_TOPO = 0.2
/** O fio escuro em volta da barra (a base que sobra por fora das rampas): a largura (px de partida) e o tom. */
const FIO = 0.35
const TOM_DO_FIO = 0.5
/** A sombra que a barra faz na de baixo e no estrado (px de partida): é o que mostra os degraus da pilha. */
const SOMBRA_DA_BARRA = 1.8
const FORCA_DA_SOMBRA_DA_BARRA = 0.42

/** O cobre: castanho-avermelhado contido (o vivo do cobre novo passava do teto de saturação). */
const COBRE: MaterialDaPeca = { classe: 'metal', rgb: [0xa8, 0x6e, 0x52] }
/** O estanho: cinza claro e um pouco quente, quase branco. */
const ESTANHO: MaterialDaPeca = { classe: 'metal', rgb: [0xc4, 0xc3, 0xbc] }
/** O escuro em que o pixel escuro demais é levantado: o cinza-escuro quente do canhão e do cofre. */
const ESCURO_DO_FERRO = rgb('#4a4541')

/** O tamanho da marca do fundidor (raio, px de partida), o escuro dela e a beira clara do lado de baixo. */
const RAIO_DA_MARCA = 1.3
const TOM_DA_MARCA = 0.6
const TOM_DA_BEIRA_DA_MARCA = 1.3
const BEIRA_DA_MARCA = 0.35

// ---------- a pilha ----------

type Liga = 'metal' | 'cobre' | 'estanho'
type Marca = 'olho' | 'cruz' | 'estrela'

interface Barra {
  /** O meio, em px de partida. */
  readonly x: number
  readonly y: number
  /** 0 = ao comprido (em x); `QUARTO` = de través. */
  readonly ang: number
  readonly liga: Liga
  readonly tom: number
  readonly marca?: Marca
}

/** O tom de cada barra: o mesmo metal de fundições diferentes. */
function tomDaBarra(i: number, j: number): number {
  return 0.96 + 0.16 * hash(i, j, 4711)
}
/**
 * O tom de cada camada, de baixo para cima: a de baixo fica no fundo da pilha, sem luz entre as barras, e a de
 * cima pega a luz inteira. Com as três no mesmo tom, as camadas de ferro se fundiam numa mancha escura.
 */
const TONS_DAS_CAMADAS: readonly number[] = [0.86, 1, 1.12]

/** Um valor entre -1 e 1, sempre o mesmo para a mesma barra. */
function sorteio(i: number, j: number, semente: number): number {
  return hash(i, j, semente) * 2 - 1
}

/** A barra como foi assentada à mão: escorregada um pouco ao comprido e de través e girada um tico. */
function assentada(b: Barra, i: number, j: number): Barra {
  const ao = sorteio(i, j, 4811) * MEXIDA_AO_COMPRIDO
  const de = sorteio(i, j, 4813) * MEXIDA_DE_TRAVES
  const co = Math.cos(b.ang)
  const si = Math.sin(b.ang)
  return { ...b, x: b.x + ao * co - de * si, y: b.y + ao * si + de * co, ang: b.ang + sorteio(i, j, 4817) * MEXIDA_DO_GIRO }
}

/** A camada de baixo, ao comprido: duas colunas de cinco fileiras; a da frente é de cobre e uma de trás, de estanho. */
const CAMADA_DE_BAIXO: readonly Barra[] = [-2, -1, 0, 1, 2].flatMap((fileira) =>
  [-0.5, 0.5].map((coluna, j): Barra => {
    const atras = fileira === -2
    const liga: Liga = fileira === 2 ? 'cobre' : atras && j === 1 ? 'estanho' : 'metal'
    const b: Barra = { x: MEIO_DO_ESTRADO + coluna * PASSO_DE_PONTA, y: fileira * PASSO_DE_LADO, ang: 0, liga, tom: tomDaBarra(fileira, j), marca: atras && j === 0 ? 'olho' : undefined }
    return assentada(b, fileira, j)
  }),
)
/** A camada do meio, de través: cinco barras lado a lado, no meio da de baixo. */
const CAMADA_DO_MEIO: readonly Barra[] = [-2, -1, 0, 1, 2].map((i): Barra =>
  assentada({ x: MEIO_DO_ESTRADO + i * PASSO_DE_LADO, y: 0, ang: QUARTO, liga: 'metal', tom: tomDaBarra(i, 7), marca: i === -2 ? 'cruz' : undefined }, i, 7),
)
/** A camada de cima, ao comprido: duas barras, a de trás de estanho. */
const CAMADA_DE_CIMA: readonly Barra[] = [
  assentada({ x: MEIO_DO_ESTRADO, y: -PASSO_DE_LADO / 2, ang: 0, liga: 'estanho', tom: 1 }, 0, 9),
  assentada({ x: MEIO_DO_ESTRADO, y: PASSO_DE_LADO / 2, ang: 0, liga: 'metal', tom: 1.04, marca: 'estrela' }, 1, 9),
]
const CAMADAS: readonly (readonly Barra[])[] = [CAMADA_DE_BAIXO, CAMADA_DO_MEIO, CAMADA_DE_CIMA]
/** A barra que caiu ao lado do estrado, torta no chão. */
const CAIDA: Barra = { x: 20.8, y: 1.6, ang: 1.1, liga: 'metal', tom: 0.92 }

// ---------- as peças ----------

/** A pegada estica a pilha: x e y de partida multiplicados por estes. */
interface Escala {
  readonly sx: number
  readonly sy: number
  /** O que é redondo (pregos, marcas) e as sombras curtas: o menor dos dois. */
  readonly k: number
}

/** Os quatro cantos do retângulo de meias medidas (a, b), girado `ang` em volta de (cx, cy), já na pegada. */
function cantos(cx: number, cy: number, a: number, b: number, ang: number, e: Escala): Ponto[] {
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  const canto = (u: number, v: number): Ponto => [(cx + u * co - v * si) * e.sx, (cy + u * si + v * co) * e.sy]
  return [canto(-a, -b), canto(a, -b), canto(a, b), canto(-a, b)]
}

/** A marca do fundidor em volta de (x, y): o olho (anel com ponto), a cruz ou a estrela de três pontas. */
function formaDaMarca(marca: Marca, x: number, y: number, r: number): Forma {
  const traco = r * 0.24
  if (marca === 'olho') return uniao(anel(x, y, r, r, r * 0.58, r * 0.58), elipse(x, y, r * 0.24, r * 0.24))
  if (marca === 'cruz') return uniao(capsula(x - r, y, x + r, y, traco), capsula(x, y - r, x, y + r, traco))
  let estrela = capsula(x, y, x, y - r, traco)
  for (const ang of [Math.PI / 6, (5 * Math.PI) / 6]) estrela = uniao(estrela, capsula(x, y, x + Math.cos(ang) * r, y + Math.sin(ang) * r, traco))
  return estrela
}

/** A base da barra (as rampas): é também a forma da sombra dela no chão. */
function baseDaBarra(b: Barra, e: Escala): Forma {
  return poligono(cantos(b.x, b.y, COMPRIMENTO / 2, LARGURA / 2, b.ang, e))
}

/**
 * Uma barra: o fio escuro em volta (é a base, que também faz a sombra dela), as quatro rampas, cada uma
 * uma faceta com a luz do lado para onde olha, a face de cima e, se tiver, a marca batida (a beira clara
 * embaixo e o fundo escuro). Usa as sementes de `semente` a `semente + 7`.
 */
function porBarra(P: CriarPeca, cena: Cena, b: Barra, mat: MaterialDaPeca, e: Escala, semente: number): void {
  const L = cena.partes
  const fora = cantos(b.x, b.y, COMPRIMENTO / 2 - FIO, LARGURA / 2 - FIO, b.ang, e)
  const dentro = cantos(b.x, b.y, COMPRIMENTO / 2 - RECUO_DA_PONTA, LARGURA / 2 - RECUO_DO_LADO, b.ang, e)
  L.push(P(baseDaBarra(b, e), mat, { tabua: 0, bisel: 0, tom: b.tom * TOM_DO_FIO, contorno: 0, metal: 0, semente, projeta: { dist: SOMBRA_DA_BARRA * e.k, forca: FORCA_DA_SOMBRA_DA_BARRA } }))
  const co = Math.cos(b.ang)
  const si = Math.sin(b.ang)
  NORMAIS_DOS_LADOS.forEach(([nx, ny], i) => {
    const j = (i + 1) % NORMAIS_DOS_LADOS.length
    const paraALuz = (nx * co - ny * si) * PARA_A_LUZ_X + (nx * si + ny * co) * PARA_A_LUZ_Y
    const rampa = poligono([fora[i], fora[j], dentro[j], dentro[i]])
    L.push(P(rampa, mat, { tabua: 0, eixo: b.ang, bisel: 0, tom: b.tom, luz: FORCA_DAS_RAMPAS * paraALuz - SOMBRA_DAS_RAMPAS, contorno: 0, metal: 0, semente: semente + 1 + i }))
  })
  L.push(P(poligono(dentro), mat, { tabua: 0, eixo: b.ang, bisel: 0, tom: b.tom * TOM_DO_TOPO, luz: LUZ_DO_TOPO, contorno: 0, metal: BRILHO_DO_TOPO, semente: semente + 5 }))
  if (b.marca === undefined) return
  const marca = formaDaMarca(b.marca, b.x * e.sx, b.y * e.sy, RAIO_DA_MARCA * e.k)
  const beira = BEIRA_DA_MARCA * e.k
  L.push(P(marca, mat, { dx: beira, dy: beira, bisel: 0, contorno: 0, metal: 0, tom: b.tom * TOM_DA_BEIRA_DA_MARCA, semente: semente + 6 }))
  L.push(P(marca, mat, { bisel: 0, contorno: 0, metal: 0, tom: b.tom * TOM_DA_MARCA, semente: semente + 7 }))
}

/** A caixa em volta das barras de uma camada (a forma da sombra dela no chão). */
function caixaDaCamada(barras: readonly Barra[], e: Escala): Forma {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const b of barras) {
    for (const [x, y] of cantos(b.x, b.y, COMPRIMENTO / 2, LARGURA / 2, b.ang, e)) {
      x0 = Math.min(x0, x)
      y0 = Math.min(y0, y)
      x1 = Math.max(x1, x)
      y1 = Math.max(y1, y)
    }
  }
  return caixa(x0, y0, x1, y1, 0.8)
}

/** O estrado: o fundo escuro, as tábuas de través com as frestas entre elas e os pregos das pontas. */
function porEstrado(P: CriarPeca, cena: Cena, mad: MaterialDaPeca, e: Escala): Forma {
  const L = cena.partes
  const x0 = (MEIO_DO_ESTRADO - MEIA_LARGURA_DO_ESTRADO) * e.sx
  const x1 = (MEIO_DO_ESTRADO + MEIA_LARGURA_DO_ESTRADO) * e.sx
  const y0 = -MEIA_FUNDURA_DO_ESTRADO * e.sy
  const y1 = MEIA_FUNDURA_DO_ESTRADO * e.sy
  const estrado = caixa(x0, y0, x1, y1, 0.8)
  L.push(P(estrado, mad, { tabua: 0, bisel: 0.6, tom: TOM_DO_FUNDO, contorno: 0.3, semente: 7001 }))
  const tabuas = TONS_DAS_TABUAS.length
  const fresta = FRESTA_DO_ESTRADO * e.sx
  const largura = (x1 - x0 - (tabuas - 1) * fresta) / tabuas
  const r = RAIO_DO_PREGO * e.k
  TONS_DAS_TABUAS.forEach((tom, j) => {
    const tx0 = x0 + j * (largura + fresta)
    L.push(P(caixa(tx0, y0, tx0 + largura, y1, 0.6), mad, { eixo: QUARTO, tabua: 0, bisel: 0.9, tom, contorno: 0.26, semente: 7010 + j }))
    for (const py of [y0 + PREGO_DA_PONTA * e.sy, y1 - PREGO_DA_PONTA * e.sy]) {
      for (const f of [PREGO_DA_BEIRA, 1 - PREGO_DA_BEIRA]) {
        L.push(P(elipse(tx0 + largura * f, py, r, r), PREGO, { bisel: r, contorno: 0.15, metal: 0.3 }))
      }
    }
  })
  return estrado
}

export const montarPilhaDeLingotes: MontarMovel = (c, cena) => {
  const { g, peca: P } = c
  const sx = c.hw / MEIA_LARGURA_DE_PARTIDA
  const sy = c.hh / MEIA_ALTURA_DE_PARTIDA
  const e: Escala = { sx, sy, k: Math.min(sx, sy) }
  const ligas: Readonly<Record<Liga, MaterialDaPeca>> = { metal: c.m.metal, cobre: COBRE, estanho: ESTANHO }

  const estrado = porEstrado(P, cena, c.m.madeira, e)
  porBarra(P, cena, CAIDA, ligas[CAIDA.liga], e, 7100)
  CAMADAS.forEach((camada, i) => camada.forEach((b, j) => porBarra(P, cena, { ...b, tom: b.tom * TONS_DAS_CAMADAS[i] }, ligas[b.liga], e, 7200 + i * 100 + j * 8)))

  // As sombras: o estrado, cada camada (mais alta e mais para dentro que a de baixo) e a barra caída.
  const caida = baseDaBarra(CAIDA, e)
  cena.sombras.push({ forma: estrado, z: g * ALTURA_DO_ESTRADO }, contato(estrado, 0.3))
  CAMADAS.forEach((camada, i) => cena.sombras.push({ forma: caixaDaCamada(camada, e), z: g * (ALTURA_DO_ESTRADO + (i + 1) * ALTURA_DA_CAMADA), forca: 0.28 }))
  cena.sombras.push({ forma: caida, z: g * ALTURA_DA_CAMADA }, contato(caida, 0.32))
  cena.corDoPiso = ESCURO_DO_FERRO
}
