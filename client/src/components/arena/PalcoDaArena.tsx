import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PalcoDaArenaProps } from '../../lib/arena/tipos'
import { criarPalcoDaArena, type DadosDoPalco, type PalcoPixiDaArena } from '../../pixi/palcoDaArena'
import { useToastStore } from '../../stores/toastStore'

/**
 * O PALCO DA ARENA DE TESTES: a casca React do Pixi próprio da arena
 * (`pixi/palcoDaArena.ts`). Só props (`PalcoDaArenaProps`), sem store da
 * batalha: quem monta (`TelaDaArena`) lê a sessão e a batalha da arena e
 * passa para cá. Ocupa a caixa do pai inteira (classe `arena-palco`).
 *
 * Arrastar a ficha e soltar = `onMover` no centro da casa; clicar na ficha (ou
 * no corpo do Judge-boneco) = `onTocarFicha`; arrastar no vazio = pan; roda =
 * zoom; duplo clique no vazio = enquadra a grade de novo.
 */
export function PalcoDaArena(props: PalcoDaArenaProps) {
  const caixa = useRef<HTMLDivElement>(null)
  const palco = useRef<PalcoPixiDaArena | null>(null)
  // O Pixi monta uma vez só e lê sempre as props mais recentes por aqui.
  const propsRef = useRef(props)
  propsRef.current = props
  /** Sobe quando o WebGL perde o contexto: o palco é trocado por um novo. */
  const [geracao, setGeracao] = useState(0)

  useEffect(() => {
    const el = caixa.current
    if (el === null) return
    const novo = criarPalcoDaArena(el, {
      dados: () => dadosDe(propsRef.current),
      onMover: (tokenId, x, y) => propsRef.current.onMover(tokenId, x, y),
      onTocarFicha: (tokenId) => propsRef.current.onTocarFicha(tokenId),
      aoFalhar: (erro) => {
        console.warn('Arena: o palco não conseguiu desenhar', erro)
        useToastStore.getState().push('error', 'A arena não conseguiu desenhar o palco (WebGL indisponível).')
      },
      aoPerderContexto: () => setGeracao((atual) => atual + 1),
    })
    palco.current = novo
    propsRef.current.onConsulta(novo.consulta)
    return () => {
      palco.current = null
      novo.destruir()
      propsRef.current.onConsulta(null)
    }
  }, [geracao])

  // Quem montou trocou a callback: ela recebe a consulta de agora.
  const { onConsulta } = props
  useEffect(() => {
    const atual = palco.current
    if (atual !== null) onConsulta(atual.consulta)
  }, [onConsulta])

  const { tokens, grade, vezTokenId, vidas, selos, fotoDaForma, judge, judgeAlvo, gestoDoJudge, bonecoTokenId } = props
  // Antes da pintura: a ficha solta já aparece na casa nova no mesmo quadro.
  useLayoutEffect(() => {
    palco.current?.atualizar()
  }, [tokens, grade, vezTokenId, vidas, selos, fotoDaForma, judge, judgeAlvo, gestoDoJudge, bonecoTokenId])

  return <div ref={caixa} className="arena-palco" aria-label="Palco da arena" style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }} />
}

function dadosDe(props: PalcoDaArenaProps): DadosDoPalco {
  return {
    tokens: props.tokens,
    grade: props.grade,
    vezTokenId: props.vezTokenId,
    vidas: props.vidas,
    selos: props.selos,
    fotoDaForma: props.fotoDaForma,
    judge: props.judge,
    judgeAlvo: props.judgeAlvo,
    gestoDoJudge: props.gestoDoJudge,
    bonecoTokenId: props.bonecoTokenId,
  }
}
