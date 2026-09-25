import type { HazardKind, MapData, MarcaRumo, RegionPoint } from '../types/map'
import type { PlayerHazard } from '../lib/hazards'
import type { PlayerAreaTrigger } from '../lib/areaTriggers'
import type { PlayerClock } from '../lib/campaignClock'
import { isMarcaRumo, MARCA_TEXTO_MAX, normalizarTextoDaMarca } from '../lib/marcas'
import type { ExploredWire } from '../lib/exploration'
import type { TokenMoveLanding, TokenMoveRejection } from '../lib/moveValidation'
import { LASER_MAX_POINTS_PER_MESSAGE } from '../lib/laser'
import { isTokenPhotoData } from '../lib/tokenPhoto'
import { ROOM_TEXT_MAX_LENGTH } from '../lib/roomText'
import { isPlayerSafePinImage } from '../lib/pins'
import { CLUEBOOK_MAX_CLUES, CLUE_TEXT_MAX_LENGTH, CLUE_TITLE_MAX_LENGTH } from '../lib/clues'
import { isPointActionKind, isPointActionRejection, type PointActionAnswer, type PointActionKind, type PointActionRejection } from '../lib/pointActions'
import { MAX_DESTINATION_MARKS, SIGNAL_COLOR_PATTERN, type DestinationMark } from '../lib/signals'
import { MASTER_ROLLER_NAME, parseDiceRequest, type DiceRequest, type DiceRollEntry } from '../lib/dice'
import { isNoiseDirection, type NoiseDirection } from '../lib/noise'
import type { ViewPatch } from './viewPatch'
import type { OwnTokenElsewhere, RoofPeek } from '../lib/fogFilter'
import { ABALO_SETAS, type AbaloSeta } from '../lib/abalo'
import { LOCK_ANSWER_MAX_LENGTH } from '../lib/pinLock'

import { isTokenAction, isTokenActionRejection, TOKEN_ACTION_REPLY_MAX_LENGTH, TOKEN_ACTION_TEXT_MAX_LENGTH, type TokenAction, type TokenActionRejection } from '../lib/tokenActions'
import { ESPERA_ONDE_MAX_LENGTH, isFimDaEsperaMotivo, isWaitMinutes, type FimDaEspera, type MinhaEspera } from '../lib/encontroMarcado'

export type { OwnTokenElsewhere }

/**
 * Protocolo mestre <-> jogador. Toda mensagem é um objeto discriminado por
 * `type`. O que chega do jogador é hostil: passa por `parsePlayerMessage`
 * antes de qualquer uso.
 *
 * Versão 1: `delta` carrega o snapshot completo já filtrado para o jogador,
 * só com `rev` maior que o anterior. O cliente trata `delta` igual a
 * `snapshot` e descarta qualquer `rev` menor ou igual ao último aplicado.
 * Delta incremental de verdade fica para uma versão futura do protocolo.
 *
 * `explored` (bitset do que o jogador já viu) e `ownTokens` (ids dos tokens
 * dele) entraram depois como campos aditivos: a versão continua 1. Idem
 * `concealed` (polígonos das zonas ocultas ativas, pintados de preto) e a
 * mensagem `signal` nos dois sentidos (sinal de mapa do jogador) e a `laser`
 * do mestre para o jogador.
 *
 * `door.toggle` (jogador -> mestre) e `door.toggle.rejected` (volta) são
 * aditivas pelo mesmo motivo: mestre antigo responde `error invalid_message`
 * (o jogador só não abre a porta) e jogador antigo ignora a recusa.
 *
 * `welcome.name` é aditivo pelo mesmo critério: o host já renomeia nome
 * repetido para "Ana (2)" (`uniqueName`) e sem este campo o jogador nunca
 * descobre com que nome entrou. Cliente antigo ignora o campo; mestre antigo
 * não o envia e o jogador cai no nome que digitou.
 *
 * `room.closed` (mestre -> jogador) também é aditiva: o mestre avisa que
 * encerrou a sala antes de derrubar a conexão, e o jogador mostra "O mestre
 * encerrou a sala" em vez de "A conexão caiu". Cliente antigo cai no
 * `default` do switch e ignora; mestre antigo não envia e o jogador novo
 * continua tratando a queda como hoje.
 *
 * O PEDIDO DE PASSAGEM do pino de viagem é aditivo pelo mesmo critério:
 * `pin.travel.request` (jogador -> mestre) e, na volta, `pin.travel.rejected`
 * (o host recusou antes de perguntar ao mestre), `pin.travel.denied` (o mestre
 * disse "Não") e `scene.changed` (o mestre deixou ir; o snapshot da cena nova
 * vem logo depois). Nenhuma delas carrega nome nem id de cena: o jogador só
 * descobre para onde foi pelo mapa que chega depois da aprovação. Mestre
 * antigo responde `error invalid_message`; jogador antigo ignora as três.
 * O `text` opcional do `pin.travel.denied` é o motivo que o MESTRE escreveu
 * para quem pediu ("Não, porque…"): vai só a ele e não é do mapa.
 * `pin.travel.cancel` (jogador desiste) e `pin.travel.cancelled` (o pedido
 * saiu da espera: ele desistiu ou a ficha se afastou do pino) seguem a mesma
 * regra, e a volta leva só o motivo.
 *
 * `scene.note` (mestre -> jogador) é o RECADO POR CENA, aditivo pelo mesmo
 * critério: jogador antigo cai no `default` e ignora. Leva só o texto e um id,
 * nunca o id nem o nome da cena — quem recebe já está lá.
 *
 * O LASER DO JOGADOR também é aditivo: `laser` (jogador -> mestre, mesma forma
 * do laser do mestre) e, na volta a quem está na mesma cena, `laser` com
 * `from` + `color`. Mestre antigo responde `error invalid_message`, que o
 * jogador ignora durante o jogo.
 *
 * `room.text` (mestre -> jogador) é o TEXTO DA SALA, aditivo pelo mesmo
 * critério: na primeira vez que a ficha do jogador entra numa Sala com texto,
 * só ele recebe o id da Sala, o nome como ele pode ver ('' quando oculto) e o
 * texto. A nota do mestre nunca viaja.
 *
 * O CADERNO DE RECADOS é aditivo pelo mesmo critério: `scene.note.at` (a hora
 * do mestre, em ms) e `notes.book` (mestre -> jogador), a lista dos recados
 * que AQUELE jogador já recebeu, mandada quando ele entra ou volta. Jogador
 * antigo ignora os dois; mestre antigo não manda `at` e o jogador anota a hora
 * da chegada.
 *
 * RECADO PARA QUEM ESTÁ FORA é aditivo pelo mesmo critério: `notes.away`
 * (mestre -> jogador), na volta, os recados mandados à cena dele enquanto ele
 * estava fora do ar, na ordem em que saíram. Mesma forma do caderno (id,
 * texto, hora), nunca a cena. Jogador antigo ignora; o caderno ainda os traz.
 *
 * MINHAS PISTAS é aditivo pelo mesmo critério. Do jogador: `clue.read` (abriu o
 * cartão de um pino), `clue.peers` (quem está na cena comigo?) e `clue.show`
 * (mostrar uma pista a um colega pelo nome). Do mestre: `clue.added`,
 * `clues.book` (o caderno inteiro, na entrada), `clue.shown` (um colega
 * mostrou), `clue.peers` (os nomes) e `clue.show.result`. A pista leva título,
 * texto, foto `data:image/` e hora, com um id que o HOST inventa: nunca a
 * posição, o id do pino ou o nome/id da cena. Mestre antigo responde
 * `error invalid_message` (que o jogador ignora durante o jogo); jogador
 * antigo ignora as cinco.
 *
 * `scene.alarm` e `scene.alarm.end` (mestre -> jogador) são o ALARME PARA
 * VÁRIAS CENAS, aditivos pelo mesmo critério: jogador antigo ignora os dois.
 * Levam o texto e um id; nunca as cenas escolhidas.
 *
 * `turn` no snapshot (INICIATIVA) é aditivo pelo mesmo critério: o id da ficha
 * da vez, e só quando ela está no recorte do jogador. Jogador antigo ignora o
 * campo; mestre antigo não o envia e ninguém fica na vez.
 *
 * `scene.paused` (mestre -> jogador) é a PAUSA POR CENA, aditiva pelo mesmo
 * critério: só `paused`, sem nome da cena. Com a cena pausada, o host recusa o
 * `token.move` com o motivo `paused` — jogador antigo ignora o motivo e desfaz
 * o movimento como em qualquer recusa.
 *
 * `party.update` (mestre -> jogador) é a lista de COMPANHEIROS, aditiva pelo
 * mesmo critério. É calculada por destinatário: diz só se cada outro jogador
 * está na mesma cena que ele ('aqui'), em outra ('longe') ou desconectado
 * ('fora') — nunca o id nem o nome da cena de ninguém.
 *
 * `scene.note.onlyYou` é o RECADO PARA UM JOGADOR SÓ (linha dele no Grupo):
 * a mesma mensagem, que o host manda a uma conexão só, com a marca para a
 * tela dizer "Só para você". Aditivo: jogador antigo mostra como recado comum.
 *
 * O PEDIDO DA PORTA TRANCADA também é aditivo: `door.request` (jogador ->
 * mestre) e, na volta, `door.request.rejected` e `door.request.answer`. Mestre
 * antigo responde `error invalid_message`; jogador antigo ignora as duas.
 *
 * CHAVE ABRE PORTA, aditiva pelo mesmo critério: `door.useKey` (jogador ->
 * mestre) e o `key` opcional do `door.toggle.rejected`. Mestre antigo responde
 * `error invalid_message`; jogador antigo ignora o campo.
 *
 * ITEM PEGÁVEL, aditivo pelo mesmo critério: `pin.take` e `item.give`
 * (jogador -> mestre) e, na volta, `pin.take.rejected`, `pin.take.answer` e
 * `item.give.rejected`. A mochila viaja no token do PRÓPRIO jogador, no
 * snapshot (`Token.mochila`); a de outro nunca sai (`lib/fogFilter.ts`).
 * `snapshot.partyTokens` também é aditivo: quais das fichas que o jogador já
 * recebeu são de colegas. Jogador antigo ignora; host antigo não manda, e o
 * "Dar a…" fica sem colega (em vez de oferecer quem o host recusaria).
 *
 * ZONA DE PERIGO, aditiva pelo mesmo critério: `snapshot.hazards` (tipo e
 * polígono de cada sala tomada que o jogador enxerga) e `hazard.entered`
 * (mestre -> jogador: a ficha dele entrou no perigo). Jogador antigo ignora os
 * dois; mestre antigo não manda, e a tela fica sem perigo desenhado.
 *
 * CHAMAR O MESTRE é aditivo pelo mesmo critério: `call.raise` / `call.lower`
 * (jogador -> mestre) e, na volta, `call.state` (esperando, visto, cedo
 * demais) e `call.reply` (a resposta, só para quem chamou). Mestre antigo
 * responde `error invalid_message` (a mão não acende); jogador antigo ignora.
 *
 * `point.action` (jogador -> mestre) e, na volta, `point.action.answer` e
 * `point.action.rejected` são as AÇÕES NO PONTO, aditivas pelo mesmo critério.
 * A volta vai só a quem pediu e nunca leva sala, cena nem ponto.
 * `snapshot.sceneName` (e `delta.sceneName`) é o "ONDE ESTOU", aditivo pelo
 * mesmo critério: o NOME PARA OS JOGADORES da cena onde o jogador está, só
 * quando o mestre escreveu um. Nunca o nome interno da cena, nunca o de outra
 * cena. Jogador antigo ignora o campo; mestre antigo não o manda e o selo não
 * aparece.
 *
 * A MARCA "VAMOS PARA CÁ" é aditiva pelo mesmo critério: `destination`
 * (jogador -> mestre, um ponto ou `clear`) e `destinations` (mestre ->
 * jogador), a lista INTEIRA de marcas que aquele jogador pode ver agora — só
 * da cena dele, só em ponto que ele já conhece e fora de zona oculta. Nunca a
 * cena, nunca marca de quem está em outra cena. Mestre antigo responde
 * `error invalid_message`; jogador antigo ignora a lista.
 *
 * O DADO ROLADO NA SALA é aditivo pelo mesmo critério: `dice.roll` (jogador ->
 * mestre) só PEDE quantidade, dado e modificador — quem rola é o host — e
 * `dice.rolled` (mestre -> jogador) leva a rolagem pronta a toda a mesa. A
 * rolagem escondida do mestre nunca vira `dice.rolled` (`diceRollForPlayer`,
 * em `lib/fogFilter.ts`). Mestre antigo responde `error invalid_message`;
 * jogador antigo ignora a rolagem.
 *
 * LUGARES é aditivo pelo mesmo critério: `snapshot.place` (e `delta.place`) é
 * um id que o HOST inventa para a memória DESTE jogador na cena onde ele está
 * — nunca o id nem o nome da cena: é um contador de cada jogador, então o mesmo
 * id em dois jogadores não diz que eles estiveram no mesmo lugar —, e
 * `places` são os ids das memórias que o host ainda guarda dele, da visitada
 * há mais tempo à de agora. Com isso a tela dele guarda o desenho de cada
 * lugar por onde passou (só o que já recebeu) e solta o que o mestre mandou
 * esquecer ("Esconder planta"). Jogador antigo ignora os dois; mestre antigo
 * não os manda e a aba Lugares fica só com os pontos da cena.
 *
 * GATILHO DE ÁREA, aditivo pelo mesmo critério: `snapshot.gatilhos` (tipo e
 * polígono de cada gatilho que o mestre REVELOU, na área que o jogador
 * conhece). Entrar num gatilho NÃO manda nada ao jogador: o aviso é do mestre.
 *
 * MAPA POR ANDARES, aditivo pelo mesmo critério: `snapshot.andares` (o rótulo
 * do andar dele e, de cada OUTRO andar do mesmo prédio onde ele já esteve, o
 * rótulo, a planta recortada pela memória dele e o explorado). Nunca nome de
 * cena nem de prédio. Jogador antigo ignora; mestre antigo não manda.
 *
 * QUEM CHEGA ESCOLHE A FICHA é aditivo pelo mesmo critério: `seat.options`
 * (mestre -> jogador sem personagem: as fichas que ele pode pedir, só id e
 * nome), `seat.claim` (jogador -> mestre) e, na volta, `seat.claim.state`.
 * Mestre antigo responde `error invalid_message` ao pedido e nunca manda a
 * lista (o jogador fica na espera de sempre); jogador antigo ignora as duas.
 *
 * `pin.read` (jogador -> mestre) é a LEITURA DA PISTA, aditiva pelo mesmo
 * critério: o jogador abriu o cartão do pino e o texto estava lá. Acende
 * "leu" no painel Pistas do mestre. Não tem volta: nada sai para o jogador.
 * Mestre antigo responde `error invalid_message`, que o jogador ignora.
 *
 * `noise` (mestre -> jogador) é o RUÍDO NO MAPA, aditivo pelo mesmo critério:
 * jogador antigo cai no `default` e ignora. Leva só um id e a DIREÇÃO já
 * arredondada (`lib/noise.ts`), nunca a posição do ruído nem o que o fez.
 *
 * O TESTE SECRETO é aditivo pelo mesmo critério: `secret.check` (mestre ->
 * jogador escolhido) leva só um id e o nome do teste — nunca quem mais foi
 * escolhido; `secret.check.closed` (o mestre encerrou) leva só o id; e
 * `secret.check.answer` (jogador -> mestre) leva o id e o resultado, que o
 * host guarda para o mestre e não repassa a ninguém. Jogador antigo ignora as
 * duas primeiras; mestre antigo responde `error invalid_message` à terceira.
 *
 * SÓ O QUE MUDOU (`patch`, mestre -> jogador) é aditivo e COMBINADO: o jogador
 * que sabe aplicar diz logo depois do `join`, em mensagem própria
 * (`view.patches`) — o `join` fica com a forma de sempre —, e só ele recebe,
 * e só quando a tela inteira dele é grande (`PATCH_MIN_SNAPSHOT_LENGTH`, em
 * `net/hostSession.ts`). O `patch` leva só o que mudou desde a última tela
 * que AQUELA conexão recebeu (`net/viewPatch.ts`), com `base` = o `rev` dela.
 * O jogador cuja tela não é a `base` (mensagem perdida na fila) descarta o
 * patch e pede a tela inteira com `view.resync` (jogador -> mestre), no
 * máximo um por `VIEW_RESYNC_MIN_INTERVAL_MS`. Jogador antigo não manda
 * `view.patches` e segue recebendo `snapshot`; mestre antigo responde
 * `error invalid_message` ao `view.patches` e ao `view.resync`, que o jogador
 * ignora durante o jogo.
 *
 * MINHAS FICHAS EM OUTRAS CENAS é aditivo pelo mesmo critério: `snapshot.elsewhere`
 * (mestre -> jogador) lista as fichas DELE que estão em outra cena — id, nome
 * e a Sala onde está, nunca a cena nem a posição; ausente = nenhuma. Do jogador,
 * `view.switch` pede para olhar por uma delas: o host confere a posse e manda o
 * snapshot da cena daquela ficha. Mestre antigo responde `error
 * invalid_message`, que o jogador ignora durante o jogo; jogador antigo ignora
 * o campo.
 *
 * PASSAR O MAPA é aditivo pelo mesmo critério. Do jogador: `map.share` (o nome
 * do colega da mesma cena; a lista vem do mesmo `clue.peers`). Do mestre:
 * `map.shared` (quem passou) e `map.share.result`. O trecho explorado em si
 * nunca viaja nestas mensagens: vai no `explored` do snapshot de quem recebeu.
 * O MAPA DE PAPEL do mestre soma `map.given`, só com o tipo; jogador antigo o
 * ignora no `default`.
 *
 * O ABALO POR DISTÂNCIA é aditivo pelo mesmo critério: `abalo` (mestre ->
 * jogador) leva o texto da FAIXA daquele jogador, um id, a hora, `forte` (está
 * na cena da origem: o aparelho vibra) e, só nesse caso, `seta` — o rumo de 8
 * pontas visto da ficha dele. Nunca o ponto de origem, o id ou o nome de cena,
 * nem o texto de outra faixa. Jogador antigo cai no `default` e ignora.
 *
 * A FECHADURA COM SEGREDO é aditiva pelo mesmo critério: `pin.answer` (jogador
 * -> mestre, o id do pino e a tentativa) e `pin.answer.result` (só abriu ou
 * não). A resposta certa nunca viaja: o recorte leva `Pin.fechadura` (forma e,
 * nos volantes, casas), nunca `Pin.segredo`. Mestre antigo responde `error invalid_message`;
 * jogador antigo ignora o resultado.
 *
 * O BILHETE NO LUGAR é aditivo pelo mesmo critério: `mark.place` (jogador ->
 * mestre, o ponto e o bilhete ou a seta) e `mark.place.result` (ficou ou não).
 * A marca em si viaja no `map.marcas` do snapshot, já recortada pela névoa e
 * sem autor nem hora. Mestre antigo responde `error invalid_message`; jogador
 * antigo ignora o resultado e o campo novo do mapa.
 *
 * AGIR SOBRE UMA FICHA é aditivo pelo mesmo critério: `token.action` (jogador
 * -> mestre) e, na volta e só a quem pediu, `token.action.rejected` (o host
 * recusou antes de perguntar ao mestre) e `token.action.answer` (o mestre
 * aceitou ou recusou, com o texto opcional que ele escreveu só para aquele
 * jogador em `reply`). A volta leva só o `reqId` do jogador e esse texto:
 * nunca nome de ficha, de cena ou posição. Mestre antigo responde
 * `error invalid_message`; jogador antigo ignora as duas (e o `reply`).
 *
 * ENCONTRO MARCADO é aditivo pelo mesmo critério. Do jogador: `wait.set`
 * (quantos minutos, e o colega e o lugar que ele digitou) e `wait.clear`. Do
 * mestre, SÓ a quem espera: `wait.state` (a espera dele, ou `null`) e
 * `wait.ended` (o colega apareceu no recorte dele, o prazo venceu, ou ele saiu
 * da cena — nunca o nome da cena nem onde o colega estava). E `waiting` no
 * snapshot: ids das fichas DO RECORTE cujo dono espera — a marca, sem o "quem"
 * nem o "onde". Mestre antigo responde `error invalid_message`; jogador antigo
 * ignora as três.
 *
 * VOLTO JÁ é aditivo pelo mesmo critério: `away` nos dois sentidos. Do jogador,
 * `away: true` (saí da mesa por um instante) ou `false` (voltei); do mestre, a
 * confirmação — e, na retomada de quem saiu, o aviso que vem ANTES do mapa.
 * `travelPending` diz só que o pedido de passagem DELE ainda espera o mestre:
 * nada de pino, cena ou nome. Mestre antigo responde `error invalid_message`
 * (o jogador só não fica fora); jogador antigo ignora a confirmação.
 */
