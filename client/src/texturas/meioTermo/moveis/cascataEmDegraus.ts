/**
 * CASCATA EM DEGRAUS (lote L08 de 24/11/2026, item 75: construção nova, o rio que desce em degraus do mapa 6 e a
 * cachoeira do lago do mapa 2; desenho próprio, só a ideia do objeto). A QUEDA D'ÁGUA PARADA vista de cima: a água
 * entra pelo lado de cima da pegada, corre para o lado de baixo e cai de um patamar de pedra para o outro (um degrau a
 * cada casa de comprimento, mais ou menos), entre duas margens de PEDRAS roliças com musgo. Em cada degrau a água
 * ACELERA (clareia e risca ao comprido), vira a CRISTA de espuma na beira, e cai no patamar de baixo num FERVEDOURO
 * branco-gelo que se desfaz em flocos; no PÉ, o poço de espuma se abre em leque e some na água do rio. Umas pedras no
 * meio da corrente partem a crista e deixam a esteira de espuma atrás.
 *
 * É desenho parado (a correnteza animada é sistema novo): quem põe em cima de um rio da ferramenta Água vê a água da
 * cascata entrar e sair se desfazendo, sem emenda dura (a beira de cima e o pé são transparentes).
 *
 * Esticada, o comprimento ganha degraus (não degraus mais compridos) e a largura ganha água (as margens ficam na
 * régua da casa). A água corre do lado de cima para o de baixo da pegada; o mestre gira para o rumo que quiser.
 *
 * NA 3/4 (derivada): a ÁGUA NÃO SOBE. O rio da ferramenta Água é chato, e a cascata posta nele girada para qualquer
 * lado continua lendo como rio (com os patamares em colunas, a ponta de cima virava um paredão de água visto por trás).
 * Só as PEDRAS têm altura: cada uma é a sua coluna, da altura do tamanho dela, com a frente redonda e a sombra no chão.
 * Material: `pedra` (as margens); a água e a espuma são fixas. Escreve `cena.corDoPiso`. Não barra, não tapa.
 */
import type { Rgb } from '../../ruido'
import { comMeioEm } from './andaimeDaTresQuartos'
import { elipse, elipseGirada, poligono, type Forma, type Ponto } from './formas'
import { contato, ruido, type CriarPeca, type MaterialDaPeca, type Peca, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import { acasoDoTemplo, ESCURO_DA_PEDRA_DO_TEMPLO, moita, roseta, texDaPedraDoTemplo, tingir } from './piramideEmDegraus'

/** A água do rio (a cor de partida do rio da ferramenta Água, um nada mais calma), o claro de quando ela acelera e a espuma branco-gelo. */
const RIO: Rgb = [0x4e, 0x85, 0xa0]
const AGUA_CLARA: Rgb = [0x8c, 0xb6, 0xc4]
export const ESPUMA_DA_CASCATA: Rgb = [0xe2, 0xeb, 0xe7]
/** O material da água (a textura pinta o rio por cima dele). */
const AGUA: MaterialDaPeca = { classe: 'liso', rgb: RIO }
const ESPUMA: MaterialDaPeca = { classe: 'liso', rgb: ESPUMA_DA_CASCATA }
/** A margem de pedras (casas), o comprimento de um degrau (casas) e o pé (casas). */
const MARGEM = 0.27
const DEGRAU = 0.76
const PE = 0.74
/** A altura de uma pedra na 3/4: este tanto (casas) mais esta fração do raio menor dela. */
const ALTURA_DA_PEDRA = 0.06
const ALTURA_PELO_RAIO = 0.62
/** O quanto a beira de cada degrau embarriga para baixo no meio (px) e a entrada e a saída transparentes (px). */
const BARRIGA = 5
const ENTRADA = 7
const SAIDA = 13
/** O fervedouro debaixo da queda (px) e a faixa em que a água acelera antes dela (px). */
const FERVEDOURO = 15
const ACELERA = 13

function limitar01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t
}

