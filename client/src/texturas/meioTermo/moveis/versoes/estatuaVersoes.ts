/**
 * As VERSÕES da estátua (L03 do plano de arte por tema, 28/11/2026; tema Castelo): a 1ª, a de hoje (o herói de elmo
 * com crista, as mãos no punho da espada), é o desenho de `MONTADORES` (`../estatua.ts`). As outras são o MESMO
 * pedestal (o soco, o dado, a cornija com a moldura, o líquen e o musgo) com outra figura em cima:
 * - CAVALEIRO: o elmo fechado de topo chato com o penacho caindo para trás, as mãos no punho da espada e o ESCUDO
 *   com a cruz deitado no tampo, aos pés dele;
 * - REI: a coroa de seis florões, a gola de arminho sobre os ombros (sem as ombreiras) e o CETRO de ponta no
 *   pedestal, as mãos descansando no orbe do alto dele;
 * - DAMA: o vestido longo (a saia em sino, do pé aos quadris), os ombros e a cintura estreitos, o diadema e o coque,
 *   e as mãos juntas segurando uma flor.
 * Ninguém de verdade, nenhum brasão.
 *
 * Como a troca acontece: o desenho de hoje é chamado com uma fábrica de peças que, pela semente de cada peça da
 * figura (a capa, os ombros, a espada, os antebraços, as mãos e a cabeça de `../estatua.ts`), entrega a peça nova, tira
 * a peça ou põe peças a mais antes dela. As sombras com altura (as estruturas da 3/4) são trocadas depois, pela ordem
 * em que `../estatua.ts` as empilha. Quando a figura nova tem um pé maior que o de hoje (a saia da dama), o furo da
 * metade do sul do pedestal cresce para ele (o tampo e o dado da frente perdem o pé novo), como o desenho de hoje faz
 * com os pés dele. As regras da 3/4 são as de `../estatua.ts`: cada peça sobe com a estrutura mais alta que contém o
 * meio da caixa dela (`comMeioEm` escolhe o meio quando o de verdade cairia em outra), e as estruturas são pintadas
 * do norte para o sul.
 *
 * Lugares de material: os da estátua (`pedra`).
 */
import { luz } from '../../../ruido'
import { caixa, capsula, elipse, menos, poligono, uniao, type Forma } from '../formas'
import type { CriarPeca, Peca } from '../motor'
import type { ContextoDoMovel, MontarMovel } from '../contexto'
import { montarEstatua } from '../estatua'
import type { VersoesDesenhadas } from '.'

type Cena = Parameters<MontarMovel>[1]
type Opcoes = Parameters<CriarPeca>[2]

/** As medidas de `../estatua.ts` que a figura nova usa (em casas e em frações do menor meio lado). */
const ALTURA_DO_PEDESTAL = 0.56
const ALTURA_DAS_PERNAS = 0.42
const CABECA = { y: -0.06, r: 0.17 }
const LAMINA = { l: 0.065, y0: 0.24, y1: 0.39 }
const LONGE = 4096
const LADOS = [-1, 1] as const

/** As sementes das peças de `../estatua.ts`. */
const SEMENTE = { tampo: 5010, capa: 5040, ombros: 5050, ombreiras: [5051, 5053], lamina: 5060, guarda: 5061, antebracos: [5070, 5071], maos: 5072, rosto: 5080, elmo: 5081, crista: 5082 } as const
/**
 * A ordem em que `../estatua.ts` empilha as sombras: o contato, as quatro do soco, as duas metades do dado e as duas
 * da cornija, a barra e a capa, as duas pernas, as quatro faixas do tronco, a lâmina, os antebraços com as mãos e a
 * cabeça. Se a conta não bater (o desenho de hoje mudou), a figura nova fica sem as trocas de sombra.
 */
const SOMBRAS = { dadoECornija: [5, 6, 7, 8], tronco: [13, 14, 15, 16], lamina: 17, bracos: 18, total: 20 } as const

