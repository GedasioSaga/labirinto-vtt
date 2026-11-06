import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { JogadoresDoLobby } from '../components/nuvem/JogadoresDoLobby'
import { emailRepetidoParado } from '../components/nuvem/textosDoLobby'
import { escolherTextoJson } from '../lib/arquivosDaFicha'
import { importarFichasDoProjetoRpg } from '../lib/importarDoProjetoRpg'
import type { SavedMapEntry } from '../lib/mapFileIO'
import {
  personagensQueAPastaNaoTem,
  rpgComOsPersonagensDoMapa,
  rpgComSistema,
  rpgDoMapaSalvo,
  type PastaDeMapas,
  type RpgDaPasta,
} from '../lib/pastasDeMapas'
import type { Personagem } from '../lib/personagem'
import { buildTokenPhotoData } from '../lib/tokenPhoto'
import { fichasEntramNaPasta, trocarSistemaDaPasta } from '../net/nuvem/mochilaPendenteNoApp'
import { useContasStore } from '../stores/contasStore'
import { useNuvemStore } from '../stores/nuvemStore'
import { sistemaPorId, useRpgStore } from '../stores/rpgStore'

export interface PastaDeMapasConfigProps {
  pasta: PastaDeMapas
  /** O RPG da pasta como está no disco; `null` = não deu para ler (nada se grava por cima). */
  rpg: RpgDaPasta | null
  /** Os mapas da pasta, para "Copiar de um mapa". */
  mapas: readonly SavedMapEntry[]
  /** Grava a mudança no disco (e na cópia aberta, se for a pasta do mapa aberto). Lança com a razão. */
  onMudar: (mudar: (rpg: RpgDaPasta) => RpgDaPasta) => Promise<void>
  onFechar: () => void
}

const painelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--lb-space-3)',
  padding: 'var(--lb-space-3) var(--lb-space-4)',
  border: '1px solid var(--lb-color-line)',
  borderRadius: 'var(--lb-radius-md)',
}

const linhaStyle: CSSProperties = { display: 'flex', gap: 'var(--lb-space-2)', flexWrap: 'wrap', alignItems: 'center' }

function nomes(personagens: readonly Personagem[]): string {
  return personagens.map((personagem) => personagem.nome).join(', ')
}

type AbaDaPasta = 'sistema' | 'lobby'

const ABAS: readonly { id: AbaDaPasta; rotulo: string }[] = [
  { id: 'sistema', rotulo: 'Sistema e personagens' },
  { id: 'lobby', rotulo: 'Jogadores do Lobby' },
]

/** O selo da aba do Lobby: mudanças esperando decisão e jogadores que não conseguem entrar no site. */
function useAvisosDoLobby(pastaId: string): number {
  const paraDecidir = useNuvemStore((state) => Object.values(state.campanhas).find((campanha) => campanha.pastaId === pastaId)?.paraDecidir.length ?? 0)
  const contas = useContasStore((state) => state.arquivo.contas)
  const semEntrar = contas.filter((conta) => conta.email === undefined || emailRepetidoParado(contas, conta)).length
  return paraDecidir + semEntrar
}

/**
 * "Configurar pasta", em duas abas. SISTEMA E PERSONAGENS: o sistema universal
 * e os jogadores principais da pasta — importados UMA vez, para todos os
 * mapas dela (a mesma ficha em todos), pelo arquivo do projeto-rpg-v2 ou
 * copiados de um mapa da pasta. JOGADORES DO LOBBY (fatia A6): publicar a
 * pasta no site, quem entra e de quem é cada ficha (`components/nuvem/`).
 */
