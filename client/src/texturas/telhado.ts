/**
 * TEXTURA DO TELHADO da Sala: telha colonial ou madeira em tábuas, pintada
 * na CPU a partir das águas (`lib/telhado/aguas.ts`). Puro, sem canvas: o
 * teste mede os pixels de verdade, e quem desenha (o protótipo hoje, o
 * renderer do app na Fase 3) só põe estes bytes numa imagem, UMA vez por
 * sala e por troca de modelo ou cor. A imagem pronta é que some e volta.
 *
 * - Telha colonial: fileiras paralelas ao beiral (a fileira vem da altura),
 *   cada telha curva (capa e canal, da posição ao longo da borda) e sombra
 *   embaixo de cada fileira. A ponta da capa avança sobre a fileira de baixo:
 *   a borda da fileira fica ondulada em vez de um risco reto, que viraria
 *   hachura no zoom normal.
 * - Madeira: tábuas que descem da cumeeira ao beiral, largura sorteada por
 *   hash, veio fraco, fresta escura entre elas e emenda de topo de vez em quando.
 * - Palha (Meio-Termo, MT6): fileiras paralelas ao beiral cuja borda é a
 *   espinha de peixe (um V a cada `PASSO_DA_ESPINHA_PX`, bico para a
 *   cumeeira). A borda não é reta: uma onda sutil (`ondaDoFioDaPalha`) e a
 *   deriva do bico com a altura tiram o risco e a grade (regra do estilo: sem
 *   hachura). Cada metade do V pega a luz de um lado, os fios descem inclinados
 *   e a ponta do beiral é franjada (a borda da imagem avança e recua).
 * - Luz por água vinda de cima à esquerda (como o protótipo de 18/10), cumeeira
 *   e espigão um pouco mais claros, rincão e ponta do beiral mais escuros.
 *
 * A cor pedida é o tom da água em luz neutra; claro e escuro saem dela pela
 * mesma conta (cor livre também). Mesma entrada, mesmos bytes: nada de
 * `Math.random`, todo sorteio é `hash` de `texturas/ruido.ts`.
 *
 * Custo (meta: sala de 1024 × 1024 em até 50 ms). A água só é calculada nas
 * pontas de cada bloco de `BLOCO_PX` pixels: no meio o plano é o mesmo, e a
 * altura e a régua andam por soma. Perto de emenda, de parede ou com donas
 * diferentes nas pontas, o bloco volta à conta pixel a pixel. Seno, cosseno e
 * os sorteios do desenho são tabela ou memória curta (`MEMORIA`).
 */

import {
  amostrarAgua,
  BEIRAL_PX,
  cruzamentosDaLinha,
  novaAmostraDaAgua,
  prepararAguas,
  type AmostraDaAgua,
  type GeometriaDasAguas,
  type PontoDoTelhado,
} from '../lib/telhado/aguas'
import { corDoTetoOuPadrao, type ModeloDoTeto } from '../lib/telhado/paletas'
import { hash, passoSuave, rgb } from './ruido'

/** Comprimento de uma fileira de telha, em px do mapa (4 fileiras por casa de 40 px). */
export const CURSO_DA_TELHA_PX = 10
/** Largura de uma telha (capa + canal). Menos que isso a ondulação vira listra fina. */
export const LARGURA_DA_TELHA_PX = 13
/** Largura média da tábua; cada uma sorteia entre metade e uma vez e meia disso. */
export const LARGURA_DA_TABUA_PX = 15
/** Teto de pixels de uma imagem (16 MB de RGBA): sala enorme numa tela densa perde nitidez em vez de travar. */
export const MAXIMO_DE_PIXELS_DO_TELHADO = 2048 * 2048
const ESCALA_MAXIMA = 4

/** De onde vem a luz, no plano do mapa: cima à esquerda, um tanto mais da esquerda (oeste > norte > sul > leste, como em 18/10). */
const LUZ_X = -1 / Math.hypot(1, 0.45)
const LUZ_Y = -0.45 / Math.hypot(1, 0.45)
/** Quanto a luz muda de uma água para outra. */
const FORCA_DA_LUZ_NA_AGUA = 0.15
/** Parte somada (não multiplicada) da luz: telhado preto ainda mostra a forma. */
const LUZ_SOMADA = 24

/** Pixels da imagem por bloco: a água é calculada nas duas pontas, o meio anda por soma. */
const BLOCO_PX = 16
/** Largura da cumeeira clara (px do mapa a partir da emenda): o bloco rápido fica longe dela. */
const FAIXA_DA_CUMEEIRA_PX = 2.4

/** Altura de uma fileira de palha, do beiral para a cumeeira (px do mapa). */
export const CURSO_DA_PALHA_PX = 7
/** Largura de um V da espinha de peixe ao longo do beiral (px do mapa). */
export const PASSO_DA_ESPINHA_PX = 12
/** Quanto o bico do V sobe para a cumeeira (px do mapa): braço com inclinação de 0,53, o V ainda lê com a onda por cima. */
const ALTURA_DA_ESPINHA_PX = 3.2

const TAU = Math.PI * 2
const SEMENTE_DA_TELHA = 7103
const SEMENTE_DA_TABUA = 9241
const SEMENTE_DO_GRAO = 3313
const SEMENTE_DA_PALHA = 5527

