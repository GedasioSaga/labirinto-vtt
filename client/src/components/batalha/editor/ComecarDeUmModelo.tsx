import { useEffect, useId, useMemo, useRef, type MouseEvent } from 'react'
import { GRUPOS_DOS_MODELOS, MODELOS_PRONTOS, mecanicaDoModelo, type IdDoModelo } from '../../../lib/batalha/mecanica/modelos'
import type { FichaDaPrevia } from '../../../lib/batalha/mecanica/resumo'
import { linhaCurtaDoPapel } from './fraseDoPapel'

interface ComecarDeUmModeloProps {
  ficha: FichaDaPrevia
  onEscolher: (id: IdDoModelo) => void
  onFechar: () => void
}

/**
 * "COMEÇAR DE UM MODELO" (ED3; EDITOR.md §5, protótipo `abrirModelos`): os 22
 * modelos de hoje como pontos de partida, nos grupos de sempre. A janela é o
 * `<dialog>` do sistema por cima do editor: o Tab fica dentro, o Esc fecha e
 * o foco volta a quem abriu. Quem aplica (com o aviso e o Ctrl+Z) é o editor.
 */
export function ComecarDeUmModelo({ ficha, onEscolher, onFechar }: ComecarDeUmModeloProps) {
  const tituloId = useId()
  const dicaId = useId()
  const janela = useRef<HTMLDialogElement>(null)
  // Uma linha por modelo com o que ele monta ("Ataque Completo · 30 SP · Tempo 2"), com a ficha de quem usa.
  const linhas = useMemo(() => new Map(MODELOS_PRONTOS.map((modelo) => [modelo.id, linhaCurtaDoPapel(mecanicaDoModelo(modelo.id, ficha.sistema), ficha)])), [ficha])

  useEffect(() => {
    const aberta = janela.current
    if (aberta === null) return
    const quemAbriu = document.activeElement instanceof HTMLElement ? document.activeElement : null
    aberta.showModal()
    return () => {
      aberta.close()
      quemAbriu?.focus()
    }
  }, [])

  const noFundo = (evento: MouseEvent<HTMLDialogElement>) => {
    // O clique no fundo escurecido cai no próprio <dialog> (o conteúdo é a caixa de dentro).
    if (evento.target === evento.currentTarget) onFechar()
  }

  return (
    <dialog
      ref={janela}
      className="lb-ed__janela-modelos"
      role="dialog"
      aria-labelledby={tituloId}
      aria-describedby={dicaId}
      onCancel={(evento) => {
        evento.preventDefault()
        onFechar()
      }}
      onClick={noFundo}
    >
      <div className="lb-ed__modelos-caixa">
        <div className="lb-ed__modelos-cab">
          <h2 id={tituloId}>Começar de um modelo</h2>
          <p className="lb-ed__dica" id={dicaId}>
            O modelo preenche a ação, o alcance, o dano, o acerto, os efeitos e o custo (o custo, a ação e o dano escritos no cartão entram quando dá). O nome, a descrição e os requisitos ficam. Dá para desfazer.
          </p>
        </div>
        <div className="lb-ed__modelos-corpo">
          {GRUPOS_DOS_MODELOS.map(({ grupo, nome }) => {
            const doGrupo = MODELOS_PRONTOS.filter((modelo) => modelo.grupo === grupo)
            if (doGrupo.length === 0) return null
            return (
              <div key={grupo} className="lb-ed__modelos-grupo" role="group" aria-labelledby={`${tituloId}-${grupo}`}>
                <p className="lb-ed__modelos-grupo-nome" id={`${tituloId}-${grupo}`}>
                  {nome}
                </p>
                <div className="lb-ed__modelos">
                  {doGrupo.map((modelo) => (
                    <button key={modelo.id} type="button" className="lb-ed__modelo" onClick={() => onEscolher(modelo.id)}>
                      <b>{modelo.nome}</b>
                      <span>{modelo.dica}</span>
                      <span className="lb-ed__modelo-linha">{linhas.get(modelo.id)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        <div className="lb-ed__modelos-pe">
          <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={onFechar}>
            Cancelar
          </button>
        </div>
      </div>
    </dialog>
  )
}
