import type { BatalhaSalva, TextoDaBatalhaSalva } from '../lib/batalha/batalhaSalva'
import type { MesaDaBatalha } from '../lib/batalha/mesa'
import { formasQueDesligamNoFim } from '../lib/batalha/transformacao'
import { useAdventureStore } from './adventureStore'
import type { BatalhaDaCena, LojaDaBatalha } from './batalhaFabrica'
import { useMapStore } from './mapStore'

/**
 * A BATALHA SALVA DA MESA DE VERDADE (conserto das fichas F1, fatia S5; P8 do
 * grilling): enquanto a batalha anda, cada mudança dela vai, em até
 * `BATALHA_SALVA_INTERVALO_MS`, para `batalha-em-andamento.json` na pasta da
 * aventura aberta (ou do mapa solto). Ao abrir uma mesa com batalha salva que
 * não está na memória, o App pergunta "Retomar a batalha" ou "Encerrar"
 * (`aoOfertar`); enquanto o mestre não responde, nada grava por cima dela.
 * A batalha acabou (Encerrar, ou o `desligar` de sempre): o arquivo sai.
 *
 * Os jogadores não precisam de nada novo: a cena volta à store, o App avisa as
 * pontes (`deveAvisarJogadores`) e quem reconecta lê a cena pela
 * `ponteDaBatalha`, como em qualquer batalha.
 *
 * Disco, lugar e store entram por parâmetro (o teste usa dublês); o App liga
 * com `lugarDaAventura`, `assinarLugarDaAventura` e `batalhaSalvaNoDisco.ts`.
 */

/** Uma mudança da batalha chega ao disco em até 1 s: fechar o app perde no máximo isso. */
export const BATALHA_SALVA_INTERVALO_MS = 1000

const AVISO_DA_VERSAO = 'A batalha guardada nesta mesa foi gravada por uma versão mais nova do app: atualize o app para retomá-la.'
const AVISO_DO_ILEGIVEL = 'A batalha guardada nesta mesa estava estragada e não pôde voltar.'

/** Onde a mesa aberta guarda a batalha. */
export interface LugarDaMesa {
  /** A pasta da aventura (ou do mapa solto), dentro de `<appData>/maps`. */
  pasta: string
  /** O id da aventura, ou o do mapa solto. */
  mesaId: string
  /** As cenas desta mesa: chave da cena → nome para o mestre. */
  cenas: ReadonlyMap<string, string>
}

/** O disco (em produção, `lib/batalha/batalhaSalvaNoDisco.ts`). Cada operação lança o erro do disco. */
export interface DiscoDaBatalhaSalva {
  ler: (pasta: string) => Promise<TextoDaBatalhaSalva | null>
  gravar: (pasta: string, salva: BatalhaSalva) => Promise<void>
  apagar: (pasta: string) => Promise<void>
}

/** O mapa solto aberto: o caminho do `map.json` e o id do mapa quando o caminho chegou. */
export interface MapaSolto {
  caminho: string
  mapaId: string
}

export interface CenaOferecida {
  nome: string
  rodada: number
}

/** O que a pergunta "Retomar a batalha?" mostra. */
export interface OfertaDaBatalhaSalva {
  cenas: readonly CenaOferecida[]
  salvaEm: number
}

export interface OpcoesDaBatalhaSalva {
  loja: Pick<LojaDaBatalha, 'getState' | 'subscribe'>
  /** Para os avisos "fulano saiu da forma" do Encerrar. */
  mesa: Pick<MesaDaBatalha, 'personagens' | 'sistema'>
  disco: DiscoDaBatalhaSalva
  /** A mesa aberta agora; `null` = não há onde guardar (aventura nunca salva, mapa sem arquivo). */
  lugar: (mapaSolto: MapaSolto | null) => LugarDaMesa | null
  /** Chama `aoMudar` quando a mesa aberta pode ter mudado. Devolve o cancelamento. */
  assinarLugar: (aoMudar: () => void) => () => void
  /** A pergunta aparece (oferta) ou some (`null`). */
  aoOfertar: (oferta: OfertaDaBatalhaSalva | null) => void
  aoAvisar: (texto: string) => void
  /** Primeira falha de disco de uma sequência (`acao` = "guardar a batalha em andamento"...). */
  aoFalhar: (acao: string, erro: unknown) => void
  intervaloMs?: number
  agora?: () => number
}

export interface BatalhaSalvaNaMesa {
  /** O App avisa o caminho do mapa solto aberto (e o id do mapa naquele instante); `null` = mapa sem arquivo. */
  definirMapaSolto: (caminho: string | null, mapaId: string) => void
  /** "Retomar a batalha": as cenas salvas voltam à store. */
  retomar: () => void
  /** "Encerrar": o fim da batalha nas fichas e o arquivo sai. Devolve os avisos das formas que desligaram. */
  encerrar: () => readonly string[]
  /** Grava o que falta e para de ouvir. */
  parar: () => void
  /** Resolve quando a última operação de disco enfileirada terminar. */
  ocioso: () => Promise<void>
}

