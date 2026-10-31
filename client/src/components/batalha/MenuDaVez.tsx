import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { AcoesDaVez } from '../../lib/batalha/acoes'
import type { PedidoDeAcao } from '../../lib/batalha/combate'
import type { FormaNoMenu } from '../../lib/batalha/transformacao'
import { pipsDaVez, textoDaCarga, type AlvoNaMira, type GolpeNaTela } from './dadosDoMenu'
import { ListaDeFormas, nomeDaForma } from './ListaDeFormas'
import { CabecaDaVez, ListaDeTecnicas, Tira, andarComSetas, semRolarDeLado } from './ListaDeTecnicas'
import { MiraDoGolpe, pedidoDoGolpe, type ConsultaDaFicha, type EscolhaDaMira } from './MiraDoGolpe'
import './batalha.css'
import './combate.css'

/**
 * O MENU DA VEZ do JOGADOR (o `.menu--principal` do protótipo aprovado):
 * tiras Atacar, Habilidades, Transformação (F3: acende quando a ficha tem
 * forma e abre a `ListaDeFormas`), Concentrar ("Carga 1 · próximo golpe ×1,5") e Encerrar vez; a cabeça com o
 * nome e a economia ("Simples 1 · Bônus 0 · Mov 2/4", Mov vermelho quando
 * passa). Atacar e Habilidades abrem a lista; o golpe escolhido abre a mira.
 *
 * Fora da vez, só com um contra-ataque guardado (Q6): Atacar, Habilidade ou
 * Mover, sem gastar a vez.
 *
 * Teclado (só com o foco dentro do menu): setas andam, Enter ou seta para a
 * direita abrem, Esc volta. Recolhe num botão "Ações" para o mapa ficar livre
 * (o jogador anda arrastando a ficha).
 */

export interface ContraNoMenu {
  golpeId: string
  /** "contra Vera": de qual golpe veio (há como guardar mais de um). */
  rotulo: string
}

export interface MenuDaVezProps {
  quem: string
  /** `null` = fora da vez (só o contra-ataque). */
  acoes: AcoesDaVez | null
  carga: number
  /** Por que o Concentrar está apagado; `null` = pode. */
  motivoDoConcentrar: string | null
  armas: readonly GolpeNaTela[]
  habilidades: readonly GolpeNaTela[]
  alvos: readonly AlvoNaMira[]
  /** "Escolher armas" (limite da ficha). `pendente` = ainda não escolheu. Ausente = sem limite. */
  escolhaDeArmas?: { pendente: boolean; onAbrir: () => void }
  /** Q6: os contra-ataques guardados. Fora da vez, o menu só oferece eles; com mais de um, ele escolhe qual. */
  contras?: readonly ContraNoMenu[]
  /** Os golpes lidos fora da vez (a ação da vez não conta no contra-ataque). Ausente = os mesmos. */
  golpesDoContra?: { armas: readonly GolpeNaTela[]; habilidades: readonly GolpeNaTela[] }
  /** O pedido saiu? (`false` = sem conexão ou recusado na hora.) */
  onAgir: (pedido: PedidoDeAcao) => boolean
  /** "Zerar" a concentração (o botão ao lado da tira Concentrar, só com carga). Não devolve a ação gasta. Ausente = sem o botão. */
  onZerarCarga?: () => boolean
  /** Ausente fora da vez. */
  onEncerrar?: () => boolean
  /** S4: a ficha clicada no mapa enquanto mira. */
  alvoDoMapa?: { tokenId: string; seq: number } | null
  /** S4: liga e desliga o "clicar na ficha escolhe o alvo". */
  onMirando?: (mirando: boolean) => void
  consulta?: ConsultaDaFicha | null
  /** Esperando o host responder um pedido: as tiras ficam paradas. */
  esperando?: boolean
  /** F3: as formas da ficha (`formasNoMenu`). Vazio ou ausente = a tira Transformação apagada. */
  formas?: readonly FormaNoMenu[]
  /** F3: de quem é a ficha (lembra "trocar a imagem" no aparelho). */
  personagemId?: string | null
}

type Tela = { tipo: 'menu' } | { tipo: 'lista'; de: 'atacar' | 'habilidade' } | { tipo: 'mira'; golpe: GolpeNaTela; de: 'atacar' | 'habilidade' } | { tipo: 'formas' }

