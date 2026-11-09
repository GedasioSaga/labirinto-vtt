import type { CartaoDaFicha, MecanicaGuardada, Personagem } from '../personagem'
import { acaoDasPecas, avisoDoCartaoMontado, cartaoMontado, custoDasPecas, formulaDoNumero, pecasDoCartao, tempoDasPecas } from './mecanica/leitura'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { overloadNaBatalha } from './escolhaEEvolucao'
import { CAMPO_DO_DANO, lerDano, type ContextoDaFormula, type LeituraDoDano } from './formula'
import { CAMPO_DA_ACAO, CAMPO_DO_CUSTO, CAMPO_DO_TEMPO, lerAcao, lerCusto, lerTempo, tecnicasDe, type LeituraDaAcao, type LeituraDoCusto, type LeituraDoTempo } from './leituraDaFicha'
import { lerTipo, type LeituraDoTipo } from './tiposDaHabilidade'
import { custoPeloMaximo, formulaDaMecanica, mecanicaDoCartao } from './mecanicasAMao'
import type { RespostasDoPedido } from './perguntaNaHora'

/**
 * A LEITURA DA TÉCNICA numa função só (conserto das fichas F2, fatia A; seção
 * 2 de docs/planos/construtor-de-mecanicas-2026-11-08.md): custo, ação,
 * tempo, Overload, transformação, tipo e (quando pedido) o dano do cartão.
 * O menu (`tecnicasNoMenu`), o golpe (`tecnicaPedida`), a reação com técnica,
 * a invocação, o duelo do Lobby (pelo menu) e a Saúde liam cada um por conta
 * própria; agora todos passam por aqui. É a costura do construtor: a técnica
 * montada por peças vai traduzir as peças para estas MESMAS leituras.
 *
 * Puro: sem store, sem rede.
 */

export interface ContextoDaLeitura {
  personagem: Personagem
  sistema: SistemaDeRpg
  /** As evoluídas do combate de quem usa: a base evoluída sem link cujo texto diz OVERLOAD conta como Overload. */
  evoluidas?: readonly string[]
  /** As técnicas que a regra do Overload olha; ausente = `tecnicasDe` (o menu passa as dele, com as da forma). */
  todas?: readonly CartaoDaFicha[]
  /** O custo confirmado na tela: vale sobre o da ficha, no recurso que a ficha diz (SP por padrão). Ausente ou `null` = o da ficha. */
  custoDaTela?: number | null
}

export interface LeituraDaTecnica {
  cartao: CartaoDaFicha
  /** O campo Ação inteiro, como a ficha diz (sem a regra do Overload na Completa). */
  acaoDaFicha: LeituraDaAcao
  custo: LeituraDoCusto
  tempo: LeituraDoTempo
  overload: boolean
  transformacao: boolean
  tipo: LeituraDoTipo
}

/** O custo da tela no lugar do da ficha, no recurso que a ficha diz. */
function custoComATela(lido: LeituraDoCusto, custoDaTela: number | null | undefined): LeituraDoCusto {
  if (custoDaTela === null || custoDaTela === undefined) return lido
  const recurso = lido.tipo === 'nada' ? 'sp' : lido.recurso
  return { tipo: 'valor', recurso, valor: custoDaTela, porTurno: false }
}

/**
 * F2 (fatia F): o custo da ficha, ou o da mecânica à mão pela porcentagem do
 * máximo (Chamas Celestes: 10% do HP máximo = 90, não do atual).
 */
function custoDaFicha(cartao: CartaoDaFicha, personagem: Personagem): LeituraDoCusto {
  const peloMaximo = custoPeloMaximo(cartao.id, personagem.maximos)
  if (peloMaximo !== null) return { tipo: 'valor', recurso: peloMaximo.recurso, valor: peloMaximo.valor, porTurno: false }
  return lerCusto(cartao.campos[CAMPO_DO_CUSTO] ?? '', personagem)
}

/**
 * Construtor C1: o cartão MONTADO lido pelas peças, nas mesmas leituras do
 * texto (tudo ou nada: o texto vira só descrição). Peça torta ou de app mais
 * novo = à mão: custo perguntado com o aviso, ação perguntada, sem Tempo.
 */
