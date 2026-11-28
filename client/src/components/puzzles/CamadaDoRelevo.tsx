import { useMemo } from 'react'
import { classes } from '../grimorio/comum'
import { DESCRICAO_DAS_PLACAS } from '../../puzzles/relevo/arte'
import { geometriaDaPlaca } from '../../puzzles/relevo/PainelNoQuadro'
import { comPlacaTrocada, placasDoPuzzle } from '../../puzzles/relevo/relevo'
import { LACUNAS_DO_RELEVO_MAX, LACUNAS_DO_RELEVO_MIN, PLACAS_DO_RELEVO, type EncaixeNaVista, type Puzzle, type VisualDoRelevo } from '../../puzzles/tipos'

/**
 * A CAMADA DO PAINEL EM RELEVO NO EDITOR (28/11): as 12 placas por cima do
 * painel, cada uma um botão com a forma dela. Clicar (ou Enter/Espaço com o
 * foco) faz a placa faltar ou voltar; o vão de verdade aparece embaixo, no
 * `QuadroDoPuzzle`, igual ao que o jogador vê. Sem arrastar: o vão é a placa.
 */

/** Os vãos como o jogador os vê (todos vazios), para o editor mostrar o painel com as placas faltando. */
export function vaosDoEditor(puzzle: Puzzle): EncaixeNaVista[] {
  return puzzle.encaixes.flatMap((encaixe) =>
    encaixe.placa === undefined ? [] : [{ id: encaixe.id, x: encaixe.x, y: encaixe.y, t: encaixe.t, forma: encaixe.forma, jeito: 'peca' as const, posta: null, placa: encaixe.placa }],
  )
}

interface PropsDaCamada {
  puzzle: Puzzle
  visual: VisualDoRelevo
  onMudar: (proximo: Puzzle) => void
  onAviso?: (texto: string, tipo?: 'info' | 'error') => void
}

export function CamadaDoRelevo({ puzzle, visual, onMudar, onAviso }: PropsDaCamada) {
  const faltam = placasDoPuzzle(puzzle)
  const placas = useMemo(() => Array.from({ length: PLACAS_DO_RELEVO }, (_, placa) => ({ placa, ...geometriaDaPlaca(visual.cena, placa) })), [visual.cena])
  const trocar = (placa: number) => {
    const proximo = comPlacaTrocada(puzzle, placa)
    if (proximo === null) {
      const tirando = faltam.includes(placa)
      onAviso?.(tirando ? `O painel precisa de pelo menos ${LACUNAS_DO_RELEVO_MIN} placas faltando.` : `No máximo ${LACUNAS_DO_RELEVO_MAX} placas faltando. Devolva uma antes.`, 'error')
      return
    }
    onMudar(proximo)
  }
  return (
    <div className="pze-camada pze-relevo">
      {placas.map(({ placa, caixa, d, estilo }) => {
        const falta = faltam.includes(placa)
        const descricao = visual.cena === null ? `placa ${placa + 1}` : (DESCRICAO_DAS_PLACAS[visual.cena][placa] ?? `placa ${placa + 1}`)
        const numero = falta ? faltam.indexOf(placa) + 1 : 0
        return (
          <button
            key={placa}
            type="button"
            className={classes('pze-relevo__placa', falta && 'is-falta')}
            style={estilo}
            aria-pressed={falta}
            aria-label={`Placa ${placa + 1}, ${descricao}: ${falta ? 'falta no painel. Enter devolve' : 'no painel. Enter tira'}`}
            onClick={() => trocar(placa)}
          >
            <svg viewBox={`0 0 ${caixa.largura.toFixed(1)} ${caixa.altura.toFixed(1)}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
              <path className="pze-relevo__toque" d={d} />
              <path className="pze-relevo__borda" d={d} vectorEffect="non-scaling-stroke" />
            </svg>
            {falta && <span className="pze-relevo__num">{numero}</span>}
          </button>
        )
      })}
    </div>
  )
}
