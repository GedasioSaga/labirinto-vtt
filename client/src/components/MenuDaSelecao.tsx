import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { contextoDeCamadas } from '../lib/camadas/consulta'
import { camadaDosItens, motivoParaNaoMover, nomeDaCamada, refsDaSelecao } from '../lib/camadas/mover'
import { opcoesDoEnvio } from '../lib/enviarParaCena'
import { reordenarObjetos, type LadoDaPilha } from '../lib/mapFactory'
import { propBoundingBox } from '../lib/objectTransform'
import type { MapData, Prop } from '../types/map'
import { meioTermoLigado } from '../lib/estiloDoMapa'
import { ehMovelDoChao } from '../lib/mobilia'
import { aceitaTresQuartos, movelEmTresQuartos, tresQuartosAtivo } from '../lib/mobilia/vistaTresQuartos'
import { personagensAtivos, useAdventureStore } from '../stores/adventureStore'
import { enviarParaCena } from '../stores/enviarParaCena'
import { comFichaPropriaNasCopias } from '../stores/fichaPropriaDoToken'
import { desligarFichaDosTokens, ligarFichaAosTokens } from '../stores/ligarFichaNoToken'
import { useMapStore } from '../stores/mapStore'
import { ItensDaAparenciaDaFicha, type AparenciaAberta } from './ItensDaAparenciaDaFicha'
import { ItensRapidosDaFicha, type RapidoAberto } from './ItensRapidosDaFicha'
import { SubmenuDeCenas } from './SubmenuDeCenas'
import { SubmenuLigarFicha } from './SubmenuLigarFicha'
import type { ComSaidaFilho } from './grimorio/ComSaida'
import './MenuDaSelecao.css'

export interface MenuDaSelecaoProps {
  /** Ponto do clique direito, em px da caixa do canvas (a âncora do menu). */
  x: number
  y: number
  onClose: () => void
}

/** Folga entre o menu e a borda do canvas quando o clique foi rente a ela. */
const FOLGA_DA_BORDA = 8

/** O móvel comum em 3/4 vai pela base entre os que estão em 3/4 (`emOrdemDasVistas`): a pilha da lista não manda nele. */
const MOTIVO_DA_PILHA_NA_3_4 = 'Na vista 3/4, o objeto mais ao sul fica por cima.'

/** As caixas de dois objetos se cruzam (sem giro: basta para dizer "um está sobre o outro"). */
function caixasSeCruzam(a: Prop, b: Prop): boolean {
  const ca = propBoundingBox(a)
  const cb = propBoundingBox(b)
  return ca.minX < cb.maxX && cb.minX < ca.maxX && ca.minY < cb.maxY && cb.minY < ca.maxY
}

/**
 * Caça 12/11 (E12, decisão 16): "Pôr por cima / por baixo" só troca a ordem
 * DENTRO da camada. Quando nada mudaria e o objeto está sobre um de OUTRA
 * camada, o menu diz por quê e o que fazer. `null` = o comando faz efeito, ou
 * não há com quem trocar.
 */
function motivoDaOutraCamada(map: MapData, objetos: readonly string[]): string | null {
  if (objetos.length === 0) return null
  if (reordenarObjetos(map, objetos, 'cima') !== map || reordenarObjetos(map, objetos, 'baixo') !== map) return null
  const camadas = contextoDeCamadas(map)
  const escolhidos = map.props.filter((p) => objetos.includes(p.id))
  for (const objeto of escolhidos) {
    const camada = camadas.camadaDe('objeto', objeto)
    if (map.props.some((outro) => !objetos.includes(outro.id) && camadas.camadaDe('objeto', outro) !== camada && caixasSeCruzam(objeto, outro))) {
      return `Este objeto está na camada ${nomeDaCamada(map, camada)}: para passar por cima, mova de camada.`
    }
  }
  return null
}

/** Foca o item `indice` (com volta), pulando os desligados. */
function focarItem(itens: readonly HTMLButtonElement[], indice: number, passo: 1 | -1): void {
  if (itens.length === 0) return
  for (let i = 0; i < itens.length; i += 1) {
    const alvo = itens[(((indice + i * passo) % itens.length) + itens.length) % itens.length]
    if (!alvo.disabled) {
      alvo.focus()
      return
    }
  }
}

