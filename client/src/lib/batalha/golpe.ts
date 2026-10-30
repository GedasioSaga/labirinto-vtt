import type { Ajuste } from '../ajusteDaFicha'
import { numeroDaFicha, type CartaoDaFicha, type Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { recursoDeVida, vidaDoPersonagem } from '../vidaDaFicha'
import { acaoDoConcentrar, acaoDoGolpe, acoesDaVez, gastarAcao, motivoDaAcao, motivoDaTecnica, motivoDoConcentrar, rankDeAgilidade, tecnicasNoMenu, type AcoesDaVez } from './acoes'
import {
  ALVOS_MAX,
  chaveDaVez,
  combateVazio,
  DANO_MAX,
  GOLPES_PENDENTES_MAX,
  type AcaoDaTecnica,
  type AlvoDoGolpe,
  type CombateDoPersonagem,
  type ContraAtaque,
  type GolpeDaBatalha,
  type PedidoDeAcao,
  type PedidoDeAlvo,
  type SaidaDaReacao,
} from './combate'
import { equipeDe, type Equipe } from './equipes'
import { danoDoAtaque } from './formula'
import { armasDe, ehOverload, lerAcao, lerCusto, lerTempo, recursoDoCusto, tecnicaPorId, CAMPO_DA_ACAO, CAMPO_DO_CUSTO, CAMPO_DO_TEMPO, type LeituraDoCusto } from './leituraDaFicha'
import type { BatalhaEmTurnos } from './ponte'
import { danoFinal, danoQueChega } from './reacao'
import { BLOCOS_POR_RANK_PADRAO, type RegrasDaBatalha } from './regrasDoCampo'
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

/** O contra-ataque (Q6) que o pedido usa, ou `null` (pedido da vez). `undefined` = pediu um que não existe. */
function contraDoPedido(ctx: ContextoDoGolpe, pedido: PedidoDeAcao): ContraAtaque | null | undefined {
  const contraDe = pedido.tipo === 'concentrar' ? undefined : pedido.contraDe
  if (contraDe === undefined) return null
  return (ctx.turnos.contras ?? []).find((contra) => contra.golpeId === contraDe && contra.tokenId === ctx.carta.tokenId)
}

/** As ações da carta na vez (com as extras e o "Mov" da regra do campo). */
export function acoesDaCarta(ctx: Pick<ContextoDoGolpe, 'turnos' | 'carta' | 'personagem' | 'sistema' | 'regras'>): AcoesDaVez {
  const rank = ctx.personagem === null || ctx.sistema === null ? null : rankDeAgilidade(ctx.personagem, ctx.sistema)
  return acoesDaVez(ctx.turnos.gastos[ctx.carta.id], ctx.turnos.extras[ctx.carta.id], rank, ctx.regras?.blocosPorRank ?? BLOCOS_POR_RANK_PADRAO)
}

function combateDe(ctx: ContextoDoGolpe): CombateDoPersonagem {
  const id = ctx.carta.personagemId
  return (id === null ? undefined : ctx.turnos.combate?.[id]) ?? combateVazio()
}

/** A arma pedida, entre as da ficha e (se já escolheu) as levadas. `undefined` = arma que não vale. */
function armaDoPedido(ctx: ContextoDoGolpe, armaId: string | null): CartaoDaFicha | null | undefined {
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
  const esperando = ctx.turnos.golpes?.length ?? 0
  return esperando >= GOLPES_PENDENTES_MAX ? 'Golpes demais esperando reação' : null
}

/** A leitura da técnica com o que a tela confirmou (custo e ação). */
interface TecnicaPedida {
  cartao: CartaoDaFicha
  custo: LeituraDoCusto
  acao: AcaoDaTecnica | 'passiva' | null
  tempo: ReturnType<typeof lerTempo>
  overload: boolean
  transformacao: boolean
}

function tecnicaPedida(personagem: Personagem, sistema: SistemaDeRpg, pedido: Extract<PedidoDeAcao, { tipo: 'habilidade' }>): TecnicaPedida | null {
  const achada = tecnicaPorId(personagem, sistema, pedido.cartaoId)
  if (achada === null) return null
  const { cartao } = achada
  const lidaAcao = lerAcao(cartao.campos[CAMPO_DA_ACAO] ?? '')
  const lidoCusto = lerCusto(cartao.campos[CAMPO_DO_CUSTO] ?? '', personagem)
  // A tela confirma o custo: o número dela vale sobre o da ficha, no recurso que a ficha diz (SP por padrão).
  const recurso = lidoCusto.tipo === 'nada' ? 'sp' : lidoCusto.recurso
  const custo: LeituraDoCusto = pedido.custo === null ? lidoCusto : { tipo: 'valor', recurso, valor: pedido.custo, porTurno: false }
  return {
    cartao,
    custo,
    acao: lidaAcao.acao ?? pedido.acao,
    tempo: lerTempo(cartao.campos[CAMPO_DO_TEMPO] ?? ''),
    overload: ehOverload(cartao),
    transformacao: lidaAcao.transformacao,
  }
}

/** Por que o pedido não vale, ou `null` (pode). Mesma regra no mestre e no jogador. */
export function podeAgir(ctx: ContextoDoGolpe, pedido: PedidoDeAcao): string | null {
  const contra = contraDoPedido(ctx, pedido)
  if (contra === undefined) return 'Esse contra-ataque não existe mais'
  if (contra === null && ctx.turnos.vez !== ctx.carta.id) return 'Não é a vez desta carta'
  // O contra-ataque é fora da vez (Q6): a ação da vez não conta.
  const acoes = contra === null ? acoesDaCarta(ctx) : null
  const combate = combateDe(ctx)
  switch (pedido.tipo) {
    case 'concentrar':
      if (ctx.carta.personagemId === null || acoes === null) return 'Só um personagem concentra na vez dele'
      return motivoDoConcentrar(combate, acoes, chaveDaVez(ctx.turnos.rodada, ctx.carta.id))
    case 'mover':
      return null
    case 'atacar': {
      if (armaDoPedido(ctx, pedido.armaId) === undefined) return 'Arma fora das levadas para a batalha'
      const motivo = motivoDosAlvos(ctx, pedido.alvos, 1)
      if (motivo !== null) return motivo
      const acao = acaoDoGolpe('simples', combate.carga)
      return acoes === null || acao === null ? null : motivoDaAcao(acoes, acao)
    }
    case 'habilidade': {
      const { personagem, sistema } = ctx
      if (personagem === null || sistema === null) return 'Ficha sem personagem não usa habilidade'
      const tecnica = tecnicaPedida(personagem, sistema, pedido)
      if (tecnica === null) return 'Técnica não encontrada na ficha'
      if (tecnica.acao === null) return 'Escolha a ação da técnica'
      if (tecnica.custo.tipo === 'pergunta') return 'Confirme o custo'
      if (armaDoPedido(ctx, pedido.armaId) === undefined) return 'Arma fora das levadas para a batalha'
      const motivo = motivoDaTecnica(tecnica, personagem, sistema, combate, acoes)
      return motivo ?? motivoDosAlvos(ctx, pedido.alvos, 0)
    }
  }
}

/** O combate depois de usar a técnica: recarga, usos, Overload. */
function depoisDaTecnica(combate: CombateDoPersonagem, tecnica: TecnicaPedida): CombateDoPersonagem {
  const { id } = tecnica.cartao
  let novo = combate
  if (tecnica.tempo.tipo === 'recarga') novo = { ...novo, recargas: { ...novo.recargas, [id]: tecnica.tempo.turnos } }
  if (tecnica.tempo.tipo === 'usos') novo = { ...novo, usos: { ...novo.usos, [id]: (novo.usos[id] ?? 0) + 1 } }
  if (tecnica.overload) novo = { ...novo, overload: true }
  return novo
}

/** Os ajustes do custo pago. */
function ajustesDoCusto(personagem: Personagem, sistema: SistemaDeRpg, custo: LeituraDoCusto): Ajuste[] {
  if (custo.tipo !== 'valor' || custo.valor <= 0) return []
  const recurso = recursoDoCusto(sistema, custo.recurso)
  if (recurso === null) return []
  return [{ parte: 'recurso', chave: recurso.id, valor: Math.max(0, numeroDaFicha(personagem.recursos, recurso.id) - custo.valor) }]
}

/** Os alvos do golpe: o dano que chega e se reagem. Sem reação (Surpresa, Overload, sem dano) já saem resolvidos. */
function alvosDoGolpe(ctx: ContextoDoGolpe, alvos: readonly PedidoDeAlvo[], carga: number, surpresa: boolean, overload: boolean): AlvoDoGolpe[] {
  return alvos.map((pedido): AlvoDoGolpe => {
    const dano = pedido.dano === null ? null : danoQueChega(pedido.dano, carga, surpresa)
    const podeReagir = dano !== null && !surpresa && !overload
    const alvo: AlvoDoGolpe = { tokenId: pedido.tokenId, personagemId: ctx.personagemDoToken(pedido.tokenId) ?? null, dano, podeReagir }
    if (podeReagir) return alvo
    const saida: SaidaDaReacao = 'semReacao'
    return { ...alvo, saida, danoFinal: dano === null ? 0 : danoFinal(dano, saida) }
  })
}

/**
 * O golpe lançado. Só depois de `podeAgir` devolver `null` (aqui não se
 * confere de novo). Concentrar: gasta a Simples (ou a Bônus), carga + 1.
 * Atacar e Habilidade: gastam a ação (com carga 3, a Completa), zeram a
 * carga, cobram o custo, marcam recarga, usos e Overload. O contra-ataque
 * (Q6) não gasta ação da vez e sai da lista.
 */
export function lancarGolpe(ctx: ContextoDoGolpe, pedido: PedidoDeAcao, ids: { golpe: string; linha: string }): GolpeLancado {
  const contra = contraDoPedido(ctx, pedido) ?? null
  const combate = combateDe(ctx)
  const gastoAtual = ctx.turnos.gastos[ctx.carta.id] ?? { simples: 0, movimento: 0, bonus: 0, blocos: 0 }
  const vazio: GolpeLancado = { golpe: null, resolvidos: [], gasto: null, combate: null, custo: [], contraUsado: contra, acao: null, cargaUsada: 0 }
  if (pedido.tipo === 'mover') return vazio
  if (pedido.tipo === 'concentrar') {
    const acao = acaoDoConcentrar(acoesDaCarta(ctx))
    // Até `CARGA_MAX` (3): o Concentrar com carga 3 já sai apagado em `podeAgir`.
    const cargaNova: CombateDoPersonagem['carga'] = combate.carga === 0 ? 1 : combate.carga === 1 ? 2 : 3
    return { ...vazio, gasto: gastarAcao(gastoAtual, acao), combate: { ...combate, carga: cargaNova, concentrouEm: chaveDaVez(ctx.turnos.rodada, ctx.carta.id) }, acao }
  }
  const { personagem, sistema } = ctx
  const tecnica = pedido.tipo === 'habilidade' && personagem !== null && sistema !== null ? tecnicaPedida(personagem, sistema, pedido) : null
  const acaoBase = pedido.tipo === 'atacar' ? 'simples' : tecnica?.acao
  const acao = acaoBase === undefined || acaoBase === null || acaoBase === 'passiva' ? null : acaoDoGolpe(acaoBase, combate.carga)
  const overload = tecnica?.overload ?? false
  const alvos = alvosDoGolpe(ctx, pedido.alvos, combate.carga, pedido.surpresa, overload)
  const arma = armaDoPedido(ctx, pedido.armaId) ?? null
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
    perfurante: pedido.perfurante,
    alvos,
  }
  if (pedido.contraDe !== undefined) golpe.contraDe = pedido.contraDe
  let combateNovo = tecnica === null ? combate : depoisDaTecnica(combate, tecnica)
  if (combateNovo.carga !== 0) combateNovo = { ...combateNovo, carga: 0 }
  return {
    golpe,
    resolvidos: alvos.filter((alvo) => alvo.danoFinal !== undefined),
    gasto: contra !== null || acao === null ? null : gastarAcao(gastoAtual, acao),
    combate: ctx.carta.personagemId === null || combateNovo === combate ? null : combateNovo,
    custo: tecnica === null || personagem === null || sistema === null ? [] : ajustesDoCusto(personagem, sistema, tecnica.custo),
    contraUsado: contra,
    acao: contra !== null ? null : acao,
    cargaUsada: combate.carga,
  }
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

/** A rolagem (ou rerolagem) do alvo. Alvo resolvido ou que não reage: o MESMO golpe. */
export function rolarReacao(golpe: GolpeDaBatalha, tokenId: string, modificador: number, d20: number): GolpeDaBatalha {
  return comAlvo(golpe, tokenId, (alvo) => {
    if (alvo.danoFinal !== undefined || !alvo.podeReagir) return null
    return { ...alvo, rolagem: { d20, modificador, total: d20 + modificador, vezes: (alvo.rolagem?.vezes ?? 0) + 1 } }
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
  const disponiveis = tecnicasNoMenu(npc, sistema, combate, acoes, arma).filter((tecnica) => tecnica.motivo === null && tecnica.custo.tipo !== 'pergunta')
  let escolhida: { cartaoId: string; dano: number } | null = null
  for (const tecnica of disponiveis) {
    if (tecnica.dano.tipo !== 'valor') continue
    if (escolhida === null || tecnica.dano.valor > escolhida.dano) escolhida = { cartaoId: tecnica.cartao.id, dano: tecnica.dano.valor }
  }
  const cartaoId = escolhida?.cartaoId ?? disponiveis[0]?.cartao.id ?? null
  return { cartaoId, armaId, alvoTokenId }
}

/** Q2: o dano do Atacar com a arma escolhida, para a tela já preencher (editável). `null` = a ficha não diz. */
export function danoSugeridoDoAtaque(personagem: Personagem, sistema: SistemaDeRpg, arma: CartaoDaFicha | null): number | null {
  const lido = danoDoAtaque({ personagem, sistema, arma, vidaDoAlvo: null })
  return lido.tipo === 'valor' ? lido.valor : null
}

// ───────────────────────────────────────────────────────────────────────────
// Texto do registro (seção 3.6): nunca HP, SP nem custo
// ───────────────────────────────────────────────────────────────────────────

function comSinal(numero: number): string {
  return numero < 0 ? String(numero) : `+${numero}`
}

/** "d20 7+2 = 9". */
export function textoDaRolagem(d20: number, modificador: number, total: number): string {
  return `d20 ${d20}${comSinal(modificador)} = ${total}`
}

function textoDaSaida(saida: SaidaDaReacao, dano: number): string {
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
    case 'semReacao':
      return `${dano} sem reação`
  }
}

/** O que aconteceu com um alvo: esperando, rolou, resolveu. */
function textoDoAlvo(alvo: AlvoDoGolpe): string {
  const pedacos: string[] = []
  if (alvo.rolagem !== undefined) pedacos.push(textoDaRolagem(alvo.rolagem.d20, alvo.rolagem.modificador, alvo.rolagem.total))
  if (alvo.saida !== undefined && alvo.danoFinal !== undefined) pedacos.push(textoDaSaida(alvo.saida, alvo.danoFinal))
  else if (alvo.rolagem === undefined) pedacos.push('esperando reação')
  return pedacos.join(' · ')
}

/**
 * A linha do golpe, refeita a cada alvo resolvido:
 * "Lia usa Rajada de Penas em Ilo: 260 · d20 7+2 = 9 · recebeu 260";
 * "Lia usa Rajada em Ilo e Teo: Ilo d20 15+0 = 15 · esquivou · Teo esperando reação".
 */
export function textoDoGolpe(golpe: GolpeDaBatalha, nomeDoToken: (tokenId: string) => string): string {
  const marcas = [golpe.surpresa ? 'Surpresa' : null, golpe.overload ? 'Overload' : null, golpe.perfurante ? 'perfurante' : null, golpe.contraDe !== undefined ? 'contra-ataque' : null].filter((marca): marca is string => marca !== null)
  const nomes = golpe.alvos.map((alvo) => nomeDoToken(alvo.tokenId))
  const emQuem = nomes.length === 0 ? '' : ` em ${nomes.length === 1 ? (nomes[0] ?? '') : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1] ?? ''}`}`
  const comeco = `${nomeDoToken(golpe.atacanteTokenId)} usa ${golpe.nome}${emQuem}${marcas.length > 0 ? ` (${marcas.join(', ')})` : ''}`
  const [unico] = golpe.alvos
  if (golpe.alvos.length === 1 && unico !== undefined) {
    const detalhe = textoDoAlvo(unico)
    // "sem reação" já diz o número; nos outros o dano que chega vem antes.
    return unico.dano === null || unico.saida === 'semReacao' ? `${comeco}: ${detalhe}` : `${comeco}: ${unico.dano} · ${detalhe}`
  }
  if (golpe.alvos.length === 0) return comeco
  return `${comeco}: ${golpe.alvos.map((alvo) => `${nomeDoToken(alvo.tokenId)} ${textoDoAlvo(alvo)}`).join(' · ')}`
}
