import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PalcoDaArenaProps } from '../../lib/arena/tipos'
import { criarPalcoDaArena, type DadosDoPalco, type PalcoPixiDaArena } from '../../pixi/palcoDaArena'
import type { Bounds } from '../../pixi/world'
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
      obstaculos: () => obstaculosSobre(el),
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

/** Colunas (comem a esquerda ou a direita do palco): o menu da vez e o placar do Judge. */
const COLUNAS_POR_CIMA = ['.pp-batalha-menu > *', '.ar-placar-lugar']
/** Faixas (comem o alto): a ordem dos turnos. */
const FAIXAS_POR_CIMA = ['.pp-batalha-faixa']

/**
 * O que flutua sobre o palco agora, em px relativos ao canvas, para o
 * enquadramento (`freeArea`). Coluna vira a altura inteira e faixa a largura
 * inteira: o menu em modo lista é mais largo que alto e, medido como veio,
 * comeria o alto em vez da esquerda.
 */
function obstaculosSobre(el: HTMLElement): Bounds[] {
  const tela = el.closest('.ar-tela')
  if (tela === null) return []
  const base = el.getBoundingClientRect()
  const medir = (seletores: string[]) =>
    seletores.flatMap((seletor) => Array.from(tela.querySelectorAll<HTMLElement>(seletor))).map((peca) => peca.getBoundingClientRect()).filter((caixa) => caixa.width > 0 && caixa.height > 0)
  return [
    ...medir(COLUNAS_POR_CIMA).map((caixa) => ({ minX: caixa.left - base.left, maxX: caixa.right - base.left, minY: 0, maxY: base.height })),
    ...medir(FAIXAS_POR_CIMA).map((caixa) => ({ minX: 0, maxX: base.width, minY: caixa.top - base.top, maxY: caixa.bottom - base.top })),
  ]
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
