# Validata Mongo

Type safe data validation and sanitization for [MongoDB](https://www.mongodb.com/) update `$set` operations
using [validata](https://www.npmjs.com/package/validata).

See [validata](https://www.npmjs.com/package/validata) for more details on validation functionality.

## Getting started

```bash
npm i validata validata-mongo
```

## Basic usage

Given interfaces

```typescript
interface MyObject {
  required: string;
  optional?: string;
  child: Child;
}

interface Child {
  foo: number;
  bar: number;
}
```

And validata

```typescript
const myCheck = isObjectSet<MyObject>({
  required: isString(),
  optional: maybeString(),
  child: isObjectSet({
    foo: isNumber({ min: 1 }),
    bar: asNumber({ coerceMax: 10 }),
  }),
});
```

Then

```typescript
const result = check(myCheck, () => ({
  required: 'blue',
  child: {
    foo: 1,
    bar: 2,
  },
}));
console.log(JSON.stringify(result));
// -> SUCCESS -> {"required":"blue","child":{"foo":1,"bar":2}}

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

const result = check(myCheck, () => ({
  required: 'blue',
  'child.foo': 3,
}));
console.log(JSON.stringify(result));
// -> SUCCESS -> {"required":"blue","child.foo":3}

const result = check(myCheck, () => ({
  required: 'blue',
  'child.bar': '73',
}));
console.log(JSON.stringify(result));
// -> SUCCESS -> {"required":"blue","child.bar":10}
// NOTE child.bar has been converted to a number and coerced to a max of 10

check(myCheck, () => ({
  wow: 'blue',
}));
// -> ERROR -> {"issues":[{"path":["wow"],"value":"blue","reason":"unexpected-property"}],"name":"ValidationError"}

check(myCheck, () => ({
  required: 'blue',
  'child.unexpected': 17,
}));
// -> ERROR -> {"issues":[{"path":["child.unexpected"],"value":17,"reason":"unexpected-property"}],"name":"ValidationError"}
```