export const PROTOCOL_VERSION = 1

/** MAPA POR ANDARES: um andar onde o jogador não está agora, como ele o lembra. */
export interface FloorMemoryWire {
  /** Rótulo da aba (1F, B1): sempre um `cleanFloorLabel`. */
  rotulo: string
  /** Recorte sem visão nenhuma (`filterFloorMemory`): planta conhecida, nenhuma ficha. */
  map: MapData
  explored: ExploredWire
  concealed: RegionPoint[][]
}

/** MAPA POR ANDARES: o andar onde o jogador está e os outros que ele conhece. */
export interface FloorsWire {
  atual: string
  outros: FloorMemoryWire[]
}

export const JOIN_CODE_LENGTH = 6
export const NAME_MIN_LENGTH = 1
export const NAME_MAX_LENGTH = 32
export const REQ_ID_MAX_LENGTH = 64
export const RESUME_TOKEN_MAX_LENGTH = 128
/** Teto da chave da tela da mesa no `join` (a gerada pelo mestre é um UUID, 36). */
export const TABLE_KEY_MAX_LENGTH = 128
/** Teto do recado por cena, em unidades UTF-16 (o `maxLength` do campo do mestre conta igual). */
export const NOTE_MAX_LENGTH = 500
/**
 * Maior mensagem, em BYTES, que o servidor da mesa aceita de um jogador —
 * espelho de `MAX_MESSAGE_BYTES` em desktop/src-tauri/src/net/server.rs. Acima
 * disso o servidor fecha o socket: o jogador cai da mesa. O cliente do jogador
 * nunca envia nada maior (player/playerConnection.ts).
 */
export const PLAYER_MESSAGE_MAX_BYTES = 64 * 1024
/** Quantos recados o caderno de cada jogador guarda (no host e na tela dele). Passou, sai o mais antigo. */
export const NOTEBOOK_MAX_NOTES = 50
/**
 * Um pedido de passagem pelo MESMO pino, do mesmo jogador, nesta janela. O
 * mestre recusou e o jogador insiste no toque: sem o intervalo, cada toque
 * seria um aviso novo empilhado na tela do mestre. Por jogador e por pino, e
 * não por pino só: o grupo inteiro pedindo a mesma escada é jogo normal. O
 * host recusa (`too_soon`); o cliente do jogador espera sozinho o que falta.
 */
export const TRAVEL_REQUEST_MIN_INTERVAL_MS = 3000
/**
 * Um pedido de passagem por jogador nesta janela, de QUALQUER pino. É o
 * limite que vem antes de tudo: barato, de tamanho fixo por jogador, e segura
 * quem troca de pino (ou de conexão) a cada toque.
 */
export const TRAVEL_REQUEST_PLAYER_MIN_INTERVAL_MS = 1500
/** Teto do alarme, na mesma conta: é uma faixa urgente no alto da tela, não uma carta. */
export const ALARM_MAX_LENGTH = 140

/** Por que o jogador chama o mestre. Ordem = ordem na tela do jogador. */
export const CALL_REASONS = ['ajuda', 'agir', 'pergunta', 'sair', 'urgente'] as const
export type CallReason = (typeof CALL_REASONS)[number]
/** Como cada motivo aparece, para o jogador e para o mestre. */
export const CALL_REASON_LABELS: Record<CallReason, string> = {
  ajuda: 'Ajuda',
  agir: 'Quero agir',
  pergunta: 'Pergunta',
  sair: 'Vou sair',
  urgente: 'Urgente',
}
/** Teto do texto curto do chamado, em unidades UTF-16 (o `maxLength` do campo conta igual). */
export const CALL_TEXT_MAX_LENGTH = 140
/** Teto do motivo do "Não, porque…" do pedido de passagem, em unidades UTF-16 (o `maxLength` do campo conta igual). */
export const TRAVEL_DENY_TEXT_MAX_LENGTH = 80
/** Teto do nome do teste secreto ("Percepção"), em unidades UTF-16, como o recado. */
export const SECRET_CHECK_LABEL_MAX_LENGTH = 40
/**
 * Faixa do resultado que o jogador manda: inteiro, com folga para modificador
 * negativo e para sistema de dado percentual. Fora disso a mensagem cai.
 */
export const SECRET_CHECK_RESULT_MIN = -99
export const SECRET_CHECK_RESULT_MAX = 999

/**
 * Um `view.resync` por jogador nesta janela. O host responde com a tela
 * inteira, que é o recorte mais caro que ele faz: sem o limite, um jogador
 * pedindo em laço ocuparia o host.
 */
export const VIEW_RESYNC_MIN_INTERVAL_MS = 1000
/** Quantos recados a fila de quem está fora do ar guarda por jogador. Passou, sai o mais antigo. */
export const AWAY_NOTES_MAX = 20

const JOIN_CODE_PATTERN = /^[A-Z0-9]{6}$/

// Jogador -> mestre
export interface JoinMessage {
  type: 'join'
  code: string
  name: string
  resume?: string
  /**
   * TELA DA MESA: a página de espectador (TV, projetor) entra pelo MESMO
   * `join` — o servidor do app só aceita `join` como primeira mensagem — com
   * `role: 'table'`. Ela não é jogador: não tem ficha, não retoma sessão
   * (`resume` junto recusa a mensagem) e só recebe a cena que o mestre escolhe.
   * Aditivo: mestre antigo ignora o campo e a trata como jogador sem ficha.
   */
  role?: 'table'
  /**
   * TELA DA MESA: a chave que o mestre gera por sala e põe SÓ no link da TV
   * (aba Jogo). O código da sala todo jogador tem; sem esta chave, ninguém vira
   * tela e recebe a cena que o mestre escolheu (que pode ser outra que a dele).
   */
  tableKey?: string
}

