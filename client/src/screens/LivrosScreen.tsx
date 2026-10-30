import { useCallback, useEffect, useState } from 'react'
import { IconeDoMundo } from '../components/livros/icones'
import { MundoDoLivro } from '../components/livros/MundoDoLivro'
import { ehEmbutido } from '../lib/bibliotecaDeSistemas'
import { entraNaBatalha } from '../lib/livros/combate'
import { lerIndiceDasPastas, lerRpgDaPasta } from '../lib/pastasDeMapas'
import type { SistemaDeRpg } from '../lib/sistemaDeRpg'
import { ID_ONE_PIECE } from '../lib/sistemaOnePiece'
import { useMundoDoLivroStore } from '../stores/mundoDoLivroStore'
import { useRpgStore } from '../stores/rpgStore'
import { MenuShell } from './MenuShell'
import '../components/livros/mundo.css'
import './MainMenu.css'

/**
 * MUNDO DO LIVRO DE REGRAS — a porta 04 da tela inicial (M1,
 * docs/planos/livros-de-regras-plano.md §3): passo 1, a escolha do sistema;
 * passo 2, a campanha, só quando mais de uma pasta usa o sistema (decisão
 * D4, lembrando a última); passo 3, o `MundoDoLivro`
 * (components/livros/MundoDoLivro.tsx). Porte do protótipo aprovado
 * (docs/design/livros-de-regras/).
 */
export interface LivrosScreenProps {
  /** Volta à tela inicial (`parentScreen('livros')`). */
  onBack: () => void
}

/** Uma pasta de mapas que usa um sistema, com o que a escolha mostra. */
interface PastaComSistema {
  id: string
  nome: string
  sistemaId: string
  jogadores: number
  npcs: number
  /** Os mapas que usam os personagens da pasta (fora os de "Configurar só neste mapa"). */
  mapas: number
}

type Passo = { tipo: 'sistemas' } | { tipo: 'campanha'; sistema: SistemaDeRpg } | { tipo: 'mundo' }

/** Só o One Piece tem mundo do livro nesta fase: a batalha automática e os NPCs de combate são dele. */
const SISTEMAS_COM_MUNDO: ReadonlySet<string> = new Set([ID_ONE_PIECE])

const CHAVE_DA_ULTIMA = 'lb-livros:ultima-pasta:'

/** localStorage pode faltar ou lançar (janela privada): sem a última, a lista fica na ordem das pastas. */
function lerUltima(sistemaId: string): string | null {
  try {
    return window.localStorage.getItem(CHAVE_DA_ULTIMA + sistemaId)
  } catch {
    return null
  }
}

function gravarUltima(sistemaId: string, pastaId: string): void {
  try {
    window.localStorage.setItem(CHAVE_DA_ULTIMA + sistemaId, pastaId)
  } catch {
    // Sem armazenamento, a próxima escolha só não vem lembrada.
  }
}

/** As pastas que têm "Sistema universal", com as contagens. Nunca lança: o que não leu vira aviso. */
async function lerPastasComSistema(): Promise<{ pastas: PastaComSistema[]; aviso: string | null }> {
  const { indice, aviso } = await lerIndiceDasPastas()
  let ilegiveis = 0
  const lidas = await Promise.all(
    indice.pastas.map(async (pasta): Promise<PastaComSistema | null> => {
      const lido = await lerRpgDaPasta(pasta.id)
      if (!lido.ok) {
        ilegiveis += 1
        return null
      }
      const sistemaId = lido.rpg.sistemaDeRpg
      if (sistemaId === undefined) return null
      const { personagens } = lido.rpg
      return {
        id: pasta.id,
        nome: pasta.nome,
        sistemaId,
        jogadores: personagens.filter((personagem) => personagem.tipo === 'jogador').length,
        npcs: personagens.filter((personagem) => personagem.tipo === 'npc' && entraNaBatalha(personagem)).length,
        mapas: indice.mapas.filter((lugar) => lugar.pastaId === pasta.id && lugar.proprio !== true).length,
      }
    }),
  )
  const avisoDasPastas = ilegiveis === 0 ? null : `${ilegiveis === 1 ? 'Uma pasta não pôde ser lida' : `${ilegiveis} pastas não puderam ser lidas`} e ficou de fora.`
  return { pastas: lidas.filter((pasta): pasta is PastaComSistema => pasta !== null), aviso: aviso ?? avisoDasPastas }
}

