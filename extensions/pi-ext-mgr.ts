/**
 * Extension Manager
 *
 * Provides a /extensions command to enable/disable installed pi packages.
 * Enabled packages stay in settings.json; disabled ones move to a separate
 * config file so they don't load on next startup.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { getSettingsListTheme } from "@earendil-works/pi-coding-agent";
import { Container, type SettingItem, SettingsList } from "@earendil-works/pi-tui";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

interface PackageEntry {
  source: string;
  label: string;
  enabled: boolean;
  original: string | object;
}

function getDisabledPath(): string {
  return join(getAgentDir(), "extension-manager.json");
}

function loadDisabled(): string[] {
  const p = getDisabledPath();
  if (!existsSync(p)) return [];
  try {
    const data = JSON.parse(readFileSync(p, "utf-8"));
    return Array.isArray(data.disabled) ? data.disabled : [];
  } catch {
    return [];
  }
}

function saveDisabled(disabled: string[]): void {
  writeFileSync(getDisabledPath(), JSON.stringify({ disabled }, null, 2) + "\n");
}

function sourceToLabel(source: string): string {
  return source
    .replace(/^git:/, "")
    .replace(/^npm:/, "")
    .replace(/^https?:\/\//, "")
    .split("@")[0]
    .split("/")
    .slice(-2)
    .join("/");
}

function loadPackages(): PackageEntry[] {
  const raw = JSON.parse(readFileSync(join(getAgentDir(), "settings.json"), "utf-8"));
  const packages: (string | object)[] = raw.packages ?? [];
  const disabledList = loadDisabled();
  const enabledSources = new Set(
    packages.map((e) => (typeof e === "string" ? e : (e as any).source ?? JSON.stringify(e))),
  );

  const entries: PackageEntry[] = packages.map((entry) => {
    const source = typeof entry === "string" ? entry : (entry as any).source ?? JSON.stringify(entry);
    return { source, label: sourceToLabel(source), enabled: true, original: entry };
  });

  // Re-add disabled packages that were removed from settings.json
  for (const source of disabledList) {
    if (!enabledSources.has(source)) {
      entries.push({ source, label: sourceToLabel(source), enabled: false, original: source });
    }
  }

  return entries;
}

function savePackages(entries: PackageEntry[]): void {
  const settingsPath = join(getAgentDir(), "settings.json");
  const raw = JSON.parse(readFileSync(settingsPath, "utf-8"));

  // Only keep enabled packages in settings.json
  raw.packages = entries.filter((e) => e.enabled).map((e) => e.original);
  writeFileSync(settingsPath, JSON.stringify(raw, null, 2) + "\n");

  // Store disabled list separately
  saveDisabled(entries.filter((e) => !e.enabled).map((e) => e.source));
}

export default function extensionManager(pi: ExtensionAPI) {
  pi.registerCommand("extensions", {
    description: "Enable/disable installed packages",
    handler: async (_args, ctx) => {
      if (ctx.mode !== "tui") {
        ctx.ui.notify("/extensions requires TUI mode", "error");
        return;
      }

      let entries = loadPackages();

      if (entries.length === 0) {
        ctx.ui.notify("No packages installed", "info");
        return;
      }

      await ctx.ui.custom((tui, theme, _kb, done) => {
        const items: SettingItem[] = entries.map((e) => ({
          id: e.source,
          label: e.label,
          currentValue: e.enabled ? "enabled" : "disabled",
          values: ["enabled", "disabled"],
        }));

        const container = new Container();
        container.addChild(
          new (class {
            render(_width: number) {
              return [theme.fg("accent", theme.bold("Package Manager")), ""];
            }
            invalidate() {}
          })(),
        );

        const settingsList = new SettingsList(
          items,
          Math.min(items.length + 2, 15),
          getSettingsListTheme(),
          (id, newValue) => {
            const entry = entries.find((e) => e.source === id);
            if (!entry) return;
            entry.enabled = newValue === "enabled";
            savePackages(entries);
          },
          () => {
            done(undefined);
          },
        );

        container.addChild(settingsList);

        const component = {
          render(width: number) {
            return container.render(width);
          },
          invalidate() {
            container.invalidate();
          },
          handleInput(data: string) {
            settingsList.handleInput?.(data);
            tui.requestRender();
          },
        };

        return component;
      });

      ctx.ui.notify("Run /reload to apply changes", "info");
    },
  });
}
