/**
 * ESTANTE DE LIVROS de cima com volume (lote 1 dos objetos novos, 11/11/2026):
 * a estante alta e rasa de biblioteca, encostada na parede. De cima aparece o
 * TAMPO de tábuas e, na frente, a prateleira de cima: as lombadas dos livros
 * em fileira (cada um de uma largura e de uma altura, em cores contidas), um
 * tombado no vizinho, uns deitados em pilha, sobre a beira clara da tábua e
 * contra o fundo escuro. Em cima do tampo, um livro esquecido, de capa para
 * cima.
 *
 * NA 3/4 A FRENTE MOSTRA AS PRATELEIRAS. A frente que a 3/4 varre sozinha é
 * madeira lisa (o aparador); aqui cada prateleira (a tábua, o fundo, os
 * montantes e os livros dela) é desenhada de frente e fica GUARDADA debaixo
 * do tampo na vista de cima, onde nada dela aparece. O que a põe no lugar na
 * 3/4 é a regra de sempre (`tresQuartos.ts`): cada peça sobe a altura da
 * estrutura que contém o meio dela. Cada prateleira tem a sua FRESTA, um
 * tampo no ar de um quarto de px colado na frente da estante, na altura dela;
 * a caixa de pintura das peças da prateleira é esticada para a frente até o
 * meio cair na fresta (`naFresta`), então a prateleira inteira sobe junta. A
 * de cima é a que se vê nas duas vistas: de cima ela está na frente do tampo;
 * na 3/4 desce para o lugar dela e o tampo aparece inteiro.
 *
 * O corpo (a coluna que dá a sombra, o tampo que sobe e a madeira por trás de
 * tudo) acaba onde começam as frestas. Girada, a estante mostra a lateral ou
 * as costas de madeira lisa: o corpo e as duas cantoneiras da frente são
 * pintados depois das prateleiras e as cobrem.
 *
 * A 25% de zoom sobram a faixa de madeira e a faixa de riscos coloridos. A
 * arrumação dos livros sai de `variante` (0 de partida). Material: `madeira`.
 */
import { hash } from '../../ruido'
import { caixa, poligono, type Forma, type Ponto } from './formas'
import { contato, type CriarPeca, type MaterialDaPeca, type OpcoesDaPeca, type Peca, type Projecao } from './motor'
import { QUARTO, materialDaPeca, type ContextoDoMovel, type MontarMovel } from './contexto'

/** Altura da estante em casas (a sombra; na 3/4, a frente). */
const ALTURA = 1.6
/** O rodapé, a tábua de cada prateleira e a beira do tampo, vistos de frente, em casas. */
const RODAPE = 0.07
const TABUA = 0.06
const BEIRA_DO_TAMPO = 0.06
/** O vão de uma prateleira não passa disto, em casas: um livro alto com folga. */
const VAO_MAXIMO = 0.25
/** Nem fica menor que isto (px do protótipo), por mais rasa que o mestre deixe a estante. */
const VAO_MINIMO = 5
/** A prateleira de cima é mais baixa: é ela que aparece de cima, e o tampo fica com metade da pegada. */
const VAO_DE_CIMA = 0.8
/** A prateleira guardada fica a esta distância do fundo da pegada, no mínimo (px do protótipo). */
const FOLGA_DO_GUARDADO = 2.5
/** Um vão (entre os montantes e as divisórias) a cada tanto de largura, em casas. */
const LARGURA_DO_VAO = 1
/** Largura do montante de cada ponta e da divisória (px do protótipo). */
const MONTANTE = 2.6
const DIVISORIA = 2.2
/** A fresta de cada prateleira (px do protótipo): fina, para o corpo acabar a 1 px da frente da pegada. */
const FRESTA = 0.25
/** As cantoneiras da frente, que fecham as frestas dos dois lados (px do protótipo). */
const CANTONEIRA = 0.5

/**
 * A madeira vista de frente. A frente que a 3/4 varre tem 0,74 da luz do
 * tampo (`TOM_DA_FRENTE`); os montantes ficam um pouco acima dela e a beira
 * da tábua, que pega a luz de cima, quase na luz do tampo.
 */
const TOM_DO_MONTANTE = 0.8
const TOM_DA_TABUA = 0.92
/**
 * O fundo do vão é a própria madeira com menos luz, e a sombra da tábua de
 * cima dentro dele: os números do nicho do armário (`armario.ts`), que não
 * caem abaixo do piso de luz.
 */
