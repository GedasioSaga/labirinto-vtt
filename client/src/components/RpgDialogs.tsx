import { useMemo, useState } from 'react'
import { escolherImagemDaFicha, escolherTextoJson, salvarTextoJson } from '../lib/arquivosDaFicha'
import { ehEmbutido } from '../lib/bibliotecaDeSistemas'
import { nomeDaCopia, rascunhoDaCopia, rascunhoDoSistema, rascunhoEmBranco, type RascunhoDoSistema } from '../lib/editorDeSistema'
import { serializarSistema, type SistemaDeRpg } from '../lib/sistemaDeRpg'
import { hostWorldOf, personagensAtivos, sistemaAtivo, temRpgNoMapa, useAdventureStore } from '../stores/adventureStore'
import { carriedItemsOf } from '../lib/items'
import { partyItemChange, tokenDoPersonagem } from '../lib/party'
import type { AppliedItems, HostWorld } from '../net/hostSession'
import type { CarriedItem } from '../types/map'
import { InventarioDaFicha } from './InventarioDaFicha'
import { useMapStore } from '../stores/mapStore'
import { sistemaPorId, useRpgStore, type AberturaDoEditor } from '../stores/rpgStore'
import { temLivro } from '../lib/livroDeRegras'
import { aplicarAjustes, NOME_DO_MESTRE } from '../lib/ajusteDaFicha'
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

  // A grade abre também no mapa solto (Configurações do mapa): escolher ali pergunta antes se ele vira aventura.
  const grade = sistemasAbertos && (
    <SistemasDialog
      sistemas={biblioteca}
      escolhidoId={sistemaId}
      avisos={avisos}
      onEscolher={(id) => comAventura(garantirAventura, () => useAdventureStore.getState().setSistemaDeRpg(id))}
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
    personagem === undefined ? undefined : inventarioDoMestre(hostWorldOf({ adventure, activeSceneId, cache }, useMapStore.getState().map), personagem.id, aplicarItens)

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
          onAbrirLivro={sistema !== undefined && temLivro(sistema) ? () => useRpgStore.getState().abrirLivro() : undefined}
          tokens={tokensParaLigar}
          // Pelo histórico do mapa, como o resto do token: Ctrl+Z desliga.
          onLigarToken={(tokenId) => useMapStore.getState().updateToken(tokenId, { characterId: personagem.id })}
          // AJUSTE RÁPIDO: sobre o personagem de AGORA da aventura (o jogador pode ter mexido um instante antes), com o histórico.
          onAjustar={
            sistema === undefined
              ? undefined
              : (ajuste) => useAdventureStore.getState().ajustarPersonagem(personagem.id, (atual) => aplicarAjustes(atual, sistema, [ajuste], NOME_DO_MESTRE, Date.now()))
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
 * O inventário do personagem na ficha do mestre: a mochila do token ligado,
 * com as ações que o Grupo já tem — largar no chão (vira pino pegável onde o
 * token está) e tirar. `undefined` = nenhum token ligado nas cenas carregadas.
 */
function inventarioDoMestre(world: HostWorld, personagemId: string, aplicarItens: ((change: AppliedItems) => boolean) | undefined) {
  const achado = tokenDoPersonagem(world, personagemId)
  if (achado === null) return undefined
  const { token, sceneId } = achado
  const agir = (kind: 'tirar' | 'devolver', item: CarriedItem, fechar: () => void) => {
    const change = partyItemChange(world, { kind, item: { ...item, tokenId: token.id, sceneId } }, crypto.randomUUID())
    if (change !== null && aplicarItens?.(change) === true) fechar()
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
