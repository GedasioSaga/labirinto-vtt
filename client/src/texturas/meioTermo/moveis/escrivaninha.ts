/**
 * ESCRIVANINHA de cima com volume (lote 4 dos objetos novos, 11/11/2026): a
 * mesa de escrever de gabinete. De cima aparece o TAMPO de madeira, emoldurado
 * em meia-esquadria, com o FORRO DE COURO verde no meio (o filete dourado em
 * volta) e, em cima dele, o que diz o que ela é: o LIVRO ABERTO com o fitilho,
 * as FOLHAS SOLTAS (a de cima escrita até a metade), o TINTEIRO com a PENA
 * dentro, o CASTIÇAL de latão com a vela apagada e uma carta lacrada. Na beira
 * da frente, os três puxadores das gavetas de cima. Quem escreve senta do lado
 * de baixo (a frente).
 *
 * NA 3/4 A FRENTE MOSTRA AS GAVETAS. A frente que a 3/4 varre sozinha é
 * madeira lisa; aqui ela é desenhada de frente (a beira do tampo, a fileira de
 * três gavetas rasas, os dois pedestais com duas gavetas cada e, no meio, o
 * vão escuro dos joelhos até o chão) e fica GUARDADA debaixo do tampo na vista
 * de cima, onde nada dela aparece. O que a põe no lugar é a regra de sempre da
 * 3/4 (`tresQuartos.ts`): cada peça sobe a altura da estrutura que contém o
 * meio da caixa dela. A frente tem a sua FRESTA, um tampo no ar de um quarto
 * de px colado na frente da pegada, e a caixa de pintura de cada peça é
 * espelhada em volta dela (`guardada`): a frente inteira sobe junta, meio px.
 * É a ideia da estante de livros e do guarda-roupa, com uma faixa só (a frente
 * é mais baixa que a profundidade). Os PUXADORES da fileira de cima são peças
 * com a fresta delas: de cima ficam na beira da frente e na 3/4 sobem para o
 * meio das gavetas; os das gavetas de baixo são da frente guardada.
 *
 * O perfil da 3/4 tem de ser derivado com espessura 0: a frente começa rente
 * ao chão (o vão dos joelhos), e com a beirada padrão dos tampos soltos a da
 * fresta cairia no chão, como uma tira de madeira na frente do vão.
 *
 * O que está em cima do tampo tem medida própria e lugar em fração do couro: a
 * escrivaninha esticada ganha tampo, não um livro maior; só encolhem juntos na
 * escrivaninha menor que a de partida. A 25% de zoom sobram a moldura de
 * madeira, o retângulo verde e as manchas claras do livro e das folhas.
 * Materiais: `madeira` e `puxadores`; o couro, o papel, o latão do castiçal e
 * do tinteiro e a pena são fixos.
 */
import { hash } from '../../ruido'
import { anel, caixa, capsula, elipse, menos, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, ruido, type CriarPeca, type MaterialDaPeca, type OpcoesDaPeca, type Peca, type Textura } from './motor'
import { BURACO, QUARTO, materialDaPeca, type MontarMovel } from './contexto'

type Rgb3 = readonly [number, number, number]

/** Altura da escrivaninha em casas (a sombra; na 3/4, a frente). */
const ALTURA = 0.6
/** O tamanho de partida, em casas: abaixo dele o que está em cima do tampo encolhe junto. */
const LARGURA_DE_PARTIDA = 1.5
const FUNDO_DE_PARTIDA = 0.8

// ---------- a frente guardada ----------

/** A fresta da frente e a dos puxadores (px do protótipo): finas, para o corpo acabar a meio px da frente da pegada. */
const FRESTA = 0.25
/** Quanto a frente guardada sobe na 3/4 (px do protótipo): o mínimo para a fresta dela valer como estrutura. */
const SUBIDA_DA_FRENTE = 0.5
/** A frente guardada fica a esta distância do fundo da pegada, no mínimo (px do protótipo). */
const FOLGA_DO_GUARDADO = 2.5
/** A fresta acaba este tanto antes de cada ponta: girada na 3/4, o corpo é pintado depois dela e cobre a frente guardada. */
const RECUO_DA_FRESTA = 0.5

