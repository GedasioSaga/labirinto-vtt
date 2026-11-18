import type { Ambiente } from './periodo'

/**
 * TEMA DO AMBIENTE (pedido do mestre de 17/11/2026): "mudar o tema do ambiente,
 * deixar mais escuro ou parecer que o lugar é iluminado por uma luz mais
 * alaranjada", por mapa e por andar. Respostas do mestre:
 *  - cinco temas prontos (Normal, Escuro, Tocha, Frio, Noite), um controle de
 *    força e uma cor livre;
 *  - as luzes do próprio mapa (tochas, lareiras, velas) continuam furando o
 *    escuro;
 *  - onde há tema, ele SUBSTITUI a tinta da tarde e da noite;
 *  - só cor: a visão dos jogadores não muda.
 *
 * Só os números e a conta, puros. AINDA NÃO ESTÁ LIGADO em nada: a folha de
 * aprovação (`tmp/pedidos-2026-11-17/tema-folha/`) foi desenhada pelo caminho
 * de verdade (o mapa de luz do editor, `pixi/mapaDeLuz.ts`) com estes valores.
 *
 * A cor entra como a tinta do período: misturada ao branco na força
 * (`corDaTinta`) e MULTIPLICANDO o mapa, no mesmo sprite. Por isso as cores
 * são a luz que banha o lugar, não uma pintura por cima: força 0 = o mapa como
 * foi desenhado.
 */

export type IdDoTema = 'normal' | 'escuro' | 'tocha' | 'frio' | 'noite'

export interface TemaDoAmbiente {
  id: IdDoTema
  rotulo: string
  /** A cor da luz do lugar, `#rrggbb`. */
  cor: string
  /** Onde o controle de força começa (0 a 1). */
  forca: number
  /**
   * Quanto da força de cada luz do mapa entra com este tema (como
   * `LUZ_POR_PERIODO`): 1 = a tocha fura o escuro inteira. Vale o maior entre
   * o do tema e o do período.
   */
  fatorDaLuz: number
  /** O porquê, dito ao mestre no balão do botão. */
  dica: string
}

/**
 * Os cinco temas, do mais claro ao mais escuro. Noite é a noite já aprovada
 * (`AMBIENTE_PADRAO.noite`, 24/10/2026), para o tema e o relógio darem a mesma
 * noite. Cores contidas (regra 5 do Meio-Termo): nenhuma estoura no zoom 100%.
 */
export const TEMAS_DO_AMBIENTE: readonly TemaDoAmbiente[] = [
  { id: 'normal', rotulo: 'Normal', cor: '#ffffff', forca: 0, fatorDaLuz: 0, dica: 'Sem tema: o mapa segue o período (dia, tarde ou noite).' },
  { id: 'escuro', rotulo: 'Escuro', cor: '#1c1f26', forca: 0.55, fatorDaLuz: 1, dica: 'Mais escuro sem mudar a cor do lugar; tochas e lareiras furam o escuro.' },
  // Luz a 0,3 (a conta da tarde, `LUZ_POR_PERIODO.tarde`), não 1: com o mapa já alaranjado, a luz inteira
  // devolve a cor de dia perto da tocha e o claro fica cinza-esverdeado no meio do laranja (visto na folha;
  // a 0,5 ainda esverdeia). A 0,3 o claro fica quente e discreto. Em aberto com o mestre.
  { id: 'tocha', rotulo: 'Tocha', cor: '#d9742c', forca: 0.65, fatorDaLuz: 0.3, dica: 'Um lugar iluminado por tochas: alaranjado e um pouco mais escuro.' },
  { id: 'frio', rotulo: 'Frio', cor: '#7f9ccb', forca: 0.5, fatorDaLuz: 1, dica: 'Azulado e frio, como pedra úmida ou gelo; o mapa continua claro.' },
  { id: 'noite', rotulo: 'Noite', cor: '#465a92', forca: 0.85, fatorDaLuz: 1, dica: 'A noite aprovada, a qualquer hora: azul-ardósia escuro.' },
]

/** O que o mestre escolhe para um mapa ou um andar: o tema, a força e, se quiser, a cor livre. */
export interface EscolhaDoTema {
  id: IdDoTema
  /** Ausente = a força do tema. */
  forca?: number
  /** A cor livre, `#rrggbb`; ausente ou torta = a cor do tema. */
  cor?: string
}

/** A tinta que o mapa de luz desenha: cor e força (como a do período) e o fator das luzes. */
export interface AmbienteComTema extends Ambiente {
  fatorDaLuz: number
}

const COR_HEX = /^#[0-9a-f]{6}$/i

function grampear01(valor: number): number {
  return Number.isFinite(valor) ? Math.min(1, Math.max(0, valor)) : 0
}

/**
 * A conta do tema: o ambiente do período (`ambienteDoPeriodo` com o fator de
 * `LUZ_POR_PERIODO`) com a escolha do mapa ou do andar por cima.
 *  - sem escolha, ou Normal: o período manda, como hoje;
 *  - com tema: a cor e a força do tema SUBSTITUEM as do período (a cor livre
 *    vence a do tema; força fora de 0..1 é grampeada), e as luzes entram com o
 *    maior fator entre o período e o tema (de noite a tocha não enfraquece).
 */
export function ambienteComTema(periodo: AmbienteComTema, escolha: EscolhaDoTema | null | undefined): AmbienteComTema {
  const tema = escolha === null || escolha === undefined ? undefined : TEMAS_DO_AMBIENTE.find((t) => t.id === escolha.id)
  if (tema === undefined || tema.id === 'normal') return { ...periodo }
  const cor = escolha?.cor !== undefined && COR_HEX.test(escolha.cor) ? escolha.cor : tema.cor
  const forca = escolha?.forca === undefined ? tema.forca : grampear01(escolha.forca)
  return { cor, forca, fatorDaLuz: Math.max(grampear01(periodo.fatorDaLuz), tema.fatorDaLuz) }
}
