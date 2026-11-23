import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { DANO_MAX } from '../../../lib/batalha/combate'
import { ABA_DAS_TECNICAS } from '../../../lib/batalha/leituraDaFicha'
import { nivelDoAcumulador } from '../../../lib/batalha/acumuladorNaBatalha'
import { frasesDoAcumulador } from '../../../lib/batalha/requisitos/frases'
import { mesmaMarca } from '../../../lib/batalha/requisitos/ler'
import {
  NIVEL_DO_ACUMULADOR_MAX,
  NOME_DO_ACUMULADOR_MAX,
  PASSO_DO_ACUMULADOR_MAX,
  RECURSO_DO_REQUISITO_MAX,
  REGRAS_DO_ACUMULADOR_MAX,
  type AcumuladorDaFicha,
  type DescidaDoAcumulador,
  type GanhoDoAcumulador,
  type QuandoSobe,
  type Referencia,
  type SubidaDoAcumulador,
  type ValorPorNivel,
} from '../../../lib/batalha/requisitos/modelo'
import type { CartaoDaFicha, Personagem } from '../../../lib/personagem'
import type { SistemaDeRpg } from '../../../lib/sistemaDeRpg'
import { CampoInteiro, Escolha, Marcar } from '../blocos/controles'
import {
  acumuladoresNaFicha,
  comAcumuladorNovo,
  comOAcumuladorGravado,
  eventosDoTeste,
  ganhoNoNivel,
  passoDoTeste,
  semOAcumulador,
  testeNovo,
  usosDoAcumulador,
  type AcumuladorNaFicha,
  type EstadoDoTeste,
} from './acumuladoresDaFicha'
import '../MecanicaDaTecnica.css'
import '../editor/editor.css'
import './acumulador.css'

/** O "a cada N SP" de partida da regra nova (o protótipo começa em 20). */
const SP_DE_PARTIDA = 20
/** O ganho de partida ao escolher Dano (o da Polaridade) e Atributo (o da Fúria). */
const DANO_DE_PARTIDA = 10
const ATRIBUTO_DE_PARTIDA = 5
/** Até quantos níveis a tira "Nível 1: +10…" mostra um por um. */
const NIVEIS_NA_TIRA_MAX = 10
/** Até quantos segmentos o medidor do Testar desenha; acima, vira uma barra. */
const SEGMENTOS_MAX = 20
/** Quanto o "Apagar" espera a confirmação. */
const CONFIRMAR_MS = 4000

const JEITOS_DE_SUBIR: readonly { quando: QuandoSobe['quando']; rotulo: string }[] = [
  { quando: 'gastaReacao', rotulo: 'Gastar a reação' },
  { quando: 'acerta', rotulo: 'Acertar um golpe' },
  { quando: 'apanha', rotulo: 'Receber dano' },
  { quando: 'usaTecnica', rotulo: 'Usar uma técnica' },
  { quando: 'comecoDaVez', rotulo: 'Começar a vez' },
  { quando: 'derruba', rotulo: 'Derrubar alguém' },
  { quando: 'esquiva', rotulo: 'Esquivar' },
  { quando: 'gastaSp', rotulo: 'A cada tanto de SP gasto' },
]

function ehJeitoDeSubir(valor: string): valor is QuandoSobe['quando'] {
  return JEITOS_DE_SUBIR.some((jeito) => jeito.quando === valor)
}

/** As técnicas da ficha com nome (as do "usar a técnica X"), com os subcartões das formas. */
function tecnicasComNome(personagem: Personagem): Referencia[] {
  const achadas: Referencia[] = []
  const juntar = (cartao: CartaoDaFicha): void => {
    if (cartao.nome.trim() !== '' && cartao.acumulador === undefined) achadas.push({ id: cartao.id, nome: cartao.nome.trim() })
    cartao.subcartoes.forEach(juntar)
  }
  for (const cartao of personagem.abas[ABA_DAS_TECNICAS] ?? []) juntar(cartao)
  return achadas
}

function subidaNova(quando: QuandoSobe['quando'], quanto: number, tecnicas: readonly Referencia[]): SubidaDoAcumulador | null {
  switch (quando) {
    case 'usaTecnica': {
      const primeira = tecnicas[0]
      return primeira === undefined ? null : { quando, tecnica: primeira, quanto }
    }
    case 'gastaSp':
      return { quando, cada: SP_DE_PARTIDA, quanto }
    default:
      return { quando, quanto }
  }
}

