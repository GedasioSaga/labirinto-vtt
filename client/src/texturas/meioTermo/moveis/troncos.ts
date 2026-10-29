/**
 * TRONCOS de cima com volume (29/10/2026), nas duas formas do painel
 * (`lib/mobilia/pilhas.ts`; a forma chega na `variante`):
 *
 * - PILHA DE TORAS (variante 0, 2 x 1 casas): troncos grandes deitados ao
 *   comprido em pirâmide, três embaixo, dois no meio e um em cima. De cima
 *   aparece a tora de cima inteira e a beira das de baixo, cada fileira mais
 *   escura e na sombra da de cima; as pontas ficam desencontradas (a de cima é
 *   a mais curta) e cada ponta mostra o CORTE com os anéis (o miolo um pouco
 *   fora do centro), com uma beira de casca em volta, como no carimbo "Tronco
 *   caído". A ponta da esquerda pega a luz; a da direita fica na sombra.
 * - LENHA EMPILHADA (variante 1, 1,5 x 0,5): a lenha cortada em fileira, as
 *   achas deitadas da parede (o lado de cima) para a frente, umas redondas com
 *   a casca, outras rachadas com a madeira clara para cima; na frente, o corte
 *   de cada acha com os anéis (na rachada, os anéis são arcos: o miolo ficou no
 *   canto). Por baixo, a fileira de baixo, escura, aparece nas frestas.
 *
 * A 25% de zoom sobram as faixas da casca e as pontas claras: é o que diz
 * "lenha" e não "tapete". Material: `lenha` (a casca da lenha da fogueira:
 * carvalho, pinho ou bétula); o corte sai da madeira escolhida.
 */
import { hash } from '../../ruido'
import { caixa, elipse, uniao, type Forma } from './formas'
import { contato, ruido, type Cena, type MaterialDaPeca, type Peca, type Textura } from './motor'
import type { ContextoDoMovel, MontarMovel } from './contexto'

type Rgb3 = readonly [number, number, number]

/** O cerne do corte de cada madeira, claro e quente, contido (como o `CERNE_CLARO` do carimbo). */
const CERNE_DO_CARVALHO: Rgb3 = [0xb0, 0x8a, 0x5e]
const CERNE_DO_PINHO: Rgb3 = [0xbf, 0x9b, 0x69]
const CERNE_DA_BETULA: Rgb3 = [0xc6, 0xb2, 0x8b]
/** O anel escuro do corte: o cerne x 0,78, um pouco mais quente. */
const FATOR_DO_ANEL = 0.78

/** A casca do pinho (a lenha x 1,1) é a mais clara das duas fendidas: a luz dela separa do carvalho. */
const VERMELHO_DA_CASCA_DO_PINHO = 115

/** O cerne que combina com a casca escolhida: a bétula pela textura, o pinho pela luz da casca. */
function cerneDa(casca: MaterialDaPeca): Rgb3 {
  if (casca.casca === 'betula') return CERNE_DA_BETULA
  return casca.rgb[0] >= VERMELHO_DA_CASCA_DO_PINHO ? CERNE_DO_PINHO : CERNE_DO_CARVALHO
}

function vezes(c: Rgb3, k: number): [number, number, number] {
  return [c[0] * k, c[1] * k, c[2] * k]
}

/** Anéis por raio do corte: 3 a 4 faixas, que ainda leem a 2x numa tora de 1/3 de casa. */
const ANEIS_POR_RAIO = 3.4

/**
 * O CORTE da madeira: os anéis em volta do miolo (`mx`, `my`), na elipse de
 * raios `rx` e `ry`, levemente tortos pelo ruído; o alburno (a faixa de fora)
 * um pouco mais claro e o miolo, um ponto escuro. O miolo pode ficar fora da
 * peça (a acha rachada): aí os anéis viram arcos.
 */
function texCorte(mx: number, my: number, rx: number, ry: number, cerne: Rgb3): Textura {
  const anel = vezes(cerne, FATOR_DO_ANEL)
  return (_u, _v, x, y, _p, s) => {
    const dx = (x - mx) / rx
    const dy = (y - my) / ry
    const q = Math.sqrt(dx * dx + dy * dy) + ruido(x * 0.4 + 17, y * 0.4) * 0.07
    const onda = Math.sin(q * ANEIS_POR_RAIO * Math.PI * 2)
    const t = onda > 0.35 ? ((onda - 0.35) / 0.65) * 0.75 : 0
    s[0] += (anel[0] - s[0]) * t
    s[1] += (anel[1] - s[1]) * t
    s[2] += (anel[2] - s[2]) * t
    s[3] += (q > 0.8 ? 0.05 : 0) - q * 0.05 + ruido(x * 0.9, y * 0.9) * 0.03
    if (q < 0.14) s[3] -= 0.16 * (1 - q / 0.14)
  }
}

