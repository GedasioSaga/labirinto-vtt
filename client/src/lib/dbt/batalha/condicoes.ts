import { epTotal, modEfetivo, rolarComVantagem, temCondicao } from './contas'
import { CONDICOES } from './leitura'
import { acabarTransformacao, sofrerDano } from './morte'
import { combatente, efeito, envolver, escrever, fichaDe, foraDeCombate, mudarCombatente, porPendencia, tipoDaLinha, type Trabalho } from './trabalho'
import type { Atributo, CombatenteDBT, CondicaoAtiva, IdDaCondicao, IdDoCombatente, OrigemDaCondicao, QuandoExpira } from './tipos'

/**
 * CONDIÇÕES (docs/planos/dbt-batalha.md, seção 10; 9.7, p. 120-123): a
 * tabela de comportamento, a aplicação com teste contra a CD e o tique de
 * cada momento do turno.
 */

export interface ComportamentoDaCondicao {
  /** Teste do alvo ao aplicar ("ou" = o maior modificador). Vazio = sem teste. */
  aoAplicar: readonly Atributo[]
  expira: (turnosJogados: number, rodada: number) => QuandoExpira
  /** Teste no início do turno do afetado. Vazio = sem teste. */
  testeNoInicio: readonly Atributo[]
  /** Passar no teste suprime em vez de tirar (Quebrado, Sangrando). */
  suprime: ((turno: number) => QuandoExpira) | null
}

const fimDoProximo = (turnosJogados: number): QuandoExpira => ({ tipo: 'fimDoTurno', turno: turnosJogados + 1 })
const porTeste = (): QuandoExpira => ({ tipo: 'teste' })
const porEvento = (): QuandoExpira => ({ tipo: 'evento' })

function c(aoAplicar: readonly Atributo[], expira: ComportamentoDaCondicao['expira'], testeNoInicio: readonly Atributo[] = [], suprime: ComportamentoDaCondicao['suprime'] = null): ComportamentoDaCondicao {
  return { aoAplicar, expira, testeNoInicio, suprime }
}

export const COMPORTAMENTO: Readonly<Record<IdDaCondicao, ComportamentoDaCondicao>> = {
  // O "reações x2" some no fim da rodada; a perda da vez fica em `perdeProximoTurno` (ambiguidade 18).
  atordoado: c(['con'], (_tj, rodada) => ({ tipo: 'fimDaRodada', rodada })),
  desnorteado: c(['sab', 'con'], porTeste, ['sab', 'con']),
  quebrado: c(['con'], () => ({ tipo: 'fimDoCombate' }), ['con'], (turno) => ({ tipo: 'fimDoTurno', turno })),
  enraizado: c(['des'], porTeste, ['des']),
  envenenado: c(['con'], porTeste, ['con']),
  sangrando: c(['con'], porEvento, ['con'], (turno) => ({ tipo: 'inicioDoTurno', turno: turno + 1 })),
  silenciado: c(['con'], fimDoProximo),
  sobrecarregado: c(['pod'], porEvento),
  'quebra-de-guarda': c(['des'], fimDoProximo),
  caido: c(['des'], porEvento),
  desequilibrado: c(['des'], fimDoProximo),
  exposto: c(['des'], (tj) => ({ tipo: 'inicioDoTurno', turno: tj + 1 })),
  paralisado: c(['con'], fimDoProximo),
  intimidado: c(['sab'], porTeste, ['sab']),
  cego: c(['con'], fimDoProximo),
  'lacuna-mental': c(['sab'], () => ({ tipo: 'turnosDeAcao', restantes: 2 })),
  instavel: c(['int', 'pod'], porTeste, ['int', 'pod']),
  'confusao-mental': c(['sab'], porTeste, ['sab']),
  'controle-mental': c(['sab'], porTeste),
  'alucinacao-sensorial': c(['sab'], fimDoProximo),
  personalizada: c([], fimDoProximo),
}