function suave01(t: number): number {
  const x = limitar01(t)
  return x * x * (3 - 2 * x)
}

type Curva = (x: number) => number

/** A água de um patamar: o rio com a corrente riscada, o claro perto da beira, a crista e o fervedouro debaixo da queda de cima. */
function texDoPatamar(deCima: Curva | null, beira: Curva | null, topo: number, fundo: number, semente: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    s[0] = RIO[0]
    s[1] = RIO[1]
    s[2] = RIO[2]
    const corrente = ruido(x * 0.36 + semente, y * 0.045 + 3)
    let luz = corrente * 0.09 + ruido(x * 0.08 + 7, y * 0.13 + semente) * 0.12
    if (beira !== null) {
      const ate = beira(x) - y
      const acelera = suave01(1 - ate / ACELERA)
      tingir(s, AGUA_CLARA, acelera * (0.5 + 0.5 * Math.max(0, corrente * 2)))
      luz += corrente * 0.14 * acelera
      if (ate < 2.4) tingir(s, ESPUMA_DA_CASCATA, (1 - Math.max(0, ate) / 2.4) * 0.9)
    }
    if (deCima !== null) {
      const daQueda = y - deCima(x)
      if (daQueda < FERVEDOURO) {
        const f = 1 - Math.max(0, daQueda) / FERVEDOURO
        const bolhas = ruido(x * 0.4 + semente * 3, y * 0.4) + 0.5 * ruido(x * 1.1, y * 1.1 + semente)
        // Junto da queda a espuma é cheia; longe dela, rasga em manchas e some.
        tingir(s, ESPUMA_DA_CASCATA, limitar01((bolhas + f * 1.9 - 0.72) * 2) * Math.sqrt(f) * 0.96)
        luz += bolhas * 0.1 * f
      }
    } else if (y - topo < ENTRADA) s[5] = suave01((y - topo) / ENTRADA)
    if (beira === null) {
      // O pé: os flocos de espuma indo embora e a saída transparente.
      const flocos = ruido(x * 0.3 + 11, y * 0.2 + semente)
      if (flocos > 0.2) tingir(s, ESPUMA_DA_CASCATA, (flocos - 0.2) * 1.5 * limitar01((fundo - y) / 30))
      s[5] = suave01((fundo - y) / SAIDA)
    }
    s[3] += luz
  }
}

/** Um floco de espuma: gomos redondos encostados, com a beira macia. O meio da caixa de todos fica em (x, y). */
function floco(L: Peca[], P: CriarPeca, x: number, y: number, r: number, semente: number, alfa = 0.9): void {
  L.push(P(comMeioEm(elipse(x, y, r * 1.5, r * 1.05), x, y), ESPUMA, { bisel: 0, contorno: 0, alfa: alfa * 0.55, suave: r * 0.8, semente: 6300 + semente }))
  const gomos = 5 + Math.floor(acasoDoTemplo(semente, 71) * 4)
  for (let i = 0; i < gomos; i += 1) {
    const a = acasoDoTemplo(semente * 13 + i, 72) * Math.PI * 2
    const d = r * 0.9 * acasoDoTemplo(semente * 13 + i, 73)
    const rg = r * (0.16 + 0.2 * acasoDoTemplo(semente * 13 + i, 74))
    L.push(P(comMeioEm(elipse(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7, rg, rg * 0.84), x, y), ESPUMA, { bisel: rg * 0.5, contorno: 0, alfa: alfa * 0.92, suave: 0.7, semente: 6310 + semente * 7 + i }))
  }
}

