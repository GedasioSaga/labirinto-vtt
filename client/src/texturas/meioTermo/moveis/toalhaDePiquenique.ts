/**
 * TOALHA DE PIQUENIQUE COM CESTA de cima com volume (lote L11 dos objetos
 * novos, 14/11/2026, "Descanso e brincadeira"): a TOALHA xadrez estendida no
 * chão, um pouco torta e amarrotada, com a ponta do sudeste DOBRADA por cima
 * (o avesso, mais claro, à mostra); em cima, a CESTA de vime fechada, de
 * tampa em duas folhas e a ALÇA por cima, com a ponta do guardanapo xadrez
 * saindo da tampa; o PRATO com o pão e o queijo; a GARRAFA deitada, de vidro
 * verde, com a rolha; e duas MAÇÃS.
 *
 * O xadrez é o de toalha de mesa (o vichy): listras da cor da toalha nos dois
 * sentidos sobre o linho cru; onde só uma passa, meio tom; onde as duas se
 * cruzam, a cor cheia. A 25% de zoom sobram o retângulo quadriculado e a
 * cesta: é o que diz "piquenique" e não "tapete".
 *
 * Na 3/4 a toalha fica no chão (nenhuma estrutura contém o meio dela; o meio
 * fica livre de propósito) e o resto sobe: a cesta é uma coluna, a alça um
 * tampo no alto, o prato, o pão, a garrafa e as maçãs são colunas baixas.
 * Perfil derivado.
 *
 * Desenhada em 1,6 x 1,2 casas; a toalha sai da pegada e as coisas em cima,
 * de frações dela, com o tamanho tirado do menor lado. Materiais: `pano` (a
 * cor do xadrez). A cesta, a louça, o vidro, o pão, o queijo e as maçãs são
 * fixos.
 */
import { passoSuave, rgb, type Rgb } from '../../ruido'
import { anel, barra, caixa, capsula, dentroDe, elipseGirada, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type Cena, type MaterialDaPeca, type Textura } from './motor'
import { materialDaPeca, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'
import { tomDoMeio } from '../materiais'
import { circulo, noAr } from './tampoEmFatias'

/** A toalha: o meio tamanho (fração da meia pegada) e o quanto ela está torta (radianos). */
const MEIA_TOALHA_X = 0.92
const MEIA_TOALHA_Y = 0.88
const TORTA = -0.06
/** A ponta dobrada: quanto da toalha a dobra leva em cada lado do canto do sudeste (fração do lado). */
const DOBRA = 0.3
/** O xadrez: um quadrado de cada cor a cada tanto de px do protótipo. */
const PERIODO_DO_XADREZ = 7.2
const AMARROTADA = 0.32

/** Alturas em casas: a cesta, a alça, o prato, o pão, a garrafa deitada e as maçãs. */
const ALTURA_DA_CESTA = 0.3
const ALTURA_DA_ALCA = 0.44
const ALTURA_DO_PRATO = 0.025
/** A bisnaga deitada no prato (radianos). */
const RUMO_DO_PAO = -0.5
const ALTURA_DA_MACA = 0.08

const LINHO = materialDaPeca('linho')
const VIME: MaterialDaPeca = materialDaPeca('palha')
const ALCA: MaterialDaPeca = { classe: 'madeira', rgb: rgb(tomDoMeio('carvalho', 0.95)) }
const LOUCA: MaterialDaPeca = { classe: 'liso', rgb: [0xe2, 0xdc, 0xcf] }
const PAO: MaterialDaPeca = { classe: 'liso', rgb: [0xc0, 0x8a, 0x52] }
const MIOLO: MaterialDaPeca = { classe: 'liso', rgb: [0xe6, 0xd2, 0xa4] }
const QUEIJO: MaterialDaPeca = { classe: 'liso', rgb: [0xde, 0xbe, 0x6c] }
/** O vidro verde de garrafa, escuro e frio, e a rolha. */
const VIDRO: MaterialDaPeca = { classe: 'liso', rgb: [0x46, 0x66, 0x4c] }
const ROLHA: MaterialDaPeca = { classe: 'liso', rgb: [0xb0, 0x8a, 0x5e] }
/** O papel do rótulo, envelhecido: o creme claro chamava o olho mais que a garrafa. */
const ROTULO: MaterialDaPeca = { classe: 'liso', rgb: [0xc4, 0xb0, 0x86] }
const MACA: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('vinho', 1.3)) }
const FOLHA: MaterialDaPeca = materialDaPeca('alfeneiro')
const CABINHO: MaterialDaPeca = { classe: 'liso', rgb: [0x5a, 0x44, 0x30] }

