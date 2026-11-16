/**
 * DECK DE MADEIRA COM PILARES (lote L2 das referências, 16/11/2026: versão original, só a ideia do objeto). O
 * tablado de tábuas compridas, um nada acima do chão, com a moldura de quatro réguas em volta, as emendas das tábuas
 * desencontradas em cima dos barrotes (as duas fileiras de pregos marcam onde eles passam), um nó aqui e ali, uma
 * tábua trocada mais clara; e os PILARES quadrados de madeira com o chapéu, nos quatro cantos e no meio dos lados
 * compridos. Varanda, terraço, mirante, chão de coreto ou de cais.
 *
 * Objeto de chão, como o alçapão: o token anda em cima. Na 3/4 o tablado fica rente e os pilares sobem de verdade,
 * cada um com a frente varrida (as colunas da regra de sempre, `tresQuartos.ts`), em pé por cima das tábuas nos
 * quatro giros. A 25% de zoom sobram o retângulo de tábuas com a moldura escura e os seis quadrados dos pilares.
 * Perfil da 3/4: `DERIVADO`. Material: `madeira`.
 */
import { hash } from '../../ruido'
import { caixa, elipse, poligono, type Ponto } from './formas'
import { contato, texturaDaClasse, type Textura } from './motor'
import { QUARTO, type MontarMovel } from './contexto'

/** A altura dos pilares (casas). */
const ALTURA_DO_PILAR = 0.55
/** A moldura, a largura de partida de uma tábua, a junta, o lado do pilar e o passo dos barrotes (px). */
const MOLDURA = 4.4
const TABUA = 7.4
const JUNTA = 0.5
const PILAR = 5.6
const BARROTE = 28

