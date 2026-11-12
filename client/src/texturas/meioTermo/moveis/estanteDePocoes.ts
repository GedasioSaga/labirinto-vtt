/**
 * ESTANTE DE POÇÕES de cima com volume (lote 13 dos objetos novos,
 * 11/11/2026): a estante de alquimista encostada na parede, de madeira escura,
 * com a fileira de gavetas de baixo (puxador de latão e etiqueta de papel em
 * cada uma) e as prateleiras cheias de vidro: balões de fundo redondo, garrafas
 * de gargalo comprido com rolha ou lacre de cera, tubos de ensaio num suporte,
 * frascos facetados de tampa de vidro, potes de barro com pano amarrado, a
 * redoma com uma raiz seca ou uma caveira de passarinho, o almofariz com o
 * pilão e teias de aranha nos cantos. Os líquidos são de cores vivas mas
 * contidas (verde, vermelho, azul, âmbar e violeta); é o vidro com o líquido
 * colorido e o brilho que diz "poção", e não lombada de livro (a estante de
 * livros) nem caixote (a prateleira de depósito). Não é fonte de luz.
 *
 * A montagem é a da estante de livros (`estanteDeLivros.ts`): o corpo é uma
 * coluna até o tampo, e a frente da pegada é cortada em frestas finas, uma por
 * prateleira, cada uma um tampo solto na altura da sua prateleira. O que está
 * numa prateleira é desenhado de frente, com o meio da caixa na fresta dela
 * (`naFresta`): a 3/4 sobe cada prateleira à sua altura. De cima, as prateleiras
 * de baixo ficam escondidas pelo tampo e a de cima aparece na frente dele, como
 * na estante de livros; no tampo, um balão, o almofariz e uma teia.
 *
 * Os sorteios (a `variante` troca a arrumação inteira) e a madeira (`madeira`)
 * vêm do objeto; o vidro, os líquidos, o papel, a cera e o latão são fixos.
 */
import { hash, type Rgb } from '../../ruido'
import { anel, cadeia, caixa, capsula, dentroDe, elipse, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, type CriarPeca, type MaterialDaPeca, type OpcoesDaPeca, type Peca, type Projecao, type Textura } from './motor'
import { materialDaPeca, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

// ---------- a estante (as medidas da estante de livros, para as duas ficarem da mesma família) ----------

/** A altura até o tampo, o rodapé, a grossura da tábua e a beira do tampo, em casas. */
const ALTURA = 1.6
const RODAPE = 0.07
const TABUA = 0.06
const BEIRA_DO_TAMPO = 0.06
/** O vão de uma prateleira: o maior (casas), o menor (px) e a fração dele na de cima. */
const VAO_MAXIMO = 0.25
const VAO_MINIMO = 5
const VAO_DE_CIMA = 0.8
/** A prateleira guardada tem de caber debaixo do tampo com esta folga (px). */
const FOLGA_DO_GUARDADO = 2.5
/** A largura de um vão entre divisórias, em casas. */
const LARGURA_DO_VAO = 1
/** Os montantes dos lados, a divisória, a fresta de cada prateleira e a cantoneira da frente, em px. */
const MONTANTE = 2.6
const DIVISORIA = 2.2
const FRESTA = 0.25
const CANTONEIRA = 0.5
const TOM_DO_MONTANTE = 0.8
const TOM_DA_TABUA = 0.92
/** O fundo escuro das prateleiras e a sombra que a tábua de cima faz nele. */
const TOM_DO_FUNDO = 0.56
const SOMBRA_DO_FUNDO = 0.2

/** As gavetas da fileira de baixo: quantas por vão, a moldura (px), o puxador e a etiqueta (frações da gaveta). */
const GAVETAS_POR_VAO = 3
const MOLDURA_DA_GAVETA = 0.8
const PUXADOR = 0.55
const ETIQUETA_DA_GAVETA = { largura: 0.46, altura: 0.26, acima: 0.2 }

/** O que fica entre um vidro e o próximo (px), mais um tanto sorteado. */
const ENTRE_VIDROS = 0.35
const FOLGA_SORTEADA = 0.7
/** Cada vidro faz uma sombra curta no fundo e no vizinho. */
const SOMBRA_DO_VIDRO: Projecao = { dist: 0.7, forca: 0.24, suave: 0.5 }
/** A chance de um vão ter teia no canto de cima e o tamanho dela (px). */
const CHANCE_DE_TEIA = 0.4
const TEIA = 4.6

/** Semente dos sorteios (a `variante` do objeto troca a arrumação inteira). */
const SEMENTE = 7600
const SEMENTES_POR_VARIANTE = 131
const SEMENTES_POR_LINHA = 16

// ---------- os materiais ----------

/** O vidro: claro e meio transparente, com o brilho de metal nas beiras. */
const VIDRO: MaterialDaPeca = { classe: 'liso', rgb: [0xb2, 0xc2, 0xba] }
const BRILHO: MaterialDaPeca = { classe: 'liso', rgb: [0xf2, 0xf4, 0xee] }
const ROLHA: MaterialDaPeca = { classe: 'liso', rgb: [0xb8, 0x96, 0x68] }
const PAPEL: MaterialDaPeca = { classe: 'liso', rgb: [0xdc, 0xd0, 0xb2] }
const CERA: MaterialDaPeca = { classe: 'liso', rgb: [0x8a, 0x36, 0x32] }
const OSSO: MaterialDaPeca = { classe: 'liso', rgb: [0xd8, 0xcc, 0xb0] }
const RAIZ: MaterialDaPeca = { classe: 'liso', rgb: [0x7a, 0x5c, 0x3e] }
const PANO: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0xc8, 0xbc, 0x9c] }
const BARBANTE: MaterialDaPeca = { classe: 'liso', rgb: [0x9a, 0x82, 0x5c] }
const ESCURO: MaterialDaPeca = { classe: 'liso', rgb: [0x24, 0x1a, 0x14] }
const PO: MaterialDaPeca = { classe: 'liso', rgb: [0xa8, 0x94, 0x6a] }
const LATAO = materialDaPeca('latao')
const BARRO = materialDaPeca('barro')
const PEDRA = materialDaPeca('granito')
/** Os líquidos: verde, vermelho, azul, âmbar e violeta, vivos mas contidos. */
const LIQUIDOS: readonly MaterialDaPeca[] = [
  { classe: 'liso', rgb: [0x5f, 0x96, 0x5c] },
  { classe: 'liso', rgb: [0xa8, 0x48, 0x4c] },
  { classe: 'liso', rgb: [0x4c, 0x6e, 0xa6] },
  { classe: 'liso', rgb: [0xbc, 0x8e, 0x52] },
  { classe: 'liso', rgb: [0x7e, 0x5a, 0x9e] },
]
/** A tinta das etiquetas e o fio da teia. */
const TINTA: Rgb = [0x4e, 0x3e, 0x36]
const COR_DA_TEIA: Rgb = [0xdc, 0xdc, 0xd6]

