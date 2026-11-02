import { abrirChoque, bloqueioDoChoque, custoDoChoque, tecnicaOfensiva } from './choque'
import { aplicarCondicao, consumirCondicao, reacaoDobrada, testeDeAtributo, tirarCondicao } from './condicoes'
import {
  caEfetiva,
  criticoAPartirDe,
  custoEfetivo,
  danoDaFaixa,
  epTotal,
  faixaDaMargem,
  faixaInvertida,
  modEfetivo,
  montarAcerto,
  redutorDosBasicos,
  rolarComVantagem,
  somaDosTemporarios,
  subirEstagios,
  temCondicao,
  vantagemDoAtaque,
} from './contas'
import type { TecnicaLida } from './leitura'
import { conferirKiZerado, curar, sofrerDano } from './morte'
import { flanqueado, sobAmeaca } from './posicao'
import {
  aliadosDe,
  combatente,
  dePe,
  efeito,
  envolver,
  escrever,
  fichaDe,
  inimigosDe,
  mudarCombatente,
  nomeDe,
  pkDe,
  porPendencia,
  porRecurso,
  tecnicaDe,
  tipoDaLinha,
  tirarPendencia,
  trocarPendencia,
  type Trabalho,
} from './trabalho'
import {
  PROFUNDIDADE_DE_REACAO_MAX,
  type AtaqueResolvido,
  type CombatenteDBT,
  type CondicaoAtiva,
  type EdicoesDoMestre,
  type EfeitoPrevisto,
  type Faixa,
  type IdDoCombatente,
  type JanelaDeReacao,
  type OpcaoDaPendencia,
  type Pendencia,
  type ReacaoEscolhida,
  type RolagemDoAtaque,
  type TesteAgendado,
} from './tipos'
import { contarTecnicaPaga } from './uso'

/**
 * ATAQUE E JANELA DE REAÇÃO (docs/planos/dbt-batalha.md, seções 7 e 8).
 * Sequência: calcular (nada muda) -> [manual: confirmar] -> pagar -> erro
 * fecha / acerto abre a janela -> resolver as reações -> [manual: confirmar]
 * -> aplicar dano e efeitos -> reativas viram ataques novos.
 */

export interface PedidoDeAtaque {
  atacanteId: IdDoCombatente
  alvos: readonly IdDoCombatente[]
  tecnica: TecnicaLida
  modo: 'dano' | 'agarrar'
  /** 1, ou n básicos condensados (9.2). */
  basicos: number
  cargasKi: number
  profundidade: number
  /** Ação gratuita do erro crítico: 0 Ki. */
  gratis: boolean
  /** O alvo não reage (ação gratuita). */
  semJanela: boolean
  /** Técnica reativa: paga com o x2 das reações. */
  reacao: boolean
  /** Rajada Contínua mantida: o total original (sem nova rolagem). */
  totalFixo?: number
}

/** CD = 8 + mod + EP base (8.1.2). */
const CD_BASE = 8
/** Gatilho do tipo de dano: crítico ou margem >= 12 (seção 7.4). */
const MARGEM_DO_GATILHO = 12
const NIVEIS_DO_GATILHO: readonly [number, number][] = [
  [12, 4],
  [6, 3],
  [3, 2],
  [1, 1],
]
const NOME_DA_FAIXA: Readonly<Record<Faixa, string>> = { erro: 'Erro', minimo: 'Mínimo', medio: 'Médio', completo: 'Completo' }

/** CD da condição e da salvaguarda: 8 + mod do acerto + EP base do aplicador + Aumentar Dificuldade. */
export function cdDaTecnica(t: Trabalho, atacanteId: IdDoCombatente, tecnica: TecnicaLida): number {
  const atacante = combatente(t, atacanteId)
  const f = fichaDe(t, atacante)
  if (atacante === undefined) return CD_BASE
  return CD_BASE + modEfetivo(atacante, f, tecnica.atributoDeAcerto) + (f?.epBase ?? 0) + tecnica.dificuldade
}

function fontesDoAtaque(t: Trabalho, atacanteId: IdDoCombatente, alvoId: IdDoCombatente, tecnica: TecnicaLida): { vantagens: string[]; desvantagens: string[] } {
  const atacante = combatente(t, atacanteId)
  const alvo = combatente(t, alvoId)
  const vantagens: string[] = []
  const desvantagens: string[] = []
  if (atacante === undefined || alvo === undefined) return { vantagens, desvantagens }
  if (temCondicao(atacante, 'envenenado')) desvantagens.push('Envenenado')
  if (temCondicao(atacante, 'alucinacao-sensorial')) desvantagens.push('Alucinação')
  if (temCondicao(atacante, 'cego')) desvantagens.push('Cego')
  if (atacante.condicoes.some((ativa) => ativa.condicao === 'intimidado' && ativa.extra?.intimidadorId === alvoId)) desvantagens.push('Intimidado')
  if (tecnica.verbal && temCondicao(atacante, 'silenciado')) desvantagens.push('Silenciado')
  if (temCondicao(alvo, 'caido')) vantagens.push('Alvo caído')
  const posicoes = t.ctx.posicoes
  if (posicoes !== null) {
    const distante = tecnica.alcance.tipo === 'longo' || tecnica.alcance.tipo === 'area'
    if (distante && !tecnica.alcance.queimaRoupa && sobAmeaca(posicoes, atacanteId, inimigosDe(t, atacanteId))) desvantagens.push('Sob ameaça')
    if (!distante && atacante.voo === alvo.voo && flanqueado(posicoes, alvoId, atacanteId, aliadosDe(t, atacanteId))) vantagens.push('Flanqueado')
  }
  return { vantagens, desvantagens }
}

