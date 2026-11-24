/**
 * CADEIRA REMENDADA de cima com volume (lote L09 dos objetos de 24/11/2026, "Cortiço"; a versão consertada de qualquer
 * jeito da cadeira, `cadeira.ts`). A mesma cadeira de quatro pernas, encosto atrás, mas:
 * - o ASSENTO é de três tábuas soltas, a do meio TROCADA por uma mais clara, que sobra para a direita, presa com pregos
 *   novos; a da frente tem uma RACHA;
 * - o ENCOSTO está PARTIDO: a travessa vai do poste da esquerda até um pouco depois do meio e acaba em lascas claras; o
 *   poste da direita quebrou baixo e mostra o miolo lascado, com o toco da travessa;
 * - a PERNA da frente à direita está AMARRADA com corda: três voltas em diagonal na quina do assento, o nó e a ponta
 *   solta caindo pela quina.
 *
 * A 25% de zoom sobram o assento de tábuas com a faixa clara da tábua trocada, o encosto que acaba no meio e o laço
 * claro da corda na quina: cadeira quebrada e remendada (a cadeira inteira tem o encosto de ponta a ponta).
 *
 * Na 3/4 (DERIVADO) o assento é o tampo no ar e o que resta do encosto sobe mais alto; o poste quebrado, só até a metade.
 * Material: `madeira` (o carvalho de partida; a tábua trocada sai sempre mais clara que ela). A corda é fixa. As medidas
 * são as da cadeira (frações da pegada de 0,5 x 0,5 casa); os detalhes miúdos, do menor lado.
 */
import { misturar, type Rgb } from '../../ruido'
import { caixa, capsula, elipse, poligono, uniao, type Ponto } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import { G, QUARTO, type MontarMovel } from './contexto'
import { arco } from './catreDesarrumado'

/** Alturas, em casas: o assento, o encosto (o que restou), o poste quebrado. */
const ALTURA_DO_ASSENTO = 0.27
const ALTURA_DO_ENCOSTO = 0.62
const ALTURA_DO_POSTE_QUEBRADO = 0.4
/** Onde a travessa do encosto partiu (fração da largura, a partir da esquerda). */
const QUEBRA_DO_ENCOSTO = 0.58
/** A madeira nova da tábua trocada e o miolo claro das lascas. */
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

