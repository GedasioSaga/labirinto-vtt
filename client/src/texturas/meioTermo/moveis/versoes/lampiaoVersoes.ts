/**
 * As VERSÕES do lampião (lote L06 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`): a 1ª, DE
 * PÉ (o lampião de vidro âmbar no alto do poste, de hoje), é o desenho de `MONTADORES` (`../lampiao.ts`). As outras:
 *
 * - POSTE DE RUA: o poste de ferro com o BRAÇO que sai para o lado e a LANTERNA pendurada na ponta dele, de vidro âmbar
 *   e telhado sextavado com a argola. De cima se lê pelo braço (a lanterna fora do meio do poste) e pela sombra, que
 *   desenha o poste, o braço e a lanterna no chão.
 * - POSTE A GÁS: a coluna de ferro alta da rua vitoriana, a lanterna de quatro vidros no topo (o vidro abre para cima,
 *   então de cima ele aparece em volta do telhado), o telhado em pirâmide com a coroa e o pináculo, e a TRAVESSA de
 *   apoio da escada saindo para os dois lados. A luz do gás é mais branca que a do óleo: creme, não âmbar.
 *
 * Como o de hoje: o vidro aceso é em parte emissão (a cor própria vale mais que a luz), o halo quente no chão é fraco e
 * a sombra do poste vai pintada no chão, desgirada pelo quarto de volta (`desgirado`), sempre para baixo à direita. A
 * luz DE VERDADE é a do tipo (`LUZ_DOS_OBJETOS`); a do gás pede um tom mais branco (no relatório do L06). Lugar de
 * material: `metal`, como o tipo (o poste, o braço, os telhados e a travessa).
 */
import { anel, caixa, capsula, elipse, poligono, uniao, type Forma, type Ponto } from '../formas'
import { SOMBRA_X, SOMBRA_Y, type Cena, type MaterialDaPeca, type Textura } from '../motor'
import type { ContextoDoMovel, MontarMovel } from '../contexto'
import { desgirado } from '../tesouroDeOuro'
import type { VersoesDesenhadas } from '.'

type Rgb3 = readonly [number, number, number]

/** A luz de cada lanterna: a cor do vidro, o miolo junto do telhado e o halo no chão. */
interface Chama {
  readonly vidro: Rgb3
  readonly miolo: Rgb3
  readonly halo: Rgb3
}
/** O óleo da lanterna de rua: o âmbar do lampião de hoje. */
const OLEO: Chama = { vidro: [0xd9, 0xa8, 0x5a], miolo: [0xef, 0xd0, 0x8a], halo: [226, 170, 96] }
/** O gás: creme claro, mais branco que o óleo, sem passar de 245. */
const GAS: Chama = { vidro: [0xdc, 0xcf, 0x9e], miolo: [0xf2, 0xe9, 0xc6], halo: [232, 206, 150] }
const EMISSAO_DO_VIDRO = 0.55
const ALFA_DO_HALO = 0.1
/** O halo vai até `HALO_EM_RAIOS` vezes o meio lado da pegada (o de hoje). */
const HALO_EM_RAIOS = 4.8
/** A largura do miolo claro, em px do protótipo. */
const LARGURA_DO_MIOLO = 2.4
/** As alturas, em casas: o braço e a lanterna de rua; o topo da coluna a gás e a travessa. */
const ALTURA_DO_BRACO = 1.7
const ALTURA_DA_LANTERNA = 1.45
const ALTURA_DO_GAS = 2.1
const ALTURA_DA_TRAVESSA = 1.75

function misturar(a: Rgb3, b: Rgb3, t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

/** O vidro aceso em volta de (cx, cy): mais claro colado no telhado de meia largura `chapeu`, em parte emissão. */
function texVidro(chama: Chama, cx: number, cy: number, chapeu: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const d = Math.max(Math.abs(x - cx), Math.abs(y - cy)) - chapeu
    const t = Math.max(0, Math.min(1, 1 - d / LARGURA_DO_MIOLO))
    const c = misturar(chama.vidro, chama.miolo, t)
    s[0] = c[0]
    s[1] = c[1]
    s[2] = c[2]
    s[4] = EMISSAO_DO_VIDRO
  }
}

/** O halo: a cor quente com alfa que cai suave do centro (cx, cy) até `r`. */
function texHalo(chama: Chama, cx: number, cy: number, r: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const q = Math.min(1, ((x - cx) ** 2 + (y - cy) ** 2) / (r * r))
    s[0] = chama.halo[0]
    s[1] = chama.halo[1]
    s[2] = chama.halo[2]
    s[4] = 1
    s[5] = ALFA_DO_HALO * (1 - q) * (1 - q)
  }
}