const SEM_BORDA: OpcoesDaPeca = { bisel: 0, contorno: 0 }

// ---------- as contas de lugar ----------

/** Uma prateleira guardada debaixo do tampo, em y da vista de cima (a conta da estante de livros). */
interface Prateleira {
  /** 0 = a de baixo (a das gavetas). */
  readonly linha: number
  /** Onde a tábua apoia (a beira de baixo dela): o começo da fresta. */
  readonly base: number
  /** A altura livre, da tábua até a tábua de cima. */
  readonly vao: number
  /** O meio da fresta: todas as peças da prateleira têm o meio da caixa aqui. */
  readonly meio: number
}

/**
 * A mesma forma com a caixa de pintura de `topo` até o espelho dele em volta
 * de `meio`: o desenho não muda, mas o meio da caixa, que é o que a 3/4 lê
 * para saber em que estrutura a peça está, cai na fresta.
 */
function naFresta(forma: Forma, topo: number, meio: number): Forma {
  return { b: [forma.b[0], topo, forma.b[2], 2 * meio - topo], d: (x, y) => forma.d(x, y) }
}

/** O lugar de uma peça de frente numa prateleira: a fábrica de peças, a lista, a guarda na fresta, o chão e a altura do vão. */
interface Lugar {
  readonly P: CriarPeca
  readonly L: Peca[]
  readonly guardar: (forma: Forma) => Forma
  readonly chao: number
  readonly alto: number
  readonly madeira: MaterialDaPeca
  readonly semente: number
}

type Sorte = (k: number) => number

/** Mistura `cor` na cor do ponto com o peso `k` (0 a 1). */
function misturar(s: Float32Array, cor: Rgb, k: number): void {
  s[0] += (cor[0] - s[0]) * k
  s[1] += (cor[1] - s[1]) * k
  s[2] += (cor[2] - s[2]) * k
}

/** A etiqueta de papel: duas linhas de tinta sem letra. */
function texDaEtiqueta(y0: number, y1: number): Textura {
  return (_u, _v, _x, y, _p, s, escala) => {
    const t = (y - y0) / (y1 - y0)
    const d = Math.min(Math.abs(t - 0.36), Math.abs(t - 0.68)) * (y1 - y0)
    const tinta = Math.min(1, Math.max(0, (0.22 - d) * escala + 0.5))
    if (tinta > 0) misturar(s, TINTA, tinta * 0.55)
  }
}

/** A teia de aranha no canto (cx, cy), aberta para (sx, sy): os raios e os fios em volta, em alfa. */
function texDaTeia(cx: number, cy: number, sx: number, sy: number, raio: number): Textura {
  return (_u, _v, x, y, _p, s, escala) => {
    const dx = (x - cx) * sx
    const dy = (y - cy) * sy
    const r = Math.hypot(dx, dy)
    const a = Math.atan2(dy, dx)
    const fio = 0.11
    const passoDoRaio = Math.PI / 2 / 5
    const raioMaisPerto = Math.round(a / passoDoRaio) * passoDoRaio
    const dRaio = r * Math.abs(Math.sin(a - raioMaisPerto))
    // Os fios em volta cedem entre um raio e outro.
    const cede = 0.35 * Math.abs(Math.sin((a / passoDoRaio) * Math.PI))
    const dVolta = Math.abs((((r + cede) / (raio / 4) + 0.5) % 1) - 0.5) * (raio / 4)
    const k = Math.max(Math.min(1, Math.max(0, (fio - dRaio) * escala + 0.5)), Math.min(1, Math.max(0, (fio - dVolta) * escala + 0.5)))
    s[0] = COR_DA_TEIA[0]
    s[1] = COR_DA_TEIA[1]
    s[2] = COR_DA_TEIA[2]
    s[5] = r < raio ? 0.55 * k * (1 - (r / raio) ** 3) : 0
  }
}

