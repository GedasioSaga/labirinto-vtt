import { invoke } from '@tauri-apps/api/core'
import type { Json } from '../../lib/nuvem/json'

/**
 * O ADAPTADOR REAL DA PONTE RUST (fatia J0, junção da A5 com a R1): os seis
 * comandos de `desktop/src-tauri/src/nuvem.rs` (contrato no topo do arquivo,
 * commit 4cd50b1e), cada um com o nome e os argumentos exatos que o Tauri 2
 * desserializa (argumentos em camelCase). É o único lugar do app que chama
 * `invoke` para a nuvem: o laço do sincronizador (`ponte.ts`, `transporteDoTauri`)
 * e as telas do Lobby (`components/nuvem/ponteDoLobby.ts`) passam por aqui.
 *
 * | comando | argumentos | devolve |
 * |---|---|---|
 * | `nuvem_credencial_estado` | — | `boolean` |
 * | `nuvem_credencial_guardar` | `clientId`, `clientSecret` | `null` |
 * | `nuvem_credencial_apagar` | — | `null` |
 * | `nuvem_pedir` | `pedido` ({@link PedidoDaR1}) | o JSON da resposta 2xx |
 * | `nuvem_enviar_midia` | `campanhaId`, `pastaId`, `midiaId` | o JSON da resposta do PUT |
 * | `nuvem_baixar_midia` | `campanhaId`, `midiaId` | `null` (a imagem fica em `<appData>/midia/<midiaId>`) |
 *
 * O erro sai cru, como o `invoke` o rejeita: o `Err` da R1
 * (`{ codigo, mensagem, status, detalhe }`) ou o texto do próprio Tauri
 * (comando ausente, argumento que não desserializa). Quem lê decide:
 * `lerErroDaR1` (o laço) e `falhaDoErro` (as telas).
 */

/** `invoke` injetável: os testes não têm Tauri. */
export type Invocar = (comando: string, argumentos?: Record<string, unknown>) => Promise<unknown>

export const invocarDoTauri: Invocar = (comando, argumentos) => invoke<unknown>(comando, argumentos)

/**
 * O `pedido` do `nuvem_pedir`, uma variante para cada uma do enum `PedidoNuvem`
 * da R1 (marcado por `rota`). As três rotas POST levam `corpo`; as GET, não.
 * `limite` vai de 1 a 500 (a R1 recusa fora disso, com `pedido_invalido`).
 *
 * `salaDoChat` (v2, fatia C3) = `GET /api/c/:id/chat/sala?desde=&limite=`, a
 * cópia da sala do chat. A variante `SalaDoChat` do enum da R1 chega na fatia
 * C3R; até lá o Tauri recusa o pedido (variante desconhecida) e a cópia da sala
 * fica parada com o motivo (`chatSala.ts`), sem mexer no resto do Lobby.
 */
export type PedidoDaR1 =
  | { rota: 'eu' }
  | { rota: 'publicar' | 'membros' | 'ops'; campanhaId: string; corpo: Json }
  | { rota: 'desde'; campanhaId: string; rev: number; limite?: number }
  | { rota: 'exportar'; campanhaId: string; deRev?: number; ateRev?: number }
  | { rota: 'salaDoChat'; campanhaId: string; desde: number; limite?: number }

/**
 * O pedido como vai ao fio: só os campos da variante, e o opcional ausente
 * fica de fora. A R1 recusa campo a mais (`deny_unknown_fields`), e um objeto
 * do TypeScript pode carregar campo que o tipo não mostra; por isso o pedido
 * é refeito campo a campo, nunca espalhado.
 */
export function pedidoNoFio(pedido: PedidoDaR1): { [campo: string]: Json } {
  switch (pedido.rota) {
    case 'eu':
      return { rota: 'eu' }
    case 'publicar':
    case 'membros':
    case 'ops':
      return { rota: pedido.rota, campanhaId: pedido.campanhaId, corpo: pedido.corpo }
    case 'desde': {
      const fio: { [campo: string]: Json } = { rota: 'desde', campanhaId: pedido.campanhaId, rev: pedido.rev }
      if (pedido.limite !== undefined) fio.limite = pedido.limite
      return fio
    }
    case 'exportar': {
      const fio: { [campo: string]: Json } = { rota: 'exportar', campanhaId: pedido.campanhaId }
      if (pedido.deRev !== undefined) fio.deRev = pedido.deRev
      if (pedido.ateRev !== undefined) fio.ateRev = pedido.ateRev
      return fio
    }
    case 'salaDoChat': {
      const fio: { [campo: string]: Json } = { rota: 'salaDoChat', campanhaId: pedido.campanhaId, desde: pedido.desde }
      if (pedido.limite !== undefined) fio.limite = pedido.limite
      return fio
    }
  }
}

export interface ComandosDaR1 {
  /** Se há Service Token no Cofre do Windows (nunca o devolve). */
  credencialGuardada(): Promise<boolean>
  /** Guarda o token colado; substitui o de antes. A R1 apara e confere a forma (`credencial_invalida`). */
  guardarCredencial(clientId: string, clientSecret: string): Promise<void>
  /** Apagar o que não existe não é erro. */
  apagarCredencial(): Promise<void>
  /** O JSON da resposta 2xx, inteiro (`null` com corpo vazio). */
  pedir(pedido: PedidoDaR1): Promise<unknown>
  /** Sobe a imagem `midiaId`, lida pela R1 da cópia da pasta ou da mídia da mesa. */
  enviarMidia(campanhaId: string, pastaId: string, midiaId: string): Promise<unknown>
  /** Baixa a imagem para `<appData>/midia/<midiaId>`, se os bytes conferem com o id. */
  baixarMidia(campanhaId: string, midiaId: string): Promise<void>
}

export function comandosDaR1(invocar: Invocar = invocarDoTauri): ComandosDaR1 {
  return {
    async credencialGuardada() {
      return (await invocar('nuvem_credencial_estado')) === true
    },
    async guardarCredencial(clientId, clientSecret) {
      await invocar('nuvem_credencial_guardar', { clientId, clientSecret })
    },
    async apagarCredencial() {
      await invocar('nuvem_credencial_apagar')
    },
    pedir(pedido) {
      return invocar('nuvem_pedir', { pedido: pedidoNoFio(pedido) })
    },
    enviarMidia(campanhaId, pastaId, midiaId) {
      return invocar('nuvem_enviar_midia', { campanhaId, pastaId, midiaId })
    },
    async baixarMidia(campanhaId, midiaId) {
      await invocar('nuvem_baixar_midia', { campanhaId, midiaId })
    },
  }
}
