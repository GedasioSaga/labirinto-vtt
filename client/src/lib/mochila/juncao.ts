import type { CarriedItem, Token } from '../../types/map'
import { quantidadeDe } from '../items'
import type { Personagem } from '../personagem'
import { moedasDe } from '../troca'

/**
 * MOCHILA NA FICHA — a JUNÇÃO da migração (docs/planos/lobby-jogadores-2026-11-05.md
 * §4 e §8.1, fatia A2; decisão 12.2 do usuário).
 *
 * Antes, a mochila e a bolsa moravam no BONECO (`Token.mochila/moedas`), um
 * por cena: o Luffy da Sky Lagoon e o do Reino de Goa tinham mochilas
 * separadas. Agora moram na FICHA. A junção decide o que a ficha leva:
 *
 * - a BASE é o boneco da cena gravada por último (`gravadaEm`): a mochila e a
 *   bolsa dele valem;
 * - o mesmo item numa cena mais antiga, diferente (Poção x3 lá, x1 aqui), não
 *   muda nada: vira uma linha do relatório;
 * - item que só existe numa cena mais antiga (id diferente) também fica na
 *   ficha, e vai para o relatório — o mestre confere se ele ainda vale;
 * - bolsa diferente numa cena mais antiga: relatório, nunca soma.
 *
 * Boneco sem ficha (NPC sem ficha, `characterId` nulo ou de ninguém da lista)
 * nem entra: a mochila dele continua no boneco. Pura: nada de disco nem store.
 */

/** De onde veio uma mochila: o mapa, a cena e quando a cena foi gravada. */
export interface OrigemDaMochila {
  /** Nome do mapa (ou da aventura). */
  mapa: string
  /** Nome da cena; vazio no mapa solto. */
  cena: string
  /**
   * Quando a cena foi gravada, em ms desde a época (o `mtime` do `map.json`,
   * ou a hora da cópia de recuperação para o mapa recuperado). 0 = o disco não
   * disse: perde de qualquer cena com hora.
   */
  gravadaEm: number
}

/** O mínimo do boneco que a junção lê. */
export type BonecoDaJuncao = Pick<Token, 'characterId' | 'mochila' | 'moedas'>

/** Uma cena lida para a junção: a origem e os bonecos dela. */
export interface CenaDaJuncao {
  origem: OrigemDaMochila
  bonecos: readonly BonecoDaJuncao[]
}

/** A ficha que já tinha mochila antes da migração entra como a fonte mais velha, com esta origem. */
export const ORIGEM_DA_PROPRIA_FICHA: OrigemDaMochila = { mapa: 'a própria ficha', cena: '', gravadaEm: 0 }

/** O que difere entre a base e outra cena — uma linha do relatório. */
export type DiferencaDaMochila =
  | {
      /** O mesmo item (mesma vaga, ou a mesma pilha) com outro dado: vale o da base. */
      tipo: 'item-diferente'
      personagemId: string
      personagem: string
      vale: CarriedItem
      outro: CarriedItem
      origem: OrigemDaMochila
    }
  | {
      /** Item que a base não tem: FICOU na ficha, para o mestre conferir. */
      tipo: 'item-de-outra-cena'
      personagemId: string
      personagem: string
      item: CarriedItem
      origem: OrigemDaMochila
    }
  | {
      /** Bolsa diferente noutra cena: vale a da base. */
      tipo: 'moedas-diferentes'
      personagemId: string
      personagem: string
      vale: number
      outra: number
      origem: OrigemDaMochila
    }

/** De qual cena veio a mochila de uma ficha. */
export interface BaseDaFicha {
  personagemId: string
  personagem: string
  origem: OrigemDaMochila
}

export interface JuncaoDaMochila {
  /** As fichas, na mesma ordem; a que não tem boneco em cena nenhuma volta igual (a mesma referência). */
  personagens: Personagem[]
  /** Uma por ficha que tem boneco em alguma cena. */
  bases: BaseDaFicha[]
  /** Fichas sem boneco em cena nenhuma: ficaram como estavam. */
  semBoneco: { personagemId: string; personagem: string }[]
  diferencas: DiferencaDaMochila[]
}

/** Uma mochila e uma bolsa de um lugar: um boneco numa cena, ou a própria ficha. */
interface Fonte {
  mochila: readonly CarriedItem[]
  moedas: number
  origem: OrigemDaMochila
}

/** A pilha do item: o item do acervo, só quando ele empilha (dar de novo soma na mesma vaga, `darDoAcervoChange`). */
function pilhaDe(item: CarriedItem): string | undefined {
  return item.empilhavel === true ? item.itemId : undefined
}

/** O mesmo item em duas mochilas: a mesma vaga, ou a mesma pilha do acervo. */
function mesmoItem(a: CarriedItem, b: CarriedItem): boolean {
  if (a.id === b.id) return true
  const pilha = pilhaDe(a)
  return pilha !== undefined && pilha === pilhaDe(b)
}

