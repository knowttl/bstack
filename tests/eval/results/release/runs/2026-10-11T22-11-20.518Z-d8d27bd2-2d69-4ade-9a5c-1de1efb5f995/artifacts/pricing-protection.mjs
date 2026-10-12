import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const { postOrder } = await import(pathToFileURL(process.argv[2] + '/packages/web/routes.ts'));
for (const [quantity, unitPrice] of [[1,12],[5,12],[6,12],[6,10],[0,12],[-1,12],[2.5,0.1],[6,Infinity],[NaN,12],[-0,12]]) {
  const expected = unitPrice * quantity * (quantity > 5 ? 0.9 : 1);
  assert.deepEqual(postOrder(quantity,unitPrice), {status:201,total:expected});
}
assert.deepEqual(postOrder(1), {status:201,total:12});
console.log('PASS: default public route price and 10 unchanged arithmetic cases, including quantity 5/6 threshold, explicit prices and numeric edge cases.');
