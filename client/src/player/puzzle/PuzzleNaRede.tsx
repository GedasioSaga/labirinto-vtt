/**
 * A TELA DO PUZZLE NA MESA DE VERDADE (P8 ligada na P7): a `TelaDoPuzzle`
 * alimentada pelo `state.puzzle` da conexão do jogador. A tela continua sem
 * saber de rede: daqui saem a vista, os acontecimentos (`naRede.ts`) e as
 * ações, que viram `acaoNoPuzzle` e `sairDoPuzzle` em quem monta.
 *
 * O puzzle fechado pelo mestre (`fechado`: mudou ou sumiu) não é mais jogável:
 * a tela sai na hora e quem monta avisa por quê.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { PuzzleFechadoMotivo } from '../../net/protocoloDoPuzzle'
import type { AcaoNoPuzzle } from '../../puzzles/tipos'
import type { PuzzleDoJogador } from '../playerConnection'
import { acontecimentosDaRede } from './naRede'
import { TelaDoPuzzle } from './TelaDoPuzzle'
import type { AcontecimentoNoPuzzle, PvNaTela } from './tipos'

export interface PropsDoPuzzleNaRede {
  puzzle: PuzzleDoJogador
  /** O nome da ficha que entrou (`nomeNoPuzzle`): o mesmo que o host põe no `por`. */
  eu: string
  /** Os PV da ficha dela; `null` = boneco sem ficha, ou sistema sem vida. */
  pv: PvNaTela | null
  onAgir: (acao: AcaoNoPuzzle) => void
  onSair: () => void
  onFechado: (motivo: PuzzleFechadoMotivo) => void
  /** O "Ler" da dica: o documento que ele já leu, reaberto pela lista dele (`documento.ler` com `daLista`). */
  onLerDica: (docId: string, peloTeclado: boolean) => void
  /** O documento da dica está aberto por cima: a tela do puzzle não ouve o teclado. */
  porBaixo: boolean
}

/** A tela guarda o `id` do último que tratou: bastam os últimos (o mesmo número do jogo local). */
const ACONTECIMENTOS_GUARDADOS = 12

interface Registro {
  /** A leitura do puzzle de que os acontecimentos já saíram. */
  visto: PuzzleDoJogador
  lista: AcontecimentoNoPuzzle[]
  proximo: number
}

/**
 * A janela que abre POR CIMA da tela do puzzle (o documento do "Ler" da dica).
 * A tela mora no `body`, acima do resto da página (`.tpz`); com ela aberta, a
 * janela vai para o `body` também, numa camada logo acima. Fechada, fica onde está.
 */
export function PorCimaDoPuzzle({ ativo, children }: { ativo: boolean; children: ReactNode }) {
  return ativo ? createPortal(<div className="tpz-por-cima">{children}</div>, document.body) : children
}

export function PuzzleNaRede({ puzzle, eu, pv, onAgir, onSair, onFechado, onLerDica, porBaixo }: PropsDoPuzzleNaRede) {
  // Começa do que já está na tela: montar de novo não repete a última recusa nem o desfecho.
  const [registro, setRegistro] = useState<Registro>(() => ({ visto: puzzle, lista: [], proximo: 1 }))
  // A leitura nova vira acontecimentos no mesmo render (o padrão do React para "derivar da prop anterior"):
  // a tela recebe a vista e o acontecimento juntos, sem um quadro com só um deles.
  let atual = registro
  if (registro.visto !== puzzle) {
    const corpos = acontecimentosDaRede(registro.visto, puzzle)
    const novos = corpos.map((corpo, i): AcontecimentoNoPuzzle => ({ ...corpo, id: registro.proximo + i }))
    atual = {
      visto: puzzle,
      lista: novos.length === 0 ? registro.lista : [...registro.lista, ...novos].slice(-ACONTECIMENTOS_GUARDADOS),
      proximo: registro.proximo + novos.length,
    }
    setRegistro(atual)
  }

  const fechado = puzzle.fechado
  useEffect(() => {
    if (fechado !== null) onFechado(fechado)
  }, [fechado, onFechado])

  if (fechado !== null) return null
  // Só o documento que ele já leu tem o id na vista (o host não manda o de quem não leu): o "Ler" existe só aí.
  const dica = puzzle.vista.dica
  const lerDica = dica !== null && dica.tipo === 'documento' && dica.podeLer ? (peloTeclado: boolean) => onLerDica(dica.docId, peloTeclado) : undefined
  // O `rev` que a tela manda não sobe: a conexão põe o da vista que ela guardou, a mesma que a tela mostra.
  return <TelaDoPuzzle vista={puzzle.vista} eu={eu} pv={pv} acontecimentos={atual.lista} onAgir={onAgir} onSair={onSair} onLerDica={lerDica} porBaixo={porBaixo} />
}