/** O jogador sabe aplicar `patch` (ver o topo do arquivo). Sem ela, só `snapshot`. */
export interface ViewPatchesMessage {
  type: 'view.patches'
}

/** A tela do jogador não é a `base` do `patch` que chegou: ele pede a inteira. */
export interface ViewResyncMessage {
  type: 'view.resync'
}

export interface TokenMoveMessage {
  type: 'token.move'
  reqId: string
  tokenId: string
  x: number
  y: number
}

export interface PingMessage {
  type: 'ping'
  /**
   * A aba do jogador está em segundo plano. Com a aba oculta há mais de 5 min
   * o Chrome e o Edge só deixam o timer rodar 1 vez por minuto, então o ping
   * chega de minuto em minuto: o host usa um prazo de silêncio mais longo
   * (`HOST_AWAY_STALE_AFTER_MS`) até um ping sem a marca chegar.
   */
  away?: true
}

/**
 * Quem vê o sinal além de quem sinalizou. `master`: só o mestre — é o sinal
 * que sai com o toque longo, antes de o jogador escolher no menu (Espiar e
 * Revistar ficam discretos para os colegas). Sem o campo: também os colegas
 * da cena que conhecem o ponto (o sinal de sempre, e o "Sinalizar" do menu).
 */
export type SignalAudience = 'master'

/** Sinal (ping de mapa) do jogador. Não confundir com `ping`, que é o heartbeat. */
export interface SignalMessage {
  type: 'signal'
  x: number
  y: number
  audience?: SignalAudience
}

/**
 * Jogador pede para abrir/fechar uma porta encostada no token dele. O host
 * valida (porta existe, visível para ele agora, destrancada, token perto) e
 * aplica no mapa do mestre; recusa volta em `door.toggle.rejected`.
 */
export interface DoorToggleMessage {
  type: 'door.toggle'
  wallId: string
}

/**
 * "Espiar": jogador olha pela porta FECHADA encostada no token dele. O host
 * valida como o `door.toggle` (porta visível para ele, token perto) e, se
 * valer, a visão DELE atravessa a porta por `PEEK_DURATION_MS`; a porta segue
 * fechada para todos e o mestre recebe o aviso. Recusa volta no mesmo
 * `door.toggle.rejected`. Aditiva: mestre antigo responde `error
 * invalid_message`, que o jogador ignora.
 */
export interface DoorPeekMessage {
  type: 'door.peek'
  wallId: string
}

/**
 * Jogador troca o NOME e a FOTO do PRÓPRIO token, da tela dele. Campo ausente
 * = não mexe naquele dado; `image: null` remove a foto.
 *
 * `image` é sempre uma referência AUTO-CONTIDA (`data:image/...;base64,...`),
 * validada por `isTokenPhotoData`: o jogador não tem, e nunca terá, caminho
 * nenhum no disco do mestre, e o host não aceita outra forma.
 *
 * Aditiva pelo mesmo critério de `door.toggle`: mestre antigo responde
 * `error invalid_message` (o jogador só não troca nada) e jogador antigo nunca
 * a envia.
 */
export interface TokenEditMessage {
  type: 'token.edit'
  tokenId: string
  name?: string
  image?: string | null
}

/**
 * Jogador pede ao mestre para passar pelo pino de viagem `pinId` da cena em que
 * está. Só o id do pino: o destino o jogador nem conhece (`lib/fogFilter.ts`).
 * O host valida e, se valer, pergunta ao mestre.
 */
export interface PinTravelRequestMessage {
  type: 'pin.travel.request'
  pinId: string
  /**
   * ENCRUZILHADA: qual saída do pino (o id que veio em `Pin.escolhas`).
   * Aditivo: ausente vale a saída principal, e é o que o cliente antigo manda.
   */
  exitId?: string
}

/**
 * DESISTIR DO PEDIDO: o jogador retira o pedido de passagem que espera o
 * mestre. Só o tipo — cada jogador tem no máximo um pedido, e o host sabe
 * quem é pela conexão. Aditiva: mestre antigo responde `error
 * invalid_message`, que o jogador ignora durante o jogo.
 */
export interface PinTravelCancelMessage {
  type: 'pin.travel.cancel'
}

/**
 * LASER DO JOGADOR: a mesma forma do laser do mestre (lote de pontos em px de
 * mundo, ou `off` ao soltar). Nada de nome nem cor: quem é o host sabe pela
 * conexão, e a cor é a da ficha — o jogador não pode se passar por outro.
 */
export type PlayerLaserMessage = LaserMessage

/**
 * O jogador abriu o cartão do pino `pinId`: guarde a pista no caderno dele. O
 * host só aceita pino que saiu no último recorte da cena onde ele está, e
 * monta a pista a partir DESSE recorte — nunca do texto que o jogador mandasse.
 */
export interface ClueReadMessage {
  type: 'clue.read'
  pinId: string
}

/** "Mostrar para…": quem joga na mesma cena agora? A resposta é `clue.peers` com os nomes. */
export interface CluePeersRequestMessage {
  type: 'clue.peers'
}

/** Mostrar a pista `clueId` (do caderno de quem pede) ao colega de nome `to`. */
export interface ClueShowMessage {
  type: 'clue.show'
  clueId: string
  to: string
}

/** Como o jogador tenta passar pela porta trancada: Bater, Forçar ou Usar chave. */
export type DoorRequestHow = 'knock' | 'force' | 'key'

const DOOR_REQUEST_HOWS: readonly DoorRequestHow[] = ['knock', 'force', 'key']

/**
 * PORTA TRANCADA VIRA PEDIDO: o jogador tocou a porta, leu "Trancada" e pede
 * ao mestre do jeito que escolheu. O host valida (porta visível, trancada,
 * token perto) e leva ao mestre; a resposta volta em `door.request.answer`.
 * Aditiva pelo mesmo critério de `door.toggle`.
 */
export interface DoorRequestMessage {
  type: 'door.request'
  wallId: string
  how: DoorRequestHow
}

/**
 * ITEM PEGÁVEL: o jogador pede para pegar o item do pino `pinId`. O host
 * valida (pino visível, pegável, ficha encostada) e leva ao mestre — ou, no
 * pino livre, entrega direto. A resposta volta em `pin.take.answer`.
 */
export interface PinTakeMessage {
  type: 'pin.take'
  pinId: string
}

/**
 * CHAVE ABRE PORTA: o jogador usa a chave que carrega na porta trancada
 * `wallId`. Só a porta: o host acha a chave na mochila das fichas dele
 * encostadas nela — o jogador não escolhe item nem diz nome.
 */
export interface DoorUseKeyMessage {
  type: 'door.useKey'
  wallId: string
}

/**
 * ALAVANCA: o jogador puxa a alavanca `pinId`. Só o id do pino — qual porta
 * ela move o jogador nem conhece (`lib/fogFilter.ts`). O host valida (pino
 * visível, é alavanca, ficha encostada, porta ligada destrancada) e aplica.
 * Aditiva pelo mesmo critério de `door.toggle`.
 */
export interface PinLeverMessage {
  type: 'pin.lever'
  pinId: string
}

/** O jogador dá o item `itemId` da própria mochila à ficha `toTokenId`, de um colega encostado. */
export interface ItemGiveMessage {
  type: 'item.give'
  itemId: string
  toTokenId: string
}

/** O jogador levanta a mão. `text` ausente = só o motivo. */
export interface CallRaiseMessage {
  type: 'call.raise'
  reason: CallReason
  text?: string
}

/** O jogador baixa a mão antes de o mestre ver. */
export interface CallLowerMessage {
  type: 'call.lower'
}

/**
 * AÇÃO NO PONTO: depois do toque longo, o jogador pede ao mestre para
 * Procurar/Escutar/Espiar/Revistar em (`x`, `y`), px de mundo da cena DELE.
 * Aditiva pelo critério de sempre: mestre antigo responde `error
 * invalid_message` (o pedido só não chega) e jogador antigo nunca a envia.
 */
export interface PointActionMessage {
  type: 'point.action'
  action: PointActionKind
  x: number
  y: number
}

/**
 * MARCA "VAMOS PARA CÁ": põe (ou move) a marca do jogador no ponto, em px de
 * mundo da cena dele; `clear` tira. Sem nome nem cor: quem é e de que cor o
 * host sabe pela conexão e pela ficha.
 */
export type DestinationMessage = { type: 'destination'; x: number; y: number } | { type: 'destination'; clear: true }

/** As marcas que ESTE jogador pode ver agora, a lista inteira (vazia = nenhuma). */
export interface DestinationsMessage {
  type: 'destinations'
  marks: DestinationMark[]
}

/** DADO ROLADO NA SALA: o pedido. Resultado e total quem põe é o host. */
export interface DiceRollMessage extends DiceRequest {
  type: 'dice.roll'
}

/** A rolagem pronta, para toda a mesa. Nunca a escondida do mestre. */
export interface DiceRolledMessage {
  type: 'dice.rolled'
  roll: DiceRollEntry
}

/** Quem está sem personagem pede a ficha `tokenId` da lista `seat.options`. O mestre confirma. */
export interface SeatClaimMessage {
  type: 'seat.claim'
  tokenId: string
}

/** Olhar por outra ficha minha: a cena vista passa a ser a da ficha `tokenId`. Só o id: a cena quem acha é o host. */
export interface ViewSwitchMessage {
  type: 'view.switch'
  tokenId: string
}

/**
 * PASSAR O MAPA: "Mostrar meu mapa a…" o colega de nome `to`, que tem de estar
 * na mesma cena agora. Só o nome viaja: o host passa o que ELE guarda da
 * memória de quem pede, nunca um mapa que o jogador mandasse.
 */
export interface MapShareMessage {
  type: 'map.share'
  to: string
}

/**
 * FECHADURA COM SEGREDO: a tentativa do jogador no pino `pinId`. Só o texto
 * que ele digitou ou girou; quem confere é o host, contra a resposta que o
 * jogador nunca recebe. A volta é `pin.answer.result`.
 */
export interface PinAnswerMessage {
  type: 'pin.answer'
  pinId: string
  tentativa: string
}

/**
 * BILHETE NO LUGAR: o jogador crava um bilhete (`texto`) ou risca uma seta
 * (`rumo`) no ponto (`x`, `y`) em px de mundo da cena onde está. Nada de autor
 * nem de hora: quem é o host sabe pela conexão, e a hora é a do mestre. A
 * volta é `mark.place.result`.
 */
export type MarkPlaceMessage =
  | { type: 'mark.place'; x: number; y: number; tipo: 'bilhete'; texto: string }
  | { type: 'mark.place'; x: number; y: number; tipo: 'seta'; rumo: MarcaRumo }

/**
 * AGIR SOBRE UMA FICHA: o jogador pede ao mestre `action` sobre a ficha
 * `tokenId` (que ele vê agora e não é dele). `reqId` é do jogador, como no
 * movimento: é por ele que a resposta volta. `text`: o que ele diz, oferece ou
 * pede, até `TOKEN_ACTION_TEXT_MAX_LENGTH`; ausente = sem texto.
 */
export interface TokenActionRequestMessage {
  type: 'token.action'
  reqId: string
  tokenId: string
  action: TokenAction
  text?: string
}

/**
 * ENCONTRO MARCADO: "espero aqui". `minutes` é o prazo a partir de AGORA no
 * relógio do host (nunca uma hora absoluta: o relógio do celular não manda);
 * `who` é o colega pelo nome, como o jogador digitou; `where` é o lugar em
 * texto livre. Os dois opcionais, já aparados.
 */
export interface WaitSetMessage {
  type: 'wait.set'
  minutes: number
  who?: string
  where?: string
}

/** "Parar de esperar". */
export interface WaitClearMessage {
  type: 'wait.clear'
}

/** VOLTO JÁ: o jogador sai da mesa por um instante (`true`) ou volta (`false`). */
export interface AwayMessage {
  type: 'away'
  away: boolean
}

export type PlayerMessage =
  | MarkPlaceMessage
  | PinAnswerMessage
  | MapShareMessage
  | JoinMessage
  | SeatClaimMessage
  | TokenMoveMessage
  | PingMessage
  | SignalMessage
  | DestinationMessage
  | DoorToggleMessage
  | DoorRequestMessage
  | DoorUseKeyMessage
  | TokenEditMessage
  | PinTravelRequestMessage
  | PinTakeMessage
  | ItemGiveMessage
  | PinTravelCancelMessage
  | PlayerLaserMessage
  | ClueReadMessage
  | CluePeersRequestMessage
  | ClueShowMessage
  | CallRaiseMessage
  | CallLowerMessage
  | PointActionMessage
  | DiceRollMessage
  | PinLeverMessage
  | DoorPeekMessage
  | PinReadMessage
  | SecretCheckAnswerMessage
  | ViewResyncMessage
  | ViewPatchesMessage
  | ViewSwitchMessage
  | TokenActionRequestMessage
  | WaitSetMessage
  | WaitClearMessage
  | AwayMessage

/**
 * Por que a alavanca não moveu nada. `unavailable` junta pino inexistente, no
 * escuro, oculto e que não é alavanca. `stuck` junta porta ligada trancada,
 * alavanca solta e porta apagada: um motivo por caso diria ao jogador o
 * estado de uma porta que ele talvez nem veja.
 */
export type PinLeverRejection = 'unavailable' | 'far' | 'stuck'

