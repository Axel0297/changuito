import { useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, SafeAreaView, ScrollView,
  StatusBar, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useFonts, Bitter_400Regular, Bitter_600SemiBold, Bitter_700Bold } from '@expo-google-fonts/bitter';
import { AlfaSlabOne_400Regular } from '@expo-google-fonts/alfa-slab-one';
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
import { C, F } from './src/tema';

export default function App() {
  // Si las fuentes fallan se sigue con las del sistema: una tipografia que no
  // carga no puede dejar la app trabada en la pantalla de carga.
  const [fuentesCargadas, errorFuentes] = useFonts({
    AlfaSlabOne_400Regular,
    Bitter_400Regular,
    Bitter_600SemiBold,
    Bitter_700Bold,
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
      <SafeAreaView style={[s.pantalla, s.centrado]}>
        <Text style={s.vacioTitulo}>No pude abrir los precios</Text>
        <Text style={s.vacio}>{error}</Text>
      </SafeAreaView>
    );
  }

  if (!indice || !fuentesResueltas) {
    return (
      <SafeAreaView style={[s.pantalla, s.centrado]}>
        <ActivityIndicator size="large" color={C.acento} />
        <Text style={s.cargando}>Abriendo el almacén…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.pantalla}>
      <StatusBar barStyle="dark-content" />

      <View style={s.encabezado}>
        <Text style={s.supratitulo}>changuito</Text>
        <Text style={s.titulo} numberOfLines={1} adjustsFontSizeToFit>
          {indice.dataset.centro.nombre}
        </Text>
        <View style={s.reglaDoble}>
          <View style={s.reglaGruesa} />
          <View style={s.reglaFina} />
        </View>
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

/** Titulo de seccion con filete a los costados, como rotulo de vidriera. */
function Rotulo({ children }: any) {
  return (
    <View style={s.rotulo}>
      <View style={s.rotuloLinea} />
      <Text style={s.rotuloTexto}>{children}</Text>
      <View style={s.rotuloLinea} />
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

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: C.fondo },
  contenido: { flex: 1, paddingHorizontal: 16 },
  scrollFondo: { paddingBottom: 40 },
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  flex: { flex: 1 },
  derecha: { alignItems: 'flex-end' },
  cargando: { marginTop: 12, color: C.suave, fontFamily: F.cuerpo },

  encabezado: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10 },
  // "precios" chiquito arriba y la localidad grande abajo, como cartel de vidriera.
  supratitulo: {
    fontSize: 10.5, color: C.suave, textAlign: 'center',
    fontFamily: F.cuerpoMedio, textTransform: 'uppercase', letterSpacing: 5,
  },
  titulo: {
    fontSize: 28, color: C.texto, fontFamily: F.titulo,
    textAlign: 'center', letterSpacing: 0.5, marginTop: 2,
  },
  reglaDoble: { marginTop: 6, marginBottom: 6 },
  reglaGruesa: { height: 2, backgroundColor: C.texto, opacity: 0.75 },
  reglaFina: { height: 1, backgroundColor: C.texto, opacity: 0.4, marginTop: 2 },
  subtitulo: {
    fontSize: 11.5, color: C.suave, textAlign: 'center',
    fontFamily: F.cuerpo, letterSpacing: 0.4,
  },

  pestanas: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 14 },
  pestana: {
    flex: 1, paddingVertical: 9, borderRadius: 3,
    backgroundColor: C.tarjeta, borderWidth: 1, borderColor: C.borde,
  },
  pestanaActiva: { backgroundColor: C.texto, borderColor: C.texto },
  pestanaTexto: {
    textAlign: 'center', color: C.suave, fontFamily: F.cuerpoMedio, fontSize: 13.5,
  },
  pestanaTextoActivo: { color: C.fondo },

  filaBusqueda: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  buscador: {
    backgroundColor: C.tarjeta, borderRadius: 3, paddingHorizontal: 14,
    paddingVertical: 11, fontSize: 15, color: C.texto, fontFamily: F.cuerpo,
    borderWidth: 1, borderColor: C.borde,
  },
  botonEscanear: {
    backgroundColor: C.alerta, borderRadius: 3, paddingHorizontal: 16,
    justifyContent: 'center', borderWidth: 1, borderColor: C.alerta,
  },
  botonEscanearTexto: { color: C.tarjeta, fontFamily: F.cuerpoFuerte, fontSize: 13 },

  filaProducto: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.tarjeta,
    borderRadius: 3, padding: 11, marginBottom: 8,
    borderWidth: 1, borderColor: C.borde,
  },
  textoFila: { marginLeft: 12 },
  nombreProducto: { fontSize: 14, color: C.texto, fontFamily: F.cuerpoMedio, lineHeight: 19 },
  metaProducto: { fontSize: 11.5, color: C.suave, marginTop: 3, fontFamily: F.cuerpo },
  agregar: {
    fontSize: 22, color: C.acento, paddingHorizontal: 10, fontFamily: F.cuerpoFuerte,
  },
  agregado: { color: C.suave },
  quitar: { fontSize: 11.5, color: C.alerta, marginTop: 5, fontFamily: F.cuerpo },

  contador: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  contadorBoton: {
    fontSize: 20, color: C.acento, fontFamily: F.cuerpoFuerte,
    width: 20, textAlign: 'center',
  },
  contadorValor: {
    fontSize: 15, color: C.texto, minWidth: 16, textAlign: 'center',
    fontFamily: F.cuerpoFuerte,
  },

  rotulo: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 24, marginBottom: 10 },
  rotuloLinea: { flex: 1, height: 1, backgroundColor: C.borde },
  rotuloTexto: {
    fontSize: 11, color: C.suave, fontFamily: F.cuerpoMedio,
    textTransform: 'uppercase', letterSpacing: 1.6,
  },
  seccionSinTope: {
    fontSize: 11, color: C.suave, marginBottom: 10, fontFamily: F.cuerpoMedio,
    textTransform: 'uppercase', letterSpacing: 1.6,
  },
  filaEntre: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  enlace: { color: C.alerta, fontSize: 12, fontFamily: F.cuerpo },
  vacioTitulo: {
    fontSize: 18, color: C.texto, marginBottom: 8, textAlign: 'center',
    fontFamily: F.titulo,
  },
  vacio: { color: C.suave, textAlign: 'center', lineHeight: 21, fontFamily: F.cuerpo, fontSize: 13.5 },

  filaRadio: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  chip: {
    paddingVertical: 5, paddingHorizontal: 13, borderRadius: 3,
    backgroundColor: C.tarjeta, borderWidth: 1, borderColor: C.borde,
  },
  chipActivo: { backgroundColor: C.mostazaSuave, borderColor: C.mostaza },
  chipTexto: { color: C.suave, fontSize: 12, fontFamily: F.cuerpoMedio },
  chipTextoActivo: { color: C.texto },
  chipAncho: { flex: 1, alignItems: 'center' },
  filaModo: { flexDirection: 'row', gap: 8, marginTop: 10 },

  filaRubros: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chipChico: {
    paddingVertical: 4, paddingHorizontal: 10, borderRadius: 3,
    backgroundColor: C.tarjeta, borderWidth: 1, borderColor: C.borde,
  },
  chipChicoActivo: { backgroundColor: C.acentoSuave, borderColor: C.acento },
  chipChicoTexto: { color: C.suave, fontSize: 11.5, fontFamily: F.cuerpo },

  nota: {
    fontSize: 11.5, color: C.suave, fontFamily: F.cuerpo,
    lineHeight: 17, marginTop: 14, marginBottom: 10, fontStyle: 'italic',
  },

  tarjetaOferta: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.tarjeta,
    borderRadius: 3, padding: 11, marginBottom: 8,
    borderWidth: 1, borderColor: C.borde,
  },
  filaPrecios: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 },
  precioOferta: { fontSize: 17, color: C.acento, fontFamily: F.cuerpoFuerte },
  porUnidad: {
    fontSize: 11.5, color: C.mostaza, fontFamily: F.cuerpoMedio,
  },
  precioTachado: {
    fontSize: 12.5, color: C.suave, fontFamily: F.cuerpo,
    textDecorationLine: 'line-through',
  },
  // Sello de descuento, como el precio pintado a mano sobre el cartel.
  selloDescuento: {
    backgroundColor: C.alerta, borderRadius: 3, paddingHorizontal: 7,
    paddingVertical: 5, marginLeft: 8,
  },
  selloDescuentoTexto: { color: C.tarjeta, fontFamily: F.cuerpoFuerte, fontSize: 13 },

  // Sello de doble filete, como el cartel de oferta pintado a mano.
  sello: {
    borderWidth: 2, borderColor: C.acento, borderRadius: 4,
    padding: 4, marginTop: 18, backgroundColor: C.acentoSuave,
  },
  selloInterior: {
    borderWidth: 1, borderColor: C.acento, borderRadius: 2,
    paddingVertical: 16, paddingHorizontal: 16, alignItems: 'center',
  },
  selloEtiqueta: {
    fontSize: 10.5, color: C.acento, fontFamily: F.cuerpoMedio,
    textTransform: 'uppercase', letterSpacing: 3,
  },
  selloNombre: {
    fontSize: 23, color: C.texto, marginTop: 8, fontFamily: F.titulo, textAlign: 'center',
  },
  selloDireccion: {
    fontSize: 12, color: C.suave, marginTop: 4, fontFamily: F.cuerpo, textAlign: 'center',
  },
  selloTotal: { fontSize: 34, color: C.acento, marginTop: 10, fontFamily: F.titulo },
  selloAhorro: {
    fontSize: 13, color: C.texto, marginTop: 6, fontFamily: F.cuerpo, textAlign: 'center',
  },

  aviso: {
    backgroundColor: C.alertaSuave, borderRadius: 4, padding: 16, marginTop: 18,
    borderWidth: 1, borderColor: C.alerta,
  },
  avisoTitulo: { color: C.alerta, marginBottom: 5, fontFamily: F.titulo, fontSize: 15 },
  avisoTexto: { color: C.texto, fontSize: 12.5, lineHeight: 19, fontFamily: F.cuerpo },

  tarjeta: {
    backgroundColor: C.tarjeta, borderRadius: 3, padding: 13, marginBottom: 8,
    borderWidth: 1, borderColor: C.borde,
  },
  nombreCadena: { fontSize: 15, color: C.texto, fontFamily: F.cuerpoFuerte },
  total: { fontSize: 17, color: C.texto, fontFamily: F.cuerpoFuerte },
  totalGrande: { fontSize: 26, color: C.acento, fontFamily: F.titulo },
  cobertura: { fontSize: 11.5, marginTop: 3, fontFamily: F.cuerpoMedio },
  coberturaOk: { color: C.acento },
  coberturaParcial: { color: C.alerta },
  faltantes: {
    fontSize: 11.5, color: C.suave, marginTop: 8,
    fontStyle: 'italic', fontFamily: F.cuerpo, lineHeight: 17,
  },
  notaAhorro: { fontSize: 12.5, color: C.texto, marginTop: 8, fontFamily: F.cuerpo },

  sustitutos: {
    marginTop: 8, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: C.borde, borderStyle: 'dashed',
  },
  sustituto: { fontSize: 11.5, color: C.texto, fontFamily: F.cuerpo, lineHeight: 17 },
  sustitutoEtiqueta: { color: C.acento, fontFamily: F.cuerpoMedio },
  sustitutoUnidad: { color: C.mostaza, fontFamily: F.cuerpoMedio },

  punteado: {
    borderBottomWidth: 1, borderStyle: 'dashed',
    borderColor: C.borde, marginTop: 11, marginBottom: 3,
  },
  filaItem: { flexDirection: 'row', alignItems: 'center', marginTop: 9, gap: 10 },
  itemDesc: { flex: 1, fontSize: 12, color: C.suave, fontFamily: F.cuerpo },
  itemPrecio: { fontSize: 12.5, color: C.texto, fontFamily: F.cuerpoFuerte },

  pie: {
    fontSize: 10.5, color: C.suave, textAlign: 'center', marginTop: 26,
    lineHeight: 16, fontFamily: F.cuerpo,
  },
});
