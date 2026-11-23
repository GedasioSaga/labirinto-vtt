/**
 * A MESA DA BATALHA (pedido de 18/11/2026: "esse negócio de batalha é para ter
 * um menu separado que dá até para abrir uma janela nova fora, para ter o
 * controle total"). Uma tela só, em dois lugares: encostada na direita do
 * mapa do app (o protótipo aprovado em 19/11, docs/design/mesa-da-batalha/) e
 * numa janela do Windows à parte (`batalha.html`, que vai para o segundo
 * monitor, onde vira duas colunas).
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

/**
 * Um item do MENU DA CARTA do mestre (o mesmo da faixa do alto: `itensDaCartaDoMestre`,
 * `itensDaCartaDoMestreDBT`), sem a função: escolhido na tela, vira o pedido `itemDaCarta`.
 */
export interface ItemDaCartaNoEspelho {
  id: string
  rotulo: string
  /** Segunda linha apagada: o que o item faz, ou por que está desligado; `null` = nada. */
  detalhe: string | null
  /** Começa um trecho com este título ("Equipe"); `null` = segue o anterior. */
  secao: string | null
  perigo: boolean
  desabilitado: boolean
  /** Escolha única (equipe, lado, situação): `true` = a atual; `null` = item de ação. */
  marcado: boolean | null
  cor: string | null
  /** Abre uma janela do app (perfil, ficha, diálogo): na janela à parte, ela abre na principal. */
  abreNoApp: boolean
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
  /** A posição na ordem, de 1 em diante. */
  posicao: number
  /** Já passou nesta rodada (vem antes da vez na ordem). */
  agiu: boolean
  /** O menu da carta do mestre (dar a vez, agir de novo, ajustar, selo, tirar da batalha…). */
  menu: readonly ItemDaCartaNoEspelho[]
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
  /**
   * REQUISITOS G: o cinza é só dos requisitos (o `motivo` é o que falta): o mestre usa mesmo assim, e o
   * pedido vai com `forcar`. Com `noMapa`, o "mesmo assim" é pelo menu do mapa.
   */
  forcavel: boolean
  alvo: 'nenhum' | 'um' | 'varios'
  alvosMax: number
  /** Os alvos que valem para esta ação; `null` = todos os da lista sem motivo. */
  alvosPermitidos: readonly string[] | null
  /** O dano da ficha (o Dano base do ajuste); `null` = sem dano, ou o motor não diz número. */
  dano: number | null
  /** Perfurante da técnica (o ajuste começa por ele). */
  perfurante: boolean
  /** O ajuste do dano (Dano base, Surpresa, Perfurante) vale nesta ação: só o One Piece, golpe com dano. */
  ajustavel: boolean
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
  /** A posição na ordem, de 1 em diante. */
  posicao: number
  /** Quando a vez começou (a linha da vez no registro); `null` = não se sabe. */
  desde: number | null
  /** O que sobrou da vez ("Simples 1", "Mov 0/1"); `gasto` = acabou. */
  pips: readonly { texto: string; gasto: boolean }[]
  /** O que já aconteceu nesta vez, a mais nova primeiro (as linhas do registro desde a vez). */
  feitos: readonly string[]
  /** One Piece, vez de NPC: o menu da vez pode abrir sobre o mapa (para o golpe que pede escolha a mais). */
  menuDoMapa: boolean
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
  /** One Piece: o golpe que espera a reação (o quadro da troca e a régua do d20); `null` = outro pedido (Dragon Ball). */
  golpe: {
    nome: string
    de: string
    alvo: string
    chega: number | null
    rolou: { d20: number; total: number } | null
    /** O que cai na ficha por saída do d20 (a régua), pela regra (`danoFinal`), antes das reduções da forma; `null` = golpe sem dano. */
    danos: { critico: number; cheio: number; metade: number } | null
  } | null
}

