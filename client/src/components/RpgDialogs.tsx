import { escolherImagemDaFicha, escolherTextoJson } from '../lib/arquivosDaFicha'
import { hostWorldOf, useAdventureStore } from '../stores/adventureStore'
import { carriedItemsOf, podeLargarNoChao } from '../lib/items'
import { partyItemChange, tokenDoPersonagem } from '../lib/party'
import type { AppliedItems, HostWorld } from '../net/hostSession'
import type { CarriedItem } from '../types/map'
import { InventarioDaFicha } from './InventarioDaFicha'
import { useMapStore } from '../stores/mapStore'
import { sistemaPorId, useRpgStore } from '../stores/rpgStore'
import { temLivro } from '../lib/livroDeRegras'
import { aplicarAjustes, NOME_DO_MESTRE } from '../lib/ajusteDaFicha'
import { FichaDePersonagemDialog, type TokenParaLigar } from './FichaDePersonagemDialog'
import { LivroDeRegrasDialog } from './LivroDeRegrasDialog'
import { SistemasDialog } from './SistemasDialog'

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
}

export function RpgDialogs({ aplicarItens }: RpgDialogsProps = {}) {
  const adventure = useAdventureStore((state) => state.adventure)
  const activeSceneId = useAdventureStore((state) => state.activeSceneId)
  const cache = useAdventureStore((state) => state.cache)
  const tokens = useMapStore((state) => state.map.tokens)
  const personagemAberto = useRpgStore((state) => state.personagemAberto)
  const abrirEditando = useRpgStore((state) => state.abrirEditando)
  const sistemasAbertos = useRpgStore((state) => state.sistemasAbertos)
  const biblioteca = useRpgStore((state) => state.biblioteca)
  const avisos = useRpgStore((state) => state.avisosDaBiblioteca)
  const livroAberto = useRpgStore((state) => state.livroAberto)
  if (adventure === null) return null

  const personagem = personagemAberto === null ? undefined : (adventure.personagens ?? []).find((candidato) => candidato.id === personagemAberto)
  const sistema = sistemaPorId(biblioteca, adventure.sistemaDeRpg)
  const tokensParaLigar: TokenParaLigar[] = tokens.map((token) => ({ id: token.id, nome: token.name, personagemId: token.characterId }))
  // A mochila mora no token: o mapa aberto (assinado acima pelos tokens) e as cenas de fundo carregadas.
  const inventario =
    personagem === undefined ? undefined : inventarioDoMestre(hostWorldOf({ adventure, activeSceneId, cache }, useMapStore.getState().map), personagem.id, aplicarItens)

  return (
    <>
      {sistemasAbertos && (
        <SistemasDialog
          sistemas={biblioteca}
          escolhidoId={adventure.sistemaDeRpg}
          avisos={avisos}
          onEscolher={(id) => useAdventureStore.getState().setSistemaDeRpg(id)}
          onImportar={async () => {
            const texto = await escolherTextoJson('Importar sistema de RPG', 'Sistema de RPG')
            return texto === null ? null : useRpgStore.getState().importarSistema(texto)
          }}
          onClose={() => useRpgStore.getState().fecharSistemas()}
        />
      )}
      {personagem !== undefined && (
        <FichaDePersonagemDialog
          key={personagem.id}
          personagem={personagem}
          sistema={sistema}
          sistemaId={adventure.sistemaDeRpg}
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
                {podeLargarNoChao(item) && (
                  <button type="button" className="lb-btn lb-btn--compact" onClick={() => agir('devolver', item, fechar)}>
                    Largar no chão
                  </button>
                )}
                <button type="button" className="lb-btn lb-btn--danger lb-btn--compact" onClick={() => agir('tirar', item, fechar)}>
                  Tirar
                </button>
              </>
            )
      }
    />
  )
}
