import { useVisaoDosJogadoresStore } from '../stores/visaoDosJogadoresStore'

/**
 * VISÃO DOS JOGADORES (pedido do mestre de 25/11/2026): liga e desliga o anel
 * do alcance de visão das fichas de jogador no mapa do editor
 * (`pixi/drawVisaoDosJogadores.ts`). Mora na barra de cima, do lado do livro
 * do mestre, fora do fluxo dela (como o "Pausar NPCs"): o chip da cena segue
 * centrado. Nasce ligado e a escolha fica no aparelho (`visaoDosJogadoresStore`).
 */
export function BotaoDaVisaoDosJogadores() {
  const ligada = useVisaoDosJogadoresStore((state) => state.ligada)
  const alternar = useVisaoDosJogadoresStore((state) => state.alternar)
  return (
    <button
      type="button"
      className="lb-btn lb-visao-jogadores"
      aria-pressed={ligada}
      title={ligada ? 'Esconder o alcance da visão de cada jogador' : 'Mostrar o alcance da visão de cada jogador'}
      onClick={alternar}
    >
      Visão dos jogadores
    </button>
  )
}