/** Ki da ação: técnica x básicos + carga por Ki, com Sobrecarregado (Ki) e o x2 da reação. */
export function custoDaAcao(t: Trabalho, pedido: Pick<PedidoDeAtaque, 'atacanteId' | 'tecnica' | 'basicos' | 'cargasKi' | 'gratis' | 'reacao'>): number {
  const atacante = combatente(t, pedido.atacanteId)
  if (pedido.gratis || atacante === undefined) return 0
  const base = pedido.tecnica.ki * pedido.basicos + pedido.tecnica.ki * pedido.cargasKi
  return custoEfetivo(base, {
    sobrecarregado: pedido.tecnica.tipo === 'ki' && temCondicao(atacante, 'sobrecarregado'),
    reacaoDobrada: pedido.reacao && reacaoDobrada(atacante),
    choque: false,
  })
}

/**
 * Dano previsto (7.2): sobe os estágios (Devastadora, Sangrando, cargas),
 * soma os temporários, dobra no crítico e multiplica pelos básicos
 * condensados. Erro e agarrão: 0.
 */
export function calcularDanoPrevisto(
  dano: TecnicaLida['dano'],
  faixa: Faixa,
  critico: boolean,
  estagios: number,
  temporarios: number,
  basicos: number,
  modo: 'dano' | 'agarrar',
): number {
  if (faixa === 'erro' || modo === 'agarrar') return 0
  const subida = subirEstagios(faixa, estagios, dano.minimo)
  const base = danoDaFaixa(dano, subida.faixa) + subida.extra + temporarios
  return Math.max(0, base) * (critico ? 2 : 1) * Math.max(1, basicos)
}

function previstoDe(t: Trabalho, ataque: AtaqueResolvido, faixa: Faixa, critico: boolean): number {
  const atacante = combatente(t, ataque.atacanteId)
  const alvo = combatente(t, ataque.alvoId)
  const tecnica = tecnicaDe(t, ataque.atacanteId, ataque.tecnica.id)
  if (atacante === undefined || alvo === undefined || tecnica === undefined) return ataque.danoPrevisto
  const estagios = tecnica.estagiosExtras + (temCondicao(alvo, 'sangrando') ? 1 : 0) + ataque.cargas
  return calcularDanoPrevisto(tecnica.dano, faixa, critico, estagios, somaDosTemporarios(atacante, 'dano'), ataque.basicos, ataque.modo)
}

function efeitosPrevistos(t: Trabalho, atacanteId: IdDoCombatente, tecnica: TecnicaLida, critico: boolean, margem: number): EfeitoPrevisto[] {
  const atacante = combatente(t, atacanteId)
  const efeitos: EfeitoPrevisto[] = []
  if (tecnica.efeitoNegativo !== null) {
    const cd = cdDaTecnica(t, atacanteId, tecnica)
    efeitos.push({ tipo: 'condicao', texto: `Efeito Negativo (CD ${cd})`, condicao: tecnica.efeitoNegativo.condicao, cd, aplicar: true })
  }
  if (tecnica.gatilhos.length > 0 && (critico || margem >= MARGEM_DO_GATILHO)) efeitos.push({ tipo: 'gatilho', texto: tecnica.gatilhos.join(', '), condicao: null, cd: null, aplicar: true })
  if (atacante !== undefined && temCondicao(atacante, 'instavel') && tecnicaOfensiva(tecnica)) efeitos.push({ tipo: 'instavel', texto: 'Instável: sofre metade', condicao: null, cd: null, aplicar: true })
  if (critico) efeitos.push({ tipo: 'quebraArmadura', texto: 'Crítico: a armadura se quebra', condicao: null, cd: null, aplicar: true })
  return efeitos
}

/** Um ataque contra um alvo, com a rolagem já feita (área: a mesma para todos). Não muda nada. */
function montarUm(t: Trabalho, pedido: PedidoDeAtaque, alvoId: IdDoCombatente, rolagem: Pick<RolagemDoAtaque, 'd20' | 'dados' | 'vantagem' | 'fontes' | 'digitada'> | null, grupo: string, custo: number): AtaqueResolvido | null {
  const atacante = combatente(t, pedido.atacanteId)
  const alvo = combatente(t, alvoId)
  if (atacante === undefined || alvo === undefined) return null
  const fa = fichaDe(t, atacante)
  const fb = fichaDe(t, alvo)
  const { tecnica } = pedido
  const epA = epTotal(atacante, fa)
  const epB = epTotal(alvo, fb)
  const difEP = Math.max(0, epA - epB)
  const cargas = (atacante.carga?.tecnicaId === tecnica.id ? atacante.carga.cargas : 0) + pedido.cargasKi
  const base: AtaqueResolvido = {
    id: t.ctx.gerarId(),
    grupo,
    atacanteId: pedido.atacanteId,
    alvoId,
    tecnica: { id: tecnica.id, nome: tecnica.nome, rank: tecnica.rank, tipo: tecnica.tipo, ki: custo },
    modo: pedido.modo,
    basicos: pedido.basicos,
    rolagem: null,
    salvaguarda: null,
    ca: null,
    difEP,
    margem: 0,
    faixa: 'erro',
    critico: false,
    erroCritico: false,
    danoCompleto: tecnica.dano.completo,
    danoPrevisto: 0,
    efeitos: [],
    kiPago: false,
    semJanela: pedido.semJanela,
    profundidade: pedido.profundidade,
    cargas,
    mitigacao: 0,
  }
  if (tecnica.salvaguarda !== null) {
    // 7.3: sem rolagem de acerto; o alvo faz a salvaguarda contra a CD (a escala baixa a CD do mais fraco).
    const cd = cdDaTecnica(t, pedido.atacanteId, tecnica) - Math.max(0, epB - epA)
    const teste = testeDeAtributo(t, alvoId, [tecnica.salvaguarda.atributo], cd)
    const falhaPor = cd - teste.total
    const faixa = falhaPor <= 0 ? 'erro' : faixaDaMargem(falhaPor, difEP)
    const pronto = { ...base, salvaguarda: { cd, d20: teste.d20, total: teste.total }, margem: falhaPor, faixa }
    return { ...pronto, danoPrevisto: previstoDe(t, pronto, faixa, false), efeitos: efeitosPrevistos(t, pedido.atacanteId, tecnica, false, falhaPor) }
  }
  const d20 = rolagem?.d20 ?? 0
  const temBasico = tecnica.basica && t.nucleo.turno?.combatenteId === pedido.atacanteId
  const conta = montarAcerto({
    d20,
    atributo: tecnica.atributoDeAcerto,
    mod: modEfetivo(atacante, fa, tecnica.atributoDeAcerto),
    epAtacante: epA,
    epAlvo: epB,
    precisao: tecnica.precisao,
    temporarios: somaDosTemporarios(atacante, 'acerto'),
    redutorBasico: temBasico ? redutorDosBasicos(t.nucleo.turno?.basicosUsados ?? 0, pedido.basicos) : 0,
    desnorteado: temCondicao(atacante, 'desnorteado'),
  })
  const total = pedido.totalFixo ?? conta.total
  // Quebra de Guarda: o próximo ataque usa CA 0 (ambiguidade 7).
  const ca = temCondicao(alvo, 'quebra-de-guarda') ? 0 : caEfetiva(alvo, fb)
  const margem = total - ca
  const fixo = pedido.totalFixo !== undefined
  const erroCritico = !fixo && d20 === 1
  const critico = !fixo && !erroCritico && d20 >= criticoAPartirDe(tecnica.golpeCritico, temCondicao(alvo, 'exposto'))
  const faixa: Faixa = erroCritico ? 'erro' : critico ? 'completo' : faixaDaMargem(margem, difEP)
  const pronto: AtaqueResolvido = {
    ...base,
    rolagem: rolagem === null ? null : { ...rolagem, partes: conta.partes, total },
    ca,
    margem,
    faixa,
    critico,
    erroCritico,
  }
  return { ...pronto, danoPrevisto: previstoDe(t, pronto, faixa, critico), efeitos: efeitosPrevistos(t, pedido.atacanteId, tecnica, critico, margem) }
}

