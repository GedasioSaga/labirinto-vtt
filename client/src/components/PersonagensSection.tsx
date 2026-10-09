import { useEffect, useState } from 'react'
import { escolherTextoJson } from '../lib/arquivosDaFicha'
import { importarFichasDoProjetoRpg, type ResultadoDaImportacao } from '../lib/importarDoProjetoRpg'
import { temLivro } from '../lib/livroDeRegras'
import { novoPersonagem, type Personagem } from '../lib/personagem'
import type { SistemaDeRpg } from '../lib/sistemaDeRpg'
import { buildTokenPhotoData } from '../lib/tokenPhoto'
import { useAdventureStore } from '../stores/adventureStore'
import { sistemaPorId, useRpgStore } from '../stores/rpgStore'
import { CollapsibleSection } from './CollapsibleSection'
import { ImagemOuIniciais } from './FichaPecas'
import './FichaDePersonagem.css'

export interface PersonagensSectionProps {
  /** O sistema da aventura; `undefined` quando ela não tem (ou ele não está neste computador). */
  sistema: SistemaDeRpg | undefined
  /** O id gravado na aventura, para dizer qual sistema falta. */
  sistemaId: string | undefined
  personagens: readonly Personagem[]
  onAbrirSistemas: () => void
  /** "Livro de regras"; ausente = o sistema da aventura não tem livro (sem botão). */
  onAbrirLivro?: () => void
  onAbrirFicha: (personagemId: string) => void
  onCriar: () => void
  onApagar: (personagemId: string) => void
  /** "Importar personagens…": devolve o resumo (`null` = cancelou). Lança com a razão. */
  onImportar: () => Promise<ResultadoDaImportacao | null>
}

/** A frase do resultado: quantos entraram, com os nomes, e quantos NPCs ficaram de fora. */
export function resumoDaImportacao(resultado: ResultadoDaImportacao): string {
  const n = resultado.personagens.length
  const nomes = resultado.personagens.map((personagem) => personagem.nome).join(', ')
  const entrou = n === 0 ? 'Nenhum personagem entrou.' : `${n} ${n === 1 ? 'personagem entrou' : 'personagens entraram'}: ${nomes}.`
  const fora = resultado.npcsIgnorados === 0 ? '' : ` ${resultado.npcsIgnorados} ${resultado.npcsIgnorados === 1 ? 'NPC ficou' : 'NPCs ficaram'} de fora.`
  return `${entrou}${fora}`
}

/**
 * "Sistema de RPG", "Livro de regras" (quando o sistema tem) e "Personagens"
 * na zona Aventura do painel esquerdo. Só
 * aparece com aventura: personagens e sistema moram no `adventure.json`, que o
 * mapa solto não tem (o mesmo limite da Agenda).
 */
