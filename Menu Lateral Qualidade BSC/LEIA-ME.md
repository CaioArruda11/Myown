# Menu Lateral Qualidade BSC

Um menu para cada página do relatório, todos no modelo v8 (8 itens, com a **Projeção BSC** logo abaixo do BSC). Os arquivos são iguais entre si: muda só a página que fica acesa.

| Arquivo | Página | Nome da medida | Item aceso |
|---|---|---|---|
| `1_menu_BSC.txt` | BSC | Menu Lateral Animado HTML BSC | BSC |
| `2_menu_Projecao_BSC.txt` | Projeção BSC | Menu Lateral Animado Projeção BSC | Projeção BSC |
| `3_menu_IFI.txt` | IFI | Menu Lateral Animado IFI | IFI |
| `4_menu_IRR.txt` | IRR | Menu Lateral Animado IRR | IRR |
| `5_menu_TDNA_Instalacao.txt` | TDNA Instalação | Menu Lateral Animado TDNA Instalação | TDNA Instalação |
| `6_menu_TDNA_Reparos.txt` | TDNA Reparos | Menu Lateral Animado TDNA Reparos | TDNA Reparos |
| `7_menu_Abertura_Hierarquia.txt` | Abertura Hierarquia | Menu Lateral Animado Hierarquia | Abertura Hierarquia |

"Detalhamento BSC" abre outro relatório, por isso não tem menu próprio.

## Como usar

1. Em cada página, abra a medida do menu (ou crie uma nova) e cole o arquivo inteiro. O nome da medida vem na primeira linha.
2. Se a medida já existe com outro nome, apague a primeira linha (`Nome = `) antes de colar.
3. O visual do menu da página tem de usar a medida daquela página.

## Botões nativos

A geometria é a mesma em todos: 36 px de altura, 43 px de passo. Topo de cada botão, a partir do topo do visual do menu:

| Botão | Topo | Ação |
|---|---|---|
| BSC | 109 | Navegação de página |
| Projeção BSC | 152 | Navegação de página |
| IFI | 195 | Navegação de página |
| IRR | 238 | Navegação de página |
| TDNA Instalação | 281 | Navegação de página |
| TDNA Reparos | 324 | Navegação de página |
| Abertura Hierarquia | 367 | Navegação de página |
| Detalhamento BSC | 410 | URL da Web (outro relatório) |

**Página Abertura Hierarquia**: mantém as duas diferenças que o menu dela já tinha. O item "Abertura Hierarquia" desce 2 px (`_descerHierarquia = 2`), então os dois últimos botões ficam em **369** e **412**. E não tem o aviso sobre filtros (`_avisoTexto = ""`). O visual dessa página tem 200 px de largura; os nomes cabem sem cortar.

**Aviso sobre filtros**: aparece em todas as outras páginas, como no BSC. Para tirar de alguma, deixe `VAR _avisoTexto = ""` no menu dela.

## Prévia

`previas/todos-os-menus.png` mostra os sete lado a lado (Hierarquia na largura de 200 px).