// ---------- tabelas (montadas uma vez, na importação) ----------

const PASSOS_DO_PERFIL = 256
/** Cosseno e seno ao longo de uma telha (capa no 0, canal no meio). */
const PERFIL_COS = new Float64Array(PASSOS_DO_PERFIL)
const PERFIL_SEN = new Float64Array(PASSOS_DO_PERFIL)
/** Luz ao longo de uma fileira: a beira de baixo pega luz, o alto fica na sombra da fileira de cima. */
const LUZ_NA_FILEIRA = new Float64Array(PASSOS_DO_PERFIL)
for (let i = 0; i < PASSOS_DO_PERFIL; i += 1) {
  const f = (i + 0.5) / PASSOS_DO_PERFIL
  PERFIL_COS[i] = Math.cos(f * TAU)
  PERFIL_SEN[i] = Math.sin(f * TAU)
  LUZ_NA_FILEIRA[i] = -0.18 * passoSuave(0.6, 1, f) + 0.045 * (1 - passoSuave(0, 0.18, f))
}
/**
 * Luz ao longo de uma fileira de palha (0 = a ponta dos fios, perto do
 * beiral; 1 = embaixo da fileira de cima): a ponta pega luz e a sombra da
 * fileira de cima escurece AOS POUCOS (meia fileira de rampa), sem risco fino.
 */
const LUZ_NA_FILEIRA_DA_PALHA = new Float64Array(PASSOS_DO_PERFIL)
for (let i = 0; i < PASSOS_DO_PERFIL; i += 1) {
  const f = (i + 0.5) / PASSOS_DO_PERFIL
  LUZ_NA_FILEIRA_DA_PALHA[i] = -0.2 * passoSuave(0.5, 1, f) + 0.07 * (1 - passoSuave(0, 0.22, f))
}

const PASSOS_DO_SENO = 1024
const SENO = new Float64Array(PASSOS_DO_SENO)
for (let i = 0; i < PASSOS_DO_SENO; i += 1) SENO[i] = Math.sin(((i + 0.5) / PASSOS_DO_SENO) * TAU)
const SENO_POR_RADIANO = PASSOS_DO_SENO / TAU
/** Seno de tabela (1024 passos): para o veio, que tem 3,5 % de força, sobra precisão. */
function seno(x: number): number {
  return SENO[((x * SENO_POR_RADIANO) | 0) & (PASSOS_DO_SENO - 1)]
}

/** Grão fininho, meio px do mapa por célula; repete a cada 32 px, invisível a 3 % de força. */
const LADO_DO_GRAO = 64
const GRAO = new Float64Array(LADO_DO_GRAO * LADO_DO_GRAO)
for (let y = 0; y < LADO_DO_GRAO; y += 1) {
  for (let x = 0; x < LADO_DO_GRAO; x += 1) GRAO[y * LADO_DO_GRAO + x] = (hash(x, y, SEMENTE_DO_GRAO) - 0.5) * 0.03
}

/*
 * Memória curta dos sorteios: pixels vizinhos caem na mesma telha ou tábua.
 * Num Float64Array, e não em `let` do módulo: número quebrado guardado em
 * variável de módulo aloca a cada escrita. Só lembra, não muda o resultado.
 */
const MEMORIA = new Float64Array(16)
const M_COLUNA = 0
const M_FILEIRA = 1
const M_TOM_DA_TELHA = 2
const M_J0 = 3
const M_B0 = 4
const M_B1 = 5
const M_TABUA = 6
const M_COMPRIMENTO = 7
const M_DESLOCAMENTO = 8
const M_TABUA_DO_PEDACO = 9
const M_PEDACO = 10
const M_SORTEIO = 11
const M_COLUNA_DA_PALHA = 12
const M_FILEIRA_DA_PALHA = 13
const M_TOM_DA_PALHA = 14
const M_FASE_DA_PALHA = 15

function esquecer(): void {
  MEMORIA.fill(Number.NaN)
}

export interface ImagemDoTelhado {
  /** Largura e altura da imagem, em pixels (px do mapa × escala). */
  readonly largura: number
  readonly altura: number
  /** Canto de cima à esquerda da imagem, em px do mapa. */
  readonly origemX: number
  readonly origemY: number
  /** Pixels da imagem por px do mapa (a escala usada de fato, já limitada). */
  readonly escala: number
  /** RGBA sem pré-multiplicar, linha a linha (o formato do `ImageData`). Fora do telhado = 0. */
  readonly pixels: Uint8ClampedArray
}

/**
 * A escala usada de fato: inválida vira 1, passa de 4 é cortada, e a imagem
 * nunca passa de `MAXIMO_DE_PIXELS_DO_TELHADO`.
 */
export function escalaDoTelhado(larguraMundo: number, alturaMundo: number, escala: number): number {
  let k = Number.isFinite(escala) && escala > 0 ? Math.min(escala, ESCALA_MAXIMA) : 1
  const cabe = (e: number) => Math.ceil(larguraMundo * e) * Math.ceil(alturaMundo * e) <= MAXIMO_DE_PIXELS_DO_TELHADO
  if (!cabe(k)) {
    k = Math.sqrt(MAXIMO_DE_PIXELS_DO_TELHADO / (larguraMundo * alturaMundo))
    while (k > 0.01 && !cabe(k)) k *= 0.99
  }
  return k
}