/** O vidro de frente: meio transparente, com o brilho de metal nas beiras e a sombra curta no fundo. */
function opcoesDoVidro(meia: number, semente: number): OpcoesDaPeca {
  return { bisel: meia * 0.7, contorno: 0.3, alfa: 0.55, metal: 0.45, semente, projeta: SOMBRA_DO_VIDRO }
}

/** O líquido: opaco, com a beira de cima um pouco mais clara (o menisco). */
function liquidoDe(sorteio: number): MaterialDaPeca {
  return LIQUIDOS[Math.min(LIQUIDOS.length - 1, Math.floor(sorteio * LIQUIDOS.length))]
}

function menisco(lu: Lugar, x0: number, x1: number, y: number, cor: MaterialDaPeca): void {
  lu.L.push(lu.P(lu.guardar(capsula(x0 + 0.3, y + 0.25, x1 - 0.3, y + 0.25, 0.22)), cor, { ...SEM_BORDA, tom: 1.35, alfa: 0.8, semente: lu.semente + 9 }))
}

function reflexo(lu: Lugar, x: number, y0: number, y1: number, larg = 0.32): void {
  lu.L.push(lu.P(lu.guardar(capsula(x, y0, x, y1, larg)), BRILHO, { ...SEM_BORDA, alfa: 0.55, semente: lu.semente + 8 }))
}

function rolha(lu: Lugar, cx: number, y: number, meia: number): void {
  lu.L.push(lu.P(lu.guardar(caixa(cx - meia, y - 1.3, cx + meia, y + 0.2, 0.35)), ROLHA, { bisel: 0.4, contorno: 0.3, semente: lu.semente + 7 }))
}

/** O lacre de cera por cima da rolha, com um pingo escorrido. */
function lacre(lu: Lugar, cx: number, y: number, meia: number): void {
  lu.L.push(lu.P(lu.guardar(caixa(cx - meia - 0.35, y - 1.3, cx + meia + 0.35, y + 0.7, 0.45)), CERA, { bisel: 0.5, contorno: 0.32, semente: lu.semente + 6 }))
  lu.L.push(lu.P(lu.guardar(capsula(cx - meia, y + 0.6, cx - meia - 0.05, y + 1.8, 0.32)), CERA, { bisel: 0.3, contorno: 0.28, semente: lu.semente + 5 }))
}

function etiqueta(lu: Lugar, x0: number, y0: number, x1: number, y1: number, tom: number): void {
  lu.L.push(lu.P(lu.guardar(caixa(x0, y0, x1, y1, 0.2)), PAPEL, { bisel: 0.25, contorno: 0.24, tom, textura: texDaEtiqueta(y0, y1), semente: lu.semente + 4 }))
}

// ---------- os vidros e o resto, de frente, apoiados em `chao` ----------

/** O balão de fundo redondo, de gargalo fino e rolha. */
function balao(lu: Lugar, x: number, larg: number, sorte: Sorte): void {
  const r = Math.min(larg / 2, lu.alto * 0.33)
  const cx = x + larg / 2
  const cy = lu.chao - r
  const gargalo = Math.max(1, lu.alto - 2 * r - 2)
  const topo = cy - r - gargalo
  const cor = liquidoDe(sorte(3))
  const nivel = cy - r * (0.05 + 0.5 * sorte(4))
  lu.L.push(lu.P(lu.guardar(uniao(elipse(cx, cy, r, r), caixa(cx - 0.6, topo, cx + 0.6, cy - r + 0.8, 0.3))), VIDRO, opcoesDoVidro(r, lu.semente)))
  lu.L.push(lu.P(lu.guardar(dentroDe(elipse(cx, cy, r - 0.45, r - 0.45), caixa(cx - r, nivel, cx + r, lu.chao))), cor, { bisel: r * 0.5, contorno: 0, semente: lu.semente + 1 }))
  menisco(lu, cx - Math.sqrt(Math.max(0, (r - 0.45) ** 2 - (nivel - cy) ** 2)), cx + Math.sqrt(Math.max(0, (r - 0.45) ** 2 - (nivel - cy) ** 2)), nivel, cor)
  reflexo(lu, cx - r * 0.45, cy - r * 0.5, cy + r * 0.05, 0.36)
  lu.L.push(lu.P(lu.guardar(caixa(cx - 0.85, topo - 0.2, cx + 0.85, topo + 0.45, 0.25)), VIDRO, { bisel: 0.3, contorno: 0.28, alfa: 0.75, metal: 0.45, semente: lu.semente + 2 }))
  rolha(lu, cx, topo, 0.62)
}