/** Material liso do corte, no tom do lado: a ponta da esquerda pega a luz, a da direita fica na sombra. */
function corte(cerne: Rgb3, tom: number): MaterialDaPeca {
  return { classe: 'liso', rgb: vezes(cerne, tom) }
}

/** A luz de cada ponta da tora (a esquerda olha para a luz) e da frente da acha (de cima, meio-termo). */
const TOM_DA_PONTA_NA_LUZ = 1.05
const TOM_DA_PONTA_NA_SOMBRA = 0.84
const TOM_DA_FRENTE_DA_ACHA = 0.97

// ---------- pilha de toras ----------

/** Quanto o corte aparece na ponta, em fração do raio: o "bojo" do carimbo, que lê como ponta serrada. */
const BOJO_DA_PONTA = 0.5
/** O corte é um pouco menor que a ponta: sobra a beira de casca em volta. */
const CORTE_NA_PONTA = 0.84

/**
 * As toras, de baixo para cima e de trás para a frente: a fileira (0 embaixo,
 * 1 no meio, 2 em cima), o centro em raios a partir do meio (y) e as pontas
 * em fração da meia largura (incluindo o bojo). A de cima é a mais curta.
 */
const TORAS: readonly { readonly fileira: 0 | 1 | 2; readonly y: number; readonly de: number; readonly ate: number }[] = [
  { fileira: 0, y: -2, de: -0.96, ate: 0.94 },
  { fileira: 0, y: 0, de: -0.97, ate: 0.97 },
  { fileira: 0, y: 2, de: -0.94, ate: 0.96 },
  { fileira: 1, y: -1, de: -0.9, ate: 0.88 },
  { fileira: 1, y: 1, de: -0.87, ate: 0.91 },
  { fileira: 2, y: 0, de: -0.8, ate: 0.83 },
]
/** O tom de cada fileira (a de baixo, mais escura: a luz chega de cima e as de cima a tapam). */
const TOM_DA_FILEIRA = [0.86, 0.95, 1.04] as const
/** A altura do topo de cada fileira, em raios: a pirâmide fechada (2, 2 + raiz de 3, 2 + 2 raiz de 3). */
const TOPO_DA_FILEIRA = [2, 2 + Math.sqrt(3), 2 + 2 * Math.sqrt(3)] as const

function montarPilhaDeToras(c: ContextoDoMovel, cena: Cena): void {
  const { hw, hh, peca: P } = c
  const casca = c.m.lenha
  const cerne = cerneDa(casca)
  const r = hh / 3
  const bojo = r * BOJO_DA_PONTA
  const L = cena.partes
  const corpos: Forma[] = []
  TORAS.forEach((tora, k) => {
    const y = tora.y * r
    const x0 = tora.de * hw + bojo
    const x1 = tora.ate * hw - bojo
    if (x1 <= x0) return
    const corpo = uniao(caixa(x0, y - r, x1, y + r), uniao(elipse(x0, y, bojo, r), elipse(x1, y, bojo, r)))
    corpos.push(corpo)
    cena.sombras.push({ forma: corpo, z: TOPO_DA_FILEIRA[tora.fileira] * r, forca: tora.fileira === 0 ? 0.3 : 0.22 })
    const tom = TOM_DA_FILEIRA[tora.fileira] * (0.97 + 0.06 * hash(k, 2, 913))
    L.push(P(corpo, casca, {
      eixo: 0,
      bisel: r * 0.92,
      tom,
      contorno: 0.24,
      semente: 1100 + k,
      projeta: tora.fileira > 0 ? { dist: r * 0.42, forca: 0.34 } : undefined,
    }))
    // Os dois cortes, com o miolo um pouco para o lado da sombra (a árvore cresceu torta).
    for (const [xp, tomDaPonta, lado] of [[x0, TOM_DA_PONTA_NA_LUZ, -1], [x1, TOM_DA_PONTA_NA_SOMBRA, 1]] as const) {
      const rx = bojo * CORTE_NA_PONTA
      const ry = r * CORTE_NA_PONTA
      const mx = xp + lado * rx * 0.08
      const my = y + ry * (0.06 + 0.14 * hash(k, lado + 3, 914))
      L.push(P(elipse(xp, y, rx, ry), corte(cerne, tomDaPonta * (0.97 + 0.06 * hash(k, lado + 5, 915))), {
        bisel: 0.7,
        contorno: 0.2,
        textura: texCorte(mx, my, rx, ry, cerne),
        semente: 1120 + k * 2 + (lado + 1) / 2,
      }))
    }
  })
  if (corpos.length > 0) cena.sombras.push(contato(corpos.reduce(uniao), 0.3))
}