// ---------- desenho ----------

/**
 * Telha colonial no ponto: `v` = altura (0 na ponta do beiral), `u` = régua
 * ao longo da borda, `luzAoLongo` = o quanto a luz corre ao longo da borda
 * (acende o lado da telha virado para ela). Devolve a variação de luz.
 */
function luzDaTelha(v: number, u: number, luzAoLongo: number): number {
  const ru = u / LARGURA_DA_TELHA_PX
  const coluna = Math.floor(ru)
  const i = ((ru - coluna) * PASSOS_DO_PERFIL) | 0
  // 1 no alto da capa, 0 no fundo do canal.
  const crista = 0.5 + 0.5 * PERFIL_COS[i]
  // A ponta da capa avança 1,5 px sobre a fileira de baixo: borda ondulada.
  const rv = (v + 1.5 * crista) / CURSO_DA_TELHA_PX
  const fileira = Math.floor(rv)
  const m = MEMORIA
  if (m[M_COLUNA] !== coluna || m[M_FILEIRA] !== fileira) {
    m[M_COLUNA] = coluna
    m[M_FILEIRA] = fileira
    m[M_TOM_DA_TELHA] = (hash(coluna, fileira, SEMENTE_DA_TELHA) - 0.5) * 0.1 // cada telha um tom
  }
  return (
    0.05 + // devolve a média para perto do tom escolhido (sombra e canal escurecem em média)
    PERFIL_SEN[i] * luzAoLongo * 0.14 - // o lado da telha virado para a luz
    (1 - crista) * 0.09 + // o canal é mais fundo
    LUZ_NA_FILEIRA[((rv - fileira) * PASSOS_DO_PERFIL) | 0] +
    m[M_TOM_DA_TELHA]
  )
}

function bordaDaTabua(j: number): number {
  return j * LARGURA_DA_TABUA_PX + (hash(j, 0, SEMENTE_DA_TABUA) - 0.5) * LARGURA_DA_TABUA_PX * 0.5
}

/** De 0 (em `a` ou antes) a 1 (em `b` ou depois), com `1 / (b − a)` já feito. */
function rampa(a: number, inverso: number, t: number): number {
  const x = (t - a) * inverso
  if (x <= 0) return 0
  if (x >= 1) return 1
  return x * x * (3 - 2 * x)
}

/** Madeira em tábuas no ponto (mesmos `v` e `u` da telha). Devolve a variação de luz. */
function luzDaMadeira(v: number, u: number, luzAoLongo: number): number {
  const m = MEMORIA
  const j0 = Math.floor(u / LARGURA_DA_TABUA_PX)
  if (m[M_J0] !== j0) {
    m[M_J0] = j0
    m[M_B0] = bordaDaTabua(j0)
    m[M_B1] = bordaDaTabua(j0 + 1)
  }
  const b0 = m[M_B0]
  const b1 = m[M_B1]
  let j = j0
  let inicio = b0
  let fim = b1
  if (u < b0) {
    j = j0 - 1
    inicio = bordaDaTabua(j)
    fim = b0
  } else if (u >= b1) {
    j = j0 + 1
    inicio = b1
    fim = bordaDaTabua(j0 + 2)
  }
  const naTabua = u - inicio
  const ateFim = fim - u
  if (m[M_TABUA] !== j) {
    // Tábua comprida: um pedaço de 110 a 200 px, com a emenda de topo em lugar sorteado.
    m[M_TABUA] = j
    m[M_COMPRIMENTO] = 110 + hash(j, 1, SEMENTE_DA_TABUA) * 90
    m[M_DESLOCAMENTO] = hash(j, 2, SEMENTE_DA_TABUA)
  }
  const comprimento = m[M_COMPRIMENTO]
  const sv = v / comprimento + m[M_DESLOCAMENTO]
  const pedaco = Math.floor(sv)
  const noPedaco = sv - pedaco
  const ateTopo = (noPedaco < 0.5 ? noPedaco : 1 - noPedaco) * comprimento
  if (m[M_TABUA_DO_PEDACO] !== j || m[M_PEDACO] !== pedaco) {
    m[M_TABUA_DO_PEDACO] = j
    m[M_PEDACO] = pedaco
    m[M_SORTEIO] = hash(j, pedaco, SEMENTE_DA_TABUA + 3)
  }
  const sorteio = m[M_SORTEIO]
  const fase = sorteio * TAU
  let luz =
    0.025 + // devolve a média ao tom escolhido (a fresta escurece em média)
    (sorteio - 0.5) * 0.16 + // cada tábua um tom
    seno(naTabua * 0.85 + seno(v * 0.04 + fase) * 1.8 + fase) * 0.035 + // veio
    seno(v * 0.02 + fase * 1.7) * 0.03 // mancha comprida
  // Beira arredondada e fresta só existem a menos de 2,2 px da borda da tábua (o resto da conta dá zero).
  if (naTabua < 2.2 || ateFim < 2.2) {
    luz += luzAoLongo * 0.05 * (rampa(0.8, 1 / 1.4, naTabua) - rampa(0.8, 1 / 1.4, ateFim))
    luz -= 0.32 * (1 - rampa(0.2, 1 / 0.8, naTabua < ateFim ? naTabua : ateFim)) // fresta entre tábuas
  }
  if (ateTopo < 0.8) luz -= 0.2 * (1 - rampa(0.15, 1 / 0.65, ateTopo)) // emenda de topo
  return luz
}

