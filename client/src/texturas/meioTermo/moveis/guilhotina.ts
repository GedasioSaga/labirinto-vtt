/**
 * GUILHOTINA (lote L03 de 24/11/2026, Tortura e fogo; desenho ORIGINAL, só a
 * ideia do objeto dos mapas de referência), vista do lado em que a cabeça cai:
 * as duas COLUNAS altas com a TRAVE no alto, a LÂMINA de aço de fio INCLINADO
 * presa ao CEPO DE PESO (o carneiro), suspensa lá em cima pela corda que passa
 * na roldana e desce até o cunho da coluna da direita; embaixo, a LUNETA (as
 * duas tábuas com a MEIA-LUA de cada uma fechando o furo do pescoço), a ponta
 * da prancha atrás dela e, na frente, o CESTO de vime. Tudo num estrado baixo,
 * com duas mãos-francesas escorando as colunas.
 *
 * VAZIA e limpa: sem corpo. A única marca é uma sombra de vinho velho, quase
 * apagada, na tábua de baixo da luneta (regra da lista: vinho velho, nunca
 * vermelho vivo).
 *
 * Figura em pé, desenhada de frente nas duas vistas, como a armadura e a
 * estátua de cavalo: de cima e na 3/4 é a mesma imagem, e a 3/4 só põe a
 * sombra de baixo (`EM_PE` em `tresQuartos.ts`); o quarto de volta deita a
 * figura. Desenho em px de uma pegada de 1 x 2 casas (56 x 112, y cresce para
 * baixo, o chão embaixo).
 *
 * A 25% de zoom sobram as duas colunas finas, o trapézio claro da lâmina no
 * alto entre elas e o cesto no pé: é o que diz "guilhotina", e não forca
 * (um poste e um braço), portão ou tear. Materiais: `madeira` e `ferragens`.
 * O aço da lâmina, a corda, o vime e o vinho são fixos.
 */
import type { Rgb } from '../../ruido'
import { anel, barra, cadeia, caixa, capsula, elipse, menos, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, type MaterialDaPeca, type OpcoesDaPeca } from './motor'
import { G, QUARTO, materialDaPeca, type MontarMovel } from './contexto'

/** A pegada em que o desenho foi medido (px do protótipo): 1 x 2 casas. */
const LARGURA = G
const ALTURA = 2 * G

/** O estrado: a meia largura da frente e a do fundo, o fundo do tampo, a quina da frente e o chão. */
const ESTRADO = { meia: 26.5, meiaDoFundo: 24, fundo: 39.5, topo: 44, pe: 50.5 }
/** As colunas: o x do meio, a meia largura, o alto e o pé (no tampo do estrado). */
const COLUNA = { x: 13.6, meia: 2.5, topo: -49, pe: 41.5 }
/** A trave do alto: a meia largura, o alto e o pé. */
const TRAVE = { meia: 19, topo: -54.5, pe: -48 }
/** O carneiro (o cepo de peso) e a lâmina debaixo dele: a meia largura entre as colunas e os y. */
const CARNEIRO = { meia: 10.8, topo: -43, pe: -36.5 }
const LAMINA = { peDoLadoAlto: -29, peDoLadoBaixo: -21 }
/** A luneta: a meia largura, o alto, o corte entre as duas tábuas, o pé e o raio do furo. */
const LUNETA = { meia: 10.8, topo: 11, corte: 21, pe: 31, furo: 5 }
/** A prancha atrás da luneta, vista de topo. */
const PRANCHA = { meia: 8.4, topo: 31, pe: 40.5 }
/** As mãos-francesas: da coluna (y) até a ponta do estrado. */
const ESCORA = { alto: 16, largura: 3 }
/** O cesto de vime na frente: o meio, os raios da boca e o pé. */
const CESTO = { x: -1, boca: 37.5, rx: 9.4, ry: 3.3, pe: 52.5, meiaDoPe: 7.4 }
/** O cunho da corda, na coluna da direita. */
const CUNHO_Y = 6

/** A altura das colunas para a sombra no chão (px). */
const ALTURA_DA_SOMBRA = 78
const FORCA_DA_SOMBRA = 0.24

const TOM_DE_FRENTE = 0.74
const TOM_DA_ESCORA = 0.8
const TOM_DO_REBITE = 1.32
const BRILHO_DO_FERRO = 0.34
const ESCURO_DA_MADEIRA: Rgb = [0x4f, 0x3b, 0x2c]