export const PIN_LEVER_REJECTIONS: readonly PinLeverRejection[] = ['unavailable', 'far', 'stuck']

/**
 * Por que o host não levou o "Pegar" ao mestre. `unavailable` junta pino
 * inexistente, no escuro, oculto e que não é item — um motivo por caso diria
 * o que existe no escuro. `pending`: um pedido de item dele já espera.
 */
export type PinTakeRejection = 'unavailable' | 'far' | 'pending'

export const PIN_TAKE_REJECTIONS: readonly PinTakeRejection[] = ['unavailable', 'far', 'pending']

/** Por que o "Dar a…" não valeu: colega longe, ou item/ficha que não servem. */
export type ItemGiveRejection = 'unavailable' | 'far'

export const ITEM_GIVE_REJECTIONS: readonly ItemGiveRejection[] = ['unavailable', 'far']

/**
 * Jogador leu o cartão do pino `pinId` (abriu, com o texto já chegado). Só o
 * id: o host confere que o pino saiu mesmo para ele antes de contar.
 */
export interface PinReadMessage {
  type: 'pin.read'
  pinId: string
}

/**
 * Resposta do jogador ao teste secreto `id`. Só o número: o host confere que
 * o pedido foi mesmo para ele antes de contar.
 */
export interface SecretCheckAnswerMessage {
  type: 'secret.check.answer'
  id: string
  result: number
}

/**
 * Por que o host recusou o pedido de porta do jogador. `wrong_side` (porta de
 * um lado, `DoorState.opensFrom`) é aditivo: jogador antigo descarta o motivo
 * desconhecido e só não vê o aviso; a porta não abre do mesmo jeito. `blocked`:
 * fechar com uma ficha que ele VÊ no vão (nunca diz qual). Também aditivo.
 */
export type DoorToggleRejection = 'locked' | 'far' | 'not_visible' | 'wrong_side' | 'blocked'

/**
 * Por que o host não levou o pedido da porta trancada ao mestre. `pending`: um
 * pedido de porta dele já espera; `not_locked`: a porta abre com o toque.
 * Porta inexistente ou no escuro respondem o mesmo `not_visible` do toque.
 */
export type DoorRequestRejection = 'pending' | 'far' | 'not_visible' | 'not_locked'

export const DOOR_REQUEST_REJECTIONS: readonly DoorRequestRejection[] = ['pending', 'far', 'not_visible', 'not_locked']

/** A resposta do mestre ao pedido da porta. Sem id de porta nem de cena: quem pediu já sabe qual foi. */
export type DoorRequestAnswer = 'opened' | 'denied'

/**
 * Por que o host recusou o pedido de passagem SEM levar ao mestre. Genérico de
 * propósito: pino inexistente, no escuro, sem destino ou cena sem token do
 * jogador respondem todos `unavailable` — um motivo por caso diria ao jogador
 * o que existe do outro lado. `pending`: ele já tem um pedido esperando;
 * `too_soon`: pediu de novo pelo mesmo pino antes do intervalo mínimo.
 */
export type PinTravelRejection = 'unavailable' | 'pending' | 'too_soon'

/**
 * Por que o pedido de passagem saiu da espera sem resposta do mestre:
 * `player` = o jogador desistiu; `far` = a ficha dele se afastou do pino.
 * Só o motivo: nem o pino nem o destino voltam ao jogador.
 */
export type PinTravelCancelReason = 'player' | 'far'

/**
 * A resposta do host à tentativa na fechadura: `ok` abriu. Recusa sem motivo é
 * "não abre" — a mesma para combinação errada, pino que não existe, no escuro
 * ou já aberto, para não dizer ao jogador o que existe. `too_soon`: tentou de
 * novo antes do intervalo mínimo, e a tentativa nem foi conferida.
 */
export interface PinAnswerResultMessage {
  type: 'pin.answer.result'
  pinId: string
  ok: boolean
  reason?: 'too_soon'
}

/**
 * Por que a marca não ficou. Genérico de propósito: longe da ficha, fora do
 * mapa, num ponto que o jogador não conhece ou numa zona oculta respondem
 * todos `unavailable` — um motivo por caso diria o que existe ali. `full`: ele
 * já deixou o teto de marcas nesta cena; `too_soon`: deixou outra há pouco.
 */
export type MarkPlaceRefusal = 'unavailable' | 'full' | 'too_soon'

/** A resposta do host a `mark.place`: ficou (`ok`) ou não, com o motivo. */
export type MarkPlaceResultMessage = { type: 'mark.place.result'; ok: true } | { type: 'mark.place.result'; ok: false; reason: MarkPlaceRefusal }

// Mestre -> jogador
/** Laser do mestre: lote de pontos (px de mundo) desde o último envio, ou `off` ao soltar. */
export type LaserMessage = { type: 'laser'; points: RegionPoint[] } | { type: 'laser'; off: true }

/**
 * Laser de um JOGADOR repassado pelo host a quem está na mesma cena: `from` é
 * o nome dele na sala (único, igual ao `from` do sinal) e `color` a cor da
 * ficha dele. Aditivo: jogador antigo ignora os dois campos e desenha o rastro
 * como se fosse o do mestre.
 */
export type RelayedLaserMessage = LaserMessage & { from: string; color: string }

/** Recado do mestre a quem está numa cena. `id` novo = recado novo (substitui o que estiver aberto). */
export interface SceneNoteMessage {
  type: 'scene.note'
  id: string
  text: string
  /** Hora em que o mestre mandou (ms desde 1970, relógio do mestre). Ausente em mestre antigo. */
  at?: number
  /** Recado só para este jogador (ninguém mais na sala recebeu). Ausente = recado da cena. */
  onlyYou?: true
}

/**
 * ABALO: o texto da faixa DESTE jogador. `forte` = ele está na cena da origem
 * (vibra); `seta` só vem junto de `forte`, e só quando o mestre marcou um ponto
 * e a ficha dele está no mapa. Entra no caderno como um recado.
 */
export interface AbaloMessage {
  type: 'abalo'
  id: string
  text: string
  at: number
  forte: boolean
  seta?: AbaloSeta
}

/** Um recado guardado no caderno do jogador. Nada da cena: só o que ele leu e quando. */
export interface NoteEntry {
  id: string
  text: string
  at: number
}

/** O caderno inteiro do jogador, do mais antigo ao mais novo, mandado quando ele entra ou volta. */
export interface NotebookMessage {
  type: 'notes.book'
  notes: NoteEntry[]
}

/** Recados que chegaram à cena do jogador enquanto ele estava fora do ar, do mais antigo ao mais novo. */
export interface NotesAwayMessage {
  type: 'notes.away'
  notes: NoteEntry[]
}

/** Texto da Sala na primeira entrada: `id` é o da `Region` (já vai no snapshot), `title` o nome que o jogador pode ver. */
export interface RoomTextMessage {
  type: 'room.text'
  id: string
  title: string
  text: string
}

/**
 * Uma pista no caderno do jogador. `id` é do HOST (não é o do pino nem o da
 * Sala). `from`: o colega que mostrou; ausente = o próprio jogador leu.
 */
export interface ClueEntry {
  id: string
  title: string
  /** Pode vir vazio: cartão só com foto. */
  text: string
  /** Só `data:image/...`; `null` = sem foto. */
  image: string | null
  at: number
  from?: string
}

/** A pista que o host acabou de guardar para este jogador (nova, ou lida de novo). */
export interface ClueAddedMessage {
  type: 'clue.added'
  clue: ClueEntry
}

/** O caderno de pistas inteiro, da mais antiga à mais nova, mandado quando o jogador entra ou volta. */
export interface CluebookMessage {
  type: 'clues.book'
  clues: ClueEntry[]
}

/** Um colega da mesma cena mostrou uma pista. Ela já está no caderno de quem recebe. */
export interface ClueShownMessage {
  type: 'clue.shown'
  from: string
  clue: ClueEntry
}

/**
 * Por que o host recusou o movimento: as recusas da validação do mapa, mais
 * `paused` — a cena do jogador está pausada (o mestre está com outro grupo).
 */
export type TokenMoveRejectionReason = TokenMoveRejection | 'paused'

/** A cena do jogador está (ou deixou de estar) pausada pelo mestre. */
export interface ScenePausedMessage {
  type: 'scene.paused'
  paused: boolean
}

/** Onde um companheiro está, visto por quem recebe: mesma cena, outra cena, ou desconectado. */
export type PartyWhere = 'aqui' | 'longe' | 'fora'

export interface PartyMember {
  playerId: string
  name: string
  where: PartyWhere
}

/** Os OUTROS jogadores da mesa, na ordem de chegada. Quem recebe nunca está na lista. */
export interface PartyUpdateMessage {
  type: 'party.update'
  members: PartyMember[]
}

/** Teto da lista: a mesa tem de 4 a 7 jogadores; acima disto a mensagem é lixo, não mesa. */
export const PARTY_MAX_MEMBERS = 32
/** Folga para o " (n)" que o `uniqueName` do host soma a nome repetido. */
const PARTY_NAME_SUFFIX_MAX = 8

/**
 * Onde está a mão do jogador, do lado do mestre: `waiting` (na fila, com o
 * motivo que vale), `seen` (o mestre marcou Visto) ou `too_soon` (baixou e
 * levantou antes do intervalo: nada entrou na fila).
 */
export type CallStateMessage = { type: 'call.state'; state: 'waiting'; reason: CallReason } | { type: 'call.state'; state: 'seen' } | { type: 'call.state'; state: 'too_soon' }

/** Resposta do mestre ao chamado: um recado SÓ para quem chamou. */
export interface CallReplyMessage {
  type: 'call.reply'
  id: string
  text: string
}

/** Os colegas que jogam na mesma cena agora, pelo nome na sala. */
export interface CluePeersMessage {
  type: 'clue.peers'
  names: string[]
}

/**
 * Por que a pista não saiu, quando o motivo não conta nada sobre onde o colega
 * está: `too_soon` = outra pista saiu há menos de 1 s (o colega está na cena;
 * é só tocar de novo). Ausente = "não chegou", sem dizer por quê.
 */
export type ClueShowRefusal = 'too_soon'

/** A pista chegou (`ok`) ou não ao colega `to` — ele saiu da cena, da sala, ou a pista não era de quem pediu. */
export interface ClueShowResultMessage {
  type: 'clue.show.result'
  to: string
  ok: boolean
  /** Só em `ok: false`, e só com motivo que não revela a cena. Mestre antigo não manda. */
  reason?: ClueShowRefusal
}

export type ClueHostMessage = ClueAddedMessage | CluebookMessage | ClueShownMessage | CluePeersMessage | ClueShowResultMessage

/**
 * ALARME PARA VÁRIAS CENAS: aviso urgente que fica na tela até o mestre
 * encerrar. `id` novo = alarme novo (substitui o aberto). Nunca leva as cenas
 * escolhidas: quem recebe já está numa delas, e a lista diria que as outras existem.
 */
export interface SceneAlarmMessage {
  type: 'scene.alarm'
  id: string
  text: string
}

/** Fim do alarme `id`: o jogador tira o aviso SÓ se ainda for este (um fim atrasado não apaga o novo). */
export interface SceneAlarmEndMessage {
  type: 'scene.alarm.end'
  id: string
}

/** Uma ficha que quem está sem personagem pode pedir: só o id e o nome — nem cena, nem posição. */
export interface SeatOption {
  tokenId: string
  name: string
}

/** As fichas livres, para quem está sem personagem. Lista vazia = nenhuma a escolher. */
export interface SeatOptionsMessage {
  type: 'seat.options'
  tokens: SeatOption[]
}

/** Teto da lista de fichas livres: acima disto a mensagem é lixo, não mesa. */
export const SEAT_OPTIONS_MAX = 64
/** Teto do nome de ficha na lista, em unidades UTF-16 (o host corta antes de mandar). */
export const SEAT_OPTION_NAME_MAX_LENGTH = 64

/**
 * Onde está o pedido de ficha: `pending` (o mestre vai responder), `denied`
 * (o mestre disse não), `unavailable` (a ficha já não está livre, ou quem
 * pediu já joga) e `too_soon` (pediu de novo logo depois de um não).
 */
export type SeatClaimState = 'pending' | 'denied' | 'unavailable' | 'too_soon'

const SEAT_CLAIM_STATES: readonly SeatClaimState[] = ['pending', 'denied', 'unavailable', 'too_soon']

export function isSeatClaimState(value: unknown): value is SeatClaimState {
  return SEAT_CLAIM_STATES.some((state) => state === value)
}

/** O nome da ficha cortado no teto da lista, pela mesma regra do recado. */
export function clampSeatOptionName(name: string): string {
  return clampTextTo(name, SEAT_OPTION_NAME_MAX_LENGTH)
}

/**
 * Ruído que o jogador ouviu: de que lado veio, visto da ficha dele. Sem
 * posição, distância nem fonte — o host já decidiu tudo isso (`fogFilter.ts`).
 */
export interface NoiseMessage {
  type: 'noise'
  id: string
  dir: NoiseDirection
}

/** Pedido de teste secreto a este jogador. `label` é o nome que o mestre deu ("Percepção"). */
export interface SecretCheckMessage {
  type: 'secret.check'
  id: string
  label: string
}

/** O mestre encerrou o teste `id`: o cartão de quem não respondeu fecha. */
export interface SecretCheckClosedMessage {
  type: 'secret.check.closed'
  id: string
}

