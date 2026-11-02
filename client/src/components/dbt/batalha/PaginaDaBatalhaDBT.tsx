import { useBatalhaDBTStore } from '../../../stores/batalhaDBTStore'
import { ControleDaBatalhaDBT, type ControleDaBatalhaDBTProps } from './ControleDaBatalhaDBT'
import { PainelDoMestreDBT } from './PainelDoMestreDBT'

/**
 * A PÁGINA BATALHA do livro da mesa numa aventura Dragon Ball Tales (seção
 * 18, `App.tsx:4347`: o App escolhe esta ou a do One Piece pelo motor do
 * sistema). O Iniciar / Encerrar de sempre e, com a batalha ligada na cena
 * aberta, o painel do mestre. Fica sempre montada: o Shift+B mora no controle.
 */

export function PaginaDaBatalhaDBT(props: ControleDaBatalhaDBTProps) {
  const ligada = useBatalhaDBTStore((state) => Object.hasOwn(state.cenas, props.sceneKey))
  return (
    <div className="lb-batalha-pagina" role="region" aria-label="Batalha">
      <ControleDaBatalhaDBT {...props} />
      {ligada ? (
        <PainelDoMestreDBT sceneKey={props.sceneKey} />
      ) : (
        <p className="lb-batalha-pagina__vazia">
          Sem batalha nesta cena. Ao iniciar, você escolhe quais fichas da cena entram e de que lado, cada uma declara se transforma antes, a iniciativa sai de d20 + DES + EP, e esta página mostra a
          vez, as ações com o custo de Ki, as reações, a ordem e o registro.
        </p>
      )}
    </div>
  )
}
