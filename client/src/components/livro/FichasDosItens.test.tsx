import { act, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { criarMovel } from '../../lib/mobilia'
import type { Prop } from '../../types/map'
import { ConcealZoneControls } from '../ConcealZoneControls'
import { LightControls } from '../LightControls'
import { CabecaDaSelecao, virarPortaAction, zonaIdentity } from './CabecaDaSelecao'
import { FichaDaParede } from './FichaDaParede'
import { FichaDoObjeto, type FichaDoObjetoProps } from './FichaDoObjeto'

/*
 * Fichas da parede, do objeto, da luz e da zona oculta (fatia 16a do design
 * consolidado): a gramática da porta — essencial à vista, fichas recolhidas e
 * o raro no "Mais ações" — sem perder nenhum controle de antes.
 */

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  // A escolha de abrir ou fechar cada ficha é lembrada: cada teste começa do padrão.
  localStorage.clear()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

const montar = (no: ReactElement) => act(() => root.render(no))
const titulosDasFichas = () => Array.from(container.querySelectorAll('.gr-ficha__tit')).map((t) => t.textContent)
/** O cartão recolhível inteiro (cabeçalho e miolo) pelo título. */
const ficha = (titulo: string) => Array.from(container.querySelectorAll('.gr-ficha')).find((f) => f.querySelector('.gr-ficha__tit')?.textContent === titulo) ?? null
/** Fechada, o miolo fica inerte (fora do Tab e do leitor de tela). Ficha que não existe é erro, não "fechada". */
function fechada(titulo: string): boolean {
  const cartao = ficha(titulo)
  if (cartao === null) throw new Error('sem a ficha ' + titulo)
  return cartao.querySelector('[inert]') !== null
}
const resumoDaFicha = (titulo: string) => ficha(titulo)?.querySelector('.gr-ficha__resumo')?.textContent ?? null
const tituloOculto = () => container.querySelector('h2.gr-sr')?.textContent

describe('FichaDaParede', () => {
  it('essencial com cor, espessura, ajuste fino e o Avançado; "O que a parede deixa" e "Tipo" nascem fechadas, com resumo', () => {
    montar(
      <FichaDaParede
        estilo={{
          wallKind: undefined,
          onWallKindChange: vi.fn(),
          onThicknessChange: vi.fn(),
          janela: false,
          onJanelaChange: vi.fn(),
          passagem: { deixaPassar: true, onDeixaPassarChange: vi.fn(), deixaVer: false, onDeixaVerChange: vi.fn() },
          cor: { color: null, onColorChange: vi.fn() },
          avancado: <button type="button">Avançado</button>,
        }}
      />,
    )
    expect(tituloOculto()).toBe('Parede')
    const essencial = container.querySelector('.gr-essencial')
    expect(essencial?.querySelector('[role="radiogroup"][aria-label="Espessura da parede"]')).not.toBeNull()
    expect(essencial?.querySelector('#lb-wall-thickness')).not.toBeNull()
    expect(essencial?.querySelector('#lb-wall-color')).not.toBeNull()
    expect(essencial?.textContent).toContain('Avançado')
    expect(essencial?.textContent).not.toContain('Parede interna')
    expect(titulosDasFichas()).toEqual(['O que a parede deixa', 'Tipo'])
    expect(ficha('O que a parede deixa')?.textContent).toContain('Janela (vê, não passa)')
    expect(ficha('O que a parede deixa')?.textContent).toContain('Deixa ver (a visão atravessa)')
    expect(ficha('Tipo')?.textContent).toContain('Parede interna')
    expect(fechada('O que a parede deixa')).toBe(true)
    expect(fechada('Tipo')).toBe(true)
    expect(ficha('O que a parede deixa')?.textContent).toContain('Passar')
    expect(ficha('Tipo')?.textContent).toContain('Externa')
  })

  it('sem os handlers da janela e da passagem: só a ficha "Tipo", que diz "Interna"', () => {
    montar(<FichaDaParede estilo={{ wallKind: 'interior', onWallKindChange: vi.fn() }} />)
    expect(titulosDasFichas()).toEqual(['Tipo'])
    expect(ficha('Tipo')?.textContent).toContain('Interna')
  })
})

describe('FichaDoObjeto', () => {
  const ligacoes = (): Omit<FichaDoObjetoProps, 'prop'> => ({
    mobilia: { onTipoChange: vi.fn(), onVistaChange: vi.fn(), onFormaChange: vi.fn(), onAparenciaChange: vi.fn() },
    transform: { onRotationChange: vi.fn(), onLockedChange: vi.fn(), onHiddenChange: vi.fn(), onSecretChange: vi.fn() },
    onSetPropLayer: vi.fn(),
    player: { onLabelChange: vi.fn(), onShowImageChange: vi.fn() },
  })

  it('tapete: Tipo e Forma no essencial; Aparência fechada; No mapa aberta com a camada; Para os jogadores fechada', () => {
    montar(<FichaDoObjeto prop={criarMovel('tapete', { x: 300, y: 200 }, 64, 't1')} {...ligacoes()} />)
    expect(tituloOculto()).toBe('Móvel')
    const essencial = container.querySelector('.gr-essencial')
    expect(essencial?.querySelector('select')).not.toBeNull()
    expect(essencial?.querySelector('[role="radiogroup"][aria-label="Forma"]')).not.toBeNull()
    expect(titulosDasFichas()).toEqual(['Aparência', 'No mapa', 'Para os jogadores'])
    expect(fechada('Aparência')).toBe(true)
    expect(fechada('No mapa')).toBe(false)
    expect(fechada('Para os jogadores')).toBe(true)
    expect(ficha('No mapa')?.querySelector('[role="radiogroup"][aria-label="Camada do objeto selecionado"]')).not.toBeNull()
    expect(ficha('No mapa')?.textContent).toContain('Travado')
    expect(ficha('Para os jogadores')?.textContent).toContain('Rótulo para jogadores')
  })

  it('cama: as cores do travesseiro e do cobertor moram na Aparência, não no essencial', () => {
    montar(<FichaDoObjeto prop={criarMovel('catre', { x: 300, y: 200 }, 64, 'c1')} {...ligacoes()} />)
    expect(ficha('Aparência')?.textContent).toContain('Cor do travesseiro')
    expect(ficha('Aparência')?.textContent).toContain('Cor do cobertor')
    expect(container.querySelector('.gr-essencial')?.textContent).not.toContain('Cor do travesseiro')
  })

  it('imagem sem nenhum campo opcional: sem essencial, só No mapa e Para os jogadores', () => {
    const imagem: Prop = { id: 'img', src: 'x.png', x: 100, y: 100, width: 64, height: 64, linkedMapPath: null }
    montar(<FichaDoObjeto prop={imagem} {...ligacoes()} />)
    expect(tituloOculto()).toBe('Objeto')
    expect(container.querySelector('.gr-essencial')).toBeNull()
    expect(titulosDasFichas()).toEqual(['No mapa', 'Para os jogadores'])
    expect(ficha('Para os jogadores')?.textContent).toContain('Só a silhueta')
  })
})

describe('LightControls', () => {
  const base = { color: '#ffcc66', onColorChange: vi.fn(), intensity: 1, onIntensityChange: vi.fn(), tokens: [{ id: 'a', name: 'Ana' }], attachedTokenId: null, onAttach: vi.fn(), onDetach: vi.fn() }

  it('cor e intensidade no essencial; "Presa a uma ficha" nasce aberta; "Depende do estado" só com a aventura', () => {
    montar(<LightControls {...base} />)
    expect(tituloOculto()).toBe('Luz')
    expect(container.querySelector('.gr-essencial #lb-light-intensity')).not.toBeNull()
    expect(container.querySelector('.gr-essencial #lb-light-color')).not.toBeNull()
    expect(titulosDasFichas()).toEqual(['Presa a uma ficha'])
    expect(fechada('Presa a uma ficha')).toBe(false)
    montar(<LightControls {...base} attachedTokenId="a" estado={<p>estado da luz</p>} />)
    expect(ficha('Presa a uma ficha')?.textContent).toContain('Vai junto com Ana')
    expect(titulosDasFichas()).toEqual(['Presa a uma ficha', 'Depende do estado'])
    expect(resumoDaFicha('Depende do estado')).toBe('Sempre')
    montar(<LightControls {...base} porEstado={{ estadoId: 'e1', efeitos: [{ valor: 'noite', efeito: 'acesa' }] }} estado={<p>estado da luz</p>} />)
    expect(resumoDaFicha('Depende do estado')).toBe('Muda com o estado')
  })
})

describe('Zona oculta e "Virar porta"', () => {
  it('zonaIdentity: o nome padrão (ou em branco) não se repete; nome próprio vem com o tipo', () => {
    expect(zonaIdentity('Zona oculta')).toEqual({ icon: 'zona', type: 'Zona oculta', name: null })
    expect(zonaIdentity('  ')).toEqual({ icon: 'zona', type: 'Zona oculta', name: null })
    expect(zonaIdentity('Alçapão')).toEqual({ icon: 'zona', type: 'Zona oculta', name: 'Alçapão' })
  })

  it('virarPortaAction: "Virar porta" no grupo da forma, com o handler de antes', () => {
    const onToggleDoor = vi.fn()
    const acao = virarPortaAction(onToggleDoor)
    expect(acao).toMatchObject({ label: 'Virar porta', icone: 'porta', grupo: 'forma' })
    acao.onSelect()
    expect(onToggleDoor).toHaveBeenCalledTimes(1)
  })

  it('cabeça da zona: medalha, nome e "Excluir zona" sem prometer a tecla Delete', () => {
    const onApagar = vi.fn()
    montar(<CabecaDaSelecao identidade={zonaIdentity('Alçapão')} rotuloApagar="Excluir zona" onApagar={onApagar} semAtalho acoes={[]} notaDasAcoes={null} />)
    const apagar = container.querySelector<HTMLButtonElement>('button[aria-label="Excluir zona"]')
    expect(apagar).not.toBeNull()
    expect(apagar?.hasAttribute('aria-keyshortcuts')).toBe(false)
    expect(container.textContent).toContain('Alçapão')
    expect(container.querySelector('svg')).not.toBeNull()
    act(() => apagar?.click())
    expect(onApagar).toHaveBeenCalledTimes(1)
  })

  it('corpo da zona: Nome e "Revelar para jogadores" no essencial, sem o Excluir; "Depende do estado" só com a aventura', () => {
    const props = { id: 'z1', name: 'Alçapão', onNameChange: vi.fn(), revealed: false, onRevealedChange: vi.fn(), onDelete: vi.fn() }
    montar(<ConcealZoneControls {...props} />)
    expect(tituloOculto()).toBe('Zona oculta')
    expect(container.querySelector<HTMLInputElement>('.gr-essencial #lb-conceal-zone-name')?.value).toBe('Alçapão')
    expect(container.querySelector('.gr-essencial')?.textContent).toContain('Revelar para jogadores')
    expect(Array.from(container.querySelectorAll('button')).some((b) => b.textContent === 'Excluir zona')).toBe(false)
    expect(titulosDasFichas()).toEqual([])
    montar(<ConcealZoneControls {...props} estado={<p>estado da zona</p>} />)
    expect(titulosDasFichas()).toEqual(['Depende do estado'])
    expect(fechada('Depende do estado')).toBe(true)
    expect(resumoDaFicha('Depende do estado')).toBe('Sempre')
    montar(<ConcealZoneControls {...props} porEstado={{ estadoId: 'e1', efeitos: [{ valor: 'aberto', efeito: 'revelada' }] }} estado={<p>estado da zona</p>} />)
    expect(resumoDaFicha('Depende do estado')).toBe('Muda com o estado')
  })
})
