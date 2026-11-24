import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { novoIdDeCaracteristica } from '../../lib/caracteristicas/companions'
import { NOME_PADRAO_DO_GRUPO, temCegueira, type Caracteristica } from '../../lib/caracteristicas/tipos'
import type { Personagem } from '../../lib/personagem'
import './caracteristicas.css'

/**
 * O bloco "Características especiais" da coluna da esquerda da ficha
 * (protótipo aprovado, estado 1): os chips e, só para o mestre, o
 * "+ Característica". Clicar num chip abre a página dele no lugar das abas
 * (quem desenha a página é `PaginaDaCaracteristica`); o jogador vê os chips.
 */

export interface CaracteristicasDaFichaProps {
  personagem: Personagem
  /** O id da característica aberta no lugar das abas; `null` = as abas. */
  aberta: string | null
  onAbrir: (id: string | null) => void
  /** Só o mestre: grava a lista nova na hora. Ausente = só lê (o jogador). */
  onMudar?: (lista: Caracteristica[]) => void
}

/** "Companion · Lovecats (3)": o número é quanto leva para a batalha (decisão 2 do NOTAS). */
export function rotuloDoChip(caracteristica: Caracteristica): string {
  return caracteristica.tipo === 'cegueira' ? 'Cegueira' : `Companion · ${caracteristica.nome}`
}

function nomeAcessivel(caracteristica: Caracteristica): string {
  if (caracteristica.tipo === 'cegueira') return 'Cegueira'
  const ligadas = caracteristica.ligados.length
  return `Companion ${caracteristica.nome}, leva até ${caracteristica.limite}, ${ligadas} ${ligadas === 1 ? 'ficha ligada' : 'fichas ligadas'}`
}

export function IconeDaCaracteristica({ tipo }: { tipo: Caracteristica['tipo'] }) {
  if (tipo === 'cegueira') {
    return (
      <svg className="lb-carac__icone" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="3" />
        <circle cx="12" cy="12" r="7" opacity="0.55" />
      </svg>
    )
  }
  return (
    <svg className="lb-carac__icone" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="9" cy="9" r="3" />
      <path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5" />
      <circle cx="17" cy="10" r="2.4" />
      <path d="M15.5 14.8c2.4-.3 4.3 1 5 3.7" />
    </svg>
  )
}

export function CaracteristicasDaFicha({ personagem, aberta, onAbrir, onMudar }: CaracteristicasDaFichaProps) {
  const tituloId = useId()
  const lista = personagem.caracteristicas ?? []
  if (lista.length === 0 && onMudar === undefined) return null
  return (
    <section className="lb-carac" aria-labelledby={tituloId}>
      <h3 className="lb-eyebrow lb-ficha__subtitulo" id={tituloId}>
        Características especiais
      </h3>
      <ul className="lb-carac__chips">
        {lista.map((caracteristica) => (
          <li key={caracteristica.id}>
            {onMudar === undefined ? (
              <span className="lb-carac__chip" title={nomeAcessivel(caracteristica)}>
                <IconeDaCaracteristica tipo={caracteristica.tipo} />
                {rotuloDoChip(caracteristica)}
                {caracteristica.tipo === 'companion' && <span className="lb-carac__conta">({caracteristica.limite})</span>}
              </span>
            ) : (
              <button
                type="button"
                className="lb-carac__chip"
                data-caracteristica={caracteristica.id}
                aria-pressed={aberta === caracteristica.id}
                aria-label={nomeAcessivel(caracteristica)}
                onClick={() => onAbrir(aberta === caracteristica.id ? null : caracteristica.id)}
              >
                <IconeDaCaracteristica tipo={caracteristica.tipo} />
                {rotuloDoChip(caracteristica)}
                {caracteristica.tipo === 'companion' && <span className="lb-carac__conta">({caracteristica.limite})</span>}
              </button>
            )}
          </li>
        ))}
        {onMudar !== undefined && (
          <li>
            <MaisCaracteristica personagem={personagem} onCriar={(nova) => {
              onMudar([...lista, nova])
              if (nova.tipo === 'companion') onAbrir(nova.id)
            }} />
          </li>
        )}
      </ul>
    </section>
  )
}

interface ItemDoMenu {
  tipo: Caracteristica['tipo']
  rotulo: string
  motivo: string | null
}

/** O "+ Característica" e o menu dele (setas, Home/End, Enter; Esc devolve o foco ao botão). */
function MaisCaracteristica({ personagem, onCriar }: { personagem: Personagem; onCriar: (nova: Caracteristica) => void }) {
  const [aberto, setAberto] = useState(false)
  const [peloTeclado, setPeloTeclado] = useState(false)
  const botaoRef = useRef<HTMLButtonElement>(null)
  const itensRef = useRef<(HTMLButtonElement | null)[]>([])
  const menuId = useId()
  const itens: ItemDoMenu[] = [
    { tipo: 'companion', rotulo: 'Companion', motivo: null },
    { tipo: 'cegueira', rotulo: 'Cegueira', motivo: temCegueira(personagem.caracteristicas) ? `${personagem.nome} já tem Cegueira.` : null },
  ]

  function abrir(teclado: boolean) {
    setPeloTeclado(teclado)
    setAberto(true)
    // O foco vai ao primeiro item depois do desenho do menu.
    requestAnimationFrame(() => itensRef.current[0]?.focus())
  }

  function fechar(devolverFoco: boolean) {
    setAberto(false)
    if (devolverFoco) botaoRef.current?.focus()
  }

  function escolher(item: ItemDoMenu) {
    if (item.motivo !== null) return
    fechar(true)
    onCriar(item.tipo === 'cegueira' ? { tipo: 'cegueira', id: novoIdDeCaracteristica() } : { tipo: 'companion', id: novoIdDeCaracteristica(), nome: NOME_PADRAO_DO_GRUPO, limite: 1, ligados: [] })
  }

  function aoTeclarNoMenu(event: KeyboardEvent<HTMLDivElement>) {
    const atual = itensRef.current.findIndex((item) => item === document.activeElement)
    const ir = (indice: number) => {
      event.preventDefault()
      itensRef.current[(indice + itens.length) % itens.length]?.focus()
    }
    if (event.key === 'ArrowDown') ir(atual + 1)
    else if (event.key === 'ArrowUp') ir(atual - 1)
    else if (event.key === 'Home') ir(0)
    else if (event.key === 'End') ir(itens.length - 1)
    else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      fechar(true)
    } else if (event.key === 'Tab') fechar(false)
  }

  return (
    <div className="lb-carac__mais">
      <button
        ref={botaoRef}
        type="button"
        className="lb-carac__chip lb-carac__chip--novo"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? menuId : undefined}
        onClick={(event) => (aberto ? fechar(false) : abrir(event.detail === 0))}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            abrir(true)
          }
        }}
      >
        <span aria-hidden="true">+</span> Característica
      </button>
      {aberto && (
        <div
          className="lb-carac__menu"
          data-teclado={peloTeclado ? 'sim' : undefined}
          role="menu"
          id={menuId}
          aria-label="Nova característica"
          onKeyDown={aoTeclarNoMenu}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setAberto(false)
          }}
        >
          {itens.map((item, indice) => (
            <button
              key={item.tipo}
              ref={(elemento) => {
                itensRef.current[indice] = elemento
              }}
              type="button"
              role="menuitem"
              className="lb-carac__item"
              aria-disabled={item.motivo !== null}
              onClick={() => escolher(item)}
            >
              <IconeDaCaracteristica tipo={item.tipo} />
              <span>
                {item.rotulo}
                {item.motivo !== null && <span className="lb-carac__motivo">{item.motivo}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
