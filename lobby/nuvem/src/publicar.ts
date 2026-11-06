import { gravar, gravarMembro, leitorDoBanco, lerFicha, membroPorEmail, revAtual, todosOsMembros } from './banco'
import { ErroDoPedido } from './http'
import type { PedidoDeMembros } from './pedidos'
import {
  CONTA_DO_MESTRE,
  ehRegistro,
  LIMITES,
  processarLote,
  proprio,
  segmentoValido,
  type Identidade,
  type Membro,
  type OpGravada,
  type Papel,
  type RespostaDaOp,
} from './nucleo'

/**
 * PUBLICAR e MEMBROS (plano §5.4). Rodam dentro do `transactionSync` do DO:
 * erro no meio desfaz tudo, inclusive `meta` e `membros`.
 *
 * Ficha nova entra como `criar` de `[]` pelo MESMO `processarLote` das outras
 * ops (8.1.1, item 6): passa por `lerMudanca`, onde `fichaComImagemForaDaMidia`
 * recusa a foto embutida (data URL) no retrato e em qualquer cartão, e ganha
 * rev e linha no log como qualquer mudança. Nunca é gravada direto em `fichas`.
 */

/** Prefixo do `opId` da criação pelo publicar: o mesmo publicar de novo recebe a mesma resposta. */
const PREFIXO_DO_PUBLICAR = 'pub:'
const ID_DA_FICHA_MAX = 80 - PREFIXO_DO_PUBLICAR.length

export type RespostaDaFicha = RespostaDaOp | { t: 'ja-publicada' } | { t: 'id-invalido' }

export interface FichaPublicada {
  fichaId: string | null
  resposta: RespostaDaFicha
}

export interface Publicacao {
  fichas: FichaPublicada[]
  ops: OpGravada[]
}

/**
 * A lista de membros vira a do pedido: quem saiu fica `removido` (a linha e o
 * e-mail ficam para o histórico; nada é apagado). Devolve as contas cujo
 * acesso mudou (removida, ou com outro e-mail): os sockets delas fecham.
 */
export function sincronizarMembros(sql: SqlStorage, emailDoMestre: string, pedido: PedidoDeMembros): string[] {
  const atuais = new Map(todosOsMembros(sql).map((membro): [string, Membro] => [membro.contaId, membro]))
  const mestre: Membro = { contaId: CONTA_DO_MESTRE, email: emailDoMestre, nome: pedido.nomeDoMestre, papel: 'mestre', estado: 'ativo' }
  const jogador: Papel = 'jogador'
  const novos: Membro[] = [mestre, ...pedido.membros.map((membro): Membro => ({ ...membro, papel: jogador, estado: 'ativo' }))]
  const ficam = new Set(novos.map((membro) => membro.contaId))
  const mudaram: string[] = []
  for (const atual of atuais.values()) {
    if (ficam.has(atual.contaId) || atual.estado === 'removido') continue
    gravarMembro(sql, { ...atual, estado: 'removido' })
    mudaram.push(atual.contaId)
  }
  for (const novo of novos) {
    const dono = membroPorEmail(sql, novo.email)
    // O e-mail é único na tabela; o de uma conta removida continua dela. Raro: o mestre corrige a conta no app.
    if (dono !== undefined && dono.contaId !== novo.contaId) throw new ErroDoPedido(409, 'email-em-outra-conta', `O e-mail de ${novo.nome} já é de outra conta desta campanha`)
    const atual = atuais.get(novo.contaId)
    if (atual !== undefined && atual.email !== novo.email) mudaram.push(novo.contaId)
    gravarMembro(sql, novo)
  }
  return mudaram
}

/** O que o DO Diretório guarda desta campanha: e-mail e papel de cada membro ativo. */
export function entradasDoDiretorio(sql: SqlStorage): { email: string; papel: Papel }[] {
  return todosOsMembros(sql)
    .filter((membro) => membro.estado === 'ativo')
    .map(({ email, papel }) => ({ email, papel }))
}

function idDaFicha(bruta: unknown): string | null {
  const fichaId = ehRegistro(bruta) ? proprio(bruta, 'id') : undefined
  return segmentoValido(fichaId) && fichaId.length <= ID_DA_FICHA_MAX ? fichaId : null
}

/** A op de criar a ficha inteira, como o cliente mandaria: o núcleo lê e confere tudo (esquema, teto, permissão). */
function opDeCriar(fichaId: string, bruta: unknown, quem: Identidade, baseRev: number, agora: number): Record<string, unknown> {
  const opId = `${PREFIXO_DO_PUBLICAR}${fichaId}`
  return { opId, loteId: opId, fichaId, caminho: [], acao: 'criar', valor: bruta, baseRev, clienteId: quem.clienteId, quandoCliente: agora }
}

/** As fichas que ainda não existem viram `criar`; as que já existem sobem depois como ops normais (diferença contra a base). */
export function publicarFichas(sql: SqlStorage, quem: Identidade, fichas: readonly unknown[], agora: number): Publicacao {
  const respostas = new Map<string, RespostaDaFicha>()
  const lote: Record<string, unknown>[] = []
  const baseRev = revAtual(sql)
  const vistas = new Set<string>()
  for (const bruta of fichas) {
    const fichaId = idDaFicha(bruta)
    // A mesma ficha duas vezes no pedido: vale a primeira, e as duas recebem a resposta dela.
    if (fichaId === null || vistas.has(fichaId)) continue
    vistas.add(fichaId)
    if (lerFicha(sql, fichaId) !== undefined) respostas.set(fichaId, { t: 'ja-publicada' })
    else lote.push(opDeCriar(fichaId, bruta, quem, baseRev, agora))
  }
  const ops: OpGravada[] = []
  for (let inicio = 0; inicio < lote.length; inicio += LIMITES.opsPorLote) {
    const resultado = processarLote(leitorDoBanco(sql), quem, lote.slice(inicio, inicio + LIMITES.opsPorLote), agora)
    gravar(sql, resultado.gravacoes)
    ops.push(...resultado.gravacoes.ops)
    for (const resposta of resultado.respostas) respostas.set(resposta.opId.slice(PREFIXO_DO_PUBLICAR.length), resposta)
  }
  return {
    fichas: fichas.map((bruta): FichaPublicada => {
      const fichaId = idDaFicha(bruta)
      const resposta = fichaId === null ? undefined : respostas.get(fichaId)
      return { fichaId, resposta: resposta === undefined ? { t: 'id-invalido' } : resposta }
    }),
    ops,
  }
}
