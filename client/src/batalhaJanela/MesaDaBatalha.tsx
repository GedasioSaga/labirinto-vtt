import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as TeclaDoReact, type ReactNode, type RefObject } from 'react'
import { MenuDaCarta, type ItemDoMenuDaCarta } from '../components/batalha/MenuDaCarta'
import { iniciais } from '../components/FichaPecas'
import type { AjusteDoGolpe, AlvoNoEspelho, CartaNoEspelho, ContraNoEspelho, EspelhoDaBatalha, GolpeNoEspelho, ItemDaCartaNoEspelho, PedidoDaMesa, PendenteNoEspelho, RecursoNoEspelho, RespostaDaMesa, VezNoEspelho } from './tipos'
import './mesaDaBatalha.css'

/**
 * A TELA DA MESA DA BATALHA (protótipo aprovado em 19/11/2026,
 * docs/design/mesa-da-batalha/prototipo.html), a mesma encostada na direita do
 * mapa do app e na janela à parte. Lê só o espelho e manda pedidos (`enviar`);
 * não sabe de store nem de fio.
 *
 * UMA coluna: a ordem de cima a baixo, e a carta de quem tem a vez aberta no
 * lugar dela, com tudo o que é da vez dentro (o golpe, o alvo, a reação que
 * espera, o contra-ataque). O pé tem a última linha, o Desfazer, o Registro e
 * um Passar a vez só, travado com o motivo enquanto falta reação ou
 * contra-ataque (o "Seguir sem esperar" fica). O resto mora no "Mais". Larga
 * (a janela à parte), a mesma lista vira duas colunas.
 */

/** Um item de quem monta a mesa, no fim do "Mais" (Abrir em outra janela, Trazer para o app). */
export interface ItemDoMenuDaMesa {
  chave: string
  rotulo: string
  onEscolher: () => void
}

export interface MesaDaBatalhaProps {
  espelho: EspelhoDaBatalha | null
  enviar: (pedido: PedidoDaMesa) => Promise<RespostaDaMesa>
  /** Onde a mesa está: encostada no mapa do app ou na janela à parte (muda só as frases). */
  lugar: 'doca' | 'janela'
  itensDoLugar?: readonly ItemDoMenuDaMesa[]
  /** Presente = a fonte sumiu (a janela sem a principal): a frase no alto e tudo desligado. */
  semFonte?: string | null
  /** Ctrl+Z vale na página inteira (a janela à parte); sem isto, só com o foco dentro da mesa. */
  teclasNaPagina?: boolean
}

const NOME_DO_SISTEMA = { op: 'One Piece', dbt: 'Dragon Ball' } as const

function emCampoDeTexto(alvo: EventTarget | null): boolean {
  if (!(alvo instanceof HTMLElement)) return false
  return alvo.isContentEditable || alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.tagName === 'SELECT'
}

