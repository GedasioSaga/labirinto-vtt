import { create } from 'zustand'
import { copiasDaMontagem, novoIdDeCopia } from '../lib/arena/copias'
import { centroDaCasaNaArena, comEscolha, fichasNoLado, judgeDoArbitro, semEscolha, tokensDaArena, type FichaNaGrade } from '../lib/arena/montagem'
import {
  BONECO_PADRAO,
  CASA_DA_ARENA,
  CENA_DA_ARENA,
  EQUIPE_DO_LADO,
  GRADES_DA_ARENA,
  PREFIXO_DO_TOKEN,
  type EscolhaNaMontagem,
  type GradeDaArena,
  type LadoDaArena,
  type MontagemDaArena,
  type TamanhoDaGrade,
} from '../lib/arena/tipos'
import type { ParedeDoPasso } from '../lib/batalha/blocos'
import type { Equipe } from '../lib/batalha/equipes'
import type { JudgeNaCena } from '../lib/batalha/judge'
import type { MesaDaBatalha } from '../lib/batalha/mesa'
import { passoEmBatalha } from '../lib/batalha/movimentoEmBatalha'
import { metrosPorCasa } from '../lib/dbt/batalha/contas'
import type { PosicaoNaCena, PosicoesDaCena } from '../lib/dbt/batalha/posicao'
import { ultimaDePe } from '../lib/dbt/batalha/registro'
import type { AutorDBT, ComandoDBT, EntranteDBT, ModoDaBatalha } from '../lib/dbt/batalha/tipos'
import { fichaDBTVazia } from '../lib/dbt/modelo'
import { secureRollDie } from '../lib/dice'
import { novoPersonagem, type Personagem } from '../lib/personagem'
import type { SistemaDeRpg } from '../lib/sistemaDeRpg'
import type { Token } from '../types/map'
import { criarBatalhaDBTStore, type CenaDBT, type LojaDaBatalhaDBT } from './batalhaDBTStore'
import { sistemaPorId, useRpgStore } from './rpgStore'

/**
 * ARENA DE TESTES DO DRAGON BALL (docs/planos/sistema-dragon-ball.md, item 9;
 * dossiê da batalha, seção 5): o mesmo laboratório da arena do One Piece
 * (`stores/arenaStore.ts`), com o motor próprio. O mestre põe CÓPIAS das
 * fichas da pasta em dois lados, mais bonecos de treino com CA, PV e EP à
 * mão, e joga a batalha inteira pela `batalhaDaArenaDBT`, uma instância
 * SEPARADA de `criarBatalhaDBTStore` presa à mesa das cópias: ninguém do App,
 * do host ou da rede a assina, e as fichas de verdade nunca mudam. Tudo em
 * memória; sair esquece.
 *
 * Reaproveita só o genérico da arena (`lib/arena/{tipos,montagem,copias}`):
 * nada de regra One Piece (boneco, placar, reação, vista do jogador de lá).
 *
 * - O Judge é o árbitro e se arrasta na grade: o palco o trata como a ficha
 *   `ID_DO_TOKEN_DO_JUDGE` (o mesmo jeito do Judge-boneco do One Piece), que
 *   não entra na batalha.
 * - Os bonecos não agem: na vez deles a vez passa sozinha e, numa janela de
 *   reação, eles respondem "Não reagir" (PK 0: não pagam reação).
 * - Desfazer (Ctrl+Z e o botão do alto) volta a última coisa feita na arena:
 *   a linha do registro de pé (o Desfazer da batalha DBT), ou o movimento, o
 *   Judge e o ajuste de boneco, o que for mais novo.
 */

/** Quantos bonecos de treino cabem na montagem (os dois lados juntos). */
export const BONECOS_MAX = 4
export const CA_DO_BONECO_MAX = 99
export const PV_DO_BONECO_MAX = 1_000_000
/** O teto de EP da ficha (`EP_MAX` em lib/dbt/modelo.ts). */
export const EP_DO_BONECO_MAX = 100
/** O boneco novo: CA de um iniciante com DES 8 (10 - 1 + EP 1 = 10) arredondada para cima, PV de alvo de treino. */
export const BONECO_DBT_PADRAO = { ca: 12, pv: 100, ep: 1 } as const

/** O id da ficha do Judge no palco: arrasta como ficha, mas não é combatente. */
export const ID_DO_TOKEN_DO_JUDGE = `${PREFIXO_DO_TOKEN}judge`

/** O lado como a batalha o lê ("Ninguém de pé no lado A"). */
export const LADO_NA_BATALHA: Readonly<Record<LadoDaArena, string>> = { a: 'A', b: 'B' }