/** O bico do V anda ao longo do beiral conforme a altura: as colunas da espinha não se alinham de fileira em fileira. */
function derivaDaEspinha(v: number): number {
  return 1.6 * seno(v * 0.19 + 1.1)
}

/**
 * A ONDA do fio da palha no ponto (px do mapa, somada à altura): dois senos de
 * passo diferente ao longo do beiral, com fase que muda com a altura, então
 * cada fileira ondula de um jeito. Até 0,85 px: sutil, só tira o risco reto.
 */
export function ondaDoFioDaPalha(u: number, v: number): number {
  return 0.55 * seno(u * 0.47 + v * 0.61 + 0.4) + 0.3 * seno(u * 1.13 - v * 0.37 + 2.2)
}

const DOBRO_DA_ALTURA_DA_ESPINHA = 2 * ALTURA_DA_ESPINHA_PX
const INVERSO_DO_PASSO_DA_ESPINHA = 1 / PASSO_DA_ESPINHA_PX
const INVERSO_DO_CURSO_DA_PALHA = 1 / CURSO_DA_PALHA_PX
const MASCARA_DO_SENO = PASSOS_DO_SENO - 1

/** Altura do V da espinha na fração `fr` do passo (0 e 1 = fundo do V, 0,5 = bico). */
function alturaDaEspinha(fr: number): number {
  return fr < 0.5 ? DOBRO_DA_ALTURA_DA_ESPINHA * fr : DOBRO_DA_ALTURA_DA_ESPINHA * (1 - fr)
}

/**
 * Em que fileira de palha cai o ponto (`v` = altura desde a ponta do beiral,
 * `u` = régua ao longo da borda), com a parte quebrada: a borda da fileira `n`
 * passa onde esta conta vale `n`. Cresce com `v` em todo ponto (a derivada
 * fica acima de 0,38: 1 − 0,53 × 0,30 da deriva − 0,45 da onda), então cada
 * coluna cruza cada borda uma vez só.
 */
export function fileiraDaPalha(u: number, v: number): number {
  const q = (u + derivaDaEspinha(v)) * INVERSO_DO_PASSO_DA_ESPINHA
  return (v - alturaDaEspinha(q - Math.floor(q)) + ondaDoFioDaPalha(u, v)) * INVERSO_DO_CURSO_DA_PALHA
}

/** O máximo que a franja recua (px do mapa). */
const FRANJA_MAXIMA_PX = 1.6

/** A franja do beiral de palha: as pontas recuam de 0 a `FRANJA_MAXIMA_PX`, em meias-luas de 4,6 px com onda. */
function franjaDaPalha(u: number): number {
  return 0.8 + 0.8 * seno(u * (TAU / 4.6) + 0.9 * seno(u * 0.83))
}

/*
 * Fases da palha já em passos da tabela do seno (o ângulo × `SENO_POR_RADIANO`):
 * a deriva do bico e as duas ondas do fio são senos de uma conta linear em `v`
 * e `u`, então a corrida (`pintarCorridaDaPalha`) anda nelas por soma, sem
 * multiplicar a cada pixel. Os números são os de `derivaDaEspinha` e
 * `ondaDoFioDaPalha`.
 */
const DERIVA_POR_V = 0.19 * SENO_POR_RADIANO
const DERIVA_NO_ZERO = 1.1 * SENO_POR_RADIANO
const ONDA1_POR_U = 0.47 * SENO_POR_RADIANO
const ONDA1_POR_V = 0.61 * SENO_POR_RADIANO
const ONDA1_NO_ZERO = 0.4 * SENO_POR_RADIANO
const ONDA2_POR_U = 1.13 * SENO_POR_RADIANO
const ONDA2_POR_V = -0.37 * SENO_POR_RADIANO
const ONDA2_NO_ZERO = 2.2 * SENO_POR_RADIANO

/**
 * Palha em espinha de peixe no ponto (mesmos `v` e `u` da telha). Devolve a
 * variação de luz. É a mesma conta de `fileiraDaPalha` (deriva, V e onda),
 * escrita por extenso com a tabela do seno para não depender do inline das
 * funções pequenas no laço por pixel.
 */
function luzDaPalha(v: number, u: number, luzAoLongo: number): number {
  return luzDaPalhaNasFases(
    v,
    u,
    luzAoLongo,
    derivaNaFase(v * DERIVA_POR_V + DERIVA_NO_ZERO),
    u * ONDA1_POR_U + v * ONDA1_POR_V + ONDA1_NO_ZERO,
    u * ONDA2_POR_U + v * ONDA2_POR_V + ONDA2_NO_ZERO,
  )
}