function plural(n: number, um: string, varios: string): string {
  return n === 1 ? um : varios
}

function DadosDaPasta({ jogadores, npcs, mapas }: { jogadores: number; npcs: number; mapas: number | null }) {
  return (
    <span className="mu-sis__dados">
      <span>
        <b>{jogadores}</b> {plural(jogadores, 'jogador', 'jogadores')}
      </span>
      <span>
        <b>{npcs}</b> {plural(npcs, 'NPC de combate', 'NPCs de combate')}
      </span>
      {mapas !== null && (
        <span>
          <b>{mapas}</b> {plural(mapas, 'mapa na pasta', 'mapas na pasta')}
        </span>
      )}
    </span>
  )
}

function CartaoDoSistema({ sistema, pastas, onEscolher }: { sistema: SistemaDeRpg; pastas: readonly PastaComSistema[]; onEscolher: () => void }) {
  const motivoId = `mu-sis-motivo-${sistema.id}`
  const temMundo = SISTEMAS_COM_MUNDO.has(sistema.id)
  let motivo: string | null = null
  if (!temMundo) motivo = 'Ainda sem mundo do livro: por enquanto só o One Piece tem batalha automática e NPCs de combate.'
  else if (pastas.length === 0) motivo = `Nenhuma pasta de mapas usa o ${sistema.nome}. Em Carregar Mapa, abra a configuração de uma pasta e escolha ${sistema.nome} em Sistema universal.`
  const unica = pastas.length === 1 ? pastas[0] : undefined
  const soma = (campo: 'jogadores' | 'npcs') => pastas.reduce((total, pasta) => total + pasta[campo], 0)

  return (
    <li>
      <button type="button" className="mu-sis" disabled={motivo !== null} aria-describedby={motivo !== null ? motivoId : undefined} onClick={onEscolher}>
        <span className="mu-sis__lombada" aria-hidden="true">
          <IconeDoMundo nome={temMundo ? 'bussola' : 'livro'} />
        </span>
        <span>
          <span className="mu-sis__nome">{sistema.nome}</span>
          <span className="mu-sis__quem">{ehEmbutido(sistema.id) ? 'Vem com o app · batalha automática' : 'Importado ou criado por você'}</span>
        </span>
        {motivo !== null ? (
          <span className="mu-sis__motivo" id={motivoId}>
            {motivo}
          </span>
        ) : unica !== undefined ? (
          <DadosDaPasta jogadores={unica.jogadores} npcs={unica.npcs} mapas={unica.mapas} />
        ) : (
          <span className="mu-sis__dados">
            <span>
              <b>{pastas.length}</b> pastas usam
            </span>
            <span>
              <b>{soma('jogadores')}</b> {plural(soma('jogadores'), 'jogador', 'jogadores')}
            </span>
            <span>
              <b>{soma('npcs')}</b> {plural(soma('npcs'), 'NPC de combate', 'NPCs de combate')}
            </span>
          </span>
        )}
      </button>
    </li>
  )
}

