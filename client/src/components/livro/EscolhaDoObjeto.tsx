import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { isEditableTarget } from '../../lib/keymap'
import { GRUPOS_DE_OBJETO, acharObjetos, grupoDoObjeto, partesDoObjeto, type IdDoGrupoDeObjeto } from '../../lib/mobilia/gruposDoObjeto'
import { TIPOS_MOBILIA, type TipoMobilia } from '../../lib/mobilia/tipos'
import { useObjetosUsados } from '../../stores/objetosUsados'
import { Botao } from '../grimorio/Botao'
import { CampoSeg } from '../grimorio/CampoSeg'
import { classes } from '../grimorio/comum'
import type { OpcaoDoEixo } from '../ToolVariantMenu'
import { IconeDoLivro } from './icones'
import './escolhaDoObjeto.css'

/** A família de chaves das seções recolhíveis (`lb-section:<id>`, CollapsibleSection). */
const PREFIXO_DA_CHAVE = 'lb-section:objeto-'
/** A tecla que leva à busca de qualquer lugar sem campo de texto (a "/" das buscas de documentação). */
const TECLA_DA_BUSCA = '/'

/**
 * O texto da busca FORA do componente (E11 da caça de 12/11/2026): a ficha do
 * objeto toma o painel e a troca de ferramenta desmontam esta escolha, e a
 * busca voltava vazia no meio da montagem da cena. Dura enquanto o app está
 * aberto; o Esc e o "Limpar busca" apagam como antes.
 */
let buscaGuardada = ''

const TIPOS_CONHECIDOS: ReadonlySet<string> = new Set(TIPOS_MOBILIA)
function ehTipo(id: string): id is TipoMobilia {
  return TIPOS_CONHECIDOS.has(id)
}

/** localStorage pode faltar ou lançar (janela privada): sem escolha gravada vale a regra de partida. */
function lerAberto(grupo: IdDoGrupoDeObjeto): boolean | null {
  try {
    const gravado = window.localStorage.getItem(PREFIXO_DA_CHAVE + grupo)
    return gravado === '1' ? true : gravado === '0' ? false : null
  } catch {
    return null
  }
}

function gravarAberto(grupo: IdDoGrupoDeObjeto, aberto: boolean): void {
  try {
    window.localStorage.setItem(PREFIXO_DA_CHAVE + grupo, aberto ? '1' : '0')
  } catch {
    // Sem armazenamento a escolha vale enquanto a ficha estiver montada.
  }
}

/** Tecla usada aqui não segue para o mapa (lá a seta empurra a seleção e o Esc larga o rascunho). */
function consumir(evento: KeyboardEvent<HTMLElement>): void {
  evento.preventDefault()
  evento.stopPropagation()
}

function contagem(n: number, palavra: { singular: string; plural: string } = { singular: 'objeto', plural: 'objetos' }): string {
  return n === 1 ? `1 ${palavra.singular}` : `${n} ${palavra.plural}`
}

/** As opções com o título do grupo de cada uma, para a busca achar também pelo lugar ("cozinha", "feira"). */
function itensDaBusca(opcoes: readonly OpcaoDoEixo[]) {
  const tituloDoGrupo = new Map<string, string>()
  for (const parte of partesDoObjeto(opcoes.map((opcao) => opcao.id).filter(ehTipo))) for (const tipo of parte.tipos) tituloDoGrupo.set(tipo, parte.titulo)
  // O tipo leva às palavras do dia a dia (`PALAVRAS_DO_OBJETO`): "cripta" acha o mausoléu.
  return opcoes.map((opcao) => ({ opcao, rotulo: opcao.label, grupo: tituloDoGrupo.get(opcao.id) ?? '', tipo: ehTipo(opcao.id) ? opcao.id : undefined }))
}

/**
 * O catálogo de OUTRA ferramenta que a busca também acha (decisão do mestre de 12/11/2026: a busca do Objeto
 * acha as construções). Cada achado sai numa linha "Torre de pedra — em Construção"; escolher leva à outra
 * ferramenta com ele escolhido (quem chama troca a ferramenta).
 */
