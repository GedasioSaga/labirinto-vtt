import { useRef, type KeyboardEvent } from 'react'
import { CollapsibleSection } from './CollapsibleSection'
import { MARCAS_POR_CENA, RUMO_NOME } from '../lib/marcas'
import type { MarcaNoLugar } from '../types/map'

export interface MarcasDaCenaProps {
  /** As marcas da cena aberta (`map.marcas`), na ordem em que chegaram. */
  marcas: readonly MarcaNoLugar[]
  /** "Apagar" de uma linha: tira a marca da cena aberta, fora do Ctrl+Z do mestre. */
  onApagar: (markId: string) => void
}

/** O que a linha diz da marca: o recado inteiro do bilhete, ou para onde a seta aponta. */
export function descreverMarca(marca: MarcaNoLugar): string {
  if (marca.tipo === 'bilhete') return `“${marca.texto ?? ''}”`
  return marca.rumo === undefined ? 'Seta de giz' : `Seta de giz para o ${RUMO_NOME[marca.rumo]}`
}

function autoria(marca: MarcaNoLugar): string {
  return marca.autor === undefined ? 'autor desconhecido' : `de ${marca.autor}`
}

function contagem(n: number): string {
  return n === 1 ? '1 marca nesta cena' : `${n} marcas nesta cena`
}

/**
 * BILHETE NO LUGAR, lado do mestre: as marcas que os jogadores deixaram na
 * cena aberta, para reler e apagar a qualquer hora — o aviso de quando a marca
 * chega some em 12 s, e sem esta lista um bilhete ofensivo ficava para sempre
 * e o jogador que bateu o teto não tinha saída ("Peça ao mestre para apagar").
 *
 * Sem marca na cena, a seção não aparece: nada a fazer, nada a mostrar. A mais
 * nova vem primeiro — é a que o mestre acabou de ver chegar.
 */
export function MarcasDaCena({ marcas, onApagar }: MarcasDaCenaProps) {
  const listRef = useRef<HTMLUListElement | null>(null)
  if (marcas.length === 0) return null
  const recentes = [...marcas].reverse()

  const botoes = (): HTMLButtonElement[] => [...(listRef.current?.querySelectorAll<HTMLButtonElement>('button[data-marca]') ?? [])]

  /** A linha some ao apagar: o foco passa para a vizinha de baixo (ou a de cima), não cai no nada. */
  const apagar = (markId: string) => {
    const lista = botoes()
    const i = lista.findIndex((b) => b.dataset.marca === markId)
    const vizinha = i < 0 ? undefined : (lista[i + 1] ?? lista[i - 1])
    onApagar(markId)
    // A vizinha continua no DOM depois do render (a `key` é o id da marca): o foco pode ir já.
    vizinha?.focus()
  }

  /** Delete no botão da linha: apaga só ESTA marca, e a tecla não segue para o mapa (lá ela apaga a seleção). */
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, markId: string) => {
    if (event.key !== 'Delete') return
    event.preventDefault()
    event.stopPropagation()
    apagar(markId)
  }

  return (
    <CollapsibleSection id="marcas" title="Marcas dos jogadores" defaultOpen>
      <div className="lb-marcas">
        <p className="lb-marcas__resumo">
          {contagem(marcas.length)} (cabem {MARCAS_POR_CENA}). Apagar uma libera espaço para quem a deixou.
        </p>
        <ul ref={listRef} className="lb-marcas__lista">
          {recentes.map((marca) => {
            const texto = descreverMarca(marca)
            const quem = autoria(marca)
            return (
              <li key={marca.id} className="lb-marcas__item">
                <span className="lb-marcas__texto">
                  <span className="lb-marcas__recado">{texto}</span>{' '}
                  <span className="lb-marcas__autor">{quem}</span>
                </span>
                <button
                  type="button"
                  className="lb-btn lb-btn--ghost lb-marcas__apagar"
                  data-marca={marca.id}
                  aria-label={`Apagar ${marca.tipo === 'bilhete' ? 'bilhete' : 'seta'} ${quem}: ${texto}`}
                  onClick={() => apagar(marca.id)}
                  onKeyDown={(event) => onKeyDown(event, marca.id)}
                >
                  Apagar
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </CollapsibleSection>
  )
}
