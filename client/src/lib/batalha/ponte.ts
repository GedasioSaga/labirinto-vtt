import type { Personagem } from '../personagem'
import type { LinhaDoRegistro } from './registro'
import type { RegrasDaBatalha } from './regrasDoCampo'
import type { AutorDaAcao, TurnosDaCena } from './turnos'

/**
 * PONTE DA BATALHA: o contrato entre a store do mestre
 * (`stores/batalhaStore.ts`, `ponteDaBatalha`) e a sessão do host
 * (`net/hostSession.ts`, `HostSessionOptions.ponteDaBatalha`). O host roda no
 * mesmo processo do mestre: lê o estado da cena e repassa os pedidos do
 * JOGADOR já validados. As ações do mestre não passam por aqui — são chamada
 * direta na store.
 *
 * Mora em `lib/` e não na store para o host depender só do contrato, e a
 * store e o host serem escritos (e testados) cada um do seu lado.
 */

/**
 * A parte de uma cena em batalha que o host lê para o recorte do jogador
 * (`vistaParaJogador`) e para validar os pedidos. A `BatalhaDaCena` da store
 * traz isto e mais (caminhos, trilhas, revisões).
 */
export interface BatalhaEmTurnos {
  turnos: TurnosDaCena
  /** Da mais velha à mais nova, no máximo `REGISTRO_MAX`. */
  registro: readonly LinhaDoRegistro[]
  /** A cópia das regras do campo desta batalha; `null` = nenhuma. */
  regras: RegrasDaBatalha | null
}

/** O "Passar a vez" só vale se a vez ainda é esta carta nesta rodada: clique duplo e reenvio não passam duas vezes. */
export interface VezEsperada {
  cartaId: string
  rodada: number
}

export interface PonteDaBatalha {
  /** A cena em batalha, ou `null` (fora de batalha, ou cena desconhecida). */
  cena(sceneKey: string): BatalhaEmTurnos | null
  /** Passa a vez se ela ainda é `esperado`; devolve se passou. Idempotente. */
  passarVez(sceneKey: string, autor: AutorDaAcao, esperado: VezEsperada): boolean
  /** Desfaz a linha se `autor` pode (`podeDesfazer`); devolve se desfez. */
  desfazer(sceneKey: string, linhaId: string, autor: AutorDaAcao): boolean
  /**
   * Um ajuste rápido da ficha foi aceito (`antes` → `depois`): vira linha no
   * registro de toda cena em batalha com o personagem na ordem. Nada mudou ou
   * personagem fora de batalha: nada. O Desfazer não passa por aqui.
   */
  registrarAjuste(personagemId: string, antes: Personagem, depois: Personagem, autor: AutorDaAcao): void
}
