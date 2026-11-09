import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { semAcento } from '../../lib/preparo/enciclopedia'

/**
 * ÁRVORE (lugar dentro de lugar, página dentro de página), com o teclado das
 * árvores de arquivos: setas sobem e descem; direita abre e depois entra no
 * filho; esquerda fecha e depois volta ao pai; Home e End vão às pontas;
 * Enter abre; digitar a inicial salta para o item. A seta de abrir não abre o
 * verbete, só mostra os filhos.
 */

export interface ItemDaArvore {
  readonly id: string
  readonly rotulo: string
  readonly filhos: readonly ItemDaArvore[]
}

interface Linha {
  readonly item: ItemDaArvore
  readonly nivel: number
  readonly paiId: string | null
  readonly posicao: number
  readonly irmas: number
}

interface ArvoreProps {
  itens: readonly ItemDaArvore[]
  rotulo: string
  /** O que está aberto na tela: fica marcado, e os pais dele se abrem. */
  selecionado: string | null
  aoAbrir: (id: string) => void
  classe?: string
}

function linhasVisiveis(itens: readonly ItemDaArvore[], abertos: ReadonlySet<string>): Linha[] {
  const saida: Linha[] = []
  const andar = (lista: readonly ItemDaArvore[], nivel: number, paiId: string | null) => {
    lista.forEach((item, indice) => {
      saida.push({ item, nivel, paiId, posicao: indice + 1, irmas: lista.length })
      if (item.filhos.length > 0 && abertos.has(item.id)) andar(item.filhos, nivel + 1, item.id)
    })
  }
  andar(itens, 1, null)
  return saida
}

/** Filho → pai, para abrir o caminho até o selecionado. */
function paisDe(itens: readonly ItemDaArvore[]): Map<string, string> {
  const pais = new Map<string, string>()
  const andar = (lista: readonly ItemDaArvore[], paiId: string | null) => {
    for (const item of lista) {
      if (paiId !== null) pais.set(item.id, paiId)
      andar(item.filhos, item.id)
    }
  }
  andar(itens, null)
  return pais
}

const SETA = (
  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path d="m6 4 4 4-4 4" />
  </svg>
)

export function Arvore({ itens, rotulo, selecionado, aoAbrir, classe }: ArvoreProps) {
  const pais = useMemo(() => paisDe(itens), [itens])
  const [abertos, setAbertos] = useState<ReadonlySet<string>>(() => new Set())
  const [foco, setFoco] = useState<string | null>(null)
  const raiz = useRef<HTMLDivElement>(null)

  // O selecionado (vindo da busca, de uma @menção) aparece: os pais dele se abrem.
  useEffect(() => {
    if (selecionado === null) return
    const caminho: string[] = []
    let atual = pais.get(selecionado)
    while (atual !== undefined && !caminho.includes(atual)) {
      caminho.push(atual)
      atual = pais.get(atual)
    }
    if (caminho.length === 0) return
    setAbertos((antes) => (caminho.every((id) => antes.has(id)) ? antes : new Set([...antes, ...caminho])))
  }, [selecionado, pais])

  const linhas = useMemo(() => linhasVisiveis(itens, abertos), [itens, abertos])
  const focado = linhas.find((linha) => linha.item.id === foco) ?? linhas.find((linha) => linha.item.id === selecionado) ?? linhas[0]

  // O foco vai para a linha depois que ela existe (a filha só aparece quando o pai abre), sem esperar o próximo quadro.
  const pedirFoco = useRef(false)
  const focar = (id: string) => {
    pedirFoco.current = true
    setFoco(id)
  }
  useLayoutEffect(() => {
    if (!pedirFoco.current || foco === null) return
    pedirFoco.current = false
    raiz.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(foco)}"]`)?.focus()
  }, [foco, linhas])

  const alternar = (id: string, abrir?: boolean) => {
    setAbertos((antes) => {
      const depois = new Set(antes)
      if (abrir ?? !antes.has(id)) depois.add(id)
      else depois.delete(id)
      return depois
    })
  }

  const aoTeclar = (evento: KeyboardEvent<HTMLDivElement>, linha: Linha) => {
    const indice = linhas.indexOf(linha)
    const temFilhos = linha.item.filhos.length > 0
    const aberto = abertos.has(linha.item.id)
    const ir = (alvo: Linha | undefined) => {
      if (alvo !== undefined) focar(alvo.item.id)
    }
    switch (evento.key) {
      case 'ArrowDown':
        ir(linhas[indice + 1])
        break
      case 'ArrowUp':
        ir(linhas[indice - 1])
        break
      case 'Home':
        ir(linhas[0])
        break
      case 'End':
        ir(linhas[linhas.length - 1])
        break
      case 'ArrowRight':
        if (temFilhos && !aberto) alternar(linha.item.id, true)
        else if (temFilhos) ir(linhas[indice + 1])
        break
      case 'ArrowLeft':
        if (temFilhos && aberto) alternar(linha.item.id, false)
        else if (linha.paiId !== null) focar(linha.paiId)
        break
      case 'Enter':
      case ' ':
        aoAbrir(linha.item.id)
        break
      default: {
        if (evento.key.length !== 1 || evento.ctrlKey || evento.altKey || evento.metaKey) return
        const letra = semAcento(evento.key)
        const depois = [...linhas.slice(indice + 1), ...linhas.slice(0, indice + 1)]
        ir(depois.find((outra) => semAcento(outra.item.rotulo).startsWith(letra)))
        break
      }
    }
    evento.preventDefault()
  }

  return (
    <div ref={raiz} role="tree" aria-label={rotulo} className={`pr-arvore ${classe ?? ''}`}>
      {linhas.map((linha) => {
        const { item } = linha
        const temFilhos = item.filhos.length > 0
        const aberto = abertos.has(item.id)
        return (
          <div
            key={item.id}
            data-id={item.id}
            role="treeitem"
            aria-level={linha.nivel}
            aria-posinset={linha.posicao}
            aria-setsize={linha.irmas}
            aria-expanded={temFilhos ? aberto : undefined}
            aria-selected={item.id === selecionado}
            tabIndex={item.id === focado?.item.id ? 0 : -1}
            className="pr-arvore__linha"
            style={{ paddingInlineStart: `calc(${linha.nivel - 1} * var(--pr-recuo))` }}
            onClick={() => {
              setFoco(item.id)
              aoAbrir(item.id)
            }}
            onKeyDown={(evento) => aoTeclar(evento, linha)}
          >
            {temFilhos ? (
              // Só para o ponteiro: no teclado, as setas abrem e fecham.
              <span
                className="pr-arvore__seta"
                data-aberta={aberto}
                aria-hidden="true"
                onClick={(evento) => {
                  evento.stopPropagation()
                  alternar(item.id)
                }}
              >
                {SETA}
              </span>
            ) : (
              <span className="pr-arvore__seta pr-arvore__seta--vazia" aria-hidden="true" />
            )}
            <span className="pr-arvore__rotulo">{item.rotulo}</span>
          </div>
        )
      })}
    </div>
  )
}
