import { isDefined } from './is-defined.ts';

const maxObjectOwnProperties = 5;

export const formatSimpleLogObject = (value: unknown): string => {
	return JSON.stringify(
		value, (_k, v: unknown) => {
			if (typeof v === 'function') {
				return v.name;
			}

			if (!isDefined(v) || typeof v !== 'object' || Array.isArray(v)) {
				return v;
			}

			if (JSON.stringify(v) === '{}') {
				const propertyNames = Object.getOwnPropertyNames(v);
				let propertyContents = propertyNames.filter(propertyName => !propertyName.startsWith('_')).map((propertyName) => {
					const propertyValue = v[propertyName as keyof typeof v];
					const propertyValueString = String(propertyValue);

					return [propertyName, propertyValueString.includes('[native code]') ? '[native code]' : propertyValueString] as const;
				});

				if (propertyContents.length > maxObjectOwnProperties) {
					propertyContents = propertyContents
						.slice(0, maxObjectOwnProperties)
						.concat([['...', `${(propertyContents.length - maxObjectOwnProperties).toString()} more...`]]);
				}

				return Object.fromEntries(propertyContents);
			}

			return v;
		}, '\t',
	);
};
