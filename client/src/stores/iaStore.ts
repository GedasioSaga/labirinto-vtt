import { create } from 'zustand'
import { esquemaDoNpc, pedidoDoNpc, personagemDaIa, type NivelDoNpc } from '../lib/ia/gerarNpc'
import { gravarModeloDaIa, lerModeloDaIa } from '../lib/ia/iaNoDisco'
import {
  erroDaIa,
  estadoDasChaves,
  gerarNaIa,
  IMAGENS_MAX,
  MODELO_PADRAO,
  type CodigoDoErroDaIa,
  type ImagemDaIa,
  type MensagemDaIa,
  type ModeloGemini,
} from '../lib/ia/portaDaIa'
import {
  fichasDaConversa,
  historicoParaIa,
  montarContexto,
  perguntaSobreOVisual,
  systemPromptPara,
  textoDaPergunta,
  type EncontroParaIa,
  type ModoDaIa,
} from '../lib/ia/prompts'
import { retratoParaIa } from '../lib/ia/retratos'
import type { EntradaDoLivro, ItemDoCatalogo } from '../lib/livros/catalogo'
import type { Personagem } from '../lib/personagem'
import type { SistemaDeRpg } from '../lib/sistemaDeRpg'
import { useToastStore } from './toastStore'

/**
 * O ASSISTENTE DO MESTRE na tela (M4 do mundo do livro de regras): o modo, as
 * fichas fixas da conversa, a conversa e o NPC gerado. Tudo EM MEMÓRIA: some
 * ao fechar o app (plano §2.2) e zera quando o mundo abre outra pasta. O
 * modelo escolhido vai para `<appData>/livros/ia.json`; a chave nunca passa
 * por aqui (só a contagem que o cofre devolve).
 */

export type AutorDaMensagem = 'mestre' | 'ia' | 'erro'

export interface MensagemDaConversa {
  id: string
  de: AutorDaMensagem
  texto: string
  /** No erro: o código da porta, que decide o botão ("Pôr a chave", "Trocar o modelo"). */
  codigo?: CodigoDoErroDaIa
}

/** O que a pergunta precisa do mundo aberto (quem chama lê das stores do mundo e do catálogo). */
export interface DadosDoMundoParaIa {
  sistema: SistemaDeRpg
  personagens: readonly Personagem[]
  itens: readonly ItemDoCatalogo[]
  doLivro: readonly EntradaDoLivro[]
  encontro: EncontroParaIa
}

/**
 * Janela estreita: a coluna vira gaveta por cima da página e começa fechada
 * (o mesmo corte do protótipo e do `@media` de components/ia/ia.css).
 */
export const CONSULTA_DA_GAVETA_DA_IA = '(max-width: 1240px)'

interface IaState {
  /** A pasta da conversa; outra pasta aberta no mundo zera tudo. */
  pastaId: string | null
  /** A coluna do assistente está aberta. */
  aberta: boolean
  modo: ModoDaIa
  /** Fichas que ficam na conversa: postas à mão ou que já foram numa pergunta. */
  fixas: string[]
  conversa: MensagemDaConversa[]
  /** Fichas cujo retrato já foi nesta conversa (não vai de novo, salvo pergunta sobre o visual). */
  retratosEnviados: string[]
  /** Uma pergunta ou um Gerar NPC esperando a IA. */
  pensando: boolean
  /** Sobe a cada "Nova conversa": a resposta que chegar depois de uma conversa nova é descartada. */
  rodada: number
  /** O formulário do Gerar NPC está aberto na conversa. */
  gerando: boolean
  /** A ficha que a IA gerou, esperando revisão. */
  gerado: Personagem | null
  /** Quantas chaves o cofre guarda; `null` = ainda não lido (ou fora do app). */
  chaves: number | null
  modelo: ModeloGemini
  /** A engrenagem está aberta. */
  configAberta: boolean

