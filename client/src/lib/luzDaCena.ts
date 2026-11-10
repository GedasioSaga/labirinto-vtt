import { AMBIENTE_PADRAO, type Ambiente, type PeriodoConfiguravel } from './periodo'

/**
 * LUZ DA CENA, o controle rápido do botão do sol (pedido do mestre de
 * 09/11/2026): Dia, Tarde ou Noite e a FORÇA DO ESCURO, guardados na cena
 * (`periodoFixo` e `ambientePorPeriodo`, os campos da Luz L0; nada novo no
 * arquivo). Aqui só a conta da força, pura.
 *
 * A força do escuro é a `forca` da tinta do período (a mesma do painel
 * "Ambiente da cena"). Até `ESCURO_NA_COR_APROVADA` ela só mistura a cor
 * aprovada do período ao branco, como sempre. Dali a 100% a COR também
 * escurece, da aprovada até o breu: sem isso a noite mais forte ainda era um
 * azul claro, e a fogueira não fazia diferença num mapa escuro.
 *
 * Cor que o mestre escolheu à mão no painel (fora dessa linha) fica como
 * está: o controle rápido só mexe na força dela.
 */

/** Até aqui a cor é a aprovada do período (a noite padrão é 85%). */
export const ESCURO_NA_COR_APROVADA = 0.85

/** A cor do período com a força em 100%: quase preto, no tom dele. A da noite é a do atalho "Escuridão total". */
export const BREU_DO_PERIODO: Readonly<Record<PeriodoConfiguravel, string>> = { tarde: '#3a2416', noite: '#10131f' }

/** Passo do controle deslizante e do teclado. */
export const PASSO_DO_ESCURO = 0.05

type Canais = readonly [number, number, number]

function canais(hex: string): Canais | null {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return null
  const valor = Number.parseInt(hex.slice(1), 16)
  return [(valor >> 16) & 255, (valor >> 8) & 255, valor & 255]
}

function hexDosCanais(c: Canais): string {
  return `#${c.map((canal) => Math.round(canal).toString(16).padStart(2, '0')).join('')}`
}

function grampear01(valor: number): number {
  return Number.isFinite(valor) ? Math.min(1, Math.max(0, valor)) : 0
}

/** Quanto da linha aprovada → breu a força pede (0 até `ESCURO_NA_COR_APROVADA`, 1 em 100%). */
function passoParaOBreu(forca: number): number {
  return grampear01((forca - ESCURO_NA_COR_APROVADA) / (1 - ESCURO_NA_COR_APROVADA))
}

/** A cor do período na força dada: a aprovada até 85%, depois escurecendo até o breu. */
export function corDoEscuro(periodo: PeriodoConfiguravel, forca: number): string {
  const aprovada = canais(AMBIENTE_PADRAO[periodo].cor)
  const breu = canais(BREU_DO_PERIODO[periodo])
  // As duas cores são constantes `#rrggbb` deste arquivo e de `periodo.ts`: sem elas não há o que misturar.
  if (aprovada === null || breu === null) return AMBIENTE_PADRAO[periodo].cor
  const t = passoParaOBreu(forca)
  if (t === 0) return AMBIENTE_PADRAO[periodo].cor
  return hexDosCanais([aprovada[0] + (breu[0] - aprovada[0]) * t, aprovada[1] + (breu[1] - aprovada[1]) * t, aprovada[2] + (breu[2] - aprovada[2]) * t])
}

/** Folga de arredondamento (0 a 255 por canal) para a cor ainda contar como a da linha aprovada → breu. */
const FOLGA_DA_COR = 3

/**
 * A cor é uma das que este controle escreve (a aprovada ou um ponto da linha
 * até o breu)? `false` = cor escolhida à mão no painel: o controle a preserva.
 */
export function corGeridaPeloEscuro(periodo: PeriodoConfiguravel, cor: string): boolean {
  const c = canais(cor)
  const aprovada = canais(AMBIENTE_PADRAO[periodo].cor)
  const breu = canais(BREU_DO_PERIODO[periodo])
  if (c === null || aprovada === null || breu === null) return false
  const linha: Canais = [breu[0] - aprovada[0], breu[1] - aprovada[1], breu[2] - aprovada[2]]
  const tamanho = linha[0] ** 2 + linha[1] ** 2 + linha[2] ** 2
  const t = grampear01(((c[0] - aprovada[0]) * linha[0] + (c[1] - aprovada[1]) * linha[1] + (c[2] - aprovada[2]) * linha[2]) / tamanho)
  return [0, 1, 2].every((i) => Math.abs(aprovada[i] + linha[i] * t - c[i]) <= FOLGA_DA_COR)
}

/**
 * O que o controle rápido grava na cena quando o mestre põe a força do escuro
 * em `forca` (0 a 1): a força e, se a cor de agora é uma das geridas, a cor
 * dessa força. Cor escolhida à mão não muda.
 */
export function ambienteNoEscuro(periodo: PeriodoConfiguravel, forca: number, atual: Ambiente): Ambiente {
  const nova = grampear01(forca)
  return { forca: nova, cor: corGeridaPeloEscuro(periodo, atual.cor) ? corDoEscuro(periodo, nova) : atual.cor }
}