function leituraDasPecas(cartao: CartaoDaFicha, ctx: ContextoDaLeitura): LeituraDaTecnica {
  const { personagem, sistema } = ctx
  const pecas = pecasDoCartao(cartao)
  const tipo = lerTipo(cartao)
  if (pecas === null) {
    const aviso = avisoDoCartaoMontado(cartao) ?? ''
    return { cartao, acaoDaFicha: { acao: null, overload: false, transformacao: false, tambemReacao: false }, custo: custoComATela({ tipo: 'pergunta', recurso: 'sp', sugestao: null, texto: aviso }, ctx.custoDaTela), tempo: { tipo: 'livre' }, overload: false, transformacao: false, tipo }
  }
  const lerFormula = (formula: string): number | null => {
    const lido = lerDano(formula, { personagem, sistema, arma: null, vidaDoAlvo: null })
    return lido.tipo === 'valor' ? lido.valor : null
  }
  const acaoDaFicha = acaoDasPecas(pecas)
  return {
    cartao,
    acaoDaFicha,
    custo: custoComATela(custoDasPecas(pecas, personagem, lerFormula), ctx.custoDaTela),
    tempo: tempoDasPecas(pecas),
    overload: acaoDaFicha.overload,
    transformacao: false,
    tipo,
  }
}

/** A técnica lida do cartão. F2 (fatia F): a ação e os usos da mecânica à mão vencem os da ficha (Florescer livre, Medicina 3 por batalha). */
export function leituraDaTecnica(cartao: CartaoDaFicha, ctx: ContextoDaLeitura): LeituraDaTecnica {
  if (cartaoMontado(cartao)) return leituraDasPecas(cartao, ctx)
  const { personagem, sistema } = ctx
  const mecanica = mecanicaDoCartao(cartao.id)
  const lida = lerAcao(cartao.campos[CAMPO_DA_ACAO] ?? '')
  const acaoDaFicha = mecanica?.acao === undefined ? lida : { ...lida, acao: mecanica.acao }
  return {
    cartao,
    acaoDaFicha,
    custo: custoComATela(custoDaFicha(cartao, personagem), ctx.custoDaTela),
    tempo: mecanica?.usosPorBatalha === undefined ? lerTempo(cartao.campos[CAMPO_DO_TEMPO] ?? '') : { tipo: 'usos', vezes: mecanica.usosPorBatalha },
    overload: overloadNaBatalha(cartao, ctx.todas ?? tecnicasDe(personagem, sistema), ctx.evoluidas),
    transformacao: acaoDaFicha.transformacao,
    tipo: lerTipo(cartao),
  }
}

/**
 * O dano do cartão sem a vida do alvo (o menu e a Saúde não sabem o alvo; a
 * mira relê com ele), com a arma e o bônus dos selos de quem usa.
 */
export function danoDaTecnica(cartao: CartaoDoDano, ctx: Omit<ContextoDaFormula, 'vidaDoAlvo'>, respostas?: RespostasDoPedido): LeituraDoDano {
  return danoDaTecnicaComAVida(cartao, ctx, null, respostas)
}

/** O cartão como o dano o lê: os campos, e (quando há) o id da tabela à mão e as peças do construtor. */
type CartaoDoDano = Pick<CartaoDaFicha, 'campos'> & { id?: string; mecanica?: MecanicaGuardada }

/**
 * Construtor C1: o dano do cartão MONTADO, pela fórmula da peça (a arma só
 * entra com `arma: 'padrao'`). Sem peça de dano = sem dano; torto ou de app
 * mais novo = à mão (a mira pede o número), nunca o campo Dano.
 */
function danoDasPecas(cartao: CartaoDoDano, ctx: Omit<ContextoDaFormula, 'vidaDoAlvo'>, vidaDoAlvo: ContextoDaFormula['vidaDoAlvo']): LeituraDoDano {
  const pecas = pecasDoCartao(cartao)
  if (pecas === null) return { tipo: 'naoEntende', texto: avisoDoCartaoMontado(cartao) ?? '' }
  if (pecas.dano === undefined) return { tipo: 'semDano' }
  return lerDano(formulaDoNumero(pecas.dano.base), { ...ctx, arma: pecas.dano.arma === 'padrao' ? ctx.arma : null, vidaDoAlvo })
}

/** F2 (fatia D, Explosão): o dano do cartão com a vida de UM alvo ("10% da vida atual do alvo"); o host relê alvo a alvo (`golpe.ts`). */
export function danoDaTecnicaComAVida(cartao: CartaoDoDano, ctx: Omit<ContextoDaFormula, 'vidaDoAlvo'>, vidaDoAlvo: ContextoDaFormula['vidaDoAlvo'], respostas?: RespostasDoPedido): LeituraDoDano {
  if (cartaoMontado(cartao)) return danoDasPecas(cartao, ctx, vidaDoAlvo)
  // F2 (fatia B): a fórmula da mecânica à mão (com o que as respostas mudam) vence o campo Dano.
  const daMecanica = cartao.id === undefined ? null : formulaDaMecanica(cartao.id, respostas)
  return lerDano(daMecanica ?? cartao.campos[CAMPO_DO_DANO] ?? '', { ...ctx, vidaDoAlvo })
}