/** O ponto (u, v) do referencial da toalha no mapa. */
function naToalha(u: number, v: number): Ponto {
  const co = Math.cos(TORTA)
  const si = Math.sin(TORTA)
  return [u * co - v * si, u * si + v * co]
}

/**
 * O XADREZ: as listras da cor do pano nos dois sentidos sobre o linho (meio tom onde uma passa, cor cheia onde as
 * duas cruzam), na trama do tecido. `avesso` = o lado de baixo, que aparece na dobra: o mesmo xadrez, desbotado.
 */
function texDoXadrez(pano: Rgb, avesso: boolean): Textura {
  const trama = texturaDaClasse('tecido')
  const co = Math.cos(-TORTA)
  const si = Math.sin(-TORTA)
  return (u, v, x, y, p, s, escala) => {
    if (trama !== null) trama(u, v, x, y, p, s, escala)
    const lu = x * co - y * si
    const lv = x * si + y * co
    // O degrau da listra tem meio pixel de cada lado: menos que isso pisca no tamanho de mesa.
    const borda = 0.5 / (escala * PERIODO_DO_XADREZ)
    const listra = (t: number): number => {
      const f = t / PERIODO_DO_XADREZ - Math.floor(t / PERIODO_DO_XADREZ)
      return passoSuave(0.5 - borda, 0.5 + borda, f) * (1 - passoSuave(1 - 2 * borda, 1, f))
    }
    const cor = (listra(lu) + listra(lv)) * (avesso ? 0.32 : 0.5)
    for (let i = 0; i < 3; i += 1) s[i] += (pano[i] - s[i]) * cor
    s[3] += ruido(x * 0.06 + p.su, y * 0.06) * 0.05 + (avesso ? 0.05 : 0)
  }
}

/** A toalha sem o canto dobrado e a aba dobrada por cima (o canto refletido na linha da dobra). */
function formasDaToalha(mx: number, my: number): { toalha: Forma; aba: Forma; dobra: [Ponto, Ponto] } {
  const a: Ponto = [mx - 2 * mx * DOBRA, my]
  const b: Ponto = [mx, my - 2 * my * DOBRA]
  const canto: Ponto = [mx, my]
  // O canto refletido na reta de a até b: é onde a ponta da toalha cai depois de dobrada.
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const t = ((canto[0] - a[0]) * dx + (canto[1] - a[1]) * dy) / (dx * dx + dy * dy)
  const pe: Ponto = [a[0] + dx * t, a[1] + dy * t]
  const refletido: Ponto = [2 * pe[0] - canto[0], 2 * pe[1] - canto[1]]
  const toalha = poligono([naToalha(-mx, -my), naToalha(mx, -my), naToalha(...b), naToalha(...a), naToalha(-mx, my)])
  const aba = poligono([naToalha(...a), naToalha(...b), naToalha(...refletido)])
  return { toalha, aba, dobra: [naToalha(...a), naToalha(...b)] }
}

