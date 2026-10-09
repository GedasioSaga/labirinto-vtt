import { useEffect, useState } from 'react'
import { escolherTextoJson } from '../lib/arquivosDaFicha'
import { importarFichasDoProjetoRpg, type ResultadoDaImportacao } from '../lib/importarDoProjetoRpg'
import { temLivro } from '../lib/livroDeRegras'
import { novoPersonagem, type Personagem } from '../lib/personagem'
import type { SistemaDeRpg } from '../lib/sistemaDeRpg'
import { buildTokenPhotoData } from '../lib/tokenPhoto'
import { herdaDaPasta, personagensAtivos, sistemaAtivo, useAdventureStore } from '../stores/adventureStore'
import { sistemaPorId, useRpgStore } from '../stores/rpgStore'
import { comAventura } from '../stores/virarAventura'
import { CollapsibleSection } from './CollapsibleSection'
import { ImagemOuIniciais } from './FichaPecas'
import './FichaDePersonagem.css'

export interface PersonagensSectionProps {
  /** O sistema da aventura; `undefined` quando ela não tem (ou ele não está neste computador). */
  sistema: SistemaDeRpg | undefined
  /** O id gravado na aventura, para dizer qual sistema falta. */
  sistemaId: string | undefined
  personagens: readonly Personagem[]
  /** "Livro de regras"; ausente = o sistema da aventura não tem livro (sem botão). */
  onAbrirLivro?: () => void
  onAbrirFicha: (personagemId: string) => void
  onCriar: () => void
  onApagar: (personagemId: string) => void
  /** "Importar personagens…": devolve o resumo (`null` = cancelou). Lança com a razão. */
  onImportar: () => Promise<ResultadoDaImportacao | null>
  /** PASTAS DE MAPAS: o nome da pasta quando os personagens são os dela. Ausente = os do mapa. */
  nomeDaPasta?: string
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
 * "Livro de regras" (quando o sistema tem) e "Personagens" na aba Jogo, logo
 * abaixo da Sala: é durante a mesa que o mestre abre ficha e consulta regra.
 * O "Sistema de RPG" mora na janela Configurações do mapa. Aparece também no
 * mapa solto: criar ou importar ali pergunta antes se o mapa vira aventura,
 * porque personagens e sistema moram no `adventure.json`.
 */
export function PersonagensSection({ sistema, sistemaId, personagens, onAbrirLivro, onAbrirFicha, onCriar, onApagar, onImportar, nomeDaPasta }: PersonagensSectionProps) {
  const [apagando, setApagando] = useState<string | null>(null)
  const [importando, setImportando] = useState(false)
  const [estado, setEstado] = useState<{ tipo: 'ok' | 'erro'; texto: string; avisos: string[] } | null>(null)

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
      {onAbrirLivro !== undefined && (
        <button type="button" className="lb-btn lb-btn--ghost lb-btn--block lb-rpg__livro" onClick={onAbrirLivro}>
          Livro de regras
        </button>
      )}
      {/* h3: a aba Jogo já tem o h2 "Sala" acima. */}
      <CollapsibleSection id="personagens" title="Personagens" defaultOpen={false} contagem={personagens.length} headingLevel={3}>
        <div className="lb-rpg">
          {/* Mexer aqui é mexer em todos os mapas da pasta: o mestre precisa saber antes do −/+. */}
          {nomeDaPasta !== undefined && <p className="lb-field__hint">Da pasta &quot;{nomeDaPasta}&quot;: a mesma ficha em todos os mapas dela.</p>}
          {personagens.length === 0 ? (
            <p className="lb-rpg__vazio">Nenhum personagem ainda.</p>
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
          {sistema === undefined && (
            <p className="lb-field__hint">
              {sistemaId === undefined
                ? 'Escolha o sistema de RPG em Configurações do mapa (a engrenagem do painel) para criar e importar personagens.'
                : `O sistema ${sistemaId} não está neste computador: importe-o em Configurações do mapa para criar e importar personagens.`}
            </p>
          )}
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

export interface PersonagensDaAventuraProps {
  /** Mapa solto: pergunta e vira aventura antes de criar ou importar (`garantirAventura`). `true` = pode seguir. */
  garantirAventura: () => Promise<boolean>
}

/**
 * A seção ligada às stores: o sistema e os personagens EM USO
 * (`sistemaAtivo`/`personagensAtivos`: os da pasta de mapas quando o mapa
 * herda, senão os da aventura; nenhum no mapa solto), a biblioteca de
 * sistemas e as janelas (`RpgDialogs`).
 */
export function PersonagensDaAventura({ garantirAventura }: PersonagensDaAventuraProps) {
  const sistemaId = useAdventureStore(sistemaAtivo)
  const personagens = useAdventureStore(personagensAtivos)
  const nomeDaPasta = useAdventureStore((state) => (herdaDaPasta(state) && state.pasta !== null ? state.pasta.nome : undefined))
  const biblioteca = useRpgStore((state) => state.biblioteca)
  const carregarBiblioteca = useRpgStore((state) => state.carregarBiblioteca)
  // Sistema importado só se acha depois de ler a pasta: lida uma vez, na primeira vez que a seção aparece.
  useEffect(() => {
    void carregarBiblioteca()
  }, [carregarBiblioteca])
  const sistema = sistemaPorId(biblioteca, sistemaId)

  return (
    <PersonagensSection
      sistema={sistema}
      sistemaId={sistemaId}
      personagens={personagens}
      nomeDaPasta={nomeDaPasta}
      onAbrirLivro={sistema !== undefined && temLivro(sistema) ? () => useRpgStore.getState().abrirLivro() : undefined}
      onAbrirFicha={(id) => useRpgStore.getState().abrirFicha(id)}
      onCriar={() => {
        if (sistema === undefined) return
        comAventura(garantirAventura, () => {
          const personagem = novoPersonagem(sistema, 'jogador', '')
          if (useAdventureStore.getState().salvarPersonagem(personagem)) useRpgStore.getState().abrirFicha(personagem.id, true)
        })
      }}
      onApagar={(id) => useAdventureStore.getState().apagarPersonagem(id)}
      onImportar={async () => {
        if (sistema === undefined || !(await garantirAventura())) return null
        const texto = await escolherTextoJson('Importar personagens do projeto-rpg-v2', 'Fichas do projeto-rpg-v2')
        if (texto === null) return null
        const atuais = personagensAtivos(useAdventureStore.getState())
        const resultado = await importarFichasDoProjetoRpg(texto, sistema, atuais, { reduzirImagem: buildTokenPhotoData })
        useAdventureStore.getState().adicionarPersonagens(resultado.personagens)
        return resultado
      }}
    />
  )
}
