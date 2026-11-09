import type { Ajuste } from '../ajusteDaFicha'
import { numeroDaFicha, type CartaoDaFicha, type Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { recursoDeVida, vidaDoPersonagem } from '../vidaDaFicha'
import {
  acaoComOverload,
  acaoDoConcentrar,
  acaoDoGolpe,
  acoesDaVez,
  gastarAcao,
  MOTIVO_DO_OVERLOAD_USADO,
  motivoDaTecnica,
  motivoDoAtacar,
  motivoDoConcentrar,
  rankDeAgilidade,
  tecnicasNoMenu,
  usaOAtaqueExtra,
  type AcoesDaVez,
} from './acoes'
import {
  ALVOS_MAX,
  chaveDaVez,
  combateVazio,
  DANO_MAX,
  NOME_DO_GOLPE_MAX,
  PERFURACAO_MAX,
  type AcaoDaTecnica,
  type AlvoDoGolpe,
  type BalaDoGolpe,
  type CombateDoPersonagem,
  type ContraAtaque,
  type GolpeDaBatalha,
  type PedidoDeAcao,
  type PedidoDeAlvo,
  type RolagemDaReacao,
  type SaidaDaReacao,
  type SeloDoGolpe,
  type SeloPedido,
  type VantagemNaRolagem,
} from './combate'
import { comAMantida } from './custoPorTurno'
import { equipeDe, type Equipe } from './equipes'
import { usoEvoluido, varianteDoPedido } from './escolhaEEvolucao'
import { CAMPO_DO_DANO, danoDoAtaque, formulaUsaBala, lerDano, type ContextoDaFormula } from './formula'
import {
  armasDe,
  balaDaArma,
  categoriaAtira,
  lerTempo,
  recursoDoCusto,
  tecnicaPorId,
  tecnicasDe,
  ehOverload,
  RECARGA_A_MAIS,
  type ArmaDaFicha,
  type BalaDaArma,
  type LeituraDoCusto,
} from './leituraDaFicha'
import { danoDaTecnica, danoDaTecnicaComAVida, leituraDaTecnica } from './leituraDaTecnica'
import {
  ataqueComOSelo,
  chavesDoDono,
  contaQuemOViuLutar,
  extraDeTodoGolpe,
  golpesSaoOverload,
  somaCorpoACorpo,
  somaDasRespostas,
  gastaACarga,
  limpezaDe,
  mantidaDe,
  mecanicaDoCartao,
  motivoDaRespostaVetada,
  motivoDasRespostasDoGolpe,
  motivoDoSeloPedido,
  motivoDoTetoDeDano,
  perfuranteDaMecanica,
  rotulosDasRespostas,
  seloDaMecanica,
  semSeloPelaResposta,
  somaContraOSelo,
  type MecanicaAMao,
} from './mecanicasAMao'
import { dividirDano } from './area'
import { cartaoMontado, formulaDoDanoDasPecas, multiplicadoresDasPecas, pecasDoCartao, reacaoDasPecas, divisaoDasPecas, type MultiplicadoresDasPecas } from './mecanica/leitura'
import type { RespostasDoPedido } from './perguntaNaHora'
import { lerMarca } from './marca'
import type { BatalhaEmTurnos } from './ponte'
import { danoFinal, danoQueChega, perfuracaoValida, porcentagemQuePerfura } from './reacao'
import { BLOCOS_POR_RANK_PADRAO, type RegrasDaBatalha } from './regrasDoCampo'
import { bonusDaBatalha, seloPedidoValido } from './selos'
import { naturezaDoTipo, reacaoDoTipo, type ReacaoDoTipo, type TipoDaHabilidade } from './tiposDaHabilidade'
import { curaDoDanoDosSelos, travaDoToken } from './condicoes'
import { comAtaqueExtra, efeitosDasFormasLigadas, formaDaFicha, formaNaVez, motivoDaForma, motivoDaOrdemDasPartes, motivoDoCustoDaForma, motivoDosUsosDaForma, subidaDeParte } from './transformacao'
import { cartaDaVez, type AutorDaAcao, type CartaDaOrdem, type GastoDaVez, type TurnosDaCena } from './turnos'

/**
 * O GOLPE, F2 (seção 3.5 de docs/planos/batalha-one-piece-f2-plano.md e
 * respostas Q2, Q4, Q6 e Q8): os reducers que a store chama para agir e
 * reagir. A store aplica os ajustes pela aventura, escreve a linha e solta os
 * efeitos; aqui só a regra.
 *
 * O dano de cada alvo no pedido é a BASE (o número do campo, editável); aqui
 * entram a concentração e a Surpresa (`danoQueChega`).
 *
 * Puro: sem store, sem rede. Ids e d20 entram por parâmetro.
 */

/** O que a regra do golpe precisa saber de quem age e da mesa. */
export interface ContextoDoGolpe {
  turnos: TurnosDaCena
  /** A carta de quem age: a da vez, ou (contra-ataque, Q6) uma carta da ficha que ganhou a ação. */
  carta: CartaDaOrdem
  /** O personagem da carta; `null` = ficha sem personagem (só Atacar, sem custo). */
  personagem: Personagem | null
  sistema: SistemaDeRpg | null
  regras: RegrasDaBatalha | null
  autor: AutorDaAcao
  personagens: readonly Personagem[]
  /** tokenId → personagemId de cada ficha da cena (os alvos possíveis); `null` = ficha sem personagem; `undefined` = fora da cena. */
  personagemDoToken: (tokenId: string) => string | null | undefined
  /**
   * Invocação (decisão 8 de docs/planos/batalha-invocacao-plano.md): a ficha
   * nunca reage (o invocado): o golpe nela vai direto ao dano, sem caixa de
   * reação. Ausente = todo alvo reage como sempre.
   */
  semReacao?: (tokenId: string) => boolean
  /**
   * Conserto das fichas F1 ("Overload não erra; o alvo só se defende com
   * outra Overload"): a ficha tem técnica Overload de reação disponível. Com
   * ela, o golpe Overload espera a reação (a caixa só aceita Overload). Ausente
   * = ninguém reage a Overload (o golpe sai resolvido, como antes).
   */
  reageAOverload?: (tokenId: string) => boolean
  /**
   * F2 (revisão da fatia E, Recuperação de forças: "vale também contra
   * Surpresa"): a ficha tem técnica de reação que vale contra Surpresa
   * disponível. Com ela, o golpe Surpresa espera a reação (o d20 não defende;
   * só essa técnica). Ausente = ninguém reage a Surpresa (como antes).
   */
  reageASurpresa?: (tokenId: string) => boolean
  /**
   * F2 (fatia B, o "perto" do Aplauso): os tokens das fichas que podem rebater
   * o golpe Overload em `tokenId` (ele está na área delas). Com alguém, o alvo
   * espera a pergunta. Ausente = ninguém (a mesa sem mapa).
   */
  quemRebatePor?: (tokenId: string) => readonly string[]
  /**
   * F2 (fatia C, A Luz do Sol): os ids de personagem ALIADOS de quem age
   * (`aliadosDe`): a técnica de selo só nos aliados não dá dano neles.
   * Ausente = ninguém é aliado.
   */
  aliados?: ReadonlySet<string>
}

/** O que `lancarGolpe` devolve para a store aplicar. */
export interface GolpeLancado {
  /**
   * O golpe inteiro (para a linha e os efeitos), com os alvos resolvidos e os
   * que esperam; `null` = Concentrar ou Mover. A store o guarda nos
   * pendentes só se `golpePendente`.
   */
  golpe: GolpeDaBatalha | null
  /** Os alvos já resolvidos (sem reação: Surpresa, Overload, golpe sem dano), para a store aplicar o dano agora. */
  resolvidos: readonly AlvoDoGolpe[]
  /** O gasto novo da carta; `null` = não gastou ação da vez (contra-ataque). */
  gasto: GastoDaVez | null
  /** O combate novo do personagem; `null` = não mudou. */
  combate: CombateDoPersonagem | null
  /** O custo de quem age (SP ou HP), para `aplicarAjustes`. */
  custo: readonly Ajuste[]
  /** Q6: o contra-ataque que este pedido gastou; `null` = nenhum. */
  contraUsado: ContraAtaque | null
  /** A ação que o golpe gastou (para o texto); `null` = nenhuma (contra-ataque, Mover). */
  acao: AcaoDaTecnica | null
  /** A carga que o golpe usou (0 = nenhuma). */
  cargaUsada: number
  /**
   * F2b (revisão): a TÉCNICA em si é Overload, e o Cansaço do Overload vem
   * agora. O golpe que é Overload só porque a forma está ligada (A Caçada
   * Começa: `golpe.overload` sem a técnica ser) não cansa: a lei põe o
   * cansaço no FIM da forma (`desligarAForma`). Ausente = não cansa.
   */
  gastaOOverload?: true
  /**
   * F2 (fatia B): a 2ª parte do golpe (Rapid Dash), com a própria linha, o
   * próprio perfurante e a própria reação; só quando a store passa os ids dela.
   * Os alvos já resolvidos dela vão em `resolvidosDoSegundo`.
   */
  segundo?: GolpeDaBatalha
  resolvidosDoSegundo?: readonly AlvoDoGolpe[]
  /** F2 (fatia C): as partes depois da 2ª (o 3º golpe do Atacar da Aira com a Bênção), cada uma com os alvos já resolvidos. */
  seguintes?: readonly { golpe: GolpeDaBatalha; resolvidos: readonly AlvoDoGolpe[] }[]
}

/** F2 (fatia C): quantos ids de parte a store manda além do 2º golpe (o Atacar da Aira com a Bênção usa 1). */
export const PARTES_SEGUINTES_MAX = 2

/** F2 (fatias B e C): as partes depois do 1º golpe, na ordem (a 2ª e as seguintes). */
export function partesSeguintes(lancado: GolpeLancado): { golpe: GolpeDaBatalha; resolvidos: readonly AlvoDoGolpe[] }[] {
  const segunda = lancado.segundo === undefined ? [] : [{ golpe: lancado.segundo, resolvidos: lancado.resolvidosDoSegundo ?? [] }]
  return [...segunda, ...(lancado.seguintes ?? [])]
}

/** O que a sugestão do NPC precisa: a mesa inteira. */
export interface ContextoDaMesa {
  personagens: readonly Personagem[]
  sistema: SistemaDeRpg | null
  equipes: readonly Equipe[] | undefined
  /** Os tokens com vida 0 (não são alvo). */
  caidos: ReadonlySet<string>
}

export interface SugestaoDoNpc {
  cartaoId: string | null
  armaId: string | null
  alvoTokenId: string | null
}

/** O nome do golpe sem arma nem técnica. */
export const NOME_DO_ATAQUE = 'Ataque'
/** O efeito da bala no registro: a linha inteira tem `REGISTRO_TEXTO_MAX`, e o efeito vem por último. */
export const EFEITO_DA_BALA_NO_REGISTRO_MAX = 80

/** O contra-ataque (Q6) que o pedido usa, ou `null` (pedido da vez). `undefined` = pediu um que não existe. */
function contraDoPedido(ctx: ContextoDoGolpe, pedido: PedidoDeAcao): ContraAtaque | null | undefined {
  const contraDe = pedido.tipo === 'concentrar' ? undefined : pedido.contraDe
  if (contraDe === undefined) return null
  return (ctx.turnos.contras ?? []).find((contra) => contra.golpeId === contraDe && contra.tokenId === ctx.carta.tokenId)
}

/** As ações da carta na vez (com as extras e o "Mov" da regra do campo). */
export function acoesDaCarta(ctx: Pick<ContextoDoGolpe, 'turnos' | 'carta' | 'personagem' | 'sistema' | 'regras'>): AcoesDaVez {
  const rank = ctx.personagem === null || ctx.sistema === null ? null : rankDeAgilidade(ctx.personagem, ctx.sistema)
  // R6: o deslocamento das formas ligadas (Ignição +2, Resiliente no máximo 6 na vez) e o ataque adicional da Ignição.
  const combate = ctx.carta.personagemId === null ? undefined : ctx.turnos.combate?.[ctx.carta.personagemId]
  const forma = ctx.personagem === null || ctx.sistema === null ? undefined : formaNaVez(ctx.personagem, ctx.sistema, combate, ctx.turnos.rodada)
  return acoesDaVez(ctx.turnos.gastos[ctx.carta.id], ctx.turnos.extras[ctx.carta.id], rank, ctx.regras?.blocosPorRank ?? BLOCOS_POR_RANK_PADRAO, forma)
}

function combateDe(ctx: ContextoDoGolpe): CombateDoPersonagem {
  const id = ctx.carta.personagemId
  return (id === null ? undefined : ctx.turnos.combate?.[id]) ?? combateVazio()
}

/** A arma pedida, entre as da ficha e (se já escolheu) as levadas. `undefined` = arma que não vale. */
function armaDoPedido(ctx: ContextoDoGolpe, armaId: string | null): ArmaDaFicha | null | undefined {
  if (armaId === null) return null
  if (ctx.personagem === null) return undefined
  const levadas = combateDe(ctx).armas
  if (levadas !== null && !levadas.includes(armaId)) return undefined
  return armasDe(ctx.personagem).find((arma) => arma.id === armaId)
}

function motivoDosAlvos(ctx: ContextoDoGolpe, alvos: readonly PedidoDeAlvo[], minimo: number): string | null {
  if (alvos.length < minimo) return 'Escolha um alvo'
  if (alvos.length > ALVOS_MAX) return `No máximo ${ALVOS_MAX} alvos`
  if (new Set(alvos.map((alvo) => alvo.tokenId)).size !== alvos.length) return 'Alvo repetido'
  for (const alvo of alvos) {
    const personagemId = ctx.personagemDoToken(alvo.tokenId)
    if (personagemId === undefined || personagemId === null) return 'O alvo precisa ser ficha com personagem'
    if (alvo.dano !== null && (!Number.isInteger(alvo.dano) || alvo.dano < 0 || alvo.dano > DANO_MAX)) return 'Dano inválido'
  }
  // Conserto das fichas F1 (bug 2): sem teto de golpes esperando aqui. A store fecha o mais velho como "Não reagiu" (`GOLPES_PENDENTES_MAX`).
  return null
}

/** A leitura da técnica com o que a tela confirmou (custo e ação). */
interface TecnicaPedida {
  cartao: CartaoDaFicha
  custo: LeituraDoCusto
  acao: AcaoDaTecnica | 'passiva' | null
  tempo: ReturnType<typeof lerTempo>
  overload: boolean
  transformacao: boolean
  /** Tipos de habilidade F2: Buff não pede reação; Debuff pede mesmo sem dano. */
  tipo: TipoDaHabilidade
  /** Tipos de habilidade F4: o uso evoluído sem "Evolui para" (o registro diz "(evoluída)"). */
  evoluida: boolean
}

/**
 * A técnica do pedido. `evoluidas` (tipos de habilidade F4) = as do combate
 * de quem age: a base evoluída sem link cujo texto diz OVERLOAD vira Overload.
 */
function tecnicaPedida(personagem: Personagem, sistema: SistemaDeRpg, pedido: Extract<PedidoDeAcao, { tipo: 'habilidade' }>, evoluidas: readonly string[] | undefined): TecnicaPedida | null {
  const achada = tecnicaPorId(personagem, sistema, pedido.cartaoId)
  if (achada === null) return null
  const { cartao } = achada
  const todas = tecnicasDe(personagem, sistema)
  // F2 (fatia A): a leitura única. A tela confirma o custo: o número dela vale sobre o da ficha, no recurso que a ficha diz (SP por padrão).
  const lida = leituraDaTecnica(cartao, { personagem, sistema, evoluidas, todas, custoDaTela: pedido.custo })
  return {
    cartao,
    custo: lida.custo,
    // Conserto das fichas F1 (resposta da May): Overload que não é transformação gasta a Completa.
    acao: acaoComOverload(lida.acaoDaFicha.acao ?? pedido.acao, lida.overload, lida.transformacao),
    tempo: lida.tempo,
    overload: lida.overload,
    transformacao: lida.transformacao,
    tipo: lida.tipo.tipo,
    evoluida: usoEvoluido(cartao, todas, evoluidas),
  }
}

/** Por que o pedido não vale, ou `null` (pode). Mesma regra no mestre e no jogador. */
export function podeAgir(ctx: ContextoDoGolpe, pedido: PedidoDeAcao): string | null {
  const contra = contraDoPedido(ctx, pedido)
  if (contra === undefined) return 'Esse contra-ataque não existe mais'
  if (contra === null && ctx.turnos.vez !== ctx.carta.id) return 'Não é a vez desta carta'
  // Conserto das fichas F1 (S4): Atordoado ou Paralisado só passa a vez (nada de agir, nem pelo contra-ataque guardado).
  const trava = travaDoToken(ctx.turnos.selos, ctx.carta.tokenId)
  if (trava !== null) return trava
  // O contra-ataque é fora da vez (Q6): a ação da vez não conta.
  const acoes = contra === null ? acoesDaCarta(ctx) : null
  const combate = combateDe(ctx)
  switch (pedido.tipo) {
    case 'concentrar':
      if (ctx.carta.personagemId === null || acoes === null) return 'Só um personagem concentra na vez dele'
      return motivoDoConcentrar(combate, acoes, chaveDaVez(ctx.turnos.rodada, ctx.carta.id))
    case 'mover':
      return null
    // F3 (fatia T): Ativar gasta a ação escolhida; Desfazer é ação livre (só precisa estar ligada).
    case 'transformar': {
      const { personagem, sistema } = ctx
      if (personagem === null || sistema === null) return 'Ficha sem personagem não se transforma'
      const cartao = formaDaFicha(personagem, sistema, pedido.cartaoId)
      if (cartao === null) return 'Forma não encontrada na ficha'
      if (personagem.cartoesAtivos.includes(pedido.cartaoId)) return 'A forma já está ativa'
      // F2 (fatia E, Forma Híbrida da Ryoko): as Partes ligam em ordem, uma por vez.
      const ordem = motivoDaOrdemDasPartes(personagem, sistema, cartao)
      if (ordem !== null) return ordem
      // Conserto das fichas F1: Overload (técnica ou forma) é UMA vez por batalha.
      if (ehOverload(cartao) && combate.overload) return MOTIVO_DO_OVERLOAD_USADO
      // R6: "Usos por batalha" (Ignição: 2) e a Ação "Livre" (liga sem gastar ação).
      const esgotada = motivoDosUsosDaForma(cartao, ctx.turnos.combate?.[personagem.id]?.usos)
      if (esgotada !== null) return esgotada
      // Conserto das fichas F1: forma que custa mais que o máximo (A Caçada Começa: 200 SP com máximo 120) fica bloqueada.
      const cara = motivoDoCustoDaForma(cartao, personagem, sistema)
      if (cara !== null) return cara
      // S4: a ação é a que quem se transforma escolheu na hora; "livre" não gasta.
      return pedido.acao === 'livre' ? null : motivoDaForma({ ligada: false }, pedido.acao, acoes)
    }
    case 'destransformar': {
      const { personagem, sistema } = ctx
      if (personagem === null || sistema === null) return 'Ficha sem personagem não se transforma'
      return personagem.cartoesAtivos.includes(pedido.cartaoId) ? null : 'A forma não está ativa'
    }
    case 'atacar': {
      const arma = armaDoPedido(ctx, pedido.armaId)
      if (arma === undefined) return 'Arma fora das levadas para a batalha'
      if (pedido.balaId !== undefined && (arma === null || balaDaArma(arma, pedido.balaId) === null)) return 'Bala não encontrada na arma'
      const motivo = motivoDosAlvos(ctx, pedido.alvos, 1) ?? motivoDasRespostasDoPedido(ctx, null, pedido.respostas, null)
      if (motivo !== null) return motivo
      // R6: depois de um Atacar na vez, o ataque adicional da forma (Ignição) cabe sem a Simples.
      return acoes === null ? null : motivoDoAtacar(acoes)
    }
    case 'habilidade': {
      const { personagem, sistema } = ctx
      if (personagem === null || sistema === null) return 'Ficha sem personagem não usa habilidade'
      const tecnica = tecnicaPedida(personagem, sistema, pedido, combate.evoluidas)
      if (tecnica === null) return 'Técnica não encontrada na ficha'
      // Tipos de habilidade F4: a opção dos chips da mira tem de ser opção desta técnica.
      if (pedido.variante !== undefined && varianteDoPedido(tecnica.cartao, pedido.variante) === null) return 'Opção não encontrada na técnica'
      // F2 (fatia A): com respostas, as perguntas na hora da mecânica à mão (`mecanicasAMao.ts`) todas respondidas, e só elas.
      // Sem respostas a técnica segue como antes, até a mira de cada ficha perguntar (fatias seguintes da F2).
      // F2 (fatia C): mais as perguntas de todo golpe do dono (o Electro da Aira) e o SP que o "sim" cobra, somado ao da técnica.
      const respostas = motivoDasRespostasDoPedido(ctx, tecnica.cartao.id, pedido.respostas, tecnica.custo)
      if (respostas !== null) return respostas
      if (tecnica.acao === null) return 'Escolha a ação da técnica'
      if (tecnica.custo.tipo === 'pergunta') return 'Confirme o custo'
      const arma = armaDoPedido(ctx, pedido.armaId)
      if (arma === undefined) return 'Arma fora das levadas para a batalha'
      // F2 (revisão da fatia E, Desenhar o alvo com a Bala de Prata): a bala só na técnica cuja fórmula diz "Dano da Bala", e da arma dela.
      // Construtor C1: no cartão montado, a fórmula é a da peça (o campo Dano é só descrição).
      const formulaDoDano = formulaDoDanoDasPecas(tecnica.cartao) ?? tecnica.cartao.campos[CAMPO_DO_DANO] ?? ''
      if (pedido.balaId !== undefined && (arma === null || !formulaUsaBala(formulaDoDano) || balaDaArma(arma, pedido.balaId) === null)) return 'Bala não encontrada na arma'
      const motivo = motivoDaTecnica(tecnica, personagem, sistema, combate, acoes)
      // F2 (fatia D, Imbuir Fogo): a resposta que a forma ligada não deixa (fogo com a Ignição).
      const vetada = motivoDaRespostaVetada(tecnica.cartao.id, pedido.respostas, personagem.cartoesAtivos)
      // F2 (fatia C, A Luz do Sol): o teto de alvos que tomam dano ("em um inimigo"); os aliados marcados só levam o selo.
      const alvosPersonagemIds = pedido.alvos.map((alvo) => ctx.personagemDoToken(alvo.tokenId))
      // F2 (fatia E, Fúria do Dragão): sobe de Parte só com a forma dela ligada e uma Parte acima.
      const subida = subidaDeParte(personagem, sistema, tecnica.cartao.id)
      // F2 (fatia F, Florescer): só em quem tem a redoma da Orquídea.
      const selosDosAlvos = pedido.alvos.map((alvo) => (ctx.turnos.selos ?? []).filter((selo) => selo.tokenId === alvo.tokenId).map((selo) => selo.nome))
      return (
        motivo ??
        vetada ??
        (subida !== null && 'motivo' in subida ? subida.motivo : null) ??
        motivoDosAlvos(ctx, pedido.alvos, 0) ??
        motivoDaLimpeza(ctx, tecnica.cartao, alvosPersonagemIds) ??
        motivoDoTetoDeDano(tecnica.cartao, tecnica.cartao.nome.trim() || 'A técnica', alvosPersonagemIds, ctx.aliados ?? new Set<string>()) ??
        motivoDoDivide(tecnica.cartao, pedido.alvos.length) ??
        motivoDoSeloPedido(tecnica.cartao.id, selosDosAlvos)
      )
    }
  }
}

/**
 * O combate depois de usar a técnica: recarga, usos, Overload. O mesmo no
 * golpe e na reação com técnica. `custo` (o pago): SP acima de 0 marca
 * `gastouSp` (sem o +10 SP no começo da próxima vez).
 */
export function depoisDaTecnica(combate: CombateDoPersonagem, tecnica: Pick<TecnicaPedida, 'cartao' | 'tempo' | 'overload'> & { custo?: LeituraDoCusto }): CombateDoPersonagem {
  const { id } = tecnica.cartao
  let novo = combate
  if (tecnica.custo !== undefined && custoEmSp(tecnica.custo) && combate.gastouSp !== true) novo = { ...novo, gastouSp: true }
  // F2 (revisão da fatia D): a técnica mantida (Giro, Campo) liga e fica sem recarga; a recarga começa quando ela para (`pararAMantida`).
  if (mantidaDe(tecnica.cartao) !== null) novo = comAMantida(novo, id)
  // P1: Tempo N bloqueia N vezes do dono; a recarga desce no começo da vez, então guarda N + 1.
  else if (tecnica.tempo.tipo === 'recarga') novo = { ...novo, recargas: { ...novo.recargas, [id]: tecnica.tempo.turnos + RECARGA_A_MAIS } }
  if (tecnica.tempo.tipo === 'usos') novo = { ...novo, usos: { ...novo.usos, [id]: (novo.usos[id] ?? 0) + 1 } }
  if (tecnica.overload) novo = { ...novo, overload: true }
  return novo
}

// O motivo mora em `acoes.ts` (a tira Transformação também o usa); segue exportado daqui.
export { MOTIVO_DO_OVERLOAD_USADO }

/** Conserto das fichas F1 (+10 SP por vez): o custo pago gasta SP. */
export function custoEmSp(custo: LeituraDoCusto): boolean {
  return custo.tipo === 'valor' && custo.recurso === 'sp' && custo.valor > 0
}

/** Os ajustes do custo pago. O mesmo no golpe e na reação com técnica. */
export function ajustesDoCusto(personagem: Personagem, sistema: SistemaDeRpg, custo: LeituraDoCusto): Ajuste[] {
  if (custo.tipo !== 'valor' || custo.valor <= 0) return []
  const recurso = recursoDoCusto(sistema, custo.recurso)
  if (recurso === null) return []
  return [{ parte: 'recurso', chave: recurso.id, valor: Math.max(0, numeroDaFicha(personagem.recursos, recurso.id) - custo.valor) }]
}

/**
 * Os alvos do golpe: o dano que chega e se reagem. Sem reação (Surpresa,
 * Overload, sem dano, Buff) já saem resolvidos. Debuff reage mesmo sem dano
 * (`reacaoDoTipo`): o selo só pega se acertar. Overload: só reage quem tem
 * outra Overload de reação disponível (`reageAOverload`). Surpresa (F2,
 * revisão da fatia E): só quem tem técnica que vale contra ela (`reageASurpresa`).
 * F2b (Aparência Inofensiva): a Surpresa é por alvo (`surpresaEm`).
 */
function alvosDoGolpe(ctx: ContextoDoGolpe, alvos: readonly PedidoDeAlvo[], carga: number, surpresaEm: (tokenId: string) => boolean, overload: boolean, reacao: ReacaoDoTipo, pecas?: MultiplicadoresNoGolpe): AlvoDoGolpe[] {
  return alvos.map((pedido): AlvoDoGolpe => {
    const surpresa = surpresaEm(pedido.tokenId)
    // Construtor C1: a técnica montada pode não multiplicar a Surpresa e soma os extras e a divisão (a ordem é a de `danoQueChega`).
    const multiplica = surpresa && pecas?.surpresa !== false
    const dano = pedido.dano === null ? null : danoQueChega(pedido.dano, carga, multiplica, pecas === undefined ? undefined : { extras: pecas.extras, dividirPor: pecas.dividirPor })
    // F2 (fatia B): Overload em alvo perto de quem rebate (Aplauso) também espera, pela pergunta a ela.
    const porPerto = overload && ctx.quemRebatePor !== undefined ? ctx.quemRebatePor(pedido.tokenId) : []
    const overloadDeixa = !overload || ctx.reageAOverload?.(pedido.tokenId) === true || porPerto.length > 0
    // F2 (revisão da fatia E): a Surpresa espera só quem tem técnica que vale contra ela (Recuperação de forças da Ryoko).
    const surpresaDeixa = !surpresa || ctx.reageASurpresa?.(pedido.tokenId) === true
    // F2 (fatia A, resposta da Saga): golpe que chega com 0 de dano é golpe sem dano, sem reação (o Debuff, "sempre", ainda reage pelo selo).
    const podeReagir = surpresaDeixa && overloadDeixa && (reacao === 'sempre' || (reacao === 'comDano' && dano !== null && dano > 0)) && ctx.semReacao?.(pedido.tokenId) !== true
    const alvo: AlvoDoGolpe = { tokenId: pedido.tokenId, personagemId: ctx.personagemDoToken(pedido.tokenId) ?? null, dano, podeReagir }
    if (podeReagir) return porPerto.length === 0 ? alvo : { ...alvo, porPerto }
    const saida: SaidaDaReacao = 'semReacao'
    return { ...alvo, saida, danoFinal: dano === null ? 0 : danoFinal(dano, saida) }
  })
}

/**
 * O golpe lançado. Só depois de `podeAgir` devolver `null` (aqui não se
 * confere de novo). Concentrar: gasta a Simples (ou a Bônus), carga + 1; a
 * 3ª carga não gasta ação (C1). Atacar e Habilidade: gastam a ação da ficha
 * (a carga não a troca mais, C1), zeram a carga, cobram o custo, marcam
 * recarga, usos e Overload. O contra-ataque
 * (Q6) não gasta ação da vez e sai da lista.
 */
/** Construtor C1: os multiplicadores da técnica montada mais a divisão entre os marcados (`dividirPor`, ausente = cada um toma inteiro). */
interface MultiplicadoresNoGolpe extends MultiplicadoresDasPecas {
  dividirPor?: number
}

/** Construtor C1: os multiplicadores da técnica montada para estes alvos; `undefined` = técnica de texto (como sempre). */
function multiplicadoresNoGolpe(pecas: ReturnType<typeof pecasDoCartao>, alvos: number): MultiplicadoresNoGolpe | undefined {
  if (pecas === null) return undefined
  const teto = divisaoDasPecas(pecas)
  return teto === null ? multiplicadoresDasPecas(pecas) : { ...multiplicadoresDasPecas(pecas), dividirPor: Math.max(1, alvos) }
}

/**
 * Construtor C1 (decisão 2 do mestre): no cartão montado, o app do mestre
 * recalcula a base pelas peças e o número da tela não vale; só o mestre pode
 * mudá-lo (o pedido dele passa como veio). Sem peça de dano = sem dano. A
 * fórmula que pede a vida do alvo segue para `comDanoPelaVida`; a que pede
 * arma sem arma escolhida fica com o número da tela, como no cartão de texto.
 */
function comODanoDasPecas(ctx: ContextoDoGolpe, cartao: CartaoDaFicha, formula: Omit<ContextoDaFormula, 'vidaDoAlvo'>, alvos: readonly PedidoDeAlvo[]): readonly PedidoDeAlvo[] {
  if (ctx.autor.tipo === 'mestre') return alvos
  const lido = danoDaTecnica(cartao, formula)
  if (lido.tipo === 'semDano') return alvos.map((alvo) => ({ ...alvo, dano: null }))
  if (lido.tipo !== 'valor') return alvos
  const base = Math.min(DANO_MAX, lido.valor)
  return alvos.map((alvo) => ({ ...alvo, dano: base }))
}

/** Os ids de uma parte do golpe (o golpe e a linha dela no registro). */
interface IdsDaParte {
  golpe: string
  linha: string
}

export function lancarGolpe(ctx: ContextoDoGolpe, pedido: PedidoDeAcao, ids: IdsDaParte & { segundo?: IdsDaParte; seguintes?: readonly IdsDaParte[] }): GolpeLancado {
  const contra = contraDoPedido(ctx, pedido) ?? null
  const combate = combateDe(ctx)
  const gastoAtual = ctx.turnos.gastos[ctx.carta.id] ?? { simples: 0, movimento: 0, bonus: 0, blocos: 0 }
  const vazio: GolpeLancado = { golpe: null, resolvidos: [], gasto: null, combate: null, custo: [], contraUsado: contra, acao: null, cargaUsada: 0 }
  // F3: Ativar e Desfazer a forma não lançam golpe (a regra deles mora em `transformacao.ts`).
  if (pedido.tipo === 'mover' || pedido.tipo === 'transformar' || pedido.tipo === 'destransformar') return vazio
  if (pedido.tipo === 'concentrar') {
    const acao = acaoDoConcentrar(acoesDaCarta(ctx), combate.carga)
    // Até `CARGA_MAX` (3): o Concentrar com carga 3 já sai apagado em `podeAgir`.
    const cargaNova: CombateDoPersonagem['carga'] = combate.carga === 0 ? 1 : combate.carga === 1 ? 2 : 3
    // C2: guarda a ação gasta e a linha, para o Zerar na mesma vez devolvê-la. A 3ª carga é livre (C1): nada a devolver.
    const { concentrouCom: _velha, ...semAVelha } = combate
    const concentrado: CombateDoPersonagem = { ...semAVelha, carga: cargaNova, concentrouEm: chaveDaVez(ctx.turnos.rodada, ctx.carta.id) }
    if (acao !== 'livre') concentrado.concentrouCom = { acao, linhaId: ids.linha }
    return { ...vazio, gasto: acao === 'livre' ? null : gastarAcao(gastoAtual, acao), combate: concentrado, acao }
  }
  const { personagem, sistema } = ctx
  const tecnica = pedido.tipo === 'habilidade' && personagem !== null && sistema !== null ? tecnicaPedida(personagem, sistema, pedido, combate.evoluidas) : null
  const acaoBase = pedido.tipo === 'atacar' ? 'simples' : tecnica?.acao
  const acao = acaoBase === undefined || acaoBase === null || acaoBase === 'passiva' ? null : acaoDoGolpe(acaoBase, combate.carga)
  // F2b (A Caçada Começa): com a forma ligada, todo golpe do dono é Overload (não dá para desviar; só outra Overload defende).
  const overload = (tecnica?.overload ?? false) || (personagem !== null && golpesSaoOverload(personagem.cartoesAtivos))
  // F2 (fatia B): a mecânica à mão da técnica (`mecanicasAMao.ts`): o perfurante, o selo, as respostas, a 2ª parte, o HP que custa.
  // Construtor C1: o cartão montado dá a linha das peças no lugar da da tabela (tudo ou nada).
  const mecanica = tecnica === null ? null : mecanicaDoCartao(tecnica.cartao)
  const montada = tecnica !== null && cartaoMontado(tecnica.cartao)
  const pecas = tecnica === null ? null : pecasDoCartao(tecnica.cartao)
  // F2 (fatia C): a dança da Aira não pede reação (a defesa é o teste); a Luz do Sol não dá dano nos aliados marcados.
  // Construtor C1: na técnica montada, quem reage sai das peças (o teste e o selo), não do Tipo escrito.
  const reacao: ReacaoDoTipo = mecanica?.semReacao === true ? 'nunca' : pecas !== null ? reacaoDasPecas(pecas) : reacaoDoTipo(tecnica?.tipo ?? null)
  // F2 (fatia C): o Atacar melhorado (Aira com um aliado abençoado): a soma no dano de cada alvo, o selo no acerto e os golpes a mais. O contra-ataque fica de fora.
  const cartoes = cartoesDoDono(personagem)
  const melhorado = pedido.tipo === 'atacar' && contra === null ? ataqueComOSelo(cartoes, ctx.turnos.selos, ctx.carta.tokenId) : null
  // F2 (fatia C): o que vale em todo golpe do dono (o Electro da Aira: +20 de dano, -10 SP), pela resposta.
  const deTodoGolpe = extraDeTodoGolpe(cartoes, pedido.respostas)
  const somaDoAtaque = melhorado === null || personagem === null || sistema === null ? 0 : Math.max(0, Math.floor(valorNaFichaDe(personagem, sistema)(melhorado.soma) ?? 0))
  const arma = armaDoPedido(ctx, pedido.armaId) ?? null
  // F2 (fatia E, Força Aumentada do Ogro): +20 no Atacar corpo a corpo e nas técnicas corpo a corpo que não escrevem o +20.
  const daRaca = pedido.tipo === 'atacar' || tecnica !== null ? somaCorpoACorpo(cartoes, tecnica?.cartao.id ?? null, atacarCorpoACorpo(arma)) : 0
  const respostas = pedido.tipo === 'habilidade' ? pedido.respostas : undefined
  // F2b (Imbuir Fogo do Siegfried): o +10 da resposta soma por cima da fórmula (a da arma escolhida), em cada alvo.
  const doFogo = tecnica === null ? 0 : somaDasRespostas(tecnica.cartao, respostas)
  const soma = somaDoAtaque + deTodoGolpe.dano + daRaca + doFogo
  // Construtor C1 (decisão 2): na técnica montada, a base do jogador sai das peças, com a arma, a bala e o bônus dos selos de quem usa.
  const balaDaFormula = pedido.balaId !== undefined && arma !== null ? balaDaArma(arma, pedido.balaId) : null
  const daTela =
    tecnica === null || !montada || personagem === null || sistema === null
      ? pedido.alvos
      : comODanoDasPecas(ctx, tecnica.cartao, { personagem, sistema, arma, bala: balaDaFormula, bonusDaBatalha: bonusDaBatalha(ctx.turnos.selos, ctx.carta.tokenId) }, pedido.alvos)
  // F2 (fatia D, Explosão): o dano "% da vida do alvo" sai da vida de cada alvo.
  const pelaVida = tecnica === null || personagem === null || sistema === null ? daTela : comDanoPelaVida(ctx, tecnica.cartao, { personagem, sistema, arma }, respostas, daTela)
  // F2 (fatia F, Lua Incandescente): a base dividida entre os marcados, para baixo (71 em 3 = 23 em cada).
  // Construtor C1: na técnica montada a divisão vem depois dos multiplicadores, dentro de `danoQueChega` (`multiplicadoresNoGolpe`).
  const pedidosDoDano = mecanica?.divide === undefined || montada ? pelaVida : comDanoDividido(pelaVida, mecanica.divide.teto)
  const somados = mecanica?.seloSoNosAliados === true ? comSomaNoDano(semDanoNosAliados(ctx, pedidosDoDano), soma) : comSomaNoDano(pedidosDoDano, soma)
  // F2 (fatia F, Melodia): +20 em cada alvo que o dono analisou (o selo da passiva dele na opção principal).
  const pedidos = somados.map((alvo) => {
    const contra = alvo.dano === null ? 0 : somaContraOSelo(ctx.turnos.selos, alvo.tokenId, ctx.carta.personagemId)
    return contra === 0 || alvo.dano === null ? alvo : { ...alvo, dano: alvo.dano + contra }
  })
  // F2 (revisão da fatia D, Campo): a técnica que dá carga por vez não gasta a guardada (nem a usa).
  const gasta = gastaACarga(tecnica?.cartao ?? null)
  const carga = gasta ? combate.carga : 0
  // F2b (Aparência Inofensiva): com o "Sim", Surpresa também em cada alvo que ainda não viu o dono lutar (o contra-ataque nunca é Surpresa).
  const viram = new Set(combate.viramLutar ?? [])
  const inofensiva = deTodoGolpe.surpresaEmQuemNaoViu !== null && contra === null
  const surpresaEm = (tokenId: string): boolean => pedido.surpresa || (inofensiva && !viram.has(tokenId))
  const surpresosPelaAparencia = inofensiva && !pedido.surpresa && pedidos.some((alvo) => !viram.has(alvo.tokenId))
  const multiplicadores = multiplicadoresNoGolpe(pecas, pedidos.length)
  const alvos = alvosDoGolpe(ctx, pedidos, carga, surpresaEm, overload, reacao, multiplicadores)
  const golpe: GolpeDaBatalha = {
    id: ids.golpe,
    linhaId: ids.linha,
    cartaId: ctx.carta.id,
    rodada: ctx.turnos.rodada,
    atacanteTokenId: ctx.carta.tokenId,
    atacantePersonagemId: ctx.carta.personagemId,
    autor: ctx.autor,
    nome: tecnica?.cartao.nome.trim() || arma?.nome.trim() || NOME_DO_ATAQUE,
    surpresa: pedido.surpresa,
    overload,
    // F2 (fatia D, Projeção Letal): o perfurante pela resposta ("cortante ou perfurante?") vence o fixo da tabela e o da mira.
    perfurante: (tecnica === null ? null : perfuranteDaMecanica(tecnica.cartao, respostas)) ?? pedido.perfurante,
    alvos,
  }
  // A porcentagem só vai quando é parcial: 100 é o Perfurante de sempre (golpe sem o campo).
  // Construtor C1: a técnica montada não tem perfuração parcial (a do texto da ficha não vale nela).
  const perfuracao = montada ? null : perfuracaoValida(pedido.perfuracao)
  if (perfuracao !== null && perfuracao < PERFURACAO_MAX) golpe.perfuracao = perfuracao
  if (pedido.contraDe !== undefined) golpe.contraDe = pedido.contraDe
  // R1: a técnica que marca ao acertar (Desenhar o Alvo) e a arma que atira (o acerto lembra a passiva de marca).
  if (tecnica !== null && sistema !== null && lerMarca(tecnica.cartao, sistema)?.tipo === 'aoAcertar') golpe.marca = tecnica.cartao.id
  // F3 (Q6): o selo marcado na mira vai junto; pega em cada alvo que o golpe acerta (a store aplica).
  // Com a marca, o selo não vai: a mira de antes (ou de um jogador sem a versão nova) mandava o do Tipo Debuff, e o alvo ficava marcado duas vezes.
  const selo = pedido.selo === undefined || golpe.marca !== undefined ? null : seloPedidoValido(pedido.selo, sistema)
  if (selo !== null) golpe.selo = tecnica === null ? selo : seloDaTecnicaNoGolpe(selo, tecnica)
  // F2 (fatia B): o selo da tabela vence o da mira (leitura de texto); a técnica de selo só por resposta sai sem ele quando a resposta não pede.
  if (tecnica !== null && golpe.marca === undefined) {
    const daMecanica = seloDaMecanica(tecnica.cartao, respostas, personagem === null || sistema === null ? undefined : valorNaFichaDe(personagem, sistema))
    // Construtor C1: a natureza escrita na peça vence a do Tipo; sem selo na peça, o golpe sai sem selo (o da mira é leitura de texto).
    if (daMecanica !== null) golpe.selo = montada && daMecanica.natureza !== undefined ? { ...seloDaTecnicaNoGolpe(daMecanica, tecnica), natureza: daMecanica.natureza } : seloDaTecnicaNoGolpe(daMecanica, tecnica)
    else if (montada || semSeloPelaResposta(tecnica.cartao, respostas)) delete golpe.selo
  }
  // F2 (fatia C): quem bate com a Bênção de uma Raposa recupera parte do dano (o selo de agora); a carga vai junto para a CD da disputa.
  const cura = curaDoDanoDosSelos(ctx.turnos.selos, ctx.carta.tokenId)
  if (cura > 0) golpe.curaDoDano = cura
  if (carga > 0) golpe.carga = carga
  if (melhorado !== null) {
    golpe.selo = melhorado.selo
    golpe.variante = 'com a Bênção'
  }
  // F2 (revisão da fatia E): a bala vem também na técnica que diz "Dano da Bala" (Desenhar o alvo).
  const bala = pedido.balaId !== undefined && arma !== null ? balaDaArma(arma, pedido.balaId) : null
  if (bala !== null) golpe.bala = balaDoGolpe(bala)
  // F2 (fatia E, Bala de Prata): o selo da bala na tabela ("Ferido por prata") pega em quem o tiro acerta, à parte do selo
  // da mira, do da técnica e da marca (revisão da fatia E: no Desenhar o alvo a marca não o apaga mais).
  const seloDaBala = bala === null ? null : seloDaMecanica(bala.id)
  if (seloDaBala !== null) golpe.seloDaBala = seloDaBala
  // F2 (fatia E, vantagem de Ogro): a resposta "sim" faz os alvos reagirem com desvantagem.
  if (deTodoGolpe.desvantagemNoAlvo) golpe.reacaoComDesvantagem = true
  // F2 (fatia F, Golpe Baixo): o selo que quem usa ganha ao usar ("+8 em reação" por 2 turnos); a store o põe nele.
  if (mecanica?.seloEmQuemUsa !== undefined) golpe.seloEmQuemUsa = mecanica.seloEmQuemUsa
  // R1: a arma que atira (o acerto lembra a passiva de marca).
  if (arma !== null && categoriaAtira(arma.categoria)) golpe.armaQueAtira = true
  // Tipos de habilidade F4: a opção escolhida e o uso evoluído vão para o registro ("Medicina (Cirugia)").
  if (tecnica !== null && pedido.tipo === 'habilidade') {
    const variante = pedido.variante === undefined ? null : varianteDoPedido(tecnica.cartao, pedido.variante)
    // F2 (fatia B): as respostas de opção também vão ao registro ("Grande Chifre (3 quadrados, Bateu na parede? Sim)").
    const marcas = [variante?.rotulo ?? null, ...rotulosDasRespostas(tecnica.cartao.id, pedido.respostas)].filter((marca): marca is string => marca !== null)
    if (marcas.length > 0) golpe.variante = marcas.join(', ').slice(0, NOME_DO_GOLPE_MAX)
    if (tecnica.evoluida) golpe.evoluida = true
  }
  const rotulosDoDono = surpresosPelaAparencia && deTodoGolpe.surpresaEmQuemNaoViu !== null ? [...deTodoGolpe.rotulos, `Surpresa (${deTodoGolpe.surpresaEmQuemNaoViu})`] : deTodoGolpe.rotulos
  if (rotulosDoDono.length > 0) golpe.variante = [golpe.variante, ...rotulosDoDono].filter((marca): marca is string => marca !== undefined).join(', ').slice(0, NOME_DO_GOLPE_MAX)
  let combateNovo = tecnica === null ? combate : depoisDaTecnica(combate, tecnica)
  // F2b (Aparência Inofensiva, lei: "em quem nunca o viu lutar"): num golpe dele (com "Sim" ou "Não"), os alvos e todos
  // que estão na ordem agora o viram lutar; a Surpresa não vale mais neles. A carta do bando não é token: fica de fora.
  const presentes = ctx.turnos.cartas.filter((carta) => carta.bando === undefined && carta.tokenId !== ctx.carta.tokenId).map((carta) => carta.tokenId)
  const novosQueViram = contaQuemOViuLutar(cartoes) ? [...new Set([...pedido.alvos.map((alvo) => alvo.tokenId), ...presentes])].filter((tokenId) => !viram.has(tokenId)) : []
  if (novosQueViram.length > 0) combateNovo = { ...combateNovo, viramLutar: [...viram, ...novosQueViram] }
  if (gasta && combateNovo.carga !== 0) combateNovo = { ...combateNovo, carga: 0 }
  // Conserto das fichas F1 (+10 SP por vez): o SP do Electro também conta como gasto.
  if (deTodoGolpe.custoEmSp > 0 && combateNovo.gastouSp !== true) combateNovo = { ...combateNovo, gastouSp: true }
  // R6: o Atacar da vez marca o gasto (libera o ataque adicional da forma); o adicional não gasta a Simples e conta na rodada.
  const naVez = contra === null && pedido.tipo === 'atacar' ? acoesDaCarta(ctx) : null
  const extra = naVez !== null && usaOAtaqueExtra(naVez)
  // F2 (fatia D, Ignição): o adicional também conta nos da batalha (2 no total).
  if (extra) combateNovo = comAtaqueExtra(combateNovo, ctx.turnos.rodada, personagem === null || sistema === null ? undefined : efeitosDasFormasLigadas(personagem, sistema).adicionaisNaBatalha?.cartaoId)
  const gasto = contra !== null || acao === null || extra ? null : gastarAcao(gastoAtual, acao)
  // F2 (revisão da fatia F): todo golpe da vez marca que golpeou (a técnica livre devolve o gasto igual; a Doença das Trevas lê isto).
  const gastoDoGolpe: GastoDaVez | null = gasto === null ? null : pedido.tipo === 'atacar' ? { ...gasto, atacou: true, golpeou: true } : { ...gasto, golpeou: true }
  const custo = personagem === null || sistema === null ? [] : [...custosDoGolpe(tecnica?.custo ?? null, deTodoGolpe.custoEmSp).flatMap((parte) => ajustesDoCusto(personagem, sistema, parte)), ...ajustesDoHpQueCusta(personagem, sistema, mecanica)]
  const lancado: GolpeLancado = {
    golpe,
    resolvidos: alvos.filter((alvo) => alvo.danoFinal !== undefined),
    gasto: gastoDoGolpe,
    combate: ctx.carta.personagemId === null || combateNovo === combate ? null : combateNovo,
    custo,
    contraUsado: contra,
    acao: contra !== null ? null : acao,
    cargaUsada: carga,
    ...(tecnica?.overload === true ? { gastaOOverload: true } : {}),
  }
  // F2 (fatia C): o Atacar melhorado repete o golpe inteiro (mesmos alvos, mesmo dano e selo), cada parte com a própria reação.
  if (melhorado !== null) {
    const idsDasPartes = [ids.segundo, ...(ids.seguintes ?? [])].filter((daParte): daParte is IdsDaParte => daParte !== undefined).slice(0, melhorado.golpes - 1)
    const partes = idsDasPartes.map((daParte, indice) => {
      const alvosDaParte = alvosDoGolpe(ctx, pedidos, carga, surpresaEm, overload, reacao)
      const golpeDaParte: GolpeDaBatalha = { ...golpe, id: daParte.golpe, linhaId: daParte.linha, nome: `${golpe.nome} (${indice + 2}º golpe)`.slice(0, NOME_DO_GOLPE_MAX), alvos: alvosDaParte }
      return { golpe: golpeDaParte, resolvidos: alvosDaParte.filter((alvo) => alvo.danoFinal !== undefined) }
    })
    const [segunda, ...resto] = partes
    return segunda === undefined ? lancado : { ...lancado, segundo: segunda.golpe, resolvidosDoSegundo: segunda.resolvidos, seguintes: resto }
  }
  const parte = mecanica?.segundoGolpe
  if (parte === undefined || ids.segundo === undefined) return lancado
  // F2 (fatia B, Rapid Dash): a 2ª parte é outro golpe nos mesmos alvos, com a fração do dano base, o perfurante dela e outra reação.
  const alvosDaParte = pedido.alvos.map((alvo): PedidoDeAlvo => ({ ...alvo, dano: alvo.dano === null ? null : Math.floor(alvo.dano * parte.fracao) }))
  const segundos = alvosDoGolpe(ctx, alvosDaParte, carga, surpresaEm, overload, reacaoDoTipo(tecnica?.tipo ?? null))
  const { selo: _selo, marca: _marca, perfuracao: _perfuracao, bala: _bala, seloDaBala: _seloDaBala, ...semExtras } = golpe
  const segundo: GolpeDaBatalha = { ...semExtras, id: ids.segundo.golpe, linhaId: ids.segundo.linha, nome: `${golpe.nome} (2º golpe)`.slice(0, NOME_DO_GOLPE_MAX), perfurante: parte.perfurante, alvos: segundos }
  return { ...lancado, segundo, resolvidosDoSegundo: segundos.filter((alvo) => alvo.danoFinal !== undefined) }
}

/** F2 (fatia F, Lua Incandescente): por que os marcados passam do teto da técnica que divide o dano, ou `null`. */
function motivoDoDivide(cartao: Pick<CartaoDaFicha, 'id' | 'nome' | 'mecanica'>, alvos: number): string | null {
  const teto = mecanicaDoCartao(cartao)?.divide?.teto
  if (teto === undefined || alvos <= teto) return null
  return `${cartao.nome.trim() || 'A técnica'} acerta no máximo ${teto} alvos (o dano é dividido)`
}

/** F2 (fatia F, Lua Incandescente): a base de cada alvo dividida pelos marcados, para baixo; sem dano fica sem dano. */
function comDanoDividido(alvos: readonly PedidoDeAlvo[], teto: number): readonly PedidoDeAlvo[] {
  return alvos.map((alvo) => (alvo.dano === null ? alvo : { ...alvo, dano: dividirDano(alvo.dano, alvos.length, teto) ?? alvo.dano }))
}

/** F2 (fatia C): os ids dos cartões da ficha (todas as abas), e (fatia E) as chaves da raça e da ficha; sem ficha, nenhum. */
function cartoesDoDono(personagem: Personagem | null): string[] {
  return personagem === null ? [] : chavesDoDono(personagem)
}

/** F2 (fatia E, Força Aumentada do Ogro): o Atacar é corpo a corpo sem arma ou com arma que não atira nem é de arremesso. */
function atacarCorpoACorpo(arma: ArmaDaFicha | null): boolean {
  return arma === null || (!categoriaAtira(arma.categoria) && arma.categoria !== 'arremesso')
}

/**
 * F2 (fatia C): o que o golpe cobra: o custo da técnica e o SP de todo golpe
 * (Electro). Os dois em SP viram UM custo (o ajuste é "fica com X": dois
 * ajustes no mesmo recurso, o segundo apagaria o primeiro).
 */
function custosDoGolpe(daTecnica: LeituraDoCusto | null, extraEmSp: number): LeituraDoCusto[] {
  const extra: LeituraDoCusto = { tipo: 'valor', recurso: 'sp', valor: extraEmSp, porTurno: false }
  if (daTecnica === null) return extraEmSp > 0 ? [extra] : []
  if (extraEmSp <= 0) return [daTecnica]
  if (daTecnica.tipo === 'valor' && daTecnica.recurso === 'sp') return [{ ...daTecnica, valor: daTecnica.valor + extraEmSp }]
  return [daTecnica, extra]
}

/**
 * F2 (fatia D, Revigorar: "nele ou num aliado"): a técnica que limpa só vale
 * em quem usa ou nos aliados dele (`ctx.aliados`, ids de personagem). Ficha
 * sem personagem ou de outra equipe recusa com o motivo.
 */
function motivoDaLimpeza(ctx: ContextoDoGolpe, cartao: Pick<CartaoDaFicha, 'id' | 'nome' | 'mecanica'>, alvosPersonagemIds: readonly (string | null | undefined)[]): string | null {
  if (limpezaDe(cartao) === null) return null
  const deQuemUsa = ctx.carta.personagemId
  const vale = (id: string | null | undefined): boolean => typeof id === 'string' && (id === deQuemUsa || (ctx.aliados?.has(id) ?? false))
  return alvosPersonagemIds.every(vale) ? null : `${cartao.nome.trim() || 'A técnica'} só vale em você ou num aliado`
}

/**
 * F2 (fatia D, Explosão): a técnica de dano "% da vida do alvo" (`precisaAlvo`)
 * tem o dano calculado AQUI, com a vida atual de cada alvo: o jogador não vê
 * a vida de ninguém, só o dano no registro. Alvo sem ficha com vida: vale o
 * número que veio da mira. As outras técnicas: os alvos como vieram.
 */
function comDanoPelaVida(ctx: ContextoDoGolpe, cartao: CartaoDaFicha, formula: Omit<ContextoDaFormula, 'vidaDoAlvo'>, respostas: RespostasDoPedido | undefined, alvos: readonly PedidoDeAlvo[]): readonly PedidoDeAlvo[] {
  if (danoDaTecnica(cartao, formula, respostas).tipo !== 'precisaAlvo') return alvos
  const recurso = recursoDeVida(formula.sistema)
  return alvos.map((alvo) => {
    const personagemId = ctx.personagemDoToken(alvo.tokenId)
    const dele = typeof personagemId === 'string' ? ctx.personagens.find((candidato) => candidato.id === personagemId) : undefined
    const vida = dele === undefined || recurso === null ? null : vidaDoPersonagem(dele, recurso)
    const lido = vida === null ? null : danoDaTecnicaComAVida(cartao, formula, vida, respostas)
    return lido?.tipo === 'valor' ? { ...alvo, dano: lido.valor } : alvo
  })
}

/**
 * F2 (fatia C): por que as respostas do golpe não valem (as da técnica e as
 * de todo golpe do dono), ou o SP que o extra cobra não cabe; `null` = valem.
 * Sem respostas, nada a conferir (a técnica segue como antes). O SP do extra
 * é conferido SOMADO ao custo da técnica (`custoDaTecnica`; `null` = Atacar),
 * como a cobrança junta os dois (`custosDoGolpe`): Electro (10) na Luz do Sol
 * (25) com 30 de SP recusa, em vez de passar e cobrar só os 30.
 */
function motivoDasRespostasDoPedido(ctx: ContextoDoGolpe, cartaoId: string | null, respostas: RespostasDoPedido | undefined, custoDaTecnica: LeituraDoCusto | null): string | null {
  if (respostas === undefined) return null
  const cartoes = cartoesDoDono(ctx.personagem)
  const motivo = motivoDasRespostasDoGolpe(cartaoId, cartoes, respostas)
  if (motivo !== null || ctx.personagem === null || ctx.sistema === null) return motivo
  const { custoEmSp } = extraDeTodoGolpe(cartoes, respostas)
  const sp = custoEmSp > 0 ? recursoDoCusto(ctx.sistema, 'sp') : null
  if (sp === null) return null
  const custa = custosDoGolpe(custoDaTecnica, custoEmSp).reduce((soma, parte) => (parte.tipo === 'valor' && parte.recurso === 'sp' ? soma + parte.valor : soma), 0)
  const tem = numeroDaFicha(ctx.personagem.recursos, sp.id)
  return tem < custa ? `SP insuficiente: custa ${custa}, você tem ${tem}` : null
}

/** F2 (fatia C, o Atacar da Aira com a Bênção; o Electro): a soma no dano de cada alvo (o dano em branco segue em branco). */
function comSomaNoDano(alvos: readonly PedidoDeAlvo[], soma: number): readonly PedidoDeAlvo[] {
  return soma <= 0 ? alvos : alvos.map((alvo) => (alvo.dano === null ? alvo : { ...alvo, dano: Math.min(DANO_MAX, alvo.dano + soma) }))
}

/** F2 (fatia C, A Luz do Sol): os aliados marcados de quem age ficam sem dano (só recebem o selo). */
function semDanoNosAliados(ctx: ContextoDoGolpe, alvos: readonly PedidoDeAlvo[]): PedidoDeAlvo[] {
  const aliados = ctx.aliados ?? new Set<string>()
  return alvos.map((alvo) => {
    const personagemId = ctx.personagemDoToken(alvo.tokenId)
    return typeof personagemId === 'string' && aliados.has(personagemId) ? { ...alvo, dano: null } : alvo
  })
}

/** F2 (fatia C): uma fórmula ("Espírito * 0,2") lida na ficha de quem usa, sem arma, sem alvo e sem os selos; `null` = sem número. */
function valorNaFichaDe(personagem: Personagem, sistema: SistemaDeRpg): (formula: string) => number | null {
  return (formula) => {
    const lido = lerDano(formula, { personagem, sistema, arma: null, vidaDoAlvo: null })
    return lido.tipo === 'valor' ? lido.valor : null
  }
}

/** F2 (fatia B): o HP que a técnica custa sempre (Sai Dai Rin: 200), pelo mesmo ajuste do custo. Sem mecânica: nada. */
function ajustesDoHpQueCusta(personagem: Personagem, sistema: SistemaDeRpg, mecanica: MecanicaAMao | null): Ajuste[] {
  const valor = mecanica?.custoEmHp
  return valor === undefined ? [] : ajustesDoCusto(personagem, sistema, { tipo: 'valor', recurso: 'hp', valor, porTurno: false })
}

/** A bala como o golpe a guarda: o efeito cortado para caber no registro, e só quando há. */
function balaDoGolpe(bala: BalaDaArma): BalaDoGolpe {
  const efeito = bala.efeito.length <= EFEITO_DA_BALA_NO_REGISTRO_MAX ? bala.efeito : `${bala.efeito.slice(0, EFEITO_DA_BALA_NO_REGISTRO_MAX - 1).trimEnd()}…`
  return efeito.length === 0 ? { id: bala.id, nome: bala.nome } : { id: bala.id, nome: bala.nome, efeito }
}

/** Tipos de habilidade F2: o selo da técnica leva a natureza do Tipo (Buff, Debuff) e o cartaoId, tirados aqui e nunca do fio. */
function seloDaTecnicaNoGolpe(selo: SeloPedido, tecnica: TecnicaPedida): SeloDoGolpe {
  const natureza = naturezaDoTipo(tecnica.tipo)
  return natureza === undefined ? { ...selo, cartaoId: tecnica.cartao.id } : { ...selo, natureza, cartaoId: tecnica.cartao.id }
}

function comAlvo(golpe: GolpeDaBatalha, tokenId: string, mudar: (alvo: AlvoDoGolpe) => AlvoDoGolpe | null): GolpeDaBatalha {
  const indice = golpe.alvos.findIndex((alvo) => alvo.tokenId === tokenId)
  const alvo = golpe.alvos[indice]
  if (alvo === undefined) return golpe
  const novo = mudar(alvo)
  if (novo === null) return golpe
  const alvos = [...golpe.alvos]
  alvos[indice] = novo
  return { ...golpe, alvos }
}

/**
 * A rolagem (ou rerolagem) do alvo. Alvo resolvido ou que não reage: o MESMO
 * golpe. `d20DaEsquiva` (F2, revisão da fatia E: o alvo Marcado) = o dado que
 * vale para Esquivar e Contra-atacar.
 */
export function rolarReacao(golpe: GolpeDaBatalha, tokenId: string, modificador: number, d20: number, vantagem?: VantagemNaRolagem, d20DaEsquiva?: number): GolpeDaBatalha {
  return comAlvo(golpe, tokenId, (alvo) => {
    if (alvo.danoFinal !== undefined || !alvo.podeReagir) return null
    const rolagem: RolagemDaReacao = { d20, modificador, total: d20 + modificador, vezes: (alvo.rolagem?.vezes ?? 0) + 1 }
    if (vantagem !== undefined) rolagem.vantagem = vantagem
    if (d20DaEsquiva !== undefined) rolagem.d20DaEsquiva = d20DaEsquiva
    return { ...alvo, rolagem }
  })
}

/**
 * O alvo resolvido com a saída: o dano final (contra-ataque = 0, Q6). Quem
 * confere se a saída foi liberada pelo dado é a store (`saidasPossiveis`).
 * Já resolvido: o MESMO golpe.
 */
export function resolverAlvo(golpe: GolpeDaBatalha, tokenId: string, saida: SaidaDaReacao): GolpeDaBatalha {
  return comAlvo(golpe, tokenId, (alvo) => {
    if (alvo.danoFinal !== undefined) return null
    return { ...alvo, saida, danoFinal: alvo.dano === null ? 0 : danoFinal(alvo.dano, saida) }
  })
}

/**
 * R3 (lote de 01/11): o alvo passa sem tomar dano, rolado ou não. Saída
 * "esquiva" com `danoFinal` 0, para nada adiante (selo, marca, contra) ler um
 * acerto. Já resolvido: o MESMO golpe.
 */
export function passarSemDano(golpe: GolpeDaBatalha, tokenId: string): GolpeDaBatalha {
  return comAlvo(golpe, tokenId, (alvo) => (alvo.danoFinal !== undefined ? null : { ...alvo, saida: 'esquiva', danoFinal: 0, semDano: true }))
}

/** O golpe ainda tem alvo esperando? */
export function golpePendente(golpe: GolpeDaBatalha): boolean {
  return golpe.alvos.some((alvo) => alvo.danoFinal === undefined)
}

/** A proporção da vida (0 a 1); sem vida conhecida, 1 (no fim da fila). */
function proporcaoDaVida(personagem: Personagem, sistema: SistemaDeRpg | null): number {
  const recurso = recursoDeVida(sistema)
  const vida = recurso === null ? null : vidaDoPersonagem(personagem, recurso)
  return vida === null ? 1 : vida.atual / vida.maximo
}

/** O alvo da sugestão: combatente de OUTRA equipe (NPC sem equipe: os de tipo jogador), de pé, com a menor proporção de vida. */
function alvoSugerido(npc: Personagem, cena: BatalhaEmTurnos, ctx: ContextoDaMesa): string | null {
  const minhaEquipe = equipeDe(npc.id, ctx.equipes)
  const porId = new Map(ctx.personagens.map((personagem) => [personagem.id, personagem]))
  let melhor: { tokenId: string; proporcao: number } | null = null
  for (const carta of cena.turnos.cartas) {
    if (carta.personagemId === null || carta.personagemId === npc.id || ctx.caidos.has(carta.tokenId)) continue
    const outro = porId.get(carta.personagemId)
    if (outro === undefined) continue
    const inimigo = minhaEquipe === null ? outro.tipo === 'jogador' : equipeDe(outro.id, ctx.equipes)?.id !== minhaEquipe.id
    if (!inimigo) continue
    const proporcao = proporcaoDaVida(outro, ctx.sistema)
    if (melhor === null || proporcao < melhor.proporcao) melhor = { tokenId: carta.tokenId, proporcao }
  }
  return melhor?.tokenId ?? null
}

/**
 * A técnica, a arma e o alvo que o painel do NPC já marca (decisão 17): a
 * técnica DISPONÍVEL de maior dano calculável que ele paga (nenhuma
 * calculável: a primeira disponível; nenhuma: Atacar com a primeira arma).
 * Ex.: Vera (SP 80) com Névoa (custo 50, dano 300) e Prisão (custo 120,
 * dano 450) = Névoa; alvos Lia 240/450 e Bruno 900/1200 = Lia.
 */
export function sugestaoParaNpc(npc: Personagem, cena: BatalhaEmTurnos, ctx: ContextoDaMesa): SugestaoDoNpc {
  const alvoTokenId = alvoSugerido(npc, cena, ctx)
  const { sistema } = ctx
  const combate = cena.turnos.combate?.[npc.id]
  const levadas = combate?.armas ?? null
  const armas = armasDe(npc).filter((arma) => levadas === null || levadas.includes(arma.id))
  const arma = armas[0] ?? null
  const armaId = arma?.id ?? null
  if (sistema === null) return { cartaoId: null, armaId, alvoTokenId }
  const daVez = cartaDaVez(cena.turnos)
  const acoes = daVez !== null && daVez.personagemId === npc.id ? acoesDaCarta({ turnos: cena.turnos, carta: daVez, personagem: npc, sistema, regras: cena.regras }) : null
  // Tipos de habilidade F2: os selos do NPC da vez entram no dano de cada técnica (a mesma conta do painel).
  const bonus = daVez !== null && daVez.personagemId === npc.id ? bonusDaBatalha(cena.turnos.selos, daVez.tokenId) : undefined
  const disponiveis = tecnicasNoMenu(npc, sistema, combate, acoes, arma, bonus).filter((tecnica) => tecnica.motivo === null && tecnica.custo.tipo !== 'pergunta')
  let escolhida: { cartaoId: string; dano: number } | null = null
  for (const tecnica of disponiveis) {
    if (tecnica.dano.tipo !== 'valor') continue
    if (escolhida === null || tecnica.dano.valor > escolhida.dano) escolhida = { cartaoId: tecnica.cartao.id, dano: tecnica.dano.valor }
  }
  const cartaoId = escolhida?.cartaoId ?? disponiveis[0]?.cartao.id ?? null
  return { cartaoId, armaId, alvoTokenId }
}

/** Q2: o dano do Atacar com a arma (e a bala) escolhida, para a tela já preencher (editável). `null` = a ficha não diz. */
export function danoSugeridoDoAtaque(personagem: Personagem, sistema: SistemaDeRpg, arma: CartaoDaFicha | null, bala?: BalaDaArma | null): number | null {
  const lido = danoDoAtaque({ personagem, sistema, arma, vidaDoAlvo: null }, bala)
  return lido.tipo === 'valor' ? lido.valor : null
}

// ───────────────────────────────────────────────────────────────────────────
// Texto do registro (seção 3.6): nunca HP, SP nem custo
// ───────────────────────────────────────────────────────────────────────────

function comSinal(numero: number): string {
  return numero < 0 ? String(numero) : `+${numero}`
}

/** "d20 7+2 = 9"; S4, com 2 d20: "d20 15 (vantagem: 15 e 7)+2 = 17". */
export function textoDaRolagem(d20: number, modificador: number, total: number, vantagem?: VantagemNaRolagem): string {
  const dados = vantagem === undefined ? '' : ` (${vantagem.modo}: ${d20} e ${vantagem.outro})`
  return `d20 ${d20}${dados}${comSinal(modificador)} = ${total}`
}

/** O texto da rolagem guardada no alvo; F2 (revisão da fatia E), o Marcado: "d20 13+2 = 15 · esquiva com desvantagem: 4+2 = 6". */
function textoDaRolagemDoAlvo(rolagem: RolagemDaReacao): string {
  const texto = textoDaRolagem(rolagem.d20, rolagem.modificador, rolagem.total, rolagem.vantagem)
  const esquiva = rolagem.d20DaEsquiva
  return esquiva === undefined ? texto : `${texto} · esquiva com desvantagem: ${esquiva}${comSinal(rolagem.modificador)} = ${esquiva + rolagem.modificador}`
}

/** Golpe sem dano (Buff, Debuff de suporte): o que aconteceu, sem o "recebeu 0". */
const SAIDA_SEM_DANO: Readonly<Record<SaidaDaReacao, string>> = {
  critico: 'crítico',
  cheio: 'acertou',
  metade: 'defendeu, mas acertou',
  esquiva: 'esquivou',
  contra: 'contra-atacou',
  naoReagiu: 'não reagiu',
  passou: 'passou',
  semReacao: 'sem reação',
}

/** `dano` null = golpe sem dano. */
function textoDaSaida(saida: SaidaDaReacao, dano: number | null): string {
  if (dano === null) return SAIDA_SEM_DANO[saida]
  switch (saida) {
    case 'critico':
      return `crítico, recebeu ${dano}`
    case 'cheio':
      return `recebeu ${dano}`
    case 'metade':
      return `defendeu, recebeu ${dano}`
    case 'esquiva':
      return 'esquivou'
    case 'contra':
      return 'contra-atacou'
    case 'naoReagiu':
      return `não reagiu, recebeu ${dano}`
    case 'passou':
      return `passou (tomou ${dano})`
    case 'semReacao':
      return `${dano} sem reação`
  }
}

/** "com Passo de Valsa", "com Passo de Valsa (à mão)": a técnica da reação, quando houve. */
function comATecnica(alvo: AlvoDoGolpe): string {
  if (alvo.tecnica === undefined) return ''
  return ` com ${alvo.tecnica.nome}${alvo.tecnica.aMao === true ? ' (à mão)' : ''}`
}

/**
 * O que aconteceu com um alvo: esperando, rolou, resolveu. Com técnica de
 * reação: "esquivou com Passo de Valsa"; rolando com ela, "d20 12+3 = 15 com
 * Giro da Lança".
 */
function textoDoAlvo(alvo: AlvoDoGolpe): string {
  const pedacos: string[] = []
  if (alvo.rolagem !== undefined) pedacos.push(`${textoDaRolagemDoAlvo(alvo.rolagem)}${comATecnica(alvo)}`)
  if (alvo.semDano === true) pedacos.push('passou sem dano')
  else if (alvo.saida !== undefined && alvo.danoFinal !== undefined) pedacos.push(`${textoDaSaida(alvo.saida, alvo.dano === null ? null : alvo.danoFinal)}${alvo.marcado === true ? ' (marca ×2)' : ''}${alvo.reducao === undefined ? '' : ` (${alvo.reducaoDe ?? 'forma'} −${alvo.reducao}%)`}${alvo.rolagem === undefined ? comATecnica(alvo) : ''}`)
  else if (alvo.rolagem === undefined) pedacos.push('esperando reação')
  if (alvo.disputa !== undefined) pedacos.push(alvo.disputa)
  if (alvo.nota !== undefined) pedacos.push(alvo.nota)
  return pedacos.join(' · ')
}

/**
 * A linha da reação com técnica (tipos de habilidade F1): "Vincent reage com
 * Passo de Valsa: esquivou"; trocada na hora, "(à mão)"; rolando com ela,
 * "Vincent reage com Giro da Lança: d20 12+3 = 15". Nunca custo nem SP.
 */
export function textoDaReacaoComTecnica(alvo: AlvoDoGolpe, nomeDoToken: (tokenId: string) => string): string {
  const tecnica = alvo.tecnica
  const comeco = `${nomeDoToken(alvo.tokenId)} reage com ${tecnica?.nome ?? 'técnica'}${tecnica?.aMao === true ? ' (à mão)' : ''}`
  if (alvo.rolagem !== undefined) return `${comeco}: ${textoDaRolagemDoAlvo(alvo.rolagem)}`
  if (alvo.saida !== undefined && alvo.danoFinal !== undefined) return `${comeco}: ${textoDaSaida(alvo.saida, alvo.dano === null ? null : alvo.danoFinal)}`
  return comeco
}

/** Tipos de habilidade F4: "Medicina (Cirugia)", "CAÇA AS BRUXAS! (evoluída)"; sem escolha nem evolução, só o nome. */
function nomeComEscolha(golpe: GolpeDaBatalha): string {
  const marcas = [golpe.evoluida === true ? 'evoluída' : null, golpe.variante ?? null].filter((marca): marca is string => marca !== null)
  return marcas.length === 0 ? golpe.nome : `${golpe.nome} (${marcas.join(', ')})`
}

/** "perfurante" (tudo direto no HP), "perfurante 30%" (parcial) ou nada. */
function marcaDoPerfurante(golpe: GolpeDaBatalha): string | null {
  const porcentagem = porcentagemQuePerfura(golpe.perfurante, golpe.perfuracao)
  if (porcentagem === 0) return null
  return porcentagem < PERFURACAO_MAX ? `perfurante ${porcentagem}%` : 'perfurante'
}

/**
 * A linha do golpe, refeita a cada alvo resolvido:
 * "Lia usa Rajada de Penas em Ilo: 260 · d20 7+2 = 9 · recebeu 260";
 * "Lia usa Rajada em Ilo e Teo: Ilo d20 15+0 = 15 · esquivou · Teo esperando reação";
 * com bala: "Lia atira com Rosa Fúnebre (Bala de Prata) em Ilo: 195 · recebeu 195 · efeito: sangra".
 */
export function textoDoGolpe(golpe: GolpeDaBatalha, nomeDoToken: (tokenId: string) => string): string {
  const linha = textoDoGolpeSemBala(golpe, nomeDoToken)
  const efeito = golpe.bala?.efeito
  return efeito === undefined ? linha : `${linha} · efeito: ${efeito}`
}

function textoDoGolpeSemBala(golpe: GolpeDaBatalha, nomeDoToken: (tokenId: string) => string): string {
  const marcas = [golpe.surpresa ? 'Surpresa' : null, golpe.overload ? 'Overload' : null, marcaDoPerfurante(golpe), golpe.contraDe !== undefined ? 'contra-ataque' : null].filter((marca): marca is string => marca !== null)
  const nomes = golpe.alvos.map((alvo) => nomeDoToken(alvo.tokenId))
  const emQuem = nomes.length === 0 ? '' : ` em ${nomes.length === 1 ? (nomes[0] ?? '') : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1] ?? ''}`}`
  const acao = golpe.bala === undefined ? `usa ${nomeComEscolha(golpe)}` : `atira com ${golpe.nome} (${golpe.bala.nome})`
  const comeco = `${nomeDoToken(golpe.atacanteTokenId)} ${acao}${emQuem}${marcas.length > 0 ? ` (${marcas.join(', ')})` : ''}`
  const [unico] = golpe.alvos
  if (golpe.alvos.length === 1 && unico !== undefined) {
    const detalhe = textoDoAlvo(unico)
    // "sem reação" já diz o número; nos outros o dano que chega vem antes.
    return unico.dano === null || unico.saida === 'semReacao' ? `${comeco}: ${detalhe}` : `${comeco}: ${unico.dano} · ${detalhe}`
  }
  if (golpe.alvos.length === 0) return comeco
  return `${comeco}: ${golpe.alvos.map((alvo) => `${nomeDoToken(alvo.tokenId)} ${textoDoAlvo(alvo)}`).join(' · ')}`
}
