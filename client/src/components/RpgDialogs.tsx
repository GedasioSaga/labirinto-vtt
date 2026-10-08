import { escolherImagemDaFicha, escolherTextoJson } from '../lib/arquivosDaFicha'
import { useAdventureStore } from '../stores/adventureStore'
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
export function RpgDialogs() {
  const adventure = useAdventureStore((state) => state.adventure)
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
        />
      )}
      {/* Depois da ficha: abre por cima dela. */}
      {livroAberto && sistema !== undefined && <LivroDeRegrasDialog sistema={sistema} onClose={() => useRpgStore.getState().fecharLivro()} />}
    </>
  )
}