/**
 * A peça desenhada DE FRENTE (x como na pegada, y = 0 no chão e negativo para
 * cima) no lugar em que fica guardada na vista de cima: descida `desce` px,
 * para debaixo do tampo, com a caixa de pintura espelhada em volta de `meio`
 * (o meio da fresta). O desenho não muda, porque fora da forma nada pinta; o
 * meio da caixa, que é o que a 3/4 lê para saber em que estrutura a peça
 * está, cai na fresta.
 */
function guardada(forma: Forma, desce: number, meio: number): Forma {
  const alcance = Math.max(Math.abs(forma.b[1] + desce - meio), Math.abs(forma.b[3] + desce - meio))
  return { b: [forma.b[0], meio - alcance, forma.b[2], meio + alcance], d: (x, y) => forma.d(x, y - desce) }
}

/** Põe uma peça na frente: a forma em coordenadas de frente (y = 0 no chão, negativo para cima). */
type PorNaFrente = (forma: Forma, mat: MaterialDaPeca, o: OpcoesDaPeca) => void

/** A beira do tampo vista de frente, a lateral do corpo que sobra de cada lado e o rodapé de cada pedestal (px do protótipo). */
const BEIRA_DO_TAMPO = 2.6
const LATERAL = 0.6
const RODAPE = 3
/** Largura de cada pedestal de gavetas, em fração da largura da escrivaninha: o resto, no meio, é o vão dos joelhos. */
const PEDESTAL = 0.3
/** A fileira de cima (as três gavetas rasas), em fração da altura. */
const GAVETA_DE_CIMA = 0.25
/** Gavetas em cada pedestal, abaixo da fileira de cima. */
const GAVETAS_DO_PEDESTAL = 2
/** A folga entre uma gaveta e a vizinha (o corpo aparece nela) e o recuo da almofada na face (px do protótipo). */
const FOLGA_DA_GAVETA = 0.8
const RECUO_DA_ALMOFADA = 1.8
/** A madeira vista de frente pega menos luz que o tampo: o corpo, a face da gaveta, a almofada e a beira do tampo. */
const TOM_DO_CORPO = 0.8
const TOM_DA_GAVETA = 0.92
const TOM_DA_ALMOFADA = 1
const TOM_DA_BEIRA = 0.98
/** O vão dos joelhos: a própria madeira com menos luz, e a sombra que o tampo e o pedestal da esquerda fazem dentro dele. */
const TOM_DO_VAO = 0.6
const SOMBRA_NO_VAO = { k: 5, forca: 0.4 }
/** A sombra que a beira do tampo faz nas gavetas: o escuro quente da nogueira, meio transparente. */
const SOMBRA: MaterialDaPeca = { classe: 'liso', rgb: [0x2e, 0x21, 0x18] }
const ALTO_DA_SOMBRA_DO_TAMPO = 2.2
/** Raio do puxador (px do protótipo): 3 pixels a 1x. */
const RAIO_DO_PUXADOR = 1.6

/** O que o desenho da frente devolve: onde ficam os puxadores da fileira de cima (os x e a altura). */
interface Frente {
  readonly puxadores: readonly number[]
  readonly alturaDoPuxador: number
}

/** O puxador de uma gaveta, de frente. */
function puxador(por: PorNaFrente, pux: MaterialDaPeca, x: number, altura: number, semente: number): void {
  por(elipse(x, -altura, RAIO_DO_PUXADOR, RAIO_DO_PUXADOR), pux, { bisel: 1.5, contorno: 0.16, semente, projeta: { dist: 0.9, forca: 0.3 } })
}

/** Uma gaveta de frente, de `x0` a `x1` e do pé ao topo (alturas a partir do chão): a face e a almofada em relevo. */
function gaveta(por: PorNaFrente, mad: MaterialDaPeca, x0: number, x1: number, pe: number, topo: number, semente: number): void {
  por(caixa(x0, -topo, x1, -pe, 0.7), mad, { tabua: 0, bisel: 1, tom: TOM_DA_GAVETA, semente })
  const recuo = Math.min(RECUO_DA_ALMOFADA, (topo - pe) * 0.24)
  por(caixa(x0 + recuo, -topo + recuo, x1 - recuo, -pe - recuo, 0.6), mad, { tabua: 0, bisel: 1.1, tom: TOM_DA_ALMOFADA, contorno: 0.24, semente: semente + 1 })
}

/**
 * A frente inteira, de frente: o corpo, o vão dos joelhos, o rodapé e as
 * gavetas de cada pedestal, a fileira de cima, a sombra do tampo e a beira
 * dele por cima.
 */
