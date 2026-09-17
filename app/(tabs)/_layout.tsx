import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Tabs } from "expo-router";
import { Navbar, type TabConfigItem } from "@/components/Navbar";
import { useFullscreen } from "@/contexts/FullscreenContext";

export const TABS_CONFIG: readonly TabConfigItem[] = [
  { name: "Library", screenName: "index", iconName: "grid-view" },
  { name: "Games", screenName: "games", iconName: "sports-esports" },
  { name: "Lists", screenName: "lists", iconName: "format-list-bulleted" },
  { name: "Settings", screenName: "settings", iconName: "settings" },
] as const;

function AppTabBar(props: BottomTabBarProps) {
  const { libraryFullscreen, gamesFullscreen } = useFullscreen();
  const activeScreenName = props.state.routes[props.state.index].name;

  // Hide the navbar in the library or games full-screen mode.
  if (activeScreenName === "index" && libraryFullscreen) {
    return null;
  }
  if (activeScreenName === "games" && gamesFullscreen) {
    return null;
  }

  return (
    <Navbar
      currentScreenName={activeScreenName}
      navigation={props.navigation}
      tabsConfig={TABS_CONFIG}
    />
  );
}

export default function TabLayout() {
  return (
    <Tabs tabBar={(props) => <AppTabBar {...props} />}>
      {TABS_CONFIG.map((tab) => (
        <Tabs.Screen
          key={tab.screenName}
          name={tab.screenName}
          options={{ header: () => null }}
        />
      ))}
    </Tabs>
  );
}
