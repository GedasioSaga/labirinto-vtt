/**
 * FAROL de cima com volume (lote L17 de 14/11/2026, construção do grupo Cidade e porto): a torre de sinal da
 * barra do porto. O FUSTE redondo de alvenaria caiada que afina para cima, em quatro FAIXAS (cal, cor, cal, cor),
 * com a PORTA no pé (a frente do farol é o lado da porta) e duas JANELINHAS; no alto, a GALERIA de ferro com o
 * GUARDA-CORPO de balaústres, a LANTERNA de vidro em oito lados com a lente ACESA, e a CÚPULA da cor das faixas com
 * a bola de ferro no cocuruto. No pé, a PLATAFORMA de lajes em oito lados, o degrau da porta e um rolo de corda.
 *
 * De cima: os anéis do fuste (cal e cor) para fora da galeria, o anel escuro da galeria com o guarda-corpo, o
 * anel aceso da lantera em volta da cúpula, e a SOMBRA comprida para baixo à direita, que afina com o fuste e
 * termina na galeria e na cúpula. São o anel aceso, as faixas e a sombra que dizem "farol", e não torre nem alvo.
 * A luz que gira não tem animação no motor de objeto: a lente é pintada acesa (emissão) e a luz fica com a tabela
 * de luz dos objetos (`LUZ_DOS_OBJETOS`), como a do holofote.
 *
 * NA 3/4 (`tresQuartos.ts`; todo tampo tem a beirada `ESPESSURA_DO_FAROL`, a espessura do perfil):
 * - o fuste são FIADAS do chão à galeria, cada uma a casca da frente NA TELA de um anel um tico mais estreito que
 *   o de baixo (o fuste afina); a beira de cima de cada fiada, a parte do anel que fica para fora da de cima, é a
 *   peça dela, e é ela que dá a cor da faixa na frente (cal ou cor). O meio de cada beira fica num ponto da frente
 *   NA TELA que só a fiada dela contém; a galeria e o guarda-corpo, mais altos e largos, têm um furinho ali;
 * - a PORTA e as JANELAS saem um tico da parede (a peça de cada uma fica nesse tico), só quando estão na frente
 *   NA TELA (atrás do fuste, sumiriam, e a caixa esticada as pintaria por cima dele);
 * - depois do fuste: a galeria, o guarda-corpo do fundo, a lanterna (três tampos, cada um um décimo de px para o
 *   lado, com um pingo de vidro aceso), o guarda-corpo da frente, a cúpula em dois degraus e a bola.
 * Por isso o desenho lê `c.giro`. As alturas são em lados (o menor lado: a regra `peloMenorLado`).
 * Materiais: `pedra` (a plataforma), `faixa` (as faixas e a cúpula, pintadas) e `metal` (galeria, guarda-corpo,
 * caixilhos e bola). A cal, o vidro, a porta e a corda são fixos. Escreve `cena.corDoPiso` (o escuro da pedra).
 *
 * PEGADA SÓLIDA (para a colisão): o círculo do pé do fuste, `RAIO_DO_PE_DO_FAROL` do menor meio lado.
 */
import { hash, luz, type Rgb } from '../../ruido'
import { anel, caixa, dentroDe, menos, type Forma, type Ponto } from './formas'
import { contato, texturaDaClasse, type MaterialDaPeca, type Textura } from './motor'
import { G, materialDaPeca, type MontarMovel } from './contexto'
import {
  anguloDoDesenho,
  capsulaAfunilada,
  coluna,
  comMeioEm,
  deslocada,
  disco,
  doDesenho,
  esticadaAte,
  furada,
  naTela,
  pingo,
  poligonoRegular,
  quartosDoGiro,
  setor,
  solta,
} from './apoioDaCidadeEPorto'

/** A beirada de cada tampo do farol (px do protótipo): a altura de uma fiada do fuste. O perfil usa este valor. */
export const ESPESSURA_DO_FAROL = 0.16 * G
/** O raio do pé do fuste em fração do menor meio lado: a pegada sólida do farol. */
export const RAIO_DO_PE_DO_FAROL = 0.7

