import { create } from 'zustand'
import { useAdventureStore } from './adventureStore'
import { useToastStore } from './toastStore'
import {
  bibliotecaDeSonsVazia,
  comBibliotecaJuntada,
  comCategoriasSugeridas,
  comEfeitoMudado,
  comEfeitoNovo,
  comPastaNova,
  comPastaRenomeada,
  nomeDeSomDoArquivo,
  semEfeito,
  semPasta,
  type BibliotecaDeSons,
  type EfeitoDeSom,
  type EfeitoNovo,
  type MudancaNoEfeito,
  type ParteDosSons,
  type PastaDeSons,
} from '../lib/sons/biblioteca'
import { gravarBibliotecaGlobal, guardarArquivoDeSom, lerBibliotecaGlobal, prepararPastaDaBiblioteca } from '../lib/sons/bibliotecaNoDisco'
import {
  anotarAventurasMigradas,
  chaveDaPastaDaAventura,
  lerAventurasMigradas,
  pastasDasAventurasDoApp,
  prepararAventuraParaMigrar,
  type AventuraParaMigrar,
} from '../lib/sons/migracaoDosSons'

/**
 * A BIBLIOTECA DE SONS na memória (Sistema 4, sons ao vivo), GLOBAL DO APP
 * desde 29/10/2026: uma só, com Músicas e Efeitos sonoros, em qualquer
 * aventura aberta (e no mapa solto). É CONFIGURAÇÃO, não mapa: grava sozinha
 * `ESPERA_PARA_GRAVAR_SONS_MS` depois da última mudança, nunca entra no
 * Ctrl+Z e nunca deixa o mapa "não salvo" — não toca no `mapStore`, no
 * `sessionStore` nem no `adventureStore`.
 *
 * `ligarBibliotecaGlobal` (quem monta a aba Sons liga uma vez) lê
 * `<appData>/sons/sons.json` e migra para ela, uma vez cada, o `sons.json`
 * das aventuras de `<appData>/maps` e o da aventura aberta; a aventura aberta
 * depois, de qualquer pasta, migra quando abre (`migracaoDosSons.ts`). A
 * biblioteca gravável ganha as categorias sugeridas de cada parte
 * (`comCategoriasSugeridas`, uma vez por biblioteca) DEPOIS da migração: a
 * sugerida que o mestre apagou numa aventura não volta.
 */

/** Quanto a biblioteca espera parada antes de ir para o disco. */
export const ESPERA_PARA_GRAVAR_SONS_MS = 400

export const SONS_AINDA_LENDO = 'A biblioteca de sons ainda está sendo lida. Tente de novo em instantes.'
export const SONS_NAO_GRAVAVEIS = 'A biblioteca de sons não pôde ser lida, então nada novo é guardado para não apagar o que está lá.'
const SONS_SEM_PASTA = 'Não foi possível abrir a pasta da biblioteca de sons (o disco recusou). Nada novo é guardado até o app abrir de novo.'
/** Avisos de som ficam como os de mídia: pedem leitura, não ação. */
const AVISO_DE_MIGRACAO_MS = 7000

interface BibliotecaDeSonsState {
  biblioteca: BibliotecaDeSons
  /** `<appData>/sons`, a pasta da biblioteca; `null` = ainda não lida (ou o disco recusou). A sala serve `/sons/<id>` de dentro dela. */
  pasta: string | null
  /** Lendo (e migrando) a biblioteca: mudar agora se perderia. Nasce `true`: nada muda antes da primeira leitura. */
  carregando: boolean
  /** Há mudança que ainda não foi para o disco. */
  pendente: boolean
  /** Leitura ou gravação que deu errado, em frase pronta; `null` = tudo certo. */
  aviso: string | null
  /** `false` = o `sons.json` existe e não foi lido: gravar passaria por cima dele. */
  podeGravar: boolean

  /** Lê a biblioteca global e migra as aventuras; a chamada seguinte devolve a mesma promessa (sem pasta lida, lê de novo). Nunca rejeita. */
  carregar: () => Promise<void>
  /** Traz o `sons.json` da aventura de `pastaDaAventura`, se ela ainda não migrou. Nunca rejeita. */
  migrarAventura: (pastaDaAventura: string) => Promise<void>
  /** Efeito novo no fim; `null` = recusado (dado inválido, 200 efeitos, lendo, sem poder gravar). */
  adicionarEfeito: (novo: EfeitoNovo) => EfeitoDeSom | null
  /**
   * O arquivo de áudio escolhido vira efeito: gravado direto em
   * `<appData>/sons/midia` (fora do `/media` sem chave da sala). Lança com a
   * frase pronta (`AUDIO_GRANDE_DEMAIS`, `AUDIO_NAO_E_AUDIO`, `SONS_AINDA_LENDO`...).
   */
  importarArquivoDeSom: (nomeDoArquivo: string, bytes: Uint8Array, parte?: ParteDosSons) => Promise<EfeitoDeSom>
  /** `false` = recusado (efeito que não existe ou campo inválido). Atalho dado a outro sai de quem tinha. */
  editarEfeito: (id: string, mudanca: MudancaNoEfeito) => boolean
  apagarEfeito: (id: string) => boolean
  /** Categoria nova no fim da `parte` (padrão: Efeitos sonoros). */
  criarPasta: (nome: string, parte?: ParteDosSons) => PastaDeSons | null
  renomearPasta: (id: string, nome: string) => boolean
  /** Os efeitos da pasta vão para a raiz. */
  apagarPasta: (id: string) => boolean
  /** Grava já o que está esperando (sem poder gravar, continua esperando). Nunca rejeita. */
  gravarAgora: () => Promise<void>
}