/**
 * Clique direito em cima do que está selecionado (fase 3, fatia 8): "Mover
 * para camada ›" com as 13 padrão e as livres, na ordem do painel, a atual
 * marcada. Vale para a seleção inteira (vários itens = um passo do Ctrl+Z).
 *
 * Mesmo molde do menu da porta (`DoorContextMenu`): o foco entra no item,
 * setas andam pulando o desligado, Esc fecha e devolve o foco, clique fora
 * fecha. Seta para a direita, Enter ou o ponteiro abrem o submenu; seta para
 * a esquerda e Esc fecham só ele. Camada travada aparece desligada no lugar
 * dela ("não recebe"); seleção presa (cadeado) desliga o item e diz por quê.
 *
 * Com ficha na seleção, embaixo: "Enviar para cena ›" com as outras cenas do
 * mapa (`SubmenuDeCenas`). As fichas selecionadas vão juntas para o pino de
 * chegada de lá, num passo do Ctrl+Z (`stores/enviarParaCena.ts`); o resto da
 * seleção fica. Mapa de uma cena só: o item aparece desligado, com o porquê.
 * Setas para cima e para baixo andam entre os itens.
 *
 * LIGAR FICHA (pedido de 09/11/2026): com ficha na seleção, "Ligar ficha ›"
 * (busca e a lista dos Personagens; cada token com a própria vida,
 * `stores/ligarFichaNoToken.ts`) e "Desligar ficha". Vale para todos os
 * tokens selecionados, num passo do Ctrl+Z.
 *
 * PÔR POR CIMA / POR BAIXO (pedido de 12/11/2026): com objeto na seleção, os
 * objetos vão ao topo ou ao fundo da pilha da faixa deles (o chão entre o
 * chão, `mapFactory.reordenarObjetos`), num passo do Ctrl+Z. O móvel comum em
 * 3/4 vai pela base: com um deles na seleção, o item aparece desligado, com o
 * porquê.
 *
 * VISTA 3/4 (pedido de 15/11/2026): com móvel na seleção e o Meio-Termo
 * ligado, "Vista 3/4" põe em 3/4 (ou de volta de cima, se todos já estão) os
 * móveis selecionados em que a vista muda o desenho, num passo do Ctrl+Z; os
 * outros objetos do mapa não mudam.
 *
 * MUDAR FICHA e AURA (pedido de 14/11/2026): com UM token só na seleção, no
 * fim do menu, "Mudar ficha ›" e "Aura ›" com as miniaturas ao lado
 * (`ItensDaAparenciaDaFicha`).
 *
 * VIDA (pedido de 25/11/2026): com ficha na seleção, no TOPO (o mais usado,
 * com o foco ao abrir), "Vida ›" com o número de agora e o painel de Tirar e
 * Dar para todas as fichas selecionadas (`ItensRapidosDaFicha`); embaixo,
 * "Abrir ficha" (sem ficha ligada, desligado com o porquê) e "Enviar para
 * perto de ›" (as fichas selecionadas vão para as casas livres em volta de um
 * jogador ou NPC do mapa, no piso dele, num passo do Ctrl+Z).
 */
