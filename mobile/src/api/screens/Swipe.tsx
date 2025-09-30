import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { AntDesign, Entypo } from "@expo/vector-icons";
import { api } from "../client";
import SwipeCardSimple from "../components/SwipeCardSimple";
import { colors, radius, spacing } from "../theme";

export default function Swipe({ navigation }: any) {
  const [queue, setQueue] = useState<any[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get("/feed");
      setQueue(data || []);
      setIndex(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [reloadKey]);

  async function handleSwipe(dir: "left" | "right") {
    const current = queue[index];
    if (!current) return;
    await api.post("/swipes", { to_user: current.id, decision: dir === "right" ? "like" : "pass" });
    setIndex(i => i + 1);
    if (index + 1 >= queue.length) setTimeout(() => setReloadKey(k => k + 1), 150);
  }

  const stack = useMemo(() => queue.slice(index, index + 3), [queue, index]);

  if (loading) return <View style={styles.center}><ActivityIndicator/></View>;

  return (
    <View style={styles.container}>
      <View style={styles.cardArea}>
        {stack.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>Sem pessoas no momento</Text>
            <PrimaryButton label="Atualizar" onPress={() => setReloadKey(k=>k+1)} />
          </View>
        ) : (
          stack.map((u, i) => (
            <SwipeCardSimple key={u.id} user={u} zIndex={10 - i} onSwipe={handleSwipe} />
          ))
        )}
      </View>

      <View style={styles.actions}>
        <CircleButton onPress={() => handleSwipe("left")} border={colors.nope}>
          <Entypo name="cross" size={32} color={colors.nope} />
        </CircleButton>
        <CircleButton onPress={() => navigation.navigate("Matches")} border={colors.info}>
          <AntDesign name="message1" size={26} color={colors.info} />
        </CircleButton>
        <CircleButton onPress={() => handleSwipe("right")} big border={colors.like}>
          <AntDesign name="heart" size={28} color={colors.like} />
        </CircleButton>
        <CircleButton onPress={() => navigation.navigate("ProofUpload")} border={colors.warn}>
          <AntDesign name="idcard" size={24} color={colors.warn} />
        </CircleButton>
      </View>
    </View>
  );
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={styles.primaryBtn}>
      <Text style={styles.primaryBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

function CircleButton({ children, onPress, big, border }: any) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}
      style={[styles.circle, big && styles.circleBig, { borderColor: border || colors.border }]}
    >
      {children}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing(2) },
  cardArea: { flex: 1, position: "relative" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { color: colors.text, fontSize: 18, marginBottom: spacing(1.5) },

  actions: {
    height: 100, alignItems: "center", justifyContent: "center",
    gap: spacing(2), flexDirection: "row",
  },
  circle: {
    width: 64, height: 64, borderRadius: 999, alignItems: "center", justifyContent: "center",
    backgroundColor: "#111", borderWidth: 3,
  },
  circleBig: { width: 78, height: 78 },
  primaryBtn: {
    backgroundColor: colors.text,
    paddingHorizontal: spacing(2), paddingVertical: spacing(1.25),
    borderRadius: 999,
  },
  primaryBtnText: { color: "#000", fontWeight: "700" },
});
