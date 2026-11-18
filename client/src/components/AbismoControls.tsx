import type { PincelDaArea } from '../lib/barranco'
import { semAbismoPintadoNoPiso } from '../lib/abismoPintado'
import { pisoDe } from '../lib/pisos'
import { useMapStore } from '../stores/mapStore'
import { useFerramentaDoAbismo, type BrilhoEscolhido, type ModoDoAbismo } from '../stores/ferramentaDoAbismo'
import { Segmentado } from './BarrancoControls'

const MODOS: Array<{ valor: ModoDoAbismo; rotulo: string }> = [
  { valor: 'contornar', rotulo: 'Contornar' },
  { valor: 'pincel', rotulo: 'Pincel' },
]

const PINCEIS: Array<{ valor: PincelDaArea; rotulo: string }> = [
  { valor: 'fino', rotulo: 'Fino' },
  { valor: 'medio', rotulo: 'Médio' },
  { valor: 'largo', rotulo: 'Largo' },
]

const BRILHOS: Array<{ valor: BrilhoEscolhido; rotulo: string }> = [
  { valor: 'nenhum', rotulo: 'Nenhum' },
  { valor: 'brasa', rotulo: 'Brasa' },
  { valor: 'verde', rotulo: 'Verde' },
]

const DICA_DO_MODO: Readonly<Record<ModoDoAbismo, string>> = {
  contornar: 'Arraste em volta do buraco para contornar a boca. Clique num abismo contornado para escolher; Delete apaga, Esc solta.',
  pincel: 'Pinte para cavar o buraco. Segure Alt para tapar: tapar no meio deixa uma ilha de chão.',
}

const DICA_DO_BRILHO: Readonly<Record<ModoDoAbismo, string>> = {
  contornar: 'Vale para o próximo abismo. A brasa e o verde acendem luz em volta à noite.',
  pincel: 'Vale para o buraco em que você pintar: um toque dentro dele troca o brilho. A brasa e o verde acendem luz em volta à noite.',
}

/**
 * Painel do Abismo (`lib/abismo.ts` e `lib/abismoPintado.ts`), no molde do
 * `BarrancoControls`: o jeito de desenhar (contornar a boca ou cavar com o
 * pincel), a grossura do pincel, o brilho do fundo e, com um abismo contornado
 * escolhido (clique nele no Contornar), o brilho dele na hora e o botão de
 * apagar. Lê e escreve a store direto: preferência da ferramenta e os abismos
 * da cena aberta.
 */
export function AbismoControls() {
  const modo = useFerramentaDoAbismo((s) => s.modo)
  const setModo = useFerramentaDoAbismo((s) => s.setModo)
  const pincel = useFerramentaDoAbismo((s) => s.pincel)
  const setPincel = useFerramentaDoAbismo((s) => s.setPincel)
  const brilho = useFerramentaDoAbismo((s) => s.brilho)
  const setBrilho = useFerramentaDoAbismo((s) => s.setBrilho)
  const escolhidoId = useFerramentaDoAbismo((s) => s.escolhido)
  const escolher = useFerramentaDoAbismo((s) => s.escolher)
  const escolhido = useMapStore((s) => (escolhidoId === null ? undefined : s.map.abismos?.find((a) => a.id === escolhidoId)))
  const mudarAbismo = useMapStore((s) => s.mudarAbismo)
  const apagarAbismo = useMapStore((s) => s.apagarAbismo)
  const mudarAbismoPintado = useMapStore((s) => s.mudarAbismoPintado)
  // PISOS: "apagar o abismo pintado" só alcança o piso em edição; o botão aparece pelo mesmo recorte.
  const temPintadoNoPiso = useMapStore((s) => s.map.abismoPintado?.quadrados.some((q) => pisoDe(q) === s.pisoAtivo) === true)

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
      <h2 className="lb-eyebrow">Desenhar</h2>
      <Segmentado rotulo="Desenhar" opcoes={MODOS} valor={modo} aoEscolher={setModo} />
      <p className="lb-field__hint">{DICA_DO_MODO[modo]}</p>
      {modo === 'pincel' && (
        <>
          <h2 className="lb-eyebrow">Pincel</h2>
          <Segmentado rotulo="Pincel" opcoes={PINCEIS} valor={pincel} aoEscolher={setPincel} />
        </>
      )}
      <h2 className="lb-eyebrow">Brilho no fundo</h2>
      <Segmentado rotulo="Brilho no fundo" opcoes={BRILHOS} valor={escolhido !== undefined ? (escolhido.brilho ?? 'nenhum') : brilho} aoEscolher={escolherBrilho} />
      <p className="lb-field__hint">{escolhido !== undefined ? 'Muda o brilho do abismo escolhido. A brasa e o verde acendem luz em volta à noite.' : DICA_DO_BRILHO[modo]}</p>
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
      <p className="lb-field__hint">O buraco pintado só muda pelo Pincel (Alt tapa). Clique e Delete valem para o contornado.</p>
      <p className="lb-field__hint">O abismo segura a ficha do jogador: ela não entra no buraco, mas fica de pé na ilha. A visão passa por cima, e o mestre atravessa.</p>
      {temPintadoNoPiso && (
        <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={() => mudarAbismoPintado(semAbismoPintadoNoPiso)}>
          Apagar o abismo pintado
        </button>
      )}
    </section>
  )
}