/** A garrafa de ombro e gargalo comprido, com etiqueta e rolha ou lacre. */
function garrafa(lu: Lugar, x: number, larg: number, sorte: Sorte): void {
  const meia = larg / 2
  const cx = x + meia
  const altura = lu.alto * (0.76 + 0.16 * sorte(5))
  const ombro = lu.chao - altura * 0.6
  const topo = lu.chao - altura + 1.4
  const g = 0.65
  const contorno: Ponto[] = [
    [cx - meia, lu.chao], [cx - meia, ombro + 0.8], [cx - g, ombro - 1.2], [cx - g, topo],
    [cx + g, topo], [cx + g, ombro - 1.2], [cx + meia, ombro + 0.8], [cx + meia, lu.chao],
  ]
  const cor = liquidoDe(sorte(3))
  const nivel = ombro + (lu.chao - ombro) * (0.05 + 0.4 * sorte(4))
  lu.L.push(lu.P(lu.guardar(poligono(contorno)), VIDRO, opcoesDoVidro(meia, lu.semente)))
  lu.L.push(lu.P(lu.guardar(caixa(cx - meia + 0.45, nivel, cx + meia - 0.45, lu.chao - 0.45, 0.4)), cor, { bisel: meia * 0.5, contorno: 0, semente: lu.semente + 1 }))
  menisco(lu, cx - meia + 0.45, cx + meia - 0.45, nivel, cor)
  etiqueta(lu, cx - meia + 0.5, lu.chao - altura * 0.42, cx + meia - 0.5, lu.chao - altura * 0.16, 0.9 + 0.1 * sorte(6))
  reflexo(lu, cx - meia * 0.5, ombro + 0.6, lu.chao - altura * 0.46)
  if (sorte(7) < 0.5) lacre(lu, cx, topo, g)
  else rolha(lu, cx, topo, g)
}

/** Os tubos de ensaio no suporte de madeira, cada um com um líquido. */
function tubos(lu: Lugar, x: number, larg: number, sorte: Sorte): void {
  const altura = lu.alto * (0.78 + 0.12 * sorte(5))
  const barra = lu.chao - altura * 0.55
  const n = 3
  const passo = (larg - 1.2) / n
  const madeira = { bisel: 0.3, contorno: 0.28, tom: 1.15, eixo: 0, tabua: 0 }
  lu.L.push(lu.P(lu.guardar(caixa(x, lu.chao - 1.1, x + larg, lu.chao, 0.25)), lu.madeira, { ...madeira, semente: lu.semente }))
  for (let i = 0; i < n; i += 1) {
    const cx = x + 0.6 + passo * (i + 0.5)
    const alto = lu.chao - altura + 0.4 * sorte(10 + i)
    const cor = liquidoDe(sorte(20 + i))
    lu.L.push(lu.P(lu.guardar(capsula(cx, lu.chao - 1.5, cx, alto, 0.62)), VIDRO, opcoesDoVidro(0.62, lu.semente + 10 + i)))
    lu.L.push(lu.P(lu.guardar(capsula(cx, lu.chao - 1.8, cx, lu.chao - 1.8 - (altura - 2.5) * (0.3 + 0.4 * sorte(30 + i)), 0.4)), cor, { bisel: 0.3, contorno: 0, semente: lu.semente + 20 + i }))
    if (sorte(40 + i) < 0.45) rolha(lu, cx, alto - 0.2, 0.5)
  }
  lu.L.push(lu.P(lu.guardar(caixa(x, barra - 0.7, x + larg, barra, 0.2)), lu.madeira, { ...madeira, semente: lu.semente + 30 }))
  for (const xa of [x, x + larg - 0.6]) lu.L.push(lu.P(lu.guardar(caixa(xa, barra, xa + 0.6, lu.chao - 1)), lu.madeira, { ...madeira, eixo: QUARTO, semente: lu.semente + 31 }))
}

/** O frasco facetado, de tampa de vidro. */
function facetado(lu: Lugar, x: number, larg: number, sorte: Sorte): void {
  const meia = larg / 2
  const cx = x + meia
  const h = lu.alto * (0.64 + 0.14 * sorte(5))
  const c = lu.chao
  const corpo = poligono([
    [cx - meia * 0.62, c], [cx - meia, c - h * 0.22], [cx - meia, c - h * 0.5], [cx - 0.62, c - h * 0.72], [cx - 0.62, c - h * 0.84],
    [cx + 0.62, c - h * 0.84], [cx + 0.62, c - h * 0.72], [cx + meia, c - h * 0.5], [cx + meia, c - h * 0.22], [cx + meia * 0.62, c],
  ])
  const cor = liquidoDe(sorte(3))
  const nivel = c - h * (0.28 + 0.2 * sorte(4))
  lu.L.push(lu.P(lu.guardar(corpo), VIDRO, opcoesDoVidro(meia * 0.8, lu.semente)))
  lu.L.push(lu.P(lu.guardar(dentroDe(corpo, caixa(cx - meia + 0.45, nivel, cx + meia - 0.45, c - 0.45))), cor, { bisel: meia * 0.4, contorno: 0, semente: lu.semente + 1 }))
  menisco(lu, cx - meia + 0.45, cx + meia - 0.45, nivel, cor)
  // As facetas: duas arestas claras de pé.
  for (const f of [-0.42, 0.42]) lu.L.push(lu.P(lu.guardar(capsula(cx + meia * f, c - h * 0.2, cx + meia * f, c - h * 0.5, 0.16)), BRILHO, { ...SEM_BORDA, alfa: 0.5, semente: lu.semente + 3 }))
  lu.L.push(lu.P(lu.guardar(poligono([[cx, c - h - 1.6], [cx + 1.05, c - h - 0.6], [cx, c - h * 0.84 - 0.1], [cx - 1.05, c - h - 0.6]])), VIDRO, { bisel: 0.6, contorno: 0.3, alfa: 0.8, metal: 0.6, semente: lu.semente + 2 }))
}

