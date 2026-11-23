import { memo, useCallback, useEffect, useId, useMemo, useState } from 'react'
import { formaDoModelo, formaQueCabeNoAntigo, modeloDaDano, ondeNoModelo, propostasDaLista, SEM_ARQUIVO, type AntesDoAlcance, type AntigoSemAlcance, type DadosDosAntigos, type EscolhaDoAlcance, type ListaDosAntigos, type PropostaDeAlcance, type PropostasDoArquivo } from '../../lib/batalha/alcance/antigos'
import { descreverAlcance, type FormaDoAlcance } from '../../lib/batalha/alcance/forma'
import { GRUPOS_DOS_MODELOS_DE_ITEM, MODELOS_DE_ITEM, type IdDoModeloDeItem } from '../../lib/batalha/mecanica/modelosDeItem'
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
 *
 * O ITEM do Acervo sem "O que ele faz" (pedido de 23/11: "Coloque isso para itens quanto para
 * habilidades") entra com o modelo proposto (o do arquivo, senão o do "Sugerir efeito"), sempre
 * certeza baixa: o Confirmar grava o efeito inteiro do modelo, com o alcance da linha. A descrição
 * do item fica como o mestre escreveu. O item da categoria Arma sem regra no livro (a Granada, 23/11)
 * só entra com o modelo do arquivo, e a linha diz que ele vira Consumível no Confirmar.
 */

type Decisao = 'aceitar' | 'pular'

interface Linha {
  decisao: Decisao
  /** A forma que vai gravar; `null` = sem proposta e ainda sem escolha (só "Não mexer" vale). */
  forma: FormaDoAlcance | null
  /** Só no item: o modelo do "O que ele faz" que vai gravar. */
  modelo?: IdDoModeloDeItem
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

function ensaiar(sistema: SistemaDeRpg, doArquivo: PropostasDoArquivo = SEM_ARQUIVO): Ensaio {
  try {
    return ensaiarAlcanceDosAntigos(sistema, doArquivo)
  } catch (erro) {
    return mensagemDoErro(erro)
  }
}

/** As propostas da lista: as do arquivo e as dos itens (o modelo com o alcance de fábrica). */
function propostasDe(ensaio: Ensaio, doArquivo: PropostasDoArquivo, sistema: SistemaDeRpg): ReadonlyMap<string, PropostaDeAlcance> {
  return propostasDaLista(typeof ensaio === 'string' ? [] : ensaio.antigos, doArquivo, sistema)
}

/** Cada linha começa com a proposta que cabe no lugar dela (aceita); sem proposta, "Não mexer". */
function linhasDe(ensaio: Ensaio, propostas: ReadonlyMap<string, PropostaDeAlcance>): Readonly<Record<string, Linha>> {
  if (typeof ensaio === 'string') return {}
  return Object.fromEntries(
    ensaio.antigos.map((antigo) => {
      const proposta = propostas.get(antigo.chave)
      const { modelo } = antigo
      const forma = proposta === undefined ? null : formaQueCabeNoAntigo(ensaio.dados, antigo.chave, proposta.forma, modelo)
      const linha: Linha = { decisao: forma === null ? 'pular' : 'aceitar', forma }
      return [antigo.chave, modelo === undefined ? linha : { ...linha, modelo }]
    }),
  )
}

/** Os grupos da lista: o livro primeiro, depois cada ficha, na ordem em que aparecem. */
function agrupar(antigos: readonly AntigoSemAlcance[]): { titulo: string; antigos: AntigoSemAlcance[] }[] {
  const grupos = new Map<string, AntigoSemAlcance[]>()
  for (const antigo of antigos) {
    const titulo = antigo.lugar === 'livro' ? 'No livro' : antigo.lugar === 'acervo' ? 'No Acervo (itens sem "O que ele faz")' : `Ficha de ${antigo.personagemNome ?? 'sem nome'}`
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

const TIPO_DO_GRUPO: Readonly<Record<AntigoSemAlcance['grupo'], string>> = { arma: 'Arma', habilidade: 'Habilidade', item: 'Item' }

const NOTA_DO_ITEM = 'Ganha o "O que ele faz" deste modelo (dá para ajustar depois na janela do item); a descrição fica como está.'

/** O modelo pelo id (o nome e a frase do que ele monta). */
function modeloPeloId(id: IdDoModeloDeItem) {
  return MODELOS_DE_ITEM.find((modelo) => modelo.id === id)
}

/** O seletor do modelo, nos grupos do degrau 1 do item (os mesmos do editor do item). */
function EscolhaDoModelo({ valor, onChange }: { valor: IdDoModeloDeItem | undefined; onChange: (modelo: IdDoModeloDeItem) => void }) {
  const id = useId()
  return (
    <div className="mu-campo">
      <label htmlFor={id}>O que ele faz</label>
      <select
        className="mu-seletor"
        id={id}
        value={valor ?? ''}
        onChange={(event) => {
          const escolhido = MODELOS_DE_ITEM.find((modelo) => modelo.id === event.target.value)
          if (escolhido !== undefined) onChange(escolhido.id)
        }}
      >
        {valor === undefined && <option value="">Escolha um modelo</option>}
        {GRUPOS_DOS_MODELOS_DE_ITEM.map(({ grupo, nome }) => (
          <optgroup key={grupo} label={nome}>
            {MODELOS_DE_ITEM.filter((modelo) => modelo.grupo === grupo).map((modelo) => (
              <option key={modelo.id} value={modelo.id}>
                {modelo.nome}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  )
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
  onModelo: (chave: string, modelo: IdDoModeloDeItem) => void
  /** O livro aberto: a cor e a nota do item saem das peças do modelo dele. */
  sistema: SistemaDeRpg
}

const LINHA_VAZIA: Linha = { decisao: 'pular', forma: null }

const LinhaDoAntigo = memo(function LinhaDoAntigo({ antigo, linha, proposta, editando, onDecidir: decidirPelaChave, onEditar: editarPelaChave, onForma: formaPelaChave, onModelo: modeloPelaChave, sistema }: LinhaDoAntigoProps) {
  const onDecidir = (decisao: Decisao) => decidirPelaChave(antigo.chave, decisao)
  const onEditar = (sim: boolean) => editarPelaChave(antigo.chave, sim)
  const onForma = (forma: FormaDoAlcance | null) => formaPelaChave(antigo.chave, forma)
  const { modelo } = linha
  const cor = (modelo === undefined ? antigo.daDano : modeloDaDano(modelo, sistema)) ? 'azul' : 'verde'
  const nota = NOTA_DO_LUGAR[modelo === undefined ? antigo.onde : ondeNoModelo(modelo, sistema)]
  const doModelo = modelo === undefined ? undefined : modeloPeloId(modelo)
  const mudada = linha.forma !== null && proposta !== undefined && (JSON.stringify(linha.forma) !== JSON.stringify(proposta.forma) || modelo !== proposta.modelo)
  const { virar } = antigo
  const ficaComo = antigo.grupo !== 'item' ? ' · fica sem alcance' : virar === undefined ? ' · fica sem efeito' : ` · fica ${virar.de}, sem efeito`
  return (
    <li className="mu-alc-antigo" data-decisao={linha.decisao} data-certeza={proposta?.certeza}>
      <div className="mu-alc-antigo__previa">{linha.forma === null ? <span className="mu-alc-antigo__vazio" aria-hidden="true" /> : <GlifoDoAlcance forma={linha.forma} cor={cor} />}</div>
      <div className="mu-alc-antigo__corpo">
        <p className="mu-alc-antigo__nome">
          <b>{antigo.nome.trim() || 'Sem nome'}</b>
          <span className="mu-alc-antigo__tipo">{virar === undefined ? TIPO_DO_GRUPO[antigo.grupo] : `${virar.de} → ${virar.para}`}</span>
          {proposta !== undefined && <span className={`mu-alc-antigo__certeza mu-alc-antigo__certeza--${proposta.certeza}`}>certeza {proposta.certeza}</span>}
        </p>
        <p className="mu-alc-antigo__forma">
          {linha.forma === null ? SEM_PROPOSTA : `${descreverAlcance(linha.forma)}${mudada ? ' (mudado por você)' : ''}`}
          {linha.decisao === 'pular' && linha.forma !== null ? ficaComo : ''}
        </p>
        {virar !== undefined && (
          <p className="mu-alc-antigo__forma">
            Vira <b>{virar.para}</b>: está em {virar.de} sem regra de arma no livro, e a batalha passa a usá-lo como item{virar.pasta === undefined ? '' : `; vai para a pasta ${virar.para}`}.
          </p>
        )}
        {doModelo !== undefined && (
          <p className="mu-alc-antigo__forma">
            O que ele faz: <b>{doModelo.nome}</b> ({doModelo.dica})
          </p>
        )}
        {antigo.texto !== '' && (
          <p className="mu-alc-antigo__texto" title={antigo.texto}>
            {proposta !== undefined && proposta.trecho !== '' ? <q className="mu-alc-antigo__trecho">{proposta.trecho}</q> : null} {encurtar(antigo.texto)}
          </p>
        )}
        {editando && (
          <div className="mu-alc-antigo__editor">
            {antigo.grupo === 'item' && <EscolhaDoModelo valor={modelo} onChange={(novo) => modeloPelaChave(antigo.chave, novo)} />}
            <CampoDoAlcance valor={linha.forma} cor={cor} onChange={onForma} />
            {antigo.grupo === 'item' && <p className="mu-campo__dica">{NOTA_DO_ITEM}</p>}
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
      // O arquivo diz quais itens entram (o modelo de cada um): a lista é refeita com ele.
      const novo = ensaiar(sistema, lido)
      setLidas(lido)
      setEnsaio(novo)
      setLinhas(linhasDe(novo, propostasDe(novo, lido, sistema)))
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
  const propostas = useMemo(() => propostasDe(ensaio, lidas ?? SEM_ARQUIVO, sistema), [ensaio, lidas, sistema])
  const decidir = useCallback((chave: string, decisao: Decisao) => setLinhas((atuais) => ({ ...atuais, [chave]: { ...(atuais[chave] ?? LINHA_VAZIA), decisao } })), [])
  const editar = useCallback((chave: string, sim: boolean) => setEditando(sim ? chave : null), [])
  const mudarForma = useCallback(
    (chave: string, forma: FormaDoAlcance | null) => {
      setLinhas((atuais) => {
        const { modelo } = atuais[chave] ?? LINHA_VAZIA
        // A mecânica montada (e o efeito do modelo do item) só aceita o que cabe nela: o número do alvo ou do centro.
        const cabe = forma === null || dados === null ? null : formaQueCabeNoAntigo(dados, chave, forma, modelo)
        const linha: Linha = cabe === null ? { forma: null, decisao: 'pular' } : { forma: cabe, decisao: 'aceitar' }
        return { ...atuais, [chave]: modelo === undefined ? linha : { ...linha, modelo } }
      })
    },
    [dados],
  )
  /** Outro modelo para o item: a forma volta ao alcance de fábrica dele. */
  const mudarModelo = useCallback(
    (chave: string, modelo: IdDoModeloDeItem) => {
      const forma = formaDoModelo(modelo, sistema)
      setLinhas((atuais) => ({ ...atuais, [chave]: { modelo, forma, decisao: forma === null ? 'pular' : 'aceitar' } }))
    },
    [sistema],
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

  const escolhas: EscolhaDoAlcance[] = ensaio.antigos.flatMap((antigo) => {
    const linha = linhas[antigo.chave]
    if (linha === undefined || linha.decisao !== 'aceitar' || linha.forma === null) return []
    return [linha.modelo === undefined ? { chave: antigo.chave, forma: linha.forma } : { chave: antigo.chave, forma: linha.forma, modelo: linha.modelo }]
  })
  const comProposta = ensaio.antigos.filter((antigo) => propostas.has(antigo.chave))
  const baixas = comProposta.filter((antigo) => propostas.get(antigo.chave)?.certeza === 'baixa').length
  const nada = ensaio.antigos.length === 0

  const marcarTodas = (decisao: Decisao) => setLinhas((atuais) => Object.fromEntries(Object.entries(atuais).map(([chave, linha]) => [chave, { ...linha, decisao: linha.forma === null ? 'pular' : decisao }])))

  const depoisDeGravar = () => {
    const doArquivo = lidas ?? SEM_ARQUIVO
    const novo = ensaiar(sistema, doArquivo)
    setEnsaio(novo)
    setLinhas(linhasDe(novo, propostasDe(novo, doArquivo, sistema)))
    setEditando(null)
    setMostrar(PASSO_DA_LISTA)
  }

  const confirmar = async () => {
    if (gravando || escolhas.length === 0) return
    setGravando(true)
    const toasts = useToastStore.getState()
    try {
      const antes = await confirmarAlcanceDosAntigos(sistema, escolhas)
      toasts.push('info', antes.length === 0 ? 'Nada mudou: todos já tinham alcance.' : `Alcance gravado em ${formatarNumero(antes.length)} ${antes.length === 1 ? 'entrada' : 'entradas'} do livro, das fichas e do Acervo.`)
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
        Habilidades, armas e itens sem alcance não acendem casas na batalha. O Claude propôs um alcance para cada um pelo texto; o item sem "O que ele faz" ganha o modelo proposto junto. Confira, mude o que quiser e Confirme. Nada se grava antes. O que ficar em Não mexer segue como está.
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
        <p className="mu-armas__nada">Nada a fazer: as habilidades e armas do livro e das fichas desta pasta, e os itens do Acervo com modelo parecido, já têm alcance.</p>
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
                    onModelo={mudarModelo}
                    sistema={sistema}
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
