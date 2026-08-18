# precios-app

Comparador de precios de supermercados construido sobre el dataset abierto **SEPA**
(Sistema Electrónico de Publicidad de Precios Argentinos). Viene apuntado a **Trelew**,
pero funciona en cualquiera de las 159 localidades del país donde hay 2 o más cadenas
reportando: ver "Otras localidades".

Elegís los productos que querés comprar y la app te dice a qué súper conviene ir.

```
precios-app/
├── etl/     descarga el dataset nacional y lo recorta a la zona
├── core/    motor de comparacion (JS puro, corre en Node y en React Native)
├── data/    dataset generado
└── movil/   app Expo / React Native
```

## De dónde salen los datos

SEPA obliga a las grandes cadenas a publicar sus precios por sucursal todos los días.
El Estado los publica como datos abiertos en el portal de Datos Abiertos de Desarrollo
Productivo, bajo licencia CC-BY 4.0.

- Dataset: `sepa-precios` en https://datos.produccion.gob.ar/dataset/sepa-precios
- Un ZIP por día de la semana (~336 MB), actualizado a diario.
- Dentro: un ZIP por cadena, cada uno con `comercio.csv`, `sucursales.csv` y
  `productos.csv`, delimitados por `|`.

### Detalles del formato que cuestan tiempo descubrir

1. **El header de `productos.csv` está corrido respecto a los datos.** El EAN real
   aparece en la columna `id_producto` (índice 3); la columna `productos_ean` trae un
   `1` constante. El ETL lee el índice 3.
2. **`comercio.csv` trae varias filas: una por bandera.** Una misma empresa opera
   formatos distintos con precios distintos — INC S.A. reporta Hipermercado Carrefour,
   Maxi, Market y Express; La Anónima reporta Topsy y Bomba; Cencosud reporta Vea, Disco
   y Jumbo. Leer sólo la primera fila hace que todas las sucursales queden etiquetadas
   con la bandera equivocada. Hay que mapear por `id_bandera`.
3. Los ZIP internos de algunas cadenas vienen **vacíos** (0 bytes).
4. `sucursales.csv` sí trae **latitud y longitud**, que es lo que permite el filtro por
   cercanía.
5. Las provincias vienen en código ISO (`AR-U` = Chubut), no por nombre.

### Qué NO está en SEPA

**Los mayoristas no reportan.** Diarco, Maxiconsumo, Yaguar, Vital y Makro no aparecen
en el dataset nacional. Diarco y Yaguar tienen sucursal en Trelew, pero Diarco sólo
publica folletos en PDF por sucursal (precios dentro de la imagen, sólo ofertas) y
Yaguar bloquea el acceso automatizado. Incorporarlos requiere OCR de folletos o carga
manual — pendiente, ver "Lo que falta".

Sí quedan cubiertos dos formatos mayoristas que reportan a SEPA: **Carrefour Maxi** y
**Changomas**.

## ETL

```bash
npm install
npm run etl
```

Descarga el ZIP del día más reciente, filtra las sucursales dentro de un radio (60 km
por defecto desde el centro de Trelew) y emite `data/<localidad>.json` + `.gz`.

Flags: `--radio N` · `--cache` (reutiliza el ZIP ya descargado) · `--salida ruta.json`.

### Otras localidades

Nada acá es específico de Trelew. SEPA cubre **415 localidades** con al menos un súper
reportando; **159 tienen 2 o más cadenas**, que es cuando comparar tiene sentido.

```bash
npm run localidades                                    # las 159, ordenadas por cadenas
npm run etl -- --localidad "MAR DEL PLATA" --radio 10
npm run etl -- --centro -38.9516,-68.0591 --nombre "Neuquén"
```

`--localidad` no necesita geocoder: el centro sale del promedio de las coordenadas que
las propias sucursales de esa localidad publican. Si el nombre no existe, el error
sugiere los parecidos. `--centro lat,lon` sirve para cualquier punto arbitrario.

Algunas zonas, para tener referencia:

| Localidad | Cadenas | Sucursales | Productos comparables |
|---|---|---|---|
| Córdoba | 9 | 145 | — |
| Mar del Plata | 10 (a 10 km) | 54 | 15.465 |
| Neuquén | 8 (a 8 km) | 33 | 33.815 |
| Trelew | 7 (a 60 km) | 20 | 14.280 |

Para cambiar la zona de la app, se regenera el asset del bundle:

```bash
npm run movil -- --localidad "MAR DEL PLATA" --radio 10
```

La app toma el nombre de la ciudad del propio dataset (`centro.nombre`), así que el
encabezado cambia solo. Lo único que conviene ajustar a mano es `name` en
`movil/app.json`, que es el nombre con el que se instala la app.

