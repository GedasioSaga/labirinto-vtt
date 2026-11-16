/**
 * OS TONS DO BANHEIRO MODERNO (desenhista B, 15/11/2026: o toalheiro, o cesto de roupa, a prateleira de frascos, a
 * lixeira de pedal, o tapete de banheiro e o suporte de papel). O mestre escolheu o estilo moderno, o da geladeira
 * de inox (`geladeira.ts`): louça branca, cromo e inox frios, plástico grafite e as cores contidas dos frascos e da
 * roupa. Não é um objeto: não tem registro nem ficha.
 */
import { rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { ruido, type MaterialDaPeca, type Textura } from './motor'

/** O inox escovado da geladeira (`geladeira.ts`): cinza frio e claro, quase sem cor; a classe é a lisa e o risco é desenhado. */
export const INOX: MaterialDaPeca = { classe: 'liso', rgb: [0xa9, 0xad, 0xaf] }
/** O cromo: mais claro e mais polido que o inox (o brilho é do `metal` da peça e do reflexo desenhado). */
export const CROMO: MaterialDaPeca = { classe: 'liso', rgb: [0xb8, 0xbd, 0xc1] }
/** O plástico grafite (a dobradiça da lixeira, o anel do pé): o cinza frio bem escuro do inox. */
export const GRAFITE: MaterialDaPeca = { classe: 'liso', rgb: [0x4c, 0x50, 0x54] }
/** O papel higiênico: branco um nada quente, mais claro que a louça. */
export const PAPEL: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('branco', 0.97)) }
/** O tubo de papelão no meio do rolo. */
export const PAPELAO: MaterialDaPeca = { classe: 'liso', rgb: [0xb0, 0x93, 0x6c] }

/**
 * O escuro em que o pixel escuro demais é levantado nas peças de metal frio (`cena.corDoPiso`): o da geladeira. Com o
 * padrão (a nogueira), a fresta e a sombra do inox saíam marrons.
 */
export const ESCURO_DO_METAL: Rgb = [0x46, 0x49, 0x4c]

/** Abaixo desta escala (pixels da imagem por px do protótipo) o risco fino cai em menos de 2 pixels e vira chuvisco. */
const ESCALA_DO_RISCO = 1.5
const RISCO_MIUDO = 0.3

/** O aço escovado da geladeira: riscos finos e longos ao comprido do veio (u) e uma mancha larga bem leve por baixo. */
export const texEscovado: Textura = (u, v, _x, _y, p, s, escala) => {
  const risco = escala < ESCALA_DO_RISCO ? RISCO_MIUDO : 1
  s[3] += (ruido(u * 0.03, v * 0.9) * 0.09 + ruido(u * 0.012, v * 0.33) * 0.045) * risco + ruido(u * 0.06 + p.semente * 3, v * 0.06) * 0.06
}

/** Mistura a cor `cor` na saída da textura, na medida `t`. */
export function tingir(s: Float32Array, cor: Rgb, t: number): void {
  s[0] += (cor[0] - s[0]) * t
  s[1] += (cor[1] - s[1]) * t
  s[2] += (cor[2] - s[2]) * t
}