/** Raios em fração do menor meio lado. */
const PLATAFORMA = 0.97
const FUSTE_NO_PE = RAIO_DO_PE_DO_FAROL
const FUSTE_NO_ALTO = 0.4
const GALERIA = 0.545
const GRADE: readonly [number, number] = [0.505, 0.54]
const LANTERNA = 0.37
const CUPULA: readonly [number, number] = [0.29, 0.18]
const BOLA = 0.065
/** Até onde vai o clarão da lente (fração do menor meio lado) e a força dele na beira do vidro. */
const HALO = 0.5
const ALFA_DO_CLARAO = 0.5
/** As fiadas do fuste e as faixas (de baixo para cima: cal, cor, cal, cor). */
const FIADAS = 14
const FAIXAS = 4
/** A casca de cada fiada (px): só a cara de fora é vista. */
const CASCA = 5
/** Alturas em lados: a plataforma. O resto sai das fiadas (`ESPESSURA_DO_FAROL` cada). */
const ALTURA_DA_PLATAFORMA = 0.055
/** Os andares da lanterna e os degraus da cúpula, em espessuras acima da galeria. */
const ANDARES_DA_LANTERNA = 3
const CUPULA_EM: readonly [number, number] = [4, 4.6]
const BOLA_EM = 5.3
/** Os balaústres do guarda-corpo: quantos e quanto do passo cada um ocupa. */
const BALAUSTRES = 24
const CHEIO_DO_BALAUSTRE = 0.28
/** A porta: a meia abertura (rad), quanto sai da parede (px) e a altura (em fiadas). As janelas: fiada e meia abertura. */
const MEIA_PORTA = 0.17
const PORTA_SAI = 2
const FIADAS_DA_PORTA = 2.3
const JANELAS: readonly number[] = [4.6, 8.6]
const MEIA_JANELA = 0.1
const JANELA_SAI = 1
/** O ângulo NA TELA dos pingos das fiadas (rad): na frente, à direita da porta e das janelas. */
const PINGOS_EM = (50 * Math.PI) / 180
/** A sombra: quanto anda por px de altura (para baixo à direita NA TELA), a borda e a força. */
const SOMBRA_POR_ALTURA: readonly [number, number] = [0.27, 0.21]
const FORCA_DA_SOMBRA = 0.32
/** As caixas esticadas: a vez de cada parte na 3/4 (em fração do menor meio lado, todas além da plataforma). */
const VEZ_DAS_FIADAS = 0.975
const VEZ_DA_PORTA = 0.977
const VEZ_DA_GALERIA = 0.979
const VEZ_DA_GRADE_DO_FUNDO = 0.981
const VEZ_DA_LANTERNA = 0.983
const VEZ_DA_GRADE_DA_FRENTE = 0.987
const VEZ_DA_CUPULA = 0.989

/** A cal do fuste, branca quente, e o escuro da pedra. */
const CAL: MaterialDaPeca = { classe: 'pedra', rgb: [0xe0, 0xd9, 0xc9] }
const ESCURO_DA_PEDRA: Rgb = [0x45, 0x43, 0x40]
/** A porta (madeira pintada de verde-escuro, como as de cais) e o vidro das janelas. */
const PORTA: MaterialDaPeca = { classe: 'madeira', rgb: [0x3e, 0x55, 0x4c] }
const VIDRO_ESCURO: MaterialDaPeca = { classe: 'liso', rgb: [0x3a, 0x45, 0x4b] }
/**
 * O vidro aceso visto de frente na 3/4: a frente sai no tom do material x 0,74 (`TOM_DA_FRENTE`), sem emissão.
 * O tom passa de 255 de propósito, para a frente da lanterna sair clara e quente como o anel de cima.
 */
