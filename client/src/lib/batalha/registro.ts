import { NOME_DO_MESTRE } from '../ajusteDaFicha'
import type { ParteDoAjuste } from '../personagem'
import type { RegrasDaBatalha } from './regrasDoCampo'
import type { AcoesExtras, AutorDaAcao, CartaDaOrdem, GastoDaVez, TurnosDaCena } from './turnos'

/**
 * REGISTRO DA BATALHA (decisão 5 de docs/planos/batalha-one-piece-2026-10-30.md):
 * cada coisa que muda na batalha vira uma linha com Desfazer. O mestre desfaz
 * qualquer linha; o jogador, só a dele e só durante a vez dele. A linha
 * desfeita FICA, riscada, com quem desfez — e não se desfaz de novo.
 *
 * Cada linha guarda o que precisa para voltar (`Reversao`). A ficha volta por
 * DELTA sobre o valor de agora, nunca pelo personagem inteiro de antes: isso
 * apagaria o que mudou depois (outro golpe, a ficha editada pelo jogador).
 *
 * Mora na sessão do mestre (`stores/batalhaStore.ts`); ao jogador sai só o
 * recorte de `registroParaJogador`. Os tipos da F2 (golpe, reação, dano,
 * ações gastas e extras) já estão aqui para a tela e o Desfazer não mudarem
 * de forma quando ela chegar; a F1 só escreve os da primeira linha.
 *
 * Puro: sem store, sem rede.
 */

export type TipoDaLinha =
  // F1
  | 'vez' | 'ordem' | 'cartaExtra' | 'combatente' | 'equipe' | 'ficha' | 'regras' | 'desempate'
  // F2: a F1 nunca escreve; a tela já sabe mostrar.
  | 'acao' | 'golpe' | 'reacao' | 'dano' | 'habilidade' | 'acoesExtras' | 'transformacao'

/** Um número da ficha que a linha mudou, de quanto para quanto. Cartão: 1 = ligado, 0 = desligado. */
export interface ParteDaFicha {
  parte: Extract<ParteDoAjuste, 'recurso' | 'maximo' | 'cartao'>
  chave: string
  de: number
  para: number
}

/** O que o Desfazer precisa para voltar a linha. */
export type Reversao =
  /** Passar a vez: a vez e a rodada de antes, as extras "só nesta rodada" que saíram (com o lugar) e os gastos zerados. */
  | {
      tipo: 'vez'
      antes: {
        vez: string | null
        rodada: number
        removidas: readonly { carta: CartaDaOrdem; indice: number }[]
        gastos: TurnosDaCena['gastos']
      }
    }
  /** Mover, Ordenar, desempate: os ids na ordem de antes. Desfazer reaplica às cartas que ainda existem. */
  | { tipo: 'ordem'; antes: readonly string[] }
  /** Carta extra ou combatente que entrou: desfazer = tirar. */
  | { tipo: 'cartaNova'; cartaId: string }
  /** Carta que saiu: desfazer = pôr de volta no mesmo lugar. */
  | { tipo: 'cartaRemovida'; carta: CartaDaOrdem; indice: number }
  | { tipo: 'equipe'; personagemId: string; antes: string | null; depois: string | null }
  | { tipo: 'ficha'; personagemId: string; partes: readonly ParteDaFicha[] }
  | { tipo: 'regras'; antes: RegrasDaBatalha | null }
  /** F2: ações gastas na vez (Simples, Movimento, Bônus). `null` = não tinha gasto nenhum. */
  | { tipo: 'gasto'; cartaId: string; antes: GastoDaVez | null }
  /** F2: ações extras dadas pelo mestre. `null` = não tinha extra. */
  | { tipo: 'acoesExtras'; cartaId: string; antes: AcoesExtras | null }
  /** F2: um golpe = a ficha de N alvos + o gasto de quem atacou, desfeitos juntos. */
  | { tipo: 'composta'; partes: readonly Reversao[] }

export interface LinhaDoRegistro {
  id: string
  /** Sobe de 1 em 1 na batalha: a ordem das linhas, mesmo com o relógio igual. */
  seq: number
  /** `Date.now()` do host. */
  quando: number
  rodada: number
  autor: AutorDaAcao
  tipo: TipoDaLinha
  /** Montado com nomes, no máximo `REGISTRO_TEXTO_MAX`. O do mestre pode ter número de NPC: nunca sai a jogador sem passar pelo recorte. */
  texto: string
  /** Quem a linha toca, para o recorte do jogador. Vazio = a linha não fala de ninguém (regras). */
  envolve: { tokenIds: readonly string[]; personagemIds: readonly string[] }
  reversao: Reversao
  /** Desfeita: o nome de quem desfez ("Mestre" ou o do jogador) e quando. */
  desfeita?: { por: string; quando: number }
}

/** A linha como o jogador a recebe: sem reversão, sem ids de quem ele não vê. Desfazer só vale com `podeDesfazer`. */
export interface LinhaParaJogador {
  id: string
  rodada: number
  /** "Mestre" ou o nome do jogador na mesa. */
  autor: string
  texto: string
  desfeita?: { por: string }
  podeDesfazer: boolean
}

