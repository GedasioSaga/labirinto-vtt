/**
 * PIANO de armário de cima com volume (lote 4 dos objetos novos, 11/11/2026):
 * o piano vertical de taverna ou de sala, encostado na parede, com o
 * banquinho. De cima, do fundo para a frente: a TAMPA de madeira escura
 * envernizada (a emenda com as dobradiças, a partitura aberta e um castiçal
 * de latão com a vela apagada), o TECLADO que sai da caixa (as teclas brancas
 * e as pretas em grupos de duas e de três, entre as duas bochechas de
 * madeira, com o feltro no fundo) e o BANQUINHO redondo de assento estofado.
 * O teclado é o que diz piano: o número de teclas sai da largura, em oitavas
 * inteiras, para a tecla nunca ficar mais fina do que se lê no tamanho de mesa.
 *
 * NA 3/4 A FRENTE APARECE INTEIRA. A frente que a 3/4 varre sozinha é madeira
 * lisa; aqui ela é desenhada de frente, uma vez (os três painéis de cima, a
 * tampa das teclas com a fechadura, a tábua de baixo e o rodapé), e FATIADA
 * como a do guarda-roupa (`guardaRoupa.ts`): cada faixa fica guardada debaixo
 * da tampa na vista de cima e tem a sua FRESTA, um tampo no ar de um quarto de
 * px colado na frente da caixa, na altura da faixa. A regra da 3/4
 * (`tresQuartos.ts`: cada peça sobe a altura da estrutura que contém o meio
 * dela) põe cada faixa no lugar. Diferente do guarda-roupa, nenhuma faixa
 * aparece de cima: a vista de cima é só o que se vê do alto.
 *
 * O TECLADO é um tampo solto na altura dele, com um consolo e uma sapata
 * (colunas sem peça) em cada ponta; as teclas sobem com ele e a beirada do
 * tampo é o leito das teclas. O BANQUINHO é outro tampo solto, sobre três pernas.
 * Girado, o piano mostra a lateral ou as costas de madeira lisa: a caixa e as
 * cantoneiras são pintadas depois das faixas e as cobrem.
 *
 * As profundidades são frações da pegada (a caixa, o teclado, o vão e o
 * banquinho); as alturas, a tecla, a partitura e o castiçal são em casas (o
 * piano esticado ganha oitavas e tampa, não uma partitura maior). Materiais:
 * `madeira` e `assento`; o marfim, o ébano, o feltro, o latão, a cera e o
 * papel são fixos.
 */
import { hash } from '../../ruido'
import { anel, caixa, capsula, elipse, poligono, type Forma, type Ponto } from './formas'
import { contato, texturaDaClasse, type Cena, type CriarPeca, type MaterialDaPeca, type OpcoesDaPeca, type Peca, type Textura } from './motor'
import { BURACO, G, QUARTO, materialDaPeca, type ContextoDoMovel, type MontarMovel } from './contexto'

/** Alturas em casas: o piano (do chão ao alto da tampa), o teclado e o assento do banquinho. */
const ALTURA = 1.02
const ALTURA_DO_TECLADO = 0.5
const ALTURA_DO_BANQUINHO = 0.34
/**
 * A beirada que a 3/4 dá a cada tampo solto (px do protótipo), a padrão de
 * `tresQuartos.ts` (`ESPESSURA_DO_TAMPO`): é a grossura do leito das teclas e
 * a do assento. Os consolos e as pernas, que os seguram, sobem até debaixo dela.
 */
const BEIRADA = 0.06 * G
/** A pegada do fundo para a frente, em fração da profundidade: a caixa, o teclado que sai dela e o vão até o banquinho. */
const FUNDO_DA_CAIXA = 0.42
const FUNDO_DO_TECLADO = 0.2
const VAO_DO_BANQUINHO = 0.08

/**
 * A madeira escura envernizada: os tons sobre o material (a tampa, a caixa
 * vista de frente, o fundo da moldura, o painel em relevo e as quinas que
 * pegam a luz) e o brilho do verniz.
 */
const TOM_DA_TAMPA = 0.8
const TOM_DA_CAIXA = 0.76
const TOM_DA_MOLDURA = 0.68
const TOM_DO_PAINEL = 0.93
const TOM_DA_QUINA = 0.96
const VERNIZ = 0.14

