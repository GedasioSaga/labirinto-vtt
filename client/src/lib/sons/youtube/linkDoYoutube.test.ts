import { describe, expect, it } from 'vitest'
import { lerLinkDoYoutube, segundosDoTempo, textoDoTempo, LINK_DO_YOUTUBE_MAX } from './linkDoYoutube'

const ID = 'dQw4w9WgXcQ'

describe('lerLinkDoYoutube: os 8 formatos', () => {
  it.each([
    ['watch?v=', `https://www.youtube.com/watch?v=${ID}`],
    ['youtu.be/', `https://youtu.be/${ID}`],
    ['shorts/', `https://www.youtube.com/shorts/${ID}`],
    ['embed/', `https://www.youtube.com/embed/${ID}`],
    ['live/', `https://www.youtube.com/live/${ID}`],
    ['music.youtube.com', `https://music.youtube.com/watch?v=${ID}`],
    ['m.youtube.com', `https://m.youtube.com/watch?v=${ID}`],
    ['youtube-nocookie.com/embed/', `https://www.youtube-nocookie.com/embed/${ID}`],
  ])('%s', (_formato, link) => {
    expect(lerLinkDoYoutube(link)).toEqual({ video: ID })
  })

  it('com t=, list= e si= guarda só o id e o início', () => {
    expect(lerLinkDoYoutube(`https://www.youtube.com/watch?v=${ID}&list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG&t=90s`)).toEqual({ video: ID, inicioS: 90 })
    expect(lerLinkDoYoutube(`https://youtu.be/${ID}?si=AbCdEfGh12345678&t=1m30s`)).toEqual({ video: ID, inicioS: 90 })
    expect(lerLinkDoYoutube(`https://www.youtube.com/embed/${ID}?start=42`)).toEqual({ video: ID, inicioS: 42 })
    expect(lerLinkDoYoutube(`https://www.youtube.com/watch?v=${ID}&t=0`)).toEqual({ video: ID })
  })

  it('sem esquema, http, maiúsculas no host, espaço em volta e barra no fim também valem', () => {
    expect(lerLinkDoYoutube(`youtu.be/${ID}`)).toEqual({ video: ID })
    expect(lerLinkDoYoutube(`www.youtube.com/watch?v=${ID}`)).toEqual({ video: ID })
    expect(lerLinkDoYoutube(`http://www.youtube.com/watch?v=${ID}`)).toEqual({ video: ID })
    expect(lerLinkDoYoutube(`https://WWW.YouTube.com/watch?v=${ID}`)).toEqual({ video: ID })
    expect(lerLinkDoYoutube(`  https://youtu.be/${ID}\n`)).toEqual({ video: ID })
    expect(lerLinkDoYoutube(`https://www.youtube.com/shorts/${ID}/`)).toEqual({ video: ID })
  })

  it('t= torto não derruba o link: o vídeo começa do zero', () => {
    expect(lerLinkDoYoutube(`https://youtu.be/${ID}?t=abc`)).toEqual({ video: ID })
    expect(lerLinkDoYoutube(`https://youtu.be/${ID}?t=-5`)).toEqual({ video: ID })
    expect(lerLinkDoYoutube(`https://youtu.be/${ID}?t=999999999`)).toEqual({ video: ID })
  })
})

describe('lerLinkDoYoutube: recusa o resto', () => {
  it.each([
    ['domínio falso que termina em youtube.com', `https://youtube.com.golpe.net/watch?v=${ID}`],
    ['domínio que contém youtube', `https://evilyoutube.com/watch?v=${ID}`],
    ['subdomínio desconhecido', `https://studio.youtube.com/watch?v=${ID}`],
    ['outro site', `https://vimeo.com/${ID}`],
    ['youtu.be com caminho a mais', `https://youtu.be/${ID}/extra`],
    ['id curto', 'https://youtu.be/dQw4w9WgXc'],
    ['id longo', 'https://youtu.be/dQw4w9WgXcQQ'],
    ['id com caractere fora da forma', 'https://www.youtube.com/watch?v=dQw4w9WgX%21Q'],
    ['id com ponto', 'https://www.youtube.com/watch?v=dQw4w9.gXcQ'],
    ['watch sem v', 'https://www.youtube.com/watch?list=PL123'],
    ['canal', 'https://www.youtube.com/@canal'],
    ['playlist', 'https://www.youtube.com/playlist?list=PL123'],
    ['javascript:', `javascript:alert('https://youtu.be/${ID}')`],
    ['javascript: sem aspas', `javascript://youtu.be/${ID}`],
    ['data:', `data:text/html,https://youtu.be/${ID}`],
    ['ftp', `ftp://youtu.be/${ID}`],
    ['usuário no link', `https://youtube.com@golpe.net/watch?v=${ID}`],
    ['usuário e senha', `https://a:b@www.youtube.com/watch?v=${ID}`],
    ['porta', `https://www.youtube.com:8443/watch?v=${ID}`],
    ['HTML', `<iframe src="https://www.youtube.com/embed/${ID}"></iframe>`],
    ['texto com espaço no meio', `veja https://youtu.be/${ID}`],
    ['barra invertida', `https://youtu.be\\${ID}`],
    ['vazio', ''],
    ['só espaço', '   '],
    ['id solto (não é link)', ID],
  ])('%s', (_caso, link) => {
    expect(lerLinkDoYoutube(link)).toBeNull()
  })

  it('texto acima do teto nem é olhado', () => {
    expect(lerLinkDoYoutube(`https://www.youtube.com/watch?v=${ID}&x=${'a'.repeat(LINK_DO_YOUTUBE_MAX)}`)).toBeNull()
  })
})

describe('segundosDoTempo e textoDoTempo', () => {
  it('lê as formas do YouTube e do relógio', () => {
    expect(segundosDoTempo('90')).toBe(90)
    expect(segundosDoTempo('90s')).toBe(90)
    expect(segundosDoTempo('1m30s')).toBe(90)
    expect(segundosDoTempo('1h2m3s')).toBe(3723)
    expect(segundosDoTempo('1:30')).toBe(90)
    expect(segundosDoTempo('1:02:03')).toBe(3723)
    expect(segundosDoTempo(' 2m ')).toBe(120)
  })

  it('recusa o que não é tempo', () => {
    for (const torto of [null, '', 'abc', '-5', '1:60', '1:61:00', 'm', 's', '1.5', '13h', '1:2']) expect(segundosDoTempo(torto)).toBeNull()
  })

  it('escreve como relógio', () => {
    expect(textoDoTempo(0)).toBe('0:00')
    expect(textoDoTempo(90)).toBe('1:30')
    expect(textoDoTempo(3723)).toBe('1:02:03')
  })
})
