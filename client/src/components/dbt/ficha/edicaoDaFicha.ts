/**
 * FICHA DRAGON BALL — as contas da TELA (fase 2 do plano
 * docs/planos/sistema-dragon-ball.md). Puro: recebe o Personagem e devolve o
 * próximo. As regras do livro moram em lib/dbt/regras/; aqui fica só o que a
 * ficha precisa para editar: catálogos indexados, pontos de criação, máximos
 * gravados, técnica pronta ligada aos rótulos do livro, descanso longo.
 */
import { MOVIMENTOS_MARCIAIS } from '../../../lib/dbt/dados/movimentosMarciais'
import { RACAS } from '../../../lib/dbt/dados/racas'
import { RANKS_DE_TECNICA } from '../../../lib/dbt/dados/ranks'
import { ROTULOS } from '../../../lib/dbt/dados/rotulos'
import { VIDA_POR_GOLPE } from '../../../lib/dbt/dados/tabelas'
import { TALENTOS } from '../../../lib/dbt/dados/talentos'
import {
  ATRIBUTO_INICIAL,
  IDS_DOS_RECURSOS,
  RANKS,
  fichaDBTVazia,
  type AumentoDeAtributoDBT,
  type FichaDBT,
  type IdAtributoDBT,
  type MovimentoMarcialDBT,
  type NpcDaFichaDBT,
  type RacaDBT,
  type RankDBT,
  type RankDeTecnica,
  type RotuloDBT,
  type RotuloEscolhidoDBT,
  type TalentoDBT,
  type TecnicaDBT,
  type TecnicaProntaDBT,
  type TracoDBT,
  type VarianteDeRacaDBT,
} from '../../../lib/dbt/modelo'
import { type DerivadosDaFichaDBT, PDL_DO_MARCO_DE_ATRIBUTO, PONTOS_POR_MARCO_DE_ATRIBUTO, aumentosDaFicha, derivadosDaFicha, marcosPassados, maximosDosRecursos } from '../../../lib/dbt/regras/ficha'
import { tecnicaDaPronta } from '../../../lib/dbt/regras/npc'
import { type TabelaDeRanksDBT, catalogoDeRotulos, indexarRanks, nomeNormalizado } from '../../../lib/dbt/regras/tecnicas'
import { ativarTransformacao, desativarTransformacao } from '../../../lib/dbt/regras/transformacoes'
import type { Personagem, TipoDePersonagem } from '../../../lib/personagem'

// ───────────────────────────────────────────────────────────────────────────
// Catálogos indexados
// ───────────────────────────────────────────────────────────────────────────

/** Pontos para distribuir na criação, por cima do 8 de cada atributo (3.0.2, p. 12). */
export const PONTOS_DE_CRIACAO = 28
/** NPC não tem orçamento: o livro só dá guia por categoria (4.0.4). Teto para o stepper não fugir. */
export const ATRIBUTO_DO_NPC_MIN = 1
export const ATRIBUTO_DO_NPC_MAX = 40
/** Teto do ND no stepper (o leitor do disco aceita até 1000). */
export const ND_MAX = 99

/** Tabela completa mesmo com catálogo torto: rank que faltar usa a primeira linha (os dados gerados têm os seis). */
function tabelaDeRanks(): TabelaDeRanksDBT {
  const indexada = indexarRanks(RANKS_DE_TECNICA)
  if (indexada !== null) return indexada
  const primeira = RANKS_DE_TECNICA[0]
  const linha = (rank: RankDBT): RankDeTecnica => RANKS_DE_TECNICA.find((r) => r.rank === rank) ?? { ...primeira, rank }
  return { E: linha('E'), D: linha('D'), C: linha('C'), B: linha('B'), A: linha('A'), Z: linha('Z') }
}

export const RANKS_DBT: TabelaDeRanksDBT = tabelaDeRanks()
export const LINHAS_DE_RANK: readonly RankDeTecnica[] = RANKS.map((rank) => RANKS_DBT[rank])
export const ROTULOS_POR_ID: ReadonlyMap<string, RotuloDBT> = catalogoDeRotulos(ROTULOS)
const RACAS_POR_ID: ReadonlyMap<string, RacaDBT> = new Map(RACAS.map((raca) => [raca.id, raca]))
const TALENTOS_POR_ID: ReadonlyMap<string, TalentoDBT> = new Map(TALENTOS.map((t) => [t.id, t]))
const MOVIMENTOS_POR_ID: ReadonlyMap<string, MovimentoMarcialDBT> = new Map(MOVIMENTOS_MARCIAIS.map((m) => [m.id, m]))