/** O quanto o bico do V anda ao longo do beiral (px do mapa), da fase da deriva em passos da tabela. */
function derivaNaFase(fase: number): number {
  return 1.6 * SENO[(fase | 0) & MASCARA_DO_SENO]
}

/** `luzDaPalha` com a deriva (px) e as fases das ondas (em passos da tabela) já calculadas. */
function luzDaPalhaNasFases(v: number, u: number, luzAoLongo: number, deriva: number, faseDaOnda1: number, faseDaOnda2: number): number {
  const ul = u + deriva
  const q = ul * INVERSO_DO_PASSO_DA_ESPINHA
  const coluna = Math.floor(q)
  const fr = q - coluna
  // Metade esquerda do V (sobe) ou direita (desce): cada uma pega a luz de um lado, como a telha.
  const sobe = fr < 0.5
  const braco = sobe ? 1 : -1
  const onda = 0.55 * SENO[(faseDaOnda1 | 0) & MASCARA_DO_SENO] + 0.3 * SENO[(faseDaOnda2 | 0) & MASCARA_DO_SENO]
  const s = (v - (sobe ? DOBRO_DA_ALTURA_DA_ESPINHA * fr : DOBRO_DA_ALTURA_DA_ESPINHA * (1 - fr)) + onda) * INVERSO_DO_CURSO_DA_PALHA
  const fileira = Math.floor(s)
  const m = MEMORIA
  if (m[M_COLUNA_DA_PALHA] !== coluna || m[M_FILEIRA_DA_PALHA] !== fileira) {
    m[M_COLUNA_DA_PALHA] = coluna
    m[M_FILEIRA_DA_PALHA] = fileira
    // Um sorteio só por feixe (o V entre duas bordas): o tom e a fase dos fios saem dele.
    const sorteio = hash(coluna, fileira, SEMENTE_DA_PALHA)
    // Cada feixe um tom, contido: com 0,09 os feixes viravam colunas de V ("tricô" a 3x, revisão de design da MT6).
    m[M_TOM_DA_PALHA] = (sorteio - 0.5) * 0.05
    m[M_FASE_DA_PALHA] = sorteio * TAU * 7
  }
  return (
    0.045 + // devolve a média ao tom escolhido (a sombra da fileira escurece em média)
    m[M_TOM_DA_PALHA] +
    LUZ_NA_FILEIRA_DA_PALHA[((s - fileira) * PASSOS_DO_PERFIL) | 0] +
    braco * luzAoLongo * 0.02 +
    // Os fios descem quase retos, um pouco inclinados para o lado do braço (a espinha), ~2 px entre um e outro:
    // o fio é que dá a textura, não o feixe (autocorrelação a 1 fileira, a 3x: 0,324 antes, meta <= 0,25).
    SENO[((((ul - braco * 0.15 * v) * 3.2 + m[M_FASE_DA_PALHA]) * SENO_POR_RADIANO) | 0) & MASCARA_DO_SENO] * 0.1
  )
}

// ---------- a imagem ----------

interface Pincel {
  readonly geo: GeometriaDasAguas
  readonly madeira: boolean
  readonly palha: boolean
  /** Média dos 3 canais da cor: para onde o claro da palha anda. */
  readonly neutro: number
  /**
   * Altura a partir da qual a franja não muda mais nada: a ponta escura acaba
   * (2,2 px) e a cobertura já é cheia (0,5 / k). Acima dela a franja nem é
   * calculada (os mesmos bytes, mais rápido).
   */
  readonly alcanceDaFranja: number
  readonly k: number
  readonly baseR: number
  readonly baseG: number
  readonly baseB: number
  readonly luzDaAgua: Float64Array
  readonly luzAoLongo: Float64Array
  readonly pixels: Uint8ClampedArray
}

function luzDoDesenho(pincel: Pincel, agua: number, v: number, u: number): number {
  return (
    pincel.luzDaAgua[agua] +
    (pincel.madeira
      ? luzDaMadeira(v, u, pincel.luzAoLongo[agua])
      : pincel.palha
        ? luzDaPalha(v, u, pincel.luzAoLongo[agua])
        : luzDaTelha(v, u, pincel.luzAoLongo[agua]))
  )
}

