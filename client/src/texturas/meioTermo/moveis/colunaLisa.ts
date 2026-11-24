/**
 * COLUNA LISA (lote L05 de 24/11/2026, item 46: a versão do pilar do grande salão da cripta do mapa 8; desenho
 * próprio, só a ideia do objeto). O TAMBOR grosso e redondo, sem caneluras nem capitel, sobre a BASE redonda e baixa.
 * De cima: o disco do topo com a aresta arredondada pegando a luz, o anel largo da base em volta, com o DEGRAU de
 * sombra que o tambor deixa nele embaixo à direita, duas lascas na beira, o musgo no pé e a SOMBRA comprida, que é o
 * que diz "coluna" (e não mesa redonda nem tampa de bueiro).
 *
 * Revisão do diretor de arte (24/11): as 15 faixas da 3/4 saíam como caneluras (cada faixa com o grão e o tom
 * sorteados dela); a frente era quase 25% mais escura que o topo; de cima, o disco dentro do anel fino com a trinca
 * em Y lia como tampa de bueiro.
 *
 * Na 3/4 (`tresQuartos.ts`: cada sombra com altura é uma estrutura, pintada do norte para o sul; cada peça sobe com a
 * estrutura mais alta que contém o meio da caixa dela):
 * - o TAMBOR vai em FAIXAS de pé NA TELA, cada uma uma coluna da altura toda: a frente de cada faixa sai com o tom do
 *   lado dela (clara à esquerda, de onde vem a luz, escura à direita), e o conjunto lê como cilindro. A distância de
 *   cada faixa é a do disco inteiro dentro da faixa e "longe" fora dela: as frentes e as fatias do topo se encaixam
 *   sem emenda, sem chanfro nem contorno no corte. O tom da frente vai numa peça VAZIA (não pinta nada), a maior da
 *   faixa, que é de onde a 3/4 tira o material da frente. O material é LISO: com o grão da pedra, cada faixa saía com
 *   o sorteio dela (a 3/4 dá uma semente a cada frente) e o tambor ficava canelado;
 * - a faixa do meio é a última, e os detalhes do topo (a trinca, a lasca) têm o meio da caixa nela: saem por cima de
 *   todas as fatias;
 * - a BASE vai em duas metades, a do norte e a do sul NA TELA (inteira, seria pintada por último e cobriria o
 *   tambor), e o tampo dela em fatias com o meio fora do tambor, como o plinto do pilar.
 * O corte das faixas e das metades acompanha o quarto de volta que a 3/4 pinta (`c.giro`).
 * Material: `pedra`; o musgo é fixo.
 */
import { luz, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { caixa, dentroDe, elipse, menos, poligono, type Forma, type Ponto } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import type { MontarMovel } from './contexto'

/** Altura da coluna e da base, em casas. */
const ALTURA = 1.85
const ALTURA_DA_BASE = 0.1
/** Os raios, em fração do menor meio lado: o anel da base tem uns 7,5 px de largura. */
const RAIO_DA_BASE = 0.94
const RAIO_DO_TAMBOR = 0.67
/**
 * As faixas do tambor na 3/4 (ímpar: a do meio fica no meio; com 25, o degrau de luz de uma faixa à outra fica
 * abaixo de 3%) e as fatias do tampo da base (múltiplo de 4).
 */
const FAIXAS = 25
const FATIAS_DA_BASE = 16
const PASSO_DA_BASE = (2 * Math.PI) / FATIAS_DA_BASE
/**
 * A luz da frente do tambor: o mais claro (um pouco à esquerda do meio), a borda da esquerda e a da direita. Com o
 * tom da frente da 3/4 (0,74), o meio da frente sai uns 17% mais escuro que o topo na imagem (com 0,26 eram 20%).
 */
const LUZ_DO_TAMBOR = 0.32
const LUZ_NA_BORDA_ESQUERDA = 0.22
const SOMBRA_NA_DIREITA = 0.3
const ONDE_A_LUZ_BATE = -0.45
/** O degrau de sombra que o tambor deixa no anel da base: o quanto ela anda (px, para baixo à direita na tela). */
const DEGRAU_DE_SOMBRA: Ponto = [1.6, 1.25]
const SOMBRA: MaterialDaPeca = { classe: 'liso', rgb: [0x2e, 0x2c, 0x2a] }
/** A distância "longe" fora da faixa: nada é pintado, a sombra não escurece. */
const FORA = 1000
/** O musgo: o verde-oliva da lápide, um pouco mais escuro (o do túmulo de pedra). */
const MUSGO: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('musgo', 0.82)) }
/** O escuro da pedra (o do pilar): com a nogueira a beira cinza saía marrom. */
const ESCURO_DA_PEDRA: Rgb = [0x45, 0x43, 0x40]