/** Pacote de técnicas não é raça: só oferece técnicas a quem já é da raça base. */
export const RACAS_DO_BASICO: readonly RacaDBT[] = RACAS.filter((raca) => raca.tipo !== 'pacote-de-tecnicas' && raca.fonte === 'basico')
export const RACAS_DOS_SUPLEMENTOS: readonly RacaDBT[] = RACAS.filter((raca) => raca.tipo !== 'pacote-de-tecnicas' && raca.fonte === 'suplemento').sort((a, b) =>
  a.nome.localeCompare(b.nome, 'pt-BR'),
)

export function racaPorId(id: string): RacaDBT | null {
  return RACAS_POR_ID.get(id) ?? null
}

export function talentoPorId(id: string | null): TalentoDBT | null {
  return id === null ? null : (TALENTOS_POR_ID.get(id) ?? null)
}

export function movimentoPorId(id: string | null): MovimentoMarcialDBT | null {
  return id === null ? null : (MOVIMENTOS_POR_ID.get(id) ?? null)
}

/** A raça do catálogo da ficha; raça livre ou sem raça = null. */
export function racaDaFicha(ficha: FichaDBT): RacaDBT | null {
  if (ficha.racaLivre !== null || ficha.raca === '') return null
  return racaPorId(ficha.raca)
}

export function varianteDaFicha(ficha: FichaDBT, raca: RacaDBT | null): VarianteDeRacaDBT | null {
  if (raca === null || ficha.variante === '') return null
  return raca.variantes.find((variante) => variante.id === ficha.variante) ?? null
}

/** Os pacotes de técnicas dos suplementos para a raça base (Namek Guerreiro para Namekuseijin...). */
export function pacotesDaRaca(racaId: string): RacaDBT[] {
  if (racaId === '') return []
  return RACAS.filter((raca) => raca.tipo === 'pacote-de-tecnicas' && raca.racaBase === racaId)
}

/** Técnicas prontas que a raça oferece: as dela e as dos pacotes, com a origem para a tela. */
export function tecnicasProntasDaRaca(raca: RacaDBT | null): { origem: string; tecnica: TecnicaProntaDBT }[] {
  if (raca === null) return []
  const proprias = raca.tecnicas.map((tecnica) => ({ origem: raca.nome, tecnica }))
  const dosPacotes = pacotesDaRaca(raca.id).flatMap((pacote) => pacote.tecnicas.map((tecnica) => ({ origem: pacote.nome, tecnica })))
  return [...proprias, ...dosPacotes]
}

export interface CaracteristicaDaRaca {
  traco: TracoDBT
  /** Nome da variante que o requisito pede quando NÃO é a da ficha; null = vale para esta ficha. */
  deOutraVariante: string | null
}

/**
 * Características especiais com o requisito lido: quando o requisito é o nome
 * de uma variante da raça ("Humano Cientista"), só vale para ela. Requisito
 * que não é variante ("PDL 30.000") vale para todos e aparece escrito.
 */
export function caracteristicasDaRaca(raca: RacaDBT, variante: VarianteDeRacaDBT | null): CaracteristicaDaRaca[] {
  return raca.caracteristicasEspeciais.map((traco) => {
    if (traco.requisito === null) return { traco, deOutraVariante: null }
    const pedido = nomeNormalizado(traco.requisito)
    const daVariante = raca.variantes.find((v) => nomeNormalizado(v.nome) === pedido)
    if (daVariante === undefined || (variante !== null && daVariante.id === variante.id)) return { traco, deOutraVariante: null }
    return { traco, deOutraVariante: daVariante.nome }
  })
}

// ───────────────────────────────────────────────────────────────────────────
// A ficha do personagem e os derivados
// ───────────────────────────────────────────────────────────────────────────

export const NPC_PADRAO: NpcDaFichaDBT = { nd: null, categoria: 'comum', rank: 'E', passivas: [], prontoId: null }

/** A ficha estruturada; personagem de antes da ficha nova (sem `dbt`) lê como ficha vazia. */
export function fichaDe(personagem: Personagem): FichaDBT {
  return personagem.dbt ?? fichaDBTVazia()
}

/** NPC sem o bloco ainda (criado como NPC antes da ficha nova): conta com o bloco padrão, ND por escolher. */
export function fichaParaConta(personagem: Personagem): FichaDBT {
  const ficha = fichaDe(personagem)
  if (personagem.tipo !== 'npc' || ficha.npc !== undefined) return ficha
  return { ...ficha, npc: NPC_PADRAO }
}

