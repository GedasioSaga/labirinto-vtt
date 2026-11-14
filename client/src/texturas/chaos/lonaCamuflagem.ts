import { empacotar, fbm, lerp, luz, luzNaInclinacao, LUZ_NO_PLANO, misturar, passoSuave, rgb, type Rgb } from '../ruido'

/**
 * LONA CAMUFLADA (pedido de 14/11/2026: "texturas novas de madeira, pedra, base militar"; cartão Base militar): o
 * chão de barraca e de acampamento. Lona de trama fina (fio deitado e fio em pé se cruzando, como tela de
 * algodão grosso) com manchas grandes de camuflagem em areia, verde-oliva e marrom apagados, e dobras macias e
 * largas onde a lona não assentou no chão, a luz de cima à esquerda acendendo um lado de cada dobra.
 *
 * As manchas e as dobras são ruído de período inteiro (repetem no ladrilho sem emenda) e a trama tem 128 fios por
 * lado, então o cruzamento também fecha na borda. As três cores ficam perto na luz (a areia é a mais clara, mas
 * não muito): a camuflagem se lê pela cor, sem virar xadrez de claro e escuro no mapa.
 *
 * Rápido: manchas, poeira e luz das dobras são largas (a menor coisa nelas tem umas 40 px), então saem de uma
 * tabela de 256 x 256 calculada uma vez e lida com interpolação; por pixel, só a conta da trama. Calculadas
 * pixel a pixel, eram 19 ruídos por ponto e o ladrilho levava 1,3 s.
 */

/** A areia (o fundo da estampa): cáqui de lona velha, sem amarelo. */
const AREIA: Rgb = rgb('#8d8469')
/** O verde-oliva militar, apagado pelo sol. */
const VERDE: Rgb = rgb('#62664a')
/** O marrom de terra da estampa, mais quente que o verde e quase da mesma luz. */
const MARROM: Rgb = rgb('#6c5a48')
/** A poeira que a bota trouxe: parda, um nada mais clara que a lona. */
const POEIRA: Rgb = rgb('#8a8070')

/**
 * As manchas: células por ladrilho da primeira oitava, oitavas e limiares. O verde faz manchas de umas duas casas
 * e meia; o marrom, de umas duas: com as duas do mesmo tamanho, a mancha marrom grande voltava igual a cada
 * ladrilho e marcava a repetição em grade no 3 x 3.
 */
const VERDE_ESCALA = 3
const MARROM_ESCALA = 4
const MANCHA_OITAVAS = 4
const VERDE_LIMIAR = -0.05
const MARROM_LIMIAR = 0.2
/**
 * A passagem de uma cor para outra, em unidades do ruído: estreita (a estampa é recortada, não aquarela), mas
 * sem fio de 1 px.
 */
const MANCHA_MACIA = 0.014

/** Fios por lado do ladrilho (16 por casa: um fio de 8 px no ladrilho de 1024). */
const TRAMA = 128
/** O fundo entre um fio e outro e a luz no lado de cima à esquerda de cada fio. */
const TRAMA_FUNDO = 0.05
const TRAMA_LUZ = 0.022
/** A média do corpo do fio, `4a(1 - a)` em [0, 1]: tirada para a trama não clarear nem escurecer a lona. */
const MEDIA_DO_FIO = 2 / 3

/** A força da inclinação das dobras e o quanto a luz delas pesa na cor. */
const DOBRA_INCLINACAO = 0.05
const DOBRA_LUZ = 0.55
/**
 * O vinco: o quanto a linha da dobra sobe e a largura dela (no ruído). Um morro macio em volta do zero do
 * ruído, `1 / (1 + (n / largura)^2)`: o "1 - |n|" fazia quina, e a quina acendia um fio duro de luz.
 */
const VINCO = { altura: 0.3, largura: 0.22 } as const

/** O lado da tabela (potência de 2: uma célula a cada 4 px do ladrilho de 1024) e os campos de cada célula. */
const TABELA = 256
const CAMPO = { verde: 0, marrom: 1, poeira: 2, dobra: 3 } as const
const CAMPOS = 4

function naVolta(t: number): number {
  return t - Math.floor(t)
}

/** A altura da lona: ondas largas e, por cima, o vinco macio das dobras (onde o segundo ruído cruza o zero). */
function alturaDaLona(u: number, v: number): number {
  const n = fbm(u, v, 4, 1, 2504) / VINCO.largura
  return fbm(u, v, 2, 2, 2503) + VINCO.altura / (1 + n * n)
}

let tabela: Float64Array | null = null

/**
 * A tabela (preguiçosa, uma vez só): em cada célula, o ruído do verde, o do marrom, o da poeira e a luz da dobra
 * (pela inclinação da altura, em diferença centrada entre as células vizinhas, dando a volta na borda).
 */