### Salida para Trelew (corrida del 2026-08-17)

| Métrica | Valor |
|---|---|
| Sucursales en el radio | 20 (9 en Trelew ciudad) |
| Banderas | La Anónima, Hipermercado Carrefour, Carrefour Maxi, Carrefour Market, Changomas, Vea, Simplicity |
| Productos | 44.420 (14.280 presentes en 2+ cadenas) |
| Precios | 173.664 |
| Tamaño | 9,9 MB JSON / **1,9 MB gzip** |

Como el dataset filtrado pesa menos de 2 MB comprimido, la app puede descargarlo entero
y consultarlo **offline**, sin backend propio.

### Formato del dataset

```jsonc
{
  "fecha_datos": "2026-08-17",
  "centro": { "lat": -43.253, "lon": -65.309, "nombre": "Trelew", "radio_km": 60 },
  "cadenas":    [{ "id", "nombre", "razon_social", "url" }],   // id = comercio-bandera
  "sucursales": [{ "id", "cadena", "nombre", "direccion", "localidad",
                   "lat", "lon", "distancia_km", "horarios" }],
  "productos":  [{ "ean", "desc", "cant", "unidad", "marca", "cadenas" }],
  // tuplas compactas: [indice_sucursal, indice_producto, precio, precio_ref, unidad_ref]
  "precios":    [[0, 12, 1080, 2160, "kgm"]]
}
```

`productos[].cadenas` indica en cuántas banderas distintas aparece ese EAN: sirve para
priorizar lo comparable en la búsqueda.

> Los índices de producto se renumeran en cada corrida del ETL. Nada que se persista
> entre corridas puede guardar índices — el carrito guarda **EAN**.

## Motor de comparación (`core/comparador.js`)

JS puro sin dependencias, así que el mismo archivo corre en Node y dentro de la app.
Se prueba contra el dataset real sin emulador:

```bash
node core/probar.mjs
```

Indexa 173 mil precios en ~50 ms y compara un carrito en menos de 1 ms.

### Cómo compara, y por qué así

Los catálogos difieren mucho entre cadenas: en una prueba con 14 productos de canasta
básica, **sólo 1 de 9 sucursales de Trelew tenía los 14**. Sumar totales exigiendo el
carrito completo deja casi todas las sucursales afuera, así que el motor:

1. Muestra **cobertura explícita** — "Changomas 5/5 · $30.423" al lado de
   "La Anónima 4/5 · $23.350", sin fingir que son totales equivalentes, y lista qué falta.
2. Calcula la **compra dividida** — cada ítem donde está más barato. Es el techo del
   ahorro, y responde "cuánto pierdo por comprar todo en un solo lugar".
3. **Agrupa sucursales equivalentes.** Las cadenas informan la misma lista en todas sus
   sucursales; sin agrupar, la pantalla repite ocho veces "La Anónima $23.350".
4. **Descarta sucursales sin ningún ítem** del carrito, que si no aparecen rankeadas
   con total $0.
5. **Desempata por distancia** cuando el precio es igual, para no mandar al usuario a
   otra ciudad a buscar algo que cuesta lo mismo a la vuelta.

### Precio por unidad y equivalentes (`core/unidades.js`)

Comparar sólo por EAN idéntico deja afuera dos cosas que importan: que el paquete grande
rinda más, y que el súper tenga la misma yerba de otra marca al lado.

**El campo `precio_referencia` de SEPA no sirve**: en el **47% de las filas es una copia
literal del precio de lista** ("HUEVOS X 12UN $3.149 → $3.149/EA"). En cambio, el 100% de
los productos trae cantidad y unidad de presentación, así que el $/kg se calcula a mano.

Las unidades vienen escritas de 38 formas distintas (`kgr`, `KG.`, `GRM`, `gr.`, `KGM`…),
que se normalizan a **kg**, **l** o **un**. Lo que no es comparable —metros, m²— queda sin
precio unitario en vez de inventar uno.

`alternativas()` busca equivalentes con un índice invertido de palabras, **excluyendo la
marca** (la gracia es justamente encontrar otra marca). Sólo compara productos medidos en
la misma unidad base, y descarta lo que rinda más de 5× mejor: "ACUENTA FIDEOS $61" sale
$123/kg contra $3.058/kg del resto, y sin ese piso los equivalentes serían siempre los
errores de carga del dataset.

Se usa en dos lugares: el escáner ("rinden más por kg") y la pantalla de comparación,
donde cada faltante muestra con qué reemplazarlo **en esa misma sucursal**.

## Ofertas

