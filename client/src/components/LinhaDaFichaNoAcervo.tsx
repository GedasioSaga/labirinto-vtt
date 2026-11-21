import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { nomeDaFicha, papelDaFicha } from '../lib/fichasNoAcervo'
import type { LinhaDeFicha } from '../lib/pastasDeFichas'
import type { Personagem } from '../lib/personagem'
import { ImagemOuIniciais } from './FichaPecas'
import { ChevronDownIcon } from './icons'
import { IconeDoLivro } from './livro/icones'

/**
 * A LINHA DA FICHA DE NPC no acervo de tokens (protótipo
 * docs/design/acervo/npcs-no-acervo.html, decisões 5, 6, 7 e 10). Mora ao lado
 * da linha do token do app, com as mesmas classes de linha, e o formato do
 * retrato diz o que ela é: QUADRADO de canto arredondado = ficha desta
 * aventura (disco = token do app); borda de latão = tem token no mapa agora.
 *
 *  - CLIQUE NO NOME abre a ficha (um clique, como o dono pediu); o "+" põe no
 *    centro do mapa; o arrasto (gesto comum, `useArrastoDaLinha`) leva ao
 *    mapa, a um token (liga a ficha a ele) ou a uma pasta.
 *  - AS AÇÕES num "⋯" que aparece por cima do fim do nome; Shift+F10 (ou a
 *    tecla de menu) no nome abre o mesmo menu. Esc fecha e devolve o foco.
 *  - AS CÓPIAS embaixo do modelo ("› 2 cópias"); cada uma diz se está no mapa.
 */

/** Quantos tokens do mapa aberto usam cada ficha (`porFicha`) e cada família, modelo e cópias (`porFamilia`). */
export interface ContagemNoMapa {
  porFicha: ReadonlyMap<string, number>
  porFamilia: ReadonlyMap<string, number>
}

/** Um destino do "Mover para": pasta de cima, subpasta (recuada) ou Sem pasta (`id` nulo). */
export interface DestinoDaFicha {
  id: string | null
  nome: string
  sub: boolean
}

export interface AcoesDaFicha {
  abrir: (personagemId: string) => void
  porNoCentro: (personagem: Personagem) => void
  /** Faz a cópia; devolve o `id` dela (`null` = não deu). */
  copiar: (personagemId: string) => string | null
  mover: (personagem: Personagem, pastaId: string | null) => void
  apagar: (personagemId: string) => void
}

export interface LinhaDaFichaNoAcervoProps {
  linha: LinhaDeFicha
  /** O modelo, quando a linha é de uma cópia. */
  modelo?: Personagem
  contagem: ContagemNoMapa
  /** A busca bateu numa cópia: a lista delas abre sozinha. */
  forcarCopias: boolean
  pastaAtual: string | null
  destinos: readonly DestinoDaFicha[]
  /** Há mapa onde pôr: o "+" e o arrasto existem. */
  podePor: boolean
  onApertar: (event: ReactPointerEvent<HTMLButtonElement>, personagem: Personagem) => void
  engolirClique: () => boolean
  acoes: AcoesDaFicha
}

/** O atributo que acha o nome da ficha depois de um Mover (a linha nasce de novo em outra pasta). */
export const ATRIBUTO_DO_NOME_DA_FICHA = 'data-ficha-nome'

