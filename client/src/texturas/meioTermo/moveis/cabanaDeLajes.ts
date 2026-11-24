/**
 * CABANA DE LAJES (lote L07 "Selva: ruína e água", 24/11/2026; construção nova). O santuário pequeno de pedra perdido
 * debaixo das palmeiras: as PAREDES de cantaria em fiadas, a PORTA escura na frente (a de baixo, no giro 0) com a
 * verga de uma laje só e a soleira saindo dela, e o TELHADO em degraus de LAJES VERDE-ESCURAS: o beiral que passa das
 * paredes (com o recorte em cima da porta) e quatro degraus que recuam até a laje do cume e o pinhão de pedra. Cada
 * degrau tem as lajes deitadas de través à beira, as juntas em diagonal nas quinas e o musgo, mais nos de baixo.
 *
 * As duas vistas saem da PILHA DE FATIAS: de cima, os degraus do telhado em anéis (a quina de cima à esquerda acesa) e a
 * soleira no recorte do beiral, que diz para onde a porta abre; na 3/4, a face das paredes com as fiadas, a porta e a
 * sombra do beiral, e a beira de cada degrau com as pontas das lajes. As medidas de través saem do menor meio lado (a
 * cabana esticada fica mais comprida, não com o telhado mais grosso). Perfil da 3/4: `{ modo: 'derivado', espessura: 0 }`.
 * Material: `pedra` (as paredes, a verga e a soleira); as lajes do telhado são fixas. Barra a passagem e tapa a visão.
 */
import { hash, type Rgb } from '../../ruido'
import { caixa, poligono, type Ponto } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import type { MontarMovel } from './contexto'
import { novoFatiador } from './pilhaDeFatias'
import { ESCURO_DA_PEDRA, sombraVarrida } from './apoioDasReferencias'
import { blocoEmFatias, manchaDeMusgo, misturarCor, retanguloGirado } from './muroEmRuina'

/** A laje do telhado: verde-escura e fosca, em lâminas (a ardósia do motor), saturação HSL ~0,12. */
const LAJE_DO_TELHADO: MaterialDaPeca = { classe: 'pedra', rgb: [0x5c, 0x60, 0x58], pedra: 'ardosia' }
/** O escuro de dentro da porta: quente, acima do piso de luz. */
const ESCURO_DE_DENTRO: Rgb = [0x2d, 0x29, 0x24]

