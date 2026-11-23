import { LIMITE_MAX, type MecanicaV1 } from '../../../../lib/batalha/mecanica/modelo'
import { BlocoDoCusto } from '../../blocos/BlocosDoComeco'
import { CampoInteiro, Escolha } from '../../blocos/controles'

type QuandoVolta = 'livre' | 'recarga' | 'usos'

/** Os números de partida do bloco Limites de antes (saiu na ED7; estes ficaram). */
const RECARGA_DE_PARTIDA = 2
const USOS_DE_PARTIDA = 3

/**
 * LINHA CUSTO (EDITOR.md §3.6: `custos`, `limite`, `custoEmItem`): o que gasta
 * (o bloco de hoje, com SP, a técnica mantida e o item da mochila) e quando
 * volta. A Overload é escolhida na linha Ação, então aqui não há a caixa dela:
 * com Overload, "1 vez por batalha" fica travado.
 */
export function LinhaDoCusto({ mecanica, onChange }: { mecanica: MecanicaV1; onChange: (mecanica: MecanicaV1) => void }) {
  const { limite } = mecanica
  const overload = limite.overload === true
  const quando: QuandoVolta = limite.recarga !== undefined ? 'recarga' : limite.usosPorBatalha !== undefined ? 'usos' : 'livre'
  return (
    <>
      <BlocoDoCusto mecanica={mecanica} onChange={onChange} />
      {overload ? (
        <p className="lb-ed__trava">Overload: 1 vez por batalha. Quem muda isso é a linha Ação.</p>
      ) : (
        <>
          <Escolha<QuandoVolta>
            legenda="Quando volta"
            opcoes={[
              { valor: 'livre', rotulo: 'Sempre que tiver o custo' },
              { valor: 'recarga', rotulo: 'Espera rodadas' },
              { valor: 'usos', rotulo: 'Usos por batalha' },
            ]}
            valor={quando}
            onChange={(novo) => onChange({ ...mecanica, limite: novo === 'recarga' ? { recarga: RECARGA_DE_PARTIDA } : novo === 'usos' ? { usosPorBatalha: USOS_DE_PARTIDA } : {} })}
          />
          {limite.recarga !== undefined && (
            <div className="lb-mec__linha lb-mec__linha--recuo">
              <CampoInteiro rotulo="Espera" valor={limite.recarga} minimo={1} maximo={LIMITE_MAX} depois={limite.recarga === 1 ? 'rodada para usar de novo' : 'rodadas para usar de novo'} onChange={(recarga) => onChange({ ...mecanica, limite: { recarga } })} />
            </div>
          )}
          {limite.usosPorBatalha !== undefined && (
            <div className="lb-mec__linha lb-mec__linha--recuo">
              <CampoInteiro rotulo="Até" valor={limite.usosPorBatalha} minimo={1} maximo={LIMITE_MAX} depois="usos por batalha" onChange={(usosPorBatalha) => onChange({ ...mecanica, limite: { usosPorBatalha } })} />
            </div>
          )}
        </>
      )}
    </>
  )
}
