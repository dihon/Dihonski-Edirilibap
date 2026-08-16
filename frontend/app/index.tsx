import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useAuth } from "@/src/auth";
import { COLORS } from "@/src/theme";

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surface }}>
        <ActivityIndicator size="large" color={COLORS.brand} />
      </View>
    );
  }

  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role === "driver") return <Redirect href="/(driver)" />;
  if (user.role === "admin") return <Redirect href="/(admin)" />;
  return <Redirect href="/(customer)" />;
}
