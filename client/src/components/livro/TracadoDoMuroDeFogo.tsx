import { CampoSeg } from '../grimorio/CampoSeg'
import { Nota } from '../grimorio/Nota'
import { useFerramentaDoMuroDeFogo, type FormaDoMuroDeFogo } from '../../stores/ferramentaDoMuroDeFogo'

const FORMAS: readonly { valor: FormaDoMuroDeFogo; rotulo: string }[] = [
  { valor: 'mao', rotulo: 'À mão' },
  { valor: 'pontos', rotulo: 'Ponto a ponto' },
]

/** O que a ficha diz de cada forma: o gesto no mapa e como ele termina. */
const DICA: Readonly<Record<FormaDoMuroDeFogo, string>> = {
  mao: 'Arraste no mapa para riscar o muro: o traço vira curva. Ele nasce com 1 casa de grossura e barra a passagem.',
  pontos: 'Clique os cantos do muro no mapa. Duplo clique ou Enter termina, Esc cancela e Backspace tira o último canto.',
}

/**
 * MURO DE FOGO (15/11/2026): como o muro é traçado, na ficha da ferramenta
 * Objeto, à vista só com ele escolhido. O muro não nasce de um clique como os
 * outros objetos, então a ficha diz o gesto ali mesmo.
 */
export function TracadoDoMuroDeFogo() {
  const forma = useFerramentaDoMuroDeFogo((estado) => estado.forma)
  const setForma = useFerramentaDoMuroDeFogo((estado) => estado.setForma)
  return (
    <>
      <CampoSeg rotulo="Traçar o muro de fogo" opcoes={FORMAS} valor={forma} onChange={setForma} />
      <Nota>{DICA[forma]}</Nota>
    </>
  )
}
