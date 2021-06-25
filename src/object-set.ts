import { Contract, isIssue, Issue, Path, Result, ValueProcessor } from 'validata';
import { basicValidation, Check, Coerce, CommonValidationOptions, Convert, createIsCheck, Validate } from 'validata/dev';

const DEEP = Symbol('deep');

interface AdditionalOptions {
  stripExtraProperties?: boolean;
}

interface CoerceOptions<T> extends AdditionalOptions {
  contract?: Contract<T>;
}

interface ValidationOptions<T> extends CommonValidationOptions<T> { }

const tidyDeepPath = (path: Path[]): Path[] => {
  return path
    .reduce((acc, item) => {
      if (acc.length) {
        const lastItem = acc[acc.length - 1];
        if (acc.length > 1) {
          const prevItem = acc[acc.length - 2];
          if (lastItem === DEEP && typeof prevItem === 'string' && typeof item === 'string') {
            return [...acc.slice(0, -2), `${prevItem}.${item}`];
          }
        }
        if (lastItem === DEEP) {
          return [...acc.slice(0, -1), item];
        }
      }
      return [...acc, item];
    }, [] as Path[])
    .filter((item) => item !== DEEP);
};

const tidyDeepIssuePaths = (issues: Issue[]): Issue[] => issues.map((issue) => Issue.forPath(
  tidyDeepPath(issue.path),
  issue.value,
  issue.reason,
  issue.info,
));

class Generic<T extends Record<string, any>> {
  public check: Check<T> = (value: unknown): value is T => {
    return typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
  }

  public convert: Convert<T> = (value) => {
    if (typeof value === 'string' && value[0] === '{' && value[value.length - 1] === '}') {
      try {
        return JSON.parse(value) as T;
      } catch {
        return undefined;
      }
    }

    return undefined;
  };

  public process = (contract: Contract<T>, target: T, path: Path[]): Result<T> => {
    const issues: Issue[] = [];
    const output = {} as T;

    (Object.keys(target) as Array<keyof T>).forEach((key) => {
      const parts = (key as string).split('.');
      const firstPart = parts[0];
      if (!(firstPart in contract)) {
        issues.push(
          Issue.forPath([...path, key], target[key], 'unexpected-property'),
        );
        return;
      }

      const childKey = parts.slice(1).join('.');
      const check = contract[firstPart];
      const value = target[key];

      // disallow child objects with dots in the property names
      if (value && this.check(value)) {
        Object.keys(value).forEach((nestedKey) => {
          if (!nestedKey.includes('.')) return;
          issues.push(Issue.forPath([...path, key, nestedKey], value[nestedKey], 'unexpected-property'));
        });
      }

      const directProperty = parts.length === 1;
      const childPath = directProperty ? [...path, key] : [...path, firstPart, DEEP];

      const childResult = check.process(directProperty ? value : { [childKey]: value }, childPath);
      if (isIssue(childResult)) {
        issues.push(...tidyDeepIssuePaths(childResult.issues));
        return;
      }
      if (childResult.value === undefined && !(key in target)) return;

      output[key] = parts.length === 1 ? childResult.value : childResult.value[childKey as keyof T];
    });

    // require all properties - not for root object & not for deep nesting
    if (path.length && path[path.length - 1] !== DEEP) {
      const targetKeys = new Set<Path>(Object.keys(target).map((key) => key.split('.')[0]));
      const missingKeys = Object.keys(contract).filter((key) => !targetKeys.has(key));
      missingKeys.forEach((key) => {
        const childResult = contract[key].process(undefined, [...path, key]);
        if (isIssue(childResult)) {
          issues.push(...tidyDeepIssuePaths(childResult.issues));
        }
      });
    }

    return issues.length ? { issues } : { value: output };
  }

  public coerce: Coerce<T, CoerceOptions<T>> = (options) => (next) => (value, path) => {
    if (!options) return next(value, path);

    let coerced = { ...value };
    if (!options.contract) return next(coerced, path);

    if (options.stripExtraProperties) {
      const allowedProperties = new Set(Object.keys(options.contract));
      (Object.keys(coerced) as (keyof T)[]).forEach((key) => {
        if (allowedProperties.has(key as string)) return;
        delete coerced[key];
      });
    }
    const result = this.process(options.contract, coerced, path);
    if (isIssue(result)) return result;

    if (result) {
      coerced = result.value;
    }
    return next(coerced, path);
  }

  public validate: Validate<T, ValidationOptions<T>> = (value, path, options) => basicValidation(value, path, options);
}

export type ObjectOptions<T> = ValidationOptions<T> & AdditionalOptions;

export const isObjectSet = <T extends { [key: string]: any; }>(contract?: Contract<T>, options?: ObjectOptions<T>): ValueProcessor<T> => {
  const generic = new Generic<T>();
  return createIsCheck('object', generic.check, generic.coerce, generic.validate)({ ...options, contract });
};
