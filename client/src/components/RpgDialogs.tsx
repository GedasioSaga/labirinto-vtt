import { useMemo, useState } from 'react'
import { escolherImagemDaFicha, escolherTextoJson, salvarTextoJson } from '../lib/arquivosDaFicha'
import { ehEmbutido } from '../lib/bibliotecaDeSistemas'
import { nomeDaCopia, rascunhoDaCopia, rascunhoDoSistema, rascunhoEmBranco, type RascunhoDoSistema } from '../lib/editorDeSistema'
import { serializarSistema, type SistemaDeRpg } from '../lib/sistemaDeRpg'
import { herdaDaPasta, hostWorldOf, personagensAtivos, sistemaAtivo, temRpgNoMapa, useAdventureStore } from '../stores/adventureStore'
import { useToastStore } from '../stores/toastStore'
import { campanhaDaPasta } from './nuvem/ponteDoLobby'
import { SISTEMA_FIXO_NO_LOBBY, usePastaPublicada } from './nuvem/usePastaPublicada'
import { carriedItemsOf, quantidadeDe } from '../lib/items'
import { tirarDaMochilaDaFicha } from '../lib/mochila/darNaFicha'
import { partyItemChange, tokenDoPersonagem } from '../lib/party'
import type { AppliedItems, HostWorld } from '../net/hostSession'
import type { CarriedItem } from '../types/map'
import { InventarioDaFicha } from './InventarioDaFicha'
import { curarPeloItem, itemQueCura, itemQueSeUsa, usarItemNaFicha } from '../lib/curaPeloItem'
import { mesaDaAventura } from '../stores/mesaDaAventura'
import { chavesDaFichaNaBatalha } from '../stores/ponteDasCondicoes'
import { chaveDaCenaAberta } from '../stores/turnoForaDaBatalha'
import { useMapStore } from '../stores/mapStore'
import { sistemaPorId, useRpgStore, type AberturaDoEditor } from '../stores/rpgStore'
import { temLivro } from '../lib/livroDeRegras'
import { aplicarAjustes, NOME_DO_MESTRE } from '../lib/ajusteDaFicha'
import type { Personagem } from '../lib/personagem'
import { useBatalhaStore } from '../stores/batalhaStore'
import { useBatalhaDBTStore } from '../stores/batalhaDBTStore'
import { FichaDePersonagemDialog, type TokenParaLigar } from './FichaDePersonagemDialog'
import { EditorDeSistemaDialog } from './EditorDeSistemaDialog'
import { LivroDeRegrasDialog } from './LivroDeRegrasDialog'
import { SistemasDialog } from './SistemasDialog'
import { comAventura } from '../stores/virarAventura'

/**
 * As janelas do sistema de RPG, montadas UMA vez no App: a grade de sistemas,
 * a ficha de personagem e o livro de regras. Quem abre (a lista "Personagens", o "Abrir ficha"
 * do token) só mexe no `rpgStore`; assim a janela não depende de o painel
 * esquerdo estar montado nem de qual seção está aberta.
 */
export interface RpgDialogsProps {
  /**
   * INVENTÁRIO NA FICHA: grava a mudança da mochila na cena certa e avisa as
   * telas dos jogadores (`applyItemsInScene` + pontes, em `App.tsx`). Ausente =
   * o inventário só lê.
   */
  aplicarItens?: (change: AppliedItems) => boolean
  /** Mapa solto: pergunta e vira aventura antes de gravar o sistema escolhido (`garantirAventura`). `true` = pode seguir. */
  garantirAventura: () => Promise<boolean>
}

