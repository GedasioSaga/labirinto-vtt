import { Acoes, Botao } from '../../grimorio/Botao'
import { Nota } from '../../grimorio/Nota'
import { faltaNosOutrosPontos, outroLugarDoDesafio, patchDoOutroLugar, pontoDoDesafio, pontosDoDesafio, textoDoLugar } from '../../../lib/desafios'
import { useAdventureStore } from '../../../stores/adventureStore'
import { useDesafiosStore } from '../../../stores/desafiosStore'
import { useMapStore } from '../../../stores/mapStore'
import type { Desafio, OutroLugarDoDesafio, Prop } from '../../../types/map'

/**
 * OS OUTROS PONTOS DA COOPERAÇÃO (28/11): o ponto 1 é o lugar do desafio (o
 * bloco de cima); aqui o mestre marca onde ficam o 2 e o 3, num ponto do mapa ou
 * num objeto (a alavanca, a placa, o painel que já está lá). Cada ponto vira um
 * selo próprio no mapa: o jogador entra no puzzle por ele, e só aciona o ponto
 * onde a ficha dele está. Só aparece no puzzle de cooperação.
 */

function irAoLugar(outro: OutroLugarDoDesafio, props: readonly Prop[]): void {
  const ponto = pontoDoDesafio(outro, props)
  if (ponto === null) return
  const store = useMapStore.getState()
  const piso = ponto.piso ?? 0
  if (piso !== store.pisoAtivo) store.setPisoAtivo(piso)
  useAdventureStore.getState().goToPoint(null, { x: ponto.x, y: ponto.y })
}

export function BlocoDosOutrosPontos({ desafio, props }: { desafio: Desafio; props: readonly Prop[] }) {
  const marcando = useDesafiosStore((estado) => estado.marcando)
  const cliqueForaDoObjeto = useDesafiosStore((estado) => estado.cliqueForaDoObjeto)
  const quantos = pontosDoDesafio(desafio)
  if (quantos < 2) return null
  const { marcar, pararDeMarcar } = useDesafiosStore.getState()
  const gravar = useMapStore.getState().updateDesafio
  const falta = faltaNosOutrosPontos(desafio, props)
  const outros = Array.from({ length: quantos - 1 }, (_, i) => i + 1)

  return (
    <section className="mg-bloco">
      <h3 className="mg-secao">
        Os outros pontos <small>{quantos} pontos no total</small>
      </h3>
      <Nota>O ponto 1 fica onde o desafio está. Marque os outros longe dele (outra sala, o outro lado da ponte): cada jogador só aciona o ponto onde a ficha dele está.</Nota>
      {falta !== null && (
        <p className="mg-erro" role="alert">
          {falta}: sem ele, ninguém consegue acionar todos juntos.
        </p>
      )}
      {outros.map((ponto) => {
        const outro = outroLugarDoDesafio(desafio, ponto)
        const marcandoEste = marcando !== null && marcando.id === desafio.id && marcando.ponto === ponto ? marcando.modo : null
        const temLugar = pontoDoDesafio(outro, props) !== null
        return (
          <div key={ponto} className="mg-onde" role="group" aria-label={`Ponto ${ponto + 1}`}>
            <p className="gr-campo__rot">Ponto {ponto + 1}</p>
            {marcandoEste !== null ? (
              <>
                <Nota>{marcandoEste === 'ponto' ? `Clique no mapa onde fica o ponto ${ponto + 1}.` : `Clique no objeto do mapa que é o ponto ${ponto + 1} (a alavanca, a placa, o painel).`} Esc cancela.</Nota>
                {marcandoEste === 'objeto' && cliqueForaDoObjeto && (
                  <p className="mg-erro" role="alert">
                    Ali não há objeto. Clique em cima de um móvel do mapa.
                  </p>
                )}
                <Acoes>
                  <Botao variante="fantasma" tamanho="p" onClick={pararDeMarcar}>
                    Cancelar
                  </Botao>
                </Acoes>
              </>
            ) : (
              <>
                <Nota>Fica {textoDoLugar(outro, props, 'sem lugar no mapa')}.</Nota>
                <Acoes>
                  <Botao variante="fantasma" tamanho="p" onClick={() => marcar(desafio.id, 'ponto', ponto)}>
                    {outro.lugar.tipo === 'ponto' ? 'Marcar de novo' : 'Marcar no mapa'}
                  </Botao>
                  <Botao variante="fantasma" tamanho="p" onClick={() => marcar(desafio.id, 'objeto', ponto)}>
                    {outro.lugar.tipo === 'objeto' ? 'Escolher outro objeto' : 'Escolher objeto'}
                  </Botao>
                  {temLugar && (
                    <Botao variante="fantasma" tamanho="p" onClick={() => irAoLugar(outro, props)}>
                      Mostrar no mapa
                    </Botao>
                  )}
                  {outro.lugar.tipo !== 'nenhum' && (
                    <Botao variante="fantasma" tamanho="p" onClick={() => gravar(desafio.id, patchDoOutroLugar(desafio, ponto, null))}>
                      Tirar do mapa
                    </Botao>
                  )}
                </Acoes>
              </>
            )}
          </div>
        )
      })}
    </section>
  )
}