function chaveDoLugar(lugar: LugarDaMesa): string {
  return `${lugar.pasta}\n${lugar.mesaId}`
}

/** O id de cada personagem da batalha (na ordem ou com combate), como o Encerrar do livro lê. */
function personagensDaBatalha(cena: BatalhaDaCena): string[] {
  return [...cena.turnos.cartas.flatMap((carta) => (carta.personagemId === null ? [] : [carta.personagemId])), ...Object.keys(cena.turnos.combate ?? {})]
}

export function iniciarBatalhaSalva(opcoes: OpcoesDaBatalhaSalva): BatalhaSalvaNaMesa {
  const { loja, mesa, disco, lugar: lugarDe, assinarLugar, aoOfertar, aoAvisar, aoFalhar, intervaloMs = BATALHA_SALVA_INTERVALO_MS, agora = Date.now } = opcoes
  let mapaSolto: MapaSolto | null = null
  /** A mesa de agora, com as cenas lidas na última conferência. */
  let atual: LugarDaMesa | null = null
  /** A mesa cujo arquivo está sendo lido: nada grava por cima antes de saber o que havia nele. */
  let lendo: string | null = null
  /** A pergunta em aberto: o arquivo dela fica intocado até a resposta. */
  let pendente: { chave: string; salva: BatalhaSalva } | null = null
  /** Mesas com arquivo de um app mais novo: nunca se grava por cima. */
  const barradas = new Set<string>()
  /** Mesas com arquivo no disco (gravado aqui ou achado na abertura): a batalha que acaba o apaga. */
  const comArquivo = new Set<string>()
  let timer: ReturnType<typeof setTimeout> | null = null
  let parado = false
  let falhando = false
  // Uma operação de disco depois da outra: a gravação mais nova nunca é passada para trás por uma mais velha.
  let fila: Promise<void> = Promise.resolve()

  const naFila = (acao: string, operacao: () => Promise<void>): void => {
    fila = fila.then(operacao).then(
      () => {
        falhando = false
      },
      (erro: unknown) => {
        if (!falhando) aoFalhar(acao, erro)
        falhando = true
      },
    )
  }

  const cenasDoLugar = (lugar: LugarDaMesa): Record<string, BatalhaDaCena> => {
    const { cenas } = loja.getState()
    return Object.fromEntries(Object.entries(cenas).filter(([sceneKey]) => lugar.cenas.has(sceneKey)))
  }

  /** Guarda a batalha das cenas de `lugar` (ou apaga o arquivo, se ela acabou). */
  const gravar = (lugar: LugarDaMesa | null): void => {
    if (lugar === null) return
    const chave = chaveDoLugar(lugar)
    if (chave === lendo || pendente?.chave === chave || barradas.has(chave)) return
    const cenas = cenasDoLugar(lugar)
    if (Object.keys(cenas).length === 0) {
      if (!comArquivo.delete(chave)) return
      naFila('apagar a batalha guardada', () => disco.apagar(lugar.pasta))
      return
    }
    comArquivo.add(chave)
    const salva: BatalhaSalva = { mesaId: lugar.mesaId, salvaEm: agora(), cenas }
    naFila('guardar a batalha em andamento', () => disco.gravar(lugar.pasta, salva))
  }

  const cancelarTimer = (): void => {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }

  const gravarAgora = (): void => {
    cancelarTimer()
    gravar(atual)
  }

  const agendar = (): void => {
    if (parado || timer !== null) return
    timer = setTimeout(() => {
      timer = null
      gravar(atual)
    }, intervaloMs)
  }

  const ofertaDe = (lugar: LugarDaMesa, salva: BatalhaSalva): OfertaDaBatalhaSalva => ({
    cenas: Object.entries(salva.cenas).map(([sceneKey, cena]) => ({ nome: lugar.cenas.get(sceneKey) ?? 'Cena sem nome', rodada: cena.turnos.rodada })),
    salvaEm: salva.salvaEm,
  })

  /** Acabou de ler o arquivo da mesa `chave`: oferece o que não está na memória, ou só segue gravando. */
  const aoLer = (chave: string, lido: TextoDaBatalhaSalva | null): void => {
    // A leitura de uma mesa que já ficou para trás não solta a trava da mesa de agora.
    if (lendo === chave) lendo = null
    const lugar = atual
    if (parado || lugar === null || chaveDoLugar(lugar) !== chave) return
    if (lido !== null && !lido.ok) {
      if (lido.motivo === 'versao-mais-nova') {
        barradas.add(chave)
        aoAvisar(AVISO_DA_VERSAO)
        return
      }
      // Estragado: a próxima batalha grava por cima; sem batalha, o arquivo sai.
      comArquivo.add(chave)
      aoAvisar(AVISO_DO_ILEGIVEL)
      gravar(lugar)
      return
    }
    // Arquivo de outra mesa (a pasta copiada de uma aventura): não é desta, fica como está.
    if (lido === null || lido.salva.mesaId !== lugar.mesaId) {
      gravar(lugar)
      return
    }
    comArquivo.add(chave)
    const { cenas: naMemoria } = loja.getState()
    // A cena que já está em batalha nesta sessão (reabriu a mesma aventura sem fechar o app) vale a da memória.
    const cenas = Object.fromEntries(Object.entries(lido.salva.cenas).filter(([sceneKey]) => lugar.cenas.has(sceneKey) && !Object.hasOwn(naMemoria, sceneKey)))
    if (Object.keys(cenas).length === 0) {
      gravar(lugar)
      return
    }
    pendente = { chave, salva: { ...lido.salva, cenas } }
    aoOfertar(ofertaDe(lugar, pendente.salva))
  }

  const procurar = (lugar: LugarDaMesa): void => {
    const chave = chaveDoLugar(lugar)
    lendo = chave
    naFila('ler a batalha guardada', async () => {
      try {
        aoLer(chave, await disco.ler(lugar.pasta))
      } catch (erro) {
        if (lendo === chave) lendo = null
        throw erro
      }
    })
  }

  /** A mesa aberta pode ter mudado: a de antes grava o que faltava, e a nova é procurada no disco. */
  const conferirLugar = (): void => {
    if (parado) return
    const novo = lugarDe(mapaSolto)
    const chave = novo === null ? null : chaveDoLugar(novo)
    if (chave === (atual === null ? null : chaveDoLugar(atual))) {
      // Mesma mesa: só as cenas (uma cena nova entra na conta).
      atual = novo
      return
    }
    if (timer !== null) gravarAgora()
    if (pendente !== null) {
      // Saiu sem responder: a pergunta some e o arquivo fica para a próxima abertura.
      pendente = null
      aoOfertar(null)
    }
    atual = novo
    lendo = null
    if (novo !== null) procurar(novo)
  }

  const pararDeOuvir = [
    loja.subscribe((state, previous) => {
      if (state.cenas !== previous.cenas) agendar()
    }),
    assinarLugar(conferirLugar),
  ]
  conferirLugar()

  return {
    definirMapaSolto: (caminho, mapaId) => {
      mapaSolto = caminho === null ? null : { caminho, mapaId }
      conferirLugar()
    },

    retomar: () => {
      if (pendente === null) return
      const { salva } = pendente
      pendente = null
      aoOfertar(null)
      // Cada cena volta pela store; a mudança agenda a gravação de sempre.
      for (const [sceneKey, cena] of Object.entries(salva.cenas)) loja.getState().retomar(sceneKey, cena)
    },

    encerrar: () => {
      if (pendente === null) return []
      const { salva } = pendente
      pendente = null
      aoOfertar(null)
      const sairam: string[] = []
      for (const [sceneKey, cena] of Object.entries(salva.cenas)) {
        // Lido antes do fim: um aviso por personagem, como o Encerrar do livro.
        sairam.push(...formasQueDesligamNoFim(personagensDaBatalha(cena), mesa.personagens(), mesa.sistema()))
        loja.getState().encerrarSalva(sceneKey, cena)
      }
      // Nenhuma cena desta mesa ficou em batalha: o arquivo sai.
      gravarAgora()
      return sairam
    },

    parar: () => {
      if (timer !== null) gravarAgora()
      parado = true
      for (const deixar of pararDeOuvir) deixar()
    },

    ocioso: () => fila,
  }
}