/** O recuo das paredes (fração do menor meio lado) e a altura delas (casas). */
const RECUO_DAS_PAREDES = 0.16
const ALTURA_DAS_PAREDES = 0.72
/** A porta: meia largura e altura (casas); a verga: meia largura e altura (casas). */
const PORTA = { meia: 0.2, alto: 0.5 } as const
const VERGA = { meia: 0.29, alto: 0.08 } as const
/** A soleira: meia largura (casas) e altura (px). */
const SOLEIRA = { meia: 0.25, alto: 2.4 } as const
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
/** O pinhão no cume: raio e altura (casas). */
const PINHAO = { raio: 0.06, alto: 0.07 } as const
/** A largura de uma laje do telhado, à beira de cada degrau (px), e a meia largura das juntas (px). */
const LAJE = 9
const JUNTA = 0.6
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

  // A SOLEIRA, saindo da porta até quase a beira da pegada.
  const soleira = retanguloGirado(0, (hh - rec + hh - 1.6) / 2, g * SOLEIRA.meia, (rec - 1.6) / 2 + 0.6, 0)
  blocoEmFatias(f, 0, soleira, 0, SOLEIRA.alto, pedra, { semente: 7600, tom: 0.95, bisel: 0.8, musgo: (x, y) => manchaDeMusgo(x, y, 61, 0.06) })

  // As PAREDES: as fiadas de cantaria, a porta da frente com a verga e a sombra do beiral no alto.
  const paredes: Ponto[] = [[-hw + rec, -hh + rec], [hw - rec, -hh + rec], [hw - rec, hh - rec], [-hw + rec, hh - rec]]
  const daFrente = (ny: number): boolean => ny > 0.5
  const naPorta = (x: number, z: number, ny: number): boolean => daFrente(ny) && Math.abs(x) < meiaPorta && z < zPorta
  const faceDaParede = (x: number, y: number, z: number, nx: number, ny: number): number => {
    if (naPorta(x, z, ny)) return 0
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
    if (!naPorta(x, z, ny)) return
    // O vão: escuro, com o batente da direita um nada aceso (a luz entra pela esquerda) e a soleira de dentro.
    const batente = x > meiaPorta - 1.5
    misturarCor(s, ESCURO_DE_DENTRO, batente ? 0.62 : 0.93)
    s[3] -= batente ? 0 : 0.06
  }
  blocoEmFatias(f, 0, paredes, 0, zParede, pedra, {
    semente: 7620,
    tom: 0.96,
    passo: 1,
    face: faceDaParede,
    corDaFace: corDaParede,
    musgo: (x, y, z) => (z < 6 ? (1 - z / 6) * manchaDeMusgo(x * 1.2, y * 1.2 + z, 63, -0.08) : 0),
  })

  // O TELHADO em degraus de lajes verdes. O beiral tem o recorte em cima da porta (de cima, a soleira aparece nele).
  let zBaixo = zParede
  DEGRAUS.forEach(([recuo, alto], i) => {
    const r = m * recuo
    const a = hw - r
    const b = hh - r
    const zAlto = g * alto
    let planta: Ponto[] = [[-a, -b], [a, -b], [a, b], [-a, b]]
    if (i === 0) {
      const meio = meiaPorta + 2.5
      const fundo = hh - rec + 0.5
      planta = [[-a, -b], [a, -b], [a, b], [meio, b], [meio, fundo], [-meio, fundo], [-meio, b], [-a, b]]
    }
    // As lajes deitadas de través à beira do degrau; nas quinas, a junta do espigão em diagonal.
    const posicao = (x: number, y: number): readonly [number, number] => {
      const naBeiraDeCima = b - Math.abs(y) < a - Math.abs(x)
      return naBeiraDeCima ? [x + i * 3.3 + (y < 0 ? 0 : 1.7), y < 0 ? 0 : 1] : [y + i * 3.3 + (x < 0 ? 3.1 : 4.6), x < 0 ? 2 : 3]
    }
    const juntaOuTom = (t: number, lado: number): number => {
      const k = Math.floor(t / LAJE)
      const fr = t - k * LAJE
      if (fr < JUNTA || fr > LAJE - JUNTA) return -0.22
      return 0.08 * (hash(k, lado * 7 + i, 7640) - 0.5)
    }
    const topo = (x: number, y: number): number => {
      if (i === DEGRAUS.length - 1) return 0.05
      if (Math.abs(a - Math.abs(x) - (b - Math.abs(y))) < JUNTA) return -0.24
      const [t, lado] = posicao(x, y)
      return juntaOuTom(t, lado)
    }
    const face = (x: number, y: number, _z: number, _nx: number, ny: number): number => juntaOuTom((Math.abs(ny) > 0.5 ? x : y) + i * 3.3, Math.abs(ny) > 0.5 ? (ny < 0 ? 0 : 1) : 2)
    blocoEmFatias(f, 0, planta, zBaixo, zAlto, LAJE_DO_TELHADO, {
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

  // O PINHÃO de pedra no cume.
  const rp = g * PINHAO.raio
  const pinhao: Ponto[] = []
  for (let k = 0; k < 8; k += 1) pinhao.push([Math.cos((k * Math.PI) / 4) * rp, Math.sin((k * Math.PI) / 4) * rp])
  blocoEmFatias(f, 1, pinhao, zBaixo, zBaixo + g * PINHAO.alto, pedra, { semente: 7680, tom: 1.04, bisel: 1, junta: 0.6 })
  f.fechar()

  cena.sombras.push(contato(caixa(-hw + rec, -hh + rec, hw - rec, hh - rec, 1), 0.34), contato(poligono(soleira), 0.26))
}