const TOM_DO_FUNDO = 0.56
const SOMBRA_DO_FUNDO = 0.2

/**
 * As capas: as quatro lãs da casa, mais o couro, um azul-petróleo e o
 * pergaminho (o linho da tabela, quase branco, saltava da fileira), tudo
 * contido.
 */
const COURO: MaterialDaPeca = { classe: 'liso', rgb: [0x8c, 0x5e, 0x42] }
const PETROLEO: MaterialDaPeca = { classe: 'liso', rgb: [0x4e, 0x6a, 0x6c] }
const PERGAMINHO: MaterialDaPeca = { classe: 'liso', rgb: [0xc2, 0xb1, 0x8e] }
const CAPAS: readonly MaterialDaPeca[] = [
  materialDaPeca('vinho'),
  materialDaPeca('azul'),
  materialDaPeca('musgo'),
  materialDaPeca('ocre'),
  PERGAMINHO,
  COURO,
  PETROLEO,
]
/** A luz de cada capa é sorteada entre estes dois tons: livro velho, nenhum mais claro que a tinta dele. */
const CAPA_GASTA = 0.8
const CAPA_NOVA = 1.02
/** As folhas do livro fechado, vistas de lado. */
const FOLHAS: MaterialDaPeca = { classe: 'liso', rgb: [0xd6, 0xca, 0xae] }
/** O filete da lombada: ouro velho nas capas escuras, marrom nas claras (ouro no pergaminho não se lê). */
const FILETE: MaterialDaPeca = { classe: 'liso', rgb: [0xd6, 0xbd, 0x84] }
const FILETE_ESCURO: MaterialDaPeca = { classe: 'liso', rgb: [0x6b, 0x4a, 0x34] }
/** A soma dos três canais a partir da qual a capa é clara. */
const CAPA_CLARA = 480
const ALTO_DO_FILETE = 0.7
const SEM_BORDA: OpcoesDaPeca = { bisel: 0, contorno: 0 }

/** Largura de uma lombada, da mais fina à mais grossa (px do protótipo): 2 a 4 pixels a 1x. */
const LOMBADA_FINA = 2.3
const LOMBADA_GROSSA = 4.4
/** Só a lombada a partir desta largura tem os dois filetes. */
const LOMBADA_COM_FILETE = 2.9
/** A altura do livro em pé, em fração do vão. */
const LIVRO_BAIXO = 0.6
const LIVRO_ALTO = 0.92
const ENTRE_LIVROS = 0.2
/** O livro tombado no vizinho: a inclinação (radianos), a altura em fração do vão e o vão que sobra depois dele. */
const TOMBO = 0.21
const ALTO_DO_TOMBADO = 0.84
const DEPOIS_DO_TOMBADO = 1.6
/** A pilha de livros deitados no fim do vão: quantos cabem, o comprimento do de baixo e a grossura do mais fino. */
const DEITADOS_NA_PILHA = 3
const COMPRIMENTO_DO_DEITADO = 9.6
const GROSSURA_DO_DEITADO = 2.4
/** Cada livro faz uma sombra curta no vizinho e no fundo: é o que separa as lombadas da mesma cor. */
const SOMBRA_DO_LIVRO: Projecao = { dist: 0.7, forca: 0.24, suave: 0.5 }

/** Como os livros de um vão estão arrumados. */
type Arranjo = 'cheio' | 'deitados' | 'tombado'
/** De cinco vãos sorteados, três estão cheios, um acaba numa pilha deitada e um tem um livro tombado. */
const ARRANJOS: readonly Arranjo[] = ['cheio', 'deitados', 'tombado', 'cheio', 'cheio']
/** Semente dos sorteios dos livros (a `variante` do objeto troca a arrumação inteira). */
const SEMENTE_DOS_LIVROS = 4100
const SEMENTES_POR_VARIANTE = 131
const SEMENTES_POR_LINHA = 16

/** Uma prateleira guardada debaixo do tampo, em y da vista de cima. */
interface Prateleira {
  /** 0 = a de baixo. */
  readonly linha: number
  /** Onde a tábua apoia (a beira de baixo dela): o começo da fresta. */
  readonly base: number
  /** A altura livre, da tábua até a tábua de cima. */
  readonly vao: number
  /** O meio da fresta: todas as peças da prateleira têm o meio da caixa aqui. */
  readonly meio: number
  /** A que se vê de cima tem a arrumação fixa (o tombado e a pilha deitada); as outras são sorteadas. */
  readonly arranjoFixo: boolean
}

