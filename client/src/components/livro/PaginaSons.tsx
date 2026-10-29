import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type ChangeEvent, type KeyboardEvent as EventoDeTecla, type ReactNode } from 'react'
import { resolverAtalhoDeSom } from '../../lib/keymap'
import { idDaRefDeAudio, MIDIA_AUDIO_MAX_BYTES } from '../../lib/midia'
import { AUDIO_GRANDE_DEMAIS } from '../../lib/midiaNoDisco'
import { assinarRedeDosSons, criarPonteDosSons, informarPastaDosSons, redeDosSons, type PonteDosSons } from '../../net/ponteDosSons'
import {
  ehAtalhoDeSom,
  EFEITOS_DE_SOM_MAX,
  NOME_DE_SOM_MAX,
  nomeDeSomLimpo,
  parteDe,
  PARTES_DOS_SONS,
  type AlvoDosSons,
  type AtalhoDeSom,
  type BibliotecaDeSons,
  type EfeitoDeSom,
  type EfeitoNovo,
  type MudancaNoEfeito,
  type ParteDosSons,
  type PastaDeSons,
} from '../../lib/sons/biblioteca'
import { arquivosDaMidiaDaAventura, carregarBytesDoMestre, obterMotorDoMestre, pesoDaMidiaComSons, type ArquivosDaMidia } from '../../lib/sons/aoVivo/carregadorDoMestre'
import { MAX_LOOPS, PRE_CARGA_MAX_ARQUIVOS, type CarregadorDeBytes, type MotivoDaRecusa, type MotorAoVivo } from '../../lib/sons/aoVivo/motor'
import { useAdventureStore } from '../../stores/adventureStore'
import { ligarBibliotecaAAventura, SONS_AINDA_LENDO, SONS_NAO_GRAVAVEIS, SONS_SEM_AVENTURA, useBibliotecaDeSonsStore } from '../../stores/bibliotecaDeSonsStore'
import { useToastStore, type ToastKind } from '../../stores/toastStore'
import { Botao } from '../grimorio/Botao'
import { CampoFaixa } from '../grimorio/CampoFaixa'
import { CampoLiga } from '../grimorio/CampoLiga'
import { CampoSeg } from '../grimorio/CampoSeg'
import { CampoSel } from '../grimorio/CampoTexto'
import { Dialogo } from '../grimorio/Dialogo'
import { classes, movimentoReduzido } from '../grimorio/comum'
import { ColarLinkDoYoutube } from './ColarLinkDoYoutube'
import { TituloDaPagina } from './FolhaDoLivro'
import { IconeDoLivro } from './icones'
import { EditorDoTrecho } from './TrechoDoSom'
import './sons.css'

/*
 * PÁGINA SONS do livro da mesa (Sistema 4, sons ao vivo, fatia F3: só local).
 * Duas partes no alto, Músicas e Efeitos sonoros (29/10/2026); dentro de cada
 * uma, as categorias (as pastas de um nível do `sons.json`) abrem e fecham, e
 * cada som é uma linha que toca na hora, com a miniatura do YouTube ou o ícone
 * da parte no começo. Parar tudo fixo no alto, busca e Favoritos na parte,
 * atalhos 1 a 9 e o lápis de cada som (tipo, categoria, trecho de A até B). A folha
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
/** A busca aparece na parte com mais sons que isto: com poucos, a lista inteira já cabe numa olhada. */
export const BUSCA_A_PARTIR_DE = 6
const CHAVE_SEM_CATEGORIA = 'sem-categoria'
/** A largura da `mqdefault` do YouTube (320x180); a imagem de "vídeo indisponível" tem 120. */
const MINIATURA_LARGURA_REAL = 320

export const NOME_DA_PARTE: Record<ParteDosSons, string> = { musicas: 'Músicas', efeitos: 'Efeitos sonoros' }
/** No lápis, o tipo de UM som. */
const TIPO_DO_SOM: Record<ParteDosSons, string> = { musicas: 'Música', efeitos: 'Efeito sonoro' }

/** Uma categoria na tela: a pasta (ou nenhuma, "Sem categoria") e os sons dela que passam pela busca e pelos Favoritos. */
export interface GrupoDeSons {
  chave: string
  pasta: PastaDeSons | null
  efeitos: EfeitoDeSom[]
}

/** Para comparar na busca: sem acento, sem caixa, aparado ("taverna" acha "Tavérna"). */
function textoDeBusca(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR').trim()
}

/** Quantos sons e favoritos cada parte tem (as abas e o filtro). */
export function contagemDasPartes(biblioteca: BibliotecaDeSons): Record<ParteDosSons, { sons: number; favoritos: number }> {
  const contagem = { musicas: { sons: 0, favoritos: 0 }, efeitos: { sons: 0, favoritos: 0 } }
  for (const efeito of biblioteca.efeitos) {
    const daParte = contagem[parteDe(efeito)]
    daParte.sons += 1
    if (efeito.favorito === true) daParte.favoritos += 1
  }
  return contagem
}

/**
 * As categorias de uma parte, na ordem: Sem categoria primeiro (é onde cai o
 * que acabou de entrar), depois as pastas pela ordem delas. Sem filtro, toda
 * categoria aparece, vazia ou não (as sugeridas ainda sem som incluídas), e
 * Sem categoria só com som. Com busca ou Favoritos, só as que têm o que
 * mostrar; a categoria cujo NOME casa com a busca mostra todos os sons dela.
 */