function desenharFrente(por: PorNaFrente, hw: number, w: number, H: number, mad: MaterialDaPeca, pux: MaterialDaPeca): Frente {
  const topoDoCorpo = H - BEIRA_DO_TAMPO
  const topoDaFileira = topoDoCorpo - FOLGA_DA_GAVETA
  const peDaFileira = topoDaFileira - H * GAVETA_DE_CIMA
  const alturaDoPuxador = (topoDaFileira + peDaFileira) / 2
  /** Meia largura do vão dos joelhos: de um pedestal ao outro. */
  const vao = hw - LATERAL - PEDESTAL * w

  por(caixa(-hw + LATERAL, -topoDoCorpo - 0.4, hw - LATERAL, 0, 0.5), mad, { eixo: QUARTO, tabua: 0, bisel: 0.7, tom: TOM_DO_CORPO, semente: 530 })
  // O vão dos joelhos não tem beira embaixo: acaba no chão.
  por(caixa(-vao, -peDaFileira + FOLGA_DA_GAVETA, vao, 0), mad, { tabua: 0, bisel: 0, contorno: 0, tom: TOM_DO_VAO, recesso: SOMBRA_NO_VAO, semente: 531 })

  const meioDoPedestal = (vao + hw - LATERAL) / 2
  const altoDasGavetas = peDaFileira - FOLGA_DA_GAVETA - RODAPE
  const altoDaGaveta = (altoDasGavetas - GAVETAS_DO_PEDESTAL * FOLGA_DA_GAVETA) / GAVETAS_DO_PEDESTAL
  for (const lado of [-1, 1]) {
    const x0 = lado * meioDoPedestal - (hw - LATERAL - vao) / 2
    const x1 = x0 + hw - LATERAL - vao
    por(caixa(x0 - 0.3, -RODAPE, x1 + 0.3, 0, 0.3), mad, { tabua: 0, bisel: 0.8, tom: TOM_DA_GAVETA, semente: 532 + lado })
    for (let i = 0; i < GAVETAS_DO_PEDESTAL; i += 1) {
      const pe = RODAPE + FOLGA_DA_GAVETA + i * (altoDaGaveta + FOLGA_DA_GAVETA)
      gaveta(por, mad, x0 + FOLGA_DA_GAVETA, x1 - FOLGA_DA_GAVETA, pe, pe + altoDaGaveta, 540 + lado * 10 + i * 3)
      puxador(por, pux, lado * meioDoPedestal, pe + altoDaGaveta / 2, 560 + lado + i)
    }
    gaveta(por, mad, x0 + FOLGA_DA_GAVETA, x1 - FOLGA_DA_GAVETA, peDaFileira, topoDaFileira, 565 + lado * 3)
  }
  gaveta(por, mad, -vao + FOLGA_DA_GAVETA, vao - FOLGA_DA_GAVETA, peDaFileira, topoDaFileira, 570)

  por(caixa(-hw + 1, -topoDoCorpo - 0.3, hw - 1, -topoDoCorpo + ALTO_DA_SOMBRA_DO_TAMPO), SOMBRA, { bisel: 0, contorno: 0, alfa: 0.3, suave: 1.4 })
  por(caixa(-hw, -H, hw, -topoDoCorpo, 0.8), mad, { tabua: 0, bisel: 1.1, tom: TOM_DA_BEIRA, semente: 573 })
  return { puxadores: [-meioDoPedestal, 0, meioDoPedestal], alturaDoPuxador }
}

// ---------- o tampo ----------

/** A moldura de madeira em volta do couro, em casas, e o recuo das réguas dela em relação à beira (px do protótipo). */
const MOLDURA_DO_TAMPO = 0.125
const RECUO_DAS_REGUAS = 1
/** O couro do forro: verde-garrafa calmo. O filete dourado corre a esta distância da beira dele (px do protótipo). */
const COURO_VERDE: MaterialDaPeca = { classe: 'liso', rgb: [0x49, 0x62, 0x51] }
const FILETE: MaterialDaPeca = { classe: 'liso', rgb: [0xd6, 0xbd, 0x84] }
const RECUO_DO_FILETE = 2
const LARGURA_DO_FILETE = 0.5
const SEM_BORDA: OpcoesDaPeca = { bisel: 0, contorno: 0 }

