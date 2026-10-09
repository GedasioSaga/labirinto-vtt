import { useEffect, useId, useState, type CSSProperties } from 'react'
import { escolherTextoJson } from '../lib/arquivosDaFicha'
import { importarFichasDoProjetoRpg } from '../lib/importarDoProjetoRpg'
import type { SavedMapEntry } from '../lib/mapFileIO'
import { rpgDoMapaSalvo, type PastaDeMapas, type RpgDaPasta } from '../lib/pastasDeMapas'
import type { Personagem } from '../lib/personagem'
import { buildTokenPhotoData } from '../lib/tokenPhoto'
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

/** Os de `novos` cujo id a pasta ainda não tem: copiar duas vezes do mesmo mapa não duplica ninguém. */
function semRepetir(atuais: readonly Personagem[], novos: readonly Personagem[]): Personagem[] {
  const ids = new Set(atuais.map((personagem) => personagem.id))
  return novos.filter((personagem) => !ids.has(personagem.id))
}

function nomes(personagens: readonly Personagem[]): string {
  return personagens.map((personagem) => personagem.nome).join(', ')
}

/**
 * "Configurar pasta": o SISTEMA UNIVERSAL e os JOGADORES PRINCIPAIS da pasta
 * — importados UMA vez, para todos os mapas dela (a mesma ficha em todos).
 * Os jogadores entram pelo arquivo do projeto-rpg-v2, como na aba Jogo, ou
 * copiados de um mapa da pasta (a aventura que já tinha a mesa montada).
 */
export function PastaDeMapasConfig({ pasta, rpg, mapas, onMudar, onFechar }: PastaDeMapasConfigProps) {
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

  const trocarSistema = (sistemaId: string) =>
    executar(async () => {
      await onMudar((atual) => (sistemaId === '' ? { personagens: atual.personagens } : { ...atual, sistemaDeRpg: sistemaId }))
      return sistemaId === '' ? 'A pasta só organiza: cada mapa usa o próprio sistema e personagens.' : null
    })

  const importarDoArquivo = () =>
    executar(async () => {
      if (sistema === undefined) return null
      const texto = await escolherTextoJson('Importar personagens do projeto-rpg-v2', 'Fichas do projeto-rpg-v2')
      if (texto === null) return null
      const resultado = await importarFichasDoProjetoRpg(texto, sistema, rpg.personagens, { reduzirImagem: buildTokenPhotoData })
      await onMudar((atual) => ({ ...atual, personagens: [...atual.personagens, ...semRepetir(atual.personagens, resultado.personagens)] }))
      return resultado.personagens.length === 0 ? 'Nenhum personagem entrou.' : `Entraram na pasta: ${nomes(resultado.personagens)}.`
    })

  const copiarDoMapa = () =>
    executar(async () => {
      const doMapa = await rpgDoMapaSalvo(origem)
      if (doMapa === null) return 'Esse mapa não tem sistema nem personagens para copiar.'
      const novos = semRepetir(rpg.personagens, doMapa.personagens)
      await onMudar((atual) => {
        const personagens = [...atual.personagens, ...semRepetir(atual.personagens, doMapa.personagens)]
        // Pasta ainda sem sistema adota o do mapa: as fichas copiadas foram feitas nele.
        const sistemaDeRpg = atual.sistemaDeRpg ?? doMapa.sistemaDeRpg
        return sistemaDeRpg === undefined ? { personagens } : { sistemaDeRpg, personagens }
      })
      return novos.length === 0 ? 'Os personagens desse mapa já estão na pasta.' : `Copiados para a pasta: ${nomes(novos)}.`
    })

  return (
    <div style={painelStyle} aria-label={`Configurar a pasta ${pasta.nome}`} role="group">
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
      <button type="button" className="lb-btn lb-btn--ghost" onClick={onFechar} disabled={ocupado}>
        Fechar
      </button>
    </div>
  )
}