/** A CESTA de vime: o corpo, a beira trançada, as duas folhas da tampa, o guardanapo saindo e a alça por cima. */
function montarCesta(c: ContextoDoMovel, cena: Cena, cx: number, cy: number, k: number, pano: MaterialDaPeca): void {
  const P = c.peca
  const mx = 13 * k
  const my = 9 * k
  const corpo = caixa(cx - mx, cy - my, cx + mx, cy + my, 3 * k)
  cena.sombras.push({ forma: corpo, z: c.g * ALTURA_DA_CESTA }, contato(corpo, 0.36))
  cena.partes.push(P(corpo, VIME, { bisel: 2.6 * k, contorno: 0.3, tom: 0.86, semente: 6500 }))
  const beira = 1.8 * k
  // As duas folhas da tampa, com o vão escuro no meio, onde elas se encontram.
  for (const lado of [-1, 1]) {
    const folha = caixa(lado < 0 ? cx - mx + beira : cx + 0.5 * k, cy - my + beira, lado < 0 ? cx - 0.5 * k : cx + mx - beira, cy + my - beira, 1.6 * k)
    cena.partes.push(P(folha, VIME, { eixo: QUARTO, bisel: 1.4 * k, contorno: 0.26, tom: 1.04 + lado * 0.03, semente: 6501 + lado }))
  }
  // A ponta do guardanapo xadrez saindo pelo vão, para o sul.
  const ponta = poligono([[cx - 3.2 * k, cy + my - beira - 0.5], [cx + 2.4 * k, cy + my - beira - 0.5], [cx + 0.4 * k, cy + my + 3.6 * k]])
  cena.partes.push(P(ponta, LINHO, { bisel: 0.8, contorno: 0.24, ruga: 0.4, semente: 6504, textura: texDoXadrez(pano.rgb, false) }))
  // A alça: o arco de madeira de um lado comprido ao outro, no alto, com a sombra no chão caída da altura dela.
  const zAlca = c.g * ALTURA_DA_ALCA
  const alca = noAr(cena, capsula(cx, cy - my + 0.6, cx, cy + my - 0.6, 1.3 * k), zAlca)
  cena.partes.push(P(alca, ALCA, { eixo: QUARTO, tabua: 0, bisel: 1.2 * k, contorno: 0.3, semente: 6505, projeta: { dist: 1.6, forca: 0.34, suave: 1 } }))
  cena.sombras.push({ forma: capsula(cx + SOMBRA_X * zAlca, cy - my + SOMBRA_Y * zAlca, cx + SOMBRA_X * zAlca, cy + my + SOMBRA_Y * zAlca, 1.3 * k), z: 0, suave: 1.8, forca: 0.18 })
  // As presilhas de couro da alça na beira.
  for (const lado of [-1, 1]) {
    const presilha = caixa(cx - 2 * k, cy + lado * (my - beira * 0.5) - 1.1 * k, cx + 2 * k, cy + lado * (my - beira * 0.5) + 1.1 * k, 0.6)
    cena.partes.push(P(presilha, CABINHO, { bisel: 0.6, contorno: 0.24, semente: 6506 + lado }))
  }
}

/**
 * O PRATO com o pão (a bisnaga com os cortes) e a fatia de queijo. O pão e o queijo não têm coluna: o meio deles
 * cai no prato e eles sobem com a coluna dele, pintados depois da louça. Com coluna própria, o pão subia com o prato
 * dentro (a frente do prato saía do pano da toalha) ou, fora do meio, era pintado antes do prato e sumia atrás dele.
 */
function montarPrato(c: ContextoDoMovel, cena: Cena, cx: number, cy: number, k: number): void {
  const P = c.peca
  const r = 8.4 * k
  const zPrato = c.g * ALTURA_DO_PRATO
  const prato = circulo(cx, cy, r)
  cena.sombras.push({ forma: prato, z: zPrato }, contato(prato, 0.3))
  cena.partes.push(P(prato, LOUCA, { bisel: 1.6 * k, contorno: 0.22, semente: 6510 }))
  cena.partes.push(P(anel(cx, cy, r * 0.74, r * 0.74, r * 0.68, r * 0.68), LOUCA, { bisel: 0.4, contorno: 0, tom: 0.9, semente: 6511 }))
  const [px, py] = [cx - 2.2 * k, cy - 2.6 * k]
  const pao = elipseGirada(px, py, 5.4 * k, 2.3 * k, RUMO_DO_PAO)
  cena.partes.push(P(pao, PAO, { bisel: 2 * k, contorno: 0.3, ruga: 0.3, semente: 6512, projeta: { dist: 1, forca: 0.3 } }))
  for (const t of [-0.45, 0, 0.45]) {
    const x = px + Math.cos(RUMO_DO_PAO) * t * 5.4 * k
    const y = py + Math.sin(RUMO_DO_PAO) * t * 5.4 * k
    cena.partes.push(P(elipseGirada(x, y, 0.6 * k, 1.7 * k, 0.3), MIOLO, { bisel: 0.5, contorno: 0.18, semente: 6513 }))
  }
  const queijo = poligono([[cx + 2.4 * k, cy + 2.2 * k], [cx + 6.4 * k, cy + 0.6 * k], [cx + 5.6 * k, cy + 5 * k]])
  cena.partes.push(P(queijo, QUEIJO, { bisel: 0.9 * k, contorno: 0.28, semente: 6514, projeta: { dist: 0.7, forca: 0.26 } }))
}

