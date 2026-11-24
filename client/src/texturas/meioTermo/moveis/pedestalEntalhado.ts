/**
 * PEDESTAL ENTALHADO (lote L07 "Selva: ruína e água", 24/11/2026; versão do `altarRedondo`, só a ideia do objeto).
 * O disco baixo de pedra, marco ou base de ídolo esquecido no campo da ruína: o DEGRAU de lajes rente ao chão, o
 * TAMBOR baixo com o FRISO de degraus (uma greca escalonada que dá a volta inteira) e o lábio de cima, e na laje de
 * cima o ENTALHE HEXAGONAL: o sulco redondo de fora, a faixa hexagonal rebaixada (com a sombra da parede do lado da
 * luz caindo dentro dela), os seis raios que ligam as quinas ao sulco e o botão hexagonal no meio. Só geometria,
 * nenhum símbolo de religião de verdade. O musgo pega o degrau, o pé do tambor e uma beira da laje.
 *
 * As duas vistas saem da PILHA DE FATIAS, como o altar redondo: de cima, a laje entalhada e o anel do degrau; na 3/4,
 * a frente redonda do tambor com a greca de verdade (a textura de cada fatia desenha o friso naquela altura). As
 * medidas saem do menor meio lado (esticado, continua redondo). Perfil da 3/4: `{ modo: 'derivado', espessura: 0 }`.
 * Material: `pedra`. Sem luz.
 */