const ATRASO_DO_BONECO_MS = 600
/** Teto da pilha do Desfazer da arena (movimentos, Judge, bonecos). */
const PASSOS_MAX = 200
/** A arena não tem escala de mapa: a casa padrão do livro (1,5 m). */
const METROS_POR_CASA_DA_ARENA = metrosPorCasa(null)
const MESTRE: AutorDBT = { tipo: 'mestre' }
const SEM_FICHAS: readonly Personagem[] = []
const SEM_PAREDES: readonly ParedeDoPasso[] = []

// ───────────────────────────────────────────────────────────────────────────
// Tipos
// ───────────────────────────────────────────────────────────────────────────

/** Um boneco de treino: só apanha. CA e EP entram como valores à mão da ficha; o PV, atual e máximo. */
export interface BonecoDeTreinoDBT {
  id: string
  nome: string
  lado: LadoDaArena
  ca: number
  pv: number
  ep: number
}

export type AjusteDoBonecoDBT = Partial<Pick<BonecoDeTreinoDBT, 'nome' | 'ca' | 'pv' | 'ep'>>

export interface MontagemDaArenaDBT {
  /** As fichas reais escolhidas por lado (no formato de `lib/arena`). */
  escolhas: EscolhaNaMontagem[]
  bonecos: BonecoDeTreinoDBT[]
  grade: TamanhoDaGrade
  /** O modo com que a batalha liga; na luta, troca no painel. */
  modo: ModoDaBatalha
}

/** O que o Desfazer da arena volta. `apos` = o `seq` da batalha logo depois do passo (linha com `seq` menor é mais velha). */
export type PassoDaArenaDBT =
  | { tipo: 'mover'; tokenId: string; de: { x: number; y: number }; antes: Pick<CenaDBT, 'turno' | 'caminhos' | 'trilhas'>; linhaId: string | null; apos: number }
  | { tipo: 'judge'; de: JudgeNaCena; apos: number }
  | { tipo: 'boneco'; boneco: BonecoDeTreinoDBT; copia: Personagem | null; apos: number }

export interface SessaoDaArenaDBT {
  fase: 'montando' | 'lutando'
  montagem: MontagemDaArenaDBT
  sistemaId: string
  /** As cópias na luta (as fichas escolhidas e os bonecos). Vazio na montagem. */
  copias: Personagem[]
  /** Cópia → ficha real (o boneco não tem). */
  origemDe: Record<string, string>
  /** Os combatentes no palco (sem o Judge), x/y no centro da casa. */
  tokens: Token[]
  ladoDe: Record<string, LadoDaArena>
  /** Token → id do boneco de treino na montagem. */
  bonecoDe: Record<string, string>
  passos: PassoDaArenaDBT[]
  /** Sobe a cada Desfazer: o Judge ergue a carta. 0 = nunca. */
  gesto: number
}

export interface ArenaDBTState {
  /** `null` = arena fechada. */
  sessao: SessaoDaArenaDBT | null
  /** Abre a montagem do livro. A sessão do mesmo livro continua; outro livro = sessão nova. */
  abrir: (sistemaId: string) => void
  /** "+ A" / "+ B": a ficha real no lado, com `vezes` cópias. Só na montagem. */
  escolher: (personagemId: string, lado: LadoDaArena, vezes?: number) => void
  tirar: (personagemId: string, lado: LadoDaArena) => void
  trocarGrade: (grade: TamanhoDaGrade) => void
  trocarModo: (modo: ModoDaBatalha) => void
  /** Um boneco novo no lado (até `BONECOS_MAX`). Só na montagem. */
  porBoneco: (lado: LadoDaArena) => void
  tirarBoneco: (bonecoId: string) => void
  /** Na montagem, guarda; na luta, troca CA, PV e EP da cópia dele na hora (entra no Desfazer da arena, não no registro). */
  ajustarBoneco: (bonecoId: string, ajuste: AjusteDoBonecoDBT) => void
  /** "Começar o teste" com as fichas reais de AGORA. `false` = falta alguém num lado, ou livro sem sistema. */
  lutar: (fichas: readonly Personagem[]) => boolean
  /** Soltou a ficha (ou o Judge) em (x, y), já no centro da casa. `false` = não andou. */
  moverFicha: (tokenId: string, x: number, y: number) => boolean
  /** Volta a última coisa feita na arena. `false` = nada para desfazer. */
  desfazer: () => boolean
  /** O Desfazer de uma linha do registro (LIFO da batalha). */
  desfazerLinha: (linhaId: string) => boolean
  recomecar: (fichas: readonly Personagem[]) => boolean
  voltarAMontagem: () => void
  sair: () => void
}

