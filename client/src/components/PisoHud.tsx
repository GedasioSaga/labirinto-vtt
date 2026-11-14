import { useLayoutEffect, useRef } from 'react'
import { PISO_MAX, PISO_MIN, alturaDoPiso, nomeDoPiso } from '../lib/pisos'
import { NOME_DA_ALTURA } from '../lib/terrenoAlto'
import { useMapStore } from '../stores/mapStore'
import type { AlturaDoPiso } from '../types/map'
import './PisoHud.css'

export interface PisoHudProps {
  /** O piso que o editor mostra e em que ele constrói (0 = térreo). */
  piso: number
  onPisoChange: (piso: number) => void
}

/** "Térreo", "1º piso": o nome do piso com a inicial maiúscula, para o rótulo solto no canto. */
function rotuloDoPiso(piso: number): string {
  const nome = nomeDoPiso(piso)
  return nome.charAt(0).toUpperCase() + nome.slice(1)
}

const ALTURAS: readonly AlturaDoPiso[] = ['baixa', 'media', 'alta']
/** O que cada altura faz com o piso de baixo, na dica do botão. */
const EFEITO_NA_DICA: Readonly<Record<AlturaDoPiso, string>> = { baixa: 'pouco borrado', media: 'borrado', alta: 'bem borrado e escuro' }

/**
 * TERRENO ALTO — a "Altura" do piso em edição sobre o de baixo: quanto mais
 * alto, mais borrado e escuro o piso de baixo aparece (no editor e para quem
 * está em cima). Lê e grava a cena aberta direto na store, com desfazer, sem
 * passar pelo App; o térreo não tem a escolha (não há o que ver embaixo).
 */
function AlturaDoPisoHud({ piso }: { piso: number }) {
  const altura = useMapStore((state) => alturaDoPiso(state.map, piso))
  return (
    <div className="lb-seg lb-pisohud__altura" role="radiogroup" aria-label={`Altura do ${nomeDoPiso(piso)}`}>
      <span className="lb-pisohud__rotulo" aria-hidden="true">
        Altura
      </span>
      {ALTURAS.map((opcao) => (
        <button
          key={opcao}
          type="button"
          role="radio"
          aria-checked={altura === opcao}
          className="lb-seg__option lb-pisohud__opcao"
          title={`${NOME_DA_ALTURA[opcao]}: o ${nomeDoPiso(piso - 1)} embaixo fica ${EFEITO_NA_DICA[opcao]}`}
          onClick={() => useMapStore.getState().definirAlturaDoPiso(piso, opcao)}
        >
          {NOME_DA_ALTURA[opcao]}
        </button>
      ))}
    </div>
  )
}

/**
 * A largura do HUD no `.lb-editor` onde ele mora (`--lb-pisohud-largura`),
 * enquanto ele está no mapa: os avisos dos NPCs, no mesmo pé do mapa, param
 * antes dele (AvisoDaRotina.css). Medida, porque muda com a Altura (do 1º
 * piso para cima) e com o nome do piso. Antes da pintura, para o aviso não
 * passar um quadro por cima.
 */
function usePublicarLargura() {
  const ref = useRef<HTMLDivElement | null>(null)
  useLayoutEffect(() => {
    const hud = ref.current
    const editor = hud?.parentElement ?? null
    if (hud === null || editor === null || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => editor.style.setProperty('--lb-pisohud-largura', `${hud.offsetWidth}px`))
    observer.observe(hud)
    return () => {
      observer.disconnect()
      editor.style.removeProperty('--lb-pisohud-largura')
    }
  }, [])
  return ref
}

/**
 * PISOS NA MESMA CENA — o piso em edição, no canto do canvas, acima do zoom.
 * O editor desenha e mira só este piso, e tudo que o mestre cria nasce nele;
 * os botões sobem e descem um piso (o de cima pode estar vazio: é assim que
 * um piso novo começa). Do 1º piso para cima, a "Altura" dele fica ao lado.
 * Plano em `docs/planos/pisos-na-mesma-cena.md`.
 */
export function PisoHud({ piso, onPisoChange }: PisoHudProps) {
  const ref = usePublicarLargura()
  const acima = piso + 1
  const abaixo = piso - 1
  return (
    <div ref={ref} className="lb-panel lb-pisohud" role="group" aria-label="Piso em edição">
      {piso >= 1 && (
        <>
          <AlturaDoPisoHud piso={piso} />
          <span className="lb-pisohud__divisa" aria-hidden="true" />
        </>
      )}
      <button
        type="button"
        className="lb-pisohud__step"
        disabled={abaixo < PISO_MIN}
        onClick={() => onPisoChange(abaixo)}
        aria-label={`Editar o ${nomeDoPiso(abaixo)}`}
        title={`Editar o ${nomeDoPiso(abaixo)}`}
      >
        <span aria-hidden="true">▼</span>
      </button>
      <span className="lb-pisohud__value" aria-live="polite">
        {rotuloDoPiso(piso)}
      </span>
      <button
        type="button"
        className="lb-pisohud__step"
        disabled={acima > PISO_MAX}
        onClick={() => onPisoChange(acima)}
        aria-label={`Editar o ${nomeDoPiso(acima)}`}
        title={`Editar o ${nomeDoPiso(acima)}`}
      >
        <span aria-hidden="true">▲</span>
      </button>
    </div>
  )
}
