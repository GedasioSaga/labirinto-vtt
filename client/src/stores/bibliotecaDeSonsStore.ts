import { create } from 'zustand'
import { useAdventureStore } from './adventureStore'
import {
  bibliotecaDeSonsVazia,
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
  type PastaDeSons,
} from '../lib/sons/biblioteca'
import { gravarBibliotecaNaAventura, guardarArquivoDeSom, lerBibliotecaDaAventura } from '../lib/sons/bibliotecaNoDisco'

/**
 * A BIBLIOTECA DE SONS da aventura aberta, na memória (Sistema 4, sons ao
 * vivo). É CONFIGURAÇÃO, não mapa: grava sozinha `ESPERA_PARA_GRAVAR_SONS_MS`
 * depois da última mudança, nunca entra no Ctrl+Z e nunca deixa o mapa "não
 * salvo" — não toca no `mapStore`, no `sessionStore` nem no `adventureStore`.
 *
 * Segue a aventura do `adventureStore` por `ligarBibliotecaAAventura` (quem
 * monta a aba Sons liga uma vez):
 *  - aventura aberta do disco: lê o `sons.json` dela (sem ele, vazia);
 *  - aventura nova, ainda sem pasta: guarda na memória e grava quando a
 *    primeira gravação da aventura der a pasta (`dir` aparece, mesmo id);
 *  - mapa solto: sem biblioteca (a aba pede para salvar como aventura).
 * Trocar de aventura com mudança esperando grava antes na pasta da anterior.
 */

/** Quanto a biblioteca espera parada antes de ir para o disco. */
export const ESPERA_PARA_GRAVAR_SONS_MS = 400

export const SONS_SEM_AVENTURA = 'Salve como aventura para guardar sons aqui.'
export const SONS_AINDA_LENDO = 'Os sons desta aventura ainda estão sendo lidos. Tente de novo em instantes.'
export const SONS_NAO_GRAVAVEIS = 'Os sons desta aventura não puderam ser lidos, então nada novo é guardado para não apagar o que está lá.'

interface BibliotecaDeSonsState {
  biblioteca: BibliotecaDeSons
  /** A aventura dona da biblioteca; `null` = mapa solto (fora da v1). */
  aventuraId: string | null
  /** Pasta onde grava; `null` com aventura = aventura nova, ainda sem pasta: fica na memória. */
  dir: string | null
  /** Lendo o `sons.json` da aventura que acabou de abrir: mudar agora se perderia. */
  carregando: boolean
  /** Há mudança que ainda não foi para o disco. */
  pendente: boolean
  /** Leitura ou gravação que deu errado, em frase pronta; `null` = tudo certo. */
  aviso: string | null
  /** `false` = o `sons.json` existe e não foi lido (ou não há aventura): gravar passaria por cima dele. */
  podeGravar: boolean

  /** Segue a aventura aberta. Nunca rejeita. Quem chama no app é `ligarBibliotecaAAventura`. */
  sincronizarComAAventura: (aventuraId: string | null, dir: string | null) => Promise<void>
  /** Efeito novo no fim; `null` = recusado (dado inválido, 200 efeitos, sem aventura, lendo). */
  adicionarEfeito: (novo: EfeitoNovo) => EfeitoDeSom | null
  /**
   * O arquivo de áudio escolhido vira efeito: guardado em `<appData>/midia` e,
   * na próxima gravação, levado para a pasta da aventura. Lança com a frase
   * pronta (`AUDIO_GRANDE_DEMAIS`, `AUDIO_NAO_E_AUDIO`, `SONS_SEM_AVENTURA`...).
   */
  importarArquivoDeSom: (nomeDoArquivo: string, bytes: Uint8Array) => Promise<EfeitoDeSom>
  /** `false` = recusado (efeito que não existe ou campo inválido). Atalho dado a outro sai de quem tinha. */
  editarEfeito: (id: string, mudanca: MudancaNoEfeito) => boolean
  apagarEfeito: (id: string) => boolean
  criarPasta: (nome: string) => PastaDeSons | null
  renomearPasta: (id: string, nome: string) => boolean
  /** Os efeitos da pasta vão para a raiz. */
  apagarPasta: (id: string) => boolean
  /** Grava já o que está esperando (sem pasta, ou sem poder gravar, continua esperando). Nunca rejeita. */
  gravarAgora: () => Promise<void>
}

/** O relógio do salvamento sozinho: um só, recomeça a cada mudança. */
let temporizador: ReturnType<typeof setTimeout> | null = null
/** Cada troca de aventura ganha um número: a leitura que chega depois de outra troca é descartada. */
let geracao = 0

function pararRelogio(): void {
  if (temporizador === null) return
  clearTimeout(temporizador)
  temporizador = null
}

