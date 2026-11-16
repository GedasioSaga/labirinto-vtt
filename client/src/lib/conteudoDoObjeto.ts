import type { AberturaDoObjeto, ArmadilhaDoObjeto, ConteudoDoObjeto, ItemNoConteudo, Prop, TipoDeArmadilha } from '../types/map'
import { ITEM_QUANTIDADE_MAX, readPinItem, type ItemParaDar } from './items'

/**
 * CONTEÚDO DE BAÚ, CAIXA E BARRIL (Fase C do pedido de 15/11/2026). O mestre
 * põe itens do Acervo, moedas e uma armadilha; o jogador encosta, joga o
 * minigame do tipo do objeto na tela dele e, ao vencer, leva o que há dentro.
 * O baú fica no mapa, aberto; a caixa e o barril viram destroços.
 *
 * Regras daqui (puras, sem store nem rede):
 * - Todo baú, caixa e barril se abre, com conteúdo ou sem (ausente = vazio).
 *   Assim "abrível" não conta ao jogador quais têm algo dentro.
 * - O conteúdo NUNCA vai ao jogador: o recorte leva só `abrivel`
 *   (`abrivelParaJogador`), e o desfecho só depois da vitória.
 * - Os itens são a cópia do item do Acervo do momento em que o mestre os pôs
 *   (`itemParaDar`, com o `itemId`): o mapa não depende do Acervo deste
 *   computador para entregar, e a mochila recebe pela porta da Fase 1.
 */

/** Os móveis que guardam conteúdo; o minigame vem do tipo. */
export type MobiliaComConteudo = 'bau' | 'caixa' | 'barril'
export const MOBILIAS_COM_CONTEUDO: readonly MobiliaComConteudo[] = ['bau', 'caixa', 'barril']
/** A caixa e o barril quebrados viram este móvel do catálogo (destroços de madeira). */
export const MOBILIA_DOS_DESTROCOS = 'destrocosDeMadeira'

/** Tetos dos números do mestre (a tela e a leitura do disco usam os mesmos). */
export const MOEDAS_NO_CONTEUDO_MAX = 999_999
export const ITENS_NO_CONTEUDO_MAX = 40
export const DANO_DA_ARMADILHA_MAX = 999
export const TURNOS_DA_ARMADILHA_MAX = 20
export const POR_VEZ_DA_ARMADILHA_MAX = 99

export const NOME_DO_OBJETO: Readonly<Record<MobiliaComConteudo, string>> = { bau: 'Baú', caixa: 'Caixa', barril: 'Barril' }
export const NOME_DA_ARMADILHA: Readonly<Record<TipoDeArmadilha, string>> = { cobra: 'Cobra', aranha: 'Aranha' }
/** O nome do minigame de cada objeto, como a ficha diz ("Minigame: Abrir o baú."). */
export const MINIGAME_DO_OBJETO: Readonly<Record<MobiliaComConteudo, string>> = { bau: 'Abrir o baú', caixa: 'Arrombar a caixa', barril: 'Quebrar o barril' }

/**
 * Os padrões aprovados pelo mestre (15/11/2026): a cobra tira 8 PV na hora e
 * põe Envenenado por 3 turnos, 4 PV em cada; a aranha tira 5 PV e põe Lento
 * por 2 turnos (anda metade do passo).
 */
export const ARMADILHA_PADRAO: Readonly<Record<TipoDeArmadilha, Readonly<ArmadilhaDoObjeto>>> = {
  cobra: { tipo: 'cobra', dano: 8, efeito: 'Envenenado', turnos: 3, porVez: 4 },
  aranha: { tipo: 'aranha', dano: 5, efeito: 'Lento', turnos: 2, porVez: 0 },
}

/** Cópia nova do padrão (nunca a constante). */
export function armadilhaPadrao(tipo: TipoDeArmadilha): ArmadilhaDoObjeto {
  return { ...ARMADILHA_PADRAO[tipo] }
}

/** A armadilha difere do padrão do tipo dela (o "Voltar ao padrão" aparece). */
export function armadilhaMudouDoPadrao(armadilha: ArmadilhaDoObjeto): boolean {
  const padrao = ARMADILHA_PADRAO[armadilha.tipo]
  return armadilha.dano !== padrao.dano || armadilha.turnos !== padrao.turnos || armadilha.porVez !== padrao.porVez || armadilha.efeito !== padrao.efeito
}

export function conteudoVazio(): ConteudoDoObjeto {
  return { itens: [], moedas: 0, armadilha: null }
}

export function ehMobiliaComConteudo(tipo: unknown): tipo is MobiliaComConteudo {
  return tipo === 'bau' || tipo === 'caixa' || tipo === 'barril'
}

/**
 * O tipo do objeto que guarda conteúdo: o baú, a caixa e o barril, e os
 * destroços que ERAM caixa ou barril (o tipo de antes). `null` = não guarda.
 */