export function gruposDaParte(biblioteca: BibliotecaDeSons, parte: ParteDosSons, busca: string, soFavoritos: boolean): GrupoDeSons[] {
  const termo = textoDeBusca(busca)
  const filtrando = termo !== '' || soFavoritos
  const pastas = biblioteca.pastas.filter((pasta) => parteDe(pasta) === parte).sort((a, b) => a.ordem - b.ordem)
  const pastaCasa = new Set(termo === '' ? [] : pastas.filter((pasta) => textoDeBusca(pasta.nome).includes(termo)).map((pasta) => pasta.id))
  const efeitos = biblioteca.efeitos
    .filter((efeito) => {
      if (parteDe(efeito) !== parte || (soFavoritos && efeito.favorito !== true)) return false
      return termo === '' || textoDeBusca(efeito.nome).includes(termo) || (efeito.pastaId !== null && pastaCasa.has(efeito.pastaId))
    })
    .sort((a, b) => a.ordem - b.ordem)
  const grupos: GrupoDeSons[] = [
    { chave: CHAVE_SEM_CATEGORIA, pasta: null, efeitos: efeitos.filter((efeito) => efeito.pastaId === null) },
    ...pastas.map((pasta) => ({ chave: pasta.id, pasta, efeitos: efeitos.filter((efeito) => efeito.pastaId === pasta.id) })),
  ]
  return grupos.filter((grupo) => grupo.efeitos.length > 0 || (!filtrando && grupo.pasta !== null))
}

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
  'youtube-bloqueado': { tipo: 'error', frase: (nome) => `${nome} não tocou: este vídeo não deixa tocar fora do YouTube.` },
  'youtube-indisponivel': { tipo: 'error', frase: (nome) => `${nome} não tocou: o vídeo foi removido ou é privado.` },
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
 * biblioteca e sem repetir, até `PRE_CARGA_MAX_ARQUIVOS` (bem abaixo do teto
 * de 32 do `som.precarregar`: é o que o limite por IP do servidor da sala
 * comporta com a mesa cheia): o que a mesa baixa antes do clique.
 */
export function midiasParaPreCarregar(biblioteca: BibliotecaDeSons): string[] {
  const midias: string[] = []
  for (const efeito of biblioteca.efeitos) {
    if (midias.length >= PRE_CARGA_MAX_ARQUIVOS) break
    if (efeito.favorito !== true || efeito.fonte.tipo !== 'arquivo' || efeito.fonte.bytes > PRE_CARGA_MAX_BYTES) continue
    const midia = idDaRefDeAudio(efeito.fonte.ref)
    if (midia !== null && !midias.includes(midia)) midias.push(midia)
  }
  return midias
}

/**
 * Os toques que estão soando, pelo id do efeito (a instância do motor é o próprio id).
 * `aoRecusar`: o motor daqui recusou (na hora ou depois do clique, quando o arquivo não abre).
 */
function useToquesDoMotor(motor: MotorAoVivo, nomeDe: (id: string) => string, aoRecusar: (id: string) => void): ReadonlyMap<string, Toque> {
  const [toques, setToques] = useState<ReadonlyMap<string, Toque>>(() => new Map())
  const nome = useRef(nomeDe)
  nome.current = nomeDe
  const recusou = useRef(aoRecusar)
  recusou.current = aoRecusar
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
        recusou.current(evento.instancia)
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
  /** Quem traz os bytes para a onda do trecho no lápis; o padrão lê a pasta da aventura. */
  carregarAudio?: CarregadorDeBytes
}