export function PersonagensSection({ sistema, sistemaId, personagens, onAbrirSistemas, onAbrirLivro, onAbrirFicha, onCriar, onApagar, onImportar }: PersonagensSectionProps) {
  const [apagando, setApagando] = useState<string | null>(null)
  const [importando, setImportando] = useState(false)
  const [estado, setEstado] = useState<{ tipo: 'ok' | 'erro'; texto: string; avisos: string[] } | null>(null)
  const nomeDoSistema = sistema?.nome ?? (sistemaId === undefined ? 'nenhum' : `${sistemaId} (não está neste computador)`)

  const importar = async () => {
    setImportando(true)
    setEstado(null)
    try {
      const resultado = await onImportar()
      if (resultado !== null) setEstado({ tipo: 'ok', texto: resumoDaImportacao(resultado), avisos: resultado.avisos })
    } catch (erro) {
      setEstado({ tipo: 'erro', texto: `Não deu para importar: ${erro instanceof Error ? erro.message : String(erro)}`, avisos: [] })
    } finally {
      setImportando(false)
    }
  }

  return (
    <>
      <button type="button" className="lb-btn lb-btn--block lb-rpg__sistema" onClick={onAbrirSistemas}>
        <span className="lb-rpg__sistema-rotulo">Sistema de RPG</span>
        <span className="lb-rpg__sistema-nome">{nomeDoSistema}</span>
      </button>
      {onAbrirLivro !== undefined && (
        <button type="button" className="lb-btn lb-btn--ghost lb-btn--block lb-rpg__livro" onClick={onAbrirLivro}>
          Livro de regras
        </button>
      )}
      <CollapsibleSection id="personagens" title="Personagens" defaultOpen={false} contagem={personagens.length}>
        <div className="lb-rpg">
          {personagens.length === 0 ? (
            <p className="lb-rpg__vazio">Nenhum personagem nesta aventura.</p>
          ) : (
            <ul className="lb-rpg__lista" aria-label="Personagens da aventura">
              {personagens.map((personagem) => (
                <li key={personagem.id} className="lb-rpg__linha">
                  <button type="button" className="lb-rpg__abrir" onClick={() => onAbrirFicha(personagem.id)}>
                    <span className="lb-rpg__retrato"><ImagemOuIniciais imagem={personagem.retrato} nome={personagem.nome} /></span>
                    <span className="lb-rpg__nome">{personagem.nome}</span>
                    <span className="lb-ficha__selo" data-tipo={personagem.tipo}>
                      {personagem.tipo === 'jogador' ? 'Jogador' : 'NPC'}
                    </span>
                  </button>
                  {apagando === personagem.id ? (
                    <span className="lb-rpg__confirma">
                      <button type="button" className="lb-btn lb-btn--danger lb-btn--compact" onClick={() => onApagar(personagem.id)}>
                        Apagar
                      </button>
                      <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={() => setApagando(null)}>
                        Manter
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="lb-btn lb-btn--ghost lb-btn--compact lb-rpg__remover"
                      aria-label={`Apagar ${personagem.nome}`}
                      title="Apagar personagem"
                      onClick={() => setApagando(personagem.id)}
                    >
                      ×
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {sistema === undefined && <p className="lb-field__hint">Escolha o sistema de RPG da aventura para criar e importar personagens.</p>}
          <div className="lb-cenas__acoes">
            <button type="button" className="lb-btn" disabled={sistema === undefined} onClick={onCriar}>
              + Personagem
            </button>
            <button type="button" className="lb-btn lb-btn--ghost" disabled={sistema === undefined || importando} onClick={() => void importar()}>
              {importando ? 'Importando…' : 'Importar personagens…'}
            </button>
          </div>
          {estado !== null && (
            <div className="lb-rpg__estado" role={estado.tipo === 'erro' ? 'alert' : 'status'}>
              <p className={estado.tipo === 'erro' ? 'lb-field__error' : 'lb-field__hint'}>{estado.texto}</p>
              {estado.avisos.length > 0 && (
                <ul className="lb-rpg__avisos">
                  {estado.avisos.map((aviso, i) => (
                    <li key={i}>{aviso}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </CollapsibleSection>
    </>
  )
}

/**
 * A seção ligada às stores: o sistema e os personagens da aventura aberta,
 * a biblioteca de sistemas e as janelas (`RpgDialogs`). `null` sem aventura.
 */
export function PersonagensDaAventura() {
  const adventure = useAdventureStore((state) => state.adventure)
  const biblioteca = useRpgStore((state) => state.biblioteca)
  const carregarBiblioteca = useRpgStore((state) => state.carregarBiblioteca)
  // Sistema importado só se acha depois de ler a pasta: lida uma vez, na primeira vez que a seção aparece.
  useEffect(() => {
    void carregarBiblioteca()
  }, [carregarBiblioteca])
  if (adventure === null) return null
  const sistemaId = adventure.sistemaDeRpg
  const sistema = sistemaPorId(biblioteca, sistemaId)
  const personagens = adventure.personagens ?? []

  return (
    <PersonagensSection
      sistema={sistema}
      sistemaId={sistemaId}
      personagens={personagens}
      onAbrirSistemas={() => useRpgStore.getState().abrirSistemas()}
      onAbrirLivro={sistema !== undefined && temLivro(sistema) ? () => useRpgStore.getState().abrirLivro() : undefined}
      onAbrirFicha={(id) => useRpgStore.getState().abrirFicha(id)}
      onCriar={() => {
        if (sistema === undefined) return
        const personagem = novoPersonagem(sistema, 'jogador', '')
        if (useAdventureStore.getState().salvarPersonagem(personagem)) useRpgStore.getState().abrirFicha(personagem.id, true)
      }}
      onApagar={(id) => useAdventureStore.getState().apagarPersonagem(id)}
      onImportar={async () => {
        if (sistema === undefined) return null
        const texto = await escolherTextoJson('Importar personagens do projeto-rpg-v2', 'Fichas do projeto-rpg-v2')
        if (texto === null) return null
        const atuais = useAdventureStore.getState().adventure?.personagens ?? []
        const resultado = await importarFichasDoProjetoRpg(texto, sistema, atuais, { reduzirImagem: buildTokenPhotoData })
        useAdventureStore.getState().adicionarPersonagens(resultado.personagens)
        return resultado
      }}
    />
  )
}