export function PastaDeMapasConfig(props: PastaDeMapasConfigProps) {
  const { pasta, rpg, onMudar, onFechar } = props
  const baseId = useId()
  const [aba, setAba] = useState<AbaDaPasta>('sistema')
  const abasRef = useRef<Partial<Record<AbaDaPasta, HTMLButtonElement | null>>>({})
  const biblioteca = useRpgStore((state) => state.biblioteca)
  const avisos = useAvisosDoLobby(pasta.id)

  useEffect(() => {
    void useContasStore.getState().carregar()
  }, [])

  if (rpg === null) return <SistemaDaPasta {...props} />

  /** Setas, Home e End trocam de aba na hora e levam o foco junto (a fileira é uma parada só do Tab). */
  const andarNasAbas = (event: KeyboardEvent<HTMLDivElement>) => {
    const atual = ABAS.findIndex((candidata) => candidata.id === aba)
    let proxima = atual
    if (event.key === 'ArrowRight') proxima = (atual + 1) % ABAS.length
    else if (event.key === 'ArrowLeft') proxima = (atual - 1 + ABAS.length) % ABAS.length
    else if (event.key === 'Home') proxima = 0
    else if (event.key === 'End') proxima = ABAS.length - 1
    else return
    event.preventDefault()
    const destino = ABAS[proxima].id
    setAba(destino)
    abasRef.current[destino]?.focus()
  }

  return (
    <div style={painelStyle} aria-label={`Configurar a pasta ${pasta.nome}`} role="group">
      <div className="pasta-abas" role="tablist" aria-label="Configurar a pasta" data-aba={aba} onKeyDown={andarNasAbas}>
        <span className="pasta-abas__pilula" aria-hidden="true" />
        {ABAS.map((candidata) => (
          <button
            key={candidata.id}
            ref={(elemento) => {
              abasRef.current[candidata.id] = elemento
            }}
            type="button"
            role="tab"
            className="pasta-aba"
            id={`${baseId}-aba-${candidata.id}`}
            aria-controls={`${baseId}-painel`}
            aria-selected={aba === candidata.id}
            tabIndex={aba === candidata.id ? 0 : -1}
            onClick={() => setAba(candidata.id)}
          >
            {candidata.rotulo}
            {candidata.id === 'lobby' && avisos > 0 && (
              <span className="pasta-aba__selo">
                <span aria-hidden="true">{avisos}</span>
                <span className="lby-sr">, {avisos === 1 ? '1 aviso' : `${avisos} avisos`}</span>
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="pasta-painel" role="tabpanel" id={`${baseId}-painel`} aria-labelledby={`${baseId}-aba-${aba}`} tabIndex={0}>
        {aba === 'sistema' ? (
          <SistemaDaPasta {...props} semMoldura />
        ) : (
          <JogadoresDoLobby pasta={pasta} rpg={rpg} sistema={sistemaPorId(biblioteca, rpg.sistemaDeRpg)} onMudar={onMudar} />
        )}
      </div>
      <button type="button" className="lb-btn lb-btn--ghost" onClick={onFechar}>
        Fechar
      </button>
    </div>
  )
}

/**
 * A aba de sempre: o SISTEMA UNIVERSAL e os JOGADORES PRINCIPAIS da pasta.
 * Com `semMoldura`, vive dentro das abas (a moldura e o Fechar são delas);
 * sem, é o painel inteiro (só no aviso de RPG ilegível).
 */
function SistemaDaPasta({ pasta, rpg, mapas, onMudar, onFechar, semMoldura = false }: PastaDeMapasConfigProps & { semMoldura?: boolean }) {
  const baseId = useId()
  const biblioteca = useRpgStore((state) => state.biblioteca)
  const carregarBiblioteca = useRpgStore((state) => state.carregarBiblioteca)
  const [ocupado, setOcupado] = useState(false)
  const [estado, setEstado] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [origem, setOrigem] = useState(mapas[0]?.id ?? '')

  // Sistema importado só se acha depois de ler a pasta da biblioteca.
  useEffect(() => {
    void carregarBiblioteca()
  }, [carregarBiblioteca])

  if (rpg === null) {
    return (
      <div style={painelStyle} role="alert">
        <p className="lb-field__error" style={{ margin: 0 }}>
          Não deu para ler os personagens desta pasta: nada aqui foi mudado. Os mapas dela abrem com o próprio sistema e personagens.
        </p>
        <button type="button" className="lb-btn lb-btn--ghost" onClick={onFechar}>
          Fechar
        </button>
      </div>
    )
  }

  const sistema = sistemaPorId(biblioteca, rpg.sistemaDeRpg)

  /** Roda uma mudança com o painel ocupado; o resultado (ou a razão da falha) vira a linha de estado. */
  const executar = async (acao: () => Promise<string | null>) => {
    setOcupado(true)
    setEstado(null)
    try {
      const texto = await acao()
      if (texto !== null) setEstado({ tipo: 'ok', texto })
    } catch (erro) {
      setEstado({ tipo: 'erro', texto: erro instanceof Error ? erro.message : String(erro) })
    } finally {
      setOcupado(false)
    }
  }

  /** A mudança que pode trocar o sistema da pasta: a pasta convertida que volta a ter sistema confere antes a mochila dos bonecos. */
  const mudarComOSistema = (mudar: (rpg: RpgDaPasta) => RpgDaPasta) => trocarSistemaDaPasta(pasta.id, rpg.sistemaDeRpg === undefined, mudar, onMudar)

  const trocarSistema = (sistemaId: string) =>
    executar(async () => {
      // Troca só o sistema: as equipes e o marcador da mochila seguem (voltar a um sistema não converte de novo).
      await mudarComOSistema((atual) => rpgComSistema(atual, sistemaId === '' ? null : sistemaId))
      return sistemaId === '' ? 'A pasta só organiza: cada mapa usa o próprio sistema e personagens.' : null
    })

  const importarDoArquivo = () =>
    executar(async () => {
      if (sistema === undefined) return null
      const texto = await escolherTextoJson('Importar personagens do projeto-rpg-v2', 'Fichas do projeto-rpg-v2')
      if (texto === null) return null
      const resultado = await importarFichasDoProjetoRpg(texto, sistema, rpg.personagens, { reduzirImagem: buildTokenPhotoData })
      const novos = personagensQueAPastaNaoTem(rpg.personagens, resultado.personagens)
      // Pasta convertida: o que os bonecos dessas fichas carregam vira aviso antes de a ficha (sem mochila) valer.
      await fichasEntramNaPasta(pasta.id, novos, () =>
        onMudar((atual) => ({ ...atual, personagens: [...atual.personagens, ...personagensQueAPastaNaoTem(atual.personagens, resultado.personagens)] })),
      )
      return resultado.personagens.length === 0 ? 'Nenhum personagem entrou.' : `Entraram na pasta: ${nomes(resultado.personagens)}.`
    })

  const copiarDoMapa = () =>
    executar(async () => {
      const doMapa = await rpgDoMapaSalvo(origem)
      if (doMapa === null) return 'Esse mapa não tem sistema nem personagens para copiar.'
      const novos = personagensQueAPastaNaoTem(rpg.personagens, doMapa.personagens)
      // Pasta ainda sem sistema adota o do mapa; as equipes e o marcador da mochila da pasta seguem.
      // Pasta convertida: o que os bonecos das fichas copiadas carregam vira aviso antes de a ficha (sem mochila) valer.
      await fichasEntramNaPasta(pasta.id, novos, () => mudarComOSistema((atual) => rpgComOsPersonagensDoMapa(atual, doMapa)))
      return novos.length === 0 ? 'Os personagens desse mapa já estão na pasta.' : `Copiados para a pasta: ${nomes(novos)}.`
    })

  const conteudo = (
    <>
      <div className="lb-field">
        <label className="lb-label" htmlFor={`${baseId}-sistema`}>
          Sistema universal
        </label>
        <select
          id={`${baseId}-sistema`}
          className="lb-input"
          value={rpg.sistemaDeRpg ?? ''}
          disabled={ocupado}
          onChange={(event) => void trocarSistema(event.target.value)}
        >
          <option value="">Nenhum: cada mapa usa o próprio</option>
          {biblioteca.map((candidato) => (
            <option key={candidato.id} value={candidato.id}>
              {candidato.nome}
            </option>
          ))}
          {rpg.sistemaDeRpg !== undefined && sistema === undefined && <option value={rpg.sistemaDeRpg}>{rpg.sistemaDeRpg} (não está neste computador)</option>}
        </select>
        <p className="lb-field__hint">
          Com um sistema, todo mapa desta pasta usa ele e os jogadores abaixo — a mesma ficha em todos (o HP perdido num mapa continua perdido no outro). Um mapa
          pode preferir o próprio em Configurações do mapa, &quot;Configurar só neste mapa&quot;.
        </p>
      </div>

      <div className="lb-field">
        <span className="lb-label">Jogadores principais</span>
        <p className="lb-field__hint" style={{ margin: 0 }}>
          {rpg.personagens.length === 0 ? 'Nenhum ainda.' : nomes(rpg.personagens)}
        </p>
        <div style={linhaStyle}>
          <button type="button" className="lb-btn lb-btn--ghost" disabled={ocupado || sistema === undefined} onClick={() => void importarDoArquivo()}>
            Importar personagens…
          </button>
        </div>
        {sistema === undefined && <p className="lb-field__hint">Escolha o sistema universal para importar personagens do arquivo.</p>}
        {mapas.length > 0 && (
          <div style={linhaStyle}>
            <label className="lb-label" htmlFor={`${baseId}-origem`}>
              Copiar de um mapa
            </label>
            <select id={`${baseId}-origem`} className="lb-input" value={origem} disabled={ocupado} onChange={(event) => setOrigem(event.target.value)}>
              {mapas.map((mapa) => (
                <option key={mapa.id} value={mapa.id}>
                  {mapa.name}
                </option>
              ))}
            </select>
            <button type="button" className="lb-btn lb-btn--ghost" disabled={ocupado || origem === ''} onClick={() => void copiarDoMapa()}>
              Copiar
            </button>
          </div>
        )}
      </div>

      {estado !== null && (
        <p className={estado.tipo === 'erro' ? 'lb-field__error' : 'lb-field__hint'} role={estado.tipo === 'erro' ? 'alert' : 'status'} style={{ margin: 0 }}>
          {estado.texto}
        </p>
      )}
    </>
  )

  if (semMoldura) return conteudo
  return (
    <div style={painelStyle} aria-label={`Configurar a pasta ${pasta.nome}`} role="group">
      {conteudo}
      <button type="button" className="lb-btn lb-btn--ghost" onClick={onFechar} disabled={ocupado}>
        Fechar
      </button>
    </div>
  )
}
