import { lazy, Suspense, useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { escolherImagemDaFicha } from '../../lib/arquivosDaFicha'
import { tipoDoBonecoNoTexto } from '../../lib/ia/criarHabilidade'
import { DESCRICAO_DO_NPC_MAX, NIVEIS_DO_NPC, nomeJaUsado, type NivelDoNpc } from '../../lib/ia/gerarNpc'
import { colunaDaComparacao } from '../../lib/livros/encontro'
import { CAMPOS_DA_SAUDE, lerSaude } from '../../lib/livros/saude'
import { MOTOR_DRAGON_BALL, motorDoSistema } from '../../lib/motores'
import { camposVisiveis, cartoesDaAba, type Personagem, type TipoDePersonagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { PERSONAGEM_NOME_MAX } from '../../net/protocoloDoPersonagem'
import { useIaStore } from '../../stores/iaStore'
import { useMundoDoLivroStore } from '../../stores/mundoDoLivroStore'
import { sistemaPorId, useRpgStore } from '../../stores/rpgStore'
import { useToastStore } from '../../stores/toastStore'
import { escolhasDaFicha, formatarNumero, gravarNoMundo, Retrato } from '../livros/comum'
import { IconeDaIa } from './icones'

/** A ficha inteira, para o "Abrir na ficha" do boneco gerado: só baixa quando o mestre abre. */
const FichaDePersonagemDialog = lazy(() => import('../FichaDePersonagemDialog').then((modulo) => ({ default: modulo.FichaDePersonagemDialog })))

/**
 * GERAR NPC na conversa do assistente (M4, porte do protótipo): o formulário
 * ("Como é o NPC?" + força perto do grupo) e, quando a IA responde, a ficha
 * para revisar — nome editável, atributos, HP/SP/Escudo e as técnicas com o
 * dano que o app lê — e "Salvar no bestiário" pelo funil único do mundo
 * (`gravarNoMundo`), com Desfazer.
 *
 * No Dragon Ball Tales o formulário é o mesmo; a ficha vem de
 * lib/ia/gerarNpcDBT.ts (`Personagem.dbt`, pelo ramo do PainelDaIa) e a
 * revisão é `NpcGeradoDBT`, com o resumo do bestiário do Dragon Ball.
 */

export interface GerarNpcFormProps {
  /** `tipo`: no Gerar NPC, sempre 'npc'; no Criar boneco, o que o mestre escolheu. */
  onGerar: (descricao: string, nivel: NivelDoNpc, tipo: TipoDePersonagem) => void
  onCancelar: () => void
  /** Criar boneco (pedido de 27/11): o mesmo formulário, com a escolha entre ficha de jogador e NPC. */
  boneco?: boolean
  /** O que o texto livre já disse ("cria um boneco de pirata"). */
  descricaoInicial?: string
}

const EXEMPLO_PADRAO = 'Ex.: tenente da Marinha que luta com correntes'
const EXEMPLO_DRAGON_BALL = 'Ex.: soldado do Freeza que dispara rajadas de Ki'
const EXEMPLO_DO_BONECO = 'Ex.: atiradora do bando que cura com ervas'

const TIPOS_DO_BONECO: readonly { valor: TipoDePersonagem; rotulo: string }[] = [
  { valor: 'jogador', rotulo: 'Jogador (ficha nova da mesa)' },
  { valor: 'npc', rotulo: 'NPC (bestiário)' },
]

/** O formulário é o mesmo nos dois motores; o exemplo da caixa acompanha o sistema aberto. */
export function GerarNpcForm(props: GerarNpcFormProps) {
  const sistemaId = useMundoDoLivroStore((state) => state.aberto?.sistemaId)
  const sistema = useRpgStore((state) => (sistemaId === undefined ? undefined : sistemaPorId(state.biblioteca, sistemaId)))
  const exemplo = props.boneco === true ? EXEMPLO_DO_BONECO : motorDoSistema(sistema) === MOTOR_DRAGON_BALL ? EXEMPLO_DRAGON_BALL : EXEMPLO_PADRAO
  return <GerarNpcFormPadrao {...props} exemplo={exemplo} />
}

function GerarNpcFormPadrao({ onGerar, onCancelar, boneco = false, descricaoInicial = '', exemplo }: GerarNpcFormProps & { exemplo: string }) {
  const [descricao, setDescricao] = useState(descricaoInicial)
  const [nivel, setNivel] = useState<NivelDoNpc>('nivel')
  const [tipo, setTipo] = useState<TipoDePersonagem>(() => (boneco ? tipoDoBonecoNoTexto(descricaoInicial) : 'npc'))
  const [erro, setErro] = useState<string | null>(null)
  const descricaoRef = useRef<HTMLTextAreaElement>(null)
  const id = useId()

  useEffect(() => {
    descricaoRef.current?.focus()
  }, [])

  const enviar = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (descricao.trim().length === 0) {
      setErro(boneco ? 'Descreva o boneco em uma frase.' : 'Descreva o NPC em uma frase.')
      descricaoRef.current?.focus()
      return
    }
    onGerar(descricao, nivel, boneco ? tipo : 'npc')
  }

  return (
    <form
      className="ia-gerar"
      onSubmit={enviar}
      noValidate
      aria-labelledby={`${id}-tit`}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          onCancelar()
        }
      }}
    >
      <h3 className="ia-gerar__tit" id={`${id}-tit`}>
        {boneco ? 'Criar boneco' : 'Gerar NPC'}
      </h3>
      {boneco && (
        <div className="mu-campo">
          <label htmlFor={`${id}-tipo`}>A ficha é de</label>
          <select className="mu-seletor" id={`${id}-tipo`} value={tipo} onChange={(event) => setTipo(TIPOS_DO_BONECO.find((opcao) => opcao.valor === event.target.value)?.valor ?? 'jogador')}>
            {TIPOS_DO_BONECO.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="mu-campo">
        <label htmlFor={`${id}-desc`}>{boneco ? 'Como é o boneco?' : 'Como é o NPC?'}</label>
        <textarea
          ref={descricaoRef}
          className="mu-entrada ia-area"
          id={`${id}-desc`}
          rows={3}
          value={descricao}
          maxLength={DESCRICAO_DO_NPC_MAX}
          onChange={(event) => {
            setDescricao(event.target.value)
            setErro(null)
          }}
          placeholder={exemplo}
          aria-invalid={erro === null ? undefined : true}
          aria-describedby={erro === null ? undefined : `${id}-erro`}
        />
        {erro !== null && (
          <span className="mu-campo__erro" id={`${id}-erro`}>
            {erro}
          </span>
        )}
      </div>
      <div className="mu-campo">
        <label htmlFor={`${id}-nivel`}>Força perto do grupo</label>
        <select className="mu-seletor" id={`${id}-nivel`} value={nivel} onChange={(event) => setNivel(NIVEIS_DO_NPC.find((opcao) => opcao.valor === event.target.value)?.valor ?? 'nivel')}>
          {NIVEIS_DO_NPC.map((opcao) => (
            <option key={opcao.valor} value={opcao.valor}>
              {opcao.rotulo}
            </option>
          ))}
        </select>
        <span className="mu-campo__dica">
          O grupo é o de Comparar; sem grupo lá, os jogadores da campanha.{boneco && ' As técnicas vêm montadas em peças; você confere na ficha antes de salvar.'}
        </span>
      </div>
      <div className="mu-pg-acoes">
        <button type="submit" className="mu-bt mu-bt--p mu-bt--primario">
          <IconeDaIa nome="ia" />
          {boneco ? 'Propor ficha' : 'Gerar ficha'}
        </button>
        <button type="button" className="mu-bt mu-bt--p mu-bt--fantasma" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

export interface NpcGeradoProps {
  npc: Personagem
  sistema: SistemaDeRpg
  personagens: readonly Personagem[]
  /** As técnicas cuja mecânica não passou no validador e ficaram só no texto, com o motivo. */
  avisos: readonly string[]
  /** "Gerar outro": abre o formulário de novo. */
  onGerarOutro: () => void
}

/** "O app lê 7 de 8 campos": Lido e Lê na hora contam como lidos; À mão fica fora da conta. */
function contagemDaLeitura(npc: Personagem, sistema: SistemaDeRpg): { lidos: number; total: number } {
  const { contagem } = lerSaude([npc], sistema)
  let lidos = 0
  let total = 0
  for (const campo of CAMPOS_DA_SAUDE) {
    const c = contagem[campo]
    lidos += c.lido + c.naHora
    total += c.lido + c.naHora + c.naoLe
  }
  return { lidos, total }
}

export function NpcGerado({ npc, sistema, personagens, avisos, onGerarOutro }: NpcGeradoProps) {
  const [nome, setNome] = useState(npc.nome)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  // A ficha aberta no "Abrir na ficha": a cópia do momento em que abriu (o rascunho da janela não volta a cada desenho daqui).
  const [naFicha, setNaFicha] = useState<Personagem | null>(null)
  const nomeRef = useRef<HTMLInputElement>(null)
  const id = useId()
  const sistemaId = useMundoDoLivroStore((state) => state.aberto?.sistemaId)
  const coluna = useMemo(() => colunaDaComparacao(npc, sistema), [npc, sistema])
  const leitura = useMemo(() => contagemDaLeitura(npc, sistema), [npc, sistema])
  const danoPorCartao = useMemo(() => new Map(coluna.golpes.flatMap((golpe) => (golpe.cartao === null || golpe.valor === null ? [] : [[golpe.cartao.id, golpe.valor] as const]))), [coluna]) // as const: tupla [id, dano] para o Map, não é cast
  const abasComCartoes = sistema.abas.filter((aba) => cartoesDaAba(npc, aba.id).length > 0)
  const escolhas = escolhasDaFicha(npc, sistema)
  const ehJogador = npc.tipo === 'jogador'

  // A ficha chegou: o foco vai para o nome, o primeiro campo da revisão.
  useEffect(() => {
    nomeRef.current?.focus()
  }, [npc.id])

  /** Grava a ficha nova pelo funil do mundo, com Desfazer. `daFicha`: veio do Salvar da ficha aberta, que reabre já gravada. */
  const gravarNova = async (ficha: Personagem, daFicha: boolean): Promise<void> => {
    setSalvando(true)
    const gravou = await gravarNoMundo((lista) => [...lista, ficha], {
      texto: ficha.tipo === 'jogador' ? `${ficha.nome} entrou nos jogadores da campanha.` : `${ficha.nome} foi salvo no bestiário.`,
      desfazer: (lista) => lista.filter((personagem) => personagem.id !== ficha.id),
    })
    setSalvando(false)
    if (!gravou) return
    // A página NPCs de combate abre já nele; o jogador (e quem conferiu na ficha) abre a ficha gravada.
    if (ficha.tipo === 'npc') useMundoDoLivroStore.getState().escolherNpc(ficha.id)
    if (daFicha || ficha.tipo === 'jogador') useMundoDoLivroStore.getState().abrirFicha(ficha.id)
    useIaStore.getState().descartarGerado()
  }

  const salvar = () => {
    const escolhido = nome.trim() || npc.nome
    if (nomeJaUsado(escolhido, personagens)) {
      setErro(`Já existe “${escolhido}” na campanha. Troque o nome antes de salvar.`)
      nomeRef.current?.focus()
      return
    }
    void gravarNova({ ...npc, nome: escolhido }, false)
  }

  /** O Salvar da ficha aberta: nome repetido segura a janela na edição (`false`), como o Salvar daqui. */
  const salvarDaFicha = (salvo: Personagem): boolean | void => {
    const escolhido = salvo.nome.trim() || npc.nome
    if (nomeJaUsado(escolhido, personagens)) {
      useToastStore.getState().push('error', `Já existe “${escolhido}” na campanha. Troque o nome antes de salvar.`)
      return false
    }
    void gravarNova({ ...salvo, nome: escolhido }, true)
  }

  const titulo = nome.trim() || npc.nome
  return (
    <section className="ia-npc" aria-labelledby={`${id}-nome`}>
      <div className="ia-npc__cab">
        <Retrato imagem={null} nome={titulo} />
        <div>
          <h3 className="ia-npc__nome" id={`${id}-nome`}>
            {titulo}
          </h3>
          <p className="ia-npc__sub">{[escolhas, ehJogador ? 'Jogador' : 'NPC único'].filter((parte) => parte.length > 0).join(' · ')}</p>
        </div>
      </div>
      {npc.descricao.length > 0 && <p className="ia-npc__desc">{npc.descricao}</p>}
      <div className="mu-campo">
        <label htmlFor={`${id}-nomear`}>Nome</label>
        <input
          ref={nomeRef}
          className="mu-entrada"
          id={`${id}-nomear`}
          value={nome}
          maxLength={PERSONAGEM_NOME_MAX}
          autoComplete="off"
          onChange={(event) => {
            setNome(event.target.value)
            setErro(null)
          }}
          aria-invalid={erro === null ? undefined : true}
          aria-describedby={erro === null ? undefined : `${id}-erro`}
        />
        {erro !== null && (
          <span className="mu-campo__erro" id={`${id}-erro`} role="alert">
            {erro}
          </span>
        )}
      </div>
      <div className="ia-atrs">
        {coluna.atributos.map((atributo) => (
          <div className="ia-atr" key={atributo.id} title={atributo.nome}>
            <span className="ia-atr__ab">{atributo.abreviacao}</span>
            <span className="ia-atr__val">
              {formatarNumero(atributo.valor)}
              {atributo.rank !== null && <span className="ia-atr__rank">{atributo.rank}</span>}
            </span>
          </div>
        ))}
      </div>
      <p className="mu-pg-nota">
        {coluna.hp !== null && (
          <>
            HP <b>{formatarNumero(coluna.hp.maximo)}</b>
          </>
        )}
        {coluna.sp !== null && (
          <>
            {' · '}SP <b>{formatarNumero(coluna.sp.maximo)}</b>
          </>
        )}
        {coluna.escudo !== null && (
          <>
            {' · '}Escudo <b>{formatarNumero(coluna.escudo)}</b>
          </>
        )}
      </p>
      {abasComCartoes.map((aba) => (
        <div key={aba.id} className="ia-npc__aba">
          <h4 className="ia-npc__aba-tit">{aba.nome}</h4>
          <ul className="ia-npc__tec">
            {cartoesDaAba(npc, aba.id).map((cartao) => {
              const campos = camposVisiveis(aba, cartao, 'linha')
              const dano = danoPorCartao.get(cartao.id)
              return (
                <li key={cartao.id}>
                  <b>{cartao.nome}</b>
                  {campos.length > 0 && (
                    <span>
                      {campos.map((campo) => `${campo.rotulo}: ${campo.valor}`).join(' · ')}
                      {dano !== undefined && ` (= ${formatarNumero(dano)} de dano)`}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
      {leitura.total > 0 && (
        <p className={leitura.lidos === leitura.total ? 'mu-pg-nota' : 'mu-pg-nota mu-pg-nota--aviso'}>
          O app lê {leitura.lidos} de {leitura.total} campos de batalha desta ficha{leitura.lidos === leitura.total ? '.' : ': o resto aparece na Saúde da ficha depois de salvar.'}
        </p>
      )}
      {avisos.length > 0 && (
        <div className="ia-npc__aba">
          <h4 className="ia-npc__aba-tit">Ficaram só no texto (a mecânica não passou na conferência)</h4>
          <ul className="ia-npc__avisos">
            {avisos.map((aviso, i) => (
              <li key={i}>{aviso}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="ia-npc__acoes">
        <button type="button" className="mu-bt mu-bt--p mu-bt--primario" onClick={() => setNaFicha({ ...npc, nome: titulo })} disabled={salvando} aria-haspopup="dialog">
          Abrir na ficha
        </button>
        <button type="button" className="mu-bt mu-bt--p" onClick={salvar} disabled={salvando} aria-busy={salvando || undefined}>
          {ehJogador ? 'Salvar nos jogadores' : 'Salvar no bestiário'}
        </button>
        <button type="button" className="mu-bt mu-bt--p" onClick={onGerarOutro} disabled={salvando}>
          Gerar outro
        </button>
        <button type="button" className="mu-bt mu-bt--p mu-bt--fantasma" onClick={() => useIaStore.getState().descartarGerado()} disabled={salvando}>
          Descartar
        </button>
      </div>
      {naFicha !== null && (
        <Suspense fallback={null}>
          <FichaDePersonagemDialog
            personagem={naFicha}
            sistema={sistema}
            sistemaId={sistemaId}
            editandoNoInicio
            onSalvar={salvarDaFicha}
            onClose={() => setNaFicha(null)}
            escolherImagem={escolherImagemDaFicha}
            outrasFichas={personagens}
            tokens={[]}
            onLigarToken={() => undefined}
          />
        </Suspense>
      )}
    </section>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Dragon Ball Tales
// ───────────────────────────────────────────────────────────────────────────

/**
 * O resumo da ficha do bestiário do Dragon Ball (PV, PK, CA, EP, atributos,
 * técnicas com Ki e faixa) em pedaço próprio: ele, as contas do mundo e o
 * estilo `dbm-` só baixam quando um NPC do Dragon Ball é gerado.
 */
const ResumoDoNpcGerado = lazy(() =>
  Promise.all([import('../dbt/mundo/ResumoDoNpcDBT'), import('../dbt/mundo/contasDoMundo'), import('../dbt/mundo/mundoDBT.css')]).then(([resumo, contas]) => {
    const { ResumoDoNpcDBT } = resumo
    const { RANKS_DO_LIVRO } = contas
    function ResumoDoNpcGerado({ personagem }: { personagem: Personagem }) {
      if (RANKS_DO_LIVRO === null) return <p className="mu-pg-nota mu-pg-nota--aviso">A tabela de ranks do livro não abriu: confira a ficha em NPCs de combate depois de salvar.</p>
      return <ResumoDoNpcDBT personagem={personagem} ranks={RANKS_DO_LIVRO} />
    }
    return { default: ResumoDoNpcGerado }
  }),
)

export interface NpcGeradoDBTProps {
  npc: Personagem
  personagens: readonly Personagem[]
  /** Nome da raça que o gerador escolheu; vazio = sem raça (ou a revisão reabriu sem os extras). */
  raca: string
  /** "ND 3 – Rank D (Elite)"; vazio = não mostra. */
  notacao: string
  /** O que o app ajustou na resposta da IA (rótulo fora do orçamento, raça desconhecida...) e os avisos de boa prática. */
  observacoes: readonly string[]
  /** "Gerar outro": abre o formulário de novo. */
  onGerarOutro: () => void
}

/**
 * A ficha Dragon Ball que a IA gerou, para revisar: nome editável, o resumo
 * do bestiário, o que as regras mudaram, e "Salvar no bestiário" pelo funil
 * único do mundo (`gravarNoMundo`), com Desfazer — como o `NpcGerado`.
 */
export function NpcGeradoDBT({ npc, personagens, raca, notacao, observacoes, onGerarOutro }: NpcGeradoDBTProps) {
  const [nome, setNome] = useState(npc.nome)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const nomeRef = useRef<HTMLInputElement>(null)
  const id = useId()

  // A ficha chegou: o foco vai para o nome, o primeiro campo da revisão.
  useEffect(() => {
    nomeRef.current?.focus()
  }, [npc.id])

  const salvar = async () => {
    const escolhido = nome.trim() || npc.nome
    if (nomeJaUsado(escolhido, personagens)) {
      setErro(`Já existe “${escolhido}” na campanha. Troque o nome antes de salvar.`)
      nomeRef.current?.focus()
      return
    }
    const ficha: Personagem = { ...npc, nome: escolhido }
    setSalvando(true)
    const gravou = await gravarNoMundo((lista) => [...lista, ficha], {
      texto: `${escolhido} foi salvo no bestiário.`,
      desfazer: (lista) => lista.filter((personagem) => personagem.id !== ficha.id),
    })
    setSalvando(false)
    if (!gravou) return
    // A página NPCs de combate abre já nele.
    useMundoDoLivroStore.getState().escolherNpc(ficha.id)
    useIaStore.getState().descartarGerado()
  }

  const titulo = nome.trim() || npc.nome
  return (
    <section className="ia-npc dbm" aria-labelledby={`${id}-nome`}>
      <div className="ia-npc__cab">
        <Retrato imagem={null} nome={titulo} />
        <div>
          <h3 className="ia-npc__nome" id={`${id}-nome`}>
            {titulo}
          </h3>
          <p className="ia-npc__sub">{[raca, notacao, 'NPC único'].filter((parte) => parte.length > 0).join(' · ')}</p>
        </div>
      </div>
      {npc.descricao.length > 0 && <p className="ia-npc__desc">{npc.descricao}</p>}
      <div className="mu-campo">
        <label htmlFor={`${id}-nomear`}>Nome</label>
        <input
          ref={nomeRef}
          className="mu-entrada"
          id={`${id}-nomear`}
          value={nome}
          maxLength={PERSONAGEM_NOME_MAX}
          autoComplete="off"
          onChange={(event) => {
            setNome(event.target.value)
            setErro(null)
          }}
          aria-invalid={erro === null ? undefined : true}
          aria-describedby={erro === null ? undefined : `${id}-erro`}
        />
        {erro !== null && (
          <span className="mu-campo__erro" id={`${id}-erro`} role="alert">
            {erro}
          </span>
        )}
      </div>
      <Suspense
        fallback={
          <p className="mu-pg-nota" role="status">
            Abrindo a ficha…
          </p>
        }
      >
        <ResumoDoNpcGerado personagem={npc} />
      </Suspense>
      {observacoes.length > 0 && (
        <div className="ia-npc__aba">
          <h4 className="ia-npc__aba-tit">Conferido nas regras do livro</h4>
          <ul className="dbm-avisos">
            {observacoes.map((observacao, i) => (
              <li key={i}>{observacao}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="ia-npc__acoes">
        <button type="button" className="mu-bt mu-bt--p mu-bt--primario" onClick={() => void salvar()} disabled={salvando} aria-busy={salvando || undefined}>
          Salvar no bestiário
        </button>
        <button type="button" className="mu-bt mu-bt--p" onClick={onGerarOutro} disabled={salvando}>
          Gerar outro
        </button>
        <button type="button" className="mu-bt mu-bt--p mu-bt--fantasma" onClick={() => useIaStore.getState().descartarGerado()} disabled={salvando}>
          Descartar
        </button>
      </div>
    </section>
  )
}
