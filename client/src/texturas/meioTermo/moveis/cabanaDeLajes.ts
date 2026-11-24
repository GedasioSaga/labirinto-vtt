/**
 * CABANA DE LAJES (lote L07 "Selva: ruína e água", 24/11/2026; construção nova). O santuário pequeno de pedra perdido
 * debaixo das palmeiras: as PAREDES de cantaria em fiadas, a PORTA na frente (a de baixo, no giro 0), funda (o batente
 * da esquerda aceso, o da direita na sombra, o escuro de dentro descendo da verga e a soleira acesa no pé) com a verga
 * de uma laje só e a soleira encostada no beiral, e o TELHADO em degraus de LAJES OLIVA-MUSGO: o beiral que passa das
 * paredes (com o recorte em cima da porta) e quatro degraus que recuam até a laje do cume e o pinhão de pedra. Cada
 * degrau tem poucas lajes grandes, de largura variada, deitadas de través à beira, as juntas em diagonal nas quinas, o
 * espelho escuro (a escada de pedra) e o musgo nas juntas, mais nos de baixo.
 *
 * As duas vistas saem da PILHA DE FATIAS: de cima, os degraus do telhado em anéis (com o espelho de cada um em faixa
 * escura) e a soleira no recorte do beiral, que diz para onde a porta abre; na 3/4, a face das paredes com as fiadas, a
 * porta funda e a sombra do beiral, e a beira de cada degrau com as pontas das lajes. As medidas de través saem do
 * menor meio lado (a cabana esticada fica mais comprida, não com o telhado mais grosso). Perfil da 3/4:
 * `{ modo: 'derivado', espessura: 0 }`. Material: `pedra` (as paredes, a verga, a soleira e o pinhão); as lajes do
 * telhado são fixas. Barra a passagem e tapa a visão.
 */
import { hash, type Rgb } from '../../ruido'
import { caixa, poligono, type Ponto } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import type { MontarMovel } from './contexto'
import { novoFatiador, rumoDaSombra } from './pilhaDeFatias'
import { ESCURO_DA_PEDRA, sombraVarrida } from './apoioDasReferencias'
import { blocoEmFatias, manchaDeMusgo, misturarCor, retanguloGirado } from './muroEmRuina'

/** A laje do telhado: oliva-musgo contido e fosco, em lâminas (a ardósia do motor), saturação HSL ~0,13. */
const LAJE_DO_TELHADO: MaterialDaPeca = { classe: 'pedra', rgb: [0x58, 0x62, 0x4e], pedra: 'ardosia' }
/** O escuro de dentro da porta: quente, acima do piso de luz. */
const ESCURO_DE_DENTRO: Rgb = [0x2d, 0x29, 0x24]

/** O recuo das paredes (fração do menor meio lado) e a altura delas (casas). */
const RECUO_DAS_PAREDES = 0.16
const ALTURA_DAS_PAREDES = 0.72
/** A porta: meia largura e altura (casas); a verga: meia largura e altura (casas). */
const PORTA = { meia: 0.2, alto: 0.5 } as const
const VERGA = { meia: 0.29, alto: 0.08 } as const
/**
 * A fundura da porta: o batente de cada lado (px; o da esquerda pega a luz, ~0,9, e o da direita fica na sombra,
 * ~0,55), o escuro de dentro (quanto cobre a pedra em cima, junto da verga, e embaixo) e a soleira de dentro (px).
 */