const LATAO = materialDaPeca('latao')
/** O feltro no fundo das teclas: a lã vinho, fixa. */
const FELTRO = materialDaPeca('vinho')
/** O marfim das teclas brancas e o ébano das pretas (um carvão quente: preto puro o piso de luz levantaria para marrom). */
const MARFIM: MaterialDaPeca = { classe: 'liso', rgb: [0xe8, 0xe0, 0xcb] }
const EBANO: MaterialDaPeca = { classe: 'liso', rgb: [0x4c, 0x46, 0x42] }
/** A cera da vela: creme, sem brilho (a do castiçal do altar). */
const CERA: MaterialDaPeca = { classe: 'liso', rgb: [0xe2, 0xd7, 0xbc] }
/** O papel da partitura e a capa dela, que aparece na beira. */
const PAPEL: MaterialDaPeca = { classe: 'liso', rgb: [0xe4, 0xda, 0xc2] }
const CAPA_DA_PARTITURA: MaterialDaPeca = { classe: 'liso', rgb: [0xb4, 0xa2, 0x80] }
/** A sombra pintada na frente (a da tampa nos painéis, a do teclado no painel de baixo): o escuro quente da nogueira, meio transparente. */
const SOMBRA: MaterialDaPeca = { classe: 'liso', rgb: [0x2e, 0x21, 0x18] }

// ---------- a frente em faixas (a conta do guarda-roupa) ----------

/** Onde a frente desenhada começa, em casas a partir do chão: abaixo fica a frente lisa que a 3/4 varre, e é aí que cai a beirada da fresta de baixo. */
const PE_DA_FRENTE = 0.07
/** A fresta de cada faixa (px do protótipo) e as cantoneiras que fecham as frestas dos dois lados. */
const FRESTA = 0.25
const CANTONEIRA = 0.5
/** A faixa guardada fica a esta distância do fundo da pegada, no mínimo, e as frestas cabem nesta sobra da frente. */
const FOLGA_DO_GUARDADO = 2.5
const SOBRA_DAS_FRESTAS = 2.5
/** Por mais rasa que o mestre deixe a pegada, a faixa não fica menor que isto (px do protótipo). */
const FAIXA_MINIMA = 8
/** Quanto uma faixa passa por cima da vizinha (px do protótipo): sem isso sobraria um fio da frente lisa entre as duas. */
const EMENDA = 0.2
/** Até onde a forma de uma cópia continua valendo depois do corte (px do protótipo): mais que o alcance do recesso e do chanfro. */
const FOLGA_DO_CORTE = 3
const FORA_DA_FAIXA = 1e3

/** Uma faixa da frente: as alturas que ela cobre (px do protótipo a partir do chão) e onde fica guardada. */
interface Faixa {
  readonly pe: number
  readonly topo: number
  /** O y da vista de cima em que o pé da faixa fica: o começo da fresta dela. */
  readonly base: number
  /** A altura da fresta (o quanto a faixa sobe na 3/4). */
  readonly z: number
}

/** A peça da frente não projeta sombra nem tem deslocamento: a cópia de uma faixa escureceria a da outra. */
type OpcoesDaFrente = Omit<OpcoesDaPeca, 'dx' | 'dy' | 'projeta' | 'polar' | 'arco' | 'ruga' | 'curvaY'>

/** Uma peça desenhada DE FRENTE: x como na pegada, y = 0 no chão e negativo para cima. */
interface PecaDaFrente {
  readonly forma: Forma
  readonly mat: MaterialDaPeca
  readonly o: OpcoesDaFrente
}

type PorNaFrente = (forma: Forma, mat: MaterialDaPeca, o: OpcoesDaFrente) => void

/**
 * A cópia da peça da frente que cabe à faixa, ou nada se a peça não passa por
 * ela. A forma é a peça inteira, descida para o lugar guardado (o veio, o
 * chanfro e o recesso saem iguais em todas as cópias), com a caixa de pintura
 * espelhada em volta do meio da fresta: é o meio da caixa que a 3/4 lê. A
 * textura esconde o que passa da faixa e devolve ao material as coordenadas
 * da frente, para o veio não quebrar no corte.
 */
