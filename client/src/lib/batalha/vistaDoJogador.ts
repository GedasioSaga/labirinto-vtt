import { ehImagemDaMesa } from '../midia'
import type { Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { acoesDaVez, rankDeAgilidade, type AcoesDaVez } from './acoes'
import {
  chaveDaVez,
  combateVazio,
  DANO_MAX,
  EFEITOS_POR_MENSAGEM,
  GOLPES_PENDENTES_MAX,
  MODS_POR_SELO_MAX,
  NOME_DA_FORMA_MAX,
  NOME_DO_GOLPE_MAX,
  NOME_DO_SELO_MAX,
  NUMERO_DA_FORMA_MAX,
  NUMEROS_DA_FORMA_MAX,
  ROTULO_DO_NUMERO_MAX,
  SELOS_POR_TOKEN_MAX,
  TURNOS_DO_SELO_MAX,
  type EfeitoDaBatalha,
  type GolpeDaBatalha,
  type ModDoSelo,
  type NaturezaDoSelo,
  type NumeroDaForma,
  type RolagemDaReacao,
  type SaidaDaReacao,
  type SeloDaBatalha,
} from './combate'
import { corDaEquipe, equipeDe, NOME_DA_EQUIPE_MAX, NOME_DA_EQUIPE_PADRAO, type Equipe } from './equipes'
import type { JudgeNaCena } from './judge'
import { limiteDeArmas } from './leituraDaFicha'
import type { BatalhaEmTurnos } from './ponte'
import { registroParaJogador, type LinhaParaJogador } from './registro'
import { BLOCOS_POR_RANK_PADRAO, regrasParaOFio, type RegrasDaBatalha } from './regrasDoCampo'
import { ehAlvoDeMod, ehNomeDeSelo, selosDoToken, type SeloQueSoma } from './selos'
import { aparenciaDaForma, nomeDaFormaLigada } from './transformacao'
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
 *    já tem (o dele em `personagens`, o do aliado em `batalha.aliados`).
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
  /** F3 (Q5): os selos da ficha ("Atordoado 2"). Para todos que veem a carta, também de NPC. */
  selos?: SeloParaJogador[]
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
}

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
  rolagem?: RolagemDaReacao
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

function cartaParaJogador(carta: CartaDaOrdem, nome: string, ctx: ContextoDoJogador, caidos: ReadonlySet<string>, turnos: TurnosDaCena): CartaParaJogador {
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
  formaESelosDaCarta(saida, carta, turnos, ctx)
  return saida
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
  return acoesDaVez(turnos.gastos[daVez.id], turnos.extras[daVez.id], rank, cena.regras?.blocosPorRank ?? BLOCOS_POR_RANK_PADRAO)
}

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
    meus.push({
      personagemId,
      recargas: mapaNoTeto(combate.recargas),
      usos: mapaNoTeto(combate.usos),
      overload: combate.overload,
      carga: combate.carga,
      concentrouNestaVez: daVez !== null && combate.concentrouEm === chaveDaVez(turnos.rodada, daVez.id),
      armas: combate.armas === null ? null : [...combate.armas],
      limiteDeArmas: personagem === undefined ? null : limiteDeArmas(personagem),
    })
  }
  return meus
}

function nomeDoGolpe(golpe: GolpeDaBatalha): string {
  return golpe.nome.slice(0, NOME_DO_GOLPE_MAX)
}

/** Os golpes esperando a reação de ficha DELE: uma caixa REAÇÃO por alvo. */
function reacoesParaJogador(golpes: readonly GolpeDaBatalha[], ctx: ContextoDoJogador): ReacaoParaJogador[] {
  const reacoes: ReacaoParaJogador[] = []
  for (const golpe of golpes) {
    for (const alvo of golpe.alvos) {
      if (reacoes.length >= GOLPES_PENDENTES_MAX) return reacoes
      if (alvo.danoFinal !== undefined || !alvo.podeReagir || !fichaMinha(alvo.tokenId, alvo.personagemId, ctx)) continue
      const reacao: ReacaoParaJogador = {
        golpeId: golpe.id,
        tokenId: alvo.tokenId,
        atacante: (ctx.tokensNoRecorte.get(golpe.atacanteTokenId) ?? ATACANTE_FORA_DA_VISTA).slice(0, NOME_NA_CARTA_MAX),
        nome: nomeDoGolpe(golpe),
        dano: alvo.dano,
      }
      if (golpe.perfurante) reacao.perfurante = true
      if (golpe.perfurante && golpe.perfuracao !== undefined) reacao.perfuracao = golpe.perfuracao
      if (alvo.rolagem !== undefined) reacao.rolagem = { ...alvo.rolagem }
      reacoes.push(reacao)
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
    saem.push({
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
    })
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
  for (const carta of turnos.cartas) {
    if (cartas.length >= CARTAS_PARA_JOGADOR_MAX) break
    const nome = ctx.tokensNoRecorte.get(carta.tokenId)
    if (nome !== undefined) cartas.push(cartaParaJogador(carta, nome, ctx, caidos, turnos))
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
  const estado: EstadoParaJogador = {
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
  // F2: campo vazio não sai — o estado da F1 continua igual byte a byte (o host deduplica pelo JSON).
  if (minhaVez) estado.acoes = acoesParaJogador(cena, daVez, ctx)
  const meus = meusNoCombate(cena, ctx)
  if (meus.length > 0) estado.meus = meus
  const golpes = turnos.golpes ?? []
  const reacoes = reacoesParaJogador(golpes, ctx)
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
  return estado
}
