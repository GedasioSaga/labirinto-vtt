import { idsOcultos } from '../habilidadeOculta'
import { ehImagemDaMesa, ehRefDeMidia } from '../midia'
import { numeroDaFicha, type Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { recursoDeVida, vidaDoPersonagem } from '../vidaDaFicha'
import { acoesDaVez, rankDeAgilidade, type AcoesDaVez } from './acoes'
import {
  chaveDaVez,
  CHAVE_DA_LEMBRADA_MAX,
  combateVazio,
  DANO_MAX,
  EFEITOS_POR_MENSAGEM,
  EVOLUIDAS_MAX,
  GOLPES_PENDENTES_MAX,
  ID_DO_CARTAO_MAX,
  LEMBRADAS_MAX,
  LEMBRETES_MAX,
  INVOCACOES_PENDENTES_MAX,
  MEMBROS_DO_BANDO_MAX,
  MODS_POR_SELO_MAX,
  NOME_DO_INVOCADO_MAX,
  NOME_DA_FORMA_MAX,
  FORMAS_PENDENTES_MAX,
  NOME_DO_GOLPE_MAX,
  NOME_DO_SELO_MAX,
  NUMERO_DA_FORMA_MAX,
  NUMEROS_DA_FORMA_MAX,
  PASSIVAS_ATIVAS_MAX,
  ROTULO_DO_NUMERO_MAX,
  SELOS_POR_TOKEN_MAX,
  TURNOS_DO_SELO_MAX,
  type CombateDoPersonagem,
  type EfeitoDaBatalha,
  type GolpeDaBatalha,
  type LembreteDaPassiva,
  type ModDoSelo,
  type NaturezaDoSelo,
  type NumeroDaForma,
  type RolagemDaReacao,
  type SaidaDaReacao,
  type SeloDaBatalha,
} from './combate'
import { corDaEquipe, equipeDe, equipesNaLeitura, ladoNaBatalha, NOME_DA_EQUIPE_MAX, NOME_DA_EQUIPE_PADRAO, type Equipe, type LadosDaBatalha } from './equipes'
import type { JudgeNaCena } from './judge'
import { limiteDeArmas, recursoDoEscudo } from './leituraDaFicha'
import { LEMBRETES_DA_MARCA_MAX } from './marca'
import { passivasLigadas } from './passivas'
import type { BatalhaEmTurnos } from './ponte'
import { escudoMaisAlto, registroParaJogador, type LinhaDoRegistro, type LinhaParaJogador } from './registro'
import { BLOCOS_POR_RANK_PADRAO, regrasParaOFio, type RegrasDaBatalha } from './regrasDoCampo'
import { ehAlvoDeMod, ehNomeDeSelo, selosDoToken, type SeloQueSoma } from './selos'
import { aparenciaDaForma, formaNaVez, nomeDaFormaLigada } from './transformacao'
import { cartaDaVez, proximaCarta, tokensCaidos, turnoNoM, type CartaDaOrdem, type DuracaoDaExtra, type TurnoNoM, type TurnosDaCena } from './turnos'

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
 *    já tem (o dele em `personagens`, o do aliado em `batalha.aliados`). Duas
 *    exceções, as duas só do lado dele: o invocado do bando e, desde a
 *    unificação do combate (10/11/2026), o NPC que luta do lado de um
 *    personagem dele (`vida` na carta). De quem luta contra ele, nunca;
 *  - `ladoNaLuta` (10/11/2026): o lado de cada ficha na luta, a regra que o
 *    host confere, como um número que só vale dentro do estado. O "lado" acima
 *    diz de quem é a ficha; este diz com quem ela luta (o NPC emprestado é
 *    "eu" e pode lutar do outro lado).
 *
 * F2 (seção 2.3 de docs/planos/batalha-one-piece-f2-plano.md), todos
 * opcionais (ausente = nada):
 *  - `acoes`: só com `minhaVez`, as ações da carta da vez ("Simples 0/1 ·
 *    Mov 2/4");
 *  - `meus`: recargas, usos, Overload, carga e armas SÓ dos personagens
 *    dele com carta na ordem — nunca de aliado, NPC ou outra equipe;
 *  - `reacoes`: os golpes esperando a reação de ficha DELE, com o dano que
 *    chega nela (ele precisa ver "quanto");
 *  - `golpes`: os golpes esperando reação cujo atacante e alvos estão TODOS
 *    na tela dele ("Esperando a reação de Ilo");
 *  - `contras` (Q6): os contra-ataques ganhos por ficha dele e não usados.
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
  /** F3: o nome da forma ativada pelo menu e ainda ligada ("Punho Negro"). Para todos que veem a carta, também de NPC. */
  forma?: string
  /** F3 (Q5): os selos da ficha ("Atordoado 2"). Para todos que veem a carta, também de NPC (fora o "Ajustar..." do mestre, R4). */
  selos?: SeloParaJogador[]
  /** C10 (lote de 01/11): só "eu" e "aliado": o Escudo atual. Sem Escudo (0, ou o sistema não tem) = ausente. Nunca de NPC. */
  escudo?: number
  /** C10: o cheio da barra do Escudo (o maior na batalha), só quando passa do atual. Vai junto do `escudo`. */
  escudoMax?: number
  /** Invocação: a carta é a do BANDO de um dono (`tokenId` = `bando_<dono>`, ou `bando_fora_N` com o dono fora da vista; não é token do mapa). */
  bando?: BandoParaJogador
  /**
   * Unificação do combate (10/11/2026): o lado da ficha NA LUTA (`ladoNaBatalha`, o que o host confere), como um número
   * de 1 em diante que só vale dentro deste estado: mesmo número = mesmo lado. É por ele que a mira sabe os aliados do NPC
   * emprestado. Na carta do bando, o lado do dono. Ausente = ficha sem lado (ou host antigo): a mira cai na equipe.
   */
  ladoNaLuta?: number
  /**
   * Unificação do combate (10/11/2026): só na carta "outro" de NPC que luta do MESMO lado de um personagem dele (o NPC
   * da equipe dos jogadores): a vida, de onde a mira tira o ferido e o caído. Nunca de quem luta contra ele.
   */
  vida?: VidaNaCarta
}

/** A vida que sai numa carta ou num invocado: inteiros no teto do fio, o máximo nunca abaixo de 1. */
export interface VidaNaCarta {
  atual: number
  maximo: number
}

/**
 * Invocação (decisões 3 e 7 de docs/planos/batalha-invocacao-plano.md): o
 * bando como a carta o mostra. A carta sai se a tela dele tem o dono ou algum
 * invocado; `membros` = só os invocados que a tela dele tem.
 */
export interface BandoParaJogador {
  /** O dono, só se a tela dele tem a ficha. */
  donoTokenId?: string
  membros: MembroDoBandoParaJogador[]
}

export interface MembroDoBandoParaJogador {
  tokenId: string
  /** O nome do token como a tela dele o mostra. */
  nome: string
  /** SÓ do lado do dono ("eu" ou "aliado"): a vida do invocado, como a de um aliado. Nunca ao lado oposto. */
  vida?: VidaNaCarta
}

/**
 * F3: um selo como sai na carta. `turnos` null = até o mestre tirar.
 * Tipos de habilidade F2: os mods (só deltas, nunca o número da ficha) e a
 * natureza (cor da pílula; ausente = condição).
 */
export interface SeloParaJogador {
  nome: string
  turnos: number | null
  mods?: ModDoSelo[]
  natureza?: NaturezaDoSelo
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
  /** F2: só com `minhaVez`. */
  acoes?: AcoesParaJogador
  /** F2: um por personagem DELE com carta na ordem. */
  meus?: CombateParaJogador[]
  /** F2: golpes pendentes cujo alvo é ficha DELE. */
  reacoes?: ReacaoParaJogador[]
  /** F2: golpes pendentes com atacante E alvos no recorte dele. */
  golpes?: GolpeParaJogador[]
  /** F2 (Q6): contra-ataques ganhos por ficha dele e ainda não usados. */
  contras?: ContraParaJogador[]
  /** F3 (fatia J): onde o Judge está, só `{ x, y }` (a direção cada tela calcula). Sempre que a batalha tem Judge. */
  judge?: JudgeNaCena
  /**
   * F3: tokenId → a imagem da forma (`midia:<id>` ou a embutida) que vence a
   * foto do token e o retrato. Só fichas com carta no recorte dele, só forma
   * com imagem escolhida e cartão ainda ligado.
   */
  aparencias?: Record<string, string>
  /**
   * C8/C9: tokenId → o retrato (só `midia:<id>`, uma referência curta) da
   * ficha de JOGADOR cuja carta sai, para a foto no círculo das faixas quando
   * o token não tem foto (decisão do usuário 01/11: todo jogador vê a foto do
   * colega). Nunca de NPC.
   */
  retratos?: Record<string, string>
}

/** "Simples 0/1 · Bônus 0/0 · Mov 2/4": a mesma forma de `acoesDaVez`. */
export type AcoesParaJogador = AcoesDaVez

export interface CombateParaJogador {
  personagemId: string
  /** cartaoId → turnos que faltam. */
  recargas: Record<string, number>
  /** cartaoId → vezes usadas nesta batalha. */
  usos: Record<string, number>
  overload: boolean
  carga: number
  /** Já concentrou na vez de agora. */
  concentrouNestaVez: boolean
  /** As armas levadas; `null` = ainda não escolheu. */
  armas: string[] | null
  /** A escolha "Armas por batalha"; `null` = sem limite. */
  limiteDeArmas: number | null
  /** Tipos de habilidade F3: os lembretes de passiva esperando ESTE dono ("Ativar / Agora não", "Aplicar / pular"). Ausente = nenhum. */
  lembretes?: LembreteDaPassiva[]
  /** Tipos de habilidade F3: as chaves de gatilho que já lembraram. Ausente = nenhuma. */
  lembradas?: string[]
  /** Tipos de habilidade F3: os cartaoIds das passivas ligadas (o "Ativa" da tira; o selo na carta não leva o cartaoId). Ausente = nenhuma. */
  passivasAtivas?: string[]
  /** Tipos de habilidade F4: os cartaoIds base que evoluíram nesta batalha (o menu apaga e libera por eles). Ausente = nenhum. */
  evoluidas?: string[]
  /**
   * Invocação F3: os invocados DESTE dono, esperando o mestre colocar (`posto` false) ou já no mapa. Só do
   * personagem dele: o nome e a opção, nunca números (o HP do invocado vai no bando, só do lado do dono).
   * A tela conta o máximo da opção e mostra "esperando o mestre colocar". Ausente = nenhum.
   */
  invocacoes?: InvocacaoDoDono[]
  /** Construtor C6: as formas dele que esperam o mestre decidir os números ("o mestre está decidindo"). Ausente = nenhuma. */
  formasEsperando?: FormaEsperandoOMestre[]
  /** R5 (lote de 01/11): gastou a reação no contador e não reage até a vez dele. Ausente = reage. */
  semReacao?: true
  /**
   * R1 (lote de 01/11): os lembretes da marca DESTE atirador ("Marcar o
   * alvo? Pagar SP · Teste · Agora não"). O custo e o teste a tela lê da
   * ficha dele (`passivaDaMarca`); responde por `batalha.marcar`. Ausente = nenhum.
   */
  marcas?: MarcaParaJogador[]
}

/** R1: um lembrete da marca como a tela do atirador o mostra. */
export interface MarcaParaJogador {
  id: string
  /** O token de quem atirou (dele). */
  tokenId: string
  alvoTokenId: string
  /** A passiva da marca (Olhar Artístico). */
  cartaoId: string
}

/** Invocação F3: um invocado do dono, como a tela dele o mostra. */
/** C6: uma forma pedida esperando o mestre, como o dono a vê (sem números). */
export interface FormaEsperandoOMestre {
  /** O id da pendência (`decisao_<uuid>`). */
  id: string
  cartaoId: string
  /** O nome da forma ("Sulong"). */
  nome: string
}

export interface InvocacaoDoDono {
  /** O id da pendência (`invocacao_<uuid>`) ou o tokenId do invocado posto. */
  id: string
  cartaoId: string
  /** A chave da opção (`lerInvocacao`), para contar o máximo dela. */
  opcao: string
  /** O nome no mapa ("Lobo"). */
  nome: string
  /** O nome da opção na ficha ("LOBOS COMUNS"). */
  rotulo: string
  posto: boolean
}

/** Invocação F3: teto da lista do dono (as pendências da mesa + um bando cheio). */
export const INVOCACOES_DO_DONO_MAX = INVOCACOES_PENDENTES_MAX + MEMBROS_DO_BANDO_MAX

export interface ReacaoParaJogador {
  golpeId: string
  /** A ficha DELE que reage. */
  tokenId: string
  /** O nome de quem ataca, como a tela dele o mostra (ou `ATACANTE_FORA_DA_VISTA`). */
  atacante: string
  /** O nome do golpe. */
  nome: string
  /** O dano que chega nele; `null` = golpe sem dano. */
  dano: number | null
  /** Q4: o dano vai direto ao HP. */
  perfurante?: true
  /** Só com `perfurante`, quando é parcial: quanto do dano vai direto ao HP (1 a 99). */
  perfuracao?: number
  /** Conserto das fichas F1: golpe Overload (o d20 não defende; só outra Overload). Ausente = golpe comum. */
  overload?: true
  /** F2 (revisão da fatia E): golpe Surpresa que espera a técnica que vale contra ela (o d20 não defende). Ausente = golpe comum. */
  surpresa?: true
  rolagem?: RolagemDaReacao
  /**
   * F2 (fatia B, o "perto" do Aplauso): a ficha DELE que pode rebater no
   * lugar do alvo `tokenId` (que pode ser de outro). Ausente = a ficha que
   * reage é o próprio alvo.
   */
  por?: string
}

export interface AlvoParaJogador {
  tokenId: string
  d20?: number
  total?: number
  saida?: SaidaDaReacao
}

export interface GolpeParaJogador {
  golpeId: string
  atacanteTokenId: string
  nome: string
  alvos: AlvoParaJogador[]
  /** Tipos de habilidade F4: o rótulo da opção escolhida ("Cirugia"), até `NOME_DO_GOLPE_MAX`. Ausente = sem escolha. */
  variante?: string
}

export interface ContraParaJogador {
  golpeId: string
  /** A ficha DELE que ganhou a ação. */
  tokenId: string
  /** Quem a atacou, se a tela dele tem a ficha; `null` = fora da vista. */
  atacanteTokenId: string | null
}

/** O efeito como o jogador o recebe: só com fichas que a tela dele tem. */
export type EfeitoParaJogador = EfeitoDaBatalha

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
/** Personagens dele em `meus` (uma mesa não chega perto). */
export const MEUS_NO_COMBATE_MAX = 16
/** Técnicas em `recargas` e em `usos` de um personagem. */
export const CARTOES_NO_COMBATE_MAX = 200
/** O atacante que a tela dele não tem. */
export const ATACANTE_FORA_DA_VISTA = 'Alguém fora da sua vista'
/** F3: imagens de forma em `aparencias` (uma por ficha com carta no recorte). */
export const APARENCIAS_MAX = CARTAS_PARA_JOGADOR_MAX

function ladoDa(carta: CartaDaOrdem, ctx: ContextoDoJogador): LadoNaCarta {
  if (ctx.meusTokens.has(carta.tokenId)) return 'eu'
  if (carta.personagemId === null) return 'outro'
  if (ctx.meusPersonagens.has(carta.personagemId)) return 'eu'
  return ctx.aliados.has(carta.personagemId) ? 'aliado' : 'outro'
}

function personagemDaCarta(carta: CartaDaOrdem, ctx: ContextoDoJogador): Personagem | undefined {
  return carta.personagemId === null ? undefined : ctx.personagens.find((candidato) => candidato.id === carta.personagemId)
}

/** F3: a forma (nome) e os selos que a carta mostra a quem a vê (Q5: também de NPC). Nada de número da ficha (os mods são deltas). */
function formaESelosDaCarta(saida: CartaParaJogador, carta: CartaDaOrdem, turnos: TurnosDaCena, ctx: ContextoDoJogador): void {
  if (carta.personagemId !== null) {
    const forma = nomeDaFormaLigada(turnos.formas?.[carta.personagemId], personagemDaCarta(carta, ctx))
    const noTeto = forma?.slice(0, NOME_DA_FORMA_MAX) ?? ''
    // Cartão sem nome não sai: o fio recusa forma vazia e derrubaria o estado inteiro.
    if (noTeto.length > 0) saida.forma = noTeto
  }
  const selos = selosDoToken(turnos.selos, carta.tokenId)
    // R4: o "Ajustar..." do mestre num NPC (modificador de atributo) não sai a quem não é da ficha.
    .filter((selo) => selo.ajuste !== true || saida.lado !== 'outro')
    .map(seloNaCarta)
    // Nome torto (vazio, quebra de linha) fica de fora pelo mesmo motivo.
    .filter((selo) => ehNomeDeSelo(selo.nome))
    .slice(0, SELOS_POR_TOKEN_MAX)
  if (selos.length > 0) saida.selos = selos
}

/**
 * Um selo como a carta o mostra. Tipos de habilidade F2: os mods vão (são
 * deltas, nunca o número da ficha, também de NPC), nos tetos do fio; a
 * natureza vai fora "condicao" (a ausência). O cartaoId e a origem, não.
 */
function seloNaCarta(selo: SeloDaBatalha): SeloParaJogador {
  const saida: SeloParaJogador = { nome: selo.nome.slice(0, NOME_DO_SELO_MAX), turnos: selo.turnos === null ? null : Math.max(0, Math.min(TURNOS_DO_SELO_MAX, Math.round(selo.turnos))) }
  const mods = (selo.mods ?? [])
    .filter((mod) => ehAlvoDeMod(mod.alvo) && Number.isInteger(mod.delta) && mod.delta !== 0 && Math.abs(mod.delta) <= DANO_MAX)
    .slice(0, MODS_POR_SELO_MAX)
    .map((mod) => ({ alvo: mod.alvo, delta: mod.delta }))
  if (mods.length > 0) saida.mods = mods
  if (selo.natureza !== undefined && selo.natureza !== 'condicao') saida.natureza = selo.natureza
  return saida
}

/**
 * Tipos de habilidade F2: os selos do recorte na forma que `bonusDaBatalha`
 * lê, um token só uma vez (a carta extra repete os selos da ficha). Na tela do
 * jogador: `bonusDaBatalha(selosParaOBonus(estado.cartas), tokenId)`.
 */
export function selosParaOBonus(cartas: readonly Pick<CartaParaJogador, 'tokenId' | 'selos'>[]): SeloQueSoma[] {
  const vistos = new Set<string>()
  const selos: SeloQueSoma[] = []
  for (const carta of cartas) {
    if (vistos.has(carta.tokenId)) continue
    vistos.add(carta.tokenId)
    for (const selo of carta.selos ?? []) selos.push(selo.mods === undefined ? { tokenId: carta.tokenId, nome: selo.nome } : { tokenId: carta.tokenId, nome: selo.nome, mods: selo.mods })
  }
  return selos
}

/**
 * Unificação do combate (10/11/2026): os lados NA LUTA das cartas que saem
 * para uma conexão. O id do lado (o da equipe, o do tipo) não sai: cada lado
 * vira um número na ordem em que aparece entre as cartas que ele vê, então o
 * número não conta nada das que ele não vê.
 */
interface LadosNoRecorte {
  /** O número do lado do personagem; `undefined` = sem lado (ninguém é aliado dele). */
  numeroDe: (personagemId: string | null) => number | undefined
  /** O personagem luta do lado de algum personagem DELE de verdade (nunca conta a ficha emprestada). */
  doMeuLado: (personagemId: string | null) => boolean
}

function ladosNoRecorte(turnos: TurnosDaCena, ctx: ContextoDoJogador): LadosNoRecorte {
  const mesa: LadosDaBatalha = { equipes: ctx.equipes, personagens: ctx.personagens, invocados: turnos.invocados ?? [] }
  const meus = new Set<string>()
  for (const personagemId of ctx.meusPersonagens) {
    const lado = ladoNaBatalha(personagemId, mesa)
    if (lado !== null) meus.add(lado)
  }
  const numeros = new Map<string, number>()
  return {
    numeroDe: (personagemId) => {
      const lado = ladoNaBatalha(personagemId, mesa)
      if (lado === null) return undefined
      const jaTem = numeros.get(lado)
      if (jaTem !== undefined) return jaTem
      const novo = numeros.size + 1
      numeros.set(lado, novo)
      return novo
    },
    doMeuLado: (personagemId) => {
      const lado = ladoNaBatalha(personagemId, mesa)
      return lado !== null && meus.has(lado)
    },
  }
}

/**
 * Unificação do combate (10/11/2026): a vida do NPC que luta do lado dele,
 * na carta "outro" (a de "eu" e a de "aliado" ele lê da ficha que já tem).
 * Só NPC: o jogador de outra equipe segue sem vida exposta. `null` = não sai.
 */
function vidaDoNpcDoMeuLado(carta: CartaDaOrdem, ctx: ContextoDoJogador, lados: LadosNoRecorte): VidaNaCarta | null {
  const personagem = personagemDaCarta(carta, ctx)
  const recurso = recursoDeVida(ctx.sistema)
  if (personagem === undefined || personagem.tipo !== 'npc' || recurso === null || !lados.doMeuLado(personagem.id)) return null
  const vida = vidaDoPersonagem(personagem, recurso)
  return vida === null ? null : { atual: vidaNoFio(vida.atual), maximo: Math.max(1, vidaNoFio(vida.maximo)) }
}

function cartaParaJogador(carta: CartaDaOrdem, nome: string, ctx: ContextoDoJogador, caidos: ReadonlySet<string>, turnos: TurnosDaCena, registro: readonly LinhaDoRegistro[], lados: LadosNoRecorte): CartaParaJogador {
  const lado = ladoDa(carta, ctx)
  const saida: CartaParaJogador = { id: carta.id, tokenId: carta.tokenId, nome: nome.slice(0, NOME_NA_CARTA_MAX), lado }
  const ladoNaLuta = lados.numeroDe(carta.personagemId)
  if (ladoNaLuta !== undefined) saida.ladoNaLuta = ladoNaLuta
  // U1: a equipe como a regra a lê (`equipesNaLeitura`): o jogador criado depois da equipe automática conta
  // como dela, senão a carta dele saía sem equipe e a mira o punha do outro lado do NPC aliado (o Tree).
  const equipe = carta.personagemId === null || ctx.equipes === undefined ? null : equipeDe(carta.personagemId, equipesNaLeitura(ctx.equipes, ctx.personagens))
  // Cor e nome passam de novo pelos tetos: a equipe pode ter vindo da tela do mestre sem passar pelo arquivo.
  if (equipe !== null) saida.equipe = { nome: equipe.nome.trim().slice(0, NOME_DA_EQUIPE_MAX) || NOME_DA_EQUIPE_PADRAO, cor: corDaEquipe(equipe.cor) }
  if (carta.extra !== undefined) saida.extra = carta.extra.duracao
  if (lado !== 'outro') {
    if (carta.personagemId !== null) saida.personagemId = carta.personagemId
    if (caidos.has(carta.tokenId)) saida.caiu = true
    const escudo = escudoDaCarta(carta, ctx)
    if (escudo > 0) {
      saida.escudo = escudo
      const cheio = cheioDoEscudo(carta, ctx, registro)
      if (cheio > escudo) saida.escudoMax = cheio
    }
  } else {
    // O "caiu" não sai na carta "outro" (a página antiga recusa o estado inteiro): a mira lê a queda na vida em 0.
    const vida = vidaDoNpcDoMeuLado(carta, ctx, lados)
    if (vida !== null) saida.vida = vida
  }
  formaESelosDaCarta(saida, carta, turnos, ctx)
  return saida
}

/** C10: o Escudo atual da ficha da carta, no teto do fio; sem ficha ou sem Escudo no sistema, 0. Só para "eu" e "aliado". */
function escudoDaCarta(carta: CartaDaOrdem, ctx: ContextoDoJogador): number {
  const personagem = personagemDaCarta(carta, ctx)
  const escudo = ctx.sistema === null ? null : recursoDoEscudo(ctx.sistema)
  if (personagem === undefined || escudo === null) return 0
  return Math.max(0, Math.min(DANO_MAX, Math.round(numeroDaFicha(personagem.recursos, escudo.id))))
}

/** C10: o cheio da barra do Escudo (o maior na batalha, `escudoMaisAlto`), no teto do fio; 0 = nenhuma linha mexeu nele. */
function cheioDoEscudo(carta: CartaDaOrdem, ctx: ContextoDoJogador, registro: readonly LinhaDoRegistro[]): number {
  const escudo = ctx.sistema === null ? null : recursoDoEscudo(ctx.sistema)
  if (carta.personagemId === null || escudo === null) return 0
  return Math.max(0, Math.min(DANO_MAX, Math.round(escudoMaisAlto(registro, carta.personagemId, escudo.id))))
}

/** Teto da vida de um invocado no fio (o mesmo do dano). */
const VIDA_DO_INVOCADO_MAX = DANO_MAX
/** O nome da carta do bando quando a tela dele não tem o dono. */
export const NOME_DO_BANDO_FORA_DA_VISTA = 'Bando'
/** O começo do id da carta do bando cujo dono a tela dele não tem: `bando_fora_1`, `bando_fora_2` (nunca o tokenId do dono). */
const PREFIXO_DO_BANDO_FORA_DA_VISTA = 'bando_fora_'

/**
 * O lado do bando: o da ficha do dono que é DELE de verdade (`meusPersonagens`)
 * ou de aliado. O atalho de `meusTokens` do `ladoDa` não vale aqui: o NPC
 * emprestado (ownership) mostraria a vida dos invocados do NPC.
 */
function ladoDoDono(donoPersonagemId: string | null, ctx: ContextoDoJogador): LadoNaCarta {
  if (donoPersonagemId === null) return 'outro'
  if (ctx.meusPersonagens.has(donoPersonagemId)) return 'eu'
  return ctx.aliados.has(donoPersonagemId) ? 'aliado' : 'outro'
}

/**
 * Invocação: a carta do bando para esta conexão, ou `null` (a tela dele não
 * tem o dono nem nenhum invocado). O lado é o do DONO; a vida de cada
 * invocado sai só com o lado "eu" ou "aliado" (decisão 7). O nome usa o nome
 * do dono na tela dele, nunca o de trabalho do mestre. Dono fora da vista:
 * o id (e o tokenId) da carta é `idForaDaVista`, não o `bando_<tokenId do dono>`.
 */
function bandoParaJogador(carta: CartaDaOrdem, turnos: TurnosDaCena, ctx: ContextoDoJogador, idForaDaVista: () => string, lados: LadosNoRecorte): CartaParaJogador | null {
  const { bando } = carta
  if (bando === undefined) return null
  const todos = (turnos.invocados ?? []).filter((invocado) => invocado.donoTokenId === bando.donoTokenId)
  const nomeDoDono = ctx.tokensNoRecorte.get(bando.donoTokenId)
  const vistos = todos.filter((invocado) => ctx.tokensNoRecorte.has(invocado.tokenId)).slice(0, MEMBROS_DO_BANDO_MAX)
  if (nomeDoDono === undefined && vistos.length === 0) return null
  const donoPersonagemId = todos[0]?.donoPersonagemId ?? turnos.cartas.find((candidata) => candidata.tokenId === bando.donoTokenId)?.personagemId ?? null
  const lado = ladoDoDono(donoPersonagemId, ctx)
  const recurso = recursoDeVida(ctx.sistema)
  const membros = vistos.map((invocado): MembroDoBandoParaJogador => {
    const membro: MembroDoBandoParaJogador = { tokenId: invocado.tokenId, nome: (ctx.tokensNoRecorte.get(invocado.tokenId) ?? invocado.nome).slice(0, NOME_NA_CARTA_MAX) }
    const personagem = ctx.personagens.find((candidato) => candidato.id === invocado.personagemId)
    const vida = lado === 'outro' || recurso === null || personagem === undefined ? null : vidaDoPersonagem(personagem, recurso)
    if (vida !== null) membro.vida = { atual: vidaNoFio(vida.atual), maximo: Math.max(1, vidaNoFio(vida.maximo)) }
    return membro
  })
  // O bando luta do lado do dono (`ladoNaBatalha` lê o invocado pelo dono).
  const ladoNaLuta = lados.numeroDe(donoPersonagemId)
  const daLuta = ladoNaLuta === undefined ? {} : { ladoNaLuta }
  if (nomeDoDono === undefined) {
    const id = idForaDaVista()
    return { id, tokenId: id, nome: NOME_DO_BANDO_FORA_DA_VISTA, lado, bando: { membros }, ...daLuta }
  }
  return { id: carta.id, tokenId: carta.tokenId, nome: `Bando de ${nomeDoDono}`.slice(0, NOME_NA_CARTA_MAX), lado, bando: { donoTokenId: bando.donoTokenId, membros }, ...daLuta }
}

/** Inteiro de 0 ao teto (o fio recusa fração). */
function vidaNoFio(valor: number): number {
  return Number.isFinite(valor) ? Math.max(0, Math.min(VIDA_DO_INVOCADO_MAX, Math.round(valor))) : 0
}

/** F3: as imagens de forma das fichas cujas cartas saem (uma por token). Só referência de mídia ou a embutida. */
function aparenciasParaJogador(cartas: readonly CartaDaOrdem[], turnos: TurnosDaCena, ctx: ContextoDoJogador): Record<string, string> {
  const aparencias: Record<string, string> = {}
  if (turnos.formas === undefined) return aparencias
  const vistos = new Set<string>()
  for (const carta of cartas) {
    if (vistos.size >= APARENCIAS_MAX) break
    if (carta.personagemId === null || vistos.has(carta.tokenId)) continue
    const imagem = aparenciaDaForma(turnos.formas[carta.personagemId], personagemDaCarta(carta, ctx))
    if (imagem === null || !ehImagemDaMesa(imagem)) continue
    aparencias[carta.tokenId] = imagem
    vistos.add(carta.tokenId)
  }
  return aparencias
}

/** C8/C9: os retratos das fichas de JOGADOR cujas cartas saem (um por token), só referência de mídia; NPC nunca. */
function retratosParaJogador(cartas: readonly CartaDaOrdem[], ctx: ContextoDoJogador): Record<string, string> {
  const retratos: Record<string, string> = {}
  let vistos = 0
  for (const carta of cartas) {
    if (vistos >= APARENCIAS_MAX) break
    if (Object.hasOwn(retratos, carta.tokenId)) continue
    const personagem = personagemDaCarta(carta, ctx)
    if (personagem?.tipo !== 'jogador' || !ehRefDeMidia(personagem.retrato)) continue
    retratos[carta.tokenId] = personagem.retrato
    vistos += 1
  }
  return retratos
}

/** A ficha é DELE: o token é dele, ou o personagem ligado é dele. */
function fichaMinha(tokenId: string, personagemId: string | null, ctx: ContextoDoJogador): boolean {
  return ctx.meusTokens.has(tokenId) || (personagemId !== null && ctx.meusPersonagens.has(personagemId))
}

/** Um mapa cartaoId → número no teto do fio. */
function mapaNoTeto(mapa: Readonly<Record<string, number>>): Record<string, number> {
  const saida: Record<string, number> = {}
  for (const [chave, valor] of Object.entries(mapa).slice(0, CARTOES_NO_COMBATE_MAX)) saida[chave] = valor
  return saida
}

/** As ações da carta da vez, quando ela é dele. */
function acoesParaJogador(cena: BatalhaEmTurnos, daVez: CartaDaOrdem, ctx: ContextoDoJogador): AcoesParaJogador {
  const { turnos } = cena
  const personagem = daVez.personagemId === null ? undefined : ctx.personagens.find((candidato) => candidato.id === daVez.personagemId)
  const rank = personagem === undefined || ctx.sistema === null ? null : rankDeAgilidade(personagem, ctx.sistema)
  // R6: o mesmo deslocamento e o mesmo ataque adicional das formas que a store usa (`acoesDaCarta`).
  const combate = daVez.personagemId === null ? undefined : turnos.combate?.[daVez.personagemId]
  const forma = personagem === undefined || ctx.sistema === null ? undefined : formaNaVez(personagem, ctx.sistema, combate, turnos.rodada)
  return acoesDaVez(turnos.gastos[daVez.id], turnos.extras[daVez.id], rank, cena.regras?.blocosPorRank ?? BLOCOS_POR_RANK_PADRAO, forma)
}

/** Ficha que o host não achou: nada oculto a tirar. */
const SEM_OCULTOS: ReadonlySet<string> = new Set()

/** O combate dos personagens DELE com carta na ordem, na ordem das cartas. */
function meusNoCombate(cena: BatalhaEmTurnos, ctx: ContextoDoJogador): CombateParaJogador[] {
  const { turnos } = cena
  const daVez = cartaDaVez(turnos)
  const vistos = new Set<string>()
  const meus: CombateParaJogador[] = []
  for (const carta of turnos.cartas) {
    if (meus.length >= MEUS_NO_COMBATE_MAX) break
    const { personagemId } = carta
    if (personagemId === null || vistos.has(personagemId) || !fichaMinha(carta.tokenId, personagemId, ctx)) continue
    vistos.add(personagemId)
    const combate = turnos.combate?.[personagemId] ?? combateVazio()
    const personagem = ctx.personagens.find((candidato) => candidato.id === personagemId)
    const meu: CombateParaJogador = {
      personagemId,
      recargas: mapaNoTeto(combate.recargas),
      usos: mapaNoTeto(combate.usos),
      overload: combate.overload,
      carga: combate.carga,
      concentrouNestaVez: daVez !== null && combate.concentrouEm === chaveDaVez(turnos.rodada, daVez.id),
      armas: combate.armas === null ? null : [...combate.armas],
      limiteDeArmas: personagem === undefined ? null : limiteDeArmas(personagem),
    }
    // Passivas e evoluções só do personagem DELE: o token de NPC que ele controla entra em `meus`, mas o lembrete
    // "vida abaixo de 50%" contaria a vida do NPC.
    if (combate.semReacao === true) meu.semReacao = true
    // Fatia C7 (revisão): o cartão oculto é só do mestre; o id dele não vai ao jogador em lembrete, passiva ligada,
    // evolução nem marca (com o id, o "Aplicar" do lembrete viraria um pedido que o host executaria).
    const ocultos = personagem === undefined ? SEM_OCULTOS : idsOcultos(personagem)
    const visivel = (cartaoId: string): boolean => !ocultos.has(cartaoId)
    // R1: os lembretes da marca do personagem DELE, de token dele (o SP e o teste são do personagem dele).
    const marcas = (turnos.lembretesDaMarca ?? [])
      .filter((lembrete) => lembrete.personagemId === personagemId && ctx.meusPersonagens.has(personagemId) && ctx.meusTokens.has(lembrete.tokenId) && visivel(lembrete.cartaoId))
      .slice(-LEMBRETES_DA_MARCA_MAX)
      .map((lembrete) => ({ id: lembrete.id, tokenId: lembrete.tokenId, alvoTokenId: lembrete.alvoTokenId, cartaoId: lembrete.cartaoId }))
    if (marcas.length > 0) meu.marcas = marcas
    meus.push(ctx.meusPersonagens.has(personagemId) ? comFormasEsperando(comInvocacoesDoDono(comPassivasDoDono(meu, combate, [...passivasLigadas(turnos.selos, personagemId)], visivel), turnos, personagemId), turnos, personagemId) : meu)
  }
  return meus
}

/**
 * Tipos de habilidade F3: os lembretes, as chaves lembradas e as passivas
 * ligadas do personagem DELE (nunca as do NPC cujo token ele controla). F4:
 * e as técnicas evoluídas. Nos tetos do fio; campo vazio não sai (o JSON de
 * quem não tem passiva nem evolução fica igual byte a byte).
 */
function comPassivasDoDono(meu: CombateParaJogador, combate: CombateDoPersonagem, ativas: readonly string[], visivel: (cartaoId: string) => boolean): CombateParaJogador {
  // `visivel` (fatia C7): o cartão oculto não sai, nem só o id.
  const cabe = (cartaoId: string): boolean => cartaoId.length >= 1 && cartaoId.length <= ID_DO_CARTAO_MAX && visivel(cartaoId)
  const lembretes = (combate.lembretes ?? [])
    .filter((lembrete) => cabe(lembrete.cartaoId) && lembrete.chave.length >= 1 && lembrete.chave.length <= CHAVE_DA_LEMBRADA_MAX && lembrete.rodada >= 1)
    .slice(0, LEMBRETES_MAX)
    .map((lembrete): LembreteDaPassiva => ({ cartaoId: lembrete.cartaoId, tokenId: lembrete.tokenId, tipo: lembrete.tipo, chave: lembrete.chave, rodada: lembrete.rodada }))
  const lembradas = (combate.lembradas ?? []).filter((chave) => chave.length >= 1 && chave.length <= CHAVE_DA_LEMBRADA_MAX).slice(-LEMBRADAS_MAX)
  const passivasAtivas = ativas.filter(cabe).slice(0, PASSIVAS_ATIVAS_MAX)
  // Tipos de habilidade F4: as técnicas evoluídas nesta batalha (só ids; o menu apaga e libera por elas).
  const evoluidas = (combate.evoluidas ?? []).filter(cabe).slice(-EVOLUIDAS_MAX)
  if (lembretes.length > 0) meu.lembretes = lembretes
  if (lembradas.length > 0) meu.lembradas = lembradas
  if (passivasAtivas.length > 0) meu.passivasAtivas = passivasAtivas
  if (evoluidas.length > 0) meu.evoluidas = evoluidas
  return meu
}

/**
 * Construtor C6: as formas DESTE dono esperando o mestre decidir os números
 * (só o nome; os números chegam quando ela liga). Nenhuma = campo ausente.
 */
function comFormasEsperando(meu: CombateParaJogador, turnos: TurnosDaCena, personagemId: string): CombateParaJogador {
  const lista = (turnos.formasPendentes ?? [])
    .filter((pendente) => pendente.personagemId === personagemId && pendente.cartaoId.length >= 1 && pendente.cartaoId.length <= ID_DO_CARTAO_MAX)
    .map((pendente): FormaEsperandoOMestre => ({ id: pendente.id, cartaoId: pendente.cartaoId, nome: pendente.nome.slice(0, NOME_DA_FORMA_MAX) }))
  if (lista.length > 0) meu.formasEsperando = lista.slice(0, FORMAS_PENDENTES_MAX)
  return meu
}

/**
 * Invocação F3: as pendências e os invocados postos do personagem DELE (nome,
 * rótulo e a opção; nada de números). No teto do fio; nenhum = campo ausente.
 */
function comInvocacoesDoDono(meu: CombateParaJogador, turnos: TurnosDaCena, personagemId: string): CombateParaJogador {
  const cabe = (de: { cartaoId: string; opcao: string; rotulo: string }): boolean =>
    de.cartaoId.length >= 1 && de.cartaoId.length <= ID_DO_CARTAO_MAX && de.opcao.length >= 1 && de.opcao.length <= NOME_DO_GOLPE_MAX && de.rotulo.length <= NOME_DO_GOLPE_MAX
  const nomeNoTeto = (nome: string): string => nome.slice(0, NOME_DO_INVOCADO_MAX)
  const lista: InvocacaoDoDono[] = []
  for (const pendente of turnos.invocacoes ?? []) {
    if (pendente.donoPersonagemId !== personagemId || !cabe(pendente)) continue
    lista.push({ id: pendente.id, cartaoId: pendente.cartaoId, opcao: pendente.opcao, nome: nomeNoTeto(pendente.nome), rotulo: pendente.rotulo, posto: false })
  }
  for (const invocado of turnos.invocados ?? []) {
    if (invocado.donoPersonagemId !== personagemId || !cabe({ ...invocado, rotulo: '' })) continue
    lista.push({ id: invocado.tokenId, cartaoId: invocado.cartaoId, opcao: invocado.opcao, nome: nomeNoTeto(invocado.nome), rotulo: '', posto: true })
  }
  if (lista.length > 0) meu.invocacoes = lista.slice(0, INVOCACOES_DO_DONO_MAX)
  return meu
}

function nomeDoGolpe(golpe: GolpeDaBatalha): string {
  return golpe.nome.slice(0, NOME_DO_GOLPE_MAX)
}

/**
 * Os golpes esperando a reação de ficha DELE: uma caixa REAÇÃO por alvo. F2
 * (fatia B): e uma por alvo que a ficha dele pode rebater de perto
 * (`porPerto`, o Aplauso), com `por`.
 */
function reacoesParaJogador(golpes: readonly GolpeDaBatalha[], ctx: ContextoDoJogador, personagemDoToken: (tokenId: string) => string | null): ReacaoParaJogador[] {
  const reacoes: ReacaoParaJogador[] = []
  for (const golpe of golpes) {
    for (const alvo of golpe.alvos) {
      if (alvo.danoFinal !== undefined || !alvo.podeReagir) continue
      const quem = fichaMinha(alvo.tokenId, alvo.personagemId, ctx) ? [undefined] : []
      const dePerto = (alvo.porPerto ?? []).filter((tokenId) => fichaMinha(tokenId, personagemDoToken(tokenId), ctx))
      for (const por of [...quem, ...dePerto]) {
        if (reacoes.length >= GOLPES_PENDENTES_MAX) return reacoes
        const reacao: ReacaoParaJogador = {
          golpeId: golpe.id,
          tokenId: alvo.tokenId,
          atacante: (ctx.tokensNoRecorte.get(golpe.atacanteTokenId) ?? ATACANTE_FORA_DA_VISTA).slice(0, NOME_NA_CARTA_MAX),
          nome: nomeDoGolpe(golpe),
          dano: alvo.dano,
        }
        if (golpe.perfurante) reacao.perfurante = true
        if (golpe.perfurante && golpe.perfuracao !== undefined) reacao.perfuracao = golpe.perfuracao
        if (golpe.overload) reacao.overload = true
        if (golpe.surpresa) reacao.surpresa = true
        if (alvo.rolagem !== undefined) reacao.rolagem = { ...alvo.rolagem }
        if (por !== undefined) reacao.por = por
        reacoes.push(reacao)
      }
    }
  }
  return reacoes
}

/** Os golpes pendentes que a tela dele mostra inteiros: atacante e TODOS os alvos no recorte. Sem números de vida nem dano. */
function golpesParaJogador(golpes: readonly GolpeDaBatalha[], ctx: ContextoDoJogador): GolpeParaJogador[] {
  const saem: GolpeParaJogador[] = []
  for (const golpe of golpes) {
    if (saem.length >= GOLPES_PENDENTES_MAX) break
    if (!ctx.tokensNoRecorte.has(golpe.atacanteTokenId) || !golpe.alvos.every((alvo) => ctx.tokensNoRecorte.has(alvo.tokenId))) continue
    const golpeVisto: GolpeParaJogador = {
      golpeId: golpe.id,
      atacanteTokenId: golpe.atacanteTokenId,
      nome: nomeDoGolpe(golpe),
      alvos: golpe.alvos.map((alvo) => {
        const visto: AlvoParaJogador = { tokenId: alvo.tokenId }
        if (alvo.rolagem !== undefined) {
          visto.d20 = alvo.rolagem.d20
          visto.total = alvo.rolagem.total
        }
        if (alvo.saida !== undefined) visto.saida = alvo.saida
        return visto
      }),
    }
    // Tipos de habilidade F4: só o rótulo da opção (o nome da técnica já vai); nada da ficha além dele.
    const variante = golpe.variante?.trim().slice(0, NOME_DO_GOLPE_MAX)
    if (variante !== undefined && variante !== '') golpeVisto.variante = variante
    saem.push(golpeVisto)
  }
  return saem
}

/** Os contra-ataques (Q6) ganhos por ficha DELE. */
function contrasParaJogador(cena: BatalhaEmTurnos, ctx: ContextoDoJogador): ContraParaJogador[] {
  const saem: ContraParaJogador[] = []
  for (const contra of cena.turnos.contras ?? []) {
    if (saem.length >= GOLPES_PENDENTES_MAX) break
    if (!fichaMinha(contra.tokenId, contra.personagemId, ctx)) continue
    saem.push({ golpeId: contra.golpeId, tokenId: contra.tokenId, atacanteTokenId: ctx.tokensNoRecorte.has(contra.atacanteTokenId) ? contra.atacanteTokenId : null })
  }
  return saem
}

/**
 * Os efeitos novos (`seq` > `depoisDoSeq`) que a tela dele pode tocar, os
 * `EFEITOS_POR_MENSAGEM` mais novos, do mais velho ao mais novo. Golpe: o
 * atacante tem de estar na tela e os alvos fora dela saem; sem alvo visível,
 * o efeito inteiro sai (o corte diria que há alguém escondido). O número do
 * dano vai a quem vê a ficha (Q5). O gesto do Judge (F3) não tem ficha: vai
 * a todos, só com o tipo e o gesto.
 *
 * F3 (fatia T): "transformacao", "forma" e "selo" só com a ficha no recorte,
 * campo a campo. Os `numeros` da forma saem SÓ se o token está em
 * `numerosVisiveis` (fichas dele e dos aliados: a mesma regra da vida);
 * ausente = nenhum número sai (NPC nunca entra no conjunto).
 */
export function efeitosParaJogador(
  efeitos: readonly EfeitoDaBatalha[],
  depoisDoSeq: number,
  tokensNoRecorte: ReadonlySet<string>,
  numerosVisiveis?: ReadonlySet<string>,
): EfeitoParaJogador[] {
  const saem: EfeitoParaJogador[] = []
  for (const efeito of efeitos) {
    if (efeito.seq <= depoisDoSeq) continue
    if (efeito.tipo === 'judge') {
      saem.push({ seq: efeito.seq, tipo: 'judge', gesto: efeito.gesto })
      continue
    }
    if (efeito.tipo === 'transformacao') {
      if (tokensNoRecorte.has(efeito.tokenId)) saem.push(transformacaoParaJogador(efeito, numerosVisiveis?.has(efeito.tokenId) === true))
      continue
    }
    if (efeito.tipo === 'forma') {
      if (tokensNoRecorte.has(efeito.tokenId)) saem.push({ seq: efeito.seq, tipo: 'forma', tokenId: efeito.tokenId, forma: efeito.forma.slice(0, NOME_DA_FORMA_MAX), ligou: false })
      continue
    }
    if (efeito.tipo === 'selo') {
      const nome = efeito.nome.slice(0, NOME_DO_SELO_MAX)
      if (tokensNoRecorte.has(efeito.tokenId) && ehNomeDeSelo(nome)) saem.push({ seq: efeito.seq, tipo: 'selo', tokenId: efeito.tokenId, nome, acabou: true })
      continue
    }
    if (efeito.tipo === 'golpe') {
      const alvos = efeito.alvos.filter((tokenId) => tokensNoRecorte.has(tokenId))
      if (!tokensNoRecorte.has(efeito.atacanteTokenId) || alvos.length === 0) continue
      saem.push({ ...efeito, nome: efeito.nome.slice(0, NOME_DO_GOLPE_MAX), alvos })
      continue
    }
    if (tokensNoRecorte.has(efeito.tokenId)) saem.push({ ...efeito })
  }
  return saem.slice(-EFEITOS_POR_MENSAGEM)
}

type EfeitoDaTransformacao = Extract<EfeitoDaBatalha, { tipo: 'transformacao' }>

/** A transformação campo a campo; os números (no teto) só com `comNumeros`. */
function transformacaoParaJogador(efeito: EfeitoDaTransformacao, comNumeros: boolean): EfeitoDaTransformacao {
  const saida: EfeitoDaTransformacao = {
    seq: efeito.seq,
    tipo: 'transformacao',
    tokenId: efeito.tokenId,
    forma: efeito.forma.slice(0, NOME_DA_FORMA_MAX),
    imagem: ehImagemDaMesa(efeito.imagem) ? efeito.imagem : null,
  }
  if (comNumeros && efeito.numeros !== undefined && efeito.numeros.length > 0) {
    saida.numeros = efeito.numeros.slice(0, NUMEROS_DA_FORMA_MAX).map((numero): NumeroDaForma => {
      const visto: NumeroDaForma = { rotulo: numero.rotulo.slice(0, ROTULO_DO_NUMERO_MAX), de: numeroNoFio(numero.de), para: numeroNoFio(numero.para) }
      if (numero.nota !== undefined) visto.nota = numero.nota.slice(0, ROTULO_DO_NUMERO_MAX)
      return visto
    })
  }
  return saida
}

/** Inteiro no teto do fio (o fio recusa fração e número fora do teto, e derrubaria o efeito). Não finito = 0. */
function numeroNoFio(valor: number): number {
  if (!Number.isFinite(valor)) return 0
  return Math.max(-NUMERO_DA_FORMA_MAX, Math.min(NUMERO_DA_FORMA_MAX, Math.round(valor)))
}

export function vistaParaJogador(cena: BatalhaEmTurnos, ctx: ContextoDoJogador): EstadoParaJogador {
  const { turnos } = cena
  const caidos = tokensCaidos(turnos.cartas, ctx.personagens, ctx.sistema)
  const cartas: CartaParaJogador[] = []
  // O id real de cada carta que sai → o id com que ela sai (o do bando com o dono fora da vista é outro).
  const idNoFio = new Map<string, string>()
  let bandosForaDaVista = 0
  const idForaDaVista = (): string => {
    bandosForaDaVista += 1
    return `${PREFIXO_DO_BANDO_FORA_DA_VISTA}${bandosForaDaVista}`
  }
  const lados = ladosNoRecorte(turnos, ctx)
  for (const carta of turnos.cartas) {
    if (cartas.length >= CARTAS_PARA_JOGADOR_MAX) break
    if (carta.bando !== undefined) {
      const doBando = bandoParaJogador(carta, turnos, ctx, idForaDaVista, lados)
      if (doBando !== null) {
        cartas.push(doBando)
        idNoFio.set(carta.id, doBando.id)
      }
      continue
    }
    const nome = ctx.tokensNoRecorte.get(carta.tokenId)
    if (nome === undefined) continue
    cartas.push(cartaParaJogador(carta, nome, ctx, caidos, turnos, cena.registro, lados))
    idNoFio.set(carta.id, carta.id)
  }
  // "Visível" = o que de fato sai (no recorte E dentro do teto): turno e próxima contam o mesmo que a faixa mostra.
  const visivel = (carta: CartaDaOrdem): boolean => idNoFio.has(carta.id)
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
  const estado: EstadoParaJogador = {
    rodada: turnos.rodada,
    turno: turnoNoM(turnos, visivel),
    vez: vezVisivel ? (idNoFio.get(daVez.id) ?? null) : null,
    // A próxima é a da vez seguinte: igual à vez só quando ela é a única que joga.
    proxima: proxima !== null && proxima.id !== turnos.vez ? (idNoFio.get(proxima.id) ?? null) : null,
    minhaVez,
    vezForaDaVista: daVez !== null && !vezVisivel,
    cartas,
    registro,
    regras: cena.regras === null ? null : regrasParaOFio(cena.regras),
  }
  // F2: campo vazio não sai — o estado da F1 continua igual byte a byte (o host deduplica pelo JSON).
  if (minhaVez) estado.acoes = acoesParaJogador(cena, daVez, ctx)
  const meus = meusNoCombate(cena, ctx)
  if (meus.length > 0) estado.meus = meus
  const golpes = turnos.golpes ?? []
  const reacoes = reacoesParaJogador(golpes, ctx, (tokenId) => turnos.cartas.find((carta) => carta.tokenId === tokenId)?.personagemId ?? null)
  if (reacoes.length > 0) estado.reacoes = reacoes
  const golpesVistos = golpesParaJogador(golpes, ctx)
  if (golpesVistos.length > 0) estado.golpes = golpesVistos
  const contras = contrasParaJogador(cena, ctx)
  if (contras.length > 0) estado.contras = contras
  // F3: só x e y, campo a campo (nada mais que a cena guarde do Judge sai junto).
  if (cena.judge !== undefined) estado.judge = { x: cena.judge.x, y: cena.judge.y }
  // F3 (fatia T): as imagens de forma só das fichas cujas cartas saem.
  const aparencias = aparenciasParaJogador(turnos.cartas.filter(visivel), turnos, ctx)
  if (Object.keys(aparencias).length > 0) estado.aparencias = aparencias
  const retratos = retratosParaJogador(turnos.cartas.filter(visivel), ctx)
  if (Object.keys(retratos).length > 0) estado.retratos = retratos
  return estado
}
