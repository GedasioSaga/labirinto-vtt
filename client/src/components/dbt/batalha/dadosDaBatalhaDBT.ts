import { opcoesDeAcao } from '../../../lib/dbt/batalha/acoes'
import { editarAtaque } from '../../../lib/dbt/batalha/ataque'
import { nomeDaCondicao } from '../../../lib/dbt/batalha/condicoes'
import { caEfetiva, epTotal } from '../../../lib/dbt/batalha/contas'
import { ladosDerrotados, vitoriasAutomaticas } from '../../../lib/dbt/batalha/fim'
import type { FichaLida } from '../../../lib/dbt/batalha/leitura'
import { trabalhoDeLeitura } from '../../../lib/dbt/batalha/motor'
import { opcoesDaPendencia } from '../../../lib/dbt/batalha/pendencias'
import { podeDesfazerDBT, ultimaDePe } from '../../../lib/dbt/batalha/registro'
import type {
  AtaqueResolvido,
  CombatenteDBT,
  EdicoesDoMestre,
  Faixa,
  IdDaCondicao,
  LinhaDBT,
  ModificadorTemporario,
  NivelDeVoo,
  NucleoDBT,
  OpcaoDaPendencia,
  OpcaoDeAcao,
  Pendencia,
  SituacaoDeMorte,
} from '../../../lib/dbt/batalha/tipos'

/**
 * O QUE A TELA DO MESTRE LÊ da batalha DBT (docs/planos/dbt-batalha.md,
 * seção 19): só leitura do núcleo e das fichas lidas. Opções e bloqueios vêm
 * das MESMAS funções do motor (`opcoesDeAcao`, `opcoesDaPendencia`), num
 * trabalho que nunca rola dado: a tela não repete regra nenhuma.
 */

export type Fichas = ReadonlyMap<string, FichaLida | null>

export const NOME_DA_FAIXA: Readonly<Record<Faixa, string>> = { erro: 'Erro', minimo: 'Mínimo', medio: 'Médio', completo: 'Completo' }
export const FAIXAS: readonly Faixa[] = ['erro', 'minimo', 'medio', 'completo']

export const NOME_DA_SITUACAO: Readonly<Record<SituacaoDeMorte, string>> = {
  'de-pe': 'De pé',
  salvaguarda: 'Salvaguarda',
  inconsciente: 'Inconsciente',
  morto: 'Morto',
}

export const NOME_DO_VOO: Readonly<Record<NivelDeVoo, string>> = { 0: 'No chão', 1: 'Voo 1', 2: 'Voo 2', 3: 'Voo 3' }

export interface CondicaoNaCarta {
  id: string
  condicao: IdDaCondicao
  nome: string
}

/** Uma linha da ordem como o mestre vê: tudo o que a carta precisa, sem regra. */
export interface CartaDBT {
  id: string
  nome: string
  lado: string
  npc: boolean
  /** Sem ficha DBT: o mestre resolve tudo à mão. */
  manual: boolean
  vez: boolean
  iniciativa: number | null
  d20: number | null
  pv: { atual: number; max: number } | null
  pk: { atual: number; max: number } | null
  ep: number | null
  ca: number | null
  situacao: SituacaoDeMorte
  condicoes: readonly CondicaoNaCarta[]
  temporarios: readonly ModificadorTemporario[]
  transformacao: string | null
  voo: NivelDeVoo
  agarradoPor: string | null
  perdeTurno: string | null
  reacaoEmDesvantagem: boolean
  acaoOculta: { ki: number; texto: string } | null
  morte: { sucessos: number; falhas: number }
}

export function fichaDoCombatente(c: CombatenteDBT | undefined, fichas: Fichas): FichaLida | null {
  if (c === undefined || c.personagemId === null) return null
  return fichas.get(c.personagemId) ?? null
}

export function nomeDoCombatente(nucleo: NucleoDBT, id: string | null | undefined): string {
  if (id === null || id === undefined) return '?'
  return Object.hasOwn(nucleo.combatentes, id) ? nucleo.combatentes[id].nome : '?'
}

function cartaDe(c: CombatenteDBT, nucleo: NucleoDBT, fichas: Fichas): CartaDBT {
  const f = fichaDoCombatente(c, fichas)
  return {
    id: c.id,
    nome: c.nome,
    lado: c.lado,
    npc: c.npc,
    manual: f === null,
    vez: nucleo.ordem.vez === c.id,
    iniciativa: c.iniciativa?.total ?? null,
    d20: c.iniciativa === null || c.iniciativa.d20 === 0 ? null : c.iniciativa.d20,
    pv: f === null ? null : f.pv,
    pk: f === null ? null : f.pk,
    ep: f === null ? null : epTotal(c, f),
    ca: f === null ? null : caEfetiva(c, f),
    situacao: c.morte.situacao,
    condicoes: c.condicoes.map((ativa) => ({ id: ativa.id, condicao: ativa.condicao, nome: ativa.condicao === 'personalizada' ? ativa.nome : nomeDaCondicao(ativa.condicao) })),
    temporarios: c.temporarios,
    transformacao: c.transformacao?.nome ?? null,
    voo: c.voo,
    agarradoPor: c.agarrado === null ? null : nomeDoCombatente(nucleo, c.agarrado.porId),
    perdeTurno: c.perdeProximoTurno?.motivo ?? null,
    reacaoEmDesvantagem: c.reacaoEmDesvantagem,
    acaoOculta: c.acaoOculta === null ? null : { ki: c.acaoOculta.ki, texto: c.acaoOculta.texto },
    morte: { sucessos: c.morte.sucessos, falhas: c.morte.falhas },
  }
}

