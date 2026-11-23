import type { AcaoDaMecanica, MecanicaV1, Teste } from '../../../lib/batalha/mecanica/modelo'
import { ehAjuda, motivoDoQuem, trocarQuem, trocarUso } from '../../../lib/batalha/mecanica/modelos'

/**
 * A LINHA AÇÃO do editor novo (ED3; docs/design/habilidades/EDITOR.md §3.3):
 * a categoria não tem campo, sai das peças. A ED2 traz a mesma leitura em
 * `lib/batalha/mecanica/categoria.ts` para o texto gerado; quando ela chegar,
 * `categoriaDaMecanica` passa a ser a de lá (uma leitura só).
 *
 * Passiva não está aqui: é o cartão sem mecânica (decisão de 23/11), e o
 * editor só a escolhe na ED5, junto com o modo "Só texto".
 */
export type CategoriaDaAcao = 'simples' | 'completo' | 'overload' | 'apoio' | 'reacao'

export function categoriaDaMecanica(mecanica: MecanicaV1): CategoriaDaAcao {
  if (mecanica.uso === 'reacao' || mecanica.uso === 'ativaOuReacao') return 'reacao'
  if (mecanica.limite.overload === true) return 'overload'
  if (ehAjuda(mecanica.alvo.quem)) return 'apoio'
  return mecanica.acao === 'completa' ? 'completo' : 'simples'
}

/** Ataque que gasta outra ação (a Bônus, a Livre ou a da hora) continua no cartão "Ataque Simples", com o nome dela. */
const NOME_DO_ATAQUE: Readonly<Record<AcaoDaMecanica, string>> = {
  simples: 'Ataque Simples',
  bonus: 'Ataque Bônus',
  completa: 'Ataque Completo',
  livre: 'Ataque Livre',
  perguntar: 'Ataque (a ação na hora)',
}

/** O nome que abre a frase do papel e a linha curta ("Ataque Completo", "Reação (ou na vez)"). */
export function nomeDaAcao(mecanica: MecanicaV1): string {
  const categoria = categoriaDaMecanica(mecanica)
  if (categoria === 'simples' || categoria === 'completo') return NOME_DO_ATAQUE[mecanica.acao]
  if (categoria === 'reacao') return mecanica.uso === 'ativaOuReacao' ? 'Reação (ou na vez)' : 'Reação'
  return categoria === 'overload' ? 'Overload' : 'Apoio'
}

/** "Tipo na batalha" (§3.3): sai das escolhas, não é mais um campo à parte. */
export function tipoNaBatalha(mecanica: MecanicaV1): 'Ativa' | 'Buff' | 'Debuff' | 'Reação' {
  const categoria = categoriaDaMecanica(mecanica)
  if (categoria === 'reacao') return 'Reação'
  if (categoria === 'apoio') return 'Buff'
  const soPoeSelo = mecanica.dano === undefined && mecanica.efeitos.length > 0 && mecanica.efeitos.every((efeito) => efeito.tipo === 'selo')
  return soPoeSelo ? 'Debuff' : 'Ativa'
}

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