/** Linhas guardadas por batalha: passou, as mais velhas saem. */
export const REGISTRO_MAX = 300
/** Quantas linhas o jogador recebe: as mais novas. */
export const REGISTRO_PARA_JOGADOR_MAX = 50
/** Teto do texto de uma linha (cortado ao montar; o fio recusa acima disso). */
export const REGISTRO_TEXTO_MAX = 200
/** Teto do nome de quem fez ou desfez, no fio. */
export const AUTOR_NO_REGISTRO_MAX = 80

/** Os tipos de linha que o JOGADOR desfaz (na vez dele, só as dele). A F2 soma 'acao', 'golpe', 'reacao'... */
export const TIPOS_QUE_O_JOGADOR_DESFAZ: ReadonlySet<TipoDaLinha> = new Set<TipoDaLinha>(['ficha'])

/** Quem pede o Desfazer: o mestre, ou o jogador desta conexão. O nome não decide nada. */
export type QuemDesfaz = { tipo: 'mestre' } | { tipo: 'jogador'; playerId: string }

/**
 * A linha pode ser desfeita por `quem`? Desfeita nunca. O mestre, qualquer
 * outra. O jogador, só a que ele fez, de tipo permitido, e só quando é a vez
 * dele (`vezDoJogador`: a carta da vez é de ficha dele).
 */
export function podeDesfazer(linha: LinhaDoRegistro, quem: QuemDesfaz, vezDoJogador: boolean): boolean {
  if (linha.desfeita !== undefined) return false
  if (quem.tipo === 'mestre') return true
  return (
    vezDoJogador &&
    linha.autor.tipo === 'jogador' &&
    linha.autor.playerId === quem.playerId &&
    TIPOS_QUE_O_JOGADOR_DESFAZ.has(linha.tipo)
  )
}

/** Quem fez ou desfez sem nome (não deveria acontecer: a mesa exige nome na entrada). */
const AUTOR_SEM_NOME = 'Jogador'

/** O nome do autor como aparece na linha. */
export function nomeDoAutor(autor: AutorDaAcao): string {
  return autor.tipo === 'mestre' ? NOME_DO_MESTRE : autor.nome
}

/** O nome no teto do fio e nunca vazio: o fio recusa autor vazio e derrubaria o estado inteiro. */
function nomeNoFio(nome: string): string {
  return nome.trim().slice(0, AUTOR_NO_REGISTRO_MAX) || AUTOR_SEM_NOME
}

/** O que o recorte do registro precisa saber do jogador. */
export interface ContextoDoRegistro {
  playerId: string
  /** É a vez dele agora (acende o Desfazer). */
  minhaVez: boolean
  /** Os tokens que a tela dele tem agora. */
  tokensNoRecorte: ReadonlySet<string>
  /** Os personagens dele e os dos aliados (`aliadosDe`). */
  personagensVisiveis: ReadonlySet<string>
  /** Os personagens de tipo NPC: linha de ficha que toca um deles nunca sai. */
  npcs: ReadonlySet<string>
}

function linhaVisivel(linha: LinhaDoRegistro, ctx: ContextoDoRegistro): boolean {
  const { tokenIds, personagemIds } = linha.envolve
  if (!tokenIds.every((id) => ctx.tokensNoRecorte.has(id))) return false
  if (!personagemIds.every((id) => ctx.personagensVisiveis.has(id))) return false
  // Ficha de NPC é número que o jogador nunca vê (decisão 1), nem a do NPC que ele controla.
  return linha.tipo !== 'ficha' || !personagemIds.some((id) => ctx.npcs.has(id))
}

/**
 * O registro como o jogador o vê: só as linhas cujas fichas estão todas no
 * recorte dele e cujos personagens são dele ou de aliado; nunca a de ficha de
 * NPC. As `REGISTRO_PARA_JOGADOR_MAX` mais novas, na mesma ordem do registro
 * (da mais velha à mais nova): a tela inverte se quiser a mais nova em cima.
 */
export function registroParaJogador(linhas: readonly LinhaDoRegistro[], ctx: ContextoDoRegistro): LinhaParaJogador[] {
  const quem: QuemDesfaz = { tipo: 'jogador', playerId: ctx.playerId }
  const saem: LinhaParaJogador[] = []
  // De trás para a frente: para nas 50 mais novas sem varrer as 300.
  for (let i = linhas.length - 1; i >= 0 && saem.length < REGISTRO_PARA_JOGADOR_MAX; i -= 1) {
    const linha = linhas[i]
    if (linha === undefined || !linhaVisivel(linha, ctx)) continue
    const paraJogador: LinhaParaJogador = {
      id: linha.id,
      rodada: linha.rodada,
      autor: nomeNoFio(nomeDoAutor(linha.autor)),
      texto: linha.texto.slice(0, REGISTRO_TEXTO_MAX),
      podeDesfazer: podeDesfazer(linha, quem, ctx.minhaVez),
    }
    if (linha.desfeita !== undefined) paraJogador.desfeita = { por: nomeNoFio(linha.desfeita.por) }
    saem.push(paraJogador)
  }
  return saem.reverse()
}
