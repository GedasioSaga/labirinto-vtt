import { nomeDaAcao } from '../../../lib/batalha/mecanica/categoria'
import type { MecanicaV1 } from '../../../lib/batalha/mecanica/modelo'
import { previaDoDano, type FichaDaPrevia } from '../../../lib/batalha/mecanica/resumo'
import type { ParteDoPapel } from '../../../lib/batalha/mecanica/textoGerado'
import { textoDoNumero } from '../blocos/controles'

/**
 * O PAPEL do editor novo (EDITOR.md §5). A frase em pedaços é a do texto
 * gerado (`pedacosDoPapel`, `lib/batalha/mecanica/textoGerado.ts`): o papel e
 * o campo Efeito nunca dizem coisas diferentes. Aqui ficam as linhas da tela e
 * a linha curta embaixo do nome.
 */

/** As linhas do editor, na ordem da tela; o id também é a âncora da linha. As da mecânica são as partes do papel. */
export type IdDaLinha = ParteDoPapel | 'textos' | 'gasto' | 'requisitos' | 'evolucao' | 'jogadores' | 'campos'

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
