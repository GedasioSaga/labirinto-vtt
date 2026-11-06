/**
 * O núcleo puro do Lobby (client/src/lib/nuvem), num ponto só: o Worker usa
 * as MESMAS funções do app e do site (plano §3.3), nunca uma cópia. O fecho
 * de imports dele não puxa Tauri, React, Pixi nem DOM (pureza.test.ts), e a
 * prova do bundle é o `wrangler deploy --dry-run`.
 */
export { segmentoValido } from '../../../client/src/lib/nuvem/caminho'
export { lerMudanca } from '../../../client/src/lib/nuvem/caminho'
export { processarDesfazer } from '../../../client/src/lib/nuvem/desfazer'
export { ehJson, ehRegistro, lerJsonSeguro, proprio, bytesDoTexto, type Json } from '../../../client/src/lib/nuvem/json'
export {
  cabeNaCota,
  chaveDaCotaDaCampanha,
  chaveDaCotaDaConta,
  comOpContada,
  conferirRitmo,
  LIMITES,
  type ConferenciaDoRitmo,
  type Cota,
} from '../../../client/src/lib/nuvem/limites'
export {
  canalDoPar,
  CHAT_NAO_LIDAS_MAX,
  lerPedidoDoChat,
  mencoesDaSala,
  parDoPrivado,
  textoDoChat,
  type CanalDoChat,
  type LeituraDoPedidoDoChat,
  type MensagemDoChat,
  type MensagemDoChatDoServidor,
  type MensagemNoCanal,
  type MotivoDoChatRecusado,
  type ParDoPrivado,
  type PedidoDoChat,
  type ResumoDoCanal,
  type TipoDoPedidoDoChat,
} from '../../../client/src/lib/nuvem/chatDoLobby'
export { lerEnvelope, processarLote, respostasAdiadas, type Gravacoes, type LeitorDaCampanha, type RespostaDaOp, type ResultadoDoProcessamento } from '../../../client/src/lib/nuvem/lote'
export { membroAtivo, podeVer } from '../../../client/src/lib/nuvem/permissao'
export { fichaNoEstado, projetarMembros, projetarOpParaJogador } from '../../../client/src/lib/nuvem/projecao'
export {
  CONTA_DO_MESTRE,
  VERSAO_DO_FORMATO,
  type Acao,
  type Conflito,
  type FichaGuardada,
  type FichaNoEstado,
  type Identidade,
  type Membro,
  type MembroProjetado,
  type MensagemDoServidor,
  type Op,
  type OpGravada,
  type Origem,
  type Papel,
  type PresencaNaMesa,
  type Recusada,
  type Visibilidade,
} from '../../../client/src/lib/nuvem/tipos'
export { personagemDoArquivo } from '../../../client/src/lib/personagem'
export { hashHex, MIDIA_MAX_BYTES, tipoDosBytes, type TipoDeMidia } from '../../../client/src/lib/midia'
