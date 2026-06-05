import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import ContentContainer from "@/components/ContentContainer";
import { GameGrid } from "@/components/GameGrid";
import { StyledText } from "@/components/StyledText";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLists } from "@/contexts/ListsContext";

export default function ListDetailScreen() {
  const { t } = useLanguage();
  const { getList, deleteList } = useLists();
  const params = useLocalSearchParams<{
    id: string;
    confirmed?: string;
    action?: string;
  }>();

  const list = getList(params.id);

  useEffect(() => {
    if (params.confirmed === "true" && params.action === "deleteList") {
      deleteList(params.id);
      router.replace("/(tabs)/lists");
    }
  }, [params.confirmed, params.action, params.id, deleteList]);

  if (!list) {
    return <ContentContainer headerTitle=" " />;
  }

  const games = list.gameIds
    .map((gameId) => list.games[gameId])
    .filter((game) => game !== undefined);

  const confirmDelete = () =>
    router.push({
      pathname: "/confirm",
      params: {
        title: t("delete"),
        message: t("list_delete_confirm"),
        confirmText: t("delete"),
        action: "deleteList",
        returnPath: `/list/${params.id}`,
      },
    });

  return (
    <ContentContainer
      contentWidth="wide"
      headerTitle={list.name}
      rightAction={{ icon: "delete-outline", onPress: confirmDelete }}
    >
      {games.length > 0 ? (
        <GameGrid games={games} getSubtitle={(game) => game.year?.toString()} />
      ) : (
        <StyledText style={{ opacity: 0.6 }}>{t("list_empty")}</StyledText>
      )}
    </ContentContainer>
  );
}
