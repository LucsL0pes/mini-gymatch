import React, { useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../client";
import { colors, radius, spacing } from "../theme";

export default function Onboarding({ navigation }: any) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other">("male");
  const [showMe, setShowMe] = useState<"male" | "female" | "everyone">("everyone");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string }>({});

  const canSubmit = useMemo(() => {
    if (loading) return false;
    if (!name.trim()) return false;
    if (fieldErrors.name || fieldErrors.email) return false;
    return true;
  }, [loading, name, fieldErrors]);

  async function submit() {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const errors: { name?: string; email?: string } = {};

    if (trimmedName.length < 2) {
      errors.name = "Informe pelo menos 2 caracteres";
    }

    if (trimmedEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail.toLowerCase())) {
        errors.email = "E-mail inválido";
      }
    }

    setFieldErrors(errors);

    if (errors.name || errors.email) {
      return Alert.alert("Ops", errors.name || errors.email || "Revise os dados");
    }

    setLoading(true);
    try {
      const { data } = await api.post("/profiles/onboard", {
        name: trimmedName,
        email: trimmedEmail || undefined,
        gender,
        show_me: showMe,
      });
      await AsyncStorage.setItem("token", data.token);
      Alert.alert("Pronto!", "Conta criada");
      navigation.replace("Swipe");
    } catch (e: any) {
      Alert.alert("Erro", e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Crie seu perfil</Text>

      <TextInput
        style={[styles.input, fieldErrors.name && styles.inputError]}
        placeholder="Nome"
        placeholderTextColor={colors.textDim}
        value={name}
        onChangeText={(text) => {
          setName(text);
          if (fieldErrors.name && text.trim().length >= 2) {
            setFieldErrors((prev) => ({ ...prev, name: undefined }));
          }
        }}
      />
      {fieldErrors.name ? <Text style={styles.errorText}>{fieldErrors.name}</Text> : null}

      <TextInput
        style={[styles.input, fieldErrors.email && styles.inputError]}
        placeholder="Email (opcional)"
        placeholderTextColor={colors.textDim}
        keyboardType="email-address"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          if (fieldErrors.email) {
            const trimmed = text.trim();
            if (!trimmed) {
              setFieldErrors((prev) => ({ ...prev, email: undefined }));
            } else {
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              if (emailRegex.test(trimmed.toLowerCase())) {
                setFieldErrors((prev) => ({ ...prev, email: undefined }));
              }
            }
          }
        }}
      />
      {fieldErrors.email ? <Text style={styles.errorText}>{fieldErrors.email}</Text> : null}

      <Text style={styles.label}>Gênero</Text>
      <View style={styles.row}>
        {(["male", "female", "other"] as const).map((g) => (
          <Choice key={g} label={g} selected={gender === g} onPress={() => setGender(g)} />
        ))}
      </View>

      <Text style={styles.label}>Mostrar</Text>
      <View style={styles.row}>
        {(["male", "female", "everyone"] as const).map((s) => (
          <Choice key={s} label={s} selected={showMe === s} onPress={() => setShowMe(s)} />
        ))}
      </View>

      <TouchableOpacity style={[styles.btn, (!canSubmit || loading) && { opacity: 0.6 }]} onPress={submit} disabled={!canSubmit}>
        <Text style={styles.btnText}>{loading ? "Criando..." : "Começar"}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.replace("Swipe")} style={{ marginTop: spacing(2) }}>
        <Text style={{ color: colors.textDim }}>Pular (já tenho token)</Text>
      </TouchableOpacity>
    </View>
  );
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.choice, selected && styles.choiceOn]}>
      <Text style={[styles.choiceText, selected && styles.choiceTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing(2), gap: spacing(1.5) },
  title: { color: colors.text, fontSize: 28, fontWeight: "800", marginBottom: spacing(1) },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
    padding: spacing(1.5), color: colors.text, backgroundColor: "#111",
  },
  inputError: {
    borderColor: colors.warn,
  },
  errorText: {
    color: colors.warn,
    marginTop: -spacing(0.75),
    marginBottom: spacing(0.5),
    fontSize: 13,
  },
  label: { color: colors.textDim, marginTop: spacing(1) },
  row: { flexDirection: "row", gap: spacing(1), marginTop: spacing(0.5) },
  choice: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14,
  },
  choiceOn: { borderColor: colors.text, backgroundColor: "#1a1a1a" },
  choiceText: { color: colors.textDim, textTransform: "capitalize" },
  choiceTextOn: { color: colors.text },
  btn: { backgroundColor: colors.text, padding: spacing(1.5), borderRadius: 999, marginTop: spacing(2) },
  btnText: { color: "#000", fontWeight: "800", textAlign: "center" },
});
