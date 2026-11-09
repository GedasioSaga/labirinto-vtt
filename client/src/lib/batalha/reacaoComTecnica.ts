import type { Ajuste } from '../ajusteDaFicha'
import { motivoDoOcultoParaJogador, nomeNaBatalha, ocultoNaBatalha } from '../habilidadeOculta'
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
  type VantagemNaRolagem,
} from './combate'
import { ajustesDoCusto, depoisDaTecnica, resolverAlvo, rolarReacao } from './golpe'
import { tecnicaPorId, tecnicasComForma, type LeituraDoCusto, type LeituraDoTempo } from './leituraDaFicha'
import { leituraDaTecnica } from './leituraDaTecnica'
import { modificadorDoTeste } from './marca'
import { reacaoAMaoDe, reageContraOverload, reageContraSurpresa, rebatePertoDe, soOMestreReage } from './mecanicasAMao'
import type { AutorDaAcao } from './turnos'
import { nomeDoSeloNaBatalha, seloPedidoValido } from './selos'
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
  /** F2 (fatia D, Armadura Humana): o nome e quanto do dano fica em cada saída da tabela ("Defender", 0,9); ausente = os de sempre. */
  daTabela?: Partial<Record<SaidaDaTecnica, { rotulo: string; fator: number }>>
  /** F2 (fatia D, Giro da Lança): o modificador que o app soma sozinho ao rolar e o total que anula; ausente = o da caixa. */
  rolagemDaTabela?: { modificador: number; anulaCom: number }
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

/**
 * A técnica com o custo da tela. `evoluidas` (tipos de habilidade F4) = as do
 * combate de quem reage: a base evoluída sem "Evolui para" cujo texto diz
 * OVERLOAD conta como Overload aqui também (`overloadNaBatalha`).
 */
function confirmar(cartao: CartaoDaFicha, forma: string | undefined, personagem: Personagem, sistema: SistemaDeRpg, custo: number | null, evoluidas: readonly string[] | undefined): TecnicaConfirmada {
  // F2 (fatia A): a leitura única. A tela confirma o custo: o número dela vale sobre o da ficha, como no golpe.
  const lida = leituraDaTecnica(cartao, { personagem, sistema, evoluidas, custoDaTela: custo })
  const tecnica: TecnicaConfirmada = {
    cartao,
    tipo: lida.tipo,
    custo: lida.custo,
    tempo: lida.tempo,
    acao: lida.acaoDaFicha.acao,
    overload: lida.overload,
    transformacao: lida.transformacao,
  }
  if (forma !== undefined) tecnica.forma = forma
  return tecnica
}

/** F2 (fatia D, Giro da Lança): o maior modificador entre os atributos (o do teste da marca: metade do rank, para baixo). */
function maiorModificador(personagem: Personagem, sistema: SistemaDeRpg, atributos: readonly string[]): number {
  return atributos.reduce((maior, atributoId) => Math.max(maior, modificadorDoTeste(personagem, sistema, atributoId)), Number.NEGATIVE_INFINITY)
}

/** F2 (fatia D): as saídas que a técnica dá e a marcada: as da tabela (Armadura: Defender ou Atacar; Giro: só rolar) ou as de sempre. */
export function saidasDaTecnica(cartaoId: string, modo: ModoDaReacao): { saidas: readonly SaidaDaTecnica[]; sugerida: SaidaDaTecnica | null } {
  const daTabela = reacaoAMaoDe(cartaoId)
  if (daTabela?.rolagem !== undefined) return { saidas: SAIDAS_DA_ROLAGEM, sugerida: 'rolar' }
  if (daTabela?.saidas !== undefined && daTabela.saidas.length > 0) return { saidas: daTabela.saidas.map((saida) => saida.saida), sugerida: daTabela.saidas[0]?.saida ?? null }
  return { saidas: SAIDAS_DA_TECNICA, sugerida: saidaSugerida(modo) }
}

const SAIDAS_DA_ROLAGEM: readonly SaidaDaTecnica[] = ['rolar']

