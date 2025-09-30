import React, { useMemo } from "react";
import { View, Text, Image, StyleSheet, Dimensions, Animated, PanResponder } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radius, spacing } from "../theme";

const { width } = Dimensions.get("window");
const SWIPE_THRESHOLD = width * 0.28;

type Props = {
  user: any;
  onSwipe: (dir: "left" | "right") => void;
  zIndex?: number;
};

export default function SwipeCardSimple({ user, onSwipe, zIndex = 0 }: Props) {
  const translateX = useMemo(() => new Animated.Value(0), [user?.id]);
  const rotate = translateX.interpolate({
    inputRange: [-width, 0, width],
    outputRange: ["-20deg", "0deg", "20deg"],
    extrapolate: "clamp",
  });

  const likeOpacity = translateX.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const nopeOpacity = translateX.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const pan = PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4,
    onPanResponderMove: Animated.event([null, { dx: translateX }], { useNativeDriver: false }),
    onPanResponderRelease: (_, g) => {
      if (g.dx > SWIPE_THRESHOLD) {
        Animated.timing(translateX, { toValue: width, duration: 220, useNativeDriver: false })
          .start(() => onSwipe("right"));
      } else if (g.dx < -SWIPE_THRESHOLD) {
        Animated.timing(translateX, { toValue: -width, duration: 220, useNativeDriver: false })
          .start(() => onSwipe("left"));
      } else {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: false }).start();
      }
    },
    onPanResponderTerminate: () => Animated.spring(translateX, { toValue: 0, useNativeDriver: false }).start(),
  });

  return (
    <Animated.View
      {...pan.panHandlers}
      style={[styles.card, { zIndex, transform: [{ translateX }, { rotate }] }]}
    >
      {user?.photo_url ? (
        <Image source={{ uri: user.photo_url }} style={styles.photo} />
      ) : (
        <View style={[styles.photo, { backgroundColor: colors.card }]} />
      )}

      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.5)", "rgba(0,0,0,0.9)"]}
        style={styles.gradient}
      >
        <Text style={styles.name}>{user?.name}</Text>
        {!!user?.bio && <Text style={styles.bio}>{user.bio}</Text>}
      </LinearGradient>

      {/* Badges */}
      <Animated.View style={[styles.badge, styles.like, { opacity: likeOpacity }]}>
        <Text style={[styles.badgeText, { color: colors.like }]}>LIKE</Text>
      </Animated.View>
      <Animated.View style={[styles.badge, styles.nope, { opacity: nopeOpacity }]}>
        <Text style={[styles.badgeText, { color: colors.nope }]}>NOPE</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    width: "100%",
    height: "100%",
    borderRadius: radius.xl,
    overflow: "hidden",
    backgroundColor: colors.card,
  },
  photo: {
    width: "100%",
    height: "100%",
  },
  gradient: {
    position: "absolute",
    left: 0, right: 0, bottom: 0,
    padding: spacing(2),
    paddingBottom: spacing(3),
  },
  name: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
  },
  bio: {
    color: colors.textDim,
    marginTop: spacing(1),
  },
  badge: {
    position: "absolute",
    top: spacing(3),
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 4,
    borderRadius: radius.sm,
    backgroundColor: "transparent",
  },
  like: { left: spacing(3), borderColor: colors.like },
  nope: { right: spacing(3), borderColor: colors.nope },
  badgeText: { fontSize: 22, fontWeight: "900" },
});