/** O couro: manchas largas e um grão miúdo, sem direção (não é madeira nem pano). */
const texCouro: Textura = (_u, _v, x, y, p, s) => {
  s[3] += ruido(x * 0.16 + p.su, y * 0.16 + p.sv) * 0.09 + ruido(x * 1.3 + p.sv, y * 1.3) * 0.05
}

/** Retângulo girado `ang` radianos em volta do meio (cx, cy), de meias medidas `mx` e `my`, deslocado (dx, dy) no eixo dele. */
function girado(cx: number, cy: number, mx: number, my: number, ang: number, dx = 0, dy = 0): Forma {
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  const canto = (x: number, y: number): Ponto => [cx + (x + dx) * co - (y + dy) * si, cy + (x + dx) * si + (y + dy) * co]
  return poligono([canto(-mx, -my), canto(mx, -my), canto(mx, my), canto(-mx, my)])
}

// ---------- o papel ----------

/** O papel das folhas e das páginas, as folhas do livro vistas de lado e a tinta da escrita (sépia). */
const PAPEL: MaterialDaPeca = { classe: 'liso', rgb: [0xe7, 0xdd, 0xc3] }
const FOLHAS: MaterialDaPeca = { classe: 'liso', rgb: [0xd6, 0xca, 0xae] }
const TINTA: Rgb3 = [0x5e, 0x4c, 0x40]
/** A letra capitular do livro: o vinho, apagado. */
const CAPITULAR: Rgb3 = [0x9a, 0x50, 0x48]
/** As linhas de escrita: o passo entre elas, a grossura do traço e a margem (px do protótipo). */
const PASSO_DA_LINHA = 1.7
const TRACO_DA_LINHA = 0.5
const MARGEM_DA_ESCRITA = 1.3
/** Quanto da cor do papel vira tinta no traço. */
const FORCA_DA_TINTA = 0.55
/** A largura média de uma palavra (px do protótipo) e a parte delas que é espaço em branco. */
const PALAVRA = 1.5
const ESPACOS = 0.22
/** A sombra da lombada na página do livro aberto: a largura (px do protótipo) e a força. */
const LARGURA_DA_LOMBADA = 3.4
const FORCA_DA_LOMBADA = 0.2

/** Uma folha escrita: o retângulo girado dela e como a escrita o enche. */
interface Escrita {
  readonly cx: number
  readonly cy: number
  readonly mx: number
  readonly my: number
  readonly ang: number
  /** A parte da altura que já está escrita (1 = a folha inteira). */
  readonly ate: number
  /** De que lado fica a lombada do livro (-1 à esquerda, 1 à direita); 0 = folha solta. */
  readonly lombada: number
  /** A letra capitular no começo do texto. */
  readonly capitular: boolean
  readonly semente: number
  /** A escala das medidas do traço (o `k` de quem encolhe com o tampo). */
  readonly k: number
}

/**
 * O papel escrito: as linhas de texto em sépia, quebradas em palavras, a última
 * mais curta; na página do livro, a sombra da lombada. As contas são no
 * referencial da folha (o ponto desgirado em volta do meio dela).
 */
function texEscrita(e: Escrita): Textura {
  const co = Math.cos(e.ang)
  const si = Math.sin(e.ang)
  const passo = PASSO_DA_LINHA * e.k
  const margem = MARGEM_DA_ESCRITA * e.k
  const alto = 2 * e.my - 2 * margem
  const linhas = Math.max(1, Math.floor((alto * e.ate) / passo))
  return (_u, _v, x, y, _p, s) => {
    const dx = x - e.cx
    const dy = y - e.cy
    const lx = dx * co + dy * si
    const ly = -dx * si + dy * co
    if (e.lombada !== 0) {
      const ate = e.lombada < 0 ? lx + e.mx : e.mx - lx
      const q = 1 - ate / (LARGURA_DA_LOMBADA * e.k)
      if (q > 0) s[3] -= FORCA_DA_LOMBADA * q * q
    }
    if (Math.abs(lx) > e.mx - margem) return
    const noAlto = ly + e.my - margem
    if (noAlto < 0) return
    const linha = Math.floor(noAlto / passo)
    if (linha >= linhas) return
    if (e.capitular && linha < 2 && lx < -e.mx + margem + 2 * passo) {
      // A capitular ocupa as duas primeiras linhas, um quadrado cheio.
      if (noAlto < 2 * passo - passo * 0.3) pintarTinta(s, CAPITULAR, 0.8)
      return
    }
    if (noAlto - linha * passo > TRACO_DA_LINHA * e.k) return
    // A última linha acaba antes do fim; as outras, quebradas em palavras.
    if (linha === linhas - 1 && lx > e.mx * (hash(linha, 3, e.semente) - 0.5)) return
    if (hash(Math.floor((lx + e.mx) / (PALAVRA * e.k)), linha, e.semente) < ESPACOS) return
    pintarTinta(s, TINTA, FORCA_DA_TINTA)
  }
}

