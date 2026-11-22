/**
 * CONTRATO DA SESSÃO DO HOST: as opções de `createHostSession` e tudo o que a
 * sessão oferece ao integrador (`HostSession`). Saiu de hostSession.ts sem
 * mudar nada; os tipos dos resultados continuam lá, e hostSession.ts
 * reexporta estes dois (quem importa de lá não muda).
 */
import type { AbaloOrigem, AbaloTextos } from '../lib/abalo'
import type { BolhaAoVivo, BolhaConviteResultado } from './bolhaNoHost'
import type { AlavancaAoVivo, AlavancaConviteResultado, AlavancaDesfechoSinal, AlavancaVivoNoMestre } from './alavancaNoHost'
import type { CaminhosNoMestre } from '../lib/batalha/caminhoAndado'
import type { Casa } from '../lib/batalha/blocos'
import type { ChatHistory } from '../lib/chatStore'
import type { ContasNaSala } from '../lib/contasDosJogadores'
import type { DancaAoVivo, DancaConviteResultado } from './dancaNoHost'
import type { DiceRequest, RollDie } from '../lib/dice'
import type { DificuldadeBolha, ModoBolha } from '../minigames/bolha/tipos'
import type { DificuldadeFogo, FerramentaFogo, ModoFogo } from '../minigames/fogo/tipos'
import type { FalasDitas, LeiturasDosCenarios } from '../types/cenarioEFalas'
import type { FogoAoVivo, FogoConviteResultado } from './fogoNoHost'
import type { LaserMessage } from './protocol'
import type { MapData } from '../types/map'
import type { PeriodoLido } from '../lib/periodo'
import type { PescaAoVivo, PescaConviteResultado } from './pescaNoHost'
import type { PuzzleAoVivo } from './puzzleNoHost'
import type { PecaDoAcervo } from '../puzzles/tipos'
import type { Documento } from '../documentos/tipos'
import type { PointActionAnswer } from '../lib/pointActions'
import type { PonteDaBatalha } from '../lib/batalha/ponte'
import type { PonteDaBatalhaDBT } from '../lib/dbt/batalha/ponte'
import type { SavedSeat, SavedSeatExploration, SavedSeatNotes } from '../lib/savedTable'
import type { TiroAoVivo, TiroConviteResultado } from './tiroNoHost'
import type { TradeProposal } from '../lib/troca'
import type { AbaloResult, CallTarget, CaravanArrival, CaravanFollow, EntradaComConta, GatherArrival, HeldTokens, HostMapSource, HostResult, LoanTerms, MapChangeCause, MasterCall, MasterChatState, PartesDoBroadcast, PinClueState, PlayerInfo, PlayerNoteDelivery, SecretCheckState, TradeProposeRefusal, TravelRequestStatus } from './hostSession'

export interface HostSessionOptions {
  code: string
  visionRadius: number
  now?: () => number
  randomId?: () => string
  /**
   * PUZZLES: o item do acervo do mestre pelo id, como vai para a mochila (a
   * peça guardada da Troca de peso). Ausente = nenhum: a troca é recusada com
   * `mudou`, e as pedras ficam e voltam.
   */
  pecaDoAcervo?: (itemId: string) => PecaDoAcervo | null
  /**
   * DOCUMENTOS: a biblioteca "Documentos" do app, lida a cada recorte e a cada
   * leitura (a mesma referência enquanto nada muda: a sessão guarda o que tira
   * dela). Ausente = nenhuma: nenhum papel sai e toda leitura é recusada.
   */
  documentosDaBiblioteca?: () => readonly Documento[]
  /**
   * MODO BATALHA (fatia B4): a cena `sceneKey` (`tableSceneKey`) está em
   * batalha? Lido a cada snapshot e a cada pedido de movimento; mora só na
   * sessão do mestre (`stores/batalhaStore.ts`), nunca no arquivo. Ausente =
   * nenhuma cena em batalha. Só vale em grade quadrada.
   */
  getBatalha?: (sceneKey: string) => boolean
  /**
   * MODO BATALHA: o host aceitou `blocos` (> 0) para a ficha `tokenId` na cena `sceneKey`, andando `casas` — o caminho andado soma.
   * `jogador` é quem andou (só passo de jogador passa aqui): a batalha DBT assina a linha com ele, para ele poder desfazer.
   */
  onBatalhaAndou?: (sceneKey: string, tokenId: string, blocos: number, casas: readonly Casa[], jogador: { playerId: string; nome: string }) => void
  /**
   * MODO BATALHA (B6): o caminho andado da cena `sceneKey` no mestre
   * (`stores/batalhaStore.ts`), com o `rev` que sobe a cada mudança. Cada
   * jogador recebe só o que vê (`caminhosParaJogador`). Ausente ou `null` = sem caminho.
   */
  getCaminhosDaBatalha?: (sceneKey: string) => (CaminhosNoMestre & { readonly rev: number }) | null
  /**
   * BATALHA F1 (ordem dos turnos): a store do mestre (`stores/batalhaStore.ts`,
   * `ponteDaBatalha`). O host lê a cena para o recorte de cada jogador
   * (`batalha.estado`, `batalha.aliados`) e repassa os pedidos do jogador já
   * conferidos ("Passar a vez", Desfazer) e os ajustes rápidos da ficha (que
   * viram linha no registro). Ausente = nenhuma ordem dos turnos sai.
   */
  ponteDaBatalha?: PonteDaBatalha
  /**
   * BATALHA DRAGON BALL TALES: a store DBT do mestre (`stores/batalhaDBTStore.ts`,
   * `ponteDaBatalhaDBT`). Mesmo papel da `ponteDaBatalha`, por mensagens
   * próprias (`batalhaDBT.*`). Ausente = nenhuma batalha DBT sai.
   */
  ponteDaBatalhaDBT?: PonteDaBatalhaDBT
  /**
   * Fase 8 (o "Usar" fora da batalha): usa o item na mesa do mestre, depois
   * de o host conferir que a ficha é do jogador (`stores/usoDoItemFora.ts`).
   * Devolve a linha do chat, ou o motivo da recusa. Ausente = o host recusa.
   */
  usarItemFora?: (pedido: { sceneKey: string; tokenId: string; personagemId: string; vagaId: string; alvoPersonagemId: string; quem: string }) => { ok: true; texto: string } | { ok: false; motivo: string }
  /**
   * MODO BATALHA (regra de 27/10): a ficha de `nome` parou numa parede que o
   * recorte dele não tem (`invisivel`: alguma delas é parede invisível; senão
   * ainda estava na névoa dele). A parede passa a valer como explorada para
   * ele; só o mestre fica sabendo do esbarrão.
   */
  onEsbarrouNaParede?: (nome: string, invisivel: boolean) => void
  /**
   * DIA/TARDE/NOITE: o período da sessão no mestre, lido a cada recorte.
   * Ausente ou `null` = mestre sem período (o campo `luz` nem sai). Cada
   * jogador recebe só o período da cena DELE (`periodoDaCena`) e a tinta
   * dele (`luzParaJogador`); à noite a visão dele cai (`raioNoPeriodo`).
   */
  getPeriodo?: () => PeriodoLido | null
  /** Chave da tela da mesa (teste). Ausente = um UUID novo por sala, fora de `randomId`. */
  tableKey?: string
  /**
   * Retomar a mesa: os assentos guardados. Quem entra (sem resume) com o nome
   * de um deles — sem maiúsculas nem espaços — reencontra as fichas, o raio e
   * a cena; cada assento vale uma vez. Ausente = a sala de hoje.
   */
  restoreSeats?: readonly SavedSeat[]
  /**
   * Retomar a mesa: o mapa explorado de cada assento guardado (por nome). Só
   * quem REENCONTRA o assento recebe a memória dele; ela chega ao jogador pelo
   * recorte de sempre, cena a cena. Ausente = todos começam do zero.
   */
  restoreExploration?: readonly SavedSeatExploration[]
  /**
   * MINHAS NOTAS guardadas da mesa, por nome (`lib/savedTable.ts`). Quem entra
   * (sem resume) com o nome delas as recebe de volta, com ou sem assento: a nota
   * é do jogador, não da ficha. Ausente = ninguém tem nota guardada.
   */
  restoreMyNotes?: readonly SavedSeatNotes[]
  /**
   * CHAT SALVO (fatia B): a conversa guardada da mesa (`lib/chatStore.ts`),
   * já lida do disco. Entra na história de cada canal como se tivesse sido
   * dita nesta sala: quem chega (ou chega na cena) recebe as últimas
   * `CHAT_HISTORY_MAX`. Não sai como mensagem nova e, para o mestre, não
   * conta como não lida (`MasterChatState.restoredIds`). Ausente = sem histórico.
   */
  restoreChat?: ChatHistory
  /** O dado do host. Ausente = o gerador do sistema (`secureRollDie`); o teste injeta faces fixas. */
  rollDie?: RollDie
  /** Só para teste: troca `PATCH_MIN_SNAPSHOT_LENGTH` (0 = todo mapa recebe patch). */
  patchMinSnapshotLength?: number
  /**
   * CONTAS DOS JOGADORES (`lib/contasDosJogadores.ts`), lidas a cada `join`
   * SEM conta: com `soComConta`, quem só digita o nome é recusado
   * (`account_required`); e digitar o nome de uma conta não leva o assento
   * guardado nem as notas dela — isso é de quem entra COM a conta. Ausente =
   * ninguém tem conta (a sala de antes).
   */
  contas?: () => ContasNaSala
}

