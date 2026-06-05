import ContentContainer from "@/components/ContentContainer";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { useLanguage } from "@/contexts/LanguageContext";

export default function CustomiseInterfaceScreen() {
  const { t } = useLanguage();
  const { invertColors, setInvertColors } = useInvertColors();

  return (
    <ContentContainer headerTitle={t("settings_interface")}>
      <ToggleSwitch
        label={t("settings_invert_colours")}
        onValueChange={setInvertColors}
        value={invertColors}
      />
    </ContentContainer>
  );
}
