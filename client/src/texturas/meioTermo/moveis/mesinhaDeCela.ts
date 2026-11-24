/**
 * MESINHA DE CELA de cima com volume (lote L10 de 24/11/2026, presídio moderno; objeto novo): o tampo de aço
 * dobrado, preso na parede do fundo (a beira de cima) por um flange parafusado e dois montantes de chapa rente à
 * parede, sem perna na frente; na frente, o BANQUINHO redondo num poste chumbado no piso. Em cima do tampo, o que um
 * preso tem: as folhas soltas de uma carta (uma por cima da outra, com as linhas de letra), o lápis, um livro de bolso
 * e a CANECA de ágata com o café pela metade.
 *
 * A 1x sobram o retângulo claro do tampo encostado na parede, os papéis claros e a roda do banquinho na frente: é o
 * que diz "mesa de cela". O tampo dobrado tem a beira da frente mais clara (a dobra pega a luz).
 *
 * NA 3/4 é derivada (`tresQuartos.ts`, beirada de `ESPESSURA_DO_TAMPO_DA_MESINHA`): o tampo e o assento são tampos
 * soltos; os montantes (rente à parede) e o poste do banquinho são colunas finas; a chapa do pé do banquinho fica no
 * chão (o meio da caixa dela vai para fora do assento, para não subir com ele). A caneca sobe em dois tampos
 * empilhados, o de baixo com a asa, com a base da caixa passada da beira do tampo para sair depois dele: a lateral
 * sai branca e a asa fica no meio da altura. Nada lê o giro.
 *
 * Sem material escolhido: o inox, o papel, a ágata, o lápis e o livro são fixos.
 */
