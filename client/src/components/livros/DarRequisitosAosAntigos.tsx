import { lazy, memo, Suspense, useCallback, useEffect, useId, useMemo, useState } from 'react'
import { ABA_DAS_TECNICAS, tecnicasDe } from '../../lib/batalha/leituraDaFicha'
import { cartaoComAProposta, cartaoDaFicha, fichaComOCartao, PARTES_DA_PROPOSTA, SEM_ARQUIVO, type AntesDosRequisitos, type AntigoComProposta, type DadosDosAntigos, type EscolhaDosRequisitos, type ListaDosAntigos, type PropostasDoArquivo } from '../../lib/batalha/requisitos/antigos'
import { frasesDoAcumulador, frasesDosRequisitos } from '../../lib/batalha/requisitos/frases'
import { lerAcumulador, lerMarcas, lerRequisitos, requisitosParaGuardar } from '../../lib/batalha/requisitos/ler'
import type { RequisitosDoCartao } from '../../lib/batalha/requisitos/modelo'
import type { CartaoDaFicha, Personagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { confirmarRequisitosDosAntigos, desfazerRequisitosDosAntigos, ensaiarRequisitosDosAntigos, lerPropostasDosRequisitos, type PropostasLidas } from '../../stores/requisitosDosAntigos'
import { useToastStore } from '../../stores/toastStore'
import { LinhaDaEvolucao } from '../batalha/editor/linhas/LinhaDaEvolucao'
import { LinhaDosRequisitos } from '../batalha/editor/linhas/LinhaDosRequisitos'
import { fontesDaFicha, listasDaFicha } from '../batalha/editor/requisitosDoCartao'
import '../batalha/alcance/alcance.css'
import '../batalha/editor/editor.css'
import '../batalha/MecanicaDaTecnica.css'
import { formatarNumero } from './comum'

const EditorDoAcumulador = lazy(() => import('../batalha/acumulador/EditorDoAcumulador').then((modulo) => ({ default: modulo.EditorDoAcumulador })))

/**
 * "DAR REQUISITOS AOS ANTIGOS" das páginas Itens e Habilidades (fase H,
 * docs/design/habilidades/REQUISITOS.md §11; o dono, 23/11: "Eu monto e você confere"). O mesmo
 * jeito do "Dar alcance aos antigos": a LISTA primeiro, cada linha com a proposta do Claude (o que
 * o cartão passa a pedir, as marcas, o acumulador, a certeza e o trecho do texto que a justifica), e
 * o mestre aceita, muda (no editor de requisitos e no do acumulador) ou não mexe. Nada se grava
 * antes do Confirmar; o texto e os extras do cartão ficam como estão. Depois do Confirmar, Desfazer.
 */

type Decisao = 'aceitar' | 'pular'

interface Linha {
  decisao: Decisao
  /** O cartão com a proposta posta (e o que o mestre mudou nela): o Confirmar grava as partes que faltam. */
  cartao: CartaoDaFicha
}

/** O texto mostrado de cada linha (o resto fica no `title`). */
const TRECHO_NA_LINHA = 160
/** Quantas linhas a lista desenha por vez. */
const PASSO_DA_LISTA = 30

function mensagemDoErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

type Ensaio = (ListaDosAntigos & { dados: DadosDosAntigos }) | string

function ensaiar(doArquivo: PropostasDoArquivo = SEM_ARQUIVO): Ensaio {
  try {
    return ensaiarRequisitosDosAntigos(doArquivo)
  } catch (erro) {
    return mensagemDoErro(erro)
  }
}

/** O cartão do antigo nas fichas de agora; `null` = sumiu entre o ensaio e a tela (não deveria). */
function cartaoDoAntigo(dados: DadosDosAntigos, antigo: AntigoComProposta): CartaoDaFicha | null {
  const personagem = dados.personagens.find((candidato) => candidato.id === antigo.personagemId)
  return personagem === undefined ? null : cartaoDaFicha(personagem, antigo.cartaoId)
}

/** Cada linha começa com a proposta posta no cartão, aceita. */
function linhasDe(ensaio: Ensaio): Readonly<Record<string, Linha>> {
  if (typeof ensaio === 'string') return {}
  return Object.fromEntries(
    ensaio.antigos.flatMap((antigo): [string, Linha][] => {
      const cartao = cartaoDoAntigo(ensaio.dados, antigo)
      return cartao === null ? [] : [[antigo.chave, { decisao: 'aceitar', cartao: cartaoComAProposta(cartao, antigo) }]]
    }),
  )
}

/** Os grupos da lista: uma ficha por grupo, na ordem em que aparecem. */
function agrupar(antigos: readonly AntigoComProposta[]): { titulo: string; antigos: AntigoComProposta[] }[] {
  const grupos = new Map<string, AntigoComProposta[]>()
  for (const antigo of antigos) {
    const titulo = `Ficha de ${antigo.personagemNome.trim() || 'sem nome'}`
    grupos.set(titulo, [...(grupos.get(titulo) ?? []), antigo])
  }
  return [...grupos].map(([titulo, lista]) => ({ titulo, antigos: lista }))
}

function primeirasLinhas(grupos: readonly { titulo: string; antigos: AntigoComProposta[] }[], quantas: number): { titulo: string; total: number; antigos: AntigoComProposta[] }[] {
  const cortados: { titulo: string; total: number; antigos: AntigoComProposta[] }[] = []
  let restam = quantas
  for (const grupo of grupos) {
    if (restam <= 0) break
    cortados.push({ titulo: grupo.titulo, total: grupo.antigos.length, antigos: grupo.antigos.slice(0, restam) })
    restam -= grupo.antigos.length
  }
  return cortados
}

function encurtar(texto: string): string {
  return texto.length > TRECHO_NA_LINHA ? `${texto.slice(0, TRECHO_NA_LINHA - 1)}…` : texto
}

/** A aba é de forma (Transformação): o "Para usar" vira "Para ligar". */
function ehAbaDeForma(sistema: SistemaDeRpg, aba: string): boolean {
  return aba !== ABA_DAS_TECNICAS && sistema.abas.some((candidata) => candidata.id === aba && candidata.modificadores === true)
}

/** O que a linha vai gravar, em frases: as seções do bloco, as marcas e o acumulador. */
function frasesDaLinha(cartao: CartaoDaFicha, ehForma: boolean): string[] {
  const frases: string[] = []
  const bloco = cartao.requisitos === undefined ? null : lerRequisitos(cartao.requisitos).bloco
  if (bloco !== null) for (const secao of frasesDosRequisitos(bloco, ehForma, true)) frases.push(`${secao.titulo}: ${secao.linhas.join('; ')}`)
  const marcas = lerMarcas(cartao.marcas)
  if (marcas.length > 0) frases.push(`Marcas: ${marcas.join(', ')}`)
  const acumulador = cartao.acumulador === undefined ? null : lerAcumulador(cartao.acumulador).acumulador
  if (acumulador !== null) frases.push(`Acumulador ${acumulador.nome}: ${frasesDoAcumulador(acumulador).join('; ')}`)
  return frases
}

/** O bloco da linha com a chave de forma (I1/I2) ligada ou desligada; sem bloco, nasce um. */
function comChaveDaForma(cartao: CartaoDaFicha, qual: 'sobeParte' | 'partesEmOrdem', ligada: boolean): CartaoDaFicha {
  const bloco: RequisitosDoCartao = (cartao.requisitos === undefined ? null : lerRequisitos(cartao.requisitos).bloco) ?? { v: 1 }
  const { aoUsar: _aoUsar, forma, ...resto } = bloco
  const novo: RequisitosDoCartao =
    qual === 'sobeParte'
      ? { ...resto, ...(forma === undefined ? {} : { forma }), ...(ligada ? { aoUsar: { sobeParte: true } } : {}) }
      : { ...resto, ...(bloco.aoUsar === undefined ? {} : { aoUsar: bloco.aoUsar }), ...(ligada ? { forma: { ...forma, partesEmOrdem: true } } : forma?.soLigaPor === undefined ? {} : { forma: { soLigaPor: forma.soLigaPor } }) }
  return { ...cartao, requisitos: requisitosParaGuardar(novo) }
}

interface LinhaDoAntigoProps {
  antigo: AntigoComProposta
  linha: Linha
  editando: boolean
  /** A ficha do antigo (a de agora): o editor lê as técnicas, os acumuladores e as marcas dela. */
  personagem: Personagem
  sistema: SistemaDeRpg
  /** Pela chave e estáveis: a linha só se redesenha quando a dela muda (`memo`). */
  onDecidir: (chave: string, decisao: Decisao) => void
  onEditar: (chave: string, editando: boolean) => void
  onCartao: (chave: string, cartao: CartaoDaFicha) => void
}

const LinhaDoAntigo = memo(function LinhaDoAntigo({ antigo, linha, editando, personagem, sistema, onDecidir, onEditar, onCartao }: LinhaDoAntigoProps) {
  const [noAcumulador, setNoAcumulador] = useState(false)
  const { proposta } = antigo
  const ehForma = ehAbaDeForma(sistema, antigo.aba)
  const frases = useMemo(() => frasesDaLinha(linha.cartao, ehForma), [linha.cartao, ehForma])
  const propostoAgora = useMemo(() => {
    const original = cartaoDaFicha(personagem, antigo.cartaoId)
    return original === null ? null : cartaoComAProposta(original, antigo)
  }, [personagem, antigo])
  const mudada = propostoAgora !== null && PARTES_DA_PROPOSTA.some((parte) => JSON.stringify(propostoAgora[parte]) !== JSON.stringify(linha.cartao[parte]))
  const ficha = useMemo(() => fichaComOCartao(personagem, antigo.cartaoId, linha.cartao), [personagem, antigo.cartaoId, linha.cartao])
  const tecnicas = useMemo(() => tecnicasDe(ficha, sistema), [ficha, sistema])
  const fontes = useMemo(() => fontesDaFicha(ficha, sistema, tecnicas, antigo.cartaoId), [ficha, sistema, tecnicas, antigo.cartaoId])
  const listas = useMemo(() => listasDaFicha(ficha), [ficha])
  const mudar = (cartao: CartaoDaFicha) => onCartao(antigo.chave, cartao)
  const bloco = linha.cartao.requisitos === undefined ? null : lerRequisitos(linha.cartao.requisitos).bloco
  const propostoBloco = proposta.requisitos === undefined ? null : lerRequisitos(proposta.requisitos).bloco
  const acumuladorId = proposta.acumulador === undefined ? null : (lerAcumulador(proposta.acumulador).acumulador?.id ?? null)
  const temAlgo = antigo.faltam.some((parte) => linha.cartao[parte] !== undefined)
  return (
    <li className="mu-alc-antigo" data-decisao={linha.decisao} data-certeza={proposta.certeza}>
      <div className="mu-alc-antigo__corpo">
        <p className="mu-alc-antigo__nome">
          <b>{antigo.nome.trim() || 'Sem nome'}</b>
          <span className="mu-alc-antigo__tipo">{sistema.abas.find((aba) => aba.id === antigo.aba)?.nome ?? antigo.aba}</span>
          <span className={`mu-alc-antigo__certeza mu-alc-antigo__certeza--${proposta.certeza}`}>certeza {proposta.certeza}</span>
        </p>
        {frases.length === 0 ? (
          <p className="mu-alc-antigo__forma">Nada a gravar: abra Mudar, ou deixe em Não mexer.</p>
        ) : (
          frases.map((frase) => (
            <p key={frase} className="mu-alc-antigo__forma">
              {frase}
            </p>
          ))
        )}
        {mudada && <p className="mu-alc-antigo__forma">(mudado por você)</p>}
        {linha.decisao === 'pular' && <p className="mu-alc-antigo__forma">Fica como está: sem estes requisitos.</p>}
        {proposta.nota !== undefined && <p className="mu-campo__dica">{proposta.nota}</p>}
        {antigo.texto !== '' && (
          <p className="mu-alc-antigo__texto" title={antigo.texto}>
            {proposta.trecho !== '' ? <q className="mu-alc-antigo__trecho">{proposta.trecho}</q> : null} {encurtar(antigo.texto)}
          </p>
        )}
        {editando && (
          <div className="mu-alc-antigo__editor mu-req-antigo__editor">
            <LinhaDosRequisitos cartao={linha.cartao} personagem={ficha} fontes={fontes} listas={listas} custoEmSp={0} onChange={mudar} vazio="Sem requisito para usar." />
            {propostoBloco?.evoluir !== undefined && <LinhaDaEvolucao cartao={linha.cartao} tecnicas={tecnicas} personagem={ficha} fontes={fontes} listas={listas} custoEmSp={0} onChange={mudar} />}
            {propostoBloco?.aoUsar !== undefined && (
              <label className="mu-campo mu-campo--check">
                <input type="checkbox" checked={bloco?.aoUsar?.sobeParte === true} onChange={(evento) => mudar(comChaveDaForma(linha.cartao, 'sobeParte', evento.target.checked))} /> Ao usar, sobe uma Parte da forma de onde vem
              </label>
            )}
            {propostoBloco?.forma?.partesEmOrdem === true && (
              <label className="mu-campo mu-campo--check">
                <input type="checkbox" checked={bloco?.forma?.partesEmOrdem === true} onChange={(evento) => mudar(comChaveDaForma(linha.cartao, 'partesEmOrdem', evento.target.checked))} /> Uma Parte por vez, em ordem
              </label>
            )}
            {acumuladorId !== null && (
              <button type="button" className="mu-bt mu-bt--p" onClick={() => setNoAcumulador(true)}>
                Abrir o acumulador
              </button>
            )}
            {noAcumulador && (
              <Suspense fallback={null}>
                <EditorDoAcumulador
                  personagem={ficha}
                  sistema={sistema}
                  inicial={acumuladorId}
                  onChange={(nova) => {
                    // Só o cartão desta linha volta da janela: um acumulador novo criado nela não se grava daqui.
                    const cartao = cartaoDaFicha(nova, antigo.cartaoId)
                    if (cartao !== null) mudar(cartao)
                  }}
                  onFechar={() => setNoAcumulador(false)}
                />
              </Suspense>
            )}
          </div>
        )}
      </div>
      <div className="mu-alc-antigo__acoes" role="group" aria-label={`O que fazer com ${antigo.nome.trim() || 'este cartão'}`}>
        <button type="button" className="mu-bt mu-bt--p" aria-pressed={linha.decisao === 'aceitar'} disabled={!temAlgo} onClick={() => onDecidir(antigo.chave, 'aceitar')}>
          Aceitar
        </button>
        <button type="button" className="mu-bt mu-bt--p" aria-expanded={editando} onClick={() => onEditar(antigo.chave, !editando)}>
          {editando ? 'Pronto' : 'Mudar'}
        </button>
        <button type="button" className="mu-bt mu-bt--p" aria-pressed={linha.decisao === 'pular'} onClick={() => onDecidir(antigo.chave, 'pular')}>
          Não mexer
        </button>
      </div>
    </li>
  )
})

/** As escolhas do Confirmar: as linhas aceitas, com as partes que o cartão ainda não tem. */
function escolhasDe(antigos: readonly AntigoComProposta[], linhas: Readonly<Record<string, Linha>>): EscolhaDosRequisitos[] {
  return antigos.flatMap((antigo) => {
    const linha = linhas[antigo.chave]
    if (linha === undefined || linha.decisao !== 'aceitar') return []
    const { requisitos, marcas, acumulador } = linha.cartao
    const escolha: EscolhaDosRequisitos = { chave: antigo.chave }
    if (requisitos !== undefined && antigo.faltam.includes('requisitos')) escolha.requisitos = requisitos
    if (marcas !== undefined && antigo.faltam.includes('marcas')) escolha.marcas = marcas
    if (acumulador !== undefined && antigo.faltam.includes('acumulador')) escolha.acumulador = acumulador
    return escolha.requisitos === undefined && escolha.marcas === undefined && escolha.acumulador === undefined ? [] : [escolha]
  })
}

export function DarRequisitosAosAntigos({ sistema, onFechar }: { sistema: SistemaDeRpg; onFechar: () => void }) {
  const idBase = useId()
  const [ensaio, setEnsaio] = useState<Ensaio>(() => ensaiar())
  const [lidas, setLidas] = useState<PropostasLidas | null>(null)
  const [linhas, setLinhas] = useState<Readonly<Record<string, Linha>>>({})
  const [editando, setEditando] = useState<string | null>(null)
  const [gravando, setGravando] = useState(false)
  /** O que o último Confirmar gravou: o Desfazer tira. */
  const [ultimo, setUltimo] = useState<readonly AntesDosRequisitos[]>([])
  const [mostrar, setMostrar] = useState(PASSO_DA_LISTA)

  useEffect(() => {
    let vivo = true
    void lerPropostasDosRequisitos().then((lido) => {
      if (!vivo) return
      const novo = ensaiar(lido)
      setLidas(lido)
      setEnsaio(novo)
      setLinhas(linhasDe(novo))
    })
    return () => {
      vivo = false
    }
  }, [])

  const grupos = useMemo(() => (typeof ensaio === 'string' ? [] : agrupar(ensaio.antigos)), [ensaio])
  const visiveis = useMemo(() => primeirasLinhas(grupos, mostrar), [grupos, mostrar])
  const fichas = useMemo(() => new Map(typeof ensaio === 'string' ? [] : ensaio.dados.personagens.map((personagem) => [personagem.id, personagem])), [ensaio])
  const decidir = useCallback((chave: string, decisao: Decisao) => setLinhas((atuais) => (atuais[chave] === undefined ? atuais : { ...atuais, [chave]: { ...atuais[chave], decisao } })), [])
  const editar = useCallback((chave: string, sim: boolean) => setEditando(sim ? chave : null), [])
  const mudarCartao = useCallback((chave: string, cartao: CartaoDaFicha) => setLinhas((atuais) => ({ ...atuais, [chave]: { decisao: 'aceitar', cartao } })), [])

  if (typeof ensaio === 'string') {
    return (
      <section className="mu-armas" aria-labelledby={`${idBase}-tit`}>
        <h3 className="mu-armas__tit" id={`${idBase}-tit`}>
          Dar requisitos aos antigos
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

  const escolhas = escolhasDe(ensaio.antigos, linhas)
  const baixas = ensaio.antigos.filter((antigo) => antigo.proposta.certeza === 'baixa').length
  const nada = ensaio.antigos.length === 0
  const marcarTodas = (decisao: Decisao) => setLinhas((atuais) => Object.fromEntries(Object.entries(atuais).map(([chave, linha]) => [chave, { ...linha, decisao }])))

  const depoisDeGravar = () => {
    const novo = ensaiar(lidas ?? SEM_ARQUIVO)
    setEnsaio(novo)
    setLinhas(linhasDe(novo))
    setEditando(null)
    setMostrar(PASSO_DA_LISTA)
  }

  const confirmar = async () => {
    if (gravando || escolhas.length === 0) return
    setGravando(true)
    const toasts = useToastStore.getState()
    try {
      const antes = await confirmarRequisitosDosAntigos(escolhas)
      toasts.push('info', antes.length === 0 ? 'Nada mudou: os cartões já tinham o que a proposta põe.' : `Requisitos gravados em ${formatarNumero(antes.length)} ${antes.length === 1 ? 'cartão' : 'cartões'} das fichas.`)
      setUltimo(antes)
      depoisDeGravar()
    } catch (erro) {
      toasts.push('error', `Não deu para gravar os requisitos: ${mensagemDoErro(erro)}`)
    } finally {
      setGravando(false)
    }
  }

  const desfazer = async () => {
    if (gravando || ultimo.length === 0) return
    setGravando(true)
    const toasts = useToastStore.getState()
    try {
      const voltaram = await desfazerRequisitosDosAntigos(ultimo)
      toasts.push('info', `Desfeito: ${formatarNumero(voltaram)} ${voltaram === 1 ? 'cartão voltou' : 'cartões voltaram'} a ficar como antes.`)
      setUltimo([])
      depoisDeGravar()
    } catch (erro) {
      toasts.push('error', `Não deu para desfazer: ${mensagemDoErro(erro)}`)
    } finally {
      setGravando(false)
    }
  }

  return (
    <section className="mu-armas mu-alc mu-req-antigos" aria-labelledby={`${idBase}-tit`} aria-busy={lidas === null || gravando}>
      <h3 className="mu-armas__tit" id={`${idBase}-tit`}>
        Dar requisitos aos antigos
      </h3>
      <p className="mu-armas__sub">
        Os cartões de antes dizem o que pedem só no texto e nos extras. O Claude leu cada um e propôs os requisitos (e as marcas e o acumulador); confira, mude o que quiser e Confirme. Nada se grava antes. O texto e os extras ficam como estão. O que ficar em Não mexer segue como está.
      </p>
      {lidas !== null && lidas.aviso !== null && <p className="mu-campo__dica">{lidas.aviso}</p>}
      {ultimo.length > 0 && (
        <p className="mu-alc__feito" role="status">
          Gravado em {formatarNumero(ultimo.length)} {ultimo.length === 1 ? 'cartão' : 'cartões'} (cópia de antes ao lado do arquivo, rpg.json.antes-dos-requisitos).{' '}
          <button type="button" className="mu-bt mu-bt--p" disabled={gravando} onClick={() => void desfazer()}>
            Desfazer
          </button>
        </p>
      )}
      {nada ? (
        <p className="mu-armas__nada">Nada a fazer: os cartões com proposta já têm os requisitos{ensaio.jaFeitos > 0 ? ` (${formatarNumero(ensaio.jaFeitos)} prontos)` : ''}.</p>
      ) : (
        <>
          <div className="mu-alc__resumo">
            <span>
              {formatarNumero(ensaio.antigos.length)} com proposta ({formatarNumero(ensaio.antigos.length - baixas)} certeza alta, {formatarNumero(baixas)} baixa) · {formatarNumero(escolhas.length)} para gravar
              {ensaio.jaFeitos > 0 ? ` · ${formatarNumero(ensaio.jaFeitos)} já prontos` : ''}
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
                {grupo.antigos.map((antigo) => {
                  const linha = linhas[antigo.chave]
                  const personagem = fichas.get(antigo.personagemId)
                  if (linha === undefined || personagem === undefined) return null
                  return <LinhaDoAntigo key={antigo.chave} antigo={antigo} linha={linha} editando={editando === antigo.chave} personagem={personagem} sistema={sistema} onDecidir={decidir} onEditar={editar} onCartao={mudarCartao} />
                })}
              </ul>
            </div>
          ))}
          {mostrar < ensaio.antigos.length && (
            <button type="button" className="mu-bt mu-bt--p mu-alc__mais" onClick={() => setMostrar((antes) => antes + PASSO_DA_LISTA)}>
              Mostrar mais {formatarNumero(Math.min(PASSO_DA_LISTA, ensaio.antigos.length - mostrar))} (faltam {formatarNumero(ensaio.antigos.length - mostrar)})
            </button>
          )}
        </>
      )}
      {ensaio.semBloco.length > 0 && (
        <details className="mu-armas__bloco">
          <summary className="mu-armas__bloco-tit">Lidos sem bloco ({formatarNumero(ensaio.semBloco.length)})</summary>
          <ul className="mu-armas__lista">
            {ensaio.semBloco.map((lido) => (
              <li key={lido.chave}>
                <b>{lido.nome}</b>
                {lido.personagemNome === undefined ? '' : ` (${lido.personagemNome})`}: {lido.porque}
              </li>
            ))}
          </ul>
        </details>
      )}
      {ensaio.semCartao.length > 0 && (
        <div className="mu-armas__bloco">
          <h4 className="mu-armas__bloco-tit">Cartão não achado ({formatarNumero(ensaio.semCartao.length)})</h4>
          <ul className="mu-armas__lista">
            {ensaio.semCartao.map((sumido) => (
              <li key={sumido.chave}>
                <b>{sumido.nome}</b>: o cartão saiu da ficha depois da leitura; nada a gravar.
              </li>
            ))}
          </ul>
        </div>
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