export function derivadosDe(personagem: Personagem): DerivadosDaFichaDBT {
  const ficha = fichaParaConta(personagem)
  return derivadosDaFicha(ficha, personagem.atributos, { raca: racaDaFicha(ficha), ranks: RANKS_DBT, vidaPorGolpe: VIDA_POR_GOLPE })
}

/**
 * Grava os máximos de PV e PK da regra (o ajuste à mão em `ajustes` já vence
 * dentro de `derivadosDaFicha`). Máximo que SOBE leva o atual junto (subiu a
 * CON: a vida nova chega cheia); o atual nunca passa do máximo. Se a mudança
 * foi no próprio atual (digitado), só limita. Sem mudança devolve a MESMA referência.
 */
export function comMaximosDaRegra(anterior: Personagem, proximo: Personagem): Personagem {
  const alvo = maximosDosRecursos(derivadosDe(proximo))
  let saida = proximo
  for (const id of IDS_DOS_RECURSOS) {
    const novo = alvo[id]
    const antigo = anterior.maximos[id] ?? anterior.recursos[id] ?? 0
    const digitado = (proximo.recursos[id] ?? 0) !== (anterior.recursos[id] ?? 0)
    let atual = proximo.recursos[id] ?? 0
    if (!digitado && novo > antigo) atual += novo - antigo
    atual = Math.min(novo, Math.max(0, atual))
    if (saida.maximos[id] === novo && saida.recursos[id] === atual) continue
    saida = { ...saida, maximos: { ...saida.maximos, [id]: novo }, recursos: { ...saida.recursos, [id]: atual } }
  }
  return saida
}

/** Troca a ficha estruturada do personagem. */
export function comFicha(personagem: Personagem, mudar: (ficha: FichaDBT) => FichaDBT): Personagem {
  return { ...personagem, dbt: mudar(fichaDe(personagem)) }
}

/** Jogador ou NPC (decisão do mestre). NPC ganha o bloco de ND; jogador perde (o modelo: "ausente no jogador"). */
export function comTipo(personagem: Personagem, tipo: TipoDePersonagem): Personagem {
  if (personagem.tipo === tipo) return personagem
  const ficha = fichaDe(personagem)
  if (tipo === 'npc') return { ...personagem, tipo, dbt: ficha.npc === undefined ? { ...ficha, npc: NPC_PADRAO } : ficha }
  const { npc: _semNpc, ...semNpc } = ficha
  return { ...personagem, tipo, dbt: semNpc }
}

// ───────────────────────────────────────────────────────────────────────────
// Atributos: 28 pontos na criação + marcos de 30.000 PDL
// ───────────────────────────────────────────────────────────────────────────

export function valorDe(personagem: Personagem, id: IdAtributoDBT): number {
  const valor = personagem.atributos[id]
  return Number.isFinite(valor) ? valor : ATRIBUTO_INICIAL
}

export interface PontosDosAtributos {
  /** Pontos da criação gastos: a soma acima de 8 menos o que veio dos marcos. */
  criacaoUsados: number
  criacaoTotal: number
  marcosTotal: number
  marcosGastos: number
  /** Ainda por distribuir (criação + marcos); negativo = passou. */
  livres: number
}

export function pontosDosAtributos(personagem: Personagem, ids: readonly IdAtributoDBT[]): PontosDosAtributos {
  const ficha = fichaDe(personagem)
  const acima = ids.reduce((soma, id) => soma + (valorDe(personagem, id) - ATRIBUTO_INICIAL), 0)
  const marcos = aumentosDaFicha(ficha)
  const criacaoUsados = acima - marcos.gastos
  return {
    criacaoUsados,
    criacaoTotal: PONTOS_DE_CRIACAO,
    marcosTotal: marcos.total,
    marcosGastos: marcos.gastos,
    livres: PONTOS_DE_CRIACAO - criacaoUsados + marcos.restantes,
  }
}

/** O primeiro marco de 30.000 já passado com ponto sobrando (cada marco dá 2). null = nenhum. */
function marcoComSobra(ficha: FichaDBT): number | null {
  const passados = marcosPassados(ficha.pdl, PDL_DO_MARCO_DE_ATRIBUTO)
  for (let marco = 1; marco <= passados; marco += 1) {
    const gastos = ficha.aumentos.filter((a) => a.marco === marco).reduce((soma, a) => soma + a.pontos, 0)
    if (gastos < PONTOS_POR_MARCO_DE_ATRIBUTO) return marco
  }
  return null
}