function comoBotao(tecnica: TecnicaConfirmada, personagem: Personagem, sistema: SistemaDeRpg, combate: CombateDoPersonagem | undefined): ReacaoComTecnica {
  const modo = modoDaReacao(tecnica.cartao)
  const { saidas, sugerida } = saidasDaTecnica(tecnica.cartao.id, modo)
  const reacao: ReacaoComTecnica = {
    cartao: tecnica.cartao,
    nome: tecnica.cartao.nome.trim() || TECNICA_SEM_NOME,
    tipo: tecnica.tipo,
    custo: tecnica.custo,
    tempo: tecnica.tempo,
    overload: tecnica.overload,
    modo,
    sugerida,
    saidas,
    seloNoAtacante: seloDaReacao(tecnica.cartao),
    // Na caixa REAÇÃO a ação da vez não conta (`acoes` null) e o tipo Reação vale (`comoReacao`).
    motivo: motivoDaTecnica(tecnica, personagem, sistema, combate, null, true),
  }
  if (tecnica.forma !== undefined) reacao.forma = tecnica.forma
  const daTabela = reacaoAMaoDe(tecnica.cartao.id)
  if (daTabela?.saidas !== undefined) reacao.daTabela = Object.fromEntries(daTabela.saidas.map((saida) => [saida.saida, { rotulo: saida.rotulo, fator: saida.fator }]))
  if (daTabela?.rolagem !== undefined) reacao.rolagemDaTabela = { modificador: maiorModificador(personagem, sistema, daTabela.rolagem.atributos), anulaCom: daTabela.rolagem.anulaCom }
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
    .map(({ cartao, forma }) => comoBotao(confirmar(cartao, forma, personagem, sistema, null, combate?.evoluidas), personagem, sistema, combate))
}

/** O que a reação com técnica olha do alvo: o do golpe (mestre) ou o do recorte (`ReacaoParaJogador`, que só traz alvo que reage). */
export type AlvoQueReage = Pick<AlvoDoGolpe, 'podeReagir' | 'rolagem' | 'danoFinal'>

/**
 * Conserto das fichas F1 ("Overload não erra; o alvo só se defende com outra
 * Overload"): o personagem tem técnica Overload de reação disponível agora
 * (sem motivo: Overload ainda não usado, sem recarga, recurso que paga).
 */
export function temOverloadDeReacao(personagem: Personagem, sistema: SistemaDeRpg, combate: CombateDoPersonagem | undefined): boolean {
  return reacoesDisponiveis(personagem, sistema, combate).some((reacao) => valeContraOverload(reacao) && reacao.motivo === null)
}

/** F2 (fatia E): a técnica defende golpe Overload: é Overload, ou a tabela deixa (Recuperação de forças da Ryoko). */
function valeContraOverload(tecnica: { overload: boolean; cartao: Pick<CartaoDaFicha, 'id'> }): boolean {
  return tecnica.overload || reageContraOverload(tecnica.cartao.id)
}

/** O motivo da técnica que não é Overload contra golpe Overload. */
export const MOTIVO_SO_OVERLOAD = 'Contra Overload, só outra Overload defende'

/** F2 (revisão da fatia E): o motivo da técnica que não vale contra golpe Surpresa. */
export const MOTIVO_SO_CONTRA_SURPRESA = 'Contra Surpresa não há reação: só a técnica que vale contra ela defende'

/**
 * F2 (revisão da fatia E, Recuperação de forças: "vale também contra
 * Surpresa"): o personagem tem técnica de reação que vale contra golpe
 * Surpresa disponível agora. Com ela, o golpe Surpresa espera a reação dele.
 */
export function temReacaoContraSurpresa(personagem: Personagem, sistema: SistemaDeRpg, combate: CombateDoPersonagem | undefined): boolean {
  return reacoesDisponiveis(personagem, sistema, combate).some((reacao) => reageContraSurpresa(reacao.cartao.id) && reacao.motivo === null)
}