/**
 * `table_full`: já há `MAX_TABLE_SCREENS` telas da mesa na sala (`hostSession.ts`).
 * `bad_table_key`: tela da mesa sem a chave do link da TV, ou com outra.
 */
export type HostErrorReason = 'bad_code' | 'invalid_message' | 'not_joined' | 'already_joined' | 'table_full' | 'bad_table_key'

/**
 * Um colega (ou o mestre por ele) passou o mapa: o trecho que `from` explorou
 * já está na memória de quem recebe e vem no snapshot seguinte. Só o nome de
 * quem passou — nem cena, nem posição.
 */
export interface MapSharedMessage {
  type: 'map.shared'
  from: string
}

/** O mapa chegou (`ok`) ou não ao colega `to`. `too_soon`: outro mapa saiu há pouco; o colega segue na cena. */
export interface MapShareResultMessage {
  type: 'map.share.result'
  to: string
  ok: boolean
  reason?: 'too_soon'
}

/**
 * MAPA DE PAPEL: o mestre gravou Salas na memória deste jogador. Só o tipo —
 * nem cena, nem Sala, nem título: as Salas chegam no `explored` do snapshot
 * quando ele estiver na cena delas.
 */
export interface MapGivenMessage {
  type: 'map.given'
}

export type MapShareHostMessage = MapSharedMessage | MapShareResultMessage | MapGivenMessage

/**
 * AGIR SOBRE UMA FICHA, na volta. Só `reqId`, o veredito e, no `answer`, o
 * texto que o mestre escreveu para ESTE jogador (`reply`, até
 * `TOKEN_ACTION_REPLY_MAX_LENGTH`; ausente = sem texto): nem o nome da ficha
 * (o jogador já sabe qual tocou, pelo nome que ELE vê), nem a cena, nem o que o
 * mestre chama aquela ficha. Vai só a quem pediu.
 */
export type TokenActionHostMessage =
  | { type: 'token.action.rejected'; reqId: string; reason: TokenActionRejection }
  | { type: 'token.action.answer'; reqId: string; accepted: boolean; reply?: string }

/** ENCONTRO MARCADO: a espera de quem recebe (`null` = não espera). Só vai ao próprio jogador. */
export interface WaitStateMessage {
  type: 'wait.state'
  wait: MinhaEspera | null
}

/** ENCONTRO MARCADO: a espera acabou, e por quê. Só vai a quem esperava. */
export type WaitEndedMessage = { type: 'wait.ended' } & FimDaEspera

export type WaitHostMessage = WaitStateMessage | WaitEndedMessage

/**
 * `waiting` (ENCONTRO MARCADO): ids das fichas DESTE recorte cujo dono espera
 * alguém. Aditivo e só quando há alguma: ausente = nenhuma ficha esperando.
 */
