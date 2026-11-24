/**
 * MESA COM COMPUTADOR de cima com volume (lote L10 de 24/11/2026, presídio moderno, a sala da administração; versão
 * da escrivaninha): a mesa de repartição de fórmica cinza-cristal com a fita de borda escura, o pé de painel à
 * esquerda e o GAVETEIRO à direita. Em cima, o que o expediente deixa: o MONITOR na base, com o cabo descendo pelo
 * passa-cabo, o TECLADO escuro com as teclas e a barra de espaço, o MOUSE no tapete com o fio, a PASTA de papelão
 * com o ofício por cima (e outro por baixo, saindo), o CARIMBO de cabo de madeira ao lado da almofada de tinta e o
 * PORTA-LÁPIS com as três canetas.
 *
 * NA 3/4 é derivada (`tresQuartos.ts`, beirada de `ESPESSURA_DO_TAMPO_DA_MESA_COM_COMPUTADOR`): o tampo é solto; o pé
 * de painel, o gaveteiro e o painel de trás são colunas (cada um com a peça dele num fio que sai do tampo, para a
 * frente sair de fórmica e não do que for maior). O MONITOR é uma pilha de tampos soltos da grossura da beirada, um
 * em cima do outro, que saem depois do tampo na ordem de pintura (`emOrdem`): as beiradas fazem a tela de plástico
 * escuro em qualquer giro; cada fatia é um nada mais rasa que a de baixo, e a peça dela tem o meio num ponto só dela
 * (é assim que cada fatia leva a sua peça escura, e não a da mesa). Só a 3/4 vê (`soNaTresQuartos`, sem giro) a
 * imagem da tela (a ficha do sistema, com a foto e as linhas), a luz de ligado, a fita de borda escura na frente do
 * tampo e as três gavetas com puxador e fechadura. Com giro fica a tela escura, de frente, de lado ou de costas.
 *
 * Sem material escolhido: a fórmica, o plástico, o papel e o resto são fixos.
 */
import type { Rgb } from '../../ruido'
import { cadeia, caixa, capsula, elipse, menos, poligono, type Forma, type Ponto } from './formas'
import { contato, ruido, type MaterialDaPeca, type Textura } from './motor'
import { G, type MontarMovel } from './contexto'
import { comMeioEm, solta } from './andaimeDaTresQuartos'
import { NIQUEL, PAPEL } from './apoioDoNecroterio'
import { BRILHO_DO_CROMO, CROMO, REFLEXO, soNaTresQuartos, type PecaDaTela } from './apoioDoBanheiroModerno'

/** A grossura do tampo (px do protótipo): o perfil da 3/4 em `tresQuartos.ts` usa este valor (é também a fatia do monitor). */
export const ESPESSURA_DO_TAMPO_DA_MESA_COM_COMPUTADOR = 0.045 * G

/** A altura do tampo (0,75 m), em casas. */
const ALTURA_DO_TAMPO = 0.5
/** O monitor: o meio, a largura, a fundura, o vão da base até a tela e as fatias da tela (px). */
const MONITOR = { meio: -3, meiaLargura: 11, frente: 5, fundura: 2, vao: 3, fatias: 5 } as const
/** Quanto cada fatia do monitor é mais rasa que a de baixo (px): invisível, só separa os pontos das peças. */
const RECUO_DA_FATIA = 0.03
/** O gaveteiro: a largura e o recuo da direita (px). */
const GAVETEIRO = { largura: 14.5, recuo: 1 } as const
/** O painel de trás desce isto abaixo do tampo (px). */
const PAINEL_DE_TRAS_MAIS_BAIXO = 6
/** O teclado: o passo das teclas (px) e o vão entre elas. */
const TECLA = { passoX: 1.36, passoY: 1.2, vao: 0.16 } as const
/** Abaixo desta escala as teclas viram chuvisco: o desenho delas fica fraco. */
const ESCALA_DAS_TECLAS = 1.5
/** O passo (px) entre as bases das fatias na ordem de pintura da 3/4 (a de `emOrdem`). */
const PASSO_DA_ORDEM = 0.05

/** A forma sem o ponto (x, y): a peça com o meio nele não sobe com ela, e sim com a estrutura de baixo. */
function semOPonto(f: Forma, x: number, y: number): Forma {
  return { b: f.b, d: (px, py) => (Math.abs(px - x) < 1e-6 && Math.abs(py - y) < 1e-6 ? 1 : f.d(px, py)) }
}

