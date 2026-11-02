import { create, type StoreApi, type UseBoundStore } from 'zustand'
import { aplicarAjustes, ajusteDoAtualDigitado, NOME_DO_MESTRE } from '../lib/ajusteDaFicha'
import type { Casa } from '../lib/batalha/blocos'
import { somarNaTrilha, type CaminhosNoMestre } from '../lib/batalha/caminhoAndado'
import { lerJudgeNaCena, type JudgeNaCena } from '../lib/batalha/judge'
import type { MesaDaBatalha } from '../lib/batalha/mesa'
import { metrosPorCasa } from '../lib/dbt/batalha/contas'
import { mudancaDoFim, resumoDoFim, type LinhaDoFimDBT } from '../lib/dbt/batalha/fim'
import { fichaDepoisDoFim, fichasDaCena, type FichaLida } from '../lib/dbt/batalha/leitura'
import { nucleoInicial, reduzir, type ContextoDBT } from '../lib/dbt/batalha/motor'
import type { PonteDaBatalhaDBT } from '../lib/dbt/batalha/ponte'
import type { PosicaoNaCena, PosicoesDaCena } from '../lib/dbt/batalha/posicao'
import { ajustesParaDesfazer, comLinhaDBT, partesDaFichaDBT, podeDesfazerDBT } from '../lib/dbt/batalha/registro'
import {
  EFEITOS_DBT_GUARDADOS,
  type AutorDBT,
  type ComandoDBT,
  type EfeitoDBT,
  type EntranteDBT,
  type EstadoDBT,
  type LadosDoDado,
  type LinhaDBT,
  type NucleoDBT,
  type OpcoesDaBatalhaDBT,
  type ParteDaFichaDBT,
} from '../lib/dbt/batalha/tipos'
import { secureRollDie } from '../lib/dice'
import type { Personagem } from '../lib/personagem'
import { useAdventureStore } from './adventureStore'
import { useMapStore } from './mapStore'
import { mesaDaAventura } from './mesaDaAventura'

/**
 * BATALHA DRAGON BALL TALES (docs/planos/dbt-batalha.md, seção 16): a store
 * que guarda a batalha DBT de cada cena e aplica o motor puro
 * (`lib/dbt/batalha/motor.ts`). Mesmo molde de `stores/batalhaStore.ts` (a do
 * One Piece), sem importar nada dela: fábrica `criarBatalhaDBTStore(mesa,
 * deps)` sem estado de módulo, e `useBatalhaDBTStore` é a instância da mesa de
 * verdade. Rede e telas ficam com as fatias 2 e 3.
 */

export interface AberturaDaBatalhaDBT {
  transicao?: string
  texto?: string
}

/** O que o Iniciar decide: quem entra (`entrantesDaCena`), as opções e onde o Judge nasce. */
export interface InicioDaBatalhaDBT {
  entrantes: readonly EntranteDBT[]
  opcoes?: Partial<OpcoesDaBatalhaDBT>
  judge?: JudgeNaCena
}

export interface CenaDBT extends EstadoDBT, CaminhosNoMestre {
  /** Sobe a cada caminho somado ou zerado (recorte de quem está na cena). */
  rev: number
  /** Sobe a cada comando, desfazer ou Judge: o host refaz só o estado da batalha. */
  turnosRev: number
  /** O próximo número de linha e de efeito. */
  seq: number
  judge?: JudgeNaCena
}

export interface AnuncioDaBatalhaDBT extends AberturaDaBatalhaDBT {
  seq: number
  sceneKey: string
}

export interface DependenciasDaBatalhaDBT {
  rolar: (lados: LadosDoDado) => number
  agora: () => number
  posicoes: (sceneKey: string) => PosicoesDaCena | null
  /** Ausente = contador local (o motor nunca gera id sozinho). */
  gerarId?: () => string
}

export interface RespostaDoComandoDBT {
  ok: boolean
  motivo?: string
}

