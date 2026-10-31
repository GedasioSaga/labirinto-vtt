import type { Personagem } from '../personagem'
import type { EfeitoDaBatalha, PedidoDeAcao, PedidoDePassiva, PedidoDeReacao } from './combate'
import type { JudgeNaCena } from './judge'
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
  /**
   * F2: as animações (corte do golpe, d20 da reação, número do dano), as
   * últimas `EFEITOS_GUARDADOS`, `seq` crescente por cena. Fora de `turnos`:
   * efeito não se desfaz. Ausente = nenhum.
   */
  efeitos?: readonly EfeitoDaBatalha[]
  /**
   * F3 (fatia J): onde o Judge está no mapa. Fora de `turnos`: mover o Judge
   * não vai ao registro nem se desfaz. Ausente = ainda não posto (o App põe
   * logo que a batalha liga).
   */
  judge?: JudgeNaCena
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
  /**
   * F2: Atacar, Habilidade, Concentrar ou o contra-ataque gasto em Mover. A
   * store confere a regra (`podeAgir`); o host já conferiu posse e vez. `vez`
   * null só com `contraDe` (o contra-ataque, Q6, é fora da vez). Devolve se agiu.
   */
  agir(sceneKey: string, autor: AutorDaAcao, vez: VezEsperada | null, pedido: PedidoDeAcao): boolean
  /** F2: rolar (o d20 é do host), rerolar, escolher a saída ou Não reagir. Devolve se valeu. */
  reagir(sceneKey: string, autor: AutorDaAcao, pedido: PedidoDeReacao): boolean
  /** F2: dano livre numa ficha (o jogador, só na dele; o host confere). */
  darDano(sceneKey: string, autor: AutorDaAcao, tokenId: string, valor: number): boolean
  /** F2: as armas da aba Armas levadas para a batalha, dentro do limite; troca quando quiser (Q8). */
  escolherArmas(sceneKey: string, autor: AutorDaAcao, personagemId: string, armas: readonly string[]): boolean
  /** Zera a concentração guardada (carga → 0), a qualquer hora; não devolve a ação gasta. Sem carga: `false`. */
  zerarCarga(sceneKey: string, autor: AutorDaAcao, personagemId: string): boolean
  /**
   * Tipos de habilidade F3: Ativar/Desligar a passiva, Aplicar o "a cada
   * turno" ou "Agora não", fora da vez. A store confere a regra
   * (`motivoDaPassiva`); o host já conferiu que a ficha é dele. Opcional: a
   * ponte sem passivas (dublê de teste antigo) recusa o pedido.
   */
  passiva?(sceneKey: string, autor: AutorDaAcao, pedido: PedidoDePassiva): boolean
}
