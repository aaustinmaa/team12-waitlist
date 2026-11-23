// One import, start to finish: read the file, profile it, get a recipe (saved,
// AI-proposed, or rule-based), convert and validate. Nothing here changes the
// clinic's data; the store commits the result once staff confirm.

import type { ReferralRecord } from "../engine/types";
import { proposeByGemini, type Transport } from "./gemini";
import { parseDelimited, type Table } from "./parse";
import { profileTable, type TableProfile } from "./profile";
import { applyRecipe, type Recipe, type RowIssue } from "./recipe";
import { proposeByRules } from "./rules";
import { validateRecords, type Validation } from "./validate";

export interface Analysis {
  fileName: string;
  table: Table;
  profile: TableProfile;
}

export function analyse(fileName: string, text: string): Analysis {
  const table = parseDelimited(text);
  return { fileName, table, profile: profileTable(table) };
}

/** A saved recipe can be reused as long as the export still has every column it uses. */
export function recipeFits(recipe: Recipe, table: Table) {
  const used = [...Object.values(recipe.columns), recipe.event?.kind_column, recipe.event?.date_column, recipe.event?.appointment_column, recipe.event?.note_column].filter(Boolean) as string[];
  return used.every((c) => table.header.includes(c));
}

export interface AiSettings {
  geminiKey: string;
  geminiModel: string;
}

/** With a transport, the AI proposes the recipe (rules if it fails); without one, the rules do. */
export async function proposeRecipe(a: Analysis, ai: Transport | null): Promise<{ recipe: Recipe; aiError: string | null }> {
  if (ai) {
    try {
      return { recipe: await proposeByGemini(a.profile, ai), aiError: null };
    } catch (e) {
      return { recipe: proposeByRules(a.profile), aiError: e instanceof Error ? e.message : String(e) };
    }
  }
  return { recipe: proposeByRules(a.profile), aiError: null };
}

export interface Conversion {
  records: ReferralRecord[];
  /** problems converting rows, then problems found by validation */
  issues: RowIssue[];
  validation: Validation;
}

export function convert(a: Analysis, recipe: Recipe, opts: { today: string; previous?: ReferralRecord[] }): Conversion {
  const applied = applyRecipe(a.table, recipe);
  const validation = validateRecords(applied.records, { today: opts.today, previous: opts.previous });
  return { records: validation.records, issues: [...applied.issues, ...validation.issues], validation };
}
