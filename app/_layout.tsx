import { Stack } from "expo-router";
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

function RootLayout() {
  const { invertColors } = useInvertColors();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "none",
        contentStyle: {
          backgroundColor: invertColors ? "white" : "black",
        },
      }}
    />
  );
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
                      <ConfirmProvider>
                        <StatusBar hidden />
                        <RootLayout />
                      </ConfirmProvider>
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