export function mobiliaDoConteudo(prop: Pick<Prop, 'mobilia' | 'conteudo'>): MobiliaComConteudo | null {
  if (ehMobiliaComConteudo(prop.mobilia)) return prop.mobilia
  const quebradoDe = prop.conteudo?.aberto?.quebradoDe
  return prop.mobilia === MOBILIA_DOS_DESTROCOS && quebradoDe !== undefined ? quebradoDe : null
}

/** O conteúdo do objeto; ausente = vazio. Objeto que não guarda: `null`. */
export function conteudoDe(prop: Pick<Prop, 'mobilia' | 'conteudo'>): ConteudoDoObjeto | null {
  if (mobiliaDoConteudo(prop) === null) return null
  return prop.conteudo ?? conteudoVazio()
}

/** Quantos itens, somando as quantidades. */
export function totalDeItens(conteudo: Pick<ConteudoDoObjeto, 'itens'>): number {
  return conteudo.itens.reduce((soma, { quantidade }) => soma + quantidade, 0)
}

/** O resumo da ficha e da lista ("3 itens, 35 moedas, Cobra"; "Vazio"). */
export function resumoDoConteudo(conteudo: ConteudoDoObjeto): string {
  const partes: string[] = []
  const itens = totalDeItens(conteudo)
  if (itens > 0) partes.push(itens === 1 ? '1 item' : `${itens} itens`)
  if (conteudo.moedas > 0) partes.push(conteudo.moedas === 1 ? '1 moeda' : `${conteudo.moedas} moedas`)
  if (conteudo.armadilha !== null) partes.push(NOME_DA_ARMADILHA[conteudo.armadilha.tipo])
  const resumo = partes.length === 0 ? 'Vazio' : partes.join(', ')
  return conteudo.aberto === undefined ? resumo : `Aberto · ${resumo}`
}

/** O que a pessoa leva, numa frase ("Poção de cura ×2, Antídoto e 35 moedas"); `''` = nada. */
export function oQueLevou(conteudo: Pick<ConteudoDoObjeto, 'itens' | 'moedas'>): string {
  const partes = conteudo.itens.map(({ item, quantidade }) => (quantidade > 1 ? `${item.nome} ×${quantidade}` : item.nome))
  if (conteudo.moedas > 0) partes.push(conteudo.moedas === 1 ? '1 moeda' : `${conteudo.moedas} moedas`)
  if (partes.length <= 1) return partes.join('')
  return `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`
}

/** A linha da armadilha, igual para o mestre e para o jogador ("A cobra picou: -8 PV. Envenenado por 3 turnos."). */
export function fraseDaArmadilha(armadilha: ArmadilhaDoObjeto): string {
  const bicho = armadilha.tipo === 'cobra' ? 'A cobra' : 'A aranha'
  const turnos = armadilha.turnos === 1 ? '1 turno' : `${armadilha.turnos} turnos`
  const efeito = armadilha.turnos > 0 && armadilha.efeito !== '' ? ` ${armadilha.efeito} por ${turnos}.` : ''
  return `${bicho} picou: -${armadilha.dano} PV.${efeito}`
}

// ------------------------------------------------------------------ leitura do disco

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function inteiroEntre(valor: unknown, min: number, max: number, padrao: number): number {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return padrao
  return Math.min(max, Math.max(min, Math.round(valor)))
}

function lerArmadilha(valor: unknown): ArmadilhaDoObjeto | null {
  if (!isRecord(valor) || (valor.tipo !== 'cobra' && valor.tipo !== 'aranha')) return null
  const padrao = ARMADILHA_PADRAO[valor.tipo]
  const efeito = typeof valor.efeito === 'string' && valor.efeito.trim() !== '' ? valor.efeito.trim().slice(0, 40) : padrao.efeito
  return {
    tipo: valor.tipo,
    dano: inteiroEntre(valor.dano, 0, DANO_DA_ARMADILHA_MAX, padrao.dano),
    efeito,
    turnos: inteiroEntre(valor.turnos, 0, TURNOS_DA_ARMADILHA_MAX, padrao.turnos),
    porVez: inteiroEntre(valor.porVez, 0, POR_VEZ_DA_ARMADILHA_MAX, padrao.porVez),
  }
}

/** O item do Acervo como fica no conteúdo: a mesma porta do item no chão (`readPinItem`), sem o "Pega direto". */
function lerItemNoConteudo(valor: unknown): ItemNoConteudo | null {
  if (!isRecord(valor)) return null
  const lido = readPinItem(valor.item)
  if (lido === undefined) return null
  const { livre: _soDoChao, quantidade: _daVaga, ...item } = lido
  return { item, quantidade: inteiroEntre(valor.quantidade, 1, ITEM_QUANTIDADE_MAX, 1) }
}

