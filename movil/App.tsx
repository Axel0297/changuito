import { useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, ScrollView,
  StatusBar, Text, TextInput, View,
} from 'react-native';
// El SafeAreaView de react-native no hace nada en Android: el encabezado se
// metia abajo de la barra de estado. Este si respeta barra, notch y gestos.
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  useFonts, Figtree_400Regular, Figtree_600SemiBold, Figtree_700Bold,
} from '@expo-google-fonts/figtree';
import { Caprasimo_400Regular } from '@expo-google-fonts/caprasimo';
import {
  alternativas, buscarProductos, cadenasConPromo, compararCarrito,
  formatearPesos, formatearPorUnidad, ofertasDeclaradas, precioPorUnidad,
} from './src/comparador';
import type {
  Alternativa, OfertaDeclarada, ProductoEncontrado, ResultadoSucursal,
} from './src/comparador';
import { RUBROS } from './src/categorias';
import type { Rubro } from './src/categorias';
import { useCarrito, useIndice, useRadio, useSucursales } from './src/datos';
import { Escaner } from './src/Escaner';
import { ImagenProducto } from './src/ImagenProducto';
import { C } from './src/tema';
import { s } from './src/estilos';

export default function App() {
  return (
    <SafeAreaProvider>
      <Contenido />
    </SafeAreaProvider>
  );
}

function Contenido() {
  // Si las fuentes fallan se sigue con las del sistema: una tipografia que no
  // carga no puede dejar la app trabada en la pantalla de carga.
  const [fuentesCargadas, errorFuentes] = useFonts({
    Caprasimo_400Regular,
    Figtree_400Regular,
    Figtree_600SemiBold,
    Figtree_700Bold,
  });
  const fuentesResueltas = fuentesCargadas || !!errorFuentes;
  const { indice, actualizando, error } = useIndice();
  const [radio, setRadio] = useRadio(5);
  const { sucursales, gpsActivo } = useSucursales(indice, radio);
  const { carrito, agregar, cambiarCantidad, quitar, vaciar } = useCarrito(indice);
  const [pestana, setPestana] = useState<'carrito' | 'ofertas' | 'comparar'>('carrito');
  const [escaneando, setEscaneando] = useState(false);

  // Un spinner eterno no dice nada. Si algo se rompio, que se lea.
  if (error) {
    return (
      <SafeAreaView style={[s.pantalla, s.centrado]} edges={['top', 'left', 'right']}>
        <Text style={s.vacioTitulo}>No pude abrir los precios</Text>
        <Text style={s.vacio}>{error}</Text>
      </SafeAreaView>
    );
  }

  if (!indice || !fuentesResueltas) {
    return (
      <SafeAreaView style={[s.pantalla, s.centrado]} edges={['top', 'left', 'right']}>
        <ActivityIndicator size="large" color={C.acento} />
        <Text style={s.cargando}>Abriendo el almacén…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.pantalla} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" />

      <View style={s.encabezado}>
        <Text style={s.supratitulo}>changuito</Text>
        <Text style={s.titulo} numberOfLines={1} adjustsFontSizeToFit>
          {indice.dataset.centro.nombre}
        </Text>
        <Text style={s.subtitulo}>
          {sucursales.length} súper cerca · datos del{' '}
          {formatearFecha(indice.dataset.fecha_datos)}
          {gpsActivo ? ' · gps' : ''}
          {actualizando ? ' · buscando datos nuevos…' : ''}
        </Text>
      </View>

      <View style={s.pestanas}>
        <Pestana
          activa={pestana === 'carrito'}
          onPress={() => setPestana('carrito')}
          texto={`Bolsa${carrito.length ? ` (${carrito.length})` : ''}`}
        />
        <Pestana
          activa={pestana === 'ofertas'}
          onPress={() => setPestana('ofertas')}
          texto="Ofertas"
        />
        <Pestana
          activa={pestana === 'comparar'}
          onPress={() => setPestana('comparar')}
          texto="Dónde compro"
        />
      </View>

      {pestana === 'carrito' && (
        <PantallaCarrito
          indice={indice}
          sucursales={sucursales}
          carrito={carrito}
          agregar={agregar}
          cambiarCantidad={cambiarCantidad}
          quitar={quitar}
          vaciar={vaciar}
          onEscanear={() => setEscaneando(true)}
        />
      )}
      {pestana === 'ofertas' && (
        <PantallaOfertas
          indice={indice}
          sucursales={sucursales}
          agregar={agregar}
          radio={radio}
          setRadio={setRadio}
        />
      )}
      {pestana === 'comparar' && (
        <PantallaComparar
          indice={indice}
          sucursales={sucursales}
          carrito={carrito}
          radio={radio}
          setRadio={setRadio}
        />
      )}

      <Escaner
        visible={escaneando}
        indice={indice}
        sucursales={sucursales}
        onCerrar={() => setEscaneando(false)}
        onAgregar={agregar}
      />
    </SafeAreaView>
  );
}

