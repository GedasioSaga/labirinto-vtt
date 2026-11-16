import { useEffect, useRef } from 'react'
import type { Prop } from '../../types/map'
import { conteudoDe, mobiliaDoConteudo, NOME_DO_OBJETO, resumoDoConteudo } from '../../lib/conteudoDoObjeto'
import { selectionOfItem } from '../../lib/selectionModel'
import { useAdventureStore } from '../../stores/adventureStore'
import { useDesafiosStore } from '../../stores/desafiosStore'
import { useLivroDoMestreStore } from '../../stores/livroDoMestreStore'
import { useMapStore } from '../../stores/mapStore'

/*
 * BAÚS, CAIXAS E BARRIS na página Jogos (15/11/2026, protótipo do mestre,
 * tela 3): o que acabou de ser aberto, ao vivo (quem abriu, o que levou e a
 * armadilha), e os objetos da cena que se abrem, com o resumo do conteúdo. O
 * toque num deles seleciona o objeto e abre a ficha dele (a seção Conteúdo).
 */

function hora(em: number): string {
  const data = new Date(em)
  return `${String(data.getHours()).padStart(2, '0')}h${String(data.getMinutes()).padStart(2, '0')}`
}

/** Seleciona o objeto no editor, leva a câmera até ele e abre a ficha (onde mora o Conteúdo). */
function abrirFichaDoObjeto(prop: Prop): void {
  const store = useMapStore.getState()
  const piso = prop.piso ?? 0
  if (piso !== store.pisoAtivo) store.setPisoAtivo(piso)
  store.setSelection(selectionOfItem({ kind: 'prop', id: prop.id }))
  useAdventureStore.getState().goToPoint(null, { x: prop.x + prop.width / 2, y: prop.y + prop.height / 2 })
  useLivroDoMestreStore.getState().abrirPagina('ficha')
}

export function ObjetosQueAbrem({ props }: { props: readonly Prop[] }) {
  const aoVivo = useDesafiosStore((estado) => estado.aoVivo)
  const destacado = useDesafiosStore((estado) => estado.destacado)
  const linhaDestacada = useRef<HTMLLIElement>(null)
  const objetos = props.filter((prop) => mobiliaDoConteudo(prop) !== null)

  // O "Ver" do aviso: a linha da abertura entra na tela; o destaque some depois de lido.
  useEffect(() => {
    if (destacado === null) return
    linhaDestacada.current?.scrollIntoView({ block: 'nearest' })
    const prazo = window.setTimeout(() => useDesafiosStore.getState().destacar(null), 4000)
    return () => window.clearTimeout(prazo)
  }, [destacado])

  return (
    <>
      <h3 className="mg-secao">
        Baús, caixas e barris <small>{objetos.length}</small>
      </h3>
      {aoVivo.length > 0 && (
        <ul className="mg-vivo" aria-label="Abertos agora">
          {aoVivo.map((registro) => {
            const destaque = registro.propId === destacado && registro === aoVivo.find((r) => r.propId === destacado)
            return (
              <li key={`${registro.propId}:${registro.em}`} ref={destaque ? linhaDestacada : undefined} className={destaque ? 'mg-abertura mg-abertura--destaque' : 'mg-abertura'}>
                <p className="mg-abertura__titulo">
                  <b>{registro.titulo}</b> <small>{hora(registro.em)}</small>
                </p>
                <p className="mg-abertura__linha">{registro.levou}</p>
                <p className={registro.armadilha === 'Sem armadilha.' ? 'mg-abertura__linha' : 'mg-abertura__linha mg-abertura__linha--perigo'}>{registro.armadilha}</p>
                {registro.avisos.map((aviso) => (
                  <p key={aviso} className="mg-abertura__linha mg-abertura__linha--aviso">
                    {aviso}
                  </p>
                ))}
              </li>
            )
          })}
        </ul>
      )}
      {objetos.length === 0 ? (
        <p className="mg-vazio">Nenhum baú, caixa ou barril nesta cena. Ponha um pelo catálogo de objetos e escolha o que ele guarda na ficha dele.</p>
      ) : (
        <ul className="mg-lista">
          {objetos.map((prop) => {
            const tipo = mobiliaDoConteudo(prop)
            const conteudo = conteudoDe(prop)
            if (tipo === null || conteudo === null) return null
            const nome = prop.playerLabel?.trim() || NOME_DO_OBJETO[tipo]
            return (
              <li key={prop.id}>
                <button type="button" className="mg-linha" onClick={() => abrirFichaDoObjeto(prop)}>
                  <span className="mg-linha__nome">{nome}</span>
                  <span className="mg-linha__onde">{resumoDoConteudo(conteudo)}</span>
                  {conteudo.aberto !== undefined && (
                    <span className="mg-linha__tags">
                      <span className="mg-tag mg-tag--feito">{tipo === 'bau' ? 'Aberto' : 'Quebrado'}</span>
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
