/**
 * TANQUE COM BORDA DE PEDRA (lote L07 "Selva: ruína e água", 24/11/2026; construção nova). O espelho d'água
 * retangular do pátio da ruína: a ÁGUA verde-azulada apagada, calma e funda (mais escura junto das paredes, sobretudo
 * do lado da luz, onde cai a sombra da borda, e um nada mais clara no meio), com marolas compridas, um reflexo de céu
 * em faixa larga e o sedimento escuro no fundo; dentro da moldura de LAJES de pedra (os quatro cantos em bloco mais
 * alto, as lajes compridas entre eles, a beira de dentro molhada e o musgo nas juntas e nos cantos). Três folhas de
 * vitória-régia pequenas e um botão claro, num canto, dizem que a água é parada.
 *
 * É chão: rente, NÃO barra (o mestre decide se a água se atravessa). A borda sobe um fio na 3/4 (a espessura da laje)
 * e a água fica onde está. Medidas fixas em px do protótipo: o tanque maior ganha mais lajes, nunca laje esticada.
 * Perfil da 3/4: `DERIVADO`. Material: `pedra` (a borda; sugestão: arenito); a água e as folhas são fixas.
 */
import { hash, type Rgb } from '../../ruido'
import { caixa, elipse, menos, poligono, type Forma, type Ponto } from './formas'
import { ruido, type MaterialDaPeca, type Textura } from './motor'
import { QUARTO, type MontarMovel } from './contexto'
import { quartosDoGiro } from './pipaDeitada'
import { ladoMaior, lascar, limitar, manchaDeMusgo, misturarCor, musgar, musgoDoAlto, pedraDeLaje, rumoUnitario, sombraDaBeira, suave } from './muroEmRuina'

/**
 * A água: verde-azulada apagada (saturação HSL ~0,16; a turquesa de antes, chapada, lia como piscina), a folha da
 * vitória-régia (oliva) e o botão (creme rosado).
 */
const AGUA: MaterialDaPeca = { classe: 'liso', rgb: [0x55, 0x7a, 0x76] }
const FOLHA: MaterialDaPeca = { classe: 'folha', rgb: [0x6a, 0x7b, 0x4c] }
const BOTAO: MaterialDaPeca = { classe: 'liso', rgb: [0xdc, 0xc8, 0xbc] }
/** O sedimento e as folhas podres no fundo: oliva escuro, em manchas macias. */
const SEDIMENTO: Rgb = [0x3d, 0x48, 0x38]
/** As manchas do fundo: [x, y (frações do meio lado de dentro), raio (fração do menor meio lado de dentro), força]. */
const MANCHAS_DO_FUNDO: readonly (readonly [number, number, number, number])[] = [
  [-0.52, 0.3, 0.34, 0.42],
  [0.02, -0.42, 0.26, 0.34],
  [0.4, 0.18, 0.2, 0.3],
]
/** A fundura: até onde a parede escurece a água (px), quanto (luz) e o quanto o meio clareia. */
const FUNDURA = { alcance: 11, perto: -0.2, meio: 0.04 } as const
/** A largura da borda (casas), o comprimento de uma laje dela (casas, de partida e quanto varia) e a meia folga (px). */
const BORDA = 0.3
const LAJE = 0.55
const LAJE_QUE_VARIA = 0.2
const FOLGA = 0.4
/** O canto da borda: um bloco mais alto que as lajes (tom, chanfro e a sombra curta que ele faz nelas). */
const CANTO = { tom: 1.04, bisel: 2.1, projeta: { dist: 1.5, forca: 0.32 } } as const
/** A espessura da laje da borda (px): o quanto ela sobe na 3/4 e a sombra curta que faz fora. */
const ESPESSURA = 2
/** A sombra da borda dentro da água: a profundidade (px, para o lado da luz) e a força. */
const SOMBRA_NA_AGUA = { k: 6, forca: 0.42 } as const
/** As folhas: [x, y (frações do meio lado de dentro, a partir do canto de baixo à direita), raio (casas), giro do corte]. */
const FOLHAS: readonly (readonly [number, number, number, number])[] = [
  [0.78, 0.62, 0.13, 0.6],
  [0.56, 0.78, 0.1, 2.4],
  [0.86, 0.3, 0.085, -1.2],
]