/**
 * A mesma forma com a caixa de pintura de `topo` até o espelho dele em volta
 * de `meio`: o desenho não muda (fora da forma nada pinta), mas o meio da
 * caixa, que é o que a 3/4 lê para saber em que estrutura a peça está, cai na
 * fresta. A sobra da caixa fica debaixo da sombra da estante, que já está na
 * imagem: a imagem não cresce.
 */
function naFresta(forma: Forma, topo: number, meio: number): Forma {
  return { b: [forma.b[0], topo, forma.b[2], 2 * meio - topo], d: (x, y) => forma.d(x, y) }
}

function capaDe(sorteio: number): MaterialDaPeca {
  return CAPAS[Math.min(CAPAS.length - 1, Math.floor(sorteio * CAPAS.length))]
}

function fileteDe(capa: MaterialDaPeca): MaterialDaPeca {
  return capa.rgb[0] + capa.rgb[1] + capa.rgb[2] > CAPA_CLARA ? FILETE_ESCURO : FILETE
}

/** O vão a encher: de `x0` a `x1`, com os livros apoiados em `chao` e até `alto` px de altura. */
interface Vao {
  readonly x0: number
  readonly x1: number
  readonly chao: number
  readonly alto: number
  readonly arranjo: Arranjo
  readonly semente: number
  readonly guardar: (forma: Forma) => Forma
}

/** Os livros de um vão: em pé da esquerda para a direita, com o tombado ou a pilha deitada do arranjo. */
function encherVao(P: CriarPeca, L: Peca[], v: Vao): void {
  const sorte = (i: number, k: number): number => hash(i, k, v.semente)
  const capa = (forma: Forma, material: MaterialDaPeca, grossura: number, i: number): Peca =>
    P(v.guardar(forma), material, { bisel: Math.min(1, grossura * 0.3), contorno: 0.24, tom: CAPA_GASTA + (CAPA_NOVA - CAPA_GASTA) * sorte(i, 4), semente: 600 + i, projeta: SOMBRA_DO_LIVRO })
  const fimDosEmPe = v.arranjo === 'deitados' ? v.x1 - COMPRIMENTO_DO_DEITADO - 0.8 : v.x1
  const xDoTombado = v.arranjo === 'tombado' ? v.x0 + (v.x1 - v.x0) * (0.3 + 0.4 * sorte(0, 10)) : Infinity
  let x = v.x0 + 0.3
  let altoDoVizinho = 0
  let tombou = false
  for (let i = 1; ; i += 1) {
    const larg = LOMBADA_FINA + (LOMBADA_GROSSA - LOMBADA_FINA) * sorte(i, 1)
    const material = capaDe(sorte(i, 3))
    if (!tombou && altoDoVizinho > 0 && x > xDoTombado) {
      // O tombado apoia o canto de baixo na tábua e a lombada na quina de cima do vizinho.
      const alt = v.alto * ALTO_DO_TOMBADO
      const pe = x + altoDoVizinho * Math.tan(TOMBO)
      const [co, si] = [Math.cos(TOMBO), Math.sin(TOMBO)]
      if (pe + larg * co + DEPOIS_DO_TOMBADO > fimDosEmPe) break
      const cantos: Ponto[] = [
        [pe, v.chao],
        [pe + larg * co, v.chao - larg * si],
        [pe + larg * co - alt * si, v.chao - larg * si - alt * co],
        [pe - alt * si, v.chao - alt * co],
      ]
      L.push(capa(poligono(cantos), material, larg, i))
      x = pe + larg * co + DEPOIS_DO_TOMBADO
      tombou = true
      altoDoVizinho = 0
      continue
    }
    if (x + larg > fimDosEmPe - ENTRE_LIVROS) break
    const alt = v.alto * (LIVRO_BAIXO + (LIVRO_ALTO - LIVRO_BAIXO) * sorte(i, 2))
    L.push(capa(caixa(x, v.chao - alt, x + larg, v.chao, 0.45), material, larg, i))
    if (larg >= LOMBADA_COM_FILETE) {
      for (const f of [0.2, 0.8]) {
        const y = v.chao - alt * f
        L.push(P(v.guardar(caixa(x + 0.4, y - ALTO_DO_FILETE / 2, x + larg - 0.4, y + ALTO_DO_FILETE / 2)), fileteDe(material), SEM_BORDA))
      }
    }
    x += larg + ENTRE_LIVROS
    altoDoVizinho = alt
  }
  if (v.arranjo !== 'deitados') return
  // A pilha deitada: o de baixo é o mais comprido, cada um um pouco recuado, até onde o vão deixa.
  let y = v.chao
  for (let j = 0; j < DEITADOS_NA_PILHA; j += 1) {
    const grossura = GROSSURA_DO_DEITADO + 0.8 * sorte(j, 12)
    if (y - grossura < v.chao - v.alto + 1) break
    const recuo = j === 0 ? 0 : 1.4 * sorte(j, 13)
    const xa = fimDosEmPe + 0.8 + recuo
    const comp = v.x1 - 0.4 - xa - (j === 0 ? 0 : 0.9 * sorte(j, 14))
    const material = capaDe(sorte(j, 15))
    L.push(capa(caixa(xa, y - grossura, xa + comp, y, 0.45), material, grossura, 40 + j))
    for (const f of [0.16, 0.84]) {
      const xf = xa + comp * f
      L.push(P(v.guardar(caixa(xf - ALTO_DO_FILETE / 2, y - grossura + 0.4, xf + ALTO_DO_FILETE / 2, y - 0.4)), fileteDe(material), SEM_BORDA))
    }
    y -= grossura
  }
}

