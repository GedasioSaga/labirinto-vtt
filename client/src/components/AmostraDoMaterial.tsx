import type { MaterialDaParede } from '../types/map'
import { FORMATO_DA_IMAGEM, materialDoCatalogo } from '../texturas/paredes/catalogo'
import { urlDoMaterial } from '../texturas/paredes/materiais'
import './AcabamentoDaParede.css'

/**
 * A AMOSTRA de um material da parede (pedido de 07/11/2026): o pedaço da imagem
 * em volta do meio do traço (`meioY`), como ele aparece na parede. `icone` é o
 * quadradinho de 16 px do menu da ferramenta (a 1/4); `faixa` é a tira da grade
 * do painel (a 1/2), uma parede vista de cima.
 */
const FORMAS = {
  icone: { altura: 16, escala: 0.25 },
  faixa: { altura: 24, escala: 0.5 },
} as const

export function AmostraDoMaterial({ material, forma = 'icone' }: { material: MaterialDaParede; forma?: keyof typeof FORMAS }) {
  const url = urlDoMaterial(material)
  const { altura, escala } = FORMAS[forma]
  const lado = FORMATO_DA_IMAGEM.lado * escala
  const y = altura / 2 - materialDoCatalogo(material).meioY * escala
  return (
    <span
      className={`lb-amostra-material lb-amostra-material--${forma}`}
      aria-hidden="true"
      style={url === null ? undefined : { backgroundImage: `url(${url})`, backgroundSize: `${lado}px ${lado}px`, backgroundPosition: `0 ${y}px` }}
    />
  )
}