export interface DaOutraFerramenta {
  /** O nome da outra ferramenta, como na barra ("Construção"). */
  nome: string
  opcoes: readonly OpcaoDoEixo[]
  escolher: (id: string) => void
}

export interface EscolhaDoObjetoProps {
  /** O nome do eixo ("Objeto"), o rótulo do campo. */
  rotulo: string
  /** As opções do eixo `mobiliaTipo` (`eixoDaVariante`), na ordem do catálogo, com o desenho de cada móvel. */
  opcoes: readonly OpcaoDoEixo[]
  marcada: string | null
  escolher: (id: string) => void
  daOutraFerramenta?: DaOutraFerramenta
}

/** O que dá para pôr nesta escolha, no singular e no plural ("objeto", "construção"), pelo rótulo do eixo. */
function palavraDoItem(rotulo: string): { singular: string; plural: string } {
  return rotulo === 'Construção' ? { singular: 'construção', plural: 'construções' } : { singular: 'objeto', plural: 'objetos' }
}

/**
 * A ESCOLHA DO OBJETO na ficha da ferramenta (pedido de 10/11/2026: a grade de
 * 48 nomes sem ordem virou grupos). De cima para baixo: o rótulo com o objeto
 * escolhido à direita (sempre à vista), a busca sem acento, "Usados há pouco"
 * (os últimos móveis postos no mapa) e os grupos de `GRUPO_DO_OBJETO`,
 * recolhíveis e lembrados entre sessões. Nenhum objeto some: todo tipo do
 * catálogo cai num grupo (os sem grupo em "Outros").
 *
 * Teclado: "/" de qualquer lugar sem campo de texto põe o cursor na busca;
 * na busca, seta para baixo desce para a lista, Enter escolhe o primeiro
 * achado e Esc apaga (o segundo sai do campo); numa grade as setas andam e
 * escolhem (`andarPelosRadios`) e digitar uma letra volta à busca com ela;
 * nos títulos dos grupos as setas passam de um título ao outro.
 */
