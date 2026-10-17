import { Dialogo } from '../components/grimorio/Dialogo'
import type { CenarioDoPino } from './catalogo'
import { PreviaDoCenario } from './PreviaDoCenario'

interface CenarioPreviewDialogProps {
  aberto: boolean
  imagem: string
  cenario: CenarioDoPino
  /** "Nome do local" e descrição do pino: a prévia mostra a revelação inteira, como o jogador verá. */
  nome: string
  descricao: string
  onClose: () => void
}

/**
 * "VER GRANDE": a mesma prévia da ficha numa janela de 640 px que cabe numa
 * tela de 900 px sem rolar. Toca ao abrir, vai até o fim natural e fica no
 * último quadro; Esc fecha e o foco volta ao "Ver grande".
 */
export function CenarioPreviewDialog({ aberto, imagem, cenario, nome, descricao, onClose }: CenarioPreviewDialogProps) {
  const local = nome.trim()
  return (
    <Dialogo aberto={aberto} titulo={local === '' ? 'Animação do cenário' : `Animação do cenário · ${local}`} onFechar={onClose} cena>
      <PreviaDoCenario grande imagem={imagem} cenario={cenario} nome={nome} descricao={descricao} />
    </Dialogo>
  )
}