/** Pinta um pixel. `ate` = px do mapa até a emenda com `vizinha` (Infinity = longe de emenda). */
function pintarPixel(
  pincel: Pincel,
  o: number,
  x: number,
  y: number,
  agua: number,
  v: number,
  u: number,
  vizinha: number,
  ate: number,
  rincao: boolean,
): void {
  let luz = luzDoDesenho(pincel, agua, v, u)
  if (vizinha >= 0 && ate < FAIXA_DA_CUMEEIRA_PX) {
    const k = pincel.k
    if (ate * k < 0.5) {
      // Na emenda o pixel mistura as duas águas pela área que cada uma cobre: espigão sem serrilha.
      const g = pincel.geo
      const peso = 0.5 + ate * k
      const outra = luzDoDesenho(pincel, vizinha, g.s[vizinha] + BEIRAL_PX, g.t[vizinha] + g.regua[vizinha])
      luz = luz * peso + outra * (1 - peso)
    }
    if (rincao) luz -= 0.12 * (1 - passoSuave(0.4, 1.7, ate))
    else luz += 0.1 * (1 - passoSuave(0.9, FAIXA_DA_CUMEEIRA_PX, ate))
  }
  // Na palha a ponta do beiral é a franja: a borda recua conforme a régua.
  const vb = pincel.palha && v < pincel.alcanceDaFranja ? v - franjaDaPalha(u) : v
  if (vb < 2.2) luz -= 0.3 * (1 - passoSuave(0, 2.2, vb)) // ponta do beiral escura
  luz += GRAO[(Math.floor(y * 2) & (LADO_DO_GRAO - 1)) * LADO_DO_GRAO + (Math.floor(x * 2) & (LADO_DO_GRAO - 1))]
  const p = pincel.pixels
  if (pincel.palha) {
    // A palha clareia para o neutro (ponta queimada de sol): o claro não fica mais amarelo que a cor
    // escolhida; o escuro é o de sempre. Sem `if` no sinal da luz (é sorteado pixel a pixel): max e min.
    const escuro = Math.min(luz, 0)
    const d = LUZ_SOMADA * escuro + Math.max(luz, 0) * (pincel.neutro + LUZ_SOMADA)
    p[o] = pincel.baseR * (1 + escuro) + d
    p[o + 1] = pincel.baseG * (1 + escuro) + d
    p[o + 2] = pincel.baseB * (1 + escuro) + d
  } else {
    const somada = LUZ_SOMADA * luz
    p[o] = pincel.baseR * (1 + luz) + somada
    p[o + 1] = pincel.baseG * (1 + luz) + somada
    p[o + 2] = pincel.baseB * (1 + luz) + somada
  }
  const cobertura = vb * pincel.k + 0.5
  p[o + 3] = cobertura >= 1 ? 255 : cobertura * 255
}

/**
 * Uma corrida de `quantos` pixels da mesma água, longe de emenda: a altura e
 * a régua andam por soma (`passoV`, `passoU` por pixel). Dá o mesmo que
 * `pintarPixel` um a um, sem a conta da emenda e numa chamada só.
 */
function pintarCorrida(
  pincel: Pincel,
  o: number,
  x: number,
  y: number,
  passo: number,
  agua: number,
  v: number,
  u: number,
  passoV: number,
  passoU: number,
  quantos: number,
): void {
  const p = pincel.pixels
  const { baseR, baseG, baseB, k, madeira } = pincel
  const luzDaAgua = pincel.luzDaAgua[agua]
  const luzAoLongo = pincel.luzAoLongo[agua]
  const linhaDoGrao = (Math.floor(y * 2) & (LADO_DO_GRAO - 1)) * LADO_DO_GRAO
  let gx = x * 2
  const passoDoGrao = passo * 2
  for (let i = 0; i < quantos; i += 1, o += 4) {
    let luz = luzDaAgua + (madeira ? luzDaMadeira(v, u, luzAoLongo) : luzDaTelha(v, u, luzAoLongo))
    if (v < 2.2) luz -= 0.3 * (1 - passoSuave(0, 2.2, v)) // ponta do beiral escura
    luz += GRAO[linhaDoGrao + (Math.floor(gx) & (LADO_DO_GRAO - 1))]
    const somada = LUZ_SOMADA * luz
    p[o] = baseR * (1 + luz) + somada
    p[o + 1] = baseG * (1 + luz) + somada
    p[o + 2] = baseB * (1 + luz) + somada
    const cobertura = v * k + 0.5
    p[o + 3] = cobertura >= 1 ? 255 : cobertura * 255
    v += passoV
    u += passoU
    gx += passoDoGrao
  }
}

/**
 * A corrida da PALHA (a de telha e madeira, `pintarCorrida`, é a de antes da
 * MT6, byte a byte e no tempo). As fases da deriva e das ondas andam por soma;
 * a franja só é olhada perto do beiral; o claro vai para o neutro.
 */
