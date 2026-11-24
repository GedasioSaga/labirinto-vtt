/**
 * COLUNA COM GLIFOS (lote L07 "Selva: ruína e água", 24/11/2026; versão da `colunaQuebrada`, só a ideia do objeto).
 * A coluna de templo que ficou de pé na mata, partida no alto: o plinto quadrado de quina lascada, a moldura do pé e
 * o fuste liso coberto de GLIFOS em cartuchos (linhas de sete em volta, separadas por um friso), até a QUEBRA, um
 * plano torto e serrilhado que sobe para trás, de face áspera e clara. O musgo sobe do plinto pelo pé do fuste, mancha
 * as linhas de baixo e cobre boa parte da quebra; duas lascas que caíram do alto ficam no plinto.
 *
 * As duas vistas saem da PILHA DE FATIAS, como a coluna quebrada: de cima, a quebra serrilhada com o musgo e o plinto
 * em volta; na 3/4, a frente redonda do fuste com a luz do cilindro, os glifos de verdade (a textura de cada fatia
 * desenha a linha de glifos naquela altura, pelo ângulo em volta do eixo) e a beira da quebra recortada. Perfil da
 * 3/4: `{ modo: 'derivado', espessura: 0 }`. Material: `pedra`. Usa o glifo da estela (`estelaMaia.ts`).
 */