/** O pote de barro com pano amarrado na boca e etiqueta. */
function pote(lu: Lugar, x: number, larg: number, sorte: Sorte): void {
  const h = Math.min(lu.alto - 2.2, larg * (1 + 0.25 * sorte(5)))
  const c = lu.chao
  const boca = c - h
  lu.L.push(lu.P(lu.guardar(caixa(x, boca, x + larg, c, larg * 0.32)), BARRO, { bisel: larg * 0.3, contorno: 0.3, tom: 0.9 + 0.12 * sorte(6), semente: lu.semente, projeta: SOMBRA_DO_VIDRO }))
  lu.L.push(lu.P(lu.guardar(poligono([[x - 0.1, boca + 0.7], [x + 0.3, boca - 1.2], [x + larg / 2, boca - 1.9], [x + larg - 0.3, boca - 1.2], [x + larg + 0.1, boca + 0.7]])), PANO, { bisel: 0.5, contorno: 0.28, ruga: 0.5, semente: lu.semente + 1 }))
  lu.L.push(lu.P(lu.guardar(caixa(x + 0.1, boca + 0.1, x + larg - 0.1, boca + 0.55)), BARBANTE, { bisel: 0.2, contorno: 0.24, semente: lu.semente + 2 }))
  etiqueta(lu, x + larg * 0.18, c - h * 0.62, x + larg * 0.82, c - h * 0.3, 0.92)
}

/** A redoma de vidro na base de madeira, com uma raiz seca ou uma caveira de passarinho dentro. */
function redoma(lu: Lugar, x: number, larg: number, sorte: Sorte): void {
  const c = lu.chao
  const cx = x + larg / 2
  const r = larg / 2 - 0.4
  const h = Math.min(lu.alto - 1.2, larg * 1.3)
  lu.L.push(lu.P(lu.guardar(caixa(x, c - 1.2, x + larg, c, 0.3)), lu.madeira, { bisel: 0.4, contorno: 0.3, tom: 1.1, tabua: 0, eixo: 0, semente: lu.semente, projeta: SOMBRA_DO_VIDRO }))
  if (sorte(5) < 0.5) caveira(lu, cx - 2.2, c - 1.2, 4.4)
  else {
    const raiz: Ponto[] = [[cx - 0.3, c - 1.2], [cx - 0.9, c - 2.6], [cx + 0.3, c - 3.7], [cx - 0.3, c - 4.9], [cx + 0.7, Math.max(c - h + r + 0.6, c - 6)]]
    lu.L.push(lu.P(lu.guardar(cadeia(raiz, 0.42)), RAIZ, { bisel: 0.35, contorno: 0.32, semente: lu.semente + 1 }))
    lu.L.push(lu.P(lu.guardar(capsula(cx - 0.75, c - 2.4, cx - 1.9, c - 3.2, 0.22)), RAIZ, { bisel: 0.2, contorno: 0.28, semente: lu.semente + 2 }))
    lu.L.push(lu.P(lu.guardar(capsula(cx + 0.2, c - 3.6, cx + 1.5, c - 3.9, 0.2)), RAIZ, { bisel: 0.2, contorno: 0.28, semente: lu.semente + 3 }))
  }
  lu.L.push(lu.P(lu.guardar(uniao(caixa(cx - r, c - h + r, cx + r, c - 1.1), elipse(cx, c - h + r, r, r))), VIDRO, { bisel: r * 0.5, contorno: 0.3, alfa: 0.36, metal: 0.5, semente: lu.semente + 4 }))
  reflexo(lu, cx - r * 0.55, c - h + r * 0.7, c - 2, 0.3)
  lu.L.push(lu.P(lu.guardar(elipse(cx, c - h - 0.3, 0.7, 0.55)), VIDRO, { bisel: 0.4, contorno: 0.3, alfa: 0.8, metal: 0.6, semente: lu.semente + 5 }))
}

/** O almofariz de pedra, com o pilão de madeira encostado dentro. */
function almofariz(lu: Lugar, x: number, larg: number): void {
  const c = lu.chao
  const h = Math.min(lu.alto * 0.42, 3.6)
  lu.L.push(lu.P(lu.guardar(capsula(x + larg * 0.62, c - h + 0.4, x + larg + 0.4, c - h - 3.4, 0.62)), lu.madeira, { bisel: 0.5, contorno: 0.3, tom: 1.3, tabua: 0, semente: lu.semente }))
  lu.L.push(lu.P(lu.guardar(poligono([[x + 0.7, c], [x, c - h], [x + larg, c - h], [x + larg - 0.7, c]])), PEDRA, { bisel: 0.7, contorno: 0.3, semente: lu.semente + 1, projeta: SOMBRA_DO_VIDRO }))
  lu.L.push(lu.P(lu.guardar(caixa(x - 0.2, c - h - 0.5, x + larg + 0.2, c - h + 0.45, 0.3)), PEDRA, { bisel: 0.3, contorno: 0.3, tom: 1.1, semente: lu.semente + 2 }))
}