/** Os dados que o mestre vê do item; a vaga (`id`) fica de fora — a mesma pilha em vagas diferentes, com tudo igual, não é diferença. */
function itensIguais(a: CarriedItem, b: CarriedItem): boolean {
  return (
    a.nome === b.nome &&
    a.itemId === b.itemId &&
    a.imagem === b.imagem &&
    a.descricao === b.descricao &&
    a.categoria === b.categoria &&
    a.preco === b.preco &&
    a.empilhavel === b.empilhavel &&
    quantidadeDe(a) === quantidadeDe(b)
  )
}

/**
 * As fontes da ficha `id`, da mais nova para a mais velha: os bonecos ligados
 * a ela, cena gravada por último primeiro (empate: a ordem em que as cenas
 * chegaram), e por fim a mochila que a própria ficha já tivesse.
 */
function fontesDa(personagem: Personagem, cenasDaMaisNova: readonly CenaDaJuncao[]): Fonte[] {
  const fontes: Fonte[] = []
  for (const cena of cenasDaMaisNova) {
    for (const boneco of cena.bonecos) {
      if (boneco.characterId !== personagem.id) continue
      fontes.push({ mochila: boneco.mochila ?? [], moedas: moedasDe(boneco), origem: cena.origem })
    }
  }
  if (fontes.length > 0 && (personagem.mochila !== undefined || personagem.moedas !== undefined)) {
    fontes.push({ mochila: personagem.mochila ?? [], moedas: moedasDe(personagem), origem: ORIGEM_DA_PROPRIA_FICHA })
  }
  return fontes
}

/** A ficha com a mochila e a bolsa novas; vazia e zero tiram a chave (ausente === vazia, como no boneco). */
export function fichaComMochila(personagem: Personagem, mochila: readonly CarriedItem[], moedas: number): Personagem {
  const { mochila: _antes, moedas: _bolsaDeAntes, ...semMochila } = personagem
  return {
    ...semMochila,
    ...(mochila.length > 0 ? { mochila: [...mochila] } : {}),
    ...(Number.isInteger(moedas) && moedas > 0 ? { moedas } : {}),
  }
}

/** Junta as fontes de uma ficha: a primeira é a base; das outras, só o item que a base não tem entra. */
function juntarFontes(personagem: Personagem, fontes: readonly Fonte[]): { mochila: CarriedItem[]; moedas: number; diferencas: DiferencaDaMochila[] } {
  const [base, ...outras] = fontes
  const mochila: CarriedItem[] = [...base.mochila]
  const diferencas: DiferencaDaMochila[] = []
  const quem = { personagemId: personagem.id, personagem: personagem.nome }
  for (const fonte of outras) {
    for (const item of fonte.mochila) {
      const igual = mochila.find((jaNaFicha) => mesmoItem(jaNaFicha, item))
      if (igual === undefined) {
        mochila.push(item)
        diferencas.push({ tipo: 'item-de-outra-cena', ...quem, item, origem: fonte.origem })
      } else if (!itensIguais(igual, item)) {
        diferencas.push({ tipo: 'item-diferente', ...quem, vale: igual, outro: item, origem: fonte.origem })
      }
    }
    if (fonte.moedas !== base.moedas) diferencas.push({ tipo: 'moedas-diferentes', ...quem, vale: base.moedas, outra: fonte.moedas, origem: fonte.origem })
  }
  return { mochila, moedas: base.moedas, diferencas }
}

/** A junção da migração: ver o comentário do arquivo. Não muda as listas recebidas. */
export function juntarMochilas(personagens: readonly Personagem[], cenas: readonly CenaDaJuncao[]): JuncaoDaMochila {
  // `sort` estável: no empate de hora, vale a ordem em que as cenas chegaram.
  const cenasDaMaisNova = [...cenas].sort((a, b) => b.origem.gravadaEm - a.origem.gravadaEm)
  const bases: BaseDaFicha[] = []
  const semBoneco: JuncaoDaMochila['semBoneco'] = []
  const diferencas: DiferencaDaMochila[] = []
  const migrados = personagens.map((personagem) => {
    const fontes = fontesDa(personagem, cenasDaMaisNova)
    if (fontes.length === 0) {
      semBoneco.push({ personagemId: personagem.id, personagem: personagem.nome })
      return personagem
    }
    const juntado = juntarFontes(personagem, fontes)
    bases.push({ personagemId: personagem.id, personagem: personagem.nome, origem: fontes[0].origem })
    diferencas.push(...juntado.diferencas)
    return fichaComMochila(personagem, juntado.mochila, juntado.moedas)
  })
  return { personagens: migrados, bases, semBoneco, diferencas }
}
