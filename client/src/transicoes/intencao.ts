import { aquecerAbertura } from './aquecimento'
import { isTransicaoId } from './catalogo'

/**
 * AQUECER PELA INTENÇÃO, lado do MESTRE (09/11/2026): a abertura de batalha
 * que o mestre está para tocar. Quem sabe disso é a tela dele (a escolha
 * "Iniciar batalha" aberta com uma abertura marcada); quem usa é esta página,
 * que pré-compila a cena já (`aquecimento.ts`), e a ponte da sala
 * (`net/hostBridge.ts`), que manda `cutscene.aquecer` aos jogadores e à TV.
 *
 * Aqui só mora o recado, sem rede e sem tela.
 */

let pretendida: string | null = null
const ouvintes = new Set<() => void>()

/**
 * O mestre marcou a abertura `id` (ou trocou de ideia: `null`, "Nenhuma" e id
 * fora da forma valem "nenhuma"). Repetir o mesmo id não avisa de novo.
 */
export function pretenderAbertura(id: string | null | undefined): void {
  const nova = typeof id === 'string' && isTransicaoId(id) ? id : null
  if (nova === pretendida) return
  pretendida = nova
  if (nova !== null) aquecerAbertura(nova)
  for (const ouvinte of ouvintes) ouvinte()
}

/** A abertura que o mestre marcou por último; `null` = nenhuma. */
export function aberturaPretendida(): string | null {
  return pretendida
}

/** Avisa quando a abertura pretendida muda. Devolve o cancelamento. */
export function assinarAberturaPretendida(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
  }
}
