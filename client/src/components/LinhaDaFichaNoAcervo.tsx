import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { nomeDaFicha, papelDaFicha, rotuloCurtoDaCopia } from '../lib/fichasNoAcervo'
import type { LinhaDeFicha } from '../lib/pastasDeFichas'
import type { Personagem } from '../lib/personagem'
import type { VidaDaFicha } from '../lib/vidaDaFicha'
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
 *  - AS CÓPIAS embaixo do modelo (pedido de 27/11/2026: "ficar aparecendo
 *    várias fichas cada uma com a sua vida fica meio poluído"): o grupo vem
 *    FECHADO, e a linha "› 3 cópias" já mostra uma barrinha de vida por ficha
 *    da família no mapa (os números no pairar). Aberto, cada cópia é uma linha
 *    curta: o ponto de onde está, "#2" (o nome do modelo já está em cima), a
 *    barra e os números. As fora do mapa ficam atrás de "Mostrar N fora do
 *    mapa", com "Apagar as fora do mapa" (pergunta, e o aviso tem Desfazer).
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
  /** "Apagar as fora do mapa": só cópias, já confirmado; o aviso traz o Desfazer. */
  apagarCopias: (personagemIds: readonly string[]) => void
}

export interface LinhaDaFichaNoAcervoProps {
  linha: LinhaDeFicha
  /** O modelo, quando a linha é de uma cópia. */
  modelo?: Personagem
  contagem: ContagemNoMapa
  /** A vida da ficha, para as barras das cópias; `null` = o sistema não tem vida com máximo. */
  vidaDe: (personagem: Personagem) => VidaDaFicha | null
  /** A busca bateu numa cópia: a lista delas abre sozinha, com as fora do mapa à vista. */
  forcarCopias: boolean
  pastaAtual: string | null
  destinos: readonly DestinoDaFicha[]
  /** Há mapa onde pôr: o "+" e o arrasto existem. */
  podePor: boolean
  onApertar: (event: ReactPointerEvent<HTMLButtonElement>, personagem: Personagem) => void
  engolirClique: () => boolean
  acoes: AcoesDaFicha
  /** Na linha da cópia: a cópia nova pelo menu dela nasce fora do mapa, e o modelo mostra as de fora. */
  aoFazerCopia?: () => void
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

/** Acima disto a barra é verde; acima de `VIDA_BAIXA`, latão; abaixo, brasa. Em fração do máximo. */
const VIDA_MEIA = 0.5
const VIDA_BAIXA = 0.25

/** Mais barrinhas que isto no resumo viram "+N": vinte tokens não cabem na coluna. */
const BARRAS_NO_RESUMO_MAX = 24

type TomDaVida = 'cheia' | 'meia' | 'baixa' | 'caida'

function tomDaVida(vida: VidaDaFicha): TomDaVida {
  if (vida.atual <= 0) return 'caida'
  const parte = vida.atual / vida.maximo
  return parte > VIDA_MEIA ? 'cheia' : parte > VIDA_BAIXA ? 'meia' : 'baixa'
}

/** A barra fina de uma ficha: a cor diz o estado de longe, a largura o quanto sobra. */
function BarraDeVida({ vida }: { vida: VidaDaFicha }) {
  return (
    <span className="lb-acervo__vida" data-tom={tomDaVida(vida)} aria-hidden="true">
      <span className="lb-acervo__vida-cheio" style={{ width: `${Math.round((vida.atual / vida.maximo) * 100)}%` }} />
    </span>
  )
}

interface VidaNoResumo {
  id: string
  rotulo: string
  vida: VidaDaFicha
}

/** As barrinhas da família no mapa, ao lado de "› 3 cópias"; o pairar dá os números de cada uma. */
function ResumoDasVidas({ itens }: { itens: readonly VidaNoResumo[] }) {
  if (itens.length === 0) return null
  const vistas = itens.slice(0, BARRAS_NO_RESUMO_MAX)
  const numeros = itens.map(({ rotulo, vida }) => `${rotulo} ${vida.atual}/${vida.maximo}`).join(' · ')
  return (
    <span className="lb-acervo__vidas" role="img" aria-label={`Vida no mapa: ${itens.map(({ rotulo, vida }) => `${rotulo} ${vida.atual} de ${vida.maximo}`).join(', ')}`} title={`Vida no mapa: ${numeros}`}>
      {vistas.map(({ id, vida }) => (
        <BarraDeVida key={id} vida={vida} />
      ))}
      {itens.length > vistas.length && <span className="lb-acervo__vidas-mais">+{itens.length - vistas.length}</span>}
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

/** "Inimigo · 2 no mapa", embaixo do nome do modelo. */
function LinhaDeBaixo({ personagem, quantos }: { personagem: Personagem; quantos: number }) {
  return (
    <span className="lb-acervo__leva">
      {papelDaFicha(personagem)}
      {quantos > 0 && (
        <>
          {' · '}
          <b>{quantos} no mapa</b>
        </>
      )}
    </span>
  )
}

/** "no mapa", "2 no mapa" ou "fora do mapa": o texto do ponto da cópia e do nome acessível. */
function ondeEsta(quantos: number): string {
  if (quantos === 0) return 'fora do mapa'
  return quantos === 1 ? 'no mapa' : `${quantos} no mapa`
}

/** O que vai dentro do botão da cópia: ponto de onde está, "#2", a barra e os números. */
function MioloDaCopia({ nome, rotulo, quantos, vida }: { nome: string; rotulo: string; quantos: number; vida: VidaDaFicha | null }) {
  const onde = ondeEsta(quantos)
  return (
    <>
      <span className="lb-acervo__onde" data-no-mapa={quantos > 0 ? 'sim' : undefined} title={onde[0].toLocaleUpperCase('pt-BR') + onde.slice(1)} aria-hidden="true" />
      <span className="lb-acervo__copia-nome" title={nome}>
        {rotulo}
      </span>
      {vida !== null && (
        <>
          <BarraDeVida vida={vida} />
          <span className="lb-acervo__vida-numeros" aria-hidden="true">
            {vida.atual}/{vida.maximo}
          </span>
        </>
      )}
    </>
  )
}

export function LinhaDaFichaNoAcervo(props: LinhaDaFichaNoAcervoProps) {
  const { linha, modelo, contagem, vidaDe, forcarCopias, pastaAtual, destinos, podePor, onApertar, engolirClique, acoes, aoFazerCopia } = props
  const { personagem, copias, totalDeCopias } = linha
  const ehCopia = modelo !== undefined
  const nome = nomeDaFicha(personagem)
  const quantos = (ehCopia ? contagem.porFicha.get(personagem.id) : contagem.porFamilia.get(personagem.id)) ?? 0
  const vida = ehCopia ? vidaDe(personagem) : null
  const [menu, setMenu] = useState<{ pelaTecla: boolean } | null>(null)
  const [apagando, setApagando] = useState(false)
  const [copiasAbertas, setCopiasAbertas] = useState(false)
  const [foraAbertas, setForaAbertas] = useState(false)
  const [apagandoFora, setApagandoFora] = useState(false)
  const maisRef = useRef<HTMLButtonElement | null>(null)
  const apagarForaRef = useRef<HTMLButtonElement | null>(null)
  const idDasCopias = useId()
  const mostraCopias = copias.length > 0 && (forcarCopias || copiasAbertas)
  const noMapa = (ficha: Personagem) => (contagem.porFicha.get(ficha.id) ?? 0) > 0
  const copiasNoMapa = copias.filter(noMapa)
  const copiasFora = copias.filter((copia) => !noMapa(copia))
  // Com a busca, a cópia que bate fica à vista mesmo fora do mapa: esconder o que se procurou seria pior.
  const mostraFora = forcarCopias || foraAbertas
  const vidasNoMapa: VidaNoResumo[] = ehCopia
    ? []
    : [...(noMapa(personagem) ? [personagem] : []), ...copiasNoMapa].flatMap((ficha) => {
        const daFicha = vidaDe(ficha)
        return daFicha === null ? [] : [{ id: ficha.id, rotulo: ficha === personagem ? nome : rotuloCurtoDaCopia(ficha, personagem), vida: daFicha }]
      })

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
    if (event.key !== 'Escape' || (!apagando && !apagandoFora)) return
    event.preventDefault()
    event.stopPropagation()
    if (apagando) {
      setApagando(false)
      maisRef.current?.focus()
      return
    }
    setApagandoFora(false)
    requestAnimationFrame(() => apagarForaRef.current?.focus())
  }

  const rotuloDoNome = ehCopia ? `Abrir a ficha de ${nome}${vida === null ? '' : `, vida ${vida.atual} de ${vida.maximo}`}, ${ondeEsta(quantos)}` : `Abrir a ficha de ${nome}`
  const classe = ['lb-acervo__item', 'lb-acervo__item--ficha', ehCopia && 'lb-acervo__item--copia'].filter(Boolean).join(' ')
  return (
    <li className={classe} onKeyDown={teclaNaLinha}>
      {!ehCopia && (
        <span className="lb-acervo__foto lb-acervo__foto--ficha" data-no-mapa={quantos > 0 ? 'sim' : undefined} aria-hidden="true">
          <ImagemOuIniciais imagem={personagem.retrato} nome={personagem.nome} />
        </span>
      )}
      <button
        type="button"
        className={ehCopia ? 'lb-acervo__nome lb-acervo__nome--copia' : 'lb-acervo__nome lb-acervo__nome--leva lb-acervo__nome--ficha'}
        {...{ [ATRIBUTO_DO_NOME_DA_FICHA]: personagem.id }}
        aria-label={rotuloDoNome}
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
        {ehCopia ? (
          <MioloDaCopia nome={nome} rotulo={rotuloCurtoDaCopia(personagem, modelo)} quantos={quantos} vida={vida} />
        ) : (
          <>
            {/* O nome quebra em até duas linhas antes das reticências; o nome inteiro na dica do texto. */}
            <span className="lb-acervo__nome-linha" title={nome}>
              <span className="lb-acervo__nome-texto">{nome}</span>
              <SeloTemFicha />
            </span>
            <LinhaDeBaixo personagem={personagem} quantos={quantos} />
          </>
        )}
      </button>
      {!apagando && (
        // A ponta da linha: o "⋯" e o "+", por cima do fim do nome no pairar (ver `.lb-acervo__ponta`).
        <span className="lb-acervo__ponta">
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
          {podePor && (
            // O "+" da linha do token, fora do Tab (o menu tem o mesmo "Pôr no centro").
            <button type="button" className="lb-acervo__por" aria-label={`Pôr ${nome} no centro do mapa`} title="Pôr no centro da vista" tabIndex={-1} onClick={() => acoes.porNoCentro(personagem)}>
              <IconeDoLivro nome="mais" />
            </button>
          )}
        </span>
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
                if (id === null) return
                // A cópia nova nasce fora do mapa: o grupo abre com as de fora à vista, senão ela some atrás do "Mostrar".
                if (ehCopia) aoFazerCopia?.()
                else {
                  setCopiasAbertas(true)
                  setForaAbertas(true)
                }
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
        <span className="lb-acervo__copias-topo">
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
          <ResumoDasVidas itens={vidasNoMapa} />
        </span>
      )}
      {mostraCopias && (
        <div id={idDasCopias} className="lb-acervo__copias-caixa">
          {(copiasNoMapa.length > 0 || mostraFora) && (
            <ul className="lb-acervo lb-acervo__copias-lista" aria-label={`Cópias de ${nome}`}>
              {[...copiasNoMapa, ...(mostraFora ? copiasFora : [])].map((copia) => (
                <LinhaDaFichaNoAcervo
                  key={copia.id}
                  {...props}
                  linha={{ personagem: copia, copias: [], totalDeCopias: 0 }}
                  modelo={personagem}
                  forcarCopias={false}
                  aoFazerCopia={() => setForaAbertas(true)}
                />
              ))}
            </ul>
          )}
          {copiasFora.length > 0 && !apagandoFora && (
            <span className="lb-acervo__fora">
              {!forcarCopias && (
                <button type="button" className="lb-acervo__fora-botao" aria-expanded={foraAbertas} onClick={() => setForaAbertas(!foraAbertas)}>
                  {foraAbertas ? `Esconder as fora do mapa (${copiasFora.length})` : `Mostrar ${copiasFora.length} fora do mapa`}
                </button>
              )}
              {mostraFora && (
                <button ref={apagarForaRef} type="button" className="lb-acervo__fora-botao lb-acervo__fora-botao--perigo" onClick={() => setApagandoFora(true)}>
                  Apagar as fora do mapa
                </button>
              )}
            </span>
          )}
          {apagandoFora && (
            <div className="lb-acervo__confirma lb-acervo__confirma--ficha" role="group" aria-label={`Apagar as cópias de ${nome} fora do mapa?`}>
              <p className="lb-acervo__vazio">
                {copiasFora.length === 1 ? `Apagar a cópia de ${nome} que está fora do mapa?` : `Apagar as ${copiasFora.length} cópias de ${nome} que estão fora do mapa?`} Elas saem da aventura; o aviso traz Desfazer.
              </p>
              <button
                type="button"
                className="lb-btn lb-btn--ghost"
                autoFocus
                onClick={() => {
                  setApagandoFora(false)
                  requestAnimationFrame(() => apagarForaRef.current?.focus())
                }}
              >
                Manter
              </button>
              <button
                type="button"
                className="lb-btn lb-btn--danger"
                onClick={() => {
                  setApagandoFora(false)
                  setForaAbertas(false)
                  acoes.apagarCopias(copiasFora.map((copia) => copia.id))
                  focarNomeDaFicha(personagem.id)
                }}
              >
                {copiasFora.length === 1 ? 'Apagar 1 cópia' : `Apagar ${copiasFora.length} cópias`}
              </button>
            </div>
          )}
        </div>
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