/** O quarto de volta que a 3/4 pinta no desenho (0 a 3). */
function quartosDoGiro(giro: number): number {
  return ((Math.round(giro / 90) % 4) + 4) % 4
}

/** O ponto do desenho que, depois de `quartos` quartos de volta, cai em (dx, dy) na tela (a conta do pilar). */
function desgirado(dx: number, dy: number, quartos: number): Ponto {
  return quartos === 1 ? [dy, -dx] : quartos === 2 ? [-dx, -dy] : quartos === 3 ? [-dy, dx] : [dx, dy]
}

/** O x NA TELA de um ponto do desenho, depois de `quartos` quartos de volta. */
function xNaTela(x: number, y: number, quartos: number): number {
  return quartos === 1 ? -y : quartos === 2 ? -x : quartos === 3 ? y : x
}

/** A caixa no desenho da faixa da tela [s0, s1] x [-r, r]. */
function caixaDaFaixa(s0: number, s1: number, r: number, quartos: number): readonly [number, number, number, number] {
  if (quartos === 1) return [-r, -s1, r, -s0]
  if (quartos === 2) return [-s1, -r, -s0, r]
  if (quartos === 3) return [-r, s0, r, s1]
  return [s0, -r, s1, r]
}

/** A forma `f` só na faixa da tela de x em [s0, s1) (a de fora vai ao infinito), com a caixa `b`. */
function naFaixa(f: Forma, s0: number, s1: number, b: readonly [number, number, number, number], quartos: number): Forma {
  return { b, d: (x, y) => { const s = xNaTela(x, y, quartos); return s >= s0 && s < s1 ? f.d(x, y) : FORA } }
}

/** A luz da frente de uma faixa pelo x dela na tela (-1 a 1 do raio): clara um pouco à esquerda, escura à direita. */
function luzDaFaixa(u: number): number {
  if (u < ONDE_A_LUZ_BATE) return LUZ_DO_TAMBOR - (LUZ_DO_TAMBOR - LUZ_NA_BORDA_ESQUERDA) * ((ONDE_A_LUZ_BATE - u) / (1 + ONDE_A_LUZ_BATE))
  return LUZ_DO_TAMBOR - (LUZ_DO_TAMBOR + SOMBRA_NA_DIREITA) * Math.pow((u - ONDE_A_LUZ_BATE) / (1 - ONDE_A_LUZ_BATE), 1.3)
}

/** A forma em fatias em volta do centro, entre os raios: a mesma pedra, pintada só na caixa do setor (a do pilar). */
function emFatias(forma: Forma, deDentro: number, deFora: number): Forma[] {
  const fatias: Forma[] = []
  for (let i = 0; i < FATIAS_DA_BASE; i += 1) {
    const cantos = [i * PASSO_DA_BASE, (i + 1) * PASSO_DA_BASE].flatMap((a) => [deDentro, deFora].map((r): Ponto => [Math.cos(a) * r, Math.sin(a) * r]))
    const xs = cantos.map(([x]) => x)
    const ys = cantos.map(([, y]) => y)
    const b = forma.b
    fatias.push({ b: [Math.max(b[0], Math.min(...xs)), Math.max(b[1], Math.min(...ys)), Math.min(b[2], Math.max(...xs)), Math.min(b[3], Math.max(...ys))], d: forma.d })
  }
  return fatias
}

