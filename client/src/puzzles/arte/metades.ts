/**
 * AS METADES (21/11): dez peças partidas ao meio. Cada metade é o desenho da
 * peça inteira recortado por uma linha quebrada própria do par (as duas
 * metades de um par se casam; as de outro par, não), com a borda da quebra
 * escurecida e a metade puxada um pouco para o meio do quadro, para a miniatura
 * não ficar torta. Num encaixe de "Duas metades" do motor, o par vira a peça
 * inteira (`vira`), que também está na biblioteca.
 *
 * O recorte (`clipPath`) e o escurecido (`filter`) têm `id` com o nome da
 * metade: cada peça é um SVG sozinho (imagem e rasterizador), sem `<use>`.
 *
 * Puro: sem React, sem disco.
 */
import type { IdDaChave, IdDaMetade, IdDaPecaDeEncaixe } from '../tipos'
import { ARTE_DAS_CHAVES } from './chaves'
import { ARTE_DAS_PECAS_DE_ENCAIXE } from './pecasDeEncaixe'

/** A peça inteira de cada par: uma das peças de encaixe ou uma chave. */
export type IdDaPecaInteira = IdDaPecaDeEncaixe | IdDaChave

export interface ParDeMetades {
  inteira: IdDaPecaInteira
  /** A metade da esquerda (ou a argola, ou o lado do sol) e a da direita. */
  metades: readonly [IdDaMetade, IdDaMetade]
  /** O desvio da linha da quebra em cada altura de `ALTURAS_DA_QUEBRA`, em unidades do quadro. */
  quebra: readonly number[]
}

/** Os dez pares, na ordem da biblioteca. */
export const PARES_DE_METADES: readonly ParDeMetades[] = [
  { inteira: 'tabua-runas', metades: ['metade-tabua-esq', 'metade-tabua-dir'], quebra: [0.6, -1.8, 1.6, -2, 1.2, -1.4, 2, -0.8, 0.4] },
  { inteira: 'disco-eclipse', metades: ['metade-disco-sol', 'metade-disco-lua'], quebra: [0, 1.4, -1.2, 1.8, -1.6, 1.2, -1.8, 1, 0] },
  { inteira: 'espelho-bronze', metades: ['metade-espelho-esq', 'metade-espelho-dir'], quebra: [-0.4, 2, -1.4, 0.8, -2.2, 1.6, -1, 1.8, -0.6] },
  { inteira: 'selo-real', metades: ['metade-selo-esq', 'metade-selo-dir'], quebra: [1, -1.2, 2.2, -0.6, 1.4, -2, 0.8, -1.6, 0.6] },
  { inteira: 'estrela-prata', metades: ['metade-estrela-esq', 'metade-estrela-dir'], quebra: [-0.8, 1.2, -2, 1.6, -0.4, 2, -1.6, 0.6, -1] },
  { inteira: 'coroa-bronze', metades: ['metade-coroa-esq', 'metade-coroa-dir'], quebra: [0.4, -2, 1, -1.2, 2.2, -0.8, 1.6, -2, 0.8] },
  { inteira: 'med-cervo', metades: ['metade-cervo-esq', 'metade-cervo-dir'], quebra: [-1, 1.8, -0.6, 2, -1.8, 0.8, -1.2, 1.6, -0.4] },
  { inteira: 'mascara-ouro', metades: ['metade-mascara-esq', 'metade-mascara-dir'], quebra: [0.8, -0.8, 1.8, -1.8, 0.6, -1.2, 2, -1.4, 0.2] },
  { inteira: 'bra-torre', metades: ['metade-torre-esq', 'metade-torre-dir'], quebra: [-0.6, 1.6, -1.8, 0.6, -1, 2.2, -1.6, 1, -0.8] },
  { inteira: 'chave-sol', metades: ['metade-chave-argola', 'metade-chave-haste'], quebra: [1.2, -0.6, 2, -1.4, 0.8, -2, 1.4, -1, 0.6] },
]

/** As alturas onde a linha da quebra dobra, de cima a baixo do quadro. */
const ALTURAS_DA_QUEBRA = [0, 6, 12, 18, 24, 30, 36, 42, 48]
/** A largura da borda escura da quebra. */
const LARGURA_DA_BORDA = 1.8
/** Quanto a metade anda para o meio do quadro, e quanto gira (graus). */
const PUXADA_PARA_O_MEIO = 4.5
const GIRO_DA_METADE = 3
/** O escurecido da borda: o mesmo `tom` de ~55% dos contornos. */
const ESCURO_DA_BORDA = 0.55

const ARTE_DAS_INTEIRAS: Readonly<Record<IdDaPecaInteira, string>> = { ...ARTE_DAS_PECAS_DE_ENCAIXE, ...ARTE_DAS_CHAVES }

function pontosDaQuebra(quebra: readonly number[], desvio: number): [number, number][] {
  return ALTURAS_DA_QUEBRA.map((y, i) => [24 + (quebra[i] ?? 0) + desvio, y])
}

function caminho(pontos: readonly [number, number][]): string {
  return pontos.map(([x, y]) => `L${x.toFixed(2)} ${y}`).join('')
}

/** `lado` -1 = a metade da esquerda; 1 = a da direita. */
function metade(id: IdDaMetade, inteira: string, quebra: readonly number[], lado: -1 | 1): string {
  const borda = lado === -1 ? 0 : 48
  const linha = pontosDaQuebra(quebra, 0)
  const regiao = `M${borda} 0${caminho(linha)}L${borda} 48Z`
  const dentro = pontosDaQuebra(quebra, lado * LARGURA_DA_BORDA).reverse()
  const faixa = `M${caminho(linha).slice(1)}${caminho(dentro)}Z`
  const escuro = `<feFuncR type="linear" slope="${ESCURO_DA_BORDA}"/><feFuncG type="linear" slope="${ESCURO_DA_BORDA}"/><feFuncB type="linear" slope="${ESCURO_DA_BORDA}"/>`
  return (
    `<defs><clipPath id="${id}-r"><path d="${regiao}"/></clipPath><clipPath id="${id}-b"><path d="${faixa}"/></clipPath>` +
    `<filter id="${id}-e" color-interpolation-filters="sRGB"><feComponentTransfer>${escuro}</feComponentTransfer></filter></defs>` +
    `<g transform="translate(${-lado * PUXADA_PARA_O_MEIO} 0) rotate(${lado * GIRO_DA_METADE} 24 24)">` +
    `<g clip-path="url(#${id}-r)">${inteira}</g>` +
    `<g clip-path="url(#${id}-b)" filter="url(#${id}-e)">${inteira}</g>` +
    '</g>'
  )
}

function arteDasMetades(): Record<IdDaMetade, string> {
  const arte: Partial<Record<IdDaMetade, string>> = {}
  for (const par of PARES_DE_METADES) {
    const inteira = ARTE_DAS_INTEIRAS[par.inteira]
    arte[par.metades[0]] = metade(par.metades[0], inteira, par.quebra, -1)
    arte[par.metades[1]] = metade(par.metades[1], inteira, par.quebra, 1)
  }
  return arte as Record<IdDaMetade, string>
}

/** O miolo do SVG de cada metade, no quadro de 48 x 48. */
export const ARTE_DAS_METADES: Readonly<Record<IdDaMetade, string>> = arteDasMetades()
