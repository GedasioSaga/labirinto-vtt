import type { SceneListItem } from '../stores/adventureStore'
import { TachinhaIcon, TokenIcon } from './icons'
import { RetratosDaCena, type PessoaNaLinha } from './RetratosDaCena'

interface GenteDaCena {
  people: PessoaNaLinha[]
  pendingRequests: number
}

interface HojeNaSessaoProps {
  /** As fixadas, na ordem em que o mestre fixou. */
  fixadas: readonly SceneListItem[]
  /** As últimas abertas, sem as fixadas e sem a aberta (`recentesAVista`). */
  recentes: readonly SceneListItem[]
  /** Quem está em cada cena (o mesmo dado das linhas da árvore). */
  genteDe: (sceneId: string) => GenteDaCena | null
  onSelect: (sceneId: string) => void
  onTirar: (sceneId: string) => void
}

/**
 * "HOJE NA SESSÃO" (lista de cenas, ideia 3), no topo da lista: as cenas que
 * o mestre fixou pelo alfinete (até cinco, na ordem dele), com quem está em
 * cada uma, e logo abaixo as três últimas que ele abriu. Um clique leva à
 * cena; o alfinete da linha tira do topo. A árvore inteira continua embaixo.
 *
 * O nome acessível dos botões diz "(fixada)" e "(recente)": a árvore tem o
 * botão com o nome puro da cena, e os dois não se confundem.
 */
export function HojeNaSessao({ fixadas, recentes, genteDe, onSelect, onTirar }: HojeNaSessaoProps) {
  return (
    <div className="lb-cenas__hoje" role="region" aria-label="Hoje na sessão">
      <p className="lb-cenas__sobrancelha" aria-hidden="true">
        Hoje na sessão
      </p>
      {fixadas.length === 0 ? (
        <p className="lb-cenas__vazio">Nenhuma cena fixada. Passe o mouse numa cena e clique no alfinete, ou use o botão direito.</p>
      ) : (
        <ul className="lb-cenas lb-cenas--fixas" aria-label="Cenas fixadas">
          {fixadas.map((scene) => {
            const gente = genteDe(scene.id)
            return (
              <li key={scene.id} className={scene.active ? 'lb-cenas__item lb-cenas__item--ativa' : 'lb-cenas__item'} data-cena-fixada={scene.id}>
                <div className="lb-cenas__linha">
                  <button
                    type="button"
                    className="lb-cenas__tirar"
                    aria-label={`Tirar ${scene.name} do topo`}
                    title="Tirar do topo"
                    onClick={() => onTirar(scene.id)}
                  >
                    <TachinhaIcon size={14} />
                  </button>
                  <button
                    type="button"
                    className="lb-cenas__nome"
                    aria-label={`${scene.name} (fixada)`}
                    aria-current={scene.active ? 'true' : undefined}
                    disabled={!scene.available}
                    title={scene.name}
                    onClick={() => onSelect(scene.id)}
                  >
                    <span className="lb-cenas__nome-texto">{scene.name}</span>
                  </button>
                  {scene.tokenCount !== null && (
                    <span className="lb-cenas__info">
                      <span className="lb-cenas__conta" title={scene.tokenCount === 1 ? '1 token' : `${scene.tokenCount} tokens`}>
                        <TokenIcon size={12} />
                        {scene.tokenCount}
                      </span>
                    </span>
                  )}
                </div>
                {gente !== null && <RetratosDaCena pessoas={gente.people} pedidos={gente.pendingRequests} />}
              </li>
            )
          })}
        </ul>
      )}
      {recentes.length > 0 && (
        <>
          <p className="lb-cenas__sobrancelha" aria-hidden="true">
            Recentes
          </p>
          <div className="lb-cenas__recentes" role="group" aria-label="Abertas há pouco">
            {recentes.map((scene) => (
              <button
                key={scene.id}
                type="button"
                className="lb-cenas__recente"
                aria-label={`${scene.name} (recente)`}
                title={scene.name}
                disabled={!scene.available}
                onClick={() => onSelect(scene.id)}
              >
                {scene.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
