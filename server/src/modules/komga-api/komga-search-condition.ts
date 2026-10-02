import { BadRequestException } from '@nestjs/common';

import type { GroupRule, Rule, RuleOperator, StandardRule } from '@bookorbit/types';

/** Komga read status values; each maps to a BookOrbit rule on the same progression axis. */
const READ_STATUS_RULES: Record<string, { field: 'readProgress'; operator: 'isUnread' | 'isInProgress' | 'isFinished' }> = {
  UNREAD: { field: 'readProgress', operator: 'isUnread' },
  IN_PROGRESS: { field: 'readProgress', operator: 'isInProgress' },
  READ: { field: 'readProgress', operator: 'isFinished' },
};

/** The three states partition the axis, so `isNot` is the union of the other two. */
const READ_STATUS_COMPLEMENTS: Record<string, string[]> = {
  UNREAD: ['IN_PROGRESS', 'READ'],
  IN_PROGRESS: ['UNREAD', 'READ'],
  READ: ['UNREAD', 'IN_PROGRESS'],
};

export type SeriesCompletion = 'not_started' | 'in_progress' | 'complete';

const SERIES_READ_STATUS_COMPLETION: Record<string, SeriesCompletion> = {
  UNREAD: 'not_started',
  IN_PROGRESS: 'in_progress',
  READ: 'complete',
};

const SERIES_COMPLETION_COMPLEMENTS: Record<SeriesCompletion, SeriesCompletion[]> = {
  not_started: ['in_progress', 'complete'],
  in_progress: ['not_started', 'complete'],
  complete: ['not_started', 'in_progress'],
};

export interface KomgaConditionResolvers {
  seriesNameById(seriesId: number): Promise<string | null>;
}

/** Carries whatever a condition node contributed: rules, library scoping, and series-completion scoping. */
interface Fragment {
  rules: (Rule | GroupRule)[];
  libraryInclude?: number[];
  libraryExclude?: number[];
  completions?: SeriesCompletion[];
  matchesNothing?: true;
  dropped: boolean;
}

const EMPTY: Fragment = { rules: [], dropped: true };
const DROPPED: Fragment = EMPTY;

/**
 * A clause that can never match (an id no longer in the library) makes its whole AND-branch
 * unsatisfiable, which is what Komga answers an unknown id with: an empty page, not the library.
 */
const NO_MATCH: Fragment = { rules: [], matchesNothing: true, dropped: false };

type ConditionMode = 'books' | 'series';

function rule(field: StandardRule['field'], operator: RuleOperator, value?: StandardRule['value']): Fragment {
  return { rules: [{ type: 'rule', field, operator, ...(value === undefined ? {} : { value }) }], dropped: false };
}

/**
 * Translates Komga's search condition tree (allOf/anyOf over typed field clauses) into BookOrbit
 * filters.
 *
 * Only the operators BookOrbit's rule vocabulary can express are translated; a clause it cannot
 * express is dropped rather than failing the request, because the result set stays bounded by
 * library access and content filters (same policy as the flat query filters). An unknown *shape*
 * is still rejected: that would mean the client is speaking a different language.
 */
export class KomgaConditionTranslator {
  constructor(
    private readonly resolvers: KomgaConditionResolvers,
    private readonly mode: ConditionMode,
  ) {}

  async translate(condition: unknown): Promise<Fragment> {
    if (condition === undefined || condition === null) return EMPTY;
    return this.translateNode(condition);
  }

  private async translateNode(node: unknown): Promise<Fragment> {
    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      throw new BadRequestException('search condition must be an object');
    }
    const record = node as Record<string, unknown>;

    if (record.allOf !== undefined || record.anyOf !== undefined) {
      const key = record.allOf !== undefined ? 'allOf' : 'anyOf';
      const children = record[key];
      if (!Array.isArray(children) || children.length === 0) {
        throw new BadRequestException(`search condition ${key} must be a non-empty array`);
      }
      const fragments = await Promise.all(children.map((child) => this.translateNode(child)));
      return this.combine(fragments, key === 'allOf' ? 'AND' : 'OR');
    }

