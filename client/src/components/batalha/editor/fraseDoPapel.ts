import { ADJETIVO_DO_TIPO } from '../../../lib/batalha/mecanica/golpe'
import type { Efeito, MecanicaV1, TipoComRegra, TipoDoGolpe } from '../../../lib/batalha/mecanica/modelo'
import { fraseDoAlvo, fraseDoCusto, fraseDoEfeito, fraseDoLimite, fraseDoTeste, frasesDaReacao, frasesDoDano, frasesDoGolpe, frasesDosOutrosCustos, previaDoDano, type FichaDaPrevia } from '../../../lib/batalha/mecanica/resumo'
import { textoDoNumero } from '../blocos/controles'
import { categoriaDaMecanica, nomeDaAcao } from './acaoNaTela'

/**
 * A FRASE DO PAPEL do editor novo (ED3; EDITOR.md §5, protótipo `frase()`):
 * a mecânica em pedaços, cada um levando à linha que o muda. Os textos são os
 * do resumo de hoje (`resumo.ts`), na ordem do cartão. A ED2 escreve o campo
 * Efeito a partir da mecânica (`textoGerado.ts`); quando ela der os pedaços,
 * esta função passa a montá-los de lá, para o papel e o campo nunca dizerem
 * coisas diferentes.
 */

/** As linhas do editor, na ordem da tela; o id também é a âncora da linha. */
export type IdDaLinha = 'acao' | 'golpe' | 'alcance' | 'dano' | 'acerto' | 'efeitos' | 'custo' | 'requisitos' | 'evolucao' | 'jogadores' | 'campos'

/** A tinta do pedaço no papel (as do protótipo aprovado). */
export type CorDoPedaco = 'dano' | 'cura' | 'selo' | 'custo'

export interface PedacoDaFrase {
  texto: string
  /** Ausente = só ligação ("": ", ". "), sem linha para levar. */
  linha?: IdDaLinha
  cor?: CorDoPedaco
}

const COR_DO_EFEITO: Readonly<Record<Efeito['tipo'], CorDoPedaco | null>> = {
  selo: 'selo',
  tirarSelos: 'selo',
  cura: 'cura',
  dreno: 'cura',
  reviver: 'cura',
  aMao: null,
}

function semPonto(frase: string): string {
  return frase.trim().replace(/\.$/, '')
}

function comMinuscula(frase: string): string {
  return frase.charAt(0).toLocaleLowerCase('pt-BR') + frase.slice(1)
}

/** Uma frase do resumo vira pedaço, com a linha e a tinta; frase vazia não entra. */
function pedaco(texto: string, linha: IdDaLinha, cor: CorDoPedaco | null = null): PedacoDaFrase[] {
  const limpo = semPonto(texto)
  if (limpo === '') return []
  return [cor === null ? { texto: limpo, linha } : { texto: limpo, linha, cor }]
}

/** Os pedaços depois do nome da ação, sem as ligações. */
function pedacosDoCorpo(mecanica: MecanicaV1, ficha: FichaDaPrevia): PedacoDaFrase[] {
  const daVez = mecanica.uso !== 'reacao'
  const categoria = categoriaDaMecanica(mecanica)
  const exige = mecanica.alvo.exigeSelo === undefined ? '' : ` Só vale em quem tem ${mecanica.alvo.exigeSelo}.`
  const corpo: PedacoDaFrase[] = []
  if (daVez) {
    corpo.push(...pedaco(`${fraseDoAlvo(mecanica)}${exige}`, 'alcance'))
    // Apoio sem dano não diz "Não dá dano": a frase do resumo já some na ajuda.
    corpo.push(...pedaco(frasesDoDano(mecanica, ficha).join(' '), 'dano', mecanica.dano === undefined ? null : 'dano'))
    corpo.push(...pedaco(fraseDoTeste(mecanica, ficha), 'acerto'))
    // ED1: o tipo do golpe (como bate, o que causa), lido da escolha guardada; a linha Golpe o muda.
    for (const frase of frasesDoGolpe(mecanica, ficha)) corpo.push(...pedaco(frase, 'golpe', 'selo'))
  }
  const reacao = frasesDaReacao(mecanica, ficha)
  reacao.forEach((frase, indice) => corpo.push(...pedaco(frase, 'acerto', indice > 0 && frase.startsWith('Devolve') ? 'dano' : null)))
  const efeitos = mecanica.efeitos.filter((efeito) => daVez || efeito.tipo === 'aMao' || (efeito.tipo === 'selo' && efeito.em === 'atacante'))
  for (const efeito of efeitos) corpo.push(...pedaco(fraseDoEfeito(efeito, mecanica, ficha), 'efeitos', COR_DO_EFEITO[efeito.tipo]))
  const item = mecanica.custoEmItem
  const custo = [fraseDoCusto(mecanica), ...frasesDosOutrosCustos(mecanica), item === undefined ? '' : `Cada uso gasta ${item.quantos} ${item.nome} da mochila.`, fraseDoLimite(mecanica) ?? '']
  for (const frase of custo) corpo.push(...pedaco(frase, 'custo', 'custo'))
  // Overload: a trava aparece no fim, mas é a linha Ação que a muda.
  if (categoria === 'overload') corpo.push({ texto: 'Gasta a vez inteira', linha: 'acao' })
  return corpo
}

