/**
 * TEXTURAS — os passos do mapa: leitura segura do disco, somar passo (a
 * borracha no vazio e o balde repetido não viram passo), tirar textura
 * importada e o recorte do jogador (só o que encosta no conhecido).
 */
import { describe, expect, it } from 'vitest'
import type { PinceladaDeTextura, RegionPoint } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import {
  comTexturas,
  importadasParaJogador,
  lerTexturas,
  lerTexturasImportadas,
  nomeDaTextura,
  raioDoPincelDeTextura,
  semTexturaImportada,
  somarPincelada,
  texturasParaJogador,
  texturasUsadas,
  TAMANHO_DO_PINCEL_MAX,
} from './texturas'

const IMAGEM = 'data:image/webp;base64,UklGRhIAAABXRUJQVlA4TAYAAAAvAAAAAAA='
const pincel = (id: string, textura: string, pontos: RegionPoint[], raio = 10): PinceladaDeTextura => ({ id, tipo: 'pincel', textura, forca: 0.8, raio, pontos })
const borracha = (id: string, pontos: RegionPoint[], raio = 10): PinceladaDeTextura => ({ id, tipo: 'borracha', forca: 1, raio, pontos })
const balde = (id: string, textura: string, alvoId: string): PinceladaDeTextura => ({ id, tipo: 'balde', textura, forca: 0.8, alvo: { tipo: 'desenho', id: alvoId } })

describe('leitura do disco', () => {
  it('passo quebrado sai e o resto fica na ordem; lista vazia é sem campo', () => {
    const lidos = lerTexturas([
      pincel('a', 'floresta', [{ x: 1, y: 2 }]),
      { id: 'b', tipo: 'pincel', textura: 'FLORESTA', forca: 1, raio: 3, pontos: [{ x: 1, y: 1 }] },
      { id: 'c', tipo: 'pincel', textura: 'areia', forca: 0, raio: 3, pontos: [{ x: 1, y: 1 }] },
      { id: 'd', tipo: 'borracha', forca: 2, raio: 3, pontos: [{ x: 1, y: Number.NaN }] },
      balde('e', 'importada:abc', 'des-1'),
      { id: 'f', tipo: 'balde', textura: 'areia', forca: 1, alvo: { tipo: 'parede', id: 'x' } },
      { id: 'g', tipo: 'borracha', forca: 5, raio: 3, pontos: [{ x: 4, y: 4 }] },
    ])
    expect(lidos?.map((p) => p.id)).toEqual(['a', 'e', 'g'])
    // Força acima de 1 é 1.
    expect(lidos?.[2].forca).toBe(1)
    expect(lerTexturas([])).toBeUndefined()
    expect(lerTexturas('lixo')).toBeUndefined()
  })

  it('textura importada só com imagem embutida de verdade (nunca caminho nem endereço de fora)', () => {
    const lidas = lerTexturasImportadas([
      { id: 'importada:um', nome: '  Musgo  velho ', imagem: IMAGEM },
      { id: 'importada:um', nome: 'repetida', imagem: IMAGEM },
      { id: 'importada:dois', nome: 'Caminho', imagem: 'C:\\Users\\mestre\\musgo.png' },
      { id: 'importada:tres', nome: 'Fora', imagem: 'https://exemplo.com/a.png' },
      { id: 'areia', nome: 'Sem prefixo', imagem: IMAGEM },
    ])
    expect(lidas).toEqual([{ id: 'importada:um', nome: 'Musgo velho', imagem: IMAGEM }])
  })

  it('o arquivo do mapa leva e traz os dois campos; mapa sem eles abre igual', () => {
    const base = createEmptyMap('m', 'Mapa', 10, 10, 50)
    const com = { ...base, texturas: [pincel('a', 'floresta', [{ x: 5, y: 5 }])], texturasImportadas: [{ id: 'importada:um', nome: 'Musgo', imagem: IMAGEM }] }
    const volta = deserializeMap(serializeMap(com))
    expect(volta.texturas).toEqual(com.texturas)
    expect(volta.texturasImportadas).toEqual(com.texturasImportadas)
    const sem = deserializeMap(serializeMap(base))
    expect('texturas' in sem).toBe(false)
    expect('texturasImportadas' in sem).toBe(false)
  })
})

