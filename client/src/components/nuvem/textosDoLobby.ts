import type { ContaDeJogador } from '../../lib/contasDosJogadores'
import type { Json } from '../../lib/nuvem/json'
import type { Conflito, MotivoNegado, Op } from '../../lib/nuvem/tipos'
import type { Personagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'

/**
 * OS TEXTOS DO LOBBY NO APP (docs/planos/lobby-jogadores-2026-11-05.md §5.2,
 * §5.6, fatia A6): o que a tela diz sobre uma mudança que espera decisão, o
 * motivo de uma recusa e quem entra no site. Puro: sem store, sem Tauri.
 */

/** Quem publica é o mestre: o nome que o histórico do site mostra nas mudanças do app. */
export const NOME_DO_MESTRE = 'Mestre'

/** O endereço que o jogador abre (decisão do usuário, §2). */
export const ENDERECO_DO_LOBBY = 'labirintolobby.pages.dev'

const ROTULO_FIXO: Readonly<Record<string, string>> = {
  nome: 'Nome',
  descricao: 'Descrição',
  retrato: 'Retrato',
  moedas: 'Moedas',
  dono: 'Dono',
  notaDoMestre: 'Nota do mestre',
  nomeDoJogador: 'Nome do jogador',
  combate: 'Combate',
  soCenario: 'Só cenário',
  etiquetas: 'Etiquetas',
  escolhas: 'Escolhas',
  cartoesAtivos: 'Cartão ligado',
}

function nomeDoRecurso(sistema: SistemaDeRpg | undefined, id: string): string {
  return sistema?.recursos.find((recurso) => recurso.id === id)?.nome ?? id
}

function nomeDoAtributo(sistema: SistemaDeRpg | undefined, id: string): string {
  return sistema?.atributos.find((atributo) => atributo.id === id)?.nome ?? id
}

function nomeDoItem(ficha: Personagem | undefined, vagaId: string): string {
  return ficha?.mochila?.find((item) => item.id === vagaId)?.nome ?? 'um item'
}

function nomeDoCartao(ficha: Personagem | undefined, aba: string, cartaoId: string): string {
  return ficha?.abas[aba]?.find((cartao) => cartao.id === cartaoId)?.nome ?? 'um cartão'
}

/** O campo da op em português ("Vida", "quantidade de Poção"), para o aviso. */
export function rotuloDoCaminho(caminho: readonly string[], ficha?: Personagem, sistema?: SistemaDeRpg): string {
  const [topo, chave, resto] = caminho
  if (topo === undefined) return 'a ficha inteira'
  switch (topo) {
    case 'recursos':
      return chave === undefined ? 'Recursos' : nomeDoRecurso(sistema, chave)
    case 'maximos':
      return chave === undefined ? 'Máximos' : `máximo de ${nomeDoRecurso(sistema, chave)}`
    case 'modificadoresDosRecursos':
      return chave === undefined ? 'Modificadores' : `modificador de ${nomeDoRecurso(sistema, chave)}`
    case 'atributos':
      return chave === undefined ? 'Atributos' : nomeDoAtributo(sistema, chave)
    case 'modificadoresDosAtributos':
      return chave === undefined ? 'Modificadores' : `modificador de ${nomeDoAtributo(sistema, chave)}`
    case 'mochila': {
      if (chave === undefined) return 'Mochila'
      const item = nomeDoItem(ficha, chave)
      return resto === 'quantidade' ? `quantidade de ${item}` : item
    }
    case 'abas':
      return chave !== undefined && resto !== undefined ? `cartão ${nomeDoCartao(ficha, chave, resto)}` : 'Cartões'
    default:
      return ROTULO_FIXO[topo] ?? caminho.join(' › ')
  }
}

/** O valor como texto curto: número, texto (cortado), "vazio" ou "outra versão". */
export function valorEmTexto(valor: Json | undefined): string {
  if (valor === undefined || valor === null || valor === '') return 'vazio'
  if (typeof valor === 'number') return valor.toLocaleString('pt-BR')
  if (typeof valor === 'boolean') return valor ? 'ligado' : 'desligado'
  if (typeof valor === 'string') return valor.length > 40 ? `${valor.slice(0, 39)}…` : valor
  return 'outra versão'
}

/** O que a op do mestre queria: "+2", "−1", "28", "apagar". */
export function oQueAOpQueria(op: Op): string {
  if (op.acao === 'somar' && op.delta !== undefined) return op.delta >= 0 ? `+${op.delta.toLocaleString('pt-BR')}` : `−${Math.abs(op.delta).toLocaleString('pt-BR')}`
  if (op.acao === 'apagar') return 'apagar'
  if (op.acao === 'criar') return 'criar'
  if (op.acao === 'ordenar') return 'outra ordem'
  return valorEmTexto(op.valor)
}

const MOTIVOS: Readonly<Record<MotivoNegado, string>> = {
  'fora-do-esquema': 'o valor está fora do formato que o Lobby aceita',
  'sem-permissao': 'a conta do app não tem permissão para esta mudança',
  'acima-do-teto': 'passa do limite deste campo',
  midia: 'a imagem não foi aceita',
  'doc-grande': 'a ficha ficou grande demais (máximo de 256 KiB)',
  'base-invalida': 'a cópia do app estava fora de ordem com o servidor',
  versao: 'o servidor usa outra versão do formato: atualize o app',
  'alvo-inexistente': 'o que a mudança mexia não existe mais no servidor',
  'nada-a-desfazer': 'não havia nada a desfazer',
}

function ehMotivoNegado(motivo: string): motivo is MotivoNegado {
  return Object.hasOwn(MOTIVOS, motivo)
}

/** O motivo da recusa em português; o que o app não conhece vira "recusada pelo servidor". */
export function textoDoMotivo(motivo: string, detalhe?: string): string {
  const base = ehMotivoNegado(motivo) ? MOTIVOS[motivo] : 'recusada pelo servidor'
  return detalhe !== undefined && detalhe !== '' ? `${base} (${detalhe})` : base
}

/** "há 3 min", "agora", "há 2 dias". */
export function haQuanto(quando: number, agora: number): string {
  const minutos = Math.round((agora - quando) / 60_000)
  if (minutos < 1) return 'agora'
  if (minutos < 60) return `há ${minutos} min`
  const horas = Math.round(minutos / 60)
  if (horas < 24) return `há ${horas} h`
  const dias = Math.round(horas / 24)
  return `há ${dias} ${dias === 1 ? 'dia' : 'dias'}`
}

/** O título do aviso de conflito (§5.2): "Bia acabou de mudar Vida para 25. Você pôs 28." */
export function tituloDoConflito(conflito: Conflito, op: Op, campo: string): string {
  if (conflito.fichaApagada === true) return `${conflito.quem} apagou esta ficha depois da sua mudança em ${campo}.`
  if (conflito.porCausaDe !== undefined) return `${campo}: esta mudança ia junto com outra que bateu com a de ${conflito.quem}.`
  return `${conflito.quem} acabou de mudar ${campo} para ${valorEmTexto(conflito.valorAtual)}. Você pôs ${oQueAOpQueria(op)}.`
}

// ── Quem entra no site ──────────────────────────────────────────────────────

export interface MembroDoPedido {
  contaId: string
  email: string
  nome: string
}

/**
 * Os jogadores que vão ao servidor (rota `membros`, §5.4): só conta com
 * e-mail; um e-mail vale para uma conta só, a primeira da lista (o servidor
 * recusa o pedido com e-mail repetido).
 */
export function membrosDasContas(contas: readonly ContaDeJogador[]): MembroDoPedido[] {
  const vistos = new Set<string>()
  const membros: MembroDoPedido[] = []
  for (const conta of contas) {
    if (conta.email === undefined || vistos.has(conta.email)) continue
    vistos.add(conta.email)
    membros.push({ contaId: conta.id, email: conta.email, nome: conta.nome })
  }
  return membros
}

/** A conta que já usa este e-mail antes desta na lista (o convite desta fica parado). */
export function contaComOMesmoEmail(contas: readonly ContaDeJogador[], conta: ContaDeJogador): ContaDeJogador | null {
  if (conta.email === undefined) return null
  return contas.find((outra) => outra !== conta && outra.email === conta.email) ?? null
}

export function emailRepetidoParado(contas: readonly ContaDeJogador[], conta: ContaDeJogador): boolean {
  const outra = contaComOMesmoEmail(contas, conta)
  return outra !== null && contas.indexOf(outra) < contas.indexOf(conta)
}

/** O recado que o mestre manda ao jogador (WhatsApp, Discord): o endereço e com que conta Google entrar. */
export function recadoDeConvite(conta: ContaDeJogador, nomeDaCampanha: string): string {
  return `${conta.nome}, a ficha da campanha "${nomeDaCampanha}" está no Lobby: abra https://${ENDERECO_DO_LOBBY} e entre com a conta Google ${conta.email ?? ''}.`
}

export function iniciais(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0] ?? '')
    .join('')
    .toUpperCase()
}

/** "Bia e Caio", "Bia, Caio e Duda". */
export function listaDeNomes(nomes: readonly string[]): string {
  if (nomes.length <= 1) return nomes.join('')
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`
}
