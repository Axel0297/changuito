const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

/**
 * El dataset viaja como archivo, no como codigo.
 *
 * Metro trata a los .json como modulos fuente: `require('dataset.json')` termina
 * inlineado dentro del bundle, y el bundle se compila a bytecode de Hermes. Con
 * 8 MB de datos eso genera un literal gigantesco que Hermes no digiere: la app
 * abria y moria con "Cannot convert undefined value to object" al indexar.
 *
 * Con extension .dat, Metro lo empaqueta como asset binario y se lee en runtime
 * con expo-asset. El bundle vuelve a pesar cientos de kB en vez de 8 MB.
 */
config.resolver.assetExts.push('dat');

module.exports = config;