export interface BatalhaDBTState {
  cenas: Readonly<Record<string, CenaDBT>>
  anuncio: AnuncioDaBatalhaDBT | null
  /**
   * Liga a batalha DBT na cena. `false` = a cena já está na batalha One Piece
   * (o App passa o teste em `outraBatalhaLigada`). Já ligada: só anuncia de novo.
   */
  ligar: (sceneKey: string, abertura?: AberturaDaBatalhaDBT, inicio?: InicioDaBatalhaDBT, outraBatalhaLigada?: boolean) => boolean
  desligar: (sceneKey: string) => void
  ligada: (sceneKey: string) => boolean
  reset: () => void
  zerarCaminhos: (sceneKey: string) => void
  /** O host aceitou o movimento: soma o caminho e passa ao motor (Correr cobra Ki). */
  somarCaminho: (sceneKey: string, tokenId: string, blocos: number, casas?: readonly Casa[], autor?: AutorDBT) => void
  moverJudge: (sceneKey: string, x: number, y: number) => boolean
  comando: (sceneKey: string, autor: AutorDBT, comando: ComandoDBT) => RespostaDoComandoDBT
  /** LIFO: só a última linha de pé; o jogador só a dele, sem d20 (`podeDesfazerDBT`). */
  desfazer: (sceneKey: string, linhaId: string, autor: AutorDBT) => boolean
  /** Ajuste rápido de ficha durante a batalha: linha "ficha" em toda cena com o personagem. */
  registrarAjuste: (personagemId: string, antes: Personagem, depois: Personagem, autor: AutorDBT) => void
  fichasLidas: (sceneKey: string) => ReadonlyMap<string, FichaLida | null>
  resumoDoFim: (sceneKey: string) => LinhaDoFimDBT[]
  /** `linhas` null = "Encerrar sem aplicar". Encerrar não se desfaz. */
  encerrar: (sceneKey: string, linhas: readonly LinhaDoFimDBT[] | null) => void
}

const MESTRE: AutorDBT = { tipo: 'mestre' }
const SEM_EFEITOS: readonly EfeitoDBT[] = []
const SEM_FICHAS: ReadonlyMap<string, FichaLida | null> = new Map()

function nucleoDe(cena: CenaDBT): NucleoDBT {
  return { fase: cena.fase, opcoes: cena.opcoes, combatentes: cena.combatentes, ordem: cena.ordem, turno: cena.turno, pendencias: cena.pendencias }
}

function nomeNoHistorico(autor: AutorDBT): string {
  return autor.tipo === 'mestre' ? NOME_DO_MESTRE : autor.nome
}

/** Nome diferente do autor: o histórico da ficha não funde o desfazer com a linha velha (e não a apaga). */
function nomeDoDesfazer(autor: AutorDBT): string {
  return `${nomeNoHistorico(autor)} (desfazer)`
}

function semACena(cenas: Readonly<Record<string, CenaDBT>>, sceneKey: string): Record<string, CenaDBT> {
  return Object.fromEntries(Object.entries(cenas).filter(([chave]) => chave !== sceneKey))
}

function contadorDeIds(agora: () => number): () => string {
  let n = 0
  return () => {
    n += 1
    return `dbt-${agora().toString(36)}-${n.toString(36)}`
  }
}