/** A caveira de passarinho deitada: o crânio, o bico comprido e a órbita escura. */
function caveira(lu: Lugar, x: number, c: number, larg: number): void {
  lu.L.push(lu.P(lu.guardar(elipse(x + 1.5, c - 1.4, 1.5, 1.35)), OSSO, { bisel: 0.7, contorno: 0.3, semente: lu.semente + 11, projeta: SOMBRA_DO_VIDRO }))
  lu.L.push(lu.P(lu.guardar(poligono([[x + 2.4, c - 2.2], [x + larg, c - 0.6], [x + 2.5, c - 0.4]])), OSSO, { bisel: 0.3, contorno: 0.3, tom: 0.92, semente: lu.semente + 12 }))
  lu.L.push(lu.P(lu.guardar(elipse(x + 1.9, c - 1.6, 0.55, 0.5)), ESCURO, { ...SEM_BORDA, semente: lu.semente + 13 }))
}

type TipoDeVidro = 'balao' | 'garrafa' | 'tubos' | 'facetado' | 'pote' | 'redoma' | 'almofariz' | 'caveira'
/** De cada dez sorteios, o que sai (as garrafas e os balões mais que o resto). */
const TIPOS: readonly TipoDeVidro[] = ['garrafa', 'balao', 'garrafa', 'facetado', 'tubos', 'balao', 'pote', 'redoma', 'garrafa', 'almofariz']
/** A largura de cada um (px): a menor e a maior. */
const LARGURAS: Readonly<Record<TipoDeVidro, readonly [number, number]>> = {
  balao: [5.4, 7.2],
  garrafa: [3.4, 4.6],
  tubos: [5, 5.8],
  facetado: [3.8, 4.6],
  pote: [4.6, 6],
  redoma: [5.4, 6.4],
  almofariz: [4.6, 5.4],
  caveira: [4.2, 4.8],
}

function desenhar(tipo: TipoDeVidro, lu: Lugar, x: number, larg: number, sorte: Sorte): void {
  if (tipo === 'balao') balao(lu, x, larg, sorte)
  else if (tipo === 'garrafa') garrafa(lu, x, larg, sorte)
  else if (tipo === 'tubos') tubos(lu, x, larg, sorte)
  else if (tipo === 'facetado') facetado(lu, x, larg, sorte)
  else if (tipo === 'pote') pote(lu, x, larg, sorte)
  else if (tipo === 'redoma') redoma(lu, x, larg, sorte)
  else if (tipo === 'almofariz') almofariz(lu, x, larg)
  else caveira(lu, x, lu.chao, larg)
}

/** Os vidros de um vão, da esquerda para a direita, e a teia num canto de cima de vez em quando. */
function encherVao(lu: Lugar, x0: number, x1: number, teia: number): void {
  let x = x0 + 0.5 + FOLGA_SORTEADA * hash(0, 50, lu.semente)
  for (let i = 1; i < 40; i += 1) {
    const sorte: Sorte = (k) => hash(i, k, lu.semente)
    const tipo = TIPOS[Math.min(TIPOS.length - 1, Math.floor(sorte(1) * TIPOS.length))]
    const [menor, maior] = LARGURAS[tipo]
    const larg = menor + (maior - menor) * sorte(2)
    if (x + larg > x1 - 0.5) break
    desenhar(tipo, { ...lu, semente: lu.semente + i * 50 }, x, larg, sorte)
    x += larg + ENTRE_VIDROS + FOLGA_SORTEADA * sorte(9)
  }
  if (teia >= CHANCE_DE_TEIA) return
  // A teia vai no canto de cima, na quina do vão: de um lado ou do outro.
  const daEsquerda = teia < CHANCE_DE_TEIA / 2
  const cx = daEsquerda ? x0 : x1
  const cy = lu.chao - lu.alto
  const sx = daEsquerda ? 1 : -1
  lu.L.push(lu.P(lu.guardar(caixa(Math.min(cx, cx + sx * TEIA), cy, Math.max(cx, cx + sx * TEIA), cy + TEIA)), PAPEL, { ...SEM_BORDA, textura: texDaTeia(cx, cy, sx, 1, TEIA), semente: lu.semente + 3 }))
}

