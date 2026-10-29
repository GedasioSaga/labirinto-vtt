import { estiloDoMapa, type EstiloVisual } from '../../lib/estiloDoMapa'
import { useMapStore } from '../../stores/mapStore'
import { CampoSeg, type OpcaoDoSeg } from '../grimorio/CampoSeg'

const OPCOES: readonly OpcaoDoSeg<EstiloVisual>[] = [
  { valor: 'atual', rotulo: 'Atual' },
  { valor: 'simples', rotulo: 'Simples' },
  { valor: 'desenhado', rotulo: 'Desenhado' },
]

/** A frase embaixo do seletor: o que o estilo escolhido faz nesta cena. */
const DICA_DO_ESTILO: Record<EstiloVisual, string> = {
  atual: 'O desenho de hoje, com texturas. Os jogadores veem igual.',
  simples: 'Linhas e cores chapadas, sem texturas. Os jogadores veem igual.',
  desenhado: 'As texturas Desenhado chegam por partes. O que ainda não chegou sai no Atual.',
}

/**
 * ESTILO DO MAPA (integração do Desenhado, 29/10/2026): a escolha do mestre na
 * página Cena do livro, só desta cena (`MapData.estiloVisual`). Os jogadores
 * veem o mesmo estilo; o "Chão leve" continua sendo do aparelho. Lê e grava a
 * cena aberta direto na store (com desfazer), sem passar pelo App, no molde da
 * `ChaveCliqueParaAndar`.
 */
export function EscolhaDoEstilo() {
  const estilo = useMapStore((state) => estiloDoMapa(state.map))
  const definirEstiloVisual = useMapStore((state) => state.definirEstiloVisual)
  return (
    <div className="lb-field gr-paginas__estilo">
      <CampoSeg rotulo="Estilo do mapa" opcoes={OPCOES} valor={estilo} onChange={definirEstiloVisual} />
      {/* `polite`: quem escolhe pelo teclado ouve o aviso do Desenhado sem perder o foco. */}
      <p className="lb-field__hint" aria-live="polite">
        {DICA_DO_ESTILO[estilo]}
      </p>
    </div>
  )
}
