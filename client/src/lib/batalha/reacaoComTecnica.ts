import type { Ajuste } from '../ajusteDaFicha'
import type { CartaoDaFicha, Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { motivoDaTecnica } from './acoes'
import {
  CUSTO_MAX,
  MODIFICADOR_DA_REACAO_MAX,
  SAIDAS_DA_TECNICA,
  type AcaoDaTecnica,
  type AlvoDoGolpe,
  type CombateDoPersonagem,
  type GolpeDaBatalha,
  type PedidoDeReacao,
  type SaidaDaTecnica,
  type SeloPedido,
  type TecnicaDaReacao,
} from './combate'
import { ajustesDoCusto, depoisDaTecnica, resolverAlvo, rolarReacao } from './golpe'
import { CAMPO_DA_ACAO, CAMPO_DO_CUSTO, CAMPO_DO_TEMPO, ehOverload, lerAcao, lerCusto, lerTempo, tecnicaPorId, tecnicasComForma, type LeituraDoCusto, type LeituraDoTempo } from './leituraDaFicha'
import { seloPedidoValido } from './selos'
import { lerTipo, modoDaReacao, saidaSugerida, seloDaReacao, type LeituraDoTipo, type ModoDaReacao } from './tiposDaHabilidade'

/**
 * REAÇÃO COM TÉCNICA, tipos de habilidade F1 (seção 4f de
 * docs/planos/batalha-tipos-de-habilidade-plano.md; decisão 2): a técnica de
 * Tipo Reação (ou a dupla "Reação/Ação X") usada NO LUGAR do d20. A saída
 * vem lida do texto (`modoDaReacao`), marcada e trocável; "rolar" rola o d20
 * de sempre com a técnica. Cobra o custo, marca recarga, usos e Overload (o
 * mesmo `depoisDaTecnica` do golpe) e NÃO gasta ação da vez (decisão 8).
 *
 * As telas usam `reacoesParaOAlvo` (os botões "Usar Passo de Valsa" da caixa
 * REAÇÃO e das Reações pendentes do mestre); a store confere com
 * `motivoDaReacaoComTecnica` e aplica `reagirComTecnica`.
 *
 * Puro: sem store, sem rede. O d20 entra por parâmetro.
 */

/** Uma técnica de reação como a caixa a mostra; `motivo` presente = apagada, com a frase. */
export interface ReacaoComTecnica {
  cartao: CartaoDaFicha
  /** A transformação ligada de onde a técnica vem. */
  forma?: string
  /** O nome do botão ("Usar Passo de Valsa"); nunca vazio. */
  nome: string
  tipo: LeituraDoTipo
  custo: LeituraDoCusto
  tempo: LeituraDoTempo
  overload: boolean
  /** O que o texto diz que ela faz. */
  modo: ModoDaReacao
  /** A saída que já vem marcada; `null` = o texto não diz (modo "escolher": nenhuma marcada). */
  sugerida: SaidaDaTecnica | null
  /** As saídas que a pessoa pode trocar (a sugerida é uma delas). */
  saidas: readonly SaidaDaTecnica[]
  /** O selo sugerido em quem atacou ("Marcado"), marcado na caixa; `null` = nenhum. */
  seloNoAtacante: SeloPedido | null
  motivo: string | null
}

/** O nome do botão quando o cartão não tem nome. */
const TECNICA_SEM_NOME = 'Técnica sem nome'

/** O motivo da técnica de reação depois de o d20 já ter sido rolado. */
export const MOTIVO_JA_ROLOU = 'Já rolou o d20: escolha entre as saídas do dado'

/** A técnica com o custo confirmado na tela (`custo` null = o da ficha). */
interface TecnicaConfirmada {
  cartao: CartaoDaFicha
  forma?: string
  tipo: LeituraDoTipo
  custo: LeituraDoCusto
  tempo: LeituraDoTempo
  acao: AcaoDaTecnica | 'passiva' | null
  overload: boolean
  transformacao: boolean
}

function confirmar(cartao: CartaoDaFicha, forma: string | undefined, personagem: Personagem, custo: number | null): TecnicaConfirmada {
  const lidaAcao = lerAcao(cartao.campos[CAMPO_DA_ACAO] ?? '')
  const lidoCusto = lerCusto(cartao.campos[CAMPO_DO_CUSTO] ?? '', personagem)
  // A tela confirma o custo: o número dela vale sobre o da ficha, no recurso que a ficha diz (SP por padrão), como no golpe.
  const recurso = lidoCusto.tipo === 'nada' ? 'sp' : lidoCusto.recurso
  const tecnica: TecnicaConfirmada = {
    cartao,
    tipo: lerTipo(cartao),
    custo: custo === null ? lidoCusto : { tipo: 'valor', recurso, valor: custo, porTurno: false },
    tempo: lerTempo(cartao.campos[CAMPO_DO_TEMPO] ?? ''),
    acao: lidaAcao.acao,
    overload: ehOverload(cartao),
    transformacao: lidaAcao.transformacao,
  }
  if (forma !== undefined) tecnica.forma = forma
  return tecnica
}

function comoBotao(tecnica: TecnicaConfirmada, personagem: Personagem, sistema: SistemaDeRpg, combate: CombateDoPersonagem | undefined): ReacaoComTecnica {
  const modo = modoDaReacao(tecnica.cartao)
  const reacao: ReacaoComTecnica = {
    cartao: tecnica.cartao,
    nome: tecnica.cartao.nome.trim() || TECNICA_SEM_NOME,
    tipo: tecnica.tipo,
    custo: tecnica.custo,
    tempo: tecnica.tempo,
    overload: tecnica.overload,
    modo,
    sugerida: saidaSugerida(modo),
    saidas: SAIDAS_DA_TECNICA,
    seloNoAtacante: seloDaReacao(tecnica.cartao),
    // Na caixa REAÇÃO a ação da vez não conta (`acoes` null) e o tipo Reação vale (`comoReacao`).
    motivo: motivoDaTecnica(tecnica, personagem, sistema, combate, null, true),
  }
  if (tecnica.forma !== undefined) reacao.forma = tecnica.forma
  return reacao
}

/**
 * As técnicas que o personagem pode usar na caixa REAÇÃO: Tipo Reação ou
 * Ação dupla ("Reação/Ação Completa"), das Habilidades e das transformações
 * ligadas, com o motivo de cada apagada (recarga, usos, Overload usado, SP
 * insuficiente). Ex.: Vincent com Passo de Valsa (Ação "Reação", 35 SP,
 * "esquivar", "marca de tinta") = um botão, sugerida "esquiva", selo
 * "Marcado" no atacante.
 */
export function reacoesDisponiveis(personagem: Personagem, sistema: SistemaDeRpg, combate: CombateDoPersonagem | undefined): ReacaoComTecnica[] {
  return tecnicasComForma(personagem, sistema)
    .filter(({ cartao }) => lerTipo(cartao).tambemReacao)
    .map(({ cartao, forma }) => comoBotao(confirmar(cartao, forma, personagem, null), personagem, sistema, combate))
}

/** O que a reação com técnica olha do alvo: o do golpe (mestre) ou o do recorte (`ReacaoParaJogador`, que só traz alvo que reage). */
export type AlvoQueReage = Pick<AlvoDoGolpe, 'podeReagir' | 'rolagem' | 'danoFinal'>

/**
 * As técnicas de reação para ESTE alvo de golpe. Golpe sem reação (Surpresa,
 * Overload, sem dano) ou alvo resolvido: nenhuma. Depois do d20: todas
 * apagadas (`MOTIVO_JA_ROLOU`), a técnica vem no lugar do dado.
 */
export function reacoesParaOAlvo(alvo: AlvoQueReage, personagem: Personagem, sistema: SistemaDeRpg, combate: CombateDoPersonagem | undefined): ReacaoComTecnica[] {
  if (!alvo.podeReagir || alvo.danoFinal !== undefined) return []
  const todas = reacoesDisponiveis(personagem, sistema, combate)
  return alvo.rolagem === undefined ? todas : todas.map((reacao) => (reacao.motivo === null ? { ...reacao, motivo: MOTIVO_JA_ROLOU } : reacao))
}

export type PedidoDeTecnica = Extract<PedidoDeReacao, { tipo: 'tecnica' }>

/** O que a regra da reação com técnica precisa do personagem do alvo. */
export interface ContextoDaReacao {
  /** O personagem do alvo; `null` = ficha sem personagem (não reage com técnica). */
  personagem: Personagem | null
  sistema: SistemaDeRpg | null
  combate: CombateDoPersonagem | undefined
}

/**
 * Por que o pedido não vale, ou `null` (pode). Mesma regra no mestre e no
 * host: alvo que ainda reage e não rolou; saída do conjunto
 * (`SAIDAS_DA_TECNICA`); modificador só ao rolar; custo no teto; técnica do
 * personagem, de reação, disponível (recarga, usos, Overload, SP) e com o
 * custo confirmado.
 */
export function motivoDaReacaoComTecnica(ctx: ContextoDaReacao, alvo: AlvoQueReage, pedido: PedidoDeTecnica): string | null {
  if (!alvo.podeReagir) return 'Este golpe não deixa reagir'
  if (alvo.danoFinal !== undefined) return 'Este alvo já foi resolvido'
  if (alvo.rolagem !== undefined) return MOTIVO_JA_ROLOU
  if (!SAIDAS_DA_TECNICA.includes(pedido.saida)) return 'Saída que a técnica não dá'
  if (pedido.modificador !== undefined && (pedido.saida !== 'rolar' || !Number.isInteger(pedido.modificador) || Math.abs(pedido.modificador) > MODIFICADOR_DA_REACAO_MAX)) return 'Modificador só ao rolar, de -99 a 99'
  if (pedido.custo !== null && (!Number.isInteger(pedido.custo) || pedido.custo < 0 || pedido.custo > CUSTO_MAX)) return 'Custo inválido'
  if (pedido.seloNoAtacante !== undefined && seloPedidoValido(pedido.seloNoAtacante) === null) return 'Selo inválido'
  const { personagem, sistema } = ctx
  if (personagem === null || sistema === null) return 'Ficha sem personagem não reage com técnica'
  const achada = tecnicaPorId(personagem, sistema, pedido.cartaoId)
  if (achada === null) return 'Técnica não encontrada na ficha'
  const tecnica = confirmar(achada.cartao, achada.forma, personagem, pedido.custo)
  if (!tecnica.tipo.tambemReacao) return 'Esta técnica não é de reação'
  if (tecnica.custo.tipo === 'pergunta') return 'Confirme o custo'
  return motivoDaTecnica(tecnica, personagem, sistema, ctx.combate, null, true)
}

/** O que `reagirComTecnica` devolve para a store aplicar. */
export interface ReacaoFeita {
  /** O golpe com o alvo resolvido (ou rolado, em "rolar") e a técnica marcada nele. */
  golpe: GolpeDaBatalha
  /** O alvo depois. */
  alvo: AlvoDoGolpe
  /** O combate novo do personagem (recarga, usos, Overload); o MESMO quando a técnica não marca nada. */
  combate: CombateDoPersonagem
  /** O custo de quem reage (SP ou HP), para `aplicarAjustes`. */
  custo: readonly Ajuste[]
  /** O selo em quem atacou, já dentro das regras; `null` = nenhum. */
  seloNoAtacante: SeloPedido | null
}

function comTecnicaNoAlvo(golpe: GolpeDaBatalha, tokenId: string, tecnica: TecnicaDaReacao): GolpeDaBatalha {
  return { ...golpe, alvos: golpe.alvos.map((alvo) => (alvo.tokenId === tokenId ? { ...alvo, tecnica } : alvo)) }
}

/**
 * A reação com técnica aplicada. Só depois de `motivoDaReacaoComTecnica`
 * devolver `null` (aqui não se confere de novo). "rolar" precisa do `d20`
 * (do host); as outras saídas resolvem o alvo na hora, sem dado. A saída
 * diferente da lida marca `aMao` (o registro diz "(à mão)"). `null` = alvo
 * que não está mais esperando, técnica sumida ou "rolar" sem d20.
 */
export function reagirComTecnica(
  golpe: GolpeDaBatalha,
  tokenId: string,
  pedido: PedidoDeTecnica,
  personagem: Personagem,
  sistema: SistemaDeRpg,
  combate: CombateDoPersonagem,
  d20: number | null,
): ReacaoFeita | null {
  const achada = tecnicaPorId(personagem, sistema, pedido.cartaoId)
  if (achada === null) return null
  const tecnica = confirmar(achada.cartao, achada.forma, personagem, pedido.custo)
  const sugerida = saidaSugerida(modoDaReacao(tecnica.cartao))
  const marca: TecnicaDaReacao = { cartaoId: tecnica.cartao.id, nome: tecnica.cartao.nome.trim() || TECNICA_SEM_NOME }
  if (sugerida !== null && pedido.saida !== sugerida) marca.aMao = true
  const { saida } = pedido
  let novo: GolpeDaBatalha
  if (saida === 'rolar') {
    if (d20 === null) return null
    novo = rolarReacao(golpe, tokenId, pedido.modificador ?? 0, d20)
  } else {
    novo = resolverAlvo(golpe, tokenId, saida)
  }
  if (novo === golpe) return null
  novo = comTecnicaNoAlvo(novo, tokenId, marca)
  const alvo = novo.alvos.find((candidato) => candidato.tokenId === tokenId)
  if (alvo === undefined) return null
  const selo = pedido.seloNoAtacante === undefined ? null : seloPedidoValido(pedido.seloNoAtacante)
  return { golpe: novo, alvo, combate: depoisDaTecnica(combate, tecnica), custo: ajustesDoCusto(personagem, sistema, tecnica.custo), seloNoAtacante: selo }
}
