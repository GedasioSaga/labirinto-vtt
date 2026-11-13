import { useRef } from 'react'
import { fichasForaDoPadrao, tamanhoPadraoDaCena } from '../lib/tamanhoAoEntrar'
import { nomeDoTamanho, TOKEN_SIZE_MAX_SQUARES, TOKEN_SIZE_MIN_SQUARES, TOKEN_SIZE_OPTIONS } from '../lib/tokenSize'
import { useAdventureStore } from '../stores/adventureStore'
import { useMapStore } from '../stores/mapStore'
import { CampoDoTamanho } from './CampoDoTamanho'
import { TokenSizeArt } from './TokenSizeControls'

export interface SceneTokenSizeControlsProps {
  /** A cena da janela: a aberta (ou o mapa solto, id vazio) ou uma de fundo que já abriu. */
  sceneId: string
}

/** A linha embaixo da escolha: o que ela faz. */
function dicaDoTamanho(padrao: number | null): string {
  if (padrao === null) {
    return `A ficha entra nesta cena com o tamanho que já tinha. Digite um tamanho, de ${nomeDoTamanho(TOKEN_SIZE_MIN_SQUARES)} a ${nomeDoTamanho(TOKEN_SIZE_MAX_SQUARES)}, para todas chegarem com ele.`
  }
  return `Toda ficha que entrar nesta cena chega com ${nomeDoTamanho(padrao)}, até as grandes. Depois você aumenta ou diminui à mão.`
}

/**
 * "TAMANHO DA FICHA AO ENTRAR" (pedido do mestre de 12/11/2026): o lado com
 * que toda ficha chega a esta cena — passagem, escada, "Reunir grupo",
 * "Levar para…", "+ Token" (`lib/tamanhoAoEntrar.ts`). "Não mudar" é o padrão
 * de toda cena de antes.
 *
 * O número se DIGITA (segundo pedido do mesmo dia: "eu quero dizer o quanto
 * tem que mudar"): o campo `CampoDoTamanho`, 0,5 numa cidade grande ou 1,5, de
 * 0,25 a 6 casas, com − e + de 0,1 — o mesmo campo do "Tamanho da ficha" do
 * painel (`TokenSizeControls`). Embaixo, o "Não mudar" de sempre e os atalhos
 * 1, 2 e 3 com a arte de grade. Lado que não é atalho (0,5) deixa só o campo
 * com o número; "Não mudar" deixa o campo vazio.
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
  const secaoRef = useRef<HTMLDivElement>(null)
  const map = aberta ? mapaAberto : slot !== undefined && slot.status === 'ok' ? slot.map : null
  // Cena de fundo ainda vindo do disco: a janela nem abre (`renderSceneSettings`); aqui só não desenha.
  if (map === null) return null
  const padrao = tamanhoPadraoDaCena(map)
  const mudam = fichasForaDoPadrao(map)

  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Fichas</h2>
      <div ref={secaoRef} className="lb-field">
        <span className="lb-label" id="lb-scene-tokensize-label">
          Tamanho da ficha ao entrar
        </span>
        {/* `key` pela cena: o número digitado e não confirmado nunca vai para outra cena. */}
        <CampoDoTamanho
          key={sceneId}
          casas={padrao}
          onTrocar={(casas) => definirTamanhoAoEntrar(sceneId, casas)}
          rotulo="Tamanho da ficha ao entrar, em casas"
          nomeDoPasso="o tamanho da ficha ao entrar"
          dicaId="lb-scene-tokensize-hint"
        />
        <div className="lb-seg" role="radiogroup" aria-labelledby="lb-scene-tokensize-label" aria-describedby="lb-scene-tokensize-hint">
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
              // deixava de fechá-la e o teclado perdia o lugar. O foco vai ao atalho marcado; com um
              // lado que não é atalho (0,5), ao campo, que sempre tem o número escolhido.
              const marcado = secaoRef.current?.querySelector<HTMLButtonElement>('[role="radio"][aria-checked="true"]')
              const alvo = marcado ?? secaoRef.current?.querySelector<HTMLInputElement>('.lb-tamanho__campo')
              alvo?.focus()
            }}
          >
            Aplicar às fichas desta cena ({mudam})
          </button>
        )}
      </div>
    </section>
  )
}