export function EscolhaDoObjeto({ rotulo, opcoes, marcada, escolher, daOutraFerramenta }: EscolhaDoObjetoProps) {
  const palavra = palavraDoItem(rotulo)
  const ids = useId()
  const entradaRef = useRef<HTMLInputElement | null>(null)
  const listaRef = useRef<HTMLDivElement | null>(null)
  const [busca, setBuscaNaTela] = useState(buscaGuardada)
  /** Toda mudança da busca passa por aqui: a tela e a cópia que sobrevive ao desmonte andam juntas. */
  const mudarBusca = (texto: string) => {
    buscaGuardada = texto
    setBuscaNaTela(texto)
  }
  /** O aberto/fechado que o mestre gravou; `null` = nunca mexeu naquele grupo. */
  const [guardados, setGuardados] = useState<ReadonlyMap<IdDoGrupoDeObjeto, boolean | null>>(
    () => new Map(GRUPOS_DE_OBJETO.map((grupo) => [grupo.id, lerAberto(grupo.id)])),
  )
  const usados = useObjetosUsados()

  const porId = new Map(opcoes.map((opcao) => [opcao.id, opcao]))
  const partes = partesDoObjeto(opcoes.map((opcao) => opcao.id).filter(ehTipo))
  const escolhida = marcada === null ? undefined : porId.get(marcada)
  const grupoDaEscolhida = marcada !== null && ehTipo(marcada) ? grupoDoObjeto(marcada) : null
  // O grupo do escolhido QUANDO A FICHA ABRIU: escolher outro objeto depois não
  // abre nem fecha grupo nenhum (a lista não pula debaixo do ponteiro).
  const [grupoDePartida] = useState(grupoDaEscolhida)
  /** Gravado vence; nunca mexido, abre só o grupo do objeto escolhido na abertura. */
  const estaAberto = (grupo: IdDoGrupoDeObjeto): boolean => guardados.get(grupo) ?? grupo === grupoDePartida
  const alternar = (grupo: IdDoGrupoDeObjeto) => {
    const aberto = !estaAberto(grupo)
    setGuardados((antes) => new Map(antes).set(grupo, aberto))
    gravarAberto(grupo, aberto)
  }

  const consulta = busca.trim()
  const filtrando = consulta !== ''
  const achados = filtrando ? acharObjetos(itensDaBusca(opcoes), consulta).map((achado) => achado.opcao) : []
  const achadosDaOutra = filtrando && daOutraFerramenta !== undefined ? acharObjetos(itensDaBusca(daOutraFerramenta.opcoes), consulta).map((achado) => achado.opcao) : []
  const opcoesUsadas = usados.flatMap((tipo) => porId.get(tipo) ?? [])

  // "/" de qualquer lugar: o cursor na busca. Só com a ficha à vista e sem
  // diálogo aberto por cima; num campo de texto a barra é texto.
  useEffect(() => {
    const aoTeclar = (evento: globalThis.KeyboardEvent) => {
      if (evento.key !== TECLA_DA_BUSCA || evento.ctrlKey || evento.metaKey || evento.altKey) return
      const alvo = evento.target instanceof HTMLElement ? evento.target : null
      if (alvo !== null && isEditableTarget(alvo.tagName, alvo instanceof HTMLInputElement ? alvo.type : undefined, alvo.isContentEditable)) return
      const entrada = entradaRef.current
      // Sem `offsetParent` o campo está numa página do livro que não está à vista.
      if (entrada === null || entrada.offsetParent === null || document.querySelector('[aria-modal="true"]') !== null) return
      evento.preventDefault()
      entrada.focus()
      entrada.select()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [])

  const focarPrimeiroDaLista = (): boolean => {
    const primeiro = listaRef.current?.querySelector<HTMLElement>('[role="radio"][tabindex="0"], [data-cabeca-do-grupo], [data-da-outra]')
    primeiro?.focus()
    return primeiro !== undefined && primeiro !== null
  }

  const aoTeclarNaBusca = (evento: KeyboardEvent<HTMLInputElement>) => {
    if (evento.key === 'ArrowDown') {
      if (focarPrimeiroDaLista()) consumir(evento)
      return
    }
    if (evento.key === 'Enter') {
      if (evento.nativeEvent.isComposing) return
      const primeiro = achados[0]
      if (primeiro !== undefined) {
        consumir(evento)
        escolher(primeiro.id)
        return
      }
      // Nada neste catálogo: o Enter leva ao primeiro achado da outra ferramenta ("torre" no Objeto).
      const daOutra = achadosDaOutra[0]
      if (daOutra === undefined || daOutraFerramenta === undefined) return
      consumir(evento)
      daOutraFerramenta.escolher(daOutra.id)
      return
    }
    if (evento.key === 'Escape') {
      consumir(evento)
      // Primeiro Esc apaga a busca; o segundo, com o campo vazio, sai dele.
      if (busca !== '') mudarBusca('')
      else evento.currentTarget.blur()
    }
  }

  // Letra com o foco numa opção ou num título: volta à busca com ela (a
  // convenção de digitar para achar); sem isso a letra iria ao mapa e trocaria
  // de ferramenta.
  const aoTeclarNaLista = (evento: KeyboardEvent<HTMLDivElement>) => {
    const alvo = evento.target
    if (!(alvo instanceof HTMLElement) || (alvo.getAttribute('role') !== 'radio' && !alvo.hasAttribute('data-cabeca-do-grupo') && !alvo.hasAttribute('data-da-outra'))) return
    if (evento.key.length !== 1 || evento.key.trim() === '' || evento.ctrlKey || evento.metaKey || evento.altKey) return
    consumir(evento)
    mudarBusca(busca + evento.key)
    entradaRef.current?.focus()
  }

  // Setas nos títulos: de um título ao outro sem abrir nada (Enter e Espaço abrem).
  const aoTeclarNoTitulo = (evento: KeyboardEvent<HTMLButtonElement>) => {
    const titulos = Array.from(listaRef.current?.querySelectorAll<HTMLButtonElement>('[data-cabeca-do-grupo]') ?? [])
    const atual = titulos.indexOf(evento.currentTarget)
    let proximo: HTMLElement | null | undefined
    switch (evento.key) {
      case 'ArrowDown':
        proximo = titulos[Math.min(atual + 1, titulos.length - 1)]
        break
      case 'ArrowUp':
        proximo = atual === 0 ? entradaRef.current : titulos[atual - 1]
        break
      case 'Home':
        proximo = titulos[0]
        break
      case 'End':
        proximo = titulos[titulos.length - 1]
        break
      case 'ArrowLeft':
      case 'ArrowRight':
        proximo = null
        break
      default:
        return
    }
    consumir(evento)
    proximo?.focus()
  }

  const limparBusca = () => {
    mudarBusca('')
    entradaRef.current?.focus()
  }

  const paraOSeg = (lista: readonly OpcaoDoEixo[]) => lista.map((opcao) => ({ valor: opcao.id, rotulo: opcao.label, icone: opcao.icon }))

  return (
    <div className="gr-campo lb-escolha-objeto">
      <span className="gr-campo__rot">
        {rotulo}
        {escolhida !== undefined && <b title={`Próxim${palavra.singular === 'objeto' ? 'o' : 'a'} ${palavra.singular}: ${escolhida.label}`}>{escolhida.label}</b>}
      </span>
      <div className="lb-escolha-objeto__busca">
        <IconeDoLivro nome="busca" />
        <input
          ref={entradaRef}
          className="gr-entrada"
          type="search"
          autoComplete="off"
          spellCheck={false}
          maxLength={40}
          aria-label={`Procurar ${palavra.singular}`}
          aria-keyshortcuts={TECLA_DA_BUSCA}
          aria-controls={`${ids}-lista`}
          placeholder={`Procurar ${palavra.singular}`}
          value={busca}
          onChange={(evento) => mudarBusca(evento.currentTarget.value)}
          onKeyDown={aoTeclarNaBusca}
        />
        {busca === '' ? (
          <kbd className="gr-kbd lb-escolha-objeto__tecla" aria-hidden="true">
            {TECLA_DA_BUSCA}
          </kbd>
        ) : (
          <Botao className="lb-escolha-objeto__limpar" soIcone tamanho="p" aria-label="Limpar busca" title="Limpar busca (Esc)" onClick={limparBusca}>
            <IconeDoLivro nome="x" />
          </Botao>
        )}
      </div>

      <div className="lb-escolha-objeto__lista" id={`${ids}-lista`} ref={listaRef} onKeyDown={aoTeclarNaLista}>
        {filtrando ? (
          <>
            <p className="lb-escolha-objeto__resumo" role="status">
              {achados.length === 0 ? `Nenhum${palavra.singular === 'objeto' ? '' : 'a'} ${palavra.singular} com “${consulta}”.` : contagem(achados.length, palavra)}
              {achadosDaOutra.length > 0 && daOutraFerramenta !== undefined ? ` Em ${daOutraFerramenta.nome}: ${achadosDaOutra.length}.` : ''}
            </p>
            {achados.length > 0 ? (
              <CampoSeg
                nomeAcessivel={`${palavra.plural[0]?.toUpperCase() ?? ''}${palavra.plural.slice(1)} com “${consulta}”`}
                forma="grade"
                opcoes={paraOSeg(achados)}
                valor={marcada ?? undefined}
                onChange={escolher}
              />
            ) : (
              achadosDaOutra.length === 0 && (
                <div className="lb-escolha-objeto__vazio">
                  <span>Tente só o começo do nome, ou o lugar: “cozinha”, “feira”.</span>
                  <Botao variante="fantasma" tamanho="p" onClick={limparBusca}>
                    Limpar busca
                  </Botao>
                </div>
              )
            )}
            {achadosDaOutra.length > 0 && daOutraFerramenta !== undefined && (
              <section className="lb-escolha-objeto__outra" aria-labelledby={`${ids}-outra`}>
                <h3 className="lb-escolha-objeto__legenda" id={`${ids}-outra`}>
                  Em {daOutraFerramenta.nome}
                </h3>
                <ul className="lb-escolha-objeto__outra-lista">
                  {achadosDaOutra.map((opcao) => (
                    <li key={opcao.id}>
                      <button
                        type="button"
                        className="lb-escolha-objeto__outra-linha"
                        data-da-outra=""
                        title={`Abre a ferramenta ${daOutraFerramenta.nome} com ${opcao.label} escolhida`}
                        onClick={() => daOutraFerramenta.escolher(opcao.id)}
                      >
                        {opcao.icon !== undefined && <span className="lb-escolha-objeto__outra-icone" aria-hidden="true">{opcao.icon}</span>}
                        <span>{opcao.label}</span>
                        <small>— em {daOutraFerramenta.nome}</small>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        ) : (
          <>
            {opcoesUsadas.length > 0 && (
              <section className="lb-escolha-objeto__usados" aria-labelledby={`${ids}-usados`}>
                <h3 className="lb-escolha-objeto__legenda" id={`${ids}-usados`}>
                  <IconeDoLivro nome="relogio" />
                  Usados há pouco
                </h3>
                <CampoSeg nomeAcessivel="Usados há pouco" forma="grade" opcoes={paraOSeg(opcoesUsadas)} valor={marcada ?? undefined} onChange={escolher} />
              </section>
            )}
            {partes.map((parte) => {
              const aberto = estaAberto(parte.id)
              const idDoTitulo = `${ids}-${parte.id}`
              const aquiAEscolhida = parte.id === grupoDaEscolhida
              const daParte = parte.tipos.flatMap((tipo) => porId.get(tipo) ?? [])
              return (
                <section key={parte.id} className={classes('lb-escolha-objeto__grupo', !aberto && 'lb-escolha-objeto__grupo--fechado')} aria-labelledby={idDoTitulo}>
                  <h3 className="lb-escolha-objeto__titulo">
                    <button
                      type="button"
                      id={idDoTitulo}
                      className="lb-escolha-objeto__cab"
                      data-cabeca-do-grupo=""
                      aria-expanded={aberto}
                      aria-controls={`${idDoTitulo}-grade`}
                      aria-describedby={`${idDoTitulo}-conta`}
                      onClick={() => alternar(parte.id)}
                      onKeyDown={aoTeclarNoTitulo}
                    >
                      <IconeDoLivro nome="baixo" />
                      <span className="lb-escolha-objeto__nome">{parte.titulo}</span>
                      {/* Fechado, o grupo que guarda o escolhido o diz: o mestre sabe onde ele mora. */}
                      {aquiAEscolhida && !aberto && <span className="lb-escolha-objeto__marca" aria-hidden="true" />}
                      {/* A contagem fica fora do nome (quem procura o grupo pelo título exato acha): vai na descrição. */}
                      <small className="lb-escolha-objeto__conta" aria-hidden="true">
                        {daParte.length}
                      </small>
                    </button>
                  </h3>
                  <span className="gr-sr" id={`${idDoTitulo}-conta`}>
                    {contagem(daParte.length)}
                    {aquiAEscolhida && escolhida !== undefined ? `, com ${escolhida.label} escolhido` : ''}
                  </span>
                  <div className="lb-escolha-objeto__grade" id={`${idDoTitulo}-grade`} hidden={!aberto}>
                    <CampoSeg nomeAcessivel={parte.titulo} forma="grade" opcoes={paraOSeg(daParte)} valor={marcada ?? undefined} onChange={escolher} />
                  </div>
                </section>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
