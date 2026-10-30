/**
 * Arrasto do Judge pelo mestre (fatia J da F3, seção 5.1 do plano
 * `docs/planos/batalha-one-piece-f3-plano.md`), sem Pixi, no molde do
 * `laserGesture`: o PixiCanvas repassa os eventos do stage e, quando um método
 * devolve `true`, o Judge consumiu o evento e a ferramenta ativa não roda
 * (nem seleciona, nem move ficha, nem faz pan).
 *
 * Só o botão esquerdo, só com a batalha ligada e só sobre o corpo dele. No
 * arrasto só a tela do mestre anda (a prévia, `mostrar`); ao soltar, encaixa
 * no centro da casa e entrega a posição (`soltar`), que vira `moverJudge` +
 * `gravarJudgeLembrado` em quem monta. Esc ou janela sem foco: volta.
 */

export interface PontoDoJudge {
  x: number
  y: number
}

export interface AlvoDoArrasto {
  /** Onde ele aparece agora (`null` = fora de batalha ou folha ainda baixando). */
  posicao: () => PontoDoJudge | null
  /** O ponto está no corpo dele? */
  acertou: (ponto: PontoDoJudge) => boolean
  /** A prévia do arrasto; `null` = volta à posição da batalha. */
  mostrar: (ponto: PontoDoJudge | null) => void
  /** O centro da casa onde ele fica ao soltar (a mesma regra do arrasto de ficha). */
  encaixar: (ponto: PontoDoJudge) => PontoDoJudge
  /** Soltou numa casa: a posição nova da batalha. */
  soltar: (ponto: PontoDoJudge) => void
}

/** Botão esquerdo em `PointerEvent.button`. */
const LEFT_BUTTON = 0

export function createJudgeGesture(alvo: AlvoDoArrasto) {
  /** O pointerdown atual foi no Judge: move e up também são dele. */
  let agarrado: { dx: number; dy: number; ultimo: PontoDoJudge } | null = null

  return {
    pointerDown(button: number, ponto: PontoDoJudge): boolean {
      if (button !== LEFT_BUTTON || agarrado !== null) return false
      const posicao = alvo.posicao()
      if (posicao === null || !alvo.acertou(ponto)) return false
      // O ponto agarrado fica sob o cursor: o Judge não pula para os pés no primeiro move.
      agarrado = { dx: posicao.x - ponto.x, dy: posicao.y - ponto.y, ultimo: posicao }
      return true
    },

    pointerMove(ponto: PontoDoJudge): boolean {
      if (agarrado === null) return false
      agarrado.ultimo = { x: ponto.x + agarrado.dx, y: ponto.y + agarrado.dy }
      alvo.mostrar(agarrado.ultimo)
      return true
    },

    /** pointerup e pointerupoutside: encaixa onde o último move deixou. */
    pointerUp(): boolean {
      if (agarrado === null) return false
      const casa = alvo.encaixar(agarrado.ultimo)
      agarrado = null
      alvo.soltar(casa)
      alvo.mostrar(null)
      return true
    },

    /** Arrastando agora (o Esc é dele). */
    arrastando(): boolean {
      return agarrado !== null
    },

    /** Esc no meio, janela sem foco ou desmontagem: volta para onde estava. */
    cancel(): void {
      if (agarrado === null) return
      agarrado = null
      alvo.mostrar(null)
    },
  }
}
