/**
 * A MESA DA BATALHA (pedido de 18/11/2026: "esse negócio de batalha é para ter
 * um menu separado que dá até para abrir uma janela nova fora, para ter o
 * controle total"). Uma tela só, em dois lugares: no meio do app (um diálogo
 * por cima do mapa) e numa janela do Windows à parte (`batalha.html`, que vai
 * para o segundo monitor).
 *
 * A janela principal é a fonte da verdade: as stores, a mesa, o disco e a sala
 * moram nela. A tela lê só o ESPELHO (dado puro, clonável pelo
 * `BroadcastChannel`) e manda PEDIDOS de uma lista fechada; quem aplica é sempre
 * a principal (`mesa.ts`), com as mesmas ações das stores que o livro usa. Por
 * isso o estado nunca diverge entre as janelas.
 */

/** O motor da batalha da cena aberta. */
export type SistemaDaMesa = 'op' | 'dbt'

/** Um recurso de atual e máximo (HP, SP, PV, Ki). */
export interface RecursoNoEspelho {
  rotulo: string
  atual: number
  maximo: number
  tom: 'vida' | 'energia' | 'neutro'
}

/** Uma carta da ordem. */
export interface CartaNoEspelho {
  /** One Piece: o id da carta (a extra tem o seu). Dragon Ball: o id do combatente. */
  id: string
  nome: string
  npc: boolean
  /** A cor da equipe (One Piece); `null` = sem cor. */
  cor: string | null
  /** A equipe (One Piece) ou o lado (Dragon Ball); `null` = sem. */
  lado: string | null
  /** O total da iniciativa (Dragon Ball); `null` = não rolou, ou o motor não tem número (One Piece ordena pela Agilidade). */
  iniciativa: number | null
  recursos: readonly RecursoNoEspelho[]
  caiu: boolean
  vez: boolean
  proxima: boolean
  /** Selos, condições, forma, carta extra: o que a carta mostra em pílulas. */
  marcas: readonly string[]
}

/** Uma ação do combatente da vez (técnica, arma, ação do motor). */
export interface GolpeNoEspelho {
  chave: string
  nome: string
  /** "Simples · dano 120 · 45 SP". */
  detalhe: string
  /** Presente = a regra apaga a ação agora (recarga, custo, ação gasta), com a frase. */
  motivo: string | null
  /** Presente = a ação pede escolhas que só o menu do mapa faz (custo à mão, opção, pergunta), com a frase. */
  noMapa: string | null
  alvo: 'nenhum' | 'um' | 'varios'
  alvosMax: number
  /** Os alvos que valem para esta ação; `null` = todos os da lista sem motivo. */
  alvosPermitidos: readonly string[] | null
}

/** Um alvo possível da vez. */
export interface AlvoNoEspelho {
  id: string
  nome: string
  lado: 'eu' | 'aliado' | 'outro'
  caiu: boolean
  /** Presente = não pode ser alvo, com a frase. */
  motivo: string | null
  /** "CA 14, EP 3, PV 40"; `null` = nada a dizer. */
  detalhe: string | null
}

/** O combatente da vez. */
export interface VezNoEspelho {
  /** A identidade da vez (rodada, carta, turno): o pedido leva esta chave e a principal recusa se a vez já andou. */
  chave: string
  quem: string
  npc: boolean
  /** "NPC · Marinha", "Jogador". */
  descricao: string
  recursos: readonly RecursoNoEspelho[]
  golpes: readonly GolpeNoEspelho[]
  alvos: readonly AlvoNoEspelho[]
  sugestao: { golpe: string | null; alvo: string | null }
  /** Uma frase no lugar das ações (o jogador escolhe na tela dele; a trava do Atordoado); `null` = nada. */
  aviso: string | null
}

/** Uma resposta que o mestre dá daqui a um pedido que espera. */
export interface RespostaNoEspelho {
  chave: string
  rotulo: string
  bloqueio: string | null
}

/** Um pedido esperando alguém (reação de jogador ou de NPC, teste, Choque). */
export interface PendenteNoEspelho {
  id: string
  titulo: string
  /** Quem responde: "Lia (jogador)", "Você". */
  quem: string
  doMestre: boolean
  /** `Date.now()` de quando começou a esperar; `null` = não se sabe. */
  desde: number | null
  /** A primeira da fila (Dragon Ball resolve uma por vez); no One Piece todas valem. */
  ativa: boolean
  respostas: readonly RespostaNoEspelho[]
  /** O que a resposta daqui não cobre ("Rolar a esquiva: na carta REAÇÃO do mapa"); `null` = nada. */
  nota: string | null
}

/** Uma linha do registro, a mais nova primeiro. */
export interface LinhaNoEspelho {
  id: string
  rodada: number
  autor: string
  texto: string
  desfeita: boolean
  podeDesfazer: boolean
}

/** Tudo o que a tela mostra, de uma cena. */
export interface EspelhoDaBatalha {
  sistema: SistemaDaMesa
  sceneKey: string
  fase: 'iniciativa' | 'combate'
  rodada: number
  turno: { n: number; m: number } | null
  vez: VezNoEspelho | null
  ordem: readonly CartaNoEspelho[]
  pendentes: readonly PendenteNoEspelho[]
  registro: readonly LinhaNoEspelho[]
  /** A linha que o Desfazer do pé desfaz; `null` = nada a desfazer. */
  desfazer: { linhaId: string; texto: string } | null
  /** O Passar a vez vale (há vez e a fase é de combate). */
  podePassar: boolean
  /** A frase da confirmação do Encerrar. */
  avisoDoEncerrar: string
  /** Avisos do motor ("Lado Saiyajin sem ninguém de pé"). */
  avisos: readonly string[]
}

/** O que a tela pede. Lista fechada: a principal confere cada campo antes de aplicar (`protocolo.ts`). */
export type PedidoDaMesa =
  | { acao: 'passar'; sceneKey: string; vez: string }
  | { acao: 'darVez'; sceneKey: string; cartaId: string }
  | { acao: 'agir'; sceneKey: string; vez: string; golpe: string; alvos: readonly string[] }
  | { acao: 'responder'; sceneKey: string; pendente: string; resposta: string }
  | { acao: 'desfazer'; sceneKey: string; linhaId: string }
  | { acao: 'iniciativa'; sceneKey: string; passo: 'rolar' | 'comecar' }
  | { acao: 'encerrar'; sceneKey: string }

/** A volta de um pedido: `ok`, ou a frase do porquê não. */
export interface RespostaDaMesa {
  ok: boolean
  motivo: string | null
}
