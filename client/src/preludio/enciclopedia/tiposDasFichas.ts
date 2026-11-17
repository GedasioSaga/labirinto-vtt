import { useEffect } from 'react'
import { create } from 'zustand'
import { lerRpgDaPasta } from '../../lib/pastasDeMapas'
import type { Personagem, TipoDePersonagem } from '../../lib/personagem'
import type { TiposDasFichas } from '../../lib/preparo/fichaDoVerbete'
import type { Verbete } from '../../lib/preparo/tipos'

/**
 * O TIPO DAS FICHAS LIGADAS (pedido 6 de 17/11/2026): o verbete só guarda o id
 * da ficha, e o selo "NPC" ou "Jogador" depende do `rpg.json` da pasta. Esta
 * loja lê cada pasta uma vez e guarda o tipo de cada ficha; quem já leu a pasta
 * por outro caminho (a escolha de ficha, o Virar NPC) anota aqui, e o selo
 * muda na hora.
 */

interface EstadoDosTipos {
  tipos: TiposDasFichas
}

export const useTiposDasFichas = create<EstadoDosTipos>()(() => ({ tipos: new Map() }))

/** As fichas de uma pasta inteira, como acabaram de ser lidas: trocam o que havia dessa pasta. */
export function anotarFichasDaPasta(pastaId: string, personagens: readonly Pick<Personagem, 'id' | 'tipo'>[]): void {
  const tipos = new Map(useTiposDasFichas.getState().tipos)
  tipos.set(pastaId, new Map(personagens.map((personagem): [string, TipoDePersonagem] => [personagem.id, personagem.tipo])))
  useTiposDasFichas.setState({ tipos })
}

/** Uma ficha só (a que o Virar NPC acabou de gravar, ou a de mesmo nome que ele ligou). */
export function anotarFicha(pastaId: string, personagem: Pick<Personagem, 'id' | 'tipo'>): void {
  const tipos = new Map(useTiposDasFichas.getState().tipos)
  tipos.set(pastaId, new Map([...(tipos.get(pastaId) ?? []), [personagem.id, personagem.tipo]]))
  useTiposDasFichas.setState({ tipos })
}

/** `pastaId/personagemId` já pedidos ao disco: a ficha que a pasta não tem (apagada) não relê a pasta a cada render. */
const pedidas = new Set<string>()

/** As pastas a ler: as que têm alguma ficha ligada que a loja ainda não conhece e que ainda não foi pedida. */
export function pastasParaLer(verbetes: Iterable<Pick<Verbete, 'liga'>>, tipos: TiposDasFichas, jaPedidas: Set<string>): string[] {
  const pastas = new Set<string>()
  for (const verbete of verbetes) {
    for (const ficha of verbete.liga?.fichas ?? []) {
      const chave = `${ficha.pastaId}/${ficha.personagemId}`
      if (jaPedidas.has(chave) || tipos.get(ficha.pastaId)?.has(ficha.personagemId) === true) continue
      jaPedidas.add(chave)
      pastas.add(ficha.pastaId)
    }
  }
  return [...pastas]
}

async function lerTiposDaPasta(pastaId: string): Promise<void> {
  const lido = await lerRpgDaPasta(pastaId)
  // Pasta que não abriu: o verbete continua "NPC" (o selo de antes), sem erro na lista.
  if (lido.ok) anotarFichasDaPasta(pastaId, lido.rpg.personagens)
}

/** O tipo das fichas ligadas a estes verbetes; lê do disco as pastas que faltam (a ficha ainda não lida conta como NPC). */
export function useTiposDasFichasLigadas(verbetes: Iterable<Pick<Verbete, 'liga'>>): TiposDasFichas {
  const tipos = useTiposDasFichas((estado) => estado.tipos)
  useEffect(() => {
    for (const pastaId of pastasParaLer(verbetes, tipos, pedidas)) void lerTiposDaPasta(pastaId)
  }, [verbetes, tipos])
  return tipos
}