export type HostMessage =
  // `name`: nome EFETIVO na sala, que pode não ser o que o jogador digitou.
  | { type: 'welcome'; playerId: string; resumeToken: string; name: string }
  | { type: 'lobby.waiting' }
  // `turn`: id da ficha da vez (iniciativa), só quando ela está em `map.tokens`
  // deste recorte (`turnForPlayer`). Ausente = ninguém que o jogador vê.
  // `partyTokens` (ITEM PEGÁVEL): das fichas que ele recebeu, as de OUTROS jogadores — o "Dar a…" não oferece NPC.
  // `hazards` (ZONA DE PERIGO): só o que o jogador enxerga agora, e só quando há algum (`PlayerMapView.hazards`).
  // `sceneName`: o NOME PARA OS JOGADORES da cena onde ele está ("Onde estou").
  // Ausente = a cena não tem nome público (ou mapa solto, ou mestre antigo).
  // `place`/`places`: LUGARES, ids do host para as memórias dele (ver o topo).
  // `gatilhos` (GATILHO DE ÁREA): só o revelado pelo mestre, e só quando há algum (`PlayerMapView.gatilhos`).
  // `andares` (MAPA POR ANDARES): só quando a cena dele é andar de um prédio e ele já esteve em outro andar dele.
  // `relogio` (RELÓGIO DA CAMPANHA): só o período e, da cena dele, se está escuro — nunca a hora (`clockForPlayer`).
  // `glimpses`: cone pelo vão de prédio com teto (`PlayerMapView.glimpses`).
  // Aditivo: ausente = telhado inteiro, que é o que o mestre antigo manda.
  // `elsewhere` (MINHAS FICHAS EM OUTRAS CENAS): as fichas dele em outra cena.
  // `peek`: aditivo — só sai com uma ficha do jogador no vão de porta aberta de prédio de teto fechado.
  // `waiting` (ENCONTRO MARCADO): ver o comentário acima de `HostMessage`.
  | { type: 'snapshot'; rev: number; map: MapData; vision: RegionPoint[][]; explored: ExploredWire; ownTokens: string[]; concealed: RegionPoint[][]; turn?: string; partyTokens?: string[]; hazards?: PlayerHazard[]; sceneName?: string; place?: string; places?: string[]; gatilhos?: PlayerAreaTrigger[]; andares?: FloorsWire; relogio?: PlayerClock; glimpses?: RegionPoint[][]; elsewhere?: OwnTokenElsewhere[]; peek?: RoofPeek; waiting?: string[] }
  | { type: 'delta'; rev: number; map: MapData; vision: RegionPoint[][]; explored: ExploredWire; ownTokens: string[]; concealed: RegionPoint[][]; turn?: string; partyTokens?: string[]; hazards?: PlayerHazard[]; sceneName?: string; place?: string; places?: string[]; gatilhos?: PlayerAreaTrigger[]; andares?: FloorsWire; relogio?: PlayerClock; glimpses?: RegionPoint[][]; elsewhere?: OwnTokenElsewhere[]; peek?: RoofPeek; waiting?: string[] }
  // Só o que mudou desde a tela `base` desta conexão (ver o topo do arquivo).
  | ({ type: 'patch'; rev: number; base: number } & ViewPatch)
  // ZONA DE PERIGO: a ficha DESTE jogador entrou num perigo. Só o tipo — nem a sala, nem a zona.
  | { type: 'hazard.entered'; kind: HazardKind }
  // `landing`: a ficha parou em outro lugar que não o pedido, e por quê (ficha sem chão => chão mais próximo).
  | { type: 'token.move.accepted'; reqId: string; x: number; y: number; landing?: TokenMoveLanding }
  | { type: 'token.move.rejected'; reqId: string; reason: TokenMoveRejectionReason }
  | { type: 'signal'; x: number; y: number; from: string; color: string }
  | DestinationsMessage
  // `key` (CHAVE ABRE PORTA): só no `locked`, só para quem encosta na porta
  // com o item que a abre — o nome do item, que ele já carrega. Aditivo:
  // jogador antigo ignora e lê "Trancada".
  | { type: 'door.toggle.rejected'; wallId: string; reason: DoorToggleRejection; key?: string }
  | { type: 'door.request.rejected'; wallId: string; reason: DoorRequestRejection }
  | { type: 'door.request.answer'; answer: DoorRequestAnswer }
  | { type: 'pin.travel.rejected'; reason: PinTravelRejection }
  // ITEM PEGÁVEL. `nome` só no `taken`: o jogador lê o que agora carrega.
  | { type: 'pin.take.rejected'; reason: PinTakeRejection }
  | { type: 'pin.take.answer'; answer: 'taken'; nome: string }
  | { type: 'pin.take.answer'; answer: 'denied' }
  | { type: 'item.give.rejected'; reason: ItemGiveRejection }
  // ALAVANCA. `pulled` não diz qual porta nem se abriu ou fechou: a porta
  // ligada pode estar fora da vista, e o jogador só vê o que o recorte mostra.
  | { type: 'pin.lever.answer'; answer: 'pulled' }
  | { type: 'pin.lever.rejected'; reason: PinLeverRejection }
  // `text`: o motivo curto do "Não, porque…" (até `TRAVEL_DENY_TEXT_MAX_LENGTH`).
  // Aditivo: jogador antigo ignora o campo e lê o "não deixou" de sempre.
  | { type: 'pin.travel.denied'; text?: string }
  | { type: 'pin.travel.cancelled'; reason: PinTravelCancelReason }
  | PinAnswerResultMessage
  | MarkPlaceResultMessage
  // `by: 'master'`: o mestre levou o jogador sem pedido ("Mandar para…" do
  // painel Grupo). Aditivo: jogador antigo ignora o campo e lê "Você chegou".
  // `by: 'gather'`: também sem pedido, mas pelo "Reunir o grupo aqui" de um
  // pino — o aviso diz que o GRUPO foi reunido, e continua sem dizer onde.
  // `chegada` (TEXTO DE CHEGADA DA CENA): o texto que o mestre escreveu na cena
  // de destino, só quando há. Vai SÓ a quem chega, uma vez — o snapshot nunca
  // o leva (`lib/fogFilter.ts`). Aditivo: jogador antigo ignora o campo.
  // `tokenId`: só no ATALHO NA MESMA CENA, a ficha DELE que atravessou — o
  // mapa não muda, e a tela precisa saber qual ficha centrar. Aditivo.
  | { type: 'scene.changed'; by?: 'master' | 'gather'; chegada?: string; tokenId?: string }
  | LaserMessage
  | RelayedLaserMessage
  | SceneNoteMessage
  | AbaloMessage
  | RoomTextMessage
  | NotebookMessage
  | NotesAwayMessage
  | ClueHostMessage
  | SceneAlarmMessage
  | SceneAlarmEndMessage
  | ScenePausedMessage
  | PartyUpdateMessage
  | CallStateMessage
  | CallReplyMessage
  // Resposta do mestre à AÇÃO NO PONTO, só para quem pediu. Leva só a ação e
  // a resposta: nem o ponto, nem a sala, nem a cena que o mestre leu.
  | { type: 'point.action.answer'; action: PointActionKind; answer: PointActionAnswer }
  | { type: 'point.action.rejected'; reason: PointActionRejection }
  | DiceRolledMessage
  | SeatOptionsMessage
  // Só a quem pediu a ficha; a aceitação chega como o mapa, com a ficha dele.
  | { type: 'seat.claim.state'; state: SeatClaimState }
  | NoiseMessage
  | SecretCheckMessage
  | SecretCheckClosedMessage
  | MapShareHostMessage
  | TokenActionHostMessage
  | WaitHostMessage
  // VOLTO JÁ: o estado que o host guarda. `travelPending`: o pedido dele ainda espera o mestre.
  | { type: 'away'; away: boolean; travelPending?: true }
  | { type: 'kicked' }
  | { type: 'room.closed' }
  // A mesma pessoa entrou por outra aba (ou aparelho) com o resume desta
  // conexão: esta aba para, sem voltar sozinha e sem apagar o resume, que é o
  // da aba nova também. Sem nada dentro: nem quem, nem de onde.
  | { type: 'session.replaced' }
  | { type: 'error'; reason: HostErrorReason }
  // Resposta ao `ping` de quem está na sala: só "estou aqui", sem nada dentro.
  // É o que deixa o jogador notar a conexão morta que nunca fecha.
  | { type: 'pong' }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isBoundedString(value: unknown, min: number, max: number): value is string {
  return typeof value === 'string' && value.length >= min && value.length <= max
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function parseJoin(obj: Record<string, unknown>): JoinMessage | null {
  const { code, name, resume, role, tableKey } = obj
  if (typeof code !== 'string' || !JOIN_CODE_PATTERN.test(code)) return null
  if (typeof name !== 'string') return null
  const trimmed = name.trim()
  // `length` conta unidades UTF-16 (emoji = 2): é o limite que o jogador vê no input.
  if (trimmed.length < NAME_MIN_LENGTH || trimmed.length > NAME_MAX_LENGTH) return null
  if (role !== undefined) {
    // Tela da mesa nunca retoma sessão de jogador: com `resume` junto, a mensagem cai inteira.
    if (role !== 'table' || resume !== undefined) return null
    // Sem chave a mensagem passa: quem recusa é a sessão (`bad_table_key`), para a TV dizer o que falta.
    if (tableKey === undefined) return { type: 'join', code, name: trimmed, role }
    if (!isBoundedString(tableKey, 1, TABLE_KEY_MAX_LENGTH)) return null
    return { type: 'join', code, name: trimmed, role, tableKey }
  }
  if (resume === undefined) return { type: 'join', code, name: trimmed }
  if (!isBoundedString(resume, 1, RESUME_TOKEN_MAX_LENGTH)) return null
  return { type: 'join', code, name: trimmed, resume }
}

function parseTokenMove(obj: Record<string, unknown>): TokenMoveMessage | null {
  const { reqId, tokenId, x, y } = obj
  if (!isBoundedString(reqId, 1, REQ_ID_MAX_LENGTH)) return null
  if (!isBoundedString(tokenId, 1, REQ_ID_MAX_LENGTH)) return null
  if (!isFiniteNumber(x) || !isFiniteNumber(y)) return null
  return { type: 'token.move', reqId, tokenId, x, y }
}

/**
 * Sinal. `audience` é opcional; presente, só vale `master` — qualquer outra
 * coisa recusa a mensagem, em vez de cair calada no sinal para todos (o
 * jogador pediu discrição e o ponto piscaria para os colegas).
 */
function parseSignal(obj: Record<string, unknown>): SignalMessage | null {
  const { x, y, audience } = obj
  if (!isFiniteNumber(x) || !isFiniteNumber(y)) return null
  if (audience === undefined) return { type: 'signal', x, y }
  if (audience !== 'master') return null
  return { type: 'signal', x, y, audience }
}

/**
 * Pedido de passagem. `exitId` é opcional; presente, tem de ser texto curto —
 * qualquer outra coisa recusa a mensagem inteira, em vez de cair calada na
 * saída principal (o jogador escolheu uma porta e iria por outra).
 */
function parseTravelRequest(obj: Record<string, unknown>): PinTravelRequestMessage | null {
  const { pinId, exitId } = obj
  if (!isBoundedString(pinId, 1, REQ_ID_MAX_LENGTH)) return null
  if (exitId === undefined) return { type: 'pin.travel.request', pinId }
  if (!isBoundedString(exitId, 1, REQ_ID_MAX_LENGTH)) return null
  return { type: 'pin.travel.request', pinId, exitId }
}

export function isDoorRequestHow(value: unknown): value is DoorRequestHow {
  return DOOR_REQUEST_HOWS.some((how) => how === value)
}

/** Pedido da porta trancada: id de porta curto e um dos três jeitos; qualquer outra coisa recusa a mensagem. */
function parseDoorRequest(obj: Record<string, unknown>): DoorRequestMessage | null {
  const { wallId, how } = obj
  if (!isBoundedString(wallId, 1, REQ_ID_MAX_LENGTH) || !isDoorRequestHow(how)) return null
  return { type: 'door.request', wallId, how }
}

/**
 * Edição do próprio token. Recusa a mensagem inteira quando qualquer campo
 * presente está malformado, e também quando ela não muda NADA — mensagem que
 * não pede nada não vale um broadcast.
 */
function parseTokenEdit(obj: Record<string, unknown>): TokenEditMessage | null {
  const { tokenId, name, image } = obj
  if (!isBoundedString(tokenId, 1, REQ_ID_MAX_LENGTH)) return null
  const parsed: TokenEditMessage = { type: 'token.edit', tokenId }
  if (name !== undefined) {
    if (typeof name !== 'string') return null
    const trimmed = name.trim()
    // Mesmo limite do nome do jogador: é texto que o mestre vê na tela dele.
    if (trimmed.length < NAME_MIN_LENGTH || trimmed.length > NAME_MAX_LENGTH) return null
    parsed.name = trimmed
  }
  if (image !== undefined) {
    // Fronteira de segurança: só foto embutida. Caminho de disco, `http://` e
    // `javascript:` não casam com o padrão e a mensagem inteira cai.
    if (image !== null && !isTokenPhotoData(image)) return null
    parsed.image = image
  }
  if (parsed.name === undefined && parsed.image === undefined) return null
  return parsed
}

/**
 * Corta o recado no teto. Não deixa meia letra no fim: um emoji partido ao
 * meio (surrogate alto sozinho) viraria um losango de erro na tela do jogador.
 */
export function clampNoteText(text: string): string {
  return clampTextTo(text, NOTE_MAX_LENGTH)
}

/** O mesmo corte do recado, no teto do alarme (`ALARM_MAX_LENGTH`). */
export function clampAlarmText(text: string): string {
  return clampTextTo(text, ALARM_MAX_LENGTH)
}

/** O motivo do "Não, porque…" cortado no teto dele, pela mesma regra do recado. */
export function clampTravelDenyText(text: string): string {
  return clampTextTo(text, TRAVEL_DENY_TEXT_MAX_LENGTH)
}

function clampTextTo(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const last = cut.charCodeAt(cut.length - 1)
  return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut
}

/**
 * Valida o `scene.alarm` que o jogador recebe, no molde do `scene.note`: forma
 * errada, texto vazio ou acima do teto recusam a mensagem inteira. Devolve
 * cópia só com os campos conhecidos.
 */
export function parseSceneAlarm(value: unknown): SceneAlarmMessage | null {
  if (!isRecord(value) || value.type !== 'scene.alarm') return null
  const { id, text } = value
  if (!isBoundedString(id, 1, REQ_ID_MAX_LENGTH)) return null
  if (!isBoundedString(text, 1, ALARM_MAX_LENGTH)) return null
  return { type: 'scene.alarm', id, text }
}

/** Valida o `scene.alarm.end`; `null` para qualquer outra forma. */
export function parseSceneAlarmEnd(value: unknown): SceneAlarmEndMessage | null {
  if (!isRecord(value) || value.type !== 'scene.alarm.end') return null
  const { id } = value
  if (!isBoundedString(id, 1, REQ_ID_MAX_LENGTH)) return null
  return { type: 'scene.alarm.end', id }
}

/**
 * O motivo do `pin.travel.denied` que o jogador recebe: texto de 1 a
 * `TRAVEL_DENY_TEXT_MAX_LENGTH`. Qualquer outra coisa vale "sem motivo" — a
 * recusa continua valendo, só a frase não chega: o jogador precisa saber que
 * não passou mesmo que o motivo venha estragado.
 */
export function parseTravelDenyText(value: unknown): string | undefined {
  return isBoundedString(value, 1, TRAVEL_DENY_TEXT_MAX_LENGTH) ? value : undefined
}

/**
 * Valida o `scene.note` que o jogador recebe. O mestre é confiável, mas o
 * texto vai para a tela: forma errada, texto vazio ou acima do teto recusam a
 * mensagem inteira em vez de mostrar um pedaço. Devolve cópia só com os campos
 * conhecidos.
 */
export function parseSceneNote(value: unknown): SceneNoteMessage | null {
  if (!isRecord(value) || value.type !== 'scene.note') return null
  const { id, text, at } = value
  if (!isBoundedString(id, 1, REQ_ID_MAX_LENGTH)) return null
  if (!isBoundedString(text, 1, NOTE_MAX_LENGTH)) return null
  // Só `true` marca: qualquer outro valor é recado comum, sem faixa.
  const onlyYou = value.onlyYou === true ? { onlyYou: true as const } : {}
  if (at === undefined) return { type: 'scene.note', id, text, ...onlyYou }
  // Presente e fora da forma recusa inteiro, como o resto: hora torta no caderno é pior que recado nenhum.
  if (!isNoteTime(at)) return null
  return { type: 'scene.note', id, text, at, ...onlyYou }
}

function isNoteTime(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0
}

function isAbaloSeta(value: unknown): value is AbaloSeta {
  return typeof value === 'string' && ABALO_SETAS.some((seta) => seta === value)
}

/**
 * Valida o `abalo` que o jogador recebe. Mesma regra do recado: forma errada,
 * texto vazio ou acima do teto recusam a mensagem inteira. A `seta` que este
 * jogador não conhece (mestre mais novo) cai sozinha — o texto ainda vale.
 * Devolve cópia só com os campos conhecidos.
 */
export function parseAbalo(value: unknown): AbaloMessage | null {
  if (!isRecord(value) || value.type !== 'abalo') return null
  const { id, text, at, forte, seta } = value
  if (!isBoundedString(id, 1, REQ_ID_MAX_LENGTH)) return null
  if (!isBoundedString(text, 1, NOTE_MAX_LENGTH)) return null
  if (!isNoteTime(at) || typeof forte !== 'boolean') return null
  const parsed: AbaloMessage = { type: 'abalo', id, text, at, forte }
  if (forte && isAbaloSeta(seta)) parsed.seta = seta
  return parsed
}

function parseNoteEntry(value: unknown): NoteEntry | null {
  if (!isRecord(value)) return null
  const { id, text, at } = value
  if (!isBoundedString(id, 1, REQ_ID_MAX_LENGTH) || !isBoundedString(text, 1, NOTE_MAX_LENGTH) || !isNoteTime(at)) return null
  return { id, text, at }
}

/**
 * Nome do teste secreto como sai para o jogador: aparado e cortado no teto,
 * sem meia letra no fim (mesma regra do recado).
 */
export function clampSecretCheckLabel(label: string): string {
  const trimmed = label.trim()
  if (trimmed.length <= SECRET_CHECK_LABEL_MAX_LENGTH) return trimmed
  const cut = trimmed.slice(0, SECRET_CHECK_LABEL_MAX_LENGTH)
  const last = cut.charCodeAt(cut.length - 1)
  return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut
}

/** O resultado do teste secreto vale: inteiro dentro da faixa. */
export function isSecretCheckResult(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= SECRET_CHECK_RESULT_MIN && value <= SECRET_CHECK_RESULT_MAX
}

/**
 * Valida o `secret.check` que o jogador recebe. Devolve cópia só com `id` e
 * `label`: campo a mais (uma lista de quem mais foi escolhido) não chega à tela.
 */
export function parseSecretCheck(value: unknown): SecretCheckMessage | null {
  if (!isRecord(value) || value.type !== 'secret.check') return null
  const { id, label } = value
  if (!isBoundedString(id, 1, REQ_ID_MAX_LENGTH)) return null
  if (!isBoundedString(label, 1, SECRET_CHECK_LABEL_MAX_LENGTH)) return null
  return { type: 'secret.check', id, label }
}

/** Valida o `secret.check.closed` que o jogador recebe. */
export function parseSecretCheckClosed(value: unknown): SecretCheckClosedMessage | null {
  if (!isRecord(value) || value.type !== 'secret.check.closed') return null
  return isBoundedString(value.id, 1, REQ_ID_MAX_LENGTH) ? { type: 'secret.check.closed', id: value.id } : null
}

/**
 * Valida o `noise` que o jogador recebe. Devolve cópia só com `id` e `dir`:
 * campo a mais (uma posição, um nome) não chega ao estado da tela.
 */
export function parseNoiseMessage(value: unknown): NoiseMessage | null {
  if (!isRecord(value) || value.type !== 'noise') return null
  const { id, dir } = value
  if (!isBoundedString(id, 1, REQ_ID_MAX_LENGTH)) return null
  if (!isNoiseDirection(dir)) return null
  return { type: 'noise', id, dir }
}

/**
 * Valida o `party.update` que o jogador recebe. Os nomes vão para a tela:
 * qualquer membro malformado (nome vazio ou acima do teto, `where` fora dos
 * três) recusa a lista inteira em vez de mostrar metade do grupo. Devolve
 * cópia só com os campos conhecidos: um `sceneId` que viesse junto não passa.
 */
export function parsePartyUpdate(value: unknown): PartyUpdateMessage | null {
  if (!isRecord(value) || value.type !== 'party.update') return null
  const { members } = value
  if (!Array.isArray(members) || members.length > PARTY_MAX_MEMBERS) return null
  const parsed: PartyMember[] = []
  for (const member of members) {
    if (!isRecord(member)) return null
    const { playerId, name, where } = member
    if (!isBoundedString(playerId, 1, REQ_ID_MAX_LENGTH)) return null
    if (!isBoundedString(name, NAME_MIN_LENGTH, NAME_MAX_LENGTH + PARTY_NAME_SUFFIX_MAX)) return null
    if (where !== 'aqui' && where !== 'longe' && where !== 'fora') return null
    parsed.push({ playerId, name, where })
  }
  return { type: 'party.update', members: parsed }
}

/**
 * Valida o `seat.options` que o jogador recebe. Os nomes vão para a tela: item
 * malformado (id ou nome vazio, nome acima do teto) ou lista acima do teto
 * recusam a lista inteira. Devolve cópia só com id e nome.
 */
export function parseSeatOptions(value: unknown): SeatOptionsMessage | null {
  if (!isRecord(value) || value.type !== 'seat.options') return null
  const { tokens } = value
  if (!Array.isArray(tokens) || tokens.length > SEAT_OPTIONS_MAX) return null
  const parsed: SeatOption[] = []
  for (const item of tokens) {
    if (!isRecord(item)) return null
    const { tokenId, name } = item
    if (!isBoundedString(tokenId, 1, REQ_ID_MAX_LENGTH)) return null
    if (!isBoundedString(name, 1, SEAT_OPTION_NAME_MAX_LENGTH)) return null
    parsed.push({ tokenId, name })
  }
  return { type: 'seat.options', tokens: parsed }
}

export type PointActionReply = Extract<HostMessage, { type: 'point.action.answer' } | { type: 'point.action.rejected' }>

/**
 * Valida a resposta (ou a recusa) da AÇÃO NO PONTO que o jogador recebe.
 * Qualquer valor fora do conhecido recusa a mensagem inteira: o texto que o
 * jogador lê sai daqui, e um "talvez" não pode virar "O mestre viu".
 */
export function parsePointActionReply(value: unknown): PointActionReply | null {
  if (!isRecord(value)) return null
  if (value.type === 'point.action.answer') {
    const { action, answer } = value
    if (!isPointActionKind(action) || (answer !== 'nothing' && answer !== 'seen')) return null
    return { type: 'point.action.answer', action, answer }
  }
  if (value.type === 'point.action.rejected') {
    const { reason } = value
    if (!isPointActionRejection(reason)) return null
    return { type: 'point.action.rejected', reason }
  }
  return null
}

/**
 * Valida o caderno que o jogador recebe. Até `NOTEBOOK_MAX_NOTES` itens, cada
 * um com id, texto dentro do teto e hora; um item ruim recusa a mensagem
 * inteira (não mostra caderno pela metade). Devolve cópia só com os campos
 * conhecidos.
 */
export function parseNotebook(value: unknown): NotebookMessage | null {
  if (!isRecord(value) || value.type !== 'notes.book') return null
  const { notes } = value
  if (!Array.isArray(notes) || notes.length > NOTEBOOK_MAX_NOTES) return null
  const parsed: NoteEntry[] = []
  for (const item of notes) {
    const entry = parseNoteEntry(item)
    if (entry === null) return null
    parsed.push(entry)
  }
  return { type: 'notes.book', notes: parsed }
}

/**
 * Valida a fila de quem esteve fora. De 1 a `AWAY_NOTES_MAX` itens (fila vazia
 * não abre cartão), cada um com id, texto dentro do teto e hora; um item ruim
 * recusa a mensagem inteira. Devolve cópia só com os campos conhecidos.
 */
export function parseNotesAway(value: unknown): NotesAwayMessage | null {
  if (!isRecord(value) || value.type !== 'notes.away') return null
  const { notes } = value
  if (!Array.isArray(notes) || notes.length === 0 || notes.length > AWAY_NOTES_MAX) return null
  const parsed: NoteEntry[] = []
  for (const item of notes) {
    const entry = parseNoteEntry(item)
    if (entry === null) return null
    parsed.push(entry)
  }
  return { type: 'notes.away', notes: parsed }
}

/** Folga para o sufixo que o host põe em nome repetido ("Ana (2)", ver `uniqueName`). */
const NAME_SUFFIX_ROOM = 8

/** Nome de jogador como o host o manda (com o sufixo de nome repetido). */
function isRoomName(value: unknown): value is string {
  return isBoundedString(value, NAME_MIN_LENGTH, NAME_MAX_LENGTH + NAME_SUFFIX_ROOM)
}

/** Teto da lista de colegas: bem acima de uma mesa real, abaixo de um host hostil inflando a tela. */
const CLUE_PEERS_MAX = 64

function parseClueEntry(value: unknown): ClueEntry | null {
  if (!isRecord(value)) return null
  const { id, title, text, image, at, from } = value
  if (!isBoundedString(id, 1, REQ_ID_MAX_LENGTH)) return null
  if (!isBoundedString(title, 1, CLUE_TITLE_MAX_LENGTH)) return null
  if (!isBoundedString(text, 0, CLUE_TEXT_MAX_LENGTH)) return null
  // Fronteira de segurança: só foto embutida. Caminho de disco, `http://` e
  // `file://` recusam a pista inteira — o `<img>` do jogador não abre nada disso.
  let photo: string | null = null
  if (image !== null) {
    if (typeof image !== 'string' || !isPlayerSafePinImage(image)) return null
    photo = image
  }
  if (!isNoteTime(at)) return null
  const entry: ClueEntry = { id, title, text, image: photo, at }
  if (from === undefined) return entry
  if (!isRoomName(from)) return null
  return { ...entry, from }
}

/**
 * Valida as mensagens de MINHAS PISTAS que o jogador recebe. Mesma regra do
 * caderno de recados: forma errada, pista ruim ou lista acima do teto recusam
 * a mensagem inteira. Devolve cópia só com os campos conhecidos — posição, id
 * de pino ou de cena que viessem juntos ficam para trás.
 */
export function parseClueMessage(value: unknown): ClueHostMessage | null {
  if (!isRecord(value)) return null
  switch (value.type) {
    case 'clue.added': {
      const clue = parseClueEntry(value.clue)
      return clue === null ? null : { type: 'clue.added', clue }
    }
    case 'clues.book': {
      const { clues } = value
      if (!Array.isArray(clues) || clues.length > CLUEBOOK_MAX_CLUES) return null
      const parsed: ClueEntry[] = []
      for (const item of clues) {
        const clue = parseClueEntry(item)
        if (clue === null) return null
        parsed.push(clue)
      }
      return { type: 'clues.book', clues: parsed }
    }
    case 'clue.shown': {
      const { from } = value
      const clue = parseClueEntry(value.clue)
      if (clue === null || !isRoomName(from)) return null
      return { type: 'clue.shown', from, clue }
    }
    case 'clue.peers': {
      const { names } = value
      if (!Array.isArray(names) || names.length > CLUE_PEERS_MAX) return null
      const parsed: string[] = []
      for (const name of names) {
        if (!isRoomName(name)) return null
        parsed.push(name)
      }
      return { type: 'clue.peers', names: parsed }
    }
    case 'clue.show.result': {
      const { to, ok, reason } = value
      if (!isRoomName(to) || typeof ok !== 'boolean' || (reason !== undefined && typeof reason !== 'string')) return null
      // Motivo que este jogador não conhece (mestre mais novo) vira a recusa comum.
      return !ok && reason === 'too_soon' ? { type: 'clue.show.result', to, ok, reason } : { type: 'clue.show.result', to, ok }
    }
    default:
      return null
  }
}

/** PASSAR O MAPA: valida `map.shared`, `map.share.result` e `map.given` que o jogador recebe. Campo a mais sai. */
export function parseMapShareMessage(value: unknown): MapShareHostMessage | null {
  if (!isRecord(value)) return null
  switch (value.type) {
    case 'map.given':
      return { type: 'map.given' }
    case 'map.shared':
      return isRoomName(value.from) ? { type: 'map.shared', from: value.from } : null
    case 'map.share.result': {
      const { to, ok, reason } = value
      if (!isRoomName(to) || typeof ok !== 'boolean' || (reason !== undefined && typeof reason !== 'string')) return null
      // Mesma regra da pista: motivo que este jogador não conhece vira a recusa comum.
      return !ok && reason === 'too_soon' ? { type: 'map.share.result', to, ok, reason } : { type: 'map.share.result', to, ok }
    }
    default:
      return null
  }
}

/**
 * Pedido de ação sobre uma ficha. Ação fora da lista, texto que não é texto ou
 * acima do teto recusam a mensagem inteira. Texto só de espaço vale como sem
 * texto (o campo some), e o que sobra sai aparado.
 */
function parseTokenActionRequest(obj: Record<string, unknown>): TokenActionRequestMessage | null {
  const { reqId, tokenId, action, text } = obj
  if (!isBoundedString(reqId, 1, REQ_ID_MAX_LENGTH)) return null
  if (!isBoundedString(tokenId, 1, REQ_ID_MAX_LENGTH)) return null
  if (!isTokenAction(action)) return null
  const parsed: TokenActionRequestMessage = { type: 'token.action', reqId, tokenId, action }
  if (text === undefined) return parsed
  if (!isBoundedString(text, 0, TOKEN_ACTION_TEXT_MAX_LENGTH)) return null
  const trimmed = text.trim()
  return trimmed === '' ? parsed : { ...parsed, text: trimmed }
}

/**
 * Valida a volta do pedido de ação que o jogador recebe. Devolve cópia só com
 * os campos conhecidos: nome, cena ou posição que viessem juntos ficam para
 * trás. Motivo de recusa que esta versão não conhece vira `unavailable`.
 * O `reply` sai aparado; fora de forma, só espaço ou acima do teto, ele cai
 * sozinho e o veredito fica: sem o veredito o jogador esperaria para sempre.
 */
export function parseTokenActionHostMessage(value: unknown): TokenActionHostMessage | null {
  if (!isRecord(value)) return null
  const { reqId, reply } = value
  if (!isBoundedString(reqId, 1, REQ_ID_MAX_LENGTH)) return null
  if (value.type === 'token.action.answer') {
    if (typeof value.accepted !== 'boolean') return null
    const said = isBoundedString(reply, 1, TOKEN_ACTION_REPLY_MAX_LENGTH) ? reply.trim() : ''
    return said === '' ? { type: 'token.action.answer', reqId, accepted: value.accepted } : { type: 'token.action.answer', reqId, accepted: value.accepted, reply: said }
  }
  if (value.type === 'token.action.rejected') {
    const reason = isTokenActionRejection(value.reason) ? value.reason : 'unavailable'
    return { type: 'token.action.rejected', reqId, reason }
  }
  return null
}

/**
 * Texto opcional do jogador: ausente vale ausente; presente tem de ser texto
 * até `max` DEPOIS de aparado. `''` = sem texto (o campo some); `null` =
 * malformado (a mensagem inteira cai).
 */
function optionalTrimmed(value: unknown, max: number): string | null {
  if (value === undefined) return ''
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length <= max ? trimmed : null
}

/**
 * "Espero aqui". Prazo fora da faixa, colega ou lugar que não são texto ou
 * passam do teto recusam a mensagem inteira. Só espaço vale como vazio.
 * Devolve só os campos conhecidos: um "até" em hora absoluta ou um id de cena
 * que viessem juntos ficam para trás.
 */
function parseWaitSet(obj: Record<string, unknown>): WaitSetMessage | null {
  if (!isWaitMinutes(obj.minutes)) return null
  const who = optionalTrimmed(obj.who, NAME_MAX_LENGTH + NAME_SUFFIX_ROOM)
  const where = optionalTrimmed(obj.where, ESPERA_ONDE_MAX_LENGTH)
  if (who === null || where === null) return null
  const parsed: WaitSetMessage = { type: 'wait.set', minutes: obj.minutes }
  if (who !== '') parsed.who = who
  if (where !== '') parsed.where = where
  return parsed
}

function parseOwnWait(value: unknown): MinhaEspera | null {
  if (!isRecord(value)) return null
  const { who, where, remainingMs } = value
  if (!isFiniteNumber(remainingMs) || remainingMs < 0) return null
  const wait: MinhaEspera = { remainingMs }
  if (who !== undefined) {
    if (!isRoomName(who)) return null
    wait.who = who
  }
  if (where !== undefined) {
    if (!isBoundedString(where, 1, ESPERA_ONDE_MAX_LENGTH)) return null
    wait.where = where
  }
  return wait
}

/**
 * Valida o que o jogador recebe do ENCONTRO MARCADO. Mesma regra do caderno:
 * forma errada cai inteira; devolve só os campos conhecidos. No "chegou" o
 * nome do colega é obrigatório (é o aviso); nos outros, opcional.
 */
export function parseWaitHostMessage(value: unknown): WaitHostMessage | null {
  if (!isRecord(value)) return null
  if (value.type === 'wait.state') {
    if (value.wait === null) return { type: 'wait.state', wait: null }
    const wait = parseOwnWait(value.wait)
    return wait === null ? null : { type: 'wait.state', wait }
  }
  const reason = value.reason
  if (value.type !== 'wait.ended' || !isFimDaEsperaMotivo(reason)) return null
  const who = value.who
  let colega: string | undefined
  if (who !== undefined) {
    if (!isRoomName(who)) return null
    colega = who
  }
  if (reason === 'met') return colega === undefined ? null : { type: 'wait.ended', reason, who: colega }
  return colega === undefined ? { type: 'wait.ended', reason } : { type: 'wait.ended', reason, who: colega }
}

/** Cor do laser repassado: `#rrggbb`, a forma que `Token.color` grava. */
const LASER_COLOR_PATTERN = /^#[0-9a-f]{6}$/i

/**
 * Valida o `room.text` que o jogador recebe. Mesma regra do recado: forma
 * errada, texto vazio ou acima do teto recusam a mensagem inteira. O título
 * pode vir vazio (nome da Sala oculto do jogador).
 */
export function parseRoomText(value: unknown): RoomTextMessage | null {
  if (!isRecord(value) || value.type !== 'room.text') return null
  const { id, title, text } = value
  if (!isBoundedString(id, 1, REQ_ID_MAX_LENGTH)) return null
  if (!isBoundedString(title, 0, ROOM_TEXT_MAX_LENGTH)) return null
  if (!isBoundedString(text, 1, ROOM_TEXT_MAX_LENGTH)) return null
  return { type: 'room.text', id, title, text }
}

/**
 * Valida o `snapshot.elsewhere` que o jogador recebe: lista de fichas dele em
 * outra cena, cada uma com id (do tamanho que o `view.switch` aceita de volta),
 * nome e Sala em texto ('' vale). Qualquer item fora da forma recusa a lista
 * inteira. Devolve cópia só com os três campos.
 */
export function parseElsewhere(value: unknown): OwnTokenElsewhere[] | null {
  if (!Array.isArray(value)) return null
  const parsed: OwnTokenElsewhere[] = []
  for (const item of value) {
    if (!isRecord(item)) return null
    const { tokenId, name, room } = item
    if (!isBoundedString(tokenId, 1, REQ_ID_MAX_LENGTH) || typeof name !== 'string' || typeof room !== 'string') return null
    parsed.push({ tokenId, name, room })
  }
  return parsed
}

/**
 * O corpo do laser, nos dois sentidos: `off: true` ou 1 a
 * `LASER_MAX_POINTS_PER_MESSAGE` pontos finitos. Devolve cópia só com `x`/`y`.
 */
function parseLaserBody(value: Record<string, unknown>): LaserMessage | null {
  if (value.off === true) return { type: 'laser', off: true }
  const { points } = value
  if (!Array.isArray(points) || points.length === 0 || points.length > LASER_MAX_POINTS_PER_MESSAGE) return null
  const parsed: RegionPoint[] = []
  for (const point of points) {
    if (!isRecord(point) || !isFiniteNumber(point.x) || !isFiniteNumber(point.y)) return null
    parsed.push({ x: point.x, y: point.y })
  }
  return { type: 'laser', points: parsed }
}

/**
 * Valida a mensagem `laser` que o jogador recebe (objeto já desserializado).
 * Sem `from` nem `color` é o laser do mestre; com os dois, o de outro jogador
 * (`RelayedLaserMessage`). Um só dos dois, nome fora do teto ou cor fora de
 * `#rrggbb` recusam a mensagem inteira — a cor vai direto para o desenho.
 */
export function parseLaserMessage(value: unknown): LaserMessage | RelayedLaserMessage | null {
  if (!isRecord(value) || value.type !== 'laser') return null
  const body = parseLaserBody(value)
  if (body === null) return null
  const { from, color } = value
  if (from === undefined && color === undefined) return body
  if (!isBoundedString(from, NAME_MIN_LENGTH, NAME_MAX_LENGTH + NAME_SUFFIX_ROOM)) return null
  if (typeof color !== 'string' || !LASER_COLOR_PATTERN.test(color)) return null
  return { ...body, from, color }
}

function parseDestinationMark(value: unknown): DestinationMark | null {
  if (!isRecord(value)) return null
  const { x, y, from, color, mine } = value
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isRoomName(from) || typeof mine !== 'boolean') return null
  // A cor vai direto para o desenho: só `#rrggbb`.
  if (typeof color !== 'string' || !SIGNAL_COLOR_PATTERN.test(color)) return null
  return { x, y, from, color, mine }
}

