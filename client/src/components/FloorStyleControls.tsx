import { useId } from 'react'
import type { FloorStyle, MapFrame } from '../types/map'
import { AdvancedField, AdvancedSection } from './AdvancedSection'
import { Toggle } from './Toggle'
import './FloorStyleControls.css'
import { CampoDeCorComPipeta } from './CampoDeCorComPipeta'

export interface FloorStyleControlsProps {
  style: FloorStyle
  onStyleChange: (patch: Partial<FloorStyle>) => void
  frame: MapFrame | null
  onFrameChange: (frame: MapFrame | null) => void
  /** Retângulo usado ao ligar a moldura pela primeira vez. */
  defaultFrameRect: Pick<MapFrame, 'x' | 'y' | 'w' | 'h'>
  /** O mapa tem peças de chão, linhas ou portas de minimapa. Cor, contorno,
   *  precisão e render fiel só desenham isso; sem nada, mudar não aparece. */
  hasFloorContent: boolean
}

const DEFAULT_FRAME_TITLE = 'Mapa'

/** `FloorStyle.sampleStep` ausente === 2 (types/map.ts). */
const DEFAULT_SAMPLE_STEP = 2
/** Cor do contorno ao ligá-lo pela primeira vez — escuro lê como borda sobre qualquer preenchimento. */
const DEFAULT_STROKE_COLOR = '#000000'

const SAMPLE_STEP_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0.5, label: 'Alta' },
  { value: 1, label: 'Média' },
  { value: 2, label: 'Rápida' },
]

/**
 * Estilo do chão do MAPA inteiro (não de uma peça). A criação de peças a
 * partir da imagem de fundo saiu daqui para o menu do botão de imagem da
 * ActionBar, que só existe quando há imagem.
 *
 * Peça mapa-inteiro-enxuto (laudo do painel, rodada 2): cada cor mora na
 * linha do rótulo (`FloorStyleControls.css`), e a frase de mapa sem chão é a
 * explicação de "Cor do chão" e de "Contorno", no "?" deles.
 */
export function FloorStyleControls({
  style,
  onStyleChange,
  frame,
  onFrameChange,
  defaultFrameRect,
  hasFloorContent,
}: FloorStyleControlsProps) {
  const sampleStep = style.sampleStep ?? DEFAULT_SAMPLE_STEP
  const semChaoId = `${useId()}-sem-chao`
  /** Sem chão no mapa, cor e contorno não aparecem na tela: os dois apontam a frase que diz por quê. */
  const explicaSemChao = hasFloorContent ? undefined : semChaoId

  // Sem <section>/título próprios: quem envolve é a `CollapsibleSection`
  // "Chão" do PropertiesPanel, que já é a seção e o cabeçalho.
  return (
    <>
      <div className="lb-field lb-floor-linha">
        <label className="lb-label" htmlFor="lb-floor-fill-color">
          Cor do chão
        </label>
        <CampoDeCorComPipeta
          id="lb-floor-fill-color"
          value={style.fillColor}
          aria-describedby={explicaSemChao}
          rotuloDaPipeta="Pegar do mapa a cor do chão"
          onChange={(cor) => onStyleChange({ fillColor: cor })}
        />
      </div>

      <Toggle
        label="Contorno"
        checked={style.strokeColor !== null}
        describedBy={explicaSemChao}
        onChange={(checked) => onStyleChange({ strokeColor: checked ? DEFAULT_STROKE_COLOR : null })}
      />
      {style.strokeColor !== null && (
        <div className="lb-field lb-floor-linha">
          <label className="lb-label" htmlFor="lb-floor-stroke-color">
            Cor do contorno
          </label>
          <CampoDeCorComPipeta
            id="lb-floor-stroke-color"
            value={style.strokeColor}
            rotuloDaPipeta="Pegar do mapa a cor do contorno"
            onChange={(cor) => onStyleChange({ strokeColor: cor })}
          />
        </div>
      )}
      {!hasFloorContent && (
        // Num mapa sem chão estes controles não mudam nada na tela; a frase
        // evita que pareçam quebrados e aponta onde o chão nasce. Ligada aos
        // dois por `aria-describedby`, ela sai da coluna e vira o balão do "?"
        // deles (dica sob demanda, `lib/dicaDoPainel.ts`): o leitor de tela
        // continua lendo a frase como descrição de cada um.
        <p className="lb-field__hint" id={semChaoId}>
          Vale para o chão por peças e para o minimapa recriado. Este mapa ainda não tem nenhum: use a ferramenta Chão ou o menu da imagem de fundo.
        </p>
      )}

      {/* Decisão do usuário (14/09/2026): controles técnicos ficam no Avançado, fechado, com a frase do que fazem. */}
      <AdvancedSection>
        <AdvancedField hint="Quanto o contorno do chão segue a forma original: Alta é mais fiel e mais lenta, Rápida é mais leve.">
          {(hintId) => (
            <div className="lb-field">
              <span className="lb-label">Precisão do contorno</span>
              <div className="lb-seg" role="radiogroup" aria-label="Precisão do contorno do chão" aria-describedby={hintId}>
                {SAMPLE_STEP_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={sampleStep === option.value}
                    className="lb-seg__option"
                    onClick={() => onStyleChange({ sampleStep: option.value })}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </AdvancedField>

        <AdvancedField hint="Desenha o minimapa recriado ponto a ponto, igual à imagem original, em vez de traços.">
          {(hintId) => (
            <Toggle
              label="Render fiel (minimapa)"
              checked={style.renderMode === 'raster'}
              describedBy={hintId}
              onChange={(checked) => onStyleChange({ renderMode: checked ? 'raster' : 'vector' })}
            />
          )}
        </AdvancedField>

        <AdvancedField hint="Coloca uma moldura com título em volta do mapa, como numa folha impressa.">
          {(hintId) => (
            <>
              <Toggle
                label="Moldura com título"
                checked={frame !== null}
                describedBy={hintId}
                onChange={(checked) => onFrameChange(checked ? { title: DEFAULT_FRAME_TITLE, ...defaultFrameRect } : null)}
              />
              {frame !== null && (
                <div className="lb-field">
                  <label className="lb-label" htmlFor="lb-map-frame-title">
                    Título da moldura
                  </label>
                  <input
                    id="lb-map-frame-title"
                    className="lb-input"
                    type="text"
                    value={frame.title}
                    onChange={(event) => onFrameChange({ ...frame, title: event.target.value })}
                  />
                </div>
              )}
            </>
          )}
        </AdvancedField>
      </AdvancedSection>
    </>
  )
}