/** Mistura a cor da tinta na cor do ponto. */
function pintarTinta(s: Float32Array, tinta: Rgb3, forca: number): void {
  s[0] += (tinta[0] - s[0]) * forca
  s[1] += (tinta[1] - s[1]) * forca
  s[2] += (tinta[2] - s[2]) * forca
}

// ---------- em cima do tampo ----------

const LATAO = materialDaPeca('latao')
/** A capa do livro aberto (o couro da estante de livros) e o fitilho. */
const COURO_DA_CAPA: MaterialDaPeca = { classe: 'liso', rgb: [0x8c, 0x5e, 0x42] }
const FITILHO = materialDaPeca('vinho')
/** A cera da vela (o creme do altar). */
const CERA: MaterialDaPeca = { classe: 'liso', rgb: [0xe2, 0xd7, 0xbc] }
/** O pote do tinteiro (louça escura, com brilho) e a tinta dentro dele. */
const POTE: MaterialDaPeca = { classe: 'liso', rgb: [0x48, 0x55, 0x5c] }
const BRILHO_DO_POTE = 0.3
/** A pena de ganso: as barbas quase brancas e a haste. */
const PENA: MaterialDaPeca = { classe: 'liso', rgb: [0xec, 0xe8, 0xdc] }
const HASTE: MaterialDaPeca = { classe: 'liso', rgb: [0xd9, 0xcf, 0xb6] }
/** O lacre da carta: o vinho, um pouco mais vivo. */
const LACRE: MaterialDaPeca = { classe: 'liso', rgb: [0xa3, 0x48, 0x43] }

/**
 * Onde fica cada coisa, em fração da meia largura e da meia altura do couro a
 * partir do meio dele, e as medidas de cada uma (px do protótipo).
 */
const CASTICAL = { x: -0.83, y: -0.5, raio: 5 }
const LIVRO = { x: -0.25, y: 0.13, meioComprimento: 12.4, meiaLargura: 7.9, giro: -0.05 }
const FOLHAS_SOLTAS = { x: 0.63, y: 0.17, meiaLargura: 5.6, meioComprimento: 7.6 }
const TINTEIRO = { x: 0.4, y: -0.62, raio: 3.1 }
const CARTA = { x: -0.8, y: 0.56, meioComprimento: 4.6, meiaLargura: 3, giro: 0.32 }
/** A pena, do tinteiro para fora: até onde vai (px do protótipo, a partir do meio do tinteiro). */
const PONTA_DA_PENA: Ponto = [18.5, -4.6]
/** O contorno das barbas da pena: a fração do comprimento e a meia largura de cada lado (px do protótipo). */
const BARBAS: readonly Ponto[] = [[0.38, 0], [0.48, -1.2], [0.62, -1.9], [0.8, -2.1], [0.93, -1.6], [1, -0.3], [0.97, 1], [0.84, 1.5], [0.66, 1.45], [0.5, 0.95]]
/** Cada folha solta: o deslocamento do meio (px do protótipo), o giro, a luz do papel e o quanto está escrita. */
const FOLHAS_DO_MACO: readonly { dx: number; dy: number; giro: number; tom: number; ate: number }[] = [
  { dx: -1.6, dy: 1.2, giro: 0.2, tom: 0.95, ate: 1 },
  { dx: 2, dy: -0.4, giro: -0.16, tom: 0.98, ate: 1 },
  { dx: 0, dy: 0.3, giro: 0.04, tom: 1.02, ate: 0.55 },
]

