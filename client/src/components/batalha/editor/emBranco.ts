import type { MecanicaV1 } from '../../../lib/batalha/mecanica/modelo'
import { mecanicaDoModelo } from '../../../lib/batalha/mecanica/modelos'
import type { FichaDaPrevia } from '../../../lib/batalha/mecanica/resumo'
import { cartaoComTextoGerado, NOME_DO_TEXTO_DE_ANTES } from '../../../lib/batalha/mecanica/textoGerado'
import type { CartaoDaFicha } from '../../../lib/personagem'
import type { SistemaDeRpg } from '../../../lib/sistemaDeRpg'
import { cartaoComAMecanica, type QuemEditaNoEditor } from './gravarNoCartao'

/**
 * "EM BRANCO" (protótipo aprovado, `habVazia`): a habilidade nova nasce já no editor, com o mínimo
 * que vale na batalha. Ataque Simples em 1 inimigo colado, sem custo e sem dano: o "Dá dano", o
 * custo e o resto se marcam nas linhas. Sem dano de propósito: a fórmula vazia não valeria, e a
 * ficha guardaria um cartão de texto vazio no lugar da habilidade nova.
 */
export function mecanicaEmBranco(sistema: SistemaDeRpg): MecanicaV1 {
  const { dano: _semDano, ...golpe } = mecanicaDoModelo('golpe', sistema)
  return { ...golpe, custos: [] }
}

/**
 * O cartão novo do "+ Habilidade", já montado em branco: o mestre grava a `mecanica` com o texto
 * gerado; o dono, a `mecanicaProposta` (vai ao mestre, como toda mudança dele). Sem "Texto de
 * antes": o cartão nasceu agora, não havia texto para guardar.
 */
export function cartaoNovoNoEditor(cartao: CartaoDaFicha, quemEdita: QuemEditaNoEditor, ficha: FichaDaPrevia): CartaoDaFicha {
  const montado = cartaoComAMecanica(cartao, mecanicaEmBranco(ficha.sistema), quemEdita, ficha)
  if (montado === null) return cartao
  if (quemEdita !== 'mestre') return montado
  const comTexto = cartaoComTextoGerado(cartao, montado, ficha.sistema, 'tecnica')
  return { ...comTexto, extras: comTexto.extras.filter((extra) => extra.nome !== NOME_DO_TEXTO_DE_ANTES) }
}