const BATENTE = { largura: 2.5, luzDaEsquerda: -0.1, luzDaDireita: -0.45 } as const
const DENTRO = { emCima: 0.97, embaixo: 0.66, luzEmCima: -0.12, luzEmbaixo: 0.07 } as const
const SOLEIRA_DE_DENTRO = { alto: 1.1, luz: 0.16 } as const
/** A soleira: meia largura (casas), altura (px) e o tom (o das paredes: com o tom claro ela lia como banco). */
const SOLEIRA = { meia: 0.25, alto: 2.4, tom: 0.9 } as const
/** A fiada das paredes (px) e o comprimento de uma pedra dela (px). */
const FIADA = 6.2
const PEDRA_DA_PAREDE = 12.5
/** Os degraus do telhado: [recuo (fração do menor meio lado), alto do degrau (casas)]; o último é a laje do cume. */
const DEGRAUS: readonly (readonly [number, number])[] = [
  [0.045, 0.8],
  [0.25, 0.92],
  [0.45, 1.03],
  [0.63, 1.13],
  [0.79, 1.21],
]
/** O pinhão no cume, em dois andares: [raio, alto] em casas, e a sombra dele na laje do cume (vezes a altura, luz). */
const PINHAO: readonly (readonly [number, number])[] = [
  [0.12, 0.05],
  [0.085, 0.06],
]
const SOMBRA_DO_PINHAO = { alto: 1.6, luz: -0.24 } as const
/**
 * As lajes do telhado, à beira de cada degrau: a largura de partida (px), quanto ela varia (fração, para cada lado),
 * a meia largura das juntas (px) e o espelho de cada degrau (a faixa escura de baixo, px, e a luz dela na 3/4 e de cima).
 */
const LAJE = 15
const LAJE_QUE_VARIA = 0.25
const JUNTA = 0.6
const ESPELHO = { alto: 2, luz: -0.4, deCima: 2, luzDeCima: -0.32 } as const
/** A sombra do beiral nas paredes: até onde ela desce (px). */
const SOMBRA_DO_BEIRAL = 6

