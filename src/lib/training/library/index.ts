import type { BuiltinMaterial } from "../types";
import { emergencyGuide } from "./emergency";
import { machineryRules } from "./machinery";
import { platformGuide } from "./platform";
import { reportingRules } from "./reporting";
import { safetyIS } from "./safety-is";
import { safetyLV } from "./safety-lv";
import { safetySE } from "./safety-se";

/** Standard materials shipped with the platform, in library order. */
export const BUILTIN_MATERIALS: readonly BuiltinMaterial[] = [
  platformGuide,
  reportingRules,
  safetyLV,
  safetySE,
  safetyIS,
  machineryRules,
  emergencyGuide,
];

export function builtinByKey(key: string | null | undefined): BuiltinMaterial | undefined {
  return key ? BUILTIN_MATERIALS.find((m) => m.key === key) : undefined;
}
