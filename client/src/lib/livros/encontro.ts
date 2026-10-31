import { saidasPossiveis, fatorDaSaida } from '../batalha/reacao'
import { FORCA_MAX, FORCA_MIN, forcaDe, type CartaoDaFicha, type Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import type { EstadoDaLeitura } from './saude'

/**
 * COMPARAR E BALANCEAR do mundo do livro de regras (M2,
 * docs/planos/livros-de-regras-plano.md, seção M2): as colunas do Comparar e o
 * peso do encontro (grupo x inimigos). Puro: sem store, sem disco, sem rede.
 *
 * Os números vêm SÓ de lib/batalha/formula.ts e lib/batalha/leituraDaFicha.ts
 * (e do `maximoComposto`, que já aplica a força): nunca uma cópia da conta.
 * O Comparar tem de dar o MESMO número que o menu da vez mostra na batalha.
 *
 * FASE 0 (contrato): tipos, constantes e assinaturas. Os corpos marcados
 * "provisório" devolvem o vazio honesto ("não sei") até o escritor A (contas)
 * escrever a conta de verdade.
 */

/** O veredito do encontro, do mais leve ao mais pesado. */
export type PesoDoEncontro = 'facil' | 'justo' | 'duro' | 'mortal'
/** Os botões "Deixar Fácil / Justo / Duro" (não há "Deixar Mortal"). */
export type AlvoDoPeso = Exclude<PesoDoEncontro, 'mortal'>

export const NOME_DO_PESO: Readonly<Record<PesoDoEncontro, string>> = { facil: 'Fácil', justo: 'Justo', duro: 'Duro', mortal: 'Mortal' }

/**
 * As faixas da razão (rodadas do grupo para derrubar / rodadas dos inimigos
 * para derrubar), como no protótipo: até 0,35 Fácil, até 0,7 Justo, até 1
 * Duro, acima Mortal.
 */
export const TETO_DO_PESO: Readonly<Record<AlvoDoPeso, number>> = { facil: 0.35, justo: 0.7, duro: 1 }
/** A razão que cada botão mira: o meio da faixa (protótipo, `ALVO_DO_PESO`). */
export const ALVO_DO_PESO: Readonly<Record<AlvoDoPeso, number>> = { facil: 0.25, justo: 0.55, duro: 0.85 }

/** O Comparar mostra de 2 a 4 fichas lado a lado. */
export const COMPARAR_MIN = 2
export const COMPARAR_MAX = 4

const FACES_DO_D20 = 20
/** O modificador da reação na média: o encontro estima sem saber quem reage. */
const MODIFICADOR_DA_MEDIA = 0

/**
 * Quanto de um golpe passa, na média, pela reação do alvo: cada face do d20
 * (modificador 0) com a MELHOR saída que ela libera (`saidasPossiveis`) e o
 * fator dela (`fatorDaSaida`). Dá crítico 5% x1,5 + cheio 40% x1 + metade
 * 25% x0,5 + esquiva/contra 30% x0 = 0,6. Conta, não número mágico: mudou a
 * tabela da reação, muda aqui junto.
 */
export const FATOR_DA_REACAO: number =
  Array.from({ length: FACES_DO_D20 }, (_, i) => {
    const d20 = i + 1
    // `saidasPossiveis` nunca devolve lista vazia (abaixo de 10 é ['cheio']).
    return fatorDaSaida(saidasPossiveis(d20, d20 + MODIFICADOR_DA_MEDIA)[0])
  }).reduce((soma, fator) => soma + fator, 0) / FACES_DO_D20

/** Um golpe da ficha com o dano que a fórmula dá agora (força já aplicada). */
export interface GolpeDaFicha {
  /** A técnica; `null` = o Atacar ("Força + Dano da arma", `danoDoAtaque`). */
  cartao: CartaoDaFicha | null
  nome: string
  /** Vem de transformação ligada: o nome da forma. */
  forma?: string
  /** O dano lido; `null` quando a leitura não fecha (Na hora, À mão, Não lê). */
  valor: number | null
  /** A conta à vista ("188 x1,5 = 282"), ou o texto da ficha quando não lê. */
  conta: string
  /** Como a leitura saiu: "Na hora", "À mão" e "Não lê" aparecem em cinza. */
  estado: EstadoDaLeitura
}

/** Um número da ficha com atual e máximo (HP, SP); `null` na coluna = o sistema não tem. */
export interface AtualEMaximo {
  atual: number
  /** Com a força (HP do NPC) e os modificadores: `maximoComposto`. */
  maximo: number
}

export interface AtributoDaColuna {
  id: string
  nome: string
  abreviacao: string
  /** O TOTAL (`valorDoRank`). */
  valor: number
  /** "R7"; `null` = o atributo não tem tabela de rank. */
  rank: string | null
}

/** Uma coluna do Comparar. */
export interface ColunaDaComparacao {
  personagemId: string
  nome: string
  tipo: Personagem['tipo']
  /** A força do NPC (`forcaDe`); 1 para jogador. */
  forca: number
  hp: AtualEMaximo | null
  sp: AtualEMaximo | null
  /** O Escudo (um número só); `null` = o sistema não tem. */
  escudo: number | null
  atributos: AtributoDaColuna[]
  golpes: GolpeDaFicha[]
}

/** Um lado do encontro somado. */
export interface LadoDoEncontro {
  /** HP máximo + Escudo de todos (inimigo repetido conta N vezes). */
  vida: number
  /** Soma do melhor golpe de cada um x `FATOR_DA_REACAO`. */
  danoPorRodada: number
  /** Rodadas para ESTE lado derrubar o outro; `Infinity` = nunca (sem dano). */
  rodadasParaDerrubar: number
}

export interface ResultadoDoEncontro {
  grupo: LadoDoEncontro
  inimigos: LadoDoEncontro
  /** Rodadas do grupo / rodadas dos inimigos; 0 quando os inimigos nunca derrubam o grupo. */
  razao: number
  /** `null` = falta um dos lados (grupo vazio ou nenhum inimigo). */
  peso: PesoDoEncontro | null
  /** Fichas do encontro sem golpe que a ficha paga: não somam dano (a tela avisa). */
  semGolpe: string[]
}

/** O que "Deixar Fácil / Justo / Duro" muda: a força nova de cada NPC inimigo e a de antes (para o Desfazer). */
export interface AjusteDoPeso {
  /** Id do NPC -> força nova (já no passo e na faixa). */
  forcas: Record<string, number>
  /** Id do NPC -> força de antes. */
  antes: Record<string, number>
  /** Algum bateu em `FORCA_MIN` ou `FORCA_MAX`: o aviso pede para mudar o número de inimigos. */
  noLimite: boolean
}

/**
 * O maior dano que a ficha consegue pagar: entre as técnicas que valem agora
 * (`tecnicasComForma`: sem forma desligada), fora OVERLOAD (`ehOverload`), com
 * custo que cabe no SP máximo, e o Atacar. Já com a força (vem do `lerDano`).
 * `null` = nenhum golpe lê número.
 *
 * Provisório (fase 0): devolve `null` até o escritor A.
 */
export function melhorGolpe(_personagem: Personagem, _sistema: SistemaDeRpg): GolpeDaFicha | null {
  return null
}

/**
 * A coluna do Comparar: recursos (HP com a força), atributos com rank e cada
 * golpe com o dano que a fórmula dá agora.
 *
 * Provisório (fase 0): só nome, tipo e força; números vazios até o escritor A.
 */
export function colunaDaComparacao(personagem: Personagem, _sistema: SistemaDeRpg): ColunaDaComparacao {
  return { personagemId: personagem.id, nome: personagem.nome, tipo: personagem.tipo, forca: forcaDe(personagem), hp: null, sp: null, escudo: null, atributos: [], golpes: [] }
}

/**
 * O peso do encontro: vida = HP máximo + Escudo; dano por rodada = melhor
 * golpe x `FATOR_DA_REACAO`; razão = rodadas do grupo / rodadas dos inimigos;
 * veredito pelas faixas de `TETO_DO_PESO`. Id que não está em `personagens`
 * é ignorado; quantidade 0 ou menos não conta.
 *
 * Provisório (fase 0): sem veredito até o escritor A.
 */
export function pesoDoEncontro(
  _grupo: readonly string[],
  _inimigos: Readonly<Record<string, number>>,
  _personagens: readonly Personagem[],
  _sistema: SistemaDeRpg,
): ResultadoDoEncontro {
  const vazio: LadoDoEncontro = { vida: 0, danoPorRodada: 0, rodadasParaDerrubar: Infinity }
  return { grupo: vazio, inimigos: vazio, razao: 0, peso: null, semGolpe: [] }
}

/** O veredito de uma razão pelas faixas. Razão não finita (ou negativa) não é veredito. */
export function pesoDaRazao(razao: number): PesoDoEncontro | null {
  if (!Number.isFinite(razao) || razao < 0) return null
  if (razao <= TETO_DO_PESO.facil) return 'facil'
  if (razao <= TETO_DO_PESO.justo) return 'justo'
  if (razao <= TETO_DO_PESO.duro) return 'duro'
  return 'mortal'
}

/**
 * A força que leva a razão de agora ao alvo: força x raiz(alvo / razão) —
 * raiz porque a força mexe no HP e no dano ao mesmo tempo. Arredondada ao
 * passo (0,05) e presa em `FORCA_MIN`..`FORCA_MAX`. Razão 0 (ou não finita):
 * não há para onde ir, devolve a força de agora.
 *
 * Provisório (fase 0): devolve a força de agora até o escritor A.
 */
export function forcaParaOPeso(forca: number, _alvo: AlvoDoPeso, _razao: number): number {
  return forca
}

/**
 * "Deixar Fácil / Justo / Duro": a força nova de cada NPC entre os inimigos
 * (jogador na lista de inimigos não muda). A tela grava com `trocarForca`
 * (lib/livros/combate.ts) pelo `mundo.mudar`, e o Desfazer volta `antes`.
 *
 * Provisório (fase 0): nada muda até o escritor A.
 */
export function ajusteDoPeso(
  _inimigos: Readonly<Record<string, number>>,
  _personagens: readonly Personagem[],
  _sistema: SistemaDeRpg,
  _alvo: AlvoDoPeso,
): AjusteDoPeso {
  return { forcas: {}, antes: {}, noLimite: false }
}

/** A força bateu numa ponta da faixa? (o aviso do "Deixar ...") */
export function forcaNoLimite(forca: number): boolean {
  return forca <= FORCA_MIN || forca >= FORCA_MAX
}