/** O vidro (o material da peça; a cor sai da textura). */
function vidroDe(chama: Chama): MaterialDaPeca {
  return { classe: 'liso', rgb: chama.vidro }
}

/** O halo no chão em volta de (cx, cy), por baixo de tudo. */
function halo(c: ContextoDoMovel, cena: Cena, chama: Chama, cx: number, cy: number): void {
  const r = HALO_EM_RAIOS * Math.min(c.hw, c.hh)
  cena.partes.push(c.peca(elipse(cx, cy, r, r), vidroDe(chama), { textura: texHalo(chama, cx, cy, r), bisel: 0, contorno: 0, semente: 6500 }))
}

/** O ponto do chão onde cai a sombra do ponto (x, y) que está na altura `z` (px), desgirada pelo quarto de volta. */
function naSombra(c: ContextoDoMovel, x: number, y: number, z: number): Ponto {
  const [sx, sy] = desgirado(SOMBRA_X * z, SOMBRA_Y * z, c.giro)
  return [x + sx, y + sy]
}

/** O polígono regular de `lados` lados em volta de (cx, cy), raio `r`, girado `a0`. */
function regular(cx: number, cy: number, r: number, lados: number, a0: number): Forma {
  const pontos: Ponto[] = []
  for (let i = 0; i < lados; i += 1) {
    const a = a0 + (i / lados) * 2 * Math.PI
    pontos.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r])
  }
  return poligono(pontos)
}

/** POSTE DE RUA: o poste no meio da pegada, o braço para a direita e a lanterna pendurada na ponta. */
const posteDeRua: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const R = Math.min(hw, hh)
  const k = R / 6.6
  const metal = c.m.metal
  const L = cena.partes
  const [lx, ly] = [0.58 * R, 0.06 * R]
  const [hBraco, hLanterna] = [g * ALTURA_DO_BRACO, g * ALTURA_DA_LANTERNA]
  // As sombras no chão: o poste arrastado do pé até o braço, o braço deitado e a lanterna solta no ar.
  const [px, py] = naSombra(c, 0, 0, hBraco)
  cena.sombras.push({ forma: capsula(0, 0, px, py, 1.1 * k), z: 0, suave: 1.6, forca: 0.34 })
  const [bx, by] = naSombra(c, lx, 0, hBraco)
  cena.sombras.push({ forma: capsula(px, py, bx, by, 0.55 * k), z: 0, suave: 1.3, forca: 0.24 })
  cena.sombras.push({ forma: regular(lx, ly, 3.6 * k, 6, Math.PI / 6), z: hLanterna, solta: true, forca: 0.22 })
  halo(c, cena, OLEO, lx, ly)
  // O pé do poste: a base quadrada larga, de ferro, por baixo do resto.
  L.push(P(caixa(-1.9 * k, -1.9 * k, 1.9 * k, 1.9 * k, 0.5 * k), metal, { bisel: 0.8 * k, tom: 0.9, contorno: 0.3, semente: 6501 }))
  // A lanterna: o vidro sextavado aceso e, por cima, o telhado de seis águas com a argola.
  L.push(P(regular(lx, ly, 3.7 * k, 6, Math.PI / 6), vidroDe(OLEO), { bisel: 0.6 * k, contorno: 0.14, textura: texVidro(OLEO, lx, ly, 2.2 * k), semente: 6502 }))
  L.push(P(regular(lx, ly, 2.5 * k, 6, Math.PI / 6), metal, { bisel: 1.7 * k, contorno: 0.3, semente: 6503 }))
  // O braço de ferro, do topo do poste até em cima da lanterna, com a argola de onde ela pende.
  L.push(P(capsula(0, 0, lx, ly, 0.62 * k), metal, { bisel: 0.6 * k, tom: 1.05, contorno: 0.3, metal: 0.35, semente: 6504 }))
  L.push(P(anel(lx, ly, 1.05 * k, 1.05 * k, 0.55 * k, 0.55 * k), metal, { bisel: 0.4 * k, tom: 0.85, contorno: 0.25, semente: 6505 }))
  // O topo do poste: o capitel redondo e a bola do remate.
  L.push(P(elipse(0, 0, 1.45 * k, 1.45 * k), metal, { bisel: 1 * k, contorno: 0.3, metal: 0.35, semente: 6506 }))
  L.push(P(elipse(-0.2 * k, -0.2 * k, 0.65 * k, 0.65 * k), metal, { bisel: 0.5 * k, tom: 1.25, contorno: 0.15, metal: 0.45, semente: 6507 }))
}