/** As duas metades em volta do centro, a do norte e a do sul NA TELA; `deLado` = o corte é de pé no desenho. */
function metades(forma: Forma, deLado: boolean): [Forma, Forma] {
  const [x0, y0, x1, y1] = forma.b
  if (deLado) return [dentroDe(forma, caixa(x0 - 1, y0 - 1, 0, y1 + 1)), dentroDe(forma, caixa(0, y0 - 1, x1 + 1, y1 + 1))]
  return [dentroDe(forma, caixa(x0 - 1, y0 - 1, x1 + 1, 0)), dentroDe(forma, caixa(x0 - 1, 0, x1 + 1, y1 + 1))]
}

/** A mesma forma com a caixa esticada até o meio dela cair em (cx, cy): muda só a estrutura da 3/4 em que ela sobe. */
function comMeioEm(f: Forma, cx: number, cy: number): Forma {
  const [x0, y0, x1, y1] = f.b
  const rx = Math.max(cx - x0, x1 - cx)
  const ry = Math.max(cy - y0, y1 - cy)
  return { b: [cx - rx, cy - ry, cx + rx, cy + ry], d: f.d }
}

export const montarColunaLisa: MontarMovel = (c, cena) => {
  const { g, peca: P } = c
  const R = Math.min(c.hw, c.hh)
  const pedra = c.m.pedra
  const L = cena.partes
  cena.corDoPiso = ESCURO_DA_PEDRA
  const quartos = quartosDoGiro(c.giro)
  const rBase = R * RAIO_DA_BASE
  const rTambor = R * RAIO_DO_TAMBOR
  const alto = g * ALTURA
  const zBase = g * ALTURA_DA_BASE
  const disco = elipse(0, 0, rTambor, rTambor)

  // O MUSGO no chão, em volta do pé da base (fica embaixo de tudo).
  const musgo = { tabua: 0, bisel: 0.4, contorno: 0.1, alfa: 0.55, suave: 0.9 }
  L.push(P(elipse(-rBase * 0.78, rBase * 0.72, 3.4, 2.2), MUSGO, { ...musgo, semente: 4690 }))
  L.push(P(elipse(rBase * 0.98, -rBase * 0.5, 1.8, 2.8), MUSGO, { ...musgo, alfa: 0.45, semente: 4691 }))

  // A BASE: as duas metades (estruturas baixas) e o tampo em fatias, com o meio fora do tambor.
  const fundo = elipse(0, 0, rBase, rBase)
  const anelDaBase = menos(fundo, disco)
  cena.sombras.push(contato(fundo, 0.32))
  for (const metade of metades(anelDaBase, quartos % 2 === 1)) cena.sombras.push({ forma: metade, z: zBase })
  for (const fatia of emFatias(anelDaBase, rTambor, rBase)) L.push(P(fatia, pedra, { tabua: 0, bisel: 2, tom: 0.86, contorno: 0.28, semente: 4600 }))
  // O DEGRAU de sombra do tambor no anel: a lua crescente embaixo à direita (na tela), em duas metades com o meio da
  // caixa no anel, fora do tambor (sobem com a base, e não com o tambor).
  const deLado = quartos % 2 === 1
  const [sx, sy] = desgirado(DEGRAU_DE_SOMBRA[0], DEGRAU_DE_SOMBRA[1], quartos)
  const crescente = dentroDe(menos(elipse(sx, sy, rTambor, rTambor), disco), anelDaBase)
  const rMeio = (rTambor + rBase) / 2
  metades(crescente, deLado).forEach((metade, k) => {
    const lado = k === 0 ? -1 : 1
    L.push(P(comMeioEm(metade, deLado ? lado * rMeio : 0, deLado ? 0 : lado * rMeio), SOMBRA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.5, suave: 1.2, semente: 4601 }))
  })

  // O TAMBOR em faixas de pé na tela: a estrutura, a peça vazia com o tom da frente e a fatia do topo. A faixa do
  // meio é a última (estruturas empatadas saem na ordem em que entram), para os detalhes do topo ficarem por cima.
  const largura = (2 * rTambor) / FAIXAS
  const meio = (FAIXAS - 1) / 2
  const ordem = [...Array.from({ length: FAIXAS }, (_, i) => i).filter((i) => i !== meio), meio]
  for (const i of ordem) {
    const s0 = i === 0 ? -Infinity : -rTambor + i * largura
    const s1 = i === FAIXAS - 1 ? Infinity : -rTambor + (i + 1) * largura
    const c0 = Math.max(s0, -rTambor)
    const c1 = Math.min(s1, rTambor)
    cena.sombras.push({ forma: naFaixa(disco, s0, s1, caixaDaFaixa(c0, c1, rTambor, quartos), quartos), z: alto })
    // A peça vazia é a maior da faixa (na do meio, maior que a caixa esticada dos detalhes): o meio dela fica na faixa.
    const tom: MaterialDaPeca = { classe: 'liso', rgb: luz(pedra.rgb, luzDaFaixa((c0 + c1) / 2 / rTambor)) }
    const caixaVazia = i === meio ? caixaDaFaixa(-rBase - 2, rBase + 2, rBase + 2, quartos) : caixaDaFaixa(c0, c1, rTambor + 1, quartos)
    L.push(P({ b: caixaVazia, d: () => FORA }, tom, { tabua: 0, semente: 4610 }))
  }

  // O TOPO numa peça só, com o meio da caixa na faixa do meio (a última pintada): em fatias, o bisel e o contorno de
  // cada fatia deixavam riscos na beira do disco.
  const [mx, my] = desgirado(0, 0, quartos)
  L.push(P(comMeioEm(disco, mx, my), pedra, { tabua: 0, bisel: 2.6, tom: 1, contorno: 0.3, semente: 4611 }))

  // Os DETALHES do topo, com o meio da caixa na faixa do meio: as duas lascas da beira (a grande em cima à direita, a
  // pequena embaixo à esquerda, onde antes corria a trinca) e a mancha de umidade.
  const lascaNaBeira = (a: number, abre: number, fundo: number): Forma => {
    const [cos0, sin0, cos1, sin1] = [Math.cos(a - abre), Math.sin(a - abre), Math.cos(a + abre * 1.2), Math.sin(a + abre * 1.2)]
    return dentroDe(disco, poligono([[Math.cos(a) * rTambor * fundo, Math.sin(a) * rTambor * fundo], [cos0 * rTambor * 1.1, sin0 * rTambor * 1.1], [cos1 * rTambor * 1.1, sin1 * rTambor * 1.1]]))
  }
  const lasca = { tabua: 0, bisel: 0.8, tom: 0.72, contorno: 0.2, recesso: { k: 1, forca: 0.3 } }
  L.push(P(comMeioEm(lascaNaBeira(-0.6, 0.2, 0.8), mx, my), pedra, { ...lasca, semente: 4620 }))
  L.push(P(comMeioEm(lascaNaBeira(2.7, 0.13, 0.87), mx, my), pedra, { ...lasca, tom: 0.76, semente: 4621 }))
  L.push(P(comMeioEm(elipse(rTambor * 0.32, rTambor * 0.36, rTambor * 0.34, rTambor * 0.26), mx, my), pedra, { tabua: 0, bisel: 0, contorno: 0, tom: 0.9, alfa: 0.35, suave: 3, semente: 4623 }))
}
