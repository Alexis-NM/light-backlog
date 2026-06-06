import ContentContainer from "@/components/ContentContainer";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { useHideArtwork } from "@/contexts/HideArtworkContext";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { useLanguage } from "@/contexts/LanguageContext";

export default function CustomiseInterfaceScreen() {
  const { t } = useLanguage();
  const { invertColors, setInvertColors } = useInvertColors();
  const { hideArtwork, setHideArtwork } = useHideArtwork();

  return (
    <ContentContainer headerTitle={t("settings_interface")}>
      <ToggleSwitch
        label={t("settings_invert_colours")}
        onValueChange={setInvertColors}
        value={invertColors}
      />
      <ToggleSwitch
        label={t("settings_hide_artwork")}
        onValueChange={setHideArtwork}
        value={hideArtwork}
      />
    </ContentContainer>
  );
}
