import { caminhoDaFonte } from '../../lib/fonteNoPreludio'
import { abrirNoPreludio } from '../../preludio/janela/portaDaJanela'
import { useSituacaoDosPinosLigados } from '../../stores/colocacaoDoPreludio'
import { useMapStore } from '../../stores/mapStore'
import { useToastStore } from '../../stores/toastStore'
import type { Pin } from '../../types/map'
import { Acoes, Botao } from '../grimorio/Botao'
import { Nota } from '../grimorio/Nota'

/**
 * O PINO LIGADO AO PRELÚDIO NA FICHA (P3 do estudo de 15/11): no lugar do
 * campo "Descrição", de onde vem o texto ("Do Prelúdio: Vila › Ao chegar"), o
 * texto que o jogador lê (só leitura: edita-se no Prelúdio), os avisos de
 * segredo e de fonte apagada, "Abrir no Prelúdio" e "Desligar". Desligar
 * devolve um pino comum, com o texto copiado; o Ctrl+Z religa.
 */

function semFonte(pin: Pin): Pin {
  const { fonte: _fonte, ...comum } = pin
  return comum
}

export function PinoLigadoAoPreludio({ pinId }: { pinId: string }) {
  const pin = useMapStore((estado) => estado.map.pins.find((um) => um.id === pinId))
  const situacao = useSituacaoDosPinosLigados((estado) => estado.porPino.get(pinId))
  const lido = useSituacaoDosPinosLigados((estado) => estado.lido)
  const fonte = pin?.fonte
  if (pin === undefined || fonte === undefined) return null
  const desligar = () => {
    const { map, replacePins } = useMapStore.getState()
    replacePins(map.pins.map((um) => (um.id === pinId ? semFonte(um) : um)))
    useToastStore.getState().push('info', 'Pino desligado do Prelúdio: o texto ficou no pino e agora se edita aqui.')
  }
  return (
    <div className="lb-pino-ligado" role="group" aria-label="Texto do Prelúdio">
      <div className="lb-pino-ligado__de">Do Prelúdio · o jogador lê</div>
      <div className="lb-pino-ligado__caminho">{caminhoDaFonte(fonte)}</div>
      <p className="lb-pino-ligado__texto">{pin.description.trim() === '' ? 'A seção ainda não tem texto.' : pin.description}</p>
      {situacao === 'segredo' && <Nota>Esta seção virou segredo no Prelúdio. O jogador lê "Texto indisponível." até você tirar o segredo ou desligar o pino.</Nota>}
      {situacao === 'sumiu' && <Nota>A fonte sumiu do Prelúdio (o verbete ou a seção foram apagados). O jogador lê a cópia guardada no pino.</Nota>}
      {!lido && <Nota>O Prelúdio ainda não foi lido nesta janela: o jogador lê a cópia guardada no pino.</Nota>}
      <p className="lb-pino-ligado__ajuda">O texto mora no Prelúdio. Edite lá: o pino acompanha.</p>
      <Acoes>
        <Botao variante="latao" tamanho="p" onClick={() => abrirNoPreludio({ verbeteId: fonte.verbeteId, aba: null, secaoId: fonte.secaoId })}>
          Abrir no Prelúdio
        </Botao>
        <Botao variante="fantasma" tamanho="p" onClick={desligar}>
          Desligar
        </Botao>
      </Acoes>
    </div>
  )
}
