import { Acoes, Botao } from '../../grimorio/Botao'
import { CampoFaixa } from '../../grimorio/CampoFaixa'
import { CampoSeg, type OpcaoDoSeg } from '../../grimorio/CampoSeg'
import { Nota } from '../../grimorio/Nota'
import { comEntrada, faltaNoLugar, patchDoTamanhoDoSelo, pontoDoDesafio, tamanhoDoSelo, textoDoLugar } from '../../../lib/desafios'
import { PIN_ESCALA_MAX, PIN_ESCALA_MIN } from '../../../lib/pins'
import { entradaDoMinigame, nomeDoJogo, REGISTRO_DE_MINIGAMES, type EntradaDoDesafio } from '../../../minigames/registro'
import { useAdventureStore } from '../../../stores/adventureStore'
import { useDesafiosStore } from '../../../stores/desafiosStore'
import { useMapStore } from '../../../stores/mapStore'
import type { Desafio, Prop, TipoDoLugarDoDesafio } from '../../../types/map'

/**
 * ONDE FICA E COMO COMEÇA, juntos (editor de desafio de 21/11/2026, decisão
 * 10): a ficha nunca mostra escolha impossível. Fora do mapa, explica que só o
 * mestre chama; na dança, no fogo e no puzzle, diz a regra em uma frase (o
 * registro do jogo); o puzzle sem lugar diz que falta o lugar.
 */

const OPCOES_DO_LUGAR: readonly OpcaoDoSeg<TipoDoLugarDoDesafio>[] = [
  { valor: 'ponto', rotulo: 'Ponto' },
  { valor: 'objeto', rotulo: 'Objeto' },
  { valor: 'nenhum', rotulo: 'Fora do mapa' },
]

const OPCOES_DA_ENTRADA: readonly OpcaoDoSeg<EntradaDoDesafio>[] = [
  { valor: 'pino', rotulo: 'O jogador começa no selo' },
  { valor: 'mestre', rotulo: 'Só você chama' },
]

/** O "Tamanho" do selo anda de 10 em 10%, a régua da etiqueta da alça de canto no mapa (a mesma do papel). */
const PASSO_DO_TAMANHO_PCT = 10

/** Leva a câmera do editor ao selo do desafio (e ao piso dele). Sem lugar no mapa: nada. */
export function irAoDesafio(desafio: Desafio, props: readonly Prop[]): void {
  const ponto = pontoDoDesafio(desafio, props)
  if (ponto === null) return
  const store = useMapStore.getState()
  const piso = ponto.piso ?? 0
  if (piso !== store.pisoAtivo) store.setPisoAtivo(piso)
  useAdventureStore.getState().goToPoint(null, { x: ponto.x, y: ponto.y })
}

