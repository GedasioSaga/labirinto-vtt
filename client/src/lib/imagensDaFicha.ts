import { isTokenPhotoData } from './tokenPhoto'
import type { FichaDBT } from './dbt/modelo'
import type { CartaoDaFicha, Personagem } from './personagem'

/**
 * As imagens EMBUTIDAS da ficha de personagem (`data:image/...`) e a troca
 * delas pela referência de mídia (`lib/midia.ts`). Regras puras: quem grava
 * no disco e observa a aventura é `stores/midiaDosPersonagens.ts`.
 */

function imagensDoCartao(cartao: CartaoDaFicha, achadas: Set<string>): void {
  if (isTokenPhotoData(cartao.imagem)) achadas.add(cartao.imagem)
  for (const sub of cartao.subcartoes) imagensDoCartao(sub, achadas)
}

/** As imagens embutidas da lista: retratos, imagens de cartão (subcartões inclusos) e das formas do Dragon Ball Tales, sem repetir. */
export function imagensEmbutidas(personagens: readonly Personagem[]): string[] {
  const achadas = new Set<string>()
  for (const personagem of personagens) {
    if (isTokenPhotoData(personagem.retrato)) achadas.add(personagem.retrato)
    for (const cartoes of Object.values(personagem.abas)) for (const cartao of cartoes) imagensDoCartao(cartao, achadas)
    for (const forma of personagem.dbt?.transformacoes ?? []) if (isTokenPhotoData(forma.imagem)) achadas.add(forma.imagem)
  }
  return [...achadas]
}

function cartaoTrocado(cartao: CartaoDaFicha, trocas: ReadonlyMap<string, string>): CartaoDaFicha {
  const imagem = cartao.imagem === null ? null : (trocas.get(cartao.imagem) ?? cartao.imagem)
  const subcartoes = cartao.subcartoes.map((sub) => cartaoTrocado(sub, trocas))
  const mudou = imagem !== cartao.imagem || subcartoes.some((sub, i) => sub !== cartao.subcartoes[i])
  return mudou ? { ...cartao, imagem, subcartoes } : cartao
}

/** O personagem com cada imagem de `trocas` trocada; nada a trocar devolve o MESMO objeto (a sessão compara por referência). */
export function personagemComMidia(personagem: Personagem, trocas: ReadonlyMap<string, string>): Personagem {
  const retrato = personagem.retrato === null ? null : (trocas.get(personagem.retrato) ?? personagem.retrato)
  let abasMudaram = false
  const abas = Object.fromEntries(
    Object.entries(personagem.abas).map(([abaId, cartoes]) => {
      const novos = cartoes.map((cartao) => cartaoTrocado(cartao, trocas))
      if (novos.some((novo, i) => novo !== cartoes[i])) abasMudaram = true
      return [abaId, novos]
    }),
  )
  const dbt = fichaDBTComMidia(personagem.dbt, trocas)
  if (retrato === personagem.retrato && !abasMudaram && dbt === personagem.dbt) return personagem
  const trocado: Personagem = { ...personagem, retrato, abas: abasMudaram ? abas : personagem.abas }
  if (dbt !== undefined) trocado.dbt = dbt
  return trocado
}

/** As formas do Dragon Ball Tales com a imagem trocada; nada a trocar (ou ficha de outro motor) devolve o MESMO bloco. */
function fichaDBTComMidia(ficha: FichaDBT | undefined, trocas: ReadonlyMap<string, string>): FichaDBT | undefined {
  if (ficha === undefined) return undefined
  let mudou = false
  const transformacoes = ficha.transformacoes.map((forma) => {
    const imagem = forma.imagem === undefined ? undefined : trocas.get(forma.imagem)
    if (imagem === undefined) return forma
    mudou = true
    return { ...forma, imagem }
  })
  return mudou ? { ...ficha, transformacoes } : ficha
}