/** O castiçal de latão com a vela apagada: o pé, o prato rebaixado, a cera que escorreu, o toco com a cova e o pavio preto. */
function castical(L: Peca[], P: CriarPeca, x: number, y: number, r: number): void {
  L.push(P(elipse(x, y, r, r), LATAO, { bisel: r * 0.3, contorno: 0.3, semente: 580, projeta: { dist: 1.5, forca: 0.34 } }))
  L.push(P(elipse(x, y, r * 0.78, r * 0.78), LATAO, { bisel: 0, tom: 0.8, contorno: 0.1, recesso: { k: 1.2, forca: 0.34 }, semente: 581 }))
  L.push(P(elipse(x - r * 0.3, y + r * 0.26, r * 0.42, r * 0.36), CERA, { bisel: r * 0.14, tom: 0.9, contorno: 0.14, semente: 582 }))
  L.push(P(elipse(x, y, r * 0.52, r * 0.52), CERA, { bisel: r * 0.2, contorno: 0.24, semente: 583, projeta: { dist: 1, forca: 0.3, suave: 0.6 } }))
  L.push(P(elipse(x, y, r * 0.3, r * 0.3), CERA, { bisel: 0, tom: 0.9, contorno: 0, recesso: { k: 0.7, forca: 0.26 }, semente: 584 }))
  // O pavio queimado, torto para um lado.
  L.push(P(capsula(x, y, x + r * 0.2, y - r * 0.16, r * 0.1), BURACO, { ...SEM_BORDA, semente: 585 }))
}

/** O livro aberto: a capa aparecendo em volta, o miolo das folhas, as duas páginas escritas e o fitilho na lombada. */
function livroAberto(L: Peca[], P: CriarPeca, cx: number, cy: number, k: number): void {
  const mx = LIVRO.meioComprimento * k
  const my = LIVRO.meiaLargura * k
  const ang = LIVRO.giro
  L.push(P(girado(cx, cy, mx + k, my + 0.8 * k, ang), COURO_DA_CAPA, { bisel: 0.6 * k, contorno: 0.28, semente: 590, projeta: { dist: 1.3 * k, forca: 0.32 } }))
  L.push(P(girado(cx, cy, mx + 0.35 * k, my + 0.15 * k, ang), FOLHAS, { bisel: 0.3, tom: 0.9, contorno: 0.16, semente: 591 }))
  for (const lado of [-1, 1]) {
    const meiaPagina = mx / 2 - 0.1 * k
    const co = Math.cos(ang)
    const si = Math.sin(ang)
    const escrita: Escrita = {
      cx: cx + (lado * mx * co) / 2,
      cy: cy + (lado * mx * si) / 2,
      mx: meiaPagina,
      my: my - 0.2 * k,
      ang,
      ate: lado < 0 ? 1 : 0.8,
      lombada: -lado,
      capitular: lado < 0,
      semente: 592 + lado,
      k,
    }
    L.push(P(girado(escrita.cx, escrita.cy, escrita.mx, escrita.my, ang), PAPEL, { bisel: 0.4 * k, contorno: 0.1, textura: texEscrita(escrita), semente: 592 + lado }))
  }
  const no = (dx: number, dy: number): Ponto => [cx + dx * Math.cos(ang) - dy * Math.sin(ang), cy + dx * Math.sin(ang) + dy * Math.cos(ang)]
  const [fx0, fy0] = no(0.5 * k, -my * 0.2)
  const [fx1, fy1] = no(1.3 * k, my + 2.2 * k)
  L.push(P(capsula(fx0, fy0, fx1, fy1, 0.5 * k), FITILHO, { bisel: 0.3 * k, contorno: 0.2, semente: 595 }))
}

/** As folhas soltas, uma por cima da outra, cada uma num giro; a de cima ainda pela metade. */
function folhasSoltas(L: Peca[], P: CriarPeca, cx: number, cy: number, k: number): void {
  FOLHAS_DO_MACO.forEach((f, i) => {
    const escrita: Escrita = {
      cx: cx + f.dx * k,
      cy: cy + f.dy * k,
      mx: FOLHAS_SOLTAS.meiaLargura * k,
      my: FOLHAS_SOLTAS.meioComprimento * k,
      ang: f.giro,
      ate: f.ate,
      lombada: 0,
      capitular: false,
      semente: 600 + i,
      k,
    }
    L.push(P(girado(escrita.cx, escrita.cy, escrita.mx, escrita.my, f.giro), PAPEL, { bisel: 0.25, contorno: 0.2, tom: f.tom, textura: texEscrita(escrita), semente: 600 + i, projeta: { dist: 0.7 * k, forca: 0.22, suave: 0.6 } }))
  })
}

