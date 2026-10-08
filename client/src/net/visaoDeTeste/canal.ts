/**
 * O fio entre a janela principal e a janela da Visão de jogador.
 *
 * As duas são páginas do mesmo app (mesma origem no Tauri e no Vite), então um
 * `BroadcastChannel` liga as duas sem nenhuma API do Tauri: a janela de teste
 * não precisa de capability nenhuma. Os testes trocam pelo par em memória,
 * que imita o que importa do original: a entrega é assíncrona, o dado chega
 * como CÓPIA (clone estruturado: função no meio da mensagem falha aqui, como
 * falharia lá) e ninguém ouve a si mesmo.
 */

export const NOME_DO_CANAL = 'labirinto-visao-jogador'

/** Um lado do canal. */
export interface Canal {
  /** Manda ao outro lado. Depois de `fechar`, não faz nada. */
  enviar(dado: unknown): void
  /** Chama `aoChegar` a cada mensagem do OUTRO lado. Devolve o desligar. */
  ouvir(aoChegar: (dado: unknown) => void): () => void
  fechar(): void
}

/** O canal de verdade, entre as janelas do app. */
export function abrirCanalDoNavegador(nome: string = NOME_DO_CANAL): Canal {
  const canal = new BroadcastChannel(nome)
  let fechado = false
  return {
    enviar: (dado) => {
      // Mandar por um BroadcastChannel fechado lança: o fim do teste não pode virar erro.
      if (!fechado) canal.postMessage(dado)
    },
    ouvir: (aoChegar) => {
      const ouvinte = (evento: MessageEvent<unknown>) => aoChegar(evento.data)
      canal.addEventListener('message', ouvinte)
      return () => canal.removeEventListener('message', ouvinte)
    },
    fechar: () => {
      fechado = true
      canal.close()
    },
  }
}

interface Ponta {
  ouvintes: Set<(dado: unknown) => void>
  fechada: boolean
}

/** Par ligado em memória, para os testes: o que um manda, só o outro recebe. */
export function criarParDeCanais(): [Canal, Canal] {
  const a: Ponta = { ouvintes: new Set(), fechada: false }
  const b: Ponta = { ouvintes: new Set(), fechada: false }
  const lado = (eu: Ponta, outro: Ponta): Canal => ({
    enviar: (dado) => {
      if (eu.fechada) return
      // Copia já, como o `postMessage`: mudar o objeto depois de mandar não muda o que chega.
      const copia: unknown = structuredClone(dado)
      // Promise, e não timer: os testes com relógio falso continuam recebendo.
      void Promise.resolve().then(() => {
        if (outro.fechada) return
        for (const ouvinte of [...outro.ouvintes]) ouvinte(copia)
      })
    },
    ouvir: (aoChegar) => {
      eu.ouvintes.add(aoChegar)
      return () => {
        eu.ouvintes.delete(aoChegar)
      }
    },
    fechar: () => {
      eu.fechada = true
      eu.ouvintes.clear()
    },
  })
  return [lado(a, b), lado(b, a)]
}
