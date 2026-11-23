import { memo, useCallback, useEffect, useId, useMemo, useState } from 'react'
import { formaQueCabeNoAntigo, type AntesDoAlcance, type AntigoSemAlcance, type DadosDosAntigos, type EscolhaDoAlcance, type ListaDosAntigos, type PropostaDeAlcance } from '../../lib/batalha/alcance/antigos'
import { descreverAlcance, type FormaDoAlcance } from '../../lib/batalha/alcance/forma'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { confirmarAlcanceDosAntigos, desfazerAlcanceDosAntigos, ensaiarAlcanceDosAntigos, lerPropostasDoAlcance, type PropostasLidas } from '../../stores/alcanceDosAntigos'
import { useToastStore } from '../../stores/toastStore'
import { CampoDoAlcance } from '../batalha/alcance/CampoDoAlcance'
import { GlifoDoAlcance } from '../batalha/alcance/EscolhaDaForma'
import '../batalha/alcance/alcance.css'
import { formatarNumero } from './comum'

/**
 * "DAR ALCANCE AOS ANTIGOS" das páginas Itens e Habilidades (fase G,
 * docs/design/habilidades/ALCANCE.md §9; o dono, 22/11: "Eu preencho e você confere").
 * O mesmo jeito do "Juntar as armas": a LISTA primeiro, cada linha com a proposta do Claude
 * (a forma desenhada, a frase, a certeza e o trecho do texto que a justifica), e o mestre
 * aceita, muda ou deixa sem alcance. Nada se grava antes do Confirmar; o que fica "Não mexer"
 * continua sem casas (a mesa não confere a distância dele). Depois do Confirmar, Desfazer.
 */

type Decisao = 'aceitar' | 'pular'

interface Linha {
  decisao: Decisao
  /** A forma que vai gravar; `null` = sem proposta e ainda sem escolha (só "Não mexer" vale). */
  forma: FormaDoAlcance | null
}

/** O texto mostrado de cada linha (o resto fica no `title`). */
const TRECHO_NA_LINHA = 160

/** Quantas linhas a lista desenha por vez (cada uma tem a forma em 49 casinhas). */
const PASSO_DA_LISTA = 30

/** Os grupos cortados nas primeiras `quantas` linhas, cada um com o total dele (o título diz quantos tem). */
function primeirasLinhas(grupos: readonly { titulo: string; antigos: AntigoSemAlcance[] }[], quantas: number): { titulo: string; total: number; antigos: AntigoSemAlcance[] }[] {
  const cortados: { titulo: string; total: number; antigos: AntigoSemAlcance[] }[] = []
  let restam = quantas
  for (const grupo of grupos) {
    if (restam <= 0) break
    cortados.push({ titulo: grupo.titulo, total: grupo.antigos.length, antigos: grupo.antigos.slice(0, restam) })
    restam -= grupo.antigos.length
  }
  return cortados
}

const SEM_PROPOSTA = 'Sem proposta: escolha a forma em Mudar, ou deixe sem alcance.'

function mensagemDoErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

type Ensaio = (ListaDosAntigos & { dados: DadosDosAntigos }) | string

function ensaiar(sistema: SistemaDeRpg): Ensaio {
  try {
    return ensaiarAlcanceDosAntigos(sistema)
  } catch (erro) {
    return mensagemDoErro(erro)
  }
}

/** Cada linha começa com a proposta que cabe no lugar dela (aceita); sem proposta, "Não mexer". */
function linhasDe(ensaio: Ensaio, propostas: ReadonlyMap<string, PropostaDeAlcance>): Readonly<Record<string, Linha>> {
  if (typeof ensaio === 'string') return {}
  return Object.fromEntries(
    ensaio.antigos.map((antigo) => {
      const proposta = propostas.get(antigo.chave)
      const forma = proposta === undefined ? null : formaQueCabeNoAntigo(ensaio.dados, antigo.chave, proposta.forma)
      return [antigo.chave, { decisao: forma === null ? 'pular' : 'aceitar', forma }]
    }),
  )
}

/** Os grupos da lista: o livro primeiro, depois cada ficha, na ordem em que aparecem. */
function agrupar(antigos: readonly AntigoSemAlcance[]): { titulo: string; antigos: AntigoSemAlcance[] }[] {
  const grupos = new Map<string, AntigoSemAlcance[]>()
  for (const antigo of antigos) {
    const titulo = antigo.lugar === 'livro' ? 'No livro' : `Ficha de ${antigo.personagemNome ?? 'sem nome'}`
    grupos.set(titulo, [...(grupos.get(titulo) ?? []), antigo])
  }
  return [...grupos].map(([titulo, lista]) => ({ titulo, antigos: lista }))
}