/** POSTE A GÁS: a coluna no meio, a lanterna de quatro vidros no topo e a travessa da escada. */
const posteAGas: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const R = Math.min(hw, hh)
  const k = R / 6.6
  const metal = c.m.metal
  const L = cena.partes
  const [hTopo, hTravessa] = [g * ALTURA_DO_GAS, g * ALTURA_DA_TRAVESSA]
  // A lanterna fica um nada à frente do pé da coluna (`oy`): na 3/4 derivada a peça com o meio dentro do poste vai com
  // o poste, e a frente da lanterna a cobria (sobrava um quadrado liso); assim a coluna sai de ferro e a lanterna
  // aparece inteira em cima dela.
  const oy = 1.2 * k
  // As sombras: a coluna até a lanterna, a travessa de través e a lanterna solta.
  const [px, py] = naSombra(c, 0, 0, hTopo)
  cena.sombras.push({ forma: capsula(0, 0, px, py, 1.25 * k), z: 0, suave: 1.6, forca: 0.34 })
  const [ax, ay] = naSombra(c, -5.6 * k, oy, hTravessa)
  const [bx, by] = naSombra(c, 5.6 * k, oy, hTravessa)
  cena.sombras.push({ forma: capsula(ax, ay, bx, by, 0.5 * k), z: 0, suave: 1.2, forca: 0.22 })
  cena.sombras.push({ forma: caixa(-4.4 * k, oy - 4.4 * k, 4.4 * k, oy + 4.4 * k, 0.8 * k), z: hTopo, solta: true, forca: 0.22 })
  halo(c, cena, GAS, 0, oy)
  // A travessa da escada, por baixo da lanterna, passando dos dois lados, com a bola na ponta: uma peça só, com o meio
  // no da lanterna (na 3/4 ela sobe junto; as bolas soltas ficavam no chão).
  const bolas = uniao(elipse(-5.8 * k, oy, 0.85 * k, 0.85 * k), elipse(5.8 * k, oy, 0.85 * k, 0.85 * k))
  L.push(P(uniao(capsula(-5.6 * k, oy, 5.6 * k, oy, 0.5 * k), bolas), metal, { bisel: 0.55 * k, contorno: 0.3, metal: 0.38, semente: 6510 }))
  // A lanterna: os quatro vidros acesos entre as arestas de ferro, abrindo para cima.
  L.push(P(caixa(-4.3 * k, oy - 4.3 * k, 4.3 * k, oy + 4.3 * k, 0.6 * k), vidroDe(GAS), { bisel: 0.6 * k, contorno: 0.14, textura: texVidro(GAS, 0, oy, 3 * k), semente: 6512 }))
  const arestas = [0, 1, 2, 3].map((i) => {
    const sx = i % 2 === 0 ? 1 : -1
    const sy = i < 2 ? 1 : -1
    return capsula(sx * 4.2 * k, oy + sy * 4.2 * k, sx * 2.6 * k, oy + sy * 2.6 * k, 0.42 * k)
  })
  L.push(P(arestas.reduce(uniao), metal, { bisel: 0.4 * k, contorno: 0.28, metal: 0.35, semente: 6513 }))
  // O telhado em pirâmide (o chanfro largo faz as quatro águas), a coroa em volta do topo e o pináculo.
  L.push(P(caixa(-3.1 * k, oy - 3.1 * k, 3.1 * k, oy + 3.1 * k, 0.5 * k), metal, { bisel: 2.6 * k, contorno: 0.3, semente: 6514 }))
  L.push(P(anel(0, oy, 1.5 * k, 1.5 * k, 0.9 * k, 0.9 * k), metal, { bisel: 0.4 * k, tom: 1.15, contorno: 0.25, metal: 0.4, semente: 6515 }))
  L.push(P(elipse(-0.15 * k, oy - 0.15 * k, 0.6 * k, 0.6 * k), metal, { bisel: 0.45 * k, tom: 1.3, contorno: 0.15, metal: 0.5, semente: 6516 }))
}

/** Ids na ordem do painel, depois da 1ª ("De pé", a de hoje): posteDeRua, posteAGas. */
export const versoesDoLampiao: VersoesDesenhadas = { posteDeRua, posteAGas }
