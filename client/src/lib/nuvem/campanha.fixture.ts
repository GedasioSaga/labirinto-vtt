import type { CarriedItem } from '../../types/map'
import type { CartaoDaFicha, Personagem } from '../personagem'
import { processarDesfazer } from './desfazer'
import type { Cota } from './limites'
import { processarLote, type Gravacoes, type LeitorDaCampanha, type ResultadoDoProcessamento } from './lote'
import type { Json } from './json'
import type { Acao, FichaGuardada, Identidade, Membro, Op, OpGravada, Recusada } from './tipos'

/**
 * CAMPANHA DE TESTE: o DO em memória para os testes do núcleo. Lê como o
 * SQLite e grava as `Gravacoes` inteiras de uma vez (o `transactionSync`),
 * conferindo o que o banco conferiria: `opId` único entre `ops` e
 * `recusadas` (PK) e rev crescente sem buraco. Fichas e nomes inventados
 * (One Piece), e-mails `@example.com`.
 */

export const AGORA = Date.UTC(2026, 10, 5, 22, 0, 0)

export interface CampanhaDeTeste extends LeitorDaCampanha {
  gravar(gravacoes: Gravacoes): void
  todasAsOps(): readonly OpGravada[]
  todasAsRecusadas(): readonly Recusada[]
  /** O mestre muda alguém na lista de membros (removido, outro papel): vale já na mensagem seguinte. */
  mudarMembro(membro: Membro): void
}

export function campanhaDeTeste(fichas: readonly FichaGuardada[], membros: readonly Membro[] = MEMBROS): CampanhaDeTeste {
  const porFicha = new Map(fichas.map((guardada): [string, FichaGuardada] => [guardada.doc.id, guardada]))
  const porConta = new Map(membros.map((membro): [string, Membro] => [membro.contaId, membro]))
  const ops: OpGravada[] = []
  const recusadas = new Map<string, Recusada>()
  const cotas = new Map<string, Cota>()
  const idUsado = (opId: string): boolean => recusadas.has(opId) || ops.some((op) => op.opId === opId)
  return {
    revAtual: () => ops.at(-1)?.rev ?? 0,
    ficha: (fichaId) => porFicha.get(fichaId),
    opGravada: (opId) => ops.find((op) => op.opId === opId),
    recusada: (opId) => recusadas.get(opId),
    opsDaFicha: (fichaId, depoisDe) => ops.filter((op) => op.fichaId === fichaId && op.rev > depoisDe),
    desfeitasDe: (opId) => ops.filter((op) => op.desfaz === opId),
    membro: (contaId) => porConta.get(contaId),
    cota: (chave) => cotas.get(chave),
    gravar(gravacoes) {
      for (const op of gravacoes.ops) {
        const esperada = (ops.at(-1)?.rev ?? 0) + 1
        if (op.rev !== esperada) throw new Error(`rev com buraco: ${op.rev}, esperava ${esperada}`)
        if (idUsado(op.opId)) throw new Error(`PK: opId repetido em ops (${op.opId})`)
        ops.push(op)
      }
      for (const recusada of gravacoes.recusadas) {
        if (idUsado(recusada.opId)) throw new Error(`PK: opId repetido em recusadas (${recusada.opId})`)
        recusadas.set(recusada.opId, recusada)
      }
      for (const guardada of gravacoes.fichas) porFicha.set(guardada.doc.id, guardada)
      for (const { chave, cota } of gravacoes.cotas) cotas.set(chave, cota)
    },
    todasAsOps: () => ops,
    todasAsRecusadas: () => [...recusadas.values()],
    mudarMembro(membro) {
      porConta.set(membro.contaId, membro)
    },
  }
}

/** Processa e grava, como o DO faria com um frame. */
export function enviar(campanha: CampanhaDeTeste, quem: Identidade, lote: readonly unknown[], agora = AGORA): ResultadoDoProcessamento {
  const resultado = processarLote(campanha, quem, lote, agora)
  campanha.gravar(resultado.gravacoes)
  return resultado
}

export function pedirDesfazer(campanha: CampanhaDeTeste, quem: Identidade, pedido: unknown, agora = AGORA): ResultadoDoProcessamento {
  const resultado = processarDesfazer(campanha, quem, pedido, agora)
  campanha.gravar(resultado.gravacoes)
  return resultado
}

// ── Pessoas ─────────────────────────────────────────────────────────────────

export const MESTRE: Membro = { contaId: 'mestre', email: 'mestre@example.com', nome: 'Mestre', papel: 'mestre', estado: 'ativo' }
export const NAMI: Membro = { contaId: 'conta_nami', email: 'nami@example.com', nome: 'Nami', papel: 'jogador', estado: 'ativo' }
export const ZORO: Membro = { contaId: 'conta_zoro', email: 'zoro@example.com', nome: 'Zoro', papel: 'jogador', estado: 'ativo' }
export const USOPP_REMOVIDO: Membro = { contaId: 'conta_usopp', email: 'usopp@example.com', nome: 'Usopp', papel: 'jogador', estado: 'removido' }
export const MEMBROS: readonly Membro[] = [MESTRE, NAMI, ZORO, USOPP_REMOVIDO]