export function LivrosScreen({ onBack }: LivrosScreenProps) {
  const biblioteca = useRpgStore((state) => state.biblioteca)
  const [pastas, setPastas] = useState<PastaComSistema[] | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [passo, setPasso] = useState<Passo>({ tipo: 'sistemas' })

  const lerPastas = useCallback(() => {
    let vivo = true
    void lerPastasComSistema().then((lido) => {
      if (!vivo) return
      setPastas(lido.pastas)
      setAviso(lido.aviso)
    })
    return () => {
      vivo = false
    }
  }, [])

  useEffect(() => {
    void useRpgStore.getState().carregarBiblioteca()
    return lerPastas()
  }, [lerPastas])

  // Saiu da tela com o mundo aberto daqui: ele fecha junto (o do editor é de outra camada).
  useEffect(
    () => () => {
      if (useMundoDoLivroStore.getState().aberto?.origem === 'inicio') useMundoDoLivroStore.getState().fechar()
    },
    [],
  )

  const abrirMundo = (sistema: SistemaDeRpg, pasta: PastaComSistema) => {
    gravarUltima(sistema.id, pasta.id)
    void useMundoDoLivroStore.getState().abrir({ sistemaId: sistema.id, pastaId: pasta.id, origem: 'inicio' })
    setPasso({ tipo: 'mundo' })
  }

  const escolherSistema = (sistema: SistemaDeRpg, usando: readonly PastaComSistema[]) => {
    const unica = usando.length === 1 ? usando[0] : undefined
    if (unica !== undefined) abrirMundo(sistema, unica)
    else if (usando.length > 1) setPasso({ tipo: 'campanha', sistema })
  }

  if (passo.tipo === 'mundo') {
    return (
      <MundoDoLivro
        onFechar={() => {
          useMundoDoLivroStore.getState().fechar()
          setPasso({ tipo: 'sistemas' })
          lerPastas()
        }}
      />
    )
  }

  if (passo.tipo === 'campanha') {
    const { sistema } = passo
    const ultima = lerUltima(sistema.id)
    const usando = (pastas ?? []).filter((pasta) => pasta.sistemaId === sistema.id)
    // A última aberta primeiro: é a que o mestre quer quase sempre.
    const ordem = [...usando].sort((a, b) => Number(b.id === ultima) - Number(a.id === ultima))
    return (
      <MenuShell title={sistema.nome} subtitle="Escolha a campanha" onBack={() => setPasso({ tipo: 'sistemas' })} wide crumbs={['Labirinto', 'Livros de regras']}>
        <p className="mu-escolha-aviso">Mais de uma pasta de mapas usa o {sistema.nome}. Cada uma tem os próprios jogadores e NPCs.</p>
        <ul className="mu-sis-lista">
          {ordem.map((pasta) => (
            <li key={pasta.id}>
              <button type="button" className="mu-sis" onClick={() => abrirMundo(sistema, pasta)}>
                <span className="mu-sis__lombada" aria-hidden="true">
                  <IconeDoMundo nome="cenario" />
                </span>
                <span>
                  <span className="mu-sis__nome">{pasta.nome}</span>
                  <span className="mu-sis__quem">Pasta de mapas</span>
                </span>
                <DadosDaPasta jogadores={pasta.jogadores} npcs={pasta.npcs} mapas={pasta.mapas} />
                {pasta.id === ultima && <span className="mu-etiqueta mu-etiqueta--ultima mu-sis__ultima">Última aberta</span>}
              </button>
            </li>
          ))}
        </ul>
      </MenuShell>
    )
  }

  return (
    <MenuShell title="Livros de regras" subtitle="Escolha o sistema para trabalhar dentro das regras dele" onBack={onBack} wide crumbs={['Labirinto']}>
      {pastas === null ? (
        <p className="mu-escolha-aviso" aria-busy="true">
          Lendo as pastas de mapas…
        </p>
      ) : (
        <ul className="mu-sis-lista">
          {biblioteca.map((sistema) => {
            const usando = pastas.filter((pasta) => pasta.sistemaId === sistema.id)
            return <CartaoDoSistema key={sistema.id} sistema={sistema} pastas={usando} onEscolher={() => escolherSistema(sistema, usando)} />
          })}
        </ul>
      )}
      {aviso !== null && <p className="mu-escolha-aviso mu-escolha-aviso--erro">{aviso}</p>}
    </MenuShell>
  )
}