export const montarCascataEmDegraus: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  if (!(hw > 0) || !(hh > 0)) return
  const pedra = c.m.pedra
  const L = cena.partes
  cena.corDoPiso = ESCURO_DA_PEDRA_DO_TEMPLO
  const margem = Math.min(g * MARGEM, hw * 0.34)
  const wc = hw - margem
  const pe = Math.min(g * PE, hh * 0.56)
  const degraus = Math.max(1, Math.round((2 * hh - pe) / (g * DEGRAU)))
  const passo = (2 * hh - pe) / degraus
  /** A beira do degrau `k` (0 é a de cima): embarriga no meio e ondula. */
  const beiraDe = (k: number): Curva => (x) => -hh + (k + 1) * passo + BARRIGA * (1 - (x / wc) * (x / wc)) + 1.6 * Math.sin(x * 0.19 + k * 1.9)
  const AMOSTRAS = 10
  const pelaCurva = (curva: Curva, x0: number, x1: number): Ponto[] => Array.from({ length: AMOSTRAS + 1 }, (_, i): Ponto => {
    const x = x0 + ((x1 - x0) * i) / AMOSTRAS
    return [x, curva(x)]
  })
  const reta = (y: number): Curva => () => y

  // A pedra cujo meio cai dentro de uma vizinha mais alta sobe com ela e fica sem peça própria; a frente dela, na 3/4,
  // sai do material da MAIOR peça da cena. Esta peça vazia (não pinta nada), do tamanho da pegada, garante que é pedra.
  L.push(P({ b: [-hw, -hh, hw, hh], d: () => 1 }, pedra, { tabua: 0, bisel: 0, contorno: 0, semente: 6190 }))

  // ---------- os PATAMARES de água, de cima para baixo, e o PÉ ----------
  for (let k = 0; k <= degraus; k += 1) {
    const noPe = k === degraus
    const deCima = k === 0 ? null : beiraDe(k - 1)
    const beira = noPe ? null : beiraDe(k)
    // A planta: de uma beira à outra (a de cima entra 0,8 px debaixo do patamar anterior: sem fio de chão na emenda).
    const alto = pelaCurva(deCima === null ? reta(-hh) : (x) => deCima(x) - 0.8, -wc - 1.5, wc + 1.5)
    const baixo = pelaCurva(beira ?? reta(hh), wc + 1.5, -wc - 1.5)
    const planta = poligono([...alto, ...baixo])
    const meioY = (alto[AMOSTRAS / 2][1] + baixo[AMOSTRAS / 2][1]) / 2
    L.push(P(comMeioEm(planta, 0, meioY), AGUA, { bisel: 0, contorno: 0, textura: texDoPatamar(deCima, beira, -hh, hh, 3 + k * 7), semente: 6200 + k }))
    // Os flocos do fervedouro debaixo da queda de cima, maiores no meio; no pé, mais e mais largos.
    if (deCima !== null) {
      const quantos = Math.max(3, Math.round((wc * 2) / (noPe ? 11 : 15)))
      for (let i = 0; i < quantos; i += 1) {
        const x = -wc + 5 + ((2 * wc - 10) * (i + 0.5)) / quantos + (acasoDoTemplo(k * 31 + i, 75) - 0.5) * 6
        const y = deCima(x) + 3.4 + (noPe ? 7 : 4) * acasoDoTemplo(k * 31 + i, 76)
        floco(L, P, x, y, (noPe ? 4.6 : 3.6) + 2 * acasoDoTemplo(k * 31 + i, 77), k * 31 + i)
      }
      if (noPe) {
        // O leque do pé: flocos soltos indo embora, cada vez menores e mais apagados.
        for (let i = 0; i < 9; i += 1) {
          const t = acasoDoTemplo(i, 78)
          const x = (acasoDoTemplo(i, 79) - 0.5) * 2 * (wc - 4)
          const y = deCima(x) + 13 + t * (hh - deCima(x) - 22)
          floco(L, P, x, y, 2.2 + 2 * (1 - t), 900 + i, 0.75 - 0.4 * t)
        }
      }
    }
  }

  // ---------- as PEDRAS no meio da corrente, na beira de cada degrau: partem a crista e deixam a esteira ----------
  const daPedra = texDaPedraDoTemplo(0.46, 71)
  for (let k = 0; k < degraus; k += 1) {
    const beira = beiraDe(k)
    const postos = k % 2 === 0 ? [-0.46, 0.3] : [-0.12, 0.6]
    postos.forEach((f, i) => {
      const x = f * wc + (acasoDoTemplo(k * 5 + i, 81) - 0.5) * 6
      const r = 4.4 + 2.6 * acasoDoTemplo(k * 5 + i, 82)
      const y = beira(x) - r * 0.5
      const giro = (acasoDoTemplo(k * 5 + i, 83) - 0.5) * 1.2
      // A esteira de espuma debaixo da pedra (no patamar de baixo).
      floco(L, P, x - 1, beira(x) + 4.5, r * 0.8, 950 + k * 5 + i, 0.8)
      const forma = elipseGirada(x, y, r * 1.2, r * 0.85, giro)
      cena.sombras.push({ forma, z: g * ALTURA_DA_PEDRA + r * 0.85 * ALTURA_PELO_RAIO, forca: 0.26 })
      L.push(P(forma, pedra, { tabua: 0, bisel: r * 0.5, tom: 0.84 + 0.14 * acasoDoTemplo(k * 5 + i, 84), contorno: 0.32, textura: daPedra, semente: 6400 + k * 5 + i, projeta: { dist: 2, forca: 0.34 } }))
    })
  }

  // ---------- as MARGENS: as pedras roliças em duas fileiras, cada uma com o leito molhado por baixo ----------
  interface Pedra {
    readonly forma: Forma
    readonly leito: Forma
    readonly ry: number
    readonly sal: number
  }
  const pedras: Pedra[] = []
  for (const lado of [-1, 1]) {
    // A fileira de fora, miúda, e a de dentro, com as pedras grandes que avançam na água.
    for (const fileira of [0, 1]) {
      let y = -hh + 4 + 3 * fileira
      for (let i = 0; y < hh - 4; i += 1) {
        const sal = i * 4 + fileira * 2 + (lado + 1) * 500
        const grande = fileira === 1 && acasoDoTemplo(sal, 86) < 0.45
        const rx = (fileira === 0 ? 4.2 : grande ? 8.6 : 5.8) + 2 * acasoDoTemplo(sal, 87)
        const ry = rx * (0.68 + 0.24 * acasoDoTemplo(sal, 88))
        y += ry * 0.82
        const x = lado * (hw - (fileira === 0 ? margem * 0.2 : margem * (grande ? 0.74 : 0.6)) + (acasoDoTemplo(sal, 89) - 0.5) * 3.4)
        const giro = (acasoDoTemplo(sal, 90) - 0.5) * 1.6
        pedras.push({ forma: elipseGirada(x, y, rx, ry, giro), leito: elipseGirada(x + 0.4, y + 0.6, rx + 1.7, ry + 1.7, giro), ry, sal })
        y += ry * 0.82 + 0.4
      }
    }
  }
  // O leito escuro de todas primeiro (fica no chão debaixo delas), depois as pedras, cada uma a sua coluna.
  for (const r of pedras) L.push(P(r.leito, pedra, { tabua: 0, bisel: 0, tom: 0.5, contorno: 0.2, semente: 6500 + r.sal }))
  for (const r of pedras) {
    cena.sombras.push({ forma: r.forma, z: g * ALTURA_DA_PEDRA + r.ry * ALTURA_PELO_RAIO, forca: 0.26 }, contato(r.forma, 0.26))
    L.push(P(r.forma, pedra, { tabua: 0, bisel: r.ry * 0.55, tom: 0.8 + 0.24 * acasoDoTemplo(r.sal, 91), contorno: 0.32, textura: daPedra, semente: 6520 + r.sal, projeta: { dist: 2.2, forca: 0.34 } }))
  }
  // O verde das margens: duas moitas e uma roseta, do lado de fora.
  moita(L, P, -hw + margem * 0.42, -hh + passo * 0.5, 6.2, 700, 5)
  moita(L, P, hw - margem * 0.4, hh - pe * 0.6, 5.6, 701, 5)
  roseta(L, P, hw - margem * 0.44, -hh + passo * 1.2, 6, 702)
}
