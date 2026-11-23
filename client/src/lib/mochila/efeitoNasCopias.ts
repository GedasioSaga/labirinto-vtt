import type { CarriedItem } from '../../types/map'
import { efeitoParaDar, requisitosParaDar, type ItemDoCatalogo } from '../acervoDeItens'
import type { Personagem } from '../personagem'

/**
 * O EFEITO DO ITEM NUMA FONTE SÓ (F6 de docs/design/habilidades/ARMAS-FONTE-UNICA.md,
 * a mesma regra das armas): o "O que ele faz" da coisa do Acervo é a verdade;
 * a vaga da mochila dada dela (mesmo `itemId`) é cópia. A cópia não tem editor
 * próprio, então a que já leva efeito e diverge é sempre uma versão velha da
 * fonte: segue sozinha (`segue`). A divergência que pode ser escolha (a vaga
 * dada antes de o item ter efeito, ou com efeito que o Acervo não tem mais)
 * nunca é decidida aqui: vai à lista que o mestre confirma. Puro.
 */

/**
 * A vaga com o efeito do item de agora; o item sem efeito tira o da vaga. Igual = a mesma referência.
 * REQUISITOS (fase B2, REQUISITOS.md §3.2): o bloco anda junto com o efeito, pela mesma regra (a fonte manda).
 */
export function vagaComOEfeitoDoItem(vaga: CarriedItem, item: ItemFonte): CarriedItem {
  if (vaga.itemId !== item.id) return vaga
  const { efeito: _antes, efeitoResumo: _fraseDeAntes, requisitos: _requisitosDeAntes, ...semEfeito } = vaga
  const nova: CarriedItem = { ...semEfeito, ...efeitoParaDar(item), ...requisitosParaDar(item) }
  return JSON.stringify(nova) === JSON.stringify(vaga) ? vaga : nova
}

/** A ficha com as vagas do item atualizadas; nada a mudar = a mesma referência. */
export function fichaComOEfeitoDoItem(personagem: Personagem, item: ItemFonte): Personagem {
  return fichaComAsVagas(personagem, (vaga) => vagaComOEfeitoDoItem(vaga, item))
}

/**
 * Como a cópia difere da fonte:
 * - `segue`: as duas têm efeito (ou nenhuma), a cópia é de uma versão velha: a fonte ganha sem perguntar;
 * - `semEfeitoNaCopia`: dada antes de o item ter efeito (o caso do antigo "Atualizar as cópias");
 * - `semEfeitoNaFonte`: a cópia tem um efeito que a coisa do Acervo não tem mais.
 */
export type CasoDaCopia = 'segue' | 'semEfeitoNaCopia' | 'semEfeitoNaFonte'

export interface CopiaDoItem {
  personagemId: string
  personagemNome: string
  vagaId: string
  itemId: string
  caso: CasoDaCopia
}

/** O que o mestre escolhe para as cópias em conflito: seguir o Acervo, ou separar (a vaga deixa de ser cópia, fica como está). */
export type EscolhaDaCopia = 'acervo' | 'separar'

type ItemFonte = Pick<ItemDoCatalogo, 'id' | 'efeito' | 'requisitos'>

function casoDa(vaga: CarriedItem, item: ItemFonte): CasoDaCopia {
  if (item.efeito !== undefined) return vaga.efeito === undefined ? 'semEfeitoNaCopia' : 'segue'
  return vaga.efeito === undefined ? 'segue' : 'semEfeitoNaFonte'
}

/** O ENSAIO: toda vaga ligada a uma coisa que existe e que difere dela. A vaga solta (sem `itemId`) ou de coisa apagada fica fora. */
export function ensaiarCopias(personagens: readonly Personagem[], acervo: readonly ItemFonte[]): CopiaDoItem[] {
  const porId = new Map(acervo.map((item) => [item.id, item]))
  return personagens.flatMap((personagem) =>
    (personagem.mochila ?? []).flatMap((vaga): CopiaDoItem[] => {
      const item = vaga.itemId === undefined ? undefined : porId.get(vaga.itemId)
      if (item === undefined || vagaComOEfeitoDoItem(vaga, item) === vaga) return []
      return [{ personagemId: personagem.id, personagemNome: personagem.nome, vagaId: vaga.id, itemId: item.id, caso: casoDa(vaga, item) }]
    }),
  )
}

function fichaComAsVagas(personagem: Personagem, mudar: (vaga: CarriedItem) => CarriedItem): Personagem {
  const mochila = personagem.mochila
  if (mochila === undefined) return personagem
  const nova = mochila.map(mudar)
  return nova.every((vaga, indice) => vaga === mochila[indice]) ? personagem : { ...personagem, mochila: nova }
}

/** As fichas com as cópias listadas trocadas por `mudar`; nada a mudar = a mesma referência em cada ficha. */
function comAsCopias(personagens: readonly Personagem[], copias: readonly CopiaDoItem[], mudar: (vaga: CarriedItem, copia: CopiaDoItem) => CarriedItem): Personagem[] {
  const porFicha = new Map<string, Map<string, CopiaDoItem>>()
  for (const copia of copias) porFicha.set(copia.personagemId, (porFicha.get(copia.personagemId) ?? new Map<string, CopiaDoItem>()).set(copia.vagaId, copia))
  return personagens.map((personagem) => {
    const daFicha = porFicha.get(personagem.id)
    if (daFicha === undefined) return personagem
    return fichaComAsVagas(personagem, (vaga) => {
      const copia = daFicha.get(vaga.id)
      return copia === undefined ? vaga : mudar(vaga, copia)
    })
  })
}

/** ABRIR A PASTA: só as cópias `segue` voltam ao que a fonte diz; as em conflito ficam como estão, esperando o mestre. */
export function comAsCopiasQueSeguem(personagens: readonly Personagem[], acervo: readonly ItemFonte[]): Personagem[] {
  const porId = new Map(acervo.map((item) => [item.id, item]))
  const seguem = ensaiarCopias(personagens, acervo).filter((copia) => copia.caso === 'segue')
  return comAsCopias(personagens, seguem, (vaga, copia) => {
    const item = porId.get(copia.itemId)
    return item === undefined ? vaga : vagaComOEfeitoDoItem(vaga, item)
  })
}

/** A ESCOLHA do mestre para as cópias em conflito de UM item: seguir o Acervo, ou separar (tira só o `itemId`). */
export function comAEscolhaDasCopias(personagens: readonly Personagem[], item: ItemFonte, escolha: EscolhaDaCopia): Personagem[] {
  const conflitos = ensaiarCopias(personagens, [item]).filter((copia) => copia.caso !== 'segue')
  return comAsCopias(personagens, conflitos, (vaga) => {
    if (escolha === 'acervo') return vagaComOEfeitoDoItem(vaga, item)
    const { itemId: _ligacao, ...solta } = vaga
    return solta
  })
}

/** SALVAR A COISA: as que existiam antes e cujo efeito (ou bloco de requisitos, fase B2) mudou nesta gravação (as cópias delas seguem, todas). */
export function itensComOEfeitoMudado<T extends ItemFonte>(antes: readonly T[], depois: readonly T[]): T[] {
  const deAntes = new Map(antes.map((item) => [item.id, item]))
  return depois.filter((item) => {
    const velho = deAntes.get(item.id)
    return velho !== undefined && velho !== item && (JSON.stringify(velho.efeito) !== JSON.stringify(item.efeito) || JSON.stringify(velho.requisitos) !== JSON.stringify(item.requisitos))
  })
}
