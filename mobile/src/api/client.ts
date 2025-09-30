import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Troque o BASE_URL conforme onde o backend roda:
 * - Android emulador: http://10.0.2.2:3000/api
 * - iOS simulador:   http://localhost:3000/api
 * - Dispositivo físico: http://SEU_IP_LAN:3000/api  (ex.: http://192.168.0.14:3000/api)
 */
const DEFAULT_URL = "http://192.168.2.105:3000/api"; // ajuste aqui
const BASE_URL = (process.env.EXPO_PUBLIC_API_URL || DEFAULT_URL).replace(/\/$/, "");

export const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem("token");
  if (token) config.headers["x-auth-token"] = token;
  return config;
});