/** Confusão Mental, 1d20 do efeito (9.7): 1-9 ataca, 10-16 perde a vez, 17-20 normal. */
const CONFUSAO_ATACA_ATE = 9
const CONFUSAO_PERDE_ATE = 16

export function nomeDaCondicao(id: IdDaCondicao): string {
  if (id === 'personalizada') return 'Condição'
  return CONDICOES.find((condicao) => condicao.id === id)?.nome ?? id
}

/** Reações custam o dobro: Atordoado (até o fim da rodada) ou Paralisado. */
export function reacaoDobrada(alvo: CombatenteDBT): boolean {
  return temCondicao(alvo, 'atordoado') || temCondicao(alvo, 'paralisado')
}

export interface ResultadoDoTeste {
  d20: number
  total: number
  passou: boolean
  atributo: Atributo
}

/** `d20 + maior mod entre os atributos + EP total` (2.3.1); Envenenado rola com desvantagem. Igualar passa. */
export function testeDeAtributo(t: Trabalho, id: IdDoCombatente, atributos: readonly Atributo[], contra: number, comEP = true): ResultadoDoTeste {
  const alvo = combatente(t, id)
  const f = fichaDe(t, alvo)
  const lista = atributos.length === 0 ? (['con'] satisfies Atributo[]) : atributos
  let atributo = lista[0]
  let mod = alvo === undefined ? 0 : modEfetivo(alvo, f, atributo)
  for (const candidato of lista) {
    const valor = alvo === undefined ? 0 : modEfetivo(alvo, f, candidato)
    if (valor > mod) {
      mod = valor
      atributo = candidato
    }
  }
  t.comD20 = true
  const { d20 } = rolarComVantagem(alvo !== undefined && temCondicao(alvo, 'envenenado') ? -1 : 0, t.ctx.rolar)
  const total = d20 + mod + (comEP && alvo !== undefined ? epTotal(alvo, f) : 0)
  return { d20, total, passou: total >= contra, atributo }
}

/** Queda: nível 0 e 1d20 x níveis de dano contundente, sem CA e sem janela (seção 11). */
export function cair(t: Trabalho, id: IdDoCombatente): void {
  const alvo = combatente(t, id)
  if (alvo === undefined || alvo.voo === 0) return
  const niveis = alvo.voo
  mudarCombatente(t, id, (atual) => ({ ...atual, voo: 0 }))
  tipoDaLinha(t, 'voo')
  t.comD20 = true
  const d20 = t.ctx.rolar(20)
  sofrerDano(t, id, d20 * niveis, `queda de ${niveis} nível(is), d20 ${d20}`, 'queda')
}

/** Atordoado voando: cai ou estabiliza (pendência); Desequilibrado: cai sem opção. */
export function pedirQueda(t: Trabalho, id: IdDoCombatente, podeEstabilizar: boolean): void {
  const alvo = combatente(t, id)
  if (alvo === undefined || alvo.voo === 0) return
  if (!podeEstabilizar) {
    cair(t, id)
    return
  }
  porPendencia(t, { id: t.ctx.gerarId(), responde: alvo.npc ? { tipo: 'mestre' } : { tipo: 'combatente', id }, tipo: 'queda', combatenteId: id, podeEstabilizar }, true)
}

/** Lacuna Mental: o host sorteia uma técnica ativa ou transformação; a forma ativa sorteada acaba. */
function sortearLacuna(t: Trabalho, id: IdDoCombatente): string | undefined {
  const alvo = combatente(t, id)
  const f = fichaDe(t, alvo)
  if (alvo === undefined || f === null) return undefined
  const opcoes = [...f.tecnicas.map((tecnica) => tecnica.id), ...f.transformacoes.map((forma) => forma.id)]
  if (opcoes.length === 0) return undefined
  t.comD20 = true
  const sorteada = opcoes[(t.ctx.rolar(20) - 1) % opcoes.length]
  if (alvo.transformacao?.id === sorteada) acabarTransformacao(t, id, 'Lacuna Mental')
  return sorteada
}