/** A mesma forma com a base da caixa em `base` (só para baixo): sai depois na ordem da 3/4 sem alargar a imagem. */
function comBaseEm(f: Forma, base: number): Forma {
  return { b: [f.b[0], f.b[1], f.b[2], Math.max(f.b[3], base)], d: f.d }
}

/** A fórmica cinza-cristal, a fita de borda, o plástico escuro do monitor e do teclado, o tapete do mouse. */
const FORMICA: MaterialDaPeca = { classe: 'liso', rgb: [0xbc, 0xb6, 0xa8] }
const BORDA: MaterialDaPeca = { classe: 'liso', rgb: [0x60, 0x5c, 0x57] }
const PLASTICO: MaterialDaPeca = { classe: 'liso', rgb: [0x35, 0x38, 0x3b] }
const TECLADO: MaterialDaPeca = { classe: 'liso', rgb: [0x46, 0x49, 0x4d] }
const TAPETE: MaterialDaPeca = { classe: 'liso', rgb: [0x40, 0x48, 0x51] }
/** A pasta de papelão, a tinta das letras e o cabo. */
const PASTA: MaterialDaPeca = { classe: 'liso', rgb: [0xc0, 0xa8, 0x7a] }
const TINTA: MaterialDaPeca = { classe: 'liso', rgb: [0x4c, 0x52, 0x5e] }
const CABO: MaterialDaPeca = { classe: 'liso', rgb: [0x2f, 0x31, 0x33] }
/** O carimbo: o cabo de madeira, a almofada e a tinta roxa apagada; as canetas. */
const MADEIRA_DO_CARIMBO: MaterialDaPeca = { classe: 'madeira', rgb: [0x7b, 0x5b, 0x3f] }
const ALMOFADA: MaterialDaPeca = { classe: 'liso', rgb: [0x3b, 0x40, 0x48] }
const TINTA_DO_CARIMBO: MaterialDaPeca = { classe: 'liso', rgb: [0x46, 0x47, 0x62] }
const CANETAS: readonly MaterialDaPeca[] = [
  { classe: 'liso', rgb: [0x48, 0x5c, 0x86] },
  { classe: 'liso', rgb: [0x98, 0x4b, 0x45] },
  { classe: 'liso', rgb: [0x2e, 0x30, 0x33] },
]
/** A tela acesa (azul-acinzentado apagado), a barra de cima, as letras, a foto e a luz de ligado. */
const TELA: MaterialDaPeca = { classe: 'liso', rgb: [0x50, 0x63, 0x70] }
const BARRA_DA_TELA: MaterialDaPeca = { classe: 'liso', rgb: [0x6f, 0x86, 0x94] }
const LETRA: MaterialDaPeca = { classe: 'liso', rgb: [0xc6, 0xd0, 0xd4] }
const FOTO: MaterialDaPeca = { classe: 'liso', rgb: [0x9a, 0xa2, 0xa6] }
const LUZ_DE_LIGADO: MaterialDaPeca = { classe: 'liso', rgb: [0x84, 0xa6, 0x7c] }
/** O escuro em que o pixel escuro demais é levantado: o grafite frio do plástico. */
const PISO_DA_MESA: Rgb = [0x3e, 0x41, 0x44]

/** A fórmica: uma mancha larga leve e o pontilhado miúdo dela (que some no tamanho de mesa). */
const texFormica: Textura = (_u, _v, x, y, p, s, escala) => {
  const ponto = escala < ESCALA_DAS_TECLAS ? 0.3 : 1
  s[3] += ruido(x * 0.06 + p.semente, y * 0.06) * 0.03 + ruido(x * 1.7, y * 1.7) * 0.025 * ponto
}

/** As teclas do teclado a partir do canto (x0, y0): cada uma clara no meio, com o vão escuro em volta. */
function texturaDoTeclado(x0: number, y0: number): Textura {
  return (_u, _v, x, y, _p, s, escala) => {
    const fx = (x - x0) / TECLA.passoX
    const fy = (y - y0) / TECLA.passoY
    const rx = fx - Math.floor(fx)
    const ry = fy - Math.floor(fy)
    const borda = Math.min(Math.min(rx, 1 - rx) * TECLA.passoX, Math.min(ry, 1 - ry) * TECLA.passoY)
    const vao = Math.max(0, Math.min(1, (TECLA.vao + 0.5 / escala - borda) * escala))
    const forca = escala < ESCALA_DAS_TECLAS ? 0.35 : 1
    s[3] += (0.08 - vao * 0.22) * forca
  }
}

