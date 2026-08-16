import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/src/auth";
import { Splash } from "@/src/components/Splash";

export default function Index() {
  const { user, loading } = useAuth();
  const [minElapsed, setMinElapsed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), 1600);
    return () => clearTimeout(t);
  }, []);

  if (loading || !minElapsed) return <Splash />;

  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role === "driver") return <Redirect href="/(driver)" />;
  if (user.role === "admin") return <Redirect href="/(admin)" />;
  return <Redirect href="/(customer)" />;
}