function contaLegivel(t: Trabalho, ataque: AtaqueResolvido): string {
  const alvo = nomeDe(t, ataque.alvoId)
  if (ataque.salvaguarda !== null) return `${alvo}: salvaguarda d20 ${ataque.salvaguarda.d20}, ${ataque.salvaguarda.total} vs CD ${ataque.salvaguarda.cd}`
  const rolagem = ataque.rolagem
  if (rolagem === null) return alvo
  const partes = rolagem.partes.map((parte) => `${parte.valor < 0 ? '-' : '+'}${Math.abs(parte.valor)} ${parte.rotulo}`).join(' ')
  return `${alvo}: d20 [${rolagem.d20}] ${partes} = ${rolagem.total} vs CA [${ataque.ca ?? '?'}] -> margem ${ataque.margem}`
}

function emOrdemDeIniciativa(t: Trabalho, ids: readonly IdDoCombatente[]): IdDoCombatente[] {
  const cartas = t.nucleo.ordem.cartas
  return [...ids].sort((a, b) => cartas.indexOf(a) - cartas.indexOf(b))
}

/** Põe várias pendências mantendo a ordem: na frente (aninhadas) ou no fim (irmãs). */
function porEmOrdem(t: Trabalho, pendencias: readonly Pendencia[], naFrente: boolean): void {
  const lista = naFrente ? [...pendencias].reverse() : pendencias
  for (const pendencia of lista) porPendencia(t, pendencia, naFrente)
}

/** Declara o ataque (7.4): calcula; no manual (ou técnica especial) para no cartão do mestre; senão paga e segue. */
export function iniciarAtaque(t: Trabalho, pedido: PedidoDeAtaque): void {
  const atacante = combatente(t, pedido.atacanteId)
  if (atacante === undefined || pedido.alvos.length === 0) return
  tipoDaLinha(t, 'tecnica')
  envolver(t, pedido.atacanteId, ...pedido.alvos)
  const custo = custoDaAcao(t, pedido)
  const grupo = t.ctx.gerarId()
  const alvos = emOrdemDeIniciativa(t, pedido.alvos)
  let rolagem: Pick<RolagemDoAtaque, 'd20' | 'dados' | 'vantagem' | 'fontes' | 'digitada'> | null = null
  if (pedido.tecnica.salvaguarda === null && pedido.totalFixo === undefined) {
    const { vantagens, desvantagens } = fontesDoAtaque(t, pedido.atacanteId, alvos[0], pedido.tecnica)
    const vantagem = vantagemDoAtaque(vantagens, desvantagens)
    t.comD20 = true
    const { d20, dados } = rolarComVantagem(vantagem, t.ctx.rolar)
    rolagem = { d20, dados, vantagem, fontes: [...vantagens, ...desvantagens.map((fonte) => `${fonte} (desv.)`)], digitada: false }
  }
  const ataques = alvos.flatMap((alvoId) => montarUm(t, pedido, alvoId, rolagem, grupo, custo) ?? [])
  const extra = pedido.basicos > 1 ? ` x${pedido.basicos}` : ''
  escrever(t, `${atacante.nome} usa ${pedido.tecnica.nome}${extra} (Ki ${custo}) em ${alvos.map((id) => nomeDe(t, id)).join(', ')}`, `${atacante.nome} usa ${pedido.tecnica.nome}${extra}`)
  const naFrente = pedido.profundidade > 0
  if (t.nucleo.opcoes.modo === 'manual' || pedido.tecnica.especial) {
    const etapa = pedido.tecnica.especial ? 'especial' : 'ataque'
    porEmOrdem(t, ataques.map((ataque): Pendencia => ({ id: t.ctx.gerarId(), responde: { tipo: 'mestre' }, tipo: 'confirmar', etapa, ataque })), naFrente)
    escrever(t, 'Aguardando o mestre confirmar')
    return
  }
  pagarAtaque(t, ataques, pedido.semJanela)
  const pagos = ataques.map((ataque) => ({ ...ataque, kiPago: true }))
  for (const ataque of pagos) seguirAtaque(t, ataque, pedido.semJanela)
}

/**
 * Paga a ação uma vez por grupo (7.4 passo 2): Ki, Sobrecarregado consumido,
 * técnica do turno, exaustão, carga, Rajada mantida, Esforço Supremo, Sangria.
 */
