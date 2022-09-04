import { asNumber, check, isNumber, isString, maybeString } from 'validata';
import { isObjectSet } from '../object-set';

interface MyObject {
  required: string;
  optional?: string;
  child: Child;
}

interface Child {
  foo: number;
  bar: number;
}

describe('example one', () => {
  const myCheck = isObjectSet<MyObject>({
    required: isString(),
    optional: maybeString(),
    child: isObjectSet({
      foo: isNumber({ min: 1 }),
      bar: asNumber({ coerceMax: 10 }),
    }),
  });

  it('will pass valid value', () => {
    const result = check(myCheck, () => ({
      required: 'blue',
      child: {
        foo: 1,
        bar: 2,
      },
    }));
    console.log(JSON.stringify(result));
    // -> SUCCESS -> {"required":"blue","child":{"foo":1,"bar":2}}
    expect(result).toEqual({ required: 'blue', child: { foo: 1, bar: 2 } });
  });

  it('will coerce valid value', () => {
    const result = check(myCheck, () => ({
      required: 'blue',
      optional: 'red',
      child: {
        foo: 20,
        bar: '20',
      },
    }));
    console.log(JSON.stringify(result));
    // -> SUCCESS -> {"required":"blue","optional":"red","child":{"foo":20,"bar":10}}
    // NOTE child.bar has been converted to a number and coerced to a max of 10
    expect(result).toEqual({ required: 'blue', optional: 'red', child: { foo: 20, bar: 10 } });
  });

  it('will pass valid $set deep paths', () => {
    const result = check(myCheck, () => ({
      required: 'blue',
      'child.foo': 3,
    }));
    console.log(JSON.stringify(result));
    // -> SUCCESS -> {"required":"blue","child.foo":3}
    expect(result).toEqual({ required: 'blue', 'child.foo': 3 });
  });

  it('will coerce valid $set deep paths', () => {
    const result = check(myCheck, () => ({
      required: 'blue',
      'child.bar': '73',
    }));
    console.log(JSON.stringify(result));
    // -> SUCCESS -> {"required":"blue","child.bar":10}
    // NOTE child.bar has been converted to a number and coerced to a max of 10
    expect(result).toEqual({ required: 'blue', 'child.bar': 10 });
  });

  it('will not allow additional properties', () => {
    try {
      check(myCheck, () => ({
        wow: 'blue',
      }));
      fail();
    }
    catch (err: any) {
      console.log(JSON.stringify(err));
      // -> ERROR -> {"issues":[{"path":["wow"],"value":"blue","reason":"unexpected-property"}],"name":"ValidationError"}
      expect({ ...err }).toEqual(expect.objectContaining({
        issues: [
          expect.objectContaining({ path: ['wow'], value: 'blue', reason: 'unexpected-property' }),
        ],
      }));
    }
  });

  it('will not allow additional deep properties', () => {
    try {
      check(myCheck, () => ({
        required: 'blue',
        'child.unexpected': 17,
      }));
      fail();
    }
    catch (err: any) {
      console.log(JSON.stringify(err));
      // -> ERROR -> {"issues":[{"path":["child.unexpected"],"value":17,"reason":"unexpected-property"}],"name":"ValidationError"}
      expect({ ...err }).toEqual(expect.objectContaining({
        issues: [
          expect.objectContaining({ path: ['child.unexpected'], value: 17, reason: 'unexpected-property' }),
        ],
      }));
    }
  });
});