export interface PedidoDeCondicao {
  condicao: IdDaCondicao
  origem: OrigemDaCondicao
  /** null = sem teste (o mestre aplicou). */
  cd: number | null
  nome?: string
  extra?: CondicaoAtiva['extra']
}

/**
 * Aplica a condição (seção 10): recusa do 20 natural na rodada 1, imunidade
 * do Envenenado vencido, Quebrado repetido da mesma técnica; teste do alvo
 * contra a CD (igualar passa). Devolve se ficou.
 */
export function aplicarCondicao(t: Trabalho, alvoId: IdDoCombatente, pedido: PedidoDeCondicao): boolean {
  const alvo = combatente(t, alvoId)
  if (alvo === undefined || foraDeCombate(alvo)) return false
  const { condicao, origem, cd } = pedido
  const nome = pedido.nome ?? nomeDaCondicao(condicao)
  const rodada = t.nucleo.ordem.rodada
  tipoDaLinha(t, 'condicao')
  envolver(t, alvoId)
  if (alvo.natural20 && rodada <= 1 && t.nucleo.fase === 'combate') {
    escrever(t, `${alvo.nome} é imune a ${nome} na rodada 1 (20 natural)`)
    return false
  }
  if (origem.tecnicaId !== null && alvo.imuneA.some((imune) => imune.condicao === condicao && imune.tecnicaId === origem.tecnicaId)) {
    escrever(t, `${alvo.nome} já venceu ${nome} desta técnica: imune`)
    return false
  }
  if (condicao === 'quebrado' && origem.tecnicaId !== null && alvo.condicoes.some((ativa) => ativa.condicao === 'quebrado' && ativa.origem.tecnicaId === origem.tecnicaId)) {
    escrever(t, `${alvo.nome} já está Quebrado por ${origem.tecnicaNome}`)
    return false
  }
  const comportamento = COMPORTAMENTO[condicao]
  if (cd !== null && comportamento.aoAplicar.length > 0) {
    const teste = testeDeAtributo(t, alvoId, comportamento.aoAplicar, cd)
    if (teste.passou) {
      escrever(t, `${alvo.nome} resiste a ${nome}: d20 ${teste.d20}, ${teste.total} vs CD ${cd}`, `${alvo.nome} resiste a ${nome}: d20 ${teste.d20}, ${teste.total}`)
      return false
    }
    escrever(t, `${alvo.nome} falha contra ${nome}: d20 ${teste.d20}, ${teste.total} vs CD ${cd}`, `${alvo.nome} falha contra ${nome}: d20 ${teste.d20}, ${teste.total}`)
  }
  const extra: CondicaoAtiva['extra'] = { ...pedido.extra }
  if (condicao === 'quebrado' && extra.atributo === undefined) extra.atributo = 'con'
  if (condicao === 'intimidado' && origem.combatenteId !== null) extra.intimidadorId = origem.combatenteId
  if (condicao === 'controle-mental' && origem.combatenteId !== null) extra.controladorId = origem.combatenteId
  if (condicao === 'lacuna-mental') {
    const sorteada = sortearLacuna(t, alvoId)
    if (sorteada !== undefined) extra.tecnicaBloqueada = sorteada
  }
  const nova: CondicaoAtiva = {
    id: t.ctx.gerarId(),
    condicao,
    nome,
    origem,
    cd,
    expira: comportamento.expira(alvo.turnosJogados, rodada),
    suprimidaAte: null,
    aplicadaNaRodada: rodada,
    ...(Object.keys(extra).length > 0 ? { extra } : {}),
  }
  mudarCombatente(t, alvoId, (atual) => ({ ...atual, condicoes: [...atual.condicoes, nova] }))
  escrever(t, `${alvo.nome} fica ${nome}`)
  efeito(t, { tipo: 'condicao', tokenIds: [alvoId], d20: null, faixa: null, numero: null })
  if (condicao === 'atordoado') {
    mudarCombatente(t, alvoId, (atual) => ({ ...atual, perdeProximoTurno: { motivo: 'Atordoado' } }))
    acabarTransformacao(t, alvoId, 'Atordoado')
    pedirQueda(t, alvoId, true)
  }
  if (condicao === 'desequilibrado') pedirQueda(t, alvoId, false)
  return true
}

