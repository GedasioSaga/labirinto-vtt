import { useRef } from 'react'
import { fichasForaDoPadrao, tamanhoPadraoDaCena } from '../lib/tamanhoAoEntrar'
import { TOKEN_SIZE_OPTIONS } from '../lib/tokenSize'
import { useAdventureStore } from '../stores/adventureStore'
import { useMapStore } from '../stores/mapStore'
import { TokenSizeArt } from './TokenSizeControls'

export interface SceneTokenSizeControlsProps {
  /** A cena da janela: a aberta (ou o mapa solto, id vazio) ou uma de fundo que já abriu. */
  sceneId: string
}

/** "2 casas", o mesmo nome dos botões do painel da ficha. */
function nomeDoTamanho(cells: number): string {
  return TOKEN_SIZE_OPTIONS.find((option) => option.value === cells)?.label ?? `${cells} casas`
}

/** A linha embaixo da escolha: o que ela faz. */
function dicaDoTamanho(padrao: number | null): string {
  if (padrao === null) return 'A ficha entra nesta cena com o tamanho que já tinha.'
  return `Toda ficha que entrar nesta cena chega com ${nomeDoTamanho(padrao)}, até as grandes. Depois você aumenta ou diminui à mão.`
}

/**
 * "TAMANHO DA FICHA AO ENTRAR" (pedido do mestre de 12/11/2026): o lado com
 * que toda ficha chega a esta cena — passagem, escada, "Reunir grupo",
 * "Levar para…", "+ Token" (`lib/tamanhoAoEntrar.ts`). "Não mudar" é o padrão
 * de toda cena de antes. Os mesmos três botões do "Tamanho da ficha" do painel
 * (`TokenSizeControls`), com a arte de grade, mais o "Não mudar" à frente.
 *
 * "Aplicar às fichas desta cena (N)": põe o padrão nas fichas que já estão
 * aqui, num passo só do Ctrl+Z. N = quantas mudam; com nenhuma a mudar, o
 * botão fica desligado.
 *
 * Lê a cena das stores, como o "Fora do Chão" (`SceneVisionControls`): a
 * aberta do mapa vivo, a de fundo do cache da aventura.
 */
export function SceneTokenSizeControls({ sceneId }: SceneTokenSizeControlsProps) {
  const aberta = useAdventureStore((state) => sceneId === (state.activeSceneId ?? ''))
  const mapaAberto = useMapStore((state) => state.map)
  const slot = useAdventureStore((state) => state.cache[sceneId])
  const definirTamanhoAoEntrar = useAdventureStore((state) => state.definirTamanhoAoEntrar)
  const aplicarTamanhoAsFichasDaCena = useAdventureStore((state) => state.aplicarTamanhoAsFichasDaCena)
  const grupoRef = useRef<HTMLDivElement>(null)
  const map = aberta ? mapaAberto : slot !== undefined && slot.status === 'ok' ? slot.map : null
  // Cena de fundo ainda vindo do disco: a janela nem abre (`renderSceneSettings`); aqui só não desenha.
  if (map === null) return null
  const padrao = tamanhoPadraoDaCena(map)
  const mudam = fichasForaDoPadrao(map)

  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Fichas</h2>
      <div className="lb-field">
        <span className="lb-label" id="lb-scene-tokensize-label">
          Tamanho da ficha ao entrar
        </span>
        <div ref={grupoRef} className="lb-seg" role="radiogroup" aria-labelledby="lb-scene-tokensize-label" aria-describedby="lb-scene-tokensize-hint">
          <button type="button" role="radio" aria-checked={padrao === null} className="lb-seg__option" onClick={() => definirTamanhoAoEntrar(sceneId, undefined)}>
            Não mudar
          </button>
          {TOKEN_SIZE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={padrao === option.value}
              aria-label={option.label}
              className="lb-seg__option"
              onClick={() => definirTamanhoAoEntrar(sceneId, option.value)}
            >
              <TokenSizeArt cells={option.value} />
              {option.value}
            </button>
          ))}
        </div>
        <p id="lb-scene-tokensize-hint" className="lb-field__hint">
          {dicaDoTamanho(padrao)}
        </p>
        {padrao !== null && (
          <button
            type="button"
            className="lb-btn lb-btn--ghost lb-btn--compact"
            disabled={mudam === 0}
            title={
              mudam === 0
                ? 'Todas as fichas desta cena já estão neste tamanho.'
                : `Põe ${nomeDoTamanho(padrao)} nas fichas que já estão nesta cena. ${aberta ? 'Ctrl+Z desfaz.' : 'Ctrl+Z desfaz quando a cena estiver aberta.'}`
            }
            onClick={() => {
              aplicarTamanhoAsFichasDaCena(sceneId)
              // O botão se desliga ("(0)") e o foco cairia no corpo da página, fora da janela: o Esc
              // deixava de fechá-la e o teclado perdia o lugar. O foco vai ao tamanho escolhido.
              grupoRef.current?.querySelector<HTMLButtonElement>('[role="radio"][aria-checked="true"]')?.focus()
            }}
          >
            Aplicar às fichas desta cena ({mudam})
          </button>
        )}
      </div>
    </section>
  )
}
