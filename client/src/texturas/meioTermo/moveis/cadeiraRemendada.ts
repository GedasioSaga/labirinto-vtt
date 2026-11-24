/**
 * CADEIRA REMENDADA de cima com volume (lote L09 dos objetos de 24/11/2026, "Cortiço"; a versão consertada de qualquer
 * jeito da cadeira, `cadeira.ts`). A mesma cadeira de quatro pernas, encosto atrás, de madeira já gasta, parda e
 * acinzentada, mas:
 * - o ASSENTO é de três tábuas soltas, a do meio TROCADA por uma nova e clara (o único destaque de cor), que sobra para a
 *   direita, presa com pregos novos; a da frente tem uma RACHA;
 * - o ENCOSTO está PARTIDO: a travessa assenta em cima do poste da esquerda e acaba em lascas claras só do lado da
 *   quebra, um pouco depois do meio; o poste da direita quebrou na altura do assento mais um terço e termina no miolo
 *   lascado, sem nada solto em cima;
 * - a PERNA da frente à direita levou uma TALA, um sarrafo mais claro rente à perna que passa da quina do assento, e
 *   três VOLTAS de corda atravessadas à tala e à perna, com o nó na frente e a ponta curta.
 *
 * A 25% de zoom sobram o assento de tábuas com a faixa clara da tábua trocada, o encosto que acaba no meio e a tala clara
 * com a corda na quina: cadeira quebrada e remendada (a cadeira inteira tem o encosto de ponta a ponta).
 *
 * Na 3/4 (DERIVADO) o assento é o tampo no ar; a travessa é outro tampo, assentado no topo do poste da esquerda (a
 * coluna dele para na espessura dela); o poste quebrado é uma coluna mais baixa; a tala sobe um nada acima do assento,
 * e as voltas de corda são um tampo baixo, à meia altura da perna, de modo que ficam na coluna da perna. Material:
 * `madeira` (o carvalho de partida, sempre gasto para o pardo do cortiço; a tábua trocada e a tala saem mais claras). A
 * corda é fixa. As medidas são as da cadeira (frações da pegada de 0,5 x 0,5 casa); os detalhes miúdos, do menor lado.
 */
import { misturar, type Rgb } from '../../ruido'
import { caixa, cadeia, capsula, elipse, poligono, type Forma, type Ponto } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import { G, QUARTO, type MontarMovel } from './contexto'
import { arco, ESCURO_DO_CORTICO, madeiraGasta } from './catreDesarrumado'

/** Alturas, em casas: o assento, o encosto (o que restou) e o poste quebrado (o assento mais um terço até o encosto). */
const ALTURA_DO_ASSENTO = 0.27
const ALTURA_DO_ENCOSTO = 0.62
const ALTURA_DO_POSTE_QUEBRADO = ALTURA_DO_ASSENTO + (ALTURA_DO_ENCOSTO - ALTURA_DO_ASSENTO) / 3
/** A espessura do tampo solto na 3/4 (`ESPESSURA_DO_TAMPO` de `tresQuartos.ts`): o poste da esquerda para debaixo dela. */
const ESPESSURA_DA_TRAVESSA = 0.06 * G
/** A tala sobe este tanto acima do assento (px da pegada de partida) e as voltas de corda ficam nesta fração da perna. */
const TALA_ACIMA_DO_ASSENTO = 2
const ALTURA_DA_CORDA = 0.45
/** Onde a travessa do encosto partiu (fração da largura, a partir da esquerda). */
const QUEBRA_DO_ENCOSTO = 0.58
/** Quanto a madeira escolhida vai para o pardo gasto do cortiço. */
const GASTO_DA_MADEIRA = 0.55
/** A madeira nova da tábua trocada e da tala, e o miolo claro das lascas. */
const MADEIRA_NOVA: Rgb = [0xc4, 0xa4, 0x76]
const CERNE: Rgb = [0xcf, 0xae, 0x7c]
/** A corda do remendo, o vão entre as tábuas e a racha. */
const CORDA: MaterialDaPeca = { classe: 'corda', rgb: [0xc2, 0xb2, 0x8a] }
const VAO: MaterialDaPeca = { classe: 'liso', rgb: [0x3a, 0x2e, 0x24] }
/** Pregos novos, mais claros que o prego velho do móvel. */
const PREGO_NOVO: MaterialDaPeca = { classe: 'metal', rgb: [0x9a, 0x9c, 0x9e] }

/** A ponta lascada em `x` (de `y0` a `y1`): dentes de comprimentos desencontrados para o lado de `para`. */
function lascas(x: number, y0: number, y1: number, para: -1 | 1, fundo: number): Ponto[] {
  const dentes = [0.15, 0.9, 0.35, 1, 0.2, 0.7, 0.05]
  return dentes.map((f, i): Ponto => [x + para * fundo * f, y0 + ((y1 - y0) * i) / (dentes.length - 1)])
}