export function tirarCondicao(t: Trabalho, id: IdDoCombatente, condicaoId: string, motivo: string): void {
  const alvo = combatente(t, id)
  const ativa = alvo?.condicoes.find((candidata) => candidata.id === condicaoId)
  if (alvo === undefined || ativa === undefined) return
  mudarCombatente(t, id, (atual) => ({ ...atual, condicoes: atual.condicoes.filter((candidata) => candidata.id !== condicaoId) }))
  escrever(t, `${alvo.nome} deixa de estar ${ativa.nome} (${motivo})`)
}

/** Tira a primeira ativa daquele tipo (Exposto, Quebra de Guarda, Sobrecarregado: "ao usar/ao ser atacado"). */
export function consumirCondicao(t: Trabalho, id: IdDoCombatente, condicao: IdDaCondicao): boolean {
  const ativa = combatente(t, id)?.condicoes.find((candidata) => candidata.condicao === condicao && candidata.suprimidaAte === null)
  if (ativa === undefined) return false
  tirarCondicao(t, id, ativa.id, 'consumida')
  return true
}

function vencido(quando: QuandoExpira, tipo: 'inicioDoTurno' | 'fimDoTurno', turno: number): boolean {
  return quando.tipo === tipo && quando.turno <= turno
}

/** Início do turno (6.1 passo 2): Exposto não consumido, barreiras, supressão do Sangrando, temporários vencidos. */
export function expirarNoInicio(t: Trabalho, id: IdDoCombatente): void {
  const alvo = combatente(t, id)
  if (alvo === undefined) return
  const turno = alvo.turnosJogados
  const rodada = t.nucleo.ordem.rodada
  const saem = alvo.condicoes.filter((ativa) => vencido(ativa.expira, 'inicioDoTurno', turno))
  for (const ativa of saem) escrever(t, `${alvo.nome}: ${ativa.nome} acabou`)
  mudarCombatente(t, id, (atual) => ({
    ...atual,
    condicoes: atual.condicoes
      .filter((ativa) => !vencido(ativa.expira, 'inicioDoTurno', turno))
      .map((ativa) => (ativa.suprimidaAte !== null && vencido(ativa.suprimidaAte, 'inicioDoTurno', turno) ? { ...ativa, suprimidaAte: null } : ativa)),
    temporarios: atual.temporarios.filter((temporario) => (temporario.ateRodada === null || temporario.ateRodada >= rodada) && (temporario.ateInicioDoTurno === undefined || temporario.ateInicioDoTurno > turno)),
  }))
}

/** Fim do turno (6.3): "fim do próximo turno", supressão do Quebrado, contagem da Lacuna Mental. */
export function expirarNoFim(t: Trabalho, id: IdDoCombatente): void {
  const alvo = combatente(t, id)
  if (alvo === undefined) return
  const turno = alvo.turnosJogados
  const mantidas: CondicaoAtiva[] = []
  for (const ativa of alvo.condicoes) {
    if (vencido(ativa.expira, 'fimDoTurno', turno)) {
      escrever(t, `${alvo.nome}: ${ativa.nome} acabou`)
      continue
    }
    if (ativa.expira.tipo === 'turnosDeAcao') {
      const restantes = ativa.expira.restantes - 1
      if (restantes <= 0) {
        escrever(t, `${alvo.nome}: ${ativa.nome} acabou`)
        continue
      }
      mantidas.push({ ...ativa, expira: { tipo: 'turnosDeAcao', restantes } })
      continue
    }
    mantidas.push(ativa.suprimidaAte !== null && vencido(ativa.suprimidaAte, 'fimDoTurno', turno) ? { ...ativa, suprimidaAte: null } : ativa)
  }
  mudarCombatente(t, id, (atual) => ({ ...atual, condicoes: mantidas }))
}