function naFaixa(P: CriarPeca, peca: PecaDaFrente, fx: Faixa): Peca | null {
  const f = peca.forma
  const desce = fx.base + fx.pe
  const visivel0 = Math.max(fx.base - (fx.topo - fx.pe), f.b[1] + desce) - EMENDA
  const visivel1 = Math.min(fx.base, f.b[3] + desce) + EMENDA
  if (visivel1 - visivel0 <= 2 * EMENDA) return null
  const corte0 = visivel0 - FOLGA_DO_CORTE
  const corte1 = visivel1 + FOLGA_DO_CORTE
  const meio = fx.base + FRESTA / 2
  const forma: Forma = {
    b: [f.b[0], corte0, f.b[2], 2 * meio - corte0],
    d: (x, y) => (y < corte0 || y > corte1 ? FORA_DA_FAIXA : f.d(x, y - desce)),
  }
  const eixo = peca.o.eixo ?? 0
  const du = -desce * Math.sin(eixo)
  const dv = -desce * Math.cos(eixo)
  const doMaterial = peca.o.textura ?? texturaDaClasse(peca.mat.classe)
  const textura: Textura = (u, v, x, y, p, s, escala) => {
    if (y < visivel0 || y > visivel1) {
      s[5] = 0
      return
    }
    if (doMaterial !== null) doMaterial(u + du, v + dv, x, y - desce, p, s, escala)
  }
  return P(forma, peca.mat, { ...peca.o, textura })
}

/**
 * As faixas da frente, de baixo para cima, e onde a caixa acaba e as frestas
 * começam. `fundo` = a profundidade da caixa; `yDaFrente` = a beira da frente
 * dela na vista de cima. A faixa de baixo fica na fresta da frente: a 3/4
 * pinta do fundo para a frente, e cada faixa cobre a beirada da de cima.
 */
function fatiar(H: number, pe: number, fundo: number, yDaFrente: number): { faixas: Faixa[]; frente: number } {
  const maxima = Math.max(FAIXA_MINIMA, fundo - FOLGA_DO_GUARDADO - SOBRA_DAS_FRESTAS)
  const quantas = Math.max(1, Math.ceil((H - pe) / maxima))
  const passo = (H - pe) / quantas
  const frente = yDaFrente - quantas * FRESTA
  const faixas: Faixa[] = []
  for (let k = 0; k < quantas; k += 1) {
    const base = frente + (quantas - 1 - k) * FRESTA
    faixas.push({ pe: pe + k * passo, topo: pe + (k + 1) * passo, base, z: pe + k * passo + (base - frente) })
  }
  return { faixas, frente }
}

// ---------- o desenho da frente ----------

/** O rodapé e a quina da tampa vistos de frente, em casas. */
const RODAPE = 0.115
const QUINA_DA_TAMPA = 0.043
/** A tampa das teclas (a tábua logo acima delas, com a fechadura), em casas. */
const TAMPA_DAS_TECLAS = 0.115
/** Os painéis de cima: a parte da largura de cada um e o vão entre dois (px do protótipo). */
const PAINEIS_DE_CIMA: readonly number[] = [0.2, 0.6, 0.2]
const VAO_ENTRE_PAINEIS = 2.4
/** Quanto os painéis recuam da lateral da caixa e o painel em relevo, da moldura dele (px do protótipo). */
const RECUO_DOS_PAINEIS = 4
const RECUO_DO_RELEVO = 2.3
/** A sombra que a quina da tampa faz no alto dos painéis e a que o teclado faz no painel de baixo (px do protótipo). */
const SOMBRA_DA_TAMPA = 2.6
const SOMBRA_DO_TECLADO = 4.5

/** Uma almofada: a moldura afundada e, se couber, o painel em relevo, que pega a luz. `a0` e `a1` = as alturas do pé e do alto. */
function almofada(por: PorNaFrente, mad: MaterialDaPeca, x0: number, a0: number, x1: number, a1: number, semente: number): void {
  por(caixa(x0, -a1, x1, -a0, 0.5), mad, { tabua: 0, bisel: 0.3, tom: TOM_DA_MOLDURA, recesso: { k: 2.2, forca: 0.36 }, contorno: 0.12, semente })
  const r = RECUO_DO_RELEVO
  if (x1 - x0 <= 4 * r || a1 - a0 <= 4 * r) return
  por(caixa(x0 + r, -a1 + r, x1 - r, -a0 - r, 0.6), mad, { tabua: 0, bisel: 1.9, tom: TOM_DO_PAINEL, metal: VERNIZ, contorno: 0.14, semente: semente + 1 })
}

