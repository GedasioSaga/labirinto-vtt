import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent as EventoDeTecla } from 'react'
import { resolverAtalhoDeSom } from '../../lib/keymap'
import { MIDIA_AUDIO_MAX_BYTES } from '../../lib/midia'
import { AUDIO_GRANDE_DEMAIS } from '../../lib/midiaNoDisco'
import { ehAtalhoDeSom, EFEITOS_DE_SOM_MAX, NOME_DE_SOM_MAX, nomeDeSomLimpo, type AtalhoDeSom, type BibliotecaDeSons, type EfeitoDeSom, type MudancaNoEfeito } from '../../lib/sons/biblioteca'
import { arquivosDaMidiaDaAventura, obterMotorDoMestre, pesoDaMidiaComSons, type ArquivosDaMidia } from '../../lib/sons/aoVivo/carregadorDoMestre'
import { MAX_LOOPS, type MotivoDaRecusa, type MotorAoVivo } from '../../lib/sons/aoVivo/motor'
import { useAdventureStore } from '../../stores/adventureStore'
import { ligarBibliotecaAAventura, SONS_AINDA_LENDO, SONS_NAO_GRAVAVEIS, SONS_SEM_AVENTURA, useBibliotecaDeSonsStore } from '../../stores/bibliotecaDeSonsStore'
import { useToastStore, type ToastKind } from '../../stores/toastStore'
import { Botao } from '../grimorio/Botao'
import { CampoFaixa } from '../grimorio/CampoFaixa'
import { CampoLiga } from '../grimorio/CampoLiga'
import { CampoSel } from '../grimorio/CampoTexto'
import { Dialogo } from '../grimorio/Dialogo'
import { andarPelosRadios, classes, movimentoReduzido } from '../grimorio/comum'
import { TituloDaPagina } from './FolhaDoLivro'
import { IconeDoLivro } from './icones'
import './sons.css'

/*
 * PÁGINA SONS do livro da mesa (Sistema 4, sons ao vivo, fatia F3: só local).
 * Uma grade de botões grandes que tocam na hora, com Parar tudo fixo no alto,
 * pastas e favoritos em chips, atalhos 1 a 9 e o lápis de cada som. A folha
 * fica sempre montada (com e sem sala): é ela que liga a biblioteca à
 * aventura aberta e ouve os atalhos com qualquer página do livro à vista.
 * Quem escuta (seletor Todos / Cena / Escolhidos) e a rede são da F4.
 */

/** A pasta de mídia da aventura acima disto deixa levar e abrir a aventura lento (plano, seção 6). */
export const MIDIA_PESADA_BYTES = 200 * 1024 * 1024
/** O selo do atalho pulsa neste tempo, e só ele: o som nunca espera animação. */
export const PULSO_DO_SELO_MS = 150

const MB = 1024 * 1024
const ACEITA_AUDIO = 'audio/*,.mp3,.ogg,.wav,.m4a'
const SEM_PASTA = 'sem'
const NOVA_PASTA = 'nova'
const SEM_ATALHO = 'nenhum'

type Filtro = { tipo: 'todos' } | { tipo: 'favoritos' } | { tipo: 'pasta'; id: string }

/** Um som que está soando: a barra de progresso anda a partir daqui. */
interface Toque {
  /** Conta os toques: a barra recomeça a cada um (a chave do React muda). */
  vez: number
  loop: boolean
  duracaoS: number
  /** Segundos já passados quando o som começou (o deslocamento mais a espera). */
  jaTocouS: number
  /** `performance.now()` de quando a página soube do toque. */
  vistoEmMs: number
}

/** O menor peso que o pé mostra com número; abaixo disso, "menos de 0,1 MB" (um efeito curto não vira "0,0 MB"). */
const MENOR_PESO_COM_NUMERO = 0.1 * MB

function megas(bytes: number): string {
  if (bytes > 0 && bytes < MENOR_PESO_COM_NUMERO) return 'menos de 0,1 MB'
  return `${(bytes / MB).toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: bytes > 0 && bytes < 10 * MB ? 1 : 0 })} MB`
}

const FRASE_DA_RECUSA: Record<MotivoDaRecusa, { tipo: ToastKind; frase: (nome: string) => string }> = {
  'limite-de-loops': { tipo: 'info', frase: (nome) => `${nome} não tocou: já há ${MAX_LOOPS} sons repetindo. Pare um deles antes.` },
  'sem-gesto': { tipo: 'info', frase: (nome) => `${nome} não tocou: o áudio ainda não foi liberado. Clique em qualquer ponto da janela e toque de novo.` },
  atrasado: { tipo: 'info', frase: (nome) => `${nome} demorou para abrir e não tocou fora de hora. Toque de novo.` },
  'nao-carregou': { tipo: 'error', frase: (nome) => `${nome} não tocou: o arquivo não abriu neste computador.` },
  'fonte-invalida': { tipo: 'error', frase: (nome) => `${nome} não tocou: o arquivo dele não está guardado neste computador.` },
  'fonte-sem-suporte': { tipo: 'info', frase: (nome) => `${nome} ainda não toca por aqui.` },
}