/** A ordem da iniciativa; quem não está nas cartas (não devia acontecer) vai ao fim. */
export function cartasDaBatalha(nucleo: NucleoDBT, fichas: Fichas): CartaDBT[] {
  const ids = [...nucleo.ordem.cartas, ...Object.keys(nucleo.combatentes).filter((id) => !nucleo.ordem.cartas.includes(id))]
  return ids.flatMap((id) => (Object.hasOwn(nucleo.combatentes, id) ? [cartaDe(nucleo.combatentes[id], nucleo, fichas)] : []))
}

/** As ações de quem tem a vez, só com a fila vazia (o motor recusaria `agir` com pendência). */
export function opcoesDaVez(nucleo: NucleoDBT, fichas: Fichas): { id: string; opcoes: OpcaoDeAcao[] } | null {
  const vez = nucleo.ordem.vez
  if (nucleo.fase !== 'combate' || vez === null || nucleo.pendencias.length > 0) return null
  return { id: vez, opcoes: opcoesDeAcao(trabalhoDeLeitura(nucleo, fichas), vez) }
}

/** Quem responde quando o mestre clica: o mesmo cálculo de `responder` (pendencias.ts) com `quem = null`. */
export function quemResponde(pendencia: Pendencia): string | null {
  return pendencia.responde.tipo === 'combatente' ? pendencia.responde.id : null
}

/** As respostas que o mestre pode dar por ele (ou por quem ela espera). */
export function opcoesDoMestre(nucleo: NucleoDBT, fichas: Fichas, pendencia: Pendencia): OpcaoDaPendencia[] {
  const id = pendencia.tipo === 'reacao' ? null : quemResponde(pendencia)
  return opcoesDaPendencia(trabalhoDeLeitura(nucleo, fichas), pendencia, id)
}

/** As respostas de um combatente específico (o mestre responde por um NPC que entra na janela). */
export function opcoesDeQuem(nucleo: NucleoDBT, fichas: Fichas, pendencia: Pendencia, id: string): OpcaoDaPendencia[] {
  return opcoesDaPendencia(trabalhoDeLeitura(nucleo, fichas), pendencia, id)
}

/** A prévia do cartão do modo manual: o ataque recalculado com as edições, sem mexer em nada. */
export function previaDoAtaque(nucleo: NucleoDBT, fichas: Fichas, ataque: AtaqueResolvido, edicoes: EdicoesDoMestre): AtaqueResolvido {
  return editarAtaque(trabalhoDeLeitura(nucleo, fichas), ataque, edicoes)
}

/** Para quem a ação mira: inimigo = outro lado; aliado = o mesmo lado, menos ele; sempre sem os mortos. */
export function candidatosDoAlvo(nucleo: NucleoDBT, atorId: string, alvo: OpcaoDeAcao['alvo']): CombatenteDBT[] {
  const ator = Object.hasOwn(nucleo.combatentes, atorId) ? nucleo.combatentes[atorId] : undefined
  if (ator === undefined || alvo === 'nenhum') return []
  const vivos = nucleo.ordem.cartas.flatMap((id) => (Object.hasOwn(nucleo.combatentes, id) && nucleo.combatentes[id].morte.situacao !== 'morto' ? [nucleo.combatentes[id]] : []))
  if (alvo === 'inimigo') return vivos.filter((c) => c.lado !== ator.lado)
  if (alvo === 'aliado') return vivos.filter((c) => c.lado === ator.lado && c.id !== ator.id)
  return vivos.filter((c) => c.id !== ator.id)
}

export interface AvisoDaBatalha {
  id: string
  texto: string
}

/** Avisos que nunca encerram sozinhos (6.3): vitória automática e lado sem ninguém de pé. */
export function avisosDoMestre(nucleo: NucleoDBT, fichas: Fichas): AvisoDaBatalha[] {
  if (nucleo.fase !== 'combate') return []
  const avisos: AvisoDaBatalha[] = vitoriasAutomaticas(nucleo, fichas).map(({ vencedorId, perdedorId }) => ({
    id: `vitoria:${vencedorId}:${perdedorId}`,
    texto: `${nomeDoCombatente(nucleo, vencedorId)} tem o dobro da EP de ${nomeDoCombatente(nucleo, perdedorId)}: vitória automática possível, você decide.`,
  }))
  const lados = new Set(Object.values(nucleo.combatentes).map((c) => c.lado))
  const derrotados = ladosDerrotados(nucleo)
  if (lados.size > 1 && derrotados.length > 0) avisos.push({ id: 'derrotados', texto: `Ninguém de pé no lado ${derrotados.map(nomeDoLado).join(', ')}. Encerrar a batalha?` })
  return avisos
}

