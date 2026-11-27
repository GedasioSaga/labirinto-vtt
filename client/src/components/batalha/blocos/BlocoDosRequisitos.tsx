import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { normalizar } from '../../../lib/batalha/formula'
import { ehNaoLido, ehUmDestes, TIPOS_DE_REQUISITO, type ObjetoJson, type OpcaoDoUmDestes, type PecaDoGrupo, type ValorJson } from '../../../lib/batalha/requisitos/modelo'
import { fraseDoRequisito } from '../../../lib/batalha/requisitos/frases'
import {
  COMO_CONFERE_NA_TELA,
  ehObjetoJson,
  GRUPOS_DOS_REQUISITOS,
  idNovo,
  LIGACOES_NA_TELA,
  nomeDaReferencia,
  numeroDoJson,
  referenciaJson,
  requisitoNovo,
  textoDoJson,
  tipoNaTela,
  TIPOS_NA_TELA,
  type CampoDoRequisito,
  type LigacaoDaForma,
  type OpcoesDasFontes,
  type TipoNaTela,
} from './requisitosNaTela'

/** As listas de sugestão dos campos de texto (os selos que o app conhece, as marcas das fichas). */
export interface ListasDosRequisitos {
  selos: readonly string[]
  marcas: readonly string[]
}

interface BlocoDosRequisitosProps {
  /** A raiz "Todos estes" como o disco a guarda (o JSON de `todos`). */
  todos: readonly ValorJson[]
  /** A mesma raiz lida (`lerRequisitos`), peça por peça na mesma ordem: a frase e o motivo do torto. */
  lidos: readonly PecaDoGrupo[]
  fontes: OpcoesDasFontes
  listas: ListasDosRequisitos
  /** O que aparece sem nenhum requisito. */
  vazio: string
  onChange: (todos: ValorJson[]) => void
  /** D8: as ligações da forma na busca (só na linha Requisitos; a Evolução não as tem). */
  ligacoes?: LigacoesNaBusca
}

/** As ligações da forma oferecidas na busca: as que já estão no bloco não aparecem de novo. */
export interface LigacoesNaBusca {
  ativas: readonly LigacaoDaForma[]
  onPor: (ligacao: LigacaoDaForma) => void
}

/** Um grupo na tela: os requisitos soltos em sequência ("Todos estes") ou um "Um destes" do JSON. */
type GrupoNaTela = { modo: 'todos'; indices: number[] } | { modo: 'um'; indice: number }

function gruposNaTela(todos: readonly ValorJson[]): GrupoNaTela[] {
  const grupos: GrupoNaTela[] = []
  todos.forEach((peca, indice) => {
    if (ehObjetoJson(peca) && Array.isArray(peca.umDestes)) {
      grupos.push({ modo: 'um', indice })
      return
    }
    const ultimo = grupos.at(-1)
    if (ultimo !== undefined && ultimo.modo === 'todos') ultimo.indices.push(indice)
    else grupos.push({ modo: 'todos', indices: [indice] })
  })
  return grupos
}

function opcoesDoUmDestes(peca: ValorJson | undefined): ValorJson[] {
  return ehObjetoJson(peca) && Array.isArray(peca.umDestes) ? [...peca.umDestes] : []
}

/** A peça lida de uma opção do "Um destes", na mesma ordem do JSON. */
function lidaDaOpcao(lida: PecaDoGrupo | undefined, indice: number): OpcaoDoUmDestes | undefined {
  return lida !== undefined && ehUmDestes(lida) ? lida.umDestes[indice] : undefined
}

/** O id guardado da peça (a chave da linha na tela). */
function idDaPeca(peca: ValorJson | undefined): string {
  return ehObjetoJson(peca) ? textoDoJson(peca, 'id') : ''
}

const semAcento = (texto: string): string => normalizar(texto).trim()

// ─── A busca dos tipos ──────────────────────────────────────────────────────

interface EscolhaDoTipoProps {
  onEscolher: (tipo: TipoNaTela, texto?: string) => void
  onFechar: () => void
  ligacoes?: LigacoesNaBusca
}

/**
 * "+ Requisito": a busca nos 41 tipos, com pulo por letra, setas e Esc (protótipo, `pickerHTML`).
 * Busca sem achado oferece "Pôr como personalizado" (J1 com o texto buscado).
 */