export function pagarAtaque(t: Trabalho, grupo: readonly AtaqueResolvido[], semJanela: boolean): void {
  const primeiro = grupo[0]
  if (primeiro === undefined || primeiro.kiPago) return
  const atacante = combatente(t, primeiro.atacanteId)
  const fa = fichaDe(t, atacante)
  const tecnica = tecnicaDe(t, primeiro.atacanteId, primeiro.tecnica.id)
  if (atacante === undefined) return
  const custo = primeiro.tecnica.ki
  if (fa !== null && custo > 0) {
    const antes = pkDe(t, fa)
    porRecurso(t, fa, 'pk', antes - custo)
    escrever(t, `${atacante.nome}: Ki ${antes} -> ${pkDe(t, fa)}`, '')
  }
  const turno = t.nucleo.turno
  if (turno !== null && turno.combatenteId === atacante.id && !semJanela && primeiro.profundidade === 0) {
    t.nucleo = {
      ...t.nucleo,
      turno: tecnica?.basica === true ? { ...turno, basicosUsados: turno.basicosUsados + primeiro.basicos } : { ...turno, tecnicasUsadas: [...turno.tecnicasUsadas, primeiro.tecnica.id] },
    }
  }
  if (tecnica === undefined) return
  contarTecnicaPaga(t, atacante.id, tecnica, fa !== null && custo > 0 && tecnica.tipo === 'ki')
  // Rajada mantida não rola (totalFixo): o total original segue o mesmo.
  const totalDaRajada = (atual: CombatenteDBT): number => primeiro.rolagem?.total ?? (atual.mantendo?.tecnicaId === tecnica.id ? atual.mantendo.total : 0)
  mudarCombatente(t, atacante.id, (atual) => ({
    ...atual,
    carga: atual.carga?.tecnicaId === tecnica.id ? null : atual.carga,
    mantendo: tecnica.rajadaContinua ? { tecnicaId: tecnica.id, alvos: grupo.map((ataque) => ataque.alvoId), total: totalDaRajada(atual) } : atual.mantendo,
    perdeProximoTurno: tecnica.esforcoSupremo ? { motivo: 'Esforço Supremo' } : atual.perdeProximoTurno,
  }))
  if (tecnica.esforcoSupremo || tecnica.rajadaContinua) {
    const agora = t.nucleo.turno
    if (agora !== null && agora.combatenteId === atacante.id) t.nucleo = { ...t.nucleo, turno: { ...agora, semTecnicas: true } }
  }
  if (tecnica.sangria) sofrerDano(t, atacante.id, epTotal(atacante, fa), 'Sangria', 'Sangria')
  if (fa !== null) conferirKiZerado(t, atacante.id, pkDe(t, fa))
}

/** Depois de pagar: erro fecha (erro crítico abre a ação gratuita do alvo); acerto abre a janela (7.4 passos 3-4). */
export function seguirAtaque(t: Trabalho, ataque: AtaqueResolvido, semJanela: boolean): void {
  const alvo = combatente(t, ataque.alvoId)
  const atacante = combatente(t, ataque.atacanteId)
  if (alvo === undefined || atacante === undefined) return
  // O ataque contra ele consome Exposto e Quebra de Guarda, acerte ou erre.
  if (ataque.rolagem !== null) {
    consumirCondicao(t, alvo.id, 'exposto')
    consumirCondicao(t, alvo.id, 'quebra-de-guarda')
  }
  const conta = contaLegivel(t, ataque)
  if (ataque.rolagem !== null) efeito(t, { tipo: 'rolagem', tokenIds: [atacante.id, alvo.id], d20: ataque.rolagem.d20, faixa: ataque.faixa, numero: null })
  const publicoDaRolagem = ataque.rolagem === null ? '' : `d20 ${ataque.rolagem.d20}, total ${ataque.rolagem.total}: `
  if (ataque.faixa === 'erro') {
    escrever(t, `${conta}: ${ataque.erroCritico ? 'erro crítico' : 'erra'}`, `${publicoDaRolagem}${ataque.erroCritico ? 'erro crítico' : 'erra'} ${alvo.nome}`)
    if (ataque.erroCritico && dePe(alvo)) {
      porPendencia(t, { id: t.ctx.gerarId(), responde: alvo.npc ? { tipo: 'mestre' } : { tipo: 'combatente', id: alvo.id }, tipo: 'acaoGratuita', combatenteId: alvo.id, contra: atacante.id, motivo: 'erroCritico' }, true)
    }
    if (tecnicaDe(t, atacante.id, ataque.tecnica.id)?.previsivel === true) escrever(t, `${ataque.tecnica.nome} é Previsível: o mestre pode abrir a ação gratuita de ${alvo.nome}`, '')
    return
  }
  const critico = ataque.critico ? ', crítico' : ''
  escrever(t, `${conta}: ${NOME_DA_FAIXA[ataque.faixa]}${critico}, dano previsto ${ataque.danoPrevisto}`, `${publicoDaRolagem}acerta ${alvo.nome} (${NOME_DA_FAIXA[ataque.faixa]}${critico})`)
  if (semJanela) {
    aplicarResultado(t, ataque, undefined)
    return
  }
  abrirJanela(t, ataque)
}

/** Abre a janela de reação (8): convidado fixo é o alvo; sem ninguém que possa reagir, resolve direto. */
export function abrirJanela(t: Trabalho, ataque: AtaqueResolvido): void {
  const janela: JanelaDeReacao = { ataque, convidados: [ataque.alvoId], respostas: {}, profundidade: ataque.profundidade }
  const alguem = Object.keys(t.nucleo.combatentes).some((id) => id !== ataque.atacanteId && opcoesDeReacao(t, janela, id).some((opcao) => opcao.chave !== 'nao' && opcao.bloqueio === null))
  if (!alguem) {
    resolverJanela(t, janela)
    return
  }
  const alvo = combatente(t, ataque.alvoId)
  tipoDaLinha(t, 'reacao')
  porPendencia(t, { id: t.ctx.gerarId(), responde: alvo === undefined || alvo.npc ? { tipo: 'mestre' } : { tipo: 'combatente', id: alvo.id }, tipo: 'reacao', janela }, ataque.profundidade > 0)
}

