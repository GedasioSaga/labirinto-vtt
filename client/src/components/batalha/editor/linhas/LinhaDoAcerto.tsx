import type { MecanicaV1 } from '../../../../lib/batalha/mecanica/modelo'
import type { FichaDaPrevia } from '../../../../lib/batalha/mecanica/resumo'
import { BlocoDaReacao } from '../../blocos/BlocosDoFim'
import { BlocoDoTeste } from '../../blocos/BlocoDoTeste'
import { categoriaDaMecanica } from '../../../../lib/batalha/mecanica/categoria'

/**
 * LINHA ACERTO (EDITOR.md §5; na Reação ela vira "Defesa"): como o golpe pega
 * ou o que a técnica faz no lugar da reação. A Overload trava o acerto em
 * "não erra" pela linha Ação; aqui ela só avisa.
 */
export function LinhaDoAcerto({ mecanica, ficha, onChange }: { mecanica: MecanicaV1; ficha: FichaDaPrevia; onChange: (mecanica: MecanicaV1) => void }) {
  if (categoriaDaMecanica(mecanica) === 'overload') return <p className="lb-ed__trava">Não erra: o alvo não reage, só outra Overload defende. Quem muda isso é a linha Ação.</p>
  const nosDois = mecanica.uso === 'ativaOuReacao'
  return (
    <>
      {mecanica.uso !== undefined && mecanica.uso !== 'ativa' && (
        <>
          {nosDois && <h4 className="lb-ed__sub">No lugar da reação</h4>}
          <BlocoDaReacao mecanica={mecanica} ficha={ficha} onChange={onChange} />
        </>
      )}
      {mecanica.uso !== 'reacao' && (
        <>
          {nosDois && <h4 className="lb-ed__sub">Na vez</h4>}
          <BlocoDoTeste mecanica={mecanica} ficha={ficha} onChange={onChange} />
        </>
      )}
    </>
  )
}