  /** Liga a conversa à pasta aberta; pasta diferente da anterior começa do zero. */
  usarPasta: (pastaId: string) => void
  abrir: () => void
  fechar: () => void
  trocarModo: (modo: ModoDaIa) => void
  porFicha: (personagemId: string) => void
  tirarFicha: (personagemId: string) => void
  novaConversa: () => void
  abrirConfig: (aberta: boolean) => void
  abrirGerar: (aberto: boolean) => void
  descartarGerado: () => void
  /** Lê do cofre quantas chaves há e do disco o modelo. Nunca lança. */
  lerConfig: () => Promise<void>
  definirChaves: (quantas: number) => void
  /** Troca o modelo e grava em ia.json. Lança com a frase pronta. */
  trocarModelo: (modelo: ModeloGemini) => Promise<void>
  /**
   * Pergunta à IA com o contexto do mundo. Devolve se a resposta entrou na
   * conversa: `false` = deu erro (a mensagem de erro já está na conversa) e a
   * tela devolve o texto à caixa.
   */
  perguntar: (pergunta: string, mundo: DadosDoMundoParaIa) => Promise<boolean>
  /** Gera um NPC a partir da descrição. O resultado vira `gerado` (ou uma mensagem de erro). */
  gerarNpc: (descricao: string, nivel: NivelDoNpc, mundo: DadosDoMundoParaIa) => Promise<void>
}

function novoId(): string {
  return crypto.randomUUID()
}

function abertaNoComeco(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && !window.matchMedia(CONSULTA_DA_GAVETA_DA_IA).matches
}

/** A conversa como a porta aceita: só o que o mestre perguntou e o que a IA respondeu (erro não vai). */
function historicoDaConversa(conversa: readonly MensagemDaConversa[]): MensagemDaIa[] {
  return historicoParaIa(conversa.flatMap((mensagem) => (mensagem.de === 'erro' ? [] : [{ papel: mensagem.de === 'mestre' ? 'user' : 'model', texto: mensagem.texto }])))
}

type ConversaDaIa = Pick<IaState, 'fixas' | 'conversa' | 'retratosEnviados' | 'pensando' | 'gerando' | 'gerado'>

function conversaVazia(): ConversaDaIa {
  return { fixas: [], conversa: [], retratosEnviados: [], pensando: false, gerando: false, gerado: null }
}