export function RpgDialogs({ aplicarItens, garantirAventura }: RpgDialogsProps) {
  const adventure = useAdventureStore((state) => state.adventure)
  // O sistema e os personagens EM USO: os da pasta de mapas quando o mapa herda dela.
  const sistemaId = useAdventureStore(sistemaAtivo)
  const personagens = useAdventureStore(personagensAtivos)
  const temRpg = useAdventureStore(temRpgNoMapa)
  const activeSceneId = useAdventureStore((state) => state.activeSceneId)
  const cache = useAdventureStore((state) => state.cache)
  const tokens = useMapStore((state) => state.map.tokens)
  const personagemAberto = useRpgStore((state) => state.personagemAberto)
  const abrirEditando = useRpgStore((state) => state.abrirEditando)
  const sistemasAbertos = useRpgStore((state) => state.sistemasAbertos)
  const biblioteca = useRpgStore((state) => state.biblioteca)
  const avisos = useRpgStore((state) => state.avisosDaBiblioteca)
  const livroAberto = useRpgStore((state) => state.livroAberto)
  const editorDeSistema = useRpgStore((state) => state.editorDeSistema)
  // LOBBY: o mapa que herda troca o sistema UNIVERSAL da pasta; publicada, ele ficou fixo (o site lê as fichas pelo que foi junto, 12.21).
  const pastaQueManda = useAdventureStore((state) => (herdaDaPasta(state) ? (state.pasta?.pastaId ?? null) : null))
  const { publicada: pastaNoLobby } = usePastaPublicada(pastaQueManda)

  /** Confere de novo na hora: a grade pode abrir antes de a leitura do disco dizer que a pasta está no Lobby. */
  const escolherSistema = async (id: string) => {
    if (pastaQueManda !== null) {
      let noLobby = pastaNoLobby
      try {
        noLobby = noLobby || (await campanhaDaPasta(pastaQueManda)) !== null
      } catch (erro) {
        useToastStore.getState().push('error', `Não deu para conferir se a pasta está no Lobby, e o sistema ficou como estava: ${erro instanceof Error ? erro.message : String(erro)}`)
        return
      }
      if (noLobby) {
        useToastStore.getState().push('error', SISTEMA_FIXO_NO_LOBBY)
        return
      }
    }
    comAventura(garantirAventura, () => useAdventureStore.getState().setSistemaDeRpg(id))
  }

  // A grade abre também no mapa solto (Configurações do mapa): escolher ali pergunta antes se ele vira aventura.
  const grade = sistemasAbertos && (
    <SistemasDialog
      sistemas={biblioteca}
      escolhidoId={sistemaId}
      avisos={avisos}
      escolhaTravada={pastaNoLobby ? SISTEMA_FIXO_NO_LOBBY : undefined}
      onEscolher={(id) => void escolherSistema(id)}
      onImportar={async () => {
        const texto = await escolherTextoJson('Importar sistema de RPG', 'Sistema de RPG')
        return texto === null ? null : useRpgStore.getState().importarSistema(texto)
      }}
      onEditar={(abertura) => useRpgStore.getState().abrirEditorDeSistema(abertura)}
      onDuplicar={(sistema) => useRpgStore.getState().duplicarSistema(sistema)}
      onExportar={(sistema) => salvarTextoJson(`Exportar ${sistema.nome}`, 'Sistema de RPG', sistema.id, serializarSistema(sistema))}
      onApagar={(sistema) => useRpgStore.getState().apagarSistema(sistema.id)}
      ehEmbutido={ehEmbutido}
      onClose={() => useRpgStore.getState().fecharSistemas()}
    />
  )
  // Depois da grade: o editor abre por cima dela. Fora de aventura também — a biblioteca é do app.
  const editor = editorDeSistema !== null && <EditorDaBiblioteca abertura={editorDeSistema} biblioteca={biblioteca} />

  // Ficha e livro só com onde guardar: a aventura, ou a pasta de mapas de que o mapa (até solto) herda.
  if (!temRpg) {
    return (
      <>
        {grade}
        {editor}
      </>
    )
  }

  const personagem = personagemAberto === null ? undefined : personagens.find((candidato) => candidato.id === personagemAberto)
  const sistema = sistemaPorId(biblioteca, sistemaId)
  const tokensParaLigar: TokenParaLigar[] = tokens.map((token) => ({ id: token.id, nome: token.name, personagemId: token.characterId }))
  // A mochila mora no token: o mapa aberto (assinado acima pelos tokens) e as cenas de fundo carregadas.
  const inventario =
    personagem === undefined ? undefined : inventarioDoMestre(hostWorldOf({ adventure, activeSceneId, cache }, useMapStore.getState().map), personagem, aplicarItens)

  return (
    <>
      {grade}
      {editor}
      {personagem !== undefined && (
        <FichaDePersonagemDialog
          key={personagem.id}
          personagem={personagem}
          sistema={sistema}
          sistemaId={sistemaId}
          editandoNoInicio={abrirEditando}
          onSalvar={(salvo) => useAdventureStore.getState().salvarPersonagem(salvo)}
          onClose={() => useRpgStore.getState().fecharFicha()}
          escolherImagem={escolherImagemDaFicha}
          // "Trazer de outra ficha": as fichas da pasta (jogadores e NPCs, as mesmas dos Livros de regras).
          outrasFichas={personagens}
          onAbrirLivro={sistema !== undefined && temLivro(sistema) ? () => useRpgStore.getState().abrirLivro() : undefined}
          tokens={tokensParaLigar}
          // Pelo histórico do mapa, como o resto do token: Ctrl+Z desliga.
          onLigarToken={(tokenId) => useMapStore.getState().updateToken(tokenId, { characterId: personagem.id })}
          // AJUSTE RÁPIDO: sobre o personagem de AGORA da aventura (o jogador pode ter mexido um instante antes), com o histórico.
          // BATALHA F1: o que mudou vira linha no registro da batalha (autor mestre), em toda cena com ele na ordem.
          onAjustar={
            sistema === undefined
              ? undefined
              : (ajuste) => {
                  const feito: { antes?: Personagem; depois?: Personagem } = {}
                  const ok = useAdventureStore.getState().ajustarPersonagem(personagem.id, (atual) => {
                    feito.antes = atual
                    feito.depois = aplicarAjustes(atual, sistema, [ajuste], NOME_DO_MESTRE, Date.now())
                    return feito.depois
                  })
                  if (feito.antes !== undefined && feito.depois !== undefined && feito.antes !== feito.depois) {
                    useBatalhaStore.getState().registrarAjuste(personagem.id, feito.antes, feito.depois, { tipo: 'mestre' })
                    // BATALHA DBT: PV e Ki mudados à mão viram linha "ficha" na batalha Dragon Ball com ele.
                    useBatalhaDBTStore.getState().registrarAjuste(personagem.id, feito.antes, feito.depois, { tipo: 'mestre' })
                  }
                  return ok
                }
          }
          inventario={inventario}
        />
      )}
      {/* Depois da ficha: abre por cima dela. */}
      {livroAberto && sistema !== undefined && <LivroDeRegrasDialog sistema={sistema} onClose={() => useRpgStore.getState().fecharLivro()} />}
    </>
  )
}