/** As barbas da pena: riscos finos em diagonal, inclinados para a ponta (u corre ao longo da pena). */
const texBarbas: Textura = (u, v, _x, _y, _p, s) => {
  s[3] += Math.sin((u * 0.8 + v * 1.6) * 2.4) * 0.045
}

/** O tinteiro (o pote de louça escura, o gargalo de latão e a tinta) e a pena de ganso dentro dele, deitada para fora. */
function tinteiroComPena(L: Peca[], P: CriarPeca, x: number, y: number, k: number): void {
  const r = TINTEIRO.raio * k
  L.push(P(elipse(x, y, r, r), POTE, { bisel: r * 0.5, metal: BRILHO_DO_POTE, contorno: 0.3, semente: 610, projeta: { dist: 1.2, forca: 0.32 } }))
  L.push(P(anel(x, y, r * 0.66, r * 0.66, r * 0.42, r * 0.42), LATAO, { bisel: r * 0.12, contorno: 0.2, semente: 611 }))
  L.push(P(elipse(x, y, r * 0.42, r * 0.42), BURACO, { ...SEM_BORDA, recesso: { k: 0.6, forca: 0.3 }, semente: 612 }))
  const [px, py] = [PONTA_DA_PENA[0] * k, PONTA_DA_PENA[1] * k]
  const comprimento = Math.hypot(px, py)
  const [ux, uy] = [px / comprimento, py / comprimento]
  const naPena = ([ao, lado]: Ponto): Ponto => [x + ux * ao * comprimento - uy * lado * k, y + uy * ao * comprimento + ux * lado * k]
  const giro = Math.atan2(py, px)
  L.push(P(poligono(BARBAS.map(naPena)), PENA, { bisel: 0.5 * k, contorno: 0.26, eixo: giro, textura: texBarbas, semente: 613, projeta: { dist: 0.9 * k, forca: 0.26, suave: 0.6 } }))
  L.push(P(capsula(x, y, x + px * 0.98, y + py * 0.98, 0.34 * k), HASTE, { bisel: 0.3 * k, contorno: 0.24, semente: 614 }))
}

/** A carta dobrada e lacrada: o papel, as duas dobras da aba e o pingo de lacre. */
function cartaLacrada(L: Peca[], P: CriarPeca, cx: number, cy: number, k: number): void {
  const mx = CARTA.meioComprimento * k
  const my = CARTA.meiaLargura * k
  const ang = CARTA.giro
  const no = (dx: number, dy: number): Ponto => [cx + dx * Math.cos(ang) - dy * Math.sin(ang), cy + dx * Math.sin(ang) + dy * Math.cos(ang)]
  L.push(P(girado(cx, cy, mx, my, ang), PAPEL, { bisel: 0.3, contorno: 0.22, tom: 0.98, semente: 620, projeta: { dist: 0.8 * k, forca: 0.24, suave: 0.6 } }))
  // A aba fechada: duas dobras dos cantos de cima até o lacre, no meio.
  for (const lado of [-1, 1]) {
    const [ax, ay] = no(lado * (mx - 0.3 * k), -my + 0.3 * k)
    const [bx, by] = no(0, 0.2 * k)
    L.push(P(capsula(ax, ay, bx, by, 0.22 * k), FOLHAS, { ...SEM_BORDA, tom: 0.8, semente: 621 + lado }))
  }
  const [lx, ly] = no(0, 0.3 * k)
  L.push(P(elipse(lx, ly, 1.25 * k, 1.25 * k), LACRE, { bisel: 0.8 * k, contorno: 0.24, semente: 623 }))
}