/**
 * A água: funda junto das paredes (mais do lado da luz), marolas compridas e fracas, o reflexo do céu em faixa larga
 * e o sedimento do fundo. Sem os brilhos das cristas: em fileira, liam como piscina.
 */
function texDaAgua(ix: number, iy: number, rumo: readonly [number, number]): Textura {
  const menor = Math.min(ix, iy)
  return (_u, _v, x, y, _p, s) => {
    const aoLado = ix - Math.abs(x)
    const aoTopo = iy - Math.abs(y)
    const [nx, ny] = aoLado < aoTopo ? [Math.sign(x), 0] : [0, Math.sign(y)]
    const daLuz = limitar(0.5 - 0.9 * (nx * rumo[0] + ny * rumo[1]), 0, 1)
    const fundo = suave(0, FUNDURA.alcance, Math.min(aoLado, aoTopo))
    let luz = FUNDURA.perto * (1 - fundo) * (0.55 + 0.45 * daLuz) + FUNDURA.meio * fundo
    luz += ruido(x * 0.085 + 4.1, y * 0.24) * 0.05 + ruido(x * 0.3, y * 0.5 + 9) * 0.025
    const faixa = (x * 0.55 + y * 0.83 + iy * 0.2) / (iy * 0.45)
    luz += 0.045 * Math.exp(-faixa * faixa)
    s[3] += luz
    for (const [mx, my, mr, forca] of MANCHAS_DO_FUNDO) {
      const dx = x - mx * ix
      const dy = y - my * iy
      const r = mr * menor * (1 + 0.35 * ruido(x * 0.16 + mx * 9, y * 0.16 + my * 7))
      const t = Math.exp(-(dx * dx + dy * dy) / (r * r))
      if (t > 0.02) misturarCor(s, SEDIMENTO, forca * t)
    }
  }
}

/** A folha da vitória-régia: as nervuras do meio para a beira e a beira um nada mais clara. */
function texDaFolha(cx: number, cy: number, raio: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const dx = x - cx
    const dy = y - cy
    const longe = Math.hypot(dx, dy)
    let luz = Math.abs(Math.sin(Math.atan2(dy, dx) * 6)) < 0.12 && longe > raio * 0.2 ? -0.06 : 0
    if (longe > raio - 1) luz += 0.06
    s[3] += luz + ruido(x * 0.6, y * 0.6) * 0.04
  }
}