    const keys = Object.keys(record);
    if (keys.length !== 1) {
      throw new BadRequestException('search condition clause must name exactly one field');
    }
    return this.translateClause(keys[0], record[keys[0]]);
  }

  private combine(fragments: Fragment[], join: 'AND' | 'OR'): Fragment {
    const kept = fragments.filter((fragment) => !fragment.dropped);
    if (kept.length === 0) return EMPTY;

    if (join === 'AND') {
      const merged: Fragment = { rules: kept.flatMap((fragment) => fragment.rules), dropped: false };
      if (kept.some((fragment) => fragment.matchesNothing)) merged.matchesNothing = true;
      for (const fragment of kept) {
        if (fragment.libraryInclude) merged.libraryInclude = fragment.libraryInclude;
        if (fragment.libraryExclude) merged.libraryExclude = [...(merged.libraryExclude ?? []), ...fragment.libraryExclude];
        if (fragment.completions) {
          const current = merged.completions;
          const intersection = current ? current.filter((value) => fragment.completions?.includes(value)) : fragment.completions;
          merged.completions = intersection.length > 0 ? intersection : fragment.completions;
        }
      }
      return merged;
    }

    // An OR of scalar rules is a valid group; library and completion scoping can only survive when
    // every branch agrees, because both are applied outside the rule tree. An impossible branch is
    // false, so it drops out of the disjunction entirely.
    const satisfiable = kept.filter((fragment) => !fragment.matchesNothing);
    if (satisfiable.length === 0) return NO_MATCH;
    const rules = satisfiable.flatMap((fragment) => fragment.rules);
    const merged: Fragment = { rules: [], dropped: false };
    if (rules.length > 0) merged.rules = [rules.length === 1 ? rules[0] : { type: 'group', join: 'OR', rules }];
    merged.libraryInclude = sharedValue(satisfiable.map((fragment) => fragment.libraryInclude));
    merged.libraryExclude = sharedValue(satisfiable.map((fragment) => fragment.libraryExclude));
    merged.completions = sharedValue(satisfiable.map((fragment) => fragment.completions));
    return merged;
  }

  private async translateClause(field: string, rawOperand: unknown): Promise<Fragment> {
    if (!rawOperand || typeof rawOperand !== 'object' || Array.isArray(rawOperand)) return DROPPED;
    const operand = rawOperand as Record<string, unknown>;
    // Komga's own JSON uses camelCase (`isTrue`), KMReader sends lowercase (`istrue`).
    const operator = typeof operand.operator === 'string' ? operand.operator.trim().toLowerCase() : null;
    if (!operator) return DROPPED;

    switch (field) {
      case 'libraryId': {
        const id = Number(operand.value);
        if (!Number.isInteger(id) || id <= 0) return DROPPED;
        if (operator === 'is') return { rules: [], libraryInclude: [id], dropped: false };
        if (operator === 'isnot') return { rules: [], libraryExclude: [id], dropped: false };
        return DROPPED;
      }
      case 'readStatus':
        return this.translateReadStatus(operator, operand.value);
      case 'mediaStatus': {
        if (operator !== 'is' || typeof operand.value !== 'string') return DROPPED;
        const status = operand.value.toUpperCase();
        if (status === 'READY') return rule('fileAvailability', 'isPresent');
        if (status === 'ERROR') return rule('fileAvailability', 'isMissing');
        return DROPPED;
      }
      case 'seriesId':
        return await this.translateSeriesId(operator, operand.value);
      case 'deleted':
        if (operator === 'istrue') return rule('fileAvailability', 'isMissing');
        if (operator === 'isfalse') return rule('fileAvailability', 'isPresent');
        return DROPPED;
      // A one-shot has no series membership, so `istrue` is the empty side of the series axis.
      case 'oneshot':
        if (operator === 'istrue') return rule('series', 'isEmpty');
        if (operator === 'isfalse') return rule('series', 'isNotEmpty');
        return DROPPED;
      case 'complete':
        return this.translateComplete(operator);
      case 'releaseDate': {
        if ((operator !== 'after' && operator !== 'before') || typeof operand.dateTime !== 'string' || operand.dateTime.length === 0) return DROPPED;
        return rule('publishedDate', operator, operand.dateTime);
      }
      case 'title':
        return translateText(operator, operand.value, 'title');
      case 'author':
        return translateAuthor(operator, operand.value);
      case 'tag':
        return translateText(operator, operand.value, 'tag');
      case 'genre':
        return translateText(operator, operand.value, 'genre');
      case 'publisher':
        return translateText(operator, operand.value, 'publisher');
      case 'language':
        return translateText(operator, operand.value, 'language');
      default:
        return DROPPED;
    }
  }

  private translateReadStatus(operator: string, value: unknown): Fragment {
    if (typeof value !== 'string') return DROPPED;
    const status = value.toUpperCase();

    if (this.mode === 'series') {
      const completion = SERIES_READ_STATUS_COMPLETION[status];
      if (!completion) return DROPPED;
      if (operator === 'is') return { rules: [], completions: [completion], dropped: false };
      if (operator === 'isnot') return { rules: [], completions: SERIES_COMPLETION_COMPLEMENTS[completion], dropped: false };
      return DROPPED;
    }

    const direct = READ_STATUS_RULES[status];
    if (!direct) return DROPPED;
    if (operator === 'is') return rule(direct.field, direct.operator);

    const complements = operator === 'isnot' ? READ_STATUS_COMPLEMENTS[status] : undefined;
    if (!complements) return DROPPED;
    return {
      rules: [
        { type: 'rule', ...READ_STATUS_RULES[complements[0]] },
        { type: 'rule', ...READ_STATUS_RULES[complements[1]] },
      ],
      dropped: false,
    };
  }

  private async translateSeriesId(operator: string, value: unknown): Promise<Fragment> {
    if (this.mode === 'series') return DROPPED;
    if (operator !== 'is' && operator !== 'isnot') return DROPPED;
    const seriesId = Number(value);
    if (!Number.isInteger(seriesId) || seriesId <= 0) return DROPPED;

    const name = await this.resolvers.seriesNameById(seriesId);
    if (!name) return operator === 'is' ? NO_MATCH : EMPTY;
    return rule('series', operator === 'is' ? 'eq' : 'notEq', name);
  }

  private translateComplete(operator: string): Fragment {
    if (this.mode !== 'series') return DROPPED;
    if (operator === 'istrue') return { rules: [], completions: ['complete'], dropped: false };
    if (operator === 'isfalse') return { rules: [], completions: SERIES_COMPLETION_COMPLEMENTS.complete, dropped: false };
    return DROPPED;
  }
}

