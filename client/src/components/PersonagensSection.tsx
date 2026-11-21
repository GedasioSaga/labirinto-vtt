import { useEffect, useId, useState } from 'react'
import { escolherTextoJson } from '../lib/arquivosDaFicha'
import { importarFichasDoProjetoRpg, type ResultadoDaImportacao } from '../lib/importarDoProjetoRpg'
import { temLivro } from '../lib/livroDeRegras'
import { novoPersonagem, type Personagem } from '../lib/personagem'
import type { SistemaDeRpg } from '../lib/sistemaDeRpg'
import { buildTokenPhotoData } from '../lib/tokenPhoto'
import { herdaDaPasta, personagensAtivos, sistemaAtivo, useAdventureStore } from '../stores/adventureStore'
import { useMundoDoLivroStore } from '../stores/mundoDoLivroStore'
import type { TamanhoDaVista } from '../stores/criarToken'
import { mostrarNpcsNoAcervo } from '../stores/fichasNoAcervo'
import { ligarFichaAosTokens } from '../stores/ligarFichaNoToken'
import { casaSobOPonteiro, porPersonagemNoMapa, tokenSobOPonteiro, type CasaDoSoltar } from '../stores/porPersonagemNoMapa'
import { sistemaPorId, useRpgStore } from '../stores/rpgStore'
import { comAventura } from '../stores/virarAventura'
import { useAbertaGuardada } from './CollapsibleSection'
import { Botao } from './grimorio/Botao'
import { Ficha } from './grimorio/Ficha'
import { SearchIcon } from './icons'
import { ListaDePersonagens } from './ListaDePersonagens'
import { IconeDoLivro } from './livro/icones'
import { useArrastoDaLinha, type TokenNaTela } from './useArrastoDaLinha'
import './FichaDePersonagem.css'

export interface PersonagensSectionProps {
  /** O sistema da aventura; `undefined` quando ela não tem (ou ele não está neste computador). */
  sistema: SistemaDeRpg | undefined
  /** O id gravado na aventura, para dizer qual sistema falta. */
  sistemaId: string | undefined
  /** Todos os personagens em uso; a seção mostra só os JOGADORES (os NPCs moram no Acervo). */
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
  /**
   * MUNDO DO LIVRO (M1): "Abrir o mundo do <sistema>", por cima do mapa.
   * Ausente = o mapa não herda o sistema de uma pasta (sem botão).
   */
  onAbrirMundo?: () => void
  /**
   * ARRASTAR PARA O MAPA: a casa sob o ponteiro (px de janela) para o realce,
   * `null` fora do mapa. Ausente = a lista não arrasta (só abre a ficha).
   */
  casaNaTela?: (clientX: number, clientY: number) => CasaDoSoltar['tela'] | null
  /** SOLTAR EM CIMA DO TOKEN: o token sob o ponteiro (ganha da casa), `null` = nenhum. */
  tokenNaTela?: (clientX: number, clientY: number) => TokenNaTela | null
  /** Soltou a linha no ponto da tela: `true` = era o mapa (o token nasce, ou a ficha liga ao token de lá). */
  onSoltarNoMapa?: (personagem: Personagem, clientX: number, clientY: number) => boolean
  /** "Mostrar no Acervo": abre a página Acervo com a pasta NPCs à vista. Ausente = sem o botão. */
  onMostrarNoAcervo?: () => void
}

/** A frase do resultado: quantos entraram, com os nomes, e quantos NPCs ficaram de fora. */
export function resumoDaImportacao(resultado: ResultadoDaImportacao): string {
  const n = resultado.personagens.length
  const nomes = resultado.personagens.map((personagem) => personagem.nome).join(', ')
  const entrou = n === 0 ? 'Nenhum personagem entrou.' : `${n} ${n === 1 ? 'personagem entrou' : 'personagens entraram'}: ${nomes}.`
  const fora = resultado.npcsIgnorados === 0 ? '' : ` ${resultado.npcsIgnorados} ${resultado.npcsIgnorados === 1 ? 'NPC ficou' : 'NPCs ficaram'} de fora.`
  // NPCs NO ACERVO (decisão 13): o NPC que entrou não aparece nesta coluna; a frase diz onde ele está.
  const npcs = resultado.personagens.filter((personagem) => personagem.tipo !== 'jogador').length
  const onde = npcs === 0 ? '' : npcs === 1 ? ' O NPC está no Acervo, em NPCs.' : ` Os ${npcs} NPCs estão no Acervo, em NPCs.`
  return `${entrou}${fora}${onde}`
}

