import { useEffect, useState } from 'react'
import { VezDoNpcNoCentro } from '../components/batalha/BatalhaDoMestre'
import { EscolhendoCompanions } from '../components/caracteristicas/EscolhendoCompanions'
import { Botao } from '../components/grimorio/Botao'
import { chaveDaVez } from '../lib/batalha/combate'
import { cartaDaVez } from '../lib/batalha/turnos'
import { useBatalhaStore } from '../stores/batalhaStore'
import { abrirMesaEmJanela, abrirMesaNoApp, fecharMesaNoApp, trazerMesaParaOApp, useMesaDaBatalha } from './controleDaJanela'
import { aplicarPedido, assinarEspelho } from './mesa'
import { MesaDaBatalha, type ItemDoMenuDaMesa } from './MesaDaBatalha'
import { useTelaDaMesa } from './telaDaMesa'
import type { EspelhoDaBatalha, PedidoDaMesa, RespostaDaMesa } from './tipos'

/**
 * A MESA DA BATALHA no app (protótipo aprovado em 19/11/2026): durante a
 * batalha ela fica encostada na direita do mapa, sem diálogo por cima. Com a
 * janela à parte aberta, ou recolhida pelo mestre, sobra uma pílula no alto
 * que diz onde ela está e a traz de volta. Montada uma vez no App.
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

/** Onde a mesa está agora, com a batalha ligada na cena aberta: na doca, recolhida ou na janela à parte. */
export function useLugarDaMesa(emBatalha: boolean): 'doca' | 'recolhida' | 'janela' | null {
  const noApp = useMesaDaBatalha((state) => state.noApp)
  const emJanela = useMesaDaBatalha((state) => state.emJanela)
  if (!emBatalha) return null
  if (emJanela) return 'janela'
  return noApp ? 'doca' : 'recolhida'
}

const ITENS_DA_DOCA: readonly ItemDoMenuDaMesa[] = [
  { chave: 'janela', rotulo: 'Abrir em outra janela', onEscolher: () => void abrirMesaEmJanela() },
  { chave: 'recolher', rotulo: 'Recolher a mesa', onEscolher: fecharMesaNoApp },
]

export function TelaDaBatalhaNoApp({ emBatalha }: { emBatalha: boolean }) {
  const lugar = useLugarDaMesa(emBatalha)
  const espelho = useEspelhoAoVivo(lugar === 'doca')
  if (lugar === null) return null
  if (lugar === 'janela') {
    return (
      <div className="mb-pilula-da-mesa" role="status">
        <span>A mesa da batalha está na outra janela.</span>
        <Botao tamanho="p" onClick={() => void abrirMesaEmJanela()}>
          Mostrar a janela
        </Botao>
        <Botao tamanho="p" variante="fantasma" onClick={() => void trazerMesaParaOApp()}>
          Trazer para o app
        </Botao>
      </div>
    )
  }
  if (lugar === 'recolhida') {
    return (
      <div className="mb-pilula-da-mesa">
        <span>Mesa da batalha recolhida.</span>
        <Botao tamanho="p" variante="latao" onClick={abrirMesaNoApp}>
          Mostrar a mesa
        </Botao>
      </div>
    )
  }
  // COMPANION: o "Aira escolhendo…" com o "Escolher por Aira" mora na página Batalha do livro, que a doca cobre.
  const doApp = espelho === null ? null : <EscolhendoCompanions sceneKey={espelho.sceneKey} />
  return (
    <aside className="mb-doca" aria-label="Mesa da batalha">
      <MesaDaBatalha espelho={espelho} enviar={enviarAqui} lugar="doca" itensDoLugar={ITENS_DA_DOCA} doApp={doApp} />
    </aside>
  )
}

/**
 * O menu da vez do NPC no meio do mapa (One Piece). Com a mesa à vista (doca ou
 * janela), ele só abre quando a mesa pede (o golpe que pede escolha a mais:
 * invocação, opção, área, custo à mão) e fecha sozinho quando a vez anda. Com a
 * mesa recolhida, ele volta a abrir em toda vez de NPC, como antes da mesa.
 */
export function MenuDaVezSobPedido({ sceneKey, mesaAVista }: { sceneKey: string; mesaAVista: boolean }) {
  const pedido = useTelaDaMesa((state) => state.menuDoMapa)
  const chave = useBatalhaStore((state) => {
    const cena = Object.hasOwn(state.cenas, sceneKey) ? state.cenas[sceneKey] : undefined
    const carta = cena === undefined ? null : cartaDaVez(cena.turnos)
    return cena === undefined || carta === null ? null : chaveDaVez(cena.turnos.rodada, carta.id)
  })
  const aberto = !mesaAVista || (pedido !== null && pedido.sceneKey === sceneKey && pedido.vez === chave)
  return aberto ? <VezDoNpcNoCentro sceneKey={sceneKey} /> : null
}

/** Os botões da página Batalha do livro (One Piece e Dragon Ball): onde a mesa está e como trazê-la. */
export function AbrirAMesaDaBatalha() {
  const emJanela = useMesaDaBatalha((state) => state.emJanela)
  const noApp = useMesaDaBatalha((state) => state.noApp)
  if (emJanela) {
    return (
      <div className="mb-abrir" role="group" aria-label="Mesa da batalha">
        <Botao variante="latao" largo onClick={() => void abrirMesaEmJanela()}>
          Mostrar a janela da batalha
        </Botao>
        <Botao variante="fantasma" onClick={() => void trazerMesaParaOApp()}>
          Trazer para o app
        </Botao>
      </div>
    )
  }
  return (
    <div className="mb-abrir" role="group" aria-label="Mesa da batalha">
      <Botao variante="latao" largo onClick={noApp ? fecharMesaNoApp : abrirMesaNoApp}>
        {noApp ? 'Recolher a mesa da batalha' : 'Mostrar a mesa da batalha'}
      </Botao>
      <Botao variante="fantasma" title="Abre a mesa numa janela do Windows à parte, que pode ir para o segundo monitor" onClick={() => void abrirMesaEmJanela()}>
        Em janela
      </Botao>
    </div>
  )
}
