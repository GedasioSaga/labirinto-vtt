/**
 * PRANCHA DE TORTURA (lote L03 de 24/11/2026, Tortura e fogo; desenho
 * ORIGINAL, só a ideia da tábua de amarrar dos mapas de referência): a TÁBUA
 * alta, em pé, onde o preso é amarrado de braços abertos. VAZIA: o mestre põe
 * o token em cima. Três pranchas grossas de pé, de quinas cortadas no alto,
 * abraçadas por duas CINTAS de ferro rebitadas; nos quatro cantos uma ARGOLA
 * num grampo, e de cada uma pende a CORDA solta (as dos pulsos balançam, as
 * dos tornozelos caem até o chão). No meio, a CINTA DE COURO da cintura,
 * frouxa, com a fivela de latão e a ponta pendendo. A tábua assenta numa VIGA
 * deitada com dois pés atravessados e é escorada por duas MÃOS-FRANCESAS.
 *
 * Quem conta a história é a madeira: o miolo da tábua está GASTO e mais claro
 * onde as costas encostam. Nada de gente, de sangue ou de mancha escura.
 *
 * Figura em pé, desenhada de frente nas duas vistas, como a armadura e a
 * estátua de cavalo: de cima e na 3/4 é a mesma imagem, e a 3/4 só põe a
 * sombra de baixo (`EM_PE` em `tresQuartos.ts`); o quarto de volta deita a
 * figura, como nos outros em pé. Desenho em px de uma pegada de 1 x 2 casas
 * (56 x 112, y cresce para baixo, o chão embaixo).
 *
 * A 25% de zoom sobram a tábua clara e alta, as duas cintas escuras de través
 * e o triângulo das escoras no pé: é o que diz "prancha de amarrar", e não
 * porta, mesa em pé ou lápide. Materiais: `madeira` e `ferragens`. A corda e o
 * couro são fixos.
 */
import type { Rgb } from '../../ruido'
import { anel, barra, cadeia, caixa, capsula, elipse, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, type MaterialDaPeca, type OpcoesDaPeca } from './motor'
import { G, QUARTO, materialDaPeca, type MontarMovel } from './contexto'

/** A pegada em que o desenho foi medido (px do protótipo): 1 x 2 casas. */
const LARGURA = G
const ALTURA = 2 * G

/** A tábua: a meia largura, o alto, o pé (onde assenta na viga) e o corte das quinas de cima. */
const TABUA = { meia: 13.5, topo: -52, pe: 44.5, quina: 4 }
/** As três pranchas de pé (px de cada uma). */
const PRANCHA = 9
/** As cintas de ferro (o y do meio de cada uma), a meia altura e quanto passam da beira da tábua. */
const CINTAS: readonly number[] = [-33, 27]
const MEIA_CINTA = 1.9
const SOBRA_DA_CINTA = 1.2
/** A viga do pé: a meia largura, o alto do tampo, a quina da frente e o chão. */
const VIGA = { meia: 23, fundo: 42, topo: 45, pe: 51 }
/** Os pés atravessados (o x do meio), vistos de topo. */
const PES: readonly number[] = [-18.5, 18.5]
/** As mãos-francesas: da beira da tábua (y) até a ponta da viga. */
const ESCORA = { alto: 12, largura: 3.6 }
/** As argolas: o x e o y do grampo de cada uma (pulsos em cima, tornozelos embaixo) e os raios. */
const ARGOLAS: readonly Ponto[] = [[-9.4, -42.5], [9.4, -42.5], [-7.4, 33], [7.4, 33]]
const ARGOLA = { fora: 3, dentro: 1.75 }
const RAIO_DA_CORDA = 0.95
/** A cinta de couro da cintura: o y dos grampos, a largura, o quanto cede no meio e o x da fivela. */
const CINTURA = { y: 1, largura: 3.6, cede: 7, fivela: 4.5 }
/** O miolo gasto: o meio, os raios e o quanto clareia. */
const GASTO = { y: -6, rx: 7.5, ry: 27, alfa: 0.3 }

/** A altura da tábua para a sombra no chão (px): ela cai para baixo à direita, comprida. */
const ALTURA_DA_SOMBRA = 64
const FORCA_DA_SOMBRA = 0.24

const TOM_DA_VIGA_DE_FRENTE = 0.74
const TOM_DA_ESCORA = 0.8
const TOM_DO_REBITE = 1.32
const BRILHO_DO_FERRO = 0.34
const ESCURO_DA_MADEIRA: Rgb = [0x4f, 0x3b, 0x2c]

const CORDA = materialDaPeca('corda')
/** O couro da cinta e o latão da fivela. */
const COURO: MaterialDaPeca = { classe: 'liso', rgb: [0x5a, 0x43, 0x31] }
const LATAO: MaterialDaPeca = { classe: 'metal', rgb: [0xa8, 0x8a, 0x58] }