/** A GARRAFA deitada: o bojo, o ombro, o gargalo, a rolha e o brilho do vidro. */
function montarGarrafa(c: ContextoDoMovel, cena: Cena, cx: number, cy: number, ang: number, k: number): void {
  const P = c.peca
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  const em = (t: number): Ponto => [cx + co * t * k, cy + si * t * k]
  const r = 2.9 * k
  const [x0, y0] = em(-8)
  const [x1, y1] = em(4)
  const [x2, y2] = em(10.5)
  const bojo = capsula(x0, y0, x1, y1, r)
  const gargalo = capsula(x1, y1, x2, y2, r * 0.42)
  const garrafa = uniao(bojo, gargalo)
  // Coluna mais baixa que o diâmetro: da altura dele, a garrafa deitada virava um tijolo verde na 3/4.
  cena.sombras.push({ forma: garrafa, z: r * 1.1 }, contato(bojo, 0.34))
  cena.partes.push(P(gargalo, VIDRO, { eixo: ang, bisel: r * 0.4, contorno: 0.3, metal: 0.4, semente: 6520 }))
  cena.partes.push(P(bojo, VIDRO, { eixo: ang, bisel: r * 0.9, contorno: 0.3, metal: 0.5, semente: 6521 }))
  const [x3, y3] = em(11.6)
  cena.partes.push(P(capsula(x2, y2, x3, y3, r * 0.46), ROLHA, { eixo: ang, bisel: 0.5, contorno: 0.26, semente: 6522 }))
  // O rótulo de papel na barriga: uma cinta estreita (largo e branco, ele virava a garrafa inteira).
  const [xa, ya] = em(-3.6)
  const [xb, yb] = em(-0.6)
  cena.partes.push(P(dentroDe(bojo, barra(xa, ya, xb, yb, r * 2.4)), ROTULO, { eixo: ang, bisel: r * 0.7, contorno: 0.2, semente: 6523 }))
}

/** Uma MAÇÃ: a fruta, o cabinho e a folha. */
function montarMaca(c: ContextoDoMovel, cena: Cena, cx: number, cy: number, k: number, semente: number): void {
  const P = c.peca
  const r = 3.1 * k
  const maca = circulo(cx, cy, r)
  cena.sombras.push({ forma: maca, z: c.g * ALTURA_DA_MACA }, contato(maca, 0.3))
  cena.partes.push(P(maca, MACA, { bisel: r, contorno: 0.3, semente }))
  cena.partes.push(P(elipseGirada(cx + 1.2 * k, cy - 0.9 * k, 1.5 * k, 0.75 * k, -0.6), FOLHA, { bisel: 0.5, contorno: 0.26, semente: semente + 1 }))
  cena.partes.push(P(circulo(cx + 0.1 * k, cy - 0.2 * k, 0.55 * k), CABINHO, { bisel: 0.3, contorno: 0, semente: semente + 2 }))
}

export const montarToalhaDePiquenique: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const k = Math.min(hw, hh) / 33.6
  const pano = c.m.pano
  const mx = hw * MEIA_TOALHA_X
  const my = hh * MEIA_TOALHA_Y
  const { toalha, aba, dobra } = formasDaToalha(mx, my)

  cena.sombras.push(contato(toalha, 0.22))
  cena.partes.push(P(toalha, LINHO, { bisel: 1.6, contorno: 0.2, ruga: AMARROTADA, semente: 6530, textura: texDoXadrez(pano.rgb, false) }))
  // A aba dobrada, com a sombra fina na toalha ao longo da beira solta e a dobra mais clara.
  cena.partes.push(P(aba, LINHO, { bisel: 1.2, contorno: 0.22, ruga: AMARROTADA, semente: 6531, textura: texDoXadrez(pano.rgb, true), projeta: { dist: 0.9, forca: 0.3, suave: 0.8 } }))
  cena.partes.push(P(capsula(dobra[0][0], dobra[0][1], dobra[1][0], dobra[1][1], 0.8), LINHO, { bisel: 0.8, contorno: 0, tom: 1.1, alfa: 0.6, semente: 6532 }))

  // As coisas em cima, fora do meio da toalha (o meio livre deixa a toalha no chão na 3/4).
  montarPrato(c, cena, ...naToalha(-hw * 0.44, hh * 0.22), k)
  montarMaca(c, cena, ...naToalha(-hw * 0.12, -hh * 0.44), k, 6540)
  montarMaca(c, cena, ...naToalha(-hw * 0.26, -hh * 0.58), k, 6543)
  montarGarrafa(c, cena, ...naToalha(hw * 0.06, hh * 0.5), -0.32, k)
  montarCesta(c, cena, ...naToalha(hw * 0.44, -hh * 0.3), k, pano)
}
