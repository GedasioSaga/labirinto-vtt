import { useMapStore } from '../stores/mapStore'
import { useFerramentaDoAbismo, type BrilhoEscolhido } from '../stores/ferramentaDoAbismo'

const BRILHOS: Array<{ valor: BrilhoEscolhido; rotulo: string }> = [
  { valor: 'nenhum', rotulo: 'Nenhum' },
  { valor: 'brasa', rotulo: 'Brasa' },
  { valor: 'verde', rotulo: 'Verde' },
]

/**
 * Painel do Abismo (`lib/abismo.ts`), no molde do `BarrancoControls`: o brilho
 * do fundo do próximo abismo e, com um abismo escolhido (clique nele com a
 * ferramenta), o brilho dele na hora e o botão de apagar. Lê e escreve a store
 * direto: preferência da ferramenta e os abismos da cena aberta.
 */
export function AbismoControls() {
  const brilho = useFerramentaDoAbismo((s) => s.brilho)
  const setBrilho = useFerramentaDoAbismo((s) => s.setBrilho)
  const escolhidoId = useFerramentaDoAbismo((s) => s.escolhido)
  const escolher = useFerramentaDoAbismo((s) => s.escolher)
  const escolhido = useMapStore((s) => (escolhidoId === null ? undefined : s.map.abismos?.find((a) => a.id === escolhidoId)))
  const mudarAbismo = useMapStore((s) => s.mudarAbismo)
  const apagarAbismo = useMapStore((s) => s.apagarAbismo)

  const escolherBrilho = (novo: BrilhoEscolhido) => {
    setBrilho(novo)
    if (escolhido !== undefined) mudarAbismo(escolhido.id, novo === 'nenhum' ? null : novo)
  }

  const apagarEscolhido = () => {
    if (escolhido === undefined) return
    apagarAbismo(escolhido.id)
    escolher(null)
  }

  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Brilho no fundo</h2>
      <div className="lb-seg" role="radiogroup" aria-label="Brilho no fundo">
        {BRILHOS.map((opcao) => (
          <button
            key={opcao.valor}
            type="button"
            role="radio"
            aria-checked={(escolhido !== undefined ? (escolhido.brilho ?? 'nenhum') : brilho) === opcao.valor}
            className="lb-seg__option"
            onClick={() => escolherBrilho(opcao.valor)}
          >
            {opcao.rotulo}
          </button>
        ))}
      </div>
      <p className="lb-field__hint">
        {escolhido !== undefined
          ? 'Muda o brilho do abismo escolhido. A brasa e o verde acendem luz em volta à noite.'
          : 'Arraste em volta do buraco para contornar a boca. Clique num abismo para escolher; Delete apaga, Esc solta.'}
      </p>
      {escolhido !== undefined && (
        <>
          <h2 className="lb-eyebrow">Abismo escolhido</h2>
          <div className="lb-section__row">
            <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={apagarEscolhido} aria-keyshortcuts="Delete">
              Apagar o abismo
            </button>
            <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={() => escolher(null)} aria-keyshortcuts="Escape">
              Soltar
            </button>
          </div>
        </>
      )}
      <p className="lb-field__hint">O abismo segura a ficha do jogador: ela não entra no buraco. A visão passa por cima, e o mestre atravessa.</p>
    </section>
  )
}