/** As cópias dos ajudantes de `../estatua.ts` (lá não são exportados). */
function quartosDoGiro(giro: number): number {
  return ((Math.round(giro / 90) % 4) + 4) % 4
}

function arrastadoAteOMeio(pe: Forma, quartos: number): Forma {
  const [x0, y0, x1, y1] = pe.b
  const mx = (x0 + x1) / 2
  const my = (y0 + y1) / 2
  if (quartos === 1) return mx > 0 ? uniao(pe, caixa(0, y0, mx, y1)) : pe
  if (quartos === 2) return my < 0 ? uniao(pe, caixa(x0, my, x1, 0)) : pe
  if (quartos === 3) return mx < 0 ? uniao(pe, caixa(mx, y0, 0, y1)) : pe
  return my > 0 ? uniao(pe, caixa(x0, 0, x1, my)) : pe
}

function recortada(f: Forma, x0: number, y0: number, x1: number, y1: number): Forma {
  return { b: [Math.max(f.b[0], x0), Math.max(f.b[1], y0), Math.min(f.b[2], x1), Math.min(f.b[3], y1)], d: (x, y) => f.d(x, y) }
}

function comMeioEm(f: Forma, cx: number, cy: number): Forma {
  const mx = Math.max(cx - f.b[0], f.b[2] - cx)
  const my = Math.max(cy - f.b[1], f.b[3] - cy)
  return { b: [cx - mx, cy - my, cx + mx, cy + my], d: (x, y) => f.d(x, y) }
}

/** O que a figura nova faz com uma peça de hoje: a forma (null tira a peça), o tom e as opções, e peças a mais antes dela. */
interface TrocaDaPeca {
  readonly forma?: Forma | null
  readonly opcoes?: Opcoes
  readonly antes?: () => readonly Peca[]
}

/** A figura nova: os pés maiores que os de hoje (o furo cresce para eles), as colunas a mais, as sombras e as peças trocadas. */
interface Figura {
  readonly pes: readonly Forma[]
  readonly colunas: readonly { readonly pe: Forma; readonly altura: number }[]
  /** Pelo índice em `SOMBRAS`: a forma nova (null tira) e a altura nova em casas acima do tampo. */
  readonly sombras: ReadonlyMap<number, { readonly forma: Forma | null; readonly altura?: number }>
  readonly pecas: ReadonlyMap<number, TrocaDaPeca>
}

function estatuaCom(desenhar: (c: ContextoDoMovel, R: number) => Figura): MontarMovel {
  return (c: ContextoDoMovel, cena: Cena) => {
    const R = Math.min(c.hw, c.hh)
    const quartos = quartosDoGiro(c.giro)
    const zTopo = c.g * ALTURA_DO_PEDESTAL
    const figura = desenhar(c, R)
    const furo = figura.pes.length === 0 ? null : figura.pes.map((pe) => arrastadoAteOMeio(pe, quartos)).reduce((a, b) => uniao(a, b))
    const tirar = new Set<Peca>()
    const vistas = new Map<number, number>()
    const peca: CriarPeca = (forma, mat, o) => {
      const semente = o?.semente
      if (semente === SEMENTE.tampo && furo !== null) return c.peca(menos(forma, furo), mat, o)
      const troca = semente === undefined ? undefined : figura.pecas.get(semente)
      if (troca === undefined || semente === undefined) return c.peca(forma, mat, o)
      // A mesma semente aparece mais de uma vez (as duas metades dos ombros): `antes` só na primeira.
      const vez = vistas.get(semente) ?? 0
      vistas.set(semente, vez + 1)
      if (vez === 0 && troca.antes !== undefined) cena.partes.push(...troca.antes())
      // Lida uma vez só: a forma pode depender de quantas vezes a semente já apareceu.
      const nova = troca.forma
      if (nova === null) {
        const fora = c.peca(forma, mat, o)
        tirar.add(fora)
        return fora
      }
      return c.peca(nova ?? forma, mat, { ...o, ...troca.opcoes })
    }
    montarEstatua({ ...c, peca }, cena)
    for (let i = cena.partes.length - 1; i >= 0; i -= 1) if (tirar.has(cena.partes[i])) cena.partes.splice(i, 1)
    if (cena.sombras.length !== SOMBRAS.total) return
    const novas = cena.sombras.map((s, i) => {
      if (furo !== null && (SOMBRAS.dadoECornija as readonly number[]).includes(i)) return { ...s, forma: menos(s.forma, furo) }
      const troca = figura.sombras.get(i)
      if (troca === undefined) return s
      if (troca.forma === null) return null
      return { ...s, forma: troca.forma, z: troca.altura === undefined ? s.z : zTopo + c.g * troca.altura }
    })
    cena.sombras.length = 0
    for (const s of novas) if (s !== null) cena.sombras.push(s)
    for (const { pe, altura } of figura.colunas) cena.sombras.push({ forma: pe, z: zTopo + c.g * altura })
  }
}