/** As reações de um combatente nesta janela (8), com custo e motivo de bloqueio. */
export function opcoesDeReacao(t: Trabalho, janela: JanelaDeReacao, reatorId: IdDoCombatente): OpcaoDaPendencia[] {
  const opcoes: OpcaoDaPendencia[] = [{ chave: 'nao', rotulo: 'Não reagir', ki: 0, gratis: true, bloqueio: null, pede: null }]
  const reator = combatente(t, reatorId)
  const f = fichaDe(t, reator)
  // Só quem está de pé reage: a 0 PV (salvaguarda) ele só rola contra a morte.
  if (reator === undefined || f === null || !dePe(reator) || reatorId === janela.ataque.atacanteId) return opcoes
  const dobro = reacaoDobrada(reator)
  const pk = pkDe(t, f)
  const custoDe = (tecnica: TecnicaLida, ki: number): number => custoEfetivo(ki, { sobrecarregado: tecnica.tipo === 'ki' && temCondicao(reator, 'sobrecarregado'), reacaoDobrada: dobro, choque: false })
  const opcao = (chave: string, rotulo: string, ki: number, defensiva: boolean, bloqueio: string | null): OpcaoDaPendencia => {
    const gratis = defensiva && reator.reacaoEmDesvantagem && pk >= ki
    return { chave, rotulo, ki, gratis, bloqueio: bloqueio ?? (pk < ki ? 'Ki insuficiente' : null), pede: null }
  }
  for (const tecnica of f.tecnicas) {
    if (tecnica.barreira > 0 && tecnica.uso !== 'acao') opcoes.push(opcao(`barreira:${tecnica.id}`, `Barreira: ${tecnica.nome} (CA +${tecnica.barreira})`, custoDe(tecnica, tecnica.ki), true, null))
    if (tecnica.defensiva) opcoes.push(opcao(`defensiva:${tecnica.id}`, `Defensiva: ${tecnica.nome}`, custoDe(tecnica, tecnica.ki), true, null))
    if (tecnicaOfensiva(tecnica) && (tecnica.reativa || tecnica.uso !== 'acao')) {
      const funda = janela.profundidade + 1 > PROFUNDIDADE_DE_REACAO_MAX ? 'Reações em cadeia demais' : temCondicao(reator, 'paralisado') ? 'Paralisado' : null
      opcoes.push(opcao(`reativa:${tecnica.id}`, `Reativa: ${tecnica.nome}`, custoDe(tecnica, tecnica.ki), false, funda))
    }
    if (reatorId === janela.ataque.alvoId && tecnicaOfensiva(tecnica) && tecnica.uso !== 'reacao') {
      const custo = custoDoChoque(reator, tecnica)
      const bloqueio = bloqueioDoChoque(t, janela.ataque, reatorId, tecnica)
      // Sem Ki o Choque vira débito (9.5.6); só a Reativa precisa ter o Ki.
      opcoes.push({ chave: `choque:${tecnica.id}`, rotulo: `Choque de Poder: ${tecnica.nome}`, ki: custo, gratis: false, bloqueio, pede: null })
    }
  }
  for (const movimento of f.movimentos) {
    if (movimento.reacao && movimento.ki !== null) opcoes.push(opcao(`movimento:${movimento.id}`, `${movimento.nome}`, custoEfetivo(movimento.ki, { sobrecarregado: false, reacaoDobrada: dobro, choque: false }), false, null))
  }
  return opcoes
}

function tipoDaReacao(chave: string): ReacaoEscolhida['tipo'] {
  const prefixo = chave.split(':')[0]
  if (prefixo === 'barreira' || prefixo === 'defensiva' || prefixo === 'reativa' || prefixo === 'choque' || prefixo === 'movimento') return prefixo
  return 'livre'
}

/**
 * Resposta de um combatente à janela: "Reagir também" (`entrar`), "Não
 * reagir" ou uma reação. Todos responderam: resolve. Devolve a recusa, ou null.
 */
export function responderJanela(t: Trabalho, pendencia: Pendencia, reatorId: IdDoCombatente, chave: string): string | null {
  if (pendencia.tipo !== 'reacao') return 'Não é uma janela de reação'
  const { janela } = pendencia
  const opcoes = opcoesDeReacao(t, janela, reatorId)
  const convidado = janela.convidados.includes(reatorId)
  if (chave === 'entrar') {
    if (convidado || reatorId === janela.ataque.atacanteId) return 'Já está na janela'
    if (!opcoes.some((opcao) => opcao.chave !== 'nao' && opcao.bloqueio === null)) return 'Sem reação pagável'
    trocarPendencia(t, { ...pendencia, janela: { ...janela, convidados: [...janela.convidados, reatorId] } })
    escrever(t, `${nomeDe(t, reatorId)} entra na reação`)
    return null
  }
  if (!convidado) return 'Não está na janela'
  if (Object.hasOwn(janela.respostas, reatorId)) return 'Já respondeu'
  const escolhida = opcoes.find((opcao) => opcao.chave === chave)
  if (escolhida === undefined) return 'Reação fora das opções'
  if (escolhida.bloqueio !== null) return escolhida.bloqueio
  const tecnicaId = chave.includes(':') ? chave.slice(chave.indexOf(':') + 1) : null
  const resposta: 'nao' | readonly ReacaoEscolhida[] = chave === 'nao' ? 'nao' : [{ chave, tipo: tipoDaReacao(chave), tecnicaId, ki: escolhida.gratis ? 0 : escolhida.ki }]
  const nova: JanelaDeReacao = { ...janela, respostas: { ...janela.respostas, [reatorId]: resposta } }
  tipoDaLinha(t, 'reacao')
  escrever(t, `${nomeDe(t, reatorId)}: ${escolhida.rotulo}`)
  if (nova.convidados.every((id) => Object.hasOwn(nova.respostas, id))) {
    tirarPendencia(t, pendencia.id)
    resolverJanela(t, nova)
    return null
  }
  trocarPendencia(t, { ...pendencia, janela: nova })
  return null
}