function EscolhaDoTipo({ onEscolher, onFechar, ligacoes }: EscolhaDoTipoProps) {
  const listaId = useId()
  const [busca, setBusca] = useState('')
  const entrada = useRef<HTMLInputElement>(null)
  const lista = useRef<HTMLDivElement>(null)
  useEffect(() => entrada.current?.focus({ preventScroll: true }), [])
  const q = semAcento(busca)
  const achados = useMemo(() => TIPOS_NA_TELA.filter((t) => q === '' || semAcento(`${t.letra} ${t.nome} ${t.exemplo}`).includes(q)), [q])
  const ativas = ligacoes?.ativas
  const ligacoesAchadas = useMemo(
    () => (ativas === undefined ? [] : LIGACOES_NA_TELA.filter((l) => !ativas.includes(l.ligacao) && (q === '' || semAcento(`${l.letra} ${l.nome} ${l.exemplo}`).includes(q)))),
    [ativas, q],
  )
  const nadaAchado = achados.length === 0 && ligacoesAchadas.length === 0
  const personalizado = TIPOS_NA_TELA.find((t) => t.tipo === 'personalizado')

  const botoes = (): HTMLButtonElement[] => Array.from(lista.current?.querySelectorAll<HTMLButtonElement>('button.lb-req__op') ?? [])
  const aoTeclar = (evento: KeyboardEvent<HTMLDivElement>) => {
    if (evento.key === 'Escape') {
      // O Esc fecha só a busca, não o editor inteiro.
      evento.preventDefault()
      evento.stopPropagation()
      onFechar()
      return
    }
    if (evento.key !== 'ArrowDown' && evento.key !== 'ArrowUp') return
    evento.preventDefault()
    const todos = botoes()
    if (todos.length === 0) return
    const agora = todos.findIndex((botao) => botao === document.activeElement)
    const proximo = evento.key === 'ArrowDown' ? (agora + 1) % todos.length : agora <= 0 ? todos.length - 1 : agora - 1
    todos[proximo]?.focus()
  }

  return (
    <div className="lb-req__busca" role="dialog" aria-label="Pôr requisito" onKeyDown={aoTeclar}>
      <input
        ref={entrada}
        className="lb-ed__entrada"
        type="search"
        value={busca}
        placeholder="Buscar: SP, selo, aliado, forma, A4…"
        aria-label="Buscar requisito"
        aria-controls={listaId}
        autoComplete="off"
        onChange={(evento) => setBusca(evento.target.value)}
        onKeyDown={(evento) => {
          if (evento.key === 'Enter') {
            evento.preventDefault()
            const primeiro = achados[0]
            const primeiraLigacao = ligacoesAchadas[0]
            if (primeiro !== undefined) onEscolher(primeiro)
            else if (primeiraLigacao !== undefined && ligacoes !== undefined) ligacoes.onPor(primeiraLigacao.ligacao)
            else if (personalizado !== undefined && busca.trim() !== '') onEscolher(personalizado, busca.trim())
          }
        }}
      />
      <div className="lb-req__letras" role="toolbar" aria-label="Ir ao grupo">
        {GRUPOS_DOS_REQUISITOS.map(({ letra, nome }) => (
          <button
            key={letra}
            type="button"
            className="lb-req__letra"
            title={`${letra}. ${nome}`}
            aria-label={`${letra}: ${nome}`}
            onClick={() => lista.current?.querySelector(`[data-grupo="${letra}"]`)?.scrollIntoView({ block: 'start' })}
          >
            {letra}
          </button>
        ))}
      </div>
      <div className="lb-req__lista" id={listaId} ref={lista}>
        {nadaAchado ? (
          <div className="lb-req__nada">
            <span>Nada com "{busca}". O que o app não confere sozinho vira personalizado:</span>
            {personalizado !== undefined && (
              <button type="button" className="lb-ed__bt lb-ed__bt--latao lb-ed__bt--p lb-req__op" onClick={() => onEscolher(personalizado, busca.trim())}>
                Pôr como personalizado: "{busca.trim()}"
              </button>
            )}
          </div>
        ) : (
          GRUPOS_DOS_REQUISITOS.map(({ letra, nome }) => {
            const doGrupo = achados.filter((t) => t.letra.startsWith(letra))
            const ligacoesDoGrupo = ligacoesAchadas.filter((l) => l.letra.startsWith(letra))
            if (doGrupo.length === 0 && ligacoesDoGrupo.length === 0) return null
            return (
              <div key={letra} role="group" aria-label={`${letra}. ${nome}`}>
                <p className="lb-req__grupo-nome" data-grupo={letra}>
                  {letra}. {nome}
                </p>
                {doGrupo.map((t) => {
                  const confere = COMO_CONFERE_NA_TELA[TIPOS_DE_REQUISITO[t.tipo].confere]
                  return (
                    <button key={t.tipo} type="button" className="lb-req__op" onClick={() => onEscolher(t)}>
                      <span className="lb-req__cod">{t.letra}</span>
                      <b>{t.nome}</b>
                      <span className="lb-ed__etq" data-confere={TIPOS_DE_REQUISITO[t.tipo].confere} title={confere.longo}>
                        {confere.curto}
                      </span>
                      <small>{t.exemplo}</small>
                    </button>
                  )
                })}
                {ligacoes !== undefined &&
                  ligacoesDoGrupo.map((l) => (
                    <button key={l.ligacao} type="button" className="lb-req__op" onClick={() => ligacoes.onPor(l.ligacao)}>
                      <span className="lb-req__cod">{l.letra}</span>
                      <b>{l.nome}</b>
                      <span className="lb-ed__etq" title="Ligação da forma: vale no cartão inteiro, não num grupo">
                        novo
                      </span>
                      <small>{l.exemplo}</small>
                    </button>
                  ))}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ─── Um campo da frase ──────────────────────────────────────────────────────

interface CampoProps {
  campo: CampoDoRequisito
  peca: ObjetoJson
  fontes: OpcoesDasFontes
  listas: ListasDosRequisitos
  listaId: string
  onChange: (peca: ObjetoJson) => void
}

function CampoDaFrase({ campo, peca, fontes, listas, listaId, onChange }: CampoProps) {
  const pondo = (chave: string, valor: ValorJson | undefined): ObjetoJson => {
    const { [chave]: _antes, ...resto } = peca
    return valor === undefined ? resto : { ...resto, [chave]: valor }
  }
  switch (campo.tipo) {
    case 'numero': {
      const valor = numeroDoJson(peca, campo.chave) ?? campo.partida
      return (
        <input
          className="lb-req__num"
          type="number"
          inputMode="numeric"
          min={campo.minimo}
          max={campo.maximo}
          value={valor}
          aria-label={campo.rotulo}
          onChange={(evento) => {
            const lido = Number.parseInt(evento.target.value, 10)
            if (Number.isNaN(lido)) return
            onChange(pondo(campo.chave, Math.min(campo.maximo, Math.max(campo.minimo, lido))))
          }}
        />
      )
    }
    case 'escolha':
      return (
        <select className="lb-req__sel" value={textoDoJson(peca, campo.chave)} aria-label={campo.rotulo} onChange={(evento) => onChange(pondo(campo.chave, evento.target.value))}>
          {campo.opcoes.map((opcao) => (
            <option key={opcao.valor} value={opcao.valor}>
              {opcao.rotulo}
            </option>
          ))}
        </select>
      )
    case 'bandeira':
      return (
        <select className="lb-req__sel" value={peca[campo.chave] === true ? 'sim' : 'nao'} aria-label={campo.rotulo} onChange={(evento) => onChange(pondo(campo.chave, evento.target.value === 'sim' ? true : undefined))}>
          <option value="nao">{campo.nao}</option>
          <option value="sim">{campo.sim}</option>
        </select>
      )
    case 'texto': {
      const lista = campo.lista === undefined ? undefined : `${listaId}-${campo.lista}`
      return (
        <>
          <input
            className="lb-req__txt"
            value={textoDoJson(peca, campo.chave)}
            maxLength={campo.maximo}
            placeholder={campo.rotulo}
            aria-label={campo.rotulo}
            list={lista}
            onChange={(evento) => onChange(pondo(campo.chave, campo.opcional === true && evento.target.value.trim() === '' ? undefined : evento.target.value))}
          />
          {lista !== undefined && (
            <datalist id={lista}>
              {(campo.lista === 'selos' ? listas.selos : listas.marcas).map((nome) => (
                <option key={nome} value={nome} />
              ))}
            </datalist>
          )}
        </>
      )
    }
    case 'referencia': {
      const opcoes = fontes[campo.fonte]
      const nome = nomeDaReferencia(peca, campo.chave)
      // Item e arma vão pelo nome (o que casa vindo de outra ficha); com a lista de sugestões. O acumulador
      // também, só quando a ficha não tem nenhum (ED6): com acumulador na ficha, a lista dela, como as técnicas.
      if (campo.fonte === 'item' || campo.fonte === 'arma' || (campo.fonte === 'acumulador' && opcoes.length === 0)) {
        const lista = `${listaId}-${campo.fonte}`
        return (
          <>
            <input
              className="lb-req__txt"
              value={nome}
              placeholder={campo.rotulo}
              aria-label={campo.rotulo}
              list={lista}
              onChange={(evento) => {
                const achada = opcoes.find((opcao) => semAcento(opcao.nome) === semAcento(evento.target.value))
                onChange(pondo(campo.chave, achada === undefined ? { nome: evento.target.value } : referenciaJson(achada)))
              }}
            />
            <datalist id={lista}>
              {opcoes.map((opcao) => (
                <option key={opcao.id ?? opcao.nome} value={opcao.nome} />
              ))}
            </datalist>
          </>
        )
      }
      const atual = opcoes.findIndex((opcao) => semAcento(opcao.nome) === semAcento(nome))
      return (
        <select
          className="lb-req__sel"
          value={atual >= 0 ? String(atual) : nome === '' ? '' : 'guardado'}
          aria-label={campo.rotulo}
          onChange={(evento) => {
            if (evento.target.value === '') {
              onChange(pondo(campo.chave, undefined))
              return
            }
            const escolhida = opcoes[Number(evento.target.value)]
            if (escolhida !== undefined) onChange(pondo(campo.chave, referenciaJson(escolhida)))
          }}
        >
          {(campo.opcional === true || nome === '') && <option value="">{campo.opcional === true ? 'qualquer uma' : `escolha ${campo.rotulo.toLowerCase()}`}</option>}
          {atual < 0 && nome !== '' && <option value="guardado">{nome} (não achada na ficha)</option>}
          {opcoes.map((opcao, indice) => (
            <option key={opcao.id ?? opcao.nome} value={String(indice)}>
              {opcao.nome}
            </option>
          ))}
        </select>
      )
    }
  }
}

// ─── Uma linha ──────────────────────────────────────────────────────────────

interface LinhaDoRequisitoProps {
  peca: ValorJson
  lida: OpcaoDoUmDestes | undefined
  fontes: OpcoesDasFontes
  listas: ListasDosRequisitos
  onChange: (peca: ObjetoJson) => void
  onTirar: () => void
}

function LinhaDoRequisito({ peca, lida, fontes, listas, onChange, onTirar }: LinhaDoRequisitoProps) {
  const listaId = useId()
  const objeto = ehObjetoJson(peca) ? peca : {}
  const tipoLido = textoDoJson(objeto, 'tipo')
  const t = tipoNaTela(tipoLido)
  const frase = lida === undefined ? '' : fraseDoRequisito(lida)
  if (t === undefined) {
    return (
      <li className="lb-req__lin" data-torto="">
        <span className="lb-req__cod">?</span>
        <span className="lb-req__frase">{frase || 'Requisito de app mais novo: atualize o app'}</span>
        <button type="button" className="lb-ed__bt lb-ed__bt--fantasma lb-ed__bt--p lb-ed__bt--ic" aria-label="Tirar este requisito" onClick={onTirar}>
          ×
        </button>
      </li>
    )
  }
  const ficha = TIPOS_DE_REQUISITO[t.tipo]
  const confere = COMO_CONFERE_NA_TELA[ficha.confere]
  const marcar = (chave: 'nao' | 'gasta', marcado: boolean) => {
    const { [chave]: _antes, ...resto } = objeto
    onChange(marcado ? { ...resto, [chave]: true } : resto)
  }
  const torto = lida !== undefined && ehNaoLido(lida) ? lida.motivo : null
  return (
    <li className="lb-req__lin" data-torto={torto === null ? undefined : ''} data-nao={objeto.nao === true ? '' : undefined}>
      <span className="lb-req__cod" title={t.nome}>
        {t.letra}
      </span>
      <span className="lb-req__frase">
        {objeto.nao === true && <b className="lb-req__nao">não: </b>}
        {t.molde.map((parte, indice) =>
          typeof parte === 'string' ? <span key={indice}>{parte}</span> : <CampoDaFrase key={indice} campo={parte} peca={objeto} fontes={fontes} listas={listas} listaId={listaId} onChange={onChange} />,
        )}
      </span>
      <span className="lb-req__opcoes">
        {ficha.aceitaNao && (
          <label className="lb-req__marca">
            <input type="checkbox" checked={objeto.nao === true} onChange={(evento) => marcar('nao', evento.target.checked)} />
            <span>não ter</span>
          </label>
        )}
        {ficha.aceitaGasta && (
          <label className="lb-req__marca">
            <input type="checkbox" checked={objeto.gasta === true} onChange={(evento) => marcar('gasta', evento.target.checked)} />
            <span>e gasta</span>
          </label>
        )}
        <span className="lb-ed__etq" data-confere={ficha.confere} title={confere.longo}>
          {confere.curto}
        </span>
        <button type="button" className="lb-ed__bt lb-ed__bt--fantasma lb-ed__bt--p lb-ed__bt--ic" aria-label={`Tirar: ${frase || t.nome}`} onClick={onTirar}>
          ×
        </button>
      </span>
      {torto !== null && <span className="lb-req__torto">Ainda não vale: {torto}.</span>}
    </li>
  )
}

// ─── O bloco ────────────────────────────────────────────────────────────────

/**
 * O BLOCO DOS REQUISITOS (REQUISITOS.md §9; protótipo `requisitos/prototipo.html`, tela 1): grupos
 * "Todos estes" e "Um destes" ligados por "e também", "+ Requisito" com a busca nos 41 tipos, os
 * campos de cada tipo em frase, "não ter" e "e gasta" onde cabem e o selo de quem confere. Sem teto
 * de quantidade (decisão do dono, 23/11). Grava sempre no campo `requisitos` do cartão, fora da
 * mecânica. Usado na linha Requisitos (para usar) e na linha Evolução (para evoluir).
 */
export function BlocoDosRequisitos({ todos, lidos, fontes, listas, vazio, onChange, ligacoes }: BlocoDosRequisitosProps) {
  /** Onde a busca está aberta: o grupo (pelo índice do primeiro requisito ou do "Um destes"), ou o fim. */
  const [buscando, setBuscando] = useState<string | null>(null)
  const grupos = gruposNaTela(todos)

  const por = (t: TipoNaTela, texto: string | undefined, onde: GrupoNaTela | 'novo' | 'novoUm') => {
    const peca = requisitoNovo(t, fontes, texto)
    const lista = [...todos]
    if (onde === 'novo') lista.push(peca)
    else if (onde === 'novoUm') lista.push({ id: idNovo(), umDestes: [peca] })
    else if (onde.modo === 'todos') lista.splice((onde.indices.at(-1) ?? lista.length - 1) + 1, 0, peca)
    else {
      const grupo = lista[onde.indice]
      if (ehObjetoJson(grupo)) lista[onde.indice] = { ...grupo, umDestes: [...opcoesDoUmDestes(grupo), peca] }
    }
    setBuscando(null)
    onChange(lista)
  }
  const trocarModo = (grupo: GrupoNaTela) => {
    const lista = [...todos]
    if (grupo.modo === 'um') {
      lista.splice(grupo.indice, 1, ...opcoesDoUmDestes(lista[grupo.indice]))
    } else {
      const primeiro = grupo.indices[0] ?? 0
      const pecas = grupo.indices.map((indice) => todos[indice]).filter((peca): peca is ValorJson => peca !== undefined)
      lista.splice(primeiro, grupo.indices.length, { id: idNovo(), umDestes: pecas })
    }
    onChange(lista)
  }
  const tirarGrupo = (grupo: GrupoNaTela) => {
    const fora = new Set(grupo.modo === 'um' ? [grupo.indice] : grupo.indices)
    onChange(todos.filter((_peca, indice) => !fora.has(indice)))
  }
  const mudarPeca = (indice: number, peca: ObjetoJson) => onChange(todos.map((atual, i) => (i === indice ? peca : atual)))
  const tirarPeca = (indice: number) => onChange(todos.filter((_peca, i) => i !== indice))
  const mudarOpcao = (indiceDoGrupo: number, indice: number, peca: ObjetoJson | null) => {
    const grupo = todos[indiceDoGrupo]
    if (!ehObjetoJson(grupo)) return
    const opcoes = opcoesDoUmDestes(grupo)
    const novas = peca === null ? opcoes.filter((_opcao, i) => i !== indice) : opcoes.map((atual, i) => (i === indice ? peca : atual))
    onChange(todos.map((atual, i) => (i === indiceDoGrupo ? { ...grupo, umDestes: novas } : atual)))
  }

  const chaveDo = (grupo: GrupoNaTela): string => (grupo.modo === 'um' ? `um-${grupo.indice}` : `todos-${grupo.indices[0] ?? 0}`)
  const botaoDePor = (chave: string, rotulo: string, onEscolher: (t: TipoNaTela, texto?: string) => void) => (
    <div className="lb-req__ancora">
      <button type="button" className="lb-ed__bt lb-ed__bt--latao lb-ed__bt--p" aria-haspopup="dialog" aria-expanded={buscando === chave} onClick={() => setBuscando(buscando === chave ? null : chave)}>
        + {rotulo}
      </button>
      {buscando === chave && (
        <EscolhaDoTipo
          onEscolher={onEscolher}
          onFechar={() => setBuscando(null)}
          ligacoes={
            ligacoes === undefined
              ? undefined
              : {
                  ativas: ligacoes.ativas,
                  onPor: (ligacao) => {
                    setBuscando(null)
                    ligacoes.onPor(ligacao)
                  },
                }
          }
        />
      )}
    </div>
  )

  return (
    <div className="lb-req">
      {grupos.length === 0 && <p className="lb-ed__vazio">{vazio}</p>}
      {grupos.map((grupo, posicao) => {
        const chave = chaveDo(grupo)
        const nome = grupo.modo === 'todos' ? (posicao > 0 ? 'E também todos estes' : 'Todos estes') : 'Um destes'
        return (
          <div key={chave} className="lb-req__grupo-envolto">
            {posicao > 0 && (
              <p className="lb-req__e" aria-hidden="true">
                e também
              </p>
            )}
            <div className="lb-req__grupo" data-modo={grupo.modo} role="group" aria-label={`Grupo ${posicao + 1}: ${nome}`}>
              <div className="lb-req__grupo-cab">
                <span className="lb-req__grupo-tit">{nome}</span>
                <span className="lb-ed__dica">{grupo.modo === 'todos' ? 'precisa de todos' : 'basta um: quem usa escolhe na hora'}</span>
                <button type="button" className="lb-ed__link" onClick={() => trocarModo(grupo)}>
                  {grupo.modo === 'todos' ? 'Virar "Um destes"' : 'Virar "Todos estes"'}
                </button>
                <button type="button" className="lb-ed__bt lb-ed__bt--fantasma lb-ed__bt--p lb-ed__bt--ic" aria-label={`Tirar o grupo ${posicao + 1}`} onClick={() => tirarGrupo(grupo)}>
                  ×
                </button>
              </div>
              <ul className="lb-req__lins">
                {grupo.modo === 'todos'
                  ? grupo.indices.map((indice) => {
                      const lida = lidos[indice]
                      return (
                        <LinhaDoRequisito
                          key={idDaPeca(todos[indice]) || `i${indice}`}
                          peca={todos[indice] ?? null}
                          lida={lida === undefined || ehUmDestes(lida) ? undefined : lida}
                          fontes={fontes}
                          listas={listas}
                          onChange={(peca) => mudarPeca(indice, peca)}
                          onTirar={() => tirarPeca(indice)}
                        />
                      )
                    })
                  : opcoesDoUmDestes(todos[grupo.indice]).map((opcao, indice) => (
                      <LinhaDoRequisito
                        key={idDaPeca(opcao) || `i${indice}`}
                        peca={opcao}
                        lida={lidaDaOpcao(lidos[grupo.indice], indice)}
                        fontes={fontes}
                        listas={listas}
                        onChange={(peca) => mudarOpcao(grupo.indice, indice, peca)}
                        onTirar={() => mudarOpcao(grupo.indice, indice, null)}
                      />
                    ))}
              </ul>
              {grupo.modo === 'um' && opcoesDoUmDestes(todos[grupo.indice]).length === 1 && <p className="lb-ed__dica">Com um só, "Um destes" vale o mesmo que "Todos estes".</p>}
              {botaoDePor(chave, 'Requisito', (t, texto) => por(t, texto, grupo))}
            </div>
          </div>
        )
      })}
      <div className="lb-req__pe">
        {grupos.length === 0 && botaoDePor('novo', 'Requisito', (t, texto) => por(t, texto, 'novo'))}
        {botaoDePor('novoUm', 'Um destes', (t, texto) => por(t, texto, 'novoUm'))}
        <span className="lb-ed__dica">Os grupos valem juntos. Sem o requisito, a habilidade fica cinza com o motivo, e o mestre pode usar mesmo assim.</span>
      </div>
    </div>
  )
}