function encurtar(texto: string): string {
  return texto.length > TRECHO_NA_LINHA ? `${texto.slice(0, TRECHO_NA_LINHA - 1)}…` : texto
}

const NOTA_DO_LUGAR: Readonly<Record<AntigoSemAlcance['onde'], string | null>> = {
  campo: null,
  alvo: 'Montada: só o alcance do alvo muda (de 1 casa até N, ou o anel).',
  centro: 'Área longe montada: só até onde vai o centro muda; a explosão fica.',
}

interface LinhaDoAntigoProps {
  antigo: AntigoSemAlcance
  linha: Linha
  proposta: PropostaDeAlcance | undefined
  editando: boolean
  /** Os três pela chave e estáveis: a linha só se redesenha quando a dela muda (`memo`). */
  onDecidir: (chave: string, decisao: Decisao) => void
  onEditar: (chave: string, editando: boolean) => void
  onForma: (chave: string, forma: FormaDoAlcance | null) => void
}

const LINHA_VAZIA: Linha = { decisao: 'pular', forma: null }

const LinhaDoAntigo = memo(function LinhaDoAntigo({ antigo, linha, proposta, editando, onDecidir: decidirPelaChave, onEditar: editarPelaChave, onForma: formaPelaChave }: LinhaDoAntigoProps) {
  const onDecidir = (decisao: Decisao) => decidirPelaChave(antigo.chave, decisao)
  const onEditar = (sim: boolean) => editarPelaChave(antigo.chave, sim)
  const onForma = (forma: FormaDoAlcance | null) => formaPelaChave(antigo.chave, forma)
  const cor = antigo.daDano ? 'azul' : 'verde'
  const nota = NOTA_DO_LUGAR[antigo.onde]
  const mudada = linha.forma !== null && proposta !== undefined && JSON.stringify(linha.forma) !== JSON.stringify(proposta.forma)
  return (
    <li className="mu-alc-antigo" data-decisao={linha.decisao} data-certeza={proposta?.certeza}>
      <div className="mu-alc-antigo__previa">{linha.forma === null ? <span className="mu-alc-antigo__vazio" aria-hidden="true" /> : <GlifoDoAlcance forma={linha.forma} cor={cor} />}</div>
      <div className="mu-alc-antigo__corpo">
        <p className="mu-alc-antigo__nome">
          <b>{antigo.nome.trim() || 'Sem nome'}</b>
          <span className="mu-alc-antigo__tipo">{antigo.grupo === 'arma' ? 'Arma' : 'Habilidade'}</span>
          {proposta !== undefined && <span className={`mu-alc-antigo__certeza mu-alc-antigo__certeza--${proposta.certeza}`}>certeza {proposta.certeza}</span>}
        </p>
        <p className="mu-alc-antigo__forma">
          {linha.forma === null ? SEM_PROPOSTA : `${descreverAlcance(linha.forma)}${mudada ? ' (mudado por você)' : ''}`}
          {linha.decisao === 'pular' && linha.forma !== null ? ' · fica sem alcance' : ''}
        </p>
        {antigo.texto !== '' && (
          <p className="mu-alc-antigo__texto" title={antigo.texto}>
            {proposta !== undefined && proposta.trecho !== '' ? <q className="mu-alc-antigo__trecho">{proposta.trecho}</q> : null} {encurtar(antigo.texto)}
          </p>
        )}
        {editando && (
          <div className="mu-alc-antigo__editor">
            <CampoDoAlcance valor={linha.forma} cor={cor} onChange={onForma} />
            {nota !== null && <p className="mu-campo__dica">{nota}</p>}
          </div>
        )}
      </div>
      <div className="mu-alc-antigo__acoes" role="group" aria-label={`O que fazer com ${antigo.nome.trim() || 'esta entrada'}`}>
        <button type="button" className="mu-bt mu-bt--p" aria-pressed={linha.decisao === 'aceitar'} disabled={linha.forma === null} onClick={() => onDecidir('aceitar')}>
          Aceitar
        </button>
        <button type="button" className="mu-bt mu-bt--p" aria-expanded={editando} onClick={() => onEditar(!editando)}>
          {editando ? 'Pronto' : 'Mudar'}
        </button>
        <button type="button" className="mu-bt mu-bt--p" aria-pressed={linha.decisao === 'pular'} onClick={() => onDecidir('pular')}>
          Não mexer
        </button>
      </div>
    </li>
  )
})