function lerAbertura(valor: unknown): AberturaDoObjeto | undefined {
  if (!isRecord(valor)) return undefined
  const por = typeof valor.por === 'string' ? valor.por.trim().slice(0, 64) : ''
  const em = typeof valor.em === 'number' && Number.isFinite(valor.em) ? valor.em : 0
  const abertura: AberturaDoObjeto = { por, em }
  if (valor.quebradoDe === 'caixa' || valor.quebradoDe === 'barril') abertura.quebradoDe = valor.quebradoDe
  return abertura
}

/**
 * `Prop.conteudo` como vem do disco, já sabendo o tipo do objeto. Torto cai
 * campo a campo no vazio; objeto que não guarda conteúdo (ou os destroços sem
 * o tipo de antes) perde o campo. `undefined` = sem conteúdo.
 */
export function lerConteudoDoArquivo(valor: unknown, mobilia: Prop['mobilia']): ConteudoDoObjeto | undefined {
  if (!isRecord(valor)) return undefined
  const aberto = lerAbertura(valor.aberto)
  const tipo = mobiliaDoConteudo({ mobilia, conteudo: aberto === undefined ? undefined : { ...conteudoVazio(), aberto } })
  if (tipo === null) return undefined
  // A caixa que ainda é caixa não está quebrada: o "quebradoDe" só vale nos destroços.
  if (aberto !== undefined && ehMobiliaComConteudo(mobilia)) delete aberto.quebradoDe
  const itens = Array.isArray(valor.itens) ? valor.itens.flatMap((item) => lerItemNoConteudo(item) ?? []).slice(0, ITENS_NO_CONTEUDO_MAX) : []
  const conteudo: ConteudoDoObjeto = {
    itens,
    moedas: inteiroEntre(valor.moedas, 0, MOEDAS_NO_CONTEUDO_MAX, 0),
    armadilha: lerArmadilha(valor.armadilha),
  }
  if (aberto !== undefined) conteudo.aberto = aberto
  return conteudo
}

/**
 * O objeto lido do disco: `abrivel` (campo de fio) sai sempre, e o
 * `conteudo` passa por `lerConteudoDoArquivo`. Objeto sem os dois volta o mesmo.
 */
export function propComConteudoDoArquivo(prop: Prop): Prop {
  if (!('conteudo' in prop) && !('abrivel' in prop)) return prop
  const conteudo = lerConteudoDoArquivo(prop.conteudo, prop.mobilia)
  const lido: Prop = { ...prop }
  delete lido.conteudo
  delete lido.abrivel
  if (conteudo !== undefined) lido.conteudo = conteudo
  return lido
}

// ------------------------------------------------------------------ mesa

/** O que o recorte do jogador leva do objeto: `'fechado'` (abre com minigame), `'aberto'` ou nada. */
export function abrivelParaJogador(prop: Pick<Prop, 'mobilia' | 'conteudo'>): 'fechado' | 'aberto' | undefined {
  const tipo = mobiliaDoConteudo(prop)
  if (tipo === null) return undefined
  return prop.conteudo?.aberto === undefined ? 'fechado' : 'aberto'
}

/** O minigame que o objeto pede AGORA: o do tipo, enquanto fechado. `null` = aberto, quebrado ou não guarda. */
export function jogoDoObjetoFechado(prop: Pick<Prop, 'mobilia' | 'conteudo'>): MobiliaComConteudo | null {
  return ehMobiliaComConteudo(prop.mobilia) && prop.conteudo?.aberto === undefined ? prop.mobilia : null
}

/** O objeto depois de aberto: marca quem e quando; a caixa e o barril viram destroços. */
export function objetoAberto(prop: Prop, por: string, em: number): Prop {
  const tipo = jogoDoObjetoFechado(prop)
  if (tipo === null) return prop
  const aberto: AberturaDoObjeto = { por, em }
  const conteudo: ConteudoDoObjeto = { ...(prop.conteudo ?? conteudoVazio()), aberto }
  if (tipo === 'bau') return { ...prop, conteudo }
  aberto.quebradoDe = tipo
  return { ...prop, mobilia: MOBILIA_DOS_DESTROCOS, conteudo }
}

/** "Fechar e repor": o mesmo conteúdo de novo, fechado; os destroços voltam a ser a caixa ou o barril. */
export function objetoReposto(prop: Prop): Prop {
  const conteudo = prop.conteudo
  if (conteudo?.aberto === undefined) return prop
  const { aberto, ...fechado } = conteudo
  if (aberto.quebradoDe === undefined) return { ...prop, conteudo: fechado }
  return { ...prop, mobilia: aberto.quebradoDe, conteudo: fechado }
}

/** O item do conteúdo pronto para a mochila (`darNaFicha`). */
export function itemParaAMochila(item: ItemNoConteudo['item']): ItemParaDar {
  return { ...item }
}
