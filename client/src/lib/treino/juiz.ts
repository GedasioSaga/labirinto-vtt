import { fichaDoBoneco, NOME_DO_BONECO } from '../arena/boneco'
import { BONECO_PADRAO, type ReacaoDoBoneco } from '../arena/tipos'
import { atributoComposto, maximoComposto, temMaximo, type ValorComposto } from '../ajusteDaFicha'
import { recursoDoEscudo } from '../batalha/leituraDaFicha'
import { projetarParaTreino } from '../nuvem/projecao'
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
 * O número guardado é o BASE, como o "Máximo" da ficha e o rascunho de treino
 * (é o mesmo que uma build guarda): o modificador e as transformações ligadas
 * da base somam por cima. O painel mostra e recebe o número da LUTA
 * (`numerosNaLuta`, `ajusteDoNumero`), para o que aparece ser o que luta.
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
  /** Vida máxima base (e a atual); `null` = a da base. O modificador e as transformações da base somam por cima. */
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

/** O que a ficha soma por cima de cada número base guardado: o número da luta é o base mais isto. */
export interface SomaDaFicha {
  hp: number
  sp: number
  atributos: Readonly<Record<string, number>>
}

/** Os números com que uma ficha luta: o máximo de verdade da vida e da energia, o Escudo e o total de cada atributo. */
export interface NumerosDaBase {
  hp: number
  sp: number
  escudo: number
  atributos: Readonly<Record<string, number>>
  /** O Escudo é de um número só: não soma nada. */
  soma: SomaDaFicha
}

/** Os números fixos do boneco da Arena, o padrão do Judge. */
interface NumerosDoBoneco {
  hp: number
  sp: number
  escudo: number
}

export function ajustesPadraoDoJuiz(): AjustesDoJuiz {
  return { versao: VERSAO_DO_JUIZ, baseFichaId: null, hp: null, sp: null, escudo: null, reage: BONECO_PADRAO.reage, atributos: {}, tecnicas: [], salvoEm: 0 }
}

/** O recurso de energia com atual e máximo (no One Piece, o SP): o que não é vida nem Escudo. */
export function recursoDaEnergia(sistema: SistemaDeRpg): SistemaDeRpg['recursos'][number] | null {
  const vida = recursoDeVida(sistema)
  return sistema.recursos.find((recurso) => recurso.atualEMaximo === true && recurso.id !== vida?.id) ?? null
}

/** Os números do boneco da Arena: fixos, o sistema não muda nenhum. */
function numerosDoBoneco(): NumerosDoBoneco {
  return { hp: BONECO_PADRAO.hp, sp: SP_DO_BONECO, escudo: BONECO_PADRAO.escudo }
}

/** O modificador mais os cartões ligados. A força do NPC de combate não entra: a ficha do Judge nunca a tem (`fichaDoJuiz`). */
function somaDe(valor: ValorComposto): number {
  return valor.modificador + valor.cartoes.reduce((soma, parcela) => soma + parcela.delta, 0)
}

/**
 * Os números com que a ficha luta, lidos como a batalha lê: o máximo de
 * verdade da vida e da energia (`maximoComposto`), o Escudo (um número só) e
 * o total de cada atributo (`atributoComposto`). Recurso que o sistema não
 * tem = 0.
 */
export function numerosNaLuta(sistema: SistemaDeRpg, ficha: Personagem): NumerosDaBase {
  const vida = recursoDeVida(sistema)
  const energia = recursoDaEnergia(sistema)
  const escudo = recursoDoEscudo(sistema)
  const hp = vida === null ? null : maximoComposto(ficha, vida.id)
  const sp = energia === null ? null : maximoComposto(ficha, energia.id)
  const atributos = sistema.atributos.map((atributo) => ({ id: atributo.id, valor: atributoComposto(ficha, atributo.id) }))
  return {
    hp: hp === null ? 0 : hp.total,
    sp: sp === null ? 0 : sp.total,
    escudo: escudo === null ? 0 : (ficha.recursos[escudo.id] ?? 0),
    atributos: Object.fromEntries(atributos.map(({ id, valor }) => [id, valor.total])),
    soma: {
      hp: hp === null ? 0 : somaDe(hp),
      sp: sp === null ? 0 : somaDe(sp),
      atributos: Object.fromEntries(atributos.map(({ id, valor }) => [id, somaDe(valor)])),
    },
  }
}

/** Os números de partida do Judge, sem ajuste nenhum: os do boneco, ou os da ficha copiada como está agora. */
export function numerosDaBase(sistema: SistemaDeRpg, base: Personagem | null): NumerosDaBase {
  return numerosNaLuta(sistema, fichaDoJuiz(sistema, ajustesPadraoDoJuiz(), base))
}

/**
 * O número que se guarda para o número da LUTA que a pessoa digitou: o base,
 * para a soma da ficha (`NumerosDaBase.soma`) completar o resto. Igual ao da
 * base = `null` (a cópia acompanha a ficha quando ela muda).
 */
export function ajusteDoNumero(naLuta: number, daBase: number, soma: number): number | null {
  return naLuta === daBase ? null : naLuta - soma
}

/** A faixa do número da luta cujo base guardado fica entre `min` e `NUMERO_DO_JUIZ_MAX` (a que `validarAjustesDoJuiz` aceita). */
export function faixaDoNumero(min: number, soma: number): { min: number; max: number } {
  return { min: Math.max(min, min + soma), max: Math.min(NUMERO_DO_JUIZ_MAX, NUMERO_DO_JUIZ_MAX + soma) }
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
 *
 * A cópia passa pela projeção do treino (`projetarParaTreino`): sem o dono,
 * sem os campos do mestre (combate, cenário, nome de entrada, anotação), sem o
 * bloco de NPC da Dragon Ball e sem mochila nem moedas, que a luta não usa. O
 * servidor pode chamar com o doc completo: o Judge não é de ninguém
 * (`ficha.dono`) e não leva segredo do mestre a quem assiste. Sem `combate`,
 * a força do NPC não multiplica o HP, como já é no site (que recebe a ficha
 * projetada).
 */
export function fichaDoJuiz(sistema: SistemaDeRpg, ajustes: AjustesDoJuiz, base: Personagem | null): Personagem {
  if (base !== null) {
    const copia: Personagem = { ...projetarParaTreino(base), id: ID_DO_JUIZ, nome: `Cópia de ${base.nome}`, descricao: `Cópia de treino de ${base.nome}.` }
    return comTecnicasDeTreino(comNumeros(copia, sistema, ajustes), ajustes.tecnicas)
  }
  const numeros = ajustes.baseFichaId === null ? ajustes : { ...ajustesPadraoDoJuiz(), tecnicas: ajustes.tecnicas }
  const doBoneco = numerosDoBoneco()
  let ficha = fichaDoBoneco(sistema, { ...BONECO_PADRAO, infinito: false, hp: numeros.hp ?? doBoneco.hp, escudo: numeros.escudo ?? doBoneco.escudo }, ID_DO_JUIZ)
  ficha = comNumeros(ficha, sistema, { ...numeros, hp: null, escudo: null, sp: numeros.sp ?? doBoneco.sp })
  return comTecnicasDeTreino({ ...ficha, retrato: RETRATO_DO_JUIZ, descricao: 'O boneco de teste da Arena.' }, numeros.tecnicas)
}
