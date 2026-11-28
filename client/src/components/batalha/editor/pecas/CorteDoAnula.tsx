import { MENOS_DO_ANULA_MAX, PORCENTO_DO_ANULA_MIN, PORCENTO_QUE_ANULA, type CorteDoAnula } from '../../../../lib/batalha/anulaODano'
import { Frase, Numero, Segmentos, Texto } from './controlesDaPeca'
import type { OpcaoDaPeca } from './vocabulario'

type ModoDoCorte = 'tudo' | 'menos' | 'porcento'

const MODOS_DO_CORTE: readonly OpcaoDaPeca<ModoDoCorte>[] = [
  { valor: 'tudo', rotulo: 'tudo (toma 0)' },
  { valor: 'menos', rotulo: 'parte: −N de dano' },
  { valor: 'porcento', rotulo: 'parte: −X%' },
]

/** O número com que cada modo nasce quando a pessoa troca para ele. */
const MENOS_DE_PARTIDA = 10
const PORCENTO_DE_PARTIDA = 50

function modoDoCorte(corte: CorteDoAnula | undefined): ModoDoCorte {
  if (corte === undefined) return 'tudo'
  return 'menos' in corte ? 'menos' : 'porcento'
}

/**
 * QUANTO ANULA (pedido do dono de 28/11/2026, "coloca para eu anular tudo ou só uma parte, número ou
 * porcentagem"): o mesmo controle no "Anula o dano" da peça Dispara sozinha e na peça Intangível das
 * condições. `undefined` = tudo (toma 0); 100% também anula tudo (`anulaTudo`, lib/batalha/anulaODano.ts).
 */
export function EscolherCorteDoAnula({ corte, aoMudar }: { corte: CorteDoAnula | undefined; aoMudar: (corte: CorteDoAnula | undefined) => void }) {
  const trocarModo = (modo: ModoDoCorte): void => aoMudar(modo === 'tudo' ? undefined : modo === 'menos' ? { menos: MENOS_DE_PARTIDA } : { porcento: PORCENTO_DE_PARTIDA })
  return (
    <Frase sub>
      <Texto>Quanto anula:</Texto>
      <Segmentos rotulo="Quanto anula" valor={modoDoCorte(corte)} opcoes={MODOS_DO_CORTE} onChange={trocarModo} />
      {corte !== undefined && 'menos' in corte && (
        <>
          <Texto>−</Texto>
          <Numero rotulo="Dano que anula" valor={corte.menos} minimo={1} maximo={MENOS_DO_ANULA_MAX} onChange={(menos) => aoMudar({ menos })} />
          <Texto>de dano</Texto>
        </>
      )}
      {corte !== undefined && 'porcento' in corte && (
        <>
          <Texto>−</Texto>
          <Numero rotulo="Porcento do dano que anula" valor={corte.porcento} minimo={PORCENTO_DO_ANULA_MIN} maximo={PORCENTO_QUE_ANULA} onChange={(porcento) => aoMudar({ porcento })} />
          <Texto>% do dano</Texto>
        </>
      )}
    </Frase>
  )
}
