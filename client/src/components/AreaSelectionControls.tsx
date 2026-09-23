import type { AreaSelection } from '../lib/areaSelection'
import { isAreaSelectionEmpty } from '../lib/areaSelection'

export interface AreaSelectionControlsProps {
  /** `null` = ferramenta "Selecionar área" não fechou nenhum grupo ainda
   *  (nada arrastado, ou arrasto abaixo do mínimo — ver
   *  `AREA_SELECTION_MIN_DRAG`, `lib/areaSelection.ts`). Seleção vazia
   *  (arrasto real, mas nada caiu dentro — ex.: área sem nada, ou tudo
   *  travado/em camada oculta) também não renderiza nada: para o usuário,
   *  "não achei nada aqui" e "não tentei" são a mesma tela em branco. */
  selection: AreaSelection | null
  /** Limpa a seleção de área e o contorno desenhado — mesmo `onClick` serviria
   *  pra tecla Esc, se o chamador quiser ligar as duas coisas na mesma action. */
  onClear: () => void
  /** A seleção é exatamente um grupo (Ctrl+G) já feito. */
  grouped?: boolean
  /** Junta a seleção num grupo — o mesmo que Ctrl+G. Sem ele, sem botão. */
  onGroup?: () => void
  /** Desfaz o grupo — o mesmo que Ctrl+Shift+G. Sem ele, sem botão. */
  onUngroup?: () => void
}

const AREA_CATEGORY_LABELS: ReadonlyArray<{ key: keyof AreaSelection; singular: string; plural: string }> = [
  { key: 'walls', singular: 'parede', plural: 'paredes' },
  { key: 'regions', singular: 'região/sala', plural: 'regiões/salas' },
  { key: 'lights', singular: 'luz', plural: 'luzes' },
  { key: 'tokens', singular: 'token', plural: 'tokens' },
  { key: 'props', singular: 'objeto', plural: 'objetos' },
  { key: 'stairs', singular: 'escada', plural: 'escadas' },
  { key: 'drawings', singular: 'desenho', plural: 'desenhos' },
]

/**
 * Resumo da ferramenta "Selecionar área" (pedido N3: "eu seleciono uma área e
 * posso mover os objetos para um outro local"). Mostra quantos itens de cada
 * tipo caíram dentro do retângulo arrastado — prova visual pro usuário de que
 * a seleção pegou algo (lição D5 do ROADMAP: capacidade pronta mas
 * inalcançável/inverificável já aconteceu 3× nesta app) — e um botão pra
 * limpar sem precisar arrastar um marquee vazio em cima de nada.
 */
export function AreaSelectionControls({ selection, onClear, grouped = false, onGroup, onUngroup }: AreaSelectionControlsProps) {
  if (!selection || isAreaSelectionEmpty(selection)) return null

  const total = AREA_CATEGORY_LABELS.reduce((sum, { key }) => sum + selection[key].length, 0)
  const parts = AREA_CATEGORY_LABELS.filter(({ key }) => selection[key].length > 0).map(({ key, singular, plural }) => {
    const count = selection[key].length
    return `${count} ${count === 1 ? singular : plural}`
  })

  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">{grouped ? 'Grupo' : 'Seleção de área'}</h2>
      <p className="lb-area-selection__summary">
        {total} {total === 1 ? 'item selecionado' : 'itens selecionados'}: {parts.join(', ')}. Arraste para mover o
        grupo inteiro.
      </p>
      {/* O atalho vai escrito no botão: atalho invisível é atalho inexistente. */}
      {grouped && onUngroup && (
        <button type="button" className="lb-btn lb-btn--block" onClick={onUngroup}>
          Desagrupar (Ctrl+Shift+G)
        </button>
      )}
      {!grouped && onGroup && total > 1 && (
        <button type="button" className="lb-btn lb-btn--block" onClick={onGroup}>
          Agrupar (Ctrl+G)
        </button>
      )}
      <button type="button" className="lb-btn lb-btn--block" onClick={onClear}>
        Limpar seleção de área
      </button>
    </section>
  )
}