SEPA tiene dos campos de promoción por precio (`promo1` y `promo2`) que el ETL guarda
cuando el precio de promo es menor al de lista. En la zona de Trelew hay **4.013
promociones**; la leyenda trae la fecha de fin, que se parsea para no mostrar vencidas.

**Ojo con la cobertura**: no todas las cadenas informan promociones. En Trelew las
publican Carrefour (todas sus banderas) y La Anónima; **Changomas, Vea y Simplicity no
informan ninguna**, lo que no significa que no tengan ofertas en la góndola. La app lo
aclara en pantalla para no dar una impresión falsa.

La sección muestra sólo las rebajas de cada cadena (`ofertasDeclaradas`), ordenadas por
descuento y filtrables por rubro. Hubo una segunda vista que comparaba el mismo producto
entre súper, y se sacó: mezclada con las rebajas confundía, porque "50% off" y "acá está
más barato" son dos cosas distintas. Comparar entre súper ya lo hacen la pantalla de
comparación y el escáner.

`promo1` y `promo2`: hay dos slots y no todas las cadenas usan el primero — **DIA publica
casi todo en `promo2`** (38.532 filas). El ETL toma la más conveniente de las dos.

### Rubros

`core/categorias.js` deduce el rubro de la descripción, porque SEPA no publica categoría.
Sin esto, los mejores descuentos son siempre peluches, notebooks y resaltadores.

La clasificación es por **lista blanca**: es almacén lo que se reconoce como comida, y
todo lo demás cae en "bazar y otros". Se intentó al revés —marcar lo que fuera electro o
juguete— y no alcanza nunca: siempre entra un "KIT BÁSICO TECHO" o un "SET DE VERDURAS"
(que es un juguete). Es preferible dejar una mortadela afuera que mostrar un caloventor
entre los fideos.

Cuidado con las reglas laxas: `/te /` capturaba "sopor**te** TV" y mandaba soportes de
televisor a la góndola de almacén. Por eso las palabras cortas van con `\b`.

## App móvil

```bash
cd movil
npx expo start          # o --web para probar en el navegador
```

Tres pestañas: **Bolsa** (armar el carrito buscando o escaneando), **Ofertas** (los
mejores descuentos de la zona) y **Dónde compro** (a qué súper conviene ir con lo que
tenés cargado).

El escáner de código de barras sale casi gratis porque el dataset ya está indexado por
EAN, que es justo lo que codifica el código de barras: apuntás a un producto en la
góndola y ves el precio en cada súper cercano.

El carrito se persiste con AsyncStorage y la ubicación sale de `expo-location`, con
fallback al centro de la zona del dataset si no hay permiso de GPS.

### Estética e imágenes de producto

La app va en clave de almacén de ramos generales: papel envejecido, tinta marrón,
verde oliva para lo que conviene y rojo teja para lo que falta o encarece. Tipografía
Alfa Slab One para los títulos y Bitter para el cuerpo (`expo-font`), sellos de doble
filete, rótulos con filete al costado y separadores punteados.

**SEPA no publica fotos.** La única fuente abierta indexada por EAN es Open Food Facts,
pero es una base de *alimentos*: en una muestra de productos de Trelew había foto para
1 de cada 5, y perfumería y limpieza no están directamente (Nivea, Dove, Axe: nada).

Por eso la imagen se resuelve en dos capas (`src/ImagenProducto.tsx`):

1. **Ilustración propia**, siempre. `src/iconos.tsx` deduce de la descripción qué es el
   producto —botella, lácteo, paquete, lata, rollo, frasco, pan, huevo…— y dibuja un
   ícono a trazo, con un color cálido estable derivado del EAN. Nunca queda un hueco gris.
2. **Foto real de Open Food Facts** por encima, cuando existe.

La foto se busca sólo donde hay pocos productos en pantalla (el carrito, el escáner):
en una lista de búsqueda serían decenas de consultas de golpe. Cada EAN se consulta una
sola vez y queda cacheado en AsyncStorage, incluida la respuesta negativa.

### Cómo se mantiene actualizado

`movil/src/datos.ts` resuelve el dataset en este orden:

1. El que viaja en el bundle (`movil/assets/trelew.json`) — piso garantizado, siempre hay datos.
2. La copia descargada en corridas anteriores, cacheada en disco.
3. La publicada por el ETL, si tiene una `fecha_datos` más nueva que las anteriores.

Cualquier falla en los pasos 2 y 3 —sin red, JSON inválido, sin permisos de disco— es
silenciosa: la app sigue con lo que ya tenía. Nunca se queda sin datos.

## Instalar la app en el teléfono

### Probarla al toque (Expo Go)

```bash
cd movil
npx expo start --lan
```

