import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { novoIdDeCaracteristica } from '../../lib/caracteristicas/companions'
import { numeroDaRecuperacao, ROTULO_DA_RECUPERACAO } from '../../lib/caracteristicas/recuperacao'
import {
  CARACTERISTICAS_MAX,
  linhasDaRecuperacao,
  NOME_PADRAO_DO_GRUPO,
  novaRecuperacao,
  QUANTO_DA_RECUPERACAO_MAX,
  RECURSOS_DA_RECUPERACAO,
  recuperacaoComLinha,
  recuperacaoDaFicha,
  temCegueira,
  type Caracteristica,
  type CaracteristicaRecuperacao,
  type LinhaDaRecuperacao,
  type RecursoDaRecuperacao,
} from '../../lib/caracteristicas/tipos'
import type { Personagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { Toggle } from '../Toggle'
import './caracteristicas.css'

/**
 * O bloco "Características especiais" da coluna da esquerda da ficha
 * (protótipo aprovado, estado 1): os chips e, só para o mestre, o
 * "+ Característica". Clicar num chip abre a página dele no lugar das abas
 * (quem desenha a página é `PaginaDaCaracteristica`); o jogador vê os chips.
 * Embaixo, o "Recupera por turno" (pedido do dono de 26/11/2026; em 27/11,
 * duas linhas independentes): o mestre liga "Vida por turno" e/ou "SP por
 * turno", cada uma com o quanto dela; o jogador lê as linhas com quanto.
 */

export interface CaracteristicasDaFichaProps {
  personagem: Personagem
  /** O sistema da ficha: a prévia da fórmula do "Recupera por turno" ("= 12 de Vida"). Ausente = sem prévia. */
  sistema?: SistemaDeRpg | null
  /** O id da característica aberta no lugar das abas; `null` = as abas. */
  aberta: string | null
  onAbrir: (id: string | null) => void
  /** Só o mestre: grava a lista nova na hora. Ausente = só lê (o jogador). */
  onMudar?: (lista: Caracteristica[]) => void
}

/** A característica que vira chip (o "Recupera por turno" é um campo, não chip). */
type CaracteristicaDeChip = Exclude<Caracteristica, CaracteristicaRecuperacao>

function ehChip(caracteristica: Caracteristica): caracteristica is CaracteristicaDeChip {
  return caracteristica.tipo !== 'recuperacao'
}

/** "Companion · Lovecats (3)": o número é quanto leva para a batalha (decisão 2 do NOTAS). */
export function rotuloDoChip(caracteristica: Caracteristica): string {
  if (caracteristica.tipo === 'recuperacao') return 'Recupera por turno'
  return caracteristica.tipo === 'cegueira' ? 'Cegueira' : `Companion · ${caracteristica.nome}`
}

function nomeAcessivel(caracteristica: CaracteristicaDeChip): string {
  if (caracteristica.tipo === 'cegueira') return 'Cegueira'
  const ligadas = caracteristica.ligados.length
  return `Companion ${caracteristica.nome}, leva até ${caracteristica.limite}, ${ligadas} ${ligadas === 1 ? 'ficha ligada' : 'fichas ligadas'}`
}

export function IconeDaCaracteristica({ tipo }: { tipo: Caracteristica['tipo'] }) {
  if (tipo === 'recuperacao') {
    return (
      <svg className="lb-carac__icone" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 5v14M5 12h14" />
      </svg>
    )
  }
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

export function CaracteristicasDaFicha({ personagem, sistema = null, aberta, onAbrir, onMudar }: CaracteristicasDaFichaProps) {
  const tituloId = useId()
  const lista = personagem.caracteristicas ?? []
  const chips = lista.filter(ehChip)
  const recuperacao = recuperacaoDaFicha(lista)
  // O jogador lê só as linhas com quanto (vazio = nada).
  const linhasLidas = recuperacao === null ? [] : linhasDaRecuperacao(recuperacao).filter(({ linha }) => linha.quanto !== '')
  if (onMudar === undefined && chips.length === 0 && linhasLidas.length === 0) return null
  return (
    <section className="lb-carac" aria-labelledby={tituloId}>
      <h3 className="lb-eyebrow lb-ficha__subtitulo" id={tituloId}>
        Características especiais
      </h3>
      {(chips.length > 0 || onMudar !== undefined) && (
      <ul className="lb-carac__chips">
        {chips.map((caracteristica) => (
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
      )}
      {onMudar !== undefined ? (
        <RecuperaPorTurno key={personagem.id} personagem={personagem} sistema={sistema} onMudar={onMudar} />
      ) : (
        linhasLidas.map(({ recurso, linha }) => <RecuperacaoLida key={recurso} recurso={recurso} linha={linha} personagem={personagem} sistema={sistema} />)
      )}
    </section>
  )
}

/** Só algarismos: o número já diz tudo (sem a prévia "= 10"). */
const SO_NUMERO = /^\d+$/

/** Uma linha do jogador: "Vida por turno: Vigor / 2 (= 12)" (a fórmula leva o número ao lado). */
function RecuperacaoLida({ recurso, linha, personagem, sistema }: { recurso: RecursoDaRecuperacao; linha: LinhaDaRecuperacao; personagem: Personagem; sistema: SistemaDeRpg | null }) {
  const numero = sistema === null || SO_NUMERO.test(linha.quanto) ? null : numeroDaRecuperacao(linha.quanto, personagem, sistema)
  return (
    <p className="lb-carac__recupera-lida">
      {ROTULO_DA_RECUPERACAO[recurso]} por turno: <b>{linha.quanto}</b>
      {numero !== null && <span className="lb-carac__conta"> (= {numero})</span>}
    </p>
  )
}

/**
 * O campo do mestre (27/11/2026): "Vida por turno" e "SP por turno", cada uma ligada ou não, com o quanto
 * dela (número ou fórmula). Ligar e desligar grava na hora; o quanto, ao sair do campo ou no Enter. As duas
 * desligadas = a característica sai da ficha. A batalha aplica no começo da vez da ficha (`stores/batalha/vez.ts`).
 */
function RecuperaPorTurno({ personagem, sistema, onMudar }: { personagem: Personagem; sistema: SistemaDeRpg | null; onMudar: (lista: Caracteristica[]) => void }) {
  const lista = personagem.caracteristicas ?? []
  const atual = recuperacaoDaFicha(lista)
  const avisoId = useId()
  // O leitor corta a lista no teto: sem vaga, a recuperação nova se perderia ao reabrir a ficha.
  const semVaga = atual === null && lista.length >= CARACTERISTICAS_MAX

  /** A recuperação nova no lugar da de agora; `null` = sai da ficha. */
  function trocar(nova: CaracteristicaRecuperacao | null) {
    if (nova === null) {
      if (atual !== null) onMudar(lista.filter((caracteristica) => caracteristica.tipo !== 'recuperacao'))
      return
    }
    onMudar(atual === null ? [...lista, nova] : lista.map((caracteristica) => (caracteristica.id === atual.id ? nova : caracteristica)))
  }

  function mudarLinha(recurso: RecursoDaRecuperacao, linha: LinhaDaRecuperacao | null) {
    if (atual !== null) trocar(recuperacaoComLinha(atual, recurso, linha))
    else if (linha !== null) trocar(novaRecuperacao(novoIdDeCaracteristica(), recurso, linha))
  }

  return (
    <fieldset className="lb-carac__recupera">
      <legend className="lb-carac__recupera-tit">Recupera por turno</legend>
      {RECURSOS_DA_RECUPERACAO.map((recurso) => (
        <LinhaDoRecuperaPorTurno
          key={recurso}
          recurso={recurso}
          // Linha ausente = desligada (o domínio): `null` para o campo.
          linha={atual === null ? null : (atual[recurso] ?? null)}
          personagem={personagem}
          sistema={sistema}
          semVagaId={semVaga ? avisoId : null}
          onMudar={(linha) => mudarLinha(recurso, linha)}
        />
      ))}
      {semVaga && (
        <p className="lb-carac__recupera-aviso" id={avisoId}>
          A ficha já tem {CARACTERISTICAS_MAX} características.
        </p>
      )}
    </fieldset>
  )
}

/**
 * Uma linha do campo do mestre: o interruptor "Vida por turno" (ou "SP por turno") e, ligada, o quanto com a
 * prévia da conta. `semVagaId` = a ficha sem vaga para a característica nova: a linha desligada não liga.
 */
function LinhaDoRecuperaPorTurno({
  recurso,
  linha,
  personagem,
  sistema,
  semVagaId,
  onMudar,
}: {
  recurso: RecursoDaRecuperacao
  linha: LinhaDaRecuperacao | null
  personagem: Personagem
  sistema: SistemaDeRpg | null
  semVagaId: string | null
  onMudar: (linha: LinhaDaRecuperacao | null) => void
}) {
  const gravado = linha === null ? '' : linha.quanto
  const [quanto, setQuanto] = useState(gravado)
  useEffect(() => setQuanto(gravado), [gravado])
  const quantoRef = useRef<HTMLInputElement>(null)
  const quantoId = useId()
  const previaId = useId()
  const rotulo = ROTULO_DA_RECUPERACAO[recurso]

  function ligar(sim: boolean) {
    if (!sim) {
      onMudar(null)
      return
    }
    onMudar({ quanto: quanto.trim().slice(0, QUANTO_DA_RECUPERACAO_MAX) })
    // O quanto aparece agora: o foco vai a ele depois do desenho.
    requestAnimationFrame(() => quantoRef.current?.focus())
  }

  function gravarQuanto() {
    if (linha === null) return
    const limpo = quanto.trim().slice(0, QUANTO_DA_RECUPERACAO_MAX)
    setQuanto(limpo)
    if (limpo !== linha.quanto) onMudar({ quanto: limpo })
  }

  const limpo = quanto.trim()
  const numero = linha === null || sistema === null || limpo === '' ? null : numeroDaRecuperacao(limpo, personagem, sistema)
  const previa =
    linha === null
      ? null
      : limpo === ''
        ? { texto: 'Digite quanto: um número ou uma conta (Vigor / 2).', erro: false }
        : sistema !== null && numero === null
          ? { texto: 'Não entendi a conta: use um número ou atributos (Vigor / 2). Assim não recupera nada.', erro: true }
          : numero !== null && !SO_NUMERO.test(limpo)
            ? { texto: `= ${numero} de ${rotulo} agora`, erro: false }
            : null

  return (
    <div className="lb-carac__linha">
      <Toggle
        label={`${rotulo} por turno`}
        checked={linha !== null}
        disabled={semVagaId !== null && linha === null}
        describedBy={linha === null && semVagaId !== null ? semVagaId : undefined}
        onChange={ligar}
      />
      {linha !== null && (
        <div className="lb-carac__quanto">
          <label htmlFor={quantoId}>Quanto</label>
          <input
            ref={quantoRef}
            id={quantoId}
            className="lb-input"
            value={quanto}
            maxLength={QUANTO_DA_RECUPERACAO_MAX}
            placeholder="10 ou Vigor / 2"
            inputMode="text"
            autoComplete="off"
            // Duas linhas, dois "Quanto": o nome diz de qual (e contém o texto visível).
            aria-label={`Quanto de ${rotulo} por turno`}
            aria-describedby={previa === null ? undefined : previaId}
            aria-invalid={previa?.erro === true ? true : undefined}
            onChange={(event) => setQuanto(event.target.value)}
            onBlur={gravarQuanto}
            onKeyDown={(event) => {
              if (event.key === 'Enter') gravarQuanto()
              // O Esc com algo digitado desfaz o digitado e não fecha a ficha; sem mudança, ele segue (fecha, como sempre).
              if (event.key === 'Escape' && quanto !== gravado) {
                event.preventDefault()
                event.stopPropagation()
                setQuanto(gravado)
              }
            }}
          />
          {previa !== null && (
            <p className="lb-carac__previa" id={previaId} data-erro={previa.erro ? 'sim' : undefined} aria-live="polite">
              {previa.texto}
            </p>
          )}
        </div>
      )}
    </div>
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