/**
 * A frente inteira, de frente: a caixa, o rodapé, a sombra do teclado na
 * tábua de baixo, a tampa das teclas com a fechadura, os painéis de cima e a
 * quina da tampa com a sombra dela. `fundoDoTeclado` = quanto o teclado sai
 * da caixa: o que fica atrás dele não aparece.
 */
function desenharFrente(hw: number, g: number, fundoDoTeclado: number, mad: MaterialDaPeca): PecaDaFrente[] {
  const H = g * ALTURA
  const pe = g * PE_DA_FRENTE
  const rodape = g * RODAPE
  const zTeclado = g * ALTURA_DO_TECLADO
  const pecas: PecaDaFrente[] = []
  const por: PorNaFrente = (forma, mat, o) => {
    pecas.push({ forma, mat, o })
  }
  const madeira = (tom: number, semente: number, bisel: number): OpcoesDaFrente => ({ tabua: 0, bisel, tom, metal: VERNIZ, semente })

  por(caixa(-hw, -H, hw, -pe, 0.6), mad, madeira(TOM_DA_CAIXA, 710, 0.9))
  por(caixa(-hw, -rodape, hw, -pe + 0.3, 0.5), mad, madeira(TOM_DA_QUINA, 711, 0.9))

  // A tábua de baixo é lisa: o que se vê dela, entre o rodapé e o leito das teclas, fica na sombra do teclado.
  const aVista = zTeclado - BEIRADA - fundoDoTeclado
  if (aVista > rodape) por(caixa(-hw + 1.2, -aVista - 1.5, hw - 1.2, -aVista + SOMBRA_DO_TECLADO), SOMBRA, { bisel: 0, contorno: 0, alfa: 0.3, suave: 2 })

  // A tampa das teclas: a tábua arredondada logo acima delas, com o espelho da fechadura e o buraco da chave.
  const tampa = g * TAMPA_DAS_TECLAS
  por(caixa(-hw + 2.2, -zTeclado - tampa, hw - 2.2, -zTeclado + 0.6, 1.3), mad, madeira(TOM_DO_PAINEL, 716, 1.8))
  por(caixa(-1.9, -zTeclado - tampa * 0.74, 1.9, -zTeclado - tampa * 0.3, 0.7), LATAO, { bisel: 0.6, contorno: 0.2, tom: 0.9, semente: 717 })
  por(capsula(0, -zTeclado - tampa * 0.6, 0, -zTeclado - tampa * 0.44, 0.36), BURACO, { bisel: 0, contorno: 0 })

  // Os painéis de cima, entre a tampa das teclas e a quina da tampa.
  const quina = g * QUINA_DA_TAMPA
  const [pePainel, altoPainel] = [zTeclado + tampa + 1.6, H - quina - 2]
  const largura = 2 * (hw - RECUO_DOS_PAINEIS) - (PAINEIS_DE_CIMA.length - 1) * VAO_ENTRE_PAINEIS
  let x = -hw + RECUO_DOS_PAINEIS
  for (const [i, parte] of PAINEIS_DE_CIMA.entries()) {
    almofada(por, mad, x, pePainel, x + largura * parte, altoPainel, 730 + i * 4)
    x += largura * parte + VAO_ENTRE_PAINEIS
  }

  // A quina da tampa, que avança por cima dos painéis, e a sombra que ela faz neles.
  por(caixa(-hw + 1.2, -H + quina - 0.5, hw - 1.2, -H + quina + SOMBRA_DA_TAMPA), SOMBRA, { bisel: 0, contorno: 0, alfa: 0.3, suave: 1.6 })
  por(caixa(-hw, -H, hw, -H + quina, 0.7), mad, madeira(TOM_DA_QUINA, 714, 1.2))
  return pecas
}

// ---------- o teclado ----------

