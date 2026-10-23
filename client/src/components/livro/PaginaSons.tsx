import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type ChangeEvent, type KeyboardEvent as EventoDeTecla } from 'react'
import { resolverAtalhoDeSom } from '../../lib/keymap'
import { idDaRefDeAudio, MIDIA_AUDIO_MAX_BYTES } from '../../lib/midia'
import { AUDIO_GRANDE_DEMAIS } from '../../lib/midiaNoDisco'
import { assinarRedeDosSons, criarPonteDosSons, informarPastaDosSons, redeDosSons, type PonteDosSons } from '../../net/ponteDosSons'
import { SOM_PRECARGA_MAX } from '../../net/protocol'
import { ehAtalhoDeSom, EFEITOS_DE_SOM_MAX, NOME_DE_SOM_MAX, nomeDeSomLimpo, type AlvoDosSons, type AtalhoDeSom, type BibliotecaDeSons, type EfeitoDeSom, type MudancaNoEfeito, type PastaDeSons } from '../../lib/sons/biblioteca'
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
/** Os favoritos até este peso descem para a mesa antes do clique (F5): o primeiro toque soa sem esperar a rede. */
export const PRE_CARGA_MAX_BYTES = 1024 * 1024
/** Ainda não há seletor de quem escuta na página: tudo vai a Todos, o padrão dele. A F5 passa o alvo sempre. */
const ALVO_TODOS: AlvoDosSons = { tipo: 'todos' }

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
        code: evento.code,
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
function pararAoSairOuTrocarDeAventura(sons: Pick<PonteDosSons, 'pararTudo'>): () => void {
  const desligar = useAdventureStore.subscribe((agora, antes) => {
    const outraAventura = (agora.adventure?.id ?? null) !== (antes.adventure?.id ?? null)
    const outraPasta = antes.dir !== null && agora.dir !== antes.dir
    if (outraAventura || outraPasta) sons.pararTudo()
  })
  return () => {
    desligar()
    sons.pararTudo()
  }
}

/** O aviso de um som que não tocou; com chave, dez recusas seguidas são um aviso só, trocado no lugar. */
function avisarRecusaDoSom(motivo: MotivoDaRecusa, nome: string): void {
  const { tipo, frase } = FRASE_DA_RECUSA[motivo]
  useToastStore.getState().push(tipo, frase(nome), undefined, { chave: `sons:${motivo}` })
}

/**
 * Os ids de áudio dos favoritos de até `PRE_CARGA_MAX_BYTES`, na ordem da
 * biblioteca e sem repetir, até o teto do `som.precarregar`: o que a mesa
 * baixa antes do clique.
 */
