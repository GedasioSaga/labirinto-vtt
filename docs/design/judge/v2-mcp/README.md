# Judge v3 (feito ao vivo no Blender pelo MCP)

O Judge é o avatar do mestre na batalha: um cavaleiro de armadura prateada, elmo com chifres de touro e capa azul, montado num chocobo marrom com testeira de metal. Ele ergue uma carta vermelha que brilha.

O modelo foi montado ao vivo no Blender 5.2, na cena "Judge", por scripts Python mandados pelo MCP do Blender. As penas são placas largas espalhadas por Geometry Nodes; armadura, elmo, capa e carta são malhas feitas por código, com materiais do Poly Haven.

## O que tem aqui

| Arquivo | O que é |
|---|---|
| `judge-heroi.png` | Imagem grande (1200 x 1500), em 3/4 de baixo, com a carta erguida (1.845 KB) |
| `judge-folha.png` | Folha do app: 8 direções x 20 quadros, fundo transparente, 3840 x 1920 (6.323 KB) |
| `judge-folha.webp` | A mesma folha em WebP qualidade 90, bem mais leve para o app (1.062 KB) |
| `judge-folha.json` | Como ler a folha (tamanho do quadro, direções, animações, ponto do chão) |
| `fonte/judge.blend` | O modelo, com as texturas dentro. Abre no Blender 5.2; tudo fica na cena "Judge" (11.619 KB) |
| `fonte/render_judge.py` | Renderiza o herói e a folha de novo, fora da janela do Blender |

## Como a folha funciona

- Cada quadro tem 192 x 240 px. Um quadrado do mapa vale 64 px, então o Judge ocupa 1 quadrado no chão e uns 2,5 de altura.
- O ponto do chão (centro da base) fica em x = 96, y = 200 dentro de cada quadro.
- Câmera ortográfica, 30 graus acima, de frente. As luzes ficam paradas e o modelo gira.
- Linhas, de cima para baixo: sul, sudeste, leste, nordeste, norte, noroeste, oeste, sudoeste. "Sul" é virado para quem olha a tela.
- Colunas 1 a 12: respiração, em laço, a 12 quadros por segundo. O braço da carta fica baixo e a carta brilha pouco.
- Colunas 13 a 20: erguer a carta, uma vez só. O braço sobe, passa um pouco do ponto e assenta; o brilho vermelho cresce.

## Como renderizar de novo

Na pasta `fonte/`, com o Blender 5.2 fechado ou aberto (roda em outro processo):

```
"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b judge.blend --python render_judge.py -- heroi folha webp --tmp C:/caminho/temporario
```

`heroi` refaz a imagem grande, `folha` refaz a folha e o `.json`, e `webp` faz a cópia leve da folha. A pasta `--tmp` guarda os 160 quadros soltos antes de montar a folha e pode ser apagada depois. Com a placa de vídeo (OptiX), a folha leva alguns minutos.

## O que ainda fica longe da pintura

- A ombreira redonda e o braço erguido em cilindros empilhados ainda lembram brinquedo. As ombreiras não têm gravura.
- As penas são placas largas e lisas que parecem madeira, sem a pincelada macia da pintura. O peitoral da ave, com ameias, lembra uma serra.
- De frente e de costas, a capa abre para os lados como asas. Ela não tem simulação de tecido.
- Na folha, a 64 px por quadrado, os olhos da viseira e o olho do chocobo ocupam de 1 a 3 px. Na respiração, a carta baixa aparece só como um risco vermelho.

## Créditos (Poly Haven, licença CC0)

Todos os materiais de fora vêm do Poly Haven, em domínio público (CC0). O crédito não é obrigatório; fica aqui por cortesia.

- Céu "Rogland Overcast", de Greg Zaal: a luz fria e nublada.
- "Metal Plate 02", de Rob Tuytel: o riscado e a rugosidade do aço.
- "Denim Fabric 05", de Rico Cilliers e colormass: a trama da capa e dos panos.
- "Leather Red 02", de Rob Tuytel: o couro da sela e das rédeas.
