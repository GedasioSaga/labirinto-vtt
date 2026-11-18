import type { AlturaDoBarranco } from '../types/map'
import {
  alturaDoRisco,
  apagarRiscoDoBarranco,
  mudarAlturaDoRisco,
  mudarMaterialDoRisco,
  virarRisco,
  type AreaDoBarranco,
  type ModoDoBarranco,
  type PincelDaArea,
} from '../lib/barranco'
import { pisoDe } from '../lib/pisos'
import { useFerramentaDoBarranco } from '../stores/ferramentaDoBarranco'
import { useMapStore } from '../stores/mapStore'
import { ESCOLHAS_DO_MATERIAL, NOME_DA_ESCOLHA, TONS_POR_CHAO, type EscolhaDoMaterial, type MaterialDoBarranco } from '../texturas/meioTermo/barrancoPorChao'

const MODOS: Array<{ modo: ModoDoBarranco; rotulo: string }> = [
  { modo: 'risco', rotulo: 'Risco' },
  { modo: 'area', rotulo: 'Área alta' },
  { modo: 'rampa', rotulo: 'Rampa' },
]

const ALTURAS: Array<{ altura: AlturaDoBarranco; rotulo: string }> = [
  { altura: 'baixo', rotulo: 'Baixo' },
  { altura: 'medio', rotulo: 'Médio' },
  { altura: 'alto', rotulo: 'Alto' },
]

const AREAS: Array<{ area: AreaDoBarranco; rotulo: string }> = [
  { area: 'subir', rotulo: 'Subir' },
  { area: 'descer', rotulo: 'Descer' },
]

const PINCEIS: Array<{ pincel: PincelDaArea; rotulo: string }> = [
  { pincel: 'fino', rotulo: 'Fino' },
  { pincel: 'medio', rotulo: 'Médio' },
  { pincel: 'largo', rotulo: 'Largo' },
]

const DICA_DO_MODO: Readonly<Record<ModoDoBarranco, string>> = {
  risco: 'Arraste para riscar a beira. O lado alto começa para cima; clique na alça Virar (ou F) para trocar. Clique num risco para escolher, Delete apaga, Esc solta.',
  area: 'Pinte a parte alta: a borda inteira vira barranco. Começar dentro de uma área alta sobe mais um degrau (até 3). Segure Alt, ou escolha Descer, para baixar um degrau.',
  rampa: 'Passe o ponteiro sobre um barranco e clique para abrir uma rampa de 2 casas. Clique numa rampa para tirar.',
}

const DICA_DO_MATERIAL = 'Automático segue a textura pintada no lado alto: pedra, areia, neve ou grama. Sem textura, fica a terra.'

function corCss(cor: readonly number[]): string {
  return `rgb(${Math.round(cor[0])} ${Math.round(cor[1])} ${Math.round(cor[2])})`
}

/** A amostra do material: a cor da face e, em cima, a borda que debruça na beira (o branco da neve, o verde da grama). */
function AmostraDoMaterial({ material }: { material: MaterialDoBarranco }) {
  const tons = TONS_POR_CHAO[material]
  const face = corCss(tons.face.base)
  const borda = tons.beira.find((traco) => traco.afina === true)
  const fundo = borda === undefined ? face : `linear-gradient(${corCss(borda.cor)} 0 34%, ${face} 34%)`
  return (
    <span
      aria-hidden="true"
      style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, marginRight: 6, background: fundo, boxShadow: `inset 0 0 0 1px ${corCss(tons.face.contorno)}`, verticalAlign: 'middle' }}
    />
  )
}

interface OpcaoSegmentada<T extends string> {
  valor: T
  rotulo: string
}

/** O controle segmentado dos painéis de terreno (o do Abismo também usa). */
export function Segmentado<T extends string>({ rotulo, opcoes, valor, aoEscolher }: { rotulo: string; opcoes: OpcaoSegmentada<T>[]; valor: T; aoEscolher: (v: T) => void }) {
  return (
    <div className="lb-seg" role="radiogroup" aria-label={rotulo}>
      {opcoes.map((opcao) => (
        <button key={opcao.valor} type="button" role="radio" aria-checked={valor === opcao.valor} className="lb-seg__option" onClick={() => aoEscolher(opcao.valor)}>
          {opcao.rotulo}
        </button>
      ))}
    </div>
  )
}

/**
 * Painel do Barranco (`lib/barranco.ts`), no molde do `PenhascoControls`: o
 * modo, a altura dos próximos riscos e áreas (com um risco escolhido, muda
 * ele na hora, como no protótipo), o traço da área e o risco escolhido.
 * Lê e escreve a store direto: são preferências da ferramenta e o barranco da
 * cena aberta, sem nada para o App repassar.
 */