// ───────────────────────────────────────────────────────────────────────────
// Contas puras
// ───────────────────────────────────────────────────────────────────────────

function inteiroEntre(valor: number, min: number, max: number, padrao: number): number {
  if (!Number.isFinite(valor)) return padrao
  return Math.min(max, Math.max(min, Math.trunc(valor)))
}

/** O boneco com cada número no lugar: CA 0..99, PV 1..1.000.000, EP 0..100, nome aparado. */
export function bonecoValido(boneco: BonecoDeTreinoDBT): BonecoDeTreinoDBT {
  return {
    ...boneco,
    nome: boneco.nome.trim() || 'Boneco',
    ca: inteiroEntre(boneco.ca, 0, CA_DO_BONECO_MAX, BONECO_DBT_PADRAO.ca),
    pv: inteiroEntre(boneco.pv, 1, PV_DO_BONECO_MAX, BONECO_DBT_PADRAO.pv),
    ep: inteiroEntre(boneco.ep, 0, EP_DO_BONECO_MAX, BONECO_DBT_PADRAO.ep),
  }
}

/** "Boneco 1", "Boneco 2"... o primeiro número livre. */
function nomeDeBonecoNovo(bonecos: readonly BonecoDeTreinoDBT[]): string {
  const usados = new Set(bonecos.map((boneco) => boneco.nome))
  let n = 1
  while (usados.has(`Boneco ${n}`)) n += 1
  return `Boneco ${n}`
}

/**
 * Os números do boneco na ficha: CA e EP base como valores à mão
 * (`FichaDBT.ajustes`, que a leitura da batalha respeita) e, com `comPv`, o
 * PV atual e máximo; PK 0 (não paga reação nem técnica).
 */
export function comNumerosDoBoneco(ficha: Personagem, boneco: BonecoDeTreinoDBT, comPv: boolean): Personagem {
  const dbt = ficha.dbt ?? fichaDBTVazia()
  const comDbt: Personagem = { ...ficha, dbt: { ...dbt, ajustes: { ...dbt.ajustes, ca: boneco.ca, epBase: boneco.ep } } }
  if (!comPv) return comDbt
  return { ...comDbt, recursos: { ...comDbt.recursos, pv: boneco.pv, pk: 0 }, maximos: { ...comDbt.maximos, pv: boneco.pv, pk: 0 } }
}

/** A ficha NPC do boneco, com a ficha Dragon Ball vazia e os números dele. */
export function fichaDoBonecoDBT(sistema: SistemaDeRpg, boneco: BonecoDeTreinoDBT, id: string): Personagem {
  return comNumerosDoBoneco({ ...novoPersonagem(sistema, 'npc', boneco.nome), id }, boneco, true)
}

/** O formato de `lib/arena/montagem` (sempre dois lados; o boneco de lá não vale aqui). */
function comoMontagemDaArena(montagem: MontagemDaArenaDBT): MontagemDaArena {
  return { modo: 'lados', escolhas: montagem.escolhas, grade: montagem.grade, boneco: BONECO_PADRAO }
}

/** Quantas fichas o lado já tem (contando as repetidas; os bonecos ficam fora, com teto próprio). */
export function fichasNoLadoDBT(montagem: MontagemDaArenaDBT, lado: LadoDaArena): number {
  return fichasNoLado(comoMontagemDaArena(montagem), lado)
}

/** Quem está no lado: as fichas que ainda existem e os bonecos. */
export function temNoLadoDBT(montagem: MontagemDaArenaDBT, lado: LadoDaArena, fichas: readonly Pick<Personagem, 'id'>[]): boolean {
  const existe = new Set(fichas.map((ficha) => ficha.id))
  return montagem.escolhas.some((escolha) => escolha.lado === lado && existe.has(escolha.personagemId)) || montagem.bonecos.some((boneco) => boneco.lado === lado)
}

/** Dá para começar: alguém de cada lado (ficha ou boneco). */
export function montagemProntaDBT(montagem: MontagemDaArenaDBT, fichas: readonly Pick<Personagem, 'id'>[]): boolean {
  return temNoLadoDBT(montagem, 'a', fichas) && temNoLadoDBT(montagem, 'b', fichas)
}

/** As duas equipes da arena, com as cópias de cada lado (o id é o lado como a batalha o lê). */
export function equipesDaArenaDBT(tokens: readonly Token[], ladoDe: Readonly<Record<string, LadoDaArena>>): Equipe[] {
  const membros: Record<LadoDaArena, string[]> = { a: [], b: [] }
  for (const token of tokens) {
    const lado = ladoDe[token.id]
    if (token.characterId === null || lado === undefined || membros[lado].includes(token.characterId)) continue
    membros[lado].push(token.characterId)
  }
  return (['a', 'b'] as const).map((lado) => ({ ...EQUIPE_DO_LADO[lado], id: LADO_NA_BATALHA[lado], membros: membros[lado] }))
}

