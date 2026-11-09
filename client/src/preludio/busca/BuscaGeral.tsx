import { useDeferredValue, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { buscar, ROTULO_DO_TIPO, type Achado } from '../../lib/preparo/enciclopedia'
import { entradasDaBusca, usePreludio } from '../estado/preludio'
import { lugarDoVerbete } from '../enciclopedia/ListaDeVerbetes'

/**
 * BUSCA DO PRELÚDIO (Ctrl+K): procura no nome, nos apelidos e no texto inteiro
 * de todos os verbetes e páginas, sem acento e sem caixa. Abre na hora, sem
 * animação (é atalho de teclado, de uso frequente); setas escolhem, Enter abre,
 * Esc fecha e devolve o foco a quem estava com ele.
 */

const ID_DA_LISTA = 'pr-busca-lista'

function Resultado({ achado }: { achado: Achado }) {
  return (
    <>
      <span className="pr-busca__linha">
        <span className="pr-busca__titulo">{achado.titulo || 'Sem nome'}</span>
        <span className="pr-busca__tipo">{ROTULO_DO_TIPO[achado.tipo].um}</span>
      </span>
      {achado.onde === 'apelido' && <span className="pr-busca__trecho">Também chamado de {achado.apelido}</span>}
      {achado.trecho !== undefined && (
        <span className="pr-busca__trecho">
          {achado.trecho.antes}
          <mark>{achado.trecho.achado}</mark>
          {achado.trecho.depois}
        </span>
      )}
    </>
  )
}

export function BuscaGeral({ aoFechar }: { aoFechar: () => void }) {
  const verbetes = usePreludio((estado) => estado.verbetes)
  const ir = usePreludio((estado) => estado.ir)
  const [consulta, setConsulta] = useState('')
  const adiada = useDeferredValue(consulta)
  const entradas = useMemo(() => entradasDaBusca(verbetes), [verbetes])
  const achados = useMemo(() => buscar(entradas, adiada), [entradas, adiada])
  const [ativo, setAtivo] = useState(0)
  const campo = useRef<HTMLInputElement>(null)
  const anterior = useRef<Element | null>(typeof document === 'undefined' ? null : document.activeElement)

  useEffect(() => {
    campo.current?.focus()
    const quemTinha = anterior.current
    return () => {
      if (quemTinha instanceof HTMLElement && quemTinha.isConnected) quemTinha.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => setAtivo(0), [adiada])

  useEffect(() => {
    document.getElementById(`pr-busca-${ativo}`)?.scrollIntoView({ block: 'nearest' })
  }, [ativo])

  const abrir = (achado: Achado | undefined) => {
    if (achado === undefined) return
    const verbete = verbetes.get(achado.id)
    aoFechar()
    if (verbete !== undefined) ir(lugarDoVerbete(verbete, verbetes))
  }

  const aoTeclar = (evento: KeyboardEvent<HTMLDivElement>) => {
    switch (evento.key) {
      case 'Escape':
        aoFechar()
        break
      case 'ArrowDown':
        setAtivo((atual) => (achados.length === 0 ? 0 : (atual + 1) % achados.length))
        break
      case 'ArrowUp':
        setAtivo((atual) => (achados.length === 0 ? 0 : (atual - 1 + achados.length) % achados.length))
        break
      case 'Enter':
        abrir(achados[ativo])
        break
      case 'Tab':
        // O foco fica no campo: a lista se escolhe pelas setas.
        break
      default:
        return
    }
    evento.preventDefault()
    evento.stopPropagation()
  }

  const vazia = adiada.trim() === ''
  return (
    // O fundo das caixas do kit, na versão parada: a busca abre pelo teclado e abre sem animação.
    <div className="gr-dlg-fundo gr-dlg-fundo--parado pr-busca-fundo" onMouseDown={(evento) => evento.target === evento.currentTarget && aoFechar()}>
      <div className="pr-busca" role="dialog" aria-modal="true" aria-label="Buscar no Prelúdio" onKeyDown={aoTeclar}>
        <div className="pr-busca__cabeca">
          <svg className="pr-busca__lupa" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <circle cx="8.5" cy="8.5" r="5.5" />
            <path d="m13 13 4 4" />
          </svg>
          <input
            ref={campo}
            className="pr-busca__campo"
            role="combobox"
            aria-expanded={achados.length > 0}
            aria-controls={ID_DA_LISTA}
            aria-activedescendant={achados.length > 0 ? `pr-busca-${ativo}` : undefined}
            aria-autocomplete="list"
            aria-label="Procurar no nome e no texto"
            placeholder="Procurar no nome e no texto…"
            value={consulta}
            onChange={(evento) => setConsulta(evento.target.value)}
          />
          <kbd className="gr-kbd">Esc</kbd>
        </div>
        {vazia ? (
          <p className="pr-busca__dica">Procura no nome, nos apelidos e no texto inteiro dos verbetes e das páginas. Acento e maiúscula não importam.</p>
        ) : achados.length === 0 ? (
          <p className="pr-busca__dica" role="status">
            Nada com "{adiada.trim()}". Tente uma palavra só ou outro nome.
          </p>
        ) : (
          <ul id={ID_DA_LISTA} className="pr-busca__lista" role="listbox" aria-label="Resultados">
            {achados.map((achado, indice) => (
              <li
                key={achado.id}
                id={`pr-busca-${indice}`}
                role="option"
                aria-selected={indice === ativo}
                className="pr-busca__item"
                onMouseMove={() => setAtivo(indice)}
                onClick={() => abrir(achado)}
              >
                <Resultado achado={achado} />
              </li>
            ))}
          </ul>
        )}
        <p className="pr-busca__rodape" aria-hidden="true">
          <span>
            <kbd className="gr-kbd">↑</kbd> <kbd className="gr-kbd">↓</kbd> escolhe
          </span>
          <span>
            <kbd className="gr-kbd">Enter</kbd> abre
          </span>
        </p>
      </div>
    </div>
  )
}