function Pestana({ activa, onPress, texto }: any) {
  return (
    <Pressable onPress={onPress} style={[s.pestana, activa && s.pestanaActiva]}>
      <Text style={[s.pestanaTexto, activa && s.pestanaTextoActivo]}>{texto}</Text>
    </Pressable>
  );
}

/** Hasta dónde estás dispuesto a moverte. Se comparte entre ofertas y comparación. */
function SelectorRadio({ radio, setRadio }: any) {
  return (
    <View style={s.filaRadio}>
      {[2, 5, 10, 60].map((km) => (
        <Pressable
          key={km}
          onPress={() => setRadio(km)}
          style={[s.chip, radio === km && s.chipActivo]}
        >
          <Text style={[s.chipTexto, radio === km && s.chipTextoActivo]}>{km} km</Text>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * Qué puede reemplazar a lo que este súper no tiene.
 *
 * Comparar por EAN exacto deja a la sucursal "sin el producto" aunque tenga la
 * misma yerba de otra marca al lado. Acá se busca el equivalente dentro de esa
 * misma sucursal y se muestra su precio por kilo, que es lo que permite saber
 * si conviene.
 */
function Sustitutos({ indice, resultado }: any) {
  const sugerencias = useMemo(() => {
    const salida: any[] = [];
    for (const falta of resultado.faltantes.slice(0, 3)) {
      const [mejor] = alternativas(indice, falta.indice, [resultado.sucursal], {
        limite: 1,
        // Sirve aunque rinda un poco menos: el punto es que este súper lo tenga.
        soloMejores: false,
      });
      if (mejor) salida.push({ falta, mejor });
    }
    return salida;
  }, [indice, resultado]);

  if (sugerencias.length === 0) return null;

  return (
    <View style={s.sustitutos}>
      {sugerencias.map(({ falta, mejor }) => (
        <Text key={falta.ean} style={s.sustituto} numberOfLines={2}>
          <Text style={s.sustitutoEtiqueta}>en cambio </Text>
          {mejor.desc} · {formatearPesos(mejor.precio)}{' '}
          <Text style={s.sustitutoUnidad}>({formatearPorUnidad(mejor.porUnidad)})</Text>
        </Text>
      ))}
    </View>
  );
}

/** "A, B y C" — el join directo produce "A y B y C". */
function listaEnEspanol(nombres: string[]) {
  if (nombres.length <= 1) return nombres.join('');
  return nombres.slice(0, -1).join(', ') + ' y ' + nombres[nombres.length - 1];
}

/**
 * Titulo de seccion. Organic evita las reglas horizontales y separa con aire,
 * asi que es solo texto en versalitas con espacio arriba.
 */
function Rotulo({ children }: any) {
  return (
    <View style={s.rotulo}>
      <Text style={s.rotuloTexto}>{children}</Text>
    </View>
  );
}

function PantallaCarrito({
  indice, sucursales, carrito, agregar, cambiarCantidad, quitar, vaciar, onEscanear,
}: any) {
  const [consulta, setConsulta] = useState('');

  const resultados = useMemo<ProductoEncontrado[]>(() => {
    if (consulta.trim().length < 3) return [];
    return buscarProductos(indice, consulta, { sucursales, limite: 40 });
  }, [indice, consulta, sucursales]);

  const enCarrito = useMemo(
    () => new Set(carrito.map((i: any) => i.indice)),
    [carrito]
  );

  const buscando = consulta.trim().length >= 3;

  return (
    <View style={s.contenido}>
      <View style={s.filaBusqueda}>
        <TextInput
          style={[s.buscador, s.flex]}
          placeholder="yerba, aceite, fideos…"
          placeholderTextColor={C.suave}
          value={consulta}
          onChangeText={setConsulta}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        <Pressable style={s.botonEscanear} onPress={onEscanear}>
          <Text style={s.botonEscanearTexto}>Escanear</Text>
        </Pressable>
      </View>

      {buscando ? (
        <FlatList
          data={resultados}
          keyExtractor={(p) => String(p.indice)}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={s.vacio}>Nada que se parezca a “{consulta}”.</Text>
          }
          renderItem={({ item }) => (
            <Pressable style={s.filaProducto} onPress={() => agregar(item.indice)}>
              <ImagenProducto ean={item.ean} desc={item.desc} tamano={48} />
              <View style={[s.flex, s.textoFila]}>
                <Text style={s.nombreProducto}>{item.desc}</Text>
                <Text style={s.metaProducto}>
                  {item.cadenas > 1
                    ? `se compara en ${item.cadenas} súper`
                    : 'sólo en un súper'}
                </Text>
              </View>
              <Text style={[s.agregar, enCarrito.has(item.indice) && s.agregado]}>
                {enCarrito.has(item.indice) ? '✓' : '+'}
              </Text>
            </Pressable>
          )}
        />
      ) : carrito.length === 0 ? (
        <View style={s.centrado}>
          <Text style={s.vacioTitulo}>La bolsa está vacía</Text>
          <Text style={s.vacio}>
            Anotá lo que querés comprar y después te digo en qué súper te sale más barato.
          </Text>
        </View>
      ) : (
        <FlatList
          data={carrito}
          keyExtractor={(i: any) => String(i.indice)}
          ListHeaderComponent={
            <View style={s.filaEntre}>
              <Text style={s.seccionSinTope}>{carrito.length} productos</Text>
              <Pressable onPress={vaciar}>
                <Text style={s.enlace}>Vaciar</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => {
            const p = indice.dataset.productos[item.indice];
            return (
              <View style={s.filaProducto}>
                <ImagenProducto ean={p.ean} desc={p.desc} tamano={48} buscarFoto />
                <View style={[s.flex, s.textoFila]}>
                  <Text style={s.nombreProducto}>{p.desc}</Text>
                  <Pressable onPress={() => quitar(item.indice)}>
                    <Text style={s.quitar}>Quitar</Text>
                  </Pressable>
                </View>
                <View style={s.contador}>
                  <Pressable onPress={() => cambiarCantidad(item.indice, -1)} hitSlop={10}>
                    <Text style={s.contadorBoton}>−</Text>
                  </Pressable>
                  <Text style={s.contadorValor}>{item.cantidad}</Text>
                  <Pressable onPress={() => cambiarCantidad(item.indice, 1)} hitSlop={10}>
                    <Text style={s.contadorBoton}>+</Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

/**
 * Ofertas, en dos sentidos distintos que conviene no mezclar:
 *
 *  - "Rebajas": promociones que la cadena declara en SEPA. Son un descuento real
 *    contra su propio precio de lista, pero sólo algunas cadenas las informan.
 *  - "Diferencias": el mismo producto mucho más barato en un súper que en otro.
 *    No es una promoción, pero suele ser el ahorro más grande, y cubre a todas
 *    las cadenas porque sale de comparar precios de lista.
 */
/**
 * Ofertas: las rebajas que cada cadena declara en SEPA, contra su propio precio
 * de lista.
 *
 * Ojo con la cobertura: no todas las cadenas informan promociones. En Trelew las
 * publican Carrefour y La Anonima; Changomas y Vea no informan ninguna, y eso no
 * significa que no tengan ofertas en la gondola. Por eso se aclara en pantalla.
 */
function PantallaOfertas({ indice, sucursales, agregar, radio, setRadio }: any) {
  const [rubro, setRubro] = useState<Rubro>('almacen');

  const promoPorCadena = useMemo(
    () => cadenasConPromo(indice, sucursales),
    [indice, sucursales]
  );

  const rebajas = useMemo<OfertaDeclarada[]>(
    () => ofertasDeclaradas(indice, sucursales, { limite: 50, rubro }),
    [indice, sucursales, rubro]
  );

  return (
    <ScrollView style={s.contenido} contentContainerStyle={s.scrollFondo}>
      <SelectorRadio radio={radio} setRadio={setRadio} />

      <View style={s.filaRubros}>
        {RUBROS.map((r) => (
          <Pressable
            key={r.id}
            onPress={() => setRubro(r.id)}
            style={[s.chipChico, rubro === r.id && s.chipChicoActivo]}
          >
            <Text style={[s.chipChicoTexto, rubro === r.id && s.chipTextoActivo]}>
              {r.nombre}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={s.nota}>
        Descuentos que la cadena informa contra su propio precio de lista.
        {promoPorCadena.sin.length > 0 && (
          <Text>
            {'\n'}
            {listaEnEspanol(promoPorCadena.sin.map((c: any) => c.nombre))}{' '}
            {promoPorCadena.sin.length > 1 ? 'no informan' : 'no informa'} promociones
            a SEPA: pueden tener ofertas que acá no se ven.
          </Text>
        )}
      </Text>

      {rebajas.length === 0 && (
        <Text style={s.vacio}>No hay rebajas en este rubro dentro del radio elegido.</Text>
      )}

      {rebajas.map((o) => {
        const pu = precioPorUnidad(o, o.promo);
        return (
          <Pressable
            key={o.cadena.id + o.ean}
            style={s.tarjetaOferta}
            onPress={() => agregar(o.indice)}
          >
            <ImagenProducto ean={o.ean} desc={o.desc} tamano={52} />
            <View style={[s.flex, s.textoFila]}>
              <Text style={s.nombreProducto} numberOfLines={2}>{o.desc}</Text>
              <View style={s.filaPrecios}>
                <Text style={s.precioOferta}>{formatearPesos(o.promo)}</Text>
                <Text style={s.precioTachado}>{formatearPesos(o.precio)}</Text>
                {pu && <Text style={s.porUnidad}>{formatearPorUnidad(pu)}</Text>}
              </View>
              <Text style={s.metaProducto}>
                {o.cadena.nombre} · {o.sucursal.distancia} km
                {o.equivalentes > 1 ? ` · +${o.equivalentes - 1} súper` : ''}
                {o.leyenda?.hasta ? ` · hasta ${formatearFecha(o.leyenda.hasta)}` : ''}
              </Text>
            </View>
            <View style={s.selloDescuento}>
              <Text style={s.selloDescuentoTexto}>
                -{Math.round(o.descuento * 100)}%
              </Text>
            </View>
          </Pressable>
        );
      })}

      {rebajas.length > 0 && (
        <Text style={s.pie}>Tocá cualquier oferta para sumarla a tu bolsa.</Text>
      )}
    </ScrollView>
  );
}

function PantallaComparar({ indice, sucursales, carrito, radio, setRadio }: any) {
  const res = useMemo(
    () => (carrito.length ? compararCarrito(indice, carrito, sucursales) : null),
    [indice, carrito, sucursales]
  );

  if (!res) {
    return (
      <View style={[s.contenido, s.centrado]}>
        <Text style={s.vacioTitulo}>Todavía no hay nada que comparar</Text>
        <Text style={s.vacio}>Cargá tu bolsa primero.</Text>
      </View>
    );
  }

  const mejorCompleta = res.completas[0];
  const peorCompleta = res.completas[res.completas.length - 1];
  const ahorro =
    mejorCompleta && peorCompleta ? peorCompleta.total - mejorCompleta.total : 0;
  const extraPorUnSoloLugar = mejorCompleta
    ? mejorCompleta.total - res.dividida.total
    : 0;

  return (
    <ScrollView style={s.contenido} contentContainerStyle={s.scrollFondo}>
      <SelectorRadio radio={radio} setRadio={setRadio} />

      {mejorCompleta ? (
        <View style={s.sello}>
          <View style={s.selloInterior}>
            <Text style={s.selloEtiqueta}>conviene</Text>
            <Text style={s.selloNombre}>{mejorCompleta.cadena.nombre}</Text>
            <Text style={s.selloDireccion}>
              {mejorCompleta.sucursal.direccion} · a {mejorCompleta.sucursal.distancia} km
            </Text>
            <Text style={s.selloTotal}>{formatearPesos(mejorCompleta.total)}</Text>
            {ahorro > 0 && (
              <Text style={s.selloAhorro}>
                Ahorrás {formatearPesos(ahorro)} frente a {peorCompleta.cadena.nombre}
              </Text>
            )}
          </View>
        </View>
      ) : (
        <View style={s.aviso}>
          <Text style={s.avisoTitulo}>Ningún súper tiene todo</Text>
          <Text style={s.avisoTexto}>
            Cada cadena informa un catálogo distinto. Abajo está cuánto cubre cada una.
          </Text>
        </View>
      )}

      <Rotulo>Todos los súper cerca</Rotulo>
      {res.porSucursal.map((r: ResultadoSucursal) => (
        <View key={r.sucursal.id} style={s.tarjeta}>
          <View style={s.filaEntre}>
            <View style={s.flex}>
              <Text style={s.nombreCadena}>{r.cadena.nombre}</Text>
              <Text style={s.metaProducto}>
                {r.sucursal.direccion} · {r.sucursal.distancia} km
                {r.equivalentes > 1
                  ? ` · +${r.equivalentes - 1} sucursal${
                      r.equivalentes > 2 ? 'es' : ''
                    } con los mismos precios`
                  : ''}
              </Text>
            </View>
            <View style={s.derecha}>
              <Text style={s.total}>{formatearPesos(r.total)}</Text>
              <Text
                style={[
                  s.cobertura,
                  r.faltantes.length === 0 ? s.coberturaOk : s.coberturaParcial,
                ]}
              >
                {r.items.length} de {carrito.length}
              </Text>
            </View>
          </View>
          {r.faltantes.length > 0 && (
            <>
              <Text style={s.faltantes} numberOfLines={2}>
                No tiene: {r.faltantes.map((f) => f.desc).join(' · ')}
              </Text>
              <Sustitutos indice={indice} resultado={r} />
            </>
          )}
        </View>
      ))}

      <Rotulo>Cada cosa donde está más barata</Rotulo>
      <View style={s.tarjeta}>
        <Text style={s.totalGrande}>{formatearPesos(res.dividida.total)}</Text>
        <Text style={s.metaProducto}>
          repartido en {res.dividida.paradas.length}{' '}
          {res.dividida.paradas.length === 1 ? 'parada' : 'paradas'}
        </Text>
        {extraPorUnSoloLugar > 0 && (
          <Text style={s.notaAhorro}>
            Comprar todo en {mejorCompleta.cadena.nombre} te cuesta{' '}
            {formatearPesos(extraPorUnSoloLugar)} más.
          </Text>
        )}
      </View>

      {res.dividida.paradas.map((p: any) => (
        <View key={p.sucursal.id} style={s.tarjeta}>
          <View style={s.filaEntre}>
            <View style={s.flex}>
              <Text style={s.nombreCadena}>{p.cadena.nombre}</Text>
              <Text style={s.metaProducto}>
                {p.sucursal.direccion} · {p.sucursal.distancia} km
              </Text>
            </View>
            <Text style={s.total}>{formatearPesos(p.total)}</Text>
          </View>
          <View style={s.punteado} />
          {p.items.map((it: any) => (
            <View key={it.indice} style={s.filaItem}>
              <ImagenProducto ean={it.ean} desc={it.desc} tamano={32} />
              <Text style={s.itemDesc} numberOfLines={1}>
                {it.cantidad > 1 ? `${it.cantidad}× ` : ''}
                {it.desc}
              </Text>
              <Text style={s.itemPrecio}>{formatearPesos(it.subtotal)}</Text>
            </View>
          ))}
        </View>
      ))}

      <Text style={s.pie}>
        Precios informados por las cadenas al sistema SEPA.{'\n'}
        Pueden diferir de la góndola.
      </Text>
    </ScrollView>
  );
}

function formatearFecha(iso: string) {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

