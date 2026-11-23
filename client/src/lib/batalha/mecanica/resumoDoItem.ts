import type { EfeitoDoItem } from '../../../types/map'
import { efeitoResumoLido } from '../../leituraDoItem'
import type { SistemaDeRpg } from '../../sistemaDeRpg'
import { SISTEMAS_EMBUTIDOS } from '../../sistemaOnePiece'
import { lerMecanica, type DuracaoDoSelo, type Efeito, type FormaDoAlvo, type MecanicaV1, type NumeroSimples, type QuemOAlvoPega } from './modelo'
import { fraseDoEfeito } from './resumo'

/**
 * A FRASE DO ITEM (Fase 7 de docs/design/habilidades/SISTEMA.md §5.1): o que
 * o item faz em uma linha, para a vaga da mochila ("Cura 100 de HP. Gasta
 * 1."), o cartão do Acervo e o último passo do Testar. É a frase que vai ao
 * jogador no lugar das peças (decisão C8). Puro: sem store, sem rede.
 */

/** Onde o item vale, em frase; o "sempre" não diz nada. */
const FRASE_DO_ONDE: Readonly<Record<EfeitoDoItem['onde'], string | null>> = {
  sempre: null,
  soNaBatalha: 'Só na batalha.',
  soFora: 'Só fora da batalha.',
}

const QUEM_NA_AREA: Readonly<Record<QuemOAlvoPega, string>> = {
  inimigos: 'nos inimigos',
  aliados: 'nos aliados',
  todos: 'em todos',
  si: 'em quem usa',
  escolha: 'em quem escolher',
}

function casas(quantas: number): string {
  return `${quantas} ${quantas === 1 ? 'casa' : 'casas'}`
}

/** A área, curta ("Em todos a até 1 casa de um ponto: "); 1 alvo = nada. */
function fraseDaArea(forma: FormaDoAlvo, quem: QuemOAlvoPega): string {
  const em = QUEM_NA_AREA[quem]
  const comeco = `${em.charAt(0).toUpperCase()}${em.slice(1)}`
  switch (forma.tipo) {
    case 'um':
      return ''
    case 'varios':
      return `Em até ${forma.max} alvos: `
    case 'linha':
      return `${comeco} numa linha de ${casas(forma.casas)}: `
    case 'quadrado':
      return `${comeco} num quadrado de ${forma.lado} por ${forma.lado}: `
    case 'raio':
      return `${comeco} a até ${casas(forma.casas)}${forma.centro === 'ponto' ? ' de um ponto' : forma.centro === 'alvo' ? ' do alvo' : ''}: `
    // Fase B do alcance.
    case 'cruz':
      return `${comeco} numa cruz de ${casas(forma.casas)}: `
    case 'leque':
      return `${comeco} num leque de ${casas(forma.casas)} à frente: `
  }
}

function numero(valor: NumeroSimples): string {
  return 'fixo' in valor ? String(valor.fixo) : valor.formula.trim() || '?'
}

/** O dano, curto ("150 de dano, perfura 50%."); sem dano = nada. */
function fraseDoDanoDoItem(mecanica: MecanicaV1): string | null {
  const { dano } = mecanica
  if (dano === undefined) return null
  const quanto = 'porcento' in dano.base ? `${dano.base.porcento}% da vida máxima do alvo` : numero(dano.base)
  const perfura = dano.perfuracao !== undefined ? `, perfura ${dano.perfuracao}%` : dano.perfurante === true ? ', perfurante' : ''
  return `${quanto} de dano${perfura}.`
}

/**
 * O nome do atributo: o do sistema da ficha; sem ele (a cópia dada não sabe
 * o sistema), o dos sistemas que vêm com o app; senão, o id guardado.
 */
function nomeDoAtributo(id: string, sistema: SistemaDeRpg | undefined): string {
  if (id === 'dano') return 'Dano'
  if (id === 'reacao') return 'Reação'
  const sistemas = sistema === undefined ? SISTEMAS_EMBUTIDOS : [sistema, ...SISTEMAS_EMBUTIDOS]
  for (const candidato of sistemas) {
    const nome = candidato.atributos.find((atributo) => atributo.id === id)?.nome.trim()
    if (nome !== undefined && nome !== '') return nome
  }
  return id
}

function duracaoCurta(duracao: DuracaoDoSelo): string {
  if (duracao === 'ateTirar') return 'até tirarem'
  if (duracao === 'proximoGolpe') return 'até o próximo golpe'
  return `por ${duracao} ${duracao === 1 ? 'vez' : 'vezes'}`
}

