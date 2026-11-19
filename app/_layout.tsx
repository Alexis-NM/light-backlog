import { Stack } from "expo-router";
import { useMemo } from "react";
import { StatusBar } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BrowseProvider } from "@/contexts/BrowseContext";
import { ConfirmProvider } from "@/contexts/ConfirmContext";
import { CredentialsProvider } from "@/contexts/CredentialsContext";
import { FullscreenProvider } from "@/contexts/FullscreenContext";
import {
  InvertColorsProvider,
  useInvertColors,
} from "@/contexts/InvertColorsContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { LibraryProvider } from "@/contexts/LibraryContext";
import { ListsProvider } from "@/contexts/ListsContext";
import { SortProvider } from "@/contexts/SortContext";
import { SyncProvider } from "@/contexts/SyncContext";
import { useIgdbRatingsBackfill } from "@/hooks/useIgdbRatings";

/**
 * Fills in the IGDB ratings that are missing. On its own, so that a change to
 * the library or to the lists does not render the navigator again.
 */
function RatingsBackfill() {
  useIgdbRatingsBackfill();
  return null;
}

function RootLayout() {
  const { invertColors } = useInvertColors();
  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      animation: "none" as const,
      contentStyle: {
        backgroundColor: invertColors ? "white" : "black",
      },
    }),
    [invertColors]
  );

  return <Stack screenOptions={screenOptions} />;
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <InvertColorsProvider>
        <LanguageProvider>
          <CredentialsProvider>
            <LibraryProvider>
              <ListsProvider>
                <BrowseProvider>
                  <FullscreenProvider>
                    <SortProvider>
                      <SyncProvider>
                        <ConfirmProvider>
                          <StatusBar hidden />
                          <RatingsBackfill />
                          <RootLayout />
                        </ConfirmProvider>
                      </SyncProvider>
                    </SortProvider>
                  </FullscreenProvider>
                </BrowseProvider>
              </ListsProvider>
            </LibraryProvider>
          </CredentialsProvider>
        </LanguageProvider>
      </InvertColorsProvider>
    </GestureHandlerRootView>
  );
}