/** A curva de três pontos (Bézier de segundo grau) em `n` trechos: a corda solta não faz quina. */
function curva(a: Ponto, b: Ponto, c: Ponto, n: number): Ponto[] {
  const pontos: Ponto[] = []
  for (let i = 0; i <= n; i += 1) {
    const t = i / n
    const u = 1 - t
    pontos.push([u * u * a[0] + 2 * u * t * b[0] + t * t * c[0], u * u * a[1] + 2 * u * t * b[1] + t * t * c[1]])
  }
  return pontos
}

export const montarPranchaDeTortura: MontarMovel = (c, cena) => {
  const e = Math.min(c.w / LARGURA, c.h / ALTURA)
  const na = (f: Forma): Forma => (e === 1 ? f : { b: [f.b[0] * e, f.b[1] * e, f.b[2] * e, f.b[3] * e], d: (x, y) => f.d(x / e, y / e) * e })
  const por = (f: Forma, mat: MaterialDaPeca, o: OpcoesDaPeca): void => {
    cena.partes.push(c.peca(na(f), mat, { ...o, bisel: (o.bisel ?? 1) * e }))
  }
  const madeira = c.m.madeira
  const ferro = c.m.ferragens
  const daMadeira = (semente: number, mais: OpcoesDaPeca = {}): OpcoesDaPeca => ({ bisel: 1, contorno: 0.3, semente, ...mais })
  const doFerro = (semente: number, mais: OpcoesDaPeca = {}): OpcoesDaPeca => ({ tabua: 0, bisel: 0.7, contorno: 0.3, metal: BRILHO_DO_FERRO, semente, ...mais })
  const sombraMiuda = { dist: 0.9 * e, forca: 0.3 }
  cena.corDoPiso = ESCURO_DA_MADEIRA

  // ---------- as sombras: o pé no chão e a tábua alta, caindo comprida para baixo à direita ----------
  const pe = uniao(caixa(-VIGA.meia, VIGA.fundo, VIGA.meia, VIGA.pe, 0.8), uniao(caixa(PES[0] - 3.6, 48.5, PES[0] + 3.6, 53.5, 1), caixa(PES[1] - 3.6, 48.5, PES[1] + 3.6, 53.5, 1)))
  cena.sombras.push(contato(na(pe), 0.34))
  cena.sombras.push({ forma: na(caixa(-TABUA.meia, VIGA.topo, TABUA.meia, VIGA.pe - 1, 1)), z: ALTURA_DA_SOMBRA * e, forca: FORCA_DA_SOMBRA })

  // ---------- o pé: os dois pés de topo, as mãos-francesas, a viga (a frente e o tampo) ----------
  PES.forEach((x, i) => {
    por(caixa(x - 3.6, 48.5, x + 3.6, 53.5, 1), madeira, daMadeira(24201 + i, { tabua: 0, tom: 0.66, polar: { cx: x, cy: 51, r: 3 } }))
  })
  for (const lado of [-1, 1]) {
    por(barra(lado * (TABUA.meia - 0.6), ESCORA.alto, lado * (VIGA.meia - 3.4), VIGA.topo, ESCORA.largura), madeira, daMadeira(24205 + lado, { tabua: 0, eixo: QUARTO, tom: TOM_DA_ESCORA }))
  }
  por(caixa(-VIGA.meia, VIGA.topo, VIGA.meia, VIGA.pe, 0.8), madeira, daMadeira(24210, { tabua: 0, tom: TOM_DA_VIGA_DE_FRENTE }))
  por(poligono([[-VIGA.meia + 1.6, VIGA.fundo], [VIGA.meia - 1.6, VIGA.fundo], [VIGA.meia, VIGA.topo], [-VIGA.meia, VIGA.topo]]), madeira, daMadeira(24211, { tabua: 0, tom: 1, bisel: 0.5 }))

  // ---------- a tábua: três pranchas de pé, as quinas cortadas, o miolo gasto ----------
  const tabua = poligono([
    [-TABUA.meia, TABUA.topo + TABUA.quina], [-TABUA.meia + TABUA.quina, TABUA.topo], [TABUA.meia - TABUA.quina, TABUA.topo],
    [TABUA.meia, TABUA.topo + TABUA.quina], [TABUA.meia, TABUA.pe], [-TABUA.meia, TABUA.pe],
  ])
  por(tabua, madeira, daMadeira(24220, { eixo: QUARTO, tabua: PRANCHA, bisel: 1.3, projeta: { dist: 1.6 * e, forca: 0.3 } }))
  const claro: MaterialDaPeca = { classe: 'liso', rgb: [Math.min(255, madeira.rgb[0] * 1.3 + 16), Math.min(255, madeira.rgb[1] * 1.3 + 14), Math.min(255, madeira.rgb[2] * 1.3 + 10)] }
  por(elipse(0, GASTO.y, GASTO.rx, GASTO.ry), claro, { bisel: 0, contorno: 0, alfa: GASTO.alfa, suave: 5 * e, semente: 24221 })

  // ---------- as cintas de ferro, de través, com os rebites ----------
  CINTAS.forEach((y, i) => {
    por(caixa(-TABUA.meia - SOBRA_DA_CINTA, y - MEIA_CINTA, TABUA.meia + SOBRA_DA_CINTA, y + MEIA_CINTA, 0.5), ferro, doFerro(24230 + i, { tom: 0.92, projeta: sombraMiuda }))
    for (const x of [-PRANCHA, 0, PRANCHA]) {
      por(elipse(x, y, 0.95, 0.95), ferro, doFerro(24234 + i * 3 + x, { bisel: 0.9, tom: TOM_DO_REBITE, metal: 0.5, contorno: 0.2 }))
    }
  })

  // ---------- a cinta de couro da cintura: presa nas duas beiras, frouxa (cede no meio), com a fivela e a ponta pendendo ----------
  const cinta = cadeia(curva([-TABUA.meia + 1.4, CINTURA.y], [0, CINTURA.y + CINTURA.cede], [TABUA.meia - 1.4, CINTURA.y], 10), CINTURA.largura / 2)
  por(cinta, COURO, { tabua: 0, bisel: 0.8, contorno: 0.32, semente: 24240, projeta: { dist: 1.2 * e, forca: 0.32 } })
  // Onde a fivela cai na curva da cinta (a mesma conta da `curva`: t pelo x).
  const t = (CINTURA.fivela + TABUA.meia - 1.4) / (2 * (TABUA.meia - 1.4))
  const naCinta: Ponto = [CINTURA.fivela, CINTURA.y + 2 * t * (1 - t) * CINTURA.cede]
  por(barra(naCinta[0] + 1.2, naCinta[1] + 0.6, naCinta[0] + 3.4, naCinta[1] + 9.5, CINTURA.largura * 0.7), COURO, { tabua: 0, bisel: 0.6, contorno: 0.32, tom: 0.9, semente: 24241, projeta: sombraMiuda })
  const fivela = uniao(anel(naCinta[0], naCinta[1], 2.7, 2.7, 1.4, 1.4), capsula(naCinta[0] - 1.7, naCinta[1], naCinta[0] + 1.7, naCinta[1], 0.4))
  por(fivela, LATAO, { tabua: 0, bisel: 0.7, contorno: 0.3, metal: 0.5, semente: 24246, projeta: sombraMiuda })
  for (const lado of [-1, 1]) {
    por(caixa(lado * (TABUA.meia - 1.4) - 1.6, CINTURA.y - 2, lado * (TABUA.meia - 1.4) + 1.6, CINTURA.y + 2, 0.5), ferro, doFerro(24242 + lado, { tom: 1.05, projeta: sombraMiuda }))
  }

  // ---------- as argolas nos grampos e as cordas soltas ----------
  ARGOLAS.forEach(([x, y], i) => {
    const pulso = y < 0
    const para = x < 0 ? -1 : 1
    const fundoDaArgola = y + 2.2 + ARGOLA.fora
    // A corda dos pulsos pende e balança um pouco para fora; a dos tornozelos cai até o chão e deita na frente da viga.
    const caminho = pulso
      ? curva([x, fundoDaArgola - 1.2], [x + para * 0.4, fundoDaArgola + 7], [x + para * 2.4, fundoDaArgola + 15.5], 6)
      : [...curva([x, fundoDaArgola - 1.2], [x + para * 0.6, VIGA.topo + 1], [x + para * 2.2, VIGA.pe + 0.6], 5), ...curva([x + para * 2.2, VIGA.pe + 0.6], [x + para * 3.6, 55], [x + para * 9, 54], 5).slice(1)]
    por(cadeia(caminho, RAIO_DA_CORDA), CORDA, { tabua: 0, eixo: QUARTO, bisel: RAIO_DA_CORDA, contorno: 0.3, tom: pulso ? 1 : 0.96, semente: 24250 + i, projeta: sombraMiuda })
    if (pulso) {
      // A ponta desfiada: dois fios curtos abrindo.
      const [fx, fy] = caminho[caminho.length - 1]
      for (const abre of [-1, 1]) por(capsula(fx, fy, fx + abre * 1.1, fy + 2.4, 0.45), CORDA, { tabua: 0, bisel: 0.4, contorno: 0.26, tom: 0.92, semente: 24256 + i * 2 + abre })
    }
    // O nó da corda na argola.
    por(elipse(x, fundoDaArgola - 0.6, 1.5, 1.3), CORDA, { tabua: 0, bisel: 1.1, contorno: 0.3, tom: 1.03, semente: 24262 + i, projeta: sombraMiuda })
    por(anel(x, y + 2.2, ARGOLA.fora, ARGOLA.fora, ARGOLA.dentro, ARGOLA.dentro), ferro, doFerro(24266 + i, { bisel: 0.65, metal: 0.42, projeta: sombraMiuda }))
    por(caixa(x - 2, y - 1.9, x + 2, y + 0.5, 0.6), ferro, doFerro(24270 + i, { tom: 1.08, projeta: sombraMiuda }))
    por(elipse(x, y - 0.7, 0.75, 0.75), ferro, doFerro(24274 + i, { bisel: 0.7, tom: TOM_DO_REBITE, metal: 0.5, contorno: 0.2 }))
  })
}
