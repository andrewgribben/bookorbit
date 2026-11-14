export declare function isObject(v: unknown): v is Record<string, unknown>;
export declare function isString(v: unknown): v is string;
export declare function isNullableString(v: unknown): v is string | null;
export declare function isNumber(v: unknown): v is number;
export declare function isNullableNumber(v: unknown): v is number | null;
export declare function isBoolean(v: unknown): v is boolean;
export declare function isArray(v: unknown): v is unknown[];
export declare function isArrayOf<T>(v: unknown, check: (item: unknown) => item is T): v is T[];