function focarNomeDaFicha(personagemId: string): void {
  requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[${ATRIBUTO_DO_NOME_DA_FICHA}="${CSS.escape(personagemId)}"]`)?.focus())
}

/**
 * O SELO "Tem ficha" (pedido de 21/11/2026: "vai ter um indicativo que aquele
 * token tem ficha?"), ao lado do nome de toda linha que tem ficha. O nome
 * acessível do botão já diz "Abrir a ficha de…"; o selo é para quem enxerga, e
 * o `title` explica no pairar.
 */
export function SeloTemFicha() {
  return (
    <span className="lb-acervo__tem-ficha" title="Tem ficha" aria-hidden="true">
      <IconeDoLivro nome="ficha" />
    </span>
  )
}

/** "Mover para" do menu: as pastas, com a atual marcada; na cópia, o aviso de que ela anda com o modelo. Sem pastas, nada. */
function itensDoMover(modelo: Personagem | undefined, destinos: readonly DestinoDaFicha[], pastaAtual: string | null, mover: (pastaId: string | null) => void): ItemDoMenu[] {
  if (modelo !== undefined) return [{ tipo: 'separador' }, { tipo: 'rotulo', texto: 'Mover para' }, { tipo: 'desligado', rotulo: 'Mover: a cópia fica com o modelo' }]
  if (destinos.length === 0) return []
  return [
    { tipo: 'separador' },
    { tipo: 'rotulo', texto: 'Mover para' },
    ...destinos.map((destino): ItemDoMenu => ({ tipo: 'pasta', rotulo: destino.nome, marcada: pastaAtual === destino.id, sub: destino.sub, acao: () => mover(destino.id) })),
  ]
}

/** "Inimigo · 2 no mapa" (modelo) ou "no mapa" / "fora do mapa" (cópia). */
function LinhaDeBaixo({ personagem, ehCopia, quantos }: { personagem: Personagem; ehCopia: boolean; quantos: number }) {
  if (ehCopia) {
    if (quantos === 0) return <span className="lb-acervo__leva">fora do mapa</span>
    return (
      <span className="lb-acervo__leva">
        <b>{quantos === 1 ? 'no mapa' : `${quantos} no mapa`}</b>
      </span>
    )
  }
  const papel = papelDaFicha(personagem)
  return (
    <span className="lb-acervo__leva">
      {papel}
      {quantos > 0 && (
        <>
          {' · '}
          <b>{quantos} no mapa</b>
        </>
      )}
    </span>
  )
}

export function LinhaDaFichaNoAcervo(props: LinhaDaFichaNoAcervoProps) {
  const { linha, modelo, contagem, forcarCopias, pastaAtual, destinos, podePor, onApertar, engolirClique, acoes } = props
  const { personagem, copias, totalDeCopias } = linha
  const ehCopia = modelo !== undefined
  const nome = nomeDaFicha(personagem)
  const quantos = (ehCopia ? contagem.porFicha.get(personagem.id) : contagem.porFamilia.get(personagem.id)) ?? 0
  const [menu, setMenu] = useState<{ pelaTecla: boolean } | null>(null)
  const [apagando, setApagando] = useState(false)
  const [copiasAbertas, setCopiasAbertas] = useState(false)
  const maisRef = useRef<HTMLButtonElement | null>(null)
  const idDasCopias = useId()
  const mostraCopias = copias.length > 0 && (forcarCopias || copiasAbertas)

  const fecharMenu = (devolverFoco: boolean) => {
    setMenu(null)
    if (devolverFoco) maisRef.current?.focus()
  }

  const teclaNoNome = (event: KeyboardEvent<HTMLButtonElement>) => {
    // Shift+F10 e a tecla de menu: o "⋯" pelo teclado (convenção "Menu de ações").
    if ((event.key === 'F10' && event.shiftKey) || event.key === 'ContextMenu') {
      event.preventDefault()
      event.stopPropagation()
      setMenu({ pelaTecla: true })
    }
  }

  const teclaNaLinha = (event: KeyboardEvent<HTMLLIElement>) => {
    if (event.key !== 'Escape' || !apagando) return
    event.preventDefault()
    event.stopPropagation()
    setApagando(false)
    maisRef.current?.focus()
  }

  const classe = ['lb-acervo__item', 'lb-acervo__item--ficha', ehCopia && 'lb-acervo__item--copia'].filter(Boolean).join(' ')
  return (
    <li className={classe} onKeyDown={teclaNaLinha}>
      <span className="lb-acervo__foto lb-acervo__foto--ficha" data-no-mapa={quantos > 0 ? 'sim' : undefined} aria-hidden="true">
        <ImagemOuIniciais imagem={personagem.retrato} nome={personagem.nome} />
      </span>
      <button
        type="button"
        className="lb-acervo__nome lb-acervo__nome--leva lb-acervo__nome--ficha"
        {...{ [ATRIBUTO_DO_NOME_DA_FICHA]: personagem.id }}
        aria-label={`Abrir a ficha de ${nome}`}
        aria-keyshortcuts="Shift+F10"
        title={podePor ? 'Clique para abrir a ficha. Arraste até o mapa, até um token (liga a ficha a ele) ou até uma pasta. Shift+F10: mais ações.' : 'Clique para abrir a ficha. Shift+F10: mais ações.'}
        onPointerDown={(event) => onApertar(event, personagem)}
        // O retrato é um <img>: sem isto o navegador começa o arrasto nativo dele e cancela o nosso.
        onDragStart={(event) => event.preventDefault()}
        onKeyDown={teclaNoNome}
        onClick={() => {
          if (!engolirClique()) acoes.abrir(personagem.id)
        }}
      >
        <span className="lb-acervo__nome-linha">
          <span className="lb-acervo__nome-texto" title={nome}>
            {nome}
          </span>
          <SeloTemFicha />
        </span>
        <LinhaDeBaixo personagem={personagem} ehCopia={ehCopia} quantos={quantos} />
      </button>
      {!apagando && (
        <span className="lb-acervo__acoes lb-acervo__acoes--ficha">
          <button
            ref={maisRef}
            type="button"
            className="lb-acervo__mais"
            aria-label={`Mais ações de ${nome}`}
            title="Mais ações"
            aria-haspopup="menu"
            aria-expanded={menu !== null}
            onClick={() => setMenu(menu === null ? { pelaTecla: false } : null)}
          >
            <span aria-hidden="true">⋯</span>
          </button>
        </span>
      )}
      {!apagando && podePor && (
        // O "+" da linha do token: sempre à vista, fora do Tab (o menu tem o mesmo "Pôr no centro").
        <button type="button" className="lb-acervo__por" aria-label={`Pôr ${nome} no centro do mapa`} title="Pôr no centro da vista" tabIndex={-1} onClick={() => acoes.porNoCentro(personagem)}>
          <IconeDoLivro nome="mais" />
        </button>
      )}
      {menu !== null && maisRef.current !== null && (
        <MenuDeAcoes
          ancora={maisRef.current}
          pelaTecla={menu.pelaTecla}
          nome={nome}
          onFechar={fecharMenu}
          itens={[
            {
              tipo: 'acao',
              rotulo: 'Abrir ficha',
              atalho: 'Enter',
              acao: () => {
                setMenu(null)
                acoes.abrir(personagem.id)
              },
            },
            ...(podePor
              ? [
                  {
                    tipo: 'acao',
                    rotulo: 'Pôr no centro do mapa',
                    acao: () => {
                      fecharMenu(true)
                      acoes.porNoCentro(personagem)
                    },
                  } satisfies ItemDoMenu,
                ]
              : []),
            {
              tipo: 'acao',
              rotulo: modelo === undefined ? 'Fazer cópia' : `Fazer outra cópia de ${nomeDaFicha(modelo)}`,
              acao: () => {
                fecharMenu(true)
                const id = acoes.copiar(modelo?.id ?? personagem.id)
                if (id !== null && !ehCopia) setCopiasAbertas(true)
              },
            },
            ...itensDoMover(modelo, destinos, pastaAtual, (pastaId) => {
              setMenu(null)
              acoes.mover(personagem, pastaId)
              focarNomeDaFicha(personagem.id)
            }),
            { tipo: 'separador' },
            {
              tipo: 'acao',
              rotulo: modelo === undefined ? 'Apagar ficha…' : 'Apagar cópia…',
              perigo: true,
              acao: () => {
                setMenu(null)
                setApagando(true)
              },
            },
          ]}
        />
      )}
      {apagando && (
        <div className="lb-acervo__confirma lb-acervo__confirma--ficha" role="group" aria-label={`Apagar ${nome}?`}>
          <p className="lb-acervo__vazio">
            Apagar {nome}?{totalDeCopias > 0 ? (totalDeCopias === 1 ? ' A cópia fica como ficha solta.' : ` As ${totalDeCopias} cópias ficam como fichas soltas.`) : ''}
          </p>
          <button
            type="button"
            className="lb-btn lb-btn--ghost"
            autoFocus
            onClick={() => {
              setApagando(false)
              requestAnimationFrame(() => maisRef.current?.focus())
            }}
          >
            Manter
          </button>
          <button type="button" className="lb-btn lb-btn--danger" onClick={() => acoes.apagar(personagem.id)}>
            {ehCopia ? 'Apagar cópia' : 'Apagar ficha'}
          </button>
        </div>
      )}
      {totalDeCopias > 0 && (
        <button
          type="button"
          className="lb-acervo__copias"
          aria-expanded={mostraCopias}
          aria-controls={idDasCopias}
          disabled={copias.length === 0}
          title="Cada token com a própria vida. Mudar o modelo muda todas as cópias."
          onClick={() => setCopiasAbertas(!mostraCopias)}
        >
          <span className="lb-acervo__copias-seta" aria-hidden="true">
            <ChevronDownIcon size={12} />
          </span>
          {totalDeCopias === 1 ? '1 cópia' : `${totalDeCopias} cópias`}
        </button>
      )}
      {mostraCopias && (
        <ul id={idDasCopias} className="lb-acervo lb-acervo__copias-lista" aria-label={`Cópias de ${nome}`}>
          {copias.map((copia) => (
            <LinhaDaFichaNoAcervo key={copia.id} {...props} linha={{ personagem: copia, copias: [], totalDeCopias: 0 }} modelo={personagem} forcarCopias={false} />
          ))}
        </ul>
      )}
    </li>
  )
}

/** Uma entrada do menu "⋯": ação, opção de pasta (marcada ou não), item desligado, separador ou rótulo de seção. */
export type ItemDoMenu =
  | { tipo: 'acao'; rotulo: string; acao: () => void; atalho?: string; perigo?: boolean }
  | { tipo: 'pasta'; rotulo: string; marcada: boolean; sub: boolean; acao: () => void }
  | { tipo: 'desligado'; rotulo: string }
  | { tipo: 'separador' }
  | { tipo: 'rotulo'; texto: string }

interface MenuDeAcoesProps {
  ancora: HTMLElement
  /** Aberto pelo teclado: sem a entrada animada (quem usa teclado não espera o menu chegar). */
  pelaTecla: boolean
  nome: string
  itens: readonly ItemDoMenu[]
  onFechar: (devolverFoco: boolean) => void
}

const FOLGA_DO_MENU = 8

/**
 * O menu "⋯" das linhas do acervo, no molde do `MenuDaPasta` da lista de
 * personagens: no `body`, com posição fixa (o painel recorta o que passa da
 * borda), alinhado à direita do botão e virado para cima quando não cabe
 * embaixo. Foco no primeiro item, setas, Home e End andam; Esc fecha e devolve
 * o foco ao "⋯"; Tab, clique fora e rolagem fecham sem devolver.
 */
export function MenuDeAcoes({ ancora, pelaTecla, nome, itens, onFechar }: MenuDeAcoesProps) {
  const menuRef = useRef<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    const menu = menuRef.current
    if (menu === null) return
    const caixa = ancora.getBoundingClientRect()
    const largura = menu.offsetWidth
    const altura = menu.offsetHeight
    const left = Math.max(FOLGA_DO_MENU, Math.min(caixa.right - largura, window.innerWidth - largura - FOLGA_DO_MENU))
    const abaixo = caixa.bottom + 4
    const paraCima = abaixo + altura + FOLGA_DO_MENU > window.innerHeight
    menu.style.left = `${left}px`
    menu.style.top = `${paraCima ? Math.max(FOLGA_DO_MENU, caixa.top - altura - 4) : abaixo}px`
    menu.dataset.paraCima = paraCima ? 'sim' : 'nao'
    menu.querySelector<HTMLButtonElement>('[role^="menuitem"]:not([aria-disabled="true"])')?.focus()
  }, [ancora])

  useEffect(() => {
    const fora = (event: PointerEvent) => {
      if (event.target instanceof Node && (menuRef.current?.contains(event.target) || ancora.contains(event.target))) return
      onFechar(false)
    }
    const rolou = (event: Event) => {
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) return
      onFechar(false)
    }
    document.addEventListener('pointerdown', fora)
    window.addEventListener('scroll', rolou, true)
    return () => {
      document.removeEventListener('pointerdown', fora)
      window.removeEventListener('scroll', rolou, true)
    }
  }, [ancora, onFechar])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation()
    const botoes = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]:not([aria-disabled="true"])') ?? [])
    const aqui = botoes.findIndex((botao) => botao === document.activeElement)
    if (event.key === 'Escape') {
      event.preventDefault()
      onFechar(true)
    } else if (event.key === 'Tab') {
      onFechar(false)
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      const alvo = event.key === 'Home' ? 0 : event.key === 'End' ? botoes.length - 1 : aqui + (event.key === 'ArrowDown' ? 1 : -1)
      botoes[(alvo + botoes.length) % botoes.length]?.focus()
    }
  }

  const entrada = (item: ItemDoMenu, indice: number) => {
    if (item.tipo === 'separador') return <div key={indice} className="lb-acervo-menu__sep" role="separator" />
    if (item.tipo === 'rotulo')
      return (
        <p key={indice} className="lb-acervo-menu__rotulo" aria-hidden="true">
          {item.texto}
        </p>
      )
    if (item.tipo === 'desligado')
      return (
        <button key={indice} type="button" role="menuitem" tabIndex={-1} aria-disabled="true" className="lb-portamenu__item lb-acervo-menu__item">
          {item.rotulo}
        </button>
      )
    if (item.tipo === 'pasta')
      return (
        <button
          key={indice}
          type="button"
          role="menuitemradio"
          aria-checked={item.marcada}
          aria-label={`Mover para ${item.rotulo}`}
          tabIndex={-1}
          className={item.sub ? 'lb-portamenu__item lb-menusel__camada lb-acervo-menu__item lb-acervo-menu__sub' : 'lb-portamenu__item lb-menusel__camada lb-acervo-menu__item'}
          onPointerEnter={(event) => event.currentTarget.focus()}
          onClick={item.marcada ? () => onFechar(true) : item.acao}
        >
          <span className="lb-menusel__marca" aria-hidden="true">
            {item.marcada ? '✓' : ''}
          </span>
          <span className="lb-menusel__nome">{item.rotulo}</span>
        </button>
      )
    return (
      <button
        key={indice}
        type="button"
        role="menuitem"
        tabIndex={-1}
        className={item.perigo === true ? 'lb-portamenu__item lb-acervo-menu__item lb-acervo-menu__item--perigo' : 'lb-portamenu__item lb-acervo-menu__item'}
        onPointerEnter={(event) => event.currentTarget.focus()}
        onClick={item.acao}
      >
        <span className="lb-acervo-menu__texto">{item.rotulo}</span>
        {item.atalho !== undefined && (
          <span className="lb-acervo-menu__atalho" aria-hidden="true">
            {item.atalho}
          </span>
        )}
      </button>
    )
  }

  return createPortal(
    <div
      ref={menuRef}
      className={pelaTecla ? 'lb-panel lb-portamenu lb-acervo-menu' : 'lb-panel lb-portamenu lb-acervo-menu lb-acervo-menu--entra'}
      role="menu"
      aria-label={`Ações de ${nome}`}
      onKeyDown={onKeyDown}
    >
      {itens.map(entrada)}
    </div>,
    document.body,
  )
}
