import { fichaDoBoneco, NOME_DO_BONECO } from '../arena/boneco'
import { BONECO_PADRAO, type ReacaoDoBoneco } from '../arena/tipos'
import { temMaximo } from '../ajusteDaFicha'
import { recursoDoEscudo } from '../batalha/leituraDaFicha'
import type { Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { recursoDeVida } from '../vidaDaFicha'
import { comTecnicasDeTreino, lerTecnicasDeTreino, type TecnicaDeTreino } from './tecnicaDeTreino'

/**
 * O JUDGE DO TREINO, a parte pura (fatia J de 06/11/2026; F1 da Arena
 * multijogador, 07/11/2026). O adversário padrão do treino é o boneco da Arena
 * de testes do app (`lib/arena/boneco.ts`: a ficha NPC "Judge", sem técnica,
 * Agilidade 0, o HP e o Escudo do `BONECO_PADRAO`). Desde a F1 ele também pode
 * ser a CÓPIA de uma ficha da mesa ("na parte de ajustar o judge poder colocar
 * a copia de outros jogadores"): a ficha de X com os ajustes por cima, sempre
 * com o id `ID_DO_JUIZ`, nunca a ficha de X.
 *
 * Os números dos ajustes são a DIFERENÇA sobre a base: `null` (ou atributo
 * ausente) = o da base (o boneco, ou a ficha de X como estiver agora). Assim a
 * cópia acompanha X quando a ficha dele muda. A vida infinita da Arena fica de
 * fora: no treino a luta precisa acabar.
 *
 * Puro: sem DOM e sem armazenamento (o site guarda no navegador,
 * `lobby-site/telas/treino/juiz/juizDoTreino.ts`; o servidor da luta
 * multijogador monta o Judge do mestre por aqui).
 */

export const VERSAO_DO_JUIZ = 2
/** A versão de antes do "Quando leva um golpe" (sem `reage`): ainda abre, rolando o d20. */
const VERSAO_SEM_REACAO = 1
/** O id da ficha do Judge no treino (a cópia que luta ganha o id da vaga, como toda ficha). */
export const ID_DO_JUIZ = 'treino_juiz'
export const NOME_DO_JUIZ = NOME_DO_BONECO
/** O desenho do Judge da Arena (o 1º quadro da folha `assets/judge/judge-folha.webp`, de frente), em `public-lobby/`. */
export const RETRATO_DO_JUIZ = '/judge-retrato.webp'
/** O maior número de um campo do Judge (o mesmo teto do rascunho de treino). */
export const NUMERO_DO_JUIZ_MAX = 99_999
/** O SP com que o boneco nasce: o bastante para usar as técnicas que ganhar. */
const SP_DO_BONECO = 100
/** O id de ficha mais comprido que a base aceita (os da mesa são bem menores). */
const ID_DA_BASE_MAX = 128

export interface AjustesDoJuiz {
  versao: typeof VERSAO_DO_JUIZ
  /** A ficha da mesa que o Judge copia; `null` = o boneco da Arena. Ausente nos ajustes de antes da F1. */
  baseFichaId: string | null
  /** Vida máxima (e a atual: a luta começa com ela cheia); `null` = a da base. */
  hp: number | null
  sp: number | null
  escudo: number | null
  /** "Quando leva um golpe", como o boneco da Arena: rola o d20 ou fica parado. */
  reage: ReacaoDoBoneco
  /** Só os que mudaram da base (no boneco, de 0): atributo → valor. */
  atributos: Record<string, number>
  /** As técnicas que só existem no treino, além das que a base já tem. */
  tecnicas: TecnicaDeTreino[]
  salvoEm: number
}

/** Os números de partida do Judge: os do boneco, ou os da ficha copiada como está agora. */
export interface NumerosDaBase {
  hp: number
  sp: number
  escudo: number
  atributos: Readonly<Record<string, number>>
}

export function ajustesPadraoDoJuiz(): AjustesDoJuiz {
  return { versao: VERSAO_DO_JUIZ, baseFichaId: null, hp: null, sp: null, escudo: null, reage: BONECO_PADRAO.reage, atributos: {}, tecnicas: [], salvoEm: 0 }
}

/** O recurso de energia com atual e máximo (no One Piece, o SP): o que não é vida nem Escudo. */
export function recursoDaEnergia(sistema: SistemaDeRpg): SistemaDeRpg['recursos'][number] | null {
  const vida = recursoDeVida(sistema)
  return sistema.recursos.find((recurso) => recurso.atualEMaximo === true && recurso.id !== vida?.id) ?? null
}

/** O máximo do recurso na ficha (o atual, se ela não guarda máximo); recurso que o sistema não tem = 0. */
function maximoNaFicha(ficha: Personagem, recursoId: string | undefined): number {
  if (recursoId === undefined) return 0
  return ficha.maximos[recursoId] ?? ficha.recursos[recursoId] ?? 0
}

/** Os números do boneco da Arena: fixos, o sistema não muda nenhum. */
function numerosDoBoneco(): NumerosDaBase {
  return { hp: BONECO_PADRAO.hp, sp: SP_DO_BONECO, escudo: BONECO_PADRAO.escudo, atributos: {} }
}

export function numerosDaBase(sistema: SistemaDeRpg, base: Personagem | null): NumerosDaBase {
  if (base === null) return numerosDoBoneco()
  const escudo = recursoDoEscudo(sistema)
  return {
    hp: maximoNaFicha(base, recursoDeVida(sistema)?.id),
    sp: maximoNaFicha(base, recursoDaEnergia(sistema)?.id),
    escudo: escudo === null ? 0 : (base.recursos[escudo.id] ?? 0),
    atributos: base.atributos,
  }
}

/** O Judge saiu do boneco padrão? (Ser cópia de alguém já é sair.) */
export function juizMudou(ajustes: AjustesDoJuiz): boolean {
  const padrao = numerosDoBoneco()
  const mudouDe = (valor: number | null, dePadrao: number) => valor !== null && valor !== dePadrao
  return (
    ajustes.baseFichaId !== null ||
    mudouDe(ajustes.hp, padrao.hp) ||
    mudouDe(ajustes.sp, padrao.sp) ||
    mudouDe(ajustes.escudo, padrao.escudo) ||
    ajustes.reage !== BONECO_PADRAO.reage ||
    Object.keys(ajustes.atributos).length > 0 ||
    ajustes.tecnicas.length > 0
  )
}

/** Os ids das fichas que a luta não deixa reagir: o Judge, quando fica parado (`MontagemDaLuta.naoReagem`). */
export function juizNaoReage(ajustes: AjustesDoJuiz): readonly string[] {
  return ajustes.reage === 'parado' ? [ID_DO_JUIZ] : []
}

/** Lido de fora (navegador ou mensagem): `null`/ausente = o da base; número fora da faixa = torto. */
function numeroDoJuiz(valor: unknown, min: number): number | null | 'torto' {
  if (valor === null || valor === undefined) return null
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= min && valor <= NUMERO_DO_JUIZ_MAX ? valor : 'torto'
}

function lerAtributos(valor: unknown, sistema: SistemaDeRpg): Record<string, number> | null {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return null
  const conhecidos = new Set(sistema.atributos.map((atributo) => atributo.id))
  const lidos: Record<string, number> = {}
  for (const [id, bruto] of Object.entries(valor)) {
    const lido = numeroDoJuiz(bruto, 0)
    if (lido === null || lido === 'torto') return null
    // Atributo que o sistema não tem mais só deixa de valer (o livro pode ter mudado).
    if (conhecidos.has(id)) lidos[id] = lido
  }
  return lidos
}

function lerBase(valor: unknown): string | null | 'torto' {
  if (valor === null || valor === undefined) return null
  return typeof valor === 'string' && valor.length > 0 && valor.length <= ID_DA_BASE_MAX ? valor : 'torto'
}

function reacaoLida(valor: unknown): ReacaoDoBoneco | null {
  return valor === 'd20' || valor === 'parado' ? valor : null
}

/** Os ajustes vindos de fora (JSON já lido); `null` = tortos. A versão 1 e a 2 de antes da F1 (sem base, números sempre cheios) ainda abrem. */
export function validarAjustesDoJuiz(bruto: unknown, sistema: SistemaDeRpg): AjustesDoJuiz | null {
  if (typeof bruto !== 'object' || bruto === null || Array.isArray(bruto)) return null
  const registro: Record<string, unknown> = { ...bruto }
  if (registro.versao !== VERSAO_DO_JUIZ && registro.versao !== VERSAO_SEM_REACAO) return null
  const baseFichaId = lerBase(registro.baseFichaId)
  const hp = numeroDoJuiz(registro.hp, 1)
  const sp = numeroDoJuiz(registro.sp, 0)
  const escudo = numeroDoJuiz(registro.escudo, 0)
  const atributos = lerAtributos(registro.atributos, sistema)
  const tecnicas = lerTecnicasDeTreino(registro.tecnicas)
  const reage = registro.versao === VERSAO_SEM_REACAO ? BONECO_PADRAO.reage : reacaoLida(registro.reage)
  if (baseFichaId === 'torto' || hp === 'torto' || sp === 'torto' || escudo === 'torto') return null
  if (reage === null || atributos === null || tecnicas === null || typeof registro.salvoEm !== 'number') return null
  return { versao: VERSAO_DO_JUIZ, baseFichaId, hp, sp, escudo, reage, atributos, tecnicas, salvoEm: registro.salvoEm }
}

/** O recurso no valor, com o máximo igual quando o recurso tem máximo (como o boneco da Arena grava). */
function comRecurso(ficha: Personagem, sistema: SistemaDeRpg, recursoId: string, valor: number): Personagem {
  const maximos = temMaximo(sistema, recursoId) ? { ...ficha.maximos, [recursoId]: valor } : ficha.maximos
  return { ...ficha, recursos: { ...ficha.recursos, [recursoId]: valor }, maximos }
}

/** Os números dos ajustes por cima da ficha de partida; `null` deixa o da base. */
function comNumeros(ficha: Personagem, sistema: SistemaDeRpg, ajustes: AjustesDoJuiz): Personagem {
  let pronta = ficha
  const vida = recursoDeVida(sistema)
  const energia = recursoDaEnergia(sistema)
  const escudo = recursoDoEscudo(sistema)
  if (vida !== null && ajustes.hp !== null) pronta = comRecurso(pronta, sistema, vida.id, ajustes.hp)
  if (energia !== null && ajustes.sp !== null) pronta = comRecurso(pronta, sistema, energia.id, ajustes.sp)
  if (escudo !== null && ajustes.escudo !== null) pronta = comRecurso(pronta, sistema, escudo.id, ajustes.escudo)
  return { ...pronta, atributos: { ...pronta.atributos, ...ajustes.atributos } }
}

/**
 * A ficha do Judge com os ajustes. `base` é a ficha que `ajustes.baseFichaId`
 * aponta, como a mesa a tem agora (quem chama procura). Sem base: o boneco da
 * Arena (`fichaDoBoneco`, sem vida infinita) com o retrato do Judge. Com base:
 * a cópia dela, com o id do Judge e o nome "Cópia de X". A base que sumiu da
 * mesa (`baseFichaId` sem `base`) volta ao boneco padrão, só com as técnicas:
 * os números eram de X. Sempre uma ficha nova: nada aqui é a ficha de alguém.
 */
export function fichaDoJuiz(sistema: SistemaDeRpg, ajustes: AjustesDoJuiz, base: Personagem | null): Personagem {
  if (base !== null) {
    const copia: Personagem = { ...base, id: ID_DO_JUIZ, nome: `Cópia de ${base.nome}`, descricao: `Cópia de treino de ${base.nome}.` }
    return comTecnicasDeTreino(comNumeros(copia, sistema, ajustes), ajustes.tecnicas)
  }
  const numeros = ajustes.baseFichaId === null ? ajustes : { ...ajustesPadraoDoJuiz(), tecnicas: ajustes.tecnicas }
  const doBoneco = numerosDoBoneco()
  let ficha = fichaDoBoneco(sistema, { ...BONECO_PADRAO, infinito: false, hp: numeros.hp ?? doBoneco.hp, escudo: numeros.escudo ?? doBoneco.escudo }, ID_DO_JUIZ)
  ficha = comNumeros(ficha, sistema, { ...numeros, hp: null, escudo: null, sp: numeros.sp ?? doBoneco.sp })
  return comTecnicasDeTreino({ ...ficha, retrato: RETRATO_DO_JUIZ, descricao: 'O boneco de teste da Arena.' }, numeros.tecnicas)
}
