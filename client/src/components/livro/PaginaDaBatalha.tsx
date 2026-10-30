import { useState } from 'react'
import { useBatalhaStore } from '../../stores/batalhaStore'
import { BatalhaDoMestre, DialogoDoMestreNaCena, type DialogoDoMestre } from '../batalha/BatalhaDoMestre'
import { PainelDoMestre } from '../batalha/PainelDoMestre'
import { ControleDaBatalha, type ControleDaBatalhaProps } from './ControleDaBatalha'

/**
 * A PÁGINA BATALHA do livro da mesa (F2, seção 5.1 do plano; pedido do
 * usuário em 30/10: "Acho que batalha pode ficar na própria aba"). De cima
 * para baixo: o Iniciar / Encerrar de sempre (`ControleDaBatalha`: abertura,
 * nome, desempate, regra do campo, Zerar caminhos e o Shift+B) e, com a
 * batalha ligada na cena aberta, o painel da vez (o do NPC com técnicas,
 * sugestão e Executar; ou "Vez de Lia" com Ações extras e Dar dano), as
 * reações pendentes e o painel do mestre (a ordem, as equipes, as regras do
 * campo e o registro).
 *
 * Fica sempre montada, como toda folha do livro: o Shift+B mora no
 * `ControleDaBatalha` e vale com qualquer página à vista.
 */

export function PaginaDaBatalha(props: ControleDaBatalhaProps) {
  const ligada = useBatalhaStore((state) => Object.hasOwn(state.cenas, props.sceneKey))
  const [dialogo, setDialogo] = useState<DialogoDoMestre | null>(null)
  return (
    // `div` com papel de região, e não `section`: as jornadas acham seções pela tag.
    <div className="lb-batalha-pagina" role="region" aria-label="Batalha">
      <ControleDaBatalha {...props} />
      {ligada ? (
        <>
          <BatalhaDoMestre sceneKey={props.sceneKey} onDialogo={setDialogo} />
          <PainelDoMestre sceneKey={props.sceneKey} />
          {dialogo !== null && <DialogoDoMestreNaCena sceneKey={props.sceneKey} dialogo={dialogo} onFechar={() => setDialogo(null)} />}
        </>
      ) : (
        <p className="lb-batalha-pagina__vazia">
          Sem batalha nesta cena. Ao iniciar, as fichas com personagem entram na ordem dos turnos pela Agilidade, e esta página mostra de quem é a vez, a ordem, as
          equipes, as regras do campo e o registro.
        </p>
      )}
    </div>
  )
}