/** O meio da caixa da forma: é por ele que a 3/4 decide em que andar a peça fica. */
function meio(f: Forma): Ponto {
  return [(f.b[0] + f.b[2]) / 2, (f.b[1] + f.b[3]) / 2]
}

export const montarCadeiraRemendada: MontarMovel = (c, cena) => {
  const { hw, hh, w, h, g, peca: P } = c
  const mad = madeiraGasta(c.m.madeira, GASTO_DA_MADEIRA)
  const L = cena.partes
  const k = Math.min(w, h) / (0.5 * G)
  cena.corDoPiso = ESCURO_DO_CORTICO
  const zS = g * ALTURA_DO_ASSENTO
  const zE = g * ALTURA_DO_ENCOSTO
  const zQ = g * ALTURA_DO_POSTE_QUEBRADO
  const yAss = -hh + 0.18 * h
  const yTrilho = -hh + 0.16 * h
  const posteL = 0.18 * w
  // O assento recua à direita e embaixo: ali ficam a tala e a corda.
  const [sx1, sy1] = [hw - 2.4 * k, hh - 2.4 * k]
  const xQ = -hw + QUEBRA_DO_ENCOSTO * w
  const fundo = 1.6 * k
  const nova: MaterialDaPeca = { classe: 'madeira', rgb: misturar(mad.rgb, MADEIRA_NOVA, 0.7) }
  const sarrafo: MaterialDaPeca = { classe: 'madeira', rgb: misturar(mad.rgb, MADEIRA_NOVA, 0.45) }
  const cerne: MaterialDaPeca = { classe: 'madeira', rgb: misturar(mad.rgb, CERNE, 0.6) }

  // As sombras: o assento e a travessa soltos no ar, o poste da esquerda até debaixo da travessa, o poste quebrado, as
  // pernas da frente e a tala.
  const posteEsq = caixa(-hw, -hh, -hw + posteL, -hh + 0.15 * h, 1)
  const posteDir = caixa(hw - posteL, -hh, hw, -hh + 0.2 * h, 1.2)
  const pernaEsq = caixa(-hw + 0.6, sy1 - 3.8, -hw + 3.8, sy1 - 0.6, 0.6)
  const pernaDir = caixa(sx1 - 3.4, sy1 - 3.4, sx1 - 0.2, sy1 - 0.2, 0.6)
  const tala = caixa(sx1 - 0.3, sy1 - 4.2 * k, sx1 + 1.4 * k, sy1 - 0.25, 0.4)
  cena.sombras.push(
    { forma: caixa(-hw, yAss, sx1, sy1, 1.4), z: zS, solta: true },
    { forma: caixa(-hw, -hh, xQ + fundo * 0.5, yTrilho, 1.2), z: zE, solta: true },
    { forma: posteEsq, z: zE - ESPESSURA_DA_TRAVESSA, forca: 0.24 },
    { forma: posteDir, z: zQ, forca: 0.24 },
    { forma: pernaEsq, z: zS, forca: 0.24 },
    { forma: pernaDir, z: zS, forca: 0.24 },
    { forma: tala, z: zS + TALA_ACIMA_DO_ASSENTO * k, forca: 0.24 },
  )
  for (const pe of [posteEsq, posteDir, pernaEsq, pernaDir, tala]) cena.sombras.push(contato(pe, 0.3))

  // O ASSENTO: a moldura escura por baixo (aparece nas frestas) e as três tábuas; a do meio é a trocada.
  // A moldura é madeira, não o vão: na 3/4 as pernas (colunas sem peça) pegam o material da maior peça do móvel.
  L.push(P(caixa(-hw, yAss, sx1, sy1, 1.4), mad, { tabua: 0, bisel: 0.6, tom: 0.5, contorno: 0.3, semente: 8501 }))
  const fresta = 0.55 * k
  const alturaDaTabua = (sy1 - yAss - 2 * fresta) / 3
  for (let i = 0; i < 3; i += 1) {
    const y0 = yAss + i * (alturaDaTabua + fresta)
    const y1 = y0 + alturaDaTabua
    if (i === 1) {
      // A tábua trocada: clara, mais comprida (sobra à direita) e um nada torta, com dois pregos novos em cada ponta.
      const tabua = poligono([[-hw - 0.3 * k, y0 + 0.15 * k], [sx1 + 1 * k, y0 - 0.2 * k], [sx1 + 1 * k, y1 - 0.25 * k], [-hw - 0.3 * k, y1 + 0.1 * k]])
      L.push(P(tabua, nova, { eixo: 0, tabua: 0, bisel: 0.8, contorno: 0.28, semente: 8502, projeta: { dist: 0.7, forca: 0.32 } }))
      for (const x of [-hw + 1.6 * k, sx1 - 1.4 * k]) {
        for (const f of [0.3, 0.72]) L.push(P(elipse(x, y0 + (y1 - y0) * f, 0.5 * k, 0.5 * k), PREGO_NOVO, { bisel: 0.4, contorno: 0.1, metal: 0.4, semente: 8503 }))
      }
      continue
    }
    L.push(P(caixa(-hw, y0, sx1, y1, 0.8), mad, { eixo: 0, tabua: 0, bisel: 0.9, tom: i === 0 ? 0.98 : 1.04, contorno: 0.24, semente: 8504 + i }))
  }
  // A RACHA da tábua da frente: o risco escuro que abre no meio.
  const yR = yAss + 2 * (alturaDaTabua + fresta) + alturaDaTabua * 0.48
  L.push(P(poligono([[-hw + 3 * k, yR], [-hw + 7 * k, yR - 0.35 * k], [-hw + 9.5 * k, yR + 0.1 * k], [-hw + 7 * k, yR + 0.35 * k]]), VAO, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.85, semente: 8507 }))

  // O ENCOSTO PARTIDO: a travessa assentada no poste da esquerda (ponta reta ali) até a quebra, com as lascas claras só
  // na ponta da quebra; o topo do poste por cima da ponta dela.
  const travessa = poligono([[-hw, -hh], [xQ, -hh], ...lascas(xQ, -hh, yTrilho, 1, fundo), [-hw, yTrilho]])
  L.push(P(travessa, mad, { tabua: 0, bisel: 1.2, contorno: 0.26, semente: 8510, projeta: { dist: (zE - zS) * 0.3, forca: 0.32, suave: 1.4 } }))
  const miolo: Forma = { b: travessa.b, d: (x, y) => Math.max(travessa.d(x, y), Math.abs(x - (xQ + fundo * 0.5)) - fundo * 0.9) }
  L.push(P(miolo, cerne, { tabua: 0, bisel: 0.5, contorno: 0.14, eixo: 0, semente: 8511 }))
  L.push(P(caixa(-hw, -hh, -hw + posteL, -hh + 0.2 * h, 1.2), mad, { eixo: QUARTO, tabua: 0, bisel: 1.6, semente: 8512 }))

  // O POSTE QUEBRADO da direita: o toco e, por cima dele, o miolo lascado e claro. Nada sobra acima da quebra.
  const xP = hw - posteL
  L.push(P(caixa(xP, -hh, hw, -hh + 0.2 * h, 1.2), mad, { eixo: QUARTO, tabua: 0, bisel: 1.4, tom: 0.92, contorno: 0.28, semente: 8514 }))
  const quebra = poligono([[xP + 0.9 * k, -hh + 1.2 * k], [hw - 0.8 * k, -hh + 0.9 * k], [hw - 1.2 * k, -hh + 2.4 * k], [hw - 0.7 * k, -hh + 4 * k], [xP + 1.2 * k, -hh + 4.4 * k], [xP + 2.2 * k, -hh + 2.6 * k]])
  L.push(P(quebra, cerne, { tabua: 0, bisel: 0.4, contorno: 0.18, recesso: { k: 0.6, forca: 0.26 }, semente: 8515 }))

  // A TALA na perna da frente à direita: o sarrafo claro, rente à perna, que passa da quina do assento.
  L.push(P(tala, sarrafo, { eixo: QUARTO, tabua: 0, bisel: 0.5 * k, contorno: 0.28, semente: 8520, projeta: { dist: 0.6 * k, forca: 0.3 } }))
  // As três VOLTAS de corda atravessadas à tala e à perna (a frente de cada volta, que aparece fora do assento), o nó
  // na frente e a ponta curta. Na 3/4 elas são um tampo baixo à meia altura da perna: a caixa dele passa só pelo meio
  // de cada peça, fina, para a beirada dele não virar um bloco de corda.
  const [xa, xb] = [sx1 - 3.7, sx1 + 1.7 * k]
  const xm = (xa + xb) / 2
  const corda = [0, 1, 2].map((i) => cadeia(arco([xa, sy1 + 0.1 + 0.55 * i * k], [xm, sy1 + 1.5 + 0.55 * i * k], [xb, sy1 + 0.1 + 0.55 * i * k]), 0.42 * k))
  corda.push(elipse(xm + 0.25 * k, sy1 + 1.2 * k, 0.95 * k, 0.8 * k))
  corda.push(capsula(xm + 0.45 * k, sy1 + 1.5 * k, xm + 0.75 * k, sy1 + 2.3 * k, 0.36 * k))
  const centros = corda.map(meio)
  const folga = 0.3
  const noAr = caixa(Math.min(...centros.map((p) => p[0])) - folga, Math.min(...centros.map((p) => p[1])) - folga, Math.max(...centros.map((p) => p[0])) + folga, Math.max(...centros.map((p) => p[1])) + folga)
  cena.sombras.push({ forma: noAr, z: zS * ALTURA_DA_CORDA, solta: true, forca: 0.2 })
  corda.forEach((forma, i) => L.push(P(forma, CORDA, { tabua: 0, bisel: 0.35 * k, contorno: 0.28, tom: i === 3 ? 1.06 : 1 - 0.05 * i, semente: 8521 + i, projeta: { dist: 0.5 * k, forca: 0.3 } })))
}