/** O relógio do salvamento sozinho: um só, recomeça a cada mudança. */
let temporizador: ReturnType<typeof setTimeout> | null = null
/** A leitura da biblioteca: uma só enquanto corre e depois de dar certo. */
let carga: Promise<void> | null = null
let cargaTerminou = false

function pararRelogio(): void {
  if (temporizador === null) return
  clearTimeout(temporizador)
  temporizador = null
}

function mensagem(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

/** O que a migração deixou de fora, num aviso só; nada de fora = sem aviso. */
function avisarDoQueFicouDeFora(naoCouberam: number, audiosQueFaltaram: number): void {
  const partes: string[] = []
  if (naoCouberam > 0) partes.push(naoCouberam === 1 ? '1 som das aventuras não coube na biblioteca (o teto é de 200 sons)' : `${naoCouberam} sons das aventuras não couberam na biblioteca (o teto é de 200 sons)`)
  if (audiosQueFaltaram > 0) partes.push(audiosQueFaltaram === 1 ? '1 arquivo de áudio não foi achado neste computador e não toca' : `${audiosQueFaltaram} arquivos de áudio não foram achados neste computador e não tocam`)
  if (partes.length === 0) return
  useToastStore.getState().push('info', `${partes.join('; ')}. O sons.json de cada aventura continua na pasta dela.`, AVISO_DE_MIGRACAO_MS, { chave: 'sons-migracao' })
}

export const useBibliotecaDeSonsStore = create<BibliotecaDeSonsState>()((set, get) => {
  /** Por que não dá para mudar agora; `null` = dá. */
  const impedimento = (): string | null => {
    const { carregando, podeGravar } = get()
    if (carregando) return SONS_AINDA_LENDO
    return podeGravar ? null : SONS_NAO_GRAVAVEIS
  }

  /** Troca a biblioteca e recomeça o relógio do salvamento. */
  const aplicar = (proxima: BibliotecaDeSons): void => {
    set({ biblioteca: proxima, pendente: true })
    pararRelogio()
    temporizador = setTimeout(() => {
      temporizador = null
      void get().gravarAgora() // nunca rejeita: o erro vira `aviso`
    }, ESPERA_PARA_GRAVAR_SONS_MS)
  }

  /** Aplica a mudança pura se ela não foi recusada. */
  const mudar = (proxima: BibliotecaDeSons | null): boolean => {
    if (impedimento() !== null || proxima === null) return false
    aplicar(proxima)
    return true
  }

  /** Grava a biblioteca de agora e, só se ela gravou, anota as aventuras migradas. Nunca rejeita. */
  const gravarComAsMigradas = async (chaves: readonly string[]): Promise<void> => {
    pararRelogio()
    set({ pendente: false })
    try {
      await gravarBibliotecaGlobal(get().biblioteca, async () => {
        try {
          await anotarAventurasMigradas(chaves)
        } catch {
          // Sem a nota, a próxima abertura migra de novo: nada se repete (`comBibliotecaJuntada`), só o som apagado voltaria.
        }
      })
      set({ aviso: null })
    } catch (erro) {
      set({ pendente: true, aviso: mensagem(erro) })
    }
  }

  /** Junta as aventuras na biblioteca de agora (a mudança feita enquanto o disco lia não se perde). */
  const juntar = (aventuras: readonly AventuraParaMigrar[]): void => {
    let biblioteca = get().biblioteca
    let naoCouberam = 0
    let audiosQueFaltaram = 0
    for (const aventura of aventuras) {
      const juntada = comBibliotecaJuntada(biblioteca, aventura.origem)
      biblioteca = juntada.biblioteca
      naoCouberam += juntada.naoCouberam
      audiosQueFaltaram += aventura.audiosQueFaltaram
    }
    set({ biblioteca })
    avisarDoQueFicouDeFora(naoCouberam, audiosQueFaltaram)
  }

  const carregarAgora = async (): Promise<void> => {
    let pasta: string
    try {
      pasta = await prepararPastaDaBiblioteca()
    } catch {
      set({ carregando: false, podeGravar: false, aviso: SONS_SEM_PASTA })
      return
    }
    const lida = await lerBibliotecaGlobal()
    if (!lida.podeGravar) {
      // Sugestões só na biblioteca que se pode gravar: a que não foi lida mostra o vazio, não categorias de mentira.
      set({ biblioteca: lida.biblioteca, pasta, carregando: false, aviso: lida.aviso, podeGravar: false })
      return
    }
    const jaMigradas = await lerAventurasMigradas()
    const aberta = useAdventureStore.getState().dir
    const candidatas = [...(await pastasDasAventurasDoApp()), ...(aberta === null ? [] : [aberta])]
    const vistas = new Set<string>()
    const aventuras: AventuraParaMigrar[] = []
    // Uma por vez: cada uma pode levar áudios de até 15 MB, e isto corre uma vez por aventura.
    for (const candidata of candidatas) {
      const chave = chaveDaPastaDaAventura(candidata)
      if (jaMigradas.has(chave) || vistas.has(chave)) continue
      vistas.add(chave)
      const preparada = await prepararAventuraParaMigrar(candidata)
      if (preparada !== null) aventuras.push(preparada)
    }
    set({ biblioteca: lida.biblioteca, pasta, aviso: lida.aviso, podeGravar: true })
    juntar(aventuras)
    set({ biblioteca: comCategoriasSugeridas(get().biblioteca), carregando: false })
    // As sugestões sozinhas só vão para o disco com a próxima mudança do mestre; a migração vai já.
    if (aventuras.length > 0) await gravarComAsMigradas(aventuras.map((aventura) => aventura.chave))
  }

  return {
    biblioteca: bibliotecaDeSonsVazia(),
    pasta: null,
    carregando: true,
    pendente: false,
    aviso: null,
    podeGravar: false,

    carregar: () => {
      // Correndo, ou já lida: a mesma promessa. Terminada sem pasta (o disco recusou, ou o estado recomeçou): lê de novo.
      if (carga !== null && (!cargaTerminou || get().pasta !== null)) return carga
      cargaTerminou = false
      carga = carregarAgora().finally(() => {
        cargaTerminou = true
      })
      return carga
    },

    migrarAventura: async (pastaDaAventura) => {
      await get().carregar()
      const chave = chaveDaPastaDaAventura(pastaDaAventura)
      if (!get().podeGravar || (await lerAventurasMigradas()).has(chave)) return
      const preparada = await prepararAventuraParaMigrar(pastaDaAventura)
      if (preparada === null || !get().podeGravar) return
      juntar([preparada])
      await gravarComAsMigradas([chave])
    },

    gravarAgora: async () => {
      pararRelogio()
      const { biblioteca, pendente, podeGravar } = get()
      if (!pendente || !podeGravar) return
      set({ pendente: false })
      try {
        await gravarBibliotecaGlobal(biblioteca)
        set({ aviso: null })
      } catch (erro) {
        // Continua esperando: a próxima mudança tenta de novo.
        set({ pendente: true, aviso: mensagem(erro) })
      }
    },

    adicionarEfeito: (novo) => {
      if (impedimento() !== null) return null
      const resultado = comEfeitoNovo(get().biblioteca, novo)
      if (resultado === null) return null
      aplicar(resultado.biblioteca)
      return resultado.efeito
    },

    importarArquivoDeSom: async (nomeDoArquivo, bytes, parte) => {
      const antes = impedimento()
      if (antes !== null) throw new Error(antes)
      const fonte = await guardarArquivoDeSom(bytes)
      const depois = impedimento()
      if (depois !== null) throw new Error(depois)
      const efeito = get().adicionarEfeito({ nome: nomeDeSomDoArquivo(nomeDoArquivo), fonte, ...(parte === undefined ? {} : { parte }) })
      if (efeito === null) throw new Error('A biblioteca de sons está cheia (200 efeitos).')
      return efeito
    },

    editarEfeito: (id, mudanca) => mudar(comEfeitoMudado(get().biblioteca, id, mudanca)),
    apagarEfeito: (id) => mudar(semEfeito(get().biblioteca, id)),

    criarPasta: (nome, parte) => {
      if (impedimento() !== null) return null
      const resultado = comPastaNova(get().biblioteca, nome, undefined, parte)
      if (resultado === null) return null
      aplicar(resultado.biblioteca)
      return resultado.pasta
    },

    renomearPasta: (id, nome) => mudar(comPastaRenomeada(get().biblioteca, id, nome)),
    apagarPasta: (id) => mudar(semPasta(get().biblioteca, id)),
  }
})

/**
 * Liga a biblioteca global: a primeira leitura (com a migração) e, a cada
 * aventura aberta depois, a migração dela. Devolve o desligar (para o
 * `useEffect` de quem monta a aba Sons, que fica sempre montada).
 */
export function ligarBibliotecaGlobal(): () => void {
  void useBibliotecaDeSonsStore.getState().carregar() // nunca rejeita
  return useAdventureStore.subscribe((estado, anterior) => {
    if (estado.dir !== null && estado.dir !== anterior.dir) void useBibliotecaDeSonsStore.getState().migrarAventura(estado.dir) // nunca rejeita
  })
}
