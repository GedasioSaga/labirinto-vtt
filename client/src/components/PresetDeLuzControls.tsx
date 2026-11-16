import { OBJETOS_DE_LUZ } from '../lib/presetsDeLuz'
import type { TipoMobilia } from '../types/map'
import { useMapStore } from '../stores/mapStore'

/** Arma a ferramenta Objeto com o fogo escolhido: o próximo clique no mapa põe o objeto, que acende sozinho. */
function porObjetoDeLuz(tipo: TipoMobilia): void {
  const loja = useMapStore.getState()
  loja.setMobiliaTipo(tipo)
  loja.setActiveTool('mobilia')
}

/**
 * Ferramenta Luz (Luz L3; Fase 6 de 16/11/2026, "Luz da tocha no objeto"): o que
 * a ferramenta cria é a LUZ SOLTA, sem objeto. A tocha, o lampião e a fogueira
 * não são mais presets daqui: os botões levam ao Objeto, e a luz vem dele (acende
 * e apaga na ficha do objeto). Uma luz de preset de mapa antigo continua igual.
 */
export function PresetDeLuzControls() {
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Próxima luz</h2>
      <p className="lb-field__hint">
        Luz solta, sem objeto: alcance de 4 casas. Em cena externa, acende sozinha à tarde e à noite. Arraste no mapa para escolher outro alcance.
      </p>
      <h2 className="lb-eyebrow">Fogo que ilumina</h2>
      <div className="lb-seg" role="group" aria-label="Pôr um objeto que ilumina">
        {OBJETOS_DE_LUZ.map((opcao) => (
          <button key={opcao.tipo} type="button" className="lb-seg__option" onClick={() => porObjetoDeLuz(opcao.tipo)}>
            {opcao.rotulo}
          </button>
        ))}
      </div>
      <p className="lb-field__hint">A tocha, o lampião e a fogueira são objetos: a luz vem deles e se apaga na ficha do objeto. Não ponha uma luz em cima, ou o lugar fica claro em dobro.</p>
    </section>
  )
}