export function PaginaSons({ motor: motorDado, medirMidia = arquivosDaMidiaDaAventura, carregarAudio = carregarBytesDoMestre }: PaginaSonsProps) {
  const [motor] = useState(() => motorDado ?? obterMotorDoMestre())
  const biblioteca = useBibliotecaDeSonsStore((estado) => estado.biblioteca)
  const aventuraId = useBibliotecaDeSonsStore((estado) => estado.aventuraId)
  const dir = useBibliotecaDeSonsStore((estado) => estado.dir)
  const carregando = useBibliotecaDeSonsStore((estado) => estado.carregando)
  const pendente = useBibliotecaDeSonsStore((estado) => estado.pendente)
  const aviso = useBibliotecaDeSonsStore((estado) => estado.aviso)
  const podeGravar = useBibliotecaDeSonsStore((estado) => estado.podeGravar)
  const [parteEscolhida, setParteEscolhida] = useState<ParteDosSons | null>(null)
  const [busca, setBusca] = useState('')
  const [soFavoritos, setSoFavoritos] = useState(false)
  /** As categorias fechadas (chave do grupo). Não é gravado: vale enquanto o app está aberto. */
  const [fechadas, setFechadas] = useState<ReadonlySet<string>>(() => new Set())
  const [organizando, setOrganizando] = useState<string | null>(null)
  const [editando, setEditando] = useState<string | null>(null)
  const [importando, setImportando] = useState<string | null>(null)
  const [colandoLink, setColandoLink] = useState(false)
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

  // O motor daqui recusou depois do clique (o arquivo não abre neste computador): a mesa já recebeu o toque, e um
  // loop lá seguiria sem botão aceso para pará-lo. O mestre ouve o que a mesa ouve: para lá também (sem apelido, nada sai).
  const pararNaMesa = (id: string) => ponte.parar(id)
  const toques = useToquesDoMotor(motor, (id) => useBibliotecaDeSonsStore.getState().biblioteca.efeitos.find((efeito) => efeito.id === id)?.nome ?? 'O som', pararNaMesa)
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

  // A parte que abre: a escolhida; antes de escolher, Músicas, a não ser que só Efeitos tenha som (a biblioteca de antes).
  const contagem = useMemo(() => contagemDasPartes(biblioteca), [biblioteca])
  const parte: ParteDosSons = parteEscolhida ?? (contagem.musicas.sons === 0 && contagem.efeitos.sons > 0 ? 'efeitos' : 'musicas')
  const outraParte: ParteDosSons = parte === 'musicas' ? 'efeitos' : 'musicas'
  // O último favorito da parte saiu: o filtro se desliga sozinho, em vez de esconder a parte inteira.
  const soFavoritosAgora = soFavoritos && contagem[parte].favoritos > 0
  const grupos = useMemo(() => gruposDaParte(biblioteca, parte, busca, soFavoritosAgora), [biblioteca, parte, busca, soFavoritosAgora])
  const filtrando = busca.trim() !== '' || soFavoritosAgora
  const naOutraParte = filtrando && busca.trim() !== '' ? gruposDaParte(biblioteca, outraParte, busca, false).reduce((soma, grupo) => soma + grupo.efeitos.length, 0) : 0
  const ids = useId()
  const abaId = (qual: ParteDosSons) => `${ids}-aba-${qual}`
  const painelId = `${ids}-painel`

  const trocarDeParte = (qual: ParteDosSons) => {
    setParteEscolhida(qual)
    setOrganizando(null)
  }

  const alternarCategoria = (chave: string) =>
    setFechadas((antes) => {
      const depois = new Set(antes)
      if (depois.has(chave)) depois.delete(chave)
      else depois.add(chave)
      return depois
    })

  const semAventura = aventuraId === null
  const cheia = biblioteca.efeitos.length >= EFEITOS_DE_SOM_MAX
  const podeImportar = !semAventura && !carregando && podeGravar && !cheia && importando === null
  const podeColarLink = !semAventura && !carregando && podeGravar && !cheia

  /** O som do YouTube entra na biblioteca; a frase da recusa volta ao formulário (o aviso da página fica atrás dele). */
  const guardarLink = (novo: EfeitoNovo): string | null => {
    const efeito = useBibliotecaDeSonsStore.getState().adicionarEfeito({ ...novo, parte })
    if (efeito === null) return `O som não entrou. ${impedimentoDaLoja() ?? `Confira o nome (1 a ${NOME_DE_SOM_MAX} caracteres) e o trecho.`}`
    useToastStore.getState().push('info', `${efeito.nome} entrou em ${NOME_DA_PARTE[parte]}.`, AVISO_DE_IMPORTADO_MS, { chave: 'sons:importado' })
    return null
  }
  // O porquê do Importar parado, logo abaixo dele. Sem aventura quem explica é o vazio (ele aparece
  // logo abaixo, sempre: sem aventura não há som); lendo, quem diz é a mensagem no lugar da grade.
  const motivoNoTopo = semAventura || carregando ? null : cheia ? `A biblioteca chegou a ${EFEITOS_DE_SOM_MAX} sons. Apague algum para importar outro.` : null

  const importar = async (arquivos: File[]) => {
    // A parte aberta no clique: trocar de aba enquanto importa não muda para onde os arquivos vão.
    const destino = parte
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
        const efeito = await useBibliotecaDeSonsStore.getState().importarArquivoDeSom(escolhido.name, new Uint8Array(await escolhido.arrayBuffer()), destino)
        ultimo = efeito.nome
      } catch (erro) {
        falhas.push(fraseDaRecusaDoArquivo(escolhido.name, erro))
      }
    }
    setImportando(null)
    setRecusas(falhas)
    // O sucesso é passageiro (o botão novo já mostra que entrou): aviso que some, fora do topo fixo.
    if (ultimo !== null) useToastStore.getState().push('info', arquivos.length - falhas.length > 1 ? `${arquivos.length - falhas.length} sons entraram em ${NOME_DA_PARTE[destino]}.` : `${ultimo} entrou em ${NOME_DA_PARTE[destino]}.`, AVISO_DE_IMPORTADO_MS, { chave: 'sons:importado' })
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
      <TituloDaPagina titulo="Sons" sub="Músicas e efeitos da aventura" />
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
          <Botao tamanho="p" disabled={!podeColarLink} onClick={() => setColandoLink(true)}>
            <IconeLink />
            Colar link
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
        {!semAventura && <AbasDasPartes parte={parte} contagem={contagem} abaId={abaId} painelId={painelId} onParte={trocarDeParte} />}
      </div>
      <input ref={arquivo} type="file" accept={ACEITA_AUDIO} multiple hidden aria-label="Arquivo de som" onChange={escolherArquivos} />

      {recusas.length > 0 && <RecusasDaImportacao recusas={recusas} onFechar={fecharRecusas} />}

      {carregando ? (
        <p className="lb-sons__mensagem">Lendo os sons da aventura…</p>
      ) : semAventura ? (
        <VazioDosSons semAventura podeImportar={false} parte={parte} onImportar={() => undefined} />
      ) : (
        <div className="lb-sons__parte" role="tabpanel" id={painelId} aria-labelledby={abaId(parte)}>
          {contagem[parte].sons === 0 ? (
            biblioteca.efeitos.length === 0 ? (
              <VazioDosSons semAventura={false} podeImportar={podeImportar} parte={parte} onImportar={() => arquivo.current?.click()} />
            ) : (
              <p className="lb-sons__mensagem">
                {parte === 'musicas' ? 'Nenhuma música ainda.' : 'Nenhum efeito sonoro ainda.'} O que entra com Importar ou Colar link vem para esta parte; um som de {NOME_DA_PARTE[outraParte]} muda de parte no lápis, no campo Tipo.
              </p>
            )
          ) : (
            <FerramentasDaParte parte={parte} sons={contagem[parte].sons} favoritos={contagem[parte].favoritos} busca={busca} soFavoritos={soFavoritosAgora} onBusca={setBusca} onFavoritos={setSoFavoritos} />
          )}
          {filtrando && grupos.length === 0 && (
            <p className="lb-sons__mensagem" role="status">
              {busca.trim() === '' ? `Nenhum favorito em ${NOME_DA_PARTE[parte]}.` : `Nenhum som com “${busca.trim()}” em ${NOME_DA_PARTE[parte]}.`}
              {naOutraParte > 0 && ` Em ${NOME_DA_PARTE[outraParte]} ${naOutraParte === 1 ? 'há 1' : `há ${naOutraParte}`}.`}
            </p>
          )}
          {grupos.map((grupo) => (
            <CategoriaDeSons
              key={grupo.chave}
              grupo={grupo}
              aberta={filtrando || !fechadas.has(grupo.chave)}
              onAlternar={filtrando ? undefined : () => alternarCategoria(grupo.chave)}
              organizando={grupo.pasta !== null && organizando === grupo.pasta.id}
              onOrganizar={() => setOrganizando((antes) => (grupo.pasta === null || antes === grupo.pasta.id ? null : grupo.pasta.id))}
            >
              {grupo.efeitos.map((efeito) => (
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
            </CategoriaDeSons>
          ))}
          {!filtrando && <NovaCategoria key={parte} parte={parte} />}
        </div>
      )}

      {dir !== null && midiaBytes !== null && (
        <p className={classes('lb-sons__pe', midiaBytes > MIDIA_PESADA_BYTES && 'lb-sons__pe--pesada')}>
          Mídia da aventura: {megas(midiaBytes)}
          {/* Sem "apague sons": apagar tira o botão, não o arquivo (pendência no plano, seção 6). */}
          {midiaBytes > MIDIA_PESADA_BYTES && <span> Passou de 200 MB: levar e abrir a aventura fica lento. Apagar um som tira o botão, mas o áudio dele continua na pasta midia da aventura.</span>}
        </p>
      )}

      <Dialogo aberto={colandoLink} titulo="Som do YouTube" onFechar={() => setColandoLink(false)} pequeno>
        {colandoLink && <ColarLinkDoYoutube motor={motor} onGuardar={guardarLink} onFechar={() => setColandoLink(false)} />}
      </Dialogo>

      <Dialogo aberto={efeitoEditado !== undefined} titulo="Editar som" onFechar={() => setEditando(null)} pequeno>
        {efeitoEditado !== undefined && (
          <EditorDoSom key={efeitoEditado.id} efeito={efeitoEditado} biblioteca={biblioteca} motor={motor} ponte={ponte} carregarAudio={carregarAudio} tocando={toques.has(efeitoEditado.id)} onFechar={() => setEditando(null)} />
        )}
      </Dialogo>
    </div>
  )
}

/**
 * As duas partes no alto, no topo fixo: um controle segmentado com papel de
 * abas (role tablist), porque troca o painel inteiro de baixo. As setas
 * escolhem a vizinha e já mostram (ativação automática: são só duas, e trocar
 * não custa nada). O número é quantos sons a parte tem.
 */
function AbasDasPartes({
  parte,
  contagem,
  abaId,
  painelId,
  onParte,
}: {
  parte: ParteDosSons
  contagem: Record<ParteDosSons, { sons: number }>
  abaId: (qual: ParteDosSons) => string
  painelId: string
  onParte: (qual: ParteDosSons) => void
}) {
  const teclar = (evento: EventoDeTecla<HTMLDivElement>) => {
    const indice = PARTES_DOS_SONS.indexOf(parte)
    const passo = evento.key === 'ArrowRight' ? 1 : evento.key === 'ArrowLeft' ? -1 : 0
    const alvo = evento.key === 'Home' ? PARTES_DOS_SONS[0] : evento.key === 'End' ? PARTES_DOS_SONS[PARTES_DOS_SONS.length - 1] : passo === 0 ? undefined : PARTES_DOS_SONS[(indice + passo + PARTES_DOS_SONS.length) % PARTES_DOS_SONS.length]
    if (alvo === undefined) return
    evento.preventDefault()
    onParte(alvo)
    document.getElementById(abaId(alvo))?.focus()
  }
  return (
    <div className="gr-seg lb-sons__abas" role="tablist" aria-label="Partes da biblioteca de sons" onKeyDown={teclar}>
      {PARTES_DOS_SONS.map((qual) => {
        const escolhida = qual === parte
        const n = contagem[qual].sons
        return (
          <button
            key={qual}
            id={abaId(qual)}
            type="button"
            role="tab"
            className="gr-seg__op lb-sons__aba"
            aria-selected={escolhida}
            aria-controls={escolhida ? painelId : undefined}
            tabIndex={escolhida ? 0 : -1}
            onClick={() => onParte(qual)}
          >
            <span className="lb-sons__aba-nome">{NOME_DA_PARTE[qual]}</span>
            <small aria-label={n === 1 ? '1 som' : `${n} sons`}>{n}</small>
          </button>
        )
      })}
    </div>
  )
}

/** Busca (só com muitos sons) e o filtro Favoritos (só com favorito na parte), logo acima das categorias. */
function FerramentasDaParte({
  parte,
  sons,
  favoritos,
  busca,
  soFavoritos,
  onBusca,
  onFavoritos,
}: {
  parte: ParteDosSons
  sons: number
  favoritos: number
  busca: string
  soFavoritos: boolean
  onBusca: (busca: string) => void
  onFavoritos: (ligado: boolean) => void
}) {
  const comBusca = sons > BUSCA_A_PARTIR_DE || busca !== ''
  if (!comBusca && favoritos === 0) return null
  return (
    <div className="lb-sons__ferramentas">
      {comBusca && (
        <div className="lb-sons__busca">
          <IconeDoLivro nome="busca" />
          <input
            className="gr-entrada"
            type="search"
            autoComplete="off"
            spellCheck={false}
            aria-label={`Buscar em ${NOME_DA_PARTE[parte]}`}
            placeholder={`Buscar em ${NOME_DA_PARTE[parte]}`}
            maxLength={NOME_DE_SOM_MAX}
            value={busca}
            onChange={(evento) => onBusca(evento.currentTarget.value)}
            onKeyDown={(evento) => {
              if (evento.key !== 'Escape' || busca === '') return
              // O Esc limpa a busca aqui, não a seleção do mapa.
              evento.preventDefault()
              evento.stopPropagation()
              onBusca('')
            }}
          />
        </div>
      )}
      {favoritos > 0 && (
        <button type="button" className="gr-chip lb-sons__chip" aria-pressed={soFavoritos} title="Mostrar só os favoritos" onClick={() => onFavoritos(!soFavoritos)}>
          <IconeDoLivro nome="estrela" />
          <span className="lb-sons__chip-nome">Favoritos</span>
          <small aria-label={favoritos === 1 ? '1 som' : `${favoritos} sons`}>{favoritos}</small>
        </button>
      )}
    </div>
  )
}

/**
 * Uma categoria: o cabeçalho abre e fecha (sem animar a altura: só a seta
 * gira, e a lista aparece inteira), o lápis do cabeçalho organiza (renomear,
 * apagar). Com busca ou Favoritos a categoria fica aberta e não fecha: o
 * filtro já escolheu o que mostrar.
 */
function CategoriaDeSons({
  grupo,
  aberta,
  onAlternar,
  organizando,
  onOrganizar,
  children,
}: {
  grupo: GrupoDeSons
  aberta: boolean
  /** Ausente = não fecha (filtrando). */
  onAlternar?: () => void
  organizando: boolean
  onOrganizar: () => void
  children: ReactNode
}) {
  const ids = useId()
  const nome = grupo.pasta?.nome ?? 'Sem categoria'
  const n = grupo.efeitos.length
  return (
    <section className={classes('lb-cat', !aberta && 'lb-cat--fechada')} aria-labelledby={`${ids}-titulo`}>
      <h3 className="lb-cat__titulo">
        <button type="button" id={`${ids}-titulo`} className="lb-cat__abrir" aria-expanded={aberta} aria-controls={`${ids}-lista`} disabled={onAlternar === undefined} onClick={onAlternar}>
          <IconeDoLivro nome="baixo" />
          <span className={classes('lb-cat__nome', grupo.pasta === null && 'lb-cat__nome--sem')} dir="auto">
            {nome}
          </span>
          <small className="lb-cat__conta" aria-label={n === 1 ? '1 som' : `${n} sons`}>
            {n}
          </small>
        </button>
        {grupo.pasta !== null && (
          <button type="button" className="lb-cat__organizar" aria-label={`Organizar a categoria ${nome}`} aria-expanded={organizando} title="Renomear ou apagar" onClick={onOrganizar}>
            <IconeLapis />
          </button>
        )}
      </h3>
      {organizando && grupo.pasta !== null && <AcoesDaPasta key={grupo.pasta.id} pasta={grupo.pasta} sons={n} onFechar={onOrganizar} />}
      <div id={`${ids}-lista`} hidden={!aberta}>
        {n > 0 ? (
          <ul className="lb-sons__lista" aria-label={`Sons de ${nome}`}>
            {children}
          </ul>
        ) : (
          <p className="lb-cat__vazia">Nenhum som aqui. No lápis de um som, escolha esta categoria.</p>
        )}
      </div>
    </section>
  )
}

/** "+ Nova categoria" no fim da parte: vira o campo do nome, Enter cria, Esc desiste. */
function NovaCategoria({ parte }: { parte: ParteDosSons }) {
  const [nome, setNome] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const campo = useRef<HTMLInputElement>(null)
  const botao = useRef<HTMLButtonElement>(null)
  const voltar = useRef(false)

  useEffect(() => {
    if (nome !== null) campo.current?.focus()
    else if (voltar.current) {
      voltar.current = false
      botao.current?.focus()
    }
  }, [nome !== null])

  const desistir = () => {
    setErro(null)
    voltar.current = true
    setNome(null)
  }

  const criar = () => {
    const pasta = useBibliotecaDeSonsStore.getState().criarPasta(nome ?? '', parte)
    if (pasta === null) {
      setErro(impedimentoDaLoja() ?? `Use um nome de 1 a ${NOME_DE_SOM_MAX} caracteres (no máximo 50 categorias nas duas partes).`)
      return
    }
    desistir()
  }

  if (nome === null)
    return (
      <button ref={botao} type="button" className="lb-sons__nova-cat" onClick={() => setNome('')}>
        <IconeDoLivro nome="mais" />
        Nova categoria em {NOME_DA_PARTE[parte]}
      </button>
    )
  return (
    <div className="lb-sons__pasta-acoes">
      <div className="lb-sons__pasta-form">
        <input
          ref={campo}
          className="gr-entrada"
          type="text"
          autoComplete="off"
          aria-label={`Nome da nova categoria em ${NOME_DA_PARTE[parte]}`}
          placeholder="Nome da categoria"
          maxLength={NOME_DE_SOM_MAX}
          value={nome}
          onChange={(evento) => setNome(evento.currentTarget.value)}
          onKeyDown={(evento) => {
            if (evento.key === 'Enter') {
              evento.preventDefault()
              criar()
            } else if (evento.key === 'Escape') {
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
          <Botao tamanho="p" variante="primario" onClick={criar}>
            Criar categoria
          </Botao>
        </div>
      </div>
      {erro !== null && (
        <p className="lb-sons__nota lb-sons__nota--erro" role="alert">
          {erro}
        </p>
      )}
    </div>
  )
}

/**
 * Renomear e apagar a categoria, aberto pelo lápis do cabeçalho dela (sem
 * isto, o nome errado ficava para sempre, contra o teto de 50 pastas). Só a
 * biblioteca muda: nada no disco além do `sons.json`. Apagada, os sons dela
 * ficam em Sem categoria, na mesma parte. Esc fecha.
 */
function AcoesDaPasta({ pasta, sons, onFechar }: { pasta: PastaDeSons; sons: number; onFechar: () => void }) {
  const [modo, setModo] = useState<'nada' | 'renomear' | 'apagar'>('nada')
  const [nome, setNome] = useState(pasta.nome)
  const [erro, setErro] = useState<string | null>(null)
  const campo = useRef<HTMLInputElement>(null)
  const cancelar = useRef<HTMLButtonElement>(null)
  const renomear = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (modo === 'renomear') {
      campo.current?.focus()
      campo.current?.select()
    } else if (modo === 'apagar') cancelar.current?.focus()
    // Aberto pelo lápis da categoria, e de volta do Renomear ou do Apagar: o foco na primeira ação.
    else renomear.current?.focus()
  }, [modo])

  const desistir = () => {
    setErro(null)
    setNome(pasta.nome)
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
      setErro(`A categoria não foi apagada. ${impedimentoDaLoja() ?? 'Ela já não existe.'}`)
      return
    }
    // Este bloco some com a categoria: o foco vai para a aba da parte, depois de o React desenhar.
    setTimeout(() => pagina?.querySelector<HTMLElement>('.lb-sons__aba[aria-selected="true"]')?.focus(), 0)
  }

  const sobreOsSons = sons === 0 ? 'Ela está vazia.' : sons === 1 ? 'O som dela vai para Sem categoria.' : `Os ${sons} sons dela vão para Sem categoria.`

  return (
    <div
      className="lb-sons__pasta-acoes"
      onKeyDown={(evento) => {
        if (evento.key !== 'Escape' || modo !== 'nada') return
        evento.preventDefault()
        evento.stopPropagation()
        onFechar()
      }}
    >
      {modo === 'renomear' ? (
        <div className="lb-sons__pasta-form">
          <input
            ref={campo}
            className="gr-entrada"
            type="text"
            autoComplete="off"
            aria-label="Novo nome da categoria"
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
        <div className="lb-sons__pasta-form" role="group" aria-label="Confirmar apagar categoria">
          <p className="lb-sons__nota">
            Apagar a categoria {pasta.nome}? {sobreOsSons}
          </p>
          <div className="gr-acoes">
            <Botao ref={cancelar} tamanho="p" onClick={desistir}>
              Cancelar
            </Botao>
            <Botao tamanho="p" variante="perigo" onClick={(evento) => apagar(evento.currentTarget)}>
              Apagar categoria
            </Botao>
          </div>
        </div>
      ) : (
        <div className="lb-sons__pasta-botoes">
          <Botao ref={renomear} tamanho="p" aria-label="Renomear categoria" onClick={() => setModo('renomear')}>
            <IconeLapis />
            Renomear
          </Botao>
          <Botao tamanho="p" aria-label="Apagar categoria…" onClick={() => setModo('apagar')}>
            <IconeDoLivro nome="lixo" />
            Apagar…
          </Botao>
          <Botao tamanho="p" className="gr-empurra" onClick={onFechar}>
            Fechar
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

function VazioDosSons({ semAventura, podeImportar, parte, onImportar }: { semAventura: boolean; podeImportar: boolean; parte: ParteDosSons; onImportar: () => void }) {
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
      <p className="lb-sons__vazio-texto">
        Importe MP3, WAV, OGG ou M4A de até 15 MB, ou cole um link do YouTube. Cada som vira uma linha que toca no clique; as teclas 1 a 9 tocam os que tiverem atalho. O que entrar agora vai para {NOME_DA_PARTE[parte]}.
      </p>
      <Botao variante="primario" disabled={!podeImportar} onClick={onImportar}>
        <IconeDoLivro nome="importar" />
        Importar sons
      </Botao>
    </div>
  )
}

function rotuloDoBotao(efeito: EfeitoDeSom, tocando: boolean): string {
  const partes = [efeito.nome]
  if (efeito.fonte.tipo === 'youtube') partes.push('pelo YouTube')
  if (efeito.atalho !== undefined) partes.push(`tecla ${efeito.atalho}`)
  if (efeito.loop) partes.push(tocando ? 'repetindo, toque para parar' : 'repete até parar')
  return partes.join(', ')
}

/**
 * O começo da linha: a miniatura do vídeo do YouTube (`mqdefault`, 320x180,
 * cortada em quadrado; preguiçosa, para 200 linhas não pedirem 200 imagens
 * de uma vez), ou o ícone da parte para o arquivo. A miniatura que não
 * carrega (sem internet, vídeo removido) vira o ícone, nunca um buraco. O
 * endereço só leva o id já conferido (`VideoDoYoutube`): nada colado pelo
 * mestre vai para o `src`.
 */
function MiniaturaDoSom({ efeito }: { efeito: EfeitoDeSom }) {
  const video = efeito.fonte.tipo === 'youtube' ? efeito.fonte.video : null
  const [falhou, setFalhou] = useState<string | null>(null)
  if (video !== null && falhou !== video)
    return (
      <img
        className="lb-efeito__mini"
        src={`https://i.ytimg.com/vi/${video}/mqdefault.jpg`}
        alt=""
        width={36}
        height={36}
        loading="lazy"
        decoding="async"
        draggable={false}
        referrerPolicy="no-referrer"
        onError={() => setFalhou(video)}
        // O vídeo que não existe (ou saiu do ar) responde 404 COM uma imagem cinza de 120 px, que o navegador mostra
        // sem erro; a miniatura de verdade tem 320. A cinza também vira o ícone.
        onLoad={(evento) => {
          if (evento.currentTarget.naturalWidth < MINIATURA_LARGURA_REAL) setFalhou(video)
        }}
      />
    )
  return <span className="lb-efeito__icone">{parteDe(efeito) === 'musicas' ? <IconeNota /> : <IconeOnda />}</span>
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
        {/* O selo: a miniatura do vídeo ou o ícone da parte, com a tecla no canto. É ele que pulsa no clique. */}
        <span className="lb-efeito__selo" ref={guardarSelo} aria-hidden="true">
          <MiniaturaDoSom efeito={efeito} />
          {efeito.atalho !== undefined && <span className="lb-efeito__tecla">{efeito.atalho}</span>}
        </span>
        <span className="lb-efeito__nome" dir="auto">
          {efeito.nome}
        </span>
        {efeito.favorito === true && (
          <span className="lb-efeito__favorito" aria-hidden="true">
            <IconeDoLivro nome="estrela" />
          </span>
        )}
        {/* O loop tocando diz o que o clique faz agora: para. */}
        {efeito.loop &&
          (tocando ? (
            <span className="lb-efeito__loop lb-efeito__loop--parar" aria-hidden="true">
              <IconeParar />
              parar
            </span>
          ) : (
            <span className="lb-efeito__loop" aria-hidden="true" title="Repete até parar">
              <IconeRepetir />
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

/**
 * O lápis: nome, tipo (Música ou Efeito sonoro), categoria, trecho de A até
 * B, volume, repetir, tecla, favorito e apagar. Cada mudança vale na hora (a
 * biblioteca grava sozinha).
 */
function EditorDoSom({
  efeito,
  biblioteca,
  motor,
  ponte,
  carregarAudio,
  tocando,
  onFechar,
}: {
  efeito: EfeitoDeSom
  biblioteca: BibliotecaDeSons
  motor: MotorAoVivo
  ponte: PonteDosSons
  carregarAudio: CarregadorDeBytes
  tocando: boolean
  onFechar: () => void
}) {
  const editar = useBibliotecaDeSonsStore((estado) => estado.editarEfeito)
  const [nome, setNome] = useState(efeito.nome)
  const [saiuDoNome, setSaiuDoNome] = useState(false)
  const [notaDoAtalho, setNotaDoAtalho] = useState<string | null>(null)
  const [notaDoTipo, setNotaDoTipo] = useState<string | null>(null)
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

  const parte = parteDe(efeito)
  const mudarTipo = (nova: ParteDosSons) => {
    if (nova === parte) return
    const tinhaCategoria = efeito.pastaId !== null
    setNovaPasta(null)
    setErroDaPasta(null)
    if (!mudar({ parte: nova })) return
    // As categorias são de cada parte: a de antes não vai junto.
    setNotaDoTipo(`Foi para ${NOME_DA_PARTE[nova]}${tinhaCategoria ? ', em Sem categoria (as categorias são de cada parte)' : ''}.`)
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
    const pasta = useBibliotecaDeSonsStore.getState().criarPasta(novaPasta ?? '', parte)
    if (pasta === null) {
      const impedimento = impedimentoDaLoja()
      if (impedimento !== null) setRecusa(`Nada mudou. ${impedimento}`)
      else setErroDaPasta(`Use um nome de 1 a ${NOME_DE_SOM_MAX} caracteres (no máximo 50 categorias nas duas partes).`)
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

  // Só as categorias da parte do som: a de outra parte não serve (o som e a categoria moram juntos).
  const pastas = biblioteca.pastas.filter((pasta) => parteDe(pasta) === parte).sort((a, b) => a.ordem - b.ordem)
  const opcoesDaPasta = [{ valor: SEM_PASTA, rotulo: 'Sem categoria' }, ...pastas.map((pasta) => ({ valor: pasta.id, rotulo: pasta.nome })), { valor: NOVA_PASTA, rotulo: 'Nova categoria…' }]
  const ouvir = () => (tocando ? ponte.parar(efeito.id) : motor.tocar(efeito.id, efeito.fonte, { loop: false, volumeDoEfeito: efeito.volume }))
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
      <CampoSeg
        rotulo="Tipo"
        opcoes={PARTES_DOS_SONS.map((qual) => ({ valor: qual, rotulo: TIPO_DO_SOM[qual], icone: qual === 'musicas' ? <IconeNota /> : <IconeOnda /> }))}
        valor={parte}
        onChange={mudarTipo}
      />
      {notaDoTipo !== null && (
        <p className="lb-sons__nota lb-sons__nota--latao" role="status">
          {notaDoTipo}
        </p>
      )}
      <CampoSel rotulo="Categoria" opcoes={opcoesDaPasta} valor={novaPasta !== null ? NOVA_PASTA : (efeito.pastaId ?? SEM_PASTA)} onChange={mudarPasta} />
      {novaPasta !== null && (
        <div className="lb-sons-editor__nova-pasta">
          <input
            className="gr-entrada"
            type="text"
            autoComplete="off"
            aria-label="Nome da nova categoria"
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
            Criar categoria
          </Botao>
        </div>
      )}
      {erroDaPasta !== null && (
        <p className="lb-sons__nota lb-sons__nota--erro" role="alert">
          {erroDaPasta}
        </p>
      )}
      {/* Ouvir dá UMA passada do trecho no volume de agora (mesmo o loop: provar não liga o ambiente). Só do mestre; Parar alcança a mesa. */}
      <EditorDoTrecho key={efeito.fonte.tipo === 'arquivo' ? efeito.fonte.ref : efeito.fonte.video} efeito={efeito} carregar={carregarAudio} tocando={tocando} onOuvir={ouvir} onMudar={(trecho) => mudar({ trecho })} />
      <CampoFaixa rotulo="Volume" min={0} max={100} unidade="%" valor={Math.round(efeito.volume * 100)} onChange={mudarVolume} />
      <CampoLiga rotulo="Repetir até parar" ajuda="Para ambiente: chuva, taverna, vento. Com trecho, repete de A até B. Vale no próximo toque." ligado={efeito.loop} onChange={(loop) => mudar({ loop })} />
      <CampoSel rotulo="Tecla de atalho" opcoes={opcoesDoAtalho} valor={efeito.atalho === undefined ? SEM_ATALHO : String(efeito.atalho)} onChange={mudarAtalho} />
      {notaDoAtalho !== null && (
        <p className="lb-sons__nota lb-sons__nota--latao" role="status">
          {notaDoAtalho}
        </p>
      )}
      <CampoLiga rotulo="Favorito" ajuda="Com o filtro Favoritos ligado, no alto da parte, só eles aparecem." ligado={efeito.favorito === true} onChange={(favorito) => mudar({ favorito })} />
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

function IconeLink() {
  return <IconeSvg d="M10 13.5a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1.5 1.5 M14 10.5a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1.5-1.5" />
}

function IconeParar() {
  return <IconeSvg d="M7 7h10v10H7z" />
}

function IconeLapis() {
  return <IconeSvg d="M14.5 5.5l4 4 M5 19l1-4.5L15.5 5a1.4 1.4 0 0 1 2 0l1.5 1.5a1.4 1.4 0 0 1 0 2L9.5 18z" />
}

/** Música: a colcheia dupla. */
function IconeNota() {
  return <IconeSvg d="M9 18V6.5l10-2.5V15.5 M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z M19 15.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z M9 10l10-2.5" />
}

/** Efeito sonoro: a onda curta. */
function IconeOnda() {
  return <IconeSvg d="M3.5 12h1.5 M7.5 9v6 M11 5.5v13 M14.5 8.5v7 M18 10.5v3 M20.5 12h0" />
}

function IconeRepetir() {
  return <IconeSvg d="M17 4.5l2.5 2.5L17 9.5 M19.5 7H8a3.5 3.5 0 0 0-3.5 3.5v1 M7 19.5L4.5 17 7 14.5 M4.5 17H16a3.5 3.5 0 0 0 3.5-3.5v-1" />
}
