import type { ContaDeJogador } from '../../lib/contasDosJogadores'
import { segmentoValido } from '../../lib/nuvem/caminho'
import { ehRegistro, lerJsonSeguro, paraJson, proprio, type Json } from '../../lib/nuvem/json'
import { VERSAO_DO_FORMATO } from '../../lib/nuvem/tipos'
import type { PastaNoDisco } from './discoDaNuvem'

/**
 * REMOVER JOGADOR FECHA OS SOCKETS (docs/planos/lobby-jogadores-2026-11-05.md
 * §5.4, §6.4 e §8.2, fatia C3; achados Nu9 e Si12). Quem fecha é o DO: a rota
 * `POST /api/c/:id/membros` marca `removido` quem saiu da lista (ou trocou de
 * e-mail) e fecha os sockets dessa conta na hora. A parte do app é a lista
 * CHEGAR lá, mesmo sem rede no momento em que o mestre apagou a conta ou
 * tirou o e-mail:
 *
 * - antes do pedido, a campanha fica marcada em `<appData>/nuvem/membros-pendentes.json`
 *   (a queda do app no meio não perde a remoção);
 * - o servidor confirmou: a marca sai; sem rede, sem token, cofre: a marca
 *   fica, e o laço da campanha (`nuvemNoApp.ts`) manda de novo sozinho, com a
 *   lista relida do disco, no ritmo dele (5 s com a campanha aberta);
 * - o servidor recusou a lista (e-mail que já é de outra conta, 409): repetir
 *   não adianta; a marca sai e o motivo vai para a tela;
 * - um envio por vez no app inteiro: a tela e o laço nunca se cruzam, e a
 *   última lista que chega ao servidor é sempre a mais nova.
 *
 * Aqui também moram o corpo da rota e quem entra nela (antes em
 * `components/nuvem/textosDoLobby.ts`, que os reexporta): o laço, na camada
 * `net`, monta o mesmo corpo que a tela, pela mesma função.
 */

/** Quem publica é o mestre: o nome que o histórico do site mostra nas mudanças do app. */
export const NOME_DO_MESTRE = 'Mestre'

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

/** O corpo do `POST membros`: a lista INTEIRA (quem não vem sai da campanha). */
export function corpoDosMembros(contas: readonly ContaDeJogador[]): Json {
  return { v: VERSAO_DO_FORMATO, nomeDoMestre: NOME_DO_MESTRE, membros: paraJson(membrosDasContas(contas)) }
}

// ── A marca no disco ────────────────────────────────────────────────────────

export const ARQUIVO_DOS_MEMBROS_PENDENTES = 'membros-pendentes.json'

/** Leitura tolerante: o que não se entende fica de fora (no pior caso, a lista vai de novo na próxima mudança). */
export function marcadasDoArquivo(texto: string | null): Set<string> {
  if (texto === null) return new Set()
  let valor: unknown
  try {
    valor = lerJsonSeguro(texto)
  } catch (erro) {
    if (erro instanceof SyntaxError) return new Set()
    throw erro
  }
  const lista = ehRegistro(valor) ? proprio(valor, 'campanhas') : undefined
  if (!Array.isArray(lista)) return new Set()
  const brutas: readonly unknown[] = lista
  return new Set(brutas.filter(segmentoValido))
}

/** Como foi o envio da lista a uma campanha. */
export type EnvioDaLista = 'confirmado' | 'pendente' | 'recusado'

export interface MembrosPendentes {
  /** As campanhas cuja lista no servidor pode estar velha. */
  pendentes(): Promise<ReadonlySet<string>>
  /**
   * Manda a lista a cada campanha, na vez (um envio por vez no app). Marca
   * todas no disco antes; tira a marca de quem respondeu `confirmado` ou
   * `recusado`. Lança se o disco recusar a marca: antes do envio, nada foi
   * mandado; depois, a lista chegou e a campanha só segue marcada (vai de novo,
   * o que não muda nada no servidor).
   */
  enviar(campanhaIds: readonly string[], enviarUma: (campanhaId: string) => Promise<EnvioDaLista>): Promise<void>
}

export function criarMembrosPendentes(raiz: PastaNoDisco): MembrosPendentes {
  let marcadas: ReadonlySet<string> | null = null
  let vez: Promise<unknown> = Promise.resolve()

  function naVez<T>(passo: () => Promise<T>): Promise<T> {
    const resultado = vez.then(passo)
    vez = resultado.catch(() => undefined)
    return resultado
  }

  async function lidas(): Promise<ReadonlySet<string>> {
    marcadas ??= marcadasDoArquivo(await raiz.ler(ARQUIVO_DOS_MEMBROS_PENDENTES))
    return marcadas
  }

  /** Disco primeiro, memória depois: a memória nunca diz "marcada" sem o disco dizer também. */
  async function trocar(novas: ReadonlySet<string>): Promise<void> {
    await raiz.reescrever(ARQUIVO_DOS_MEMBROS_PENDENTES, JSON.stringify({ v: 1, campanhas: [...novas].sort() }))
    marcadas = novas
  }

  return {
    pendentes: () => naVez(lidas),
    enviar: (campanhaIds, enviarUma) =>
      naVez(async () => {
        const antes = await lidas()
        if (campanhaIds.some((campanhaId) => !antes.has(campanhaId))) await trocar(new Set([...antes, ...campanhaIds]))
        const resolvidas: string[] = []
        for (const campanhaId of campanhaIds) {
          if ((await enviarUma(campanhaId)) !== 'pendente') resolvidas.push(campanhaId)
        }
        if (resolvidas.length === 0) return
        const ficam = new Set(await lidas())
        for (const campanhaId of resolvidas) ficam.delete(campanhaId)
        await trocar(ficam)
      }),
  }
}