/**
 * "Livro de regras" (quando o sistema tem) e "Jogadores" na aba Jogo, logo
 * abaixo da Sala: é durante a mesa que o mestre abre ficha e consulta regra.
 * O "Sistema de RPG" mora na janela Configurações do mapa. Aparece também no
 * mapa solto: criar ou importar ali pergunta antes se o mapa vira aventura,
 * porque personagens e sistema moram no `adventure.json`.
 *
 * SÓ JOGADORES (pedido de 21/11/2026: "do lado direito eu não quero ter os
 * npcs com fichas eu quero eles aqui [Acervo de tokens]"): sem grupos nem
 * pastas; as fichas de NPC e de inimigo moram no Acervo, e a linha do pé
 * leva até elas ("Mostrar no Acervo"). A busca fica no topo.
 */
export function PersonagensSection({
  sistema,
  sistemaId,
  personagens,
  onAbrirLivro,
  onAbrirFicha,
  onCriar,
  onApagar,
  onImportar,
  nomeDaPasta,
  onAbrirMundo,
  casaNaTela,
  tokenNaTela,
  onSoltarNoMapa,
  onMostrarNoAcervo,
}: PersonagensSectionProps) {
  const [aberta, setAberta] = useAbertaGuardada('personagens', false)
  const jogadores = personagens.filter((personagem) => personagem.tipo === 'jogador')
  const arrasto = useArrastoDaLinha({ casaNaTela, tokenNaTela, onSoltarNoMapa })
  const arrasta = casaNaTela !== undefined && onSoltarNoMapa !== undefined
  const [busca, setBusca] = useState('')
  const [importando, setImportando] = useState(false)
  const [estado, setEstado] = useState<{ tipo: 'ok' | 'erro'; texto: string; avisos: string[] } | null>(null)
  const idDaBusca = useId()

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
      {/* h3: o livro da mesa já tem o h2 "Sala" acima. Recolhida, com a contagem no resumo. */}
      <Ficha titulo="Jogadores" icone={<IconeDoLivro nome="ficha" />} resumo={jogadores.length > 0 ? String(jogadores.length) : undefined} aberta={aberta} onAlternar={setAberta}>
        <div className="lb-rpg">
          {/* Mexer aqui é mexer em todos os mapas da pasta: o mestre precisa saber antes do −/+. */}
          {nomeDaPasta !== undefined && <p className="lb-field__hint">Da pasta &quot;{nomeDaPasta}&quot;: a mesma ficha em todos os mapas dela.</p>}
          {jogadores.length > 0 && (
            <div className="lb-rpg__topo">
              {/* O nome do campo é do leitor de tela: a lupa e o texto de exemplo dizem o que ele é. */}
              <label className="gr-sr" htmlFor={idDaBusca}>
                Buscar jogador
              </label>
              <div className="lb-objetos__campo lb-rpg__busca">
                <span className="lb-objetos__lupa" aria-hidden="true">
                  <SearchIcon size={16} />
                </span>
                <input
                  id={idDaBusca}
                  type="search"
                  className="lb-input lb-objetos__busca"
                  placeholder="Buscar nome"
                  value={busca}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(event) => setBusca(event.target.value)}
                  onKeyDown={(event) => {
                    // Esc limpa a busca e para aqui: no editor ele largaria a seleção do mapa.
                    if (event.key === 'Escape' && busca !== '') {
                      event.preventDefault()
                      event.stopPropagation()
                      setBusca('')
                    }
                  }}
                />
              </div>
            </div>
          )}
          {jogadores.length === 0 ? (
            <p className="lb-rpg__vazio">Nenhum jogador ainda.</p>
          ) : (
            <ListaDePersonagens
              personagens={jogadores}
              pastas={[]}
              plana
              busca={busca}
              arrastando={arrasto.arrastado !== null}
              arrasta={arrasta}
              pastaNova={null}
              onPastaNovaVista={() => undefined}
              onCriarPasta={() => undefined}
              onApertar={arrasto.comecar}
              engolirClique={arrasto.engolirClique}
              onAbrirFicha={onAbrirFicha}
              onApagar={onApagar}
            />
          )}
          {onAbrirMundo !== undefined && sistema !== undefined && (
            // Botão do grimório: ele dá ao ícone o tamanho certo (o `.lb-btn` não mede SVG).
            <Botao variante="fantasma" largo onClick={onAbrirMundo}>
              <IconeDoLivro nome="livro" />
              Abrir o mundo do {sistema.nome}
            </Botao>
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
              + Jogador
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
          {onMostrarNoAcervo !== undefined && (
            <div className="lb-rpg__dica-npcs">
              <p>Fichas de NPC e de inimigo ficam no Acervo, no livro da esquerda.</p>
              <Botao variante="fantasma" largo onClick={onMostrarNoAcervo}>
                Mostrar no Acervo
              </Botao>
            </div>
          )}
        </div>
      </Ficha>
      {arrasto.fantasma}
    </>
  )
}

