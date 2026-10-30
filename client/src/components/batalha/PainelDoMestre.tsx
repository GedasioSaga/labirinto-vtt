import { useMemo, useState, type FormEvent } from 'react'
import type { Desempate } from '../../lib/batalha/turnos'
import { equipesAtivas, personagensAtivos, sistemaAtivo, useAdventureStore } from '../../stores/adventureStore'
import { useBatalhaStore } from '../../stores/batalhaStore'
import { useMapStore } from '../../stores/mapStore'
import { REGRAS_AINDA_LENDO, REGRAS_NAO_GRAVAVEIS, useRegrasDoCampoStore } from '../../stores/regrasDoCampoStore'
import { sistemaPorId, useRpgStore } from '../../stores/rpgStore'
import { useToastStore } from '../../stores/toastStore'
import { Acoes, Botao } from '../grimorio/Botao'
import { Dialogo } from '../grimorio/Dialogo'
import { BibliotecaDeRegrasDialog } from './BibliotecaDeRegrasDialog'
import { faixaDoMestre, linhasDoMestre } from './dadosDaFaixa'
import { EquipesDialog } from './EquipesDialog'
import { EscolhaDaRegra, confirmarRascunho, rascunhoDe, type RascunhoDaRegra } from './EscolhaDaRegra'
import { PainelDaBatalha, type FichaForaDaOrdem } from './PainelDaBatalha'

/**
 * O painel da batalha do MESTRE, montado pelo `ControleDaBatalha` com a
 * batalha ligada: lê a cena na store e liga o painel, as Equipes, a
 * Biblioteca de regras e o "Mudar regras". Toda ação vai direto à store.
 */

export interface PainelDoMestreProps {
  sceneKey: string
}

const MESTRE = { tipo: 'mestre' } as const
const SEM_DONO_DAS_EQUIPES = 'Sem aventura aberta: as equipes moram na aventura (ou na pasta de mapas). Abra uma para criar equipes.'

/** Por que a biblioteca não grava agora; `null` = grava. */
export function motivoParaNaoGuardar(carregando: boolean, podeGravar: boolean): string | null {
  if (carregando) return REGRAS_AINDA_LENDO
  return podeGravar ? null : REGRAS_NAO_GRAVAVEIS
}