/** O contra-ataque (20 na reação) que segura a vez: quem ganhou escolhe o golpe, depois a vez volta. */
export interface ContraNoEspelho {
  /** O golpe em que o contra nasceu (a chave do pedido). */
  golpeId: string
  quem: string
  /** Quem atacou primeiro: o alvo sugerido, e para quem a vez volta. */
  de: string
  doMestre: boolean
  desde: number | null
  /** As ações de quem contra-ataca (NPC); jogador = vazio, ele escolhe na tela dele. */
  golpes: readonly GolpeNoEspelho[]
  alvos: readonly AlvoNoEspelho[]
  /** O alvo sugerido: quem atacou. */
  alvoSugerido: string | null
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
  /** One Piece: o contra-ataque que segura a vez agora; `null` = nenhum. */
  contra: ContraNoEspelho | null
  /** Alguma ficha andou com a batalha ligada (o Zerar caminhos tem o que zerar). */
  temCaminhos: boolean
  /** One Piece: a ordem pode ser refeita pela Agilidade. */
  podeOrdenar: boolean
  /** O menu da vez está aberto sobre o mapa do app (pedido pela mesa). */
  menuDoMapaAberto: boolean
  /** As chaves do combate deste computador (One Piece), no "Mais"; `null` = o motor não tem (Dragon Ball). */
  chaves: ChavesNoEspelho | null
  /**
   * O que o mestre deixou para depois pelo "Seguir sem esperar" em qualquer tela do app (as chaves dos pendentes e
   * `contra:<golpe>`): a mesa soma ao que ela mesma deixou. Dragon Ball: vazio (a fila dele mora só na mesa).
   */
  deixados: readonly string[]
}

/** As chaves do combate, guardadas no computador do mestre (as mesmas do painel da batalha). */
export interface ChavesNoEspelho {
  /** A câmera traz a ficha da vez para a vista. */
  camera: boolean
  /** Os sons do combate tocam. */
  som: boolean
}

/** O ajuste do golpe na mesa (o mesmo da mira do mapa): `dano` `null` = o da ficha. */
export interface AjusteDoGolpe {
  dano: number | null
  surpresa: boolean
  perfurante: boolean
}

/** O que a tela pede. Lista fechada: a principal confere cada campo antes de aplicar (`protocolo.ts`). */
export type PedidoDaMesa =
  | { acao: 'passar'; sceneKey: string; vez: string }
  | { acao: 'darVez'; sceneKey: string; cartaId: string }
  /** Um item do menu da carta (`CartaNoEspelho.menu`): a principal remonta o menu e aplica o item com este id. */
  | { acao: 'itemDaCarta'; sceneKey: string; cartaId: string; item: string }
  /** `forcar` (REQUISITOS G): o "Usar mesmo assim" do golpe cinza só pelos requisitos (`GolpeNoEspelho.forcavel`). */
  | { acao: 'agir'; sceneKey: string; vez: string; golpe: string; alvos: readonly string[]; ajuste?: AjusteDoGolpe; forcar?: true }
  /** O contra-ataque do NPC: o golpe dele fora da vez. */
  | { acao: 'contra'; sceneKey: string; golpeId: string; golpe: string; alvos: readonly string[]; ajuste?: AjusteDoGolpe; forcar?: true }
  /** O contra-ataque gasto em se mover (o jeito de abrir mão dele). */
  | { acao: 'abrirMao'; sceneKey: string; golpeId: string }
  | { acao: 'ordenar'; sceneKey: string }
  | { acao: 'zerarCaminhos'; sceneKey: string }
  /** Abre a página Batalha do livro no app (dano, selos, extras, regras, formas). */
  | { acao: 'abrirLivro'; sceneKey: string }
  /** Liga ou desliga o menu da vez sobre o mapa do app. */
  | { acao: 'menuDoMapa'; sceneKey: string; ligar: boolean }
  /** Liga ou desliga uma chave do combate (a câmera que segue a vez, o som). */
  | { acao: 'chave'; sceneKey: string; chave: keyof ChavesNoEspelho; ligar: boolean }
  /** O "Seguir sem esperar" da mesa: as chaves dos pendentes (e `contra:<golpe>`) ficam para depois nas telas do app também. */
  | { acao: 'seguir'; sceneKey: string; chaves: readonly string[] }
  | { acao: 'responder'; sceneKey: string; pendente: string; resposta: string }
  | { acao: 'desfazer'; sceneKey: string; linhaId: string }
  | { acao: 'iniciativa'; sceneKey: string; passo: 'rolar' | 'comecar' }
  | { acao: 'encerrar'; sceneKey: string }
  /** A escolha da mesa acende as casas do alcance no mapa do app (só One Piece); `null` = apagar (lançou, cancelou, saiu). */
  | { acao: 'mira'; sceneKey: string; mira: MiraDaMesa | null }

/**
 * O golpe e os alvos marcados na mesa, para a principal montar a mira no mapa com a mesma conta do menu da vez.
 * `tipo` diz de onde vem a escolha: a vez do NPC (`id` = a chave da vez) ou o contra-ataque dele (`id` = o golpe que ele responde).
 */
export interface MiraDaMesa {
  tipo: 'vez' | 'contra'
  id: string
  golpe: string
  alvos: readonly string[]
}

/** A volta de um pedido: `ok`, ou a frase do porquê não. */
export interface RespostaDaMesa {
  ok: boolean
  motivo: string | null
}
