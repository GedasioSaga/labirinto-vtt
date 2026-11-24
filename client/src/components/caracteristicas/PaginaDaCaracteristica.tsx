import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { fichasQuePodemSerLigadas, opcaoDoLigado, type OpcaoDeCompanion } from '../../lib/caracteristicas/companions'
import { LIGADOS_MAX, LIMITE_DO_GRUPO_MAX, NIVEL_MAX, NOME_DO_GRUPO_MAX, NOME_PADRAO_DO_GRUPO, type Caracteristica, type CaracteristicaCompanion, type ModoDoCompanion } from '../../lib/caracteristicas/tipos'
import type { Personagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { ImagemOuIniciais } from '../FichaPecas'
import { IconeDaCaracteristica, rotuloDoChip } from './CaracteristicasDaFicha'
import './caracteristicas.css'

/**
 * A página de uma característica, no lugar das abas da ficha (protótipo,
 * estado 2). Companion: nome do grupo, "Leva para a batalha até", as fichas
 * ligadas (nível com Evoluir, Luta no campo / Dá efeito, tirar) e o "Ligar
 * ficha". Cegueira: o que ela faz. As duas: "Tirar característica". `Esc` volta
 * às abas. Só o mestre chega aqui (o jogador vê os chips).
 */

export interface PaginaDaCaracteristicaProps {
  personagem: Personagem
  caracteristica: Caracteristica
  sistema: SistemaDeRpg | null
  /** As fichas da pasta: de onde sai o "Ligar ficha" e o HP de cada ligada. */
  fichas: readonly Personagem[]
  onMudar: (lista: Caracteristica[]) => void
  onVoltar: () => void
}

const FOCAVEIS = 'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** A armadilha do Tab dentro do diálogo: o foco não sai dele. */
function prenderOTab(event: KeyboardEvent<HTMLElement>, caixa: HTMLElement | null) {
  if (event.key !== 'Tab' || caixa === null) return
  const itens = Array.from(caixa.querySelectorAll<HTMLElement>(FOCAVEIS))
  const primeiro = itens[0]
  const ultimo = itens[itens.length - 1]
  if (primeiro === undefined || ultimo === undefined) return
  if (event.shiftKey && document.activeElement === primeiro) {
    event.preventDefault()
    ultimo.focus()
  } else if (!event.shiftKey && document.activeElement === ultimo) {
    event.preventDefault()
    primeiro.focus()
  }
}

export function PaginaDaCaracteristica({ personagem, caracteristica, sistema, fichas, onMudar, onVoltar }: PaginaDaCaracteristicaProps) {
  const [confirmando, setConfirmando] = useState(false)
  const tituloId = useId()
  const lista = personagem.caracteristicas ?? []

  function trocar(nova: Caracteristica) {
    onMudar(lista.map((existente) => (existente.id === nova.id ? nova : existente)))
  }

  function tirar() {
    setConfirmando(false)
    onMudar(lista.filter((existente) => existente.id !== caracteristica.id))
    onVoltar()
  }

  return (
    <section
      className="lb-carac-pagina"
      aria-labelledby={tituloId}
      onKeyDown={(event) => {
        // `Esc` volta às abas; o campo de texto e os diálogos cuidam do deles.
        if (event.key !== 'Escape' || confirmando || event.defaultPrevented) return
        event.preventDefault()
        onVoltar()
      }}
    >
      <button type="button" className="lb-carac-pagina__voltar" onClick={onVoltar}>
        <span aria-hidden="true">‹</span> Abas da ficha <kbd>Esc</kbd>
      </button>
      <header className="lb-carac-pagina__cab">
        <span className="lb-carac-pagina__selo">
          <IconeDaCaracteristica tipo={caracteristica.tipo} />
        </span>
        <div>
          <h3 className="lb-carac-pagina__tit" id={tituloId}>
            {rotuloDoChip(caracteristica)}
          </h3>
          <p className="lb-carac-pagina__sub">
            {caracteristica.tipo === 'companion'
              ? `Fichas de NPC que andam com ${personagem.nome}. Cada uma tem ficha, vida e nível próprios e vez própria na batalha, do lado de ${personagem.nome}; quem joga por elas é o dono de ${personagem.nome}. Lutam no campo ou dão um efeito.`
              : `A visão de ${personagem.nome} cai pela metade. Quem fica entre a metade e o raio normal aparece só como uma onda no chão, sem rosto e sem nome; a parede não para a onda.`}
          </p>
        </div>
      </header>
      {caracteristica.tipo === 'companion' && <CorpoDoCompanion grupo={caracteristica} dono={personagem} sistema={sistema} fichas={fichas} onTrocar={trocar} />}
      <div className="lb-carac-pagina__rodape">
        <button type="button" className="lb-carac-pagina__tirar" onClick={() => setConfirmando(true)}>
          Tirar característica
        </button>
      </div>
      {confirmando && (
        <Confirmar
          titulo={`Tirar ${rotuloDoChip(caracteristica)}?`}
          texto={caracteristica.tipo === 'companion' ? 'As fichas ligadas continuam no livro; só deixam de andar com este personagem.' : 'A visão volta ao raio normal.'}
          acao="Tirar"
          onSim={tirar}
          onNao={() => setConfirmando(false)}
        />
      )}
    </section>
  )
}

function CorpoDoCompanion({ grupo, dono, sistema, fichas, onTrocar }: { grupo: CaracteristicaCompanion; dono: Personagem; sistema: SistemaDeRpg | null; fichas: readonly Personagem[]; onTrocar: (grupo: CaracteristicaCompanion) => void }) {
  const [nome, setNome] = useState(grupo.nome)
  const [ligando, setLigando] = useState(false)
  const ligarRef = useRef<HTMLButtonElement>(null)
  const nomeId = useId()
  const limiteId = useId()
  useEffect(() => setNome(grupo.nome), [grupo.nome])
  const porId = useMemo(() => new Map(fichas.map((ficha) => [ficha.id, ficha])), [fichas])
  const linhas = grupo.ligados.map((ligado) => ({ ligado, opcao: opcaoDoLigado(ligado, porId, sistema) }))

  function gravarNome() {
    const limpo = nome.trim().slice(0, NOME_DO_GRUPO_MAX) || NOME_PADRAO_DO_GRUPO
    setNome(limpo)
    if (limpo !== grupo.nome) onTrocar({ ...grupo, nome: limpo })
  }

  const mudarLimite = (passo: number) => onTrocar({ ...grupo, limite: Math.min(LIMITE_DO_GRUPO_MAX, Math.max(1, grupo.limite + passo)) })
  const mudarLigado = (personagemId: string, mudar: (ligado: CaracteristicaCompanion['ligados'][number]) => CaracteristicaCompanion['ligados'][number]) =>
    onTrocar({ ...grupo, ligados: grupo.ligados.map((ligado) => (ligado.personagemId === personagemId ? mudar(ligado) : ligado)) })

  return (
    <div className="lb-carac-pagina__corpo">
      <div className="lb-carac-pagina__linha">
        <div className="lb-carac-campo lb-carac-campo--largo">
          <label htmlFor={nomeId}>Nome do grupo</label>
          <input
            id={nomeId}
            className="lb-input"
            value={nome}
            maxLength={NOME_DO_GRUPO_MAX}
            onChange={(event) => setNome(event.target.value)}
            onBlur={gravarNome}
            onKeyDown={(event) => {
              if (event.key === 'Enter') gravarNome()
              if (event.key === 'Escape') {
                // O Esc no campo desfaz o que foi digitado e não fecha a página.
                event.preventDefault()
                setNome(grupo.nome)
              }
            }}
          />
        </div>
        <div className="lb-carac-campo">
          <span id={limiteId}>Leva para a batalha até</span>
          <div className="lb-carac-passo" role="group" aria-labelledby={limiteId}>
            <button type="button" className="lb-carac-passo__btn" aria-label="Levar um a menos" disabled={grupo.limite <= 1} onClick={() => mudarLimite(-1)}>
              −
            </button>
            <output className="lb-carac-passo__valor" aria-live="polite">
              {grupo.limite}
            </output>
            <button type="button" className="lb-carac-passo__btn" aria-label="Levar um a mais" disabled={grupo.limite >= LIMITE_DO_GRUPO_MAX} onClick={() => mudarLimite(1)}>
              +
            </button>
          </div>
        </div>
      </div>
      <p className="lb-carac-pagina__nota">
        {grupo.ligados.length === 1 ? '1 ligada' : `${grupo.ligados.length} ligadas`}: na batalha o dono escolhe {grupo.limite}.
      </p>
      <div className="lb-carac-pagina__lista-cab">
        <h4>
          Fichas ligadas <span className="lb-carac__conta">{grupo.ligados.length}</span>
        </h4>
        <button ref={ligarRef} type="button" className="lb-btn lb-btn--compact" disabled={grupo.ligados.length >= LIGADOS_MAX} onClick={() => setLigando(true)}>
          + Ligar ficha
        </button>
      </div>
      {linhas.length === 0 ? (
        <p className="lb-carac-pagina__vazio">Nenhuma ficha ligada ainda. Em "Ligar ficha", escolha os NPCs do livro que andam com {dono.nome}.</p>
      ) : (
        <ul className="lb-carac-ligadas">
          {linhas.map(({ ligado, opcao }) => (
            <LinhaDoLigado
              key={ligado.personagemId}
              opcao={opcao}
              personagemId={ligado.personagemId}
              nivel={ligado.nivel}
              modo={ligado.modo}
              onEvoluir={() => mudarLigado(ligado.personagemId, (atual) => ({ ...atual, nivel: Math.min(NIVEL_MAX, atual.nivel + 1) }))}
              onModo={(modo) => mudarLigado(ligado.personagemId, (atual) => ({ ...atual, modo }))}
              onTirar={() => {
                onTrocar({ ...grupo, ligados: grupo.ligados.filter((candidato) => candidato.personagemId !== ligado.personagemId), ...(grupo.ultimaEscolha === undefined ? {} : { ultimaEscolha: grupo.ultimaEscolha.filter((id) => id !== ligado.personagemId) }) })
                ligarRef.current?.focus()
              }}
            />
          ))}
        </ul>
      )}
      {ligando && (
        <LigarFichasDialog
          candidatas={fichasQuePodemSerLigadas(dono, fichas).filter((ficha) => !grupo.ligados.some((ligado) => ligado.personagemId === ficha.id))}
          vagas={LIGADOS_MAX - grupo.ligados.length}
          onLigar={(ids) => {
            setLigando(false)
            onTrocar({ ...grupo, ligados: [...grupo.ligados, ...ids.map((personagemId): CaracteristicaCompanion['ligados'][number] => ({ personagemId, modo: 'luta', nivel: 1 }))] })
            ligarRef.current?.focus()
          }}
          onFechar={() => {
            setLigando(false)
            ligarRef.current?.focus()
          }}
        />
      )}
    </div>
  )
}

function LinhaDoLigado({ opcao, personagemId, nivel, modo, onEvoluir, onModo, onTirar }: { opcao: OpcaoDeCompanion | null; personagemId: string; nivel: number; modo: ModoDoCompanion; onEvoluir: () => void; onModo: (modo: ModoDoCompanion) => void; onTirar: () => void }) {
  const nome = opcao?.nome ?? 'Ficha apagada'
  const radioNome = useId()
  const modos: { valor: ModoDoCompanion; rotulo: string }[] = [
    { valor: 'luta', rotulo: 'Luta no campo' },
    { valor: 'efeito', rotulo: 'Dá efeito' },
  ]
  return (
    <li className="lb-carac-ligada" data-personagem={personagemId}>
      <span className="lb-carac-ligada__retrato" aria-hidden="true">
        <ImagemOuIniciais imagem={opcao?.retrato} nome={nome} />
      </span>
      <div className="lb-carac-ligada__nome">
        <strong>{nome}</strong>
        <span className="lb-carac-ligada__info">
          {opcao === null ? 'não está mais no livro' : opcao.vida === null ? 'sem HP na ficha' : `HP ${opcao.vida.atual}/${opcao.vida.maximo} · Agi ${opcao.agilidade}`}
          {opcao?.desmaiada === true && <span className="lb-carac-ligada__desmaiada"> · desmaiada</span>}
        </span>
      </div>
      <span className="lb-carac-ligada__nivel">Nível {nivel}</span>
      <button type="button" className="lb-btn lb-btn--compact" disabled={nivel >= NIVEL_MAX} aria-label={`Evoluir ${nome} para o nível ${nivel + 1}`} onClick={onEvoluir}>
        ↑ Evoluir
      </button>
      <div className="lb-carac-modo" role="radiogroup" aria-label={`O que ${nome} faz na vez`}>
        {modos.map((item) => (
          <label key={item.valor} className="lb-carac-modo__op" data-marcado={modo === item.valor ? 'sim' : undefined}>
            <input type="radio" name={radioNome} value={item.valor} checked={modo === item.valor} onChange={() => onModo(item.valor)} />
            {item.rotulo}
          </label>
        ))}
      </div>
      <button type="button" className="lb-carac-ligada__tirar" aria-label={`Tirar ${nome} do grupo`} onClick={onTirar}>
        ×
      </button>
    </li>
  )
}

/** O diálogo "Ligar fichas": busca, "Marcar todas" de estado misto, `Enter` liga as marcadas, `Esc` fecha. */
function LigarFichasDialog({ candidatas, vagas, onLigar, onFechar }: { candidatas: readonly Personagem[]; vagas: number; onLigar: (ids: string[]) => void; onFechar: () => void }) {
  const [busca, setBusca] = useState('')
  const [marcadas, setMarcadas] = useState<ReadonlySet<string>>(new Set())
  const caixaRef = useRef<HTMLDivElement>(null)
  const buscaRef = useRef<HTMLInputElement>(null)
  const todasRef = useRef<HTMLInputElement>(null)
  const tituloId = useId()
  const termo = busca.trim().toLocaleLowerCase('pt-BR')
  const visiveis = candidatas.filter((ficha) => termo === '' || ficha.nome.toLocaleLowerCase('pt-BR').includes(termo))
  const marcadasVisiveis = visiveis.filter((ficha) => marcadas.has(ficha.id)).length
  const todas = visiveis.length > 0 && marcadasVisiveis === visiveis.length

  useEffect(() => buscaRef.current?.focus(), [])
  useEffect(() => {
    if (todasRef.current !== null) todasRef.current.indeterminate = marcadasVisiveis > 0 && !todas
  }, [marcadasVisiveis, todas])

  const ligar = () => {
    const ids = candidatas.filter((ficha) => marcadas.has(ficha.id)).map((ficha) => ficha.id).slice(0, vagas)
    if (ids.length > 0) onLigar(ids)
  }

  function marcar(id: string, sim: boolean) {
    setMarcadas((antes) => {
      const novas = new Set(antes)
      if (sim) novas.add(id)
      else novas.delete(id)
      return novas
    })
  }

  function aoTeclar(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onFechar()
      return
    }
    if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
      event.preventDefault()
      ligar()
      return
    }
    prenderOTab(event, caixaRef.current)
  }

  return (
    <Modal tituloId={tituloId} caixaRef={caixaRef} onTeclar={aoTeclar} onFundo={onFechar}>
      <h2 className="lb-carac-modal__tit" id={tituloId}>
        Ligar fichas
      </h2>
      <p className="lb-carac-modal__sub">NPCs da aventura. Marque os que andam com este personagem.</p>
      <input ref={buscaRef} className="lb-input" type="search" placeholder="Buscar pelo nome" aria-label="Buscar ficha pelo nome" value={busca} onChange={(event) => setBusca(event.target.value)} />
      {visiveis.length === 0 ? (
        <p className="lb-carac-pagina__vazio">{candidatas.length === 0 ? 'Nenhum NPC para ligar: crie em "NPCs de combate" no livro.' : `Nenhum NPC com "${busca.trim()}".`}</p>
      ) : (
        <>
          <label className="lb-carac-marcar">
            <input
              ref={todasRef}
              type="checkbox"
              checked={todas}
              onChange={(event) => {
                const sim = event.target.checked
                setMarcadas((antes) => {
                  const novas = new Set(antes)
                  for (const ficha of visiveis) if (sim) novas.add(ficha.id)
                  else novas.delete(ficha.id)
                  return novas
                })
              }}
            />
            Marcar todas ({visiveis.length})
          </label>
          <ul className="lb-carac-candidatas">
            {visiveis.map((ficha) => (
              <li key={ficha.id}>
                <label className="lb-carac-marcar">
                  <input type="checkbox" checked={marcadas.has(ficha.id)} onChange={(event) => marcar(ficha.id, event.target.checked)} />
                  <span className="lb-carac-ligada__retrato" aria-hidden="true">
                    <ImagemOuIniciais imagem={ficha.retrato} nome={ficha.nome} />
                  </span>
                  {ficha.nome}
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="lb-carac-modal__acoes">
        <button type="button" className="lb-btn lb-btn--ghost" onClick={onFechar}>
          Cancelar
        </button>
        <button type="button" className="lb-btn lb-btn--primary" disabled={marcadas.size === 0} onClick={ligar}>
          Ligar {marcadas.size === 0 ? '' : marcadas.size} <kbd>Enter</kbd>
        </button>
      </div>
    </Modal>
  )
}

/** A confirmação do "Tirar característica": foco em Cancelar, o fundo não fecha. */
function Confirmar({ titulo, texto, acao, onSim, onNao }: { titulo: string; texto: string; acao: string; onSim: () => void; onNao: () => void }) {
  const caixaRef = useRef<HTMLDivElement>(null)
  const naoRef = useRef<HTMLButtonElement>(null)
  const tituloId = useId()
  useEffect(() => naoRef.current?.focus(), [])
  return (
    <Modal
      tituloId={tituloId}
      caixaRef={caixaRef}
      papel="alertdialog"
      onTeclar={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          onNao()
          return
        }
        prenderOTab(event, caixaRef.current)
      }}
    >
      <h2 className="lb-carac-modal__tit" id={tituloId}>
        {titulo}
      </h2>
      <p className="lb-carac-modal__sub">{texto}</p>
      <div className="lb-carac-modal__acoes">
        <button ref={naoRef} type="button" className="lb-btn lb-btn--ghost" onClick={onNao}>
          Cancelar
        </button>
        <button type="button" className="lb-btn lb-btn--danger lb-carac-modal__perigo" onClick={onSim}>
          {acao}
        </button>
      </div>
    </Modal>
  )
}

function Modal({ tituloId, caixaRef, papel = 'dialog', onTeclar, onFundo, children }: { tituloId: string; caixaRef: RefObject<HTMLDivElement | null>; papel?: 'dialog' | 'alertdialog'; onTeclar: (event: KeyboardEvent<HTMLDivElement>) => void; onFundo?: () => void; children: ReactNode }) {
  return createPortal(
    <div
      className="lb-carac-modal-fundo"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onFundo?.()
      }}
    >
      <div ref={caixaRef} className="lb-carac-modal" role={papel} aria-modal="true" aria-labelledby={tituloId} onKeyDown={onTeclar}>
        {children}
      </div>
    </div>,
    document.body,
  )
}
