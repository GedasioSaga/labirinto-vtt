import { PRESETS_DE_LUZ, type PresetDeLuz } from '../lib/presetsDeLuz'

export interface PresetDeLuzControlsProps {
  preset: PresetDeLuz
  onPresetChange: (preset: PresetDeLuz) => void
}

/** O que cada preset faz, dito no rodapé (o alcance vem do protótipo aprovado da Luz). */
const DICA: Record<PresetDeLuz, string> = {
  luz: 'Alcance de 4 casas.',
  tocha: 'Alcance de 2,5 casas, luz quente.',
  lampiao: 'Alcance de 3,5 casas, luz quente.',
  fogueira: 'Alcance de 5 casas, luz quente.',
}

/**
 * Ferramenta Luz (Luz L3): o preset da PRÓXIMA luz. Mesmo segmentado em duas
 * colunas das condições da ficha (`lb-seg--pairs`), preferência de ferramenta
 * no store, nunca de luz já colocada (essa se edita no painel dela). Toda luz
 * nova acende sozinha à tarde e à noite; o rodapé diz isso e o arrasto.
 */
export function PresetDeLuzControls({ preset, onPresetChange }: PresetDeLuzControlsProps) {
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Próxima luz</h2>
      <div className="lb-seg lb-seg--pairs" role="radiogroup" aria-label="Próxima luz">
        {PRESETS_DE_LUZ.map((opcao) => (
          <button
            key={opcao.id}
            type="button"
            role="radio"
            aria-checked={preset === opcao.id}
            className="lb-seg__option"
            onClick={() => onPresetChange(opcao.id)}
          >
            {opcao.rotulo}
          </button>
        ))}
      </div>
      <p className="lb-field__hint">
        {DICA[preset]} Em cena externa, acende sozinha à tarde e à noite. Arraste no mapa para escolher outro alcance.
      </p>
    </section>
  )
}
