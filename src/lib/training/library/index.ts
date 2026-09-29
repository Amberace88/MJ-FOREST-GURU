import type { BuiltinMaterial } from "../types";
import { chainsawSafety } from "./chainsaw";
import { emergencyGuide } from "./emergency";
import { environmentProtection } from "./environment";
import { firstAidForest } from "./first-aid";
import { natureValues } from "./nature-values";
import { platformAdminGuide } from "./platform-admin";
import { productionMeasurement } from "./production";
import { machineryRules } from "./machinery";
import { platformGuide } from "./platform";
import { reportingRules } from "./reporting";
import { safetyIS } from "./safety-is";
import { safetyLV } from "./safety-lv";
import { safetySE } from "./safety-se";

/** Standard materials shipped with the platform, in library order. */
export const BUILTIN_MATERIALS: readonly BuiltinMaterial[] = [
  platformAdminGuide,
  platformGuide,
  reportingRules,
  productionMeasurement,
  safetyLV,
  safetySE,
  safetyIS,
  machineryRules,
  chainsawSafety,
  emergencyGuide,
  firstAidForest,
  environmentProtection,
  natureValues,
];

export function builtinByKey(key: string | null | undefined): BuiltinMaterial | undefined {
  return key ? BUILTIN_MATERIALS.find((m) => m.key === key) : undefined;
}