/** Three call sites must agree on identity, so the comparison lives in one place. */
function sharedValue<T>(values: (T | undefined)[]): T | undefined {
  if (values.length === 0 || values.some((value) => value === undefined)) return undefined;
  return values.every((value) => JSON.stringify(value) === JSON.stringify(values[0])) ? values[0] : undefined;
}

function translateText(operator: string, value: unknown, field: StandardRule['field']): Fragment {
  if (typeof value !== 'string' || value.length === 0) return DROPPED;
  if (operator === 'isnot') return rule(field, 'excludesAll', [value]);
  if (operator === 'contains') return rule(field, 'contains', value);
  if (operator === 'beginswith' || operator === 'startswith') return rule(field, 'startsWith', value);
  if (operator !== 'is') return DROPPED;
  return rule(field, 'includesAny', [value]);
}

/** Komga sends `author: { operator: 'is', value: { name } }`; role-scoped clauses are dropped. */
function translateAuthor(operator: string, value: unknown): Fragment {
  if (!value || typeof value !== 'object') return DROPPED;
  const name = (value as Record<string, unknown>).name;
  if (typeof name !== 'string' || name.length === 0) return DROPPED;
  if (operator === 'is') return rule('author', 'includesAny', [name]);
  if (operator === 'isnot') return rule('author', 'excludesAll', [name]);
  return DROPPED;
}