/**
 * Valida a lista de marcas que o jogador recebe. Mesma regra das outras
 * listas: acima do teto ou com uma marca torta, recusa inteira (não mostra
 * lista pela metade). Devolve cópia só com os campos conhecidos.
 */
export function parseDestinationsMessage(value: unknown): DestinationsMessage | null {
  if (!isRecord(value) || value.type !== 'destinations') return null
  const { marks } = value
  if (!Array.isArray(marks) || marks.length > MAX_DESTINATION_MARKS) return null
  const parsed: DestinationMark[] = []
  for (const item of marks) {
    const mark = parseDestinationMark(item)
    if (mark === null) return null
    parsed.push(mark)
  }
  return { type: 'destinations', marks: parsed }
}

/**
 * Teto da lista `places`: bem acima do que o host guarda por jogador (8), bem
 * abaixo de um host hostil inflando a memória da tela.
 */
export const PLACES_MAX = 32

/** Os campos de LUGARES de um snapshot, já conferidos. */
export interface SnapshotPlaces {
  place?: string
  places?: string[]
}

/**
 * Valida `place` e `places` do snapshot que o jogador recebe. Ausentes valem
 * (mestre antigo); presentes e tortos — id que não é texto curto, lista acima
 * do teto ou com item torto — devolvem `null`, e quem chama descarta a
 * mensagem inteira, como faz com os outros campos aditivos.
 */
