import "server-only";
import { cache } from "react";
import { createT, getDictionary } from "./index";

/** Server-side translator. Locale comes from the user profile (see getAppContext). */
export const getT = cache((locale: string = "lv") => createT(getDictionary(locale)));
