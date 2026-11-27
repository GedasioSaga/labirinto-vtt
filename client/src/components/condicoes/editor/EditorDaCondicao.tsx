import { useCallback, useDeferredValue, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { catalogoDeCondicoes, type CondicaoDoCatalogo } from '../../../lib/condicoes/catalogo'
import { condicaoDaFabrica, ehDaFabrica } from '../../../lib/condicoes/fabrica'
import { avisosDe, quemCita, type ContextoDasFrases } from '../../../lib/condicoes/frasesDaCondicao'
import { FAMILIAS_DA_CONDICAO, PECAS_DA_CONDICAO_MAX, PRAZO_PADRAO, chaveDaCondicao, type FamiliaDaPecaDaCondicao, type PecaDaCondicao, type PrazoDaCondicao } from '../../../lib/condicoes/modelo'
import { gatilhoDeHoje, montarCondicao, regraDeHoje } from '../../../lib/condicoes/montadaDaAntiga'
import { renomearCondicao, type RenomeacaoDaCondicao } from '../../../lib/condicoes/renomear'
import { nomeDaCondicaoPosta, usosDaCondicao, type FontesDosUsos } from '../../../lib/condicoes/usos'
import { CORES_DE_CONDICAO, lerCondicaoPropria, simboloDaCondicaoPropria, type SimboloDeCondicao } from '../../../lib/condicoesProprias'
import type { Personagem } from '../../../lib/personagem'
import { useCatalogoStore } from '../../../stores/catalogoStore'
import { trocarCondicaoEmTodasAsCenas } from '../../../stores/condicoesNasCenas'
import { useCondicoesPropriasStore } from '../../../stores/condicoesPropriasStore'
import { useMundoDoLivroStore } from '../../../stores/mundoDoLivroStore'
import type { CondicaoPropria } from '../../../types/map'
import { useVariavelCss } from '../../batalha/editor/pecas/controlesDaPeca'
import { gravarNoMundo } from '../../livros/comum'
import { PastilhaDeCondicao } from '../../PastilhaDeCondicao'
import { simboloDoCatalogo } from '../PorCondicao'
import { BonecoDaCondicao } from './BonecoDaCondicao'
import { ComecarDe } from './ComecarDe'
import { NomeEPastilha, type IdentidadeDaCondicao } from './NomeEPastilha'
import { OndeAparece } from './OndeAparece'
import { PapelDaCondicao, type AlvoDoPapel } from './PapelDaCondicao'
import { GlifoDaCondicao } from './pecas/glifos'
import { PrazoESaida } from './PrazoESaida'
import { entradaDaPecaDaCondicao, REGISTRO_DAS_PECAS_DA_CONDICAO, type MotorDoBoneco } from './registro'
import './pecas/estilo'
import './editor.css'

/**
 * O EDITOR ÚNICO DA CONDIÇÃO (rework das condições, PLANO.md E6, D13; `telaEditor` do protótipo,
 * prototipo.html:1384). Livros › Condições, o painel do token, o "Pôr condição" do menu e o "Virar condição
 * nova" abrem ESTE editor. À esquerda: Começar de (só na nova), Nome e pastilha, O que ela faz (as peças),
 * Prazo, pilhas e saída, e Onde ela aparece. À direita: o cartão (cada linha leva até a seção que a
 * escreve) e o boneco ao vivo. Ctrl+Z desfaz, Ctrl+S salva no catálogo. De fábrica não se edita: o
 * "Usar como modelo" abre uma cópia (`AberturaDoEditor` 'modelo').
 *
 * O que se grava é a `CondicaoPropria` com as peças, o prazo e as saídas (`paraGravar`); a regra, o número
 * e o gatilho de antes vão junto, tirados das peças, para quem ainda lê o formato de antes. Renomear uma
 * criada com uso avisa com a lista e oferece "Renomear também nos N lugares", com Desfazer (D5).
 */

/** Quantos passos o Ctrl+Z guarda. */
const PILHA_MAX = 50
/** Mudanças seguidas nesta janela (digitar um número) viram um passo só do Ctrl+Z. */
const JUNTAR_MS = 800
const AVISO_MS = 6000
const SAIDA_DO_AVISO_MS = 150
const NOME_DA_NOVA = 'Condição nova'
const DESENHO_DA_NOVA: SimboloDeCondicao = 'chama'

/** Como o editor abre: condição nova (do zero), editar uma criada, cópia de uma pronta, ou um rascunho já montado ("Virar condição nova"). */
export type AberturaDoEditor = { tipo: 'nova' } | { tipo: 'editar'; condicao: CondicaoPropria } | { tipo: 'modelo'; base: CondicaoDoCatalogo } | { tipo: 'rascunho'; rascunho: CondicaoPropria }

export interface EditorDaCondicaoProps {
  abertura: AberturaDoEditor
  onFechar: () => void
  /** Gravou no catálogo; `nova` = a condição nasceu agora. */
  onSalvou?: (condicao: CondicaoPropria, nova: boolean) => void
  /** Apagar a criada aberta (o painel do token). Ausente = sem o botão. */
  onApagar?: (condicao: CondicaoPropria) => void
  /** As fichas da pasta (os usos e o renomear); ausente = as do livro aberto, se houver. */
  personagens?: readonly Personagem[]
  /** O motor do boneco (E5). */
  motor?: MotorDoBoneco
  /** Uma frase a mais em "Onde ela aparece" (o painel do token: em quantas fichas e cenas ela está). */
  nota?: string
}

interface Aviso {
  texto: string
  desfazer?: () => void
  saindo: boolean
  vez: number
}

/** A condição como se grava: as peças, o prazo e as saídas explícitos (o padrão fica ausente), a regra de antes tirada das peças. */
export function paraGravar(condicao: CondicaoPropria): CondicaoPropria {
  const montada = montarCondicao(condicao)
  const { regra: _regra, n: _n, gatilho: _gatilho, pecas: _pecas, prazo: _prazo, saidas: _saidas, confira: _confira, ...identidade } = condicao
  const deHoje = regraDeHoje(montada)
  const gatilho = gatilhoDeHoje(montada)
  return {
    ...identidade,
    ...(deHoje.regra === 'narra' ? {} : { regra: deHoje.regra, n: deHoje.n }),
    ...(gatilho === undefined ? {} : { gatilho }),
    pecas: [...montada.pecas],
    ...(mesmoPrazo(montada.prazo, PRAZO_PADRAO) ? {} : { prazo: montada.prazo }),
    ...(montada.saidas.length === 0 ? {} : { saidas: [...montada.saidas] }),
  }
}

function mesmoPrazo(a: PrazoDaCondicao, b: PrazoDaCondicao): boolean {
  return a.modo === b.modo && a.n === b.n && a.deNovo === b.deNovo && a.teto === b.teto
}

function mesmaCondicao(a: CondicaoPropria, b: CondicaoPropria | null): boolean {
  return b !== null && JSON.stringify(paraGravar(a)) === JSON.stringify(paraGravar(b))
}

/** Um nome livre a partir de `base`: "Congelado (minha)", "Congelado (minha 2)"… */
function nomeLivre(base: string, ocupados: readonly string[]): string {
  const chaves = new Set(ocupados.map(chaveDaCondicao))
  let nome = `${base} (minha)`
  for (let n = 2; chaves.has(chaveDaCondicao(nome)); n += 1) nome = `${base} (minha ${n})`
  return nome
}

/** A pastilha de uma pronta, para a cópia: a de fábrica pelo molde das criadas (`condicaoDaFabrica`), a criada como está. */
function pastilhaDaBase(base: CondicaoDoCatalogo): Pick<CondicaoPropria, 'cor' | 'simbolo' | 'texto' | 'desenho'> {
  const propria = base.pastilha.tipo === 'propria' ? base.pastilha.condicao : condicaoDaFabrica(base.id)
  if (propria === null) return { cor: CORES_DE_CONDICAO[0].valor, simbolo: DESENHO_DA_NOVA }
  return { cor: propria.cor, simbolo: propria.simbolo, ...(propria.texto === undefined ? {} : { texto: propria.texto }), ...(propria.desenho === undefined ? {} : { desenho: propria.desenho }) }
}

/** O que a pronta dá ao "Começar de" e ao "Usar como modelo": o tipo, as peças, o prazo e as saídas. */
function regraDaBase(base: CondicaoDoCatalogo): Pick<CondicaoPropria, 'tipo' | 'pecas' | 'prazo' | 'saidas'> {
  const { tipo, pecas, prazo, saidas } = base.montada
  return { ...(tipo === 'positiva' ? { tipo } : {}), pecas: [...pecas], prazo, saidas: [...saidas] }
}

function rascunhoInicial(abertura: AberturaDoEditor, catalogo: readonly CondicaoDoCatalogo[]): CondicaoPropria {
  const nomes = catalogo.map((condicao) => condicao.nome)
  const id = `cond_${crypto.randomUUID()}`
  switch (abertura.tipo) {
    case 'editar':
      return paraGravar(abertura.condicao)
    case 'rascunho':
      return paraGravar(abertura.rascunho)
    case 'modelo':
      return { id, nome: nomeLivre(abertura.base.nome, nomes), ...pastilhaDaBase(abertura.base), ...regraDaBase(abertura.base) }
    case 'nova': {
      const nome = nomes.some((outro) => chaveDaCondicao(outro) === chaveDaCondicao(NOME_DA_NOVA)) ? nomeLivre(NOME_DA_NOVA, nomes) : NOME_DA_NOVA
      return { id, nome, cor: CORES_DE_CONDICAO[0].valor, simbolo: DESENHO_DA_NOVA, pecas: [] }
    }
  }
}

/** A condição com outra identidade: as chaves que a identidade não traz saem (o símbolo digitado apagado, a negativa). */
function comIdentidade(condicao: CondicaoPropria, identidade: IdentidadeDaCondicao): CondicaoPropria {
  const { nome: _nome, cor: _cor, simbolo: _simbolo, texto: _texto, tipo: _tipo, desenho: _desenho, ...resto } = condicao
  return { ...resto, ...identidade }
}

/** O "Ctrl+Z" dentro de um campo de texto é o do próprio campo. */
function digitando(alvo: EventTarget): boolean {
  if (!(alvo instanceof HTMLElement)) return false
  if (alvo.isContentEditable || alvo instanceof HTMLTextAreaElement) return true
  return alvo instanceof HTMLInputElement && !['radio', 'checkbox', 'button', 'submit', 'range', 'color'].includes(alvo.type)
}

function quantos(n: number, um: string, varios: string): string {
  return n === 1 ? `1 ${um}` : `${n} ${varios}`
}

function Secao({ id, titulo, sub, brilho, children }: { id: string; titulo: string; sub?: string; brilho: number; children: ReactNode }) {
  return (
    <section className="lb-cde-secao" id={id} aria-labelledby={`${id}-tit`}>
      <div className="lb-cde-secao__cab">
        <h3 className="lb-cde-secao__tit" id={`${id}-tit`}>
          {titulo}
        </h3>
        {sub !== undefined && <p className="lb-cde-secao__sub">{sub}</p>}
      </div>
      {children}
      {brilho > 0 && <div key={brilho} className="lb-ed__brilho" aria-hidden="true" />}
    </section>
  )
}

/** A moldura da peça (o fio da cor, o medalhão, o nome, a frase, subir, descer e tirar), com o ícone da condição. */
function MolduraDaPeca({ familia, id, nova, brilho, onSubir, onDescer, onTirar, children }: { familia: FamiliaDaPecaDaCondicao; id: string; nova: boolean; brilho: number; onSubir?: () => void; onDescer?: () => void; onTirar: () => void; children: ReactNode }) {
  const entrada = REGISTRO_DAS_PECAS_DA_CONDICAO[familia]
  const tituloId = `${id}-tit`
  const pintar = useVariavelCss('--cor-peca', entrada.cor)
  const botao = (rotulo: string, icone: string, onClick: (() => void) | undefined) => (
    <button type="button" className="lb-ed__bt lb-ed__bt--fantasma lb-ed__bt--p lb-ed__bt--ic" aria-label={rotulo} title={rotulo} disabled={onClick === undefined} onClick={onClick}>
      <GlifoDaCondicao nome={icone} />
    </button>
  )
  return (
    <section ref={pintar} className="lb-pc lb-cde-peca" id={id} data-nova={nova ? '' : undefined} aria-labelledby={tituloId}>
      <div className="lb-pc__cab">
        <span className="lb-pc__med" aria-hidden="true">
          <GlifoDaCondicao nome={entrada.icone} />
        </span>
        <div className="lb-pc__nomes">
          <h4 className="lb-pc__tit" id={tituloId}>
            {entrada.nome}
            {entrada.novo && <span className="lb-cde-novo">novo</span>}
          </h4>
          <p className="lb-pc__faz">{entrada.faz}</p>
        </div>
        <div className="lb-pc__acoes">
          {botao(`Subir ${entrada.nome}`, 'cima', onSubir)}
          {botao(`Descer ${entrada.nome}`, 'baixo', onDescer)}
          {botao(`Tirar ${entrada.nome} (dá para desfazer)`, 'x', onTirar)}
        </div>
      </div>
      <div className="lb-pc__corpo">{children}</div>
      {brilho > 0 && <div key={brilho} className="lb-ed__brilho" aria-hidden="true" />}
    </section>
  )
}

function PorPeca({ cheia, onPor }: { cheia: boolean; onPor: (familia: FamiliaDaPecaDaCondicao) => void }) {
  return (
    <div className="lb-cde-por">
      <p className="lb-cde-rot">{cheia ? `Pôr peça: a condição já tem ${PECAS_DA_CONDICAO_MAX}, o máximo` : 'Pôr peça'}</p>
      <div className="lb-cde-tipos">
        {FAMILIAS_DA_CONDICAO.map((familia) => {
          const entrada = REGISTRO_DAS_PECAS_DA_CONDICAO[familia]
          return (
            <button key={familia} type="button" className="lb-cde-tipo" data-familia={familia} disabled={cheia} onClick={() => onPor(familia)}>
              <span className="lb-pc__med lb-pc__med--p" aria-hidden="true">
                <GlifoDaCondicao nome={entrada.icone} />
              </span>
              <b>
                {entrada.nome}
                {entrada.novo && <span className="lb-cde-novo">novo</span>}
              </b>
              <small>{entrada.faz}</small>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** As fontes dos usos e do renomear: as fichas (as dadas, senão as do livro aberto), o catálogo do livro e as criadas. */
function fontesDeAgora(personagens: readonly Personagem[] | undefined, criadas: readonly CondicaoPropria[]): FontesDosUsos {
  return { personagens: personagens ?? useMundoDoLivroStore.getState().daPasta ?? [], catalogo: useCatalogoStore.getState().itens, criadas }
}

/** Grava a renomeação nos três lugares; devolve o Desfazer. As fichas só com o livro aberto (o funil das fichas é o do mundo). */
async function gravarRenomeacao(original: CondicaoPropria, final: CondicaoPropria, feita: RenomeacaoDaCondicao, fontes: FontesDosUsos): Promise<(() => void) | null> {
  const criadasAntes = fontes.criadas ?? []
  const criadasMudadas = feita.criadas.filter((criada, indice) => criada !== criadasAntes[indice] && criada.id !== final.id)
  const store = useCondicoesPropriasStore.getState()
  if (!store.salvarVarias([final, ...criadasMudadas])) return null
  const itensAntes = fontes.catalogo ?? []
  const itensMudados = feita.catalogo.filter((item, indice) => item !== itensAntes[indice])
  for (const item of itensMudados) await useCatalogoStore.getState().salvarEntrada(item)
  const fichasAntes = new Map((fontes.personagens ?? []).map((personagem) => [personagem.id, personagem]))
  const fichasMudadas = new Set(feita.personagens.filter((personagem) => fichasAntes.get(personagem.id) !== personagem).map((personagem) => personagem.id))
  const comLivro = useMundoDoLivroStore.getState().aberto !== null && fichasMudadas.size > 0
  if (comLivro) await gravarNoMundo((lista) => renomearCondicao(original, final.nome, { ...fontes, personagens: lista }).personagens.slice())
  return () => {
    useCondicoesPropriasStore.getState().salvarVarias([original, ...criadasAntes.filter((criada) => criadasMudadas.some((mudada) => mudada.id === criada.id))])
    const voltam = itensAntes.filter((item) => itensMudados.some((mudado) => mudado.id === item.id))
    void voltam.reduce<Promise<void>>((fila, item) => fila.then(() => useCatalogoStore.getState().salvarEntrada(item)), Promise.resolve())
    if (comLivro) void gravarNoMundo((lista) => lista.map((personagem) => (fichasMudadas.has(personagem.id) ? (fichasAntes.get(personagem.id) ?? personagem) : personagem)))
  }
}

export function EditorDaCondicao({ abertura, onFechar, onSalvou, onApagar, personagens, motor, nota }: EditorDaCondicaoProps) {
  const janela = useRef<HTMLDialogElement>(null)
  const tituloId = useId()
  const prefixo = useId().replace(/:/g, '')
  const criadas = useCondicoesPropriasStore((state) => state.catalogo)
  const catalogo = useMemo(() => catalogoDeCondicoes(criadas), [criadas])
  const comSombreadas = useMemo(() => catalogoDeCondicoes(criadas, { comSombreadas: true }), [criadas])
  const [rascunho, setRascunho] = useState<CondicaoPropria>(() => rascunhoInicial(abertura, catalogo))
  // Como o rascunho abriu: o Fechar da nova só pergunta se algo mudou desde aqui.
  const [inicial] = useState(rascunho)
  const [salvo, setSalvo] = useState<CondicaoPropria | null>(abertura.tipo === 'editar' ? abertura.condicao : null)
  const [comecouDe, setComecouDe] = useState(abertura.tipo === 'modelo' ? abertura.base.id : '')
  const [pilha, setPilha] = useState<readonly CondicaoPropria[]>([])
  const ultimoPasso = useRef<{ campo: string; quando: number }>({ campo: '', quando: 0 })
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [brilho, setBrilho] = useState<{ alvo: string; vez: number } | null>(null)
  const [pecaNova, setPecaNova] = useState<number | null>(null)
  const [renomear, setRenomear] = useState<{ feita: RenomeacaoDaCondicao; final: CondicaoPropria; fontes: FontesDosUsos } | null>(null)
  const [fechando, setFechando] = useState(false)
  const nova = salvo === null

  const montada = useMemo(() => montarCondicao(rascunho), [rascunho])
  // O cartão, o boneco e os usos seguem um passo atrás da digitação: a tecla não espera por eles.
  const montadaAdiada = useDeferredValue(montada)
  const contexto = useMemo<ContextoDasFrases>(() => ({ todas: [...catalogo.filter((condicao) => condicao.id !== rascunho.id).map((condicao) => condicao.montada), montadaAdiada] }), [catalogo, rascunho.id, montadaAdiada])
  const pastilha = simboloDaCondicaoPropria(rascunho)
  const avisos = useMemo(() => avisosDe(montada, contexto), [montada, contexto])
  const problema = avisos.find((item) => item.impedeSalvar)?.texto ?? null
  const sujo = !mesmaCondicao(rascunho, salvo)
  const fontes = useMemo(() => fontesDeAgora(personagens, criadas), [personagens, criadas])
  const usos = useMemo(() => (salvo === null ? [] : usosDaCondicao(salvo, fontes)), [salvo, fontes])
  const citadaPor = useMemo(() => quemCita(montadaAdiada, contexto).filter((citacao) => ehDaFabrica(citacao.condicao.id)), [montadaAdiada, contexto])
  const pastilhaDe = useCallback((id: string) => {
    const achada = catalogo.find((condicao) => condicao.id === id)
    return achada === undefined ? null : simboloDoCatalogo(achada)
  }, [catalogo])

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
    if (aviso === null) return
    const relogio = window.setTimeout(() => setAviso(aviso.saindo ? null : { ...aviso, saindo: true }), aviso.saindo ? SAIDA_DO_AVISO_MS : AVISO_MS)
    return () => window.clearTimeout(relogio)
  }, [aviso])

  const avisar = (texto: string, desfazer?: () => void) => setAviso({ texto, ...(desfazer === undefined ? {} : { desfazer }), saindo: false, vez: performance.now() })

  /** Troca o rascunho e guarda o passo de antes no Ctrl+Z; o mesmo `campo` em sequência rápida vira um passo só. */
  const mudar = (proximo: CondicaoPropria, campo: string | null) => {
    const agora = performance.now()
    const junta = campo !== null && ultimoPasso.current.campo === campo && agora - ultimoPasso.current.quando < JUNTAR_MS
    if (!junta) setPilha((antes) => [...antes.slice(-(PILHA_MAX - 1)), rascunho])
    ultimoPasso.current = { campo: campo ?? '', quando: agora }
    setFechando(false)
    setRascunho(proximo)
  }

  const desfazer = () => {
    const anterior = pilha[pilha.length - 1]
    if (anterior === undefined) {
      avisar('Nada para desfazer.')
      return
    }
    setPilha(pilha.slice(0, -1))
    ultimoPasso.current = { campo: '', quando: 0 }
    setRascunho(anterior)
    avisar('Desfeito.')
  }

  const pecas = montada.pecas
  const comPecas = (lista: readonly PecaDaCondicao[]) => ({ ...rascunho, pecas: [...lista] })
  const mudarPeca = (indice: number, peca: PecaDaCondicao) => mudar(comPecas(pecas.map((atual, i) => (i === indice ? peca : atual))), `peca-${indice}`)
  const moverPeca = (indice: number, passo: -1 | 1) => {
    const lista = [...pecas]
    const [saiu] = lista.splice(indice, 1)
    if (saiu === undefined) return
    lista.splice(indice + passo, 0, saiu)
    setPecaNova(null)
    mudar(comPecas(lista), null)
  }
  const tirarPeca = (indice: number) => {
    const antes = rascunho
    mudar(comPecas(pecas.filter((_, i) => i !== indice)), null)
    setPecaNova(null)
    const nome = REGISTRO_DAS_PECAS_DA_CONDICAO[pecas[indice]?.tipo ?? 'vez'].nome
    avisar(`${nome} saiu.`, () => setRascunho(antes))
  }
  const porPeca = (familia: FamiliaDaPecaDaCondicao) => {
    if (pecas.length >= PECAS_DA_CONDICAO_MAX) return
    mudar(comPecas([...pecas, entradaDaPecaDaCondicao(familia).nova()]), null)
    setPecaNova(pecas.length)
    window.requestAnimationFrame(() => document.getElementById(`${prefixo}-peca-${pecas.length}`)?.scrollIntoView({ block: 'nearest' }))
  }

  const comecarDe = (base: CondicaoDoCatalogo | null) => {
    setComecouDe(base === null ? '' : base.id)
    const { tipo: _tipo, pecas: _pecas, prazo: _prazo, saidas: _saidas, ...resto } = rascunho
    mudar(base === null ? { ...resto, pecas: [] } : { ...resto, ...regraDaBase(base) }, null)
    if (base !== null) avisar(`As peças, o prazo e as saídas de ${base.nome} entraram. O nome continua o seu.`)
  }

  /** O cartão leva à seção: rola até ela, acende o brilho e põe o foco no primeiro controle. */
  const irPara = (alvo: AlvoDoPapel, porTeclado: boolean) => {
    const id = alvo.tipo === 'peca' ? `${prefixo}-peca-${alvo.indice}` : `${prefixo}-sec-${alvo.secao}`
    const elemento = document.getElementById(id)
    if (elemento === null) return
    const reduzido = porTeclado || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    elemento.scrollIntoView({ block: 'start', behavior: reduzido ? 'auto' : 'smooth' })
    setBrilho((antes) => ({ alvo: id, vez: (antes?.vez ?? 0) + 1 }))
    const primeiro = elemento.querySelector('input:not(:disabled), select:not(:disabled), button:not(:disabled)')
    if (primeiro instanceof HTMLElement) primeiro.focus({ preventScroll: true })
  }
  const brilhoDe = (id: string) => (brilho !== null && brilho.alvo === id ? brilho.vez : 0)

  /** Grava a condição (e só ela) e conta. A editada vai também aos tokens de todas as cenas, como antes. */
  const gravar = (final: CondicaoPropria): boolean => {
    if (!useCondicoesPropriasStore.getState().salvar(final)) {
      avisar('Não deu para salvar: a lista de condições está cheia, ou algum campo não passou na leitura.')
      return false
    }
    return true
  }

  const depoisDeSalvar = (final: CondicaoPropria, texto: string, desfazer?: () => void) => {
    const eraNova = nova
    if (!eraNova) trocarCondicaoEmTodasAsCenas(final)
    setSalvo(final)
    setRascunho(final)
    setRenomear(null)
    avisar(texto, desfazer)
    onSalvou?.(final, eraNova)
  }

  const salvar = () => {
    if (problema !== null) {
      avisar(`Ainda não salva: ${problema}`)
      return
    }
    const final = lerCondicaoPropria(paraGravar(rascunho))
    if (final === null) {
      avisar('Não deu para salvar: confira o nome e a pastilha.')
      return
    }
    if (salvo !== null && chaveDaCondicao(salvo.nome) !== chaveDaCondicao(final.nome)) {
      const agora = fontesDeAgora(personagens, criadas)
      const feita = renomearCondicao(salvo, final.nome, agora)
      if (feita.motivo === 'renomeou' && feita.trocados.length > 0) {
        setRenomear({ feita, final, fontes: agora })
        return
      }
    }
    if (gravar(final)) depoisDeSalvar(final, `"${final.nome}" salva no catálogo. Já dá para pôr na ficha, nas habilidades e nos itens.`)
  }

  const renomearTambem = async () => {
    if (renomear === null || salvo === null) return
    const antes = salvo
    const desfazerTudo = await gravarRenomeacao(antes, renomear.final, renomear.feita, renomear.fontes)
    if (desfazerTudo === null) {
      avisar('Não deu para renomear: alguma condição não passou na leitura, ou a lista está cheia.')
      return
    }
    const n = renomear.feita.trocados.length
    depoisDeSalvar(renomear.final, `"${renomear.final.nome}" salva e renomeada em ${quantos(n, 'lugar', 'lugares')}.`, () => {
      desfazerTudo()
      setSalvo(antes)
      avisar('Renomear desfeito: o nome de antes voltou em todos os lugares.')
    })
  }

  const fechar = () => {
    // A nova (ou a cópia do modelo) que ninguém mexeu não perde nada ao fechar: fecha de uma vez.
    const perdeAlgo = salvo === null ? !mesmaCondicao(rascunho, inicial) : sujo
    if (perdeAlgo && !fechando) {
      setFechando(true)
      avisar('Há mudanças não salvas. Fechar de novo descarta.')
      return
    }
    onFechar()
  }

  const aoTeclar = (evento: KeyboardEvent<HTMLDialogElement>) => {
    // As teclas do editor não sobem para o menu ou o painel atrás dele.
    evento.stopPropagation()
    const comCtrl = (evento.ctrlKey || evento.metaKey) && !evento.shiftKey && !evento.altKey
    if (comCtrl && evento.key.toLowerCase() === 's') {
      evento.preventDefault()
      salvar()
      return
    }
    if (!comCtrl || evento.key.toLowerCase() !== 'z' || digitando(evento.target)) return
    evento.preventDefault()
    desfazer()
  }

  const nome = rascunho.nome.trim() || 'Sem nome'
  const identidade: IdentidadeDaCondicao = {
    nome: rascunho.nome,
    cor: rascunho.cor,
    simbolo: rascunho.simbolo,
    ...(rascunho.texto === undefined ? {} : { texto: rascunho.texto }),
    ...(rascunho.tipo === undefined ? {} : { tipo: rascunho.tipo }),
    ...(rascunho.desenho === undefined ? {} : { desenho: rascunho.desenho }),
  }
  const comEla = (fontes.personagens ?? []).filter((personagem) => (personagem.condicoes ?? []).some((posta) => posta.condId === rascunho.id)).length
  const emUso = usos.length + comEla
  const secao = (nomeDaSecao: string) => `${prefixo}-sec-${nomeDaSecao}`

  return createPortal(
    <dialog
      ref={janela}
      className="lb-ed lb-cde"
      // O papel explícito: as janelas do app reconhecem uma camada por cima pelo [role="dialog"].
      role="dialog"
      aria-labelledby={tituloId}
      onKeyDown={aoTeclar}
      onCancel={(evento) => {
        evento.preventDefault()
        fechar()
      }}
    >
      <header className="lb-ed__cab">
        <h2 className="lb-ed__tit lb-cde-tit" id={tituloId}>
          <PastilhaDeCondicao symbol={pastilha} tamanho={30} />
          <span>{nome}</span>
        </h2>
        <span className="lb-ed__trilha">{nova ? 'Condição nova. ' : ''}A regra mora aqui; quem põe a condição só escolhe qual e por quantos turnos.</span>
        <div className="lb-ed__cab-acoes">
          <span className="lb-cde-estado" data-sujo={sujo ? '' : undefined}>
            <i aria-hidden="true" />
            {sujo ? 'Mudanças não salvas' : 'Salvo'}
          </span>
          {onApagar !== undefined && salvo !== null && (
            <button
              type="button"
              className="lb-ed__bt lb-ed__bt--fantasma"
              disabled={emUso > 0}
              title={emUso > 0 ? `Está em uso (${quantos(emUso, 'lugar', 'lugares')}): tire de lá antes.` : 'Tira do catálogo e das fichas do mapa'}
              onClick={() => onApagar(salvo)}
            >
              Apagar
            </button>
          )}
          <button type="button" className="lb-ed__bt lb-ed__bt--fantasma" disabled={pilha.length === 0} aria-keyshortcuts="Control+Z" onClick={desfazer}>
            Desfazer <kbd className="lb-ed__kbd">Ctrl Z</kbd>
          </button>
          <button type="button" className="lb-ed__bt lb-ed__bt--fantasma" onClick={fechar}>
            {fechando ? 'Descartar e fechar' : 'Fechar'}
          </button>
          <button type="button" className="lb-ed__bt lb-ed__bt--primario" aria-keyshortcuts="Control+S" aria-disabled={problema !== null} title={problema === null ? 'Ctrl+S' : `Ainda não salva: ${problema}`} onClick={salvar}>
            Salvar no catálogo <kbd className="lb-ed__kbd">Ctrl S</kbd>
          </button>
        </div>
      </header>

      {renomear !== null && (
        <div className="lb-cde-renomear" role="alertdialog" aria-label="Renomear nos outros lugares">
          <p>
            "{salvo?.nome}" aparece com o nome de antes em {quantos(renomear.feita.trocados.length, 'lugar', 'lugares')}. Com o nome novo, eles deixam de achá-la, a não ser que mudem também.
          </p>
          <ul className="lb-cde-etiquetas">
            {renomear.feita.trocados.map((uso, indice) => (
              <li key={indice} className="lb-cde-etiqueta">
                {uso.lugar.tipo === 'condicao' ? uso.lugar.condicaoNome : uso.lugar.tipo === 'catalogo' ? uso.lugar.itemNome : uso.lugar.personagemNome}
              </li>
            ))}
          </ul>
          <div className="lb-ed__linha-acoes">
            <button type="button" className="lb-ed__bt lb-ed__bt--primario lb-ed__bt--p" onClick={() => void renomearTambem()}>
              Renomear também nos {renomear.feita.trocados.length} lugares
            </button>
            <button
              type="button"
              className="lb-ed__bt lb-ed__bt--fantasma lb-ed__bt--p"
              onClick={() => {
                if (gravar(renomear.final)) depoisDeSalvar(renomear.final, `"${renomear.final.nome}" salva. Os outros lugares ficaram com o nome de antes.`)
              }}
            >
              Só aqui
            </button>
            <button type="button" className="lb-ed__bt lb-ed__bt--fantasma lb-ed__bt--p" onClick={() => setRenomear(null)}>
              Voltar ao editor
            </button>
          </div>
        </div>
      )}

      <div className="lb-ed__corpo">
        <div className="lb-ed__editor lb-cde-form">
          {rascunho.confira !== undefined && (
            <p className="lb-ed__alerta" role="note">
              Confira: {rascunho.confira}
            </p>
          )}
          {nova && abertura.tipo !== 'rascunho' && (
            <Secao id={secao('comecar')} titulo="Começar de" sub="Opcional: copia as peças, o prazo e as saídas de uma pronta. O nome continua o seu." brilho={0}>
              <ComecarDe opcoes={comSombreadas} valor={comecouDe} aoEscolher={comecarDe} />
            </Secao>
          )}
          <Secao id={secao('identidade')} titulo="Nome e pastilha" sub="A pastilha é o que o mapa, a ficha e a batalha desenham." brilho={brilhoDe(secao('identidade'))}>
            <NomeEPastilha id={rascunho.id} identidade={identidade} aoMudar={(ident) => mudar(comIdentidade(rascunho, ident), 'identidade')} contexto={contexto} focarNome={abertura.tipo !== 'editar'} />
          </Secao>
          <Secao id={secao('pecas')} titulo="O que ela faz" sub="As mesmas peças do editor de habilidades. Cada uma se lê como uma frase; o cartão à direita junta as frases." brilho={brilhoDe(secao('pecas'))}>
            {pecas.length === 0 ? (
              <p className="lb-ed__vazio">Sem peça, o cartão diz "o mestre narra" e a batalha não aplica nada. Ponha a primeira abaixo.</p>
            ) : (
              <div className="lb-cde-pecas">
                {pecas.map((peca, indice) => {
                  const entrada = entradaDaPecaDaCondicao(peca.tipo)
                  const id = `${prefixo}-peca-${indice}`
                  return (
                    <MolduraDaPeca
                      key={`${indice}-${peca.tipo}`}
                      familia={peca.tipo}
                      id={id}
                      nova={pecaNova === indice}
                      brilho={brilhoDe(id)}
                      onSubir={indice === 0 ? undefined : () => moverPeca(indice, -1)}
                      onDescer={indice === pecas.length - 1 ? undefined : () => moverPeca(indice, 1)}
                      onTirar={() => tirarPeca(indice)}
                    >
                      <entrada.Componente peca={peca} condicao={montada} aoMudar={(mudada: PecaDaCondicao) => mudarPeca(indice, mudada)} contexto={contexto} pastilhaDe={pastilhaDe} />
                    </MolduraDaPeca>
                  )
                })}
              </div>
            )}
            <PorPeca cheia={pecas.length >= PECAS_DA_CONDICAO_MAX} onPor={porPeca} />
          </Secao>
          <Secao id={secao('prazo')} titulo="Prazo, pilhas e saída" sub="Toda condição tem prazo e jeito de sair. Quem põe (a habilidade, o item, o mestre) pode trocar só os turnos." brilho={brilhoDe(secao('prazo'))}>
            <PrazoESaida
              condicao={montada}
              aoMudarPrazo={(prazo) => mudar({ ...rascunho, prazo }, 'prazo')}
              aoMudarSaidas={(saidas) => mudar({ ...rascunho, saidas }, 'saidas')}
              contexto={contexto}
              pastilhaDe={pastilhaDe}
            />
          </Secao>
          <Secao id={secao('onde')} titulo="Onde ela aparece" sub="O que você salva aqui já pode ser usado em todos estes lugares." brilho={0}>
            <OndeAparece tipo={montada.tipo} usos={usos} citadaPor={citadaPor} nomeDaCondicao={nomeDaCondicaoPosta(criadas)} />
            {nota !== undefined && <p className="lb-cde-nota">{nota}</p>}
          </Secao>
        </div>

        <aside className="lb-ed__ver lb-cde-ver" aria-label="Cartão e teste">
          <p className="lb-cde-ver__rot">
            <span>Como fica no cartão</span>
            <span>clique numa linha para ir até ela</span>
          </p>
          <PapelDaCondicao condicao={montadaAdiada} pastilha={pastilha} contexto={contexto} deFabrica={false} aoIr={irPara} />
          <BonecoDaCondicao condicao={montadaAdiada} pastilha={pastilha} contexto={contexto} motor={motor} onde={`${prefixo}-ed`} />
        </aside>
      </div>

      <div className="lb-ed__avisos" role="status" aria-live="polite">
        {aviso !== null && (
          <div key={aviso.vez} className="lb-ed__aviso" data-saindo={aviso.saindo ? '' : undefined}>
            <span>{aviso.texto}</span>
            {aviso.desfazer !== undefined && (
              <button
                type="button"
                className="lb-ed__bt lb-ed__bt--latao lb-ed__bt--p"
                onClick={() => {
                  aviso.desfazer?.()
                  setAviso(null)
                }}
              >
                Desfazer
              </button>
            )}
          </div>
        )}
      </div>
    </dialog>,
    document.body,
  )
}

/**
 * Abre o editor fora da árvore de quem chamou (o menu do token fecha ao clicar fora, e levaria o editor junto):
 * uma raiz própria no `body`, desmontada ao fechar.
 */
export function abrirEditorDaCondicao(props: Omit<EditorDaCondicaoProps, 'onFechar'> & { onFechar?: () => void }): void {
  const lugar = document.createElement('div')
  document.body.append(lugar)
  const raiz = createRoot(lugar)
  const fechar = () => {
    props.onFechar?.()
    // Fora do evento que pediu: desmontar a raiz no meio do próprio render dela é proibido.
    window.setTimeout(() => {
      raiz.unmount()
      lugar.remove()
    }, 0)
  }
  raiz.render(<EditorDaCondicao {...props} onFechar={fechar} />)
}