export const montarDeckDeMadeira: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const madeira = c.m.madeira
  const daMadeira = texturaDaClasse(madeira.classe)
  const L = cena.partes
  const [x0, y0, x1, y1] = [-hw + 0.8, -hh + 0.8, hw - 0.8, hh - 0.8]
  const [ix0, iy0, ix1, iy1] = [x0 + MOLDURA, y0 + MOLDURA, x1 - MOLDURA, y1 - MOLDURA]

  // O tablado fica rente ao chão nas duas vistas (só o contato escurece a beira). Ele NÃO é um tampo solto: a 3/4
  // pinta as estruturas do norte para o sul pela base da caixa delas, e o tablado inteiro, que acaba no sul de todos
  // os pilares, cobria os da frente em qualquer giro (e esticar a caixa das colunas para passar dele deixava a 3/4
  // dez vezes mais lenta). Sem tampo, as tábuas são peças soltas, pintadas antes de todas as colunas.
  cena.sombras.push(contato(caixa(x0, y0, x1, y1, 0.8), 0.3))

  // A MOLDURA: réguas em meia-esquadria, mais escuras, emendadas no meio de cada lado. A emenda não é só enfeite: a
  // 3/4 sobe cada peça com a estrutura que contém o meio da caixa dela, e o meio de uma régua inteira caía dentro
  // do pilar do meio do lado (a régua subia até o chapéu dele).
  const [mx, my] = [(x0 + x1) / 2, (y0 + y1) / 2]
  const reguas: readonly (readonly [readonly Ponto[], number])[] = [
    [[[x0, y0], [mx, y0], [mx, iy0], [ix0, iy0]], 0],
    [[[mx, y0], [x1, y0], [ix1, iy0], [mx, iy0]], 0],
    [[[x0, y1], [ix0, iy1], [mx, iy1], [mx, y1]], 0],
    [[[mx, y1], [mx, iy1], [ix1, iy1], [x1, y1]], 0],
    [[[x0, y0], [ix0, iy0], [ix0, my], [x0, my]], QUARTO],
    [[[x0, my], [ix0, my], [ix0, iy1], [x0, y1]], QUARTO],
    [[[x1, y0], [x1, my], [ix1, my], [ix1, iy0]], QUARTO],
    [[[x1, my], [x1, y1], [ix1, iy1], [ix1, my]], QUARTO],
  ]
  reguas.forEach(([pontos, eixo], i) => L.push(P(poligono(pontos), madeira, { eixo, tabua: 0, bisel: 0.9, tom: 0.7, contorno: 0.28, semente: 6200 + i })))

  // As TÁBUAS ao comprido, em fileiras; cada fileira emendada em cima de um barrote, desencontrada da vizinha. Os
  // pregos (dois por barrote) vão na textura de cada tábua.
  const pregos: Textura = (u, v, x, y, p, s, escala) => {
    if (daMadeira !== null) daMadeira(u, v, x, y, p, s, escala)
    const dx = Math.abs(((x - ix0 + BARROTE / 2) % BARROTE) - BARROTE / 2)
    if (dx < 0.7) {
      const meio = Math.abs(((y - iy0) % (TABUA + JUNTA)) - (TABUA + JUNTA) / 2)
      if (Math.abs(meio - 2) < 0.65) s[3] -= 0.34
    }
  }
  const altura = iy1 - iy0
  const fileiras = Math.max(2, Math.round(altura / (TABUA + JUNTA)))
  const passo = altura / fileiras
  const barrotes = Math.max(1, Math.floor((ix1 - ix0) / BARROTE))
  for (let i = 0; i < fileiras; i += 1) {
    const ya = iy0 + i * passo + (i === 0 ? 0 : JUNTA / 2)
    const yb = iy0 + (i + 1) * passo - (i === fileiras - 1 ? 0 : JUNTA / 2)
    // As emendas desta fileira: em barrotes sorteados, nunca dois seguidos.
    const emendas: number[] = []
    for (let k = 1 + (i % 2); k < barrotes; k += 2 + Math.floor(hash(i, k, 6210) * 2)) emendas.push(ix0 + k * BARROTE)
    const pontas = [ix0, ...emendas, ix1]
    for (let k = 0; k + 1 < pontas.length; k += 1) {
      const xa = pontas[k] + (k === 0 ? 0 : JUNTA / 2)
      const xb = pontas[k + 1] - (k + 1 === pontas.length - 1 ? 0 : JUNTA / 2)
      // Uma tábua trocada, mais clara; as outras, cada uma no tom dela.
      const trocada = hash(i, k, 6211) > 0.93
      const tom = trocada ? 1.08 : 0.8 + 0.16 * hash(i, k, 6212)
      L.push(P(caixa(xa, ya, xb, yb, 0.3), madeira, { eixo: 0, tabua: 0, bisel: 0.7, tom, contorno: 0.24, textura: pregos, semente: 6220 + i * 13 + k }))
      if (hash(i, k, 6213) > 0.8) L.push(P(elipse(xa + (xb - xa) * hash(k, i, 6214), (ya + yb) / 2, 1.8, 1), madeira, { tabua: 0, bisel: 0.3, tom: 0.55, contorno: 0.1, semente: 6300 + i }))
    }
  }

  // Os PILARES: nos cantos e no meio dos lados compridos, cada um uma coluna na 3/4, com o chapéu de quatro águas.
  const zPilar = g * ALTURA_DO_PILAR
  const comprido = x1 - x0 >= y1 - y0
  const meios: readonly (readonly [number, number])[] = comprido ? [[0, y0], [0, y1]] : [[x0, 0], [x1, 0]]
  const cantos: readonly (readonly [number, number])[] = [[x0, y0], [x1, y0], [x0, y1], [x1, y1], ...meios]
  cantos.forEach(([px, py], i) => {
    const cx = px === 0 ? 0 : px < 0 ? px + PILAR / 2 + 0.6 : px - PILAR / 2 - 0.6
    const cy = py === 0 ? 0 : py < 0 ? py + PILAR / 2 + 0.6 : py - PILAR / 2 - 0.6
    const pilar = caixa(cx - PILAR / 2, cy - PILAR / 2, cx + PILAR / 2, cy + PILAR / 2, 0.4)
    cena.sombras.push({ forma: pilar, z: zPilar, forca: 0.3 })
    L.push(P(pilar, madeira, { eixo: QUARTO, tabua: 0, bisel: 0.8, tom: 0.86, contorno: 0.3, semente: 6400 + i }))
    // O chapéu: as quatro águas (a de cima e a da esquerda pegam a luz).
    const k = PILAR / 2 - 0.9
    const ponta: Ponto = [cx, cy]
    const aguas: readonly (readonly [Ponto, Ponto, number])[] = [
      [[cx - k, cy - k], [cx + k, cy - k], 1.12],
      [[cx + k, cy - k], [cx + k, cy + k], 0.86],
      [[cx + k, cy + k], [cx - k, cy + k], 0.78],
      [[cx - k, cy + k], [cx - k, cy - k], 1.04],
    ]
    aguas.forEach(([a, b, tom], j) => L.push(P(poligono([a, b, ponta]), madeira, { tabua: 0, bisel: 0, tom, contorno: 0.14, semente: 6410 + i * 4 + j })))
  })
}