/** Todos os combatentes da arena entram, cada um no lado dele; o jogador continua jogador (regra de 0 PV do livro). */
export function entrantesDaArenaDBT(tokens: readonly Token[], copias: readonly Personagem[], ladoDe: Readonly<Record<string, LadoDaArena>>): EntranteDBT[] {
  const porId = new Map(copias.map((copia) => [copia.id, copia]))
  return tokens.flatMap((token): EntranteDBT[] => {
    const personagem = token.characterId === null ? undefined : porId.get(token.characterId)
    const lado = ladoDe[token.id]
    if (personagem === undefined || lado === undefined) return []
    return [{ tokenId: token.id, personagemId: personagem.id, nome: token.name, lado: LADO_NA_BATALHA[lado], npc: personagem.tipo !== 'jogador' }]
  })
}

function casaDe(valor: number): number {
  return Math.floor(valor / CASA_DA_ARENA)
}

/** As casas dos combatentes para o motor (alcance, adjacência, flanco). O token é centrado em (x, y). */
export function posicoesDaArenaDBT(tokens: readonly Token[]): PosicoesDaCena {
  const posicoes = new Map<string, PosicaoNaCena>()
  for (const token of tokens) {
    const meio = (CASA_DA_ARENA / 2) * token.size
    posicoes.set(token.id, { col: Math.round((token.x - meio) / CASA_DA_ARENA), row: Math.round((token.y - meio) / CASA_DA_ARENA), tamanho: Math.max(1, Math.round(token.size)) })
  }
  return { metrosPorCasa: METROS_POR_CASA_DA_ARENA, tokens: posicoes }
}

/** O ponto está numa casa ocupada por algum token (fora `ignorar`)? */
function casaOcupada(ponto: { x: number; y: number }, tokens: readonly Token[], ignorar: string | null): boolean {
  return tokens.some((token) => token.id !== ignorar && casaDe(token.x) === casaDe(ponto.x) && casaDe(token.y) === casaDe(ponto.y))
}

/** O Judge na casa livre mais perto da desejada (ele não divide casa com ficha). */
export function judgeEmCasaLivre(desejado: JudgeNaCena, tokens: readonly Token[], grade: GradeDaArena): JudgeNaCena {
  if (!casaOcupada(desejado, tokens, null)) return desejado
  const col = casaDe(desejado.x)
  const row = casaDe(desejado.y)
  let melhor: JudgeNaCena | null = null
  let menor = Number.POSITIVE_INFINITY
  for (let c = 0; c < grade.colunas; c += 1) {
    for (let r = 0; r < grade.linhas; r += 1) {
      const centro = centroDaCasaNaArena({ col: c, row: r })
      const distancia = Math.max(Math.abs(c - col), Math.abs(r - row))
      if (distancia < menor && !casaOcupada(centro, tokens, null)) {
        menor = distancia
        melhor = centro
      }
    }
  }
  return melhor ?? desejado
}

// ───────────────────────────────────────────────────────────────────────────
// A mesa das cópias e a batalha da arena
// ───────────────────────────────────────────────────────────────────────────

function sistemaDaSessao(sessao: SessaoDaArenaDBT): SistemaDeRpg | null {
  return sistemaPorId(useRpgStore.getState().biblioteca, sessao.sistemaId) ?? null
}

/** A MESA DAS CÓPIAS: a batalha da arena lê e grava só aqui; trocar de equipe não existe na arena. */
export const mesaDaArenaDBT: MesaDaBatalha = {
  personagens: () => useArenaDBTStore.getState().sessao?.copias ?? SEM_FICHAS,
  sistema: () => {
    const sessao = useArenaDBTStore.getState().sessao
    return sessao === null ? null : sistemaDaSessao(sessao)
  },
  equipes: () => {
    const sessao = useArenaDBTStore.getState().sessao
    return sessao === null ? [] : equipesDaArenaDBT(sessao.tokens, sessao.ladoDe)
  },
  ajustarPersonagem: (personagemId, ajustar) => {
    const sessao = useArenaDBTStore.getState().sessao
    const atual = sessao?.copias.find((copia) => copia.id === personagemId)
    if (sessao === null || atual === undefined) return false
    const novo = ajustar(atual)
    if (novo === atual) return true
    useArenaDBTStore.setState({ sessao: { ...sessao, copias: sessao.copias.map((copia) => (copia.id === personagemId ? novo : copia)) } })
    return true
  },
  trocarEquipe: () => false,
}

