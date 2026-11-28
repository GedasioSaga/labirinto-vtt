import { empacotar, fbm, hash, luz, luzNaInclinacao, LUZ_NO_PLANO, misturar, mod, passoSuave, rgb, valor } from '../ruido'

/**
 * NEVE PISADA (lote L08 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`; cartão Neve): a
 * neve da vila de inverno depois de um dia de gente andando. A neve fofa (os brancos e o azul da sombra da Neve de
 * `embutidas.ts`) tem os lombos macios de sempre; por cima, manchas largas de neve PISADA, achatada e um nada mais
 * cinza, onde as pegadas se juntam, com uma sujeira rala de quem passou. Fora das manchas sobram pegadas soltas. Cada
 * pegada é um buraco raso de bota (a sola e o salto num oval só, mais estreito no meio), com a parede de cima à
 * esquerda na sombra e a de baixo à direita na luz; as pegadas seguem um rumo largo que muda devagar pelo ladrilho
 * (a trilha), cada uma um tanto torta. Cores contidas: nada de branco puro, a sujeira é cinza, não marrom.
 *
 * As medidas, em casas: o ladrilho tem 8; as manchas de pisado têm 1 a 3; a pegada tem 0,23 de comprido e 0,1 de
 * largo. As pegadas moram em células de 8/28 casa tabeladas uma vez (se há pegada, o rumo e o lugar), e cada ponto
 * olha as 3 x 3 em volta: a emenda não aparece e o ladrilho sai rápido.
 */

const CASAS = 8
const CELULAS = 28

const NEVE = rgb('#dfe8f0')
const NEVE_SOMBRA = rgb('#b9c6d6')
/** A encosta virada para a luz: o claro mais alto da neve (canal 241). */
const NEVE_NA_LUZ = rgb('#e5ecf1')
/** A neve pisada: achatada, um nada mais cinza e mais azul que a fofa. */
const PISADA = rgb('#c6d0da')
/** A sujeira rala do pisado: cinza de cinza e lama seca, sem marrom. */
const SUJA = rgb('#a9a7a1')
/** O fundo da pegada: a neve socada, mais azul. */
const FUNDO = rgb('#a9b9cb')

/** A bota: meio comprimento e meia largura (casas), o aperto no meio e a fundura do buraco (casas). */
const BOTA = { comprido: 0.115, largo: 0.05, aperto: 0.22, fundura: 0.028 } as const
/** O passo da diferença para a inclinação da pegada (casas). */
const PASSO = 0.012

/** Onde a neve é pisada (0 a 1): manchas largas e macias. */
function pisadoEm(u: number, v: number): number {
  return passoSuave(0.5, 0.72, fbm(u, v, 2, 3, 2100) * 0.5 + 0.5)
}

/** Por célula: se há pegada (0 ou 1), o rumo (cosseno e seno) e o lugar dela na célula (x e y, 0 a 1). */
let tabelaDasPegadas: Float64Array | null = null

function pegadasDaTabela(): Float64Array {
  if (tabelaDasPegadas !== null) return tabelaDasPegadas
  const tabela = new Float64Array(CELULAS * CELULAS * 5)
  for (let j = 0; j < CELULAS; j += 1) {
    for (let i = 0; i < CELULAS; i += 1) {
      const k = (j * CELULAS + i) * 5
      const u = (i + 0.5) / CELULAS
      const v = (j + 0.5) / CELULAS
      tabela[k] = hash(i, j, 2101) < 0.1 + 0.72 * pisadoEm(u, v) ? 1 : 0
      // O rumo da trilha: um campo largo de ângulos que muda devagar; cada pegada um tanto torta.
      const giro = fbm(u, v, 1, 2, 2102) * Math.PI * 2.4 + (hash(i, j, 2103) - 0.5) * 0.8
      tabela[k + 1] = Math.cos(giro)
      tabela[k + 2] = Math.sin(giro)
      tabela[k + 3] = 0.3 + 0.4 * hash(i, j, 2104)
      tabela[k + 4] = 0.3 + 0.4 * hash(i, j, 2105)
    }
  }
  tabelaDasPegadas = tabela
  return tabela
}