export function DarAlcanceAosAntigos({ sistema, onFechar }: { sistema: SistemaDeRpg; onFechar: () => void }) {
  const idBase = useId()
  const [ensaio, setEnsaio] = useState<Ensaio>(() => ensaiar(sistema))
  const [lidas, setLidas] = useState<PropostasLidas | null>(null)
  const [linhas, setLinhas] = useState<Readonly<Record<string, Linha>>>({})
  const [editando, setEditando] = useState<string | null>(null)
  const [gravando, setGravando] = useState(false)
  /** O que o último Confirmar mudou: o Desfazer põe de volta. */
  const [ultimo, setUltimo] = useState<readonly AntesDoAlcance[]>([])

  useEffect(() => {
    let vivo = true
    void lerPropostasDoAlcance().then((lido) => {
      if (!vivo) return
      setLidas(lido)
      setLinhas(linhasDe(ensaiar(sistema), lido.propostas))
    })
    return () => {
      vivo = false
    }
  }, [sistema])

  /** Quantas linhas aparecem: a lista longa entra em passos (desenhar todas de uma vez travava a tela). */
  const [mostrar, setMostrar] = useState(PASSO_DA_LISTA)
  const grupos = useMemo(() => (typeof ensaio === 'string' ? [] : agrupar(ensaio.antigos)), [ensaio])
  const visiveis = useMemo(() => primeirasLinhas(grupos, mostrar), [grupos, mostrar])
  const dados = typeof ensaio === 'string' ? null : ensaio.dados
  const decidir = useCallback((chave: string, decisao: Decisao) => setLinhas((atuais) => ({ ...atuais, [chave]: { ...(atuais[chave] ?? LINHA_VAZIA), decisao } })), [])
  const editar = useCallback((chave: string, sim: boolean) => setEditando(sim ? chave : null), [])
  const mudarForma = useCallback(
    (chave: string, forma: FormaDoAlcance | null) => {
      // A mecânica montada só aceita o que cabe nela (o número do alvo ou do centro).
      const cabe = forma === null || dados === null ? null : formaQueCabeNoAntigo(dados, chave, forma)
      setLinhas((atuais) => ({ ...atuais, [chave]: cabe === null ? { forma: null, decisao: 'pular' } : { forma: cabe, decisao: 'aceitar' } }))
    },
    [dados],
  )

  if (typeof ensaio === 'string') {
    return (
      <section className="mu-armas" aria-labelledby={`${idBase}-tit`}>
        <h3 className="mu-armas__tit" id={`${idBase}-tit`}>
          Dar alcance aos antigos
        </h3>
        <p className="mu-campo__erro" role="alert">
          {ensaio}
        </p>
        <div className="mu-armas__pe">
          <button type="button" className="mu-bt" onClick={onFechar}>
            Fechar
          </button>
        </div>
      </section>
    )
  }

  const propostas = lidas?.propostas ?? new Map<string, PropostaDeAlcance>()
  const escolhas: EscolhaDoAlcance[] = ensaio.antigos.flatMap((antigo) => {
    const linha = linhas[antigo.chave]
    return linha !== undefined && linha.decisao === 'aceitar' && linha.forma !== null ? [{ chave: antigo.chave, forma: linha.forma }] : []
  })
  const comProposta = ensaio.antigos.filter((antigo) => propostas.has(antigo.chave))
  const baixas = comProposta.filter((antigo) => propostas.get(antigo.chave)?.certeza === 'baixa').length
  const nada = ensaio.antigos.length === 0

  const marcarTodas = (decisao: Decisao) => setLinhas((atuais) => Object.fromEntries(Object.entries(atuais).map(([chave, linha]) => [chave, { ...linha, decisao: linha.forma === null ? 'pular' : decisao }])))

  const depoisDeGravar = () => {
    const novo = ensaiar(sistema)
    setEnsaio(novo)
    setLinhas(linhasDe(novo, propostas))
    setEditando(null)
    setMostrar(PASSO_DA_LISTA)
  }

  const confirmar = async () => {
    if (gravando || escolhas.length === 0) return
    setGravando(true)
    const toasts = useToastStore.getState()
    try {
      const antes = await confirmarAlcanceDosAntigos(sistema, escolhas)
      toasts.push('info', antes.length === 0 ? 'Nada mudou: todos já tinham alcance.' : `Alcance gravado em ${formatarNumero(antes.length)} ${antes.length === 1 ? 'entrada' : 'entradas'} do livro e das fichas.`)
      setUltimo(antes)
      depoisDeGravar()
    } catch (erro) {
      toasts.push('error', `Não deu para gravar os alcances: ${mensagemDoErro(erro)}`)
    } finally {
      setGravando(false)
    }
  }

  const desfazer = async () => {
    if (gravando || ultimo.length === 0) return
    setGravando(true)
    const toasts = useToastStore.getState()
    try {
      const voltaram = await desfazerAlcanceDosAntigos(sistema, ultimo)
      toasts.push('info', `Desfeito: ${formatarNumero(voltaram)} ${voltaram === 1 ? 'entrada voltou' : 'entradas voltaram'} a ficar sem alcance.`)
      setUltimo([])
      depoisDeGravar()
    } catch (erro) {
      toasts.push('error', `Não deu para desfazer: ${mensagemDoErro(erro)}`)
    } finally {
      setGravando(false)
    }
  }

  return (
    <section className="mu-armas mu-alc" aria-labelledby={`${idBase}-tit`} aria-busy={lidas === null || gravando}>
      <h3 className="mu-armas__tit" id={`${idBase}-tit`}>
        Dar alcance aos antigos
      </h3>
      <p className="mu-armas__sub">
        Habilidades e armas sem alcance não acendem casas na batalha. O Claude propôs um alcance para cada uma pelo texto; confira, mude o que quiser e Confirme. Nada se grava antes. O que ficar em Não mexer segue sem alcance.
      </p>
      {lidas !== null && lidas.aviso !== null && <p className="mu-campo__dica">{lidas.aviso}</p>}
      {ultimo.length > 0 && (
        <p className="mu-alc__feito" role="status">
          Gravado em {formatarNumero(ultimo.length)} {ultimo.length === 1 ? 'entrada' : 'entradas'} (cópia de antes ao lado de cada arquivo, .antes-do-alcance).{' '}
          <button type="button" className="mu-bt mu-bt--p" disabled={gravando} onClick={() => void desfazer()}>
            Desfazer
          </button>
        </p>
      )}
      {nada ? (
        <p className="mu-armas__nada">Nada a fazer: as habilidades e armas do livro e das fichas desta pasta já têm alcance.</p>
      ) : (
        <>
          <div className="mu-alc__resumo">
            <span>
              {formatarNumero(ensaio.antigos.length)} sem alcance · {formatarNumero(comProposta.length)} com proposta ({formatarNumero(comProposta.length - baixas)} certeza alta, {formatarNumero(baixas)} baixa) · {formatarNumero(escolhas.length)} para gravar
            </span>
            <span className="mu-alc__todas">
              <button type="button" className="mu-bt mu-bt--p" onClick={() => marcarTodas('aceitar')}>
                Aceitar todas
              </button>
              <button type="button" className="mu-bt mu-bt--p" onClick={() => marcarTodas('pular')}>
                Não mexer em nenhuma
              </button>
            </span>
          </div>
          {visiveis.map((grupo) => (
            <div key={grupo.titulo} className="mu-armas__bloco">
              <h4 className="mu-armas__bloco-tit">
                {grupo.titulo} ({formatarNumero(grupo.total)})
              </h4>
              <ul className="mu-alc__lista">
                {grupo.antigos.map((antigo) => (
                  <LinhaDoAntigo
                    key={antigo.chave}
                    antigo={antigo}
                    linha={linhas[antigo.chave] ?? LINHA_VAZIA}
                    proposta={propostas.get(antigo.chave)}
                    editando={editando === antigo.chave}
                    onDecidir={decidir}
                    onEditar={editar}
                    onForma={mudarForma}
                  />
                ))}
              </ul>
            </div>
          ))}
          {mostrar < ensaio.antigos.length && (
            <button type="button" className="mu-bt mu-bt--p mu-alc__mais" onClick={() => setMostrar((antes) => antes + PASSO_DA_LISTA)}>
              Mostrar mais {formatarNumero(Math.min(PASSO_DA_LISTA, ensaio.antigos.length - mostrar))} (faltam {formatarNumero(ensaio.antigos.length - mostrar)})
            </button>
          )}
          {ensaio.naoLidos.length > 0 && (
            <div className="mu-armas__bloco">
              <h4 className="mu-armas__bloco-tit">Não dá para ler ({formatarNumero(ensaio.naoLidos.length)})</h4>
              <ul className="mu-armas__lista">
                {ensaio.naoLidos.map((naoLido) => (
                  <li key={naoLido.chave}>
                    <b>{naoLido.nome}</b>
                    {naoLido.personagemNome === undefined ? '' : ` (${naoLido.personagemNome})`}: a mecânica é torta ou de um app mais novo. Abra no editor dela.
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      <div className="mu-armas__pe">
        <button type="button" className="mu-bt" onClick={onFechar}>
          {nada ? 'Fechar' : 'Cancelar'}
        </button>
        {!nada && (
          <button type="button" className="mu-bt mu-bt--primario" disabled={gravando || escolhas.length === 0} onClick={() => void confirmar()}>
            {gravando ? 'Gravando…' : `Confirmar (${formatarNumero(escolhas.length)})`}
          </button>
        )}
      </div>
    </section>
  )
}
