/**
 * A BRASA NO TOM DA CHAMA (lote L02 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`): o
 * desenho de hoje de um tipo de fogo (braseiro, tocha de parede, tocha de pé, pilar com braseiro), com o FOGO PARADO
 * levado da laranja para a cor da versão (azul, verde ou roxa). A chama animada, a fagulha e a luz já saem da versão
 * (`lib/mobilia/corDaChama.ts`, I0-c); aqui só a imagem parada: o leito em brasa entre os torrões, as brasas, o halo, o
 * brilho que o fogo deixa na beira do metal e, no pilar, as línguas pintadas.
 *
 * Como: o montador de hoje monta a cena inteira e, depois, cada peça dele ganha a textura de sempre seguida da troca de
 * tom, que só pega o pixel que EMITE luz (`s[4] > 0`: só o fogo emite; o ferro, a cinza e a pedra não). A troca é em
 * OKLab: a luz do pixel fica (o miolo continua claro e a beira funda continua escura), o matiz vai da borda da chama
 * da versão, no fundo, ao miolo dela, no quente, e o croma é o da laranja na mesma proporção que a borda da cor tem
 * para a borda laranja. Assim o carvão, o ferro e a cinza não mudam um pixel, a brasa casa com a chama animada da
 * mesma versão, e nenhum tipo base é editado (contrato do desenhista, `docs/design/arte-temas/COMO-DESENHAR.md`).
 *
 * Régua "não estoura": canal até 245 e o croma nunca acima do da laranja de hoje.
 */
import { TONS_DA_CHAMA, type CorDaChama } from '../../../../lib/mobilia/corDaChama'
import type { MontarMovel } from '../contexto'
import type { Cena, Peca, Textura } from '../motor'

/** As cores que pintam a brasa de outro tom (a laranja é o desenho de hoje). */
export type CorDaBrasa = Exclude<CorDaChama, 'laranja'>

type Lab = readonly [number, number, number]

const TETO_DO_CANAL = 245

function linear(c8: number): number {
  const u = Math.min(1, Math.max(0, c8 / 255))
  return u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4
}

function canal(l: number): number {
  const u = Math.min(1, Math.max(0, l))
  return 255 * (u <= 0.0031308 ? u * 12.92 : 1.055 * u ** (1 / 2.4) - 0.055)
}

function labDe(r8: number, g8: number, b8: number): Lab {
  const r = linear(r8)
  const g = linear(g8)
  const b = linear(b8)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

/** OKLab de volta para os canais 0..255 (sem arredondar: o motor guarda a amostra em ponto flutuante). */
function rgbDe(L: number, a: number, b: number): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    canal(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    canal(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    canal(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ]
}

function labDoHex(hex: number): Lab {
  return labDe((hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff)
}

const croma = ([, a, b]: Lab): number => Math.hypot(a, b)
const matiz = ([, a, b]: Lab): number => Math.atan2(b, a)

/**
 * A régua do calor, em luz OKLab: a brasa funda do braseiro (`#5c3329`, a beira do leito) é o 0, o miolo da brasa da
 * fogueira (`BRASA_QUENTE`, `#c48252`) é o 1. Acima de 1 (as línguas pintadas do pilar) fica o matiz do miolo.
 */
const LUZ_DO_FUNDO = labDe(0x5c, 0x33, 0x29)[0]
const LUZ_DO_QUENTE = labDe(0xc4, 0x82, 0x52)[0]

interface TomDaBrasa {
  readonly matizDoFundo: number
  readonly matizDoQuente: number
  /** O croma da laranja vezes isto: a borda da cor sobre a borda laranja, nunca acima de 1. */
  readonly croma: number
}

/**
 * O quanto mais cada cor é contida, além da proporção das bordas. O azul, no mesmo croma OKLab, sai bem mais
 * saturado em HSL que o verde e o roxo: na primeira folha (28/11) a brasa azul lia azul-céu (saturação p95 0,51
 * contra 0,39 e 0,36). Com 0,8 ela volta ao azul acinzentado da chama (`TONS_DA_CHAMA.azul`, "sem neon").
 */
const CONTENCAO: Readonly<Record<CorDaBrasa, number>> = { azul: 0.8, verde: 1, roxa: 1 }

function tomDaBrasa(cor: CorDaBrasa): TomDaBrasa {
  const borda = labDoHex(TONS_DA_CHAMA[cor].borda)
  const miolo = labDoHex(TONS_DA_CHAMA[cor].miolo)
  return {
    matizDoFundo: matiz(borda),
    matizDoQuente: matiz(miolo),
    croma: Math.min(1, croma(borda) / croma(labDoHex(TONS_DA_CHAMA.laranja.borda))) * CONTENCAO[cor],
  }
}

const TONS: Readonly<Record<CorDaBrasa, TomDaBrasa>> = { azul: tomDaBrasa('azul'), verde: tomDaBrasa('verde'), roxa: tomDaBrasa('roxa') }

/** O ângulo de `a` até `b` pelo caminho curto, na fração `t`. */
function entreAngulos(a: number, b: number, t: number): number {
  let d = b - a
  while (d > Math.PI) d -= 2 * Math.PI
  while (d < -Math.PI) d += 2 * Math.PI
  return a + d * t
}

/** Leva o pixel que emite (`s[4] > 0`) para o tom da brasa; o resto fica como está. */
function levarAoTom(s: Float32Array, tom: TomDaBrasa): void {
  if (s[4] <= 0) return
  const lab = labDe(s[0], s[1], s[2])
  const t = Math.min(1, Math.max(0, (lab[0] - LUZ_DO_FUNDO) / (LUZ_DO_QUENTE - LUZ_DO_FUNDO)))
  const h = entreAngulos(tom.matizDoFundo, tom.matizDoQuente, t)
  const c = croma(lab) * tom.croma
  const [r, g, b] = rgbDe(lab[0], Math.cos(h) * c, Math.sin(h) * c)
  s[0] = Math.min(TETO_DO_CANAL, r)
  s[1] = Math.min(TETO_DO_CANAL, g)
  s[2] = Math.min(TETO_DO_CANAL, b)
}

/** A peça com a textura de sempre seguida da troca de tom (a peça sem textura não tem fogo: fica igual). */
function noTom(p: Peca, tom: TomDaBrasa): Peca {
  const tex = p.tex
  if (tex === null) return p
  const nova: Textura = (u, v, x, y, peca, s, escala) => {
    tex(u, v, x, y, peca, s, escala)
    levarAoTom(s, tom)
  }
  return { ...p, tex: nova }
}

/** Troca o tom do fogo das peças da cena a partir de `inicio` (as que o montador acabou de pôr). */
function brasaNoTom(cena: Cena, inicio: number, cor: CorDaBrasa): void {
  const tom = TONS[cor]
  for (let i = inicio; i < cena.partes.length; i += 1) cena.partes[i] = noTom(cena.partes[i], tom)
}

/** O montador de hoje com o fogo parado na cor `cor`: a mesma pegada, os mesmos lugares de material e a mesma 3/4. */
export function comBrasaNoTom(montar: MontarMovel, cor: CorDaBrasa): MontarMovel {
  return (c, cena) => {
    const inicio = cena.partes.length
    montar(c, cena)
    brasaNoTom(cena, inicio, cor)
  }
}