export function parseSnapshotPlaces(value: Record<string, unknown>): SnapshotPlaces | null {
  const { place, places } = value
  const parsed: SnapshotPlaces = {}
  if (place !== undefined) {
    if (!isBoundedString(place, 1, REQ_ID_MAX_LENGTH)) return null
    parsed.place = place
  }
  if (places !== undefined) {
    if (!Array.isArray(places) || places.length > PLACES_MAX) return null
    const ids: string[] = []
    for (const id of places) {
      if (!isBoundedString(id, 1, REQ_ID_MAX_LENGTH)) return null
      ids.push(id)
    }
    parsed.places = ids
  }
  return parsed
}

function parseDestination(value: Record<string, unknown>): DestinationMessage | null {
  if (value.clear === true) return { type: 'destination', clear: true }
  if (value.clear !== undefined) return null
  return isFiniteNumber(value.x) && isFiniteNumber(value.y) ? { type: 'destination', x: value.x, y: value.y } : null
}

function parseDiceRollEntry(value: unknown): DiceRollEntry | null {
  if (!isRecord(value)) return null
  const request = parseDiceRequest(value)
  if (request === null) return null
  const { id, from, master, results, total, at } = value
  if (!isBoundedString(id, 1, REQ_ID_MAX_LENGTH) || !isRoomName(from) || !isNoteTime(at)) return null
  if (master !== undefined && (master !== true || from !== MASTER_ROLLER_NAME)) return null
  // Uma face por dado, cada uma de 1 a `sides`, e o total que elas dão: rolagem incoerente não vai à tela.
  if (!Array.isArray(results) || results.length !== request.count) return null
  const faces: number[] = []
  for (const face of results) {
    if (typeof face !== 'number' || !Number.isInteger(face) || face < 1 || face > request.sides) return null
    faces.push(face)
  }
  if (typeof total !== 'number' || total !== faces.reduce((sum, face) => sum + face, request.modifier)) return null
  const entry: DiceRollEntry = { id, from, ...request, results: faces, total, at }
  return master === true ? { ...entry, master } : entry
}

/**
 * Valida a rolagem que o jogador recebe. Forma errada, face fora do dado ou
 * total que não bate recusam a mensagem inteira. Devolve cópia só com os
 * campos conhecidos — marca de escondida, cena ou id de jogador ficam para trás.
 */
export function parseDiceRolled(value: unknown): DiceRolledMessage | null {
  if (!isRecord(value) || value.type !== 'dice.rolled') return null
  const roll = parseDiceRollEntry(value.roll)
  return roll === null ? null : { type: 'dice.rolled', roll }
}

/** Bilhete maior que isto nem é normalizado: o teto é de 80 e ninguém digita 320 espaços. */
const MARCA_TEXTO_BRUTO_MAX = MARCA_TEXTO_MAX * 4

/**
 * BILHETE NO LUGAR. Bilhete: o texto normalizado (`normalizarTextoDaMarca`)
 * tem de ter de 1 a `MARCA_TEXTO_MAX` letras — acima do teto a mensagem cai
 * inteira, em vez de gravar meio recado. Seta: um dos 8 rumos; texto que
 * viesse junto é jogado fora. Autor, hora e o resto ficam para trás.
 */
function parseMarkPlace(obj: Record<string, unknown>): MarkPlaceMessage | null {
  const { x, y, tipo, texto, rumo } = obj
  if (!isFiniteNumber(x) || !isFiniteNumber(y)) return null
  if (tipo === 'seta') return isMarcaRumo(rumo) ? { type: 'mark.place', x, y, tipo, rumo } : null
  if (tipo !== 'bilhete' || !isBoundedString(texto, 1, MARCA_TEXTO_BRUTO_MAX)) return null
  const limpo = normalizarTextoDaMarca(texto)
  if (limpo.length === 0 || limpo.length > MARCA_TEXTO_MAX) return null
  return { type: 'mark.place', x, y, tipo, texto: limpo }
}

/**
 * Valida o `mark.place.result` que o jogador recebe. Motivo que este jogador
 * não conhece (mestre mais novo) vira a recusa comum, como na pista.
 */
export function parseMarkPlaceResult(value: unknown): MarkPlaceResultMessage | null {
  if (!isRecord(value) || value.type !== 'mark.place.result' || typeof value.ok !== 'boolean') return null
  if (value.ok) return { type: 'mark.place.result', ok: true }
  const { reason } = value
  const known: MarkPlaceRefusal = reason === 'full' || reason === 'too_soon' ? reason : 'unavailable'
  return { type: 'mark.place.result', ok: false, reason: known }
}

/**
 * Valida mensagem vinda do jogador. Aceita o objeto já desserializado ou a
 * string JSON crua do transporte. Devolve um objeto novo só com os campos
 * conhecidos; qualquer campo faltando ou malformado resulta em `null`.
 */
export function parsePlayerMessage(raw: unknown): PlayerMessage | null {
  let value: unknown = raw
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (!isRecord(value)) return null
  switch (value.type) {
    case 'join':
      return parseJoin(value)
    case 'token.move':
      return parseTokenMove(value)
    case 'ping':
      return value.away === true ? { type: 'ping', away: true } : { type: 'ping' }
    case 'view.resync':
      return { type: 'view.resync' }
    case 'view.patches':
      return { type: 'view.patches' }
    case 'signal':
      return parseSignal(value)
    case 'destination':
      return parseDestination(value)
    case 'door.toggle':
      return isBoundedString(value.wallId, 1, REQ_ID_MAX_LENGTH) ? { type: 'door.toggle', wallId: value.wallId } : null
    case 'door.request':
      return parseDoorRequest(value)
    case 'door.useKey':
      return isBoundedString(value.wallId, 1, REQ_ID_MAX_LENGTH) ? { type: 'door.useKey', wallId: value.wallId } : null
    case 'door.peek':
      return isBoundedString(value.wallId, 1, REQ_ID_MAX_LENGTH) ? { type: 'door.peek', wallId: value.wallId } : null
    case 'token.edit':
      return parseTokenEdit(value)
    case 'pin.travel.request':
      return parseTravelRequest(value)
    case 'pin.travel.cancel':
      return { type: 'pin.travel.cancel' }
    case 'laser':
      // Só o corpo: `from`/`color` mandados pelo jogador são jogados fora — o
      // nome e a cor quem põe é o host, pela conexão e pela ficha dele.
      return parseLaserBody(value)
    case 'clue.read':
      return isBoundedString(value.pinId, 1, REQ_ID_MAX_LENGTH) ? { type: 'clue.read', pinId: value.pinId } : null
    case 'clue.peers':
      return { type: 'clue.peers' }
    case 'clue.show':
      return isBoundedString(value.clueId, 1, REQ_ID_MAX_LENGTH) && isRoomName(value.to) ? { type: 'clue.show', clueId: value.clueId, to: value.to } : null
    case 'pin.take':
      return isBoundedString(value.pinId, 1, REQ_ID_MAX_LENGTH) ? { type: 'pin.take', pinId: value.pinId } : null
    case 'item.give':
      return isBoundedString(value.itemId, 1, REQ_ID_MAX_LENGTH) && isBoundedString(value.toTokenId, 1, REQ_ID_MAX_LENGTH)
        ? { type: 'item.give', itemId: value.itemId, toTokenId: value.toTokenId }
        : null
    case 'call.raise':
      return parseCallRaise(value)
    case 'call.lower':
      return { type: 'call.lower' }
    case 'point.action':
      return isPointActionKind(value.action) && isFiniteNumber(value.x) && isFiniteNumber(value.y)
        ? { type: 'point.action', action: value.action, x: value.x, y: value.y }
        : null
    case 'dice.roll': {
      // Só o pedido: resultado, total e nome mandados pelo jogador são jogados fora.
      const request = parseDiceRequest(value)
      return request === null ? null : { type: 'dice.roll', ...request }
    }
    case 'pin.lever':
      return isBoundedString(value.pinId, 1, REQ_ID_MAX_LENGTH) ? { type: 'pin.lever', pinId: value.pinId } : null
    case 'seat.claim':
      return isBoundedString(value.tokenId, 1, REQ_ID_MAX_LENGTH) ? { type: 'seat.claim', tokenId: value.tokenId } : null
    case 'pin.read':
      return isBoundedString(value.pinId, 1, REQ_ID_MAX_LENGTH) ? { type: 'pin.read', pinId: value.pinId } : null
    case 'secret.check.answer':
      return isBoundedString(value.id, 1, REQ_ID_MAX_LENGTH) && isSecretCheckResult(value.result)
        ? { type: 'secret.check.answer', id: value.id, result: value.result }
        : null
    case 'view.switch':
      return isBoundedString(value.tokenId, 1, REQ_ID_MAX_LENGTH) ? { type: 'view.switch', tokenId: value.tokenId } : null
    case 'map.share':
      return isRoomName(value.to) ? { type: 'map.share', to: value.to } : null
    case 'pin.answer':
      return isBoundedString(value.pinId, 1, REQ_ID_MAX_LENGTH) && isBoundedString(value.tentativa, 1, LOCK_ANSWER_MAX_LENGTH)
        ? { type: 'pin.answer', pinId: value.pinId, tentativa: value.tentativa }
        : null
    case 'mark.place':
      return parseMarkPlace(value)
    case 'token.action':
      return parseTokenActionRequest(value)
    case 'wait.set':
      return parseWaitSet(value)
    case 'wait.clear':
      return { type: 'wait.clear' }
    case 'away':
      return typeof value.away === 'boolean' ? { type: 'away', away: value.away } : null
    default:
      return null
  }
}

export function isCallReason(value: unknown): value is CallReason {
  return typeof value === 'string' && CALL_REASONS.some((reason) => reason === value)
}

/**
 * Chamado do jogador. O texto é opcional e sai aparado; em branco vale "sem
 * texto". Acima do teto recusa a mensagem inteira: cortar mudaria o que o
 * jogador escreveu sem ele saber.
 */
function parseCallRaise(obj: Record<string, unknown>): CallRaiseMessage | null {
  const { reason, text } = obj
  if (!isCallReason(reason)) return null
  if (text === undefined) return { type: 'call.raise', reason }
  if (typeof text !== 'string') return null
  const trimmed = text.trim()
  if (trimmed.length > CALL_TEXT_MAX_LENGTH) return null
  return trimmed.length === 0 ? { type: 'call.raise', reason } : { type: 'call.raise', reason, text: trimmed }
}

/** Valida o `call.reply` que o jogador recebe: mesma regra do recado por cena. */
export function parseCallReply(value: unknown): CallReplyMessage | null {
  if (!isRecord(value) || value.type !== 'call.reply') return null
  const { id, text } = value
  if (!isBoundedString(id, 1, REQ_ID_MAX_LENGTH)) return null
  if (!isBoundedString(text, 1, NOTE_MAX_LENGTH)) return null
  return { type: 'call.reply', id, text }
}
