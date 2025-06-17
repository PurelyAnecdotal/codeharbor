import { ResultAsync } from 'neverthrow';

export const safeFetch = (input: RequestInfo | URL, init?: RequestInit) =>
	ResultAsync.fromPromise(fetch(input, init), (e) => e as DOMException | TypeError);
