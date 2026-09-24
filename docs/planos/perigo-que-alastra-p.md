# Perigo que se alastra: fogo e água sala a sala

Item `perigo-que-alastra` de `docs/features-unicas-2026-09-24.json` (3 vozes da torre:
Enzo "perigo que se alastra pelas portas abertas e avisa quem entra", Ana "catástrofe
sala a sala com 'Avançar' em várias cenas", Bruno "zona de perigo com estágios").

## O que o mestre ganha (núcleo)

No painel da Sala selecionada, o bloco "Perigo":

- sala sem perigo: "Pôr fogo" e "Pôr água" — o perigo nasce preso a esta sala;
- sala tomada: diz o que há nela e o que o PRÓXIMO avanço atinge
  ("Vai atingir: Corredor, Cozinha"), com "Avançar" e "Apagar perigo".

"Avançar" leva o perigo às salas vizinhas ligadas por PORTA ABERTA. O fogo deixa
cinza para trás: as salas que queimavam viram cinza e não queimam de novo; a água
fica onde já estava e soma as vizinhas. Fogo sem vizinha para tomar se apaga e
deixa só a cinza. Pôr, avançar e apagar são edição do mestre: entram no Ctrl+Z
(apertou "Avançar" sem querer, desfaz).

## Dado novo e onde mora

Mora no MAPA (arquivo da cena), `MapData.perigos?` em `types/map.ts`:

```
Perigo { id: string            // estável, só do mestre
         tipo: 'fogo' | 'agua'
         salas: string[]        // ids das Salas (Region) tomadas agora
         cinzas?: string[] }    // fogo: ids das Salas que já queimaram
```

- Campo opcional: mapa salvo antes abre igual e não ganha chave.
  `deserializeMap` passa por `perigosFromFile` (`lib/perigo.ts`), que descarta o
  perigo torto (tipo desconhecido, id vazio, lista que não é de textos) em vez de
  derrubar o arquivo.
- Vizinhança é GEOMETRIA, calculada na hora (`salasLigadasPorPortaAberta`): para
  cada porta aberta, um ponto de cada lado da porta; a Sala mais interna que
  contém cada ponto. Nada de vizinhança gravada — mover sala ou porta já vale.
- Quem grava: só o mestre, pelo painel (`useMapStore.porPerigoNaSala`,
  `avancarPerigo`, `apagarPerigo`), com histórico.

## O que o jogador recebe (e o que nunca recebe)

- Recebe, no recorte (`lib/fogFilter.ts`), `map.perigos` com UMA entrada por tipo
  (`{ id: 'fogo', tipo: 'fogo', salas, cinzas }`), só com as Salas que ele VÊ
  AGORA (regra de visível, não de explorado: o fogo muda a cada avanço e a
  memória viraria espionagem) e que já saem no recorte dele.
- **Nunca** recebe: o id do perigo do mestre, sala tomada fora da visão atual,
  sala secreta, sala sob teto fechado, sala na zona oculta. Montado por LISTA DO
  QUE VAI — o `...mapa` do recorte não leva o campo do mestre.
- Desenho: preenchimento chapado translúcido por cima do chão da sala (fogo
  laranja, água azul, cinza cinza), mesmo estilo minimapa, sem hachura
  (`pixi/drawPerigos.ts`), no editor e na tela do jogador.
- Teste de que não chega: `lib/fogFilter.perigo.test.ts` e
  `net/hostSession.perigo.test.ts`.

## O que fica para depois (pendências)

- Aviso a quem entra ("Entrar no fogo?") e aviso ao mestre; recusa de movimento.
- Porta fechada que segura 1 avanço, porta de aço que segura sempre; vão sem
  porta e parede frágil como passagem.
- Avanço em várias cenas de uma vez (Maré no andar inteiro), "a cada Apito",
  ligação com o Estado do mundo.
- Estágios com contorno próprio, fumaça/vapor/entulho, animação, coluna de fumaça
  visível de longe.
- Recuar; tirar uma sala só do perigo; limpar id de sala apagada.