function identidade(membro: Membro, origem: Identidade['origem'], clienteId: string): Identidade {
  return { email: membro.email, contaId: membro.contaId, nome: membro.nome, papel: membro.papel, origem, clienteId }
}

/** O app do mestre (Service Token): a única identidade que declara autor. */
export const MESTRE_NO_APP = identidade(MESTRE, 'app', 'cli_app')
export const MESTRE_NO_SITE = identidade(MESTRE, 'site', 'cli_mestre_site')
export const NAMI_NO_PC = identidade(NAMI, 'site', 'cli_nami_pc')
export const NAMI_NO_CELULAR = identidade(NAMI, 'site', 'cli_nami_celular')
export const ZORO_NO_SITE = identidade(ZORO, 'site', 'cli_zoro')
export const USOPP_NO_SITE = identidade(USOPP_REMOVIDO, 'site', 'cli_usopp')

// ── Fichas ──────────────────────────────────────────────────────────────────

export const F_NAMI = 'pers_nami'
/** A segunda ficha da mesma conta: uma conta pode ter várias. */
export const F_NAMI_2 = 'pers_nami_navegadora'
export const F_ZORO = 'pers_zoro'
/** Ficha de jogador sem conta (só o nome do jogador): só o mestre edita. */
export const F_SEM_DONO = 'pers_brook'
/** NPC escondido da mesa. */
export const F_DO_MESTRE = 'pers_arlong'

export function cartao(id: string, nome: string, extra: Partial<CartaoDaFicha> = {}): CartaoDaFicha {
  return { id, nome, campos: {}, extras: [], atributos: [], imagem: null, modificadores: [], subcartoes: [], ...extra }
}

export const TANGERINA: CarriedItem = { id: 'vaga_tangerina', nome: 'Tangerina', itemId: 'item_tangerina', empilhavel: true, quantidade: 3 }

export function ficha(id: string, extra: Partial<Personagem> = {}): Personagem {
  return {
    id,
    tipo: 'jogador',
    nome: id.replace('pers_', ''),
    descricao: '',
    retrato: null,
    escolhas: {},
    etiquetas: [],
    recursos: { hp: 300 },
    maximos: {},
    modificadoresDosRecursos: {},
    atributos: {},
    modificadoresDosAtributos: {},
    cartoesAtivos: [],
    historico: [],
    abas: { tecnicas: [cartao('cart_clima', 'Clima-Tact', { campos: { dano: '1d6' } })] },
    ...extra,
  }
}

export function guardada(doc: Personagem, extra: Partial<FichaGuardada> = {}): FichaGuardada {
  return { doc, apagada: false, visivel: 'mesa', rev: 0, ...extra }
}

/** A mesa de sempre: duas fichas da Nami, uma do Zoro, uma sem dono e um NPC só do mestre. */
export function mesa(): CampanhaDeTeste {
  return campanhaDeTeste([
    guardada(ficha(F_NAMI, { dono: NAMI.contaId, mochila: [TANGERINA], moedas: 100 })),
    guardada(ficha(F_NAMI_2, { dono: NAMI.contaId })),
    guardada(ficha(F_ZORO, { dono: ZORO.contaId })),
    guardada(ficha(F_SEM_DONO, { nomeDoJogador: 'Brook' })),
    guardada(ficha(F_DO_MESTRE, { tipo: 'npc', notaDoMestre: 'Chefe da ilha' }), { visivel: 'mestre' }),
  ])
}

// ── Ops ─────────────────────────────────────────────────────────────────────

let contador = 0

export interface OpcoesDaOp {
  valor?: Json
  delta?: number
  baseRev?: number
  opId?: string
  /** As ops geradas juntas (o tudo-ou-nada é só dentro do mesmo lote); sem ele, cada op tem o seu. */
  loteId?: string
  atomico?: true
  autorDeclarado?: string
  resolve?: string
  desfaz?: string
}

/** Op como o cliente manda: `clienteId` de quem manda, base 0 se não disser. */
export function op(quem: Identidade, fichaId: string, caminho: string[], acao: Acao, opcoes: OpcoesDaOp = {}): Op {
  contador += 1
  const { opId, baseRev, ...resto } = opcoes
  return {
    opId: opId ?? `op_${contador}`,
    loteId: `lote_${contador}`,
    fichaId,
    caminho,
    acao,
    baseRev: baseRev ?? 0,
    clienteId: quem.clienteId,
    quandoCliente: AGORA,
    ...resto,
  }
}

export function docDe(campanha: LeitorDaCampanha, fichaId: string): Personagem {
  const achada = campanha.ficha(fichaId)
  if (achada === undefined) throw new Error(`ficha ${fichaId} não existe na campanha de teste`)
  return achada.doc
}
