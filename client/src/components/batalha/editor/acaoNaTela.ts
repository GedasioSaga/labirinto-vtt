import { categoriaDaMecanica, type CategoriaDaAcao } from '../../../lib/batalha/mecanica/categoria'
import type { AcaoDaMecanica, MecanicaV1, Teste } from '../../../lib/batalha/mecanica/modelo'
import { ehAjuda, motivoDoQuem, trocarQuem, trocarUso } from '../../../lib/batalha/mecanica/modelos'

/**
 * A LINHA AÇÃO do editor novo (EDITOR.md §3.3): a categoria não tem campo, sai
 * das peças, numa leitura só para a tela e o texto gerado
 * (`lib/batalha/mecanica/categoria.ts`). Aqui fica só o que a tela faz com
 * ela: trocar de categoria e dizer o que a troca tirou.
 */

/** Por que a categoria não pode ser escolhida agora; `null` = pode (a cura e o reviver prendem o alvo). */
export function motivoDaCategoria(mecanica: MecanicaV1, categoria: CategoriaDaAcao): string | null {
  if (categoria === categoriaDaMecanica(mecanica) || categoria === 'reacao') return null
  if (categoria === 'apoio') return motivoDoQuem(mecanica, 'aliados')
  return ehAjuda(mecanica.alvo.quem) ? motivoDoQuem(mecanica, 'inimigos') : null
}

/** O teste de quem sai da Overload: o que havia antes dela, ou o de partida ("o alvo reage"). */
const TESTE_DE_PARTIDA: Teste = { tipo: 'reacao' }

/**
 * A mecânica na categoria escolhida. A Overload trava o resto (1 por batalha,
 * Ação Completa, não erra); ao sair dela, `testeAntes` devolve o teste de antes.
 * A Reação tira o dano e os efeitos da vez (`trocarUso`): o editor avisa e o
 * Ctrl+Z devolve.
 */
export function mecanicaNaCategoria(mecanica: MecanicaV1, categoria: CategoriaDaAcao, testeAntes: Teste | null): MecanicaV1 {
  const eraOverload = mecanica.limite.overload === true
  const { overload: _overload, ...limiteSemOverload } = mecanica.limite
  const teste = eraOverload ? (testeAntes ?? TESTE_DE_PARTIDA) : mecanica.teste
  const naVez = mecanica.uso === 'reacao' || mecanica.uso === 'ativaOuReacao' ? trocarUso(mecanica, 'ativa') : mecanica
  switch (categoria) {
    case 'reacao':
      return trocarUso({ ...mecanica, limite: limiteSemOverload, teste }, mecanica.uso === 'ativaOuReacao' ? 'ativaOuReacao' : 'reacao')
    case 'apoio':
      return trocarQuem({ ...naVez, limite: limiteSemOverload, teste }, 'aliados')
    case 'overload': {
      // A Overload de transformação (D5) não bate: fica em quem usa e liga como Livre (`formaMontada`, transformacao.ts).
      if ((naVez.pecas ?? []).some((peca) => peca.tipo === 'transformacao')) return { ...naVez, acao: 'livre', limite: { overload: true }, teste: { tipo: 'naoErra' } }
      const contra = ehAjuda(naVez.alvo.quem) ? trocarQuem(naVez, 'inimigos') : naVez
      return { ...contra, acao: 'completa', limite: { overload: true }, teste: { tipo: 'naoErra' } }
    }
    case 'simples':
    case 'completo': {
      const contra = ehAjuda(naVez.alvo.quem) ? trocarQuem(naVez, 'inimigos') : naVez
      const acao: AcaoDaMecanica = categoria === 'completo' ? 'completa' : contra.acao === 'completa' ? 'simples' : contra.acao
      return { ...contra, acao, limite: limiteSemOverload, teste }
    }
  }
}

/** O que a troca de categoria tirou (o dano, os efeitos), para o aviso com Desfazer; `null` = nada saiu. */
export function oQueSaiu(antes: MecanicaV1, depois: MecanicaV1): string | null {
  const semDano = antes.dano !== undefined && depois.dano === undefined
  const efeitosQueSairam = antes.efeitos.length - depois.efeitos.length
  if (!semDano && efeitosQueSairam <= 0) return null
  const partes = [semDano ? 'o dano' : null, efeitosQueSairam > 0 ? (efeitosQueSairam === 1 ? '1 efeito' : `${efeitosQueSairam} efeitos`) : null].filter((parte) => parte !== null)
  return `${partes.join(' e ')} ${partes.length > 1 || efeitosQueSairam > 1 ? 'saíram' : 'saiu'}`
}
