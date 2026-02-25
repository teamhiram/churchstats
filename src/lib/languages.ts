/** DB には英語で保存。表示用ラベルは各言語表記。 */
export const LANGUAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "—" },
  { value: "Japanese", label: "日本語" },
  { value: "English", label: "English" },
  { value: "Chinese", label: "中文" },
  { value: "Spanish", label: "Español" },
  { value: "French", label: "Français" },
];

const VALUE_TO_LABEL = new Map(LANGUAGE_OPTIONS.filter((o) => o.value).map((o) => [o.value, o.label]));

export function getLanguageLabel(value: string | null | undefined): string {
  if (value == null || value === "") return "—";
  const label = VALUE_TO_LABEL.get(value);
  return label ?? "—";
}