import { anel, caixa, capsula, elipse, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import { G, type MontarMovel } from './contexto'
import { comMeioEm } from './andaimeDaTresQuartos'
import { ESCURO, ESCURO_DO_INOX, INOX, texEscovado } from './geladeira'
import { BEIRA_AZUL, ESMALTE, PAPEL, texEsmalte } from './apoioDoNecroterio'

/** A grossura da chapa do tampo e do assento (px do protótipo): o perfil da 3/4 em `tresQuartos.ts` usa este valor. */
export const ESPESSURA_DO_TAMPO_DA_MESINHA = 0.04 * G

/** Alturas em casas: o tampo (0,75 m) e o assento do banquinho (0,45 m). */
const ALTURA_DO_TAMPO = 0.5
const ALTURA_DO_BANCO = 0.3
/** O tampo: a meia largura (fração da meia pegada) e a fundura (fração da pegada). */
const MEIA_LARGURA_DO_TAMPO = 0.74
const FUNDURA_DO_TAMPO = 0.44
/** O banquinho: o raio do assento, o do poste, o da chapa do pé e o vão até o tampo (px). */
const BANCO = { raio: 6, poste: 1.3, chapa: 3.2, vao: 4 } as const
/** Os montantes de chapa rente à parede, debaixo do tampo: a distância da ponta, a fundura e a meia grossura (px). */
const ESQUADRO = { daPonta: 4, fundura: 2.6, meia: 0.7 } as const
const BRILHO_DO_ACO = 0.36
/** O lápis (amarelo apagado), o grafite, a capa do livro, o miolo e o café. */
const LAPIS: MaterialDaPeca = { classe: 'liso', rgb: [0xb5, 0x9a, 0x58] }
const GRAFITE: MaterialDaPeca = { classe: 'liso', rgb: [0x45, 0x43, 0x40] }
const CAPA: MaterialDaPeca = { classe: 'liso', rgb: [0x5f, 0x6e, 0x64] }
const MIOLO: MaterialDaPeca = { classe: 'liso', rgb: [0xd8, 0xcf, 0xb6] }
const CAFE: MaterialDaPeca = { classe: 'liso', rgb: [0x4c, 0x36, 0x29] }
/** A tinta da carta: cinza-azulado, meio transparente. */
const TINTA: MaterialDaPeca = { classe: 'liso', rgb: [0x55, 0x5c, 0x6e] }

/** A mesma forma com a base da caixa em `base` (só para baixo): sai depois na ordem da 3/4 sem alargar a imagem. */
function comBaseEm(f: Forma, base: number): Forma {
  return { b: [f.b[0], f.b[1], f.b[2], Math.max(f.b[3], base)], d: f.d }
}

/** Um retângulo girado `a` radianos em volta do meio (cx, cy), de meia largura `mx` e meia altura `my`. */
function folha(cx: number, cy: number, mx: number, my: number, a: number): Forma {
  const [co, si] = [Math.cos(a), Math.sin(a)]
  const canto = (x: number, y: number): Ponto => [cx + x * co - y * si, cy + x * si + y * co]
  return poligono([canto(-mx, -my), canto(mx, -my), canto(mx, my), canto(-mx, my)])
}

export const montarMesinhaDeCela: MontarMovel = (c, cena) => {
  const { hw, hh, h, g, peca: P } = c
  cena.corDoPiso = ESCURO_DO_INOX
  const esp = ESPESSURA_DO_TAMPO_DA_MESINHA
  const zTampo = g * ALTURA_DO_TAMPO
  const zBanco = g * ALTURA_DO_BANCO
  const lx = hw * MEIA_LARGURA_DO_TAMPO
  const yTampo = -hh + h * FUNDURA_DO_TAMPO
  const tampo = caixa(-lx, -hh, lx, yTampo, 2.4)
  const yBanco = yTampo + BANCO.vao + BANCO.raio
  const assento = elipse(0, yBanco, BANCO.raio, BANCO.raio)
  const poste = elipse(0, yBanco, BANCO.poste, BANCO.poste)

  // O tampo e o assento soltos; os montantes na parede e o poste chumbado são colunas finas.
  cena.sombras.push({ forma: tampo, z: zTampo, solta: true, suave: 1.6, forca: 0.26 }, { forma: assento, z: zBanco, solta: true, suave: 1.4, forca: 0.26 })
  for (const sx of [-1, 1]) {
    const x = sx * (lx - ESQUADRO.daPonta)
    cena.sombras.push({ forma: caixa(x - ESQUADRO.meia, -hh, x + ESQUADRO.meia, -hh + ESQUADRO.fundura), z: zTampo - esp, forca: 0.12 })
  }
  cena.sombras.push({ forma: poste, z: zBanco - esp, forca: 0.2 }, contato(elipse(0, yBanco, BANCO.chapa, BANCO.chapa), 0.28))

  const L = cena.partes
  const aco = { tabua: 0, metal: BRILHO_DO_ACO, textura: texEscovado }
  const liso = { tabua: 0, bisel: 0, contorno: 0 }

  // A chapa do pé do banquinho, com três parafusos: fica no chão (o meio da caixa sai para fora do assento).
  const foraDoAssento = yBanco + BANCO.raio + 0.6
  L.push(P(comMeioEm(elipse(0, yBanco, BANCO.chapa, BANCO.chapa), 0, foraDoAssento), INOX, { ...aco, bisel: 0.6, tom: 0.86, contorno: 0.26, semente: 9801 }))
  // O BANQUINHO: o assento com a beira enrolada e o meio gasto, mais escuro.
  L.push(P(assento, INOX, { ...aco, bisel: 2, contorno: 0.26, semente: 9802, projeta: { dist: 1.2, forca: 0.28, suave: 1.2 } }))
  L.push(P(anel(0, yBanco, BANCO.raio - 0.5, BANCO.raio - 0.5, BANCO.raio - 1.6, BANCO.raio - 1.6), INOX, { ...aco, bisel: 0.6, tom: 1.06, contorno: 0, semente: 9803 }))
  L.push(P(elipse(-0.6, yBanco - 0.4, BANCO.raio * 0.5, BANCO.raio * 0.45), ESCURO, { ...liso, alfa: 0.1, suave: 1.6, semente: 9804 }))

  // O TAMPO: a chapa escovada, a dobra da frente que pega a luz e o flange parafusado na parede.
  L.push(P(tampo, INOX, { ...aco, eixo: 0, bisel: 1.4, contorno: 0.26, semente: 9810 }))
  L.push(P(caixa(-lx + 0.7, yTampo - 1.7, lx - 0.7, yTampo - 0.5, 0.6), INOX, { ...aco, eixo: 0, bisel: 0.5, tom: 1.08, contorno: 0, semente: 9811 }))
  L.push(P(caixa(-lx + 2, -hh, lx - 2, -hh + 1.8, 0.4), INOX, { ...aco, eixo: 0, bisel: 0.4, tom: 0.86, contorno: 0.2, semente: 9812 }))
  for (const x of [-lx * 0.66, 0, lx * 0.66]) L.push(P(elipse(x, -hh + 0.9, 0.55, 0.55), ESCURO, { tabua: 0, bisel: 0.2, contorno: 0.2, tom: 1.25, semente: 9813 }))

  // A CARTA: duas folhas soltas, uma por cima da outra, com as linhas de letra; e o lápis atravessado.
  const cartas: readonly (readonly [number, number, number])[] = [[-lx * 0.22, -hh + 11.2, -0.22], [-lx * 0.4, -hh + 9.8, 0.1]]
  cartas.forEach(([cx, cy, a], i) => {
    L.push(P(folha(cx, cy, 4.1, 5.6, a), PAPEL, { tabua: 0, bisel: 0.3, tom: i === 0 ? 0.94 : 1, contorno: 0.22, semente: 9820 + i, projeta: { dist: 0.5, forca: 0.22 } }))
  })
  const [fx, fy, fa] = cartas[1]
  for (let k = 0; k < 6; k += 1) {
    const largura = k === 5 ? 1.6 : 3.2 - (k % 2) * 0.5
    const deslocado = -0.3 + (k === 0 ? 0.6 : 0)
    const yLinha = -3.8 + k * 1.45
    const [co, si] = [Math.cos(fa), Math.sin(fa)]
    const cx = fx + (deslocado + largura / 2 - 1.6) * co - yLinha * si
    const cy = fy + (deslocado + largura / 2 - 1.6) * si + yLinha * co
    L.push(P(folha(cx, cy, largura, 0.2, fa), TINTA, { ...liso, alfa: 0.5, semente: 9830 + k }))
  }
  const ponta: Ponto = [lx * 0.06, -hh + 15.6]
  const fimDoLapis: Ponto = [lx * 0.36, -hh + 12.4]
  L.push(P(capsula(ponta[0], ponta[1], fimDoLapis[0], fimDoLapis[1], 0.6), LAPIS, { tabua: 0, bisel: 0.5, contorno: 0.28, semente: 9840, projeta: { dist: 0.6, forca: 0.3 } }))
  L.push(P(capsula(ponta[0] - 0.4, ponta[1] + 0.35, ponta[0] + 0.7, ponta[1] - 0.25, 0.3), GRAFITE, { tabua: 0, bisel: 0.2, contorno: 0.1, semente: 9841 }))

  // O LIVRO de bolso à direita, um nada torto: o miolo de lado e a capa com a faixa do título.
  const xLivro = lx * 0.56
  const yLivro = -hh + 7.6
  L.push(P(folha(xLivro + 0.5, yLivro + 0.4, 3.4, 5, 0.06), MIOLO, { tabua: 0, bisel: 0.4, contorno: 0.24, semente: 9850, projeta: { dist: 0.8, forca: 0.3 } }))
  L.push(P(folha(xLivro, yLivro, 3.4, 5, 0.06), CAPA, { tabua: 0, bisel: 0.6, contorno: 0.26, semente: 9851 }))
  L.push(P(folha(xLivro, yLivro - 2.4, 2.6, 0.55, 0.06), MIOLO, { ...liso, alfa: 0.55, semente: 9852 }))

  // A CANECA de ágata com a beira azul e o café, na frente à direita. Sobe em dois tampos: o de baixo, com a asa.
  const xCaneca = lx * 0.62
  const yCaneca = yTampo - 4.4
  const rCaneca = 2.7
  const boca = elipse(xCaneca, yCaneca, rCaneca, rCaneca)
  const asa = elipse(xCaneca + rCaneca + 0.9, yCaneca + 0.2, 1.5, 1.3)
  // A base das caixas passa da beira do tampo: na 3/4 a caneca sai depois dele, e não debaixo.
  const baseDaCaneca = yTampo + 0.1
  cena.sombras.push(
    { forma: comBaseEm(uniao(boca, asa), baseDaCaneca), z: zTampo + esp, solta: true, forca: 0 },
    { forma: comBaseEm(boca, baseDaCaneca), z: zTampo + 2 * esp, solta: true, forca: 0 },
  )
  // De cima a caneca é a beira azul fina, a parede branca de dentro e o café mais fundo.
  L.push(P(anel(xCaneca + rCaneca + 0.9, yCaneca + 0.2, 1.5, 1.3, 0.75, 0.55), ESMALTE, { tabua: 0, bisel: 0.4, contorno: 0.28, textura: texEsmalte, semente: 9860, projeta: { dist: 0.6, forca: 0.26 } }))
  L.push(P(boca, ESMALTE, { tabua: 0, bisel: 0.9, contorno: 0.26, textura: texEsmalte, semente: 9861, projeta: { dist: 1.1, forca: 0.32, suave: 0.8 } }))
  L.push(P(anel(xCaneca, yCaneca, rCaneca - 0.1, rCaneca - 0.1, rCaneca - 0.45, rCaneca - 0.45), BEIRA_AZUL, { tabua: 0, bisel: 0.2, contorno: 0.06, semente: 9862 }))
  L.push(P(elipse(xCaneca, yCaneca, rCaneca - 0.5, rCaneca - 0.5), ESMALTE, { tabua: 0, bisel: 0, contorno: 0, tom: 0.86, recesso: { k: 0.8, forca: 0.3 }, semente: 9864 }))
  L.push(P(elipse(xCaneca + 0.15, yCaneca + 0.2, rCaneca - 1.2, rCaneca - 1.2), CAFE, { tabua: 0, bisel: 0, contorno: 0.12, recesso: { k: 0.6, forca: 0.25 }, semente: 9863 }))
  L.push(P(elipse(xCaneca - 0.5, yCaneca - 0.4, 0.45, 0.3), ESMALTE, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.4, semente: 9865 }))
}