function comAtributo(personagem: Personagem, id: IdAtributoDBT, valor: number): Personagem {
  return { ...personagem, atributos: { ...personagem.atributos, [id]: valor } }
}

/**
 * +1 no atributo do jogador: primeiro gasta os 28 da criação; acabaram, gasta
 * o marco de 30.000 e registra em `aumentos` (+1 de novo no mesmo marco e
 * atributo vira o "+2 em um"). Sem ponto livre devolve o mesmo personagem.
 */
export function subirAtributo(personagem: Personagem, id: IdAtributoDBT, ids: readonly IdAtributoDBT[]): Personagem {
  const pontos = pontosDosAtributos(personagem, ids)
  const valor = valorDe(personagem, id)
  if (pontos.criacaoUsados < PONTOS_DE_CRIACAO) return comAtributo(personagem, id, valor + 1)
  const ficha = fichaDe(personagem)
  const marco = marcoComSobra(ficha)
  if (marco === null) return personagem
  const mesmo = ficha.aumentos.findIndex((a) => a.marco === marco && a.atributo === id && a.pontos === 1)
  const aumentos: AumentoDeAtributoDBT[] =
    mesmo >= 0 ? ficha.aumentos.map((a, i) => (i === mesmo ? { ...a, pontos: 2 } : a)) : [...ficha.aumentos, { marco, atributo: id, pontos: 1 }]
  return { ...comAtributo(personagem, id, valor + 1), dbt: { ...ficha, aumentos } }
}

/** −1 no atributo do jogador, nunca abaixo de 8: devolve primeiro o ponto de marco dele, depois o da criação. */
export function descerAtributo(personagem: Personagem, id: IdAtributoDBT): Personagem {
  const valor = valorDe(personagem, id)
  if (valor <= ATRIBUTO_INICIAL) return personagem
  const ficha = fichaDe(personagem)
  let ultimo = -1
  ficha.aumentos.forEach((a, i) => {
    if (a.atributo === id) ultimo = i
  })
  if (ultimo < 0) return comAtributo(personagem, id, valor - 1)
  const alvo = ficha.aumentos[ultimo]
  const aumentos = alvo.pontos === 2 ? ficha.aumentos.map((a, i) => (i === ultimo ? { ...a, pontos: 1 as const } : a)) : ficha.aumentos.filter((_, i) => i !== ultimo)
  return { ...comAtributo(personagem, id, valor - 1), dbt: { ...ficha, aumentos } }
}

export function podeSubirAtributo(personagem: Personagem, ids: readonly IdAtributoDBT[]): boolean {
  const pontos = pontosDosAtributos(personagem, ids)
  return pontos.criacaoUsados < PONTOS_DE_CRIACAO || marcoComSobra(fichaDe(personagem)) !== null
}

/** NPC: valor livre dentro da faixa do stepper; a boa prática por categoria só avisa. */
export function atributoDoNpc(personagem: Personagem, id: IdAtributoDBT, delta: number): Personagem {
  const valor = Math.min(ATRIBUTO_DO_NPC_MAX, Math.max(ATRIBUTO_DO_NPC_MIN, valorDe(personagem, id) + delta))
  return comAtributo(personagem, id, valor)
}

// ───────────────────────────────────────────────────────────────────────────
// Técnica pronta → técnica da ficha com os rótulos do livro
// ───────────────────────────────────────────────────────────────────────────

export function ehRotuloDeTipo(rotulo: RotuloDBT): boolean {
  return rotulo.categoria === 'base' && rotulo.alcance === null && nomeNormalizado(rotulo.nome).startsWith('tecnica')
}

const ROTULOS_NORMALIZADOS: readonly { rotulo: RotuloDBT; nome: string }[] = ROTULOS.map((rotulo) => ({ rotulo, nome: nomeNormalizado(rotulo.nome) }))

/**
 * O rótulo do livro pelo nome impresso na técnica pronta, tolerante: as
 * fichas abreviam ("Estocada" = "Alcance – Estocada", "Fragmentação" =
 * "Técnica de Fragmentação – Ki"). Ordem: nome igual; o do livro termina com
 * o impresso; o do livro contém o impresso (o mais curto vence). null = não achou.
 */