/** O ganho de dano ou de atributo com os valores trocados (`cada` ou `niveis`, um dos dois). */
function comValores(ganho: Extract<GanhoDoAcumulador, { ganho: 'dano' | 'atributo' }>, valores: ValorPorNivel): GanhoDoAcumulador {
  return ganho.ganho === 'dano' ? { ganho: 'dano', ...valores } : { ganho: 'atributo', atributo: ganho.atributo, ...valores }
}

/** Os valores por nível com o máximo novo: corta, ou repete o último. */
function niveisNoMaximo(niveis: readonly number[], maximo: number): number[] {
  const ultimo = niveis.at(-1) ?? 0
  return Array.from({ length: maximo }, (_, indice) => niveis[indice] ?? ultimo)
}

/** Fase ED4: o nível do começo da batalha; 0 sai da definição (o de sempre). */
function comInicial(acumulador: AcumuladorDaFicha, inicial: number): AcumuladorDaFicha {
  const { inicial: _antes, ...semInicial } = acumulador
  return inicial > 0 ? { ...semInicial, inicial: Math.min(inicial, acumulador.maximo) } : semInicial
}

function comMaximo(acumulador: AcumuladorDaFicha, maximo: number): AcumuladorDaFicha {
  const { ganho } = acumulador
  // Fase ED4: o começo nunca passa do máximo novo.
  const noTeto = comInicial(acumulador, Math.min(acumulador.inicial ?? 0, maximo))
  if ((ganho.ganho === 'dano' || ganho.ganho === 'atributo') && ganho.niveis !== undefined) return { ...noTeto, maximo, ganho: comValores(ganho, { niveis: niveisNoMaximo(ganho.niveis, maximo) }) }
  return { ...noTeto, maximo }
}

/** "10, 25, 40" → os números, se forem tantos quanto o máximo. */
function niveisDoTexto(texto: string, maximo: number): number[] | null {
  const numeros = (texto.match(/\d+/g) ?? []).map(Number)
  return numeros.length === maximo && numeros.every((numero) => Number.isInteger(numero) && numero <= DANO_MAX) ? numeros : null
}

interface EditorDoAcumuladorProps {
  personagem: Personagem
  sistema: SistemaDeRpg
  /** O acumulador que abre (o id); `null` = o primeiro da ficha. */
  inicial: string | null
  /** O que abre acabou de ser criado: o Nome vem em foco, selecionado, para já trocar. */
  nomeEmFoco?: boolean
  /** Cada mudança completa vai na hora para a ficha em edição; quem grava em disco é o Salvar da ficha. */
  onChange: (personagem: Personagem) => void
  onFechar: () => void
}

/**
 * O EDITOR DO ACUMULADOR (ED6; protótipo dos requisitos, tela 8): à esquerda os acumuladores da
 * ficha e o "+ Acumulador"; no meio o medidor, como sobe, como desce, o que cada nível dá e as
 * técnicas que usam; à direita o Testar, que roda o motor da batalha num combate de mentira. Abre
 * por cima da ficha (`<dialog>`): Esc fecha. Só o mestre.
 */