const VIDRO_ACESO_NA_FRENTE: MaterialDaPeca = { classe: 'liso', rgb: [338, 318, 262] }
/** O vidro aceso de cima: o miolo branco quente e a beira creme, toda emissão. */
const MIOLO_ACESO: Rgb = [0xff, 0xf8, 0xe4]
const BEIRA_ACESA: Rgb = [0xf6, 0xd9, 0x9a]
const CORDA = materialDaPeca('corda')
const DA_PEDRA = texturaDaClasse('pedra')

/** A tinta da faixa: o tom do material escolhido, com a textura da pedra (é parede pintada, não pano). */
function pintada(m: MaterialDaPeca): MaterialDaPeca {
  return { classe: 'pedra', rgb: m.rgb }
}

/** A casca da frente NA TELA do anel de raio `r1` (e um pouco dos lados): a de trás some atrás do fuste. */
function cascaDaFrente(r1: number, quartos: number): Forma {
  const r0 = r1 - CASCA
  const corte = -0.25 * r1
  const [p, q] = [doDesenho(-r1, corte, quartos), doDesenho(r1, r1, quartos)]
  return {
    b: [Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.max(p[0], q[0]), Math.max(p[1], q[1])],
    d(x, y) {
      const r = Math.sqrt(x * x + y * y)
      return Math.max(r - r1, r0 - r, corte - naTela(x, y, quartos)[1])
    },
  }
}

/** Os balaústres do guarda-corpo de r0 a r1, só os do fundo NA TELA (`lado` -1) ou só os da frente (1). */
function balaustres(r0: number, r1: number, quartos: number, lado: -1 | 1): Forma {
  const passo = (2 * Math.PI) / BALAUSTRES
  const meia = (passo * CHEIO_DO_BALAUSTRE) / 2
  return {
    b: [-r1 - 1, -r1 - 1, r1 + 1, r1 + 1],
    d(x, y) {
      const r = Math.sqrt(x * x + y * y)
      const t = (Math.atan2(y, x) - passo / 2) / passo
      const fora = (Math.abs(t - Math.round(t)) * passo - meia) * r
      return Math.max(r - r1, r0 - r, fora, -lado * naTela(x, y, quartos)[1])
    },
  }
}

/** O lado do fuste NA TELA: claro em cima à esquerda (de onde vem a luz), escuro embaixo à direita. */
function texDoCone(r: number, quartos: number, forca: number, base: Textura | null): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (base !== null) base(u, v, x, y, p, s, escala)
    const [tx, ty] = naTela(x, y, quartos)
    s[3] -= (forca * (tx * 0.62 + ty * 0.78)) / r
  }
}

/** As lajes da plataforma: setores e anéis desencontrados, cada laje com o seu tom e a junta escura. */
function texDasLajes(R: number): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (DA_PEDRA !== null) DA_PEDRA(u, v, x, y, p, s, escala)
    const r = Math.sqrt(x * x + y * y) / R
    const anelDaLaje = Math.floor((r - 0.7) / 0.14)
    const passo = (2 * Math.PI) / (12 + 4 * anelDaLaje)
    const t = (Math.atan2(y, x) + (anelDaLaje % 2) * passo * 0.5) / passo
    const setorDaLaje = Math.floor(t)
    const juntaDeLado = Math.abs(t - Math.round(t)) * passo * r * R
    const juntaDeAnel = Math.abs((r - 0.7) / 0.14 - Math.round((r - 0.7) / 0.14)) * 0.14 * R
    s[3] += (hash(setorDaLaje, anelDaLaje, 9501) - 0.5) * 0.14
    const junta = Math.min(juntaDeLado, juntaDeAnel)
    if (junta < 0.9) s[3] -= 0.32 * (1 - junta / 0.9)
  }
}