export interface HostSession {
  handleMessage(clientId: string, raw: unknown, source: HostMapSource): HostResult
  /**
   * CONTAS DOS JOGADORES: a entrada de quem a ponte JÁ conferiu (nome + PIN ou
   * aparelho lembrado). Não chega pela rede: o `join` com `pin` ou `device` que
   * vem por `handleMessage` é recusado. A conta que já está na sala volta a
   * ser o mesmo jogador (como o resume, de qualquer aparelho); a que chega
   * reencontra o assento e as notas guardadas pelo nome dela e recebe as
   * fichas dos personagens que o mestre lhe deu — só as que ninguém segura.
   */
  joinWithAccount(clientId: string, entrada: EntradaComConta, source: HostMapSource): HostResult
  /** Devolve `lobby.waiting` para quem perdeu o último token (dono anterior). */
  assignToken(playerId: string, tokenId: string): HostResult
  /** Devolve `lobby.waiting` se o jogador ficou sem token. Desfaz o empréstimo da ficha, se era um. */
  unassignToken(playerId: string, tokenId: string): HostResult
  /**
   * AJUDANTE CONTRATADO: empresta a ficha ao jogador com tarefa, prazo e
   * visão. Tira a ficha de quem a tinha (como `assignToken`). O jogador lê o
   * acordo e o nome público do NPC, não renomeia a ficha e só vê pelos olhos
   * dela com `visao`. Jogador desconhecido ou prazo que não é número positivo:
   * nada. Não envia snapshot: o integrador faz o broadcast.
   */
  lendToken(playerId: string, tokenId: string, terms: LoanTerms): HostResult
  /**
   * Devolve ao mestre toda ficha cujo prazo venceu, com o recado "… voltou ao
   * mestre" só para quem a segurava. `broadcast` e `handleMessage` já fazem
   * isto sozinhos; o integrador chama no prazo para não esperar ninguém mexer.
   */
  expireLoans(source: HostMapSource): HostResult
  /** O fim de acordo mais próximo (ms, relógio de `now`), ou `null` sem prazo pendente. */
  nextLoanDeadline(): number | null
  /**
   * EMPRESTAR A FICHA de quem saiu: as fichas de `ownerId` (fora) passam a ser
   * movidas também por `borrowerId` (conectado), até o dono voltar. O dono não
   * muda: a mesa grava a ficha no assento dele, e o que ela vê entra no
   * explorado dele. Só fichas de UMA cena — a de quem recebe, se ele já está
   * numa; senão, a do dono —: ninguém passa a ver duas cenas. Quem joga
   * emprestado não troca o nome nem a foto da ficha. `lent`: as fichas
   * emprestadas agora; vazio = nada mudou (dono conectado ou desconhecido,
   * quem recebe fora, o mesmo jogador, ficha já emprestada ou de outra cena).
   * Não envia: o integrador faz o broadcast.
   */
  lendTokens(ownerId: string, borrowerId: string, source: HostMapSource): HostResult & { lent: string[] }
  /**
   * "Tomar de volta": encerra os empréstimos das fichas de `ownerId`. Quem as
   * jogava e ficou sem ficha volta à espera. A volta do dono (resume ou "É
   * ela") faz o mesmo sozinha.
   */
  endLoans(ownerId: string): HostResult
  /**
   * A conexão caiu. `at` = quando se ouviu dela por último (a varredura de
   * conexão muda sabe que ela sumiu ANTES de notar); ausente, agora. O
   * resultado só leva algo na DANÇA: quem dançava saiu (o estado aos colegas)
   * e, se era o último, o desfecho.
   */
  disconnect(clientId: string, at?: number): HostResult
  /**
   * Uma mensagem para `clientId` não saiu (ex.: fila da conexão cheia) e a
   * conexão continua aberta. O recorte que o host conta como entregue a esse
   * jogador pode não estar na tela dele: o próximo broadcast refaz e reenvia,
   * mesmo sem a cena dele mudar. Conexão que não é de jogador: nada.
   */
  sendFailed(clientId: string): void
  /**
   * BATALHA (conserto de 18/11/2026): a faixa da batalha que o host conta como entregue a esta conexão
   * não está mais na tela dela. `vazia`: a tela apagou a faixa ao ler o `scene.changed` (no atalho o
   * jogador fica na MESMA cena, o recorte sai igual e não era reenviado: ele ficava fora da batalha).
   * `incerta`: um envio da batalha falhou. O próximo broadcast manda os aliados e o recorte de novo.
   */
  faixaDaBatalhaPerdida(clientId: string, como: 'vazia' | 'incerta'): void
  kick(clientId: string): HostResult
  /**
   * "É ela" da pergunta "Ana voltou?": a conexão de `playerId` (quem entrou
   * agora) passa a ser a Ana `previousId` — fichas, memórias e raio dela, e o
   * resume dela. `playerId` some da lista; o que ele tinha (ficha que o mestre
   * deu nesse meio-tempo, cena que ele viu) passa à Ana. Devolve o `welcome`
   * da Ana e o que ela vê agora, só para essa conexão. Pergunta que já não
   * vale (respondida, a Ana voltou pelo resume, um dos dois saiu): nada.
   */
  confirmReturn(playerId: string, previousId: string, source: HostMapSource): HostResult
  /** "Outra pessoa": a pergunta sai e nada muda. */
  denyReturn(playerId: string): void
  /** A pergunta "voltou?" sobre quem entrou como `playerId` ainda espera o mestre? */
  isReturnPending(playerId: string): boolean
  /**
   * "Dispensar": esquece quem está FORA (o card sai e o resume dele deixa de
   * valer). `false` para quem está conectado — esse é o "Expulsar" — ou
   * desconhecido.
   */
  dismissPlayer(playerId: string): boolean
  /**
   * "Passar fichas e mapa a…": esquece quem está FORA, como o Dispensar, e
   * antes entrega a `heirId` as fichas DELE (a que ele jogava emprestada fica
   * com o dono; a que ele tinha emprestado a outro passa, e o empréstimo
   * acaba), o ajudante contratado com o acordo, e o explorado de cada cena,
   * somado ao de quem recebe. `null` sem mudar nada: dono conectado (esse é o
   * Expulsar), desconhecido, ou `heirId` desconhecido ou o próprio. Não envia
   * snapshot: o integrador faz o broadcast.
   */
  handOverPlayer(playerId: string, heirId: string): (HostResult & { handedTokens: string[] }) | null
  /**
   * `room.closed` para todo jogador conectado (jogando ou aguardando) e toda tela da mesa. O
   * integrador envia isto ANTES de derrubar a sala, para o jogador ler "O
   * mestre encerrou a sala" e não "A conexão caiu". Não mexe no estado.
   */
  closeRoom(): HostResult
  /**
   * Snapshot para todo jogador conectado e jogando, cada um da cena ONDE ELE
   * ESTÁ — mas só para quem a tela mudou desde o último que recebeu, e a quem
   * sabe aplicar só o que mudou nela (`patch`). `rev` sobe a cada chamada,
   * mande ou não.
   * Quem foi parar em outra cena da aventura sem passar pela sessão (a bordo
   * de um veículo, "Levar para…") recebe antes `scene.changed` `by: 'master'`
   * e perde o pedido de passagem que tinha na cena de antes.
   */
  broadcast(source: HostMapSource, partes?: PartesDoBroadcast): HostResult
  /**
   * O mapa do mestre mudou: o ferrolho de porta que ficou aberta, trancada
   * pelo mestre ou apagada sai de vez, em toda cena. Chamado a CADA mudança,
   * antes do broadcast (que espera o intervalo): abrir e fechar a porta dentro
   * dele não pode devolver o ferrolho. `source` só é lido com algum ferrolho de pé.
   */
  podarFerrolhos(source: () => HostMapSource): void
  /**
   * Laser do mestre para todo jogador conectado e jogando (quem aguarda não
   * tem mapa onde desenhar). Com `source`, só para quem está na cena aberta —
   * o mestre aponta no mapa que ele vê.
   */
  laser(message: LaserMessage, source?: HostMapSource): HostResult
  /**
   * RECADO POR CENA: `scene.note` só para quem joga e está AGORA na cena
   * `sceneId` (`sceneFor`). O texto sai cortado no teto (`NOTE_MAX_LENGTH`);
   * vazio não sai. `outbound.length` é quantos receberam AGORA.
   *
   * CADERNO: o recado vira o último da cena e entra no caderno de cada um que
   * recebeu. Quem entra ou volta à sala recebe o caderno dele (`notes.book`)
   * e o último recado da cena onde está; quem chega à cena depois (viagem,
   * ficha nova) recebe o último recado dela no broadcast, se ainda não o tem.
   *
   * `recipients` (RECADO PARA ESCOLHIDOS): só esses jogadores, e só se ainda
   * estiverem na cena — a lista do mestre pode ter ficado velha. Lista vazia =
   * ninguém. O pacote de quem recebe é o mesmo: não diz quem mais leu.
   *
   * FORA DO AR: quem tem ficha na cena e caiu guarda o recado numa fila (até
   * `AWAY_NOTES_MAX`), entregue inteira na volta (`notes.away`), e não só o
   * último da cena. Não conta em `outbound`: não recebeu agora.
   */
  sceneNote(sceneId: string, text: string, source: HostMapSource, recipients?: readonly string[]): HostResult
  /**
   * PAUSA POR CENA: o mestre atende um grupo de cada vez. Com `sceneId`
   * pausada, quem está nela não move a ficha, não pede porta nem passagem —
   * laser e sinal continuam, para o jogador poder chamar o mestre. As ações
   * do MESTRE ("Mandar para…", reunir, "Deixar ir") seguem valendo. Vive só
   * na sessão: fechar a sala esquece. Devolve `scene.paused` a quem mudou.
   */
  setScenePaused(sceneId: string, paused: boolean, source: HostMapSource): HostResult
  isScenePaused(sceneId: string): boolean
  /**
   * RECADO PARA UM JOGADOR SÓ ("Recado" da linha dele no Grupo): `scene.note`
   * com `onlyYou`, só para a conexão DELE — quem está na mesma sala não recebe
   * nem o frame. Está com o mapa na tela: sai agora (`sent`). Caiu, ou está sem
   * ficha: fica guardado (só o último) e sai logo depois do próximo mapa dele
   * (`queued`). Texto vazio ou jogador desconhecido: nada (`null`).
   */
  playerNote(playerId: string, text: string, source: HostMapSource): HostResult & { delivery: PlayerNoteDelivery }
  /**
   * ALARME PARA VÁRIAS CENAS: `scene.alarm` a quem joga e está AGORA numa das
   * `sceneIds` (`sceneFor`), com o texto cortado no teto (`ALARM_MAX_LENGTH`).
   * Diferente do recado, o alarme FICA: substitui o que estiver soando, segue
   * quem entra numa dessas cenas depois (viagem, reconexão) e sai de quem
   * deixa todas elas, até `endAlarm`. Texto vazio ou nenhuma cena existente:
   * nada muda e nada sai.
   */
  sceneAlarm(sceneIds: readonly string[], text: string, source: HostMapSource): HostResult
  /** Encerra o alarme: `scene.alarm.end` só a quem o mostra agora. Sem alarme, nada sai. */
  endAlarm(source: HostMapSource): HostResult
  /** O alarme soando, para o painel do mestre; `null` = nenhum. */
  activeAlarm(): { id: string; text: string; sceneIds: string[] } | null
  /**
   * DADO ROLADO NA SALA pelo mestre: o host rola e devolve a rolagem em
   * `diceRoll`. Aberta, `dice.rolled` vai a todo jogador conectado, como
   * "Mestre"; `hidden`, não sai para ninguém — só a tela do mestre a mostra.
   */
  masterRoll(request: DiceRequest, hidden: boolean): HostResult
  /**
   * CHAT, leitura do mestre (fatia D): o Global e cada cena que já teve
   * conversa, com o nome dela no mundo de `source` (`null` = a cena saiu da
   * aventura). As linhas vêm inteiras: todas as menções, o `@mestre` também.
   * São cópias. `chatChanged` no resultado diz quando reler.
   */
  masterChat(source: HostMapSource): MasterChatState
  /**
   * CHAT: o mestre fala no Global (só nele: a cena é só leitura para ele). A
   * linha chega a todo jogador com ficha, com `fromMaster`. Texto vazio
   * depois da limpeza, ou acima de `CHAT_TEXT_MAX_LENGTH`: nada sai (`sent: false`).
   */
  masterChatSend(text: string): HostResult & { sent: boolean }
  /**
   * CHAT: o mestre apaga a linha `id` do Global (`sceneKey` `null`) ou da cena
   * `sceneKey`: some da história e da tela de todos (`chat.delete`). Com
   * `deleted: true`, o integrador tira a linha do JSONL do canal (fatia B;
   * mídia, fatia C, não existe). `deleted: false` = a linha já não estava lá.
   */
  masterChatDelete(sceneKey: string | null, id: string): HostResult & { deleted: boolean }
  /**
   * RUÍDO NO MAPA: o mestre fez um ruído em (`x`, `y`) da cena ABERTA no
   * editor (é o mapa em que ele clicou). Quem joga nessa cena e tem ficha a
   * até `rangeCells` casas (preso na faixa de `lib/noise.ts`) recebe `noise`
   * só com a DIREÇÃO, pelo recorte de `noiseCueForPlayer`. Nada fica guardado:
   * quem entra depois não ouve. `outbound.length` é quantos ouviram.
   */
  noise(x: number, y: number, rangeCells: number, source: HostMapSource): HostResult
  /**
   * TESTE SECRETO: `secret.check` (só id e nome do teste, aparado e cortado
   * no teto) para os escolhidos que estão na sala e jogando, estejam em que
   * cena estiverem. Quem não foi escolhido não recebe nada. Escolhido que
   * caiu recebe o pedido ao voltar, enquanto não responder e o mestre não
   * encerrar. Nome vazio ou ninguém válido: nada, e nenhum teste é criado.
   * `secretCheckId` no resultado é o id do teste criado.
   */
  secretCheck(label: string, playerIds: readonly string[]): HostResult
  /** Encerra o teste: `secret.check.closed` a quem foi pedido, está conectado e não respondeu. Resposta depois disso não conta. */
  closeSecretCheck(checkId: string): HostResult
  /** Os testes secretos, do mais antigo ao mais novo, para o painel do MESTRE. */
  secretChecks(): SecretCheckState[]
  /**
   * MINIGAME DE DANÇA: `danca.convite` (o desafio do pino `pinId`, congelado
   * agora) aos escolhidos que estão na sala e jogando, na ordem da sala, até
   * `DANCA_PARTICIPANTES_MAX`. Recusa pino que não é minigame, dança ativa
   * (uma por vez) e lista sem ninguém válido.
   */
  convidarParaDanca(pinId: string, playerIds: readonly string[], source: HostMapSource): HostResult & { convite: DancaConviteResultado }
  /** Só os prontos (e na sala) dançam; os outros recebem `danca.encerra` `fora`. `comecou: false` = ninguém pronto. */
  comecarDanca(): HostResult & { comecou: boolean }
  /** Pausa e retoma para todos os que dançam. `ok: false` = fora de fase. */
  pausarDanca(): HostResult & { ok: boolean }
  retomarDanca(): HostResult & { ok: boolean }
  /** Encerra a dança ativa sem desfecho: nada foi ganho nem perdido. */
  encerrarDanca(): HostResult & { ok: boolean }
  /** A dança como o painel do MESTRE a lê (a última, mesmo terminada); `null` = nenhuma nesta sala. */
  danca(): DancaAoVivo | null
  /**
   * MINIGAME FOGO NA FLORESTA: `fogo.convite` (o desafio do pino `pinId`,
   * congelado agora) aos escolhidos que estão na sala e jogando, na ordem da
   * sala, cada um com a ferramenta inicial que o mestre deu. Equipe: até 6 no mesmo
   * incêndio; solo: cada um no seu. Recusa pino que não é de fogo, fogo ativo
   * (um por vez) e lista sem ninguém válido.
   */
  convidarParaFogo(pinId: string, convidados: readonly { playerId: string; ferramenta: FerramentaFogo }[], modo: ModoFogo, source: HostMapSource): HostResult & { convite: FogoConviteResultado }
  /** O mestre troca a ferramenta inicial de alguém (só no convite). */
  mudarFerramentaNoFogo(playerId: string, ferramenta: FerramentaFogo): HostResult & { ok: boolean }
  /** Só os prontos (e na sala) jogam; os outros recebem `fogo.encerra` `fora`. `comecou: false` = ninguém pronto. */
  comecarFogo(dificuldade: DificuldadeFogo): HostResult & { comecou: boolean }
  pausarFogo(): HostResult & { ok: boolean }
  retomarFogo(): HostResult & { ok: boolean }
  /** Encerra o fogo ativo sem desfecho. */
  encerrarFogo(): HostResult & { ok: boolean }
  /** O REPASSE do lockstep: as entradas que chegaram desde o último, a cada colega (a ponte chama a cada `FOGO_REPASSE_MS`). */
  repassarFogo(): HostResult
  /** O fogo como o painel do MESTRE o lê (o último, mesmo terminado); `null` = nenhum nesta sala. */
  fogo(): FogoAoVivo | null
  /**
   * MINIGAME BOLHA D'ÁGUA: `bolha.convite` (o desafio do pino `pinId`,
   * congelado agora) aos escolhidos que estão na sala e jogando, na ordem da
   * sala. Equipe: até 6, todos com a mesma partida (cada um na sua cópia);
   * solo: cada um no seu. Recusa pino que não é de bolha, bolha ativa (uma
   * por vez) e lista sem ninguém válido.
   */
  convidarParaBolha(pinId: string, playerIds: readonly string[], modo: ModoBolha, source: HostMapSource): HostResult & { convite: BolhaConviteResultado }
  /** Só os prontos (e na sala) jogam; os outros recebem `bolha.encerra` `fora`. `comecou: false` = ninguém pronto. */
  comecarBolha(dificuldade: DificuldadeBolha): HostResult & { comecou: boolean }
  pausarBolha(): HostResult & { ok: boolean }
  retomarBolha(): HostResult & { ok: boolean }
  /** Encerra a bolha ativa sem desfecho. */
  encerrarBolha(): HostResult & { ok: boolean }
  /** A bolha como o painel do MESTRE a lê (a última, mesmo terminada); `null` = nenhuma nesta sala. */
  bolha(): BolhaAoVivo | null
  /**
   * MINIGAME ALAVANCA DA PONTE: `alavanca.convite` (o desafio do pino `pinId`
   * e a porta ligada, congelados agora) aos escolhidos que estão na sala e
   * jogando, na ordem da sala, até 4 girando juntos. Recusa pino que não é de
   * alavanca, alavanca ativa (uma por vez) e lista sem ninguém válido.
   */
  convidarParaAlavanca(pinId: string, playerIds: readonly string[], source: HostMapSource): HostResult & { convite: AlavancaConviteResultado }
  /** Começa com os prontos (e na sala); os outros recebem `alavanca.encerra` `fora`. `comecou: false` = ninguém pronto. */
  comecarAlavanca(): HostResult & { comecou: boolean }
  /** Pausa para todos; só o mestre continua a pausa dele. */
  pausarAlavanca(): HostResult & { ok: boolean }
  retomarAlavanca(): HostResult & { ok: boolean }
  /** Encerra a alavanca ativa sem desfecho (a ponte continua erguida). */
  encerrarAlavanca(): HostResult & { ok: boolean }
  /**
   * O RELÓGIO da rodada: aplica os apertos que chegaram, avança a ponte e manda
   * `alavanca.vivo` a quem gira (a ponte chama a cada `ALAVANCA_REPASSE_MS`).
   * Com a ponte baixada ou a corrente vencendo, sai o `alavanca.fim` e o sinal do desfecho.
   */
  repassarAlavanca(): HostResult & { alavancaDesfecho?: AlavancaDesfechoSinal }
  /** A alavanca como o painel do MESTRE a lê (a última, mesmo terminada); `null` = nenhuma nesta sala. */
  alavanca(): AlavancaAoVivo | null
  /** A rodada ao vivo (tempo, ponte, corrente, giros), lida pelo painel a cada 100 ms; `null` = sem rodada. */
  vivoDaAlavanca(): AlavancaVivoNoMestre | null
  /**
   * MINIGAME DE PESCA ("Mestre chama"): `pesca.convite` (o desafio do pino
   * `pinId`) aos escolhidos que estão na sala e jogando, na ordem da sala, até
   * `PESCA_PARTICIPANTES_MAX`. Entram na sessão do pino se ela ainda tem
   * alguém pescando; senão abre outra. Recusa pino que não é de pesca e lista
   * sem ninguém válido (quem já pesca em algum pino não conta).
   */
  convidarParaPesca(pinId: string, playerIds: readonly string[], source: HostMapSource): HostResult & { convite: PescaConviteResultado }
  /** Pausa e retoma a pesca do pino para todos que estão nela. `ok: false` = sem sessão naquela fase. */
  pausarPesca(pinId: string): HostResult & { ok: boolean }
  retomarPesca(pinId: string): HostResult & { ok: boolean }
  /** Encerra a pesca do pino: quem ainda estava no jogo recebe `pesca.encerra`. Sem efeito nenhum. */
  encerrarPesca(pinId: string): HostResult & { ok: boolean }
  /** Cada pino com pesca (aberta, pausada ou a última encerrada), como o painel do MESTRE lê. */
  pesca(): PescaAoVivo[]
  /** PUZZLES: quem está dentro de cada puzzle agora (só quem está na sala), como a página Jogos do MESTRE lê. */
  puzzlesAoVivo(): PuzzleAoVivo[]
  /**
   * MINIGAME DE TIRO ("Mestre chama"): `tiro.convite` (o desafio do pino
   * `pinId`) aos escolhidos que estão na sala e jogando, até
   * `TIRO_PARTICIPANTES_MAX`, com as tentativas zeradas. Recusa pino que não é
   * de tiro e lista sem ninguém livre (quem está noutra barraca não conta).
   */
  convidarParaTiro(pinId: string, playerIds: readonly string[], source: HostMapSource): HostResult & { convite: TiroConviteResultado }
  /** "Pausar para todos" / "Continuar" da barraca do pino. `ok: false` = sem sessão naquela fase. */
  pausarTiro(pinId: string): HostResult & { ok: boolean }
  retomarTiro(pinId: string): HostResult & { ok: boolean }
  /** "Encerrar para todos": a rodada de quem atirava acaba sem medalha. Sem efeito nenhum. */
  encerrarTiro(pinId: string): HostResult & { ok: boolean }
  /** "Reabrir para todos": a barraca encerrada abre de novo com o desafio de agora do pino e as tentativas zeradas. */
  reabrirTiro(pinId: string, source: HostMapSource): HostResult & { ok: boolean }
  /** Cada pino com tiro (aberto, pausado ou o último encerrado), como o painel do MESTRE lê. */
  tiro(): TiroAoVivo[]
  /**
   * ABALO POR DISTÂNCIA: a cada jogador que joga e está numa cena agora, o
   * texto da FAIXA dele (`lib/abalo.ts`): `perto` na cena da origem, `andar`
   * nas cenas de `vizinhas`, `longe` no resto. Faixa com texto vazio não manda
   * nada a quem está nela. Quem está `perto` recebe `forte` e, com ponto de
   * origem, a seta vista da própria ficha (`abaloSetaForPlayer`). O abalo entra
   * no caderno de quem recebeu; não fica guardado para quem chega depois (é um
   * instante, não um recado da cena). `porFaixa`: o aviso do mestre.
   */
  abalo(origem: AbaloOrigem, textos: AbaloTextos, vizinhas: readonly string[], source: HostMapSource): AbaloResult
  /**
   * "Deixar ir": revalida o pedido contra o mundo de AGORA (o token pode ter
   * andado, o pino sumido) e devolve `applyTransfer` + `scene.changed` ao
   * dono. Pedido que já não existe (jogador saiu, já decidido) não faz nada.
   * Passagem barrada do outro lado por quem o aviso não nomeava: não passa —
   * devolve `travelRequest` novo (a disputa), que o integrador põe na Caixa.
   */
  approveTravel(requestId: string, source: HostMapSource): HostResult
  /**
   * "Passar para pede" do pedido pelo pino trancado: a mesma aprovação do
   * `approveTravel` e, só se o jogador passou, `applyPinPassage` com o pino
   * em "pede" — daí em diante cada passagem pergunta ao mestre. Pedido que não
   * veio de pino trancado: só a aprovação, sem mudar modo nenhum.
   */
  approveLockedTravelAsAsk(requestId: string, source: HostMapSource): HostResult
  /**
   * "Não": `pin.travel.denied` ao jogador. Pedido que já não existe não faz nada.
   * `text` ("Não, porque…"): o motivo vai junto, aparado e cortado no teto
   * (`TRAVEL_DENY_TEXT_MAX_LENGTH`), só para quem pediu; em branco = sem motivo.
   */
  denyTravel(requestId: string, text?: string): HostResult
  /**
   * "Ver" do pedido: a cena e a ficha de quem pediu, AGORA (a ficha pode ter
   * andado desde o aviso). Não responde nada. `null` sem pedido esperando ou
   * sem ficha em cena.
   */
  travelTarget(requestId: string, source: HostMapSource): CallTarget | null
  /** O pedido ainda espera o mestre? `false` depois de decidido, ou quando o jogador saiu. */
  isTravelPending(requestId: string): boolean
  /**
   * Idade e distância AGORA do pedido que espera (a Caixa de Pedidos relê a
   * cada segundo). `null` quando ele já não espera. Não envia nada.
   */
  travelRequestStatus(requestId: string, source: HostMapSource): TravelRequestStatus | null
  /**
   * AGIR SOBRE UMA FICHA: o mestre aceitou ou recusou, e `reply` é o que ele
   * escreveu para AQUELE jogador (o que o NPC responde; aparado e cortado em
   * `TOKEN_ACTION_REPLY_MAX_LENGTH`; vazio = sem texto). Devolve
   * `token.action.answer` só a quem pediu, com o `reqId` dele. Pedido que já
   * não existe (respondido, jogador caiu ou saiu) não manda nada.
   */
  answerTokenAction(requestId: string, accepted: boolean, reply?: string): HostResult
  /** O pedido de ação ainda espera o mestre? */
  isTokenActionPending(requestId: string): boolean
  /**
   * Quem iria junto se o mestre deixasse AGORA (`playerId`s): jogadores
   * jogando e conectados, na mesma cena, com ficha a até `NEAR_SQUARES` casas
   * da ficha de quem pediu (`lib/travelTogether.ts`). Pedido que já não vale: nenhum.
   */
  travelCompanions(requestId: string, source: HostMapSource): string[]
  /**
   * "Deixar ir com quem está perto": aprova o pedido (a revalidação do
   * `approveTravel`, que vem primeiro no resultado) e, só se ele passou, leva
   * junto quem está perto NESTE instante — quem andou para longe desde o aviso
   * fica. Cada companheiro é um resultado à parte, com `applyTransfer` numa
   * casa livre em volta do pino par e o mesmo `scene.changed` de quem pediu
   * ("Você chegou"). O pedido pendente de um companheiro é resolvido junto.
   * Pedido que já não existe: lista vazia.
   */
  approveTravelTogether(requestId: string, source: HostMapSource): HostResult[]
  /**
   * "Destrancar e abrir" do pedido da porta trancada: `applyDoor` (com
   * `unlock`) na cena onde a porta está — mesmo de fundo — e
   * `door.request.answer opened` ao jogador. Não exige mais o token perto: é
   * decisão do mestre. Pedido que já não existe, ou porta que sumiu, não faz nada.
   * `reply`: a "Resposta só para <jogador>" (caça J3), vai junto, só a quem pediu.
   */
  approveDoorRequest(requestId: string, source: HostMapSource, reply?: string): HostResult
  /** "Não": `door.request.answer denied` ao jogador, com o `reply` do mestre quando há. Pedido que já não existe não faz nada. */
  denyDoorRequest(requestId: string, reply?: string): HostResult
  /** O pedido da porta ainda espera o mestre? `false` depois de decidido, ou quando o jogador saiu. */
  isDoorRequestPending(requestId: string): boolean
  /**
   * "Deixar" do esconder-se: revalida contra o mundo de AGORA (a ficha ainda
   * existe e ainda é de quem pediu) e devolve `applyHide`. Quem esconde a
   * ficha e faz o broadcast é o integrador. Ficha que sumiu: `unavailable` a
   * quem pediu. Pedido que já não existe, ou ficha que mudou de dono: nada.
   */
  approveHide(requestId: string, source: HostMapSource): HostResult
  /** "Não": `token.hide.rejected denied` a quem pediu. Pedido que já não existe não faz nada. */
  denyHide(requestId: string): HostResult
  /** O pedido de esconder-se ainda espera o mestre? `false` depois de decidido, ou quando o jogador saiu. */
  isHidePending(requestId: string): boolean
  /**
   * "Deixar" do pedido de item: revalida contra o mundo de AGORA (o pino pode
   * ter sido pego por outro, a ficha pode ter saído) e devolve `applyItems` +
   * `pin.take.answer taken` ao jogador. Não exige mais a ficha encostada: é
   * decisão do mestre. Pedido que já não existe não faz nada.
   */
  approveItemRequest(requestId: string, source: HostMapSource): HostResult
  /** "Não": `pin.take.answer denied` ao jogador. Pedido que já não existe não faz nada. */
  denyItemRequest(requestId: string): HostResult
  /** O pedido de item ainda espera o mestre? `false` depois de decidido, ou quando o jogador saiu. */
  isItemRequestPending(requestId: string): boolean
  /**
   * LOJA — "Vender": revalida contra o mundo de AGORA (a banca pode ter sumido,
   * a mercadoria acabado, a ficha saído da cena ou mudado de dono) e devolve
   * `applyItems` com `venda` (o estoque cai um e a mercadoria entra na mochila
   * da ficha que estava na banca) + `pin.buy.answer sold` ao jogador. Pedido
   * que já não existe não faz nada.
   */
  approvePurchase(requestId: string, source: HostMapSource): HostResult
  /** LOJA — "Não": `pin.buy.answer denied` ao jogador. Pedido que já não existe não faz nada. */
  denyPurchase(requestId: string): HostResult
  /**
   * MOEDAS E TROCA — a oferta do mestre à ficha `tokenId` do jogador
   * `playerId`: `trade.offer` SÓ à conexão dele. Uma oferta por jogador; a
   * ficha precisa ter o que se pede e ele precisa estar jogando. Não saiu:
   * `offerId: null` e o motivo em `refusal`.
   */
  proposeTrade(playerId: string, tokenId: string, proposal: TradeProposal, source: HostMapSource): HostResult & { offerId: string | null; refusal?: TradeProposeRefusal }
  /**
   * "Aceitar" a contraproposta: revalida contra o mundo de AGORA (a ficha
   * ainda é dele e tem o que ofereceu) e devolve `applyItems` + `trade.closed
   * done`; não dá mais, `trade.closed unavailable`. Oferta sem contraproposta
   * ou que já acabou: nada.
   */
  acceptTradeCounter(offerId: string, source: HostMapSource): HostResult
  /** "Recusar" a contraproposta: `trade.closed refused` ao jogador. */
  refuseTradeCounter(offerId: string): HostResult
  /** O mestre desiste da oferta: `trade.closed cancelled` ao jogador. */
  cancelTrade(offerId: string): HostResult
  /** A oferta ainda está aberta? `false` depois de fechada, ou quando o jogador caiu ou saiu. */
  isTradePending(offerId: string): boolean
  /** O pedido de compra ainda espera o mestre? `false` depois de decidido, ou quando o jogador saiu. */
  isPurchasePending(requestId: string): boolean
  /**
   * "Nada aqui" (`nothing`) ou "Feito" (`seen`) da ação no ponto: a resposta
   * vai SÓ à conexão atual de quem pediu. Pedido já respondido, de jogador
   * expulso, ou jogador sem conexão agora: nada sai.
   */
  answerPointAction(requestId: string, answer: PointActionAnswer): HostResult
  /** A ação no ponto ainda espera o mestre? `false` depois de respondida ou com o jogador expulso. */
  isPointActionPending(requestId: string): boolean
  /**
   * CORREIO — "Entregar": o bilhete entra no caderno do destinatário e, se ele
   * joga agora, abre como cartão (`scene.note` com `from` e `via`); se aguarda
   * sem ficha, vai o caderno inteiro (`notes.book`) com o bilhete em `unread`;
   * fora do ar, espera no caderno a volta dele, e o caderno da volta o marca
   * em `unread`. Bilhete que já não espera o mestre: nada.
   */
  deliverLetter(letterId: string): HostResult
  /** CORREIO — "Interceptar": o bilhete some sem chegar a ninguém, e o remetente não fica sabendo. */
  interceptLetter(letterId: string): HostResult
  /** O bilhete ainda espera o mestre? `false` depois de entregue, interceptado, ou com o destinatário expulso. */
  isLetterPending(letterId: string): boolean
  /**
   * QUEM CHEGA ESCOLHE A FICHA: `seat.options` para cada jogador conectado e
   * sem personagem cuja lista de fichas livres MUDOU desde o último envio
   * àquela conexão (o `join` já manda a primeira). Seguro chamar a cada
   * evento: sem mudança, `outbound` sai vazio.
   */
  seatOptionsUpdates(source: HostMapSource): HostResult
  /**
   * "Aceitar" do pedido de ficha: revalida contra o mundo de AGORA (a ficha
   * continua livre e marcada, quem pediu continua sem personagem) e dá a
   * ficha (`assignToken`). Não valendo mais: `seat.claim.state unavailable` a
   * quem pediu. Pedido que já não existe: nada.
   */
  approveSeatClaim(requestId: string, source: HostMapSource): HostResult
  /** "Não": `seat.claim.state denied` a quem pediu. Pedido que já não existe: nada. */
  denySeatClaim(requestId: string): HostResult
  /** O pedido de ficha ainda espera o mestre? `false` depois de respondido, ou quando quem pediu caiu ou ganhou ficha. */
  isSeatClaimPending(requestId: string): boolean
  /**
   * DISPUTA NA PORTA: `force` = "Arrombar" (o ferrolho sai e a porta abre:
   * `applyDoor`); `false` = "Aguenta" (nada muda). Revalida contra o mundo de
   * AGORA: ferrolho que já saiu (quem trancou abriu) não abre nada. Disputa
   * que já não existe também não. Quem PEDIU ("Pedir ao mestre") lê a
   * resposta como na porta do mestre: `door.request.answer` opened/denied.
   */
  answerBarDispute(requestId: string, force: boolean, source: HostMapSource): HostResult
  /** A disputa ainda espera o mestre? `false` depois de respondida, ou quando quem tentou caiu. */
  isBarDisputePending(requestId: string): boolean
  /**
   * "Mandar para…" do painel Grupo: o MESTRE leva o jogador, sem pedido, para
   * `toSceneId` — no pino de viagem `pinId` daquela cena ou, com `null`, no
   * centro dela. Devolve o mesmo par da aprovação (`applyTransfer` +
   * `scene.changed`, este marcado `by: 'master'`). Destino inválido, jogador
   * sem ficha em cena ou já na cena de destino: nada.
   *
   * `gatherAt` é o "Reunir o grupo aqui": a ficha chega nessa casa (já
   * escolhida livre por `lib/gatherParty.ts`), `pinId` é ignorado e o aviso
   * sai como `by: 'gather'`. O séquito vem nas casas de `gatherAt.entourage`,
   * mas só a ficha que é séquito de verdade (dele, no tabuleiro, a até 2 casas).
   *
   * `tokenId` é a CABINE CONTÍNUA ao par (`lib/cabins.ts`): leva ESTA ficha
   * dele, na cena onde ela está, e não a primeira da cena dele. Ficha que não
   * é dele: nada.
   */
  sendPlayer(
    playerId: string,
    toSceneId: string,
    pinId: string | null,
    source: HostMapSource,
    gatherAt?: GatherArrival,
    tokenId?: string,
  ): HostResult
  /**
   * "Desfazer" do diário de viagens: devolve a ficha `tokenId` do jogador à
   * cena `back.sceneId`, na casa (`back.x`, `back.y`) de onde ela saiu. Mesmo
   * par do "Mandar para…" (`applyTransfer` + `scene.changed` `by: 'master'`,
   * só ao dono). Nada: jogador desconhecido ou esperando, ficha que não é
   * dele ou que não está na cena em que ele está, cena de volta sumida ou a
   * mesma cena. `back.size`: o lado que ela tinha antes da ida; a casa livre
   * é procurada nele e ele volta junto (`AppliedTransfer.tamanho`). Ausente =
   * o lado com que ela entra lá.
   */
  returnPlayer(playerId: string, tokenId: string, back: { sceneId: string; x: number; y: number; size?: number }, source: HostMapSource): HostResult
  /**
   * CARAVANA NO MAPA-MUNDI: em cada cena marcada como mapa-mundi, as fichas do
   * grupo seguem a que o mestre arrastou (`caravanStep`) e ficam empilhadas no
   * ponto da caravana. Devolve os movimentos a aplicar e as cidades onde uma
   * caravana está parada agora. Não envia nada: o integrador aplica e faz o broadcast.
   *
   * `cause: 'history'` = a cena aberta acabou de voltar por desfazer/refazer:
   * lá nada foi arrastado, e a caravana só se reconhece no retrato
   * (`caravanRegroup`) em vez de seguir quem "saiu" do ponto dela.
   */
  followCaravans(source: HostMapSource, cause?: MapChangeCause): CaravanFollow
  /**
   * "Desembarcar": cada ficha da caravana da cena `sceneId` vai para a cidade
   * sob ela, numa casa livre em volta do pino par. Cada jogador recebe um
   * `scene.changed` (`by: 'master'`) e passa a ver a cidade com a própria
   * ficha de volta. Sem caravana, sem cidade ou cena que não é mapa-mundi: `[]`.
   */
  disembarkCaravan(sceneId: string, source: HostMapSource): CaravanArrival[]
  /**
   * "Trazer" do painel Grupo: a ficha `tokenId` do jogador, esquecida em
   * OUTRA cena (a Faísca que ficou na Vila), vem para a casa livre colada à
   * ficha dele, na cena em que ele está. Só `applyTransfer`, sem
   * `scene.changed`: o jogador não trocou de cena, e a ficha aparece no
   * próximo broadcast. Nada: jogador desconhecido ou esperando, ficha que não
   * é dele, que já está na cena dele ou que não existe, ou sem casa livre.
   */
  bringToken(playerId: string, tokenId: string, source: HostMapSource): HostResult
  /**
   * Raio de visão só deste jogador (limitado à faixa); `null` volta ao global.
   * Não envia: o integrador faz o broadcast. Jogador desconhecido ou raio não finito é ignorado.
   */
  setVisionRadius(playerId: string, radius: number | null): void
  /**
   * "Fator de visão" deste jogador (limitado à faixa de `lib/sceneVision.ts`),
   * que multiplica o alcance de toda cena; `null` volta a x1,0. Não envia: o
   * integrador faz o broadcast. Jogador desconhecido ou fator não finito é ignorado.
   */
  setVisionFactor(playerId: string, factor: number | null): void
  /**
   * "Quem vê" do pino `pinId`: só estes jogadores o recebem (`lib/fogFilter.ts`).
   * `null` = Todos (apaga a lista). Id que não é de jogador da sala é ignorado;
   * lista vazia vale ("Só estes" sem ninguém: ninguém recebe). Não envia: o
   * integrador faz o broadcast. A lista vive só nesta sessão.
   */
  setPinAudience(pinId: string, playerIds: readonly string[] | null): void
  /** A lista de `setPinAudience`, na ordem de entrada na sala; `null` = Todos. */
  pinAudience(pinId: string): string[] | null
  /** Todas as listas, por pino, para o painel do mestre. Pino de "Todos" não aparece. */
  pinAudiences(): Record<string, string[]>
  /**
   * "MOSTRAR AGORA A…": o cartão do pino `pinId` (`pin.show`) só para este
   * jogador, mesmo longe do pino. Só vale com ele conectado, jogando e na
   * cena ONDE O PINO ESTÁ — pino de outra cena não sai, nem por id. Pino com
   * "Só estes" ganha o jogador na lista (o pino passa a aparecer no mapa dele
   * quando estiver à vista); pino de "Todos" continua de todos. Oculto para
   * jogadores sai (é a pista que o mestre entrega de propósito, como no
   * "Entregar pista…" do chamado no ponto) sem entrar no mapa de ninguém; viagem e
   * alavanca não viram cartão (`pinCardForPlayer`). Conta como RECEBIDO no
   * painel Pistas e entra no caderno dele (`clue.added`). Não envia
   * snapshot: o integrador faz o broadcast. `outbound` vazio = nada saiu.
   */
  showPin(playerId: string, pinId: string, source: HostMapSource): HostResult
  /**
   * PAINEL PISTAS: por pino, quem recebeu e quem leu. Recebeu é para sempre
   * nesta sessão — esconder o pino depois não desfaz o que o jogador já leu
   * na tela; só o kick apaga. Pino que ninguém recebeu não aparece.
   */
  pinClues(): Record<string, PinClueState>
  /**
   * "LER AGORA" do "!" CENÁRIO (P4): a revelação datilografada do pino `pinId`
   * abre na tela de quem joga, está conectado e está na cena DO PINO (pino de
   * outra cena não sai, nem por id). `playerIds` `null` = todos esses que VEEM
   * o pino no último recorte ("Quem vê", zona oculta, sala secreta e névoa
   * valem; o integrador faz o broadcast pendente antes). Com lista, a escolha
   * do mestre vale, e quem não está no "Quem vê" entra nele. O texto
   * sai da lista do que vai (`pinCardForPlayer`); cada um fica "lendo", o
   * pino conta como recebido no painel Pistas e o texto entra no caderno dele
   * (Lugares). Pino que não é "!", oculto ou escondido não sai. Não envia o
   * snapshot: o integrador faz o broadcast. `para` = quem recebeu.
   */
  lerCenario(pinId: string, playerIds: readonly string[] | null, source: HostMapSource): { result: HostResult; para: string[] }
  /** Por pino, por jogador: lendo ou leu (com a hora). Para a ficha do "!" e o "Ler junto". */
  leiturasDosCenarios(): LeiturasDosCenarios
  /**
   * "DIZER AGORA" de uma entrada do "?" Falas e pistas (P5): a entrada
   * `falaId` do pino passa a ir a estes jogadores (`null` = todos na cena do
   * pino que o VEEM, como no `lerCenario`; com lista, quem não está no "Quem
   * vê" entra nele), conectados e na cena DO PINO. Entra no caderno dele (Falas e
   * pistas) com o texto COMO FOI DITO. Pino oculto, escondido, que não é "?"
   * ou entrada vazia não sai. Não envia o snapshot. `para` = quem ouviu.
   */
  dizerFala(pinId: string, falaId: string, playerIds: readonly string[] | null, source: HostMapSource): { result: HostResult; para: string[] }
  /** Por pino, por entrada: a quem foi dita. Para a ficha do "?". */
  falasDitas(): FalasDitas
  /**
   * "Revelar para…" da ficha secreta, da escada secreta ou da zona oculta
   * `itemId`: só estes jogadores a recebem (`lib/fogFilter.ts`; a ficha ainda
   * exige visão). `null` ou lista vazia = segredo de todos de novo. Id que não é
   * de jogador da sala é ignorado. Não envia: o integrador faz o broadcast. A
   * lista vive só nesta sessão.
   */
  setSecretReveal(itemId: string, playerIds: readonly string[] | null): void
  /** A lista de `setSecretReveal`, na ordem de entrada na sala; `[]` = ninguém. */
  secretReveal(itemId: string): string[]
  /** Todas as listas, por item, para o painel do mestre. Item sem ninguém não aparece. */
  secretReveals(): Record<string, string[]>
  /** Marca a planta inteira da cena onde o jogador está como explorada, fora de zona oculta ativa. Tokens seguem exigindo visão. */
  revealPlan(playerId: string, source: HostMapSource): void
  /**
   * "Revelar planta para…": a planta da cena `sceneId` fica revelada para estes
   * jogadores, estejam onde estiverem — quem está em outra cena não recebe nada
   * agora; a planta aparece quando ele chega lá. Id que não é de jogador da
   * sala é ignorado. Devolve quantos jogadores ganharam a planta (0 = cena que
   * não existe ou ninguém válido). Não envia: o integrador faz o broadcast.
   */
  revealPlanFor(sceneId: string, playerIds: readonly string[], source: HostMapSource): number
  /**
   * "Dar o que o grupo viu": soma à memória do jogador, na cena ONDE ELE ESTÁ,
   * o que cada colega VIU lá (a visão deles, não a planta que o mestre revelou
   * a algum deles), fora do que zona oculta, sala secreta e teto escondem
   * agora. Devolve quantos colegas tinham memória da cena (0 = nada a dar).
   * Não envia: o integrador faz o broadcast.
   */
  giveGroupView(playerId: string, source: HostMapSource): number
  /**
   * PASSAR O MAPA pelo mestre: o que `fromPlayerId` explorou na cena onde está
   * agora (células, contornos e portas no estado que ELE viu) entra na memória
   * de `toPlayerId` para aquela cena — e só na dele. Zona oculta ativa e sala
   * secreta de agora não passam. Quem recebe ganha `map.shared` com o nome de
   * quem passou; o trecho vem no broadcast que o integrador faz depois.
   * Nada a passar (mesmo jogador, desconhecido, doador sem cena ou que ainda
   * não explorou a dele, quem recebe fora da cena do doador ou aguardando):
   * `{ outbound: [] }` sem `mapShared`.
   */
  shareMap(fromPlayerId: string, toPlayerId: string, source: HostMapSource): HostResult
  /**
   * MAPA DE PAPEL: o mestre grava as Salas `roomIds` da cena `sceneId` (`null`
   * = o mapa solto) na memória de `playerId` — e só na dele —, como um mapa
   * achado. Vale para qualquer cena do mundo, não só a dele: o recorte só
   * entrega aquela memória quando ele estiver lá. Entra só Sala que o recorte
   * pode mostrar (`giftableRoomsOf`) e que deixa ao menos uma célula marcada:
   * Sala toda sob zona oculta ativa fica de fora (e fora de `mapGiven`). Quem
   * recebe ganha `map.given`, sem cena nem Sala. Nada a gravar (jogador, cena ou
   * Sala desconhecidos, só Salas proibidas ou escondidas): `{ outbound: [] }`
   * sem `mapGiven`. Cena que ele ainda não tem na memória com a memória no teto:
   * nada é gravado e volta `mapRefused` (`memoria-cheia`) — o mapa de papel
   * nunca empurra para fora uma cena que ele explorou.
   */
  giveRoomsMap(playerId: string, sceneId: string | null, roomIds: readonly string[], source: HostMapSource): HostResult
  /**
   * Zera exploração e portas lembradas do jogador; a visão atual volta a
   * marcar no próximo broadcast. Com `source`, só da cena onde ele está; sem,
   * de todas.
   */
  hidePlan(playerId: string, source?: HostMapSource): void
  /**
   * O envio para esta conexão falhou (fila cheia, socket caindo): ela não tem
   * a tela que o host acha que tem. O próximo broadcast manda a inteira.
   */
  forgetView(clientId: string): void
  /** Com `source` de uma aventura, cada jogador que joga vem com o nome da cena onde está. */
  listPlayers(source?: HostMapSource): PlayerInfo[]
  /**
   * MOVIMENTO IMPOSTO: o raio de visão que o host APLICA agora, neste `map`, a
   * cada ficha com dono na sala — o mesmo de `occupantsSeenBy` (`tokenRadiusIn`:
   * "Visão nesta cena", fator do jogador, hora do relógio e a emprestada com o
   * raio do dono). Não é `PlayerInfo.visionRadius`, que é só o de base. Ficha
   * de dois donos fica com o MENOR; ficha sem dono fica de fora.
   */
  tokenVisionRadii(map: MapData): Map<string, number>
  /**
   * COMPANHEIROS: `party.update` para cada jogador conectado cuja lista MUDOU
   * desde o último envio àquela conexão. A lista é dele: os outros jogadores,
   * cada um 'aqui' (mesma cena), 'longe' (outra cena, ou ainda sem ficha) ou
   * 'fora' (desconectado). Nunca vai id nem nome de cena. Seguro chamar a cada
   * evento: sem mudança, `outbound` sai vazio.
   */
  partyUpdates(source: HostMapSource): HostResult
  /**
   * Quantas entradas os limites do pedido de passagem guardam agora (por
   * jogador + por jogador/cena/pino). Diagnóstico: é o número que um cliente
   * hostil tentaria inflar mandando ids de pino inventados.
   */
  travelLimitEntries(): number
  /**
   * ENCONTRO MARCADO: encerra toda espera cujo prazo já passou (relógio da
   * sessão) e avisa quem esperava (`wait.ended`, `expired`). O integrador
   * chama na hora de `nextWaitDeadline`: a mesa pode estar parada, sem
   * broadcast nenhum para descobrir o prazo vencido.
   */
  expireWaits(): HostResult
  /** O prazo mais próximo entre as esperas ativas; `null` = ninguém espera. */
  nextWaitDeadline(): number | null
  /**
   * TELA DA MESA: a cena que a TV mostra (`tableSceneKey`), ou `null` = a tela
   * espera. Não envia: o integrador faz o broadcast. Cena que não está aberta
   * (nem na aventura, nem no cache) também deixa a tela esperando.
   */
  setTableScene(key: string | null): void
  /** A cena escolhida para a tela da mesa, como `setTableScene` a recebeu. */
  tableScene(): string | null
  /** Quantas telas da mesa estão conectadas agora. */
  tableScreens(): number
  /** A conexão é de uma tela da mesa (e não de jogador). */
  isTable(clientId: string): boolean
  /** TELA DA MESA: a chave que o `join` da TV precisa trazer, além do código. Vai só no link da aba Jogo. */
  tableKey(): string
  /** Chamados abertos: Urgente primeiro, o resto na ordem de chegada. */
  listCalls(): MasterCall[]
  /** O chamado ainda espera o mestre? `false` depois de Visto/Responder, de baixar a mão ou de o jogador sair. */
  isCallOpen(callId: string): boolean
  /** "Visto": fecha o chamado e apaga a mão SÓ de quem chamou. Chamado que já não existe: nada. */
  seeCall(callId: string): HostResult
  /**
   * "Responder": o recado vai SÓ a quem chamou (cortado no teto do recado) e
   * fecha o chamado. Texto em branco não sai, e o chamado continua aberto.
   */
  replyCall(callId: string, text: string): HostResult
  /** A cena e a ficha de quem chamou, para o "Ir lá". `null` sem chamado ou sem ficha em cena. */
  callTarget(callId: string, source: HostMapSource): CallTarget | null
  /**
   * "Desfazer" do aviso de ficha devolvida: tira as fichas que o assento deu
   * (as que o mestre deu depois ficam), volta o raio ao padrão e devolve o
   * assento para quem chegar depois com o nome. Sem devolução em aberto, nada.
   */
  undoReclaim(playerId: string): HostResult
  /**
   * A mesa a gravar: quem está com ficha agora e os assentos de quem ainda não
   * voltou (menos as fichas que já têm outro dono). Só do mestre.
   *
   * `held`: por playerId, as fichas fora do mapa que continuam sendo dele (o
   * "Guardar ficha" da ponte, que a sessão não conhece). Contam como dele: a
   * ficha guardada volta a ele na retomada, e o assento não some da mesa.
   */
  savedSeats(held?: HeldTokens): SavedSeat[]
  /**
   * O mapa explorado a gravar, com os mesmos nomes de `savedSeats`: a memória
   * de agora de quem está com ficha, e a guardada de quem ainda não voltou.
   * Só do mestre. `held` como em `savedSeats`.
   */
  savedExploration(held?: HeldTokens): SavedSeatExploration[]
  /**
   * MINHAS NOTAS a gravar, por nome: as de quem está na sala e as guardadas de
   * quem ainda não voltou (ou saiu da lista). Só do mestre, só para o disco.
   */
  savedMyNotes(): SavedSeatNotes[]
  readonly rev: number
}
