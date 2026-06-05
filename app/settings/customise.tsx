import { type Href, router } from "expo-router";
import ContentContainer from "@/components/ContentContainer";
import { SelectorButton } from "@/components/SelectorButton";
import { StyledButton } from "@/components/StyledButton";
import { useLanguage } from "@/contexts/LanguageContext";

export default function CustomiseScreen() {
  const { t, language } = useLanguage();

  return (
    <ContentContainer headerTitle={t("settings_customise")}>
      <StyledButton
        onPress={() => router.push("/settings/customise-interface" as Href)}
        text={t("settings_interface")}
      />
      <SelectorButton
        href="/settings/language"
        label={t("settings_language")}
        value={t(language === "fr" ? "language_fr" : "language_en")}
      />
    </ContentContainer>
  );
}
