import React, { useEffect, useMemo, useState } from "react";
import { View, Button, Text, Alert, Image, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { api } from "../client";
import { colors, spacing } from "../theme";

type RNFile = { uri: string; name: string; type: string };

export default function ProofUpload() {
  const [status, setStatus] = useState<any>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const missingTokenMessage = "Token não encontrado. Faça o onboarding novamente.";

  const allowedMimes = useMemo(
    () => new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]),
    []
  );

  useEffect(() => {
    check(true);
  }, []);

  async function ensureToken(options: { silent?: boolean } = {}) {
    const stored = await AsyncStorage.getItem("token");
    if (!stored) {
      setLastError(missingTokenMessage);
      if (!options.silent) {
        Alert.alert("Atenção", missingTokenMessage);
      }
      return null;
    }
    return stored;
  }

  async function pickAndSend() {
    const token = await ensureToken();
    if (!token) return;

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 1,
    });
    if (res.canceled) return;

    const asset = res.assets[0];
    const mimeType = asset.mimeType || "";
    const fileSize = asset.fileSize ?? 0;

    if (mimeType && !allowedMimes.has(mimeType.toLowerCase())) {
      Alert.alert("Formato inválido", "Envie uma imagem JPEG, PNG, WEBP ou HEIC.");
      return;
    }

    if (fileSize > 0 && fileSize > 6 * 1024 * 1024) {
      Alert.alert("Arquivo muito grande", "O limite é de 6MB.");
      return;
    }

    setPreview(asset.uri);
    const file: RNFile = {
      uri: asset.uri,
      name: (asset.fileName as string) || `comprovante.${asset.mimeType?.split("/")[1] || "jpg"}`,
      type: asset.mimeType || "image/jpeg",
    };

    const form = new FormData();
    form.append("file", file as any);

    try {
      setBusy(true);
      setLastError(null);
      const { data } = await api.post("/proofs", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setStatus(data);
      Alert.alert("Enviado!", `Status: ${data.status}`);
    } catch (e: any) {
      const statusCode = e?.response?.status;
      const message = e?.response?.data?.error || e.message;
      if (statusCode === 401) {
        const friendly = "Token inválido. Refazendo o onboarding você gera um novo.";
        setLastError(friendly);
        await AsyncStorage.removeItem("token");
        Alert.alert("Sessão expirada", friendly);
        setStatus(null);
      } else {
        setLastError(message);
        Alert.alert("Erro", message || "Não foi possível enviar o comprovante");
      }
    } finally {
      setBusy(false);
    }
  }

  async function check(silentMissingToken = false) {
    const token = await ensureToken({ silent: silentMissingToken });
    if (!token) return;

    try {
      const { data } = await api.get("/proofs/status");
      setStatus(data);
      setLastError(null);
    } catch (e: any) {
      const statusCode = e?.response?.status;
      const message = e?.response?.data?.error || e.message;
      if (statusCode === 401) {
        const friendly = "Token inválido. Refazendo o onboarding você gera um novo.";
        setLastError(friendly);
        await AsyncStorage.removeItem("token");
        setStatus(null);
        if (!silentMissingToken) {
          Alert.alert("Sessão expirada", friendly);
        }
      } else {
        setLastError(message);
        Alert.alert("Erro", message || "Não foi possível consultar o status");
      }
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Comprovante de Matrícula</Text>

      {preview && <Image source={{ uri: preview }} style={styles.preview} />}

      <View style={{ gap: spacing(1) }}>
        <Button title={busy ? "Enviando..." : "Selecionar e enviar"} onPress={pickAndSend} disabled={busy} />
        <Button title="Ver status" onPress={() => check()} />
      </View>

      <View style={{ marginTop: spacing(2), gap: 6 }}>
        <Text style={styles.label}>
          Status: <Text style={styles.value}>{status?.status ?? "-"}</Text>
        </Text>
        <Text style={styles.label}>
          Motivo: <Text style={styles.value}>{status?.reason ?? "-"}</Text>
        </Text>
        {lastError ? (
          <Text style={[styles.label, { color: colors.warn }]}>Último erro: {lastError}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing(2), gap: spacing(2) },
  title: { color: colors.text, fontSize: 22, fontWeight: "800" },
  preview: {
    width: "100%",
    height: 220,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    resizeMode: "cover",
  },
  label: { color: colors.textDim },
  value: { color: colors.text },
});