describe('somar passo', () => {
  it('borracha onde não há tinta não vira passo e diz por quê', () => {
    const lista = [pincel('a', 'floresta', [{ x: 0, y: 0 }])]
    const longe = somarPincelada(lista, borracha('b', [{ x: 500, y: 500 }]))
    expect(longe).toEqual({ lista, resultado: 'nada-a-apagar' })
    const perto = somarPincelada(lista, borracha('b', [{ x: 15, y: 0 }]))
    expect(perto.resultado).toBe('pintou')
    expect(perto.lista).toHaveLength(2)
  })

  it('borracha passa pelo balde quando a caixa da forma encosta nela', () => {
    const lista = [balde('a', 'areia', 'd1')]
    const caixa = () => ({ minX: 0, minY: 0, maxX: 100, maxY: 100 })
    expect(somarPincelada(lista, borracha('b', [{ x: 50, y: 50 }]), caixa).resultado).toBe('pintou')
    expect(somarPincelada(lista, borracha('b', [{ x: 500, y: 500 }]), caixa).resultado).toBe('nada-a-apagar')
    // A forma do balde sumiu: nada debaixo.
    expect(somarPincelada(lista, borracha('b', [{ x: 50, y: 50 }]), () => null).resultado).toBe('nada-a-apagar')
  })

  it('o mesmo balde de novo na mesma forma não muda nada; outra textura, sim', () => {
    const lista = [balde('a', 'areia', 'd1')]
    expect(somarPincelada(lista, balde('b', 'areia', 'd1')).resultado).toBe('igual')
    expect(somarPincelada(lista, balde('b', 'duna', 'd1')).resultado).toBe('pintou')
  })

  it('a última pincelada apagada tira o campo do mapa', () => {
    const map = createEmptyMap('m', 'Mapa', 10, 10, 50)
    const com = comTexturas(map, [pincel('a', 'areia', [{ x: 1, y: 1 }])])
    expect(com.texturas).toHaveLength(1)
    expect('texturas' in comTexturas(com, [])).toBe(false)
    expect(comTexturas(map, [])).toBe(map)
  })

  it('tirar uma importada leva junto o que ela pintava (e a borracha que sobra no começo)', () => {
    const map = {
      ...createEmptyMap('m', 'Mapa', 10, 10, 50),
      texturasImportadas: [{ id: 'importada:um', nome: 'Musgo', imagem: IMAGEM }],
      texturas: [pincel('a', 'importada:um', [{ x: 1, y: 1 }]), borracha('b', [{ x: 1, y: 1 }]), pincel('c', 'areia', [{ x: 9, y: 9 }])],
    }
    const sem = semTexturaImportada(map, 'importada:um')
    expect(sem.texturas?.map((p) => p.id)).toEqual(['c'])
    expect('texturasImportadas' in sem).toBe(false)
    expect(semTexturaImportada(map, 'importada:outra')).toBe(map)
  })

  it('o pincel cresce com o mapa e não passa do teto', () => {
    expect(raioDoPincelDeTextura(10, 32)).toBe(160)
    expect(raioDoPincelDeTextura(1, 9999)).toBe(TAMANHO_DO_PINCEL_MAX / 2)
    expect(nomeDaTextura('   ')).toBe('Textura')
  })
})

describe('recorte do jogador', () => {
  // O jogador conhece só x < 100; x entre 40 e 60 é lugar escondido.
  const conhece = (p: RegionPoint) => p.x < 100
  const escondido = (p: RegionPoint) => p.x > 40 && p.x < 60

  it('a pincelada sai só no pedaço junto do conhecido; a da névoa não sai', () => {
    const lista = [pincel('perto', 'floresta', [{ x: 0, y: 0 }, { x: 30, y: 0 }]), pincel('longe', 'duna', [{ x: 500, y: 0 }, { x: 900, y: 0 }])]
    const vai = texturasParaJogador(lista, conhece, () => false, () => true)
    expect(vai?.map((p) => p.id.split('~')[0])).toEqual(['perto'])
    expect(JSON.stringify(vai)).not.toContain('duna')
  })

  it('lugar escondido corta a pincelada como corta uma linha', () => {
    const lista = [pincel('a', 'floresta', [{ x: 0, y: 0 }, { x: 90, y: 0 }], 2)]
    const vai = texturasParaJogador(lista, conhece, escondido, () => true) ?? []
    expect(vai.length).toBe(2)
    for (const p of vai) for (const ponto of p.tipo === 'balde' ? [] : p.pontos) expect(escondido(ponto)).toBe(false)
  })

  it('balde só vai se a forma que ele enche saiu no recorte; borracha no começo sai', () => {
    const lista = [borracha('e', [{ x: 1, y: 1 }]), balde('a', 'areia', 'visto'), balde('b', 'neve', 'na-nevoa')]
    const vai = texturasParaJogador(lista, conhece, () => false, (alvo) => alvo.id === 'visto')
    expect(vai?.map((p) => p.id)).toEqual(['a'])
    expect(texturasParaJogador([balde('b', 'neve', 'na-nevoa')], conhece, () => false, () => false)).toBeUndefined()
  })

  it('das importadas, só vão as que algum passo do jogador usa, e sem o nome do arquivo do mestre', () => {
    const importadas = [
      { id: 'importada:um', nome: 'Musgo', imagem: IMAGEM },
      { id: 'importada:dois', nome: 'Lava', imagem: IMAGEM },
    ]
    const passos = [pincel('a', 'importada:um', [{ x: 1, y: 1 }])]
    expect(importadasParaJogador(importadas, passos)).toEqual([{ id: 'importada:um', nome: 'Textura', imagem: IMAGEM }])
    expect(importadasParaJogador(importadas, undefined)).toBeUndefined()
    expect([...texturasUsadas(passos)]).toEqual(['importada:um'])
  })
})
