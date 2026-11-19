import { useEffect, useState } from 'react'
import { Botao } from '../components/grimorio/Botao'
import { Dialogo } from '../components/grimorio/Dialogo'
import { abrirMesaEmJanela, abrirMesaNoApp, fecharMesaNoApp, trazerMesaParaOApp, useMesaDaBatalha } from './controleDaJanela'
import { aplicarPedido, assinarEspelho } from './mesa'
import { MesaDaBatalha } from './MesaDaBatalha'
import type { EspelhoDaBatalha, PedidoDaMesa, RespostaDaMesa } from './tipos'

/**
 * A MESA DA BATALHA no meio do app: um diálogo por cima do mapa (Esc ou o X
 * fecham, o foco volta a quem abriu). Com a janela à parte aberta, ele só diz
 * onde a mesa está e traz de volta. Montado uma vez no App.
 */

function enviarAqui(pedido: PedidoDaMesa): Promise<RespostaDaMesa> {
  return Promise.resolve(aplicarPedido(pedido))
}

/** O espelho da cena aberta enquanto `ligado`; desligado, nada assina as lojas. */
function useEspelhoAoVivo(ligado: boolean): EspelhoDaBatalha | null {
  const [espelho, setEspelho] = useState<EspelhoDaBatalha | null>(null)
  useEffect(() => (ligado ? assinarEspelho(setEspelho) : undefined), [ligado])
  return espelho
}

export function TelaDaBatalhaNoApp() {
  const noApp = useMesaDaBatalha((state) => state.noApp)
  const emJanela = useMesaDaBatalha((state) => state.emJanela)
  const espelho = useEspelhoAoVivo(noApp && !emJanela)
  return (
    <Dialogo aberto={noApp} titulo="Mesa da batalha" onFechar={fecharMesaNoApp} classe="mb-dlg">
      {emJanela ? (
        <div className="mb-dlg-janela">
          <p>A mesa da batalha está aberta na outra janela.</p>
          <small>Ela pode estar atrás do app ou no outro monitor. Tudo o que você faz lá vale aqui na hora.</small>
          <div>
            <Botao variante="latao" onClick={() => void abrirMesaEmJanela()}>
              Mostrar a janela
            </Botao>
            <Botao variante="fantasma" onClick={() => void trazerMesaParaOApp()}>
              Trazer para cá
            </Botao>
          </div>
        </div>
      ) : (
        <MesaDaBatalha
          espelho={espelho}
          enviar={enviarAqui}
          acoesDoTopo={
            <Botao tamanho="p" title="Abre a mesa numa janela do Windows à parte, que pode ir para o segundo monitor" onClick={() => void abrirMesaEmJanela()}>
              Abrir em janela
            </Botao>
          }
        />
      )}
    </Dialogo>
  )
}

/** Os botões que abrem a mesa (a página Batalha do livro, One Piece e Dragon Ball). */
export function AbrirAMesaDaBatalha() {
  const emJanela = useMesaDaBatalha((state) => state.emJanela)
  return (
    <div className="mb-abrir" role="group" aria-label="Mesa da batalha">
      <Botao variante="latao" largo onClick={emJanela ? () => void abrirMesaEmJanela() : abrirMesaNoApp}>
        {emJanela ? 'Mostrar a janela da batalha' : 'Abrir a mesa da batalha'}
      </Botao>
      {emJanela ? (
        <Botao variante="fantasma" onClick={() => void trazerMesaParaOApp()}>
          Trazer para o app
        </Botao>
      ) : (
        <Botao variante="fantasma" title="Abre a mesa numa janela do Windows à parte, que pode ir para o segundo monitor" onClick={() => void abrirMesaEmJanela()}>
          Em janela
        </Botao>
      )}
    </div>
  )
}