/** A bochecha (o bloco de madeira de cada ponta do teclado) e a tecla branca, em casas. */
const BOCHECHA = 0.085
const LARGURA_DA_TECLA = 0.06
/** A altura da sapata (o pé que liga cada consolo à caixa, rente ao chão), em casas. */
const ALTURA_DA_SAPATA = 0.09
/** As teclas recuam isto da caixa (onde fica o feltro) e acabam a esta distância da beira do leito (px do protótipo). */
const RECUO_DAS_TECLAS = 1
const FRENTE_DO_LEITO = 1.7
const TECLAS_POR_OITAVA = 7
/** Depois de qual branca da oitava (dó, ré, mi, fá, sol, lá, si) há uma preta: os grupos de duas e de três. */
const TEM_PRETA_DEPOIS: readonly boolean[] = [true, true, false, true, true, true, false]
/** A preta, em fração da branca: a largura e o comprimento. */
const LARGURA_DA_PRETA = 0.56
const COMPRIMENTO_DA_PRETA = 0.62
/** A junta entre duas brancas: a meia largura (px do protótipo), o escuro no meio dela e a variação de tom de tecla para tecla. */
const MEIA_JUNTA = 0.3
const ESCURO_DA_JUNTA = 0.45
const VARIACAO_DAS_TECLAS = 0.035

/**
 * As teclas brancas são uma peça só, e a junta entre duas é um risco escuro
 * na textura. A junta tem pelo menos um pixel da imagem: no tamanho de mesa o
 * risco fino cairia entre dois pixels e sumiria numas teclas e não noutras.
 * Mais larga, ela fica mais fraca na mesma medida.
 */
function texDasTeclas(x0: number, largura: number): Textura {
  return (_u, _v, x, _y, _p, s, escala) => {
    const tecla = (x - x0) / largura
    const ate = Math.abs(tecla - Math.round(tecla)) * largura
    const meia = Math.max(MEIA_JUNTA, 0.5 / escala)
    if (ate < meia) s[3] -= ESCURO_DA_JUNTA * (MEIA_JUNTA / meia) * (1 - ate / meia)
    s[3] += (hash(Math.floor(tecla), 5, 977) - 0.5) * VARIACAO_DAS_TECLAS
  }
}

/**
 * O teclado: o leito (o tampo solto), os consolos das pontas com a sapata de
 * cada um, o feltro, as brancas, as pretas e as duas bochechas. Os consolos e
 * as sapatas são colunas sem peça: de cima ficam debaixo do leito; na 3/4 o
 * consolo é a perna que segura o teclado e a sapata liga o pé dele à caixa
 * (sem ela a caixa parecia solta no ar, atrás de duas pernas compridas).
 */
function montarTeclado(c: ContextoDoMovel, cena: Cena, yCaixa: number, yTeclado: number): void {
  const { hw, w, g, peca: P } = c
  const mad = c.m.madeira
  const z = g * ALTURA_DO_TECLADO
  const leito = caixa(-hw, yCaixa, hw, yTeclado, 0.8)
  cena.sombras.push({ forma: leito, z, solta: true, forca: 0.22 })
  const bochecha = Math.min(g * BOCHECHA, w * 0.12)
  for (const xa of [-hw + 0.5, hw - bochecha + 0.5]) {
    const xb = xa + bochecha - 1
    const consolo = caixa(xa, yTeclado - bochecha, xb, yTeclado - 0.4, 0.8)
    const sapata = caixa(xa, yCaixa, xb, yTeclado - 0.4, 0.8)
    cena.sombras.push({ forma: sapata, z: g * ALTURA_DA_SAPATA }, { forma: consolo, z: z - BEIRADA }, contato(sapata, 0.26))
  }

  const L = cena.partes
  L.push(P(leito, mad, { tabua: 0, bisel: 1, tom: TOM_DA_TAMPA, metal: VERNIZ, semente: 740 }))
  const x0 = -hw + bochecha
  const x1 = hw - bochecha
  const y0 = yCaixa + RECUO_DAS_TECLAS
  const y1 = yTeclado - FRENTE_DO_LEITO
  L.push(P(caixa(x0, yCaixa + 0.1, x1, y0 + 0.3), FELTRO, { bisel: 0.2, contorno: 0.1, tom: 0.9, semente: 741 }))
  // Oitavas inteiras mais o dó do fim, como num teclado de verdade: quantas couberem com a tecla na largura dela.
  const oitavas = Math.max(1, Math.round(((x1 - x0) / (g * LARGURA_DA_TECLA) - 1) / TECLAS_POR_OITAVA))
  const brancas = oitavas * TECLAS_POR_OITAVA + 1
  const larg = (x1 - x0) / brancas
  L.push(P(caixa(x0, y0, x1, y1, 0.4), MARFIM, { bisel: 0.5, contorno: 0.18, textura: texDasTeclas(x0, larg), semente: 742, projeta: { dist: 0.5, forca: 0.2, suave: 0.5 } }))
  const meiaPreta = (larg * LARGURA_DA_PRETA) / 2
  const fimDaPreta = y0 + (y1 - y0) * COMPRIMENTO_DA_PRETA
  for (let i = 0; i < brancas - 1; i += 1) {
    if (!TEM_PRETA_DEPOIS[i % TECLAS_POR_OITAVA]) continue
    const x = x0 + (i + 1) * larg
    L.push(P(caixa(x - meiaPreta, y0, x + meiaPreta, fimDaPreta, 0.35), EBANO, { bisel: 0.55, contorno: 0.1, metal: 0.22, semente: 743, projeta: { dist: 0.6, forca: 0.26, suave: 0.4 } }))
  }
  for (const lado of [-1, 1]) {
    const xa = lado < 0 ? -hw : hw - bochecha
    L.push(P(caixa(xa, yCaixa - 0.2, xa + bochecha, yTeclado, 1.1), mad, { eixo: QUARTO, tabua: 0, bisel: 1.3, tom: 0.88, metal: VERNIZ, semente: 745 + lado, projeta: { dist: 0.9, forca: 0.26 } }))
  }
}