/** O selo, curto: quem fica, quanto tempo e os números; a regra longa do nome fica na ficha e no Testar. */
function fraseDoSeloDoItem(selo: Extract<Efeito, { tipo: 'selo' }>, mecanica: MecanicaV1, sistema: SistemaDeRpg | undefined): string {
  const ajuda = mecanica.alvo.quem === 'aliados' || mecanica.alvo.quem === 'si'
  const mods = (selo.mods ?? []).map((mod) => `${nomeDoAtributo(mod.alvo, sistema)} ${'fixo' in mod.delta ? (mod.delta.fixo < 0 ? `${mod.delta.fixo}` : `+${mod.delta.fixo}`) : `+ (${mod.delta.formula})`}`)
  const numeros = mods.length === 0 ? '' : ` (${mods.join(', ')})`
  const quem = selo.em === 'quemUsa' ? 'Quem usa ganha' : ajuda ? 'Dá' : mecanica.teste.tipo === 'resistencia' ? 'Quem falhar fica' : mecanica.teste.tipo === 'disputa' ? 'Se vencer a disputa:' : 'Se acertar:'
  return `${quem} ${selo.nome} ${duracaoCurta(selo.duracao)}${numeros}.`
}

/** O efeito, curto: o "tira" sem o "(só essa condição)" da ficha, o selo sem a regra longa; o resto, a frase de sempre. */
function fraseDoEfeitoDoItem(efeito: Efeito, mecanica: MecanicaV1, sistema: SistemaDeRpg | undefined): string {
  if (efeito.tipo === 'tirarSelos' && typeof efeito.quais === 'object') return `Tira ${efeito.quais.nomes.join(' e ')}.`
  if (efeito.tipo === 'selo') return fraseDoSeloDoItem(efeito, mecanica, sistema)
  const frase = fraseDoEfeito(efeito, mecanica)
  // A peça à mão traz o texto do mestre, às vezes sem ponto: a frase seguinte ("Gasta 1.") não pode colar nele.
  return /[.!?]$/.test(frase) ? frase : `${frase}.`
}

/** O que o item faz, sem o gasto ("Cura 100 de HP."). `sistema` = o da ficha, para o nome do atributo. */
export function oQueOItemFaz(mecanica: MecanicaV1, sistema?: SistemaDeRpg): string {
  const partes = [fraseDoDanoDoItem(mecanica), ...mecanica.efeitos.map((efeito) => fraseDoEfeitoDoItem(efeito, mecanica, sistema))].filter((parte): parte is string => parte !== null)
  const faz = partes.length === 0 ? 'Não faz nada sozinho (o mestre narra).' : partes.join(' ')
  return `${fraseDaArea(mecanica.alvo.forma, mecanica.alvo.quem)}${faz}`
}

/** O que o item faz, das peças guardadas; peça que este app não lê vira aviso (o mestre confere). */
export function oQueOEfeitoFaz(efeito: EfeitoDoItem, sistema?: SistemaDeRpg): string {
  const lida = lerMecanica(efeito.mecanica)
  if (lida.tipo === 'pecas') return oQueOItemFaz(lida.mecanica, sistema)
  return lida.tipo === 'futura' ? 'Efeito de uma versão mais nova do app.' : 'Efeito com peça que o app não entende (o mestre confere).'
}

/** A frase da vaga (até 200 letras): "Cura 100 de HP. Gasta 1." */
export function resumoDoEfeitoDoItem(efeito: EfeitoDoItem, sistema?: SistemaDeRpg): string {
  const partes = [oQueOEfeitoFaz(efeito, sistema), efeito.gasta === 'um' ? 'Gasta 1.' : 'Não acaba.', FRASE_DO_ONDE[efeito.onde]].filter((parte): parte is string => parte !== null)
  return efeitoResumoLido(partes.join(' ')) ?? ''
}

/** O último passo do Testar: "Cura 100 de HP. Gasta 1: tinha 1, fica 0." */
export function fraseDoGastoNoTestar(efeito: Pick<EfeitoDoItem, 'gasta'>, mecanica: MecanicaV1, quantos: number, sistema?: SistemaDeRpg): string {
  const gasto = efeito.gasta === 'um' ? `Gasta 1: tinha ${quantos}, fica ${Math.max(0, quantos - 1)}.` : `Não gasta: tinha ${quantos}, fica ${quantos}.`
  return `${oQueOItemFaz(mecanica, sistema)} ${gasto}`
}