/** As gavetas de um vão: a moldura, o puxador de latão e a etiqueta de papel de cada uma. */
function gavetas(lu: Lugar, x0: number, x1: number, topo: number): void {
  const largura = (x1 - x0) / GAVETAS_POR_VAO
  for (let i = 0; i < GAVETAS_POR_VAO; i += 1) {
    const a = x0 + i * largura
    const b = a + largura
    const [g0, g1] = [a + MOLDURA_DA_GAVETA / 2, b - MOLDURA_DA_GAVETA / 2]
    const [h0, h1] = [topo + MOLDURA_DA_GAVETA / 2, lu.chao - MOLDURA_DA_GAVETA / 2]
    lu.L.push(lu.P(lu.guardar(caixa(g0, h0, g1, h1, 0.4)), lu.madeira, { bisel: 0.8, contorno: 0.32, tom: 0.98, tabua: 0, eixo: 0, semente: lu.semente + i }))
    const meio = (g0 + g1) / 2
    const altura = h1 - h0
    const yEtiqueta = h0 + altura * ETIQUETA_DA_GAVETA.acima
    const meiaEtiqueta = ((g1 - g0) * ETIQUETA_DA_GAVETA.largura) / 2
    etiqueta(lu, meio - meiaEtiqueta, yEtiqueta, meio + meiaEtiqueta, yEtiqueta + altura * ETIQUETA_DA_GAVETA.altura, 0.86 + 0.1 * hash(i, 61, lu.semente))
    const yPuxador = h0 + altura * 0.66
    lu.L.push(lu.P(lu.guardar(elipse(meio, yPuxador, PUXADOR + 0.25, PUXADOR + 0.25)), LATAO, { bisel: 0.3, contorno: 0.26, tom: 0.8, semente: lu.semente + 10 + i }))
    lu.L.push(lu.P(lu.guardar(elipse(meio, yPuxador, PUXADOR, PUXADOR)), LATAO, { bisel: 0.5, contorno: 0.3, metal: 0.6, semente: lu.semente + 20 + i, projeta: { dist: 0.6, forca: 0.3, suave: 0.4 } }))
  }
}

/** Uma prateleira de frente: o fundo escuro (ou as gavetas, na de baixo), a tábua, a divisória, os vidros e os montantes. */
function montarPrateleira(c: ContextoDoMovel, L: Peca[], pr: Prateleira): void {
  const { hw, w, g, peca: P } = c
  const mad = c.m.madeira
  const x0 = -hw + CANTONEIRA
  const x1 = hw - CANTONEIRA
  const chao = pr.base - g * TABUA
  const topo = chao - pr.vao
  const guardar = (forma: Forma): Forma => naFresta(forma, topo, pr.meio)
  const semente = SEMENTE + pr.linha * 40
  const dentro0 = x0 + MONTANTE
  const dentro1 = x1 - MONTANTE
  const ehGaveta = pr.linha === 0
  L.push(P(guardar(caixa(dentro0 - 0.4, topo, dentro1 + 0.4, chao + 0.4)), mad, { tabua: 0, bisel: 0, contorno: 0, tom: ehGaveta ? TOM_DO_MONTANTE : TOM_DO_FUNDO, recesso: { k: 2.6, forca: SOMBRA_DO_FUNDO }, semente }))
  L.push(P(guardar(caixa(dentro0 - 0.4, chao, dentro1 + 0.4, pr.base, 0.3)), mad, { tabua: 0, bisel: 0.9, tom: TOM_DA_TABUA, semente: semente + 1 }))
  const vaos = Math.max(1, Math.round(w / (g * LARGURA_DO_VAO)))
  const largura = (dentro1 - dentro0 - (vaos - 1) * DIVISORIA) / vaos
  const sementeDaLinha = SEMENTE + 1000 + c.variante * SEMENTES_POR_VARIANTE + pr.linha * SEMENTES_POR_LINHA
  for (let i = 0; i < vaos; i += 1) {
    const a = dentro0 + i * (largura + DIVISORIA)
    if (i > 0) L.push(P(guardar(caixa(a - DIVISORIA, topo, a, chao + 0.3)), mad, { eixo: QUARTO, tabua: 0, bisel: 0.6, tom: TOM_DO_MONTANTE, semente: semente + 2 + i }))
    const lu: Lugar = { P, L, guardar, chao, alto: pr.vao, madeira: mad, semente: sementeDaLinha + i * 997 }
    if (ehGaveta) gavetas(lu, a, a + largura, topo)
    else encherVao(lu, a, a + largura, hash(i, 70, sementeDaLinha))
  }
  // Os montantes sem chanfro nem contorno: empilhados de prateleira em prateleira, a emenda não aparece.
  for (const [i, xa] of [x0, dentro1].entries()) {
    L.push(P(guardar(caixa(xa, topo, xa + MONTANTE, pr.base)), mad, { eixo: QUARTO, tabua: 0, bisel: 0, contorno: 0, tom: TOM_DO_MONTANTE, semente: semente + 20 + i }))
  }
}