// ---------- o banquinho ----------

/**
 * As três pernas do banquinho: os ângulos (duas abertas para a frente e uma
 * atrás, que na 3/4 aparece entre as duas), o raio em que ficam e o raio de
 * cada uma, em fração do raio do assento.
 */
const PERNAS_DO_BANQUINHO: readonly number[] = [Math.PI / 6, (5 * Math.PI) / 6, -Math.PI / 2]
const RAIO_DAS_PERNAS = 0.64
const RAIO_DA_PERNA = 0.15

/** O banquinho redondo, encostado na beira da frente: o aro de madeira, a almofada com o botão no meio e as três pernas. */
function montarBanquinho(c: ContextoDoMovel, cena: Cena, yDeCima: number): void {
  const { hh, w, g, peca: P } = c
  const r = Math.min((hh - yDeCima) / 2, w * 0.2)
  const y = hh - r
  const z = g * ALTURA_DO_BANQUINHO
  const assento = elipse(0, y, r, r)
  // A sombra do assento cai solta; a de baixo, firme e logo em volta dele, assenta o banquinho no chão (a da mesa).
  cena.sombras.push({ forma: assento, z, solta: true, forca: 0.24 }, { forma: elipse(0, y, r + 0.8, r + 0.8), z: 0, suave: 1.4, forca: 0.3 })
  const rPerna = r * RAIO_DA_PERNA
  for (const a of PERNAS_DO_BANQUINHO) {
    const perna = elipse(r * RAIO_DAS_PERNAS * Math.cos(a), y + r * RAIO_DAS_PERNAS * Math.sin(a), rPerna, rPerna)
    cena.sombras.push({ forma: perna, z: z - BEIRADA }, contato(perna, 0.3))
  }
  const L = cena.partes
  const estofado = c.m.assento
  L.push(P(assento, c.m.madeira, { tabua: 0, bisel: 1.2, tom: TOM_DA_TAMPA, metal: VERNIZ, contorno: 0.24, semente: 760 }))
  L.push(P(elipse(0, y, r * 0.84, r * 0.84), estofado, { bisel: r * 0.34, ruga: 0.8, contorno: 0.24, semente: 761, projeta: { dist: 0.8, forca: 0.24 } }))
  L.push(P(elipse(0, y, r * 0.26, r * 0.26), estofado, { bisel: 0, tom: 0.9, contorno: 0, recesso: { k: 0.9, forca: 0.26 }, semente: 762 }))
  L.push(P(elipse(0, y, r * 0.1, r * 0.1), estofado, { bisel: r * 0.1, tom: 0.74, contorno: 0.2, semente: 763 }))
}

// ---------- em cima da tampa ----------

/** Onde a emenda da tampa fica, em fração da profundidade da caixa a partir do fundo. */
const EMENDA_DA_TAMPA = 0.3
/** A partitura aberta: as meias medidas das duas páginas juntas (casas), o giro e onde fica (fração da largura a partir do meio). */
const PARTITURA = { meioComprimento: 0.15, meiaLargura: 0.1, giro: -0.1, x: -0.13 }
/** As pautas: de quantas em quantas (px do protótipo), a faixa de cada uma dentro do passo, as margens e as notas. */
const PASSO_DA_PAUTA = 2.8
const FAIXA_DA_PAUTA: readonly [number, number] = [0.32, 0.76]
const MARGEM_DA_PAGINA = 0.9
const CINZA_DA_PAUTA = 0.1
const LARGURA_DA_NOTA = 1
const ESCURO_DA_NOTA = 0.32
/** O castiçal: o raio do pires (casas) e onde fica (fração da largura a partir do meio). */
const CASTICAL = { raio: 0.082, x: 0.3 }

