import { asNumber, asString, isNumber, isString, maybeAsString, maybeString } from 'validata';
import { isObjectSet } from './object-set';
import { expectIssue, expectSuccess, expectValue } from './test-helpers';

interface Deep {
  x: number;
  y?: string;
  d: MyObject;
}

interface MyObject {
  a: number;
  b: string;
}

interface ParentObject {
  o: Deep;
  s: string;
}

describe('isObjectSet', () => {
  it('will fail non-object', () => {
    const fut = isObjectSet();
    expectIssue(fut, null, 'not-defined');
    expectIssue(fut, undefined, 'not-defined');
    expectIssue(fut, 0, 'incorrect-type');
    expectIssue(fut, new Date(), 'incorrect-type');
    expectIssue(fut, [], 'incorrect-type');
    expectIssue(fut, 'test', 'incorrect-type');
  });

  it('will accept object', () => {
    const fut = isObjectSet();
    expectSuccess(fut, {});
    expectSuccess(fut, { a: 47 });
  });

  it('will process children', () => {
    const fut = isObjectSet<MyObject>({
      a: asNumber({ coerceMin: 25 }),
      b: asString(),
    });
    expectValue(fut, { a: 47, b: 'asd' }, { a: 47, b: 'asd' });
    expectValue(fut, { a: '47', b: 12 }, { a: 47, b: '12' });
    expectValue(fut, { a: '7', b: 12 }, { a: 25, b: '12' });
  });

  describe('deep object', () => {
    const fut = isObjectSet<ParentObject>({
      o: isObjectSet<Deep>({
        x: isNumber(),
        y: maybeAsString(),
        d: isObjectSet<MyObject>({
          a: isNumber({ coerceMax: 30 }),
          b: asString(),
        }),
      }),
      s: asString(),
    });

    it('will check type of 1st level props - incorrect-type', () => {
      expectIssue(fut,
        { o: 47, s: 'asd' },
        'incorrect-type',
        ['o'],
      );
    });

    it('will check type of 2nd level props - incorrect-type', () => {
      expectIssue(fut,
        { o: { d: 23 }, s: 'asd' },
        'incorrect-type',
        ['o', 'd'] ,
      );
    });

    it('will check type of 2nd level deep-props - incorrect-type', () => {
      expectIssue(fut,
        { 'o.d': 23, s: 'asd' },
        'incorrect-type',
        ['o.d'],
      );
    });

    it('will check type of 3rd level deep-props - success', () => {
      expectValue(fut,
        { 'o.d.a': 45 },
        { 'o.d.a': 30 } as any,
      );
    });

    it('will check all levels full objects - success', () => {
      expectValue(fut,
        { o: { x: 12, y: 12, d: { a: 23, b: 'foo' } }, s: 'asd' },
        { o: { x: 12, y: '12', d: { a: 23, b: 'foo' } }, s: 'asd' },
      );
    });

    it('will check all levels full objects (maybe) - success', () => {
      expectValue(fut,
        { o: { x: 12, d: { a: 23, b: 'foo' } }, s: 'asd' },
        { o: { x: 12, d: { a: 23, b: 'foo' } }, s: 'asd' } as any,
      );
    });

    it('will check will check 2nd level object property - incorrect-type', () => {
      expectIssue(fut,
        { o: { x: 'hello', y: 'hello' }, s: 'asd' },
        'incorrect-type',
        ['o', 'x'],
      );
    });

    it('will allow 1st level properties to be optional', () => {
      expectValue(fut,
        { s: 'asd' },
        { s: 'asd' } as any,
      );
    });

    it('will coerce 2nd level deep-properties', () => {
      expectValue(fut,
        { 'o.x': 12, 'o.y': 12 },
        { 'o.x': 12, 'o.y': '12' } as any,
      );
      expectValue(fut,
        { 'o.y': 12 },
        { 'o.y': '12' } as any,
      );
    });

    it('will allow 2nd level deep-properties to be optional', () => {
      expectValue(fut,
        { 'o.x': 12 },
        { 'o.x': 12 } as any,
      );
    });

    it('will check 2nd level deep-properties - unexpected-property', () => {
      expectIssue(fut,
        { 'o.a': 12 },
        'unexpected-property',
        ['o.a'],
      );
    });

    it('will check 3rd level deep-properties - unexpected-property', () => {
      expectIssue(fut,
        { 'o.d.foo': 12 },
        'unexpected-property',
        ['o.d.foo'],
      );
    });

    it('will not allow nested deep-properties - unexpected-property', () => {
      expectIssue(fut,
        { o: { 'd.a': 23 } },
        'unexpected-property',
        ['o', 'd.a'],
      );
    });

    it('will require non-optional properties on nested objects - not-defined', () => {
      expectIssue(fut,
        { o: {}, s: 'asd' },
        'not-defined',
        ['o', 'x'],
      );
      expectIssue(fut,
        { o: {}, s: 'asd' },
        'not-defined',
        ['o', 'd'],
      );
      expectIssue(fut,
        { o: { x: 12, y: 12 } }, // ISSUE missing 'd'
        'not-defined',
        ['o', 'd'],
      );
    });

    it('will not require properties on nested objects - success', () => {
      expectSuccess(fut,
        { o: { x: 12, d: { a: 23, b: 'foo' } } },
      );
    });

    it('will not allow additional properties on nested objects - unexpected-property', () => {
      expectIssue(fut,
        { o: { x: 12, foo: 12, d: { a: 23, b: 'foo' } } },
        'unexpected-property',
        ['o', 'foo'],
      );
    });
  });

  it('will process children', () => {
    const fut = isObjectSet<MyObject>({
      a: isNumber({ min: 25 }),
      b: isString(),
    });
    expectValue(fut, { a: 47, b: 'asd' }, { a: 47, b: 'asd' });
    expectIssue(fut, { a: '47', b: 'asd' }, 'incorrect-type', ['a']);
    expectIssue(fut, { a: 47, b: 'asd', c: 234 }, 'unexpected-property', ['c']);
    expectValue(fut, {}, {} as any);
  });

  it('will handle optional property', () => {
    const fut = isObjectSet<{ a: number, b?: string }>({
      a: isNumber(),
      b: maybeString(),
    });
    expectValue(fut, {}, {} as any);
    expectValue(fut, { b: 'asd' }, { b: 'asd' } as any);
    {
      const result = expectSuccess(fut, { a: 42 });
      expect(result.value).not.toHaveProperty('b');
    }
    {
      const result = expectSuccess(fut, { a: 42, b: undefined });
      expect(result.value).toHaveProperty('b');
      expect(result.value.b).toEqual(undefined);
    }
    {
      const result = expectSuccess(fut, { a: 42, b: null });
      expect(result.value).toHaveProperty('b');
      expect(result.value.b).toEqual(undefined);
    }
  });

  it('will error on unexpected properties', () => {
    const fut = isObjectSet<MyObject>({
      a: isNumber({ min: 25 }),
      b: isString(),
    });
    expectIssue(fut, { a: 47, b: 'asd', c: 234 }, 'unexpected-property', ['c']);
  });

  it('will strip unexpected properties', () => {
    const fut = isObjectSet<MyObject>({
      a: isNumber({ min: 25 }),
      b: isString(),
    }, { stripExtraProperties: true });
    expectValue(fut, { a: 47, b: 'asd', c: 345, d: 'hello' }, { a: 47, b: 'asd' });
  });
});