Instalás **Expo Go** del Play Store, escaneás el QR y la app abre. No hace falta compilar
nada, pero el teléfono tiene que estar en la misma WiFi que la PC y la PC tiene que
quedar prendida.

### APK instalable (EAS Build)

```bash
cd movil
npm run apk
```

Compila en los servidores de Expo (~10-20 min, más la cola del plan gratuito) y devuelve
un link para descargar el APK directo desde el celular. Queda instalada de verdad: no
depende de la PC ni de Expo Go.

Como es un APK firmado con una clave propia y no viene de Play Store, Android va a pedir
permitir "instalar apps de origen desconocido" la primera vez.

**Antes de compilar hay que generar el dataset**, porque viaja dentro del bundle:

```bash
npm run movil            # desde la raíz del repo
```

Hay un `.easignore` justamente por esto: `assets/dataset.json` está en `.gitignore` (son
10 MB que se regeneran a diario), pero el build lo necesita. Sin ese archivo el APK
saldría sin precios.

### Ícono

```bash
npm run iconos
```

`etl/generar-iconos.mjs` dibuja una tiendita de barrio en SVG —toldo a rayas con borde
festoneado, vidriera, puerta arqueada— y la rasteriza con `sharp` en todas las piezas que
piden Android e iOS. Usa la misma paleta que la app.

Dos cosas que no son obvias al generarlos:

- **El ícono adaptativo de Android hay que centrarlo a mano.** El dibujo no está en el
  medio del `viewBox` (la vereda baja más de lo que sube el toldo), así que escalarlo sin
  corregir lo deja corrido. El script calcula el desplazamiento desde el bounding box real
  y lo achica al 60% del lienzo, porque el launcher recorta los bordes con la forma que
  tenga.
- **El ícono monocromo no se hace pintando todo de negro**: sale una mancha ilegible. Lo
  que se lee es el contraste entre relleno y vacío, así que ahí la fachada y la puerta
  quedan huecas y sólo se rellenan el toldo, la cornisa, la vidriera y la vereda.

### Permisos

La app pide **cámara** (escanear códigos) y **ubicación** (súper más cercanos). El plugin
de `expo-camera` agrega además `RECORD_AUDIO` por defecto, que acá está **bloqueado
explícitamente** en `app.json`: la app no graba audio y no tiene por qué pedir micrófono.

## Publicar el dataset

```bash
npm run publicar
```

Corre el ETL, verifica que la salida no venga vacía y sube el resultado como adjunto de
una release de GitHub. Las URLs son estables:

```
https://github.com/Axel0297/precios-app/releases/latest/download/version.json
https://github.com/Axel0297/precios-app/releases/latest/download/dataset.json
```

La app las consulta sola: al abrirse pide `version.json` y baja el dataset **sólo si hay
datos más nuevos** que los que ya tiene. Sin esa separación, cada apertura costaría 10 MB;
así el chequeo son 135 bytes y menos de un segundo.

### Por qué no corre en GitHub Actions

Estuvo escrito como workflow programado y **no funciona**: el portal de datos abiertos
responde **403 a los runners de GitHub**. Lo verifiqué con un job de diagnóstico —el
runner sale desde Moses Lake (EE.UU., Azure) y el 403 aparece con y sin User-Agent de
navegador, incluso en la página raíz del portal—, así que es bloqueo por IP, por
geografía o por rangos de datacenter. Desde una conexión argentina responde normal.

Por eso el ETL corre en la máquina de casa y a GitHub sólo viaja el resultado recortado.

Para que se actualice sin acordarse, conviene una tarea programada de Windows que corra
`npm run publicar` una vez por día después de las 19:00 (SEPA republica ~16:20 ART):

```powershell
schtasks /create /tn "Precios Trelew - publicar" /tr "cmd /c cd /d C:\Users\axelr\precios-app && npm run publicar" /sc daily /st 19:30
```

Requiere `gh` autenticado, que ya lo está en `.herramientas/bin/gh.exe`.

## Lo que falta

- **Mayoristas** (Diarco, Yaguar) por OCR de folletos o carga manual.
- **Sustitutos por unidad de medida**: `precio_referencia` y `unidad_referencia` permiten
  comparar $/kg y $/l entre marcas cuando falta la que el usuario eligió.
- **Mejorar el ranking de búsqueda**: hoy buscar "leche" puede devolver primero un
  chocolate que dice "leche" en el nombre.
- **Probar el escáner en un teléfono real**: la lógica de EAN → precios está verificada
  contra el dataset, pero la lectura con cámara no se probó en dispositivo.

## Licencia de datos

Los precios son datos públicos del Estado argentino (CC-BY 4.0). Corresponde citar la
fuente en la app y aclarar que son los precios informados por las cadenas, que pueden
diferir de la góndola.