export function midiasParaPreCarregar(biblioteca: BibliotecaDeSons): string[] {
  const midias: string[] = []
  for (const efeito of biblioteca.efeitos) {
    if (midias.length >= SOM_PRECARGA_MAX) break
    if (efeito.favorito !== true || efeito.fonte.tipo !== 'arquivo' || efeito.fonte.bytes > PRE_CARGA_MAX_BYTES) continue
    const midia = idDaRefDeAudio(efeito.fonte.ref)
    if (midia !== null && !midias.includes(midia)) midias.push(midia)
  }
  return midias
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
        avisarRecusaDoSom(evento.motivo, nome.current(evento.instancia))
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
  const [arquivosDaMidia, setArquivosDaMidia] = useState<ArquivosDaMidia | null>(null)
  const arquivo = useRef<HTMLInputElement>(null)
  const botaoImportar = useRef<HTMLButtonElement>(null)
  const selos = useRef(new Map<string, HTMLElement>())

  // SONS AO VIVO (F5): o que toca aqui vai também à mesa pela ponte, quando há sala.
  const [ponte] = useState(() => criarPonteDosSons({ motor, rede: redeDosSons }))
  const rede = useSyncExternalStore(assinarRedeDosSons, redeDosSons)

  useEffect(() => ligarBibliotecaAAventura(), [])
  useEffect(() => pararAoSairOuTrocarDeAventura(ponte), [ponte])
  // A sala só serve áudio de dentro da pasta da aventura: a ponte conta a de agora ao servidor dela.
  useEffect(() => informarPastaDosSons(dir), [dir])
  useEffect(() => () => informarPastaDosSons(null), [])

  // Os favoritos leves descem para a mesa antes do clique: ao abrir a sala e quando a lista deles muda.
  const preCarga = useMemo(() => midiasParaPreCarregar(biblioteca).join(' '), [biblioteca])
  useEffect(() => {
    if (rede === null || carregando || preCarga === '') return
    rede.precarregarSonsAoVivo(preCarga.split(' '), ALVO_TODOS)
  }, [rede, carregando, preCarga])

  const toques = useToquesDoMotor(motor, (id) => useBibliotecaDeSonsStore.getState().biblioteca.efeitos.find((efeito) => efeito.id === id)?.nome ?? 'O som')
  const toquesAgora = useRef(toques)
  toquesAgora.current = toques

  /** Toca (ou para o loop que já toca). `peloClique`: só o clique pulsa o selo. */
  const tocar = (efeito: EfeitoDeSom, peloClique: boolean) => {
    // Loop tocando: o mesmo botão (ou tecla) para, com o fade do motor. Efeito curto recomeça.
    if (efeito.loop && toquesAgora.current.has(efeito.id)) {
      ponte.parar(efeito.id)
      return
    }
    // Aqui e na mesa (com a sala aberta). A recusa do motor daqui chega pelos eventos dele; a da mesa volta aqui.
    const { rede: naMesa } = ponte.tocar(efeito, ALVO_TODOS, { local: true })
    if (naMesa !== null && !naMesa.ok && naMesa.motivo === 'limite-de-loops') avisarRecusaDoSom('limite-de-loops', efeito.nome)
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
  const pastaEscolhida = filtroAgora.tipo === 'pasta' ? biblioteca.pastas.find((pasta) => pasta.id === filtroAgora.id) : undefined

  const semAventura = aventuraId === null
  const cheia = biblioteca.efeitos.length >= EFEITOS_DE_SOM_MAX
  const podeImportar = !semAventura && !carregando && podeGravar && !cheia && importando === null
  // O porquê do Importar parado, logo abaixo dele. Sem aventura quem explica é o vazio (ele aparece
  // logo abaixo, sempre: sem aventura não há som); lendo, quem diz é a mensagem no lugar da grade.
  const motivoNoTopo = semAventura || carregando ? null : cheia ? `A biblioteca chegou a ${EFEITOS_DE_SOM_MAX} sons. Apague algum para importar outro.` : null

  const importar = async (arquivos: File[]) => {
    const falhas: string[] = []
    let ultimo: string | null = null
    setRecusas([])
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
    // O sucesso é passageiro (o botão novo já mostra que entrou): aviso que some, fora do topo fixo.
    if (ultimo !== null) useToastStore.getState().push('info', arquivos.length - falhas.length > 1 ? `${arquivos.length - falhas.length} sons entraram na biblioteca.` : `${ultimo} entrou na biblioteca.`, AVISO_DE_IMPORTADO_MS, { chave: 'sons:importado' })
  }

  const fecharRecusas = () => {
    setRecusas([])
    // O Fechar some com o bloco: o foco volta para quem importa.
    botaoImportar.current?.focus()
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
        {/* Hierarquia: parar (o pânico, largo) antes de tocar (a grade) antes de importar (preparo, discreto). */}
        <div className="lb-sons__linha">
          <Botao tamanho="p" className="lb-sons__parar" disabled={toques.size === 0} onClick={() => ponte.pararTudo()}>
            <IconeParar />
            Parar tudo
          </Botao>
          <Botao ref={botaoImportar} tamanho="p" disabled={!podeImportar} onClick={() => arquivo.current?.click()}>
            <IconeDoLivro nome="importar" />
            Importar sons
          </Botao>
        </div>
        {motivoNoTopo !== null && <p className="lb-sons__nota lb-sons__nota--latao">{motivoNoTopo}</p>}
        {/* Linha própria: em 262 px os dois botões e o texto não cabem lado a lado sem cortar. */}
        <p className="lb-sons__soando" aria-live="polite">
          {toques.size === 0 ? 'Nada tocando' : toques.size === 1 ? '1 tocando' : `${toques.size} tocando`}
        </p>
        {!semAventura && dir === null && <p className="lb-sons__nota">Os sons ficam guardados quando a aventura for salva.</p>}
        {importando !== null && (
          <p className="lb-sons__nota" role="status">
            Importando {importando}…
          </p>
        )}
        {aviso !== null && (
          <p className="lb-sons__nota lb-sons__nota--erro" role="alert">
            {aviso}
          </p>
        )}
      </div>
      <input ref={arquivo} type="file" accept={ACEITA_AUDIO} multiple hidden aria-label="Arquivo de som" onChange={escolherArquivos} />

      {recusas.length > 0 && <RecusasDaImportacao recusas={recusas} onFechar={fecharRecusas} />}

      {(biblioteca.pastas.length > 0 || favoritos > 0) && <ChipsDasPastas biblioteca={biblioteca} favoritos={favoritos} filtro={filtroAgora} onFiltro={setFiltro} />}
      {pastaEscolhida !== undefined && <AcoesDaPasta key={pastaEscolhida.id} pasta={pastaEscolhida} sons={visiveis.length} />}

      {carregando ? (
        <p className="lb-sons__mensagem">Lendo os sons da aventura…</p>
      ) : biblioteca.efeitos.length === 0 ? (
        <VazioDosSons semAventura={semAventura} podeImportar={podeImportar} onImportar={() => arquivo.current?.click()} />
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
              onTocar={(peloClique) => tocar(efeito, peloClique)}
              onEditar={() => setEditando(efeito.id)}
            />
          ))}
        </ul>
      )}

      {dir !== null && midiaBytes !== null && (
        <p className={classes('lb-sons__pe', midiaBytes > MIDIA_PESADA_BYTES && 'lb-sons__pe--pesada')}>
          Mídia da aventura: {megas(midiaBytes)}
          {/* Sem "apague sons": apagar tira o botão, não o arquivo (pendência no plano, seção 6). */}
          {midiaBytes > MIDIA_PESADA_BYTES && <span> Passou de 200 MB: levar e abrir a aventura fica lento. Apagar um som tira o botão, mas o áudio dele continua na pasta midia da aventura.</span>}
        </p>
      )}

      <Dialogo aberto={efeitoEditado !== undefined} titulo="Editar som" onFechar={() => setEditando(null)} pequeno>
        {efeitoEditado !== undefined && <EditorDoSom key={efeitoEditado.id} efeito={efeitoEditado} biblioteca={biblioteca} motor={motor} ponte={ponte} tocando={toques.has(efeitoEditado.id)} onFechar={() => setEditando(null)} />}
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