/** O vidro aceso de cima: do miolo branco à beira creme, emissão inteira. */
function texDoVidroAceso(raio: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const t = Math.min(1, Math.sqrt(x * x + y * y) / raio)
    const k = t * t
    s[0] = MIOLO_ACESO[0] + (BEIRA_ACESA[0] - MIOLO_ACESO[0]) * k
    s[1] = MIOLO_ACESO[1] + (BEIRA_ACESA[1] - MIOLO_ACESO[1]) * k
    s[2] = MIOLO_ACESO[2] + (BEIRA_ACESA[2] - MIOLO_ACESO[2]) * k
    s[4] = 1
  }
}

/** O clarão em volta da lanterna: o creme aceso, com o alfa caindo da beira do vidro para fora. */
function texDoClarao(r0: number, r1: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const t = Math.min(1, Math.max(0, (Math.sqrt(x * x + y * y) - r0) / (r1 - r0)))
    s[0] = BEIRA_ACESA[0]
    s[1] = BEIRA_ACESA[1]
    s[2] = BEIRA_ACESA[2]
    s[4] = 1
    s[5] = ALFA_DO_CLARAO * (1 - t) * (1 - t)
  }
}

export const montarFarol: MontarMovel = (c, cena) => {
  const P = c.peca
  const R = Math.min(c.hw, c.hh)
  const lado = 2 * R
  const e = ESPESSURA_DO_FAROL
  const quartos = quartosDoGiro(c.giro)
  const L = cena.partes
  const S = cena.sombras
  cena.corDoPiso = ESCURO_DA_PEDRA
  const f = (v: number): number => v * R
  const pedra = c.m.pedra
  const faixa = pintada(c.m.faixa)
  const metal = c.m.metal
  const zPlataforma = ALTURA_DA_PLATAFORMA * lado
  const zGaleria = zPlataforma + FIADAS * e
  const zTopo = zGaleria + BOLA_EM * e
  const vez = (k: number): number => f(k)
  const daTela = (x: number, y: number): Ponto => doDesenho(x, y, quartos)
  const naFrente = (x: number, y: number): boolean => naTela(x, y, quartos)[1] > 0.3 * Math.hypot(x, y)
  /** O ponto a `px` de altura, levado pela sombra para baixo à direita NA TELA. */
  const sombraEm = (z: number): Ponto => daTela(SOMBRA_POR_ALTURA[0] * z, SOMBRA_POR_ALTURA[1] * z)

  // ---------- as fiadas: os raios (o fuste afina) e o pingo de cada beira ----------
  const raioDaFiada = (k: number): number => f(FUSTE_NO_PE + ((FUSTE_NO_ALTO - FUSTE_NO_PE) * k) / FIADAS)
  const anguloDosPingos = anguloDoDesenho(PINGOS_EM, quartos)
  const pingos: Ponto[] = Array.from({ length: FIADAS }, (_, k) => {
    const meio = (raioDaFiada(k) + raioDaFiada(k + 1)) / 2
    return [Math.cos(anguloDosPingos) * meio, Math.sin(anguloDosPingos) * meio]
  })
  /** Os pingos que ficam debaixo da galeria: a galeria e o guarda-corpo têm um furinho em cada um. */
  const debaixoDaGaleria = pingos.filter(([x, y]) => Math.hypot(x, y) < f(GALERIA) + 1)

  // ---------- a sombra no chão: o contato, o fuste que afina, a galeria e a lanterna com a cúpula ----------
  const [gx, gy] = sombraEm(zGaleria)
  const [tx, ty] = sombraEm(zTopo)
  S.push(contato(poligonoRegular(0, 0, f(PLATAFORMA), 8, Math.PI / 8), 0.3))
  S.push({ forma: capsulaAfunilada(0, 0, f(FUSTE_NO_PE), gx, gy, f(FUSTE_NO_ALTO)), z: 0, suave: 3, forca: FORCA_DA_SOMBRA })
  S.push({ forma: deslocada(disco(0, 0, f(GALERIA)), gx, gy), z: 0, suave: 2.4, forca: FORCA_DA_SOMBRA * 0.9 })
  S.push({ forma: capsulaAfunilada(gx, gy, f(LANTERNA), tx, ty, f(BOLA)), z: 0, suave: 2.6, forca: FORCA_DA_SOMBRA })

  // ---------- a plataforma de lajes, o degrau da porta e o rolo de corda ----------
  const plataforma = poligonoRegular(0, 0, f(PLATAFORMA), 8, Math.PI / 8)
  S.push(coluna(plataforma, zPlataforma))
  // O meio da laje fica na beira da plataforma: no meio dela, a laje subiria com a cúpula.
  L.push(P(comMeioEm(plataforma, 0, -f(0.84)), pedra, { tabua: 0, bisel: 1.6, contorno: 0.28, tom: 0.9, textura: texDasLajes(R), semente: 9500 }))
  const frenteDaPorta = Math.PI / 2
  const degrau = caixa(-f(0.15), f(0.69), f(0.15), f(0.86), 1.2)
  L.push(P(degrau, pedra, { tabua: 0, bisel: 1.4, contorno: 0.3, tom: 1.04, projeta: { dist: 1, forca: 0.28 }, semente: 9502 }))
  const [cx, cy] = [Math.cos(3.75) * f(0.84), Math.sin(3.75) * f(0.84)]
  const rolo = anel(cx, cy, f(0.085), f(0.085), f(0.03), f(0.03))
  L.push(P(rolo, CORDA, { tabua: 0, bisel: f(0.03), contorno: 0.3, polar: { cx, cy, r: f(0.06) }, projeta: { dist: 1.1, forca: 0.3 }, semente: 9503 }))
  L.push(P(disco(cx, cy, f(0.03)), CORDA, { tabua: 0, bisel: 0, tom: 0.55, contorno: 0.1, recesso: { k: 0.8, forca: 0.3 }, semente: 9504 }))

  // ---------- o fuste: as fiadas, cada uma com a beira de cima (a peça que dá a cor da faixa) ----------
  for (let k = 0; k < FIADAS; k += 1) {
    const [r1, r2] = [raioDaFiada(k), raioDaFiada(k + 1)]
    S.push(solta(esticadaAte(cascaDaFrente(r1, quartos), vez(VEZ_DAS_FIADAS), quartos), zPlataforma + (k + 1) * e))
    const daCor = Math.floor(((k + 0.5) * FAIXAS) / FIADAS) % 2 === 1
    const beira = menos(disco(0, 0, r1), disco(0, 0, r2 - 0.05))
    const mat = daCor ? faixa : CAL
    L.push(P(comMeioEm(beira, pingos[k][0], pingos[k][1]), mat, { tabua: 0, bisel: 0, contorno: 0, tom: daCor ? 0.98 : 0.96, textura: texDoCone(r1, quartos, 0.16, DA_PEDRA), semente: 9510 + k }))
  }

  // ---------- a porta e as janelas (só as que ficam na frente NA TELA) ----------
  const r0 = raioDaFiada(0)
  L.push(P(comMeioEm(setor(r0 + 0.4, r0 + PORTA_SAI, frenteDaPorta, MEIA_PORTA), 0, r0 + 1.2), PORTA, { tabua: 0, bisel: 0.4, contorno: 0.3, semente: 9530 }))
  if (naFrente(0, r0)) S.push(coluna(esticadaAte(setor(r0 - 4, r0 + PORTA_SAI, frenteDaPorta, MEIA_PORTA), vez(VEZ_DA_PORTA), quartos), zPlataforma + FIADAS_DA_PORTA * e))
  JANELAS.forEach((fiada, i) => {
    const r = raioDaFiada(Math.floor(fiada))
    const zJanela = zPlataforma + fiada * e
    L.push(P(comMeioEm(setor(r + 0.3, r + JANELA_SAI, frenteDaPorta, MEIA_JANELA), 0, r + JANELA_SAI * 0.7), VIDRO_ESCURO, { tabua: 0, bisel: 0, contorno: 0.2, semente: 9532 + i }))
    if (naFrente(0, r)) S.push(solta(esticadaAte(setor(r - 3, r + JANELA_SAI, frenteDaPorta, MEIA_JANELA), vez(VEZ_DA_PORTA), quartos), zJanela))
  })

  // ---------- a galeria de ferro: o piso de chapas com as juntas de raio ----------
  const rLanterna = f(LANTERNA)
  S.push(solta(esticadaAte(furada(disco(0, 0, f(GALERIA)), debaixoDaGaleria), vez(VEZ_DA_GALERIA), quartos), zGaleria))
  const piso = anel(0, 0, f(GALERIA), f(GALERIA), rLanterna - 1, rLanterna - 1)
  const naGaleria = daTela(0, f(0.44))
  L.push(P(comMeioEm(piso, naGaleria[0], naGaleria[1]), metal, { tabua: 0, bisel: 1.2, contorno: 0.3, tom: 0.92, metal: 0.25, polar: { cx: 0, cy: 0, r: f(0.45) }, semente: 9540 }))
  for (let i = 0; i < 12; i += 1) {
    const a = (i * Math.PI) / 6 + Math.PI / 12
    const junta = dentroDe(setor(rLanterna, f(GALERIA) - 0.6, a, 0.012), caixa(-f(1), -f(1), f(1), f(1)))
    L.push(P(comMeioEm(junta, naGaleria[0], naGaleria[1]), metal, { tabua: 0, bisel: 0, contorno: 0, tom: 0.62, semente: 9541 + i }))
  }

  // ---------- o guarda-corpo do fundo NA TELA (sai antes da lanterna) ----------
  const [g0, g1] = [f(GRADE[0]), f(GRADE[1])]
  const corrimao = (lado: -1 | 1): Forma => {
    const metade = anel(0, 0, g1, g1, g0 + 1.1, g0 + 1.1)
    return { b: metade.b, d: (x, y) => Math.max(metade.d(x, y), -lado * naTela(x, y, quartos)[1]) }
  }
  /** Um balaústre do lado `lado` NA TELA: o meio da caixa do corrimão daquele lado. */
  const balaustreDo = (lado: -1 | 1): Ponto => {
    const passo = (2 * Math.PI) / BALAUSTRES
    const a = anguloDoDesenho(lado * (Math.PI / 2), quartos)
    const perto = Math.round((a - passo / 2) / passo) * passo + passo / 2
    return [Math.cos(perto) * (g0 + g1) * 0.5, Math.sin(perto) * (g0 + g1) * 0.5]
  }
  const grade = (lado: -1 | 1, vezDela: number): void => {
    S.push(solta(esticadaAte(furada(balaustres(g0, g1, quartos, lado), debaixoDaGaleria), vez(vezDela), quartos), zGaleria + e))
    const [bx, by] = balaustreDo(lado)
    L.push(P(comMeioEm(corrimao(lado), bx, by), metal, { tabua: 0, bisel: 0.5, contorno: 0.32, tom: 0.84, metal: 0.4, projeta: { dist: 1.2, forca: 0.3 }, semente: lado < 0 ? 9560 : 9561 }))
  }
  grade(-1, VEZ_DA_GRADE_DO_FUNDO)

  // ---------- a lanterna: três tampos de vidro, cada um com o pingo do vidro aceso; o vidro e os caixilhos ----------
  for (let k = 0; k < ANDARES_DA_LANTERNA; k += 1) {
    const andar = poligonoRegular(0.1 * k, 0, rLanterna, 8, Math.PI / 8)
    S.push(solta(esticadaAte(andar, vez(VEZ_DA_LANTERNA) + 0.01 * k, quartos), zGaleria + (k + 1) * e))
    L.push(pingo(P, 0.1 * k - rLanterna * Math.cos(Math.PI / 8) + 0.35, 0, VIDRO_ACESO_NA_FRENTE, 9570 + k))
  }
  // O vidro e os caixilhos sobem com o andar de cima: o meio da caixa fica nele, fora da cúpula.
  const topoDaLanterna = (ANDARES_DA_LANTERNA - 1) * 0.1
  const [vx, vy] = [topoDaLanterna + (f(CUPULA[0]) + rLanterna * Math.cos(Math.PI / 8)) / 2, 0]
  const vidro = poligonoRegular(topoDaLanterna, 0, rLanterna, 8, Math.PI / 8)
  L.push(P(comMeioEm(vidro, vx, vy), VIDRO_ACESO_NA_FRENTE, { tabua: 0, bisel: 0, contorno: 0.18, textura: texDoVidroAceso(rLanterna), semente: 9575 }))
  for (let i = 0; i < 8; i += 1) {
    const a = Math.PI / 8 + (i * Math.PI) / 4
    const caixilho = setor(f(CUPULA[0]) - 1, rLanterna, a, 0.035)
    L.push(P(comMeioEm(caixilho, vx, vy), metal, { tabua: 0, bisel: 0.3, contorno: 0.25, tom: 0.7, semente: 9576 + i }))
  }
  // O clarão da lente sobre a galeria: é ele que diz "aceso" no tamanho de mesa.
  const halo = anel(topoDaLanterna, 0, f(HALO), f(HALO), rLanterna - 1, rLanterna - 1)
  L.push(P(comMeioEm(halo, vx, vy), VIDRO_ACESO_NA_FRENTE, { tabua: 0, bisel: 0, contorno: 0, textura: texDoClarao(rLanterna, f(HALO)), semente: 9584 }))

  grade(1, VEZ_DA_GRADE_DA_FRENTE)

  // ---------- a cúpula em dois degraus, os gomos e a bola de ferro ----------
  const [c0, c1] = [f(CUPULA[0]), f(CUPULA[1])]
  S.push(solta(esticadaAte(disco(0, 0, c0), vez(VEZ_DA_CUPULA), quartos), zGaleria + CUPULA_EM[0] * e))
  S.push(solta(esticadaAte(disco(0, 0, c1), vez(VEZ_DA_CUPULA) + 0.002, quartos), zGaleria + CUPULA_EM[1] * e))
  S.push(solta(esticadaAte(disco(0, 0, f(BOLA)), vez(VEZ_DA_CUPULA) + 0.004, quartos), zTopo))
  const naCupula = daTela(0, (c0 + c1) / 2)
  L.push(P(comMeioEm(anel(0, 0, c0, c0, c1 - 0.3, c1 - 0.3), naCupula[0], naCupula[1]), faixa, { tabua: 0, bisel: 1.4, contorno: 0.3, tom: 0.96, textura: texDoCone(c0, quartos, 0.3, DA_PEDRA), projeta: { dist: 1.4, forca: 0.32 }, semente: 9590 }))
  for (let i = 0; i < 8; i += 1) {
    const a = (i * Math.PI) / 4
    const gomo = setor(c1, c0 - 0.6, a, 0.02)
    L.push(P(comMeioEm(gomo, naCupula[0], naCupula[1]), { ...faixa, rgb: luz(faixa.rgb, -0.32) }, { tabua: 0, bisel: 0, contorno: 0, semente: 9591 + i }))
  }
  const naCupulaDeCima = daTela(c1 * 0.6, 0)
  L.push(P(comMeioEm(disco(0, 0, c1), naCupulaDeCima[0], naCupulaDeCima[1]), faixa, { tabua: 0, bisel: c1 * 0.5, contorno: 0.3, tom: 1.04, textura: texDoCone(c1, quartos, 0.3, DA_PEDRA), projeta: { dist: 1.2, forca: 0.3 }, semente: 9599 }))
  L.push(P(disco(0, 0, f(BOLA)), metal, { tabua: 0, bisel: f(BOLA) * 0.8, contorno: 0.3, metal: 0.5, projeta: { dist: 1, forca: 0.3 }, semente: 9600 }))
}