export function BlocoOndeEComoComeca({ desafio, props }: { desafio: Desafio; props: readonly Prop[] }) {
  const marcando = useDesafiosStore((estado) => estado.marcando)
  const cliqueForaDoObjeto = useDesafiosStore((estado) => estado.cliqueForaDoObjeto)
  const { marcar, pararDeMarcar } = useDesafiosStore.getState()
  // A marcação do ponto 2 ou 3 da cooperação é do bloco dos outros pontos.
  const marcandoEste = marcando !== null && marcando.id === desafio.id && marcando.ponto === undefined ? marcando.modo : null
  const falta = faltaNoLugar(desafio, props)
  const gravar = useMapStore.getState().updateDesafio
  const definicao = REGISTRO_DE_MINIGAMES[desafio.minigame.jogo]
  // Só os lugares que o jogo aceita: o puzzle não fica fora do mapa. Sem lugar, nenhuma opção marcada e a falta dita (B4).
  const opcoesDoLugar = OPCOES_DO_LUGAR.filter((opcao) => definicao.lugares.includes(opcao.valor))
  const escolherLugar = (tipo: TipoDoLugarDoDesafio) => {
    if (tipo === 'nenhum') {
      pararDeMarcar()
      // O piso do ponto de antes sai com o lugar (B30).
      if (desafio.lugar.tipo !== 'nenhum') gravar(desafio.id, { lugar: { tipo: 'nenhum' }, piso: undefined })
      return
    }
    marcar(desafio.id, tipo)
  }
  const foraDoMapa = desafio.lugar.tipo === 'nenhum'
  return (
    <section className="mg-bloco">
      <h3 className="mg-secao">Onde fica e como começa</h3>
      <div className="mg-onde">
        <CampoSeg rotulo="Onde fica" opcoes={opcoesDoLugar} valor={marcandoEste ?? desafio.lugar.tipo} onChange={escolherLugar} />
        {marcandoEste !== null ? (
          <>
            <Nota>{marcandoEste === 'ponto' ? 'Clique no mapa onde o jogo acontece.' : 'Clique no objeto do mapa onde o jogo acontece.'} Esc cancela.</Nota>
            {marcandoEste === 'objeto' && cliqueForaDoObjeto && (
              <p className="mg-erro" role="alert">
                Ali não há objeto. Clique em cima de uma mesa, um baú ou outro móvel do mapa.
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
            {foraDoMapa && falta !== null && (
              <p className="mg-erro" role="alert">
                Falta o lugar: o {nomeDoJogo(desafio.minigame.jogo).toLowerCase()} só existe com selo no mapa. Escolha um ponto ou um objeto.
              </p>
            )}
            <Nota>
              Fica {textoDoLugar(desafio, props, 'fora do mapa')}.{falta !== null && !foraDoMapa && ` ${falta}: escolha outro lugar.`}
              {foraDoMapa && falta === null && ' Sem selo: o jogador só vê o convite quando você chamar.'}
              {desafio.lugar.tipo === 'ponto' && ' No mapa: arraste o selo para mudar de lugar; os cantos mudam o tamanho, a bolinha gira e Delete tira do mapa.'}
              {desafio.lugar.tipo === 'objeto' && ' No mapa: os cantos do selo mudam o tamanho, a bolinha gira e Delete tira do mapa.'}
            </Nota>
            {!foraDoMapa && (
              <CampoFaixa
                rotulo="Tamanho"
                valor={Math.round(tamanhoDoSelo(desafio) * 100)}
                min={PIN_ESCALA_MIN * 100}
                max={PIN_ESCALA_MAX * 100}
                passo={PASSO_DO_TAMANHO_PCT}
                formatar={(pct) => `${pct}%`}
                // O deslizante inteiro é UM passo do Ctrl+Z (a chave junta as mudanças seguidas deste selo), como o do papel.
                onChange={(pct) => gravar(desafio.id, patchDoTamanhoDoSelo(desafio, pct / 100), `desafio-tamanho:${desafio.id}`)}
              />
            )}
            {!foraDoMapa && (
              <Acoes>
                <Botao variante="fantasma" tamanho="p" onClick={() => marcar(desafio.id, desafio.lugar.tipo === 'objeto' ? 'objeto' : 'ponto')}>
                  {desafio.lugar.tipo === 'objeto' ? 'Escolher outro objeto' : 'Marcar de novo'}
                </Botao>
                {falta === null && (
                  <Botao variante="fantasma" tamanho="p" onClick={() => irAoDesafio(desafio, props)}>
                    Mostrar no mapa
                  </Botao>
                )}
              </Acoes>
            )}
          </>
        )}
      </div>
      {definicao.regraDeEntrada !== undefined ? (
        <div className="gr-campo">
          <p className="gr-campo__rot">Como começa</p>
          <Nota>{definicao.regraDeEntrada}</Nota>
        </div>
      ) : foraDoMapa ? (
        <div className="gr-campo">
          <p className="gr-campo__rot">Como começa</p>
          <Nota>Fora do mapa não há selo para o jogador encostar: só você chama. Ponha o desafio no mapa para escolher.</Nota>
        </div>
      ) : (
        <CampoSeg
          rotulo="Como começa"
          opcoes={OPCOES_DA_ENTRADA}
          valor={entradaDoMinigame(desafio.minigame)}
          onChange={(entrada) => gravar(desafio.id, { minigame: comEntrada(desafio.minigame, entrada) })}
        />
      )}
    </section>
  )
}
