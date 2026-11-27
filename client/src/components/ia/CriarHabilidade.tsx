import { lazy, Suspense, useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { ABA_DAS_TECNICAS } from '../../lib/batalha/leituraDaFicha'
import { CAMPO_DA_DESCRICAO } from '../../lib/batalha/mecanica/conversao/comum'
import type { FichaDaPrevia } from '../../lib/batalha/mecanica/resumo'
import { DESCRICAO_DA_HABILIDADE_MAX, type PropostaDeHabilidade, type TipoDaHabilidadeDaIa } from '../../lib/ia/criarHabilidade'
import { ABA_DAS_TRANSFORMACOES, ehMecanicaDeForma } from '../../lib/livros/catalogo'
import { cartoesDaAba, type CartaoDaFicha, type Personagem } from '../../lib/personagem'
import { abaDoSistema, type SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { useIaStore } from '../../stores/iaStore'
import { useMundoDoLivroStore } from '../../stores/mundoDoLivroStore'
import { abaDoCartaoNovo, comCartoesNovos, resumoDaLinha, tecnicasDaFicha } from '../habilidades/listaDaFicha'
import { gravarNoMundo, Retrato, trocarFicha } from '../livros/comum'
import { IconeDaIa } from './icones'
// Os controles das peças no editor (como o HabilidadeNaFicha, que também abre o editor): sem eles, a
// escolha "Pega" e as outras aparecem sem estilo quando o editor abre daqui antes de qualquer ficha.
import '../batalha/MecanicaDaTecnica.css'
import '../batalha/combate.css'

/**
 * CRIAR HABILIDADE E TRANSFORMAÇÃO na conversa do assistente (pedido de 27/11/2026): o formulário
 * (para qual ficha + como é) e, quando a IA responde, a PROPOSTA: o cartão já conferido pelo leitor e
 * pelo validador do editor, com "O que acontece" gerado das peças (a mesma frase da lista da ficha).
 * "Abrir no editor" abre o MESMO editor das habilidades, ligado à ficha escolhida; o "Salvar na
 * ficha" dele grava pelo funil do mundo (`gravarNoMundo`), com Desfazer. Nada vai ao disco antes.
 */

const EditorDaHabilidade = lazy(() => import('../batalha/editor/EditorDaHabilidade').then((modulo) => ({ default: modulo.EditorDaHabilidade })))

const TEXTOS: Readonly<Record<TipoDaHabilidadeDaIa, { titulo: string; pergunta: string; exemplo: string }>> = {
  habilidade: { titulo: 'Criar habilidade', pergunta: 'Como é a habilidade?', exemplo: 'Ex.: técnica de gelo que prende o alvo no chão' },
  transformacao: { titulo: 'Criar transformação', pergunta: 'Como é a transformação?', exemplo: 'Ex.: forma de fera que dobra a velocidade por 3 turnos' },
}

/** Os grupos do "Para qual ficha?", nesta ordem (as da conversa vêm antes). */
const TIPOS_NO_SELETOR: readonly Personagem['tipo'][] = ['jogador', 'npc']

export interface CriarHabilidadeFormProps {
  tipo: TipoDaHabilidadeDaIa
  personagens: readonly Personagem[]
  /** As fichas na conversa: vêm primeiro no seletor e a primeira é a escolhida, sem `alvoInicial`. */
  daConversa: readonly string[]
  /** O que o texto livre já disse; vazio = começa em branco. */
  descricaoInicial: string
  alvoInicial: string | null
  onCriar: (descricao: string, alvoId: string) => void
  onCancelar: () => void
}

export function CriarHabilidadeForm({ tipo, personagens, daConversa, descricaoInicial, alvoInicial, onCriar, onCancelar }: CriarHabilidadeFormProps) {
  const textos = TEXTOS[tipo]
  const existe = (id: string | null | undefined): id is string => id !== null && id !== undefined && personagens.some((personagem) => personagem.id === id)
  const [descricao, setDescricao] = useState(descricaoInicial)
  const [alvoId, setAlvoId] = useState(() => (existe(alvoInicial) ? alvoInicial : (daConversa.find(existe) ?? '')))
  const [erro, setErro] = useState<{ campo: 'desc' | 'alvo'; texto: string } | null>(null)
  const descricaoRef = useRef<HTMLTextAreaElement>(null)
  const alvoRef = useRef<HTMLSelectElement>(null)
  const id = useId()

  // Só ao abrir (depois, o foco é do mestre), na ordem da tela: sem ficha escolhida, a ficha; com ela, a descrição.
  const focoInicial = useRef(alvoId === '' ? alvoRef : descricaoRef)
  useEffect(() => {
    focoInicial.current.current?.focus()
  }, [])

  // A conferência segue a ordem da tela: primeiro a ficha, depois a descrição.
  const enviar = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!existe(alvoId)) {
      setErro({ campo: 'alvo', texto: 'Escolha a ficha que vai receber.' })
      alvoRef.current?.focus()
      return
    }
    if (descricao.trim().length === 0) {
      setErro({ campo: 'desc', texto: 'Descreva em uma frase o que ela faz.' })
      descricaoRef.current?.focus()
      return
    }
    onCriar(descricao, alvoId)
  }

  const naConversa = daConversa.filter(existe)
  const fora = personagens.filter((personagem) => !naConversa.includes(personagem.id))
  const porId = new Map(personagens.map((personagem) => [personagem.id, personagem]))
  const erroDe = (campo: 'desc' | 'alvo') => (erro !== null && erro.campo === campo ? erro.texto : null)
  const descricaoAria = (campo: 'desc' | 'alvo') => (erroDe(campo) === null ? {} : { 'aria-invalid': true, 'aria-describedby': `${id}-erro-${campo}` })

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
        {textos.titulo}
      </h3>
      <div className="mu-campo">
        <label htmlFor={`${id}-alvo`}>Para qual ficha?</label>
        <select
          ref={alvoRef}
          className="mu-seletor"
          id={`${id}-alvo`}
          value={alvoId}
          disabled={personagens.length === 0}
          onChange={(event) => {
            setAlvoId(event.target.value)
            setErro(null)
          }}
          {...descricaoAria('alvo')}
        >
          <option value="">{personagens.length === 0 ? 'Nenhuma ficha nesta pasta' : 'Escolha a ficha'}</option>
          {naConversa.length > 0 && (
            <optgroup label="Na conversa">
              {naConversa.map((fichaId) => (
                <option key={fichaId} value={fichaId}>
                  {porId.get(fichaId)?.nome ?? ''}
                </option>
              ))}
            </optgroup>
          )}
          {TIPOS_NO_SELETOR.map((tipoDaFicha) => {
            const doTipo = fora.filter((personagem) => personagem.tipo === tipoDaFicha)
            if (doTipo.length === 0) return null
            return (
              <optgroup key={tipoDaFicha} label={tipoDaFicha === 'jogador' ? 'Jogadores' : 'NPCs'}>
                {doTipo.map((personagem) => (
                  <option key={personagem.id} value={personagem.id}>
                    {personagem.nome}
                  </option>
                ))}
              </optgroup>
            )
          })}
        </select>
        {erroDe('alvo') !== null && (
          <span className="mu-campo__erro" id={`${id}-erro-alvo`}>
            {erroDe('alvo')}
          </span>
        )}
        {personagens.length === 0 && <span className="mu-campo__dica">Crie a ficha primeiro (Criar boneco ou Jogadores).</span>}
      </div>
      <div className="mu-campo">
        <label htmlFor={`${id}-desc`}>{textos.pergunta}</label>
        <textarea
          ref={descricaoRef}
          className="mu-entrada ia-area"
          id={`${id}-desc`}
          rows={3}
          value={descricao}
          maxLength={DESCRICAO_DA_HABILIDADE_MAX}
          onChange={(event) => {
            setDescricao(event.target.value)
            setErro(null)
          }}
          placeholder={textos.exemplo}
          {...descricaoAria('desc')}
        />
        {erroDe('desc') !== null && (
          <span className="mu-campo__erro" id={`${id}-erro-desc`}>
            {erroDe('desc')}
          </span>
        )}
        <span className="mu-campo__dica">A IA propõe com as regras e a ficha; você confere no editor antes de salvar.</span>
      </div>
      <div className="mu-pg-acoes">
        <button type="submit" className="mu-bt mu-bt--p mu-bt--primario" disabled={personagens.length === 0}>
          <IconeDaIa nome="ia" />
          Propor
        </button>
        <button type="button" className="mu-bt mu-bt--p mu-bt--fantasma" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

export interface PropostaNaConversaProps {
  mensagemId: string
  proposta: PropostaDeHabilidade
  sistema: SistemaDeRpg
  personagens: readonly Personagem[]
}

/** A proposta da IA na conversa: o resumo gerado das peças, "Abrir no editor" e "Descartar". */
export function PropostaNaConversa({ mensagemId, proposta, sistema, personagens }: PropostaNaConversaProps) {
  const [editando, setEditando] = useState(false)
  const salvando = useRef(false)
  const abrirFichaRef = useRef<HTMLButtonElement>(null)
  const id = useId()
  const { cartao } = proposta
  const alvo = personagens.find((personagem) => personagem.id === proposta.alvoId)
  const ficha = useMemo<FichaDaPrevia | null>(() => (alvo === undefined ? null : { personagem: alvo, sistema }), [alvo, sistema])
  const tecnicas = useMemo(() => (alvo === undefined ? [] : [...tecnicasDaFicha(alvo, sistema), cartao]), [alvo, sistema, cartao])
  // A linha da lista da ficha: a ação, o custo e a frase do papel, todos gerados das peças.
  const linha = ficha === null ? null : resumoDaLinha(cartao, ficha)
  const forma = ehMecanicaDeForma(cartao.mecanica)
  const comAbaDasFormas = abaDoSistema(sistema, ABA_DAS_TRANSFORMACOES) !== undefined
  const abaId = abaDoCartaoNovo(cartao, ABA_DAS_TECNICAS, comAbaDasFormas)
  const descricao = (cartao.campos[CAMPO_DA_DESCRICAO] ?? '').trim()
  const nome = cartao.nome.trim() || (forma ? 'A transformação' : 'A habilidade')

  // Salvou: o foco vai ao "Abrir a ficha", no lugar do botão que sumiu.
  useEffect(() => {
    if (proposta.salva) abrirFichaRef.current?.focus()
  }, [proposta.salva])

  const salvarNaFicha = async (novo: CartaoDaFicha) => {
    if (alvo === undefined || salvando.current) return
    salvando.current = true
    const alvoId = alvo.id
    const destino = abaDoCartaoNovo(novo, ABA_DAS_TECNICAS, comAbaDasFormas)
    const gravou = await gravarNoMundo((lista) => trocarFicha(lista, alvoId, (atual) => comCartoesNovos(atual, destino, [novo])), {
      texto: `${novo.nome.trim() || nome} entrou na ficha de ${alvo.nome}.`,
      desfazer: (lista) => trocarFicha(lista, alvoId, (atual) => ({ ...atual, abas: { ...atual.abas, [destino]: cartoesDaAba(atual, destino).filter((outro) => outro.id !== novo.id) } })),
    })
    salvando.current = false
    if (!gravou) return
    useIaStore.getState().trocarCartaoDaProposta(mensagemId, novo)
    useIaStore.getState().marcarPropostaSalva(mensagemId, true)
    setEditando(false)
  }

  const sub = [alvo === undefined ? 'A ficha não está mais na pasta' : `Para ${alvo.nome}`, linha?.acao ?? '', linha?.custo ?? ''].filter((parte) => parte.length > 0).join(' · ')
  return (
    <section className="ia-npc ia-prop" aria-labelledby={`${id}-nome`}>
      <div className="ia-npc__cab">
        <Retrato imagem={alvo?.retrato ?? null} nome={alvo?.nome ?? nome} />
        <div>
          <p className="ia-prop__tipo">{forma ? 'Transformação proposta' : 'Habilidade proposta'}</p>
          <h3 className="ia-npc__nome" id={`${id}-nome`}>
            {nome}
          </h3>
          <p className="ia-npc__sub">{sub}</p>
        </div>
      </div>
      {linha !== null && (
        <div className="ia-prop__frase">
          <span className="ia-prop__rotulo">O que acontece</span>
          <p>{linha.frase}</p>
        </div>
      )}
      {descricao.length > 0 && <p className="ia-npc__desc">{descricao}</p>}
      {proposta.salva && alvo !== undefined ? (
        <p className="mu-pg-nota" role="status">
          Está na ficha de {alvo.nome}{abaId === ABA_DAS_TRANSFORMACOES ? ', em Transformações' : ''}.{' '}
          <button ref={abrirFichaRef} type="button" className="ia-msg__acao" onClick={() => useMundoDoLivroStore.getState().abrirFicha(alvo.id)}>
            Abrir a ficha
          </button>
        </p>
      ) : (
        <div className="ia-npc__acoes">
          <button type="button" className="mu-bt mu-bt--p mu-bt--primario" onClick={() => setEditando(true)} disabled={alvo === undefined} aria-haspopup="dialog">
            Abrir no editor
          </button>
          <button type="button" className="mu-bt mu-bt--p mu-bt--fantasma" onClick={() => useIaStore.getState().descartarProposta(mensagemId)}>
            Descartar
          </button>
        </div>
      )}
      {editando && ficha !== null && (
        <Suspense fallback={null}>
          <EditorDaHabilidade
            cartao={cartao}
            ficha={ficha}
            quemEdita="mestre"
            tecnicas={tecnicas}
            podeOcultar
            abaDoCartao={abaId}
            trilha="proposta da IA: entra na ficha quando você salvar"
            onChange={(novo) => useIaStore.getState().trocarCartaoDaProposta(mensagemId, novo)}
            onFechar={() => setEditando(false)}
            onSalvar={(novo) => void salvarNaFicha(novo)}
          />
        </Suspense>
      )}
    </section>
  )
}
