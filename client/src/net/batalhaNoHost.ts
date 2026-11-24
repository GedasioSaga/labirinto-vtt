import type { Personagem } from '../lib/personagem'
import type { SistemaDeRpg } from '../lib/sistemaDeRpg'
import { aliadosDe, type Equipe } from '../lib/batalha/equipes'
import type { BatalhaEmTurnos, PonteDaBatalha, TelaDoPedido } from '../lib/batalha/ponte'
import { podeDesfazer } from '../lib/batalha/registro'
import { cartaDaVez, type AutorDaAcao } from '../lib/batalha/turnos'
import { usaDirecao } from '../lib/batalha/alcance/forma'
import { efeitosParaJogador, vistaParaJogador, type ContextoDoJogador, type EfeitoParaJogador } from '../lib/batalha/vistaDoJogador'
import { comCompanionsNaVista } from '../lib/caracteristicas/naBatalha'
import {
  ALIADOS_MAX,
  JANELA_DOS_PEDIDOS_DE_BATALHA_MS,
  motivoNoFio,
  PEDIDOS_DE_BATALHA_POR_JANELA,
  type BatalhaAgirMessage,
  type BatalhaAjustarMessage,
  type BatalhaAjudaMessage,
  type BatalhaContadorMessage,
  type BatalhaCompanionsMessage,
  type BatalhaMarcarMessage,
  type BatalhaArmasMessage,
  type BatalhaDanoMessage,
  type BatalhaDesfazerMessage,
  type BatalhaEvoluirMessage,
  type BatalhaHostMessage,
  type BatalhaInvocarMessage,
  type BatalhaMiraMessage,
  type MiraNaMesaNoFio,
  type BatalhaPassarMessage,
  type BatalhaPassivaMessage,
  type BatalhaReagirMessage,
  type BatalhaZerarCargaMessage,
} from './protocoloDaBatalha'

/**
 * BATALHA ONE PIECE, F1 — o lado do host (seção 3.1 de
 * docs/planos/batalha-one-piece-f1-plano.md): o recorte da ordem dos turnos
 * por conexão (`batalha.estado`), os aliados da equipe (`batalha.aliados`) e
 * os dois pedidos que o jogador manda (`batalha.passar`, `batalha.desfazer`).
 *
 * F2 (seção 2.4 de docs/planos/batalha-one-piece-f2-plano.md): os pedidos
 * `batalha.agir`, `batalha.reagir`, `batalha.dano`, `batalha.armas` e
 * `batalha.zerarCarga` (posse e
 * vez conferidas aqui; a regra, na store), o mesmo `reqId` devolvendo o mesmo
 * `ok` sem agir de novo, e as animações (`batalha.efeitos`) só com fichas que
 * a tela da conexão tem, sem reprise ao entrar. O d20 da reação é rolado na
 * store (processo do host); nenhum pedido traz dado.
 *
 * F3 (fatia T): os números da forma (efeito "transformacao") só às conexões
 * donas da ficha ou aliadas (`numerosVisiveis`); a imagem da forma e os selos
 * vão no recorte (`vistaParaJogador`).
 *
 * Puro e síncrono como a `tiroNoHost`: a `hostSession` diz onde cada conexão
 * está e que fichas a tela dela tem; o estado da batalha mora na store do
 * mestre e chega pela ponte (`PonteDaBatalha`). Este módulo não lê store nem
 * mundo.
 *
 * Só sai o que mudou PARA A CONEXÃO: o recorte pelo texto (JSON), os aliados
 * pela referência dos personagens — o retrato pesa até 48 mil caracteres e não
 * viaja a cada "Passar a vez". Sair da batalha (ou da cena dela) manda `null`
 * uma vez.
 */

export interface SaidaDaBatalha {
  clientId: string
  msg: BatalhaHostMessage
}

/** O que o host sabe da conexão de um jogador que está numa cena em batalha. */
export interface LugarNaBatalha {
  /** `tableSceneKey` da cena dele: a chave da batalha na store do mestre. */
  sceneKey: string
  /** As fichas dele (`ownership[playerId]`). */
  meusTokens: ReadonlySet<string>
  /** Id e nome das fichas que a tela da conexão tem agora (o último recorte da cena dele). Fora daqui, a carta não sai. */
  fichasNaTela: readonly { id: string; name: string }[]
  /** Os personagens ligados às fichas que são dele de verdade (sem as emprestadas). */
  meusPersonagens: ReadonlySet<string>
  /** F2: tokenId → personagemId das mesmas fichas de `meusPersonagens` (o dano livre só vale numa delas). */
  personagemDaFicha: ReadonlyMap<string, string>
  /**
   * Fase C do alcance: a tela que saiu para ele (as paredes que ELE vê), para a conta das casas
   * acesas do pedido dele. Ausente = sem parede, só a distância.
   */
  tela?: TelaDoPedido
}

export interface ConexaoNaBatalha {
  clientId: string
  playerId: string
  /** O nome dele na mesa, como o registro mostra quem fez ou desfez. */
  nome: string
  /** `null` = fora de batalha: sem cena, cena fora de batalha, ou a tela dele ainda não é a da cena. */
  lugar: LugarNaBatalha | null
}

/** As fichas de personagem da mesa (a forma do `RpgDoMundo`). Ausente = mapa solto: cartas sem perfil nem vida. */
export interface FichasDaMesa {
  sistema: SistemaDeRpg | null
  personagens: readonly Personagem[]
  equipes?: readonly Equipe[]
}

export interface DepsDaBatalhaNoHost {
  /** A store do mestre. Ausente = o integrador não ligou a batalha à rede: nada sai, e todo pedido é recusado. */
  ponte: PonteDaBatalha | undefined
  agora: () => number
  /** O personagem como vai ao jogador (sem a conta dona: `semDono` da sessão). */
  paraOFio: (personagem: Personagem) => Personagem
}

/** A resposta a um pedido (vazia quando passou do teto: morre calado) e se a batalha mudou — aí quem chama manda o recorte novo a todos. */
export interface RespostaDaBatalha {
  saidas: SaidaDaBatalha[]
  mudou: boolean
}

