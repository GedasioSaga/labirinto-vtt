/**
 * LAMPIÃO de cima com volume (peça nova da MT4), portado do lampião do
 * protótipo da vila aprovado (`docs/design/vila/prototipo/vila.js:357-366`):
 * o poste alto faz uma sombra comprida no chão, a caixa de vidro ACESO aparece
 * em volta do chapéu de metal (pirâmide de chanfro largo), com a argola no
 * topo, e um halo quente fraco no chão. Material: `metal`.
 *
 * Revisão da MT4: a primeira versão apagou o vidro e tirou o halo, e o
 * lampião passou a ler como uma placa parafusada (moldura creme, pirâmide
 * cinza, 4 rebites). Agora, como no protótipo: o vidro é âmbar e em parte
 * emissão (0,55, a `texVidro` da vila: a cor própria vale mais que a luz), com
 * o miolo mais claro colado no chapéu e SEM chama desenhada; o chapéu ocupa
 * ~45% da largura (o vidro aparece); a argola de 1 px no lugar dos rebites; a
 * sombra do poste forte e larga o bastante para se ler a 1x; o halo como o da
 * fogueira (emissão, alfa que cai do centro). A luz DE VERDADE (a ferramenta
 * Luz ligada ao tipo) é decisão do usuário, pendente no plano.
 */
import { anel, caixa, capsula, elipse } from './formas'
import { SOMBRA_X, SOMBRA_Y, type MaterialDaPeca, type Textura } from './motor'
import type { MontarMovel } from './contexto'

type Rgb3 = readonly [number, number, number]

/** O vidro aceso: âmbar (#d9a85a) e o miolo junto ao chapéu (#efd08a). */
const AMBAR: Rgb3 = [0xd9, 0xa8, 0x5a]
const MIOLO: Rgb3 = [0xef, 0xd0, 0x8a]
const VIDRO: MaterialDaPeca = { classe: 'liso', rgb: AMBAR }
/** A parte da cor do vidro que não pega luz nem sombra (a `texVidro` da vila). */
const EMISSAO_DO_VIDRO = 0.55
/** O halo quente no chão: a cor do brilho da vila, alfa 0,10 no centro, até 1,2 casa no tamanho padrão. */
const COR_DO_HALO: Rgb3 = [226, 170, 96]
const ALFA_DO_HALO = 0.1
const HALO_EM_RAIOS = 4.8
/** Altura do lampião no poste, em casas. */
const ALTURA = 1.3
/** Meia largura do chapéu, em k (~45% da largura do vidro, 6,2k). */
const CHAPEU = 3.4
/** Largura do miolo claro, em px do protótipo (~2 px a 1x). */
const LARGURA_DO_MIOLO = 2.6

function misturar(a: Rgb3, b: Rgb3, t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

/** O vidro: âmbar, mais claro colado no chapéu (meia largura `chapeu`), em parte emissão. */
function texVidro(chapeu: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const d = Math.max(Math.abs(x), Math.abs(y)) - chapeu
    const t = Math.max(0, Math.min(1, 1 - d / LARGURA_DO_MIOLO))
    const c = misturar(AMBAR, MIOLO, t)
    s[0] = c[0]
    s[1] = c[1]
    s[2] = c[2]
    s[4] = EMISSAO_DO_VIDRO
  }
}

/** O halo: a cor quente com alfa que cai suave do centro até `r`. */
function texHalo(r: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const q = Math.min(1, (x * x + y * y) / (r * r))
    s[0] = COR_DO_HALO[0]
    s[1] = COR_DO_HALO[1]
    s[2] = COR_DO_HALO[2]
    s[4] = 1
    s[5] = ALFA_DO_HALO * (1 - q) * (1 - q)
  }
}

export const montarLampiao: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const R = Math.min(hw, hh)
  /** A vila desenhava a caixa com meia largura de 6,2: tudo escala por aqui. */
  const k = R / 6.6
  const H = c.g * ALTURA
  const metal = c.m.metal
  cena.sombras.push({ forma: capsula(0, 0, SOMBRA_X * H, SOMBRA_Y * H, 1.5 * k), z: 0, suave: 1.6, forca: 0.35 })
  cena.sombras.push({ forma: caixa(-6 * k, -6 * k, 6 * k, 6 * k, 1.6 * k), z: H, solta: true, forca: 0.22 })
  const L = cena.partes
  const halo = HALO_EM_RAIOS * R
  L.push(P(elipse(0, 0, halo, halo), VIDRO, { textura: texHalo(halo), bisel: 0, contorno: 0, semente: 469 }))
  L.push(P(caixa(-6.2 * k, -6.2 * k, 6.2 * k, 6.2 * k, 1.6 * k), VIDRO, { bisel: 1 * k, contorno: 0.12, textura: texVidro(CHAPEU * k), semente: 470 }))
  L.push(P(caixa(-CHAPEU * k, -CHAPEU * k, CHAPEU * k, CHAPEU * k, 1.3 * k), metal, { bisel: 3.1 * k, semente: 471 }))
  // A argola do topo, de 1 px a 1x: o que pendura o lampião no braço do poste.
  L.push(P(anel(0, 0, 1.3 * k, 1.3 * k, 0.75 * k, 0.75 * k), metal, { bisel: 0.5 * k, tom: 0.8, semente: 472 }))
}
