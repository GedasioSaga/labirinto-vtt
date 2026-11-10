import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { normalizeForSearch } from '../lib/mapObjects'
import type { PlayerInfo } from '../net/hostSession'
import {
  medirLugar,
  mesmoLugar,
  NOME_VAZIO,
  palavrasDaBusca,
  Realce,
  RetratoDaFicha,
  useUltimo,
  type AberturaDaEscolha,
  type LugarDaEscolha,
} from './EscolherFichaDeTeste'
import { CursorIcon, EnterIcon, SearchIcon } from './icons'
import type { RoomPanelToken } from './RoomPanel'
import { MAPA_DO_EDITOR, PRAZO_DA_ESPERA_MS } from '../stores/destaqueNoMapa'
import './AtribuirToken.css'

/**
 * ATRIBUIR TOKEN — a lista que abre do campo "Atribuir token" no card do
 * jogador. É a mesma caixa da "Visão de jogador" (`EscolherFichaDeTeste`:
 * busca, retrato, teclado, presa ao botão), com o que esta escolha pede a mais:
 *
 * - grupos por cena: primeiro os tokens DESTA cena, depois os das outras, com
 *   o nome da cena no título;
 * - número quando o nome repete na cena ("Alce 1", "Alce 2"): quatro alces
 *   deixam de ser quatro linhas iguais;
 * - de quem o token é hoje, escrito na linha;
 * - a linha ativa (do ponteiro ou das setas) acende o token no mapa, e
 *   "Clicar no token no mapa" inverte o caminho: o mestre aponta o token.
 *
 * Teclado: o foco nasce na busca; ↑ ↓ andam, Home e End vão às pontas, Enter
 * atribui, Esc fecha e devolve o foco ao campo, Tab fecha e segue.
 */

const COLACAO = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })
const TECLAS_DA_LISTA: ReadonlySet<string> = new Set(['Escape', 'Tab', 'Enter', 'ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp'])
/** PageUp e PageDown andam quase uma lista visível. */
const PASSO_DE_PAGINA = 7

// ------------------------------------------------------------------ nomes

/** O nome do token como a comparação o enxerga: sem espaço nas pontas, sem acento, sem maiúscula. */
function chaveDoNome(nome: string): string {
  return normalizeForSearch(nome.trim())
}

/**
 * O nome de cada token na lista. Nome que repete NA MESMA CENA ganha número,
 * na ordem em que os tokens estão no mapa ("Alce 1", "Alce 2"). Sai da lista
 * inteira da cena, não só dos que este jogador pode receber: o "Alce 2" é o
 * mesmo token no card de qualquer jogador. O número pula o que já é nome de
 * outro token ("Alce", "Alce" e um "Alce 2" de verdade viram "Alce 1" e "Alce 3").
 */
export function nomesDeAtribuir(tokens: readonly RoomPanelToken[]): Map<string, string> {
  const porCena = new Map<string | undefined, RoomPanelToken[]>()
  for (const token of tokens) {
    const daCena = porCena.get(token.sceneName)
    if (daCena === undefined) porCena.set(token.sceneName, [token])
    else daCena.push(token)
  }
  const nomes = new Map<string, string>()
  for (const daCena of porCena.values()) {
    const vezes = new Map<string, number>()
    for (const token of daCena) vezes.set(chaveDoNome(token.name), (vezes.get(chaveDoNome(token.name)) ?? 0) + 1)
    const ultimoNumero = new Map<string, number>()
    for (const token of daCena) {
      const limpo = token.name.trim()
      const chave = chaveDoNome(token.name)
      if (limpo === '' || (vezes.get(chave) ?? 0) < 2) {
        nomes.set(token.id, limpo === '' ? NOME_VAZIO : limpo)
        continue
      }
      let numero = (ultimoNumero.get(chave) ?? 0) + 1
      while (vezes.has(chaveDoNome(`${limpo} ${numero}`))) numero += 1
      ultimoNumero.set(chave, numero)
      nomes.set(token.id, `${limpo} ${numero}`)
    }
  }
  return nomes
}