export const useIaStore = create<IaState>()((set, get) => {
  /** Avisa a troca de chave por cota esgotada (o Rust já gravou a nova ativa). */
  const avisarTroca = (trocouPara: number | null) => {
    if (trocouPara === null) return
    useToastStore.getState().push('info', `A cota de uma chave acabou: o assistente passou para a chave ${trocouPara + 1}.`)
  }

  /** Um erro vira mensagem na conversa; sem chave, a contagem cai para 0 e o aviso "Sem chave" aparece. */
  const registrarErro = (erro: unknown) => {
    const falha = erroDaIa(erro)
    set(({ conversa, chaves }) => ({
      conversa: [...conversa, { id: novoId(), de: 'erro', texto: falha.message, codigo: falha.codigo }],
      chaves: falha.codigo === 'sem_chave' ? 0 : chaves,
    }))
  }

  return {
    pastaId: null,
    aberta: abertaNoComeco(),
    modo: 'conversa',
    ...conversaVazia(),
    rodada: 0,
    chaves: null,
    modelo: MODELO_PADRAO,
    configAberta: false,

    usarPasta: (pastaId) => {
      if (get().pastaId === pastaId) return
      set(({ rodada }) => ({ pastaId, ...conversaVazia(), rodada: rodada + 1 }))
    },
    abrir: () => set({ aberta: true }),
    fechar: () => set({ aberta: false, configAberta: false }),
    trocarModo: (modo) => set({ modo }),
    porFicha: (personagemId) => set(({ fixas }) => (fixas.includes(personagemId) ? {} : { fixas: [...fixas, personagemId] })),
    tirarFicha: (personagemId) => set(({ fixas }) => ({ fixas: fixas.filter((id) => id !== personagemId) })),
    novaConversa: () => set(({ rodada }) => ({ ...conversaVazia(), rodada: rodada + 1 })),
    abrirConfig: (aberta) => set({ configAberta: aberta }),
    abrirGerar: (aberto) => set(aberto ? { gerando: true, gerado: null } : { gerando: false }),
    descartarGerado: () => set({ gerado: null }),

    lerConfig: async () => {
      const modelo = await lerModeloDaIa()
      let chaves: number | null = null
      try {
        chaves = await estadoDasChaves()
      } catch {
        // Fora do app ou cofre indisponível: a contagem fica desconhecida (`null`) e a pergunta mostra o erro da porta.
      }
      set({ modelo, chaves })
    },
    definirChaves: (quantas) => set({ chaves: quantas }),
    trocarModelo: async (modelo) => {
      set({ modelo })
      await gravarModeloDaIa(modelo)
    },

    perguntar: async (pergunta, mundo) => {
      const limpa = pergunta.trim()
      const inicio = get()
      if (limpa.length === 0 || inicio.pensando) return false
      const rodada = inicio.rodada
      const fichas = fichasDaConversa(inicio.modo, inicio.fixas, limpa, mundo.personagens, mundo.encontro)
      const historico = historicoDaConversa(inicio.conversa)
      // As citadas ficam na conversa (protótipo); as do Comparar entram só nesta pergunta.
      set(({ conversa }) => ({
        conversa: [...conversa, { id: novoId(), de: 'mestre', texto: limpa }],
        fixas: [...fichas.fixas, ...fichas.citadas],
        pensando: true,
      }))
      try {
        const contexto = montarContexto({ modo: inicio.modo, pergunta: limpa, ...mundo, fichas })
        const porId = new Map(mundo.personagens.map((personagem) => [personagem.id, personagem]))
        const sobreOVisual = perguntaSobreOVisual(limpa)
        const comRetrato = fichas.usadas
          .flatMap((id) => porId.get(id) ?? [])
          .filter((personagem) => personagem.retrato !== null && (sobreOVisual || !inicio.retratosEnviados.includes(personagem.id)))
          .slice(0, IMAGENS_MAX)
        const lidos = await Promise.all(comRetrato.map(async (personagem) => ({ personagem, imagem: await retratoParaIa(personagem.retrato) })))
        const anexos = lidos.flatMap(({ personagem, imagem }): { personagem: Personagem; imagem: ImagemDaIa }[] => (imagem === null ? [] : [{ personagem, imagem }]))
        const resposta = await gerarNaIa({
          modelo: get().modelo,
          systemPrompt: systemPromptPara(inicio.modo, fichas.usadas.length, mundo.sistema.nome, mundo.personagens.length > 0),
          historico,
          texto: textoDaPergunta(
            contexto.texto,
            inicio.modo,
            limpa,
            anexos.map(({ personagem }) => personagem.nome),
          ),
          imagens: anexos.map(({ imagem }) => imagem),
        })
        if (get().rodada !== rodada) return true
        set(({ conversa, retratosEnviados }) => ({
          conversa: [...conversa, { id: novoId(), de: 'ia', texto: resposta.texto }],
          retratosEnviados: [...new Set([...retratosEnviados, ...anexos.map(({ personagem }) => personagem.id)])],
          pensando: false,
        }))
        avisarTroca(resposta.trocouPara)
        return true
      } catch (erro) {
        if (get().rodada !== rodada) return false
        set({ pensando: false })
        registrarErro(erro)
        return false
      }
    },

    gerarNpc: async (descricao, nivel, mundo) => {
      if (get().pensando) return
      const rodada = get().rodada
      set({ gerando: false, gerado: null, pensando: true })
      try {
        const pedido = pedidoDoNpc(descricao, nivel, mundo.sistema, mundo.personagens, mundo.encontro.grupo)
        const resposta = await gerarNaIa({ modelo: get().modelo, systemPrompt: pedido.systemPrompt, texto: pedido.texto, esquemaResposta: esquemaDoNpc(mundo.sistema) })
        if (get().rodada !== rodada) return
        avisarTroca(resposta.trocouPara)
        const npc = personagemDaIa(resposta.texto, mundo.sistema)
        if (npc.ok) {
          set({ gerado: npc.personagem, pensando: false })
        } else {
          set(({ conversa }) => ({ pensando: false, conversa: [...conversa, { id: novoId(), de: 'erro', texto: npc.erro, codigo: 'resposta_invalida' }] }))
        }
      } catch (erro) {
        if (get().rodada !== rodada) return
        set({ pensando: false })
        registrarErro(erro)
      }
    },
  }
})
