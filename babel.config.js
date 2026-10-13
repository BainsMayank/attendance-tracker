module.exports = function (api) {
  const test = api.env("test");
  return {
    presets: ["babel-preset-expo"],
    plugins: test ? [] : [["inline-import", { extensions: [".sql"] }]],
  };
};