export const montarCabanaDeLajes: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const pedra = c.m.pedra
  const f = novoFatiador(P, cena, c.giro)
  const q = f.q
  cena.corDoPiso = ESCURO_DA_PEDRA
  const m = Math.min(hw, hh)
  const rec = m * RECUO_DAS_PAREDES
  const zParede = g * ALTURA_DAS_PAREDES
  const meiaPorta = g * PORTA.meia
  const zPorta = g * PORTA.alto
  const meiaVerga = g * VERGA.meia
  const zVerga = zPorta + g * VERGA.alto
  const beiral = m * DEGRAUS[0][0]

  // A SOLEIRA, da porta até a beira do beiral (encostada nele), no tom e no grão das paredes.
  const soleira = retanguloGirado(0, (hh - rec + hh - beiral) / 2, g * SOLEIRA.meia, (rec - beiral) / 2 + 0.6, 0)
  blocoEmFatias(f, 0, soleira, 0, SOLEIRA.alto, pedra, {
    semente: 7620,
    tom: SOLEIRA.tom,
    bisel: 0.8,
    face: (_x, _y, z) => (SOLEIRA.alto - z < 0.9 ? 0.12 : 0),
    musgo: (x, y) => manchaDeMusgo(x, y, 61, 0.06),
  })

  // As PAREDES: as fiadas de cantaria, a porta da frente com a verga e a sombra do beiral no alto.
  const paredes: Ponto[] = [[-hw + rec, -hh + rec], [hw - rec, -hh + rec], [hw - rec, hh - rec], [-hw + rec, hh - rec]]
  const daFrente = (ny: number): boolean => ny > 0.5
  const naPorta = (x: number, z: number, ny: number): boolean => daFrente(ny) && Math.abs(x) < meiaPorta && z < zPorta
  const noBatente = (x: number): number => (x < -meiaPorta + BATENTE.largura ? -1 : x > meiaPorta - BATENTE.largura ? 1 : 0)
  const faceDaParede = (x: number, y: number, z: number, nx: number, ny: number): number => {
    if (naPorta(x, z, ny)) {
      // A porta funda: os batentes de pedra dos dois lados, a soleira de dentro acesa e o escuro descendo da verga.
      const batente = noBatente(x)
      if (batente !== 0) return batente < 0 ? BATENTE.luzDaEsquerda : BATENTE.luzDaDireita
      if (z < SOLEIRA_DE_DENTRO.alto) return SOLEIRA_DE_DENTRO.luz
      return DENTRO.luzEmbaixo + (DENTRO.luzEmCima - DENTRO.luzEmbaixo) * (z / zPorta)
    }
    let luz = 0
    if (daFrente(ny) && Math.abs(x) < meiaVerga && z >= zPorta && z < zVerga) {
      // A verga: uma laje só, mais clara, com o sulco embaixo (a sombra dela na porta).
      luz += z - zPorta < 0.8 ? -0.2 : 0.07
    } else {
      const fiada = Math.floor(z / FIADA)
      const t = (Math.abs(ny) > 0.5 ? x : y) + (fiada % 2 === 1 ? PEDRA_DA_PAREDE / 2 : 0)
      const k = Math.floor(t / PEDRA_DA_PAREDE)
      const fr = t - k * PEDRA_DA_PAREDE
      if (z - fiada * FIADA < 0.75 || fr < 0.75) luz -= 0.17
      else luz += 0.08 * (hash(k, fiada, 7610 + Math.round(nx * 3 + ny * 5)) - 0.5)
    }
    // O beiral faz sombra no alto das paredes.
    if (z > zParede - SOMBRA_DO_BEIRAL) luz -= (0.18 * (z - (zParede - SOMBRA_DO_BEIRAL))) / SOMBRA_DO_BEIRAL
    return luz
  }
  const corDaParede = (s: Float32Array, x: number, _y: number, z: number, _nx: number, ny: number): void => {
    if (!naPorta(x, z, ny) || noBatente(x) !== 0 || z < SOLEIRA_DE_DENTRO.alto) return
    // O vão: o escuro de dentro, mais fechado junto da verga e um nada mais aberto embaixo.
    misturarCor(s, ESCURO_DE_DENTRO, DENTRO.embaixo + (DENTRO.emCima - DENTRO.embaixo) * (z / zPorta))
  }
  blocoEmFatias(f, 0, paredes, 0, zParede, pedra, {
    semente: 7620,
    tom: 0.96,
    passo: 1,
    face: faceDaParede,
    corDaFace: corDaParede,
    musgo: (x, y, z) => (z < 6 ? (1 - z / 6) * manchaDeMusgo(x * 1.2, y * 1.2 + z, 63, -0.08) : 0),
  })

  // A sombra do pinhão na laje do cume: o disco de baixo dele levado pelo rumo da sombra (mais longe que a luz manda,
  // para ler a 1x).
  const [srx, sry] = rumoDaSombra(q)
  const zSombraDoPinhao = g * PINHAO.reduce((t, [, alto]) => t + alto, 0) * SOMBRA_DO_PINHAO.alto
  const raioDoPinhao = g * PINHAO[0][0]
  const sombraDoPinhao = (x: number, y: number): boolean => {
    for (let t = 0.25; t <= 1; t += 0.25) if (Math.hypot(x - srx * zSombraDoPinhao * t, y - sry * zSombraDoPinhao * t) < raioDoPinhao) return true
    return false
  }

  // O TELHADO em degraus de lajes oliva. O beiral tem o recorte em cima da porta (de cima, a soleira aparece nele).
  let zBaixo = zParede
  DEGRAUS.forEach(([recuo, alto], i) => {
    const r = m * recuo
    const a = hw - r
    const b = hh - r
    const zDoDegrau = zBaixo
    const zAlto = g * alto
    let planta: Ponto[] = [[-a, -b], [a, -b], [a, b], [-a, b]]
    if (i === 0) {
      const meio = meiaPorta + 2.5
      const fundo = hh - rec + 0.5
      planta = [[-a, -b], [a, -b], [a, b], [meio, b], [meio, fundo], [-meio, fundo], [-meio, b], [-a, b]]
    }
    // As lajes deitadas de través à beira do degrau, poucas e grandes; nas quinas, a junta do espigão em diagonal.
    const posicao = (x: number, y: number): readonly [number, number] => {
      const naBeiraDeCima = b - Math.abs(y) < a - Math.abs(x)
      return naBeiraDeCima ? [x + i * 5.3 + (y < 0 ? 0 : 2.9), y < 0 ? 0 : 1] : [y + i * 5.3 + (x < 0 ? 4.1 : 7.6), x < 0 ? 2 : 3]
    }
    const juntaDaLaje = (k: number, lado: number): number => k * LAJE + (hash(k, lado * 7 + i, 7641) - 0.5) * 2 * LAJE_QUE_VARIA * LAJE
    const juntaOuTom = (t: number, lado: number): number => {
      const k = Math.floor(t / LAJE)
      const antes = juntaDaLaje(k, lado)
      const depois = juntaDaLaje(k + 1, lado)
      if (Math.min(Math.abs(t - antes), Math.abs(t - depois)) < JUNTA) return -0.22
      const laje = t < antes ? k - 1 : t >= depois ? k + 1 : k
      return 0.09 * (hash(laje, lado * 7 + i, 7640) - 0.5)
    }
    // O espelho do degrau de cima, visto de cima: a faixa escura em volta da planta dele.
    const proximo = DEGRAUS[i + 1]
    const espelho = (x: number, y: number): number => {
      if (proximo === undefined) return 0
      const rp = m * proximo[0]
      const fora = Math.max(Math.abs(x) - (hw - rp), Math.abs(y) - (hh - rp))
      return fora > 0 && fora < ESPELHO.deCima ? ESPELHO.luzDeCima : 0
    }
    const topo = (x: number, y: number): number => {
      if (proximo === undefined) return 0.05 + (sombraDoPinhao(x, y) ? SOMBRA_DO_PINHAO.luz : 0)
      if (Math.abs(a - Math.abs(x) - (b - Math.abs(y))) < JUNTA) return -0.24
      const [t, lado] = posicao(x, y)
      return juntaOuTom(t, lado) + espelho(x, y)
    }
    const face = (x: number, y: number, z: number, _nx: number, ny: number): number =>
      juntaOuTom((Math.abs(ny) > 0.5 ? x : y) + i * 5.3, Math.abs(ny) > 0.5 ? (ny < 0 ? 0 : 1) : 2) + (z - zDoDegrau < ESPELHO.alto ? ESPELHO.luz : 0)
    blocoEmFatias(f, 0, planta, zDoDegrau, zAlto, LAJE_DO_TELHADO, {
      semente: 7650 + i * 4,
      tom: 1 + 0.03 * i,
      bisel: 1.1,
      contorno: 0.28,
      junta: 0.7,
      topo,
      face,
      musgo: (x, y, z) => manchaDeMusgo(x + z * 0.4, y + z * 1.3, 65 + i, 0.02 + 0.035 * i),
    })
    cena.sombras.push(sombraVarrida(-a, -b, a, b, zAlto, q, 0.3, 1.8))
    zBaixo = zAlto
  })

  // O PINHÃO de pedra no cume, em dois andares, com contorno e a sombra dele na laje do cume.
  let zPinhao = zBaixo
  PINHAO.forEach(([raio, alto], k) => {
    const rp = g * raio
    const pontos: Ponto[] = []
    for (let j = 0; j < 8; j += 1) pontos.push([Math.cos((j * Math.PI) / 4 + Math.PI / 8) * rp, Math.sin((j * Math.PI) / 4 + Math.PI / 8) * rp])
    blocoEmFatias(f, 1, pontos, zPinhao, zPinhao + g * alto, pedra, { semente: 7680 + k * 2, tom: 0.98 + 0.06 * k, bisel: 1.1, contorno: 0.36, junta: 0.6 })
    zPinhao += g * alto
  })
  f.fechar()

  cena.sombras.push(contato(caixa(-hw + rec, -hh + rec, hw - rec, hh - rec, 1), 0.34), contato(poligono(soleira), 0.26))
}
