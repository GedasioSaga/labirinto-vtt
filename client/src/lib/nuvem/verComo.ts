import { segmentoValido } from './caminho'
import { proprio } from './json'
import type { MensagemDoMuralDoServidor } from './muralDoLobby'
import { membroAtivo } from './permissao'
import { fichaNoEstado, projetarMembro, projetarMembros, type SistemaDoJogador } from './projecao'
import type { EstadoDaBase, FichaGuardada, FichaNoEstado, Membro } from './tipos'

/**
 * VER COMO JOGADOR (pedido do mestre, 07/11/2026: "eu poder ver como
 * jogador"). O mestre pede pelo MESMO socket dele (`verComo`) e o DO devolve a
 * vista daquele jogador montada pelas MESMAS funções que montam o `estado` do
 * próprio jogador (`estadoDoMembro`): fichas projetadas (sem nota do mestre,
 * sem NPC, sem ficha escondida), membros sem e-mail, o mural com o `lida`
 * dele e a lista de duelos do lado dele. A identidade do socket não muda: o
 * mestre continua sendo o mestre em todo o resto, e nada do que ele faz na
 * vista grava em nome do jogador (o site fica só leitura).
 *
 * O CHAT NÃO VEM: privado é só de quem conversa (o mestre nunca lê privado
 * entre jogadores), e a sala é a mesma para todo mundo (o site a mostra da
 * conversa que o mestre já tem). Na vista não aparece privado nenhum, nem o
 * do jogador com o mestre: é a escolha mais segura.
 *
 * Campos e frames novos, opcionais: o site de antes nunca pede `verComo`, então
 * nunca recebe `verComo.*`; o DO de antes não lê o pedido (frame fora do
 * formato) e o site novo desiste pelo prazo.
 */

/** O pedido do site do mestre: a vista de `contaId`, respondida com o mesmo `reqId`. */
export interface PedidoDeVerComo {
  t: 'verComo'
  reqId: string
  contaId: string
}

/**
 * Por que não veio a vista:
 * - `so-mestre`: quem pediu não é o mestre desta mesa (jogador pedindo = recusado);
 * - `nao-e-jogador`: a conta não é um jogador ativo da mesa (saiu, ou é o próprio mestre);
 * - `ritmo`: pedidos demais em pouco tempo (o ritmo por conta de todo frame); o site tenta de novo depois;
 * - `torta`: a vista chegou fora do formato (só o site usa, ao ler).
 */
export type MotivoDoVerComo = 'so-mestre' | 'nao-e-jogador' | 'ritmo' | 'torta'

export type MuralDoVerComo = Extract<MensagemDoMuralDoServidor, { t: 'mural.estado' }>

/**
 * A vista de um jogador para o mestre. `mural`/`duelos` = `null` quando o servidor não os tem (ou vieram tortos).
 * `D` é o `duelo.lista` (do treino): vem de quem usa, porque o núcleo da nuvem não importa o treino nem como tipo
 * (a guarda de pureza segue todo import relativo, e o fecho do treino chega a React e Pixi).
 */
export interface VistaDoJogador<E extends EstadoDaBase = EstadoDaBase, D = unknown> {
  t: 'verComo.vista'
  reqId: string
  contaId: string
  estado: E
  mural: MuralDoVerComo | null
  duelos: D | null
}

export interface RecusaDoVerComo {
  t: 'verComo.recusa'
  reqId: string
  motivo: MotivoDoVerComo
}

export type MensagemDoVerComo<E extends EstadoDaBase = EstadoDaBase, D = unknown> = VistaDoJogador<E, D> | RecusaDoVerComo

/** O teto do id de conta no pedido (o `contaId` do app é curto; o resto nem chega à busca). */
const CONTA_ID_MAX = 128

/** O pedido lido no DO; `null` = fora do formato (conta como violação, como qualquer frame torto). */
export function lerPedidoDeVerComo(registro: Record<string, unknown>): PedidoDeVerComo | null {
  const reqId = proprio(registro, 'reqId')
  const contaId = proprio(registro, 'contaId')
  if (!segmentoValido(reqId) || typeof contaId !== 'string' || contaId.length === 0 || contaId.length > CONTA_ID_MAX) return null
  return { t: 'verComo', reqId, contaId }
}

export type DecisaoDoVerComo = { ok: true; alvo: Membro } | { ok: false; motivo: 'so-mestre' | 'nao-e-jogador' }

/**
 * Quem pode ver como quem. O papel de quem pede é o lido de `membros` AGORA
 * (nunca o do pedido): só o mestre ativo vê, e só um jogador ativo é visto.
 */
export function decidirVerComo(pedinte: Membro | undefined, membros: readonly Membro[], contaId: string): DecisaoDoVerComo {
  if (!membroAtivo(pedinte) || pedinte.papel !== 'mestre') return { ok: false, motivo: 'so-mestre' }
  const alvo = membros.find((membro) => membro.contaId === contaId)
  if (!membroAtivo(alvo) || alvo.papel !== 'jogador') return { ok: false, motivo: 'nao-e-jogador' }
  return { ok: true, alvo }
}

/**
 * O `estado` como `eu` o recebe: a única montagem, usada pelo DO no `ola` e no
 * `verComo` (a vista do mestre-como-jogador é, por construção, a do jogador).
 * `sala` vem pronta de quem chama (o DO tem a dele, a demo a dela).
 */
export function estadoDoMembro<S>(
  eu: Membro,
  fichas: readonly FichaGuardada[],
  membros: readonly Membro[],
  rev: number,
  sala: S,
  sistema: SistemaDoJogador | null,
): EstadoDaBase & { sala: S } {
  const nomes = new Map(membros.map((membro): [string, string] => [membro.contaId, membro.nome]))
  const visiveis = fichas.flatMap((ficha): FichaNoEstado[] => {
    const noEstado = fichaNoEstado(eu, ficha, (contaId) => nomes.get(contaId) ?? null)
    return noEstado === null ? [] : [noEstado]
  })
  const estado: EstadoDaBase & { sala: S } = { t: 'estado', rev, fichas: visiveis, membros: projetarMembros(membros), eu: projetarMembro(eu), sala }
  if (sistema !== null) {
    estado.sistema = sistema.sistema
    estado.marcaDoSistema = sistema.marca
    if (sistema.livro !== null) estado.livro = sistema.livro
  }
  return estado
}
