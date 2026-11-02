/**
 * DRAGON BALL TALES — transformações (7.0-7.1, p. 92-95). Puro.
 *
 * Regra geral (p. 93): o estágio N dá EP +N e custa 3 × N de Ki para ativar.
 * O exemplo impresso foge dela: Super Saiyajin Estágio 1/2/3 = EP +2/+3/+4,
 * Ki 6/9/12 (p. 92-93), o que bate com a regra se o Ōzaru (EP +1, Ki 3, p. 25)
 * for contado como o estágio 1 da linha saiyajin. Por isso o número IMPRESSO
 * no catálogo vence (`TransformacaoDBT.ep`/`custoKi`); a regra geral só entra
 * quando o livro não dá o número ou quando a forma é criada com o mestre.
 */
import { type FichaDBT, type TransformacaoDBT, type TransformacaoDaFichaDBT, novoIdDBT } from '../modelo'

/** Ki de ativação por estágio (p. 93: Estágio 6 = 18). */
export const KI_POR_ESTAGIO = 3

/** A regra geral da p. 93. Estágio abaixo de 1 vale 1. */
export function regraDoEstagio(estagio: number): { ep: number; custoKi: number } {
  const n = Math.max(1, Math.floor(estagio))
  return { ep: n, custoKi: KI_POR_ESTAGIO * n }
}

/** Forma nova criada com o mestre: EP e Ki pela regra geral. */
export function novaTransformacao(nome: string, estagio: number): TransformacaoDaFichaDBT {
  const { ep, custoKi } = regraDoEstagio(estagio)
  return {
    id: novoIdDBT('tra'),
    livroId: null,
    nome,
    estagio: Math.max(1, Math.floor(estagio)),
    ep,
    custoKi,
    kiPorRodada: 0,
    efeitos: '',
    origem: '',
  }
}

/** Forma do catálogo (raça ou NPC pronto) na ficha: o impresso vence a regra (ver o topo do arquivo). */
export function transformacaoDoCatalogo(t: TransformacaoDBT, origem: string): TransformacaoDaFichaDBT {
  const estagio = t.estagio ?? 1
  const regra = regraDoEstagio(estagio)
  return {
    id: novoIdDBT('tra'),
    livroId: t.id,
    nome: t.nome,
    estagio,
    ep: t.ep ?? regra.ep,
    custoKi: t.custoKi ?? regra.custoKi,
    kiPorRodada: 0,
    efeitos: t.efeitos.join('\n'),
    origem,
  }
}

/**
 * Onde a forma foge da regra geral, em texto para a tela. Não é erro: o
 * exemplo do próprio livro foge (Super Saiyajin); serve para o mestre ver.
 */
export function divergenciaDaRegra(t: TransformacaoDaFichaDBT): string | null {
  const regra = regraDoEstagio(t.estagio)
  const partes: string[] = []
  if (t.ep !== regra.ep) partes.push(`EP +${t.ep} (a regra dá +${regra.ep})`)
  if (t.custoKi !== regra.custoKi) partes.push(`Ki ${t.custoKi} (a regra dá ${regra.custoKi})`)
  if (partes.length === 0) return null
  return `Estágio ${t.estagio} com ${partes.join(' e ')}: vale o da ficha (p. 93; o Super Saiyajin do livro também foge).`
}

/** A forma ligada agora; null = forma normal (ou id que não existe mais). */
export function transformacaoAtiva(ficha: FichaDBT): TransformacaoDaFichaDBT | null {
  if (ficha.transformacaoAtiva === null) return null
  return ficha.transformacoes.find((t) => t.id === ficha.transformacaoAtiva) ?? null
}

/** EP bônus da forma ativa (não soma na CA, p. 13). */
export function epBonusDaFicha(ficha: FichaDBT): number {
  const ativa = transformacaoAtiva(ficha)
  return ativa === null ? 0 : ativa.ep
}

/** Ki para ativar: 0 no turno em que tirou 20 natural na iniciativa (9.1, p. 113). */
export function custoParaAtivar(t: TransformacaoDaFichaDBT, vinteNaturalNaIniciativa: boolean): number {
  return vinteNaturalNaIniciativa ? 0 : t.custoKi
}

/** Liga a forma (id da lista da ficha). Id desconhecido: a ficha volta igual. */
export function ativarTransformacao(ficha: FichaDBT, id: string): FichaDBT {
  if (!ficha.transformacoes.some((t) => t.id === id)) return ficha
  return { ...ficha, transformacaoAtiva: id }
}

export function desativarTransformacao(ficha: FichaDBT): FichaDBT {
  return ficha.transformacaoAtiva === null ? ficha : { ...ficha, transformacaoAtiva: null }
}

export interface EstadoParaTransformacao {
  pv: number
  ki: number
  atordoado: boolean
  inconsciente: boolean
}

/** Por que a forma acaba agora (p. 93); null = continua. Ki zerado conta durante turno de ação ou reação. */
export function motivoDoFimDaTransformacao(estado: EstadoParaTransformacao): string | null {
  if (estado.pv <= 0) return 'Chegou a 0 PV.'
  if (estado.inconsciente) return 'Perdeu a consciência.'
  if (estado.atordoado) return 'Ficou atordoado.'
  if (estado.ki <= 0) return 'Zerou o Ki.'
  return null
}