import { hash } from '../../ruido'
import { caixa, type Forma, type Ponto } from './formas'
import { contato, ruido, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import { alturas, novoFatiador, sombraDoCilindro } from './pilhaDeFatias'
import { disco, ESCURO_DA_PEDRA, lisa, luzDaNormal, sombraVarrida } from './apoioDasReferencias'
import { blocoEmFatias, GRAO_POR_ALTURA, lascar, manchaDeMusgo, musgar, musgoDoAlto, PASSO_DAS_FATIAS, pedraDeLaje, pesoDaFace, retanguloGirado, rumoUnitario } from './muroEmRuina'
import { luzDoGlifo } from './estelaMaia'

/** O plinto (meio lado em fração do menor meio lado da pegada e alto em casas) e a quina lascada (px). */
const PLINTO = 0.92
const ALTURA_DO_PLINTO = 0.12
const LASCA_DO_PLINTO = 5
/** O fuste: o raio (fração do menor meio lado) e a moldura do pé (alto em casas, quanto passa do raio em px). */
const RAIO_DO_FUSTE = 0.46
const MOLDURA = { alto: 0.06, sobra: 1.4 } as const
/**
 * A quebra: a altura média (casas, a partir do chão), o bisel e o serrilhado (px). Sobe para trás à esquerda. Na
 * faixa da `colunaQuebrada`: com 1,12 casa o fuste subia ~2,5 casas na 3/4 e lia como chaminé.
 */
const QUEBRA = { media: 0.64, bisel: 7.5, serra: 3 } as const
const RUMO_DA_QUEBRA = -Math.PI * 0.72
/** Os glifos: quantos por volta, a altura de uma linha (casas) e a do friso entre duas (px). */
const GLIFOS_POR_VOLTA = 7
const LINHA = 0.17
const FRISO = 1.6
/** A face da quebra: o áspero (luz), o miolo mais escuro (luz), o grão e a beira serrilhada clara (px e luz). */
const ASPERO = 0.13
const MIOLO_DA_QUEBRA = -0.1
const GRAO_DA_QUEBRA = { fracao: 0.07, luz: -0.14 } as const
const BEIRA_DA_QUEBRA = { largura: 1.6, luz: 0.13 } as const
/** As marcas dos glifos vistas de cima, no aro: até onde entram (px), a luz e o meio traço de 1 px (px). */
const MARCAS = { fundo: 2.3, luz: -0.26, meio: 0.5 } as const

export const montarColunaComGlifos: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const pedra = c.m.pedra
  const f = novoFatiador(P, cena, c.giro)
  const q = f.q
  cena.corDoPiso = ESCURO_DA_PEDRA
  const R = Math.min(hw, hh)
  const p = R * PLINTO
  const zPlinto = g * ALTURA_DO_PLINTO
  const zMoldura = zPlinto + g * MOLDURA.alto
  const rF = R * RAIO_DO_FUSTE
  const [rx, ry] = rumoUnitario(q)
  const daPedra = pedraDeLaje(pedra, 7330, 2 * rF)

  // O PLINTO, com a quina da frente à direita lascada e musgo no alto.
  const plinto = lascar(retanguloGirado(0, 0, p, p, 0), 2, LASCA_DO_PLINTO)
  blocoEmFatias(f, 0, plinto, 0, zPlinto, pedra, { semente: 7300, tom: 0.88, bisel: 1.4, musgo: (x, y, z) => manchaDeMusgo(x + z, y + z * 1.6, 27, -0.06) })

  // A MOLDURA DO PÉ: o anel bojudo entre o plinto e o fuste.
  const doRolo = (z: number, nz: number): Textura => (u, v, x, y, pc, s, escala) => {
    daPedra(u, v + z * GRAO_POR_ALTURA, x, y + z * GRAO_POR_ALTURA, pc, s, escala)
    const a = Math.atan2(y, x)
    s[3] += luzDaNormal(Math.cos(a), Math.sin(a), nz, q)
    musgar(s, manchaDeMusgo(x * 1.4, y * 1.4 + z, 29, -0.18), x, y)
  }
  for (const z of alturas(zPlinto, zMoldura, PASSO_DAS_FATIAS).slice(1)) {
    const t = (z - zPlinto) / (zMoldura - zPlinto)
    const r = rF + MOLDURA.sobra * Math.sin(Math.PI * Math.min(1, t * 1.1))
    f.fatia(0, z, disco(0, 0, r), pedra, lisa(0.94, doRolo(z, 0.6 - t), 7310))
  }

  // O FUSTE até a QUEBRA: um plano torto que sobe para trás à esquerda, serrilhado pelo ruído.
  const [ux, uy] = [Math.cos(RUMO_DA_QUEBRA), Math.sin(RUMO_DA_QUEBRA)]
  const altoDaQuebra = (x: number, y: number): number =>
    g * QUEBRA.media + (QUEBRA.bisel * (x * ux + y * uy)) / rF + QUEBRA.serra * (ruido(x * 0.3 + 3.1, y * 0.3) + 0.6 * ruido(x * 0.85, y * 0.85 + 5.3))
  const zMaximo = g * QUEBRA.media + QUEBRA.bisel + QUEBRA.serra
  const porAltura = rF / (2 * QUEBRA.bisel)
  const corte = (z: number): Forma => ({
    b: [-rF, -rF, rF, rF],
    d: (x, y) => Math.max(Math.hypot(x, y) - rF, (z - altoDaQuebra(x, y)) * porAltura),
  })
  // As linhas de glifos: da moldura para cima, cada uma com o friso embaixo; a quebra corta a de cima onde passar.
  const zGlifos = zMoldura + 3
  const alturaDaLinha = g * LINHA
  const glifo = (a: number, z: number): number => {
    const zz = z - zGlifos
    if (zz < -0.8) return 0
    const linha = Math.floor(zz / alturaDaLinha)
    const dentro = zz - linha * alturaDaLinha
    if (dentro < FRISO) return dentro < 0.7 ? -0.2 : 0.06
    const casa = ((a + Math.PI) / (2 * Math.PI)) * GLIFOS_POR_VOLTA
    const k = Math.floor(casa) % GLIFOS_POR_VOLTA
    const v = (dentro - FRISO) / (alturaDaLinha - FRISO) - 0.5
    return luzDoGlifo(casa - Math.floor(casa) - 0.5, v, Math.floor(hash(k, linha, 7320) * 25))
  }
  const musgoDoFuste = (x: number, y: number, z: number): number => {
    const pe = z < zMoldura + 10 ? (1 - (z - zMoldura) / 10) * manchaDeMusgo(x * 1.3, y * 1.3 + z * 1.2, 31, -0.1) : 0
    return Math.max(pe, 0.85 * manchaDeMusgo(x + z * 0.5, y + z * 1.7, 33, 0.2))
  }
  /** As marcas dos glifos no aro da quebra, vistas de cima: as juntas dos cartuchos e um traço de 1 px em cada um. */
  const marcaDoGlifo = (a: number, fundo: number): number => {
    if (fundo > MARCAS.fundo) return 0
    const casa = ((a + Math.PI) / (2 * Math.PI)) * GLIFOS_POR_VOLTA
    const k = Math.floor(casa)
    const meioDaCasa = (casa - k - 0.5) * ((2 * Math.PI * rF) / GLIFOS_POR_VOLTA)
    const largura = (Math.PI * rF) / GLIFOS_POR_VOLTA
    // A junta do cartucho: um risco de través de 1 px, da beira para dentro.
    if (largura - Math.abs(meioDaCasa) < MARCAS.meio) return MARCAS.luz
    // O traço do glifo: deitado (ao longo do aro) ou de pé, um por casa, a 1 px da beira.
    const deitado = hash(k, 1, 7335) < 0.5
    if (deitado) return Math.abs(fundo - 1.1) < MARCAS.meio && Math.abs(meioDaCasa) < largura * 0.45 ? MARCAS.luz : 0
    return Math.abs(meioDaCasa - (hash(k, 2, 7335) - 0.5) * largura * 0.5) < MARCAS.meio && fundo < MARCAS.fundo - 0.4 ? MARCAS.luz : 0
  }
  const fatiaDoFuste = (z: number): Textura => (u, v, x, y, pc, s, escala) => {
    const a = Math.atan2(y, x)
    const rr = Math.hypot(x, y)
    const sombra = rr > 0 ? (x * rx + y * ry) / rr : 0
    if (rr > rF - 1.4) {
      daPedra(u, v + z * GRAO_POR_ALTURA, x, y + z * GRAO_POR_ALTURA, pc, s, escala)
      s[3] += luzDaNormal(Math.cos(a), Math.sin(a), 0, q) + glifo(a, z)
      musgar(s, musgoDoFuste(x, y, z) * pesoDaFace(z - zMoldura, sombra), x, y)
      return
    }
    // A face da quebra: a luz do plano (virado para onde ele desce), o miolo áspero e mais escuro, com grão, e a
    // beira serrilhada clara só no aro, com as marcas dos glifos cortados. Sem o estrato do arenito: cada fatia o
    // repetia um nada acima da outra e a quebra lia como pano, e não como pedra.
    const fundo = rF - 1.4 - rr
    let luz = luzDaNormal(-ux * 0.45, -uy * 0.45, 0.9, q) + ASPERO * (ruido(x * 0.6, y * 0.6) + 0.5 * ruido(x * 1.5, y * 1.5)) + MIOLO_DA_QUEBRA
    if (hash(Math.floor(x * 1.4), Math.floor(y * 1.4), 7333) < GRAO_DA_QUEBRA.fracao) luz += GRAO_DA_QUEBRA.luz
    if (fundo < BEIRA_DA_QUEBRA.largura) luz += BEIRA_DA_QUEBRA.luz * (1 - fundo / BEIRA_DA_QUEBRA.largura)
    luz += marcaDoGlifo(a, fundo)
    s[3] += luz
    musgar(s, musgoDoAlto(manchaDeMusgo(x * 1.2, y * 1.2, 35, -0.02), fundo, sombra, x, y, 7330), x, y)
  }
  alturas(zMoldura, zMaximo, PASSO_DAS_FATIAS).slice(1).forEach((z, k) => {
    const opcoes = k === 0 ? { tabua: 0, bisel: 0, contorno: 0.24, tom: 0.97, textura: fatiaDoFuste(z), semente: 7330 } : lisa(0.97, fatiaDoFuste(z), 7330)
    f.fatia(0, z, corte(z), pedra, opcoes)
  })

  // As LASCAS que caíram do alto, deitadas no plinto.
  const lascas: readonly (readonly [number, number, number, number, number])[] = [
    [R * 0.58, R * 0.6, 4.2, 3, 0.5],
    [-R * 0.62, R * 0.66, 3, 2.2, -0.4],
    [R * 0.66, -R * 0.2, 2.4, 1.8, 1.1],
  ]
  lascas.forEach(([cx, cy, a, b, giro], i) => {
    const pontos: Ponto[] = lascar(retanguloGirado(cx, cy, a, b, giro), i % 4, 1.2)
    blocoEmFatias(f, 1, pontos, zPlinto, zPlinto + 2.2 - i * 0.3, pedra, { semente: 7340 + i * 2, tom: 1.02, bisel: 0.7, contorno: 0.24, junta: 0.6 })
  })
  f.fechar()

  // A sombra comprida do fuste, a do plinto e o contato.
  cena.sombras.push(
    sombraDoCilindro(0, 0, rF, g * QUEBRA.media + QUEBRA.bisel * 0.3, q, 0.24, 1.6),
    sombraVarrida(-p, -p, p, p, zPlinto, q, 0.22, 1.2),
    contato(caixa(-p, -p, p, p, 1), 0.3),
  )
}