/** A batalha DBT da arena: sempre na cena `CENA_DA_ARENA`, com as cópias e as casas do palco da arena. */
export const batalhaDaArenaDBT: LojaDaBatalhaDBT = criarBatalhaDBTStore(mesaDaArenaDBT, {
  rolar: secureRollDie,
  agora: Date.now,
  posicoes: (sceneKey) => {
    const sessao = useArenaDBTStore.getState().sessao
    return sceneKey !== CENA_DA_ARENA || sessao === null || sessao.fase !== 'lutando' ? null : posicoesDaArenaDBT(sessao.tokens)
  },
})

function cenaDaArena(): CenaDBT | undefined {
  const cenas = batalhaDaArenaDBT.getState().cenas
  return Object.hasOwn(cenas, CENA_DA_ARENA) ? cenas[CENA_DA_ARENA] : undefined
}

/** O `seq` que a próxima linha da batalha leva (0 sem batalha). */
function seqDaBatalha(): number {
  return cenaDaArena()?.seq ?? 0
}

function comPasso(passos: readonly PassoDaArenaDBT[], passo: PassoDaArenaDBT): PassoDaArenaDBT[] {
  return [...passos, passo].slice(-PASSOS_MAX)
}

// ───────────────────────────────────────────────────────────────────────────
// Os bonecos sozinhos
// ───────────────────────────────────────────────────────────────────────────

let relogioDosBonecos: ReturnType<typeof setTimeout> | null = null

/** O que um boneco faz agora: "Não reagir" na janela em que ainda não respondeu, ou passar a vez dele. `null` = nada. */
function proximoComandoDosBonecos(): ComandoDBT | null {
  const sessao = useArenaDBTStore.getState().sessao
  const cena = cenaDaArena()
  if (sessao === null || sessao.fase !== 'lutando' || cena === undefined) return null
  const ehBoneco = (id: string): boolean => Object.hasOwn(sessao.bonecoDe, id)
  const ativa = cena.pendencias[0]
  if (ativa !== undefined && ativa.tipo === 'reacao') {
    const quieto = ativa.janela.convidados.find((id) => ehBoneco(id) && !Object.hasOwn(ativa.janela.respostas, id))
    return quieto === undefined ? null : { tipo: 'responder', pendenciaId: ativa.id, combatenteId: quieto, opcao: 'nao' }
  }
  const vez = cena.ordem.vez
  if (cena.fase !== 'combate' || ativa !== undefined || vez === null || !ehBoneco(vez) || !Object.hasOwn(cena.combatentes, vez)) return null
  return { tipo: 'passar', vez: { combatenteId: vez, rodada: cena.ordem.rodada, turno: cena.combatentes[vez].turnosJogados } }
}

/** Relido na hora (o mestre pode ter desfeito algo na espera). Recusado: nada muda e nada se agenda de novo. */
function darOPassoDosBonecos(): void {
  relogioDosBonecos = null
  const comando = proximoComandoDosBonecos()
  if (comando !== null) batalhaDaArenaDBT.getState().comando(CENA_DA_ARENA, MESTRE, comando)
}

function agendarOsBonecos(): void {
  if (relogioDosBonecos !== null || proximoComandoDosBonecos() === null) return
  relogioDosBonecos = setTimeout(darOPassoDosBonecos, ATRASO_DO_BONECO_MS)
}

function encerrarALuta(): void {
  if (relogioDosBonecos !== null) clearTimeout(relogioDosBonecos)
  relogioDosBonecos = null
  batalhaDaArenaDBT.getState().desligar(CENA_DA_ARENA)
}

// ───────────────────────────────────────────────────────────────────────────
// A store
// ───────────────────────────────────────────────────────────────────────────

function sessaoNova(sistemaId: string): SessaoDaArenaDBT {
  return {
    fase: 'montando',
    montagem: { escolhas: [], bonecos: [], grade: 'pequena', modo: 'automatico' },
    sistemaId,
    copias: [],
    origemDe: {},
    tokens: [],
    ladoDe: {},
    bonecoDe: {},
    passos: [],
    gesto: 0,
  }
}

function semALuta(sessao: SessaoDaArenaDBT): SessaoDaArenaDBT {
  return { ...sessao, fase: 'montando', copias: [], origemDe: {}, tokens: [], ladoDe: {}, bonecoDe: {}, passos: [] }
}