export function PainelDoMestre({ sceneKey }: PainelDoMestreProps) {
  const cena = useBatalhaStore((state) => (Object.hasOwn(state.cenas, sceneKey) ? state.cenas[sceneKey] : undefined))
  const fichas = useMapStore((state) => state.map.tokens)
  const personagens = useAdventureStore(personagensAtivos)
  const equipes = useAdventureStore(equipesAtivas)
  const sistemaId = useAdventureStore(sistemaAtivo)
  const biblioteca = useRpgStore((state) => state.biblioteca)
  const sistema = useMemo(() => sistemaPorId(biblioteca, sistemaId) ?? null, [biblioteca, sistemaId])
  const regrasDaBiblioteca = useRegrasDoCampoStore((state) => state.regras)
  const carregando = useRegrasDoCampoStore((state) => state.carregando)
  const podeGravar = useRegrasDoCampoStore((state) => state.podeGravar)
  const naoGuarda = motivoParaNaoGuardar(carregando, podeGravar)
  const [equipesAbertas, setEquipesAbertas] = useState(false)
  const [bibliotecaAberta, setBibliotecaAberta] = useState(false)
  const [mudarAberto, setMudarAberto] = useState(false)
  const [rascunho, setRascunho] = useState<RascunhoDaRegra>({ modo: 'nenhuma' })

  const turnos = cena?.turnos
  const dados = useMemo(() => (turnos === undefined ? null : faixaDoMestre({ turnos, fichas, personagens, equipes, sistema })), [turnos, fichas, personagens, equipes, sistema])
  const registro = useMemo(() => (cena === undefined ? [] : linhasDoMestre(cena.registro)), [cena])
  const foraDaOrdem = useMemo<FichaForaDaOrdem[]>(() => {
    if (turnos === undefined) return []
    const naOrdem = new Set(turnos.cartas.map((carta) => carta.tokenId))
    return fichas.filter((ficha) => !naOrdem.has(ficha.id)).map((ficha) => ({ tokenId: ficha.id, nome: `${ficha.name.trim() || 'Ficha sem nome'}${ficha.hidden === true ? ' (escondida)' : ''}` }))
  }, [turnos, fichas])

  if (cena === undefined || dados === null) return null
  const store = () => useBatalhaStore.getState()

  const aplicarRegras = (evento: FormEvent) => {
    evento.preventDefault()
    store().definirRegras(sceneKey, confirmarRascunho(rascunho, regrasDaBiblioteca, useRegrasDoCampoStore.getState()))
    setMudarAberto(false)
  }

  return (
    <>
      <PainelDaBatalha
        dados={dados}
        onPassarVez={() => store().passarVez(sceneKey, MESTRE)}
        onOrdenar={() => store().ordenarPelaAgilidade(sceneKey)}
        desempate={cena.turnos.desempate}
        onDesempate={(desempate: Desempate) => store().trocarDesempate(sceneKey, desempate)}
        foraDaOrdem={foraDaOrdem}
        onIncluir={(tokenId) => {
          const ficha = fichas.find((candidata) => candidata.id === tokenId)
          if (ficha !== undefined) store().incluirCombatente(sceneKey, { id: ficha.id, characterId: ficha.characterId, name: ficha.name })
        }}
        regras={cena.regras}
        onMudarRegras={() => {
          void useRegrasDoCampoStore.getState().carregar()
          setRascunho(rascunhoDe(cena.regras, regrasDaBiblioteca))
          setMudarAberto(true)
        }}
        onBiblioteca={() => {
          void useRegrasDoCampoStore.getState().carregar()
          setBibliotecaAberta(true)
        }}
        equipes={equipes}
        onEquipes={() => setEquipesAbertas(true)}
        registro={registro}
        onDesfazer={(linhaId) => store().desfazer(sceneKey, linhaId, MESTRE)}
      />
      <Dialogo aberto={mudarAberto} titulo="Regras do campo desta batalha" pequeno descricao="Muda só esta batalha; os jogadores leem a regra nova na hora." onFechar={() => setMudarAberto(false)}>
        <form className="gr-batalha-dlg" onSubmit={aplicarRegras}>
            <EscolhaDaRegra biblioteca={regrasDaBiblioteca} valor={rascunho} onChange={setRascunho} naoGuarda={naoGuarda} />
            <Acoes>
              <Botao tipo="submit" variante="primario">
                Aplicar
              </Botao>
              <Botao variante="fantasma" onClick={() => setMudarAberto(false)}>
                Cancelar
              </Botao>
            </Acoes>
          </form>
      </Dialogo>
      <BibliotecaDeRegrasDialog
        aberto={bibliotecaAberta}
        regras={regrasDaBiblioteca}
        naoGuarda={naoGuarda}
        onCriar={(rascunho) => useRegrasDoCampoStore.getState().criarRegra(rascunho)}
        onMudar={(id, mudanca) => useRegrasDoCampoStore.getState().editarRegra(id, mudanca)}
        onApagar={(id) => useRegrasDoCampoStore.getState().apagarRegra(id)}
        onFechar={() => setBibliotecaAberta(false)}
      />
      <EquipesDialog
        aberto={equipesAbertas}
        equipes={equipes}
        personagens={personagens}
        emBatalha
        onSalvarEquipes={(lista) => {
          if (!useAdventureStore.getState().salvarEquipes(lista)) useToastStore.getState().push('info', SEM_DONO_DAS_EQUIPES)
        }}
        onTrocar={(personagemId, equipeId) => {
          if (!store().trocarEquipe(personagemId, equipeId)) useToastStore.getState().push('info', SEM_DONO_DAS_EQUIPES)
        }}
        onFechar={() => setEquipesAbertas(false)}
      />
    </>
  )
}