/** Uma prateleira de frente: o fundo escuro, a tábua, as divisórias, os livros de cada vão e os dois montantes. */
function montarPrateleira(c: ContextoDoMovel, L: Peca[], pr: Prateleira): void {
  const { hw, w, g, peca: P } = c
  const mad = c.m.madeira
  const x0 = -hw + CANTONEIRA
  const x1 = hw - CANTONEIRA
  const chao = pr.base - g * TABUA
  const topo = chao - pr.vao
  const guardar = (forma: Forma): Forma => naFresta(forma, topo, pr.meio)
  const semente = 600 + pr.linha * 40
  const dentro0 = x0 + MONTANTE
  const dentro1 = x1 - MONTANTE
  L.push(P(guardar(caixa(dentro0 - 0.4, topo, dentro1 + 0.4, chao + 0.4)), mad, { tabua: 0, bisel: 0, contorno: 0, tom: TOM_DO_FUNDO, recesso: { k: 2.6, forca: SOMBRA_DO_FUNDO }, semente }))
  L.push(P(guardar(caixa(dentro0 - 0.4, chao, dentro1 + 0.4, pr.base, 0.3)), mad, { tabua: 0, bisel: 0.9, tom: TOM_DA_TABUA, semente: semente + 1 }))
  const vaos = Math.max(1, Math.round(w / (g * LARGURA_DO_VAO)))
  const largura = (dentro1 - dentro0 - (vaos - 1) * DIVISORIA) / vaos
  const sementeDaLinha = SEMENTE_DOS_LIVROS + c.variante * SEMENTES_POR_VARIANTE + pr.linha * SEMENTES_POR_LINHA
  for (let i = 0; i < vaos; i += 1) {
    const a = dentro0 + i * (largura + DIVISORIA)
    if (i > 0) L.push(P(guardar(caixa(a - DIVISORIA, topo, a, chao + 0.3)), mad, { eixo: QUARTO, tabua: 0, bisel: 0.6, tom: TOM_DO_MONTANTE, semente: semente + 2 + i }))
    // Na prateleira que se vê de cima a arrumação é fixa: o tombado no primeiro vão e a pilha deitada no último.
    const sorteado = ARRANJOS[Math.floor(hash(i, 7, sementeDaLinha) * ARRANJOS.length)]
    const arranjo: Arranjo = !pr.arranjoFixo ? sorteado : i === vaos - 1 ? 'deitados' : i === 0 ? 'tombado' : 'cheio'
    encherVao(P, L, { x0: a, x1: a + largura, chao, alto: pr.vao, arranjo, semente: sementeDaLinha + i, guardar })
  }
  // Os montantes sem chanfro nem contorno: empilhados de prateleira em prateleira, a emenda não aparece.
  for (const [i, xa] of [x0, dentro1].entries()) {
    L.push(P(guardar(caixa(xa, topo, xa + MONTANTE, pr.base)), mad, { eixo: QUARTO, tabua: 0, bisel: 0, contorno: 0, tom: TOM_DO_MONTANTE, semente: semente + 20 + i }))
  }
}

