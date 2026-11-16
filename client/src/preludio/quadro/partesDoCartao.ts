import type { Secao } from '../../lib/preparo/tipos'
import { CARD_LARGURA_COLUNA, escalaDoCartao } from './cartaoCanvas'

/**
 * AS PARTES DO CARTÃO QUE VIERAM DO GRIMÓRIO (correção da F3c): a faixa de
 * itens do lugar, as colunas "ao lado" e o enquadramento do retrato. Lógica
 * pura, sem tldraw, para o teste e para a conta do tamanho.
 */

// ─── A faixa de itens do lugar (Grimório, `lib/faixaItensCenario.ts`, sem mudança na conta) ───

/**
 * Onde a faixa com o acervo do lugar fica, grudada no cartão. `oculta` é o
 * padrão: o quadro salvo antes da faixa existir não muda de tamanho ao abrir.
 */
export type LadoDaFaixa = 'oculta' | 'baixo' | 'direita' | 'cima' | 'esquerda'

/** A ordem do botão que gira a faixa; depois do último lado, volta a `oculta`. */
export const LADOS_DA_FAIXA: readonly LadoDaFaixa[] = ['oculta', 'baixo', 'direita', 'cima', 'esquerda']

/** Espessura da faixa, em unidades do quadro, com o cartão na escala 1 (cabe uma miniatura de item legível). */
export const FAIXA_ITENS_BASE = 76

export function proximoLado(lado: LadoDaFaixa): LadoDaFaixa {
  const indice = LADOS_DA_FAIXA.indexOf(lado)
  return LADOS_DA_FAIXA[(indice + 1) % LADOS_DA_FAIXA.length] ?? 'oculta'
}

/** A faixa à direita ou à esquerda come largura do cartão; em cima ou embaixo, come altura. */
export function faixaComeLargura(lado: LadoDaFaixa): boolean {
  return lado === 'direita' || lado === 'esquerda'
}

function espessuraPorLargura(colunas: number): number {
  return FAIXA_ITENS_BASE / (Math.max(1, colunas) * CARD_LARGURA_COLUNA)
}

/**
 * A largura do conteúdo do cartão (imagem e painéis), sem a faixa. A escala sai
 * dela: ligar a faixa ao lado não pode aumentar o texto e a imagem sozinhos.
 * Como a faixa escala junto, a conta fecha: `w = wc + BASE · wc / (colunas · COLUNA)`.
 */
export function larguraDoConteudo(w: number, lado: LadoDaFaixa, colunas: number): number {
  return faixaComeLargura(lado) ? w / (1 + espessuraPorLargura(colunas)) : w
}

/** A espessura da faixa num cartão de largura total `w` (cresce junto quando o cartão cresce). */
export function espessuraDaFaixa(w: number, lado: LadoDaFaixa, colunas: number): number {
  if (lado === 'oculta') return 0
  return FAIXA_ITENS_BASE * escalaDoCartao(larguraDoConteudo(w, lado, colunas), Math.max(1, colunas))
}

/**
 * O tamanho do cartão depois de girar a faixa: tira a faixa da dimensão onde
 * estava e põe na nova, com o conteúdo do mesmo tamanho. Girar pelos quatro
 * lados e voltar a `oculta` devolve o tamanho de partida.
 */
export function tamanhoAoTrocarLado(tamanho: { readonly w: number; readonly h: number }, colunas: number, de: LadoDaFaixa, para: LadoDaFaixa): { w: number; h: number } {
  const espessuraAntiga = espessuraDaFaixa(tamanho.w, de, colunas)
  const wConteudo = larguraDoConteudo(tamanho.w, de, colunas)
  const hConteudo = de === 'oculta' || faixaComeLargura(de) ? tamanho.h : tamanho.h - espessuraAntiga
  if (para === 'oculta') return { w: wConteudo, h: hConteudo }
  const espessuraNova = FAIXA_ITENS_BASE * escalaDoCartao(wConteudo, Math.max(1, colunas))
  return faixaComeLargura(para) ? { w: wConteudo + espessuraNova, h: hConteudo } : { w: wConteudo, h: hConteudo + espessuraNova }
}

/** Onde a faixa está, nas palavras do botão. */
const ONDE: Record<LadoDaFaixa, string> = { oculta: 'escondida', baixo: 'embaixo', direita: 'à direita', cima: 'em cima', esquerda: 'à esquerda' }

/** O texto do botão que gira a faixa: onde ela está e o que o próximo clique faz. */
export function descreverGiro(atual: LadoDaFaixa, proximo: LadoDaFaixa): string {
  return `Itens do acervo (faixa ${ONDE[atual]}). Clique: ${proximo === 'oculta' ? 'esconder' : `faixa ${ONDE[proximo]}`}`
}

// ─── As colunas "ao lado" ───

/** As seções que o Grimório deixava pôr numa coluna própria do cartão. */
export type ChaveDaColuna = 'informacao' | 'eventos' | 'itens' | 'efeito'

export const TITULO_DA_COLUNA: Readonly<Record<ChaveDaColuna, string>> = { informacao: 'Informações', eventos: 'Eventos', itens: 'Itens', efeito: 'Efeito' }

/**
 * A coluna própria desta seção, se ela tiver uma neste tipo de cartão. A
 * importação dá à seção o id `<forma>-<chave>` (`importar/converter.ts`); a
 * seção nascida no Prelúdio é achada pelo título do molde.
 */
export function colunaDaSecao(secao: Pick<Secao, 'id' | 'titulo'>, chaves: readonly ChaveDaColuna[]): ChaveDaColuna | null {
  for (const chave of chaves) if (secao.id.endsWith(`-${chave}`)) return chave
  const titulo = secao.titulo.trim().toLocaleLowerCase('pt-BR')
  for (const chave of chaves) if (TITULO_DA_COLUNA[chave].toLocaleLowerCase('pt-BR') === titulo) return chave
  return null
}

// ─── O enquadramento do retrato (Grimório, `lib/focoRetrato.ts`) ───

function ehPorcentagem(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor) && valor >= 0 && valor <= 100
}

/**
 * O `object-position` do retrato, a partir do foco que a importação guardou
 * em `forma.extras.foco` (`{x, y}` de 0 a 100). Sem foco válido, o centro, o
 * desenho de sempre: `NaN%` seria regra inválida, e o navegador a jogaria fora.
 */
export function posicaoDoRetrato(foco: unknown): string {
  if (foco === null || typeof foco !== 'object' || !('x' in foco) || !('y' in foco)) return '50% 50%'
  const { x, y } = foco
  return ehPorcentagem(x) && ehPorcentagem(y) ? `${x}% ${y}%` : '50% 50%'
}