/** Fim da rodada (6.3): o "reações x2" do Atordoado aplicado nesta rodada. */
export function expirarNaRodada(t: Trabalho): void {
  const rodada = t.nucleo.ordem.rodada
  for (const alvo of Object.values(t.nucleo.combatentes)) {
    if (!alvo.condicoes.some((ativa) => ativa.expira.tipo === 'fimDaRodada' && ativa.expira.rodada <= rodada)) continue
    mudarCombatente(t, alvo.id, (atual) => ({ ...atual, condicoes: atual.condicoes.filter((ativa) => !(ativa.expira.tipo === 'fimDaRodada' && ativa.expira.rodada <= rodada)) }))
  }
}

export interface SaidaDosTestes {
  /** Motivo de perder a vez; null = joga. */
  perdeAVez: string | null
  ataqueForcado: boolean
}

/**
 * Testes do início do turno (6.1 passo 5; ambiguidade 22: um por condição).
 * Confusão Mental rola o 1d20 do efeito e depois SAB; Controle Mental é PRE
 * do controlador contra SAB.
 */
export function testesDoInicio(t: Trabalho, id: IdDoCombatente): SaidaDosTestes {
  const saida: SaidaDosTestes = { perdeAVez: null, ataqueForcado: false }
  const alvo = combatente(t, id)
  if (alvo === undefined) return saida
  for (const ativa of alvo.condicoes) {
    const comportamento = COMPORTAMENTO[ativa.condicao]
    tipoDaLinha(t, 'teste')
    if (ativa.condicao === 'controle-mental') {
      const controlador = ativa.extra?.controladorId
      const deles = controlador === undefined ? null : testeDeAtributo(t, controlador, ['pre'], 0)
      const meu = testeDeAtributo(t, id, ['sab'], (deles?.total ?? 0) + 1)
      if (meu.passou) tirarCondicao(t, id, ativa.id, `SAB ${meu.total} vence ${deles?.total ?? 0}`)
      else {
        escrever(t, `${alvo.nome} segue sob Controle Mental (SAB ${meu.total} contra ${deles?.total ?? 0}): o mestre o comanda`)
        saida.perdeAVez = 'Controle Mental'
      }
      continue
    }
    if (ativa.condicao === 'confusao-mental') {
      t.comD20 = true
      const efeitoDoD20 = t.ctx.rolar(20)
      if (efeitoDoD20 <= CONFUSAO_ATACA_ATE) saida.ataqueForcado = true
      else if (efeitoDoD20 <= CONFUSAO_PERDE_ATE) saida.perdeAVez = 'Confusão Mental'
      escrever(t, `${alvo.nome}, Confusão Mental: d20 ${efeitoDoD20}${saida.ataqueForcado ? ', ataca quem estiver perto' : saida.perdeAVez !== null ? ', perde a vez' : ', age normal'}`)
    }
    if (comportamento.testeNoInicio.length === 0 || ativa.cd === null) continue
    const teste = testeDeAtributo(t, id, comportamento.testeNoInicio, ativa.cd)
    const conta = `d20 ${teste.d20}, ${teste.total} vs CD ${ativa.cd}`
    if (!teste.passou) {
      escrever(t, `${alvo.nome} segue ${ativa.nome}: ${conta}`)
      continue
    }
    if (comportamento.suprime !== null) {
      const ate = comportamento.suprime(alvo.turnosJogados)
      mudarCombatente(t, id, (atual) => ({ ...atual, condicoes: atual.condicoes.map((candidata) => (candidata.id === ativa.id ? { ...candidata, suprimidaAte: ate } : candidata)) }))
      escrever(t, `${alvo.nome} segura ${ativa.nome} por agora: ${conta}`)
      continue
    }
    tirarCondicao(t, id, ativa.id, conta)
    if (ativa.condicao === 'envenenado' && ativa.origem.tecnicaId !== null) {
      const imune = { condicao: ativa.condicao, tecnicaId: ativa.origem.tecnicaId }
      mudarCombatente(t, id, (atual) => ({ ...atual, imuneA: [...atual.imuneA, imune] }))
    }
  }
  return saida
}