const CORDA = materialDaPeca('corda')
/** O vime do cesto: a palha trançada, mais escura e parda que a do chapéu. */
const VIME: MaterialDaPeca = { classe: 'palha', rgb: [0x98, 0x80, 0x58] }
/** O aço da lâmina (mais claro que o ferro das ferragens) e o fio amolado. */
const ACO: MaterialDaPeca = { classe: 'metal', rgb: [0x8f, 0x94, 0x98] }
const FIO: MaterialDaPeca = { classe: 'liso', rgb: [0xcd, 0xd0, 0xcf] }
/** O escuro do furo, do vão das corrediças e de dentro do cesto. */
const VAO: MaterialDaPeca = { classe: 'liso', rgb: [0x35, 0x2b, 0x26] }
/** O vinho velho, quase apagado. */
const VINHO: MaterialDaPeca = { classe: 'liso', rgb: [0x5e, 0x36, 0x36] }

export const montarGuilhotina: MontarMovel = (c, cena) => {
  const e = Math.min(c.w / LARGURA, c.h / ALTURA)
  const na = (f: Forma): Forma => (e === 1 ? f : { b: [f.b[0] * e, f.b[1] * e, f.b[2] * e, f.b[3] * e], d: (x, y) => f.d(x / e, y / e) * e })
  const por = (f: Forma, mat: MaterialDaPeca, o: OpcoesDaPeca): void => {
    cena.partes.push(c.peca(na(f), mat, { ...o, bisel: (o.bisel ?? 1) * e, suave: (o.suave ?? 0) * e }))
  }
  const madeira = c.m.madeira
  const ferro = c.m.ferragens
  const daMadeira = (semente: number, mais: OpcoesDaPeca = {}): OpcoesDaPeca => ({ tabua: 0, bisel: 1, contorno: 0.3, semente, ...mais })
  const doFerro = (semente: number, mais: OpcoesDaPeca = {}): OpcoesDaPeca => ({ tabua: 0, bisel: 0.7, contorno: 0.3, metal: BRILHO_DO_FERRO, semente, ...mais })
  const sombraMiuda = { dist: 0.9 * e, forca: 0.3 }
  cena.corDoPiso = ESCURO_DA_MADEIRA

  // ---------- as sombras: o estrado e o cesto no chão; cada coluna e a trave, caindo compridas para baixo à direita ----------
  const frenteDoEstrado = caixa(-ESTRADO.meia, ESTRADO.topo, ESTRADO.meia, ESTRADO.pe, 0.8)
  cena.sombras.push(contato(na(uniao(frenteDoEstrado, caixa(-ESTRADO.meiaDoFundo, ESTRADO.fundo, ESTRADO.meiaDoFundo, ESTRADO.topo))), 0.34))
  cena.sombras.push({ forma: na(caixa(-ESTRADO.meia, ESTRADO.topo, ESTRADO.meia, ESTRADO.pe, 1)), z: (ESTRADO.pe - ESTRADO.fundo) * e, forca: 0.26 })
  for (const lado of [-1, 1]) {
    cena.sombras.push({ forma: na(caixa(lado * COLUNA.x - COLUNA.meia, ESTRADO.topo + 1, lado * COLUNA.x + COLUNA.meia, ESTRADO.pe - 2, 0.8)), z: ALTURA_DA_SOMBRA * e, forca: FORCA_DA_SOMBRA })
  }
  cena.sombras.push({ forma: na(caixa(-TRAVE.meia, ESTRADO.topo + 1, TRAVE.meia, ESTRADO.pe - 2, 1)), z: ALTURA_DA_SOMBRA * e, solta: true, forca: 0.2 })
  cena.sombras.push(contato(na(caixa(CESTO.x - CESTO.meiaDoPe, CESTO.pe - 2, CESTO.x + CESTO.meiaDoPe, CESTO.pe, 1)), 0.32))

  // ---------- o estrado (a frente e o tampo) e as mãos-francesas ----------
  por(frenteDoEstrado, madeira, daMadeira(24601, { tabua: 6.5, eixo: QUARTO, tom: TOM_DE_FRENTE }))
  por(poligono([[-ESTRADO.meiaDoFundo, ESTRADO.fundo], [ESTRADO.meiaDoFundo, ESTRADO.fundo], [ESTRADO.meia, ESTRADO.topo], [-ESTRADO.meia, ESTRADO.topo]]), madeira, daMadeira(24602, { tabua: 7, eixo: QUARTO, tom: 1, bisel: 0.5 }))
  for (const lado of [-1, 1]) {
    por(barra(lado * (COLUNA.x + COLUNA.meia - 0.4), ESCORA.alto, lado * (ESTRADO.meiaDoFundo - 1.6), ESTRADO.fundo + 2, ESCORA.largura), madeira, daMadeira(24603 + lado, { eixo: QUARTO, tom: TOM_DA_ESCORA }))
  }

  // ---------- a prancha atrás da luneta (de topo) e a luneta com o furo ----------
  por(caixa(-PRANCHA.meia, PRANCHA.topo, PRANCHA.meia, PRANCHA.pe, 0.6), madeira, daMadeira(24610, { tom: 0.68, polar: { cx: 0, cy: 60, r: 30 } }))
  const furo = elipse(0, LUNETA.corte, LUNETA.furo, LUNETA.furo)
  const luneta = caixa(-LUNETA.meia, LUNETA.topo, LUNETA.meia, LUNETA.pe, 0.5)
  por(furo, VAO, { bisel: 0, contorno: 0, semente: 24611 })
  por(menos(luneta, furo), madeira, daMadeira(24612, { bisel: 1.1, tom: 0.98, projeta: { dist: 1.3 * e, forca: 0.3 } }))
  // O corte entre as duas tábuas, a beira gasta do furo e a sombra de vinho velho debaixo dele.
  por(uniao(capsula(-LUNETA.meia + 0.8, LUNETA.corte, -LUNETA.furo - 0.4, LUNETA.corte, 0.3), capsula(LUNETA.furo + 0.4, LUNETA.corte, LUNETA.meia - 0.8, LUNETA.corte, 0.3)), VAO, { bisel: 0, contorno: 0, alfa: 0.55, semente: 24613 })
  por(menos(elipse(0, LUNETA.corte + 3.6, 5.4, 6.6), elipse(0, LUNETA.corte, LUNETA.furo, LUNETA.furo)), VINHO, { bisel: 0, contorno: 0, alfa: 0.26, suave: 1.6, semente: 24614 })
  // O trinco de ferro que fecha a tábua de cima.
  por(caixa(LUNETA.meia - 4.4, LUNETA.corte - 3.4, LUNETA.meia - 1.6, LUNETA.corte + 3.4, 0.5), ferro, doFerro(24615, { projeta: sombraMiuda }))
  por(elipse(LUNETA.meia - 3, LUNETA.corte - 2, 0.7, 0.7), ferro, doFerro(24616, { bisel: 0.6, tom: TOM_DO_REBITE, contorno: 0.2 }))

  // ---------- a lâmina e o carneiro, suspensos entre as colunas ----------
  const lamina = poligono([[-CARNEIRO.meia + 0.6, CARNEIRO.pe - 0.6], [CARNEIRO.meia - 0.6, CARNEIRO.pe - 0.6], [CARNEIRO.meia - 0.6, LAMINA.peDoLadoAlto], [-CARNEIRO.meia + 0.6, LAMINA.peDoLadoBaixo]])
  por(lamina, ACO, { tabua: 0, eixo: QUARTO, bisel: 0.6, contorno: 0.26, metal: 0.5, tom: 0.98, semente: 24620, projeta: { dist: 1.4 * e, forca: 0.26 } })
  por(barra(-CARNEIRO.meia + 0.9, LAMINA.peDoLadoBaixo - 1, CARNEIRO.meia - 0.9, LAMINA.peDoLadoAlto - 1, 1.5), FIO, { bisel: 0, contorno: 0, alfa: 0.85, semente: 24621 })
  por(caixa(-CARNEIRO.meia, CARNEIRO.topo, CARNEIRO.meia, CARNEIRO.pe, 0.8), madeira, daMadeira(24622, { bisel: 1.2, tom: 0.78, projeta: sombraMiuda }))
  for (const x of [-7, 0, 7]) por(elipse(x, CARNEIRO.pe - 1.6, 0.85, 0.85), ferro, doFerro(24623 + x, { bisel: 0.8, tom: TOM_DO_REBITE, metal: 0.5, contorno: 0.2 }))
  por(anel(0, CARNEIRO.topo - 1.2, 1.9, 1.9, 0.9, 0.9), ferro, doFerro(24627, { bisel: 0.5 }))

  // ---------- as colunas (com a corrediça escura por dentro) e a trave com a roldana ----------
  for (const lado of [-1, 1]) {
    const x = lado * COLUNA.x
    por(caixa(x - COLUNA.meia, COLUNA.topo, x + COLUNA.meia, COLUNA.pe, 0.6), madeira, daMadeira(24630 + lado, { eixo: QUARTO, bisel: 1.1, tom: 1.02, projeta: { dist: 1.2 * e, forca: 0.26 } }))
    por(capsula(x - lado * (COLUNA.meia - 0.7), COLUNA.topo + 3, x - lado * (COLUNA.meia - 0.7), LUNETA.topo - 2, 0.32), VAO, { bisel: 0, contorno: 0, alfa: 0.5, semente: 24633 + lado })
  }
  por(caixa(-TRAVE.meia, TRAVE.topo, TRAVE.meia, TRAVE.pe, 0.8), madeira, daMadeira(24640, { bisel: 1.3, tom: 0.96, projeta: { dist: 1.4 * e, forca: 0.3 } }))
  for (const lado of [-1, 1]) por(elipse(lado * COLUNA.x, (TRAVE.topo + TRAVE.pe) / 2, 0.95, 0.95), ferro, doFerro(24641 + lado, { bisel: 0.8, tom: TOM_DO_REBITE, metal: 0.5, contorno: 0.2 }))

  // ---------- a corda: da argola do carneiro à roldana, por cima da trave e descendo a coluna da direita até o cunho ----------
  const descida = COLUNA.x + COLUNA.meia + 1.6
  const corda: readonly Ponto[] = [[0, CARNEIRO.topo - 2.4], [0, TRAVE.pe - 0.4]]
  const volta: readonly Ponto[] = [[1.2, TRAVE.topo + 0.4], [descida - 3, TRAVE.topo - 1], [descida, TRAVE.topo + 2.4], [descida + 0.2, -20], [descida - 0.6, CUNHO_Y - 1]]
  por(cadeia(corda, 0.8), CORDA, { tabua: 0, eixo: QUARTO, bisel: 0.8, contorno: 0.3, semente: 24650 })
  por(cadeia(volta, 0.8), CORDA, { tabua: 0, eixo: QUARTO, bisel: 0.8, contorno: 0.3, semente: 24651, projeta: sombraMiuda })
  por(elipse(0, TRAVE.pe - 0.2, 2.1, 2.1), ferro, doFerro(24652, { bisel: 1.2, tom: 1.05, projeta: sombraMiuda }))
  // O cunho: a barra de ferro com as voltas da corda e a ponta solta.
  por(capsula(descida - 2.6, CUNHO_Y, descida + 1.8, CUNHO_Y, 0.9), ferro, doFerro(24653, { bisel: 0.8, projeta: sombraMiuda }))
  por(caixa(descida - 1.5, CUNHO_Y - 1.5, descida + 0.6, CUNHO_Y + 1.5, 0.7), CORDA, { tabua: 0, bisel: 0.8, contorno: 0.3, tom: 1.03, semente: 24654 })
  por(cadeia([[descida - 0.4, CUNHO_Y + 1.2], [descida + 0.9, CUNHO_Y + 5.5], [descida + 0.3, CUNHO_Y + 10]], 0.7), CORDA, { tabua: 0, eixo: QUARTO, bisel: 0.7, contorno: 0.3, tom: 0.95, semente: 24655, projeta: sombraMiuda })

  // ---------- o cesto de vime na frente: o corpo trançado, a boca escura e a borda ----------
  const corpoDoCesto = poligono([[CESTO.x - CESTO.rx, CESTO.boca], [CESTO.x + CESTO.rx, CESTO.boca], [CESTO.x + CESTO.meiaDoPe, CESTO.pe], [CESTO.x - CESTO.meiaDoPe, CESTO.pe]])
  por(uniao(corpoDoCesto, elipse(CESTO.x, CESTO.pe - 0.6, CESTO.meiaDoPe, 1.8)), VIME, { bisel: 2.2, contorno: 0.3, tom: 0.9, semente: 24660 })
  por(elipse(CESTO.x, CESTO.boca, CESTO.rx - 1.3, CESTO.ry - 1.1), VAO, { bisel: 0, contorno: 0, semente: 24661 })
  por(anel(CESTO.x, CESTO.boca, CESTO.rx, CESTO.ry, CESTO.rx - 1.6, CESTO.ry - 1.3), VIME, { bisel: 0.8, contorno: 0.3, tom: 1.06, semente: 24662, projeta: sombraMiuda })
}