function mensagem(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

const ESTADO_SEM_AVENTURA = {
  biblioteca: bibliotecaDeSonsVazia(),
  aventuraId: null,
  dir: null,
  carregando: false,
  pendente: false,
  aviso: null,
  podeGravar: false,
} satisfies Partial<BibliotecaDeSonsState>

export const useBibliotecaDeSonsStore = create<BibliotecaDeSonsState>()((set, get) => {
  /** Por que não dá para mudar agora; `null` = dá. */
  const impedimento = (): string | null => {
    const { aventuraId, carregando, podeGravar } = get()
    if (aventuraId === null) return SONS_SEM_AVENTURA
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

  return {
    ...ESTADO_SEM_AVENTURA,

    gravarAgora: async () => {
      pararRelogio()
      const { biblioteca, dir, pendente, podeGravar, aventuraId } = get()
      if (!pendente || dir === null || !podeGravar) return
      set({ pendente: false })
      try {
        await gravarBibliotecaNaAventura(dir, biblioteca)
        if (get().aventuraId === aventuraId) set({ aviso: null })
      } catch (erro) {
        // Continua esperando só se ainda é a mesma aventura na mesma pasta; a próxima mudança tenta de novo.
        if (get().aventuraId === aventuraId && get().dir === dir) set({ pendente: true, aviso: mensagem(erro) })
      }
    },

    sincronizarComAAventura: async (aventuraId, dir) => {
      const atual = get()
      if (aventuraId !== null && aventuraId === atual.aventuraId) {
        if (dir === atual.dir) return
        // A aventura nova ganhou pasta, ou foi para outra (Salvar como): a biblioteca vai junto.
        const temConteudo = atual.biblioteca.efeitos.length > 0 || atual.biblioteca.pastas.length > 0
        set({ dir, pendente: atual.pendente || (dir !== null && temConteudo) })
        await get().gravarAgora()
        return
      }

      const minha = ++geracao
      // O que estava esperando vai para a pasta da aventura anterior antes de trocar.
      await get().gravarAgora()
      if (minha !== geracao) return
      pararRelogio()
      if (aventuraId === null) {
        set({ ...ESTADO_SEM_AVENTURA, biblioteca: bibliotecaDeSonsVazia() })
        return
      }
      if (dir === null) {
        set({ ...ESTADO_SEM_AVENTURA, biblioteca: bibliotecaDeSonsVazia(), aventuraId, podeGravar: true })
        return
      }
      set({ ...ESTADO_SEM_AVENTURA, biblioteca: bibliotecaDeSonsVazia(), aventuraId, dir, carregando: true })
      const lida = await lerBibliotecaDaAventura(dir)
      if (minha !== geracao) return
      set({ biblioteca: lida.biblioteca, carregando: false, aviso: lida.aviso, podeGravar: lida.podeGravar })
    },

    adicionarEfeito: (novo) => {
      if (impedimento() !== null) return null
      const resultado = comEfeitoNovo(get().biblioteca, novo)
      if (resultado === null) return null
      aplicar(resultado.biblioteca)
      return resultado.efeito
    },

    importarArquivoDeSom: async (nomeDoArquivo, bytes) => {
      const antes = impedimento()
      if (antes !== null) throw new Error(antes)
      const fonte = await guardarArquivoDeSom(bytes)
      // A aventura pode ter trocado enquanto o disco gravava o áudio: o efeito não vai para a outra.
      const depois = impedimento()
      if (depois !== null) throw new Error(depois)
      const efeito = get().adicionarEfeito({ nome: nomeDeSomDoArquivo(nomeDoArquivo), fonte })
      if (efeito === null) throw new Error('A biblioteca de sons está cheia (200 efeitos).')
      return efeito
    },

    editarEfeito: (id, mudanca) => mudar(comEfeitoMudado(get().biblioteca, id, mudanca)),
    apagarEfeito: (id) => mudar(semEfeito(get().biblioteca, id)),

    criarPasta: (nome) => {
      if (impedimento() !== null) return null
      const resultado = comPastaNova(get().biblioteca, nome)
      if (resultado === null) return null
      aplicar(resultado.biblioteca)
      return resultado.pasta
    },

    renomearPasta: (id, nome) => mudar(comPastaRenomeada(get().biblioteca, id, nome)),
    apagarPasta: (id) => mudar(semPasta(get().biblioteca, id)),
  }
})

/**
 * Liga a biblioteca à aventura aberta: sincroniza com a de agora e com cada
 * troca de aventura ou de pasta. Devolve o desligar (para o `useEffect` de
 * quem monta a aba Sons, que fica sempre montada).
 */
export function ligarBibliotecaAAventura(): () => void {
  const sincronizar = (aventuraId: string | null, dir: string | null): void => {
    void useBibliotecaDeSonsStore.getState().sincronizarComAAventura(aventuraId, dir) // nunca rejeita
  }
  const inicial = useAdventureStore.getState()
  // `adventure` nulo é o mapa solto, caso legítimo: sem aventura, sem id.
  sincronizar(inicial.adventure?.id ?? null, inicial.dir)
  return useAdventureStore.subscribe((estado, anterior) => {
    const id = estado.adventure?.id ?? null
    if (id !== (anterior.adventure?.id ?? null) || estado.dir !== anterior.dir) sincronizar(id, estado.dir)
  })
}
