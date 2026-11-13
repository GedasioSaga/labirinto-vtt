import { useMapStore } from '../stores/mapStore'
import { useTerrenoStore } from '../stores/terrenoStore'
import { LARGURA_MAXIMA_EM_CASAS, LARGURA_MINIMA_EM_CASAS, MATERIAIS_DO_CHAO } from '../lib/terrenoDoChao'
import { Toggle } from './Toggle'

/**
 * TERRENO da ferramenta Chão (pedido CHÃO E CAMINHO de 12/11/2026): o
 * material, a largura do Caminho, a borda e o "Conta como Chão" da PRÓXIMA
 * peça (`stores/terrenoStore.ts`). A peça já feita se edita na ficha dela
 * (`FloorPieceControls`), com o mesmo seletor de material.
 */

/** Passo da largura: meia casa, como o Caminho de antes. */
const PASSO_DA_LARGURA = 0.5

function larguraEmTexto(casas: number): string {
  return `${casas.toLocaleString('pt-BR')} ${casas === 1 ? 'casa' : 'casas'}`
}

export interface SeletorDeMaterialProps {
  /** Id da textura escolhida; `null` = Liso. */
  material: string | null
  onChange: (material: string | null) => void
  /** Prefixo dos ids (dois seletores na mesma tela). */
  id: string
}

/** Os materiais em botões com amostra, um só escolhido (setas mudam, como todo grupo de rádio). */
export function SeletorDeMaterial({ material, onChange, id }: SeletorDeMaterialProps) {
  return (
    <div className="lb-field">
      <span className="lb-label" id={`${id}-rotulo`}>
        Material
      </span>
      <div className="lb-seg lb-seg--grid" role="radiogroup" aria-labelledby={`${id}-rotulo`}>
        {MATERIAIS_DO_CHAO.map((m) => (
          <button
            key={m.textura ?? 'liso'}
            type="button"
            role="radio"
            aria-checked={material === m.textura}
            className="lb-seg__option"
            onClick={() => onChange(m.textura)}
          >
            <span
              aria-hidden="true"
              style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, marginRight: 6, background: m.amostra, verticalAlign: 'middle' }}
            />
            {m.nome}
          </button>
        ))}
      </div>
    </div>
  )
}

export interface CampoDaBordaProps {
  /** 0 a 1. */
  borda: number
  onChange: (borda: number) => void
  id: string
  disabled?: boolean
}

/** Borda de 0 (reta) a 100% (irregular): só aparência, o limite do Chão segue a forma limpa. */
export function CampoDaBorda({ borda, onChange, id, disabled }: CampoDaBordaProps) {
  const porcento = Math.round(borda * 100)
  return (
    <div className="lb-field">
      <div className="lb-section__row">
        <label className="lb-label" htmlFor={id}>
          Borda
        </label>
        <span className="lb-num">{porcento === 0 ? 'reta' : `${porcento}%`}</span>
      </div>
      <input
        id={id}
        className="lb-range"
        type="range"
        min={0}
        max={100}
        step={5}
        value={porcento}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
      />
    </div>
  )
}

/** A seção do terreno com a ferramenta Chão na mão. */
export function TerrenoControls() {
  const material = useTerrenoStore((s) => s.material)
  const larguraEmCasas = useTerrenoStore((s) => s.larguraEmCasas)
  const borda = useTerrenoStore((s) => s.borda)
  const contaComoChao = useTerrenoStore((s) => s.contaComoChao)
  const definirMaterial = useTerrenoStore((s) => s.definirMaterial)
  const definirLargura = useTerrenoStore((s) => s.definirLargura)
  const definirBorda = useTerrenoStore((s) => s.definirBorda)
  const definirContaComoChao = useTerrenoStore((s) => s.definirContaComoChao)
  const forma = useMapStore((s) => s.floorShapeKind)
  // O pincel de blocos e o balde pintam as camadas de tinta (Chão, Mar, Grama...): o terreno não vale para eles.
  if (forma === 'blocos' || forma === 'balde') return null
  return (
    <section className="lb-section" aria-label="Terreno da próxima peça">
      <h2 className="lb-eyebrow">Terreno</h2>
      <SeletorDeMaterial id="lb-terreno-material" material={material} onChange={definirMaterial} />
      {forma === 'caminho' && (
        <div className="lb-field">
          <div className="lb-section__row">
            <label className="lb-label" htmlFor="lb-terreno-largura">
              Largura
            </label>
            <span className="lb-num">{larguraEmTexto(larguraEmCasas)}</span>
          </div>
          <input
            id="lb-terreno-largura"
            className="lb-range"
            type="range"
            min={LARGURA_MINIMA_EM_CASAS}
            max={LARGURA_MAXIMA_EM_CASAS}
            step={PASSO_DA_LARGURA}
            value={larguraEmCasas}
            onChange={(event) => definirLargura(Number(event.target.value))}
          />
        </div>
      )}
      <CampoDaBorda id="lb-terreno-borda" borda={borda} onChange={definirBorda} disabled={material === null} />
      <Toggle label="Conta como Chão" checked={contaComoChao} onChange={definirContaComoChao} />
    </section>
  )
}