/** A cabeça de hoje, no desenho: o meio e o raio. */
function cabecaEm(R: number): { y: number; r: number } {
  return { y: CABECA.y * R, r: CABECA.r * R }
}

// ---------- cavaleiro ----------

/**
 * O escudo deitado no tampo, aos pés do cavaleiro (na frente, à esquerda de quem olha): o meio, a meia largura e o
 * comprimento (frações do menor meio lado) e o giro do bico. Deitado, ele é do tampo: sobe com a metade da frente da
 * cornija, e nenhuma coluna nova abre furo no pedestal.
 */
const ESCUDO = { x: -0.42, y: 0.5, meiaLargura: 0.16, alto: 0.21, giro: -0.5 } as const

/** O escudo de beira reta em cima e bico embaixo, de meio (cx, cy), girado de `giro` radianos e recuado `k` px. */
function escudoDeitado(cx: number, cy: number, l: number, a: number, giro: number, k: number): Forma {
  const cos = Math.cos(giro)
  const sen = Math.sin(giro)
  const pontos: readonly (readonly [number, number])[] = [[-l + k, -a + k], [l - k, -a + k], [l - k, a * 0.1], [l * 0.5 - k * 0.6, a * 0.62 - k * 0.4], [0, a - k * 1.3], [-l * 0.5 + k * 0.6, a * 0.62 - k * 0.4], [-l + k, a * 0.1]]
  return poligono(pontos.map(([x, y]): [number, number] => [cx + x * cos - y * sen, cy + x * sen + y * cos]))
}

const cavaleiro = estatuaCom((c, R) => {
  const pedra = c.m.pedra
  const { y, r } = cabecaEm(R)
  const [ex, ey, el, ea] = [ESCUDO.x * R, ESCUDO.y * R, ESCUDO.meiaLargura * R, ESCUDO.alto * R]
  const cos = Math.cos(ESCUDO.giro)
  const sen = Math.sin(ESCUDO.giro)
  const naCruz = (x0: number, y0: number, x1: number, y1: number): Forma => {
    const canto = (x: number, yy: number): [number, number] => [ex + x * cos - yy * sen, ey + x * sen + yy * cos]
    return poligono([canto(x0, y0), canto(x1, y0), canto(x1, y1), canto(x0, y1)])
  }
  const escudo = (): readonly Peca[] => [
    c.peca(escudoDeitado(ex, ey, el, ea, ESCUDO.giro, 0), pedra, { tabua: 0, bisel: 1.6, tom: 1.04, contorno: 0.3, semente: 5090, projeta: { dist: 1.2, forca: 0.26 } }),
    // A cruz em relevo no campo do escudo.
    c.peca(uniao(naCruz(-el * 0.12, -ea * 0.72, el * 0.12, ea * 0.62), naCruz(-el * 0.66, -ea * 0.3, el * 0.66, -ea * 0.08)), pedra, { tabua: 0, bisel: 0.7, tom: 1.16, contorno: 0.22, semente: 5091 }),
  ]
  return {
    pes: [],
    colunas: [],
    sombras: new Map(),
    pecas: new Map<number, TrocaDaPeca>([
      // O escudo antes da figura (a capa é a primeira peça dela): de cima, a figura passa por cima da beira dele.
      [SEMENTE.capa, { antes: escudo }],
      // O elmo fechado, de topo chato e quinas redondas, e o penacho caindo para trás.
      [SEMENTE.elmo, { forma: caixa(-r * 0.92, y - r * 0.92, r * 0.92, y + r * 0.92, r * 0.42), opcoes: { bisel: r * 0.5 } }],
      [SEMENTE.crista, { forma: uniao(elipse(0, y - r * 0.55, r * 0.3, r * 0.66), elipse(0, y + r * 0.02, r * 0.17, r * 0.17)), opcoes: { bisel: r * 0.22, tom: 1.16 } }],
    ]),
  }
})