/**
 * As técnicas de reação para ESTE alvo de golpe. Golpe sem reação (Surpresa,
 * sem dano) ou alvo resolvido: nenhuma. Depois do d20: todas apagadas
 * (`MOTIVO_JA_ROLOU`), a técnica vem no lugar do dado. `contraOverload`
 * (conserto das fichas F1): o golpe é Overload, só as técnicas Overload.
 * `contraSurpresa` (F2, revisão da fatia E): o golpe é Surpresa, só as que
 * valem contra ela (Recuperação de forças).
 */
export function reacoesParaOAlvo(alvo: AlvoQueReage, personagem: Personagem, sistema: SistemaDeRpg, combate: CombateDoPersonagem | undefined, contraOverload = false, contraSurpresa = false): ReacaoComTecnica[] {
  if (!alvo.podeReagir || alvo.danoFinal !== undefined) return []
  const todas = reacoesDisponiveis(personagem, sistema, combate).filter((reacao) => (!contraOverload || valeContraOverload(reacao)) && (!contraSurpresa || reageContraSurpresa(reacao.cartao.id)))
  return alvo.rolagem === undefined ? todas : todas.map((reacao) => (reacao.motivo === null ? { ...reacao, motivo: MOTIVO_JA_ROLOU } : reacao))
}

/**
 * F2 (revisão da fatia E, Recuperação de forças): as técnicas como o JOGADOR
 * as vê: a que só o mestre usa vem apagada com o motivo (ele pede ao mestre).
 */
export function reacoesDoJogador(reacoes: readonly ReacaoComTecnica[]): ReacaoComTecnica[] {
  return reacoes.map((reacao) => {
    const soOMestre = reacao.motivo === null ? soOMestreReage(reacao.cartao.id) : null
    return soOMestre === null ? reacao : { ...reacao, motivo: soOMestre }
  })
}

/** F2 (fatia B): a única saída de quem reage no lugar de outro alvo: rebater (o golpe não pega nele). */
const SAIDAS_DO_REBATE: readonly SaidaDaTecnica[] = ['contra']

/**
 * F2 (fatia B, o "perto" do Aplauso): as técnicas que a ficha usa no lugar
 * de um alvo perto dela, no golpe Overload: só as Overload que rebatem de
 * perto (mecânica à mão), e só rebatendo. Ex.: a May com o Aplauso, pelo
 * aliado no 6x6 à frente dela.
 */
export function reacoesPorPerto(alvo: AlvoQueReage, personagem: Personagem, sistema: SistemaDeRpg, combate: CombateDoPersonagem | undefined): ReacaoComTecnica[] {
  return reacoesParaOAlvo(alvo, personagem, sistema, combate, true)
    .filter((reacao) => rebatePertoDe(reacao.cartao.id) !== null)
    .map((reacao) => ({ ...reacao, saidas: SAIDAS_DO_REBATE, sugerida: 'contra' }))
}

export type PedidoDeTecnica = Extract<PedidoDeReacao, { tipo: 'tecnica' }>

/** O que a regra da reação com técnica precisa do personagem do alvo. */
export interface ContextoDaReacao {
  /** O personagem do alvo; `null` = ficha sem personagem (não reage com técnica). */
  personagem: Personagem | null
  sistema: SistemaDeRpg | null
  combate: CombateDoPersonagem | undefined
  /** F2 (revisão da fatia E): quem pede; o jogador não usa a técnica que só o mestre usa (`soOMestreReage`). Ausente = o mestre. */
  quemPede?: AutorDaAcao['tipo']
}

/**
 * Por que o pedido não vale, ou `null` (pode). Mesma regra no mestre e no
 * host: alvo que ainda reage e não rolou; saída do conjunto
 * (`SAIDAS_DA_TECNICA`); modificador só ao rolar; custo no teto; técnica do
 * personagem, de reação, disponível (recarga, usos, Overload, SP) e com o
 * custo confirmado. `contraOverload` (o golpe é Overload): só técnica Overload.
 */
