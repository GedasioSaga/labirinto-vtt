import { useMapStore } from '../stores/mapStore'
import { useToastStore } from '../stores/toastStore'
import { EMPTY_SELECTION, selectionSingle } from '../lib/selectionModel'
import { caminhoQueGanhaMaterial, materialPelaCor, MATERIAIS_DO_CHAO } from '../lib/terrenoDoChao'

/**
 * DAR MATERIAL (pedido CHÃO E CAMINHO de 12/11/2026): na ficha de um caminho
 * antigo (desenho `path`, da ferramenta Caminho que saiu da barra), o botão
 * que o troca por terreno do Chão, na mesma rota e largura, sem mudar o limite
 * da cena (a peça nasce com "Conta como Chão" desligado). O segundo botão faz
 * o mesmo com todos os caminhos da mesma cor no mesmo piso. Caminho secreto
 * fica como está: a peça de Chão iria para o jogador.
 */
export function DarMaterialAoCaminho() {
  const selection = useMapStore((s) => s.selection)
  const drawings = useMapStore((s) => s.map.drawings)
  const darMaterial = useMapStore((s) => s.darMaterialAosCaminhos)
  const setSelection = useMapStore((s) => s.setSelection)
  const single = selectionSingle(selection)
  const caminho = single?.kind === 'drawing' ? drawings.find((d) => d.id === single.id) : undefined
  if (caminho === undefined || caminho.kind !== 'path') return null

  const nomeDoMaterial = MATERIAIS_DO_CHAO.find((m) => m.textura === materialPelaCor(caminho.color))?.nome ?? ''
  const mesmaCor = drawings.filter(
    (d) => d.kind === 'path' && d.color.toLowerCase() === caminho.color.toLowerCase() && (d.piso ?? 0) === (caminho.piso ?? 0) && caminhoQueGanhaMaterial(d),
  )
  const trocar = (ids: string[]) => {
    const quantos = darMaterial(ids)
    if (quantos === 0) return
    setSelection(EMPTY_SELECTION)
    useToastStore.getState().push('info', quantos === 1 ? `O caminho virou terreno (${nomeDoMaterial}).` : `${quantos} caminhos viraram terreno (${nomeDoMaterial}).`)
  }

  return (
    <section className="lb-section" aria-label="Dar material ao caminho">
      <h2 className="lb-eyebrow">Terreno</h2>
      {caminhoQueGanhaMaterial(caminho) ? (
        <>
          <p className="lb-label">Troca este caminho por terreno do Chão ({nomeDoMaterial}), na mesma rota. O limite da cena não muda.</p>
          <button type="button" className="lb-btn lb-btn--block" onClick={() => trocar([caminho.id])}>
            Dar material
          </button>
          {mesmaCor.length > 1 && (
            <button type="button" className="lb-btn lb-btn--block" onClick={() => trocar(mesmaCor.map((d) => d.id))}>
              Dar material aos {mesmaCor.length} caminhos desta cor
            </button>
          )}
        </>
      ) : (
        <p className="lb-label">Caminho secreto fica como está: como terreno, ele apareceria para os jogadores.</p>
      )}
    </section>
  )
}