// ----------------------------------------------------------------- grupos

export interface LinhaDeAtribuir {
  token: RoomPanelToken
  /** O nome que a linha mostra, já com o número quando repete. */
  nome: string
  /** Quem joga com ele hoje; `null` = sem jogador. */
  dono: string | null
}

export interface GrupoDeAtribuir {
  /** Nome da cena; `null` = a cena aberta no editor ("Nesta cena"). */
  cena: string | null
  linhas: LinhaDeAtribuir[]
}

/** 0 = livre, 1 = NPC livre, 2 = de outro jogador: o que o mestre mais dá vem antes. */
function ordemDaLinha(linha: LinhaDeAtribuir): number {
  if (linha.dono !== null) return 2
  return linha.token.npc === true ? 1 : 0
}

/**
 * A lista em grupos: a cena aberta primeiro, depois cada cena de fundo na
 * ordem da aventura. Dentro do grupo, os livres, os NPCs e por último os de
 * outro jogador, cada parte em ordem de nome (os quatro alces ficam juntos).
 * Os tokens que o jogador já tem ficam de fora.
 */
export function gruposDeAtribuir(tokens: readonly RoomPanelToken[], player: Pick<PlayerInfo, 'tokenIds'>, owners: ReadonlyMap<string, string>): GrupoDeAtribuir[] {
  const nomes = nomesDeAtribuir(tokens)
  const grupos: GrupoDeAtribuir[] = []
  for (const token of tokens) {
    if (player.tokenIds.includes(token.id)) continue
    const cena = token.sceneName ?? null
    let grupo = grupos.find((candidato) => candidato.cena === cena)
    if (grupo === undefined) {
      grupo = { cena, linhas: [] }
      grupos.push(grupo)
    }
    grupo.linhas.push({ token, nome: nomes.get(token.id) ?? token.name, dono: owners.get(token.id) ?? null })
  }
  for (const grupo of grupos) grupo.linhas.sort((a, b) => ordemDaLinha(a) - ordemDaLinha(b) || COLACAO.compare(a.nome, b.nome))
  // A cena aberta é a que o mestre está vendo: vem primeiro mesmo se a lista chegar em outra ordem.
  return grupos.sort((a, b) => (a.cena === null ? 0 : 1) - (b.cena === null ? 0 : 1))
}

/** Cada palavra da busca precisa estar no nome do token, no do jogador, no da cena ou em "npc". */
export function linhaCasaComBusca(linha: LinhaDeAtribuir, cena: string | null, palavras: readonly string[]): boolean {
  if (palavras.length === 0) return true
  const onde = normalizeForSearch([linha.nome, linha.dono ?? '', cena ?? '', linha.token.npc === true ? 'npc' : ''].join(' '))
  return palavras.every((palavra) => onde.includes(palavra))
}

/** O contador da busca: "18 tokens" parada, "4 de 18" filtrando. */
export function contadorDeTokens(achados: number, total: number, buscando: boolean): string {
  if (buscando) return `${achados} de ${total}`
  return total === 1 ? '1 token' : `${total} tokens`
}

export const NESTA_CENA = 'Nesta cena'

/** O que o leitor de tela ouve na linha: nome, se é NPC, de quem é e onde está. */
function rotuloDaLinha(linha: LinhaDeAtribuir, cena: string | null): string {
  const partes = [linha.nome]
  if (linha.token.npc === true) partes.push('NPC')
  partes.push(linha.dono === null ? 'sem jogador' : `de ${linha.dono}`)
  if (cena !== null) partes.push(`na cena ${cena}`)
  return partes.join(', ')
}

// ------------------------------------------------------------- componente