export const montarEscrivaninha: MontarMovel = (c, cena) => {
  const { hw, hh, w, h, g, peca: P } = c
  const mad = c.m.madeira
  const pux = c.m.puxadores
  // A frente guardada tem de caber debaixo do tampo: a escrivaninha mais rasa que a altura dela fica mais baixa.
  const H = Math.min(g * ALTURA, h - FOLGA_DO_GUARDADO - 2 * FRESTA)
  /** Onde o corpo acaba e as duas frestas começam: a da frente e, na beira, a dos puxadores. */
  const frente = hh - 2 * FRESTA
  const meioDaFresta = frente + FRESTA / 2
  const yDoPuxador = hh - FRESTA / 2
  const L = cena.partes

  // A frente, guardada debaixo do tampo.
  const desce = frente + SUBIDA_DA_FRENTE
  const desenho = desenharFrente((forma, mat, o) => L.push(P(guardada(forma, desce, meioDaFresta), mat, o)), hw, w, H, mad, pux)

  // O corpo dá a sombra e a altura do tampo; as frestas não fazem sombra, só dizem à 3/4 quanto cada uma sobe.
  const pontos = desenho.puxadores.map((x) => caixa(x - 0.15, hh - FRESTA, x + 0.15, hh))
  cena.sombras.push(
    { forma: caixa(-hw, -hh, hw, frente, 1.2), z: H },
    contato(caixa(-hw, -hh, hw, hh, 1.2)),
    { forma: caixa(-hw + RECUO_DA_FRESTA, frente, hw - RECUO_DA_FRESTA, frente + FRESTA), z: SUBIDA_DA_FRENTE, solta: true, forca: 0 },
    { forma: pontos.reduce(uniao), z: desenho.alturaDoPuxador + (yDoPuxador - frente), solta: true, forca: 0 },
  )

  // O tampo: a prancha, as quatro réguas da moldura em meia-esquadria (o veio acompanha cada lado) e o couro.
  const m = Math.min(g * MOLDURA_DO_TAMPO, 0.22 * Math.min(w, h))
  const r = RECUO_DAS_REGUAS
  L.push(P(caixa(-hw, -hh, hw, hh, 1.4), mad, { tabua: 0, bisel: 1.7, semente: 520 }))
  const reguas: readonly (readonly [readonly Ponto[], number])[] = [
    [[[-hw + r, -hh + r], [hw - r, -hh + r], [hw - m, -hh + m], [-hw + m, -hh + m]], 0],
    [[[-hw + m, hh - m], [hw - m, hh - m], [hw - r, hh - r], [-hw + r, hh - r]], 0],
    [[[-hw + r, -hh + r], [-hw + m, -hh + m], [-hw + m, hh - m], [-hw + r, hh - r]], QUARTO],
    [[[hw - m, -hh + m], [hw - r, -hh + r], [hw - r, hh - r], [hw - m, hh - m]], QUARTO],
  ]
  reguas.forEach(([pontosDaRegua, eixo], i) => {
    L.push(P(poligono(pontosDaRegua), mad, { eixo, tabua: 0, bisel: 0, contorno: 0.14, tom: 0.96 + 0.05 * hash(i, 5, 521), semente: 521 + i }))
  })
  const cw = hw - m
  const ch = hh - m
  L.push(P(caixa(-cw, -ch, cw, ch, 0.8), COURO_VERDE, { bisel: 0, contorno: 0.2, recesso: { k: 1.3, forca: 0.26 }, textura: texCouro, semente: 526 }))
  const f = RECUO_DO_FILETE
  const filete = menos(caixa(-cw + f, -ch + f, cw - f, ch - f, 0.7), caixa(-cw + f + LARGURA_DO_FILETE, -ch + f + LARGURA_DO_FILETE, cw - f - LARGURA_DO_FILETE, ch - f - LARGURA_DO_FILETE, 0.4))
  L.push(P(filete, FILETE, { ...SEM_BORDA, alfa: 0.7, semente: 527 }))

  // O que está em cima: medida própria, encolhendo só na escrivaninha menor que a de partida.
  const k = Math.min(1, w / (g * LARGURA_DE_PARTIDA), h / (g * FUNDO_DE_PARTIDA))
  cartaLacrada(L, P, CARTA.x * cw, CARTA.y * ch, k)
  castical(L, P, CASTICAL.x * cw, CASTICAL.y * ch, CASTICAL.raio * k)
  livroAberto(L, P, LIVRO.x * cw, LIVRO.y * ch, k)
  folhasSoltas(L, P, FOLHAS_SOLTAS.x * cw, FOLHAS_SOLTAS.y * ch, k)
  tinteiroComPena(L, P, TINTEIRO.x * cw, TINTEIRO.y * ch, k)

  for (const x of desenho.puxadores) {
    L.push(P(elipse(x, yDoPuxador, RAIO_DO_PUXADOR, RAIO_DO_PUXADOR), pux, { bisel: 1.5, contorno: 0.16, semente: 528, projeta: { dist: 0.9, forca: 0.3 } }))
  }
}
