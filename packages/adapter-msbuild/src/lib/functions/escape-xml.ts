export const escapeXml = (unsafe: string): string => {
	return unsafe.replace(/[<>&'"]/g, (c) => {
		switch (c) {
			case '<': return '&lt;';

			case '>': return '&gt;';

			case '&': return '&amp;';

			case '\'': return '&apos;';

			case '"': return '&quot;';

			default: return c;
		}
	});
};

export const escapeXmlAttr = (v: string): string => {
	return v
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
};