/** Barreira recalcula o ataque aberto (ambiguidade 27): nova CA, margem e faixa (crítico e 1 natural ficam). */
function contraANovaCA(t: Trabalho, ataque: AtaqueResolvido): AtaqueResolvido {
  const alvo = combatente(t, ataque.alvoId)
  if (alvo === undefined || ataque.rolagem === null || ataque.critico || ataque.erroCritico || ataque.ca === 0) return ataque
  const ca = caEfetiva(alvo, fichaDe(t, alvo))
  const margem = ataque.rolagem.total - ca
  const faixa = faixaDaMargem(margem, ataque.difEP)
  return { ...ataque, ca, margem, faixa, danoPrevisto: previstoDe(t, ataque, faixa, false) }
}

/**
 * Fecha a janela (8): alvo primeiro, depois a iniciativa; o Ki das reações é
 * cobrado AQUI. Choque do alvo substitui o ataque. Manual (ou talento com
 * mitigação digitada): cartão de resolução; senão aplica.
 */
export function resolverJanela(t: Trabalho, janela: JanelaDeReacao): void {
  const { ataque } = janela
  const respostaDoAlvo = janela.respostas[ataque.alvoId]
  const choque = respostaDoAlvo === undefined || respostaDoAlvo === 'nao' ? undefined : respostaDoAlvo.find((escolha) => escolha.tipo === 'choque')
  const idDoChoque = choque?.tecnicaId ?? null
  const tecnicaDoChoque = idDoChoque === null ? undefined : tecnicaDe(t, ataque.alvoId, idDoChoque)
  if (tecnicaDoChoque !== undefined) {
    abrirChoque(t, ataque, ataque.alvoId, tecnicaDoChoque)
    return
  }
  let mitigacao = ataque.mitigacao
  let barreira = false
  let digitada = false
  const reativas: { reatorId: IdDoCombatente; tecnica: TecnicaLida }[] = []
  const ordem = [ataque.alvoId, ...emOrdemDeIniciativa(t, janela.convidados.filter((id) => id !== ataque.alvoId))]
  for (const reatorId of ordem) {
    const escolhas = janela.respostas[reatorId]
    const reator = combatente(t, reatorId)
    const f = fichaDe(t, reator)
    if (escolhas === undefined || escolhas === 'nao' || reator === undefined || f === null) continue
    for (const escolha of escolhas) {
      const tecnica = escolha.tecnicaId === null ? undefined : tecnicaDe(t, reatorId, escolha.tecnicaId)
      if (escolha.tipo === 'reativa') {
        if (tecnica !== undefined) reativas.push({ reatorId, tecnica })
        continue
      }
      const antes = pkDe(t, f)
      if (antes < escolha.ki) {
        escrever(t, `${reator.nome} não tem Ki para ${escolha.chave}: a reação se perde`)
        continue
      }
      if (escolha.ki > 0) porRecurso(t, f, 'pk', antes - escolha.ki)
      if ((escolha.tipo === 'barreira' || escolha.tipo === 'defensiva') && tecnica !== undefined) contarTecnicaPaga(t, reatorId, tecnica, escolha.ki > 0 && tecnica.tipo === 'ki')
      if (escolha.tipo === 'barreira' && tecnica !== undefined) {
        const temporario = { id: t.ctx.gerarId(), rotulo: `Barreira (${tecnica.nome})`, acerto: 0, ca: tecnica.barreira, dano: 0, ateRodada: null, ateInicioDoTurno: reator.turnosJogados + 1 }
        mudarCombatente(t, reatorId, (atual) => ({ ...atual, temporarios: [...atual.temporarios, temporario] }))
        escrever(t, `${reator.nome} ergue ${tecnica.nome}: CA +${tecnica.barreira}`)
        barreira = true
      }
      if (escolha.tipo === 'defensiva' && tecnica !== undefined) {
        t.comD20 = true
        const { d20 } = rolarComVantagem(temCondicao(reator, 'envenenado') ? -1 : 0, t.ctx.rolar)
        const rolagem = d20 + modEfetivo(reator, f, tecnica.atributoDeAcerto) + epTotal(reator, f) + somaDosTemporarios(reator, 'acerto')
        const contra = ataque.rolagem?.total ?? ataque.salvaguarda?.cd ?? 0
        const faixa = faixaInvertida(rolagem, contra)
        const valor = danoDaFaixa(tecnica.dano, faixa)
        mitigacao += valor
        escrever(t, `${reator.nome} defende com ${tecnica.nome}: d20 ${d20}, ${rolagem} vs ${contra} -> ${NOME_DA_FAIXA[faixa]}, mitiga ${valor}`, `${reator.nome} defende com ${tecnica.nome}: d20 ${d20} (${NOME_DA_FAIXA[faixa]})`)
      }
      if (escolha.tipo === 'movimento') {
        digitada = true
        escrever(t, `${reator.nome} usa ${escolha.chave.slice(escolha.chave.indexOf(':') + 1)}: o mestre digita a mitigação`)
      }
      conferirKiZerado(t, reatorId, pkDe(t, f))
    }
  }
  let final: AtaqueResolvido = { ...ataque, mitigacao }
  if (barreira) final = contraANovaCA(t, final)
  const iniciarReativas = (): void => {
    for (const { reatorId, tecnica } of reativas) {
      iniciarAtaque(t, { atacanteId: reatorId, alvos: [ataque.atacanteId], tecnica, modo: 'dano', basicos: 1, cargasKi: 0, profundidade: ataque.profundidade + 1, gratis: false, semJanela: false, reacao: true })
    }
  }
  if (t.nucleo.opcoes.modo === 'manual' || digitada) {
    iniciarReativas()
    porPendencia(t, { id: t.ctx.gerarId(), responde: { tipo: 'mestre' }, tipo: 'confirmar', etapa: 'resolucao', ataque: final }, true)
    return
  }
  aplicarResultado(t, final, undefined)
  iniciarReativas()
}