/** Retângulo girado `ang` radianos em volta do meio (cx, cy), de meias medidas `mx` e `my`, deslocado (dx, dy) no eixo dele. */
function girado(cx: number, cy: number, mx: number, my: number, ang: number, dx = 0, dy = 0): Forma {
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  const canto = (x: number, y: number): Ponto => [cx + (x + dx) * co - (y + dy) * si, cy + (x + dx) * si + (y + dy) * co]
  return poligono([canto(-mx, -my), canto(mx, -my), canto(mx, my), canto(-mx, my)])
}

/**
 * O papel pautado: faixas cinzas atravessadas (as pautas) com pontos mais
 * escuros (as notas), nas coordenadas da própria partitura, girada `ang` em
 * volta de (cx, cy). As margens de fora e a dobra do meio ficam em branco.
 */
function texDaPartitura(cx: number, cy: number, ang: number, mx: number, my: number): Textura {
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  return (_u, _v, x, y, _p, s) => {
    const lx = (x - cx) * co + (y - cy) * si
    const ly = -(x - cx) * si + (y - cy) * co
    const ax = Math.abs(lx)
    if (ax < MARGEM_DA_PAGINA || ax > mx - MARGEM_DA_PAGINA) return
    const passo = (ly + my) / PASSO_DA_PAUTA
    const pauta = Math.floor(passo)
    const dentro = passo - pauta
    if (dentro < FAIXA_DA_PAUTA[0] || dentro > FAIXA_DA_PAUTA[1]) return
    s[3] -= CINZA_DA_PAUTA
    if (hash(Math.floor(lx / LARGURA_DA_NOTA), pauta, 955) > 0.55) s[3] -= ESCURO_DA_NOTA
  }
}

/** A partitura aberta em cima da tampa: a capa na beira e as duas páginas pautadas, com a dobra no meio. */
function partitura(L: Peca[], P: CriarPeca, cx: number, cy: number, mx: number, my: number): void {
  const ang = PARTITURA.giro
  L.push(P(girado(cx, cy, mx + 0.45, my + 0.4, ang, 0.25, 0.3), CAPA_DA_PARTITURA, { bisel: 0.3, contorno: 0.22, semente: 770, projeta: { dist: 1, forca: 0.28 } }))
  const pautas = texDaPartitura(cx, cy, ang, mx, my)
  // Cada página tem o chanfro dela: as duas beiras que se encontram no meio fazem a dobra.
  for (const lado of [-1, 1]) L.push(P(girado(cx, cy, mx / 2, my, ang, (lado * mx) / 2), PAPEL, { bisel: 0.8, contorno: 0.16, textura: pautas, semente: 772 + lado }))
}

/**
 * O castiçal de mão: a argola de pegar, o pires de latão, a cera que escorreu
 * e empoçou nele, a vela apagada (o toco, com a cova derretida no alto) e o
 * pavio preto. É o do altar (`altar.ts`) com a argola.
 */
function castical(L: Peca[], P: CriarPeca, x: number, y: number, r: number): void {
  L.push(P(anel(x + r * 1.05, y + r * 0.35, r * 0.5, r * 0.5, r * 0.28, r * 0.28), LATAO, { bisel: r * 0.11, contorno: 0.26, tom: 0.92, semente: 779, projeta: { dist: 0.8, forca: 0.28 } }))
  L.push(P(elipse(x, y, r, r), LATAO, { bisel: r * 0.3, contorno: 0.3, semente: 780, projeta: { dist: 1.4, forca: 0.32 } }))
  L.push(P(elipse(x, y, r * 0.78, r * 0.78), LATAO, { bisel: 0, tom: 0.8, contorno: 0.1, recesso: { k: 1.1, forca: 0.34 }, semente: 781 }))
  L.push(P(elipse(x - r * 0.3, y + r * 0.26, r * 0.42, r * 0.36), CERA, { bisel: r * 0.14, tom: 0.9, contorno: 0.14, semente: 782 }))
  L.push(P(elipse(x, y, r * 0.5, r * 0.5), CERA, { bisel: r * 0.2, contorno: 0.24, semente: 783, projeta: { dist: 0.9, forca: 0.3, suave: 0.6 } }))
  L.push(P(elipse(x, y, r * 0.29, r * 0.29), CERA, { bisel: 0, tom: 0.9, contorno: 0, recesso: { k: 0.6, forca: 0.26 }, semente: 784 }))
  L.push(P(elipse(x, y, r * 0.11, r * 0.11), BURACO, { bisel: 0, contorno: 0, semente: 785 }))
}

