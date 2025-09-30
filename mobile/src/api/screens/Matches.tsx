import React, { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { api } from "../client";
import { colors, spacing } from "../theme";

export default function Matches() {
  const [matches, setMatches] = useState<any[]>([]);
  useEffect(() => { api.get("/matches").then(r => setMatches(r.data || [])); }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Matches</Text>
      <FlatList
        data={matches}
        keyExtractor={(item) => String(item.id)}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.item}>#{item.id}</Text>
            <Text style={styles.item}>a: {item.user_a?.slice(0,8)}…</Text>
            <Text style={styles.item}>b: {item.user_b?.slice(0,8)}…</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={{ color: colors.textDim }}>Nenhum match ainda.</Text>}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing(2) },
  title: { color: colors.text, fontSize: 22, fontWeight: "800", marginBottom: spacing(1.5) },
  sep: { height: 1, backgroundColor: colors.border, marginVertical: spacing(1) },
  row: { flexDirection: "row", gap: spacing(1.5) },
  item: { color: colors.textDim },
});