function estadoDaBatalhaDBT(
  mesa: MesaDaBatalha,
  deps: DependenciasDaBatalhaDBT,
  set: StoreApi<BatalhaDBTState>['setState'],
  get: StoreApi<BatalhaDBTState>['getState'],
): BatalhaDBTState {
  const gerarId = deps.gerarId ?? contadorDeIds(deps.agora)

  const cenaDe = (sceneKey: string): CenaDBT | undefined => (Object.hasOwn(get().cenas, sceneKey) ? get().cenas[sceneKey] : undefined)
  const gravarCena = (sceneKey: string, cena: CenaDBT): void => set({ cenas: { ...get().cenas, [sceneKey]: cena } })

  const lerFichas = (combatentes: readonly { personagemId: string | null }[]): Map<string, FichaLida | null> =>
    fichasDaCena(mesa.personagens(), mesa.sistema(), combatentes)

  /** Grava PV e PK finais pela mesa e devolve as partes que mudaram (para o Desfazer). */
  const aplicarNasFichas = (fichas: readonly { personagemId: string; pv: number; pk: number }[], autor: AutorDBT, agora: number) => {
    const sistema = mesa.sistema()
    const partesPorFicha: { personagemId: string; partes: readonly ParteDaFichaDBT[] }[] = []
    if (sistema === null) return partesPorFicha
    for (const { personagemId, pv, pk } of fichas) {
      let partes: ParteDaFichaDBT[] = []
      mesa.ajustarPersonagem(personagemId, (atual) => {
        const depois = aplicarAjustes(atual, sistema, [ajusteDoAtualDigitado(atual, 'pv', pv), ajusteDoAtualDigitado(atual, 'pk', pk)], nomeNoHistorico(autor), agora)
        partes = partesDaFichaDBT(atual, depois)
        return depois
      })
      if (partes.length > 0) partesPorFicha.push({ personagemId, partes })
    }
    return partesPorFicha
  }

  return {
    cenas: {},
    anuncio: null,

    ligar: (sceneKey, abertura = {}, inicio, outraBatalhaLigada = false) => {
      if (outraBatalhaLigada) return false
      const { cenas, anuncio } = get()
      const novo: AnuncioDaBatalhaDBT = { seq: (anuncio?.seq ?? 0) + 1, sceneKey }
      if (abertura.transicao !== undefined) novo.transicao = abertura.transicao
      if (abertura.texto !== undefined) novo.texto = abertura.texto
      if (Object.hasOwn(cenas, sceneKey)) {
        set({ anuncio: novo })
        return true
      }
      const entrantes = inicio?.entrantes ?? []
      const nucleo = nucleoInicial(entrantes, inicio?.opcoes ?? {}, lerFichas(entrantes), gerarId)
      const cena: CenaDBT = { ...nucleo, registro: [], efeitos: [], caminhos: {}, trilhas: {}, zerados: 0, rev: 0, turnosRev: 0, seq: 1 }
      const judge = inicio?.judge === undefined ? null : lerJudgeNaCena(inicio.judge)
      if (judge !== null) cena.judge = judge
      set({ cenas: { ...get().cenas, [sceneKey]: cena }, anuncio: novo })
      return true
    },

    desligar: (sceneKey) => {
      if (cenaDe(sceneKey) === undefined) return
      set({ cenas: semACena(get().cenas, sceneKey) })
    },

    ligada: (sceneKey) => Object.hasOwn(get().cenas, sceneKey),

    reset: () => set({ cenas: {}, anuncio: null }),

    zerarCaminhos: (sceneKey) => {
      const cena = cenaDe(sceneKey)
      if (cena === undefined || Object.keys(cena.caminhos).length === 0) return
      gravarCena(sceneKey, { ...cena, caminhos: {}, trilhas: {}, zerados: cena.zerados + 1, rev: cena.rev + 1 })
    },

    somarCaminho: (sceneKey, tokenId, blocos, casas = [], autor = MESTRE) => {
      const cena = cenaDe(sceneKey)
      if (cena === undefined || !Number.isFinite(blocos) || blocos <= 0) return
      const caminhos = { ...cena.caminhos, [tokenId]: (cena.caminhos[tokenId] ?? 0) + blocos }
      const trilhas = { ...cena.trilhas, [tokenId]: somarNaTrilha(cena.trilhas[tokenId] ?? [], casas) }
      gravarCena(sceneKey, { ...cena, caminhos, trilhas, rev: cena.rev + 1 })
      if (Object.hasOwn(cena.combatentes, tokenId)) get().comando(sceneKey, autor, { tipo: 'andou', tokenId, blocos })
    },

    moverJudge: (sceneKey, x, y) => {
      const cena = cenaDe(sceneKey)
      const judge = lerJudgeNaCena({ x, y })
      if (cena === undefined || judge === null) return false
      if (cena.judge !== undefined && cena.judge.x === judge.x && cena.judge.y === judge.y) return false
      gravarCena(sceneKey, { ...cena, judge, turnosRev: cena.turnosRev + 1 })
      return true
    },

    comando: (sceneKey, autor, comando) => {
      const cena = cenaDe(sceneKey)
      if (cena === undefined) return { ok: false, motivo: 'Sem batalha nesta cena' }
      // Quem entra pelo "Incluir" já precisa da ficha lida neste comando.
      const entrante = comando.tipo === 'mestre' && comando.acao.tipo === 'incluir' ? [comando.acao.entrante] : []
      const agora = deps.agora()
      const ctx: ContextoDBT = { fichas: lerFichas([...Object.values(cena.combatentes), ...entrante]), posicoes: deps.posicoes(sceneKey), rolar: deps.rolar, gerarId, agora }
      const resultado = reduzir(nucleoDe(cena), comando, autor, ctx)
      if (resultado.recusa !== undefined) return { ok: false, motivo: resultado.recusa }
      const partes = aplicarNasFichas(resultado.fichas, autor, agora)
      // A cena pode ter mudado dentro do `ajustarPersonagem` (assinantes): relê antes de gravar.
      const atual = cenaDe(sceneKey) ?? cena
      let seq = atual.seq
      let registro: readonly LinhaDBT[] = atual.registro
      if (resultado.linha !== null) {
        registro = comLinhaDBT(registro, { ...resultado.linha, id: gerarId(), seq, quando: agora, reversao: { nucleo: nucleoDe(cena), fichas: partes } })
        seq += 1
      }
      const novos = resultado.efeitos.map((efeito) => {
        const comSeq: EfeitoDBT = { ...efeito, seq }
        seq += 1
        return comSeq
      })
      const efeitos = novos.length === 0 ? atual.efeitos : [...atual.efeitos, ...novos].slice(-EFEITOS_DBT_GUARDADOS)
      gravarCena(sceneKey, { ...atual, ...resultado.nucleo, registro, efeitos, seq, turnosRev: atual.turnosRev + 1 })
      return { ok: true }
    },

    desfazer: (sceneKey, linhaId, autor) => {
      const cena = cenaDe(sceneKey)
      const linha = cena?.registro.find((candidata) => candidata.id === linhaId)
      if (cena === undefined || linha === undefined || !podeDesfazerDBT(linha, autor, cena.registro)) return false
      const sistema = mesa.sistema()
      const agora = deps.agora()
      if (sistema !== null) {
        for (const { personagemId, partes } of linha.reversao.fichas) {
          mesa.ajustarPersonagem(personagemId, (atual) => aplicarAjustes(atual, sistema, ajustesParaDesfazer(atual, partes), nomeDoDesfazer(autor), agora))
        }
      }
      const atual = cenaDe(sceneKey) ?? cena
      const registro = atual.registro.map((candidata) => (candidata.id === linhaId ? { ...candidata, desfeita: { por: nomeNoHistorico(autor), quando: agora } } : candidata))
      gravarCena(sceneKey, { ...atual, ...linha.reversao.nucleo, registro, turnosRev: atual.turnosRev + 1 })
      return true
    },

    registrarAjuste: (personagemId, antes, depois, autor) => {
      const partes = partesDaFichaDBT(antes, depois)
      if (partes.length === 0) return
      const agora = deps.agora()
      const texto = `Ajuste na ficha de ${depois.nome}: ${partes.map((parte) => `${parte.parte === 'maximo' ? 'máx. ' : ''}${parte.chave.toUpperCase()} ${parte.de} -> ${parte.para}`).join(', ')}`
      // O jogador vê o ajuste de PJ; o de NPC (PV e Ki escondidos) fica só com o mestre.
      const publico = depois.tipo === 'jogador' ? `Ajuste na ficha de ${depois.nome}` : ''
      for (const [sceneKey, cena] of Object.entries(get().cenas)) {
        const tokenIds = Object.values(cena.combatentes).filter((c) => c.personagemId === personagemId).map((c) => c.id)
        if (tokenIds.length === 0) continue
        const linha: LinhaDBT = {
          id: gerarId(),
          seq: cena.seq,
          quando: agora,
          rodada: cena.ordem.rodada,
          autor,
          tipo: 'ficha',
          texto,
          detalhes: [],
          textoPublico: publico,
          detalhesPublicos: [],
          envolve: { tokenIds, personagemIds: [personagemId] },
          comD20: false,
          reversao: { nucleo: nucleoDe(cena), fichas: [{ personagemId, partes }] },
        }
        gravarCena(sceneKey, { ...cena, registro: comLinhaDBT(cena.registro, linha), seq: cena.seq + 1, turnosRev: cena.turnosRev + 1 })
      }
    },

    fichasLidas: (sceneKey) => {
      const cena = cenaDe(sceneKey)
      return cena === undefined ? SEM_FICHAS : lerFichas(Object.values(cena.combatentes))
    },

    resumoDoFim: (sceneKey) => {
      const cena = cenaDe(sceneKey)
      return cena === undefined ? [] : resumoDoFim(nucleoDe(cena), lerFichas(Object.values(cena.combatentes)))
    },

    encerrar: (sceneKey, linhas) => {
      if (cenaDe(sceneKey) === undefined) return
      const sistema = mesa.sistema()
      const agora = deps.agora()
      for (const linha of linhas ?? []) {
        const mudanca = mudancaDoFim(linha)
        mesa.ajustarPersonagem(mudanca.personagemId, (atual) => {
          if (atual.dbt === undefined) return atual
          const comDesgaste: Personagem = { ...atual, dbt: fichaDepoisDoFim(atual.dbt, mudanca) }
          return sistema === null ? comDesgaste : aplicarAjustes(comDesgaste, sistema, [ajusteDoAtualDigitado(comDesgaste, 'pk', mudanca.pkAtual)], NOME_DO_MESTRE, agora)
        })
      }
      get().desligar(sceneKey)
    },
  }
}

