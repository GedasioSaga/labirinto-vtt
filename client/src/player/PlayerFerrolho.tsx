import { useState } from 'react'
import type { AcaoDeFerrolho } from '../lib/ferrolho'

interface PlayerFerrolhoProps {
  /** A porta que o jogador alcança agora e o que dá para fazer (`lib/ferrolho.ts`); `null` = nenhuma. */
  acao: AcaoDeFerrolho | null
  /**
   * Muda a cada resposta que pode encerrar a espera: recorte novo ou aviso de
   * porta ("Trancada", "Longe demais"). Quem monta passa o `rev` do mapa e o id do aviso.
   */
  revisao: string
  /** `on: true` corre o ferrolho; `false` tira. */
  onAct: (wallId: string, on: boolean) => void
}

function rotulo(acao: AcaoDeFerrolho): string {
  if (acao.acao === 'tirar') return 'Tirar o ferrolho'
  return acao.aberta ? 'Fechar e passar o ferrolho' : 'Passar o ferrolho'
}

/**
 * JOGADOR TRANCA A PORTA: um botão só, acima dos avisos, que aparece com a
 * ficha encostada numa porta que o mestre não trancou. Do lado de quem trancou
 * vira "Tirar o ferrolho". Depois do toque ele espera no próprio botão
 * (desligado, "Passando o ferrolho…") até chegar a resposta: o recorte novo
 * (com a porta mudada) ou o aviso de recusa de sempre.
 */
export function PlayerFerrolho({ acao, revisao, onAct }: PlayerFerrolhoProps) {
  /** O toque que ainda espera resposta: a ação tocada e a revisão em que foi tocada. */
  const [esperando, setEsperando] = useState<{ chave: string; revisao: string } | null>(null)
  if (acao === null) return null
  const chave = `${acao.wallId}|${acao.acao}|${acao.aberta}`
  const ocupado = esperando !== null && esperando.chave === chave && esperando.revisao === revisao
  return (
    <button
      type="button"
      className="pp-ferrolho"
      disabled={ocupado}
      onClick={() => {
        setEsperando({ chave, revisao })
        onAct(acao.wallId, acao.acao === 'passar')
      }}
    >
      {ocupado ? (acao.acao === 'passar' ? 'Passando o ferrolho…' : 'Tirando o ferrolho…') : rotulo(acao)}
    </button>
  )
}
