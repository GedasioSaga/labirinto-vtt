import { useEffect, useState } from 'react'
import { VezDoNpcNoCentro } from '../components/batalha/BatalhaDoMestre'
import { EscolhendoCompanions } from '../components/caracteristicas/EscolhendoCompanions'
import { Botao } from '../components/grimorio/Botao'
import { CampoSeg, type OpcaoDoSeg } from '../components/grimorio/CampoSeg'
import { chaveDaVez } from '../lib/batalha/combate'
import { cartaDaVez } from '../lib/batalha/turnos'
import { useBatalhaStore } from '../stores/batalhaStore'
import { abrirMesaEmJanela, escolherModoDaBatalha, garantirAJanelaDaBatalha, trazerMesaParaOApp, useMesaDaBatalha, type ModoDaBatalha } from './controleDaJanela'
import { aplicarPedido, assinarEspelho } from './mesa'
import { MesaDaBatalha, type ItemDoMenuDaMesa } from './MesaDaBatalha'
import { useTelaDaMesa } from './telaDaMesa'
import type { EspelhoDaBatalha, PedidoDaMesa, RespostaDaMesa } from './tipos'

/**
 * A MESA DA BATALHA no app (protótipo aprovado em 19/11/2026): no modo
 * minimalista ela fica encostada na direita do mapa, sem diálogo por cima. Na
 * janela à parte, ou no modo "como jogador" (o menu grande no meio do mapa),
 * sobra uma pílula no alto que diz o modo e volta à mesa. Montada uma vez no App.
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

/**
 * Onde a batalha do mestre está agora, com ela ligada na cena aberta: na doca (o modo minimalista), na
 * janela à parte ou no menu do jogador. Lido do modo só: um de cada vez.
 */
export function useLugarDaMesa(emBatalha: boolean): 'doca' | 'janela' | 'jogador' | null {
  const modo = useMesaDaBatalha((state) => state.modo)
  if (!emBatalha) return null
  if (modo === 'janela') return 'janela'
  return modo === 'minimalista' ? 'doca' : 'jogador'
}

const ITENS_DA_DOCA: readonly ItemDoMenuDaMesa[] = [
  { chave: 'janela', rotulo: 'Abrir em outra janela', onEscolher: () => void escolherModoDaBatalha('janela') },
  { chave: 'jogador', rotulo: 'Jogar como jogador', onEscolher: () => void escolherModoDaBatalha('jogador') },
]

export function TelaDaBatalhaNoApp({ emBatalha }: { emBatalha: boolean }) {
  const lugar = useLugarDaMesa(emBatalha)
  const espelho = useEspelhoAoVivo(lugar === 'doca')
  // O modo janela lembrado da última sessão: a batalha à vista abre a janela (ela já aberta, nada muda).
  useEffect(() => {
    if (lugar === 'janela') void garantirAJanelaDaBatalha()
  }, [lugar])
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
  if (lugar === 'jogador') {
    return (
      <div className="mb-pilula-da-mesa">
        <span>Batalha pelo menu do jogador.</span>
        <Botao tamanho="p" variante="latao" onClick={() => void escolherModoDaBatalha('minimalista')}>
          Mesa minimalista
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
 * O menu da vez do NPC no meio do mapa (One Piece). No modo "como jogador" ele
 * abre em toda vez de NPC. Com a mesa (minimalista ou na janela), ele só abre
 * quando o mestre pede pela mesa (o golpe que pede escolha a mais: invocação,
 * opção, área, custo à mão; Transformação, Passivas, Itens) e fecha sozinho
 * quando a vez anda ou o modo troca (`mudarModo`).
 */
export function MenuDaVezSobPedido({ sceneKey, mesaAVista }: { sceneKey: string; mesaAVista: boolean }) {
  const pedido = useTelaDaMesa((state) => state.menuDoMapa)
  const chave = useBatalhaStore((state) => {
    const cena = Object.hasOwn(state.cenas, sceneKey) ? state.cenas[sceneKey] : undefined
    const carta = cena === undefined ? null : cartaDaVez(cena.turnos)
    return cena === undefined || carta === null ? null : chaveDaVez(cena.turnos.rodada, carta.id)
  })
  const pedidoDaVez = pedido !== null && pedido.sceneKey === sceneKey && pedido.vez === chave ? pedido : null
  const aberto = !mesaAVista || pedidoDaVez !== null
  if (!aberto) return null
  // 26/11/2026: a mesa reduzida abre o menu já na Transformação, nas Passivas ou nos Itens; cada pedido assim remonta nele.
  const tela = pedidoDaVez?.tela
  return <VezDoNpcNoCentro key={tela === undefined || pedidoDaVez === null ? 'menu' : `${tela}:${pedidoDaVez.pedido}`} sceneKey={sceneKey} telaInicial={tela} />
}

const DICA_DO_MODO: Record<ModoDaBatalha, string> = {
  janela: 'A mesa numa janela do Windows à parte, que pode ir para o segundo monitor.',
  minimalista: 'A mesa compacta, encostada na direita do mapa.',
  jogador: 'Na vez do NPC, o menu grande no meio do mapa, o mesmo do jogador.',
}

/** Dragon Ball não tem o menu do jogador para o NPC: o terceiro modo é a página inteira do livro. */
const DICA_PELO_LIVRO = 'Sem mesa: a vez, a ordem e o registro ficam nesta página do livro.'

/**
 * O seletor da página Batalha do livro (One Piece e Dragon Ball): os 3 modos de conduzir a batalha, um de
 * cada vez, lembrados neste aparelho. `comMenuDoJogador`: a batalha tem o menu do jogador (One Piece).
 */
export function AbrirAMesaDaBatalha({ comMenuDoJogador }: { comMenuDoJogador: boolean }) {
  const modo = useMesaDaBatalha((state) => state.modo)
  const opcoes: readonly OpcaoDoSeg<ModoDaBatalha>[] = [
    { valor: 'janela', rotulo: 'Em janela' },
    { valor: 'minimalista', rotulo: 'Minimalista' },
    { valor: 'jogador', rotulo: comMenuDoJogador ? 'Como jogador' : 'Pelo livro' },
  ]
  return (
    <div className="mb-abrir" role="group" aria-label="Mesa da batalha">
      <CampoSeg rotulo="Conduzir a batalha" opcoes={opcoes} valor={modo} onChange={(novo) => void escolherModoDaBatalha(novo)} />
      <p className="gr-nota">{modo === 'jogador' && !comMenuDoJogador ? DICA_PELO_LIVRO : DICA_DO_MODO[modo]}</p>
      {modo === 'janela' && (
        <Botao variante="fantasma" tamanho="p" onClick={() => void abrirMesaEmJanela()}>
          Mostrar a janela da batalha
        </Botao>
      )}
    </div>
  )
}