export function criarBatalhaDBTStore(mesa: MesaDaBatalha, deps: DependenciasDaBatalhaDBT): UseBoundStore<StoreApi<BatalhaDBTState>> {
  return create<BatalhaDBTState>()((set, get) => estadoDaBatalhaDBT(mesa, deps, set, get))
}

export type LojaDaBatalhaDBT = ReturnType<typeof criarBatalhaDBTStore>

/**
 * As casas dos tokens da cena, só se ela é a aberta no mapa (as outras não
 * têm posição à mão: alcance e adjacência ficam com o mestre). O token é um
 * quadrado centrado em (x, y) de lado `grid * size`.
 */
function posicoesDaCenaAberta(sceneKey: string): PosicoesDaCena | null {
  const mapa = useMapStore.getState().map
  if ((useAdventureStore.getState().activeSceneId ?? mapa.id) !== sceneKey) return null
  if (!Number.isFinite(mapa.grid) || mapa.grid <= 0) return null
  const tokens = new Map<string, PosicaoNaCena>()
  for (const token of mapa.tokens) {
    const meio = (mapa.grid / 2) * token.size
    tokens.set(token.id, { col: Math.round((token.x - meio) / mapa.grid), row: Math.round((token.y - meio) / mapa.grid), tamanho: Math.max(1, Math.round(token.size)) })
  }
  return { metrosPorCasa: metrosPorCasa(mapa.scale), tokens }
}

