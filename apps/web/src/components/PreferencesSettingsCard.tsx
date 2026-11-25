import { useId } from "react";
import { updatePreferences, usePreferences, type Preferences } from "../lib/preferences.js";
import { Segmented } from "./ui.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card.js";
import { Switch } from "./ui/switch.js";

const switchSettings = [
  ["confirmExamSubmit", "交卷前二次确认"],
  ["showShortcutHints", "显示答题快捷键提示"],
  ["sidebarCollapsed", "启动时收起侧边栏"],
] as const;

export function PreferencesSettingsCard() {
  const id = useId();
  const preferences = usePreferences();
  return (
    <Card>
      <CardHeader>
        <div className="space-y-1">
          <CardTitle>显示与操作</CardTitle>
          <CardDescription>更改后自动保存。</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="divide-y divide-border">
        <div className="flex flex-wrap items-center justify-between gap-2 py-3">
          <span className="text-sm font-medium">题目字号</span>
          <Segmented
            label="题目字号"
            options={[
              ["small", "小"],
              ["standard", "标准"],
              ["comfortable", "舒适"],
              ["large", "大号"],
            ]}
            value={preferences.questionSize}
            onChange={(value) => updatePreferences({ questionSize: value as Preferences["questionSize"] })}
          />
        </div>
        {switchSettings.map(([key, label]) => (
          <div key={key} className="flex items-center justify-between gap-2 py-3">
            <label htmlFor={`${id}-${key}`} className="text-sm font-medium">{label}</label>
            <Switch
              id={`${id}-${key}`}
              checked={preferences[key]}
              onCheckedChange={(checked) => updatePreferences({ [key]: checked })}
            />
          </div>
        ))}
        <div className="flex flex-wrap items-center justify-between gap-2 py-3">
          <span className="text-sm font-medium">资料库默认视图</span>
          <Segmented
            label="资料库默认视图"
            options={[["list", "列表"], ["grid", "网格"]]}
            value={preferences.libraryView}
            onChange={(value) => updatePreferences({ libraryView: value as Preferences["libraryView"] })}
          />
        </div>
      </CardContent>
    </Card>
  );
}