export function motivoDaReacaoComTecnica(ctx: ContextoDaReacao, alvo: AlvoQueReage, pedido: PedidoDeTecnica, contraOverload = false, contraSurpresa = false): string | null {
  if (!alvo.podeReagir) return 'Este golpe não deixa reagir'
  if (alvo.danoFinal !== undefined) return 'Este alvo já foi resolvido'
  if (alvo.rolagem !== undefined) return MOTIVO_JA_ROLOU
  if (!SAIDAS_DA_TECNICA.includes(pedido.saida)) return 'Saída que a técnica não dá'
  if (pedido.modificador !== undefined && (pedido.saida !== 'rolar' || !Number.isInteger(pedido.modificador) || Math.abs(pedido.modificador) > MODIFICADOR_DA_REACAO_MAX)) return 'Modificador só ao rolar, de -99 a 99'
  if (pedido.custo !== null && (!Number.isInteger(pedido.custo) || pedido.custo < 0 || pedido.custo > CUSTO_MAX)) return 'Custo inválido'
  if (pedido.seloNoAtacante !== undefined && seloPedidoValido(pedido.seloNoAtacante, ctx.sistema) === null) return 'Selo inválido'
  const { personagem, sistema } = ctx
  if (personagem === null || sistema === null) return 'Ficha sem personagem não reage com técnica'
  // Fatia C7 (revisão): a técnica oculta é só do mestre (o jogador nem a vê; o pedido dele é forjado).
  const oculto = ctx.quemPede === 'jogador' ? motivoDoOcultoParaJogador(personagem, pedido.cartaoId) : null
  if (oculto !== null) return oculto
  const achada = tecnicaPorId(personagem, sistema, pedido.cartaoId)
  if (achada === null) return 'Técnica não encontrada na ficha'
  const tecnica = confirmar(achada.cartao, achada.forma, personagem, sistema, pedido.custo, ctx.combate?.evoluidas)
  if (!tecnica.tipo.tambemReacao) return 'Esta técnica não é de reação'
  // F2 (fatia D): a técnica da tabela só dá as saídas dela (Armadura: Defender ou Atacar; Giro: rolar).
  if (!saidasDaTecnica(tecnica.cartao.id, modoDaReacao(tecnica.cartao)).saidas.includes(pedido.saida)) return 'Saída que a técnica não dá'
  if (contraOverload && !valeContraOverload(tecnica)) return MOTIVO_SO_OVERLOAD
  if (contraSurpresa && !reageContraSurpresa(tecnica.cartao.id)) return MOTIVO_SO_CONTRA_SURPRESA
  // F2 (revisão da fatia E, Recuperação de forças): "o MESTRE CONFIRMA": o jogador não aplica sozinho.
  const soOMestre = ctx.quemPede === 'jogador' ? soOMestreReage(tecnica.cartao.id) : null
  if (soOMestre !== null) return soOMestre
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
  /** F2 (fatia D, Armadura Humana "Atacar"): o dano que ficou no alvo (depois das reduções dele), dividido por este número, volta em quem atacou. */
  devolveDividido?: number
  /** F2 (fatia E, Recuperação de forças): a vida que volta para quem reagiu (a parte do dano que chegava, antes das reduções dele). */
  cura?: number
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
  vantagem?: VantagemNaRolagem,
  d20DaEsquiva?: number,
): ReacaoFeita | null {
  const achada = tecnicaPorId(personagem, sistema, pedido.cartaoId)
  if (achada === null) return null
  const tecnica = confirmar(achada.cartao, achada.forma, personagem, sistema, pedido.custo, combate.evoluidas)
  const { sugerida } = saidasDaTecnica(tecnica.cartao.id, modoDaReacao(tecnica.cartao))
  const daTabela = reacaoAMaoDe(tecnica.cartao.id)
  const saidaDaTabela = daTabela?.saidas?.find((candidata) => candidata.saida === pedido.saida)
  // Fatia C7 (revisão): a técnica oculta vai ao golpe (linha do registro, origem do selo, marca) como "???", sem o rótulo da saída.
  const oculta = ocultoNaBatalha(personagem, tecnica.cartao)
  const nome = nomeNaBatalha(personagem, tecnica.cartao, TECNICA_SEM_NOME)
  const marca: TecnicaDaReacao = { cartaoId: tecnica.cartao.id, nome: saidaDaTabela === undefined || oculta ? nome : `${nome} (${saidaDaTabela.rotulo})` }
  if (sugerida !== null && pedido.saida !== sugerida && saidaDaTabela === undefined) marca.aMao = true
  const { saida } = pedido
  let novo: GolpeDaBatalha
  if (saida === 'rolar') {
    if (d20 === null) return null
    const rolagem = daTabela?.rolagem
    // F2 (fatia D, Giro da Lança): o modificador sai da ficha e o total resolve na hora (anulaCom ou mais anula; o 1 natural é crítico).
    // F2 (revisão da fatia E): o dado da esquiva do Marcado vale na escolha depois do d20; o Giro bloqueia com a lança (não é esquiva) e fica com o dele.
    const esquiva = rolagem === undefined ? d20DaEsquiva : undefined
    novo = rolarReacao(golpe, tokenId, rolagem === undefined ? (pedido.modificador ?? 0) : maiorModificador(personagem, sistema, rolagem.atributos), d20, vantagem, esquiva)
    const total = novo.alvos.find((candidato) => candidato.tokenId === tokenId)?.rolagem?.total
    if (rolagem !== undefined && total !== undefined) novo = resolverAlvo(novo, tokenId, total >= rolagem.anulaCom ? 'esquiva' : d20 === DADO_DO_CRITICO ? 'critico' : 'cheio')
  } else {
    // F2 (fatia D, Armadura Humana): a saída da tabela resolve como `noAlvo` e fica com a parte `fator` do dano.
    novo = saidaDaTabela === undefined ? resolverAlvo(golpe, tokenId, saida) : comFatorNoAlvo(resolverAlvo(golpe, tokenId, saidaDaTabela.noAlvo), tokenId, saidaDaTabela.fator)
  }
  if (novo === golpe) return null
  novo = comTecnicaNoAlvo(novo, tokenId, marca)
  const alvo = novo.alvos.find((candidato) => candidato.tokenId === tokenId)
  if (alvo === undefined) return null
  const lido = pedido.seloNoAtacante === undefined ? null : seloPedidoValido(pedido.seloNoAtacante, sistema)
  const selo = lido === null || !oculta ? lido : { ...lido, nome: nomeDoSeloNaBatalha(personagem, tecnica.cartao, lido.nome) }
  const feita: ReacaoFeita = { golpe: novo, alvo, combate: depoisDaTecnica(combate, tecnica), custo: ajustesDoCusto(personagem, sistema, tecnica.custo), seloNoAtacante: selo }
  if (saidaDaTabela?.devolveDividido !== undefined) feita.devolveDividido = saidaDaTabela.devolveDividido
  // F2 (fatia E): "20% do dano que tomaria se torna vida", do dano que chegava (antes do −30% do Ogro), para baixo.
  const chegava = golpe.alvos.find((candidato) => candidato.tokenId === tokenId)?.dano ?? null
  const cura = saidaDaTabela?.curaDoQueChega === undefined || chegava === null ? 0 : Math.floor((chegava * saidaDaTabela.curaDoQueChega) / 100)
  if (cura > 0) feita.cura = cura
  return feita
}

/** O 1 natural do d20 (crítico, como em `reacao.ts`). */
const DADO_DO_CRITICO = 1

/** F2 (fatia D): o alvo já resolvido fica com a parte `fator` do dano que chegou, para baixo (Defender: 90%). */
function comFatorNoAlvo(golpe: GolpeDaBatalha, tokenId: string, fator: number): GolpeDaBatalha {
  return { ...golpe, alvos: golpe.alvos.map((alvo) => (alvo.tokenId === tokenId && alvo.dano !== null && alvo.danoFinal !== undefined ? { ...alvo, danoFinal: Math.max(0, Math.floor(alvo.dano * fator)) } : alvo)) }
}
