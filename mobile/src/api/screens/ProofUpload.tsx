import React, { useState } from "react";
import { View, Button, Text, Alert, Image, StyleSheet } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { api } from "../client";
import { colors, spacing } from "../theme";

type RNFile = { uri: string; name: string; type: string };

export default function ProofUpload() {
  const [status, setStatus] = useState<any>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function pickAndSend() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: false, quality: 1,
    });
    if (res.canceled) return;

    const asset = res.assets[0];
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
      const { data } = await api.post("/proofs", form, { headers: { "Content-Type": "multipart/form-data" } });
      setStatus(data);
      Alert.alert("Enviado!", `Status: ${data.status}`);
    } catch (e: any) {
      Alert.alert("Erro", e?.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  }

  async function check() {
    const { data } = await api.get("/proofs/status");
    setStatus(data);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Comprovante de Matrícula</Text>

      {preview && <Image source={{ uri: preview }} style={styles.preview} />}

      <View style={{ gap: spacing(1) }}>
        <Button title={busy ? "Enviando..." : "Selecionar e enviar"} onPress={pickAndSend} disabled={busy} />
        <Button title="Ver status" onPress={check} />
      </View>

      <View style={{ marginTop: spacing(2), gap: 6 }}>
        <Text style={styles.label}>Status: <Text style={styles.value}>{status?.status ?? "-"}</Text></Text>
        <Text style={styles.label}>Motivo: <Text style={styles.value}>{status?.reason ?? "-"}</Text></Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing(2), gap: spacing(2) },
  title: { color: colors.text, fontSize: 22, fontWeight: "800" },
  preview: { width: "100%", height: 220, borderRadius: 12, borderWidth: 1, borderColor: colors.border, resizeMode: "cover" },
  label: { color: colors.textDim },
  value: { color: colors.text },
});
