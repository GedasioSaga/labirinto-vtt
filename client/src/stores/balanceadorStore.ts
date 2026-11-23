import { create } from 'zustand'
import type { BalancoDaSerie, BotaoDoAjuste, LutasPorTeste, PropostaDoAchar } from '../lib/treino/balanceadorComum'
import { VAGAS_POR_LADO_MAX, type LadoDoTreino } from '../lib/treino/mesaEmMemoria'

/**
 * O ESTADO DE SESSÃO DO "COMPARAR E BALANCEAR" (docs/design/balanceamento/):
 * os dois lados montados, a meta, o último teste e a última proposta. Fica
 * enquanto o app está aberto (trocar de página no livro não perde a mesa);
 * não vai a disco, como o protótipo ("recarregar volta ao começo").
 */

/** Uma ficha num lado, com as cópias ("3 Lobos"). */
export interface FichaNoLado {
  id: string
  n: number
}

export type AbaDoBalanceador = 'testar' | 'comparar'

export interface MetaDoBalanceador {
  usarTurnos: boolean
  turnos: string
  usarVitoria: boolean
  /** Em %, como o campo mostra. */
  vitoria: string
}

/** Um resultado guardado com a montagem que o gerou: montagem diferente = resultado velho. */
export interface Guardado<T> {
  valor: T
  chave: string
  ms: number
}

/** A proposta com o que ela ajusta (o alvo e a ficha de origem) e a meta pedida. */
export interface PropostaGuardada {
  proposta: PropostaDoAchar
  alvos: readonly string[]
  turnos: number | null
  vitoria: number | null
}

export interface EstadoDoBalanceador {
  aba: AbaDoBalanceador
  lados: Record<LadoDoTreino, FichaNoLado[]>
  ladoDoClique: LadoDoTreino
  meta: MetaDoBalanceador
  /** Ficha de origem do inimigo a ajustar, ou "todos". */
  alvo: string
  botoes: Record<BotaoDoAjuste, boolean>
  nLutas: LutasPorTeste
  semente: number
  balanco: Guardado<BalancoDaSerie> | null
  proposta: Guardado<PropostaGuardada> | null
  /** A coluna base do "Comparar fichas" (o id da ficha); `null` = a primeira. */
  baseDoComparar: string | null
  soDiferencas: boolean
  trocarAba: (aba: AbaDoBalanceador) => void
  mudarComparar: (mudanca: Partial<Pick<EstadoDoBalanceador, 'baseDoComparar' | 'soDiferencas'>>) => void
  /** Põe uma cópia no lado (respeita `VAGAS_POR_LADO_MAX`, contando as cópias); `false` = o lado estava cheio. */
  por: (id: string, lado: LadoDoTreino) => boolean
  quantas: (id: string, lado: LadoDoTreino, n: number) => void
  tirar: (id: string, lado: LadoDoTreino) => void
  trocarDeLado: (id: string, lado: LadoDoTreino) => void
  /** Troca uma ficha por outra no mesmo lugar (a variação nova no lugar do original). */
  substituir: (de: string, para: string) => void
  marcarLadoDoClique: (lado: LadoDoTreino) => void
  mudarMeta: (meta: Partial<MetaDoBalanceador>) => void
  mudarAlvo: (alvo: string) => void
  alternarBotao: (botao: BotaoDoAjuste) => void
  mudarNLutas: (n: LutasPorTeste) => void
  novaSemente: () => void
  guardarBalanco: (guardado: Guardado<BalancoDaSerie> | null) => void
  guardarProposta: (guardado: Guardado<PropostaGuardada> | null) => void
}

export const ALVO_TODOS = 'todos'
/** A semente inicial de cada sessão (a mesma semente dá as mesmas lutas). */
const SEMENTE_INICIAL = 2026
const SEMENTE_MAX = 0xffffffff

export function vagasNoLado(lado: readonly FichaNoLado[]): number {
  return lado.reduce((soma, ficha) => soma + ficha.n, 0)
}

/** A chave da montagem: muda quando o lado, as cópias ou a semente mudam. */
export function chaveDaMontagem(lados: Record<LadoDoTreino, readonly FichaNoLado[]>, semente: number, extra = ''): string {
  const lado = (fichas: readonly FichaNoLado[]) => fichas.map((ficha) => `${ficha.id}x${ficha.n}`).join(',')
  return `${lado(lados.a)}|${lado(lados.b)}|${semente}|${extra}`
}