function nivelDoGatilho(falha: number): number {
  return NIVEIS_DO_GATILHO.find(([minimo]) => falha >= minimo)?.[1] ?? 0
}

/** Aplica o resultado (7.4 passo 6), na ordem do plano. */
export function aplicarResultado(t: Trabalho, ataque: AtaqueResolvido, edicoes: EdicoesDoMestre | undefined): void {
  const atacante = combatente(t, ataque.atacanteId)
  const alvo = combatente(t, ataque.alvoId)
  if (atacante === undefined || alvo === undefined) return
  const tecnica = tecnicaDe(t, ataque.atacanteId, ataque.tecnica.id)
  if (ataque.modo === 'agarrar') {
    if (ataque.faixa === 'erro') return
    const teste: TesteAgendado = { id: t.ctx.gerarId(), combatenteId: alvo.id, motivo: 'agarrao', atributos: ['des', 'for'], contra: ataque.rolagem?.total ?? 0, resistido: true, outroId: atacante.id }
    porPendencia(t, { id: t.ctx.gerarId(), responde: alvo.npc ? { tipo: 'mestre' } : { tipo: 'combatente', id: alvo.id }, tipo: 'teste', teste }, true)
    escrever(t, `${atacante.nome} tenta agarrar ${alvo.nome}: teste de DES ou FOR contra ${teste.contra}`)
    return
  }
  const calculado = Math.max(0, ataque.danoPrevisto - ataque.mitigacao)
  const danoFinal = edicoes?.aplicarDano === false ? 0 : Math.max(0, Math.trunc(edicoes?.dano ?? calculado))
  if (danoFinal > 0) {
    const critico = ataque.critico ? ', crítico' : ''
    sofrerDano(t, alvo.id, danoFinal, `${ataque.tecnica.nome}, ${NOME_DA_FAIXA[ataque.faixa]}${critico}${ataque.mitigacao > 0 ? `, mitigou ${ataque.mitigacao}` : ''}`, `${ataque.tecnica.nome}, ${NOME_DA_FAIXA[ataque.faixa]}${critico}`)
    const controle = alvo.condicoes.find((ativa) => ativa.condicao === 'controle-mental')
    if (controle !== undefined) tirarCondicao(t, alvo.id, controle.id, 'dano direto')
    for (const preso of Object.values(t.nucleo.combatentes)) {
      if (preso.agarrado?.porId !== alvo.id) continue
      const teste: TesteAgendado = { id: t.ctx.gerarId(), combatenteId: preso.id, motivo: 'soltar', atributos: ['des', 'for'], contra: preso.agarrado.acerto, resistido: true, outroId: alvo.id }
      porPendencia(t, { id: t.ctx.gerarId(), responde: preso.npc ? { tipo: 'mestre' } : { tipo: 'combatente', id: preso.id }, tipo: 'teste', teste }, true)
    }
  } else escrever(t, `${alvo.nome} não sofre dano`)
  // As marcas do mestre já estão em `aplicar` (editarAtaque): o índice do cartão pode não bater com a lista refeita.
  ataque.efeitos.forEach((previsto) => {
    if (!previsto.aplicar) return
    if (previsto.tipo === 'instavel' && danoFinal > 0) sofrerDano(t, atacante.id, Math.floor(danoFinal / 2), 'Instável', 'Instável')
    if (previsto.tipo === 'condicao' && previsto.condicao !== null && (danoFinal > 0 || ataque.danoCompleto === 0)) {
      // Quebrado: técnica física quebra a FOR; as outras, a CON (seção 10).
      const extra: CondicaoAtiva['extra'] = previsto.condicao === 'quebrado' ? { atributo: ataque.tecnica.tipo === 'fisica' ? 'for' : 'con' } : undefined
      aplicarCondicao(t, alvo.id, {
        condicao: previsto.condicao,
        origem: { combatenteId: atacante.id, tecnicaId: ataque.tecnica.id, tecnicaNome: ataque.tecnica.nome, kiDaTecnica: tecnica?.ki ?? ataque.tecnica.ki },
        cd: previsto.cd,
        extra,
      })
    }
    if (previsto.tipo === 'gatilho' && ataque.rolagem !== null) {
      // Sem EP no teste do alvo: "não afetado pela escala" (ambiguidade 21).
      const teste = testeDeAtributo(t, alvo.id, ['con'], ataque.rolagem.total, false)
      const nivel = nivelDoGatilho(ataque.rolagem.total - teste.total)
      escrever(t, nivel === 0 ? `${alvo.nome} resiste ao ${previsto.texto}` : `${previsto.texto}: nível ${nivel} em ${alvo.nome} (d20 ${teste.d20}); o mestre aplica o efeito`)
    }
    if (previsto.tipo === 'quebraArmadura') escrever(t, `Crítico: a armadura de ${alvo.nome} se quebra (o mestre ajusta a ficha)`, '')
  })
}

/** Técnica de cura (6.2): rolagem contra a CA do aliado, escala invertida; nunca em si; sem janela. */
export function curarComTecnica(t: Trabalho, curadorId: IdDoCombatente, aliadoId: IdDoCombatente, tecnica: TecnicaLida): void {
  const curador = combatente(t, curadorId)
  const aliado = combatente(t, aliadoId)
  const f = fichaDe(t, curador)
  if (curador === undefined || aliado === undefined) return
  t.comD20 = true
  const { d20 } = rolarComVantagem(temCondicao(curador, 'envenenado') ? -1 : 0, t.ctx.rolar)
  const total = d20 + modEfetivo(curador, f, tecnica.atributoDeAcerto) + epTotal(curador, f) + somaDosTemporarios(curador, 'acerto')
  const ca = caEfetiva(aliado, fichaDe(t, aliado))
  const faixa = faixaInvertida(total, ca)
  escrever(t, `${curador.nome} cura ${aliado.nome} com ${tecnica.nome}: d20 ${d20}, ${total} vs CA ${ca} -> ${NOME_DA_FAIXA[faixa]}`, `${curador.nome} cura ${aliado.nome} com ${tecnica.nome}: d20 ${d20}`)
  curar(t, aliadoId, danoDaFaixa(tecnica.dano, faixa), tecnica.nome)
}

