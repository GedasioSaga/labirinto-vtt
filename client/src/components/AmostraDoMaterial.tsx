import type { MaterialDaParede } from '../types/map'
import { urlDaAmostra } from '../texturas/paredes/materiais'
import './AcabamentoDaParede.css'

/**
 * A AMOSTRA de um material da parede (pedido de 07/11/2026): o topo de uma
 * parede média vista de cima, como ela aparece no mapa (a tira de 240 x 20 px
 * do estúdio, `imagens/amostras/<material>.png`, que repete em x). `icone` é o
 * quadradinho de 16 px do menu da ferramenta; `faixa` é a tira da grade do
 * painel. Nos dois a tira enche a altura.
 */
const ALTURA = { icone: 16, faixa: 24 } as const

export function AmostraDoMaterial({ material, forma = 'icone' }: { material: MaterialDaParede; forma?: keyof typeof ALTURA }) {
  const url = urlDaAmostra(material)
  return (
    <span
      className={`lb-amostra-material lb-amostra-material--${forma}`}
      aria-hidden="true"
      style={url === null ? undefined : { backgroundImage: `url(${url})`, backgroundSize: `auto ${ALTURA[forma]}px`, backgroundPosition: '0 0', backgroundRepeat: 'repeat-x' }}
    />
  )
}