/** "Não deu para importar x.wav: esse áudio passa de 15 MB." com a frase da store (minúscula) ou a frase pronta (maiúscula). */
function fraseDaRecusaDoArquivo(nomeDoArquivo: string, erro: unknown): string {
  const motivo = erro instanceof Error ? erro.message : String(erro)
  const ehFrasePronta = /^[A-ZÀ-Ú]/.test(motivo)
  return ehFrasePronta ? `Não deu para importar ${nomeDoArquivo}. ${motivo}` : `Não deu para importar ${nomeDoArquivo}: ${motivo}.`
}

function alvoEditavel(alvo: HTMLElement | null): boolean {
  if (alvo === null) return false
  // O jsdom não tem `isContentEditable`: o atributo herdado também conta.
  return alvo.isContentEditable === true || alvo.closest('[contenteditable]:not([contenteditable="false"])') !== null
}

/**
 * Teclas 1 a 9 de qualquer ponto do editor: o dígito sozinho, fora de campo
 * de texto, sem diálogo modal aberto e sem tecla segurada. `aoAtalho` devolve
 * se havia som naquela tecla (só então a tecla é consumida).
 */
export function useAtalhosDeSom(aoAtalho: (atalho: AtalhoDeSom) => boolean): void {
  const atual = useRef(aoAtalho)
  atual.current = aoAtalho
  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.defaultPrevented) return
      const alvo = evento.target instanceof HTMLElement ? evento.target : null
      const atalho = resolverAtalhoDeSom({
        key: evento.key,
        ctrlKey: evento.ctrlKey,
        metaKey: evento.metaKey,
        shiftKey: evento.shiftKey,
        altKey: evento.altKey,
        targetTagName: alvo?.tagName ?? '',
        targetInputType: alvo instanceof HTMLInputElement ? alvo.type : undefined,
        targetContentEditable: alvoEditavel(alvo),
        modalAberto: document.querySelector('[aria-modal="true"]') !== null,
        repeticao: evento.repeat,
      })
      if (atalho !== null && atual.current(atalho)) evento.preventDefault()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [])
}

/**
 * O motor do mestre é um só no app e vive mais que a página, e a página só
 * sabe o que soa pelos eventos dele. Por isso tudo para quando a página sai (o
 * editor desmonta ao voltar ao menu) e quando a aventura troca (outra
 * aventura, ou a mesma em outra pasta): senão a chuva seguiria no menu, ou na
 * outra aventura sem botão para pará-la, e a página remontada a mostraria
 * parada. A aventura nova que ganha a primeira pasta (Salvar) não é troca.
 */
function pararAoSairOuTrocarDeAventura(motor: MotorAoVivo): () => void {
  const desligar = useAdventureStore.subscribe((agora, antes) => {
    const outraAventura = (agora.adventure?.id ?? null) !== (antes.adventure?.id ?? null)
    const outraPasta = antes.dir !== null && agora.dir !== antes.dir
    if (outraAventura || outraPasta) motor.pararTudo()
  })
  return () => {
    desligar()
    motor.pararTudo()
  }
}

/** Os toques que estão soando, pelo id do efeito (a instância do motor é o próprio id). */
function useToquesDoMotor(motor: MotorAoVivo, nomeDe: (id: string) => string): ReadonlyMap<string, Toque> {
  const [toques, setToques] = useState<ReadonlyMap<string, Toque>>(() => new Map())
  const nome = useRef(nomeDe)
  nome.current = nomeDe
  useEffect(() => {
    let vez = 0
    const tirar = (id: string) =>
      setToques((antes) => {
        if (!antes.has(id)) return antes
        const depois = new Map(antes)
        depois.delete(id)
        return depois
      })
    return motor.assinar((evento) => {
      if (evento.tipo === 'tocando') {
        vez += 1
        const agora = performance.now()
        const toque: Toque = { vez, loop: evento.loop, duracaoS: evento.duracaoS, jaTocouS: evento.deslocamentoS + Math.max(0, agora - evento.inicioEmMs) / 1000, vistoEmMs: agora }
        setToques((antes) => new Map(antes).set(evento.instancia, toque))
      } else if (evento.tipo === 'terminou') {
        tirar(evento.instancia)
      } else if (evento.tipo === 'recusado') {
        tirar(evento.instancia)
        const { tipo, frase } = FRASE_DA_RECUSA[evento.motivo]
        // Com chave: dez recusas seguidas são um aviso só, trocado no lugar.
        useToastStore.getState().push(tipo, frase(nome.current(evento.instancia)), undefined, { chave: `sons:${evento.motivo}` })
      }
    })
  }, [motor])
  return toques
}