/** O rascunho com que o editor abre: o do sistema, em branco, ou a cópia com um nome que ninguém da biblioteca usa. */
function rascunhoDaAbertura(abertura: AberturaDoEditor, biblioteca: readonly SistemaDeRpg[]): RascunhoDoSistema {
  if (abertura.tipo === 'editar') return rascunhoDoSistema(abertura.sistema)
  if (abertura.copiaDe === null) return rascunhoEmBranco()
  return rascunhoDaCopia(
    abertura.copiaDe,
    nomeDaCopia(
      abertura.copiaDe.nome,
      biblioteca.map((sistema) => sistema.nome),
    ),
  )
}

/**
 * O editor ligado à biblioteca. O rascunho nasce UMA vez, na abertura: o
 * `RpgDialogs` redesenha a cada token que anda, e refazer o rascunho do One
 * Piece (centenas de linhas) a cada passo seria trabalho jogado fora.
 */
function EditorDaBiblioteca({ abertura, biblioteca }: { abertura: AberturaDoEditor; biblioteca: readonly SistemaDeRpg[] }) {
  const [inicial] = useState(() => rascunhoDaAbertura(abertura, biblioteca))
  const idsDaBiblioteca = useMemo(() => new Set(biblioteca.map((sistema) => sistema.id)), [biblioteca])
  return (
    <EditorDeSistemaDialog
      inicial={inicial}
      idsDaBiblioteca={idsDaBiblioteca}
      onSalvar={(sistema) => useRpgStore.getState().salvarSistema(sistema)}
      onClose={() => useRpgStore.getState().fecharEditorDeSistema()}
    />
  )
}

/**
 * FASE 5 (a ficha é a dona da mochila, `lib/mochila/espelho.ts`): sem boneco
 * ligado nas cenas carregadas, a janela mostra a mochila da PRÓPRIA FICHA. Não
 * há chão onde largar; o "Tirar" tira a vaga inteira da ficha, pelo funil da
 * aventura (`ajustarPersonagem`), o mesmo do ajuste rápido.
 */