export function BarrancoControls() {
  const modo = useMapStore((s) => s.barrancoModo)
  const setModo = useMapStore((s) => s.setBarrancoModo)
  const altura = useMapStore((s) => s.barrancoAltura)
  const setAltura = useMapStore((s) => s.setBarrancoAltura)
  const area = useMapStore((s) => s.barrancoArea)
  const setArea = useMapStore((s) => s.setBarrancoArea)
  const pincel = useMapStore((s) => s.barrancoPincel)
  const setPincel = useMapStore((s) => s.setBarrancoPincel)
  const escolhidoId = useMapStore((s) => s.barrancoEscolhido)
  const setEscolhido = useMapStore((s) => s.setBarrancoEscolhido)
  const mudarBarranco = useMapStore((s) => s.mudarBarranco)
  const escolhido = useMapStore((s) => (escolhidoId === null ? undefined : s.map.barranco?.riscos.find((r) => r.id === escolhidoId)))
  // PISOS: "apagar o barranco" só alcança o piso em edição; o botão aparece pelo mesmo recorte.
  const temNoPiso = useMapStore((s) => {
    const b = s.map.barranco
    if (b === undefined) return false
    const doPiso = (item: { piso?: number }) => pisoDe(item) === s.pisoAtivo
    return b.riscos.some(doPiso) || b.quadrados.some(doPiso) || b.rampas.some(doPiso)
  })

  const material = useFerramentaDoBarranco((s) => s.material)
  const setMaterial = useFerramentaDoBarranco((s) => s.setMaterial)
  // Com um risco escolhido, o painel mostra e muda o material DELE; sem, o dos próximos riscos e traços.
  const riscoEscolhido = escolhido !== undefined && modo === 'risco' ? escolhido : undefined
  const materialMostrado: EscolhaDoMaterial = riscoEscolhido !== undefined ? (riscoEscolhido.material ?? 'automatico') : material

  const escolherAltura = (nova: AlturaDoBarranco) => {
    setAltura(nova)
    if (escolhido !== undefined && modo === 'risco') mudarBarranco((b) => mudarAlturaDoRisco(b, escolhido.id, nova))
  }

  const escolherMaterial = (novo: EscolhaDoMaterial) => {
    setMaterial(novo)
    if (riscoEscolhido !== undefined) mudarBarranco((b) => mudarMaterialDoRisco(b, riscoEscolhido.id, novo === 'automatico' ? null : novo))
  }

  const apagarEscolhido = () => {
    if (escolhido === undefined) return
    if (mudarBarranco((b) => apagarRiscoDoBarranco(b, escolhido.id))) setEscolhido(null)
  }

  const apagarTudoDoPiso = () => {
    mudarBarranco((b, piso) => ({
      ...b,
      riscos: b.riscos.filter((r) => pisoDe(r) !== piso),
      quadrados: b.quadrados.filter((q) => pisoDe(q) !== piso),
      rampas: b.rampas.filter((r) => pisoDe(r) !== piso),
    }))
    setEscolhido(null)
  }

  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Desenhar</h2>
      <Segmentado rotulo="Desenhar" opcoes={MODOS.map((o) => ({ valor: o.modo, rotulo: o.rotulo }))} valor={modo} aoEscolher={setModo} />
      <p className="lb-field__hint">{DICA_DO_MODO[modo]}</p>
      {modo !== 'rampa' && (
        <>
          <h2 className="lb-eyebrow">Altura</h2>
          <Segmentado rotulo="Altura" opcoes={ALTURAS.map((o) => ({ valor: o.altura, rotulo: o.rotulo }))} valor={escolhido !== undefined && modo === 'risco' ? alturaDoRisco(escolhido) : altura} aoEscolher={escolherAltura} />
          <h2 className="lb-eyebrow">Material</h2>
          <div className="lb-seg lb-seg--grid" role="radiogroup" aria-label="Material">
            {ESCOLHAS_DO_MATERIAL.map((opcao) => (
              <button key={opcao} type="button" role="radio" aria-checked={materialMostrado === opcao} className="lb-seg__option" onClick={() => escolherMaterial(opcao)}>
                {opcao !== 'automatico' && <AmostraDoMaterial material={opcao} />}
                {NOME_DA_ESCOLHA[opcao]}
              </button>
            ))}
          </div>
          <p className="lb-field__hint">{riscoEscolhido !== undefined ? 'Muda o material do risco escolhido.' : modo === 'area' ? `${DICA_DO_MATERIAL} Vale para o que você pintar agora.` : DICA_DO_MATERIAL}</p>
        </>
      )}
      {modo === 'area' && (
        <>
          <h2 className="lb-eyebrow">Ao pintar</h2>
          <Segmentado rotulo="Ao pintar" opcoes={AREAS.map((o) => ({ valor: o.area, rotulo: o.rotulo }))} valor={area} aoEscolher={setArea} />
          <h2 className="lb-eyebrow">Pincel</h2>
          <Segmentado rotulo="Pincel" opcoes={PINCEIS.map((o) => ({ valor: o.pincel, rotulo: o.rotulo }))} valor={pincel} aoEscolher={setPincel} />
        </>
      )}
      {modo === 'risco' && escolhido !== undefined && (
        <>
          <h2 className="lb-eyebrow">Risco escolhido</h2>
          <div className="lb-section__row">
            <button type="button" className="lb-btn lb-btn--compact" onClick={() => mudarBarranco((b) => virarRisco(b, escolhido.id))} aria-keyshortcuts="F">
              Virar o lado alto
            </button>
            <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={apagarEscolhido} aria-keyshortcuts="Delete">
              Apagar o risco
            </button>
          </div>
        </>
      )}
      <p className="lb-field__hint">O barranco segura a ficha: ela só passa numa rampa ou por fora da ponta do risco. A visão passa por cima.</p>
      {temNoPiso && (
        <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={apagarTudoDoPiso}>
          Apagar todo o barranco
        </button>
      )}
    </section>
  )
}
