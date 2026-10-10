import type { ModoDoPenhasco } from '../types/map'
import type { LarguraDoPenhasco } from '../lib/penhasco'
import { relevoLigado } from '../lib/relevo'
import { useMapStore } from '../stores/mapStore'

const MODOS: Array<{ modo: ModoDoPenhasco; rotulo: string }> = [
  { modo: 'riscar', rotulo: 'Riscar' },
  { modo: 'apagar', rotulo: 'Apagar' },
]

const LARGURAS: Array<{ largura: LarguraDoPenhasco; rotulo: string }> = [
  { largura: 'fina', rotulo: 'Fino' },
  { largura: 'media', rotulo: 'Médio' },
  { largura: 'larga', rotulo: 'Largo' },
]

/**
 * Painel do Penhasco (`lib/penhasco.ts`): o que o PRÓXIMO risco faz e a largura
 * do pincel, no mesmo segmentado do Pincel de revelar (`ConcealBrushControls`).
 * "Apagar" existe além do Alt pelo mesmo motivo de lá: Alt segurado durante um
 * arrasto não é gesto que todo mundo descobre.
 *
 * Lê e escreve a store direto (como `EndireitarControl`): são preferências da
 * ferramenta e a chave do relevo da cena aberta, sem nada para o App repassar.
 * Com o relevo desligado o penhasco não aparece, e o painel diz isso com o
 * botão que resolve, em vez de o risco sumir calado.
 */
export function PenhascoControls() {
  const modo = useMapStore((s) => s.penhascoModo)
  const setModo = useMapStore((s) => s.setPenhascoModo)
  const largura = useMapStore((s) => s.penhascoLargura)
  const setLargura = useMapStore((s) => s.setPenhascoLargura)
  const comRelevo = useMapStore((s) => relevoLigado(s.map))
  const temPenhasco = useMapStore((s) => s.map.penhascos !== undefined)
  const setRelevo = useMapStore((s) => s.setRelevo)
  const apagarTodos = useMapStore((s) => s.apagarTodosOsPenhascos)

  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Ao riscar</h2>
      <div className="lb-seg" role="radiogroup" aria-label="Ao riscar">
        {MODOS.map((opcao) => (
          <button
            key={opcao.modo}
            type="button"
            role="radio"
            aria-checked={modo === opcao.modo}
            className="lb-seg__option"
            onClick={() => setModo(opcao.modo)}
          >
            {opcao.rotulo}
          </button>
        ))}
      </div>
      <p className="lb-field__hint">
        {modo === 'apagar'
          ? 'Arraste sobre o penhasco para tirar o trecho. Segure Alt para riscar.'
          : 'Risque por cima da costa: a parede nasce na beira entre a terra e o mar, descendo para a água. Segure Alt para apagar.'}
      </p>
      <h2 className="lb-eyebrow">Largura do pincel</h2>
      <div className="lb-seg" role="radiogroup" aria-label="Largura do pincel">
        {LARGURAS.map((opcao) => (
          <button
            key={opcao.largura}
            type="button"
            role="radio"
            aria-checked={largura === opcao.largura}
            className="lb-seg__option"
            onClick={() => setLargura(opcao.largura)}
          >
            {opcao.rotulo}
          </button>
        ))}
      </div>
      {!comRelevo && (
        <>
          <p className="lb-field__hint">O penhasco faz parte do relevo, que está desligado nesta cena.</p>
          <button type="button" className="lb-btn lb-btn--compact" onClick={() => setRelevo(true)}>
            Ligar o relevo
          </button>
        </>
      )}
      {temPenhasco && (
        <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={apagarTodos}>
          Apagar todos os penhascos
        </button>
      )}
    </section>
  )
}