/**
 * O pulso do selo (só ele anima), resposta ao CLIQUE: sobe rápido e assenta.
 * A tecla não pulsa (ação de teclado não anima; o selo aceso já diz qual tocou),
 * e com movimento reduzido nada se mexe.
 */
function pulsar(selo: HTMLElement | undefined): void {
  if (selo === undefined || movimentoReduzido() || typeof selo.animate !== 'function') return
  selo.animate(
    [
      { transform: 'scale(1)', easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
      { transform: 'scale(1.12)', offset: 0.4, easing: 'cubic-bezier(0.77, 0, 0.175, 1)' },
      { transform: 'scale(1)' },
    ],
    { duration: PULSO_DO_SELO_MS },
  )
}

export interface PaginaSonsProps {
  /** Quem toca; o padrão é o motor do mestre (bytes do disco). O teste passa um com o áudio de mentira. */
  motor?: MotorAoVivo
  /** Quanto pesa a pasta de mídia da aventura; o padrão lê o disco. */
  medirMidia?: (pastaDaAventura: string) => Promise<ArquivosDaMidia>
}

export function PaginaSons({ motor: motorDado, medirMidia = arquivosDaMidiaDaAventura }: PaginaSonsProps) {
  const [motor] = useState(() => motorDado ?? obterMotorDoMestre())
  const biblioteca = useBibliotecaDeSonsStore((estado) => estado.biblioteca)
  const aventuraId = useBibliotecaDeSonsStore((estado) => estado.aventuraId)
  const dir = useBibliotecaDeSonsStore((estado) => estado.dir)
  const carregando = useBibliotecaDeSonsStore((estado) => estado.carregando)
  const pendente = useBibliotecaDeSonsStore((estado) => estado.pendente)
  const aviso = useBibliotecaDeSonsStore((estado) => estado.aviso)
  const podeGravar = useBibliotecaDeSonsStore((estado) => estado.podeGravar)
  const [filtro, setFiltro] = useState<Filtro>({ tipo: 'todos' })
  const [editando, setEditando] = useState<string | null>(null)
  const [importando, setImportando] = useState<string | null>(null)
  const [recusas, setRecusas] = useState<string[]>([])
  const [entrou, setEntrou] = useState<string | null>(null)
  const [arquivosDaMidia, setArquivosDaMidia] = useState<ArquivosDaMidia | null>(null)
  const arquivo = useRef<HTMLInputElement>(null)
  const selos = useRef(new Map<string, HTMLElement>())

  useEffect(() => ligarBibliotecaAAventura(), [])
  useEffect(() => pararAoSairOuTrocarDeAventura(motor), [motor])

  const toques = useToquesDoMotor(motor, (id) => useBibliotecaDeSonsStore.getState().biblioteca.efeitos.find((efeito) => efeito.id === id)?.nome ?? 'O som')
  const toquesAgora = useRef(toques)
  toquesAgora.current = toques

  /** Toca (ou para o loop que já toca). `peloClique`: só o clique pulsa o selo. */
  const tocar = (efeito: EfeitoDeSom, peloClique: boolean) => {
    // Loop tocando: o mesmo botão (ou tecla) para, com o fade do motor. Efeito curto recomeça.
    if (efeito.loop && toquesAgora.current.has(efeito.id)) {
      motor.parar(efeito.id)
      return
    }
    motor.tocar(efeito.id, efeito.fonte, { loop: efeito.loop, volumeDoEfeito: efeito.volume })
    if (peloClique) pulsar(selos.current.get(efeito.id))
  }

  useAtalhosDeSom((atalho) => {
    const efeito = useBibliotecaDeSonsStore.getState().biblioteca.efeitos.find((candidato) => candidato.atalho === atalho)
    if (efeito === undefined) return false
    tocar(efeito, false)
    return true
  })

  // A pasta de mídia: relida quando a pasta muda e a cada gravação. O áudio que
  // ainda está a caminho dela entra no peso pela biblioteca (pesoDaMidiaComSons).
  useEffect(() => {
    if (dir === null || carregando || pendente) return
    let valendo = true
    medirMidia(dir).then(
      (arquivos) => {
        if (valendo) setArquivosDaMidia(arquivos)
      },
      () => undefined,
    )
    return () => {
      valendo = false
    }
  }, [dir, carregando, pendente, medirMidia])
  const midiaBytes = arquivosDaMidia === null ? null : pesoDaMidiaComSons(arquivosDaMidia, biblioteca)

  // A pasta escolhida sumiu, ou o último favorito saiu: volta para Todos.
  const favoritos = biblioteca.efeitos.filter((efeito) => efeito.favorito === true).length
  const filtroValido = filtro.tipo === 'todos' || (filtro.tipo === 'favoritos' ? favoritos > 0 : biblioteca.pastas.some((pasta) => pasta.id === filtro.id))
  const filtroAgora: Filtro = filtroValido ? filtro : { tipo: 'todos' }
  const visiveis = useMemo(() => efeitosDoFiltro(biblioteca, filtroAgora), [biblioteca, filtroAgora])

  const semAventura = aventuraId === null
  const cheia = biblioteca.efeitos.length >= EFEITOS_DE_SOM_MAX
  const podeImportar = !semAventura && !carregando && podeGravar && !cheia && importando === null
  const motivoSemImportar = semAventura ? SONS_SEM_AVENTURA : carregando ? 'Lendo os sons da aventura…' : cheia ? `A biblioteca chegou a ${EFEITOS_DE_SOM_MAX} sons. Apague algum para importar outro.` : null

  const importar = async (arquivos: File[]) => {
    const falhas: string[] = []
    let ultimo: string | null = null
    setRecusas([])
    setEntrou(null)
    for (const escolhido of arquivos) {
      setImportando(escolhido.name)
      // O teto antes de ler: um arquivo enorme nem entra na memória.
      if (escolhido.size > MIDIA_AUDIO_MAX_BYTES) {
        falhas.push(fraseDaRecusaDoArquivo(escolhido.name, new Error(AUDIO_GRANDE_DEMAIS)))
        continue
      }
      try {
        const efeito = await useBibliotecaDeSonsStore.getState().importarArquivoDeSom(escolhido.name, new Uint8Array(await escolhido.arrayBuffer()))
        ultimo = efeito.nome
      } catch (erro) {
        falhas.push(fraseDaRecusaDoArquivo(escolhido.name, erro))
      }
    }
    setImportando(null)
    setRecusas(falhas)
    if (ultimo !== null) setEntrou(arquivos.length - falhas.length > 1 ? `${arquivos.length - falhas.length} sons entraram na biblioteca.` : `${ultimo} entrou na biblioteca.`)
  }

  const escolherArquivos = (evento: ChangeEvent<HTMLInputElement>) => {
    const escolhidos = Array.from(evento.currentTarget.files ?? [])
    // Limpa: escolher o MESMO arquivo de novo (depois de uma recusa) volta a disparar.
    evento.currentTarget.value = ''
    if (escolhidos.length > 0) void importar(escolhidos)
  }

  const efeitoEditado = editando === null ? undefined : biblioteca.efeitos.find((efeito) => efeito.id === editando)

  return (
    <div className="lb-sons" role="region" aria-label="Sons">
      <TituloDaPagina titulo="Sons" sub="Efeitos e ambientes da aventura" />
      <div className="lb-sons__topo">
        <div className="lb-sons__linha">
          <Botao tamanho="p" className="lb-sons__parar" disabled={toques.size === 0} onClick={() => motor.pararTudo()}>
            <IconeParar />
            Parar tudo
          </Botao>
          <Botao tamanho="p" variante="latao" className="gr-empurra" disabled={!podeImportar} onClick={() => arquivo.current?.click()}>
            <IconeDoLivro nome="mais" />
            Importar
          </Botao>
        </div>
        {/* Linha própria: em 262 px os dois botões e o texto não cabem lado a lado sem cortar. */}
        <p className="lb-sons__soando" aria-live="polite">
          {toques.size === 0 ? 'Nada tocando' : toques.size === 1 ? '1 tocando' : `${toques.size} tocando`}
        </p>
        {semAventura && <p className="lb-sons__nota lb-sons__nota--latao">{SONS_SEM_AVENTURA}</p>}
        {!semAventura && dir === null && <p className="lb-sons__nota">Os sons ficam guardados quando a aventura for salva.</p>}
        {importando !== null && (
          <p className="lb-sons__nota" role="status">
            Importando {importando}…
          </p>
        )}
        {entrou !== null && importando === null && (
          <p className="lb-sons__nota" role="status">
            {entrou}
          </p>
        )}
        {recusas.length > 0 && (
          <div className="lb-sons__nota lb-sons__nota--erro" role="alert">
            {recusas.map((recusa) => (
              <p key={recusa}>{recusa}</p>
            ))}
          </div>
        )}
        {aviso !== null && (
          <p className="lb-sons__nota lb-sons__nota--erro" role="alert">
            {aviso}
          </p>
        )}
      </div>
      <input ref={arquivo} type="file" accept={ACEITA_AUDIO} multiple hidden aria-label="Arquivo de som" onChange={escolherArquivos} />

      {(biblioteca.pastas.length > 0 || favoritos > 0) && <ChipsDasPastas biblioteca={biblioteca} favoritos={favoritos} filtro={filtroAgora} onFiltro={setFiltro} />}

      {carregando ? (
        <p className="lb-sons__mensagem">Lendo os sons da aventura…</p>
      ) : biblioteca.efeitos.length === 0 ? (
        <VazioDosSons motivo={motivoSemImportar} podeImportar={podeImportar} onImportar={() => arquivo.current?.click()} />
      ) : visiveis.length === 0 ? (
        <p className="lb-sons__mensagem">Nenhum som nesta pasta. Mova um som para cá pelo lápis dele, no campo Pasta.</p>
      ) : (
        <ul className="lb-sons__grade" aria-label="Botões de som">
          {visiveis.map((efeito) => (
            <BotaoDeSom
              key={efeito.id}
              efeito={efeito}
              toque={toques.get(efeito.id)}
              guardarSelo={(no) => {
                if (no === null) selos.current.delete(efeito.id)
                else selos.current.set(efeito.id, no)
              }}
              onTocar={() => tocar(efeito, true)}
              onEditar={() => setEditando(efeito.id)}
            />
          ))}
        </ul>
      )}

      {biblioteca.efeitos.length > 0 && motivoSemImportar !== null && !semAventura && <p className="lb-sons__nota">{motivoSemImportar}</p>}

      {dir !== null && midiaBytes !== null && (
        <p className={classes('lb-sons__pe', midiaBytes > MIDIA_PESADA_BYTES && 'lb-sons__pe--pesada')}>
          Mídia da aventura: {megas(midiaBytes)}
          {/* Sem "apague sons": apagar tira o botão, não o arquivo (pendência no plano, seção 6). */}
          {midiaBytes > MIDIA_PESADA_BYTES && <span> Passou de 200 MB: levar e abrir a aventura fica lento. Apagar um som tira o botão, mas o áudio dele continua na pasta midia da aventura.</span>}
        </p>
      )}

      <Dialogo aberto={efeitoEditado !== undefined} titulo="Editar som" onFechar={() => setEditando(null)} pequeno>
        {efeitoEditado !== undefined && <EditorDoSom key={efeitoEditado.id} efeito={efeitoEditado} biblioteca={biblioteca} motor={motor} onFechar={() => setEditando(null)} />}
      </Dialogo>
    </div>
  )
}

function efeitosDoFiltro(biblioteca: BibliotecaDeSons, filtro: Filtro): EfeitoDeSom[] {
  const ordenados = [...biblioteca.efeitos].sort((a, b) => a.ordem - b.ordem)
  if (filtro.tipo === 'favoritos') return ordenados.filter((efeito) => efeito.favorito === true)
  if (filtro.tipo === 'pasta') return ordenados.filter((efeito) => efeito.pastaId === filtro.id)
  return ordenados
}

function ChipsDasPastas({ biblioteca, favoritos, filtro, onFiltro }: { biblioteca: BibliotecaDeSons; favoritos: number; filtro: Filtro; onFiltro: (filtro: Filtro) => void }) {
  const pastas = [...biblioteca.pastas].sort((a, b) => a.ordem - b.ordem)
  const opcoes: { chave: string; filtro: Filtro; rotulo: string; conta: number; estrela?: boolean }[] = [
    ...(favoritos > 0 ? [{ chave: 'favoritos', filtro: { tipo: 'favoritos' } as const, rotulo: 'Favoritos', conta: favoritos, estrela: true }] : []),
    { chave: 'todos', filtro: { tipo: 'todos' }, rotulo: 'Todos', conta: biblioteca.efeitos.length },
    ...pastas.map((pasta) => ({ chave: pasta.id, filtro: { tipo: 'pasta', id: pasta.id } as const, rotulo: pasta.nome, conta: biblioteca.efeitos.filter((efeito) => efeito.pastaId === pasta.id).length })),
  ]
  const ehAtual = (opcao: Filtro) => opcao.tipo === filtro.tipo && (opcao.tipo !== 'pasta' || (filtro.tipo === 'pasta' && filtro.id === opcao.id))
  return (
    <div className="lb-sons__pastas" role="radiogroup" aria-label="Mostrar sons" onKeyDown={(evento: EventoDeTecla<HTMLElement>) => andarPelosRadios(evento)}>
      {opcoes.map((opcao) => {
        const atual = ehAtual(opcao.filtro)
        return (
          <button key={opcao.chave} type="button" role="radio" aria-checked={atual} tabIndex={atual ? 0 : -1} className="gr-chip lb-sons__chip" title={opcao.rotulo} onClick={() => onFiltro(opcao.filtro)}>
            {opcao.estrela === true && <IconeDoLivro nome="estrela" />}
            <span className="lb-sons__chip-nome" dir="auto">
              {opcao.rotulo}
            </span>
            <small aria-label={opcao.conta === 1 ? '1 som' : `${opcao.conta} sons`}>{opcao.conta}</small>
          </button>
        )
      })}
    </div>
  )
}

function VazioDosSons({ motivo, podeImportar, onImportar }: { motivo: string | null; podeImportar: boolean; onImportar: () => void }) {
  return (
    <div className="lb-sons__vazio">
      <h3 className="lb-sons__vazio-titulo">Nenhum som ainda</h3>
      <p className="lb-sons__vazio-texto">Importe MP3, WAV, OGG ou M4A de até 15 MB. Cada arquivo vira um botão; as teclas 1 a 9 tocam os que tiverem atalho.</p>
      <Botao variante="primario" disabled={!podeImportar} onClick={onImportar}>
        <IconeDoLivro nome="importar" />
        Importar arquivo
      </Botao>
      {!podeImportar && motivo !== null && motivo !== SONS_SEM_AVENTURA && <p className="lb-sons__nota">{motivo}</p>}
    </div>
  )
}

function rotuloDoBotao(efeito: EfeitoDeSom, tocando: boolean): string {
  const partes = [efeito.nome]
  if (efeito.atalho !== undefined) partes.push(`tecla ${efeito.atalho}`)
  if (efeito.loop) partes.push(tocando ? 'repetindo, toque para parar' : 'repete até parar')
  return partes.join(', ')
}

function BotaoDeSom({
  efeito,
  toque,
  guardarSelo,
  onTocar,
  onEditar,
}: {
  efeito: EfeitoDeSom
  toque: Toque | undefined
  guardarSelo: (no: HTMLElement | null) => void
  onTocar: () => void
  onEditar: () => void
}) {
  const tocando = toque !== undefined
  return (
    <li className={classes('lb-efeito', tocando && 'lb-efeito--tocando', efeito.loop && 'lb-efeito--loop')}>
      <button
        type="button"
        className="lb-efeito__tocar"
        aria-label={rotuloDoBotao(efeito, tocando)}
        aria-pressed={efeito.loop ? tocando : undefined}
        aria-keyshortcuts={efeito.atalho === undefined ? undefined : String(efeito.atalho)}
        title={efeito.nome}
        onClick={onTocar}
      >
        <span className="lb-efeito__cabeca" aria-hidden="true">
          <span className={classes('lb-efeito__selo', efeito.atalho === undefined && 'lb-efeito__selo--vazio')} ref={guardarSelo}>
            {efeito.atalho ?? <IconeDoLivro nome="som" />}
          </span>
          {efeito.favorito === true && (
            <span className="lb-efeito__favorito">
              <IconeDoLivro nome="estrela" />
            </span>
          )}
        </span>
        <span className="lb-efeito__nome" dir="auto">
          {efeito.nome}
        </span>
        {efeito.loop && (
          <span className="lb-efeito__loop" aria-hidden="true">
            <IconeRepetir />
            repete
          </span>
        )}
        <span className="lb-efeito__trilho" aria-hidden="true">
          {toque !== undefined && toque.duracaoS > 0 && (
            <span
              key={toque.vez}
              className={classes('lb-efeito__barra', toque.loop && 'lb-efeito__barra--loop')}
              style={{ animationDuration: `${toque.duracaoS}s`, animationDelay: `${-(toque.jaTocouS % toque.duracaoS)}s` }}
            />
          )}
        </span>
      </button>
      <button type="button" className="lb-efeito__lapis" aria-label={`Editar ${efeito.nome}`} title="Editar" onClick={onEditar}>
        <IconeLapis />
      </button>
    </li>
  )
}

/**
 * Por que a loja não aceita mudança agora, na frase dela; `null` = aceita (a
 * recusa, então, foi do valor). O lápis diz isto DENTRO do diálogo: o aviso da
 * página fica atrás do modal.
 */
function impedimentoDaLoja(): string | null {
  const { aventuraId, carregando, podeGravar } = useBibliotecaDeSonsStore.getState()
  if (aventuraId === null) return SONS_SEM_AVENTURA
  if (carregando) return SONS_AINDA_LENDO
  return podeGravar ? null : SONS_NAO_GRAVAVEIS
}

/** O lápis: nome, volume, repetir, tecla, pasta, favorito e apagar. Cada mudança vale na hora (a biblioteca grava sozinha). */
function EditorDoSom({ efeito, biblioteca, motor, onFechar }: { efeito: EfeitoDeSom; biblioteca: BibliotecaDeSons; motor: MotorAoVivo; onFechar: () => void }) {
  const editar = useBibliotecaDeSonsStore((estado) => estado.editarEfeito)
  const [nome, setNome] = useState(efeito.nome)
  const [saiuDoNome, setSaiuDoNome] = useState(false)
  const [notaDoAtalho, setNotaDoAtalho] = useState<string | null>(null)
  const [novaPasta, setNovaPasta] = useState<string | null>(null)
  const [erroDaPasta, setErroDaPasta] = useState<string | null>(null)
  const [recusa, setRecusa] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const cancelar = useRef<HTMLButtonElement>(null)
  const nomeId = useId()
  const nomeValido = nomeDeSomLimpo(nome) !== null

  useEffect(() => {
    if (confirmando) cancelar.current?.focus()
  }, [confirmando])

  /** Muda na loja e diz se ela aceitou; recusada, o motivo aparece no lápis e quem chamou não mexe no som. */
  const mudar = (mudanca: MudancaNoEfeito): boolean => {
    const aceita = editar(efeito.id, mudanca)
    setRecusa(aceita ? null : `Nada mudou. ${impedimentoDaLoja() ?? 'Esse valor não serve para este som.'}`)
    return aceita
  }

  const mudarNome = (valor: string) => {
    setNome(valor)
    if (nomeDeSomLimpo(valor) !== null) mudar({ nome: valor })
  }

  const mudarVolume = (percentual: number) => {
    if (mudar({ volume: percentual / 100 })) motor.mudarVolume(efeito.id, percentual / 100)
  }

  const mudarAtalho = (valor: string) => {
    const numero = Number(valor)
    const atalho: AtalhoDeSom | null = ehAtalhoDeSom(numero) ? numero : null
    const dono = atalho === null ? undefined : biblioteca.efeitos.find((outro) => outro.atalho === atalho && outro.id !== efeito.id)
    if (!mudar({ atalho })) return
    setNotaDoAtalho(dono === undefined || atalho === null ? null : `A tecla ${atalho} era de ${dono.nome}. Agora é deste som, e ${dono.nome} ficou sem tecla.`)
  }

  const mudarPasta = (valor: string) => {
    setErroDaPasta(null)
    if (valor === NOVA_PASTA) {
      setNovaPasta('')
      return
    }
    setNovaPasta(null)
    mudar({ pastaId: valor === SEM_PASTA ? null : valor })
  }

  const criarPasta = () => {
    const pasta = useBibliotecaDeSonsStore.getState().criarPasta(novaPasta ?? '')
    if (pasta === null) {
      const impedimento = impedimentoDaLoja()
      if (impedimento !== null) setRecusa(`Nada mudou. ${impedimento}`)
      else setErroDaPasta(`Use um nome de 1 a ${NOME_DE_SOM_MAX} caracteres (no máximo 50 pastas).`)
      return
    }
    mudar({ pastaId: pasta.id })
    setNovaPasta(null)
  }

  const apagar = () => {
    // A loja primeiro: recusado, o som segue tocando, o botão fica e o lápis continua aberto com o motivo.
    if (!useBibliotecaDeSonsStore.getState().apagarEfeito(efeito.id)) {
      setRecusa(`${efeito.nome} não foi apagado. ${impedimentoDaLoja() ?? 'Ele já não está na biblioteca.'}`)
      return
    }
    motor.parar(efeito.id)
    onFechar()
  }

  const pastas = [...biblioteca.pastas].sort((a, b) => a.ordem - b.ordem)
  const opcoesDaPasta = [{ valor: SEM_PASTA, rotulo: 'Sem pasta' }, ...pastas.map((pasta) => ({ valor: pasta.id, rotulo: pasta.nome })), { valor: NOVA_PASTA, rotulo: 'Nova pasta…' }]
  const opcoesDoAtalho = [
    { valor: SEM_ATALHO, rotulo: 'Nenhuma' },
    ...([1, 2, 3, 4, 5, 6, 7, 8, 9] as const).map((numero) => {
      const dono = biblioteca.efeitos.find((outro) => outro.atalho === numero && outro.id !== efeito.id)
      return { valor: String(numero), rotulo: dono === undefined ? String(numero) : `${numero} (hoje em ${dono.nome})` }
    }),
  ]

  return (
    <div className="lb-sons-editor" data-gr-foco>
      <div className="gr-campo">
        <div className="gr-campo__rot">
          <label htmlFor={nomeId}>Nome</label>
          <output htmlFor={nomeId}>
            {nome.length}/{NOME_DE_SOM_MAX}
          </output>
        </div>
        <input
          id={nomeId}
          className="gr-entrada"
          type="text"
          autoComplete="off"
          maxLength={NOME_DE_SOM_MAX}
          value={nome}
          aria-invalid={saiuDoNome && !nomeValido}
          aria-describedby={saiuDoNome && !nomeValido ? `${nomeId}-erro` : undefined}
          onChange={(evento) => mudarNome(evento.currentTarget.value)}
          onBlur={() => setSaiuDoNome(true)}
        />
        {saiuDoNome && !nomeValido && (
          <p className="lb-sons__nota lb-sons__nota--erro" id={`${nomeId}-erro`}>
            O nome precisa de 1 a {NOME_DE_SOM_MAX} caracteres. Vale o último nome guardado: {efeito.nome}.
          </p>
        )}
      </div>
      <CampoFaixa rotulo="Volume" min={0} max={100} unidade="%" valor={Math.round(efeito.volume * 100)} onChange={mudarVolume} />
      <CampoLiga rotulo="Repetir até parar" ajuda="Para ambiente: chuva, taverna, vento. Vale no próximo toque." ligado={efeito.loop} onChange={(loop) => mudar({ loop })} />
      <CampoSel rotulo="Tecla de atalho" opcoes={opcoesDoAtalho} valor={efeito.atalho === undefined ? SEM_ATALHO : String(efeito.atalho)} onChange={mudarAtalho} />
      {notaDoAtalho !== null && (
        <p className="lb-sons__nota lb-sons__nota--latao" role="status">
          {notaDoAtalho}
        </p>
      )}
      <CampoSel rotulo="Pasta" opcoes={opcoesDaPasta} valor={novaPasta !== null ? NOVA_PASTA : (efeito.pastaId ?? SEM_PASTA)} onChange={mudarPasta} />
      {novaPasta !== null && (
        <div className="lb-sons-editor__nova-pasta">
          <input
            className="gr-entrada"
            type="text"
            autoComplete="off"
            aria-label="Nome da nova pasta"
            maxLength={NOME_DE_SOM_MAX}
            value={novaPasta}
            onChange={(evento) => setNovaPasta(evento.currentTarget.value)}
            onKeyDown={(evento) => {
              if (evento.key !== 'Enter') return
              evento.preventDefault()
              criarPasta()
            }}
          />
          <Botao tamanho="p" onClick={criarPasta}>
            Criar pasta
          </Botao>
        </div>
      )}
      {erroDaPasta !== null && (
        <p className="lb-sons__nota lb-sons__nota--erro" role="alert">
          {erroDaPasta}
        </p>
      )}
      <CampoLiga rotulo="Favorito" ajuda="Aparece no chip Favoritos, no alto da página." ligado={efeito.favorito === true} onChange={(favorito) => mudar({ favorito })} />
      {recusa !== null && (
        <p className="lb-sons__nota lb-sons__nota--erro" role="alert">
          {recusa}
        </p>
      )}
      {confirmando ? (
        <div className="lb-sons-editor__apagar" role="group" aria-label="Confirmar apagar">
          <p className="lb-sons__nota">Apagar {efeito.nome}? O botão sai desta aventura.</p>
          <div className="gr-acoes">
            <Botao ref={cancelar} tamanho="p" onClick={() => setConfirmando(false)}>
              Cancelar
            </Botao>
            <Botao tamanho="p" variante="perigo" onClick={apagar}>
              Apagar
            </Botao>
          </div>
        </div>
      ) : (
        <div className="lb-sons-editor__pe">
          <Botao tamanho="p" variante="perigo" onClick={() => setConfirmando(true)}>
            <IconeDoLivro nome="lixo" />
            Apagar som…
          </Botao>
          <Botao tamanho="p" variante="primario" className="gr-empurra" onClick={onFechar}>
            Pronto
          </Botao>
        </div>
      )}
    </div>
  )
}

function IconeSvg({ d }: { d: string }) {
  return (
    <svg className="gr-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={d} />
    </svg>
  )
}

function IconeParar() {
  return <IconeSvg d="M7 7h10v10H7z" />
}

function IconeLapis() {
  return <IconeSvg d="M14.5 5.5l4 4 M5 19l1-4.5L15.5 5a1.4 1.4 0 0 1 2 0l1.5 1.5a1.4 1.4 0 0 1 0 2L9.5 18z" />
}

function IconeRepetir() {
  return <IconeSvg d="M17 4.5l2.5 2.5L17 9.5 M19.5 7H8a3.5 3.5 0 0 0-3.5 3.5v1 M7 19.5L4.5 17 7 14.5 M4.5 17H16a3.5 3.5 0 0 0 3.5-3.5v-1" />
}
