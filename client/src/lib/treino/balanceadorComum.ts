import { maximoComposto } from '../ajusteDaFicha'
import { FORCA_MAX, FORCA_MIN, forcaDe, forcaNoPasso, numeroDaFicha, type Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { recursoDeVida } from '../vidaDaFicha'
import type { LadoDoTreino, LutadoresDoTreino } from './mesaEmMemoria'

/**
 * O BALANCEADOR DE "COMPARAR E BALANCEAR" (docs/design/balanceamento/NOTAS.md):
 * o que a página e o worker dividem — os tipos do pedido e da resposta, o
 * ajuste de uma ficha (HP, Escudo, Dano, Atributos) e as contas de
 * estatística. Sem o motor da luta: a página importa este arquivo sem levar a
 * batalha para o pacote dela (o motor fica em `balanceador.ts`, no worker).
 */

/** Quantas lutas um teste pode ter (o seletor "Lutas por teste"). */
export const LUTAS_POR_TESTE = [100, 200, 500] as const // `as const`: a tupla de literais vira o tipo `LutasPorTeste`, não é cast
export type LutasPorTeste = (typeof LUTAS_POR_TESTE)[number]

/** Lutas por tentativa do resolvedor: o motor de verdade é ~100x mais lento que o do protótipo (NOTAS.md, "Velocidade"). */
export const LUTAS_POR_TENTATIVA = 40
/** Lutas novas da conferência. */
export const LUTAS_DA_CONFERENCIA = 200

/** Os botões do "Achar os números": o HP vem ligado; os outros, só se o mestre ligar. */
export type BotaoDoAjuste = 'hp' | 'escudo' | 'dano' | 'atributos'
export const BOTOES_DO_AJUSTE: readonly BotaoDoAjuste[] = ['hp', 'escudo', 'dano', 'atributos']
export const NOME_DO_BOTAO: Readonly<Record<BotaoDoAjuste, string>> = { hp: 'HP', escudo: 'Escudo', dano: 'Dano', atributos: 'Atributos' }

/**
 * O ajuste do resolvedor sobre uma ficha: HP × `hp` (o máximo de hoje, com a
 * força), Escudo + `escudo`, dano × `dano` (pela força do NPC, de ×0,5 a ×2)
 * e cada atributo × `atributos`.
 */
export interface AjusteDaFicha {
  hp: number
  escudo: number
  dano: number
  atributos: number
}

export const AJUSTE_NEUTRO: Readonly<AjusteDaFicha> = { hp: 1, escudo: 0, dano: 1, atributos: 1 }

/** O HP sai de 10 em 10, como o protótipo arredonda. */
const HP_EM_PASSOS_DE = 10
const HP_MINIMO = 10
/** O máximo composto cresce com a base: 4 correções chegam ao alvo dentro do arredondamento. */
const CORRECOES_DO_HP = 4

function ajusteNeutro(ajuste: AjusteDaFicha): boolean {
  return ajuste.hp === 1 && ajuste.escudo === 0 && ajuste.dano === 1 && ajuste.atributos === 1
}

/** O Escudo do sistema (One Piece: `escudo`); `null` = o sistema não tem. */
export function idDoEscudo(sistema: SistemaDeRpg | null): string | null {
  return sistema?.recursos.find((recurso) => recurso.id === 'escudo')?.id ?? null
}

/** O HP máximo da ficha como a batalha lê (força e modificadores); `null` = o sistema não tem HP. */
export function hpMaximo(personagem: Personagem, sistema: SistemaDeRpg | null): number | null {
  const vida = recursoDeVida(sistema)
  return vida === null ? null : maximoComposto(personagem, vida.id).total
}

/** O Escudo de agora (0 sem Escudo no sistema). */
export function escudoDe(personagem: Personagem, sistema: SistemaDeRpg | null): number {
  const id = idDoEscudo(sistema)
  return id === null ? 0 : Math.max(0, numeroDaFicha(personagem.recursos, id))
}

/** De quanto a força pode multiplicar o dano a partir da de hoje: [mínimo, máximo]. Jogador não tem força: [1, 1]. */
export function faixaDoDano(personagem: Personagem): [number, number] {
  if (personagem.tipo !== 'npc') return [1, 1]
  const hoje = forcaDe(personagem)
  return [FORCA_MIN / hoje, FORCA_MAX / hoje]
}

/**
 * A ficha com o ajuste, para lutar ou para virar variação: a força nova (o
 * dano), os atributos multiplicados, o HP máximo levado a `hoje × hp` (a base
 * é recalculada porque a força também multiplica o HP) e cheio, e o Escudo
 * somado. Ajuste neutro devolve a MESMA ficha. A ficha recebida não muda.
 */
export function ajustarFicha(personagem: Personagem, ajuste: AjusteDaFicha, sistema: SistemaDeRpg | null): Personagem {
  if (ajusteNeutro(ajuste)) return personagem
  let copia: Personagem = { ...personagem }
  if (ajuste.dano !== 1 && personagem.tipo === 'npc') copia.combate = { ...personagem.combate, forca: forcaNoPasso(forcaDe(personagem) * ajuste.dano) }
  if (ajuste.atributos !== 1) {
    copia.atributos = Object.fromEntries(Object.entries(personagem.atributos).map(([id, valor]) => [id, Math.round(valor * ajuste.atributos)]))
  }
  const vida = recursoDeVida(sistema)
  if (vida !== null) {
    const hoje = maximoComposto(personagem, vida.id).total
    const alvo = Math.max(HP_MINIMO, Math.round((hoje * ajuste.hp) / HP_EM_PASSOS_DE) * HP_EM_PASSOS_DE)
    let base = personagem.maximos[vida.id] ?? numeroDaFicha(personagem.recursos, vida.id)
    for (let i = 0; i < CORRECOES_DO_HP && base > 0; i += 1) {
      const lido = maximoComposto({ ...copia, maximos: { ...copia.maximos, [vida.id]: Math.round(base) } }, vida.id).total
      if (lido === alvo || lido <= 0) break
      base = (base * alvo) / lido
    }
    copia.maximos = { ...copia.maximos, [vida.id]: Math.max(1, Math.round(base)) }
    copia = { ...copia, recursos: { ...copia.recursos, [vida.id]: maximoComposto(copia, vida.id).total } }
  }
  const escudo = idDoEscudo(sistema)
  if (ajuste.escudo !== 0 && escudo !== null) {
    const novo = Math.max(0, Math.round((numeroDaFicha(personagem.recursos, escudo) + ajuste.escudo) / HP_EM_PASSOS_DE) * HP_EM_PASSOS_DE)
    copia.recursos = { ...copia.recursos, [escudo]: novo }
  }
  return copia
}

/** Os lutadores com o ajuste nas cópias cujas fichas de origem estão em `alvos`. */
export function ajustarLutadores(lutadores: LutadoresDoTreino, alvos: ReadonlySet<string>, ajuste: AjusteDaFicha, sistema: SistemaDeRpg | null): LutadoresDoTreino {
  if (ajusteNeutro(ajuste)) return lutadores
  const ajustadas = new Set(lutadores.vagas.filter((vaga) => alvos.has(vaga.origem)).map((vaga) => vaga.personagemId))
  return {
    vagas: lutadores.vagas,
    personagens: lutadores.personagens.map((personagem) => (ajustadas.has(personagem.id) ? ajustarFicha(personagem, ajuste, sistema) : personagem)),
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Estatística
// ───────────────────────────────────────────────────────────────────────────

/**
 * A mediana "suavizada" dentro do turno (40% das lutas em 2 e 45% em 3 dá
 * 2,7): o resolvedor persegue este número. Com a média, a meta de 10 saía com
 * mediana 9 (NOTAS.md, "O resolvedor").
 */
export function medianaSuave(ordenados: readonly number[]): number {
  const n = ordenados.length
  if (n === 0) return 0
  const meio = n / 2
  let i = 0
  while (i < n) {
    const valor = ordenados[i]
    let j = i
    while (j < n && ordenados[j] === valor) j += 1
    if (j >= meio) return valor - 0.5 + (meio - i) / (j - i)
    i = j
  }
  return ordenados[n - 1]
}

/** O quantil `q` (0 a 1) da lista ordenada, pelo vizinho mais perto. */
export function quantil(ordenados: readonly number[], q: number): number {
  if (ordenados.length === 0) return 0
  const indice = Math.min(ordenados.length - 1, Math.max(0, Math.round(q * (ordenados.length - 1))))
  return ordenados[indice]
}

/** O intervalo de Wilson com 95% de certeza para a proporção `p` em `n` lutas. */
export function wilson(p: number, n: number): [number, number] {
  if (n <= 0) return [0, 1]
  const z = 1.96
  const den = 1 + (z * z) / n
  const centro = (p + (z * z) / (2 * n)) / den
  const meio = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / den
  return [Math.max(0, centro - meio), Math.min(1, centro + meio)]
}

// ───────────────────────────────────────────────────────────────────────────
// O pedido e a resposta
// ───────────────────────────────────────────────────────────────────────────

/** Uma vaga no balanço: as médias por luta. */
export interface VagaNoBalanco {
  vaga: string
  lado: LadoDoTreino
  /** A ficha de onde a cópia veio. */
  origem: string
  nome: string
  hpMaximo: number
  spMaximo: number
  danoCausado: number
  danoSofrido: number
  cura: number
  spGasto: number
  /** Parte das lutas em que caiu (0 a 1) e a rodada média da queda. */
  caiu: number
  caiuNaRodada: number
  /** Parte das lutas em que foi a primeira a cair. */
  primeiro: number
  /** Parte das lutas em que ficou sem SP e a rodada média. */
  semSp: number
  semSpNaRodada: number
  /** A técnica que mais usou e quantas vezes por luta; `null` = não usou nada. */
  maisUsada: { nome: string; vezes: number } | null
}

export interface TecnicaNoBalanco {
  nome: string
  lado: LadoDoTreino
  /** O nome de quem usa (a cópia). */
  quem: string
  /** Vezes por luta, em média. */
  vezes: number
}

/** Quantas lutas acabaram neste turno, por quem venceu. */
export interface TurnoNoHistograma {
  turno: number
  a: number
  b: number
  empate: number
}

export interface LutaTipica {
  semente: number
  rodada: number
  vencedor: LadoDoTreino | null
  registro: readonly string[]
}

export interface BalancoDaSerie {
  n: number
  semente: number
  vitorias: { a: number; b: number; empate: number }
  /** Empates pelo teto de rodadas ou de passos. */
  noTeto: number
  mediana: number
  media: number
  q25: number
  q75: number
  p10: number
  p90: number
  histograma: readonly TurnoNoHistograma[]
  /** Média de vagas de pé no fim, de cada lado. */
  dePe: { a: number; b: number }
  vagas: readonly VagaNoBalanco[]
  tecnicas: readonly TecnicaNoBalanco[]
  tipica: LutaTipica | null
}

/** A meta do "Achar os números". */
export interface MetaDoAchar {
  /** Mediana de turnos pedida; `null` = sem meta de duração. */
  turnos: number | null
  /** Vitória dos aliados pedida (0 a 1); `null` = sem meta de vitória. */
  vitoria: number | null
}

export interface TentativaDoAchar {
  botao: BotaoDoAjuste
  meta: 'turnos' | 'vitoria'
  ajuste: AjusteDaFicha
  /** A mediana de turnos (meta de duração) ou a vitória dos aliados (0 a 1). */
  valor: number
}

export type AvisoDoAchar =
  | { tipo: 'limiteTurnos'; botao: BotaoDoAjuste }
  | { tipo: 'limiteVitoria'; botao: BotaoDoAjuste }
  /** Meta de vitória sem botão de ameaça (Dano ou Atributos): só a duração foi perseguida. */
  | { tipo: 'semAmeaca' }

export interface ConferenciaDoAchar {
  n: number
  mediana: number
  q25: number
  q75: number
  vitoria: number
  vitoriaMin: number
  vitoriaMax: number
}

export interface PropostaDoAchar {
  ajuste: AjusteDaFicha
  tentativas: readonly TentativaDoAchar[]
  /** A luta de hoje (a primeira medida). */
  hoje: { mediana: number; vitoria: number }
  conferencia: ConferenciaDoAchar
  avisos: readonly AvisoDoAchar[]
}

/** Um passo do progresso: lutas feitas, total previsto e a frase da fase ("Tentativa 3: HP ×2,45 dá 9,6 turnos"). */
export type AvisoDoBalanceador = (feitas: number, total: number, fase: string) => void
