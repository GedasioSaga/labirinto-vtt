/**
 * A COR DA CHAMA (I0-c do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`): laranja (a de
 * sempre), azul, verde ou roxa, lida da VERSÃO do objeto (`Prop.mobiliaVersao`, `lib/mobilia/versoes.ts`). A versão
 * cujo id é `'azul'`, `'verde'` ou `'roxa'` pinta a chama, a fagulha e a luz nesse tom; qualquer outra versão (e a
 * falta dela) fica na laranja. Assim o braseiro, as tochas e o pilar com braseiro do L02 ganham a cor só com a linha
 * da tabela de versões e o desenho da brasa no tom, sem campo novo no mapa.
 *
 * Tons na régua "não estoura" (canal até 245, saturação contida): a borda escura e o miolo claro de cada cor têm a
 * mesma luz da laranja, e a luz do chão é o miolo mais claro e mais branco.
 *
 * Sem import de Pixi nem de `types/map.ts`: só a tabela de versões, sem ciclo.
 */
import type { TipoMobilia } from './tipos'
import { normalizarVersaoDoMovel } from './versoes'

export type CorDaChama = 'laranja' | 'azul' | 'verde' | 'roxa'

export const CORES_DA_CHAMA: readonly CorDaChama[] = ['laranja', 'azul', 'verde', 'roxa']

export interface TonsDaChama {
  /** A língua de fora, a cor da chama. */
  readonly borda: number
  /** O miolo claro, de dentro. */
  readonly miolo: number
  readonly fagulha: number
  /** A luz no chão em volta (`lib/luzDoFogo.ts`); `undefined` na laranja = a luz de cada tipo, a de sempre. */
  readonly luz: number | undefined
}

export const TONS_DA_CHAMA: Readonly<Record<CorDaChama, TonsDaChama>> = {
  // A de sempre (`pixi/chamasDasFogueiras.ts`, aprovação do usuário): a borda quente, o miolo creme.
  laranja: { borda: 0xa04a2c, miolo: 0xf0c98a, fagulha: 0xf6dca8, luz: undefined },
  // Fogo-fátuo e chama de gás: o azul acinzentado, sem neon.
  azul: { borda: 0x2f5a8a, miolo: 0xbcdcec, fagulha: 0xd6eaf2, luz: 0xc4dcf0 },
  // Chama de enxofre e de bruxaria: o verde musgo aceso.
  verde: { borda: 0x3c6e34, miolo: 0xcfe6a8, fagulha: 0xe0eec4, luz: 0xd4ecb4 },
  // Chama do inferno e de magia: o roxo de ameixa.
  roxa: { borda: 0x5e3478, miolo: 0xdcc2ea, fagulha: 0xe8d6f0, luz: 0xdcc8f0 },
}

function ehCorDaChama(valor: string): valor is CorDaChama {
  return CORES_DA_CHAMA.some((cor) => cor === valor)
}

/** A cor da chama do objeto: a da versão gravada, se ela for uma cor; senão a laranja. */
export function corDaChamaDoMovel(prop: { readonly mobilia?: TipoMobilia; readonly mobiliaVersao?: string }): CorDaChama {
  const versao = normalizarVersaoDoMovel(prop.mobilia, prop.mobiliaVersao)
  return versao !== undefined && ehCorDaChama(versao) ? versao : 'laranja'
}