/** O que fica no tampo, visto de cima: um balão de fundo redondo, o almofariz com o pilão e uma teia no canto de trás. */
function noTampo(c: ContextoDoMovel, L: Peca[], cy: number, meiaFaixa: number): void {
  const { w, hw, hh, peca: P } = c
  const r = Math.min(4.2, meiaFaixa - 1.4)
  if (r < 2) return
  // O balão: o vidro, o líquido visto pela boca larga do bojo, o gargalo e a rolha.
  const bx = -0.3 * w
  L.push(P(elipse(bx, cy, r, r), VIDRO, { bisel: r * 0.6, contorno: 0.3, alfa: 0.6, metal: 0.45, semente: SEMENTE + 900, projeta: { dist: 1.4, forca: 0.3, suave: 0.6 } }))
  L.push(P(elipse(bx + 0.2, cy + 0.2, r - 0.8, r - 0.8), LIQUIDOS[0], { bisel: r * 0.4, contorno: 0, semente: SEMENTE + 901 }))
  L.push(P(anel(bx, cy, 1.5, 1.5, 0.9, 0.9), VIDRO, { bisel: 0.4, contorno: 0.3, alfa: 0.85, metal: 0.5, semente: SEMENTE + 902 }))
  L.push(P(elipse(bx, cy, 0.9, 0.9), ROLHA, { bisel: 0.4, contorno: 0.3, semente: SEMENTE + 903, projeta: { dist: 0.8, forca: 0.3 } }))
  L.push(P(capsula(bx - r * 0.5, cy - r * 0.45, bx - r * 0.15, cy - r * 0.68, 0.45), BRILHO, { ...SEM_BORDA, alfa: 0.6, semente: SEMENTE + 904 }))
  // O almofariz de pedra com o pó no fundo e o pilão atravessado.
  const ax = 0.2 * w
  const ra = Math.min(3.4, r * 0.85)
  L.push(P(anel(ax, cy, ra, ra, ra * 0.68, ra * 0.68), PEDRA, { bisel: ra * 0.3, contorno: 0.3, semente: SEMENTE + 905, projeta: { dist: 1, forca: 0.3, suave: 0.5 } }))
  L.push(P(elipse(ax, cy, ra * 0.68, ra * 0.68), PO, { bisel: 0, contorno: 0, tom: 0.7, recesso: { k: 1.4, forca: 0.4 }, semente: SEMENTE + 906 }))
  L.push(P(capsula(ax + 0.6, cy - 0.3, ax + ra + 1.6, cy - ra - 0.4, 0.7), c.m.madeira, { bisel: 0.6, contorno: 0.3, tom: 1.3, tabua: 0, semente: SEMENTE + 907, projeta: { dist: 0.9, forca: 0.3 } }))
  // A teia no canto de trás da direita.
  const tx = hw - 0.4
  const ty = -hh + 0.4
  L.push(P(caixa(tx - TEIA * 1.2, ty, tx, ty + TEIA * 1.2), PAPEL, { ...SEM_BORDA, textura: texDaTeia(tx, ty, -1, 1, TEIA * 1.2), semente: SEMENTE + 908 }))
}

export const montarEstanteDePocoes: MontarMovel = (c, cena) => {
  const { hw, hh, h, g, peca: P } = c
  const H = g * ALTURA
  const tabua = g * TABUA
  // O que sobra da frente para as prateleiras, entre o rodapé e a beira do tampo.
  const util = H - g * RODAPE - g * BEIRA_DO_TAMPO
  // A prateleira guardada tem de caber debaixo do tampo: a estante mais rasa ganha mais prateleiras, mais baixas.
  const vaoMaximo = Math.max(VAO_MINIMO, Math.min(g * VAO_MAXIMO, h - tabua - FOLGA_DO_GUARDADO))
  const linhas = Math.max(2, Math.ceil((util + (1 - VAO_DE_CIMA) * vaoMaximo) / (tabua + vaoMaximo)))
  const vao = (util - linhas * tabua) / (linhas - 1 + VAO_DE_CIMA)
  /** Onde o corpo acaba e as frestas começam. */
  const frente = hh - linhas * FRESTA
  cena.sombras.push({ forma: caixa(-hw, -hh, hw, frente, 1), z: H }, contato(caixa(-hw, -hh, hw, hh, 1)))
  for (const xa of [-hw, hw - CANTONEIRA]) cena.sombras.push({ forma: caixa(xa, frente, xa + CANTONEIRA, hh), z: H })
  const prateleiras: Prateleira[] = []
  for (let k = 0; k < linhas; k += 1) {
    // A de cima fica na fresta mais funda e a de baixo na da frente: a 3/4 pinta do fundo para a frente, então
    // cada prateleira cobre a beirada que a 3/4 dá à fresta da prateleira de cima.
    const fresta = frente + (linhas - 1 - k) * FRESTA
    cena.sombras.push({
      forma: caixa(-hw + CANTONEIRA, fresta, hw - CANTONEIRA, fresta + FRESTA),
      z: g * RODAPE + k * (tabua + vao) + (fresta - frente),
      solta: true,
      forca: 0,
    })
    prateleiras.push({ linha: k, base: fresta, vao: k === linhas - 1 ? vao * VAO_DE_CIMA : vao, meio: fresta + FRESTA / 2 })
  }
  const L = cena.partes
  // As de baixo primeiro, escondidas pelo tampo; depois o tampo, o que está nele e, na frente dele, a prateleira de cima.
  for (const pr of prateleiras.slice(0, -1)) montarPrateleira(c, L, pr)
  L.push(P(caixa(-hw, -hh, hw, hh, 1), c.m.madeira, { tabua: 7, bisel: 1.5, semente: SEMENTE + 590 }))
  const aDeCima = prateleiras[linhas - 1]
  const fimDoTampo = aDeCima.base - tabua - aDeCima.vao
  noTampo(c, L, (-hh + fimDoTampo) / 2, (fimDoTampo + hh) / 2)
  montarPrateleira(c, L, aDeCima)
}
