/**
 * Escaner de codigo de barras.
 *
 * El dataset ya viene indexado por EAN, que es exactamente lo que imprime el
 * codigo de barras de la gondola: apuntar la camara y saber donde esta mas
 * barato ese producto sale practicamente gratis.
 */
import { useMemo, useState } from 'react';
import {
  ActivityIndicator, Modal, Pressable, SafeAreaView, ScrollView,
  StyleSheet, Text, View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  alternativas, formatearPesos, formatearPorUnidad, preciosDeProducto,
  precioPorUnidad,
} from './comparador';
import type { Alternativa, Indice, SucursalCercana } from './comparador';
import { ImagenProducto } from './ImagenProducto';
import { C, E, F, R, SOMBRA } from './tema';

interface Props {
  visible: boolean;
  indice: Indice;
  sucursales: SucursalCercana[];
  onCerrar: () => void;
  onAgregar: (indiceProducto: number) => void;
}

export function Escaner({ visible, indice, sucursales, onCerrar, onAgregar }: Props) {
  const [permiso, pedirPermiso] = useCameraPermissions();
  const [leido, setLeido] = useState<{ ean: string; producto: number | null } | null>(null);
  const [agregado, setAgregado] = useState(false);

  const precios = useMemo(
    () =>
      leido?.producto != null
        ? preciosDeProducto(indice, leido.producto, sucursales)
        : [],
    [indice, leido, sucursales]
  );

  function alEscanear(ean: string) {
    if (leido) return; // ya hay una lectura en pantalla
    const i = indice.porEan.get(ean);
    setLeido({ ean, producto: i ?? null });
    setAgregado(false);
  }

  function reiniciar() {
    setLeido(null);
    setAgregado(false);
  }

  function cerrar() {
    reiniciar();
    onCerrar();
  }

  const producto = leido?.producto != null ? indice.dataset.productos[leido.producto] : null;

  // Otras marcas o presentaciones del mismo producto que rinden mas por kilo.
  const equivalentes = useMemo<Alternativa[]>(
    () =>
      leido?.producto != null
        ? alternativas(indice, leido.producto, sucursales, { limite: 3 })
        : [],
    [indice, leido, sucursales]
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={cerrar}>
      <SafeAreaView style={e.pantalla}>
        <View style={e.barra}>
          <Text style={e.titulo}>Escanear producto</Text>
          <Pressable onPress={cerrar} hitSlop={12}>
            <Text style={e.cerrar}>Cerrar</Text>
          </Pressable>
        </View>
        <View style={e.regla} />

        {!permiso ? (
          <View style={e.centrado}>
            <ActivityIndicator color={C.acento} />
          </View>
        ) : !permiso.granted ? (
          <View style={e.centrado}>
            <Text style={e.mensajeTitulo}>Necesito la cámara</Text>
            <Text style={e.mensaje}>
              Para leer el código de barras del producto que tenés en la mano.
            </Text>
            <Pressable style={e.boton} onPress={pedirPermiso}>
              <Text style={e.botonTexto}>Dar permiso</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/*
              O la camara o el resultado, nunca los dos: dejar la camara
              montada detras del resultado se comia media pantalla y mantenia
              el sensor prendido gastando bateria al pedo.
            */}
            {!leido && (
              <View style={e.camara}>
                <CameraView
                  style={e.camaraVista}
                  facing="back"
                  barcodeScannerSettings={{
                    barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'],
                  }}
                  onBarcodeScanned={({ data }) => alEscanear(data)}
                />
                <View style={e.mira} pointerEvents="none">
                  <Text style={e.miraTexto}>Apuntá al código de barras</Text>
                </View>
              </View>
            )}

            {leido && (
              <ScrollView style={e.resultado} contentContainerStyle={e.resultadoFondo}>
                {!producto ? (
                  <>
                    <Text style={e.mensajeTitulo}>No lo tengo anotado</Text>
                    <Text style={e.mensaje}>
                      El código {leido.ean} no figura entre los precios informados por
                      los súper de tu zona.
                    </Text>
                  </>
                ) : (
                  <>
                    <View style={e.cabezaProducto}>
                      <ImagenProducto
                        ean={producto.ean}
                        desc={producto.desc}
                        tamano={58}
                        buscarFoto
                      />
                      <Text style={e.nombreProducto}>{producto.desc}</Text>
                    </View>

                    {precios.length === 0 ? (
                      <Text style={e.mensaje}>
                        Ningún súper dentro del radio elegido lo tiene.
                      </Text>
                    ) : (
                      precios.map((p, i) => (
                        <View
                          key={p.cadena.id + p.precio}
                          style={[e.fila, i === 0 && e.filaMejor]}
                        >
                          <View style={e.flex}>
                            <Text style={[e.cadena, i === 0 && e.cadenaMejor]}>
                              {p.cadena.nombre}
                            </Text>
                            <Text style={e.meta}>
                              {p.sucursal.direccion} · {p.sucursal.distancia} km
                              {p.equivalentes > 1 ? ` · +${p.equivalentes - 1}` : ''}
                            </Text>
                          </View>
                          <View style={e.derecha}>
                            <Text style={[e.precio, i === 0 && e.precioMejor]}>
                              {formatearPesos(p.precio)}
                            </Text>
                            {i === 0 ? (
                              <Text style={e.porUnidad}>
                                {formatearPorUnidad(precioPorUnidad(producto, p.precio))}
                              </Text>
                            ) : (
                              <Text style={e.diferencia}>
                                +{formatearPesos(p.precio - precios[0].precio)}
                              </Text>
                            )}
                          </View>
                        </View>
                      ))
                    )}

                    {equivalentes.length > 0 && (
                      <>
                        <Text style={e.rotulo}>Rinden más por {equivalentes[0].porUnidad.unidad}</Text>
                        {equivalentes.map((a) => (
                          <Pressable
                            key={a.ean}
                            style={e.fila}
                            onPress={() => onAgregar(a.indice)}
                          >
                            <View style={e.flex}>
                              <Text style={e.cadena} numberOfLines={2}>{a.desc}</Text>
                              <Text style={e.meta}>
                                {a.cadena.nombre} · {a.sucursal.distancia} km
                              </Text>
                            </View>
                            <View style={e.derecha}>
                              <Text style={e.precio}>{formatearPesos(a.precio)}</Text>
                              <Text style={e.porUnidadMejor}>
                                {formatearPorUnidad(a.porUnidad)}
                              </Text>
                            </View>
                          </Pressable>
                        ))}
                      </>
                    )}

                    <Pressable
                      style={[e.boton, agregado && e.botonHecho]}
                      onPress={() => {
                        onAgregar(leido.producto!);
                        setAgregado(true);
                      }}
                      disabled={agregado}
                    >
                      <Text style={e.botonTexto}>
                        {agregado ? 'Anotado en la bolsa' : 'Agregar a la bolsa'}
                      </Text>
                    </Pressable>
                  </>
                )}

                <Pressable style={e.botonSecundario} onPress={reiniciar}>
                  <Text style={e.botonSecundarioTexto}>Escanear otro</Text>
                </Pressable>
              </ScrollView>
            )}
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: C.fondo },
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: E[6] },
  flex: { flex: 1 },
  derecha: { alignItems: 'flex-end' },

  barra: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: E[4], paddingTop: E[3], paddingBottom: E[2],
  },
  titulo: { fontSize: 22, color: C.texto, fontFamily: F.titulo, lineHeight: 26 },
  cerrar: { fontSize: 14, color: C.acento, fontFamily: F.cuerpoMedio },
  regla: { height: 0 },

  // La camara es la unica superficie oscura del sistema: se la deja respirar
  // con el mismo redondeo grande de los contenedores.
  camara: {
    flex: 1, marginHorizontal: E[4], marginBottom: E[3], borderRadius: R.contenedor,
    overflow: 'hidden', backgroundColor: C.texto,
  },
  camaraVista: { flex: 1 },
  mira: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'flex-end', paddingBottom: E[4],
  },
  miraTexto: {
    color: C.fondo, fontSize: 13, fontFamily: F.cuerpoMedio,
    backgroundColor: 'rgba(32,30,29,0.82)', paddingHorizontal: E[3],
    paddingVertical: E[2], borderRadius: R.pill,
  },

  resultado: { flex: 1, backgroundColor: C.fondo },
  resultadoFondo: { paddingHorizontal: E[4], paddingBottom: E[4] },
  cabezaProducto: {
    flexDirection: 'row', alignItems: 'center', gap: E[3], marginBottom: E[3],
  },
  nombreProducto: {
    flex: 1, fontSize: 15, color: C.texto, fontFamily: F.cuerpoFuerte, lineHeight: 20,
  },

  fila: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.tarjeta,
    borderRadius: R.lg, padding: E[3], marginBottom: E[2],
  },
  filaMejor: { backgroundColor: C.okSuave, ...SOMBRA.sm },
  cadena: { fontSize: 14, color: C.texto, fontFamily: F.cuerpoMedio },
  cadenaMejor: { color: C.ok, fontFamily: F.cuerpoFuerte },
  meta: { fontSize: 11, color: C.suave, marginTop: 2, fontFamily: F.cuerpo },
  precio: { fontSize: 16, color: C.texto, fontFamily: F.cuerpoFuerte },
  precioMejor: { color: C.ok, fontSize: 19 },
  diferencia: { fontSize: 11, color: C.alerta, marginTop: 2, fontFamily: F.cuerpo },
  porUnidad: { fontSize: 11, color: C.ok, marginTop: 2, fontFamily: F.cuerpoMedio },
  porUnidadMejor: {
    fontSize: 11.5, color: C.acentoFuerte, marginTop: 2, fontFamily: F.cuerpoFuerte,
  },
  rotulo: {
    fontSize: 10.5, color: C.suave, fontFamily: F.cuerpoMedio, marginTop: E[4],
    marginBottom: E[2], textTransform: 'uppercase', letterSpacing: 1.6,
  },

  mensajeTitulo: {
    fontSize: 20, color: C.texto, marginBottom: E[2],
    textAlign: 'center', fontFamily: F.titulo, lineHeight: 24,
  },
  mensaje: {
    color: C.suave, textAlign: 'center', lineHeight: 20,
    fontFamily: F.cuerpo, fontSize: 14,
  },

  boton: {
    backgroundColor: C.acento, borderRadius: R.pill, paddingVertical: E[3],
    alignItems: 'center', marginTop: E[3],
  },
  botonHecho: { backgroundColor: C.suave },
  botonTexto: { color: C.fondo, fontFamily: F.cuerpoFuerte, fontSize: 14 },
  botonSecundario: { paddingVertical: E[3], alignItems: 'center', marginTop: E[1] },
  botonSecundarioTexto: { color: C.acento, fontFamily: F.cuerpoMedio, fontSize: 14 },
});
