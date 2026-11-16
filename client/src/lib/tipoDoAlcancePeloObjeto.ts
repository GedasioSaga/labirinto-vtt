import type { Token } from '../types/map'

/**
 * O alcance pelo objeto já preso a um recorte: o que as contas de alcance
 * recebem (`tokenReachesPin`, `tokenAlcancaPino`, `fichaAlcancaItem`). A conta
 * mora em `lib/obstaculosDeObjeto.ts` (`alcancaPeloObjeto`, caça de 12/11/2026,
 * J9); as contas de alcance pedem a FUNÇÃO e não importam aquele arquivo:
 * `doorReach`, `items` e `ferrolho` já estão no fecho de imports dele, e o
 * import de volta faria um ciclo novo.
 *
 * O tipo mora aqui, sozinho, porque `lib/items.ts` está no fecho do núcleo da
 * nuvem (`lib/nuvem/pureza.test.ts`), e a guarda segue também o import só de
 * tipo: importado de `obstaculosDeObjeto`, o fecho chegava a Pixi, Tauri e
 * zustand pela névoa (fase de testes da caça de 12/11/2026, B2).
 */
export type AlcancePeloObjeto = (ficha: Pick<Token, 'x' | 'y' | 'piso'>, ponto: PontoDoAlcance, alcance: number) => boolean

/**
 * O ponto que se quer alcançar. `escadaId` (o pino invisível de uma escada,
 * `Pin.escadaId`): a escada inteira é o alvo, não só a boca onde o pino mora.
 */
export interface PontoDoAlcance {
  x: number
  y: number
  escadaId?: string
}
