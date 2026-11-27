import { useState } from 'react'
import { useMesaDaBatalha } from '../../batalhaJanela/controleDaJanela'
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
 * Com a mesa da batalha à vista (encostada no mapa ou na janela à parte;
 * auditoria de 19/11), a vez, o Passar a vez, o Ordenar e o registro moram
 * nela: a página não repete, e fica com dano, selos, ações extras, regras,
 * equipes e o incluir na batalha. Sem a mesa (o modo "como jogador"), a página volta inteira.
 *
 * Fica sempre montada, como toda folha do livro: o Shift+B mora no
 * `ControleDaBatalha` e vale com qualquer página à vista.
 */

export function PaginaDaBatalha(props: ControleDaBatalhaProps) {
  const ligada = useBatalhaStore((state) => Object.hasOwn(state.cenas, props.sceneKey))
  // A mesa (minimalista ou na janela) tem a vez; no modo "como jogador" (One Piece) ou "pelo livro" (Dragon Ball), a página volta inteira.
  const comAMesa = useMesaDaBatalha((state) => state.modo !== 'jogador')
  const [dialogo, setDialogo] = useState<DialogoDoMestre | null>(null)
  return (
    // `div` com papel de região, e não `section`: as jornadas acham seções pela tag.
    <div className="lb-batalha-pagina" role="region" aria-label="Batalha">
      <ControleDaBatalha {...props} />
      {ligada ? (
        <>
          <BatalhaDoMestre sceneKey={props.sceneKey} onDialogo={setDialogo} comAMesa={comAMesa} />
          <PainelDoMestre sceneKey={props.sceneKey} comAMesa={comAMesa} />
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