export interface BatalhaNoHost {
  /** A cada broadcast, com todas as conexões de jogador: cada uma recebe só o que mudou para ela. */
  sync(conexoes: readonly ConexaoNaBatalha[], mesa: FichasDaMesa | undefined): SaidaDaBatalha[]
  /** Conexão nova (entrada, volta, "É ela"): começa sem nada, e o recorte de agora sai já. */
  entrou(conexao: ConexaoNaBatalha, mesa: FichasDaMesa | undefined): SaidaDaBatalha[]
  /**
   * A conexão caiu ou foi expulsa: o que ela tinha não vale para a próxima. Fase D do alcance: a
   * mira dela sai, e o `off` vai a quem a recebeu (sai junto com a queda).
   */
  caiu(clientId: string): SaidaDaBatalha[]
  /**
   * A conexão segue aberta, mas a tela dela não tem mais o que o host conta como entregue (conserto de
   * 18/11/2026). `vazia`: ela apagou a faixa sozinha (o `scene.changed`, que no atalho deixa o jogador na
   * MESMA cena: o recorte igual não saía de novo e ele ficava fora da batalha). `incerta`: um envio da
   * batalha falhou e não se sabe o que ficou lá. O próximo `sync` manda os aliados e o recorte de novo;
   * na incerta, até o `null` do fim da batalha.
   */
  perdeuAFaixa(clientId: string, como: 'vazia' | 'incerta'): void
  /** Expulso: o teto de pedidos dele também sai. */
  esquecer(playerId: string): void
  /** "Passar a vez": só a carta da vez, nesta rodada, de ficha dele. */
  passar(conexao: ConexaoNaBatalha, msg: BatalhaPassarMessage): RespostaDaBatalha
  /** Desfazer: só a linha dele, de tipo que o jogador desfaz, e só na vez dele (`podeDesfazer`). */
  desfazer(conexao: ConexaoNaBatalha, msg: BatalhaDesfazerMessage): RespostaDaBatalha
  /**
   * F2: agir. Na vez: a carta da vez nesta rodada, token dele e personagem
   * dele. Fora da vez (`vez` null): só um contra-ataque guardado de ficha dele
   * (Q6). Alvos só entre as fichas que a tela dele tem.
   * F3: `transformar` e `destransformar` só na vez (a forma é do personagem da
   * carta da vez; a store confere o cartão). Selo à mão é só do mestre (direto
   * na store): pelo fio, só o sugerido que vai no golpe. Tipos de habilidade
   * F2: os mods desse selo a store filtra pelo sistema (`seloPedidoValido`);
   * natureza e cartaoId ela tira da técnica, nunca do pedido.
   */
  agir(conexao: ConexaoNaBatalha, msg: BatalhaAgirMessage): RespostaDaBatalha
  /** F2: reagir. Com golpe: o golpe está pendente e a ficha é alvo dele ainda sem resolver. Livre: token dele. */
  reagir(conexao: ConexaoNaBatalha, msg: BatalhaReagirMessage): RespostaDaBatalha
  /** F2: dano livre só numa ficha dele com personagem. */
  dano(conexao: ConexaoNaBatalha, msg: BatalhaDanoMessage): RespostaDaBatalha
  /** F2: as armas levadas, só de personagem dele com carta na ordem; troca quando quiser (Q8). */
  armas(conexao: ConexaoNaBatalha, msg: BatalhaArmasMessage): RespostaDaBatalha
  /** Zerar a concentração: só de personagem dele com carta na ordem, a qualquer hora (não só na vez). */
  zerarCarga(conexao: ConexaoNaBatalha, msg: BatalhaZerarCargaMessage): RespostaDaBatalha
  /**
   * Tipos de habilidade F3: a passiva de ficha DELE de verdade (token e
   * personagem dele, carta na ordem), fora da vez. O alvo escolhido, só entre
   * as fichas que a tela dele tem. A regra (é passiva, ligada ou não, custo,
   * teto de selos, Aplicar só com o lembrete) a store confere.
   */
  passiva(conexao: ConexaoNaBatalha, msg: BatalhaPassivaMessage): RespostaDaBatalha
  /**
   * Tipos de habilidade F4: Evoluir a técnica de ficha DELE de verdade (token
   * e personagem dele, carta na ordem), só na vez de uma carta dele com o
   * mesmo personagem. A regra (a técnica evolui, ainda não evoluiu, SP) a
   * store confere.
   */
  evoluir(conexao: ConexaoNaBatalha, msg: BatalhaEvoluirMessage): RespostaDaBatalha
  /**
   * Invocação: pedir a técnica de Tipo Invocação de ficha DELE de verdade
   * (token dele, ligado ao personagem dele: `personagemDaFicha`), só na vez
   * de uma carta dele com o mesmo personagem. Nasce a pendência; quem põe no
   * mapa é o mestre. A regra (técnica, opção, máximo, carga, SP) a store
   * confere. Mesmo limite de taxa e dedupe de `reqId` dos outros pedidos.
   */
  invocar(conexao: ConexaoNaBatalha, msg: BatalhaInvocarMessage): RespostaDaBatalha
  /**
   * R1 (lote de 01/11): responder ao lembrete da marca. Só o dono de quem
   * atirou, com a ficha DELE de verdade (o SP e o teste são do personagem
   * dele). A regra (passiva, alvo sem marca, SP) a store confere.
   */
  marcar(conexao: ConexaoNaBatalha, msg: BatalhaMarcarMessage): RespostaDaBatalha
  /** R4 (lote de 01/11): o "Ajustar..." só na ficha DELE de verdade (nunca a emprestada, o NPC que ele controla nem o invocado). */
  ajustar(conexao: ConexaoNaBatalha, msg: BatalhaAjustarMessage): RespostaDaBatalha
  /** R5 (lote de 01/11): ganhar 1 nível do contador, na ficha DELE de verdade. A regra (reação livre, máximo) a store confere. */
  contador(conexao: ConexaoNaBatalha, msg: BatalhaContadorMessage): RespostaDaBatalha
  /**
   * REQUISITOS E (§7.3): responder ao pedido de ajuda (só o dono da ficha pedida; o NPC aliado só o
   * mestre, na tela dele) ou cancelá-lo (só quem pediu). O prazo e o portão a store confere.
   */
  ajuda(conexao: ConexaoNaBatalha, msg: BatalhaAjudaMessage): RespostaDaBatalha
  /** COMPANION: quem vai com o personagem DELE de verdade (nunca o emprestado). O grupo, o limite e a vida a store confere. */
  companions(conexao: ConexaoNaBatalha, msg: BatalhaCompanionsMessage): RespostaDaBatalha
  /**
   * Fase D do alcance (ALCANCE.md §6): a mira aberta de um jogador. Só em ficha que ele opera, na
   * vez dela (ou com o contra-ataque guardado); a forma e a cor saem do cartão do host
   * (`ponte.alcanceDaMira`), nunca do pedido. `true` = as miras mudaram: quem chama manda
   * `mirasNaMesa` a todos. Acima do teto (`MIRAS_POR_JANELA`) morre calado; o `off` passa sempre.
   */
  mira(conexao: ConexaoNaBatalha, msg: BatalhaMiraMessage): boolean
  /** Fase D: a mira do mestre (a store local dele, que já é a do host); `null` = fechou. `true` = mudou. */
  miraDoMestre(mira: MiraNaMesaNoFio | null): boolean
  /** Fase D: o que mudou nas miras de cada tela: a nova, a virada e o `off` da que sumiu (a vez passou, a ficha saiu da tela). */
  mirasNaMesa(conexoes: readonly ConexaoNaBatalha[]): SaidaDaBatalha[]
  /** Fase D: as miras dos jogadores para a tela do mestre (ele vê todas as fichas); a mesma lista enquanto nada muda. */
  mirasDosJogadores(): readonly MiraNaMesaNoFio[]
}

/** Fase D do alcance: o teto das miras por conta (o plano: 10 por segundo). A tela manda no máximo uma a cada `INTERVALO_DA_MIRA_MS`. */
export const MIRAS_POR_JANELA = 10
export const JANELA_DAS_MIRAS_MS = 1_000

/** Fase D: a mira de um jogador no host: a cena, a vez em que abriu (`null` = o contra-ataque) e o que sai às telas. */
interface MiraGuardada {
  sceneKey: string
  vez: { cartaId: string; rodada: number } | null
  corpo: MiraNaMesaNoFio
}

const NADA: RespostaDaBatalha = { saidas: [], mudou: false }

/** F2: as respostas guardadas por conexão para o `reqId` repetido (o cliente não tem mais que isso no ar). */
const RESPOSTAS_GUARDADAS = 32

/** Conserto das fichas F1 (bug 1): a recusa com o motivo que a tela do jogador mostra. */
interface Recusa {
  motivo: string
}

const RECUSA_GENERICA: Recusa = { motivo: 'Essa ação não vale agora' }
const RECUSA_DA_VEZ: Recusa = { motivo: 'A vez já passou' }
const RECUSA_DA_FICHA: Recusa = { motivo: 'Essa ficha não pode fazer isso agora' }
const RECUSA_DO_ALVO: Recusa = { motivo: 'O alvo não está na sua tela' }
const RECUSA_DA_REACAO: Recusa = { motivo: 'Esse golpe já foi resolvido' }
const RECUSA_FORA_DA_BATALHA: Recusa = { motivo: 'A batalha não está ligada na sua cena' }
const RECUSA_DA_AJUDA_FECHADA: Recusa = { motivo: 'Esse pedido de ajuda já fechou' }
const RECUSA_DA_AJUDA_DE_OUTRO: Recusa = { motivo: 'Esse pedido de ajuda não é para você' }
const RECUSA_DO_ACEITE: Recusa = { motivo: 'O pedido não vale mais: quem pediu já não pode usar' }
const RECUSA_DA_AJUDA_VENCIDA: Recusa = { motivo: 'O pedido venceu: passou de 60 s' }