/** A fundura das pegadas no ponto (x, y) em casas: 1 no fundo do buraco, 0 fora. */
function fundura(x: number, y: number): number {
  const celula = CASAS / CELULAS
  const ci = Math.floor(x / celula)
  const cj = Math.floor(y / celula)
  const tabela = pegadasDaTabela()
  let fundo = 0
  for (let j = cj - 1; j <= cj + 1; j += 1) {
    for (let i = ci - 1; i <= ci + 1; i += 1) {
      const k = (mod(j, CELULAS) * CELULAS + mod(i, CELULAS)) * 5
      if (tabela[k] === 0) continue
      const px = (i + tabela[k + 3]) * celula
      const py = (j + tabela[k + 4]) * celula
      const a = (x - px) * tabela[k + 1] + (y - py) * tabela[k + 2]
      const b = -(x - px) * tabela[k + 2] + (y - py) * tabela[k + 1]
      if (Math.abs(a) > BOTA.comprido * 1.3 || Math.abs(b) > BOTA.largo * 1.4) continue
      const meia = BOTA.largo * (1 - BOTA.aperto * Math.exp(-((a * 14) ** 2)))
      const d = Math.hypot(a / BOTA.comprido, b / meia) - 1
      fundo = Math.max(fundo, 1 - passoSuave(-0.5, 0.12, d))
    }
  }
  return fundo
}

/** A cor da neve pisada no ponto (u, v) do ladrilho. */
export function texturaNevePisada(u: number, v: number): number {
  const uu = u - Math.floor(u)
  const vv = v - Math.floor(v)
  const x = uu * CASAS
  const y = vv * CASAS
  const pisado = pisadoEm(uu, vv)
  // Os lombos macios da neve fofa, achatados onde ela foi pisada.
  const e = 1 / 2048
  const h = (a: number, b: number): number => fbm(a, b, 3, 3, 2110) * 0.25
  const achata = 1 - 0.75 * pisado
  let dhx = ((h(uu + e, vv) - h(uu - e, vv)) / (2 * e * CASAS)) * achata
  let dhy = ((h(uu, vv + e) - h(uu, vv - e)) / (2 * e * CASAS)) * achata
  // As pegadas: o buraco raso, com a inclinação das paredes.
  const fundo = fundura(x, y)
  if (fundo > 0 || fundura(x + PASSO, y) > 0 || fundura(x, y + PASSO) > 0) {
    dhx -= ((fundura(x + PASSO, y) - fundura(x - PASSO, y)) / (2 * PASSO)) * BOTA.fundura
    dhy -= ((fundura(x, y + PASSO) - fundura(x, y - PASSO)) / (2 * PASSO)) * BOTA.fundura
  }
  // O grão da neve primeiro; a luz puxa para o claro contido (nunca passa do canal 245) ou para o azul da sombra.
  const neve = luz(NEVE, (valor(uu * 256, vv * 256, 256, 2112) - 0.5) * 0.024)
  const s = luzNaInclinacao(dhx, dhy) - LUZ_NO_PLANO
  let c = s >= 0 ? misturar(neve, NEVE_NA_LUZ, Math.min(1, s * 2.2)) : misturar(neve, NEVE_SOMBRA, Math.min(1, -s * 1.7))
  // O pisado: achatado, mais cinza, com a sujeira rala; o fundo das pegadas, socado e mais azul.
  c = misturar(c, PISADA, pisado * 0.6)
  c = misturar(c, SUJA, pisado * passoSuave(0.6, 0.86, valor(uu * 24, vv * 24, 24, 2111)) * 0.14)
  return empacotar(misturar(c, FUNDO, fundo * 0.4))
}