/** Uma linha da roda do mouse (deltaMode 1, o Firefox) em px. */
const PX_POR_LINHA_DA_RODA = 16

/**
 * A fileira de pastas rola de lado; o mouse comum só tem a roda vertical. Ela
 * vira rolagem de lado enquanto a fileira tem para onde ir; no fim (ou com
 * gesto de lado do trackpad) a página rola como sempre. Devolve o desligar.
 */
function rodaDoMouseRolaDeLado(fileira: HTMLElement | null): (() => void) | undefined {
  if (fileira === null) return undefined
  const rolar = (evento: WheelEvent) => {
    if (Math.abs(evento.deltaY) <= Math.abs(evento.deltaX)) return
    const passo = evento.deltaMode === 1 ? evento.deltaY * PX_POR_LINHA_DA_RODA : evento.deltaY
    const maximo = fileira.scrollWidth - fileira.clientWidth
    const temParaOndeIr = passo < 0 ? fileira.scrollLeft > 0 : fileira.scrollLeft < maximo
    if (maximo <= 0 || !temParaOndeIr) return
    evento.preventDefault()
    fileira.scrollLeft = Math.min(maximo, Math.max(0, fileira.scrollLeft + passo))
  }
  fileira.addEventListener('wheel', rolar, { passive: false })
  return () => fileira.removeEventListener('wheel', rolar)
}