/** O livro esquecido em cima do tampo: onde fica (fração da largura a partir do meio), meias medidas (px do protótipo) e o giro. */
const LIVRO_ESQUECIDO = { x: -0.27, meioComprimento: 4.6, meiaLargura: 3.1, giro: 0.2 }
/** A faixa do tampo que sobra tem de ter esta folga em volta do livro; mais rasa que isso, ele não entra. */
const FOLGA_DO_LIVRO_ESQUECIDO = 1.2

/** Retângulo girado `ang` radianos em volta do meio (cx, cy), de meias medidas `mx` e `my`, deslocado (dx, dy) no eixo dele. */
function girado(cx: number, cy: number, mx: number, my: number, ang: number, dx = 0, dy = 0): Forma {
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  const canto = (x: number, y: number): Ponto => [cx + (x + dx) * co - (y + dy) * si, cy + (x + dx) * si + (y + dy) * co]
  return poligono([canto(-mx, -my), canto(mx, -my), canto(mx, my), canto(-mx, my)])
}

/**
 * Um livro fechado em cima da estante, de capa para cima, no meio (`cy`) da
 * faixa do tampo que aparece de cima (`meiaFaixa` = meia altura dela): as
 * folhas na beira da direita e de baixo, a capa e a etiqueta do título. Sobe
 * com o tampo na 3/4 (o meio dele está no corpo).
 */
function livroEsquecido(c: ContextoDoMovel, L: Peca[], cy: number, meiaFaixa: number): void {
  const { x, meioComprimento: mx, meiaLargura, giro } = LIVRO_ESQUECIDO
  const my = Math.min(meiaLargura, meiaFaixa - FOLGA_DO_LIVRO_ESQUECIDO - mx * Math.sin(giro))
  if (my < meiaLargura / 2) return
  const P = c.peca
  const cx = x * c.w
  const capa = CAPAS[0]
  L.push(P(girado(cx, cy, mx, my, giro, 0.5, 0.55), FOLHAS, { bisel: 0.3, contorno: 0.2, semente: 594, projeta: { dist: 0.9, forca: 0.26 } }))
  L.push(P(girado(cx, cy, mx, my, giro), capa, { bisel: 0.7, contorno: 0.26, tom: CAPA_GASTA + 0.1, semente: 595 }))
  L.push(P(girado(cx, cy, mx * 0.5, my * 0.26, giro, 0, -my * 0.3), fileteDe(capa), SEM_BORDA))
}

export const montarEstanteDeLivros: MontarMovel = (c, cena) => {
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
    const deCima = k === linhas - 1
    // A de cima fica na fresta mais funda e a de baixo na da frente: a 3/4 pinta do fundo para a frente, então
    // cada prateleira cobre a beirada que a 3/4 dá à fresta da prateleira de cima.
    const fresta = frente + (linhas - 1 - k) * FRESTA
    // A sombra da tábua cai dentro da estante, não no chão: a fresta só diz à 3/4 a altura da prateleira.
    cena.sombras.push({
      forma: caixa(-hw + CANTONEIRA, fresta, hw - CANTONEIRA, fresta + FRESTA),
      z: g * RODAPE + k * (tabua + vao) + (fresta - frente),
      solta: true,
      forca: 0,
    })
    prateleiras.push({ linha: k, base: fresta, vao: deCima ? vao * VAO_DE_CIMA : vao, meio: fresta + FRESTA / 2, arranjoFixo: deCima })
  }
  const L = cena.partes
  // As de baixo primeiro, escondidas pelo tampo; depois o tampo e, na frente dele, a prateleira de cima.
  for (const pr of prateleiras.slice(0, -1)) montarPrateleira(c, L, pr)
  L.push(P(caixa(-hw, -hh, hw, hh, 1), c.m.madeira, { tabua: 7, bisel: 1.5, semente: 590 }))
  const aDeCima = prateleiras[linhas - 1]
  // O alto da prateleira de cima é onde acaba a faixa do tampo que se vê.
  const fimDoTampo = aDeCima.base - tabua - aDeCima.vao
  livroEsquecido(c, L, (-hh + fimDoTampo) / 2, (fimDoTampo + hh) / 2)
  montarPrateleira(c, L, aDeCima)
}