function pintarCorridaDaPalha(
  pincel: Pincel,
  o: number,
  x: number,
  y: number,
  passo: number,
  agua: number,
  v: number,
  u: number,
  passoV: number,
  passoU: number,
  quantos: number,
): void {
  const p = pincel.pixels
  const { baseR, baseG, baseB, k, alcanceDaFranja } = pincel
  const claro = pincel.neutro + LUZ_SOMADA
  const luzDaAgua = pincel.luzDaAgua[agua]
  const luzAoLongo = pincel.luzAoLongo[agua]
  const linhaDoGrao = (Math.floor(y * 2) & (LADO_DO_GRAO - 1)) * LADO_DO_GRAO
  let gx = x * 2
  const passoDoGrao = passo * 2
  let faseDaDeriva = v * DERIVA_POR_V + DERIVA_NO_ZERO
  let faseDaOnda1 = u * ONDA1_POR_U + v * ONDA1_POR_V + ONDA1_NO_ZERO
  let faseDaOnda2 = u * ONDA2_POR_U + v * ONDA2_POR_V + ONDA2_NO_ZERO
  const passoDaDeriva = passoV * DERIVA_POR_V
  const passoDaOnda1 = passoU * ONDA1_POR_U + passoV * ONDA1_POR_V
  const passoDaOnda2 = passoU * ONDA2_POR_U + passoV * ONDA2_POR_V
  // Água de beiral deitado ou em pé (régua ao longo de x ou de y): numa delas a altura não muda na corrida e a deriva é uma só.
  const derivaFixa = passoV === 0 ? derivaNaFase(faseDaDeriva) : Number.NaN
  for (let i = 0; i < quantos; i += 1, o += 4) {
    const deriva = passoV === 0 ? derivaFixa : derivaNaFase(faseDaDeriva)
    let luz = luzDaAgua + luzDaPalhaNasFases(v, u, luzAoLongo, deriva, faseDaOnda1, faseDaOnda2)
    const vb = v < alcanceDaFranja ? v - franjaDaPalha(u) : v
    if (vb < 2.2) luz -= 0.3 * (1 - passoSuave(0, 2.2, vb)) // ponta do beiral escura
    luz += GRAO[linhaDoGrao + (Math.floor(gx) & (LADO_DO_GRAO - 1))]
    // O claro da palha vai para o neutro, sem `if` no sinal da luz (como em `pintarPixel`).
    const escuro = Math.min(luz, 0)
    const d = LUZ_SOMADA * escuro + Math.max(luz, 0) * claro
    p[o] = baseR * (1 + escuro) + d
    p[o + 1] = baseG * (1 + escuro) + d
    p[o + 2] = baseB * (1 + escuro) + d
    const cobertura = vb * k + 0.5
    p[o + 3] = cobertura >= 1 ? 255 : cobertura * 255
    v += passoV
    u += passoU
    gx += passoDoGrao
    faseDaDeriva += passoDaDeriva
    faseDaOnda1 += passoDaOnda1
    faseDaOnda2 += passoDaOnda2
  }
}

function pintarDaAmostra(pincel: Pincel, o: number, x: number, y: number, a: AmostraDaAgua): void {
  pintarPixel(pincel, o, x, y, a.agua, a.dist + BEIRAL_PX, a.aoLongo + pincel.geo.regua[a.agua], a.vizinha, a.ateEmenda, a.rincao)
}

/**
 * Pinta o telhado do polígono (px do mapa) no modelo e na cor pedidos, em
 * `escala` pixels por px do mapa. Polígono quebrado: imagem vazia (0 × 0),
 * sem lançar. Cor inválida: a padrão do modelo. Modelo desconhecido: telhas.
 */
export function pintarTelhado(poligono: readonly PontoDoTelhado[], modelo: ModeloDoTeto, corHex: string, escala = 1): ImagemDoTelhado {
  const pintura = comecarTelhado(poligono, modelo, corHex, escala)
  pintura.pintarLinhas(Number.POSITIVE_INFINITY)
  return pintura.imagem
}

/** Um telhado sendo pintado aos poucos: a imagem já existe (vazia) e cada chamada pinta mais linhas. */
export interface PinturaDoTelhado {
  readonly imagem: ImagemDoTelhado
  /** Pinta até `quantas` linhas a mais (de cima para baixo). Devolve `true` quando a imagem está pronta. */
  pintarLinhas: (quantas: number) => boolean
}

interface EstadoDaPintura {
  readonly geo: GeometriaDasAguas
  readonly pincel: Pincel
  readonly ponta: AmostraDaAgua
  readonly outraPonta: AmostraDaAgua
  readonly cruzamentos: Float64Array
  readonly origemX: number
  readonly origemY: number
  readonly largura: number
  readonly passo: number
  readonly alcance: number
  readonly folgaDoBloco: number
}

/**
 * `pintarTelhado` em pedaços (o renderer pinta a palha em fatias de 8 ms): os
 * mesmos bytes, pintando a imagem inteira de uma vez ou linha a linha.
 */