import { hash } from '../../ruido'
import { contato, ruido, texturaDaClasse, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import { alturas, noObjeto, novoFatiador, sombraDoCilindro } from './pilhaDeFatias'
import { disco, ESCURO_DA_PEDRA, lisa, luzDaNormal } from './apoioDasReferencias'
import { GRAO_POR_ALTURA, manchaDeMusgo, musgar, PASSO_DAS_FATIAS } from './muroEmRuina'

/** Os raios, em fração do menor meio lado: o degrau, o tambor e o lábio de cima. */
const RAIO_DO_DEGRAU = 0.97
const RAIO_DO_TAMBOR = 0.82
const RAIO_DO_LABIO = 0.88
/** As alturas (casas): o alto do degrau, do tambor e do lábio. */
const Z = { degrau: 0.07, tambor: 0.26, labio: 0.31 } as const
/** As lajes do degrau e quantas voltas a greca dá no tambor. */
const LAJES = 7
const GRECAS = 10
/** A largura do espelho de cada degrau da greca, em fração de uma volta dela (~0,7 px no tambor de uma casa). */
const ESPELHO = 0.045
/** O entalhe de cima (frações do raio do lábio): o sulco redondo, a faixa hexagonal (de fora e de dentro) e o botão. */
const ENTALHE = { sulco: 0.86, faixaFora: 0.62, faixaDentro: 0.45, botao: 0.17 } as const
/** A largura dos traços do entalhe (px) e a profundidade da sombra dentro da faixa (px, para o lado da luz). */
const TRACO = 0.65
const SOMBRA_DO_REBAIXO = 1.8

/** A distância com sinal ao hexágono de raio (até a quina) `r`, com as quinas nos ângulos de 30° + k·60°. */
function hexagono(x: number, y: number, r: number): number {
  const apotema = r * Math.cos(Math.PI / 6)
  let d = -Infinity
  for (let k = 0; k < 6; k += 1) {
    const a = (k * Math.PI) / 3
    const p = x * Math.cos(a) + y * Math.sin(a)
    if (p > d) d = p
  }
  return d - apotema
}

/** O nível do degrau da greca na posição `u` (0 a 1) de uma volta: sobe três degraus e desce três. */
function nivelDaGreca(u: number): number {
  const t = 1 - Math.abs(2 * u - 1)
  return Math.min(3, Math.floor(t * 4))
}

export const montarPedestalEntalhado: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const pedra = c.m.pedra
  const f = novoFatiador(P, cena, c.giro)
  const q = f.q
  const daPedra = texturaDaClasse(pedra.classe)
  cena.corDoPiso = ESCURO_DA_PEDRA
  const R = Math.min(hw, hh)
  const [zDegrau, zTambor, zLabio] = [g * Z.degrau, g * Z.tambor, g * Z.labio]
  const rDegrau = R * RAIO_DO_DEGRAU
  const rTambor = R * RAIO_DO_TAMBOR
  const rLabio = R * RAIO_DO_LABIO
  const comPedra = (z: number, luz: (x: number, y: number) => number, musgo: (x: number, y: number) => number): Textura => (u, v, x, y, p, s, escala) => {
    if (daPedra !== null) daPedra(u, v + z * GRAO_POR_ALTURA, x, y + z * GRAO_POR_ALTURA, p, s, escala)
    s[3] += luz(x, y)
    musgar(s, musgo(x, y), x, y)
  }
  const ladoDoDisco = (x: number, y: number): number => {
    const a = Math.atan2(y, x)
    return luzDaNormal(Math.cos(a), Math.sin(a), 0, q)
  }

  // O DEGRAU: as lajes em volta (juntas de raio a raio), com musgo nas juntas e na beira.
  for (const z of alturas(0, zDegrau, 1)) {
    const topo = z >= zDegrau - 1e-6
    const juntas = (x: number, y: number): number => {
      const a = Math.atan2(y, x) + 0.35
      const laje = Math.floor(((a + Math.PI) / (2 * Math.PI)) * LAJES)
      return (Math.abs(Math.sin((a * LAJES) / 2)) < 0.05 ? -0.28 : 0) + 0.07 * (hash(laje, 1, 7501) - 0.5) - (Math.hypot(x, y) > rDegrau - 1.4 ? 0.05 : 0)
    }
    const musgo = (x: number, y: number): number => manchaDeMusgo(x * 1.1, y * 1.1 + z, 41, -0.02)
    f.fatia(0, z, disco(0, 0, rDegrau), pedra, topo
      ? { tabua: 0, bisel: 1.1, tom: 0.86, contorno: 0.26, textura: comPedra(z, juntas, musgo), semente: 7502 }
      : lisa(0.8, comPedra(z, (x, y) => ladoDoDisco(x, y) - (z < 1 ? 0.15 : 0), musgo), 7503))
  }

  // O TAMBOR com a GRECA: em cada fatia, o friso de degraus naquela altura (o sulco e o rebaixo debaixo da linha).
  const de = zDegrau + 2
  const ate = zTambor - 2
  const passoDoNivel = (ate - de) / 4.4
  const zDoNivel = (n: number): number => de + 0.7 + (n + 0.5) * passoDoNivel
  for (const z of alturas(zDegrau, zTambor, PASSO_DAS_FATIAS).slice(1)) {
    const friso = (x: number, y: number): number => {
      let luz = ladoDoDisco(x, y)
      if (Math.abs(z - de) < 0.6 || Math.abs(z - ate) < 0.6) return luz - 0.18
      if (z < de || z > ate) return luz
      const volta = ((Math.atan2(y, x) + Math.PI) / (2 * Math.PI)) * GRECAS
      const u = volta - Math.floor(volta)
      const nivel = nivelDaGreca(u)
      const zn = zDoNivel(nivel)
      // Debaixo da linha, a pedra rebaixada; a linha e os espelhos, o sulco.
      if (z < zn) luz -= 0.07
      if (Math.abs(z - zn) < 0.55) return luz - 0.2
      // O espelho do degrau: onde o nível de um nada antes (na volta anterior, no começo) é outro.
      const anterior = nivelDaGreca(u < ESPELHO ? u + 1 - ESPELHO : u - ESPELHO)
      if (anterior !== nivel) {
        const [z0, z1] = [zDoNivel(Math.min(anterior, nivel)), zDoNivel(Math.max(anterior, nivel))]
        if (z > z0 - 0.5 && z < z1 + 0.5) luz -= 0.2
      }
      return luz
    }
    const musgo = (x: number, y: number): number => (z < zDegrau + 4 ? (1 - (z - zDegrau) / 4) * manchaDeMusgo(x * 1.3, y * 1.3 + z, 43, -0.12) : 0)
    f.fatia(0, z, disco(0, 0, rTambor), pedra, lisa(0.93, comPedra(z, friso, musgo), 7510))
  }

  // O LÁBIO e a LAJE DE CIMA com o entalhe hexagonal.
  const [lx, ly] = noObjeto(-0.79 * SOMBRA_DO_REBAIXO, -0.61 * SOMBRA_DO_REBAIXO, q)
  const naFaixa = (x: number, y: number): boolean => hexagono(x, y, rLabio * ENTALHE.faixaFora) < 0 && hexagono(x, y, rLabio * ENTALHE.faixaDentro) > 0
  const entalhe = (x: number, y: number): number => {
    const rr = Math.hypot(x, y)
    let luz = 0.03 + 0.05 * ruido(x * 0.4, y * 0.4)
    if (Math.abs(rr - rLabio * ENTALHE.sulco) < TRACO) return luz - 0.26
    const hFora = hexagono(x, y, rLabio * ENTALHE.faixaFora)
    const hDentro = hexagono(x, y, rLabio * ENTALHE.faixaDentro)
    if (Math.abs(hFora) < TRACO * 0.8 || Math.abs(hDentro) < TRACO * 0.8) return luz - 0.22
    if (naFaixa(x, y)) {
      // O fundo da faixa, rebaixado; a parede do lado da luz faz sombra dentro dela.
      luz -= 0.1
      if (!naFaixa(x + lx, y + ly)) luz -= 0.12
      return luz
    }
    // Os seis raios: das quinas do hexágono de fora até o sulco.
    if (hFora > 0 && rr < rLabio * ENTALHE.sulco) {
      for (let k = 0; k < 6; k += 1) {
        const a = Math.PI / 6 + (k * Math.PI) / 3
        if (Math.abs(-x * Math.sin(a) + y * Math.cos(a)) < TRACO * 0.8 && x * Math.cos(a) + y * Math.sin(a) > 0) return luz - 0.2
      }
    }
    // O botão no meio: um hexágono em relevo com o ponto.
    const hBotao = hexagono(x, y, rLabio * ENTALHE.botao)
    if (Math.abs(hBotao) < TRACO * 0.8) return luz - 0.2
    if (hBotao < 0) return rr < 1 ? luz - 0.24 : luz + 0.08
    return luz
  }
  const musgoDoLabio = (x: number, y: number): number => (Math.hypot(x, y) > rLabio * 0.72 ? manchaDeMusgo(x, y, 47, 0.12) : 0)
  for (const z of alturas(zTambor, zLabio, PASSO_DAS_FATIAS).slice(1)) {
    const t = (z - zTambor) / (zLabio - zTambor)
    const r = rTambor + (rLabio - rTambor) * Math.sin(Math.min(1, t * 1.6) * Math.PI * 0.5)
    if (z >= zLabio - 1e-6) {
      f.fatia(0, z, disco(0, 0, rLabio), pedra, { tabua: 0, bisel: 1.4, tom: 1.02, contorno: 0.27, textura: comPedra(0, entalhe, musgoDoLabio), semente: 7520 })
    } else {
      f.fatia(0, z, disco(0, 0, r), pedra, lisa(0.96, comPedra(z, (x, y) => ladoDoDisco(x, y) + 0.03, () => 0), 7521))
    }
  }
  f.fechar()

  // A sombra do tambor e o contato do degrau.
  cena.sombras.push(sombraDoCilindro(0, 0, rLabio * 0.96, zLabio, q, 0.22, 1.8), contato(disco(0, 0, rDegrau), 0.32))
}