function semAFicha(lado: readonly FichaNoLado[], id: string): FichaNoLado[] {
  return lado.filter((ficha) => ficha.id !== id)
}

export const useBalanceadorStore = create<EstadoDoBalanceador>()((set, get) => ({
  aba: 'testar',
  lados: { a: [], b: [] },
  ladoDoClique: 'a',
  meta: { usarTurnos: true, turnos: '10', usarVitoria: false, vitoria: '70' },
  alvo: ALVO_TODOS,
  botoes: { hp: true, escudo: false, dano: false, atributos: false },
  nLutas: 100,
  semente: SEMENTE_INICIAL,
  balanco: null,
  proposta: null,
  baseDoComparar: null,
  soDiferencas: false,
  trocarAba: (aba) => set({ aba }),
  mudarComparar: (mudanca) => set(mudanca),
  por: (id, lado) => {
    const { lados } = get()
    if (vagasNoLado(lados[lado]) >= VAGAS_POR_LADO_MAX) return false
    const outro: LadoDoTreino = lado === 'a' ? 'b' : 'a'
    const ja = lados[lado].find((ficha) => ficha.id === id)
    const noLado = ja === undefined ? [...lados[lado], { id, n: 1 }] : lados[lado].map((ficha) => (ficha.id === id ? { ...ficha, n: ficha.n + 1 } : ficha))
    // A mesma ficha não luta dos dois lados: pôr num lado tira do outro.
    set({ lados: { ...lados, [lado]: noLado, [outro]: semAFicha(lados[outro], id) } })
    return true
  },
  quantas: (id, lado, n) => {
    const { lados } = get()
    const outras = vagasNoLado(lados[lado]) - (lados[lado].find((ficha) => ficha.id === id)?.n ?? 0)
    const limitado = Math.max(0, Math.min(n, VAGAS_POR_LADO_MAX - outras))
    const noLado = limitado === 0 ? semAFicha(lados[lado], id) : lados[lado].map((ficha) => (ficha.id === id ? { ...ficha, n: limitado } : ficha))
    set({ lados: { ...lados, [lado]: noLado } })
  },
  tirar: (id, lado) => {
    const { lados } = get()
    set({ lados: { ...lados, [lado]: semAFicha(lados[lado], id) } })
  },
  trocarDeLado: (id, lado) => {
    const { lados } = get()
    const ficha = lados[lado].find((item) => item.id === id)
    if (ficha === undefined) return
    const outro: LadoDoTreino = lado === 'a' ? 'b' : 'a'
    const cabem = VAGAS_POR_LADO_MAX - vagasNoLado(lados[outro])
    if (cabem <= 0) return
    const ja = lados[outro].find((item) => item.id === id)
    const n = Math.min(ficha.n, cabem)
    const noOutro = ja === undefined ? [...lados[outro], { id, n }] : lados[outro].map((item) => (item.id === id ? { ...item, n: Math.min(VAGAS_POR_LADO_MAX, item.n + n) } : item))
    set({ lados: { ...lados, [lado]: semAFicha(lados[lado], id), [outro]: noOutro } })
  },
  substituir: (de, para) => {
    const { lados, alvo } = get()
    const trocar = (lado: readonly FichaNoLado[]) => lado.map((ficha) => (ficha.id === de ? { ...ficha, id: para } : ficha))
    set({ lados: { a: trocar(lados.a), b: trocar(lados.b) }, alvo: alvo === de ? para : alvo })
  },
  marcarLadoDoClique: (lado) => set({ ladoDoClique: lado }),
  mudarMeta: (meta) => set({ meta: { ...get().meta, ...meta } }),
  mudarAlvo: (alvo) => set({ alvo }),
  alternarBotao: (botao) => set({ botoes: { ...get().botoes, [botao]: !get().botoes[botao] } }),
  mudarNLutas: (n) => set({ nLutas: n }),
  novaSemente: () => set({ semente: (Math.imul(get().semente ^ 0x9e3779b9, 0x85ebca6b) >>> 0) % SEMENTE_MAX }),
  guardarBalanco: (guardado) => set({ balanco: guardado }),
  guardarProposta: (guardado) => set({ proposta: guardado }),
}))
