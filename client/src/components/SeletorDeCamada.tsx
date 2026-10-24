import { useId, useMemo } from 'react'
import { contextoDeCamadas } from '../lib/camadas/consulta'
import { camadaDosItens, motivoParaNaoMover, nomeDaCamada, refsDaSelecao, type RefDeItem } from '../lib/camadas/mover'
import { ehCamadaId } from '../lib/camadas/padrao'
import { useMapStore } from '../stores/mapStore'

/** A frase honesta do telhado: no jogador ele ainda desenha com a ordem e a opacidade de Telhados (fatia 4b). */
const NOTA_DO_TELHADO = 'Para os jogadores, o telhado segue a ordem e a opacidade de Telhados por enquanto; esconder vale.'

/** Valor do `<select>` quando os itens estão em camadas diferentes. */
const VARIAS = ''

interface CampoDeCamadaProps {
  rotulo: string
  refs: readonly RefDeItem[]
  nota?: string
}

/**
 * Um `<select>` nativo (o mesmo `lb-input` dos outros da ficha): setas, letra
 * inicial e Esc do navegador, sem animação a cada troca. As camadas na ordem
 * do painel (de cima para baixo); a travada aparece desligada, no lugar dela.
 * Trocar é UM passo do Ctrl+Z (`mapStore.moverParaCamada`).
 */
function CampoDeCamada({ rotulo, refs, nota }: CampoDeCamadaProps) {
  const id = useId()
  const map = useMapStore((state) => state.map)
  const atual = camadaDosItens(map, refs)
  if (atual === null) return null
  const camadas = contextoDeCamadas(map)
  const motivo = motivoParaNaoMover(map, refs)
  const frase = motivo ?? nota
  const idDaFrase = `${id}-frase`
  return (
    <div className="lb-field">
      <label className="lb-label" htmlFor={id}>
        {rotulo}
      </label>
      <select
        id={id}
        className="lb-input"
        value={atual === 'varias' ? VARIAS : atual}
        disabled={motivo !== null}
        aria-describedby={frase === undefined ? undefined : idDaFrase}
        onChange={(event) => {
          const destino = event.target.value
          if (ehCamadaId(destino)) useMapStore.getState().moverParaCamada(refs, destino)
        }}
      >
        {atual === 'varias' && (
          <option value={VARIAS} disabled>
            Várias camadas
          </option>
        )}
        {[...camadas.ordem].reverse().map((camada) => {
          const travada = camadas.travada(camada)
          const soMestre = camadas.mestreVe(camada) && !camadas.jogadorVe(camada)
          const marca = travada ? ' (travada)' : soMestre ? ' (jogadores não veem)' : ''
          return (
            <option key={camada} value={camada} disabled={travada && camada !== atual}>
              {nomeDaCamada(map, camada)}
              {marca}
            </option>
          )
        })}
      </select>
      {frase !== undefined && (
        <p id={idDaFrase} className="lb-field__hint">
          {frase}
        </p>
      )}
    </div>
  )
}

/**
 * "Camada" do que está selecionado (fatia 8): um item ou vários, de qualquer
 * tipo, e o pino aberto. A sala com teto ganha também "Camada do telhado": o
 * teto muda de camada sozinho, a sala fica em Salas. Lê a seleção da store,
 * como os menus do mapa: um lugar só na ficha, logo abaixo da cabeça.
 */
export function SeletorDeCamada() {
  const selection = useMapStore((state) => state.selection)
  const pinoId = useMapStore((state) => state.selectedPinId)
  const salaComTeto = useMapStore((state) => {
    if (state.selection.length !== 1 || state.selection[0].kind !== 'region') return null
    const regiaoId = state.selection[0].id
    return state.map.regions.some((r) => r.id === regiaoId && r.room?.roof === true) ? regiaoId : null
  })
  const refs = useMemo(() => refsDaSelecao(selection, pinoId), [selection, pinoId])
  const refsDoTelhado = useMemo((): RefDeItem[] => (salaComTeto === null ? [] : [{ tipo: 'telhado', id: salaComTeto }]), [salaComTeto])
  if (refs.length === 0) return null
  return (
    <section className="lb-section" aria-label="Camada do item">
      <CampoDeCamada rotulo="Camada" refs={refs} />
      {refsDoTelhado.length > 0 && <CampoDeCamada rotulo="Camada do telhado" refs={refsDoTelhado} nota={NOTA_DO_TELHADO} />}
    </section>
  )
}
