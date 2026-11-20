/**
 * A TELA DO PUZZLE NA MESA DE VERDADE (P8 ligada na P7): a `TelaDoPuzzle`
 * alimentada pelo `state.puzzle` da conexão do jogador. A tela continua sem
 * saber de rede: daqui saem a vista, os acontecimentos (`naRede.ts`) e as
 * ações, que viram `acaoNoPuzzle` e `sairDoPuzzle` em quem monta.
 *
 * O puzzle fechado pelo mestre (`fechado`: mudou ou sumiu) não é mais jogável:
 * a tela sai na hora e quem monta avisa por quê.
 */
import { useEffect, useState } from 'react'
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
}

/** A tela guarda o `id` do último que tratou: bastam os últimos (o mesmo número do jogo local). */
const ACONTECIMENTOS_GUARDADOS = 12

interface Registro {
  /** A leitura do puzzle de que os acontecimentos já saíram. */
  visto: PuzzleDoJogador
  lista: AcontecimentoNoPuzzle[]
  proximo: number
}

export function PuzzleNaRede({ puzzle, eu, pv, onAgir, onSair, onFechado }: PropsDoPuzzleNaRede) {
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
  // O `rev` que a tela manda não sobe: a conexão põe o da vista que ela guardou, a mesma que a tela mostra.
  return <TelaDoPuzzle vista={puzzle.vista} eu={eu} pv={pv} acontecimentos={atual.lista} onAgir={onAgir} onSair={onSair} />
}