export interface PersonagensDaAventuraProps {
  /** Mapa solto: pergunta e vira aventura antes de criar ou importar (`garantirAventura`). `true` = pode seguir. */
  garantirAventura: () => Promise<boolean>
  /**
   * O "Livro de regras" acima dos Personagens. No livro da mesa só com a sala
   * fechada (com ela aberta ele mora na página Mesa, `BotaoDoLivroDeRegras`).
   * Padrão: com o livro.
   */
  comLivro?: boolean
  /**
   * ARRASTAR PARA O MAPA: o elemento do canvas do editor (o mesmo do soltar do
   * acervo) e o tamanho da vista. Ausente = a lista não arrasta.
   */
  mapa?: { host: () => HTMLElement | null; vista: () => TamanhoDaVista | null }
}

/** Abre o livro do sistema em uso; `undefined` quando o sistema não tem livro (ou o mapa não tem sistema). */
function useAbrirLivroDeRegras(): (() => void) | undefined {
  const sistemaId = useAdventureStore(sistemaAtivo)
  const biblioteca = useRpgStore((state) => state.biblioteca)
  const sistema = sistemaPorId(biblioteca, sistemaId)
  return sistema !== undefined && temLivro(sistema) ? () => useRpgStore.getState().abrirLivro() : undefined
}

/** "Livro de regras" sozinho, para a página Mesa do livro da mesa; some quando o sistema não tem livro. */
export function BotaoDoLivroDeRegras() {
  const abrirLivro = useAbrirLivroDeRegras()
  if (abrirLivro === undefined) return null
  return (
    <button type="button" className="gr-bt gr-bt--p lb-rpg__livro-mesa" onClick={abrirLivro}>
      <IconeDoLivro nome="livro" />
      Livro de regras
    </button>
  )
}

/**
 * A seção ligada às stores: o sistema e os personagens EM USO
 * (`sistemaAtivo`/`personagensAtivos`: os da pasta de mapas quando o mapa
 * herda, senão os da aventura; nenhum no mapa solto), as pastas do mestre do
 * mesmo dono, a biblioteca de sistemas e as janelas (`RpgDialogs`).
 */
export function PersonagensDaAventura({ garantirAventura, comLivro = true, mapa }: PersonagensDaAventuraProps) {
  const sistemaId = useAdventureStore(sistemaAtivo)
  const personagens = useAdventureStore(personagensAtivos)
  const nomeDaPasta = useAdventureStore((state) => (herdaDaPasta(state) && state.pasta !== null ? state.pasta.nome : undefined))
  // MUNDO DO LIVRO: só quando o mapa herda da pasta ("Configurar só neste mapa" fica fora do mundo).
  const pastaId = useAdventureStore((state) => (herdaDaPasta(state) && state.pasta !== null ? state.pasta.pastaId : undefined))
  const biblioteca = useRpgStore((state) => state.biblioteca)
  const carregarBiblioteca = useRpgStore((state) => state.carregarBiblioteca)
  const abrirLivro = useAbrirLivroDeRegras()
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
      onMostrarNoAcervo={mostrarNpcsNoAcervo}
      onAbrirLivro={comLivro ? abrirLivro : undefined}
      onAbrirMundo={
        pastaId === undefined || sistemaId === undefined
          ? undefined
          : () => void useMundoDoLivroStore.getState().abrir({ sistemaId, pastaId, origem: 'editor' })
      }
      onAbrirFicha={(id) => useRpgStore.getState().abrirFicha(id)}
      casaNaTela={mapa === undefined ? undefined : (clientX, clientY) => casaSobOPonteiro(mapa.host(), clientX, clientY)?.tela ?? null}
      tokenNaTela={
        mapa === undefined
          ? undefined
          : (clientX, clientY) => {
              const token = tokenSobOPonteiro(mapa.host(), clientX, clientY)
              return token === null ? null : { tela: token.tela, nome: token.nome, quantos: token.tokenIds.length }
            }
      }
      onSoltarNoMapa={
        mapa === undefined
          ? undefined
          : (personagem, clientX, clientY) => {
              // Em cima de um token, a ficha LIGA a ele (ou à seleção de vários); fora de token, nasce um token novo.
              const token = tokenSobOPonteiro(mapa.host(), clientX, clientY)
              if (token !== null) {
                void ligarFichaAosTokens(personagem.id, token.tokenIds)
                return true
              }
              const casa = casaSobOPonteiro(mapa.host(), clientX, clientY)
              if (casa === null) return false
              void porPersonagemNoMapa(personagem, casa.mundo, mapa.vista())
              return true
            }
      }
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