/** "0:08", "3:12": o tempo desde `desde`. */
function relogio(desde: number, agora: number): string {
  const segundos = Math.max(0, Math.floor((agora - desde) / 1000))
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`
}

/** O relógio da tela, de segundo em segundo, só enquanto alguém espera. */
function useAgora(ligado: boolean): number {
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    if (!ligado) return
    setAgora(Date.now())
    const id = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [ligado])
  return agora
}

function Relogio({ desde, agora, rotulo }: { desde: number; agora: number; rotulo: string }) {
  return (
    <span className="mb-relogio" role="timer" aria-label={`${rotulo}: ${relogio(desde, agora)}`}>
      {relogio(desde, agora)}
    </span>
  )
}

/** A ordem andando (a vez passou, a carta abriu em outro lugar): cada linha desliza de onde estava, sem pular. */
const FLIP_MS = 220
const FLIP_CURVA = 'cubic-bezier(0.77, 0, 0.175, 1)'

/**
 * FLIP das linhas da ordem: mede onde cada `[data-flip]` estava antes da
 * mudança (`assinatura`), põe de volta lá com `transform` e solta até o lugar
 * novo. Só `transform`; com movimento reduzido, a ordem troca na hora.
 */
function useOrdemQueDesliza(lista: RefObject<HTMLOListElement | null>, assinatura: string): void {
  const antes = useRef<Map<string, { x: number; y: number }> | null>(null)
  useLayoutEffect(() => {
    const ol = lista.current
    if (ol === null) return
    const base = ol.getBoundingClientRect()
    const agora = new Map<string, { x: number; y: number }>()
    const itens = [...ol.querySelectorAll<HTMLElement>(':scope > [data-flip]')]
    for (const item of itens) {
      item.style.transition = ''
      item.style.transform = ''
    }
    for (const item of itens) {
      const caixa = item.getBoundingClientRect()
      agora.set(item.dataset.flip ?? '', { x: caixa.left - base.left, y: caixa.top - base.top })
    }
    const anteriores = antes.current
    antes.current = agora
    if (anteriores === null || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const movidos: HTMLElement[] = []
    for (const item of itens) {
      const de = anteriores.get(item.dataset.flip ?? '')
      const para = agora.get(item.dataset.flip ?? '')
      if (de === undefined || para === undefined) continue
      const dx = de.x - para.x
      const dy = de.y - para.y
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue
      item.style.transition = 'none'
      item.style.transform = `translate(${dx}px, ${dy}px)`
      movidos.push(item)
    }
    if (movidos.length === 0) return
    const quadro = requestAnimationFrame(() => {
      for (const item of movidos) {
        item.style.transition = `transform ${FLIP_MS}ms ${FLIP_CURVA}`
        item.style.transform = ''
      }
    })
    return () => cancelAnimationFrame(quadro)
  }, [lista, assinatura])
}

const parteDe = (recurso: RecursoNoEspelho) => (recurso.maximo <= 0 ? 0 : Math.max(0, Math.min(1, recurso.atual / recurso.maximo)))

function Avatar({ nome, cor, grande = false }: { nome: string; cor: string | null; grande?: boolean }) {
  const estilo = cor === null ? undefined : ({ '--mb-lado': cor } as CSSProperties)
  return (
    <span className={grande ? 'mb-av mb-av--g' : 'mb-av'} style={estilo} aria-hidden="true">
      {iniciais(nome)}
    </span>
  )
}

/** A barra grande do cartão da vez: rótulo, trilho e "300/300". */
function Barra({ recurso }: { recurso: RecursoNoEspelho }) {
  return (
    <div className="mb-barra" data-tom={recurso.tom}>
      <span className="mb-barra__rot">{recurso.rotulo}</span>
      <span className="mb-barra__trilho" aria-hidden="true">
        <span className="mb-barra__cheio" style={{ transform: `scaleX(${parteDe(recurso)})` }} />
      </span>
      <span className="mb-barra__num">
        {recurso.atual}
        <small>/{recurso.maximo}</small>
      </span>
    </div>
  )
}

/** As barrinhas da linha da ordem (as duas primeiras: HP e SP, PV e Ki). */
function Mini({ recursos }: { recursos: readonly RecursoNoEspelho[] }) {
  const duas = recursos.slice(0, 2)
  if (duas.length === 0) return <span className="mb-mini" />
  return (
    <span className="mb-mini">
      {duas.map((recurso) => (
        <span key={recurso.rotulo} className="mb-mini__par" data-tom={recurso.tom} aria-hidden="true">
          <i>
            <span style={{ transform: `scaleX(${parteDe(recurso)})` }} />
          </i>
          <em>{recurso.atual}</em>
        </span>
      ))}
      <span className="mb-sr">{duas.map((recurso) => `${recurso.rotulo} ${recurso.atual} de ${recurso.maximo}`).join(', ')}</span>
    </span>
  )
}

function subDaCarta(carta: CartaNoEspelho): string {
  return [carta.npc ? 'NPC' : 'Jogador', carta.lado, carta.iniciativa === null ? null : `iniciativa ${carta.iniciativa}`, carta.caiu ? 'caiu' : carta.agiu ? 'já agiu' : null].filter(Boolean).join(' · ')
}

/** A setinha do "abre um menu" (a mesma do Mais). */
function Seta() {
  return (
    <svg className="mb-seta" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <path d="M2 3.5l3 3 3-3" />
    </svg>
  )
}

/** O que abre o menu da carta: o nome dela, na linha da ordem e no cartão da vez. `null` = carta sem menu. */
interface MenuDaLinha {
  aberto: boolean
  onAbrir: (ancora: HTMLElement) => void
}

function LinhaDaOrdem({ carta, etiqueta, darVezDesligado, onDarVez, menu }: { carta: CartaNoEspelho; etiqueta: { texto: string; tom: 'neutro' | 'reage' | 'contra' } | null; darVezDesligado: boolean; onDarVez: () => void; menu: MenuDaLinha | null }) {
  const quem = (
    <>
      <span>
        <b>{carta.nome}</b>
        {menu !== null && <Seta />}
        {etiqueta !== null && (
          <span className="mb-tag" data-tom={etiqueta.tom}>
            {etiqueta.texto}
          </span>
        )}
      </span>
      <small>{subDaCarta(carta)}</small>
      {carta.marcas.length > 0 && <small className="mb-linha__marcas">{carta.marcas.join(', ')}</small>}
    </>
  )
  return (
    <li className="mb-linha" data-flip={carta.id} data-agiu={carta.agiu ? 'sim' : undefined} data-caiu={carta.caiu ? 'sim' : undefined}>
      <span className="mb-linha__num" aria-hidden="true">
        {carta.posicao}
      </span>
      <Avatar nome={carta.nome} cor={carta.cor} />
      {menu === null ? (
        <span className="mb-linha__quem">{quem}</span>
      ) : (
        // O nome abre o menu da carta (o mesmo da faixa do mestre): agir de novo, ajustar, selo, tirar da batalha…
        <button type="button" className="mb-linha__quem" aria-haspopup="menu" aria-expanded={menu.aberto} title={`Menu de ${carta.nome}`} onClick={(evento) => menu.onAbrir(evento.currentTarget)}>
          {quem}
          <span className="mb-sr">: menu da carta</span>
        </button>
      )}
      <Mini recursos={carta.recursos} />
      <button type="button" className="mb-bt mb-bt--p mb-linha__dar" disabled={darVezDesligado} onClick={onDarVez} aria-label={`Dar a vez a ${carta.nome}`}>
        Dar a vez
      </button>
    </li>
  )
}

/** A régua do d20 da reação, com os números deste golpe; `rolou` marca onde o dado caiu. Só aparece enquanto há reação. */
function Regua({ danos, rolou }: { danos: { critico: number; cheio: number; metade: number }; rolou: { d20: number; total: number } | null }) {
  const zona = (n: number) => (n === 1 ? 'c' : n >= 20 ? 'k' : n >= 15 ? 'e' : n >= 10 ? 'd' : 't')
  const casa = rolou === null ? null : rolou.d20 === 1 ? 1 : Math.max(1, Math.min(20, rolou.total))
  const zonaDoDado = casa === null ? null : zona(casa)
  const casas = Array.from({ length: 20 }, (_, indice) => indice + 1)
  const descricao = `Reação no d20. 1 natural: crítico, toma ${danos.critico}. Até 9: toma ${danos.cheio}. 10 ou mais: defende, toma ${danos.metade}. 15 ou mais: esquiva. 20 ou mais: contra-ataca.${rolou === null ? '' : ` Saiu ${rolou.d20}, total ${rolou.total}.`}`
  return (
    <div className="mb-regua" data-fim={zonaDoDado === null ? undefined : 'sim'} role="img" aria-label={descricao}>
      <div className="mb-regua__nums" aria-hidden="true">
        {casas.map((n) => (
          <span key={n}>{n === 1 || n === 10 || n === 15 || n === 20 ? n : ''}</span>
        ))}
      </div>
      <div className="mb-regua__trilho" aria-hidden="true">
        {casas.map((n) => (
          <i key={n} data-z={zona(n)} data-on={zonaDoDado === zona(n) ? 'sim' : undefined} data-marca={casa === n ? 'sim' : undefined}>
            {casa === n ? (rolou?.total ?? n) : ''}
          </i>
        ))}
      </div>
      <div className="mb-regua__zonas" aria-hidden="true">
        <span style={{ gridColumn: '2 / 10' }} data-on={zonaDoDado === 't' ? 'sim' : undefined}>
          <b>toma {danos.cheio}</b>2 a 9
        </span>
        <span style={{ gridColumn: '10 / 15' }} data-on={zonaDoDado === 'd' ? 'sim' : undefined}>
          <b>defende: {danos.metade}</b>10 ou mais
        </span>
        <span style={{ gridColumn: '15 / 20' }} data-on={zonaDoDado === 'e' ? 'sim' : undefined}>
          <b>esquiva</b>15 ou mais
        </span>
      </div>
      <div className="mb-regua__pontas" aria-hidden="true">
        <span data-on={zonaDoDado === 'c' ? 'sim' : undefined}>1 é crítico: toma {danos.critico}</span>
        <span data-on={zonaDoDado === 'k' ? 'sim' : undefined}>20 contra-ataca</span>
      </div>
    </div>
  )
}

function alvosDoGolpe(golpe: GolpeNoEspelho | null, alvos: readonly AlvoNoEspelho[]): AlvoNoEspelho[] {
  if (golpe === null || golpe.alvo === 'nenhum') return []
  const permitidos = golpe.alvosPermitidos === null ? null : new Set(golpe.alvosPermitidos)
  return alvos.filter((alvo) => alvo.motivo === null && (permitidos === null || permitidos.has(alvo.id)))
}

const lancavel = (golpe: GolpeNoEspelho) => golpe.motivo === null && golpe.noMapa === null
const escolhivel = (golpe: GolpeNoEspelho) => golpe.motivo === null

interface EscolhaProps {
  /** A identidade da escolha (a vez, ou o contra): trocou, a escolha recomeça. */
  chave: string
  golpes: readonly GolpeNoEspelho[]
  alvos: readonly AlvoNoEspelho[]
  sugestao: { golpe: string | null; alvo: string | null }
  verbo: 'Lançar' | 'Contra-atacar com'
  ocupado: boolean
  desligado: boolean
  onLancar: (golpe: GolpeNoEspelho, alvos: readonly string[], ajuste: AjusteDoGolpe | undefined) => void
  /** Presente = o golpe que pede escolha a mais pode abrir o menu da vez sobre o mapa. */
  menuDoMapa?: { aberto: boolean; onAlternar: () => void }
}

/** O golpe e o alvo da vez do NPC (e do contra-ataque dele): a lista, os alvos em duas colunas, o ajuste do dano e o Lançar. */
function EscolhaDoGolpe({ chave, golpes, alvos, sugestao, verbo, ocupado, desligado, onLancar, menuDoMapa }: EscolhaProps) {
  const idDoAjuste = useId()
  const [escolhido, setEscolhido] = useState<string | null>(() => {
    const sugerido = golpes.find((golpe) => golpe.chave === sugestao.golpe && lancavel(golpe))
    // Sem sugestão (o contra-ataque), o primeiro golpe que sai daqui e faz dano; a cura e o buff ficam para a escolha.
    return (sugerido ?? golpes.find((golpe) => lancavel(golpe) && (golpe.dano ?? 0) > 0) ?? golpes.find(lancavel) ?? golpes.find(escolhivel))?.chave ?? null
  })
  const [marcados, setMarcados] = useState<readonly string[]>(() => (sugestao.alvo === null ? [] : [sugestao.alvo]))
  const [todos, setTodos] = useState(false)
  const [ajusteAberto, setAjusteAberto] = useState(false)
  const [dano, setDano] = useState<number | null>(null)
  const [surpresa, setSurpresa] = useState(false)
  const [perfurante, setPerfurante] = useState<boolean | null>(null)
  const [verApagados, setVerApagados] = useState(false)

  const golpe = golpes.find((candidato) => candidato.chave === escolhido) ?? null
  const possiveis = useMemo(() => alvosDoGolpe(golpe, alvos), [golpe, alvos])
  const doOutroLado = possiveis.filter((alvo) => alvo.lado === 'outro')
  const escondidos = possiveis.length - doOutroLado.length
  const naLista = todos || doOutroLado.length === 0 ? possiveis : doOutroLado
  // Trocar de ação deixa só os alvos que ainda valem (e no máximo o teto dela).
  const validos = marcados.filter((id) => possiveis.some((alvo) => alvo.id === id)).slice(0, Math.max(golpe?.alvosMax ?? 0, 0))
  const umSo = golpe?.alvo === 'um'
  const nada = golpes.length > 0 && golpes.every((candidato) => !escolhivel(candidato))

  const alternar = (id: string) => {
    if (umSo) {
      setMarcados([id])
      return
    }
    setMarcados(validos.includes(id) ? validos.filter((outro) => outro !== id) : [...validos, id])
  }

  const faltaAlvo = golpe !== null && golpe.alvo !== 'nenhum' && validos.length === 0
  const podeLancar = golpe !== null && lancavel(golpe) && !faltaAlvo && !desligado && !ocupado
  const porQueNao = golpe === null ? 'Escolha um golpe.' : (golpe.motivo ?? golpe.noMapa ?? (faltaAlvo ? (possiveis.length === 0 ? 'Ninguém pode ser alvo deste golpe agora.' : 'Escolha o alvo.') : null))
  const ajustavel = golpe !== null && golpe.ajustavel && lancavel(golpe)
  const danoBase = dano ?? golpe?.dano ?? 0
  const perfuranteAgora = perfurante ?? golpe?.perfurante ?? false
  const ajuste: AjusteDoGolpe | undefined = ajustavel && (dano !== null || surpresa || perfurante !== null) ? { dano, surpresa, perfurante: perfuranteAgora } : undefined
  const nomeDoAlvo = validos.length === 1 ? (alvos.find((alvo) => alvo.id === validos[0])?.nome ?? null) : validos.length > 1 ? `${validos.length} alvos` : null
  const marcasDoAjuste = [surpresa ? 'surpresa' : null, perfuranteAgora && golpe?.perfurante !== true ? 'perfurante' : null, !perfuranteAgora && golpe?.perfurante === true ? 'sem perfurar' : null].filter(Boolean).join(', ')

  const lancar = () => {
    if (podeLancar && golpe !== null) onLancar(golpe, golpe.alvo === 'nenhum' ? [] : validos, ajuste)
  }
  // Enter numa opção (golpe ou alvo) lança: o atalho do protótipo, só com o foco na escolha.
  const teclas = (evento: TeclaDoReact<HTMLDivElement>) => {
    if (evento.key !== 'Enter' || evento.ctrlKey || evento.metaKey || evento.altKey || evento.shiftKey) return
    const alvo = evento.target
    if (alvo instanceof HTMLInputElement && (alvo.type === 'radio' || alvo.type === 'checkbox') && alvo.closest('[data-escolha]') !== null) {
      evento.preventDefault()
      lancar()
    }
  }

  if (nada && !verApagados) {
    return (
      <div className="mb-escolha">
        <p className="mb-nota">
          Nada mais para lançar nesta vez: {golpes[0]?.motivo ?? 'as ações acabaram'}.{' '}
          <button type="button" className="mb-elo" onClick={() => setVerApagados(true)}>
            Ver as ações
          </button>
        </p>
      </div>
    )
  }

  return (
    <div className="mb-escolha" onKeyDown={teclas}>
      <fieldset className="mb-grupo" data-escolha disabled={desligado}>
        <legend>Golpe</legend>
        {golpes.map((item) => {
          const apagado = !escolhivel(item)
          return (
            <label key={item.chave} className="mb-op" data-apagado={apagado ? 'sim' : undefined} data-mapa={item.noMapa !== null ? 'sim' : undefined}>
              <input type="radio" name={`mb-golpe-${chave}`} checked={escolhido === item.chave} disabled={apagado} onChange={() => setEscolhido(item.chave)} />
              <span className="mb-op__nome">
                {item.nome}
                {sugestao.golpe === item.chave && <span className="mb-sug">sugestão</span>}
              </span>
              <span className="mb-op__lado">{item.dano === null ? item.detalhe.split(' · ')[0] : `dano ${item.dano}`}</span>
              {(item.motivo ?? item.noMapa) !== null && <span className="mb-op__porque">{item.motivo ?? item.noMapa}</span>}
            </label>
          )
        })}
      </fieldset>
      {golpe !== null && golpe.alvo !== 'nenhum' && (
        <fieldset className="mb-grupo" data-escolha disabled={desligado || golpe.noMapa !== null}>
          <legend>
            <span>{umSo ? 'Alvo' : `Alvos${golpe.alvosMax < 24 ? ` (até ${golpe.alvosMax})` : ''}`}</span>
            {escondidos > 0 && doOutroLado.length > 0 && (
              <button type="button" className="mb-elo" aria-pressed={todos} onClick={() => setTodos((antes) => !antes)}>
                {todos ? 'Só o outro lado' : `Mostrar todos (+${escondidos})`}
              </button>
            )}
          </legend>
          {naLista.length === 0 ? (
            <p className="mb-nota">Ninguém pode ser alvo deste golpe agora.</p>
          ) : (
            <div className="mb-alvos">
              {naLista.map((alvo) => (
                <label key={alvo.id} className="mb-op mb-op--alvo" data-caiu={alvo.caiu ? 'sim' : undefined}>
                  <input type={umSo ? 'radio' : 'checkbox'} name={`mb-alvo-${chave}`} checked={validos.includes(alvo.id)} onChange={() => alternar(alvo.id)} />
                  <Avatar nome={alvo.nome} cor={null} />
                  <span className="mb-op__alvo">
                    <span className="mb-op__nome">{alvo.nome}</span>
                    <small>{[alvo.lado === 'eu' ? 'ele mesmo' : alvo.lado === 'aliado' ? 'aliado' : null, alvo.caiu ? 'caiu' : null, alvo.detalhe].filter(Boolean).join(' · ') || 'outro lado'}</small>
                  </span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
      )}
      {ajustavel && ajusteAberto && (
        <div className="mb-ajuste" id={idDoAjuste}>
          <label>
            Dano base
            <input
              type="number"
              min={0}
              step={5}
              value={danoBase}
              onChange={(evento) => {
                const valor = Number(evento.target.value)
                setDano(Number.isFinite(valor) && valor >= 0 ? Math.round(valor) : null)
              }}
            />
          </label>
          <label>
            <input type="checkbox" checked={surpresa} onChange={(evento) => setSurpresa(evento.target.checked)} /> Surpresa <small>×1,5 e sem reação</small>
          </label>
          <label>
            <input type="checkbox" checked={perfuranteAgora} onChange={(evento) => setPerfurante(evento.target.checked)} /> Perfurante <small>direto no HP, sem gastar o Escudo</small>
          </label>
        </div>
      )}
      <div className="mb-lancar">
        {golpe !== null && golpe.noMapa !== null && menuDoMapa !== undefined ? (
          <button type="button" className="mb-bt mb-bt--alto" aria-pressed={menuDoMapa.aberto} onClick={menuDoMapa.onAlternar} disabled={desligado}>
            {menuDoMapa.aberto ? 'Fechar o menu no mapa' : 'Usar pelo menu no mapa'}
          </button>
        ) : (
          <button type="button" className="mb-bt mb-bt--alto mb-bt--golpe" disabled={!podeLancar} onClick={lancar}>
            <span>{ocupado ? 'Lançando…' : golpe === null ? verbo.replace(' com', '') : `${verbo} ${golpe.nome}${nomeDoAlvo === null || verbo !== 'Lançar' ? '' : ` em ${nomeDoAlvo}`}`}</span>
            <kbd aria-hidden="true">Enter</kbd>
          </button>
        )}
        {ajustavel && (
          <button type="button" className="mb-bt mb-bt--alto" aria-expanded={ajusteAberto} aria-controls={ajusteAberto ? idDoAjuste : undefined} onClick={() => setAjusteAberto((antes) => !antes)}>
            Dano <b>{danoBase}</b>
            {marcasDoAjuste !== '' && <small>{marcasDoAjuste}</small>}
          </button>
        )}
        {porQueNao !== null && !podeLancar && <p className="mb-lancar__porque">{porQueNao}</p>}
      </div>
    </div>
  )
}

/** A troca que espera: o golpe lançado, quem reage (com o tempo), a régua do d20 e as respostas do mestre. */
function TrocaDaReacao({ item, agora, ocupado, desligado, onResponder }: { item: PendenteNoEspelho; agora: number; ocupado: boolean; desligado: boolean; onResponder: (chave: string) => void }) {
  const golpe = item.golpe
  const quem = golpe?.alvo ?? item.quem
  return (
    <div className="mb-troca" data-entra>
      {golpe !== null ? (
        <p className="mb-troca__golpe">
          <span>
            <b>{golpe.nome}</b> de {golpe.de} em {golpe.alvo}
          </span>
          {golpe.chega !== null && <span>chega {golpe.chega}</span>}
        </p>
      ) : (
        <p className="mb-troca__golpe">
          <span>
            <b>{item.titulo}</b>
          </span>
        </p>
      )}
      <div className="mb-espera">
        <p>{item.doMestre ? (golpe !== null ? `A reação de ${quem} é sua` : 'A resposta é sua') : golpe !== null ? `Esperando ${quem} reagir` : `Esperando ${item.quem}`}</p>
        {!item.doMestre && item.desde !== null && <Relogio desde={item.desde} agora={agora} rotulo="Tempo de espera" />}
      </div>
      {golpe?.rolou != null && (
        <p className="mb-troca__dado">
          <span className="mb-dado" data-pop>
            {golpe.rolou.d20}
          </span>
          Saiu {golpe.rolou.d20}, total {golpe.rolou.total}.
        </p>
      )}
      {item.nota !== null && <p className="mb-nota">{item.nota}</p>}
      {golpe?.danos != null && <Regua danos={golpe.danos} rolou={golpe.rolou} />}
      {item.respostas.length > 0 && (
        <div className="mb-troca__acoes">
          {item.respostas.map((resposta, indice) => (
            <button
              key={resposta.chave}
              type="button"
              className={indice === 0 && item.doMestre ? 'mb-bt' : 'mb-bt mb-bt--fantasma'}
              disabled={ocupado || desligado || resposta.bloqueio !== null}
              title={resposta.bloqueio ?? undefined}
              onClick={() => onResponder(resposta.chave)}
            >
              {resposta.rotulo}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** O que espera e ficou para depois (o "Seguir sem esperar" ou a fila do Dragon Ball): uma linha por pedido, com as respostas. */
function AindaEsperando({ itens, agora, ocupado, desligado, onResponder, titulo }: { itens: readonly PendenteNoEspelho[]; agora: number; ocupado: boolean; desligado: boolean; onResponder: (item: PendenteNoEspelho, chave: string) => void; titulo: string }) {
  if (itens.length === 0) return null
  return (
    <section className="mb-ainda" aria-label={titulo}>
      <h3>{titulo}</h3>
      <ul>
        {itens.map((item) => (
          <li key={item.id}>
            <span>
              {item.titulo}
              <small>
                {item.quem}
                {item.desde !== null && ` · ${relogio(item.desde, agora)}`}
              </small>
            </span>
            {item.ativa &&
              item.respostas.map((resposta) => (
                <button key={resposta.chave} type="button" className="mb-bt mb-bt--p mb-bt--fantasma" disabled={ocupado || desligado || resposta.bloqueio !== null} title={resposta.bloqueio ?? undefined} onClick={() => onResponder(item, resposta.chave)}>
                  {resposta.rotulo}
                </button>
              ))}
          </li>
        ))}
      </ul>
    </section>
  )
}

interface ContraProps {
  contra: ContraNoEspelho
  agora: number
  ocupado: boolean
  desligado: boolean
  menuDoMapa?: { aberto: boolean; onAlternar: () => void }
  onContra: (golpe: GolpeNoEspelho, alvos: readonly string[], ajuste: AjusteDoGolpe | undefined) => void
  onAbrirMao: () => void
}

/** O contra-ataque: a única hora em que a ação não é de quem tem a vez. Quem tirou 20 escolhe o golpe; depois a vez volta. */
function TrocaDoContra({ contra, agora, ocupado, desligado, menuDoMapa, onContra, onAbrirMao }: ContraProps) {
  return (
    <div className="mb-troca" data-contra data-entra>
      <ol className="mb-trilha" aria-label="Ordem desta troca">
        <li data-e="feito">1. {contra.de} atacou</li>
        <li data-e="agora" aria-current="step">
          2. {contra.quem} contra-ataca
        </li>
        <li data-e="depois">3. Volta para {contra.de}</li>
      </ol>
      <h3 className="mb-contra__titulo">Contra-ataque</h3>
      <div className="mb-contra__quem">
        <Avatar nome={contra.quem} cor={null} grande />
        <b>{contra.doMestre ? `${contra.quem} age agora` : `${contra.quem} escolhe o golpe`}</b>
        <span className="mb-dado" data-pop aria-label="Tirou 20 na reação">
          20
        </span>
      </div>
      {contra.doMestre ? (
        <>
          <EscolhaDoGolpe
            key={contra.golpeId}
            chave={`contra-${contra.golpeId}`}
            golpes={contra.golpes}
            alvos={contra.alvos}
            sugestao={{ golpe: null, alvo: contra.alvoSugerido }}
            verbo="Contra-atacar com"
            ocupado={ocupado}
            desligado={desligado}
            onLancar={onContra}
            menuDoMapa={menuDoMapa}
          />
          <div className="mb-troca__acoes">
            <button type="button" className="mb-bt mb-bt--fantasma" disabled={ocupado || desligado} onClick={onAbrirMao} title="O contra-ataque vira o movimento: arraste a ficha no mapa, se quiser.">
              Abrir mão (mover)
            </button>
          </div>
        </>
      ) : (
        <div className="mb-espera">
          <p className="mb-nota">A escolha do golpe é na tela do jogador. Depois a vez volta para {contra.de}.</p>
          {contra.desde !== null && <Relogio desde={contra.desde} agora={agora} rotulo="Tempo de espera" />}
        </div>
      )}
    </div>
  )
}

interface ItemDoMais {
  chave: string
  rotulo: string
  perigo?: boolean
  desligado?: string | null
  /** Chave de ligar e desligar (a câmera, o som): `true` = ligada. Ausente = item de ação. */
  marcado?: boolean
  /** O estado escrito à direita da chave ("sim", "mudo"). */
  estado?: string
  onEscolher: () => void
}

/** O menu "Mais": setas, Home e End andam; Esc fecha e devolve o foco ao botão. */
function MenuMais({ itens, peloTeclado, onFechar }: { itens: readonly (ItemDoMais | 'separador')[]; peloTeclado: boolean; onFechar: (devolverFoco: boolean) => void }) {
  const raiz = useRef<HTMLDivElement>(null)
  useEffect(() => {
    raiz.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
    const fora = (evento: PointerEvent) => {
      const alvo = evento.target
      if (alvo instanceof Node && raiz.current !== null && !raiz.current.contains(alvo) && !(alvo instanceof Element && alvo.closest('[data-mais]') !== null)) onFechar(false)
    }
    document.addEventListener('pointerdown', fora)
    return () => document.removeEventListener('pointerdown', fora)
  }, [onFechar])
  const teclas = (evento: TeclaDoReact<HTMLDivElement>) => {
    const botoes = [...(raiz.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])]
    const indice = botoes.indexOf(document.activeElement as HTMLButtonElement)
    const ir = { ArrowDown: (indice + 1) % botoes.length, ArrowUp: (indice - 1 + botoes.length) % botoes.length, Home: 0, End: botoes.length - 1 }[evento.key]
    if (ir !== undefined) {
      evento.preventDefault()
      botoes[ir]?.focus()
      return
    }
    if (evento.key === 'Escape') {
      evento.preventDefault()
      evento.stopPropagation()
      onFechar(true)
      return
    }
    if (evento.key === 'Tab') onFechar(false)
  }
  return (
    <div className="mb-menu" role="menu" aria-label="Mais ações da batalha" ref={raiz} onKeyDown={teclas} data-teclado={peloTeclado ? 'sim' : undefined}>
      {itens.map((item, indice) =>
        item === 'separador' ? (
          <div key={`sep-${indice}`} role="separator" />
        ) : (
          <button
            key={item.chave}
            type="button"
            role={item.marcado === undefined ? 'menuitem' : 'menuitemcheckbox'}
            aria-checked={item.marcado}
            className={item.perigo ? 'mb-menu__perigo' : undefined}
            disabled={item.desligado != null}
            title={item.desligado ?? undefined}
            onClick={() => {
              onFechar(false)
              item.onEscolher()
            }}
          >
            {item.rotulo}
            {item.estado !== undefined && (
              <span className="mb-menu__estado" aria-hidden="true">
                {item.estado}
              </span>
            )}
          </button>
        ),
      )}
    </div>
  )
}

/**
 * A frase do status depois de um item do menu da carta. O que abre janela abre na principal: na doca ela
 * aparece por cima e não precisa de frase; na janela à parte, a frase diz onde ela está.
 */
function feitoDoItem(item: ItemDaCartaNoEspelho, nome: string, lugar: 'doca' | 'janela'): string | null {
  const rotulo = item.rotulo.replace(/…$/, '')
  if (item.abreNoApp) return lugar === 'janela' ? `${rotulo} (${nome}): abriu na janela principal do app.` : null
  return `${nome}: ${rotulo}.`
}

/** A etiqueta da linha da ordem: quem reage, quem contra-ataca, quem vem a seguir. */
function etiquetaDe(carta: CartaNoEspelho, reagindo: ReadonlySet<string>, contraQuem: string | null): { texto: string; tom: 'neutro' | 'reage' | 'contra' } | null {
  if (contraQuem !== null && carta.nome === contraQuem) return { texto: 'contra-ataca agora', tom: 'contra' }
  if (reagindo.has(carta.nome)) return { texto: 'reagindo', tom: 'reage' }
  if (carta.proxima) return { texto: 'a seguir', tom: 'neutro' }
  return null
}

interface CartaoProps {
  carta: CartaNoEspelho | undefined
  vez: VezNoEspelho
  emEspera: boolean
  menu: MenuDaLinha | null
  children: ReactNode
}

/** A carta de quem tem a vez, aberta no lugar dela na ordem. */
function CartaoDaVez({ carta, vez, emEspera, menu, children }: CartaoProps) {
  return (
    <li className="mb-cartao" data-flip={carta?.id} aria-current="step" data-espera={emEspera ? 'sim' : undefined}>
      <span className="mb-fita">{emEspera ? 'Vez · em espera' : 'Vez'}</span>
      <div className="mb-cab">
        <Avatar nome={vez.quem} cor={carta?.cor ?? null} grande />
        <div>
          <h2>
            {menu === null ? (
              vez.quem
            ) : (
              <button type="button" className="mb-cab__nome" aria-haspopup="menu" aria-expanded={menu.aberto} title={`Menu de ${vez.quem}`} onClick={(evento) => menu.onAbrir(evento.currentTarget)}>
                {vez.quem}
                <Seta />
                <span className="mb-sr">: menu da carta</span>
              </button>
            )}
          </h2>
          <p>
            {vez.descricao} · {vez.posicao}º da ordem
          </p>
        </div>
        {(vez.recursos.length > 0 || vez.pips.length > 0) && (
          <div className="mb-cab__resto">
            {vez.recursos.slice(0, 4).map((recurso) => (
              <Barra key={recurso.rotulo} recurso={recurso} />
            ))}
            {!emEspera && vez.pips.length > 0 && (
              <div className="mb-pips" aria-label="O que sobrou da vez">
                {vez.pips.map((pip) => (
                  <span key={pip.texto} className="mb-pip" data-gasto={pip.gasto ? 'sim' : undefined}>
                    {pip.texto}
                    {pip.gasto && <span className="mb-sr"> (usada)</span>}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        {carta !== undefined && carta.marcas.length > 0 && <p className="mb-cab__marcas">{carta.marcas.join(', ')}</p>}
      </div>
      <div className="mb-cartao__corpo">{children}</div>
    </li>
  )
}

export function MesaDaBatalha({ espelho, enviar, lugar, itensDoLugar = [], semFonte = null, teclasNaPagina = false }: MesaDaBatalhaProps) {
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [status, setStatus] = useState<{ texto: string; erro: boolean } | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [registroAberto, setRegistroAberto] = useState(false)
  const [menu, setMenu] = useState<{ aberto: boolean; peloTeclado: boolean }>({ aberto: false, peloTeclado: false })
  // O menu da carta: qual carta e o nome que abriu (recebe o foco de volta no Esc e na escolha).
  const [menuDaCarta, setMenuDaCarta] = useState<{ cartaId: string; ancora: HTMLElement } | null>(null)
  // O "Seguir sem esperar": a reação ou o contra que o mestre deixou para depois (o pedido segue de pé). Vale aqui na
  // hora e vai ao app (pedido 'seguir'); soma o que o app deixou em outra tela (o menu da vez no meio do mapa, o painel, a faixa).
  const [deixadosAqui, setDispensados] = useState<ReadonlySet<string>>(() => new Set())
  const deixadosNoApp = espelho?.deixados
  const dispensados = useMemo(() => (deixadosNoApp === undefined || deixadosNoApp.length === 0 ? deixadosAqui : new Set([...deixadosAqui, ...deixadosNoApp])), [deixadosAqui, deixadosNoApp])
  const continuarRef = useRef<HTMLButtonElement>(null)
  const encerrarRef = useRef<HTMLButtonElement>(null)
  const maisRef = useRef<HTMLButtonElement>(null)
  const desligado = semFonte !== null || espelho === null

  const pendentes = espelho?.pendentes ?? []
  const vivos = pendentes.filter((item) => !dispensados.has(item.id))
  const deixados = pendentes.filter((item) => dispensados.has(item.id))
  const contra = espelho?.contra != null && !dispensados.has(`contra:${espelho.contra.golpeId}`) ? espelho.contra : null
  const daVez = vivos.find((item) => item.ativa) ?? null
  const algumRelogio = contra !== null || pendentes.some((item) => item.desde !== null) || (espelho?.vez != null && !espelho.vez.npc && espelho.vez.desde !== null)
  const agora = useAgora(algumRelogio)

  const pedir = async (chave: string, pedido: PedidoDaMesa, feito: string | null) => {
    setOcupado(chave)
    try {
      const resposta = await enviar(pedido)
      setStatus(resposta.ok ? (feito === null ? null : { texto: feito, erro: false }) : { texto: resposta.motivo ?? 'Não deu.', erro: true })
      return resposta.ok
    } finally {
      setOcupado(null)
    }
  }

  const desfazerUltima = () => {
    if (espelho?.desfazer == null || ocupado !== null || desligado) return
    void pedir('desfazer', { acao: 'desfazer', sceneKey: espelho.sceneKey, linhaId: espelho.desfazer.linhaId }, `Desfeito: ${espelho.desfazer.texto}`)
  }
  const desfazerAgora = useRef(desfazerUltima)
  desfazerAgora.current = desfazerUltima

  // A confirmação do Encerrar começa no botão seguro.
  useEffect(() => {
    if (confirmando) continuarRef.current?.focus()
  }, [confirmando])

  // O menu da carta fecha quando o nome que o abriu sai da tela (a vez andou e a linha virou o cartão) ou a carta sai da ordem.
  useEffect(() => {
    if (menuDaCarta === null) return
    const naOrdem = espelho?.ordem.some((carta) => carta.id === menuDaCarta.cartaId) ?? false
    if (!naOrdem || !menuDaCarta.ancora.isConnected || desligado) setMenuDaCarta(null)
  }, [espelho, menuDaCarta, desligado])

  // Na janela à parte, o Ctrl+Z da página inteira desfaz a última linha (não há editor de mapa aqui).
  useEffect(() => {
    if (!teclasNaPagina) return
    const aoTeclar = (evento: KeyboardEvent) => {
      if ((evento.key === 'z' || evento.key === 'Z') && (evento.ctrlKey || evento.metaKey) && !evento.shiftKey && !evento.altKey && !emCampoDeTexto(evento.target)) {
        evento.preventDefault()
        desfazerAgora.current()
      }
    }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [teclasNaPagina])

  const teclas = (evento: TeclaDoReact<HTMLElement>) => {
    if (evento.key === 'Escape' && !evento.defaultPrevented) {
      if (confirmando) {
        evento.stopPropagation()
        setConfirmando(false)
        requestAnimationFrame(() => maisRef.current?.focus())
        return
      }
      if (registroAberto) {
        evento.stopPropagation()
        setRegistroAberto(false)
        return
      }
    }
    if (teclasNaPagina) return
    if ((evento.key === 'z' || evento.key === 'Z') && (evento.ctrlKey || evento.metaKey) && !evento.shiftKey && !evento.altKey && !emCampoDeTexto(evento.target)) {
      evento.preventDefault()
      evento.stopPropagation()
      desfazerUltima()
    }
  }

  const fecharMenu = (devolverFoco: boolean) => {
    setMenu({ aberto: false, peloTeclado: false })
    if (devolverFoco) requestAnimationFrame(() => maisRef.current?.focus())
  }
  const fecharMenuRef = useRef(fecharMenu)
  fecharMenuRef.current = fecharMenu
  const fecharMenuEstavel = useMemo(() => (devolver: boolean) => fecharMenuRef.current(devolver), [])
  const ordemRef = useRef<HTMLOListElement>(null)
  useOrdemQueDesliza(ordemRef, (espelho?.ordem ?? []).map((carta) => `${carta.id}${carta.vez ? '*' : ''}`).join('|'))

  const leitura = espelho === null ? null : espelho.fase === 'iniciativa' ? { titulo: 'Iniciativa', sub: NOME_DO_SISTEMA[espelho.sistema] } : { titulo: `Rodada ${espelho.rodada}`, sub: espelho.turno === null ? NOME_DO_SISTEMA[espelho.sistema] : `vez ${espelho.turno.n} de ${espelho.turno.m}` }

  const itensDoMais: (ItemDoMais | 'separador')[] = []
  if (espelho !== null) {
    const { sceneKey } = espelho
    if (espelho.sistema === 'op' && espelho.vez !== null && (espelho.vez.menuDoMapa || espelho.contra?.doMestre === true)) {
      itensDoMais.push({
        chave: 'menu-do-mapa',
        rotulo: espelho.menuDoMapaAberto ? 'Fechar o menu da vez no mapa' : 'Abrir o menu da vez no mapa',
        onEscolher: () => void pedir('menu', { acao: 'menuDoMapa', sceneKey, ligar: !espelho.menuDoMapaAberto }, espelho.menuDoMapaAberto ? 'O menu da vez saiu do mapa.' : lugar === 'doca' ? 'O menu da vez abriu no meio do mapa.' : 'O menu da vez abriu no meio do mapa do app.'),
      })
    }
    itensDoMais.push({
      chave: 'livro',
      rotulo: 'Dano, selos, extras e regras…',
      onEscolher: () => void pedir('livro', { acao: 'abrirLivro', sceneKey }, lugar === 'doca' ? 'A página Batalha abriu no livro da direita.' : 'A página Batalha abriu no livro do app.'),
    })
    itensDoMais.push('separador')
    if (espelho.podeOrdenar) itensDoMais.push({ chave: 'ordenar', rotulo: 'Ordenar pela Agilidade', onEscolher: () => void pedir('ordenar', { acao: 'ordenar', sceneKey }, 'Ordem refeita pela Agilidade.') })
    itensDoMais.push({ chave: 'caminhos', rotulo: 'Zerar caminhos', desligado: espelho.temCaminhos ? null : 'Nenhuma ficha andou ainda', onEscolher: () => void pedir('caminhos', { acao: 'zerarCaminhos', sceneKey }, 'Caminhos zerados no mapa.') })
    // As chaves do combate do painel da batalha (guardadas neste computador): a câmera que traz a ficha da vez e o som.
    const { chaves } = espelho
    if (chaves !== null) {
      itensDoMais.push('separador')
      itensDoMais.push({
        chave: 'camera',
        rotulo: 'Câmera segue a vez',
        marcado: chaves.camera,
        estado: chaves.camera ? 'sim' : 'não',
        onEscolher: () => void pedir('chave', { acao: 'chave', sceneKey, chave: 'camera', ligar: !chaves.camera }, chaves.camera ? 'A câmera fica onde você deixar.' : 'A câmera traz a ficha da vez para a vista.'),
      })
      itensDoMais.push({
        chave: 'som',
        rotulo: 'Som da batalha',
        marcado: chaves.som,
        estado: chaves.som ? 'ligado' : 'mudo',
        onEscolher: () => void pedir('chave', { acao: 'chave', sceneKey, chave: 'som', ligar: !chaves.som }, chaves.som ? 'Sons do combate: mudo.' : 'Sons do combate: ligados.'),
      })
    }
    if (itensDoLugar.length > 0) {
      itensDoMais.push('separador')
      for (const item of itensDoLugar) itensDoMais.push({ chave: item.chave, rotulo: item.rotulo, onEscolher: item.onEscolher })
    }
    itensDoMais.push('separador')
    itensDoMais.push({ chave: 'encerrar', rotulo: 'Encerrar batalha…', perigo: true, onEscolher: () => setConfirmando(true) })
  }

  const topo = (
    <header className="mb-topo">
      <p className="mb-rodada">
        <b>{leitura?.titulo ?? 'Sem batalha'}</b>
        <span>{leitura?.sub ?? 'na cena aberta'}</span>
      </p>
      {espelho !== null && (
        <button
          ref={maisRef}
          type="button"
          className="mb-bt mb-bt--fantasma"
          data-mais
          aria-haspopup="menu"
          aria-expanded={menu.aberto}
          disabled={desligado}
          onClick={(evento) => setMenu((antes) => ({ aberto: !antes.aberto, peloTeclado: evento.detail === 0 }))}
        >
          Mais
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <path d="M2 3.5l3 3 3-3" />
          </svg>
        </button>
      )}
      {menu.aberto && <MenuMais itens={itensDoMais} peloTeclado={menu.peloTeclado} onFechar={fecharMenuEstavel} />}
    </header>
  )

  if (espelho === null) {
    return (
      <section className="mb" aria-label="Mesa da batalha" data-lugar={lugar}>
        {topo}
        {semFonte !== null && (
          <p className="mb-semfonte" role="alert">
            {semFonte}
          </p>
        )}
        <div className="mb-vazia">
          <p>Nenhuma batalha na cena aberta.</p>
          <small>Inicie pela página Batalha do livro do mestre (Shift+B): a ordem, a vez e as reações aparecem aqui na hora.</small>
        </div>
      </section>
    )
  }

  const { sceneKey } = espelho
  const vez = espelho.vez
  const ocupadoAgora = ocupado !== null
  const soOnePiece = espelho.sistema === 'op'
  const reagindo = new Set(vivos.flatMap((item) => (item.golpe === null ? [] : [item.golpe.alvo])))
  // O Passar a vez trava enquanto falta reação ou contra-ataque; o mestre responde daqui ou usa o "Seguir sem esperar"
  // (o jogador que sumiu). Se o motor ainda recusar o passar com o pedido de pé, a frase dele aparece no status.
  const trava = contra !== null ? `Falta o contra-ataque de ${contra.quem}.` : daVez !== null ? (daVez.golpe !== null ? `Falta a reação de ${daVez.golpe.alvo}.` : `Falta: ${daVez.titulo}.`) : null
  const podeSeguir = trava !== null
  const algumLancavel = vez !== null && vez.golpes.some(lancavel)
  const hora = trava === null && vez !== null && vez.feitos.length > 0 && !algumLancavel
  // O menu da vez sobre o mapa (One Piece): a vez do NPC, ou o contra-ataque dele, que pode cair na vez do jogador.
  const comMenuDoMapa = soOnePiece && vez !== null && (vez.menuDoMapa || espelho.contra?.doMestre === true)
  const menuDoMapa = comMenuDoMapa ? { aberto: espelho.menuDoMapaAberto, onAlternar: () => void pedir('menu', { acao: 'menuDoMapa', sceneKey, ligar: !espelho.menuDoMapaAberto }, null) } : undefined
  const ultima = espelho.registro.find((linha) => !linha.desfeita) ?? null
  const cartaDaVez = espelho.ordem.find((carta) => carta.vez)

  // O menu da carta do mestre (o mesmo da faixa do alto), aberto pelo nome. O "Dar a vez" dele respeita a trava do Passar.
  const menuDaLinha = (carta: CartaNoEspelho | undefined): MenuDaLinha | null =>
    carta === undefined || carta.menu.length === 0 || desligado
      ? null
      : {
          aberto: menuDaCarta?.cartaId === carta.id,
          onAbrir: (ancora) => setMenuDaCarta((antes) => (antes?.cartaId === carta.id ? null : { cartaId: carta.id, ancora })),
        }
  const cartaDoMenu = menuDaCarta === null ? undefined : espelho.ordem.find((carta) => carta.id === menuDaCarta.cartaId)
  const itensDoMenuDaCarta: ItemDoMenuDaCarta[] =
    cartaDoMenu === undefined
      ? []
      : cartaDoMenu.menu.map((item) => {
          const travado = item.id === 'vez' && trava !== null
          return {
            id: item.id,
            rotulo: item.rotulo,
            detalhe: travado ? (trava ?? undefined) : (item.detalhe ?? undefined),
            secao: item.secao ?? undefined,
            perigo: item.perigo,
            desabilitado: item.desabilitado || travado || ocupadoAgora,
            marcado: item.marcado ?? undefined,
            cor: item.cor,
            onEscolher: () => void pedir('carta', { acao: 'itemDaCarta', sceneKey, cartaId: cartaDoMenu.id, item: item.id }, feitoDoItem(item, cartaDoMenu.nome, lugar)),
          }
        })

  const seguirSemEsperar = () => {
    const chaves = [...(contra === null ? [] : [`contra:${contra.golpeId}`]), ...vivos.map((item) => item.id)]
    setDispensados((antes) => new Set([...antes, ...chaves]))
    // O app guarda também: o Passar a vez do menu da vez no meio do mapa (e o da faixa, com a mesa recolhida) passa a valer.
    void pedir('seguir', { acao: 'seguir', sceneKey, chaves }, 'Seguindo sem esperar: o pedido fica de pé até ser respondido ou a rodada virar.')
  }

  const responder = (item: PendenteNoEspelho, resposta: string) => void pedir('responder', { acao: 'responder', sceneKey, pendente: item.id, resposta }, 'Respondido.')

  const corpoDaVez = (atual: VezNoEspelho): ReactNode => {
    if (contra !== null) {
      return (
        <TrocaDoContra
          contra={contra}
          agora={agora}
          ocupado={ocupadoAgora}
          desligado={desligado}
          menuDoMapa={menuDoMapa}
          onContra={(golpe, alvos, ajuste) =>
            void pedir('contra', { acao: 'contra', sceneKey, golpeId: contra.golpeId, golpe: golpe.chave, alvos, ...(ajuste === undefined ? {} : { ajuste }) }, `${contra.quem} contra-atacou com ${golpe.nome}.`)
          }
          onAbrirMao={() => void pedir('abrirMao', { acao: 'abrirMao', sceneKey, golpeId: contra.golpeId }, `${contra.quem} abriu mão do golpe: a vez voltou para ${contra.de}.`)}
        />
      )
    }
    if (daVez !== null) {
      return (
        <>
          <TrocaDaReacao item={daVez} agora={agora} ocupado={ocupadoAgora} desligado={desligado} onResponder={(resposta) => responder(daVez, resposta)} />
          <AindaEsperando titulo="Também esperando" itens={vivos.filter((item) => item !== daVez)} agora={agora} ocupado={ocupadoAgora} desligado={desligado} onResponder={responder} />
        </>
      )
    }
    return (
      <>
        {atual.feitos.length > 0 && (
          <div className="mb-feito" data-entra>
            <p className="mb-feito__ultimo">{atual.feitos[0]}</p>
            {atual.feitos.slice(1).map((texto, indice) => (
              <p key={`${indice}-${texto}`} className="mb-feito__antes">
                {texto}
              </p>
            ))}
          </div>
        )}
        {atual.aviso !== null && (
          <p className="mb-joga">
            <span>{atual.aviso}</span>
            {!atual.npc && atual.desde !== null && <Relogio desde={atual.desde} agora={agora} rotulo="Tempo desta vez" />}
          </p>
        )}
        {atual.golpes.length > 0 && (
          <EscolhaDoGolpe
            key={atual.chave}
            chave={atual.chave}
            golpes={atual.golpes}
            alvos={atual.alvos}
            sugestao={atual.sugestao}
            verbo="Lançar"
            ocupado={ocupadoAgora}
            desligado={desligado}
            menuDoMapa={menuDoMapa}
            onLancar={(golpe, alvos, ajuste) =>
              void pedir('agir', ajuste === undefined ? { acao: 'agir', sceneKey, vez: atual.chave, golpe: golpe.chave, alvos } : { acao: 'agir', sceneKey, vez: atual.chave, golpe: golpe.chave, alvos, ajuste }, `${atual.quem} lançou ${golpe.nome}.`)
            }
          />
        )}
        <AindaEsperando titulo="Ainda esperando" itens={deixados} agora={agora} ocupado={ocupadoAgora} desligado={desligado} onResponder={responder} />
      </>
    )
  }

  return (
    <section className="mb" aria-label="Mesa da batalha" onKeyDown={teclas} data-sistema={espelho.sistema} data-lugar={lugar}>
      {topo}
      {semFonte !== null && (
        <p className="mb-semfonte" role="alert">
          {semFonte}
        </p>
      )}
      {espelho.avisos.length > 0 && (
        <ul className="mb-avisos">
          {espelho.avisos.map((aviso) => (
            <li key={aviso}>{aviso}</li>
          ))}
        </ul>
      )}
      <div className="mb-corpo">
        {espelho.fase === 'iniciativa' && (
          <div className="mb-cartao mb-cartao--solto">
            <span className="mb-fita">Antes do combate</span>
            <div className="mb-cab mb-cab--so">
              <h2>Iniciativa</h2>
              <p>Cada um declara a forma (no livro), a iniciativa é rolada e a batalha começa.</p>
            </div>
            <div className="mb-lancar">
              <button type="button" className="mb-bt mb-bt--alto" disabled={ocupadoAgora || desligado} onClick={() => void pedir('rolar', { acao: 'iniciativa', sceneKey, passo: 'rolar' }, 'Iniciativa rolada.')}>
                {ocupado === 'rolar' ? 'Rolando…' : 'Rolar a iniciativa'}
              </button>
              <button type="button" className="mb-bt mb-bt--alto mb-bt--ouro" disabled={ocupadoAgora || desligado} onClick={() => void pedir('comecar', { acao: 'iniciativa', sceneKey, passo: 'comecar' }, 'A batalha começou.')}>
                {ocupado === 'comecar' ? 'Começando…' : 'Começar a batalha'}
              </button>
            </div>
          </div>
        )}
        {espelho.ordem.length === 0 ? (
          <div className="mb-vazia">
            <p>Ninguém na ordem.</p>
            <small>Inclua fichas pela página Batalha do livro (Mais, depois Dano, selos, extras e regras).</small>
          </div>
        ) : (
          <ol ref={ordemRef} className="mb-ordem" style={{ '--mb-fila': String(Math.max(1, espelho.ordem.length - 1)) } as CSSProperties} aria-label="Ordem dos turnos">
            {espelho.ordem.map((carta) =>
              carta.vez && vez !== null ? (
                <CartaoDaVez key={carta.id} carta={cartaDaVez} vez={vez} emEspera={contra !== null} menu={menuDaLinha(cartaDaVez)}>
                  {corpoDaVez(vez)}
                </CartaoDaVez>
              ) : (
                <LinhaDaOrdem
                  key={carta.id}
                  carta={carta}
                  etiqueta={etiquetaDe(carta, reagindo, contra?.quem ?? null)}
                  darVezDesligado={ocupadoAgora || desligado || trava !== null}
                  onDarVez={() => void pedir('darVez', { acao: 'darVez', sceneKey, cartaId: carta.id }, `A vez foi para ${carta.nome}.`)}
                  menu={menuDaLinha(carta)}
                />
              ),
            )}
          </ol>
        )}
        {vez === null && espelho.fase === 'combate' && espelho.ordem.length > 0 && <p className="mb-nota mb-nota--solta">Sem vez agora: dê a vez a alguém na ordem.</p>}
      </div>

      <footer className="mb-pe">
        {registroAberto && (
          <ol className="mb-reg" id={`mb-reg-${sceneKey}`} aria-label="Registro da batalha, do mais novo ao mais antigo">
            {espelho.registro.length === 0 ? (
              <li className="mb-nota">Nada aconteceu ainda nesta batalha.</li>
            ) : (
              espelho.registro.map((linha) => (
                <li key={linha.id} data-desfeita={linha.desfeita ? 'sim' : undefined}>
                  <small>
                    Rodada {linha.rodada} · {linha.autor}
                  </small>
                  {linha.texto}
                </li>
              ))
            )}
          </ol>
        )}
        <div className="mb-ultima">
          <p title={ultima?.texto}>{registroAberto ? 'Registro, do mais novo ao mais antigo' : (ultima?.texto ?? 'Nada aconteceu ainda.')}</p>
          <button
            type="button"
            className="mb-bt mb-bt--p mb-bt--fantasma"
            disabled={espelho.desfazer === null || ocupadoAgora || desligado}
            title={espelho.desfazer === null ? 'Nada para desfazer' : `Desfazer: ${espelho.desfazer.texto} (Ctrl+Z)`}
            aria-keyshortcuts="Control+Z"
            onClick={desfazerUltima}
          >
            {ocupado === 'desfazer' ? 'Desfazendo…' : 'Desfazer'}
          </button>
          <button type="button" className="mb-bt mb-bt--p mb-bt--fantasma" aria-expanded={registroAberto} aria-controls={registroAberto ? `mb-reg-${sceneKey}` : undefined} onClick={() => setRegistroAberto((antes) => !antes)}>
            Registro <small>{espelho.registro.length}</small>
          </button>
        </div>
        {confirmando ? (
          <div className="mb-confirma" role="group" aria-label="Encerrar a batalha?">
            <p>{espelho.avisoDoEncerrar}</p>
            <div>
              <button
                ref={continuarRef}
                type="button"
                className="mb-bt"
                onClick={() => {
                  setConfirmando(false)
                  requestAnimationFrame(() => maisRef.current?.focus())
                }}
              >
                Continuar a batalha
              </button>
              <button
                ref={encerrarRef}
                type="button"
                className="mb-bt mb-bt--perigo"
                disabled={ocupadoAgora || desligado}
                onClick={() => {
                  void pedir('encerrar', { acao: 'encerrar', sceneKey }, 'Batalha encerrada.').then(() => setConfirmando(false))
                }}
              >
                {ocupado === 'encerrar' ? 'Encerrando…' : 'Encerrar a batalha'}
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-pe__acoes">
            <p className="mb-status" role="status" data-erro={status?.erro === true ? 'sim' : undefined}>
              {status?.erro === true ? status.texto : (trava ?? status?.texto ?? '')}
            </p>
            {podeSeguir && (
              <button type="button" className="mb-bt mb-bt--fantasma" disabled={desligado} onClick={seguirSemEsperar} title="Passa a valer o Passar a vez; o pedido fica de pé até ser respondido ou a rodada virar.">
                Seguir sem esperar
              </button>
            )}
            <button
              type="button"
              className={hora ? 'mb-bt mb-bt--alto mb-bt--ouro' : 'mb-bt mb-bt--alto'}
              disabled={!espelho.podePassar || vez === null || ocupadoAgora || desligado || trava !== null}
              onClick={() => vez !== null && void pedir('passar', { acao: 'passar', sceneKey, vez: vez.chave }, `${vez.quem} passou a vez.`)}
            >
              {ocupado === 'passar' ? 'Passando…' : 'Passar a vez'}
            </button>
          </div>
        )}
      </footer>
      {cartaDoMenu !== undefined && menuDaCarta !== null && (
        <MenuDaCarta ancora={menuDaCarta.ancora} rotulo={`Carta de ${cartaDoMenu.nome}`} itens={itensDoMenuDaCarta} onFechar={() => setMenuDaCarta(null)} />
      )}
    </section>
  )
}
