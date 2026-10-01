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

/** O fim do rótulo, que a tela estreita esconde (player.css, `.pp-rotulo-resto`). */
const RESTO = ' deste lado'

/**
 * O rótulo fala o que o jogador vê acontecer, não o nome da peça: "ferrolho"
 * confundia ("como assim passar ferrolho?"). "Deste lado" diz o que a regra
 * faz — só quem está do lado de quem trancou destranca. Em tela estreita fica
 * só o começo ("Trancar"): a coluna das ações do lugar divide a largura com o
 * "Chamar o mestre".
 */
function comeco(acao: AcaoDeFerrolho): string {
  if (acao.acao === 'tirar') return 'Destrancar'
  return acao.aberta ? 'Fechar e trancar' : 'Trancar'
}

function rotulo(acao: AcaoDeFerrolho): string {
  return `${comeco(acao)}${RESTO}`
}

/**
 * JOGADOR TRANCA A PORTA: um botão só, acima dos avisos, que aparece com a
 * ficha encostada numa porta que o mestre não trancou. Do lado de quem trancou
 * vira "Destrancar deste lado". Depois do toque ele espera no próprio botão
 * (desligado, "Trancando…") até chegar a resposta: o recorte novo
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
      // O CSS desenha uma cópia invisível do rótulo de repouso: "Trancando…" é
      // mais curto e, sem ela, a pílula encolheria no toque. A curta é a da tela estreita.
      data-reserva={rotulo(acao)}
      data-reserva-curta={comeco(acao)}
      // O nome inteiro também quando a tela estreita mostra só o começo.
      aria-label={ocupado ? undefined : rotulo(acao)}
      disabled={ocupado}
      onClick={() => {
        setEsperando({ chave, revisao })
        onAct(acao.wallId, acao.acao === 'passar')
      }}
    >
      {ocupado ? (
        acao.acao === 'passar' ? 'Trancando…' : 'Destrancando…'
      ) : (
        // Um item só na coluna do botão (o rótulo e a reserva embaixo dele): o fim não desce de linha.
        <span>
          {comeco(acao)}
          <span className="pp-rotulo-resto">{RESTO}</span>
        </span>
      )}
    </button>
  )
}