// ---------- rei ----------

/** O cetro: a altura do alto (casas, logo abaixo das mãos) e o orbe (o meio, o raio e o meio da caixa, frações do menor meio lado). */
const CETRO = { altura: 0.56, orbeY: 0.315, orbeR: 0.085, meioY: 0.37 } as const
/** A coroa: quantos florões, o raio de fora e o de dentro do aro e o do florão (frações do raio da cabeça). */
const COROA = { floroes: 6, fora: 0.86, dentro: 0.6, florao: 0.14 } as const
/** A gola de arminho: a elipse de fora (meio e raios) e o furo do pescoço; o meio de cada metade. */
const GOLA = { y: -0.01, rx: 0.3, ry: 0.2, pescocoY: -0.06, pescocoR: 0.18, meioX: 0.24, meioY: 0.02 } as const
/** As pintas do arminho, no desenho (frações do menor meio lado): todas na gola, fora da cabeça. */
const PINTAS: readonly (readonly [number, number])[] = [[-0.25, -0.02], [-0.21, 0.07], [-0.27, 0.06], [0.25, -0.02], [0.21, 0.07], [0.27, 0.06], [-0.14, 0.11], [0.14, 0.11]]

const rei = estatuaCom((c, R) => {
  const pedra = c.m.pedra
  const { y, r } = cabecaEm(R)
  const arminho = { ...pedra, rgb: luz(pedra.rgb, 0.12) }
  const pinta = { ...pedra, rgb: luz(pedra.rgb, -0.45) }
  const gola = menos(elipse(0, GOLA.y * R, GOLA.rx * R, GOLA.ry * R), elipse(0, GOLA.pescocoY * R, GOLA.pescocoR * R, GOLA.pescocoR * R))
  const golaEPintas = (): readonly Peca[] => [
    ...LADOS.map((lado) => {
      const metade = recortada(gola, lado < 0 ? -LONGE : 0, -LONGE, lado < 0 ? 0 : LONGE, LONGE)
      return c.peca(comMeioEm(metade, lado * GOLA.meioX * R, GOLA.meioY * R), arminho, { tabua: 0, bisel: 1.4, tom: 1.1, contorno: 0.28, semente: 5092, projeta: { dist: 1.2, forca: 0.22 } })
    }),
    ...PINTAS.map(([px, py], i) => c.peca(elipse(px * R, py * R, 0.018 * R, 0.026 * R), pinta, { bisel: 0, contorno: 0, alfa: 0.7, semente: 5093 + i })),
  ]
  let coroa = menos(elipse(0, y, r * COROA.fora, r * COROA.fora), elipse(0, y, r * COROA.dentro, r * COROA.dentro))
  for (let i = 0; i < COROA.floroes; i += 1) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / COROA.floroes
    coroa = uniao(coroa, elipse(Math.cos(a) * r * COROA.fora, y + Math.sin(a) * r * COROA.fora, r * COROA.florao, r * COROA.florao))
  }
  // O orbe no alto do cetro, debaixo das mãos: na peça da lâmina (antes das mãos), com o meio da caixa fora delas.
  const orbe = comMeioEm(elipse(0, CETRO.orbeY * R, CETRO.orbeR * R, CETRO.orbeR * R), 0, CETRO.meioY * R)
  return {
    pes: [],
    colunas: [],
    // O cetro é a coluna da lâmina: as mãos descansam no orbe, no alto dele.
    sombras: new Map([[SOMBRAS.lamina, { forma: caixa(-LAMINA.l * R, LAMINA.y0 * R, LAMINA.l * R, LAMINA.y1 * R, 0.5), altura: CETRO.altura }]]),
    pecas: new Map<number, TrocaDaPeca>([
      [SEMENTE.lamina, { forma: orbe, opcoes: { bisel: CETRO.orbeR * R * 0.8, tom: 1.12, projeta: { dist: 1.6, forca: 0.26 } } }],
      [SEMENTE.guarda, { forma: null }],
      [SEMENTE.ombreiras[0], { forma: null }],
      [SEMENTE.ombreiras[1], { forma: null }],
      [SEMENTE.rosto, { antes: golaEPintas }],
      [SEMENTE.crista, { forma: coroa, opcoes: { bisel: r * 0.12, tom: 1.22 } }],
    ]),
  }
})