export function comecarTelhado(poligono: readonly PontoDoTelhado[], modelo: ModeloDoTeto, corHex: string, escala = 1): PinturaDoTelhado {
  const geo = prepararAguas(poligono)
  if (geo === null) {
    const vazia = { largura: 0, altura: 0, origemX: 0, origemY: 0, escala: escalaDoTelhado(1, 1, escala), pixels: new Uint8ClampedArray(0) }
    return { imagem: vazia, pintarLinhas: () => true }
  }
  const modeloUsado: ModeloDoTeto = modelo === 'madeira' || modelo === 'palha' ? modelo : 'telhas'
  const [baseR, baseG, baseB] = rgb(corDoTetoOuPadrao(modeloUsado, corHex))

  const margem = BEIRAL_PX + 1
  const origemX = Math.floor(geo.minX - margem)
  const origemY = Math.floor(geo.minY - margem)
  const larguraMundo = Math.ceil(geo.maxX + margem) - origemX
  const alturaMundo = Math.ceil(geo.maxY + margem) - origemY
  const k = escalaDoTelhado(larguraMundo, alturaMundo, escala)
  const largura = Math.ceil(larguraMundo * k)
  const altura = Math.ceil(alturaMundo * k)
  const pixels = new Uint8ClampedArray(largura * altura * 4)

  const n = geo.n
  const luzDaAgua = new Float64Array(n)
  const luzAoLongo = new Float64Array(n)
  for (let i = 0; i < n; i += 1) {
    // A água desce para fora (contra a normal de dentro); virada para a luz, clareia.
    luzDaAgua[i] = (-geo.nx[i] * LUZ_X - geo.ny[i] * LUZ_Y) * FORCA_DA_LUZ_NA_AGUA
    luzAoLongo[i] = geo.dx[i] * LUZ_X + geo.dy[i] * LUZ_Y
  }
  const pincel: Pincel = { geo, madeira: modeloUsado === 'madeira', palha: modeloUsado === 'palha', neutro: (baseR + baseG + baseB) / 3, alcanceDaFranja: FRANJA_MAXIMA_PX + Math.max(2.2, 0.5 / k), k, baseR, baseG, baseB, luzDaAgua, luzAoLongo, pixels }
  const passo = 1 / k
  const estado: EstadoDaPintura = {
    geo,
    pincel,
    ponta: novaAmostraDaAgua(),
    outraPonta: novaAmostraDaAgua(),
    cruzamentos: new Float64Array(n),
    origemX,
    origemY,
    largura,
    passo,
    // Meio pixel além do beiral, para a borda sair suavizada.
    alcance: BEIRAL_PX + 0.5 * passo,
    // Com a mesma dona e a mesma vizinha nas duas pontas, a distância até a emenda é linear ao longo do
    // bloco: as duas pontas longe da faixa da cumeeira bastam (1 px de folga para o arredondamento).
    folgaDoBloco: FAIXA_DA_CUMEEIRA_PX + 1,
  }
  const imagem: ImagemDoTelhado = { largura, altura, origemX, origemY, escala: k, pixels }
  let linha = 0
  return {
    imagem,
    pintarLinhas(quantas: number): boolean {
      const ate = Math.min(altura, linha + Math.max(1, quantas))
      if (linha < ate) {
        // A memória curta só lembra sorteios puros: outra pintura no meio não muda nada, mas começa limpa.
        esquecer()
        pintarAsLinhas(estado, linha, ate)
        linha = ate
      }
      return linha >= altura
    },
  }
}

/** Pinta as linhas `py0` (inclusive) a `py1` (exclusive) da imagem. */
function pintarAsLinhas(estado: EstadoDaPintura, py0: number, py1: number): void {
  const { geo, pincel, ponta, outraPonta, cruzamentos, origemX, origemY, largura, passo, alcance, folgaDoBloco } = estado
  const { k, palha } = pincel
  const { regua, nx, dx } = geo

  for (let py = py0; py < py1; py += 1) {
    const y = origemY + (py + 0.5) * passo
    const total = cruzamentosDaLinha(geo, y, cruzamentos)
    let proximo = 0
    let dentro = false
    let px0 = 0
    while (px0 < largura) {
      const x0 = origemX + (px0 + 0.5) * passo
      while (proximo < total && cruzamentos[proximo] <= x0) {
        dentro = !dentro
        proximo += 1
      }
      const temPonta = amostrarAgua(geo, x0, y, dentro, alcance, ponta)
      if (!temPonta) {
        // Fora do telhado: a distância até ele anda no máximo 1 px por px, então pula os vazios garantidos.
        const vazios = (-ponta.dist - alcance) * k
        px0 += Number.isFinite(vazios) && vazios > 1 ? Math.ceil(vazios) : 1
        continue
      }
      const px1 = Math.min(px0 + BLOCO_PX, largura) - 1
      const x1 = origemX + (px1 + 0.5) * passo
      const cruzaParede = proximo < total && cruzamentos[proximo] <= x1
      if (
        !cruzaParede &&
        temPonta &&
        ponta.ateEmenda >= folgaDoBloco &&
        amostrarAgua(geo, x1, y, dentro, alcance, outraPonta) &&
        outraPonta.agua === ponta.agua &&
        outraPonta.vizinha === ponta.vizinha &&
        outraPonta.ateEmenda >= folgaDoBloco
      ) {
        // Mesma água nas duas pontas e longe de emenda: o plano é um só, altura e régua andam por soma.
        const a = ponta.agua
        const o = (py * largura + px0) * 4
        if (palha) pintarCorridaDaPalha(pincel, o, x0, y, passo, a, ponta.dist + BEIRAL_PX, ponta.aoLongo + regua[a], nx[a] * passo, dx[a] * passo, px1 - px0 + 1)
        else pintarCorrida(pincel, o, x0, y, passo, a, ponta.dist + BEIRAL_PX, ponta.aoLongo + regua[a], nx[a] * passo, dx[a] * passo, px1 - px0 + 1)
        px0 = px1 + 1
        continue
      }
      // Bloco difícil (emenda, parede, beiral, donas diferentes): pixel a pixel.
      pintarDaAmostra(pincel, (py * largura + px0) * 4, x0, y, ponta)
      let dentroAqui = dentro
      let proximoAqui = proximo
      for (let px = px0 + 1; px <= px1; px += 1) {
        const x = origemX + (px + 0.5) * passo
        while (proximoAqui < total && cruzamentos[proximoAqui] <= x) {
          dentroAqui = !dentroAqui
          proximoAqui += 1
        }
        if (amostrarAgua(geo, x, y, dentroAqui, alcance, outraPonta)) pintarDaAmostra(pincel, (py * largura + px) * 4, x, y, outraPonta)
      }
      px0 = px1 + 1
    }
  }
}
