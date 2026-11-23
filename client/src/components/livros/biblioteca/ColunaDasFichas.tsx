import type { DragEvent } from 'react'
import type { GrupoDeFichas } from '../../../lib/livros/gruposDaBiblioteca'
import type { Personagem } from '../../../lib/personagem'
import { formatarNumero, Retrato } from '../comum'
import { IconeDaBiblioteca } from './IconeDaBiblioteca'

/**
 * A COLUNA FICHAS (protótipo `.rail`): ao mesmo tempo o filtro "quem tem"
 * (Tudo, Em alguma ficha, Só no livro, ou uma ficha) e o alvo do arrasto
 * (soltar uma linha num nome dá a coisa a ele; durante a pausa o nome acende
 * e diz o que vai acontecer).
 */

/** O filtro da coluna: as três vistas gerais ou o id de uma ficha. */
export type OndeNaBiblioteca = 'todas' | 'fichas' | 'livro' | string

/** O que soltar a linha arrastada nesta ficha faz: dá, ou o porquê de não dar. */
export interface AlvoDoArrasto {
  pode: boolean
  frase: string
}

interface ColunaDasFichasProps {
  grupos: readonly GrupoDeFichas[]
  onde: OndeNaBiblioteca
  contagem: { todas: number; fichas: number; livro: number }
  quantasDaFicha: (ficha: Personagem) => number
  /** Há uma linha sendo arrastada: as fichas viram alvo. */
  arrastando: boolean
  /** A ficha sob o arrasto agora e o que soltar nela faz. */
  sobre: { fichaId: string; alvo: AlvoDoArrasto } | null
  /** A ficha que acabou de receber (o brilho de latão de 1,6 s). */
  recebeu: string | null
  onOnde: (onde: OndeNaBiblioteca) => void
  onPassar: (event: DragEvent<HTMLElement>, ficha: Personagem) => void
  onSair: (event: DragEvent<HTMLElement>) => void
  onSoltar: (event: DragEvent<HTMLElement>, ficha: Personagem) => void
}

export function ColunaDasFichas({ grupos, onde, contagem, quantasDaFicha, arrastando, sobre, recebeu, onOnde, onPassar, onSair, onSoltar }: ColunaDasFichasProps) {
  const geral = (valor: OndeNaBiblioteca, nome: string, icone: 'todas' | 'pessoas' | 'livro', n: number) => (
    <button type="button" className="mu-bib-ficha" aria-pressed={onde === valor} onClick={() => onOnde(valor)}>
      <span className="mu-bib-ficha__simb">
        <IconeDaBiblioteca nome={icone} />
      </span>
      <span className="mu-bib-ficha__nome">{nome}</span>
      <span className="mu-bib-ficha__n">{formatarNumero(n)}</span>
    </button>
  )
  return (
    <aside className="mu-bib-rail" aria-label="Fichas: filtrar por quem tem, ou soltar aqui para dar" data-arrastando={arrastando ? '' : undefined}>
      <h3 className="mu-bib-rail__tit">Fichas</h3>
      {geral('todas', 'Tudo', 'todas', contagem.todas)}
      {geral('fichas', 'Em alguma ficha', 'pessoas', contagem.fichas)}
      {geral('livro', 'Só no livro', 'livro', contagem.livro)}
      {grupos.map((grupo) => (
        <div key={grupo.rotulo} role="group" aria-label={grupo.rotulo} style={{ display: 'contents' }}>
          <p className="mu-bib-rail__sep">{grupo.rotulo}</p>
          {grupo.fichas.map((ficha) => {
            const alvo = sobre !== null && sobre.fichaId === ficha.id ? sobre.alvo : null
            return (
              <button
                key={ficha.id}
                type="button"
                className="mu-bib-ficha"
                data-ficha={ficha.id}
                aria-pressed={onde === ficha.id}
                data-alvo={alvo === null ? undefined : alvo.pode ? 'sim' : 'nao'}
                data-recebeu={recebeu === ficha.id ? '' : undefined}
                onClick={() => onOnde(ficha.id)}
                onDragEnter={(event) => onPassar(event, ficha)}
                onDragOver={(event) => onPassar(event, ficha)}
                onDragLeave={onSair}
                onDrop={(event) => onSoltar(event, ficha)}
              >
                <span className="mu-bib-av" aria-hidden="true">
                  <Retrato imagem={ficha.retrato} nome={ficha.nome} tamanho="p" />
                </span>
                <span className="mu-bib-ficha__nome" title={ficha.nome}>
                  {ficha.nome}
                </span>
                <span className="mu-bib-ficha__n">{formatarNumero(quantasDaFicha(ficha))}</span>
                {alvo !== null && (
                  <span className="mu-bib-ficha__dica" role="status">
                    {alvo.frase}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      ))}
      <p className="mu-bib-rail__nota">
        {grupos.length === 0 ? 'Nenhuma ficha nesta pasta ainda. Crie um jogador ou um NPC para dar coisas a ele.' : 'Clique num nome para ver o que ele tem. Arraste uma linha até um nome para dar a ele.'}
      </p>
    </aside>
  )
}