// ---------- dama ----------

/** A saia: a elipse do pé (meio e raios, frações do menor meio lado), e de onde a beira de cima aparece (a da frente). */
const SAIA = { y: 0.06, rx: 0.3, ry: 0.33, frenteDe: 0.02, meioX: 0.22, meioY: 0.2 } as const
/** O tronco da dama, de baixo para cima (os quadris, a cintura, o peito com os braços e os ombros estreitos). */
const TRONCO_DA_DAMA: readonly { readonly rx: number; readonly ry: number }[] = [
  { rx: 0.22, ry: 0.15 },
  { rx: 0.14, ry: 0.11 },
  { rx: 0.19, ry: 0.12 },
  { rx: 0.25, ry: 0.13 },
]
const BRACO_DA_DAMA = { x: 0.2, y: 0.05, r: 0.055 } as const
const ANTEBRACO_DA_DAMA = { cotoveloX: 0.2, cotoveloY: 0.06, maoX: 0.04, maoY: 0.24, r: 0.05, meioX: 0.1, meioY: 0.2 } as const
const MAOS_DA_DAMA = { y: 0.24, rx: 0.075, ry: 0.08 } as const
/** A flor nas mãos: o meio, o raio do miolo e o das cinco pétalas. */
const FLOR = { y: 0.31, miolo: 0.022, petala: 0.03, volta: 0.036 } as const
const MEIO_DO_OMBRO_DA_DAMA = 0.19