export const montarPiano: MontarMovel = (c, cena) => {
  const { hw, hh, w, h, g, peca: P } = c
  const mad = c.m.madeira
  const H = g * ALTURA
  const fundoDaCaixa = h * FUNDO_DA_CAIXA
  const fundoDoTeclado = h * FUNDO_DO_TECLADO
  const yCaixa = -hh + fundoDaCaixa
  const yTeclado = yCaixa + fundoDoTeclado
  const { faixas, frente } = fatiar(H, g * PE_DA_FRENTE, fundoDaCaixa, yCaixa)
  const L = cena.partes

  // De baixo para cima: o banquinho e o teclado primeiro, para a tampa, lá em cima, fazer sombra no fundo das teclas.
  montarBanquinho(c, cena, yTeclado + h * VAO_DO_BANQUINHO)
  montarTeclado(c, cena, yCaixa, yTeclado)

  // A caixa dá a sombra e a frente lisa; as cantoneiras fecham as frestas dos dois lados.
  cena.sombras.push({ forma: caixa(-hw, -hh, hw, frente, 1), z: H }, contato(caixa(-hw, -hh, hw, yCaixa, 1)))
  for (const xa of [-hw, hw - CANTONEIRA]) cena.sombras.push({ forma: caixa(xa, frente, xa + CANTONEIRA, yCaixa), z: H })
  // A fresta de cada faixa não faz sombra no chão: só diz à 3/4 a altura da faixa.
  for (const fx of faixas) cena.sombras.push({ forma: caixa(-hw + CANTONEIRA, fx.base, hw - CANTONEIRA, fx.base + FRESTA), z: fx.z, solta: true, forca: 0 })

  // As faixas da frente, guardadas debaixo da tampa, e a tampa por cima delas.
  const desenho = desenharFrente(hw, g, fundoDoTeclado, mad)
  for (const fx of faixas) {
    for (const peca of desenho) {
      const copia = naFaixa(P, peca, fx)
      if (copia !== null) L.push(copia)
    }
  }
  L.push(P(caixa(-hw, -hh, hw, yCaixa, 1.1), mad, { tabua: 0, bisel: 1.7, tom: TOM_DA_TAMPA, metal: VERNIZ, semente: 700, projeta: { dist: 2.2, forca: 0.3, suave: 1.1 } }))

  // A emenda da tampa (a parte da frente levanta) com as duas dobradiças de latão.
  const yEmenda = -hh + fundoDaCaixa * EMENDA_DA_TAMPA
  L.push(P(caixa(-hw + 1.4, yEmenda - 0.3, hw - 1.4, yEmenda + 0.3), mad, { tabua: 0, bisel: 0, contorno: 0, tom: 0.5, semente: 701 }))
  for (const lado of [-1, 1]) {
    const x = lado * w * 0.4
    L.push(P(capsula(x - 1.7, yEmenda, x + 1.7, yEmenda, 0.75), LATAO, { bisel: 0.6, contorno: 0.2, tom: 0.92, semente: 703 + lado }))
  }

  // A partitura aberta e o castiçal apagado: do tamanho deles em casas, até onde a tampa deixa.
  const yMeio = (-hh + yCaixa) / 2
  const meiaPagina = Math.min(g * PARTITURA.meiaLargura, fundoDaCaixa * 0.4)
  partitura(L, P, w * PARTITURA.x, yMeio + 0.8, (meiaPagina * PARTITURA.meioComprimento) / PARTITURA.meiaLargura, meiaPagina)
  castical(L, P, w * CASTICAL.x, yMeio + 1, Math.min(g * CASTICAL.raio, fundoDaCaixa * 0.3))
}