export function MenuDaSelecao({ x, y, onClose, saindo = false }: MenuDaSelecaoProps & ComSaidaFilho) {
  const map = useMapStore((state) => state.map)
  const selection = useMapStore((state) => state.selection)
  const pinoId = useMapStore((state) => state.selectedPinId)
  const [refs] = useState(() => refsDaSelecao(selection, pinoId))
  const [fichas] = useState(() => selection.filter((item) => item.kind === 'token').map((item) => item.id))
  const [objetos] = useState(() => selection.filter((item) => item.kind === 'prop').map((item) => item.id))
  const duplicarRef = useRef<HTMLButtonElement | null>(null)
  const porCimaRef = useRef<HTMLButtonElement | null>(null)
  const porBaixoRef = useRef<HTMLButtonElement | null>(null)
  const tresQuartosRef = useRef<HTMLButtonElement | null>(null)
  const [submenuAberto, setSubmenuAberto] = useState(false)
  // "Enviar para cena ›" aberto; `focar` = abriu pelo teclado.
  const [cenasAbertas, setCenasAbertas] = useState<{ focar: boolean } | null>(null)
  // "Ligar ficha ›" aberto; `focar` = abriu pelo teclado.
  const [fichasAbertas, setFichasAbertas] = useState<{ focar: boolean } | null>(null)
  const personagens = useAdventureStore(personagensAtivos)
  const fichaRef = useRef<HTMLButtonElement | null>(null)
  const desligarRef = useRef<HTMLButtonElement | null>(null)
  // "Mudar ficha ›" ou "Aura ›" aberto (um token só na seleção).
  const [aparenciaAberta, setAparenciaAberta] = useState<AparenciaAberta | null>(null)
  const formaRef = useRef<HTMLButtonElement | null>(null)
  const auraRef = useRef<HTMLButtonElement | null>(null)
  // "Vida ›" no topo (pedido de 25/11/2026), com ficha na seleção.
  const [rapidoAberto, setRapidoAberto] = useState<RapidoAberto | null>(null)
  const vidaRef = useRef<HTMLButtonElement | null>(null)
  const condicoesRef = useRef<HTMLButtonElement | null>(null)
  const abrirFichaRef = useRef<HTMLButtonElement | null>(null)
  const pertoRef = useRef<HTMLButtonElement | null>(null)
  const adventure = useAdventureStore((state) => state.adventure)
  const cenaAberta = useAdventureStore((state) => state.activeSceneId)
  const situacao = useAdventureStore((state) => state.cache)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const itemRef = useRef<HTMLButtonElement | null>(null)
  const cenaRef = useRef<HTMLButtonElement | null>(null)
  const submenuRef = useRef<HTMLDivElement | null>(null)
  const focoAntes = useRef<Element | null>(document.activeElement)
  const atual = camadaDosItens(map, refs)
  const motivo = motivoParaNaoMover(map, refs)

  // Caça 12/11 (E18): menu cujo único item ("Mover para camada") está desligado não abre:
  // sala, chão e texto não oferecem nada no botão direito, e a ficha já diz o porquê.
  const soItemDesligado = motivo !== null && objetos.length === 0 && fichas.length === 0

  // A seleção sumiu por baixo do menu (Ctrl+Z, outra ação): não há o que mover.
  useEffect(() => {
    if ((atual === null || soItemDesligado) && !saindo) onClose()
  }, [atual, soItemDesligado, onClose, saindo])

  useEffect(() => {
    // Com ficha na seleção, o primeiro item é a "Vida ›" (o mais usado).
    if (!saindo) (vidaRef.current ?? itemRef.current)?.focus()
  }, [saindo])

  // Clique rente à borda: o menu recua para caber no canvas.
  useLayoutEffect(() => {
    const menu = menuRef.current
    const caixa = menu?.offsetParent
    if (!menu || !(caixa instanceof HTMLElement) || caixa.clientWidth === 0) return
    menu.style.left = `${Math.max(FOLGA_DA_BORDA, Math.min(x, caixa.clientWidth - menu.offsetWidth - FOLGA_DA_BORDA))}px`
    menu.style.top = `${Math.max(FOLGA_DA_BORDA, Math.min(y, caixa.clientHeight - menu.offsetHeight - FOLGA_DA_BORDA))}px`
  }, [x, y])

  // O submenu abre à direita; sem espaço, à esquerda (sem sair do canvas).
  useLayoutEffect(() => {
    const submenu = submenuRef.current
    const menu = menuRef.current
    const caixa = menu?.offsetParent
    if (!submenuAberto || !submenu || !menu || !(caixa instanceof HTMLElement)) return
    const cabeADireita = menu.offsetLeft + menu.offsetWidth + submenu.offsetWidth + FOLGA_DA_BORDA <= caixa.clientWidth
    submenu.dataset.lado = cabeADireita ? 'direita' : 'esquerda'
    const sobra = caixa.clientHeight - FOLGA_DA_BORDA - (menu.offsetTop + submenu.offsetHeight)
    submenu.style.top = `${Math.min(0, sobra)}px`
  }, [submenuAberto])

  useEffect(() => {
    if (saindo) return
    const fora = (event: PointerEvent) => {
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) return
      onClose()
    }
    document.addEventListener('pointerdown', fora)
    return () => document.removeEventListener('pointerdown', fora)
  }, [onClose, saindo])

  if (atual === null || soItemDesligado) return null
  const camadas = contextoDeCamadas(map)
  const opcoes = [...camadas.ordem].reverse()
  const envio = opcoesDoEnvio(adventure, cenaAberta, situacao)

  const ligados = fichas.filter((id) => map.tokens.some((token) => token.id === id && token.characterId !== null))
  // Só o móvel selecionado que está em 3/4 trava a pilha; o de cima segue a lista, mesmo num mapa com outros em 3/4.
  const pilhaPelaBase = map.props.some((p) => objetos.includes(p.id) && p.mobilia !== undefined && !ehMovelDoChao(p.mobilia) && tresQuartosAtivo(p, map.vistaDosMoveis))
  const motivoDaPilha = pilhaPelaBase ? MOTIVO_DA_PILHA_NA_3_4 : motivoDaOutraCamada(map, objetos)
  // VISTA 3/4: os móveis da seleção em que a vista muda o desenho. Sem a chave de obra a vista não desenha nada, e o item não entra.
  const moveisComVista = meioTermoLigado() ? map.props.filter((p) => objetos.includes(p.id) && aceitaTresQuartos(p)) : []
  const todosEmTresQuartos = moveisComVista.length > 0 && moveisComVista.every((p) => movelEmTresQuartos(p, map.vistaDosMoveis))

  const porNaPilha = (lado: LadoDaPilha) => {
    if (motivoDaPilha !== null) return
    useMapStore.getState().reordenarObjetos(objetos, lado)
    onClose()
  }

  /** "Vista 3/4": todos já em 3/4 voltam a de cima; senão, todos vão para 3/4. Um passo do Ctrl+Z. */
  const alternarTresQuartos = () => {
    useMapStore.getState().definirTresQuartosDosMoveis(moveisComVista.map((p) => p.id), !todosEmTresQuartos)
    onClose()
  }

  /** O ponteiro desceu para um item sem submenu: os submenus abertos fecham. */
  const fecharSubmenus = () => {
    setSubmenuAberto(false)
    setCenasAbertas(null)
    setFichasAbertas(null)
    setAparenciaAberta(null)
    setRapidoAberto(null)
  }

  /** "Vida ›": abrir fecha os outros submenus; `null` fecha só ele. */
  const abrirRapido = (aberto: RapidoAberto | null) => {
    if (aberto !== null) fecharSubmenus()
    setRapidoAberto(aberto)
  }

  /** "Mudar ficha ›" e "Aura ›": abrir um fecha os outros submenus; `null` fecha só os dois. */
  const abrirAparencia = (aberta: AparenciaAberta | null) => {
    if (aberta !== null) fecharSubmenus()
    setAparenciaAberta(aberta)
  }

  const abrirSubmenu = (focar: boolean) => {
    setCenasAbertas(null)
    setFichasAbertas(null)
    setAparenciaAberta(null)
    setRapidoAberto(null)
    if (motivo !== null) return
    setSubmenuAberto(true)
    if (!focar) return
    // Depois do render: o foco vai à camada atual (ou à primeira que recebe).
    requestAnimationFrame(() => {
      const itens = Array.from(submenuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [])
      const daAtual = itens.findIndex((item) => item.getAttribute('aria-checked') === 'true')
      focarItem(itens, Math.max(0, daAtual), 1)
    })
  }

  const fecharSubmenu = () => {
    setSubmenuAberto(false)
    itemRef.current?.focus()
  }

  const abrirCenas = (focar: boolean) => {
    if (envio.motivo !== null) return
    setSubmenuAberto(false)
    setFichasAbertas(null)
    setAparenciaAberta(null)
    setRapidoAberto(null)
    setCenasAbertas({ focar })
  }

  const abrirFichas = (focar: boolean) => {
    setSubmenuAberto(false)
    setCenasAbertas(null)
    setAparenciaAberta(null)
    setRapidoAberto(null)
    setFichasAbertas({ focar })
  }

  const fecharFichas = () => {
    setFichasAbertas(null)
    fichaRef.current?.focus()
  }

  const ligar = (personagemId: string) => {
    void ligarFichaAosTokens(personagemId, fichas)
    onClose()
  }

  const desligar = () => {
    if (ligados.length === 0) return
    desligarFichaDosTokens(ligados)
    onClose()
  }

  const fecharCenas = () => {
    setCenasAbertas(null)
    cenaRef.current?.focus()
  }

  const enviar = (sceneId: string) => {
    enviarParaCena(fichas, sceneId)
    onClose()
  }

  const fecharTudo = () => {
    const antes = focoAntes.current
    onClose()
    if (antes instanceof HTMLElement && antes.isConnected) antes.focus()
  }

  /** O mesmo caminho do Ctrl+D: o NPC copiado ganha ficha própria no mesmo passo do Ctrl+Z. */
  const duplicar = () => {
    comFichaPropriaNasCopias(() => useMapStore.getState().duplicateSelected())
    onClose()
  }

  const escolher = (destino: (typeof opcoes)[number]) => {
    useMapStore.getState().moverParaCamada(refs, destino)
    onClose()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Nenhuma tecla do menu vale como atalho do editor (Esc largaria a seleção, setas a moveriam).
    event.stopPropagation()
    const noSubmenu = submenuRef.current?.contains(document.activeElement) === true
    if (event.key === 'Escape') {
      event.preventDefault()
      if (noSubmenu) fecharSubmenu()
      else fecharTudo()
      return
    }
    if (event.key === 'Tab') {
      onClose()
      return
    }
    if (!noSubmenu) {
      const pais = [vidaRef.current, condicoesRef.current, abrirFichaRef.current, pertoRef.current, itemRef.current, duplicarRef.current, porCimaRef.current, porBaixoRef.current, tresQuartosRef.current, cenaRef.current, fichaRef.current, desligarRef.current, formaRef.current, auraRef.current].filter((item): item is HTMLButtonElement => item !== null)
      const noPai = pais.findIndex((item) => item === document.activeElement)
      if (event.key === 'ArrowRight' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        if (document.activeElement === cenaRef.current) abrirCenas(true)
        else if (document.activeElement === fichaRef.current) abrirFichas(true)
        else if (document.activeElement === duplicarRef.current) {
          if (event.key !== 'ArrowRight') duplicar()
        } else if (document.activeElement === porCimaRef.current || document.activeElement === porBaixoRef.current) {
          if (event.key !== 'ArrowRight') porNaPilha(document.activeElement === porCimaRef.current ? 'cima' : 'baixo')
        } else if (document.activeElement === tresQuartosRef.current) {
          if (event.key !== 'ArrowRight') alternarTresQuartos()
        } else if (document.activeElement === desligarRef.current) {
          if (event.key !== 'ArrowRight') desligar()
        } else abrirSubmenu(true)
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
        event.preventDefault()
        const proximo = event.key === 'Home' ? 0 : event.key === 'End' ? pais.length - 1 : noPai + (event.key === 'ArrowDown' ? 1 : -1)
        pais[(proximo + pais.length) % pais.length]?.focus()
      }
      return
    }
    const itens = Array.from(submenuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [])
    const agora = itens.findIndex((item) => item === document.activeElement)
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault()
        fecharSubmenu()
        return
      case 'ArrowDown':
        event.preventDefault()
        focarItem(itens, agora + 1, 1)
        return
      case 'ArrowUp':
        event.preventDefault()
        focarItem(itens, agora - 1, -1)
        return
      case 'Home':
        event.preventDefault()
        focarItem(itens, 0, 1)
        return
      case 'End':
        event.preventDefault()
        focarItem(itens, itens.length - 1, -1)
        return
    }
  }

  return (
    <div
      ref={menuRef}
      className={saindo ? 'lb-panel lb-portamenu lb-menusel gr-anima gr-sai' : 'lb-panel lb-portamenu lb-menusel gr-anima'}
      inert={saindo}
      role="menu"
      aria-label={refs.length === 1 ? 'Item selecionado' : `${refs.length} itens selecionados`}
      style={{ left: x, top: y }}
      onKeyDown={onKeyDown}
      onContextMenu={(event) => event.preventDefault()}
    >
      {fichas.length > 0 && (
        <ItensRapidosDaFicha tokenIds={fichas} aberto={rapidoAberto} onAbrir={abrirRapido} vidaRef={vidaRef} abrirRef={abrirFichaRef} pertoRef={pertoRef} condicoesRef={condicoesRef} onPassar={fecharSubmenus} onClose={onClose} />
      )}
      <button
        ref={itemRef}
        type="button"
        role="menuitem"
        tabIndex={-1}
        className="lb-portamenu__item lb-menusel__pai"
        aria-haspopup="menu"
        aria-expanded={submenuAberto}
        aria-disabled={motivo !== null}
        title={motivo ?? undefined}
        onPointerEnter={(event) => {
          event.currentTarget.focus()
          abrirSubmenu(false)
        }}
        onClick={() => (submenuAberto ? fecharSubmenu() : abrirSubmenu(true))}
      >
        <span>Mover para camada</span>
        <span className="lb-menusel__seta" aria-hidden="true">
          ›
        </span>
      </button>
      {motivo !== null && <p className="lb-menusel__motivo">{motivo}</p>}
      {submenuAberto && cenasAbertas === null && fichasAbertas === null && (
        <div ref={submenuRef} className="lb-panel lb-portamenu lb-menusel__sub" role="menu" aria-label="Mover para camada">
          {opcoes.map((camada) => {
            const travada = camadas.travada(camada)
            const marcada = atual === camada
            return (
              <button
                key={camada}
                type="button"
                role="menuitemradio"
                tabIndex={-1}
                aria-checked={marcada}
                disabled={travada && !marcada}
                className="lb-portamenu__item lb-menusel__camada"
                onPointerEnter={(event) => {
                  if (!event.currentTarget.disabled) event.currentTarget.focus()
                }}
                onClick={() => escolher(camada)}
              >
                <span className="lb-menusel__marca" aria-hidden="true">
                  {marcada ? '✓' : ''}
                </span>
                <span className="lb-menusel__nome">{nomeDaCamada(map, camada)}</span>
                {travada && <span className="lb-menusel__estado">travada</span>}
              </button>
            )
          })}
        </div>
      )}
      {(fichas.length > 0 || objetos.length > 0) && (
        <button
          ref={duplicarRef}
          type="button"
          role="menuitem"
          tabIndex={-1}
          className="lb-portamenu__item lb-menusel__pai"
          aria-keyshortcuts="Control+D"
          onPointerEnter={(event) => {
            event.currentTarget.focus()
            fecharSubmenus()
          }}
          onClick={duplicar}
        >
          <span>Duplicar</span>
          <span className="lb-menusel__estado" aria-hidden="true">
            Ctrl+D
          </span>
        </button>
      )}
      {objetos.length > 0 && (
        <>
          <button
            ref={porCimaRef}
            type="button"
            role="menuitem"
            tabIndex={-1}
            className="lb-portamenu__item lb-menusel__pai"
            aria-disabled={motivoDaPilha !== null}
            title={motivoDaPilha ?? undefined}
            onPointerEnter={(event) => {
              event.currentTarget.focus()
              fecharSubmenus()
            }}
            onClick={() => porNaPilha('cima')}
          >
            <span>Pôr por cima</span>
          </button>
          <button
            ref={porBaixoRef}
            type="button"
            role="menuitem"
            tabIndex={-1}
            className="lb-portamenu__item lb-menusel__pai"
            aria-disabled={motivoDaPilha !== null}
            title={motivoDaPilha ?? undefined}
            onPointerEnter={(event) => {
              event.currentTarget.focus()
              fecharSubmenus()
            }}
            onClick={() => porNaPilha('baixo')}
          >
            <span>Pôr por baixo</span>
          </button>
          {motivoDaPilha !== null && <p className="lb-menusel__motivo">{motivoDaPilha}</p>}
          {moveisComVista.length > 0 && (
            <button
              ref={tresQuartosRef}
              type="button"
              role="menuitemcheckbox"
              aria-checked={todosEmTresQuartos}
              tabIndex={-1}
              className="lb-portamenu__item lb-menusel__pai"
              onPointerEnter={(event) => {
                event.currentTarget.focus()
                fecharSubmenus()
              }}
              onClick={alternarTresQuartos}
            >
              <span>Vista 3/4</span>
              <span className="lb-menusel__marca" aria-hidden="true">
                {todosEmTresQuartos ? '✓' : ''}
              </span>
            </button>
          )}
        </>
      )}
      {fichas.length > 0 && (
        <>
          <button
            ref={cenaRef}
            type="button"
            role="menuitem"
            tabIndex={-1}
            className="lb-portamenu__item lb-menusel__pai"
            aria-haspopup="menu"
            aria-expanded={cenasAbertas !== null}
            aria-disabled={envio.motivo !== null}
            title={envio.motivo ?? undefined}
            onPointerEnter={(event) => {
              event.currentTarget.focus()
              abrirCenas(false)
            }}
            onClick={() => (cenasAbertas !== null ? fecharCenas() : abrirCenas(true))}
          >
            <span>Enviar para cena</span>
            <span className="lb-menusel__seta" aria-hidden="true">
              ›
            </span>
          </button>
          {envio.motivo !== null && <p className="lb-menusel__motivo">{envio.motivo}</p>}
          {cenasAbertas !== null && (
            <SubmenuDeCenas
              cenas={envio.cenas}
              ancora={cenaRef.current}
              focar={cenasAbertas.focar}
              onEscolher={enviar}
              onFechar={fecharCenas}
              onSair={onClose}
            />
          )}
          <button
            ref={fichaRef}
            type="button"
            role="menuitem"
            tabIndex={-1}
            className="lb-portamenu__item lb-menusel__pai"
            aria-haspopup="menu"
            aria-expanded={fichasAbertas !== null}
            onPointerEnter={(event) => {
              event.currentTarget.focus()
              if (fichasAbertas === null) abrirFichas(false)
            }}
            onClick={() => (fichasAbertas !== null ? fecharFichas() : abrirFichas(true))}
          >
            <span>{fichas.length > 1 ? `Ligar ficha aos ${fichas.length}` : 'Ligar ficha'}</span>
            <span className="lb-menusel__seta" aria-hidden="true">
              ›
            </span>
          </button>
          {fichasAbertas !== null && (
            <SubmenuLigarFicha
              personagens={personagens}
              quantos={fichas.length}
              ancora={fichaRef.current}
              focar
              onEscolher={ligar}
              onFechar={fecharFichas}
              onSair={onClose}
            />
          )}
          <button
            ref={desligarRef}
            type="button"
            role="menuitem"
            tabIndex={-1}
            className="lb-portamenu__item lb-menusel__pai"
            aria-disabled={ligados.length === 0}
            title={ligados.length === 0 ? 'Nenhum token selecionado tem ficha.' : undefined}
            // Só o foco: o ponteiro passa por aqui a caminho do "Ligar ficha ›" aberto, e ele não pode fechar no meio.
            onPointerEnter={(event) => event.currentTarget.focus()}
            onClick={desligar}
          >
            <span>{ligados.length > 1 ? `Desligar ficha dos ${ligados.length}` : 'Desligar ficha'}</span>
          </button>
          {fichas.length === 1 && (
            <ItensDaAparenciaDaFicha tokenId={fichas[0]} aberta={aparenciaAberta} onAbrir={abrirAparencia} formaRef={formaRef} auraRef={auraRef} onClose={onClose} />
          )}
        </>
      )}
    </div>
  )
}
