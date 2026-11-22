import { startTransition, useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react'
import { distanciaEntreFichas, pegadaDaCasa, type Casa, type PegadaNaGrade } from '../../lib/batalha/area'
import type { AlvoNaMira } from './dadosDoMenu'

/**
 * FASE 6 (H05, a área num ponto): a grade em volta de quem usa, dentro da
 * mira, para escolher a casa do centro (a granada). Vale igual no mapa do
 * mestre, na tela do jogador e na Arena: as três já dão a ficha de cada um na
 * grade (`naGrade`). A casa além do alcance fica apagada; as casas que a área
 * pega ficam pintadas. Teclado: as setas andam o cursor, Enter ou Espaço
 * escolhe. Sem animação: é escolha repetida, a resposta tem de ser na hora.
 */

/** Teto de casas para cada lado da grade da mira (sem alcance na técnica, a mira mostra até aqui). */
const LADO_DA_GRADE_MAX = 8

const SETAS: Readonly<Record<string, Casa>> = {
  ArrowUp: { col: 0, row: -1 },
  ArrowDown: { col: 0, row: 1 },
  ArrowLeft: { col: -1, row: 0 },
  ArrowRight: { col: 1, row: 0 },
}

interface EscolhaDoPontoProps {
  /** A ficha de quem usa na grade (a origem do alcance). */
  deQuemAge: PegadaNaGrade
  alvos: readonly AlvoNaMira[]
  /** Até quantas casas de quem usa; ausente = sem limite conferido (a grade mostra `LADO_DA_GRADE_MAX`). */
  alcance: number | undefined
  /** O raio da área em volta do ponto (1 = o ponto e as 8 casas em volta). */
  raio: number
  ponto: Casa | null
  onEscolher: (casa: Casa) => void
}

/** A ficha que ocupa a casa (a primeira da lista); `null` = casa vazia. */
function fichaNaCasa(alvos: readonly AlvoNaMira[], casa: Casa): AlvoNaMira | null {
  return alvos.find((alvo) => alvo.naGrade !== undefined && distanciaEntreFichas(alvo.naGrade.ficha, pegadaDaCasa(casa)) === 0) ?? null
}

export function EscolhaDoPonto({ deQuemAge, alvos, alcance, raio, ponto, onEscolher }: EscolhaDoPontoProps) {
  const idBase = useId()
  // Uma volta além do alcance, apagada: quem está logo fora aparece fora (e não some da grade).
  const lado = Math.min(alcance === undefined ? LADO_DA_GRADE_MAX : alcance + 1, LADO_DA_GRADE_MAX)
  const inicio: Casa = { col: deQuemAge.col - lado, row: deQuemAge.row - lado }
  const largura = deQuemAge.tamanho + 2 * lado
  const [cursor, setCursor] = useState<Casa>(() => ponto ?? { col: deQuemAge.col, row: deQuemAge.row - Math.min(lado, 1) })
  // As casas entram numa transição, depois da mira aberta: o React fatia a pintura das ~200 casas e a mira não trava ao abrir (medido: a abertura passava de 200 ms no dev).
  const [comCasas, setComCasas] = useState(false)
  useEffect(() => {
    startTransition(() => setComCasas(true))
  }, [])
  const distancia = (casa: Casa): number => distanciaEntreFichas(deQuemAge, pegadaDaCasa(casa))
  const alcanca = (casa: Casa): boolean => alcance === undefined || distancia(casa) <= alcance
  const dentroDaGrade = (casa: Casa): boolean => casa.col >= inicio.col && casa.col < inicio.col + largura && casa.row >= inicio.row && casa.row < inicio.row + largura

  const teclar = (evento: KeyboardEvent<HTMLDivElement>) => {
    const passo = SETAS[evento.key]
    if (passo !== undefined) {
      evento.preventDefault()
      const proxima = { col: cursor.col + passo.col, row: cursor.row + passo.row }
      if (dentroDaGrade(proxima)) setCursor(proxima)
      return
    }
    if (evento.key === 'Enter' || evento.key === ' ') {
      // O Enter da mira lança o golpe: aqui ele escolhe a casa (a mira não recebe).
      evento.preventDefault()
      evento.stopPropagation()
      if (alcanca(cursor)) onEscolher(cursor)
    }
  }

  // A grade só muda com quem usa, os alvos, o alcance e o ponto: o cursor (as setas) não refaz as contas de cada casa.
  const linhas = useMemo(
    () =>
      Array.from({ length: largura }, (_, linha) =>
        Array.from({ length: largura }, (_, coluna) => {
          const casa: Casa = { col: deQuemAge.col - lado + coluna, row: deQuemAge.row - lado + linha }
          const casas = distanciaEntreFichas(deQuemAge, pegadaDaCasa(casa))
          const longe = alcance !== undefined && casas > alcance
          const area = ponto !== null && Math.max(Math.abs(casa.col - ponto.col), Math.abs(casa.row - ponto.row)) <= raio
          const escolhida = ponto !== null && ponto.col === casa.col && ponto.row === casa.row
          return { casa, casas, longe, area, escolhida, ficha: casas === 0 ? null : fichaNaCasa(alvos, casa) }
        }),
      ),
    [deQuemAge, lado, largura, alcance, ponto, raio, alvos],
  )
  const idDaCasa = (casa: Casa) => `${idBase}-${casa.col}-${casa.row}`
  const descricao = ponto === null ? 'Nenhuma casa escolhida.' : `Centro a ${distancia(ponto)} ${distancia(ponto) === 1 ? 'casa' : 'casas'} de quem usa.`

  return (
    <fieldset className="bt-escolha bt-ponto">
      <legend>Onde cai: escolha a casa do centro{alcance === undefined ? '' : ` (até ${alcance} ${alcance === 1 ? 'casa' : 'casas'})`}</legend>
      <div
        className="bt-ponto__grade"
        role="grid"
        tabIndex={0}
        aria-label="Casas em volta de quem usa"
        aria-activedescendant={comCasas ? idDaCasa(cursor) : undefined}
        onKeyDown={teclar}
        style={{ gridTemplateColumns: `repeat(${largura}, 1fr)` }}
      >
        {comCasas && linhas.map((linha, indice) => (
          <div key={indice} role="row" className="bt-ponto__linha">
            {linha.map(({ casa, casas, longe, area, escolhida, ficha }) => {
              const deQuemUsa = casas === 0
              const classes = ['bt-ponto__casa', area ? 'bt-ponto__casa--area' : '', escolhida ? 'bt-ponto__casa--centro' : '', longe ? 'bt-ponto__casa--longe' : '', cursor.col === casa.col && cursor.row === casa.row ? 'bt-ponto__casa--cursor' : '']
              const quem = deQuemUsa ? 'quem usa' : ficha === null ? 'vazia' : ficha.nome
              return (
                <div
                  key={`${casa.col}-${casa.row}`}
                  id={idDaCasa(casa)}
                  role="gridcell"
                  aria-selected={escolhida}
                  aria-disabled={longe}
                  aria-label={`${quem}, a ${casas} ${casas === 1 ? 'casa' : 'casas'}${longe ? ', fora do alcance' : ''}`}
                  className={classes.filter((classe) => classe !== '').join(' ')}
                  onClick={() => {
                    setCursor(casa)
                    if (!longe) onEscolher(casa)
                  }}
                >
                  {deQuemUsa ? <span className="bt-ponto__eu" aria-hidden="true" /> : ficha !== null ? <span className={ficha.lado === 'outro' ? 'bt-ponto__ficha bt-ponto__ficha--outro' : 'bt-ponto__ficha'} aria-hidden="true" /> : null}
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <p className="bt-mira__nota" aria-live="polite">
        {descricao}
      </p>
    </fieldset>
  )
}
