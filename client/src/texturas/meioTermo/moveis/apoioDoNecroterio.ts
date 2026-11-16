/**
 * APOIO DO NECROTÉRIO E LABORATÓRIO (lote L1 de 16/11/2026: o mestre aprovou fazer, no Meio-Termo, versões
 * ORIGINAIS do que faltava das quatro referências de mapa, `tmp/referencias-2026-11-15/FALTA.md`, itens 1 a 10): os
 * materiais fixos que a mesa de autópsia, a maca, a câmara frigorífica, o esterilizador, a luminária articulada, a
 * bandeja de instrumentos, a mesa de laboratório, as panelas e bacias, a cadeira giratória e a máquina de escrever
 * dividem. Não é um objeto: não tem registro nem ficha.
 *
 * O tom é o de hospital antigo, capaz de horror mas contido: o inox escovado da geladeira (`geladeira.ts`), o
 * esmalte branco de ágata com a beira azul-marinho, a tinta cinza-esverdeada do ferro de hospital, o níquel polido,
 * o latão velho dos manômetros, a borracha preta e o vidro. A única "sujeira" é a mancha seca, marrom, sempre fraca
 * e meio transparente (nada de sangue vivo).
 */
import type { Rgb } from '../../ruido'
import { ruido, type MaterialDaPeca, type Textura } from './motor'

export { ESCURO, ESCURO_DO_INOX, INOX, texEscovado } from './geladeira'

/** O escuro em que o pixel escuro demais é levantado (`cena.corDoPiso`): o da geladeira; a nogueira amarronzava o aço. */
export const PISO_DO_NECROTERIO: Rgb = [0x46, 0x49, 0x4c]

/** O esmalte de ágata: branco leitoso, um nada quente e envelhecido (a louça do banheiro moderno é mais fria). */
export const ESMALTE: MaterialDaPeca = { classe: 'liso', rgb: [0xe2, 0xdf, 0xd5] }
/** A beira azul-marinho do esmalte (a borda das bacias, do jarro e da bandeja de rim). */
export const BEIRA_AZUL: MaterialDaPeca = { classe: 'liso', rgb: [0x3c, 0x48, 0x5c] }
/** O ferro escuro que aparece na lasca do esmalte. */
export const LASCA: MaterialDaPeca = { classe: 'liso', rgb: [0x34, 0x31, 0x2e] }
/** A tinta cinza-esverdeada do ferro de hospital antigo (a maca, as pernas, a base da luminária, a cadeira). */
export const TINTA_VERDE: MaterialDaPeca = { classe: 'liso', rgb: [0x84, 0x91, 0x88] }
/** O ferro escuro sem tinta (os eixos, as rodinhas, o pé da cadeira). */
export const FERRO_VELHO: MaterialDaPeca = { classe: 'metal', rgb: [0x5c, 0x5e, 0x5f] }
/** O níquel polido (o esterilizador, os frisos da máquina de escrever, as juntas): o brilho é o `metal` da peça. */
export const NIQUEL: MaterialDaPeca = { classe: 'liso', rgb: [0xb3, 0xb5, 0xb2] }
/** O latão velho dos manômetros, das válvulas e dos parafusos de borboleta. */
export const LATAO: MaterialDaPeca = { classe: 'metal', rgb: [0xa6, 0x8c, 0x5a] }
/** A borracha preta (as rodinhas, o apoio de cabeça, a mangueira, o rolo da máquina). */
export const BORRACHA: MaterialDaPeca = { classe: 'liso', rgb: [0x33, 0x32, 0x31] }
/** O vidro: cinza-esverdeado muito claro. Vai sempre meio transparente. */
export const VIDRO: MaterialDaPeca = { classe: 'liso', rgb: [0xc6, 0xd2, 0xce] }
/** O reflexo do vidro, do esmalte e do aço polido: quase branco, frio. */
export const REFLEXO: MaterialDaPeca = { classe: 'liso', rgb: [0xf3, 0xf5, 0xf4] }
/** A mancha seca: marrom de ferrugem, sempre fraca (alfa baixo) e de beira macia. */
export const MANCHA: MaterialDaPeca = { classe: 'liso', rgb: [0x5c, 0x2e, 0x26] }
/** O papel: creme, um nada amarelado. */
export const PAPEL: MaterialDaPeca = { classe: 'liso', rgb: [0xe6, 0xdf, 0xcb] }
/** O couro escuro do assento (marrom-boi, quase sem cor). */
export const COURO: MaterialDaPeca = { classe: 'liso', rgb: [0x5a, 0x40, 0x32] }
/** A laca preta da máquina de escrever: preto quente, não puro (o piso de luz levanta o resto). */
export const LACA_PRETA: MaterialDaPeca = { classe: 'liso', rgb: [0x30, 0x2e, 0x2c] }

/** Os líquidos dos frascos, contidos: âmbar, verde-pálido, turvo (vermelho-tijolo apagado) e azul de sulfato. */
export const LIQUIDO_AMBAR: MaterialDaPeca = { classe: 'liso', rgb: [0xa8, 0x7c, 0x42] }
export const LIQUIDO_VERDE: MaterialDaPeca = { classe: 'liso', rgb: [0x8e, 0xa8, 0x86] }
export const LIQUIDO_TURVO: MaterialDaPeca = { classe: 'liso', rgb: [0x7a, 0x4a, 0x40] }
export const LIQUIDO_AZUL: MaterialDaPeca = { classe: 'liso', rgb: [0x7f, 0x9c, 0xab] }

/** Brilho (o `metal` do motor): o níquel e o aço das ferramentas, polidos; a tinta, fosca. */
export const BRILHO_DO_NIQUEL = 0.8
export const BRILHO_DA_TINTA = 0.15

/** O esmalte: uma mancha larga quase invisível (liso demais vira plástico). */
export const texEsmalte: Textura = (u, v, _x, _y, p, s) => {
  s[3] += ruido(u * 0.05 + p.semente * 5, v * 0.05) * 0.035
}

/** Abaixo desta escala (pixels da imagem por px do protótipo) o pontilhado da tinta vira chuvisco. */
const ESCALA_DO_PONTO = 1.5

/** A tinta velha do ferro: manchas largas e leves e um pontilhado miúdo (o pó), que some no tamanho de mesa. */
export const texTinta: Textura = (u, v, _x, _y, p, s, escala) => {
  const ponto = escala < ESCALA_DO_PONTO ? 0.3 : 1
  s[3] += ruido(u * 0.08 + p.semente * 3, v * 0.08) * 0.06 + ruido(u * 0.7, v * 0.7 + p.semente) * 0.03 * ponto
}