function mochilaDaFichaSemBoneco(personagem: Personagem) {
  const tirar = (item: CarriedItem, fechar: () => void) => {
    const ok = useAdventureStore.getState().ajustarPersonagem(personagem.id, (atual) => tirarDaMochilaDaFicha(atual, item.id, quantidadeDe(item)))
    if (ok) fechar()
    else useToastStore.getState().push('error', `Não deu para tirar ${item.nome} de ${personagem.nome}.`)
  }
  return (
    <InventarioDaFicha
      itens={personagem.mochila ?? []}
      vazio={`Nada com ${personagem.nome || 'o personagem'}. Dê um item pelo acervo de itens ou pelo livro.`}
      acoes={(item, fechar) => (
        <button type="button" className="lb-btn lb-btn--danger lb-btn--compact" onClick={() => tirar(item, fechar)}>
          Tirar
        </button>
      )}
    />
  )
}

/**
 * O inventário do personagem na ficha do mestre: a mochila do token ligado,
 * com as ações que o Grupo já tem — largar no chão (vira pino pegável onde o
 * token está) e tirar — e o "Usar" do consumível (gasta 1; o que cura tira o
 * veneno). `undefined` = nenhum token ligado nas cenas carregadas.
 */
function inventarioDoMestre(world: HostWorld, personagem: Personagem, aplicarItens: ((change: AppliedItems) => boolean) | undefined) {
  const personagemId = personagem.id
  const achado = tokenDoPersonagem(world, personagemId)
  if (achado === null) return mochilaDaFichaSemBoneco(personagem)
  const { token, sceneId } = achado
  const agir = (kind: 'tirar' | 'devolver', item: CarriedItem, fechar: () => void) => {
    const change = partyItemChange(world, { kind, item: { ...item, tokenId: token.id, sceneId } }, crypto.randomUUID())
    if (change !== null && aplicarItens?.(change) === true) fechar()
  }
  // A CURA TIRA O VENENO (`lib/curaPeloItem.ts`): o "Usar" gasta 1 da vaga e, se o item cura, tira o Envenenado da ficha.
  // A mochila vai pelo caminho dos itens (fora do Ctrl+Z, com a ficha espelhada); as condições, como mudança de jogador
  // (também fora do Ctrl+Z, como o "Passar turno"): o Ctrl+Z do mestre não devolve o veneno sem devolver a Poção.
  const usar = (item: CarriedItem, fechar: () => void) => {
    const sceneKey = sceneId ?? chaveDaCenaAberta()
    const seguradas = chavesDaFichaNaBatalha(sceneKey, token.id)
    const uso = usarItemNaFicha(token, item.id, seguradas)
    if (uso === null || aplicarItens === undefined) return
    if (!aplicarItens({ mochilas: [{ tokenId: token.id, mochila: uso.mochila }], ...(sceneId === null ? {} : { sceneId }) })) return
    if (itemQueCura(item)) mesaDaAventura.mudarFichaDaCena?.(sceneKey, token.id, (atual) => curarPeloItem(atual, seguradas))
    const quem = token.name || 'o token'
    useToastStore.getState().push('info', uso.curou.length === 0 ? `${quem} usou ${item.nome}.` : `${quem} usou ${item.nome}: ${uso.curou.join(', ')} saiu.`)
    if (!uso.mochila.some((vaga) => vaga.id === item.id)) fechar()
  }
  return (
    <InventarioDaFicha
      itens={carriedItemsOf(token)}
      vazio={`Nada com ${token.name || 'o token'}. Dê um item pelo acervo de itens.`}
      acoes={
        aplicarItens === undefined
          ? undefined
          : (item, fechar) => (
              <>
                {itemQueSeUsa(item) && (
                  <button type="button" className="lb-btn lb-btn--primary lb-btn--compact" onClick={() => usar(item, fechar)}>
                    Usar
                  </button>
                )}
                <button type="button" className="lb-btn lb-btn--compact" onClick={() => agir('devolver', item, fechar)}>
                  Largar no chão
                </button>
                <button type="button" className="lb-btn lb-btn--danger lb-btn--compact" onClick={() => agir('tirar', item, fechar)}>
                  Tirar
                </button>
              </>
            )
      }
    />
  )
}