export const montarTanqueComBorda: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const pedra = c.m.pedra
  const L = cena.partes
  const rumo = rumoUnitario(quartosDoGiro(c.giro))
  const B = Math.min(g * BORDA, hw * 0.45, hh * 0.45)
  const [ix, iy] = [hw - B, hh - B]

  // A ÁGUA, um nada por baixo da borda, com a sombra da borda do lado da luz.
  L.push(P(caixa(-ix - 1.5, -iy - 1.5, ix + 1.5, iy + 1.5), AGUA, { tabua: 0, bisel: 0, contorno: 0, recesso: SOMBRA_NA_AGUA, textura: texDaAgua(ix, iy, rumo), semente: 6600 }))

  // As FOLHAS e o botão, no canto de baixo à direita.
  FOLHAS.forEach(([fx, fy, fr, corte], i) => {
    const raio = g * fr
    const [cx, cy] = [ix * fx, iy * fy]
    const fenda = poligono([[cx, cy], [cx + Math.cos(corte - 0.22) * raio * 1.3, cy + Math.sin(corte - 0.22) * raio * 1.3], [cx + Math.cos(corte + 0.22) * raio * 1.3, cy + Math.sin(corte + 0.22) * raio * 1.3]])
    L.push(P(menos(elipse(cx, cy, raio, raio * 0.94), fenda), FOLHA, { tabua: 0, bisel: 0.9, tom: 0.96 + 0.08 * i, contorno: 0.24, textura: texDaFolha(cx, cy, raio), semente: 6610 + i, projeta: { dist: 0.9, forca: 0.3 } }))
  })
  const [bx, by] = [ix * 0.68, iy * 0.46]
  for (let k = 0; k < 5; k += 1) {
    const a = (k / 5) * 2 * Math.PI - 0.4
    L.push(P(elipse(bx + Math.cos(a) * 1.2, by + Math.sin(a) * 1.2, 1.5, 1.5), BOTAO, { tabua: 0, bisel: 0.6, tom: 0.96 + 0.05 * (k % 2), contorno: 0.2, semente: 6620 + k, projeta: { dist: 0.6, forca: 0.22 } }))
  }

  // A BORDA: o leito escuro das juntas, os cantos em bloco e as lajes compridas entre eles.
  const fora = caixa(-hw, -hh, hw, hh)
  const anel = menos(fora, caixa(-ix, -iy, ix, iy))
  cena.sombras.push({ forma: anel, z: ESPESSURA, forca: 0.24 })
  L.push(P(menos(caixa(-hw + 0.3, -hh + 0.3, hw - 0.3, hh - 0.3, 0.8), caixa(-ix + 0.4, -iy + 0.4, ix - 0.4, iy - 0.4)), pedra, { tabua: 0, bisel: 0.5, tom: 0.56, contorno: 0.24, semente: 6630 }))
  const laje = (pontos: readonly Ponto[], tom: number, semente: number, eixo: number, canto: boolean): void => {
    const forma: Forma = poligono(pontos)
    const daPedra = pedraDeLaje(pedra, semente, ladoMaior(forma))
    const textura: Textura = (u, v, x, y, p, s, escala) => {
      daPedra(u, v, x, y, p, s, escala)
      // A beira de dentro, molhada; o musgo das juntas (mais do lado da sombra) e dos cantos.
      const aoEspelho = Math.min(ix - Math.abs(x), iy - Math.abs(y))
      if (aoEspelho > -2.2 && aoEspelho < 0) s[3] -= 0.1 * (1 + aoEspelho / 2.2)
      const naJunta = musgoDoAlto(manchaDeMusgo(x, y, 6640, -0.06), -forma.d(x, y), sombraDaBeira(forma, x, y, rumo), x, y, semente)
      const noCanto = canto ? 0.35 * manchaDeMusgo(x * 1.3, y * 1.3, 6641, -0.2) : 0
      musgar(s, Math.max(naJunta, noCanto), x, y)
    }
    const opcoes = { tabua: 0, eixo, bisel: canto ? CANTO.bisel : 1.3, tom, contorno: 0.25, textura, semente }
    L.push(P(forma, pedra, canto ? { ...opcoes, projeta: CANTO.projeta } : opcoes))
  }
  /** Um lado da borda: as lajes ao comprido entre os cantos, cada uma do seu tamanho e tom, uma ou outra lascada. */
  const lado = (deitado: boolean, de: number, ate: number, v0: number, v1: number, sal: number): void => {
    const n = Math.max(1, Math.round((ate - de) / (g * LAJE)))
    const cortes: number[] = [de]
    for (let i = 1; i < n; i += 1) cortes.push(de + ((ate - de) * (i + (hash(i, 1, sal) - 0.5) * 2 * LAJE_QUE_VARIA)) / n)
    cortes.push(ate)
    for (let i = 0; i + 1 < cortes.length; i += 1) {
      const [u0, u1] = [cortes[i] + FOLGA, cortes[i + 1] - FOLGA]
      let pontos: Ponto[] = deitado ? [[u0, v0], [u1, v0], [u1, v1], [u0, v1]] : [[v0, u0], [v1, u0], [v1, u1], [v0, u1]]
      if (hash(i, 2, sal) < 0.22) pontos = lascar(pontos, Math.floor(hash(i, 3, sal) * 4), 2)
      laje(pontos, 0.9 + 0.12 * hash(i, 4, sal), sal + 10 + i, deitado ? 0 : QUARTO, false)
    }
  }
  lado(true, -ix, ix, -hh + 0.3, -iy - FOLGA, 6660)
  lado(true, -ix, ix, iy + FOLGA, hh - 0.3, 6680)
  lado(false, -iy, iy, -hw + 0.3, -ix - FOLGA, 6700)
  lado(false, -iy, iy, ix + FOLGA, hw - 0.3, 6720)
  // Os cantos por último: o bloco mais alto faz a sombra curta dele nas lajes vizinhas.
  let k = 0
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const [x0, x1] = sx < 0 ? [-hw + 0.3, -ix - FOLGA] : [ix + FOLGA, hw - 0.3]
      const [y0, y1] = sy < 0 ? [-hh + 0.3, -iy - FOLGA] : [iy + FOLGA, hh - 0.3]
      laje([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], CANTO.tom, 6650 + k, 0, true)
      k += 1
    }
  }
}