const mesmasReferencias = (a: readonly Personagem[], b: readonly Personagem[]): boolean => a.length === b.length && a.every((personagem, i) => personagem === b[i])

export function criarBatalhaNoHost(deps: DepsDaBatalhaNoHost): BatalhaNoHost {
  // Por clientId: o JSON do último `batalha.estado`. Ausente = nada enviado (ou o `null` já foi).
  const estadoEnviado = new Map<string, string>()
  // Por clientId: os aliados do último `batalha.aliados`, pela referência.
  const aliadosEnviados = new Map<string, readonly Personagem[]>()
  // Por playerId: os instantes dos pedidos na janela (PEDIDOS_DE_BATALHA_POR_JANELA).
  const pedidos = new Map<string, number[]>()
  // F2, por clientId: a cena e o último `seq` de efeito já passado à conexão (enviado ou pulado). Ausente = marca no próximo sync, sem reprise.
  const efeitoVisto = new Map<string, { sceneKey: string; seq: number }>()
  // F2, por clientId: reqId → aceito (`true`) ou a recusa, as últimas RESPOSTAS_GUARDADAS, na ordem de chegada.
  const respostas = new Map<string, Map<string, true | Recusa>>()
  // Por clientId: a tela não tem mais o que `estadoEnviado` diz (`perdeuAFaixa`). Sai no próximo `syncDe`.
  const telaPerdida = new Map<string, 'vazia' | 'incerta'>()
  // Fase D do alcance, por clientId do dono: a mira aberta de cada jogador.
  const miras = new Map<string, MiraGuardada>()
  // Fase D: a mira do mestre (a store local dele); vale na cena cuja batalha tem a ficha dela.
  let miraDoMestreAgora: MiraNaMesaNoFio | null = null
  // Fase D, por clientId: tokenId → o JSON da última mira que saiu para a tela dele.
  const mirasEnviadas = new Map<string, Map<string, string>>()
  // Fase D, por playerId: os instantes das miras na janela (MIRAS_POR_JANELA).
  const mirasNaJanela = new Map<string, number[]>()
  // Fase D: a lista da tela do mestre, refeita só quando uma mira de jogador muda.
  let listaDoMestre: readonly MiraNaMesaNoFio[] = []
  let listaDoMestreVelha = false

  /** Mais uma mira do jogador na janela; `false` = passou do teto. */
  const cabeMira = (playerId: string): boolean => {
    const agora = deps.agora()
    const recentes = (mirasNaJanela.get(playerId) ?? []).filter((at) => agora - at < JANELA_DAS_MIRAS_MS)
    const cabe = recentes.length < MIRAS_POR_JANELA
    mirasNaJanela.set(playerId, cabe ? [...recentes, agora] : recentes)
    return cabe
  }

  /** A mira do jogador ainda vale: a mesma vez (ou o contra-ataque ainda guardado) e a ficha ainda na ordem. */
  const miraAindaVale = (mira: MiraGuardada): boolean => {
    const cena = deps.ponte?.cena(mira.sceneKey) ?? null
    if (cena === null) return false
    const { turnos } = cena
    const { tokenId } = mira.corpo
    if (!turnos.cartas.some((carta) => carta.tokenId === tokenId)) return false
    if (mira.vez === null) return (turnos.contras ?? []).some((contra) => contra.tokenId === tokenId)
    return turnos.vez === mira.vez.cartaId && turnos.rodada === mira.vez.rodada
  }

  /** A vez passou, o golpe fechou a batalha, a ficha saiu da ordem: a mira sai sozinha. */
  const podarMiras = (): void => {
    for (const [dono, mira] of miras) {
      if (miraAindaVale(mira)) continue
      miras.delete(dono)
      listaDoMestreVelha = true
    }
  }

  const apagarMira = (dono: string): boolean => {
    if (!miras.delete(dono)) return false
    listaDoMestreVelha = true
    return true
  }

  /**
   * As miras que a tela desta conexão pode ver, por ficha: só na cena dela, só de ficha que a tela
   * dela tem (a ficha escondida, na névoa ou noutra camada não chega, a mesma regra do recorte), e
   * nunca a dela mesma. O centro numa ficha só vai se ela também vê essa ficha.
   */
  const mirasParaATela = (conexao: ConexaoNaBatalha): Map<string, MiraNaMesaNoFio> => {
    const visiveis = new Map<string, MiraNaMesaNoFio>()
    const { lugar } = conexao
    const cena = lugar === null || deps.ponte === undefined ? null : deps.ponte.cena(lugar.sceneKey)
    if (lugar === null || cena === null) return visiveis
    const naTela = new Set(lugar.fichasNaTela.map((ficha) => ficha.id))
    const corpos: MiraNaMesaNoFio[] = []
    if (miraDoMestreAgora !== null && cena.turnos.cartas.some((carta) => carta.tokenId === miraDoMestreAgora?.tokenId)) corpos.push(miraDoMestreAgora)
    for (const [dono, mira] of miras) if (dono !== conexao.clientId && mira.sceneKey === lugar.sceneKey) corpos.push(mira.corpo)
    for (const corpo of corpos) {
      if (!naTela.has(corpo.tokenId)) continue
      const { centroId, ...resto } = corpo
      visiveis.set(corpo.tokenId, centroId !== undefined && naTela.has(centroId) ? { ...resto, centroId } : resto)
    }
    return visiveis
  }

  /** O que mudou nas miras da tela desta conexão desde a última vez: a nova ou a virada, e o `off` da que sumiu. */
  const mirasDaTela = (conexao: ConexaoNaBatalha): SaidaDaBatalha[] => {
    const { clientId } = conexao
    const agora = mirasParaATela(conexao)
    const antes = mirasEnviadas.get(clientId)
    const saidas: SaidaDaBatalha[] = []
    const enviadas = new Map<string, string>()
    for (const [tokenId, corpo] of agora) {
      const texto = JSON.stringify(corpo)
      enviadas.set(tokenId, texto)
      if (antes?.get(tokenId) !== texto) saidas.push({ clientId, msg: { type: 'batalha.miraNaMesa', ...corpo } })
    }
    for (const tokenId of antes?.keys() ?? []) if (!agora.has(tokenId)) saidas.push({ clientId, msg: { type: 'batalha.miraNaMesa', tokenId, off: true } })
    if (enviadas.size === 0) mirasEnviadas.delete(clientId)
    else mirasEnviadas.set(clientId, enviadas)
    return saidas
  }

  /** Mais um pedido do jogador na janela; `false` = passou do teto. */
  const cabePedido = (playerId: string): boolean => {
    const agora = deps.agora()
    const recentes = (pedidos.get(playerId) ?? []).filter((at) => agora - at < JANELA_DOS_PEDIDOS_DE_BATALHA_MS)
    const cabe = recentes.length < PEDIDOS_DE_BATALHA_POR_JANELA
    pedidos.set(playerId, cabe ? [...recentes, agora] : recentes)
    return cabe
  }

  const contextoDe = (conexao: ConexaoNaBatalha, lugar: LugarNaBatalha, mesa: FichasDaMesa | undefined): ContextoDoJogador => {
    const personagens = mesa?.personagens ?? []
    const equipes = mesa?.equipes
    return {
      playerId: conexao.playerId,
      meusTokens: lugar.meusTokens,
      tokensNoRecorte: new Map(lugar.fichasNaTela.map((ficha) => [ficha.id, ficha.name])),
      meusPersonagens: lugar.meusPersonagens,
      // Equipe por PERSONAGEM (Q2): NPC nunca, jogador de outra equipe nunca.
      aliados: aliadosDe(lugar.meusPersonagens, equipes, personagens),
      equipes,
      personagens,
      sistema: mesa?.sistema ?? null,
    }
  }

  /**
   * Os aliados que estão NA ORDEM desta batalha, na ordem da aventura e até o
   * teto: o perfil e a vida só abrem pela carta, e o aliado fora da luta seria
   * só peso no fio.
   */
  const aliadosNaOrdem = (cena: BatalhaEmTurnos, aliados: ReadonlySet<string>, personagens: readonly Personagem[]): Personagem[] => {
    const naOrdem = new Set<string>()
    for (const carta of cena.turnos.cartas) if (carta.personagemId !== null && aliados.has(carta.personagemId)) naOrdem.add(carta.personagemId)
    return personagens.filter((personagem) => naOrdem.has(personagem.id)).slice(0, ALIADOS_MAX)
  }

  /**
   * Conserto das fichas F2b (bug 8; respostas de 08/11: a ficha emprestada
   * "PODE AGIR COM O MENU INTEIRO"): na vez de uma ficha que a tela dele
   * mostra como "sua vez" (`meusTokens`) mas que não é dele de verdade (a
   * emprestada, o NPC que ele controla), o personagem dela vai na lista dos
   * aliados, primeiro: a tela monta o menu dela inteiro (armas, técnicas,
   * formas). Só na vez dela; fora dela, `null`.
   */
  const fichaDaVezQueEleControla = (cena: BatalhaEmTurnos, lugar: LugarNaBatalha, personagens: readonly Personagem[]): Personagem | null => {
    const daVez = cartaDaVez(cena.turnos)
    if (daVez === null || daVez.personagemId === null || daVez.bando !== undefined) return null
    if (!lugar.meusTokens.has(daVez.tokenId) || lugar.meusPersonagens.has(daVez.personagemId)) return null
    return personagens.find((personagem) => personagem.id === daVez.personagemId) ?? null
  }

  const syncDe = (conexao: ConexaoNaBatalha, mesa: FichasDaMesa | undefined): SaidaDaBatalha[] => {
    const { clientId, lugar } = conexao
    const cena = lugar === null || deps.ponte === undefined ? null : deps.ponte.cena(lugar.sceneKey)
    // A tela perdeu a faixa sem a conexão cair: o que saiu antes não conta mais (uma vez).
    const perdida = telaPerdida.get(clientId)
    telaPerdida.delete(clientId)
    if (lugar === null || cena === null) {
      aliadosEnviados.delete(clientId)
      efeitoVisto.delete(clientId)
      // O envio que falhou pode ter sido o próprio `null`: na incerta ele sai de novo.
      if (!estadoEnviado.has(clientId) && perdida !== 'incerta') return []
      // O `null` leva a faixa e os perfis dos aliados embora (o jogador limpa os dois).
      estadoEnviado.delete(clientId)
      return [{ clientId, msg: { type: 'batalha.estado', estado: null } }]
    }
    const ctx = contextoDe(conexao, lugar, mesa)
    const saidas: SaidaDaBatalha[] = []
    // Os aliados ANTES do recorte: quando a faixa chega, a carta do aliado já acha o personagem dele.
    const daVez = fichaDaVezQueEleControla(cena, lugar, ctx.personagens)
    const naOrdem = aliadosNaOrdem(cena, ctx.aliados, ctx.personagens)
    const aliados = daVez === null ? naOrdem : [daVez, ...naOrdem.filter((personagem) => personagem.id !== daVez.id)].slice(0, ALIADOS_MAX)
    // A tela que apagou a faixa também apagou os aliados: para ela é como a primeira vez.
    const antes = perdida === 'vazia' ? undefined : aliadosEnviados.get(clientId)
    // Primeira vez sem aliado nenhum não manda a lista vazia: ausente, para o jogador, já é "nenhum".
    const mudaram = perdida === 'incerta' ? aliados.length > 0 || antes !== undefined : antes === undefined ? aliados.length > 0 : !mesmasReferencias(antes, aliados)
    if (mudaram) saidas.push({ clientId, msg: { type: 'batalha.aliados', personagens: aliados.map(deps.paraOFio) } })
    aliadosEnviados.set(clientId, aliados)
    // COMPANION: as escolhas que esperam este jogador e o "Companion de Aira" nas cartas.
    const estado = mesa === undefined ? vistaParaJogador(cena, ctx) : comCompanionsNaVista(vistaParaJogador(cena, ctx), cena.turnos, lugar.meusPersonagens, mesa.personagens, mesa.sistema)
    const texto = JSON.stringify(estado)
    if (perdida !== undefined || estadoEnviado.get(clientId) !== texto) {
      saidas.push({ clientId, msg: { type: 'batalha.estado', estado } })
      estadoEnviado.set(clientId, texto)
    }
    // Os efeitos DEPOIS do recorte: o jogador só os aceita com a faixa na tela.
    const efeitos = efeitosNovos(clientId, lugar.sceneKey, cena, ctx.tokensNoRecorte, numerosVisiveisDe(cena, ctx))
    if (efeitos !== null) saidas.push({ clientId, msg: { type: 'batalha.efeitos', efeitos } })
    return saidas
  }

  /**
   * F2: os efeitos de `seq` maior que o último passado à conexão, só com
   * fichas que a tela dela tem (`efeitosParaJogador`). A marca anda até o
   * último `seq` da cena mesmo quando nada sai: o efeito que ela não pôde ver
   * não vira reprise depois. Primeira vez nesta cena (entrada, volta, cena
   * nova) ou `seq` que recomeçou: só marca. `null` = nada a mandar.
   */
  const efeitosNovos = (
    clientId: string,
    sceneKey: string,
    cena: BatalhaEmTurnos,
    tokensNoRecorte: ReadonlyMap<string, string>,
    numerosVisiveis: ReadonlySet<string>,
  ): EfeitoParaJogador[] | null => {
    const todos = cena.efeitos ?? []
    const ultimo = todos.at(-1)?.seq ?? 0
    const visto = efeitoVisto.get(clientId)
    efeitoVisto.set(clientId, { sceneKey, seq: ultimo })
    if (visto === undefined || visto.sceneKey !== sceneKey || visto.seq > ultimo || visto.seq === ultimo) return null
    const novos = efeitosParaJogador(todos, visto.seq, new Set(tokensNoRecorte.keys()), numerosVisiveis)
    return novos.length === 0 ? null : novos
  }

  /**
   * F3: as fichas cujos números da forma saem a esta conexão (os `numeros` do
   * efeito "transformacao"): as dele e as dos aliados de equipe, a mesma regra
   * da vida na carta (`ladoDa` da vista: "eu" ou "aliado"). NPC nunca entra.
   */
  const numerosVisiveisDe = (cena: BatalhaEmTurnos, ctx: ContextoDoJogador): ReadonlySet<string> => {
    const visiveis = new Set<string>(ctx.meusTokens)
    for (const carta of cena.turnos.cartas) {
      const { personagemId } = carta
      if (personagemId !== null && (ctx.meusPersonagens.has(personagemId) || ctx.aliados.has(personagemId))) visiveis.add(carta.tokenId)
    }
    return visiveis
  }

  /**
   * Conserto das fichas F1 (bug 1): a recusa leva um motivo curto, sem nada que a tela dele já não mostre. O que passa do
   * teto do fio sai cortado no fim de uma palavra (`motivoNoFio`), não no meio dela.
   */
  const resultado = (clientId: string, reqId: string, ok: boolean, motivo?: string): SaidaDaBatalha => ({
    clientId,
    msg: ok || motivo === undefined ? { type: 'batalha.resultado', reqId, ok } : { type: 'batalha.resultado', reqId, ok, motivo: motivoNoFio(motivo) },
  })
  const saidaDa = (clientId: string, reqId: string, resposta: true | Recusa): SaidaDaBatalha => (resposta === true ? resultado(clientId, reqId, true) : resultado(clientId, reqId, false, resposta.motivo))

  /** O autor no registro. O nome não decide nada: quem pode é conferido pelo `playerId`. */
  const autorDe = (conexao: ConexaoNaBatalha): AutorDaAcao => ({ tipo: 'jogador', playerId: conexao.playerId, nome: conexao.nome })

  /**
   * F2: o pedido passa pelo teto e, se o `reqId` já veio desta conexão, a
   * resposta de antes sai de novo sem `decidir` (sem agir de novo). Por
   * conexão: o `reqId` nasce no cliente, e outra conexão pode repeti-lo.
   * `decidir` devolve o `ok` (recusa do host ou o que a store fez).
   */
  const pedidoUnico = (conexao: ConexaoNaBatalha, reqId: string, decidir: () => boolean | Recusa): RespostaDaBatalha => {
    if (!cabePedido(conexao.playerId)) return NADA
    const guardadas = respostas.get(conexao.clientId) ?? new Map<string, true | Recusa>()
    const antes = guardadas.get(reqId)
    if (antes !== undefined) return { saidas: [saidaDa(conexao.clientId, reqId, antes)], mudou: false }
    const decidido = decidir()
    // `false` da store sem motivo vira a recusa genérica: o jogador sempre lê alguma coisa.
    const resposta: true | Recusa = decidido === true ? true : decidido === false ? RECUSA_GENERICA : decidido
    guardadas.set(reqId, resposta)
    if (guardadas.size > RESPOSTAS_GUARDADAS) {
      const maisVelha = guardadas.keys().next()
      if (maisVelha.done !== true) guardadas.delete(maisVelha.value)
    }
    respostas.set(conexao.clientId, guardadas)
    return { saidas: [saidaDa(conexao.clientId, reqId, resposta)], mudou: resposta === true }
  }

  /** A cena em batalha da conexão, com a ponte; `null` = fora (o pedido é recusado). */
  const cenaDa = (conexao: ConexaoNaBatalha): { ponte: PonteDaBatalha; lugar: LugarNaBatalha; cena: BatalhaEmTurnos } | null => {
    const { ponte } = deps
    const { lugar } = conexao
    if (ponte === undefined || lugar === null) return null
    const cena = ponte.cena(lugar.sceneKey)
    return cena === null ? null : { ponte, lugar, cena }
  }

  /** A ficha é DELE: o token é dele, ou o personagem ligado é dele (a mesma regra do recorte, `vistaDoJogador`). */
  const fichaDele = (lugar: LugarNaBatalha, tokenId: string, personagemId: string | null): boolean =>
    lugar.meusTokens.has(tokenId) || (personagemId !== null && lugar.meusPersonagens.has(personagemId))

  /**
   * R4/R5 (lote de 01/11): a carta do token na ordem é a ficha DELE de
   * verdade: token dele, ligado ao personagem dele (`personagemDaFicha`).
   * Nunca a emprestada, o NPC que ele controla nem o invocado do bando.
   */
  const fichaDeVerdade = (lugar: LugarNaBatalha, cena: BatalhaEmTurnos, tokenId: string): boolean => {
    const carta = cena.turnos.cartas.find((candidata) => candidata.tokenId === tokenId && candidata.bando === undefined)
    return carta !== undefined && carta.personagemId !== null && lugar.meusTokens.has(tokenId) && lugar.personagemDaFicha.get(tokenId) === carta.personagemId
  }

  /** Na vez: a carta da vez, nesta rodada, token dele e personagem dele. Fora da vez: um contra-ataque guardado de ficha dele. */
  const podePedirAcao = (lugar: LugarNaBatalha, cena: BatalhaEmTurnos, msg: BatalhaAgirMessage): boolean => {
    const { vez, pedido } = msg
    // F3: Ativar e Desfazer a forma só na vez dele, na ficha da vez (que é dele): nunca fora da vez, nem na ficha de outro.
    // Fase 8: usar item também (gasta a ação da vez; a vaga é da mochila da ficha da vez, que a store confere).
    if ((pedido.tipo === 'transformar' || pedido.tipo === 'destransformar' || pedido.tipo === 'item') && vez === null) return false
    if (vez === null) {
      // O parser só deixa `vez` null com `contraDe`; o `concentrar` nunca chega aqui.
      const contraDe = pedido.tipo === 'concentrar' ? undefined : pedido.contraDe
      return contraDe !== undefined && (cena.turnos.contras ?? []).some((contra) => contra.golpeId === contraDe && fichaDele(lugar, contra.tokenId, contra.personagemId))
    }
    const daVez = cartaDaVez(cena.turnos)
    // Conserto das fichas F1 (bug 8): toda ficha da vez que a tela dele mostra como "sua vez" age (a dele, a emprestada, o NPC
    // que ele controla), a mesma regra do `minhaVez` do recorte e do Passar a vez. A store confere a regra da ficha (`podeAgir`).
    return daVez !== null && daVez.id === vez.cartaId && cena.turnos.rodada === vez.rodada && lugar.meusTokens.has(daVez.tokenId)
  }

  /** A vez do pedido ainda é a da mesa (`vez` null = contra-ataque, fora da vez: não confere). */
  const vezAindaE = (cena: BatalhaEmTurnos, vez: BatalhaAgirMessage['vez']): boolean => vez === null || (cena.turnos.vez === vez.cartaId && cena.turnos.rodada === vez.rodada)

  /**
   * O motivo da regra (`motivoDoAgir`) para o pedido que a store recusou. Conserto das fichas F1 (bug 1): só saía para a ficha
   * DELE de verdade. U2 (plano de 10/11): na VEZ, sai para toda ficha que ele opera de direito (`podePedirAcao`: a dele, a
   * emprestada e o NPC que ele controla): a ficha inteira dessa carta já foi para a tela dele na vez dela
   * (`fichaDaVezQueEleControla`), então o motivo não conta o SP nem a recarga que ele já não leia. Fora da vez (o contra-ataque)
   * a ficha que não é dele não foi enviada: segue só na ficha DELE de verdade. Sem motivo: a recusa genérica.
   */
  const recusaDoAgir = (ponte: PonteDaBatalha, lugar: LugarNaBatalha, cena: BatalhaEmTurnos, conexao: ConexaoNaBatalha, msg: BatalhaAgirMessage): Recusa => {
    if (msg.vez === null) {
      const contraDe = msg.pedido.tipo === 'concentrar' ? undefined : msg.pedido.contraDe
      const tokenId = (cena.turnos.contras ?? []).find((contra) => contra.golpeId === contraDe)?.tokenId
      if (tokenId === undefined || !fichaDeVerdade(lugar, cena, tokenId)) return RECUSA_GENERICA
    } else if (!podePedirAcao(lugar, cena, msg)) return RECUSA_GENERICA
    const motivo = ponte.motivoDoAgir?.(lugar.sceneKey, autorDe(conexao), msg.vez, msg.pedido, lugar.tela) ?? null
    return motivo === null ? RECUSA_GENERICA : { motivo }
  }

  /** A ficha tem carta na ordem desta batalha (a reação livre e o dano livre só valem nela). */
  const naOrdem = (cena: BatalhaEmTurnos, tokenId: string): boolean => cena.turnos.cartas.some((carta) => carta.tokenId === tokenId)

  /** Os alvos só entre as fichas que a tela dele tem: o pedido não acha token que ele não vê. */
  const alvosNaTela = (lugar: LugarNaBatalha, msg: BatalhaAgirMessage): boolean => {
    const { pedido } = msg
    if (pedido.tipo !== 'atacar' && pedido.tipo !== 'habilidade' && pedido.tipo !== 'item') return true
    const naTela = new Set(lugar.fichasNaTela.map((ficha) => ficha.id))
    return pedido.alvos.every((alvo) => naTela.has(alvo.tokenId))
  }

  return {
    sync(conexoes, mesa) {
      // Conexão que caiu ou saiu não recebe mais nada: a chave dela só ocuparia memória.
      const vivas = new Set(conexoes.map((conexao) => conexao.clientId))
      for (const clientId of estadoEnviado.keys()) if (!vivas.has(clientId)) estadoEnviado.delete(clientId)
      for (const clientId of aliadosEnviados.keys()) if (!vivas.has(clientId)) aliadosEnviados.delete(clientId)
      for (const clientId of efeitoVisto.keys()) if (!vivas.has(clientId)) efeitoVisto.delete(clientId)
      for (const clientId of respostas.keys()) if (!vivas.has(clientId)) respostas.delete(clientId)
      for (const clientId of telaPerdida.keys()) if (!vivas.has(clientId)) telaPerdida.delete(clientId)
      for (const clientId of mirasEnviadas.keys()) if (!vivas.has(clientId)) mirasEnviadas.delete(clientId)
      for (const dono of miras.keys()) if (!vivas.has(dono)) apagarMira(dono)
      // Fase D: a vez que andou leva a mira embora; o `off` sai depois do recorte de cada tela.
      podarMiras()
      return conexoes.flatMap((conexao) => [...syncDe(conexao, mesa), ...mirasDaTela(conexao)])
    },

    entrou(conexao, mesa) {
      estadoEnviado.delete(conexao.clientId)
      aliadosEnviados.delete(conexao.clientId)
      // Sem reprise: o primeiro sync marca o `seq` de agora e não manda os velhos.
      efeitoVisto.delete(conexao.clientId)
      telaPerdida.delete(conexao.clientId)
      // Fase D: a tela nova não tem mira nenhuma; as que estão abertas saem já, depois do recorte.
      mirasEnviadas.delete(conexao.clientId)
      podarMiras()
      return [...syncDe(conexao, mesa), ...mirasDaTela(conexao)]
    },

    caiu(clientId) {
      estadoEnviado.delete(clientId)
      aliadosEnviados.delete(clientId)
      efeitoVisto.delete(clientId)
      respostas.delete(clientId)
      telaPerdida.delete(clientId)
      mirasEnviadas.delete(clientId)
      // Fase D: a mira de quem caiu sai de todas as telas que a receberam (a do mestre volta no próximo sync).
      const mira = miras.get(clientId)
      if (mira === undefined) return []
      apagarMira(clientId)
      const { tokenId } = mira.corpo
      const saidas: SaidaDaBatalha[] = []
      for (const [outro, enviadas] of mirasEnviadas) {
        if (!enviadas.delete(tokenId)) continue
        saidas.push({ clientId: outro, msg: { type: 'batalha.miraNaMesa', tokenId, off: true } })
        if (enviadas.size === 0) mirasEnviadas.delete(outro)
      }
      return saidas
    },

    perdeuAFaixa(clientId, como) {
      // A incerta vence: a tela que apagou a faixa e depois perdeu um envio continua sem saber o que tem.
      if (telaPerdida.get(clientId) !== 'incerta') telaPerdida.set(clientId, como)
    },

    esquecer(playerId) {
      pedidos.delete(playerId)
      mirasNaJanela.delete(playerId)
    },

    passar(conexao, msg) {
      // Acima do teto morre calado: nem a recusa sai (o molde dos pedidos de ficha).
      if (!cabePedido(conexao.playerId)) return NADA
      // Um motivo só para toda vez que não bate ("A vez já passou"): um por caso ensinaria quais cartas e rodadas existem.
      const recusar = (recusa: Recusa): RespostaDaBatalha => ({ saidas: [saidaDa(conexao.clientId, msg.reqId, recusa)], mudou: false })
      const { ponte } = deps
      const { lugar } = conexao
      if (ponte === undefined || lugar === null) return recusar(RECUSA_FORA_DA_BATALHA)
      const cena = ponte.cena(lugar.sceneKey)
      if (cena === null) return recusar(RECUSA_FORA_DA_BATALHA)
      const daVez = cartaDaVez(cena.turnos)
      // A vez tem de ser ESTA carta, NESTA rodada, de ficha dele: o clique duplo e o reenvio acham a vez já andada.
      if (daVez === null || daVez.id !== msg.cartaId || cena.turnos.rodada !== msg.rodada || !lugar.meusTokens.has(daVez.tokenId)) return recusar(RECUSA_DA_VEZ)
      const ok = ponte.passarVez(lugar.sceneKey, autorDe(conexao), { cartaId: msg.cartaId, rodada: msg.rodada })
      return { saidas: [saidaDa(conexao.clientId, msg.reqId, ok ? true : RECUSA_DA_VEZ)], mudou: ok }
    },

    desfazer(conexao, msg) {
      if (!cabePedido(conexao.playerId)) return NADA
      const recusa: RespostaDaBatalha = { saidas: [resultado(conexao.clientId, msg.reqId, false)], mudou: false }
      const { ponte } = deps
      const { lugar } = conexao
      if (ponte === undefined || lugar === null) return recusa
      const cena = ponte.cena(lugar.sceneKey)
      if (cena === null) return recusa
      const linha = cena.registro.find((candidata) => candidata.id === msg.linhaId)
      const daVez = cartaDaVez(cena.turnos)
      const vezDele = daVez !== null && lugar.meusTokens.has(daVez.tokenId)
      // Só a linha DELE (pelo playerId, nunca pelo nome), de tipo que o jogador desfaz, não desfeita, e na vez dele.
      if (linha === undefined || !podeDesfazer(linha, { tipo: 'jogador', playerId: conexao.playerId }, vezDele)) return recusa
      const ok = ponte.desfazer(lugar.sceneKey, msg.linhaId, autorDe(conexao))
      return { saidas: [resultado(conexao.clientId, msg.reqId, ok)], mudou: ok }
    },

    // A store confere a regra (`podeAgir` etc.) e rola o d20. Conserto das fichas F1 (bug 1): a recusa diz por quê.
    agir(conexao, msg) {
      return pedidoUnico(conexao, msg.reqId, () => {
        const daCena = cenaDa(conexao)
        if (daCena === null) return RECUSA_FORA_DA_BATALHA
        const { ponte, lugar, cena } = daCena
        if (!vezAindaE(cena, msg.vez)) return RECUSA_DA_VEZ
        if (!podePedirAcao(lugar, cena, msg)) return RECUSA_DA_FICHA
        if (!alvosNaTela(lugar, msg)) return RECUSA_DO_ALVO
        return ponte.agir(lugar.sceneKey, autorDe(conexao), msg.vez, msg.pedido, lugar.tela) || recusaDoAgir(ponte, lugar, cena, conexao, msg)
      })
    },

    reagir(conexao, msg) {
      return pedidoUnico(conexao, msg.reqId, () => {
        const daCena = cenaDa(conexao)
        if (daCena === null) return false
        const { ponte, lugar, cena } = daCena
        const { pedido } = msg
        if (pedido.golpeId === null) {
          // Reação livre (o botão Reação sem golpe esperando): só com token dele que está na ordem.
          if (!lugar.meusTokens.has(pedido.tokenId) || !naOrdem(cena, pedido.tokenId)) return false
        } else {
          const golpe = (cena.turnos.golpes ?? []).find((candidato) => candidato.id === pedido.golpeId)
          const alvo = golpe?.alvos.find((candidato) => candidato.tokenId === pedido.tokenId)
          // O golpe ainda espera, e a ficha é um alvo DELE ainda sem resolver (bug 1: o golpe que já fechou, como "Não reagiu", diz por quê).
          if (alvo === undefined || alvo.danoFinal !== undefined) return RECUSA_DA_REACAO
          // F2 (fatia B, o "perto" do Aplauso): a técnica no lugar do alvo sai da ficha DELE que está perto (um dos `porPerto`), de
          // verdade e com o personagem dela, pela mesma regra da técnica abaixo; o alvo pode ser de outro. A store confere o resto.
          if (pedido.tipo === 'tecnica' && pedido.por !== undefined) {
            const por = pedido.por
            const personagemDoPor = cena.turnos.cartas.find((carta) => carta.tokenId === por)?.personagemId ?? null
            const deleDeVerdade = personagemDoPor !== null && fichaDele(lugar, por, personagemDoPor) && lugar.personagemDaFicha.get(por) === personagemDoPor
            if (!deleDeVerdade || !alvo.podeReagir || alvo.rolagem !== undefined || !(alvo.porPerto ?? []).includes(por)) return false
            return ponte.reagir(lugar.sceneKey, autorDe(conexao), pedido)
          }
          if (!fichaDele(lugar, alvo.tokenId, alvo.personagemId)) return false
          // "Não reagir" depois do d20 rolado seria fugir do resultado (o 1 natural, do crítico): só o mestre marca.
          if (pedido.tipo === 'naoReagir' && alvo.rolagem !== undefined) return false
          // "Passar" é a saída do jogador DEPOIS do dado: toma o golpe inteiro e o 1 natural continua crítico (a store decide a saída).
          if (pedido.tipo === 'passar' && alvo.rolagem === undefined) return false
          // Tipos de habilidade F1: a técnica vem NO LUGAR do d20 (antes dele), só em golpe que deixa reagir e numa ficha DELE de
          // verdade, com o personagem dele: nunca na emprestada nem no NPC que ele controla (cobraria o SP de outro, e a recusa
          // por SP contaria quanto o NPC tem). Mesma regra do dano, da passiva e do Evoluir.
          // A técnica ser do personagem, de reação, disponível e paga, e a saída no conjunto, a store confere (`motivoDaReacaoComTecnica`).
          if (pedido.tipo === 'tecnica' && (!alvo.podeReagir || alvo.rolagem !== undefined || lugar.personagemDaFicha.get(alvo.tokenId) !== alvo.personagemId)) return false
        }
        return ponte.reagir(lugar.sceneKey, autorDe(conexao), pedido)
      })
    },

    dano(conexao, msg) {
      return pedidoUnico(conexao, msg.reqId, () => {
        const daCena = cenaDa(conexao)
        if (daCena === null) return false
        const { ponte, lugar, cena } = daCena
        // Só numa ficha DELE de verdade, com personagem e na ordem: nunca na emprestada nem no NPC (a vida deles é do mestre).
        if (!lugar.meusTokens.has(msg.tokenId) || !lugar.personagemDaFicha.has(msg.tokenId) || !naOrdem(cena, msg.tokenId)) return false
        return ponte.darDano(lugar.sceneKey, autorDe(conexao), msg.tokenId, msg.valor)
      })
    },

    armas(conexao, msg) {
      return pedidoUnico(conexao, msg.reqId, () => {
        const daCena = cenaDa(conexao)
        if (daCena === null) return false
        const { ponte, lugar, cena } = daCena
        // Personagem dele com carta na ordem. Sem "ainda não escolheu": troca quando quiser (Q8); o limite é da store.
        if (!lugar.meusPersonagens.has(msg.personagemId) || !cena.turnos.cartas.some((carta) => carta.personagemId === msg.personagemId)) return false
        return ponte.escolherArmas(lugar.sceneKey, autorDe(conexao), msg.personagemId, msg.armas)
      })
    },

    zerarCarga(conexao, msg) {
      return pedidoUnico(conexao, msg.reqId, () => {
        const daCena = cenaDa(conexao)
        if (daCena === null) return false
        const { ponte, lugar, cena } = daCena
        // Personagem dele com carta na ordem; fora da vez também (ele perde a concentração ao tomar o golpe).
        if (!lugar.meusPersonagens.has(msg.personagemId) || !cena.turnos.cartas.some((carta) => carta.personagemId === msg.personagemId)) return false
        return ponte.zerarCarga(lugar.sceneKey, autorDe(conexao), msg.personagemId)
      })
    },

    passiva(conexao, msg) {
      return pedidoUnico(conexao, msg.reqId, () => {
        const daCena = cenaDa(conexao)
        if (daCena === null) return false
        const { ponte, lugar, cena } = daCena
        const { pedido } = msg
        const carta = cena.turnos.cartas.find((candidata) => candidata.tokenId === pedido.tokenId)
        // A passiva é do personagem de uma ficha DELE de verdade: nunca da emprestada nem do NPC (essas o mestre ativa).
        if (ponte.passiva === undefined || carta === undefined || carta.personagemId === null) return false
        if (!lugar.meusTokens.has(carta.tokenId) || !lugar.meusPersonagens.has(carta.personagemId)) return false
        // O oponente escolhido, só entre as fichas que a tela dele tem: o pedido não acha token que ele não vê.
        if (pedido.tipo === 'passiva' && pedido.alvoTokenId !== undefined && !lugar.fichasNaTela.some((ficha) => ficha.id === pedido.alvoTokenId)) return false
        return ponte.passiva(lugar.sceneKey, autorDe(conexao), pedido)
      })
    },

    evoluir(conexao, msg) {
      return pedidoUnico(conexao, msg.reqId, () => {
        const daCena = cenaDa(conexao)
        if (daCena === null) return false
        const { ponte, lugar, cena } = daCena
        const { pedido } = msg
        const carta = cena.turnos.cartas.find((candidata) => candidata.tokenId === pedido.tokenId)
        // A técnica é do personagem de uma ficha DELE de verdade: nunca da emprestada nem do NPC (essas o mestre evolui).
        if (ponte.evoluir === undefined || carta === undefined || carta.personagemId === null) return false
        if (!lugar.meusTokens.has(carta.tokenId) || !lugar.meusPersonagens.has(carta.personagemId)) return false
        // Só na vez dele: a carta da vez é token dele com o MESMO personagem (a store confere de novo).
        const daVez = cartaDaVez(cena.turnos)
        if (daVez === null || daVez.personagemId !== carta.personagemId || !lugar.meusTokens.has(daVez.tokenId)) return false
        if (ponte.evoluir(lugar.sceneKey, autorDe(conexao), pedido)) return true
        // F2 (revisão da fatia F): o personagem é dele (conferido acima), então a recusa diz a regra, como no `agir` (a Melodia
        // que a CAÇA pede só o host sabe). Sem motivo: a recusa genérica.
        const motivo = ponte.motivoDoEvoluir?.(lugar.sceneKey, autorDe(conexao), pedido) ?? null
        return motivo === null ? RECUSA_GENERICA : { motivo }
      })
    },

    invocar(conexao, msg) {
      return pedidoUnico(conexao, msg.reqId, () => {
        const daCena = cenaDa(conexao)
        if (daCena === null) return false
        const { ponte, lugar, cena } = daCena
        const { pedido } = msg
        const carta = cena.turnos.cartas.find((candidata) => candidata.tokenId === pedido.tokenId && candidata.bando === undefined)
        if (ponte.invocar === undefined || carta === undefined || carta.personagemId === null) return false
        // A técnica é do personagem de uma ficha DELE de verdade (o token ligado à ficha dele): nunca da emprestada nem do
        // NPC que ele controla (essas o mestre invoca; a recusa por SP contaria quanto o NPC tem).
        if (!lugar.meusTokens.has(carta.tokenId) || lugar.personagemDaFicha.get(carta.tokenId) !== carta.personagemId) return false
        // Só na vez dele: a carta da vez é token dele com o MESMO personagem (a store confere de novo).
        const daVez = cartaDaVez(cena.turnos)
        if (daVez === null || daVez.personagemId !== carta.personagemId || !lugar.meusTokens.has(daVez.tokenId)) return false
        return ponte.invocar(lugar.sceneKey, autorDe(conexao), pedido)
      })
    },

    marcar(conexao, msg) {
      return pedidoUnico(conexao, msg.reqId, () => {
        const daCena = cenaDa(conexao)
        if (daCena === null) return false
        const { ponte, lugar, cena } = daCena
        const lembrete = (cena.turnos.lembretesDaMarca ?? []).find((candidato) => candidato.id === msg.pedido.lembreteId)
        if (ponte.marcar === undefined || lembrete === undefined) return false
        if (!lugar.meusTokens.has(lembrete.tokenId) || lugar.personagemDaFicha.get(lembrete.tokenId) !== lembrete.personagemId) return false
        return ponte.marcar(lugar.sceneKey, autorDe(conexao), msg.pedido)
      })
    },

    ajustar(conexao, msg) {
      return pedidoUnico(conexao, msg.reqId, () => {
        const daCena = cenaDa(conexao)
        if (daCena === null) return false
        const { ponte, lugar, cena } = daCena
        if (ponte.ajustar === undefined || !fichaDeVerdade(lugar, cena, msg.pedido.tokenId)) return false
        return ponte.ajustar(lugar.sceneKey, autorDe(conexao), msg.pedido)
      })
    },

    contador(conexao, msg) {
      return pedidoUnico(conexao, msg.reqId, () => {
        const daCena = cenaDa(conexao)
        if (daCena === null) return false
        const { ponte, lugar, cena } = daCena
        // O fio só deixa "ganhar"; zerar é do mestre, na tela dele.
        if (ponte.contador === undefined || msg.pedido.tipo !== 'ganhar' || !fichaDeVerdade(lugar, cena, msg.pedido.tokenId)) return false
        return ponte.contador(lugar.sceneKey, autorDe(conexao), msg.pedido)
      })
    },

    ajuda(conexao, msg) {
      return pedidoUnico(conexao, msg.reqId, () => {
        const daCena = cenaDa(conexao)
        if (daCena === null) return RECUSA_FORA_DA_BATALHA
        const { ponte, lugar, cena } = daCena
        const ajuda = (cena.turnos.pedidosDeAjuda ?? []).find((candidata) => candidata.id === msg.pedido.ajudaId)
        if (ponte.ajuda === undefined || ajuda === undefined) return RECUSA_DA_AJUDA_FECHADA
        if (msg.pedido.tipo === 'responderAjuda') {
          // Só o dono DE VERDADE do personagem pedido (nunca a ficha emprestada); o NPC aliado o mestre responde na tela dele.
          if (ajuda.paraPersonagemId === null || !lugar.meusPersonagens.has(ajuda.paraPersonagemId)) return RECUSA_DA_AJUDA_DE_OUTRO
          if (ajuda.estado !== 'esperando') return RECUSA_DA_AJUDA_FECHADA
          if (ponte.ajuda(lugar.sceneKey, autorDe(conexao), msg.pedido)) return true
          // O store fechou o pedido no caminho (venceu o prazo): a recusa diz isso, não "quem pediu já não pode".
          const depois = ponte.cena(lugar.sceneKey)?.turnos.pedidosDeAjuda?.find((candidata) => candidata.id === ajuda.id)
          return depois?.estado === 'venceu' ? RECUSA_DA_AJUDA_VENCIDA : msg.pedido.aceita ? RECUSA_DO_ACEITE : RECUSA_DA_AJUDA_FECHADA
        }
        // Cancelar (ou fechar o aviso): só quem pediu, pela ficha que pediu.
        if (!fichaDele(lugar, ajuda.deTokenId, ajuda.dePersonagemId)) return RECUSA_DA_AJUDA_DE_OUTRO
        return ponte.ajuda(lugar.sceneKey, autorDe(conexao), msg.pedido) || RECUSA_DA_AJUDA_FECHADA
      })
    },

    companions(conexao, msg) {
      return pedidoUnico(conexao, msg.reqId, () => {
        const daCena = cenaDa(conexao)
        if (daCena === null) return RECUSA_FORA_DA_BATALHA
        const { ponte, lugar } = daCena
        if (ponte.escolherCompanions === undefined) return RECUSA_GENERICA
        // Só o dono de verdade escolhe (a ficha emprestada não leva os companions de outro).
        if (!lugar.meusPersonagens.has(msg.donoPersonagemId)) return RECUSA_DA_FICHA
        const motivo = ponte.escolherCompanions(lugar.sceneKey, autorDe(conexao), msg.donoPersonagemId, msg.escolhidos)
        return motivo === null ? true : { motivo }
      })
    },

    mira(conexao, msg) {
      const { clientId } = conexao
      // Fechar só tira: passa mesmo acima do teto (a mira presa na tela dos outros seria pior).
      if ('off' in msg) return apagarMira(clientId)
      if (!cabeMira(conexao.playerId)) return false
      const daCena = cenaDa(conexao)
      if (daCena === null) return apagarMira(clientId)
      const { ponte, lugar, cena } = daCena
      const { tokenId } = msg
      // A ficha que ele opera (a dele, a emprestada, o NPC que ele controla): a de outro é forjada e não muda nada.
      if (!lugar.meusTokens.has(tokenId)) return false
      const daVez = cartaDaVez(cena.turnos)
      const naVez = daVez !== null && daVez.tokenId === tokenId && daVez.bando === undefined
      const comContra = (cena.turnos.contras ?? []).some((contra) => contra.tokenId === tokenId && fichaDele(lugar, contra.tokenId, contra.personagemId))
      if (!naVez && !comContra) return false
      // A forma e a cor pelo cartão do HOST: o jogador só diz qual ação.
      const alcance = ponte.alcanceDaMira?.(lugar.sceneKey, autorDe(conexao), tokenId, msg.acao) ?? null
      if (alcance === null) return apagarMira(clientId)
      const { forma } = alcance
      const corpo: MiraNaMesaNoFio = { tokenId, forma, cor: alcance.cor, acendeQuemUsa: alcance.acendeQuemUsa }
      if (usaDirecao(forma) && msg.direcao !== undefined) corpo.direcao = msg.direcao
      if (forma.tipo === 'ponto' && msg.ponto !== undefined) corpo.ponto = msg.ponto
      // O centro numa ficha, só entre as fichas que a tela dele tem (o pedido não acha token que ele não vê).
      if (forma.tipo === 'ficha' && msg.centroId !== undefined && lugar.fichasNaTela.some((ficha) => ficha.id === msg.centroId)) corpo.centroId = msg.centroId
      const nova: MiraGuardada = { sceneKey: lugar.sceneKey, vez: naVez ? { cartaId: daVez.id, rodada: cena.turnos.rodada } : null, corpo }
      const antes = miras.get(clientId)
      if (antes !== undefined && JSON.stringify(antes) === JSON.stringify(nova)) return false
      miras.set(clientId, nova)
      listaDoMestreVelha = true
      return true
    },

    miraDoMestre(mira) {
      if (JSON.stringify(mira) === JSON.stringify(miraDoMestreAgora)) return false
      miraDoMestreAgora = mira
      return true
    },

    mirasNaMesa(conexoes) {
      podarMiras()
      return conexoes.flatMap(mirasDaTela)
    },

    mirasDosJogadores() {
      podarMiras()
      if (listaDoMestreVelha) {
        listaDoMestre = [...miras.values()].map((mira) => mira.corpo)
        listaDoMestreVelha = false
      }
      return listaDoMestre
    },
  }
}
