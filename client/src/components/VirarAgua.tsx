import type { Agua, FloorPiece, TipoDeAgua } from '../types/map'
import { useMapStore } from '../stores/mapStore'
import { useToastStore } from '../stores/toastStore'
import { useFerramentaDaAgua } from '../stores/ferramentaDaAgua'
import { ehTintaMar } from '../lib/camadasDoChao'
import { aguasDaPeca } from '../lib/agua/virarAgua'

/**
 * "VIRAR ÁGUA" (decisão do mestre de 12/11/2026, a recomendada): a tinta Mar
 * saiu da lista do Chão; a peça antiga pintada de Mar continua igual e ganha,
 * na ficha dela, a troca por água de verdade. A água nasce com o contorno da
 * peça (`lib/agua/virarAgua.ts`) e a peça fica como Chão por baixo, para o
 * limite da cena não mudar.
 */
export function VirarAgua({ piece }: { piece: FloorPiece }) {
  const map = useMapStore((s) => s.map)
  const porAgua = useMapStore((s) => s.porAgua)
  if (!ehTintaMar(piece)) return null
  const virar = (tipo: TipoDeAgua) => {
    const aguas: Agua[] = aguasDaPeca(piece, map, tipo)
    if (aguas.length === 0) {
      useToastStore.getState().push('instrucao', 'Esta peça é pequena demais para virar água.')
      return
    }
    for (const agua of aguas) porAgua(agua)
    useFerramentaDaAgua.getState().escolher(aguas[0].id)
    useToastStore.getState().push('info', `A peça virou ${tipo === 'mar' ? 'mar' : 'lago'}. Ela continua como Chão por baixo; a água se ajusta na ferramenta Água.`)
  }
  return (
    <section className="lb-section" aria-label="Virar água">
      <h2 className="lb-eyebrow">Água</h2>
      <p className="lb-label">Troca a tinta Mar desta peça por água animada, com o mesmo contorno. O limite da cena não muda.</p>
      <div className="lb-section__row">
        <button type="button" className="lb-btn" onClick={() => virar('lago')}>
          Virar lago
        </button>
        <button type="button" className="lb-btn" onClick={() => virar('mar')}>
          Virar mar
        </button>
      </div>
    </section>
  )
}