/** A batalha DBT da mesa de verdade (aventura ou pasta). */
export const useBatalhaDBTStore: LojaDaBatalhaDBT = criarBatalhaDBTStore(mesaDaAventura, { rolar: secureRollDie, agora: Date.now, posicoes: posicoesDaCenaAberta })

export const ponteDaBatalhaDBT: PonteDaBatalhaDBT = {
  cena: (sceneKey) => useBatalhaDBTStore.getState().cenas[sceneKey] ?? null,
  comando: (sceneKey, autor, comando) => useBatalhaDBTStore.getState().comando(sceneKey, autor, comando).ok,
  desfazer: (sceneKey, linhaId, autor) => useBatalhaDBTStore.getState().desfazer(sceneKey, linhaId, autor),
  registrarAjuste: (personagemId, antes, depois, autor) => useBatalhaDBTStore.getState().registrarAjuste(personagemId, antes, depois, autor),
  fichasLidas: (sceneKey) => useBatalhaDBTStore.getState().fichasLidas(sceneKey),
}

type EstadoDaBatalhaDBT = Pick<BatalhaDBTState, 'cenas'>

/** O App avisa os jogadores quando uma cena ligou ou desligou, os caminhos zeraram ou a batalha mudou (`turnosRev`). */
export function deveAvisarJogadoresDBT(state: EstadoDaBatalhaDBT, previous: EstadoDaBatalhaDBT): boolean {
  if (state.cenas === previous.cenas) return false
  const chaves = Object.keys(state.cenas)
  if (chaves.length !== Object.keys(previous.cenas).length) return true
  for (const chave of chaves) {
    const antes = Object.hasOwn(previous.cenas, chave) ? previous.cenas[chave] : undefined
    const cena = state.cenas[chave]
    if (antes === undefined) return true
    if (antes.zerados !== cena.zerados || antes.turnosRev !== cena.turnosRev) return true
  }
  return false
}

/** O token da vez (o id do combatente É o do token); null fora de batalha ou sem vez. */
export function vezTokenIdDaCenaDBT(state: EstadoDaBatalhaDBT, sceneKey: string | null): string | null {
  if (sceneKey === null || !Object.hasOwn(state.cenas, sceneKey)) return null
  return state.cenas[sceneKey].ordem.vez
}

/** Quantas coisas esperam o mestre: pendências dele e a vez de NPC com a fila vazia. */
export function esperandoOMestreDBT(state: EstadoDaBatalhaDBT, sceneKey: string): number {
  if (!Object.hasOwn(state.cenas, sceneKey)) return 0
  const cena = state.cenas[sceneKey]
  const pendencias = cena.pendencias.filter((pendencia) => pendencia.responde.tipo === 'mestre').length
  const vez = cena.ordem.vez === null ? undefined : cena.combatentes[cena.ordem.vez]
  return pendencias + (vez?.npc === true && cena.pendencias.length === 0 ? 1 : 0)
}

/** Os efeitos da cena para a tela do mestre; fora de batalha, a MESMA lista vazia (seletor estável). */
export function efeitosDaCenaDBT(state: EstadoDaBatalhaDBT, sceneKey: string | null): readonly EfeitoDBT[] {
  if (sceneKey === null || !Object.hasOwn(state.cenas, sceneKey)) return SEM_EFEITOS
  return state.cenas[sceneKey].efeitos
}