const SEM_MOTIVO = null
const SEM_CONTRAS: readonly ContraNoMenu[] = []
const SEM_FORMAS: readonly FormaNoMenu[] = []
const SEM_TRANSFORMACAO = 'Nenhuma transformação na ficha'

export function MenuDaVez(props: MenuDaVezProps) {
  const { quem, acoes, carga, motivoDoConcentrar, alvos, escolhaDeArmas, contras = SEM_CONTRAS, golpesDoContra, onAgir, onZerarCarga, onEncerrar, alvoDoMapa, onMirando, consulta, esperando, formas = SEM_FORMAS, personagemId = null } = props
  const [tela, setTela] = useState<Tela>({ tipo: 'menu' })
  const [contraId, setContraId] = useState<string | null>(null)
  const foraDaVez = props.acoes === null
  // Fora da vez com um só guardado, ele já é o escolhido; com mais de um, ele escolhe.
  const contra = contras.find((candidato) => candidato.golpeId === contraId) ?? (foraDaVez && contras.length === 1 ? contras[0] : undefined)
  const modoContra = contra !== undefined
  const armas = modoContra && golpesDoContra !== undefined ? golpesDoContra.armas : props.armas
  const habilidades = modoContra && golpesDoContra !== undefined ? golpesDoContra.habilidades : props.habilidades
  const [recolhido, setRecolhido] = useState(false)
  const [porTeclado, setPorTeclado] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const tiras = useRef<(HTMLButtonElement | null)[]>([])
  const botaoRecolhido = useRef<HTMLButtonElement>(null)
  const [atual, setAtual] = useState(0)

  // A mira liga o "clicar na ficha escolhe o alvo" (S4); sair dela desliga.
  const mirando = tela.tipo === 'mira' && !recolhido
  useEffect(() => {
    onMirando?.(mirando)
  }, [mirando, onMirando])
  useEffect(() => () => onMirando?.(false), [onMirando])

  const pips = acoes === null ? null : pipsDaVez(acoes)
  const textoCarga = textoDaCarga(carga)

  const agir = (pedido: PedidoDeAcao): boolean => {
    // F3: Ativar e Desfazer a forma nunca são contra-ataque.
    const semContra = pedido.tipo === 'concentrar' || pedido.tipo === 'transformar' || pedido.tipo === 'destransformar'
    const comContra: PedidoDeAcao = contra !== undefined && !semContra ? { ...pedido, contraDe: contra.golpeId } : pedido
    const saiu = onAgir(comContra)
    setAviso(saiu ? null : 'Não saiu: sem conexão com o mestre, ou a vez já passou.')
    if (saiu && contra !== undefined) setContraId(null)
    return saiu
  }

  const lancar = (golpe: GolpeNaTela, escolha: EscolhaDaMira): boolean => {
    const saiu = agir(pedidoDoGolpe(golpe, escolha))
    if (saiu) {
      setTela({ tipo: 'menu' })
      setAtual(0)
    }
    return saiu
  }

  const abrir = (proxima: Tela, teclado: boolean) => {
    setPorTeclado(teclado)
    setAviso(null)
    setTela(proxima)
  }

  // Volta o foco à primeira tira quando o menu reaparece (vinda da lista ou da mira).
  useEffect(() => {
    if (tela.tipo === 'menu' && porTeclado) tiras.current[atual]?.focus()
    // `atual` fica de fora de propósito: só a troca de tela devolve o foco.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tela.tipo, porTeclado])

  if (recolhido) {
    return (
      <button
        ref={botaoRecolhido}
        type="button"
        className="bt-vez-recolhido"
        aria-label={`Abrir as ações de ${quem}`}
        onClick={() => {
          setRecolhido(false)
          setPorTeclado(false)
        }}
      >
        Ações <small>{pips === null ? 'contra-ataque' : pips.map((pip) => pip.texto).join(' · ')}</small>
      </button>
    )
  }

  if (tela.tipo === 'lista') {
    const golpes = tela.de === 'atacar' ? armas : habilidades
    return (
      <ListaDeTecnicas
        titulo={tela.de === 'atacar' ? 'Atacar' : 'Habilidades'}
        pips={pips}
        carga={carga}
        golpes={golpes}
        instantaneo={porTeclado}
        armas={tela.de === 'atacar' ? escolhaDeArmas : undefined}
        vazio={tela.de === 'atacar' ? 'Nenhuma arma levada para esta batalha.' : 'Nenhuma habilidade na ficha (nem nas transformações ligadas).'}
        onVoltar={() => abrir({ tipo: 'menu' }, true)}
        onEscolher={(golpe) => abrir({ tipo: 'mira', golpe, de: tela.de }, false)}
      />
    )
  }

  if (tela.tipo === 'formas') {
    return (
      <ListaDeFormas
        pips={pips}
        carga={carga}
        formas={formas}
        acoes={acoes}
        personagemId={personagemId}
        instantaneo={porTeclado}
        esperando={esperando}
        onAgir={agir}
        onFeito={() => {
          setTela({ tipo: 'menu' })
          setAtual(0)
        }}
        onVoltar={() => abrir({ tipo: 'menu' }, true)}
      />
    )
  }

  if (tela.tipo === 'mira') {
    return (
      <div className="bt-vez bt-vez--lista" data-instantaneo="sim">
        <CabecaDaVez quem={quem} pips={pips} carga={carga} />
        <MiraDoGolpe
          key={tela.golpe.chave}
          golpe={tela.golpe}
          carga={carga}
          alvos={alvos}
          alvoDoMapa={alvoDoMapa}
          consulta={consulta}
          contra={modoContra}
          onVoltar={() => abrir({ tipo: 'lista', de: tela.de }, true)}
          onLancar={(escolha) => lancar(tela.golpe, escolha)}
        />
        {aviso !== null && (
          <p className="bt-vez__aviso" role="alert">
            {aviso}
          </p>
        )}
      </div>
    )
  }

  type ItemDoMenu = {
    chave: string
    nome: string
    lado?: string | null
    detalhe?: string | null
    motivo?: string | null
    forma?: boolean
    executar: (teclado: boolean) => void
    /** O botão "Zerar" ao lado da tira (só a Concentrar, com carga). Fica de fora das setas: alcança pelo Tab. */
    zerar?: () => void
  }
  const itens: ItemDoMenu[] = []
  if (contra !== undefined) {
    const de = contra.rotulo
    itens.push({ chave: 'contra-atacar', nome: 'Atacar', detalhe: `Contra-ataque ${de}: sem gastar a vez`, executar: (t) => abrir({ tipo: 'lista', de: 'atacar' }, t) })
    itens.push({ chave: 'contra-habilidade', nome: 'Habilidade', detalhe: `Contra-ataque ${de}: sem gastar a vez`, executar: (t) => abrir({ tipo: 'lista', de: 'habilidade' }, t) })
    itens.push({
      chave: 'contra-mover',
      nome: 'Mover',
      detalhe: 'Gasta o contra-ataque em se mover: depois arraste a ficha no mapa',
      executar: () => {
        agir({ tipo: 'mover', contraDe: contra.golpeId })
      },
    })
    if (!foraDaVez || contras.length > 1)
      itens.push({ chave: 'contra-voltar', nome: 'Guardar para depois', detalhe: foraDaVez ? 'Volta à escolha do contra-ataque' : 'Volta às ações da vez', executar: () => setContraId(null) })
  } else if (foraDaVez) {
    contras.forEach((candidato) =>
      itens.push({ chave: `contra:${candidato.golpeId}`, nome: 'Contra-ataque', lado: null, detalhe: `${candidato.rotulo}: uma ação fora da vez`, executar: () => setContraId(candidato.golpeId) }),
    )
  } else {
    if (contras.length > 0)
      contras.forEach((candidato) =>
        itens.push({ chave: `contra:${candidato.golpeId}`, nome: 'Contra-ataque', detalhe: `Guardado (${candidato.rotulo}): usa sem gastar a vez`, executar: () => setContraId(candidato.golpeId) }),
      )
    itens.push({ chave: 'atacar', nome: 'Atacar', lado: armas.length > 0 && armas[0]?.chave !== 'ataque' ? `${armas.length} ${armas.length === 1 ? 'arma' : 'armas'}` : null, executar: (t) => abrir({ tipo: 'lista', de: 'atacar' }, t) })
    itens.push({ chave: 'habilidades', nome: 'Habilidades', lado: habilidades.length > 0 ? String(habilidades.length) : null, executar: (t) => abrir({ tipo: 'lista', de: 'habilidade' }, t) })
    const ligada = formas.find((forma) => forma.ligada)
    itens.push({
      chave: 'transformacao',
      nome: 'Transformação',
      forma: true,
      lado: ligada !== undefined ? 'ATIVA' : formas.length > 0 ? String(formas.length) : null,
      detalhe: ligada !== undefined ? `Em ${nomeDaForma(ligada)} · desfazer é ação livre` : formas.length === 1 ? nomeDaForma(formas[0] as FormaNoMenu) : null,
      motivo: formas.length === 0 ? SEM_TRANSFORMACAO : SEM_MOTIVO,
      executar: (t) => abrir({ tipo: 'formas' }, t),
    })
    itens.push({
      chave: 'concentrar',
      nome: 'Concentrar',
      lado: textoCarga === null ? null : `Carga ${carga}`,
      detalhe: carga === 0 ? 'Gasta a Simples: o próximo golpe sai ×1,5' : textoCarga,
      motivo: motivoDoConcentrar ?? SEM_MOTIVO,
      executar: () => agir({ tipo: 'concentrar' }),
      // Vale mesmo com o Concentrar apagado ("Já concentrou nesta vez"): zerar não gasta ação.
      zerar:
        onZerarCarga === undefined || carga <= 0
          ? undefined
          : () => setAviso(onZerarCarga() ? null : 'Não zerou: sem conexão com o mestre.'),
    })
    if (onEncerrar !== undefined)
      itens.push({
        chave: 'encerrar',
        nome: 'Encerrar vez',
        detalhe: 'Passa a vez para a próxima carta',
        executar: () => {
          const saiu = onEncerrar()
          setAviso(saiu ? null : 'Não saiu: sem conexão com o mestre.')
        },
      })
  }
  tiras.current.length = itens.length

  const teclar = (evento: KeyboardEvent<HTMLDivElement>) => {
    if (andarComSetas(evento, tiras.current, atual)) return
    if (evento.key === 'ArrowRight') {
      const item = itens[atual]
      if (item !== undefined && !item.motivo) {
        evento.preventDefault()
        item.executar(true)
      }
      return
    }
    if (evento.key === 'Escape') {
      evento.preventDefault()
      evento.stopPropagation()
      setRecolhido(true)
      window.requestAnimationFrame(() => botaoRecolhido.current?.focus())
    }
  }

  return (
    <div className="bt-vez" data-instantaneo={porTeclado ? 'sim' : 'nao'} onKeyDown={teclar} aria-busy={esperando ? true : undefined}>
      <CabecaDaVez quem={modoContra || foraDaVez ? `${quem} · contra-ataque` : quem} pips={pips} carga={carga} />
      <ul className="bt-vez__tiras" aria-label={modoContra || foraDaVez ? 'Contra-ataque' : `Ações de ${quem}`} onScroll={semRolarDeLado}>
        {itens.map((item, indice) => (
          <li key={item.chave} className={item.zerar === undefined ? undefined : 'bt-vez__com-zerar'}>
            <Tira
              indice={indice}
              chave={item.chave}
              nome={item.nome}
              lado={item.lado}
              detalhe={item.detalhe}
              motivo={item.motivo}
              forma={item.forma}
              esta={atual === indice}
              onFoco={() => setAtual(indice)}
              onEscolher={() => {
                if (esperando) return
                item.executar(false)
              }}
              refDaTira={(elemento) => {
                tiras.current[indice] = elemento
              }}
            />
            {item.zerar !== undefined && (
              <button
                type="button"
                className="bt-zerar"
                aria-label={`Zerar a concentração de ${quem} (carga ${carga} para 0; a ação gasta não volta)`}
                title="Volta a carga a 0 (a ação gasta não volta)"
                disabled={esperando}
                onClick={item.zerar}
              >
                Zerar
              </button>
            )}
          </li>
        ))}
      </ul>
      {aviso !== null && (
        <p className="bt-vez__aviso" role="alert">
          {aviso}
        </p>
      )}
      <p className="bt-vez__dica">
        <kbd>↑</kbd> <kbd>↓</kbd> escolhe · <kbd>Enter</kbd> abre · <kbd>Esc</kbd> recolhe · arraste a ficha para andar
      </p>
      <div className="bt-vez__rodape">
        <button type="button" className="bt-botao bt-botao--p" onClick={() => setRecolhido(true)}>
          Recolher
        </button>
      </div>
    </div>
  )
}
