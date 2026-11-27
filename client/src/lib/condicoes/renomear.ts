import type { CondicaoPropria } from '../../types/map'
import { limparNomeDeCondicao } from '../condicoesProprias'
import type { ItemDoCatalogo } from '../livros/catalogo'
import type { Personagem } from '../personagem'
import { ehDaFabrica } from './fabrica'
import { nomesQueImpedem } from './legado'
import { chaveDaCondicao } from './modelo'
import { nomesNaCriada, nomesNaFicha, nomesNoItemDoCatalogo, resolvedorDeNomes, usosDaCondicao, type AoAcharONome, type FontesDosUsos, type UsoDaCondicao } from './usos'

/**
 * RENOMEAR TAMBÉM NOS N LUGARES (rework das condições, docs/design/condicoes-rework/PLANO.md D5, etapa
 * E2). O nome é a chave da condição no selo, na pastilha e no item: renomear a criada com uso deixaria
 * a técnica e o item apontando para um nome que não acha mais nada. Aqui, o nome de antes vira o novo em
 * todo lugar que o GUARDA (os mesmos de `usosDaCondicao` sem `naoRenomeia`): os cartões e a mochila das
 * fichas da pasta, o gatilho das condições postas, o catálogo do livro e o gatilho das outras criadas.
 * Fica como está o que a tabela do sistema dá (o tipo do golpe, a Fadiga da forma) e o que aponta o id
 * (Aura, Contra-condição): esses vêm em `ficam`, para o aviso dizer.
 *
 * Puro: devolve listas novas só do que mudou (as MESMAS referências sem mudança) e não muda as que
 * recebe. O Desfazer de quem grava é voltar as listas de antes. A própria condição renomeada não muda
 * aqui: quem a grava é o editor (`salvar` da store).
 *
 * API pública: `MotivoDoRenomear`, `RenomeacaoDaCondicao`, `renomearCondicao`.
 */

/**
 * O que aconteceu: `renomeou` (algum lugar mudou), `nadaATrocar` (nenhum lugar guarda o nome), `nomeVazio`,
 * `mesmoNome` (a mesma chave: "congelado" e "Congelado"), `nomeEmUso` (o de outra criada ou de uma das 10
 * de fábrica de hoje, o aviso que impede salvar) ou `deFabrica` (a de fábrica não se renomeia).
 */
export type MotivoDoRenomear = 'renomeou' | 'nadaATrocar' | 'nomeVazio' | 'mesmoNome' | 'nomeEmUso' | 'deFabrica'

export interface RenomeacaoDaCondicao {
  motivo: MotivoDoRenomear
  /** O nome novo como ele é gravado (limpo e no teto). */
  nome: string
  personagens: readonly Personagem[]
  catalogo: readonly ItemDoCatalogo[]
  criadas: readonly CondicaoPropria[]
  /** Os lugares que trocaram o nome. */
  trocados: UsoDaCondicao[]
  /** Os que põem ou citam e não trocam (`naoRenomeia` diz por quê). */
  ficam: UsoDaCondicao[]
}

/** A lista com cada item trocado; a MESMA quando nenhum mudou. */
function trocarNaLista<T>(lista: readonly T[], trocar: (item: T) => T): readonly T[] {
  let mudou = false
  const nova = lista.map((item) => {
    const novo = trocar(item)
    if (novo !== item) mudou = true
    return novo
  })
  return mudou ? nova : lista
}

/**
 * A condição `condicao` (com o nome de ANTES) passa a se chamar `novoNome` em todo lugar das `fontes` que
 * guarda o nome. Os nomes são achados com as criadas de antes (D5), então só muda o que achava esta.
 */
export function renomearCondicao(condicao: Pick<CondicaoPropria, 'id' | 'nome'>, novoNome: string, fontes: FontesDosUsos): RenomeacaoDaCondicao {
  const personagens = fontes.personagens ?? []
  const catalogo = fontes.catalogo ?? []
  const criadas = fontes.criadas ?? []
  const nome = limparNomeDeCondicao(novoNome)
  const semMudar = (motivo: MotivoDoRenomear, ficam: UsoDaCondicao[] = []): RenomeacaoDaCondicao => ({ motivo, nome, personagens, catalogo, criadas, trocados: [], ficam })
  if (ehDaFabrica(condicao.id)) return semMudar('deFabrica')
  if (nome === '') return semMudar('nomeVazio')
  if (chaveDaCondicao(nome) === chaveDaCondicao(condicao.nome)) return semMudar('mesmoNome')
  const chave = chaveDaCondicao(nome)
  if (nomesQueImpedem(criadas, condicao.id).some((ocupado) => chaveDaCondicao(ocupado) === chave)) return semMudar('nomeEmUso')

  const usos = usosDaCondicao(condicao, fontes)
  const trocados = usos.filter((uso) => uso.naoRenomeia === undefined)
  const ficam = usos.filter((uso) => uso.naoRenomeia !== undefined)
  if (trocados.length === 0) return semMudar('nadaATrocar', ficam)

  const idDoNome = resolvedorDeNomes(criadas)
  const aoAchar: AoAcharONome = (achado) => (achado.fixo === undefined && idDoNome(achado.nome) === condicao.id ? nome : null)
  return {
    motivo: 'renomeou',
    nome,
    personagens: trocarNaLista(personagens, (personagem) => nomesNaFicha(personagem, aoAchar)),
    catalogo: trocarNaLista(catalogo, (item) => nomesNoItemDoCatalogo(item, aoAchar)),
    criadas: trocarNaLista(criadas, (propria) => (propria.id === condicao.id ? propria : nomesNaCriada(propria, aoAchar))),
    trocados,
    ficam,
  }
}
