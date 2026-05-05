module.exports = (api) => {
	api.cache(true);
	return {
		presets: [
			[
				"babel-preset-expo",
				{
					// Required for ESM packages in workspace (e.g. @app/ui, @app/logger)
					unstable_transformImportMeta: true,
				},
			],
		],
	};
};
