import type { Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { corDaEquipe, equipeDe, NOME_DA_EQUIPE_MAX, NOME_DA_EQUIPE_PADRAO, type Equipe } from './equipes'
import type { BatalhaEmTurnos } from './ponte'
import { registroParaJogador, type LinhaParaJogador } from './registro'
import { regrasParaOFio, type RegrasDaBatalha } from './regrasDoCampo'
import { cartaDaVez, proximaCarta, tokensCaidos, turnoNoM, type CartaDaOrdem, type DuracaoDaExtra, type TurnoNoM } from './turnos'

/**
 * O RECORTE DA BATALHA PARA UM JOGADOR (F1, seções 2.1 e 3.2 do plano): o que
 * vai no `batalha.estado` de uma conexão. Quem chama é o host, por conexão.
 *
 * Regras (decisões 1 e 4; Q1 e Q3):
 *  - carta de token fora do recorte dele NÃO sai; "Turno N/M" e a próxima
 *    contam só as que saem, e a vez escondida vira `vezForaDaVista`;
 *  - nunca sai Agilidade, d20 nem marca de empate;
 *  - o lado da carta: "eu" (ficha dele), "aliado" (personagem de `aliados`) ou
 *    "outro" (NPC e jogador de outra equipe). Só "eu" e "aliado" levam o
 *    `personagemId` (abre o perfil) e o "caiu";
 *  - o estado não leva número de vida: HP/SP o jogador lê do personagem que
 *    já tem (o dele em `personagens`, o do aliado em `batalha.aliados`).
 *
 * Puro: sem store, sem rede.
 */

export type LadoNaCarta = 'eu' | 'aliado' | 'outro'

export interface CartaParaJogador {
  id: string
  tokenId: string
  /** O nome do token como a tela dele o mostra. */
  nome: string
  lado: LadoNaCarta
  equipe?: { nome: string; cor: string }
  /** Só "eu" e "aliado": abre o perfil. */
  personagemId?: string
  extra?: DuracaoDaExtra
  /** Só "eu" e "aliado": a vida chegou a 0. */
  caiu?: true
}

export interface EstadoParaJogador {
  rodada: number
  turno: TurnoNoM
  /** A carta da vez, se ele a vê. */
  vez: string | null
  /** A próxima carta que ele vê e que joga (a caída é pulada). */
  proxima: string | null
  /** A carta da vez é de ficha dele. */
  minhaVez: boolean
  /** Há vez, mas é de uma carta que ele não vê: "Vez de alguém fora da sua vista". */
  vezForaDaVista: boolean
  cartas: CartaParaJogador[]
  registro: LinhaParaJogador[]
  regras: RegrasDaBatalha | null
}

/** O que o host sabe da conexão para montar o recorte. */
export interface ContextoDoJogador {
  playerId: string
  /** As fichas (tokens) dele: `ownership[playerId]`. */
  meusTokens: ReadonlySet<string>
  /** tokenId → nome, das fichas que a tela dele TEM agora. Fora daqui, a carta não sai. */
  tokensNoRecorte: ReadonlyMap<string, string>
  /** Os personagens ligados às fichas dele. */
  meusPersonagens: ReadonlySet<string>
  /** `aliadosDe(meusPersonagens, equipes, personagens)`. */
  aliados: ReadonlySet<string>
  equipes: readonly Equipe[] | undefined
  /** Todos os personagens do mundo (para o tipo e a vida). */
  personagens: readonly Personagem[]
  sistema: SistemaDeRpg | null
}

/** Teto de cartas no fio (o mesmo número de fichas que o recorte aguenta com folga). */
export const CARTAS_PARA_JOGADOR_MAX = 200
/** Teto do nome da carta no fio: o nome do token é livre, e o fio não. */
export const NOME_NA_CARTA_MAX = 80

function ladoDa(carta: CartaDaOrdem, ctx: ContextoDoJogador): LadoNaCarta {
  if (ctx.meusTokens.has(carta.tokenId)) return 'eu'
  if (carta.personagemId === null) return 'outro'
  if (ctx.meusPersonagens.has(carta.personagemId)) return 'eu'
  return ctx.aliados.has(carta.personagemId) ? 'aliado' : 'outro'
}

function cartaParaJogador(carta: CartaDaOrdem, nome: string, ctx: ContextoDoJogador, caidos: ReadonlySet<string>): CartaParaJogador {
  const lado = ladoDa(carta, ctx)
  const saida: CartaParaJogador = { id: carta.id, tokenId: carta.tokenId, nome: nome.slice(0, NOME_NA_CARTA_MAX), lado }
  const equipe = carta.personagemId === null ? null : equipeDe(carta.personagemId, ctx.equipes)
  // Cor e nome passam de novo pelos tetos: a equipe pode ter vindo da tela do mestre sem passar pelo arquivo.
  if (equipe !== null) saida.equipe = { nome: equipe.nome.trim().slice(0, NOME_DA_EQUIPE_MAX) || NOME_DA_EQUIPE_PADRAO, cor: corDaEquipe(equipe.cor) }
  if (carta.extra !== undefined) saida.extra = carta.extra.duracao
  if (lado !== 'outro') {
    if (carta.personagemId !== null) saida.personagemId = carta.personagemId
    if (caidos.has(carta.tokenId)) saida.caiu = true
  }
  return saida
}

export function vistaParaJogador(cena: BatalhaEmTurnos, ctx: ContextoDoJogador): EstadoParaJogador {
  const { turnos } = cena
  const caidos = tokensCaidos(turnos.cartas, ctx.personagens, ctx.sistema)
  const cartas: CartaParaJogador[] = []
  for (const carta of turnos.cartas) {
    if (cartas.length >= CARTAS_PARA_JOGADOR_MAX) break
    const nome = ctx.tokensNoRecorte.get(carta.tokenId)
    if (nome !== undefined) cartas.push(cartaParaJogador(carta, nome, ctx, caidos))
  }
  // "Visível" = o que de fato sai (no recorte E dentro do teto): turno e próxima contam o mesmo que a faixa mostra.
  const idsQueSaem = new Set(cartas.map((carta) => carta.id))
  const visivel = (carta: CartaDaOrdem): boolean => idsQueSaem.has(carta.id)
  const daVez = cartaDaVez(turnos)
  const vezVisivel = daVez !== null && visivel(daVez)
  const minhaVez = daVez !== null && ctx.meusTokens.has(daVez.tokenId)
  const proxima = proximaCarta(turnos, caidos, visivel)
  const npcs = new Set(ctx.personagens.filter((personagem) => personagem.tipo === 'npc').map((personagem) => personagem.id))
  const registro = registroParaJogador(cena.registro, {
    playerId: ctx.playerId,
    minhaVez,
    tokensNoRecorte: new Set(ctx.tokensNoRecorte.keys()),
    personagensVisiveis: new Set([...ctx.meusPersonagens, ...ctx.aliados]),
    npcs,
  })
  return {
    rodada: turnos.rodada,
    turno: turnoNoM(turnos, visivel),
    vez: vezVisivel ? daVez.id : null,
    // A próxima é a da vez seguinte: igual à vez só quando ela é a única que joga.
    proxima: proxima !== null && proxima.id !== turnos.vez ? proxima.id : null,
    minhaVez,
    vezForaDaVista: daVez !== null && !vezVisivel,
    cartas,
    registro,
    regras: cena.regras === null ? null : regrasParaOFio(cena.regras),
  }
}
