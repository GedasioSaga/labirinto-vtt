import type { CartaoDaFicha, Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { overloadNaBatalha } from './escolhaEEvolucao'
import { CAMPO_DO_DANO, lerDano, type ContextoDaFormula, type LeituraDoDano } from './formula'
import { CAMPO_DA_ACAO, CAMPO_DO_CUSTO, CAMPO_DO_TEMPO, lerAcao, lerCusto, lerTempo, tecnicasDe, type LeituraDaAcao, type LeituraDoCusto, type LeituraDoTempo } from './leituraDaFicha'
import { lerTipo, type LeituraDoTipo } from './tiposDaHabilidade'

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

/** A técnica lida do cartão. */
export function leituraDaTecnica(cartao: CartaoDaFicha, ctx: ContextoDaLeitura): LeituraDaTecnica {
  const { personagem, sistema } = ctx
  const acaoDaFicha = lerAcao(cartao.campos[CAMPO_DA_ACAO] ?? '')
  return {
    cartao,
    acaoDaFicha,
    custo: custoComATela(lerCusto(cartao.campos[CAMPO_DO_CUSTO] ?? '', personagem), ctx.custoDaTela),
    tempo: lerTempo(cartao.campos[CAMPO_DO_TEMPO] ?? ''),
    overload: overloadNaBatalha(cartao, ctx.todas ?? tecnicasDe(personagem, sistema), ctx.evoluidas),
    transformacao: acaoDaFicha.transformacao,
    tipo: lerTipo(cartao),
  }
}

/**
 * O dano do cartão sem a vida do alvo (o menu e a Saúde não sabem o alvo; a
 * mira relê com ele), com a arma e o bônus dos selos de quem usa.
 */
export function danoDaTecnica(cartao: Pick<CartaoDaFicha, 'campos'>, ctx: Omit<ContextoDaFormula, 'vidaDoAlvo'>): LeituraDoDano {
  return lerDano(cartao.campos[CAMPO_DO_DANO] ?? '', { ...ctx, vidaDoAlvo: null })
}