/** Barreira como ação (6.2): CA + n até o início do próximo turno; uma por turno. */
export function barreiraNaAcao(t: Trabalho, id: IdDoCombatente, tecnica: TecnicaLida): void {
  const c = combatente(t, id)
  if (c === undefined) return
  const temporario = { id: t.ctx.gerarId(), rotulo: `Barreira (${tecnica.nome})`, acerto: 0, ca: tecnica.barreira, dano: 0, ateRodada: null, ateInicioDoTurno: c.turnosJogados + 1 }
  mudarCombatente(t, id, (atual) => ({ ...atual, temporarios: [...atual.temporarios, temporario] }))
  const turno = t.nucleo.turno
  if (turno !== null) t.nucleo = { ...t.nucleo, turno: { ...turno, barreiraUsada: true } }
  escrever(t, `${c.nome} ergue ${tecnica.nome}: CA +${tecnica.barreira} até o próximo turno`)
}

/** A marca do mestre pelo TIPO do efeito (`true` aplica, `false` desliga); tipo ausente = a marca de sempre. */
export type MarcasDosEfeitosPorTipo = Partial<Record<EfeitoPrevisto['tipo'], boolean>>

/**
 * As edições do cartão do modo manual mais a marca por tipo. Por tipo porque
 * o efeito que ENTRA com o crítico ou a margem trocados (a quebra de armadura,
 * o gatilho) não tem índice na lista que o cartão abriu, e o mestre precisa
 * poder desligá-lo também. O comando leva `EdicoesDoMestre`; um objeto deste
 * tipo cabe ali como está e chega inteiro aqui.
 */
export interface EdicoesDoAtaqueDBT extends EdicoesDoMestre {
  aplicarEfeitosPorTipo?: MarcasDosEfeitosPorTipo
}

/**
 * Cartão do modo manual, etapa ataque (seção 15): o mestre troca d20, CA,
 * faixa, crítico ou dano; o resto se recalcula a partir do que mudou.
 * Marcas dos efeitos: na lista antiga, o índice manda e o tipo vem depois;
 * na lista refeita, o tipo manda (é a única marca que alcança o efeito novo).
 */
export function editarAtaque(t: Trabalho, ataque: AtaqueResolvido, edicoes: EdicoesDoAtaqueDBT): AtaqueResolvido {
  const alvo = combatente(t, ataque.alvoId)
  const tecnica = tecnicaDe(t, ataque.atacanteId, ataque.tecnica.id)
  let novo = ataque
  if (edicoes.d20 !== undefined && ataque.rolagem !== null && Number.isFinite(edicoes.d20)) {
    const d20 = Math.min(20, Math.max(1, Math.trunc(edicoes.d20)))
    const total = ataque.rolagem.total - ataque.rolagem.d20 + d20
    const erroCritico = d20 === 1
    const critico = !erroCritico && alvo !== undefined && d20 >= criticoAPartirDe(tecnica?.golpeCritico ?? 0, temCondicao(alvo, 'exposto'))
    novo = { ...novo, rolagem: { ...ataque.rolagem, d20, dados: [d20], total, digitada: true }, erroCritico, critico, margem: total - (novo.ca ?? 0) }
  }
  if (edicoes.ca !== undefined && Number.isFinite(edicoes.ca) && novo.rolagem !== null) novo = { ...novo, ca: Math.trunc(edicoes.ca), margem: novo.rolagem.total - Math.trunc(edicoes.ca) }
  // O crítico marcado à mão vem antes da faixa: marcar = Completo x2; desmarcar volta à faixa da margem.
  if (edicoes.critico !== undefined) novo = { ...novo, critico: edicoes.critico, erroCritico: edicoes.critico ? false : novo.erroCritico }
  let faixa: Faixa = novo.erroCritico ? 'erro' : novo.critico ? 'completo' : novo.rolagem === null ? novo.faixa : faixaDaMargem(novo.margem, novo.difEP)
  if (edicoes.faixa !== undefined) faixa = edicoes.faixa
  novo = { ...novo, faixa }
  novo = { ...novo, danoPrevisto: previstoDe(t, novo, faixa, novo.critico) }
  if (edicoes.dano !== undefined && Number.isFinite(edicoes.dano)) novo = { ...novo, danoPrevisto: Math.max(0, Math.trunc(edicoes.dano)) }
  if (edicoes.mitigacao !== undefined && Number.isFinite(edicoes.mitigacao)) novo = { ...novo, mitigacao: Math.max(0, Math.trunc(edicoes.mitigacao)) }
  // As marcas do mestre são pelos índices do cartão (a lista antiga); a marca por tipo vale onde o índice não diz nada.
  const porTipo = edicoes.aplicarEfeitosPorTipo ?? {}
  const marcados = ataque.efeitos.map((previsto, indice) => ({ ...previsto, aplicar: edicoes.aplicarEfeitos?.[indice] ?? porTipo[previsto.tipo] ?? previsto.aplicar }))
  if (tecnica === undefined || (novo.critico === ataque.critico && novo.margem === ataque.margem)) return { ...novo, efeitos: marcados }
  // Gatilho e quebra de armadura dependem do crítico e da margem: refaz. O efeito que entrou agora só tem a marca por tipo.
  const refeitos = efeitosPrevistos(t, ataque.atacanteId, tecnica, novo.critico, novo.margem)
  return {
    ...novo,
    efeitos: refeitos.map((previsto) => ({ ...previsto, aplicar: porTipo[previsto.tipo] ?? marcados.find((antigo) => antigo.tipo === previsto.tipo)?.aplicar ?? previsto.aplicar })),
  }
}