export function nomeDoLado(lado: string): string {
  if (lado === 'pj') return 'dos jogadores'
  if (lado === 'npc') return 'dos NPCs'
  return lado
}

/** A linha que o Desfazer volta agora (LIFO), se o mestre pode. */
export function linhaParaDesfazer(registro: readonly LinhaDBT[]): LinhaDBT | null {
  const ultima = ultimaDePe(registro)
  return ultima !== null && podeDesfazerDBT(ultima, { tipo: 'mestre' }, registro) ? ultima : null
}

/** "+3" ou "-1": o sinal sempre à vista na conta. */
export function comSinal(valor: number): string {
  return valor >= 0 ? `+${valor}` : `${valor}`
}

/** O texto curto da pendência, para o título do cartão e para a fila. */
export function tituloDaPendencia(nucleo: NucleoDBT, pendencia: Pendencia): string {
  const nome = (id: string | null | undefined) => nomeDoCombatente(nucleo, id)
  switch (pendencia.tipo) {
    case 'declaracao':
      return 'Transformar antes do combate?'
    case 'confirmar':
      if (pendencia.ataque !== undefined) {
        const { ataque } = pendencia
        const etapa = pendencia.etapa === 'resolucao' ? 'Resolver' : pendencia.etapa === 'especial' ? 'Técnica especial' : 'Confirmar'
        return `${etapa}: ${nome(ataque.atacanteId)}, ${ataque.tecnica.nome} em ${nome(ataque.alvoId)}`
      }
      return pendencia.teste === undefined ? 'Confirmar' : `Confirmar o teste de ${nome(pendencia.teste.combatenteId)}`
    case 'reacao':
      return `${nome(pendencia.janela.ataque.atacanteId)} acerta ${nome(pendencia.janela.ataque.alvoId)} com ${pendencia.janela.ataque.tecnica.nome}`
    case 'teste': {
      const { teste } = pendencia
      if (teste.motivo === 'agarrao') return `${nome(teste.combatenteId)} resiste ao agarrão de ${nome(teste.outroId)}`
      if (teste.motivo === 'soltar') return `${nome(teste.combatenteId)} tenta se soltar de ${nome(teste.outroId)}`
      return `${nome(teste.combatenteId)} tenta estabilizar o voo`
    }
    case 'salvaguarda':
      return `${nome(pendencia.combatenteId)} caiu a 0 PV: salvaguarda contra a morte`
    case 'choque':
      return `Choque de Poder: ${nome(pendencia.choque.atacanteId)} contra ${nome(pendencia.choque.defensorId)}`
    case 'apoioAoChoque':
      return `Choque de ${nome(pendencia.defensorId)}: falta +${pendencia.faltaEP} EP de apoio`
    case 'acaoGratuita': {
      const motivo = pendencia.motivo === 'erroCritico' ? 'erro crítico' : pendencia.motivo === 'oportunidade' ? 'ataque de oportunidade' : 'técnica previsível'
      return `${nome(pendencia.combatenteId)} pode agir de graça contra ${nome(pendencia.contra)} (${motivo})`
    }
    case 'inicioDoTurno':
      return `Início do turno de ${nome(pendencia.combatenteId)}`
    case 'queda':
      return `${nome(pendencia.combatenteId)} está caindo`
    case 'ataqueForcado':
      return `${nome(pendencia.combatenteId)} está confuso e ataca${pendencia.alvoSugerido === null ? '' : ` ${nome(pendencia.alvoSugerido)}`}`
  }
}

/** Uma linha de apoio embaixo do título (números que ajudam a decidir). */
export function detalheDaPendencia(nucleo: NucleoDBT, pendencia: Pendencia): string | null {
  switch (pendencia.tipo) {
    case 'declaracao':
      return `Faltam declarar: ${pendencia.faltam.map((id) => nomeDoCombatente(nucleo, id)).join(', ')}`
    case 'teste':
      return `${pendencia.teste.atributos.map((atributo) => atributo.toUpperCase()).join(' ou ')} contra ${pendencia.teste.contra}${pendencia.teste.resistido ? ' (empate fica como está)' : ''}`
    case 'salvaguarda': {
      const c = Object.hasOwn(nucleo.combatentes, pendencia.combatenteId) ? nucleo.combatentes[pendencia.combatenteId] : undefined
      return c === undefined ? null : `d20 de 10 para cima é sucesso. Sucessos ${c.morte.sucessos} de 3, falhas ${c.morte.falhas} de 3.`
    }
    case 'choque':
      return `Placar ${pendencia.choque.placar.atacante} a ${pendencia.choque.placar.defensor}. O primeiro a 3 vence. Cada ponto apostado custa 5 Ki e soma +1 na rolagem.`
    case 'queda':
      return pendencia.podeEstabilizar ? 'Estabilizar: DES contra CD 15, custa Ki. Cair: 1d20 de dano por nível.' : 'Desequilibrado: cai sem poder estabilizar.'
    default:
      return null
  }
}