export const useArenaDBTStore = create<ArenaDBTState>()((set, get) => {
  /** Muda a montagem (só montando). A mesma montagem de volta = nada. */
  const mudarMontagem = (mudar: (montagem: MontagemDaArenaDBT) => MontagemDaArenaDBT): void => {
    const sessao = get().sessao
    if (sessao === null || sessao.fase !== 'montando') return
    const montagem = mudar(sessao.montagem)
    if (montagem !== sessao.montagem) set({ sessao: { ...sessao, montagem } })
  }

  /** As escolhas pela regra de `lib/arena/montagem` (vezes, teto por lado). */
  const mudarEscolhas = (mudar: (montagem: MontagemDaArena) => MontagemDaArena): void =>
    mudarMontagem((montagem) => {
      const antes = comoMontagemDaArena(montagem)
      const depois = mudar(antes)
      return depois === antes ? montagem : { ...montagem, escolhas: depois.escolhas }
    })

  const comecar = (sessao: SessaoDaArenaDBT, fichas: readonly Personagem[]): boolean => {
    const sistema = sistemaDaSessao(sessao)
    if (sistema === null || !montagemProntaDBT(sessao.montagem, fichas)) return false
    const copias = copiasDaMontagem(comoMontagemDaArena(sessao.montagem), fichas)
    const bonecos = sessao.montagem.bonecos.map((boneco) => ({ boneco, ficha: fichaDoBonecoDBT(sistema, bonecoValido(boneco), novoIdDeCopia()) }))
    const naGrade: FichaNaGrade[] = [...copias.map((copia) => ({ personagem: copia.personagem, lado: copia.lado })), ...bonecos.map(({ boneco, ficha }) => ({ personagem: ficha, lado: boneco.lado }))]
    if (naGrade.length === 0) return false
    const grade = GRADES_DA_ARENA[sessao.montagem.grade]
    const gerados = tokensDaArena(naGrade, grade)
    const ladoDe: Record<string, LadoDaArena> = {}
    for (const [tokenId, lado] of Object.entries(gerados.ladoDe)) ladoDe[tokenId] = lado === 'boneco' ? 'b' : lado
    const bonecoDe: Record<string, string> = {}
    for (const { boneco, ficha } of bonecos) {
      const token = gerados.tokens.find((candidato) => candidato.characterId === ficha.id)
      if (token !== undefined) bonecoDe[token.id] = boneco.id
    }
    const personagens = naGrade.map((ficha) => ficha.personagem)

    encerrarALuta()
    // A sessão vem ANTES de ligar: a leitura das fichas passa pela mesa da arena.
    set({
      sessao: {
        ...sessao,
        fase: 'lutando',
        copias: personagens,
        origemDe: Object.fromEntries(copias.map((copia) => [copia.personagem.id, copia.origem])),
        tokens: gerados.tokens,
        ladoDe,
        bonecoDe,
        passos: [],
      },
    })
    // O Judge árbitro: ao norte da 1ª ficha do Lado A (a ordem só sai depois da iniciativa), numa casa livre.
    const judge = judgeEmCasaLivre(judgeDoArbitro(gerados.tokens[0] ?? null, grade), gerados.tokens, grade)
    batalhaDaArenaDBT.getState().ligar(CENA_DA_ARENA, {}, { entrantes: entrantesDaArenaDBT(gerados.tokens, personagens, ladoDe), opcoes: { modo: sessao.montagem.modo }, judge })
    return true
  }

  const moverJudge = (sessao: SessaoDaArenaDBT, x: number, y: number): boolean => {
    const cena = cenaDaArena()
    const grade = GRADES_DA_ARENA[sessao.montagem.grade]
    if (cena === undefined || cena.judge === undefined) return false
    const col = casaDe(x)
    const row = casaDe(y)
    if (col < 0 || row < 0 || col >= grade.colunas || row >= grade.linhas || casaOcupada({ x, y }, sessao.tokens, null)) return false
    const de = cena.judge
    const destino = centroDaCasaNaArena({ col, row })
    if (!batalhaDaArenaDBT.getState().moverJudge(CENA_DA_ARENA, destino.x, destino.y)) return false
    set({ sessao: { ...sessao, passos: comPasso(sessao.passos, { tipo: 'judge', de, apos: seqDaBatalha() }) } })
    return true
  }

  /** Volta o passo da arena (o topo da pilha). */
  const desfazerPasso = (sessao: SessaoDaArenaDBT, passo: PassoDaArenaDBT): boolean => {
    const batalha = batalhaDaArenaDBT.getState()
    const passos = sessao.passos.slice(0, -1)
    if (passo.tipo === 'judge') {
      batalha.moverJudge(CENA_DA_ARENA, passo.de.x, passo.de.y)
      set({ sessao: { ...sessao, passos, gesto: sessao.gesto + 1 } })
      return true
    }
    if (passo.tipo === 'boneco') {
      const anterior = passo.copia
      const copias = anterior === null ? sessao.copias : sessao.copias.map((copia) => (copia.id === anterior.id ? anterior : copia))
      const bonecos = sessao.montagem.bonecos.map((boneco) => (boneco.id === passo.boneco.id ? passo.boneco : boneco))
      set({ sessao: { ...sessao, copias, montagem: { ...sessao.montagem, bonecos }, passos, gesto: sessao.gesto + 1 } })
      return true
    }
    // O movimento: a linha que ele escreveu (Correr, fora da vez) volta pelo Desfazer da batalha, que devolve o Ki e o turno.
    const cena = cenaDaArena()
    const linha = passo.linhaId === null || cena === undefined ? undefined : cena.registro.find((candidata) => candidata.id === passo.linhaId)
    if (linha !== undefined && linha.desfeita === undefined) batalha.desfazer(CENA_DA_ARENA, linha.id, MESTRE)
    const depois = cenaDaArena()
    if (depois !== undefined) {
      // Os caminhos ficam fora do núcleo da batalha, e o andar sem linha só mexeu no `turno.andou`: voltam daqui.
      const turno = passo.linhaId === null ? { turno: passo.antes.turno } : {}
      batalhaDaArenaDBT.setState({
        cenas: { ...batalhaDaArenaDBT.getState().cenas, [CENA_DA_ARENA]: { ...depois, ...turno, caminhos: passo.antes.caminhos, trilhas: passo.antes.trilhas, rev: depois.rev + 1, turnosRev: depois.turnosRev + 1 } },
      })
    }
    const atual = get().sessao ?? sessao
    const tokens = atual.tokens.map((token) => (token.id === passo.tokenId ? { ...token, x: passo.de.x, y: passo.de.y } : token))
    set({ sessao: { ...atual, tokens, passos, gesto: atual.gesto + 1 } })
    return true
  }

  return {
    sessao: null,

    abrir: (sistemaId) => {
      const sessao = get().sessao
      if (sessao !== null && sessao.sistemaId === sistemaId) return
      if (sessao !== null) encerrarALuta()
      set({ sessao: sessaoNova(sistemaId) })
    },

    escolher: (personagemId, lado, vezes) => mudarEscolhas((montagem) => comEscolha(montagem, personagemId, lado, vezes)),

    tirar: (personagemId, lado) => mudarEscolhas((montagem) => semEscolha(montagem, personagemId, lado)),

    trocarGrade: (grade) => mudarMontagem((montagem) => (montagem.grade === grade ? montagem : { ...montagem, grade })),

    trocarModo: (modo) => mudarMontagem((montagem) => (montagem.modo === modo ? montagem : { ...montagem, modo })),

    porBoneco: (lado) =>
      mudarMontagem((montagem) => {
        if (montagem.bonecos.length >= BONECOS_MAX) return montagem
        const boneco: BonecoDeTreinoDBT = { id: `boneco_${crypto.randomUUID()}`, nome: nomeDeBonecoNovo(montagem.bonecos), lado, ...BONECO_DBT_PADRAO }
        return { ...montagem, bonecos: [...montagem.bonecos, boneco] }
      }),

    tirarBoneco: (bonecoId) =>
      mudarMontagem((montagem) => {
        const bonecos = montagem.bonecos.filter((boneco) => boneco.id !== bonecoId)
        return bonecos.length === montagem.bonecos.length ? montagem : { ...montagem, bonecos }
      }),

    ajustarBoneco: (bonecoId, ajuste) => {
      const sessao = get().sessao
      const antes = sessao?.montagem.bonecos.find((boneco) => boneco.id === bonecoId)
      if (sessao === null || antes === undefined) return
      // O nome só muda na montagem: na luta a carta da ordem já leva o nome de quando entrou.
      const nome = sessao.fase === 'montando' ? (ajuste.nome ?? antes.nome) : antes.nome
      const novo = bonecoValido({ ...antes, nome, ca: ajuste.ca ?? antes.ca, pv: ajuste.pv ?? antes.pv, ep: ajuste.ep ?? antes.ep })
      if (novo.nome === antes.nome && novo.ca === antes.ca && novo.pv === antes.pv && novo.ep === antes.ep) return
      const montagem = { ...sessao.montagem, bonecos: sessao.montagem.bonecos.map((boneco) => (boneco.id === bonecoId ? novo : boneco)) }
      if (sessao.fase === 'montando') {
        set({ sessao: { ...sessao, montagem } })
        return
      }
      const tokenId = Object.keys(sessao.bonecoDe).find((id) => sessao.bonecoDe[id] === bonecoId)
      const personagemId = sessao.tokens.find((token) => token.id === tokenId)?.characterId ?? null
      const copia = sessao.copias.find((candidata) => candidata.id === personagemId) ?? null
      // Só o que foi pedido: mexer na CA no meio da luta não enche o PV de volta.
      const copias = copia === null ? sessao.copias : sessao.copias.map((candidata) => (candidata === copia ? comNumerosDoBoneco(candidata, novo, novo.pv !== antes.pv) : candidata))
      set({ sessao: { ...sessao, montagem, copias, passos: comPasso(sessao.passos, { tipo: 'boneco', boneco: antes, copia, apos: seqDaBatalha() }) } })
    },

    lutar: (fichas) => {
      const sessao = get().sessao
      if (sessao === null || sessao.fase !== 'montando') return false
      return comecar(sessao, fichas)
    },

    moverFicha: (tokenId, x, y) => {
      const sessao = get().sessao
      if (sessao === null || sessao.fase !== 'lutando' || !Number.isFinite(x) || !Number.isFinite(y)) return false
      if (tokenId === ID_DO_TOKEN_DO_JUDGE) return moverJudge(sessao, x, y)
      const token = sessao.tokens.find((candidato) => candidato.id === tokenId)
      const cena = cenaDaArena()
      if (token === undefined || cena === undefined) return false
      const grade = GRADES_DA_ARENA[sessao.montagem.grade]
      const judge = cena.judge
      // Sem paredes nem terreno na arena; outra ficha ou o Judge ocupam a casa.
      const passo = passoEmBatalha({
        grid: CASA_DA_ARENA,
        colunas: grade.colunas,
        linhas: grade.linhas,
        de: { x: token.x, y: token.y },
        para: { x, y },
        tamanho: token.size,
        passoMaximo: null,
        paredesDoHost: SEM_PAREDES,
        paredesDoJogador: SEM_PAREDES,
        noChao: () => true,
        ocupada: (ponto) => casaOcupada(ponto, sessao.tokens, tokenId) || (judge !== undefined && casaDe(judge.x) === casaDe(ponto.x) && casaDe(judge.y) === casaDe(ponto.y)),
      })
      if (!passo.ok || (passo.x === token.x && passo.y === token.y)) return false
      const antes = { turno: cena.turno, caminhos: cena.caminhos, trilhas: cena.trilhas }
      const ultimaAntes = ultimaDePe(cena.registro)?.id ?? null
      // A posição nova vem ANTES do andar: o motor lê as casas pela mesa da arena.
      set({ sessao: { ...sessao, tokens: sessao.tokens.map((candidato) => (candidato.id === tokenId ? { ...candidato, x: passo.x, y: passo.y } : candidato)) } })
      if (passo.blocos > 0) batalhaDaArenaDBT.getState().somarCaminho(CENA_DA_ARENA, tokenId, passo.blocos, passo.caminho, MESTRE)
      const depois = cenaDaArena()
      const ultimaDepois = depois === undefined ? null : (ultimaDePe(depois.registro)?.id ?? null)
      const linhaId = ultimaDepois !== null && ultimaDepois !== ultimaAntes ? ultimaDepois : null
      const atual = get().sessao
      if (atual !== null) set({ sessao: { ...atual, passos: comPasso(atual.passos, { tipo: 'mover', tokenId, de: { x: token.x, y: token.y }, antes, linhaId, apos: seqDaBatalha() }) } })
      return true
    },

    desfazer: () => {
      const sessao = get().sessao
      const cena = cenaDaArena()
      if (sessao === null || sessao.fase !== 'lutando' || cena === undefined) return false
      const linha = ultimaDePe(cena.registro)
      const passo = sessao.passos.at(-1)
      if (passo !== undefined && (linha === null || linha.seq < passo.apos)) return desfazerPasso(sessao, passo)
      return linha === null ? false : get().desfazerLinha(linha.id)
    },

    desfazerLinha: (linhaId) => {
      const ok = batalhaDaArenaDBT.getState().desfazer(CENA_DA_ARENA, linhaId, MESTRE)
      const sessao = get().sessao
      if (ok && sessao !== null) set({ sessao: { ...sessao, gesto: sessao.gesto + 1 } })
      return ok
    },

    recomecar: (fichas) => {
      const sessao = get().sessao
      return sessao === null ? false : comecar(sessao, fichas)
    },

    voltarAMontagem: () => {
      const sessao = get().sessao
      if (sessao === null || sessao.fase === 'montando') return
      encerrarALuta()
      set({ sessao: semALuta(sessao) })
    },

    sair: () => {
      if (get().sessao === null) return
      encerrarALuta()
      set({ sessao: null })
    },
  }
})

// Cada mudança da batalha da arena pode deixar um boneco esperando: a vez dele, ou a janela de reação.
batalhaDaArenaDBT.subscribe(() => agendarOsBonecos())