/** A pasta de um arquivo (o que vem antes da última barra), ou `null`. */
function pastaDoArquivo(caminho: string): string | null {
  const corte = Math.max(caminho.lastIndexOf('/'), caminho.lastIndexOf('\\'))
  return corte <= 0 ? null : caminho.slice(0, corte)
}

/**
 * A mesa aberta no app: a aventura (com a pasta já gravada), ou o mapa solto
 * cujo caminho o App avisou para ESTE mapa. Na troca de mapa, o id muda antes
 * do caminho: até o caminho novo chegar, não há onde guardar (nunca a pasta
 * do mapa de antes com as cenas do novo).
 */
export function lugarDaAventura(mapaSolto: MapaSolto | null): LugarDaMesa | null {
  const { adventure, dir } = useAdventureStore.getState()
  if (adventure !== null) {
    if (dir === null) return null
    return { pasta: dir, mesaId: adventure.id, cenas: new Map(adventure.scenes.map((cena) => [cena.id, cena.name])) }
  }
  const { map } = useMapStore.getState()
  if (mapaSolto === null || mapaSolto.mapaId !== map.id) return null
  const pasta = pastaDoArquivo(mapaSolto.caminho)
  return pasta === null ? null : { pasta, mesaId: map.id, cenas: new Map([[map.id, map.name]]) }
}

/** Avisa a cada mudança da aventura e a cada troca do mapa aberto. */
export function assinarLugarDaAventura(aoMudar: () => void): () => void {
  const cancelamentos = [useAdventureStore.subscribe(aoMudar), useMapStore.subscribe((state) => state.map.id, aoMudar)]
  return () => {
    for (const cancelar of cancelamentos) cancelar()
  }
}
