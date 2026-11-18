import { alinhamentoDaParede, alinhamentoDaSala, rotuloDoAlinhamento, type Alinhamento } from '../../lib/alinhamento'
import type { MapData, Region, Wall } from '../../types/map'
import { useMapStore } from '../../stores/mapStore'
import { Botao, Tecla } from '../grimorio/Botao'
import './fichaDaSelecao.css'

/** De que peça o selo fala: muda a frase lida em voz alta e a dica do botão. */
export type PecaDoSelo = 'parede' | 'sala'

/**
 * O que o leitor de tela diz do selo. A vista tem só "reta ✓" ou "torta 3°";
 * em voz alta o "✓" some e a peça entra na frase.
 */
export function frasesDoSelo(peca: PecaDoSelo, alinhamento: Alinhamento): string {
  const artigo = peca === 'parede' ? 'A parede' : 'A sala'
  if (alinhamento.estado === 'reta') return `${artigo} está reta.`
  if (alinhamento.estado === 'torta') return `${artigo} está ${rotuloDoAlinhamento(alinhamento)}: quase reta.`
  return `${artigo} está ${rotuloDoAlinhamento(alinhamento)}: nem deitada nem em pé.`
}

/**
 * O alinhamento da parede ou da sala selecionada, ou `null` sem selo: sala
 * redonda, parede que segue um traço do Pincel, região que não é sala. A
 * parede de sala fala da PRÓPRIA parede (é ela que o mestre está olhando); o
 * Endireitar ao lado conserta a sala inteira.
 */
export function alinhamentoDaSelecao(map: Pick<MapData, 'regions'>, parede: Wall | null, sala: Region | null): { peca: PecaDoSelo; alinhamento: Alinhamento } | null {
  if (parede !== null) {
    const alinhamento = alinhamentoDaParede(map, parede)
    return alinhamento === null ? null : { peca: 'parede', alinhamento }
  }
  if (sala !== null && sala.room !== undefined) {
    const alinhamento = alinhamentoDaSala(sala.points)
    return alinhamento === null ? null : { peca: 'sala', alinhamento }
  }
  return null
}

export interface SeloDeAlinhamentoProps {
  parede: Wall | null
  sala: Region | null
  /** Presente = o Endireitar tem o que fazer nesta seleção: o botão fica ao lado do selo "torta". */
  onEndireitar?: () => void
}

/**
 * SELO DE ALINHAMENTO (pedido de 17/11/2026: "nunca sei quando uma parede ta
 * alinhada"): "reta ✓", "torta 3°" ou "inclinada 30°" logo abaixo da cabeça da
 * ficha, com o Endireitar ao lado quando há o que consertar — o mesmo do "Mais
 * ações" e do toque no Alt, à mão sem abrir o menu.
 *
 * Três vozes, do que pede ação para o que não pede: torta em latão (a cor de
 * "tem o que fazer aqui"), reta em verde apagado, inclinada em cinza — diagonal
 * de propósito não é defeito. Sem animação: o selo troca a cada passo enquanto
 * a ponta é puxada, e resposta de alta frequência não pisca.
 *
 * `aria-live` educado: quem puxa a ponta ouve "reta" quando ela gruda, sem o
 * leitor interromper o que estava dizendo.
 */
export function SeloDeAlinhamento({ parede, sala, onEndireitar }: SeloDeAlinhamentoProps) {
  // Só as regiões: mexer numa ficha ou numa luz não refaz a conta do selo.
  const regioes = useMapStore((state) => state.map.regions)
  const selo = alinhamentoDaSelecao({ regions: regioes }, parede, sala)
  if (selo === null) return null
  return (
    <div className="lb-selo-de-alinhamento">
      <span className="lb-selo-de-alinhamento__selo" data-estado={selo.alinhamento.estado} role="status" aria-live="polite" aria-label={frasesDoSelo(selo.peca, selo.alinhamento)}>
        {rotuloDoAlinhamento(selo.alinhamento)}
      </span>
      {/* Só ao lado do "torta": o Endireitar deita ou põe em pé qualquer traço (pedido 5; só 0° e 90°
          desde 17/11/2026), e oferecê-lo junto de "inclinada" — a diagonal de 45° inclusive —
          convidaria a estragar uma diagonal de propósito. No "Mais ações" ele continua como sempre. */}
      {onEndireitar !== undefined && selo.alinhamento.estado === 'torta' && (
        <Botao tamanho="p" variante="latao" aria-keyshortcuts="Alt" onClick={onEndireitar}>
          Endireitar
          <Tecla>Alt</Tecla>
        </Botao>
      )}
    </div>
  )
}