// ---------- lenha empilhada ----------

/** Largura de uma acha em px do protótipo (~1/6 de casa): uma fileira de 1,5 casa tem 9. */
const LARGURA_DA_ACHA = 9.4
/** Altura da fileira (a sombra no chão), em casas: a lenha empilhada até a altura da cintura. */
const ALTURA_DA_LENHA = 0.62

function montarLenhaEmpilhada(c: ContextoDoMovel, cena: Cena): void {
  const { w, hw, hh, g, peca: P } = c
  const casca = c.m.lenha
  const cerne = cerneDa(casca)
  const madeira: MaterialDaPeca = { classe: 'madeira', rgb: cerne }
  const L = cena.partes
  const toda = caixa(-hw + 0.4, -hh + 0.4, hw - 0.4, hh - 0.6, 1.2)
  cena.sombras.push({ forma: toda, z: g * ALTURA_DA_LENHA }, contato(toda, 0.32))
  // A fileira de baixo: escura, só aparece nas frestas entre as achas de cima.
  L.push(P(caixa(-hw + 0.8, -hh + 0.8, hw - 0.8, hh - 1.6, 1.4), casca, { eixo: Math.PI / 2, bisel: 1, tom: 0.52, contorno: 0.18, semente: 1200 }))
  const n = Math.max(2, Math.round(w / LARGURA_DA_ACHA))
  const passo = w / n
  const faceMax = Math.min(passo * 0.36, hh * 0.34)
  const achas: Peca[] = []
  const frentes: Peca[] = []
  for (let i = 0; i < n; i += 1) {
    const meia = passo * 0.5 * (0.84 + 0.12 * hash(i, 1, 921))
    const x = -hw + passo * (i + 0.5) + (hash(i, 2, 921) - 0.5) * passo * 0.1
    const tras = -hh + 0.8 + hash(i, 3, 921) * 1.4
    const ry = Math.max(1, Math.min(meia * 0.62, faceMax))
    const frente = hh - ry - 0.6 - hash(i, 4, 921) * 1.8
    const rachada = hash(i, 5, 921) < 0.5
    const tom = 0.9 + 0.16 * hash(i, 6, 921)
    const corpo = uniao(caixa(x - meia, tras, x + meia, frente, meia * (rachada ? 0.35 : 0.6)), elipse(x, frente, meia, ry))
    achas.push(P(corpo, casca, { eixo: Math.PI / 2, bisel: meia * (rachada ? 0.55 : 0.9), tom, contorno: 0.24, semente: 1210 + i, projeta: { dist: 0.9, forca: 0.3 } }))
    if (rachada) {
      // A face rachada para cima: a madeira clara, com o veio da acha, e uma tira de casca de um lado.
      const lado = hash(i, 7, 921) < 0.5 ? -1 : 1
      const x0 = x - meia * 0.86 + (lado < 0 ? meia * 0.3 : 0)
      const x1 = x + meia * 0.86 - (lado > 0 ? meia * 0.3 : 0)
      // Um pouco abaixo do corte (0,8): a face rachada pega a luz de cima, o corte é que é o claro.
      achas.push(P(caixa(x0, tras + 0.6, x1, frente, 0.6), madeira, { eixo: Math.PI / 2, tabua: 0, bisel: 0.6, tom: 0.78 + 0.08 * hash(i, 8, 921), contorno: 0.14, semente: 1240 + i }))
      // O corte na frente: o miolo ficou no canto da casca, os anéis viram arcos.
      const mx = x + lado * meia * 1.05
      const my = frente + ry * 0.5
      frentes.push(P(elipse(x, frente, meia * 0.9, ry * 0.86), corte(cerne, TOM_DA_FRENTE_DA_ACHA * tom), { bisel: 0.6, contorno: 0.2, textura: texCorte(mx, my, meia * 1.9, ry * 1.9, cerne), semente: 1270 + i }))
    } else {
      // A acha redonda: o corte inteiro na frente, com o miolo perto do meio.
      const mx = x + (hash(i, 9, 921) - 0.5) * meia * 0.3
      frentes.push(P(elipse(x, frente, meia * 0.84, ry * 0.84), corte(cerne, TOM_DA_FRENTE_DA_ACHA * tom), { bisel: 0.6, contorno: 0.2, textura: texCorte(mx, frente, meia * 0.84, ry * 0.84, cerne), semente: 1270 + i }))
    }
  }
  L.push(...achas, ...frentes)
}

export const montarTroncos: MontarMovel = (c, cena) => {
  if (c.variante === 1) montarLenhaEmpilhada(c, cena)
  else montarPilhaDeToras(c, cena)
}
