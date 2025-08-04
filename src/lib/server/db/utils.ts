import {
	sql,
	type ColumnBaseConfig,
	type ColumnDataType
} from 'drizzle-orm';
import { type SQLiteColumn } from 'drizzle-orm/sqlite-core';

export const jsonGroupArray = <T extends ColumnBaseConfig<ColumnDataType, string>>(
	column: SQLiteColumn<T>
) => sql`json_group_array(${column})`.mapWith((data) => parseSqliteJson<T['data'][]>(data));

const parseSqliteJson = <T = unknown>(data: string): T => {
	const value: T = JSON.parse(data);

	if (Array.isArray(value) && value.length === 1 && value[0] === null) return [] as T;

	return value;
};