export function EditorDoAcumulador({ personagem, sistema, inicial, nomeEmFoco = false, onChange, onFechar }: EditorDoAcumuladorProps) {
  const tituloId = useId()
  const nomeId = useId()
  const janela = useRef<HTMLDialogElement>(null)
  const campoDoNome = useRef<HTMLInputElement>(null)
  const focarNome = useRef(nomeEmFoco)
  const [selecionado, setSelecionado] = useState<string | null>(inicial)
  const [nomeDigitado, setNomeDigitado] = useState<{ id: string; texto: string } | null>(null)
  const [testes, setTestes] = useState<Readonly<Record<string, EstadoDoTeste>>>({})
  const [apagando, setApagando] = useState<string | null>(null)
  const [textoDosNiveis, setTextoDosNiveis] = useState<{ id: string; texto: string } | null>(null)

  const lista = useMemo(() => acumuladoresNaFicha(personagem), [personagem])
  const tecnicas = useMemo(() => tecnicasComNome(personagem), [personagem])
  const item = lista.find((candidato) => candidato.acumulador.id === selecionado) ?? lista[0] ?? null

  useEffect(() => {
    const aberta = janela.current
    if (aberta === null) return
    const quemAbriu = document.activeElement instanceof HTMLElement ? document.activeElement : null
    aberta.showModal()
    return () => {
      aberta.close()
      quemAbriu?.focus()
    }
  }, [])

  useEffect(() => {
    if (!focarNome.current) return
    focarNome.current = false
    campoDoNome.current?.focus()
    campoDoNome.current?.select()
  }, [selecionado])

  useEffect(() => {
    if (apagando === null) return
    const relogio = window.setTimeout(() => setApagando(null), CONFIRMAR_MS)
    return () => window.clearTimeout(relogio)
  }, [apagando])

  const criar = () => {
    const novo = comAcumuladorNovo(personagem)
    onChange(novo.personagem)
    focarNome.current = true
    setSelecionado(novo.id)
  }

  const aoTeclar = (evento: KeyboardEvent<HTMLDialogElement>) => evento.stopPropagation()

  return createPortal(
    <dialog
      ref={janela}
      className="lb-ed lb-acu"
      role="dialog"
      aria-labelledby={tituloId}
      onKeyDown={aoTeclar}
      onCancel={(evento) => {
        evento.preventDefault()
        onFechar()
      }}
    >
      <header className="lb-ed__cab">
        <h2 className="lb-ed__tit" id={tituloId}>
          Acumuladores
        </h2>
        <span className="lb-ed__trilha">{personagem.nome} · entra na ficha; o Salvar da ficha grava</span>
        <div className="lb-ed__cab-acoes">
          <button type="button" className="lb-ed__bt lb-ed__bt--primario" onClick={onFechar}>
            Voltar à ficha
          </button>
        </div>
      </header>
      <div className="lb-acu__corpo">
        <nav className="lb-acu__lado" aria-label="Acumuladores da ficha">
          <p className="lb-acu__lado-tit">
            Da ficha de {personagem.nome}
            <small>Um medidor que sobe e cai na batalha: Polaridade, Fúria, Cargas, Almas…</small>
          </p>
          {lista.length === 0 ? (
            <p className="lb-ed__dica">Nenhum acumulador ainda.</p>
          ) : (
            <ul className="lb-acu__lista">
              {lista.map((candidato) => (
                <li key={candidato.acumulador.id}>
                  <button type="button" className="lb-acu__item" aria-current={candidato === item ? 'true' : undefined} onClick={() => setSelecionado(candidato.acumulador.id)}>
                    <b>{candidato.acumulador.nome}</b>
                    <small>
                      até {candidato.acumulador.maximo} · {ganhoNoNivel(candidato.acumulador, 1) === null ? 'só libera técnicas' : `${ganhoNoNivel(candidato.acumulador, 1) ?? ''} por nível`}
                      {candidato.origem === 'texto' && ' · do texto'}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="lb-ed__bt lb-ed__bt--latao lb-acu__novo" onClick={criar}>
            + Acumulador
          </button>
        </nav>
        {item === null ? (
          <div className="lb-acu__vazio">
            <p>Esta ficha não tem acumulador. Crie um ao lado: ele vira um cartão Passiva na aba Habilidades, e as técnicas passam a poder somar, pedir e gastar o nível dele.</p>
          </div>
        ) : (
          <ConfigDoAcumulador
            key={item.acumulador.id}
            item={item}
            lista={lista}
            personagem={personagem}
            sistema={sistema}
            tecnicas={tecnicas}
            nomeId={nomeId}
            campoDoNome={campoDoNome}
            nomeDigitado={nomeDigitado?.id === item.acumulador.id ? nomeDigitado.texto : null}
            onNomeDigitado={(texto) => setNomeDigitado(texto === null ? null : { id: item.acumulador.id, texto })}
            textoDosNiveis={textoDosNiveis?.id === item.acumulador.id ? textoDosNiveis.texto : null}
            onTextoDosNiveis={(texto) => setTextoDosNiveis(texto === null ? null : { id: item.acumulador.id, texto })}
            apagando={apagando === item.acumulador.id}
            onApagar={() => {
              if (apagando !== item.acumulador.id) {
                setApagando(item.acumulador.id)
                return
              }
              setApagando(null)
              setSelecionado(null)
              onChange(semOAcumulador(personagem, item))
            }}
            onChange={onChange}
          />
        )}
        {item !== null && (
          <TestarOAcumulador
            acumulador={item.acumulador}
            estado={testes[item.acumulador.id] ?? testeNovo(item.acumulador)}
            onEstado={(estado) => setTestes((antes) => ({ ...antes, [item.acumulador.id]: estado }))}
          />
        )}
      </div>
    </dialog>,
    document.body,
  )
}

interface ConfigProps {
  item: AcumuladorNaFicha
  lista: readonly AcumuladorNaFicha[]
  personagem: Personagem
  sistema: SistemaDeRpg
  tecnicas: readonly Referencia[]
  nomeId: string
  campoDoNome: RefObject<HTMLInputElement | null>
  nomeDigitado: string | null
  onNomeDigitado: (texto: string | null) => void
  textoDosNiveis: string | null
  onTextoDosNiveis: (texto: string | null) => void
  apagando: boolean
  onApagar: () => void
  onChange: (personagem: Personagem) => void
}

/** O meio do editor: as seções do acumulador escolhido. */
function ConfigDoAcumulador({ item, lista, personagem, sistema, tecnicas, nomeId, campoDoNome, nomeDigitado, onNomeDigitado, textoDosNiveis, onTextoDosNiveis, apagando, onApagar, onChange }: ConfigProps) {
  const a = item.acumulador
  const somenteLer = item.deAppNovo
  const gravar = (novo: AcumuladorDaFicha) => {
    if (!somenteLer) onChange(comOAcumuladorGravado(personagem, item, novo))
  }
  const nomeNaTela = nomeDigitado ?? a.nome
  const nomeLimpo = nomeNaTela.trim()
  const erroDoNome =
    nomeLimpo === '' ? 'Dê um nome ao acumulador.' : lista.some((outro) => outro !== item && mesmaMarca(outro.acumulador.nome, nomeLimpo)) ? `Já existe “${nomeLimpo}” nesta ficha.` : null
  const usos = usosDoAcumulador(personagem, a)
  const cheio = a.sobe.length >= REGRAS_DO_ACUMULADOR_MAX
  const rodada = a.desce.find((regra): regra is Extract<DescidaDoAcumulador, { quando: 'rodadaSemUso' }> => regra.quando === 'rodadaSemUso')
  const apanha = a.desce.find((regra): regra is Extract<DescidaDoAcumulador, { quando: 'apanha' }> => regra.quando === 'apanha')
  const comDescida = (quando: 'rodadaSemUso' | 'apanha', regra: DescidaDoAcumulador | null): AcumuladorDaFicha => {
    const outras = a.desce.filter((outra) => outra.quando !== quando)
    return { ...a, desce: regra === null ? outras : [...outras, regra] }
  }
  const trocarSubida = (indice: number, nova: AcumuladorDaFicha['sobe'][number] | null) =>
    gravar({ ...a, sobe: nova === null ? a.sobe.filter((_, atual) => atual !== indice) : a.sobe.map((regra, atual) => (atual === indice ? nova : regra)) })
  const ganho = a.ganho
  const tipoDoGanho = ganho.ganho === 'naoLido' ? 'nada' : ganho.ganho
  const atributos = sistema.atributos
  const valorDoGanho = (atual: GanhoDoAcumulador | { ganho: 'naoLido' }, partida: number): number => {
    if (atual.ganho !== 'dano' && atual.ganho !== 'atributo') return partida
    return atual.cada !== undefined ? atual.cada : (atual.niveis[0] ?? partida)
  }
  const trocarTipoDoGanho = (tipo: 'dano' | 'atributo' | 'nada') => {
    if (tipo === 'nada') return gravar({ ...a, ganho: { ganho: 'nada' } })
    if (tipo === 'dano') return gravar({ ...a, ganho: { ganho: 'dano', cada: valorDoGanho(ganho, DANO_DE_PARTIDA) } })
    const primeiro = atributos[0]
    if (primeiro !== undefined) gravar({ ...a, ganho: { ganho: 'atributo', atributo: { id: primeiro.id, nome: primeiro.nome }, cada: valorDoGanho(ganho, ATRIBUTO_DE_PARTIDA) } })
  }
  const niveisNaTira = Array.from({ length: Math.min(a.maximo, NIVEIS_NA_TIRA_MAX) }, (_, indice) => ganhoNoNivel(a, indice + 1))

  return (
    <div className="lb-acu__config">
      {item.origem === 'texto' && (
        <p className="lb-acu__nota" role="note">
          Lido do texto de «{item.cartaoNome}» (o contador de antes). Nada foi gravado: a primeira mudança aqui, ou «Guardar como acumulador», grava o acumulador novo nesse cartão. O texto fica como está.
        </p>
      )}
      {somenteLer && (
        <p className="lb-ed__alerta" role="note">
          Este acumulador tem regra de um app mais novo: atualize o app para editar. {item.avisos.join(' ')}
        </p>
      )}
      <fieldset className="lb-acu__campos" disabled={somenteLer}>
        <section className="lb-ed__linha" aria-labelledby={`${nomeId}-medidor`}>
          <div className="lb-ed__linha-cab">
            <h3 className="lb-ed__linha-nome" id={`${nomeId}-medidor`}>
              O medidor
            </h3>
            <p className="lb-ed__linha-dica">nome e até onde vai</p>
          </div>
          <div className="lb-ed__linha-corpo">
            <div className="lb-acu__linha-campos">
              <span className="lb-ed__campo">
                <label htmlFor={nomeId}>Nome</label>
                <input
                  id={nomeId}
                  ref={campoDoNome}
                  className="lb-ed__entrada lb-acu__nome"
                  value={nomeNaTela}
                  maxLength={NOME_DO_ACUMULADOR_MAX}
                  aria-invalid={erroDoNome !== null}
                  aria-describedby={erroDoNome === null ? undefined : `${nomeId}-erro`}
                  onChange={(evento) => {
                    const texto = evento.target.value
                    onNomeDigitado(texto)
                    const limpo = texto.trim()
                    if (limpo !== '' && !lista.some((outro) => outro !== item && mesmaMarca(outro.acumulador.nome, limpo))) gravar({ ...a, nome: limpo })
                  }}
                  onBlur={() => onNomeDigitado(null)}
                />
              </span>
              <CampoInteiro rotulo="Vai até o nível" valor={a.maximo} minimo={1} maximo={NIVEL_DO_ACUMULADOR_MAX} onChange={(maximo) => gravar(comMaximo(a, maximo))} />
              <CampoInteiro rotulo="Começa a batalha em" valor={a.inicial ?? 0} minimo={0} maximo={a.maximo} onChange={(inicial) => gravar(comInicial(a, inicial))} />
            </div>
            {erroDoNome !== null && (
              <p className="lb-acu__erro" id={`${nomeId}-erro`} role="alert">
                {erroDoNome}
              </p>
            )}
            <p className="lb-ed__dica">
              Começa toda batalha em {a.inicial ?? 0}. No menu da batalha aparece no topo, como “{a.nome.toUpperCase()} {a.inicial ?? 0}/{a.maximo}”.
            </p>
          </div>
        </section>

        <section className="lb-ed__linha" aria-labelledby={`${nomeId}-sobe`}>
          <div className="lb-ed__linha-cab">
            <h3 className="lb-ed__linha-nome" id={`${nomeId}-sobe`}>
              Como sobe
            </h3>
            <p className="lb-ed__linha-dica">cada jeito soma o seu</p>
          </div>
          <div className="lb-ed__linha-corpo">
            {a.sobe.length === 0 ? (
              <p className="lb-ed__dica">Nada faz subir ainda: só as técnicas que somam (a regra “Usar uma técnica”).</p>
            ) : (
              <ul className="lb-acu__regras lb-acu__regras--sobe">
                {a.sobe.map((regra, indice) => (
                  <li key={`${indice}-${regra.quando}`} className="lb-acu__regra">
                    {regra.quando === 'naoLida' ? (
                      <span className="lb-acu__regra-campos">Regra de app mais novo: fica guardada como veio.</span>
                    ) : (
                      <span className="lb-acu__regra-campos">
                        <select
                          className="lb-input lb-acu__sel"
                          aria-label="Quando sobe"
                          value={regra.quando}
                          onChange={(evento) => {
                            const quando = evento.target.value
                            const nova = ehJeitoDeSubir(quando) ? subidaNova(quando, regra.quanto, tecnicas) : null
                            if (nova !== null) trocarSubida(indice, nova)
                          }}
                        >
                          {JEITOS_DE_SUBIR.map((jeito) => (
                            <option key={jeito.quando} value={jeito.quando} disabled={jeito.quando === 'usaTecnica' && tecnicas.length === 0}>
                              {jeito.rotulo}
                            </option>
                          ))}
                        </select>
                        {regra.quando === 'usaTecnica' && (
                          <select
                            className="lb-input lb-acu__sel"
                            aria-label="Qual técnica"
                            value={String(tecnicas.findIndex((tecnica) => tecnica.id === regra.tecnica.id || mesmaMarca(tecnica.nome, regra.tecnica.nome)))}
                            onChange={(evento) => {
                              const tecnica = tecnicas[Number(evento.target.value)]
                              if (tecnica !== undefined) trocarSubida(indice, { ...regra, tecnica })
                            }}
                          >
                            {!tecnicas.some((tecnica) => tecnica.id === regra.tecnica.id || mesmaMarca(tecnica.nome, regra.tecnica.nome)) && <option value="-1">{regra.tecnica.nome} (não achada na ficha)</option>}
                            {tecnicas.map((tecnica, posicao) => (
                              <option key={tecnica.id ?? tecnica.nome} value={String(posicao)}>
                                {tecnica.nome}
                              </option>
                            ))}
                          </select>
                        )}
                        {regra.quando === 'usaTecnica' && (
                          <Marcar
                            rotulo="só se acertar"
                            marcado={regra.seAcertar === true}
                            onChange={(marcado) => {
                              const { seAcertar: _antes, ...aoUsar } = regra
                              trocarSubida(indice, marcado ? { ...aoUsar, seAcertar: true } : aoUsar)
                            }}
                          />
                        )}
                        {regra.quando === 'gastaSp' && <CampoInteiro rotulo="a cada" valor={regra.cada} minimo={1} maximo={RECURSO_DO_REQUISITO_MAX} depois="SP" onChange={(cada) => trocarSubida(indice, { ...regra, cada })} />}
                        <CampoInteiro rotulo="soma" valor={regra.quanto} minimo={1} maximo={PASSO_DO_ACUMULADOR_MAX} onChange={(quanto) => trocarSubida(indice, { ...regra, quanto })} />
                        {regra.quando === 'gastaReacao' && <span className="lb-ed__dica">vira a ação «Carregar {a.nome}» no menu</span>}
                      </span>
                    )}
                    <button type="button" className="lb-ed__bt lb-ed__bt--fantasma lb-ed__bt--p lb-acu__tirar" aria-label={`Tirar este jeito de subir`} onClick={() => trocarSubida(indice, null)}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="lb-acu__pe">
              <select
                className="lb-input lb-acu__sel"
                aria-label="Pôr um jeito de subir"
                value=""
                disabled={cheio}
                onChange={(evento) => {
                  const quando = evento.target.value
                  const nova = ehJeitoDeSubir(quando) ? subidaNova(quando, 1, tecnicas) : null
                  if (nova !== null) gravar({ ...a, sobe: [...a.sobe, nova] })
                }}
              >
                <option value="" disabled>
                  + Pôr um jeito de subir…
                </option>
                {JEITOS_DE_SUBIR.map((jeito) => (
                  <option key={jeito.quando} value={jeito.quando} disabled={jeito.quando === 'usaTecnica' && tecnicas.length === 0}>
                    {jeito.rotulo}
                  </option>
                ))}
              </select>
              <span className="lb-ed__dica">{cheio ? `No máximo ${REGRAS_DO_ACUMULADOR_MAX} jeitos de subir.` : 'pode ter vários; cada um soma o seu'}</span>
            </div>
          </div>
        </section>

        <section className="lb-ed__linha" aria-labelledby={`${nomeId}-desce`}>
          <div className="lb-ed__linha-cab">
            <h3 className="lb-ed__linha-nome" id={`${nomeId}-desce`}>
              Como desce
            </h3>
            <p className="lb-ed__linha-dica">o que tira nível</p>
          </div>
          <div className="lb-ed__linha-corpo">
            <ul className="lb-acu__regras">
              <li className="lb-acu__regra lb-acu__regra--fixa">
                <span>
                  As técnicas com <b>«e gasta»</b> nos Requisitos tiram o que gastam
                </span>
                <span className="lb-ed__dica">sempre (tipo A4)</span>
              </li>
              <li className="lb-acu__regra lb-acu__regra--fixa">
                <span>Zera no fim da batalha</span>
                <span className="lb-ed__dica">sempre: a batalha nova começa do zero</span>
              </li>
              <li className="lb-acu__regra lb-acu__regra--fixa">
                <Marcar rotulo="Cai por rodada sem subir" marcado={rodada !== undefined} onChange={(marcado) => gravar(comDescida('rodadaSemUso', marcado ? { quando: 'rodadaSemUso', quanto: 1 } : null))} />
                {rodada !== undefined && <CampoInteiro rotulo="cai" valor={rodada.quanto} minimo={1} maximo={PASSO_DO_ACUMULADOR_MAX} onChange={(quanto) => gravar(comDescida('rodadaSemUso', { quando: 'rodadaSemUso', quanto }))} />}
              </li>
              <li className="lb-acu__regra lb-acu__regra--fixa">
                <Marcar rotulo="Cai ao receber dano" marcado={apanha !== undefined} onChange={(marcado) => gravar(comDescida('apanha', marcado ? { quando: 'apanha', quanto: 1 } : null))} />
                {apanha !== undefined && (
                  <>
                    <Marcar rotulo="zera tudo" marcado={apanha.quanto === 'tudo'} onChange={(tudo) => gravar(comDescida('apanha', { quando: 'apanha', quanto: tudo ? 'tudo' : 1 }))} />
                    {apanha.quanto !== 'tudo' && <CampoInteiro rotulo="cai" valor={apanha.quanto} minimo={1} maximo={PASSO_DO_ACUMULADOR_MAX} onChange={(quanto) => gravar(comDescida('apanha', { quando: 'apanha', quanto }))} />}
                  </>
                )}
              </li>
              {a.desce.some((regra) => regra.quando === 'naoLida') && (
                <li className="lb-acu__regra lb-acu__regra--fixa">
                  <span className="lb-ed__dica">Uma regra de cair de app mais novo fica guardada como veio.</span>
                </li>
              )}
            </ul>
          </div>
        </section>

        <section className="lb-ed__linha" aria-labelledby={`${nomeId}-da`}>
          <div className="lb-ed__linha-cab">
            <h3 className="lb-ed__linha-nome" id={`${nomeId}-da`}>
              Cada nível dá
            </h3>
            <p className="lb-ed__linha-dica">ou só libera técnicas</p>
          </div>
          <div className="lb-ed__linha-corpo">
            <Escolha
              legenda="O que cada nível dá"
              valor={tipoDoGanho}
              opcoes={[
                { valor: 'dano', rotulo: 'Dano' },
                { valor: 'atributo', rotulo: 'Atributo', bloqueio: atributos.length === 0 ? 'O sistema não tem atributo' : null },
                { valor: 'nada', rotulo: 'Nada (só libera)' },
              ]}
              onChange={trocarTipoDoGanho}
            />
            {ganho.ganho === 'naoLido' && <p className="lb-ed__dica">O ganho guardado não se lê aqui; escolha de novo para trocar.</p>}
            {(ganho.ganho === 'dano' || ganho.ganho === 'atributo') && (
              <div className="lb-acu__linha-campos">
                {ganho.cada !== undefined ? (
                  <CampoInteiro rotulo="Cada nível +" valor={ganho.cada} minimo={1} maximo={DANO_MAX} depois={ganho.ganho === 'dano' ? 'de dano em todo golpe que acerta, por nível' : undefined} onChange={(cada) => gravar({ ...a, ganho: comValores(ganho, { cada }) })} />
                ) : (
                  <span className="lb-ed__campo">
                    <label htmlFor={`${nomeId}-niveis`}>Um valor por nível ({a.maximo})</label>
                    <input
                      id={`${nomeId}-niveis`}
                      className="lb-ed__entrada lb-acu__niveis"
                      value={textoDosNiveis ?? ganho.niveis.join(', ')}
                      onChange={(evento) => {
                        onTextoDosNiveis(evento.target.value)
                        const niveis = niveisDoTexto(evento.target.value, a.maximo)
                        if (niveis !== null) gravar({ ...a, ganho: comValores(ganho, { niveis }) })
                      }}
                      onBlur={() => onTextoDosNiveis(null)}
                    />
                  </span>
                )}
                {ganho.ganho === 'atributo' && (
                  <>
                    <span className="lb-ed__dica">de</span>
                    <select
                      className="lb-input lb-acu__sel"
                      aria-label="Qual atributo"
                      value={ganho.atributo.id ?? ''}
                      onChange={(evento) => {
                        const atributo = atributos.find((candidato) => candidato.id === evento.target.value)
                        if (atributo !== undefined) gravar({ ...a, ganho: { ...ganho, atributo: { id: atributo.id, nome: atributo.nome } } })
                      }}
                    >
                      {atributos.map((atributo) => (
                        <option key={atributo.id} value={atributo.id}>
                          {atributo.nome}
                        </option>
                      ))}
                    </select>
                    <span className="lb-ed__dica">por nível</span>
                  </>
                )}
                <button
                  type="button"
                  className="lb-ed__bt lb-ed__bt--fantasma lb-ed__bt--p"
                  onClick={() =>
                    gravar(
                      ganho.cada !== undefined
                        ? { ...a, ganho: comValores(ganho, { niveis: Array.from({ length: a.maximo }, (_, indice) => Math.min(DANO_MAX, (ganho.cada ?? 0) * (indice + 1))) }) }
                        : { ...a, ganho: comValores(ganho, { cada: Math.max(1, ganho.niveis[0] ?? 1) }) },
                    )
                  }
                >
                  {ganho.cada !== undefined ? 'Um valor por nível' : 'Igual em todo nível'}
                </button>
              </div>
            )}
            {niveisNaTira.some((texto) => texto !== null) && (
              <div className="lb-acu__niveis-tira">
                {niveisNaTira.map((texto, indice) => (
                  <span key={indice} className="lb-acu__nivel">
                    Nível {indice + 1}: {texto}
                  </span>
                ))}
                {a.maximo > NIVEIS_NA_TIRA_MAX && <span className="lb-ed__dica">… até o nível {a.maximo}</span>}
              </div>
            )}
          </div>
        </section>
      </fieldset>

      <section className="lb-ed__linha" aria-labelledby={`${nomeId}-usos`}>
        <div className="lb-ed__linha-cab">
          <h3 className="lb-ed__linha-nome" id={`${nomeId}-usos`}>
            Técnicas que usam
          </h3>
          <p className="lb-ed__linha-dica">somam, pedem, gastam</p>
        </div>
        <div className="lb-ed__linha-corpo">
          {usos.length === 0 ? (
            <p className="lb-ed__dica">Nenhuma técnica usa {a.nome} ainda.</p>
          ) : (
            <ul className="lb-acu__usos">
              {usos.map((uso) => (
                <li key={uso.chave} className="lb-acu__uso">
                  <b>{uso.tecnica}</b>
                  <span>{uso.oQue}</span>
                  <small>{uso.nota}</small>
                </li>
              ))}
            </ul>
          )}
          <p className="lb-ed__dica">
            Para uma técnica <b>somar</b>, abra o editor dela e use «Soma num acumulador» nos Efeitos (ou ponha aqui o jeito “Usar uma técnica”). Para <b>pedir</b> ou <b>gastar</b>, use o tipo A4 nos Requisitos dela.
          </p>
        </div>
      </section>

      <section className="lb-acu__palavras" aria-live="polite">
        <p className="lb-req__resumo-tit">Em palavras</p>
        <ul>
          {frasesDoAcumulador(a).map((frase) => (
            <li key={frase}>{frase}.</li>
          ))}
        </ul>
      </section>

      <div className="lb-acu__acoes">
        {item.origem === 'texto' && (
          <button type="button" className="lb-ed__bt lb-ed__bt--latao" onClick={() => gravar(a)}>
            Guardar como acumulador
          </button>
        )}
        {item.origem === 'bloco' && !somenteLer && (
          <button type="button" className="lb-ed__bt lb-ed__bt--fantasma lb-acu__apagar" data-confirmando={apagando ? '' : undefined} onClick={onApagar}>
            {apagando ? `Clique de novo para apagar ${a.nome}` : `Apagar ${a.nome}`}
          </button>
        )}
      </div>
    </div>
  )
}

/** O teste que imita a batalha (só aqui; nada vai à batalha): os botões dos acontecimentos, o medidor e o registro. */
function TestarOAcumulador({ acumulador, estado, onEstado }: { acumulador: AcumuladorDaFicha; estado: EstadoDoTeste; onEstado: (estado: EstadoDoTeste) => void }) {
  const nivel = Math.min(acumulador.maximo, nivelDoAcumulador(estado.combate, acumulador.id))
  const da = ganhoNoNivel(acumulador, nivel)
  const eventos = eventosDoTeste(acumulador)
  const segmentos = acumulador.maximo <= SEGMENTOS_MAX
  return (
    <aside className="lb-ed__ver lb-acu__teste" aria-label={`Testar ${acumulador.nome}`}>
      <p className="lb-acu__teste-tit">Testar · só aqui, nada vai à batalha</p>
      <div className="lb-acu__medidor" role="img" aria-label={`${acumulador.nome} ${nivel} de ${acumulador.maximo}`}>
        <div className="lb-acu__medidor-cab">
          <span>{acumulador.nome}</span>
          <span className="lb-acu__medidor-n">
            {nivel}/{acumulador.maximo}
          </span>
        </div>
        {segmentos ? (
          <div className="lb-acu__segs">
            {Array.from({ length: acumulador.maximo }, (_, indice) => (
              <span key={indice} className="lb-acu__seg" data-cheio={indice < nivel ? '' : undefined} />
            ))}
          </div>
        ) : (
          <div className="lb-acu__barra">
            <span style={{ transform: `scaleX(${nivel / acumulador.maximo})` }} />
          </div>
        )}
      </div>
      <p className="lb-acu__teste-da">{acumulador.ganho.ganho === 'nada' ? 'Não dá nada sozinho: serve para liberar técnicas.' : nivel === 0 || da === null ? 'No nível 0 não dá nada.' : <>Agora dá <b>{da}</b>.</>}</p>
      <div className="lb-acu__eventos" role="group" aria-label="Acontece na batalha">
        {eventos.map((evento) => (
          <button key={evento.rotulo} type="button" className="lb-ed__bt lb-ed__bt--p" onClick={() => onEstado(passoDoTeste(acumulador, estado, evento))}>
            {evento.rotulo}
          </button>
        ))}
      </div>
      {estado.registro.length === 0 ? (
        <p className="lb-ed__dica">Clique num acontecimento para ver o medidor mudar.</p>
      ) : (
        <ol className="lb-acu__registro" aria-label="O que aconteceu no teste">
          {estado.registro.map((linha, indice) => (
            <li key={`${estado.registro.length - indice}`}>{linha}</li>
          ))}
        </ol>
      )}
      <button type="button" className="lb-ed__bt lb-ed__bt--fantasma lb-ed__bt--p lb-acu__recomecar" disabled={estado.registro.length === 0} onClick={() => onEstado(testeNovo())}>
        Recomeçar o teste
      </button>
    </aside>
  )
}