function tabelaDaLona(): Float64Array {
  if (tabela !== null) return tabela
  const alturas = new Float64Array(TABELA * TABELA)
  for (let j = 0; j < TABELA; j += 1) {
    for (let i = 0; i < TABELA; i += 1) alturas[j * TABELA + i] = alturaDaLona(i / TABELA, j / TABELA)
  }
  const t = new Float64Array(TABELA * TABELA * CAMPOS)
  for (let j = 0; j < TABELA; j += 1) {
    const cima = ((j + TABELA - 1) % TABELA) * TABELA
    const baixo = ((j + 1) % TABELA) * TABELA
    for (let i = 0; i < TABELA; i += 1) {
      const u = i / TABELA
      const v = j / TABELA
      const k = (j * TABELA + i) * CAMPOS
      t[k + CAMPO.verde] = fbm(u, v, VERDE_ESCALA, MANCHA_OITAVAS, 2502)
      t[k + CAMPO.marrom] = fbm(u, v, MARROM_ESCALA, MANCHA_OITAVAS, 2501)
      t[k + CAMPO.poeira] = fbm(u, v, 6, 2, 2505)
      const dhx = ((alturas[j * TABELA + ((i + 1) % TABELA)] - alturas[j * TABELA + ((i + TABELA - 1) % TABELA)]) * TABELA) / 2
      const dhy = ((alturas[baixo + i] - alturas[cima + i]) * TABELA) / 2
      t[k + CAMPO.dobra] = luzNaInclinacao(dhx * DOBRA_INCLINACAO, dhy * DOBRA_INCLINACAO) - LUZ_NO_PLANO
    }
  }
  tabela = t
  return t
}

/** O campo `campo` da tabela no ponto, interpolado entre os quatro cantos (índices já com o campo zero). */
function interpolar(t: Float64Array, a: number, b: number, c: number, d: number, campo: number, fx: number, fy: number): number {
  return lerp(lerp(t[a + campo], t[b + campo], fx), lerp(t[c + campo], t[d + campo], fx), fy)
}

/**
 * A trama no ponto: a variação de luz do fio que está por cima (deitado ou em pé, em xadrez). O fio é um rolo:
 * o corpo `4a(1 - a)` cheio no meio e fundo nas beiras, e o lado `1 - 2a` aceso em cima à esquerda (conta só de
 * soma e produto: a mesma em qualquer aparelho).
 */
function trama(uu: number, vv: number): number {
  const gx = uu * TRAMA
  const gy = vv * TRAMA
  const i = Math.floor(gx)
  const j = Math.floor(gy)
  const deitado = (i + j) % 2 === 0
  // A posição através do fio: 0 numa borda, 1 na outra.
  const a = deitado ? gy - j : gx - i
  return (4 * a * (1 - a) - MEDIA_DO_FIO) * TRAMA_FUNDO + (1 - 2 * a) * TRAMA_LUZ
}

/** A cor da lona camuflada no ponto (u, v) do ladrilho. */
export function texturaLonaCamuflagem(u: number, v: number): number {
  const uu = naVolta(u)
  const vv = naVolta(v)
  const t = tabelaDaLona()
  const x = uu * TABELA
  const y = vv * TABELA
  const i0 = Math.floor(x)
  const j0 = Math.floor(y)
  const fx = x - i0
  const fy = y - j0
  // Os quatro cantos da célula, dando a volta na borda (TABELA é potência de 2).
  const i1 = (i0 + 1) & (TABELA - 1)
  const j1 = (j0 + 1) & (TABELA - 1)
  const linha0 = (j0 & (TABELA - 1)) * TABELA
  const linha1 = j1 * TABELA
  const a = (linha0 + (i0 & (TABELA - 1))) * CAMPOS
  const b = (linha0 + i1) * CAMPOS
  const c = (linha1 + (i0 & (TABELA - 1))) * CAMPOS
  const d = (linha1 + i1) * CAMPOS
  // A estampa: a areia de fundo, o verde por cima e o marrom por cima dos dois.
  const verde = passoSuave(VERDE_LIMIAR - MANCHA_MACIA, VERDE_LIMIAR + MANCHA_MACIA, interpolar(t, a, b, c, d, CAMPO.verde, fx, fy))
  const marrom = passoSuave(MARROM_LIMIAR - MANCHA_MACIA, MARROM_LIMIAR + MANCHA_MACIA, interpolar(t, a, b, c, d, CAMPO.marrom, fx, fy))
  let cor = misturar(misturar(AREIA, VERDE, verde), MARROM, marrom)
  // A poeira, em manchas largas e fracas.
  cor = misturar(cor, POEIRA, passoSuave(0.55, 0.9, interpolar(t, a, b, c, d, CAMPO.poeira, fx, fy) * 0.5 + 0.5) * 0.3)
  // As dobras e a trama.
  cor = luz(cor, interpolar(t, a, b, c, d, CAMPO.dobra, fx, fy) * DOBRA_LUZ + trama(uu, vv))
  return empacotar(cor)
}
