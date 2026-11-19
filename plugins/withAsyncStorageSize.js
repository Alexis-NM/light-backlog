const { withGradleProperties } = require("expo/config-plugins");

// AsyncStorage stores 6 MB at most by default, about 13,000 games in lists:
// past that, every save fails. This is the limit for the whole storage; a
// single value (one list, with its games) still has to stay under 2 MB to
// be read back.
const PROPERTY = "AsyncStorage_db_size_in_MB";
const SIZE_IN_MB = "50";

module.exports = function withAsyncStorageSize(config) {
  return withGradleProperties(config, (config) => {
    config.modResults = config.modResults.filter(
      (item) => !(item.type === "property" && item.key === PROPERTY)
    );
    config.modResults.push({
      type: "property",
      key: PROPERTY,
      value: SIZE_IN_MB,
    });
    return config;
  });
};