/** Os adjetivos do golpe que vão no nome ("Ataque Completo de fogo"), na ordem: como bate, depois o que causa. */
function adjetivosDoGolpe(mecanica: MecanicaV1): string[] {
  const { golpe } = mecanica
  if (golpe === undefined) return []
  const tipos: TipoComRegra<TipoDoGolpe>[] = [...(golpe.bate === undefined ? [] : [golpe.bate]), ...(golpe.causa ?? [])]
  return tipos.map((escolha) => (escolha.tipo === 'outro' ? `de ${escolha.regra.nome}` : ADJETIVO_DO_TIPO[escolha.tipo]))
}

/** A frase do papel: "Ataque Completo: acerta 1 inimigo… . Dano: … . Custa 35 SP ao usar." */
export function pedacosDaFrase(mecanica: MecanicaV1, ficha: FichaDaPrevia): PedacoDaFrase[] {
  const corpo = pedacosDoCorpo(mecanica, ficha)
  // Com tipo, o nome leva à linha Golpe (protótipo): é ela que dá o "de fogo".
  const adjetivos = adjetivosDoGolpe(mecanica)
  const frase: PedacoDaFrase[] = [adjetivos.length === 0 ? { texto: nomeDaAcao(mecanica), linha: 'acao' } : { texto: `${nomeDaAcao(mecanica)} ${adjetivos.join(' e ')}`, linha: 'golpe' }]
  corpo.forEach((parte, indice) => {
    frase.push({ texto: indice === 0 ? ': ' : '. ' })
    frase.push(indice === 0 ? { ...parte, texto: comMinuscula(parte.texto) } : parte)
  })
  frase.push({ texto: '.' })
  return frase
}

/** A linha curta embaixo do nome ("Ataque Completo · 35 SP · Tempo 4 · Dano 70"). */
export function linhaCurtaDoPapel(mecanica: MecanicaV1, ficha: FichaDaPrevia): string {
  const partes = [nomeDaAcao(mecanica)]
  const aoUsar = mecanica.custos.find((custo) => custo.quando === 'aoUsar')
  if (aoUsar !== undefined && 'fixo' in aoUsar.quanto) partes.push(`${aoUsar.quanto.fixo} ${aoUsar.recurso.toUpperCase()}`)
  const { recarga, usosPorBatalha, overload } = mecanica.limite
  if (overload === true) partes.push('1 por batalha')
  else if (recarga !== undefined) partes.push(`Tempo ${recarga}`)
  else if (usosPorBatalha !== undefined) partes.push(`${usosPorBatalha}x por batalha`)
  const base = mecanica.dano?.base
  if (base !== undefined && !('porcento' in base)) {
    const previa = previaDoDano(textoDoNumero(base), ficha)
    const valor = previa?.match(/^= (\d+)/)?.[1]
    if (valor !== undefined) partes.push(`Dano ${valor}`)
  }
  return partes.join(' · ')
}