export const montarCadeiraRemendada: MontarMovel = (c, cena) => {
  const { hw, hh, w, h, g, peca: P } = c
  const mad = c.m.madeira
  const L = cena.partes
  const k = Math.min(w, h) / (0.5 * G)
  const zS = g * ALTURA_DO_ASSENTO
  const zE = g * ALTURA_DO_ENCOSTO
  const zQ = g * ALTURA_DO_POSTE_QUEBRADO
  const yAss = -hh + 0.18 * h
  const yTrilho = -hh + 0.16 * h
  const posteL = 0.18 * w
  // O assento recua um nada à direita e embaixo: ali cai a ponta da corda.
  const [sx1, sy1] = [hw - 1.1 * k, hh - 1.1 * k]
  const xQ = -hw + QUEBRA_DO_ENCOSTO * w
  const nova: MaterialDaPeca = { classe: 'madeira', rgb: misturar(mad.rgb, MADEIRA_NOVA, 0.62) }
  const cerne: MaterialDaPeca = { classe: 'madeira', rgb: misturar(mad.rgb, CERNE, 0.7) }

  // As sombras: o assento solto no ar, o resto do encosto mais alto, o poste quebrado e as quatro pernas.
  cena.sombras.push(
    { forma: caixa(-hw, yAss, sx1, sy1, 1.4), z: zS, solta: true },
    { forma: caixa(-hw, -hh, xQ, yTrilho, 1.2), z: zE, solta: true },
    { forma: caixa(hw - posteL, -hh, hw, -hh + 0.2 * h, 1.2), z: zQ },
  )
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const lx = sx < 0 ? -hw + 2.2 : sx1 - 2.2
    const ly = sy < 0 ? -hh + 2.2 : sy1 - 2.2
    const alto = sy > 0 ? zS : sx < 0 ? zE : zQ
    cena.sombras.push(contato(caixa(lx - 1.8, ly - 1.8, lx + 1.8, ly + 1.8), 0.3), { forma: caixa(lx - 1.6, ly - 1.6, lx + 1.6, ly + 1.6), z: alto, forca: 0.24 })
  }

  // O ASSENTO: a moldura escura por baixo (aparece nas frestas) e as três tábuas; a do meio é a trocada.
  // A moldura é madeira, não o vão: na 3/4 as pernas (colunas sem peça) pegam o material da maior peça do móvel.
  L.push(P(caixa(-hw, yAss, sx1, sy1, 1.4), mad, { tabua: 0, bisel: 0.6, tom: 0.5, contorno: 0.3, semente: 8501 }))
  const fresta = 0.55 * k
  const alturaDaTabua = (sy1 - yAss - 2 * fresta) / 3
  for (let i = 0; i < 3; i += 1) {
    const y0 = yAss + i * (alturaDaTabua + fresta)
    const y1 = y0 + alturaDaTabua
    if (i === 1) {
      // A tábua trocada: mais clara, mais comprida (sobra à direita) e um nada torta, com dois pregos novos em cada ponta.
      const tabua = poligono([[-hw - 0.3 * k, y0 + 0.15 * k], [sx1 + 1 * k, y0 - 0.2 * k], [sx1 + 1 * k, y1 - 0.25 * k], [-hw - 0.3 * k, y1 + 0.1 * k]])
      L.push(P(tabua, nova, { eixo: 0, tabua: 0, bisel: 0.8, contorno: 0.28, semente: 8502, projeta: { dist: 0.7, forca: 0.32 } }))
      for (const x of [-hw + 1.6 * k, sx1 - 1.4 * k]) {
        for (const f of [0.3, 0.72]) L.push(P(elipse(x, y0 + (y1 - y0) * f, 0.5 * k, 0.5 * k), PREGO_NOVO, { bisel: 0.4, contorno: 0.1, metal: 0.4, semente: 8503 }))
      }
      continue
    }
    L.push(P(caixa(-hw, y0, sx1, y1, 0.8), mad, { eixo: 0, tabua: 0, bisel: 0.9, tom: i === 0 ? 0.98 : 1.04, contorno: 0.24, semente: 8504 + i }))
  }
  // A RACHA da tábua da frente: o risco escuro que abre no meio, com o veio claro de um lado.
  const yR = yAss + 2 * (alturaDaTabua + fresta) + alturaDaTabua * 0.48
  L.push(P(poligono([[-hw + 3 * k, yR], [-hw + 7 * k, yR - 0.35 * k], [-hw + 9.5 * k, yR + 0.1 * k], [-hw + 7 * k, yR + 0.35 * k]]), VAO, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.85, semente: 8507 }))

  // O ENCOSTO PARTIDO: a travessa do poste da esquerda até a quebra, com as lascas claras na ponta.
  const fundo = 1.6 * k
  const travessa = poligono([[-hw, -hh], [xQ, -hh], ...lascas(xQ, -hh, yTrilho, 1, fundo), [-hw, yTrilho]])
  L.push(P(travessa, mad, { tabua: 0, bisel: 1.2, contorno: 0.26, semente: 8510, projeta: { dist: (zE - zS) * 0.3, forca: 0.32, suave: 1.4 } }))
  const miolo = { b: travessa.b, d: (x: number, y: number) => Math.max(travessa.d(x, y), Math.abs(x - (xQ + fundo * 0.5)) - fundo * 0.9) }
  L.push(P(miolo, cerne, { tabua: 0, bisel: 0.5, contorno: 0.14, eixo: 0, semente: 8511 }))
  L.push(P(caixa(-hw, -hh, -hw + posteL, -hh + 0.2 * h, 1.2), mad, { eixo: QUARTO, tabua: 0, bisel: 1.6, semente: 8512 }))

  // O POSTE QUEBRADO da direita: o toco com o miolo lascado e o toquinho da travessa saindo dele.
  const xP = hw - posteL
  L.push(P(poligono([[xP - 2 * k, -hh + 0.6 * k], [xP, -hh + 0.3 * k], [xP, yTrilho - 0.2 * k], [xP - 1.4 * k, yTrilho - 0.5 * k], [xP - 0.7 * k, (-hh + yTrilho) / 2]]), mad, { tabua: 0, bisel: 0.7, tom: 0.9, contorno: 0.26, semente: 8513 }))
  const toco = caixa(xP, -hh, hw, -hh + 0.2 * h, 1.2)
  L.push(P(toco, mad, { eixo: QUARTO, tabua: 0, bisel: 1.4, tom: 0.92, contorno: 0.28, semente: 8514 }))
  const quebra = poligono([[xP + 0.9 * k, -hh + 1.2 * k], [hw - 0.8 * k, -hh + 0.9 * k], [hw - 1.2 * k, -hh + 2.4 * k], [hw - 0.7 * k, -hh + 4 * k], [xP + 1.2 * k, -hh + 4.4 * k], [xP + 2.2 * k, -hh + 2.6 * k]])
  L.push(P(quebra, cerne, { tabua: 0, bisel: 0.4, contorno: 0.18, recesso: { k: 0.6, forca: 0.26 }, semente: 8515 }))

  // A CORDA na perna da frente à direita: três voltas de través na quina do assento, o nó e a ponta caindo.
  const [qx, qy] = [sx1 - 2.4 * k, sy1 - 2.4 * k]
  const voltas = [-1.7, 0, 1.7].map((t) => {
    const [ox, oy] = [qx + t * 0.72 * k, qy - t * 0.72 * k]
    return capsula(ox - 2.6 * k, oy - 2.6 * k, ox + 2.6 * k, oy + 2.6 * k, 0.62 * k)
  })
  cena.sombras.push(contato(voltas.reduce((a, b) => uniao(a, b)), 0.3))
  voltas.forEach((v, i) => L.push(P(v, CORDA, { tabua: 0, bisel: 0.55 * k, contorno: 0.28, tom: 1 - 0.05 * i, semente: 8520 + i, projeta: { dist: 0.6 * k, forca: 0.3 } })))
  const [nx, ny] = [qx + 2.4 * k, qy + 0.6 * k]
  L.push(P(elipse(nx, ny, 1.1 * k, 1 * k), CORDA, { tabua: 0, bisel: 0.7 * k, contorno: 0.28, tom: 1.06, semente: 8524 }))
  const ponta = arco([nx + 0.4 * k, ny + 0.6 * k], [hw - 0.6 * k, hh - 1.6 * k], [hw - 1.6 * k, hh - 0.5 * k])
  L.push(P(capsula(ponta[0][0], ponta[0][1], ponta[4][0], ponta[4][1], 0.5 * k), CORDA, { tabua: 0, bisel: 0.4 * k, contorno: 0.26, semente: 8525 }))
  L.push(P(capsula(ponta[4][0], ponta[4][1], ponta[8][0], ponta[8][1], 0.45 * k), CORDA, { tabua: 0, bisel: 0.4 * k, contorno: 0.26, tom: 0.94, semente: 8526 }))
}