/**
 * O chip focado (Tab ou setas) fica inteiro à vista na fileira: o foco do
 * navegador só rola quando o chip está todo fora, e meio chip cortado pelo
 * esmaecido some do olho. Sem animação: é ação de teclado.
 */
function trazerParaAVista(chip: HTMLElement): void {
  if (typeof chip.scrollIntoView === 'function') chip.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}

function ChipsDasPastas({ biblioteca, favoritos, filtro, onFiltro }: { biblioteca: BibliotecaDeSons; favoritos: number; filtro: Filtro; onFiltro: (filtro: Filtro) => void }) {
  const pastas = [...biblioteca.pastas].sort((a, b) => a.ordem - b.ordem)
  const opcoes: { chave: string; filtro: Filtro; rotulo: string; conta: number; estrela?: boolean }[] = [
    ...(favoritos > 0 ? [{ chave: 'favoritos', filtro: { tipo: 'favoritos' } as const, rotulo: 'Favoritos', conta: favoritos, estrela: true }] : []),
    { chave: 'todos', filtro: { tipo: 'todos' }, rotulo: 'Todos', conta: biblioteca.efeitos.length },
    ...pastas.map((pasta) => ({ chave: pasta.id, filtro: { tipo: 'pasta', id: pasta.id } as const, rotulo: pasta.nome, conta: biblioteca.efeitos.filter((efeito) => efeito.pastaId === pasta.id).length })),
  ]
  const ehAtual = (opcao: Filtro) => opcao.tipo === filtro.tipo && (opcao.tipo !== 'pasta' || (filtro.tipo === 'pasta' && filtro.id === opcao.id))
  const fileira = useRef<HTMLDivElement>(null)
  useEffect(() => rodaDoMouseRolaDeLado(fileira.current), [])
  return (
    <div ref={fileira} className="lb-sons__pastas" role="radiogroup" aria-label="Mostrar sons" onKeyDown={(evento: EventoDeTecla<HTMLElement>) => andarPelosRadios(evento)}>
      {opcoes.map((opcao) => {
        const atual = ehAtual(opcao.filtro)
        return (
          <button key={opcao.chave} type="button" role="radio" aria-checked={atual} tabIndex={atual ? 0 : -1} className="gr-chip lb-sons__chip" title={opcao.rotulo} onClick={() => onFiltro(opcao.filtro)} onFocus={(evento) => trazerParaAVista(evento.currentTarget)}>
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

/**
 * Renomear e apagar a pasta escolhida no chip (sem elas, o nome errado ficava
 * para sempre, contra o teto de 50 pastas). Só a biblioteca muda: nada no
 * disco além do `sons.json`. Apagada, os sons dela ficam sem pasta, em Todos.
 */
function AcoesDaPasta({ pasta, sons }: { pasta: PastaDeSons; sons: number }) {
  const [modo, setModo] = useState<'nada' | 'renomear' | 'apagar'>('nada')
  const [nome, setNome] = useState(pasta.nome)
  const [erro, setErro] = useState<string | null>(null)
  const campo = useRef<HTMLInputElement>(null)
  const cancelar = useRef<HTMLButtonElement>(null)
  const renomear = useRef<HTMLButtonElement>(null)
  const voltarAoRenomear = useRef(false)

  useEffect(() => {
    if (modo === 'renomear') {
      campo.current?.focus()
      campo.current?.select()
    }
    else if (modo === 'apagar') cancelar.current?.focus()
    else if (voltarAoRenomear.current) {
      voltarAoRenomear.current = false
      renomear.current?.focus()
    }
  }, [modo])

  const desistir = () => {
    setErro(null)
    setNome(pasta.nome)
    voltarAoRenomear.current = true
    setModo('nada')
  }

  const gravar = () => {
    if (nome.trim() === pasta.nome || useBibliotecaDeSonsStore.getState().renomearPasta(pasta.id, nome)) {
      desistir()
      return
    }
    setErro(impedimentoDaLoja() ?? `Use um nome de 1 a ${NOME_DE_SOM_MAX} caracteres.`)
  }

  const apagar = (botao: HTMLElement) => {
    const pagina = botao.closest('.lb-sons')
    if (!useBibliotecaDeSonsStore.getState().apagarPasta(pasta.id)) {
      setErro(`A pasta não foi apagada. ${impedimentoDaLoja() ?? 'Ela já não existe.'}`)
      return
    }
    // Este bloco some com a pasta: o foco vai para o chip que fica escolhido (Todos) ou, sem pasta nenhuma
    // (a fileira some), para o primeiro som; depois de o React desenhar.
    setTimeout(() => (pagina?.querySelector<HTMLElement>('.lb-sons__chip[aria-checked="true"]') ?? pagina?.querySelector<HTMLElement>('.lb-efeito__tocar'))?.focus(), 0)
  }

  const sobreOsSons = sons === 0 ? 'Ela está vazia.' : sons === 1 ? 'O som dela fica sem pasta, em Todos.' : `Os ${sons} sons dela ficam sem pasta, em Todos.`

  return (
    <div className="lb-sons__pasta-acoes">
      {modo === 'renomear' ? (
        <div className="lb-sons__pasta-form">
          <input
            ref={campo}
            className="gr-entrada"
            type="text"
            autoComplete="off"
            aria-label="Novo nome da pasta"
            maxLength={NOME_DE_SOM_MAX}
            value={nome}
            onChange={(evento) => setNome(evento.currentTarget.value)}
            onKeyDown={(evento) => {
              if (evento.key === 'Enter') {
                evento.preventDefault()
                gravar()
              } else if (evento.key === 'Escape') {
                // O Esc é da pasta aqui, não da seleção do mapa.
                evento.preventDefault()
                evento.stopPropagation()
                desistir()
              }
            }}
          />
          <div className="gr-acoes">
            <Botao tamanho="p" onClick={desistir}>
              Cancelar
            </Botao>
            <Botao tamanho="p" variante="primario" onClick={gravar}>
              Gravar nome
            </Botao>
          </div>
        </div>
      ) : modo === 'apagar' ? (
        <div className="lb-sons__pasta-form" role="group" aria-label="Confirmar apagar pasta">
          <p className="lb-sons__nota">
            Apagar a pasta {pasta.nome}? {sobreOsSons}
          </p>
          <div className="gr-acoes">
            <Botao ref={cancelar} tamanho="p" onClick={desistir}>
              Cancelar
            </Botao>
            <Botao tamanho="p" variante="perigo" onClick={(evento) => apagar(evento.currentTarget)}>
              Apagar pasta
            </Botao>
          </div>
        </div>
      ) : (
        <div className="lb-sons__pasta-botoes">
          <Botao ref={renomear} tamanho="p" aria-label="Renomear pasta" onClick={() => setModo('renomear')}>
            <IconeLapis />
            Renomear
          </Botao>
          <Botao tamanho="p" aria-label="Apagar pasta…" onClick={() => setModo('apagar')}>
            <IconeDoLivro nome="lixo" />
            Apagar…
          </Botao>
        </div>
      )}
      {erro !== null && (
        <p className="lb-sons__nota lb-sons__nota--erro" role="alert">
          {erro}
        </p>
      )}
    </div>
  )
}

/** No máximo estas recusas por extenso; o resto vira "e mais N" (o bloco não empurra a grade para longe). */
const RECUSAS_POR_EXTENSO = 3
/** O aviso de que o som entrou some sozinho. */
const AVISO_DE_IMPORTADO_MS = 4000

/** As recusas da última importação, logo abaixo do topo fixo (rolam com a página), até o mestre fechar. */
function RecusasDaImportacao({ recusas, onFechar }: { recusas: readonly string[]; onFechar: () => void }) {
  const resto = recusas.length - RECUSAS_POR_EXTENSO
  return (
    <div className="lb-sons__recusas">
      <div className="lb-sons__nota lb-sons__nota--erro" role="alert">
        {recusas.slice(0, RECUSAS_POR_EXTENSO).map((recusa, indice) => (
          // Dois arquivos de mesmo nome e mesmo motivo dão a mesma frase: a posição é a chave.
          <p key={indice}>{recusa}</p>
        ))}
        {resto > 0 && <p>E mais {resto === 1 ? '1 arquivo recusado' : `${resto} arquivos recusados`}.</p>}
      </div>
      <Botao tamanho="p" onClick={onFechar}>
        Fechar
      </Botao>
    </div>
  )
}

function VazioDosSons({ semAventura, podeImportar, onImportar }: { semAventura: boolean; podeImportar: boolean; onImportar: () => void }) {
  // Mapa solto: o caminho que existe hoje para virar aventura é a cena nova (App.tsx, createScene com o mapa solto).
  if (semAventura)
    return (
      <div className="lb-sons__vazio">
        <h3 className="lb-sons__vazio-titulo">Sons moram numa aventura</h3>
        <p className="lb-sons__vazio-texto">Este é um mapa solto. Em Cenas, + Nova cena transforma este mapa na primeira cena de uma aventura; a partir daí os sons podem entrar aqui.</p>
      </div>
    )
  return (
    <div className="lb-sons__vazio">
      <h3 className="lb-sons__vazio-titulo">Nenhum som ainda</h3>
      <p className="lb-sons__vazio-texto">Importe MP3, WAV, OGG ou M4A de até 15 MB. Cada arquivo vira um botão; as teclas 1 a 9 tocam os que tiverem atalho.</p>
      <Botao variante="primario" disabled={!podeImportar} onClick={onImportar}>
        <IconeDoLivro nome="importar" />
        Importar sons
      </Botao>
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
  /** `peloClique`: clique de ponteiro (detail > 0). Enter e Espaço no botão focado chegam com detail 0 e não pulsam. */
  onTocar: (peloClique: boolean) => void
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
        onClick={(evento) => onTocar(evento.detail > 0)}
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
        {/* O loop tocando diz o que o clique faz agora: para. */}
        {efeito.loop &&
          (tocando ? (
            <span className="lb-efeito__loop lb-efeito__loop--parar" aria-hidden="true">
              <IconeParar />
              parar
            </span>
          ) : (
            <span className="lb-efeito__loop" aria-hidden="true">
              <IconeRepetir />
              repete
            </span>
          ))}
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
function EditorDoSom({ efeito, biblioteca, motor, ponte, tocando, onFechar }: { efeito: EfeitoDeSom; biblioteca: BibliotecaDeSons; motor: MotorAoVivo; ponte: PonteDosSons; tocando: boolean; onFechar: () => void }) {
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
    // O volume novo vale aqui e na mesa (o toque que já soa lá muda junto).
    if (mudar({ volume: percentual / 100 })) ponte.mudarVolume(efeito.id, percentual / 100)
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
    // O som apagado para também na mesa: lá ninguém teria como pará-lo.
    ponte.parar(efeito.id)
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
      {/* Ouvir dá UMA passada no volume de agora (mesmo o loop: provar o volume não liga o ambiente); tocando, para. */}
      <div className="lb-sons-editor__volume">
        <CampoFaixa rotulo="Volume" min={0} max={100} unidade="%" valor={Math.round(efeito.volume * 100)} onChange={mudarVolume} />
        <Botao
          tamanho="p"
          aria-label={`${tocando ? 'Parar' : 'Ouvir'} ${efeito.nome}`}
          // Ouvir é só do mestre (prova o som sem a mesa); Parar alcança a mesa, se ele soa lá também.
          onClick={() => (tocando ? ponte.parar(efeito.id) : motor.tocar(efeito.id, efeito.fonte, { loop: false, volumeDoEfeito: efeito.volume }))}
        >
          {tocando ? <IconeParar /> : <IconeDoLivro nome="som" />}
          {tocando ? 'Parar' : 'Ouvir'}
        </Botao>
      </div>
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