const dama = estatuaCom((c, R) => {
  const pedra = c.m.pedra
  const { y, r } = cabecaEm(R)
  const saia = elipse(0, SAIA.y * R, SAIA.rx * R, SAIA.ry * R)
  const faixas = TRONCO_DA_DAMA.map(({ rx, ry }, k) => {
    const faixa = elipse(0, 0, rx * R, ry * R)
    if (k !== 2) return faixa
    return LADOS.reduce((f, lado) => uniao(f, elipse(lado * BRACO_DA_DAMA.x * R, BRACO_DA_DAMA.y * R, BRACO_DA_DAMA.r * R, BRACO_DA_DAMA.r * R)), faixa)
  })
  const ombros = faixas[faixas.length - 1]
  const antebracos = LADOS.map((lado) => capsula(lado * ANTEBRACO_DA_DAMA.cotoveloX * R, ANTEBRACO_DA_DAMA.cotoveloY * R, lado * ANTEBRACO_DA_DAMA.maoX * R, ANTEBRACO_DA_DAMA.maoY * R, ANTEBRACO_DA_DAMA.r * R))
  const maos = elipse(0, MAOS_DA_DAMA.y * R, MAOS_DA_DAMA.rx * R, MAOS_DA_DAMA.ry * R)
  // A beira de cima da saia, só a da frente (a de trás passa por baixo do corpo e da capa). Inteira: na 3/4 os
  // quadris, mais altos, ficam acima dela na tela, e o furo dos quadris virava uma ferradura escura.
  const beiraDaSaia = (): readonly Peca[] => [
    c.peca(comMeioEm(recortada(saia, -LONGE, SAIA.frenteDe * R, LONGE, LONGE), SAIA.meioX * R, SAIA.meioY * R), pedra, { tabua: 0, bisel: 1.6, tom: 0.98, contorno: 0.28, semente: 5094, projeta: { dist: 1.4, forca: 0.24 } }),
  ]
  let flor = elipse(0, FLOR.y * R, FLOR.miolo * R, FLOR.miolo * R)
  for (let i = 0; i < 5; i += 1) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5
    flor = uniao(flor, elipse(Math.cos(a) * FLOR.volta * R, FLOR.y * R + Math.sin(a) * FLOR.volta * R, FLOR.petala * R, FLOR.petala * R))
  }
  const aFlor = (): readonly Peca[] => [c.peca(flor, { ...pedra, rgb: luz(pedra.rgb, 0.1) }, { tabua: 0, bisel: 0.7, tom: 1.15, contorno: 0.3, semente: 5095, projeta: { dist: 1, forca: 0.24 } })]
  const metadeDosOmbros = (lado: number): Forma => comMeioEm(recortada(ombros, lado < 0 ? -LONGE : 0, -LONGE, lado < 0 ? 0 : LONGE, LONGE), lado * MEIO_DO_OMBRO_DA_DAMA * R, 0)
  const diademaECoque = uniao(menos(elipse(0, y, r * 0.98, r * 0.98), elipse(0, y, r * 0.84, r * 0.84)), elipse(0, y - r * 0.55, r * 0.4, r * 0.34))
  let vezDoOmbro = 0
  return {
    pes: [saia],
    colunas: [{ pe: saia, altura: ALTURA_DAS_PERNAS }],
    sombras: new Map<number, { forma: Forma | null; altura?: number }>([
      [SOMBRAS.lamina, { forma: null }],
      [SOMBRAS.bracos, { forma: uniao(uniao(antebracos[0], antebracos[1]), maos) }],
      ...SOMBRAS.tronco.map((indice, k): [number, { forma: Forma }] => [indice, { forma: faixas[k] }]),
    ]),
    pecas: new Map<number, TrocaDaPeca>([
      [SEMENTE.lamina, { forma: null }],
      [SEMENTE.guarda, { forma: null }],
      // A beira da saia antes dos antebraços (de cima, as mãos e os braços ficam por cima dela).
      [SEMENTE.antebracos[0], { antes: beiraDaSaia, forma: comMeioEm(antebracos[0], -ANTEBRACO_DA_DAMA.meioX * R, ANTEBRACO_DA_DAMA.meioY * R) }],
      [SEMENTE.antebracos[1], { forma: comMeioEm(antebracos[1], ANTEBRACO_DA_DAMA.meioX * R, ANTEBRACO_DA_DAMA.meioY * R) }],
      [SEMENTE.maos, { forma: maos }],
      // Os ombros estreitos, as duas metades na ordem de hoje (a da esquerda primeiro).
      [SEMENTE.ombros, { get forma() { return metadeDosOmbros(vezDoOmbro++ === 0 ? -1 : 1) } }],
      [SEMENTE.ombreiras[0], { forma: null }],
      [SEMENTE.ombreiras[1], { forma: null }],
      [SEMENTE.rosto, { antes: aFlor }],
      [SEMENTE.crista, { forma: diademaECoque, opcoes: { bisel: r * 0.12, tom: 1.18 } }],
    ]),
  }
})

export const versoesDoEstatua: VersoesDesenhadas = { cavaleiro, rei, dama }
