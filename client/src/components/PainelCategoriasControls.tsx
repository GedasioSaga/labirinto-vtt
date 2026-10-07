import { usePainelCategoriasStore } from '../stores/painelCategoriasStore'
import { Toggle } from './Toggle'

const DICA_ID = 'lb-categorias-so-sem-selecao-dica'

/**
 * "Painel lateral" da janela Configurações do mapa: liga/desliga esconder
 * Aventura e Esta cena enquanto há ferramenta na mão ou objeto selecionado.
 */
export function PainelCategoriasControls() {
  const soSemSelecao = usePainelCategoriasStore((state) => state.soSemSelecao)
  const setSoSemSelecao = usePainelCategoriasStore((state) => state.setSoSemSelecao)
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Painel lateral</h2>
      <Toggle
        label="Esconder Aventura e Esta cena ao usar ferramenta"
        checked={soSemSelecao}
        onChange={setSoSemSelecao}
        describedBy={DICA_ID}
      />
      <p className="lb-field__hint" id={DICA_ID}>
        Pinos, Objetos do mapa e Locais só aparecem com nada selecionado. Vale para todos os mapas.
      </p>
    </section>
  )
}