export interface EscolherTokenParaAtribuirProps {
  grupos: readonly GrupoDeAtribuir[]
  /** Quem recebe: entra no nome da caixa ("Atribuir token a Gina"). */
  jogador: string
  /** O campo que abriu: a lista se prende a ele e devolve o foco a ele. */
  ancora: HTMLElement
  /** Pelo teclado a lista aparece parada; pelo ponteiro, cresce do campo em 120 ms. */
  abertura: AberturaDaEscolha
  /** `id` da caixa, para o `aria-controls` do campo. */
  id?: string
  onEscolher(tokenId: string): void
  /** A lista fechou (Esc, escolha, Tab, clique fora): quem abriu a desmonta. */
  onFechar(): void
  /** A linha ativa mudou: o id do token dela se ele está na cena aberta, senão `null`. */
  onAtiva?(tokenId: string | null): void
  /** "Clicar no token no mapa": a lista fecha e o próximo clique num token do mapa escolhe. Ausente = sem o botão. */
  onClicarNoMapa?(): void
}

interface LinhaNaLista extends LinhaDeAtribuir {
  cena: string | null
}

export function EscolherTokenParaAtribuir({ grupos, jogador, ancora, abertura, id, onEscolher, onFechar, onAtiva, onClicarNoMapa }: EscolherTokenParaAtribuirProps) {
  const [busca, setBusca] = useState('')
  const [ativaId, setAtivaId] = useState<string | null>(null)
  // Abrir a lista não mexe no mapa: o token só acende depois que o mestre anda, aponta ou busca.
  const [mexeu, setMexeu] = useState(false)
  const [lugar, setLugar] = useState<LugarDaEscolha>(() => medirLugar(ancora))
  const raizRef = useRef<HTMLDivElement>(null)
  const buscaRef = useRef<HTMLInputElement>(null)
  const listaRef = useRef<HTMLDivElement>(null)
  const rolarAteAtiva = useRef(false)
  const onFecharRef = useUltimo(onFechar)
  const onAtivaRef = useUltimo(onAtiva)
  const idProprio = useId()
  const raizId = id ?? idProprio
  const listaId = useId()

  const total = useMemo(() => grupos.reduce((soma, grupo) => soma + grupo.linhas.length, 0), [grupos])
  const palavras = useMemo(() => palavrasDaBusca(busca), [busca])
  const buscando = palavras.length > 0
  const achados = useMemo(
    () =>
      grupos
        .map((grupo) => ({ cena: grupo.cena, linhas: grupo.linhas.filter((linha) => linhaCasaComBusca(linha, grupo.cena, palavras)) }))
        .filter((grupo) => grupo.linhas.length > 0),
    [grupos, palavras],
  )
  // As setas andam pela lista inteira, atravessando os grupos.
  const linhas = useMemo<LinhaNaLista[]>(() => achados.flatMap((grupo) => grupo.linhas.map((linha) => ({ ...linha, cena: grupo.cena }))), [achados])
  // A ativa é lembrada pelo id: a lista muda ao vivo (um token entra no mapa) sem pular de linha.
  const ativa = linhas.find((linha) => linha.token.id === ativaId) ?? linhas[0]
  const indiceAtivo = ativa === undefined ? -1 : linhas.indexOf(ativa)
  const idDaLinha = (tokenId: string) => `${listaId}-${tokenId}`
  const idDaAtiva = ativa === undefined ? undefined : idDaLinha(ativa.token.id)
  // Só "Nesta cena" sozinha dispensa o título: ele separa as cenas e diz o nome da que não está aberta.
  const variasCenas = grupos.length > 1
  const temTokenNestaCena = grupos.some((grupo) => grupo.cena === null)

  // O foco nasce na busca.
  useLayoutEffect(() => {
    ;(buscaRef.current ?? raizRef.current)?.focus({ preventScroll: true })
  }, [])

  // A linha ativa acende no mapa; token de outra cena não está no mapa aberto.
  const tokenNoMapa = !mexeu || ativa === undefined || ativa.cena !== null ? null : ativa.token.id
  useEffect(() => {
    onAtivaRef.current?.(tokenNoMapa)
  }, [tokenNoMapa, onAtivaRef])

  // Presa ao campo: a janela muda de tamanho e o painel rola sem levar a lista para longe dele.
  useLayoutEffect(() => {
    const reposicionar = (evento?: Event): void => {
      // Rolar a própria lista não move o campo.
      if (evento?.target instanceof Node && raizRef.current?.contains(evento.target)) return
      const novo = medirLugar(ancora)
      setLugar((atual) => (mesmoLugar(atual, novo) ? atual : novo))
    }
    reposicionar()
    window.addEventListener('resize', reposicionar)
    window.addEventListener('scroll', reposicionar, true)
    return () => {
      window.removeEventListener('resize', reposicionar)
      window.removeEventListener('scroll', reposicionar, true)
    }
  }, [ancora])

  // O clique fora e o foco que sai fecham. O campo fica de fora: o clique nele alterna a lista.
  useEffect(() => {
    const fecharSeForFora = (evento: Event): void => {
      const alvo = evento.target
      if (!(alvo instanceof Node)) return
      if (raizRef.current?.contains(alvo) || ancora.contains(alvo)) return
      onFecharRef.current()
    }
    document.addEventListener('pointerdown', fecharSeForFora, true)
    document.addEventListener('focusin', fecharSeForFora)
    return () => {
      document.removeEventListener('pointerdown', fecharSeForFora, true)
      document.removeEventListener('focusin', fecharSeForFora)
    }
  }, [ancora, onFecharRef])

  // Pelo teclado a ativa nunca sai da vista; pelo ponteiro ela já está sob ele.
  useLayoutEffect(() => {
    if (!rolarAteAtiva.current || idDaAtiva === undefined) return
    rolarAteAtiva.current = false
    document.getElementById(idDaAtiva)?.scrollIntoView?.({ block: 'nearest' })
  }, [idDaAtiva])

  function escolher(linha: LinhaDeAtribuir): void {
    ancora.focus({ preventScroll: true })
    onEscolher(linha.token.id)
    onFechar()
  }

  function ativarIndice(indice: number): void {
    const linha = linhas[indice]
    if (linha === undefined) return
    rolarAteAtiva.current = true
    setMexeu(true)
    setAtivaId(linha.token.id)
  }

  function aoTeclar(evento: KeyboardEvent<HTMLDivElement>): void {
    const tecla = evento.key
    if (!TECLAS_DA_LISTA.has(tecla) || evento.nativeEvent.isComposing) return
    // Shift+Home/End selecionam o texto da busca: a tecla é do campo.
    if ((tecla === 'Home' || tecla === 'End') && evento.shiftKey) return
    // A tecla é desta lista: no editor, o Esc soltaria a seleção do mapa (que
    // é o destaque desta lista) e as setas empurrariam o token aceso.
    evento.stopPropagation()
    evento.nativeEvent.stopImmediatePropagation()
    if (tecla === 'Tab') {
      // Sem `preventDefault`: com o foco de volta no campo, o Tab do navegador segue dali.
      ancora.focus({ preventScroll: true })
      onFechar()
      return
    }
    evento.preventDefault()
    if (tecla === 'Escape') {
      ancora.focus({ preventScroll: true })
      onFechar()
      return
    }
    const quantas = linhas.length
    if (quantas === 0) return
    const atual = Math.max(0, indiceAtivo)
    switch (tecla) {
      case 'Enter':
        if (ativa !== undefined) escolher(ativa)
        return
      case 'ArrowDown':
        ativarIndice((atual + 1) % quantas)
        return
      case 'ArrowUp':
        ativarIndice((atual - 1 + quantas) % quantas)
        return
      case 'Home':
        ativarIndice(0)
        return
      case 'End':
        ativarIndice(quantas - 1)
        return
      case 'PageDown':
        ativarIndice(Math.min(quantas - 1, atual + PASSO_DE_PAGINA))
        return
      case 'PageUp':
        ativarIndice(Math.max(0, atual - PASSO_DE_PAGINA))
        return
    }
  }

  // Clicar no que não é campo (linha, título, rodapé) não tira o foco da busca: o teclado continua valendo.
  // A própria lista fica de fora: ali o aperto pode ser na barra de rolagem, que precisa do gesto inteiro.
  function manterFocoNaBusca(evento: MouseEvent<HTMLDivElement>): void {
    if (buscaRef.current === null || evento.target === buscaRef.current || evento.target === listaRef.current) return
    evento.preventDefault()
  }

  // O foco que caiu na caixa (aperto na barra de rolagem, no vão entre linhas) volta para a busca.
  function devolverFocoABusca(evento: FocusEvent<HTMLDivElement>): void {
    if (evento.target === raizRef.current) buscaRef.current?.focus({ preventScroll: true })
  }

  const estilo: CSSProperties = {
    left: lugar.esquerda,
    width: lugar.largura,
    top: lugar.topo ?? undefined,
    bottom: lugar.base ?? undefined,
    maxHeight: lugar.alturaMaxima,
    transformOrigin: lugar.origem,
  }

  return createPortal(
    <div
      ref={raizRef}
      id={raizId}
      className="vj-escolha lb-atribuir"
      role="dialog"
      aria-label={`Atribuir token a ${jogador}`}
      tabIndex={-1}
      data-abertura={abertura}
      data-lado={lugar.base === null ? 'abaixo' : 'acima'}
      style={estilo}
      onKeyDown={aoTeclar}
      onMouseDown={manterFocoNaBusca}
      onFocus={devolverFocoABusca}
    >
      <div className="vj-escolha__busca">
        <span className="vj-escolha__lupa">
          <SearchIcon size={16} />
        </span>
        <input
          ref={buscaRef}
          className="vj-escolha__campo"
          type="text"
          role="combobox"
          aria-label="Buscar token, jogador ou cena"
          aria-expanded="true"
          aria-controls={linhas.length > 0 ? listaId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={idDaAtiva}
          placeholder="Buscar token ou jogador"
          autoComplete="off"
          spellCheck={false}
          value={busca}
          onChange={(evento) => {
            setBusca(evento.target.value)
            setMexeu(true)
            // Outra busca, outra lista: volta para a primeira linha, no alto.
            setAtivaId(null)
            listaRef.current?.scrollTo?.({ top: 0 })
          }}
        />
        <span className="vj-escolha__contador" aria-live="polite">
          {contadorDeTokens(linhas.length, total, buscando)}
        </span>
      </div>
      {linhas.length === 0 ? (
        <div className="vj-escolha__vazio" role="status">
          <p className="vj-escolha__vazio-titulo">Nenhum token com “{busca.trim()}”.</p>
          <p className="vj-escolha__vazio-texto">Busque pelo nome do token, do jogador ou da cena.</p>
        </div>
      ) : (
        <div ref={listaRef} id={listaId} className="vj-escolha__lista lb-atribuir__lista" role="listbox" aria-label="Tokens">
          {achados.map((grupo) => {
            const titulo = grupo.cena ?? NESTA_CENA
            const tituloId = `${listaId}-cena-${grupo.cena ?? ''}`
            const comTitulos = variasCenas || grupo.cena !== null
            return (
              <div key={grupo.cena ?? ''} className="lb-atribuir__grupo" role="group" aria-labelledby={comTitulos ? tituloId : undefined}>
                {comTitulos && (
                  <div id={tituloId} className="lb-atribuir__cena">
                    <span className="lb-atribuir__cena-nome" title={titulo}>
                      {grupo.cena === null ? titulo : <Realce texto={titulo} palavras={palavras} />}
                    </span>
                    <span className="lb-atribuir__cena-conta">{grupo.linhas.length}</span>
                  </div>
                )}
                {grupo.linhas.map((linha) => {
                  const ehAtiva = linha.token.id === ativa?.token.id
                  return (
                    <div
                      key={linha.token.id}
                      id={idDaLinha(linha.token.id)}
                      role="option"
                      aria-selected={ehAtiva}
                      aria-label={rotuloDaLinha(linha, grupo.cena)}
                      className="vj-escolha__linha"
                      onPointerMove={() => {
                        if (!mexeu) setMexeu(true)
                        if (!ehAtiva) setAtivaId(linha.token.id)
                      }}
                      onClick={() => escolher(linha)}
                    >
                      <RetratoDaFicha ficha={{ nome: linha.nome, retrato: linha.token.retrato ?? null, cor: linha.token.cor ?? '' }} tamanho={28} />
                      <span className="vj-escolha__nomes">
                        <span className="vj-escolha__nome" title={linha.nome}>
                          <Realce texto={linha.nome} palavras={palavras} />
                        </span>
                        {linha.dono === null ? (
                          <span className="vj-escolha__dono vj-escolha__dono--sem">sem jogador</span>
                        ) : (
                          <span className="vj-escolha__dono" title={`de ${linha.dono}`}>
                            de <Realce texto={linha.dono} palavras={palavras} />
                          </span>
                        )}
                      </span>
                      {linha.token.npc === true && <span className="vj-escolha__selo vj-escolha__selo--janela">NPC</span>}
                      {/* O lugar do Enter existe em toda linha: a ativa não encolhe o nome ao acender. */}
                      <span className="vj-escolha__enter">
                        <EnterIcon size={14} />
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
      {onClicarNoMapa !== undefined && temTokenNestaCena && (
        // Fora da ordem do Tab (o Tab fecha a lista): é o caminho do ponteiro, e o do teclado é a própria lista.
        <button type="button" className="lb-atribuir__no-mapa" tabIndex={-1} onClick={onClicarNoMapa}>
          <CursorIcon size={14} />
          Clicar no token no mapa
        </button>
      )}
      <div className="vj-escolha__pe" aria-hidden="true">
        {linhas.length > 0 && (
          <>
            <span className="vj-escolha__dica">
              <kbd className="vj-escolha__tecla">↑</kbd>
              <kbd className="vj-escolha__tecla">↓</kbd>
              escolher
            </span>
            <span className="vj-escolha__dica">
              <kbd className="vj-escolha__tecla">Enter</kbd>
              atribuir
            </span>
          </>
        )}
        <span className="vj-escolha__dica">
          <kbd className="vj-escolha__tecla">Esc</kbd>
          fechar
        </span>
      </div>
    </div>,
    document.body,
  )
}

/**
 * O AVISO SOBRE O MAPA enquanto um card espera o clique num token: o card pode
 * estar longe do ponteiro ou rolado para fora da página, e o mestre precisa ver
 * no mapa que o próximo token clicado tem dono. A linha de baixo encolhe até o
 * prazo em que a espera desiste sozinha.
 *
 * Só para os olhos: o leitor de tela lê a faixa do próprio card, que tem o
 * Cancelar. Os cliques atravessam o aviso (o token embaixo dele continua clicável).
 */
export function AvisoDeCliqueNoMapa({ jogador }: { jogador: string }) {
  return createPortal(
    <div className="lb-atribuir__aviso" aria-hidden="true">
      <CursorIcon size={14} />
      <span className="lb-atribuir__aviso-texto">
        Clique no token de <b>{jogador}</b> no mapa
      </span>
      <span className="lb-atribuir__aviso-esc">· Esc cancela</span>
      <span className="lb-atribuir__aviso-prazo" style={{ animationDuration: `${PRAZO_DA_ESPERA_MS}ms` }} />
    </div>,
    document.querySelector(MAPA_DO_EDITOR) ?? document.body,
  )
}