export function rotuloPeloNome(impresso: string): RotuloDBT | null {
  const alvo = nomeNormalizado(impresso)
  if (alvo === '') return null
  const igual = ROTULOS_NORMALIZADOS.find((r) => r.nome === alvo)
  if (igual !== undefined) return igual.rotulo
  const candidatos = ROTULOS_NORMALIZADOS.filter((r) => r.nome.endsWith(` ${alvo}`) || r.nome.startsWith(`${alvo} `) || r.nome.includes(` ${alvo} `))
  const maisCurto = (lista: typeof candidatos) => lista.slice().sort((a, b) => a.nome.length - b.nome.length)[0]?.rotulo ?? null
  const terminaCom = candidatos.filter((r) => r.nome.endsWith(` ${alvo}`))
  return maisCurto(terminaCom) ?? maisCurto(candidatos)
}

export function rotuloEscolhido(rotuloId: string): RotuloEscolhidoDBT {
  return { rotuloId, pontosExtras: 0, variavel: null, investimento: 0, nota: '' }
}

/**
 * Técnica pronta da raça (ou de NPC) na ficha: a conversão de lib/dbt/regras/npc
 * (Ki e faixa impressos vencem a conta) + os rótulos impressos ligados ao
 * livro pelo nome. O tipo impresso não entra na lista (já é o campo Tipo).
 * Jogador recebe a técnica fora dos slots (prepara depois); NPC já pronta.
 */
export function tecnicaProntaNaFicha(pronta: TecnicaProntaDBT, rankPadrao: RankDBT, ehNpc: boolean): TecnicaDBT {
  const base = tecnicaDaPronta(pronta, rankPadrao)
  const rotulos: RotuloEscolhidoDBT[] = []
  for (const nome of [...pronta.rotulosPositivos.nomes, ...pronta.rotulosNegativos.nomes]) {
    const rotulo = rotuloPeloNome(nome)
    if (rotulo === null || ehRotuloDeTipo(rotulo)) continue
    rotulos.push(rotuloEscolhido(rotulo.id))
  }
  // Técnica especial não usa rótulos (p. 87): fica só a descrição.
  return { ...base, rotulos: base.especial === null ? rotulos : [], ativa: ehNpc }
}

/** Mago de Ki libera técnica mágica (p. 61). */
export function temMagoDeKi(ficha: FichaDBT): boolean {
  return ficha.talentos.some((t) => t.livroId === 'tl22' || nomeNormalizado(t.nome) === 'mago de ki')
}

// ───────────────────────────────────────────────────────────────────────────
// Ações de uma vez
// ───────────────────────────────────────────────────────────────────────────

/** PDL somado (negativo corrige), nunca abaixo de 0. */
export function somarPdl(ficha: FichaDBT, delta: number): FichaDBT {
  const pdl = Math.max(0, ficha.pdl + Math.trunc(delta))
  return pdl === ficha.pdl ? ficha : { ...ficha, pdl }
}

/** Descanso longo (8.5.1): o Ki bloqueado sai, PV e PK voltam ao máximo. */
export function descansoLongo(personagem: Personagem, derivados: DerivadosDaFichaDBT): Personagem {
  const ficha = fichaDe(personagem)
  return {
    ...personagem,
    recursos: { ...personagem.recursos, pv: derivados.pvMax.valor, pk: derivados.pkMax.valor },
    dbt: ficha.kiBloqueado === 0 ? ficha : { ...ficha, kiBloqueado: 0 },
  }
}

/** Liga a forma e paga o Ki dela (sem Ki bastante não liga: a tela já desabilita). */
export function ligarForma(personagem: Personagem, id: string): Personagem {
  const ficha = fichaDe(personagem)
  const forma = ficha.transformacoes.find((t) => t.id === id)
  const ki = personagem.recursos.pk ?? 0
  if (forma === undefined || ki < forma.custoKi) return personagem
  return { ...personagem, recursos: { ...personagem.recursos, pk: ki - forma.custoKi }, dbt: ativarTransformacao(ficha, id) }
}

export function desligarForma(personagem: Personagem): Personagem {
  const ficha = fichaDe(personagem)
  const proxima = desativarTransformacao(ficha)
  return proxima === ficha ? personagem : { ...personagem, dbt: proxima }
}

/** "10.000" sem depender do idioma da máquina; negativo com o sinal de menos tipográfico. */
export function numero(n: number): string {
  const texto = String(Math.abs(Math.trunc(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return n < 0 ? `−${texto}` : texto
}

/** "+2", "−1", "+0" (menos tipográfico, como no protótipo). */
export function sinal(n: number): string {
  return n < 0 ? `−${Math.abs(n)}` : `+${n}`
}