/** Um retângulo girado `a` radianos em volta do meio (cx, cy), de meia largura `mx` e meia altura `my`. */
function folha(cx: number, cy: number, mx: number, my: number, a: number): Forma {
  const [co, si] = [Math.cos(a), Math.sin(a)]
  const canto = (x: number, y: number): Ponto => [cx + x * co - y * si, cy + x * si + y * co]
  return poligono([canto(-mx, -my), canto(mx, -my), canto(mx, my), canto(-mx, my)])
}

export const montarMesaComComputador: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  cena.corDoPiso = PISO_DA_MESA
  const esp = ESPESSURA_DO_TAMPO_DA_MESA_COM_COMPUTADOR
  const zTampo = g * ALTURA_DO_TAMPO
  const zDebaixo = zTampo - esp
  const tampo = caixa(-hw + 0.5, -hh + 0.5, hw - 0.5, hh - 0.5, 0.9)
  // O pé de painel, o gaveteiro e o painel de trás passam um fio do tampo: a peça de cada um tem o meio nesse fio.
  const pe = caixa(-hw + 0.2, -hh + 1.6, -hw + 2, hh - 1.6, 0.3)
  const xG0 = hw - GAVETEIRO.recuo - GAVETEIRO.largura
  const xG1 = hw - GAVETEIRO.recuo
  const gaveteiro = caixa(xG0, -hh + 1.2, xG1, hh - 0.8, 0.6)
  const painel = caixa(-hw + 2, -hh + 0.2, xG0, -hh + 1.3, 0.2)
  // O gaveteiro fica inteiro debaixo do tampo (sai antes dele na 3/4): a peça dele tem o meio num ponto que o tampo
  // não tem.
  const fioDoGaveteiro = caixa(xG0, hh - 1.1, xG1, hh - 0.8)
  const meioDoFio: Ponto = [(fioDoGaveteiro.b[0] + fioDoGaveteiro.b[2]) / 2, (fioDoGaveteiro.b[1] + fioDoGaveteiro.b[3]) / 2]
  cena.sombras.push({ forma: semOPonto(tampo, meioDoFio[0], meioDoFio[1]), z: zTampo, solta: true, suave: 1.8, forca: 0.28 })
  cena.sombras.push({ forma: pe, z: zDebaixo, forca: 0.16 }, contato(pe, 0.3), { forma: gaveteiro, z: zDebaixo, forca: 0.2 }, contato(gaveteiro, 0.32))
  cena.sombras.push({ forma: painel, z: zDebaixo - PAINEL_DE_TRAS_MAIS_BAIXO, forca: 0.12 })

  // O MONITOR: as fatias soltas, cada uma um nada mais rasa, pintadas depois do tampo na 3/4.
  const xM0 = MONITOR.meio - MONITOR.meiaLargura
  const xM1 = MONITOR.meio + MONITOR.meiaLargura
  const yM1 = -hh + MONITOR.frente + MONITOR.fundura
  const yM0 = yM1 - MONITOR.fundura
  const zDaFatia = (k: number): number => zTampo + MONITOR.vao + esp * (k + 1)
  for (let k = 0; k < MONITOR.fatias; k += 1) {
    const fatia = caixa(xM0, yM0, xM1, yM1 - k * RECUO_DA_FATIA, 0.6)
    cena.sombras.push(solta(comBaseEm(fatia, hh - 0.5 + PASSO_DA_ORDEM * (k + 1)), zDaFatia(k)))
  }

  const L = cena.partes
  const liso = { tabua: 0, bisel: 0, contorno: 0 }

  // As colunas debaixo do tampo: a peça de cada uma é o fio que sai dele (de cima fica escondida na borda).
  L.push(P(caixa(-hw + 0.2, -hh + 1.6, -hw + 0.5, hh - 1.6), FORMICA, { tabua: 0, bisel: 0, tom: 0.9, contorno: 0.1, semente: 10401 }))
  L.push(P(fioDoGaveteiro, FORMICA, { tabua: 0, bisel: 0, tom: 0.92, contorno: 0.1, semente: 10402 }))
  L.push(P(caixa(-hw + 2, -hh + 0.2, xG0, -hh + 0.5), FORMICA, { tabua: 0, bisel: 0, tom: 0.88, contorno: 0.1, semente: 10403 }))

  // O TAMPO de fórmica com a fita de borda escura.
  L.push(P(tampo, FORMICA, { tabua: 0, bisel: 0.9, contorno: 0.28, textura: texFormica, semente: 10410 }))
  L.push(P(menos(tampo, caixa(-hw + 1, -hh + 1, hw - 1, hh - 1, 0.5)), BORDA, { tabua: 0, bisel: 0.3, contorno: 0.06, semente: 10411 }))

  // O passa-cabo e o cabo do monitor descendo por ele.
  const xFuro = MONITOR.meio - 9
  L.push(P(elipse(xFuro, -hh + 2.6, 1.7, 1.7), PLASTICO, { tabua: 0, bisel: 0.5, contorno: 0.26, semente: 10412 }))
  L.push(P(elipse(xFuro, -hh + 2.6, 0.95, 0.95), CABO, { ...liso, alfa: 0.9, semente: 10413 }))
  L.push(P(cadeia([[MONITOR.meio - 1, yM0 - 0.3], [MONITOR.meio - 3, -hh + 2.7], [xFuro + 0.4, -hh + 2.5]], 0.32), CABO, { tabua: 0, bisel: 0.3, contorno: 0.2, semente: 10414 }))

  // A PASTA de papelão com o ofício por cima e outro por baixo, saindo.
  L.push(P(folha(-21.6, 0.9, 4.3, 6, -0.2), PAPEL, { tabua: 0, bisel: 0.3, tom: 0.95, contorno: 0.22, semente: 10420 }))
  L.push(P(folha(-20.6, -1.3, 5.2, 7, -0.07), PASTA, { tabua: 0, bisel: 0.5, contorno: 0.26, semente: 10421, projeta: { dist: 0.6, forca: 0.24 } }))
  const [ox, oy, oa] = [-20.2, -1.8, 0.05] as const
  L.push(P(folha(ox, oy, 4.3, 6, oa), PAPEL, { tabua: 0, bisel: 0.3, contorno: 0.22, semente: 10422, projeta: { dist: 0.5, forca: 0.22 } }))
  for (let k = 0; k < 7; k += 1) {
    const largura = k === 0 ? 1.8 : k === 6 ? 1.4 : 3.1 - (k % 3) * 0.4
    const yLinha = -4.4 + k * 1.35 + (k > 0 ? 0.6 : 0)
    const deslocado = k === 0 ? 1.2 : 0
    const [co, si] = [Math.cos(oa), Math.sin(oa)]
    const lx = deslocado + largura / 2 - 3
    L.push(P(folha(ox + lx * co - yLinha * si, oy + lx * si + yLinha * co, largura / 2 + 0.6, 0.18, oa), TINTA, { ...liso, alfa: k === 0 ? 0.7 : 0.45, semente: 10423 + k }))
  }
  L.push(P(capsula(ox - 2.6, oy - 6.4, ox - 2.6, oy - 4.4, 0.35), NIQUEL, { tabua: 0, bisel: 0.3, metal: 0.6, contorno: 0.24, semente: 10430 }))

  // O TECLADO escuro com as teclas e a barra de espaço.
  const [xT0, yT0, xT1, yT1] = [-12.5, 0.4, 6.5, 6.4] as const
  L.push(P(caixa(xT0, yT0, xT1, yT1, 0.8), TECLADO, { tabua: 0, bisel: 0.7, contorno: 0.3, semente: 10440, projeta: { dist: 0.6, forca: 0.26 } }))
  L.push(P(caixa(xT0 + 0.7, yT0 + 0.6, xT1 - 0.7, yT1 - 1.9, 0.3), TECLADO, { tabua: 0, bisel: 0.2, tom: 1.06, contorno: 0, textura: texturaDoTeclado(xT0 + 0.7, yT0 + 0.6), semente: 10441 }))
  L.push(P(capsula(xT0 + 5.5, yT1 - 1.05, xT1 - 6.5, yT1 - 1.05, 0.5), TECLADO, { tabua: 0, bisel: 0.4, tom: 1.15, contorno: 0.2, semente: 10442 }))

  // O MOUSE no tapete, com o fio indo para trás do monitor.
  L.push(P(caixa(9, -0.6, 16.6, 6.8, 1), TAPETE, { tabua: 0, bisel: 0.4, contorno: 0.24, semente: 10450 }))
  L.push(P(cadeia([[12.9, 0.7], [12.4, -2.2], [10.4, -4.4], [MONITOR.meio + 8, yM1 + 0.6]], 0.26), CABO, { tabua: 0, bisel: 0.2, contorno: 0.16, semente: 10451 }))
  L.push(P(elipse(12.9, 3.2, 1.6, 2.4), TECLADO, { tabua: 0, bisel: 1.3, tom: 1.1, contorno: 0.3, semente: 10452, projeta: { dist: 0.5, forca: 0.28 } }))
  L.push(P(capsula(12.9, 1, 12.9, 2.6, 0.12), CABO, { ...liso, alfa: 0.7, semente: 10453 }))

  // O CARIMBO ao lado da almofada de tinta, e o PORTA-LÁPIS com as canetas.
  L.push(P(caixa(18.6, -4, 25.2, 0.2, 0.6), ALMOFADA, { tabua: 0, bisel: 0.5, contorno: 0.28, metal: 0.3, semente: 10460, projeta: { dist: 0.5, forca: 0.24 } }))
  L.push(P(caixa(19.4, -3.2, 24.4, -0.6, 0.4), TINTA_DO_CARIMBO, { tabua: 0, bisel: 0.2, contorno: 0.12, recesso: { k: 0.5, forca: 0.2 }, semente: 10461 }))
  L.push(P(caixa(19.9, 2.4, 24.1, 5, 0.4), ALMOFADA, { tabua: 0, bisel: 0.4, contorno: 0.26, semente: 10462, projeta: { dist: 0.5, forca: 0.24 } }))
  L.push(P(elipse(22, 3.7, 1.45, 1.45), MADEIRA_DO_CARIMBO, { tabua: 0, bisel: 1.3, contorno: 0.3, semente: 10463, projeta: { dist: 0.9, forca: 0.3 } }))
  L.push(P(elipse(21.6, 3.2, 0.5, 0.4), REFLEXO, { ...liso, alfa: 0.35, semente: 10464 }))
  const [xCopo, yCopo] = [22, -9] as const
  L.push(P(elipse(xCopo, yCopo, 2.4, 2.4), PLASTICO, { tabua: 0, bisel: 0.6, contorno: 0.28, tom: 1.15, semente: 10465, projeta: { dist: 1.2, forca: 0.3 } }))
  L.push(P(elipse(xCopo, yCopo, 1.8, 1.8), CABO, { ...liso, alfa: 0.85, semente: 10466 }))
  const pontas: readonly Ponto[] = [[-0.7, -0.5], [0.7, -0.3], [0, 0.8]]
  pontas.forEach(([dx, dy], i) => L.push(P(elipse(xCopo + dx, yCopo + dy, 0.6, 0.6), CANETAS[i], { tabua: 0, bisel: 0.5, contorno: 0.24, semente: 10467 + i })))

  // A BASE do monitor (no tampo: o meio dela vai para a frente da tela) e as FATIAS, cada peça no ponto da sua.
  L.push(P(comMeioEm(caixa(MONITOR.meio - 4.5, yM0 - 2.6, MONITOR.meio + 4.5, yM1 + 1.6, 1.6), MONITOR.meio, yM1 + 1.2), PLASTICO, { tabua: 0, bisel: 1, tom: 1.08, contorno: 0.28, semente: 10470, projeta: { dist: 0.6, forca: 0.26 } }))
  const tela = caixa(xM0, yM0, xM1, yM1, 0.6)
  for (let k = 0; k < MONITOR.fatias; k += 1) {
    const ultima = k === MONITOR.fatias - 1
    const ponto = yM1 - k * RECUO_DA_FATIA - RECUO_DA_FATIA / 2
    L.push(P(comMeioEm(tela, MONITOR.meio, ponto), PLASTICO, { tabua: 0, bisel: 0.6, contorno: 0.3, semente: 10471, ...(ultima ? { projeta: { dist: 4.2, forca: 0.34, suave: 1.5 } } : {}) }))
  }
  L.push(P(capsula(xM0 + 1.2, yM0 + 0.55, xM1 - 1.2, yM0 + 0.55, 0.35), REFLEXO, { ...liso, alfa: 0.14, semente: 10476 }))

  // Só a 3/4 (o chão de cada linha em y, para cima negativo): a imagem da tela, a fita da frente e as gavetas.
  const topoDaTela = yM1 - zDaFatia(MONITOR.fatias - 1)
  const baseDaTela = yM1 - zTampo - MONITOR.vao
  const [ax0, ay0, ax1, ay1] = [xM0 + 0.9, topoDaTela + 0.9, xM1 - 0.9, baseDaTela - 1.6]
  const tela3x4: PecaDaTela[] = [
    { forma: caixa(ax0, ay0, ax1, ay1, 0.2), mat: TELA, o: { tabua: 0, bisel: 0, contorno: 0.2, semente: 10480 } },
    { forma: caixa(ax0, ay0, ax1, ay0 + 1.3), mat: BARRA_DA_TELA, o: { ...liso, semente: 10481 } },
    { forma: caixa(ax0 + 1, ay0 + 2.2, ax0 + 4.4, ay1 - 1.2, 0.2), mat: FOTO, o: { tabua: 0, bisel: 0, contorno: 0.12, semente: 10482 } },
    { forma: elipse(ax0 + 2.7, ay0 + 4.3, 0.9, 1.05), mat: TELA, o: { ...liso, alfa: 0.75, semente: 10483 } },
    { forma: elipse(ax0 + 2.7, ay1 - 1.2, 1.5, 1.3), mat: TELA, o: { ...liso, alfa: 0.75, semente: 10484 } },
    { forma: elipse(ax1 - 1.3, baseDaTela - 0.8, 0.3, 0.3), mat: LUZ_DE_LIGADO, o: { ...liso, semente: 10485 } },
    { forma: poligono([[ax1 - 7, ay0 + 1.3], [ax1 - 4.6, ay0 + 1.3], [ax1 - 8.6, ay1], [ax1 - 11, ay1]]), mat: REFLEXO, o: { ...liso, alfa: 0.07, semente: 10486 } },
  ]
  for (let k = 0; k < 4; k += 1) {
    const y = ay0 + 2.6 + k * 1.75
    tela3x4.push({ forma: caixa(ax0 + 5.4, y - 0.22, ax0 + 5.4 + (k === 3 ? 6 : 11 - (k % 2) * 2.5), y + 0.22), mat: LETRA, o: { ...liso, alfa: 0.62, semente: 10487 + k } })
  }
  // A tela sai depois da última fatia; a frente da mesa, depois do gaveteiro (o chão dele é a beira da frente).
  soNaTresQuartos(P, cena, MONITOR.meio, hh - 0.5 + PASSO_DA_ORDEM * (MONITOR.fatias + 1), tela3x4)
  const topoDaFrente = hh - 0.5 - zTampo
  const frente: PecaDaTela[] = []
  frente.push({ forma: caixa(-hw + 0.5, topoDaFrente, hw - 0.5, topoDaFrente + esp, 0.3), mat: BORDA, o: { tabua: 0, bisel: 0.3, contorno: 0.24, semente: 10491 } })
  const chaoDoGaveteiro = hh - 0.8
  const gavetas: readonly (readonly [number, number])[] = [[topoDaFrente + esp + 0.5, topoDaFrente + esp + 6.4], [topoDaFrente + esp + 7, chaoDoGaveteiro - 10.6], [chaoDoGaveteiro - 10, chaoDoGaveteiro - 1.8]]
  gavetas.forEach(([y0, y1], i) => {
    frente.push({ forma: caixa(xG0 + 0.6, y0, xG1 - 0.6, y1, 0.4), mat: FORMICA, o: { tabua: 0, bisel: 0.4, tom: 0.97, contorno: 0.24, textura: texFormica, semente: 10492 + i } })
    frente.push({ forma: capsula(xG0 + 4, y0 + 1.6, xG1 - 4, y0 + 1.6, 0.45), mat: CROMO, o: { tabua: 0, bisel: 0.4, metal: BRILHO_DO_CROMO, contorno: 0.26, semente: 10495 + i } })
  })
  frente.push({ forma: elipse(xG1 - 2, gavetas[0][0] + 1.6, 0.55, 0.55), mat: NIQUEL, o: { tabua: 0, bisel: 0.4, metal: 0.6, contorno: 0.26, semente: 10498 } })
  frente.push({ forma: caixa(xG0 + 0.6, chaoDoGaveteiro - 1.3, xG1 - 0.6, chaoDoGaveteiro, 0.2), mat: BORDA, o: { ...liso, alfa: 0.8, semente: 10499 } })
  soNaTresQuartos(P, cena, 0, hh + 0.1, frente)
}
